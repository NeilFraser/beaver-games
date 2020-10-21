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


var SPEED;

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

// Length of time that the move/rotate animations play (milliseconds).
var ANIMATION_DURATION = 100;

var shapes = {
  'O': {
    coords: [[0, 0], [1, 0], [0, 1], [1, 1]],
    rotation: [0.5, 0.5]
  },
  'I': {
    coords: [[0, 1], [1, 1], [2, 1], [3, 1]],
    rotation: [1.5, 0.5]
  },
  'T': {
    coords: [[0, 1], [1, 1], [2, 1], [1, 0]],
    rotation: [1, 1]
  },
  'L': {
    coords: [[0, 1], [1, 1], [2, 1], [2, 0]],
    rotation: [1, 1]
  },
  'J': {
    coords: [[0, 1], [1, 1], [2, 1], [0, 0]],
    rotation: [1, 1]
  },
  'S': {
    coords: [[0, 1], [1, 1], [1, 0], [2, 0]],
    rotation: [1, 1]
  },
  'Z': {
    coords: [[0, 0], [1, 0], [1, 1], [2, 1]],
    rotation: [1, 1]
  }
};

// Currently active O/I/T/L/J/S/Z shape.
var currentShape = null;

var grid = [];

function init() {
  fixLinks();

  var m = document.cookie.match(/difficulty=([012])/);
  var difficultyIndex = m ? m[1] : 0;
  SPEED = [400, 200, 100][difficultyIndex];
  var difficultySelect = document.getElementById('difficulty');
  difficultySelect.selectedIndex = difficultyIndex;
  difficultySelect.addEventListener('change', setDifficulty);

  var svg = document.getElementById('board');
  initSvgGrid();
  initDataGrid();
  var types = Object.keys(shapes);
  currentShape = new CurrentShape(types[Math.floor(Math.random() * types.length)]);
  svg.appendChild(currentShape.g);
  currentShape.pid = requestAnimationFrame(animateStep);

  document.addEventListener('keydown', keyDown);
  printDebug();
}
window.addEventListener('load', init);

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

function initDataGrid() {
  grid.length = 0;
  for (var y = 0; y < ROWS + 4; y++) {
    var row = [];
    for (var x = 0; x < COLUMNS; x++) {
      row[x] = null;
    }
    grid[y] = row;
  }
}

// Constructor for shape currently in play.
var CurrentShape = function(type) {
  this.shape = shapes[type];
  if (!this.shape) {
    throw new Error('Unknown type: ' + type);
  }
  this.g = document.createElementNS(SVG_NS, 'g');
  this.transforms = [];
  this.coords = this.shape.coords.slice();
  // Create a block at each of the four shape coordinates.
  for (var i = 0, coord; (coord = this.coords[i]); i++) {
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
  var quadrant = ((this.currentRotation % 4) + 4) % 4;
  if (quadrant === 1) {
    var swap = newTransform.toX;
    newTransform.toX = newTransform.toY;
    newTransform.toY = -swap;
  } else if (quadrant === 2) {
    newTransform.toX *= -1;
    newTransform.toY *= -1;
  } else if (quadrant === 3) {
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
  for (var i = 0, transform; (transform = this.transforms[i]); i++) {
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
        console.log(transformString)
      }
    }
  }
  this.g.setAttribute('transform', transformStrings.join(' '));
};

CurrentShape.prototype.isCollided = function() {
  for (var i = 0, coord; (coord = this.coords[i]); i++) {
    var x = coord[0];
    var y = coord[1];
    if (y < 0 || x < 0 || x >= grid[y].length) {
      return true;  // Out of bounds.
    }
  }
  return false;
};

// Data for one shape transformation.
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
  for (var i = 0, transform; (transform = currentShape.transforms[i]); i++) {
    if (typeof transform === 'string') {
      // This transform is complete and has been statically computed.
      continue;
    }
    if (transform.startTime === undefined) {
      // First frame for this transform.
      transform.startTime = time;
    }
    var ratio = Math.min(1, (time - transform.startTime) / ANIMATION_DURATION);
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
  currentShape.pid = requestAnimationFrame(animateStep);
}

function createBlock() {
  var block = document.createElementNS(SVG_NS, 'rect');
  block.setAttribute('height', SQUARE_SIZE);
  block.setAttribute('width', SQUARE_SIZE);
  block.setAttribute('rx', SQUARE_SIZE / 10);
  block.classList.add('block');
  return block;
}

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
}

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
}

function actionDrop() {
  do {
    var oldCoords = currentShape.coords;
    currentShape.coords = moveCoords(currentShape.coords, 0, -1);
    currentShape.currentY--;
  } while (!currentShape.isCollided());
  currentShape.coords = oldCoords;
  currentShape.currentY++;
  currentShape.addTransform(false);
}

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
    // Simple rotation failed.
    // Try shifting result left one square.
    currentShape.coords = moveCoords(currentShape.coords, -1, 0);
    currentShape.currentX -= 1;
    console.log('Left?');
    if (currentShape.isCollided()) {
      // Try shifting result right one square.
      currentShape.coords = moveCoords(currentShape.coords, 2, 0);
      currentShape.currentX += 2;
      console.log('Right?');
      if (currentShape.isCollided()) {
        console.log('Aborting rotation');
        currentShape.currentRotation = oldRotation;
        currentShape.coords = oldCoords;
        currentShape.currentX = oldX;
        currentShape.currentY = oldY;
      }
    }
  }
  currentShape.addTransform(true);
}

function keyDown(e) {
  if (e.repeat) {
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
    case('ArrowDown'):
      actionDown();
      break;
    case('ArrowRight'):
      actionMove(true);
      break;
    case(' '):
      actionDrop();
      break;
    default:
      return;
  }
  printDebug();
  e.preventDefault();
}

function rotateCoords(coords, ccw, cx, cy) {
  var newCoords = [];
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

function moveCoords(coords, dx, dy) {
  var newCoords = [];
  for (var i = 0; i < coords.length; i++) {
    newCoords[i] = [coords[i][0] + dx, coords[i][1] + dy];
  }
  return newCoords;
}
//console.log(moveCoords([[0, 1], [1, 1], [2, 1], [2, 0]], -2, 1));

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

