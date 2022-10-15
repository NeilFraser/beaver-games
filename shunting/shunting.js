/**
 * @license
 * Copyright 2022 Neil Fraser
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @fileoverview Shunting game.
 * @author root@neil.fraser.name (Neil Fraser)
 */
'use strict';

// Standard Lego curve radius.
var RADIUS = 40;

// Locomotive colour (green).
var LOCO_COLOUR = '#178F47';
// Car colour (light blue trending to dark blue).
var CAR_COLOURS = [
  '#7B9AFF',  /* HSV: 226, 52, 100 */
  '#6E90FF',  /* HSV: 226, 57, 100 */
  '#6186FF',  /* HSV: 226, 62, 100 */
  '#547DFF',  /* HSV: 226, 67, 100 */
  '#4873FF'   /* HSV: 226, 72, 100 */
];
// Colour of extra cars not part of the train (darkest blue).
var SKIP_COLOUR = '#2E5FFF';  /* HSV: 226, 82, 100 */

// Number of cars required in final train (not including locomotive).
var TRAIN_LENGTH = 5;
// Number of cars to choose from.
var CAR_COUNT = 8;
var PERMUTATIONS = factorial(CAR_COUNT) / factorial(CAR_COUNT - TRAIN_LENGTH);

// Speed of locomotive.
var MAX_SPEED = 1;

// Array of both turnouts.
var turnouts = [];
// Array of all three uncouplers.
var uncouplers = [];
var controlsActive = false;

var locomotive = null;
var locoActualSpeed = 0;
var locoDesiredSpeed = 0;
var locoAcceleration = 0.05;
// Array of all eight cars.
var allCars = [];
var carOrder = [];
var trains = [];

var timeStart;
var timePid;


// Abstract class for a track segment.
var AbstractSegment = function() {};

// The next segment (if any) in the direction of the buffers.
AbstractSegment.prototype.nextSegment = null;

// The previous segment (if any) in the direction of the headshunt.
AbstractSegment.prototype.prevSegment = null;

// Reference to the turnout this track segment belongs to (if any).
AbstractSegment.prototype.turnout = null;

// Measuring from the start of this track segment, walk 'distance'
// (negative is towards the headshunt, positive is towards the buffers).
// Return a location tuple composed of the track segment and distance
// (measured from the start of that segment).
// If the walk exceeds the length of the track (e.g. hitting a buffer), return
// the location of the end of the track, as well as the difference between what
// was requested vs what was obtained.
AbstractSegment.prototype.walk = function(distance) {
  if (distance < 0) {
    if (this.prevSegment) {
      return this.prevSegment.walk(distance + this.prevSegment.length);
    }
    // End of track (headshunt).
    return [this, 0, -distance];
  }
  if (distance > this.length) {
    if (this.nextSegment) {
      return this.nextSegment.walk(distance - this.length);
    }
    // End of track (buffer).
    return [this, this.length, distance - this.length];
  }
  return [this, distance, 0];
};

// Calculate the X/Y SVG coordinates of a point 'distance' down this segment.
AbstractSegment.prototype.calculateCoordinates = function(distance) {
  throw Error('Implemented by subclass');
};


// Class for a straight segment of track.
// startX/Y are the SVG coordinates of the bottom end of the track.
// deltaX/Y is the relative distance from startX/Y to the top end of the track.
var StraightSegment = function(startX, startY, deltaX, deltaY) {
  this.startX = startX;
  this.startY = startY;
  this.deltaX = deltaX;
  this.deltaY = deltaY;
  this.length = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
};
StraightSegment.prototype = new AbstractSegment();

// Calculate the X/Y SVG coordinates of a point 'distance' down this segment.
StraightSegment.prototype.calculateCoordinates = function(distance) {
  var fraction = distance / this.length;
  return {
    x: this.startX + this.deltaX * fraction,
    y: this.startY + this.deltaY * fraction
  };
};


