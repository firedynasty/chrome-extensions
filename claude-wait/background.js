// Claude Wait — service worker
// Toolbar icon toggles the injected Wait button on the active tab. The worker also does the
// fetch to the local claude_hooks_server (node server.js, 127.0.0.1:8787): host_permissions let it
// skip CORS and mixed-content rules that would block the same request from an https page.

const BASE = 'http://127.0.0.1:8787';

chrome.action.onClicked.addListener(async (tab) => {
  if (!tab || !tab.id) return;
  try {
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['inject.js'] });
  } catch (e) {
    console.warn('Claude Wait: cannot inject on this page', e);
  }
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || msg.type !== 'claudeWaitState') return;
  fetch(BASE + '/state', { cache: 'no-store' })
    .then((r) => r.json())
    .then((j) => sendResponse({ ok: true, state: j.state, project: j.project }))
    .catch(() => sendResponse({ ok: false }));
  return true;   // answer asynchronously
});
