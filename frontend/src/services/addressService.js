// ── Canada-first address search using Nominatim (OpenStreetMap) ───────────────
// Default: Canada only. Pass includeUS = true to also search the US.
// Nominatim ToS: max 1 req/sec — enforced by 250ms debounce in UI.
// ─────────────────────────────────────────────────────────────────────────────

const NOMINATIM = 'https://nominatim.openstreetmap.org/search';

const CA_PROVINCES = {
  'Alberta':'AB','British Columbia':'BC','Manitoba':'MB',
  'New Brunswick':'NB','Newfoundland and Labrador':'NL',
  'Northwest Territories':'NT','Nova Scotia':'NS','Nunavut':'NU',
  'Ontario':'ON','Prince Edward Island':'PE','Quebec':'QC',
  'Saskatchewan':'SK','Yukon':'YT',
};

const US_STATES = {
  'Alabama':'AL','Alaska':'AK','Arizona':'AZ','Arkansas':'AR','California':'CA',
  'Colorado':'CO','Connecticut':'CT','Delaware':'DE','Florida':'FL','Georgia':'GA',
  'Hawaii':'HI','Idaho':'ID','Illinois':'IL','Indiana':'IN','Iowa':'IA',
  'Kansas':'KS','Kentucky':'KY','Louisiana':'LA','Maine':'ME','Maryland':'MD',
  'Massachusetts':'MA','Michigan':'MI','Minnesota':'MN','Mississippi':'MS','Missouri':'MO',
  'Montana':'MT','Nebraska':'NE','Nevada':'NV','New Hampshire':'NH','New Jersey':'NJ',
  'New Mexico':'NM','New York':'NY','North Carolina':'NC','North Dakota':'ND','Ohio':'OH',
  'Oklahoma':'OK','Oregon':'OR','Pennsylvania':'PA','Rhode Island':'RI','South Carolina':'SC',
  'South Dakota':'SD','Tennessee':'TN','Texas':'TX','Utah':'UT','Vermont':'VT',
  'Virginia':'VA','Washington':'WA','West Virginia':'WV','Wisconsin':'WI','Wyoming':'WY',
  'District of Columbia':'DC',
};

// ── Main search ───────────────────────────────────────────────────────────────

/**
 * Search for addresses matching `query`. Canada only by default.
 *
 * @param {string}      query      - User's search text (min 2 chars)
 * @param {boolean}     includeUS  - Also return US results (default false)
 * @param {AbortSignal} signal     - Optional AbortController signal
 * @returns {Promise<AddressResult[]>}
 *
 * @typedef {Object} AddressResult
 * @property {string}  shortName   Full display string, e.g. "13308 Central Ave, Surrey, BC V3T 4H5"
 * @property {string}  displayName Raw Nominatim display_name
 * @property {string}  street      Street with number, e.g. "13308 Central Ave" (may be empty)
 * @property {string}  city        City / town / municipality
 * @property {string}  province    Province / state abbreviation
 * @property {string}  country     "Canada" | "USA"
 * @property {string}  postalCode  Postal / ZIP code (uppercased, may be empty)
 * @property {number}  lat
 * @property {number}  lon
 * @property {boolean} isCanada
 * @property {boolean} isUS
 * @property {string}  flag        🇨🇦 or 🇺🇸
 */
export async function searchAddress(query, includeUS = false, signal = null) {
  const q = query?.trim();
  if (!q || q.length < 2) return [];

  const countrycodes = includeUS ? 'ca,us' : 'ca';

  const params = new URLSearchParams({
    q,
    format:            'json',
    addressdetails:    '1',
    limit:             '8',
    countrycodes,
    'accept-language': 'en-CA',
    dedupe:            '1',
  });

  try {
    const res = await fetch(`${NOMINATIM}?${params}`, {
      // Note: browsers block custom User-Agent; included for spec compliance
      headers: { 'User-Agent': 'FixItAI/1.0 (fixit-ai@example.com)' },
      ...(signal ? { signal } : {}),
    });

    if (!res.ok) return [];
    const raw = await res.json();
    if (!Array.isArray(raw)) return [];

    return raw
      .filter(r => {
        const cc = r.address?.country_code;
        return cc === 'ca' || (includeUS && cc === 'us');
      })
      .map(formatResult)
      .filter(Boolean)
      // Dedupe by shortName
      .filter((r, i, arr) => arr.findIndex(x => x.shortName === r.shortName) === i)
      .slice(0, 6);
  } catch (err) {
    if (err.name === 'AbortError') return [];
    console.warn('[addressService] search error:', err.message);
    return [];
  }
}

function formatResult(r) {
  const a    = r.address || {};
  const isCA = a.country_code === 'ca';
  const isUS = a.country_code === 'us';

  const provMap = isCA ? CA_PROVINCES : US_STATES;
  const prov    = provMap[a.state] || a.state || '';
  const city    = a.city || a.town || a.village || a.municipality || a.suburb || a.county || '';
  const road    = a.road || a.street || '';
  const num     = a.house_number || '';
  const street  = num ? `${num} ${road}`.trim() : road;
  const postal  = (a.postcode || '').toUpperCase();

  const parts    = [street, city, prov, postal].filter(Boolean);
  const shortName = parts.length
    ? parts.join(', ')
    : r.display_name.split(',').slice(0, 2).map(s => s.trim()).join(', ');

  if (!shortName) return null;

  return {
    shortName,
    displayName: r.display_name,
    street,
    city,
    province:   prov,
    country:    isCA ? 'Canada' : 'USA',
    postalCode: postal,
    lat:        parseFloat(r.lat),
    lon:        parseFloat(r.lon),
    isCanada:   isCA,
    isUS,
    flag:       isCA ? '🇨🇦' : '🇺🇸',
  };
}

// ── Postal validators ─────────────────────────────────────────────────────────

/**
 * Validate a postal/ZIP code.
 * @param {string}  value    - User-entered code
 * @param {boolean} isCanada - true = validate as Canadian postal, false = US ZIP
 * @returns {boolean}
 */
export function validatePostalCode(value, isCanada = true) {
  const s = (value || '').trim();
  if (!s) return false;
  if (isCanada) return /^[A-Za-z]\d[A-Za-z][ -]?\d[A-Za-z]\d$/.test(s);
  return /^\d{5}(-\d{4})?$/.test(s);
}

/**
 * Guess the country from a postal code format.
 * @param {string} code
 * @returns {'CA' | 'US' | ''}
 */
export function detectPostalCountry(code) {
  const s = (code || '').trim();
  if (!s) return '';
  if (/^[A-Za-z]\d/.test(s)) return 'CA';
  if (/^\d/.test(s))         return 'US';
  return '';
}
