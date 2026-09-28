/**
 * builtUpGeometry.js
 * Pure math engine — computes structural section properties from plate dimensions.
 * All dimensions in mm. Properties returned in standard units matching the AISC database schema.
 *
 * Supported types:
 *   'I-SECTION'    — Doubly-symmetric built-up I (two flanges + web plate)
 *   'PLATE-GIRDER' — Same geometry as I-SECTION, different label
 *   'BOX'          — Doubly-symmetric box (two flange plates + two web plates)
 *   'BU-CHANNEL'   — Built-up channel (web + two flange plates, open)
 */

const STEEL_DENSITY = 7850; // kg/m³

/**
 * Main entry point.
 * @param {Object} config  { type, d, bf, tw, tf, [designation] }
 * @returns {Object} Section object compatible with the calculation engine
 */
export function computeBuiltUpProperties(config) {
  const { type } = config;
  switch (type) {
    case 'I-SECTION':
    case 'PLATE-GIRDER':
    case 'W':
      return computeISection(config);
    case 'BOX':
    case 'HSS':
    case 'SQUARE-HSS':
    case 'RECT-HSS':
      return computeBoxSection(config);
    case 'BU-CHANNEL':
    case 'C':
    case 'MC':
      return computeChannelSection(config);
    case 'BU-TEE':
    case 'WT':
      return computeTeeSection(config);
    case 'SINGLE-ANGLE':
    case 'L':
      return computeSingleAngle(config);
    case 'DOUBLE-ANGLE':
    case '2L':
      return computeDoubleAngle(config);
    default:
      return computeISection(config);
  }
}

// ─── Validation ──────────────────────────────────────────────────────────────

/**
 * Returns an array of validation error strings.
 * Empty array = valid.
 */
export function validateBuiltUpInputs(config) {
  const errors = [];
  const { type, d, bf, tw, tf } = config;

  const check = (val, name) => {
    if (val === null || val === undefined || isNaN(val) || val <= 0) {
      errors.push(`${name} must be a positive number.`);
    }
  };

  check(d,  'Overall depth (d)');
  check(bf, 'Flange width (bf)');
  check(tw, 'Web thickness (tw)');
  check(tf, 'Flange thickness (tf)');

  if (errors.length) return errors;

  const hw = d - 2 * tf;
  if (hw <= 0) {
    errors.push(`Flange thickness tf=${tf} is too large — no web height left (d − 2tf = ${hw.toFixed(1)} mm ≤ 0).`);
  }
  if (tw >= bf) {
    errors.push(`Web thickness tw=${tw} must be less than flange width bf=${bf}.`);
  }
  if (bf < 2 * tw) {
    errors.push(`Flange width bf=${bf} must be ≥ 2 × tw = ${(2 * tw).toFixed(1)} mm.`);
  }
  if (tf >= d / 2) {
    errors.push(`Flange thickness tf=${tf} must be < d/2 = ${(d / 2).toFixed(1)} mm.`);
  }
  if (type === 'BOX' || type === 'HSS' || type === 'SQUARE-HSS' || type === 'RECT-HSS') {
    if (2 * tw >= bf) errors.push(`Box: 2·tw (${2 * tw}) must be < bf (${bf}).`);
    if (2 * tf >= d)  errors.push(`Box: 2·tf (${2 * tf}) must be < d (${d}).`);
  }
  if (type === 'BU-TEE' || type === 'WT') {
    if (tf >= d) errors.push(`Tee: tf (${tf}) must be < d (${d}).`);
  }
  if (type === 'SINGLE-ANGLE' || type === 'L') {
    const b = config.b || bf; // leg 2
    if (tw >= d) errors.push(`Angle: thickness (${tw}) must be < leg 1 (${d}).`);
    if (tw >= b) errors.push(`Angle: thickness (${tw}) must be < leg 2 (${b}).`);
  }
  if (type === 'DOUBLE-ANGLE' || type === '2L') {
    const b = config.b || bf; // leg 2
    if (tw >= d) errors.push(`Double Angle: thickness (${tw}) must be < leg 1 (${d}).`);
    if (tw >= b) errors.push(`Double Angle: thickness (${tw}) must be < leg 2 (${b}).`);
  }

  return errors;
}

// ─── I-Section / Plate Girder ─────────────────────────────────────────────────

