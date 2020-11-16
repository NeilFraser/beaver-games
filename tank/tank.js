/**
 * @license
 * Copyright 2020 Neil Fraser
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @fileoverview Tank game.
 * @author root@neil.fraser.name (Neil Fraser)
 */
'use strict';


// Namespace for SVG elements.
var SVG_NS = 'http://www.w3.org/2000/svg';

// Distance from hexagon's center to any point.
var HEX_SIZE = 20;

// Width of a pointy-top hexagon.
var HEX_WIDTH = Math.sqrt(3) * HEX_SIZE;
// Height of a pointy-top hexagon.
var HEX_HEIGHT = 2 * HEX_SIZE;

// Number of hexagon rows on playing field.
var GRID_HEIGHT = 19;  // Odd is better.
// Number of hexagon columns on playing field.
var GRID_WIDTH = 25;

// Fraction of the board with obstacles.
var OBSTACLE_RATIO = 0.3;

// Current state of the keyboard.
var keyStatus = {
  '1': false,
  '2': false,
  '3': false,
  '8': false,
  '9': false,
  '0': false
};

// Keys tapped within a turn.
var keyTapped = {
  '1': false,
  '2': false,
  '3': false,
  '8': false,
  '9': false,
  '0': false
};

// Array of Tank objects (players).
var tanks = [];
// Incrementing tick count for each clock tick.
var clockCycle = 0;

// 2D axial grid of hexagons.
var grid = [];

// Number of milliseconds between two turns of a player.
var SPEED;

var player1 = null;
var player2 = null;
var playerComputer = null;

// On page load, initialize the event handlers and draw the grid.
function init() {
  fixLinks();

  var m = document.cookie.match(/difficulty=([01])/);
  var difficultyIndex = m ? m[1] : 0;
  SPEED = [750, 500][difficultyIndex];
  document.getElementById('difficulty').selectedIndex = difficultyIndex;
  var playerCount = 1;
  m = document.cookie.match(/players=([12])/);
  if (m && m[1] === '2') {
    playerCount = 2;
  }
  document.getElementById('players').selectedIndex = playerCount - 1;
  registerOptions('players', 'difficulty');

  document.addEventListener('keydown', keyDown);
  document.addEventListener('keyup', keyUp);

  initGrid();

  player1 = new Tank(1);
  tanks.push(player1);
  if (playerCount > 1) {
    player2 = new Tank(2);
    tanks.push(player2);
  } else {
    document.getElementById('player2scores').style.display = 'none';
    document.getElementById('player2keys').style.display = 'none';
  }
  playerComputer = new Tank(3);
  tanks.push(playerComputer);
  // If there are an even number of tanks:
  // 2:  S2,S1,T1 - S1,S2,T2 - Repeat...
  // 4:  S3,S1,T1 - S4,S2,T2 - S1,S3,T3 - S2,S4,T4 - Repeat...
  // If there are an odd number of tanks:
  // 1:  S1,T1 - S1 - Repeat...
  // 3:  S1,T1 - S3 - S2,T2 - S1 - S3,T3 - S2 - Repeat...
  var interval = SPEED / (tanks.length * ((tanks.length % 2) ?  2 : 1));
  setInterval(clock, interval);
}
window.addEventListener('load', init);

// Initial draw of grid.
function initGrid() {
  for (var y = 0; y < GRID_HEIGHT; y++) {
    var row = [];
    var startX = -Math.floor(y / 2);
    var endX = GRID_WIDTH - Math.ceil(y / 2);
    for (var x = startX; x < endX; x++) {
      row[x] = new Hex(x, y);
      if (y === 0 || y === GRID_HEIGHT - 1 ||
          x === startX || x === endX - 1) {
        // Outer border.
        row[x].setWall(true);
      }
    }
    grid[y] = row;
  }
  // Randomly add barriers.
  for (var y in grid) {
    var row = grid[y];
    for (var x in row) {
      var cell = row[x];
      if (!cell.isWall && Math.random() < OBSTACLE_RATIO) {
        // Place barrier as long as it doesn't form an exclave.
        cell.setWall(true);
        var neighbours = cell.getNeighbours();
        var firstNeighbour = neighbours.pop();
        if (firstNeighbour) {
          for (var i = 0, neighbour; (neighbour = neighbours[i]); i++) {
            if (!hasPath(firstNeighbour, neighbour)) {
              cell.setWall(false);
              break;
            }
          }
        }
      }
    }
  }
}

