// Neuron Breath — service worker
// Toolbar icon toggles the injected overlay on the active tab.

chrome.action.onClicked.addListener(async (tab) => {
  if (!tab || !tab.id) return;
  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['inject.js'],
    });
  } catch (e) {
    console.warn('Neuron Breath: cannot inject on this page', e);
  }
});
