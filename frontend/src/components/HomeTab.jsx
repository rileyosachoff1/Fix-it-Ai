import { useState, useRef, useEffect } from 'react';
import './HomeTab.css';

// ── Vehicle type detection ──────────────────────────────────────────────────
const SUV_KEYWORDS    = ['explorer','tahoe','suburban','escalade','4runner','pilot','cr-v','crv','rav4','rogue','tucson','equinox','traverse','pathfinder','armada','sequoia','wrangler','cherokee','compass','telluride','palisade','santa fe','cx-5','cx5','cx-9','outback','forester','highlander','gx','lx','rx','nx','rdx','mdx','qx80','qx60','murano','xc90','xc60','defender','range rover','discovery','navigator','expedition','q5','q7','q8','gle','glc','gls'];
const TRUCK_KEYWORDS  = ['f-150','f150','f-250','silverado','sierra','colorado','tundra','tacoma','ram ','1500','2500','3500','ranger','maverick','ridgeline','frontier','titan'];
const SPORTS_KEYWORDS = ['corvette','camaro','mustang','charger','challenger','supra','gt-r','gtr','nsx','911','718','boxster','cayman','f-type','amg gt','m3','m4','m5','m8','wrx','86','brz','miata','mx-5','z4'];

function getVehicleType(make, model) {
  const s = `${make} ${model}`.toLowerCase();
  if (TRUCK_KEYWORDS.some(k => s.includes(k)))  return 'truck';
  if (SUV_KEYWORDS.some(k => s.includes(k)))    return 'suv';
  if (SPORTS_KEYWORDS.some(k => s.includes(k))) return 'sports';
  return 'sedan';
}

// ── Vehicle silhouettes (fallback when no customer photo) ───────────────────
function VehicleSilhouette({ type, color }) {
  const body  = color || '#3c3c4a';
  const glass = color ? `${color}22` : 'rgba(180,200,255,0.08)';
  const bg    = '#111214';
  const hub   = color ? `${color}99` : '#4a4a5a';

  if (type === 'truck') return (
    <svg viewBox="0 0 220 80" fill="none" className="home-hero__car-svg">
      <path d="M12,60 L18,48 L28,42 L28,16 C28,12 36,9 55,9 L98,9 L98,42 L178,42 C184,44 188,50 188,56 L188,62 L12,62 Z" fill={body} opacity="0.9"/>
      <path d="M32,11 L32,40 L90,40 L90,11 Z" fill={glass}/>
      <circle cx="52"  cy="64" r="14" fill={bg}/><circle cx="52"  cy="64" r="10" fill={hub} opacity="0.6"/><circle cx="52"  cy="64" r="3"  fill={bg}/>
      <circle cx="164" cy="64" r="14" fill={bg}/><circle cx="164" cy="64" r="10" fill={hub} opacity="0.6"/><circle cx="164" cy="64" r="3"  fill={bg}/>
    </svg>
  );

  if (type === 'suv') return (
    <svg viewBox="0 0 220 82" fill="none" className="home-hero__car-svg">
      <path d="M12,62 L18,48 L30,34 L55,28 L55,13 C55,10 63,8 74,8 L145,8 C156,8 164,10 164,13 L164,28 L172,34 L190,48 L196,62 L12,62 Z" fill={body} opacity="0.9"/>
      <path d="M57,28 L57,13 L96,10 L96,28 Z" fill={glass}/><path d="M104,10 L162,13 L162,28 L104,28 Z" fill={glass}/>
      <circle cx="55"  cy="65" r="15" fill={bg}/><circle cx="55"  cy="65" r="10" fill={hub} opacity="0.6"/><circle cx="55"  cy="65" r="3"  fill={bg}/>
      <circle cx="163" cy="65" r="15" fill={bg}/><circle cx="163" cy="65" r="10" fill={hub} opacity="0.6"/><circle cx="163" cy="65" r="3"  fill={bg}/>
    </svg>
  );

  if (type === 'sports') return (
    <svg viewBox="0 0 220 72" fill="none" className="home-hero__car-svg">
      <path d="M10,56 L20,50 L40,34 L70,22 C82,16 95,13 110,13 C125,13 145,17 165,28 L184,40 L200,52 L200,58 L10,58 Z" fill={body} opacity="0.9"/>
      <path d="M55,30 C65,18 82,14 106,13 L104,28 C88,28 72,28 62,34 Z" fill={glass}/>
      <path d="M112,13 C130,14 148,20 162,28 L155,34 L110,34 Z" fill={glass}/>
      <circle cx="52"  cy="60" r="12" fill={bg}/><circle cx="52"  cy="60" r="8"  fill={hub} opacity="0.6"/><circle cx="52"  cy="60" r="2.5" fill={bg}/>
      <circle cx="162" cy="60" r="12" fill={bg}/><circle cx="162" cy="60" r="8"  fill={hub} opacity="0.6"/><circle cx="162" cy="60" r="2.5" fill={bg}/>
    </svg>
  );

  return (
    <svg viewBox="0 0 220 74" fill="none" className="home-hero__car-svg">
      <path d="M12,58 L18,52 L38,38 L58,28 L65,16 C68,12 78,10 100,10 C122,10 134,12 140,16 L155,28 L178,36 L200,52 L202,58 L12,58 Z" fill={body} opacity="0.9"/>
      <path d="M62,28 C68,16 80,11 98,10 L96,27 C82,27 70,27 64,32 Z" fill={glass}/>
      <path d="M106,10 C124,11 136,17 148,28 L143,33 L105,28 Z" fill={glass}/>
      <circle cx="52"  cy="61" r="13" fill={bg}/><circle cx="52"  cy="61" r="9"  fill={hub} opacity="0.6"/><circle cx="52"  cy="61" r="2.5" fill={bg}/>
      <circle cx="160" cy="61" r="13" fill={bg}/><circle cx="160" cy="61" r="9"  fill={hub} opacity="0.6"/><circle cx="160" cy="61" r="2.5" fill={bg}/>
    </svg>
  );
}

