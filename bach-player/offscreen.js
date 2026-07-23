let playlists = {};
let genreNames = [];
let currentGenre = '';
let currentEntries = [];
let currentAlbumIndex = -1;
let tracks = []; // flattened track list for current album

const audio = new Audio();
let currentIndex = -1;
let isPlaying = false;
let shuffleOrder = [];
let shufflePos = -1;
let shuffleMode = false;
let playbackRate = 1;

audio.volume = 0.8;

// White noise via Web Audio API
let noiseCtx = null;
let noiseGain = null;
let noiseSource = null;
let whiteNoiseActive = false;

function initWhiteNoise() {
  if (noiseCtx) return;
  noiseCtx = new AudioContext();
  const buf = noiseCtx.createBuffer(1, noiseCtx.sampleRate * 2, noiseCtx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  noiseSource = noiseCtx.createBufferSource();
  noiseSource.buffer = buf;
  noiseSource.loop = true;
  noiseGain = noiseCtx.createGain();
  noiseGain.gain.value = 0;
  noiseSource.connect(noiseGain);
  noiseGain.connect(noiseCtx.destination);
  noiseSource.start();
}

function setNoiseVolume(vol) {
  // White noise at ~10% of music volume so it sits in background
  if (noiseGain) noiseGain.gain.value = whiteNoiseActive ? vol * 0.1 : 0;
}

function toggleWhiteNoise() {
  initWhiteNoise();
  if (noiseCtx.state === 'suspended') noiseCtx.resume();
  whiteNoiseActive = !whiteNoiseActive;
  setNoiseVolume(audio.volume);
}

// Load playlists.json on startup
fetch(chrome.runtime.getURL('playlists.json'))
  .then(r => r.json())
  .then(data => {
    playlists = data;
    genreNames = Object.keys(playlists);
    if (genreNames.length) {
      loadGenre(genreNames[0]);
    }
  });

function loadGenre(genre) {
  currentGenre = genre;
  currentEntries = playlists[genre] || [];
  currentAlbumIndex = -1;
  tracks = [];
  currentIndex = -1;
  if (currentEntries.length) {
    loadAlbum(0);
  }
}

function loadAlbum(index) {
  audio.pause();
  audio.src = '';
  isPlaying = false;
  currentAlbumIndex = index;
  const entry = currentEntries[index];
  if (!entry) return;

  // If album has tracks with timestamps, build track list from those
  const timestampTracks = (entry.tracks || []).filter(t => 'seconds' in t);
  if (timestampTracks.length > 0) {
    // Single audio file with chapter timestamps
    tracks = timestampTracks.map(t => ({
      title: t.title,
      url: entry.url,
      startTime: t.seconds
    }));
  } else {
    // Single track, no chapters
    tracks = [{ title: entry.name, url: entry.url, startTime: 0 }];
  }

  currentIndex = -1;
  shuffleOrder = [];
  shufflePos = -1;
  broadcastState();
}

function generateShuffleOrder() {
  shuffleOrder = tracks.map((_, i) => i);
  for (let i = shuffleOrder.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffleOrder[i], shuffleOrder[j]] = [shuffleOrder[j], shuffleOrder[i]];
  }
  shufflePos = -1;
}

function loadAndPlay(index) {
  currentIndex = index;
  const track = tracks[index];
  const needsNewSrc = audio.src !== track.url;

  if (needsNewSrc) {
    audio.src = track.url;
  }
  audio.playbackRate = playbackRate;
  audio.currentTime = track.startTime || 0;
  audio.play().then(() => {
    isPlaying = true;
    broadcastState();
  }).catch(() => {
    broadcastState('Error loading track');
  });
  broadcastState('Loading...');
}

function nextTrack() {
  if (tracks.length === 0) return;
  if (shuffleMode) {
    shufflePos++;
    if (shufflePos >= shuffleOrder.length) {
      generateShuffleOrder();
      shufflePos = 0;
    }
    loadAndPlay(shuffleOrder[shufflePos]);
  } else {
    const nextIdx = currentIndex + 1;
    if (nextIdx >= tracks.length) {
      // Auto-advance to next album
      if (currentAlbumIndex + 1 < currentEntries.length) {
        loadAlbum(currentAlbumIndex + 1);
        loadAndPlay(0);
      } else {
        loadAndPlay(0); // loop back to first track
      }
    } else {
      loadAndPlay(nextIdx);
    }
  }
}

function prevTrack() {
  if (tracks.length === 0) return;
  if (audio.currentTime > 3) {
    audio.currentTime = tracks[currentIndex] ? tracks[currentIndex].startTime || 0 : 0;
    return;
  }
  if (shuffleMode) {
    shufflePos--;
    if (shufflePos < 0) shufflePos = shuffleOrder.length - 1;
    loadAndPlay(shuffleOrder[shufflePos]);
  } else {
    loadAndPlay((currentIndex - 1 + tracks.length) % tracks.length);
  }
}

// For timestamp-based tracks, detect when we cross into the next chapter
function checkChapterBoundary() {
  if (currentIndex < 0 || !tracks[currentIndex]) return;
  // If next track uses same URL (same audio file, different chapter)
  const nextIdx = currentIndex + 1;
  if (nextIdx < tracks.length && tracks[nextIdx].url === tracks[currentIndex].url) {
    if (audio.currentTime >= tracks[nextIdx].startTime) {
      currentIndex = nextIdx;
      broadcastState();
    }
  }
}

