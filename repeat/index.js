// Keep track of currently playing audio so it may be terminated.
var currentAudio = null;

// The ever-growing sequence of notes.
var pattern = [];
// The player's (computer or human) location in the pattern.
var index = 0;

// The game has three modes: Waiting on start button, computer and human turns.
var modes = {
  START: -1,
  COMPUTER: 0,
  HUMAN: 1
};
var mode =  modes.START;

var LEVELS;
var levelCircles = [];

var winTune = [4, 3, 2, 1, 2, 3, 4];

// On page load, initialize the event handlers and show the start button.
function init() {
  var isLocal = location.protocol === 'file:';
  if (isLocal) {
    var links = document.getElementsByTagName('a');
    for (var i = 0, link; (link = links[i]); i++) {
      if (link.href.endsWith('/')) {
        link.href += 'index.html';
      }
    }
  }

  var m = document.cookie.match(/difficulty=([012])/);
  var difficultyIndex = m ? m[1] : 0;
  LEVELS = [8, 16, 32][difficultyIndex];
  var difficultySelect = document.getElementById('difficulty');
  difficultySelect.selectedIndex = difficultyIndex;
  difficultySelect.addEventListener('change', setDifficulty);
  for (var i = 1; i <= 4; i++) {
    var button = document.getElementById('b' + i);
    button.addEventListener('mousedown', buttonStart.bind(button, i));
    button.addEventListener('mouseup', buttonStop.bind(button, i));
    button.addEventListener('mouseout', buttonStop.bind(button, i));
  }

  document.body.addEventListener('keydown', keyDown);
  document.body.addEventListener('keyup', keyUp);
  document.body.addEventListener('keypress', keyPress);

  document.getElementById('start').addEventListener('click', startGame);
  showStart();
  initTimeline();
}
window.addEventListener('load', init);

// Change the difficulty level.
function setDifficulty() {
  var difficultySelect = document.getElementById('difficulty');
  var value = difficultySelect.options[difficultySelect.selectedIndex].value;
  document.cookie = 'difficulty=' + value + '; SameSite=Strict';
  location.reload();
}

// Draw level locations on the timeline.
function initTimeline() {
  var svg = document.getElementById('timeline');
  var svgNS = svg.namespaceURI;
  // <circle cx="5%" cy=10 r=5 class="notDone"></circle>
  for (var i = 0; i < LEVELS; i++) {
    var x = (90 / (LEVELS - 1) * i) + 5;
    var circle = document.createElementNS(svgNS, 'circle');
    circle.setAttribute('cx', x + '%');
    circle.setAttribute('cy', 10);
    circle.setAttribute('r', 5);
    circle.setAttribute('class', 'notDone');
    svg.appendChild(circle);
    levelCircles[i] = circle;
  }
  document.getElementById('levelMax').textContent = LEVELS;
}

// Show the start button and disable the controls.
function showStart() {
  document.body.className = '';
  var startButton = document.getElementById('start');
  startButton.style.display = '';
  var table = document.getElementById('controls');
  table.classList.add('disabled');
  mode = modes.START;
}

// Hide the start button, and start the computer's turn.
function startGame() {
  var startButton = document.getElementById('start');
  startButton.style.display = 'none';
  var table = document.getElementById('controls');
  table.classList.remove('disabled');
  pattern.length = 0;
  for (var circle, i = 0; (circle = levelCircles[i]); i++) {
    circle.setAttribute('class', 'notDone');
    circle.setAttribute('r', 5);
  }
  startComputer();
}

// Computer's turn: add a new note, and start playing all the notes.
function startComputer() {
  mode = modes.COMPUTER;  // Computer
  index = 0;
  document.getElementById('level').textContent = pattern.length;
  if (pattern.length) {
    levelCircles[pattern.length - 1].setAttribute('class', 'done');
    levelCircles[pattern.length - 1].setAttribute('r', 5);
  }
  if (pattern.length === LEVELS) {
    // The human has reached the maximum level.
    mode = modes.START;
    index = 0;
    setTimeout(playWinTune, 1000);
    return;
  }
  levelCircles[pattern.length].setAttribute('class', 'now');
  levelCircles[pattern.length].setAttribute('r', 7);
  pattern.push(Math.floor(Math.random() * 4) + 1);
  setTimeout(playStep, 1000);
}

// Play the next note in the win tune.
function playWinTune() {
  var note = winTune[index];
  if (note === undefined) {
    setTimeout(showStart, 500);
    return;
  }
  noteStart(note);
  setTimeout(noteStop.bind(this, note), 200);
  index++;
  setTimeout(playWinTune, 250);
}


// Play the next note in the computer's turn.
function playStep() {
  var note = pattern[index];
  if (note === undefined) {
    startHuman();
    return;
  }
  noteStart(note);
  setTimeout(noteStop.bind(this, note), 500);
  index++;
  setTimeout(playStep, 750);
}

// Human's turn.
function startHuman() {
  mode = modes.HUMAN;  // Human
  index = 0;
}

// Human pressed the wrong note.  End game, show start button.
function fail() {
  document.body.className = 'fail';
  document.getElementById('fail').play();
  mode = modes.START;
  setTimeout(showStart, 1000);
}

// Human pressed space or enter to start game.
function keyPress(e) {
  if (mode === modes.START && (e.key === 'Enter' || e.key === ' ')) {
    startGame();
    e.preventDefault();
  }
}

// Human pressed a cursor key down to start a note playing.
// Map this onto an HTML button push.
function keyDown(e) {
  if (e.repeat) {
    return;
  }
  switch (e.key) {
    case('ArrowUp'):
      buttonStart(1);
      break;
    case('ArrowLeft'):
      buttonStart(2);
      break;
    case('ArrowDown'):
      buttonStart(3);
      break;
    case('ArrowRight'):
      buttonStart(4);
      break;
    default:
      return;
  }
  e.preventDefault();
}

// Human released a cursor key to stop a note playing.
// Map this onto an HTML button release.
function keyUp(e) {
  switch (e.key) {
    case('ArrowUp'):
      buttonStop(1);
      break;
    case('ArrowLeft'):
      buttonStop(2);
      break;
    case('ArrowDown'):
      buttonStop(3);
      break;
    case('ArrowRight'):
      buttonStop(4);
      break;
    default:
      return;
  }
  e.preventDefault();
}

// Human pressed an HTML button down to start a note playing.
function buttonStart(i) {
  if (mode !== modes.HUMAN) {
    return;
  }
  expectedNote = pattern[index];
  index++;
  if (expectedNote == i) {
    noteStart(i);
  } else {
    fail();
  }
}

// Human released an HTML button to stop a note playing.
function buttonStop(i) {
  if (mode !== modes.HUMAN) {
    return;
  }
  noteStop(i);
  if (index === pattern.length) {
    mode = modes.COMPUTER;
    startComputer();
  }
}

// Human or computer starts a note playing.
function noteStart(i) {
  if (currentAudio) {
    currentAudio.pause();
  }
  var button = document.getElementById('b' + i);
  button.classList.add('highlight');
  currentAudio = document.getElementById('a' + i);
  currentAudio.load();
  currentAudio.play();
}

// Human or computer stops a note playing.
function noteStop(i) {
  var button = document.getElementById('b' + i);
  button.classList.remove('highlight');
  if (currentAudio) {
    currentAudio.pause();
  }
}
