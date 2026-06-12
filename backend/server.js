'use strict';
require('dotenv').config();

const express  = require('express');
const cors     = require('cors');
const fs       = require('fs');
const path     = require('path');
const https    = require('https');
const Anthropic = require('@anthropic-ai/sdk');
const { getSpecsForVehicle } = require('./data/vehicleSpecs.js');

const app  = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: ['http://localhost:5173', 'http://127.0.0.1:5173'] }));
// 25 MB — large enough for 3 photos + 6 video frames in base64
app.use(express.json({ limit: '25mb' }));

// ── System prompt ─────────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are an expert automotive mechanic and diagnostic specialist with 25+ years of hands-on experience. You excel at both acoustic diagnosis (identifying problems from sounds) and visual inspection (diagnosing from photos or video). You have serviced every major make and model and are fluent in OEM technical service bulletins.

You will receive one or more of the following inputs:
  1. Structured acoustic analysis report(s) derived from real microphone recordings — there may be multiple (parked, in motion, steering test)
  2. The vehicle's year, make, and model (optional but highly useful)
  3. Detailed factory specifications for the exact vehicle, including engine, oil spec, maintenance intervals, and known common issues (optional)
  4. Odometer reading and maintenance history context (optional)
  5. A description from the driver (optional)
  6. Photos and/or video frames from the vehicle (optional)

Analyze ALL provided information holistically and return a ranked differential diagnosis.

MULTIPLE RECORDING CONTEXT (when provided):
  Multiple recordings reveal how the sound changes across conditions — this is highly diagnostic:
  - Parked recording captures baseline engine/accessory noise
  - In-motion recording reveals wheel bearing, tire, CV joint, and drivetrain noise
  - Steering test recording is highly specific to CV axle, ball joint, and power steering issues
  - If noise exists in motion but NOT parked → almost certainly drivetrain/wheel/tire
  - If noise exists in steering test → strong indicator of outer CV joint or ball joint
  - Combine all recordings to narrow the differential and increase confidence

CRITICAL: Return ONLY a raw JSON object. No markdown, no code fences, no text before or after. Must be directly parseable by JSON.parse().

REQUIRED JSON STRUCTURE:
{
  "primary": {
    "diagnosis": "Most likely diagnosis — specific component/issue name (e.g. 'Worn Serpentine Belt', 'Failing Front Left Wheel Bearing')",
    "confidence": <integer 0–100>,
    "urgency": "urgent" | "schedule_soon" | "monitor",
    "soundDescription": "2–3 sentences describing the acoustic and/or visual evidence that points to this diagnosis",
    "causes": [
      { "issue": "Primary root cause", "likelihood": "high", "explanation": "Mechanical explanation of how this creates the observed symptoms" },
      { "issue": "Contributing factor or variant", "likelihood": "medium", "explanation": "Explanation" },
      { "issue": "Less likely cause", "likelihood": "low", "explanation": "Explanation" }
    ],
    "estimatedCost": { "min": <integer CAD>, "max": <integer CAD>, "currency": "CAD" },
    "ifIgnored": "Specific mechanical consequence if not addressed — what breaks next and when",
    "recommendedAction": "Clear, specific, actionable guidance for the driver",
    "whyThis": "1–2 plain-English sentences explaining why this diagnosis fits THIS vehicle and the evidence provided",
    "repairTimeHours": { "min": <number>, "max": <number> },
    "diyDifficulty": "easy" | "moderate" | "hard",
    "commonForVehicle": "1 sentence if this is a known/common issue for this exact year/make/model (mention the vehicle and mileage), otherwise null"
  },
  "alternatives": [
    {
      "diagnosis": "Second most likely diagnosis",
      "confidence": <integer 0–100>,
      "explanation": "Exactly 2 sentences: (1) why this could produce the observed symptoms, (2) how to distinguish it from the primary diagnosis",
      "estimatedCost": { "min": <integer CAD>, "max": <integer CAD>, "currency": "CAD" },
      "ruleOut": "One specific, simple test or observation the driver or mechanic can perform to confirm or eliminate this possibility"
    },
    {
      "diagnosis": "Third possibility",
      "confidence": <integer 0–100>,
      "explanation": "Exactly 2 sentences as above",
      "estimatedCost": { "min": <integer CAD>, "max": <integer CAD>, "currency": "CAD" },
      "ruleOut": "One specific test or observation"
    }
  ]
}

CONFIDENCE CALIBRATION:
  85–97 → Acoustic/visual signature is highly distinctive and unambiguous
  65–84 → Strong match but differential diagnosis applies; alternatives worth ruling out
  40–64 → Data is limited or ambiguous; diagnosis is the most probable explanation
  15–39 → Insufficient data; returning best guess from available evidence

URGENCY DEFINITIONS:
  urgent        → Safety risk; vehicle should not be driven; tow to mechanic immediately
  schedule_soon → Limit driving; schedule shop visit within 1–2 weeks
  monitor       → Not critical; address at next service interval or within 1–3 months

VEHICLE-SPECIFIC GUIDANCE (use when year/make/model is provided):
  - Reference known TSBs and common failure patterns for that exact vehicle
  - Adjust cost estimates for that vehicle's parts/labor complexity
  - Note any model-specific quirks (e.g. Ford 5.4L 3-valve cam phasers, Subaru head gaskets, GM DOD lifters)

VEHICLE SPECIFICATIONS CONTEXT (when a VEHICLE SPECIFICATIONS block is provided):
  - Reason from the EXACT engine: e.g. "a knocking on a 1.5L turbocharged engine suggests..." — turbo engines, V8s with cylinder deactivation, CVTs, and boxer engines each have distinct failure signatures
  - If any listed COMMON ISSUE for this model matches the symptoms, prioritize it, raise confidence accordingly, and state the match in "commonForVehicle"
  - Use the odometer reading against the provided maintenance intervals: an overdue oil change, spark plugs past their interval, or high mileage shifts the differential (e.g. lifter tick on an engine 8,000 km past its oil change → check oil first)
  - Timing: if the vehicle uses a timing CHAIN, do not recommend belt replacement; if a BELT, factor its interval into the diagnosis
  - If the vehicle is an EV (isEV true), NEVER diagnose combustion components (oil, spark plugs, exhaust, belts) — focus on motors, bearings, coolant pumps, suspension, and 12V systems
  - Use the exact oil type/capacity in recommendations rather than generic advice

VISUAL ANALYSIS GUIDANCE (use when photos/frames are provided):
  - Look for fluid leaks, belt cracking, hose deterioration, corrosion
  - Note dashboard warning lights and their specific implications
  - Identify physical damage that correlates with acoustic data
  - Describe what you see and how it supports or modifies your acoustic diagnosis

ACOUSTIC PATTERN REFERENCE:
  Rhythmic deep knock 1–5 Hz, changes with RPM     → rod bearing knock (urgent), piston slap, wrist pin
  Rhythmic clicking at wheel speed                  → CV joint, wheel bearing, loose brake hardware
  High-pitched constant squeal from engine bay      → serpentine belt glazing, idler pulley bearing
  Squeal only when braking                          → brake pad wear indicators (schedule_soon)
  Metal grinding when braking                       → pads worn to metal, rotor damage (urgent)
  Low-frequency hum rising with vehicle speed       → wheel bearing, cupped tires
  Rattle at idle, disappears above ~1500 RPM        → heat shield, exhaust hanger, catalytic converter substrate
  Clunk over bumps, front end                       → ball joint, strut mount, sway bar end link
  Whine proportional to steering input              → power steering pump, rack-and-pinion
  Belt-area squeal worst on cold start              → serpentine belt, tensioner spring fatigue
  Valve train tick/chatter at idle                  → low oil level, sticky lifter, cam phaser (VVT)
  Ticking rhythmic with exhaust pulses              → exhaust manifold crack or gasket leak
  Clunk/pop on turns, FWD vehicle                   → outer CV joint (torn boot)
  Transmission whine in gear, quiet in neutral      → input shaft bearing, differential