// Is there a navigable path between two hexes?
function hasPath(startHex, goalHex) {
  var frontier = [startHex];
  var reached = new Set();
  reached.add(startHex);
  while (frontier.length) {
    var current = frontier.shift();
    if (current === goalHex) {
      return true;
    }
    var neighbours = current.getNeighbours();
    for (var i = 0, neighbour; (neighbour = neighbours[i]); i++) {
      if (!reached.has(neighbour)) {
        frontier.push(neighbour);
        reached.add(neighbour);
      }
    }
  }
  return false;
}

// Starting at the specified tank's location, find the path to the closest tank.
// Return the initial direction to move to head to the tank.
function findTank(tank) {
  function record(newHex, newDir) {
    var newDesc = makeDesc(newHex, newDir);
    if (!cameFrom.has(newDesc)) {
      frontier.push([newHex, newDir]);
      cameFrom.set(newDesc, [currentHex, currentDir]);
    }
  }

  function makeDesc(hex, direction) {
    return hex.hexX + ',' + hex.hexY + ',' + direction;
  }

  var startHex = tank.getHex();
  var startDir = tank.direction;
  var frontier = [[startHex, startDir]];
  var cameFrom = new Map();
  while (frontier.length) {
    var current = frontier.shift();
    var currentHex = current[0];
    var currentDir = current[1];
    if (currentHex !== startHex && currentHex.getTank()) {
      // Found an enemy tank.  Return the first direction to step to.
      var returnDir = null;
      while (currentHex !== startHex || currentDir !== startDir) {
        returnDir = currentDir;
        current = cameFrom.get(makeDesc(currentHex, currentDir));
        currentHex = current[0];
        currentDir = current[1];
      }
      return returnDir;
    }
    var newHex, newDir;
    // Explore moving forwards.
    var dxy = dirToDelta(currentDir);
    newHex = grid[currentHex.hexY + dxy.y][currentHex.hexX + dxy.x];
    newDir = currentDir;
    if (!newHex.isWall) {
      record(newHex, newDir);
    }
    newHex = currentHex;
    // Explore turning right.
    newDir = (currentDir + 1) % 6;
    record(newHex, newDir);
    // Explore turning left.
    newDir = (currentDir + 5) % 6;
    record(newHex, newDir);
  }
  return null;
}

// Handle a turn.
function clock() {
  var players = tanks.length;
  var oddPlayers = players % 2;
  var tank = null;
  var shell = null;
  if (oddPlayers) {
    if (clockCycle % 2) {
      shell = tanks[(clockCycle * 2) % players].shell;
    } else {
      tank = tanks[clockCycle / 2];
    }
  } else {
    tank = tanks[clockCycle];
    shell = tanks[(clockCycle + players / 2) % players].shell;
  }
  if (shell && !shell.frozen) {
    shell.move();
  }

  if (tank && !tank.frozen) {
    if (tank === player1) {
      if (keyStatus[3] || keyTapped[3]) {
        tank.fire();
      }
      if (keyStatus[1] && keyStatus[2]) {
        tank.move();
      } else if (keyStatus[1] || (keyTapped[1] && !keyTapped[2])) {
        tank.turn(-1);
      } else if (keyStatus[2] || (keyTapped[2] && !keyTapped[1])) {
        tank.turn(1);
      }
      keyTapped[1] = false;
      keyTapped[2] = false;
      keyTapped[3] = false;
    } else if (tank === player2) {
      if (keyStatus[0] || keyTapped[0]) {
        tank.fire();
      }
      if (keyStatus[8] && keyStatus[9]) {
        tank.move();
      } else if (keyStatus[8] || (keyTapped[8] && !keyTapped[9])) {
        tank.turn(-1);
      } else if (keyStatus[9] || (keyTapped[9] && !keyTapped[8])) {
        tank.turn(1);
      }
      keyTapped[8] = false;
      keyTapped[9] = false;
      keyTapped[0] = false;
    } else if (tank === playerComputer) {
      computerTurn(tank);
    }
  }
  if (tank && tank.shell) {
    // If the tank just fired, the shell arms once it is clear of the tank.
    if (tank.firing) {
      tank.firing--;
    }
    if (!tank.shell.frozen) {
      tank.shell.move();
    }
  }

  // Increment the clockCycle, wrapping to 0 as needed.
  clockCycle++;
  var wrapTicks = players * (oddPlayers ? 2 : 1);
  if (clockCycle >= wrapTicks) {
    clockCycle = 0;
  }
}

