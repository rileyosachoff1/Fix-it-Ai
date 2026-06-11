import { useState, useEffect, useRef, useCallback } from 'react';
import GuidedScreen    from './GuidedScreen.jsx';
import RecordingScreen from './RecordingScreen.jsx';
import AnalyzingScreen from './AnalyzingScreen.jsx';
import ResultsScreen   from './ResultsScreen.jsx';
import { audioService } from '../services/audioService.js';
import * as obd2Service  from '../services/obd2Service.js';
import { diagnose }     from '../services/api.js';
import './DiagnoseModal.css';

// Internal phase states — mirrors the old App.jsx screen state machine
const PHASE = {
  GUIDED:    'guided',
  RECORDING: 'recording',
  ANALYZING: 'analyzing',
  RESULTS:   'results',
};

export default function DiagnoseModal({
  isOpen, onClose,
  vehicleInfo, vehicleSpecs, odometerKm, lastOilChangeKm,
  location, onLocationChange,
  obd2Connected,
  onDiagnosisComplete,
  onFindMechanic,
}) {
  const [phase,     setPhase]     = useState(PHASE.GUIDED);
  const [diagnosis, setDiagnosis] = useState(null);
  const [error,     setError]     = useState(null);
  const [mediaData, setMediaData] = useState({
    textDescription: '', photos: [], videoFrames: [], videoName: '',
  });

  const phaseRef = useRef(PHASE.GUIDED);
  useEffect(() => { phaseRef.current = phase; }, [phase]);

  // Reset when modal opens
  useEffect(() => {
    if (isOpen) {
      setPhase(PHASE.GUIDED);
      setDiagnosis(null);
      setError(null);
      setMediaData({ textDescription: '', photos: [], videoFrames: [], videoName: '' });
    }
  }, [isOpen]);

  // Cleanup: cancel recording if modal closes while recording
  useEffect(() => {
    if (!isOpen && phaseRef.current === PHASE.RECORDING) {
      audioService.cancel().catch(() => {});
    }
  }, [isOpen]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = ''; };
    }
  }, [isOpen]);

  // ── Helper: build entry ──────────────────────────────────────────────────
  function makeEntry(result, { duration = 0, hasVisualMedia = false } = {}) {
    const entry = {
      ...result,
      id:            Date.now(),
      recordedAt:    new Date().toISOString(),
      duration,
      vehicleInfo:   vehicleInfo?.make ? { ...vehicleInfo } : null,
      hasVisualMedia,
      location:      location?.trim() || null,
    };
    setDiagnosis(entry);
    onDiagnosisComplete?.(entry);
    return entry;
  }

  // ── Guided → Analyzing → Results ────────────────────────────────────────
  const handleGuidedComplete = useCallback(async (data) => {
    setError(null);
    setPhase(PHASE.ANALYZING);
    try {
      const hasVisualMedia = (data.images?.length ?? 0) > 0 || (data.videoFrames?.length ?? 0) > 0;
      const result = await diagnose({
        description:          data.primaryDescription,
        duration:             data.primaryDuration,
        vehicleInfo:          vehicleInfo?.make ? vehicleInfo : undefined,
        vehicleSpecs:         vehicleSpecs || undefined,
        odometerKm:           odometerKm || undefined,
        lastOilChangeKm:      lastOilChangeKm ?? undefined,
        textDescription:      data.textDescription,
        images:               data.images,
        videoFrames:          data.videoFrames,
        additionalRecordings: data.additionalRecordings,
        obd2Data:             data.obd2Data || undefined,
      });
      makeEntry(result, { duration: data.primaryDuration, hasVisualMedia });
      setPhase(PHASE.RESULTS);
    } catch (err) {
      console.error('[DiagnoseModal] guided diagnosis failed:', err);
      setError(`Diagnosis failed: ${err.message}`);
      setPhase(PHASE.GUIDED);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vehicleInfo, vehicleSpecs, odometerKm, lastOilChangeKm, location]);

  // ── Skip → Recording ────────────────────────────────────────────────────
  const handleSkipToRecord = useCallback(async () => {
    setError(null);
    try {
      await audioService.start();
      setPhase(PHASE.RECORDING);
    } catch (err) {
      setError(
        err.name === 'NotAllowedError'
          ? 'Microphone access denied. Please allow microphone access and try again.'
          : `Could not access microphone: ${err.message}`
      );
    }
  }, []);

  // ── Stop recording → Analyzing → Results ────────────────────────────────
  const handleStopRecording = useCallback(async () => {
    setError(null);
    setPhase(PHASE.ANALYZING);
    try {
      const [audioResult, sensorData] = await Promise.all([
        audioService.stop(),
        obd2Connected
          ? obd2Service.readAllSensors().catch(() => null)
          : Promise.resolve(null),
      ]);

      let obd2Data;
      if (sensorData) {
        const faultCodes = await obd2Service.readFaultCodes().catch(() => []);
        obd2Data = { sensors: sensorData, faultCodes };
      }

      const snap    = mediaData;
      const hasVis  = snap.photos.length > 0 || snap.videoFrames.length > 0;

      const result = await diagnose({
        description:     audioResult.description,
        duration:        audioResult.duration,
        vehicleInfo:     vehicleInfo?.make ? vehicleInfo : undefined,
        vehicleSpecs:    vehicleSpecs || undefined,
        odometerKm:      odometerKm || undefined,
        lastOilChangeKm: lastOilChangeKm ?? undefined,
        textDescription: snap.textDescription || undefined,
        images:          snap.photos.map(p => ({ base64: p.base64, mediaType: p.mediaType || 'image/jpeg' })),
        videoFrames:     snap.videoFrames,
        obd2Data,
      });

      setMediaData({ textDescription: '', photos: [], videoFrames: [], videoName: '' });
      makeEntry(result, { duration: audioResult.duration, hasVisualMedia: hasVis });
      setPhase(PHASE.RESULTS);
    } catch (err) {
      console.error('[DiagnoseModal] recording diagnosis failed:', err);
      setError(`Diagnosis failed: ${err.message}`);
      setPhase(PHASE.GUIDED);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vehicleInfo, vehicleSpecs, odometerKm, lastOilChangeKm, location, mediaData, obd2Connected]);

  const handleCancelRecording = useCallback(async () => {
    await audioService.cancel();
    setPhase(PHASE.GUIDED);
  }, []);

  // ── Results actions ──────────────────────────────────────────────────────
  const handleDiagnoseAgain = useCallback(() => {
    setDiagnosis(null);
    setError(null);
    setPhase(PHASE.GUIDED);
  }, []);

  const handleSetLocation = useCallback((loc) => {
    onLocationChange?.(loc);
    setDiagnosis(prev => prev ? { ...prev, location: loc || null } : prev);
  }, [onLocationChange]);

  if (!isOpen) return null;

  return (
    <div className="diagnose-modal" role="dialog" aria-modal="true">
      {/* Close button — guided and results phases */}
      {(phase === PHASE.GUIDED || phase === PHASE.RESULTS) && (
        <button
          className={`diagnose-modal__close${phase === PHASE.RESULTS ? ' diagnose-modal__close--done' : ''}`}
          onClick={onClose}
          aria-label={phase === PHASE.RESULTS ? 'Done' : 'Close'}
        >
          {phase === PHASE.RESULTS
            ? <span style={{ fontSize: '13px', fontWeight: '700', padding: '0 4px' }}>Done</span>
            : <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
          }
        </button>
      )}

      {/* Error banner */}
      {error && (
        <div className="diagnose-modal__error">
          <span>⚠ {error}</span>
          <button onClick={() => setError(null)}>Dismiss</button>
        </div>
      )}

      {/* ── Inner screens inherit old design vars via .diagnose-modal CSS scope ── */}
      <div className="diagnose-modal__body">
        {phase === PHASE.GUIDED && (
          <GuidedScreen
            initialText={mediaData.textDescription}
            obd2Connected={obd2Connected}
            onComplete={handleGuidedComplete}
            onSkipToRecord={handleSkipToRecord}
            onBack={onClose}
          />
        )}
        {phase === PHASE.RECORDING && (
          <RecordingScreen
            onStop={handleStopRecording}
            onCancel={handleCancelRecording}
          />
        )}
        {phase === PHASE.ANALYZING && (
          <AnalyzingScreen />
        )}
        {phase === PHASE.RESULTS && diagnosis && (
          <ResultsScreen
            diagnosis={diagnosis}
            onDiagnoseAgain={handleDiagnoseAgain}
            onSetLocation={handleSetLocation}
            onFindMechanic={onFindMechanic ? () => onFindMechanic(diagnosis) : null}
          />
        )}
      </div>
    </div>
  );
}
