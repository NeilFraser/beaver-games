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


// Difficulty level (0=Easy, 1=Normal, 2=Hard).
let difficultyLevel = NaN;

// The working grid (2-D array).  undefined cells are player slots.
let currentGrid = null;

// Bag slot descriptors: Array of { value, originalIndex } or null for a gap.
let bagSlots = [];

// Map from "r,c" → { value, bagSlotIndex } for numbers placed on the grid by
// the player (bagSlotIndex is the index in bagSlots that the chip came from).
let placedCells = new Map();

// History of grid cell keys where numbers were placed or moved.
let placementHistory = [];

// Number of mistakes accumulated this game.
let mistakes = 0;

// Set of "r,c" strings whose formula was most recently invalid (for counting
// new invalid formulas).
let lastInvalidFormulas = new Set();

// Whether the game is currently over (win or fail).
let gameOver = false;

// Currently selected chip for click-to-place mode.
// { type: 'bag'|'grid', key: bagSlotIndex|"r,c", element }
let selectedSource = null;

// Guard against interactions while an animation is in flight.
let animating = false;

// Count of sort operations, used to determine if the bag was resorted.
let sortCount = 0;

// Counter for dragenter/dragleave events on bagArea.
let bagAreaDragCount = 0;

// ── Init ──────────────────────────────────────────────────────────────────────

// On page load, initialize the event handlers and show the start button.
function init() {
  fixLinks();

  const m = document.cookie.match(/difficulty=([012])/);
  difficultyLevel = m ? Number(m[1]) : 0;
  document.getElementById('difficulty').selectedIndex = difficultyLevel;
  registerOptions('difficulty');

  document.getElementById('start').addEventListener('click', startGame);
  document.getElementById('undoBtn').addEventListener('click', doUndo);
  document.getElementById('resetBtn').addEventListener('click', doReset);
  document.getElementById('sortBtn').addEventListener('click', doSort);
  document.getElementById('restartBtn').addEventListener('click', startGame);

  setupBagAreaEvents();

  showStart();
}
window.addEventListener('load', init);

// Show the start button.
function showStart() {
  document.body.className = '';
  document.getElementById('start').style.display = '';
}

// Hide the start button, and start the game.
function startGame() {
  document.getElementById('start').style.display = 'none';
  document.getElementById('startDiv').style.display = 'none';
  document.body.className = '';

  // Reset state.
  placedCells = new Map();
  placementHistory = [];
  mistakes = 0;
  lastInvalidFormulas = new Set();
  gameOver = false;
  selectedSource = null;
  animating = false;
  sortCount = 0;
  bagAreaDragCount = 0;

  // Grid size scales with difficulty: 8 (Easy), 10 (Normal), 12 (Hard).
  const sizes = [8, 10, 12];
  const size = sizes[difficultyLevel] || 8;

  currentGrid = generateMathGrid(size);

  let bag;
  if (difficultyLevel === 0) {
    bag = easyFilter(currentGrid);
  } else if (difficultyLevel === 1) {
    bag = normalFilter(currentGrid);
  } else {
    bag = hardFilter(currentGrid);
  }

  // Build bagSlots (sorted bag already returned by filters).
  bagSlots = bag.map((value, i) => ({ value, originalIndex: i }));

  renderGrid();
  renderBag();
  updateUndoButton();
  updateMistakeCounter();

  document.getElementById('gameArea').style.display = 'block';
  document.getElementById('restartArea').style.display = 'none';
}

// End game, show start button.
function fail() {
  gameOver = true;
  clearSelection();
  document.body.className = 'shake game-over';
  document.querySelectorAll('.chip').forEach(chip => {
    chip.draggable = false;
  });
  document.getElementById('crash').play();
  document.getElementById('restartArea').style.display = '';
}

// ── Grid rendering ────────────────────────────────────────────────────────────

