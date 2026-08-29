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
      startTime: t.seconds,
      youtubeId: entry.youtubeId || null
    }));
  } else {
    // Single track, no chapters
    tracks = [{ title: entry.name, url: entry.url, startTime: 0, youtubeId: entry.youtubeId || null }];
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
    volume: Math.round((t3FadeVol !== null ? t3FadeVol : audio.volume) * 100),
    currentTime: audio.currentTime || 0,
    duration: audio.duration || 0,
    trackTitle: currentIndex >= 0 && tracks[currentIndex] ? tracks[currentIndex].title : null,
    youtubeId: currentIndex >= 0 && tracks[currentIndex] ? tracks[currentIndex].youtubeId || null : null,
    tracks: tracks.map(t => t.title),
    whiteNoise: whiteNoiseActive,
    noiseVolume: Math.round(noiseVolume * 100),
    timer3min: {
      active: t3Timeout !== null,
      currentLoop: t3Timeout ? T3_TOTAL_LOOPS - t3LoopsRemaining + 1 : 0,
      totalLoops: T3_TOTAL_LOOPS
    },
    beatsIsPlaying,
    beatsBpm,
    beatsVolume: Math.round(beatsVolume * 100),
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

// ---- 30-second repeat timer ----
// Plays 30 seconds from the current position, fades out, rewinds,
// and repeats 10 times. Click again to cancel.
const T3_DURATION_MS = 30000;
const T3_TOTAL_LOOPS = 10;
const T3_FADE_MS = 2000;
let t3Timeout = null;
let t3LoopsRemaining = 0;
let t3StartTime = 0;
let t3TrackUrl = null;
let t3FadeVol = null;   // volume to restore after a fade (null = not fading)
let t3Generation = 0;   // bumped on cancel so in-flight async fades abort

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
  } else if (audio.paused) {
    audio.play().then(() => { isPlaying = true; }).catch(() => {});
  }
  t3TrackUrl = tracks[currentIndex].url;
  t3StartTime = audio.currentTime || (tracks[currentIndex].startTime || 0);
  t3LoopsRemaining = T3_TOTAL_LOOPS;
  run3minLoop();
}

function run3minLoop() {
  const currentLoop = T3_TOTAL_LOOPS - t3LoopsRemaining + 1;
  broadcastState(`30s repeat: loop ${currentLoop}/${T3_TOTAL_LOOPS}`);

  t3Timeout = setTimeout(async () => {
    const gen = t3Generation;
    t3FadeVol = audio.volume;
    await fadeAudioTo(0, T3_FADE_MS, gen);
    if (gen !== t3Generation) return;  // cancelled during fade
    t3LoopsRemaining--;

    await rewindTo3minStart(gen);
    if (gen !== t3Generation) return;

    if (t3LoopsRemaining > 0) {
      audio.play().then(() => { isPlaying = true; }).catch(() => {});
      await fadeAudioTo(t3FadeVol, 1000, gen);
      if (gen !== t3Generation) return;
      t3FadeVol = null;
      run3minLoop();
    } else {
      // All loops complete — pause at the loop start, restore volume
      audio.pause();
      isPlaying = false;
      audio.volume = t3FadeVol;
      t3FadeVol = null;
      t3Timeout = null;
      broadcastState(`30s repeat complete (${T3_TOTAL_LOOPS}/${T3_TOTAL_LOOPS})`);
    }
  }, T3_DURATION_MS - T3_FADE_MS);
}

function cancel3minTimer(statusMsg) {
  t3Generation++;
  if (t3Timeout) {
    clearTimeout(t3Timeout);
    t3Timeout = null;
  }
  t3LoopsRemaining = 0;
  if (t3FadeVol !== null) {
    audio.volume = t3FadeVol;
    t3FadeVol = null;
  }
  broadcastState(statusMsg);
}

