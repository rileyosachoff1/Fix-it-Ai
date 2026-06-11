import { useState, useRef } from 'react';
import './VehicleTab.css';
import { YEARS, MAKES, MODELS_BY_MAKE } from '../data/vehicles.js';
import { getTrimsForModel }              from '../data/trims.js';
import { getColorsForVehicle }           from '../data/vehicleColors.js';
import AddressAutocomplete               from './AddressAutocomplete.jsx';
import { validatePostalCode, detectPostalCountry } from '../services/addressService.js';

// ── Wrapper that returns 'valid' | 'invalid' | null ──────────────────────────
// (validatePostalCode now returns boolean; we need 3-state for CSS classes)
function computePostalValidity(code, country) {
  const s = (code || '').trim();
  if (!s || s.length < 3) return null;
  if (country === 'CA') return validatePostalCode(s, true)  ? 'valid' : 'invalid';
  if (country === 'US') return validatePostalCode(s, false) ? 'valid' : 'invalid';
  // Unknown country — accept either format
  return (validatePostalCode(s, true) || validatePostalCode(s, false)) ? 'valid' : 'invalid';
}

export default function VehicleTab({
  vehicleInfo, onVehicleInfoChange,
  vehicleSpecs = null,
  location, onLocationChange, onLocationCoordsChange,
  recentDiagnoses = [],
  units, onUnitsChange,
  obd2Connected, obd2DeviceName, onObd2Disconnect,
  onClearAll,
  vehiclePhoto, vehiclePhotoLoading,
  onPhotoFileSelect, onPhotoRemove,
}) {
  const models = MODELS_BY_MAKE[vehicleInfo.make] || [];
  const trims  = getTrimsForModel(vehicleInfo.make, vehicleInfo.model);
  const colors = getColorsForVehicle(vehicleInfo.make, vehicleInfo.model);

  const [postalCountry,  setPostalCountry]  = useState('');
  const [showAllColors,  setShowAllColors]  = useState(false);

  const photoInputRef = useRef(null);

  const displayName = vehicleInfo.nickname
    || [vehicleInfo.year, vehicleInfo.make, vehicleInfo.model].filter(Boolean).join(' ')
    || 'My Vehicle';

  const hasVehicle = !!(vehicleInfo.make || vehicleInfo.model);

  // ── Postal helpers ────────────────────────────────────────────────────────
  const postalLabel    = postalCountry === 'CA' ? 'Postal Code'
                       : postalCountry === 'US' ? 'ZIP Code'
                       : 'Postal / ZIP';
  const postalValidity = computePostalValidity(vehicleInfo.postalCode, postalCountry);

  // ── Photo file handler ────────────────────────────────────────────────────
  function handlePhotoFileChange(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) onPhotoFileSelect?.(file);
  }

  // ── Field wrappers ────────────────────────────────────────────────────────
  function field(label, child) {
    return (
      <div className="veh-field">
        <label className="veh-field__label">{label}</label>
        {child}
      </div>
    );
  }

  function input(key, placeholder, type = 'text', extra = {}) {
    return (
      <input
        className="veh-field__input"
        type={type}
        placeholder={placeholder}
        value={vehicleInfo[key] || ''}
        onChange={e => onVehicleInfoChange({ [key]: e.target.value })}
        {...extra}
      />
    );
  }

  function select(key, options, placeholder) {
    return (
      <select
        className="veh-field__input veh-field__select"
        value={vehicleInfo[key] || ''}
        onChange={e => {
          const updates = { [key]: e.target.value };
          if (key === 'make') { updates.model = ''; updates.trim = ''; updates.vehicleColor = ''; }
          onVehicleInfoChange(updates);
        }}
      >
        <option value="">{placeholder}</option>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    );
  }

  // ── Odometer unit conversion on toggle ───────────────────────────────────
  function handleUnitChange(newUnit) {
    const oldUnit = vehicleInfo.odometerUnit || 'km';
    if (newUnit === oldUnit) return;
    const oldVal  = parseFloat(vehicleInfo.odometer) || 0;
    const updates = { odometerUnit: newUnit };
    if (oldVal > 0) {
      updates.odometer = String(
        newUnit === 'mi'
          ? Math.round(oldVal * 0.621371)
          : Math.round(oldVal * 1.60934)
      );
    }
    onVehicleInfoChange(updates);
  }

  // Colors to show (cap at 8, show "more" button)
  const MAX_COLORS = 8;
  const visColors  = showAllColors ? colors : colors.slice(0, MAX_COLORS);
  const hasMore    = colors.length > MAX_COLORS && !showAllColors;

  return (
    <div className="veh-tab">
      {/* ── Vehicle photo section ── */}
      <section className="veh-section">
        <h2 className="veh-section__title">Vehicle Photo</h2>
        <div className="veh-card veh-card--padded">
          {vehiclePhoto?.dataUrl ? (
            <div className="veh-photo-row">
              <div className="veh-photo-thumb-wrap">
                <img
                  src={vehiclePhoto.dataUrl}
                  alt="Your vehicle"
                  className="veh-photo-thumb"
                />
                {vehiclePhotoLoading && (
                  <div className="veh-photo-thumb__loading">
                    <div className="veh-photo-thumb__spinner" />
                  </div>
                )}
              </div>
              <div className="veh-photo-info">
                {vehiclePhoto.analysis?.description && (
                  <p className="veh-photo-info__desc">{vehiclePhoto.analysis.description}</p>
                )}
                {vehiclePhoto.analysis?.make && (
                  <p className="veh-photo-info__detected">
                    Detected: {[vehiclePhoto.analysis.year, vehiclePhoto.analysis.make, vehiclePhoto.analysis.model].filter(Boolean).join(' ')}
                  </p>
                )}
                <div className="veh-photo-info__btns">
                  <button
                    className="veh-photo-btn veh-photo-btn--change"
                    onClick={() => photoInputRef.current?.click()}
                    disabled={vehiclePhotoLoading}
                  >
                    Change Photo
                  </button>
                  {onPhotoRemove && (
                    <button
                      className="veh-photo-btn veh-photo-btn--remove"
                      onClick={onPhotoRemove}
                      disabled={vehiclePhotoLoading}
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div
              className="veh-photo-placeholder"
              onClick={() => photoInputRef.current?.click()}
              role="button"
              tabIndex={0}
              onKeyDown={e => e.key === 'Enter' && photoInputRef.current?.click()}
            >
              {vehiclePhotoLoading ? (
                <>
                  <div className="veh-photo-placeholder__spinner" />
                  <span className="veh-photo-placeholder__text">Analyzing photo…</span>
                </>
              ) : (
                <>
                  <span className="veh-photo-placeholder__icon">📷</span>
                  <span className="veh-photo-placeholder__text">Add a photo of your vehicle</span>
                  <span className="veh-photo-placeholder__sub">Tap to take or choose a photo</span>
                </>
              )}
            </div>
          )}
          {/* Hidden file input — no capture attr so user can choose camera or library */}
          <input
            ref={photoInputRef}
            type="file"
            accept="image/*,image/heic"
            style={{ display: 'none' }}
            onChange={handlePhotoFileChange}
          />
        </div>
      </section>

      {/* ── Vehicle preview card ── */}
      {hasVehicle && (
        <div className="veh-preview">
          <div className="veh-preview__dot"
               style={{ background: vehicleInfo.vehicleColor || 'var(--text-muted)' }} />
          <div className="veh-preview__info">
            <span className="veh-preview__name">{displayName}</span>
            {vehicleInfo.odometer && (
              <span className="veh-preview__meta">
                {parseInt(vehicleInfo.odometer).toLocaleString()} {vehicleInfo.odometerUnit || 'km'}
                {vehicleInfo.trim ? ` · ${vehicleInfo.trim}` : ''}
              </span>
            )}
          </div>
        </div>
      )}

      <div className="veh-header">
        <h1 className="veh-header__title">{displayName}</h1>
        <p className="veh-header__sub">Vehicle profile &amp; settings</p>
      </div>

      {/* ── Vehicle profile ── */}
      <section className="veh-section">
        <h2 className="veh-section__title">Vehicle Profile</h2>
        <div className="veh-card">
          {field('Nickname', input('nickname', 'e.g. My Civic, Blue Beast…'))}
          {field('Year',  select('year',  YEARS, 'Select year'))}
          {field('Make',  select('make',  MAKES, 'Select make'))}

          {field('Model', (
            <select
              className="veh-field__input veh-field__select"
              value={vehicleInfo.model || ''}
              onChange={e => onVehicleInfoChange({ model: e.target.value, trim: '', vehicleColor: '' })}
              disabled={!vehicleInfo.make}
            >
              <option value="">{vehicleInfo.make ? 'Select model' : 'Select make first'}</option>
              {models.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          ))}

          {field('Trim', (
            <select
              className="veh-field__input veh-field__select"
              value={vehicleInfo.trim || ''}
              onChange={e => onVehicleInfoChange({ trim: e.target.value })}
              disabled={!vehicleInfo.model}
            >
              <option value="">{vehicleInfo.model ? 'Select trim (optional)' : 'Select model first'}</option>
              {trims.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          ))}
        </div>
      </section>

      {/* ── Specifications (hidden when no specs data for this vehicle) ── */}
      {vehicleSpecs && (() => {
        const sp = vehicleSpecs;
        const isEV = !!sp.isEV;
        const rows = [
          ['Engine', sp.engine],
          ['Horsepower', sp.horsepower ? `${sp.horsepower} hp` : null],
          ['Torque', sp.torque ? `${sp.torque} ${sp.torqueUnit || 'lb-ft'}` : null],
          ['Transmission', sp.transmission],
          ['Drivetrain', sp.drivetrain],
          ['Fuel Type', sp.fuelType],
          ...(isEV ? [
            ['Range', sp.rangeKm ? `${sp.rangeKm} km` : null],
            ['Battery', sp.batteryKWh ? `${sp.batteryKWh} kWh` : null],
            ['AC Charging', sp.chargingMaxKW ? `${sp.chargingMaxKW} kW` : null],
            ['DC Fast Charge', sp.dcFastChargeKW ? `${sp.dcFastChargeKW} kW` : null],
          ] : [
            ['Fuel Tank', sp.fuelTankL ? `${sp.fuelTankL} L` : null],
            ['City', sp.L100kmCity ? `${sp.L100kmCity} L/100km` : null],
            ['Highway', sp.L100kmHwy ? `${sp.L100kmHwy} L/100km` : null],
          ]),
          ['0–100 km/h', sp.zeroToHundred ? `${sp.zeroToHundred} s` : null],
          ['Top Speed', sp.topSpeed_kmh ? `${sp.topSpeed_kmh} km/h` : null],
          ['Seating', sp.seating ? `${sp.seating}` : null],
          ['Cargo', sp.cargo_L ? `${sp.cargo_L} L` : null],
          ['Towing', sp.towingCapacity_kg ? `${sp.towingCapacity_kg.toLocaleString()} kg` : null],
          ['Weight', sp.weight_kg ? `${sp.weight_kg.toLocaleString()} kg` : null],
          ...(isEV ? [] : [
            ['Oil', sp.oilType ? `${sp.oilType}${sp.oilCapacity_L ? ` · ${sp.oilCapacity_L} L` : ''}` : null],
            ['Spark Plugs', sp.sparkPlugInterval_km ? `Every ${sp.sparkPlugInterval_km.toLocaleString()} km` : null],
            ['Timing', sp.timingChain == null ? null : sp.timingChain ? 'Chain — no scheduled replacement' : 'Belt — check replacement interval'],
          ]),
        ].filter(([, v]) => v != null && v !== '');
        return (
          <section className="veh-section">
            <h2 className="veh-section__title">Specifications</h2>
            <div className="veh-card veh-card--padded">
              <div className="veh-specs-grid">
                {rows.map(([label, value]) => (
                  <div key={label} className="veh-spec">
                    <span className="veh-spec__label">{label}</span>
                    <span className="veh-spec__value">{value}</span>
                  </div>
                ))}
              </div>
              {sp.notes && <p className="veh-specs-note">💡 {sp.notes}</p>}
            </div>
          </section>
        );
      })()}

      {/* ── Color swatch picker ── */}
      <section className="veh-section">
        <h2 className="veh-section__title">Color</h2>
        <div className="veh-card veh-card--padded">
          <div className="veh-colors">
            {/* No color option */}
            <button
              type="button"
              className={`veh-color-swatch veh-color-swatch--none${!vehicleInfo.vehicleColor ? ' veh-color-swatch--selected' : ''}`}
              title="No color / Default"
              onClick={() => onVehicleInfoChange({ vehicleColor: '' })}
              aria-label="No color"
            >
              <span>—</span>
            </button>

            {visColors.map(c => (
              <button
                key={c.hex}
                type="button"
                className={`veh-color-swatch${vehicleInfo.vehicleColor === c.hex ? ' veh-color-swatch--selected' : ''}`}
                style={{ background: c.hex }}
                title={c.name}
                onClick={() => onVehicleInfoChange({ vehicleColor: c.hex })}
                aria-label={c.name}
              />
            ))}

            {hasMore && (
              <button
                type="button"
                className="veh-color-swatch veh-color-swatch--more"
                onClick={() => setShowAllColors(true)}
                aria-label="Show more colors"
              >
                <span>+{colors.length - MAX_COLORS}</span>
              </button>
            )}
          </div>

          {vehicleInfo.vehicleColor && (
            <p className="veh-color-name">
              {colors.find(c => c.hex === vehicleInfo.vehicleColor)?.name || 'Custom color'}
            </p>
          )}
        </div>
      </section>

      {/* ── Odometer & details ── */}
      <section className="veh-section">
        <h2 className="veh-section__title">Details</h2>
        <div className="veh-card">
          {field('Odometer', (
            <div className="veh-odo">
              <input
                className="veh-field__input veh-odo__input"
                type="number"
                placeholder="0"
                min="0"
                value={vehicleInfo.odometer || ''}
                onChange={e => onVehicleInfoChange({ odometer: e.target.value })}
              />
              <select
                className="veh-odo__unit"
                value={vehicleInfo.odometerUnit || 'km'}
                onChange={e => handleUnitChange(e.target.value)}
                aria-label="Odometer unit"
              >
                <option value="km">km</option>
                <option value="mi">mi</option>
              </select>
            </div>
          ))}
          {field('License Plate', input('licensePlate', 'e.g. ABC 1234'))}
          {field('VIN', input('vin', '17-digit VIN', 'text', {
            maxLength: 17,
            style: { fontFamily: 'monospace', letterSpacing: '1px' },
          }))}
          {field('Purchase Date', input('purchaseDate', '', 'date'))}
        </div>
      </section>

      {/* ── Location with address autocomplete ── */}
      <section className="veh-section">
        <h2 className="veh-section__title">Default Location</h2>
        <div className="veh-card veh-card--location">
          <div className="veh-field veh-field--address">
            <label className="veh-field__label">Address</label>
            <AddressAutocomplete
              value={location || ''}
              onChange={onLocationChange}
              onSelect={data => {
                onLocationChange(data.shortName);
                if (data.lat != null && data.lon != null) {
                  onLocationCoordsChange?.({ lat: data.lat, lon: data.lon });
                }
                onVehicleInfoChange({
                  odometerUnit: data.isCanada ? 'km' : 'mi',
                  ...(data.postalCode ? { postalCode: data.postalCode } : {}),
                });
                setPostalCountry(data.isCanada ? 'CA' : data.isUS ? 'US' : '');
              }}
              placeholder="Start typing your address…"
            />
          </div>

          {/* Postal / ZIP */}
          <div className="veh-field">
            <label className="veh-field__label">{postalLabel}</label>
            <div className={`veh-postal${
              postalValidity === 'valid'   ? ' veh-postal--valid'   :
              postalValidity === 'invalid' ? ' veh-postal--invalid' : ''
            }`}>
              <input
                className="veh-field__input"
                type="text"
                placeholder={
                  postalCountry === 'CA' ? 'A1A 1A1' :
                  postalCountry === 'US' ? '12345'   :
                  'A1A 1A1 or 12345'
                }
                value={vehicleInfo.postalCode || ''}
                onChange={e => {
                  const val = e.target.value.toUpperCase();
                  onVehicleInfoChange({ postalCode: val });
                  const detected = detectPostalCountry(val);
                  if (detected) setPostalCountry(detected);
                }}
                maxLength={10}
              />
              {postalValidity === 'valid' && (
                <span className="veh-postal__check" aria-label="Valid format">✓</span>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ── Scanner ── */}
      <section className="veh-section">
        <h2 className="veh-section__title">OBD2 Scanner</h2>
        <div className="veh-card">
          <div className="veh-scanner">
            <div className={`veh-scanner__dot veh-scanner__dot--${obd2Connected ? 'on' : 'off'}`} />
            <div className="veh-scanner__info">
              <span className="veh-scanner__status">{obd2Connected ? 'Connected' : 'Not connected'}</span>
              {obd2Connected && obd2DeviceName && (
                <span className="veh-scanner__device">{obd2DeviceName}</span>
              )}
            </div>
            {obd2Connected && (
              <button className="veh-scanner__disconnect" onClick={onObd2Disconnect}>Disconnect</button>
            )}
          </div>
        </div>
      </section>

      {/* ── Settings ── */}
      <section className="veh-section">
        <h2 className="veh-section__title">Settings</h2>
        <div className="veh-card">
          <div className="veh-setting">
            <div className="veh-setting__info">
              <span className="veh-setting__label">Units</span>
              <span className="veh-setting__desc">Temperature and speed display</span>
            </div>
            <div className="veh-units-toggle">
              <button
                className={`veh-units-btn${units === 'metric'   ? ' veh-units-btn--active' : ''}`}
                onClick={() => onUnitsChange('metric')}
              >Metric</button>
              <button
                className={`veh-units-btn${units === 'imperial' ? ' veh-units-btn--active' : ''}`}
                onClick={() => onUnitsChange('imperial')}
              >Imperial</button>
            </div>
          </div>
        </div>
      </section>

      {/* ── Diagnosis history ── */}
      {recentDiagnoses.length > 0 && (
        <section className="veh-section">
          <h2 className="veh-section__title">Diagnosis History ({recentDiagnoses.length})</h2>
          <div className="veh-card veh-history-list">
            {recentDiagnoses.map(d => (
              <div key={d.id} className="veh-history-row">
                <div className="veh-history-row__left">
                  <span className="veh-history-row__date">
                    {new Date(d.recordedAt).toLocaleDateString(undefined, { month:'short', day:'numeric', year:'numeric' })}
                  </span>
                  <span className="veh-history-row__summary">
                    {d.primary?.diagnosis || d.primary?.cause || 'Diagnosis completed'}
                  </span>
                </div>
                {d.primary?.severity && (
                  <span className={`veh-history-row__sev veh-history-row__sev--${(d.primary.severity || '').toLowerCase()}`}>
                    {d.primary.severity}
                  </span>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Danger zone ── */}
      <section className="veh-section">
        <h2 className="veh-section__title">Data</h2>
        <div className="veh-card">
          <div className="veh-setting">
            <div className="veh-setting__info">
              <span className="veh-setting__label">Clear all data</span>
              <span className="veh-setting__desc">Remove vehicle profile, history, and maintenance logs</span>
            </div>
            <button
              className="veh-clear-btn"
              onClick={() => { if (window.confirm('Clear all FixIt AI data? This cannot be undone.')) onClearAll(); }}
            >Clear</button>
          </div>
        </div>
      </section>

      <div style={{ height: '24px' }} />
    </div>
  );
}
