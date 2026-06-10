// ── Wikipedia vehicle image service ──────────────────────────────────────────
// Fetches real vehicle photos from Wikipedia's REST API.
// Results are cached in-memory so repeated lookups are instant.
// ─────────────────────────────────────────────────────────────────────────────

const WIKI_SUMMARY = 'https://en.wikipedia.org/api/rest_v1/page/summary/';
const WIKI_SEARCH  = 'https://en.wikipedia.org/w/api.php';

/** In-memory cache: `${year}|${make}|${model}|${trim}` → URL | null */
const imageCache = new Map();

// ── Private helpers ───────────────────────────────────────────────────────────

/**
 * Try to fetch a Wikipedia article summary by exact title and extract thumbnail.
 * Returns a 600px image URL, or null if unavailable.
 */
async function fetchImageFromTitle(title) {
  try {
    const encoded = encodeURIComponent(title.trim());
    const res = await fetch(`${WIKI_SUMMARY}${encoded}`, {
      headers: { 'Accept': 'application/json' },
    });
    if (!res.ok) return null;
    const data = await res.json();
    // Prefer thumbnail over originalimage (better chance of being car-relevant)
    const src = data?.thumbnail?.source || data?.originalimage?.source;
    if (!src) return null;
    // Upscale to 600px for better quality
    return src.replace(/\/\d+px-/, '/600px-');
  } catch {
    return null;
  }
}

/**
 * Search Wikipedia for the most relevant article title.
 * Returns the title of the top result, or null.
 */
async function searchWikipediaTitle(query) {
  try {
    const params = new URLSearchParams({
      action:     'query',
      list:       'search',
      srsearch:   query,
      srnamespace:'0',
      srlimit:    '3',
      format:     'json',
      origin:     '*',
    });
    const res = await fetch(`${WIKI_SEARCH}?${params}`, {
      headers: { 'Accept': 'application/json' },
    });
    if (!res.ok) return null;
    const data = await res.json();
    const hits  = data?.query?.search;
    return hits?.length ? hits[0].title : null;
  } catch {
    return null;
  }
}

/**
 * Strip trailing model specifiers to get a base model name.
 * "Silverado 1500" → "Silverado"
 * "F-250 Super Duty" → "F-250"
 * "Sierra 2500HD"    → "Sierra"
 * "Civic"            → "Civic" (unchanged)
 */
function getModelBase(model) {
  return model
    .replace(/\s+(Super Duty|Super Cab|Regular Cab|Crew Cab|EV|Plug-In Hybrid|Hybrid)$/i, '')
    .replace(/\s+\d+(HD|LD)?$/i, '')
    .trim();
}

/**
 * Core image resolution with cascade:
 * 1. Direct title: "Make Model"
 * 2. Base model title: "Make ModelBase" (if different)
 * 3. Wikipedia search: "Make Model" → resolve top result's thumbnail
 */
async function fetchVehicleImage(year, make, model) {
  const modelBase = getModelBase(model);

  // ── Step 1: Try direct title ──────────────────────────────────────────────
  const directTitle = `${make} ${model}`;
  let url = await fetchImageFromTitle(directTitle);
  if (url) return url;

  // ── Step 2: Try base model (strips "1500", "Super Duty", etc.) ────────────
  if (modelBase !== model) {
    const baseTitle = `${make} ${modelBase}`;
    url = await fetchImageFromTitle(baseTitle);
    if (url) return url;
  }

  // ── Step 3: Wikipedia search as final fallback ────────────────────────────
  const searchQuery = modelBase !== model
    ? `${make} ${modelBase} automobile`
    : `${make} ${model} automobile`;

  const searchTitle = await searchWikipediaTitle(searchQuery);
  if (searchTitle) {
    url = await fetchImageFromTitle(searchTitle);
    if (url) return url;
  }

  return null;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Get a vehicle photo URL for the given make/model/year/trim.
 *
 * - Returns null if no photo is available (caller should show SVG fallback)
 * - Caches results so identical queries are resolved instantly
 * - Safe to call concurrently; duplicate in-flight calls will each fetch
 *   independently (results will converge in cache)
 *
 * @param {string} year  - e.g. "2022"
 * @param {string} make  - e.g. "Honda"
 * @param {string} model - e.g. "Civic"
 * @param {string} trim  - e.g. "Sport" (optional — not used in query)
 * @returns {Promise<string|null>} Image URL or null
 */
export async function getVehicleImage(year, make, model, trim) {
  if (!make || !model) return null;

  const cacheKey = `${year || ''}|${make}|${model}|${trim || ''}`;
  if (imageCache.has(cacheKey)) return imageCache.get(cacheKey);

  const url = await fetchVehicleImage(year, make, model).catch(() => null);
  imageCache.set(cacheKey, url);
  return url;
}

/**
 * Pre-warm the cache for a vehicle (call speculatively if you expect the
 * user will view the home tab soon).
 */
export function prewarmVehicleImage(year, make, model, trim) {
  getVehicleImage(year, make, model, trim);
}