OBD2 SCANNER DATA (when provided):
  Direct electronic readings from the vehicle's ECU via Bluetooth OBD2 scanner. Treat these as high-confidence ground truth:
  - Fault codes (DTCs) represent ECU-logged anomalies — weight them very heavily; they often confirm the diagnosis
  - Positive fuel trim (> +5%) = running lean; negative fuel trim (< -5%) = running rich
  - Coolant temperature after 5+ min of running: healthy = 85–105°C; below 70°C = stuck-open thermostat
  - Engine load at idle: 15–25% normal; above 35% suggests parasitic drain, misfires, or restricted airflow
  - Battery voltage: 13.5–14.8V normal while running; below 12.6V = charging system issue
  - O2 sensor voltage oscillating 0.1–0.9V = normal closed loop; stuck high/low = sensor failure or fuel problem
  - P0420/P0430 (catalyst efficiency) + high long-term fuel trim → suspect oxygen sensor first, then catalytic converter
  - P0171/P0174 (lean condition) → check vacuum leaks, MAF sensor, fuel pressure, clogged injectors
  - Misfire codes (P030x) + rough idle or RPM instability → spark plugs, ignition coils, injectors
  - P0128 (coolant below thermostat temp) → stuck-open thermostat (common on high-mileage vehicles)
  - When OBD2 data is present, correlate sensor values with acoustic evidence to maximize diagnostic accuracy

