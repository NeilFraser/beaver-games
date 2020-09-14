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
  'O': [[0, 0], [1, 0], [0, 1], [1, 1]],
  'I': [[0, 1], [1, 1], [2, 1], [3, 1]],
  'T': [[0, 1], [1, 1], [2, 1], [1, 0]],
  'L': [[0, 1], [1, 1], [2, 1], [2, 0]],
  'J': [[0, 1], [1, 1], [2, 1], [0, 0]],
  'S': [[0, 1], [1, 1], [1, 0], [2, 0]],
  'Z': [[0, 0], [1, 0], [1, 1], [2, 1]]
};

function init() {
  fixLinks();

  var m = document.cookie.match(/difficulty=([012])/);
  var difficultyIndex = m ? m[1] : 0;
  SPEED = [400, 200, 100][difficultyIndex];
  var difficultySelect = document.getElementById('difficulty');
  difficultySelect.selectedIndex = difficultyIndex;
  difficultySelect.addEventListener('change', setDifficulty);

  var svg = document.getElementById('board');
  drawGrid();
  var types = Object.keys(shapes);
  var g = createShape(types[Math.floor(Math.random() * types.length)]);
  svg.appendChild(g);

  document.addEventListener('keydown', keyDown);
}
window.addEventListener('load', init);

function drawGrid() {
  var grid = document.getElementById('grid');
  if (!grid) return;
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

// Details of the shape currently in play.
var currentShape = {
  type: '',
  g: null,
  originX: NaN,
  originY: NaN,
  height: NaN,
  width: NaN,
  shapeTop: NaN,
  shapeBottom: NaN,
  shapeLeft: NaN,
  shapeRight: NaN
};

function createShape(type) {
  var shape = shapes[type];
  if (!shape) {
    throw new Error('Unknown type: ' + type);
  }
  currentShape.type = type;
  var g = document.createElementNS(SVG_NS, 'g');
  currentShape.g = g;
  for (var i = 0; i < shape.length; i++) {
    var coord = shape[i];
    var b = createBlock();
    b.setAttribute('x', SQUARE_SIZE * coord[0]);
    b.setAttribute('y', SQUARE_SIZE * coord[1]);
    b.classList.add('type_' + type);
    g.appendChild(b);
  }

  var xs = shape.map(function(xy) {return xy[0];});
  var ys = shape.map(function(xy) {return xy[1];});
  currentShape.shapeTop = Math.min.apply(this, ys);
  currentShape.shapeBottom = Math.max.apply(this, ys);
  currentShape.shapeLeft = Math.min.apply(this, xs);
  currentShape.shapeRight = Math.max.apply(this, xs);
  currentShape.width = currentShape.shapeRight - currentShape.shapeLeft + 1;
  currentShape.height = currentShape.shapeBottom - currentShape.shapeTop + 1;
  currentShape.originX = Math.floor((COLUMNS - currentShape.width) / 2);
  currentShape.originY = ROWS + currentShape.shapeBottom + 1;
  updateShapeTransforms(false);
  return g;
}

function updateShapeTransforms(animate) {
  var x = BORDER_WIDTH + currentShape.originX * SQUARE_SIZE;
  var y = TOP_ROW_HEIGHT - (currentShape.originY - ROWS) * SQUARE_SIZE;
  cancelAnimationFrame(animateData.pid);
  if (animate) {
    animateData.startTime = 0;
    animateData.fromX = animateData.currentX;
    animateData.fromY = animateData.currentY;
    animateData.toX = x;
    animateData.toY = y;
    animateData.pid = requestAnimationFrame(animateStep);
  } else {
    currentShape.g.setAttribute('transform', 'translate(' + x + ' ' + y + ')');
    // Record the current X/Y translations in order to animate the next step.
    animateData.currentX = x;
    animateData.currentY = y;
  }
}

// Temporary data for shape animations.
var animateData = {
  fromX: NaN,
  toX: NaN,
  currentX: NaN,
  fromY: NaN,
  toY: NaN,
  currentY: NaN,
  pid: 0,
  startTime: 0
};

function animateStep(time) {
  if (!animateData.startTime) {
    animateData.startTime = time;
  }
  var ratio = Math.min(1, (time - animateData.startTime) / ANIMATION_DURATION);
  var x = ratio * (animateData.toX - animateData.fromX) + animateData.fromX;
  var y = ratio * (animateData.toY - animateData.fromY) + animateData.fromY;
  currentShape.g.setAttribute('transform', 'translate(' + x + ' ' + y + ')');
  animateData.currentX = x;
  animateData.currentY = y;
  if (ratio < 1) {
    animateData.pid = requestAnimationFrame(animateStep);
  }
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
  currentShape.originY--;
  if (isCollided()) {  // Oops, abort.
    currentShape.originY++;
    return;
  }
  updateShapeTransforms(true);
}

function actionMove(right) {
  var dx = right ? 1 : -1;
  currentShape.originX += dx;
  if (isCollided()) {  // Oops, abort.
    currentShape.originX -= dx;
    return;
  }
  updateShapeTransforms(true);
}

function actionDrop() {
  do {
    currentShape.originY--;
  } while (!isCollided());
  currentShape.originY++;
  updateShapeTransforms(false);
}

function isCollided() {
  if (currentShape.originY - currentShape.shapeBottom <= 0) {
    return true;  // Below the floor.
  }
  if (currentShape.originX - currentShape.shapeLeft < 0) {
    return true;  // Left wall.
  }
  if (currentShape.originX + currentShape.shapeRight >= COLUMNS) {
    return true;  // Right wall.
  }
  return false;
}

function keyDown(e) {
  if (e.repeat) {
    return;
  }
  switch (e.key) {
    case('ArrowUp'):
      //actionRotate();
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
  e.preventDefault();
}
