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

// Array of snake objects.
var snakes = [];

// Currently running snake.
var snakeIndex = 0;

// Running task for executing steps.
var pid;

// Is the game running?
var isRunning = false;

// Is there a second player?
var player2 = false;

// On page load, initialize the event handlers and show the start button.
function init() {
  fixLinks();

  var m = document.cookie.match(/difficulty=([012345])/);
  var difficultyIndex = m ? m[1] : 0;
  SPEED = [400, 200, 100][difficultyIndex % 3];
  player2 = difficultyIndex >= 3;
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
  var classes = ['food', 'snake', 'player1', 'player2',
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
  snakes.length = 0;
  var snake = new Snake(1);
  snake.direction = directions.RIGHT;
  snakes.push(snake);
  snake.setHead(Math.floor(WIDTH / 2) - 2, Math.floor(HEIGHT / 2) - 1);

  if (player2) {
    snake = new Snake(2);
    snake.direction = directions.LEFT;
    snakes.push(snake);
    snake.setHead(Math.floor(WIDTH / 2) + 2, Math.floor(HEIGHT / 2) + 1);
  }
  // Start snake with a length of three (one head, plus two steps),
  for (var i = 0; i < snakes.length; i++) {
    snakes[i].step(true);
    snakes[i].step(true);
    snakes[i].step(false);
  }
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
  isRunning = true;
  pid = setInterval(step, SPEED / snakes.length);
}

// Step the next snake.
function step() {
  snakeIndex++;
  if (snakeIndex >= snakes.length) {
    snakeIndex = 0;
  }
  snakes[snakeIndex].step();
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

// User has crashed, end the game.
function crash() {
  clearInterval(pid);
  isRunning = false;
  document.body.className = 'shake';
  document.getElementById('crash').play();
  setTimeout(showStart, 1000);
}

// Get the TD element for the given coordinates.
function getCell(xy) {
  return document.getElementById(xy[0] + '_' + xy[1]);
}

// Player is changing directions using the keyboard.
function keydown(e) {
  if (e.repeat || !isRunning) {
    return;
  }
  switch (e.key) {
    case 'ArrowLeft':
      snakes[0].pushDirection(directions.LEFT);
      break;
    case 'ArrowRight':
      snakes[0].pushDirection(directions.RIGHT);
      break;
    case 'ArrowUp':
      snakes[0].pushDirection(directions.UP);
      break;
    case 'ArrowDown':
      snakes[0].pushDirection(directions.DOWN);
      break;
    case 'a':
    case 'A':
      if (player2) {
        snakes[1].pushDirection(directions.LEFT);
      }
      break;
    case 'd': // Qwerty
    case 'D':
    case 'e': // Dvorak
    case 'E':
      if (player2) {
        snakes[1].pushDirection(directions.RIGHT);
      }
      break;
    case 'w': // Qwerty
    case 'W':
    case ',': // Dvorak
    case '<':
      if (player2) {
        snakes[1].pushDirection(directions.UP);
      }
      break;
    case 's': // Qwerty
    case 'S':
    case 'o': // Dvorak
    case 'O':
      if (player2) {
        snakes[1].pushDirection(directions.DOWN);
      }
      break;
    default:
      return;
  }
  e.preventDefault();
}

function Snake(playerNumber) {
  // Array of X/Y coordinates for the snake.
  // The head is the last element.  The tail is the first (0).
  this.coordinates = [];
  // Current direction of snake (0-3).
  this.direction = directions.UP;
  // Queue of pending keystrokes for direction changes (for human players).
  this.directionQueue = [];
  // Yellow or blue snake.
  this.playerClass = 'player' + playerNumber;
}

// Set the snake's head to the given coordinates.
// Returns the result of this move (crash, food or free).
Snake.prototype.setHead = function(x, y) {
  var newHead = getCell([x, y]);
  if (newHead.classList.contains('border') ||
      newHead.classList.contains('snake')) {
    return moveResult.CRASH;
  }
  if (this.coordinates.length) {
    var oldHeadXY = this.coordinates[this.coordinates.length - 1];
    var oldHead = getCell(oldHeadXY);
    oldHead.classList.remove('head');
    oldHead.classList.add('body');
  }
  newHead.classList.add('dir-' + this.direction);
  newHead.classList.add('head');
  newHead.classList.add('snake');
  newHead.classList.add(this.playerClass);
  this.coordinates.push([x, y]);
  if (newHead.classList.contains('food')) {
    newHead.classList.remove('food');
    return moveResult.FOOD;
  }
  return moveResult.FREE;
};

// Move the head in the given direction.
// Returns the result of this move (crash, food or free).
Snake.prototype.moveHead = function(dxy) {
  var headXY = this.coordinates[this.coordinates.length - 1];
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
  return this.setHead(x, y);
};

// Execute a single step.
// If 'initialGrow' is present and true, let the snake grow by one.
Snake.prototype.step = function(initialGrow) {
  var ccw = undefined;
  var newDirection = this.directionQueue.shift();
  if (newDirection !== undefined && newDirection !== this.direction) {
    ccw =
        (this.direction === directions.LEFT && newDirection === directions.DOWN) ||
        (this.direction === directions.DOWN && newDirection === directions.RIGHT) ||
        (this.direction === directions.RIGHT && newDirection === directions.UP) ||
        (this.direction === directions.UP && newDirection === directions.LEFT);
    this.direction = newDirection;
  }
  var oldHeadXY = this.coordinates[this.coordinates.length - 1];
  var oldHeadCell = getCell(oldHeadXY);
  var result = this.moveHead(deltas[this.direction]);
  if (result == moveResult.CRASH) {
    crash();
    return;
  } else if (result == moveResult.FOOD) {
    document.getElementById('apple').play();
    addFood();
  } else if (result == moveResult.FREE && !initialGrow) {
    var oldTail = this.coordinates.shift();
    var oldTailCell = getCell(oldTail);
    clearCell(oldTailCell);
    var newTail = this.coordinates[0];
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
    var newHeadXY = this.coordinates[this.coordinates.length - 1];
    var newHeadXY = getCell(newHeadXY);
    for (var d = 0; d < 4; d++) {
      oldHeadCell.classList.remove('dir-' + d);
      if (newHeadXY.classList.contains('dir-' + d)) {
        oldHeadCell.classList.add('dir-' + d);
      }
    }
  }
};

// Add the player's new direction to the queue of direction changes.
Snake.prototype.pushDirection = function(newDirection) {
  var last = this.directionQueue[this.directionQueue.length - 1];
  if (last === undefined) {
    last = this.direction;
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
    this.directionQueue.push(newDirection);
  }
};
