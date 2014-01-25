"use strict"

var map;
var W;
var H;
var player = undefined;
var cat = undefined;
var players = {};
var ws;

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
      player.current_tile.elem.html(player.current_tile.type);
      player.current_tile.elem.removeClass("player");
      player.current_tile.elem.removeClass("cat");
    }
    player.current_tile = map[player.y][player.x];
    player.current_tile.elem.html(player.type);
    if (player.you == true) {
      player.current_tile.elem.addClass("player");
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
      ws.send(JSON.stringify({ type:"ping"}));
    };
    ws.onmessage = function (event) {
      //console.log(event.data);
      var data = JSON.parse(event.data);
      switch(data.type) {
      case "map":
        map = genMap(data.map);
        W = data.w;
        H = data.h;

        player = newPlayer(map, 
                           Math.floor(Math.random()*W), 
                           Math.floor(Math.random()*H));
        player.you = true;
        player.sendInfo();
        break;
      case "p":
        if (data.id != player.id) {
          if (players[data.id] === undefined) {
            players[data.id] = newPlayer(map, data.x, data.y);
          } else {
            players[data.id].x = data.x;
            players[data.id].y = data.y;
            players[data.id].type = data.t;
          }
          players[data.id].update();
        }
        break;
      case "cat":
        console.log(data);
        console.log(players);
        if (cat !== undefined) {
          console.log("old cat", cat);
          cat.current_tile.elem.removeClass("cat");
          cat.cat = false;
        }
        cat = players[data.id];
        console.log(cat, data);
        cat.cat = true;
        cat.current_tile.elem.addClass("cat");

        break;
      case "ping":
        player.sendInfo();
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
      player.type = String.fromCharCode(event.keyCode);
      break;
    }
    player.update();
    player.sendInfo();
  });
  
});
