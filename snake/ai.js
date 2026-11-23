/**
 * @license
 * Copyright 2026 Neil Fraser
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @fileoverview Snake game's AI.
 * @author root@neil.fraser.name (Neil Fraser)
 */
'use strict';

/**
 * Computes the next move for the given player.
 * @param {number} playerIndex Index of the player.
 */
function computeMove(playerIndex) {
  const snake = snakes[playerIndex];
  if (!snake || !snake.coordinates || snake.coordinates.length === 0) {
    return;
  }
  if (this) {
    this.playerIndex = playerIndex;
    this.snake = snake;
  }

  const head = snake.coordinates.at(-1);
  const tail = snake.coordinates[0];
  const tailIdx = tail[1] * WIDTH + tail[0];

  // 1. Identify all immediately safe candidate moves.
  const safeMoves = [];
  for (let d = 0; d < 4; d++) {
    if (isOpposite(d, snake.direction)) {
      continue;
    }
    const nx = (head[0] + deltas[d][0] + WIDTH) % WIDTH;
    const ny = (head[1] + deltas[d][1] + HEIGHT) % HEIGHT;
    const cell = getCell([nx, ny]);
    if (!cell || cell.classList.contains('border') || cell.classList.contains('snake')) {
      continue;
    }
    safeMoves.push({ direction: d, x: nx, y: ny });
  }

  // If no safe moves, keep current direction.
  if (safeMoves.length === 0) {
    return;
  }

  // If only one safe move, take it immediately.
  if (safeMoves.length === 1) {
    snake.pushDirection(safeMoves[0].direction);
    return;
  }

  // 2. Look for safe paths to apples.
  const apples = getApples();
  const safeApplePaths = [];

  for (const apple of apples) {
    const path = findPath(head, apple, snake.direction, null, null);
    if (path && path.dirs.length > 0) {
      if (isApplePathSafe(snake, path)) {
        safeApplePaths.push(path);
      }
    }
  }

  if (safeApplePaths.length > 0) {
    // Sort safe apple paths: prefer shorter paths, avoid moving near opponent head if close.
    safeApplePaths.sort((a, b) => {
      const aNearOpp = isNearOpponentHead(a.coords[0][0], a.coords[0][1], playerIndex);
      const bNearOpp = isNearOpponentHead(b.coords[0][0], b.coords[0][1], playerIndex);
      const aCost = a.dirs.length + (aNearOpp ? 3 : 0);
      const bCost = b.dirs.length + (bNearOpp ? 3 : 0);
      return aCost - bCost;
    });

    const chosenDir = safeApplePaths[0].dirs[0];
    snake.pushDirection(chosenDir);
    return;
  }

  // 3. Fallback / Survival Mode:
  // Neither apple has a guaranteed safe path. Pick the safest move.
  let bestMove = null;
  let bestScore = -Infinity;

  for (const move of safeMoves) {
    let score = 0;

    // Check if this move can reach the snake's tail.
    const pathToTail = findPath([move.x, move.y], tail, move.direction, null, tailIdx);
    if (pathToTail) {
      score += 10000;
      // In survival mode, a slightly longer path to tail leaves more room for tail to vacate.
      score += Math.min(pathToTail.dirs.length, 50);
    }

    // Flood fill: amount of free space reachable from this square.
    const freeSpace = countReachableCells(move.x, move.y, null, tailIdx);
    score += freeSpace * 10;

    // Distance to closest apple (prefer moving towards food if space is comparable).
    if (apples.length > 0) {
      let minAppleDist = Infinity;
      for (const apple of apples) {
        const d = findPath([move.x, move.y], apple, move.direction, null, null);
        if (d && d.dirs.length < minAppleDist) {
          minAppleDist = d.dirs.length;
        }
      }
      if (minAppleDist !== Infinity) {
        score += (100 - minAppleDist);
      }
    }

    // Penalize moving adjacent to opponent's head to prevent collisions.
    if (isNearOpponentHead(move.x, move.y, playerIndex)) {
      score -= 500;
    }

    // Slight preference for maintaining current direction.
    if (move.direction === snake.direction) {
      score += 5;
    }

    if (score > bestScore) {
      bestScore = score;
      bestMove = move;
    }
  }

  if (bestMove) {
    snake.pushDirection(bestMove.direction);
  }
}

