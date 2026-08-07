// YT Notes — toolbar icon click toggles notes mode on the active tab.
// No popup: the floating dialog in the page is all the UI there is.
chrome.action.onClicked.addListener(async (tab) => {
  if (!tab || !tab.id) return;
  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['inject.js']
    });
  } catch (e) {
    // chrome:// and other restricted pages can't be injected
    console.warn('YT Notes: cannot inject on this page', e);
  }
});
