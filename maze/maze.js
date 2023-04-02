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
var HEIGHTS = [12, 24, 48];
var WIDTHS = [24, 48, 96];
var SQUARE_SIZES = [30, 20, 15];
var SPEEDS = [0, 0.5, 0.75];
var SPEED;
// Number of rows.
var HEIGHT;
// Number of columns.
var WIDTH;

// Height and width of a single cell.
var SQUARE_SIZE;

// Is the game running?
var isRunning = false;

// Is the start button visible?
var isStartVisible = true;

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

// Randomly selected origin point for growing the maze.
var originX, originY;

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
  SPEED = SPEEDS[difficulty];
  var svg = document.getElementById('landscape');
  svg.setAttribute('height', SQUARE_SIZE * HEIGHT + 1);
  svg.setAttribute('width', SQUARE_SIZE * WIDTH + 1);

  // Start button is only for restart in this game, but add event handler now.
  document.getElementById('start').addEventListener('click', startButton);
  document.addEventListener('keypress', keyPress);
  document.addEventListener('keydown', keyDown);

  // Start the first maze from a random place.
  avatar.x = Math.floor(Math.random() * WIDTH);
  avatar.y = Math.floor(Math.random() * HEIGHT);

  // Draw the maze and goal.
  initMaze();
}
window.addEventListener('load', init);

// Hide the start button.
// Clicking a button is needed to authorize the browser to play sounds.  :(
function startButton() {
  var startButton = document.getElementById('start');
  startButton.style.display = 'none';
  isStartVisible = false;
}

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
  g = document.getElementById('avatarLayer');
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

  // Use the avatar/goal location in the previous maze as the origin for the
  // next maze.
  originX = avatar.x;
  originY = avatar.y;
  initMaze.horizon = [{x: originX, y: originY}];
  initMazeStep();
}

// Set the goal and allow user interaction.
function startGame() {
  // Choose the goal coordinates.
  goal = findEnd(originX, originY);
  // Draw the goal.
  var g = document.getElementById('goalLayer');
  var element = document.createElementNS(SVG_NS, 'circle');
  element.setAttribute('r', SQUARE_SIZE / 4);
  element.setAttribute('cx', goal.x * SQUARE_SIZE + SQUARE_SIZE / 2 + 0.5);
  element.setAttribute('cy', goal.y * SQUARE_SIZE + SQUARE_SIZE / 2 + 0.5);
  element.id = 'goal';
  g.appendChild(element);

  // Choose the avatar coordinates.
  avatar = findEnd(goal.x, goal.y);
  avatarPath = [{x: avatar.x, y: avatar.y}];
  // Draw the avatar.
  var g = document.getElementById('avatarLayer');
  var element = document.createElementNS(SVG_NS, 'path');
  element.style.strokeWidth = (SQUARE_SIZE / 6) + 'px';
  element.id = 'avatarPath';
  g.appendChild(element);
  var element = document.createElementNS(SVG_NS, 'circle');
  element.setAttribute('r', SQUARE_SIZE / 4);
  element.setAttribute('cx', avatar.x * SQUARE_SIZE + SQUARE_SIZE / 2 + 0.5);
  element.setAttribute('cy', avatar.y * SQUARE_SIZE + SQUARE_SIZE / 2 + 0.5);
  element.id = 'avatar';
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
    if (Math.random() < SPEED) {
      initMazeStep();
    } else {
      setTimeout(initMazeStep, 0);
    }
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
    element.setAttribute('x', -1);
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
    element.setAttribute('y', -1);
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
  g.setAttribute('transform', 'translate(' + (x * SQUARE_SIZE + 0.5) + ',' +
                 (y * SQUARE_SIZE + 0.5) + ')');
  g.id = x + '_' + y;
  layer.appendChild(g);
}

// Spider the maze to find the furthest point from the provided start point.
function findEnd(startX, startY) {
  var end = null;
  var endSteps = 0;
  var visited = new Set();
  var queue = new Map();
  queue.set(startX + ' ' + startY, 0);
  while (queue.size) {
    var xys_ = queue.entries().next().value;
    var xy = xys_[0];
    var steps = Number(xys_[1]) + 1;
    queue.delete(xy);
    if (visited.has(xy)) {
      continue;
    }
    visited.add(xy);
    var xy_ = xy.split(' ');
    var x = Number(xy_[0]);
    var y = Number(xy_[1]);
    if (isWall(x, y, true)) {
      continue;
    }
    if (steps > endSteps) {
      end = {x: x, y: y};
      endSteps = steps;
    }
    queue.set((x + 1) + ' ' + y, steps);
    queue.set((x - 1) + ' ' + y, steps);
    queue.set(x + ' ' + (y + 1), steps);
    queue.set(x + ' ' + (y - 1), steps);
  }
  return end;
}

// Return if the provided coordinates are a wall.
// If the coordinates are out of bounds, return outside.
function isWall(x, y, outside) {
  if (x < 0 || x >= WIDTH || y < 0 || y >= HEIGHT) {
    return outside;
  }
  return walls[x][y];
}

// User pressed space or enter to start game.
function keyPress(e) {
  if (isStartVisible && (e.key === 'Enter' || e.key === ' ')) {
    startButton();
    e.preventDefault();
  }
}

// Player is changing directions using the keyboard.
function keyDown(e) {
  if (isStartVisible || !isRunning || e.repeat) {
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
  element.setAttribute('cx', avatar.x * SQUARE_SIZE + SQUARE_SIZE / 2 + 0.5);
  element.setAttribute('cy', avatar.y * SQUARE_SIZE + SQUARE_SIZE / 2 + 0.5);

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
           avatarPath[i].x * SQUARE_SIZE + SQUARE_SIZE / 2 + 0.5,
           avatarPath[i].y * SQUARE_SIZE + SQUARE_SIZE / 2 + 0.5);
  }
  var element = document.getElementById('avatarPath');
  element.setAttribute('d', d.join(' '));
}