// Class for a curved segment of track.
// centerX/Y are the SVG coordinates of the center of the curve.
// startDegrees is the bottom end of the track.
// 0: East, 90: South, 180: West, 270 North
// deltaDegrees is the relative arc (positive is clockwise) from startDegrees
// to the top end of the track.
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

// Calculate the X/Y SVG coordinates of a point 'distance' down this segment.
CurveSegment.prototype.calculateCoordinates = function(distance) {
  var fraction = distance / this.length;
  var arc = (this.startDegrees + this.deltaDegrees * fraction);
  var arc = arc / 180 * Math.PI;
  return {
    x: this.centerX + Math.cos(arc) * RADIUS,
    y: this.centerY + Math.sin(arc) * RADIUS
  };
};


// Class for an uncoupler.
// `node` is the SVG group for the uncoupler.
// `trackSegmentIndex` is the index of the track segment that will contian the
// car to be uncoupled.
var Uncoupler = function(node, trackSegmentIndex) {
  this.node_ = node;
  this.trackSegment_ = PATH_SEGMENTS[trackSegmentIndex];

  // Create control target (needs to be above the train layer).
  // <rect class="clickTarget" width="4" height="12" x="78" y="25" rx="1" />
  var rect = createSvgElement('rect');
  rect.setAttribute('class', 'clickTarget');
  rect.setAttribute('width', 4);
  rect.setAttribute('height', 12);
  rect.setAttribute('x', 78);
  rect.setAttribute('y', 25);
  rect.setAttribute('rx', 1);
  rect.setAttribute('transform', this.node_.getAttribute('transform'));
  document.getElementById('uncouplerControlGroup').appendChild(rect);
  rect.addEventListener('click', this.activate.bind(this));
};

// Activate this uncoupler.  Plays sound.
Uncoupler.prototype.activate = function() {
  if (!controlsActive) return;
  var audio = document.getElementById('uncouple');
  audio.volume = 0.5;
  audio.play();
  var node = this.node_;
  node.firstElementChild.setAttribute('transform', 'translate(0, 1)');
  node.lastElementChild.setAttribute('transform', 'translate(0, -1)');
  setTimeout(function() {
    node.firstElementChild.removeAttribute('transform');
    node.lastElementChild.removeAttribute('transform');
  }, 250);
  var car = this.getCar();
  if (car) {
    car.uncouple();
    checkWin();
  }
};

// Is there a car in range of this uncoupler?  Return the front car.
Uncoupler.prototype.getCar = function() {
  for (var i = 0; i < allCars.length; i++) {
    var car = allCars[i];
    if (car.frontSegment_ === this.trackSegment_ && car.frontDistance_ < 5) {
      // There is a car in range.
      return car.prevVehicle;  // Might be null.
    }
  }
  return null;
};


// Class for turnout.
// `node` is the SVG group for the turnout.
// `rootSegmentIndex` is the index of the track segment which connects to
// the root of this turnout.
// `straightSegmentIndex` is the index of the track segment forming
// the straight section of this turnout.
// `curveSegmentIndex` is the index of the track segment forming
// the curved section of this turnout.
var Turnout = function(node,
    rootSegmentIndex, straightSegmentIndex, curveSegmentIndex) {
  this.rootSegment_ = PATH_SEGMENTS[rootSegmentIndex];
  this.straightSegment_ = PATH_SEGMENTS[straightSegmentIndex];
  this.curveSegment_ = PATH_SEGMENTS[curveSegmentIndex];
  this.straightSegment_.turnout = this;
  this.curveSegment_.turnout = this;
  // Get references to key SVG nodes used in the UI for switching.
  this.pointStraight_ = node.getElementsByClassName('pointStraight')[0];
  this.pointCurve_ = node.getElementsByClassName('pointCurve')[0];
  this.control_ = node.getElementsByClassName('control')[0];

  var clickTarget = node.getElementsByClassName('clickTarget')[0];
  clickTarget.addEventListener('click', this.toggle.bind(this));
  // Is there a locomotive or car on this turnout?
  this.hasVehicle = false;
  this.set_(false);
};

