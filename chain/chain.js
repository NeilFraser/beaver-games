/**
 * @license
 * Copyright 2021 Neil Fraser
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @fileoverview Chain Reaction game.
 * @author root@neil.fraser.name (Neil Fraser)
 */
'use strict';

// One of three difficulty levels (0, 1, 2).  No upper limit.
let DIFFICULTY;

// Is player0 and/or player1 human?
const players = [false, false];

// User-selectable option for number of human players (1, 2).
let playerOption = 1;

// Who's turn is it anyway? (0, 1)
let turn = 0;

// The game has three input modes: Waiting on start button, human turn,
// and busy with animations.
const inputModes = {
  START: -1,
  PLAY: 0,
  BUSY: 1
};
let inputMode = inputModes.START;

// Height and width of playing board.
const HEIGHT = 5;
const WIDTH = 6;

// Height and width of one cell.
const CELL_SIZE = 100;

// Namespace for SVG elements.
const SVG_NS = 'http://www.w3.org/2000/svg';
// Namespace for XLink attributes.
const XLINK_NS = 'http://www.w3.org/1999/xlink';

let liveField = null;

let timeoutPID, animationPID;

// On page load, initialize the event handlers.
function init() {
  fixLinks();

  const mPlayers = document.cookie.match(/players=([12])/);
  if (mPlayers && mPlayers[1] === '2') {
    playerOption = 2;
  }
  document.getElementById('players').selectedIndex = playerOption - 1;
  const mDifficulty = document.cookie.match(/difficulty=([012])/);
  DIFFICULTY = Number(mDifficulty ? mDifficulty[1] : 1);
  document.getElementById('difficulty').selectedIndex = DIFFICULTY;
  document.getElementById('difficulty').disabled = (playerOption === 2);
  registerOptions('players', 'difficulty');

  // Initialize the beard.
  const svg = document.getElementById('board');
  svg.addEventListener('click', onClick);
  svg.setAttribute('height', HEIGHT * CELL_SIZE + 1);
  svg.setAttribute('width', WIDTH * CELL_SIZE + 1);
  initSvgGrid();
  initSvgMatrix();
  newGame();

  document.addEventListener('keypress', keyPress);
  document.getElementById('start').addEventListener('click', startPress);
  showStart();
}
window.addEventListener('load', init);

// Draw the grid markers on the board.
function initSvgGrid() {
  const grid = document.getElementById('grid');
  if (!grid) throw Error('No grid SVG element found.');
  // <line class="grid" x1="19" y1="20" x2="21" y2="20"/>
  // <line class="grid" x1="20" y1="19" x2="20" y2="21"/>
  const LEN = 2;
  for (let x = 0; x <= WIDTH; x++) {
    const matrixX = x * CELL_SIZE;
    for (let y = 0; y <= HEIGHT; y++) {
      const matrixY = y * CELL_SIZE;
      // Horizontal tick.
      if (y > 0 && y < HEIGHT) {
        const line = document.createElementNS(SVG_NS, 'line');
        line.setAttribute('x1', matrixX - LEN + 0.5);
        line.setAttribute('y1', matrixY + 0.5);
        line.setAttribute('x2', matrixX + LEN + 0.5);
        line.setAttribute('y2', matrixY + 0.5);
        line.setAttribute('class', 'grid');
        grid.appendChild(line);
      }
      // Vertical tick.
      if (x > 0 && x < WIDTH) {
        const line = document.createElementNS(SVG_NS, 'line');
        line.setAttribute('x1', matrixX + 0.5);
        line.setAttribute('y1', matrixY - LEN + 0.5);
        line.setAttribute('x2', matrixX + 0.5);
        line.setAttribute('y2', matrixY + LEN + 0.5);
        line.setAttribute('class', 'grid');
        grid.appendChild(line);
      }
    }
  }
  const rect = document.createElementNS(SVG_NS, 'rect');
  rect.setAttribute('x', 0.5);
  rect.setAttribute('y', 0.5);
  rect.setAttribute('width', WIDTH * CELL_SIZE);
  rect.setAttribute('height', HEIGHT * CELL_SIZE);
  rect.setAttribute('class', 'grid');
  grid.appendChild(rect);
}

