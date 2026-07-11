const BOOK_NAMES = [
  'Genesis','Exodus','Leviticus','Numbers','Deuteronomy',
  'Joshua','Judges','Ruth','1 Samuel','2 Samuel',
  '1 Kings','2 Kings','1 Chronicles','2 Chronicles',
  'Ezra','Nehemiah','Esther','Job','Psalms','Proverbs',
  'Ecclesiastes','Song of Solomon','Isaiah','Jeremiah','Lamentations',
  'Ezekiel','Daniel','Hosea','Joel','Amos',
  'Obadiah','Jonah','Micah','Nahum','Habakkuk',
  'Zephaniah','Haggai','Zechariah','Malachi',
  'Matthew','Mark','Luke','John','Acts',
  'Romans','1 Corinthians','2 Corinthians','Galatians','Ephesians',
  'Philippians','Colossians','1 Thessalonians','2 Thessalonians',
  '1 Timothy','2 Timothy','Titus','Philemon','Hebrews',
  'James','1 Peter','2 Peter','1 John','2 John','3 John',
  'Jude','Revelation'
];

let bibleData = null;
let groupingsData = null;

async function loadBible() {
  const url = chrome.runtime.getURL('en_kjv.json');
  const res = await fetch(url);
  const text = await res.text();
  // Handle BOM
  bibleData = JSON.parse(text.charCodeAt(0) === 0xFEFF ? text.slice(1) : text);
}

async function loadGroupings() {
  const url = chrome.runtime.getURL('all_groupings.json');
  const res = await fetch(url);
  groupingsData = await res.json();
}

function populateGroupings() {
  const sel = document.getElementById('groupSelect');
  sel.innerHTML = '';
  if (!groupingsData) return;
  Object.keys(groupingsData).forEach((name) => {
    const opt = document.createElement('option');
    opt.value = name;
    opt.textContent = name + ' (' + groupingsData[name].length + ')';
    sel.appendChild(opt);
  });
  const last = localStorage.getItem('cursive-bible-group') || '';
  if (last && groupingsData[last]) sel.value = last;
}

function toggleGroupingsMode(on) {
  document.getElementById('bibleSection').style.display = on ? 'none' : '';
  document.getElementById('groupSection').style.display = on ? '' : 'none';
  localStorage.setItem('cursive-bible-groupings-mode', on ? '1' : '0');
}

function populateBooks() {
  const sel = document.getElementById('bookSelect');
  BOOK_NAMES.forEach((name, i) => {
    const opt = document.createElement('option');
    opt.value = i;
    opt.textContent = name;
    sel.appendChild(opt);
  });
  // Restore last selection (popup's own storage)
  const lastBook = localStorage.getItem('cursive-bible-book') || '0';
  sel.value = lastBook;
  populateChapters();
}

// Also try to read last position from the page's localStorage (set by the injected panel)
async function restoreFromPage() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) return;
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: function() {
        return {
          book: localStorage.getItem('cursive-bible-last-book'),
          ch: localStorage.getItem('cursive-bible-last-ch')
        };
      }
    });
    if (results && results[0] && results[0].result) {
      var r = results[0].result;
      if (r.book !== null) {
        document.getElementById('bookSelect').value = r.book;
        localStorage.setItem('cursive-bible-book', r.book);
        populateChapters();
        if (r.ch !== null) {
          document.getElementById('chapterSelect').value = r.ch;
          localStorage.setItem('cursive-bible-ch-' + r.book, r.ch);
        }
      }
    }
  } catch (e) { /* ignore if can't access page */ }
}

function populateChapters() {
  const bookIdx = parseInt(document.getElementById('bookSelect').value);
  const sel = document.getElementById('chapterSelect');
  sel.innerHTML = '';
  if (!bibleData || !bibleData[bookIdx]) return;
  const numChapters = bibleData[bookIdx].chapters.length;
  for (let i = 0; i < numChapters; i++) {
    const opt = document.createElement('option');
    opt.value = i;
    opt.textContent = 'Chapter ' + (i + 1);
    sel.appendChild(opt);
  }
  // Restore last chapter for this book
  const lastCh = localStorage.getItem('cursive-bible-ch-' + bookIdx) || '0';
  sel.value = Math.min(parseInt(lastCh), numChapters - 1);
}

document.getElementById('bookSelect').addEventListener('change', () => {
  localStorage.setItem('cursive-bible-book', document.getElementById('bookSelect').value);
  populateChapters();
});

document.getElementById('chapterSelect').addEventListener('change', () => {
  const bookIdx = document.getElementById('bookSelect').value;
  localStorage.setItem('cursive-bible-ch-' + bookIdx, document.getElementById('chapterSelect').value);
});

document.getElementById('groupToggle').addEventListener('change', () => {
  const on = document.getElementById('groupToggle').checked;
  toggleGroupingsMode(on);
});

document.getElementById('groupSelect').addEventListener('change', () => {
  localStorage.setItem('cursive-bible-group', document.getElementById('groupSelect').value);
});

