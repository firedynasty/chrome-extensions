const playBtn = document.getElementById('playBtn');
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');
const shuffleBtn = document.getElementById('shuffleBtn');
const noiseBtn = document.getElementById('noiseBtn');
const noiseVolLabel = document.getElementById('noiseVolLabel');
let noiseVolPct = 1;
const volumeSlider = document.getElementById('volume');
const trackTitle = document.getElementById('trackTitle');
const progressBar = document.getElementById('progress-bar');
const progressFill = document.getElementById('progress-fill');
const timeDisplay = document.getElementById('timeDisplay');
const statusEl = document.getElementById('status');
const trackListEl = document.getElementById('trackList');
const genreSelect = document.getElementById('genreSelect');
const albumSelect = document.getElementById('albumSelect');
const rateLabel = document.getElementById('rateLabel');
const rateDownBtn = document.getElementById('rateDown');
const rateUpBtn = document.getElementById('rateUp');
const timer3minBtn = document.getElementById('timer3minBtn');
const ytLink = document.getElementById('ytLink');
const ytAnchor = document.getElementById('ytAnchor');

const RATES = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];
let currentRate = 1;

let lastIsPlaying = false;

function formatTime(secs) {
  if (isNaN(secs)) return '0:00';
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function applyState(state) {
  if (!state || state.type !== 'stateUpdate') return;

  lastIsPlaying = state.isPlaying;
  trackTitle.textContent = state.trackTitle || 'Click play to start';
  if (state.youtubeId) {
    ytAnchor.href = `https://www.youtube.com/watch?v=${state.youtubeId}`;
    ytLink.style.display = 'block';
  } else {
    ytLink.style.display = 'none';
  }
  playBtn.innerHTML = state.isPlaying ? '&#9646;&#9646;' : '&#9654;';

  if (state.shuffleMode) {
    shuffleBtn.style.background = '#c9a84c';
    shuffleBtn.style.color = '#1a1a2e';
  } else {
    shuffleBtn.style.background = '#2c3e50';
    shuffleBtn.style.color = '#fff';
  }

  if (state.whiteNoise) {
    noiseBtn.style.background = '#c9a84c';
    noiseBtn.style.color = '#1a1a2e';
  } else {
    noiseBtn.style.background = '#2c3e50';
    noiseBtn.style.color = '#fff';
  }

  if (state.noiseVolume !== undefined) {
    noiseVolPct = state.noiseVolume;
    noiseVolLabel.textContent = state.noiseVolume + '%';
  }

  volumeSlider.value = state.volume;

  if (state.playbackRate !== undefined) {
    currentRate = state.playbackRate;
    rateLabel.textContent = state.playbackRate + 'x';
  }

  if (state.timer3min && state.timer3min.active) {
    timer3minBtn.textContent = `⏹️ ${state.timer3min.currentLoop}/${state.timer3min.totalLoops}`;
    timer3minBtn.style.background = 'linear-gradient(45deg, #FF5722, #E64A19)';
  } else {
    timer3minBtn.textContent = '⏱️ 30s';
    timer3minBtn.style.background = 'linear-gradient(45deg,#ff9800,#f57c00)';
  }

  if (state.duration) {
    const pct = (state.currentTime / state.duration) * 100;
    progressFill.style.width = pct + '%';
    timeDisplay.textContent = `${formatTime(state.currentTime)} / ${formatTime(state.duration)}`;
  } else {
    progressFill.style.width = '0%';
    timeDisplay.textContent = '0:00 / 0:00';
  }

  statusEl.textContent = state.status || '';

  // Sync genre dropdown selection
  if (state.currentGenre && genreSelect.value !== state.currentGenre) {
    genreSelect.value = state.currentGenre;
  }

  // Sync album dropdown
  if (state.currentAlbumIndex >= 0) {
    albumSelect.value = state.currentAlbumIndex;
  }

  if (state.tracks) {
    trackListEl.innerHTML = state.tracks.map((title, i) =>
      `<div class="track-item${i === state.currentIndex ? ' active' : ''}" data-index="${i}">${title}</div>`
    ).join('');
    trackListEl.querySelectorAll('.track-item').forEach(el => {
      el.addEventListener('click', () => {
        send({ type: 'playIndex', index: parseInt(el.dataset.index) });
      });
    });
  }
}

async function send(msg) {
  try {
    const response = await chrome.runtime.sendMessage(msg);
    if (response && response.type === 'stateUpdate') applyState(response);
  } catch (e) {
    // Service worker not ready yet — ignore
  }
}

// Load playlists.json directly in popup to populate dropdowns immediately
async function initDropdowns() {
  try {
    const resp = await fetch('playlists.json');
    const playlists = await resp.json();
    const genres = Object.keys(playlists);

    genreSelect.innerHTML = genres.map(g =>
      `<option value="${g}">${g.charAt(0).toUpperCase() + g.slice(1)}</option>`
    ).join('');

    function loadAlbumOptions(genre) {
      const entries = playlists[genre] || [];
      albumSelect.innerHTML = entries.map((e, i) =>
        `<option value="${i}">${e.name}</option>`
      ).join('');
    }

    genreSelect.addEventListener('change', () => {
      loadAlbumOptions(genreSelect.value);
      chrome.storage.local.set({ bachGenre: genreSelect.value, bachAlbum: 0 });
      send({ type: 'switchGenre', name: genreSelect.value });
    });

    albumSelect.addEventListener('change', () => {
      chrome.storage.local.set({ bachAlbum: parseInt(albumSelect.value) });
      send({ type: 'switchAlbum', index: parseInt(albumSelect.value) });
    });

    // Restore saved dropdown selection
    const saved = await chrome.storage.local.get(['bachGenre', 'bachAlbum']);
    const savedGenre = saved.bachGenre && genres.includes(saved.bachGenre) ? saved.bachGenre : genres[0];
    genreSelect.value = savedGenre;
    loadAlbumOptions(savedGenre);
    if (saved.bachAlbum !== undefined) {
      albumSelect.value = saved.bachAlbum;
    }
  } catch (e) {
    statusEl.textContent = 'Error loading playlists';
  }
}

playBtn.addEventListener('click', () => {
  if (lastIsPlaying) {
    send({ type: 'pause' });
  } else {
    send({ type: 'play' });
  }
});

nextBtn.addEventListener('click', () => send({ type: 'next' }));
prevBtn.addEventListener('click', () => send({ type: 'prev' }));
shuffleBtn.addEventListener('click', () => send({ type: 'shuffle' }));
noiseBtn.addEventListener('click', () => send({ type: 'toggleNoise' }));

function adjustNoiseVol(delta) {
  noiseVolPct = Math.min(100, Math.max(0, noiseVolPct + delta));
  noiseVolLabel.textContent = noiseVolPct + '%';
  send({ type: 'noiseVolume', value: noiseVolPct });
}
document.getElementById('noiseVolDown').addEventListener('click', () => adjustNoiseVol(-1));
document.getElementById('noiseVolUp').addEventListener('click', () => adjustNoiseVol(1));
volumeSlider.addEventListener('input', () => {
  send({ type: 'volume', value: parseInt(volumeSlider.value) });
});

progressBar.addEventListener('click', (e) => {
  const rect = progressBar.getBoundingClientRect();
  const fraction = (e.clientX - rect.left) / rect.width;
  send({ type: 'seek', fraction });
});

// Listen for state broadcasts from offscreen
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'stateUpdate') {
    applyState(msg);
  } else if (msg.type === 'beatsStep') {
    beatsMarkStep(msg.stepIdx);
  }
});