/**
 * Returns whether two directions are direct opposites (180 degree reversal).
 * @param {number} dir1 First direction.
 * @param {number} dir2 Second direction.
 * @returns {boolean} True if opposite.
 */
function isOpposite(dir1, dir2) {
  return (dir1 === directions.LEFT && dir2 === directions.RIGHT) ||
         (dir1 === directions.RIGHT && dir2 === directions.LEFT) ||
         (dir1 === directions.UP && dir2 === directions.DOWN) ||
         (dir1 === directions.DOWN && dir2 === directions.UP);
}

/**
 * Returns an array of coordinates for all apples currently on the board.
 * @returns {!Array<!Array<number>>} Array of [x, y] coordinates.
 */
function getApples() {
  const foods = document.getElementsByClassName('food');
  const apples = [];
  for (let i = 0; i < foods.length; i++) {
    const parts = foods[i].id.split('_');
    apples.push([Number(parts[0]), Number(parts[1])]);
  }
  return apples;
}

/**
 * Checks if a cell is blocked by border walls, snakes, or extra obstacles.
 * @param {number} x X coordinate.
 * @param {number} y Y coordinate.
 * @param {?Set<number>} extraObstacles Set of cell indices that are treated as blocked.
 * @param {?number} allowCellIndex Cell index that should be treated as walkable even if snake.
 * @returns {boolean} True if blocked.
 */
function isBlocked(x, y, extraObstacles, allowCellIndex) {
  const cell = getCell([x, y]);
  if (!cell || cell.classList.contains('border')) {
    return true;
  }
  const idx = y * WIDTH + x;
  if (allowCellIndex !== null && allowCellIndex !== undefined && idx === allowCellIndex) {
    return false;
  }
  if (extraObstacles && extraObstacles.has(idx)) {
    return true;
  }
  return cell.classList.contains('snake');
}

/**
 * Finds the shortest path between start and target coordinates using BFS.
 * @param {!Array<number>} start [x, y] start.
 * @param {!Array<number>} target [x, y] target.
 * @param {?number} initialDir Direction snake is moving (cannot reverse on step 1).
 * @param {?Set<number>} extraObstacles Extra cell indices to treat as blocked.
 * @param {?number} allowCellIndex Cell index to treat as walkable.
 * @returns {?{dirs: !Array<number>, coords: !Array<!Array<number>>}} Path object, or null.
 */
function findPath(start, target, initialDir, extraObstacles, allowCellIndex) {
  const startIdx = start[1] * WIDTH + start[0];
  const targetIdx = target[1] * WIDTH + target[0];
  if (startIdx === targetIdx) {
    return { dirs: [], coords: [] };
  }

  const totalCells = WIDTH * HEIGHT;
  const queue = [startIdx];
  let queueHead = 0;
  const visited = new Uint8Array(totalCells);
  const cameFrom = new Int16Array(totalCells).fill(-1);
  const cameFromDir = new Int8Array(totalCells).fill(-1);

  visited[startIdx] = 1;

  while (queueHead < queue.length) {
    const curr = queue[queueHead++];
    if (curr === targetIdx) {
      const dirs = [];
      const coords = [];
      let step = curr;
      while (step !== startIdx) {
        dirs.push(cameFromDir[step]);
        coords.push([step % WIDTH, Math.floor(step / WIDTH)]);
        step = cameFrom[step];
      }
      dirs.reverse();
      coords.reverse();
      return { dirs, coords };
    }

    const currX = curr % WIDTH;
    const currY = Math.floor(curr / WIDTH);

    for (let d = 0; d < 4; d++) {
      if (curr === startIdx && initialDir !== null && initialDir !== undefined) {
        if (isOpposite(d, initialDir)) {
          continue;
        }
      }

      const nx = (currX + deltas[d][0] + WIDTH) % WIDTH;
      const ny = (currY + deltas[d][1] + HEIGHT) % HEIGHT;
      const nextIdx = ny * WIDTH + nx;

      if (visited[nextIdx]) {
        continue;
      }

      if (nextIdx !== targetIdx) {
        if (isBlocked(nx, ny, extraObstacles, allowCellIndex)) {
          continue;
        }
      } else {
        const cell = getCell([nx, ny]);
        if (!cell || cell.classList.contains('border')) {
          continue;
        }
        if (extraObstacles && extraObstacles.has(nextIdx)) {
          continue;
        }
        if (allowCellIndex !== nextIdx && cell.classList.contains('snake')) {
          continue;
        }
      }

      visited[nextIdx] = 1;
      cameFrom[nextIdx] = curr;
      cameFromDir[nextIdx] = d;
      queue.push(nextIdx);
    }
  }

  return null;
}

