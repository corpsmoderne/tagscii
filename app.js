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

var tiles = "....----===+*%$#";
function genMap() {
  var map = [];

  for(var i=0; i < S.H; i++) {
    var line = [];
    for(var j=0; j < S.W; j++) {
      var tile = tiles[Math.floor((Math.random()*Math.random())*tiles.length)];      
      line.push(tile);
    }
    map.push(line);
  }
  return map;
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
var players = 0;

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

  client.send(JSON.stringify(j));

  client.on('message', function(data) {
    var j = JSON.parse(data);
    j.id = id;
    j.type = "p";
    if (cat && cat.id == id) {
      j.cat = true;
    }
    for(var c in clients) {
      if (clients[c].id !== j.id) {
        clients[c].send(JSON.stringify(j));
      }
    }

//    console.log(id+" < "+data);
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