// Draw empty matrix cells on the board.
function initSvgMatrix() {
  const matrix = document.getElementById('matrix');
  if (!matrix) throw Error('No matrix SVG element found.');
  for (let x = 0; x < WIDTH; x++) {
    const matrixX = x * CELL_SIZE;
    for (let y = 0; y < HEIGHT; y++) {
      const matrixY = y * CELL_SIZE;
      const g = document.createElementNS(SVG_NS, 'g');
      g.id = x + '_' + y;
      g.setAttribute('class', 'cell-empty');
      g.setAttribute('transform', 'translate(' + matrixX + ',' + matrixY + ')');
      // <rect x="0" y="0" height="64" width="64" class="cell"/>
      const rect = document.createElementNS(SVG_NS, 'rect');
      rect.setAttribute('x', 0.5);
      rect.setAttribute('y', 0.5);
      rect.setAttribute('height', CELL_SIZE);
      rect.setAttribute('width', CELL_SIZE);
      rect.setAttribute('class', 'cell-bg');
      g.appendChild(rect);
      matrix.appendChild(g);
    }
  }
  setHoverClass(true);
}

// Show the start button.
function showStart() {
  const startButton = document.getElementById('start');
  startButton.style.display = '';
  inputMode = inputModes.START;
}

// Hide the start button, and start the game.
function startPress() {
  const startButton = document.getElementById('start');
  startButton.style.display = 'none';
  players[0] = true;
  players[1] = (playerOption === 2);
  inputMode = inputModes.BUSY;
  newGame();
}

// Terminate and clear any existing game and start a new game.
function newGame() {
  clearTimeout(timeoutPID);
  cancelAnimationFrame(animationPID);
  const explodeGroup = document.getElementById('explode');
  while(explodeGroup.firstChild) {
    explodeGroup.removeChild(explodeGroup.firstChild);
  }
  liveField = new Field();
  for (let x = 0; x < WIDTH; x++) {
    for (let y = 0; y < HEIGHT; y++) {
      drawSquare(liveField.getSquare(x, y));
    }
  }
  turn = 1;
  startNextTurn();
}

// Have the computer play one move.
function cpuPlay() {
  // The computer should appear to take a second to think of a move.
  // If it takes less that this, add an artifical delay.
  const startTime = Date.now();
  const { x, y } = cpuThink(liveField, turn, DIFFICULTY);
  const elapsedTime = Date.now() - startTime;
  timeoutPID = setTimeout(cpuPublish_.bind(null, x, y), 1000 - elapsedTime);
}

// Reveal the move.
function cpuPublish_(x, y) {
  if (!plantBomb(x, y)) {
    throw Error('Invalid location.');
  }
  sequenceDetonations(true);
}

// Run a min-max analysis for all possible moves.  Level controls the depth.
function cpuThink(board, who, level) {
  let bestScore = -Infinity;
  let bestX, bestY;
  let score;
  for (let x = 0; x < WIDTH; x++) {
    for (let y = 0; y < HEIGHT; y++) {
      const mySquare = board.getSquare(x, y);
      if (mySquare.bombs !== 0 && mySquare.owner !== who) {
        continue;
      }
      const clone = new Field(board);
      if (clone.simulate(x, y, who)) {
        // We win.
        return {score: Infinity, x: x, y: y};
      }
      if (level === 0) {
        score = clone.score();
        // Score: Positive means player 0 is winning, negative means player 1 is winning.
        // We want to find the best move for 'who'.
        if (who === 1) {
          score *= -1;
        }
        score += Math.random();  // Add some non-deterministic noise.
      } else {
        score = -cpuThink(clone, 1 - who, level - 1).score;
      }
      if (score >= bestScore) {
        bestScore = score;
        bestX = x;
        bestY = y;
      }
    }
  }
  return {score: bestScore, x: bestX, y: bestY};
}

