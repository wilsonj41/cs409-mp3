import { Router } from "express";
import UserModel from '../models/user'
import { 
    findDocumentById,
    getQueryResultForGeneralQuery, 
    getResponseObject, 
    JSONObject, 
    parseURLQuery, 
    RequestResponseError
} from "../util";

import {
    isEmail
} from 'validator'

function validateEmail(email: string) {
    if (email.length <= 0) {
        return false
    }

    return isEmail(
        email,
        {
            allow_underscores: true,
            allow_utf8_local_part: false,
            allow_ip_domain: true
        }
    )
}

export default function (router: Router) {

    router.get('/', async function (req, resp) {
        // Return all users satisfying condition
        try {
            let responseData =
            await getQueryResultForGeneralQuery(UserModel, req.params)

            resp.status(200).json(getResponseObject('OK', responseData))
        } catch (err) {
            if (err instanceof RequestResponseError) {
                resp.status(err.status).json(getResponseObject(err.message))
                return
            }

            resp.status(500).json(getResponseObject('Unknown error occured'))
            return
        }
    })

    router.post('/', async function (req, resp) {
        let newUser: JSONObject = req.body

        if (
            typeof newUser.name !== 'string' || newUser.name.trim().length === 0
            || typeof newUser.email !== 'string' || !validateEmail(newUser.email.trim())
            || 
        ) {
            resp.status(400).json(getResponseObject('Missing name and/or valid email for user'))
            return
        }

        newUser.name = newUser.name.trim();
        newUser.email = newUser.email.trim();

        if ((await UserModel.find({ 'email': newUser.email }).countDocuments()) > 0) {
            resp.status(400).json(getResponseObject(`email ${newUser.email} has already been used`))
            return
        }

        try {
            let createdDoc = (await UserModel.create(newUser)).toJSON();

            resp.status(201).json(getResponseObject('OK', createdDoc))
            return
        } catch (err) {
            resp.status(500).json(getResponseObject('Unknown error occured'))
            return
        }
    })

    router.get('/:id', async function (req, resp) {
        let id = req.params.id

        try {
            let { select } = parseURLQuery(UserModel, req.query, true)

            let resultDocument = await findDocumentById(UserModel, id, select)

            resp.status(resultDocument === null ? 404 : 200).json(getResponseObject(resultDocument !== null ? 'OK' : 'Document not found', resultDocument ?? {}))
            return
        } catch (err) {
            if (err instanceof RequestResponseError) {
                resp.status(err.status).json(getResponseObject(err.message))
                return
            }

            resp.status(500).json(getResponseObject('Unknown error occured'))
            return
        }
    })

    router.put('/:id', async function (req, resp) {
        if ((await findDocumentById(UserModel, req.params.id)) === null) {
            resp.status(404).json(getResponseObject('Document not found'))
            return
        }

        let newUserData: JSONObject = req.body

        if (
            typeof newUserData.name !== 'string' || newUserData.name.trim().length === 0
            || typeof newUserData.email !== 'string' || !validateEmail(newUserData.email.trim())
        ) {

        }
    })
    
    return router
}