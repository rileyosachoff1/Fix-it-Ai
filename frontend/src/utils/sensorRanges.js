// ── Live sensor normal ranges ─────────────────────────────────────────────────
// Per-PID healthy/watch ranges plus plain-English meanings for the Live tab.
// rateReading() → 'ok' | 'warn' | 'bad' | null (null = no rating for this key).

export const SENSOR_RANGES = {
  rpm: {
    label: 'RPM',
    meaning: 'Engine speed. A healthy warm idle sits between 600-900 RPM for most gasoline engines.',
    rate(v, { speed = 0 } = {}) {
      if (v == null) return null;
      if (speed > 5) return 'ok'; // only rate idle quality when stationary
      if (v >= 600 && v <= 900) return 'ok';
      if (v > 900 && v <= 1200) return 'warn';
      if (v >= 450 && v < 600) return 'warn';
      return v === 0 ? null : 'bad';
    },
    meanings: {
      ok: 'Idling smoothly in the normal 600-900 RPM band.',
      warn: 'Idle is outside the typical band — could be a cold engine, vacuum leak, or idle control issue.',
      bad: 'Idle speed is far from normal. Have the idle control and vacuum system checked.',
    },
  },
  coolantTemp: {
    label: 'Coolant',
    meaning: 'Engine coolant temperature. Normal operating range is 85-105°C once warmed up.',
    rate(v) {
      if (v == null) return null;
      if (v >= 85 && v <= 105) return 'ok';
      if (v > 105 && v <= 110) return 'warn';
      if (v > 110) return 'bad';
      if (v >= 70) return 'warn'; // warming up
      return 'warn'; // cold — not an immediate fault
    },
    meanings: {
      ok: 'Engine is at normal operating temperature (85-105°C).',
      warn: 'Below normal temperature — engine may still be warming up, or the thermostat is stuck open.',
      bad: 'Running hot (>110°C). Risk of overheating — check coolant level and fans.',
    },
  },
  batteryVoltage: {
    label: 'Battery',
    meaning: 'Charging system voltage. 13.7-14.7V is normal while running; 12.4-12.7V with the engine off.',
    rate(v, { running = true } = {}) {
      if (v == null) return null;
      if (running) {
        if (v >= 13.7 && v <= 14.7) return 'ok';
        if (v >= 13.2 && v < 13.7) return 'warn';
        if (v > 14.7 && v <= 15.2) return 'warn';
        return 'bad';
      }
      if (v >= 12.4 && v <= 12.9) return 'ok';
      if (v >= 12.0 && v < 12.4) return 'warn';
      return 'bad';
    },
    meanings: {
      ok: 'Charging system is healthy.',
      warn: 'Voltage is slightly off — battery may be aging or the alternator is working hard.',
      bad: 'Voltage out of range — weak battery or a charging system fault. Get it tested.',
    },
  },
  engineLoad: {
    label: 'Engine Load',
    meaning: 'How hard the engine is working. 15-25% is normal at idle.',
    rate(v, { speed = 0 } = {}) {
      if (v == null) return null;
      if (speed > 5) return 'ok'; // load varies legitimately while driving
      if (v <= 30) return 'ok';
      if (v <= 50) return 'warn';
      return 'bad';
    },
    meanings: {
      ok: 'Load is in the normal range.',
      warn: 'Higher than expected at idle — AC and accessories can cause this, but keep an eye on it.',
      bad: 'Very high load at idle suggests misfires, restricted airflow, or a parasitic drag.',
    },
  },
  fuelTrimST: {
    label: 'Fuel Trim ST',
    meaning: 'Short-term fuel correction. ±5% is normal; beyond ±10% the ECU is compensating for a problem.',
    rate(v) {
      if (v == null) return null;
      const a = Math.abs(v);
      if (a <= 8) return 'ok';
      if (a <= 15) return 'warn';
      return 'bad';
    },
    meanings: {
      ok: 'Fuel mixture corrections are small and healthy.',
      warn: 'The ECU is correcting noticeably — possible small vacuum leak or aging sensors.',
      bad: 'Large fuel corrections — likely vacuum leak, MAF fault, or fuel delivery issue.',
    },
  },
  fuelTrimLT: {
    label: 'Fuel Trim LT',
    meaning: 'Long-term fuel correction. Positive = running lean, negative = running rich.',
    rate(v) {
      if (v == null) return null;
      const a = Math.abs(v);
      if (a <= 8) return 'ok';
      if (a <= 15) return 'warn';
      return 'bad';
    },
    meanings: {
      ok: 'Long-term mixture is balanced.',
      warn: 'The engine has been trending lean or rich — worth checking at next service.',
      bad: 'Sustained lean/rich running — check for vacuum leaks, MAF sensor, or fuel pressure.',
    },
  },
  throttle: {
    label: 'Throttle',
    meaning: 'Throttle plate opening. Around 10-15% at idle on most drive-by-wire engines.',
    rate(v, { speed = 0 } = {}) {
      if (v == null) return null;
      if (speed > 5) return 'ok';
      if (v <= 20) return 'ok';
      if (v <= 35) return 'warn';
      return 'bad';
    },
    meanings: {
      ok: 'Throttle position is normal.',
      warn: 'Slightly high at idle — throttle body may need cleaning.',
      bad: 'Throttle far open at idle — possible throttle body or idle control fault.',
    },
  },
  maf: {
    label: 'MAF',
    meaning: 'Mass air flow into the engine. Roughly 2-7 g/s at idle for most 4-cylinders.',
    rate(v, { speed = 0 } = {}) {
      if (v == null) return null;
      if (speed > 5) return 'ok';
      if (v >= 1.5 && v <= 9) return 'ok';
      if (v < 1.5 || v <= 14) return 'warn';
      return 'bad';
    },
    meanings: {
      ok: 'Airflow reading is in the expected idle range.',
      warn: 'Airflow slightly off — a dirty MAF sensor or small intake leak can cause this.',
      bad: 'Airflow reading is abnormal — MAF sensor or intake system needs inspection.',
    },
  },
  intakeTemp: {
    label: 'Intake Temp',
    meaning: 'Temperature of air entering the engine. Tracks ambient; heat-soak after a stop is normal.',
    rate(v) {
      if (v == null) return null;
      if (v >= -30 && v <= 60) return 'ok';
      if (v <= 80) return 'warn';
      return 'bad';
    },
    meanings: {
      ok: 'Intake air temperature is normal.',
      warn: 'Running warm — common in traffic; sustained high temps reduce performance.',
      bad: 'Intake air is very hot — check for a stuck sensor or heat management problem.',
    },
  },
  o2Voltage: {
    label: 'O2 Sensor',
    meaning: 'Oxygen sensor voltage. Should cycle between 0.1-0.9V in closed loop; stuck high or low signals a problem.',
    rate(v) {
      if (v == null) return null;
      if (v >= 0.1 && v <= 0.9) return 'ok';
      return 'bad';
    },
    meanings: {
      ok: 'O2 sensor is reading within its normal cycling range.',
      warn: 'O2 voltage near the edge of its range.',
      bad: 'O2 sensor stuck high or low — sensor failure or a fuel mixture problem.',
    },
  },
  speed: {
    label: 'Speed',
    meaning: 'Vehicle speed from the ECU.',
    rate() { return null; },
    meanings: {},
  },
};

/** Rate a reading: 'ok' | 'warn' | 'bad' | null. ctx can carry { speed, running }. */
export function rateReading(key, value, ctx = {}) {
  const def = SENSOR_RANGES[key];
  if (!def) return null;
  return def.rate(value, ctx);
}

/** Plain-English explanation for a reading's current status. */
export function readingMeaning(key, status) {
  const def = SENSOR_RANGES[key];
  if (!def) return null;
  return (status && def.meanings[status]) || def.meaning;
}