// Build the grid table from scratch.
function renderGrid() {
  const table = document.getElementById('gridTable');
  table.innerHTML = '';

  const rows = currentGrid.length;
  const cols = currentGrid[0] ? currentGrid[0].length : 0;

  for (let r = 0; r < rows; r++) {
    const tr = document.createElement('tr');
    for (let c = 0; c < cols; c++) {
      const td = document.createElement('td');
      const cell = currentGrid[r][c];
      const key = `${r},${c}`;

      if (cell === null) {
        td.className = 'cell-null';
      } else if (cell === undefined) {
        // Player slot.
        td.className = 'cell-slot';
        td.dataset.key = key;
        // If the player has already placed something here, render a chip.
        if (placedCells.has(key)) {
          const { value } = placedCells.get(key);
          td.appendChild(makeChip(value, 'grid', key));
        }
        setupSlotEvents(td);
      } else if (typeof cell === 'string') {
        td.className = 'cell-op';
        td.textContent = cell;
      } else {
        // Fixed number.
        td.className = 'cell-fixed';
        td.textContent = cell;
      }
      tr.appendChild(td);
    }
    table.appendChild(tr);
  }
}

// Update just the chip/slot cells without rebuilding the whole table.
// Faster than a full re-render; call after placement changes.
function refreshGridCell(key) {
  const td = document.querySelector(`#gridTable td[data-key="${key}"]`);
  if (!td) return;
  // Remove existing chip (if any).
  const old = td.querySelector('.chip');
  if (old) old.remove();
  if (placedCells.has(key)) {
    const { value } = placedCells.get(key);
    td.appendChild(makeChip(value, 'grid', key));
  }
  // Reapply invalid highlight.
  applyInvalidHighlights();
}

// ── Bag rendering ─────────────────────────────────────────────────────────────

function renderBag() {
  const bagDiv = document.getElementById('bag');
  bagDiv.innerHTML = '';

  for (let i = 0; i < bagSlots.length; i++) {
    const slot = bagSlots[i];
    const slotDiv = document.createElement('div');
    slotDiv.className = 'bag-slot';
    slotDiv.dataset.bagIndex = i;

    if (slot) {
      slotDiv.appendChild(makeChip(slot.value, 'bag', i));
    }
    bagDiv.appendChild(slotDiv);
  }
}

// Refresh a single bag slot without full re-render.
function refreshBagSlot(index) {
  const slotDiv = document.querySelector(
    `#bag .bag-slot[data-bag-index="${index}"]`
  );
  if (!slotDiv) {
    renderBag();
    return;
  }
  const old = slotDiv.querySelector('.chip');
  if (old) old.remove();
  const slot = bagSlots[index];
  if (slot) {
    slotDiv.appendChild(makeChip(slot.value, 'bag', index));
  }
}

// ── Chip creation ─────────────────────────────────────────────────────────────

/**
 * Create a draggable chip element.
 * @param {number} value  The number displayed.
 * @param {string} srcType  'bag' or 'grid'.
 * @param {number|string} srcKey  Bag index or "r,c".
 * @returns {HTMLElement}
 */
function makeChip(value, srcType, srcKey) {
  const chip = document.createElement('span');
  chip.className = 'chip';
  chip.textContent = value;
  chip.draggable = true;

  chip.addEventListener('dragstart', (e) => {
    if (gameOver || animating) { e.preventDefault(); return; }
    e.dataTransfer.setData('srcType', srcType);
    e.dataTransfer.setData('srcKey', String(srcKey));
    e.dataTransfer.setData('value', String(value));
    e.dataTransfer.effectAllowed = 'move';
    // Brief opacity during drag.
    chip.style.opacity = '0.5';
  });
  chip.addEventListener('dragend', () => {
    chip.style.opacity = '';
    bagAreaDragCount = 0;
    const bagArea = document.getElementById('bagArea');
    if (bagArea) {
      bagArea.classList.remove('drag-over');
    }
  });

  chip.addEventListener('click', (e) => {
    e.stopPropagation();
    if (gameOver || animating) return;
    handleChipClick(srcType, srcKey, value, chip);
  });

  return chip;
}

// ── Click-to-select mode ──────────────────────────────────────────────────────

