document.getElementById('toggleBtn').addEventListener('click', async () => {
  const status = document.getElementById('status');

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: toggleVisualizer
    });
    status.textContent = 'Injected! Check the page.';
    status.className = 'success';
  } catch (err) {
    status.textContent = 'Failed to inject: ' + err.message;
    status.className = 'error';
  }
});

document.getElementById('waveBtn').addEventListener('click', async () => {
  const status = document.getElementById('status');
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  try {
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: toggleWaveform });
    status.textContent = 'Injected! Check the page.';
    status.className = 'success';
  } catch (err) {
    status.textContent = 'Failed to inject: ' + err.message;
    status.className = 'error';
  }
});

// Audacity-style waveform history strip: fills in as audio plays so you can see
// where the loud parts are. If the page has a <video>/<audio>, x = media position
// (click to seek); otherwise x = elapsed time since capture started.
function toggleWaveform() {
  if (window.__wfx) { window.__wfx.stop(); return; }

  const BINS = 2000;          // media mode: fixed resolution across full duration
  const PX_PER_SEC = 10;      // elapsed mode: scroll rate
  const H = 120;

  const wrap = document.createElement('div');
  wrap.style.cssText = 'position:fixed;left:0;right:0;bottom:0;height:' + H + 'px;z-index:2147483647;' +
    'background:rgba(240,240,255,0.92);border-top:1px solid #6366c9;';
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'width:100%;height:100%;display:block;cursor:pointer;';
  const close = document.createElement('div');
  close.textContent = 'x';
  close.style.cssText = 'position:absolute;top:2px;right:6px;font:14px sans-serif;color:#333;cursor:pointer;';
  const msg = document.createElement('div');
  msg.textContent = 'Waveform: choose a tab and tick "Share tab audio"...';
  msg.style.cssText = 'position:absolute;top:50%;left:12px;transform:translateY(-50%);font:13px sans-serif;color:#333;pointer-events:none;';
  wrap.appendChild(canvas);
  wrap.appendChild(msg);
  wrap.appendChild(close);
  document.body.appendChild(wrap);

  let stream, audioCtx, analyser, raf = 0, active = true, metroTimer = 0;
  const mins = new Float32Array(BINS), maxs = new Float32Array(BINS);
  const elMin = [], elMax = [];
  let peakSeen = 0.2;
  const startT = performance.now();

  function pickMedia() {
    const els = Array.prototype.slice.call(document.querySelectorAll('video, audio'));
    return els.filter(e => isFinite(e.duration) && e.duration > 0)
      .filter(e => !e.paused && !e.muted && e.volume > 0)  // audible only (skips muted autoplay clips)
      .sort((a, b) => b.duration - a.duration)[0] || null;
  }

  function stop() {
    active = false;
    cancelAnimationFrame(raf);
    clearInterval(metroTimer);
    if (stream) stream.getTracks().forEach(t => t.stop());
    if (audioCtx) audioCtx.close();
    wrap.remove();
    window.__wfx = null;
  }
  window.__wfx = { stop: stop };
  close.onclick = stop;

  canvas.onclick = (e) => {
    if (audioCtx && audioCtx.state !== 'running') audioCtx.resume();
    const m = pickMedia();
    if (!m) return;
    m.currentTime = (e.offsetX / canvas.clientWidth) * m.duration;
  };

  const opts = { video: true, audio: true };
  try {
    // stay on this tab after sharing instead of jumping to the shared one
    const controller = new CaptureController();
    controller.setFocusBehavior('no-focus-change');
    opts.controller = controller;
  } catch (e) { /* older Chrome: falls back to default behavior */ }
  // Same-tab fast path: tap the page's own <video>/<audio> directly (no share prompt,
  // playback unaffected). Falls back to tab-capture sharing when there is no element.
  function elementStream() {
    const els = Array.prototype.slice.call(document.querySelectorAll('video, audio'))
      .filter(e => e.captureStream && isFinite(e.duration) && e.duration > 0 && !e.muted)
      .sort((a, b) => (a.paused - b.paused) || (b.duration - a.duration));
    for (let k = 0; k < els.length; k++) {
      try {
        const s = els[k].captureStream();
        if (s.getAudioTracks().length) return new MediaStream(s.getAudioTracks());
      } catch (e) { /* try next */ }
    }
    return null;
  }
  const direct = elementStream();
  (direct ? Promise.resolve(direct) : navigator.mediaDevices.getDisplayMedia(opts)).then(s => {
    stream = s;
    s.getVideoTracks().forEach(t => t.stop());
    const tr = s.getAudioTracks();
    if (!tr.length) { msg.textContent = 'No audio captured - click x, then re-share and tick "Share tab audio".'; s.getTracks().forEach(t => t.stop()); return; }
    msg.textContent = 'Listening... play something (strip fills as audio plays)';
    tr[0].onended = stop;
    audioCtx = new AudioContext();
    audioCtx.resume();  // injected contexts can start suspended (autoplay policy) -> flat line
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 1024;
    audioCtx.createMediaStreamSource(s).connect(analyser);
    const buf = new Uint8Array(analyser.fftSize);

    // ---- metronome: onset-flux autocorrelation tempo estimate + faster/slower nudges ----
    analyser.smoothingTimeConstant = 0;           // raw spectra so flux sees real attacks
    const spec = new Float32Array(analyser.frequencyBinCount);
    let prevSpec = null;
    const MAX_BPM = 105;                          // hard cap (auto-detect and buttons)
    const GRID_MS = 20, GRID_N = 400;             // 8 s of onset strength at 50 Hz
    const onsets = [];                            // [timeMs, flux]
    let bpm = 0, manual = false, metroOn = false, anchor = 0, diffCount = 0, lastAnalysis = 0;
    const marks = [];                             // beat positions for drawing (bin indices)
    const sched = { next: 0 };

    const bar = document.createElement('div');
    bar.style.cssText = 'position:absolute;top:4px;left:8px;display:flex;gap:4px;align-items:center;font:12px sans-serif;color:#222;';
    function mkBtn(label, title, fn) {
      const b = document.createElement('button');
      b.textContent = label; b.title = title;
      b.style.cssText = 'font:12px sans-serif;padding:2px 7px;border:1px solid #6366c9;border-radius:4px;background:#fff;color:#222;cursor:pointer;';
      b.onclick = (e) => { e.stopPropagation(); fn(); };
      bar.appendChild(b);
      return b;
    }
    const onBtn = mkBtn('Metronome: off', 'Start/stop the click (re-estimates tempo automatically)', () => {
      metroOn = !metroOn;
      onBtn.textContent = 'Metronome: ' + (metroOn ? 'on' : 'off');
      onBtn.style.background = metroOn ? '#c9caf5' : '#fff';
      if (metroOn) {
        manual = false; sched.next = 0;
        if (audioCtx.state !== 'running') audioCtx.resume();
        // sound right away at a default tempo; auto-detect replaces it once it has ~3 s of audio
        if (!bpm) { bpm = 90; anchor = performance.now(); }
      }
    });
    const bpmLbl = document.createElement('span');
    bpmLbl.style.minWidth = '64px';
    bpmLbl.textContent = '-- BPM';
    function setBpm(v) {
      manual = true;
      bpm = Math.max(30, Math.min(MAX_BPM, v));
      sched.next = 0;            // re-plan from the last beat at the new tempo
    }
    mkBtn('Slower', 'Click is too fast: slow it down', () => { if (bpm) setBpm(bpm * 0.97); });
    mkBtn('Faster', 'Click is too slow: speed it up', () => { if (bpm) setBpm(bpm * 1.03); });
    bar.appendChild(bpmLbl);
    mkBtn(String.fromCharCode(0xBD), 'Half tempo', () => { if (bpm) setBpm(bpm / 2); });
    mkBtn(String.fromCharCode(0xD7) + '2', 'Double tempo', () => { if (bpm) setBpm(bpm * 2); });
    mkBtn(String.fromCharCode(0xD7) + '1.5', 'Triple-feel fix: 3 against 2 (e.g. 76 -> 114)', () => { if (bpm) setBpm(bpm * 1.5); });
    mkBtn(String.fromCharCode(0xF7) + '1.5', 'Triple-feel fix: 2 against 3 (e.g. 114 -> 76)', () => { if (bpm) setBpm(bpm / 1.5); });
    mkBtn(String.fromCharCode(0xF7) + '1.25', 'Divide tempo by 1.25 (e.g. 105 -> 84)', () => { if (bpm) setBpm(bpm / 1.25); });
    mkBtn('Sync', 'Snap the click onto the beats it hears right now', () => { analyse(true); });
    mkBtn('Auto', 'Go back to automatic tempo tracking', () => { manual = false; diffCount = 3; });
    wrap.appendChild(bar);

    function gridFrom(now) {
      const g = new Float32Array(GRID_N);
      for (let i = onsets.length - 1; i >= 0; i--) {
        const k = GRID_N - 1 - Math.floor((now - onsets[i][0]) / GRID_MS);
        if (k < 0) break;
        if (k < GRID_N && onsets[i][1] > g[k]) g[k] = onsets[i][1];
      }
      let mean = 0;
      for (let i = 0; i < GRID_N; i++) mean += g[i];
      mean /= GRID_N;
      for (let i = 0; i < GRID_N; i++) g[i] -= mean;
      return g;
    }

    function analyse(forceSnap) {
      const now = performance.now();
      if (onsets.length < 150 || now - onsets[0][0] < 3000) return;
      const g = gridFrom(now);
      const minLag = Math.round(60000 / MAX_BPM / GRID_MS), maxLag = Math.round(60000 / 60 / GRID_MS);
      let best = -Infinity, bestLag = 0;
      const r = [];
      for (let lag = minLag - 1; lag <= maxLag + 1; lag++) {
        let s = 0;
        for (let i = lag; i < GRID_N; i++) s += g[i] * g[i - lag];
        s /= (GRID_N - lag);
        r[lag] = s;
      }
      for (let lag = minLag; lag <= maxLag; lag++) {
        const b = 60000 / (lag * GRID_MS);
        const w = Math.exp(-0.5 * Math.pow(Math.log2(b / 90) / 0.8, 2));  // gentle preference near 90 BPM
        const sc = r[lag] > 0 ? r[lag] * w : r[lag] / w;  // keep ranking sane when correlation is weak/negative
        if (sc > best) { best = sc; bestLag = lag; }
      }
      if (!bestLag) return;
      // parabolic interpolation for sub-bin lag
      const a = r[bestLag - 1], b0 = r[bestLag], c = r[bestLag + 1];
      const den = a - 2 * b0 + c;
      const lagF = bestLag + (den ? 0.5 * (a - c) / den : 0);
      const est = Math.min(MAX_BPM, 60000 / (lagF * GRID_MS));

      if (!manual) {
        if (!bpm) bpm = est;
        else if (Math.abs(est / bpm - 1) < 0.08) { bpm = bpm * 0.7 + est * 0.3; diffCount = 0; }
        else if (++diffCount >= 3) { bpm = est; diffCount = 0; }
      }
      if (!bpm) return;

      // phase: fold onsets on the current period, find the offset that collects the most energy
      const P = 60000 / bpm / GRID_MS;
      let bestS = 0, bestV = -1e9;
      for (let s = 0; s < P; s++) {
        let v = 0, n = 0;
        for (let k = 0; ; k++) {
          const idx = Math.round(GRID_N - 1 - s - k * P);
          if (idx < 0) break;
          v += g[idx]; n++;
        }
        v /= (n || 1);
        if (v > bestV) { bestV = v; bestS = s; }
      }
      const measuredLast = now - bestS * GRID_MS;
      const periodMs = 60000 / bpm;
      if (forceSnap || !anchor) {
        anchor = measuredLast; sched.next = 0;
      } else {
        // gentle pull toward measured phase (wrapped to +/- half a beat)
        let d = (measuredLast - anchor) % periodMs;
        if (d > periodMs / 2) d -= periodMs;
        if (d < -periodMs / 2) d += periodMs;
        anchor += d * 0.3;
        sched.next = 0;
      }
    }

    function click(atCtxTime) {
      const o = audioCtx.createOscillator(), gn = audioCtx.createGain();
      o.frequency.value = 1500;
      gn.gain.setValueAtTime(0.0001, atCtxTime);
      gn.gain.exponentialRampToValueAtTime(0.35, atCtxTime + 0.002);
      gn.gain.exponentialRampToValueAtTime(0.0001, atCtxTime + 0.06);
      o.connect(gn); gn.connect(audioCtx.destination);
      o.start(atCtxTime); o.stop(atCtxTime + 0.08);
    }

    metroTimer = setInterval(() => {
      if (!active || !bpm) return;
      const now = performance.now();
      if (now - lastAnalysis > 1000) { lastAnalysis = now; analyse(false); }
      bpmLbl.textContent = Math.round(bpm) + ' BPM' + (manual ? ' (set)' : '');
      if (!anchor) return;
      const periodMs = 60000 / bpm;
      if (!sched.next || sched.next < now - periodMs) {
        sched.next = anchor + Math.ceil((now - anchor) / periodMs) * periodMs;
      }
      while (sched.next < now + 150) {
        if (sched.next >= now) {
          const dt = (sched.next - now) / 1000;
          if (metroOn) click(audioCtx.currentTime + dt);
          const m = pickMedia();
          if (m) marks.push(Math.min(BINS - 1, Math.floor((m.currentTime + dt) / m.duration * BINS)));
          else marks.push(Math.floor((sched.next - startT) / 1000 * PX_PER_SEC));
          if (marks.length > 4000) marks.shift();
        }
        sched.next += periodMs;
        anchor = sched.next - periodMs;   // keep anchor on the last scheduled beat
      }
    }, 25);

    function frame() {
      if (!active) return;
      raf = requestAnimationFrame(frame);
      const W = canvas.width = canvas.clientWidth;
      canvas.height = H;
      const ctx = canvas.getContext('2d');

      analyser.getByteTimeDomainData(buf);
      let lo = 0, hi = 0;
      for (let i = 0; i < buf.length; i++) {
        const v = (buf[i] - 128) / 128;
        if (v < lo) lo = v;
        if (v > hi) hi = v;
      }
      peakSeen = Math.max(peakSeen, -lo, hi);
      analyser.getFloatFrequencyData(spec);
      if (prevSpec) {
        let fl = 0;
        for (let i = 2; i < 200; i++) {
          const c = Math.max(spec[i], -100), p = Math.max(prevSpec[i], -100);
          if (c > p) fl += c - p;
        }
        onsets.push([performance.now(), fl / 198]);
        if (onsets.length > 700) onsets.shift();
      }
      prevSpec = prevSpec || new Float32Array(spec.length);
      prevSpec.set(spec);
      if (hi - lo > 0.01) msg.style.display = 'none';
      else if (audioCtx.state !== 'running') { audioCtx.resume(); msg.textContent = 'Audio engine suspended - click the strip once'; msg.style.display = 'block'; }

      const m = pickMedia();
      let playheadX = -1;
      if (m) {
        const b = Math.min(BINS - 1, Math.floor(m.currentTime / m.duration * BINS));
        if (!m.paused) {
          if (lo < mins[b]) mins[b] = lo;
          if (hi > maxs[b]) maxs[b] = hi;
        }
        playheadX = m.currentTime / m.duration * W;
      } else {
        const b = Math.floor((performance.now() - startT) / 1000 * PX_PER_SEC);
        while (elMin.length <= b) { elMin.push(0); elMax.push(0); }
        if (lo < elMin[b]) elMin[b] = lo;
        if (hi > elMax[b]) elMax[b] = hi;
      }

      ctx.clearRect(0, 0, W, H);
      const R = 0;  // no ruler
      const mid = R + (H - R) / 2, scale = ((H - R) / 2 - 4) / peakSeen;
      ctx.fillStyle = '#6366c9';
      if (m) {
        for (let x = 0; x < W; x++) {
          const a = Math.floor(x / W * BINS), z = Math.max(a + 1, Math.floor((x + 1) / W * BINS));
          let mn = 0, mx = 0;
          for (let k = a; k < z && k < BINS; k++) { if (mins[k] < mn) mn = mins[k]; if (maxs[k] > mx) mx = maxs[k]; }
          ctx.fillRect(x, mid - mx * scale, 1, (mx - mn) * scale + 1);
        }
      } else {
        const first = Math.max(0, elMin.length - W);
        for (let x = 0; x < W && first + x < elMin.length; x++) {
          const mn = elMin[first + x], mx = elMax[first + x];
          ctx.fillRect(x, mid - mx * scale, 1, (mx - mn) * scale + 1);
        }
      }
      ctx.fillStyle = '#2a9d5c';
      if (m) {
        for (let q = 0; q < marks.length; q++) ctx.fillRect(marks[q] / BINS * W, H - 10, 1, 10);
      } else {
        const firstB = Math.max(0, elMin.length - W);
        for (let q = 0; q < marks.length; q++) { const x = marks[q] - firstB; if (x >= 0 && x < W) ctx.fillRect(x, H - 10, 1, 10); }
      }
      if (playheadX >= 0) {
        ctx.fillStyle = '#e74c3c';
        ctx.fillRect(playheadX, 0, 2, H);
      }
    }
    frame();
  }).catch((err) => { msg.textContent = 'Capture failed: ' + err.name + ' - ' + err.message; console.warn('waveform', err); });
}

