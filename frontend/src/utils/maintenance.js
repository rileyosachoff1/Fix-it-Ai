// ── Maintenance due calculator ────────────────────────────────────────────────
// Computes upcoming/overdue services from the user's logged schedule state and
// the vehicle-specific schedule (which already filters EV-irrelevant items).
// Used by MaintenanceTab ("Maintenance Due"), the health score, and alerts.

const DUE_SOON_KM = 3000;

/**
 * @param scheduleState  App state: { key: { lastDate, lastKm, intervalKm, label } }
 * @param vehicleSchedule getScheduleForVehicle() output: { key: { intervalKm, label, icon } }
 * @param currentOdoKm   Current odometer in km (0 if unknown)
 * @returns [{ key, label, icon, status, dueAtKm, kmRemaining, intervalKm, lastKm, lastDate }]
 *   status: 'overdue' | 'due_soon' | 'ok' | 'unlogged'
 *   Sorted: overdue first, then due_soon by km remaining, then ok, then unlogged.
 */
export function computeMaintenanceDue(scheduleState, vehicleSchedule, currentOdoKm) {
  const items = [];
  for (const [key, vItem] of Object.entries(vehicleSchedule || {})) {
    const logged = scheduleState?.[key] || {};
    const intervalKm = logged.intervalKm ?? vItem.intervalKm;
    const lastKm = logged.lastKm ?? null;

    if (lastKm == null || !currentOdoKm) {
      items.push({ key, label: vItem.label, icon: vItem.icon, status: 'unlogged', dueAtKm: null, kmRemaining: null, intervalKm, lastKm, lastDate: logged.lastDate ?? null });
      continue;
    }

    const dueAtKm = lastKm + intervalKm;
    const kmRemaining = dueAtKm - currentOdoKm;
    const status = kmRemaining < 0 ? 'overdue' : kmRemaining <= DUE_SOON_KM ? 'due_soon' : 'ok';
    items.push({ key, label: vItem.label, icon: vItem.icon, status, dueAtKm, kmRemaining, intervalKm, lastKm, lastDate: logged.lastDate ?? null });
  }

  const rank = { overdue: 0, due_soon: 1, ok: 2, unlogged: 3 };
  items.sort((a, b) => (rank[a.status] - rank[b.status]) || ((a.kmRemaining ?? Infinity) - (b.kmRemaining ?? Infinity)));
  return items;
}

/** Km driven past the oil-change due point (0 if not overdue / not tracked). */
export function oilOverdueKm(maintenanceDue) {
  const oil = (maintenanceDue || []).find(i => i.key === 'oil');
  if (!oil || oil.status !== 'overdue' || oil.kmRemaining == null) return 0;
  return Math.abs(oil.kmRemaining);
}
