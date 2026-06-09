/**
 * OBD2 BLE Service — ELM327 Bluetooth Low Energy adapter
 * Connects to ELM327-based BLE OBD2 adapters via Web Bluetooth API (Chrome only).
 * No external npm dependencies.
 */

// ── BLE UUID sets (tried in order until one works) ────────────────────────────
const UUID_SETS = [
  {
    label:   'Standard ELM327',
    service: '0000fff0-0000-1000-8000-00805f9b34fb',
    notify:  '0000fff1-0000-1000-8000-00805f9b34fb',
    write:   '0000fff2-0000-1000-8000-00805f9b34fb',
  },
  {
    label:   'Common Clone (FFE0)',
    service: '0000ffe0-0000-1000-8000-00805f9b34fb',
    notify:  '0000ffe1-0000-1000-8000-00805f9b34fb',
    write:   '0000ffe1-0000-1000-8000-00805f9b34fb',
  },
  {
    label:   'Vgate iCar Pro',
    service: 'e7810a71-73ae-499d-8c15-faa9aef0c3f2',
    notify:  'be781528-d68a-4b0a-9e8d-18c6ffeae5d6',
    write:   'be781528-d68a-4b0a-9e8d-18c6ffeae5d6',
  },
];

// ── ELM327 initialization sequence ────────────────────────────────────────────
const INIT_CMDS = ['ATZ', 'ATE0', 'ATL0', 'ATS0', 'ATH0', 'ATSP0'];

// ── Rounding helpers ──────────────────────────────────────────────────────────
const r1 = v => Math.round(v * 10)   / 10;
const r2 = v => Math.round(v * 100)  / 100;

// ── OBD2 PID definitions ──────────────────────────────────────────────────────
// parse(d) receives the data bytes AFTER the "41 XX" response header
const PIDS = [
  { cmd: '0104', key: 'engineLoad',     parse: d => r1((d[0] / 255) * 100) },
  { cmd: '0105', key: 'coolantTemp',    parse: d => d[0] - 40 },
  { cmd: '0106', key: 'fuelTrimST',     parse: d => r1(((d[0] / 128) - 1) * 100) },
  { cmd: '0107', key: 'fuelTrimLT',     parse: d => r1(((d[0] / 128) - 1) * 100) },
  { cmd: '010C', key: 'rpm',            parse: d => Math.round(((d[0] * 256) + d[1]) / 4) },
  { cmd: '010D', key: 'speed',          parse: d => d[0] },
  { cmd: '010F', key: 'intakeTemp',     parse: d => d[0] - 40 },
  { cmd: '0110', key: 'maf',            parse: d => r1(((d[0] * 256) + d[1]) / 100) },
  { cmd: '0111', key: 'throttle',       parse: d => r1((d[0] / 255) * 100) },
  { cmd: '0114', key: 'o2Voltage',      parse: d => r2(d[0] / 200) },
  { cmd: '0142', key: 'batteryVoltage', parse: d => r2(((d[0] * 256) + d[1]) / 1000) },
];

const LIVE_KEYS = ['rpm', 'coolantTemp', 'batteryVoltage'];

