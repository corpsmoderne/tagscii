/*
** Tagscii
*/

var S = { // SETTINGS
  PORT: 3000
};

var express = require('express');
var http = require('http');
var ws = require('ws');
var app = express();

app.configure(function() {
    //app.use(cookieParser);
    //app.use(express.bodyParser());
    //app.use(express.session());
    app.use(app.router);
});


app.use("/pub", express.static(__dirname + '/public'));

var server = http.createServer(app);
server.listen(S.PORT);
console.log("Listening on port "+S.PORT);
