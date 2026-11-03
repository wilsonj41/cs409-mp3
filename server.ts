import express from 'express';
import mongoose, { model } from 'mongoose';
import routes from './routes';
import dotenv from 'dotenv';
import { Request, Response, NextFunction } from 'express';
import { getResponseObject } from './util';

var router = express.Router();
// Read .env file
dotenv.config();

// Create our Express application
var app = express();

// Use environment defined port or 3000
var port = process.env.PORT || 3000;

// Connect to a MongoDB --> Uncomment this once you have a connection string!!
mongoose.connect(process.env.MONGODB_URI!).catch(function (err) { console.error('MongoDB connection error:', err.message); });

// Allow CORS so that backend and frontend could be put on different servers
app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "X-Requested-With, X-HTTP-Method-Override, Content-Type, Accept");
    res.header("Access-Control-Allow-Methods", "POST, GET, PUT, DELETE, OPTIONS");
    next();
});

// Handle when the request is not application/json at all
app.use((req, resp, next) => {
    if (req.body === undefined && req.method !== 'GET') {
        resp.status(400).json(getResponseObject('Please make sure request body is JSON'))
        return
    }

    next()
})

// Handle when the request body is application/json type with invalid JSON
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

    // This should not be reached
    resp.status(400).json('Unknown error occured when processing request')
    return
})

// Parse URL-encoded and JSON request bodies
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Use routes as a module (see index.js)
routes(app, router);

// Start the server
app.listen(port);
console.log('Server running on port ' + port);
