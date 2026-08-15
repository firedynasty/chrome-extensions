const toggleBarBtn = document.getElementById('toggleBarBtn');
const status = document.getElementById('status');

chrome.storage.local.get('ytCtrlBarHidden', (data) => {
  toggleBarBtn.textContent = data.ytCtrlBarHidden ? 'Show Bar' : 'Hide Bar';
});

toggleBarBtn.addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab.url?.includes('youtube.com/watch')) {
    status.textContent = 'Not on a YouTube watch page';
    status.className = 'err';
    return;
  }
  // Ensure content script is injected
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
