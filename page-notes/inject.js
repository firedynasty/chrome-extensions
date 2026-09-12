// Page Notes — inject.js
// Floating scratchpad, injected into the active tab. You never see or load
// what's already in the doc — you just write. Typing is auto-persisted
// locally per-page (survives closing/reloading the tab), and clicking Save
// appends what you wrote to the end of whichever Google Doc you picked from
// "Recent", then clears the scratchpad. Nothing is sent anywhere until you
// click Save — no background timers, no silent network calls.
// The target doc follows you across every page, via chrome.storage.local key
// 'pgn:lastFile' (just {id, name} — never the note content).
// Version-stamped singleton: stale injections tear down automatically on upgrade.

(() => {
  const PGN_VERSION = 6; // v6: manual Save only — dropped the 60s auto-append (duplication risk)

  // Stale version — tear down then rebuild.
  if (window.__pgn && window.__pgn.version !== PGN_VERSION) {
    window.__pgn.teardown();
    window.__pgn = null;
  }

  // Same version already open — toggle off.
  if (window.__pgn) {
    window.__pgn.teardown();
    window.__pgn = null;
    return;
  }

  const LAST_FILE_KEY = 'pgn:lastFile'; // {id, name} — extension-wide, not per-URL

  // ── Auth relay (chrome.identity isn't available in a content script) ─────
  function getToken(interactive) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: 'PGN_GET_TOKEN', interactive: !!interactive }, (resp) => {
        resolve(resp && resp.token ? resp.token : null);
      });
    });
  }
  function signOutToken() {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: 'PGN_SIGN_OUT' }, () => resolve());
    });
  }

  build();

  function build() {
    let draftSaveTimer = null;
    let gToken = null;
    let currentFile = null;     // { id, name } — the append TARGET, never fetched/displayed
    // Draft persistence is separate from the append target: per-URL, so closing
    // or reloading THIS page always restores what you were writing here, even
    // before it's been signed-in/targeted/flushed to a Doc.
    const DRAFT_KEY = 'pgn:draft:' + location.href;

    // ── Panel ──────────────────────────────────────────────────────────────
    const panel = document.createElement('div');
    panel.id = '__pgn_panel';
    Object.assign(panel.style, {
      position:     'fixed',
      bottom:       '24px',
      right:        '24px',
      width:        '375px',
      background:   '#fffde7',
      border:       '1px solid #f9c900',
      borderRadius: '6px',
      boxShadow:    '4px 4px 14px rgba(0,0,0,0.22)',
      fontFamily:   'sans-serif',
      fontSize:     '13px',
      zIndex:       '2147483647',
      display:      'flex',
      flexDirection:'column',
      userSelect:   'none',
    });

    // ── Header (drag handle) ───────────────────────────────────────────────
    const header = document.createElement('div');
    Object.assign(header.style, {
      background:   '#ffe600',
      padding:      '6px 10px',
      borderRadius: '6px 6px 0 0',
      cursor:       'grab',
      display:      'flex',
      justifyContent: 'space-between',
      alignItems:   'center',
    });

    const title = document.createElement('span');
    title.textContent = 'Page Notes';
    Object.assign(title.style, {
      fontWeight: 'bold',
      fontSize:   '12px',
      color:      '#5a4800',
      letterSpacing: '0.03em',
    });

    // ── Font-size controls ─────────────────────────────────────────────────
    let fontSize = 13;

    const fsControls = document.createElement('div');
    Object.assign(fsControls.style, {
      display:    'flex',
      alignItems: 'center',
      gap:        '2px',
    });

    function makeFsBtn(label) {
      const b = document.createElement('button');
      b.textContent = label;
      Object.assign(b.style, {
        background:   '#ffe600',
        border:       '1px solid #c9a800',
        borderRadius: '3px',
        cursor:       'pointer',
        fontSize:     '13px',
        lineHeight:   '1',
        color:        '#5a4800',
        padding:      '1px 5px',
        fontWeight:   'bold',
        userSelect:   'none',
      });
      return b;
    }

    const decBtn = makeFsBtn(String.fromCharCode(0x2212)); // minus sign
    const incBtn = makeFsBtn('+');

    function applyFontSize() {
      ta.style.fontSize = fontSize + 'px';
    }

    decBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (fontSize > 8) { fontSize--; applyFontSize(); }
    });
    incBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      fontSize++;
      applyFontSize();
    });

    fsControls.appendChild(decBtn);
    fsControls.appendChild(incBtn);

    const closeBtn = document.createElement('button');
    closeBtn.textContent = String.fromCharCode(0xD7); // x
    Object.assign(closeBtn.style, {
      background:  'none',
      border:      'none',
      cursor:      'pointer',
      fontSize:    '18px',
      lineHeight:  '1',
      color:       '#5a4800',
      padding:     '0 2px',
      fontWeight:  'bold',
    });

    header.appendChild(title);
    header.appendChild(fsControls);
    header.appendChild(closeBtn);

    // ── Google row: Sign In / Recent ▾ / current doc name ───────────────────
    const googleRow = document.createElement('div');
    Object.assign(googleRow.style, {
      display:    'flex',
      alignItems: 'center',
      gap:        '6px',
      padding:    '6px 10px',
      borderBottom: '1px solid #f0d700',
      cursor:     'default',
    });

    function makeGBtn(label) {
      const b = document.createElement('button');
      b.textContent = label;
      Object.assign(b.style, {
        background:   'white',
        border:       '1px solid #c9a800',
        borderRadius: '4px',
        cursor:       'pointer',
        fontSize:     '11px',
        color:        '#5a4800',
        padding:      '3px 8px',
        fontWeight:   '600',
        whiteSpace:   'nowrap',
      });
      return b;
    }

    const signInBtn = makeGBtn('Sign In');
    const recentWrapper = document.createElement('div');
    Object.assign(recentWrapper.style, { position: 'relative' });
    const recentBtn = makeGBtn('Recent ▾');
    recentBtn.disabled = true;
    recentBtn.style.opacity = '0.5';

    const recentDropdown = document.createElement('div');
    Object.assign(recentDropdown.style, {
      position: 'absolute',
      top: '100%',
      left: '0',
      marginTop: '4px',
      zIndex: '2147483647',
      background: 'white',
      border: '1px solid #ddd',
      borderRadius: '6px',
      boxShadow: '0 4px 14px rgba(0,0,0,0.2)',
      minWidth: '220px',
      maxWidth: '340px',
      maxHeight: '220px',
      overflowY: 'auto',
      display: 'none',
    });
    recentWrapper.appendChild(recentBtn);
    recentWrapper.appendChild(recentDropdown);

    const docName = document.createElement('span');
    Object.assign(docName.style, {
      fontSize: '11px',
      color: '#5a4800',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
      flex: '1',
    });

    const saveBtn = makeGBtn('Save');

    googleRow.appendChild(signInBtn);
    googleRow.appendChild(recentWrapper);
    googleRow.appendChild(docName);
    googleRow.appendChild(saveBtn);

    // ── Textarea ───────────────────────────────────────────────────────────
    const ta = document.createElement('textarea');
    Object.assign(ta.style, {
      width:       '100%',
      height:      '420px',
      minHeight:   '100px',
      border:      'none',
      background:  '#fffde7',
      padding:     '10px',
      fontFamily:  'sans-serif',
      fontSize:    '13px',
      lineHeight:  '1.5',
      resize:      'vertical',
      outline:     'none',
      boxSizing:   'border-box',
      color:       '#333',
    });
    ta.value       = '';
    ta.placeholder = 'Sign in, pick a Google Doc from Recent ▾, write your note, then click Save.';
    ta.spellcheck  = true;
    // Always writable — this is a scratchpad, not a view of the doc. Only the
    // network append (below) requires being signed in with a doc picked.

    // ── Status bar ─────────────────────────────────────────────────────────
    const status = document.createElement('div');
    Object.assign(status.style, {
      padding:    '3px 10px',
      fontSize:   '10px',
      color:      '#a08000',
      borderTop:  '1px solid #f0d700',
      display:    'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      background: '#fffde7',
      borderRadius: '0 0 6px 6px',
    });

    const statusText = document.createElement('span');
    statusText.textContent = 'Not signed in';

    const btnRow = document.createElement('div');
    Object.assign(btnRow.style, { display: 'flex', gap: '4px' });

    const copyBtn = document.createElement('button');
    copyBtn.textContent = 'Copy all';
    Object.assign(copyBtn.style, {
      background:   '#ffe600',
      border:       'none',
      borderRadius: '3px',
      cursor:       'pointer',
      fontSize:     '10px',
      padding:      '2px 6px',
      color:        '#5a4800',
      fontWeight:   'bold',
    });

    const trashBtn = document.createElement('button');
    trashBtn.textContent = String.fromCharCode(0x1F5D1); // 🗑
    trashBtn.title = 'Clear these notes';
    Object.assign(trashBtn.style, {
      background:   '#ffe600',
      border:       'none',
      borderRadius: '3px',
      cursor:       'pointer',
      fontSize:     '10px',
      padding:      '2px 6px',
      color:        '#5a4800',
    });

    btnRow.appendChild(copyBtn);
    btnRow.appendChild(trashBtn);
    status.appendChild(statusText);
    status.appendChild(btnRow);

    // ── Assemble ───────────────────────────────────────────────────────────
    panel.appendChild(header);
    panel.appendChild(googleRow);
    panel.appendChild(ta);
    panel.appendChild(status);
    document.body.appendChild(panel);

    // ── Google Doc: sign in / recent / append target ────────────────────────
    function setSignedInUi(signedIn) {
      signInBtn.textContent = signedIn ? 'Sign Out' : 'Sign In';
      recentBtn.disabled = !signedIn;
      recentBtn.style.opacity = signedIn ? '1' : '0.5';
      if (!signedIn) {
        closeRecentDropdown();
        statusText.textContent = 'Not signed in';
      }
    }

    // Restores which doc to append to (from a previous page/session) — does
    // NOT fetch or display that doc's content, just the {id, name} pointer.
    function restoreLastTargetDoc() {
      chrome.storage.local.get([LAST_FILE_KEY], (result) => {
        const last = result[LAST_FILE_KEY];
        if (last && last.id) {
          currentFile = last;
          docName.textContent = '→ ' + last.name;
        }
      });
    }

    signInBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (gToken) {
        await signOutToken();
        gToken = null;
        setSignedInUi(false);
        // currentFile/docName and whatever's in the textarea are left alone —
        // signing back in resumes targeting the same doc automatically.
        return;
      }
      statusText.textContent = 'Signing in…';
      gToken = await getToken(true);
      if (gToken) {
        setSignedInUi(true);
        statusText.textContent = 'Signed in';
        if (!currentFile) restoreLastTargetDoc();
      } else {
        statusText.textContent = 'Sign-in failed or was cancelled';
      }
    });

    recentBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (recentDropdown.style.display === 'block') { closeRecentDropdown(); return; }
      fetchRecentFiles();
    });

    function fetchRecentFiles() {
      recentBtn.textContent = 'Loading…';
      const q = encodeURIComponent("mimeType='application/vnd.google-apps.document' and trashed=false");
      const url = 'https://www.googleapis.com/drive/v3/files?q=' + q +
        '&orderBy=viewedByMeTime+desc&pageSize=10&fields=files(id,name,viewedByMeTime)';

      fetch(url, { headers: { Authorization: 'Bearer ' + gToken } })
        .then((r) => r.json())
        .then((data) => openRecentDropdown(data.files || []))
        .catch((err) => { statusText.textContent = 'Error fetching recent files: ' + err.message; })
        .finally(() => { recentBtn.textContent = 'Recent ▾'; });
    }

    let dismissListener = null;
    function openRecentDropdown(files) {
      recentDropdown.innerHTML = '';
      if (files.length === 0) {
        const empty = document.createElement('div');
        Object.assign(empty.style, { padding: '8px 10px', fontSize: '12px', color: '#888' });
        empty.textContent = 'No recent Docs found';
        recentDropdown.appendChild(empty);
      } else {
        files.forEach((f) => {
          const item = document.createElement('button');
          item.textContent = f.name;
          Object.assign(item.style, {
            display: 'block',
            width: '100%',
            textAlign: 'left',
            padding: '8px 10px',
            border: 'none',
            borderBottom: '1px solid #f0f0f0',
            background: 'white',
            fontSize: '12px',
            cursor: 'pointer',
            wordBreak: 'break-word',
          });
          item.addEventListener('click', (e) => {
            e.stopPropagation();
            selectTargetDoc(f.id, f.name);
            closeRecentDropdown();
          });
          recentDropdown.appendChild(item);
        });
      }
      recentDropdown.style.display = 'block';
      if (!dismissListener) {
        setTimeout(() => {
          dismissListener = (e) => {
            if (!recentDropdown.contains(e.target) && e.target !== recentBtn) closeRecentDropdown();
          };
          document.addEventListener('click', dismissListener);
        }, 0);
      }
    }
    function closeRecentDropdown() {
      recentDropdown.style.display = 'none';
      if (dismissListener) {
        document.removeEventListener('click', dismissListener);
        dismissListener = null;
      }
    }

    // Sets the append TARGET — no content is fetched or shown. If there's
    // already unsent text sitting in the scratchpad, it stays put; only the
    // destination changes (nothing is discarded by switching docs).
    function selectTargetDoc(fileId, fileName) {
      currentFile = { id: fileId, name: fileName };
      docName.textContent = '→ ' + fileName;
      const data = {};
      data[LAST_FILE_KEY] = currentFile;
      chrome.storage.local.set(data);
      statusText.textContent = 'Ready to save to "' + fileName + '"';
    }

    // Appends the scratchpad's text to the END of the target doc (via the
    // Docs API "insert right before the final newline" trick) — never
    // touches or replaces whatever's already in the doc. Clears the
    // scratchpad only on success.
    function appendToGoogleDoc() {
      if (!gToken || !currentFile) return;
      const text = ta.value;
      if (!text.trim()) return;
      statusText.textContent = 'Saving…';

      fetch('https://docs.googleapis.com/v1/documents/' + currentFile.id, {
        headers: { Authorization: 'Bearer ' + gToken }
      })
        .then((r) => {
          if (!r.ok) throw new Error('Doc read failed (HTTP ' + r.status + ')');
          return r.json();
        })
        .then((doc) => {
          const endIndex = doc.body.content[doc.body.content.length - 1].endIndex;
          const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
          const insertAt = Math.max(1, endIndex - 1);
          const toInsert = (endIndex > 2 ? '\n\n' : '') + normalized;
          return fetch('https://docs.googleapis.com/v1/documents/' + currentFile.id + ':batchUpdate', {
            method: 'POST',
            headers: { Authorization: 'Bearer ' + gToken, 'Content-Type': 'application/json' },
            body: JSON.stringify({ requests: [{ insertText: { location: { index: insertAt }, text: toInsert } }] }),
          });
        })
        .then((r) => {
          if (!r.ok) return r.json().then((err) => { throw new Error((err.error && err.error.message) || ('HTTP ' + r.status)); });
          ta.value = ''; // flushed — ready for the next note
          clearTimeout(draftSaveTimer); // a stale pending write must not resurrect what we just cleared
          chrome.storage.local.remove(DRAFT_KEY); // safely in the Doc now — no local recovery copy needed
          statusText.textContent = 'Saved to "' + currentFile.name + '"';
          setTimeout(() => { if (statusText.textContent.indexOf('Saved to') === 0) statusText.textContent = ''; }, 1800);
        })
        .catch((err) => {
          // Text stays in the scratchpad untouched on failure — nothing is lost.
          // No auto-retry — click Save again when you're ready.
          statusText.textContent = 'Error saving: ' + err.message;
        });
    }

    // ── Manual Save: the only thing that ever writes to the Doc ─────────────
    saveBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!gToken) { statusText.textContent = 'Sign in to save'; return; }
      if (!currentFile) { statusText.textContent = 'Pick a Recent doc to save to'; return; }
      if (!ta.value.trim()) { statusText.textContent = 'Nothing to save'; return; }
      appendToGoogleDoc();
    });

    // Debounced local draft save (500ms after typing pauses) — cheap and
    // local (no network, no chrome.storage.local write-rate limit), but no
    // reason to hit disk on literally every keystroke. This is purely a
    // safety net against closing the tab before you've clicked Save — it
    // never sends anything to the Doc.
    function flushDraftNow() {
      const data = {};
      data[DRAFT_KEY] = ta.value;
      chrome.storage.local.set(data);
    }
    function persistDraftSoon() {
      clearTimeout(draftSaveTimer);
      draftSaveTimer = setTimeout(flushDraftNow, 500);
    }

    // ── On every keystroke: just debounce the local draft save. Nothing is ──
    // ── ever sent to the Doc until you click Save. ───────────────────────────
    ta.addEventListener('input', persistDraftSoon);

    // ── Copy all ───────────────────────────────────────────────────────────
    copyBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!ta.value) return;
      navigator.clipboard.writeText(ta.value).then(() => {
        const prev = copyBtn.textContent;
        copyBtn.textContent = 'Copied!';
        setTimeout(() => { copyBtn.textContent = prev; }, 1200);
      });
    });

    // ── Trash: manually clear the scratchpad (and cancel any pending save) ──
    trashBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!ta.value.trim()) return;
      if (!window.confirm('Clear these notes? They have not been saved to your Doc.')) return;
      clearTimeout(draftSaveTimer);
      ta.value = '';
      chrome.storage.local.remove(DRAFT_KEY);
      statusText.textContent = 'Cleared';
      setTimeout(() => { if (statusText.textContent === 'Cleared') statusText.textContent = ''; }, 1400);
    });

    // ── Close ──────────────────────────────────────────────────────────────
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      teardown();
      window.__pgn = null;
    });

    // ── Drag ──────────────────────────────────────────────────────────────
    let dragging = false, dragDX = 0, dragDY = 0;

    header.addEventListener('mousedown', (e) => {
      if (e.target === closeBtn || e.target === decBtn || e.target === incBtn) return;
      dragging = true;
      header.style.cursor = 'grabbing';
      const rect = panel.getBoundingClientRect();
      dragDX = e.clientX - rect.left;
      dragDY = e.clientY - rect.top;
      e.preventDefault();
    });

    function onMouseMove(e) {
      if (!dragging) return;
      panel.style.left   = (e.clientX - dragDX) + 'px';
      panel.style.top    = (e.clientY - dragDY) + 'px';
      panel.style.bottom = 'auto';
      panel.style.right  = 'auto';
    }

    function onMouseUp() {
      dragging = false;
      header.style.cursor = 'grab';
    }

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup',   onMouseUp);

    // ── Teardown ───────────────────────────────────────────────────────────
    function teardown() {
      clearTimeout(draftSaveTimer);
      flushDraftNow(); // don't lose the last <500ms of typing just because the panel is closing
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup',   onMouseUp);
      closeRecentDropdown();
      panel.remove();
    }

    window.__pgn = { version: PGN_VERSION, teardown };

    // ── Bootstrap: restore this page's draft, try a silent sign-in, restore ──
    // ── the last append target. Independent of each other — neither needs ───
    // ── the other to have resolved first. ────────────────────────────────────
    chrome.storage.local.get([DRAFT_KEY], (result) => {
      const draft = result[DRAFT_KEY];
      if (draft) ta.value = draft;
    });
    getToken(false).then((token) => {
      if (token) {
        gToken = token;
        setSignedInUi(true);
        statusText.textContent = 'Signed in';
        restoreLastTargetDoc();
      }
    });
  }
})();
