/**
 * @license
 * Copyright 2026 Neil Fraser
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @fileoverview Math crossword grid generator.
 * @author root@neil.fraser.name (Neil Fraser)
 */
'use strict';

/**
 * Generate a math crossword grid.
 *
 * The grid is populated with positive integers (≤ 120), the string symbols
 * '+', '-', '*', '/', '=', and null.  Horizontal (left→right) and vertical
 * (top→bottom) formulas of length 5 or 7 are placed so that:
 *   - Every formula contains at least one number ≤ 20.
 *   - Adjacent cells always belong to the same formula.
 *   - Intersections between H and V formulas land on number cells only.
 *   - All formulas are transitively connected.
 *   - Circular loops are possible (the structure allows them).
 *
 * Target constants (soft goals):
 *   RATIO_SHORT  = 0.9  → 90 % of formulas are length-5.
 *   RATIO_ADDSUB = 0.8  → 80 % of formulas use only + / -.
 *   FILL_TARGET  = 0.5  → 50 % of cells are non-null.
 *
 * @param {number} size  Grid dimension (expected to be roughly 8 to 16).
 * @returns {!Array<!Array<number|string|null>>}  size × size grid.
 */
function generateMathGrid(size) {
  // ── Constants ────────────────────────────────────────────────────────────
  const RATIO_SHORT  = 0.9;   // target fraction of length-5 formulas
  const RATIO_ADDSUB = 0.8;   // target fraction of add/sub formulas
  const FILL_TARGET  = 0.5;   // target fill fraction of non-null cells
  const MAX_ATTEMPTS = 300;   // top-level restarts before giving up
  const MAX_VALUE    = 120;   // maximum value of a number

  // ── Build formula catalogue (lazy, memoised across calls) ─────────────────
  if (!generateMathGrid._catalogues) {
    generateMathGrid._catalogues = buildCatalogues();
  }
  const { bins, byValue } = generateMathGrid._catalogues;
  // bins: { shortAddSub, shortMulDiv, longAddSub, longMulDiv }
  //   each is an array of formula arrays tagged with ._bin (0–3).
  // byValue: Map<number, Array<Array>> — all formulas containing that number.

  // ── Random helpers ────────────────────────────────────────────────────────
  function pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }
  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  // ── Catalogue builder ─────────────────────────────────────────────────────
  function buildCatalogues() {
    function evalLR(tokens) {
      let acc = tokens[0];
      for (let i = 1; i < tokens.length; i += 2) {
        const op = tokens[i], rhs = tokens[i + 1];
        if (op === '+') acc += rhs;
        else if (op === '-') acc -= rhs;
        else if (op === '*') acc *= rhs;
        else {
          if (rhs === 0 || acc % rhs !== 0) return null;
          acc /= rhs;
        }
      }
      return acc;
    }

    function valid(nums, result) {
      let hasSmall = false;
      for (const n of [...nums, result]) {
        // Must be an integer between 1 and MAX_VALUE.
        if (!Number.isInteger(result) || n <= 0 || n > MAX_VALUE) return false;
        // Discourage 1.
        if (n === 1 && Math.random() < 0.5) return false;
        // At least one number must be small.
        if (n <= 20) hasSmall = true;
      }
      return hasSmall;
    }

    // Four bins indexed 0–3: shortAddSub, shortMulDiv, longAddSub, longMulDiv
    const BIN_SHORT_AS = 0, BIN_SHORT_MD = 1, BIN_LONG_AS = 2, BIN_LONG_MD = 3;
    const shortAddSub = [], shortMulDiv = [], longAddSub = [], longMulDiv = [];
    const binArrays = [shortAddSub, shortMulDiv, longAddSub, longMulDiv];

    // byValue: Map<number, Array<formula>>
    // byValueBin[bin]: Map<number, Array<formula>> — same, restricted to bin
    const byValue = new Map();
    const byValueBin = [new Map(), new Map(), new Map(), new Map()];

    function addFormula(f, binId) {
      f._bin = binId;
      binArrays[binId].push(f);
      for (const tok of f) {
        if (typeof tok !== 'number') continue;
        if (!byValue.has(tok)) byValue.set(tok, []);
        byValue.get(tok).push(f);
        if (!byValueBin[binId].has(tok)) byValueBin[binId].set(tok, []);
        byValueBin[binId].get(tok).push(f);
      }
    }

    // ── Length-5: A op B = C ─────────────────────────────────────────────
    for (const op of ['+', '-', '*', '/']) {
      const addSub = op === '+' || op === '-';
      const binId  = addSub ? BIN_SHORT_AS : BIN_SHORT_MD;
      for (let a = 1; a <= MAX_VALUE; a++) {
        for (let b = 1; b <= MAX_VALUE; b++) {
          if (op === '-' && a < b) continue;
          if (op === '/' && (b === 0 || a % b !== 0)) continue;
          const c = evalLR([a, op, b]);
          if (c === null) continue;
          if (!valid([a, b], c)) continue;
          addFormula([a, op, b, '=', c], binId);
        }
      }
    }

    // ── Length-7: A op1 B op2 C = D (left-to-right) ─────────────────────
    // Operands A, B, C capped at 30 for fast build (still thousands of valid
    // formulas; results can still reach up to MAX_VALUE).
    const LONG_MAX = 30;
    for (const [op1, op2, binId] of [
      ['+', '+', BIN_LONG_AS], ['+', '-', BIN_LONG_AS],
      ['-', '+', BIN_LONG_AS], ['-', '-', BIN_LONG_AS],
      ['*', '*', BIN_LONG_MD], ['*', '/', BIN_LONG_MD],
      ['/', '*', BIN_LONG_MD], ['/', '/', BIN_LONG_MD],
    ]) {
      for (let a = 1; a <= LONG_MAX; a++) {
        for (let b = 1; b <= LONG_MAX; b++) {
          if (op1 === '-' && a < b) continue;
          if (op1 === '/' && (b === 0 || a % b !== 0)) continue;
          const ab = evalLR([a, op1, b]);
          if (ab === null || ab <= 0 || ab > MAX_VALUE) continue;
          for (let c = 1; c <= LONG_MAX; c++) {
            if (op2 === '-' && ab < c) continue;
            if (op2 === '/' && (c === 0 || ab % c !== 0)) continue;
            const d = evalLR([ab, op2, c]);
            if (d === null) continue;
            if (!valid([a, b, c], d)) continue;
            // Boring: 3 * 4 / 4 = 3
            if (new Set([a, b, c, d]).size < 3) continue;
            addFormula([a, op1, b, op2, c, '=', d], binId);
          }
        }
      }
    }

    return {
      bins: { shortAddSub, shortMulDiv, longAddSub, longMulDiv, byValueBin },
      byValue,
    };
  }

  // ── Formula selection ─────────────────────────────────────────────────────
  /**
   * Return a fresh copy of a formula chosen from the pool that matches
   * the ratio targets probabilistically.
   *
   * @param {?number} mustContain  If non-null, formula must contain this value.
   * @returns {!Array}
   */
  function chooseFormula(mustContain) {
    const BIN_SHORT_AS = 0, BIN_SHORT_MD = 1, BIN_LONG_AS = 2, BIN_LONG_MD = 3;
    const { shortAddSub, shortMulDiv, longAddSub, longMulDiv, byValueBin } = bins;
    const allBins = [shortAddSub, shortMulDiv, longAddSub, longMulDiv];

    // Roll independently for length (90% short) and operator type (80% add/sub).
    const wantShort = Math.random() < RATIO_SHORT;
    const wantAS    = Math.random() < RATIO_ADDSUB;

    const primaryBin = wantShort
      ? (wantAS ? BIN_SHORT_AS : BIN_SHORT_MD)
      : (wantAS ? BIN_LONG_AS  : BIN_LONG_MD);

    // Fallback order: try same length first, then other length.
    const binOrder = [
      primaryBin,
      wantShort ? (wantAS ? BIN_SHORT_MD : BIN_SHORT_AS) : (wantAS ? BIN_LONG_MD : BIN_LONG_AS),
      wantShort ? (wantAS ? BIN_LONG_AS  : BIN_LONG_MD)  : (wantAS ? BIN_SHORT_AS : BIN_SHORT_MD),
      wantShort ? (wantAS ? BIN_LONG_MD  : BIN_LONG_AS)  : (wantAS ? BIN_SHORT_MD : BIN_SHORT_AS)
    ];

    if (mustContain != null) {
      // Use per-bin byValue maps for O(1) lookup.
      for (const binId of binOrder) {
        const pool = byValueBin[binId].get(mustContain);
        if (pool && pool.length > 0) return [...pick(pool)];
      }
      // Fall back to global byValue (any bin).
      const pool = byValue.get(mustContain);
      if (pool && pool.length > 0) return [...pick(pool)];
      // No formula contains this value; fall through to unconstrained.
    }

    for (const binId of binOrder) {
      const pool = allBins[binId];
      if (pool.length > 0) return [...pick(pool)];
    }
    throw new Error('All formula pools are empty');
  }

  // ── Grid utilities ────────────────────────────────────────────────────────
  function emptyGrid() {
    return Array.from({ length: size }, () => Array(size).fill(null));
  }

  /**
   * Return cells covered by formula placed at (r,c) in direction dir,
   * or null if any cell is out of bounds.
   * @param {!Array}  formula
   * @param {number}  r
   * @param {number}  c
   * @param {string}  dir  'H' or 'V'
   * @returns {?Array<{r:number,c:number,value:*}>}
   */
  function formulaCells(formula, r, c, dir) {
    const cells = [];
    for (let i = 0; i < formula.length; i++) {
      const rr = dir === 'H' ? r     : r + i;
      const cc = dir === 'H' ? c + i : c;
      if (rr < 0 || rr >= size || cc < 0 || cc >= size) return null;
      cells.push({ r: rr, c: cc, value: formula[i] });
    }
    return cells;
  }

  /**
   * Check whether placing `formula` at (r,c,dir) is compatible with the grid.
   *
   * Rules:
   *  1. All cells in-bounds.
   *  2. Each cell is null OR holds the identical value.
   *  3. Intersections (pre-existing cells) must be on number cells only.
   *  4. Guard cells immediately before the start and after the end are null.
   *  5. Cells orthogonal to operator cells are null.
   *  6. Number cells already owned by the same direction cannot be reused.
   *
   * @param {!Array<!Array>}      grid
   * @param {!Array}              formula
   * @param {number}              r
   * @param {number}              c
   * @param {string}              dir     'H' or 'V'
   * @param {!Map<string,string>} cellDir  "r,c" → first direction that wrote it
   * @returns {boolean}
   */
  function canPlace(grid, formula, r, c, dir, cellDir) {
    const cells = formulaCells(formula, r, c, dir);
    if (!cells) return false;

    const len = formula.length;

    // Rule 4: guard before
    {
      const gr = dir === 'H' ? r     : r - 1;
      const gc = dir === 'H' ? c - 1 : c;
      if (gr >= 0 && gr < size && gc >= 0 && gc < size && grid[gr][gc] !== null)
        return false;
    }
    // Rule 4: guard after
    {
      const gr = dir === 'H' ? r     : r + len;
      const gc = dir === 'H' ? c + len : c;
      if (gr >= 0 && gr < size && gc >= 0 && gc < size && grid[gr][gc] !== null)
        return false;
    }

    for (let i = 0; i < cells.length; i++) {
      const { r: rr, c: cc, value } = cells[i];
      const existing = grid[rr][cc];
      const isNum    = typeof value === 'number';

      // Rule 2
      if (existing !== null && existing !== value) return false;
      // Rule 3
      if (existing !== null && !isNum) return false;

      if (isNum) {
        // Rule 6
        if (existing !== null && cellDir.get(`${rr},${cc}`) === dir) return false;
      } else {
        // Rule 5: orthogonal neighbours of operators must be null
        const ortho = dir === 'H' ? [[-1, 0], [1, 0]] : [[0, -1], [0, 1]];
        for (const [dr, dc] of ortho) {
          const nr = rr + dr, nc = cc + dc;
          if (nr >= 0 && nr < size && nc >= 0 && nc < size && grid[nr][nc] !== null)
            return false;
        }
      }
    }

    return true;
  }

  /**
   * Write a formula onto the grid in-place and update cellDir.
   */
  function placeFormula(grid, formula, r, c, dir, cellDir) {
    const cells = formulaCells(formula, r, c, dir);
    for (const { r: rr, c: cc, value } of cells) {
      grid[rr][cc] = value;
      const key = `${rr},${cc}`;
      if (!cellDir.has(key)) cellDir.set(key, dir);
    }
  }

  /**
   * BFS: all formulas in `placed` must be reachable from placed[0]
   * via shared cells.
   */
  function isConnected(placed) {
    if (placed.length <= 1) return true;

    const fKeys = placed.map(({ formula, r, c, dir }) => {
      const cells = formulaCells(formula, r, c, dir);
      return new Set(cells.map(({ r: rr, c: cc }) => `${rr},${cc}`));
    });

    const adj = Array.from({ length: placed.length }, () => []);
    for (let i = 0; i < placed.length; i++) {
      for (let j = i + 1; j < placed.length; j++) {
        for (const key of fKeys[i]) {
          if (fKeys[j].has(key)) { adj[i].push(j); adj[j].push(i); break; }
        }
      }
    }

    const visited = new Uint8Array(placed.length);
    visited[0] = 1;
    const queue = [0];
    for (let head = 0; head < queue.length; head++) {
      for (const nb of adj[queue[head]]) {
        if (!visited[nb]) { visited[nb] = 1; queue.push(nb); }
      }
    }
    return queue.length === placed.length;
  }

  // ── One generation attempt ────────────────────────────────────────────────
  function attempt() {
    const grid    = emptyGrid();
    const cellDir = new Map();
    const placed  = [];

    // Target formula count ~ size² × FILL_TARGET / 6 (avg formula length ≈ 6)
    const targetFormulas = Math.max(4, Math.round(size * size * FILL_TARGET / 6));

    // ── Place first formula freely ────────────────────────────────────────
    {
      const formula = chooseFormula(null);
      const len     = formula.length;
      const dir     = Math.random() < 0.5 ? 'H' : 'V';
      const maxR = dir === 'H' ? size - 1 : size - len;
      const maxC = dir === 'H' ? size - len : size - 1;
      const positions = [];
      for (let r = 0; r <= maxR; r++)
        for (let c = 0; c <= maxC; c++) positions.push([r, c]);
      shuffle(positions);

      let ok = false;
      for (const [r, c] of positions) {
        if (canPlace(grid, formula, r, c, dir, cellDir)) {
          placeFormula(grid, formula, r, c, dir, cellDir);
          placed.push({ formula, r, c, dir });
          ok = true;
          break;
        }
      }
      if (!ok) return null;
    }

    // ── Iteratively add formulas anchored to existing numbers ─────────────
    const MAX_FAILURES = 100;
    let failures = 0;

    while (placed.length < targetFormulas) {
      // Collect present numeric values on the grid.
      const presentValues = [];
      for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
          if (typeof grid[r][c] === 'number') presentValues.push(grid[r][c]);
        }
      }
      // Deduplicate and shuffle.
      const valueList = [...new Set(presentValues)];
      shuffle(valueList);

      // Alternate preferred direction H↔V to promote loop formation.
      const preferDir = placed[placed.length - 1].dir === 'H' ? 'V' : 'H';
      const dirs = [preferDir, preferDir === 'H' ? 'V' : 'H'];

      let success = false;

      tryValues:
      for (const anchorVal of valueList) {
        const formula = chooseFormula(anchorVal);
        const len     = formula.length;

        // Find positions in formula where the anchor value appears (even indices).
        const anchorIdxs = [];
        for (let i = 0; i < len; i += 2) {
          if (formula[i] === anchorVal) anchorIdxs.push(i);
        }
        if (anchorIdxs.length === 0) continue;

        // Find grid cells containing anchorVal.
        const anchorCells = [];
        for (let r = 0; r < size; r++) {
          for (let c = 0; c < size; c++) {
            if (grid[r][c] === anchorVal) anchorCells.push([r, c]);
          }
        }

        for (const dir of dirs) {
          shuffle(anchorCells);
          shuffle(anchorIdxs);
          for (const [er, ec] of anchorCells) {
            for (const ai of anchorIdxs) {
              const startR = dir === 'H' ? er : er - ai;
              const startC = dir === 'H' ? ec - ai : ec;
              if (canPlace(grid, formula, startR, startC, dir, cellDir)) {
                placeFormula(grid, formula, startR, startC, dir, cellDir);
                placed.push({ formula, r: startR, c: startC, dir });
                success = true;
                break tryValues;
              }
            }
          }
        }
      }

      if (!success) {
        if (++failures >= MAX_FAILURES) break;
      }
    }

    if (placed.length < 3 || !isConnected(placed)) return null;
    return grid;
  }

  // ── Run attempts ──────────────────────────────────────────────────────────
  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    const result = attempt();
    if (result) return shrinkGrid(result);
    console.log('Generation failed, retrying...')
  }
  throw new Error(
    `generateMathGrid: failed to generate a ${size}×${size} grid ` +
    `after ${MAX_ATTEMPTS} attempts.`
  );
}


