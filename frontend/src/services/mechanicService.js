// ── Mechanic shop finder service ───────────────────────────────────────────────

/**
 * Fetch partner and nearby shops from the backend.
 * @param {number} lat
 * @param {number} lon
 * @param {number} radiusKm  default 25
 * @returns {Promise<{ ok: boolean, partners: object[], nearby: object[], loadedAt: string }>}
 */
export async function findShopsNearLocation(lat, lon, radiusKm = 25) {
  const res = await fetch(`/api/shops?lat=${lat}&lon=${lon}&radiusKm=${radiusKm}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Server error ${res.status}`);
  }
  return res.json();
}

/**
 * Log a referral action (call / directions / send-diagnosis).
 * Fire-and-forget — never throws to the caller.
 */
export function logReferral({ shopId, shopName, action, vehicleInfo, diagnosisSummary }) {
  fetch('/api/log-referral', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ shopId, shopName, action, vehicleInfo, diagnosisSummary }),
  }).catch(err => console.warn('[referral]', err.message));
}

/**
 * Submit a partner inquiry (shop suggestion).
 * @returns {Promise<void>}  throws on error
 */
export async function submitPartnerInquiry({ shopName, contactName, phone, email, city, province, notes }) {
  const res = await fetch('/api/partner-inquiry', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ shopName, contactName, phone, email, city, province, notes }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Server error ${res.status}`);
  }
}

/**
 * Build an SMS/message body from diagnosis context.
 */
export function buildDiagnosisMessage(diagnosis, vehicleInfo) {
  const vehicle = vehicleInfo?.make
    ? [vehicleInfo.year, vehicleInfo.make, vehicleInfo.model].filter(Boolean).join(' ')
    : null;

  const primary = diagnosis?.primary ?? diagnosis;
  const name    = primary?.diagnosis;
  const conf    = primary?.confidence;
  const cost    = primary?.estimatedCost;

  let msg = vehicle
    ? `Hi! I need service for my ${vehicle}.`
    : `Hi! I need vehicle service.`;

  if (name) {
    msg += ` FixIt AI diagnosed: ${name}`;
    if (conf) msg += ` (${conf}% confidence)`;
    msg += '.';
  }

  if (cost?.min && cost?.max) {
    msg += ` Estimated repair: $${cost.min.toLocaleString()}–$${cost.max.toLocaleString()}.`;
  }

  msg += ' Can I book an appointment?';
  return msg;
}
