// ── Unit helpers ──────────────────────────────────────────────────────────────
// Shared km/mi conversion + formatting (extracted from MaintenanceTab).

export function kmToDisplay(km, unit) {
  if (km == null || isNaN(km)) return 0;
  return unit === 'mi' ? Math.round(km * 0.621371) : Math.round(km);
}

export function odoToKm(odo, unit) {
  if (!odo || isNaN(odo)) return 0;
  return unit === 'mi' ? Math.round(odo * 1.60934) : Math.round(odo);
}

export function formatInterval(km, unit) {
  const val = kmToDisplay(km, unit);
  return `${val >= 1000 ? (val / 1000).toFixed(val % 1000 === 0 ? 0 : 1) + 'k' : val} ${unit}`;
}

export function formatKm(km) {
  if (km == null || isNaN(km)) return '—';
  return `${Math.round(km).toLocaleString()} km`;
}
