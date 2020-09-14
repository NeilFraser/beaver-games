/**
 * @license
 * Copyright 2020 Neil Fraser
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @fileoverview Snake game.
 * @author root@neil.fraser.name (Neil Fraser)
 */
'use strict';


// Height and width of playing board.
var HEIGHT = 20;
var WIDTH = 30;

// Queue of pending keystrokes for direction changes.
var directionQueue = [];

// Enum of directions.  The integer values map into the 'deltas' array.
var directions = {
  LEFT: 0,
  RIGHT: 1,
  UP: 2,
  DOWN: 3
};

// X/Y deltas for each direction.
var deltas = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1]
];

// Enum of results for a move.
var moveResult = {
  FREE: 0,
  FOOD: 1,
  CRASH: 2
};

// Milliseconds between each step.
var SPEED;

// Current direction of player.
var playerDirection;

// Array of X/Y coordinates for the player's snake.
// The head is the last element.  The tail is the first (0).
var snakeCoordinates = [];

// Running task for executing steps.
var pid;

// Is the human's snake alive?
var isHumanAlive = false;

// On page load, initialize the event handlers and show the start button.
function init() {
  fixLinks();

  var m = document.cookie.match(/difficulty=([012])/);
  var difficultyIndex = m ? m[1] : 0;
  SPEED = [400, 200, 100][difficultyIndex];
  var difficultySelect = document.getElementById('difficulty');
  difficultySelect.selectedIndex = difficultyIndex;
  difficultySelect.addEventListener('change', setDifficulty);

  injectTable();
  initBorders();
  document.getElementById('start').addEventListener('click', startGame);

  document.addEventListener('keydown', keydown);
  document.addEventListener('keypress', keyPress);
}
window.addEventListener('load', init);

// Create the DOM for the playing board.  Only done one.
function injectTable() {
  var count = 0;
  var table = document.getElementById('grid');
  for (var y = 0; y < HEIGHT; y++) {
    var tr = document.createElement('tr');
    for (var x = 0; x < WIDTH; x++) {
      count++;
      var td = document.createElement('td');
      td.id = x + '_' + y;
      td.className = ((x + y) % 2) ? 'even' : 'odd';
      tr.appendChild(td);
    }
    table.appendChild(tr);
  }
}

// Create the borders.  Only done once.
function initBorders() {
  var doorWidth = 3;  // Approximately one half the width of the door.
  for (var x = 0; x < WIDTH; x++) {
    if (Math.abs(x - WIDTH / 2) < doorWidth) {
      continue;
    }
    getCell([x, 0]).className = 'border';
    getCell([x, HEIGHT - 1]).className = 'border';
  }
  for (var y = 1; y < HEIGHT - 1; y++) {
    if (Math.abs(y - HEIGHT / 2) < doorWidth) {
      continue;
    }
    getCell([WIDTH - 1, y]).className = 'border';
    getCell([0, y]).className = 'border';
  }
}

// Clear temporary CSS classes (e.g. snake, food) from a cell.
// Preserve permanent CSS classes (e.g. even/odd, border).
function clearCell(td) {
  var classes = ['food', 'snake',
    'dir-0', 'dir-1', 'dir-2', 'dir-3',
    'head', 'body', 'turn-ccw', 'turn-cw', 'tail'];
  for (var i = 0; i < classes.length; i++) {
    td.classList.remove(classes[i]);
  }
}

// Clear any existing data, and configure a new game.
function resetGame() {
  for (var y = 0; y < HEIGHT; y++) {
    for (var x = 0; x < WIDTH; x++) {
      clearCell(getCell([x, y]));
    }
  }
  playerDirection = directions.RIGHT;
  snakeCoordinates.length = 0;
  setHead(Math.floor(WIDTH / 2) - 2, Math.floor(HEIGHT / 2));
  // Start snake with a length of three (one head, plus two steps),
  step(true);
  step(true);
  step(false);
  // Start with two foods on the board.
  addFood();
  addFood();
}

// Human pressed space or enter to start game.
function keyPress(e) {
  if (e.key === 'Enter' || e.key === ' ') {
    if (document.getElementById('start').style.display !== 'none') {
      startGame();
      e.preventDefault();
    }
  }
}

// Show the start button and disable the controls.
function showStart() {
  document.body.className = '';
  var startButton = document.getElementById('start');
  startButton.style.display = '';
}

// Hide the start button, and start the interval.
function startGame() {
  resetGame();
  var startButton = document.getElementById('start');
  startButton.style.display = 'none';
  isHumanAlive = true;
  pid = setInterval(step, SPEED);
}

// Add an new food square somewhere randomly on the board.
function addFood() {
  do {
    var x = Math.floor(Math.random() * WIDTH);
    var y = Math.floor(Math.random() * HEIGHT);
    var cell = getCell([x, y]);
  } while (cell.classList.contains('border') ||
           cell.classList.contains('snake') ||
           cell.classList.contains('food'));
  // Note: the game will crash if there are zero free squares.
  cell.classList.add('food');
}

