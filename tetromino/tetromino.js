/**
 * @license
 * Copyright 2020 Neil Fraser
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @fileoverview Tetromino.
 * @author root@neil.fraser.name (Neil Fraser)
 */
'use strict';


// The game has three modes: Waiting on start button, interactive play,
// and stopped.
var modes = {
  START: -1,
  PLAYING: 0,
  STOPPED: 1
};
var mode = modes.START;

// Level to jump to when starting a game.  Set by the difficulty dropdown.
var START_LEVEL;

// Height and width of a block.
var SQUARE_SIZE = 20;

// Width of side and bottom borders.
var BORDER_WIDTH = 10;

// Number of playfield columns.
var COLUMNS = 10;
// Number of fully visible playfield rows.
var ROWS = 20;
// Partial visibility of top-most playfield row.
var TOP_ROW_HEIGHT = 5;

// SVG namespace.
var SVG_NS = 'http://www.w3.org/2000/svg';

// Directions to try kicking a rotated 'T/L/J/S/Z' shape that collides.
var STANDARD_KICKS = {
  '0>1': [[-1, 0], [-1, 1], [0,-2], [-1,-2]],
  '1>0': [[ 1, 0], [ 1,-1], [0, 2], [ 1, 2]],
  '1>2': [[ 1, 0], [ 1,-1], [0, 2], [ 1, 2]],
  '2>1': [[-1, 0], [-1, 1], [0,-2], [-1,-2]],
  '2>3': [[ 1, 0], [ 1, 1], [0,-2], [ 1,-2]],
  '3>2': [[-1, 0], [-1,-1], [0, 2], [-1, 2]],
  '3>0': [[-1, 0], [-1,-1], [0, 2], [-1, 2]],
  '0>3': [[ 1, 0], [ 1, 1], [0,-2], [ 1,-2]]
};

// Directions to try kicking a rotated 'I' shape that collides.
var I_KICKS = {
  '0>1': [[-2, 0], [ 1, 0], [-2,-1], [ 1, 2]],
  '1>0': [[ 2, 0], [-1, 0], [ 2, 1], [-1,-2]],
  '1>2': [[-1, 0], [ 2, 0], [-1, 2], [ 2,-1]],
  '2>1': [[ 1, 0], [-2, 0], [ 1,-2], [-2, 1]],
  '2>3': [[ 2, 0], [-1, 0], [ 2, 1], [-1,-2]],
  '3>2': [[-1, 0], [ 1, 0], [-2,-1], [ 1, 2]],
  '3>0': [[ 1, 0], [-2, 0], [ 1,-2], [-2, 1]],
  '0>3': [[-1, 0], [ 2, 0], [-1, 2], [ 2,-1]]
};

// Describes all seven tetromino shapes.  Each shape has four X/Y coordinate
// pairs, a centre of rotation, and optional rotation kicks.
var SHAPES = {
  'O': {
    coords: [[0, 0], [1, 0], [0, 1], [1, 1]],
    rotation: [0.5, 0.5],
    kicks: null  // 'O' can never collide when rotating.
  },
  'I': {
    coords: [[0, 1], [1, 1], [2, 1], [3, 1]],
    rotation: [1.5, 1.5],
    kicks: I_KICKS
  },
  'T': {
    coords: [[0, 1], [1, 1], [2, 1], [1, 0]],
    rotation: [1, 1],
    kicks: STANDARD_KICKS
  },
  'L': {
    coords: [[0, 1], [1, 1], [2, 1], [2, 0]],
    rotation: [1, 1],
    kicks: STANDARD_KICKS
  },
  'J': {
    coords: [[0, 1], [1, 1], [2, 1], [0, 0]],
    rotation: [1, 1],
    kicks: STANDARD_KICKS
  },
  'S': {
    coords: [[0, 1], [1, 1], [1, 0], [2, 0]],
    rotation: [1, 1],
    kicks: STANDARD_KICKS
  },
  'Z': {
    coords: [[0, 0], [1, 0], [1, 1], [2, 1]],
    rotation: [1, 1],
    kicks: STANDARD_KICKS
  }
};

// Animation frame PID for the current shape.
var currentShapePid = 0;

// Currently active O/I/T/L/J/S/Z shape.
var currentShape = null;

// Name of the next shape (O/I/T/L/J/S/Z).
var nextShapeName = '';

// 2D array of placed SVG blocks in the playing field.
var grid = [];

