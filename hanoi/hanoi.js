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
var canvasHeight = 512;
var canvasWidth = 1024;
var diskThickness = 25;
var viewAngle = 10;  // Degrees.

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

  // Create the disks.
  for (var i = totalDisks - 1; i >= 0; i--) {
    new Disk(i, totalDisks);
  }

  // Calculate the x locations of the three pegs.
  for (var i = 0; i < pegs.length; i++) {
    pegX[i] = canvasWidth / pegs.length * i + canvasWidth / (pegs.length * 2);
  }

  document.addEventListener('keypress', onKeypress);
  canvas = document.getElementById('canvas');
  canvas.addEventListener('click', onClick);
  canvas.setAttribute('height', canvasHeight);
  canvas.setAttribute('width', canvasWidth);
  ctx = canvas.getContext('2d');
  requestAnimationFrame(frame);
}
window.addEventListener('load', init);

var startTime;

function frame(timestamp) {
  if (startTime === undefined) {
    startTime = timestamp;
  }
  var elapsedTime = timestamp - startTime;
  var angle = elapsedTime / 10 % 360;

  canvas.width = canvas.width;  // Clear the canvas.

  ctx.translate(0, canvasHeight * 0.8);
  for (var i = 0; i < pegs.length; i++) {
    ctx.save();
    ctx.translate(pegX[i], 0);
    drawSpot();
    for (var j = 0; j < pegs[i].length; j++) {
      var disk = pegs[i][j];
      ctx.save();
      ctx.translate(0, -j * diskThickness);
      disk.drawDisk(viewAngle);
      ctx.restore();
    }
    ctx.restore();
  }

  if (selectedDisk) {
    ctx.save();
    ctx.translate(pegX[selectedDisk.peg], (pegs[selectedDisk.peg].length + 1) * -diskThickness);
    selectedDisk.drawDisk(viewAngle);
    ctx.restore();
  }

  requestAnimationFrame(frame);
}

// Event handler for mouse clicks.
function onClick(e) {
  // Divide the canvas into thirds.
  var third = Math.floor(e.offsetX / canvasWidth * pegs.length)
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
    var topDisk = peg[peg.length - 1];
    if (topDisk && (topDisk.n < selectedDisk.n)) {
      // Can't place a big disk on a smaller one.
      return;
    }
    peg.push(selectedDisk);
    selectedDisk.peg = n;
    selectedDisk = undefined;
    checkWin();
  } else {
    // Might be undefined.
    selectedDisk = peg.pop();
  }
}

function checkWin() {
  for (var i = 0; i < pegs.length; i++) {
    if (lastCompletePeg !== i && pegs[i].length === totalDisks) {
      lastCompletePeg = i;
      document.getElementById('win').play();
    }
  }

}

function Disk(n, total) {
  this.n = n;
  var maxRadius = canvasWidth / 6;
  var minRadius = maxRadius / 10;
  this.radius = (maxRadius - minRadius) / (total + 2) * (n + 1) + minRadius;
  this.peg = 0;  // 0, 1, 2
  pegs[this.peg].push(this);
  disks.push(this);
  if (n === 0) {
    this.fillColour = '#F0A609';
  } else {
    this.fillColour = n % 2 ? '#178F47' : '#2E5FFF';
  }
  this.strokeColour = '#666';
}

Disk.prototype.drawDisk = function(degrees) {
  ctx.fillStyle = this.fillColour;
  ctx.strokeStyle = this.strokeColour;
  ctx.lineWidth = 1;

  var radians = degrees / 180 * Math.PI
  var ratio = Math.sin(radians);
  var height = Math.abs(this.radius * ratio);
  var halfVisualThickness = Math.cos(radians) * ((diskThickness - 1) / 2);
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

function drawSpot() {
  ctx.strokeStyle = '#ccc';
  ctx.lineWidth = 1;

  var radians = viewAngle / 180 * Math.PI
  var ratio = Math.sin(radians);
  var radius = disks[0].radius;
  var height = Math.abs(radius * ratio);
  var halfVisualThickness = Math.cos(radians) * ((diskThickness - 1) / 2);
  var bottomY = viewAngle > 180 ? -halfVisualThickness : halfVisualThickness;

  ctx.beginPath();
  ctx.ellipse(0, bottomY, radius, height, 0, 0, 2 * Math.PI);
  ctx.stroke();
};