function computeISection(config) {
  const { d, bf, tw, tf } = config;
  const type  = config.type || 'I-SECTION';
  const label = config.designation || `BU-${type}-d${d}x${bf}`;

  const hw = d - 2 * tf; // clear web height (mm)

  // Area
  const A = 2 * bf * tf + hw * tw;

  // Ix — component method (parallel-axis)
  const yf = hw / 2 + tf / 2; // flange centroid distance from section centroid
  const Ix  = 2 * (bf * Math.pow(tf, 3) / 12 + bf * tf * yf * yf) +
              tw * Math.pow(hw, 3) / 12;

  // Iy
  const Iy  = 2 * (tf * Math.pow(bf, 3) / 12) +
              hw * Math.pow(tw, 3) / 12;

  // Elastic moduli
  const Sx = Ix / (d / 2);
  const Sy = Iy / (bf / 2);

  // Plastic moduli
  const Zx = bf * tf * (hw / 2 + tf / 2) + tw * Math.pow(hw, 2) / 4;
  const Zy  = tf * Math.pow(bf, 2) / 4 + hw * Math.pow(tw, 2) / 4;

  // Radii of gyration
  const rx = Math.sqrt(Ix / A);
  const ry = Math.sqrt(Iy / A);

  // St. Venant torsional constant
  const J = (2 * bf * Math.pow(tf, 3) + hw * Math.pow(tw, 3)) / 3;

  // Warping constant (doubly-symmetric I)
  const ho  = d - tf;
  const Cw  = (Iy / 4) * Math.pow(ho, 2);

  // Lateral-torsional buckling helper
  const rts = Math.sqrt(Math.sqrt(Iy * Cw) / Sx);

  // Slenderness ratios
  const bf_2tf = bf / (2 * tf);
  const h_tw   = hw / tw;

  // Weight
  const weight = A * STEEL_DENSITY / 1e6;

  return {
    designation: label,
    type: 'BUILT-UP',
    builtUpType: type,
    source: 'User-Defined Built-Up',
    isBuiltUp: true,
    d, bf, tw, tf, hw,
    area:   round(A, 0),
    weight: round(weight, 2),
    Ix:     round(Ix / 1e6, 4),
    Iy:     round(Iy / 1e6, 4),
    Sx:     round(Sx / 1e3, 2),
    Sy:     round(Sy / 1e3, 2),
    Zx:     round(Zx / 1e3, 2),
    Zy:     round(Zy / 1e3, 2),
    rx:     round(rx, 1),
    ry:     round(ry, 1),
    J:      round(J / 1e3, 4),
    Cw:     round(Cw / 1e9, 6),
    ho:     round(ho, 1),
    rts:    round(rts, 1),
    bf_2tf: round(bf_2tf, 2),
    h_tw:   round(h_tw, 2),
  };
}

// ─── Box Section ──────────────────────────────────────────────────────────────

function computeBoxSection(config) {
  const { d, bf, tw, tf } = config;
  const label = config.designation || `BU-BOX-d${d}x${bf}`;

  const hw = d  - 2 * tf;
  const bw = bf - 2 * tw;

  // Area: outer minus inner
  const A = bf * d - bw * hw;

  // Ix / Iy: hollow box
  const Ix = (bf * Math.pow(d, 3) / 12) - (bw * Math.pow(hw, 3) / 12);
  const Iy = (d  * Math.pow(bf, 3) / 12) - (hw * Math.pow(bw, 3) / 12);

  const Sx = Ix / (d / 2);
  const Sy = Iy / (bf / 2);

  // Plastic moduli (outer minus inner)
  const Zx = (bf * d * d / 4) - (bw * hw * hw / 4);
  const Zy  = (d  * bf * bf / 4) - (hw * bw * bw / 4);

  const rx = Math.sqrt(Ix / A);
  const ry = Math.sqrt(Iy / A);

  // Torsional constant (Bredt's formula for closed section)
  const Am  = (bf - tw) * (d - tf);
  const psi = 2 * ((bf - tw) / tf + (d - tf) / tw);
  const J   = (4 * Am * Am) / psi;

  const weight = A * STEEL_DENSITY / 1e6;
  const bf_2tf = bf / (2 * tf);
  const h_tw   = hw / tw;

  return {
    designation: label,
    type: 'BUILT-UP',
    builtUpType: 'BOX',
    source: 'User-Defined Built-Up',
    isBuiltUp: true,
    d, bf, tw, tf, hw,
    area:   round(A, 0),
    weight: round(weight, 2),
    Ix:     round(Ix / 1e6, 4),
    Iy:     round(Iy / 1e6, 4),
    Sx:     round(Sx / 1e3, 2),
    Sy:     round(Sy / 1e3, 2),
    Zx:     round(Zx / 1e3, 2),
    Zy:     round(Zy / 1e3, 2),
    rx:     round(rx, 1),
    ry:     round(ry, 1),
    J:      round(J / 1e3, 4),
    Cw:     null,
    bf_2tf: round(bf_2tf, 2),
    h_tw:   round(h_tw, 2),
  };
}

