import { useState, useRef, useEffect } from 'react';
import './HomeTab.css';
import { healthTier } from '../utils/healthScore.js';
import HealthGauge from './ui/HealthGauge.jsx';
import SettingsSheet from './SettingsSheet.jsx';
import VehicleSilhouette from './ui/VehicleSilhouette.jsx';
import AlertsSheet from './AlertsSheet.jsx';

function timeGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
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

// ── Status helpers ──────────────────────────────────────────────────────────
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
  healthScore = 85,
  vehicleSpecs = null,
  maintenanceDue = [],
  serviceRecords = [],
  currentOdoKm = 0,
  onStartDiagnosis,
  onNavigateTab,
  theme = 'dark',
  onThemeChange,
  onUnitsChange,
  onClearAll,
  alerts = [],
  unreadAlertCount = 0,
  onMarkAlertsSeen,
  onDismissAlert,
  onClearAlerts,
  wikiVehicleImage = null,
}) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [alertsOpen,   setAlertsOpen]   = useState(false);

  function openAlerts() {
    setAlertsOpen(true);
    onMarkAlertsSeen?.();
  }
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

  // ── Health tier + dashboard data ──────────────────────────────────────────
  const tier = healthTier(healthScore);

  // Km since the most recent logged service (records or schedule log)
  const lastServiceKm = (() => {
    const kms = [
      ...serviceRecords.map(r => r.mileageKm),
      ...maintenanceDue.map(i => i.lastKm),
    ].filter(v => v != null && v > 0);
    return kms.length ? Math.max(...kms) : null;
  })();
  const kmSinceService = (lastServiceKm != null && currentOdoKm > 0)
    ? Math.max(0, currentOdoKm - lastServiceKm)
    : null;

  const isEV = !!vehicleSpecs?.isEV;
  const odoLabel = vehicleInfo?.odometer
    ? `${parseFloat(vehicleInfo.odometer).toLocaleString()} ${vehicleInfo.odometerUnit || 'km'}`
    : null;

  // Stat pills: engine · odometer · km since service · fuel type
  const statPills = vehicleSpecs ? [
    { icon: isEV ? '⚡' : '🔧', label: 'Engine', value: vehicleSpecs.engine },
    { icon: '🛣️', label: 'Odometer', value: odoLabel || '—' },
    { icon: '🗓️', label: 'Since service', value: kmSinceService != null ? `${kmSinceService.toLocaleString()} km` : '—' },
    { icon: isEV ? '🔋' : '⛽', label: 'Fuel', value: vehicleSpecs.fuelType || (isEV ? 'Electric' : '—') },
  ] : [];

  // Specs strip: 6 chips, EV-aware. Hidden entirely when no specs.
  const specChips = !vehicleSpecs ? [] : isEV ? [
    { label: 'Range',    value: vehicleSpecs.rangeKm ? `${vehicleSpecs.rangeKm} km` : '—' },
    { label: 'Battery',  value: vehicleSpecs.batteryKWh ? `${vehicleSpecs.batteryKWh} kWh` : '—' },
    { label: 'DC Fast',  value: vehicleSpecs.dcFastChargeKW ? `${vehicleSpecs.dcFastChargeKW} kW` : '—' },
    { label: 'Power',    value: vehicleSpecs.horsepower ? `${vehicleSpecs.horsepower} hp` : '—' },
    { label: '0–100',    value: vehicleSpecs.zeroToHundred ? `${vehicleSpecs.zeroToHundred}s` : '—' },
    { label: 'Drive',    value: vehicleSpecs.drivetrain || '—' },
  ] : [
    { label: 'Power',    value: vehicleSpecs.horsepower ? `${vehicleSpecs.horsepower} hp` : '—' },
    { label: 'Torque',   value: vehicleSpecs.torque ? `${vehicleSpecs.torque} ${vehicleSpecs.torqueUnit || 'lb-ft'}` : '—' },
    { label: '0–100',    value: vehicleSpecs.zeroToHundred ? `${vehicleSpecs.zeroToHundred}s` : '—' },
    { label: 'Economy',  value: vehicleSpecs.L100kmCombined ? `${vehicleSpecs.L100kmCombined} L/100km` : '—' },
    { label: 'Tank',     value: vehicleSpecs.fuelTankL ? `${vehicleSpecs.fuelTankL} L` : '—' },
    { label: 'Drive',    value: vehicleSpecs.drivetrain || '—' },
  ];

  function handleObd2Action() {
    if (obd2Connected) { onNavigateTab?.('live'); return; }
    if (isChrome) onObd2Connect?.();
    else onObd2ConnectMock?.();
  }

  const ownerFirst = (vehicleInfo?.ownerName || '').trim().split(/\s+/)[0];

  return (
    <div className="home-tab">
      {/* ── Header: greeting + theme toggle + settings ── */}
      <header className="home-header">
        <div className="home-header__text">
          <h1 className="home-header__greeting">
            {timeGreeting()}{ownerFirst ? `, ${ownerFirst}` : ''}
          </h1>
          <p className="home-header__sub">Your virtual mechanic is ready</p>
        </div>
        <div className="home-header__btns">
          <button
            className="home-header__btn header-alerts-btn"
            onClick={openAlerts}
            aria-label={unreadAlertCount > 0 ? `Alerts — ${unreadAlertCount} unread` : 'Alerts'}
            type="button"
          >
            <span aria-hidden="true">🔔</span>
            {unreadAlertCount > 0 && (
              <span className="header-alert-badge">{unreadAlertCount > 9 ? '9+' : unreadAlertCount}</span>
            )}
          </button>
          <button
            className="home-header__btn"
            onClick={() => onThemeChange?.(theme === 'dark' ? 'light' : 'dark')}
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            type="button"
          >
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
          <button
            className="home-header__btn"
            onClick={() => setSettingsOpen(true)}
            aria-label="Settings"
            type="button"
          >
            ⚙
          </button>
        </div>
      </header>

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
            ) : wikiVehicleImage ? (
              /* Real model photo from Wikipedia with "Add Photo" tap */
              <>
                <img
                  src={wikiVehicleImage}
                  alt={`${vehicleInfo?.make} ${vehicleInfo?.model}`}
                  className="home-hero__photo vehicle-wiki-image"
                />
                <button
                  className="home-hero__photo-edit home-hero__photo-edit--add"
                  onClick={() => setShowPhotoOptions(true)}
                  aria-label="Add vehicle photo"
                  type="button"
                >
                  📷
                </button>
              </>
            ) : vehicleInfo?.make && vehicleInfo?.model ? (
              /* Body-type silhouette for their make/model with "Add Photo" tap */
              <>
                <div className="home-hero__car home-hero__car--silhouette">
                  <VehicleSilhouette
                    make={vehicleInfo.make}
                    model={vehicleInfo.model}
                    color={vehicleColor || null}
                  />
                </div>
                <button
                  className="home-hero__photo-edit home-hero__photo-edit--add"
                  onClick={() => setShowPhotoOptions(true)}
                  aria-label="Add vehicle photo"
                  type="button"
                >
                  📷
                </button>
              </>
            ) : (
              /* No vehicle set yet */
              <div
                className="home-hero__camera-tap"
                onClick={() => setShowPhotoOptions(true)}
                role="button"
                tabIndex={0}
                onKeyDown={e => e.key === 'Enter' && setShowPhotoOptions(true)}
                aria-label="Add vehicle photo"
              >
                <span className="home-hero__camera-tap__icon">📸</span>
                <span className="home-hero__camera-tap__text">Add your vehicle to see it here</span>
                <span className="home-hero__camera-tap__sub">Set it up in the Vehicle tab, or add a photo</span>
              </div>
            )}
          </>
        )}

        {/* Bottom gradient scrim (always rendered) */}
        <div className="home-hero__bottom-gradient" />

        {/* Bottom row: vehicle name + health gauge */}
        <div className="home-hero__bottom">
          <div className="home-hero__info">
            <h1 className="home-hero__name">{vehicleName}</h1>
            {hasVehicle && vehicleSub && (
              <p className="home-hero__sub">{vehicleSub}</p>
            )}
          </div>
          <div className="home-hero__gauge-wrap">
            <HealthGauge score={healthScore} size={104} />
          </div>
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

      {/* ── Health score bar ── */}
      <div className="home-health">
        <div className="home-health__header">
          <h2 className="home-section-title">VEHICLE HEALTH</h2>
          <span className="home-health__label" style={{ color: tier.color }}>{tier.label}</span>
        </div>
        <div className="home-health__bar" role="progressbar" aria-valuenow={healthScore} aria-valuemin="0" aria-valuemax="100">
          <div className="home-health__bar-fill" style={{ width: `${healthScore}%`, background: tier.color }} />
        </div>
        <div className="home-health__meta">
          <span className="home-health__score" style={{ color: tier.color }}>{healthScore}<span className="home-health__score-max">/100</span></span>
          <span className="home-health__hint">
            {obd2Connected ? 'Live from OBD2 scanner' : 'Estimated from service history'}
          </span>
        </div>
      </div>

      {/* ── Stat pills ── */}
      {statPills.length > 0 && (
        <div className="home-pills">
          {statPills.map((p, i) => (
            <div key={p.label} className="home-pill" style={{ '--i': i }}>
              <span className="home-pill__icon" aria-hidden="true">{p.icon}</span>
              <div className="home-pill__text">
                <span className="home-pill__label">{p.label}</span>
                <span className="home-pill__value">{p.value}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Quick actions (2×2 grid, Tesla-style gradients) ── */}
      <div className="home-actions">
        <button className="home-action home-action--diagnose" onClick={onStartDiagnosis}>
          <span className="home-action__icon" aria-hidden="true">🎙️</span>
          <span className="home-action__label">Start Diagnosis</span>
        </button>
        <button className="home-action home-action--connect" onClick={handleObd2Action}>
          <span className="home-action__icon" aria-hidden="true">🔌</span>
          <span className="home-action__label">{obd2Connected ? 'View Live Data' : 'Connect OBD2'}</span>
        </button>
        <button className="home-action home-action--mechanic" onClick={onFindMechanic}>
          <span className="home-action__icon" aria-hidden="true">🔧</span>
          <span className="home-action__label">Find Mechanic</span>
          <span className="home-action__badge" aria-hidden="true">✦</span>
        </button>
        <button className="home-action home-action--service" onClick={() => onNavigateTab?.('maintenance')}>
          <span className="home-action__icon" aria-hidden="true">📋</span>
          <span className="home-action__label">Service Log</span>
        </button>
      </div>

      {/* ── Why FixIt AI? — the 3-input advantage ── */}
      <div className="home-why">
        <h2 className="home-section-title home-why__title">WHY FIXIT AI?</h2>
        <div className="home-why__row">
          <div className="home-why__card" style={{ '--i': 0 }}>
            <span className="home-why__icon" aria-hidden="true">🎙️</span>
            <span className="home-why__name">Sound</span>
            <span className="home-why__desc">AI listens to your engine</span>
          </div>
          <div className="home-why__card" style={{ '--i': 1 }}>
            <span className="home-why__icon" aria-hidden="true">📷</span>
            <span className="home-why__name">Photos</span>
            <span className="home-why__desc">Sees damage &amp; warning lights</span>
          </div>
          <div className="home-why__card" style={{ '--i': 2 }}>
            <span className="home-why__icon" aria-hidden="true">🔌</span>
            <span className="home-why__name">OBD2</span>
            <span className="home-why__desc">Reads live engine data</span>
          </div>
        </div>
        <p className="home-why__sub">FixIt AI uses 3 inputs — no other app does this.</p>
      </div>

      {/* ── Specs strip (hidden when no specs for this vehicle) ── */}
      {specChips.length > 0 && (
        <div className="home-specs-strip" aria-label="Vehicle specifications">
          {specChips.map((c, i) => (
            <div key={c.label} className="home-spec-chip" style={{ '--i': i }}>
              <span className="home-spec-chip__value">{c.value}</span>
              <span className="home-spec-chip__label">{c.label}</span>
            </div>
          ))}
        </div>
      )}

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

      {/* ── Alerts bottom sheet ── */}
      {alertsOpen && (
        <AlertsSheet
          alerts={alerts}
          onDismiss={onDismissAlert}
          onClearAll={onClearAlerts}
          onClose={() => setAlertsOpen(false)}
        />
      )}

      {/* ── Settings bottom sheet ── */}
      {settingsOpen && (
        <SettingsSheet
          vehicleInfo={vehicleInfo}
          onVehicleInfoChange={onVehicleInfoChange}
          theme={theme}
          onThemeChange={onThemeChange}
          units={units}
          onUnitsChange={onUnitsChange}
          onClearAll={onClearAll}
          onGoToVehicle={() => onNavigateTab?.('vehicle')}
          onClose={() => setSettingsOpen(false)}
        />
      )}
    </div>
  );
}
