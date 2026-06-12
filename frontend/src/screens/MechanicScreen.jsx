import { useState, useEffect, useRef, useCallback } from 'react';
import { findShopsNearLocation, logReferral, submitPartnerInquiry, buildDiagnosisMessage } from '../services/mechanicService.js';
import { searchAddress } from '../services/addressService.js';
import { getDtcInfo } from '../data/dtcCatalog.js';
import ShopPlayerCard, { computeAttrs } from '../components/ui/ShopPlayerCard.jsx';
import './MechanicScreen.css';

// Sort options for the gamified shop list
const SHOP_SORTS = [
  { key: 'overall',  label: 'Overall' },
  { key: 'speed',    label: 'Speed' },
  { key: 'value',    label: 'Value' },
  { key: 'distance', label: 'Distance' },
];

// ── Helpers ────────────────────────────────────────────────────────────────────
function isMobileDevice() {
  return /iPhone|Android|Mobile|iPad/i.test(navigator.userAgent) || navigator.maxTouchPoints > 1;
}

// Quick "what do you need help with?" filter chips
const SERVICE_FILTERS = ['Oil Change', 'Brakes', 'Engine', 'Tires', 'Electrical', 'Full Inspection'];

// Keywords used to match a filter against a shop's services list
const FILTER_KEYWORDS = {
  'Oil Change':      ['oil'],
  'Brakes':          ['brake'],
  'Engine':          ['engine', 'diagnostic'],
  'Tires':           ['tire', 'wheel'],
  'Electrical':      ['electric', 'battery'],
  'Full Inspection': ['inspection'],
};

function shopMatchesFilter(shop, filter) {
  if (!filter) return true;
  const services = (shop.services ?? shop.specialties ?? []).map(s => String(s).toLowerCase());
  if (!services.length) return true; // no service data (OSM) — keep visible
  const keywords = FILTER_KEYWORDS[filter] || [filter.toLowerCase()];
  return services.some(s => keywords.some(k => s.includes(k)));
}

function shopSpecializesInMake(shop, make) {
  if (!make) return false;
  const m = make.toLowerCase();
  const lists = [...(shop.services ?? []), ...(shop.specialties ?? []), ...(shop.certifications ?? [])];
  return lists.some(s => String(s).toLowerCase().includes(m));
}

// ── Star rating display ────────────────────────────────────────────────────────
function Stars({ rating }) {
  if (!rating) return null;
  const full = Math.floor(rating);
  const half = rating - full >= 0.5;
  return (
    <span className="mech-stars" aria-label={`${rating} out of 5 stars`}>
      {Array.from({ length: 5 }, (_, i) => {
        if (i < full) return <span key={i} className="mech-star mech-star--full">★</span>;
        if (i === full && half) return <span key={i} className="mech-star mech-star--half">★</span>;
        return <span key={i} className="mech-star mech-star--empty">★</span>;
      })}
      <span className="mech-stars__num">{rating}</span>
    </span>
  );
}

// ── Skeleton loaders ───────────────────────────────────────────────────────────
function PartnerSkeleton() {
  return (
    <div className="mech-card mech-card--partner mech-card--skeleton" aria-hidden="true">
      <div className="mech-skeleton mech-skeleton--badge" />
      <div className="mech-skeleton mech-skeleton--title" />
      <div className="mech-skeleton mech-skeleton--stars" />
      <div className="mech-skeleton mech-skeleton--line" />
      <div className="mech-skeleton mech-skeleton--line mech-skeleton--line-short" />
      <div className="mech-skeleton mech-skeleton--actions" />
    </div>
  );
}

function NearbySkeleton() {
  return (
    <div className="mech-card mech-card--nearby mech-card--skeleton" aria-hidden="true">
      <div className="mech-skeleton mech-skeleton--title" />
      <div className="mech-skeleton mech-skeleton--line mech-skeleton--line-short" />
    </div>
  );
}

