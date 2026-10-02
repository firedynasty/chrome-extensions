// Page Scroll Buttons — service worker
// Toolbar icon toggles the buttons on the active tab. The tab is remembered
// (chrome.storage.session) so the buttons are re-injected after each page load
// in that tab, e.g. biblegateway's next-chapter navigation. activeTab stays
// valid across same-origin navigations; a cross-origin hop silently fails.

const KEY = 'enabledTabs';

async function getEnabled() {
  const o = await chrome.storage.session.get(KEY);
  return o[KEY] || {};
}
async function setEnabled(map) {
  await chrome.storage.session.set({ [KEY]: map });
}

chrome.action.onClicked.addListener(async (tab) => {
  if (!tab || !tab.id) return;
  const map = await getEnabled();
  try {
    // inject.js toggles itself: injecting when buttons exist removes them.
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['inject.js'] });
    if (map[tab.id]) delete map[tab.id]; else map[tab.id] = true;
    await setEnabled(map);
  } catch (e) {
    console.warn('Page Scroll Buttons: cannot inject on this page', e);
  }
});

chrome.tabs.onUpdated.addListener(async (tabId, info) => {
  if (info.status !== 'complete') return;
  const map = await getEnabled();
  if (!map[tabId]) return;
  try {
    // Only inject if absent (SPA navigations keep the DOM; injecting again would toggle off).
    const [r] = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => !!window.__psb,
    });
    if (r && r.result) return;
    await chrome.scripting.executeScript({ target: { tabId }, files: ['inject.js'] });
  } catch (e) {
    console.warn('Page Scroll Buttons: re-inject failed', e);
  }
});

chrome.tabs.onRemoved.addListener(async (tabId) => {
  const map = await getEnabled();
  if (map[tabId]) { delete map[tabId]; await setEnabled(map); }
});
