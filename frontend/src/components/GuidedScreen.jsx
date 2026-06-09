import { useState, useRef, useEffect, useCallback } from 'react';
import { audioService } from '../services/audioService.js';
import * as obd2Service  from '../services/obd2Service.js';
import './GuidedScreen.css';

// ── Step config ───────────────────────────────────────────────────────────────
const STEPS = [
  { num: 1, icon: '💬', title: 'Describe the problem',         subtitle: 'In your own words, what\'s happening? The more detail, the better the diagnosis.' },
  { num: 2, icon: '🔧', title: 'Open the hood',                subtitle: 'Take a photo or short video of your engine bay. Look for leaks, worn belts, or anything unusual.' },
  { num: 3, icon: '📸', title: 'Dashboard & warning lights',   subtitle: 'Take a photo of your dashboard — especially any warning lights that are on.' },
  { num: 4, icon: '🎙️', title: 'Record the noise (parked)',    subtitle: 'With the engine running and car parked, hold your phone near the source of the noise. Record for 5–15 seconds.' },
  { num: 5, icon: '🚗', title: 'Record while driving',         subtitle: 'If the noise changes while moving or turning, record that moment. Helps diagnose suspension and steering issues.' },
  { num: 6, icon: '↩️', title: 'Steering wheel test',          subtitle: 'In a safe area, slowly turn the steering wheel fully left, then fully right. Record any clicking, popping, or grinding.' },
];
const TOTAL = STEPS.length;

// ── Media helpers (same as HomeScreen) ───────────────────────────────────────
function fileToBase64(file) {
  return new Promise(resolve => {
    const r = new FileReader();
    r.onload = e => resolve(e.target.result.split(',')[1]);
    r.readAsDataURL(file);
  });
}
function mediaTypeOf(file) {
  if (file.type === 'image/png')  return 'image/png';
  if (file.type === 'image/webp') return 'image/webp';
  return 'image/jpeg';
}
function captureVideoFrame(video, time) {
  return new Promise(resolve => {
    const MAX_W = 640;
    function snap() {
      try {
        const ratio = (video.videoWidth || 640) > MAX_W ? MAX_W / video.videoWidth : 1;
        const w = Math.round((video.videoWidth  || 640) * ratio);
        const h = Math.round((video.videoHeight || 360) * ratio);
        const c = document.createElement('canvas');
        c.width = w; c.height = h;
        c.getContext('2d').drawImage(video, 0, 0, w, h);
        resolve(c.toDataURL('image/jpeg', 0.65).split(',')[1]);
      } catch { resolve(null); }
    }
    video.currentTime = time;
    video.addEventListener('seeked', snap, { once: true });
  });
}
async function extractVideoFrames(file, maxDuration = 30, intervalSecs = 5) {
  const url = URL.createObjectURL(file);
  try {
    const video = await new Promise((resolve, reject) => {
      const v = document.createElement('video');
      v.muted = true; v.preload = 'metadata'; v.src = url;
      v.addEventListener('loadedmetadata', () => resolve(v), { once: true });
      v.addEventListener('error', () => reject(new Error('Cannot read video')), { once: true });
      v.load();
    });
    const dur = Math.min(video.duration || 0, maxDuration);
    const timestamps = [];
    for (let t = 0; t < dur; t += intervalSecs) timestamps.push(t);
    if (!timestamps.length) timestamps.push(0);
    const frames = [];
    for (const t of timestamps) {
      const f = await captureVideoFrame(video, t);
      if (f) frames.push(f);
    }
    return { frames, duration: Math.round(video.duration || 0) };
  } finally {
    URL.revokeObjectURL(url);
  }
}

