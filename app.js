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
  scoreMax: 60,
  gameOverTimer: 5000, //ms
  maxStillTime: 0.5,
  catRunThreshold: 0.5,
  minPlayerNb: 5,
  tickValue: 0.1
  
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
  "LVL_Level_16_F.js",
  "LVL_Level_17_G.js",
  "LVL_Vide.js",
  "LVL_ClasseAm"
  
];

// AI SETTINGS

var MOUSE_VISIBLE_DISTANCE = 25;
var MOUSE_HIDDEN_DISTANCE = 5;
var MOUSE_STAY_HIDDEN_PROB = 0.4;
var MOUSE_STOP_FLEEING_DIST_MALUS = 2;
var CAT_CHANGE_TARGET_MAX_TIME = 5;
var CAT_REFRESH_TARGET_MAX_TIME = 0.2;


var mouseAIState = {
  MAI_HIDING: 0,
  MAI_MOVING: 1,
  MAI_FLEEING: 2
};

var catAIState = {
  CAI_IDLE: 0,
  CAI_CHASING: 1,
  CAI_SEARCHING: 2
};


var won = false;

var worstScore = S.scoreMax;

function genMap() {
  var newMap = [];
  var map = require("./" + levels[Math.floor(Math.random()*levels.length)]).level;
  map.forEach(function(line) {
    var newLine = [];
    line.forEach(function(tile) {
      newLine.push(tile);
    });
    newMap.push(newLine);
  });
  S.W = newMap[0].length;
  S.H = newMap.length;
  return newMap;
}
var map = genMap();

function broadcast(j, not) {
  for(var c in clients) {
    if (clients[c].id !== not) {
      try {
        clients[c].send(JSON.stringify(j));
      } catch (e) {
        console.log("BROADCAST EXCEPTION", e);
      }
    }
  }
}

var cat = undefined;

function setCat(id) {
  // transform old cat into mouse IFP
  if (cat && cat.last) {
    delete cat.last.cat;
    cat.last.hJ = 0;
    if (cat.bot === true) {
      initMouseBot(cat);
    }
  }
  
  // transform old mouse into cat
  cat = clients[id];
  cat.last.cat = true;
  cat.timer = 5.0;
  delete cat.last.hJ;
  delete cat.stillTimer;
  if (cat.bot === true) {
    initCatBot(cat);
  }
}

function addCat() {

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
  res.sendfile('./public/intro.html');
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
      client.timer -= S.tickValue;
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
      
      client.score -= S.tickValue;
      
      if (client.last.u === 0 && client.last.v === 0) {
        client.stimer = 0.0;
      } else {
        client.stimer += S.tickValue;
      }
      
      if (client.stimer > S.catRunThreshold) {
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
      addToLog(cat.name + " tags " + client.name + "!");
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
        client.stillTimer += S.tickValue;
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
      client.last.hJ += S.tickValue;
    }
    else {
      client.last.hJ -= S.tickValue;
    }
    
    if (client.last.hJ < 0) {
      client.last.hJ = 0;
    }
    else if (client.last.hJ >= S.hideJaugeMaxValue) {
      if (client.visible === false) {
        client.visible = true;
        addToLog(client.name + " is visible!");
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
  worstScore = S.scoreMax;

  for(var c in clients) {
    var client = clients[c];
    if (client.last !== undefined) {
      client.score = S.scoreMax;
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
    worstScore = Math.min(clients[c].score, worstScore);
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
    return b.score - a.score;
  });
  
  broadcast(j);
  
  if (j.lst.length > 0 && j.lst[j.lst.length - 1].score !== undefined && j.lst[j.lst.length - 1].score <= 0 && won === false)
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
        updateAI(clients[c]);
        moveClient(clients[c]);
        checkCatCollision(clients[c]);
        updateHideJauge(clients[c]);
        j.lst.push(clients[c].last);
      }
    }
    broadcast(j);
  }
}, 100);

