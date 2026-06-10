import { useState, useRef, useEffect } from 'react';
import './ServiceRecordCapture.css';

const BACKEND = 'http://localhost:3001';

const SERVICE_TYPES = [
  'Oil Change', 'Tire Rotation', 'Tire Replacement', 'Brake Pad Replacement',
  'Brake Rotor Replacement', 'Brake Fluid', 'Air Filter', 'Cabin Air Filter',
  'Spark Plugs', 'Coolant Flush', 'Transmission Fluid', 'Battery Replacement',
  'Alternator', 'Serpentine Belt', 'Timing Belt/Chain', 'Water Pump',
  'Fuel Filter', 'Wheel Alignment', 'Wheel Balance', 'Suspension',
  'Power Steering Fluid', 'AC Service', 'Emissions Test', 'Safety Inspection',
  'Detailing / Wash', 'Windshield Wipers', 'Headlights / Bulbs', 'Other',
];

function kmToDisplay(km, unit) {
  if (!km || isNaN(km)) return '';
  return unit === 'mi' ? Math.round(km * 0.621371) : Math.round(km);
}

const emptyForm = () => ({
  date:      new Date().toISOString().split('T')[0],
  shopName:  '',
  mileage:   '',
  services:  [{ type: '', details: '', cost: '' }],
  totalCost: '',
  notes:     '',
});

/**
 * Service record capture sheet.
 * Props:
 *   isOpen         {boolean}
 *   onClose        {function}
 *   onSave         {function(record)}
 *   odometerUnit   {'km'|'mi'}
 */