function toggleVisualizer() {
  // If already active, toggle off
  const existing = document.getElementById('__ext_visualizerOverlay');
  if (existing) {
    if (existing.classList.contains('active')) {
      // Turn off
      existing.classList.remove('active');
      if (window.__extVisualizerCleanup) {
        window.__extVisualizerCleanup();
      }
    } else {
      // Re-activate — need fresh capture
      startCapture(existing, document.getElementById('__ext_visualizerCanvas'));
    }
    return;
  }

  // First time — inject DOM
  const style = document.createElement('style');
  style.textContent = `
    #__ext_visualizerOverlay {
      display: none;
      position: fixed;
      top: 0; left: 0; right: 0; bottom: 0;
      z-index: 2147483647;
      pointer-events: none;
    }
    #__ext_visualizerOverlay.active {
      display: block;
    }
    #__ext_visualizerOverlay canvas {
      width: 100%;
      height: 100%;
    }
  `;
  document.head.appendChild(style);

  const overlay = document.createElement('div');
  overlay.id = '__ext_visualizerOverlay';
  const canvas = document.createElement('canvas');
  canvas.id = '__ext_visualizerCanvas';
  overlay.appendChild(canvas);
  document.body.appendChild(overlay);

  startCapture(overlay, canvas);

  async function startCapture(overlay, canvas) {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true
      });

      // Stop video track — only need audio
      stream.getVideoTracks().forEach(t => t.stop());

      const audioTracks = stream.getAudioTracks();
      if (!audioTracks.length) {
        alert('No audio captured. Make sure to check "Share tab audio" in the prompt.');
        stream.getTracks().forEach(t => t.stop());
        return;
      }

      overlay.classList.add('active');

      // Web Audio setup
      const audioCtx = new AudioContext();
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      const ctx = canvas.getContext('2d');

      let animId = null;
      let active = true;

      function renderFrame() {
        if (!active) return;
        animId = requestAnimationFrame(renderFrame);

        const WIDTH = canvas.width;
        const HEIGHT = canvas.height;

        analyser.getByteFrequencyData(dataArray);
        ctx.clearRect(0, 0, WIDTH, HEIGHT);

        const barWidth = (WIDTH / bufferLength) * 2.5;
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
          const barHeight = dataArray[i];
          const r = barHeight + (25 * (i / bufferLength));
          const g = 250 * (i / bufferLength);
          const b = 50;

          ctx.fillStyle = 'rgba(' + r + ',' + g + ',' + b + ',0.7)';
          ctx.fillRect(x, HEIGHT - barHeight, barWidth, barHeight);
          x += barWidth + 1;
        }
      }

      renderFrame();

      const resizeHandler = () => {
        if (active) {
          canvas.width = window.innerWidth;
          canvas.height = window.innerHeight;
        }
      };
      window.addEventListener('resize', resizeHandler);

      // Handle stream ending
      audioTracks[0].onended = () => {
        cleanup();
      };

      function cleanup() {
        active = false;
        if (animId) cancelAnimationFrame(animId);
        stream.getTracks().forEach(t => t.stop());
        audioCtx.close();
        overlay.classList.remove('active');
        window.removeEventListener('resize', resizeHandler);
        window.__extVisualizerCleanup = null;
      }

      window.__extVisualizerCleanup = cleanup;

    } catch (err) {
      console.warn('Visualizer capture cancelled or failed:', err);
    }
  }
}
