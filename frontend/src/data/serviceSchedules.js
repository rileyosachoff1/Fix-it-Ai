// ── Vehicle-specific service schedules ───────────────────────────────────────
// All intervals stored in km. UI converts to mi via kmToDisplay() helper.
// ─────────────────────────────────────────────────────────────────────────────

export const DEFAULT_SCHEDULE = {
  oil:               { intervalKm: 8000,   intervalMonths: 6,   label: 'Oil Change',          icon: '🛢' },
  tires:             { intervalKm: 10000,  intervalMonths: 6,   label: 'Tire Rotation',        icon: '🔄' },
  brakes:            { intervalKm: 70000,  intervalMonths: null, label: 'Brakes',              icon: '⛔' },
  airFilter:         { intervalKm: 30000,  intervalMonths: 24,  label: 'Air Filter',           icon: '💨' },
  cabinFilter:       { intervalKm: 20000,  intervalMonths: 12,  label: 'Cabin Filter',         icon: '🌬️' },
  battery:           { intervalKm: 80000,  intervalMonths: 48,  label: 'Battery',              icon: '🔋' },
  coolant:           { intervalKm: 150000, intervalMonths: 60,  label: 'Coolant Flush',        icon: '🌡️' },
  sparkPlugs:        { intervalKm: 160000, intervalMonths: null, label: 'Spark Plugs',         icon: '⚡' },
  transmissionFluid: { intervalKm: 80000,  intervalMonths: 48,  label: 'Trans. Fluid',         icon: '⚙️' },
  serpentineBelt:    { intervalKm: 100000, intervalMonths: null, label: 'Serpentine Belt',     icon: '🔧' },
};

// ── Per-vehicle overrides ─────────────────────────────────────────────────────
// null = remove item from schedule (e.g. EVs have no oil change)
// object = merge/override specific fields
const VEHICLE_SCHEDULES = {
  // ── EVs — remove ICE-specific services ──
  'Tesla|Model 3':        { oil: null, sparkPlugs: null, serpentineBelt: null, transmissionFluid: null, coolant: { intervalKm: 200000 } },
  'Tesla|Model Y':        { oil: null, sparkPlugs: null, serpentineBelt: null, transmissionFluid: null, coolant: { intervalKm: 200000 } },
  'Tesla|Model S':        { oil: null, sparkPlugs: null, serpentineBelt: null, transmissionFluid: null, coolant: { intervalKm: 200000 } },
  'Tesla|Model X':        { oil: null, sparkPlugs: null, serpentineBelt: null, transmissionFluid: null, coolant: { intervalKm: 200000 } },
  'Chevrolet|Bolt EV':    { oil: null, sparkPlugs: null, serpentineBelt: null, transmissionFluid: null },
  'Ford|Mustang Mach-E':  { oil: null, sparkPlugs: null, serpentineBelt: null, transmissionFluid: null },
  'Hyundai|IONIQ 5':      { oil: null, sparkPlugs: null, serpentineBelt: null, transmissionFluid: null },
  'Kia|EV6':              { oil: null, sparkPlugs: null, serpentineBelt: null, transmissionFluid: null },
  'Rivian|R1T':           { oil: null, sparkPlugs: null, serpentineBelt: null, transmissionFluid: null },
  'Rivian|R1S':           { oil: null, sparkPlugs: null, serpentineBelt: null, transmissionFluid: null },

  // ── Performance — shorter oil intervals ──
  'BMW|M3':               { oil: { intervalKm: 6000, intervalMonths: 6 }, sparkPlugs: { intervalKm: 30000 } },
  'BMW|M4':               { oil: { intervalKm: 6000, intervalMonths: 6 }, sparkPlugs: { intervalKm: 30000 } },
  'BMW|M5':               { oil: { intervalKm: 6000, intervalMonths: 6 }, sparkPlugs: { intervalKm: 30000 } },
  'BMW|M8':               { oil: { intervalKm: 6000, intervalMonths: 6 }, sparkPlugs: { intervalKm: 30000 } },
  'Porsche|911':          { oil: { intervalKm: 10000, intervalMonths: 12 }, sparkPlugs: { intervalKm: 40000 } },
  'Porsche|Cayenne':      { oil: { intervalKm: 10000, intervalMonths: 12 } },
  'Dodge|Challenger':     { oil: { intervalKm: 8000, intervalMonths: 6 } },
  'Dodge|Charger':        { oil: { intervalKm: 8000, intervalMonths: 6 } },
  'Subaru|WRX':           { oil: { intervalKm: 5000, intervalMonths: 4 } },
  'Subaru|BRZ':           { oil: { intervalKm: 6000, intervalMonths: 6 } },

  // ── Standard — override specific intervals ──
  'Toyota|Camry':         { oil: { intervalKm: 10000, intervalMonths: 12 } },
  'Toyota|Corolla':       { oil: { intervalKm: 10000, intervalMonths: 12 } },
  'Toyota|Tacoma':        { oil: { intervalKm: 8000, intervalMonths: 6 } },
  'Toyota|4Runner':       { oil: { intervalKm: 8000, intervalMonths: 6 } },
  'Honda|Civic':          { oil: { intervalKm: 8000, intervalMonths: 6 } },
  'Honda|Accord':         { oil: { intervalKm: 8000, intervalMonths: 6 } },
  'Honda|CR-V':           { oil: { intervalKm: 8000, intervalMonths: 6 } },
  'Ford|F-150':           { oil: { intervalKm: 10000, intervalMonths: 12 } },
  'Ford|Mustang':         { oil: { intervalKm: 8000, intervalMonths: 6 }, sparkPlugs: { intervalKm: 60000 } },
  'Chevrolet|Silverado':  { oil: { intervalKm: 12000, intervalMonths: 12 } },
  'Chevrolet|Camaro':     { oil: { intervalKm: 8000, intervalMonths: 6 }, sparkPlugs: { intervalKm: 60000 } },

  // ── Diesel — no spark plugs ──
  'Volkswagen|Jetta TDI': { oil: { intervalKm: 10000, intervalMonths: 12 }, sparkPlugs: null },
  'Volkswagen|Golf TDI':  { oil: { intervalKm: 10000, intervalMonths: 12 }, sparkPlugs: null },
  'Ram|1500 EcoDiesel':   { oil: { intervalKm: 12000, intervalMonths: 12 }, sparkPlugs: null },
};

// ── Merge base schedule with vehicle-specific overrides ───────────────────────
/**
 * Get the service schedule for a specific vehicle.
 * @param {string} make  - e.g. "Honda"
 * @param {string} model - e.g. "Civic"
 * @returns {Record<string, {intervalKm:number, intervalMonths:number|null, label:string, icon:string}>}
 */
export function getScheduleForVehicle(make, model) {
  const base      = DEFAULT_SCHEDULE;
  const overrides = (make && model) ? (VEHICLE_SCHEDULES[`${make}|${model}`] || {}) : {};
  const result    = {};

  for (const [key, val] of Object.entries(base)) {
    if (key in overrides) {
      if (overrides[key] === null) continue; // explicitly removed
      result[key] = { ...val, ...overrides[key] };
    } else {
      result[key] = val;
    }
  }

  return result;
}
