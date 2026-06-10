import { useState } from 'react';
import './MaintenanceTab.css';
import { getScheduleForVehicle } from '../data/serviceSchedules.js';
import ServiceRecordCapture from './ServiceRecordCapture.jsx';

// ── Unit helpers ──────────────────────────────────────────────────────────────
function kmToDisplay(km, unit) {
  if (km == null || isNaN(km)) return 0;
  return unit === 'mi' ? Math.round(km * 0.621371) : Math.round(km);
}
function odoToKm(odo, unit) {
  if (!odo || isNaN(odo)) return 0;
  return unit === 'mi' ? Math.round(odo * 1.60934) : Math.round(odo);
}
function formatInterval(km, unit) {
  const val = kmToDisplay(km, unit);
  return `${val >= 1000 ? (val / 1000).toFixed(val % 1000 === 0 ? 0 : 1) + 'k' : val} ${unit}`;
}

// ── Progress calculation ───────────────────────────────────────────────────────
function calcProgress(data, intervalKm, currentOdoKm, odometerUnit) {
  const unitLabel = odometerUnit === 'mi' ? 'mi' : 'km';
  const ivl = intervalKm || 8000;

  if (!data?.lastDate && !data?.lastKm) {
    return { pct: 0, status: 'unknown', dueText: 'Tap to log service' };
  }

  if (data.lastKm && currentOdoKm) {
    const drivenKm = Math.max(0, currentOdoKm - data.lastKm);
    const pct      = drivenKm / ivl;
    const leftKm   = ivl - drivenKm;
    const leftDisp = kmToDisplay(Math.max(0, leftKm), odometerUnit);
    if (pct >= 1.1) return { pct: 1, status: 'overdue', dueText: 'Overdue' };
    if (pct >= 0.85) return { pct, status: 'due', dueText: `${leftDisp.toLocaleString()} ${unitLabel} left` };
    return { pct, status: 'good', dueText: `${leftDisp.toLocaleString()} ${unitLabel} left` };
  }

  if (data.lastDate) {
    const daysSince   = (Date.now() - new Date(data.lastDate).getTime()) / 86_400_000;
    const intervalDays = (ivl / 500) * 7;
    const pct         = daysSince / intervalDays;
    const daysLeft    = Math.round(intervalDays - daysSince);
    if (pct >= 1.1) return { pct: 1, status: 'overdue', dueText: 'Overdue' };
    if (pct >= 0.85) return { pct, status: 'due', dueText: daysLeft > 0 ? `~${daysLeft}d left` : 'Due soon' };
    return { pct, status: 'good', dueText: `~${Math.max(0, daysLeft)}d left` };
  }

  return { pct: 0, status: 'unknown', dueText: 'Tap to log service' };
}

// ── Maintenance ring ──────────────────────────────────────────────────────────
function MaintenanceRing({ label, icon, intervalKm, pct, status, dueText, intervalText, onClick }) {
  const R    = 32;
  const circ = 2 * Math.PI * R;
  const fill = Math.max(0, 1 - pct);
  const dashOffset = circ * (1 - fill);
  const color = status === 'overdue' ? 'var(--danger)'
              : status === 'due'     ? 'var(--warning)'
              : status === 'good'    ? 'var(--success)'
              : 'var(--text-muted)';

  return (
    <button className={`maint-ring maint-ring--${status}`} onClick={onClick} type="button">
      <div className="maint-ring__svg-wrap">
        <svg viewBox="0 0 84 84" width="84" height="84">
          <circle cx="42" cy="42" r={R} fill="none" stroke="var(--divider)" strokeWidth="7"/>
          <circle
            cx="42" cy="42" r={R}
            fill="none" stroke={color} strokeWidth="7"
            strokeDasharray={circ} strokeDashoffset={dashOffset}
            strokeLinecap="round"
            transform="rotate(-90 42 42)"
            style={{ transition: 'stroke-dashoffset 1s ease-out, stroke 0.3s' }}
          />
        </svg>
        <span className="maint-ring__icon">{icon}</span>
      </div>
      <span className="maint-ring__label">{label}</span>
      <span className={`maint-ring__due maint-ring__due--${status}`}>{dueText}</span>
      {intervalText && <span className="maint-ring__interval">{intervalText}</span>}
    </button>
  );
}