document.getElementById('openBtn').addEventListener('click', async () => {
  const status = document.getElementById('status');
  const groupMode = document.getElementById('groupToggle').checked;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  try {
    if (groupMode) {
      const collectionName = document.getElementById('groupSelect').value;
      const entries = groupingsData[collectionName];
      localStorage.setItem('cursive-bible-group', collectionName);
      const groupingsUrl = chrome.runtime.getURL('all_groupings.json');
      const extUrl = chrome.runtime.getURL('en_kjv.json');
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: injectCursiveModal,
        args: [entries.map(e => e.text), collectionName, 0, -1, -1, extUrl, BOOK_NAMES, { collectionName, entries, groupingsUrl }]
      });
    } else {
      const bookIdx = parseInt(document.getElementById('bookSelect').value);
      const chIdx = parseInt(document.getElementById('chapterSelect').value);
      const bookName = BOOK_NAMES[bookIdx];
      const verses = bibleData[bookIdx].chapters[chIdx];
      const chapterNum = chIdx + 1;
      localStorage.setItem('cursive-bible-book', bookIdx);
      localStorage.setItem('cursive-bible-ch-' + bookIdx, chIdx);
      const extUrl = chrome.runtime.getURL('en_kjv.json');
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: injectCursiveModal,
        args: [verses, bookName, chapterNum, bookIdx, chIdx, extUrl, BOOK_NAMES, null]
      });
    }
    window.close();
  } catch (err) {
    status.textContent = 'Cannot inject on this page';
    status.className = 'error';
  }
});

Promise.all([loadBible(), loadGroupings()]).then(async () => {
  populateBooks();
  populateGroupings();
  // Restore groupings mode
  const wasGroupMode = localStorage.getItem('cursive-bible-groupings-mode') === '1';
  document.getElementById('groupToggle').checked = wasGroupMode;
  toggleGroupingsMode(wasGroupMode);
  await restoreFromPage();
  // Auto-inject the panel immediately
  document.getElementById('openBtn').click();
});

