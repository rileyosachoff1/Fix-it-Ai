import { useState, useEffect, useRef } from 'react';
import CircularGauge from './CircularGauge.jsx';
import './LiveTab.css';

// ── Demo data generator ─────────────────────────────────────────────────────
function makeDemoData(t) {
  const warmup = Math.min(1, t / 30);
  return {
    rpm:          830 + Math.sin(t * 1.7) * 80 + Math.sin(t * 3.1) * 30 + (Math.random() - 0.5) * 40,
    vehicleSpeed: 0,
    coolantTemp:  20 + warmup * 70 + (Math.random() - 0.5) * 2,
    batteryVoltage: 14.1 + Math.sin(t * 0.6) * 0.15 + (Math.random() - 0.5) * 0.05,
    engineLoad:   17 + Math.sin(t * 0.8) * 5 + (Math.random() - 0.5) * 3,
    throttlePos:  8  + Math.sin(t * 1.1) * 3 + (Math.random() - 0.5) * 2,
    fuelTrimST:   0.5 + Math.sin(t * 0.4) * 1.5,
    fuelTrimLT:   1.2 + Math.sin(t * 0.2) * 0.8,
    intakeTemp:   22 + warmup * 8,
    mafRate:      4.5 + Math.sin(t * 0.9) * 1.2,
    o2Voltage:    0.45 + Math.sin(t * 2.1) * 0.38,
  };
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
}) {
  const [demo, setDemo]     = useState(null);
  const demoT = useRef(0);
  const isChrome = !!(navigator.bluetooth);

  // Demo animation when not connected
  useEffect(() => {
    if (obd2Connected) { setDemo(null); return; }
    demoT.current = 0;
    const id = setInterval(() => {
      demoT.current += 0.12;
      setDemo(makeDemoData(demoT.current));
    }, 120);
    return () => clearInterval(id);
  }, [obd2Connected]);

  const data = obd2Connected ? liveData : demo;

  function tempC(c) {
    if (c === null || c === undefined) return null;
    return units === 'imperial' ? c * 9/5 + 32 : c;
  }
  function tempUnit() { return units === 'imperial' ? '°F' : '°C'; }
  function speedVal(v) { return units === 'imperial' ? v * 0.621371 : v; }
  function speedMax() { return units === 'imperial' ? 140 : 220; }
  function speedUnit() { return units === 'imperial' ? 'MPH' : 'KM/H'; }

  const rpm   = data?.rpm ?? 0;
  const speed = speedVal(data?.vehicleSpeed ?? 0);
  const coolant = tempC(data?.coolantTemp);
  const battery = data?.batteryVoltage ?? 0;
  const load  = data?.engineLoad ?? 0;
  const throttle = data?.throttlePos ?? 0;

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
        </div>
        <div className="live-header__actions">
          {obd2Connected
            ? <button className="live-header__btn live-header__btn--disconnect" onClick={onObd2Disconnect}>Disconnect</button>
            : obd2Connecting
              ? <button className="live-header__btn" disabled>Connecting…</button>
              : <>
                  {isChrome && <button className="live-header__btn" onClick={onObd2Connect}>Connect OBD2</button>}
                  <button className="live-header__btn live-header__btn--demo" onClick={onObd2ConnectMock}>Load Demo</button>
                </>
          }
        </div>
      </div>

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

      {/* ── Data table ── */}
      <div className="live-table-section">
        <h2 className="live-section-title">All Sensors</h2>
        <div className="live-table">
          {[
            { label: 'Short Fuel Trim', value: data?.fuelTrimST, fmt: v => (v > 0 ? `+${v.toFixed(1)}` : v.toFixed(1)), unit: '%', warn: Math.abs(data?.fuelTrimST ?? 0) > 10, danger: Math.abs(data?.fuelTrimST ?? 0) > 20 },
            { label: 'Long Fuel Trim',  value: data?.fuelTrimLT, fmt: v => (v > 0 ? `+${v.toFixed(1)}` : v.toFixed(1)), unit: '%', warn: Math.abs(data?.fuelTrimLT ?? 0) > 10, danger: Math.abs(data?.fuelTrimLT ?? 0) > 20 },
            { label: 'Intake Air Temp', value: data?.intakeTemp !== undefined ? tempC(data.intakeTemp) : undefined, fmt: v => Math.round(v), unit: tempUnit() },
            { label: 'MAF Rate',        value: data?.mafRate,        fmt: v => v.toFixed(2), unit: 'g/s' },
            { label: 'O₂ Sensor B1S1', value: data?.o2Voltage,     fmt: v => v.toFixed(3), unit: 'V' },
          ].map(row => (
            <div key={row.label} className={`live-row${row.danger ? ' live-row--danger' : row.warn ? ' live-row--warn' : ''}`}>
              <span className="live-row__label">{row.label}</span>
              <span className="live-row__value">
                {row.value !== null && row.value !== undefined
                  ? <>{row.fmt(row.value)} <span className="live-row__unit">{row.unit}</span></>
                  : <span className="live-row__nil">—</span>
                }
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Fault codes ── */}
      {faultCodes.length > 0 && (
        <div className="live-faults-section">
          <h2 className="live-section-title">Fault Codes ({faultCodes.length})</h2>
          <div className="live-faults">
            {faultCodes.map(fc => (
              <div key={fc.code} className="live-fault">
                <span className="live-fault__code">{fc.code}</span>
                <span className="live-fault__desc">{fc.description || 'Unknown fault code'}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ height: '24px' }} />
    </div>
  );
}