ALTERNATIVES MUST always contain exactly 2 entries.
CAUSES in primary MUST always contain exactly 3 entries.
The primary MUST always include whyThis, repairTimeHours, diyDifficulty, and commonForVehicle (null when not applicable).
All cost estimates MUST be in CANADIAN DOLLARS (CAD) and reflect average Canadian independent shop prices (labor + parts).
All distances MUST be expressed in kilometres, never miles.`;

// ── Mock diagnoses — new 3-diagnosis format ───────────────────────────────────
const MOCK_DIAGNOSES = [
  {
    primary: {
      diagnosis: 'Worn Serpentine Belt',
      confidence: 88,
      urgency: 'schedule_soon',
      soundDescription: 'High-pitched squealing detected from the engine accessory drive area, most pronounced under electrical load and varying directly with engine RPM. The intermittent character and humidity-sensitivity are classic signatures of a glazed or cracked serpentine belt surface losing grip on its pulleys.',
      causes: [
        { issue: 'Glazed/hardened serpentine belt', likelihood: 'high', explanation: 'Belt polymer surface hardens with age and heat cycles, losing friction coefficient — causes slip-squeal under any accessory load.' },
        { issue: 'Weak belt tensioner spring', likelihood: 'medium', explanation: 'Tensioner spring fatigues, allowing belt to oscillate under load and squeal intermittently, especially when AC compressor cycles on.' },
        { issue: 'Seized idler pulley bearing', likelihood: 'low', explanation: 'A binding idler bearing creates constant dragging squeal regardless of load or temperature.' },
      ],
      estimatedCost: { min: 160, max: 380, currency: 'CAD' },
      ifIgnored: 'Belt will eventually crack and snap, instantly disabling the alternator, power steering, water pump, and AC simultaneously — leaving you stranded and risking engine overheating within minutes.',
      recommendedAction: 'Schedule inspection within 1–2 weeks. Quick confirmation test: with engine running, briefly mist water onto the belt — if squeal intensifies then fades, belt is confirmed. Replace belt and inspect tensioner.',
      whyThis: 'The squeal rises and falls with engine RPM and worsens under accessory load — that pattern points to a slipping drive belt, not an internal engine problem.',
      repairTimeHours: { min: 0.5, max: 1 },
      diyDifficulty: 'moderate',
      commonForVehicle: null,
    },
    alternatives: [
      {
        diagnosis: 'Failing Belt Tensioner',
        confidence: 42,
        explanation: 'A fatiguing tensioner spring allows belt tension to fluctuate, producing nearly identical high-pitched squeal under varying loads. Unlike pure belt glazing, a tensioner issue often produces a rhythmic flutter visible on the tensioner arm while idling.',
        estimatedCost: { min: 110, max: 270, currency: 'CAD' },
        ruleOut: 'With engine running, watch the tensioner arm — if it oscillates or vibrates visibly, the tensioner is failing rather than the belt itself.',
      },
      {
        diagnosis: 'Alternator Bearing Whine',
        confidence: 22,
        explanation: 'A worn alternator front bearing can produce a sustained high-pitched whine that varies with RPM and increases under electrical load (headlights, AC). It differs from belt squeal in that it continues briefly after the engine is turned off.',
        estimatedCost: { min: 240, max: 610, currency: 'CAD' },
        ruleOut: 'Briefly disconnect the serpentine belt (engine off) and spin the alternator pulley by hand — roughness or grinding confirms a bad bearing.',
      },
    ],
  },
  {
    primary: {
      diagnosis: 'Failing Front Wheel Bearing',
      confidence: 91,
      urgency: 'schedule_soon',
      soundDescription: 'Low-frequency humming detected that increases proportionally with vehicle speed rather than engine RPM — the definitive acoustic signature of worn bearing rollers generating noise as the race surface deteriorates. The load-sensitivity (louder on turns) confirms the bearing is under differential load stress.',
      causes: [
        { issue: 'Worn wheel bearing hub assembly', likelihood: 'high', explanation: 'Bearing rollers develop flat spots or pitting in the race, creating a drone that increases with rotational speed.' },
        { issue: 'Cupped or feathered tire tread', likelihood: 'medium', explanation: 'Irregular tire wear from misalignment or worn shocks creates a similar speed-dependent hum that can mimic bearing noise.' },
        { issue: 'Loose or worn CV joint', likelihood: 'low', explanation: 'A worn inner CV joint can produce humming at certain speeds before advancing to the more characteristic clicking on turns.' },
      ],
      estimatedCost: { min: 240, max: 570, currency: 'CAD' },
      ifIgnored: 'Bearing will progress to complete failure — wheel wobble, then sudden seizure at speed causing loss of vehicle control. This is a safety-critical item.',
      recommendedAction: 'Isolate the axle: in a safe empty lot at ~30 km/h, sway gently left then right. If hum increases when weight shifts to one side, that wheel\'s bearing is confirmed. Book within 2 weeks.',
      whyThis: 'The hum scales with road speed (not engine RPM) and changes with cornering load — both classic markers of a worn hub bearing rather than tire or drivetrain noise.',
      repairTimeHours: { min: 1, max: 2 },
      diyDifficulty: 'hard',
      commonForVehicle: null,
    },
    alternatives: [
      {
        diagnosis: 'Cupped Rear Tires',
        confidence: 38,
        explanation: 'Worn shock absorbers allow tires to bounce at speed, creating cupped wear patterns that generate a rhythmic hum almost identical to wheel bearing noise. Unlike bearings, tire noise is less affected by lateral weight transfer during cornering.',
        estimatedCost: { min: 540, max: 1220, currency: 'CAD' },
        ruleOut: 'Run your hand across the tire tread — cupping feels like scalloped or uneven high/low spots across the tread blocks, clearly distinguishable from smooth wear.',
      },
      {
        diagnosis: 'Worn CV Axle (inner joint)',
        confidence: 18,
        explanation: 'An inner CV joint with deteriorated balls and cage can produce a low rumble under acceleration at certain speeds. Unlike a wheel bearing, this typically intensifies specifically during hard acceleration rather than being purely speed-dependent.',
        estimatedCost: { min: 200, max: 510, currency: 'CAD' },
        ruleOut: 'Note whether the hum increases specifically during acceleration (under load) — if so, inner CV joint is more likely than a bearing which hums constantly at speed.',
      },
    ],
  },
  {
    primary: {
      diagnosis: 'Outer CV Joint Failure',
      confidence: 94,
      urgency: 'schedule_soon',
      soundDescription: 'Sharp rhythmic clicking detected that intensifies specifically during turns — the textbook acoustic signature of a worn outer constant-velocity joint where the ball bearings are clicking through a damaged cage. The speed-proportional frequency confirms rotational origin.',
      causes: [
        { issue: 'Torn CV boot / dry outer CV joint', likelihood: 'high', explanation: 'Boot failure allows grease to escape and water/dirt to infiltrate — joint balls and race wear rapidly, producing progressive clicking.' },
        { issue: 'Worn inner CV joint', likelihood: 'medium', explanation: 'Inner joint deterioration typically produces clicking under hard acceleration rather than during turns, but can be confused with outer joint noise.' },
        { issue: 'Loose wheel bearing with play', likelihood: 'low', explanation: 'Excessive bearing preload loss causes clunking/clicking on tight turns but usually lacks the rhythmic, speed-proportional character of CV noise.' },
      ],
      estimatedCost: { min: 200, max: 510, currency: 'CAD' },
      ifIgnored: 'CV joint will disintegrate during a turn — vehicle becomes immediately undriveable. Risk of catastrophic axle shaft separation at highway speeds.',
      recommendedAction: 'Confirm by turning steering wheel full lock in a parking lot — clicking should be pronounced and rhythmic. Schedule CV axle half-shaft replacement within 2 weeks.',
      whyThis: 'Clicking that appears specifically while turning is the defining behaviour of a worn outer CV joint — very few other components produce that exact pattern.',
      repairTimeHours: { min: 1, max: 2.5 },
      diyDifficulty: 'hard',
      commonForVehicle: null,
    },
    alternatives: [
      {
        diagnosis: 'Loose Brake Hardware (anti-rattle clips)',
        confidence: 28,
        explanation: 'Loose or missing brake pad anti-rattle hardware creates a repetitive metallic clicking that can occur while driving, particularly noticeable during slow turns when weight shifts onto that corner. Unlike CV noise, it often occurs even when going straight over bumps.',
        estimatedCost: { min: 40, max: 160, currency: 'CAD' },
        ruleOut: 'Apply the brakes lightly while the clicking occurs — brake hardware noise almost always stops or changes when the pads are pressed against the rotor.',
      },
      {
        diagnosis: 'Worn Strut Mount Bearing',
        confidence: 15,
        explanation: 'A failing strut mount bearing (top of front strut) produces clicking and clunking during steering input as the bearing binds rather than pivoting smoothly. Unlike CV noise, it is most noticeable at low speeds and during parking maneuvers.',
        estimatedCost: { min: 200, max: 470, currency: 'CAD' },
        ruleOut: 'With vehicle stationary, turn the steering wheel lock-to-lock — strut mount noise occurs even at zero speed and can often be felt as a clunk in the steering column.',
      },
    ],
  },
  {
    primary: {
      diagnosis: 'Engine Rod Knock',
      confidence: 82,
      urgency: 'urgent',
      soundDescription: 'Deep, hollow metallic knocking detected that tracks directly with engine RPM — the most serious acoustic signal an engine can produce. The rhythmic, low-frequency impacts at twice per crankshaft revolution indicate a connecting rod bearing has lost its oil film and is making metal-to-metal contact with the crankshaft journal.',
      causes: [
        { issue: 'Worn connecting rod bearing', likelihood: 'high', explanation: 'Bearing shells wear or spin in their bore, clearance opens beyond oil film capacity — rod hammer-knocks against crankshaft journal at each rotation.' },
        { issue: 'Oil starvation / critically low oil level', likelihood: 'medium', explanation: 'Insufficient oil volume allows bearing surfaces to run dry. Check oil dipstick immediately — this is the first thing to rule out.' },
        { issue: 'Spun main bearing', likelihood: 'low', explanation: 'Main bearing failure produces a similar knock but is typically duller, heavier, and more consistent across the rev range than rod knock.' },
      ],
      estimatedCost: { min: 2000, max: 6100, currency: 'CAD' },
      ifIgnored: 'Connecting rod will punch through the engine block without warning — complete engine destruction. This can happen within kilometres or hours at highway speed. There is no recoverable outcome once it progresses.',
      recommendedAction: 'STOP DRIVING IMMEDIATELY. Turn engine off. Check oil level — if critically low, add oil before attempting to move the vehicle. Do not restart until inspected. Arrange a tow.',
      whyThis: 'A deep knock that tracks engine RPM exactly and persists when warm is the acoustic fingerprint of a rod bearing running metal-on-metal — the most urgent engine sound there is.',
      repairTimeHours: { min: 10, max: 25 },
      diyDifficulty: 'hard',
      commonForVehicle: null,
    },
    alternatives: [
      {
        diagnosis: 'Piston Slap',
        confidence: 35,
        explanation: 'Excessive piston-to-bore clearance creates a slapping knock similar to rod knock but typically loudest when cold and quieting within 60–90 seconds as the piston expands with heat. Rod knock worsens or stays consistent as the engine warms.',
        estimatedCost: { min: 1080, max: 4050, currency: 'CAD' },
        ruleOut: 'Note whether the knock is loudest at cold start and significantly quieter after 2 minutes of running — piston slap characteristically fades with warmup while rod knock persists.',
      },
      {
        diagnosis: 'Loose Timing Chain / VVT Cam Phaser Rattle',
        confidence: 25,
        explanation: 'A stretched timing chain or worn VVT cam phaser rattles loudly on cold start and can sound like deep knocking until oil pressure builds. Unlike rod knock, it is typically loudest in the first 2–3 seconds of startup and comes from the front/top of the engine.',
        estimatedCost: { min: 810, max: 3380, currency: 'CAD' },
        ruleOut: 'Listen for the knock specifically in the first 2 seconds of cold start — timing/phaser noise is almost always loudest in that window, then diminishes; rod knock builds or stays constant.',
      },
    ],
  },
  {
    primary: {
      diagnosis: 'Worn Brake Pads (Wear Indicator Contact)',
      confidence: 90,
      urgency: 'schedule_soon',
      soundDescription: 'High-pitched metallic squealing detected specifically correlated with braking events — the brake pad wear indicator tabs are intentionally contacting the rotor surface. This is a designed warning system signaling that pad material has reached minimum thickness.',
      causes: [
        { issue: 'Pad wear indicators contacting rotor', likelihood: 'high', explanation: 'Hardened steel tab stamped into each pad is calibrated to emit squealing when ~3mm of pad material remains — functioning exactly as designed.' },
        { issue: 'Glazed brake rotor surface', likelihood: 'medium', explanation: 'Rotor surface glaze from heat cycling or pad contamination causes sustained squeal even with adequate remaining pad thickness.' },
        { issue: 'Seized brake caliper slide pin', likelihood: 'low', explanation: 'Binding caliper prevents even pad release, causing one side to wear prematurely and squeal from uneven contact.' },
      ],
      estimatedCost: { min: 200, max: 510, currency: 'CAD' },
      ifIgnored: 'Pads will wear completely to metal backing plates — rotors will be scored and gouged, upgrading the repair from pad replacement to full brake job including rotors. Braking distance increases significantly.',
      recommendedAction: 'Schedule brake inspection within 1 week. If you hear grinding instead of squealing, the pads are already metal-on-metal — reduce driving immediately and book same-day.',
      whyThis: 'The squeal happens only while braking and stops when you release the pedal — exactly how the built-in pad wear indicators are designed to warn you.',
      repairTimeHours: { min: 1, max: 2 },
      diyDifficulty: 'moderate',
      commonForVehicle: null,
    },
    alternatives: [
      {
        diagnosis: 'Warped Brake Rotors',
        confidence: 40,
        explanation: 'Warped or scored rotor surfaces create a rhythmic pulsation and intermittent squeal during braking as the pad contacts high spots. Unlike pad wear noise, rotor noise often comes with a brake pedal vibration at the same rhythm as the squeal.',
        estimatedCost: { min: 270, max: 680, currency: 'CAD' },
        ruleOut: 'Feel the brake pedal for pulsation or vibration during moderate braking — a warped rotor creates a distinct rhythmic pulse in the pedal that worn pads alone do not.',
      },
      {
        diagnosis: 'Brake Dust Shield Interference',
        confidence: 18,
        explanation: 'A bent or corroded brake dust shield rubbing against the rotor creates a continuous metallic scraping or squealing that sounds like pad noise but is not load-dependent — it occurs while rolling even without braking.',
        estimatedCost: { min: 0, max: 110, currency: 'CAD' },
        ruleOut: 'Test whether the sound occurs while rolling without pressing the brake pedal — dust shield interference is constant while moving, while pad wear noise is almost exclusively present during braking.',
      },
    ],
  },
];

let mockIndex = 0;

// ── Build Claude message content ──────────────────────────────────────────────
function buildSpecsContext(vehicleSpecs, vehicleInfo, odometerKm, lastOilChangeKm) {
  if (!vehicleSpecs) return null;
  const sp = vehicleSpecs;
  const lines = ['VEHICLE SPECIFICATIONS (use these for accuracy):'];
  if (sp.engine) lines.push(`  Engine: ${sp.engine}`);
  if (sp.horsepower) lines.push(`  Power: ${sp.horsepower} hp @ ${sp.torque ?? '?'} ${sp.torqueUnit || 'lb-ft'} torque`);
  if (sp.transmission) lines.push(`  Transmission: ${sp.transmission}`);
  if (sp.drivetrain) lines.push(`  Drivetrain: ${sp.drivetrain}`);
  if (sp.fuelType) lines.push(`  Fuel: ${sp.fuelType}`);
  if (sp.isEV) lines.push(`  THIS IS AN ELECTRIC VEHICLE — no oil, spark plugs, belts, or exhaust components`);
  if (sp.isHybrid) lines.push(`  Hybrid powertrain`);
  if (sp.oilType) lines.push(`  Oil: ${sp.oilType}${sp.oilCapacity_L ? `, capacity ${sp.oilCapacity_L} L` : ''}`);
  if (sp.sparkPlugInterval_km) lines.push(`  Spark plug interval: ${sp.sparkPlugInterval_km.toLocaleString()} km`);
  if (sp.timingChain != null) lines.push(`  Timing: ${sp.timingChain ? 'chain (no scheduled replacement)' : 'belt (check replacement interval)'}`);
  if (sp.commonIssues?.length) lines.push(`  Common issues for this model: ${sp.commonIssues.join('; ')}`);
  if (sp.notes) lines.push(`  Notes: ${sp.notes}`);

  if (odometerKm) {
    const unit = vehicleInfo?.odometerUnit === 'mi' ? ' (converted from miles)' : '';
    lines.push(`  Odometer: ${Math.round(odometerKm).toLocaleString()} km${unit}`);
  }
  if (lastOilChangeKm != null && odometerKm) {
    const ago = Math.max(0, Math.round(odometerKm - lastOilChangeKm));
    lines.push(`  Last oil change: ${ago.toLocaleString()} km ago (at ${Math.round(lastOilChangeKm).toLocaleString()} km)`);
  } else if (!sp.isEV) {
    lines.push('  Last oil change: unknown');
  }
  return lines.join('\n');
}

function buildUserMessage({ audioDescription, vehicleInfo, vehicleSpecs, odometerKm, lastOilChangeKm, textDescription, images = [], videoFrames = [], additionalRecordings = [], obd2Data }) {
  const parts = ['=== VEHICLE DIAGNOSIS REQUEST ==='];

  if (vehicleInfo?.make) {
    const vehicleStr = [vehicleInfo.year, vehicleInfo.make, vehicleInfo.model].filter(Boolean).join(' ');
    const trimStr    = vehicleInfo.trim ? ` (${vehicleInfo.trim} trim)` : '';
    parts.push(`\nVEHICLE: ${vehicleStr}${trimStr}`);
  }

  // Specs sent by the client take priority; otherwise look up from local database
  const specs = vehicleSpecs
    || (vehicleInfo?.make ? getSpecsForVehicle(vehicleInfo.make, vehicleInfo.model, vehicleInfo.year, vehicleInfo.trim) : null);
  const specsContext = buildSpecsContext(specs, vehicleInfo, odometerKm, lastOilChangeKm);
  if (specsContext) parts.push(`\n${specsContext}`);

  // Primary recording — label it if additional recordings also exist
  if (additionalRecordings.length > 0) {
    parts.push(`\nAUDIO RECORDING 1 — PARKED / STATIONARY:\n${audioDescription}`);
    for (const [i, rec] of additionalRecordings.entries()) {
      const dur = rec.duration != null ? `${Number(rec.duration).toFixed(1)}s` : '?s';
      parts.push(`\nAUDIO RECORDING ${i + 2} — ${rec.label.toUpperCase()} (${dur}):\n${rec.description}`);
    }
  } else {
    parts.push(`\n${audioDescription}`);
  }

  if (textDescription?.trim()) {
    parts.push(`\nDRIVER'S DESCRIPTION:\n${textDescription.trim()}`);
  }

  // OBD2 sensor readings and fault codes
  if (obd2Data?.sensors) {
    const s = obd2Data.sensors;
    const lines = [];
    if (s.rpm            != null) lines.push(`  RPM: ${Math.round(s.rpm)}`);
    if (s.speed          != null) lines.push(`  Speed: ${s.speed} km/h`);
    if (s.coolantTemp    != null) lines.push(`  Coolant Temp: ${s.coolantTemp}°C`);
    if (s.engineLoad     != null) lines.push(`  Engine Load: ${s.engineLoad.toFixed(1)}%`);
    if (s.throttle       != null) lines.push(`  Throttle Position: ${s.throttle.toFixed(1)}%`);
    if (s.fuelTrimST     != null) lines.push(`  Short-Term Fuel Trim: ${s.fuelTrimST > 0 ? '+' : ''}${s.fuelTrimST.toFixed(1)}%`);
    if (s.fuelTrimLT     != null) lines.push(`  Long-Term Fuel Trim: ${s.fuelTrimLT > 0 ? '+' : ''}${s.fuelTrimLT.toFixed(1)}%`);
    if (s.maf            != null) lines.push(`  MAF: ${s.maf.toFixed(1)} g/s`);
    if (s.intakeTemp     != null) lines.push(`  Intake Air Temp: ${s.intakeTemp}°C`);
    if (s.batteryVoltage != null) lines.push(`  Battery Voltage: ${s.batteryVoltage.toFixed(1)}V`);
    if (s.o2Voltage      != null) lines.push(`  O2 Sensor Voltage: ${s.o2Voltage.toFixed(2)}V`);

    if (lines.length) {
      parts.push(`\nOBD2 SENSOR READINGS (live from vehicle ECU):\n${lines.join('\n')}`);
    }

    const dtcs = obd2Data.faultCodes || [];
    if (dtcs.length) {
      const codeLines = dtcs.map(c => `  ${c.code} (${c.type}): ${c.description}`);
      parts.push(`\nFAULT CODES (from vehicle ECU):\n${codeLines.join('\n')}`);
    } else {
      parts.push('\nFAULT CODES: None stored');
    }
  }

  const totalVisuals = images.length + videoFrames.length;
  if (totalVisuals > 0) {
    const vizParts = [];
    if (images.length)      vizParts.push(`${images.length} photo${images.length > 1 ? 's' : ''}`);
    if (videoFrames.length) vizParts.push(`${videoFrames.length} video frame${videoFrames.length > 1 ? 's' : ''}`);
    parts.push(`\nVISUAL EVIDENCE: ${vizParts.join(' and ')} are attached below. Analyze them and incorporate any visual findings into your diagnosis.`);
  }

  parts.push('\nReturn your diagnosis as a JSON object in the required format.');
  const text = parts.join('\n');

  // Text-only message
  if (totalVisuals === 0) return text;

  // Multi-modal message
  const content = [{ type: 'text', text }];
  for (const img of images) {
    content.push({ type: 'image', source: { type: 'base64', media_type: img.mediaType || 'image/jpeg', data: img.base64 } });
  }
  for (const frame of videoFrames) {
    content.push({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: frame } });
  }
  return content;
}

