/**
 * @license
 * Copyright 2020 Neil Fraser
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @fileoverview Connect.
 * @author root@neil.fraser.name (Neil Fraser)
 */
'use strict';

// Height times width (not counting borders) should be even.
// For Easy/Normal/Hard modes.
var HEIGHTS = [5, 7, 9];
var WIDTHS = [8, 12, 16];
// Number of rows (plus a border top and bottom).
var HEIGHT;
// Number of columns (plus a border left and right).
var WIDTH;

// List of hues for numbers in Easy mode.
var HUES_EASY = [
  5, 30, 50, 120, 180, 210, 240, 260, 290, 325
];

var COLOURS_NUMERIC_HARD = [
  '#333', '#444', '#555', '#666', '#777', '#888', '#999', '#aaa', '#bbb', '#ccc'
];

// List of characters for Easy mode.
var CHARACTERS_NUMERIC = '0123456789';

// List of characters for Normal and Hard modes.
var CHARACTERS_ALPHA = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

// List of colours and characters to be used.
var COLOURS, CHARACTERS;

// Height and width of one cell.
var CELL_SIZE = 50;

// 2D array for the board.
var board = [];

// X/Y coordinates of currently selected cell.
var selected = null;

// Maximum number of corners that the connection path may have.
var MAX_PATH_CORNERS = 2;

// Start-up initialization code.  Run once.
function init() {
  fixLinks();
  var SATURATION = 0.8;
  var VALUE = 0.8 * 256;

  // Configure difficulty mode.
  var m = document.cookie.match(/difficulty=([012])/);
  var difficulty = Number(m ? m[1] : 0);
  document.getElementById('difficulty').selectedIndex = difficulty;
  registerOptions('difficulty');
  if (difficulty === 0) {
    // Easy mode has colourful numbers.
    COLOURS = [];
    for (var i = 0; i < HUES_EASY.length; i++) {
      COLOURS.push(hsvToHex(HUES_EASY[i], SATURATION, VALUE));
    }
    CHARACTERS = CHARACTERS_NUMERIC;
  } else {
    // Normal mode has colourful letters.
    COLOURS = [];
    for (var i = 0; i < CHARACTERS_ALPHA.length; i++) {
      COLOURS.push(hsvToHex(i / CHARACTERS_ALPHA.length * 360, SATURATION, VALUE));
    }
    CHARACTERS = CHARACTERS_ALPHA;
    if (difficulty === 2) {
      // Hard mode also has greyscale numbers.
      COLOURS = COLOURS.concat(COLOURS_NUMERIC_HARD);
      CHARACTERS += CHARACTERS_NUMERIC;
    }
  }
  // Set size, and add border around the board for path routing.
  HEIGHT = HEIGHTS[difficulty] + 2;
  WIDTH = WIDTHS[difficulty] + 2;

  // Initialize the canvas.
  var canvas = document.getElementById('canvas');
  canvas.addEventListener('click', onClick);
  canvas.setAttribute('height', HEIGHT * CELL_SIZE);
  canvas.setAttribute('width', WIDTH * CELL_SIZE);

  // Start button is only for restart in this game, but add event handler now.
  document.getElementById('start').addEventListener('click', startGame);
  startGame();
}
window.addEventListener('load', init);

// Initalize the data structure that represents the board.
function initBoard() {
  var emptyCells = [];
  board.length = 0;
  for (var y = 0; y < HEIGHT; y++) {
    board[y] = [];
    for (var x = 0; x < WIDTH; x++) {
      // Set every cell to be blank.
      board[y][x] = -1;
      if (x > 0 && y > 0 && x < WIDTH - 1 && y < HEIGHT - 1) {
        // Build array of playable cells.
        emptyCells.push({x: x, y: y});
      }
    }
  }
  // Randomize the order of the empty cells, then pair them up.
  shuffle(emptyCells);
  for (var i = 0; i < emptyCells.length; i += 2) {
    // Assign a random colour to each pair.
    var colour = Math.floor(Math.random() * COLOURS.length);
    var cell1 = emptyCells[i];
    var cell2 = emptyCells[i + 1];
    if (cell1 && cell2) {
      board[cell1.y][cell1.x] = colour;
      board[cell2.y][cell2.x] = colour;
    }
  }
}

