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

var HALF_JUMP_DURATION = 500;

var MIN_OBSTACLE_INTERVAL = 1000;
var MAX_OBSTACLE_INTERVAL = 2000;

var GROUND_LEVEL = 140;

var STAND_HEIGHT = 40;

var CROUCH_HEIGHT = 20;

var STAND_WIDTH = 20;

var CROUCH_WIDTH = 30;

var DINO_CENTER_X = 80;

var LANDSCAPE_MARGIN = 50;

var LANDSCAPE_WIDTH = 800;

var dino = {
  element: null,
  jumpStart: undefined,
  crouching: false,
  rotation: 0
};

var animationPid = undefined;
var obstaclePid = undefined;

var obstacles = [];

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

  var svg = document.getElementById('landscape');
  var svgNS = svg.namespaceURI;
  var g = document.getElementById('obstacles');
  // <rect class="obstacle"></rect>
  var element = document.createElementNS(svgNS, 'rect');
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

function initLandscape() {
  var svg = document.getElementById('landscape');
  var svgNS = svg.namespaceURI;
  var g = document.getElementById('dino');
  // <rect id="dinosaur"></rect>
  var element = document.createElementNS(svgNS, 'rect');
  element.setAttribute('x', DINO_CENTER_X - STAND_WIDTH / 2);
  element.setAttribute('y', GROUND_LEVEL - STAND_HEIGHT);
  element.setAttribute('height', STAND_HEIGHT);
  element.setAttribute('width', STAND_WIDTH);
  element.setAttribute('rx', 5);
  element.setAttribute('ry', 5);
  element.setAttribute('class', 'dinosaur');
  g.appendChild(element);
  dino.element = element;

  var g = document.getElementById('ground');
  // <line x1="10" y1=140 x2="990" y2=140></line>
  var line = document.createElementNS(svgNS, 'line');
  line.setAttribute('x1', 0);
  line.setAttribute('x2', LANDSCAPE_WIDTH);
  line.setAttribute('y1', GROUND_LEVEL);
  line.setAttribute('y2', GROUND_LEVEL);
  g.appendChild(line);
}

// Show the start button and disable the controls.
function showStart() {
  document.body.className = '';
  var startButton = document.getElementById('start');
  startButton.style.display = '';
  mode = modes.START;
}

// Hide the start button, and start the computer's turn.
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

  animationPid = requestAnimationFrame(drawFrame);
}

// Human pressed the wrong note.  End game, show start button.
function fail() {
  cancelAnimationFrame(animationPid);
  clearTimeout(obstaclePid);
  document.body.className = 'shake';
  document.getElementById('crash').play();
  mode = modes.STOPPED;
  setTimeout(showStart, 1000);
}

// Human pressed space or enter to start game.
function keyPress(e) {
  if (mode === modes.START && (e.key === 'Enter' || e.key === ' ')) {
    startGame();
    e.preventDefault();
  }
}

function createObstacle() {
  var type = Math.random() < 0.75 ? 1 : 2;
  obstacles.push(new Obstacle(type));
  var randomInterval = Math.random() * (MAX_OBSTACLE_INTERVAL - MIN_OBSTACLE_INTERVAL);
  obstaclePid = setTimeout(createObstacle, (MIN_OBSTACLE_INTERVAL + randomInterval) / SPEED);
}

// Human pressed a cursor key down to start a note playing.
// Map this onto an HTML button push.
function keyDown(e) {
  if (e.repeat) {
    return;
  }
  switch (e.key) {
    case('ArrowUp'):
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

// Human pressed a cursor key down to start a note playing.
// Map this onto an HTML button push.
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

function jump() {
  if (dino.jumpStart === undefined) {
    dino.jumpStart = 0;
  }
}
