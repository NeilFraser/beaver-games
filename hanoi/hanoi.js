/**
 * @license
 * Copyright 2023 Neil Fraser
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @fileoverview Tower of Hanoi.
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
var pegX = [];  // Horizontal locations of the three pegs.
var pegs = [[], [], []];  // Each peg holds an array of disks.
var selectedDisk = undefined;  // Currently raised disk.
var lastCompletePeg = 0;  // Which peg last held the entire stack.

// Start-up initialization code.  Run once.
function init() {
  fixLinks();

  // Configure difficulty mode.
  var m = document.cookie.match(/disks=(\d+)/);
  var cookieDisks = m ? Number(m[1]) : 0;
  totalDisks = cookieDisks > 0 ? cookieDisks : totalDisks;
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

// Clear and redraw everything.  One animation frame.
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
  // Draw the landing spots.
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
      var pitchDegrees = VIEW_ANGLE;
      var rollDegrees = 0;

      var deltaX = delta;
      if (disk.targetX > disk.x) {
        disk.x = Math.min(disk.x + deltaX, disk.targetX);
      } else if (disk.targetX < disk.x) {
        disk.x = Math.max(disk.x - deltaX, disk.targetX);
      }

      if (disk.sourceX === disk.targetX) {
        // Moving straight up or down.
        if (disk.targetY > disk.y) {
          disk.y = Math.min(disk.y + delta, disk.targetY);
        } else if (disk.targetY < disk.y) {
          disk.y = Math.max(disk.y - delta, disk.targetY);
        }
      } else {
        var distanceX = disk.targetX - disk.sourceX;
        // Flip disk in flight if it is its first move and not the top disk.
        var peakDenominator = 4;
        if (disk.isFirstMove && disk.n !== 0) {
          var distanceRatio = (disk.x - disk.sourceX) / distanceX;
          pitchDegrees -= distanceRatio * (VIEW_ANGLE * 2);
          rollDegrees = distanceRatio * 180;
          if (distanceX < 0) rollDegrees *= -1;
          // Raise the arc a bit if there's a flip.
          peakDenominator = 3;
        }

        // Moving parabolically to a new peg.
        var peakX = disk.sourceX + (distanceX / 2);
        var averageY = (disk.targetY + disk.sourceY) / 2;
        var peakY = averageY + Math.abs(distanceX / peakDenominator);
        var y = computeParabolaY(disk.x,
            disk.sourceX, disk.sourceY,
            peakX, peakY,
            disk.targetX, disk.targetY);
        disk.y = y;
      }
      ctx.save();
      ctx.translate(disk.x, -disk.y);
      disk.drawDisk(pitchDegrees, rollDegrees);
      ctx.restore();
    }
  }

  requestAnimationFrame(frame);
}

// Compute parabola using the x value and three points.
function computeParabolaY(x, x1, y1, x2, y2, x3, y3) {
  var denom = (x1 - x2) * (x1 - x3) * (x2 - x3);
  var a = (x3 * (y2 - y1) + x2 * (y1 - y3) + x1 * (y3 - y2)) / denom;
  var b = (x3 * x3 * (y1 - y2) + x2 * x2 * (y3 - y1) + x1 * x1 * (y2 - y3)) /
      denom;
  var c = (x2 * x3 * (x2 - x3) * y1 + x3 * x1 * (x3 - x1) * y2 + x1 * x2 *
      (x1 - x2) * y3) / denom;
  return a * x * x + b * x + c;
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
    if (oldPeg !== peg) {
      if (selectedDisk.hasMoved) {
        selectedDisk.isFirstMove = false;
      }
      selectedDisk.hasMoved = true;
    }
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

// Are all the completely disks stacked in on a new peg?
// If so, play the win sound.
function checkWin() {
  for (var i = 0; i < pegs.length; i++) {
    if (lastCompletePeg !== i && pegs[i].length === totalDisks) {
      lastCompletePeg = i;
      // Slight delay to let the animation for this move to play out.
      setTimeout(function() {
        document.getElementById('win').play();
      }, 500);

      // Reset disk move status.
      for (var j = 0; j < pegs[i].length; j++) {
        pegs[i][j].hasMoved = false;
        pegs[i][j].isFirstMove = true;
      }
    }
  }

}

// Class for a disk.
function Disk(n, total) {
  this.n = n;  // 0 is the smallest disk.
  var maxRadius = CANVAS_WIDTH / 6;
  var minRadius = maxRadius / 10;
  this.radius = (maxRadius - minRadius) / (total + 2) * (n + 1) + minRadius;
  this.peg = 0;  // 0, 1, or 2
  this.isRaised = false;
  this.x = undefined;
  this.y = undefined;
  this.targetX = undefined;
  this.targetY = undefined;
  this.sourceX = undefined;
  this.sourceY = undefined;
  this.hasMoved = false;
  this.isFirstMove = true;

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

  pegs[this.peg].push(this);
  this.setTarget();
}

// Draw this disk in the context's current x/y location.
// Provide the pitch and roll in degrees.
Disk.prototype.drawDisk = function(pitchDegrees, rollDegrees) {
  if (pitchDegrees < 0) pitchDegrees += 360;
  if (rollDegrees < 0) rollDegrees += 360;
  var pitchRadians = pitchDegrees / 180 * Math.PI;
  var rollRadians = rollDegrees / 180 * Math.PI;

  ctx.fillStyle = this.fillColour;
  ctx.strokeStyle = this.strokeColour;
  ctx.lineWidth = 1;

  var radius = this.radius;
  var ratio = Math.sin(pitchRadians);
  var height = Math.abs(radius * ratio);
  var halfVisualThickness = Math.cos(pitchRadians) * ((DISK_THICKNESS - 1) / 2);
  var topY = pitchDegrees > 180 ? halfVisualThickness : -halfVisualThickness;
  var bottomY = -topY;

  ctx.rotate(rollRadians);
  ctx.beginPath();
  ctx.ellipse(0, bottomY, radius, height, 0, 0, 2 * Math.PI);
  ctx.fill();
  ctx.stroke();

  ctx.beginPath();
  ctx.fillRect(-radius, topY, radius * 2, bottomY - topY);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-radius, topY);
  ctx.lineTo(-radius, bottomY);
  ctx.moveTo(radius, topY);
  ctx.lineTo(radius, bottomY);
  ctx.stroke();

  ctx.beginPath();
  ctx.ellipse(0, topY, radius, height, 0, 0, 2 * Math.PI);
  ctx.fill();
  ctx.stroke();
};

// The disk has been raised, lowered, or moved to a new peg.
// This function will set the new target location for the following move.
Disk.prototype.setTarget = function() {
  this.targetX = pegX[this.peg];
  this.targetY = pegs[this.peg].indexOf(this) * DISK_THICKNESS;
  if (this.x === undefined) {
    this.x = this.targetX;
  }
  this.sourceX = this.x;
  if (this.y === undefined) {
    this.y = this.targetY;
  }
  this.sourceY = this.y;
  if (this.isRaised) {
    this.targetY += RAISE_HEIGHT;
  }
};

// Draw a landing spot for one peg.
function drawSpot() {
  // Find the radius of the largest disk.
  var radius = 0;
  for (var i = 0; i < pegs.length; i++) {
    if (pegs[i][0]) {
      radius = Math.max(radius, pegs[i][0].radius);
    }
  }

  var pitchRadians = VIEW_ANGLE / 180 * Math.PI;
  var ratio = Math.sin(pitchRadians);
  var height = Math.abs(radius * ratio);
  var halfVisualThickness = Math.cos(pitchRadians) * ((DISK_THICKNESS - 1) / 2);
  var bottomY = VIEW_ANGLE > 180 ? -halfVisualThickness : halfVisualThickness;

  ctx.strokeStyle = '#ccc';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.ellipse(0, bottomY, radius, height, 0, 0, 2 * Math.PI);
  ctx.stroke();
};
