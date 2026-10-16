import { Router, Request, Response } from "express";

export = function (router: Router) {

    var homeRoute = router.route('/');

    homeRoute.get(function (req: Request, res: Response) {
        res.send('Home')
    });

    return router;
}
