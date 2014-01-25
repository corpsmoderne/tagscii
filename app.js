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
levels.push("LVL_2.js");

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
var lastCat = undefined;

function addCat() {
  if (cat && cat.last) {
    delete cat.last.cat;
  }
  var lst = [];
  for(var e in clients) {
    lst.push(e);
  }
  var id = lst[Math.floor(Math.random()*lst.length)];

  if (clients[id] && clients[id].last) {
    cat = clients[id];
    cat.last.cat = true;
    console.log("ADD CAT:"+id);
  }
}

app.configure(function() {
    //app.use(cookieParser);
    //app.use(express.bodyParser());
    //app.use(express.session());
    app.use(app.router);
});

app.use("/pub", express.static(__dirname + '/public'));

app.get("/", function(req, res) {
  res.sendfile('./public/index.html');
});

var server = http.createServer(app);
server.listen(S.PORT);

var uids = 0;
var clients = {};
var players = 0;

function moveClient(client) {
	client.last.x += client.last.u;
	client.last.y += client.last.v;
	if (client.last.x < 0)
		client.last.x = 0;
	else if (client.last.x >= S.W)
		client.last.x = S.W - 1;
		
	if (client.last.y < 0)
		client.last.y = 0;
	else if (client.last.y >= S.H)
		client.last.y = S.H - 1;
}

setInterval(function() {
  
  


  var j = { type : "all",
            lst : [] };
  for(var c in clients) {
    if (clients[c].last && clients[c].last.x && clients[c].last.y) {
			moveClient(clients[c]);
      if (cat && cat != clients[c] && clients[c] !== lastCat) {
        var X = cat.last.x - clients[c].last.x;
        var Y = cat.last.y - clients[c].last.y;
        if (Math.abs(X) <= 1 && Math.abs(Y) <= 1) {
          delete cat.last.cat;
          lastCat = cat;
          cat = clients[c];
          cat.last.cat = true;
          console.log("cat changed! ", lastCat.id, "->", cat.id);
          setTimeout(function() {
            lastCat = undefined;
          }, 2000);
        }
      }
      j.lst.push(clients[c].last);
    }
  }
  broadcast(j);
}, 100);

var wss = new ws.Server({server: server});
wss.on('connection', function(client) {
  var id = uids;
  uids++;
  console.log("client "+id+" connected");
  client.id = id;

  players++;
  if (cat === undefined) {
    addCat();
  }

  var j = {
    type: "map",
    map: map,
    w: S.W,
    h: S.H,
    you: id
  };

  client.last = {
    id: id,
    t: 'P',
    x: Math.floor(Math.random()*S.W),
    y: Math.floor(Math.random()*S.H),
	u: 0,
	v: 0
  };
  console.log(client.last);

  clients[id] = client;
  client.send(JSON.stringify(j));

  client.on('message', function(data) {
    var j = JSON.parse(data);
    client.last.u = j.u;
    client.last.v = j.v;
    client.last.t = j.t;
  });
  
  client.on('close', function() {
    console.log('client '+id+' disconnected');
    if (cat && cat.id == id) {
      cat = undefined;
    }

    var x = clients[id].last.x;
    var y = clients[id].last.y;

    delete clients[id];
    players--;

    broadcast({ type:"r", x:x, y:y });

    if (cat === undefined) {
      addCat();
    }
  });
});


console.log("Listening on port "+S.PORT);
