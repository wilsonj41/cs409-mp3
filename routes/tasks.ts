import { Router } from 'express';
import Task from '../models/task';
import { deleteTask, saveTask } from '../services/resources';
import resourceRoutes from './resources';

export default function (router: Router) {
    return resourceRoutes(router, Task, saveTask, deleteTask);
}