function handleChipClick(srcType, srcKey, value, chipEl) {
  if (selectedSource) {
    // A source is already selected.  If clicking the same chip, deselect.
    if (selectedSource.type === srcType &&
        String(selectedSource.key) === String(srcKey)) {
      clearSelection();
      return;
    }
    // Otherwise treat the destination as the clicked chip's location.
    if (srcType === 'bag') {
      if (selectedSource.type === 'grid') {
        // Destination is bagArea: return selected grid chip to bag.
        returnGridChipToBag(selectedSource.key);
      } else {
        // Change selection to the clicked bag chip.
        clearSelection();
        selectedSource = { type: 'bag', key: Number(srcKey), value, element: chipEl };
        chipEl.classList.add('selected');
      }
    } else {
      executeMove(selectedSource, { type: 'grid', key: srcKey });
    }
  } else {
    // Select this chip.
    clearSelection();
    selectedSource = { type: srcType, key: srcType === 'bag' ? Number(srcKey) : srcKey, value, element: chipEl };
    chipEl.classList.add('selected');
  }
}

function clearSelection() {
  if (selectedSource && selectedSource.element) {
    selectedSource.element.classList.remove('selected');
  }
  selectedSource = null;
}

// ── Slot events (grid) ────────────────────────────────────────────────────────

function setupSlotEvents(td) {
  // Drag-over: highlight.
  td.addEventListener('dragover', (e) => {
    if (gameOver || animating) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    td.classList.add('drag-over');
  });
  td.addEventListener('dragleave', () => {
    td.classList.remove('drag-over');
  });
  td.addEventListener('drop', (e) => {
    if (gameOver || animating) return;
    e.preventDefault();
    td.classList.remove('drag-over');
    const srcType = e.dataTransfer.getData('srcType');
    const srcKey = e.dataTransfer.getData('srcKey');
    const destKey = td.dataset.key;
    const src = { type: srcType, key: srcType === 'bag' ? Number(srcKey) : srcKey };
    const dst = { type: 'grid', key: destKey };
    if (String(src.key) === String(dst.key) && src.type === dst.type) return;
    executeMove(src, dst);
  });

  // Click: destination for selected chip.
  td.addEventListener('click', () => {
    if (gameOver || animating) return;
    if (!selectedSource) return;
    const destKey = td.dataset.key;
    // If clicking on a slot that has a chip in it, handleChipClick takes over
    // (the chip's click event will fire first via stopPropagation); but if the
    // slot is empty we come here.
    if (placedCells.has(destKey)) return; // chip click handled it
    executeMove(selectedSource, { type: 'grid', key: destKey });
  });
}

// ── Bag area events ───────────────────────────────────────────────────────────

/**
 * Return a chip from the grid back to the bag.
 * The chip will appear in an existing gap, or at the end if there is no gap.
 * @param {string} gridKey  The "r,c" coordinates of the grid cell.
 */
function returnGridChipToBag(gridKey) {
  clearSelection();

  if (!placedCells.has(gridKey)) return;

  const placed = placedCells.get(gridKey);
  const bagSlotIndex = placed ? placed.bagSlotIndex : null;
  const chipSortCount = placed ? placed.sortCount : 0;

  let destIndex = -1;
  // If the bag hasn't been resorted since it was dragged out, and its original gap is still open:
  if (chipSortCount === sortCount &&
      bagSlotIndex !== null && bagSlotIndex !== undefined &&
      bagSlotIndex < bagSlots.length && bagSlots[bagSlotIndex] === null) {
    destIndex = bagSlotIndex;
  } else {
    // Otherwise find the first existing gap.
    destIndex = bagSlots.findIndex(slot => slot === null);
  }
  // If there is no gap, place at the end.
  if (destIndex === -1) {
    destIndex = bagSlots.length;
  }

  executeMove({ type: 'grid', key: gridKey }, { type: 'bag', key: destIndex });
}

