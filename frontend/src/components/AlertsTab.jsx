import { useState } from 'react';
import './AlertsTab.css';

const DTC_INFO = {
  P0420: { name: 'Catalyst System Efficiency Below Threshold', severity: 'warning', cause: 'Worn catalytic converter, exhaust leak, failing O2 sensor' },
  P0171: { name: 'System Too Lean (Bank 1)', severity: 'warning', cause: 'Vacuum leak, dirty MAF sensor, low fuel pressure, failing O2 sensor' },
  P0172: { name: 'System Too Rich (Bank 1)', severity: 'warning', cause: 'Leaking fuel injector, faulty MAF or coolant temp sensor' },
  P0128: { name: 'Coolant Thermostat Temp Below Regulating', severity: 'info', cause: 'Faulty thermostat (stuck open), coolant temp sensor issue' },
  P0300: { name: 'Random/Multiple Cylinder Misfire Detected', severity: 'critical', cause: 'Worn spark plugs, ignition coil, injector issue, low compression' },
  P0301: { name: 'Cylinder 1 Misfire Detected', severity: 'critical', cause: 'Worn spark plug, ignition coil, injector, or compression issue' },
  P0302: { name: 'Cylinder 2 Misfire Detected', severity: 'critical', cause: 'Worn spark plug, ignition coil, injector, or compression issue' },
  P0303: { name: 'Cylinder 3 Misfire Detected', severity: 'critical', cause: 'Worn spark plug, ignition coil, injector, or compression issue' },
  P0304: { name: 'Cylinder 4 Misfire Detected', severity: 'critical', cause: 'Worn spark plug, ignition coil, injector, or compression issue' },
  P0455: { name: 'Evap System Large Leak', severity: 'info', cause: 'Loose/missing fuel cap, cracked EVAP hose, faulty purge valve' },
  P0442: { name: 'Evap System Small Leak', severity: 'info', cause: 'Small crack in EVAP line, loose fuel cap seal' },
  P0505: { name: 'Idle Air Control System', severity: 'warning', cause: 'Dirty or faulty IAC valve, vacuum leak' },
  P0340: { name: 'Camshaft Position Sensor Circuit', severity: 'critical', cause: 'Faulty cam sensor, wiring issue, reluctor wheel damage' },
  P0335: { name: 'Crankshaft Position Sensor Circuit', severity: 'critical', cause: 'Faulty crank sensor, wiring issue, damaged tone ring' },
};

const SEVERITY_ORDER = { critical: 0, warning: 1, info: 2 };

function getInfo(code) {
  return DTC_INFO[code] || { name: 'Fault code detected', severity: 'warning', cause: 'Connect OBD2 scanner for detailed diagnosis' };
}

