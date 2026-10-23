(function () {
  var C = window.NIDT;
  var REPO = 'https://api.github.com/repos/' + C.owner + '/' + C.repo;
  var token = sessionStorage.getItem('nidt_token') || '';
  var $ = function (id) { return document.getElementById(id); };
  function show(id, on) { $(id).hidden = !on; }
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function fmtSize(b) {
    return b > 1048576 ? (b / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB';
  }
  function gh(method, url, body) {
    var o = { method: method, headers: { Accept: 'application/vnd.github+json', Authorization: 'Bearer ' + token } };
    if (body) { o.headers['Content-Type'] = 'application/json'; o.body = JSON.stringify(body); }
    return fetch(url, o).then(function (r) {
      if (r.status === 204) return {};
      return r.json().catch(function () { return {}; }).then(function (d) {
        if (!r.ok) { var e = new Error(d.message || 'Request failed'); e.status = r.status; throw e; }
        return d;
      });
    });
  }

  function showLogin() { show('panel', false); show('login', true); }
  function showPanel() { show('login', false); show('panel', true); loadList(); }

  function verify() {
    return gh('GET', REPO).then(function (r) {
      if (!r.permissions || !r.permissions.push) throw new Error('This token cannot write to the repository.');
    });
  }

  if (token) verify().then(showPanel).catch(function () { token = ''; sessionStorage.removeItem('nidt_token'); showLogin(); });
  else showLogin();

  $('loginForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var err = $('loginErr'); err.hidden = true;
    token = $('tok').value.trim();
    verify().then(function () {
      sessionStorage.setItem('nidt_token', token); $('tok').value = ''; showPanel();
    }).catch(function (ex) {
      token = '';
      err.textContent = ex.status === 401 ? 'Invalid token.' : ex.message;
      err.hidden = false;
    });
  });

  $('logout').addEventListener('click', function () {
    token = ''; sessionStorage.removeItem('nidt_token'); showLogin();
  });

  function loadList() {
    gh('GET', REPO + '/releases?per_page=100').then(function (rels) {
      var list = $('list'); list.textContent = '';
      var items = rels.filter(function (r) {
        return (r.assets || []).some(function (a) { return /\.apk$/i.test(a.name); });
      });
      $('count').textContent = items.length ? '(' + items.length + ')' : '';
      $('none').hidden = items.length > 0;
      items.forEach(function (r) {
        var asset = r.assets.filter(function (a) { return /\.apk$/i.test(a.name); })[0];
        var meta = {}; try { meta = JSON.parse(r.body || '{}'); } catch (x) { meta = null; }
        if (!meta || typeof meta !== 'object') meta = { version: r.tag_name || '' };
        var row = el('div', 'row');
        var info = el('div', 'info');
        info.appendChild(el('strong', null, r.name || asset.name));
        info.appendChild(el('span', null, 'v' + (meta.version || '?') + ' · ' + fmtSize(asset.size) + ' · ' + asset.download_count + ' downloads'));
        var del = el('button', 'btn btn-danger', 'Delete');
        del.type = 'button';
        del.addEventListener('click', function () {
          if (!confirm('Delete "' + (r.name || asset.name) + '"? The APK will be removed permanently.')) return;
          del.disabled = true;
          gh('DELETE', REPO + '/releases/' + r.id)
            .then(function () { return gh('DELETE', REPO + '/git/refs/tags/' + encodeURIComponent(r.tag_name)).catch(function () {}); })
            .then(loadList)
            .catch(function (ex) { del.disabled = false; alert(ex.message); });
        });
        row.appendChild(el('div', 'ico', (r.name || 'A').charAt(0).toUpperCase()));
        row.appendChild(info); row.appendChild(del);
        list.appendChild(row);
      });
    }).catch(function (ex) { if (ex.status === 401) showLogin(); });
  }

  function msg(text, cls) { var m = $('upMsg'); m.textContent = text; m.className = 'msg ' + (cls || ''); m.hidden = false; }
  function done() { show('prog', false); $('upBtn').disabled = false; }

  $('uploadForm').addEventListener('submit', function (e) {
    e.preventDefault();
    $('upMsg').hidden = true;
    var file = $('apk').files[0];
    if (!file) return;
    if (!/\.apk$/i.test(file.name)) return msg('Choose a .apk file.', 'err');
    $('upBtn').disabled = true; show('prog', true); $('bar').style.width = '0%';
    var safe = file.name.replace(/[^\w.\-]+/g, '_');
    var release;

    gh('POST', REPO + '/releases', {
      tag_name: 'app-' + Date.now(),
      name: $('name').value.trim(),
      body: JSON.stringify({ version: $('version').value.trim(), description: $('desc').value.trim() }),
      draft: false, prerelease: false
    }).then(function (r) {
      release = r;
      return new Promise(function (resolve, reject) {
        var xhr = new XMLHttpRequest();
        xhr.open('POST', r.upload_url.replace('{?name,label}', '') + '?name=' + encodeURIComponent(safe));
        xhr.setRequestHeader('Authorization', 'Bearer ' + token);
        xhr.setRequestHeader('Accept', 'application/vnd.github+json');
        xhr.setRequestHeader('Content-Type', 'application/vnd.android.package-archive');
        xhr.upload.onprogress = function (ev) {
          if (ev.lengthComputable) $('bar').style.width = Math.round(ev.loaded / ev.total * 100) + '%';
        };
        xhr.onload = function () { xhr.status < 300 ? resolve() : reject(new Error('Upload failed (' + xhr.status + ').')); };
        xhr.onerror = function () { reject(new Error('Upload was blocked or the connection dropped. Try Wi-Fi, or add the APK from the GitHub Releases page.')); };
        xhr.send(file);
      });
    }).then(function () {
      done(); msg('Uploaded. It is now live on the store.', 'ok');
      $('uploadForm').reset(); loadList();
    }).catch(function (ex) {
      done(); msg(ex.message, 'err');
      if (release) gh('DELETE', REPO + '/releases/' + release.id).catch(function () {});
    });
  });
})();
