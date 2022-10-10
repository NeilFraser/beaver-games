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

// Array of both turnouts.
var turnouts = [];

// Turnout object.
var Turnout = function(node) {
  // Get references to key nodes used in switching.
  this.pointStraight_ = node.getElementsByClassName('pointStraight')[0];
  this.pointCurve_ = node.getElementsByClassName('pointCurve')[0];
  this.control_ = node.getElementsByClassName('control')[0];
  var clickTarget = node.getElementsByClassName('clickTarget')[0];
  clickTarget.addEventListener('click', this.toggle.bind(this));
  this.set(true);
};

// True is straight, false is curve.
Turnout.prototype.set = function(state) {
  this.state = state;
  if (state) {
    this.control_.setAttribute('cx', 9);
    this.pointStraight_.setAttribute('d', 'M 6,0 H 7 V 32 H 6 Z');
    this.pointCurve_.setAttribute('d', 'M 2.5,30.5 C 2.401,27.119 2.524,22.871 2.961,19.163 5.016,12.594 8.637,6.551 13.594,1.594 l 0.707,0.707 C 9.449,7.163 5.904,13.127 3.898,19.63 3.231,22.843 3.003,27.002 3,30.5 Z');
  } else {
    this.control_.setAttribute('cx', 11);
    this.pointStraight_.setAttribute('d', 'M 6,0 H 7 L 7,20 5.5,30.5 H 5 L 6,20 Z');
    this.pointCurve_.setAttribute('d', 'M 1,32 C 1,20.596 5.53,9.658 13.594,1.594 l 0.707,0.707 C 6.49,10.128 2.066,20.811 2,32 Z');
  }
};

Turnout.prototype.toggle = function() {
  this.set(!this.state);
};

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
  drawTrack('straight', 'translate(4, 87)');
  drawTrack('straight', 'translate(4, 71)');
  drawTrack('curve', 'translate(4, 51)');

  drawTrack('curve', 'rotate(22.5, -82.197, 55.555)');
  var turnout1Node = drawTrack('turnout', 'rotate(45, -1.077, 56.328)');
  drawTrack('curve', 'rotate(45, 23.065, 66.328)');
  drawTrack('curve', 'rotate(67.5, 36.082, 54.112)');
  drawTrack('straight', 'rotate(90, 41.127, 45.5)');
  drawTrack('straight', 'rotate(90, 49.127, 53.5)');
  drawTrack('straight', 'rotate(90, 57.127, 61.5)');
  drawTrack('buffer', 'rotate(90, 59.627, 64)');

  var turnout2Node = drawTrack('turnout', 'rotate(90, 26.5, 53.5)');
  drawTrack('straight', 'rotate(90, 34.5, 61.5)');
  drawTrack('straight', 'rotate(90, 42.5, 69.5)');
  drawTrack('straight', 'rotate(90, 50.5, 77.5)');
  drawTrack('buffer', 'rotate(90, 53, 80)');

  drawTrack('curve', 'rotate(-67.5, 70.117, -28.108)');
  drawTrack('curve', 'rotate(-90, 71.5, -13.068)');
  drawTrack('straight', 'rotate(90, 35.068, 85.5)');
  drawTrack('buffer', 'rotate(90, 37.568, 88)');

  turnouts.push(new Turnout(turnout1Node), new Turnout(turnout2Node));


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

// Draw a track segment onto the display.  Return the 'use' or 'g' node.
function drawTrack(defId, transform) {
  if (defId === 'turnout') {
    // Turnouts need to be cloned since they have a moving control.
    var node = document.getElementById(defId).cloneNode(true);
  } else {
    // Other track segments can just be 'use' nodes.
    var node = document.createElementNS(SVG_NS, 'use');
    node.setAttribute('href', '#' +  defId);
  }
  node.setAttribute('transform', transform);
  document.getElementById('trackGroup').appendChild(node);
  return node;
}

// Given the state of the turnouts, return the current path.
function getPath() {
  return turnouts[0].state ? PATH_A : turnouts[1].state ? PATH_B : PATH_C;
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