// ── Diagnose function ─────────────────────────────────────────────────────────
async function diagnoseWithClaude({ audioDescription, vehicleInfo, vehicleSpecs, odometerKm, lastOilChangeKm, textDescription, images, videoFrames, additionalRecordings, obd2Data }) {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey || !apiKey.trim()) {
    const mock = MOCK_DIAGNOSES[mockIndex % MOCK_DIAGNOSES.length];
    mockIndex++;
    await new Promise(r => setTimeout(r, 2000 + Math.random() * 1000));
    return mock;
  }

  const client  = new Anthropic({ apiKey });
  const content = buildUserMessage({ audioDescription, vehicleInfo, vehicleSpecs, odometerKm, lastOilChangeKm, textDescription, images, videoFrames, additionalRecordings, obd2Data });

  const message = await client.messages.create({
    model:      'claude-sonnet-4-6',
    max_tokens: 2000,
    system:     SYSTEM_PROMPT,
    messages:   [{ role: 'user', content }],
  });

  const text = message.content[0].text.trim();

  try {
    return JSON.parse(text);
  } catch {
    const m = text.match(/\{[\s\S]*\}/);
    if (m) return JSON.parse(m[0]);
    throw new Error('Claude returned non-JSON: ' + text.slice(0, 120));
  }
}

