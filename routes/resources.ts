import { Router } from 'express';
import { Model } from 'mongoose';
import { findDocumentById, getQueryResultForGeneralQuery, getResponseObject, parseURLQuery,
    RequestResponseError } from '../util';

export default function resourceRoutes(router: Router, model: Model<any>,
    save: (body: unknown, id?: string) => Promise<any>, remove: (id: string) => Promise<any>) {
    router.get('/', async (req, res) => {
        res.status(200).json(getResponseObject('OK', await getQueryResultForGeneralQuery(model, req.query)));
    });
    router.get('/:id', async (req, res) => {
        const { select } = parseURLQuery(model, req.query, true);
        const resource = await findDocumentById(model, req.params.id, select);
        if (!resource) throw new RequestResponseError('Resource not found', 404);
        res.status(200).json(getResponseObject('OK', resource));
    });
    router.post('/', async (req, res) => {
        res.status(201).json(getResponseObject('Created', await save(req.body)));
    });
    router.put('/:id', async (req, res) => {
        res.status(200).json(getResponseObject('OK', await save(req.body, req.params.id)));
    });
    router.delete('/:id', async (req, res) => {
        res.status(204).end()
    });
    return router;
}
