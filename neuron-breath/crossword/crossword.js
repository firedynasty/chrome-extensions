/*GEN*/
// Built-in themes: name -> [word, clue]. Custom themes live in localStorage and are merged on top.
const BUILTIN = {
  "Kitchen": [
    ["BREAD", "A slice of it goes in the toaster"], ["CHEF", "Person in charge of the stove"],
    ["TRAY", "Flat board for carrying drinks"], ["DISH", "Plate or bowl"], ["FORK", "Pronged utensil"],
    ["SPOON", "Stirs soup, scoops cereal"], ["KNIFE", "Cuts the bread"], ["OVEN", "Bakes the cookies"],
    ["WHISK", "Beats eggs"], ["APRON", "Worn to keep clothes clean while cooking"], ["STOVE", "Appliance with burners"],
    ["LADLE", "Big spoon for serving soup"], ["GRILL", "Cooks burgers over a flame"], ["SOUP", "Hot dish served in a bowl"],
    ["TOAST", "Browned bread"], ["MUG", "Holds your coffee"]
  ],
  "Space": [
    ["PLANET", "Mars or Venus"], ["COMET", "Icy visitor with a tail"], ["ORBIT", "Path around a star"],
    ["MOON", "Earth's natural satellite"], ["STAR", "Twinkles in the night sky"], ["ROCKET", "Launches astronauts"],
    ["GALAXY", "The Milky Way, for one"], ["MARS", "The red planet"], ["VENUS", "The hottest planet"],
    ["SATURN", "Planet with famous rings"], ["ALIEN", "Visitor from another world"], ["SOLAR", "Of the sun"],
    ["ECLIPSE", "When the moon blocks the sun"], ["COSMOS", "The whole universe"], ["NOVA", "Sudden bright star"]
  ],
  "Studio": [
    ["RHYME", "What \"beat\" and \"heat\" do"], ["MIXED", "Blended, like the tracks on an album"], ["DRUM", "Hit it with sticks"],
    ["KEY", "C major or G minor, for one"], ["LEAD", "Main vocal or guitar part"], ["BASS", "Low-end instrument"],
    ["BEAT", "The pulse you tap your foot to"], ["TEMPO", "Speed of the music"], ["CHORD", "Notes played together"],
    ["VERSE", "Section before the chorus"], ["HOOK", "Catchy repeated part of a song"], ["TRACK", "One song on an album"],
    ["SCALE", "Do-re-mi pattern"], ["PIANO", "Eighty-eight keys"], ["MELODY", "The tune you hum"], ["GUITAR", "Six strings"]
  ],
  "Basketball": [
    ["DUNK", "Slam it through the rim"], ["COURT", "Where the game is played"], ["HOOP", "The rim and net"],
    ["SHOT", "A try at scoring"], ["PASS", "Throw to a teammate"], ["DRIBBLE", "Bounce while moving"],
    ["REBOUND", "Grab a missed shot"], ["LAYUP", "Close-range shot off the glass"], ["BLOCK", "Swat a shot away"],
    ["STEAL", "Take the ball from the other team"], ["FOUL", "Illegal contact"], ["ASSIST", "Pass that sets up a basket"],
    ["GUARD", "A ball-handling position"], ["CENTER", "Usually the tallest player"], ["SWISH", "Sound of a perfect shot"], ["NET", "Hangs from the rim"]
  ],
  "Animals": [
    ["TIGER", "Striped big cat"], ["TOAD", "Warty cousin of the frog"], ["DOG", "Man's best friend"],
    ["RAT", "Rodent that lives in cities"], ["ZEBRA", "Striped horse relative"], ["EAGLE", "Bird with sharp talons"],
    ["SHARK", "Fish with a dorsal fin"], ["WHALE", "Largest animal in the sea"], ["PANDA", "Bamboo-eating bear"],
    ["OTTER", "Floats on its back"], ["KOALA", "Sleepy eucalyptus eater"], ["MOOSE", "Large antlered deer"],
    ["CAMEL", "Desert animal with humps"], ["FROG", "Hops and croaks"], ["ALERT", "Wide awake and watchful"]
  ],
  "Weather": [
    ["RAIN", "Falls from clouds"], ["SNOW", "White flakes that fall in winter"], ["STORM", "Wind, rain and thunder together"],
    ["CLOUD", "Floats in the sky"], ["WIND", "Moving air"], ["FOG", "Low, thick mist"], ["HAIL", "Frozen rain pellets"],
    ["SUNNY", "Clear and bright"], ["BREEZE", "Gentle wind"], ["FROST", "Ice crystals on the grass"],
    ["THUNDER", "The sound after lightning"], ["FLOOD", "Too much water on land"], ["MIST", "Light fog"],
    ["DRIZZLE", "Very light rain"], ["TORNADO", "Spinning funnel of wind"]
  ],
  "Ocean": [
    ["WAVE", "Rolls onto the beach"], ["TIDE", "Rises and falls each day"], ["REEF", "Home of colorful fish"],
    ["CORAL", "Reef builder"], ["SHELL", "Found on the sand"], ["BEACH", "Sandy shore"], ["CRAB", "Walks sideways"],
    ["SQUID", "Ten-armed ink squirter"], ["ANCHOR", "Keeps a ship in place"], ["SAIL", "Catches the wind on a boat"],
    ["SEAL", "Barking swimmer with flippers"], ["KELP", "Giant seaweed"], ["DOLPHIN", "Clever, clicking swimmer"],
    ["ISLAND", "Land surrounded by water"], ["SHARK", "Fish with a dorsal fin"]
  ],
  "Computers": [
    ["MOUSE", "Click with it"], ["SCREEN", "Where the picture appears"], ["CODE", "What programmers write"],
    ["BUG", "Flaw in a program"], ["CLICK", "What a mouse button does"], ["FILE", "Saved document"],
    ["CURSOR", "Blinking mark where you type"], ["PIXEL", "Tiny dot of a picture"], ["ERROR", "Something went wrong"],
    ["LOGIN", "Enter your password here"], ["WIFI", "Wireless internet"], ["ICON", "Small picture on a desktop"],
    ["MEMORY", "RAM, for short"], ["BYTE", "Eight bits"], ["LAPTOP", "Portable computer"], ["CLOUD", "Online storage"]
  ],
  "Garden": [
    ["SEED", "Plant it and wait"], ["ROSE", "Thorny flower"], ["SOIL", "Dirt for plants"], ["WEED", "Unwanted plant"],
    ["TULIP", "Spring bulb flower"], ["DAISY", "White petals, yellow center"], ["LEAF", "Green part of a plant"],
    ["STEM", "Holds up a flower"], ["ROOT", "Underground part of a plant"], ["SHOVEL", "Dig with it"],
    ["BLOOM", "To flower"], ["HOSE", "Waters the lawn"], ["GRASS", "Mowed on weekends"], ["POND", "Small garden pool"], ["FLOWER", "Colorful blossom"]
  ]
};

