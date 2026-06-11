// ── Vehicle specs + recalls service ───────────────────────────────────────────
// Fetches { specs, recalls } from the backend (which calls the public NHTSA
// recalls API server-side and caches it for 24h). The frontend mirrors that
// with its own 24h localStorage cache so recalls survive reloads and the
// Alerts tab still works offline.

const CACHE_KEY = 'fixit_recalls_cache';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

function readCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function writeCache(entry) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(entry)); } catch { /* quota — ignore */ }
}

/**
 * Fetch recalls (and backend-side specs) for a vehicle.
 * Returns { specs, recalls } — never throws; recalls falls back to cached or [].
 */
export async function fetchSpecsAndRecalls(make, model, year, trim) {
  if (!make || !model) return { specs: null, recalls: [] };

  const cacheId = `${make}|${model}|${year || ''}`.toLowerCase();
  const cached = readCache();
  if (cached && cached.key === cacheId && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return { specs: cached.specs ?? null, recalls: cached.recalls || [] };
  }

  try {
    const params = new URLSearchParams({ make, model });
    if (year) params.set('year', year);
    if (trim) params.set('trim', trim);
    const res = await fetch(`/api/vehicle-specs?${params.toString()}`);
    if (!res.ok) throw new Error(`Server error ${res.status}`);
    const data = await res.json();
    const result = { specs: data.specs ?? null, recalls: data.recalls || [] };
    writeCache({ key: cacheId, ...result, fetchedAt: Date.now() });
    return result;
  } catch (err) {
    console.warn('[vehicle-specs] fetch failed:', err.message);
    // Serve stale cache for the same vehicle if we have it
    if (cached && cached.key === cacheId) return { specs: cached.specs ?? null, recalls: cached.recalls || [] };
    return { specs: null, recalls: [] };
  }
}

export function clearRecallsCache() {
  try { localStorage.removeItem(CACHE_KEY); } catch { /* ignore */ }
}