// User clicked on the SVG.  Plant a bomb there -- if legal.
function onClick(e) {
  if (inputMode !== inputModes.PLAY) return;
  const svg = document.getElementById('board');
  // Compute the X/Y cell coordinates of the click.
  const rect = svg.getBoundingClientRect();
  const x = Math.floor((e.clientX - rect.left) / CELL_SIZE);
  const y = Math.floor((e.clientY - rect.top) / CELL_SIZE);
  if (x < 0 || x >= WIDTH || y < 0 || y >= HEIGHT) {
    // Out of bounds.
    return;
  }
  if (plantBomb(x, y)) {
    sequenceDetonations(true);
  }
}

// Add one bomb of 'turn' colour to the live board at cell 'x', 'y'.
function plantBomb(x, y) {
  if (0 > x || 0 > y || x >= WIDTH || y >= HEIGHT) {
    throw Error('Out of range.');
  }
  const mySquare = liveField.getSquare(x, y);
  if (mySquare.bombs !== 0 && mySquare.owner !== turn) {
    return false;
  }
  mySquare.addBomb(turn);
  drawSquare(mySquare);
  return true;
}

// Previous turn complete, start the other player's turn.
function startNextTurn() {
  if (liveField.isExterminated()) {
    showStart();
    return;
  }
  turn = 1 - turn;
  if (players[turn]) {
    // Human turn.
    setHoverClass(true);
    inputMode = inputModes.PLAY;
  } else {
    // Computer turn.
    setHoverClass(false);
    if (inputMode !== inputModes.START) {
      inputMode = inputModes.BUSY;
    }
    cpuPlay();
  }
}

// Look for things to blow up.  Mathematically, the order doesn't matter.
// Give priority (+2) to detonations that take out enemy squares (speeds up the end-game).
// Give priority (+1) to detonations that neighbour previous detonation (looks more logical).
// Add a random factor (0-1) so that order isn't deterministic.
// Yes, this is overly picky, but the player spends a lot of time watching this.
function sequenceDetonations(first) {
  if (first) {
    sequenceDetonations.lastX = NaN;
    sequenceDetonations.lastY = NaN;
    if (inputMode !== inputModes.START) {
      inputMode = inputModes.BUSY;
    }
    setHoverClass(false);
  }
  let bestScore = -1;
  let bestX = NaN;
  let bestY = NaN;
  for (let x = 0; x < WIDTH; x++) {
    for (let y = 0; y < HEIGHT; y++) {
      if (liveField.getSquare(x, y).isOverloaded()) {
        const owner = liveField.getSquare(x, y).owner;
        let thisScore = Math.random();
        const neighbours = liveField.getNeighbours(x, y);
        for (const neighbour of neighbours) {
          if (neighbour.bombs !== 0 && neighbour.owner !== owner) {
            thisScore += 2;
          }
        }
        if (x === sequenceDetonations.lastX &&
            (y === sequenceDetonations.lastY - 1 ||
             y === sequenceDetonations.lastY + 1)) {
          thisScore++;
        }
        if (y === sequenceDetonations.lastY &&
            (x === sequenceDetonations.lastX - 1 ||
             x === sequenceDetonations.lastX + 1)) {
          thisScore++;
        }
        if (thisScore > bestScore) {
          bestScore = thisScore;
          bestX = x;
          bestY = y;
        }
      }
    }
  }
  sequenceDetonations.lastX = bestX;
  sequenceDetonations.lastY = bestY;
  if (bestScore > -1) {
    detonateWithGraphics(bestX, bestY);
  } else {
    startNextTurn();
  }
}

sequenceDetonations.lastX = NaN;
sequenceDetonations.lastY = NaN;