async function rewindTo3minStart(gen) {
  // Restore chapter highlight for timestamp-based albums
  let idx = -1;
  for (let i = 0; i < tracks.length; i++) {
    if (tracks[i].url === t3TrackUrl && (tracks[i].startTime || 0) <= t3StartTime) idx = i;
  }
  if (idx >= 0) currentIndex = idx;

  if (audio.src !== t3TrackUrl) {
    // Playback drifted into a different file — reload the timer's track
    audio.src = t3TrackUrl;
    audio.playbackRate = playbackRate;
    await Promise.race([
      new Promise(r => audio.addEventListener('loadedmetadata', r, { once: true })),
      new Promise(r => setTimeout(r, 5000))
    ]);
    if (gen !== t3Generation) return;
  }
  audio.currentTime = t3StartTime;
  broadcastState();
}

function fadeAudioTo(target, durationMs, gen) {
  return new Promise(resolve => {
    const startVol = audio.volume;
    const steps = 20;
    let i = 0;
    const iv = setInterval(() => {
      if (gen !== undefined && gen !== t3Generation) {
        clearInterval(iv);
        resolve();
        return;
      }
      i++;
      audio.volume = Math.min(1, Math.max(0, startVol + (target - startVol) * (i / steps)));
      if (i >= steps) {
        clearInterval(iv);
        resolve();
      }
    }, durationMs / steps);
  });
}

// ---- Beats Sequencer ----
const BEATS_STEPS = 8;
let beatsCtx = null, beatsMaster = null;
let beatsBpm = 120;
let beatsIsPlaying = false;
let beatsCurrentStep = 0;
let beatsNextNoteTime = 0;
let beatsTimer = null;
let beatsVolume = 0.7;
let beatsGrid = {
  kick:  new Array(8).fill(0),
  snare: new Array(8).fill(0),
  hat:   new Array(8).fill(0),
  crash: new Array(8).fill(0),
  tone:  new Array(8).fill(0),
};
const BEATS_SWING = 0.25;
const BEATS_HUMANIZE = 0.004;

function ensureBeatsAudio() {
  if (beatsCtx) return;
  beatsCtx = new AudioContext();
  beatsMaster = beatsCtx.createGain();
  beatsMaster.gain.value = beatsVolume;
  beatsMaster.connect(beatsCtx.destination);
}

function bKick(t) {
  const osc = beatsCtx.createOscillator(), g = beatsCtx.createGain();
  osc.frequency.setValueAtTime(150, t);
  osc.frequency.exponentialRampToValueAtTime(45, t+0.12);
  g.gain.setValueAtTime(0.9, t); g.gain.exponentialRampToValueAtTime(0.001, t+0.22);
  osc.connect(g).connect(beatsMaster); osc.start(t); osc.stop(t+0.25);
}
function bSnare(t) {
  const sz = beatsCtx.sampleRate*0.15, buf = beatsCtx.createBuffer(1,sz,beatsCtx.sampleRate);
  const d = buf.getChannelData(0);
  for(let i=0;i<sz;i++) d[i]=(Math.random()*2-1)*(1-i/sz);
  const n=beatsCtx.createBufferSource(); n.buffer=buf;
  const f=beatsCtx.createBiquadFilter(); f.type='highpass'; f.frequency.value=1200;
  const g=beatsCtx.createGain();
  g.gain.setValueAtTime(0.55,t); g.gain.exponentialRampToValueAtTime(0.001,t+0.15);
  n.connect(f).connect(g).connect(beatsMaster); n.start(t); n.stop(t+0.15);
  const osc=beatsCtx.createOscillator(), og=beatsCtx.createGain();
  osc.frequency.value=190;
  og.gain.setValueAtTime(0.3,t); og.gain.exponentialRampToValueAtTime(0.001,t+0.1);
  osc.connect(og).connect(beatsMaster); osc.start(t); osc.stop(t+0.1);
}
function bHat(t) {
  const sz=beatsCtx.sampleRate*0.05, buf=beatsCtx.createBuffer(1,sz,beatsCtx.sampleRate);
  const d=buf.getChannelData(0);
  for(let i=0;i<sz;i++) d[i]=(Math.random()*2-1);
  const n=beatsCtx.createBufferSource(); n.buffer=buf;
  const f=beatsCtx.createBiquadFilter(); f.type='highpass'; f.frequency.value=7000;
  const g=beatsCtx.createGain();
  g.gain.setValueAtTime(0.28,t); g.gain.exponentialRampToValueAtTime(0.001,t+0.04);
  n.connect(f).connect(g).connect(beatsMaster); n.start(t); n.stop(t+0.05);
}
function bCrash(t) {
  [180,243,310,410,560].forEach((f,idx)=>{
    const osc=beatsCtx.createOscillator(), g=beatsCtx.createGain();
    osc.type='sine'; osc.frequency.value=f*(1+idx*0.003);
    g.gain.setValueAtTime(0.16/(idx+1),t); g.gain.exponentialRampToValueAtTime(0.001,t+0.9);
    osc.connect(g).connect(beatsMaster); osc.start(t); osc.stop(t+0.9);
  });
  const sz=beatsCtx.sampleRate*0.9, buf=beatsCtx.createBuffer(1,sz,beatsCtx.sampleRate);
  const d=buf.getChannelData(0);
  for(let i=0;i<sz;i++) d[i]=(Math.random()*2-1);
  const n=beatsCtx.createBufferSource(); n.buffer=buf;
  const f=beatsCtx.createBiquadFilter(); f.type='bandpass'; f.frequency.value=3500; f.Q.value=0.6;
  const g=beatsCtx.createGain();
  g.gain.setValueAtTime(0.22,t); g.gain.exponentialRampToValueAtTime(0.001,t+0.85);
  n.connect(f).connect(g).connect(beatsMaster); n.start(t); n.stop(t+0.85);
}
function bTone(t) {
  const osc=beatsCtx.createOscillator(), g=beatsCtx.createGain();
  osc.type='triangle'; osc.frequency.value=330;
  g.gain.setValueAtTime(0.4,t); g.gain.exponentialRampToValueAtTime(0.001,t+0.18);
  osc.connect(g).connect(beatsMaster); osc.start(t); osc.stop(t+0.2);
}

