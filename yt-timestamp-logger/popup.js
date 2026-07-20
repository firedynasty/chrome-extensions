const toggleBarBtn = document.getElementById('toggleBarBtn');
const stampBtn = document.getElementById('stampBtn');
const clearBtn = document.getElementById('clearBtn');
const saveBtn = document.getElementById('saveBtn');
const copyBtn = document.getElementById('copyBtn');
const noteInput = document.getElementById('noteInput');
const notesArea = document.getElementById('notesArea');
const entriesDiv = document.getElementById('entries');
const countDiv = document.getElementById('count');
const status = document.getElementById('status');

let entries = [];
let videoUrl = '';
let videoTitle = '';

// Set toggle button label from stored state
chrome.storage.local.get('tsBarHidden', (data) => {
  toggleBarBtn.textContent = data.tsBarHidden ? 'Show Bar' : 'Hide Bar';
});

toggleBarBtn.addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab.url?.includes('youtube.com/watch')) {
    status.textContent = 'Not on a YouTube watch page';
    status.className = 'error';
    return;
  }
  // Inject content script if it isn't already running
  try {
    await chrome.tabs.sendMessage(tab.id, { action: 'ping' });
  } catch {
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] });
  }
  try {
    const res = await chrome.tabs.sendMessage(tab.id, { action: 'toggleBar' });
    toggleBarBtn.textContent = res.hidden ? 'Show Bar' : 'Hide Bar';
    status.textContent = res.hidden ? 'Bar hidden' : 'Bar visible';
    status.className = 'success';
  } catch {
    status.textContent = 'Could not reach content script';
    status.className = 'error';
  }
});

// Restore saved state on popup open
chrome.storage.local.get(['tsEntries', 'tsVideoUrl', 'tsVideoTitle', 'tsNotes'], (data) => {
  if (data.tsEntries) entries = data.tsEntries;
  if (data.tsVideoUrl) videoUrl = data.tsVideoUrl;
  if (data.tsVideoTitle) videoTitle = data.tsVideoTitle;
  if (data.tsNotes) notesArea.value = data.tsNotes;
  renderEntries();
  if (entries.length) {
    status.textContent = `${entries.length} stamp${entries.length > 1 ? 's' : ''} restored`;
    status.className = 'success';
  }
});

function saveState() {
  chrome.storage.local.set({
    tsEntries: entries,
    tsVideoUrl: videoUrl,
    tsVideoTitle: videoTitle,
    tsNotes: notesArea.value
  });
}

// Auto-save notes on input
notesArea.addEventListener('input', saveState);

// Enter key stamps
noteInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') stampBtn.click();
});

// Focus the input on open
noteInput.focus();

async function inject(func) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func
    });
    return results[0]?.result;
  } catch (err) {
    status.textContent = 'Cannot inject on this page';
    status.className = 'error';
    return null;
  }
}

function getVideoInfo() {
  const video = document.querySelector('video');
  if (!video) return null;
  const currentTime = video.currentTime;
  const h = Math.floor(currentTime / 3600);
  const m = Math.floor((currentTime % 3600) / 60);
  const s = Math.floor(currentTime % 60);
  const ts = h > 0
    ? `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
    : `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  const title = document.querySelector('#title.ytd-watch-metadata h1')?.textContent?.trim() || '';
  return { ts, url: location.href, title };
}

stampBtn.addEventListener('click', async () => {
  const info = await inject(getVideoInfo);
  if (!info) {
    status.textContent = 'No video found on this page';
    status.className = 'error';
    return;
  }
  videoUrl = info.url;
  videoTitle = info.title;
  const note = noteInput.value.trim();
  entries.push({ ts: info.ts, note });
  noteInput.value = '';
  noteInput.focus();
  renderEntries();
  saveState();
  status.textContent = `Stamped ${info.ts}`;
  status.className = 'success';
});

clearBtn.addEventListener('click', () => {
  entries = [];
  videoUrl = '';
  videoTitle = '';
  notesArea.value = '';
  renderEntries();
  saveState();
  status.textContent = 'Cleared';
  status.className = 'success';
});

function renderEntries() {
  countDiv.textContent = entries.length ? `${entries.length} timestamp${entries.length > 1 ? 's' : ''}` : '';
  entriesDiv.innerHTML = entries.map(e => {
    const noteHtml = e.note ? `<span class="entry-note">— ${escHtml(e.note)}</span>` : '';
    return `<div class="entry"><span class="entry-ts">[${escHtml(e.ts)}]</span>${noteHtml}</div>`;
  }).join('');
  entriesDiv.scrollTop = entriesDiv.scrollHeight;
}

function escHtml(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function buildSaveTxt() {
  let out = entries.map(e => e.ts).join(',');
  out += '\n\n';
  if (videoUrl) out += videoUrl + '\n';
  if (videoTitle) out += videoTitle + '\n';
  const noted = entries.filter(e => e.note);
  const freeNotes = notesArea.value.trim();
  if (noted.length) {
    out += '\n';
    noted.forEach(e => { out += `[${e.ts}] ${e.note}\n`; });
  }
  if (freeNotes) {
    if (noted.length) out += '\n';
    out += freeNotes + '\n';
  }
  return out;
}

function buildFullText() {
  // Human-readable format with notes
  let out = videoUrl + '\n';
  if (videoTitle) out += videoTitle + '\n';
  out += '\n';
  entries.forEach(e => {
    out += `[${e.ts}]`;
    if (e.note) out += ` ${e.note}`;
    out += '\n';
  });
  const freeNotes = notesArea.value.trim();
  if (freeNotes) out += '\n' + freeNotes + '\n';
  return out;
}

saveBtn.addEventListener('click', () => {
  if (!entries.length) {
    status.textContent = 'Nothing to save';
    status.className = 'error';
    return;
  }
  const text = buildSaveTxt();
  const blob = new Blob([text], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const filename = videoTitle
    ? videoTitle.replace(/[^a-zA-Z0-9 _-]/g, '').replace(/\s+/g, '_').substring(0, 60) + '_timestamps.txt'
    : 'yt_timestamps.txt';
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
  status.textContent = 'Saved!';
  status.className = 'success';
});

copyBtn.addEventListener('click', () => {
  if (!entries.length) {
    status.textContent = 'Nothing to copy';
    status.className = 'error';
    return;
  }
  // Copy full readable format with notes
  const text = buildFullText();
  navigator.clipboard.writeText(text).then(() => {
    status.textContent = 'Copied to clipboard!';
    status.className = 'success';
  }).catch(() => {
    status.textContent = 'Copy failed';
    status.className = 'error';
  });
});