// Set the direction of this turnout.  True is straight, false is curve.
Turnout.prototype.set_ = function(state) {
  this.state = state;
  // Set the UI.
  if (state) {
    this.control_.setAttribute('cx', 9);
    this.pointStraight_.setAttribute('d', 'M 6,0 H 7 V 32 H 6 Z');
    this.pointCurve_.setAttribute('d', 'M 2.5,30.5 C 2.401,27.119 2.524,22.871 2.961,19.163 5.016,12.594 8.637,6.551 13.594,1.594 l 0.707,0.707 C 9.449,7.163 5.904,13.127 3.898,19.63 3.231,22.843 3.003,27.002 3,30.5 Z');
  } else {
    this.control_.setAttribute('cx', 11);
    this.pointStraight_.setAttribute('d', 'M 6,0 H 7 L 7,20 5.5,30.5 H 5 L 6,20 Z');
    this.pointCurve_.setAttribute('d', 'M 1,32 C 1,20.596 5.53,9.658 13.594,1.594 l 0.707,0.707 C 6.49,10.128 2.066,20.811 2,32 Z');
  }
  // Relink the track segments.
  this.rootSegment_.nextSegment =
      state ? this.straightSegment_ : this.curveSegment_;
};

// Toggle this turnout's direction.  Plays sound.
Turnout.prototype.toggle = function() {
  if (!this.hasVehicle) {
    document.getElementById('click').play();
    this.set_(!this.state);
  }
};


// Class for a vehicle (either a locomotive or a car).
var Vehicle = function(isLocomotive) {
  this.LENGTH = 14;
  this.WIDTH = 8;
  this.nextVehicle = null;
  this.prevVehicle = null;
  this.textNode_ = null;
  // Distance from midpoint to front or back axle.
  this.AXLE_DISTANCE = 6;
  var g = createSvgElement('g');
  var rect = createSvgElement('rect');
  rect.setAttribute('rx', 1);
  rect.setAttribute('width', this.WIDTH);
  g.appendChild(rect);
  if (isLocomotive) {
    rect.setAttribute('height', this.LENGTH - 3);
    rect.setAttribute('y', 3);
    var head = createSvgElement('rect');
    g.appendChild(head);
    head.setAttribute('height', 6);
    head.setAttribute('width', this.WIDTH);
    head.setAttribute('rx', 3);
  } else {
    rect.setAttribute('height', this.LENGTH);
    var text = createSvgElement('text');
    text.setAttribute('class', 'carNumber');
    text.setAttribute('transform', 'translate(5.4, 5.3) rotate(180)');
    this.textNode_ = text;
    g.appendChild(text);
  }
  document.getElementById('trainGroup').appendChild(g);
  this.node = g;

  this.coupler = createSvgElement('line');
  document.getElementById('couplerGroup').appendChild(this.coupler);

  this.frontSegment_ = null;
  this.frontDistance_ = 0;
  this.backSegment_ = null;
  this.backDistance_ = 0;
};

// Change the colour of this vehicle.  Takes a CSS colour.
Vehicle.prototype.setColour = function(colour) {
  for (var i = 0; i < this.node.childNodes.length; i++) {
    this.node.childNodes[i].setAttribute('fill', colour);
  }
};

// Write a number on the top of this car (generally 1-5) or undefined for none.
Vehicle.prototype.setNumber = function(number) {
  var text = this.textNode_;
  while (text.firstChild) {
    text.removeChild(text.firstChild);
  }
  if (number !== undefined) {
    text.appendChild(document.createTextNode(number));
  }
};

// Couple this locomotive or car to another car.  Forms a doubly linked list.
Vehicle.prototype.couple = function(nextVehicle) {
  if (this.nextVehicle || nextVehicle.prevVehicle) {
    throw Error("Vehicle already coupled");
  }
  this.nextVehicle = nextVehicle;
  nextVehicle.prevVehicle = this;
  nextVehicle.moveTo(this.backSegment_, this.backDistance_ + this.LENGTH + 2);
  var n = trains.indexOf(nextVehicle);
  if (n === -1) throw Error("Vehicle wasn't a train")
  trains.splice(n, 1);
  this.coupler.style.visibility = 'visible';
};

