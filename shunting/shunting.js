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

// Colours for each car in the train.
// Should have at least as many colours as TRAIN_LENGTH.
var COLOURS = [
  '#ccb129',  /* HSV: 50, 80, 80 */
  '#29cccc',  /* HSV: 180, 80, 80 */
  '#cc29cc',  /* HSV: 300, 80, 80 */
  '#cc7a29',  /* HSV: 30, 80, 80 */
  '#295fcc',  /* HSV: 220, 80, 80 */
  '#29cc29',  /* HSV: 120, 80, 80 */
  '#cc2929',  /* HSV: 0, 80, 80 */
];
// Locomotive colour.
var LOCO_COLOUR = '#444';
// Colour of extra cars not part of the train.
var SKIP_COLOUR = '#999';

// Number of cars required in final train (not including locomotive).
var TRAIN_LENGTH = 5;
// Number of cars to choose from.
var CAR_COUNT = 8;
var PERMUTATIONS = factorial(CAR_COUNT) / factorial(CAR_COUNT - TRAIN_LENGTH);

// Speed of locomotive.
var MAX_SPEED = 1;
var ACCELERATION = 0.05;

// Array of both turnouts.
var turnouts = [];


var AbstractSegment = function() {};

AbstractSegment.prototype.nextSegment = null;

AbstractSegment.prototype.previousSegment = null;

AbstractSegment.prototype.walk = function(startDistance, delta) {
  var endDistance = startDistance + delta;
  if (endDistance < 0) {
    if (this.previousSegment) {
      return this.previousSegment.walk(
          startDistance + this.previousSegment.length, delta);
    }
    // End of track (headshunt or turnout).
    locoActualSpeed = 0;
    return [this, 0];
  }
  if (endDistance > this.length) {
    if (this.nextSegment) {
      return this.nextSegment.walk(startDistance - this.length, delta);
    }
    // End of track (buffer).
    locoActualSpeed = 0;
    return [this, this.length];
  }
  return [this, endDistance];
};

AbstractSegment.prototype.calculateCoordinates = function(distance) {
  throw Error('Implemented by subclass');
};


var StraightSegment = function(startX, startY, deltaX, deltaY) {
  this.startX = startX;
  this.startY = startY;
  this.deltaX = deltaX;
  this.deltaY = deltaY;
  this.length = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
};
StraightSegment.prototype = new AbstractSegment();

StraightSegment.prototype.calculateCoordinates = function(distance) {
  var fraction = distance / this.length;
  return {
    x: this.startX + this.deltaX * fraction,
    y: this.startY + this.deltaY * fraction
  };
};


var CurveSegment = function(centerX, centerY, startDegrees, deltaDegrees) {
  this.centerX = centerX;
  this.centerY = centerY;
  this.startDegrees = startDegrees;
  this.deltaDegrees = deltaDegrees;
  var arc = Math.abs(deltaDegrees);
  arc = arc / 180 * Math.PI;
  this.length = RADIUS * arc;
};
CurveSegment.prototype = new AbstractSegment();

CurveSegment.prototype.calculateCoordinates = function(distance) {
  var fraction = distance / this.length;
  var arc = (this.startDegrees + this.deltaDegrees * fraction);
  var arc = arc / 180 * Math.PI;
  return {
    x: this.centerX + Math.cos(arc) * RADIUS,
    y: this.centerY + Math.sin(arc) * RADIUS
  };
};

// Turnout object.
var Turnout = function(node,
    rootSegmentIndex, straightSegmentIndex, curveSegmentIndex) {
  // Get references to key nodes used in switching.
  this.pointStraight_ = node.getElementsByClassName('pointStraight')[0];
  this.pointCurve_ = node.getElementsByClassName('pointCurve')[0];
  this.control_ = node.getElementsByClassName('control')[0];
  var clickTarget = node.getElementsByClassName('clickTarget')[0];
  clickTarget.addEventListener('click', this.toggle.bind(this));
  this.rootSegment_ = PATH_SEGMENTS[rootSegmentIndex];
  this.straightSegment_ = PATH_SEGMENTS[straightSegmentIndex];
  this.curveSegment_ = PATH_SEGMENTS[curveSegmentIndex];
  this.set(true);
};

