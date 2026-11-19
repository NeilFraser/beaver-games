/**
 * @license
 * Copyright 2026 Neil Fraser
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @fileoverview Cross Math game.
 * @author root@neil.fraser.name (Neil Fraser)
 */
'use strict';


// Difficulty level (0,1,2).
let difficultyLevel = NaN;

// On page load, initialize the event handlers and show the start button.
function init() {
  fixLinks();

  const m = document.cookie.match(/difficulty=([012])/);
  difficultyLevel = m ? m[1] : 0;
  document.getElementById('difficulty').selectedIndex = difficultyLevel;
  registerOptions('difficulty');

  document.getElementById('start').addEventListener('click', startGame);
  showStart();
}
window.addEventListener('load', init);

// Show the start button.
function showStart() {
  document.body.className = '';
  const startButton = document.getElementById('start');
  startButton.style.display = '';
}

// Hide the start button, and start the game.
function startGame() {
  const startButton = document.getElementById('start');
  startButton.style.display = 'none';
  // Start the game here.
}

// End game, show start button.
function fail() {
  document.body.className = 'shake';
  document.getElementById('crash').play();
  setTimeout(showStart, 1000);
}
