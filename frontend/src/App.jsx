import { useState, useEffect, useCallback, useMemo } from 'react';
import TabBar          from './components/TabBar.jsx';
import HomeTab         from './components/HomeTab.jsx';
import LiveTab         from './components/LiveTab.jsx';
// AlertsTab retired — alerts now live in the Home header bell (AlertsSheet)
import MaintenanceTab  from './components/MaintenanceTab.jsx';
import VehicleTab      from './components/VehicleTab.jsx';
import DiagnoseModal   from './components/DiagnoseModal.jsx';
import MechanicScreen  from './screens/MechanicScreen.jsx';
import OnboardingScreen from './screens/OnboardingScreen.jsx';
import { DEFAULT_SCHEDULE, getScheduleForVehicle } from './data/serviceSchedules.js';
import { getSpecsForVehicle } from './data/vehicleSpecs.js';
import * as obd2Service from './services/obd2Service.js';
import { fetchSpecsAndRecalls, clearRecallsCache } from './services/vehicleSpecsService.js';
import { odoToKm } from './utils/units.js';
import { computeMaintenanceDue, oilOverdueKm } from './utils/maintenance.js';
import { computeHealthScore } from './utils/healthScore.js';
import { generateAlerts } from './utils/alerts.js';

// Build DEFAULT_MAINTENANCE from serviceSchedules (all intervals in km)
const DEFAULT_MAINTENANCE = Object.fromEntries(
  Object.entries(DEFAULT_SCHEDULE).map(([key, val]) => [
    key,
    { lastDate: null, lastKm: null, intervalKm: val.intervalKm, label: val.label },
  ])
);

const EMPTY_VEHICLE_INFO = {
  year: '', make: '', model: '', trim: '',
  nickname: '', vehicleColor: '', ownerName: '',
  odometer: '', odometerUnit: 'km',
  postalCode: '',
  licensePlate: '', vin: '', purchaseDate: '',
};

// ── localStorage helpers (lazy-init pattern — read once, write on change) ─────
function readLS(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw != null ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeLS(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* quota — ignore */ }
}

/** Merge a saved schedule over defaults so newly added schedule keys still appear. */
function hydrateSchedule(saved) {
  if (!saved || typeof saved !== 'object') return DEFAULT_MAINTENANCE;
  const next = {};
  for (const [key, def] of Object.entries(DEFAULT_MAINTENANCE)) {
    next[key] = { ...def, ...(saved[key] || {}) };
  }
  for (const [key, val] of Object.entries(saved)) {
    if (!next[key]) next[key] = val;
  }
  return next;
}

// ── Photo utilities (module-level — no React deps) ────────────────────────────
function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = e => resolve(e.target.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function compressImage(dataUrl, maxWidth = 1200, quality = 0.82) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const scale  = Math.min(1, maxWidth / img.width);
      const canvas = document.createElement('canvas');
      canvas.width  = Math.round(img.width  * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => resolve(dataUrl);  // fallback: use original
    img.src = dataUrl;
  });
}

