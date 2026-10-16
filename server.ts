import express = require('express');
import mongoose = require('mongoose');
import routes = require('./routes');
import dotenv = require('dotenv');

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

// Parse URL-encoded and JSON request bodies
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Use routes as a module (see index.js)
routes(app, router);

// Start the server
app.listen(port);
console.log('Server running on port ' + port);
