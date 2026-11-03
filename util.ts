import { Model } from "mongoose"
import { ParsedQs } from "qs"

type JSONValue =
    | string
    | number
    | boolean
    | null
    | JSONValue[]
    | JSONObject;

export interface JSONObject {
    [key: string]: JSONValue;
}

export class RequestResponseError {
    status: number;
    message: string;

    constructor(message: string, status = 400) {
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
 * @param model the model whose schema is used to filter unnecessary properties
 * @param selectOnly whether we only care about select
 * @returns Query document object
 */
export function parseURLQuery(model: Model<any>, urlQuery: ParsedQs, selectOnly = false) {
    var {
        select: selectJSONStr = '{}',
        sort: sortJSONStr = '{}',
        where: whereJSONStr = '{}',
        skip: skipNumberStr = '0',
        limit: limitNumberStr = '0',
        count: countBooleanStr = 'false',
    } = urlQuery;


    // Make sure that select, if any, should be a JSON string:
    // 1. that depicts an object
    // 2. with all property names existing in the schema
    // 3. with 0 or 1 as values (either as string or number)
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
        throw new RequestResponseError('select (if any) should be a JSON document with values being execlusively 0 or 1, no mixes (except for \'_id\')')
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

    // Check skip
    if (
        typeof skipNumberStr !== 'string' ||
        skipNumberStr.trim().length === 0 ||
        !Array.from(skipNumberStr).every((char) => char >= '0' && char <= '9') ||
        !Number.isSafeInteger(Number(skipNumberStr)) ||
        Number(skipNumberStr) < 0
    ) {
        throw new RequestResponseError('skip (if any) should be a non-nagative integer')
    }

    let skipNumber = Number(skipNumberStr)

    // Check limit
    if (
        typeof limitNumberStr !== 'string' ||
        limitNumberStr.trim().length === 0 ||
        !Array.from(limitNumberStr).every((char) => char >= '0' && char <= '9') ||
        !Number.isSafeInteger(Number(limitNumberStr)) ||
        Number(limitNumberStr) < 0
    ) {
        throw new RequestResponseError('limit (if any) should be a non-nagative integer')
    }

    let limitNumber = Number(limitNumberStr)

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

        let queryResult: number | Object[];

        let query = model
        .find()
        .select(select)
        .where(where)
        .skip(skip ?? 0)
        .limit(limit ?? 0)
        .sort(sort)
        
        if (count) {
            queryResult = await query.countDocuments();
        } else {
            queryResult = await query.lean();
        }

        return queryResult

    } catch (err) {
        if (err instanceof RequestResponseError || err instanceof Error) {
            throw new RequestResponseError(err.message, 400)
        }

        throw new RequestResponseError('Unknown error occured', 500)
    }
}

export async function findDocumentById(model: Model<any>, id: string, select: Record<string, 0 | 1> = {}) {
    try {
        return await model
        .where({ '_id': id })
        .select(select)
        .findOne()
        .lean()
    } catch (err) {
        throw new RequestResponseError('Unknown error occured', 500)
    }

}
