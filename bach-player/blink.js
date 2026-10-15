// Blink metronome: a dot that flashes at a slider-set BPM (30-105), optional click.
// Always on while the popup is open (no start/stop); settings persist in chrome.storage.local.
(function () {
  var MIN = 30, MAX = 105;
  var $ = function (id) { return document.getElementById(id); };
  var dot = $('blinkDot'), slider = $('blinkSlider'), label = $('blinkBpmLabel');
  var clickBox = $('blinkClickBox');

  var bpm = 80, clickOn = false;
  var ctx = null, nextBeat = 0, flashes = [];

  function save() { chrome.storage.local.set({ blinkBpm: bpm, blinkClick: clickOn }); }
  function setBpm(v) {
    bpm = Math.max(MIN, Math.min(MAX, Math.round(v)));
    slider.value = bpm; label.textContent = bpm + ' BPM'; save();
  }
  function getCtx() {
    if (!ctx) ctx = new AudioContext();
    if (ctx.state !== 'running') ctx.resume();
    return ctx;
  }
  function nowS() { return performance.now() / 1000; }
  function click(t) {
    var o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.value = 1500;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.4, t + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
    o.connect(g); g.connect(ctx.destination);
    o.start(t); o.stop(t + 0.08);
  }

  // Always on: beats are tracked on the page clock (blinks without needing audio unlocked);
  // the optional click is scheduled on the audio clock only when audio is running.
  setInterval(function () {
    var now = nowS();
    if (!nextBeat || nextBeat < now - 0.5) nextBeat = now + 0.05;
    while (nextBeat < now + 0.15) {
      flashes.push(nextBeat);
      if (clickOn && ctx && ctx.state === 'running') click(ctx.currentTime + (nextBeat - now));
      nextBeat += 60 / bpm;
    }
  }, 25);

  function draw() {
    requestAnimationFrame(draw);
    var level = 0, now = nowS();
    while (flashes.length && flashes[0] < now - 0.4) flashes.shift();
    for (var i = 0; i < flashes.length; i++) {
      var age = now - flashes[i];
      if (age >= 0) level = Math.max(level, Math.max(0, 1 - age / 0.18));
    }
    dot.style.background = 'rgb(' + Math.round(58 + level * 197) + ',' + Math.round(18 + level * 41) + ',' + Math.round(16 + level * 32) + ')';
    dot.style.boxShadow = '0 0 ' + Math.round(level * 18) + 'px rgba(255,59,48,' + level.toFixed(2) + ')';
  }
  draw();

  // Sync: restart the beat at this instant (first flash/click fires now), so you can
  // press it on a downbeat of the music and have the blink line up from there.
  $('blinkSyncBtn').addEventListener('click', function () {
    flashes.length = 0;
    nextBeat = nowS();
    if (clickOn) getCtx();
  });

  slider.addEventListener('input', function () { setBpm(+slider.value); });
  clickBox.addEventListener('change', function () { clickOn = clickBox.checked; if (clickOn) getCtx(); save(); });
  // saved click=on needs one gesture in the popup before Chrome lets audio start
  document.addEventListener('pointerdown', function () { if (clickOn) getCtx(); });

  chrome.storage.local.get(['blinkBpm', 'blinkClick'], function (r) {
    if (r.blinkBpm) setBpm(r.blinkBpm); else setBpm(bpm);
    clickOn = !!r.blinkClick; clickBox.checked = clickOn;
  });
})();
