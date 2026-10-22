(function () {
  var grid = document.getElementById('grid');
  var empty = document.getElementById('empty');
  var q = document.getElementById('q');
  var apps = [];
  document.getElementById('yr').textContent = new Date().getFullYear();

  function fmtSize(b) {
    if (b > 1073741824) return (b / 1073741824).toFixed(2) + ' GB';
    if (b > 1048576) return (b / 1048576).toFixed(1) + ' MB';
    return Math.max(1, Math.round(b / 1024)) + ' KB';
  }
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function parse(r) {
    var meta = {};
    try { meta = JSON.parse(r.body || '{}'); } catch (x) {}
    var asset = (r.assets || []).filter(function (a) { return /\.apk$/i.test(a.name); })[0];
    if (!asset || r.draft) return null;
    return {
      name: r.name || asset.name, version: meta.version || '', description: meta.description || '',
      size: asset.size, downloads: asset.download_count, url: asset.browser_download_url
    };
  }

  function render() {
    var term = q.value.trim().toLowerCase();
    var list = apps.filter(function (a) {
      return !term || (a.name + ' ' + a.description).toLowerCase().indexOf(term) !== -1;
    });
    grid.textContent = '';
    if (!list.length) {
      empty.hidden = false;
      empty.textContent = apps.length ? 'No apps match your search.' : 'No apps yet. New uploads will appear here.';
      return;
    }
    empty.hidden = true;
    list.forEach(function (a) {
      var card = el('article', 'card');
      var top = el('div', 'card-top');
      var head = el('div');
      head.appendChild(el('h3', null, a.name));
      if (a.version) head.appendChild(el('div', 'ver', 'Version ' + a.version));
      top.appendChild(el('div', 'ico', a.name.charAt(0).toUpperCase()));
      top.appendChild(head);
      card.appendChild(top);
      card.appendChild(el('p', 'desc', a.description));
      var meta = el('div', 'meta');
      meta.appendChild(el('span', null, fmtSize(a.size)));
      meta.appendChild(el('span', null, a.downloads + (a.downloads === 1 ? ' download' : ' downloads')));
      card.appendChild(meta);
      var btn = el('a', 'btn btn-primary', 'Download APK');
      btn.href = a.url;
      btn.rel = 'noopener';
      card.appendChild(btn);
      grid.appendChild(card);
    });
  }

  q.addEventListener('input', render);
  var c = window.NIDT;
  fetch('https://api.github.com/repos/' + c.owner + '/' + c.repo + '/releases?per_page=100', {
    headers: { Accept: 'application/vnd.github+json' }
  }).then(function (r) {
    if (!r.ok) throw new Error('bad');
    return r.json();
  }).then(function (d) {
    apps = d.map(parse).filter(Boolean);
    render();
  }).catch(function () {
    empty.hidden = false;
    empty.textContent = 'Could not load apps. Refresh the page in a minute.';
  });
})();
