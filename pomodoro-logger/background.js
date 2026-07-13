const COUNTDOWN_ALARM = 'pomodoroCountdown';
const FIVEMIN_ALARM = 'fiveMinTimer';

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === FIVEMIN_ALARM) {
    chrome.storage.local.remove('fiveMinEndTime');
    await playChimeViaOffscreen();
    return;
  }

  if (alarm.name === COUNTDOWN_ALARM) {
    await playChimeViaOffscreen();
    // Auto-cycle to next phase
    const data = await chrome.storage.local.get(['pomodoroPhase']);
    const currentPhase = data.pomodoroPhase || 'work';
    const nextPhase = currentPhase === 'work' ? 'break' : 'work';
    const nextMinutes = nextPhase === 'work' ? 25 : 5;
    const nextEndTime = Date.now() + nextMinutes * 60 * 1000;
    chrome.storage.local.set({ pomodoroPhase: nextPhase, countdownEndTime: nextEndTime });
    chrome.alarms.create(COUNTDOWN_ALARM, { delayInMinutes: nextMinutes });
    return;
  }

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
  if (msg.type === 'scheduleFiveMin') {
    chrome.alarms.clear(FIVEMIN_ALARM);
    chrome.alarms.create(FIVEMIN_ALARM, { delayInMinutes: msg.delayMinutes });
  } else if (msg.type === 'clearFiveMin') {
    chrome.alarms.clear(FIVEMIN_ALARM);
  } else if (msg.type === 'scheduleCountdown') {
    chrome.alarms.clear(COUNTDOWN_ALARM);
    chrome.alarms.create(COUNTDOWN_ALARM, { delayInMinutes: msg.delayMinutes });
  } else if (msg.type === 'clearCountdown') {
    chrome.alarms.clear(COUNTDOWN_ALARM);
  }
});
