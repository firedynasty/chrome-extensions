var txt = document.getElementById('txt');
var sl = document.getElementById('sl');
var tl = document.getElementById('tl');
var rowsEl = document.getElementById('rows');
var done = {};

var LANGS = [
  ['auto', 'Detect language'], ['yue', 'Cantonese'], ['zh-CN', 'Mandarin (Simplified)'],
  ['zh-TW', 'Mandarin (Traditional)'], ['en', 'English'], ['ja', 'Japanese'], ['ko', 'Korean'],
  ['es', 'Spanish'], ['fr', 'French'], ['de', 'German'], ['it', 'Italian'], ['pt', 'Portuguese'],
  ['ru', 'Russian'], ['ar', 'Arabic'], ['he', 'Hebrew'], ['hi', 'Hindi'], ['vi', 'Vietnamese'],
  ['th', 'Thai'], ['id', 'Indonesian'], ['tl', 'Filipino']
];

function setLang(sel, code) {
  if (!Array.prototype.some.call(sel.options, function (o) { return o.value === code; })) {
    sel.add(new Option(code, code));
  }
  sel.value = code;
}

[sl, tl].forEach(function (sel, i) {
  LANGS.forEach(function (l) {
    if (i === 1 && l[0] === 'auto') return;
    sel.add(new Option(l[1], l[0]));
  });
});
sl.value = 'auto';
tl.value = 'en';

function save() {
  try {
    localStorage.setItem('trState', JSON.stringify({ t: txt.value, sl: sl.value, tl: tl.value }));
  } catch (e) {}
}

// A pasted Google Translate URL supplies text + languages (as in the original script)
function parseInput() {
  var raw = txt.value.trim();
  var lines = [];
  if (/^https?:\/\/translate\.google\./.test(raw)) {
    try {
      var p = new URL(raw).searchParams;
      if (p.get('sl')) setLang(sl, p.get('sl'));
      if (p.get('tl')) setLang(tl, p.get('tl'));
      raw = p.get('text') || '';
    } catch (e) {}
  }
  raw.split('\n').forEach(function (l) {
    l = l.trim();
    if (l) lines.push(l);
  });
  return lines;
}

function translateUrl(line) {
  return 'https://translate.google.com/?sl=' + encodeURIComponent(sl.value || 'auto') +
    '&tl=' + encodeURIComponent(tl.value || 'en') +
    '&text=' + encodeURIComponent(line) + '&op=translate';
}

function render() {
  var lines = parseInput();
  rowsEl.textContent = '';
  lines.forEach(function (line, i) {
    var row = document.createElement('div');
    row.className = 'row' + (done[line] ? ' done' : '');
    var n = document.createElement('span');
    n.className = 'n';
    n.textContent = i + 1;
    var t = document.createElement('span');
    t.textContent = line;
    row.appendChild(n);
    row.appendChild(t);
    row.addEventListener('click', function (e) {
      done[line] = true;
      row.classList.add('done');
      chrome.tabs.create({ url: translateUrl(line), active: !(e.metaKey || e.ctrlKey) });
    });
    rowsEl.appendChild(row);
  });
  save();
}

txt.addEventListener('input', function () { done = {}; render(); });
sl.addEventListener('change', render);
tl.addEventListener('change', render);
document.getElementById('clear').addEventListener('click', function () {
  txt.value = '';
  done = {};
  render();
});
document.getElementById('paste').addEventListener('click', function () {
  navigator.clipboard.readText().then(function (s) {
    txt.value = s;
    done = {};
    render();
  }).catch(function () { txt.focus(); });
});

try {
  var s = JSON.parse(localStorage.getItem('trState') || 'null');
  if (s) { txt.value = s.t || ''; setLang(sl, s.sl || 'auto'); setLang(tl, s.tl || 'en'); }
} catch (e) {}
render();
