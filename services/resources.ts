import mongoose, { ClientSession, Model } from 'mongoose';
import { isEmail } from 'validator';
import User from '../models/user';
import Task from '../models/task';
import { RequestResponseError } from '../util';

function bodyObject(body: unknown): Record<string, any> {
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
        throw new RequestResponseError('Request body must be an object');
    }
    return body as Record<string, any>;
}

function requiredString(value: unknown, field: string): string {
    if (typeof value !== 'string' || !value.trim()) {
        throw new RequestResponseError(`${field} must be a non-empty string`);
    }
    return value.trim();
}

function referenceId(value: unknown, field: string): string {
    if (typeof value !== 'string' || !mongoose.isObjectIdOrHexString(value)) {
        throw new RequestResponseError(`${field} must contain a valid id`);
    }
    return value.toLowerCase();
}

async function requireResource(model: Model<any>, id: string, session: ClientSession) {
    if (!mongoose.isObjectIdOrHexString(id)) {
        throw new RequestResponseError('Resource not found', 404);
    }
    const resource = await model.findById(id).session(session);
    if (!resource) throw new RequestResponseError('Resource not found', 404);
    return resource;
}

// Atlas supports transactions. A failure rolls back every related document.
async function transaction<T>(work: (session: ClientSession) => Promise<T>): Promise<T> {
    const session = await mongoose.startSession();
    try {
        return await session.withTransaction(() => work(session));
    } finally {
        await session.endSession();
    }
}

export function saveUser(body: unknown, id?: string) {
    return transaction(async session => {
        // URL ids take precedence over invalid body fields.
        const previous = id === undefined ? null : await requireResource(User, id, session);
        const input = bodyObject(body);
        const name = requiredString(input.name, 'name');
        const email = requiredString(input.email, 'email');
        if (!isEmail(email, { allow_underscores: true, allow_utf8_local_part: false, allow_ip_domain: true })) {
            throw new RequestResponseError('email must be a valid email address');
        }
        const pending = input.pendingTasks === undefined ? [] : input.pendingTasks;
        if (!Array.isArray(pending)) throw new RequestResponseError('pendingTasks must be an array');
        const pendingTasks = [...new Set<string>(pending.map(value => referenceId(value, 'pendingTasks')))];
        const user = previous ?? new User();
        const userId = user._id.toString();
        if (await User.exists({ email, _id: { $ne: user._id } }).session(session)) {
            throw new RequestResponseError('Email is already used by another user');
        }
        const tasks = await Task.find({ _id: { $in: pendingTasks } }).session(session);
        if (tasks.some(task => task.completed)) {
            throw new RequestResponseError('pendingTasks cannot contain completed tasks');
        }
        if (tasks.length !== pendingTasks.length) {
            throw new RequestResponseError('A referenced task does not exist', 404);
        }

        user.set({ name, email, pendingTasks });
        await user.save({ session });
        // Remove tasks moved here from any previous owner's pending list.
        await User.updateMany({ _id: { $ne: user._id }, pendingTasks: { $in: pendingTasks } },
            { $pull: { pendingTasks: { $in: pendingTasks } } }, { session });
        // Omitted pending tasks become unassigned; completed assignments remain.
        await Task.updateMany({ assignedUser: userId, completed: false, _id: { $nin: pendingTasks } },
            { $set: { assignedUser: '', assignedUserName: 'unassigned' } }, { session });
        await Task.updateMany({ _id: { $in: pendingTasks } },
            { $set: { assignedUser: userId, assignedUserName: name } }, { session });
        // Renames also apply to the user's completed tasks.
        await Task.updateMany({ assignedUser: userId }, { $set: { assignedUserName: name } }, { session });
        return user.toObject();
    });
}

export function saveTask(body: unknown, id?: string) {
    return transaction(async session => {
        const previous = id === undefined ? null : await requireResource(Task, id, session);
        const input = bodyObject(body);
        const name = requiredString(input.name, 'name');
        if ((typeof input.deadline !== 'string' && typeof input.deadline !== 'number') ||
            (typeof input.deadline === 'string' && !input.deadline.trim())) {
            throw new RequestResponseError('deadline must be a valid date');
        }
        const deadline = new Date(input.deadline);
        if (!Number.isFinite(deadline.getTime())) throw new RequestResponseError('deadline must be a valid date');
        if (input.description !== undefined && typeof input.description !== 'string') {
            throw new RequestResponseError('description must be a string');
        }
        if (input.completed !== undefined && typeof input.completed !== 'boolean') {
            throw new RequestResponseError('completed must be a boolean');
        }
        if (input.assignedUserName !== undefined && typeof input.assignedUserName !== 'string') {
            throw new RequestResponseError('assignedUserName must be a string');
        }
        const assignedUser = input.assignedUser === undefined || input.assignedUser === ''
            ? '' : referenceId(input.assignedUser, 'assignedUser');
        if (!assignedUser && input.assignedUserName !== undefined && input.assignedUserName !== 'unassigned') {
            throw new RequestResponseError('An unassigned task must have assignedUserName "unassigned"');
        }
        const owner = assignedUser ? await User.findById(assignedUser).session(session) : null;
        if (assignedUser && !owner) throw new RequestResponseError('Assigned user does not exist', 404);
        if (owner && input.assignedUserName !== undefined && input.assignedUserName !== owner.name) {
            throw new RequestResponseError('assignedUserName must match the assigned user');
        }
        const task = previous ?? new Task();
        task.set({ name, deadline, description: input.description ?? '', completed: input.completed ?? false,
            assignedUser, assignedUserName: owner ? owner.name : 'unassigned' });
        await task.save({ session });
        const taskId = task._id.toString();
        await User.updateMany({ pendingTasks: taskId }, { $pull: { pendingTasks: taskId } }, { session });
        if (owner) {
            // Write the owner even for completed tasks, so concurrent renames or
            // deletions conflict and retry instead of leaving a stale assignment.
            await User.updateOne({ _id: owner._id }, {
                $inc: { __v: 1 },
                ...(!task.completed ? { $addToSet: { pendingTasks: taskId } } : {})
            }, { session });
        }
        return task.toObject();
    });
}

export function deleteUser(id: string) {
    return transaction(async session => {
        const user = await requireResource(User, id, session);
        await Task.updateMany({ assignedUser: user._id.toString() },
            { $set: { assignedUser: '', assignedUserName: 'unassigned' } }, { session });
        await user.deleteOne({ session });
        return user.toObject();
    });
}

export function deleteTask(id: string) {
    return transaction(async session => {
        const task = await requireResource(Task, id, session);
        await User.updateMany({ pendingTasks: task._id.toString() },
            { $pull: { pendingTasks: task._id.toString() } }, { session });
        await task.deleteOne({ session });
        return task.toObject();
    });
}
