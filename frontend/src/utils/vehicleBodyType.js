// ── Vehicle body type lookup ──────────────────────────────────────────────────
// Maps Make|Model to a silhouette body type for VehicleSilhouette.

export const BODY_TYPES = {
  'Honda|Civic': 'sedan', 'Honda|Accord': 'sedan', 'Toyota|Camry': 'sedan',
  'Toyota|Corolla': 'sedan', 'Hyundai|Elantra': 'sedan', 'Mazda|Mazda3': 'sedan',
  'BMW|3 Series': 'sedan', 'BMW|5 Series': 'sedan', 'Mercedes-Benz|C-Class': 'sedan',
  'Volkswagen|Jetta': 'sedan', 'Nissan|Altima': 'sedan', 'Dodge|Charger': 'sedan',
  'Tesla|Model 3': 'sedan', 'Tesla|Model S': 'sedan', 'Subaru|Legacy': 'sedan',
  'Honda|CR-V': 'suv', 'Honda|HR-V': 'suv', 'Honda|Pilot': 'suv',
  'Toyota|RAV4': 'suv', 'Toyota|Highlander': 'suv', 'Toyota|4Runner': 'suv',
  'Ford|Escape': 'suv', 'Ford|Explorer': 'suv', 'Ford|Bronco': 'suv',
  'Chevrolet|Equinox': 'suv', 'Chevrolet|Tahoe': 'suv', 'Chevrolet|Traverse': 'suv',
  'Mazda|CX-5': 'suv', 'Mazda|CX-9': 'suv', 'Jeep|Wrangler': 'suv',
  'Jeep|Grand Cherokee': 'suv', 'Kia|Sportage': 'suv', 'Kia|Telluride': 'suv',
  'Hyundai|Tucson': 'suv', 'Hyundai|Santa Fe': 'suv', 'Nissan|Rogue': 'suv',
  'Subaru|Forester': 'suv', 'Subaru|Outback': 'suv', 'Tesla|Model Y': 'suv',
  'BMW|X3': 'suv', 'BMW|X5': 'suv', 'Volkswagen|Tiguan': 'suv',
  'GMC|Yukon': 'suv', 'GMC|Acadia': 'suv', 'Hyundai|Ioniq 5': 'suv', 'Kia|EV6': 'suv',
  'Ford|F-150': 'truck', 'Ford|F-250': 'truck', 'Ford|Ranger': 'truck',
  'Chevrolet|Silverado 1500': 'truck', 'Chevrolet|Colorado': 'truck',
  'GMC|Sierra 1500': 'truck', 'GMC|Canyon': 'truck',
  'RAM|1500': 'truck', 'Ram|1500': 'truck',
  'Toyota|Tacoma': 'truck', 'Toyota|Tundra': 'truck', 'Nissan|Frontier': 'truck',
  'Honda|Ridgeline': 'truck', 'Tesla|Cybertruck': 'truck',
  'Ford|Mustang': 'coupe', 'Chevrolet|Camaro': 'coupe', 'Dodge|Challenger': 'coupe',
  'BMW|4 Series': 'coupe', 'Mercedes-Benz|CLA': 'coupe', 'Subaru|WRX': 'coupe',
  'Volkswagen|GTI': 'hatchback', 'Volkswagen|Golf GTI': 'hatchback', 'Chevrolet|Bolt': 'hatchback',
};

export function getBodyType(make, model) {
  return BODY_TYPES[make + '|' + model]
    || BODY_TYPES[make + '|' + (model || '').split(' ')[0]]
    || guessFromModel(model)
    || 'sedan';
}

function guessFromModel(model = '') {
  const m = model.toLowerCase();
  if (m.includes('f-1') || m.includes('f-2') || m.includes('sierra') || m.includes('silverado') || m.includes('tundra') || m.includes('tacoma') || m.includes('ranger') || m.includes('canyon') || m.includes('frontier') || m === '1500' || m === '2500' || m === '3500') return 'truck';
  if (m.includes('rav') || m.includes('pilot') || m.includes('explorer') || m.includes('highlander') || m.includes('escape') || m.includes('forester') || m.includes('tucson') || m.includes('sportage') || m.includes('cx-') || m.includes('cr-v') || m.includes('rogue') || m.includes('wrangler') || m.includes('telluride')) return 'suv';
  if (m.includes('mustang') || m.includes('camaro') || m.includes('challenger') || m.includes('corvette') || m.includes('wrx') || m.includes('brz') || m.includes('86')) return 'coupe';
  if (m.includes('golf') || m.includes('gti') || m.includes('bolt') || m.includes('hatch')) return 'hatchback';
  return 'sedan';
}