// PID of interval timer that periodically moves the current shape down.
var fallPid = 0;

// Number of completed lines that have been cleared so far.
var lines = 0;

// Milliseconds between move-down steps.
var speed;

// Compute the pause in milliseconds between move-down steps.
function recalculateSpeed() {
  var level = Math.ceil((lines + 1) / 10);
  level = Math.max(level, START_LEVEL);
  speed = Math.pow(0.8 - ((level - 1) * 0.007), level - 1) * 1000;
}

// Initialize the board and start the game.
function init() {
  fixLinks();

  var m = document.cookie.match(/difficulty=([012])/);
  var difficultyIndex = m ? m[1] : 0;
  // Starting level for easy, normal and hard modes.
  START_LEVEL = [1, 4, 8][difficultyIndex];
  var difficultySelect = document.getElementById('difficulty');
  difficultySelect.selectedIndex = difficultyIndex;
  difficultySelect.addEventListener('change', setDifficulty);

  initSvgGrid();

  document.addEventListener('keydown', keyDown);
  document.addEventListener('keyup', keyUp);
  document.addEventListener('keypress', keyPress);
  document.getElementById('start').addEventListener('click', startGame);
  showStart();
}
window.addEventListener('load', init);

// Show the start button.
function showStart() {
  cancelAnimationFrame(currentShapePid);
  document.body.className = '';
  var startButton = document.getElementById('start');
  startButton.style.display = '';
  mode = modes.START;
}

// Hide the start button, and start the game.
function startGame() {
  var startButton = document.getElementById('start');
  startButton.style.display = 'none';

  lines = 0;
  recalculateSpeed();
  initDataGrid();
  // Delete any existing blocks.
  if (currentShape) {
    currentShape.destroy();
  }
  var matrix = document.getElementById('matrix');
  while (matrix.firstChild) {
    matrix.removeChild(matrix.firstChild);
  }
  nextShapeName = randomShapeName();
  createShape();
  currentShapePid = requestAnimationFrame(animateStep);
}

// Create new shape on the board.
function createShape() {
  currentShape = new CurrentShape(nextShapeName);
  var svg = document.getElementById('shape');
  svg.appendChild(currentShape.g);
  updateNextShape();
  mode = modes.PLAYING;
  printDebug();
  // Check for "block out" game over condition (shape overlaps with blocks).
  if (currentShape.isCollided()) {
    console.log('Game over: Block out.');
    fail();
  }
  // Reset the timer so that the first turn of the new shape is whole.
  fallPid = setInterval(actionDown, speed);
  mode = modes.PLAYING;
}

// Draw the grid markers on the board.
function initSvgGrid() {
  var grid = document.getElementById('grid');
  if (!grid) throw Error('No grid SVG element found.');
  // <line class="grid" x1="19" y1="20" x2="21" y2="20"/>
  // <line class="grid" x1="20" y1="19" x2="20" y2="21"/>
  var LEN = 2;
  for (var x = 0; x <= COLUMNS; x++) {
    var matrixX = BORDER_WIDTH + x * SQUARE_SIZE;
    for (var y = 0; y <= ROWS; y++) {
      var matrixY = TOP_ROW_HEIGHT + y * SQUARE_SIZE;
      var line = document.createElementNS(SVG_NS, 'line');
      line.setAttribute('x1', matrixX - LEN);
      line.setAttribute('y1', matrixY);
      line.setAttribute('x2', matrixX + LEN);
      line.setAttribute('y2', matrixY);
      line.classList.add('grid');
      grid.appendChild(line);
      line = document.createElementNS(SVG_NS, 'line');
      line.setAttribute('x1', matrixX);
      line.setAttribute('y1', matrixY - LEN);
      line.setAttribute('x2', matrixX);
      line.setAttribute('y2', matrixY + LEN);
      line.classList.add('grid');
      grid.appendChild(line);
    }
  }
}

// Initialize the 2D data grid with nulls.
function initDataGrid() {
  grid.length = 0;
  for (var y = 0; y < ROWS + 4; y++) {
    grid[y] = newDataRow();
  }
}

function newDataRow() {
  var row = [];
  for (var x = 0; x < COLUMNS; x++) {
    row[x] = null;
  }
  return row;
}