// ── Health score ring ───────────────────────────────────────────────────────
function HealthRing({ score }) {
  const R      = 30;
  const circ   = 2 * Math.PI * R;
  const offset = circ * (1 - score / 100);
  const color  = score >= 80 ? 'var(--success)' : score >= 55 ? 'var(--warning)' : 'var(--danger)';
  return (
    <svg viewBox="0 0 80 80" width="76" height="76" style={{ flexShrink: 0 }}>
      <circle cx="40" cy="40" r={R} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="5"/>
      <circle cx="40" cy="40" r={R} fill="none" stroke={color} strokeWidth="5"
        strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
        transform="rotate(-90 40 40)"
        style={{ transition: 'stroke-dashoffset 1.2s ease-out, stroke 0.4s' }}
      />
      <text x="40" y="36" textAnchor="middle" fontSize="17" fontWeight="700" fill="white" fontFamily="Inter">{score}</text>
      <text x="40" y="51" textAnchor="middle" fontSize="9"  fontWeight="600" fill="rgba(235,235,245,0.5)" fontFamily="Inter" letterSpacing="0.8">HEALTH</text>
    </svg>
  );
}

// ── Stat card ───────────────────────────────────────────────────────────────
function StatCard({ label, value, unit, status }) {
  const cls    = status === 'warn' ? ' stat-card--warn' : status === 'danger' ? ' stat-card--danger' : '';
  const isNull = value === null || value === undefined;
  return (
    <div className={`stat-card${cls}`}>
      <span className="stat-card__label">{label}</span>
      <span className="stat-card__value tabular">
        {isNull
          ? <span className="stat-card__nil">--</span>
          : <>{value}{unit && <span className="stat-card__unit"> {unit}</span>}</>
        }
      </span>
    </div>
  );
}