function processClientInput(client, j) {// receiving inputs : u,v and t
  if (client.last) {
    if (client.last.u !== 0 || client.last.v !== 0) {
      client.lastUV = { u:client.last.u, v:client.last.v };
    }
  
    if (client.last.cat === true && client.last.t !== j.t && j.t !== undefined) {
      client.stimer = 0.0;
    }
  
    if ((client.last.cat === true || cat === undefined) && (j.t !== undefined)) {
      // EDIT
      if (j.t !== ' ') {
        try {
          map[client.last.y][client.last.x] = j.t;
          broadcast({type:"t", x:client.last.x, y:client.last.y, v:j.t});
        } catch(e) {
          console.log("Set tile fail", e, client.last);
        }
      }
      if (client.lastUV !== undefined) {
        client.last.x += client.lastUV.u;
        client.last.y += client.lastUV.v;
      }
    } else {
      client.last.u = j.u;
      client.last.v = j.v;
    }

    if (j.t !== undefined && j.t !== ' ') {
      client.last.t = j.t;
    }
  }
}


//////////////////////////////
//  BOT CODE SECTION
//////////////////////////////

function isVisible(client) {
  var onSameTile = map[client.last.y][client.last.x] == client.last.t;
  var visible = client.visible === true;
  return visible || !onSameTile;
}

function getClosestVisibleClient(client) {
  var minDist = 100;
  var curDist;
  var target = undefined;

  for (var c in clients) {
    var other = clients[c];
    if (other !== client && isVisible(other)) {
      curDist = Math.max(Math.abs(client.last.x - other.last.x), Math.abs(client.last.y - other.last.y));
      if (curDist < minDist) {
        minDist = curDist;
        target = other;
      }
    }
  }
  return target;
}

function botCat_GoChasing(bot, target) {
  bot.botCatData.state = catAIState.CAI_CHASING;
  bot.botCatData.target = target;
  bot.botCatData.targetX = target.last.x;
  bot.botCatData.targetY = target.last.y;
  bot.botCatData.changeTargetTimer = 0;
  bot.botCatData.refreshTargetTimer = 0;
}

function botCat_GoSearching(bot, targetX, targetY) {
  bot.botCatData.state = catAIState.CAI_SEARCHING;
  delete bot.botCatData.target;
  bot.botCatData.targetX = targetX;
  bot.botCatData.targetY = targetY;
  bot.botCatData.changeTargetTimer = 0;
  bot.botCatData.refreshTargetTimer = 0;
  bot.botCatData.targetTile = map[targetY][targetX];
}

function botCat_GoIdle(bot) {
  var pos = randomPos();
  bot.botCatData.state = catAIState.CAI_IDLE;
  delete bot.botCatData.target;
  bot.botCatData.targetX = pos.x;
  bot.botCatData.targetY = pos.y;
  bot.botCatData.changeTargetTimer = 0;
  bot.botCatData.refreshTargetTimer = 0;
}

function botMouse_GetNewAppearance(bot) {
  // update bot appearance : for now, naively hide whenever possible
  var tile = map[bot.last.y][bot.last.x];
  if (bot.visible === true) {
    if (tile == bot.last.t) {
      return String.fromCharCode(97 + Math.floor(Math.random() * 26)); /* any letter */
    }
  } else {
    if (tile != bot.last.t) {
      var c = tile.charCodeAt(0);
      if ((c >= 97 && c<= 122) || (c >= 48 && c<= 57)){ /* is alphanumeric */
        return tile;
      }
    }
  }
  return null;
}

