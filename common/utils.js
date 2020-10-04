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
  var isLocal = location.protocol === 'file:';
  if (isLocal) {
    var links = document.getElementsByTagName('a');
    for (var i = 0, link; (link = links[i]); i++) {
      if (!link.href.startsWith('http') && link.href.endsWith('/')) {
        link.href += 'index.html';
      }
    }
  }
}

// Change the difficulty level.
function setDifficulty() {
  var difficultySelect = document.getElementById('difficulty');
  var value = difficultySelect.options[difficultySelect.selectedIndex].value;
  document.cookie = 'difficulty=' + value + '; SameSite=Strict';
  if (!document.cookie) {
    alert('Can\'t set cookie.\nKnown issue with Chrome on file:// URLs.');
  }
  location.reload();
}
