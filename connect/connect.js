/**
 * @license
 * Copyright 2020 Neil Fraser
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @fileoverview Tic Tac Toe.
 * @author root@neil.fraser.name (Neil Fraser)
 */
'use strict';

// Height times width (not counting borders) must be even.
var HEIGHTS = [6, 8, 10];
var WIDTHS = [8, 12, 16];
// Number of rows (plus a border top and bottom).
var HEIGHT;
// Number of columns (plus a border left and right).
var WIDTH;

// Saturation: 80
// Value: 80
var COLOURS_10 = [
  '#7a7a7a',   // Saturation: 0, Value 48
  '#cc2929',  // Hue: 0
  '#cc7a29',  // Hue: 30
  '#ccb129',  // Hue: 50
  '#29cc29',  // Hue: 120
  '#29cccc',  // Hue: 180
  '#295fcc',  // Hue: 220
  '#2929cc',  // Hue: 240
  '#7a29cc',  // Hue: 270
  '#cc29cc'   // Hue: 300
];

var CHARACTERS_10 = '0123456789';

var COLOURS_26 = [
  '#cc2929',  // Hue: 0
  '#cc5229',  // Hue: 15
  '#cc7a29',  // Hue: 30
  '#cc9629',  // Hue: 40
  '#ccb129',  // Hue: 50
  '#88cc29',  // Hue: 85
  '#5fcc29',  // Hue: 100
  '#29cc29',  // Hue: 120
  '#29cc7a',  // Hue: 150
  '#29cccc',  // Hue: 180
  '#2996cc',  // Hue: 200
  '#295fcc',  // Hue: 220
  '#2944cc',  // Hue: 230
  '#2929cc',  // Hue: 240
  '#5229cc',  // Hue: 255
  '#7a29cc',  // Hue: 270
  '#a329cc',  // Hue: 285
  '#cc29cc',  // Hue: 300
  '#cc29a3',  // Hue: 315
  '#cc297a',  // Hue: 330
  '#cc2952',  // Hue: 345
  '#adadad',  // Saturation: 0, Value 68
  '#949494',  // Saturation: 0, Value 58
  '#7a7a7a',  // Saturation: 0, Value 48
  '#616161',  // Saturation: 0, Value 38
  '#474747'   // Saturation: 0, Value 28
];

var CHARACTERS_26 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

var COLOURS, CHARACTERS;

// Height and width of one cell.
var CELL_SIZE = 50;

// 2D array for the board.
var board = [];

// X/Y coordinates of currently selected cell.
var selected = null;

var MAX_PATH_CORNERS = 2;

function init() {
  fixLinks();

  var m = document.cookie.match(/difficulty=([012])/);
  var difficulty = Number(m ? m[1] : 1);
  document.getElementById('difficulty').selectedIndex = difficulty;
  registerOptions('difficulty');
  COLOURS = [COLOURS_10, COLOURS_26, COLOURS_26][difficulty];
  CHARACTERS = [CHARACTERS_10, CHARACTERS_26, CHARACTERS_26][difficulty];
  HEIGHT = HEIGHTS[difficulty] + 2;
  WIDTH = WIDTHS[difficulty] + 2;

  var canvas = document.getElementById('canvas');
  canvas.addEventListener('click', onClick);
  canvas.setAttribute('height', HEIGHT * CELL_SIZE);
  canvas.setAttribute('width', WIDTH * CELL_SIZE);

  document.getElementById('start').addEventListener('click', startGame);
  startGame();
}
window.addEventListener('load', init);

function initBoard() {
  var emptyCells = [];
  board.length = 0;
  for (var y = 0; y < HEIGHT; y++) {
    board[y] = [];
    for (var x = 0; x < WIDTH; x++) {
      board[y][x] = -1;
      if (x > 0 && y > 0 && x < WIDTH - 1 && y < HEIGHT - 1) {
        // Playable cells.
        emptyCells.push({x: x, y: y});
      }
    }
  }
  // Randomize the order of the empty cells, then pair them up.
  shuffle(emptyCells);
  for (var i = 0; i < emptyCells.length; i += 2) {
    var colour = Math.floor(Math.random() * COLOURS.length);
    var cell1 = emptyCells[i];
    var cell2 = emptyCells[i + 1];
    if (cell1 && cell2) {
      board[cell1.y][cell1.x] = colour;
      board[cell2.y][cell2.x] = colour;
    }
  }
}

function drawBoard() {
  var canvas = document.getElementById('canvas');
  canvas.width = canvas.width;  // Clear the canvas.
  var ctx = canvas.getContext('2d');
  ctx.font = '36px monospace';

  for (var y = 0; y < HEIGHT; y++) {
    for (var x = 0; x < WIDTH; x++) {
      var colour = board[y][x];
      ctx.fillStyle = colour === -1 ? '#fff' : COLOURS[colour];
      var xy = cellCoordinates(x, y);
      ctx.fillRect(xy.x - CELL_SIZE / 2 - 1, xy.y - CELL_SIZE / 2 - 1,
                   CELL_SIZE - 2, CELL_SIZE - 2);
      ctx.fillStyle = '#bbb';
      ctx.fillRect(xy.x - CELL_SIZE / 2 - 3, xy.y - CELL_SIZE / 2 - 3,
                   2, 2);
      if (colour !== -1) {
        var character = CHARACTERS[colour];
        if ((x + y + colour) % 2) {
          character = character.toLowerCase();
        }
        ctx.fillStyle = '#fff';
        ctx.fillText(character, xy.x - 12, xy.y + 10);
      }
    }
  }

  if (selected) {
    ctx.strokeStyle = '#ccc';
    ctx.lineWidth = 5;
    var xy = cellCoordinates(selected.x, selected.y);
    ctx.strokeRect(xy.x - CELL_SIZE / 2 - 1, xy.y - CELL_SIZE / 2 - 1,
                   CELL_SIZE - 2, CELL_SIZE - 2);
  }
}

