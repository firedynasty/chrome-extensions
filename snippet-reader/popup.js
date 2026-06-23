document.getElementById('toggleBtn').addEventListener('click', async () => {
  const status = document.getElementById('status');
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: toggleSnippetPanel
    });
    status.textContent = 'Panel toggled!';
    status.className = 'success';
  } catch (err) {
    status.textContent = 'Cannot inject on this page';
    status.className = 'error';
  }
});

function toggleSnippetPanel() {
  const PANEL_ID = '__ext_snippet_reader_panel';
  const existing = document.getElementById(PANEL_ID);

  if (existing) {
    if (!existing.classList.contains('show')) {
      existing.classList.add('show');
    } else {
      // Stop any TTS before hiding
      speechSynthesis.cancel();
      existing.classList.remove('show');
    }
    return;
  }

  const STORAGE_KEY = 'saved-snippets';

  function loadSnippets() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; }
  }

  function saveSnippets(snippets) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(snippets));
  }

  // --- Inject styles ---
  const style = document.createElement('style');
  style.textContent = `
    #${PANEL_ID} {
      display: none;
      position: fixed;
      top: 0; right: 0;
      width: 400px;
      height: 100vh;
      z-index: 2147483647;
      background: rgba(20, 20, 35, 0.97);
      color: #e0e0e0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      box-shadow: -4px 0 20px rgba(0,0,0,0.5);
      overflow-y: auto;
      padding: 0;
      box-sizing: border-box;
    }
    #${PANEL_ID}.show { display: block; }
    #${PANEL_ID} .sr-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 12px 16px;
      background: rgba(102,126,234,0.15);
      border-bottom: 1px solid rgba(102,126,234,0.3);
      position: sticky; top: 0; z-index: 1;
    }
    #${PANEL_ID} .sr-header h3 {
      margin: 0; font-size: 14px; color: #667eea;
    }
    #${PANEL_ID} .sr-close {
      background: #f44336; border: none; color: #fff; border-radius: 4px;
      padding: 4px 10px; cursor: pointer; font-size: 13px; font-weight: 700;
    }
    #${PANEL_ID} .sr-input-area {
      padding: 12px 16px;
      border-bottom: 1px solid rgba(255,255,255,0.1);
    }
    #${PANEL_ID} .sr-input-area textarea {
      width: 100%; min-height: 80px; padding: 10px; font-size: 14px;
      background: #2a2a2a; color: #fff; border: 2px solid #667eea;
      border-radius: 8px; resize: vertical; box-sizing: border-box;
      font-family: Georgia, "Times New Roman", serif; line-height: 1.6;
    }
    #${PANEL_ID} .sr-btn-row {
      display: flex; gap: 6px; margin-top: 8px; flex-wrap: wrap;
    }
    #${PANEL_ID} .sr-btn {
      padding: 7px 14px; font-size: 12px; font-weight: 700; border: none;
      border-radius: 6px; cursor: pointer; color: #fff;
    }
    #${PANEL_ID} .sr-save { background: linear-gradient(135deg, #667eea, #764ba2); }
    #${PANEL_ID} .sr-paste-new { background: linear-gradient(45deg, #4338ca, #6366f1); }
    #${PANEL_ID} .sr-paste-append { background: linear-gradient(45deg, #92400e, #fbbf24); color: #333; }
    #${PANEL_ID} .sr-read { background: linear-gradient(135deg, #059669, #10b981); }
    #${PANEL_ID} .sr-read.speaking { background: linear-gradient(135deg, #ef4444, #dc2626); }
    #${PANEL_ID} .sr-clear { background: linear-gradient(45deg, #f44336, #c62828); }
    #${PANEL_ID} .sr-count {
      font-size: 11px; color: #888; padding: 8px 16px;
      display: flex; justify-content: space-between; align-items: center;
    }
    #${PANEL_ID} .sr-count .sr-clear-all {
      padding: 3px 8px; font-size: 11px; border: none; border-radius: 4px;
      background: #442222; color: #f87171; cursor: pointer; font-weight: 600;
    }
    #${PANEL_ID} .sr-list {
      padding: 4px 16px 16px;
    }
    #${PANEL_ID} .sr-item {
      background: rgba(255,255,255,0.06);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 8px;
      padding: 10px 12px;
      margin-bottom: 8px;
      cursor: pointer;
      transition: border-color 0.2s, background 0.2s;
      position: relative;
    }
    #${PANEL_ID} .sr-item:hover {
      border-color: #667eea;
      background: rgba(102,126,234,0.1);
    }
    #${PANEL_ID} .sr-item.reading {
      border-color: #10b981;
      background: rgba(16,185,129,0.1);
    }
    #${PANEL_ID} .sr-item-label {
      font-weight: 600; color: #a5b4fc; font-size: 13px;
      margin-bottom: 4px;
    }
    #${PANEL_ID} .sr-item.reading .sr-item-label {
      color: #10b981;
    }
    #${PANEL_ID} .sr-item-preview {
      font-size: 12px; color: #888; white-space: pre-wrap; word-break: break-word;
      line-height: 1.5;
    }
    #${PANEL_ID} .sr-item-actions {
      position: absolute; top: 8px; right: 8px;
      display: flex; gap: 4px;
    }
    #${PANEL_ID} .sr-item-actions button {
      background: rgba(255,255,255,0.1); border: none; color: #ccc;
      border-radius: 3px; padding: 2px 6px; cursor: pointer; font-size: 11px;
    }
    #${PANEL_ID} .sr-item-actions button:hover { background: rgba(255,255,255,0.2); }
    #${PANEL_ID} .sr-item-actions .sr-del:hover { background: #f44336; color: #fff; }
  `;
  document.head.appendChild(style);

  // Track which snippet is currently being read
  var currentReadingIdx = -1;

  // --- Build panel ---
  var panel = document.createElement('div');
  panel.id = PANEL_ID;
  panel.classList.add('show');
  panel.innerHTML =
    '<div class="sr-header">' +
      '<h3>Snippet Reader</h3>' +
      '<button class="sr-close" id="__sr_close">X</button>' +
    '</div>' +
    '<div class="sr-input-area">' +
      '<div class="sr-btn-row">' +
        '<button class="sr-btn sr-paste-new" id="__sr_paste_new">\ud83d\udccb Paste (New)</button>' +
        '<button class="sr-btn sr-paste-append" id="__sr_paste_append">\ud83d\udccb Paste (Append)</button>' +
      '</div>' +
      '<textarea id="__sr_input" placeholder="Type or paste text here to save as a snippet..."></textarea>' +
      '<div class="sr-btn-row">' +
        '<button class="sr-btn sr-save" id="__sr_save">Save Snippet</button>' +
        '<button class="sr-btn sr-read" id="__sr_read_input">\ud83d\udd0a Read Aloud</button>' +
      '</div>' +
    '</div>' +
    '<div id="__sr_count" class="sr-count"></div>' +
    '<div id="__sr_list" class="sr-list"></div>';
  document.body.appendChild(panel);

  function renderSnippets() {
    var list = document.getElementById('__sr_list');
    var countEl = document.getElementById('__sr_count');
    var snippets = loadSnippets();
    list.innerHTML = '';

    if (snippets.length === 0) {
      countEl.innerHTML = '';
      list.innerHTML = '<div style="color:#666;font-size:12px;text-align:center;padding:20px;">No snippets saved yet</div>';
      return;
    }

    countEl.innerHTML = '<span>' + snippets.length + ' snippet' + (snippets.length !== 1 ? 's' : '') + '</span>' +
      '<button class="sr-clear-all" id="__sr_clear_all">Clear All</button>';

    document.getElementById('__sr_clear_all').onclick = function() {
      if (confirm('Clear all saved snippets?')) {
        speechSynthesis.cancel();
        currentReadingIdx = -1;
        saveSnippets([]);
        renderSnippets();
      }
    };

    snippets.forEach(function(snippet, idx) {
      var div = document.createElement('div');
      div.className = 'sr-item';
      if (idx === currentReadingIdx) div.classList.add('reading');

      var label = document.createElement('div');
      label.className = 'sr-item-label';
      label.textContent = (idx === currentReadingIdx ? '\ud83d\udd0a ' : '') + snippet.label;
      div.appendChild(label);

      if (snippet.text.length > 60) {
        var preview = document.createElement('div');
        preview.className = 'sr-item-preview';
        preview.textContent = snippet.text.slice(0, 150) + (snippet.text.length > 150 ? '...' : '');
        div.appendChild(preview);
      }

      // Click to read aloud
      div.onclick = function(e) {
        if (e.target.closest('.sr-item-actions')) return;
        if (currentReadingIdx === idx) {
          // Stop reading this snippet
          speechSynthesis.cancel();
          currentReadingIdx = -1;
          renderSnippets();
          return;
        }
        speechSynthesis.cancel();
        var utterance = new SpeechSynthesisUtterance(snippet.text);
        currentReadingIdx = idx;
        renderSnippets();
        utterance.onend = function() { currentReadingIdx = -1; renderSnippets(); };
        utterance.onerror = function() { currentReadingIdx = -1; renderSnippets(); };
        speechSynthesis.speak(utterance);
      };

      // Actions
      var actions = document.createElement('div');
      actions.className = 'sr-item-actions';

      var delBtn = document.createElement('button');
      delBtn.className = 'sr-del';
      delBtn.textContent = '\u2715';
      delBtn.title = 'Delete snippet';
      delBtn.onclick = function(e) {
        e.stopPropagation();
        if (currentReadingIdx === idx) {
          speechSynthesis.cancel();
          currentReadingIdx = -1;
        } else if (currentReadingIdx > idx) {
          currentReadingIdx--;
        }
        var s = loadSnippets();
        s.splice(idx, 1);
        saveSnippets(s);
        renderSnippets();
      };
      actions.appendChild(delBtn);

      div.appendChild(actions);
      list.appendChild(div);
    });
  }

  // --- Events ---
  document.getElementById('__sr_close').onclick = function() {
    speechSynthesis.cancel();
    currentReadingIdx = -1;
    panel.classList.remove('show');
  };

  document.getElementById('__sr_paste_new').onclick = function() {
    navigator.clipboard.readText().then(function(text) {
      if (text) document.getElementById('__sr_input').value = text;
    }).catch(function(e) { console.error('Clipboard read failed', e); });
  };

  document.getElementById('__sr_paste_append').onclick = function() {
    navigator.clipboard.readText().then(function(text) {
      if (text) {
        var input = document.getElementById('__sr_input');
        input.value = input.value ? input.value + '\n' + text : text;
      }
    }).catch(function(e) { console.error('Clipboard read failed', e); });
  };

  document.getElementById('__sr_save').onclick = function() {
    var input = document.getElementById('__sr_input');
    var text = input.value.trim();
    if (!text) return;
    var snippets = loadSnippets();
    // Skip duplicates
    for (var i = 0; i < snippets.length; i++) {
      if (snippets[i].text === text) return;
    }
    var label = text.length > 60 ? text.slice(0, 60) + '...' : text;
    snippets.unshift({ text: text, label: label, savedAt: Date.now() });
    saveSnippets(snippets);
    input.value = '';
    renderSnippets();
  };

  // Read aloud from the input textarea (without saving)
  document.getElementById('__sr_read_input').onclick = function() {
    var btn = document.getElementById('__sr_read_input');
    if (btn.classList.contains('speaking')) {
      speechSynthesis.cancel();
      btn.classList.remove('speaking');
      btn.textContent = '\ud83d\udd0a Read Aloud';
      return;
    }
    var text = document.getElementById('__sr_input').value.trim();
    if (!text) return;
    var utterance = new SpeechSynthesisUtterance(text);
    btn.classList.add('speaking');
    btn.textContent = '\u23f9 Stop';
    utterance.onend = function() { btn.classList.remove('speaking'); btn.textContent = '\ud83d\udd0a Read Aloud'; };
    utterance.onerror = function() { btn.classList.remove('speaking'); btn.textContent = '\ud83d\udd0a Read Aloud'; };
    speechSynthesis.speak(utterance);
  };

  renderSnippets();
}
