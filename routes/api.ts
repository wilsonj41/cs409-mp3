import { Router } from "express";
import users from './users';

export default function (router: Router) {
    router.use('/users', users(router))

    return router;
}
