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

let canvas;
let ctx;
const CANVAS_HEIGHT = 512;
const CANVAS_WIDTH = 1024;
const DISK_THICKNESS = 25;
const VIEW_ANGLE = 10;  // Degrees.
const RAISE_HEIGHT = DISK_THICKNESS;
const SPEED = 1.0;  // Smaller is faster.

let totalDisks = 5;
const pegX = [];  // Horizontal locations of the three pegs.
const pegs = [[], [], []];  // Each peg holds an array of disks.
let selectedDisk = undefined;  // Currently raised disk.
let lastCompletePeg = 0;  // Which peg last held the entire stack.

// Start-up initialization code.  Run once.
function init() {
  fixLinks();

  // Configure difficulty mode.
  const m = document.cookie.match(/disks=(\d+)/);
  const cookieDisks = m ? Number(m[1]) : 0;
  totalDisks = cookieDisks > 0 ? cookieDisks : totalDisks;
  const options = document.getElementById('disks').options;
  for (const option of options) {
    option.selected = (option.value == totalDisks);
  }
  registerOptions('disks');


  // Calculate the x locations of the three pegs.
  for (let i = 0; i < pegs.length; i++) {
    pegX[i] = CANVAS_WIDTH / pegs.length * i + CANVAS_WIDTH / (pegs.length * 2);
  }

  // Create the disks.
  for (let i = totalDisks - 1; i >= 0; i--) {
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

let lastTime;

// Clear and redraw everything.  One animation frame.
function frame(timestamp) {
  const elapsedTime = lastTime === undefined ? 0 : timestamp - lastTime;
  const delta = elapsedTime ? elapsedTime / SPEED : 0;
  lastTime = timestamp;

  canvas.width = canvas.width;  // Clear the canvas.

  ctx.translate(0, CANVAS_HEIGHT * 0.8);
  // Draw the landing spots.
  for (let i = 0; i < pegs.length; i++) {
    ctx.save();
    ctx.translate(pegX[i], 0);
    drawSpot();
    ctx.restore();
  }

  // Draw the disks.
  for (const peg of pegs) {
    for (const disk of peg) {
      let pitchDegrees = VIEW_ANGLE;
      let rollDegrees = 0;

      const deltaX = delta;
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
        const distanceX = disk.targetX - disk.sourceX;
        // Flip disk in flight if it is its first move and not the top disk.
        let peakDenominator = 4;
        if (disk.isFirstMove && disk.n !== 0) {
          const distanceRatio = (disk.x - disk.sourceX) / distanceX;
          pitchDegrees -= distanceRatio * (VIEW_ANGLE * 2);
          rollDegrees = distanceRatio * 180;
          if (distanceX < 0) rollDegrees *= -1;
          // Raise the arc a bit if there's a flip.
          peakDenominator = 3;
        }

        // Moving parabolically to a new peg.
        const peakX = disk.sourceX + (distanceX / 2);
        const averageY = (disk.targetY + disk.sourceY) / 2;
        const peakY = averageY + Math.abs(distanceX / peakDenominator);
        const y = computeParabolaY(disk.x,
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
  const denom = (x1 - x2) * (x1 - x3) * (x2 - x3);
  const a = (x3 * (y2 - y1) + x2 * (y1 - y3) + x1 * (y3 - y2)) / denom;
  const b = (x3 * x3 * (y1 - y2) + x2 * x2 * (y3 - y1) + x1 * x1 * (y2 - y3)) /
      denom;
  const c = (x2 * x3 * (x2 - x3) * y1 + x3 * x1 * (x3 - x1) * y2 + x1 * x2 *
      (x1 - x2) * y3) / denom;
  return a * x * x + b * x + c;
}

// Event handler for mouse clicks.
function onClick(e) {
  // Divide the canvas into thirds.
  let third = Math.floor(e.offsetX / CANVAS_WIDTH * pegs.length)
  third = Math.min(pegs.length - 1, Math.max(0, third));
  input(third);
}

// Event handler for '1', '2', '3' keys.
function onKeypress(e) {
  const third = Number(e.key);
  if (third > 0 && third <= pegs.length) {
    input(third - 1);
  }
}

// User has signaled a move to/from this peg.
function input(n) {
  const peg = pegs[n];
  if (selectedDisk) {
    // Verify we aren't placing a big disk on a smaller one.
    const topDisk = peg.at(-1);
    if (topDisk && (topDisk.n < selectedDisk.n)) {
      return;
    }

    // Remove the selected disk from its current peg (should be the top disk).
    const oldPeg = pegs[selectedDisk.peg];
    const i = oldPeg.indexOf(selectedDisk);
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
    selectedDisk = peg.at(-1);
    if (selectedDisk) {
      selectedDisk.isRaised = true;
      selectedDisk.setTarget();
    }
  }
}

// Are all the completely disks stacked in on a new peg?
// If so, play the win sound.
function checkWin() {
  for (let i = 0; i < pegs.length; i++) {
    const peg = pegs[i];
    if (lastCompletePeg !== i && peg.length === totalDisks) {
      lastCompletePeg = i;
      // Slight delay to let the animation for this move to play out.
      setTimeout(function() {
        document.getElementById('win').play();
      }, 500);

      // Reset disk move status.
      for (const disk of peg) {
        disk.hasMoved = false;
        disk.isFirstMove = true;
      }
    }
  }

}

// Class for a disk.
function Disk(n, total) {
  this.n = n;  // 0 is the smallest disk.
  const maxRadius = CANVAS_WIDTH / 6;
  const minRadius = maxRadius / 10;
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
  const pitchRadians = pitchDegrees / 180 * Math.PI;
  const rollRadians = rollDegrees / 180 * Math.PI;

  ctx.fillStyle = this.fillColour;
  ctx.strokeStyle = this.strokeColour;
  ctx.lineWidth = 1;

  const radius = this.radius;
  const ratio = Math.sin(pitchRadians);
  const height = Math.abs(radius * ratio);
  const halfVisualThickness = Math.cos(pitchRadians) * ((DISK_THICKNESS - 1) / 2);
  const topY = pitchDegrees > 180 ? halfVisualThickness : -halfVisualThickness;
  const bottomY = -topY;

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
  const radius = Math.max(0, ...pegs.map(peg => peg[0] ? peg[0].radius : 0));

  const pitchRadians = VIEW_ANGLE / 180 * Math.PI;
  const ratio = Math.sin(pitchRadians);
  const height = Math.abs(radius * ratio);
  const halfVisualThickness = Math.cos(pitchRadians) * ((DISK_THICKNESS - 1) / 2);
  const bottomY = VIEW_ANGLE > 180 ? -halfVisualThickness : halfVisualThickness;

  ctx.strokeStyle = '#ccc';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.ellipse(0, bottomY, radius, height, 0, 0, 2 * Math.PI);
  ctx.stroke();
};
