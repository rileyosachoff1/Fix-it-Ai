import { useState, useEffect, useCallback } from 'react';
import TabBar          from './components/TabBar.jsx';
import HomeTab         from './components/HomeTab.jsx';
import LiveTab         from './components/LiveTab.jsx';
import AlertsTab       from './components/AlertsTab.jsx';
import MaintenanceTab  from './components/MaintenanceTab.jsx';
import VehicleTab      from './components/VehicleTab.jsx';
import DiagnoseModal   from './components/DiagnoseModal.jsx';
import MechanicScreen  from './screens/MechanicScreen.jsx';
import { DEFAULT_SCHEDULE } from './data/serviceSchedules.js';
import * as obd2Service from './services/obd2Service.js';

// Build DEFAULT_MAINTENANCE from serviceSchedules (all intervals in km)
const DEFAULT_MAINTENANCE = Object.fromEntries(
  Object.entries(DEFAULT_SCHEDULE).map(([key, val]) => [
    key,
    { lastDate: null, lastKm: null, intervalKm: val.intervalKm, label: val.label },
  ])
);

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
  // mechanicScreen: null | { diagnosis: object|null }
  const [mechanicScreen, setMechanicScreen] = useState(null);

  // ── Vehicle ────────────────────────────────────────────────────────────────
  const [vehicleInfo, setVehicleInfo] = useState({
    year: '', make: '', model: '', trim: '',
    nickname: '', vehicleColor: '',
    odometer: '', odometerUnit: 'km',
    postalCode: '',
    licensePlate: '', vin: '', purchaseDate: '',
  });
  const [location,       setLocation]       = useState('');
  const [locationCoords, setLocationCoords] = useState(null); // { lat, lon } | null
  const [units,          setUnits]          = useState('metric');

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

  // ── Diagnosis history ──────────────────────────────────────────────────────
  const [recentDiagnoses, setRecentDiagnoses] = useState([]);

  // ── Maintenance ────────────────────────────────────────────────────────────
  const [maintenanceSchedule, setMaintenanceSchedule] = useState(DEFAULT_MAINTENANCE);

  // ── Service records ────────────────────────────────────────────────────────
  const [serviceRecords, setServiceRecords] = useState([]);

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
  const handleOpenMechanic = useCallback((diagnosis = null) => {
    setDiagnoseOpen(false);
    setMechanicScreen({ diagnosis });
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
    setVehicleInfo({
      year: '', make: '', model: '', trim: '', nickname: '', vehicleColor: '',
      odometer: '', odometerUnit: 'km', postalCode: '',
      licensePlate: '', vin: '', purchaseDate: '',
    });
    setLocation('');
    setLocationCoords(null);
  }, []);

  // ── FAB visibility ─────────────────────────────────────────────────────────
  const showFAB = ['home', 'alerts', 'maintenance'].includes(activeTab) && !diagnoseOpen && !mechanicScreen;

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
            onPhotoFileSelect={handleVehiclePhotoSelect}
            onPhotoRemove={handleVehiclePhotoRemove}
            onFindMechanic={() => handleOpenMechanic(null)}
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
          />
        )}
        {activeTab === 'alerts' && (
          <AlertsTab
            faultCodes={faultCodes}
            recentDiagnoses={recentDiagnoses}
            onClearFaults={handleDisconnectScanner}
          />
        )}
        {activeTab === 'vehicle' && (
          <VehicleTab
            vehicleInfo={vehicleInfo}
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
        alertCount={faultCodes.length}
      />

      {/* ── Diagnose modal ── */}
      {diagnoseOpen && (
        <DiagnoseModal
          isOpen={diagnoseOpen}
          onClose={() => setDiagnoseOpen(false)}
          vehicleInfo={vehicleInfo}
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
          onBack={handleCloseMechanic}
        />
      )}
    </div>
  );
}
