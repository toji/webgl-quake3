// Simple Node.js server that I use to test my projects.
// To run, you need to have node and the express package installed
// http://nodejs.org/
// http://expressjs.com/

// Then simply run "node server" from the command line in this directory
// at that point you can view the demo by visiting http://localhost:900/index.html

var express = require('express');

var app = express.createServer();
app.use(express.static(__dirname));
app.use(express.directory(__dirname));
app.listen(9000);

console.log('Server is now listening on port 9000');
