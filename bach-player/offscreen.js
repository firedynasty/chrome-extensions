let playlists = {};
let genreNames = [];
let currentGenre = '';
let currentEntries = [];
let currentAlbumIndex = -1;
let tracks = []; // flattened track list for current album

// YouTube player state (postMessage-based, no external script)
let ytFrame = null;
let playerReady = false;
let pendingPlayOnReady = false; // true when we need to call playVideo after onReady
let currentVideoId = null;
let currentTime = 0;
let duration = 0;
let volume = 80; // 0-100

let currentIndex = -1;
let isPlaying = false;
let shuffleOrder = [];
let shufflePos = -1;
let shuffleMode = false;
let playbackRate = 1;

// White noise via Web Audio API
let noiseCtx = null;
let noiseGain = null;
let noiseSource = null;
let whiteNoiseActive = false;
let noiseVolume = 0.01;

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

function setNoiseVolume() {
  if (noiseGain) noiseGain.gain.value = whiteNoiseActive ? noiseVolume : 0;
}

function toggleWhiteNoise() {
  initWhiteNoise();
  if (noiseCtx.state === 'suspended') noiseCtx.resume();
  whiteNoiseActive = !whiteNoiseActive;
  setNoiseVolume();
}

// ---- YouTube player via direct iframe + postMessage ----
// No external script needed. The YouTube embed at /embed/ID?enablejsapi=1
// accepts JSON commands via postMessage and sends back state events.

function createYTFrame(videoId, startSeconds) {
  const old = document.getElementById('yt-frame');
  if (old) old.remove();
  playerReady = false;
  currentTime = 0;
  duration = 0;

  const iframe = document.createElement('iframe');
  iframe.id = 'yt-frame';
  iframe.allow = 'autoplay';
  iframe.style.cssText = 'position:absolute;top:-9999px;left:-9999px;width:320px;height:180px;border:none;';
  iframe.src =
    `https://www.youtube.com/embed/${videoId}` +
    `?enablejsapi=1&autoplay=1&controls=0&rel=0&iv_load_policy=3` +
    `&modestbranding=1&start=${Math.floor(startSeconds || 0)}`;
  document.body.appendChild(iframe);
  ytFrame = iframe;
  currentVideoId = videoId;
}

function sendCmd(func, args) {
  if (!ytFrame || !ytFrame.contentWindow) return;
  ytFrame.contentWindow.postMessage(
    JSON.stringify({ event: 'command', func, args: args || [] }),
    'https://www.youtube.com'
  );
}

window.addEventListener('message', (event) => {
  if (event.origin !== 'https://www.youtube.com') return;
  let data;
  try { data = JSON.parse(event.data); } catch { return; }

  if (data.event === 'onReady') {
    playerReady = true;
    // Ask YouTube to send periodic infoDelivery events (currentTime, duration, etc.)
    if (ytFrame && ytFrame.contentWindow) {
      ytFrame.contentWindow.postMessage(
        JSON.stringify({ event: 'listening', id: 1 }),
        'https://www.youtube.com'
      );
    }
    sendCmd('setVolume', [volume]);
    sendCmd('setPlaybackRate', [playbackRate]);
    // If autoplay was blocked by the browser, kick it manually now
    if (pendingPlayOnReady) {
      sendCmd('playVideo');
      pendingPlayOnReady = false;
      isPlaying = true;
    }
    broadcastState();
  } else if (data.event === 'onStateChange') {
    const state = data.info;
    if (state === 1) {        // PLAYING
      isPlaying = true;
      broadcastState();
    } else if (state === 2) { // PAUSED
      isPlaying = false;
      broadcastState();
    } else if (state === 0) { // ENDED
      isPlaying = false;
      nextTrack();
    } else if (state === 3) { // BUFFERING
      broadcastState('Buffering…');
    }
  } else if (data.event === 'onError') {
    const codes = { 2: 'Invalid video ID', 5: 'HTML5 error', 100: 'Video not found', 101: 'Embedding disabled', 150: 'Embedding disabled' };
    broadcastState('Error: ' + (codes[data.info] || `code ${data.info}`));
  } else if (data.event === 'infoDelivery' && data.info) {
    if (typeof data.info.currentTime === 'number') currentTime = data.info.currentTime;
    if (typeof data.info.duration === 'number' && data.info.duration > 0) duration = data.info.duration;
    if (typeof data.info.volume === 'number') volume = data.info.volume;
    if (data.info.playerState === 1) isPlaying = true;
    else if (data.info.playerState === 2 || data.info.playerState === 0) isPlaying = false;
  }
});