// ── InlineRecorder ─────────────────────────────────────────────────────────────
function InlineRecorder({ savedResult, onSave, onClear, otherActive, onActiveChange }) {
  const canvasRef = useRef(null);
  const rafRef    = useRef(null);
  const timerRef  = useRef(null);
  const [phase,   setPhase]   = useState(savedResult ? 'done' : 'idle');
  const [elapsed, setElapsed] = useState(0);
  const [error,   setError]   = useState(null);
  const [localResult, setLocalResult] = useState(savedResult || null);

  const isRecording = phase === 'recording';
  const isDone      = phase === 'done' || !!localResult;

  // Waveform canvas
  useEffect(() => {
    if (!isRecording) { cancelAnimationFrame(rafRef.current); return; }
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let prev = null;
    function resize() {
      const dpr = window.devicePixelRatio || 1;
      canvas.width  = canvas.clientWidth  * dpr;
      canvas.height = canvas.clientHeight * dpr;
      ctx.scale(dpr, dpr);
      prev = null;
    }
    resize();
    function draw() {
      const W = canvas.clientWidth, H = canvas.clientHeight;
      ctx.clearRect(0, 0, W, H);
      const fd = audioService.getFrequencyData();
      const BARS = 48, GAP = 2;
      const bw   = (W - GAP * (BARS - 1)) / BARS;
      const bins = fd ? Math.floor(fd.length * 0.65) : 0;
      if (!prev) prev = new Float32Array(BARS);
      for (let i = 0; i < BARS; i++) {
        let t = fd ? fd[Math.floor(Math.pow(i / BARS, 1.3) * bins)] / 255 : 0;
        prev[i] = t > prev[i] ? prev[i] * 0.4 + t * 0.6 : prev[i] * 0.85 + t * 0.15;
        const bh = Math.max(2, prev[i] * H * 0.9);
        const x  = i * (bw + GAP), y = (H - bh) / 2;
        const g  = Math.round(107 * (1 - prev[i] * 0.7));
        ctx.fillStyle = `rgba(255,${g},0,${0.3 + prev[i] * 0.7})`;
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(x, y, bw, bh, Math.min(bw / 2, 2));
        else ctx.rect(x, y, bw, bh);
        ctx.fill();
      }
      rafRef.current = requestAnimationFrame(draw);
    }
    draw();
    return () => cancelAnimationFrame(rafRef.current);
  }, [isRecording]);

  useEffect(() => {
    if (!isRecording) { clearInterval(timerRef.current); return; }
    timerRef.current = setInterval(() => setElapsed(s => s + 1), 1000);
    return () => clearInterval(timerRef.current);
  }, [isRecording]);

  useEffect(() => () => {
    cancelAnimationFrame(rafRef.current);
    clearInterval(timerRef.current);
  }, []);

  async function handleStart() {
    setError(null);
    setPhase('requesting');
    try {
      await audioService.start();
      setElapsed(0);
      setPhase('recording');
      onActiveChange(true);
    } catch (err) {
      setError(err.name === 'NotAllowedError'
        ? 'Microphone access denied. Please allow access and try again.'
        : err.message);
      setPhase('idle');
    }
  }

  async function handleStop() {
    setPhase('idle');
    clearInterval(timerRef.current);
    cancelAnimationFrame(rafRef.current);
    try {
      const result = await audioService.stop();
      setLocalResult(result);
      setPhase('done');
      onActiveChange(false);
      onSave(result);
    } catch (err) {
      setError(err.message);
      onActiveChange(false);
    }
  }

  function handleClear() {
    setPhase('idle');
    setElapsed(0);
    setError(null);
    setLocalResult(null);
    onClear();
  }

  const mm = String(Math.floor(elapsed / 60)).padStart(2, '0');
  const ss = String(elapsed % 60).padStart(2, '0');
  const displayResult = localResult || savedResult;

  return (
    <div className="inline-rec">
      {error && <p className="inline-rec__error">{error}</p>}

      {isDone && displayResult && (
        <div className="inline-rec__done">
          <span className="inline-rec__done-icon">✓</span>
          <span className="inline-rec__done-text">
            Recording saved · {displayResult.duration?.toFixed(1) ?? '?'}s captured
          </span>
          <button className="inline-rec__rerecord" onClick={handleClear} type="button">
            Re-record
          </button>
        </div>
      )}

      {!isDone && phase !== 'recording' && (
        <>
          <button
            className={`inline-rec__start${otherActive || phase === 'requesting' ? ' inline-rec__start--disabled' : ''}`}
            onClick={handleStart}
            disabled={otherActive || phase === 'requesting'}
            type="button"
          >
            {phase === 'requesting' ? '⏳ Requesting mic…' : '🎙️ Start Recording'}
          </button>
          {otherActive && (
            <p className="inline-rec__blocked">Finish the other recording first</p>
          )}
        </>
      )}

      {phase === 'recording' && (
        <div className="inline-rec__active">
          <div className="inline-rec__waveform-wrap">
            <canvas ref={canvasRef} className="inline-rec__canvas" />
          </div>
          <div className="inline-rec__controls">
            <div className="inline-rec__status">
              <span className="inline-rec__dot" />
              <time className="inline-rec__time">{mm}:{ss}</time>
            </div>
            <button className="inline-rec__stop" onClick={handleStop} type="button">
              ■ Stop &amp; Save
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function GuidedScreen({ initialText = '', obd2Connected, onComplete, onSkipToRecord, onBack }) {
  const [step, setStep] = useState(1);

  // Step 1 — text
  const [textDesc, setTextDesc] = useState(initialText);

  // Step 2 — engine bay
  const [enginePhotos,       setEnginePhotos]       = useState([]);
  const [engineVideoFrames,  setEngineVideoFrames]  = useState([]);
  const [engineVideoName,    setEngineVideoName]    = useState('');
  const [engineVideoLoading, setEngineVideoLoading] = useState(false);
  const [engineVideoError,   setEngineVideoError]   = useState('');
  const enginePhotoRef = useRef(null);
  const engineVideoRef = useRef(null);

  // Step 3 — dashboard
  const [dashPhotos, setDashPhotos] = useState([]);
  const dashPhotoRef = useRef(null);

  // Steps 4-6 — recordings
  const [recordings,          setRecordings]          = useState({ 4: null, 5: null, 6: null });
  const [activeRecordingStep, setActiveRecordingStep] = useState(null);
  const activeRecordingRef = useRef(null);

  // OBD2 auto-capture state
  // phase: 'idle' | 'capturing' | 'done' | 'error'
  const [obd2Phase,        setObd2Phase]        = useState('idle');
  const [obd2CapturedData, setObd2CapturedData] = useState(null);
  const obd2AttemptedRef = useRef(false);

  useEffect(() => { activeRecordingRef.current = activeRecordingStep; }, [activeRecordingStep]);

  // Cancel any active recording when the screen unmounts
  useEffect(() => () => {
    if (activeRecordingRef.current !== null) {
      audioService.cancel().catch(() => {});
    }
  }, []);

  // OBD2 auto-capture when reaching the recording steps (step 4+)
  // Captures once per GuidedScreen session, silently in the background
  useEffect(() => {
    if (step < 4)            return;
    if (!obd2Connected)      return;
    if (obd2AttemptedRef.current) return;

    obd2AttemptedRef.current = true;
    setObd2Phase('capturing');

    Promise.all([
      obd2Service.readAllSensors(),
      obd2Service.readFaultCodes(),
    ]).then(([sensors, faultCodes]) => {
      setObd2CapturedData({ sensors, faultCodes });
      setObd2Phase('done');
    }).catch(() => {
      setObd2Phase('error');
    });
  }, [step, obd2Connected]);

  // ── Recording callbacks ──────────────────────────────────────────────────
  const handleRecordingActiveChange = useCallback((stepNum, isActive) => {
    setActiveRecordingStep(isActive ? stepNum : null);
  }, []);

  const handleRecordingSave = useCallback((stepNum, result) => {
    setRecordings(prev => ({ ...prev, [stepNum]: result }));
  }, []);

  const handleRecordingClear = useCallback((stepNum) => {
    setRecordings(prev => ({ ...prev, [stepNum]: null }));
  }, []);

  // ── Engine bay media ─────────────────────────────────────────────────────
  async function handleEnginePhotos(e) {
    const slots = 3 - enginePhotos.length;
    const files = Array.from(e.target.files).slice(0, slots);
    const newPhotos = await Promise.all(files.map(async f => ({
      base64: await fileToBase64(f), mediaType: mediaTypeOf(f),
      preview: URL.createObjectURL(f), name: f.name,
    })));
    setEnginePhotos(prev => [...prev, ...newPhotos]);
    e.target.value = '';
  }
  async function handleEngineVideo(e) {
    const file = e.target.files[0];
    if (!file) return;
    e.target.value = '';
    setEngineVideoError('');
    if (file.size > 50 * 1024 * 1024) { setEngineVideoError('Video too large (max 50 MB)'); return; }
    setEngineVideoLoading(true);
    try {
      const { frames } = await extractVideoFrames(file);
      setEngineVideoFrames(frames);
      setEngineVideoName(file.name);
    } catch (err) { setEngineVideoError(err.message || 'Could not process video'); }
    finally { setEngineVideoLoading(false); }
  }

  // ── Dashboard media ──────────────────────────────────────────────────────
  async function handleDashPhotos(e) {
    const slots = 3 - dashPhotos.length;
    const files = Array.from(e.target.files).slice(0, slots);
    const newPhotos = await Promise.all(files.map(async f => ({
      base64: await fileToBase64(f), mediaType: mediaTypeOf(f),
      preview: URL.createObjectURL(f), name: f.name,
    })));
    setDashPhotos(prev => [...prev, ...newPhotos]);
    e.target.value = '';
  }

  // ── Navigation ───────────────────────────────────────────────────────────
  function canNav() { return activeRecordingStep === null; }
  function goNext() { if (!canNav()) return; setStep(s => Math.min(s + 1, TOTAL)); }
  function goBack() {
    if (!canNav()) return;
    if (step === 1) { onBack(); } else { setStep(s => s - 1); }
  }
  function goSkip() { if (!canNav()) return; setStep(s => Math.min(s + 1, TOTAL)); }

  async function handleSkipToRecord() {
    if (activeRecordingStep !== null) {
      await audioService.cancel().catch(() => {});
      setActiveRecordingStep(null);
    }
    onSkipToRecord();
  }

  // ── Submit ───────────────────────────────────────────────────────────────
  function handleRunDiagnosis() {
    if (!canNav()) return;
    const rec4 = recordings[4];
    const rec5 = recordings[5];
    const rec6 = recordings[6];

    const primaryDescription = rec4?.description
      || 'No audio recording available — diagnosis based on visual and text evidence only.';
    const primaryDuration = rec4?.duration || 0;

    const additionalRecordings = [
      rec5 && { label: 'While driving or turning', description: rec5.description, duration: rec5.duration },
      rec6 && { label: 'Steering wheel test',       description: rec6.description, duration: rec6.duration },
    ].filter(Boolean);

    const allImages = [
      ...enginePhotos.map(p => ({ base64: p.base64, mediaType: p.mediaType })),
      ...dashPhotos.map(p  => ({ base64: p.base64, mediaType: p.mediaType })),
    ];

    const imageNote = enginePhotos.length && dashPhotos.length
      ? `Engine bay photos: ${enginePhotos.length}. Dashboard photos: ${dashPhotos.length}.`
      : enginePhotos.length ? `Engine bay photos: ${enginePhotos.length}.`
      : dashPhotos.length   ? `Dashboard photos: ${dashPhotos.length}.`
      : '';

    const fullText = [textDesc.trim(), imageNote].filter(Boolean).join('\n');

    onComplete({
      textDescription:     fullText || undefined,
      images:              allImages,
      videoFrames:         engineVideoFrames,
      primaryDescription,
      primaryDuration,
      additionalRecordings,
      obd2Data:            obd2CapturedData || undefined,
    });
  }

  const current    = STEPS[step - 1];
  const hasAnyData = textDesc.trim() || enginePhotos.length || dashPhotos.length
    || recordings[4] || recordings[5] || recordings[6];

  // OBD2 banner visible on steps 4-6 when scanner is connected and capture started
  const showObd2Banner = step >= 4 && obd2Connected && obd2Phase !== 'idle';

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="guided">
      {/* Top bar */}
      <div className="guided__topbar">
        <button className="guided__back-link" onClick={goBack} type="button">
          ← Back
        </button>
        <button className="guided__skip-all" onClick={handleSkipToRecord} type="button">
          Skip All &amp; Just Record →
        </button>
      </div>

      {/* Progress bar */}
      <div className="guided__progress">
        <p className="guided__progress-label">Step {step} of {TOTAL}</p>
        <div className="guided__progress-track">
          {STEPS.map(s => (
            <div
              key={s.num}
              className={`guided__progress-pip ${s.num < step ? 'guided__progress-pip--done' : s.num === step ? 'guided__progress-pip--current' : ''}`}
            />
          ))}
        </div>
      </div>

      {/* Step header (animated per-step via key) */}
      <div className="guided__step-header" key={step}>
        <span className="guided__step-icon">{current.icon}</span>
        <h1 className="guided__step-title">{current.title}</h1>
        <p className="guided__step-subtitle">{current.subtitle}</p>
      </div>

      {/* OBD2 auto-capture banner — shown on steps 4-6 when scanner is connected */}
      {showObd2Banner && (
        <div className={`guided__obd2-banner guided__obd2-banner--${obd2Phase}`}>
          {obd2Phase === 'capturing' && (
            <>
              <span className="guided__obd2-banner-icon">⏳</span>
              <span>Reading OBD2 scanner data…</span>
            </>
          )}
          {obd2Phase === 'done' && obd2CapturedData && (
            <>
              <span className="guided__obd2-banner-icon">✓</span>
              <span>
                OBD2 data captured — {Object.keys(obd2CapturedData.sensors || {}).length} sensors
                {obd2CapturedData.faultCodes?.length > 0 ? (
                  <span className="guided__obd2-banner-fault">
                    {' '}⚠️ {obd2CapturedData.faultCodes.length} fault code{obd2CapturedData.faultCodes.length > 1 ? 's' : ''}: {obd2CapturedData.faultCodes.map(c => c.code).join(', ')}
                  </span>
                ) : ' · no fault codes'}
              </span>
            </>
          )}
          {obd2Phase === 'error' && (
            <>
              <span className="guided__obd2-banner-icon">⚠️</span>
              <span>OBD2 read failed — continuing without scanner data</span>
            </>
          )}
        </div>
      )}

      {/* ── All step bodies always rendered, CSS shows only active ── */}

      {/* Step 1 — Text */}
      <div className={`guided__step-content ${step === 1 ? 'guided__step-content--active' : ''}`}>
        <textarea
          className="guided__textarea"
          rows={4}
          maxLength={600}
          placeholder="e.g. High-pitched squealing when I start the car in the morning, goes away after a few minutes. Also hear a rattling noise at highway speeds…"
          value={textDesc}
          onChange={e => setTextDesc(e.target.value.slice(0, 600))}
        />
        <p className="guided__charcount">{textDesc.length}/600</p>
        <div className="guided__chips">
          {['Rattling noise', 'Grinding when braking', 'Squealing on startup', 'Knocking under hood',
            'Vibration when driving', 'Smoke or smell', 'Warning light on'].map(chip => (
            <button
              key={chip}
              className="guided__chip"
              type="button"
              onClick={() => setTextDesc(t => t ? `${t}, ${chip.toLowerCase()}` : chip)}
            >
              {chip}
            </button>
          ))}
        </div>
      </div>

      {/* Step 2 — Engine bay */}
      <div className={`guided__step-content ${step === 2 ? 'guided__step-content--active' : ''}`}>
        <div className="guided__upload-zone">
          <div className="guided__upload-row">
            <span className="guided__upload-label">PHOTOS</span>
            {enginePhotos.length < 3 && (
              <button className="guided__upload-btn" type="button" onClick={() => enginePhotoRef.current?.click()}>
                📷 Add Photos
              </button>
            )}
            <input ref={enginePhotoRef} type="file" accept="image/jpeg,image/png,image/webp"
              multiple style={{ display: 'none' }} onChange={handleEnginePhotos} />
          </div>
          {enginePhotos.length > 0 && (
            <div className="guided__thumbs">
              {enginePhotos.map((p, i) => (
                <div key={i} className="guided__thumb">
                  <img src={p.preview} alt={p.name} />
                  <button className="guided__thumb-remove" type="button"
                    onClick={() => setEnginePhotos(prev => prev.filter((_, j) => j !== i))}>×</button>
                </div>
              ))}
            </div>
          )}
          <div className="guided__upload-row">
            <span className="guided__upload-label">VIDEO</span>
            {!engineVideoFrames.length && !engineVideoLoading && (
              <button className="guided__upload-btn" type="button" onClick={() => engineVideoRef.current?.click()}>
                🎥 Add Video
              </button>
            )}
            <input ref={engineVideoRef} type="file"
              accept="video/mp4,video/quicktime,video/webm,video/mov"
              style={{ display: 'none' }} onChange={handleEngineVideo} />
          </div>
          {engineVideoLoading && (
            <div className="guided__video-status guided__video-status--loading">⏳ Extracting frames…</div>
          )}
          {engineVideoError && (
            <div className="guided__video-status guided__video-status--error">⚠️ {engineVideoError}</div>
          )}
          {engineVideoFrames.length > 0 && !engineVideoLoading && (
            <div className="guided__video-status guided__video-status--ok">
              <span>✓ {engineVideoName}</span>
              <span className="guided__video-frames">{engineVideoFrames.length} frames captured</span>
              <button className="guided__video-remove" type="button"
                onClick={() => { setEngineVideoFrames([]); setEngineVideoName(''); }}>×</button>
            </div>
          )}
          <p className="guided__upload-hint">Leaks, worn belts, cracked hoses, corrosion · max 50 MB video</p>
        </div>
      </div>

      {/* Step 3 — Dashboard */}
      <div className={`guided__step-content ${step === 3 ? 'guided__step-content--active' : ''}`}>
        <div className="guided__upload-zone">
          <div className="guided__upload-row">
            <span className="guided__upload-label">PHOTOS</span>
            {dashPhotos.length < 3 && (
              <button className="guided__upload-btn" type="button" onClick={() => dashPhotoRef.current?.click()}>
                📷 Add Photos
              </button>
            )}
            <input ref={dashPhotoRef} type="file" accept="image/jpeg,image/png,image/webp"
              multiple style={{ display: 'none' }} onChange={handleDashPhotos} />
          </div>
          {dashPhotos.length > 0 && (
            <div className="guided__thumbs">
              {dashPhotos.map((p, i) => (
                <div key={i} className="guided__thumb">
                  <img src={p.preview} alt={p.name} />
                  <button className="guided__thumb-remove" type="button"
                    onClick={() => setDashPhotos(prev => prev.filter((_, j) => j !== i))}>×</button>
                </div>
              ))}
            </div>
          )}
          <p className="guided__upload-hint">Check Engine, ABS, TPMS, oil pressure, battery lights</p>
        </div>
      </div>

      {/* Step 4 — Parked recording */}
      <div className={`guided__step-content ${step === 4 ? 'guided__step-content--active' : ''}`}>
        <InlineRecorder
          savedResult={recordings[4]}
          onSave={r => handleRecordingSave(4, r)}
          onClear={() => handleRecordingClear(4)}
          otherActive={activeRecordingStep !== null && activeRecordingStep !== 4}
          onActiveChange={active => handleRecordingActiveChange(4, active)}
        />
        {!recordings[4] && (
          <button className="inline-rec__silent-skip" type="button" onClick={goNext}>
            My car is silent when parked — skip this step
          </button>
        )}
      </div>

      {/* Step 5 — Motion recording */}
      <div className={`guided__step-content ${step === 5 ? 'guided__step-content--active' : ''}`}>
        <div className="guided__tip-chips">
          {['Noise when turning left', 'Noise when turning right', 'Noise when accelerating',
            'Noise when braking', 'Noise at highway speed'].map(tip => (
            <span key={tip} className="guided__tip-chip">{tip}</span>
          ))}
        </div>
        <InlineRecorder
          savedResult={recordings[5]}
          onSave={r => handleRecordingSave(5, r)}
          onClear={() => handleRecordingClear(5)}
          otherActive={activeRecordingStep !== null && activeRecordingStep !== 5}
          onActiveChange={active => handleRecordingActiveChange(5, active)}
        />
      </div>

      {/* Step 6 — Steering test */}
      <div className={`guided__step-content ${step === 6 ? 'guided__step-content--active' : ''}`}>
        <InlineRecorder
          savedResult={recordings[6]}
          onSave={r => handleRecordingSave(6, r)}
          onClear={() => handleRecordingClear(6)}
          otherActive={activeRecordingStep !== null && activeRecordingStep !== 6}
          onActiveChange={active => handleRecordingActiveChange(6, active)}
        />
      </div>

      {/* ── Footer navigation ── */}
      <div className="guided__footer">
        <div className="guided__footer-main">
          <button className="guided__back-btn" onClick={goBack} disabled={!canNav()} type="button">
            ← Back
          </button>

          {step > 1 && step < TOTAL && (
            <button className="guided__skip-btn" onClick={goSkip} disabled={!canNav()} type="button">
              Skip
            </button>
          )}

          {step === TOTAL ? (
            <button className="guided__run-btn" onClick={handleRunDiagnosis} disabled={!canNav()} type="button">
              🔍 Run Diagnosis
            </button>
          ) : (
            <button className="guided__next-btn" onClick={goNext} disabled={!canNav()} type="button">
              Next →
            </button>
          )}
        </div>

        {step >= 4 && step < TOTAL && hasAnyData && (
          <button className="guided__early-run" onClick={handleRunDiagnosis} disabled={!canNav()} type="button">
            Run Diagnosis Now
          </button>
        )}
      </div>
    </div>
  );
}
