const noiseBtn = document.getElementById('noiseBtn');
const noiseVolLabel = document.getElementById('noiseVolLabel');
let noiseVolPct = 1;
const trackTitle = document.getElementById('trackTitle');
const statusEl = document.getElementById('status');
const trackListEl = document.getElementById('trackList');
const genreSelect = document.getElementById('genreSelect');
const albumSelect = document.getElementById('albumSelect');
const ytLink = document.getElementById('ytLink');
const ytAnchor = document.getElementById('ytAnchor');
ytAnchor.addEventListener('click', (e) => {
  e.preventDefault();
  const url = ytAnchor.href;
  if (url && url !== location.href) {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) chrome.tabs.update(tabs[0].id, { url });
    });
  }
});

let currentPlaylists = null;

function renderTrackList(tracks) {
  trackListEl.innerHTML = tracks.map((t, i) => {
    const title = typeof t === 'object' ? t.title : t;
    const ytId  = typeof t === 'object' ? (t.youtubeId || '') : '';
    const secs  = typeof t === 'object' ? (t.seconds || 0) : 0;
    return `<div class="track-item" data-index="${i}" data-ytid="${ytId}" data-secs="${Math.floor(secs)}">${title}</div>`;
  }).join('');
  trackListEl.querySelectorAll('.track-item').forEach(el => {
    el.addEventListener('click', () => {
      const ytId = el.dataset.ytid;
      const secs = el.dataset.secs || '0';
      if (ytId) {
        const url = `https://www.youtube.com/watch?v=${ytId}&t=${secs}s`;
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          if (tabs[0]) chrome.tabs.update(tabs[0].id, { url });
        });
      }
    });
  });
}

function loadTrackListForAlbum() {
  const genre = genreSelect.value;
  const idx = parseInt(albumSelect.value) || 0;
  const entry = currentPlaylists && (currentPlaylists[genre] || [])[idx];
  if (!entry) return;
  if (entry.tracks && entry.tracks.length > 0) {
    renderTrackList(entry.tracks.map(t => ({ title: t.title, youtubeId: entry.youtubeId, seconds: t.seconds || 0 })));
  } else {
    renderTrackList([{ title: entry.name, youtubeId: entry.youtubeId, seconds: 0 }]);
  }
}

function showYouTubeLinkForAlbum() {
  const genre = genreSelect.value;
  const idx = parseInt(albumSelect.value) || 0;
  const entry = currentPlaylists && (currentPlaylists[genre] || [])[idx];
  if (entry && entry.youtubeId) {
    const url = `https://www.youtube.com/watch?v=${entry.youtubeId}`;
    ytAnchor.href = url;
    ytLink.style.display = 'block';
    navigator.clipboard.writeText(url).then(() => {
      statusEl.textContent = 'Link copied!';
      setTimeout(() => { statusEl.textContent = ''; }, 1500);
    }).catch(() => {});
  }
}


