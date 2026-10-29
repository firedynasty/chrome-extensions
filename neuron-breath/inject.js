(function () {
  'use strict';

  // Version-stamped singleton: a click on an up-to-date copy toggles it off;
  // a stale copy from an older version is torn down and replaced.
  const VERSION = 4;
  const HOST_ID = '__nbr-host';

  const prev = window.__nbr;
  if (prev) {
    prev.teardown();
    window.__nbr = null;
    if (prev.version === VERSION) return; // toggled off
  }

  // ---- DOM: shadow root so page CSS can't reach in; styles are set through
  // the CSSOM (el.style.cssText) so a strict page CSP can't block them -------
  const host = document.createElement('div');
  host.id = HOST_ID;
  host.style.cssText = 'all: initial; position: fixed; top: 0; left: 0; right: 0; bottom: 0; z-index: 2147483647;';
  const root = host.attachShadow({ mode: 'open' });

  function el(tag, css, text) {
    const e = document.createElement(tag);
    if (css) e.style.cssText = css;
    if (text != null) e.textContent = text;
    return e;
  }

  const FONT = 'font-family: system-ui, -apple-system, Segoe UI, sans-serif;';
  const backdrop = el('div', 'position:absolute; inset:0; background:rgba(8,14,24,.55);');
  const panel = el('div',
    'position:absolute; left:50%; top:50%; transform:translate(-50%,-50%);' +
    'width:min(92vw, 900px); height:min(88vh, 660px); display:flex; flex-direction:column;' +
    'border-radius:16px; overflow:hidden; box-shadow:0 12px 48px rgba(0,0,0,.5);' +
    'background:#0b2a36; color:#fff; ' + FONT);

  const BTN = 'padding:7px 14px; border-radius:8px; border:1px solid rgba(255,255,255,.35);' +
    'background:rgba(255,255,255,.12); color:inherit; font:600 13px system-ui, sans-serif; cursor:pointer;';

  const top = el('div', 'flex:none; display:flex; align-items:center; gap:8px; padding:10px 14px;');
  const tabDots = el('button', BTN, 'Dots');
  const tabBreath = el('button', BTN, 'Breathe');
  const closeBtn = el('button', BTN + 'margin-left:auto;', 'Close');
  top.append(tabDots, tabBreath, closeBtn);

  const stage = el('div', 'position:relative; flex:1 1 0; min-height:0;');
  const canvas = el('canvas', 'position:absolute; inset:0; width:100%; height:100%; display:block;');
  stage.appendChild(canvas);

  // bottom bar, dots mode: your estimate -> Check -> true count
  const bar = el('div', 'flex:none; display:flex; flex-wrap:wrap; align-items:center; gap:8px; padding:10px 14px;');
  const guess = el('input', 'width:110px; padding:7px 10px; border-radius:8px; border:1px solid rgba(255,255,255,.35);' +
    'background:rgba(0,0,0,.35); color:#fff; font:14px system-ui, sans-serif;');
  guess.type = 'number';
  guess.min = '0';
  guess.placeholder = 'Your count';
  const checkBtn = el('button', BTN, 'Check');
  const newBtn = el('button', BTN, 'New dots');
  const result = el('span', 'font:600 14px system-ui, sans-serif; color:#ffd98a;');
  // stopwatch next to New dots: starts at 0:00 when the Dots tab opens, resets on leaving it
  const dotsClock = el('span', 'font:600 14px system-ui, sans-serif; color:rgba(255,255,255,.8); font-variant-numeric:tabular-nums;', '0:00');
  bar.append(guess, checkBtn, newBtn, dotsClock, result);

  const breathInfo = el('div', 'flex:none; padding:10px 14px; text-align:center; font:13px system-ui, sans-serif; color:rgba(40,40,70,.75);');
  breathInfo.textContent = 'Box breathing: in 4, hold 4, out 4, hold 4';

  panel.append(top, stage, bar, breathInfo);
  root.append(backdrop, panel);
  (document.body || document.documentElement).appendChild(host);

  // keep keystrokes (typing a guess) away from page shortcuts
  ['keydown', 'keyup', 'keypress'].forEach((t) => host.addEventListener(t, (e) => e.stopPropagation()));

  // ---- dot network -----------------------------------------------------
  const RW = 1000, RH = 600; // reference space the network is generated in
  let nodes = [], edges = [];

  function rnd(a, b) { return a + Math.random() * (b - a); }

  function makeNetwork() {
    const n = Math.floor(rnd(18, 61));
    nodes = [];
    let tries = 0;
    while (nodes.length < n && tries++ < 5000) {
      const x = rnd(50, RW - 50), y = rnd(50, RH - 50);
      if (nodes.every((p) => Math.hypot(p.x - x, p.y - y) > 58)) {
        nodes.push({ x, y, ph: rnd(0, 6.28), ph2: rnd(0, 6.28), deg: 0 });
      }
    }
    const seen = new Set();
    function link(a, b) {
      const k = a < b ? a + '-' + b : b + '-' + a;
      if (a === b || seen.has(k)) return;
      seen.add(k);
      edges.push([a, b]);
      nodes[a].deg++; nodes[b].deg++;
    }
    edges = [];
    nodes.forEach((p, i) => {
      nodes.map((q, j) => [j, Math.hypot(p.x - q.x, p.y - q.y)])
        .filter((d) => d[0] !== i).sort((u, v) => u[1] - v[1]).slice(0, 2)
        .forEach((d) => link(i, d[0]));
    });
    for (let k = 0; k < nodes.length * 0.45; k++) {
      const a = Math.floor(Math.random() * nodes.length);
      const b = Math.floor(Math.random() * nodes.length);
      if (Math.hypot(nodes[a].x - nodes[b].x, nodes[a].y - nodes[b].y) < 380) link(a, b);
    }
    result.textContent = '';
    guess.value = '';
  }

  // ---- breathing: in / hold / out / hold, 4 s each ---------------------
  const PHASES = [
    { label: 'Breathe in', grow: 1 },
    { label: 'Hold', grow: 0 },
    { label: 'Breathe out', grow: -1 },
    { label: 'Hold', grow: 0 },
  ];
  const PHASE_S = 4, CYCLE_S = PHASE_S * PHASES.length;
  let breathStart = 0, dotsStart = 0;
  function fmtClock(sec) { const t = Math.floor(sec); return Math.floor(t / 60) + ':' + (t % 60 < 10 ? '0' : '') + (t % 60); }

  let mode = 'dots';
  function setMode(m) {
    mode = m;
    bar.style.display = m === 'dots' ? 'flex' : 'none';
    breathInfo.style.display = m === 'breath' ? 'block' : 'none';
    panel.style.background = m === 'dots' ? '#0b2a36' : '#e9e6fb';
    const act = 'background:rgba(255,255,255,.3);';
    tabDots.style.cssText = BTN + (m === 'dots' ? act : '');
    tabBreath.style.cssText = BTN + (m === 'breath' ? act : '');
    if (m === 'breath') breathStart = performance.now();
    else { dotsStart = performance.now(); dotsClock.textContent = '0:00'; }
    // the breath screen is light, so the top buttons need dark text there
    const fg = m === 'dots' ? '#fff' : '#3b3a5c';
    [tabDots, tabBreath, closeBtn].forEach((b) => {
      b.style.color = fg;
      b.style.borderColor = m === 'dots' ? 'rgba(255,255,255,.35)' : 'rgba(59,58,92,.35)';
    });
    if (m === 'breath') closeBtn.style.cssText = BTN + 'margin-left:auto;color:' + fg + ';border-color:rgba(59,58,92,.35);';
    else closeBtn.style.cssText = BTN + 'margin-left:auto;';
  }

  // ---- canvas ------------------------------------------------------------
  const g = canvas.getContext('2d');
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let W = 1, H = 1, DPR = 1;

  function resize() {
    DPR = window.devicePixelRatio || 1;
    W = Math.max(1, canvas.clientWidth);
    H = Math.max(1, canvas.clientHeight);
    canvas.width = Math.round(W * DPR);
    canvas.height = Math.round(H * DPR);
  }
  window.addEventListener('resize', resize);

  function drawDots(t) {
    const bg = g.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, '#0f4b5c');
    bg.addColorStop(1, '#06202c');
    g.fillStyle = bg;
    g.fillRect(0, 0, W, H);

    // fit the 1000x600 reference space inside the canvas, centred
    const s = Math.min(W / RW, H / RH);
    const ox = (W - RW * s) / 2, oy = (H - RH * s) / 2;
    const pos = nodes.map((p) => ({
      x: ox + (p.x + (reduced ? 0 : Math.sin(t * 0.4 + p.ph) * 4)) * s,
      y: oy + (p.y + (reduced ? 0 : Math.cos(t * 0.35 + p.ph2) * 4)) * s,
    }));

    g.lineWidth = Math.max(1, s * 1.4);
    g.strokeStyle = 'rgba(210,245,245,.38)';
    g.beginPath();
    edges.forEach((e) => { g.moveTo(pos[e[0]].x, pos[e[0]].y); g.lineTo(pos[e[1]].x, pos[e[1]].y); });
    g.stroke();

    nodes.forEach((p, i) => {
      const tw = reduced ? 1 : 0.7 + 0.3 * Math.sin(t * 1.3 + p.ph);
      const r = (4 + p.deg * 1.1) * s;
      const glow = g.createRadialGradient(pos[i].x, pos[i].y, 0, pos[i].x, pos[i].y, r * 4);
      glow.addColorStop(0, 'rgba(255,214,140,' + (0.9 * tw).toFixed(3) + ')');
      glow.addColorStop(0.35, 'rgba(255,170,70,' + (0.35 * tw).toFixed(3) + ')');
      glow.addColorStop(1, 'rgba(255,170,70,0)');
      g.fillStyle = glow;
      g.beginPath(); g.arc(pos[i].x, pos[i].y, r * 4, 0, 6.2832); g.fill();
      g.fillStyle = 'rgba(255,246,222,' + tw.toFixed(3) + ')';
      g.beginPath(); g.arc(pos[i].x, pos[i].y, r * 0.55, 0, 6.2832); g.fill();
    });
  }

  function ease(x) { return 0.5 - 0.5 * Math.cos(Math.PI * x); }

  function drawBreath(now) {
    const bg = g.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, '#efe7fb');
    bg.addColorStop(1, '#dcefff');
    g.fillStyle = bg;
    g.fillRect(0, 0, W, H);

    const el_s = (now - breathStart) / 1000;
    const cyc = el_s % CYCLE_S;
    const idx = Math.floor(cyc / PHASE_S);
    const ph = PHASES[idx];
    const f = (cyc - idx * PHASE_S) / PHASE_S; // 0..1 inside this phase

    // circle size: grows on in, stays big on hold, shrinks on out, stays small on hold
    let k;
    if (ph.grow === 1) k = ease(f);
    else if (ph.grow === -1) k = 1 - ease(f);
    else k = idx === 1 ? 1 : 0;

    const cx = W / 2, cy = H / 2;
    const maxR = Math.min(W, H) * 0.34, minR = maxR * 0.62;
    const r = minR + (maxR - minR) * k;

    // progress ring over the whole 16 s cycle, light blue -> yellow
    const ringR = maxR * 1.2;
    g.lineWidth = Math.max(8, maxR * 0.1);
    g.lineCap = 'round';
    g.strokeStyle = 'rgba(160,190,235,.18)';
    g.beginPath(); g.arc(cx, cy, ringR, 0, 6.2832); g.stroke();
    let stroke = '#bfe3f8';
    if (g.createConicGradient) {
      const cg = g.createConicGradient(-Math.PI / 2, cx, cy);
      cg.addColorStop(0, '#bfe3f8');
      cg.addColorStop(0.5, '#e4e8b8');
      cg.addColorStop(1, '#fbe5a6');
      stroke = cg;
    }
    g.strokeStyle = stroke;
    g.beginPath();
    g.arc(cx, cy, ringR, -Math.PI / 2, -Math.PI / 2 + 6.2832 * (cyc / CYCLE_S));
    g.stroke();

    // soft white circle
    g.save();
    g.shadowColor = 'rgba(255,255,255,.95)';
    g.shadowBlur = r * 0.25;
    g.fillStyle = '#fff';
    g.beginPath(); g.arc(cx, cy, r, 0, 6.2832); g.fill();
    g.restore();

    // calm face: closed eyes and a small smile, near the top of the circle
    g.strokeStyle = '#6b6a8a';
    g.lineWidth = Math.max(3, r * 0.035);
    g.lineCap = 'round';
    const fy = cy - r * 0.45, ew = r * 0.1;
    [-1, 1].forEach((side) => {
      g.beginPath();
      g.arc(cx + side * r * 0.2, fy, ew, 0.15 * Math.PI, 0.85 * Math.PI);
      g.stroke();
    });
    g.beginPath();
    g.arc(cx, fy + r * 0.07, r * 0.13, 0.15 * Math.PI, 0.85 * Math.PI);
    g.stroke();

    // stopwatch since this Breathe session started (resets on tab switch / close)
    g.fillStyle = '#6b6a8a';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = '600 ' + Math.max(16, Math.round(maxR * 0.14)) + 'px system-ui, sans-serif';
    g.fillText(fmtClock(el_s), cx, Math.max(22, cy - ringR - maxR * 0.16));

    // phase label and seconds left
    g.fillStyle = '#5b5a80';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = '600 ' + Math.round(r * 0.17) + 'px system-ui, sans-serif';
    g.fillText(ph.label, cx, cy + r * 0.1);
    g.font = '300 ' + Math.round(r * 0.42) + 'px system-ui, sans-serif';
    g.fillText(String(Math.ceil(PHASE_S - f * PHASE_S)), cx, cy + r * 0.48);
  }

  let raf = 0;
  function frame(now) {
    raf = requestAnimationFrame(frame);
    g.setTransform(DPR, 0, 0, DPR, 0, 0);
    if (mode === 'dots') { drawDots(now / 1000); dotsClock.textContent = fmtClock((now - dotsStart) / 1000); }
    else drawBreath(now);
  }

  // ---- wiring -----------------------------------------------------------
  tabDots.addEventListener('click', () => setMode('dots'));
  tabBreath.addEventListener('click', () => setMode('breath'));
  newBtn.addEventListener('click', makeNetwork);

  function check() {
    const n = nodes.length;
    const v = parseInt(guess.value, 10);
    if (isNaN(v)) { result.textContent = 'There are ' + n + ' dots'; return; }
    const d = v - n;
    result.textContent = 'There are ' + n + ' dots' +
      (d === 0 ? ' - exact!' : ' - you were ' + Math.abs(d) + (d > 0 ? ' over' : ' under') +
        ' (' + Math.round(Math.abs(d) / n * 100) + '%)');
  }
  checkBtn.addEventListener('click', check);
  guess.addEventListener('keydown', (e) => { if (e.key === 'Enter') check(); });

  function close() { if (window.__nbr) { window.__nbr.teardown(); window.__nbr = null; } }
  closeBtn.addEventListener('click', close);
  backdrop.addEventListener('click', close);
  function onEsc(e) { if (e.key === 'Escape') close(); }
  window.addEventListener('keydown', onEsc, true);

  makeNetwork();
  setMode('breath');
  resize();
  raf = requestAnimationFrame(frame);

  window.__nbr = {
    version: VERSION,
    teardown() {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      window.removeEventListener('keydown', onEsc, true);
      host.remove();
    },
  };
})();
