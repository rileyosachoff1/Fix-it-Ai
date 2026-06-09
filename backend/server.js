'use strict';
require('dotenv').config();

const express = require('express');
const cors    = require('cors');
const Anthropic = require('@anthropic-ai/sdk');

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
  3. A description from the driver (optional)
  4. Photos and/or video frames from the vehicle (optional)

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
    "estimatedCost": { "min": <integer USD>, "max": <integer USD>, "currency": "USD" },
    "ifIgnored": "Specific mechanical consequence if not addressed — what breaks next and when",
    "recommendedAction": "Clear, specific, actionable guidance for the driver"
  },
  "alternatives": [
    {
      "diagnosis": "Second most likely diagnosis",
      "confidence": <integer 0–100>,
      "explanation": "Exactly 2 sentences: (1) why this could produce the observed symptoms, (2) how to distinguish it from the primary diagnosis",
      "estimatedCost": { "min": <integer USD>, "max": <integer USD>, "currency": "USD" },
      "ruleOut": "One specific, simple test or observation the driver or mechanic can perform to confirm or eliminate this possibility"
    },
    {
      "diagnosis": "Third possibility",
      "confidence": <integer 0–100>,
      "explanation": "Exactly 2 sentences as above",
      "estimatedCost": { "min": <integer USD>, "max": <integer USD>, "currency": "USD" },
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
All cost estimates reflect average US independent shop prices (labor + parts).`;

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
      estimatedCost: { min: 120, max: 280, currency: 'USD' },
      ifIgnored: 'Belt will eventually crack and snap, instantly disabling the alternator, power steering, water pump, and AC simultaneously — leaving you stranded and risking engine overheating within minutes.',
      recommendedAction: 'Schedule inspection within 1–2 weeks. Quick confirmation test: with engine running, briefly mist water onto the belt — if squeal intensifies then fades, belt is confirmed. Replace belt and inspect tensioner.',
    },
    alternatives: [
      {
        diagnosis: 'Failing Belt Tensioner',
        confidence: 42,
        explanation: 'A fatiguing tensioner spring allows belt tension to fluctuate, producing nearly identical high-pitched squeal under varying loads. Unlike pure belt glazing, a tensioner issue often produces a rhythmic flutter visible on the tensioner arm while idling.',
        estimatedCost: { min: 80, max: 200, currency: 'USD' },
        ruleOut: 'With engine running, watch the tensioner arm — if it oscillates or vibrates visibly, the tensioner is failing rather than the belt itself.',
      },
      {
        diagnosis: 'Alternator Bearing Whine',
        confidence: 22,
        explanation: 'A worn alternator front bearing can produce a sustained high-pitched whine that varies with RPM and increases under electrical load (headlights, AC). It differs from belt squeal in that it continues briefly after the engine is turned off.',
        estimatedCost: { min: 180, max: 450, currency: 'USD' },
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
      estimatedCost: { min: 180, max: 420, currency: 'USD' },
      ifIgnored: 'Bearing will progress to complete failure — wheel wobble, then sudden seizure at speed causing loss of vehicle control. This is a safety-critical item.',
      recommendedAction: 'Isolate the axle: in a safe empty lot at ~20 mph, sway gently left then right. If hum increases when weight shifts to one side, that wheel\'s bearing is confirmed. Book within 2 weeks.',
    },
    alternatives: [
      {
        diagnosis: 'Cupped Rear Tires',
        confidence: 38,
        explanation: 'Worn shock absorbers allow tires to bounce at speed, creating cupped wear patterns that generate a rhythmic hum almost identical to wheel bearing noise. Unlike bearings, tire noise is less affected by lateral weight transfer during cornering.',
        estimatedCost: { min: 400, max: 900, currency: 'USD' },
        ruleOut: 'Run your hand across the tire tread — cupping feels like scalloped or uneven high/low spots across the tread blocks, clearly distinguishable from smooth wear.',
      },
      {
        diagnosis: 'Worn CV Axle (inner joint)',
        confidence: 18,
        explanation: 'An inner CV joint with deteriorated balls and cage can produce a low rumble under acceleration at certain speeds. Unlike a wheel bearing, this typically intensifies specifically during hard acceleration rather than being purely speed-dependent.',
        estimatedCost: { min: 150, max: 380, currency: 'USD' },
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
      estimatedCost: { min: 150, max: 380, currency: 'USD' },
      ifIgnored: 'CV joint will disintegrate during a turn — vehicle becomes immediately undriveable. Risk of catastrophic axle shaft separation at highway speeds.',
      recommendedAction: 'Confirm by turning steering wheel full lock in a parking lot — clicking should be pronounced and rhythmic. Schedule CV axle half-shaft replacement within 2 weeks.',
    },
    alternatives: [
      {
        diagnosis: 'Loose Brake Hardware (anti-rattle clips)',
        confidence: 28,
        explanation: 'Loose or missing brake pad anti-rattle hardware creates a repetitive metallic clicking that can occur while driving, particularly noticeable during slow turns when weight shifts onto that corner. Unlike CV noise, it often occurs even when going straight over bumps.',
        estimatedCost: { min: 30, max: 120, currency: 'USD' },
        ruleOut: 'Apply the brakes lightly while the clicking occurs — brake hardware noise almost always stops or changes when the pads are pressed against the rotor.',
      },
      {
        diagnosis: 'Worn Strut Mount Bearing',
        confidence: 15,
        explanation: 'A failing strut mount bearing (top of front strut) produces clicking and clunking during steering input as the bearing binds rather than pivoting smoothly. Unlike CV noise, it is most noticeable at low speeds and during parking maneuvers.',
        estimatedCost: { min: 150, max: 350, currency: 'USD' },
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
      estimatedCost: { min: 1500, max: 4500, currency: 'USD' },
      ifIgnored: 'Connecting rod will punch through the engine block without warning — complete engine destruction. This can happen within miles or hours at highway speed. There is no recoverable outcome once it progresses.',
      recommendedAction: 'STOP DRIVING IMMEDIATELY. Turn engine off. Check oil level — if critically low, add oil before attempting to move the vehicle. Do not restart until inspected. Arrange a tow.',
    },
    alternatives: [
      {
        diagnosis: 'Piston Slap',
        confidence: 35,
        explanation: 'Excessive piston-to-bore clearance creates a slapping knock similar to rod knock but typically loudest when cold and quieting within 60–90 seconds as the piston expands with heat. Rod knock worsens or stays consistent as the engine warms.',
        estimatedCost: { min: 800, max: 3000, currency: 'USD' },
        ruleOut: 'Note whether the knock is loudest at cold start and significantly quieter after 2 minutes of running — piston slap characteristically fades with warmup while rod knock persists.',
      },
      {
        diagnosis: 'Loose Timing Chain / VVT Cam Phaser Rattle',
        confidence: 25,
        explanation: 'A stretched timing chain or worn VVT cam phaser rattles loudly on cold start and can sound like deep knocking until oil pressure builds. Unlike rod knock, it is typically loudest in the first 2–3 seconds of startup and comes from the front/top of the engine.',
        estimatedCost: { min: 600, max: 2500, currency: 'USD' },
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
      estimatedCost: { min: 150, max: 380, currency: 'USD' },
      ifIgnored: 'Pads will wear completely to metal backing plates — rotors will be scored and gouged, upgrading the repair from pad replacement to full brake job including rotors. Braking distance increases significantly.',
      recommendedAction: 'Schedule brake inspection within 1 week. If you hear grinding instead of squealing, the pads are already metal-on-metal — reduce driving immediately and book same-day.',
    },
    alternatives: [
      {
        diagnosis: 'Warped Brake Rotors',
        confidence: 40,
        explanation: 'Warped or scored rotor surfaces create a rhythmic pulsation and intermittent squeal during braking as the pad contacts high spots. Unlike pad wear noise, rotor noise often comes with a brake pedal vibration at the same rhythm as the squeal.',
        estimatedCost: { min: 200, max: 500, currency: 'USD' },
        ruleOut: 'Feel the brake pedal for pulsation or vibration during moderate braking — a warped rotor creates a distinct rhythmic pulse in the pedal that worn pads alone do not.',
      },
      {
        diagnosis: 'Brake Dust Shield Interference',
        confidence: 18,
        explanation: 'A bent or corroded brake dust shield rubbing against the rotor creates a continuous metallic scraping or squealing that sounds like pad noise but is not load-dependent — it occurs while rolling even without braking.',
        estimatedCost: { min: 0, max: 80, currency: 'USD' },
        ruleOut: 'Test whether the sound occurs while rolling without pressing the brake pedal — dust shield interference is constant while moving, while pad wear noise is almost exclusively present during braking.',
      },
    ],
  },
];

let mockIndex = 0;

// ── Build Claude message content ──────────────────────────────────────────────
function buildUserMessage({ audioDescription, vehicleInfo, textDescription, images = [], videoFrames = [], additionalRecordings = [], obd2Data }) {
  const parts = ['=== VEHICLE DIAGNOSIS REQUEST ==='];

  if (vehicleInfo?.make) {
    parts.push(`\nVEHICLE: ${[vehicleInfo.year, vehicleInfo.make, vehicleInfo.model].filter(Boolean).join(' ')}`);
  }

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
async function diagnoseWithClaude({ audioDescription, vehicleInfo, textDescription, images, videoFrames, additionalRecordings, obd2Data }) {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey || !apiKey.trim()) {
    const mock = MOCK_DIAGNOSES[mockIndex % MOCK_DIAGNOSES.length];
    mockIndex++;
    await new Promise(r => setTimeout(r, 2000 + Math.random() * 1000));
    return mock;
  }

  const client  = new Anthropic({ apiKey });
  const content = buildUserMessage({ audioDescription, vehicleInfo, textDescription, images, videoFrames, additionalRecordings, obd2Data });

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
    } = req.body;

    if (!description) return res.status(400).json({ error: 'description required' });

    const vehicle  = vehicleInfo?.make ? `${vehicleInfo.year} ${vehicleInfo.make} ${vehicleInfo.model}` : 'unknown';
    const recCount = 1 + additionalRecordings.length;
    const dtcCount = obd2Data?.faultCodes?.length ?? 0;
    console.log(`[diagnose] ${duration?.toFixed?.(1) ?? '?'}s · vehicle: ${vehicle} · recordings: ${recCount} · images: ${images.length} · frames: ${videoFrames.length}${obd2Data ? ` · OBD2: ${Object.keys(obd2Data.sensors || {}).length} sensors, ${dtcCount} DTCs` : ''}`);

    const result = await diagnoseWithClaude({
      audioDescription: description,
      vehicleInfo,
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

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  const hasKey = !!(process.env.ANTHROPIC_API_KEY?.trim());
  console.log(`\n🔧 FixIt AI backend  →  http://localhost:${PORT}`);
  console.log(`   AI mode: ${hasKey ? '✅ Claude claude-sonnet-4-6' : '⚠️  DEMO MODE — add ANTHROPIC_API_KEY to backend/.env'}\n`);
});
