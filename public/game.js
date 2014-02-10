"use strict"

var map;
var W;
var H;
var you = undefined;
var player = undefined;
var players = {};
var ws;

//these are defined in app.js
var hideJaugeThreshold;
var	hideJaugeMaxValue;

var maxLogEntries = 100;

window.players = players;

function genMap(M) {
  $("#main").empty();
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
        tile.elem.removeClass("visible");
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

var lastCmd = Date.now();

function newPlayer(map, X, Y) {
  var player = {
    x: X, 
    y: Y,
    u: 0,
    v: 0,
    type: 'P',
    hJ: 0,
    visible: false
  };
	
  function setMap(Map) {
    map = Map;
  }
  
  function update() {
    if (player.current_tile !== undefined) {
      player.current_tile.restore();
    }
    if (player.x !== undefined && player.y !== undefined) {
      player.current_tile = map[player.y][player.x];
      player.current_tile.elem.html(player.type);
      
      if (player.cat === true) {
        player.current_tile.elem.addClass("cat");
				player.hJ = 0;
				player.visible = false;
      }
      
      if (player.hJ >= hideJaugeMaxValue && !player.visible == true) {
				player.visible = true; 
        if (player.you === true) {
          $("#turned")[0].play();
        }
      } else if (player.hJ < hideJaugeThreshold && player.visible == true) {
				player.visible = false;
      }
      
      if (player.visible == true) {
	player.current_tile.elem.addClass("visible");
      }
      if (player.you == true) {
        player.current_tile.elem.addClass("player");
      }
    }
  }
  
  function sendInfo(sendT) {
    lastCmd = Date.now();
    var j = {
      u: player.u,
      v: player.v,
    }
    j.t = sendT;
    ws.send(JSON.stringify(j));
  }
  
  player.update = update;
  player.sendInfo = sendInfo;
  player.setMap = setMap;
  update();
  return player;
}

function setMusic() {
  if (player && player.cat == true) {
    $("#MusicCat")[0].volume = 1;
    $("#MusicMice")[0].volume = 0;
  } else {
    $("#MusicCat")[0].volume = 0;
    $("#MusicMice")[0].volume = 1;
  }
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
    if (data.hJ === undefined) {
      players[data.id].hJ = 0;
    } else {
      players[data.id].hJ = data.hJ;
    }
  }
  if (data.cat === true) {
    if (players[data.id].cat !== true) {
      players[data.id].cat = true;
      $("#catchange")[0].play();
    }
  } else {
    delete players[data.id].cat;
  }
  players[data.id].update();
  setMusic();
}

setInterval(function() {
  if (player === undefined) {
    lastCmd = Date.now();
  }
  if (Date.now() - lastCmd > 20000 && player !== undefined) {
    ws.close();
    player = undefined;
    alert("You've been kicked for inactivity...\nReload if you want to play.");
  }
}, 1000);

$(document).ready(function() {

  $("#MusicCat")[0].volume = 0;

  var name = prompt("What's your nickname?");
  if (name === null || name === "") {
    name = "Anon";
  }
  console.log(">>> ", name);

  var url = 'ws://' + window.document.location.host+window.document.location.pathname;

  var timeout = 1;
  function startWS(url) {
    ws = new WebSocket(url);
    ws.onclose = function(){
      if (player === undefined) {
        alert("Sorry, the game has crashed, we're still debugging. Reload the page and join again!");
      }
      /*
      console.log("connection lost, trying to reconnect...");
      setTimeout(function() {
        if (timeout < 5) {
          timeout += 1;
        }
        startWS(url);
      
      }, timeout*1000);
      */
    };
    ws.onopen = function(event) {
      timeout = 1;
      console.log("connected");
      ws.send(JSON.stringify({ t:"name", n:name}));
    };
    ws.onmessage = function (event) {
      //console.log(event.data);
      var data = JSON.parse(event.data);
      switch(data.type) {
      case "map":
        map = genMap(data.map);
        W = data.w;
        H = data.h;
				hideJaugeThreshold = data.hJT;
				hideJaugeMaxValue = data.hJM;
        you = data.you;
        
        console.log("map loaded");
        break;
      case "all":
        data.lst.forEach(function(p) {
          netUpdatePlayer(p);
        });
        break;
      case "won":
	$('#gameOver h1').html(data.name + " WON!");
	$('#gameOver').fadeIn(500);
	break;
      case "end":
	$('#gameOver').fadeOut(500, function() {
	  map = genMap(data.map);
	  for (var p in players) {
	    var player = players[p];
	    player.setMap(map);
	  }
	  W = data.w;
	  H = data.h;
	});
	break;
      case "r":
        map[data.y][data.x].restore();
        break; 
      case "t":
        // EDIT
        map[data.y][data.x].type = data.v;
        map[data.y][data.x].elem.html(data.v);
        break;
      case "log":
	var logLine = $("<span class='logEntry'>" + data.content + "<br/></span>");
	$("#log").prepend(logLine);
	if ($("#log").children().length > maxLogEntries) {
	  $("#log").children().last().remove();
	}
        break; 
      case "scores":
        $("#scoreList").empty();
        data.lst.forEach(function(e) {
          var elem = $("<div class='score'>"+e.name+" : "+e.score+"</div>");
          if (e.cat === true) {
            elem.addClass("cat");
            elem.append($("<span style='float:right'>(>’.’<)</span>"));
          } else {
            elem.append($("<span style='float:right'>~(  '°></span>"));
          }
          $("#scoreList").append(elem);
        });
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
    var sendT = undefined;
    switch(event.keyCode) {
    case 37: // LEFT
      if (player.u >= 0)
	player.u -= 1;
      break;
    case 38: // UP
      if (player.v >= 0)
	player.v -= 1;
      break;
    case 39: // RIGHT
      if (player.u <= 0)
	player.u += 1;
      break;
    case 40: // DOWN
      if (player.v <= 0)
	player.v += 1;
      break;
      // SPACE keycode : 32
    case 32:
      sendT = ' ';
      break;
    default:
      var c = String.fromCharCode(event.keyCode).toLowerCase();
      if("abcdefghijklmnopqrstuvwxyz0123456789".indexOf(c) !== -1) {
        player.type = c;
        sendT = c;
      }
      break;
    }
    player.sendInfo(sendT);
  });
  
  
  $(document).keyup(function(event) {
    //console.log(event);
    if (player === undefined) {
      return;
    }
    
    switch(event.keyCode) {
    case 37: // LEFT
      if (player.u <= 0)
	player.u += 1;
      break;
    case 38: // UP
      if (player.v <= 0)
	player.v += 1;
      break;
    case 39: // RIGHT
      if (player.u >= 0)
	player.u -= 1;
      break;
    case 40: // DOWN
      if (player.v >= 0)
	player.v -= 1;
      break;
      // SPACE keycode : 32
    default:
      break;
    }
    //player.update();
    player.sendInfo(undefined);
  });


  $("#join").click(function() {
    ws.send(JSON.stringify({ t:"join"}));
    $("#join").hide();
  });
});