export default function App() {
  // ── Navigation ─────────────────────────────────────────────────────────────
  const [activeTab,     setActiveTab]     = useState('home');
  const [diagnoseOpen,  setDiagnoseOpen]  = useState(false);

  // ── Theme (dark default, persisted) ────────────────────────────────────────
  const [theme, setTheme] = useState(() => localStorage.getItem('fixit_theme') || 'dark');
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try { localStorage.setItem('fixit_theme', theme); } catch { /* ignore */ }
  }, [theme]);

  // ── Onboarding (first launch only) ──────────────────────────────────────────
  const [onboarded, setOnboarded] = useState(() => localStorage.getItem('fixit_onboarded') === 'true');
  const handleOnboardingComplete = useCallback(() => {
    try { localStorage.setItem('fixit_onboarded', 'true'); } catch { /* ignore */ }
    setOnboarded(true);
  }, []);
  // mechanicScreen: null | { diagnosis: object|null, dtcContext: object|null, serviceFilter: string|null }
  const [mechanicScreen, setMechanicScreen] = useState(null);

  // ── Vehicle (persisted under fixit_vehicle_info) ───────────────────────────
  const [vehicleInfo, setVehicleInfo] = useState(() => ({
    ...EMPTY_VEHICLE_INFO,
    ...readLS('fixit_vehicle_info', {}),
  }));
  const [location,       setLocation]       = useState(() => readLS('fixit_prefs', {}).location || '');
  const [locationCoords, setLocationCoords] = useState(() => readLS('fixit_prefs', {}).locationCoords || null); // { lat, lon } | null
  const [units,          setUnits]          = useState(() => readLS('fixit_prefs', {}).units || 'metric');

  // ── Vehicle photo ──────────────────────────────────────────────────────────
  // Shape: null  |  { dataUrl: string, analysis: object|null }
  const [vehiclePhoto,        setVehiclePhoto]        = useState(null);
  const [vehiclePhotoLoading, setVehiclePhotoLoading] = useState(false);
  const [vehiclePhotoError,   setVehiclePhotoError]   = useState(null);

  // Load photo from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('fixit_vehicle_photo');
      if (saved) setVehiclePhoto(JSON.parse(saved));
    } catch { /* quota or parse error — ignore */ }
  }, []);

  // Persist photo to localStorage whenever it changes
  useEffect(() => {
    try {
      if (vehiclePhoto?.dataUrl) {
        localStorage.setItem('fixit_vehicle_photo', JSON.stringify(vehiclePhoto));
      } else {
        localStorage.removeItem('fixit_vehicle_photo');
      }
    } catch (err) {
      // Quota exceeded (large images) — not critical
      console.warn('[photo] localStorage quota:', err.message);
    }
  }, [vehiclePhoto]);

  // ── OBD2 ───────────────────────────────────────────────────────────────────
  const [obd2Connected,   setObd2Connected]   = useState(false);
  const [obd2DeviceName,  setObd2DeviceName]  = useState('');
  const [obd2Connecting,  setObd2Connecting]  = useState(false);
  const [mockScenarioIdx, setMockScenarioIdx] = useState(0);
  const [liveData,   setLiveData]   = useState(null);
  const [faultCodes, setFaultCodes] = useState([]);

  // ── Diagnosis history (persisted) ──────────────────────────────────────────
  const [recentDiagnoses, setRecentDiagnoses] = useState(() => {
    const saved = readLS('fixit_recent_diagnoses', []);
    return Array.isArray(saved) ? saved : [];
  });

  // ── Maintenance (persisted) ────────────────────────────────────────────────
  const [maintenanceSchedule, setMaintenanceSchedule] = useState(() => hydrateSchedule(readLS('fixit_maintenance_schedule', null)));

  // ── Service records (persisted under fixit_service_history) ───────────────
  const [serviceRecords, setServiceRecords] = useState(() => {
    const saved = readLS('fixit_service_history', []);
    return Array.isArray(saved) ? saved : [];
  });

  // ── Recalls (fetched from backend, which queries NHTSA) ───────────────────
  const [recalls, setRecalls] = useState([]);

  // ── Alerts seen (persisted — drives the unread badge on the Home bell) ────
  const [alertsSeen, setAlertsSeen] = useState(() => {
    const saved = readLS('fixit_alerts_seen', []);
    return Array.isArray(saved) ? saved : [];
  });

  // ── Alerts dismissed (persisted — removed from the bell sheet) ────────────
  const [alertsDismissed, setAlertsDismissed] = useState(() => {
    const saved = readLS('fixit_alerts_dismissed', []);
    return Array.isArray(saved) ? saved : [];
  });

  // ── Persistence write effects ──────────────────────────────────────────────
  useEffect(() => { writeLS('fixit_vehicle_info', vehicleInfo); }, [vehicleInfo]);
  useEffect(() => { writeLS('fixit_service_history', serviceRecords); }, [serviceRecords]);
  useEffect(() => { writeLS('fixit_maintenance_schedule', maintenanceSchedule); }, [maintenanceSchedule]);
  useEffect(() => { writeLS('fixit_recent_diagnoses', recentDiagnoses); }, [recentDiagnoses]);
  useEffect(() => { writeLS('fixit_alerts_seen', alertsSeen); }, [alertsSeen]);
  useEffect(() => { writeLS('fixit_alerts_dismissed', alertsDismissed); }, [alertsDismissed]);
  useEffect(() => { writeLS('fixit_prefs', { units, location, locationCoords }); }, [units, location, locationCoords]);

  // ── Derived vehicle data ───────────────────────────────────────────────────
  const currentOdoKm = useMemo(
    () => odoToKm(parseFloat(vehicleInfo.odometer) || 0, vehicleInfo.odometerUnit || 'km'),
    [vehicleInfo.odometer, vehicleInfo.odometerUnit]
  );

  const vehicleSpecs = useMemo(
    () => getSpecsForVehicle(vehicleInfo.make, vehicleInfo.model, vehicleInfo.year, vehicleInfo.trim),
    [vehicleInfo.make, vehicleInfo.model, vehicleInfo.year, vehicleInfo.trim]
  );

  const vehicleSchedule = useMemo(
    () => getScheduleForVehicle(vehicleInfo.make, vehicleInfo.model),
    [vehicleInfo.make, vehicleInfo.model]
  );

  const maintenanceDue = useMemo(
    () => computeMaintenanceDue(maintenanceSchedule, vehicleSchedule, currentOdoKm),
    [maintenanceSchedule, vehicleSchedule, currentOdoKm]
  );

  // ── Health score (persisted so it survives reloads without OBD2) ──────────
  const healthScore = useMemo(
    () => computeHealthScore({
      obd2Connected,
      faultCodes,
      liveData,
      maintenanceDue,
      recentDiagnoses,
      oilOverKm: oilOverdueKm(maintenanceDue),
    }),
    [obd2Connected, faultCodes, liveData, maintenanceDue, recentDiagnoses]
  );

  useEffect(() => {
    writeLS('fixit_health_score', { score: healthScore, computedAt: new Date().toISOString() });
  }, [healthScore]);

  // ── Backend keepalive (Render free tier sleeps after ~15 min idle) ────────
  useEffect(() => {
    const ping = () => fetch('/api/health').catch(() => {});
    ping(); // wake the backend immediately on load
    const interval = setInterval(ping, 10 * 60 * 1000); // every 10 minutes
    return () => clearInterval(interval);
  }, []);

  // ── Real vehicle photo from Wikipedia (when no customer photo) ─────────────
  const [wikiVehicleImage, setWikiVehicleImage] = useState(null);
  useEffect(() => {
    if (!vehicleInfo?.make || !vehicleInfo?.model) { setWikiVehicleImage(null); return; }
    if (vehiclePhoto?.dataUrl) return; // customer uploaded their own photo — skip
    let cancelled = false;
    fetch(`/api/vehicle-image?make=${encodeURIComponent(vehicleInfo.make)}&model=${encodeURIComponent(vehicleInfo.model)}`)
      .then(r => r.json())
      .then(data => { if (!cancelled) setWikiVehicleImage(data.imageUrl || null); })
      .catch(() => { if (!cancelled) setWikiVehicleImage(null); });
    return () => { cancelled = true; };
  }, [vehicleInfo?.make, vehicleInfo?.model, vehiclePhoto?.dataUrl]);

  // ── Recall check — when the vehicle identity changes ──────────────────────
  useEffect(() => {
    let cancelled = false;
    if (!vehicleInfo.make || !vehicleInfo.model) { setRecalls([]); return; }
    fetchSpecsAndRecalls(vehicleInfo.make, vehicleInfo.model, vehicleInfo.year, vehicleInfo.trim)
      .then(({ recalls: r }) => { if (!cancelled) setRecalls(r || []); })
      .catch(() => { if (!cancelled) setRecalls([]); });
    return () => { cancelled = true; };
  }, [vehicleInfo.make, vehicleInfo.model, vehicleInfo.year, vehicleInfo.trim]);

  // ── Unified alerts + unread tracking (shown in the Home header bell) ──────
  const alerts = useMemo(
    () => generateAlerts({ faultCodes, maintenanceDue, recalls, recentDiagnoses })
      .filter(a => !alertsDismissed.includes(a.id)),
    [faultCodes, maintenanceDue, recalls, recentDiagnoses, alertsDismissed]
  );

  const unreadAlertCount = useMemo(
    () => alerts.filter(a => !alertsSeen.includes(a.id)).length,
    [alerts, alertsSeen]
  );

  // Mark all current alerts as seen (called when the bell sheet opens)
  const handleMarkAlertsSeen = useCallback(() => {
    setAlertsSeen(prev => {
      const ids = alerts.map(a => a.id);
      const same = ids.length === prev.length && ids.every(id => prev.includes(id));
      return same ? prev : ids;
    });
  }, [alerts]);

  const handleDismissAlert = useCallback((id) => {
    setAlertsDismissed(prev => prev.includes(id) ? prev : [...prev, id]);
  }, []);

  const handleClearAllAlerts = useCallback(() => {
    setAlertsDismissed(prev => {
      const ids = alerts.map(a => a.id);
      return [...new Set([...prev, ...ids])];
    });
  }, [alerts]);

  // ── OBD2 connection listener ───────────────────────────────────────────────
  useEffect(() => {
    obd2Service.onConnectionChange(info => {
      setObd2Connected(info.connected);
      setObd2DeviceName(info.deviceName || '');
      if (!info.connected) { setLiveData(null); setFaultCodes([]); }
    });
  }, []);

  // ── Live sensor polling ────────────────────────────────────────────────────
  useEffect(() => {
    if (!obd2Connected) return;
    let cancelled = false;
    async function poll() {
      const data = await obd2Service.readAllSensors().catch(() => null);
      if (!cancelled && data) setLiveData(data);
    }
    poll();
    const id = setInterval(poll, 2000);
    return () => { cancelled = true; clearInterval(id); };
  }, [obd2Connected]);

  // ── Fault code polling ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!obd2Connected) return;
    let cancelled = false;
    async function poll() {
      const codes = await obd2Service.readFaultCodes().catch(() => []);
      if (!cancelled) setFaultCodes(codes || []);
    }
    poll();
    const id = setInterval(poll, 15000);
    return () => { cancelled = true; clearInterval(id); };
  }, [obd2Connected]);

  // ── OBD2 handlers ──────────────────────────────────────────────────────────
  const handleConnectScanner = useCallback(async () => {
    setObd2Connecting(true);
    try {
      await obd2Service.connectScanner();
    } catch (err) {
      if (err.name !== 'NotFoundError') console.error('Scanner:', err.message);
    } finally {
      setObd2Connecting(false);
    }
  }, []);

  const handleConnectMock = useCallback(async () => {
    setObd2Connecting(true);
    try {
      await obd2Service.connectMock(mockScenarioIdx);
      setMockScenarioIdx(prev => (prev + 1) % 3);
    } catch (err) {
      console.error('Mock:', err.message);
    } finally {
      setObd2Connecting(false);
    }
  }, [mockScenarioIdx]);

  const handleDisconnectScanner = useCallback(async () => {
    await obd2Service.disconnectScanner().catch(() => {});
  }, []);

  // ── Diagnosis complete ─────────────────────────────────────────────────────
  const handleDiagnosisComplete = useCallback((entry) => {
    setRecentDiagnoses(prev => [entry, ...prev].slice(0, 20));
  }, []);

  // ── Mechanic screen handlers ───────────────────────────────────────────────
  const handleOpenMechanic = useCallback((diagnosis = null, opts = {}) => {
    setDiagnoseOpen(false);
    setMechanicScreen({
      diagnosis,
      dtcContext:    opts.dtcContext    || null,
      serviceFilter: opts.serviceFilter || null,
    });
  }, []);

  // Open MechanicScreen pre-loaded with a fault code as the diagnosis context
  const handleFindMechanicForCode = useCallback((fc) => {
    setMechanicScreen({
      diagnosis: {
        primary: { diagnosis: `${fc.code} — ${fc.description || 'Fault code'}` },
      },
      dtcContext:    fc,
      serviceFilter: null,
    });
  }, []);

  const handleCloseMechanic = useCallback(() => {
    setMechanicScreen(null);
  }, []);

  // ── Vehicle helpers ────────────────────────────────────────────────────────
  const handleVehicleInfoChange = useCallback((updates) => {
    setVehicleInfo(prev => ({ ...prev, ...updates }));
  }, []);

  // ── Vehicle photo handlers ─────────────────────────────────────────────────
  const handleVehiclePhotoSelect = useCallback(async (file) => {
    if (!file) return;
    setVehiclePhotoError(null);
    setVehiclePhotoLoading(true);

    try {
      const rawDataUrl = await readFileAsDataUrl(file);
      const compressed = await compressImage(rawDataUrl, 1200, 0.82);

      // Show photo immediately while analysis runs (optimistic)
      setVehiclePhoto({ dataUrl: compressed, analysis: null });

      const base64 = compressed.split(',')[1];
      const res    = await fetch('/api/analyze-vehicle-photo', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ image: base64, mimeType: 'image/jpeg' }),
      });

      if (res.status === 422) {
        const body = await res.json();
        setVehiclePhoto(null);
        setVehiclePhotoError(body.error || 'No vehicle detected');
      } else if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        console.error('[photo] API error:', body.error);
        // Keep photo — just without analysis
      } else {
        const { result } = await res.json();
        setVehiclePhoto({ dataUrl: compressed, analysis: result });
      }
    } catch (err) {
      console.error('[photo]', err.message);
      // Keep photo if we already set it — analysis is optional
    } finally {
      setVehiclePhotoLoading(false);
    }
  }, []);

  const handleVehiclePhotoRemove = useCallback(() => {
    setVehiclePhoto(null);
    setVehiclePhotoError(null);
  }, []);

  // ── Maintenance helpers ────────────────────────────────────────────────────
  const handleMaintenanceUpdate = useCallback((key, updates) => {
    setMaintenanceSchedule(prev => ({
      ...prev,
      [key]: { ...(prev[key] || {}), ...updates },
    }));
  }, []);

  const handleMaintenanceReset = useCallback((vehicleDefaults) => {
    setMaintenanceSchedule(prev => {
      const next = { ...prev };
      for (const [key, val] of Object.entries(vehicleDefaults)) {
        next[key] = { ...(prev[key] || {}), intervalKm: val.intervalKm };
      }
      return next;
    });
  }, []);

  // ── Service record helpers ─────────────────────────────────────────────────
  const handleAddServiceRecord = useCallback((record) => {
    setServiceRecords(prev => [record, ...prev]);
    // Also update maintenance schedule lastDate/lastKm for matching service types
    const keyMap = {
      'Oil Change':              'oil',
      'Tire Rotation':           'tires',
      'Brake Pad Replacement':   'brakes',
      'Brake Rotor Replacement': 'brakes',
      'Air Filter':              'airFilter',
      'Cabin Air Filter':        'cabinFilter',
      'Spark Plugs':             'sparkPlugs',
      'Coolant Flush':           'coolant',
      'Transmission Fluid':      'transmissionFluid',
      'Battery Replacement':     'battery',
      'Serpentine Belt':         'serpentineBelt',
    };
    for (const svc of (record.services || [])) {
      const mKey = keyMap[svc.type];
      if (mKey) {
        setMaintenanceSchedule(prev => ({
          ...prev,
          [mKey]: {
            ...(prev[mKey] || {}),
            lastDate: record.date || prev[mKey]?.lastDate,
            lastKm:   record.mileageKm || prev[mKey]?.lastKm,
          },
        }));
      }
    }
  }, []);

  const handleDeleteServiceRecord = useCallback((id) => {
    setServiceRecords(prev => prev.filter(r => r.id !== id));
  }, []);

  // ── Clear all ──────────────────────────────────────────────────────────────
  const handleClearAll = useCallback(() => {
    setRecentDiagnoses([]);
    setMaintenanceSchedule(DEFAULT_MAINTENANCE);
    setServiceRecords([]);
    setVehiclePhoto(null);
    setVehiclePhotoError(null);
    setVehicleInfo({ ...EMPTY_VEHICLE_INFO });
    setLocation('');
    setLocationCoords(null);
    setRecalls([]);
    setAlertsSeen([]);
    // Remove every persisted key so the cleared state survives a refresh
    for (const key of [
      'fixit_vehicle_info', 'fixit_service_history', 'fixit_maintenance_schedule',
      'fixit_recent_diagnoses', 'fixit_health_score', 'fixit_alerts_seen', 'fixit_prefs',
    ]) {
      try { localStorage.removeItem(key); } catch { /* ignore */ }
    }
    clearRecallsCache();
  }, []);

  // ── FAB visibility ─────────────────────────────────────────────────────────
  const showFAB = ['home', 'maintenance'].includes(activeTab) && !diagnoseOpen && !mechanicScreen;

  // ── First-launch onboarding ────────────────────────────────────────────────
  if (!onboarded) {
    return <OnboardingScreen onComplete={handleOnboardingComplete} />;
  }

  return (
    <div className="app" style={{ display: 'flex', flexDirection: 'column', minHeight: '100svh' }}>
      {/* ── Tab content ── */}
      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: '72px' }}>
        {activeTab === 'home' && (
          <HomeTab
            vehicleInfo={vehicleInfo}
            onVehicleInfoChange={handleVehicleInfoChange}
            liveData={liveData}
            faultCodes={faultCodes}
            obd2Connected={obd2Connected}
            obd2DeviceName={obd2DeviceName}
            obd2Connecting={obd2Connecting}
            onObd2Connect={handleConnectScanner}
            onObd2ConnectMock={handleConnectMock}
            onObd2Disconnect={handleDisconnectScanner}
            recentDiagnoses={recentDiagnoses}
            units={units}
            vehiclePhoto={vehiclePhoto}
            vehiclePhotoLoading={vehiclePhotoLoading}
            vehiclePhotoError={vehiclePhotoError}
            wikiVehicleImage={wikiVehicleImage}
            onPhotoFileSelect={handleVehiclePhotoSelect}
            onPhotoRemove={handleVehiclePhotoRemove}
            onFindMechanic={() => handleOpenMechanic(null)}
            healthScore={healthScore}
            vehicleSpecs={vehicleSpecs}
            maintenanceDue={maintenanceDue}
            serviceRecords={serviceRecords}
            currentOdoKm={currentOdoKm}
            onStartDiagnosis={() => setDiagnoseOpen(true)}
            onNavigateTab={setActiveTab}
            theme={theme}
            onThemeChange={setTheme}
            onUnitsChange={setUnits}
            onClearAll={handleClearAll}
            alerts={alerts}
            unreadAlertCount={unreadAlertCount}
            onMarkAlertsSeen={handleMarkAlertsSeen}
            onDismissAlert={handleDismissAlert}
            onClearAlerts={handleClearAllAlerts}
          />
        )}
        {activeTab === 'live' && (
          <LiveTab
            liveData={liveData}
            faultCodes={faultCodes}
            obd2Connected={obd2Connected}
            obd2DeviceName={obd2DeviceName}
            obd2Connecting={obd2Connecting}
            onObd2Connect={handleConnectScanner}
            onObd2ConnectMock={handleConnectMock}
            onObd2Disconnect={handleDisconnectScanner}
            mockScenarioIdx={mockScenarioIdx}
            units={units}
            healthScore={healthScore}
            onFindMechanicForCode={handleFindMechanicForCode}
          />
        )}
        {activeTab === 'maintenance' && (
          <MaintenanceTab
            schedule={maintenanceSchedule}
            onUpdate={handleMaintenanceUpdate}
            onReset={handleMaintenanceReset}
            vehicleInfo={vehicleInfo}
            units={units}
            serviceRecords={serviceRecords}
            onAddServiceRecord={handleAddServiceRecord}
            onDeleteServiceRecord={handleDeleteServiceRecord}
            maintenanceDue={maintenanceDue}
          />
        )}
        {activeTab === 'autoshop' && (
          <MechanicScreen
            embedded
            location={location}
            locationCoords={locationCoords}
            vehicleInfo={vehicleInfo}
            diagnosis={null}
            onBack={() => setActiveTab('home')}
          />
        )}
        {activeTab === 'vehicle' && (
          <VehicleTab
            vehicleInfo={vehicleInfo}
            vehicleSpecs={vehicleSpecs}
            onVehicleInfoChange={handleVehicleInfoChange}
            location={location}
            onLocationChange={setLocation}
            onLocationCoordsChange={setLocationCoords}
            recentDiagnoses={recentDiagnoses}
            units={units}
            onUnitsChange={setUnits}
            obd2Connected={obd2Connected}
            obd2DeviceName={obd2DeviceName}
            onObd2Disconnect={handleDisconnectScanner}
            onClearAll={handleClearAll}
            vehiclePhoto={vehiclePhoto}
            vehiclePhotoLoading={vehiclePhotoLoading}
            wikiVehicleImage={wikiVehicleImage}
            onPhotoFileSelect={handleVehiclePhotoSelect}
            onPhotoRemove={handleVehiclePhotoRemove}
          />
        )}
      </div>

      {/* ── Tab bar ── */}
      <TabBar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        showFAB={showFAB}
        onDiagnosePress={() => setDiagnoseOpen(true)}
      />

      {/* ── Diagnose modal ── */}
      {diagnoseOpen && (
        <DiagnoseModal
          isOpen={diagnoseOpen}
          onClose={() => setDiagnoseOpen(false)}
          vehicleInfo={vehicleInfo}
          vehicleSpecs={vehicleSpecs}
          odometerKm={currentOdoKm}
          lastOilChangeKm={maintenanceSchedule.oil?.lastKm ?? null}
          location={location}
          onLocationChange={setLocation}
          obd2Connected={obd2Connected}
          onDiagnosisComplete={handleDiagnosisComplete}
          onFindMechanic={handleOpenMechanic}
        />
      )}

      {/* ── Mechanic screen overlay ── */}
      {mechanicScreen && (
        <MechanicScreen
          location={location}
          locationCoords={locationCoords}
          vehicleInfo={vehicleInfo}
          diagnosis={mechanicScreen.diagnosis}
          dtcContext={mechanicScreen.dtcContext}
          initialServiceFilter={mechanicScreen.serviceFilter}
          onBack={handleCloseMechanic}
        />
      )}
    </div>
  );
}
