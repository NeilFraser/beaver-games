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
var HEX_SIZE = 20;

var HEX_WIDTH = Math.sqrt(3) * HEX_SIZE;
var HEX_HEIGHT = 2 * HEX_SIZE;

var GRID_HEIGHT = 19;  // Odd is better.
var GRID_WIDTH = 25;

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

  var tank = new Tank(2, 2);
}
window.addEventListener('load', init);

// Initial draw of grid.
function initGrid() {
  var grid = [];
  for (var y = 0; y < GRID_HEIGHT; y++) {
    var row = [];
    var startX = -Math.floor(y / 2);
    var endX = GRID_WIDTH - Math.ceil(y / 2);
    for (var x = startX; x < endX; x++) {
      row[x] = new Hex(x, y);
      if (y === 0 || y === GRID_HEIGHT - 1 ||
          x === startX || x === endX - 1) {
        row[x].element.classList.add('gridWall');
      }
    }
    grid.push(row);
    console.log(row);
  }
}

// Convert axial hex coordinates to screen XY coordinates.
function hexToScreen(hexX, hexY) {
  var x = hexX * HEX_WIDTH - HEX_WIDTH / 4;
  x += hexY * HEX_WIDTH / 2;
  var y = hexY * HEX_HEIGHT * 0.75;
  return {x: x, y: y};
}

// Create a single hexagon centered on the given coordinates.
function Hex(hexX, hexY) {
  // <polygon points="100,60 134.6,80 134.6,120 100,140 65.3,120 65.3,80" class="grid"></polygon>
  var xy = hexToScreen(hexX, hexY);
  var element = document.createElementNS(SVG_NS, 'polygon');
  var points = [];
  points[0] = (xy.x) + ',' + (xy.y - HEX_HEIGHT / 2);
  points[1] = (xy.x + HEX_WIDTH / 2) + ',' + (xy.y - HEX_HEIGHT / 4);
  points[2] = (xy.x + HEX_WIDTH / 2) + ',' + (xy.y + HEX_HEIGHT / 4);
  points[3] = (xy.x) + ',' + (xy.y +  HEX_HEIGHT / 2);
  points[4] = (xy.x - HEX_WIDTH / 2) + ',' + (xy.y + HEX_HEIGHT / 4);
  points[5] = (xy.x - HEX_WIDTH / 2) + ',' + (xy.y - HEX_HEIGHT / 4);
  element.setAttribute('points', points.join(' '));
  element.setAttribute('class', 'grid');
  element.setAttribute('title', hexX + ',' + hexY);
  var g = document.getElementById('grid');
  g.appendChild(element);

  this.hexX = hexX;
  this.hexY = hexY;
  this.element = element;
}

function Tank(hexX, hexY) {
  var xy = hexToScreen(hexX, hexY);
  var element = document.createElementNS(SVG_NS, 'polygon');
  element.setAttribute('points', '0,-2 2,2 0,1 -2,2');
  element.setAttribute('transform', 'translate(' + xy.x + ',' + xy.y + ') rotate(90) scale(5)');
  element.setAttribute('class', 'tank');
  var g = document.getElementById('landscape');
  g.appendChild(element);

  this.hexX = hexX;
  this.hexY = hexY;
  this.element = element;
}