/**
 * Returns a square grid with the original non-null content centered.
 * The input `grid` is a 2‑D array (rows × columns) that may contain
 * `null` values. Entire rows or columns that are all `null` are trimmed
 * from the outer edges. Then the smallest number of completely `null`
 * rows/columns are added on each side so the final grid is square.
 * If perfect centering is impossible the extra `null` row/column is
 * added on the *trailing* side (bottom or right).
 *
 * The function works in‑place if the original array can be safely
 * mutated; otherwise it returns a new array. For simplicity it returns
 * the new square grid.
 *
 * @param {Array<Array<any>>} grid Two‑dimensional array possibly
 * containing `null` values.
 * @returns {Array<Array<any>>} New square array with content centered.
 */
function shrinkGrid(grid) {
  // Helper to check if a row/col is all null.
  const isAllNull = arr => arr.every(cell => cell === null);

  // Determine bounds of rows containing non‑null values.
  let top = 0;
  let bottom = grid.length - 1;
  while (top <= bottom && isAllNull(grid[top])) top++;
  while (bottom >= top && isAllNull(grid[bottom])) bottom--;

  // Determine bounds of columns containing non‑null values.
  const colCount = grid[0] ? grid[0].length : 0;
  let left = 0;
  let right = colCount - 1;
  const columnIsAllNull = colIdx =>
    grid.slice(top, bottom + 1).every(row => row[colIdx] === null);
  while (left <= right && columnIsAllNull(left)) left++;
  while (right >= left && columnIsAllNull(right)) right--;

  // Extract the core content.
  const core = [];
  for (let r = top; r <= bottom; r++) {
    core.push(grid[r].slice(left, right + 1));
  }

  const coreRows = core.length;
  const coreCols = coreRows ? core[0].length : 0;
  const size = Math.max(coreRows, coreCols);

  // Compute padding needed on each side.
  const totalRowPad = size - coreRows;
  const totalColPad = size - coreCols;

  const topPad = Math.floor(totalRowPad / 2);
  const bottomPad = Math.ceil(totalRowPad / 2); // extra on trailing side
  const leftPad = Math.floor(totalColPad / 2);
  const rightPad = Math.ceil(totalColPad / 2); // extra on trailing side

  // Build the final square grid.
  const result = [];
  // top padding rows
  for (let i = 0; i < topPad; i++) {
    result.push(Array(size).fill(null));
  }
  // core rows with left/right padding
  for (const row of core) {
    const newRow = [];
    newRow.push(...Array(leftPad).fill(null));
    newRow.push(...row);
    newRow.push(...Array(rightPad).fill(null));
    result.push(newRow);
  }
  // bottom padding rows
  for (let i = 0; i < bottomPad; i++) {
    result.push(Array(size).fill(null));
  }

  return result;
}


