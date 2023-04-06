/**
 * @license
 * Copyright 2023 Neil Fraser
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @fileoverview Hanoi.
 * @author root@neil.fraser.name (Neil Fraser)
 */
'use strict';

var canvas;
var ctx;
var CANVAS_HEIGHT = 512;
var CANVAS_WIDTH = 1024;
var DISK_THICKNESS = 25;
var VIEW_ANGLE = 10;  // Degrees.
var RAISE_HEIGHT = DISK_THICKNESS;
var SPEED = 1.0;  // Smaller is faster.

var totalDisks = 5;
var disks = [];
var pegX = [];
var pegs = [[], [], []];
var selectedDisk = undefined;
var lastCompletePeg = 0;

// Start-up initialization code.  Run once.
function init() {
  fixLinks();

  // Configure difficulty mode.
  var m = document.cookie.match(/disks=(\d+)/);
  totalDisks = Number(m ? m[1] : totalDisks);
  var options =  document.getElementById('disks').options;
  for (var i = 0; i < options.length; i++) {
    options[i].selected = (options[i].value == totalDisks);
  }
  registerOptions('disks');


  // Calculate the x locations of the three pegs.
  for (var i = 0; i < pegs.length; i++) {
    pegX[i] = CANVAS_WIDTH / pegs.length * i + CANVAS_WIDTH / (pegs.length * 2);
  }

  // Create the disks.
  for (var i = totalDisks - 1; i >= 0; i--) {
    new Disk(i, totalDisks);
  }

  document.addEventListener('keypress', onKeypress);
  canvas = document.getElementById('canvas');
  canvas.addEventListener('click', onClick);
  canvas.setAttribute('height', CANVAS_HEIGHT);
  canvas.setAttribute('width', CANVAS_WIDTH);
  ctx = canvas.getContext('2d');
  requestAnimationFrame(frame);
}
window.addEventListener('load', init);

var lastTime;

function frame(timestamp) {
  var delta;
  if (lastTime === undefined) {
    delta = 0;
  } else {
    var elapsedTime = timestamp - lastTime;
    delta = elapsedTime ? elapsedTime / SPEED : 0;
  }
  lastTime = timestamp;

  canvas.width = canvas.width;  // Clear the canvas.

  ctx.translate(0, CANVAS_HEIGHT * 0.8);
  // Draw the spots.
  for (var i = 0; i < pegs.length; i++) {
    ctx.save();
    ctx.translate(pegX[i], 0);
    drawSpot();
    ctx.restore();
  }

  // Draw the disks.
  for (var i = 0; i < pegs.length; i++) {
    for (var j = 0; j < pegs[i].length; j++) {
      var disk = pegs[i][j];
      var deltaX = delta;
      var deltaY = delta * disk.targetRatio;
      if (disk.x === undefined) {
        disk.x = disk.targetX;
      } else if (disk.targetX > disk.x) {
        disk.x = Math.min(disk.x + deltaX, disk.targetX);
      } else if (disk.targetX < disk.x) {
        disk.x = Math.max(disk.x - deltaX, disk.targetX);
      }
      if (disk.y === undefined) {
        disk.y = disk.targetY;
      } else if (disk.targetY > disk.y) {
        disk.y = Math.min(disk.y + deltaY, disk.targetY);
      } else if (disk.targetY < disk.y) {
        disk.y = Math.max(disk.y - deltaY, disk.targetY);
      }
      ctx.save();
      ctx.translate(disk.x, -disk.y);
      disk.drawDisk(VIEW_ANGLE);
      ctx.restore();
    }
  }

  requestAnimationFrame(frame);
}

// Event handler for mouse clicks.
function onClick(e) {
  // Divide the canvas into thirds.
  var third = Math.floor(e.offsetX / CANVAS_WIDTH * pegs.length)
  third = Math.min(pegs.length - 1, Math.max(0, third));
  input(third);
}

// Event handler for '1', '2', '3' keys.
function onKeypress(e) {
  var third = Number(e.key);
  if (third > 0 && third <= pegs.length) {
    input(third - 1);
  }
}