function updateAI(client) {
  if (client.bot !== undefined) {
    var j = {
      u: 0,
      v: 0
    };
    if (client.last.cat === true) {
      // update bot behaviour as a cat
      var bcData = client.botCatData;
      switch (bcData.state) {
        case catAIState.CAI_IDLE:
          var target = getClosestVisibleClient(client);
          if (target === undefined) {
            if (Math.abs(client.last.x - bcData.targetX) <=1 && Math.abs(client.last.y - bcData.targetY) <= 1) {
              // change target pos
              var pos = randomPos();
              bcData.targetX = pos.x;
              bcData.targetY = pos.y;
            }
            else {
              // going to target
              var targetX = bcData.targetX - client.last.x;
              var targetY = bcData.targetY - client.last.y;
              if (targetX > 0) {
                j.u = 1;
              } else if (targetX < 0){
                j.u = -1;
              }
              if (targetY > 0) {
                j.v = 1;
              } else if (targetY < 0) {
                j.v = -1;
              }
            }
          } else {
            botCat_GoChasing(client, target);
          }
          break;
        case catAIState.CAI_CHASING:
          if (bcData.target === undefined) {
            botCat_GoIdle(bot); //disconnect ?
          } else {
            var isTargetVisible = isVisible(bcData.target);
            bcData.refreshTargetTimer += S.tickValue;
            if (isTargetVisible) {
              bcData.changeTargetTimer = 0;
            } else {
              bcData.changeTargetTimer += S.tickValue;
            }
            
            if (bcData.changeTargetTimer >= CAT_CHANGE_TARGET_MAX_TIME) {
              var target = getClosestVisibleClient(client);
              if (target !== undefined && target !== bcData.target) {
                botCat_GoChasing(client, target);
              }
            }
            
            if (bcData.refreshTargetTimer >= CAT_REFRESH_TARGET_MAX_TIME) {
              // re-evaluate target
              bcData.refreshTargetTimer = 0;
              var target = getClosestVisibleClient(client);
              if (target !== undefined && target !== bcData.target) {
                //other target closer or more visible. Decide whether to change target or not
                var distToNew = Math.max(Math.abs(target.last.x - client.last.x), Math.abs(target.last.y - client.last.y));
                var distToOld = Math.max(Math.abs(client.last.x - bcData.targetX), Math.abs(client.last.y - bcData.targetY));
                if (distToNew * 3 < distToOld) { // au pif
                  botCat_GoChasing(client, target);
                }
              }
              //update target position
              if (isVisible(bcData.target)) {
                bcData.targetX = bcData.target.last.x;
                bcData.targetY = bcData.target.last.y;
                bcData.changeTargetTimer = 0;
              }
            }
            
            var targetX = bcData.targetX - client.last.x;
            var targetY = bcData.targetY - client.last.y;
            var distX = Math.abs(targetX);
            var distY = Math.abs(targetY);
            if (distX <= 1 && distY <= 1) {
              // arrived to target, switch to searching
              botCat_GoSearching(client, bcData.targetX, bcData.targetY);
            } else {
              // move to target
              if (distX > 1) {
                if (targetX > 0) {
                  j.u = 1;
                } else {
                  j.u = -1;
                }
              }
              if (distY > 1) {
                if (targetY > 0) {
                  j.v = 1;
                } else {
                  j.v = -1;
                }
              }
            }
          }
          break;
        case catAIState.CAI_SEARCHING:
          bcData.changeTargetTimer += S.tickValue;
          
          var target = getClosestVisibleClient(client);
          if (target !== undefined) {
            // target visible. Decide whether to chase or continue searching for closer target
            var distToNew = Math.max(Math.abs(target.last.x - client.last.x), Math.abs(target.last.y - client.last.y));
            if (distToNew < bcData.changeTargetTimer * 10 || bcData.changeTargetTimer >= CAT_CHANGE_TARGET_MAX_TIME) { // au pif
              botCat_GoChasing(client, target);
            }
          }
          
          var curX = client.last.x;
          var curY = client.last.y;
          var possibleUVs = [];
          var forward = false;
          for (var i = -1; i < 2 && !forward; ++i) {
            for (var k = -1; k < 2 && !forward; ++k) {
              if ((i === 0 && k === 0 ) || curX + i < 0 || curX + i >= S.W || curY + k < 0 || curY + k >= S.H) {
                continue;
              } else if (map[curY + k][curX + i] == bcData.targetTile) {
                if (i == client.lastUV.u && k == client.lastUV.v) {
                  forward = true;
                } else {
                  var vec = {
                    u: i,
                    v: k
                  };
                  possibleUVs.push(vec);
                }
              }
            }
          }

          // TODO : plan random direction changes ?
          if (forward === true) {
            j.u = client.lastUV.u;
            j.v = client.lastUV.v;
          } else if (possibleUVs.length > 0) {
            var rand = Math.floor(Math.random() * possibleUVs.length);
            j.u = possibleUVs[rand].u;
            j.v = possibleUVs[rand].v;
          }
          break;
      }
    } else {
      // update bot behaviour as a mouse
      // for now, naively run in opposite direction of the cat. If far enough, move randomly.      
      switch (client.botMouseData.state) {
        case mouseAIState.MAI_HIDING:
          // naively stay and hide
          // TODO
          if (cat === undefined || isVisible(client)) {          
            client.botMouseData.state = mouseAIState.MAI_MOVING;
            findMouseTargetPosition(client);
          } else if ( Math.abs(client.last.x - cat.last.x) < MOUSE_HIDDEN_DISTANCE &&
                      Math.abs(client.last.y - cat.last.y) < MOUSE_HIDDEN_DISTANCE) {
            client.botMouseData.state = mouseAIState.MAI_FLEEING;
          }
          break;
        case mouseAIState.MAI_MOVING:
          // check if go fleeing
          var flee = false;
          if (cat !== undefined) {
            var maxDist;
            if (isVisible(client))
              maxDist = MOUSE_VISIBLE_DISTANCE;
            else
              maxDist = MOUSE_HIDDEN_DISTANCE;
            if (Math.abs(client.last.x - cat.last.x) < maxDist && Math.abs(client.last.y - cat.last.y) < maxDist) {
              flee = true;
            }
          }
          if (flee === true) {
              client.botMouseData.state = mouseAIState.MAI_FLEEING;
          } else {
            // go towards target
            if (client.last.x == client.botMouseData.targetX && client.last.y == client.botMouseData.targetY) {
              // arrived
              if (!isVisible(client) && Math.random() < MOUSE_STAY_HIDDEN_PROB) {
                client.botMouseData.state = mouseAIState.MAI_HIDING;
              } else {
                findMouseTargetPosition(client);
              }
            }
            else {
              // going to target
              var targetX = client.botMouseData.targetX - client.last.x;
              var targetY = client.botMouseData.targetY - client.last.y;
              if (targetX > 0) {
                j.u = 1;
              } else if (targetX < 0){
                j.u = -1;
              }
              if (targetY > 0) {
                j.v = 1;
              } else if (targetY < 0) {
                j.v = -1;
              }
            }
            // update mouse appearance
            var tile = botMouse_GetNewAppearance(client);
            if (tile != null) {
              j.t = tile;
            }
          }
          break;
        case mouseAIState.MAI_FLEEING:
          if (cat === undefined) {  // disconnect ?
            client.botMouseData.state = mouseAIState.MAI_MOVING;
            findMouseTargetPosition(client);
          } else {
            var deltaCatX = client.last.x - cat.last.x;
            var deltaCatY = client.last.y - cat.last.y;
            var distCatX = Math.abs(deltaCatX);
            var distCatY = Math.abs(deltaCatY);
            if (!isVisible(client) &&
                distCatX >= MOUSE_HIDDEN_DISTANCE + MOUSE_STOP_FLEEING_DIST_MALUS &&
                distCatY >= MOUSE_HIDDEN_DISTANCE + MOUSE_STOP_FLEEING_DIST_MALUS &&
                Math.random() < MOUSE_STAY_HIDDEN_PROB) {
              client.botMouseData.state = mouseAIState.MAI_HIDING;
            }
            else if (distCatX >= MOUSE_VISIBLE_DISTANCE + MOUSE_STOP_FLEEING_DIST_MALUS &&
                     distCatY >= MOUSE_VISIBLE_DISTANCE + MOUSE_STOP_FLEEING_DIST_MALUS) {
              if (!isVisible(client) && Math.random() < MOUSE_STAY_HIDDEN_PROB) {
                client.botMouseData.state = mouseAIState.MAI_HIDING;
              } else {
                client.botMouseData.state = mouseAIState.MAI_MOVING;
                findMouseTargetPosition(client);
              }
            } else {
              // TODO
              // trouver une fonction continue de ma position, de celle du chat et
              // de son u,v qui me sort une position target correcte ?
              // faire des feintes ?
              if (deltaCatX >= 0) {
                j.u = 1;
              } else if (deltaCatX < 0) {
                j.u = -1;
              }
              if (deltaCatY >= 0) {
                j.v = 1;
              } else if (deltaCatY < 0) {
                j.v = -1;
              }
            }
            // update mouse appearance
            var tile = botMouse_GetNewAppearance(client);
            if (tile != null) {
              j.t = tile;
            }
          }
          break;
      }
    }
    processClientInput(client, j);
  }
}