function AlertCard({ fc, expanded, onToggle }) {
  const info = getInfo(fc.code);
  const sev  = info.severity;
  return (
    <div className={`alert-card alert-card--${sev}${expanded ? ' alert-card--open' : ''}`} onClick={onToggle}>
      <div className="alert-card__row">
        <div className="alert-card__left">
          <span className={`alert-card__sev-dot alert-card__sev-dot--${sev}`} />
          <div className="alert-card__text">
            <span className="alert-card__code">{fc.code}</span>
            <span className="alert-card__name">{fc.description || info.name}</span>
          </div>
        </div>
        <div className="alert-card__right">
          <span className={`alert-card__sev-badge alert-card__sev-badge--${sev}`}>
            {sev.charAt(0).toUpperCase() + sev.slice(1)}
          </span>
          <svg className={`alert-card__chevron${expanded ? ' alert-card__chevron--up' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </div>
      </div>
      {expanded && (
        <div className="alert-card__detail">
          <div className="alert-card__detail-row">
            <span className="alert-card__detail-label">Description</span>
            <span className="alert-card__detail-val">{info.name}</span>
          </div>
          <div className="alert-card__detail-row">
            <span className="alert-card__detail-label">Likely causes</span>
            <span className="alert-card__detail-val">{info.cause}</span>
          </div>
          {fc.pending && (
            <div className="alert-card__detail-row">
              <span className="alert-card__detail-label">Status</span>
              <span className="alert-card__detail-val alert-card__detail-val--warn">⚠ Pending — not yet stored</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function AlertsTab({ faultCodes = [], recentDiagnoses = [] }) {
  const [expanded, setExpanded] = useState(null);

  // Sort by severity
  const sorted = [...faultCodes].sort((a, b) => {
    const sa = SEVERITY_ORDER[getInfo(a.code).severity] ?? 1;
    const sb = SEVERITY_ORDER[getInfo(b.code).severity] ?? 1;
    return sa - sb;
  });

  const critical = sorted.filter(fc => getInfo(fc.code).severity === 'critical');
  const warning  = sorted.filter(fc => getInfo(fc.code).severity === 'warning');
  const info     = sorted.filter(fc => getInfo(fc.code).severity === 'info');

  function toggle(code) {
    setExpanded(prev => prev === code ? null : code);
  }

  return (
    <div className="alerts-tab">
      <div className="alerts-header">
        <h1 className="alerts-header__title">Alerts</h1>
        {faultCodes.length > 0 && (
          <span className="alerts-header__count">{faultCodes.length} active</span>
        )}
      </div>

      {faultCodes.length === 0 ? (
        <div className="alerts-empty">
          <div className="alerts-empty__icon">✅</div>
          <h2 className="alerts-empty__title">All Clear!</h2>
          <p className="alerts-empty__body">No active fault codes detected. Your vehicle is running clean.</p>
          {recentDiagnoses.length === 0 && (
            <p className="alerts-empty__hint">Tap the mic button to run an AI diagnosis anytime.</p>
          )}
        </div>
      ) : (
        <div className="alerts-list">
          {critical.length > 0 && (
            <div className="alerts-group">
              <div className="alerts-group__header alerts-group__header--critical">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                Critical
              </div>
              {critical.map(fc => (
                <AlertCard key={fc.code} fc={fc} expanded={expanded === fc.code} onToggle={() => toggle(fc.code)} />
              ))}
            </div>
          )}

          {warning.length > 0 && (
            <div className="alerts-group">
              <div className="alerts-group__header alerts-group__header--warning">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
                Warning
              </div>
              {warning.map(fc => (
                <AlertCard key={fc.code} fc={fc} expanded={expanded === fc.code} onToggle={() => toggle(fc.code)} />
              ))}
            </div>
          )}

          {info.length > 0 && (
            <div className="alerts-group">
              <div className="alerts-group__header alerts-group__header--info">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>
                </svg>
                Information
              </div>
              {info.map(fc => (
                <AlertCard key={fc.code} fc={fc} expanded={expanded === fc.code} onToggle={() => toggle(fc.code)} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── AI diagnosis alerts from history ── */}
      {recentDiagnoses.length > 0 && (
        <div className="alerts-diagnoses">
          <h2 className="alerts-diagnoses__title">Recent AI Diagnoses</h2>
          {recentDiagnoses.slice(0, 5).map(d => (
            <div key={d.id} className="alert-diag-card">
              <div className="alert-diag-card__meta">
                <span className="alert-diag-card__date">
                  {new Date(d.recordedAt).toLocaleDateString(undefined, { month:'short', day:'numeric', year:'numeric' })}
                </span>
                {d.vehicleInfo && (
                  <span className="alert-diag-card__vehicle">
                    {[d.vehicleInfo.year, d.vehicleInfo.make, d.vehicleInfo.model].filter(Boolean).join(' ')}
                  </span>
                )}
              </div>
              <p className="alert-diag-card__primary">
                {d.primary?.diagnosis || 'AI diagnosis completed'}
              </p>
              {d.primary?.severity && (
                <span className={`alert-diag-card__sev alert-diag-card__sev--${(d.primary.severity || '').toLowerCase()}`}>
                  {d.primary.severity}
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      <div style={{ height: '80px' }} />
    </div>
  );
}