// Constructor for shape currently in play.
var CurrentShape = function(type) {
  this.shape = SHAPES[type];
  if (!this.shape) {
    throw new Error('Unknown type: ' + type);
  }
  this.type = type;
  this.g = document.createElementNS(SVG_NS, 'g');
  this.transforms = [];
  this.coords = [];
  // Create a block at each of the four shape coordinates.
  for (var i = 0, coord; (coord = this.shape.coords[i]); i++) {
    this.coords[i] = [coord[0], coord[1]];
    var b = createBlock();
    b.setAttribute('x', SQUARE_SIZE * coord[0]);
    b.setAttribute('y', SQUARE_SIZE * coord[1]);
    b.classList.add('type_' + type);
    this.g.appendChild(b);
  }
  // Flip the shape over since the original shape coordinates are origin
  // top-left, whereas the data grid is origin bottom-left.
  for (var i = 0, coord; (coord = this.coords[i]); i++) {
    coord[1] = -coord[1];
  }
  // Position shape at starting point.
  this.currentX = Math.floor((COLUMNS - this.getWidth()) / 2);
  this.currentY = ROWS + this.getBottom() + 1;
  this.coords = moveCoords(this.coords, this.currentX, this.currentY + 1);
  this.currentRotation = 0;
  this.oldX = 0;
  this.oldY = this.currentY;
  this.oldRotation = 0;
  this.pid = 0;
  this.addTransform(false);
};

// Compute width of shape.  Used for centering the shape when first created.
CurrentShape.prototype.getWidth = function() {
  var left = Infinity;
  var right = -Infinity;
  for (var i = 0; i < this.coords.length; i++) {
    var x = this.coords[i][0];
    left = Math.min(left, x);
    right = Math.max(right, x);
  }
  return right - left + 1;
};

// Compute the bottom of shape.  Used for vertical positioning of the shape
// when first created.
CurrentShape.prototype.getBottom = function() {
  var bottom = Infinity;
  for (var i = 0; i < this.coords.length; i++) {
    var y = this.coords[i][1];
    bottom = Math.min(bottom, y);
  }
  return bottom;
};

CurrentShape.prototype.addTransform = function(animate) {
  if (!animate) {
    // Terminate all previous animations.
    for (var i = 0, transform; (transform = this.transforms[i]); i++) {
      if (typeof transform === 'object') {
        transform.startTime = -Infinity;
      }
    }
  }
  var newTransform = new TransformData();

  newTransform.toX = (this.currentX - this.oldX) * SQUARE_SIZE;
  newTransform.toY = -((this.currentY - ROWS) - (this.oldY - ROWS)) * SQUARE_SIZE;
  newTransform.toRotation = (this.currentRotation - this.oldRotation) * 90;

  // Reverse/swap directions so that translations aren't affected by the sum of
  // prior rotations.
  var quad = quadrant(this.currentRotation);
  if (quad === 1) {
    var swap = newTransform.toX;
    newTransform.toX = newTransform.toY;
    newTransform.toY = -swap;
  } else if (quad === 2) {
    newTransform.toX *= -1;
    newTransform.toY *= -1;
  } else if (quad === 3) {
    var swap = newTransform.toX;
    newTransform.toX = -newTransform.toY;
    newTransform.toY = swap;
  }

  if (animate) {
    newTransform.nowX = 0;
    newTransform.nowY = 0;
    newTransform.nowRotation = 0;
  } else {
    newTransform.nowX = newTransform.toX;
    newTransform.nowY = newTransform.toY;
    newTransform.nowRotation = newTransform.toRotation;
    newTransform.startTime = -Infinity;
  }

  this.transforms.push(newTransform);
  this.oldX = this.currentX;
  this.oldY = this.currentY;
  this.oldRotation = this.currentRotation;
};

// Set the SVG transforms for the shape currently in play.
CurrentShape.prototype.setTransforms = function() {
  var transformStrings = [
    'translate(' + BORDER_WIDTH + ',' + (-2 * SQUARE_SIZE + TOP_ROW_HEIGHT) + ')'
  ];
  for (var i = 0; i < this.transforms.length; i++) {
    var transform = this.transforms[i];
    if (typeof transform === 'string') {
      transformStrings.push(transform);
    } else {
      var transformString = '';
      if (transform.nowRotation) {
        var rotationPoint = this.shape.rotation;
        var cx = (rotationPoint[0] + 0.5) * SQUARE_SIZE;
        var cy = (rotationPoint[1] + 0.5) * SQUARE_SIZE;
        transformString += 'rotate(' + transform.nowRotation + ',' + cx + ',' + cy + ')';
      }
      if (transform.nowX || transform.nowY) {
        transformString += 'translate(' + transform.nowX + ',' + transform.nowY + ')';
      }
      transformStrings.push(transformString);
      if (transform.startTime === -Infinity) {
        // This transform is complete.  Replace with statically computed string.
        this.transforms[i] = transformString;
      }
    }
  }
  this.g.setAttribute('transform', transformStrings.join(' '));
};