// Initiate a detonation sequence for the given square.
function detonateWithGraphics(x, y) {
  const square = liveField.getSquare(x, y);
  if (!square.isOverloaded()) {
    throw Error("Can't blow up non-overloaded square.");
  }
  timeoutPID = setTimeout(implodeStep_.bind(null, square, square.neighbourCount), 100);
}

// Detonation starts with removing the bombs that will fly away.
function implodeStep_(square, steps) {
  steps--;
  square.bombs--;
  drawSquare(square);
  if (steps) {
    // Keep imploding until all exiting bombs are removed.
    timeoutPID = setTimeout(implodeStep_.bind(null, square, steps), 100);
  } else {
    explodeInit_(square);
  }
}

// Initialize the flying bombs.
function explodeInit_(square) {
  const x = square.x;
  const y = square.y;
  const explodeGroup = document.getElementById('explode');
  explodeGroup.setAttribute('transform', square.getElement().getAttribute('transform'));
  const deltas = [];
  if (x !== 0) {
    deltas.push({x: -1, y: 0});
  }
  if (x !== WIDTH - 1) {
    deltas.push({x: 1, y: 0});
  }
  if (y !== 0) {
    deltas.push({x: 0, y: -1});
  }
  if (y !== HEIGHT - 1) {
    deltas.push({x: 0, y: 1});
  }
  const startXY = BOMB_COORDINATES[1][0];
  const animatables = [];
  for (let i = 0; i < deltas.length; i++) {
    const use = drawBomb(0, 0, square.owner);
    explodeGroup.appendChild(use);
    animatables[i] = new FlyingBomb(startXY, deltas[i], use);
    animatables[i].render(0);
  }
  explodeStep_.animatables = animatables;
  explodeStep_.animateStart = null;
  explodeStep_.neighbours = liveField.getNeighbours(x, y);
  animationPID = requestAnimationFrame(explodeStep_);
}

// Animate the flying bombs.
function explodeStep_(timestamp) {
  if (!explodeStep_.animateStart) {
    explodeStep_.animateStart = timestamp;
  }
  const maxElapsed = 500;
  const elapsed = Math.min(timestamp - explodeStep_.animateStart, maxElapsed);
  const ratio = elapsed / maxElapsed;
  for (const animatable of explodeStep_.animatables) {
    animatable.render(ratio);
  }
  if (ratio < 1) {
    animationPID = requestAnimationFrame(explodeStep_);
  } else {
    explodeFinish_();
  }
}

// Clean up the flying bombs, officially add them to the neighbours.
function explodeFinish_() {
  const explodeGroup = document.getElementById('explode');
  while(explodeGroup.firstChild) {
    explodeGroup.removeChild(explodeGroup.firstChild);
  }
  explodeStep_.animatables = null;
  explodeStep_.animateStart = null;
  for (const square of explodeStep_.neighbours) {
    square.addBomb(turn);
    drawSquare(square);
  }
  explodeStep_.neighbours = null;
  if (liveField.isExterminated()) {
    showStart();
  }
  sequenceDetonations(false);
}

// Erase a square and draw in the current number of bombs.
function drawSquare(square) {
  const g = square.getElement();
  while (g.firstChild != g.lastChild) {
    g.removeChild(g.firstChild);
  }
  const bombCount = Math.min(square.bombs, BOMB_COORDINATES.length - 1);
  const coordinates = BOMB_COORDINATES[bombCount];
  for (const coordinate of coordinates) {
    const use = drawBomb(coordinate.x, coordinate.y, square.owner);
    g.insertBefore(use, g.firstChild);
  }
  g.setAttribute('class', 'cell-' + (bombCount ? turn : 'empty'));
}

// Coordinates for clusters of 1,2,3,4,5 and 6 bombs.
const BOMB_COORDINATES = [
  [],
  [{x: 36, y: 29}],
  [{x: 15, y: 29}, {x: 57, y: 29}],
  [{x: 15, y: 47}, {x: 36, y: 8}, {x: 57, y: 47}],
  [{x: 18, y: 8}, {x: 54, y: 50}, {x: 54, y: 8}, {x: 18, y: 50}],
  [{x: 6, y: 15}, {x: 36, y: 3}, {x: 66, y: 15}, {x: 18, y: 54}, {x: 54, y: 54}],
  [{x: 6, y: 15}, {x: 36, y: 3}, {x: 66, y: 15}, {x: 6, y: 55}, {x: 36, y: 43}, {x: 66, y: 55}]
];

