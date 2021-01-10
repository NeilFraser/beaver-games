/**
 * @license
 * Copyright 2021 Neil Fraser
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @fileoverview Maze game.
 * @author root@neil.fraser.name (Neil Fraser)
 */
'use strict';

// For Easy/Normal/Hard modes.
var HEIGHTS = [8, 16, 24];
var WIDTHS = [16, 32, 48];
var SQUARE_SIZES = [40, 25, 20];
// Number of rows.
var HEIGHT;
// Number of columns.
var WIDTH;

// Height and width of a single cell.
var SQUARE_SIZE;

// Is the game running?
var isRunning = false;

// 2D array of walls (true if wall, false if path).
var walls = [];

// Namespace for SVG elements.
var SVG_NS = 'http://www.w3.org/2000/svg';

// Array of coordinates that the avatar moved.
var avatarPath = [];

// Object with x/y coordinates of avatar.
var avatar = {x: 0, y: 0};

// Object with x/y coordinates of goal.
var goal = null;

// Start-up initialization code.  Run once.
function init() {
  fixLinks();

  // Configure difficulty mode.
  var m = document.cookie.match(/difficulty=([012])/);
  var difficulty = Number(m ? m[1] : 0);
  document.getElementById('difficulty').selectedIndex = difficulty;
  registerOptions('difficulty');

  // Set size based on difficulty.
  HEIGHT = HEIGHTS[difficulty];
  WIDTH = WIDTHS[difficulty];
  SQUARE_SIZE = SQUARE_SIZES[difficulty];
  var svg = document.getElementById('landscape');
  svg.setAttribute('height', SQUARE_SIZE * HEIGHT);
  svg.setAttribute('width', SQUARE_SIZE * WIDTH);

  // Start button is only for restart in this game, but add event handler now.
  //document.getElementById('start').addEventListener('click', startGame);
  document.addEventListener('keydown', keyDown);

  // Draw avatar.
  var g = document.getElementById('avatarLayer');
  var element = document.createElementNS(SVG_NS, 'path');
  element.style.strokeWidth = (SQUARE_SIZE / 6) + 'px';
  element.id = 'avatarPath';
  g.appendChild(element);
  var element = document.createElementNS(SVG_NS, 'circle');
  element.setAttribute('r', SQUARE_SIZE / 4);
  element.setAttribute('cx', avatar.x * SQUARE_SIZE + SQUARE_SIZE / 2);
  element.setAttribute('cy', avatar.y * SQUARE_SIZE + SQUARE_SIZE / 2);
  element.id = 'avatar';
  g.appendChild(element);

  // Draw the maze and goal.
  initMaze();
}
window.addEventListener('load', init);

// Clear any existing maze.  Create a new maze.
function initMaze() {
  // Clear old SVG walls and goal.
  var g = document.getElementById('wallLayer');
  while (g.firstChild) {
    g.removeChild(g.firstChild);
  }
  g = document.getElementById('goalLayer');
  while (g.firstChild) {
    g.removeChild(g.firstChild);
  }
  // Initialize the wall grid to be solid.
  walls.length = 0;
  for (var x = 0; x < WIDTH; x++) {
    walls[x] = [];
    for (var y = 0; y < HEIGHT; y++) {
      walls[x][y] = true;
    }
  }

  avatarPath = [{x: avatar.x, y: avatar.y}];
  drawPath();
  initMaze.horizon = [{x: avatar.x, y: avatar.y}];
  initMazeStep();
}

// Set the goal and allow user interaction.
function startGame() {
  // Draw goal.
  var g = document.getElementById('goalLayer');
  var element = document.createElementNS(SVG_NS, 'circle');
  element.setAttribute('r', SQUARE_SIZE / 4);
  element.setAttribute('cx', goal.x * SQUARE_SIZE + SQUARE_SIZE / 2);
  element.setAttribute('cy', goal.y * SQUARE_SIZE + SQUARE_SIZE / 2);
  element.id = 'goal';
  g.appendChild(element);
  // Allow user input.
  isRunning = true;
}

// Grow the maze by one step.
function initMazeStep() {
  if (!initMaze.horizon.length) {
    // Done.
    startGame();
    return;
  }
  var randomIndex = Math.floor(Math.random() * initMaze.horizon.length);
  var cell = initMaze.horizon.splice(randomIndex, 1)[0];

  var wallCount =
    isWall(cell.x + 1, cell.y, true) + isWall(cell.x - 1, cell.y, true) +
    isWall(cell.x, cell.y + 1, true) + isWall(cell.x, cell.y - 1, true);
  if (wallCount >= 3) {
    if (isWall(cell.x + 1, cell.y, false)) {
      initMaze.horizon.push({x: cell.x + 1, y: cell.y});
    }
    if (isWall(cell.x - 1, cell.y, false)) {
      initMaze.horizon.push({x: cell.x - 1, y: cell.y});
    }
    if (isWall(cell.x, cell.y + 1, false)) {
      initMaze.horizon.push({x: cell.x, y: cell.y + 1});
    }
    if (isWall(cell.x, cell.y - 1, false)) {
      initMaze.horizon.push({x: cell.x, y: cell.y - 1});
    }
    walls[cell.x][cell.y] = false;
    draw(cell.x, cell.y);
    // Also redraw the four neighbouring cells since they may have been changed.
    draw(cell.x + 1, cell.y);
    draw(cell.x - 1, cell.y);
    draw(cell.x, cell.y + 1);
    draw(cell.x, cell.y - 1);
    // Record this cell as the goal (the last cell grown will be the goal).
    goal = cell;
    setTimeout(initMazeStep, 0);
  } else {
    initMazeStep();
  }
}