function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const t = a[i]; a[i] = a[j]; a[j] = t;
  }
  return a;
}

// Place 5-6 words from the bank in a 9x9 area; each new word must cross exactly one existing word.
// Returns [{a, clue, r, c, d}] or null.
function generate(bank, want) {
  const N = 9;
  want = want || 6;
  let best = null;
  for (let attempt = 0; attempt < 400; attempt++) {
    // `bank` is already ordered unseen-first; shuffle within halves is the caller's job.
    const pool = bank.slice(0, 8).sort(() => Math.random() - 0.5).concat(shuffle(bank.slice(8)));
    const grid = new Map();
    const placed = [];

    function canPlace(w, r, c, d) {
      const dr = d === "D" ? 1 : 0, dc = d === "A" ? 1 : 0, len = w.length;
      if (r < 0 || c < 0 || r + dr * (len - 1) >= N || c + dc * (len - 1) >= N) return false;
      if (grid.has((r - dr) + "," + (c - dc)) || grid.has((r + dr * len) + "," + (c + dc * len))) return false;
      let cross = 0;
      for (let k = 0; k < len; k++) {
        const rr = r + dr * k, cc = c + dc * k, cell = grid.get(rr + "," + cc);
        if (cell) {
          if (cell.ch !== w[k] || cell[d]) return false;
          cross++;
        } else if (grid.has((rr + dc) + "," + (cc + dr)) || grid.has((rr - dc) + "," + (cc - dr))) {
          return false;
        }
      }
      return cross === 1;
    }
    function put(e, r, c, d) {
      const dr = d === "D" ? 1 : 0, dc = d === "A" ? 1 : 0;
      for (let k = 0; k < e.a.length; k++) {
        const key = (r + dr * k) + "," + (c + dc * k);
        const cell = grid.get(key) || { ch: e.a[k], A: false, D: false };
        cell[d] = true;
        grid.set(key, cell);
      }
      placed.push({ a: e.a, clue: e.clue, r, c, d });
    }

    const first = pool.shift();
    const d0 = Math.random() < 0.5 ? "A" : "D";
    const off = Math.floor(Math.random() * (N - first.a.length + 1));
    const mid = 2 + Math.floor(Math.random() * 5);
    if (d0 === "A") put(first, mid, off, "A"); else put(first, off, mid, "D");

    for (const e of pool) {
      if (placed.length >= want) break;
      const opts = [];
      placed.forEach((p) => {
        const d = p.d === "A" ? "D" : "A";
        for (let i = 0; i < p.a.length; i++) {
          for (let k = 0; k < e.a.length; k++) {
            if (p.a[i] !== e.a[k]) continue;
            const pr = p.r + (p.d === "D" ? i : 0), pc = p.c + (p.d === "A" ? i : 0);
            const r = d === "D" ? pr - k : pr, c = d === "A" ? pc - k : pc;
            if (canPlace(e.a, r, c, d)) opts.push([r, c, d]);
          }
        }
      });
      if (opts.length) { const o = opts[Math.floor(Math.random() * opts.length)]; put(e, o[0], o[1], o[2]); }
    }
    if (placed.length >= want) return placed;
    if (!best || placed.length > best.length) best = placed;
  }
  return best && best.length >= 5 ? best : null;
}

