import './ShopPlayerCard.css';

// ── Deterministic attribute generation ───────────────────────────────────────
// OSM shops have no rating data, so attributes are derived from a stable hash
// of the shop identity — same shop always gets the same card.

function hashString(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) { h = ((h << 5) - h) + str.charCodeAt(i); h |= 0; }
  return Math.abs(h);
}

function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }

export function computeAttrs(shop) {
  const seed = hashString(shop.name + (shop.id || ''));
  const rating = shop.rating || (6 + (seed % 35) / 10);
  const base = Math.round(rating * 10);
  const speed         = clamp(base + ((seed >> 0  & 0xF) - 7), 42, 99);
  const skill         = clamp(base + ((seed >> 4  & 0xF) - 7), 42, 99);
  const value         = clamp(base + ((seed >> 8  & 0xF) - 7), 42, 99);
  const communication = clamp(base + ((seed >> 12 & 0xF) - 7), 42, 99);
  const trust         = clamp(Math.round(rating * 10.5), 42, 99);
  const overall       = Math.round((speed + skill + value + communication + trust) / 5);
  return { speed, skill, value, communication, trust, overall };
}

function attrColor(v) {
  if (v >= 80) return 'var(--success)';
  if (v >= 65) return 'var(--warning)';
  return 'var(--danger)';
}

const ATTRS = [
  { label: 'SPD', key: 'speed',         icon: '⚡' },
  { label: 'SKL', key: 'skill',         icon: '🔧' },
  { label: 'VAL', key: 'value',         icon: '💰' },
  { label: 'COM', key: 'communication', icon: '💬' },
  { label: 'TRU', key: 'trust',         icon: '⭐' },
];

export default function ShopPlayerCard({ shop, onSelect, isExpanded, onSendDiagnosis, hasDiagnosis }) {
  const attrs = computeAttrs(shop);
  const medal = attrs.overall >= 85 ? '🥇' : attrs.overall >= 70 ? '🥈' : '🥉';

  return (
    <div className={'shop-player-card' + (isExpanded ? ' expanded' : '')} onClick={onSelect}>
      <div className="spc-header">
        <div className="spc-overall">{attrs.overall}</div>
        <div className="spc-meta">
          <div className="spc-name">{shop.name}</div>
          <div className="spc-location">{shop.distanceLabel}{shop.city ? ' · ' + shop.city : ''}</div>
        </div>
        <div className="spc-badge" aria-hidden="true">{medal}</div>
      </div>

      <div className="spc-attributes">
        {ATTRS.map(a => (
          <div key={a.key} className="spc-attr">
            <span className="spc-attr-icon" aria-hidden="true">{a.icon}</span>
            <div className="spc-attr-bar-track">
              <div className="spc-attr-bar-fill" style={{ width: attrs[a.key] + '%', background: attrColor(attrs[a.key]) }} />
            </div>
            <span className="spc-attr-value">{attrs[a.key]}</span>
            <span className="spc-attr-label">{a.label}</span>
          </div>
        ))}
      </div>

      {isExpanded && (
        <div className="spc-actions">
          <button
            className="spc-btn spc-btn-directions"
            onClick={e => { e.stopPropagation(); window.open(shop.mapsUrl || `https://www.google.com/maps/dir/?api=1&destination=${shop.lat},${shop.lon}`); }}
            type="button"
          >
            🗺 Directions
          </button>
          {shop.phone && (
            <button
              className="spc-btn spc-btn-call"
              onClick={e => { e.stopPropagation(); window.location.href = 'tel:' + shop.phone; }}
              type="button"
            >
              📞 Call
            </button>
          )}
          {hasDiagnosis && onSendDiagnosis && (
            <button
              className="spc-btn spc-btn-send"
              onClick={e => { e.stopPropagation(); onSendDiagnosis(shop); }}
              type="button"
            >
              📤 Send Dx
            </button>
          )}
        </div>
      )}
    </div>
  );
}
