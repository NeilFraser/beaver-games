/**
 * @license
 * Copyright 2020 Neil Fraser
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @fileoverview Hex game.
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

// Current state of the keyboard.
var keyStatus = {
  '1': false,
  '2': false,
  '3': false,
  '8': false,
  '9': false,
  '0': false
};

// Array of Tank objects (players).
var tanks = [];
// Incrementing index into 'tanks' array specifying whose turn it is.
var turn = 0;

// 2D axial grid of hexagons.
var grid = [];

// Number of milliseconds between two turns of a player.
var SPEED = 500;

// On page load, initialize the event handlers and draw the grid.
function init() {
  fixLinks();

  var m = document.cookie.match(/difficulty=([012])/);
  var difficultyIndex = m ? m[1] : 0;
  //SPEED = [0.7, 1, 2][difficultyIndex];
  var difficultySelect = document.getElementById('difficulty');
  difficultySelect.selectedIndex = difficultyIndex;
  difficultySelect.addEventListener('change', setDifficulty);

  document.addEventListener('keydown', keyDown);
  document.addEventListener('keyup', keyUp);

  initGrid();

  tanks.push(new Tank(1));
  tanks.push(new Tank(2));
  setInterval(clock, SPEED / tanks.length);
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
          x === startX || x === endX - 1 ||
          Math.random() < 0.05) {
        row[x].setWall();
      }
    }
    grid[y] = row;
  }
}

// Handle a tank's turn.
function clock() {
  var tank = tanks[turn];
  if (turn === 0) {
    if (keyStatus[1] && keyStatus[2]) {
      tank.move();
    } else if (keyStatus[1]) {
      tank.turn(-1);
    } else if (keyStatus[2]) {
      tank.turn(1);
    }
  } else if (turn === 1) {
    if (keyStatus[8] && keyStatus[9]) {
      tank.move();
    } else if (keyStatus[8]) {
      tank.turn(-1);
    } else if (keyStatus[9]) {
      tank.turn(1);
    }
  }
  // Increment the turn, wrapping to 0 as needed.
  turn++;
  if (turn >= tanks.length) {
    turn = 0;
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
  if (keyStatus.hasOwnProperty(e.key)) {
    keyStatus[e.key] = true;
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
  this.empty = true;
}

// Convert this hexagon into a wall.
Hex.prototype.setWall = function() {
  this.empty = false;
  this.element.classList.add('gridWall');
};

// Constructor for a new tank.
// Player number should be 1-3 and determines tank's colour.
function Tank(playerNumber) {
  var element = document.createElementNS(SVG_NS, 'polygon');
  element.setAttribute('points', this.PATH);
  element.setAttribute('class', 'tank player' + playerNumber);
  var g = document.getElementById('landscape');
  g.appendChild(element);

  do {
    var y = Math.floor(Math.random() * grid.length);
    var xKeys = Object.keys(grid[y]);
    var xIndex = Math.floor(Math.random() * xKeys.length);
    var x = Number(xKeys[xIndex]);
  } while (!grid[y][x].empty);
  grid[y][x].empty = false;

  this.hexX = x;
  this.hexY = y;
  this.direction = Math.floor(Math.random() * 6);
  this.directionDegrees = 0;
  this.element = element;
  this.render(false);
}

// Path for drawing a tank's shape.  Centered on 0,0.
Tank.prototype.PATH = '0,-2 2,2 0,1 -2,2';
// Size to visually scale a tank.
Tank.prototype.SCALE = 5;

// Draw the tank on the playing field.
Tank.prototype.render = function(animate) {
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
    requestAnimationFrame(this.animate.bind(this));
  } else {
    this.translateXNow = this.translateXFinal;
    this.translateYNow = this.translateYFinal;
    this.rotateNow = this.rotateFinal;
    this.setTransforms();
  }
};

// Set the SVG transforms for a tank.
Tank.prototype.setTransforms = function() {
  var translate = 'translate(' + this.translateXNow + ',' + this.translateYNow + ')';
  var rotate = 'rotate(' + this.rotateNow + ')';
  var scale = 'scale(' + this.SCALE + ')';
  this.element.setAttribute('transform', translate + ' ' + rotate + ' ' + scale);
};

// Animate one frame of movement of the tank from where it is towards its
// final position.
Tank.prototype.animate = function(timestamp) {
  if (this.animateStart === undefined) {
    this.animateStart = timestamp;
  }
  var maxElapsed = SPEED * 0.8;
  var elapsed = Math.min(timestamp - this.animateStart, maxElapsed);
  var ratio = elapsed / maxElapsed;
  this.translateXNow = (this.translateXFinal - this.translateXStart) * ratio + this.translateXStart;
  this.translateYNow = (this.translateYFinal - this.translateYStart) * ratio + this.translateYStart;
  this.rotateNow = (this.rotateFinal - this.rotateStart) * ratio + this.rotateStart;

  this.setTransforms();
  if (ratio < 1) {
    requestAnimationFrame(this.animate.bind(this));
  } else {
    this.animateStart = undefined;
  }
};

// Update the tank's coordinates to move forwards.
Tank.prototype.move = function() {
  var dxy = dirToDelta(this.direction);
  var newX = this.hexX + dxy.x;
  var newY = this.hexY + dxy.y;
  var newHex = grid[newY][newX];
  if (!newHex || !newHex.empty) {
    return;
  }
  grid[this.hexY][this.hexX].empty = true;
  this.hexX = newX;
  this.hexY = newY;
  grid[this.hexY][this.hexX].empty = false;
  this.render(true);
};

// Update the tank's direction to move clockwise or counter-clockwise.
Tank.prototype.turn = function(dir) {
  this.direction += dir;
  if (this.direction < 0) {
    this.direction += 6;
  } else if (this.direction >= 6) {
    this.direction -= 6;
  }
  this.render(true);
};