function applyState(state) {
  if (!state || state.type !== 'stateUpdate') return;

  trackTitle.textContent = state.trackTitle || '';
  if (state.youtubeId) {
    ytAnchor.href = `https://www.youtube.com/watch?v=${state.youtubeId}`;
    ytLink.style.display = 'block';
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



  statusEl.textContent = state.status || '';

  // Sync genre dropdown selection
  if (state.currentGenre && genreSelect.value !== state.currentGenre) {
    genreSelect.value = state.currentGenre;
  }

  // Sync album dropdown
  if (state.currentAlbumIndex >= 0) {
    albumSelect.value = state.currentAlbumIndex;
  }

  if (state.currentIndex >= 0) {
    trackListEl.querySelectorAll('.track-item').forEach((el, i) => {
      el.classList.toggle('active', i === state.currentIndex);
    });
  }

  if (state.natureIsPlaying !== undefined) {
    const btn = document.getElementById('natureToggleBtn');
    if (btn) {
      btn.textContent = state.natureIsPlaying ? '⏸' : '▶';
      btn.style.background = state.natureIsPlaying ? '#555' : '#c9a84c';
      btn.style.color = state.natureIsPlaying ? '#fff' : '#1a1a2e';
    }
  }
  if (state.natureVolumes !== undefined) {
    NATURE_TRACK_IDS.forEach(id => {
      const sl = document.getElementById(NATURE_SLIDER_IDS[id]);
      if (sl && state.natureVolumes[id] !== undefined) sl.value = state.natureVolumes[id];
    });
  }
  if (state.natureErrors !== undefined) {
    NATURE_TRACK_IDS.forEach(id => {
      const err = document.getElementById(NATURE_ERROR_IDS[id]);
      if (err) err.style.display = state.natureErrors[id] ? 'inline' : 'none';
    });
  }
  if (state.natureActiveGroup !== undefined) {
    natureActiveGroup = state.natureActiveGroup;
    const forestBtn = document.getElementById('natureGroupForestBtn');
    const stormBtn = document.getElementById('natureGroupStormBtn');
    const active = { background: '#c9a84c', color: '#1a1a2e' };
    const inactive = { background: '#16213e', color: '#888' };
    if (forestBtn) Object.assign(forestBtn.style, natureActiveGroup === 'forest' ? active : inactive);
    if (stormBtn) Object.assign(stormBtn.style, natureActiveGroup === 'storm' ? active : inactive);
    NATURE_TRACK_IDS.forEach(id => {
      const row = document.getElementById(NATURE_ROW_IDS[id]);
      if (row) row.style.opacity = (NATURE_TRACK_GROUP[id] === natureActiveGroup) ? '1' : '0.4';
    });
  }
  if (state.natureIsPlaying !== undefined || state.natureVolumes !== undefined || state.natureActiveGroup !== undefined) {
    saveNatureMixState();
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

// Load playlists — check chrome.storage.local first, fall back to bundled file
async function initDropdowns() {
  try {
    let playlists;
    const stored = await chrome.storage.local.get('bachPlaylists');
    if (stored.bachPlaylists && typeof stored.bachPlaylists === 'object' && !Array.isArray(stored.bachPlaylists)) {
      playlists = stored.bachPlaylists;
    } else {
      const resp = await fetch('playlists.json');
      playlists = await resp.json();
    }
    currentPlaylists = playlists;
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
      loadTrackListForAlbum();
      showYouTubeLinkForAlbum();
    });

    albumSelect.addEventListener('change', () => {
      chrome.storage.local.set({ bachAlbum: parseInt(albumSelect.value) });
      send({ type: 'switchAlbum', index: parseInt(albumSelect.value) });
      loadTrackListForAlbum();
      showYouTubeLinkForAlbum();
    });

    // Restore saved dropdown selection
    const saved = await chrome.storage.local.get(['bachGenre', 'bachAlbum']);
    const savedGenre = saved.bachGenre && genres.includes(saved.bachGenre) ? saved.bachGenre : genres[0];
    genreSelect.value = savedGenre;
    loadAlbumOptions(savedGenre);
    if (saved.bachAlbum !== undefined) {
      albumSelect.value = saved.bachAlbum;
    }
    loadTrackListForAlbum();
    showYouTubeLinkForAlbum();
  } catch (e) {
    statusEl.textContent = 'Error loading playlists';
  }
}

noiseBtn.addEventListener('click', () => send({ type: 'toggleNoise' }));

function adjustNoiseVol(delta) {
  noiseVolPct = Math.min(100, Math.max(0, noiseVolPct + delta));
  noiseVolLabel.textContent = noiseVolPct + '%';
  send({ type: 'noiseVolume', value: noiseVolPct });
}
document.getElementById('noiseVolDown').addEventListener('click', () => adjustNoiseVol(-1));
document.getElementById('noiseVolUp').addEventListener('click', () => adjustNoiseVol(1));
// Listen for state broadcasts from offscreen
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'stateUpdate') {
    applyState(msg);
  }
});


document.getElementById('accessLinkBtn').addEventListener('click', showYouTubeLinkForAlbum);

// Init dropdowns from local file, then try to get playback state
initDropdowns().then(() => {
  // Small delay to let service worker wake up
  setTimeout(() => send({ type: 'getState' }), 300);
});

