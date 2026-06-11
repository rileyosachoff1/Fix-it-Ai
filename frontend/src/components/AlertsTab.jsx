import { useState } from 'react';
import './AlertsTab.css';
import { getDtcInfo } from '../data/dtcCatalog.js';
import { truncateSentences } from '../utils/alerts.js';

const SEVERITY_ORDER = { critical: 0, warning: 1, info: 2 };

function getInfo(code) {
  return getDtcInfo(code);
}

function AlertCard({ fc, expanded, onToggle, onFindMechanic }) {
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
          {onFindMechanic && (
            <button
              className="alert-card__action-btn"
              onClick={e => { e.stopPropagation(); onFindMechanic(); }}
              type="button"
            >
              🔧 Find Mechanic for This
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Maintenance overdue card (orange) ────────────────────────────────────────
function MaintenanceAlertCard({ alert, onLogService }) {
  return (
    <div className="alert-generic alert-generic--maintenance">
      <div className="alert-generic__top">
        <span className="alert-generic__icon" aria-hidden="true">{alert.data?.icon || '🔧'}</span>
        <span className="alert-generic__title">{alert.title}</span>
      </div>
      <p className="alert-generic__body">{alert.body}</p>
      {alert.detail && <p className="alert-generic__detail">{alert.detail}</p>}
      {onLogService && (
        <button className="alert-generic__btn" onClick={onLogService} type="button">
          📋 Open Service Log
        </button>
      )}
    </div>
  );
}

// ── NHTSA recall card (yellow) ───────────────────────────────────────────────
function RecallAlertCard({ recall, vehicleInfo, onScheduleRepair }) {
  const summary = truncateSentences(recall.summary, 2);
  return (
    <div className="alert-generic alert-generic--recall">
      <div className="alert-generic__top">
        <span className="alert-generic__icon" aria-hidden="true">📢</span>
        <span className="alert-generic__title">Open Recall</span>
        {recall.nhtsaNumber && (
          <span className="alert-generic__ref">NHTSA #{recall.nhtsaNumber}</span>
        )}
      </div>
      {recall.component && (
        <p className="alert-generic__component">{recall.component}</p>
      )}
      {summary && <p className="alert-generic__body">{summary}</p>}
      <div className="alert-generic__actions">
        <a
          className="alert-generic__link"
          href={vehicleInfo?.vin
            ? `https://www.nhtsa.gov/recalls?vin=${encodeURIComponent(vehicleInfo.vin)}`
            : 'https://www.nhtsa.gov/recalls'}
          target="_blank"
          rel="noopener noreferrer"
        >
          Check if your VIN is affected →
        </a>
        {onScheduleRepair && (
          <button className="alert-generic__btn" onClick={onScheduleRepair} type="button">
            🔧 Schedule Repair
          </button>
        )}
      </div>
    </div>
  );
}

// ── Unresolved diagnosis card (blue) ─────────────────────────────────────────
function DiagnosisAlertCard({ alert }) {
  return (
    <div className="alert-generic alert-generic--diagnosis">
      <div className="alert-generic__top">
        <span className="alert-generic__icon" aria-hidden="true">🎙️</span>
        <span className="alert-generic__title">{alert.title}</span>
      </div>
      <p className="alert-generic__body">{alert.body}</p>
      {alert.detail && <p className="alert-generic__detail">{alert.detail}</p>}
    </div>
  );
}

export default function AlertsTab({
  faultCodes = [],
  recentDiagnoses = [],
  alerts = [],
  vehicleInfo = null,
  onFindMechanic,
}) {
  const [expanded, setExpanded] = useState(null);

  // Sort fault codes by severity (existing behaviour)
  const sorted = [...faultCodes].sort((a, b) => {
    const sa = SEVERITY_ORDER[getInfo(a.code).severity] ?? 1;
    const sb = SEVERITY_ORDER[getInfo(b.code).severity] ?? 1;
    return sa - sb;
  });

  const critical = sorted.filter(fc => getInfo(fc.code).severity === 'critical');
  const warning  = sorted.filter(fc => getInfo(fc.code).severity === 'warning');
  const info     = sorted.filter(fc => getInfo(fc.code).severity === 'info');

  const maintenanceAlerts = alerts.filter(a => a.type === 'maintenance');
  const recallAlerts      = alerts.filter(a => a.type === 'recall');
  const diagnosisAlerts   = alerts.filter(a => a.type === 'diagnosis');

  const totalAlerts = alerts.length;

  function toggle(code) {
    setExpanded(prev => prev === code ? null : code);
  }

  function findMechanicForCode(fc) {
    onFindMechanic?.(
      { primary: { diagnosis: `${fc.code} — ${fc.description || getInfo(fc.code).name}` } },
      { dtcContext: fc }
    );
  }

  return (
    <div className="alerts-tab">
      <div className="alerts-header">
        <h1 className="alerts-header__title">Alerts</h1>
        {totalAlerts > 0 && (
          <span className="alerts-header__count">{totalAlerts} active</span>
        )}
      </div>

      {totalAlerts === 0 ? (
        <div className="alerts-empty">
          <div className="alerts-empty__icon">✅</div>
          <h2 className="alerts-empty__title">All Clear!</h2>
          <p className="alerts-empty__body">No fault codes, overdue services, or open recalls. Your vehicle is in good shape.</p>
          {recentDiagnoses.length === 0 && (
            <p className="alerts-empty__hint">Tap the mic button to run an AI diagnosis anytime.</p>
          )}
        </div>
      ) : (
        <div className="alerts-list">
          {/* ── OBD2 fault codes (red) ── */}
          {critical.length > 0 && (
            <div className="alerts-group">
              <div className="alerts-group__header alerts-group__header--critical">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                Critical
              </div>
              {critical.map(fc => (
                <AlertCard key={fc.code} fc={fc} expanded={expanded === fc.code} onToggle={() => toggle(fc.code)} onFindMechanic={() => findMechanicForCode(fc)} />
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
                <AlertCard key={fc.code} fc={fc} expanded={expanded === fc.code} onToggle={() => toggle(fc.code)} onFindMechanic={() => findMechanicForCode(fc)} />
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
                <AlertCard key={fc.code} fc={fc} expanded={expanded === fc.code} onToggle={() => toggle(fc.code)} onFindMechanic={() => findMechanicForCode(fc)} />
              ))}
            </div>
          )}

          {/* ── Overdue maintenance (orange) ── */}
          {maintenanceAlerts.length > 0 && (
            <div className="alerts-group">
              <div className="alerts-group__header alerts-group__header--maintenance">
                🔧 Maintenance Overdue
              </div>
              {maintenanceAlerts.map(a => (
                <MaintenanceAlertCard key={a.id} alert={a} />
              ))}
            </div>
          )}

          {/* ── NHTSA recalls (yellow) ── */}
          {recallAlerts.length > 0 && (
            <div className="alerts-group">
              <div className="alerts-group__header alerts-group__header--recall">
                📢 Safety Recalls
              </div>
              {recallAlerts.map(a => (
                <RecallAlertCard
                  key={a.id}
                  recall={a.data}
                  vehicleInfo={vehicleInfo}
                  onScheduleRepair={onFindMechanic
                    ? () => onFindMechanic(
                        { primary: { diagnosis: `Recall: ${a.data?.component || 'Safety recall'}` } },
                        { serviceFilter: 'Full Inspection' }
                      )
                    : null}
                />
              ))}
            </div>
          )}

          {/* ── Unresolved diagnoses (blue) ── */}
          {diagnosisAlerts.length > 0 && (
            <div className="alerts-group">
              <div className="alerts-group__header alerts-group__header--diagnosis">
                🎙️ Unresolved Diagnoses
              </div>
              {diagnosisAlerts.map(a => (
                <DiagnosisAlertCard key={a.id} alert={a} />
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
