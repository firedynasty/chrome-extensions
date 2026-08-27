/* Word Definer — popup script */
'use strict';

const DB_NAME    = 'word-definer-db';
const DB_VERSION = 1;
const CHUNK      = 10000;

// ── IndexedDB helpers ─────────────────────────────────────────────────────────

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = e => {
      const db = e.target.result;
      ['dict', 'archaic', 'meta'].forEach(name => {
        if (!db.objectStoreNames.contains(name)) db.createObjectStore(name);
      });
    };
    req.onsuccess = e => resolve(e.target.result);
    req.onerror   = e => reject(e.target.error);
  });
}

function idbGet(db, store, key) {
  return new Promise(resolve => {
    const req = db.transaction([store], 'readonly').objectStore(store).get(key);
    req.onsuccess = e => resolve(e.target.result ?? null);
    req.onerror   = ()  => resolve(null);
  });
}

function idbPut(db, store, key, value) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction([store], 'readwrite');
    tx.oncomplete = resolve;
    tx.onerror    = e => reject(e.target.error);
    tx.objectStore(store).put(value, key);
  });
}

function idbClear(db, store) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction([store], 'readwrite');
    tx.oncomplete = resolve;
    tx.onerror    = e => reject(e.target.error);
    tx.objectStore(store).clear();
  });
}

async function importChunk(db, store, pairs) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction([store], 'readwrite');
    tx.oncomplete = resolve;
    tx.onerror    = e => reject(e.target.error);
    const s = tx.objectStore(store);
    for (const [k, v] of pairs) s.put(v, k);
  });
}

// ── status flash ──────────────────────────────────────────────────────────────

let _flashTimer = null;
function flash(msg, color) {
  const el = document.getElementById('status-flash');
  el.textContent   = msg;
  el.style.color   = color;
  if (_flashTimer) clearTimeout(_flashTimer);
  _flashTimer = setTimeout(() => { el.textContent = ''; _flashTimer = null; }, 2200);
}

// ── toggle button ─────────────────────────────────────────────────────────────

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab || null;
}

async function isInjected(tabId) {
  try {
    const res = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => !!window.__wdf,
    });
    return !!(res && res[0] && res[0].result);
  } catch { return false; }
}

async function refreshToggleBtn() {
  const btn = document.getElementById('toggle-btn');
  const tab = await getActiveTab();
  if (!tab) { btn.disabled = true; return; }

  // Can't inject chrome:// or extension pages
  if (!tab.url || tab.url.startsWith('chrome') || tab.url.startsWith('chrome-extension')) {
    btn.disabled = true;
    btn.textContent = 'N/A';
    return;
  }

  const active = await isInjected(tab.id);
  btn.disabled    = false;
  btn.textContent = active ? 'Deactivate' : 'Activate';
  btn.className   = active ? 'active' : '';
}

document.getElementById('toggle-btn').addEventListener('click', async () => {
  const tab = await getActiveTab();
  if (!tab) return;
  try {
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['inject.js'] });
    await refreshToggleBtn();
    flash('Toggled', '#2ecc71');
  } catch (e) {
    flash('Cannot inject here', '#e74c3c');
  }
});

// ── dict status labels ────────────────────────────────────────────────────────

async function refreshDictStatus(db) {
  const dictCount    = await idbGet(db, 'meta', 'dict-count');
  const archaicCount = await idbGet(db, 'meta', 'archaic-count');

  const ds = document.getElementById('dict-status');
  if (dictCount != null) {
    ds.textContent  = `Loaded — ${Number(dictCount).toLocaleString()} words`;
    ds.className    = 'dict-status loaded';
  } else {
    ds.textContent  = 'Not loaded — using online API';
    ds.className    = 'dict-status';
  }

  const as = document.getElementById('archaic-status');
  if (archaicCount != null) {
    as.textContent  = `Loaded — ${Number(archaicCount).toLocaleString()} words`;
    as.className    = 'dict-status loaded';
  } else {
    as.textContent  = 'Not loaded';
    as.className    = 'dict-status';
  }
}

// ── file import ───────────────────────────────────────────────────────────────

async function importFile(file, store, metaKey, ids) {
  const { btn, statusEl, barEl, labelEl, warnEl, wrapEl } = ids;
  btn.disabled = true;

  statusEl.textContent = 'Parsing file…';
  statusEl.className   = 'dict-status';

  let data;
  try {
    data = JSON.parse(await file.text());
  } catch {
    statusEl.textContent = 'Error: could not parse JSON.';
    statusEl.className   = 'dict-status error';
    btn.disabled = false;
    return;
  }

  const entries = Object.entries(data);
  const total   = entries.length;
  statusEl.textContent = `Importing ${total.toLocaleString()} words…`;

  wrapEl.style.display = 'block';
  warnEl.style.display = 'block';

  try {
    const db = await openDB();
    await idbClear(db, store);

    for (let i = 0; i < total; i += CHUNK) {
      const chunk = entries.slice(i, i + CHUNK);
      await importChunk(db, store, chunk);
      const pct = Math.round(((i + chunk.length) / total) * 100);
      barEl.style.width    = pct + '%';
      labelEl.textContent  = `Importing… ${(i + chunk.length).toLocaleString()} / ${total.toLocaleString()}`;
      await new Promise(r => setTimeout(r, 0)); // yield to UI
    }

    await idbPut(db, 'meta', metaKey, total);

    wrapEl.style.display = 'none';
    warnEl.style.display = 'none';
    statusEl.textContent = `Loaded — ${total.toLocaleString()} words`;
    statusEl.className   = 'dict-status loaded';
    flash('Dictionary loaded!', '#2ecc71');
  } catch (e) {
    wrapEl.style.display = 'none';
    statusEl.textContent = 'Import failed: ' + e.message;
    statusEl.className   = 'dict-status error';
  }

  btn.disabled = false;
}

// ── wire up file pickers ──────────────────────────────────────────────────────

function wireFilePicker(btnId, fileId, store, metaKey, statusId, barId, labelId, warnId, wrapId) {
  const btn      = document.getElementById(btnId);
  const fileEl   = document.getElementById(fileId);
  const statusEl = document.getElementById(statusId);
  const barEl    = document.getElementById(barId);
  const labelEl  = document.getElementById(labelId);
  const warnEl   = document.getElementById(warnId);
  const wrapEl   = document.getElementById(wrapId);

  btn.addEventListener('click', () => fileEl.click());
  fileEl.addEventListener('change', e => {
    const f = e.target.files[0];
    if (!f) return;
    importFile(f, store, metaKey, { btn, statusEl, barEl, labelEl, warnEl, wrapEl });
  });
}

// ── init ──────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', async () => {
  const db = await openDB();
  await refreshDictStatus(db);
  await refreshToggleBtn();

  wireFilePicker(
    'dict-btn', 'dict-file', 'dict', 'dict-count',
    'dict-status', 'dict-bar', 'dict-label', 'dict-warn', 'dict-progress'
  );
  wireFilePicker(
    'archaic-btn', 'archaic-file', 'archaic', 'archaic-count',
    'archaic-status', 'archaic-bar', 'archaic-label', 'archaic-warn', 'archaic-progress'
  );
});
