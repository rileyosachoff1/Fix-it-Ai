import { getBodyType } from '../../utils/vehicleBodyType.js';
import './VehicleSilhouette.css';

// Named paint colors → silhouette body color. The app's color picker stores hex
// values, which pass straight through; names map here as a fallback.
const COLOR_MAP = {
  Black: '#2d2d2d', White: '#e8e8e8', Silver: '#a0a0a8',
  Gray: '#808088', Grey: '#808088', Red: '#cc2020',
  Blue: '#1a4a8a', Navy: '#0a1a4a', Green: '#1a6a2a',
  Brown: '#5a3a1a', Beige: '#c8b090', Orange: '#cc5500',
  Yellow: '#c8a000', Purple: '#5a1a8a', Gold: '#b89020',
};
const DEFAULT_COLOR = '#3a4a6a';

function SedanSVG({ c }) {
  return (
    <svg viewBox="0 0 400 180" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="sg1" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={c} stopOpacity="0.9"/>
          <stop offset="100%" stopColor={c} stopOpacity="0.6"/>
        </linearGradient>
        <linearGradient id="sg2" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#a8d8ff" stopOpacity="0.7"/>
          <stop offset="100%" stopColor="#60b0ff" stopOpacity="0.3"/>
        </linearGradient>
      </defs>
      <path d="M40 120 Q40 95 60 90 L120 88 L145 55 Q155 40 175 38 L245 36 Q265 36 280 50 L310 88 L355 92 Q375 95 375 115 L375 135 Q375 140 370 140 L30 140 Q25 140 25 135 L25 120 Z" fill="url(#sg1)"/>
      <path d="M150 86 L160 55 Q165 44 178 42 L238 40 Q252 40 262 52 L278 86 Z" fill="url(#sg2)"/>
      <line x1="215" y1="86" x2="212" y2="40" stroke="rgba(255,255,255,0.3)" strokeWidth="2"/>
      <circle cx="95" cy="140" r="26" fill="#1a1a1a"/><circle cx="95" cy="140" r="16" fill="#2d2d2d"/><circle cx="95" cy="140" r="7" fill="#444"/>
      <circle cx="305" cy="140" r="26" fill="#1a1a1a"/><circle cx="305" cy="140" r="16" fill="#2d2d2d"/><circle cx="305" cy="140" r="7" fill="#444"/>
      <ellipse cx="358" cy="105" rx="12" ry="7" fill="rgba(255,240,180,0.9)"/>
      <ellipse cx="42" cy="108" rx="10" ry="6" fill="rgba(255,100,100,0.7)"/>
    </svg>
  );
}

function SuvSVG({ c }) {
  return (
    <svg viewBox="0 0 420 180" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="suvg1" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={c} stopOpacity="0.9"/>
          <stop offset="100%" stopColor={c} stopOpacity="0.6"/>
        </linearGradient>
        <linearGradient id="suvg2" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#a8d8ff" stopOpacity="0.7"/>
          <stop offset="100%" stopColor="#60b0ff" stopOpacity="0.3"/>
        </linearGradient>
      </defs>
      <path d="M35 130 Q35 100 55 95 L100 90 L110 45 Q115 32 130 30 L295 28 Q312 28 322 42 L345 90 L375 94 Q392 98 392 120 L392 142 Q392 148 385 148 L42 148 Q35 148 35 142 Z" fill="url(#suvg1)"/>
      <path d="M115 88 L122 46 Q126 34 136 32 L290 30 Q304 30 310 44 L330 88 Z" fill="url(#suvg2)"/>
      <line x1="185" y1="88" x2="183" y2="30" stroke="rgba(255,255,255,0.3)" strokeWidth="2"/>
      <line x1="250" y1="88" x2="248" y2="30" stroke="rgba(255,255,255,0.3)" strokeWidth="2"/>
      <circle cx="100" cy="148" r="28" fill="#1a1a1a"/><circle cx="100" cy="148" r="18" fill="#2d2d2d"/><circle cx="100" cy="148" r="8" fill="#444"/>
      <circle cx="320" cy="148" r="28" fill="#1a1a1a"/><circle cx="320" cy="148" r="18" fill="#2d2d2d"/><circle cx="320" cy="148" r="8" fill="#444"/>
      <rect x="368" y="98" width="18" height="10" rx="3" fill="rgba(255,240,180,0.9)"/>
      <rect x="32" y="102" width="15" height="8" rx="3" fill="rgba(255,100,100,0.7)"/>
    </svg>
  );
}