// Decouple this locomotive or car from another car behind it.
// Ok to call if not already coupled (does nothing).
Vehicle.prototype.uncouple = function() {
  if (this.nextVehicle) {
    if (this.nextVehicle.prevVehicle !== this) {
      throw Error("nextVehicle wasn't connected to us");
    }
    this.nextVehicle.prevVehicle = null;
    trains.push(this.nextVehicle);
    this.nextVehicle = null;
  }
  this.coupler.style.visibility = 'hidden';
};

// Length from the front of this vehicle to the end of the train.
Vehicle.prototype.lengthToEnd = function() {
  var len = this.LENGTH + 2;
  if (this.nextVehicle) {
    len += this.nextVehicle.lengthToEnd();
  }
  return len;
};

// Force move this vehicle to the specified location.  No checks.
// Location is defined by the back axle.
Vehicle.prototype.moveTo = function(segment, distance) {
  this.backSegment_ = segment;
  this.backDistance_ = distance;
  this.moveBy(0);
};

// Move this vehicle up (positive) or down (negative) the track by `delta`.
Vehicle.prototype.moveBy = function(delta) {
  if (delta >= 0) {  // Moving backwards (towards the buffers).
    if (!this.prevVehicle) {
      var locTrainEnd = this.backSegment_.walk(this.backDistance_ + delta -
          this.AXLE_DISTANCE - this.LENGTH / 2 + this.lengthToEnd());
      if (locTrainEnd[2] !== 0) {
        // Crashed into buffer.
        locoActualSpeed = 0;
        delta -= locTrainEnd[2];
      }
    }
    var locBackAxle = this.backSegment_.walk(this.backDistance_ + delta);
    var locFrontAxle = locBackAxle[0].walk(locBackAxle[1] - 2 * this.AXLE_DISTANCE);
  } else {  // Moving forwards (towards the headshunt).
    var locFrontAxle =
        this.backSegment_.walk(this.backDistance_ - 2 * this.AXLE_DISTANCE + delta);
    var locBackAxle = locFrontAxle[0].walk(locFrontAxle[1] + 2 * this.AXLE_DISTANCE);
    var backSegment = locBackAxle[0];
    if (!this.prevVehicle && backSegment.turnout &&
        backSegment.prevSegment.nextSegment !== backSegment) {
      // We are a locomotive running through a turnout switched the wrong way.
      backSegment.turnout.toggle();
    }
    if (locFrontAxle[2] !== 0) {
      // Crashed into end of headshunt.
      locoActualSpeed = 0;
    }
  }
  this.frontSegment_ = locFrontAxle[0];
  this.frontDistance_ = locFrontAxle[1];
  this.backSegment_ = locBackAxle[0];
  this.backDistance_ = locBackAxle[1];
  if (this.backSegment_.turnout) {
    this.backSegment_.turnout.hasVehicle = true;
  }

  var xyFrontAxle = locFrontAxle[0].calculateCoordinates(locFrontAxle[1]);
  var xyBackAxle = locBackAxle[0].calculateCoordinates(locBackAxle[1]);
  this.coupler.setAttribute('x1', xyBackAxle.x);
  this.coupler.setAttribute('y1', xyBackAxle.y);
  if (this.prevVehicle) {
    this.prevVehicle.coupler.setAttribute('x2', xyFrontAxle.x);
    this.prevVehicle.coupler.setAttribute('y2', xyFrontAxle.y);
  }
  var xyMid = {
    x: (xyBackAxle.x + xyFrontAxle.x) / 2,
    y: (xyBackAxle.y + xyFrontAxle.y) / 2
  };
  var angle = -Math.atan2(xyBackAxle.x - xyFrontAxle.x, xyBackAxle.y - xyFrontAxle.y);
  angle = angle / Math.PI * 180;
  this.node.setAttribute('transform',
      'rotate(' + angle + ', ' + xyMid.x + ',' + xyMid.y + ') ' +
      'translate(' + (xyMid.x - this.WIDTH / 2) + ',' + (xyMid.y - this.LENGTH / 2) + ')');
  if (this.nextVehicle) {
    this.nextVehicle.moveTo(this.backSegment_, this.backDistance_ + this.LENGTH + 2);
  }
  // Couple to any train we ran into.
  if (delta > 0) {
    for (var i = 0; i < trains.length; i++) {
      var train = trains[i];
      if (train.frontSegment_ === locTrainEnd[0] &&
          train.frontDistance_ <= locTrainEnd[1]) {
        var lastCar = this;
        while (lastCar.nextVehicle) {
          lastCar = lastCar.nextVehicle;
        }
        var audio = document.getElementById('couple');
        audio.volume = 0.2;
        audio.play();
        lastCar.couple(train);
        locoActualSpeed = 0;
        checkWin();
      }
    }
  }
};


