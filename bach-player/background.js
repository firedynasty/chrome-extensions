async function ensureOffscreen() {
  const contexts = await chrome.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT']
  });
  if (!contexts.length) {
    await chrome.offscreen.createDocument({
      url: 'offscreen.html',
      reasons: ['AUDIO_PLAYBACK'],
      justification: 'Persistent Bach audio playback across tabs'
    });
    // Give the offscreen doc a moment to register its listener
    await new Promise(r => setTimeout(r, 100));
  }
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  // Only handle messages from popup (no target field yet).
  // stateUpdate and metBeat are broadcasts from offscreen → popup; leave them alone.
  if (msg.target === 'offscreen' || msg.type === 'stateUpdate' || msg.type === 'metBeat' || msg.type === 'beatsStep') return;

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
