document.getElementById('copyBtn').addEventListener('click', async () => {
  const status = document.getElementById('status');
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: extractTranscript
    });
    const msg = results[0].result;
    status.textContent = msg;
    status.className = msg.includes('Copied') ? 'success' : 'error';
  } catch (err) {
    status.textContent = 'Failed: ' + err.message;
    status.className = 'error';
  }
});

function extractTranscript() {
  const wrap = (t, w = 45) => {
    const words = t.split(' ');
    let lines = [], line = '';
    words.forEach(x => {
      if (line.length + x.length + 1 <= w) {
        line += line ? (' ' + x) : x;
      } else {
        if (line) lines.push(line);
        line = x;
      }
    });
    if (line) lines.push(line);
    return lines.join('\n');
  };

  const url = location.href;

  // Try new format first, then old
  let segs = document.querySelectorAll('transcript-segment-view-model');
  let mode = 'new';
  if (!segs.length) {
    segs = document.querySelectorAll('ytd-transcript-segment-renderer');
    mode = 'old';
  }

  if (!segs.length) {
    return 'No transcript found. Open the transcript panel first.';
  }

  let out = url + '\n\n';
  let lastMin = -1;
  let block = [];

  segs.forEach(s => {
    let ts = '', tx = '';
    if (mode === 'old') {
      ts = (s.querySelector('.segment-timestamp')?.textContent || '').trim();
      tx = (s.querySelector('.segment-text')?.textContent || '').trim();
    } else {
      ts = (s.querySelector('.ytwTranscriptSegmentViewModelTimestamp')?.textContent || '').trim();
      tx = (s.querySelector('span[role="text"]')?.textContent || '').trim();
    }
    if (!tx) return;
    const m = ts.match(/^(\d+):(\d+)/);
    if (m) {
      const min = parseInt(m[1]);
      if (min !== lastMin) {
        if (block.length) out += wrap(block.join(' ')) + '\n\n';
        out += '[' + ts + ']\n';
        block = [];
        lastMin = min;
      }
      block.push(tx);
    } else {
      block.push(tx);
    }
  });

  if (block.length) out += wrap(block.join(' ')) + '\n\n';

  // Copy to clipboard
  const ta = document.createElement('textarea');
  ta.value = out;
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  let ok = false;
  try { ok = document.execCommand('copy'); } catch (e) {}
  document.body.removeChild(ta);

  if (ok) {
    return 'Copied! Transcript ready to paste.';
  }

  // Fallback
  try {
    navigator.clipboard.writeText(out);
    return 'Copied! Transcript ready to paste.';
  } catch (e) {
    console.log(out);
    return 'Copy failed. Check console.';
  }
}
