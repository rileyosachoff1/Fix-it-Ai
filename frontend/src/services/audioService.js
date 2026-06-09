/**
 * AudioService — Web Audio API wrapper
 *
 * Captures microphone audio, drives real-time waveform visualisation via an
 * AnalyserNode, and builds a natural-language acoustic description to send to
 * Claude for diagnosis.
 */

class AudioService {
  constructor() {
    this._reset();
  }

  _reset() {
    this.audioCtx   = null;
    this.analyser   = null;
    this.stream     = null;
    this.recorder   = null;
    this.chunks     = [];
    this.samples    = [];        // { freq: Uint8Array, time: Uint8Array, ts }
    this._sampleTid = null;
    this._startTs   = null;
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  /** Request mic, set up Web Audio graph, start recording. */
  async start() {
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      video: false,
    });

    this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (this.audioCtx.state === 'suspended') await this.audioCtx.resume();

    this.analyser = this.audioCtx.createAnalyser();
    this.analyser.fftSize = 2048;            // 1024 frequency bins
    this.analyser.smoothingTimeConstant = 0.75;

    const source = this.audioCtx.createMediaStreamSource(this.stream);
    source.connect(this.analyser);
    // NOT connecting analyser → destination (we don't want to hear ourselves)

    this.chunks = [];
    this.samples = [];
    this._startTs = Date.now();

    // MediaRecorder for audio blob (not used for analysis — just in case)
    try {
      this.recorder = new MediaRecorder(this.stream);
      this.recorder.ondataavailable = (e) => { if (e.data.size > 0) this.chunks.push(e.data); };
      this.recorder.start(250);
    } catch (_) { /* MediaRecorder not critical */ }

