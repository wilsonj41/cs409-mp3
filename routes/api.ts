import { Router } from "express";
import users from './users';
import tasks from './tasks';

export default function (router: Router) {
    router.use('/users', users(Router()))
    router.use('/tasks', tasks(Router()))

    return router;
}
