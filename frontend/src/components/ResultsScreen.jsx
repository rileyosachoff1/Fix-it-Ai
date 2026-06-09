import { useState } from 'react';
import './ResultsScreen.css';

// ── Helpers ────────────────────────────────────────────────────────────────────
function urgencyLabel(u) {
  if (u === 'urgent')        return { text: 'URGENT',        cls: 'badge--urgent' };
  if (u === 'schedule_soon') return { text: 'SCHEDULE SOON', cls: 'badge--warn'   };
  return                            { text: 'MONITOR',       cls: 'badge--ok'     };
}

// SVG confidence dial — circle radius 28, circumference ≈ 175.9
const CIRC = 2 * Math.PI * 28;

function ConfidenceDial({ value }) {
  const pct    = Math.max(0, Math.min(100, value ?? 0));
  const offset = CIRC - (pct / 100) * CIRC;
  const color  = pct >= 75 ? 'var(--success)' : pct >= 50 ? 'var(--warning)' : 'var(--danger)';
  return (
    <div className="res__dial-wrap" aria-label={`${pct}% confidence`}>
      <svg width="68" height="68" viewBox="0 0 68 68" fill="none" aria-hidden="true">
        <circle cx="34" cy="34" r="28" stroke="#2a2a2a" strokeWidth="6" />
        <circle
          cx="34" cy="34" r="28"
          stroke={color}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={CIRC}
          strokeDashoffset={offset}
          transform="rotate(-90 34 34)"
          style={{ transition: 'stroke-dashoffset 0.8s ease' }}
        />
      </svg>
      <div className="res__pct" style={{ color }}>{pct}%</div>
    </div>
  );
}

// Likelihood dot for causes
function LikelihoodDot({ level }) {
  const cls = level === 'high' ? 'pip--high' : level === 'medium' ? 'pip--med' : 'pip--low';
  return <span className={`pip ${cls}`} aria-label={level} />;
}