export default function ServiceRecordCapture({ isOpen, onClose, onSave, odometerUnit = 'km' }) {
  const [step,           setStep]           = useState('choose');  // 'choose'|'preview'|'form'
  const [photo,          setPhoto]          = useState(null);      // { dataUrl, mimeType }
  const [scanning,       setScanning]       = useState(false);
  const [scanConfidence, setScanConfidence] = useState(null);
  const [formData,       setFormData]       = useState(emptyForm());

  const fileInputRef = useRef(null);
  const unitLabel    = odometerUnit === 'mi' ? 'mi' : 'km';

  // Reset when opened
  useEffect(() => {
    if (isOpen) {
      setStep('choose');
      setPhoto(null);
      setScanning(false);
      setScanConfidence(null);
      setFormData(emptyForm());
    }
  }, [isOpen]);

  // Auto-sum service costs → totalCost
  useEffect(() => {
    const sum = formData.services.reduce((acc, s) => {
      const c = parseFloat(s.cost);
      return acc + (isNaN(c) ? 0 : c);
    }, 0);
    if (sum > 0) {
      setFormData(prev => ({ ...prev, totalCost: sum.toFixed(2) }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(formData.services.map(s => s.cost))]);

  // ── Photo selection ───────────────────────────────────────────────────────
  function handleFileSelect(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setPhoto({ dataUrl: ev.target.result, mimeType: file.type || 'image/jpeg' });
      setStep('preview');
    };
    reader.readAsDataURL(file);
    // Reset input so the same file can be reselected
    e.target.value = '';
  }

  // ── OCR scan ─────────────────────────────────────────────────────────────
  async function handleScan() {
    if (!photo) return;
    setScanning(true);
    try {
      const base64 = photo.dataUrl.split(',')[1];
      const res    = await fetch(`${BACKEND}/api/read-service-record`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ image: base64, mimeType: photo.mimeType }),
      });
      const { result } = await res.json();
      if (result) {
        setScanConfidence(result.confidence);
        setFormData({
          date:      result.date  || new Date().toISOString().split('T')[0],
          shopName:  result.shop  || '',
          mileage:   result.mileage ? String(kmToDisplay(result.mileage, odometerUnit)) : '',
          services:  (result.services || []).length > 0
            ? result.services.map(s => ({
                type:    s.type    || '',
                details: s.details || '',
                cost:    s.cost    != null ? String(s.cost) : '',
              }))
            : [{ type: '', details: '', cost: '' }],
          totalCost: result.totalCost != null ? String(result.totalCost) : '',
          notes:     result.notes || '',
        });
      }
    } catch (err) {
      console.warn('[ServiceRecordCapture] OCR error:', err.message);
    } finally {
      setScanning(false);
      setStep('form');
    }
  }

  // ── Form helpers ──────────────────────────────────────────────────────────
  function updateService(i, key, val) {
    setFormData(prev => {
      const svcs = [...prev.services];
      svcs[i] = { ...svcs[i], [key]: val };
      return { ...prev, services: svcs };
    });
  }

  function addService() {
    setFormData(prev => ({
      ...prev,
      services: [...prev.services, { type: '', details: '', cost: '' }],
    }));
  }

  function removeService(i) {
    setFormData(prev => ({
      ...prev,
      services: prev.services.filter((_, idx) => idx !== i),
    }));
  }

  // ── Save ──────────────────────────────────────────────────────────────────
  function handleSave() {
    const mileageKm = formData.mileage
      ? (odometerUnit === 'mi'
          ? Math.round(parseFloat(formData.mileage) * 1.60934)
          : parseFloat(formData.mileage))
      : null;

    const record = {
      id:            Date.now(),
      date:          formData.date,
      shopName:      formData.shopName.trim(),
      mileageKm,
      mileageDisplay: formData.mileage ? `${formData.mileage} ${unitLabel}` : '',
      services:      formData.services.filter(s => s.type),
      totalCost:     formData.totalCost ? parseFloat(formData.totalCost) : null,
      notes:         formData.notes.trim(),
      hasReceipt:    !!photo,
    };

    onSave(record);
    onClose();
  }

  const canSave = formData.date && formData.services.some(s => s.type);

  if (!isOpen) return null;

  return (
    <div className="svc-overlay" onClick={onClose}>
      <div className="svc-sheet" onClick={e => e.stopPropagation()}>
        {/* Handle */}
        <div className="svc-sheet__handle" />

        {/* ── Step: choose ── */}
        {step === 'choose' && (
          <>
            <div className="svc-sheet__header">
              <h2 className="svc-sheet__title">Add Service Record</h2>
              <button className="svc-sheet__close" onClick={onClose} type="button">✕</button>
            </div>

            <div className="svc-choose">
              <button
                className="svc-choose__btn svc-choose__btn--photo"
                onClick={() => fileInputRef.current?.click()}
                type="button"
              >
                <span className="svc-choose__icon">📷</span>
                <span className="svc-choose__label">Scan a Receipt</span>
                <span className="svc-choose__desc">AI reads date, services & costs</span>
              </button>

              <button
                className="svc-choose__btn svc-choose__btn--manual"
                onClick={() => setStep('form')}
                type="button"
              >
                <span className="svc-choose__icon">✏️</span>
                <span className="svc-choose__label">Enter Manually</span>
                <span className="svc-choose__desc">Fill in the details yourself</span>
              </button>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleFileSelect}
              style={{ display: 'none' }}
            />
          </>
        )}

        {/* ── Step: photo preview ── */}
        {step === 'preview' && photo && (
          <>
            <div className="svc-sheet__header">
              <button className="svc-sheet__back" onClick={() => setStep('choose')} type="button">‹ Back</button>
              <h2 className="svc-sheet__title">Receipt Preview</h2>
              <button className="svc-sheet__close" onClick={onClose} type="button">✕</button>
            </div>

            <div className="svc-preview">
              <img src={photo.dataUrl} alt="Receipt" className="svc-preview__img" />

              {scanning ? (
                <div className="svc-preview__scanning">
                  <span className="svc-preview__spinner" />
                  <span>Reading with AI…</span>
                </div>
              ) : (
                <button className="svc-preview__scan-btn" onClick={handleScan} type="button">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M9 3H5a2 2 0 0 0-2 2v4"/><path d="M15 3h4a2 2 0 0 1 2 2v4"/>
                    <path d="M9 21H5a2 2 0 0 1-2-2v-4"/><path d="M15 21h4a2 2 0 0 0 2-2v-4"/>
                    <path d="M7 12h10"/><path d="M12 7v10"/>
                  </svg>
                  Scan with AI
                </button>
              )}

              <button
                className="svc-preview__manual-link"
                onClick={() => setStep('form')}
                type="button"
              >
                Skip — enter manually →
              </button>
            </div>
          </>
        )}

        {/* ── Step: form ── */}
        {step === 'form' && (
          <>
            <div className="svc-sheet__header">
              <button className="svc-sheet__back" onClick={() => setStep('choose')} type="button">‹ Back</button>
              <h2 className="svc-sheet__title">Service Details</h2>
              <button className="svc-sheet__close" onClick={onClose} type="button">✕</button>
            </div>

            {/* Confidence banner from OCR */}
            {scanConfidence && (
              <div className={`svc-confidence svc-confidence--${scanConfidence}`}>
                {scanConfidence === 'high'   && '✅ AI read this receipt with high confidence. Review below.'}
                {scanConfidence === 'medium' && '⚠️ Some fields may need correction — please review.'}
                {scanConfidence === 'low'    && '⚠️ AI had difficulty reading this receipt. Please fill in manually.'}
              </div>
            )}

            <div className="svc-form">
              {/* Date */}
              <div className="svc-field">
                <label className="svc-field__label">Service Date</label>
                <input
                  type="date"
                  className="svc-field__input"
                  value={formData.date}
                  max={new Date().toISOString().split('T')[0]}
                  onChange={e => setFormData(p => ({ ...p, date: e.target.value }))}
                />
              </div>

              {/* Shop */}
              <div className="svc-field">
                <label className="svc-field__label">Shop / Dealership</label>
                <input
                  type="text"
                  className="svc-field__input"
                  value={formData.shopName}
                  placeholder="e.g. Midas, Honda Dealer, Joe's Garage"
                  onChange={e => setFormData(p => ({ ...p, shopName: e.target.value }))}
                />
              </div>

              {/* Mileage */}
              <div className="svc-field">
                <label className="svc-field__label">Odometer ({unitLabel})</label>
                <input
                  type="number"
                  className="svc-field__input"
                  value={formData.mileage}
                  placeholder={`e.g. ${odometerUnit === 'mi' ? '45000' : '72000'}`}
                  min="0"
                  onChange={e => setFormData(p => ({ ...p, mileage: e.target.value }))}
                />
              </div>

              {/* Services */}
              <div className="svc-services">
                <div className="svc-services__header">
                  <span className="svc-field__label">Services Performed</span>
                  <button className="svc-services__add" onClick={addService} type="button">
                    + Add Service
                  </button>
                </div>

                {formData.services.map((svc, i) => (
                  <div key={i} className="svc-service-row">
                    <div className="svc-service-row__top">
                      <select
                        className="svc-field__input svc-field__select"
                        value={svc.type}
                        onChange={e => updateService(i, 'type', e.target.value)}
                      >
                        <option value="">Select service type…</option>
                        {SERVICE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                      {formData.services.length > 1 && (
                        <button className="svc-service-row__remove" onClick={() => removeService(i)} type="button">
                          ✕
                        </button>
                      )}
                    </div>
                    <div className="svc-service-row__bottom">
                      <input
                        type="text"
                        className="svc-field__input svc-field__input--detail"
                        value={svc.details}
                        placeholder="Details (e.g. Synthetic 5W-30)"
                        onChange={e => updateService(i, 'details', e.target.value)}
                      />
                      <input
                        type="number"
                        className="svc-field__input svc-field__input--cost"
                        value={svc.cost}
                        placeholder="$0"
                        min="0"
                        step="0.01"
                        onChange={e => updateService(i, 'cost', e.target.value)}
                      />
                    </div>
                  </div>
                ))}
              </div>

              {/* Total cost */}
              <div className="svc-field">
                <label className="svc-field__label">Total Cost</label>
                <div className="svc-cost-wrap">
                  <span className="svc-cost-wrap__currency">$</span>
                  <input
                    type="number"
                    className="svc-field__input svc-field__input--total"
                    value={formData.totalCost}
                    placeholder="0.00"
                    min="0"
                    step="0.01"
                    onChange={e => setFormData(p => ({ ...p, totalCost: e.target.value }))}
                  />
                </div>
              </div>

              {/* Notes */}
              <div className="svc-field">
                <label className="svc-field__label">Notes</label>
                <textarea
                  className="svc-field__input svc-field__textarea"
                  value={formData.notes}
                  placeholder="Any additional notes…"
                  rows={2}
                  onChange={e => setFormData(p => ({ ...p, notes: e.target.value }))}
                />
              </div>
            </div>

            <div className="svc-footer">
              <button className="svc-footer__cancel" onClick={onClose} type="button">Cancel</button>
              <button
                className="svc-footer__save"
                onClick={handleSave}
                disabled={!canSave}
                type="button"
              >
                Save Record
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
