/*
** Tagscii
*/
"use strict"

var S = { // SETTINGS
  PORT: 3000,
  W: 64,
  H: 64,
	
	//GAMEPLAY DEFINES
	hideJaugeThreshold: 4.5,
	hideJaugeMaxValue:	5.0,
	hideJaugeStep:			0.1
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

function setCat(id) {
  cat = clients[id];
  cat.last.cat = true;
  cat.timer = 5.0;
	delete cat.last.hJ;
  console.log("set CAT:"+id);
}

function addCat() {
  if (cat && cat.last) {
    delete cat.last.cat;
		cat.last.hJ = 0;
  }
  var lst = [];
  for(var e in clients) {
    lst.push(e);
  }
  var id = lst[Math.floor(Math.random()*lst.length)];

  if (clients[id] && clients[id].last) {
    setCat(id);
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
  var speed = 1;
  if (client.last.cat === true) {
		if (client.timer >= 1) {
      client.timer -= 0.1;
		}
    if (client.timer >= 1) {
      speed = 0;
      client.last.t = Math.round(client.timer).toString();
    } else {
      if (client.timer !== undefined) {
        client.last.t = 'C';
        delete client.timer;
        client.stimer = 0.0;
      }
    
      if (client.last.u === 0 && client.last.v === 0) {
        client.stimer = 0.0;
      } else {
        client.stimer += 0.1;
      }
      
      if (client.stimer > 0.5) {
        speed = 2;
      } else {
        speed = 1;
      }
    }
  }
  
  client.last.x += client.last.u*speed;
  client.last.y += client.last.v*speed;


  if (client.last.x < 0) {
    client.last.x = 0;
  }
  else if (client.last.x >= S.W) {
    client.last.x = S.W - 1;
  }

  if (client.last.y < 0) {
    client.last.y = 0;
  }
  else if (client.last.y >= S.H) {
    client.last.y = S.H - 1;
  }
}

function checkCatCollision(client) {
	if (cat !== undefined && cat !== client && (cat.timer === undefined || cat.timer < 1 )) {
		var X = cat.last.x - client.last.x;
		var Y = cat.last.y - client.last.y;
		if (Math.abs(X) <= 1 && Math.abs(Y) <= 1) {
			delete cat.last.cat;
			cat.last.hJ = 0;
			console.log("cat changed! ", cat.id, "->", client.id);
			setCat(client.id);
		}
	}
}
function updateHideJauge(client) {
	if (client !== cat) {
		
		if (client.last.t == map[client.last.y][client.last.x])
			client.last.hJ += S.hideJaugeStep;
		else
			client.last.hJ -= S.hideJaugeStep;
			
		if (client.last.hJ < 0)
			client.last.hJ = 0;
		else if (client.last.hJ > S.hideJaugeMaxValue)
			client.last.hJ = S.hideJaugeMaxValue;
	}
}

setInterval(function() {
  var j = { type : "all",
            lst : [] };
  for(var c in clients) {
    if (clients[c].last !== undefined && clients[c].last.x !== undefined && clients[c].last.y !== undefined) {
			moveClient(clients[c]);
			checkCatCollision(clients[c]);
			updateHideJauge(clients[c]);
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
    you: id,
		hJT: S.hideJaugeThreshold,
		hJM: S.hideJaugeMaxValue
		
  };

  client.last = {
    id: id,
    t: 'P',
    x: Math.floor(Math.random()*S.W),
    y: Math.floor(Math.random()*S.H),
		u: 0,
		v: 0,
		hJ: 0
  };
  console.log(client.last);

  clients[id] = client;
  client.send(JSON.stringify(j));

  client.on('message', function(data) {
    var j = JSON.parse(data);
    client.last.u = j.u;
    client.last.v = j.v;

    if (client.last.cat === true && client.last.t !== j.t) {
      client.stimer = 0.0;
    }

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