// Does this shape intersect with any existing blocks on the board,
// or extends beyond the board?
CurrentShape.prototype.isCollided = function() {
  for (var i = 0, coord; (coord = this.coords[i]); i++) {
    var x = coord[0];
    var y = coord[1];
    if (y < 0) {
      return true;  // Under the floor.
    }
    if (grid[y][x] !== null) {
      return true;  // Collided with existing block, or outside the edges.
    }
  }
  return false;
};

// Is this shape sitting on the bottom or on another block.
CurrentShape.prototype.isSurfaced = function() {
  for (var i = 0, coord; (coord = this.coords[i]); i++) {
    var x = coord[0];
    var y = coord[1] - 1;
    if (y < 0) {
      return true;  // On the bottom.
    }
    if (grid[y][x] !== null) {
      return true;  // Sitting on existing block.
    }
  }
  return false;
};

CurrentShape.prototype.lockDownPid = 0;
CurrentShape.prototype.lockDownCount = 0;

// If this shape is sitting on a surface, start the 0.5 second lockdown timer.
CurrentShape.prototype.checkSurfaced = function() {
  clearTimeout(this.lockDownPid);
  if (currentShape.isSurfaced()) {
    this.g.classList.add('surfaced');
    this.lockDownCount++;
    if (this.lockDownCount < 15) {
      this.lockDownPid = setTimeout(lockDown, 500);
    } else {
      // Too many restarts of the timer.  Lock down now!
      lockDown();
    }
  } else {
    this.g.classList.remove('surfaced');
  }
};

// Delete the current shape from the board.
CurrentShape.prototype.destroy = function() {
  clearTimeout(this.lockDownPid);
  this.g.parentNode.removeChild(this.g);
  currentShape = null;
};

// Freeze a falling shape in place.
function lockDown() {
  clearInterval(fallPid);
  // Check for "lock out" game over condition (whole shape above skyline).
  var below = false;
  for (var i = 0, coord; (coord = currentShape.coords[i]); i++) {
    if (coord[1] < ROWS) {
      below = true;
      break;
    }
  }
  if (!below) {
    console.log('Game over: Lock out.');
    fail();
    return;
  }
  // Create static blocks which look identical to the fallen shape.
  var g = document.getElementById('matrix');
  for (var i = 0, coord; (coord = currentShape.coords[i]); i++) {
    var x = coord[0];
    var y = coord[1];
    var b = createBlock();
    b.setAttribute('x', SQUARE_SIZE * x + BORDER_WIDTH);
    b.setAttribute('y', SQUARE_SIZE * (ROWS - y - 1) + TOP_ROW_HEIGHT);
    b.classList.add('type_' + currentShape.type);
    g.appendChild(b);
    grid[y][x] = b;
  }
  // Destroy the fallen shape.
  currentShape.destroy();
  identifyFullLines(createShape);
}

// Identify which lines are full.
function identifyFullLines(callback) {
  var fullLines = [];
  for (var y = 0; y < grid.length; y++) {
    if (grid[y].indexOf(null) === -1) {
      fullLines.push(y);
    }
  }
  if (fullLines.length === 0) {
    // No full lines, finish early.
    callback();
    return;
  }
  mode = modes.STOPPED;
  // Compile list of all blocks to delete.
  recalculateSpeed();
  var deleteBlocks = [];
  for (var i = 0; i < fullLines.length; i++) {
    var y = fullLines[i];
    for (var x = 0; x < grid[y].length; x++) {
      deleteBlocks.push(grid[y][x]);
    }
  }
  // Highlight full lines.
  deleteBlocks.map(function(block) {block.classList.add('fullLine');});
  setTimeout(deleteFullLines.bind(null, fullLines, deleteBlocks, callback),
             FULL_LINE_TIME);
}