// ── DTC lookup table (50 most common codes) ───────────────────────────────────
const DTC_DESCRIPTIONS = {
  P0100: 'Mass Air Flow Sensor Circuit Malfunction',
  P0101: 'Mass Air Flow Sensor Circuit Range/Performance',
  P0102: 'Mass Air Flow Sensor Circuit Low Input',
  P0103: 'Mass Air Flow Sensor Circuit High Input',
  P0110: 'Intake Air Temperature Sensor Circuit Malfunction',
  P0111: 'Intake Air Temperature Sensor Range/Performance',
  P0112: 'Intake Air Temperature Sensor Circuit Low',
  P0113: 'Intake Air Temperature Sensor Circuit High',
  P0115: 'Engine Coolant Temperature Sensor Circuit Malfunction',
  P0117: 'Engine Coolant Temperature Sensor Circuit Low',
  P0118: 'Engine Coolant Temperature Sensor Circuit High',
  P0121: 'Throttle Position Sensor Range/Performance',
  P0122: 'Throttle Position Sensor Circuit Low Input',
  P0123: 'Throttle Position Sensor Circuit High Input',
  P0125: 'Insufficient Coolant Temperature for Closed Loop Fuel Control',
  P0128: 'Coolant Temperature Below Thermostat Regulating Temperature',
  P0130: 'O2 Sensor Circuit Malfunction (Bank 1, Sensor 1)',
  P0131: 'O2 Sensor Circuit Low Voltage (Bank 1, Sensor 1)',
  P0132: 'O2 Sensor Circuit High Voltage (Bank 1, Sensor 1)',
  P0133: 'O2 Sensor Circuit Slow Response (Bank 1, Sensor 1)',
  P0134: 'O2 Sensor No Activity Detected (Bank 1, Sensor 1)',
  P0135: 'O2 Sensor Heater Circuit Malfunction (Bank 1, Sensor 1)',
  P0140: 'O2 Sensor No Activity Detected (Bank 1, Sensor 2)',
  P0141: 'O2 Sensor Heater Circuit Malfunction (Bank 1, Sensor 2)',
  P0171: 'System Too Lean (Bank 1)',
  P0172: 'System Too Rich (Bank 1)',
  P0174: 'System Too Lean (Bank 2)',
  P0175: 'System Too Rich (Bank 2)',
  P0200: 'Fuel Injector Circuit Malfunction',
  P0300: 'Random/Multiple Cylinder Misfire Detected',
  P0301: 'Cylinder 1 Misfire Detected',
  P0302: 'Cylinder 2 Misfire Detected',
  P0303: 'Cylinder 3 Misfire Detected',
  P0304: 'Cylinder 4 Misfire Detected',
  P0305: 'Cylinder 5 Misfire Detected',
  P0306: 'Cylinder 6 Misfire Detected',
  P0325: 'Knock Sensor 1 Circuit Malfunction (Bank 1)',
  P0335: 'Crankshaft Position Sensor Circuit Malfunction',
  P0340: 'Camshaft Position Sensor Circuit Malfunction (Bank 1)',
  P0400: 'Exhaust Gas Recirculation Flow Malfunction',
  P0401: 'EGR Insufficient Flow Detected',
  P0420: 'Catalyst System Efficiency Below Threshold (Bank 1)',
  P0430: 'Catalyst System Efficiency Below Threshold (Bank 2)',
  P0440: 'Evaporative Emission Control System Malfunction',
  P0441: 'EVAP System Incorrect Purge Flow',
  P0442: 'EVAP System Small Leak Detected',
  P0446: 'EVAP System Vent Control Circuit Malfunction',
  P0455: 'EVAP System Large Leak Detected',
  P0456: 'EVAP System Very Small Leak Detected',
  P0480: 'Cooling Fan 1 Control Circuit Malfunction',
  P0500: 'Vehicle Speed Sensor Malfunction',
  P0505: 'Idle Control System Malfunction',
  P0562: 'System Voltage Low',
  P0563: 'System Voltage High',
};

// ── Mock demo scenarios ───────────────────────────────────────────────────────
const MOCK_SCENARIOS = [
  {
    name: 'Healthy Car',
    sensors: {
      rpm: 850, speed: 0, coolantTemp: 88, engineLoad: 15.3, throttle: 11.8,
      fuelTrimST: -0.8, fuelTrimLT: 1.6, maf: 4.2, intakeTemp: 28,
      batteryVoltage: 14.2, o2Voltage: 0.48,
    },
    faultCodes: [],
  },
  {
    name: 'Catalytic Converter & Lean',
    sensors: {
      rpm: 900, speed: 0, coolantTemp: 90, engineLoad: 17.1, throttle: 13.3,
      fuelTrimST: 3.1, fuelTrimLT: 14.1, maf: 6.8, intakeTemp: 31,
      batteryVoltage: 13.8, o2Voltage: 0.35,
    },
    faultCodes: [
      { code: 'P0420', description: DTC_DESCRIPTIONS.P0420, type: 'stored' },
      { code: 'P0171', description: DTC_DESCRIPTIONS.P0171, type: 'stored' },
    ],
  },
  {
    name: 'Cooling System Issue',
    sensors: {
      rpm: 750, speed: 0, coolantTemp: 62, engineLoad: 13.4, throttle: 10.2,
      fuelTrimST: 4.5, fuelTrimLT: 2.3, maf: 3.9, intakeTemp: 25,
      batteryVoltage: 13.9, o2Voltage: 0.52,
    },
    faultCodes: [
      { code: 'P0128', description: DTC_DESCRIPTIONS.P0128, type: 'stored' },
    ],
  },
];

