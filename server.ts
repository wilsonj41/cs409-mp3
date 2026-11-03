import express from 'express';
import mongoose from 'mongoose';
import routes from './routes';
import dotenv from 'dotenv';
import { Request, Response, NextFunction } from 'express';
import { getResponseObject, RequestResponseError } from './util';
import User from './models/user';
import Task from './models/task';

var router = express.Router();
// Read .env file
dotenv.config();

// Create our Express application
var app = express();

// Use environment defined port or 3000
var port = process.env.PORT || 3000;

// Connect to MongoDB using the connection string in .env
var databaseConnection = mongoose.connect(process.env.MONGODB_URI!);

// Allow CORS so that backend and frontend could be put on different servers
app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "X-Requested-With, X-HTTP-Method-Override, Content-Type, Accept");
    res.header("Access-Control-Allow-Methods", "POST, GET, PUT, DELETE, OPTIONS");
    if (req.method === 'OPTIONS') {
        res.status(204).end();
        return;
    }
    next();
});

// Parse URL-encoded and JSON request bodies
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Require a body when creating a resource. PUT validates its URL id first in the route.
app.use((req, resp, next) => {
    if (req.body === undefined && req.method === 'POST') {
        resp.status(400).json(getResponseObject('Please make sure request body is JSON'))
        return
    }

    next()
})

// Use routes as a module (see index.js)
routes(app, router);

// Return the required response format for unknown resources.
app.use((req, resp) => {
    resp.status(404).json(getResponseObject('Resource not found'));
});

// Handle malformed request bodies and errors forwarded by the routes.
app.use((err: unknown, req: Request, resp: Response, next: NextFunction) => {
    if (
        err
        && typeof err === 'object'
        && 'type' in err
        && err.type === 'entity.parse.failed'
    ) {
        resp.status(400).json(getResponseObject('Request body should be JSON'))
        return
    }

    if (err instanceof RequestResponseError) {
        resp.status(err.status).json(getResponseObject(err.message));
    } else if (err && typeof err === 'object' && 'type' in err && err.type === 'entity.too.large') {
        resp.status(413).json(getResponseObject('Request body is too large'));
    } else if (err && typeof err === 'object' && 'type' in err &&
        (err.type === 'charset.unsupported' || err.type === 'encoding.unsupported')) {
        resp.status(415).json(getResponseObject('Unsupported request body encoding'));
    } else if (err && typeof err === 'object' && 'type' in err &&
        (err.type === 'request.aborted' || err.type === 'request.size.invalid')) {
        resp.status(400).json(getResponseObject('Request body is incomplete'));
    } else if (err instanceof mongoose.mongo.MongoServerError && err.code === 11000) {
        resp.status(400).json(getResponseObject('Email is already used by another user'));
    } else if (err instanceof mongoose.Error.ValidationError || err instanceof mongoose.Error.CastError) {
        resp.status(400).json(getResponseObject('Invalid field type or value'));
    } else {
        resp.status(500).json(getResponseObject('An unexpected server error occurred'));
    }
});

// Start the server after connecting and ensuring the unique email index exists.
databaseConnection.then(async () => {
    await Promise.all([User.init(), Task.init()]);
    app.listen(port);
    console.log('Server running on port ' + port);
}).catch(async () => {
    console.error('Unable to start server. Check database configuration and connectivity.');
    await mongoose.disconnect();
    process.exitCode = 1;
});