// Enough room for a 10 car train to drive offscreen.
var HEADSHUNT_OVERFLOW = 10 * 16;

// Coordinates of each section of track.
// straight: startX, startY, deltaX, deltaY
// curve: centerX, centerY, startDegrees, deltaDegrees
var PATH_SEGMENTS = [
  new StraightSegment(8, 102 + HEADSHUNT_OVERFLOW, 0, -HEADSHUNT_OVERFLOW), // 0: Headshunt overflow
  new StraightSegment(8, 102, 0, -2 * 16 + 1),          // 1:  Headshunt straight
  new CurveSegment(48, 71, 180, 45),                    // 2:  Headshunt curve
  new StraightSegment(19.716, 42.716, 22.627, -22.628), // 3:  Turnout #1 straight
  new CurveSegment(70.627, 48.372, 225, 45),            // 4:  Siding A curve
  new StraightSegment(70.627, 8.372, 3 * 16 + 3, 0),    // 5:  Siding A straight
  new CurveSegment(48, 71, 225, 45),                    // 6:  Turnout #1 curve
  new StraightSegment(48, 31, 2 * 16, 0),               // 7:  Turnout #2 straight
  new StraightSegment(48 + 2 * 16, 31, 3 * 16 + 3, 0),  // 8:  Siding B
  new CurveSegment(48, 71, 270, 45),                    // 9:  Turnout #2 curve
  new CurveSegment(104.568, 14.431, 135, -45),          // 10: Siding C curve
  new StraightSegment(104.568, 54.431, 16 + 3, 0)       // 11: Siding C straight
];

