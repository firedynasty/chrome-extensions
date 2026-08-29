// Dev.to Scraper — injected chip.
// Toolbar-icon click shows a floating panel with scraper buttons.
// Next toolbar-icon click tears it down.
//
// PURE ASCII string literals only.
(function () {
  const VERSION = 2;
  const CHIP_ID = '__scraper_chip';

  const X = String.fromCharCode(0x2715); // x (close)

  // Version upgrade: tear down stale instance.
  if (window.__scraper && window.__scraper.version !== VERSION) {
    try { window.__scraper.deactivate(); } catch (e) {}
    window.__scraper = null;
  }
  // Already active: toggle off.
  if (window.__scraper) {
    window.__scraper.deactivate();
    return;
  }

  // ---- dev.to scraper ----

  async function scrapeDevTo() {
    const match = location.href.match(/^https?:\/\/dev\.to\/([^/]+)\/([^/?#]+)/);
    if (!match) {
      alert('Dev.to Scraper: navigate to a dev.to article page first.');
      return;
    }
    const [, username, slug] = match;
    setStatus('Fetching...');
    try {
      const resp = await fetch('https://dev.to/api/articles/' + username + '/' + slug);
      if (!resp.ok) throw new Error('API returned ' + resp.status);
      const data = await resp.json();

      const tags = Array.isArray(data.tag_list)
        ? data.tag_list
        : (data.tag_list || '').split(',').map(function (t) { return t.trim(); }).filter(Boolean);
      const frontmatter = [
        '---',
        'title: "' + data.title.replace(/"/g, '\\"') + '"',
        'author: "' + data.user.name + '"',
        'published: "' + data.published_at + '"',
        'tags: [' + tags.map(function (t) { return '"' + t + '"'; }).join(', ') + ']',
        'canonical: "' + data.url + '"',
        '---',
        '',
      ].join('\n');

      const markdown = frontmatter + (data.body_markdown || '');
      const filename = slug + '.md';

      const blob = new Blob([markdown], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setStatus('Downloaded!');
      setTimeout(function () { setStatus(''); }, 2000);
    } catch (e) {
      setStatus('Error: ' + e.message);
    }
  }

  // ---- chip UI ----

  let statusEl = null;

  function setStatus(msg) {
    if (statusEl) statusEl.textContent = msg;
  }

  function buildChip() {
    const chip = document.createElement('div');
    chip.id = CHIP_ID;
    chip.style.cssText = [
      'position:fixed',
      'bottom:18px',
      'right:18px',
      'z-index:2147483647',
      'display:flex',
      'flex-direction:column',
      'gap:8px',
      'padding:10px 12px',
      'border-radius:10px',
      'background:#1a1a2e',
      'border:1px solid #444',
      'box-shadow:0 6px 24px rgba(0,0,0,0.55)',
      'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
      'font-size:12px',
      'color:#e0e0e0',
      'min-width:160px',
      'user-select:none'
    ].join(';');

    chip.addEventListener('mousedown', function (e) { e.stopPropagation(); });
    chip.addEventListener('click',     function (e) { e.stopPropagation(); });

    // header row: label + close button
    const header = document.createElement('div');
    header.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:12px;';

    const label = document.createElement('span');
    label.style.cssText = 'font-weight:700;font-size:12px;color:#bbb;letter-spacing:0.04em;';
    label.textContent = 'SCRAPER';
    header.appendChild(label);

    const closeBtn = document.createElement('button');
    closeBtn.style.cssText = 'background:none;border:none;color:#777;font-size:13px;cursor:pointer;padding:0;line-height:1;';
    closeBtn.textContent = X;
    closeBtn.title = 'Close';
    closeBtn.addEventListener('click', function (e) { e.stopPropagation(); deactivate(); });
    header.appendChild(closeBtn);
    chip.appendChild(header);

    // --- scraper buttons ---

    const devtoBtn = document.createElement('button');
    devtoBtn.style.cssText = [
      'background:linear-gradient(45deg,#AB47BC,#7B1FA2)',
      'color:#fff',
      'border:none',
      'border-radius:6px',
      'font-size:12px',
      'font-weight:700',
      'padding:6px 12px',
      'cursor:pointer',
      'text-align:left'
    ].join(';');
    devtoBtn.textContent = 'Scrape dev.to';
    devtoBtn.addEventListener('click', function (e) { e.stopPropagation(); scrapeDevTo(); });
    chip.appendChild(devtoBtn);

    // future buttons go here

    // status line
    statusEl = document.createElement('div');
    statusEl.style.cssText = 'font-size:11px;color:#888;min-height:14px;';
    chip.appendChild(statusEl);

    document.body.appendChild(chip);
  }

  // ---- lifecycle ----

  function deactivate() {
    const chip = document.getElementById(CHIP_ID);
    if (chip) chip.remove();
    statusEl = null;
    if (window.__scraper && window.__scraper.deactivate === deactivate) window.__scraper = null;
  }

  buildChip();
  window.__scraper = { version: VERSION, deactivate: deactivate };
})();
