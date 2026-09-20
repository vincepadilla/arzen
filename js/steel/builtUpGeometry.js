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
      return computeISection(config);
    case 'BOX':
      return computeBoxSection(config);
    case 'BU-CHANNEL':
      return computeChannelSection(config);
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
  if (type === 'BOX') {
    if (2 * tw >= bf) errors.push(`Box: 2·tw (${2 * tw}) must be < bf (${bf}).`);
    if (2 * tf >= d)  errors.push(`Box: 2·tf (${2 * tf}) must be < d (${d}).`);
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

// ─── Helper ───────────────────────────────────────────────────────────────────

function round(v, dec) {
  if (v === null || v === undefined || !isFinite(v)) return null;
  const f = Math.pow(10, dec);
  return Math.round(v * f) / f;
}
