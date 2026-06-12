import { useState } from 'react';
import './SettingsSheet.css';

const APP_VERSION = '1.0.0';

export default function SettingsSheet({
  vehicleInfo,
  onVehicleInfoChange,
  theme,
  onThemeChange,
  units,
  onUnitsChange,
  onClearAll,
  onGoToVehicle,
  onClose,
}) {
  const [confirmClear, setConfirmClear] = useState(false);

  const vehicleLabel = [vehicleInfo?.year, vehicleInfo?.make, vehicleInfo?.model]
    .filter(Boolean).join(' ') || 'No vehicle set';

  function handleClear() {
    onClearAll?.();
    setConfirmClear(false);
    onClose?.();
  }

  return (
    <div className="settings-overlay" onClick={onClose}>
      <div className="settings-sheet" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Settings">
        <div className="settings-sheet__handle" />
        <h2 className="settings-sheet__title">Settings</h2>

        {/* My Car */}
        <button className="settings-row settings-row--tappable" onClick={() => { onClose?.(); onGoToVehicle?.(); }} type="button">
          <div className="settings-row__text">
            <span className="settings-row__label">My Car</span>
            <span className="settings-row__value">{vehicleLabel}</span>
          </div>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </button>

        {/* Owner name */}
        <div className="settings-row">
          <div className="settings-row__text settings-row__text--full">
            <span className="settings-row__label">Owner Name</span>
            <input
              className="settings-row__input"
              type="text"
              placeholder="Your first name"
              value={vehicleInfo?.ownerName || ''}
              onChange={e => onVehicleInfoChange?.({ ownerName: e.target.value })}
              maxLength={30}
            />
          </div>
        </div>

        {/* Theme */}
        <div className="settings-row">
          <span className="settings-row__label">Theme</span>
          <div className="settings-seg" role="group" aria-label="Theme">
            <button
              className={`settings-seg__btn${theme === 'dark' ? ' settings-seg__btn--active' : ''}`}
              onClick={() => onThemeChange?.('dark')}
              aria-pressed={theme === 'dark'}
              type="button"
            >Dark</button>
            <button
              className={`settings-seg__btn${theme === 'light' ? ' settings-seg__btn--active' : ''}`}
              onClick={() => onThemeChange?.('light')}
              aria-pressed={theme === 'light'}
              type="button"
            >Light</button>
          </div>
        </div>

        {/* Units */}
        <div className="settings-row">
          <span className="settings-row__label">Units</span>
          <div className="settings-seg" role="group" aria-label="Units">
            <button
              className={`settings-seg__btn${units === 'metric' ? ' settings-seg__btn--active' : ''}`}
              onClick={() => onUnitsChange?.('metric')}
              aria-pressed={units === 'metric'}
              type="button"
            >Metric km</button>
            <button
              className={`settings-seg__btn${units === 'imperial' ? ' settings-seg__btn--active' : ''}`}
              onClick={() => onUnitsChange?.('imperial')}
              aria-pressed={units === 'imperial'}
              type="button"
            >Imperial mi</button>
          </div>
        </div>

        {/* Clear data */}
        {confirmClear ? (
          <div className="settings-clear-confirm">
            <p className="settings-clear-confirm__text">
              This will delete all your vehicle data, service history, and diagnoses. Are you sure?
            </p>
            <div className="settings-clear-confirm__btns">
              <button className="settings-clear-confirm__cancel" onClick={() => setConfirmClear(false)} type="button">Cancel</button>
              <button className="settings-clear-confirm__yes" onClick={handleClear} type="button">Delete Everything</button>
            </div>
          </div>
        ) : (
          <button className="settings-clear-btn" onClick={() => setConfirmClear(true)} type="button">
            Clear App Data
          </button>
        )}

        {/* About */}
        <div className="settings-about">
          <p className="settings-about__version">FixIt AI v{APP_VERSION}</p>
          <p className="settings-about__text">
            Built to beat FIXD at its own game. AI-powered diagnosis using sound, photos, and OBD2 data.
          </p>
        </div>

        <button className="settings-sheet__close" onClick={onClose} type="button">Done</button>
      </div>
    </div>
  );
}