function setupBagAreaEvents() {
  const bagArea = document.getElementById('bagArea');
  if (!bagArea) return;

  bagArea.addEventListener('dragenter', (e) => {
    if (gameOver || animating) return;
    bagAreaDragCount++;
    bagArea.classList.add('drag-over');
  });

  bagArea.addEventListener('dragleave', (e) => {
    bagAreaDragCount--;
    if (bagAreaDragCount <= 0) {
      bagAreaDragCount = 0;
      bagArea.classList.remove('drag-over');
    }
  });

  bagArea.addEventListener('dragover', (e) => {
    if (gameOver || animating) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  });

  bagArea.addEventListener('drop', (e) => {
    if (gameOver || animating) return;
    e.preventDefault();
    bagAreaDragCount = 0;
    bagArea.classList.remove('drag-over');

    const srcType = e.dataTransfer.getData('srcType');
    const srcKey = e.dataTransfer.getData('srcKey');

    if (srcType === 'grid') {
      returnGridChipToBag(srcKey);
    }
  });

  bagArea.addEventListener('click', (e) => {
    if (gameOver || animating) return;
    // Don't intercept button clicks in controls.
    if (e.target.closest('button')) return;

    if (selectedSource && selectedSource.type === 'grid') {
      returnGridChipToBag(selectedSource.key);
    }
  });
}

// ── Core move logic ───────────────────────────────────────────────────────────

/**
 * Execute a move from src → dst, handling swaps if the destination is occupied.
 * src/dst: { type: 'bag'|'grid', key: index|"r,c" }
 */
function executeMove(src, dst) {
  clearSelection();

  const srcValue = getOccupant(src);
  if (srcValue === null) return; // nothing to move

  const dstValue = getOccupant(dst);
  const isSwap = (dstValue !== null);

  if (isSwap) {
    // Can't swap grid→grid where destination is not a slot.
    if (dst.type === 'grid' && !isSlot(dst.key)) return;
    if (src.type === 'grid' && !isSlot(src.key)) return;
  }

  // Record placement history on the grid.
  if (dst.type === 'grid') {
    if (isSwap && src.type === 'grid') {
      placementHistory.push(src.key);
    }
    placementHistory.push(dst.key);
  }

  if (isSwap) {
    // Move srcValue to dst, dstValue back to src — with animation for displaced.
    removeOccupant(dst);
    removeOccupant(src);
    setOccupant(dst, srcValue, src);
    setOccupant(src, dstValue, dst);
    animateDisplaced(src, dstValue);
  } else {
    removeOccupant(src);
    setOccupant(dst, srcValue, src);
  }

  updateUndoButton();
  applyInvalidHighlights();
  checkWin();
}

/**
 * Returns the value of the occupant at a location, or null if empty.
 */
function getOccupant(loc) {
  if (loc.type === 'bag') {
    return bagSlots[loc.key] ? bagSlots[loc.key].value : null;
  } else {
    return placedCells.has(loc.key) ? placedCells.get(loc.key).value : null;
  }
}

/**
 * Remove the occupant from a location (without updating visuals yet for swap).
 */
function removeOccupant(loc) {
  if (loc.type === 'bag') {
    bagSlots[loc.key] = null;
    refreshBagSlot(loc.key);
  } else {
    placedCells.delete(loc.key);
    refreshGridCell(loc.key);
  }
}

/**
 * Place a value at dst. bagSlotHint is the original source (for recording
 * which bag slot a grid chip came from).
 */
function setOccupant(dst, value, srcHint) {
  if (dst.type === 'bag') {
    bagSlots[dst.key] = { value, originalIndex: dst.key };
    refreshBagSlot(dst.key);
  } else {
    // Determine which bag slot this chip originally came from.
    let bagSlotIndex = null;
    let chipSortCount = sortCount;
    if (srcHint.type === 'bag') {
      bagSlotIndex = srcHint.key;
      chipSortCount = sortCount;
    } else if (placedCells.has(srcHint.key)) {
      const p = placedCells.get(srcHint.key);
      bagSlotIndex = p.bagSlotIndex;
      chipSortCount = p.sortCount;
    }
    placedCells.set(dst.key, { value, bagSlotIndex, sortCount: chipSortCount });
    refreshGridCell(dst.key);
  }
}

/** Returns true if the grid cell at "r,c" is an undefined slot. */
function isSlot(key) {
  const [r, c] = key.split(',').map(Number);
  return currentGrid[r][c] === undefined;
}

// ── Animated displacement for swaps ──────────────────────────────────────────

/**
 * Briefly animate the displaced chip (which is now already at `targetLoc`).
 */
