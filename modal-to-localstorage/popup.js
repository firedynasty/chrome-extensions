document.getElementById('toggleBtn').addEventListener('click', async () => {
  const status = document.getElementById('status');
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: toggleNotesPanel
    });
    window.close();
  } catch (err) {
    status.textContent = 'Cannot inject on this page';
    status.className = 'error';
  }
});

// Auto-inject on popup open
document.getElementById('toggleBtn').click();

function toggleNotesPanel() {
  const PANEL_ID = '__ext_quick_notes_panel';
  const existing = document.getElementById(PANEL_ID);

  if (existing) {
    existing.classList.toggle('show');
    return;
  }

  // --- Storage: uses the same 'pmEntries' key as vercel_youtube Toggle modal ---
  const STORAGE_KEY = 'pmEntries';

  function loadEntries() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    } catch (e) {
      return [];
    }
  }

  function saveEntries(entries) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  }

  function extractVideoId(url) {
    var m = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|v\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
    return m ? m[1] : null;
  }

  // --- Inject styles ---
  const style = document.createElement('style');
  style.textContent = `
    #${PANEL_ID} {
      display: none;
      position: fixed;
      top: 0; right: 0;
      width: 380px;
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
    #${PANEL_ID} .qn-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 12px 16px;
      background: rgba(255,152,0,0.15);
      border-bottom: 1px solid rgba(255,152,0,0.3);
      position: sticky; top: 0; z-index: 1;
    }
    #${PANEL_ID} .qn-header h3 {
      margin: 0; font-size: 14px; color: #ff9800;
    }
    #${PANEL_ID} .qn-close {
      background: #f44336; border: none; color: #fff; border-radius: 4px;
      padding: 4px 10px; cursor: pointer; font-size: 13px; font-weight: 700;
    }
    #${PANEL_ID} .qn-input-area {
      padding: 12px 16px;
      border-bottom: 1px solid rgba(255,255,255,0.1);
    }
    #${PANEL_ID} .qn-input-area textarea {
      width: 100%; min-height: 70px; padding: 8px; font-size: 13px;
      background: #2a2a2a; color: #fff; border: 2px solid #ff9800;
      border-radius: 6px; resize: vertical; box-sizing: border-box;
      font-family: inherit;
    }
    #${PANEL_ID} .qn-hint {
      font-size: 11px; color: #888; margin-top: 4px;
    }
    #${PANEL_ID} .qn-btn-row {
      display: flex; gap: 6px; margin-top: 8px; flex-wrap: wrap;
    }
    #${PANEL_ID} .qn-btn {
      padding: 6px 14px; font-size: 12px; font-weight: 700; border: none;
      border-radius: 6px; cursor: pointer; color: #fff;
    }
    #${PANEL_ID} .qn-add { background: linear-gradient(45deg, #4CAF50, #388E3C); }
    #${PANEL_ID} .qn-paste { background: linear-gradient(45deg, #ff9800, #f57c00); }
    #${PANEL_ID} .qn-clear { background: linear-gradient(45deg, #f44336, #c62828); }
    #${PANEL_ID} .qn-copy-all { background: linear-gradient(45deg, #2196F3, #1565C0); }
    #${PANEL_ID} .qn-notes-list {
      padding: 8px 16px 16px;
    }
    #${PANEL_ID} .qn-note-item {
      background: rgba(255,255,255,0.06);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 6px;
      padding: 10px 12px;
      margin-bottom: 8px;
      position: relative;
      word-wrap: break-word;
      font-size: 13px;
      line-height: 1.5;
    }
    #${PANEL_ID} .qn-note-item a {
      color: #4fc3f7; text-decoration: underline;
    }
    #${PANEL_ID} .qn-note-title {
      font-weight: 600; color: #fff; margin-bottom: 2px;
    }
    #${PANEL_ID} .qn-note-url {
      font-size: 11px; color: #888; word-break: break-all;
    }
    #${PANEL_ID} .qn-note-actions {
      position: absolute; top: 6px; right: 6px;
      display: flex; gap: 4px;
    }
    #${PANEL_ID} .qn-note-actions button {
      background: rgba(255,255,255,0.1); border: none; color: #ccc;
      border-radius: 3px; padding: 2px 6px; cursor: pointer; font-size: 11px;
    }
    #${PANEL_ID} .qn-note-actions button:hover { background: rgba(255,255,255,0.2); }
    #${PANEL_ID} .qn-note-actions .qn-del:hover { background: #f44336; color: #fff; }
    #${PANEL_ID} .qn-note-actions .qn-edit:hover { background: #2196F3; color: #fff; }
    #${PANEL_ID} .qn-rename-input {
      width: 100%; padding: 4px 6px; font-size: 13px; font-weight: 600;
      background: #2a2a2a; color: #fff; border: 2px solid #2196F3;
      border-radius: 4px; box-sizing: border-box; font-family: inherit;
      display: none;
    }
    #${PANEL_ID} .qn-count {
      font-size: 11px; color: #888; padding: 4px 16px;
    }
  `;
  document.head.appendChild(style);

  // --- Build panel ---
  const panel = document.createElement('div');
  panel.id = PANEL_ID;
  panel.classList.add('show');
  panel.innerHTML = `
    <div class="qn-header">
      <h3>Modal-to-Notes (pmEntries)</h3>
      <button class="qn-close" id="__qn_close">X</button>
    </div>
    <div class="qn-input-area">
      <textarea id="__qn_input" placeholder="Paste YouTube URL(s) — one per line\nFormat: URL(title) or URL, title"></textarea>
      <div class="qn-hint">Same format as your Toggle modal — URL(title) or URL, title</div>
      <div class="qn-btn-row">
        <button class="qn-btn qn-add" id="__qn_add">Add</button>
        <button class="qn-btn qn-paste" id="__qn_paste">Clipboard</button>
        <button class="qn-btn qn-copy-all" id="__qn_copy_all">Copy All</button>
        <button class="qn-btn qn-clear" id="__qn_clear">Clear All</button>
      </div>
    </div>
    <div id="__qn_count" class="qn-count"></div>
    <div id="__qn_notes_list" class="qn-notes-list"></div>
  `;
  document.body.appendChild(panel);

  // --- Render ---
  function renderEntries() {
    const list = document.getElementById('__qn_notes_list');
    const countEl = document.getElementById('__qn_count');
    const entries = loadEntries();
    list.innerHTML = '';

    countEl.textContent = entries.length + ' entries in pmEntries';

    if (entries.length === 0) {
      list.innerHTML = '<div style="color:#666;font-size:12px;text-align:center;padding:20px;">No entries yet</div>';
      return;
    }

    entries.forEach(function(entry, idx) {
      const div = document.createElement('div');
      div.className = 'qn-note-item';

      const titleSpan = document.createElement('div');
      titleSpan.className = 'qn-note-title';
      titleSpan.textContent = entry.title || ('YouTube ' + entry.videoId);
      div.appendChild(titleSpan);

      const renameInput = document.createElement('input');
      renameInput.type = 'text';
      renameInput.className = 'qn-rename-input';
      div.appendChild(renameInput);

      const url = document.createElement('div');
      url.className = 'qn-note-url';
      const link = document.createElement('a');
      link.href = entry.url || ('https://www.youtube.com/watch?v=' + entry.videoId);
      link.target = '_blank';
      link.rel = 'noopener';
      link.textContent = entry.url || ('https://www.youtube.com/watch?v=' + entry.videoId);
      url.appendChild(link);
      div.appendChild(url);

      // Actions
      const actions = document.createElement('div');
      actions.className = 'qn-note-actions';

      const editBtn = document.createElement('button');
      editBtn.className = 'qn-edit';
      editBtn.textContent = 'Edit';
      editBtn.onclick = function() {
        titleSpan.style.display = 'none';
        renameInput.style.display = 'block';
        renameInput.value = entry.title || ('YouTube ' + entry.videoId);
        renameInput.focus();
        renameInput.select();
      };
      actions.appendChild(editBtn);

      function saveRename() {
        if (renameInput.style.display === 'none') return;
        const newName = renameInput.value.trim();
        if (newName) {
          const entries = loadEntries();
          entries[idx].title = newName;
          saveEntries(entries);
          titleSpan.textContent = newName;
        }
        renameInput.style.display = 'none';
        titleSpan.style.display = '';
      }

      renameInput.addEventListener('keydown', function(e) {
        e.stopPropagation();
        if (e.key === 'Enter') saveRename();
        if (e.key === 'Escape') {
          renameInput.style.display = 'none';
          titleSpan.style.display = '';
        }
      });
      renameInput.addEventListener('blur', saveRename);

      const copyBtn = document.createElement('button');
      copyBtn.textContent = 'Copy';
      copyBtn.onclick = function() {
        navigator.clipboard.writeText(entry.url || ('https://www.youtube.com/watch?v=' + entry.videoId));
        copyBtn.textContent = 'Copied';
        setTimeout(function() { copyBtn.textContent = 'Copy'; }, 1000);
      };
      actions.appendChild(copyBtn);

      const delBtn = document.createElement('button');
      delBtn.className = 'qn-del';
      delBtn.textContent = 'X';
      delBtn.onclick = function() {
        const entries = loadEntries();
        entries.splice(idx, 1);
        saveEntries(entries);
        renderEntries();
      };
      actions.appendChild(delBtn);

      div.appendChild(actions);
      list.appendChild(div);
    });
  }

  // --- Parse input (same logic as parsePmInput in vercel_youtube) ---
  function parseAndAdd(text) {
    const entries = loadEntries();
    const lines = text.split('\n').map(function(l) { return l.trim(); }).filter(function(l) { return l; });

    lines.forEach(function(line) {
      var title = '';
      var url = line;

      // Try URL(title) format
      var parenMatch = line.match(/^(https?:\/\/[^\s()]+)\(([^)]+)\)/);
      if (parenMatch) {
        url = parenMatch[1];
        title = parenMatch[2].trim();
      } else {
        // Try URL, title format
        var parts = line.split(',').map(function(p) { return p.trim(); });
        url = parts[0];
        if (parts.length > 1) title = parts.slice(1).join(', ');
      }

      var videoId = extractVideoId(url);
      if (!videoId) return;

      // Check duplicate
      for (var i = 0; i < entries.length; i++) {
        if (entries[i].videoId === videoId) return;
      }

      if (!title) title = 'YouTube ' + videoId;
      entries.push({ videoId: videoId, title: title, url: url });
    });

    saveEntries(entries);
    renderEntries();
  }

  // --- Events ---
  document.getElementById('__qn_close').onclick = function() {
    panel.classList.remove('show');
  };

  document.getElementById('__qn_add').onclick = function() {
    const input = document.getElementById('__qn_input');
    const text = input.value.trim();
    if (!text) return;
    parseAndAdd(text);
    input.value = '';
  };

  document.getElementById('__qn_paste').onclick = function() {
    navigator.clipboard.readText().then(function(text) {
      if (text.trim()) {
        document.getElementById('__qn_input').value = text;
      }
    });
  };

  document.getElementById('__qn_copy_all').onclick = function() {
    const entries = loadEntries();
    if (!entries.length) return;
    const text = entries.map(function(e) {
      return e.url + '(' + e.title + ')';
    }).join('\n');
    navigator.clipboard.writeText(text);
  };

  document.getElementById('__qn_clear').onclick = function() {
    if (confirm('Clear all pmEntries?')) {
      saveEntries([]);
      renderEntries();
    }
  };

  // Enter to add
  document.getElementById('__qn_input').addEventListener('keydown', function(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      document.getElementById('__qn_add').click();
    }
  });

  renderEntries();
}
