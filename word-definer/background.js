// Word Definer — service worker
// Handles DEFINE messages: checks local IndexedDB dict first, falls back to
// the online dictionaryapi.dev API if the word isn't found locally.

const DB_NAME    = 'word-definer-db';
const DB_VERSION = 1;

// ── IndexedDB ─────────────────────────────────────────────────────────────────

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

async function idbGet(store, key) {
  const db = await openDB();
  return new Promise(resolve => {
    const req = db.transaction([store], 'readonly').objectStore(store).get(key);
    req.onsuccess = e => resolve(e.target.result ?? null);
    req.onerror   = ()  => resolve(null);
  });
}

// ── Format conversion ─────────────────────────────────────────────────────────
// slim:  [{pos, senses:[{definition, tags}]}]
// api:   [{word, meanings:[{partOfSpeech, definitions:[{definition, tags}]}]}]

function slimToApi(word, entries) {
  return [{
    word,
    meanings: entries.map(e => ({
      partOfSpeech: e.pos,
      definitions:  (e.senses || []).map(s => ({
        definition: s.definition || '',
        tags:       s.tags || [],
      })),
      synonyms: [],
    })),
  }];
}

// ── Message handler ───────────────────────────────────────────────────────────

chrome.action.onClicked.addListener(async (tab) => {
  if (!tab || !tab.id) return;
  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['inject.js'],
      world: 'ISOLATED'   // gives inject.js access to chrome.runtime
    });
  } catch (e) {
    console.warn('Word Definer: cannot inject on this page', e);
  }
});

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type !== 'DEFINE') return false;

  const word = (msg.word || '').trim().toLowerCase();
  if (!word) { sendResponse({ ok: false, status: 400 }); return false; }

  (async () => {
    // 1. Check main dict
    let entries = await idbGet('dict', word);

    // 2. Fall back to archaic-only dict
    if (!entries) entries = await idbGet('archaic', word);

    // 3. Return local result if found
    if (entries) {
      sendResponse({ ok: true, data: slimToApi(word, entries) });
      return;
    }

    // 4. Fall back to online API
    try {
      const url = 'https://api.dictionaryapi.dev/api/v2/entries/en/' + encodeURIComponent(word);
      const r   = await fetch(url);
      if (!r.ok) { sendResponse({ ok: false, status: r.status }); return; }
      sendResponse({ ok: true, data: await r.json() });
    } catch (e) {
      sendResponse({ ok: false, error: e.message });
    }
  })();

  return true; // keep message channel open for async response
});