// ---- Playlists ----

function initPlaylists(data) {
  playlists = data;
  genreNames = Object.keys(playlists);
  if (genreNames.length) {
    loadGenre(genreNames[0]);
  }
  broadcastState();
}

// Load bundled playlists.json on startup; only used if no custom data is sent first
fetch(chrome.runtime.getURL('playlists.json'))
  .then(r => r.json())
  .then(data => {
    if (!Object.keys(playlists).length) initPlaylists(data);
  });

function loadGenre(genre) {
  if (t3Timeout) cancel3minTimer();
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
  if (t3Timeout) cancel3minTimer();
  sendCmd('stopVideo');
  isPlaying = false;
  currentVideoId = null;
  currentTime = 0;
  duration = 0;
  currentAlbumIndex = index;
  const entry = currentEntries[index];
  if (!entry) return;

  const timestampTracks = (entry.tracks || []).filter(t => 'seconds' in t);
  if (timestampTracks.length > 0) {
    tracks = timestampTracks.map(t => ({
      title: t.title,
      youtubeId: entry.youtubeId,
      startTime: t.seconds
    }));
  } else {
    tracks = [{ title: entry.name, youtubeId: entry.youtubeId, startTime: 0 }];
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

  if (!ytFrame) {
    // First play — create the iframe; onReady will call playVideo
    pendingPlayOnReady = true;
    createYTFrame(track.youtubeId, track.startTime || 0);
    broadcastState('Loading...');
  } else if (currentVideoId !== track.youtubeId) {
    // Different video — use loadVideoById command (no iframe recreation)
    currentVideoId = track.youtubeId;
    sendCmd('loadVideoById', [track.youtubeId, track.startTime || 0]);
    isPlaying = true;
    broadcastState('Loading...');
  } else {
    // Same video — seek and resume
    sendCmd('seekTo', [track.startTime || 0, true]);
    sendCmd('playVideo');
    isPlaying = true;
    broadcastState();
  }
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
      if (currentAlbumIndex + 1 < currentEntries.length) {
        loadAlbum(currentAlbumIndex + 1);
        loadAndPlay(0);
      } else {
        loadAndPlay(0);
      }
    } else {
      loadAndPlay(nextIdx);
    }
  }
}