function TruckSVG({ c }) {
  return (
    <svg viewBox="0 0 460 180" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="trg1" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={c} stopOpacity="0.9"/>
          <stop offset="100%" stopColor={c} stopOpacity="0.6"/>
        </linearGradient>
      </defs>
      <rect x="30" y="80" width="155" height="68" rx="4" fill="url(#trg1)" opacity="0.8"/>
      <rect x="30" y="78" width="155" height="8" rx="2" fill="rgba(255,255,255,0.15)"/>
      <path d="M185 148 L185 75 L200 48 Q205 36 220 34 L320 32 Q338 32 348 46 L375 80 L400 84 Q415 88 415 108 L415 142 Q415 148 408 148 Z" fill="url(#trg1)"/>
      <path d="M202 74 L212 50 Q216 38 225 36 L318 34 Q330 34 338 46 L360 74 Z" fill="rgba(168,216,255,0.6)"/>
      <line x1="278" y1="74" x2="276" y2="34" stroke="rgba(255,255,255,0.3)" strokeWidth="2"/>
      <circle cx="98" cy="148" r="30" fill="#1a1a1a"/><circle cx="98" cy="148" r="20" fill="#2d2d2d"/><circle cx="98" cy="148" r="9" fill="#444"/>
      <circle cx="338" cy="148" r="30" fill="#1a1a1a"/><circle cx="338" cy="148" r="20" fill="#2d2d2d"/><circle cx="338" cy="148" r="9" fill="#444"/>
      <rect x="396" y="96" width="16" height="10" rx="3" fill="rgba(255,240,180,0.9)"/>
    </svg>
  );
}

function CoupeSVG({ c }) {
  return (
    <svg viewBox="0 0 400 160" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="cog1" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={c} stopOpacity="0.9"/>
          <stop offset="100%" stopColor={c} stopOpacity="0.6"/>
        </linearGradient>
      </defs>
      <path d="M35 115 Q35 88 58 83 L110 80 L148 46 Q162 30 185 28 L240 26 Q264 26 282 42 L322 80 L358 84 Q375 88 375 108 L375 128 Q375 134 368 134 L42 134 Q35 134 35 128 Z" fill="url(#cog1)"/>
      <path d="M152 78 L164 48 Q172 34 188 30 L238 28 Q258 28 272 44 L304 78 Z" fill="rgba(168,216,255,0.65)"/>
      <line x1="224" y1="78" x2="222" y2="28" stroke="rgba(255,255,255,0.25)" strokeWidth="2"/>
      <circle cx="92" cy="134" r="24" fill="#1a1a1a"/><circle cx="92" cy="134" r="15" fill="#2d2d2d"/><circle cx="92" cy="134" r="6" fill="#555"/>
      <circle cx="306" cy="134" r="24" fill="#1a1a1a"/><circle cx="306" cy="134" r="15" fill="#2d2d2d"/><circle cx="306" cy="134" r="6" fill="#555"/>
      <path d="M355 98 L374 94 L374 106 L355 108 Z" fill="rgba(255,240,180,0.95)"/>
    </svg>
  );
}

function HatchbackSVG({ c }) {
  return (
    <svg viewBox="0 0 390 170" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="hbg1" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={c} stopOpacity="0.9"/>
          <stop offset="100%" stopColor={c} stopOpacity="0.6"/>
        </linearGradient>
      </defs>
      <path d="M38 122 Q38 96 58 90 L108 86 L135 48 Q144 34 162 32 L252 30 Q268 30 278 40 L302 86 L348 90 Q368 94 368 116 L368 136 Q368 142 362 142 L44 142 Q38 142 38 136 Z" fill="url(#hbg1)"/>
      <path d="M138 84 L148 50 Q154 36 166 34 L250 32 Q264 32 272 42 L296 84 Z" fill="rgba(168,216,255,0.65)"/>
      <line x1="210" y1="84" x2="208" y2="32" stroke="rgba(255,255,255,0.3)" strokeWidth="2"/>
      <circle cx="96" cy="142" r="25" fill="#1a1a1a"/><circle cx="96" cy="142" r="16" fill="#2d2d2d"/><circle cx="96" cy="142" r="7" fill="#444"/>
      <circle cx="312" cy="142" r="25" fill="#1a1a1a"/><circle cx="312" cy="142" r="16" fill="#2d2d2d"/><circle cx="312" cy="142" r="7" fill="#444"/>
      <ellipse cx="352" cy="106" rx="11" ry="7" fill="rgba(255,240,180,0.9)"/>
    </svg>
  );
}

const SHAPE_MAP = { sedan: SedanSVG, suv: SuvSVG, truck: TruckSVG, coupe: CoupeSVG, hatchback: HatchbackSVG };

export default function VehicleSilhouette({ make, model, color, className = '' }) {
  const bodyType = getBodyType(make, model);
  const c = color && String(color).startsWith('#')
    ? color
    : (COLOR_MAP[color] || DEFAULT_COLOR);
  const Shape = SHAPE_MAP[bodyType] || SedanSVG;
  return (
    <div className={'vehicle-silhouette ' + className}>
      <div className="silhouette-glow" style={{ background: 'radial-gradient(ellipse at center, ' + c + '22 0%, transparent 70%)' }} />
      <Shape c={c} />
      <div className="silhouette-reflection" />
    </div>
  );
}