function deleteFullLines(fullLines, deleteBlocks, callback) {
  // Delete the SVG elements.
  for (var i = 0, block; (block = deleteBlocks[i]); i++) {
    block.parentNode.removeChild(block);
  }
  // Update display.
  lines += fullLines.length;
  document.getElementById('lines').textContent = lines;
  // Mark start/end points on all moving blocks.
  var dropHeight = 0;
  for (var y = 0; y < grid.length; y++) {
    if (fullLines.indexOf(y) !== -1) {
      // This whole line will be deleted, increment the drop height and skip.
      dropHeight++;
      continue;
    }
    for (var x = 0; x < grid[y].length; x++) {
      var block = grid[y][x];
      if (block) {
        if (dropHeight === 0) {
          // Clear any previous move flags from this block.
          delete block.dataset.startY;
          delete block.dataset.endY;
        } else {
          // Flag this block to move.
          var startY = Number(block.getAttribute('y'));
          var endY = startY + (dropHeight * SQUARE_SIZE);
          block.dataset.startY = startY;
          block.dataset.endY = endY;
        }
      }
    }
  }
  // Clear the lines in the grid.
  for (var i = fullLines.length - 1; i >= 0; i--) {
    grid.splice(fullLines[i], 1);
    grid.push(newDataRow());
  }
  requestAnimationFrame(animateFullLines);
  setTimeout(callback, FULL_LINE_TIME);
}

var FULL_LINE_TIME = 250;

function animateFullLines(time) {
  if (animateFullLines.startTime === undefined) {
    animateFullLines.startTime = time;
  }
  var elapsed = time - animateFullLines.startTime;
  var ratio = elapsed / FULL_LINE_TIME;
  if (ratio >= 1) {
    animateFullLines.startTime = undefined;
    ratio = 1;
  } else {
    requestAnimationFrame(animateFullLines);
  }
  for (var y = 0; y < grid.length; y++) {
    for (var x = 0; x < grid[y].length; x++) {
      var block = grid[y][x];
      if (block && 'startY' in block.dataset) {
        var startY = Number(block.dataset.startY);
        var endY = Number(block.dataset.endY);
        block.setAttribute('y', (endY - startY) * ratio + startY);
      }
    }
  }
}
animateFullLines.startTime = undefined;

function fail() {
  stopAutoRepeat();
  document.body.className = 'shake';
  document.getElementById('crash').play();
  mode = modes.STOPPED;
  setTimeout(showStart, 1000);
}

// Return the name (O/I/T/L/J/S/Z) of a random shape.
// Use a bag so that equal distributions are guaranteed.
function randomShapeName() {
  if (randomShapeName.bag_.length === 0) {
    var types = Object.keys(SHAPES);
    shuffleArray(types);
    randomShapeName.bag_ = types;
  }
  return randomShapeName.bag_.pop();
}
randomShapeName.bag_ = [];

// Replace the 'next shape' display with a new shape.
function updateNextShape() {
  var svg = document.getElementById('next');
  // Delete existing shape.
  while (svg.firstChild) {
    svg.removeChild(svg.firstChild);
  }
  // Add the new shape.
  nextShapeName = randomShapeName();
  var shape = new CurrentShape(nextShapeName);
  svg.appendChild(shape.g);
}

// Constructor for one shape transformation.
var TransformData = function() {
  this.nowX = NaN;
  this.toX = NaN;
  this.nowY = NaN;
  this.toY = NaN;
  this.nowRotation = NaN;
  this.toRotation = NaN;

  this.startTime = undefined;
};

function animateStep(time) {
  currentShapePid = requestAnimationFrame(animateStep);
  if (!currentShape) return;
  for (var i = 0; i < currentShape.transforms.length; i++) {
    var transform = currentShape.transforms[i];
    if (typeof transform === 'string') {
      // This transform is complete and has been statically computed.
      continue;
    }
    if (transform.startTime === undefined) {
      // First frame for this transform.
      transform.startTime = time;
    }
    var animationDuration = Math.min(speed * 0.8, 100);
    var ratio = Math.min(1, (time - transform.startTime) / animationDuration);
    transform.nowX = ratio * transform.toX;
    transform.nowY = ratio * transform.toY;
    transform.nowRotation = ratio * transform.toRotation;
    if (ratio === 1) {
      // No more animation of this transform.
      // Signal that this should be statically computed.
      transform.startTime = -Infinity;
    }
  }
  currentShape.setTransforms();
}