// On page load, draw the track, initialize event handlers, and reset the game.
function init() {
  fixLinks();

  // Link two track segments to each other in both directions.
  // Forms a doubly linked list.
  function bilateralLink(i, j) {
    PATH_SEGMENTS[i].nextSegment = PATH_SEGMENTS[j];
    PATH_SEGMENTS[j].prevSegment = PATH_SEGMENTS[i];
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

  var uncoupler1Node = drawTrack('uncoupler', 'rotate(-45, 48, 71)');
  var uncoupler2Node = drawTrack('uncoupler', '');
  var uncoupler3Node = drawTrack('uncoupler', 'rotate(45, 64, 32.372)');

  turnouts.push(
      new Turnout(turnout1Node, 2, 3, 6),
      new Turnout(turnout2Node, 6, 7, 9));

  uncouplers.push(
      new Uncoupler(uncoupler1Node, 4),
      new Uncoupler(uncoupler2Node, 8),
      new Uncoupler(uncoupler3Node, 10));

  // Create goal visualization.
  for (var i = TRAIN_LENGTH; i >= 0; i--) {
    // <div class="goalCar">5</div>
    var div = document.createElement('div');
    div.className = 'goalCar';
    div.appendChild(document.createTextNode(i || '\xa0'));
    div.style.backgroundColor = i ? CAR_COLOURS[i - 1] : LOCO_COLOUR;
    document.getElementById('goalCars').appendChild(div);
  }

  // Create all the vehicles.
  locomotive = new Vehicle(true);
  locomotive.setColour(LOCO_COLOUR);
  for (var i = 0; i < CAR_COUNT; i++) {
    allCars[i] = new Vehicle(false);
    trains[i] = allCars[i];
  }

  reset(location.hash.substring(1));

  window.addEventListener('keypress', keypress);
  window.addEventListener('keydown', keydown);
  window.addEventListener('keyup', keyup);

  setInterval(updateTrains, 25);
}
window.addEventListener('load', init);

// Draw a track segment onto the display.  Return the 'use' or 'g' node.
function drawTrack(defId, transform) {
  if (defId === 'turnout' || defId === 'uncoupler') {
    // Turnouts and uncouplers need to be cloned as they have moving controls.
    var node = document.getElementById(defId).cloneNode(true);
    node.setAttribute('class', node.id);
    node.removeAttribute('id');
  } else {
    // Other track segments can just be 'use' nodes.
    var node = createSvgElement('use');
    node.setAttribute('href', '#' + defId);
  }
  node.setAttribute('transform', transform);
  document.getElementById('trackGroup').appendChild(node);
  return node;
}

// Handle keystrokes for toggling turnouts or activating the uncouplers.
function keypress(e) {
  if (!controlsActive) return;
  if (e.key === '1') {
    turnouts[0].toggle();
  }
  if (e.key === '2') {
    turnouts[1].toggle();
  }
  if (e.key === ' ') {
    for (var i = 0; i < uncouplers.length; i++) {
      if (uncouplers[i].getCar()) {
        uncouplers[i].activate();
      }
    }
    e.preventDefault();
  }
}

// Handle the start of key presses for driving forwads or backwards.
function keydown(e) {
  if (!controlsActive) return;
  if (e.key === 'ArrowRight') {
    document.getElementById('rightButton').className = 'active';
    drive(1);
    e.preventDefault();
  }
  if (e.key === 'ArrowLeft') {
    document.getElementById('leftButton').className = 'active';
    drive(-1);
    e.preventDefault();
  }
}

// Handle the end of key presses for driving forwads or backwards.
function keyup(e) {
  if (!controlsActive) return;
  if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
    document.getElementById('rightButton').className = '';
    document.getElementById('leftButton').className = '';
    drive(0);
    e.preventDefault();
  }
}

// Clear the state of the current game (if any), and start a new random game.
function reset(opt_key) {
  // Use the key in the URL hash, if there is one.  Otherwise make a new one.
  var hashKey = Number(opt_key);
  if (hashKey > 0 && hashKey <= PERMUTATIONS) {
    var key = Math.floor(hashKey);
  } else {
    var key = Math.floor(Math.random() * PERMUTATIONS) + 1;
    location.hash = key;
  }

  // Decompose the key into car selection.
  key--;  // Decrement from 1-based to 0-based.
  var digits = decomposeKey(key);
  // Digits is a breakdown of indicies, not counting already picked cars.
  // E.g. [2, 2, 1] means first car in train is car #2, second car is the new
  // car #2 (after removing or skipping over the previously selected one), the
  // third car is car #1.
  carOrder = new Array(CAR_COUNT);
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

  setHeadShuntOverflow(false);
  // I don't think there's a need to reset the turnouts.

  // Uncouple everything.
  locomotive.uncouple();
  for (var n = 0; n < CAR_COUNT; n++) {
    allCars[n].uncouple();
  }

  // Place the locomotive.
  locoActualSpeed = 0;
  locoDesiredSpeed = 0;
  locomotive.moveTo(PATH_SEGMENTS[2], 1);
  locoAcceleration = 0.05;

  // Place the cars.
  // Tuples defining groups of cars:
  // * Track segment to locate the first car on.
  // * Distance between track segment zero and rear axle.
  // * Number of cars in group.
  var carGroups = [
    [PATH_SEGMENTS[4], 14, 5],
    [PATH_SEGMENTS[8], 15, 3],
    [PATH_SEGMENTS[10], 14, 3]
  ];
  var n = 0;
  groupLoop: for (var i = 0; i < carGroups.length; i++) {
    var carGroup = carGroups[i];
    for (var j = 0; j < carGroup[2]; j++) {
      if (j === 0) {
        // First car in group is placed.
        allCars[n].moveTo(carGroup[0], carGroup[1]);
      } else {
        // Each subsequent car is coupled to the previous car.
        allCars[n - 1].couple(allCars[n]);
      }
      allCars[n].setColour(carOrder[n] === undefined ?
          SKIP_COLOUR : CAR_COLOURS[carOrder[n]]);
      allCars[n].setNumber(carOrder[n] === undefined ?
          undefined : carOrder[n] + 1);
      n++;
      if (n >= CAR_COUNT) {
        break groupLoop;
      }
    }
  }
  timeStart = Date.now();
  timePid = setInterval(updateTimer, 1000);
  updateTimer();
  controlsActive = true;
}