/**
 * Checks whether following a path to an apple leaves the snake with a safe exit to its tail.
 * @param {!Snake} snake The snake instance.
 * @param {!{dirs: !Array<number>, coords: !Array<!Array<number>>}} path Path to apple.
 * @returns {boolean} True if following the path is safe.
 */
function isApplePathSafe(snake, path) {
  const K = path.coords.length;
  const L = snake.coordinates.length;

  let simulatedBody;
  if (K - 1 >= L) {
    simulatedBody = path.coords.slice(-(L + 1));
  } else {
    simulatedBody = snake.coordinates.slice(K - 1).concat(path.coords);
  }

  const newHead = simulatedBody.at(-1);
  const newTail = simulatedBody[0];
  const newTailIdx = newTail[1] * WIDTH + newTail[0];

  const simObstacles = new Set();
  for (let i = 1; i < simulatedBody.length; i++) {
    simObstacles.add(simulatedBody[i][1] * WIDTH + simulatedBody[i][0]);
  }

  // Include opponent snake's body as obstacles.
  for (let s = 0; s < snakes.length; s++) {
    if (snakes[s] !== snake) {
      for (const pt of snakes[s].coordinates) {
        simObstacles.add(pt[1] * WIDTH + pt[0]);
      }
    }
  }

  const pathToTail = findPath(newHead, newTail, path.dirs.at(-1), simObstacles, newTailIdx);
  return pathToTail !== null;
}

/**
 * Counts reachable free cells from a start position (flood fill).
 * @param {number} startX Start X coordinate.
 * @param {number} startY Start Y coordinate.
 * @param {?Set<number>} extraObstacles Extra obstacles.
 * @param {?number} allowCellIndex Cell index to treat as walkable.
 * @returns {number} Count of reachable cells.
 */
function countReachableCells(startX, startY, extraObstacles, allowCellIndex) {
  const startIdx = startY * WIDTH + startX;
  const totalCells = WIDTH * HEIGHT;
  const queue = [startIdx];
  let queueHead = 0;
  const visited = new Uint8Array(totalCells);
  visited[startIdx] = 1;

  while (queueHead < queue.length) {
    const curr = queue[queueHead++];
    const currX = curr % WIDTH;
    const currY = Math.floor(curr / WIDTH);

    for (let d = 0; d < 4; d++) {
      const nx = (currX + deltas[d][0] + WIDTH) % WIDTH;
      const ny = (currY + deltas[d][1] + HEIGHT) % HEIGHT;
      const nextIdx = ny * WIDTH + nx;

      if (visited[nextIdx]) {
        continue;
      }

      if (isBlocked(nx, ny, extraObstacles, allowCellIndex)) {
        continue;
      }

      visited[nextIdx] = 1;
      queue.push(nextIdx);
    }
  }

  return queue.length;
}

/**
 * Checks if a coordinate is adjacent to an opponent snake's head.
 * @param {number} x X coordinate.
 * @param {number} y Y coordinate.
 * @param {number} playerIndex Index of the current player.
 * @returns {boolean} True if adjacent to an opponent head.
 */
function isNearOpponentHead(x, y, playerIndex) {
  for (let i = 0; i < snakes.length; i++) {
    if (i === playerIndex) {
      continue;
    }
    const opp = snakes[i];
    if (!opp || !opp.coordinates || opp.coordinates.length === 0) {
      continue;
    }
    const oppHead = opp.coordinates.at(-1);
    for (let d = 0; d < 4; d++) {
      const hx = (oppHead[0] + deltas[d][0] + WIDTH) % WIDTH;
      const hy = (oppHead[1] + deltas[d][1] + HEIGHT) % HEIGHT;
      if (x === hx && y === hy) {
        return true;
      }
    }
  }
  return false;
}