    // Collect acoustic samples every 80ms for analysis
    this._sampleTid = setInterval(() => this._collectSample(), 80);
  }

  /** Get current frequency data array for waveform rendering (call from rAF). */
  getFrequencyData() {
    if (!this.analyser) return null;
    const data = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(data);
    return data;
  }

  /** Get current time-domain data (waveform shape). */
  getTimeDomainData() {
    if (!this.analyser) return null;
    const data = new Uint8Array(this.analyser.fftSize);
    this.analyser.getByteTimeDomainData(data);
    return data;
  }

  /**
   * Stop recording.
   * @returns {{ description: string, duration: number }}
   */
  async stop() {
    clearInterval(this._sampleTid);

    const duration = (Date.now() - (this._startTs ?? Date.now())) / 1000;
    const samples  = [...this.samples];
    const sampleRate = this.audioCtx?.sampleRate ?? 44100;

    // Stop recorder
    if (this.recorder?.state !== 'inactive') {
      this.recorder?.stop();
    }

    // Release hardware
    this.stream?.getTracks().forEach(t => t.stop());
    try { await this.audioCtx?.close(); } catch (_) {}

    const description = this._buildDescription(samples, duration, sampleRate);
    this._reset();
    return { description, duration };
  }

  /** Cancel without analysis. */
  async cancel() {
    clearInterval(this._sampleTid);
    this.recorder?.state !== 'inactive' && this.recorder?.stop();
    this.stream?.getTracks().forEach(t => t.stop());
    try { await this.audioCtx?.close(); } catch (_) {}
    this._reset();
  }

  // ── Private ────────────────────────────────────────────────────────────────

  _collectSample() {
    if (!this.analyser) return;
    const freq = new Uint8Array(this.analyser.frequencyBinCount);
    const time = new Uint8Array(this.analyser.fftSize);
    this.analyser.getByteFrequencyData(freq);
    this.analyser.getByteTimeDomainData(time);
    this.samples.push({ freq: Array.from(freq), time: Array.from(time), ts: Date.now() });
  }

  _buildDescription(samples, duration, sampleRate) {
    if (samples.length < 3) {
      return `Recording duration: ${duration.toFixed(1)}s\nNote: very short recording — limited acoustic data available.`;
    }

    const binCount  = samples[0].freq.length;          // 1024
    const fftSize   = samples[0].time.length;          // 2048
    const binHz     = (sampleRate / 2) / binCount;     // Hz per frequency bin

    // ── Average frequency spectrum ─────────────────────────────────────────
    const avgSpectrum = new Float32Array(binCount);
    samples.forEach(s => s.freq.forEach((v, i) => { avgSpectrum[i] += v / 255; }));
    avgSpectrum.forEach((_, i) => { avgSpectrum[i] /= samples.length; });

    // ── Dominant frequency bin ─────────────────────────────────────────────
    let maxFreqVal = 0, maxFreqBin = 1;
    // Ignore bin 0 (DC offset) and very high bins (ultrasonic, likely noise)
    const topBin = Math.min(binCount - 1, Math.floor(8000 / binHz));
    for (let i = 1; i <= topBin; i++) {
      if (avgSpectrum[i] > maxFreqVal) { maxFreqVal = avgSpectrum[i]; maxFreqBin = i; }
    }
    const dominantHz = Math.round(maxFreqBin * binHz);

    // ── Frequency band energy ──────────────────────────────────────────────
    const lowEnd  = Math.floor(300  / binHz);   // sub-300 Hz
    const midEnd  = Math.floor(2000 / binHz);   // 300 – 2 kHz
    const hiEnd   = Math.floor(8000 / binHz);   // 2 – 8 kHz

    const bandEnergy = (from, to) => {
      const slice = avgSpectrum.slice(from, to);
      return slice.length ? slice.reduce((a, b) => a + b) / slice.length : 0;
    };

    const eLow  = bandEnergy(1,      lowEnd);
    const eMid  = bandEnergy(lowEnd, midEnd);
    const eHigh = bandEnergy(midEnd, hiEnd);
    const total = eLow + eMid + eHigh || 0.001;

    const pctLow  = Math.round((eLow  / total) * 100);
    const pctMid  = Math.round((eMid  / total) * 100);
    const pctHigh = Math.round((eHigh / total) * 100);

    // ── Amplitude envelope (time-domain RMS per sample) ───────────────────
    const amplitudes = samples.map(s => {
      let sum = 0;
      s.time.forEach(v => { const d = (v - 128) / 128; sum += d * d; });
      return Math.sqrt(sum / s.time.length);
    });
    const avgAmp = amplitudes.reduce((a, b) => a + b) / amplitudes.length;
    const maxAmp = Math.max(...amplitudes);

    const ampLabel = avgAmp > 0.35 ? 'loud' : avgAmp > 0.12 ? 'moderate' : 'quiet/faint';
    const dBFS     = avgAmp > 0 ? Math.round(20 * Math.log10(avgAmp)) : -60;

    // ── Rhythm detection ───────────────────────────────────────────────────
    // Smooth the amplitude envelope to find peaks
    const smoothed = amplitudes.map((v, i) => {
      const w = amplitudes.slice(Math.max(0, i - 2), i + 3);
      return w.reduce((a, b) => a + b) / w.length;
    });

    const threshold = avgAmp * 1.3;
    const peaks = [];
    let prevWasBelow = true;
    smoothed.forEach((v, i) => {
      if (v > threshold && prevWasBelow) { peaks.push(i); prevWasBelow = false; }
      else if (v <= threshold) { prevWasBelow = true; }
    });

    let rhythmDescription = 'continuous/steady';
    let patternRateHz = null;
    let rpmEquivalent = null;

    if (peaks.length >= 3) {
      const intervals = [];
      for (let i = 1; i < peaks.length; i++) {
        intervals.push((peaks[i] - peaks[i - 1]) * 0.08); // 80ms per sample → seconds
      }
      const avgInterval = intervals.reduce((a, b) => a + b) / intervals.length;
      const variance    = intervals.reduce((s, v) => s + (v - avgInterval) ** 2, 0) / intervals.length;
      const cv          = Math.sqrt(variance) / avgInterval; // coefficient of variation

      if (cv < 0.3 && avgInterval < 2.0) {
        patternRateHz   = 1 / avgInterval;
        rpmEquivalent   = Math.round(patternRateHz * 60);
        rhythmDescription = `rhythmic/repetitive — ~${patternRateHz.toFixed(1)} events/sec (~${rpmEquivalent} RPM equivalent)`;
      } else if (cv < 0.6) {
        rhythmDescription = 'semi-rhythmic / irregular bursts';
      } else {
        rhythmDescription = 'irregular / intermittent';
      }
    } else if (peaks.length === 0 && avgAmp > 0.05) {
      rhythmDescription = 'constant/tonal — no clear rhythm';
    }

    // ── Sound character classification ────────────────────────────────────
    let character = 'broadband noise';
    if (pctHigh > 45 && eMid < eHigh)      character = 'high-pitched — squealing, whistling, or whining';
    else if (pctLow > 45 && eLow > eMid)   character = 'low-frequency — knocking, thumping, or deep rumble';
    else if (pctMid > 50)                   character = 'mid-range — grinding, scraping, or mechanical contact';
    else if (pctHigh > 30 && pctLow > 30)  character = 'broadband — rattling, exhaust noise, or friction';
    // Refine with rhythm
    if (patternRateHz) {
      if (patternRateHz < 6  && pctLow > 30)   character = 'rhythmic metallic knocking or thumping';
      else if (patternRateHz < 15 && pctMid > 30) character = 'rhythmic clicking or tapping';
      else if (patternRateHz >= 15)              character = 'rapid repetitive ticking or flutter';
    }

    // ── Context hints ─────────────────────────────────────────────────────
    const hints = [];
    if (rpmEquivalent) {
      if (rpmEquivalent < 120)       hints.push('very slow rhythm — likely suspension/drivetrain component or exhaust puffing');
      else if (rpmEquivalent < 600)  hints.push('rhythm suggests wheel-speed proportional component (wheel bearing, brake, CV joint)');
      else if (rpmEquivalent < 1200) hints.push('rhythm consistent with engine idle RPM range — could be engine mechanical noise');
      else if (rpmEquivalent < 3000) hints.push('rhythm in engine operating RPM range — accessories or valve train possible');
      else                           hints.push('high-frequency rhythm — likely belt, bearing, or harmonic resonance');
    }

    // ── Assemble description ──────────────────────────────────────────────
    const lines = [
      `=== VEHICLE SOUND ANALYSIS REPORT ===`,
      ``,
      `Recording duration: ${duration.toFixed(1)} seconds (${samples.length} acoustic samples)`,
      ``,
      `FREQUENCY ANALYSIS:`,
      `  Dominant frequency: ~${dominantHz} Hz`,
      `  Low band  (<300 Hz):      ${pctLow}% energy  — ${descBand(eLow)}`,
      `  Mid band  (300–2000 Hz):  ${pctMid}% energy  — ${descBand(eMid)}`,
      `  High band (>2000 Hz):     ${pctHigh}% energy  — ${descBand(eHigh)}`,
      ``,
      `AMPLITUDE:`,
      `  Level: ${ampLabel} (avg RMS ${dBFS} dBFS, peak ${Math.round(20 * Math.log10(maxAmp))} dBFS)`,
      ``,
      `RHYTHM / PATTERN:`,
      `  ${rhythmDescription}`,
      peaks.length ? `  Distinct sound events detected: ${peaks.length}` : '',
      rpmEquivalent ? `  RPM context: ${rpmEquivalent} RPM equivalent` : '',
      ``,
      `SOUND CHARACTER:`,
      `  ${character}`,
      ``,
      hints.length ? `CONTEXTUAL NOTES:\n  ${hints.join('\n  ')}` : '',
    ].filter(l => l !== null);

    return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  }
}

function descBand(e) {
  if (e > 0.5) return 'dominant';
  if (e > 0.3) return 'prominent';
  if (e > 0.1) return 'moderate';
  if (e > 0.02) return 'low';
  return 'negligible';
}

// Export a singleton
export const audioService = new AudioService();
