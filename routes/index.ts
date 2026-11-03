import { Express, Router } from "express";
import api from './api';

/*
 * Connect all of your endpoints together here.
 */
export default function (app: Express, router: Router) {
    app.use('/api', api(router));
};