// Set the snake's head to the given coordinates.
// Returns the result of this move (crash, food or free).
function setHead(x, y) {
  var newHead = getCell([x, y]);
  if (newHead.classList.contains('border') ||
      newHead.classList.contains('snake')) {
    return moveResult.CRASH;
  }
  if (snakeCoordinates.length) {
    var oldHeadXY = snakeCoordinates[snakeCoordinates.length - 1];
    var oldHead = getCell(oldHeadXY);
    oldHead.classList.remove('head');
    oldHead.classList.add('body');
  }
  newHead.classList.add('dir-' + playerDirection);
  newHead.classList.add('head');
  newHead.classList.add('snake');
  snakeCoordinates.push([x, y]);
  if (newHead.classList.contains('food')) {
    newHead.classList.remove('food');
    return moveResult.FOOD;
  }
  return moveResult.FREE;
}

// Move the head in the given direction.
// Returns the result of this move (crash, food or free).
function moveHead(dxy) {
  var headXY = snakeCoordinates[snakeCoordinates.length - 1];
  var x = headXY[0] + dxy[0];
  var y = headXY[1] + dxy[1];
  if (x < 0) {
    x += WIDTH;
  } else if (x >= WIDTH) {
    x -= WIDTH;
  }
  if (y < 0) {
    y += HEIGHT;
  } else if (y >= HEIGHT) {
    y -= HEIGHT;
  }
  return setHead(x, y);
}

// User has crashed, end the game.
function crash() {
  clearInterval(pid);
  isHumanAlive = false;
  document.body.className = 'shake';
  document.getElementById('crash').play();
  setTimeout(showStart, 1000);
}

// Get the TD element for the given coordinates.
function getCell(xy) {
  return document.getElementById(xy[0] + '_' + xy[1]);
}

// Execute a single step.
// If 'initialGrow' is present and true, let the snake grow by one.
function step(initialGrow) {
  var ccw = undefined;
  var newDirection = directionQueue.shift();
  if (newDirection !== undefined && newDirection !== playerDirection) {
    ccw =
        (playerDirection === directions.LEFT && newDirection === directions.DOWN) ||
        (playerDirection === directions.DOWN && newDirection === directions.RIGHT) ||
        (playerDirection === directions.RIGHT && newDirection === directions.UP) ||
        (playerDirection === directions.UP && newDirection === directions.LEFT);
    playerDirection = newDirection;
  }
  var oldHeadXY = snakeCoordinates[snakeCoordinates.length - 1];
  var oldHeadCell = getCell(oldHeadXY);
  var result = moveHead(deltas[playerDirection]);
  if (result == moveResult.CRASH) {
    crash();
    return;
  } else if (result == moveResult.FOOD) {
    document.getElementById('apple').play();
    addFood();
  } else if (result == moveResult.FREE && !initialGrow) {
    var oldTail = snakeCoordinates.shift();
    var oldTailCell = getCell(oldTail);
    clearCell(oldTailCell);
    var newTail = snakeCoordinates[0];
    var newTailCell = getCell(newTail);
    newTailCell.classList.remove('body');
    newTailCell.classList.remove('turn-ccw');
    newTailCell.classList.remove('turn-cw');
    newTailCell.classList.add('tail');
  }
  if (ccw !== undefined) {
    oldHeadCell.classList.remove('body');
    oldHeadCell.classList.add(ccw ? 'turn-ccw' : 'turn-cw');
    // Turn the direction of this cell, to match the head.
    var newHeadXY = snakeCoordinates[snakeCoordinates.length - 1];
    var newHeadXY = getCell(newHeadXY);
    for (var d = 0; d < 4; d++) {
      oldHeadCell.classList.remove('dir-' + d);
      if (newHeadXY.classList.contains('dir-' + d)) {
        oldHeadCell.classList.add('dir-' + d);
      }
    }
  }
}

// Player is changing directions using the keyboard.
function keydown(e) {
  if (e.repeat || !isHumanAlive) {
    return;
  }
  switch (e.key) {
    case 'ArrowLeft':
      pushDirection(directions.LEFT);
      break;
    case 'ArrowRight':
      pushDirection(directions.RIGHT);
      break;
    case 'ArrowUp':
      pushDirection(directions.UP);
      break;
    case 'ArrowDown':
      pushDirection(directions.DOWN);
      break;
    default:
      return;
  }
  e.preventDefault();
}

// Add the player's new direction to the queue of direction changes.
function pushDirection(newDirection) {
  var last = directionQueue[directionQueue.length - 1];
  if (last === undefined) {
    last = playerDirection;
  }
  // Discard fatal 180 degree reversals.
  if ((last === directions.LEFT && newDirection === directions.RIGHT) ||
      (last === directions.RIGHT && newDirection === directions.LEFT) ||
      (last === directions.UP && newDirection === directions.DOWN) ||
      (last === directions.DOWN && newDirection === directions.UP)) {
    return;
  }
  // Only schedule changes.
  if (last !== newDirection) {
    directionQueue.push(newDirection);
  }
}
