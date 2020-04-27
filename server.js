// Simple Node.js server that I use to test my projects.
// To run, you need to have node and the express package installed
// http://nodejs.org/
// http://expressjs.com/

// Then simply run "node server" from the command line in this directory
// at that point you can view the demo by visiting http://localhost:9000/index.html

var express = require('express');
var serveStatic = require('serve-static');
var serveIndex = require('serve-index');

var app = express();
app.use(serveStatic(__dirname));
app.use(serveIndex(__dirname));
app.listen(9000);

console.log('Server is now listening on port 9000');