/**
 * Filter the output of generateMathGrid by removing the maximum number of
 * integers, replacing them with undefined, and returning a bag of the removed
 * integers.  The resulting puzzle grid is guaranteed to have a single unique
 * valid solution using the bag of numbers.
 *
 * @param {!Array<!Array<number|string|null|undefined>>} grid  The math grid.
 * @returns {!Array<number>}  Bag of removed integers.
 */
function hardFilter(grid) {
  const rows = grid.length;
  const cols = grid[0] ? grid[0].length : 0;
  const formulas = [];

  // Extract horizontal formulas (length >= 2)
  for (let r = 0; r < rows; r++) {
    let run = [];
    for (let c = 0; c < cols; c++) {
      if (grid[r][c] !== null) {
        run.push({ r, c, val: grid[r][c] });
      } else {
        if (run.length >= 2) formulas.push(run);
        run = [];
      }
    }
    if (run.length >= 2) formulas.push(run);
  }

  // Extract vertical formulas (length >= 2)
  for (let c = 0; c < cols; c++) {
    let run = [];
    for (let r = 0; r < rows; r++) {
      if (grid[r][c] !== null) {
        run.push({ r, c, val: grid[r][c] });
      } else {
        if (run.length >= 2) formulas.push(run);
        run = [];
      }
    }
    if (run.length >= 2) formulas.push(run);
  }

  // Find all number cells
  const numberCells = [];
  const cellCoordMap = new Map();
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (typeof grid[r][c] === 'number') {
        const item = { r, c, val: grid[r][c] };
        numberCells.push(item);
        cellCoordMap.set(r + ',' + c, item);
      }
    }
  }

  if (numberCells.length === 0) {
    return [];
  }

  // Equation solver helpers
  function solveEq5(a, op, b, c) {
    if (c === null) {
      if (op === '+') return a + b;
      if (op === '-') return a - b;
      if (op === '*') return a * b;
      if (op === '/') return (b !== 0 && a % b === 0) ? a / b : null;
    } else if (b === null) {
      if (op === '+') return c - a;
      if (op === '-') return a - c;
      if (op === '*') return (a !== 0 && c % a === 0) ? c / a : null;
      if (op === '/') return (c !== 0 && a % c === 0) ? a / c : null;
    } else if (a === null) {
      if (op === '+') return c - b;
      if (op === '-') return c + b;
      if (op === '*') return (b !== 0 && c % b === 0) ? c / b : null;
      if (op === '/') return c * b;
    }
    return null;
  }

  function solveEq7(a, op1, b, op2, c, d) {
    if (d === null) {
      const x = solveEq5(a, op1, b, null);
      if (x === null || x <= 0) return null;
      const res = solveEq5(x, op2, c, null);
      return (res !== null && res > 0) ? res : null;
    } else if (c === null) {
      const x = solveEq5(a, op1, b, null);
      if (x === null || x <= 0) return null;
      const res = solveEq5(x, op2, null, d);
      return (res !== null && res > 0) ? res : null;
    } else if (a === null) {
      const x = solveEq5(null, op2, c, d);
      if (x === null || x <= 0) return null;
      const res = solveEq5(null, op1, b, x);
      return (res !== null && res > 0) ? res : null;
    } else if (b === null) {
      const x = solveEq5(null, op2, c, d);
      if (x === null || x <= 0) return null;
      const res = solveEq5(a, op1, null, x);
      return (res !== null && res > 0) ? res : null;
    }
    return null;
  }

  // Pre-structure formulas with cell references
  const formDefs = formulas.map(f => {
    if (f.length === 5) {
      return {
        len: 5,
        cells: [
          cellCoordMap.get(f[0].r + ',' + f[0].c),
          cellCoordMap.get(f[2].r + ',' + f[2].c),
          cellCoordMap.get(f[4].r + ',' + f[4].c)
        ],
        op1: f[1].val
      };
    } else {
      return {
        len: 7,
        cells: [
          cellCoordMap.get(f[0].r + ',' + f[0].c),
          cellCoordMap.get(f[2].r + ',' + f[2].c),
          cellCoordMap.get(f[4].r + ',' + f[4].c),
          cellCoordMap.get(f[6].r + ',' + f[6].c)
        ],
        op1: f[1].val,
        op2: f[3].val
      };
    }
  });

  // Solver: counts solutions up to 2 using unit propagation and backtracking
  function countSolutions(testGrid, bag) {
    const solverCells = numberCells.map(c => ({
      r: c.r,
      c: c.c,
      val: testGrid[c.r][c.c]
    }));
    const solverCellMap = new Map();
    for (const sc of solverCells) {
      solverCellMap.set(sc.r + ',' + sc.c, sc);
    }

    const solverFormulas = formDefs.map(fd => ({
      len: fd.len,
      cells: fd.cells.map(c => solverCellMap.get(c.r + ',' + c.c)),
      op1: fd.op1,
      op2: fd.op2
    }));

    const bagCounts = new Map();
    for (const n of bag) {
      bagCounts.set(n, (bagCounts.get(n) || 0) + 1);
    }

    let solutions = 0;

    function propagate() {
      let changed = true;
      const deduced = [];
      while (changed) {
        changed = false;
        for (const f of solverFormulas) {
          let unassignedIdx = -1;
          let unassignedCount = 0;
          const vals = f.cells.map((c, i) => {
            if (c.val === undefined) {
              unassignedIdx = i;
              unassignedCount++;
              return null;
            }
            return c.val;
          });

          if (unassignedCount === 0) {
            let valid = false;
            if (f.len === 5) {
              valid = solveEq5(vals[0], f.op1, vals[1], null) === vals[2];
            } else {
              valid = solveEq7(vals[0], f.op1, vals[1], f.op2, vals[2], null) === vals[3];
            }
            if (!valid) {
              for (const c of deduced) {
                bagCounts.set(c.val, bagCounts.get(c.val) + 1);
                c.val = undefined;
              }
              return false;
            }
          } else if (unassignedCount === 1) {
            let reqVal = null;
            if (f.len === 5) {
              reqVal = solveEq5(vals[0], f.op1, vals[1], vals[2]);
            } else {
              reqVal = solveEq7(vals[0], f.op1, vals[1], f.op2, vals[2], vals[3]);
            }
            if (reqVal === null || reqVal <= 0 || !Number.isInteger(reqVal)) {
              for (const c of deduced) {
                bagCounts.set(c.val, bagCounts.get(c.val) + 1);
                c.val = undefined;
              }
              return false;
            }
            const count = bagCounts.get(reqVal) || 0;
            if (count <= 0) {
              for (const c of deduced) {
                bagCounts.set(c.val, bagCounts.get(c.val) + 1);
                c.val = undefined;
              }
              return false;
            }
            const targetCell = f.cells[unassignedIdx];
            targetCell.val = reqVal;
            bagCounts.set(reqVal, count - 1);
            deduced.push(targetCell);
            changed = true;
          }
        }
      }
      return deduced;
    }

    function search() {
      if (solutions >= 2) return;

      const deduced = propagate();
      if (deduced === false) return;

      let bestCell = null;
      let minUnassignedInForm = 999;

      for (const f of solverFormulas) {
        const unassigned = f.cells.filter(c => c.val === undefined);
        if (unassigned.length > 0 && unassigned.length < minUnassignedInForm) {
          minUnassignedInForm = unassigned.length;
          bestCell = unassigned[0];
        }
      }

      if (!bestCell) {
        if (solverCells.every(c => c.val !== undefined)) solutions++;
      } else {
        const candidates = [];
        for (const [val, count] of bagCounts.entries()) {
          if (count > 0) candidates.push(val);
        }

        for (const val of candidates) {
          bestCell.val = val;
          bagCounts.set(val, bagCounts.get(val) - 1);
          search();
          bagCounts.set(val, bagCounts.get(val) + 1);
          bestCell.val = undefined;
          if (solutions >= 2) break;
        }
      }

      for (const c of deduced) {
        bagCounts.set(c.val, bagCounts.get(c.val) + 1);
        c.val = undefined;
      }
    }

    search();
    return solutions;
  }

  // Attempt reduction passes to maximize removed integers
  const numTrials = numberCells.length > 30 ? 1 : (numberCells.length > 15 ? 2 : 3);
  let bestGrid = null;
  let bestBag = null;

  for (let trial = 0; trial < numTrials; trial++) {
    const workGrid = grid.map(row => [...row]);
    const shuffledCells = [...numberCells];
    for (let i = shuffledCells.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffledCells[i], shuffledCells[j]] = [shuffledCells[j], shuffledCells[i]];
    }

    const currentBag = [];
    for (const cell of shuffledCells) {
      workGrid[cell.r][cell.c] = undefined;
      currentBag.push(cell.val);

      if (countSolutions(workGrid, currentBag) !== 1) {
        // Not unique; restore
        workGrid[cell.r][cell.c] = cell.val;
        currentBag.pop();
      }
    }

    if (!bestBag || currentBag.length > bestBag.length) {
      bestBag = currentBag;
      bestGrid = workGrid;
      if (bestBag.length === numberCells.length) break; // Maximum possible achieved
    }
  }

  // Mutate grid in-place to match the best filtered grid
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      grid[r][c] = bestGrid[r][c];
    }
  }

  bestBag.sort((a, b) => a - b);
  return bestBag;
}