// ── Routes ────────────────────────────────────────────────────────────────────
app.get('/health', (_, res) => res.json({
  ok: true,
  aiEnabled: !!(process.env.ANTHROPIC_API_KEY?.trim()),
}));

// Keepalive ping (also wakes the Render instance from sleep)
app.get('/api/health', (_, res) => res.json({
  status: 'ok',
  mode: process.env.ANTHROPIC_API_KEY?.trim() ? 'live' : 'demo',
}));

app.post('/api/diagnose', async (req, res) => {
  try {
    const {
      description,                // primary audio analysis text (required)
      duration,
      vehicleInfo,                // { year, make, model } optional
      textDescription,            // driver's text optional
      images               = [],  // [{ base64, mediaType }] optional
      videoFrames          = [],  // [base64 string] optional
      additionalRecordings = [],  // [{ label, description, duration }] optional
      obd2Data,                   // { sensors: {...}, faultCodes: [...] } optional
      vehicleSpecs,               // specs object from frontend vehicleSpecs.js optional
      odometerKm,                 // current odometer in km optional
      lastOilChangeKm,            // odometer at last oil change (km) optional
    } = req.body;

    if (!description) return res.status(400).json({ error: 'description required' });

    const vehicle  = vehicleInfo?.make
      ? [vehicleInfo.year, vehicleInfo.make, vehicleInfo.model, vehicleInfo.trim].filter(Boolean).join(' ')
      : 'unknown';
    const recCount = 1 + additionalRecordings.length;
    const dtcCount = obd2Data?.faultCodes?.length ?? 0;
    console.log(`[diagnose] ${duration?.toFixed?.(1) ?? '?'}s · vehicle: ${vehicle} · recordings: ${recCount} · images: ${images.length} · frames: ${videoFrames.length}${obd2Data ? ` · OBD2: ${Object.keys(obd2Data.sensors || {}).length} sensors, ${dtcCount} DTCs` : ''}`);

    const result = await diagnoseWithClaude({
      audioDescription: description,
      vehicleInfo,
      vehicleSpecs,
      odometerKm,
      lastOilChangeKm,
      textDescription,
      images,
      videoFrames,
      additionalRecordings,
      obd2Data,
    });

    res.json({ ok: true, result });
  } catch (err) {
    console.error('[diagnose]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── Service record OCR ────────────────────────────────────────────────────────
const MOCK_SERVICE_RECORD = {
  date:       new Date().toISOString().split('T')[0],
  shop:       'Demo Auto Centre',
  mileage:    85420,
  services: [
    { type: 'Oil Change',     details: 'Full synthetic 5W-30, 5L', cost: 94.99 },
    { type: 'Tire Rotation',  details: 'All four corners',         cost: 35.00 },
    { type: 'Air Filter',     details: 'OEM replacement',          cost: 28.50 },
  ],
  totalCost:  158.49,
  confidence: 'high',
  notes:      null,
};

app.post('/api/read-service-record', async (req, res) => {
  try {
    const { image, mimeType = 'image/jpeg' } = req.body;
    if (!image) return res.status(400).json({ error: 'image (base64) required' });

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey || !apiKey.trim()) {
      await new Promise(r => setTimeout(r, 1500));
      return res.json({ ok: true, result: MOCK_SERVICE_RECORD });
    }

    const client = new Anthropic({ apiKey });
    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1200,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: mimeType, data: image },
          },
          {
            type: 'text',
            text: `Extract vehicle service record information from this receipt or invoice image.
Return ONLY a raw JSON object with NO markdown, code fences, or extra text.

{
  "date":       "YYYY-MM-DD or null",
  "shop":       "shop/dealership name or null",
  "mileage":    number (odometer reading) or null,
  "services":   [{"type":"service type","details":"brief notes","cost":number or null}],
  "totalCost":  number or null,
  "confidence": "high" | "medium" | "low",
  "notes":      "any other relevant info or null"
}

If a field cannot be found in the image, use null.
The 'services' array should have one entry per distinct service performed.
Common service types: Oil Change, Tire Rotation, Brake Pad Replacement, Air Filter, Cabin Air Filter, Spark Plugs, Coolant Flush, Transmission Fluid, Battery Replacement, Wheel Alignment, Inspection, etc.
Return only the JSON object, nothing else.`,
          },
        ],
      }],
    });

    const text = message.content[0].text.trim();
    let result;
    try {
      result = JSON.parse(text);
    } catch {
      const m = text.match(/\{[\s\S]*\}/);
      if (m) result = JSON.parse(m[0]);
      else throw new Error('Claude returned non-JSON OCR result');
    }

    console.log(`[service-record] OCR confidence=${result.confidence} services=${result.services?.length ?? 0}`);
    res.json({ ok: true, result });
  } catch (err) {
    console.error('[service-record]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── Vehicle photo analysis ────────────────────────────────────────────────────
app.post('/api/analyze-vehicle-photo', async (req, res) => {
  try {
    const { image, mimeType = 'image/jpeg' } = req.body;
    if (!image) return res.status(400).json({ error: 'image (base64) required' });

    const apiKey = process.env.ANTHROPIC_API_KEY;

    // Demo mode — accept photo without AI analysis
    if (!apiKey || !apiKey.trim()) {
      return res.json({ ok: true, result: { isVehicle: true, description: 'Your vehicle', confidence: 'high' } });
    }

    const client = new Anthropic({ apiKey });
    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 512,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: mimeType, data: image },
          },
          {
            type: 'text',
            text: `Analyze this photo. Return ONLY a raw JSON object — no markdown, no code fences, no extra text:
{
  "isVehicle": boolean,
  "make": "manufacturer name or null",
  "model": "model name or null",
  "year": "approximate year or null",
  "color": "color name or null",
  "bodyStyle": "sedan|suv|truck|sports|van|hatchback or null",
  "description": "brief 1-sentence description",
  "confidence": "high|medium|low"
}
If the photo does not clearly show a vehicle, set isVehicle to false.`,
          },
        ],
      }],
    });

    const raw = message.content[0].text.trim();
    let result;
    try {
      result = JSON.parse(raw);
    } catch {
      const m = raw.match(/\{[\s\S]*\}/);
      if (m) result = JSON.parse(m[0]);
      else throw new Error('Claude returned non-JSON for photo analysis');
    }

    if (!result.isVehicle) {
      return res.status(422).json({
        error: 'No vehicle detected — please try a clearer photo of your car',
        result,
      });
    }

    const detected = [result.year, result.make, result.model].filter(Boolean).join(' ');
    console.log(`[vehicle-photo] ${detected || 'unknown'} · confidence=${result.confidence}`);
    res.json({ ok: true, result });
  } catch (err) {
    console.error('[vehicle-photo]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── Vehicle specs + NHTSA recalls ─────────────────────────────────────────────

const RECALL_TTL_MS = 24 * 60 * 60 * 1000; // 24h in-memory cache
const recallCache   = new Map();           // "make|model|year" → { recalls, fetchedAt }

// Demo-mode recalls (shown when no Anthropic key — keeps the Alerts tab demoable)
const MOCK_RECALLS = [
  {
    nhtsaNumber:  '23V123000',
    component:    'FUEL SYSTEM, GASOLINE: DELIVERY: FUEL PUMP',
    summary:      'The low-pressure fuel pump inside the fuel tank may fail. A failing fuel pump can cause the engine to stall while driving, increasing the risk of a crash.',
    consequence:  'An engine stall while driving increases the risk of a crash.',
    reportedDate: '2023-03-01',
  },
  {
    nhtsaNumber:  '22V456000',
    component:    'ELECTRICAL SYSTEM: SOFTWARE',
    summary:      'The rearview camera image may not display due to a software error. A missing rearview image reduces the driver\'s view behind the vehicle.',
    consequence:  'Reduced rear visibility while reversing increases the risk of a crash.',
    reportedDate: '2022-08-15',
  },
];

function httpsGetJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'FixItAI/1.0' } }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(body)); }
        catch { reject(new Error('Non-JSON response from ' + url.split('?')[0])); }
      });
    }).on('error', reject);
  });
}