function randomPos() {
  return { x: Math.floor(Math.random() * S.W), y: Math.floor(Math.random() * S.H) };
}

// calculate a correct new target pos for a mouse bot
function findMouseTargetPosition(mouseBot) {
  // placeholder : random pos
  var pos = randomPos();
  mouseBot.botMouseData.targetX = pos.x;
  mouseBot.botMouseData.targetY = pos.y;
}

function initMouseBot(bot) {
  delete bot.botMouseData;
  delete bot.botCatData;
  bot.botMouseData = {
    state: mouseAIState.MAI_MOVING,
    targetX: 0,
    targetY: 0
  };
  findMouseTargetPosition(bot);
}
  
function initCatBot(bot) {
  delete bot.botMouseData;
  delete bot.botCatData;
  var pos = randomPos();
  bot.botCatData = {
    state: catAIState.CAI_IDLE,
    targetX: pos.x,
    targetY: pos.y,
    target: undefined,
    changeTargetTimer: 0,
    refreshTargetTimer: 0,
    targetTile: '.'
  };

}

function manageBotsNumber()
{
  while (players < S.minPlayerNb) {
    addBot();
  }
  while (players > S.minPlayerNb) {
    for (var c in clients) {
      var client = clients[c];
      if (client.bot !== undefined)
      {
        removeBot(c);
        break;
      }
    }
  }
}