// Draw the path at the given location.
function draw(x, y) {
  if (isWall(x, y, true)) {
    return;  // No path here.
  }
  var layer = document.getElementById('wallLayer');
  var oldElement = document.getElementById(x + '_' + y);
  if (oldElement) {
    layer.removeChild(oldElement);
  }
  var g = document.createElementNS(SVG_NS, 'g');
  // Every cell has a circle in the middle.
  var element = document.createElementNS(SVG_NS, 'circle');
  element.setAttribute('r', SQUARE_SIZE / 4);
  element.setAttribute('cx', SQUARE_SIZE / 2);
  element.setAttribute('cy', SQUARE_SIZE / 2);
  element.setAttribute('class', 'path');
  g.appendChild(element);
  // Add the north, south, east and west paths as needed.
  if (!isWall(x - 1, y, true)) {
    var element = document.createElementNS(SVG_NS, 'rect');
    element.setAttribute('height', SQUARE_SIZE / 2);
    element.setAttribute('width', SQUARE_SIZE / 2);
    element.setAttribute('x', 0);
    element.setAttribute('y', SQUARE_SIZE / 4);
    element.setAttribute('class', 'path');
    g.appendChild(element);
  }
  if (!isWall(x + 1, y, true)) {
    var element = document.createElementNS(SVG_NS, 'rect');
    element.setAttribute('height', SQUARE_SIZE / 2);
    element.setAttribute('width', SQUARE_SIZE / 2);
    element.setAttribute('x', SQUARE_SIZE / 2);
    element.setAttribute('y', SQUARE_SIZE / 4);
    element.setAttribute('class', 'path');
    g.appendChild(element);
  }
  if (!isWall(x, y - 1, true)) {
    var element = document.createElementNS(SVG_NS, 'rect');
    element.setAttribute('height', SQUARE_SIZE / 2);
    element.setAttribute('width', SQUARE_SIZE / 2);
    element.setAttribute('x', SQUARE_SIZE / 4);
    element.setAttribute('y', 0);
    element.setAttribute('class', 'path');
    g.appendChild(element);
  }
  if (!isWall(x, y + 1, true)) {
    var element = document.createElementNS(SVG_NS, 'rect');
    element.setAttribute('height', SQUARE_SIZE / 2);
    element.setAttribute('width', SQUARE_SIZE  / 2);
    element.setAttribute('x', SQUARE_SIZE / 4);
    element.setAttribute('y', SQUARE_SIZE / 2);
    element.setAttribute('class', 'path');
    g.appendChild(element);
  }
  g.setAttribute('transform', 'translate(' + (x * SQUARE_SIZE) + ',' + (y * SQUARE_SIZE) + ')');
  g.id = x + '_' + y;
  layer.appendChild(g);
}

// Return if the provided coordinates are a wall.
// If the coordinates are out of bounds, return outside.
function isWall(x, y, outside) {
  if (x < 0 || x >= WIDTH || y < 0 || y >= HEIGHT) {
    return outside;
  }
  return walls[x][y];
}

// Player is changing directions using the keyboard.
function keyDown(e) {
  if (!isRunning || e.repeat) {
    return;
  }
  switch (e.key) {
    case 'ArrowLeft':
      move(-1, 0);
      break;
    case 'ArrowRight':
      move(1, 0);
      break;
    case 'ArrowUp':
      move(0, -1);
      break;
    case 'ArrowDown':
      move(0, 1);
      break;
    default:
      return;
  }
  e.preventDefault();
}

// Move the avatar one step.
function move(dx, dy) {
  var newX = avatar.x + dx;
  var newY = avatar.y + dy;
  if (isWall(newX, newY, true)) {
    return;
  }
  avatar.x = newX;
  avatar.y = newY;
  var element = document.getElementById('avatar');
  element.setAttribute('cx', avatar.x * SQUARE_SIZE + SQUARE_SIZE / 2);
  element.setAttribute('cy', avatar.y * SQUARE_SIZE + SQUARE_SIZE / 2);

  var lastSpot = avatarPath[avatarPath.length - 2];
  if (lastSpot && lastSpot.x === newX && lastSpot.y === newY) {
    avatarPath.pop();
  } else {
    avatarPath.push({x: newX, y: newY});
  }
  drawPath();

  if (newX === goal.x && newY === goal.y) {
    // Avatar has arrived at the goal.
    isRunning = false;
    document.getElementById('ding').play();
    setTimeout(initMaze, 500);
  }
}

// Render the avatar's path.
function drawPath() {
  var d = [];
  for (var i = 0; i < avatarPath.length; i++) {
    d.push(i ? 'L' : 'M',
           avatarPath[i].x * SQUARE_SIZE + SQUARE_SIZE / 2,
           avatarPath[i].y * SQUARE_SIZE + SQUARE_SIZE / 2);
  }
  var element = document.getElementById('avatarPath');
  element.setAttribute('d', d.join(' '));
}