function prevTrack() {
  if (tracks.length === 0) return;
  if (currentTime > 3) {
    sendCmd('seekTo', [tracks[currentIndex] ? tracks[currentIndex].startTime || 0 : 0, true]);
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

function checkChapterBoundary() {
  if (currentIndex < 0 || !tracks[currentIndex]) return;
  const nextIdx = currentIndex + 1;
  if (nextIdx < tracks.length && tracks[nextIdx].youtubeId === tracks[currentIndex].youtubeId) {
    if (currentTime >= tracks[nextIdx].startTime) {
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
    volume: t3FadeVol !== null ? t3FadeVol : volume,
    currentTime,
    duration,
    trackTitle: currentIndex >= 0 && tracks[currentIndex] ? tracks[currentIndex].title : null,
    youtubeId: currentIndex >= 0 && tracks[currentIndex] ? tracks[currentIndex].youtubeId || null : null,
    tracks: tracks.map(t => ({ title: t.title, seconds: t.startTime || 0, youtubeId: t.youtubeId || '' })),
    whiteNoise: whiteNoiseActive,
    noiseVolume: Math.round(noiseVolume * 100),
    timer3min: {
      active: t3Timeout !== null,
      currentLoop: t3Timeout ? T3_TOTAL_LOOPS - t3LoopsRemaining + 1 : 0,
      totalLoops: T3_TOTAL_LOOPS
    },
    natureIsPlaying,
    natureVolumes: { ...natureVolumes },
    natureErrors: { ...natureTrackErrors },
    natureActiveGroup: activeGroup,
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

// ---- 30-second repeat timer ----
const T3_DURATION_MS = 30000;
const T3_TOTAL_LOOPS = 5;
const T3_FADE_MS = 2000;
let t3Timeout = null;
let t3LoopsRemaining = 0;
let t3StartTime = 0;
let t3TrackVideoId = null;
let t3FadeVol = null;   // saved volume (0-100) during fade; null = not fading
let t3Generation = 0;

function toggle3minTimer() {
  if (t3Timeout) {
    cancel3minTimer('30s timer cancelled');
  } else {
    start3minTimer();
  }
}

function start3minTimer() {
  if (tracks.length === 0) return;
  if (currentIndex === -1) {
    nextTrack();
  } else if (!isPlaying) {
    sendCmd('playVideo');
    isPlaying = true;
  }
  t3TrackVideoId = tracks[currentIndex] ? tracks[currentIndex].youtubeId : null;
  t3StartTime = currentTime || (tracks[currentIndex] ? tracks[currentIndex].startTime || 0 : 0);
  t3LoopsRemaining = T3_TOTAL_LOOPS;
  run3minLoop();
}

function run3minLoop() {
  const currentLoop = T3_TOTAL_LOOPS - t3LoopsRemaining + 1;
  broadcastState(`30s repeat: loop ${currentLoop}/${T3_TOTAL_LOOPS}`);

  t3Timeout = setTimeout(async () => {
    const gen = t3Generation;
    t3FadeVol = volume;
    await fadeAudioTo(0, T3_FADE_MS, gen);
    if (gen !== t3Generation) return;
    t3LoopsRemaining--;

    await rewindTo3minStart(gen);
    if (gen !== t3Generation) return;

    if (t3LoopsRemaining > 0) {
      sendCmd('playVideo');
      isPlaying = true;
      await fadeAudioTo(t3FadeVol, 1000, gen);
      if (gen !== t3Generation) return;
      t3FadeVol = null;
      run3minLoop();
    } else {
      sendCmd('pauseVideo');
      isPlaying = false;
      volume = t3FadeVol;
      sendCmd('setVolume', [volume]);
      t3FadeVol = null;
      t3Timeout = null;
      broadcastState(`30s repeat complete (${T3_TOTAL_LOOPS}/${T3_TOTAL_LOOPS})`);
    }
  }, T3_DURATION_MS - T3_FADE_MS);
}

function cancel3minTimer(statusMsg) {
  t3Generation++;
  if (t3Timeout) { clearTimeout(t3Timeout); t3Timeout = null; }
  t3LoopsRemaining = 0;
  if (t3FadeVol !== null) {
    volume = t3FadeVol;
    sendCmd('setVolume', [volume]);
    t3FadeVol = null;
  }
  broadcastState(statusMsg);
}

async function rewindTo3minStart(gen) {
  let idx = -1;
  for (let i = 0; i < tracks.length; i++) {
    if (tracks[i].youtubeId === t3TrackVideoId && (tracks[i].startTime || 0) <= t3StartTime) idx = i;
  }
  if (idx >= 0) currentIndex = idx;

  if (currentVideoId !== t3TrackVideoId) {
    currentVideoId = t3TrackVideoId;
    sendCmd('loadVideoById', [t3TrackVideoId, t3StartTime]);
    await Promise.race([
      new Promise(r => {
        const check = setInterval(() => {
          if (isPlaying) { clearInterval(check); r(); }
        }, 200);
      }),
      new Promise(r => setTimeout(r, 5000))
    ]);
    if (gen !== t3Generation) return;
  }
  sendCmd('seekTo', [t3StartTime, true]);
  broadcastState();
}

function fadeAudioTo(target, durationMs, gen) {
  // volume in 0-100 range throughout
  return new Promise(resolve => {
    const startVol = volume;
    const steps = 20;
    let i = 0;
    const iv = setInterval(() => {
      if (gen !== undefined && gen !== t3Generation) {
        clearInterval(iv);
        resolve();
        return;
      }
      i++;
      volume = Math.round(Math.min(100, Math.max(0, startVol + (target - startVol) * (i / steps))));
      sendCmd('setVolume', [volume]);
      if (i >= steps) {
        clearInterval(iv);
        resolve();
      }
    }, durationMs / steps);
  });
}

// ---- Nature Sounds Mixer ----
const NATURE_TRACKS = [
  { id: 'rain',    label: 'Rainforest Rain', url: 'https://www.dropbox.com/scl/fi/tiq1neyx2emh2or5i8qzv/Rainforest-Rain-Sounds-trimmed-30min-loudnorm-ubNfkpbxXUs.m4a?rlkey=29lotc6vu1922t9vqyu4gnz57&st=s0l0wjbp&raw=1' },
  { id: 'birds',   label: 'Forest Birdsong', url: 'https://www.dropbox.com/scl/fi/kkadbn85fwekyuh6i2gbd/Forest-Birdsong-Nature-Sounds-trimmed-30min-loudnorm-2G8LAiHSCAs.m4a?rlkey=p2copybzvpcs9y3xy7yzcs7as&st=3d3ew408&raw=1' },
  { id: 'wind',    label: 'Relaxing Wind', url: 'https://www.dropbox.com/scl/fi/ytuvikmett7phzws1zp0y/Relaxing-Wind-Sounds-trimmed-30min-loudnorm-qBAPsQkS8QI.m4a?rlkey=61ajjlnj6wfcs3qq7hfbdq93l&st=ynzk5jby&raw=1' },
  { id: 'thunder', label: 'Epic Thunder Rain', url: 'https://www.dropbox.com/scl/fi/c1lzcm6v9bqukebuer2aq/EPIC-THUNDER-RAIN-trimmed-30min-loudnorm-nDq6TstdEi8.m4a?rlkey=jid70hvs76qw0m3bmk0xqclm6&st=03qfflef&raw=1' },
  { id: 'ocean',   label: 'Ocean Waves', url: 'https://www.dropbox.com/scl/fi/yaqnf8pu68x600da5ehll/oceanwaves-loudnorm.mp3?rlkey=jd3y0xnnyj3sotthyn88r9xa6&st=ym3tagd4&raw=1' },
];

const NATURE_GROUPS = [
  { id: 'forest', label: 'Forest', trackIds: ['rain', 'birds', 'wind'] },
  { id: 'storm',  label: 'Storm',  trackIds: ['thunder', 'ocean'] },
];

let natureAudioElements = {};
let natureIsPlaying = false;
let natureVolumes = { rain: 100, birds: 100, wind: 100, thunder: 100, ocean: 100 };
let natureTrackErrors = { rain: false, birds: false, wind: false, thunder: false, ocean: false };
let natureInitialized = false;
let activeGroup = 'forest';

// Applies each track's effective volume — its own slider level, silenced entirely
// unless its group is the active one — to its <audio> element. Never reads or
// writes natureVolumes itself, so it can be called freely from anywhere a slider
// level or the active group might have changed.
function applyNatureVolumes() {
  const group = NATURE_GROUPS.find(g => g.id === activeGroup);
  NATURE_TRACKS.forEach(track => {
    const el = natureAudioElements[track.id];
    if (!el) return;
    const inActiveGroup = !!group && group.trackIds.includes(track.id);
    const stored = natureVolumes[track.id] ?? 100;
    el.volume = inActiveGroup ? stored / 100 : 0;
  });
}

function initNatureAudio() {
  if (natureInitialized) return;
  natureInitialized = true;
  NATURE_TRACKS.forEach(track => {
    const el = new Audio(track.url);
    el.loop = true;
    document.body.appendChild(el);
    el.addEventListener('error', () => {
      natureTrackErrors[track.id] = true;
      broadcastState();
    });
    // Belt-and-braces for `loop`: these are ~30min files streamed from Dropbox, and
    // native gapless looping over a long network-streamed source isn't reliable —
    // if 'ended' fires anyway (loop didn't catch it), seek back and replay manually
    // so playback keeps going without the user having to press play/pause again.
    el.addEventListener('ended', () => {
      el.currentTime = 0;
      el.play().catch(() => {});
    });
    natureAudioElements[track.id] = el;
  });
  applyNatureVolumes();
}

function natureToggle() {
  initNatureAudio();
  natureIsPlaying = !natureIsPlaying;
  NATURE_TRACKS.forEach(track => {
    if (natureTrackErrors[track.id]) return;
    const el = natureAudioElements[track.id];
    if (!el) return;
    if (natureIsPlaying) el.play().catch(() => {}); else el.pause();
  });
  broadcastState();
}

function natureGroupToggle() {
  initNatureAudio();
  activeGroup = activeGroup === 'forest' ? 'storm' : 'forest';
  applyNatureVolumes();
  broadcastState();
}

// MUST only ever read/write natureVolumes[trackId] — never activeGroup. Muting or
// reactivating a group must never lose or reset a slider's position (FR-006), and
// this function being the only writer of natureVolumes is what guarantees that:
// applyNatureVolumes() reads the stored value fresh every time a group becomes
// active again, so nothing here needs to save/restore anything.
function natureSetVolume(trackId, value) {
  if (!NATURE_TRACKS.some(t => t.id === trackId)) return;
  const clamped = Math.min(100, Math.max(0, value));
  natureVolumes[trackId] = clamped;
  applyNatureVolumes();
  broadcastState();
}

function natureLoadState(isPlaying, volumes, activeGroupArg) {
  initNatureAudio();
  NATURE_TRACKS.forEach(track => {
    const v = (volumes && volumes[track.id] !== undefined) ? volumes[track.id] : 100;
    natureVolumes[track.id] = v;
  });
  activeGroup = NATURE_GROUPS.some(g => g.id === activeGroupArg) ? activeGroupArg : 'forest';
  applyNatureVolumes();
  natureIsPlaying = !!isPlaying;
  if (natureIsPlaying) {
    NATURE_TRACKS.forEach(track => {
      if (natureTrackErrors[track.id]) return;
      const el = natureAudioElements[track.id];
      if (el) el.play().catch(() => {});
    });
  }
  broadcastState();
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.target !== 'offscreen') return;
  if (msg.type === 'getState') {
    sendResponse(getState());
    return;
  }
  if (msg.type === 'timer3minToggle') {
    toggle3minTimer();
    return;
  }
  if (msg.type === 'loadPlaylists') {
    initPlaylists(msg.playlists);
    return;
  }
  if (msg.type === 'play') {
    if (currentIndex === -1 && tracks.length > 0) {
      nextTrack();
    } else {
      sendCmd('playVideo');
      isPlaying = true;
      broadcastState();
    }
  } else if (msg.type === 'pause') {
    sendCmd('pauseVideo');
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
  } else if (msg.type === 'noiseVolume') {
    noiseVolume = msg.value / 100;
    setNoiseVolume();
    broadcastState();
  } else if (msg.type === 'volume') {
    volume = msg.value;
    sendCmd('setVolume', [volume]);
    if (t3FadeVol !== null) t3FadeVol = volume;
    broadcastState();
  } else if (msg.type === 'rate') {
    playbackRate = msg.value;
    sendCmd('setPlaybackRate', [playbackRate]);
    broadcastState();
  } else if (msg.type === 'seek') {
    if (duration) sendCmd('seekTo', [msg.fraction * duration, true]);
    broadcastState();
  } else if (msg.type === 'playIndex') {
    loadAndPlay(msg.index);
  } else if (msg.type === 'switchGenre') {
    loadGenre(msg.name);
    broadcastState();
  } else if (msg.type === 'switchAlbum') {
    loadAlbum(msg.index);
    broadcastState();
  } else if (msg.type === 'natureToggle') {
    natureToggle();
  } else if (msg.type === 'natureGroupToggle') {
    natureGroupToggle();
  } else if (msg.type === 'natureVolume') {
    natureSetVolume(msg.track, msg.value);
  } else if (msg.type === 'natureLoadState') {
    natureLoadState(msg.isPlaying, msg.volumes, msg.activeGroup);
  }
});
