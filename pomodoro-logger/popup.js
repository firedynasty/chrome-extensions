const workBtn = document.getElementById('workBtn');
const breakBtn = document.getElementById('breakBtn');
const customBtn = document.getElementById('customBtn');
const customInput = document.getElementById('customInput');
const timerEl = document.getElementById('timer');
const currentActivityEl = document.getElementById('currentActivity');
const scriptUrlInput = document.getElementById('scriptUrl');
const saveUrlBtn = document.getElementById('saveUrl');
const status = document.getElementById('status');
const historyEl = document.getElementById('history');

let timerInterval = null;

// Load saved state on popup open
chrome.storage.local.get(['scriptUrl', 'lastLogTime', 'lastActivity', 'history'], (data) => {
  if (data.scriptUrl) {
    scriptUrlInput.value = data.scriptUrl;
    status.textContent = 'Ready';
    status.className = 'success';
  }
  if (data.lastLogTime && data.lastActivity) {
    currentActivityEl.textContent = data.lastActivity;
    startTimerFrom(data.lastLogTime);
  }
  if (data.history) {
    renderHistory(data.history);
  }
});

saveUrlBtn.addEventListener('click', () => {
  const url = scriptUrlInput.value.trim();
  if (!url) {
    status.textContent = 'Enter a URL first';
    status.className = 'error';
    return;
  }
  chrome.storage.local.set({ scriptUrl: url }, () => {
    status.textContent = 'URL saved!';
    status.className = 'success';
  });
});

workBtn.addEventListener('click', () => logActivity('work'));
breakBtn.addEventListener('click', () => logActivity('break'));

customBtn.addEventListener('click', () => {
  const input = customInput;
  if (input.style.display === 'block') {
    input.style.display = 'none';
  } else {
    input.style.display = 'block';
    input.focus();
  }
});

customInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    const val = customInput.value.trim();
    if (val) {
      logActivity(val);
      customInput.value = '';
      customInput.style.display = 'none';
    }
  }
});

async function logActivity(activity) {
  const now = new Date();
  const timeStr = now.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });

  // Update local state immediately
  const logTime = now.getTime();
  currentActivityEl.textContent = activity;
  startTimerFrom(logTime);

  // Add to local history
  chrome.storage.local.get(['history'], (data) => {
    const history = data.history || [];
    history.unshift({ time: timeStr, activity });
    // Keep last 20 entries
    if (history.length > 20) history.length = 20;
    chrome.storage.local.set({ history, lastLogTime: logTime, lastActivity: activity });
    renderHistory(history);
  });

  // Send to Google Sheets
  chrome.storage.local.get(['scriptUrl'], async (data) => {
    if (!data.scriptUrl) {
      status.textContent = 'Logged locally (no script URL)';
      status.className = 'error';
      return;
    }

    try {
      status.textContent = 'Logging...';
      status.className = '';
      const resp = await fetch(data.scriptUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({ time: timeStr, activity })
      });
      if (resp.ok) {
        status.textContent = `${timeStr} — ${activity}`;
        status.className = 'success';
      } else {
        status.textContent = 'Sheet error (check URL)';
        status.className = 'error';
      }
    } catch (err) {
      status.textContent = 'Network error';
      status.className = 'error';
    }
  });
}

function startTimerFrom(startTime) {
  if (timerInterval) clearInterval(timerInterval);
  function updateTimer() {
    const elapsed = Date.now() - startTime;
    const totalSecs = Math.floor(elapsed / 1000);
    const hrs = String(Math.floor(totalSecs / 3600)).padStart(2, '0');
    const mins = String(Math.floor((totalSecs % 3600) / 60)).padStart(2, '0');
    const secs = String(totalSecs % 60).padStart(2, '0');
    timerEl.textContent = `${hrs}:${mins}:${secs}`;
  }
  updateTimer();
  timerInterval = setInterval(updateTimer, 1000);
}

function renderHistory(history) {
  historyEl.innerHTML = history.map(entry => {
    const cls = entry.activity === 'work' ? 'work'
      : entry.activity === 'break' ? 'break'
      : 'custom';
    return `<div class="history-entry"><span class="time">${entry.time}</span> <span class="${cls}">${entry.activity}</span></div>`;
  }).join('');
}
