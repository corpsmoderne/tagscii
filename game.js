"use strict"

var W=64;
var H=64;

var tiles = "....----===+*%$#";

function genMap() {
  var map = [];

  for(var i=0; i < H; i++) {
    var line = [];
    for(var j=0; j < W; j++) {
      var tile = {
        type: tiles[Math.floor((Math.random()*Math.random())*tiles.length)]
      };
      tile.elem = $("<span class='tile'>"+tile.type+"</span>");
      tile.elem.css("top", i*10);
      tile.elem.css("left", j*10);
      line.push(tile);
      $("#main").append(tile.elem);
    }
    map.push(line);
  }
  return map;
}

function newPlayer(map, X, Y) {
  var player = {
    x: X, 
    y: Y,
    type: 'P'
  };
  
  function update() {
    if (player.current_tile !== undefined) {
      player.current_tile.elem.html(player.current_tile.type);
      player.current_tile.elem.removeClass("player");
    }
    player.current_tile = map[player.y][player.x];
    player.current_tile.elem.html(player.type);
    player.current_tile.elem.addClass("player");
  }
  player.update = update;
  update();
  return player;
}

$(document).ready(function() {
  var map = genMap();
 
  var player = newPlayer(map, 0, 0);

  $(document).keydown(function(event) {
    //console.log(event);
    switch(event.keyCode) {
    case 37: // LEFT
      player.x -= 1;
      break;
    case 38: // UP
      player.y -= 1;
      break;
    case 39: // RIGHT
      player.x += 1;
      break;
    case 40: // DOWN
      player.y += 1;
      break;
    case 32: // SPACE
      console.log("SPACE");

      player.current_tile.type = player.type;
      console.log(player.current_tile.type);
      break;
    default:
      console.log("HERE!");
      player.type = String.fromCharCode(event.keyCode);
      break;
    }
    player.update();
    
  });
  
});
