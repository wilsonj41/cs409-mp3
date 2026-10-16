import { Express, Router } from "express";
import home = require('./home')
/*
 * Connect all of your endpoints together here.
 */
export = function (app: Express, router: Router) {
    app.use('/api', home(router));
};
