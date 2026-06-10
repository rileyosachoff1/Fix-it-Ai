// ── Trim level data ───────────────────────────────────────────────────────────
// Key format: "Make|Model" — must match MAKES and MODELS_BY_MAKE in vehicles.js
// ─────────────────────────────────────────────────────────────────────────────

export const TRIMS_BY_MAKE_MODEL = {
  // ── Honda ─────────────────────────────────────────────────────────────────
  'Honda|Civic':     ['LX', 'Sport', 'EX', 'EX-L', 'Touring', 'Si', 'Type R'],
  'Honda|Accord':    ['LX', 'Sport', 'Sport-L', 'EX-L', 'Touring', 'Hybrid', 'Hybrid Sport', 'Hybrid EX-L', 'Hybrid Touring'],
  'Honda|CR-V':      ['LX', 'EX', 'EX-L', 'Touring', 'Sport', 'Hybrid Sport', 'Hybrid EX-L', 'Hybrid Touring'],
  'Honda|Pilot':     ['LX', 'EX', 'EX-L', 'Sport', 'Touring', 'Elite', 'TrailSport'],
  'Honda|Odyssey':   ['LX', 'EX', 'EX-L', 'Touring', 'Elite'],
  'Honda|Passport':  ['Sport', 'EX-L', 'Touring', 'Elite', 'TrailSport'],
  'Honda|Ridgeline': ['Sport', 'RTL', 'RTL-E', 'Black Edition', 'TrailSport'],
  'Honda|HR-V':      ['LX', 'Sport', 'EX', 'EX-L'],
  'Honda|Fit':       ['LX', 'Sport', 'EX', 'EX-L'],

  // ── Toyota ────────────────────────────────────────────────────────────────
  'Toyota|Camry':      ['LE', 'SE', 'XLE', 'XSE', 'TRD', 'Hybrid LE', 'Hybrid SE', 'Hybrid XLE', 'Hybrid XSE'],
  'Toyota|Corolla':    ['L', 'LE', 'SE', 'XLE', 'XSE', 'Hybrid LE', 'GR'],
  'Toyota|RAV4':       ['LE', 'XLE', 'XLE Premium', 'TRD Off-Road', 'Adventure', 'Limited', 'Prime SE', 'Prime XSE'],
  'Toyota|Highlander': ['L', 'LE', 'XLE', 'XSE', 'Limited', 'Platinum', 'Hybrid LE', 'Hybrid XLE', 'Hybrid Limited', 'Hybrid Platinum'],
  'Toyota|Tacoma':     ['SR', 'SR5', 'TRD Sport', 'TRD Off-Road', 'Limited', 'TRD Pro', 'Trailhunter'],
  'Toyota|Tundra':     ['SR', 'SR5', 'Limited', 'Platinum', '1794 Edition', 'TRD Pro', 'Capstone'],
  'Toyota|4Runner':    ['SR5', 'SR5 Premium', 'TRD Sport', 'TRD Off-Road', 'TRD Off-Road Premium', 'Limited', 'TRD Pro', 'Venture'],
  'Toyota|Sienna':     ['LE', 'XLE', 'XSE', 'Limited', 'Platinum'],
  'Toyota|Prius':      ['LE', 'XLE', 'Limited', 'Prime SE', 'Prime XSE', 'Prime XSE Premium'],
  'Toyota|Sequoia':    ['SR5', 'Limited', 'Platinum', 'TRD Pro', 'Capstone'],
  'Toyota|Venza':      ['LE', 'XLE', 'Limited'],
  'Toyota|GR86':       ['Base', 'Premium'],
  'Toyota|Supra':      ['2.0', '3.0', '3.0 Premium', 'A91-CF Edition', 'A91-MT Edition'],
  'Toyota|Land Cruiser': ['Base', 'Premium', 'First Edition'],

  // ── Ford ──────────────────────────────────────────────────────────────────
  'Ford|F-150':        ['XL', 'XLT', 'Lariat', 'King Ranch', 'Platinum', 'Limited', 'Raptor', 'Raptor R', 'Tremor'],
  'Ford|Explorer':     ['Base', 'XLT', 'ST-Line', 'Timberline', 'Limited', 'ST', 'Platinum', 'King Ranch'],
  'Ford|Escape':       ['Base', 'Active', 'ST-Line', 'ST-Line Select', 'ST-Line Elite', 'Plug-In Hybrid ST-Line', 'Plug-In Hybrid ST-Line Select'],
  'Ford|Bronco':       ['Base', 'Big Bend', 'Black Diamond', 'Outer Banks', 'Badlands', 'Wildtrak', 'Everglades', 'Raptor', 'Heritage', 'Heritage Limited'],
  'Ford|Bronco Sport': ['Base', 'Big Bend', 'Outer Banks', 'Badlands', 'Heritage', 'Heritage Limited'],
  'Ford|Maverick':     ['XL', 'XLT', 'Lariat', 'Tremor'],
  'Ford|Ranger':       ['XL', 'XLT', 'Lariat', 'Raptor', 'Tremor'],
  'Ford|Mustang':      ['EcoBoost', 'EcoBoost Premium', 'GT', 'GT Premium', 'Dark Horse', 'Shelby GT500'],
  'Ford|Edge':         ['SE', 'SEL', 'ST-Line', 'ST', 'Titanium'],
  'Ford|Expedition':   ['XL', 'XLT', 'Limited', 'Timberline', 'King Ranch', 'Platinum', 'Stealth Edition'],
  'Ford|F-250 Super Duty': ['XL', 'XLT', 'Lariat', 'King Ranch', 'Platinum', 'Limited', 'Tremor'],
  'Ford|F-350 Super Duty': ['XL', 'XLT', 'Lariat', 'King Ranch', 'Platinum', 'Limited', 'Tremor'],

  // ── Chevrolet ─────────────────────────────────────────────────────────────
  'Chevrolet|Silverado 1500':   ['WT', 'Custom', 'Custom Trail Boss', 'LT', 'LT Trail Boss', 'RST', 'LTZ', 'High Country', 'ZR2'],
  'Chevrolet|Silverado 2500HD': ['WT', 'Custom', 'LT', 'LTZ', 'High Country'],
  'Chevrolet|Silverado 3500HD': ['WT', 'Custom', 'LT', 'LTZ', 'High Country'],
  'Chevrolet|Equinox':   ['LS', 'LT', 'RS', 'Premier'],
  'Chevrolet|Tahoe':     ['LS', 'LT', 'RST', 'Z71', 'Premier', 'High Country'],
  'Chevrolet|Suburban':  ['LS', 'LT', 'RST', 'Z71', 'Premier', 'High Country'],
  'Chevrolet|Colorado':  ['WT', 'LT', 'Z71', 'Trail Boss', 'ZR2'],
  'Chevrolet|Traverse':  ['LS', 'LT', 'RS', 'Activ', 'Premier', 'High Country'],
  'Chevrolet|Blazer':    ['LT', '2LT', 'RS', 'SS', 'Premier'],
  'Chevrolet|Trax':      ['LS', 'LT', 'RS', 'Activ'],
  'Chevrolet|Malibu':    ['LS', 'RS', 'LT', 'Premier'],
  'Chevrolet|Corvette':  ['Stingray 1LT', 'Stingray 2LT', 'Stingray 3LT', 'Z06 1LZ', 'Z06 2LZ', 'Z06 3LZ', 'E-Ray', 'ZR1'],
  'Chevrolet|Camaro':    ['LS', '1LT', '2LT', 'LT1', '1SS', '2SS', 'ZL1'],
  'Chevrolet|Spark':     ['LS', '1LT', 'ACTIV', '2LT'],
  'Chevrolet|Trailblazer': ['LS', 'LT', 'Activ', 'RS', 'ACTIV'],

  // ── GMC ───────────────────────────────────────────────────────────────────
  'GMC|Sierra 1500':   ['Pro', 'SLE', 'Elevation', 'SLT', 'AT4', 'AT4X', 'Denali', 'Denali Ultimate'],
  'GMC|Sierra 2500HD': ['Pro', 'SLE', 'SLT', 'AT4', 'AT4X', 'Denali', 'Denali Ultimate'],
  'GMC|Sierra 3500HD': ['Pro', 'SLE', 'SLT', 'AT4', 'Denali'],
  'GMC|Terrain':  ['SL', 'SLE', 'SLT', 'AT4', 'Denali'],
  'GMC|Yukon':    ['SLE', 'SLT', 'AT4', 'Denali', 'Denali Ultimate'],
  'GMC|Canyon':   ['Pro', 'SLE', 'Elevation', 'SLT', 'AT4', 'AT4X', 'Denali'],
  'GMC|Acadia':   ['SL', 'SLE', 'SLT', 'AT4', 'Denali'],
  'GMC|Envoy':    ['SLE', 'SLT', 'Denali'],

  // ── Ram ───────────────────────────────────────────────────────────────────
  'Ram|1500':     ['Tradesman', 'Big Horn', 'Lone Star', 'Laramie', 'Rebel', 'Limited', 'Limited Longhorn', 'TRX', 'Tungsten'],
  'Ram|2500':     ['Tradesman', 'Big Horn', 'Lone Star', 'Laramie', 'Power Wagon', 'Limited', 'Limited Longhorn'],
  'Ram|3500':     ['Tradesman', 'Big Horn', 'Lone Star', 'Laramie', 'Limited', 'Limited Longhorn'],
  'Ram|ProMaster City': ['Tradesman', 'Wagon SLT', 'Wagon Limited'],

  // ── Jeep ──────────────────────────────────────────────────────────────────
  'Jeep|Wrangler':       ['Sport', 'Sport S', 'Willys', 'Sahara', 'Sahara Altitude', 'Rubicon', 'Rubicon 392', '4xe', 'Rubicon 4xe'],
  'Jeep|Grand Cherokee': ['Laredo', 'Altitude', 'Limited', 'Limited X', 'Trailhawk', 'Overland', 'Summit', 'Summit Reserve', 'SRT', 'Trackhawk'],
  'Jeep|Cherokee':       ['Sport', 'Latitude', 'Latitude Plus', 'Latitude Lux', 'Trailhawk', 'Limited', 'High Altitude'],
  'Jeep|Compass':        ['Sport', 'Latitude', 'Latitude Lux', 'Limited', 'Trailhawk'],
  'Jeep|Gladiator':      ['Sport', 'Sport S', 'Willys', 'Overland', 'Mojave', 'Rubicon'],
  'Jeep|Renegade':       ['Sport', 'Latitude', 'Altitude', 'Limited', 'Trailhawk', '80th Anniversary'],

  // ── Dodge ─────────────────────────────────────────────────────────────────
  'Dodge|Charger':    ['SXT', 'GT', 'R/T', 'Daytona', 'Scat Pack', 'SRT 392', 'Hellcat', 'Jailbreak', 'SRT Super Stock'],
  'Dodge|Challenger': ['SXT', 'GT', 'R/T', 'R/T Scat Pack', 'Scat Pack 392', 'SRT 392', 'SRT Hellcat', 'SRT Hellcat Redeye', 'SRT Super Stock', 'SRT Demon 170'],
  'Dodge|Durango':    ['SXT', 'GT', 'R/T', 'Citadel', 'SRT 392', 'SRT Hellcat'],

  // ── Chrysler ──────────────────────────────────────────────────────────────
  'Chrysler|300':        ['Touring', 'Touring L', 'S', '300C', 'Executive Series'],
  'Chrysler|Pacifica':   ['Touring', 'Touring L', 'Touring L Plus', 'Limited', 'Pinnacle', 'Hybrid Touring', 'Hybrid Touring Plus', 'Hybrid Limited', 'Hybrid Pinnacle'],
  'Chrysler|Voyager':    ['LX', 'LXI'],

  // ── Nissan ────────────────────────────────────────────────────────────────
  'Nissan|Altima':   ['S', 'SV', 'SR', 'SL', 'Platinum'],
  'Nissan|Rogue':    ['S', 'SV', 'SL', 'Platinum', 'Rock Creek'],
  'Nissan|Frontier': ['S', 'SV', 'Pro-X', 'Pro-4X', 'SL'],
  'Nissan|Titan':    ['S', 'SV', 'Pro-4X', 'SL', 'Platinum Reserve'],
  'Nissan|Pathfinder': ['S', 'SV', 'SL', 'Rock Creek', 'Platinum'],
  'Nissan|Murano':   ['S', 'SV', 'SL', 'Platinum'],
  'Nissan|Sentra':   ['S', 'SV', 'SR'],
  'Nissan|Maxima':   ['S', 'SV', 'SR', 'SL', 'Platinum'],
  'Nissan|Armada':   ['S', 'SV', 'SL', 'Platinum'],
  'Nissan|Kicks':    ['S', 'SV', 'SR'],
  'Nissan|Versa':    ['S', 'SV', 'SR'],
  'Nissan|370Z':     ['Sport', 'Sport Touring', 'NISMO'],
  'Nissan|GT-R':     ['Premium', 'Track Edition', 'NISMO'],

  // ── Subaru ────────────────────────────────────────────────────────────────
  'Subaru|Outback':    ['Base', 'Premium', 'Limited', 'Sport', 'Limited XT', 'Touring XT', 'Wilderness'],
  'Subaru|Forester':   ['Base', 'Premium', 'Sport', 'Limited', 'Touring', 'Wilderness'],
  'Subaru|Crosstrek':  ['Base', 'Premium', 'Sport', 'Limited', 'Wilderness'],
  'Subaru|Impreza':    ['Base', 'Premium', 'Sport', 'Limited'],
  'Subaru|WRX':        ['Base', 'Premium', 'Limited', 'GT', 'tS'],
  'Subaru|Legacy':     ['Base', 'Premium', 'Sport', 'Limited', 'Touring XT'],
  'Subaru|Ascent':     ['Base', 'Premium', 'Limited', 'Touring', 'Onyx Edition XT'],
  'Subaru|BRZ':        ['Premium', 'Limited', 'tS', 'Series.White', 'Series.Yellow'],

  // ── Hyundai ───────────────────────────────────────────────────────────────
  'Hyundai|Tucson':    ['SE', 'SEL', 'N Line', 'XRT', 'Limited', 'Hybrid Blue', 'Hybrid SEL', 'Hybrid N Line', 'Hybrid Limited', 'Plug-in Hybrid SEL'],
  'Hyundai|Santa Fe':  ['SE', 'SEL', 'XRT', 'Limited', 'Calligraphy', 'Hybrid SEL', 'Hybrid Limited', 'Hybrid Calligraphy'],
  'Hyundai|Sonata':    ['SE', 'SEL', 'SEL Plus', 'N Line', 'Limited', 'Hybrid Blue', 'Hybrid SEL', 'Hybrid SEL Premium', 'Hybrid Limited'],
  'Hyundai|Elantra':   ['SE', 'SEL', 'N Line', 'Limited', 'Hybrid Blue', 'Hybrid SEL', 'Hybrid Limited', 'N'],
  'Hyundai|Kona':      ['SE', 'SEL', 'N Line', 'XRT', 'Limited'],
  'Hyundai|Palisade':  ['SE', 'SEL', 'XRT', 'Limited', 'Calligraphy'],
  'Hyundai|Ioniq 5':   ['SE Standard Range', 'SE', 'SEL', 'Limited'],
  'Hyundai|Ioniq 6':   ['SE Standard Range', 'SE', 'SEL', 'Limited'],
  'Hyundai|Accent':    ['SE', 'SEL'],
  'Hyundai|Venue':     ['SE', 'SEL', 'Denim'],

  // ── Kia ───────────────────────────────────────────────────────────────────
  'Kia|Telluride':  ['LX', 'S', 'EX', 'SX', 'SX Prestige', 'X-Pro', 'X-Line SX Prestige'],
  'Kia|Sorento':    ['LX', 'S', 'EX', 'SX', 'SX Prestige', 'X-Line SX', 'Hybrid EX', 'Hybrid SX Prestige', 'PHEV EX', 'PHEV SX Prestige'],
  'Kia|Sportage':   ['LX', 'S', 'EX', 'SX', 'SX Prestige', 'X-Line', 'X-Pro', 'Hybrid LX', 'Hybrid EX', 'Plug-in Hybrid EX'],
  'Kia|Forte':      ['FE', 'LX', 'LXS', 'GT-Line', 'EX', 'GT'],
  'Kia|Soul':       ['LX', 'S', 'GT-Line', 'EX', 'Turbo'],
  'Kia|Carnival':   ['LX', 'EX', 'SX', 'SX Prestige'],
  'Kia|K5':         ['LX', 'GT-Line', 'EX', 'GT', 'GT-Line AWD'],
  'Kia|EV6':        ['Light', 'Wind', 'GT-Line', 'GT'],
  'Kia|Stinger':    ['GT-Line', 'GT', 'GT1', 'GT2', 'GT Elite'],

  // ── BMW ───────────────────────────────────────────────────────────────────
  'BMW|3 Series':   ['330i', '330i xDrive', 'M340i', 'M340i xDrive', '330e', '330e xDrive', 'M3', 'M3 Competition', 'M3 CS', 'M3 Tour'],
  'BMW|4 Series':   ['430i', '430i xDrive', 'M440i', 'M440i xDrive', 'M4', 'M4 Competition', 'M4 CS', 'M4 CSL'],
  'BMW|5 Series':   ['530i', '530i xDrive', '540i', '540i xDrive', 'M550i xDrive', '530e', 'M5', 'M5 Competition', 'M5 CS'],
  'BMW|7 Series':   ['740i', '740i xDrive', '760i xDrive', 'Alpina B7', 'M760i xDrive'],
  'BMW|X1':  ['sDrive28i', 'xDrive28i', 'M35i'],
  'BMW|X3':  ['sDrive30i', 'xDrive30i', 'M40i', 'xDrive30e', 'M Competition'],
  'BMW|X5':  ['sDrive40i', 'xDrive40i', 'xDrive50e', 'M60i xDrive', 'M Competition'],
  'BMW|X7':  ['xDrive40i', 'xDrive50i', 'Alpina XB7', 'M70i xDrive'],

  // ── Mercedes-Benz ─────────────────────────────────────────────────────────
  'Mercedes-Benz|C-Class':   ['C 300', 'C 300 4MATIC', 'AMG C 43', 'AMG C 43 4MATIC', 'AMG C 63 S E Performance'],
  'Mercedes-Benz|E-Class':   ['E 350', 'E 450', 'AMG E 53', 'AMG E 63 S'],
  'Mercedes-Benz|S-Class':   ['S 500', 'S 500 4MATIC', 'S 580', 'S 580 4MATIC', 'Maybach S 580', 'AMG S 63 E Performance'],
  'Mercedes-Benz|GLA':  ['GLA 250', 'GLA 250 4MATIC', 'AMG GLA 35', 'AMG GLA 45 S'],
  'Mercedes-Benz|GLB':  ['GLB 250', 'GLB 250 4MATIC', 'AMG GLB 35'],
  'Mercedes-Benz|GLC':  ['GLC 300', 'GLC 300 4MATIC', 'AMG GLC 43', 'AMG GLC 43 4MATIC', 'AMG GLC 63 S E Performance'],
  'Mercedes-Benz|GLE':  ['GLE 350', 'GLE 350 4MATIC', 'GLE 450 4MATIC', 'GLE 580 4MATIC', 'AMG GLE 53', 'AMG GLE 63 S'],
  'Mercedes-Benz|GLS':  ['GLS 450', 'GLS 580', 'Maybach GLS 600', 'AMG GLS 63'],

  // ── Audi ──────────────────────────────────────────────────────────────────
  'Audi|A3':   ['Premium', 'Premium Plus', 'Prestige', 'S3 Premium', 'S3 Prestige', 'RS 3'],
  'Audi|A4':   ['Premium', 'Premium Plus', 'Prestige', 'S4 Premium', 'S4 Premium Plus', 'S4 Prestige', 'RS 4'],
  'Audi|A6':   ['Premium', 'Premium Plus', 'Prestige', 'S6 Premium', 'S6 Prestige', 'RS 6'],
  'Audi|A8':   ['Premium', 'Premium Plus', 'Prestige'],
  'Audi|Q3':   ['Premium', 'Premium Plus', 'Prestige'],
  'Audi|Q5':   ['Premium', 'Premium Plus', 'Prestige', 'SQ5 Premium', 'SQ5 Premium Plus', 'SQ5 Prestige', 'e PHEV Premium', 'e PHEV Prestige'],
  'Audi|Q7':   ['Premium', 'Premium Plus', 'Prestige', 'SQ7 Premium', 'SQ7 Prestige'],
  'Audi|Q8':   ['Premium', 'Premium Plus', 'Prestige', 'SQ8 Premium', 'SQ8 Prestige', 'RS Q8'],
  'Audi|TT':   ['S Line Competition', 'RS', 'RS Coupe', 'RS Roadster'],
  'Audi|R8':   ['V10 Performance', 'V10 Performance Spyder', 'V10 GT Coupe', 'V10 GT Spyder'],

  // ── Volkswagen ────────────────────────────────────────────────────────────
  'Volkswagen|Jetta':   ['S', 'Sport', 'SE', 'SEL', 'SEL R-Line', 'GLI S', 'GLI SE', 'GLI Autobahn'],
  'Volkswagen|Passat':  ['S', 'SE', 'SE Business', 'SEL', 'SEL Premium'],
  'Volkswagen|Tiguan':  ['S', 'SE', 'SE R-Line Black', 'SEL', 'SEL R-Line'],
  'Volkswagen|Atlas':   ['S', 'SE', 'SE Technology', 'SEL', 'SEL Premium', 'SEL R-Line', 'SEL R-Line Black'],
  'Volkswagen|ID.4':    ['Standard', 'Pro', 'Pro S', 'AWD Pro', 'AWD Pro S', 'AWD Pro S Plus'],
  'Volkswagen|Golf GTI': ['S', 'SE', 'Autobahn'],
  'Volkswagen|Golf R':  ['Golf R'],
  'Volkswagen|Taos':    ['S', 'SE', 'SEL'],

  // ── Lexus ─────────────────────────────────────────────────────────────────
  'Lexus|ES': ['ES 250', 'ES 300h', 'ES 350', 'F Sport', 'Luxury'],
  'Lexus|IS': ['IS 300', 'IS 300 AWD', 'IS 350', 'IS 350 AWD', 'IS 500 F Sport Performance'],
  'Lexus|RX': ['RX 350', 'RX 350h', 'RX 500h F Sport Performance', 'RX 350 Premium', 'RX 350 Luxury'],
  'Lexus|NX': ['NX 250', 'NX 350', 'NX 350h', 'NX 450h+', 'F Sport', 'F Sport Handling', 'Luxury'],
  'Lexus|GX': ['Premium', 'Luxury', 'F Sport'],
  'Lexus|LX': ['LX 600', 'LX 600 Premium', 'LX 600 Luxury', 'LX 600 F Sport', 'LX 600 Ultra Luxury'],
  'Lexus|UX': ['UX 200', 'UX 250h', 'F Sport'],
  'Lexus|LS': ['LS 500', 'LS 500 AWD', 'LS 500h', 'LS 500h AWD'],
  'Lexus|RC': ['RC 300', 'RC 300 AWD', 'RC 350', 'RC F', 'RC F Track Edition'],
  'Lexus|LC': ['LC 500', 'LC 500h', 'Inspiration Series'],

  // ── Acura ─────────────────────────────────────────────────────────────────
  'Acura|MDX':  ['Base', 'Technology', 'A-Spec Technology', 'Advance', 'Type S', 'Type S Advance'],
  'Acura|RDX':  ['Base', 'Technology', 'A-Spec Technology', 'Advance', 'PMC Edition'],
  'Acura|TLX':  ['Base', 'Technology', 'A-Spec Technology', 'Advance', 'Type S', 'Type S PMC Edition'],
  'Acura|ILX':  ['Base', 'Technology', 'A-Spec Technology', 'A-Spec Red'],
  'Acura|NSX':  ['Base', 'Type S'],

  // ── Infiniti ──────────────────────────────────────────────────────────────
  'INFINITI|Q50':  ['Pure', 'Luxe', 'Sensory', 'Red Sport 400'],
  'INFINITI|Q60':  ['Pure', 'Luxe', 'Sensory', 'Red Sport 400'],
  'INFINITI|QX50': ['Pure', 'Luxe', 'Sensory', 'Autograph', 'Essential'],
  'INFINITI|QX60': ['Pure', 'Luxe', 'Sensory', 'Autograph'],
  'INFINITI|QX80': ['Luxe', 'Sensory', 'Autograph'],

  // ── Cadillac ──────────────────────────────────────────────────────────────
  'Cadillac|Escalade':  ['Luxury', 'Premium Luxury', 'Sport', 'V-Series Blackwing', 'Premium Luxury Platinum', 'Sport Platinum'],
  'Cadillac|CT4':       ['Premium Luxury', 'Sport', 'V-Series', 'V-Series Blackwing'],
  'Cadillac|CT5':       ['Premium Luxury', 'Sport', 'V-Series', 'V-Series Blackwing'],
  'Cadillac|XT4':       ['Luxury', 'Premium Luxury', 'Sport'],
  'Cadillac|XT5':       ['Luxury', 'Premium Luxury', 'Sport'],
  'Cadillac|XT6':       ['Luxury', 'Premium Luxury', 'Sport'],
  'Cadillac|LYRIQ':     ['Luxury', 'Sport', 'Luxury AWD', 'Sport AWD'],

  // ── Lincoln ───────────────────────────────────────────────────────────────
  'Lincoln|Navigator': ['Standard', 'Reserve', 'Black Label'],
  'Lincoln|Aviator':   ['Standard', 'Reserve', 'Black Label', 'Grand Touring'],
  'Lincoln|Corsair':   ['Standard', 'Reserve', 'Black Label', 'Grand Touring'],
  'Lincoln|Nautilus':  ['Standard', 'Reserve', 'Black Label'],

  // ── Tesla ─────────────────────────────────────────────────────────────────
  'Tesla|Model 3': ['Standard Range Plus', 'Long Range', 'Performance'],
  'Tesla|Model Y': ['Standard Range', 'Long Range', 'Performance', 'Long Range AWD'],
  'Tesla|Model S': ['Long Range', 'Plaid'],
  'Tesla|Model X': ['Long Range', 'Plaid'],
  'Tesla|Cybertruck': ['AWD', 'Cyberbeast'],

  // ── Mazda ─────────────────────────────────────────────────────────────────
  'Mazda|CX-5':    ['2.5 S', '2.5 S Select', '2.5 S Preferred', '2.5 S Premium', '2.5 Turbo', '2.5 Turbo Premium', '2.5 Turbo Premium Plus', 'Carbon Edition'],
  'Mazda|CX-9':    ['Sport', 'Touring', 'Carbon Edition', 'Grand Touring', 'Grand Touring Reserve', 'Signature'],
  'Mazda|CX-30':   ['2.5 S', '2.5 S Select', '2.5 S Premium', '2.5 Turbo', '2.5 Turbo Premium Plus'],
  'Mazda|Mazda3':  ['2.5 S', '2.5 S Select', '2.5 S Carbon Edition', '2.5 S Preferred', '2.5 Turbo', 'Turbo Premium', 'Turbo Premium Plus'],
  'Mazda|Mazda6':  ['Sport', 'Touring', 'Carbon Edition', 'Grand Touring', 'Grand Touring Reserve', 'Signature'],
  'Mazda|MX-5 Miata': ['Sport', 'Club', 'Grand Touring', 'RF Club', 'RF Grand Touring'],

  // ── Mitsubishi ────────────────────────────────────────────────────────────
  'Mitsubishi|Outlander':    ['ES', 'SE', 'SEL', 'SEL Premium', 'PHEV ES', 'PHEV SE', 'PHEV SEL', 'PHEV SEL Premium'],
  'Mitsubishi|Eclipse Cross': ['ES', 'SE', 'SEL', 'SEL Premium'],
  'Mitsubishi|Mirage':       ['ES', 'LE', 'G4 ES', 'G4 SE', 'G4 SEL'],

  // ── Volvo ─────────────────────────────────────────────────────────────────
  'Volvo|XC90': ['Core', 'Plus', 'Ultimate', 'Recharge Plus', 'Recharge Ultimate'],
  'Volvo|XC60': ['Core', 'Plus', 'Ultimate', 'Recharge Core', 'Recharge Plus', 'Recharge Ultimate'],
  'Volvo|XC40': ['Core', 'Plus', 'Ultimate', 'Recharge Core', 'Recharge Plus', 'Recharge Ultimate'],
  'Volvo|S60':  ['Core', 'Plus', 'Ultimate', 'Recharge Plus', 'Recharge Ultimate'],
  'Volvo|V60':  ['Core', 'Plus', 'Ultimate'],
  'Volvo|S90':  ['Plus', 'Ultimate'],
  'Volvo|V90':  ['Plus', 'Ultimate'],

  // ── Land Rover ────────────────────────────────────────────────────────────
  'Land Rover|Defender':      ['90 X', '90 S', '90 SE', '90 HSE', '90 XS Edition', '110 X', '110 S', '110 SE', '110 HSE', '110 XS Edition'],
  'Land Rover|Range Rover':   ['SE', 'HSE', 'SV', 'Autobiography', 'SV Autobiography'],
  'Land Rover|Range Rover Sport': ['SE Dynamic', 'HSE Dynamic', 'SVR', 'Autobiography Dynamic'],
  'Land Rover|Discovery':     ['S', 'SE', 'HSE', 'HSE Luxury', 'Metropolitan Edition'],
  'Land Rover|Discovery Sport': ['S', 'SE', 'HSE', 'Dynamic SE', 'Dynamic HSE'],

  // ── Porsche ───────────────────────────────────────────────────────────────
  'Porsche|911':   ['Carrera', 'Carrera S', 'Carrera 4', 'Carrera 4S', 'Targa 4', 'Targa 4S', 'GTS', 'GT3', 'GT3 RS', 'Turbo', 'Turbo S'],
  'Porsche|718 Cayman': ['Base', 'S', 'GTS 4.0', 'GT4', 'GT4 RS'],
  'Porsche|718 Boxster': ['Base', 'S', 'GTS 4.0', 'Spyder'],
  'Porsche|Cayenne':    ['Base', 'S', 'GTS', 'Turbo', 'Turbo S E-Hybrid', 'E-Hybrid', 'S E-Hybrid'],
  'Porsche|Macan':      ['Base', 'S', 'GTS'],
  'Porsche|Panamera':   ['Base', 'S', '4S', 'GTS', 'Turbo', 'Turbo S E-Hybrid'],
  'Porsche|Taycan':     ['Base', '4S', 'GTS', 'Turbo', 'Turbo S', 'Cross Turismo'],

  // ── Buick ─────────────────────────────────────────────────────────────────
  'Buick|Enclave':    ['Preferred', 'Essence', 'ST', 'Avenir'],
  'Buick|Encore':     ['Preferred', 'Sport Touring', 'Essence'],
  'Buick|Encore GX':  ['Preferred', 'Select', 'ST', 'Essence'],
  'Buick|Envision':   ['Preferred', 'Essence', 'ST', 'Avenir'],
  'Buick|LaCrosse':   ['Preferred', 'Essence', 'Avenir'],

  // ── Genesis ───────────────────────────────────────────────────────────────
  'Genesis|G70':    ['Standard', '2.0T', '3.3T Sport', '3.3T Design', '3.3T Elite'],
  'Genesis|G80':    ['2.5T Standard', '2.5T Advanced', '3.5T Sport Prestige', 'Electrified Advanced'],
  'Genesis|G90':    ['3.3T Premium', '5.0 Ultimate', '5.0 Prestige'],
  'Genesis|GV70':   ['Standard', 'Advanced', 'Sport Advanced', 'Sport Prestige', 'Electrified Advanced', 'Electrified Sport Advanced'],
  'Genesis|GV80':   ['Standard', 'Advanced', 'Prestige', '3.5T Sport Prestige'],
};

// ── Default trims when no specific data exists ────────────────────────────────
const DEFAULT_TRIMS = ['Base', 'Standard', 'Sport', 'SE', 'Limited', 'Premium', 'Touring', 'Platinum'];

/**
 * Get trim levels for a specific make + model combination.
 * Returns DEFAULT_TRIMS if no specific data exists.
 */
export function getTrimsForModel(make, model) {
  if (!make || !model) return DEFAULT_TRIMS;
  const key = `${make}|${model}`;
  return TRIMS_BY_MAKE_MODEL[key] || DEFAULT_TRIMS;
}
