import { useState, useEffect } from 'react';
import CircularGauge from './CircularGauge.jsx';
import './LiveTab.css';
import { rateReading, readingMeaning } from '../utils/sensorRanges.js';
import { getDtcInfo } from '../data/dtcCatalog.js';
import { healthTier } from '../utils/healthScore.js';

// Status glyphs for sensor readings
const STATUS_GLYPH = {
  ok:   { icon: '✓', cls: 'live-status--ok',   label: 'Normal' },
  warn: { icon: '⚠', cls: 'live-status--warn', label: 'Watch' },
  bad:  { icon: '✗', cls: 'live-status--bad',  label: 'Problem' },
};

// ── RPM sparkline (last 30 readings, pure SVG) ──────────────────────────────
function RpmSparkline({ history }) {
  const W = 320, H = 64;
  if (history.length < 2) {
    return <div className="live-spark__placeholder">Collecting engine data…</div>;
  }
  const max = Math.max(...history, 1000);
  const pts = history.map((v, i) => {
    const x = (i / (history.length - 1)) * W;
    const y = H - (Math.max(0, v) / max) * (H - 8) - 4;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="live-spark__svg" preserveAspectRatio="none" aria-hidden="true">
      <line x1="0" y1={H - 1} x2={W} y2={H - 1} stroke="var(--divider)" strokeWidth="1" />
      <polyline
        points={pts.join(' ')}
        fill="none"
        stroke="var(--success)"
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

function batteryColor(v) {
  if (!v) return 'var(--accent)';
  if (v < 11.8 || v > 15.5) return 'var(--danger)';
  if (v < 12.4 || v > 14.8) return 'var(--warning)';
  return 'var(--success)';
}

function coolantColor(c) {
  if (c === null || c === undefined) return 'var(--accent)';
  if (c > 108) return 'var(--danger)';
  if (c > 100 || c < 60) return 'var(--warning)';
  return 'var(--success)';
}

export default function LiveTab({
  liveData, faultCodes = [],
  obd2Connected, obd2DeviceName, obd2Connecting,
  onObd2Connect, onObd2ConnectMock, onObd2Disconnect,
  units = 'metric',
  healthScore = 85,
  onFindMechanicForCode,
}) {
  const [expandedSensor, setExpandedSensor] = useState(null);
  const isChrome = !!(navigator.bluetooth);

  // RPM history for the live line graph (last 30 readings)
  const [rpmHistory, setRpmHistory] = useState([]);
  useEffect(() => {
    if (!obd2Connected) { setRpmHistory([]); return; }
    if (liveData?.rpm == null) return;
    setRpmHistory(prev => [...prev.slice(-29), liveData.rpm]);
  }, [liveData, obd2Connected]);

  // Scanner waitlist modal
  const [showWaitlist,   setShowWaitlist]   = useState(false);
  const [waitlistEmail,  setWaitlistEmail]  = useState('');
  const [waitlistState,  setWaitlistState]  = useState('idle'); // idle | submitting | done | error

  async function handleWaitlistSubmit() {
    if (!waitlistEmail.includes('@')) { setWaitlistState('error'); return; }
    setWaitlistState('submitting');
    try {
      const res = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: waitlistEmail.trim() }),
      });
      if (!res.ok) throw new Error('failed');
      setWaitlistState('done');
    } catch {
      setWaitlistState('error');
    }
  }

  const data = obd2Connected ? liveData : null;

  function tempC(c) {
    if (c === null || c === undefined) return null;
    return units === 'imperial' ? c * 9/5 + 32 : c;
  }
  function tempUnit() { return units === 'imperial' ? '°F' : '°C'; }
  function speedVal(v) { return units === 'imperial' ? v * 0.621371 : v; }
  function speedMax() { return units === 'imperial' ? 140 : 220; }
  function speedUnit() { return units === 'imperial' ? 'MPH' : 'KM/H'; }

  // Real OBD2 data uses speed/throttle/maf; the demo generator uses
  // vehicleSpeed/throttlePos/mafRate — read both so each source works.
  const rawSpeed    = data?.vehicleSpeed ?? data?.speed ?? 0;
  const rawThrottle = data?.throttlePos ?? data?.throttle ?? 0;
  const rawMaf      = data?.mafRate ?? data?.maf;

  const rpm   = data?.rpm ?? 0;
  const speed = speedVal(rawSpeed);
  const coolant = tempC(data?.coolantTemp);
  const battery = data?.batteryVoltage ?? 0;
  const load  = data?.engineLoad ?? 0;
  const throttle = rawThrottle;

  const tier = healthTier(healthScore);
  const rateCtx = { speed: rawSpeed, running: (data?.rpm ?? 0) > 300 };

  // All-sensors rows with normal-range status + plain-English meaning on tap
  const sensorRows = [
    { key: 'rpm',            label: 'Engine RPM',       value: data?.rpm,        fmt: v => Math.round(v).toLocaleString(), unit: '' },
    { key: 'coolantTemp',    label: 'Coolant Temp',     value: data?.coolantTemp, display: v => Math.round(tempC(v)), unit: tempUnit() },
    { key: 'batteryVoltage', label: 'Battery Voltage',  value: data?.batteryVoltage, fmt: v => v.toFixed(1), unit: 'V' },
    { key: 'engineLoad',     label: 'Engine Load',      value: data?.engineLoad, fmt: v => Math.round(v), unit: '%' },
    { key: 'throttle',       label: 'Throttle Position', value: rawThrottle || (data ? rawThrottle : undefined), fmt: v => Math.round(v), unit: '%' },
    { key: 'fuelTrimST',     label: 'Short Fuel Trim',  value: data?.fuelTrimST, fmt: v => (v > 0 ? `+${v.toFixed(1)}` : v.toFixed(1)), unit: '%' },
    { key: 'fuelTrimLT',     label: 'Long Fuel Trim',   value: data?.fuelTrimLT, fmt: v => (v > 0 ? `+${v.toFixed(1)}` : v.toFixed(1)), unit: '%' },
    { key: 'intakeTemp',     label: 'Intake Air Temp',  value: data?.intakeTemp, display: v => Math.round(tempC(v)), unit: tempUnit() },
    { key: 'maf',            label: 'MAF Rate',         value: rawMaf,           fmt: v => v.toFixed(2), unit: 'g/s' },
    { key: 'o2Voltage',      label: 'O₂ Sensor B1S1',  value: data?.o2Voltage,  fmt: v => v.toFixed(3), unit: 'V' },
  ];

  return (
    <div className="live-tab">
      {/* ── Header ── */}
      <div className="live-header">
        <div className="live-header__left">
          <h1 className="live-header__title">Live Data</h1>
          {obd2Connected
            ? <span className="live-header__badge live-header__badge--on">● {obd2DeviceName || 'Connected'}</span>
            : <span className="live-header__badge live-header__badge--demo">DEMO MODE</span>
          }
          {obd2Connected && (
            <span className="live-health-chip" style={{ borderColor: tier.color }}>
              <span className="live-health-chip__score" style={{ color: tier.color }}>{healthScore}</span>
              <span className="live-health-chip__label">{tier.label}</span>
            </span>
          )}
        </div>
        <div className="live-header__actions">
          {obd2Connected && (
            <button className="live-header__btn live-header__btn--disconnect" onClick={onObd2Disconnect}>Disconnect</button>
          )}
        </div>
      </div>

      {/* ── Disconnected: connect-your-scanner CTA ── */}
      {!obd2Connected && (
        <div className="live-disconnected">
          <div className="live-disconnected-visual" aria-hidden="true">
            <div className="scanner-ring scanner-ring-1" />
            <div className="scanner-ring scanner-ring-2" />
            <div className="scanner-ring scanner-ring-3" />
            <span className="scanner-icon">🔌</span>
          </div>

          <h2 className="live-disconnected-title">Connect Your OBD2 Scanner</h2>
          <p className="live-disconnected-body">
            See live engine data, detect issues in real time, and get more accurate AI diagnoses.
          </p>

          {obd2Connecting ? (
            <button className="live-connect-btn" disabled>Connecting…</button>
          ) : isChrome ? (
            <button className="live-connect-btn" onClick={onObd2Connect}>Connect OBD2 Scanner</button>
          ) : (
            <button className="live-connect-btn" onClick={onObd2ConnectMock}>Try Demo Mode</button>
          )}
          {isChrome && !obd2Connecting && (
            <button className="live-demo-link" onClick={onObd2ConnectMock} type="button">
              No scanner handy? Try demo mode →
            </button>
          )}

          <div className="live-waitlist-card">
            <div className="live-waitlist-left">
              <span className="live-waitlist-label">COMING SOON</span>
              <p className="live-waitlist-text">FixIt AI OBD2 Scanner — plug in, pair once, works forever.</p>
            </div>
            <button className="live-waitlist-btn" onClick={() => setShowWaitlist(true)} type="button">
              Join Waitlist
            </button>
          </div>
        </div>
      )}

      {obd2Connected && (<>
      {/* ── Main gauges ── */}
      <div className="live-gauges-main">
        <div className="live-gauge-main">
          <CircularGauge
            value={rpm}
            min={0} max={8000}
            unit="RPM"
            label="Engine Speed"
            size={220}
            warnPct={0.5}
            dangerPct={0.75}
            formatValue={v => Math.round(v).toLocaleString()}
            majorEvery={1000}
            labelEvery={2000}
            dimmed={!data}
          />
        </div>
        <div className="live-gauge-main">
          <CircularGauge
            value={speed}
            min={0} max={speedMax()}
            unit={speedUnit()}
            label="Vehicle Speed"
            size={220}
            warnPct={0.55}
            dangerPct={0.82}
            majorEvery={units === 'imperial' ? 20 : 20}
            labelEvery={units === 'imperial' ? 40 : 40}
            dimmed={!data}
          />
        </div>
      </div>

      {/* ── Mini gauges ── */}
      <div className="live-gauges-mini">
        <div className="live-gauge-mini">
          <CircularGauge
            value={coolant ?? 0}
            min={0} max={140}
            unit={tempUnit()}
            label="Coolant"
            size={140}
            warnPct={0.72}
            dangerPct={0.82}
            customColor={coolant !== null ? coolantColor(units === 'imperial' ? coolant : coolant) : undefined}
            majorEvery={20}
            labelEvery={40}
            dimmed={!data || coolant === null}
          />
        </div>
        <div className="live-gauge-mini">
          <CircularGauge
            value={battery}
            min={11} max={16}
            unit="VOLTS"
            label="Battery"
            size={140}
            warnPct={0.5}
            dangerPct={0.9}
            customColor={battery > 0 ? batteryColor(battery) : undefined}
            formatValue={v => v.toFixed(1)}
            majorEvery={1}
            labelEvery={2}
            dimmed={!data}
          />
        </div>
        <div className="live-gauge-mini">
          <CircularGauge
            value={load}
            min={0} max={100}
            unit="%"
            label="Eng. Load"
            size={140}
            warnPct={0.7}
            dangerPct={0.9}
            majorEvery={20}
            labelEvery={40}
            dimmed={!data}
          />
        </div>
        <div className="live-gauge-mini">
          <CircularGauge
            value={throttle}
            min={0} max={100}
            unit="%"
            label="Throttle"
            size={140}
            warnPct={0.8}
            dangerPct={0.95}
            majorEvery={20}
            labelEvery={40}
            dimmed={!data}
          />
        </div>
      </div>

      {/* ── RPM trend graph (last 30 readings) ── */}
      <div className="live-spark">
        <div className="live-spark__header">
          <h2 className="live-section-title">RPM Trend</h2>
          <span className="live-spark__current">{data?.rpm != null ? `${Math.round(data.rpm).toLocaleString()} RPM` : '—'}</span>
        </div>
        <RpmSparkline history={rpmHistory} />
      </div>

      {/* ── Sensor card grid with normal-range statuses ── */}
      <div className="live-table-section">
        <h2 className="live-section-title">All Sensors</h2>
        <div className="live-sensor-grid">
          {sensorRows.map((row, i) => {
            const hasValue = row.value !== null && row.value !== undefined;
            const status   = hasValue ? rateReading(row.key, row.value, rateCtx) : null;
            const glyph    = status ? STATUS_GLYPH[status] : null;
            const isOpen   = expandedSensor === row.key;
            const shown    = hasValue
              ? (row.display ? row.display(row.value) : row.fmt(row.value))
              : null;
            return (
              <button
                key={row.key}
                className={`live-sensor-card${status ? ` live-sensor-card--${status}` : ''}${isOpen ? ' live-sensor-card--open' : ''}`}
                style={{ '--i': i }}
                onClick={() => setExpandedSensor(prev => prev === row.key ? null : row.key)}
                type="button"
              >
                <span className="live-sensor-card__label">{row.label}</span>
                <span className="live-sensor-card__value">
                  {hasValue ? shown : '—'}
                  {hasValue && row.unit && <span className="live-sensor-card__unit">{row.unit}</span>}
                </span>
                {glyph && (
                  <span className={`live-sensor-card__status ${glyph.cls}`}>
                    <span className="live-sensor-card__dot" aria-hidden="true" />
                    {glyph.label}
                  </span>
                )}
                {isOpen && (
                  <p className="live-sensor-card__meaning">{readingMeaning(row.key, status)}</p>
                )}
              </button>
            );
          })}
        </div>
        <p className="live-table-hint">Tap any reading for a plain-English explanation</p>
      </div>

      {/* ── Fault codes ── */}
      {faultCodes.length > 0 && (
        <div className="live-faults-section">
          <h2 className="live-section-title">Fault Codes ({faultCodes.length})</h2>
          <div className="live-faults">
            {faultCodes.map((fc, i) => {
              const info = getDtcInfo(fc.code);
              return (
                <div key={fc.code} className={`live-fault-card live-fault-card--${info.severity}`} style={{ '--i': i }}>
                  <div className="live-fault-card__top">
                    <span className="live-fault-card__code">{fc.code}</span>
                    <span className={`live-fault-card__sev live-fault-card__sev--${info.severity}`}>
                      {info.severity === 'critical' ? 'Critical' : info.severity === 'warning' ? 'Warning' : 'Info'}
                    </span>
                    {(fc.type === 'pending' || fc.pending) && (
                      <span className="live-fault-card__pending">Pending</span>
                    )}
                  </div>
                  <p className="live-fault-card__name">{fc.description || info.name}</p>
                  <p className="live-fault-card__cause">{info.cause}</p>
                  {onFindMechanicForCode && (
                    <button
                      className="live-fault-card__btn"
                      onClick={() => onFindMechanicForCode(fc)}
                      type="button"
                    >
                      🔧 Find Mechanic for This
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
      </>)}

      {/* ── Scanner waitlist modal ── */}
      {showWaitlist && (
        <div className="live-modal-overlay" onClick={() => setShowWaitlist(false)}>
          <div className="live-modal-sheet" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Join the waitlist">
            <div className="live-modal-sheet__handle" />
            <h3 className="live-modal-sheet__title">Join the Waitlist</h3>
            <p className="live-modal-sheet__sub">
              Our scanner is coming soon — be first to know when the FixIt AI OBD2 Scanner ships.
            </p>
            {waitlistState === 'done' ? (
              <div className="live-modal-sheet__done">
                ✓ You're on the list! We'll notify you when the scanner ships.
              </div>
            ) : (
              <>
                <input
                  className="live-modal-sheet__input"
                  type="email"
                  placeholder="your@email.com"
                  value={waitlistEmail}
                  onChange={e => { setWaitlistEmail(e.target.value); if (waitlistState === 'error') setWaitlistState('idle'); }}
                  aria-label="Email address"
                />
                {waitlistState === 'error' && (
                  <p className="live-modal-sheet__error">Please enter a valid email address.</p>
                )}
                <button
                  className="live-modal-sheet__submit"
                  onClick={handleWaitlistSubmit}
                  disabled={waitlistState === 'submitting'}
                  type="button"
                >
                  {waitlistState === 'submitting' ? 'Joining…' : 'Notify Me'}
                </button>
              </>
            )}
            <button className="live-modal-sheet__close" onClick={() => setShowWaitlist(false)} type="button">Close</button>
          </div>
        </div>
      )}

      <div style={{ height: '24px' }} />
    </div>
  );
}