// ── Health helpers ──────────────────────────────────────────────────────────
function calcHealth(faultCodes, liveData) {
  let s = 100;
  if (faultCodes?.length) s -= Math.min(faultCodes.length * 15, 60);
  if (liveData) {
    if (liveData.coolantTemp > 108) s -= 15;
    else if (liveData.coolantTemp > 0 && liveData.coolantTemp < 60) s -= 8;
    if (liveData.batteryVoltage) {
      if (liveData.batteryVoltage < 12.0 || liveData.batteryVoltage > 15.5) s -= 10;
      else if (liveData.batteryVoltage < 12.4) s -= 5;
    }
    if (Math.abs(liveData.fuelTrimLT || 0) > 20) s -= 5;
  }
  return Math.max(0, Math.min(100, s));
}
function coolantStatus(v)  { return v > 105 ? 'danger' : v > 100 ? 'warn' : 'ok'; }
function batteryStatus(v)  { return v < 11.8 || v > 15.5 ? 'danger' : v < 12.2 ? 'warn' : 'ok'; }
function fuelTrimStatus(v) { return Math.abs(v) > 20 ? 'danger' : Math.abs(v) > 12 ? 'warn' : 'ok'; }

// ── Main component ──────────────────────────────────────────────────────────
export default function HomeTab({
  vehicleInfo, onVehicleInfoChange,
  liveData, faultCodes = [],
  obd2Connected, obd2DeviceName, obd2Connecting,
  onObd2Connect, onObd2ConnectMock, onObd2Disconnect,
  recentDiagnoses = [], units = 'metric',
  vehiclePhoto, vehiclePhotoLoading, vehiclePhotoError,
  onPhotoFileSelect, onPhotoRemove,
  onFindMechanic,
}) {
  const vehicleType  = getVehicleType(vehicleInfo?.make || '', vehicleInfo?.model || '');
  const healthScore  = calcHealth(faultCodes, liveData);
  const vehicleName  = vehicleInfo?.nickname
    || [vehicleInfo?.year, vehicleInfo?.make, vehicleInfo?.model].filter(Boolean).join(' ')
    || 'My Vehicle';
  const vehicleSub   = [vehicleInfo?.year, vehicleInfo?.make, vehicleInfo?.model, vehicleInfo?.trim]
    .filter(Boolean).join(' · ');
  const hasVehicle   = !!(vehicleInfo?.make || vehicleInfo?.year);
  const vehicleColor = vehicleInfo?.vehicleColor || '';
  const isChrome     = !!(navigator.bluetooth);
  const hasPhoto     = !!vehiclePhoto?.dataUrl;

  // ── Photo upload state ──────────────────────────────────────────────────
  const [showPhotoOptions,    setShowPhotoOptions]    = useState(false);
  const [suggestionDismissed, setSuggestionDismissed] = useState(false);
  const cameraInputRef  = useRef(null);
  const libraryInputRef = useRef(null);

  // Reset suggestion when photo changes
  useEffect(() => { setSuggestionDismissed(false); }, [vehiclePhoto]);

  function handleFileChange(e) {
    const file = e.target.files?.[0];
    e.target.value = '';   // reset so same file can be re-selected
    if (file) onPhotoFileSelect?.(file);
  }

  // Make/model suggestion from AI analysis
  const analysis = vehiclePhoto?.analysis;
  const showSuggestion = !suggestionDismissed
    && analysis?.make
    && (
      analysis.make.toLowerCase()  !== (vehicleInfo?.make  || '').toLowerCase()
      || (analysis.model && analysis.model.toLowerCase() !== (vehicleInfo?.model || '').toLowerCase())
    );

  const heroGlow = vehicleColor
    ? `${vehicleColor}22`
    : 'rgba(10,132,255,0.10)';

  function tempDisplay(c) {
    if (c == null) return null;
    return units === 'imperial' ? Math.round(c * 9/5 + 32) : Math.round(c);
  }
  function tempUnit() { return units === 'imperial' ? '°F' : '°C'; }

  return (
    <div className="home-tab">
      {/* ── Hidden file inputs ── */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />
      <input
        ref={libraryInputRef}
        type="file"
        accept="image/*,image/heic"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />

      {/* ── Vehicle hero ── */}
      <div
        className={`home-hero${hasPhoto ? ' home-hero--has-photo' : ''}`}
        style={{ '--hero-glow': heroGlow }}
      >
        {hasPhoto ? (
          /* ── Real customer photo ── */
          <>
            <img
              src={vehiclePhoto.dataUrl}
              alt={vehicleName}
              className="home-hero__photo"
            />
            {/* Vehicle color tint overlay */}
            {vehicleColor && (
              <div className="home-hero__color-overlay" style={{ background: vehicleColor }} />
            )}
            {/* Reading vehicle… loading overlay */}
            {vehiclePhotoLoading && (
              <div className="home-hero__photo-loading">
                <div className="home-hero__photo-loading__spinner" />
                <span>Reading your vehicle…</span>
              </div>
            )}
            {/* Edit button — top right */}
            <button
              className="home-hero__photo-edit"
              onClick={() => setShowPhotoOptions(true)}
              aria-label="Change vehicle photo"
            >
              ✏️
            </button>
          </>
        ) : (
          /* ── No photo: glow bg + camera placeholder / SVG silhouette ── */
          <>
            <div className="home-hero__bg-glow" />

            {vehiclePhotoLoading ? (
              /* Loading state (first upload, no photo yet) */
              <div className="home-hero__camera-placeholder home-hero__camera-placeholder--loading">
                <div className="home-hero__camera-placeholder__spinner" />
                <span className="home-hero__camera-placeholder__text">Reading your vehicle…</span>
              </div>
            ) : vehiclePhotoError ? (
              /* Error state — "No vehicle detected" */
              <div
                className="home-hero__camera-placeholder home-hero__camera-placeholder--error"
                onClick={() => setShowPhotoOptions(true)}
                role="button"
                tabIndex={0}
                onKeyDown={e => e.key === 'Enter' && setShowPhotoOptions(true)}
              >
                <span className="home-hero__camera-placeholder__icon">⚠️</span>
                <span className="home-hero__camera-placeholder__text">{vehiclePhotoError}</span>
                <span className="home-hero__camera-placeholder__sub">Tap to try again</span>
              </div>
            ) : (
              /* Default: SVG silhouette with "Add Photo" tap area */
              <>
                <div className="home-hero__car">
                  <VehicleSilhouette type={vehicleType} color={vehicleColor || null} />
                </div>
                <div
                  className="home-hero__camera-tap"
                  onClick={() => setShowPhotoOptions(true)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={e => e.key === 'Enter' && setShowPhotoOptions(true)}
                  aria-label="Add vehicle photo"
                >
                  <span className="home-hero__camera-tap__icon">📷</span>
                  <span className="home-hero__camera-tap__text">Tap to add a photo of your vehicle</span>
                  <span className="home-hero__camera-tap__sub">Take a photo or choose from your library</span>
                </div>
              </>
            )}
          </>
        )}

        {/* Bottom gradient scrim (always rendered) */}
        <div className="home-hero__bottom-gradient" />

        {/* Bottom row: vehicle name + health ring */}
        <div className="home-hero__bottom">
          <div className="home-hero__info">
            <h1 className="home-hero__name">{vehicleName}</h1>
            {hasVehicle && vehicleSub && (
              <p className="home-hero__sub">{vehicleSub}</p>
            )}
          </div>
          <HealthRing score={healthScore} />
        </div>

        {/* Fault badge — top left */}
        {faultCodes.length > 0 && (
          <div className="home-hero__fault-badge">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
              <line x1="12" y1="9"  x2="12" y2="13"/>
              <line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
            {faultCodes.length} fault{faultCodes.length > 1 ? 's' : ''}
          </div>
        )}

        {/* AI make/model suggestion */}
        {showSuggestion && (
          <div className="home-hero__suggestion">
            <span className="home-hero__suggestion__text">
              Looks like a {analysis.make}{analysis.model ? ` ${analysis.model}` : ''} — update vehicle info?
            </span>
            <div className="home-hero__suggestion__btns">
              <button
                className="home-hero__suggestion__btn home-hero__suggestion__btn--yes"
                onClick={() => {
                  onVehicleInfoChange?.({ make: analysis.make, model: analysis.model || '' });
                  setSuggestionDismissed(true);
                }}
              >Yes</button>
              <button
                className="home-hero__suggestion__btn home-hero__suggestion__btn--no"
                onClick={() => setSuggestionDismissed(true)}
              >No</button>
            </div>
          </div>
        )}
      </div>

      {/* ── Photo options bottom sheet ── */}
      {showPhotoOptions && (
        <div
          className="home-photo-options-overlay"
          onClick={() => setShowPhotoOptions(false)}
        >
          <div
            className="home-photo-options"
            onClick={e => e.stopPropagation()}
          >
            <div className="home-photo-options__handle" />

            <button
              className="home-photo-options__btn"
              onClick={() => { setShowPhotoOptions(false); cameraInputRef.current?.click(); }}
            >
              <span className="home-photo-options__btn-icon">📷</span>
              <span className="home-photo-options__btn-label">Take Photo</span>
            </button>

            <button
              className="home-photo-options__btn"
              onClick={() => { setShowPhotoOptions(false); libraryInputRef.current?.click(); }}
            >
              <span className="home-photo-options__btn-icon">🖼️</span>
              <span className="home-photo-options__btn-label">Choose from Library</span>
            </button>

            {hasPhoto && (
              <button
                className="home-photo-options__btn home-photo-options__btn--danger"
                onClick={() => { setShowPhotoOptions(false); onPhotoRemove?.(); }}
              >
                <span className="home-photo-options__btn-icon">🗑️</span>
                <span className="home-photo-options__btn-label">Remove Photo</span>
              </button>
            )}

            <button
              className="home-photo-options__cancel"
              onClick={() => setShowPhotoOptions(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ── Find Mechanic quick action ── */}
      <button className="home-find-mechanic" onClick={onFindMechanic}>
        <div className="home-find-mechanic__icon-wrap">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
          </svg>
        </div>
        <div className="home-find-mechanic__text">
          <span className="home-find-mechanic__title">Find a Mechanic</span>
          <span className="home-find-mechanic__sub">FixIt AI partner shops near you</span>
        </div>
        <div className="home-find-mechanic__badge">✦</div>
        <svg className="home-find-mechanic__chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <polyline points="9 18 15 12 9 6"/>
        </svg>
      </button>

      {/* ── Scanner status ── */}
      <div className={`home-scanner home-scanner--${obd2Connected ? 'connected' : obd2Connecting ? 'connecting' : 'idle'}`}>
        {obd2Connected ? (
          <>
            <div className="home-scanner__dot home-scanner__dot--on" />
            <span className="home-scanner__text">
              <strong>{obd2DeviceName || 'OBD2 Scanner'}</strong> · Live data active
            </span>
            <button className="home-scanner__btn home-scanner__btn--disconnect" onClick={onObd2Disconnect}>
              Disconnect
            </button>
          </>
        ) : obd2Connecting ? (
          <>
            <div className="home-scanner__dot home-scanner__dot--pulse" />
            <span className="home-scanner__text">Connecting…</span>
          </>
        ) : (
          <>
            <div className="home-scanner__dot home-scanner__dot--off" />
            <span className="home-scanner__text">No scanner connected</span>
            {isChrome && (
              <button className="home-scanner__btn" onClick={onObd2Connect}>Connect</button>
            )}
            <button className="home-scanner__btn home-scanner__btn--demo" onClick={onObd2ConnectMock}>
              Demo
            </button>
          </>
        )}
      </div>

      {/* ── Quick stats ── */}
      <div className="home-stats">
        <div className="home-stats__header">
          <h2 className="home-stats__title">LIVE SENSORS</h2>
          {!obd2Connected && (
            <span className="home-stats__hint">Connect scanner for live data</span>
          )}
        </div>
        <div className="home-stats__grid">
          <StatCard
            label="RPM"
            value={liveData?.rpm !== undefined ? Math.round(liveData.rpm) : null}
            unit=""
          />
          <StatCard
            label="Coolant"
            value={liveData?.coolantTemp !== undefined ? tempDisplay(liveData.coolantTemp) : null}
            unit={liveData?.coolantTemp !== undefined ? tempUnit() : '°'}
            status={liveData?.coolantTemp !== undefined ? coolantStatus(liveData.coolantTemp) : undefined}
          />
          <StatCard
            label="Battery"
            value={liveData?.batteryVoltage !== undefined ? liveData.batteryVoltage.toFixed(1) : null}
            unit="V"
            status={liveData?.batteryVoltage !== undefined ? batteryStatus(liveData.batteryVoltage) : undefined}
          />
          <StatCard
            label="Eng. Load"
            value={liveData?.engineLoad !== undefined ? Math.round(liveData.engineLoad) : null}
            unit="%"
          />
          <StatCard
            label="Fuel Trim"
            value={liveData?.fuelTrimLT !== undefined
              ? (liveData.fuelTrimLT > 0 ? `+${liveData.fuelTrimLT.toFixed(1)}` : liveData.fuelTrimLT.toFixed(1))
              : null}
            unit="%"
            status={liveData?.fuelTrimLT !== undefined ? fuelTrimStatus(liveData.fuelTrimLT) : undefined}
          />
          <StatCard
            label="Throttle"
            value={liveData?.throttlePos !== undefined ? Math.round(liveData.throttlePos) : null}
            unit="%"
          />
        </div>
      </div>

      {/* ── Active alerts ── */}
      {faultCodes.length > 0 && (
        <div className="home-alerts">
          <h2 className="home-section-title">ACTIVE ALERTS</h2>
          <div className="home-alerts__list">
            {faultCodes.slice(0, 5).map(fc => (
              <div key={fc.code} className="home-alert-chip">
                <span className="home-alert-chip__icon">⚠️</span>
                <span className="home-alert-chip__code">{fc.code}</span>
                <span className="home-alert-chip__desc">{fc.description || 'Fault code detected'}</span>
              </div>
            ))}
            {faultCodes.length > 5 && (
              <div className="home-alert-chip home-alert-chip--more">
                +{faultCodes.length - 5} more faults — check Alerts tab
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Recent diagnoses ── */}
      {recentDiagnoses.length > 0 && (
        <div className="home-history">
          <h2 className="home-section-title">RECENT DIAGNOSIS</h2>
          {recentDiagnoses.slice(0, 2).map(d => (
            <div key={d.id} className="home-history-card">
              <div className="home-history-card__meta">
                <span className="home-history-card__date">
                  {new Date(d.recordedAt).toLocaleDateString(undefined, { month:'short', day:'numeric', year:'numeric' })}
                </span>
                {d.vehicleInfo && (
                  <span className="home-history-card__vehicle">
                    {[d.vehicleInfo.year, d.vehicleInfo.make, d.vehicleInfo.model].filter(Boolean).join(' ')}
                  </span>
                )}
              </div>
              <p className="home-history-card__summary">
                {d.primary?.diagnosis || d.primary?.cause || 'Diagnosis completed'}
              </p>
            </div>
          ))}
        </div>
      )}

      <div style={{ height: '100px' }} />
    </div>
  );
}