// Create one SVG block.  Four of these in a group make up one falling shape.
// The fixed blocks on the board are individual blocks.
function createBlock() {
  var block = document.createElementNS(SVG_NS, 'rect');
  block.setAttribute('height', SQUARE_SIZE);
  block.setAttribute('width', SQUARE_SIZE);
  block.setAttribute('rx', SQUARE_SIZE / 10);
  block.classList.add('block');
  return block;
}

// Move the current shape down one row.
function actionDown() {
  currentShape.currentY--;
  var oldCoords = currentShape.coords;
  currentShape.coords = moveCoords(currentShape.coords, 0, -1);
  if (currentShape.isCollided()) {  // Oops, abort.
    currentShape.coords = oldCoords;
    currentShape.currentY++;
    return;
  }
  currentShape.addTransform(true);
  currentShape.checkSurfaced();
  printDebug();
}

// Move the current shape right or left one column.
function actionMove(right) {
  var dx = right ? 1 : -1;
  var oldCoords = currentShape.coords;
  currentShape.coords = moveCoords(currentShape.coords, dx, 0);
  currentShape.currentX += dx;
  if (currentShape.isCollided()) {  // Oops, abort.
    currentShape.coords = oldCoords;
    currentShape.currentX -= dx;
    return;
  }
  currentShape.addTransform(true);
  currentShape.checkSurfaced();
  printDebug();
}

// Drop the current shape to the bottom, and lock it in place.
function actionDrop() {
  do {
    var oldCoords = currentShape.coords;
    currentShape.coords = moveCoords(currentShape.coords, 0, -1);
    currentShape.currentY--;
  } while (!currentShape.isCollided());
  currentShape.coords = oldCoords;
  currentShape.currentY++;
  currentShape.addTransform(false);
  lockDown();
}

// Rotate the current shape clockwise or counter-clockwise.
function actionRotate(ccw) {
  var oldRotation = currentShape.currentRotation;
  var oldCoords = currentShape.coords;
  var oldX = currentShape.currentX;
  var oldY = currentShape.currentY;
  currentShape.currentRotation += ccw ? -1 : 1;
  var rotationPoint = currentShape.shape.rotation;
  var cx = currentShape.currentX + rotationPoint[0];
  var cy = currentShape.currentY - rotationPoint[1] + 1;
  currentShape.coords = rotateCoords(currentShape.coords, ccw, cx, cy);
  if (currentShape.isCollided()) {
    // Simple rotation failed.  Try kicking the rotated shape around.
    if (!currentShape.shape.kicks) throw Error('Kicks not found.');
    var oldQuadrant = quadrant(currentShape.oldRotation);
    var newQuadrant = quadrant(currentShape.currentRotation);
    var kickList = currentShape.shape.kicks[oldQuadrant + '>' + newQuadrant];
    if (!kickList) throw Error('Matching kick not found.');
    var preKickCoords = currentShape.coords;
    var preKickX = currentShape.currentX;
    var preKickY = currentShape.currentY;
    for (var i = 0, kick; (kick = kickList[i]); i++) {
      currentShape.coords = moveCoords(currentShape.coords, kick[0], kick[1]);
      currentShape.currentX += kick[0];
      currentShape.currentY += kick[1];
      if (!currentShape.isCollided()) {
        break;
      }
      currentShape.coords = preKickCoords;
      currentShape.currentX = preKickX;
      currentShape.currentY = preKickY;
    }
    if (currentShape.isCollided()) {
      // All kicks failed.  Aborting rotation.
      currentShape.currentRotation = oldRotation;
      currentShape.coords = oldCoords;
      currentShape.currentX = oldX;
      currentShape.currentY = oldY;
    }
  }
  currentShape.addTransform(true);
  currentShape.checkSurfaced();
  printDebug();
}

// Current state of the keyboard.
var keyStatus = {
  'ArrowLeft': false,
  'ArrowRight': false
};

// User pressed a key to start an action.
function keyDown(e) {
  if (keyStatus.hasOwnProperty(e.key)) {
    keyStatus[e.key] = true;
  }
  if (e.repeat || mode !== modes.PLAYING) {
    return;
  }
  switch (e.key) {
    case('ArrowUp'):
    case('x'):
      actionRotate(false);
      break;
    case('Control'):
    case('z'):
      actionRotate(true);
      break;
    case('ArrowLeft'):
      actionMove(false);
      break;
    case('ArrowRight'):
      actionMove(true);
      break;
    case('ArrowDown'):
      // Move down one, and increase falling speed by 20x.
      actionDown();
      clearInterval(fallPid);
      fallPid = setInterval(actionDown, speed / 20);
      break;
    case(' '):
      actionDrop();
      break;
    default:
      return;
  }
  if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
    stopAutoRepeat();
    initAutoRepeat(e.key);
  }
  e.preventDefault();
}