function beatsScheduler() {
  const stepDur = (60/beatsBpm)/2; // 8th notes
  while(beatsNextNoteTime < beatsCtx.currentTime + 0.15) {
    const isOff = beatsCurrentStep % 2 === 1;
    const t = beatsNextNoteTime + (isOff ? stepDur*BEATS_SWING : 0) + (Math.random()*2-1)*BEATS_HUMANIZE;
    const s = beatsCurrentStep;
    if(beatsGrid.kick[s]) bKick(t);
    if(beatsGrid.snare[s]) bSnare(t);
    if(beatsGrid.hat[s]) bHat(t);
    if(beatsGrid.crash[s]) bCrash(t);
    if(beatsGrid.tone[s]) bTone(t);
    const delay = Math.max(0,(t-beatsCtx.currentTime)*1000);
    setTimeout(()=>{ chrome.runtime.sendMessage({type:'beatsStep',stepIdx:s}).catch(()=>{}); }, delay);
    beatsNextNoteTime += stepDur;
    beatsCurrentStep = (beatsCurrentStep+1)%BEATS_STEPS;
  }
}

async function beatsStart() {
  ensureBeatsAudio();
  if(beatsCtx.state==='suspended') await beatsCtx.resume();
  beatsCurrentStep=0;
  beatsNextNoteTime=beatsCtx.currentTime+0.05;
  beatsTimer=setInterval(beatsScheduler,25);
  beatsIsPlaying=true;
  broadcastState();
}

function beatsStop() {
  if(beatsTimer) clearInterval(beatsTimer);
  beatsTimer=null;
  beatsIsPlaying=false;
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
  } else if (msg.type === 'noiseVolume') {
    noiseVolume = msg.value / 100;
    setNoiseVolume();
    broadcastState();
  } else if (msg.type === 'volume') {
    audio.volume = msg.value / 100;
    if (t3FadeVol !== null) t3FadeVol = audio.volume;
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
  } else if (msg.type === 'beatsToggle') {
    if(beatsIsPlaying) beatsStop(); else beatsStart();
  } else if (msg.type === 'beatsBpm') {
    beatsBpm = msg.value;
  } else if (msg.type === 'beatsVolume') {
    beatsVolume = msg.value / 100;
    if(beatsMaster) beatsMaster.gain.value = beatsVolume;
  } else if (msg.type === 'beatsLoadGrid') {
    beatsGrid = msg.grid;
    if(msg.bpm) beatsBpm = msg.bpm;
  }
});