/**
 * Filter the output of generateMathGrid by removing the maximum number of
 * integers, replacing them with undefined, and returning a bag of the removed
 * integers.  The resulting grid is structured so as to have at least one
 * formula that has exactly one unknown.  If that unknown were solved, then
 * the grid continues to always have at least one formula that has exactly
 * one unknown, until the entire grid is known.
 *
 * @param {!Array<!Array<number|string|null|undefined>>} grid  The math grid.
 * @returns {!Array<number>}  Bag of removed integers.
 */
function easyFilter(grid) {
  const rows = grid.length;
  const cols = grid[0] ? grid[0].length : 0;
  const formulas = [];

  // Extract horizontal formulas (length >= 2)
  for (let r = 0; r < rows; r++) {
    let run = [];
    for (let c = 0; c < cols; c++) {
      if (grid[r][c] !== null) {
        run.push({ r, c, val: grid[r][c] });
      } else {
        if (run.length >= 2) formulas.push(run);
        run = [];
      }
    }
    if (run.length >= 2) formulas.push(run);
  }

  // Extract vertical formulas (length >= 2)
  for (let c = 0; c < cols; c++) {
    let run = [];
    for (let r = 0; r < rows; r++) {
      if (grid[r][c] !== null) {
        run.push({ r, c, val: grid[r][c] });
      } else {
        if (run.length >= 2) formulas.push(run);
        run = [];
      }
    }
    if (run.length >= 2) formulas.push(run);
  }

  // Find all number cells
  const numberCells = [];
  const cellCoordMap = new Map();
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (typeof grid[r][c] === 'number') {
        const item = {
          r,
          c,
          val: grid[r][c],
          idx: numberCells.length,
          formIndices: []
        };
        numberCells.push(item);
        cellCoordMap.set(r + ',' + c, item);
      }
    }
  }

  if (numberCells.length === 0) {
    return [];
  }

  // Pre-structure formulas with indices of their number cells
  const formDefs = formulas.map((f, fIdx) => {
    const indices = f.length === 5 ? [0, 2, 4] : [0, 2, 4, 6];
    const cellIndices = indices.map(idx => {
      const cell = cellCoordMap.get(f[idx].r + ',' + f[idx].c);
      cell.formIndices.push(fIdx);
      return cell.idx;
    });
    return { cellIndices };
  });

  // Determines whether the current state of unknowns can be solved entirely
  // by iteratively solving formulas that have exactly one unknown.
  function isCascadeSolvable(testGrid) {
    const cellState = new Uint8Array(numberCells.length);
    let totalUndefined = 0;

    for (let i = 0; i < numberCells.length; i++) {
      const cell = numberCells[i];
      if (testGrid[cell.r][cell.c] === undefined) {
        cellState[i] = 1;
        totalUndefined++;
      }
    }

    if (totalUndefined === 0) return false;

    const unknownInForm = new Int32Array(formDefs.length);
    const queue = [];
    for (let fIdx = 0; fIdx < formDefs.length; fIdx++) {
      const f = formDefs[fIdx];
      let uCount = 0;
      for (const cIdx of f.cellIndices) {
        if (cellState[cIdx] === 1) uCount++;
      }
      unknownInForm[fIdx] = uCount;
      if (uCount === 1) {
        queue.push(fIdx);
      }
    }

    if (queue.length === 0) return false;

    let head = 0;
    let resolvedCount = 0;

    while (head < queue.length) {
      const fIdx = queue[head++];
      const f = formDefs[fIdx];

      let unknownCellIdx = -1;
      for (const cIdx of f.cellIndices) {
        if (cellState[cIdx] === 1) {
          unknownCellIdx = cIdx;
          break;
        }
      }

      if (unknownCellIdx === -1) {
        // Unknown was already solved via an intersecting formula
        continue;
      }

      // Mark this cell as resolved
      cellState[unknownCellIdx] = 0;
      resolvedCount++;

      // Update intersecting formulas
      const containingForms = numberCells[unknownCellIdx].formIndices;
      for (const otherFIdx of containingForms) {
        unknownInForm[otherFIdx]--;
        if (unknownInForm[otherFIdx] === 1) {
          queue.push(otherFIdx);
        }
      }
    }

    return resolvedCount === totalUndefined;
  }

  // Run multiple randomized trials to maximize the number of removed integers
  const numTrials = 30;
  let bestGrid = null;
  let bestBag = null;

  for (let trial = 0; trial < numTrials; trial++) {
    const workGrid = grid.map(row => [...row]);
    const shuffled = [...numberCells];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    const currentBag = [];
    for (const cell of shuffled) {
      workGrid[cell.r][cell.c] = undefined;
      if (isCascadeSolvable(workGrid)) {
        currentBag.push(cell.val);
      } else {
        workGrid[cell.r][cell.c] = cell.val;
      }
    }

    if (!bestBag || currentBag.length > bestBag.length) {
      bestBag = currentBag;
      bestGrid = workGrid;
    }
  }

  // Mutate grid in-place to the best filtered grid
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      grid[r][c] = bestGrid[r][c];
    }
  }

  bestBag.sort((a, b) => a - b);
  return bestBag;
}


