chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'playChime') {
    playChimeAlert();
  }
});

// Bach-player style triangle-wave click (woodblock-like timbre)
function playClick(ctx, time, accent) {
  const osc = ctx.createOscillator();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(accent ? 880 : 660, time);
  osc.frequency.exponentialRampToValueAtTime(accent ? 440 : 330, time + 0.05);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, time);
  g.gain.exponentialRampToValueAtTime(accent ? 0.7 : 0.45, time + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, time + 0.08);
  osc.connect(g).connect(ctx.destination);
  osc.start(time);
  osc.stop(time + 0.1);
}

function playChimeAlert() {
  try {
    const ctx = new AudioContext();
    const now = ctx.currentTime;
    // Play 12 rapid clicks: accent every 4th beat, 150ms apart
    for (let i = 0; i < 12; i++) {
      playClick(ctx, now + i * 0.15, i % 4 === 0);
    }
    setTimeout(() => ctx.close(), 3000);
  } catch(e) {}
}