// ── Edit service sheet ────────────────────────────────────────────────────────
function ServiceEditSheet({ item, data, vehicleIntervalKm, currentOdo, odometerUnit, onSave, onClose }) {
  const unitLabel = odometerUnit === 'mi' ? 'mi' : 'km';
  const lastDisplay     = data?.lastKm ? String(kmToDisplay(data.lastKm, odometerUnit)) : '';
  const intervalDisplay = data?.intervalKm
    ? String(kmToDisplay(data.intervalKm, odometerUnit))
    : String(kmToDisplay(vehicleIntervalKm, odometerUnit));

  const [date,    setDate]    = useState(data?.lastDate || '');
  const [odoStr,  setOdoStr]  = useState(lastDisplay);
  const [intStr,  setIntStr]  = useState(intervalDisplay);

  function save() {
    const lastKm     = odoStr ? odoToKm(parseInt(odoStr, 10),  odometerUnit) : null;
    const intervalKm = intStr ? odoToKm(parseInt(intStr, 10), odometerUnit)  : (data?.intervalKm || vehicleIntervalKm);
    onSave({ lastDate: date || null, lastKm, intervalKm });
    onClose();
  }

  return (
    <div className="maint-sheet-overlay" onClick={onClose}>
      <div className="maint-sheet" onClick={e => e.stopPropagation()}>
        <div className="maint-sheet__handle" />
        <div className="maint-sheet__header">
          <h2 className="maint-sheet__title">{item?.icon} Log {item?.label}</h2>
          <button className="maint-sheet__close" onClick={onClose}>✕</button>
        </div>
        <div className="maint-sheet__body">
          <label className="maint-sheet__field">
            <span>Last service date</span>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="maint-sheet__input"
              max={new Date().toISOString().split('T')[0]}
            />
          </label>
          <label className="maint-sheet__field">
            <span>Odometer at service ({unitLabel})</span>
            <input
              type="number"
              value={odoStr}
              onChange={e => setOdoStr(e.target.value)}
              className="maint-sheet__input"
              placeholder={`e.g. ${currentOdo || (odometerUnit === 'mi' ? '45,000' : '72,000')}`}
              min="0"
            />
          </label>
          <label className="maint-sheet__field">
            <span>Service interval ({unitLabel})</span>
            <input
              type="number"
              value={intStr}
              onChange={e => setIntStr(e.target.value)}
              className="maint-sheet__input"
              placeholder={`e.g. ${kmToDisplay(vehicleIntervalKm, odometerUnit)}`}
              min="100"
            />
          </label>
        </div>
        <div className="maint-sheet__footer">
          <button className="maint-sheet__cancel" onClick={onClose}>Cancel</button>
          <button className="maint-sheet__save"   onClick={save}>Save</button>
        </div>
      </div>
    </div>
  );
}