async function fetchRecallsNHTSA(make, model, year) {
  const url = `https://api.nhtsa.gov/recalls/recallsByVehicle?make=${encodeURIComponent(make)}&model=${encodeURIComponent(model)}&modelYear=${encodeURIComponent(year)}`;
  const data = await Promise.race([
    httpsGetJson(url),
    new Promise((_, reject) => setTimeout(() => reject(new Error('NHTSA timeout')), 5000)),
  ]);
  return (data.results || []).map(r => ({
    nhtsaNumber:  r.NHTSACampaignNumber || null,
    component:    r.Component || null,
    summary:      r.Summary || null,
    consequence:  r.Consequence || null,
    reportedDate: r.ReportReceivedDate || null,
  }));
}

async function getRecallsCached(make, model, year) {
  const key    = `${make}|${model}|${year}`.toLowerCase();
  const cached = recallCache.get(key);
  if (cached && Date.now() - cached.fetchedAt < RECALL_TTL_MS) return cached.recalls;
  try {
    const recalls = await fetchRecallsNHTSA(make, model, year);
    recallCache.set(key, { recalls, fetchedAt: Date.now() });
    return recalls;
  } catch (err) {
    console.warn(`[recalls] NHTSA fetch failed (${err.message}) — serving ${cached ? 'stale cache' : 'empty list'}`);
    return cached?.recalls || [];
  }
}