// True is straight, false is curve.
Turnout.prototype.set = function(state) {
  this.state = state;
  if (state) {
    this.control_.setAttribute('cx', 9);
    this.pointStraight_.setAttribute('d', 'M 6,0 H 7 V 32 H 6 Z');
    this.pointCurve_.setAttribute('d', 'M 2.5,30.5 C 2.401,27.119 2.524,22.871 2.961,19.163 5.016,12.594 8.637,6.551 13.594,1.594 l 0.707,0.707 C 9.449,7.163 5.904,13.127 3.898,19.63 3.231,22.843 3.003,27.002 3,30.5 Z');
    this.rootSegment_.nextSegment = this.straightSegment_;
  } else {
    this.control_.setAttribute('cx', 11);
    this.pointStraight_.setAttribute('d', 'M 6,0 H 7 L 7,20 5.5,30.5 H 5 L 6,20 Z');
    this.pointCurve_.setAttribute('d', 'M 1,32 C 1,20.596 5.53,9.658 13.594,1.594 l 0.707,0.707 C 6.49,10.128 2.066,20.811 2,32 Z');
    this.rootSegment_.nextSegment = this.curveSegment_;
  }
};

Turnout.prototype.toggle = function() {
  this.set(!this.state);
};

// Vehicle object.
var Vehicle = function(colour) {
  this.LENGTH = 14;
  this.WIDTH = 8;
  // Distance from midpoint to front or back axle.
  this.AXLE_DISTANCE = 6;
  var g = document.createElementNS(SVG_NS, 'g');
  var rect = document.createElementNS(SVG_NS, 'rect');
  rect.setAttribute('width', this.WIDTH);
  g.appendChild(rect);
  rect.setAttribute('fill', colour);
  if (colour === LOCO_COLOUR) {
    rect.setAttribute('height', this.LENGTH - 3);
    rect.setAttribute('y', 3);
    var head = document.createElementNS(SVG_NS, 'rect');
    g.appendChild(head);
    head.setAttribute('height', 6);
    head.setAttribute('width', this.WIDTH);
    head.setAttribute('rx', 3);
    head.setAttribute('fill', colour);
  } else {
    rect.setAttribute('height', this.LENGTH);
  }
  document.getElementById('trainGroup').appendChild(g);
  this.node = g;

  this.segment_ = null;
  this.distance_ = 0;
};

// Force move the vehicle to the specified location.  No checks.
// Location is defined by the back axle.
Vehicle.prototype.moveTo = function(segment, distance) {
  this.segment_ = segment;
  this.distance_ = distance;
};

Vehicle.prototype.moveBy = function(delta) {
  if (delta >= 0) {  // Moving backwards (towards the buffers).
    var locBackAxle = this.segment_.walk(this.distance_, delta);
    var locFrontAxle = locBackAxle[0].walk(locBackAxle[1], -2 * this.AXLE_DISTANCE);
  } else {  // Moving forwards (towards the headshunt).
    var locFrontAxle = this.segment_.walk(this.distance_ - 2 * this.AXLE_DISTANCE, delta);
    var locBackAxle = locFrontAxle[0].walk(locFrontAxle[1], 2 * this.AXLE_DISTANCE);
  }
  this.segment_ = locBackAxle[0];
  this.distance_ = locBackAxle[1];

  var xyFrontAxle = locFrontAxle[0].calculateCoordinates(locFrontAxle[1]);
  var xyBackAxle = locBackAxle[0].calculateCoordinates(locBackAxle[1]);
  var xyMid = {
    x: (xyBackAxle.x + xyFrontAxle.x) / 2,
    y: (xyBackAxle.y + xyFrontAxle.y) / 2
  };
  var angle = -Math.atan2(xyBackAxle.x - xyFrontAxle.x, xyBackAxle.y - xyFrontAxle.y);
  angle = angle / Math.PI * 180;
  this.node.setAttribute('transform', 'rotate(' + angle + ', ' + xyMid.x + ',' + xyMid.y + ')' +
      ' translate(' + (xyMid.x - this.WIDTH / 2) + ',' + (xyMid.y - this.LENGTH / 2) + ')');
  return xyMid;
};