function adjustVolume(delta) {
  volumeSlider.value = Math.min(100, Math.max(0, parseInt(volumeSlider.value) + delta));
  send({ type: 'volume', value: parseInt(volumeSlider.value) });
}

function stepRate(delta) {
  let i = RATES.indexOf(currentRate);
  if (i === -1) i = RATES.indexOf(1);
  i = Math.min(RATES.length - 1, Math.max(0, i + delta));
  currentRate = RATES[i];
  rateLabel.textContent = currentRate + 'x';
  send({ type: 'rate', value: currentRate });
}

rateDownBtn.addEventListener('click', () => stepRate(-1));
rateUpBtn.addEventListener('click', () => stepRate(1));
timer3minBtn.addEventListener('click', () => send({ type: 'timer3minToggle' }));

document.addEventListener('keydown', (e) => {
  if (e.key === '0') {
    playBtn.click();
  } else if (e.key === '=' || e.key === '+') {
    adjustVolume(5);
  } else if (e.key === '-' || e.key === '_') {
    adjustVolume(-5);
  } else if (e.key === ',') {
    stepRate(-1);
  } else if (e.key === '.') {
    stepRate(1);
  }
});

// Init dropdowns from local file, then try to get playback state
initDropdowns().then(() => {
  // Small delay to let service worker wake up
  setTimeout(() => send({ type: 'getState' }), 300);
});

