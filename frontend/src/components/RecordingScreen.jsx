import { useEffect, useRef, useState } from 'react';
import { audioService } from '../services/audioService.js';
import './RecordingScreen.css';

export default function RecordingScreen({ onStop, onCancel }) {
  const canvasRef = useRef(null);
  const rafRef    = useRef(null);
  const [elapsed, setElapsed] = useState(0);

  // ── Timer ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    const id = setInterval(() => setElapsed(s => s + 1), 1000);
    return () => clearInterval(id);
  }, []);

  // ── Real-time waveform (spectrum analyser) ────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');

    // Smooth previous bar heights for fluid animation
    let prevHeights = null;

    function resizeCanvas() {
      canvas.width  = canvas.clientWidth  * window.devicePixelRatio;
      canvas.height = canvas.clientHeight * window.devicePixelRatio;
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    }
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    function draw() {
      const W = canvas.clientWidth;
      const H = canvas.clientHeight;
      ctx.clearRect(0, 0, W, H);

      const freqData = audioService.getFrequencyData();

      // How many bars to draw
      const BAR_COUNT  = 64;
      const GAP        = 2;
      const barW       = (W - GAP * (BAR_COUNT - 1)) / BAR_COUNT;
      const usableBins = freqData ? Math.floor(freqData.length * 0.65) : 0; // ignore very high freqs

      if (!prevHeights) prevHeights = new Float32Array(BAR_COUNT);

      for (let i = 0; i < BAR_COUNT; i++) {
        let target = 0;

        if (freqData) {
          // Map bar index → frequency bin (logarithmic-ish mapping for visual balance)
          const t   = i / BAR_COUNT;
          const bin = Math.floor(Math.pow(t, 1.3) * usableBins);
          target    = freqData[bin] / 255;
        }

        // Smooth: fast attack, slower decay
        prevHeights[i] = target > prevHeights[i]
          ? prevHeights[i] * 0.4 + target * 0.6    // attack
          : prevHeights[i] * 0.85 + target * 0.15; // decay

        const bh = Math.max(2, prevHeights[i] * H * 0.92);
        const x  = i * (barW + GAP);
        const y  = (H - bh) / 2; // centre vertically

        // Gradient: orange → red based on height
        const intensity = prevHeights[i];
        const r = 255;
        const g = Math.round(107 * (1 - intensity * 0.7));
        const b = 0;
        const a = 0.3 + intensity * 0.7;

        ctx.fillStyle = `rgba(${r},${g},${b},${a})`;

        // Draw bar (roundRect with fallback for older Safari)
        const rr = Math.min(barW / 2, 3);
        ctx.beginPath();
        if (ctx.roundRect) {
          ctx.roundRect(x, y, barW, bh, rr);
        } else {
          // Manual rounded rect for older browsers
          ctx.moveTo(x + rr, y);
          ctx.lineTo(x + barW - rr, y);
          ctx.quadraticCurveTo(x + barW, y, x + barW, y + rr);
          ctx.lineTo(x + barW, y + bh - rr);
          ctx.quadraticCurveTo(x + barW, y + bh, x + barW - rr, y + bh);
          ctx.lineTo(x + rr, y + bh);
          ctx.quadraticCurveTo(x, y + bh, x, y + bh - rr);
          ctx.lineTo(x, y + rr);
          ctx.quadraticCurveTo(x, y, x + rr, y);
          ctx.closePath();
        }
        ctx.fill();
      }

      rafRef.current = requestAnimationFrame(draw);
    }

    draw();

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', resizeCanvas);
    };
  }, []);

  const mm = String(Math.floor(elapsed / 60)).padStart(2, '0');
  const ss = String(elapsed % 60).padStart(2, '0');

  return (
    <div className="rec">
      {/* Status bar */}
      <header className="rec__header">
        <div className="rec__status">
          <span className="rec__dot" aria-hidden="true" />
          <span className="rec__status-text">LISTENING</span>
        </div>
        <time className="rec__timer" aria-label={`${mm} minutes ${ss} seconds`}>
          {mm}:{ss}
        </time>
      </header>

      {/* Waveform */}
      <div className="rec__waveform-wrap">
        <canvas ref={canvasRef} className="rec__canvas" aria-label="Live audio waveform" />
      </div>

      {/* Instruction */}
      <p className="rec__instruction">
        Hold your phone or mic near the noise
      </p>

      {/* Controls */}
      <div className="rec__controls">
        <button className="rec__cancel-btn" onClick={onCancel} aria-label="Cancel">
          ✕ Cancel
        </button>
        <button className="rec__stop-btn" onClick={onStop} aria-label="Stop and diagnose">
          <span className="rec__stop-icon" aria-hidden="true" />
          Stop &amp; Diagnose
        </button>
      </div>

      {/* Hint */}
      {elapsed < 4 && (
        <p className="rec__hint">
          {elapsed < 2 ? 'Make sure the sound is audible…' : 'Keep recording for best results'}
        </p>
      )}
    </div>
  );
}