function animateDisplaced(targetLoc, value) {
  // Find the element now at targetLoc.
  let el;
  if (targetLoc.type === 'bag') {
    const slotDiv = document.querySelector(
      `#bag .bag-slot[data-bag-index="${targetLoc.key}"]`
    );
    el = slotDiv ? slotDiv.querySelector('.chip') : null;
  } else {
    const td = document.querySelector(
      `#gridTable td[data-key="${targetLoc.key}"]`
    );
    el = td ? td.querySelector('.chip') : null;
  }
  if (!el) return;

  // Simple pulse animation to indicate displacement.
  animating = true;
  el.style.transition = 'transform 0.15s ease';
  el.style.transform = 'scale(1.25)';
  setTimeout(() => {
    el.style.transform = '';
    setTimeout(() => {
      el.style.transition = '';
      animating = false;
    }, 150);
  }, 150);
}

// ── Undo ──────────────────────────────────────────────────────────────────────

function doUndo() {
  if (gameOver || animating || placedCells.size === 0) return;

  // Find the most recently placed/swapped number on the grid.
  let targetKey = null;
  while (placementHistory.length > 0) {
    const key = placementHistory.pop();
    if (placedCells.has(key)) {
      targetKey = key;
      break;
    }
  }

  // Fallback if history had no occupied cell: pick the last placed cell.
  if (!targetKey && placedCells.size > 0) {
    targetKey = Array.from(placedCells.keys()).pop();
  }

  if (targetKey) {
    returnGridChipToBag(targetKey);
  }
}

function updateUndoButton() {
  document.getElementById('undoBtn').disabled =
    (placedCells.size === 0 || gameOver);
}

// ── Reset ─────────────────────────────────────────────────────────────────────

function doReset() {
  if (gameOver) return;

  // Move all placed chips back to their original bag slots.
  for (const [key, { value, bagSlotIndex, sortCount: chipSortCount }] of placedCells) {
    if (chipSortCount === sortCount && bagSlotIndex !== null && bagSlotIndex !== undefined && !bagSlots[bagSlotIndex]) {
      bagSlots[bagSlotIndex] = { value, originalIndex: bagSlotIndex };
    } else {
      // Find a gap, or push.
      let placed = false;
      for (let i = 0; i < bagSlots.length; i++) {
        if (!bagSlots[i]) { bagSlots[i] = { value, originalIndex: i }; placed = true; break; }
      }
      if (!placed) bagSlots.push({ value, originalIndex: bagSlots.length });
    }
  }

  placedCells.clear();
  placementHistory = [];
  mistakes = 0;
  lastInvalidFormulas = new Set();
  gameOver = false;
  sortCount = 0;
  bagAreaDragCount = 0;
  document.body.className = '';

  renderGrid();
  renderBag();
  updateUndoButton();
  updateMistakeCounter();
  document.getElementById('restartArea').style.display = 'none';
}

// ── Sort bag ──────────────────────────────────────────────────────────────────

function doSort() {
  sortCount++;
  // Collect all remaining chips (non-null slots).
  const values = bagSlots.filter(s => s).map(s => s.value);
  values.sort((a, b) => a - b);
  bagSlots = values.map((v, i) => ({ value: v, originalIndex: i }));
  renderBag();
}

// ── Mistake counting & formula highlighting ───────────────────────────────────

/**
 * Extract all formula runs from the grid.
 * Returns Array of { cells: Array<{r,c}>, ops: string[] }
 */
function extractFormulas() {
  const rows = currentGrid.length;
  const cols = currentGrid[0] ? currentGrid[0].length : 0;
  const formulas = [];

  // Horizontal runs.
  for (let r = 0; r < rows; r++) {
    let run = [];
    for (let c = 0; c < cols; c++) {
      if (currentGrid[r][c] !== null) {
        run.push({ r, c });
      } else {
        if (run.length >= 5) formulas.push(run);
        run = [];
      }
    }
    if (run.length >= 5) formulas.push(run);
  }
  // Vertical runs.
  for (let c = 0; c < cols; c++) {
    let run = [];
    for (let r = 0; r < rows; r++) {
      if (currentGrid[r][c] !== null) {
        run.push({ r, c });
      } else {
        if (run.length >= 5) formulas.push(run);
        run = [];
      }
    }
    if (run.length >= 5) formulas.push(run);
  }
  return formulas;
}