// ── Module-level state ────────────────────────────────────────────────────────
let _device       = null;
let _server       = null;
let _notifyChar   = null;
let _writeChar    = null;
let _connected    = false;
let _deviceName   = '';
let _mockMode     = false;
let _mockScenario = null;

// Command serialization
let _buffer          = '';
let _responseResolve = null;
let _responseTimeout = null;
let _cmdLock         = Promise.resolve();

// Connection listeners
const _listeners = [];

// ─────────────────────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────────────────────

function _notifyListeners(info) {
  for (const cb of _listeners) {
    try { cb(info); } catch (_) {}
  }
}

function _onNotification(event) {
  const chunk = new TextDecoder('utf-8').decode(event.target.value);
  _buffer += chunk;

  if (_buffer.includes('>') && _responseResolve) {
    clearTimeout(_responseTimeout);
    const response = _buffer.replace(/>/g, '').replace(/\r/g, '').trim();
    _buffer = '';
    const fn = _responseResolve;
    _responseResolve = null;
    fn(response);
  }
}

function _onDisconnected() {
  _connected    = false;
  _deviceName   = '';
  _mockMode     = false;
  _mockScenario = null;
  _notifyChar   = null;
  _writeChar    = null;
  _server       = null;
  _notifyListeners({ connected: false, deviceName: '' });
}

// Sequential command queue — ELM327 is strictly half-duplex
async function _sendCmd(cmd, timeoutMs = 5000) {
  let unlock;
  const prev = _cmdLock;
  _cmdLock = new Promise(res => { unlock = res; });

  try {
    await prev;
    return await _sendCmdInner(cmd, timeoutMs);
  } finally {
    unlock();
  }
}

function _sendCmdInner(cmd, timeoutMs) {
  if (!_writeChar) return Promise.resolve('NOTCONNECTED');

  return new Promise((resolve, reject) => {
    _responseTimeout = setTimeout(() => {
      if (_responseResolve) {
        _responseResolve = null;
        _buffer = '';
        resolve('TIMEOUT');
      }
    }, timeoutMs);

    _responseResolve = data => resolve(data);

    const encoded = new TextEncoder().encode(cmd + '\r');
    const p = _writeChar.writeValueWithoutResponse
      ? _writeChar.writeValueWithoutResponse(encoded)
      : _writeChar.writeValue(encoded);

    p.catch(err => {
      clearTimeout(_responseTimeout);
      _responseResolve = null;
      reject(err);
    });
  });
}

function _hexToBytes(hexStr) {
  const clean = hexStr.replace(/\s+/g, '').toUpperCase().replace(/[^0-9A-F]/g, '');
  const bytes = [];
  for (let i = 0; i + 1 < clean.length; i += 2) {
    bytes.push(parseInt(clean.slice(i, i + 2), 16));
  }
  return bytes;
}

// Finds "41 PID ..." pattern in the response and returns subsequent data bytes
// Works regardless of whether headers are on or off
function _parseOBDResponse(response, cmdHex) {
  const bytes   = _hexToBytes(response);
  const pidByte = parseInt(cmdHex.slice(2, 4), 16);
  for (let i = 0; i + 1 < bytes.length; i++) {
    if (bytes[i] === 0x41 && bytes[i + 1] === pidByte) {
      return bytes.slice(i + 2);
    }
  }
  return null;
}

function _isGoodResponse(resp) {
  if (!resp || resp.length < 2) return false;
  const up = resp.toUpperCase();
  return !up.includes('NODATA') && !up.includes('NO DATA') &&
         !up.includes('ERROR') && !up.includes('UNABLE') &&
         !up.includes('TIMEOUT') && resp !== '?';
}