// Show the start button.
function showStart() {
  document.body.className = '';
  var startButton = document.getElementById('start');
  startButton.style.display = 'block';
}

// Hide the start button, and start the game.
function startGame() {
  var startButton = document.getElementById('start');
  startButton.style.display = 'none';
  initBoard();
  drawBoard();
  checkMoves();
}

function drawPath(path) {
  var canvas = document.getElementById('canvas');
  var ctx = canvas.getContext('2d');
  var point = cellCoordinates(path[0].x, path[0].y);
  ctx.beginPath();
  ctx.moveTo(point.x, point.y);
  for (var i = 1; i < path.length; i++) {
    point = cellCoordinates(path[i].x, path[i].y);
    ctx.lineTo(point.x, point.y);
  }
  ctx.strokeStyle = '#888';
  ctx.lineWidth = 1;
  ctx.stroke();
}

// Return the canvas coordinates for the center of the specified cell.
function cellCoordinates(x, y) {
  var canvasX = (x + 0.5) * CELL_SIZE;
  var canvasY = (y + 0.5) * CELL_SIZE;
  return {x: canvasX, y: canvasY};
}

function onClick(e) {
  var element = document.getElementById('canvas');
  // Compute the X/Y cell coordinates of the click.
  var rect = element.getBoundingClientRect();
  var x = Math.floor((e.clientX - rect.left) / CELL_SIZE);
  var y = Math.floor((e.clientY - rect.top) / CELL_SIZE);

  var isLiveCell = isValidCoords(x, y) && (board[y][x] !== -1);
  if (!selected && isLiveCell) {
    selected = {x: x, y: y};
  } else {
    if (isLiveCell) {
      // There's a selected cell, and the user clicked on a cell.
      if (board[selected.y][selected.x] === board[y][x] &&
          !(selected.x === x && selected.y === y)) {
        // Both cells are the same colour.
        var path = findPath(selected.x, selected.y, x, y);
        if (path) {
          board[selected.y][selected.x] = -1;
          board[y][x] = -1;
          checkMoves();
        }
      }
    }
    selected = null;
  }
  drawBoard();
  if (path) {
    drawPath(path);
  }
}

function isValidCoords(x, y) {
  return x >= 0 && y >= 0 && x < WIDTH && y < HEIGHT;
}

function checkMoves() {
  var count = 0;
  var groups = [];
  for (var y = 1; y < HEIGHT - 1; y++) {
    for (var x = 1; x < WIDTH - 1; x++) {
      var colour = board[y][x];
      if (colour === -1) {
        continue;
      }
      if (!groups[colour]) {
        groups[colour] = [];
      }
      groups[colour].push({x: x, y: y});
    }
  }
  if (groups.length) {
    for (var g = 0; g < groups.length; g++) {
      var group = groups[g];
      if (!group) {
        continue;
      }
      for (var i = 0; i < group.length - 1; i++) {
        for (var j = i + 1; j < group.length; j++) {
          if (findPath(group[i].x, group[i].y, group[j].x, group[j].y)) {
            count++;
          }
        }
      }
    }
    if (count === 0) {
      document.getElementById('crash').play();
      document.body.className = 'shake';
      setTimeout(showStart, 1000);
    }
  } else {
    document.getElementById('win').play();
    setTimeout(showStart, 1000);
  }
  document.getElementById('possibleMoves').textContent = count;
}

// X/Y deltas for each direction.
var deltas = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1]
];

function findPath(x1, y1, x2, y2) {
  var queue = [];
  queue.push({path: [{x: x1, y: y1}], corners: MAX_PATH_CORNERS});
  while (queue.length) {
    var state = queue.shift();
    var xy = state.path[state.path.length - 1];
    var newCorners = state.corners - 1;
    // For each direction...
    for (var i = 0; i < deltas.length; i++) {
      // Try moving forward...
      var newPath = state.path.slice();
      var cursorX = xy.x;
      var cursorY = xy.y;
      while (true) {
        cursorX += deltas[i][0];
        cursorY += deltas[i][1];
        newPath.push({x: cursorX, y: cursorY});
        if (!isValidCoords(cursorX, cursorY)) {
          // Ran off the board.
          break;
        }
        if (cursorX === x2 && cursorY === y2) {
          // Found a path.
          return newPath;
        }
        if (board[cursorY][cursorX] !== -1) {
          // This is not a free space.
          break;
        }
        if (newCorners >= 0) {
          queue.push({path: newPath.slice(), corners: newCorners});
        }
      }
    }
  }
  return null;
}

// Randomize the order of an array in place.  Copied from goog.array.shuffle
function shuffle(arr) {
  for (var i = arr.length - 1; i > 0; i--) {
    // Choose a random array index in [0, i] (inclusive with i).
    var j = Math.floor(Math.random() * (i + 1));
    var tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
}
