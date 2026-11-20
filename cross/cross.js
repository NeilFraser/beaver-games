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

// Undo stack. Each entry: { fromType, fromKey, toType, toKey, value,
//   swappedValue, swappedFromType, swappedFromKey } where
//   fromType / toType are 'bag' or 'grid',
//   fromKey is a bagSlot index or "r,c",
//   swapped* describe the chip displaced by a swap (if any).
let undoStack = [];

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

  // Reset state.
  placedCells = new Map();
  undoStack = [];
  mistakes = 0;
  lastInvalidFormulas = new Set();
  gameOver = false;
  selectedSource = null;
  animating = false;

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
  document.body.className = 'shake';
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
    // Drag-over target for returning chips.
    setupBagSlotEvents(slotDiv);
    bagDiv.appendChild(slotDiv);
  }
}

// Refresh a single bag slot without full re-render.
function refreshBagSlot(index) {
  const slotDiv = document.querySelector(
    `#bag .bag-slot[data-bag-index="${index}"]`
  );
  if (!slotDiv) return;
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
    // Otherwise treat the destination as the clicked chip's location
    // (a swap: selected → this chip's slot).
    if (srcType === 'bag') {
      executeMove(selectedSource, { type: 'bag', key: Number(srcKey) });
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

// ── Slot events (bag) ─────────────────────────────────────────────────────────

function setupBagSlotEvents(slotDiv) {
  slotDiv.addEventListener('dragover', (e) => {
    if (gameOver || animating) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    slotDiv.classList.add('drag-over');
  });
  slotDiv.addEventListener('dragleave', () => {
    slotDiv.classList.remove('drag-over');
  });
  slotDiv.addEventListener('drop', (e) => {
    if (gameOver || animating) return;
    e.preventDefault();
    slotDiv.classList.remove('drag-over');
    const srcType = e.dataTransfer.getData('srcType');
    const srcKey = e.dataTransfer.getData('srcKey');
    const destIndex = Number(slotDiv.dataset.bagIndex);
    const src = { type: srcType, key: srcType === 'bag' ? Number(srcKey) : srcKey };
    const dst = { type: 'bag', key: destIndex };
    if (src.type === 'bag' && src.key === dst.key) return;
    executeMove(src, dst);
  });

  slotDiv.addEventListener('click', () => {
    if (gameOver || animating) return;
    if (!selectedSource) return;
    const destIndex = Number(slotDiv.dataset.bagIndex);
    // If the slot has a chip, its click handler fires first.
    if (bagSlots[destIndex]) return;
    executeMove(selectedSource, { type: 'bag', key: destIndex });
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

  // Build undo entry.
  const entry = {
    fromType: src.type,
    fromKey: src.key,
    toType: dst.type,
    toKey: dst.key,
    value: srcValue,
    swappedValue: isSwap ? dstValue : null,
    swappedFromType: isSwap ? dst.type : null,
    swappedFromKey: isSwap ? dst.key : null,
    swappedToType: isSwap ? src.type : null,
    swappedToKey: isSwap ? src.key : null,
  };
  undoStack.push(entry);

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
    if (srcHint.type === 'bag') {
      bagSlotIndex = srcHint.key;
    } else if (placedCells.has(srcHint.key)) {
      bagSlotIndex = placedCells.get(srcHint.key).bagSlotIndex;
    }
    placedCells.set(dst.key, { value, bagSlotIndex });
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
  if (gameOver || undoStack.length === 0) return;

  const entry = undoStack.pop();

  // Reverse: move from toKey back to fromKey.
  // If there was a swap, the displaced chip is at fromKey — move it back to
  // toKey (its original home), then move the main chip back to fromKey.
  if (entry.swappedValue !== null) {
    // Swap undo: main chip went fromKey→toKey, displaced chip went toKey→fromKey.
    // Reverse: remove both, then place each back where it started.
    removeOccupant({ type: entry.fromType, key: entry.fromKey });
    removeOccupant({ type: entry.toType, key: entry.toKey });
    // Restore main chip to fromKey.
    setOccupant(
      { type: entry.fromType, key: entry.fromKey },
      entry.value,
      { type: entry.toType, key: entry.toKey }
    );
    // Restore displaced chip to toKey (its original position before the swap).
    setOccupant(
      { type: entry.swappedFromType, key: entry.swappedFromKey },
      entry.swappedValue,
      { type: entry.swappedToType, key: entry.swappedToKey }
    );
  } else {
    // Simple move: return srcValue from toKey back to fromKey.
    removeOccupant({ type: entry.toType, key: entry.toKey });
    if (entry.fromType === 'bag') {
      bagSlots[entry.fromKey] = { value: entry.value, originalIndex: entry.fromKey };
      refreshBagSlot(entry.fromKey);
    } else {
      setOccupant(
        { type: entry.fromType, key: entry.fromKey },
        entry.value,
        { type: entry.toType, key: entry.toKey }
      );
    }
  }

  updateUndoButton();
  applyInvalidHighlights();
}

function updateUndoButton() {
  document.getElementById('undoBtn').disabled =
    (undoStack.length === 0 || gameOver);
}

// ── Reset ─────────────────────────────────────────────────────────────────────

function doReset() {
  if (gameOver) return;

  // Move all placed chips back to their original bag slots.
  for (const [key, { value, bagSlotIndex }] of placedCells) {
    if (bagSlotIndex !== null && bagSlotIndex !== undefined) {
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
  undoStack = [];
  mistakes = 0;
  lastInvalidFormulas = new Set();
  gameOver = false;
  document.body.className = '';

  renderGrid();
  renderBag();
  updateUndoButton();
  updateMistakeCounter();
  document.getElementById('restartArea').style.display = 'none';
}

// ── Sort bag ──────────────────────────────────────────────────────────────────

function doSort() {
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

  // Count newly-invalid formulas as mistakes.
  if (!gameOver) {
    for (const fKey of nowInvalidForms) {
      if (!lastInvalidFormulas.has(fKey)) {
        mistakes++;
      }
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
  document.getElementById('win').play();
  document.getElementById('restartArea').style.display = '';
  updateUndoButton();
}