// ── Beats Maker ──────────────────────────────────────────────────────────────

const BEATS_TRACKS = ['kick','snare','hat','crash','tone'];
const BEATS_LABELS = {kick:'Kick',snare:'Snare',hat:'Hat',crash:'Gong',tone:'Tone'};
const BEATS_COLORS = {
  kick:'#c9a84c', snare:'#e74c3c', hat:'#7fa695', crash:'#8a8f9c', tone:'#c9b25e'
};

let beatsPresets = [];
let beatsCurrentGrid = null;
let beatsDisplayStep = -1;

// ── Storage helpers ───────────────────────────────────────────────────────────

async function saveBeatsPresets(arr) {
  await chrome.storage.local.set({ beatsPresets: arr });
}
async function loadBeatsPresetsFromStorage() {
  const r = await chrome.storage.local.get('beatsPresets');
  return r.beatsPresets || [];
}

async function saveBeatsLiveState() {
  if (!beatsCurrentGrid) return;
  const bpm = parseInt(document.getElementById('beatsBpmSlider').value);
  chrome.storage.local.set({ beatsLiveGrid: beatsCurrentGrid, beatsLiveBpm: bpm }).catch(() => {});
}

// ── 16-step → 8-step conversion ───────────────────────────────────────────────

function compress16to8(arr16) {
  const seen = new Set();
  const out = new Array(8).fill(0);
  arr16.forEach((v, i) => {
    if (v) {
      const i8 = Math.floor(i / 2);
      if (!seen.has(i8)) { seen.add(i8); out[i8] = 1; }
    }
  });
  return out;
}

function normalisePreset(p) {
  const grid = {};
  BEATS_TRACKS.forEach(t => {
    const raw = p[t] || [];
    grid[t] = raw.length === 8 ? [...raw] : compress16to8(raw);
  });
  return { name: p.name || 'Untitled', bpm: p.bpm || 120, desc: p.desc || '', grid };
}

// ── Preset dropdown ───────────────────────────────────────────────────────────

function populateBeatsDropdown() {
  const sel = document.getElementById('beatsPresetSelect');
  sel.innerHTML = beatsPresets.length
    ? beatsPresets.map((p,i) => `<option value="${i}">${i} — ${p.name}</option>`).join('')
    : '<option value="">— load presets.json —</option>';
}

async function initBeats() {
  beatsPresets = await loadBeatsPresetsFromStorage();
  populateBeatsDropdown();
  const saved = await chrome.storage.local.get(['beatsLiveGrid', 'beatsLiveBpm']);
  if (saved.beatsLiveGrid) {
    beatsCurrentGrid = saved.beatsLiveGrid;
    const bpm = saved.beatsLiveBpm || 120;
    document.getElementById('beatsBpmSlider').value = bpm;
    document.getElementById('beatsBpmLabel').textContent = bpm;
    renderBeatsGrid();
    send({ type: 'beatsLoadGrid', grid: beatsCurrentGrid, bpm });
  } else if (beatsPresets.length) {
    selectBeatsPreset(0);
  }
}

