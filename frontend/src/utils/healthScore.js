// ── Vehicle health score ──────────────────────────────────────────────────────
// Single home for the 0-100 health score shown on Home and Live tabs.
//
// OBD2 connected:  start at 100; weight fault codes (stored -20, pending -10,
//                  capped) and penalize out-of-range live sensor readings.
// Not connected:   start at 85; subtract for overdue maintenance, unresolved
//                  recent diagnoses, and km driven past the oil interval.

const DAY_MS = 86_400_000;
const UNRESOLVED_WINDOW_DAYS = 30;

function clamp(v) { return Math.max(0, Math.min(100, Math.round(v))); }

export function countUnresolvedDiagnoses(recentDiagnoses) {
  const cutoff = Date.now() - UNRESOLVED_WINDOW_DAYS * DAY_MS;
  return (recentDiagnoses || []).filter(d => {
    const t = new Date(d.recordedAt || 0).getTime();
    const urgency = d.primary?.urgency;
    return t >= cutoff && (urgency === 'urgent' || urgency === 'schedule_soon');
  }).length;
}

export function computeHealthScore({
  obd2Connected = false,
  faultCodes = [],
  liveData = null,
  maintenanceDue = [],
  recentDiagnoses = [],
  oilOverKm = 0,
} = {}) {
  if (obd2Connected) {
    let s = 100;

    // Fault codes: stored -20, pending -10, capped at -60 total
    let dtcPenalty = 0;
    for (const fc of faultCodes) {
      dtcPenalty += (fc.type === 'pending' || fc.pending) ? 10 : 20;
    }
    s -= Math.min(dtcPenalty, 60);

    // Live sensor readings vs normal ranges
    if (liveData) {
      if (liveData.coolantTemp > 108) s -= 15;
      else if (liveData.coolantTemp > 0 && liveData.coolantTemp < 60) s -= 8;
      if (liveData.batteryVoltage) {
        if (liveData.batteryVoltage < 12.0 || liveData.batteryVoltage > 15.5) s -= 10;
        else if (liveData.batteryVoltage < 12.4) s -= 5;
      }
      if (Math.abs(liveData.fuelTrimLT || 0) > 20) s -= 5;
      if ((liveData.engineLoad || 0) > 80 && (liveData.speed || 0) === 0) s -= 8;
    }
    return clamp(s);
  }

  // Offline: maintenance + diagnosis history based estimate
  let s = 85;
  const overdue = (maintenanceDue || []).filter(i => i.status === 'overdue').length;
  s -= overdue * 5;
  s -= countUnresolvedDiagnoses(recentDiagnoses) * 10;
  s -= Math.floor((oilOverKm || 0) / 500);
  return clamp(s);
}

/** Tier label + semantic color for a score. Colors follow the spec bands:
 *  85-100 green, 65-84 yellow, 0-64 red. */
export function healthTier(score) {
  const color = score >= 85 ? 'var(--success)' : score >= 65 ? 'var(--warning)' : 'var(--danger)';
  const colorKey = score >= 85 ? 'success' : score >= 65 ? 'warning' : 'danger';
  const label =
    score >= 90 ? 'Excellent' :
    score >= 75 ? 'Good' :
    score >= 60 ? 'Fair' :
    score >= 40 ? 'Needs Attention' : 'Critical';
  return { label, color, colorKey };
}