function computerTurn(me) {
  // Fire if there's a tank ahead of us.
  var lookX = me.hexX;
  var lookY = me.hexY;
  var dxy = dirToDelta(me.direction);
  do {
    lookX += dxy.x;
    lookY += dxy.y;
    var hex = grid[lookY][lookX];
  } while (!hex.isWall && !hex.getTank());
  if (hex.getTank()) {
    me.fire();
  }

  // Drive/Turn towards the nearest tank.
  var direction = findTank(me);
  if (direction !== null) {
    if (((me.direction + 1) % 6) === direction) {
      me.turn(1);
    } else if (((me.direction + 5) % 6) === direction) {
      me.turn(-1);
    } else {
      me.move();
    }
  }
}

// Convert axial hex coordinates to screen XY coordinates.
function hexToScreen(hexX, hexY) {
  var x = hexX * HEX_WIDTH - HEX_WIDTH / 4;
  x += hexY * HEX_WIDTH / 2;
  var y = hexY * HEX_HEIGHT * 0.75;
  return {x: x, y: y};
}

// Convert a 0-5 direction into a change in hex coordinates.
function dirToDelta(dir) {
  return dirToDelta.TABLE[dir];
}

// Lookup table to convert forwards movement in a direction (0-5)
// to axial XY deltas.
dirToDelta.TABLE = [
  {x: 1, y: 0},
  {x: 0, y: 1},
  {x: -1, y: 1},
  {x: -1, y: 0},
  {x: 0, y: -1},
  {x: 1, y: -1}
];

// User pressed a key to start an action.
function keyDown(e) {
  if (e.repeat) return;
  if (keyStatus.hasOwnProperty(e.key)) {
    keyStatus[e.key] = true;
  }
  if (keyTapped.hasOwnProperty(e.key)) {
    keyTapped[e.key] = true;
  }
}

// User releases a key to stop an action.
function keyUp(e) {
  if (keyStatus.hasOwnProperty(e.key)) {
    keyStatus[e.key] = false;
  }
}

// Constructor for a single hexagon centered on the given coordinates.
function Hex(hexX, hexY) {
  this.hexX = hexX;
  this.hexY = hexY;
  // <polygon points="100,60 134.6,80 134.6,120 100,140 65.3,120 65.3,80" class="grid"></polygon>
  var xy = hexToScreen(hexX, hexY);
  var element = document.createElementNS(SVG_NS, 'polygon');
  var points = [];
  points[0] = (xy.x) + ',' + (xy.y - HEX_HEIGHT / 2);
  points[1] = (xy.x + HEX_WIDTH / 2) + ',' + (xy.y - HEX_HEIGHT / 4);
  points[2] = (xy.x + HEX_WIDTH / 2) + ',' + (xy.y + HEX_HEIGHT / 4);
  points[3] = (xy.x) + ',' + (xy.y +  HEX_HEIGHT / 2);
  points[4] = (xy.x - HEX_WIDTH / 2) + ',' + (xy.y + HEX_HEIGHT / 4);
  points[5] = (xy.x - HEX_WIDTH / 2) + ',' + (xy.y - HEX_HEIGHT / 4);
  element.setAttribute('points', points.join(' '));
  element.setAttribute('class', 'grid');
  var g = document.getElementById('grid');
  g.appendChild(element);

  this.element = element;
  this.isWall = false;
}

// Convert this hexagon into a wall.
Hex.prototype.setWall = function(wall) {
  this.isWall = wall;
  if (wall) {
    this.element.classList.add('gridWall');
  } else {
    this.element.classList.remove('gridWall');
  }
};

// Return list of all live shells in this hex.
Hex.prototype.getShells = function(victim) {
  var shells = [];
  for (var i = 0, tank; (tank = tanks[i]); i++) {
    if (tank.shell &&
        tank.shell.hexX === this.hexX && tank.shell.hexY === this.hexY &&
        (tank !== victim || !tank.firing)) {
      shells.push(tank.shell);
    }
  }
  return shells;
};

