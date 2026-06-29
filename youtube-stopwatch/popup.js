const startBtn = document.getElementById('startBtn');
const resetBtn = document.getElementById('resetBtn');
const removeBtn = document.getElementById('removeBtn');
const status = document.getElementById('status');

async function inject(func) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func
    });
    return results[0]?.result;
  } catch (err) {
    status.textContent = 'Cannot inject on this page';
    status.className = 'error';
    return null;
  }
}

startBtn.addEventListener('click', async () => {
  const result = await inject(toggleStopwatch);
  if (result === 'no-title') {
    status.textContent = 'No YouTube title found';
    status.className = 'error';
  } else if (result === 'started') {
    status.textContent = 'Running';
    status.className = 'success';
  } else if (result === 'paused') {
    status.textContent = 'Paused';
    status.className = 'success';
  }
});

resetBtn.addEventListener('click', async () => {
  const result = await inject(resetStopwatch);
  if (result === 'reset') {
    status.textContent = 'Reset';
    status.className = 'success';
  }
});

removeBtn.addEventListener('click', async () => {
  const result = await inject(removeStopwatch);
  if (result === 'removed') {
    status.textContent = 'Removed';
    status.className = 'success';
  }
});

function toggleStopwatch() {
  const SW_ID = '__ext_stopwatch';
  const titleContainer = document.querySelector('#title.ytd-watch-metadata h1');
  if (!titleContainer) return 'no-title';

  let sw = document.getElementById(SW_ID);

  // Create stopwatch element if it doesn't exist
  if (!sw) {
    sw = document.createElement('span');
    sw.id = SW_ID;
    sw.style.cssText = `
      display: inline-block;
      margin-left: 12px;
      padding: 4px 10px;
      background: #0f0f0f;
      border: 1px solid #3ea6ff;
      border-radius: 4px;
      color: #3ea6ff;
      font-size: 14px;
      font-family: 'Courier New', monospace;
      font-weight: bold;
      vertical-align: middle;
      letter-spacing: 1px;
    `;
    sw.textContent = '00:00:00';
    sw.__elapsed = 0;
    sw.__running = false;
    titleContainer.appendChild(sw);
  }

  // Toggle running state
  if (sw.__running) {
    clearInterval(sw.__intervalId);
    sw.__running = false;
    sw.style.borderColor = '#f39c12';
    sw.style.color = '#f39c12';
    return 'paused';
  } else {
    sw.__lastTick = Date.now();
    sw.__intervalId = setInterval(() => {
      const now = Date.now();
      sw.__elapsed += now - sw.__lastTick;
      sw.__lastTick = now;
      const totalSecs = Math.floor(sw.__elapsed / 1000);
      const hrs = String(Math.floor(totalSecs / 3600)).padStart(2, '0');
      const mins = String(Math.floor((totalSecs % 3600) / 60)).padStart(2, '0');
      const secs = String(totalSecs % 60).padStart(2, '0');
      sw.textContent = `${hrs}:${mins}:${secs}`;
    }, 1000);
    sw.__running = true;
    sw.style.borderColor = '#3ea6ff';
    sw.style.color = '#3ea6ff';
    return 'started';
  }
}

function resetStopwatch() {
  const sw = document.getElementById('__ext_stopwatch');
  if (!sw) return 'no-sw';
  if (sw.__running) {
    clearInterval(sw.__intervalId);
    sw.__running = false;
  }
  sw.__elapsed = 0;
  sw.textContent = '00:00:00';
  sw.style.borderColor = '#3ea6ff';
  sw.style.color = '#3ea6ff';
  return 'reset';
}

function removeStopwatch() {
  const sw = document.getElementById('__ext_stopwatch');
  if (!sw) return 'no-sw';
  if (sw.__running) clearInterval(sw.__intervalId);
  sw.remove();
  return 'removed';
}