// GET /api/vehicle-specs?make=&model=&year=&trim= → { ok, specs, recalls }
app.get('/api/vehicle-specs', async (req, res) => {
  try {
    const { make, model, year, trim } = req.query;
    if (!make || !model) return res.status(400).json({ error: 'make and model are required' });

    const specs    = getSpecsForVehicle(make, model, year, trim); // null is fine — no 500
    const demoMode = !(process.env.ANTHROPIC_API_KEY?.trim());

    let recalls = [];
    if (demoMode) {
      recalls = MOCK_RECALLS;
    } else if (year) {
      recalls = await getRecallsCached(make, model, year);
    }

    console.log(`[vehicle-specs] ${year || '?'} ${make} ${model}${trim ? ` ${trim}` : ''} → specs: ${specs ? 'found' : 'none'}, recalls: ${recalls.length}${demoMode ? ' (demo)' : ''}`);
    res.json({ ok: true, specs, recalls });
  } catch (err) {
    console.error('[vehicle-specs]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── Real vehicle photos via Wikipedia ─────────────────────────────────────────

const vehicleImageCache = new Map(); // "Make|Model" → { url, fetchedAt }, 24h TTL

const WIKI_ARTICLE_MAP = {
  'Ford|Mustang': 'Ford Mustang', 'Ford|F-150': 'Ford F-150',
  'Ford|Escape': 'Ford Escape', 'Ford|Explorer': 'Ford Explorer',
  'Ford|Bronco': 'Ford Bronco', 'Ford|Ranger': 'Ford Ranger (Americas)',
  'Honda|Civic': 'Honda Civic', 'Honda|Accord': 'Honda Accord',
  'Honda|CR-V': 'Honda CR-V', 'Honda|Pilot': 'Honda Pilot',
  'Honda|HR-V': 'Honda HR-V', 'Honda|Ridgeline': 'Honda Ridgeline',
  'Toyota|Camry': 'Toyota Camry', 'Toyota|Corolla': 'Toyota Corolla',
  'Toyota|RAV4': 'Toyota RAV4', 'Toyota|Tacoma': 'Toyota Tacoma',
  'Toyota|Highlander': 'Toyota Highlander', 'Toyota|Tundra': 'Toyota Tundra',
  'Toyota|4Runner': 'Toyota 4Runner',
  'Chevrolet|Silverado 1500': 'Chevrolet Silverado', 'Chevrolet|Camaro': 'Chevrolet Camaro',
  'Chevrolet|Equinox': 'Chevrolet Equinox', 'Chevrolet|Tahoe': 'Chevrolet Tahoe',
  'Chevrolet|Traverse': 'Chevrolet Traverse', 'Chevrolet|Colorado': 'Chevrolet Colorado',
  'Chevrolet|Bolt': 'Chevrolet Bolt EV',
  'GMC|Sierra 1500': 'GMC Sierra', 'GMC|Yukon': 'GMC Yukon',
  'GMC|Acadia': 'GMC Acadia', 'GMC|Canyon': 'GMC Canyon',
  'RAM|1500': 'Ram 1500', 'Ram|1500': 'Ram 1500',
  'Dodge|Challenger': 'Dodge Challenger', 'Dodge|Charger': 'Dodge Charger',
  'Jeep|Wrangler': 'Jeep Wrangler', 'Jeep|Grand Cherokee': 'Jeep Grand Cherokee',
  'Jeep|Cherokee': 'Jeep Cherokee (KL)',
  'Tesla|Model 3': 'Tesla Model 3', 'Tesla|Model Y': 'Tesla Model Y',
  'Tesla|Model S': 'Tesla Model S', 'Tesla|Cybertruck': 'Tesla Cybertruck',
  'BMW|3 Series': 'BMW 3 Series', 'BMW|X3': 'BMW X3', 'BMW|X5': 'BMW X5',
  'BMW|4 Series': 'BMW 4 Series', 'BMW|5 Series': 'BMW 5 Series',
  'Mercedes-Benz|C-Class': 'Mercedes-Benz C-Class',
  'Mercedes-Benz|GLE': 'Mercedes-Benz GLE-Class',
  'Subaru|Outback': 'Subaru Outback', 'Subaru|Forester': 'Subaru Forester',
  'Subaru|WRX': 'Subaru WRX', 'Subaru|Legacy': 'Subaru Legacy',
  'Mazda|CX-5': 'Mazda CX-5', 'Mazda|Mazda3': 'Mazda3',
  'Nissan|Altima': 'Nissan Altima', 'Nissan|Rogue': 'Nissan Rogue',
  'Nissan|Frontier': 'Nissan Frontier', 'Nissan|Murano': 'Nissan Murano',
  'Hyundai|Tucson': 'Hyundai Tucson', 'Hyundai|Elantra': 'Hyundai Elantra',
  'Hyundai|Santa Fe': 'Hyundai Santa Fe', 'Hyundai|Ioniq 5': 'Hyundai IONIQ 5',
  'Kia|Sportage': 'Kia Sportage', 'Kia|Telluride': 'Kia Telluride',
  'Kia|EV6': 'Kia EV6', 'Kia|Forte': 'Kia Forte',
  'Volkswagen|GTI': 'Volkswagen Golf GTI', 'Volkswagen|Golf GTI': 'Volkswagen Golf GTI',
  'Volkswagen|Tiguan': 'Volkswagen Tiguan', 'Volkswagen|Jetta': 'Volkswagen Jetta',
};

app.get('/api/vehicle-image', async (req, res) => {
  const { make, model } = req.query;
  if (!make || !model) return res.json({ imageUrl: null });

  const cacheKey = make + '|' + model;
  const cached = vehicleImageCache.get(cacheKey);
  if (cached && Date.now() - cached.fetchedAt < 24 * 60 * 60 * 1000) {
    return res.json({ imageUrl: cached.url });
  }

  const article = WIKI_ARTICLE_MAP[cacheKey];
  if (!article) return res.json({ imageUrl: null });

  try {
    const apiUrl = 'https://en.wikipedia.org/w/api.php?action=query&titles=' +
      encodeURIComponent(article) +
      '&prop=pageimages&format=json&pithumbsize=600&origin=*';
    const data = await Promise.race([
      httpsGetJson(apiUrl),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Wikipedia timeout')), 6000)),
    ]);
    const pages = data?.query?.pages || {};
    const page = Object.values(pages)[0];
    const imageUrl = page?.thumbnail?.source || null;
    vehicleImageCache.set(cacheKey, { url: imageUrl, fetchedAt: Date.now() });
    console.log(`[vehicle-image] ${cacheKey} → ${imageUrl ? 'found' : 'none'}`);
    res.json({ imageUrl });
  } catch (e) {
    console.log('[vehicle-image] fetch failed:', e.message);
    res.json({ imageUrl: null });
  }
});

// ── Mechanic shop helpers ─────────────────────────────────────────────────────

const DATA_DIR = path.join(__dirname, 'data');
let PARTNER_SHOPS = [];
try {
  PARTNER_SHOPS = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'partnerShops.json'), 'utf8'));
} catch { /* file missing — demo starts with no partners */ }

function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(a));
}

const PROVINCE_TZ = {
  BC: 'America/Vancouver', YT: 'America/Whitehorse',
  AB: 'America/Edmonton',  NT: 'America/Yellowknife', SK: 'America/Regina',
  MB: 'America/Winnipeg',  ON: 'America/Toronto',    QC: 'America/Toronto',
  NB: 'America/Moncton',   NS: 'America/Halifax',    PE: 'America/Halifax',
  NL: 'America/St_Johns',  NU: 'America/Iqaluit',
};

const DAY_MAP = { Monday:'mon', Tuesday:'tue', Wednesday:'wed', Thursday:'thu', Friday:'fri', Saturday:'sat', Sunday:'sun' };

function getTodayHoursForShop(shop) {
  const tz = PROVINCE_TZ[shop.province] || 'America/Toronto';
  const now = new Date();
  const weekdayLong = new Intl.DateTimeFormat('en-CA', { timeZone: tz, weekday: 'long' }).format(now);
  const dayKey = DAY_MAP[weekdayLong];
  return dayKey ? (shop.hours?.[dayKey] ?? null) : null;
}

function computeIsOpenNow(shop) {
  const todayHours = getTodayHoursForShop(shop);
  if (!todayHours || todayHours === 'Closed') return false;

  const tz = PROVINCE_TZ[shop.province] || 'America/Toronto';
  const now = new Date();
  const timeStr = new Intl.DateTimeFormat('en-CA', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false }).format(now);
  const [curH, curM] = timeStr.split(':').map(Number);
  const curMins = curH * 60 + curM;

  const m = todayHours.match(/(\d+):(\d+)\s*(AM|PM)\s*[–\-]\s*(\d+):(\d+)\s*(AM|PM)/i);
  if (!m) return null;

  let [, oH, oM, oAmPm, cH, cM, cAmPm] = m;
  oH = parseInt(oH); oM = parseInt(oM); cH = parseInt(cH); cM = parseInt(cM);
  if (oAmPm.toUpperCase() === 'PM' && oH !== 12) oH += 12;
  if (oAmPm.toUpperCase() === 'AM' && oH === 12) oH = 0;
  if (cAmPm.toUpperCase() === 'PM' && cH !== 12) cH += 12;
  if (cAmPm.toUpperCase() === 'AM' && cH === 12) cH = 0;

  return curMins >= (oH * 60 + oM) && curMins < (cH * 60 + cM);
}