function injectCursiveModal(verses, bookName, chapterNum, bookIdx, chIdx, bibleJsonUrl, bookNames, groupingInfo) {
  var MODAL_ID = '__cursive_bible_modal';
  var existing = document.getElementById(MODAL_ID);
  if (existing) existing.remove();

  // --- State ---
  var isGroupMode = !!groupingInfo;
  var groupCollectionName = isGroupMode ? groupingInfo.collectionName : null;
  var groupEntries = isGroupMode ? groupingInfo.entries : null;
  var groupingsUrl = isGroupMode ? groupingInfo.groupingsUrl : null;
  var allGroupings = null; // loaded on demand for collection switching

  var currentVerses = verses;
  var currentBookName = bookName;
  var currentChapterNum = chapterNum;
  var currentBookIdx = bookIdx;
  var currentChIdx = chIdx;
  var bibleData = null; // loaded on demand for chapter nav

  var savedVerse;
  if (isGroupMode) {
    savedVerse = parseInt(localStorage.getItem('cursive-bible-gverse-' + groupCollectionName) || '0');
  } else {
    savedVerse = parseInt(localStorage.getItem('cursive-bible-verse-' + bookIdx + '-' + chIdx) || '0');
  }
  var bucketIndex = Math.min(savedVerse, currentVerses.length - 1);
  var fontSize = parseInt(localStorage.getItem('cursive-size') || '52');
  var autoAdvance = localStorage.getItem('cursive-auto') === 'true';
  var repeatMode = localStorage.getItem('cursive-repeat') === 'true';
  var revealMode = localStorage.getItem('cursive-reveal') === 'true';
  var syllableMode = localStorage.getItem('cursive-syllable') === 'true';
  var animTimer = null;
  var animRunning = false;

  function savePosition() {
    if (isGroupMode) {
      localStorage.setItem('cursive-bible-gverse-' + groupCollectionName, bucketIndex);
    } else {
      localStorage.setItem('cursive-bible-last-book', currentBookIdx);
      localStorage.setItem('cursive-bible-last-ch', currentChIdx);
      localStorage.setItem('cursive-bible-verse-' + currentBookIdx + '-' + currentChIdx, bucketIndex);
    }
  }

  function syllabifyCore(word) {
    if (word.length <= 2) return word;
    var w = word.toLowerCase();
    var syls = [];
    var vowels = 'aeiouy';
    var isV = function(c) { return vowels.indexOf(c) !== -1; };
    var i = 0;
    var cur = '';
    while (i < w.length) {
      cur += word[i];
      if (isV(w[i])) {
        // Consume consecutive vowels (diphthongs)
        while (i + 1 < w.length && isV(w[i + 1])) { i++; cur += word[i]; }
        // Look ahead at consonants after this vowel cluster
        var consCount = 0;
        var j = i + 1;
        while (j < w.length && !isV(w[j])) { consCount++; j++; }
        if (j < w.length && consCount > 0) {
          // There are more vowels ahead — split consonants between syllables
          var keep = consCount <= 1 ? 0 : (consCount === 2 ? 1 : consCount - 1);
          // Handle common digraphs: don't split th, sh, ch, ph, wh, bl, cl, fl, gl, pl, sl, br, cr, dr, fr, gr, pr, tr
          var afterKeep = w.substring(i + 1 + keep, i + 1 + consCount);
          if (afterKeep.length >= 2) {
            var dig = afterKeep.substring(0, 2);
            var digraphs = ['th','sh','ch','ph','wh','bl','cl','fl','gl','pl','sl','br','cr','dr','fr','gr','pr','tr','sk','sp','st','sc'];
            if (digraphs.indexOf(dig) !== -1 && keep > 0) keep--;
          }
          for (var k = 0; k < keep; k++) { i++; cur += word[i]; }
          syls.push(cur);
          cur = '';
        }
      }
      i++;
    }
    if (cur) syls.push(cur);
    return syls.length > 1 ? syls.join('\u00B7') : word;
  }

  function syllabifyWord(w) {
    var m = w.match(/^(\W*)(.*?)(\W*)$/);
    if (!m) return w;
    var lead = m[1], core = m[2], trail = m[3];
    if (!core) return w;
    return lead + syllabifyCore(core) + trail;
  }

  function loadBibleData() {
    if (bibleData) return Promise.resolve(bibleData);
    return fetch(bibleJsonUrl).then(function(r) { return r.text(); }).then(function(text) {
      bibleData = JSON.parse(text.charCodeAt(0) === 0xFEFF ? text.slice(1) : text);
      return bibleData;
    });
  }

  function goToChapter(newBookIdx, newChIdx, startVerse) {
    loadBibleData().then(function(data) {
      if (!data[newBookIdx] || !data[newBookIdx].chapters[newChIdx]) return;
      currentBookIdx = newBookIdx;
      currentChIdx = newChIdx;
      currentBookName = bookNames[newBookIdx];
      currentChapterNum = newChIdx + 1;
      currentVerses = data[newBookIdx].chapters[newChIdx];
      bucketIndex = startVerse ? Math.min(startVerse - 1, currentVerses.length - 1) : 0;
      // Update UI
      title.textContent = currentBookName + ' ' + currentChapterNum;
      verseSelect.innerHTML = '';
      currentVerses.forEach(function(v, i) {
        var opt = document.createElement('option');
        opt.value = i;
        opt.textContent = 'v' + (i + 1);
        verseSelect.appendChild(opt);
      });
      verseSelect.value = bucketIndex;
      savePosition();
      renderAndAnimate();
    });
  }

  // --- Book name to index parser ---
  var bookNameMap = {};
  // Build from bookNames array (lowercase full names)
  bookNames.forEach(function(name, i) { bookNameMap[name.toLowerCase()] = i; });
  // Abbreviations and short forms
  var aliases = {
    'gn':'Genesis','gen':'Genesis','genesis':'Genesis',
    'ex':'Exodus','exod':'Exodus','exodus':'Exodus',
    'lv':'Leviticus','lev':'Leviticus','leviticus':'Leviticus',
    'nm':'Numbers','num':'Numbers','numbers':'Numbers',
    'dt':'Deuteronomy','deut':'Deuteronomy','deuteronomy':'Deuteronomy',
    'js':'Joshua','josh':'Joshua','joshua':'Joshua',
    'jud':'Judges','judg':'Judges','judges':'Judges',
    'rt':'Ruth','ruth':'Ruth',
    '1sm':'1 Samuel','1sam':'1 Samuel','1samuel':'1 Samuel','1 sam':'1 Samuel',
    '2sm':'2 Samuel','2sam':'2 Samuel','2samuel':'2 Samuel','2 sam':'2 Samuel',
    '1kgs':'1 Kings','1ki':'1 Kings','1kings':'1 Kings','1 ki':'1 Kings',
    '2kgs':'2 Kings','2ki':'2 Kings','2kings':'2 Kings','2 ki':'2 Kings',
    '1ch':'1 Chronicles','1chr':'1 Chronicles','1chronicles':'1 Chronicles','1 chr':'1 Chronicles',
    '2ch':'2 Chronicles','2chr':'2 Chronicles','2chronicles':'2 Chronicles','2 chr':'2 Chronicles',
    'ezr':'Ezra','ezra':'Ezra',
    'ne':'Nehemiah','neh':'Nehemiah','nehemiah':'Nehemiah',
    'et':'Esther','esth':'Esther','esther':'Esther',
    'job':'Job',
    'ps':'Psalms','psa':'Psalms','psalm':'Psalms','psalms':'Psalms',
    'prv':'Proverbs','prov':'Proverbs','proverbs':'Proverbs',
    'ec':'Ecclesiastes','eccl':'Ecclesiastes','ecclesiastes':'Ecclesiastes',
    'so':'Song of Solomon','song':'Song of Solomon','sos':'Song of Solomon','song of solomon':'Song of Solomon',
    'is':'Isaiah','isa':'Isaiah','isaiah':'Isaiah',
    'jr':'Jeremiah','jer':'Jeremiah','jeremiah':'Jeremiah',
    'lm':'Lamentations','lam':'Lamentations','lamentations':'Lamentations',
    'ez':'Ezekiel','ezek':'Ezekiel','ezekiel':'Ezekiel',
    'dn':'Daniel','dan':'Daniel','daniel':'Daniel',
    'ho':'Hosea','hos':'Hosea','hosea':'Hosea',
    'jl':'Joel','joel':'Joel',
    'am':'Amos','amos':'Amos',
    'ob':'Obadiah','obad':'Obadiah','obadiah':'Obadiah',
    'jn':'Jonah','jonah':'Jonah',
    'mi':'Micah','mic':'Micah','micah':'Micah',
    'na':'Nahum','nah':'Nahum','nahum':'Nahum',
    'hk':'Habakkuk','hab':'Habakkuk','habakkuk':'Habakkuk',
    'zp':'Zephaniah','zeph':'Zephaniah','zephaniah':'Zephaniah',
    'hg':'Haggai','hag':'Haggai','haggai':'Haggai',
    'zc':'Zechariah','zech':'Zechariah','zechariah':'Zechariah',
    'ml':'Malachi','mal':'Malachi','malachi':'Malachi',
    'mt':'Matthew','matt':'Matthew','matthew':'Matthew',
    'mk':'Mark','mark':'Mark',
    'lk':'Luke','luke':'Luke',
    'jo':'John','joh':'John','john':'John',
    'act':'Acts','acts':'Acts',
    'rm':'Romans','rom':'Romans','romans':'Romans',
    '1co':'1 Corinthians','1cor':'1 Corinthians','1corinthians':'1 Corinthians','1 cor':'1 Corinthians',
    '2co':'2 Corinthians','2cor':'2 Corinthians','2corinthians':'2 Corinthians','2 cor':'2 Corinthians',
    'gl':'Galatians','gal':'Galatians','galatians':'Galatians',
    'eph':'Ephesians','ephesians':'Ephesians',
    'ph':'Philippians','phil':'Philippians','philippians':'Philippians',
    'cl':'Colossians','col':'Colossians','colossians':'Colossians',
    '1ts':'1 Thessalonians','1thess':'1 Thessalonians','1thessalonians':'1 Thessalonians','1 thess':'1 Thessalonians',
    '2ts':'2 Thessalonians','2thess':'2 Thessalonians','2thessalonians':'2 Thessalonians','2 thess':'2 Thessalonians',
    '1tm':'1 Timothy','1tim':'1 Timothy','1timothy':'1 Timothy','1 tim':'1 Timothy',
    '2tm':'2 Timothy','2tim':'2 Timothy','2timothy':'2 Timothy','2 tim':'2 Timothy',
    'tt':'Titus','titus':'Titus',
    'phm':'Philemon','philemon':'Philemon','phlm':'Philemon',
    'hb':'Hebrews','heb':'Hebrews','hebrews':'Hebrews',
    'jm':'James','jas':'James','james':'James',
    '1pe':'1 Peter','1pet':'1 Peter','1peter':'1 Peter','1 pet':'1 Peter',
    '2pe':'2 Peter','2pet':'2 Peter','2peter':'2 Peter','2 pet':'2 Peter',
    '1jo':'1 John','1joh':'1 John','1john':'1 John','1 john':'1 John',
    '2jo':'2 John','2joh':'2 John','2john':'2 John','2 john':'2 John',
    '3jo':'3 John','3joh':'3 John','3john':'3 John','3 john':'3 John',
    'jd':'Jude','jude':'Jude',
    're':'Revelation','rev':'Revelation','revelation':'Revelation'
  };
  Object.keys(aliases).forEach(function(k) {
    var fullName = aliases[k];
    var idx = bookNameMap[fullName.toLowerCase()];
    if (idx !== undefined) bookNameMap[k] = idx;
  });

  var wordNums = {zero:0,one:1,two:2,three:3,four:4,five:5,six:6,seven:7,eight:8,nine:9,ten:10,eleven:11,twelve:12,thirteen:13,fourteen:14,fifteen:15,sixteen:16,seventeen:17,eighteen:18,nineteen:19,twenty:20,thirty:30,forty:40,fifty:50,sixty:60,seventy:70,eighty:80,ninety:90,hundred:100};
  function wordsToNum(s) {
    s = s.trim().toLowerCase();
    if (!isNaN(Number(s)) && s !== '') return Number(s);
    var n = 0;
    s.replace(/-/g, ' ').split(/\s+/).forEach(function(x) {
      if (wordNums[x] !== undefined) n += wordNums[x];
    });
    return n > 0 ? n : null;
  }

  function parseRef(input) {
    var trimmed = input.trim().toLowerCase();
    if (!trimmed) return null;
    // Plain number or word-number → chapter in current book (e.g. "19", "nineteen", "twenty-two")
    var numOnly = trimmed.match(/^(\d+)(?::(\d+))?$/);
    if (numOnly) {
      var ch = parseInt(numOnly[1]);
      var vs = numOnly[2] ? parseInt(numOnly[2]) : null;
      return { bookIdx: currentBookIdx, chapter: ch - 1, verse: vs };
    }
    // Try word-based number (e.g. "nineteen", "twenty two", "twenty-two")
    var wordCh = wordsToNum(trimmed);
    if (wordCh !== null) {
      return { bookIdx: currentBookIdx, chapter: wordCh - 1, verse: null };
    }
    // Match: bookName chapter:verse  or  bookName chapter
    var m = trimmed.match(/^(\d?\s*[a-z]+(?:\s+of\s+[a-z]+)?(?:\s+[a-z]+)?)\s+(\d+)(?::(\d+))?$/);
    if (m) {
      var bookStr = m[1].trim();
      var ch = parseInt(m[2]);
      var vs = m[3] ? parseInt(m[3]) : null;
      var idx = bookNameMap[bookStr];
      if (idx !== undefined) return { bookIdx: idx, chapter: ch - 1, verse: vs };
      // Try without trailing word (e.g. "song of solomon" already handled, but "1 samuel" needs check)
    }
    // Try just book name (go to chapter 1)
    var idx2 = bookNameMap[trimmed];
    if (idx2 !== undefined) return { bookIdx: idx2, chapter: 0, verse: null };
    return null;
  }

  function showRefModal() {
    var refOverlay = document.getElementById(MODAL_ID + '-ref');
    if (refOverlay) { refOverlay.remove(); return; }
    refOverlay = document.createElement('div');
    refOverlay.id = MODAL_ID + '-ref';
    refOverlay.style.cssText = 'position:fixed;top:0;right:0;width:50%;height:100%;background:rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;z-index:2147483647;';
    var box = document.createElement('div');
    box.style.cssText = 'background:#fff;border-radius:12px;padding:20px;width:85%;max-width:380px;box-shadow:0 10px 40px rgba(0,0,0,0.3);';
    var heading = document.createElement('div');
    heading.style.cssText = 'font-size:15px;font-weight:700;color:#333;text-align:center;margin-bottom:12px;';
    heading.textContent = 'Go to Reference';
    box.appendChild(heading);
    var refInput = document.createElement('input');
    refInput.type = 'text';
    refInput.placeholder = 'e.g. Ps 23, John 3:16, 1co 13';
    refInput.style.cssText = 'width:100%;padding:10px;font-size:14px;border:1px solid #ccc;border-radius:6px;outline:none;box-sizing:border-box;';
    box.appendChild(refInput);
    var hint = document.createElement('div');
    hint.style.cssText = 'font-size:11px;color:#888;margin-top:6px;';
    hint.textContent = 'Book Chapter:Verse, or number/word for chapter (e.g. 19, nineteen)';
    box.appendChild(hint);
    var errMsg = document.createElement('div');
    errMsg.style.cssText = 'font-size:12px;color:#c0392b;margin-top:6px;display:none;';
    box.appendChild(errMsg);
    var btnRow = document.createElement('div');
    btnRow.style.cssText = 'display:flex;gap:8px;margin-top:14px;';
    var goBtn = document.createElement('button');
    goBtn.style.cssText = 'flex:1;padding:10px;background:#3b82f6;color:#fff;border:none;border-radius:6px;font-size:14px;font-weight:700;cursor:pointer;';
    goBtn.textContent = 'Go';
    var cancelBtn = document.createElement('button');
    cancelBtn.style.cssText = 'flex:1;padding:10px;background:#e5e7eb;color:#333;border:none;border-radius:6px;font-size:14px;font-weight:600;cursor:pointer;';
    cancelBtn.textContent = 'Cancel';
    btnRow.appendChild(goBtn);
    btnRow.appendChild(cancelBtn);
    box.appendChild(btnRow);
    refOverlay.appendChild(box);
    // Insert inside the panel (modal within modal)
    panel.appendChild(refOverlay);
    setTimeout(function() { refInput.focus(); }, 50);

    function doGo() {
      var parsed = parseRef(refInput.value);
      if (!parsed) {
        errMsg.style.display = 'block';
        errMsg.textContent = 'Could not parse reference. Try: John 3:16';
        return;
      }
      refOverlay.remove();
      goToChapter(parsed.bookIdx, parsed.chapter, parsed.verse);
    }
    goBtn.onclick = doGo;
    refInput.addEventListener('keydown', function(e) {
      e.stopPropagation(); // don't trigger panel shortcuts
      if (e.key === 'Enter') doGo();
      if (e.key === 'Escape') refOverlay.remove();
    });
    cancelBtn.onclick = function() { refOverlay.remove(); };
    refOverlay.addEventListener('click', function(e) {
      if (e.target === refOverlay) refOverlay.remove();
    });
  }

  // --- Load font ---
  if (!document.getElementById('__cursive_font_link')) {
    var fontLink = document.createElement('link');
    fontLink.id = '__cursive_font_link';
    fontLink.rel = 'stylesheet';
    fontLink.href = 'https://fonts.googleapis.com/css?family=Alex+Brush&display=swap';
    document.head.appendChild(fontLink);
  }

  // --- Styles ---
  var styleId = '__cursive_bible_styles';
  var existingStyle = document.getElementById(styleId);
  if (existingStyle) existingStyle.remove();
  var style = document.createElement('style');
  style.id = styleId;
  style.textContent = '\
    #' + MODAL_ID + ' { position:fixed; top:0; right:0; width:50%; height:100%; z-index:2147483647; display:flex; flex-direction:column; background:#f5f0e8; font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; box-shadow:-4px 0 20px rgba(0,0,0,0.3); }\
    #' + MODAL_ID + ' * { box-sizing:border-box; }\
    .' + MODAL_ID + '-toolbar { display:flex; flex-wrap:wrap; align-items:center; gap:6px; padding:8px 12px; background:#e8dcc8; border-bottom:2px solid #c9b99a; min-height:40px; }\
    .' + MODAL_ID + '-toolbar button { padding:4px 10px; border:none; border-radius:4px; font-size:12px; font-weight:700; cursor:pointer; color:#fff; }\
    .' + MODAL_ID + '-toolbar select { padding:3px 6px; border:1px solid #c9b99a; border-radius:4px; font-size:12px; background:#fff; cursor:pointer; }\
    .' + MODAL_ID + '-toolbar label { font-size:11px; color:#5a4a30; display:flex; align-items:center; gap:3px; cursor:pointer; }\
    .' + MODAL_ID + '-output { flex:1; overflow-y:auto; padding:24px 24px; background:#f5f0e8; background-image:repeating-linear-gradient(transparent,transparent 31px,#c9b99a 31px,#c9b99a 32px); }\
    .' + MODAL_ID + '-verse-ref { font-size:13px; color:#8b7355; margin-bottom:4px; font-weight:600; font-family:sans-serif; }\
    .' + MODAL_ID + '-word { opacity:0; display:inline; }\
  ';
  document.head.appendChild(style);

  // --- Build panel ---
  var panel = document.createElement('div');
  panel.id = MODAL_ID;

  // Toolbar
  var toolbar = document.createElement('div');
  toolbar.className = MODAL_ID + '-toolbar';

  // Title
  var title = document.createElement('span');
  title.style.cssText = 'font-size:13px;color:#5a4a30;font-weight:700;margin-right:4px;';
  title.textContent = isGroupMode ? groupCollectionName : (bookName + ' ' + chapterNum);
  toolbar.appendChild(title);

  // Ref button
  var refBtn = document.createElement('button');
  refBtn.style.background = '#3b82f6';
  refBtn.textContent = 'Ref(r)';
  refBtn.title = 'Go to a Bible reference (r)';
  refBtn.onclick = function() { showRefModal(); };
  toolbar.appendChild(refBtn);

  // Verse dropdown
  var verseSelect = document.createElement('select');
  verseSelect.title = 'Jump to verse';
  currentVerses.forEach(function(v, i) {
    var opt = document.createElement('option');
    opt.value = i;
    opt.textContent = 'v' + (i + 1);
    verseSelect.appendChild(opt);
  });
  verseSelect.value = bucketIndex;
  verseSelect.onchange = function() {
    bucketIndex = parseInt(verseSelect.value);
    savePosition();
    renderAndAnimate();
  };
  toolbar.appendChild(verseSelect);

  // Prev
  var prevBtn = document.createElement('button');
  prevBtn.style.background = '#888';
  prevBtn.textContent = 'p [';
  prevBtn.title = 'Previous verse ([)';
  prevBtn.onclick = function() {
    if (bucketIndex > 0) {
      bucketIndex--;
      verseSelect.value = bucketIndex;
      savePosition();
      renderAndAnimate();
    }
  };
  toolbar.appendChild(prevBtn);

  // Next
  var nextBtn = document.createElement('button');
  nextBtn.style.background = '#888';
  nextBtn.textContent = 'n ]';
  nextBtn.title = 'Next verse (])';
  nextBtn.onclick = function() {
    if (bucketIndex < currentVerses.length - 1) {
      bucketIndex++;
      verseSelect.value = bucketIndex;
      savePosition();
      renderAndAnimate();
    }
  };
  toolbar.appendChild(nextBtn);

  // Next Chapter / Next Collection
  var nextChBtn = document.createElement('button');
  nextChBtn.style.background = 'linear-gradient(45deg,#b8860b,#d4a855)';
  nextChBtn.textContent = isGroupMode ? 'Next Col' : 'Next Ch';
  nextChBtn.title = isGroupMode ? 'Next collection' : 'Next chapter';
  nextChBtn.onclick = function() {
    if (isGroupMode) {
      loadGroupingsData().then(function(data) {
        var keys = Object.keys(data);
        var curIdx = keys.indexOf(groupCollectionName);
        if (curIdx < keys.length - 1) {
          grpSelect.value = keys[curIdx + 1];
          grpSelect.onchange();
        }
      });
    } else {
      loadBibleData().then(function(data) {
        var newBookIdx = currentBookIdx;
        var newChIdx = currentChIdx + 1;
        if (newChIdx >= data[newBookIdx].chapters.length) {
          if (newBookIdx < data.length - 1) {
            newBookIdx++;
            newChIdx = 0;
          } else {
            return;
          }
        }
        goToChapter(newBookIdx, newChIdx);
      });
    }
  };
  toolbar.appendChild(nextChBtn);

  // Copy button
  var copyBtn = document.createElement('button');
  copyBtn.style.background = '#6b7280';
  copyBtn.textContent = 'Copy \\';
  copyBtn.title = 'Copy current verse text to clipboard';
  copyBtn.onclick = function() {
    var verse = currentVerses[bucketIndex];
    if (isGroupMode && groupEntries && groupEntries[bucketIndex]) {
      verse = groupEntries[bucketIndex].reference + ' — ' + verse;
    }
    navigator.clipboard.writeText(verse).then(function() {
      copyBtn.textContent = 'Copied!';
      setTimeout(function() { copyBtn.textContent = 'Copy \\'; }, 1500);
    });
  };
  toolbar.appendChild(copyBtn);

  // Syllable toggle
  var sylBtn = document.createElement('button');
  sylBtn.style.background = syllableMode ? '#4338ca' : '#6366f1';
  sylBtn.textContent = syllableMode ? 'Syl: ON' : 'Syllable';
  sylBtn.title = 'Show syllable breaks';
  sylBtn.onclick = function() {
    syllableMode = !syllableMode;
    localStorage.setItem('cursive-syllable', syllableMode);
    sylBtn.textContent = syllableMode ? 'Syl: ON' : 'Syllable';
    sylBtn.style.background = syllableMode ? '#4338ca' : '#6366f1';
    renderAndAnimate();
  };
  toolbar.appendChild(sylBtn);

  // Font size
  var sizeDown = document.createElement('button');
  sizeDown.style.background = '#777';
  sizeDown.textContent = 'A-';
  sizeDown.onclick = function() {
    fontSize = Math.max(28, fontSize - 4);
    localStorage.setItem('cursive-size', fontSize);
    outputArea.style.fontSize = fontSize + 'px';
  };
  toolbar.appendChild(sizeDown);

  var sizeUp = document.createElement('button');
  sizeUp.style.background = '#777';
  sizeUp.textContent = 'A+';
  sizeUp.onclick = function() {
    fontSize = Math.min(80, fontSize + 4);
    localStorage.setItem('cursive-size', fontSize);
    outputArea.style.fontSize = fontSize + 'px';
  };
  toolbar.appendChild(sizeUp);

  // Auto
  var autoLabel = document.createElement('label');
  var autoCb = document.createElement('input');
  autoCb.type = 'checkbox';
  autoCb.checked = autoAdvance;
  autoCb.onchange = function() {
    autoAdvance = autoCb.checked;
    localStorage.setItem('cursive-auto', autoAdvance);
  };
  autoLabel.appendChild(autoCb);
  autoLabel.appendChild(document.createTextNode(' Auto'));
  toolbar.appendChild(autoLabel);

  // Repeat
  var repeatLabel = document.createElement('label');
  var repeatCb = document.createElement('input');
  repeatCb.type = 'checkbox';
  repeatCb.checked = repeatMode;
  repeatCb.onchange = function() {
    repeatMode = repeatCb.checked;
    localStorage.setItem('cursive-repeat', repeatMode);
  };
  repeatLabel.appendChild(repeatCb);
  repeatLabel.appendChild(document.createTextNode(' Repeat'));
  toolbar.appendChild(repeatLabel);

  // Reveal
  var revealLabel = document.createElement('label');
  var revealCb = document.createElement('input');
  revealCb.type = 'checkbox';
  revealCb.checked = revealMode;
  revealCb.onchange = function() {
    revealMode = revealCb.checked;
    localStorage.setItem('cursive-reveal', revealMode);
    renderAndAnimate();
  };
  revealLabel.appendChild(revealCb);
  revealLabel.appendChild(document.createTextNode(' Reveal'));
  toolbar.appendChild(revealLabel);

  // Groupings toggle + dropdown (in toolbar)
  var grpLabel = document.createElement('label');
  var grpCb = document.createElement('input');
  grpCb.type = 'checkbox';
  grpCb.checked = isGroupMode;
  grpLabel.appendChild(grpCb);
  grpLabel.appendChild(document.createTextNode(' Grp'));
  toolbar.appendChild(grpLabel);

  var grpSelect = document.createElement('select');
  grpSelect.title = 'Switch collection';
  grpSelect.style.display = isGroupMode ? '' : 'none';
  // Populate once groupings are loaded
  function populateGrpSelect(data) {
    grpSelect.innerHTML = '';
    Object.keys(data).forEach(function(name) {
      var opt = document.createElement('option');
      opt.value = name;
      opt.textContent = name;
      grpSelect.appendChild(opt);
    });
    if (groupCollectionName) grpSelect.value = groupCollectionName;
  }

  function loadGroupingsData() {
    if (allGroupings) return Promise.resolve(allGroupings);
    var url = groupingsUrl || bibleJsonUrl.replace('en_kjv.json', 'all_groupings.json');
    return fetch(url).then(function(r) { return r.json(); }).then(function(data) {
      allGroupings = data;
      populateGrpSelect(data);
      return data;
    });
  }

  function switchToGroup(name) {
    loadGroupingsData().then(function(data) {
      isGroupMode = true;
      groupCollectionName = name;
      groupEntries = data[name];
      currentVerses = groupEntries.map(function(e) { return e.text; });
      bucketIndex = parseInt(localStorage.getItem('cursive-bible-gverse-' + name) || '0');
      bucketIndex = Math.min(bucketIndex, currentVerses.length - 1);
      title.textContent = groupCollectionName;
      nextChBtn.textContent = 'Next Col';
      nextChBtn.title = 'Next collection';
      verseSelect.innerHTML = '';
      currentVerses.forEach(function(v, i) {
        var opt = document.createElement('option');
        opt.value = i;
        opt.textContent = 'v' + (i + 1);
        verseSelect.appendChild(opt);
      });
      verseSelect.value = bucketIndex;
      localStorage.setItem('cursive-bible-group', name);
      localStorage.setItem('cursive-bible-groupings-mode', '1');
      savePosition();
      renderAndAnimate();
    });
  }

  function switchToBible() {
    isGroupMode = false;
    groupCollectionName = null;
    groupEntries = null;
    nextChBtn.textContent = 'Next Ch';
    nextChBtn.title = 'Next chapter';
    localStorage.setItem('cursive-bible-groupings-mode', '0');
    // Restore last Bible position
    loadBibleData().then(function(data) {
      var lastBook = parseInt(localStorage.getItem('cursive-bible-last-book') || '0');
      var lastCh = parseInt(localStorage.getItem('cursive-bible-last-ch') || '0');
      goToChapter(lastBook, lastCh);
    });
  }

  grpCb.onchange = function() {
    if (grpCb.checked) {
      grpSelect.style.display = '';
      loadGroupingsData().then(function(data) {
        var name = grpSelect.value || Object.keys(data)[0];
        switchToGroup(name);
      });
    } else {
      grpSelect.style.display = 'none';
      switchToBible();
    }
  };

  grpSelect.onchange = function() {
    switchToGroup(grpSelect.value);
  };

  toolbar.appendChild(grpSelect);

  // Pre-load groupings dropdown if already in group mode
  if (isGroupMode) loadGroupingsData();

  // Close
  var closeBtn = document.createElement('button');
  closeBtn.style.cssText = 'background:#c0392b; margin-left:auto;';
  closeBtn.textContent = 'X';
  closeBtn.title = 'Close';
  closeBtn.onclick = function() {
    savePosition();
    stopAnim();
    panel.remove();
  };
  toolbar.appendChild(closeBtn);

  panel.appendChild(toolbar);

  // Output area
  var outputArea = document.createElement('div');
  outputArea.className = MODAL_ID + '-output';
  outputArea.style.cssText = "font-family:'Alex Brush',cursive; font-size:" + fontSize + "px; font-weight:bold; line-height:1.25; color:#1a1209; word-break:break-word;";
  panel.appendChild(outputArea);

  document.body.appendChild(panel);

  // --- Keyboard ---
  function onKey(e) {
    if (!document.getElementById(MODAL_ID)) {
      document.removeEventListener('keydown', onKey);
      return;
    }
    // Skip shortcuts if ref modal is open
    if (document.getElementById(MODAL_ID + '-ref')) return;
    if (e.key === 'Escape') {
      savePosition();
      stopAnim();
      panel.remove();
    } else if (e.key === 'r') {
      e.preventDefault();
      showRefModal();
    } else if (e.key === ']') {
      e.preventDefault();
      nextBtn.click();
    } else if (e.key === '[') {
      e.preventDefault();
      prevBtn.click();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      outputArea.scrollTop += 40;
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      outputArea.scrollTop -= 40;
    } else if (e.key === '\\') {
      e.preventDefault();
      copyBtn.click();
    }
  }
  document.addEventListener('keydown', onKey);

  // --- Animation ---
  function stopAnim() {
    animRunning = false;
    if (animTimer) { clearTimeout(animTimer); animTimer = null; }
  }

  function renderAndAnimate() {
    stopAnim();
    outputArea.innerHTML = '';
    savePosition();

    var verse = currentVerses[bucketIndex];
    var verseNum = bucketIndex + 1;

    // Verse reference
    var refDiv = document.createElement('div');
    refDiv.className = MODAL_ID + '-verse-ref';
    if (isGroupMode && groupEntries && groupEntries[bucketIndex]) {
      refDiv.textContent = groupEntries[bucketIndex].reference;
    } else {
      refDiv.textContent = currentBookName + ' ' + currentChapterNum + ':' + verseNum;
    }
    outputArea.appendChild(refDiv);

    // Split into words
    var words = verse.split(/\s+/);
    var spans = [];
    words.forEach(function(word, i) {
      var span = document.createElement('span');
      span.className = MODAL_ID + '-word';
      span.textContent = (syllableMode ? syllabifyWord(word) : word) + ' ';
      outputArea.appendChild(span);
      spans.push(span);
    });

    // Reveal mode: show all text immediately
    if (revealMode) {
      spans.forEach(function(s) { s.style.opacity = '1'; });
      return;
    }

    // Speed 3 hardcoded (matching BibleApp level 3)
    var fadeMs = 350;
    var delayMs = 280;

    // Animate
    animRunning = true;
    var idx = 0;

    function revealNext() {
      if (!animRunning || idx >= spans.length) {
        animRunning = false;
        if (idx >= spans.length) {
          if (repeatMode) {
            // Repeat current verse
            animTimer = setTimeout(function() { renderAndAnimate(); }, 1200);
          } else if (autoAdvance) {
            if (bucketIndex < currentVerses.length - 1) {
              // Auto-advance to next verse
              animTimer = setTimeout(function() {
                bucketIndex++;
                verseSelect.value = bucketIndex;
                savePosition();
                renderAndAnimate();
              }, 1200);
            } else {
              // Last verse — auto-advance to next chapter
              animTimer = setTimeout(function() { nextChBtn.click(); }, 1200);
            }
          }
        }
        return;
      }
      var span = spans[idx];
      span.style.transition = 'opacity ' + fadeMs + 'ms ease';
      span.style.opacity = '1';
      idx++;

      // Auto-scroll
      if (span.offsetTop + span.offsetHeight > outputArea.scrollTop + outputArea.clientHeight - 40) {
        outputArea.scrollTop = span.offsetTop - outputArea.clientHeight + 80;
      }

      animTimer = setTimeout(revealNext, delayMs);
    }

    // Small delay before starting
    animTimer = setTimeout(revealNext, 300);
  }

  // Auto-start
  renderAndAnimate();
}
