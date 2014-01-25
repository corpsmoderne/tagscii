"use strict"

var map;
var W;
var H;
var you = undefined;
var player = undefined;
var cat = undefined;
var players = {};
var ws;

window.players = players;

function genMap(M) {
  var map = [];
  var i =0;
  M.forEach(function(L) {
    var line = [];
    var j = 0;
    L.forEach(function(T) {
      var tile = { type: T, x:j, y:i };
      tile.elem = $("<span class='tile'>"+tile.type+"</span>");
      tile.elem.css("top", i*10);
      tile.elem.css("left", j*10);

      tile.restore = function() {
        tile.elem.html(tile.type);
        tile.elem.removeClass("player");
        tile.elem.removeClass("cat");
      };
      
      $("#main").append(tile.elem);
      line.push(tile);
      j++;
    });
    map.push(line);
    i++;
  });
  return map;
}

function newPlayer(map, X, Y) {
  var player = {
    x: X, 
    y: Y,
    type: 'P',
  };
  
  function update() {
    if (player.current_tile !== undefined) {
      player.current_tile.restore();
    }
    if(player.x && player.y) {
      player.current_tile = map[player.y][player.x];
      player.current_tile.elem.html(player.type);
      if (player.you == true) {
        player.current_tile.elem.addClass("player");
      }
      if (player.cat == true) {
        player.current_tile.elem.addClass("cat");
      }
    }
  }

  function sendInfo() {
    ws.send(JSON.stringify({
      x: player.x,
      y: player.y,
      t: player.type,
    }));
  }
  
  player.update = update;
  player.sendInfo = sendInfo;
  update();
  return player;
}

function netUpdatePlayer(data) {
  if (players[data.id] === undefined) {
    players[data.id] = newPlayer(map, data.x, data.y);
    if (data.id == you) {
      player = players[data.id];
      player.you = true;
    }
  } else {
    players[data.id].x = data.x;
    players[data.id].y = data.y;
    players[data.id].type = data.t;
  }
  if (data.cat === true) {
    players[data.id].cat = true;
  } else {
    delete players[data.id].cat;
  }
  players[data.id].update();
}

$(document).ready(function() {

  var url = 'ws://' + window.document.location.host+window.document.location.pathname;

  var timeout = 1;
  function startWS(url) {
    ws = new WebSocket(url);
    ws.onclose = function(){
      console.log("connection lost, trying to reconnect...");
      setTimeout(function() {
        if (timeout < 5) {
          timeout += 1;
        }
        startWS(url);
      }, timeout*1000);
    };
    ws.onopen = function(event) {
      timeout = 1;
      console.log("connected");
    };
    ws.onmessage = function (event) {
      //console.log(event.data);
      var data = JSON.parse(event.data);
      switch(data.type) {
      case "map":
        map = genMap(data.map);
        W = data.w;
        H = data.h;

        you = data.you;

        console.log("map loaded");
        break;
      case "p":
        netUpdatePlayer(data);
        break;
      case "all":
        data.lst.forEach(function(p) {
          netUpdatePlayer(p);
        });
        break;
      case "r":
        console.log(data);
        map[data.y][data.x].restore();
        break;  
      default:
        console.log(data);
        break;
      }
    }
  }
  startWS(url);

  $(document).keydown(function(event) {
    //console.log(event);
    if (player === undefined) {
      return;
    }

    switch(event.keyCode) {
    case 37: // LEFT
	  if (player.x > 0)
		player.x -= 1;
      break;
    case 38: // UP
      if (player.y > 0)
	    player.y -= 1;
      break;
    case 39: // RIGHT
      if (player.x < W - 1)
		player.x += 1;
      break;
    case 40: // DOWN
      if (player.y < H - 1)
		player.y += 1;
      break;
    case 32: // SPACE
      player.current_tile.type = player.type;
      console.log(player.current_tile.type);
      break;
    default:
      player.type = String.fromCharCode(event.keyCode).toLowerCase();
      break;
    }
    //player.update();
    player.sendInfo();
  });
  
});