// ─── Built-Up Channel ─────────────────────────────────────────────────────────

function computeChannelSection(config) {
  const { d, bf, tw, tf } = config;
  const label = config.designation || `BU-CHAN-d${d}x${bf}`;

  const hw = d - 2 * tf;
  const A_web = tw * d;
  const A_fl  = 2 * (bf - tw) * tf;
  const A = A_web + A_fl;

  // x-centroid from web back face
  const xWeb = tw / 2;
  const xFl  = tw + (bf - tw) / 2;
  const x_bar = (A_web * xWeb + A_fl * xFl) / A;

  // Ix (about horizontal centroidal axis, symmetric top-bottom)
  const Ix_web = tw * Math.pow(d, 3) / 12;
  const Ix_fl  = 2 * ((bf - tw) * Math.pow(tf, 3) / 12 +
                        (bf - tw) * tf * Math.pow(d / 2 - tf / 2, 2));
  const Ix = Ix_web + Ix_fl;

  // Iy (about vertical centroidal axis, with centroid shift)
  const Iy_web = d * Math.pow(tw, 3) / 12 + A_web * Math.pow(xWeb - x_bar, 2);
  const Iy_fl  = 2 * (tf * Math.pow(bf - tw, 3) / 12 +
                        (bf - tw) * tf * Math.pow(xFl - x_bar, 2));
  const Iy = Iy_web + Iy_fl;

  const Sx = Ix / (d / 2);
  // Sy: governing (smaller of two extreme fibre values)
  const Sy = Iy / Math.max(x_bar, bf - x_bar);

  // Plastic moduli (approximate for channel)
  const Zx = tw * Math.pow(d, 2) / 4 + 2 * (bf - tw) * tf * (d / 2 - tf / 2);
  const Zy  = d * Math.pow(tw, 2) / 4 + 2 * tf * Math.pow(bf - tw, 2) / 4;

  const rx = Math.sqrt(Ix / A);
  const ry = Math.sqrt(Iy / A);

  // St. Venant J
  const J = (d * Math.pow(tw, 3) + 2 * (bf - tw) * Math.pow(tf, 3)) / 3;

  const weight = A * STEEL_DENSITY / 1e6;
  const bf_2tf = bf / (2 * tf);
  const h_tw   = hw / tw;

  return {
    designation: label,
    type: 'BUILT-UP',
    builtUpType: 'BU-CHANNEL',
    source: 'User-Defined Built-Up',
    isBuiltUp: true,
    d, bf, tw, tf, hw,
    x: round(x_bar, 1),
    area:   round(A, 0),
    weight: round(weight, 2),
    Ix:     round(Ix / 1e6, 4),
    Iy:     round(Iy / 1e6, 4),
    Sx:     round(Sx / 1e3, 2),
    Sy:     round(Sy / 1e3, 2),
    Zx:     round(Zx / 1e3, 2),
    Zy:     round(Zy / 1e3, 2),
    rx:     round(rx, 1),
    ry:     round(ry, 1),
    J:      round(J / 1e3, 4),
    Cw:     null,
    bf_2tf: round(bf_2tf, 2),
    h_tw:   round(h_tw, 2),
  };
}

// ─── Custom Tee ───────────────────────────────────────────────────────────────

