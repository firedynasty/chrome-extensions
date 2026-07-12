const playBtn = document.getElementById('playBtn');
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');
const shuffleBtn = document.getElementById('shuffleBtn');
const noiseBtn = document.getElementById('noiseBtn');
const volumeSlider = document.getElementById('volume');
const trackTitle = document.getElementById('trackTitle');
const progressBar = document.getElementById('progress-bar');
const progressFill = document.getElementById('progress-fill');
const timeDisplay = document.getElementById('timeDisplay');
const statusEl = document.getElementById('status');
const trackListEl = document.getElementById('trackList');
const genreSelect = document.getElementById('genreSelect');
const albumSelect = document.getElementById('albumSelect');
const metBpmSlider = document.getElementById('metBpmSlider');
const metBpmLabel = document.getElementById('metBpmLabel');
const metVolSlider = document.getElementById('metVolSlider');
const metStartStopBtn = document.getElementById('metStartStopBtn');
const metTapBtn = document.getElementById('metTapBtn');

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

  if (state.metBpm !== undefined) {
    metBpmSlider.value = state.metBpm;
    metBpmLabel.textContent = state.metBpm;
  }
  if (state.metVolume !== undefined) {
    metVolSlider.value = state.metVolume;
  }
  metStartStopBtn.innerHTML = state.metIsPlaying ? '&#9646;&#9646; Stop (\\)' : '&#9654; Start (\\)';
  metStartStopBtn.style.background = state.metIsPlaying ? '#c9a84c' : '#2c3e50';
  metStartStopBtn.style.color = state.metIsPlaying ? '#1a1a2e' : '#fff';

  volumeSlider.value = state.volume;

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
metBpmSlider.addEventListener('input', () => {
  metBpmLabel.textContent = metBpmSlider.value;
  send({ type: 'metBpm', value: parseInt(metBpmSlider.value) });
});
metVolSlider.addEventListener('input', () => {
  send({ type: 'metVolume', value: parseInt(metVolSlider.value) });
});
metStartStopBtn.addEventListener('click', () => send({ type: 'metToggle' }));
metTapBtn.addEventListener('click', () => send({ type: 'metTap' }));

const metTempoPreset = document.getElementById('metTempoPreset');

function applyTempoPreset() {
  const val = parseInt(metTempoPreset.value);
  if (val) {
    metBpmSlider.value = val;
    metBpmLabel.textContent = val;
    send({ type: 'metBpm', value: val });
  }
}

metTempoPreset.addEventListener('change', applyTempoPreset);

document.getElementById('metTempoPrev').addEventListener('click', () => {
  const idx = metTempoPreset.selectedIndex;
  if (idx > 1) {
    metTempoPreset.selectedIndex = idx - 1;
  } else {
    metTempoPreset.selectedIndex = 1;
  }
  applyTempoPreset();
});

document.getElementById('metTempoNext').addEventListener('click', () => {
  const idx = metTempoPreset.selectedIndex;
  if (idx < metTempoPreset.options.length - 1) {
    metTempoPreset.selectedIndex = idx + 1;
  }
  applyTempoPreset();
});

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
  }
});

document.addEventListener('keydown', (e) => {
  if (e.key === '[') {
    document.getElementById('metTempoPrev').click();
  } else if (e.key === ']') {
    document.getElementById('metTempoNext').click();
  } else if (e.key === '\\') {
    metStartStopBtn.click();
  } else if (e.key === '=') {
    metBpmSlider.value = Math.min(240, parseInt(metBpmSlider.value) + 1);
    metBpmLabel.textContent = metBpmSlider.value;
    send({ type: 'metBpm', value: parseInt(metBpmSlider.value) });
  } else if (e.key === '-') {
    metBpmSlider.value = Math.max(40, parseInt(metBpmSlider.value) - 1);
    metBpmLabel.textContent = metBpmSlider.value;
    send({ type: 'metBpm', value: parseInt(metBpmSlider.value) });
  }
});

// Init dropdowns from local file, then try to get playback state
initDropdowns().then(() => {
  // Small delay to let service worker wake up
  setTimeout(() => send({ type: 'getState' }), 300);
});