// Draw and return a single bomb.
function drawBomb(x, y, owner) {
  // <use xlink:href="#bomb" class="bomb-player0" x="5" y="5"/>
  const use = document.createElementNS(SVG_NS, 'use');
  use.setAttributeNS(XLINK_NS, 'href', '#bomb');
  use.setAttribute('class', 'bomb-player' + owner);
  use.setAttribute('x', x);
  use.setAttribute('y', y);
  return use;
}

// Set the hovering rectangle around all valid squares to be the player's colour.
function setHoverClass(showHover) {
  const cells = document.getElementsByClassName('cell-bg');
  for (const cell of cells) {
    cell.classList.remove('hover-player0', 'hover-player1');
    if (showHover) {
      const hoverClass = 'hover-player' + turn;
      const owner = cell.parentNode.getAttribute('class');
      if (owner === 'cell-empty' || owner === 'cell-' + turn) {
        cell.classList.add(hoverClass);
      }
    }
  }
}

// User pressed space or enter to start game.
function keyPress(e) {
  if (inputMode === inputModes.START && (e.key === 'Enter' || e.key === ' ')) {
    startPress();
    e.preventDefault();
  }
}


// Constructor for a bomb that's exploded and is flying to the next square.
function FlyingBomb(startXY, squareDXY, element) {
  this.translateXStart = startXY.x;
  this.translateYStart = startXY.y;
  this.translateXFinal = this.translateXStart + squareDXY.x * CELL_SIZE;
  this.translateYFinal = this.translateYStart + squareDXY.y * CELL_SIZE;
  this.translateXNow = this.translateXStart;
  this.translateYNow = this.translateYStart;
  this.element = element;
}

// Position the bomb along its flight path (ratio: 0 is start, 1 is end).
FlyingBomb.prototype.render = function(ratio) {
  this.translateXNow = (this.translateXFinal - this.translateXStart) * ratio + this.translateXStart;
  this.translateYNow = (this.translateYFinal - this.translateYStart) * ratio + this.translateYStart;
  const translate = 'translate(' + this.translateXNow + ',' + this.translateYNow + ')';
  this.element.setAttribute('transform', translate);
};


// Constructor for playing field (basically a 2D array of squares).
function Field(opt_parent) {
  this.squares_ = new Array(WIDTH);
  for (let x = 0; x < WIDTH; x++) {
    this.squares_[x] = new Array(HEIGHT);
    for (let y = 0; y < HEIGHT; y++) {
      if (opt_parent) {
        this.squares_[x][y] = new Square(opt_parent.squares_[x][y]);
      } else {
        this.squares_[x][y] = new Square(null, x, y);
      }
    }
  }
}

// Return an array containing the 2, 3 or 4 neighbouring squares.
Field.prototype.getNeighbours = function(x, y) {
  const neighbours = [];
  if (x !== 0) {
    neighbours.push(this.squares_[x - 1][y]);
  }
  if (y !== 0) {
    neighbours.push(this.squares_[x][y - 1]);
  }
  if (x !== this.squares_.length - 1) {
    neighbours.push(this.squares_[x + 1][y]);
  }
  if (y !== this.squares_[x].length - 1) {
    neighbours.push(this.squares_[x][y + 1]);
  }
  return neighbours;
};

// Return the requested square.
Field.prototype.getSquare = function(x, y) {
  return this.squares_[x][y];
};