function computeTeeSection(config) {
  const { d, bf, tw, tf } = config;
  const label = config.designation || `BU-TEE-d${d}x${bf}`;
  const hw = d - tf; // stem height

  const Af = bf * tf;
  const Aw = hw * tw;
  const A = Af + Aw;

  // centroid from top flange outer face
  const yf = tf / 2;
  const yw = tf + hw / 2;
  const y_bar = (Af * yf + Aw * yw) / A;

  // Ix
  const Ixf = (bf * Math.pow(tf, 3)) / 12 + Af * Math.pow(y_bar - yf, 2);
  const Ixw = (tw * Math.pow(hw, 3)) / 12 + Aw * Math.pow(y_bar - yw, 2);
  const Ix = Ixf + Ixw;

  // Iy (symmetric)
  const Iy = (tf * Math.pow(bf, 3)) / 12 + (hw * Math.pow(tw, 3)) / 12;

  const yTop = y_bar;
  const yBot = d - y_bar;

  const Sx = Ix / Math.max(yTop, yBot); // Min Sx
  const Sy = Iy / (bf / 2);

  const rx = Math.sqrt(Ix / A);
  const ry = Math.sqrt(Iy / A);

  // Plastic moduli
  let Zx = 0;
  if (Af >= A/2) {
    // Plastic neutral axis is in the flange
    const yp = A / (2 * bf);
    Zx = bf * yp * (yp / 2) + bf * (tf - yp) * ((tf - yp) / 2) + tw * hw * (hw / 2 + tf - yp);
  } else {
    // PNA in stem
    const yp = (A / 2 - Af) / tw;
    Zx = Af * (yp + tf / 2) + tw * yp * (yp / 2) + tw * (hw - yp) * ((hw - yp) / 2);
  }
  const Zy = tf * Math.pow(bf, 2) / 4 + hw * Math.pow(tw, 2) / 4;

  const J = (bf * Math.pow(tf, 3) + hw * Math.pow(tw, 3)) / 3;

  const weight = A * STEEL_DENSITY / 1e6;

  return {
    designation: label,
    type: 'BUILT-UP',
    builtUpType: 'BU-TEE',
    source: 'User-Defined Built-Up',
    isBuiltUp: true,
    d, bf, tw, tf,
    y: round(yBot, 1),
    area:   round(A, 0),
    weight: round(weight, 2),
    Ix:     round(Ix / 1e6, 4),
    Iy:     round(Iy / 1e6, 4),
    Sx:     round(Sx / 1e3, 2),
    Sy:     round(Sy / 1e3, 2),
    Zx:     round(Zx / 1e3, 2),
    Zy:     round(Zy / 1e3, 2),
    rx:     round(rx, 1),
    ry:     round(ry, 1),
    J:      round(J / 1e3, 4),
    Cw:     null,
    ro:     null,
    H:      null
  };
}

// ─── Custom Single Angle ───────────────────────────────────────────────────────

function computeSingleAngle(config) {
  const d = config.d; // leg 1
  const b = config.b || config.bf; // leg 2
  const t = config.tw || config.t; // thickness
  const label = config.designation || `BU-L-${d}x${b}x${t}`;

  const A1 = d * t;
  const A2 = (b - t) * t;
  const A = A1 + A2;

  // centroids from outer corner
  const x1 = t / 2;
  const y1 = d / 2;
  const x2 = t + (b - t) / 2;
  const y2 = t / 2;

  const x_bar = (A1 * x1 + A2 * x2) / A;
  const y_bar = (A1 * y1 + A2 * y2) / A;

  const Ix1 = t * Math.pow(d, 3) / 12 + A1 * Math.pow(y1 - y_bar, 2);
  const Ix2 = (b - t) * Math.pow(t, 3) / 12 + A2 * Math.pow(y2 - y_bar, 2);
  const Ix = Ix1 + Ix2;

  const Iy1 = d * Math.pow(t, 3) / 12 + A1 * Math.pow(x1 - x_bar, 2);
  const Iy2 = t * Math.pow(b - t, 3) / 12 + A2 * Math.pow(x2 - x_bar, 2);
  const Iy = Iy1 + Iy2;

  const Ixy1 = A1 * (x1 - x_bar) * (y1 - y_bar);
  const Ixy2 = A2 * (x2 - x_bar) * (y2 - y_bar);
  const Ixy = Ixy1 + Ixy2;

  const angle = Math.atan2(-2 * Ixy, Ix - Iy) / 2;
  const Imax = (Ix + Iy) / 2 + Math.sqrt(Math.pow((Ix - Iy) / 2, 2) + Math.pow(Ixy, 2));
  const Imin = (Ix + Iy) / 2 - Math.sqrt(Math.pow((Ix - Iy) / 2, 2) + Math.pow(Ixy, 2));
  
  // Principal axes Z and W
  const Iz = Imax;
  const Iw = Imin;
  const rz = Math.sqrt(Iz / A);
  const rw = Math.sqrt(Iw / A);

  const rx = Math.sqrt(Ix / A);
  const ry = Math.sqrt(Iy / A);

  const Sx = Ix / Math.max(y_bar, d - y_bar);
  const Sy = Iy / Math.max(x_bar, b - x_bar);

  // Approximate Zx and Zy
  const Zx = (d * t) * (d / 4) + (b - t) * t * (t / 4); // simplistic
  const Zy = (b * t) * (b / 4) + (d - t) * t * (t / 4);

  const J = ((d + b - t) * Math.pow(t, 3)) / 3;
  const weight = A * STEEL_DENSITY / 1e6;

  return {
    designation: label,
    type: 'BUILT-UP',
    builtUpType: 'SINGLE-ANGLE',
    source: 'User-Defined Built-Up',
    isBuiltUp: true,
    d, b, t,
    x: round(x_bar, 1),
    y: round(y_bar, 1),
    area:   round(A, 0),
    weight: round(weight, 2),
    Ix:     round(Ix / 1e6, 4),
    Iy:     round(Iy / 1e6, 4),
    Iz:     round(Iz / 1e6, 4),
    Iw:     round(Iw / 1e6, 4),
    Sx:     round(Sx / 1e3, 2),
    Sy:     round(Sy / 1e3, 2),
    Zx:     round(Zx / 1e3, 2),
    Zy:     round(Zy / 1e3, 2),
    rx:     round(rx, 1),
    ry:     round(ry, 1),
    rz:     round(rz, 1),
    rw:     round(rw, 1),
    J:      round(J / 1e3, 4),
    Cw:     null,
    ro:     null,
    H:      null
  };
}

