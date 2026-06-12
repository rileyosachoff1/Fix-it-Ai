import { useEffect, useState } from 'react';
import { healthTier } from '../../utils/healthScore.js';

/**
 * Speedometer-style circular health gauge.
 * 270° sweep arc (gap at the bottom), animates from 0 to score on mount.
 *
 * Props: score (0-100), size (px, default 120), showLabel (default true)
 */
export default function HealthGauge({ score = 0, size = 120, showLabel = true }) {
  // Mount at 0, then transition to the real score so the arc animates filling
  const [animatedScore, setAnimatedScore] = useState(0);
  useEffect(() => {
    const id = requestAnimationFrame(() => setAnimatedScore(score));
    return () => cancelAnimationFrame(id);
  }, [score]);

  const strokeW = Math.max(6, Math.round(size * 0.07));
  const r       = (size - strokeW) / 2;
  const C       = 2 * Math.PI * r;
  const SWEEP   = 0.75; // 270° of the circle
  const trackLen = C * SWEEP;
  const pct      = Math.max(0, Math.min(100, animatedScore)) / 100;
  const fillLen  = trackLen * pct;

  const color = score >= 75 ? 'var(--success)' : score >= 50 ? 'var(--warning)' : 'var(--danger)';
  const { label } = healthTier(score);

  const center = size / 2;
  const numberSize = Math.round(size * 0.34);
  const labelSize  = Math.max(8, Math.round(size * 0.085));

  return (
    <div
      className="health-gauge"
      style={{ width: size, height: size, flexShrink: 0 }}
      role="img"
      aria-label={`Vehicle health ${score} out of 100 — ${label}`}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* Track + fill share the same rotation: 270° sweep starting bottom-left */}
        <g transform={`rotate(135 ${center} ${center})`}>
          <circle
            cx={center} cy={center} r={r}
            fill="none"
            stroke="var(--border)"
            strokeWidth={strokeW}
            strokeLinecap="round"
            strokeDasharray={`${trackLen} ${C}`}
          />
          <circle
            cx={center} cy={center} r={r}
            fill="none"
            stroke={color}
            strokeWidth={strokeW}
            strokeLinecap="round"
            strokeDasharray={`${fillLen} ${C}`}
            style={{ transition: 'stroke-dasharray 1s cubic-bezier(0.4, 0, 0.2, 1), stroke 0.4s ease' }}
          />
        </g>
        <text
          x={center} y={showLabel ? center + numberSize * 0.18 : center + numberSize * 0.35}
          textAnchor="middle"
          fontSize={numberSize}
          fontWeight="700"
          letterSpacing="-0.02em"
          fill="var(--text-primary)"
          fontFamily="Inter, sans-serif"
        >
          {score}
        </text>
        {showLabel && (
          <text
            x={center} y={center + numberSize * 0.18 + labelSize * 1.6}
            textAnchor="middle"
            fontSize={labelSize}
            fontWeight="700"
            letterSpacing="0.08em"
            fill="var(--text-tertiary)"
            fontFamily="Inter, sans-serif"
          >
            {label.toUpperCase()}
          </text>
        )}
      </svg>
    </div>
  );
}