// ── Nature Sounds Mixer ──────────────────────────────────────────────────────

const NATURE_TRACK_IDS = ['rain', 'birds', 'wind', 'thunder', 'ocean'];
const NATURE_SLIDER_IDS = {
  rain: 'natureVolRain', birds: 'natureVolBirds', wind: 'natureVolWind',
  thunder: 'natureVolThunder', ocean: 'natureVolOcean'
};
const NATURE_ERROR_IDS = {
  rain: 'natureErrorRain', birds: 'natureErrorBirds', wind: 'natureErrorWind',
  thunder: 'natureErrorThunder', ocean: 'natureErrorOcean'
};
const NATURE_ROW_IDS = {
  rain: 'natureRowRain', birds: 'natureRowBirds', wind: 'natureRowWind',
  thunder: 'natureRowThunder', ocean: 'natureRowOcean'
};
const NATURE_TRACK_GROUP = {
  rain: 'forest', birds: 'forest', wind: 'forest',
  thunder: 'storm', ocean: 'storm'
};

let natureActiveGroup = 'forest';

function saveNatureMixState() {
  const btn = document.getElementById('natureToggleBtn');
  const isPlaying = !!btn && btn.textContent === '⏸';
  const volumes = {};
  NATURE_TRACK_IDS.forEach(id => {
    const sl = document.getElementById(NATURE_SLIDER_IDS[id]);
    volumes[id] = sl ? parseInt(sl.value) : 100;
  });
  chrome.storage.local.set({ natureMix: { isPlaying, volumes, activeGroup: natureActiveGroup } }).catch(() => {});
}

document.getElementById('natureSoundsPanelToggleBtn').addEventListener('click', () => {
  const panel = document.getElementById('natureSoundsPanel');
  const btn = document.getElementById('natureSoundsPanelToggleBtn');
  const open = panel.style.display === 'none';
  panel.style.display = open ? 'block' : 'none';
  btn.textContent = (open ? '▼' : '▶') + ' Nature Sounds';
});

document.getElementById('natureToggleBtn').addEventListener('click', () => {
  send({ type: 'natureToggle' });
});

document.getElementById('natureGroupForestBtn').addEventListener('click', () => {
  if (natureActiveGroup !== 'forest') send({ type: 'natureGroupToggle' });
});

document.getElementById('natureGroupStormBtn').addEventListener('click', () => {
  if (natureActiveGroup !== 'storm') send({ type: 'natureGroupToggle' });
});

NATURE_TRACK_IDS.forEach(id => {
  document.getElementById(NATURE_SLIDER_IDS[id]).addEventListener('input', (e) => {
    send({ type: 'natureVolume', track: id, value: parseInt(e.target.value) });
  });
});

// Playlist file picker
document.getElementById('playlistLoadBtn').addEventListener('click', () => {
  document.getElementById('playlistFileInput').click();
});

document.getElementById('playlistFileInput').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const st = document.getElementById('playlistStatus');
  st.textContent = 'Loading\u2026';
  try {
    const raw = JSON.parse(await file.text());
    if (typeof raw !== 'object' || Array.isArray(raw)) throw new Error('Expected a JSON object with categories');
    await chrome.storage.local.set({ bachPlaylists: raw });
    await send({ type: 'loadPlaylists', playlists: raw });
    await initDropdowns();
    st.textContent = `\u2713 ${Object.keys(raw).length} categories loaded`;
  } catch (err) {
    st.textContent = '\u2717 ' + err.message;
  }
  setTimeout(() => { document.getElementById('playlistStatus').textContent = ''; }, 3000);
  e.target.value = '';
});

document.getElementById('playlistClearBtn').addEventListener('click', async () => {
  const st = document.getElementById('playlistStatus');
  await chrome.storage.local.remove('bachPlaylists');
  const resp = await fetch('playlists.json');
  const bundled = await resp.json();
  await send({ type: 'loadPlaylists', playlists: bundled });
  await initDropdowns();
  st.textContent = '\u2713 Reverted to built-in';
  setTimeout(() => { st.textContent = ''; }, 2000);
});
