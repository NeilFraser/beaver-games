/**
 * @license
 * Copyright 2020 Neil Fraser
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @fileoverview Shunting game.
 * @author root@neil.fraser.name (Neil Fraser)
 */
'use strict';

// Namespace for SVG elements.
var SVG_NS = 'http://www.w3.org/2000/svg';

// Standard Lego curve radius.
var RADIUS = 40;
// Enough room for a 9 car train to drive offscreen.
var HEADSHUNT_OVERFLOW = 150;

// Coordinates of each section of track.
// ['line', startX, startY, deltaX, deltaY]
// ['curve', centerX, centerY, startDegrees, deltaDegrees]
var PATH_SEGMENTS = [
  ['line', 8, 103 + HEADSHUNT_OVERFLOW, 0, -HEADSHUNT_OVERFLOW], // 0:  Headshunt overflow
  ['line', 8, 103, 0, -2 * 16],              // 1:  Headshunt straight
  ['curve', 48, 71, 180, 45],                // 2:  Headshunt curve
  ['line', 19.716, 42.716, 22.627, -22.628], // 3:  Turnout #1 straight
  ['curve', 70.627, 48.372, 225, 45],        // 4:  Siding A curve
  ['line', 70.627, 8.372, 3 * 16 + 1, 0],    // 5:  Siding A straight
  ['curve', 48, 71, 225, 45],                // 6:  Turnout #1 curve
  ['line', 48, 31, 2 * 16, 0],               // 7:  Turnout #2 straight
  ['line', 48 + 2 * 16, 31, 3 * 16 + 1, 0],  // 8:  Siding B
  ['curve', 48, 71, 270, 45],                // 9:  Turnout #2 curve
  ['curve', 104.568, 14.431, 135, -45],      // 10: Siding C curve
  ['line', 104.568, 54.431, 16 + 1, 0]       // 11: Siding C straight
];

// Paths to reach each siding.
var PATH_A = [0, 1, 2, 3, 4, 5];
var PATH_B = [0, 1, 2, 6, 7, 8];
var PATH_C = [0, 1, 2, 6, 9, 10, 11];

// True is straight, false is curve.
var turnout1State = false;
var turnout2State = true;

// Is this segment before the first turnout?
function isBeforeTurnout1(segmentIndex) {
  return segmentIndex < 3;
}

// Is this segment before the second turnout?
function isBeforeTurnout2(segmentIndex) {
  return segmentIndex < 7;
}

// On page load, initialize the event handlers and show the start button.
function init() {
  fixLinks();

  me = document.createElementNS(SVG_NS, 'circle');
  me.setAttribute('r', '1');
  document.getElementById('trainGroup').appendChild(me);
  run();
}
window.addEventListener('load', init);

var me;
var dist = 0;
var dir = 1;
function run() {
  var xy = calculateCoordinates(dist)
  if (xy) {
    me.setAttribute('cx', xy.x);
    me.setAttribute('cy', xy.y);
  } else {
    dir *= -1;
  }
  dist += dir;
  setTimeout(run, 100)
}

// Given the state of the turnouts, return the current path.
function getPath() {
  return turnout1State ? PATH_A : turnout2State ? PATH_B : PATH_C;
}

// Calculate the length of a line or curve segment.
function calculateLength(segment) {
  var type = segment[0];
  if (type === 'line') {
    var deltaX = segment[3];
    var deltaY = segment[4];
    return Math.sqrt(deltaX * deltaX + deltaY * deltaY);
  } else if (type === 'curve') {
    var arc = Math.abs(segment[4]);
    arc = arc / 180 * Math.PI;
    return RADIUS * arc;
  }
  throw TypeError(type);
}

// Precalculate all the lengths and store as a property on each segment.
for (var i = 0; i < PATH_SEGMENTS.length; i++) {
  var segment = PATH_SEGMENTS[i];
  segment.calculatedLength = calculateLength(segment);
}

//
function calculateCoordinates(distance) {
  distance += HEADSHUNT_OVERFLOW;
  if (distance < 0) {
    // Ran off the headshunt end.
    return NaN;
  }
  var path = getPath();
  for (var i = 0; i < path.length; i++) {
    var segment = PATH_SEGMENTS[path[i]];
    if (distance > segment.calculatedLength) {
      distance -= segment.calculatedLength;
    } else {
      return calculateCoordinatesForSegment(segment, distance);
    }
  }
  // Ran over the buffers.
  return NaN;
}

function calculateCoordinatesForSegment(segment, distance) {
  var type = segment[0];
  var fraction = distance / segment.calculatedLength;
  if (type === 'line') {
    var startX = segment[1];
    var startY = segment[2];
    var deltaX = segment[3] * fraction;
    var deltaY = segment[4] * fraction;
    return {
      x: startX + deltaX,
      y: startY + deltaY
    };
  } else if (type === 'curve') {
    var centerX = segment[1];
    var centerY = segment[2];
    var startDegrees = segment[3];
    var deltaDegrees = segment[4] * fraction;
    var radians = (startDegrees + deltaDegrees) / 180 * Math.PI;
    return {
      x: centerX + Math.cos(radians) * RADIUS,
      y: centerY + Math.sin(radians) * RADIUS
    };
  }
  throw TypeError(type);
}
