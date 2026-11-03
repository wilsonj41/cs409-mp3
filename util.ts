import mongoose, { Model } from "mongoose"
import { ParsedQs } from "qs"

export class RequestResponseError extends Error {
    status: number;
    message: string;

    constructor(message: string, status = 400) {
        super(message)
        this.status = status
        this.message = message
    }
}

/**
 * Check whether a string is valid JSON string
 * @param str what we should check for being a valid JSON string
 * @returns true if str is a valid JSON string, false otherwise
 */
function isObjectJSON(str: any) {
    try {
        if (typeof str !== 'string') {
            return false;
        }

        let parsed = JSON.parse(str)

        return (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed))
    } catch (err) {
        return false
    }
}

function parseNonNegativeInteger(value: unknown, field: string): number {
    if (typeof value !== 'string') {
        throw new RequestResponseError(`${field} must be a non-negative integer`);
    }
    let parsed: unknown;
    try {
        parsed = JSON.parse(value);
    } catch {
        throw new RequestResponseError(`${field} must be a non-negative integer`);
    }
    if (typeof parsed !== 'number' || !Number.isSafeInteger(parsed) || parsed < 0) {
        throw new RequestResponseError(`${field} must be a non-negative integer`);
    }
    return parsed;
}

/**
 * Generates the object used as the HTTP response
 * @param message The human-readable message
 * @param data The data to attach to the response
 * @returns The generated response object
 */
export function getResponseObject(message: string, data: any = {}) {
    return {
        message: message,
        data: data
    }
}

/**
 * Convert URL query string into query documents
 * @param urlQuery URL query from which query documents should be generated
 * @param model the model used to choose the default collection limit
 * @param selectOnly whether we only care about select
 * @returns Query document object
 */
export function parseURLQuery(model: Model<any>, urlQuery: ParsedQs, selectOnly = false) {
    var {
        select: selectJSONStr = '{}',
        sort: sortJSONStr = '{}',
        where: whereJSONStr = '{}',
        skip: skipNumberStr = '0',
        limit: limitNumberStr = model.modelName === 'Task' ? '100' : '0',
        count: countBooleanStr = 'false',
    } = urlQuery;


    // Make sure that select, if any, should be a JSON string:
    // 1. that depicts an object
    // 2. with 0 or 1 as values (either as string or number)
    //    and should be consistent across all properties except for
    //    _id, if there is one
    if (
        typeof selectJSONStr !== 'string' ||
        !isObjectJSON(selectJSONStr) ||
        !Object.values(JSON.parse(selectJSONStr)).every(
            (val) => val === "0" || val === "1" || val === 0 || val === 1
        ) ||
        !Object.entries(JSON.parse(selectJSONStr)).filter(([key]) => key !== '_id').every((val, idx, arr) => idx === 0 || Number(val[1]) === Number(arr[idx - 1][1]))
    ) {
        throw new RequestResponseError('select must be a JSON object containing only 0 or only 1, except for _id')
    }

    let selectDocument: Record<string, 0 | 1> = Object.fromEntries(
        Object.entries(JSON.parse(selectJSONStr)).map(
            ([key, val]) => [key, Number(val) === 1 ? 1 : 0]
        )
    )

    if (selectOnly) {
        return {
            select: selectDocument
        }
    }

    // Check sort
    if (
        typeof sortJSONStr !== 'string' ||
        !isObjectJSON(sortJSONStr) ||
        !Object.values(JSON.parse(sortJSONStr)).every((val) =>
            val === '-1' || val === '1' || val === -1 || val === 1
        )
    ) {
        throw new RequestResponseError('sort (if any) should be a JSON object with -1 or 1 as values')
    }

    let sortDocument: Record<string, 1 | -1> = Object.fromEntries(
        Object.entries(JSON.parse(sortJSONStr)).map(
            ([key, val]) => [key, Number(val) === 1 ? 1 : -1]
        )
    )

    // Check where
    if (
        typeof whereJSONStr !== 'string'
        || !isObjectJSON(whereJSONStr)
    ) {
        throw new RequestResponseError('where (if any) should be a JSON object')
    }

    let whereDocument = JSON.parse(whereJSONStr)

    const skipNumber = parseNonNegativeInteger(skipNumberStr, 'skip')
    const limitNumber = parseNonNegativeInteger(limitNumberStr, 'limit')

    if (
        typeof countBooleanStr !== 'string' ||
        !["true", "false"].includes(countBooleanStr.trim())
    ) {
        throw new RequestResponseError('count (if any) should be either "true" or "false"')
    }

    let countBoolean = countBooleanStr.trim() === "true"

    return {
        select: selectDocument,
        where: whereDocument,
        sort: sortDocument,
        skip: skipNumber,
        limit: limitNumber,
        count: countBoolean
    }
}

/**
 * Get query result for /users and /tasks route
 * @param model user or task model
 * @param urlQuery URL query parameters
 * @returns A number if it is a count query or an array of documents otherwise
 */
export async function getQueryResultForGeneralQuery(model: Model<any>, urlQuery: ParsedQs) {
    try {
        const {
            select,
            sort,
            where,
            skip,
            limit,
            count
        } = parseURLQuery(model, urlQuery)

        const conditions = model.find(where);
        // Validate filter values and operators before executing any database call.
        try {
            conditions.cast(model);
        } catch {
            throw new RequestResponseError('Invalid query field or value', 400);
        }
        if (count) {
            return await model.countDocuments(conditions.getFilter());
        }

        let query = conditions
        .select(select)
        .skip(skip ?? 0)
        .limit(limit ?? 0)
        .sort(sort)
        
        return await query.lean()

    } catch (err) {
        if (err instanceof RequestResponseError) {
            throw err
        }
        if (err instanceof mongoose.Error.CastError ||
            (err instanceof mongoose.mongo.MongoServerError && typeof err.code === 'number' &&
                [2, 9, 14, 72, 168, 31253, 31254].includes(err.code))) {
            throw new RequestResponseError('Invalid query field or value', 400)
        }

        throw new RequestResponseError('An unexpected server error occurred', 500)
    }
}

export async function findDocumentById(model: Model<any>, id: string, select: Record<string, 0 | 1> = {}) {
    try {
        return await model.findById(id, select).lean()
    } catch (err) {
        if (err instanceof mongoose.Error.CastError && err.path === '_id') {
            throw new RequestResponseError(`Invalid id: ${id}`, 404)
        }

        throw new RequestResponseError('An unexpected server error occurred', 500)
    }

}
