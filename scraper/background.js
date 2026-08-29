// Dev.to Scraper — service worker
// Toolbar icon click injects the floating chip into the active tab.

chrome.action.onClicked.addListener(async (tab) => {
  if (!tab || !tab.id) return;
  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['inject.js'],
    });
  } catch (e) {
    console.warn('Dev.to Scraper: cannot inject on this page', e);
  }
});
