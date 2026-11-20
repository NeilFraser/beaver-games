/**
 * @license
 * Copyright 2020 Neil Fraser
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @fileoverview Common functions for Beaver Games.
 * @author root@neil.fraser.name (Neil Fraser)
 */
'use strict';


// If served raw from a file system (no web server), then convert all relative
// URLs that point at a naked directory to 'index.html' in that directory.
function fixLinks() {
  const isLocal = location.protocol === 'file:';
  if (isLocal) {
    const links = document.getElementsByTagName('a');
    for (const link of links) {
      if (!link.href.startsWith('http') && link.href.endsWith('/')) {
        link.href += 'index.html';
      }
    }
  }
}

// Names of dropdowns that configure the game.
const optionNames = [];

// Save the game options and reload.
function saveOptions() {
  for (const name of optionNames) {
    const dropdown = document.getElementById(name);
    if (dropdown.selectedIndex > -1) {
      const value = dropdown.options[dropdown.selectedIndex].value;
      document.cookie = name + '=' + value + '; SameSite=Strict';
    }
  }
  if (!document.cookie) {
    alert('Can\'t set cookie.\nKnown issue with Chrome on file:// URLs.');
  }
  location.reload();
}

// Set event handlers on the named game option dropdowns.
function registerOptions(...names) {
  for (const name of names) {
    optionNames.push(name);
    const dropdown = document.getElementById(name);
    dropdown.addEventListener('change', saveOptions);
  }
}