function getState(status) {
  return {
    type: 'stateUpdate',
    genreNames,
    currentGenre,
    albums: currentEntries.map(e => e.name),
    currentAlbumIndex,
    currentIndex,
    isPlaying,
    shuffleMode,
    playbackRate,
    volume: Math.round(audio.volume * 100),
    currentTime: audio.currentTime || 0,
    duration: audio.duration || 0,
    trackTitle: currentIndex >= 0 && tracks[currentIndex] ? tracks[currentIndex].title : null,
    tracks: tracks.map(t => t.title),
    whiteNoise: whiteNoiseActive,
    metIsPlaying,
    metBpm,
    metVolume: Math.round(metVolume * 100),
    status: status || ''
  };
}

function broadcastState(status) {
  chrome.runtime.sendMessage(getState(status)).catch(() => {});
}

setInterval(() => {
  if (isPlaying) {
    checkChapterBoundary();
    broadcastState();
  }
}, 500);

audio.addEventListener('ended', nextTrack);

// ---- Metronome ----
let metCtx = null, metMaster = null, metNoiseBuf = null;
let metBpm = 96;
let metIsPlaying = false;
let metNextNoteTime = 0;
let metBeatIdx = 0;
let metTimer = null;
let metVolume = 0.5;
let metPattern = [true, false, false, false]; // accent on beat 1

function ensureMetAudio() {
  if (metCtx) return;
  metCtx = new AudioContext();
  metMaster = metCtx.createGain();
  metMaster.gain.value = metVolume;
  metMaster.connect(metCtx.destination);
}

function playClick(time, accent) {
  const ctx = metCtx;
  const osc = ctx.createOscillator();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(accent ? 880 : 660, time);
  osc.frequency.exponentialRampToValueAtTime(accent ? 440 : 330, time + 0.05);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, time);
  g.gain.exponentialRampToValueAtTime(accent ? 0.7 : 0.45, time + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, time + 0.08);
  osc.connect(g).connect(metMaster);
  osc.start(time);
  osc.stop(time + 0.1);
}

function metScheduler() {
  const ctx = metCtx;
  while (metNextNoteTime < ctx.currentTime + 0.1) {
    playClick(metNextNoteTime, metPattern[metBeatIdx]);
    metNextNoteTime += 60.0 / metBpm;
    metBeatIdx = (metBeatIdx + 1) % metPattern.length;
  }
}

async function metStart() {
  ensureMetAudio();
  if (metCtx.state === 'suspended') await metCtx.resume();
  metBeatIdx = 0;
  metNextNoteTime = metCtx.currentTime + 0.06;
  metTimer = setInterval(metScheduler, 25);
  metIsPlaying = true;
  broadcastState();
}

function metStop() {
  clearInterval(metTimer);
  metTimer = null;
  metIsPlaying = false;
  broadcastState();
}

let metTaps = [];

async function metTapBeat() {
  ensureMetAudio();
  if (metCtx.state === 'suspended') await metCtx.resume();
  const now = metCtx.currentTime;

  metTaps = metTaps.filter(x => now - x < 2.2);
  metTaps.push(now);

  if (metTaps.length >= 2) {
    let sum = 0;
    for (let i = 1; i < metTaps.length; i++) sum += metTaps[i] - metTaps[i - 1];
    const interval = sum / (metTaps.length - 1);
    metBpm = Math.min(240, Math.max(40, Math.round(60 / interval)));
  }

  // Play a click on tap
  playClick(now + 0.004, (metTaps.length - 1) % 4 === 0);

  // Reset scheduler to sync with tap
  const interval = 60 / metBpm;
  metNextNoteTime = now + interval;
  metBeatIdx = metTaps.length % 4;

  if (!metTimer) {
    metTimer = setInterval(metScheduler, 25);
  }
  metIsPlaying = true;
  broadcastState();
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.target !== 'offscreen') return;
  if (msg.type === 'getState') {
    sendResponse(getState());
    return;
  }
  if (msg.type === 'play') {
    if (currentIndex === -1 && tracks.length > 0) {
      nextTrack();
    } else {
      audio.play();
      isPlaying = true;
      broadcastState();
    }
  } else if (msg.type === 'pause') {
    audio.pause();
    isPlaying = false;
    broadcastState();
  } else if (msg.type === 'next') {
    nextTrack();
  } else if (msg.type === 'prev') {
    prevTrack();
  } else if (msg.type === 'shuffle') {
    shuffleMode = !shuffleMode;
    if (shuffleMode) generateShuffleOrder();
    broadcastState();
  } else if (msg.type === 'toggleNoise') {
    toggleWhiteNoise();
    broadcastState();
  } else if (msg.type === 'volume') {
    audio.volume = msg.value / 100;
    setNoiseVolume(audio.volume);
    broadcastState();
  } else if (msg.type === 'rate') {
    playbackRate = msg.value;
    audio.playbackRate = playbackRate;
    audio.defaultPlaybackRate = playbackRate;
    broadcastState();
  } else if (msg.type === 'seek') {
    if (audio.duration) {
      audio.currentTime = msg.fraction * audio.duration;
      broadcastState();
    }
  } else if (msg.type === 'playIndex') {
    loadAndPlay(msg.index);
  } else if (msg.type === 'switchGenre') {
    loadGenre(msg.name);
    broadcastState();
  } else if (msg.type === 'switchAlbum') {
    loadAlbum(msg.index);
    broadcastState();
  } else if (msg.type === 'metToggle') {
    if (metIsPlaying) metStop(); else metStart();
  } else if (msg.type === 'metTap') {
    metTapBeat();
  } else if (msg.type === 'metBpm') {
    metBpm = msg.value;
    broadcastState();
  } else if (msg.type === 'metVolume') {
    metVolume = msg.value / 100;
    if (metMaster) metMaster.gain.value = metVolume;
    broadcastState();
  }
});
