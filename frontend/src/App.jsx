import { useState, useCallback, useEffect } from 'react';
import HomeScreen      from './components/HomeScreen.jsx';
import GuidedScreen    from './components/GuidedScreen.jsx';
import RecordingScreen from './components/RecordingScreen.jsx';
import AnalyzingScreen from './components/AnalyzingScreen.jsx';
import ResultsScreen   from './components/ResultsScreen.jsx';
import { audioService } from './services/audioService.js';
import * as obd2Service  from './services/obd2Service.js';
import { diagnose }     from './services/api.js';

const SCREENS = {
  HOME:      'home',
  GUIDED:    'guided',
  RECORDING: 'recording',
  ANALYZING: 'analyzing',
  RESULTS:   'results',
};

export default function App() {
  const [screen,          setScreen]          = useState(SCREENS.HOME);
  const [diagnosis,       setDiagnosis]       = useState(null);
  const [error,           setError]           = useState(null);
  const [recentDiagnoses, setRecentDiagnoses] = useState([]);

  // ── Persistent state ────────────────────────────────────────────────────────
  const [vehicleInfo, setVehicleInfo] = useState({ year: '', make: '', model: '' });
  const [location,    setLocation]    = useState('');

  // Media data for the simple (non-guided) flow
  const [mediaData, setMediaData] = useState({ textDescription: '', photos: [], videoFrames: [], videoName: '' });

  // ── OBD2 scanner state ──────────────────────────────────────────────────────
  const [obd2Connected,  setObd2Connected]  = useState(false);
  const [obd2DeviceName, setObd2DeviceName] = useState('');
  const [obd2Connecting, setObd2Connecting] = useState(false);
  const [mockScenarioIdx, setMockScenarioIdx] = useState(0);

  // Register for OBD2 connection state changes (once, on mount)
  useEffect(() => {
    obd2Service.onConnectionChange(info => {
      setObd2Connected(info.connected);
      setObd2DeviceName(info.deviceName || '');
    });
  }, []);

  const handleVehicleInfoChange = useCallback((updates) => {
    setVehicleInfo(prev => ({ ...prev, ...updates }));
  }, []);

  const handleMediaDataChange = useCallback((updates) => {
    setMediaData(prev => ({ ...prev, ...updates }));
  }, []);

  // ── OBD2 handlers ───────────────────────────────────────────────────────────
  const handleConnectScanner = useCallback(async () => {
    setObd2Connecting(true);
    setError(null);
    try {
      await obd2Service.connectScanner();
    } catch (err) {
      // NotFoundError = user cancelled the device picker — not worth showing an error
      if (err.name !== 'NotFoundError') {
        setError(`Scanner connection failed: ${err.message}`);
      }
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
      setError(`Demo failed: ${err.message}`);
    } finally {
      setObd2Connecting(false);
    }
  }, [mockScenarioIdx]);

  const handleDisconnectScanner = useCallback(async () => {
    await obd2Service.disconnectScanner().catch(() => {});
  }, []);

  // ── Helper: save entry ──────────────────────────────────────────────────────
  function saveEntry(result, { duration, hasVisualMedia }) {
    const entry = {
      ...result,
      id:            Date.now(),
      recordedAt:    new Date().toISOString(),
      duration,
      vehicleInfo:   vehicleInfo.make ? { ...vehicleInfo } : null,
      hasVisualMedia,
      location:      location.trim() || null,
    };
    setDiagnosis(entry);
    setRecentDiagnoses(prev => [entry, ...prev].slice(0, 10));
    return entry;
  }

  // ── Guided flow ─────────────────────────────────────────────────────────────
  const handleStartGuided = useCallback(() => {
    setError(null);
    setScreen(SCREENS.GUIDED);
  }, []);

  // "Skip All & Just Record" from GuidedScreen
  const handleSkipToRecord = useCallback(async () => {
    setError(null);
    try {
      await audioService.start();
      setScreen(SCREENS.RECORDING);
    } catch (err) {
      setError(
        err.name === 'NotAllowedError'
          ? 'Microphone access denied. Please allow microphone access and try again.'
          : `Could not access microphone: ${err.message}`
      );
      setScreen(SCREENS.HOME);
    }
  }, []);

  // GuidedScreen "Run Diagnosis" → ANALYZING
  const handleGuidedComplete = useCallback(async (data) => {
    setScreen(SCREENS.ANALYZING);
    try {
      const hasVisualMedia = (data.images?.length ?? 0) > 0 || (data.videoFrames?.length ?? 0) > 0;

      const result = await diagnose({
        description:          data.primaryDescription,
        duration:             data.primaryDuration,
        vehicleInfo:          vehicleInfo.make ? vehicleInfo : undefined,
        textDescription:      data.textDescription,
        images:               data.images,
        videoFrames:          data.videoFrames,
        additionalRecordings: data.additionalRecordings,
        obd2Data:             data.obd2Data || undefined,
      });

      saveEntry(result, { duration: data.primaryDuration, hasVisualMedia });
      setScreen(SCREENS.RESULTS);
    } catch (err) {
      console.error('[App] guided diagnosis failed:', err);
      setError(`Diagnosis failed: ${err.message}`);
      setScreen(SCREENS.HOME);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vehicleInfo, location]);

  // ── Simple recording flow ───────────────────────────────────────────────────
  const handleStopRecording = useCallback(async () => {
    setScreen(SCREENS.ANALYZING);
    try {
      // Capture audio + OBD2 sensors in parallel (different hardware — no conflict)
      const [audioResult, sensorData] = await Promise.all([
        audioService.stop(),
        obd2Connected
          ? obd2Service.readAllSensors().catch(() => null)
          : Promise.resolve(null),
      ]);

      const { description, duration } = audioResult;
      const snap          = mediaData;
      const hasVisualMedia = snap.photos.length > 0 || snap.videoFrames.length > 0;

      // Fault codes are read sequentially after sensors (same BLE channel)
      let obd2Data = undefined;
      if (sensorData) {
        const faultCodes = await obd2Service.readFaultCodes().catch(() => []);
        obd2Data = { sensors: sensorData, faultCodes };
      }

      const result = await diagnose({
        description,
        duration,
        vehicleInfo:     vehicleInfo.make ? vehicleInfo : undefined,
        textDescription: snap.textDescription || undefined,
        images:          snap.photos.map(p => ({ base64: p.base64, mediaType: p.mediaType || 'image/jpeg' })),
        videoFrames:     snap.videoFrames,
        obd2Data,
      });

      saveEntry(result, { duration, hasVisualMedia });
      setMediaData(prev => ({ ...prev, photos: [], videoFrames: [], videoName: '' }));
      setScreen(SCREENS.RESULTS);
    } catch (err) {
      console.error('[App] diagnosis failed:', err);
      setError(`Diagnosis failed: ${err.message}`);
      setScreen(SCREENS.HOME);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vehicleInfo, location, mediaData, obd2Connected]);

  const handleCancelRecording = useCallback(async () => {
    await audioService.cancel();
    setScreen(SCREENS.HOME);
  }, []);

  // ── Results navigation ──────────────────────────────────────────────────────
  const handleDiagnoseAgain = useCallback(() => {
    setDiagnosis(null);
    setError(null);
    setScreen(SCREENS.HOME);
  }, []);

  const handleViewHistory = useCallback((entry) => {
    setDiagnosis(entry);
    setScreen(SCREENS.RESULTS);
  }, []);

  // ── Location inline update from ResultsScreen ───────────────────────────────
  const handleSetLocation = useCallback((loc) => {
    setLocation(loc);
    setDiagnosis(prev => prev ? { ...prev, location: loc || null } : prev);
  }, []);

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <>
      {screen === SCREENS.HOME && (
        <HomeScreen
          onStartGuided={handleStartGuided}
          recentDiagnoses={recentDiagnoses}
          onViewHistory={handleViewHistory}
          error={error}
          vehicleInfo={vehicleInfo}
          onVehicleInfoChange={handleVehicleInfoChange}
          location={location}
          onLocationChange={setLocation}
          mediaData={mediaData}
          onMediaDataChange={handleMediaDataChange}
          obd2Connected={obd2Connected}
          obd2DeviceName={obd2DeviceName}
          obd2Connecting={obd2Connecting}
          onObd2Connect={handleConnectScanner}
          onObd2ConnectMock={handleConnectMock}
          onObd2Disconnect={handleDisconnectScanner}
        />
      )}
      {screen === SCREENS.GUIDED && (
        <GuidedScreen
          initialText={mediaData.textDescription}
          obd2Connected={obd2Connected}
          onComplete={handleGuidedComplete}
          onSkipToRecord={handleSkipToRecord}
          onBack={() => setScreen(SCREENS.HOME)}
        />
      )}
      {screen === SCREENS.RECORDING && (
        <RecordingScreen onStop={handleStopRecording} onCancel={handleCancelRecording} />
      )}
      {screen === SCREENS.ANALYZING && (
        <AnalyzingScreen />
      )}
      {screen === SCREENS.RESULTS && diagnosis && (
        <ResultsScreen
          diagnosis={diagnosis}
          onDiagnoseAgain={handleDiagnoseAgain}
          onSetLocation={handleSetLocation}
        />
      )}
    </>
  );
}