// ── Service record card ───────────────────────────────────────────────────────
function ServiceRecordCard({ record, odometerUnit, onDelete }) {
  const [expanded, setExpanded] = useState(false);
  const date = record.date
    ? new Date(record.date + 'T12:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
    : 'Unknown date';

  return (
    <div className={`svc-record-card${expanded ? ' svc-record-card--expanded' : ''}`}
         onClick={() => setExpanded(e => !e)}>
      <div className="svc-record-card__row">
        <div className="svc-record-card__left">
          <span className="svc-record-card__date">{date}</span>
          {record.shopName && (
            <span className="svc-record-card__shop">{record.shopName}</span>
          )}
        </div>
        <div className="svc-record-card__right">
          {record.totalCost != null && (
            <span className="svc-record-card__cost">${record.totalCost.toFixed(2)}</span>
          )}
          {record.mileageDisplay && (
            <span className="svc-record-card__odo">{record.mileageDisplay}</span>
          )}
          <svg className={`svc-record-card__chevron${expanded ? ' svc-record-card__chevron--up' : ''}`}
               viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M6 9l6 6 6-6"/>
          </svg>
        </div>
      </div>

      {/* Service tags */}
      {record.services?.length > 0 && (
        <div className="svc-record-card__tags">
          {record.services.map((s, i) => (
            <span key={i} className="svc-record-card__tag">{s.type}</span>
          ))}
        </div>
      )}

      {/* Expanded detail */}
      {expanded && (
        <div className="svc-record-card__detail">
          {record.services?.map((s, i) => (
            <div key={i} className="svc-record-card__svc-row">
              <span className="svc-record-card__svc-type">{s.type}</span>
              {s.details && <span className="svc-record-card__svc-detail">{s.details}</span>}
              {s.cost != null && <span className="svc-record-card__svc-cost">${Number(s.cost).toFixed(2)}</span>}
            </div>
          ))}
          {record.notes && (
            <p className="svc-record-card__notes">{record.notes}</p>
          )}
          <button
            className="svc-record-card__delete"
            onClick={e => { e.stopPropagation(); onDelete(record.id); }}
            type="button"
          >
            🗑 Delete record
          </button>
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function MaintenanceTab({
  schedule, onUpdate, onReset,
  vehicleInfo, units = 'metric',
  serviceRecords = [],
  onAddServiceRecord,
  onDeleteServiceRecord,
}) {
  const [editing,     setEditing]     = useState(null);
  const [captureOpen, setCaptureOpen] = useState(false);

  const odometerUnit    = vehicleInfo?.odometerUnit || 'km';
  const rawOdo          = parseFloat(vehicleInfo?.odometer) || 0;
  const currentOdoKm    = odoToKm(rawOdo, odometerUnit);
  const unitLabel       = odometerUnit === 'mi' ? 'mi' : 'km';
  const hasVehicle      = !!(vehicleInfo?.make || vehicleInfo?.model);

  // Get vehicle-specific schedule (returns only relevant items, removes EV oil etc.)
  const vehicleSchedule = getScheduleForVehicle(vehicleInfo?.make, vehicleInfo?.model);
  const scheduleItems   = Object.entries(vehicleSchedule);

  const currentOdoDisplay = rawOdo ? `${rawOdo.toLocaleString()} ${unitLabel}` : null;

  // Count overdue items
  const overdueCount = scheduleItems.filter(([key, vItem]) => {
    const storedIvl = schedule[key]?.intervalKm ?? vItem.intervalKm;
    const { status } = calcProgress(schedule[key], storedIvl, currentOdoKm, odometerUnit);
    return status === 'overdue';
  }).length;

  function handleReset() {
    if (window.confirm('Reset all service intervals to vehicle defaults?')) {
      onReset(vehicleSchedule);
    }
  }

  return (
    <div className="maint-tab">
      {/* ── Header ── */}
      <div className="maint-header">
        <div className="maint-header__left">
          <h1 className="maint-header__title">Service</h1>
          {overdueCount > 0 && (
            <span className="maint-header__badge">{overdueCount} overdue</span>
          )}
        </div>
        {hasVehicle && (
          <button className="maint-header__reset" onClick={handleReset} type="button">
            Reset defaults
          </button>
        )}
      </div>

      {/* ── Vehicle prompt (when no vehicle set) ── */}
      {!hasVehicle && (
        <div className="maint-tip maint-tip--vehicle">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8"  x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          Set your vehicle in the Vehicle tab for personalized service intervals
        </div>
      )}

      {/* ── Odometer tip ── */}
      {hasVehicle && !rawOdo && (
        <div className="maint-tip">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8"  x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          Add your odometer reading in the Vehicle tab for mileage-based tracking
        </div>
      )}

      {/* ── Vehicle schedule banner ── */}
      {hasVehicle && vehicleInfo.make && vehicleInfo.model && (
        <div className="maint-vehicle-banner">
          <span>📋</span>
          Schedule for your {[vehicleInfo.year, vehicleInfo.make, vehicleInfo.model].filter(Boolean).join(' ')}
        </div>
      )}

      {/* ── Ring grid ── */}
      <div className="maint-grid">
        {scheduleItems.map(([key, vItem]) => {
          const storedData  = schedule[key] || {};
          const intervalKm  = storedData.intervalKm ?? vItem.intervalKm;
          const { pct, status, dueText } = calcProgress(storedData, intervalKm, currentOdoKm, odometerUnit);
          const intervalText = `Every ${formatInterval(vItem.intervalKm, unitLabel)}`;
          return (
            <MaintenanceRing
              key={key}
              label={vItem.label}
              icon={vItem.icon}
              intervalKm={intervalKm}
              pct={pct}
              status={status}
              dueText={dueText}
              intervalText={intervalText}
              onClick={() => setEditing(key)}
            />
          );
        })}
      </div>

      {/* ── Quick service log (from schedule) ── */}
      <section className="maint-section">
        <div className="maint-section__header">
          <h2 className="maint-section__title">LOGGED SERVICES</h2>
        </div>
        {scheduleItems.every(([k]) => !schedule[k]?.lastDate) ? (
          <p className="maint-empty">
            No services logged yet. Tap any ring above to record a service.
          </p>
        ) : (
          <div className="maint-log-list">
            {scheduleItems
              .filter(([k]) => schedule[k]?.lastDate)
              .sort(([a], [b]) => new Date(schedule[b].lastDate) - new Date(schedule[a].lastDate))
              .map(([key, vItem]) => {
                const d = schedule[key];
                const lastOdoDisplay = d.lastKm
                  ? ` · ${kmToDisplay(d.lastKm, odometerUnit).toLocaleString()} ${unitLabel}`
                  : '';
                return (
                  <div key={key} className="maint-log-row">
                    <span className="maint-log-row__icon">{vItem.icon}</span>
                    <div className="maint-log-row__info">
                      <span className="maint-log-row__label">{vItem.label}</span>
                      <span className="maint-log-row__date">
                        {new Date(d.lastDate + 'T12:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                        {lastOdoDisplay}
                      </span>
                    </div>
                    <button className="maint-log-row__edit" onClick={() => setEditing(key)} type="button">
                      Edit
                    </button>
                  </div>
                );
              })}
          </div>
        )}
      </section>

      {/* ── Service history (from service records) ── */}
      <section className="maint-section">
        <div className="maint-section__header">
          <h2 className="maint-section__title">SERVICE HISTORY</h2>
          <button
            className="maint-section__add-btn"
            onClick={() => setCaptureOpen(true)}
            type="button"
          >
            + Add Record
          </button>
        </div>

        {serviceRecords.length === 0 ? (
          <div className="maint-history-empty">
            <p className="maint-history-empty__text">No service records yet.</p>
            <button
              className="maint-history-empty__btn"
              onClick={() => setCaptureOpen(true)}
              type="button"
            >
              📷 Scan Receipt or Enter Manually
            </button>
          </div>
        ) : (
          <div className="maint-history-list">
            {serviceRecords.map(record => (
              <ServiceRecordCard
                key={record.id}
                record={record}
                odometerUnit={odometerUnit}
                onDelete={onDeleteServiceRecord}
              />
            ))}
          </div>
        )}
      </section>

      <div style={{ height: '100px' }} />

      {/* ── Edit sheet ── */}
      {editing && (
        <ServiceEditSheet
          item={{ ...vehicleSchedule[editing], key: editing }}
          data={schedule[editing]}
          vehicleIntervalKm={vehicleSchedule[editing]?.intervalKm || 8000}
          currentOdo={currentOdoDisplay}
          odometerUnit={odometerUnit}
          onSave={(updates) => onUpdate(editing, updates)}
          onClose={() => setEditing(null)}
        />
      )}

      {/* ── Service Record Capture ── */}
      <ServiceRecordCapture
        isOpen={captureOpen}
        onClose={() => setCaptureOpen(false)}
        onSave={onAddServiceRecord}
        odometerUnit={odometerUnit}
      />
    </div>
  );
}
