import { useMemo } from 'react';

const START_DEG = 135;  // from 12 o'clock, clockwise
const SWEEP     = 270;  // total arc sweep degrees

/** Convert angle (from 12 o'clock, clockwise) to SVG x/y */
function polar(cx, cy, r, deg) {
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

/** Build SVG arc path string */
function arcPath(cx, cy, r, a1, a2) {
  const delta = a2 - a1;
  if (Math.abs(delta) < 0.01) return '';
  const s   = polar(cx, cy, r, a1);
  const e   = polar(cx, cy, r, a2);
  const la  = delta > 180 ? 1 : 0;
  return `M${s.x.toFixed(2)},${s.y.toFixed(2)} A${r},${r},0,${la},1,${e.x.toFixed(2)},${e.y.toFixed(2)}`;
}

/**
 * CircularGauge — premium SVG arc gauge
 *
 * Props:
 *  value         – current reading
 *  min           – minimum (default 0)
 *  max           – maximum
 *  unit          – label below value (e.g. "RPM", "°C")
 *  label         – bottom caption (e.g. "Engine Speed")
 *  size          – viewBox size in px (default 200)
 *  warnPct       – 0–1 fraction where warning colour starts (default 0.7)
 *  dangerPct     – 0–1 fraction where danger colour starts (default 0.88)
 *  formatValue   – optional (v) => string formatter
 *  majorEvery    – step between major ticks (default: auto)
 *  labelEvery    – step between labelled ticks (default: 2×major)
 *  customColor   – override arc colour regardless of pct
 *  showTicks     – show tick marks (default true)
 *  dimmed        – dim the gauge (no data state)
 */
export default function CircularGauge({
  value = 0,
  min   = 0,
  max   = 100,
  unit  = '',
  label = '',
  size  = 200,
  warnPct   = 0.7,
  dangerPct = 0.88,
  formatValue,
  majorEvery,
  labelEvery,
  customColor,
  showTicks = true,
  dimmed    = false,
}) {
  const cx = size / 2;
  const cy = size / 2;
  const r  = size * 0.36;          // arc radius
  const sw = size * 0.065;         // stroke width

  const pct = Math.max(0, Math.min(1, (value - min) / (max - min)));
  const endAngle = START_DEG + SWEEP;

  // Value arc endpoint (tiny minimum so linecap shows even at 0)
  const valueAngle = START_DEG + Math.max(0.001, pct) * SWEEP;

  // Colour
  const arcColor = customColor
    ? customColor
    : pct >= dangerPct ? 'var(--danger)'
    : pct >= warnPct  ? 'var(--warning)'
    : 'var(--accent)';

  // Formatted display value
  const display = formatValue
    ? formatValue(value)
    : (Number.isFinite(value) ? Math.round(value) : '--');

  // ── Tick marks ─────────────────────────────────────────────────────────────
  const range   = max - min;
  const rawMajor = majorEvery ?? (range <= 20 ? 5 : range <= 100 ? 20 : range <= 500 ? 100 : 1000);
  const rawLabel = labelEvery ?? rawMajor * 2;

  const ticks = useMemo(() => {
    if (!showTicks) return [];
    const arr = [];
    for (let v = min; v <= max + 0.0001; v += rawMajor) {
      const rounded = Math.round(v * 1000) / 1000;
      const a = START_DEG + ((rounded - min) / range) * SWEEP;
      arr.push({ v: rounded, angle: a, major: true });
    }
    // minor ticks (half-step)
    const minor = rawMajor / 2;
    for (let v = min + minor; v <= max - minor + 0.0001; v += rawMajor) {
      const rounded = Math.round(v * 1000) / 1000;
      const a = START_DEG + ((rounded - min) / range) * SWEEP;
      arr.push({ v: rounded, angle: a, major: false });
    }
    return arr;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [min, max, rawMajor, showTicks]);

  const outerMajor = r + sw * 0.65;
  const innerMajor = r + sw * 0.12;
  const outerMinor = r + sw * 0.5;
  const innerMinor = r + sw * 0.12;
  const labelR     = r + sw * 1.4;

  // Needle angle for CSS rotate
  const needleAngle = START_DEG + pct * SWEEP;

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      style={{ display: 'block', opacity: dimmed ? 0.4 : 1, transition: 'opacity 0.3s' }}
      aria-label={`${label}: ${display} ${unit}`}
    >
      {/* ── Track background ── */}
      <path
        d={arcPath(cx, cy, r, START_DEG, endAngle)}
        fill="none"
        stroke="rgba(255,255,255,0.07)"
        strokeWidth={sw}
        strokeLinecap="round"
      />

      {/* ── Zone tints (faint background coloring) ── */}
      <path
        d={arcPath(cx, cy, r, START_DEG + warnPct * SWEEP, endAngle)}
        fill="none"
        stroke="rgba(255,71,87,0.12)"
        strokeWidth={sw}
        strokeLinecap="butt"
      />
      <path
        d={arcPath(cx, cy, r, START_DEG + (warnPct - 0.12) * SWEEP, START_DEG + warnPct * SWEEP)}
        fill="none"
        stroke="rgba(255,179,0,0.10)"
        strokeWidth={sw}
        strokeLinecap="butt"
      />

      {/* ── Value arc ── */}
      {pct > 0.001 && (
        <path
          d={arcPath(cx, cy, r, START_DEG, valueAngle)}
          fill="none"
          stroke={arcColor}
          strokeWidth={sw}
          strokeLinecap="round"
          style={{ filter: `drop-shadow(0 0 6px ${arcColor})`, transition: 'stroke 0.3s' }}
        />
      )}

      {/* ── Tick marks ── */}
      {showTicks && ticks.map(tick => {
        const op = polar(cx, cy, tick.major ? outerMajor : outerMinor, tick.angle);
        const ip = polar(cx, cy, tick.major ? innerMajor : innerMinor, tick.angle);
        return (
          <line
            key={tick.v}
            x1={op.x.toFixed(2)} y1={op.y.toFixed(2)}
            x2={ip.x.toFixed(2)} y2={ip.y.toFixed(2)}
            stroke={tick.major ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.15)'}
            strokeWidth={tick.major ? 1.5 : 1}
          />
        );
      })}

      {/* ── Tick labels (only at labelEvery intervals) ── */}
      {showTicks && ticks.filter(t => t.major && (Math.round((t.v - min) / rawMajor) % (rawLabel / rawMajor) === 0)).map(tick => {
        const lp = polar(cx, cy, labelR, tick.angle);
        const display2 = tick.v >= 1000 ? `${Math.round(tick.v / 1000)}k` : String(Math.round(tick.v));
        return (
          <text
            key={`lbl-${tick.v}`}
            x={lp.x.toFixed(2)} y={lp.y.toFixed(2)}
            textAnchor="middle" dominantBaseline="middle"
            fontSize={size * 0.065} fill="var(--text-muted)"
            fontFamily="Inter, sans-serif" fontWeight="500"
          >
            {display2}
          </text>
        );
      })}

      {/* ── Needle ── */}
      <g transform={`translate(${cx}, ${cy})`}>
        <g style={{
          transform: `rotate(${needleAngle}deg)`,
          transition: 'transform 0.35s cubic-bezier(0.34,1.56,0.64,1)',
        }}>
          {/* Needle shaft pointing upward */}
          <line
            x1="0" y1={-(r * 0.78)}
            x2="0" y2={r * 0.14}
            stroke="rgba(255,255,255,0.9)" strokeWidth={Math.max(1.5, size * 0.009)} strokeLinecap="round"
          />
          {/* Needle tip accent */}
          <circle cx="0" cy={-(r * 0.72)} r={Math.max(2, size * 0.015)} fill={arcColor} />
        </g>
        {/* Center hub */}
        <circle r={size * 0.038} fill="var(--bg-elevated)" stroke="var(--text-muted)" strokeWidth="1.5"/>
        <circle r={size * 0.018} fill="var(--text-muted)"/>
      </g>

      {/* ── Center text ── */}
      <text
        x={cx} y={cy - size * 0.06}
        textAnchor="middle" dominantBaseline="auto"
        fontSize={size * 0.18} fontWeight="700" fill="white"
        fontFamily="Inter, sans-serif"
        style={{ transition: 'fill 0.3s' }}
      >
        {display}
      </text>
      <text
        x={cx} y={cy + size * 0.10}
        textAnchor="middle" dominantBaseline="hanging"
        fontSize={size * 0.085} fill="var(--text-secondary)"
        fontFamily="Inter, sans-serif" fontWeight="500"
        letterSpacing="0.5"
      >
        {unit}
      </text>

      {/* ── Bottom label ── */}
      {label && (
        <text
          x={cx} y={size * 0.93}
          textAnchor="middle" dominantBaseline="auto"
          fontSize={size * 0.065} fill="var(--text-muted)"
          fontFamily="Inter, sans-serif" fontWeight="500"
          letterSpacing="0.5"
        >
          {label.toUpperCase()}
        </text>
      )}
    </svg>
  );
}
