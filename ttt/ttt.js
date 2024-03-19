/**
 * @license
 * Copyright 2020 Neil Fraser
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @fileoverview Tic Tac Toe.
 * @author root@neil.fraser.name (Neil Fraser)
 */
'use strict';


var X_VALUE = -1;
var EMPTY = 0;
var O_VALUE = 1;
var TIE = 2;

// The internal representation of the board.
var board = [];

// Whose turn, X or O?
// Either X_VALUE (-1) or Y_VALUE (1).
var turn;

// Human goes first on first game (but this is negated at the start).
var cpuFirst = true;

// Is the human allowed to click?
var enabled;

// One of three difficulty levels (0, 1, 2).
// 0: always play a move that wins.  -- Disabled (doesn't force player to think)
// 1: failing a win, play a blocking move.
// 2: play a perfect game.
var DIFFICULTY;

// Namespace for SVG elements.
var SVG_NS = 'http://www.w3.org/2000/svg';
// Namespace for XLink attributes.
var XLINK_NS = 'http://www.w3.org/1999/xlink';

// A blank square was clicked.
function squareClick(e) {
  if (!enabled) {
    return;
  }
  // Extract the ID from the parent SVG.
  var svg = e.target.parentNode;
  var i = Number(svg.id.substring(3));
  humanPlay(i);
}

function humanPlay(i) {
  draw(i);
  drawScore();

  // Let the computer move in half a second.
  if (boardState(board) === EMPTY) {
    enabled = false;
    setTimeout(computerPlay, 500);
  }
}

// Return a random element from a list.
function randomElement(list) {
  return list[Math.floor(Math.random() * list.length)];
}

// Computer moves.
function computerPlay() {
  var result;
  if (DIFFICULTY === 2) {
    // Solve the game.
    result = dream(turn, board)[0];
  } else {
    result = lookAhead();
  }
  draw(result);
  enabled = true;
  drawScore();
}

// Draw a move at the specified spot.
function draw(i) {
  var oldUse = document.querySelector('#svg' + i + '>use');
  var newUse = document.createElementNS(SVG_NS, 'use');
  newUse.setAttributeNS(XLINK_NS, 'href', '#generic-' +
      (turn == X_VALUE ? 'x' : 'o') + '-' +
      ((cpuFirst ? turn === X_VALUE : turn === O_VALUE)  ? 'cpu' : 'human'));
  oldUse.parentNode.replaceChild(newUse, oldUse);

  // Update the internal board, and toggle whose turn it is.
  board[i] = turn;
  turn = invert(turn);
}

// Search all future moves.  Perfect game.
// Here be recursive dragons.
// Return a tuple: where to move, and expected result.
function dream(x_o, board) {
  var state = boardState(board);
  if (state !== EMPTY) {
    return [-1, state];
  }
  var wins = [];
  var ties = [];
  var losses = [];
  for (var i = 0; i < 9; i++) {
    if (board[i] === EMPTY) {
      var dreamBoard = board.slice();
      dreamBoard[i] = x_o;
      var result = dream(invert(x_o), dreamBoard)[1];
      if (result === x_o) {
        wins.push(i);
      } else if (result === TIE) {
        ties.push(i);
      } else {
        losses.push(i);
      }
    }
  }
  if (wins.length > 0) {
    return [randomElement(wins), x_o];
  } else if (ties.length > 0) {
    return [randomElement(ties), TIE];
  }
  return [randomElement(losses), invert(x_o)];
}

// Look for a winning move, and optionally a blocking move.
function lookAhead() {
  var wins = [];
  var blocks = [];
  var empty = [];
  var nextTurn = invert(turn);
  for (var i = 0; i < 9; i++) {
    if (board[i] === EMPTY) {
      empty.push(i);
      var dreamBoard = board.slice();
      dreamBoard[i] = turn;
      var state = boardState(dreamBoard);
      if (state === turn) {
        // Winning move found.
        wins.push(i);
      }
      if (DIFFICULTY === 1) {
        dreamBoard = board.slice();
        dreamBoard[i] = nextTurn;
        var state = boardState(dreamBoard);
        if (state === nextTurn) {
          // Blocking move found.
          blocks.push(i);
        }
      }
    }
  }
  if (wins.length > 0) {
    return randomElement(wins);
  } else if (blocks.length > 0) {
    return randomElement(blocks);
  }
  return randomElement(empty);
}

// Return the opposite of X_VALUE or O_VALUE.
function invert(x_o) {
  return x_o == X_VALUE ? O_VALUE : X_VALUE;
}

