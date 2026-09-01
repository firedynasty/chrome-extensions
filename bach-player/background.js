async function ensureOffscreen() {
  const contexts = await chrome.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT']
  });
  if (!contexts.length) {
    await chrome.offscreen.createDocument({
      url: 'offscreen.html',
      reasons: ['AUDIO_PLAYBACK'],
      justification: 'Persistent YouTube streaming and audio playback via IFrame API across tabs'
    });
    // Give the offscreen doc a moment to register its listener
    await new Promise(r => setTimeout(r, 200));
    const { bachPlaylists } = await chrome.storage.local.get('bachPlaylists');
    if (bachPlaylists) {
      chrome.runtime.sendMessage({ target: 'offscreen', type: 'loadPlaylists', playlists: bachPlaylists }).catch(() => {});
    }
  }
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  // Only handle messages from popup (no target field yet).
  // stateUpdate and beatsStep are broadcasts from offscreen → popup; leave them alone.
  if (msg.target === 'offscreen' || msg.type === 'stateUpdate' || msg.type === 'beatsStep') return;

  ensureOffscreen().then(() => {
    const forward = { ...msg, target: 'offscreen' };
    chrome.runtime.sendMessage(forward, (response) => {
      if (chrome.runtime.lastError) {
        sendResponse(null);
        return;
      }
      sendResponse(response);
    });
  });

  // Keep sendResponse channel open for async
  return true;
});