// Return tank in this hex, or null.
Hex.prototype.getTank = function() {
  for (var i = 0, tank; (tank = tanks[i]); i++) {
    if (tank.hexX === this.hexX && tank.hexY === this.hexY) {
      return tank;
    }
  }
  return null;
};

// Return all non-wall neighbours of this hex.
Hex.prototype.getNeighbours = function() {
  var neighbours = [];
  for (var direction = 0; direction < 6; direction++) {
    var dxy = dirToDelta(direction);
    var newX = this.hexX + dxy.x;
    var newY = this.hexY + dxy.y;
    var newHex = grid[newY][newX];
    if (!newHex.isWall) {
      neighbours.push(newHex);
    }
  }
  return neighbours;
};

// Abstract constructor for a object that is animatable.
function AbstractAnimatable() {}

// Size of object.
AbstractAnimatable.prototype.SCALE = 1;
// What fraction of a clock cycle does the object take to move.
AbstractAnimatable.prototype.SPEED = 1;
// True if the object should be disposed at the end of the current animation.
AbstractAnimatable.prototype.disposedScheduled = false;
// True if the object should not be moved (due to waiting for disposal).
AbstractAnimatable.prototype.frozen = false;


// Draw the object on the playing field.
AbstractAnimatable.prototype.render = function(animate) {
  cancelAnimationFrame(this.animationFramePid);
  if (animate) {
    this.translateXStart = this.translateXFinal;
    this.translateYStart = this.translateYFinal;
    this.rotateStart = this.rotateFinal;
  }
  var xy = hexToScreen(this.hexX, this.hexY);
  this.translateXFinal = xy.x;
  this.translateYFinal = xy.y;
  this.rotateFinal = this.direction * 60 + 90;
  if (animate) {
    if (this.rotateStart === 390 && this.rotateFinal === 90) {
      this.rotateStart -= 360;
    } else if (this.rotateStart === 90 && this.rotateFinal === 390) {
      this.rotateStart += 360;
    }
    this.animateStart = undefined;
    this.animationFramePid = requestAnimationFrame(this.animate.bind(this));
  } else {
    this.translateXNow = this.translateXFinal;
    this.translateYNow = this.translateYFinal;
    this.rotateNow = this.rotateFinal;
    this.setTransforms();
  }
};

// Set the SVG transforms for a object.
AbstractAnimatable.prototype.setTransforms = function() {
  var translate = 'translate(' + this.translateXNow + ',' + this.translateYNow + ')';
  var rotate = 'rotate(' + this.rotateNow + ')';
  var scale = 'scale(' + this.SCALE + ')';
  this.element.setAttribute('transform', translate + ' ' + rotate + ' ' + scale);
};

// Animate one frame of movement of the object from where it is towards its
// final position.
AbstractAnimatable.prototype.animate = function(timestamp) {
  if (!this.animateStart) {
    this.animateStart = timestamp;
  }
  var maxElapsed = SPEED * this.SPEED;
  var elapsed = Math.min(timestamp - this.animateStart, maxElapsed);
  var ratio = elapsed / maxElapsed;
  this.translateXNow = (this.translateXFinal - this.translateXStart) * ratio + this.translateXStart;
  this.translateYNow = (this.translateYFinal - this.translateYStart) * ratio + this.translateYStart;
  this.rotateNow = (this.rotateFinal - this.rotateStart) * ratio + this.rotateStart;

  this.setTransforms();
  if (ratio < 1) {
    cancelAnimationFrame(this.animationFramePid);
    this.animationFramePid = requestAnimationFrame(this.animate.bind(this));
  } else {
    this.animateStart = undefined;
    if (this.disposedScheduled) {
      this.callDispose();
    }
  }
};

// Get the hex for this object.
AbstractAnimatable.prototype.getHex = function(opt_dx, opt_dy) {
  var newX = this.hexX + (opt_dx || 0);
  var newY = this.hexY + (opt_dy || 0);
  return grid[newY][newX];
};

// Call dispose now, or as soon as the current animation completes.
AbstractAnimatable.prototype.callDispose = function() {
  if (this.animateStart === undefined) {
    this.disposedScheduled = false;
    this.dispose();
  } else {
    this.disposedScheduled = true;
  }
};

