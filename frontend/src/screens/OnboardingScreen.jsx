import { useState } from 'react';
import './OnboardingScreen.css';

const slides = [
  {
    icon: '🎙️',
    headline: 'Your Car Has a Story',
    body: 'FixIt AI listens to your engine in real time and identifies problems instantly — like having a master mechanic in your pocket.',
    pulse: true,
  },
  {
    icon: '🔌',
    headline: 'Deeper Than Any Scanner',
    body: 'Connect an OBD2 scanner for live engine data. FixIt AI reads fault codes AND explains them in plain English. No jargon.',
  },
  {
    icon: '🔧',
    headline: 'Fixed Fast, Fixed Right',
    body: 'Get matched with real mechanics near you. Transparent pricing. No guessing. No overcharging.',
    isFinal: true,
  },
];

export default function OnboardingScreen({ onComplete }) {
  const [current, setCurrent] = useState(0);

  const handleComplete = () => {
    try { localStorage.setItem('fixit_onboarded', 'true'); } catch { /* ignore */ }
    onComplete?.();
  };

  const next = () => {
    if (current < slides.length - 1) setCurrent(current + 1);
    else handleComplete();
  };

  const slide = slides[current];

  return (
    <div className="onboarding-screen">
      <button className="onboarding-skip" onClick={handleComplete} type="button">Skip</button>

      <div className="onboarding-content" key={current}>
        <div className={`onboarding-icon${slide.pulse ? ' pulse' : ''}`} aria-hidden="true">
          {slide.icon}
        </div>
        <h1 className="onboarding-headline">{slide.headline}</h1>
        <p className="onboarding-body">{slide.body}</p>
      </div>

      <div className="onboarding-dots" role="tablist" aria-label="Onboarding progress">
        {slides.map((_, i) => (
          <button
            key={i}
            className={`onboarding-dot${i === current ? ' active' : ''}`}
            onClick={() => setCurrent(i)}
            aria-label={`Slide ${i + 1}`}
            aria-selected={i === current}
            role="tab"
            type="button"
          />
        ))}
      </div>

      <button className="onboarding-cta" onClick={next} type="button">
        {slide.isFinal ? "Get Started — It's Free" : 'Next'}
      </button>

      {slide.isFinal && (
        <p className="onboarding-tagline">No credit card. No catch.</p>
      )}
    </div>
  );
}
