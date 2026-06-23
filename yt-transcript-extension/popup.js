document.getElementById('toggleBtn').addEventListener('click', async () => {
  const status = document.getElementById('status');

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: toggleVisualizer
    });
    status.textContent = 'Injected! Check the page.';
    status.className = 'success';
  } catch (err) {
    status.textContent = 'Failed to inject: ' + err.message;
    status.className = 'error';
  }
});

function toggleVisualizer() {
  // If already active, toggle off
  const existing = document.getElementById('__ext_visualizerOverlay');
  if (existing) {
    if (existing.classList.contains('active')) {
      // Turn off
      existing.classList.remove('active');
      if (window.__extVisualizerCleanup) {
        window.__extVisualizerCleanup();
      }
    } else {
      // Re-activate — need fresh capture
      startCapture(existing, document.getElementById('__ext_visualizerCanvas'));
    }
    return;
  }

  // First time — inject DOM
  const style = document.createElement('style');
  style.textContent = `
    #__ext_visualizerOverlay {
      display: none;
      position: fixed;
      top: 0; left: 0; right: 0; bottom: 0;
      z-index: 2147483647;
      pointer-events: none;
    }
    #__ext_visualizerOverlay.active {
      display: block;
    }
    #__ext_visualizerOverlay canvas {
      width: 100%;
      height: 100%;
    }
  `;
  document.head.appendChild(style);

  const overlay = document.createElement('div');
  overlay.id = '__ext_visualizerOverlay';
  const canvas = document.createElement('canvas');
  canvas.id = '__ext_visualizerCanvas';
  overlay.appendChild(canvas);
  document.body.appendChild(overlay);

  startCapture(overlay, canvas);

  async function startCapture(overlay, canvas) {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true
      });

      // Stop video track — only need audio
      stream.getVideoTracks().forEach(t => t.stop());

      const audioTracks = stream.getAudioTracks();
      if (!audioTracks.length) {
        alert('No audio captured. Make sure to check "Share tab audio" in the prompt.');
        stream.getTracks().forEach(t => t.stop());
        return;
      }

      overlay.classList.add('active');

      // Web Audio setup
      const audioCtx = new AudioContext();
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      const ctx = canvas.getContext('2d');

      let animId = null;
      let active = true;

      function renderFrame() {
        if (!active) return;
        animId = requestAnimationFrame(renderFrame);

        const WIDTH = canvas.width;
        const HEIGHT = canvas.height;

        analyser.getByteFrequencyData(dataArray);
        ctx.clearRect(0, 0, WIDTH, HEIGHT);

        const barWidth = (WIDTH / bufferLength) * 2.5;
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
          const barHeight = dataArray[i];
          const r = barHeight + (25 * (i / bufferLength));
          const g = 250 * (i / bufferLength);
          const b = 50;

          ctx.fillStyle = 'rgba(' + r + ',' + g + ',' + b + ',0.7)';
          ctx.fillRect(x, HEIGHT - barHeight, barWidth, barHeight);
          x += barWidth + 1;
        }
      }

      renderFrame();

      const resizeHandler = () => {
        if (active) {
          canvas.width = window.innerWidth;
          canvas.height = window.innerHeight;
        }
      };
      window.addEventListener('resize', resizeHandler);

      // Handle stream ending
      audioTracks[0].onended = () => {
        cleanup();
      };

      function cleanup() {
        active = false;
        if (animId) cancelAnimationFrame(animId);
        stream.getTracks().forEach(t => t.stop());
        audioCtx.close();
        overlay.classList.remove('active');
        window.removeEventListener('resize', resizeHandler);
        window.__extVisualizerCleanup = null;
      }

      window.__extVisualizerCleanup = cleanup;

    } catch (err) {
      console.warn('Visualizer capture cancelled or failed:', err);
    }
  }
}