function selectBeatsPreset(idx) {
  const p = beatsPresets[idx];
  if (!p) return;
  beatsCurrentGrid = p.grid;
  document.getElementById('beatsBpmSlider').value = p.bpm;
  document.getElementById('beatsBpmLabel').textContent = p.bpm;
  renderBeatsGrid();
  send({ type: 'beatsLoadGrid', grid: beatsCurrentGrid, bpm: p.bpm });
  saveBeatsLiveState();
}

// ── Grid render ───────────────────────────────────────────────────────────────

function renderBeatsGrid() {
  const el = document.getElementById('beatsGrid');
  if (!el) return;
  if (!beatsCurrentGrid) { el.innerHTML = ''; return; }

  el.innerHTML = '';
  BEATS_TRACKS.forEach(track => {
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;gap:4px;margin-bottom:3px;';

    const label = document.createElement('div');
    label.style.cssText = 'width:34px;flex-shrink:0;font-size:9px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:#555;';
    label.textContent = BEATS_LABELS[track];
    row.appendChild(label);

    // 2 groups of 4
    for (let g = 0; g < 2; g++) {
      const group = document.createElement('div');
      group.style.cssText = 'display:flex;gap:3px;flex:1;';
      for (let s = 0; s < 4; s++) {
        const stepIdx = g*4+s;
        const cell = document.createElement('div');
        const on = beatsCurrentGrid[track][stepIdx];
        cell.dataset.track = track;
        cell.dataset.step = stepIdx;
        cell.style.cssText = `flex:1;height:22px;border-radius:3px;cursor:pointer;transition:background .06s;` +
          `background:${on ? BEATS_COLORS[track] : 'rgba(255,255,255,0.04)'};` +
          `box-shadow:${on ? `0 0 5px ${BEATS_COLORS[track]}88` : 'none'};`;
        cell.addEventListener('click', () => {
          beatsCurrentGrid[track][stepIdx] = beatsCurrentGrid[track][stepIdx] ? 0 : 1;
          renderBeatsGrid();
          send({ type: 'beatsLoadGrid', grid: beatsCurrentGrid, bpm: parseInt(document.getElementById('beatsBpmSlider').value) });
          saveBeatsLiveState();
        });
        group.appendChild(cell);
      }
      if (g === 0) {
        const gap = document.createElement('div');
        gap.style.cssText = 'width:4px;flex-shrink:0;';
        row.appendChild(group);
        row.appendChild(gap);
      } else {
        row.appendChild(group);
      }
    }
    el.appendChild(row);
  });

  beatsMarkStep(beatsDisplayStep);
}

function beatsMarkStep(stepIdx) {
  beatsDisplayStep = stepIdx;
  document.querySelectorAll('#beatsGrid [data-step]').forEach(cell => {
    const s = parseInt(cell.dataset.step);
    const track = cell.dataset.track;
    const on = beatsCurrentGrid && beatsCurrentGrid[track][s];
    if (s === stepIdx) {
      cell.style.outline = '2px solid #81C784';
      cell.style.outlineOffset = '1px';
    } else {
      cell.style.outline = 'none';
      cell.style.background = on ? BEATS_COLORS[track] : 'rgba(255,255,255,0.04)';
    }
  });
}

// ── File import ───────────────────────────────────────────────────────────────

document.getElementById('beatsLoadBtn').addEventListener('click', () => {
  document.getElementById('beatsFileInput').click();
});

document.getElementById('beatsFileInput').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const statusEl = document.getElementById('beatsStatus');
  statusEl.textContent = 'Parsing…';
  try {
    const raw = JSON.parse(await file.text());
    if (!Array.isArray(raw)) throw new Error('Expected a JSON array');
    beatsPresets = raw.map(normalisePreset);
    await saveBeatsPresets(beatsPresets);
    populateBeatsDropdown();
    if (beatsPresets.length) selectBeatsPreset(0);
    statusEl.textContent = `✓ ${beatsPresets.length} presets loaded`;
    setTimeout(() => { statusEl.textContent = ''; }, 2500);
  } catch (err) {
    statusEl.textContent = '✗ ' + err.message;
  }
  e.target.value = '';
});