/** Get the effective value of a cell (original or placed). */
function cellValue(r, c) {
  const cell = currentGrid[r][c];
  if (cell !== undefined) return cell;   // null, operator, or fixed number
  const key = `${r},${c}`;
  const p = placedCells.get(key);
  return p ? p.value : undefined;
}

/** Evaluate a formula run left-to-right. Returns true if valid. */
function formulaComplete(run) {
  const vals = run.map(({ r, c }) => cellValue(r, c));
  // Check all number positions are defined.
  for (let i = 0; i < vals.length; i += 2) {
    if (typeof vals[i] !== 'number') return null; // has unknowns
  }
  // Evaluate LHS op ... op N = result.
  const eqIdx = vals.lastIndexOf('=');
  if (eqIdx < 0) return null;
  const result = vals[eqIdx + 1];
  let acc = vals[0];
  for (let i = 1; i < eqIdx; i += 2) {
    const op = vals[i], rhs = vals[i + 1];
    if (op === '+') acc += rhs;
    else if (op === '-') acc -= rhs;
    else if (op === '*') acc *= rhs;
    else { if (rhs === 0 || acc % rhs !== 0) return false; acc /= rhs; }
  }
  return acc === result;
}

/**
 * Update red highlighting on invalid chips and increment mistake counter.
 */
function applyInvalidHighlights() {
  const formulas = extractFormulas();
  const nowInvalid = new Set();

  for (const run of formulas) {
    const result = formulaComplete(run);
    if (result === false) {
      // Complete but invalid — highlight placed chips in this formula.
      for (const { r, c } of run) {
        if (currentGrid[r][c] === undefined) {
          nowInvalid.add(`${r},${c}`);
        }
      }
    }
  }

  // Identify newly-invalid formulas for mistake counting.
  // We track formulas (by their first-cell key) not individual cells.
  const nowInvalidForms = new Set();
  for (const run of formulas) {
    if (formulaComplete(run) === false) {
      nowInvalidForms.add(`${run[0].r},${run[0].c}`);
    }
  }

  // Count newly-invalid formulas as mistakes (at most one mistake per placement).
  if (!gameOver) {
    let hasNewMistake = false;
    for (const fKey of nowInvalidForms) {
      if (!lastInvalidFormulas.has(fKey)) {
        hasNewMistake = true;
        break;
      }
    }
    if (hasNewMistake) {
      mistakes++;
    }
    lastInvalidFormulas = nowInvalidForms;
    updateMistakeCounter();

    if (mistakes >= 3) {
      fail();
      return;
    }
  }

  // Apply / remove red styling to chips.
  document.querySelectorAll('#gridTable .chip').forEach(chip => {
    const td = chip.closest('td');
    if (!td) return;
    const key = td.dataset.key;
    if (nowInvalid.has(key)) {
      chip.classList.add('invalid');
    } else {
      chip.classList.remove('invalid');
    }
  });
}

function updateMistakeCounter() {
  const el = document.getElementById('mistakeCounter');
  el.textContent = `Mistakes: ${mistakes} / 3`;
  el.className = mistakes > 0 ? 'has-mistakes' : '';
}

// ── Win detection ─────────────────────────────────────────────────────────────

function checkWin() {
  if (gameOver) return;

  // All undefined slots must be filled.
  const rows = currentGrid.length;
  const cols = currentGrid[0] ? currentGrid[0].length : 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (currentGrid[r][c] === undefined && !placedCells.has(`${r},${c}`)) {
        return; // still empty slots
      }
    }
  }

  // All formulas must be valid.
  const formulas = extractFormulas();
  for (const run of formulas) {
    if (formulaComplete(run) !== true) return;
  }

  // Win!
  gameOver = true;
  clearSelection();
  document.body.className = 'game-over';
  document.querySelectorAll('.chip').forEach(chip => {
    chip.draggable = false;
  });
  document.getElementById('win').play();
  document.getElementById('restartArea').style.display = '';
  updateUndoButton();
}
