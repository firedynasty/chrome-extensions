document.getElementById('sheetsBtn').addEventListener('click', () => {
  chrome.tabs.create({ url: 'https://docs.google.com/spreadsheets/d/1PxtKGyT64bMIj2dJ428UvHlXENUF6mgv65YalkscJn0/edit?gid=0#gid=0' });
});

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
let countdownInterval = null;

// 5-minute countdown timer
const countdownDisplay = document.getElementById('countdownDisplay');
const timerBtn = document.getElementById('timerBtn');
const COUNTDOWN_MS = 5 * 60 * 1000;

chrome.storage.local.get(['countdownEndTime'], (data) => {
  if (data.countdownEndTime) {
    const remaining = data.countdownEndTime - Date.now();
    if (remaining > 0) {
      startCountdownDisplay(data.countdownEndTime);
    } else {
      chrome.storage.local.remove('countdownEndTime');
    }
  }
});

timerBtn.addEventListener('click', () => {
  chrome.storage.local.get(['countdownEndTime'], (data) => {
    if (data.countdownEndTime && data.countdownEndTime > Date.now()) {
      // Stop the timer
      clearInterval(countdownInterval);
      chrome.storage.local.remove('countdownEndTime');
      chrome.runtime.sendMessage({ type: 'clearCountdown' });
      countdownDisplay.textContent = '5:00';
      countdownDisplay.classList.add('idle');
      timerBtn.textContent = '5 Min Timer';
      timerBtn.classList.remove('running');
    } else {
      // Start the timer
      const endTime = Date.now() + COUNTDOWN_MS;
      chrome.storage.local.set({ countdownEndTime: endTime });
      chrome.runtime.sendMessage({ type: 'scheduleCountdown', delayMinutes: 5 });
      startCountdownDisplay(endTime);
    }
  });
});

function startCountdownDisplay(endTime) {
  countdownDisplay.classList.remove('idle');
  timerBtn.textContent = 'Stop';
  timerBtn.classList.add('running');
  if (countdownInterval) clearInterval(countdownInterval);
  function update() {
    const remaining = endTime - Date.now();
    if (remaining <= 0) {
      clearInterval(countdownInterval);
      countdownDisplay.textContent = '0:00';
      chrome.storage.local.remove('countdownEndTime');
      setTimeout(() => {
        countdownDisplay.textContent = '5:00';
        countdownDisplay.classList.add('idle');
        timerBtn.textContent = '5 Min Timer';
        timerBtn.classList.remove('running');
      }, 2000);
      return;
    }
    const totalSecs = Math.ceil(remaining / 1000);
    const mins = Math.floor(totalSecs / 60);
    const secs = String(totalSecs % 60).padStart(2, '0');
    countdownDisplay.textContent = `${mins}:${secs}`;
  }
  update();
  countdownInterval = setInterval(update, 1000);
}

// Load and sync beatsAlertEnabled toggle
const beatsToggle = document.getElementById('beatsToggle');
chrome.storage.local.get(['beatsAlertEnabled'], (data) => {
  if (data.beatsAlertEnabled === false) beatsToggle.checked = false;
});
beatsToggle.addEventListener('change', function() {
  chrome.storage.local.set({ beatsAlertEnabled: this.checked });
  if (!this.checked) {
    chrome.runtime.sendMessage({ type: 'clearChime' });
  }
});

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

  // Schedule chime alarm in background service worker
  if (activity === 'work') {
    chrome.runtime.sendMessage({ type: 'scheduleChime', delayMinutes: 25 });
  } else if (activity === 'break') {
    chrome.runtime.sendMessage({ type: 'scheduleChime', delayMinutes: 5 });
  } else {
    chrome.runtime.sendMessage({ type: 'clearChime' });
  }

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