// ── Primary card ───────────────────────────────────────────────────────────────
// Uses backend schema: soundDescription, causes[{issue,likelihood,explanation}],
// estimatedCost{min,max}, ifIgnored, recommendedAction
function PrimaryCard({ d }) {
  const badge = urgencyLabel(d.urgency);
  return (
    <div className="res__card res__card--primary">
      {/* Top row: title + dial */}
      <div className="res__card-top">
        <div className="res__card-title-col">
          <span className="res__card-label">PRIMARY DIAGNOSIS</span>
          <h2 className="res__diagnosis">{d.diagnosis}</h2>
          <span className={`badge ${badge.cls}`}>{badge.text}</span>
        </div>
        <ConfidenceDial value={d.confidence} />
      </div>

      {/* Sound/visual description */}
      {d.soundDescription && (
        <p className="res__sound-desc">{d.soundDescription}</p>
      )}

      {/* Causes */}
      {d.causes?.length > 0 && (
        <div className="res__causes-block">
          <h3 className="res__detail-label">POSSIBLE CAUSES</h3>
          <ol className="res__causes">
            {d.causes.map((c, i) => (
              <li key={i} className="res__cause-item">
                <div className="res__cause-header">
                  <span className="res__cause-rank">{i + 1}</span>
                  <span className="res__cause-name">{c.issue}</span>
                  <LikelihoodDot level={c.likelihood} />
                  <span className={`res__likelihood res__likelihood--${c.likelihood}`}>{c.likelihood}</span>
                </div>
                {c.explanation && (
                  <p className="res__cause-exp">{c.explanation}</p>
                )}
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* Footer: cost + recommended action + if-ignored */}
      <div className="res__card-footer">
        {d.estimatedCost && (
          <div className="res__cost-row">
            <span className="res__cost-label">EST. REPAIR COST</span>
            <span className="res__cost-range">
              ${d.estimatedCost.min?.toLocaleString()}–${d.estimatedCost.max?.toLocaleString()}
            </span>
          </div>
        )}

        {d.recommendedAction && (
          <div className="res__action-row">
            <span className="res__action-icon">🔧</span>
            <p className="res__action-text">{d.recommendedAction}</p>
          </div>
        )}

        {d.ifIgnored && (
          <div className="res__if-ignored">
            <span className="res__if-ignored-label">⚠️ IF IGNORED</span>
            <span className="res__if-ignored-text">{d.ifIgnored}</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Alternative card ───────────────────────────────────────────────────────────
// Uses: diagnosis, confidence, explanation, estimatedCost{min,max}, ruleOut
function AltCard({ d, index }) {
  return (
    <div className="res__alt-card" style={{ animationDelay: index === 0 ? '0.2s' : '0.35s' }}>
      <div className="res__alt-card__header">
        <span className="res__alt-name">{d.diagnosis}</span>
        <span className="res__alt-conf">{d.confidence ?? '—'}%</span>
      </div>
      {d.explanation && (
        <p className="res__alt-explanation">{d.explanation}</p>
      )}
      <div className="res__alt-footer">
        {d.estimatedCost && (
          <span className="res__alt-cost">
            ${d.estimatedCost.min?.toLocaleString()}–${d.estimatedCost.max?.toLocaleString()}
          </span>
        )}
        {d.ruleOut && (
          <span className="res__alt-ruleout">🔍 {d.ruleOut}</span>
        )}
      </div>
    </div>
  );
}

// ── Mechanic section ──────────────────────────────────────────────────────────
function MechanicSection({ location, diagnosisName, onSetLocation }) {
  const [localLoc, setLocalLoc] = useState('');

  // Extract first part of location for button label (e.g. "Toronto" from "Toronto, ON")
  const cityLabel = location ? location.split(',')[0].trim() : null;
  const mapsUrl = location
    ? `https://www.google.com/maps/search/auto+repair+shop+near+${encodeURIComponent(location)}`
    : null;

  function handleInlineFind(e) {
    e.preventDefault();
    if (!localLoc.trim()) return;
    onSetLocation(localLoc.trim());
  }

  return (
    <div className="res__mechanic">
      <h2 className="res__section-label">FIND A MECHANIC NEAR YOU</h2>

      {location ? (
        <div className="res__mechanic-cta">
          <div className="res__mechanic-cta-header">
            <span className="res__mechanic-cta-icon">📍</span>
            <div>
              <h3 className="res__mechanic-cta-title">Get this fixed today</h3>
              <p className="res__mechanic-cta-desc">
                Based on your diagnosis ({diagnosisName}), we recommend getting this inspected by a certified mechanic.
              </p>
            </div>
          </div>
          <a
            href={mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="res__mechanic-btn"
          >
            🗺️ Find Repair Shops Near {cityLabel}
          </a>
          <p className="res__mechanic-coming-soon">
            FixIt AI partner shops coming soon — they'll be highlighted when available
          </p>
        </div>
      ) : (
        <div className="res__mechanic-prompt">
          <p className="res__mechanic-prompt-text">Add your location to find mechanics near you</p>
          <form className="res__mechanic-prompt-form" onSubmit={handleInlineFind}>
            <input
              className="res__mechanic-prompt-input"
              type="text"
              placeholder="City or address — e.g. Toronto, ON"
              value={localLoc}
              onChange={e => setLocalLoc(e.target.value)}
              aria-label="Your location"
            />
            <button className="res__mechanic-prompt-btn" type="submit">Find →</button>
          </form>
        </div>
      )}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function ResultsScreen({ diagnosis: d, onDiagnoseAgain, onSetLocation }) {
  // Support both new { primary, alternatives } format and old flat format
  const primary      = d.primary ?? d;
  const alternatives = d.alternatives ?? [];

  const vehicleLabel = d.vehicleInfo?.make
    ? [d.vehicleInfo.year, d.vehicleInfo.make, d.vehicleInfo.model].filter(Boolean).join(' ')
    : null;

  return (
    <div className="res">
      {/* Meta bar: vehicle + visual badge */}
      {(vehicleLabel || d.hasVisualMedia) && (
        <div className="res__meta-bar">
          {vehicleLabel && (
            <span className="res__vehicle-for">🚗 Diagnosis for: <strong>{vehicleLabel}</strong></span>
          )}
          {d.hasVisualMedia && (
            <span className="res__visual-badge">📷 Visual analysis included</span>
          )}
        </div>
      )}

      <div className="res__scroll">
        {/* Primary card — animates in first */}
        <div className="res__primary-wrap">
          <PrimaryCard d={primary} />
        </div>

        {/* Alternative diagnoses — staggered */}
        {alternatives.length > 0 && (
          <div className="res__alt-section">
            <div className="res__alt-divider">
              <div className="res__alt-divider-line" />
              <span className="res__alt-section-label">ALTERNATIVES</span>
              <div className="res__alt-divider-line" />
            </div>
            <p className="res__alt-context">
              We're confident in our primary diagnosis. These alternatives are worth ruling out.
            </p>
            <div className="res__alt-cards">
              {alternatives.map((alt, i) => (
                <AltCard key={i} d={alt} index={i} />
              ))}
            </div>
          </div>
        )}

        {/* Mechanic finder */}
        <MechanicSection
          location={d.location}
          diagnosisName={primary.diagnosis}
          onSetLocation={onSetLocation}
        />

        {/* Diagnose again */}
        <div className="res__actions-bar">
          <button className="res__btn-again" onClick={onDiagnoseAgain}>
            🎙️ Diagnose Again
          </button>
        </div>

        <p className="res__disclaimer">
          AI diagnosis is for reference only. Always consult a qualified mechanic before making repair decisions.
        </p>
      </div>
    </div>
  );
}
