/*
** Tagscii
*/
"use strict"

var S = { // SETTINGS
  PORT: 3000,
  W: 64,
  H: 64
};

var express = require('express');
var http = require('http');
var ws = require('ws');
var app = express();

var levels = [];
levels.push("LVL_1.js");

function genMap() {
  var map = require("./" + levels[Math.floor((Math.random()*Math.random())*levels.length)]).level;
  return map;
}

var map = genMap();


app.configure(function() {
    //app.use(cookieParser);
    //app.use(express.bodyParser());
    //app.use(express.session());
    app.use(app.router);
});

app.use("/pub", express.static(__dirname + '/public'));

var server = http.createServer(app);
server.listen(S.PORT);

var uids = 0;
var clients = {
};

var wss = new ws.Server({server: server});
wss.on('connection', function(client) {
  var id = uids;
  uids++;
  console.log("client "+id+" connected");
  client.id = id;
  clients[id] = client;
  
  client.send(JSON.stringify({ 
    type: "map",
    map: map,
    w: S.W,
    h: S.H
  }));

  client.on('message', function(data) {
    var j = JSON.parse(data);
    j.id = id;
    j.type = "p";
    for(var c in clients) {
      if (clients[c].id !== j.id) {
        clients[c].send(JSON.stringify(j));
      }
    }

    console.log(id+" < "+data);
  });
  
  client.on('close', function() {
    console.log('client '+id+' disconnected');
    delete clients[id];
  });
});


console.log("Listening on port "+S.PORT);
