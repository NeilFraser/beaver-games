var WIDTH = 30;
var HEIGHT = 20;

var headXY = [];
var directionStack = [];

var directions = {
  LEFT: 0,
  RIGHT: 1,
  UP: 2,
  DOWN: 3
};

var deltas = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1]
];

var moveResult = {
  FREE: 0,
  FOOD: 1,
  CRASH: 2
};

var SPEED = 200;

var playerDirection = directions.RIGHT;

var snakeCoordinates = [];

function init() {
  fixLinks();

  injectTable();
  initBorders();
  setHead(Math.floor(WIDTH / 2), Math.floor(HEIGHT / 2));
  step(true);
  step(true);
  addFood();
  addFood();
  document.addEventListener('keydown', keydown);
  step();
}

function injectTable() {
  var count = 0;
  var table = document.getElementById('grid');
  for (var y = 0; y < HEIGHT; y++) {
    var tr = document.createElement('tr');
    for (var x = 0; x < WIDTH; x++) {
      count++;
      var td = document.createElement('td');
      td.id = x + '_' + y;
      td.className = ((x + y) % 2) ? 'even' : 'odd';
      tr.appendChild(td);
    }
    table.appendChild(tr);
  }
}
window.addEventListener('load', init);

function initBorders() {
  var doorWidth = 3;  // Approximately one half the width of the door.
  for (var x = 0; x < WIDTH; x++) {
    if (Math.abs(x - WIDTH / 2) < doorWidth) {
      continue;
    }
    getCell(x, 0).className = 'border';
    getCell(x, HEIGHT - 1).className = 'border';
  }
  for (var y = 1; y < HEIGHT - 1; y++) {
    if (Math.abs(y - HEIGHT / 2) < doorWidth) {
      continue;
    }
    getCell(WIDTH - 1, y).className = 'border';
    getCell(0, y).className = 'border';
  }
}

function addFood() {
  do {
    var x = Math.floor(Math.random() * WIDTH);
    var y = Math.floor(Math.random() * HEIGHT);
    var cell = getCell(x, y);
  } while (cell.classList.contains('border') ||
           cell.classList.contains('snake') ||
           cell.classList.contains('food'));
  cell.classList.add('food');
}

function setHead(x, y) {
  var newHead = getCell(x, y);
  if (newHead.classList.contains('border') ||
      newHead.classList.contains('snake')) {
    return moveResult.CRASH;
  }
  if (headXY.length) {
    var oldHead = getCell(headXY[0], headXY[1]);
    oldHead.classList.remove('head');
  }
  headXY = [x, y];
  newHead.classList.add('head');
  newHead.classList.add('snake');
  snakeCoordinates.push([x, y]);
  if (newHead.classList.contains('food')) {
    newHead.classList.remove('food');
    return moveResult.FOOD;
  }
  return moveResult.FREE;
}

function moveHead(dxy) {
  var x = headXY[0] + dxy[0];
  var y = headXY[1] + dxy[1];
  if (x < 0) {
    x += WIDTH;
  } else if (x >= WIDTH) {
    x -= WIDTH;
  }
  if (y < 0) {
    y += HEIGHT;
  } else if (y >= HEIGHT) {
    y -= HEIGHT;
  }
  return setHead(x, y);
}

function getCell(x, y) {
  return document.getElementById(x + '_' + y);
}

function step(initialGrow) {
   var newDirection = directionStack.shift();
   if (newDirection !== undefined) {
     playerDirection = newDirection;
   }
   var result = moveHead(deltas[playerDirection]);
   if (result == moveResult.CRASH) {
     return;
   } else if (result == moveResult.FOOD) {
    addFood();
   } else if (result == moveResult.FREE && !initialGrow) {
     var tail = snakeCoordinates.shift();
     var tailCell = getCell(tail[0], tail[1]);
     tailCell.classList.remove('snake');
   }
   if (!initialGrow) {
     setTimeout(step, SPEED);
   }
}

function keydown(e) {
  if (e.repeat) {
    return;
  }
  switch (e.key) {
    case 'ArrowLeft':
      pushDirection(directions.LEFT);
      break;
    case 'ArrowRight':
      pushDirection(directions.RIGHT);
      break;
    case 'ArrowUp':
      pushDirection(directions.UP);
      break;
    case 'ArrowDown':
      pushDirection(directions.DOWN);
      break;
    default:
      return;
  }
}

function pushDirection(newDirection) {
  var last = directionStack[directionStack.length - 1];
  if (last === undefined) {
    last = playerDirection;
  }
  // Discard fatal 180 degree reversals.
  if ((last === directions.LEFT && newDirection === directions.RIGHT) ||
      (last === directions.RIGHT && newDirection === directions.LEFT) ||
      (last === directions.UP && newDirection === directions.DOWN) ||
      (last === directions.DOWN && newDirection === directions.UP)) {
    return;
  }
  // Only schedule changes.
  if (last !== newDirection) {
    directionStack.push(newDirection);
  }
}
