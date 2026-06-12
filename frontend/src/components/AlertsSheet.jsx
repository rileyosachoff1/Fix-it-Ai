import './AlertsSheet.css';

const TYPE_META = {
  dtc:         { icon: '⚠️', cls: 'dtc' },
  maintenance: { icon: '🔧', cls: 'maintenance' },
  recall:      { icon: '📢', cls: 'recall' },
  diagnosis:   { icon: '🎙️', cls: 'diagnosis' },
};

export default function AlertsSheet({ alerts = [], onDismiss, onClearAll, onClose }) {
  return (
    <div className="alerts-sheet-overlay" onClick={onClose}>
      <div className="alerts-sheet" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Alerts">
        <div className="alerts-sheet__handle" />
        <div className="alerts-sheet__header">
          <h2 className="alerts-sheet__title">Alerts</h2>
          {alerts.length > 0 && (
            <button className="alerts-sheet__clear" onClick={onClearAll} type="button">
              Clear All
            </button>
          )}
        </div>

        {alerts.length === 0 ? (
          <div className="alerts-sheet__empty">
            <span className="alerts-sheet__empty-icon" aria-hidden="true">✅</span>
            <p className="alerts-sheet__empty-text">All clear — no active alerts.</p>
          </div>
        ) : (
          <div className="alerts-sheet__list">
            {alerts.map(alert => {
              const meta = TYPE_META[alert.type] || TYPE_META.dtc;
              return (
                <div key={alert.id} className={`alerts-sheet__item alerts-sheet__item--${meta.cls}`}>
                  <span className="alerts-sheet__item-icon" aria-hidden="true">{meta.icon}</span>
                  <div className="alerts-sheet__item-text">
                    <span className="alerts-sheet__item-title">{alert.title}</span>
                    {alert.body && <span className="alerts-sheet__item-body">{alert.body}</span>}
                    {alert.detail && <span className="alerts-sheet__item-detail">{alert.detail}</span>}
                  </div>
                  <button
                    className="alerts-sheet__item-dismiss"
                    onClick={() => onDismiss?.(alert.id)}
                    aria-label={`Dismiss ${alert.title}`}
                    type="button"
                  >
                    ✕
                  </button>
                </div>
              );
            })}
          </div>
        )}

        <button className="alerts-sheet__close" onClick={onClose} type="button">Done</button>
      </div>
    </div>
  );
}