// ── Partner shop card ──────────────────────────────────────────────────────────
function PartnerCard({ shop, diagnosis, vehicleInfo, onSendDiagnosis }) {
  const specializesInMake = shopSpecializesInMake(shop, vehicleInfo?.make);
  const callUrl = shop.phone ? `tel:${shop.phone}` : null;
  const hasDx   = !!(diagnosis?.primary ?? diagnosis);

  // Use pre-computed mapsUrl from backend, fall back to coords
  const googleMapsUrl = shop.mapsUrl
    || `https://www.google.com/maps/dir/?api=1&destination=${shop.lat},${shop.lon}`;

  function handleCall(e) {
    logReferral({
      shopId: shop.id, shopName: shop.name, action: 'call',
      customerCity: null, customerProvince: shop.province,
      diagnosisPrimary: (diagnosis?.primary ?? diagnosis)?.diagnosis || null,
    });
  }

  function handleDirections(e) {
    logReferral({
      shopId: shop.id, shopName: shop.name, action: 'directions',
      customerCity: null, customerProvince: shop.province,
      diagnosisPrimary: (diagnosis?.primary ?? diagnosis)?.diagnosis || null,
    });
  }

  function handleSend() {
    logReferral({
      shopId: shop.id, shopName: shop.name, action: 'diagnosis_sent',
      customerCity: null, customerProvince: shop.province,
      diagnosisPrimary: (diagnosis?.primary ?? diagnosis)?.diagnosis || null,
    });
    onSendDiagnosis(shop);
  }

  const openLabel = shop.isOpenNow === true  ? 'Open now'
                  : shop.isOpenNow === false ? 'Closed'
                  : null;
  const openCls   = shop.isOpenNow === true ? 'mech-open--yes' : 'mech-open--no';

  // Normalise services: spec uses "services", earlier schema used "specialties"
  const services = shop.services ?? shop.specialties ?? [];

  return (
    <div className="mech-card mech-card--partner">
      {/* Gold partner badge */}
      <div className="mech-partner-badge">
        <svg width="10" height="10" viewBox="0 0 12 12" fill="currentColor" aria-hidden="true">
          <path d="M6 0l1.5 4.5H12L8.5 7.3l1.2 4L6 9 2.3 11.3l1.2-4L0 4.5h4.5z"/>
        </svg>
        FixIt AI Partner
      </div>

      {/* Shop name */}
      <div className="mech-card__header">
        <h3 className="mech-card__name">{shop.name}</h3>
        {shop.rating != null && (
          <div className="mech-card__rating">
            <Stars rating={shop.rating} />
            <span className="mech-card__review-count">
              ({shop.reviewCount?.toLocaleString()} reviews)
            </span>
          </div>
        )}
      </div>

      {/* Address */}
      <p className="mech-card__address">
        {[shop.address, shop.city, shop.province, shop.postalCode].filter(Boolean).join(', ')}
      </p>

      {/* Open/closed + hours + distance */}
      <div className="mech-card__meta-row">
        {openLabel && (
          <span className={`mech-open ${openCls}`}>
            <span className="mech-open__dot" />
            {openLabel}
            {shop.todayHours && shop.todayHours !== 'Closed' && (
              <span className="mech-open__hours"> · {shop.todayHours}</span>
            )}
          </span>
        )}
        {shop.distanceLabel && (
          <span className="mech-card__distance-badge">{shop.distanceLabel}</span>
        )}
      </div>

      {/* Make specialization */}
      {specializesInMake && (
        <div className="mech-make-badge">
          🚗 Specializes in {vehicleInfo.make}
        </div>
      )}

      {/* Service tags */}
      {services.length > 0 && (
        <div className="mech-card__tags">
          {services.slice(0, 4).map(s => (
            <span key={s} className="mech-tag">{s}</span>
          ))}
          {services.length > 4 && (
            <span className="mech-tag mech-tag--more">+{services.length - 4}</span>
          )}
        </div>
      )}

      {/* Certifications */}
      {shop.certifications?.length > 0 && (
        <div className="mech-card__certs">
          {shop.certifications.map(c => (
            <span key={c} className="mech-cert">✓ {c}</span>
          ))}
        </div>
      )}

      {/* Languages */}
      {shop.languages?.length > 0 && (
        <div className="mech-card__langs">
          <span className="mech-lang-label">🗣</span>
          {shop.languages.map((l, i) => (
            <span key={l} className="mech-lang">
              {l}{i < shop.languages.length - 1 ? ' · ' : ''}
            </span>
          ))}
        </div>
      )}

      {/* Action buttons */}
      <div className="mech-card__actions">
        {callUrl ? (
          <a
            href={callUrl}
            className="mech-card__action-btn mech-card__action-btn--call"
            onClick={handleCall}
            aria-label={`Call ${shop.name}`}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 1.27h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.83a16 16 0 0 0 6 6l1.27-.95a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
            </svg>
            Call Now
          </a>
        ) : (
          <button className="mech-card__action-btn mech-card__action-btn--call" disabled aria-label="No phone number">
            No Phone
          </button>
        )}

        <a
          href={googleMapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mech-card__action-btn mech-card__action-btn--directions"
          onClick={handleDirections}
          aria-label={`Directions to ${shop.name}`}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polygon points="3 11 22 2 13 21 11 13 3 11"/>
          </svg>
          Directions
        </a>

        <button
          className="mech-card__action-btn mech-card__action-btn--send"
          onClick={handleSend}
          aria-label={hasDx ? `Send diagnosis to ${shop.name}` : `Message ${shop.name}`}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <line x1="22" y1="2" x2="11" y2="13"/>
            <polygon points="22 2 15 22 11 13 2 9 22 2"/>
          </svg>
          {hasDx ? 'Send Dx' : 'Message'}
        </button>
      </div>
    </div>
  );
}

// ── Nearby shop card ───────────────────────────────────────────────────────────
function NearbyCard({ shop, onSuggest }) {
  const googleMapsUrl = shop.mapsUrl
    || `https://www.google.com/maps/dir/?api=1&destination=${shop.lat},${shop.lon}`;
  const addrLine = [shop.address, shop.city].filter(Boolean).join(', ');

  return (
    <div className="mech-card mech-card--nearby">
      <div className="mech-card__nearby-body">
        <div className="mech-card__nearby-info">
          <h3 className="mech-card__name mech-card__name--nearby">{shop.name}</h3>
          {addrLine && <p className="mech-card__address mech-card__address--nearby">{addrLine}</p>}
          {shop.distanceLabel && (
            <span className="mech-card__distance-badge mech-card__distance-badge--sm">
              {shop.distanceLabel}
            </span>
          )}
        </div>
        <div className="mech-card__nearby-actions">
          <a
            href={googleMapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mech-card__action-btn mech-card__action-btn--directions mech-card__action-btn--sm"
            aria-label={`Directions to ${shop.name}`}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polygon points="3 11 22 2 13 21 11 13 3 11"/>
            </svg>
            Directions
          </a>
          <button
            className="mech-card__action-btn mech-card__action-btn--suggest mech-card__action-btn--sm"
            onClick={() => onSuggest(shop)}
            aria-label={`Suggest ${shop.name} as FixIt AI partner`}
          >
            <svg width="10" height="10" viewBox="0 0 12 12" fill="currentColor" aria-hidden="true">
              <path d="M6 0l1.5 4.5H12L8.5 7.3l1.2 4L6 9 2.3 11.3l1.2-4L0 4.5h4.5z"/>
            </svg>
            Suggest →
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Partner inquiry modal ─────────────────────────────────────────────────────
function InquiryModal({ preFillName, onClose }) {
  const [form, setForm]       = useState({
    shopName: preFillName || '', contactName: '', phone: '', email: '', city: '', province: '', notes: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [done,       setDone]       = useState(false);
  const [error,      setError]      = useState(null);

  function update(key, val) { setForm(prev => ({ ...prev, [key]: val })); }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.shopName.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      await submitPartnerInquiry(form);
      setDone(true);
    } catch (err) {
      setError(err.message || 'Submission failed — please try again');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mech-sheet-overlay" onClick={onClose}>
      <div className="mech-sheet" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Suggest a shop">
        <div className="mech-sheet__handle" />

        {done ? (
          <div className="mech-sheet__done">
            <div className="mech-sheet__done-icon">✓</div>
            <h2 className="mech-sheet__done-title">Thanks!</h2>
            <p className="mech-sheet__done-sub">
              We'll reach out to this shop about joining the FixIt AI partner network.
            </p>
            <button className="mech-sheet__close-btn" onClick={onClose}>Done</button>
          </div>
        ) : (
          <>
            <h2 className="mech-sheet__title">Refer This Shop to FixIt AI</h2>
            <p className="mech-sheet__sub">Know a great mechanic? Tell us — we'll invite them to join.</p>

            {error && <div className="mech-sheet__error">{error}</div>}

            <form className="mech-sheet__form" onSubmit={handleSubmit}>
              <label className="mech-sheet__label">Shop Name *</label>
              <input
                className="mech-sheet__input"
                value={form.shopName}
                onChange={e => update('shopName', e.target.value)}
                placeholder="Joe's Auto Repair"
                required
                autoFocus
              />

              <label className="mech-sheet__label">Contact Name</label>
              <input
                className="mech-sheet__input"
                value={form.contactName}
                onChange={e => update('contactName', e.target.value)}
                placeholder="Joe Smith"
              />

              <div className="mech-sheet__row">
                <div className="mech-sheet__field">
                  <label className="mech-sheet__label">Phone</label>
                  <input
                    className="mech-sheet__input"
                    value={form.phone}
                    onChange={e => update('phone', e.target.value)}
                    placeholder="(604) 555-0100"
                    type="tel"
                  />
                </div>
                <div className="mech-sheet__field">
                  <label className="mech-sheet__label">Email</label>
                  <input
                    className="mech-sheet__input"
                    value={form.email}
                    onChange={e => update('email', e.target.value)}
                    placeholder="joe@repair.ca"
                    type="email"
                  />
                </div>
              </div>

              <div className="mech-sheet__row">
                <div className="mech-sheet__field">
                  <label className="mech-sheet__label">City</label>
                  <input
                    className="mech-sheet__input"
                    value={form.city}
                    onChange={e => update('city', e.target.value)}
                    placeholder="Surrey"
                  />
                </div>
                <div className="mech-sheet__field">
                  <label className="mech-sheet__label">Province</label>
                  <input
                    className="mech-sheet__input"
                    value={form.province}
                    onChange={e => update('province', e.target.value.toUpperCase())}
                    placeholder="BC"
                    maxLength={2}
                  />
                </div>
              </div>

              <label className="mech-sheet__label">Notes</label>
              <textarea
                className="mech-sheet__input mech-sheet__input--textarea"
                value={form.notes}
                onChange={e => update('notes', e.target.value)}
                placeholder="Anything else we should know?"
                rows={2}
              />

              <button
                className="mech-sheet__submit"
                type="submit"
                disabled={submitting || !form.shopName.trim()}
              >
                {submitting ? 'Submitting…' : 'Submit Referral'}
              </button>
              <button className="mech-sheet__cancel" type="button" onClick={onClose}>Cancel</button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

// ── Send diagnosis sheet ───────────────────────────────────────────────────────
function SendDiagnosisSheet({ shop, message, onClose }) {
  const [copied, setCopied] = useState(false);
  const mobile  = isMobileDevice();
  const phone   = shop.phone?.replace(/\D/g, '');
  const smsUrl  = mobile && phone ? `sms:+${phone}?body=${encodeURIComponent(message)}` : null;

  function handleCopy() {
    navigator.clipboard.writeText(message).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }).catch(() => {
      // Fallback: select a textarea
      const el = document.createElement('textarea');
      el.value = message;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  }

  return (
    <div className="mech-sheet-overlay" onClick={onClose}>
      <div className="mech-sheet" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Send diagnosis">
        <div className="mech-sheet__handle" />
        <h2 className="mech-sheet__title">Send Your Diagnosis</h2>
        <p className="mech-sheet__sub">
          Send this to <strong>{shop.name}</strong> so they can prepare before you arrive.
        </p>

        <div className="mech-sms-preview" aria-label="Message preview">
          <p className="mech-sms-preview__text">{message}</p>
        </div>

        {smsUrl ? (
          <a
            href={smsUrl}
            className="mech-sheet__submit mech-sheet__submit--sms"
            onClick={onClose}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
            Open in Messages
          </a>
        ) : (
          <button className="mech-sheet__submit" onClick={handleCopy}>
            {copied ? (
              <>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>
                Copied!
              </>
            ) : (
              <>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                Copy to Clipboard
              </>
            )}
          </button>
        )}

        <button className="mech-sheet__cancel" onClick={onClose}>Close</button>
      </div>
    </div>
  );
}

// ── Filter sheet ──────────────────────────────────────────────────────────────
function FilterSheet({ radiusKm, sortBy, onApply, onClose }) {
  const [radius, setRadius] = useState(radiusKm);
  const [sort,   setSort]   = useState(sortBy);

  return (
    <div className="mech-sheet-overlay" onClick={onClose}>
      <div className="mech-sheet" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Filter results">
        <div className="mech-sheet__handle" />
        <h2 className="mech-sheet__title">Filter Results</h2>

        {/* Radius */}
        <p className="mech-sheet__section-label">SEARCH RADIUS</p>
        <div className="mech-filter__radius-row" role="group" aria-label="Search radius">
          {[10, 25, 50].map(r => (
            <button
              key={r}
              className={`mech-filter__radius-btn${radius === r ? ' mech-filter__radius-btn--active' : ''}`}
              onClick={() => setRadius(r)}
              aria-pressed={radius === r}
            >
              {r} km
            </button>
          ))}
        </div>

        {/* Sort by */}
        <p className="mech-sheet__section-label" style={{ marginTop: 20 }}>SORT BY</p>
        <div className="mech-filter__sort-row" role="group" aria-label="Sort by">
          {['distance', 'rating'].map(s => (
            <button
              key={s}
              className={`mech-filter__sort-btn${sort === s ? ' mech-filter__sort-btn--active' : ''}`}
              onClick={() => setSort(s)}
              aria-pressed={sort === s}
            >
              {s === 'distance' ? '📍 Distance' : '★ Rating'}
            </button>
          ))}
        </div>

        <button
          className="mech-sheet__submit"
          onClick={() => { onApply({ radius, sortBy: sort }); onClose(); }}
        >
          Apply Filters
        </button>
      </div>
    </div>
  );
}

// ── Main MechanicScreen ───────────────────────────────────────────────────────
export default function MechanicScreen({ locationCoords, location, vehicleInfo, diagnosis, dtcContext = null, initialServiceFilter = null, onBack, embedded = false }) {
  // Resolved coordinates
  const [lat,            setLat]            = useState(locationCoords?.lat ?? null);
  const [lon,            setLon]            = useState(locationCoords?.lon ?? null);
  const [displayAddress, setDisplayAddress] = useState(location || '');
  const [geocoding,      setGeocoding]      = useState(false);
  const [geocodeErr,     setGeocodeErr]     = useState(null);

  // Address search input (when no location saved)
  const [searchInput, setSearchInput] = useState('');
  const searchInputRef = useRef(null);

  // Shop data
  const [shops,   setShops]   = useState(null);   // { partners: [], nearby: [] }
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);

  // Filters
  const [radiusKm, setRadiusKm] = useState(25);
  const [sortBy,   setSortBy]   = useState('distance'); // legacy filter sheet: 'distance' | 'rating'

  // Gamified card state
  const [shopSort,       setShopSort]       = useState('overall'); // overall | speed | value | distance
  const [expandedShopId, setExpandedShopId] = useState(null);      // one expanded card at a time

  // UI sheets
  const [showFilter,     setShowFilter]     = useState(false);
  const [showInquiry,    setShowInquiry]    = useState(false);
  const [inquiryPreFill, setInquiryPreFill] = useState('');
  const [sendSheet,      setSendSheet]      = useState(null);   // { shop, message }
  const [dismissedBanner, setDismissedBanner] = useState(false);

  // "What do you need help with?" quick service filter
  const [serviceFilter, setServiceFilter] = useState(initialServiceFilter);

  // ── Geocode location string if no coords ────────────────────────────────
  useEffect(() => {
    if (lat != null && lon != null) return;
    if (!location?.trim()) return;

    let cancelled = false;
    setGeocoding(true);
    setGeocodeErr(null);

    searchAddress(location.trim())
      .then(results => {
        if (cancelled) return;
        if (results?.length > 0) {
          const r = results[0];
          setLat(r.lat);
          setLon(r.lon);
          setDisplayAddress(r.shortName || location);
        } else {
          setGeocodeErr('Could not find that location. Try entering a different address.');
        }
      })
      .catch(() => {
        if (!cancelled) setGeocodeErr('Location lookup failed. Enter your address below.');
      })
      .finally(() => { if (!cancelled) setGeocoding(false); });

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Search shops when coords become available ──────────────────────────
  const doSearch = useCallback(async (searchLat, searchLon, radius) => {
    setLoading(true);
    setError(null);
    try {
      const data = await findShopsNearLocation(searchLat, searchLon, radius);
      setShops({ partners: data.partners || [], nearby: data.nearby || [] });
    } catch (err) {
      setError('Could not load shops. Check your connection and try again.');
      console.error('[MechanicScreen]', err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (lat != null && lon != null) doSearch(lat, lon, radiusKm);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lat, lon]);

  // ── Apply filter changes ───────────────────────────────────────────────
  function applyFilters({ radius, sortBy: sb }) {
    const radiusChanged = radius !== radiusKm;
    setRadiusKm(radius);
    setSortBy(sb);
    setShopSort(sb === 'rating' ? 'overall' : 'distance');
    if (radiusChanged && lat != null && lon != null) doSearch(lat, lon, radius);
  }

  // ── Manual address geocode (address input form) ────────────────────────
  async function handleAddressSearch(e) {
    e.preventDefault();
    const query = searchInput.trim();
    if (!query) return;

    setGeocoding(true);
    setGeocodeErr(null);
    try {
      const results = await searchAddress(query);
      if (results?.length > 0) {
        const r = results[0];
        setLat(r.lat);
        setLon(r.lon);
        setDisplayAddress(r.shortName || query);
        setSearchInput('');
      } else {
        setGeocodeErr('No results found. Try a more specific address.');
      }
    } catch {
      setGeocodeErr('Location lookup failed. Check your connection.');
    } finally {
      setGeocoding(false);
    }
  }

  // ── Effective diagnosis context (real diagnosis > DTC > service filter) ──
  const effectiveDiagnosis = diagnosis
    || (dtcContext ? { primary: { diagnosis: `${dtcContext.code} — ${dtcContext.description || getDtcInfo(dtcContext.code).name}` } } : null)
    || (serviceFilter ? { primary: { diagnosis: serviceFilter } } : null);

  // ── Send diagnosis ─────────────────────────────────────────────────────
  function handleSendDiagnosis(shop) {
    logReferral({
      shopId: shop.id, shopName: shop.name, action: 'diagnosis_sent',
      customerCity: null, customerProvince: shop.province || null,
      diagnosisPrimary: (effectiveDiagnosis?.primary ?? effectiveDiagnosis)?.diagnosis || null,
    });
    const message = buildDiagnosisMessage(effectiveDiagnosis, vehicleInfo);
    const mobile  = isMobileDevice();
    const phone   = shop.phone?.replace(/\D/g, '');

    if (mobile && phone) {
      window.location.href = `sms:+${phone}?body=${encodeURIComponent(message)}`;
    } else {
      setSendSheet({ shop, message });
    }
  }

  // ── Suggest a nearby shop ──────────────────────────────────────────────
  function handleSuggest(shop) {
    setInquiryPreFill(shop?.name || '');
    setShowInquiry(true);
  }

  // ── Derived display lists ──────────────────────────────────────────────
  const hasDiagnosis  = !!(diagnosis?.primary ?? diagnosis);
  const diagnosisName = (diagnosis?.primary ?? diagnosis)?.diagnosis;
  const hasCoords     = lat != null && lon != null;
  const dtcInfo       = dtcContext ? getDtcInfo(dtcContext.code) : null;
  const showFilterChips = !hasDiagnosis && !dtcContext && hasCoords;

  function sortShops(arr) {
    if (sortBy === 'rating') {
      return [...arr].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
    }
    return [...arr].sort((a, b) => a.distanceKm - b.distanceKm);
  }

  const activeFilter = showFilterChips ? serviceFilter : null;
  // Single unified list — real shops only (partner program hasn't launched yet)
  const baseShops = shops
    ? [...(shops.partners || []), ...(shops.nearby || [])].filter(s => shopMatchesFilter(s, activeFilter))
    : [];
  const displayShops = [...baseShops].sort((a, b) => {
    if (shopSort === 'distance') return (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity);
    return computeAttrs(b)[shopSort] - computeAttrs(a)[shopSort];
  });

  return (
    <div className={`mech-screen${embedded ? ' mech-screen--embedded' : ''}`}>
      {/* ── Header ── */}
      <header className="mech-header">
        {!embedded && (
          <button className="mech-header__back" onClick={onBack} aria-label="Go back">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
          </button>
        )}
        <h1 className="mech-header__title">{embedded ? '🏆 AutoShop' : 'Mechanics Near You'}</h1>
        <button className="mech-header__filter" onClick={() => setShowFilter(true)} aria-label="Filter and sort">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <line x1="4" y1="6" x2="20" y2="6"/>
            <line x1="8" y1="12" x2="16" y2="12"/>
            <line x1="11" y1="18" x2="13" y2="18"/>
          </svg>
        </button>
      </header>

      {/* ── Scrollable body ── */}
      <div className="mech-body">

        {/* ── Location bar or address input ── */}
        {hasCoords && displayAddress ? (
          <div className="mech-location-bar">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mech-location-bar__icon" aria-hidden="true">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
              <circle cx="12" cy="10" r="3"/>
            </svg>
            <span className="mech-location-bar__text">{displayAddress}</span>
            <span className="mech-location-bar__radius">· {radiusKm} km</span>
            <button
              className="mech-location-bar__change"
              onClick={() => {
                setLat(null);
                setLon(null);
                setShops(null);
                setSearchInput(displayAddress);
                setTimeout(() => searchInputRef.current?.focus(), 80);
              }}
            >
              Change
            </button>
          </div>
        ) : (
          <div className="mech-address-prompt">
            <p className="mech-address-prompt__label">
              Enter your location to find mechanics near you
            </p>
            <form className="mech-address-prompt__form" onSubmit={handleAddressSearch}>
              <input
                ref={searchInputRef}
                className="mech-address-prompt__input"
                type="text"
                placeholder="City or postal code — e.g. Surrey, BC"
                value={searchInput}
                onChange={e => setSearchInput(e.target.value)}
                disabled={geocoding}
                aria-label="Enter your address or city"
                autoComplete="address-level2"
              />
              <button
                className="mech-address-prompt__btn"
                type="submit"
                disabled={geocoding || !searchInput.trim()}
                aria-label="Search"
              >
                {geocoding
                  ? <span className="mech-spin" />
                  : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                }
              </button>
            </form>
            {geocodeErr && (
              <p className="mech-address-prompt__error" role="alert">{geocodeErr}</p>
            )}
          </div>
        )}

        {/* ── Geocoding in-progress ── */}
        {geocoding && !hasCoords && !searchInput && (
          <div className="mech-geocoding">
            <span className="mech-spin" aria-hidden="true" />
            <span>Finding your location…</span>
          </div>
        )}

        {/* ── DTC fault-code context banner ── */}
        {dtcContext && hasCoords && !dismissedBanner && (
          <div className="mech-dx-banner mech-dx-banner--dtc" role="status">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
            <span>
              Finding mechanics who specialize in <strong>{(dtcContext.description || dtcInfo?.name || dtcContext.code).toLowerCase()}</strong> near you
              <span className="mech-dx-banner__code"> · {dtcContext.code}</span>
            </span>
            <button
              className="mech-dx-banner__dismiss"
              onClick={() => setDismissedBanner(true)}
              aria-label="Dismiss fault code banner"
            >×</button>
          </div>
        )}

        {/* ── Diagnosis context banner ── */}
        {hasDiagnosis && !dtcContext && hasCoords && !dismissedBanner && (
          <div className="mech-dx-banner" role="status">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
            </svg>
            <span>Showing shops that can fix: <strong>{diagnosisName}</strong></span>
            <button
              className="mech-dx-banner__dismiss"
              onClick={() => setDismissedBanner(true)}
              aria-label="Dismiss diagnosis banner"
            >×</button>
          </div>
        )}

        {/* ── Quick service filter chips (no diagnosis context) ── */}
        {showFilterChips && (
          <div className="mech-filter-chips-block">
            <p className="mech-filter-chips-label">What do you need help with?</p>
            <div className="mech-filter-chips" role="group" aria-label="Service type filter">
              {SERVICE_FILTERS.map(f => (
                <button
                  key={f}
                  className={`mech-filter-chip${serviceFilter === f ? ' mech-filter-chip--active' : ''}`}
                  onClick={() => setServiceFilter(prev => prev === f ? null : f)}
                  aria-pressed={serviceFilter === f}
                  type="button"
                >
                  {f}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Error state ── */}
        {error && (
          <div className="mech-error" role="alert">
            <span>{error}</span>
            <button onClick={() => lat != null && lon != null && doSearch(lat, lon, radiusKm)}>
              Retry
            </button>
          </div>
        )}

        {/* ── Loading skeletons ── */}
        {loading && (
          <>
            <div style={{ marginBottom: 12 }}>
              <div className="mech-skeleton mech-skeleton--section-title" />
            </div>
            <NearbySkeleton /><NearbySkeleton /><NearbySkeleton /><NearbySkeleton />
            <p className="mech-loading-hint">Finding shops near you…</p>
          </>
        )}

        {/* ── Results: single unified list of real shops (EA-style cards) ── */}
        {!loading && shops && (
          <>
            {displayShops.length > 0 && (
              <div className="mech-section" aria-labelledby="mech-shops-heading">
                {embedded ? (
                  <div className="autoshop-header">
                    <p className="autoshop-header__sub">Find the best-rated mechanics near you</p>
                  </div>
                ) : (
                  <h2 className="mech-section-title mech-section-title--nearby" id="mech-shops-heading">
                    Auto Shops Near You
                    <span className="mech-section-title__count">{displayShops.length}</span>
                  </h2>
                )}

                {/* Sort control */}
                <div className="autoshop-sort" role="group" aria-label="Sort shops">
                  <span className="autoshop-sort__label">Sort by:</span>
                  {SHOP_SORTS.map(s => (
                    <button
                      key={s.key}
                      className={`autoshop-sort__btn${shopSort === s.key ? ' autoshop-sort__btn--active' : ''}`}
                      onClick={() => setShopSort(s.key)}
                      aria-pressed={shopSort === s.key}
                      type="button"
                    >
                      {s.label}
                    </button>
                  ))}
                </div>

                {displayShops.map(shop => (
                  <ShopPlayerCard
                    key={shop.id}
                    shop={shop}
                    isExpanded={expandedShopId === shop.id}
                    onSelect={() => setExpandedShopId(prev => prev === shop.id ? null : shop.id)}
                    onSendDiagnosis={handleSendDiagnosis}
                    hasDiagnosis={!!effectiveDiagnosis}
                  />
                ))}
              </div>
            )}

            {/* ── Empty ── */}
            {displayShops.length === 0 && hasCoords && (
              <div className="mech-empty">
                <div className="mech-empty__icon">🔧</div>
                <p className="mech-empty__title">No shops found within {radiusKm} km</p>
                <p className="mech-empty__sub">Try increasing your search radius</p>
                <button className="mech-empty__btn" onClick={() => setShowFilter(true)}>
                  Adjust Search Radius
                </button>
              </div>
            )}

            {/* ── Gold "Own a Shop?" CTA ── */}
            <div className="mech-own-shop-cta">
              <div className="mech-own-shop-cta__star" aria-hidden="true">✦</div>
              <h3 className="mech-own-shop-cta__title">Own a Shop?</h3>
              <p className="mech-own-shop-cta__sub">
                Join FixIt AI and get customers sent directly to you.
              </p>
              <button
                className="mech-own-shop-cta__btn"
                onClick={() => { setInquiryPreFill(''); setShowInquiry(true); }}
                type="button"
              >
                Apply to Partner →
              </button>
            </div>
          </>
        )}

        <div style={{ height: 40 }} />
      </div>

      {/* ── Bottom sheets ── */}
      {showFilter && (
        <FilterSheet
          radiusKm={radiusKm}
          sortBy={sortBy}
          onApply={applyFilters}
          onClose={() => setShowFilter(false)}
        />
      )}
      {showInquiry && (
        <InquiryModal
          preFillName={inquiryPreFill}
          onClose={() => setShowInquiry(false)}
        />
      )}
      {sendSheet && (
        <SendDiagnosisSheet
          shop={sendSheet.shop}
          message={sendSheet.message}
          onClose={() => setSendSheet(null)}
        />
      )}
    </div>
  );
}
