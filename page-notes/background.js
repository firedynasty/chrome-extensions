// Page Notes — service worker
// Toolbar icon toggles the note panel on the active tab.
// Also relays Google auth for inject.js: chrome.identity is only available in
// privileged extension contexts (this service worker, popup, options, side
// panel) — NOT in a content script like inject.js — so inject.js messages
// here to get/revoke a token instead of calling chrome.identity directly.

chrome.action.onClicked.addListener(async (tab) => {
  if (!tab || !tab.id) return;
  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['inject.js'],
    });
  } catch (e) {
    console.warn('Page Notes: cannot inject on this page', e);
  }
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg && msg.type === 'PGN_GET_TOKEN') {
    chrome.identity.getAuthToken({ interactive: !!msg.interactive }, (token) => {
      if (chrome.runtime.lastError || !token) {
        sendResponse({ error: (chrome.runtime.lastError && chrome.runtime.lastError.message) || 'no token' });
      } else {
        sendResponse({ token });
      }
    });
    return true; // keep the message channel open for the async sendResponse
  }

  if (msg && msg.type === 'PGN_SIGN_OUT') {
    chrome.identity.getAuthToken({ interactive: false }, (token) => {
      if (!token) { sendResponse({ ok: true }); return; }
      chrome.identity.removeCachedAuthToken({ token }, () => {
        fetch('https://oauth2.googleapis.com/revoke?token=' + token, { method: 'POST' })
          .catch(() => {})
          .finally(() => sendResponse({ ok: true }));
      });
    });
    return true;
  }
});