function _parseDTCs(response, type) {
  const bytes = _hexToBytes(response);
  const codes = [];

  // Find mode 03 (0x43) or mode 07 (0x47) response marker
  let start = -1;
  for (let i = 0; i < bytes.length; i++) {
    if (bytes[i] === 0x43 || bytes[i] === 0x47) { start = i + 1; break; }
  }
  if (start === -1) return [];

  for (let i = start; i + 1 < bytes.length; i += 2) {
    const b1 = bytes[i], b2 = bytes[i + 1];
    if (b1 === 0 && b2 === 0) break;

    const system = ['P', 'C', 'B', 'U'][(b1 >> 6) & 0x03];
    const d1     = (b1 >> 4) & 0x03;
    const d2     =  b1       & 0x0F;
    const d3     = (b2 >> 4) & 0x0F;
    const d4     =  b2       & 0x0F;

    const code        = `${system}${d1}${d2}${d3.toString(16).toUpperCase()}${d4.toString(16).toUpperCase()}`;
    const description = DTC_DESCRIPTIONS[code] || 'Unknown fault — consult a qualified mechanic';
    codes.push({ code, description, type });
  }
  return codes;
}

async function _tryUUIDSet(server, uuidSet) {
  try {
    const service    = await server.getPrimaryService(uuidSet.service);
    const notifyChar = await service.getCharacteristic(uuidSet.notify);
    const writeChar  = uuidSet.write === uuidSet.notify
      ? notifyChar
      : await service.getCharacteristic(uuidSet.write);
    return { notifyChar, writeChar };
  } catch {
    return null;
  }
}