document.getElementById('beatsDbxLoadBtn').addEventListener('click', async () => {
  const statusEl = document.getElementById('beatsStatus');
  const token = await getDbxToken();
  if (!token) { statusEl.textContent = '✗ Set Dropbox token first'; setTimeout(() => { statusEl.textContent = ''; }, 2500); return; }
  statusEl.textContent = 'Downloading…';
  try {
    const raw = JSON.parse(await dbxDownload(token, DROPBOX_PRESETS_PATH));
    if (!Array.isArray(raw)) throw new Error('Expected a JSON array');
    beatsPresets = raw.map(normalisePreset);
    await saveBeatsPresets(beatsPresets);
    populateBeatsDropdown();
    if (beatsPresets.length) selectBeatsPreset(0);
    statusEl.textContent = `✓ ${beatsPresets.length} presets from Dropbox`;
  } catch (err) {
    statusEl.textContent = '✗ ' + err.message;
  }
  setTimeout(() => { statusEl.textContent = ''; }, 2500);
});

// ── Controls ──────────────────────────────────────────────────────────────────

document.getElementById('beatsPanelToggleBtn').addEventListener('click', () => {
  const panel = document.getElementById('beatsPanel');
  const btn = document.getElementById('beatsPanelToggleBtn');
  const open = panel.style.display === 'none';
  panel.style.display = open ? 'block' : 'none';
  btn.textContent = (open ? '▼' : '▶') + ' Beats Maker';
});

document.getElementById('beatsPresetSelect').addEventListener('change', (e) => {
  const idx = parseInt(e.target.value);
  if (!isNaN(idx)) selectBeatsPreset(idx);
});

document.getElementById('beatsPlayBtn').addEventListener('click', () => {
  send({ type: 'beatsToggle' });
});

document.getElementById('beatsBpmSlider').addEventListener('input', (e) => {
  const val = parseInt(e.target.value);
  document.getElementById('beatsBpmLabel').textContent = val;
  send({ type: 'beatsBpm', value: val });
  saveBeatsLiveState();
});

document.getElementById('beatsVolSlider').addEventListener('input', (e) => {
  send({ type: 'beatsVolume', value: parseInt(e.target.value) });
});

// ── Sync beats state from offscreen ──────────────────────────────────────────

const _origApplyState = applyState;
// Patch applyState to also handle beats fields
const _patchedApplyState = function(state) {
  _origApplyState(state);
  if (state.beatsIsPlaying !== undefined) {
    const btn = document.getElementById('beatsPlayBtn');
    if (btn) {
      btn.textContent = state.beatsIsPlaying ? '⏸' : '▶';
      btn.style.background = state.beatsIsPlaying ? '#555' : '#c9a84c';
      btn.style.color = state.beatsIsPlaying ? '#fff' : '#1a1a2e';
    }
  }
  if (state.beatsBpm !== undefined) {
    const sl = document.getElementById('beatsBpmSlider');
    const lb = document.getElementById('beatsBpmLabel');
    if (sl) sl.value = state.beatsBpm;
    if (lb) lb.textContent = state.beatsBpm;
  }
  if (state.beatsVolume !== undefined) {
    const sl = document.getElementById('beatsVolSlider');
    if (sl) sl.value = state.beatsVolume;
  }
};
// Override applyState globally for beats fields
window.applyState = _patchedApplyState;
// Re-wire the message listener to use the patched version
// (the listener already captured applyState by reference via the closure above,
//  so we also patch the stateUpdate branch directly)
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'stateUpdate') _patchedApplyState(msg);
});

// ── Dropbox integration ───────────────────────────────────────────────────────

const DROPBOX_PRESETS_PATH = '/vercel/presets_8steps.json';

async function getDbxToken() {
  const r = await chrome.storage.local.get('beatsDbxToken');
  return r.beatsDbxToken || null;
}

async function dbxDownload(token, path) {
  const res = await fetch('https://content.dropboxapi.com/2/files/download', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + token,
      'Dropbox-API-Arg': JSON.stringify({ path }),
    },
  });
  if (!res.ok) throw new Error('Dropbox download failed: ' + res.status);
  return res.text();
}