// Clear the canvas and redraw everything.
function drawBoard() {
  var canvas = document.getElementById('canvas');
  canvas.width = canvas.width;  // Clear the canvas.
  var ctx = canvas.getContext('2d');
  ctx.font = '36px monospace';

  for (var y = 0; y < HEIGHT; y++) {
    for (var x = 0; x < WIDTH; x++) {
      // Draw the cell.
      var colour = board[y][x];
      ctx.fillStyle = colour === -1 ? '#fff' : COLOURS[colour];
      var xy = cellCoordinates(x, y);
      ctx.fillRect(xy.x - CELL_SIZE / 2 - 1, xy.y - CELL_SIZE / 2 - 1,
                   CELL_SIZE - 2, CELL_SIZE - 2);
      // Draw a small dot in the upper left corner.  Forms a grid.
      ctx.fillStyle = '#bbb';
      ctx.fillRect(xy.x - CELL_SIZE / 2 - 3, xy.y - CELL_SIZE / 2 - 3,
                   2, 2);
      if (colour !== -1) {
        // Print the character for this non-empty cell.
        var character = CHARACTERS[colour];
        if ((x + y + colour) % 2) {
          // Randomly (but deterministically) make half the letters lowercase.
          character = character.toLowerCase();
        }
        ctx.fillStyle = '#fff';
        ctx.fillText(character, xy.x - 12, xy.y + 10);
      }
    }
  }

  // If a cell is selected, draw the selection border.
  if (selected) {
    ctx.strokeStyle = '#ccc';
    ctx.lineWidth = 5;
    var xy = cellCoordinates(selected.x, selected.y);
    ctx.strokeRect(xy.x - CELL_SIZE / 2 - 1, xy.y - CELL_SIZE / 2 - 1,
                   CELL_SIZE - 2, CELL_SIZE - 2);
  }
}

// Game ended.  Show the start button.
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

// Draw a path from one cell to another using the provided array of coordinates.
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

// User clicked on the canvas.
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

// Are the provided coordinates within the board (including the one-cell border)?
function isValidCoords(x, y) {
  return x >= 0 && y >= 0 && x < WIDTH && y < HEIGHT;
}

// Compute and display the number of possible moves.
// End game if there aren't any (either because of win or loss).
function checkMoves() {
  // Build array of all remaining cells with a colour.
  // Array X/Y locations of all the 'A's, all the 'B's, etc.
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
  var count = 0;
  if (groups.length) {
    // For each pair in the group, determine if there is a path between them.
    // Don't count any pair twice.
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
      // There are groups, but no paths.  Sorry, game over.
      document.getElementById('crash').play();
      document.body.className = 'shake';
      setTimeout(showStart, 1000);
    }
  } else {
    // No groups.  The board has been cleared.  Game over.
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

// Find a path from x1/y1 to x2/y2.  Limited by MAX_PATH_CORNERS.
// Only navigate across empty cells.  Use a breadth-first search.
// Return list of coordinates for path, or null if none.
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

/**
 * Converts an HSV triplet to hex representation.
 * @param {number} h Hue value in [0, 360].
 * @param {number} s Saturation value in [0, 1].
 * @param {number} v Brightness in [0, 255].
 * @return {string} Hex representation of the colour.
 * Copied from Blockly.utils.colour.hsvToHex and Blockly.utils.colour.rgbToHex
 */
function hsvToHex(h, s, v) {
  var red = 0;
  var green = 0;
  var blue = 0;
  if (s == 0) {
    red = v;
    green = v;
    blue = v;
  } else {
    var sextant = Math.floor(h / 60);
    var remainder = (h / 60) - sextant;
    var val1 = v * (1 - s);
    var val2 = v * (1 - (s * remainder));
    var val3 = v * (1 - (s * (1 - remainder)));
    switch (sextant) {
      case 1:
        red = val2;
        green = v;
        blue = val1;
        break;
      case 2:
        red = val1;
        green = v;
        blue = val3;
        break;
      case 3:
        red = val1;
        green = val2;
        blue = v;
        break;
      case 4:
        red = val3;
        green = val1;
        blue = v;
        break;
      case 5:
        red = v;
        green = val1;
        blue = val2;
        break;
      case 6:
      case 0:
        red = v;
        green = val3;
        blue = val1;
        break;
    }
  }
  red = Math.floor(red);
  green = Math.floor(green);
  blue = Math.floor(blue);
  var rgb = (red << 16) | (green << 8) | blue;
  if (red < 0x10) {
    return '#' + (0x1000000 | rgb).toString(16).substr(1);
  }
  return '#' + rgb.toString(16);
}