// Stub for dispose method.
AbstractAnimatable.prototype.dispose = function() {
  throw new Error('Implemented by sub-class.');
};

// Constructor for a new shell (bullet).
function Shell(tank) {
  this.tank = tank;
  var element = document.createElementNS(SVG_NS, 'circle');
  element.setAttribute('cx', 0);
  element.setAttribute('cy', 0);
  element.setAttribute('r', 1);
  element.setAttribute('class', 'shell player' + tank.playerNumber);
  var g = document.getElementById('landscape');
  g.appendChild(element);

  this.hexX = tank.hexX;
  this.hexY = tank.hexY;
  this.direction = tank.direction;
  this.element = element;
  this.render(false);
}

// Inherit from AbstractAnimatable.
Shell.prototype = new AbstractAnimatable();
Shell.prototype.constructor = Shell;

// Radius of shell.
Shell.prototype.SCALE = 4;
// What fraction of a clock cycle does the shell take to move.
Shell.prototype.SPEED = 0.4;
// Tank that this shell hits.
Shell.prototype.intersectedTank = null;

Shell.prototype.dispose = function() {
  this.tank.shell = null;
  this.tank = null;
  this.element.parentNode.removeChild(this.element);
  // Destroy any tank this shell hit.
  if (this.intersectedTank) {
    this.intersectedTank.callDispose();
    this.intersectedTank = null;
  }
};

// Update the shell's coordinates to move forwards.
Shell.prototype.move = function() {
  if (this.frozen) throw Error('Shell is frozen.');
  this.animateStart = 0;  // Set a falsy start value.
  var dxy = dirToDelta(this.direction);
  var newHex = this.getHex(dxy.x, dxy.y);
  if (!newHex) {
    throw Error('Shell out of bounds: ' + this.hexX + ',' + this.hexY + ' + ' +
                dxy.x + ',' + dxy.y);
  }
  if (newHex.isWall) {
    this.callDispose();
  }
  var victim = newHex.getTank();
  if (victim && (victim !== this.tank || !victim.firing)) {
    victim.recordScore([this.tank]);
    victim.frozen = true;
    this.intersectedTank = victim;
    this.callDispose();
  }
  this.hexX += dxy.x;
  this.hexY += dxy.y;
  this.render(true);
};

// Constructor for a new tank.
// Player number should be 1-3 and determines tank's colour.
function Tank(playerNumber) {
  this.playerNumber = playerNumber;
  var element = document.createElementNS(SVG_NS, 'polygon');
  element.setAttribute('points', this.PATH);
  element.setAttribute('class', 'tank player' + playerNumber);
  var g = document.getElementById('landscape');
  g.appendChild(element);
  this.element = element;
  this.shell = null;
  this.firing = 0;
  this.score = 0;
  // Shells that this tank hits.
  this.intersectedShells = [];
  this.placeRandomly();
}

// Inherit from AbstractAnimatable.
Tank.prototype = new AbstractAnimatable();
Tank.prototype.constructor = Tank;

// Path for drawing a tank's shape.  Centered on 0,0.
Tank.prototype.PATH = '0,-2 2,2 0,1 -2,2';
// Size to visually scale a tank.
Tank.prototype.SCALE = 5;
// What fraction of a clock cycle does the tank take to move.
Tank.prototype.SPEED = 0.8;
// Has the tank been removed from the field?
Tank.prototype.disposed = true;

// Update the tank's coordinates to move forwards.
Tank.prototype.move = function() {
  if (this.frozen) throw Error('Tank is frozen.');
  this.animateStart = 0;  // Set a falsy start value.
  var dxy = dirToDelta(this.direction);
  var newHex = this.getHex(dxy.x, dxy.y);
  if (!newHex) {
    throw Error('Tank out of bounds: ' + this.hexX + ',' + this.hexY + ' + ' +
                dxy.x + ',' + dxy.y);
  }
  if (newHex.isWall || newHex.getTank()) {
    return;
  }
  var shells = newHex.getShells(this);
  if (shells.length) {
    // Look for shells that are approaching head-on.
    var dir = (this.direction + 3) % 6;
    var victors = [];
    for (var i = 0, shell; (shell = shells[i]); i++) {
      if (shell.direction === dir) {
        victors.push(shell.tank);
        this.intersectedShells.push(shell);
        shell.frozen = true;
      }
    }
    if (victors.length) {
      this.frozen = true;
      this.recordScore(victors);
      this.callDispose();
    }
  }
  this.hexX += dxy.x;
  this.hexY += dxy.y;
  this.render(true);
};

