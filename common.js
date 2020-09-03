function fixLinks() {
  var isLocal = location.protocol === 'file:';
  if (isLocal) {
    var links = document.getElementsByTagName('a');
    for (var i = 0, link; (link = links[i]); i++) {
      if (link.href.endsWith('/')) {
        link.href += 'index.html';
      }
    }
  }
}
