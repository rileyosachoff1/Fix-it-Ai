import { useEffect, useState } from 'react';
import './AnalyzingScreen.css';

const MESSAGES = [
  'Analyzing sound frequencies…',
  'Comparing against 10,000+ car problems…',
  'Detecting rhythm and pattern…',
  'Cross-referencing acoustic signatures…',
  'Generating diagnosis…',
];

export default function AnalyzingScreen() {
  const [msgIdx, setMsgIdx] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setMsgIdx(i => (i + 1) % MESSAGES.length);
    }, 1600);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="analyzing">
      {/* Spinner */}
      <div className="analyzing__spinner-wrap" aria-hidden="true">
        <div className="analyzing__ring analyzing__ring--outer" />
        <div className="analyzing__ring analyzing__ring--inner" />
        <div className="analyzing__gear">🔧</div>
      </div>

      {/* Status */}
      <h1 className="analyzing__title">AI is listening…</h1>
      <p key={msgIdx} className="analyzing__msg" aria-live="polite">
        {MESSAGES[msgIdx]}
      </p>

      {/* Progress dots */}
      <div className="analyzing__dots" aria-hidden="true">
        {MESSAGES.map((_, i) => (
          <span key={i} className={`analyzing__dot ${i === msgIdx ? 'analyzing__dot--active' : ''}`} />
        ))}
      </div>
    </div>
  );
}