/**
 * Filter the output of generateMathGrid for 'Normal' difficulty.
 * Removes fewer integers than hardFilter, but more integers than easyFilter,
 * while ensuring the puzzle retains a single unique valid solution.
 *
 * @param {!Array<!Array<number|string|null|undefined>>} grid  The math grid.
 * @returns {!Array<number>}  Bag of removed integers.
 */
function normalFilter(grid) {
  const originalGrid = grid.map(r => [...r]);

  // Run easyFilter and hardFilter on copies to determine baseline counts
  const gEasy = grid.map(r => [...r]);
  const gHard = grid.map(r => [...r]);

  const easyBag = easyFilter(gEasy);
  const hardBag = hardFilter(gHard);

  const E = easyBag.length;
  const H = hardBag.length;

  if (H <= E + 1) {
    // If there is no integer strictly between E and H, match gHard
    for (let r = 0; r < grid.length; r++) {
      for (let c = 0; c < grid[0].length; c++) {
        grid[r][c] = gHard[r][c];
      }
    }
    return hardBag;
  }

  // Target count of integers to remove: strictly between E and H
  const targetK = Math.min(H - 1, Math.max(E + 1, Math.round((E + H) / 2)));
  const numToRestore = H - targetK;

  // Find all cells that are undefined in gHard
  const undefinedCells = [];
  for (let r = 0; r < grid.length; r++) {
    for (let c = 0; c < grid[0].length; c++) {
      if (gHard[r][c] === undefined) {
        undefinedCells.push({ r, c, val: originalGrid[r][c] });
      }
    }
  }

  // Shuffle candidate cells to restore
  for (let i = undefinedCells.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [undefinedCells[i], undefinedCells[j]] = [undefinedCells[j], undefinedCells[i]];
  }

  // Extract horizontal & vertical formulas from gHard
  const rows = gHard.length;
  const cols = gHard[0] ? gHard[0].length : 0;
  const rawFormulas = [];
  for (let r = 0; r < rows; r++) {
    let run = [];
    for (let c = 0; c < cols; c++) {
      if (gHard[r][c] !== null) {
        run.push({ r, c });
      } else {
        if (run.length >= 2) rawFormulas.push(run);
        run = [];
      }
    }
    if (run.length >= 2) rawFormulas.push(run);
  }
  for (let c = 0; c < cols; c++) {
    let run = [];
    for (let r = 0; r < rows; r++) {
      if (gHard[r][c] !== null) {
        run.push({ r, c });
      } else {
        if (run.length >= 2) rawFormulas.push(run);
        run = [];
      }
    }
    if (run.length >= 2) rawFormulas.push(run);
  }

  let restoredCount = 0;
  const restoredSet = new Set();

  // Prioritize giving formulas with 2 or more unknowns a restored clue.
  // Avoid completing a formula.
  for (const f of rawFormulas) {
    if (restoredCount >= numToRestore) break;
    const numIdxs = f.length === 5 ? [0, 2, 4] : [0, 2, 4, 6];
    const uCells = numIdxs.filter(idx => (
      gHard[f[idx].r][f[idx].c] === undefined &&
      !restoredSet.has(f[idx].r + ',' + f[idx].c)
    ));
    if (uCells.length >= 2) {
      const chosen = f[uCells[0]];
      const key = chosen.r + ',' + chosen.c;
      restoredSet.add(key);
      gHard[chosen.r][chosen.c] = originalGrid[chosen.r][chosen.c];
      restoredCount++;
    }
  }

  // Apply final grid state in-place and collect bag
  const bag = [];
  for (let r = 0; r < grid.length; r++) {
    for (let c = 0; c < grid[0].length; c++) {
      grid[r][c] = gHard[r][c];
      if (grid[r][c] === undefined) {
        bag.push(originalGrid[r][c]);
      }
    }
  }

  bag.sort((a, b) => a - b);
  return bag;
}
