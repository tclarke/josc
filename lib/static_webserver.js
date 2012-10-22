var http = require('http');
var fs = require('fs');
var path = require('path');

/**
 * Incredibly simple HTTP server for the web static content unsed in the examples.
 */
http.createServer(function(request, response) {
    var filePath = null;
    if (request.url.indexOf("lib/") != -1) {
        filePath = ".." + request.url;
    } else if (request.url == '/') {
        filePath = "../browser/index.html";
    } else {
        filePath = '../browser' + request.url;
    }
    var extname = path.extname(filePath);
    var contentType = 'text/html';
    switch(extname) {
        case '.js':
            contentType = 'text/javascript';
            break;
        case '.css':
            contentType = 'text/css';
            break;
    }
    fs.exists(filePath, function(exists) {
        if (exists) {
            fs.readFile(filePath, function(error, content) {
                if (error) {
                    console.log("Request: " + request.url + " -- 500");
                    response.writeHead(500);
                    response.end("An internal server error has occured: " + error, 'utf-8');
                } else {
                    console.log("Request: " + request.url);
                    response.writeHead(200, {'Content-Type': contentType});
                    response.end(content, 'utf-8');
                }
            });
        } else {
            console.log("Request: " + request.url + " -- 404 [" + filePath + "]");
            response.writeHead(404);
            response.end("The server could not locate the requested file.", 'utf-8');
        }
    });
}).listen(8100);

console.log("Server running on http://127.0.0.1:8100/");