// Place the tank randomly on the board and activate it.
Tank.prototype.placeRandomly = function() {
  do {
    var y = Math.floor(Math.random() * grid.length);
    var xKeys = Object.keys(grid[y]);
    var xIndex = Math.floor(Math.random() * xKeys.length);
    var x = Number(xKeys[xIndex]);
    var hex = grid[y][x];
  } while (hex.isWall || hex.getTank());

  this.hexX = x;
  this.hexY = y;
  this.direction = Math.floor(Math.random() * 6);
  this.frozen = false;
  this.disposed = false;
  this.render(false);
  // Clear any keypresses while dead.
  if (this.playerNumber === 1) {
    keyTapped[1] = false;
    keyTapped[2] = false;
    keyTapped[3] = false;
  } else if (this.playerNumber === 2) {
    keyTapped[8] = false;
    keyTapped[9] = false;
    keyTapped[0] = false;
  }
};

// Change this tank's score.  Display the score.
Tank.prototype.setScore = function() {
  this.score++;
  document.getElementById('player' + this.playerNumber + 'score').textContent =
      this.score;
};

// Explode the tank.
Tank.prototype.dispose = function() {
  if (this.disposed) {
    // A second shell has hit us?  We are already dead.
    return;
  }
  this.disposed = true;
  // Create a hulk in this location.
  new Hulk(this);
  // Shutdown this tank.
  this.animateStart = undefined;
  cancelAnimationFrame(this.animationFramePid);
  this.firing = 0;
  // Destroy any shells this tank hit.
  for (var i = 0, shell; (shell = this.intersectedShells[i]); i++) {
    shell.callDispose();
  }
  this.intersectedShells.length = 0;
  // Remove the tank from the board.
  this.hexX = -10;
  this.hexY = -10;
  this.render(false);
  setTimeout(this.placeRandomly.bind(this), 1000);
};

// Increase the score of whomever is responsible for this tank's death.
Tank.prototype.recordScore = function(victors) {
  for (var i = 0, victor; (victor = victors[i]); i++) {
    if (victor === this) {
      // Spawned in your own shell's path.
      this.setScore(this.score - 1);
    } else {
      // Victor killed this tank.
      victor.setScore(victor.score + 1);
    }
  }
};

// Update the tank's direction to move clockwise or counter-clockwise.
Tank.prototype.turn = function(dir) {
  if (this.frozen) throw Error('Tank is frozen.');
  this.direction += dir;
  if (this.direction < 0) {
    this.direction += 6;
  } else if (this.direction >= 6) {
    this.direction -= 6;
  }
  this.render(true);
};

// Fire a shell if one doesn't already exist.
Tank.prototype.fire = function() {
  if (this.frozen) throw Error('Tank is frozen.');
  if (this.shell) return;
  this.shell = new Shell(this);
  // Set a fuze so you don't blow yourself up when firing.
  this.firing = 2;
};

// Constructor for a new hulk.
// Player number should be 1-3 and determines hulk's colour.
function Hulk(tank) {
  this.tank = tank;
  var element = document.createElementNS(SVG_NS, 'polygon');
  element.setAttribute('points', this.PATH);
  element.setAttribute('class', 'hulk player' + tank.playerNumber);
  var g = document.getElementById('hulks');
  g.appendChild(element);
  this.element = element;
  this.hexX = tank.hexX;
  this.hexY = tank.hexY;
  this.direction = tank.direction;
  this.render(false);
}

// Inherit from AbstractAnimatable.
Hulk.prototype = new AbstractAnimatable();
Hulk.prototype.constructor = Hulk;

// Path for drawing a hulk's shape.  Centered on 0,0.
Hulk.prototype.PATH = '-1,1 -1,2 1,1 1,2 2,0 1,0 2,-1 0,-2 0,0 -2,-1';
// Size to visually scale a hulk.
Hulk.prototype.SCALE = 5;
