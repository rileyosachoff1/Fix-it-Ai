// ── Alert generator ───────────────────────────────────────────────────────────
// Builds the unified alert list for the Alerts tab and the tab-bar unread dot.
// Sources: OBD2 fault codes (red), overdue maintenance (orange), NHTSA recalls
// (yellow), unresolved recent diagnoses (blue).
// Ids are stable so "seen" tracking survives re-renders and reloads.

import { getDtcInfo } from '../data/dtcCatalog.js';

const DAY_MS = 86_400_000;

export function generateAlerts({ faultCodes = [], maintenanceDue = [], recalls = [], recentDiagnoses = [] } = {}) {
  const alerts = [];

  // 1. OBD2 fault codes → red
  for (const fc of faultCodes) {
    const info = getDtcInfo(fc.code);
    alerts.push({
      id: `dtc:${fc.code}`,
      type: 'dtc',
      severity: 'danger',
      title: fc.code,
      body: fc.description || info.name,
      detail: info.cause,
      data: fc,
    });
  }

  // 2. Overdue maintenance → orange
  for (const item of maintenanceDue) {
    if (item.status !== 'overdue') continue;
    alerts.push({
      id: `maint:${item.key}`,
      type: 'maintenance',
      severity: 'warning',
      title: `${item.label} overdue`,
      body: item.kmRemaining != null
        ? `${Math.abs(item.kmRemaining).toLocaleString()} km past the recommended interval`
        : 'Past the recommended service interval',
      detail: `Due at ${item.dueAtKm?.toLocaleString()} km`,
      data: item,
    });
  }

  // 3. NHTSA recalls → yellow
  for (const r of recalls) {
    const id = r.nhtsaNumber || r.component || JSON.stringify(r).slice(0, 40);
    alerts.push({
      id: `recall:${id}`,
      type: 'recall',
      severity: 'recall',
      title: 'Open Recall',
      body: r.component || 'Safety recall',
      detail: truncateSentences(r.summary, 2),
      data: r,
    });
  }

  // 4. Unresolved diagnoses (last 30 days, urgent/schedule_soon) → blue
  const cutoff = Date.now() - 30 * DAY_MS;
  for (const d of recentDiagnoses) {
    const t = new Date(d.recordedAt || 0).getTime();
    const urgency = d.primary?.urgency;
    if (t < cutoff || (urgency !== 'urgent' && urgency !== 'schedule_soon')) continue;
    alerts.push({
      id: `diag:${d.id}`,
      type: 'diagnosis',
      severity: 'info',
      title: d.primary?.diagnosis || 'AI diagnosis',
      body: urgency === 'urgent' ? 'Urgent — needs attention now' : 'Schedule a repair soon',
      detail: d.primary?.recommendedAction || null,
      data: d,
    });
  }

  return alerts;
}

export function truncateSentences(text, n = 2) {
  if (!text) return null;
  const parts = String(text).match(/[^.!?]+[.!?]+/g);
  if (!parts) return text;
  return parts.slice(0, n).join(' ').trim();
}