// Set whether the train may enter the headshut's offscreen overflow section.
function setHeadShuntOverflow(open) {
  PATH_SEGMENTS[1].prevSegment = open ? PATH_SEGMENTS[0] : null;
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

// Every few miliseconds update the the animation.  Runs continuously.
function updateTrains() {
  // Accelerate/decelerate towards the desired speed.
  if (locoActualSpeed < locoDesiredSpeed) {
    locoActualSpeed = Math.min(locoActualSpeed + locoAcceleration, locoDesiredSpeed);
  } else if (locoActualSpeed > locoDesiredSpeed) {
    locoActualSpeed = Math.max(locoActualSpeed - locoAcceleration, locoDesiredSpeed);
  }
  if (locoActualSpeed) {
    for (var i = 0; i < turnouts.length; i++) {
      turnouts[i].hasVehicle = false;
    }
    locomotive.moveBy(locoActualSpeed);
  }
}

// Control the locomotive's speed.
// 0 is stop.
// 1 is backwards (up/right towards the buffers).
// -1 is forwards (down/left towards the headshunt).
function drive(direction) {
  locoDesiredSpeed = MAX_SPEED * Math.sign(direction);
}

// Create an SVG elemest of the named type.
function createSvgElement(name) {
  var SVG_NS = 'http://www.w3.org/2000/svg';
  return document.createElementNS(SVG_NS, name);
}

function updateTimer() {
  var time = Math.round((Date.now() - timeStart) / 1000);
  var seconds = time % 60;
  var time = time - seconds;
  var minutes = time % 60;
  var hours = time - minutes;
  if (seconds < 10) {
    seconds = '0' + seconds;
  }
  if (minutes < 10) {
    minutes = '0' + minutes;
  }
  var timeStr = minutes + ':' + seconds;
  if (hours) {
    timeStr = hours + ':' + timeStr;
  }
  document.getElementById('timer').textContent = timeStr;
}

// Check to see if the locomotive is pulling cars 1-5.
// If so, drive off into the sunset (actually the headshunt overflow).
function checkWin() {
  var vehicle = locomotive;
  for (var i = 0; i < TRAIN_LENGTH; i++) {
    vehicle = vehicle.nextVehicle;
    if (!vehicle) return;
    var orderIndex = carOrder.indexOf(i);
    if (vehicle !== allCars[orderIndex]) return;
  }
  if (vehicle.nextVehicle) return;

  controlsActive = false;
  clearTimeout(timePid);
  drive(0);

  var audio = document.getElementById('win');
  audio.volume = 0.5;
  audio.play();

  setTimeout(function() {
   locoAcceleration = 0.01;
   setHeadShuntOverflow(true);
    drive(-1);
  }, 1000);
}