function fetchOverpass(query) {
  return new Promise((resolve, reject) => {
    const encoded = encodeURIComponent(query);
    const url = `https://overpass-api.de/api/interpreter?data=${encoded}`;
    https.get(url, { headers: { 'User-Agent': 'FixItAI/1.0' } }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(body)); }
        catch { reject(new Error('Overpass returned non-JSON')); }
      });
    }).on('error', reject);
  });
}

async function fetchNearbyOSM(lat, lon, radiusKm) {
  const radiusM = Math.round(radiusKm * 1000);
  const query = `[out:json][timeout:20];(node["shop"="car_repair"](around:${radiusM},${lat},${lon});way["shop"="car_repair"](around:${radiusM},${lat},${lon});node["amenity"="car_repair"](around:${radiusM},${lat},${lon});node["craft"="car_mechanic"](around:${radiusM},${lat},${lon});node["shop"="auto_repair"](around:${radiusM},${lat},${lon}););out center;`;
  const data = await fetchOverpass(query);
  return data.elements || [];
}

function distanceLabel(km) {
  if (km < 1) return `${Math.round(km * 1000)} m away`;
  return `${km.toFixed(1)} km away`;
}

function mapsUrl(lat, lon) {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}`;
}

function appendToJsonFile(filePath, entry) {
  let arr = [];
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    arr = JSON.parse(raw);
    if (!Array.isArray(arr)) arr = [];
  } catch { /* file missing or corrupt — start fresh */ }
  arr.push(entry);
  fs.writeFileSync(filePath, JSON.stringify(arr, null, 2), 'utf8');
}

// ── GET /api/shops ─────────────────────────────────────────────────────────────
app.get('/api/shops', async (req, res) => {
  try {
    const lat      = parseFloat(req.query.lat);
    const lon      = parseFloat(req.query.lon);
    const radiusKm = Math.min(100, Math.max(1, parseFloat(req.query.radiusKm) || 25));

    if (isNaN(lat) || isNaN(lon)) {
      return res.status(400).json({ error: 'lat and lon are required' });
    }

    // Real shops from OpenStreetMap only — race against 5-second timeout
    let nearby = [];
    try {
      const osmElements = await Promise.race([
        fetchNearbyOSM(lat, lon, radiusKm),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Overpass timeout')), 5000)),
      ]);

      nearby = osmElements
        .filter(el => {
          const sLat = el.lat ?? el.center?.lat;
          const sLon = el.lon ?? el.center?.lon;
          return sLat && sLon && el.tags?.name;
        })
        .map(el => {
          const sLat = el.lat ?? el.center.lat;
          const sLon = el.lon ?? el.center.lon;
          const dKm  = Math.round(haversineKm(lat, lon, sLat, sLon) * 10) / 10;
          const addrParts = [el.tags['addr:housenumber'], el.tags['addr:street']].filter(Boolean);
          return {
            id:            `osm_${el.id}`,
            isPartner:     false,
            name:          el.tags.name,
            address:       addrParts.join(' ') || null,
            city:          el.tags['addr:city'] || null,
            phone:         el.tags.phone || el.tags['contact:phone'] || null,
            rating:        null,
            services:      [],
            todayHours:    null,
            isOpenNow:     null,
            lat:           sLat,
            lon:           sLon,
            distanceKm:    dKm,
            distanceLabel: distanceLabel(dKm),
            mapsUrl:       mapsUrl(sLat, sLon),
            source:        'osm',
          };
        })
        .filter(s => s.distanceKm <= radiusKm)
        .sort((a, b) => a.distanceKm - b.distanceKm)
        .slice(0, 15);

      console.log(`[shops] lat=${lat} lon=${lon} r=${radiusKm}km → ${nearby.length} OSM shops`);
    } catch (osmErr) {
      console.warn(`[shops] OSM skipped: ${osmErr.message}`);
    }

    res.json({
      ok:               true,
      partners:         [],   // partner program not launched yet — see showPartnerCTA
      nearby,
      showPartnerCTA:   true,
      total:            nearby.length,
      radiusKm,
      customerLocation: { lat, lon },
      loadedAt:         new Date().toISOString(),
    });
  } catch (err) {
    console.error('[shops]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── Scanner waitlist ──────────────────────────────────────────────────────────
// In-memory waitlist (persists until server restarts — good enough for now)
const waitlist = [];

app.post('/api/waitlist', (req, res) => {
  const { email } = req.body;
  if (!email || !email.includes('@')) return res.status(400).json({ error: 'Invalid email' });
  if (!waitlist.find(e => e.email === email)) {
    waitlist.push({ email, timestamp: new Date().toISOString() });
    console.log(`[waitlist] signup: ${email} (total: ${waitlist.length})`);
  }
  res.json({ success: true, message: "You're on the list! We'll notify you when the scanner ships." });
});

app.get('/api/waitlist/count', (_, res) => {
  res.json({ count: waitlist.length });
});

// ── POST /api/log-referral ────────────────────────────────────────────────────
app.post('/api/log-referral', (req, res) => {
  try {
    const {
      shopId, shopName, action,
      // spec fields
      customerCity, customerProvince, diagnosisPrimary,
      // legacy fields (from earlier version)
      vehicleInfo, diagnosisSummary,
    } = req.body;
    if (!shopId || !action) return res.status(400).json({ error: 'shopId and action required' });

    const referralId = `ref-${shopId}-${Date.now()}`;
    const entry = {
      referralId,
      shopId,
      shopName:         shopName || null,
      action,
      customerCity:     customerCity || null,
      customerProvince: customerProvince || null,
      diagnosisPrimary: diagnosisPrimary || diagnosisSummary || null,
      vehicleInfo:      vehicleInfo || null,
      timestamp:        new Date().toISOString(),
    };

    appendToJsonFile(path.join(DATA_DIR, 'referralLog.json'), entry);
    console.log(`[referral] ${action} → ${shopName} (${referralId})`);
    res.json({ success: true, referralId });
  } catch (err) {
    console.error('[log-referral]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/partner-inquiry ─────────────────────────────────────────────────
app.post('/api/partner-inquiry', (req, res) => {
  try {
    const { shopName, contactName, phone, email, city, province, notes } = req.body;
    if (!shopName) return res.status(400).json({ error: 'shopName required' });

    const entry = {
      shopName, contactName: contactName || null,
      phone: phone || null, email: email || null,
      city: city || null, province: province || null,
      notes: notes || null,
      timestamp: new Date().toISOString(),
    };

    appendToJsonFile(path.join(DATA_DIR, 'partnerInquiries.json'), entry);
    console.log(`[inquiry] ${shopName} from ${city || '?'}, ${province || '?'}`);
    res.json({ ok: true });
  } catch (err) {
    console.error('[partner-inquiry]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  const hasKey = !!(process.env.ANTHROPIC_API_KEY?.trim());
  console.log(`\n🔧 FixIt AI backend  →  http://localhost:${PORT}`);
  console.log(`   AI mode: ${hasKey ? '✅ Claude claude-sonnet-4-6' : '⚠️  DEMO MODE — add ANTHROPIC_API_KEY to backend/.env'}\n`);
});