// Has one player exterminated the other?
Field.prototype.isExterminated = function() {
  let firstWho;
  let multiple = false;
  for (let x = 0; x < WIDTH; x++) {
    for (let y = 0; y < HEIGHT; y++) {
      const square = this.squares_[x][y];
      if (square.bombs !== 0) {
        if (firstWho === undefined) {
          firstWho = square.owner;  // First bomb found.
        } else if (firstWho === square.owner) {
          multiple = true; // There's more than one square with bombs.
        } else {
          return false; // There's more than one player.
        }
      }
    }
  }
  // There's less than two player on the board.
  // But that's ok if there's only zero or one square filled
  // (meaning both players haven't yet had their first turns).
  return multiple;
};

// Calculates a score which is designed to indicate how healthy a player's position is.
// Positive means player 0 is winning, negative means player 1 is winning.
// Used internally by the CPU player to rank the results of hypothetical moves.
// Changes to this function can have a profound effect on the CPU player.
Field.prototype.score = function() {
  const playerScores = [0, 0];
  for (let x = 0; x < WIDTH; x++) {
    for (let y = 0; y < HEIGHT; y++) {
      const square = this.squares_[x][y];
      if (square.bombs > 0) {
        let squareScore = 1;  // One point for owning the square.
        squareScore += square.bombs;  // One point for each bomb.
        if (square.isCritical()) {  // Being critical is very good.
          squareScore += 4;
        }
        playerScores[square.owner] += squareScore;
      }
    }
  }
  return playerScores[0] - playerScores[1];
};

// Simulates the effects of droping a bomb belonging to 'turn' on x/y.
// Used internally by the CPU player on disposable copies of the board.
// Returns true if this move wipes out the other player.
Field.prototype.simulate = function(x, y, who) {
  const square = this.squares_[x][y];
  square.addBomb(who);
  if (!square.isOverloaded()) {
    return false;
  }
  this.detonateLogically(x, y);
  let exterminated;
  let stable;
  do {
    stable = true;
    for (let scanX = 0; scanX < WIDTH; scanX++) {
      for (let scanY = 0; scanY < HEIGHT; scanY++) {
        if (this.squares_[scanX][scanY].isOverloaded()) {
          this.detonateLogically(scanX, scanY);
          stable = false;
        }
      }
    }
    exterminated = this.isExterminated();
  } while (!stable && !exterminated);
  return exterminated;
};

// Blow up the specified square non-graphcially.
// Used internally be the CPU player.
Field.prototype.detonateLogically = function(x, y) {
  const square = this.squares_[x][y];
  if (!square.isOverloaded()) {
    throw Error("Can't blow up non-overloaded square.");
  }
  const neighbours = this.getNeighbours(x, y);
  square.bombs -= neighbours.length;
  for (const neighbour of neighbours) {
    neighbour.addBomb(square.owner);
  }
  if (square.bombs === 0) {
    square.owner = -1;
  }
};


// This class represents one square on the playing field.
// If parent is null, create an empty square at coordinates x, y.
// Otherwise, create a clone of the parent square.
function Square(parent, x, y) {
  if (parent) {
    this.x = parent.x;
    this.y = parent.y;
    this.neighbourCount = parent.neighbourCount;
    this.bombs = parent.bombs;
    this.owner = parent.owner;
  } else {
    this.x = x;
    this.y = y;
    this.neighbourCount =
        (x !== 0) + (x !== WIDTH - 1) + (y !== 0) + (y !== HEIGHT - 1);
    this.bombs = 0;
    this.owner = -1;
  }
}

// Add one bomb belonging to 'who' to this square.
// Called when a player moves, and when a neighbouring square explodes.
Square.prototype.addBomb = function(who) {
  this.owner = who;
  this.bombs++;
};

// Is this square currently at maximum capacity?
Square.prototype.isCritical = function() {
  return this.bombs + 1 === this.neighbourCount;
};

// Is this square currently beyond maximum capacity?
Square.prototype.isOverloaded = function() {
  return this.bombs >= this.neighbourCount;
};

Square.prototype.getElement = function() {
  return document.getElementById(this.x + '_' + this.y);
};