function removeBot(id) {
  
  if (cat && cat.id == id) {
    cat = undefined;
  }

  var x = undefined;
  var y = undefined;

  if (clients[id].last) {
    addToLog(clients[id].name + " left!");
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
  
}

function addBot() {
  var id = uids;
  uids++;
  
  var bot = {
    id: id,
    score: worstScore
  }
  
  bot.last = {
    id: id,
    t: 'P',
    x: Math.floor(Math.random()*S.W),
    y: Math.floor(Math.random()*S.H),
    u: 0,
    v: 0,
    hJ: 0
  };
  
  bot.bot = true;
  bot.name = "bot " + bot.last.id;
  
  players++;
  
  var j = {
    type: "map",
    map: map,
    w: S.W,
    h: S.H,
    you: id,
    hJT: S.hideJaugeThreshold,
    hJM: S.hideJaugeMaxValue
  };
  
  clients[id] = bot;
  bot.send = function(e) {
  };
  
  initMouseBot(bot);
  
  addToLog(bot.name + " joins!");
  
}

//////////////////////////////
//  END BOT CODE SECTION
//////////////////////////////

var wss = new ws.Server({server: server});
wss.on('connection', function(client) {
  var id = uids;
  uids++;
  console.log("client "+id+" connected");
  
  client.id = id;

  client.score = S.scoreMax;
  
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

      addToLog(clients[id].name + " joins!");
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
      
      manageBotsNumber();
      
    } else {
      processClientInput(client, j);
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
      addToLog(clients[id].name + " left!");
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
    else {
      manageBotsNumber();
    }

  });
});


console.log("Listening on port "+S.PORT);
