/*
** Tagscii
*/
"use strict"

var S = { // SETTINGS
  PORT: 3000,
  W: 64,
  H: 64,
  
  //GAMEPLAY DEFINES
  hideJaugeThreshold: 4.0,
  hideJaugeMaxValue: 5.0,
  hideJaugeStep: 0.1,
  scoreMax: 60,
  gameOverTimer: 5000, //ms
  maxStillTime: 0.5
  
};

if (process.argv.length === 3) {
  S.PORT = parseInt(process.argv[2])
}

var express = require('express');
var http = require('http');
var ws = require('ws');
var app = express();

var levels = [
  "LVL_Level_11_A.js",
  "LVL_Level_12_B.js",
  "LVL_Level_13_C.js",
  "LVL_Level_14_D.js",
  "LVL_Level_15_E.js",
  "LVL_Level_15_F.js",
  "LVL_Level_16_F.js",
  "LVL_Level_17_G.js"
];

var won = false;

var worstScore = 0;

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
  delete cat.stillTimer;
  console.log("set CAT:"+id);
}

function addCat() {
  if (cat && cat.last) {
    delete cat.last.cat;
    cat.last.hJ = 0;
  }
  var lst = [];
  for(var e in clients) {
    if (clients[e].last !== undefined) {
      lst.push(e);
    }
  }
  var id = lst[Math.floor(Math.random()*lst.length)];

  if (clients[id] && clients[id].last) {
    addToLog(clients[id].name + " is \"it\"!");
    setCat(id);
  }
}

function addToLog(line) {
	
  var message = { type: "log",
		  content: line};
  console.log(message);
  broadcast(message);
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
      
      client.score += 0.1;
      
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
      addToLog(cat.name + " tagged " + client.name + "!");
      setCat(client.id);
    }
  }
}

function updateHideJauge(client) {
  if (client !== cat) {
    if (client.visible === undefined)
      client.visible = false;
    var addToJauge = false;
    if (client.last.u === 0.0 && client.last.v === 0.0) {
      if (client.stillTimer === undefined) {
	client.stillTimer = 0;
      }
      if (client.stillTimer < S.maxStillTime) {
	client.stillTimer += 0.1;
      }
      else {
	addToJauge = true;
      }
    }
    else {
      delete client.stillTimer;
    }
    addToJauge = addToJauge || client.last.t == map[client.last.y][client.last.x];
    if (addToJauge) {
      client.last.hJ += S.hideJaugeStep;
    }
    else {
      client.last.hJ -= S.hideJaugeStep;
    }
    
    if (client.last.hJ < 0) {
      client.last.hJ = 0;
    }
    else if (client.last.hJ >= S.hideJaugeMaxValue) {
      if (client.visible === false) {
	client.visible = true;
	addToLog(client.name + " has become visible!");
      }
      client.last.hJ = S.hideJaugeMaxValue;
    }
    else if (client.last.hJ < S.hideJaugeThreshold && client.visible === true) {
      client.visible = false;
    }
  }
}

function newGame() {
  map = genMap();
  won = false;
  cat = undefined;

  for(var c in clients) {
    var client = clients[c];
    if (client.last !== undefined) {
      client.score = 0;
      client.last.t = 'P';
      client.last.x = Math.floor(Math.random()*S.W);
      client.last.y = Math.floor(Math.random()*S.H);
      client.last.u = 0;
      client.last.v = 0;
      client.last.hJ = 0;
      delete client.last.cat;
    }
  }
  
  var jMap = {
    type: "end",
    map: map,
    w: S.W,
    h: S.H,
  };
  broadcast(jMap);
  
  var j = { type : "all",
            lst : [] };
  for(var c in clients) {
    if (clients[c].last !== undefined && clients[c].last.x !== undefined && clients[c].last.y !== undefined) {
      j.lst.push(clients[c].last);
    }
  }
  broadcast(j);
  
  var jScores = { type: "scores",
                  lst : [] };
  for (var c in clients) {
    jScores.lst.push({ name: clients[c].name, score: 0, cat:false });
  }
  
  broadcast(jScores);
}

setInterval(function() {
  if (cat === undefined && players > 1) {
    addCat();
  }

  for(var c in clients) {
    worstScore = Math.max(clients[c].score, worstScore);
  }

  var j = { type: "scores",
            lst : [] };
  for (var c in clients) {
    if(clients[c].last) {
      var cat_ = false;
      if (clients[c].last.cat === true) {
        cat_ = true;
      }
      j.lst.push({ name: clients[c].name, score: Math.round(clients[c].score), cat:cat_ });
    }
  }
  j.lst.sort(function(a, b) {
    return a.score - b.score;
  });
  
  broadcast(j);
  
  if (j.lst.length > 0 && j.lst[j.lst.length - 1].score !== undefined && j.lst[j.lst.length - 1].score >= S.scoreMax && won === false)
  {
    var j2 = { type:"won",
	       name: j.lst[0].name};
    won = true;
    broadcast(j2);
    setTimeout(function() {
      newGame();
    }, S.gameOverTimer);
  }
}, 1000);

setInterval(function() {
  if (won === false) {
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
  }
}, 100);

var wss = new ws.Server({server: server});
wss.on('connection', function(client) {
  var id = uids;
  uids++;
  console.log("client "+id+" connected");
  
  client.id = id;

  client.score = 0;
  
  var j = {
    type: "map",
    map: map,
    w: S.W,
    h: S.H,
    you: id,
    hJT: S.hideJaugeThreshold,
    hJM: S.hideJaugeMaxValue
  };
  
  clients[id] = client;
  client.send(JSON.stringify(j));
  
  client.on('message', function(data) {
    var j = JSON.parse(data);
    
    if (j.t === "name") {
      client.name = j.n;
    } else if (j.t === "join") {

      players++;

      client.score = worstScore;
      
      client.last = {
        id: id,
        t: 'P',
        x: Math.floor(Math.random()*S.W),
        y: Math.floor(Math.random()*S.H),
        u: 0,
        v: 0,
        hJ: 0
      };
      
    } else {
      if (client.last) {
        client.last.u = j.u;
        client.last.v = j.v;
      
        if (client.last.cat === true && client.last.t !== j.t) {
          client.stimer = 0.0;
        }
      
        client.last.t = j.t;
      }
    }
  });
  
  client.on('close', function() {
    console.log('client '+id+' disconnected');
    if (cat && cat.id == id) {
      cat = undefined;
    }

    var x = undefined;
    var y = undefined;

    if (clients[id].last) {
      x = clients[id].last.x;
      y = clients[id].last.y;
      players--;
    }

    delete clients[id];


    if (x !== undefined && y !== undefined) {
      broadcast({ type:"r", x:x, y:y });
    }
    
    if (cat === undefined && players > 1) {
      addCat();
    }
    
    if (players <= 1) {
      setTimeout(function() {
        newGame();
      }, 2000);
    }

  });
});


console.log("Listening on port "+S.PORT);
