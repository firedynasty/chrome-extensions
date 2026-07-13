const ALARM_NAME = 'pomodoroChime';
const COUNTDOWN_ALARM = 'pomodoroCountdown';

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === COUNTDOWN_ALARM) {
    chrome.storage.local.remove('countdownEndTime');
    await playChimeViaOffscreen();
    return;
  }

  if (alarm.name !== ALARM_NAME) return;

  const data = await chrome.storage.local.get(['beatsAlertEnabled']);
  if (data.beatsAlertEnabled === false) return;

  await playChimeViaOffscreen();
});

async function playChimeViaOffscreen() {
  // Create offscreen document if it doesn't exist
  const contexts = await chrome.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT']
  });

  if (!contexts.length) {
    await chrome.offscreen.createDocument({
      url: 'offscreen.html',
      reasons: ['AUDIO_PLAYBACK'],
      justification: 'Play pomodoro milestone chime alert'
    });
  }

  chrome.runtime.sendMessage({ type: 'playChime' });

  // Close offscreen doc after chime finishes (8 chimes * 400ms + buffer)
  setTimeout(async () => {
    try { await chrome.offscreen.closeDocument(); } catch(e) {}
  }, 4000);
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'scheduleChime') {
    chrome.alarms.clear(ALARM_NAME);
    // msg.delayMinutes: 25 for work, 5 for break
    chrome.alarms.create(ALARM_NAME, { delayInMinutes: msg.delayMinutes });
  } else if (msg.type === 'clearChime') {
    chrome.alarms.clear(ALARM_NAME);
  } else if (msg.type === 'scheduleCountdown') {
    chrome.alarms.clear(COUNTDOWN_ALARM);
    chrome.alarms.create(COUNTDOWN_ALARM, { delayInMinutes: msg.delayMinutes });
  } else if (msg.type === 'clearCountdown') {
    chrome.alarms.clear(COUNTDOWN_ALARM);
  }
});