/**
 * Returns whether two directions are direct opposites (180 degree reversal).
 * @param {number} dir1 First direction.
 * @param {number} dir2 Second direction.
 * @returns {boolean} True if opposite.
 */
function isOpposite(dir1, dir2) {
  return (dir1 === directions.LEFT && dir2 === directions.RIGHT) ||
         (dir1 === directions.RIGHT && dir2 === directions.LEFT) ||
         (dir1 === directions.UP && dir2 === directions.DOWN) ||
         (dir1 === directions.DOWN && dir2 === directions.UP);
}

/**
 * Returns an array of coordinates for all apples currently on the board.
 * @returns {!Array<!Array<number>>} Array of [x, y] coordinates.
 */
function getApples() {
  const foods = document.getElementsByClassName('food');
  const apples = [];
  for (let i = 0; i < foods.length; i++) {
    const parts = foods[i].id.split('_');
    apples.push([Number(parts[0]), Number(parts[1])]);
  }
  return apples;
}

/**
 * Checks if a cell is blocked by border walls, snakes, or extra obstacles.
 * @param {number} x X coordinate.
 * @param {number} y Y coordinate.
 * @param {?Set<number>} extraObstacles Set of cell indices that are treated as blocked.
 * @param {?number} allowCellIndex Cell index that should be treated as walkable even if snake.
 * @returns {boolean} True if blocked.
 */
function isBlocked(x, y, extraObstacles, allowCellIndex) {
  const cell = getCell([x, y]);
  if (!cell || cell.classList.contains('border')) {
    return true;
  }
  const idx = y * WIDTH + x;
  if (allowCellIndex !== null && allowCellIndex !== undefined && idx === allowCellIndex) {
    return false;
  }
  if (extraObstacles && extraObstacles.has(idx)) {
    return true;
  }
  return cell.classList.contains('snake');
}

/**
 * Finds the shortest path between start and target coordinates using BFS.
 * @param {!Array<number>} start [x, y] start.
 * @param {!Array<number>} target [x, y] target.
 * @param {?number} initialDir Direction snake is moving (cannot reverse on step 1).
 * @param {?Set<number>} extraObstacles Extra cell indices to treat as blocked.
 * @param {?number} allowCellIndex Cell index to treat as walkable.
 * @returns {?{dirs: !Array<number>, coords: !Array<!Array<number>>}} Path object, or null.
 */
function findPath(start, target, initialDir, extraObstacles, allowCellIndex) {
  const startIdx = start[1] * WIDTH + start[0];
  const targetIdx = target[1] * WIDTH + target[0];
  if (startIdx === targetIdx) {
    return { dirs: [], coords: [] };
  }

  const totalCells = WIDTH * HEIGHT;
  const queue = [startIdx];
  let queueHead = 0;
  const visited = new Uint8Array(totalCells);
  const cameFrom = new Int16Array(totalCells).fill(-1);
  const cameFromDir = new Int8Array(totalCells).fill(-1);

  visited[startIdx] = 1;

  while (queueHead < queue.length) {
    const curr = queue[queueHead++];
    if (curr === targetIdx) {
      const dirs = [];
      const coords = [];
      let step = curr;
      while (step !== startIdx) {
        dirs.push(cameFromDir[step]);
        coords.push([step % WIDTH, Math.floor(step / WIDTH)]);
        step = cameFrom[step];
      }
      dirs.reverse();
      coords.reverse();
      return { dirs, coords };
    }

    const currX = curr % WIDTH;
    const currY = Math.floor(curr / WIDTH);

    for (let d = 0; d < 4; d++) {
      if (curr === startIdx && initialDir !== null && initialDir !== undefined) {
        if (isOpposite(d, initialDir)) {
          continue;
        }
      }

      const nx = (currX + deltas[d][0] + WIDTH) % WIDTH;
      const ny = (currY + deltas[d][1] + HEIGHT) % HEIGHT;
      const nextIdx = ny * WIDTH + nx;

      if (visited[nextIdx]) {
        continue;
      }

      if (nextIdx !== targetIdx) {
        if (isBlocked(nx, ny, extraObstacles, allowCellIndex)) {
          continue;
        }
      } else {
        const cell = getCell([nx, ny]);
        if (!cell || cell.classList.contains('border')) {
          continue;
        }
        if (extraObstacles && extraObstacles.has(nextIdx)) {
          continue;
        }
        if (allowCellIndex !== nextIdx && cell.classList.contains('snake')) {
          continue;
        }
      }

      visited[nextIdx] = 1;
      cameFrom[nextIdx] = curr;
      cameFromDir[nextIdx] = d;
      queue.push(nextIdx);
    }
  }

  return null;
}

