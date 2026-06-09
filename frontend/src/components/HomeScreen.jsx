import { useState, useRef, useEffect } from 'react';
import { YEARS, MAKES, MODELS_BY_MAKE } from '../data/vehicles.js';
import * as obd2Service from '../services/obd2Service.js';
import './HomeScreen.css';

// ── Helpers ───────────────────────────────────────────────────────────────────
function urgencyLabel(u) {
  if (u === 'urgent')        return { text: 'URGENT',        cls: 'badge--urgent' };
  if (u === 'schedule_soon') return { text: 'SCHEDULE SOON', cls: 'badge--warn'   };
  return                            { text: 'MONITOR',       cls: 'badge--ok'     };
}
function timeAgo(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// ── ScannerBar ────────────────────────────────────────────────────────────────
function ScannerBar({ phase, deviceName, liveData, onConnect, onConnectMock, onDisconnect }) {
  // Non-Chrome browser
  if (!('bluetooth' in navigator)) {
    return (
      <div className="scanner-bar scanner-bar--unsupported" role="status" aria-live="polite">
        <span aria-hidden="true">ℹ️</span>
        <span>OBD2 scanner requires Chrome browser</span>
      </div>
    );
  }

  if (phase === 'connected') {
    return (
      <div className="scanner-bar scanner-bar--connected" role="status" aria-live="polite">
        <span className="scanner-bar__dot scanner-bar__dot--on" aria-hidden="true" />
        <span className="scanner-bar__name">{deviceName || 'OBD2 Scanner'}</span>
        {liveData && (
          <div className="scanner-bar__live" aria-label="Live sensor readings">
            {liveData.rpm            != null && <span>{Math.round(liveData.rpm)} RPM</span>}
            {liveData.coolantTemp    != null && <span>{Math.round(liveData.coolantTemp)}°C</span>}
            {liveData.batteryVoltage != null && <span>{liveData.batteryVoltage.toFixed(1)}V</span>}
          </div>
        )}
        <button className="scanner-bar__disc-btn" onClick={onDisconnect} type="button">
          Disconnect
        </button>
      </div>
    );
  }

  if (phase === 'connecting') {
    return (
      <div className="scanner-bar scanner-bar--connecting" role="status" aria-live="polite">
        <span className="scanner-bar__pulse-dot" aria-hidden="true" />
        <span className="scanner-bar__connecting-text">Connecting to scanner…</span>
      </div>
    );
  }

  // disconnected
  return (
    <div className="scanner-bar scanner-bar--disconnected">
      <div className="scanner-bar__row">
        <span className="scanner-bar__dot scanner-bar__dot--off" aria-hidden="true" />
        <span className="scanner-bar__label">FixIt OBD2 Scanner</span>
        <span className="scanner-bar__status-text">Not connected</span>
        <div className="scanner-bar__btns">
          <button className="scanner-bar__connect-btn" onClick={onConnect} type="button">
            Connect Scanner
          </button>
          <button className="scanner-bar__demo-btn" onClick={onConnectMock} type="button">
            Demo
          </button>
        </div>
      </div>
      <a
        className="scanner-bar__buy-link"
        href="https://www.amazon.com/s?k=obd2+bluetooth+elm327+adapter"
        target="_blank"
        rel="noopener noreferrer"
      >
        Don't have one? Get an ELM327 adapter →
      </a>
    </div>
  );
}

// ── VehicleBar — dropdowns ────────────────────────────────────────────────────
function VehicleBar({ vehicleInfo, onChange }) {
  const models = vehicleInfo.make ? (MODELS_BY_MAKE[vehicleInfo.make] ?? []) : [];

  function handleMakeChange(make) {
    onChange({ make, model: '' });
  }

  return (
    <div className="vehicle-bar">
      <span className="vehicle-bar__label">
        Your vehicle <span className="vehicle-bar__opt">(optional — improves accuracy)</span>
      </span>
      <div className="vehicle-bar__fields">
        <select
          className="vehicle-bar__select"
          value={vehicleInfo.year}
          onChange={e => onChange({ year: e.target.value })}
          aria-label="Vehicle year"
        >
          <option value="">Year</option>
          {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
        </select>

        <select
          className="vehicle-bar__select vehicle-bar__select--wide"
          value={vehicleInfo.make}
          onChange={e => handleMakeChange(e.target.value)}
          aria-label="Vehicle make"
        >
          <option value="">Make</option>
          {MAKES.map(m => <option key={m} value={m}>{m}</option>)}
        </select>

        <select
          className="vehicle-bar__select vehicle-bar__select--wide"
          value={vehicleInfo.model}
          onChange={e => onChange({ model: e.target.value })}
          disabled={!vehicleInfo.make}
          aria-label="Vehicle model"
        >
          <option value="">Model</option>
          {models.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
      </div>
    </div>
  );
}

// ── LocationBar ───────────────────────────────────────────────────────────────
function LocationBar({ location, onChange }) {
  return (
    <div className="location-bar">
      <span className="location-bar__icon" aria-hidden="true">📍</span>
      <input
        className="location-bar__input"
        type="text"
        placeholder="Your city or address — for finding mechanics near you"
        value={location}
        onChange={e => onChange(e.target.value)}
        aria-label="Your location for finding mechanics"
      />
    </div>
  );
}

// ── Media helpers (for DetailsPanel) ─────────────────────────────────────────
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
    function snap() {
      try {
        const MAX_W = 640, ratio = (video.videoWidth || 640) > MAX_W ? MAX_W / video.videoWidth : 1;
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
    const ts = [];
    for (let t = 0; t < dur; t += intervalSecs) ts.push(t);
    if (!ts.length) ts.push(0);
    const frames = [];
    for (const t of ts) { const f = await captureVideoFrame(video, t); if (f) frames.push(f); }
    return { frames };
  } finally { URL.revokeObjectURL(url); }
}

// ── DetailsPanel (quick details for simple flow) ───────────────────────────────
function DetailsPanel({ mediaData, onChange }) {
  const [open, setOpen]             = useState(false);
  const [videoError, setVideoError] = useState('');
  const [videoLoading, setVideoLoading] = useState(false);
  const photoRef = useRef(null);
  const videoRef = useRef(null);
  const { textDescription, photos, videoFrames, videoName } = mediaData;

  async function handlePhotoFiles(e) {
    const slots = 3 - photos.length;
    const files = Array.from(e.target.files).slice(0, slots);
    const newPhotos = await Promise.all(files.map(async f => ({
      base64: await fileToBase64(f), mediaType: mediaTypeOf(f),
      preview: URL.createObjectURL(f), name: f.name,
    })));
    onChange({ photos: [...photos, ...newPhotos] });
    e.target.value = '';
  }
  async function handleVideoFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    e.target.value = '';
    setVideoError('');
    if (file.size > 50 * 1024 * 1024) { setVideoError('Video too large (max 50 MB)'); return; }
    setVideoLoading(true);
    try {
      const { frames } = await extractVideoFrames(file);
      onChange({ videoFrames: frames, videoName: file.name });
    } catch (err) { setVideoError(err.message || 'Could not process video'); }
    finally { setVideoLoading(false); }
  }

  const hasContent = textDescription || photos.length > 0 || videoFrames.length > 0;

  return (
    <div className="details-panel">
      <button
        className={`details-toggle ${open ? 'details-toggle--open' : ''} ${hasContent ? 'details-toggle--has-content' : ''}`}
        onClick={() => setOpen(o => !o)} type="button" aria-expanded={open}
      >
        <span className="details-toggle__icon">{open ? '▼' : '▶'}</span>
        <span>Quick Details</span>
        <span className="details-toggle__sub">for simple recording flow</span>
        {hasContent && <span className="details-toggle__dot" />}
      </button>
      <div className={`details-body ${open ? 'details-body--open' : ''}`} aria-hidden={!open}>
        <div className="details-inner">
          <div className="details-section">
            <textarea className="details-textarea" rows={2} maxLength={500}
              placeholder="Describe what you hear… (used if you click 'Skip All & Just Record')"
              value={textDescription}
              onChange={e => onChange({ textDescription: e.target.value.slice(0, 500) })} />
            <span className="details-charcount">{textDescription.length}/500</span>
          </div>
          <div className="details-section">
            <div className="details-media-header">
              <span className="details-media-label">PHOTOS</span>
              {photos.length < 3 && (
                <button className="details-upload-btn" type="button" onClick={() => photoRef.current?.click()}>
                  📷 Add Photos
                </button>
              )}
              <input ref={photoRef} type="file" accept="image/jpeg,image/png,image/webp"
                multiple style={{ display: 'none' }} onChange={handlePhotoFiles} />
            </div>
            {photos.length > 0 && (
              <div className="details-thumbs">
                {photos.map((p, i) => (
                  <div key={i} className="details-thumb">
                    <img src={p.preview} alt={p.name} />
                    <button className="details-thumb__remove" type="button"
                      onClick={() => onChange({ photos: photos.filter((_, j) => j !== i) })}>×</button>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="details-section">
            <div className="details-media-header">
              <span className="details-media-label">VIDEO</span>
              {!videoFrames.length && !videoLoading && (
                <button className="details-upload-btn" type="button" onClick={() => videoRef.current?.click()}>
                  🎥 Add Video
                </button>
              )}
              <input ref={videoRef} type="file" accept="video/mp4,video/quicktime,video/webm,video/mov"
                style={{ display: 'none' }} onChange={handleVideoFile} />
            </div>
            {videoLoading && <div className="details-video-status details-video-status--loading">⏳ Extracting frames…</div>}
            {videoError  && <div className="details-video-status details-video-status--error">⚠️ {videoError}</div>}
            {videoFrames.length > 0 && !videoLoading && (
              <div className="details-video-status details-video-status--ok">
                <span>✓ {videoName}</span>
                <span className="details-video-frames">{videoFrames.length} frames</span>
                <button className="details-video-remove" type="button"
                  onClick={() => onChange({ videoFrames: [], videoName: '' })}>×</button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function HomeScreen({
  onStartGuided, recentDiagnoses, onViewHistory, error,
  vehicleInfo, onVehicleInfoChange,
  location, onLocationChange,
  mediaData, onMediaDataChange,
  // OBD2 props
  obd2Connected, obd2DeviceName, obd2Connecting,
  onObd2Connect, onObd2ConnectMock, onObd2Disconnect,
}) {
  const [pressing,  setPressing]  = useState(false);
  const [liveData,  setLiveData]  = useState(null);

  // Derive scanner bar phase
  const scannerPhase = obd2Connecting ? 'connecting' : obd2Connected ? 'connected' : 'disconnected';

  // Live sensor polling — only while connected
  useEffect(() => {
    if (!obd2Connected) { setLiveData(null); return; }
    obd2Service.readLiveSummary().then(d => { if (d) setLiveData(d); }).catch(() => {});
    const id = setInterval(() => {
      obd2Service.readLiveSummary().then(d => { if (d) setLiveData(d); }).catch(() => {});
    }, 3000);
    return () => clearInterval(id);
  }, [obd2Connected]);

  return (
    <div className="home">
      <header className="home__header">
        <div className="home__logo">
          <span className="home__logo-icon">🔧</span>
          <span className="home__logo-text">FixIt <span className="home__logo-accent">AI</span></span>
        </div>
        <p className="home__tagline">Shazam for your car</p>
      </header>

      {error && (
        <div className="home__error" role="alert">
          <span>⚠️</span><span>{error}</span>
        </div>
      )}

      <ScannerBar
        phase={scannerPhase}
        deviceName={obd2DeviceName}
        liveData={liveData}
        onConnect={onObd2Connect}
        onConnectMock={onObd2ConnectMock}
        onDisconnect={onObd2Disconnect}
      />

      <VehicleBar vehicleInfo={vehicleInfo} onChange={onVehicleInfoChange} />
      <LocationBar location={location} onChange={onLocationChange} />

      <main className="home__main">
        <div className="home__btn-area">
          <button
            className={`record-btn ${pressing ? 'record-btn--pressing' : ''}`}
            onMouseDown={() => setPressing(true)}
            onMouseUp={() => setPressing(false)}
            onMouseLeave={() => setPressing(false)}
            onTouchStart={() => setPressing(true)}
            onTouchEnd={() => setPressing(false)}
            onClick={onStartGuided}
            aria-label="Start guided diagnosis"
          >
            <span className="record-btn__ring record-btn__ring--1" aria-hidden="true" />
            <span className="record-btn__ring record-btn__ring--2" aria-hidden="true" />
            <span className="record-btn__ring record-btn__ring--3" aria-hidden="true" />
            <span className="record-btn__inner">
              <span className="record-btn__mic">🎙️</span>
              <span className="record-btn__label">TAP TO DIAGNOSE</span>
            </span>
          </button>
        </div>
        <p className="home__instruction">Tap to start the guided diagnosis</p>
      </main>

      <DetailsPanel mediaData={mediaData} onChange={onMediaDataChange} />

      <section className="home__how">
        <div className="home__step"><span className="home__step-n">1</span><span>6 guided steps</span></div>
        <span className="home__step-arrow">→</span>
        <div className="home__step"><span className="home__step-n">2</span><span>Record the sound</span></div>
        <span className="home__step-arrow">→</span>
        <div className="home__step"><span className="home__step-n">3</span><span>Get AI diagnosis</span></div>
      </section>

      {recentDiagnoses.length > 0 && (
        <section className="home__history">
          <h2 className="home__history-title">RECENT DIAGNOSES</h2>
          <ul className="home__history-list">
            {recentDiagnoses.slice(0, 5).map(d => {
              const primary = d.primary ?? d;
              const badge   = urgencyLabel(primary.urgency);
              return (
                <li key={d.id}>
                  <button className="home__history-item" onClick={() => onViewHistory(d)}>
                    <div className="home__history-left">
                      <span className="home__history-name">{primary.diagnosis}</span>
                      <span className="home__history-meta">
                        {timeAgo(d.recordedAt)}
                        <span className="home__history-cost">
                          ${primary.estimatedCost?.min}–${primary.estimatedCost?.max}
                        </span>
                        {d.vehicleInfo?.make && (
                          <span className="home__history-vehicle">
                            {d.vehicleInfo.year} {d.vehicleInfo.make}
                          </span>
                        )}
                      </span>
                    </div>
                    <div className="home__history-right">
                      <span className={`badge ${badge.cls}`}>{badge.text}</span>
                      <span className="home__chevron">›</span>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <footer className="home__footer">
        <p>AI diagnosis · for reference only · see a qualified mechanic</p>
      </footer>
    </div>
  );
}