// Coordinates of each section of track.
// straight: startX, startY, deltaX, deltaY
// curve: centerX, centerY, startDegrees, deltaDegrees
var PATH_SEGMENTS = [
  new StraightSegment(8, 102 + HEADSHUNT_OVERFLOW, 0, -HEADSHUNT_OVERFLOW), // 0:  Headshunt overflow
  new StraightSegment(8, 102, 0, -2 * 16),              // 1:  Headshunt straight
  new CurveSegment(48, 71, 180, 45),                    // 2:  Headshunt curve
  new StraightSegment(19.716, 42.716, 22.627, -22.628), // 3:  Turnout #1 straight
  new CurveSegment(70.627, 48.372, 225, 45),            // 4:  Siding A curve
  new StraightSegment(70.627, 8.372, 3 * 16, 0),    // 5:  Siding A straight
  new CurveSegment(48, 71, 225, 45),                    // 6:  Turnout #1 curve
  new StraightSegment(48, 31, 2 * 16, 0),               // 7:  Turnout #2 straight
  new StraightSegment(48 + 2 * 16, 31, 3 * 16, 0),  // 8:  Siding B
  new CurveSegment(48, 71, 270, 45),                    // 9:  Turnout #2 curve
  new CurveSegment(104.568, 14.431, 135, -45),          // 10: Siding C curve
  new StraightSegment(104.568, 54.431, 16, 0)       // 11: Siding C straight
];
// Link the segments together.
function bilateralLink(i, j) {
  PATH_SEGMENTS[i].nextSegment = PATH_SEGMENTS[j];
  PATH_SEGMENTS[j].previousSegment = PATH_SEGMENTS[i];
}
bilateralLink(0, 1);
bilateralLink(1, 2);
bilateralLink(2, 3);
bilateralLink(3, 4);
bilateralLink(4, 5);
bilateralLink(2, 6);  // Clobbers 2->3, leaves 3->2.
bilateralLink(6, 7);
bilateralLink(7, 8);
bilateralLink(6, 9);  // Clobbers 6->7, leaves 7->6.
bilateralLink(9, 10);
bilateralLink(10, 11);

// Set whether the train may enter the headshut's offscreen overflow section.
function setHeadShuntOverflow(open) {
  PATH_SEGMENTS[1].previousSegment = open ? PATH_SEGMENTS[0] : null;
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

  turnouts.push(
      new Turnout(turnout1Node, 2, 3, 6),
      new Turnout(turnout2Node, 6, 7, 9));

  // Create goal visualization.
  for (var i = TRAIN_LENGTH; i >= 0; i--) {
    // <div class="goalCar">5</div>
    var div = document.createElement('div');
    div.className = 'goalCar';
    div.appendChild(document.createTextNode(i || '\xa0'));
    document.getElementById('goalCars').appendChild(div);
  }
  locomotive = new Vehicle(LOCO_COLOUR);
  reset(location.hash.substring(1));

  setInterval(update, 25);
}
window.addEventListener('load', init);
window.addEventListener('keypress', keypress);
window.addEventListener('keydown', keydown);
window.addEventListener('keyup', keyup);

var locomotive = null;
var locoActualSpeed = 0;
var locoDesiredSpeed = 0;

function keypress(e) {
  if (e.key === '1') {
    turnouts[0].toggle();
  }
  if (e.key === '2') {
    turnouts[1].toggle();
  }
  if (e.key === ' ') {
    // TODO Decouplers!
  }
}

function keydown(e) {
  if (e.key === 'ArrowRight') {
    drive(1);
  }
  if (e.key === 'ArrowLeft') {
    drive(-1);
  }
}

function keyup(e) {
  if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
    drive(0);
  }
}

