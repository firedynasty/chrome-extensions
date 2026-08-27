// Copy Text Tooltip — service worker
// Toolbar icon toggles the injected selection tooltip on the active tab.

chrome.action.onClicked.addListener(async (tab) => {
  if (!tab || !tab.id) return;
  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['inject.js'],
    });
  } catch (e) {
    console.warn('Copy Text Tooltip: cannot inject on this page', e);
  }
});
