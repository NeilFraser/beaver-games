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
const HEIGHTS = [12, 24, 48];
const WIDTHS = [24, 48, 96];
const SQUARE_SIZES = [30, 20, 15];
const SPEEDS = [0, 0.5, 0.75];
let SPEED;
// Number of rows.
let HEIGHT;
// Number of columns.
let WIDTH;

// Height and width of a single cell.
let SQUARE_SIZE;

// Is the game running?
let isRunning = false;

// Is the start button visible?
let isStartVisible = true;

// 2D array of walls (true if wall, false if path).
const walls = [];

// Namespace for SVG elements.
const SVG_NS = 'http://www.w3.org/2000/svg';

// Array of coordinates that the avatar moved.
let avatarPath = [];

// Object with x/y coordinates of avatar.
let avatar = {x: 0, y: 0};

// Object with x/y coordinates of goal.
let goal = null;

// Randomly selected origin point for growing the maze.
let originX, originY;

// Start-up initialization code.  Run once.
function init() {
  fixLinks();

  // Configure difficulty mode.
  const m = document.cookie.match(/difficulty=([012])/);
  const difficulty = Number(m ? m[1] : 0);
  document.getElementById('difficulty').selectedIndex = difficulty;
  registerOptions('difficulty');

  // Set size based on difficulty.
  HEIGHT = HEIGHTS[difficulty];
  WIDTH = WIDTHS[difficulty];
  SQUARE_SIZE = SQUARE_SIZES[difficulty];
  SPEED = SPEEDS[difficulty];
  const svg = document.getElementById('landscape');
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
  const startButton = document.getElementById('start');
  startButton.style.display = 'none';
  isStartVisible = false;
}

// Clear any existing maze.  Create a new maze.
function initMaze() {
  // Clear old SVG walls and goal.
  let g = document.getElementById('wallLayer');
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
  walls.length = WIDTH;
  for (let x = 0; x < WIDTH; x++) {
    walls[x] = new Array(HEIGHT).fill(true);
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
  const goalLayer = document.getElementById('goalLayer');
  const goalElement = document.createElementNS(SVG_NS, 'circle');
  goalElement.setAttribute('r', SQUARE_SIZE / 4);
  goalElement.setAttribute('cx', goal.x * SQUARE_SIZE + SQUARE_SIZE / 2 + 0.5);
  goalElement.setAttribute('cy', goal.y * SQUARE_SIZE + SQUARE_SIZE / 2 + 0.5);
  goalElement.id = 'goal';
  goalLayer.appendChild(goalElement);

  // Choose the avatar coordinates.
  avatar = findEnd(goal.x, goal.y);
  avatarPath = [{x: avatar.x, y: avatar.y}];
  // Draw the avatar.
  const avatarLayer = document.getElementById('avatarLayer');
  const avatarPathElement = document.createElementNS(SVG_NS, 'path');
  avatarPathElement.style.strokeWidth = (SQUARE_SIZE / 6) + 'px';
  avatarPathElement.id = 'avatarPath';
  avatarLayer.appendChild(avatarPathElement);
  const avatarElement = document.createElementNS(SVG_NS, 'circle');
  avatarElement.setAttribute('r', SQUARE_SIZE / 4);
  avatarElement.setAttribute('cx', avatar.x * SQUARE_SIZE + SQUARE_SIZE / 2 + 0.5);
  avatarElement.setAttribute('cy', avatar.y * SQUARE_SIZE + SQUARE_SIZE / 2 + 0.5);
  avatarElement.id = 'avatar';
  avatarLayer.appendChild(avatarElement);

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
  const randomIndex = Math.floor(Math.random() * initMaze.horizon.length);
  const cell = initMaze.horizon.splice(randomIndex, 1)[0];

  const wallCount =
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
  const layer = document.getElementById('wallLayer');
  const oldElement = document.getElementById(x + '_' + y);
  if (oldElement) {
    layer.removeChild(oldElement);
  }
  const g = document.createElementNS(SVG_NS, 'g');
  // Every cell has a circle in the middle.
  const element = document.createElementNS(SVG_NS, 'circle');
  element.setAttribute('r', SQUARE_SIZE / 4);
  element.setAttribute('cx', SQUARE_SIZE / 2);
  element.setAttribute('cy', SQUARE_SIZE / 2);
  element.setAttribute('class', 'path');
  g.appendChild(element);
  // Add the north, south, east and west paths as needed.
  if (!isWall(x - 1, y, true)) {
    const element = document.createElementNS(SVG_NS, 'rect');
    element.setAttribute('height', SQUARE_SIZE / 2);
    element.setAttribute('width', SQUARE_SIZE / 2);
    element.setAttribute('x', -1);
    element.setAttribute('y', SQUARE_SIZE / 4);
    element.setAttribute('class', 'path');
    g.appendChild(element);
  }
  if (!isWall(x + 1, y, true)) {
    const element = document.createElementNS(SVG_NS, 'rect');
    element.setAttribute('height', SQUARE_SIZE / 2);
    element.setAttribute('width', SQUARE_SIZE / 2);
    element.setAttribute('x', SQUARE_SIZE / 2);
    element.setAttribute('y', SQUARE_SIZE / 4);
    element.setAttribute('class', 'path');
    g.appendChild(element);
  }
  if (!isWall(x, y - 1, true)) {
    const element = document.createElementNS(SVG_NS, 'rect');
    element.setAttribute('height', SQUARE_SIZE / 2);
    element.setAttribute('width', SQUARE_SIZE / 2);
    element.setAttribute('x', SQUARE_SIZE / 4);
    element.setAttribute('y', -1);
    element.setAttribute('class', 'path');
    g.appendChild(element);
  }
  if (!isWall(x, y + 1, true)) {
    const element = document.createElementNS(SVG_NS, 'rect');
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
  let end = null;
  let endSteps = 0;
  const visited = new Set();
  const queue = new Map();
  queue.set(startX + ' ' + startY, 0);
  while (queue.size) {
    const xys_ = queue.entries().next().value;
    const xy = xys_[0];
    const steps = Number(xys_[1]) + 1;
    queue.delete(xy);
    if (visited.has(xy)) {
      continue;
    }
    visited.add(xy);
    const xy_ = xy.split(' ');
    const x = Number(xy_[0]);
    const y = Number(xy_[1]);
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
  const newX = avatar.x + dx;
  const newY = avatar.y + dy;
  if (isWall(newX, newY, true)) {
    return;
  }
  avatar.x = newX;
  avatar.y = newY;
  const element = document.getElementById('avatar');
  element.setAttribute('cx', avatar.x * SQUARE_SIZE + SQUARE_SIZE / 2 + 0.5);
  element.setAttribute('cy', avatar.y * SQUARE_SIZE + SQUARE_SIZE / 2 + 0.5);

  const lastSpot = avatarPath[avatarPath.length - 2];
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
  const d = [];
  for (let i = 0; i < avatarPath.length; i++) {
    // First path element is 'move', following ones are 'line'.
    d.push(i ? 'L' : 'M',
           avatarPath[i].x * SQUARE_SIZE + SQUARE_SIZE / 2 + 0.5,
           avatarPath[i].y * SQUARE_SIZE + SQUARE_SIZE / 2 + 0.5);
  }
  const element = document.getElementById('avatarPath');
  element.setAttribute('d', d.join(' '));
}
