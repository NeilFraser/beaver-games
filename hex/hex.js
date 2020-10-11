/**
 * @license
 * Copyright 2020 Neil Fraser
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @fileoverview Hex game.
 * @author root@neil.fraser.name (Neil Fraser)
 */
'use strict';


var SVG_NS = 'http://www.w3.org/2000/svg';

// From center to point.
var HEX_SIZE = 30;

var HEX_WIDTH = Math.sqrt(3) * HEX_SIZE;
var HEX_HEIGHT = 2 * HEX_SIZE;



// On page load, initialize the event handlers and draw the grid.
function init() {
  fixLinks();

  var m = document.cookie.match(/difficulty=([012])/);
  var difficultyIndex = m ? m[1] : 0;
  //SPEED = [0.7, 1, 2][difficultyIndex];
  var difficultySelect = document.getElementById('difficulty');
  difficultySelect.selectedIndex = difficultyIndex;
  difficultySelect.addEventListener('change', setDifficulty);

  //document.addEventListener('keydown', keyDown);
  //document.addEventListener('keyup', keyUp);

  initGrid();
}
window.addEventListener('load', init);

// Initial draw of grid.
function initGrid() {
  var g = document.getElementById('grid');
  var offsetY = HEX_HEIGHT / 2 + 1;
  for (var y = 0; y < 5; y++) {
    var isOdd = Boolean(y % 2);
    var offsetX = (isOdd ? -HEX_WIDTH / 2 : 0) + HEX_WIDTH + 1;
    for (var x = 0; x < 10 + isOdd; x++) {
      g.appendChild(makeHex(x * HEX_WIDTH + offsetX, y * HEX_HEIGHT * 0.75 + offsetY));
    }
  }
}

// Create a single hexagon centered on the given coordinates.
function makeHex(x, y) {
  // <polygon points="100,60 134.6,80 134.6,120 100,140 65.3,120 65.3,80" class="grid"></polygon>
  var element = document.createElementNS(SVG_NS, 'polygon');
  var points = [];
  points[0] = (x) + ',' + (y - HEX_HEIGHT / 2);
  points[1] = (x + HEX_WIDTH / 2) + ',' + (y - HEX_HEIGHT / 4);
  points[2] = (x + HEX_WIDTH / 2) + ',' + (y + HEX_HEIGHT / 4);
  points[3] = (x) + ',' + (y +  HEX_HEIGHT / 2);
  points[4] = (x - HEX_WIDTH / 2) + ',' + (y + HEX_HEIGHT / 4);
  points[5] = (x - HEX_WIDTH / 2) + ',' + (y - HEX_HEIGHT / 4);
  element.setAttribute('points', points.join(' '));
  element.setAttribute('class', 'grid');
  return element;
}