function parseLines(text) {
  const out = [], seen = new Set();
  let bad = 0;
  String(text).split(/\r?\n/).forEach((line) => {
    if (!line.trim()) return;
    const i = line.indexOf(",");
    const a = (i < 0 ? line : line.slice(0, i)).trim().toUpperCase();
    const clue = i < 0 ? "" : line.slice(i + 1).trim();
    if (!/^[A-Z]{3,8}$/.test(a) || !clue || seen.has(a)) { bad++; return; }
    seen.add(a);
    out.push([a, clue]);
  });
  return { words: out, bad };
}
/*ENDGEN*/

(function () {
  const KEY = "pocketCrossword.v1";
  const MAX_PUZZLES = 10;
  const SKIP = { wrong: 1, msg: 1 };

  // ---- storage (every access guarded: it can throw in private windows) ----
  let store = { themes: {}, puzzles: [], seen: {}, theme: "*", n: 0 };
  try {
    const s = JSON.parse(localStorage.getItem(KEY));
    if (s && Array.isArray(s.puzzles)) store = Object.assign(store, s);
  } catch (e) {}
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(store, (k, v) => (SKIP[k] ? undefined : v))); } catch (e) {}
  }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  function allThemes() { return Object.assign({}, BUILTIN, store.themes); }

  // ---- puzzle model (unchanged build from the original) ----
  function build(p) {
    const cells = new Map();
    const words = p.words.map((w) => ({ a: w.a, d: w.d, clue: w.clue, r: w.r, c: w.c, cells: [], num: 0 }));
    words.forEach((w, i) => {
      for (let k = 0; k < w.a.length; k++) {
        const r = w.r + (w.d === "D" ? k : 0);
        const c = w.c + (w.d === "A" ? k : 0);
        const key = r + "," + c;
        let cell = cells.get(key);
        if (!cell) { cell = { r, c, ch: w.a[k], A: -1, D: -1, num: 0, key }; cells.set(key, cell); }
        cell[w.d] = i;
        w.cells.push(key);
      }
    });
    let minR = 99, minC = 99, maxR = -1, maxC = -1;
    cells.forEach((cl) => {
      minR = Math.min(minR, cl.r); minC = Math.min(minC, cl.c);
      maxR = Math.max(maxR, cl.r); maxC = Math.max(maxC, cl.c);
    });
    const norm = new Map();
    const rename = {};
    cells.forEach((cl) => {
      const old = cl.key;
      cl.r -= minR; cl.c -= minC;
      cl.key = cl.r + "," + cl.c;
      rename[old] = cl.key;
      norm.set(cl.key, cl);
    });
    words.forEach((w) => { w.cells = w.cells.map((k) => rename[k]); });
    const starts = [];
    words.forEach((w) => { if (starts.indexOf(w.cells[0]) < 0) starts.push(w.cells[0]); });
    starts.sort((x, y) => {
      const a = norm.get(x), b = norm.get(y);
      return a.r - b.r || a.c - b.c;
    });
    starts.forEach((k, i) => { norm.get(k).num = i + 1; });
    words.forEach((w) => { w.num = norm.get(w.cells[0]).num; });
    const order = words.map((w, i) => i).sort((x, y) => {
      const a = words[x], b = words[y];
      if (a.d !== b.d) return a.d === "A" ? -1 : 1;
      return a.num - b.num;
    });
    return { name: p.name, cells: norm, words, order, rows: maxR - minR + 1, cols: maxC - minC + 1 };
  }

  let built = [];
  let state = store.puzzles;
  let pi = 0;

  function hydrate(rec) {
    const b = build(rec);
    const first = b.words[b.order[0]];
    rec.entries = rec.entries || {};
    rec.wrong = new Set();
    rec.msg = "";
    rec.solved = !!rec.solved;
    rec.t0 = rec.t0 || 0;
    rec.time = rec.time || 0;
    if (!b.cells.has(rec.sel)) { rec.sel = first.cells[0]; rec.dir = first.d; }
    if (rec.dir !== "A" && rec.dir !== "D") rec.dir = first.d;
    return b;
  }
  function rebuildAll() {
    built = [];
    state = store.puzzles = store.puzzles.filter((rec) => {
      try { built.push(hydrate(rec)); return true; } catch (e) { return false; }
    });
  }

  const $ = (id) => document.getElementById(id);
  const tabsEl = $("tabs"), nowEl = $("now"), gridEl = $("grid"), cluesEl = $("clues"), msgEl = $("msg"), kb = $("kb");
  const SENT = "";
  kb.value = SENT;

  const P = () => built[pi];
  const S = () => state[pi];

  // ---- generating ----
  function newPuzzle() {
    const themes = allThemes();
    let name = $("themeSel").value;
    store.theme = name;
    if (name === "*" || !themes[name]) {
      const names = Object.keys(themes);
      name = names[Math.floor(Math.random() * names.length)];
    }
    const all = themes[name].map((w) => ({ a: w[0], clue: w[1] }));
    let seen = store.seen[name] || [];
    let fresh = all.filter((w) => seen.indexOf(w.a) < 0);
    if (fresh.length < 5) { seen = []; fresh = all; }
    const stale = all.filter((w) => fresh.indexOf(w) < 0);
    const placed = generate(shuffle(fresh.slice()).concat(shuffle(stale)));
    if (!placed) { msgEl.textContent = "Could not fit a grid from that theme. Try again."; return; }
    store.seen[name] = seen.concat(placed.map((w) => w.a));
    store.n = (store.n || 0) + 1;
    store.puzzles.push({
      id: Date.now() + "-" + store.n, name: name, words: placed, entries: {}, solved: false, t0: 0, time: 0
    });
    while (store.puzzles.length > MAX_PUZZLES) store.puzzles.shift();
    rebuildAll();
    pi = state.length - 1;
    save();
    render();
  }

  // ---- play ----
  function activeWord() {
    const st = S(), cell = P().cells.get(st.sel);
    if (cell[st.dir] < 0) st.dir = st.dir === "A" ? "D" : "A";
    return P().words[cell[st.dir]];
  }
  function wordDone(w) {
    const st = S();
    return w.cells.every((k) => st.entries[k] === P().cells.get(k).ch);
  }
  function fmtTime(ms) {
    const s = Math.max(1, Math.round(ms / 1000));
    return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
  }

  function selectCell(key) {
    const st = S(), cell = P().cells.get(key);
    if (!cell) return;
    if (key === st.sel && cell.A >= 0 && cell.D >= 0) st.dir = st.dir === "A" ? "D" : "A";
    else { st.sel = key; if (cell[st.dir] < 0) st.dir = st.dir === "A" ? "D" : "A"; }
    render();
  }
  function selectWord(i) {
    const st = S(), w = P().words[i];
    st.dir = w.d;
    st.sel = w.cells.find((k) => !st.entries[k]) || w.cells[0];
    render();
  }
  function stepWord(delta) {
    const P_ = P();
    const cur = P_.words.indexOf(activeWord());
    const pos = P_.order.indexOf(cur);
    const nxt = P_.order[(pos + delta + P_.order.length) % P_.order.length];
    selectWord(nxt);
  }
  function move(dr, dc) {
    const st = S(), P_ = P(), cur = P_.cells.get(st.sel);
    let r = cur.r + dr, c = cur.c + dc;
    while (r >= 0 && c >= 0 && r < P_.rows && c < P_.cols) {
      const cell = P_.cells.get(r + "," + c);
      if (cell) {
        st.sel = cell.key;
        const pref = dr === 0 ? "A" : "D";
        st.dir = cell[pref] >= 0 ? pref : (pref === "A" ? "D" : "A");
        render();
        return;
      }
      r += dr; c += dc;
    }
  }
  function typeLetter(ch) {
    const st = S();
    if (!st || st.solved) return;
    if (!st.t0) st.t0 = Date.now();
    st.entries[st.sel] = ch;
    st.wrong.delete(st.sel);
    st.msg = "";
    const w = activeWord(), i = w.cells.indexOf(st.sel);
    if (i < w.cells.length - 1) st.sel = w.cells[i + 1];
    checkSolved();
    render();
  }
  function backspace() {
    const st = S();
    if (!st || st.solved) return;
    st.msg = "";
    if (st.entries[st.sel]) {
      delete st.entries[st.sel];
      st.wrong.delete(st.sel);
    } else {
      const w = activeWord(), i = w.cells.indexOf(st.sel);
      if (i > 0) {
        st.sel = w.cells[i - 1];
        delete st.entries[st.sel];
        st.wrong.delete(st.sel);
      }
    }
    render();
  }
  function checkSolved() {
    const st = S();
    let all = true;
    P().cells.forEach((cl) => { if (st.entries[cl.key] !== cl.ch) all = false; });
    if (all) {
      st.solved = true;
      st.wrong.clear();
      st.time = Date.now() - (st.t0 || Date.now());
    }
  }

  // ---- render ----
  function renderThemes() {
    const themes = allThemes();
    const sel = $("themeSel");
    const cur = store.theme;
    sel.innerHTML = '<option value="*">Surprise me</option>' +
      Object.keys(themes).map((n) => '<option value="' + esc(n) + '">' + esc(n) + "</option>").join("");
    sel.value = themes[cur] || cur === "*" ? cur : "*";
    const names = Object.keys(store.themes);
    $("customEmpty").style.display = names.length ? "none" : "";
    $("customList").innerHTML = names.map((n) =>
      '<li><span>' + esc(n) + ' <span class="meta">(' + store.themes[n].length + ' words)</span></span>' +
      '<button class="btn" type="button" data-del="' + esc(n) + '">Remove</button></li>').join("");
  }

  function render() {
    if (!state.length) {
      tabsEl.innerHTML = ""; nowEl.innerHTML = ""; gridEl.innerHTML = ""; cluesEl.innerHTML = "";
      msgEl.textContent = "No puzzles yet. Press New puzzle.";
      return;
    }
    if (pi >= state.length) pi = state.length - 1;
    const st = S(), P_ = P();
    tabsEl.innerHTML = built.map((b, i) =>
      '<button class="tab' + (state[i].solved ? " solved" : "") + '" type="button" data-p="' + i + '" aria-pressed="' + (i === pi) + '">' +
      '<span class="dot"></span>' + esc(b.name) + "</button>").join("");

    const w = activeWord();
    nowEl.innerHTML = '<span class="tag">' + w.num + " " + (w.d === "A" ? "Across" : "Down") + "</span>" +
      '<span class="txt">' + esc(w.clue) + " (" + w.a.length + ")</span>";

    let html = '<div class="grid' + (st.solved ? " solved" : "") + '" style="--cols:' + P_.cols + '">';
    for (let r = 0; r < P_.rows; r++) {
      for (let c = 0; c < P_.cols; c++) {
        const cell = P_.cells.get(r + "," + c);
        if (!cell) { html += '<div class="gap"></div>'; continue; }
        const cls = ["cell"];
        if (w.cells.indexOf(cell.key) >= 0) cls.push("inword");
        if (cell.key === st.sel) cls.push("sel");
        if (st.wrong.has(cell.key)) cls.push("wrong");
        html += '<div class="' + cls.join(" ") + '" role="gridcell" data-k="' + cell.key + '">' +
          '<span class="n">' + (cell.num || "") + '</span><span class="l">' + (st.entries[cell.key] || "") + "</span></div>";
      }
    }
    gridEl.innerHTML = html + "</div>";

    function list(dir, title) {
      const items = P_.order.filter((i) => P_.words[i].d === dir).map((i) => {
        const x = P_.words[i];
        return '<li><button class="clue' + (x === w ? " on" : "") + (wordDone(x) ? " done" : "") + '" type="button" data-w="' + i + '">' +
          "<b>" + x.num + "</b><span>" + esc(x.clue) + '</span><span class="len">(' + x.a.length + ")</span></button></li>";
      }).join("");
      return "<div><h2>" + title + "</h2><ol>" + items + "</ol></div>";
    }
    cluesEl.innerHTML = list("A", "Across") + list("D", "Down");

    if (st.solved) {
      msgEl.innerHTML = "<strong>Solved in " + fmtTime(st.time) + ".</strong> Nice reset. Press New puzzle, or head back to what you were doing.";
    } else {
      msgEl.textContent = st.msg;
    }
    save();
  }

  // ---- events ----
  tabsEl.addEventListener("click", (e) => {
    const b = e.target.closest(".tab");
    if (!b) return;
    pi = +b.dataset.p;
    render();
  });
  gridEl.addEventListener("click", (e) => {
    const c = e.target.closest(".cell");
    if (!c) return;
    selectCell(c.dataset.k);
    kb.focus({ preventScroll: true });
  });
  cluesEl.addEventListener("click", (e) => {
    const b = e.target.closest(".clue");
    if (!b) return;
    selectWord(+b.dataset.w);
    kb.focus({ preventScroll: true });
  });
  $("gen").addEventListener("click", newPuzzle);
  $("themeSel").addEventListener("change", () => { store.theme = $("themeSel").value; save(); });
  $("check").addEventListener("click", () => {
    const st = S();
    if (!st) return;
    st.wrong.clear();
    let filled = 0;
    P().cells.forEach((cl) => {
      const v = st.entries[cl.key];
      if (v) { filled++; if (v !== cl.ch) st.wrong.add(cl.key); }
    });
    if (!filled) st.msg = "Nothing to check yet. Fill in a few squares first.";
    else if (!st.wrong.size) st.msg = "Everything you have so far is right.";
    else st.msg = st.wrong.size + (st.wrong.size === 1 ? " letter looks" : " letters look") + " off. They are marked in red.";
    render();
  });
  $("hint").addEventListener("click", () => {
    const st = S();
    if (!st || st.solved) return;
    if (!st.t0) st.t0 = Date.now();
    const cell = P().cells.get(st.sel);
    st.entries[st.sel] = cell.ch;
    st.wrong.delete(st.sel);
    st.msg = "";
    const w = activeWord(), i = w.cells.indexOf(st.sel);
    if (i < w.cells.length - 1) st.sel = w.cells[i + 1];
    checkSolved();
    render();
  });
  $("reset").addEventListener("click", () => {
    const st = S();
    if (!st) return;
    st.entries = {}; st.wrong = new Set(); st.solved = false; st.t0 = 0; st.time = 0; st.msg = "";
    render();
  });
  $("drop").addEventListener("click", () => {
    if (!state.length) return;
    store.puzzles.splice(pi, 1);
    rebuildAll();
    pi = Math.max(0, pi - 1);
    if (!state.length) newPuzzle(); else { save(); render(); }
  });

  // ---- theme management ----
  function say(t) { $("tMsg").textContent = t; }
  function addTheme(name, pairs) {
    name = String(name).trim().slice(0, 40);
    if (!name || BUILTIN[name]) return "Pick a name that is not a built-in theme.";
    if (pairs.length < 6) return "Need at least 6 valid words (3-8 letters, with a clue).";
    store.themes[name] = pairs;
    return "";
  }
  function importObject(obj) {
    let added = 0, skipped = 0;
    if (!obj || typeof obj !== "object" || Array.isArray(obj)) return say("That JSON is not an object of themes.");
    Object.keys(obj).forEach((name) => {
      const list = Array.isArray(obj[name]) ? obj[name] : [];
      const text = list.map((x) => Array.isArray(x) ? x[0] + ", " + x[1] : "").join("\n");
      const parsed = parseLines(text);
      if (addTheme(name, parsed.words)) skipped++; else added++;
    });
    save(); renderThemes();
    say("Imported " + added + " theme" + (added === 1 ? "" : "s") + (skipped ? ", skipped " + skipped + " (too few valid words or name clash)." : "."));
  }
  $("tAdd").addEventListener("click", () => {
    const parsed = parseLines($("tWords").value);
    const err = addTheme($("tName").value, parsed.words);
    if (err) return say(err);
    store.theme = $("tName").value.trim().slice(0, 40);
    save(); renderThemes();
    say("Saved. " + parsed.words.length + " words" + (parsed.bad ? ", " + parsed.bad + " lines skipped." : "."));
    $("tName").value = ""; $("tWords").value = "";
  });
  $("customList").addEventListener("click", (e) => {
    const b = e.target.closest("[data-del]");
    if (!b) return;
    delete store.themes[b.dataset.del];
    if (store.theme === b.dataset.del) store.theme = "*";
    save(); renderThemes();
  });
  $("tFetch").addEventListener("click", () => {
    const url = $("tUrl").value.trim();
    if (!url) return say("Paste a URL first.");
    say("Fetching...");
    fetch(url).then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(importObject)
      .catch((err) => say("Could not load that file (" + err.message + ")."));
  });
  $("tExport").addEventListener("click", () => {
    const out = {};
    Object.keys(store.themes).forEach((n) => { out[n] = store.themes[n]; });
    $("tJson").value = JSON.stringify(out, null, 1);
    say(Object.keys(out).length ? "Copy this into a themes.json in your repo." : "No custom themes to export yet.");
  });
  $("tPaste").addEventListener("click", () => {
    try { importObject(JSON.parse($("tJson").value)); } catch (e) { say("That is not valid JSON."); }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && window.parent !== window) { window.parent.postMessage({ nbr: "close" }, "*"); return; }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const t = e.target;
    if (t && t !== kb && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return;
    if (!state.length) return;
    const k = e.key;
    const onButton = t.closest && t.closest("button");
    if (/^[a-zA-Z]$/.test(k)) { e.preventDefault(); typeLetter(k.toUpperCase()); return; }
    if (k === "Backspace") { e.preventDefault(); backspace(); return; }
    if (k === "ArrowLeft") { e.preventDefault(); move(0, -1); return; }
    if (k === "ArrowRight") { e.preventDefault(); move(0, 1); return; }
    if (k === "ArrowUp") { e.preventDefault(); move(-1, 0); return; }
    if (k === "ArrowDown") { e.preventDefault(); move(1, 0); return; }
    if (onButton) return;
    if (k === "Tab" || k === "Enter") { e.preventDefault(); stepWord(e.shiftKey ? -1 : 1); return; }
    if (k === " ") {
      e.preventDefault();
      const st = S(), cell = P().cells.get(st.sel);
      if (cell.A >= 0 && cell.D >= 0) { st.dir = st.dir === "A" ? "D" : "A"; render(); }
    }
  });
  kb.addEventListener("input", () => {
    const v = kb.value;
    if (v === "") backspace();
    else {
      const ch = v.slice(-1);
      if (/[a-zA-Z]/.test(ch)) typeLetter(ch.toUpperCase());
    }
    kb.value = SENT;
  });

  rebuildAll();
  renderThemes();
  if (!state.length) newPuzzle(); else render();
})();