// User releases a key to stop an action.
function keyUp(e) {
  if (keyStatus.hasOwnProperty(e.key)) {
    keyStatus[e.key] = false;
  }
  if (mode !== modes.PLAYING) {
    return;
  }
  switch (e.key) {
    case('ArrowLeft'):
    case('ArrowRight'):
      stopAutoRepeat();
      if (keyStatus.ArrowLeft) {
        initAutoRepeat('ArrowLeft');
      } else if (keyStatus.ArrowRight) {
        initAutoRepeat('ArrowRight');
      }
      break;
    case('ArrowDown'):
      // Return to normal falling speed.
      clearInterval(fallPid);
      fallPid = setInterval(actionDown, speed);
      break;
  }
}

// User pressed space or enter to start game.
function keyPress(e) {
  if (mode === modes.START && (e.key === 'Enter' || e.key === ' ')) {
    startGame();
    e.preventDefault();
  }
}

// Timeout PID for initial delay before an auto-repeat.
var autoRepeatInitPid = 0;
// Interval PID for executing an auto-repeat.
var autoRepeatMovePid = 0;

// Wait a third of a second, then start the auto-repeat.
function initAutoRepeat(key) {
  autoRepeatInitPid = setTimeout(startAutoRepeat.bind(null, key), 300);
}

// Start the auto-repeat.  Repeat the key to enable rapid movement.
function startAutoRepeat(key) {
  autoRepeatMovePid = setInterval(actionMove.bind(null, key === 'ArrowRight'), 50);
}

// Terminate the auto-repeat (user is no longer holding down the key).
function stopAutoRepeat() {
  clearTimeout(autoRepeatInitPid);
  clearInterval(autoRepeatMovePid);
}

// Change the list of X/Y coordinates by rotating them 90 degrees around a point.
// Returns a new list of coordinates, does not modify the original list.
function rotateCoords(coords, ccw, cx, cy) {
  var newCoords = new Array(coords.length);
  for (var i = 0; i < coords.length; i++) {
    var oldX = coords[i][0] - cx;
    var oldY = coords[i][1] - cy;
    var newX, newY;
    if (ccw) {
      newX = -oldY;
      newY = oldX;
    } else {
      newX = oldY;
      newY = -oldX;
    }
    newCoords[i] = [newX + cx, newY + cy];
  }
  return newCoords;
}
//console.log(rotateCoords([[0, 1], [1, 1], [2, 1], [2, 0]], false, 2, 1));

// Change the list of X/Y coordinates by a horizontal and/or vertical offset.
// Returns a new list of coordinates, does not modify the original list.
function moveCoords(coords, dx, dy) {
  var newCoords = new Array(coords.length);
  for (var i = 0; i < coords.length; i++) {
    newCoords[i] = [coords[i][0] + dx, coords[i][1] + dy];
  }
  return newCoords;
}
//console.log(moveCoords([[0, 1], [1, 1], [2, 1], [2, 0]], -2, 1));

// Convert any integer into a 0-3 quadrant.
function quadrant(n) {
  return ((n % 4) + 4) % 4;
}
//console.log(quadrant(-1) === 3);
//console.log(quadrant(0) === 0);
//console.log(quadrant(3) === 3);
//console.log(quadrant(4) === 0);

// Randomize array in-place using Durstenfeld shuffle algorithm.
function shuffleArray(array) {
  for (var i = array.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var temp = array[i];
    array[i] = array[j];
    array[j] = temp;
  }
}

function printDebug() {
  var table = [];
  for (var y = 0; y < grid.length; y++) {
    var row = '';
    for (var x = 0; x < grid[y].length; x++) {
      row += grid[y][x] ? 'X' : (y < ROWS ? '·' : ' ');
    }
    table.push(row);
  }
  for (var i = 0, coord; (coord = currentShape.coords[i]); i++) {
    var x = coord[0];
    var y = coord[1];
    var row = table[y];
    table[y] = row.substring(0, x) + 'O' + row.substring(x + 1);
  }
  table.reverse();
  document.getElementById('debug').value = table.join('\n');
}