function update() {
  if (locoActualSpeed < locoDesiredSpeed) {
    locoActualSpeed = Math.min(locoActualSpeed + ACCELERATION, locoDesiredSpeed);
  } else if (locoActualSpeed > locoDesiredSpeed) {
    locoActualSpeed = Math.max(locoActualSpeed - ACCELERATION, locoDesiredSpeed);
  }
  locomotive.moveBy(locoActualSpeed);
}

function drive(direction) {
  locoDesiredSpeed = MAX_SPEED * Math.sign(direction);
}

function reset(opt_key) {
  // Use the key in the URL hash, if there is one.  Otherwise make a new one.
  var hashKey = Number(opt_key);
  if (hashKey > 0 && hashKey <= PERMUTATIONS) {
    var key = Math.floor(hashKey);
  } else {
    var key = Math.floor(Math.random() * PERMUTATIONS) + 1;
    location.hash = key;
  }

  // Seed the pseudo-random generator with the key.
  pseudoRandom(key);
  // The colours don't matter to gameplay at all, but mix them up for variety.
  var randomColours = COLOURS.slice();
  shuffle(randomColours);
  var cars = document.getElementsByClassName('goalCar');
  for (var i = 0; i < cars.length - 1; i++) {
    cars[i].style.backgroundColor = randomColours[i];
  }
  cars[i].style.backgroundColor = LOCO_COLOUR;

  // Decompose the key into car selection.
  key--;  // Decrement from 1-based to 0-based.
  var digits = decomposeKey(key);
  // Digits is a breakdown of indicies, not counting already picked cars.
  // E.g. [2, 2, 1] means first car in train is car #2, second car is the new
  // car #2 (after removing or skipping over the previously selected one), the
  // third car is car #1.
  var carOrder = new Array(CAR_COUNT);
  for (var i = 0; i < digits.length; i++) {
    var digit = digits[i];
    for (var j = 0; j < carOrder.length; j++) {
      if (carOrder[j] === undefined) {
        if (!digit) {
          carOrder[j] = i;
          break;
        }
        digit--;
      }
    }
  }
  console.log(carOrder);

  setHeadShuntOverflow(false);
  // I don't think there's a need to reset the turnouts.
  locoActualSpeed = 0;
  locoDesiredSpeed = 0;
  locomotive.moveTo(PATH_SEGMENTS[2], 1);
}

// Decompose the key into a sequence of digits.
// The first (left-most digit) is base n, the next digit is base n+1, and so on.
// E.g. 4567 -> [5, 3, 0, 1, 3] (for the case of 8 cars, choose 5).
function decomposeKey(key) {
  var min = CAR_COUNT - TRAIN_LENGTH;
  var max = CAR_COUNT;
  var base = PERMUTATIONS;
  var digits = [];
  for (var i = max; i > min; i--) {
    base /= i;
    var remainder = key % base;
    digits.push((key - remainder) / base);
    key = remainder;
  }
  return digits;
}

// Randomize the order of an array in place.
// Use pseudo-random generator instead of Math.random.
function shuffle(arr) {
  for (var i = arr.length - 1; i > 0; i--) {
    // Choose a random array index in [0, i] (inclusive with i).
    var j = Math.floor(pseudoRandom() * (i + 1));
    var tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
}

// Returns a pseudo-random number between 0 and 1.
// If opt_seed is provided, reset the algorithm to that seed.
// Equivalent to Math.random, but deterministic.
function pseudoRandom(opt_seed) {
  if (opt_seed !== undefined) {
    pseudoRandom.previous = 671581058 + opt_seed;
  }
  pseudoRandom.previous = (pseudoRandom.previous * pseudoRandom.PRIME1 / 10000) >>> 0;
  var rand = (pseudoRandom.previous * pseudoRandom.PRIME2 / 10000) >>> 0;
  return rand / pseudoRandom.MAX;
}
pseudoRandom.MAX = 4294967296;
pseudoRandom.PRIME1 = 3439588987;
pseudoRandom.PRIME2 = 1264941673;
pseudoRandom.previous = 671581058;  // Randomly chosen seed.

// Return the factorial of n.
function factorial(n) {
  if (n < 2) return 1;
  var f = n;
  while (n > 1) {
    n--;
    f *= n;
  }
  return f;
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