// User has signaled a move to/from this peg.
function input(n) {
  var peg = pegs[n];
  if (selectedDisk) {
    // Verify we aren't placing a big disk on a smaller one.
    var topDisk = peg[peg.length - 1];
    if (topDisk && (topDisk.n < selectedDisk.n)) {
      return;
    }

    // Remove the selected disk from its current peg (should be the top disk).
    var oldPeg = pegs[selectedDisk.peg];
    var i = oldPeg.indexOf(selectedDisk);
    oldPeg.splice(i, 1);

    peg.push(selectedDisk);
    selectedDisk.peg = n;
    selectedDisk.isRaised = false;
    selectedDisk.setTarget();
    selectedDisk = undefined;

    checkWin();
  } else {
    // Might be undefined.
    selectedDisk = peg[peg.length - 1];
    if (selectedDisk) {
      selectedDisk.isRaised = true;
      selectedDisk.setTarget();
    }
  }
}

function checkWin() {
  for (var i = 0; i < pegs.length; i++) {
    if (lastCompletePeg !== i && pegs[i].length === totalDisks) {
      lastCompletePeg = i;
      // Slight delay to let the animation for this move to play.
      setTimeout(function() {
        document.getElementById('win').play();
      }, 500);
    }
  }

}

function Disk(n, total) {
  this.n = n;
  var maxRadius = CANVAS_WIDTH / 6;
  var minRadius = maxRadius / 10;
  this.radius = (maxRadius - minRadius) / (total + 2) * (n + 1) + minRadius;
  this.peg = 0;  // 0, 1, 2
  this.isRaised = false;
  this.x = undefined;
  this.y = undefined;
  this.targetX = undefined;
  this.targetY = undefined;
  pegs[this.peg].push(this);
  disks.push(this);
  if (n === 0) {
    // Orange top block.
    this.fillColour = '#F0A609';
    this.strokeColour = '#A37106';
  } else if (n % 2) {
    // Green even blocks.
    this.fillColour = '#178F47';
    this.strokeColour = '#0E5B2D';
  } else {
    // Blue odd blocks.
    this.fillColour = '#2E5FFF';
    this.strokeColour = '#1B3899';
  }
  this.setTarget();
}

Disk.prototype.drawDisk = function(degrees) {
  ctx.fillStyle = this.fillColour;
  ctx.strokeStyle = this.strokeColour;
  ctx.lineWidth = 1;

  var radians = degrees / 180 * Math.PI
  var ratio = Math.sin(radians);
  var height = Math.abs(this.radius * ratio);
  var halfVisualThickness = Math.cos(radians) * ((DISK_THICKNESS - 1) / 2);
  var topY = degrees > 180 ? halfVisualThickness : -halfVisualThickness;
  var bottomY = -topY;

  ctx.beginPath();
  ctx.ellipse(0, bottomY, this.radius, height, 0, 0, 2 * Math.PI);
  ctx.fill();
  ctx.stroke();

  ctx.beginPath();
  ctx.fillRect(-this.radius, topY, this.radius * 2, bottomY - topY);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-this.radius, topY);
  ctx.lineTo(-this.radius, bottomY);
  ctx.moveTo(this.radius, topY);
  ctx.lineTo(this.radius, bottomY);
  ctx.stroke();

  ctx.beginPath();
  ctx.ellipse(0, topY, this.radius, height, 0, 0, 2 * Math.PI);
  ctx.fill();
  ctx.stroke();
};

Disk.prototype.setTarget = function() {
  this.targetX = pegX[this.peg];
  this.targetY = pegs[this.peg].indexOf(this) * DISK_THICKNESS;
  if (this.isRaised) {
    this.targetY += RAISE_HEIGHT;
  }
  var deltaX = this.targetX - this.x;
  var deltaY = this.targetY - this.y;
  if (deltaX === 0) {
    // Straight up or down.
    this.targetRatio = 1;
  } else {
    // Moving to a new peg.
    this.targetRatio = Math.abs(deltaY / deltaX);
  }
};

function drawSpot() {
  ctx.strokeStyle = '#ccc';
  ctx.lineWidth = 1;

  var radians = VIEW_ANGLE / 180 * Math.PI
  var ratio = Math.sin(radians);
  var radius = disks[0].radius;
  var height = Math.abs(radius * ratio);
  var halfVisualThickness = Math.cos(radians) * ((DISK_THICKNESS - 1) / 2);
  var bottomY = VIEW_ANGLE > 180 ? -halfVisualThickness : halfVisualThickness;

  ctx.beginPath();
  ctx.ellipse(0, bottomY, radius, height, 0, 0, 2 * Math.PI);
  ctx.stroke();
};