/**
 * Checks whether following a path to an apple leaves the snake with a safe exit to its tail.
 * @param {!Snake} snake The snake instance.
 * @param {!{dirs: !Array<number>, coords: !Array<!Array<number>>}} path Path to apple.
 * @returns {boolean} True if following the path is safe.
 */
function isApplePathSafe(snake, path) {
  const K = path.coords.length;
  const L = snake.coordinates.length;

  let simulatedBody;
  if (K - 1 >= L) {
    simulatedBody = path.coords.slice(-(L + 1));
  } else {
    simulatedBody = snake.coordinates.slice(K - 1).concat(path.coords);
  }

  const newHead = simulatedBody.at(-1);
  const newTail = simulatedBody[0];
  const newTailIdx = newTail[1] * WIDTH + newTail[0];

  const simObstacles = new Set();
  for (let i = 1; i < simulatedBody.length; i++) {
    simObstacles.add(simulatedBody[i][1] * WIDTH + simulatedBody[i][0]);
  }

  // Include opponent snake's body as obstacles.
  for (let s = 0; s < snakes.length; s++) {
    if (snakes[s] !== snake) {
      for (const pt of snakes[s].coordinates) {
        simObstacles.add(pt[1] * WIDTH + pt[0]);
      }
    }
  }

  const pathToTail = findPath(newHead, newTail, path.dirs.at(-1), simObstacles, newTailIdx);
  return pathToTail !== null;
}

/**
 * Counts reachable free cells from a start position (flood fill).
 * @param {number} startX Start X coordinate.
 * @param {number} startY Start Y coordinate.
 * @param {?Set<number>} extraObstacles Extra obstacles.
 * @param {?number} allowCellIndex Cell index to treat as walkable.
 * @returns {number} Count of reachable cells.
 */
function countReachableCells(startX, startY, extraObstacles, allowCellIndex) {
  const startIdx = startY * WIDTH + startX;
  const totalCells = WIDTH * HEIGHT;
  const queue = [startIdx];
  let queueHead = 0;
  const visited = new Uint8Array(totalCells);
  visited[startIdx] = 1;

  while (queueHead < queue.length) {
    const curr = queue[queueHead++];
    const currX = curr % WIDTH;
    const currY = Math.floor(curr / WIDTH);

    for (let d = 0; d < 4; d++) {
      const nx = (currX + deltas[d][0] + WIDTH) % WIDTH;
      const ny = (currY + deltas[d][1] + HEIGHT) % HEIGHT;
      const nextIdx = ny * WIDTH + nx;

      if (visited[nextIdx]) {
        continue;
      }

      if (isBlocked(nx, ny, extraObstacles, allowCellIndex)) {
        continue;
      }

      visited[nextIdx] = 1;
      queue.push(nextIdx);
    }
  }

  return queue.length;
}

/**
 * Checks if a coordinate is adjacent to an opponent snake's head.
 * @param {number} x X coordinate.
 * @param {number} y Y coordinate.
 * @param {number} playerIndex Index of the current player.
 * @returns {boolean} True if adjacent to an opponent head.
 */
function isNearOpponentHead(x, y, playerIndex) {
  for (let i = 0; i < snakes.length; i++) {
    if (i === playerIndex) {
      continue;
    }
    const opp = snakes[i];
    if (!opp || !opp.coordinates || opp.coordinates.length === 0) {
      continue;
    }
    const oppHead = opp.coordinates.at(-1);
    for (let d = 0; d < 4; d++) {
      const hx = (oppHead[0] + deltas[d][0] + WIDTH) % WIDTH;
      const hy = (oppHead[1] + deltas[d][1] + HEIGHT) % HEIGHT;
      if (x === hx && y === hy) {
        return true;
      }
    }
  }
  return false;
}