async function _initELM327() {
  for (const cmd of INIT_CMDS) {
    await _sendCmd(cmd, cmd === 'ATZ' ? 5000 : 2000);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Register a listener for connection state changes.
 * cb({ connected: bool, deviceName: string })
 */
export function onConnectionChange(cb) {
  _listeners.push(cb);
}

/** Returns true if connected (real BLE or mock). */
export function isConnected() { return _connected; }

/** Returns device name or empty string. */
export function getDeviceName() { return _deviceName; }

/**
 * Show Web Bluetooth device picker and connect to an ELM327 adapter.
 * Tries multiple UUID sets in order.
 * Throws NotFoundError if user cancels, or Error if connection fails.
 */
export async function connectScanner() {
  if (!('bluetooth' in navigator)) {
    throw new Error('Web Bluetooth is not supported. Please use Chrome on desktop or Android.');
  }

  const allServices = [...new Set(UUID_SETS.map(s => s.service))];

  const device = await navigator.bluetooth.requestDevice({
    acceptAllDevices: true,
    optionalServices: allServices,
  });

  _device     = device;
  _deviceName = device.name || 'OBD2 Scanner';
  _device.addEventListener('gattserverdisconnected', _onDisconnected);

  _server = await device.gatt.connect();

  let chars = null;
  for (const uuidSet of UUID_SETS) {
    chars = await _tryUUIDSet(_server, uuidSet);
    if (chars) break;
  }

  if (!chars) {
    await _server.disconnect().catch(() => {});
    throw new Error('Could not find OBD2 characteristics. Is this an ELM327 BLE adapter?');
  }

  _notifyChar = chars.notifyChar;
  _writeChar  = chars.writeChar;

  await _notifyChar.startNotifications();
  _notifyChar.addEventListener('characteristicvaluechanged', _onNotification);

  await _initELM327();

  _connected = true;
  _notifyListeners({ connected: true, deviceName: _deviceName });

  return { name: _deviceName };
}

/**
 * Connect in demo/mock mode.
 * scenarioIdx cycles: 0 = Healthy, 1 = Cat+Lean, 2 = Cooling Issue
 */
export async function connectMock(scenarioIdx = 0) {
  if (_device?.gatt?.connected) {
    try { await _device.gatt.disconnect(); } catch (_) {}
  }

  const idx     = ((scenarioIdx % MOCK_SCENARIOS.length) + MOCK_SCENARIOS.length) % MOCK_SCENARIOS.length;
  _mockMode     = true;
  _mockScenario = MOCK_SCENARIOS[idx];
  _connected    = true;
  _deviceName   = `Demo — ${_mockScenario.name}`;

  _notifyListeners({ connected: true, deviceName: _deviceName });
  return { name: _deviceName };
}

/**
 * Disconnect (real or mock). Always resolves — never throws.
 */
export async function disconnectScanner() {
  _mockMode     = false;
  _mockScenario = null;
  _connected    = false;
  _deviceName   = '';

  if (_notifyChar) {
    try {
      _notifyChar.removeEventListener('characteristicvaluechanged', _onNotification);
      await _notifyChar.stopNotifications();
    } catch (_) {}
    _notifyChar = null;
  }
  _writeChar = null;

  if (_device?.gatt?.connected) {
    try { await _device.gatt.disconnect(); } catch (_) {}
  }
  _device = null;
  _server = null;

  _notifyListeners({ connected: false, deviceName: '' });
}

/**
 * Read RPM, coolant temp, and battery voltage only.
 * Fast — used for the live status bar (polls every 3 s).
 * Returns { rpm, coolantTemp, batteryVoltage } or null on failure.
 */
export async function readLiveSummary() {
  if (_mockMode && _mockScenario) {
    const s = _mockScenario.sensors;
    return {
      rpm:            Math.round((s.rpm || 0) + (Math.random() - 0.5) * 60),
      coolantTemp:    Math.round((s.coolantTemp || 0) + (Math.random() - 0.5) * 2),
      batteryVoltage: r2((s.batteryVoltage || 0) + (Math.random() - 0.5) * 0.1),
    };
  }
  if (!_connected || !_writeChar) return null;

  const livePids = PIDS.filter(p => LIVE_KEYS.includes(p.key));
  const result   = {};
  for (const pid of livePids) {
    try {
      const resp = await _sendCmd(pid.cmd, 2000);
      if (_isGoodResponse(resp)) {
        const data  = _parseOBDResponse(resp, pid.cmd);
        if (data?.length) {
          const val = pid.parse(data);
          if (val != null && !isNaN(val)) result[pid.key] = val;
        }
      }
    } catch { /* skip this PID */ }
  }
  return Object.keys(result).length ? result : null;
}

/**
 * Read all 11 sensor PIDs. Used when bundling OBD2 data with a diagnosis.
 * Returns an object with available sensor readings.
 */
export async function readAllSensors() {
  if (_mockMode && _mockScenario) {
    await new Promise(r => setTimeout(r, 150 + Math.random() * 100));
    const s = { ..._mockScenario.sensors };
    if (s.rpm            != null) s.rpm            = Math.round(s.rpm            + (Math.random() - 0.5) * 40);
    if (s.coolantTemp    != null) s.coolantTemp     = Math.round(s.coolantTemp    + (Math.random() - 0.5) * 1);
    if (s.batteryVoltage != null) s.batteryVoltage  = r2(s.batteryVoltage         + (Math.random() - 0.5) * 0.1);
    return s;
  }
  if (!_connected || !_writeChar) return null;

  const result = {};
  for (const pid of PIDS) {
    try {
      const resp = await _sendCmd(pid.cmd, 3000);
      if (_isGoodResponse(resp)) {
        const data = _parseOBDResponse(resp, pid.cmd);
        if (data?.length) {
          const val = pid.parse(data);
          if (val != null && !isNaN(val)) result[pid.key] = val;
        }
      }
    } catch { /* skip this PID */ }
  }
  return result;
}

/**
 * Read stored (mode 03) and pending (mode 07) fault codes.
 * Returns [{ code, description, type }]
 */
export async function readFaultCodes() {
  if (_mockMode && _mockScenario) {
    await new Promise(r => setTimeout(r, 100 + Math.random() * 100));
    return [..._mockScenario.faultCodes];
  }
  if (!_connected || !_writeChar) return [];

  const allCodes = [];
  for (const { cmd, type } of [{ cmd: '03', type: 'stored' }, { cmd: '07', type: 'pending' }]) {
    try {
      const resp = await _sendCmd(cmd, 3000);
      if (_isGoodResponse(resp)) allCodes.push(..._parseDTCs(resp, type));
    } catch { /* skip */ }
  }
  return allCodes;
}
