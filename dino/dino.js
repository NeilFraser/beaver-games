/**
 * @license
 * Copyright 2020 Neil Fraser
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @fileoverview Dino game.
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

var JUMP_HEIGHT = 40;

// Master speed multiplier.  1 is normal, smaller is slower, larger is faster.
var SPEED = 1;

// Number of ms per pixel.
var SCROLL_SPEED = 6;

// Number of ms from ground to apogee.
var HALF_JUMP_DURATION = 500;

// Min and max times between obstacles.
var MIN_OBSTACLE_INTERVAL = 1000;
var MAX_OBSTACLE_INTERVAL = 2000;

// Vertical (y) location of ground.
var GROUND_LEVEL = 140;

// Height of dinosaur when standing.
var STAND_HEIGHT = 40;

// Height of dinosaur when crouching.
var CROUCH_HEIGHT = 20;

// Width of dinosaur when standing.
var STAND_WIDTH = 20;

// Width of dinosaur when crouching.
var CROUCH_WIDTH = 30;

// Horizontal (x) location of center of dinosaur.
var DINO_CENTER_X = 100;

// Width of visible screen.
var LANDSCAPE_WIDTH = 800;

// How far landscape extends beyond the end of each side of the visible screen.
var LANDSCAPE_MARGIN = 50;

// Current state of dinosaur.
var dino = {
  element: null,
  jumpStart: undefined,
  crouching: false,
  rotation: 0
};

var SVG_NS = 'http://www.w3.org/2000/svg';

var animationPid = undefined;
var obstaclePid = undefined;

// List of all obstacles currently on the landscape.
var obstacles = [];

// Object class for an obstacle.
function Obstacle(type) {
  if (type == 1) {
    this.height = 30;
    this.altitude = 0;
  } else if (type === 2) {
    this.height = 30;
    this.altitude = 30;
  }
  this.width = 20;

  this.startTime = undefined;
  this.x = LANDSCAPE_WIDTH + LANDSCAPE_MARGIN;
  this.y = GROUND_LEVEL - this.height;

  var g = document.getElementById('obstacles');
  // <rect class="obstacle"></rect>
  var element = document.createElementNS(SVG_NS, 'rect');
  element.setAttribute('x', this.x);
  element.setAttribute('y', GROUND_LEVEL - this.height - this.altitude);
  element.setAttribute('height', this.height);
  element.setAttribute('width', this.width);
  element.setAttribute('class', 'obstacle');
  element.setAttribute('rx', 5);
  element.setAttribute('ry', 5);
  g.appendChild(element);
  this.element = element;
}

// Destroy this obstacle.
Obstacle.prototype.destroy = function() {
  this.element.parentNode.removeChild(this.element);
  this.element = null;
};

// On page load, initialize the event handlers and show the start button.
function init() {
  fixLinks();

  var m = document.cookie.match(/difficulty=([012])/);
  var difficultyIndex = m ? m[1] : 0;
  SPEED = [0.7, 1, 2][difficultyIndex];
  var difficultySelect = document.getElementById('difficulty');
  difficultySelect.selectedIndex = difficultyIndex;
  difficultySelect.addEventListener('change', setDifficulty);

  document.addEventListener('keydown', keyDown);
  document.addEventListener('keyup', keyUp);
  document.addEventListener('keypress', keyPress);

  document.getElementById('start').addEventListener('click', startGame);
  showStart();
  initLandscape();
}
window.addEventListener('load', init);

// Initial setup of the landscape.
function initLandscape() {
  // Create dinosaur.
  // <rect id="dinosaur"></rect>
  var g = document.getElementById('dino');
  var element = document.createElementNS(SVG_NS, 'rect');
  element.setAttribute('x', DINO_CENTER_X - STAND_WIDTH / 2);
  element.setAttribute('y', GROUND_LEVEL - STAND_HEIGHT);
  element.setAttribute('height', STAND_HEIGHT);
  element.setAttribute('width', STAND_WIDTH);
  element.setAttribute('rx', 5);
  element.setAttribute('ry', 5);
  element.setAttribute('class', 'dinosaur');
  g.appendChild(element);
  dino.element = element;

  // Create temporary ground line.
  var g = document.getElementById('ground');
  makeGroundLine(g, 0, LANDSCAPE_WIDTH);
}

// Show the start button.
function showStart() {
  document.body.className = '';
  var startButton = document.getElementById('start');
  startButton.style.display = '';
  mode = modes.START;
}

// Hide the start button, and start the game.
function startGame() {
  var startButton = document.getElementById('start');
  startButton.style.display = 'none';
  mode = modes.PLAYING;
  for (var i = 0, obstacle; (obstacle = obstacles[i]); i++) {
    obstacle.destroy();
  }
  obstacles.length = 0;
  animationPid = requestAnimationFrame(drawFrame);
  createObstacle();
}

// Update the display.
// This involves updating the dinosaur, obstacles and ground.
function drawFrame(timestamp) {
  // Update dinosaur.
  if (dino.jumpStart === 0) {
    dino.jumpStart = timestamp;
  }
  var crouching = dino.crouching;
  var dinoY = GROUND_LEVEL - STAND_HEIGHT;
  if (dino.jumpStart !== undefined) {
    var scaledDuration = HALF_JUMP_DURATION / SPEED;
    var jumpElapsed = timestamp - dino.jumpStart - scaledDuration;
    if (jumpElapsed > scaledDuration) {
      dino.jumpStart = undefined;
      dino.rotation = 0;
    } else {
      var scale = scaledDuration * scaledDuration;
      var parabolaHeight = JUMP_HEIGHT -
          jumpElapsed * jumpElapsed * JUMP_HEIGHT / scale;
      parabolaHeight = Math.max(0, Math.round(parabolaHeight));
      dinoY -= parabolaHeight;
      dino.rotation = (jumpElapsed / scaledDuration + 1) / 2 * 180;
    }
    crouching = false;
  }
  var dinoHeight = STAND_HEIGHT;
  var dinoWidth = STAND_WIDTH;
  if (crouching) {
    dinoY += STAND_HEIGHT - CROUCH_HEIGHT;
    dinoHeight = CROUCH_HEIGHT;
    dinoWidth = CROUCH_WIDTH;
  }
  dino.element.setAttribute('height', dinoHeight);
  dino.element.setAttribute('width', dinoWidth);
  dino.element.setAttribute('y', dinoY);
  dino.element.setAttribute('x', DINO_CENTER_X - dinoWidth / 2);
  dino.element.setAttribute('transform', 'rotate(' + dino.rotation + ', ' +
    DINO_CENTER_X + ', ' + (dinoY + dinoHeight / 2) + ')');

  // Update obstacles.
  for (var i = obstacles.length - 1; i >= 0; i--) {
    var obstacle = obstacles[i];
    if (obstacle.startTime === undefined) {
      obstacle.startTime = timestamp;
    }
    var obstacleElapsed = timestamp - obstacle.startTime;
    var x = LANDSCAPE_WIDTH - (obstacleElapsed / SCROLL_SPEED * SPEED);
    if (x < -LANDSCAPE_MARGIN) {
      obstacles.splice(i, 1);
      obstacle.destroy();
    } else {
      obstacle.element.setAttribute('x', x);
      // Collision detection.  Very forgiving of minor clipping.
      if (DINO_CENTER_X > x && DINO_CENTER_X < x + obstacle.width) {
        // X axis overlap.  Check y.
        var dinoTop = dinoY;
        var dinoBottom = dinoY + STAND_WIDTH;  // Dino is rotated 90 deg at apogee.
        var obstacleTop = GROUND_LEVEL - obstacle.altitude - obstacle.height;
        var obstacleBottom = GROUND_LEVEL - obstacle.altitude;
        if ((dinoTop >= obstacleTop && dinoTop <= obstacleBottom) ||
            (dinoBottom >= obstacleTop && dinoBottom <= obstacleBottom) ||
            (dinoTop <= obstacleTop && dinoBottom >= obstacleBottom)) {
          fail();
          return;
        }
      }
    }
  }

  // Update ground.
  var groundScroll = timestamp / SCROLL_SPEED * SPEED;
  var g = document.getElementById('ground');
  while (g.firstChild) {
    g.removeChild(g.firstChild);
  }
  var GROUND_GAP = 30;
  for (var i = 0; i < 4; i++) {
    var ground = groundScroll % GROUND_GAP + GROUND_GAP * i;
    makeGroundLine(g, LANDSCAPE_WIDTH - ground / 1.5, LANDSCAPE_WIDTH - ground);
    var ground = -groundScroll % GROUND_GAP + GROUND_GAP * i;
    makeGroundLine(g, ground / 1.5, ground);
  }

  animationPid = requestAnimationFrame(drawFrame);
}

// Draw one line that makes up the ground.
function makeGroundLine(parent, start, end) {
  // <line x1="?" y1=140 x2="?" y2=140></line>
  var line = document.createElementNS(SVG_NS, 'line');
  line.setAttribute('x1', start);
  line.setAttribute('x2', end);
  line.setAttribute('y1', GROUND_LEVEL);
  line.setAttribute('y2', GROUND_LEVEL);
  parent.appendChild(line);
}

// Dinosaur crashed into obstacle.  End game, show start button.
function fail() {
  cancelAnimationFrame(animationPid);
  clearTimeout(obstaclePid);
  document.body.className = 'shake';
  document.getElementById('crash').play();
  mode = modes.STOPPED;
  setTimeout(showStart, 1000);
}

// User pressed space or enter to start game.
function keyPress(e) {
  if (mode === modes.START && (e.key === 'Enter' || e.key === ' ')) {
    startGame();
    e.preventDefault();
  }
}

// Create a new random obstacle and add it to the list of obstacles.
function createObstacle() {
  var type = Math.random() < 0.75 ? 1 : 2;
  obstacles.push(new Obstacle(type));
  var randomInterval = Math.random() * (MAX_OBSTACLE_INTERVAL - MIN_OBSTACLE_INTERVAL);
  obstaclePid = setTimeout(createObstacle, (MIN_OBSTACLE_INTERVAL + randomInterval) / SPEED);
}

// User pressed a key to start a jump, or start crouching.
function keyDown(e) {
  if (e.repeat) {
    return;
  }
  switch (e.key) {
    case('ArrowUp'):
    case(' '):
      jump();
      break;
    case('ArrowDown'):
      dino.crouching = true;
      break;
    default:
      return;
  }
  e.preventDefault();
}

// User releases a key to stop crouching.
function keyUp(e) {
  if (e.repeat) {
    return;
  }
  switch (e.key) {
    case('ArrowDown'):
      dino.crouching = false;
      break;
    default:
      return;
  }
  e.preventDefault();
}

// Start a jump right now.
function jump() {
  if (dino.jumpStart === undefined) {
    dino.jumpStart = 0;
  }
}
