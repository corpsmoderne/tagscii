/*
** Tagscii
*/
"use strict"

var S = { // SETTINGS
  PORT: 3000,
  W: 64,
  H: 64,
};

var express = require('express');
var http = require('http');
var ws = require('ws');
var app = express();

var levels = [];
levels.push("LVL_1.js");

function genMap() {
  var map = require("./" + levels[Math.floor(Math.random()*levels.length)]).level;
  S.W = map[0].length;
  S.H = map.length;
  return map;
}
var map = genMap();


function broadcast(j, not) {
  for(var c in clients) {
    if (clients[c].id !== not) {
      clients[c].send(JSON.stringify(j));
    }
  }
}

var cat = undefined;
function addCat() {

  var lst = [];
  for(var e in clients) {
    lst.push(e);
  }
  var id = lst[Math.floor(Math.random()*lst.length)];

  cat = clients[id];
  console.log("ADD CAT:"+id);
  broadcast({ type:"cat", id:id }, null);
}

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
var players = 0;

setInterval(function() {
  addCat();
}, 10000);

var wss = new ws.Server({server: server});
wss.on('connection', function(client) {
  var id = uids;
  uids++;
  console.log("client "+id+" connected");
  client.id = id;
  clients[id] = client;

  players++;
  if (cat === undefined) {
    addCat();
  }

  var j = {
    type: "map",
    map: map,
    w: S.W,
    h: S.H,
  };

  for(var c in clients) {
    if (clients[c].last !== undefined) {
      client.send(JSON.stringify(clients[c].last));
    }
  }

  client.send(JSON.stringify(j));

  client.on('message', function(data) {
    var j = JSON.parse(data);
    j.id = id;
    j.type = "p";

    client.last = j;

    broadcast(j, j.id);

  });
  
  client.on('close', function() {
    console.log('client '+id+' disconnected');
    if (cat && cat.id == id) {
      cat = undefined;
    }
    delete clients[id];
    players--;
    if (cat === undefined) {
      addCat();
    }
  });
});


console.log("Listening on port "+S.PORT);
