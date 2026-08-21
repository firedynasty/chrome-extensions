const toggleBarBtn   = document.getElementById('toggleBarBtn');
const clearStampsBtn = document.getElementById('clearStampsBtn');
const stampInfo      = document.getElementById('stampInfo');
const status         = document.getElementById('status');

// ── helpers ──────────────────────────────────────────────────────────────────

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

function videoIdFromUrl(url) {
  try { return new URL(url).searchParams.get('v') || ''; } catch { return ''; }
}

// ── toggle bar ────────────────────────────────────────────────────────────────

chrome.storage.local.get('ytCtrlBarHidden', (data) => {
  toggleBarBtn.textContent = data.ytCtrlBarHidden ? 'Show Bar' : 'Hide Bar';
});

toggleBarBtn.addEventListener('click', async () => {
  const tab = await getActiveTab();
  if (!tab.url?.includes('youtube.com/watch')) {
    status.textContent = 'Not on a YouTube watch page';
    status.className = 'err';
    return;
  }
  try {
    await chrome.tabs.sendMessage(tab.id, { action: 'ping' });
  } catch {
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] });
  }
  try {
    const res = await chrome.tabs.sendMessage(tab.id, { action: 'toggleBar' });
    toggleBarBtn.textContent = res.hidden ? 'Show Bar' : 'Hide Bar';
    status.textContent = res.hidden ? 'Bar hidden' : 'Bar visible';
    status.className = 'ok';
  } catch {
    status.textContent = 'Could not reach content script';
    status.className = 'err';
  }
});

// ── stamp info ────────────────────────────────────────────────────────────────

async function loadStampInfo() {
  const tab = await getActiveTab();
  const vid = videoIdFromUrl(tab.url || '');
  if (!vid) { stampInfo.textContent = 'Not on a watch page'; return; }
  const key = 'ytCtrl_stamps_' + vid;
  chrome.storage.local.get(key, (data) => {
    const stamps = data[key] || [];
    stampInfo.textContent = stamps.length
      ? stamps.length + ' stamp' + (stamps.length > 1 ? 's' : '') + ' for this video'
      : 'No stamps yet';
  });
}

loadStampInfo();

// ── clear stamps ──────────────────────────────────────────────────────────────

clearStampsBtn.addEventListener('click', async () => {
  const tab = await getActiveTab();
  const vid = videoIdFromUrl(tab.url || '');
  if (!vid) { status.textContent = 'Not on a watch page'; status.className = 'err'; return; }
  const key = 'ytCtrl_stamps_' + vid;
  chrome.storage.local.remove(key, () => {
    stampInfo.textContent = 'No stamps yet';
    status.textContent = 'Stamps cleared';
    status.className = 'ok';
  });
});
