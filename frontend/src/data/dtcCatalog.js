// ── DTC catalog ───────────────────────────────────────────────────────────────
// Single source of truth for OBD2 fault-code metadata: plain-English name,
// severity bucket, and likely causes. Used by AlertsTab, LiveTab, the alert
// generator, and the health score.
// ─────────────────────────────────────────────────────────────────────────────

export const DTC_CATALOG = {
  // Air / fuel metering
  P0100: { name: 'Mass Air Flow Sensor Circuit Malfunction', severity: 'warning', cause: 'Dirty or failing MAF sensor, wiring damage, air leak after the sensor' },
  P0101: { name: 'Mass Air Flow Sensor Range/Performance', severity: 'warning', cause: 'Contaminated MAF element, intake leak, restricted air filter' },
  P0102: { name: 'Mass Air Flow Sensor Circuit Low Input', severity: 'warning', cause: 'MAF sensor failure, wiring short to ground, clogged air filter' },
  P0103: { name: 'Mass Air Flow Sensor Circuit High Input', severity: 'warning', cause: 'MAF sensor failure, wiring short to power' },
  P0110: { name: 'Intake Air Temperature Sensor Malfunction', severity: 'info', cause: 'Faulty IAT sensor or connector corrosion' },
  P0111: { name: 'Intake Air Temperature Sensor Range/Performance', severity: 'info', cause: 'Faulty IAT sensor, heat soak, wiring resistance' },
  P0112: { name: 'Intake Air Temperature Sensor Circuit Low', severity: 'info', cause: 'IAT sensor shorted to ground, faulty sensor' },
  P0113: { name: 'Intake Air Temperature Sensor Circuit High', severity: 'info', cause: 'IAT sensor open circuit, unplugged connector' },
  P0115: { name: 'Engine Coolant Temperature Sensor Malfunction', severity: 'warning', cause: 'Faulty ECT sensor, low coolant, wiring fault' },
  P0117: { name: 'Engine Coolant Temperature Sensor Circuit Low', severity: 'warning', cause: 'ECT sensor shorted, faulty sensor' },
  P0118: { name: 'Engine Coolant Temperature Sensor Circuit High', severity: 'warning', cause: 'ECT sensor open circuit, low coolant level' },
  P0121: { name: 'Throttle Position Sensor Range/Performance', severity: 'warning', cause: 'Worn TPS, dirty throttle body, wiring fault' },
  P0122: { name: 'Throttle Position Sensor Circuit Low Input', severity: 'warning', cause: 'TPS shorted to ground, faulty sensor' },
  P0123: { name: 'Throttle Position Sensor Circuit High Input', severity: 'warning', cause: 'TPS shorted to power, faulty sensor' },
  P0125: { name: 'Insufficient Coolant Temp for Closed Loop', severity: 'info', cause: 'Thermostat stuck open, faulty coolant temp sensor' },
  P0128: { name: 'Coolant Temp Below Thermostat Regulating Temp', severity: 'info', cause: 'Thermostat stuck open, coolant temp sensor issue' },

  // O2 sensors
  P0130: { name: 'O2 Sensor Circuit Malfunction (B1S1)', severity: 'warning', cause: 'Aged O2 sensor, exhaust leak, wiring fault' },
  P0131: { name: 'O2 Sensor Circuit Low Voltage (B1S1)', severity: 'warning', cause: 'Failing O2 sensor, vacuum leak causing lean mixture' },
  P0132: { name: 'O2 Sensor Circuit High Voltage (B1S1)', severity: 'warning', cause: 'Failing O2 sensor, rich fuel mixture, contaminated sensor' },
  P0133: { name: 'O2 Sensor Slow Response (B1S1)', severity: 'warning', cause: 'Aged O2 sensor, exhaust leak, contaminated sensor element' },
  P0134: { name: 'O2 Sensor No Activity (B1S1)', severity: 'warning', cause: 'Dead O2 sensor, blown heater fuse, wiring damage' },
  P0135: { name: 'O2 Sensor Heater Circuit (B1S1)', severity: 'warning', cause: 'Failed sensor heater element, blown fuse, wiring fault' },
  P0140: { name: 'O2 Sensor No Activity (B1S2)', severity: 'info', cause: 'Dead downstream O2 sensor, wiring damage' },
  P0141: { name: 'O2 Sensor Heater Circuit (B1S2)', severity: 'info', cause: 'Failed downstream sensor heater, blown fuse' },

  // Fuel trim
  P0171: { name: 'System Too Lean (Bank 1)', severity: 'warning', cause: 'Vacuum leak, dirty MAF sensor, low fuel pressure, failing O2 sensor' },
  P0172: { name: 'System Too Rich (Bank 1)', severity: 'warning', cause: 'Leaking fuel injector, faulty MAF or coolant temp sensor' },
  P0174: { name: 'System Too Lean (Bank 2)', severity: 'warning', cause: 'Vacuum leak, dirty MAF sensor, low fuel pressure' },
  P0175: { name: 'System Too Rich (Bank 2)', severity: 'warning', cause: 'Leaking injector, fuel pressure regulator, MAF fault' },
  P0200: { name: 'Fuel Injector Circuit Malfunction', severity: 'critical', cause: 'Injector wiring fault, failed injector driver, bad injector coil' },

  // Misfires
  P0300: { name: 'Random/Multiple Cylinder Misfire', severity: 'critical', cause: 'Worn spark plugs, ignition coil, injector issue, low compression' },
  P0301: { name: 'Cylinder 1 Misfire Detected', severity: 'critical', cause: 'Worn spark plug, ignition coil, injector, or compression issue' },
  P0302: { name: 'Cylinder 2 Misfire Detected', severity: 'critical', cause: 'Worn spark plug, ignition coil, injector, or compression issue' },
  P0303: { name: 'Cylinder 3 Misfire Detected', severity: 'critical', cause: 'Worn spark plug, ignition coil, injector, or compression issue' },
  P0304: { name: 'Cylinder 4 Misfire Detected', severity: 'critical', cause: 'Worn spark plug, ignition coil, injector, or compression issue' },
  P0305: { name: 'Cylinder 5 Misfire Detected', severity: 'critical', cause: 'Worn spark plug, ignition coil, injector, or compression issue' },
  P0306: { name: 'Cylinder 6 Misfire Detected', severity: 'critical', cause: 'Worn spark plug, ignition coil, injector, or compression issue' },

  // Position / knock sensors
  P0325: { name: 'Knock Sensor 1 Circuit (Bank 1)', severity: 'warning', cause: 'Failed knock sensor, wiring fault, loose sensor' },
  P0335: { name: 'Crankshaft Position Sensor Circuit', severity: 'critical', cause: 'Faulty crank sensor, wiring issue, damaged tone ring' },
  P0340: { name: 'Camshaft Position Sensor Circuit (Bank 1)', severity: 'critical', cause: 'Faulty cam sensor, wiring issue, reluctor wheel damage' },

  // EGR / exhaust
  P0400: { name: 'EGR Flow Malfunction', severity: 'warning', cause: 'Clogged EGR passages, stuck EGR valve, vacuum fault' },
  P0401: { name: 'EGR Insufficient Flow', severity: 'warning', cause: 'Carbon-clogged EGR valve or passages, weak vacuum signal' },
  P0420: { name: 'Catalyst System Efficiency Below Threshold (B1)', severity: 'warning', cause: 'Worn catalytic converter, exhaust leak, failing O2 sensor' },
  P0430: { name: 'Catalyst System Efficiency Below Threshold (B2)', severity: 'warning', cause: 'Worn catalytic converter, exhaust leak, failing O2 sensor' },

  // EVAP
  P0440: { name: 'EVAP System Malfunction', severity: 'info', cause: 'Loose fuel cap, cracked EVAP hose, purge valve fault' },
  P0441: { name: 'EVAP Incorrect Purge Flow', severity: 'info', cause: 'Stuck purge valve, blocked purge line' },
  P0442: { name: 'EVAP System Small Leak', severity: 'info', cause: 'Small crack in EVAP line, loose fuel cap seal' },
  P0446: { name: 'EVAP Vent Control Circuit', severity: 'info', cause: 'Stuck vent valve, blocked vent filter, wiring fault' },
  P0455: { name: 'EVAP System Large Leak', severity: 'info', cause: 'Loose/missing fuel cap, cracked EVAP hose, faulty purge valve' },
  P0456: { name: 'EVAP System Very Small Leak', severity: 'info', cause: 'Pinhole leak in EVAP line, fuel cap seal wear' },

  // Misc
  P0480: { name: 'Cooling Fan 1 Control Circuit', severity: 'warning', cause: 'Failed fan motor, relay, or wiring — watch for overheating' },
  P0500: { name: 'Vehicle Speed Sensor Malfunction', severity: 'warning', cause: 'Failed VSS, wiring damage, instrument cluster fault' },
  P0505: { name: 'Idle Control System Malfunction', severity: 'warning', cause: 'Dirty or faulty IAC valve, vacuum leak' },
  P0562: { name: 'System Voltage Low', severity: 'warning', cause: 'Weak battery, failing alternator, corroded battery terminals' },
  P0563: { name: 'System Voltage High', severity: 'warning', cause: 'Faulty voltage regulator, alternator overcharging' },
};

const FALLBACK = { name: 'Fault code detected', severity: 'warning', cause: 'Connect OBD2 scanner for detailed diagnosis' };

export function getDtcInfo(code) {
  return DTC_CATALOG[code] || FALLBACK;
}

/** Map a DTC to the shop-service category used by MechanicScreen filters. */
export function getDtcServiceCategory(code) {
  const c = String(code || '');
  if (/^P03/.test(c)) return 'Engine';
  if (/^P042|^P043/.test(c)) return 'Exhaust';
  if (/^P056/.test(c)) return 'Electrical';
  if (/^P01[01]/.test(c) || /^P017/.test(c)) return 'Engine';
  return 'Full Inspection';
}