async function dbxUpload(token, path, content) {
  const res = await fetch('https://content.dropboxapi.com/2/files/upload', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + token,
      'Dropbox-API-Arg': JSON.stringify({ path, mode: { '.tag': 'overwrite' }, mute: true }),
      'Content-Type': 'application/octet-stream',
    },
    body: content,
  });
  if (!res.ok) throw new Error('Dropbox upload failed: ' + res.status);
}

async function initDbxTokenUI() {
  const token = await getDbxToken();
  const input = document.getElementById('beatsDbxToken');
  if (token) input.placeholder = '● token set';
}

document.getElementById('beatsDbxSetBtn').addEventListener('click', async () => {
  const input = document.getElementById('beatsDbxToken');
  const token = input.value.trim();
  const statusEl = document.getElementById('beatsStatus');
  if (!token) { statusEl.textContent = '✗ Paste a token first'; setTimeout(() => { statusEl.textContent = ''; }, 2000); return; }
  await chrome.storage.local.set({ beatsDbxToken: token });
  input.value = '';
  input.placeholder = '● token set';
  statusEl.textContent = '✓ Token saved';
  setTimeout(() => { statusEl.textContent = ''; }, 1500);
});

document.getElementById('beatsDbxSaveBtn').addEventListener('click', async () => {
  const statusEl = document.getElementById('beatsStatus');
  const token = await getDbxToken();
  if (!token) { statusEl.textContent = '✗ Set Dropbox token first'; setTimeout(() => { statusEl.textContent = ''; }, 2500); return; }
  if (!beatsCurrentGrid) { statusEl.textContent = '✗ No preset loaded'; setTimeout(() => { statusEl.textContent = ''; }, 2000); return; }

  const selEl = document.getElementById('beatsPresetSelect');
  const idx = parseInt(selEl.value);
  const baseName = (!isNaN(idx) && beatsPresets[idx]) ? beatsPresets[idx].name : 'Untitled';
  const bpm = parseInt(document.getElementById('beatsBpmSlider').value);
  const replaceInput = document.getElementById('beatsDbxReplaceName');
  const replaceName = replaceInput.value.trim();

  statusEl.textContent = 'Uploading…';
  try {
    // Download freshest copy so concurrent browser saves aren't lost
    let arr = [];
    try { arr = JSON.parse(await dbxDownload(token, DROPBOX_PRESETS_PATH)); } catch (_) {}
    if (!Array.isArray(arr)) arr = [];

    let saveName;
    const entry = { bpm, desc: '', ...Object.fromEntries(BEATS_TRACKS.map(t => [t, [...beatsCurrentGrid[t]]])) };

    if (replaceName) {
      // Replace mode: find by name and overwrite; append if not found
      saveName = replaceName;
      entry.name = saveName;
      const i = arr.findIndex(p => p.name === replaceName);
      if (i !== -1) arr[i] = entry;
      else arr.push(entry);
      replaceInput.value = '';
    } else {
      // Append mode: use "{name} -- edited"
      saveName = baseName.endsWith(' -- edited') ? baseName : baseName + ' -- edited';
      entry.name = saveName;
      arr.push(entry);
    }

    await dbxUpload(token, DROPBOX_PRESETS_PATH, JSON.stringify(arr, null, 2));

    // Sync to local storage so dropdown updates immediately
    beatsPresets = arr.map(normalisePreset);
    await saveBeatsPresets(beatsPresets);
    populateBeatsDropdown();
    selEl.value = beatsPresets.length - 1;

    statusEl.textContent = replaceName ? `✓ Replaced "${saveName}"` : `✓ Appended "${saveName}"`;
  } catch (err) {
    statusEl.textContent = '✗ ' + err.message;
  }
  setTimeout(() => { statusEl.textContent = ''; }, 3000);
});

// ── Boot ──────────────────────────────────────────────────────────────────────
initBeats();
initDbxTokenUI();
