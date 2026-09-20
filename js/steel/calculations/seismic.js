/**
 * seismic.js
 * Seismic provisions checks per AISC 341-16 (ANSI/AISC 341-16)
 * Referenced by NSCP 2015 Volume 1 Section 5 for seismic design of steel structures.
 *
 * Checks performed when seismic design is enabled:
 *  1.  Section compactness (Web & Flange λ vs λhd / λmd limits)
 *
 * Returns an array of calcObj conforming to the resultRenderer schema.
 */

// ─── Limits per AISC 341-16 Table D1.1 ───────────────────────────────────────

/**
 * Highly-Ductile (hd) and Moderately-Ductile (md) width-to-thickness limits.
 * Returns { lambda_hd_flange, lambda_md_flange, lambda_hd_web, lambda_md_web }
 */
function getCompactnessLimits(fy, E) {
  const sqrtEFy = Math.sqrt(E / fy);
  return {
    // Flange (bf / 2tf)
    lambda_hd_flange: 0.30 * sqrtEFy,
    lambda_md_flange: 0.38 * sqrtEFy,
    // Web in combined flexure-axial compression (Ca = 0 assumed for pure flexure)
    lambda_hd_web:    2.45 * sqrtEFy,
    lambda_md_web:    3.76 * sqrtEFy,
    // Web for columns under compression (conservative - use flexure limits)
    lambda_hd_web_col: 1.57 * sqrtEFy,
    lambda_md_web_col: 3.76 * sqrtEFy,
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function codeRef(system, section) {
  const std = system === 'smrf'  ? 'AISC 341-16 (SMF)'  :
              system === 'imrf'  ? 'AISC 341-16 (IMF)'  :
              system === 'omrf'  ? 'AISC 341-16 (OMF)'  : 'AISC 341-16';
  return { standard: std, chapter: 'D', section };
}

function fmt(n, d = 2) { return (typeof n === 'number' && isFinite(n)) ? n.toFixed(d) : String(n); }

// ─── 1. Flange Compactness ────────────────────────────────────────────────────

function checkFlangeCompactness(state, limits, compReq, system) {
  const { fy, E } = state.material;
  const bf_2tf = state.section.bf_2tf;

  const limitLabel = compReq === 'highly-ductile' ? 'λhd' : 'λmd';
  const limitVal   = compReq === 'highly-ductile' ? limits.lambda_hd_flange : limits.lambda_md_flange;
  const ratio      = bf_2tf / limitVal;
  const status     = ratio <= 1.0 ? 'COMPACT' : 'NON-COMPACT';

  return {
    limitState: `Flange Compactness — ${limitLabel} (AISC 341-16)`,
    codeReference: codeRef(system, 'D1.1'),
    formula: `\\( \\frac{b_f}{2t_f} \\le \\lambda_{${compReq === 'highly-ductile' ? 'hd' : 'md'}} = ${compReq === 'highly-ductile' ? '0.30' : '0.38'} \\sqrt{\\frac{E}{F_y}} \\)`,
    variables: {
      bf_2tf:    { symbol: '\\( b_f / 2t_f \\)',  value: fmt(bf_2tf, 2), unit: '' },
      LimitVal:  { symbol: `\\( \\lambda_{${limitLabel}} \\)`, value: fmt(limitVal, 2), unit: '' },
      E:         { symbol: '\\( E \\)',            value: E,              unit: 'MPa' },
      Fy:        { symbol: '\\( F_y \\)',          value: fy,             unit: 'MPa' },
    },
    substitution: `\\( ${fmt(bf_2tf, 2)} \\le ${fmt(limitVal, 2)} \\)`,
    calculation:  `bf/(2tf) = ${fmt(bf_2tf, 2)},  ${limitLabel} = ${fmt(limitVal, 2)}`,
    result:       { value: fmt(ratio, 3), unit: '' },
    resistanceFactor: { symbol: '', value: null },
    designStrength: {
      formula: `Limit ${limitLabel}`,
      substitution: fmt(limitVal, 2),
      value: Number(fmt(limitVal, 2)),
      unit: ''
    },
    demand:  { value: fmt(bf_2tf, 2), unit: '' },
    ratio:   null,
    status,
    steps: [
      {
        step: 1,
        title: 'Flange Slenderness Ratio',
        formula: 'λf = bf / (2·tf)',
        substitution: `bf/(2tf) from section properties`,
        result: fmt(bf_2tf, 2),
        unit: '',
      },
      {
        step: 2,
        title: `Seismic Compactness Limit (${limitLabel})`,
        formula: compReq === 'highly-ductile'
          ? 'λhd = 0.30 × √(E/Fy)'
          : 'λmd = 0.38 × √(E/Fy)',
        substitution: compReq === 'highly-ductile'
          ? `0.30 × √(${E}/${fy})`
          : `0.38 × √(${E}/${fy})`,
        result: fmt(limitVal, 2),
        unit: '',
      },
      {
        step: 3,
        title: 'Flange Compactness Check',
        formula: `λf ≤ ${limitLabel}?`,
        substitution: `${fmt(bf_2tf, 2)} ≤ ${fmt(limitVal, 2)}?`,
        result: `${fmt(bf_2tf, 2)} ${ratio <= 1.0 ? '≤' : '>'} ${fmt(limitVal, 2)}  →  ${status}`,
        unit: '',
      },
    ],
  };
}

// ─── 2. Web Compactness ───────────────────────────────────────────────────────

function checkWebCompactness(state, limits, compReq, system) {
  const { fy, E } = state.material;
  const h_tw     = state.section.h_tw;
  const memberType = state.memberType;

  // Use column web limit for columns under axial load, otherwise beam limit
  const isColumn = (memberType === 'column' || memberType === 'compression' || memberType === 'beam-column');

  const limitLabel = compReq === 'highly-ductile' ? 'λhd' : 'λmd';
  const limitVal   = compReq === 'highly-ductile'
    ? (isColumn ? limits.lambda_hd_web_col : limits.lambda_hd_web)
    : limits.lambda_md_web;

  const limitFormula = compReq === 'highly-ductile'
    ? (isColumn ? '\\( 1.57\\sqrt{E/F_y} \\)' : '\\( 2.45\\sqrt{E/F_y} \\)')
    : '\\( 3.76\\sqrt{E/F_y} \\)';

  const multiplier = compReq === 'highly-ductile'
    ? (isColumn ? 1.57 : 2.45)
    : 3.76;

  const ratio  = h_tw / limitVal;
  const status = ratio <= 1.0 ? 'COMPACT' : 'NON-COMPACT';

  return {
    limitState: `Web Compactness — ${limitLabel} (AISC 341-16)`,
    codeReference: codeRef(system, 'D1.1'),
    formula: `\\( \\frac{h}{t_w} \\le \\lambda_{${compReq === 'highly-ductile' ? 'hd' : 'md'}} = ${multiplier}\\sqrt{\\frac{E}{F_y}} \\)`,
    variables: {
      h_tw:      { symbol: '\\( h/t_w \\)',        value: fmt(h_tw, 2),    unit: '' },
      LimitVal:  { symbol: `\\( \\lambda_{${limitLabel}} \\)`, value: fmt(limitVal, 2), unit: '' },
      E:         { symbol: '\\( E \\)',             value: E,               unit: 'MPa' },
      Fy:        { symbol: '\\( F_y \\)',           value: fy,              unit: 'MPa' },
    },
    substitution: `\\( ${fmt(h_tw, 2)} \\le ${fmt(limitVal, 2)} \\)`,
    calculation:  `h/tw = ${fmt(h_tw, 2)},  ${limitLabel} = ${fmt(limitVal, 2)}`,
    result:       { value: fmt(ratio, 3), unit: '' },
    resistanceFactor: { symbol: '', value: null },
    designStrength: {
      formula: `Limit ${limitLabel}`,
      substitution: fmt(limitVal, 2),
      value: Number(fmt(limitVal, 2)),
      unit: ''
    },
    demand:  { value: fmt(h_tw, 2), unit: '' },
    ratio:   null,
    status,
    steps: [
      {
        step: 1,
        title: 'Web Slenderness Ratio',
        formula: 'λw = h / tw',
        substitution: `h/tw from section properties`,
        result: fmt(h_tw, 2),
        unit: '',
      },
      {
        step: 2,
        title: `Seismic Compactness Limit (${limitLabel})`,
        formula: `${limitLabel} = ${multiplier} × √(E/Fy)  [${isColumn ? 'Column' : 'Beam'} Web]`,
        substitution: `${multiplier} × √(${E}/${fy})`,
        result: fmt(limitVal, 2),
        unit: '',
      },
      {
        step: 3,
        title: 'Web Compactness Check',
        formula: `λw ≤ ${limitLabel}?`,
        substitution: `${fmt(h_tw, 2)} ≤ ${fmt(limitVal, 2)}?`,
        result: `${fmt(h_tw, 2)} ${ratio <= 1.0 ? '≤' : '>'} ${fmt(limitVal, 2)}  →  ${status}`,
        unit: '',
      },
    ],
  };
}

// ─── Main Export ──────────────────────────────────────────────────────────────

/**
 * Run all applicable seismic checks.
 * @returns { results: calcObj[], seismicNote: string }
 */
export function checkSeismic(state) {
  if (!state.seismicEnabled || !state.seismicParams) {
    return { results: [], seismicNote: null };
  }

  const { fy, E }    = state.material;
  const { system, compactness } = state.seismicParams;
  const limits       = getCompactnessLimits(fy, E);

  const checks = [];

  // ── 1 & 2: Compactness (all member types) ─────────────────────────────────
  if (state.section.bf_2tf != null) {
    checks.push(checkFlangeCompactness(state, limits, compactness, system));
  }
  if (state.section.h_tw != null) {
    checks.push(checkWebCompactness(state, limits, compactness, system));
  }

  // ── System note ───────────────────────────────────────────────────────────
  const systemLabels = { smrf: 'Special Moment Frame', imrf: 'Intermediate Moment Frame', omrf: 'Ordinary Moment Frame' };
  const seismicNote = `Seismic provisions applied per AISC 341-16 for ${systemLabels[system] || system}. ` +
    `Compactness requirement: ${compactness === 'highly-ductile' ? 'Highly Ductile (HD)' : 'Moderately Ductile (MD)'}.`;

  return { results: checks, seismicNote };
}