// Given a board, has X or O won (X_VALUE and O_VALUE),
// or is in full (TIE), or still playable (EMPTY)?
function boardState(board) {
  for (var i = 0; i < 3; i++) {
    if (board[i] !== EMPTY &&
        board[i] === board[i + 3] && board[i] === board[i + 6]) {
      return board[i];
    }
  }
  for (var i = 0; i < 9; i += 3) {
    if (board[i] !== EMPTY &&
        board[i] === board[i + 1] && board[i] === board[i + 2]) {
      return board[i];
    }
  }
  if (board[4] !== EMPTY) {
    if ((board[0] === board[4] && board[4] === board[8]) ||
        (board[2] === board[4] && board[4] === board[6])) {
      return board[4];
    }
  }
  if (board.indexOf(EMPTY) !== -1) {
    return EMPTY;
  }
  return TIE;
}

// Add UI elements to end the game.
function drawScore() {
  // Print text message.
  var state = boardState(board);
  var text = '';
  if (state === (cpuFirst ? X_VALUE : O_VALUE)) {
    text = 'Computer wins.';
    document.getElementById('fail').play();
  } else if (state === (cpuFirst ? O_VALUE : X_VALUE)) {
    text = 'You win!';
    document.getElementById('ding').play();
  } else if (state === TIE) {
    text = 'It is a tie.';
  }
  if (text) {
    document.getElementById('status').textContent = text;
    document.getElementById('shield').style.display = 'block';
  }

  // Draw a winning stroke.
  // <line x1="5%" y1="5%" x2="95%" y2="95%" id="win" />
  if (state === X_VALUE || state === O_VALUE) {
    var x1, y1, x2, y2;
    // Vertical.
    for (var i = 0; i < 3; i++) {
      if (board[i] !== EMPTY &&
          board[i] === board[i + 3] && board[i] === board[i + 6]) {
        x1 = ['16.7%', '50%', '83.3%'][i];
        y1 = '5%';
        x2 = x1;
        y2 = '95%';
      }
    }
    // Horizontal.
    for (var i = 0; i < 9; i += 3) {
      if (board[i] !== EMPTY &&
          board[i] === board[i + 1] && board[i] === board[i + 2]) {
        x1 = '5%';
        y1 = ['16.7%', '50%', '83.3%'][Math.floor(i / 3)];
        x2 = '95%';
        y2 = y1;
      }
    }
    if (board[0] === board[4] && board[4] === board[8]) {
      // \.
      x1 = '5%';
      y1 = '5%';
      x2 = '95%';
      y2 = '95%';
    } else if (board[2] === board[4] && board[4] === board[6]) {
      // /.
      x1 = '5%';
      y1 = '95%';
      x2 = '95%';
      y2 = '5%';
    }
    var line = document.getElementById('win');
    line.setAttribute('x1', x1);
    line.setAttribute('y1', y1);
    line.setAttribute('x2', x2);
    line.setAttribute('y2', y2);
    line.style.display = 'block';
  }

  // Lock up the human if there is nowhere to play.
  if (state != EMPTY) {
    enabled = false;
  }
}

function reset() {
  // Destroy all previous Xs and Os.
  var junkList = document.querySelectorAll('#ttt>svg>use');
  for (var i = 0, junk; (junk = junkList[i]); i++) {
    junk.parentNode.removeChild(junk);
  }

  // Fill each square with a blank rectangle and a click handler.
  for (var i = 0; i < 9; i++) {
    var svg = document.getElementById('svg' + i);
    var use = document.createElementNS(SVG_NS, 'use');
    use.setAttributeNS(XLINK_NS, 'href', '#generic-square');
    svg.appendChild(use);

    use.addEventListener('click', squareClick);
  }

  // Hide end-game elements.
  document.getElementById('shield').style.display = 'none';
  document.getElementById('win').style.display = 'none';

  // Initialize the board.
  board = [EMPTY, EMPTY, EMPTY, EMPTY, EMPTY, EMPTY, EMPTY, EMPTY, EMPTY];
  // Computer goes first on even games.  Humans on odd games.
  cpuFirst = !cpuFirst;
  // X goes first.
  turn = X_VALUE;
  if (cpuFirst) {
    // Computer's first move is random.
    draw(Math.floor(Math.random() * 9));
  }
  enabled = true;
}

// Key presses to clear shield, or play.
function keyDown(e) {
  if (e.key === 'Enter' || e.key === ' ') {
    if (document.getElementById('shield').style.display === 'block') {
      reset();
    }
    e.preventDefault();
  }
  if (e.code >= 'Numpad1' && e.code <= 'Numpad9') {
    var i = Number(e.code.slice(-1));
    // Convert from 789/456/123 layout to 0-8.
    i = [null, 6, 7, 8, 3, 4, 5, 0, 1, 2][i];
    if (enabled && board[i] === EMPTY) {
      humanPlay(i);
    }
  }
}

// On page load, initialize the event handlers.
function init() {
  fixLinks();

  var m = document.cookie.match(/difficulty=([12])/);
  DIFFICULTY = Number(m ? m[1] : 1);
  document.getElementById('difficulty').selectedIndex = DIFFICULTY - 1;
  registerOptions('difficulty');

  document.addEventListener('keydown', keyDown);
  document.getElementById('shield').addEventListener('click', reset);
  reset();
}
window.addEventListener('load', init);