// ─── Custom Double Angle ───────────────────────────────────────────────────────

function computeDoubleAngle(config) {
  const d = config.d; // leg 1 (vertical)
  const b = config.b || config.bf; // leg 2 (horizontal outstand)
  const t = config.tw || config.t; // thickness
  const gap = config.gap || config.s || 10; // gap between back-to-back angles
  const label = config.designation || `BU-2L-${d}x${b}x${t}-Gap${gap}`;

  const singleAngle = computeSingleAngle({d, b, t});
  
  const A = 2 * singleAngle.area;
  const weight = 2 * singleAngle.weight;
  
  // y-axis is horizontal. x-axis is vertical (vertical symmetry)
  // Distance from back of angle to y-axis is gap / 2
  const x_bar = 0; // Symmetric
  const y_bar = singleAngle.y;

  // Moment of inertia about horizontal axis (x-x)
  const Ix = 2 * (singleAngle.Ix * 1e6); // single Ix is exported in 1e6 mm^4

  // Moment of inertia about vertical axis (y-y)
  const Iy_single = singleAngle.Iy * 1e6;
  const d_shift = singleAngle.x + (gap / 2);
  const Iy = 2 * (Iy_single + singleAngle.area * Math.pow(d_shift, 2));

  const rx = Math.sqrt(Ix / A);
  const ry = Math.sqrt(Iy / A);

  const Sx = Ix / Math.max(y_bar, d - y_bar);
  const Sy = Iy / (b + gap / 2);

  const Zx = 2 * (singleAngle.Zx * 1e3);
  const Zy = 2 * (singleAngle.Zy * 1e3 + singleAngle.area * d_shift);

  const dPrime = d - 0.5 * t;
  const bPrime = b - 0.5 * t;
  const J = 2 * (dPrime + bPrime) * Math.pow(t, 3) / 3;

  return {
    designation: label,
    type: 'BUILT-UP',
    builtUpType: 'DOUBLE-ANGLE',
    source: 'User-Defined Built-Up',
    isBuiltUp: true,
    d, b, t, gap,
    y: round(y_bar, 1),
    area:   round(A, 0),
    weight: round(weight, 2),
    Ix:     round(Ix / 1e6, 4),
    Iy:     round(Iy / 1e6, 4),
    Sx:     round(Sx / 1e3, 2),
    Sy:     round(Sy / 1e3, 2),
    Zx:     round(Zx / 1e3, 2),
    Zy:     round(Zy / 1e3, 2),
    rx:     round(rx, 1),
    ry:     round(ry, 1),
    J:      round(J / 1e3, 4),
    Cw:     null,
    ro:     null,
    H:      null
  };
}

// ─── Helper ───────────────────────────────────────────────────────────────────

function round(v, dec) {
  if (v === null || v === undefined || !isFinite(v)) return null;
  const f = Math.pow(10, dec);
  return Math.round(v * f) / f;
}
