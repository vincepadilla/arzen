/**
 * seismic.js
 * Seismic provisions checks per AISC 341-16 (ANSI/AISC 341-16) and standard Compactness (AISC 360-16 B4)
 *
 * Checks performed:
 *  1. Section compactness (COMPACT, NON-COMPACT, SLENDER) per section type
 *  2. Actual ductility classification (HIGHLY DUCTILE, MODERATELY DUCTILE, NOT DUCTILE)
 */

function fmt(n, d = 2) { return (typeof n === 'number' && isFinite(n)) ? n.toFixed(d) : String(n); }

// ─── PART 6: COMPACTNESS BY SECTION TYPE ─────────────────────────────────────

function classify(lambda, lambdaP, lambdaR) {
  if (lambdaP && lambda <= lambdaP) return 'COMPACT';
  if (lambdaR && lambda <= lambdaR) return 'NON-COMPACT';
  return 'SLENDER';
}

function classifyAxial(lambda, lambdaR) {
  if (lambda <= lambdaR) return 'NON-SLENDER';
  return 'SLENDER';
}

function checkWCompactness(state) {
  const { fy, E } = state.material;
  const bf_2tf = state.section.bf_2tf;
  const h_tw = state.section.h_tw;
  const sqrtEFy = Math.sqrt(E / fy);
  
  const results = [];
  
  if (bf_2tf != null) {
    const ax_lam_r = 0.56 * sqrtEFy;
    const fl_lam_p = 0.38 * sqrtEFy;
    const fl_lam_r = 1.00 * sqrtEFy;
    
    results.push({
      limitState: "Flange Compactness",
      element: 'Flange',
      lambda: bf_2tf,
      axial: { lambdaR: ax_lam_r, classification: classifyAxial(bf_2tf, ax_lam_r) },
      flexural: { lambdaP: fl_lam_p, lambdaR: fl_lam_r, classification: classify(bf_2tf, fl_lam_p, fl_lam_r) }
    });
  }
  
  if (h_tw != null) {
    const ax_lam_r = 1.49 * sqrtEFy;
    const fl_lam_p = 3.76 * sqrtEFy;
    const fl_lam_r = 5.70 * sqrtEFy;
    
    results.push({
      limitState: "Web Compactness",
      element: 'Web',
      lambda: h_tw,
      axial: { lambdaR: ax_lam_r, classification: classifyAxial(h_tw, ax_lam_r) },
      flexural: { lambdaP: fl_lam_p, lambdaR: fl_lam_r, classification: classify(h_tw, fl_lam_p, fl_lam_r) }
    });
  }
  
  return results;
}

function checkHSSCompactness(state) {
  const { fy, E } = state.material;
  const sqrtEFy = Math.sqrt(E / fy);
  
  const results = [];
  const b_t = state.section.b_tdes || state.section.b_t || state.section.bf_2tf * 2; 
  const h_t = state.section.h_tdes || state.section.h_t || state.section.h_tw;
  
  if (b_t != null) {
     const p = 1.12 * sqrtEFy;
     const r = 1.40 * sqrtEFy;
     results.push({
       limitState: "Flange/Wall Compactness (Major-Axis Flange / Minor-Axis Web)",
       element: 'Flange/Wall',
       lambda: b_t,
       axial: { lambdaR: null, classification: 'N/A' },
       flexural: { lambdaP: p, lambdaR: r, classification: classify(b_t, p, r) }
     });
  }
  if (h_t != null) {
     const p = 2.42 * sqrtEFy;
     const r = 5.70 * sqrtEFy;
     results.push({
       limitState: "Web/Wall Compactness (Major-Axis Web / Minor-Axis Flange)",
       element: 'Web/Wall',
       lambda: h_t,
       axial: { lambdaR: null, classification: 'N/A' },
       flexural: { lambdaP: p, lambdaR: r, classification: classify(h_t, p, r) }
     });
  }
  return results;
}

function checkTeeCompactness(state) {
  const { fy, E } = state.material;
  const sqrtEFy = Math.sqrt(E / fy);
  
  const results = [];
  if (state.section.bf_2tf != null) {
     const ax_lam_r = 0.56 * sqrtEFy;
     const fl_lam_p = 0.38 * sqrtEFy;
     const fl_lam_r = 1.00 * sqrtEFy;
     results.push({
       limitState: "Flange Compactness",
       element: 'Flange',
       lambda: state.section.bf_2tf,
       axial: { lambdaR: ax_lam_r, classification: classifyAxial(state.section.bf_2tf, ax_lam_r) },
       flexural: { lambdaP: fl_lam_p, lambdaR: fl_lam_r, classification: classify(state.section.bf_2tf, fl_lam_p, fl_lam_r) }
     });
  }
  if (state.section.d_tw != null || state.section.h_tw != null) {
     const lambda = state.section.d_tw || state.section.h_tw;
     const ax_lam_r = 0.75 * sqrtEFy;
     const fl_lam_p = 0.84 * sqrtEFy;
     const fl_lam_r = 1.52 * sqrtEFy;
     results.push({
       limitState: "Stem Compactness",
       element: 'Stem',
       lambda: lambda,
       axial: { lambdaR: ax_lam_r, classification: classifyAxial(lambda, ax_lam_r) },
       flexural: { lambdaP: fl_lam_p, lambdaR: fl_lam_r, classification: classify(lambda, fl_lam_p, fl_lam_r) }
     });
  }
  return results;
}

function checkAngleCompactness(state) {
  const { fy, E } = state.material;
  const b_t = state.section.b_t; 
  const sqrtEFy = Math.sqrt(E / fy);
  
  const results = [];
  if (b_t != null) {
    const ax_lam_r = 0.45 * sqrtEFy;
    const fl_lam_p = 0.54 * sqrtEFy;
    const fl_lam_r = 0.91 * sqrtEFy;
    
    results.push({
      limitState: "Leg Compactness",
      element: 'Leg',
      lambda: b_t,
      axial: { lambdaR: ax_lam_r, classification: classifyAxial(b_t, ax_lam_r) },
      flexural: { lambdaP: fl_lam_p, lambdaR: fl_lam_r, classification: classify(b_t, fl_lam_p, fl_lam_r) }
    });
  }
  return results;
}

// ─── PART 7: ACTUAL DUCTILITY CLASSIFICATION ──────────────────────────────────

function classifyDuctility(lambda, lambdaHD, lambdaMD) {
  if (lambdaHD && lambda <= lambdaHD) return 'HIGHLY DUCTILE';
  if (lambdaMD && lambda <= lambdaMD) return 'MODERATELY DUCTILE';
  return 'NOT DUCTILE';
}

function checkWDuctility(state) {
  const { fy, E } = state.material;
  const bf_2tf = state.section.bf_2tf;
  const h_tw = state.section.h_tw;
  const sqrtEFy = Math.sqrt(E / fy);
  
  const results = [];
  
  // Flange
  if (bf_2tf != null) {
      results.push({
          element: 'Flange',
          lambda: bf_2tf,
          lambdaHD: 0.30 * sqrtEFy,
          lambdaMD: 0.38 * sqrtEFy,
          classification: classifyDuctility(bf_2tf, 0.30 * sqrtEFy, 0.38 * sqrtEFy)
      });
  }
  
  // Web
  if (h_tw != null) {
      const isLRFD = state.designMethod === 'lrfd';
      let pcN = 0;
      if (state.loadPc > 0) {
          pcN = state.loadPc * 1000;
      }
      const ag = state.section.area;
      const Ca = isLRFD ? (pcN / (0.90 * ag * fy)) : ((1.67 * pcN) / (ag * fy));
      
      let lambda_HD;
      if (Ca <= 0.125) {
          lambda_HD = 2.45 * sqrtEFy * (1 - 0.93 * Ca);
      } else {
          lambda_HD = Math.max(0.77 * sqrtEFy * (2.93 - Ca), 1.49 * sqrtEFy);
      }
      
      let lambda_MD;
      if (Ca <= 0.125) {
          lambda_MD = 3.76 * sqrtEFy * (1 - 2.75 * Ca);
      } else {
          lambda_MD = Math.max(1.12 * sqrtEFy * (2.33 - Ca), 1.49 * sqrtEFy);
      }
      
      results.push({
          element: 'Web',
          lambda: h_tw,
          Ca: Ca,
          lambdaHD: lambda_HD,
          lambdaMD: lambda_MD,
          classification: classifyDuctility(h_tw, lambda_HD, lambda_MD)
      });
  }
  return results;
}

function checkHSSDuctility(state) {
  const { fy, E } = state.material;
  const sqrtEFy = Math.sqrt(E / fy);
  const results = [];
  const b_t = state.section.b_tdes || state.section.b_t || state.section.bf_2tf * 2;
  if (b_t != null) {
     const lambdaHD = 0.55 * sqrtEFy;
     const lambdaMD = 0.64 * sqrtEFy;
     results.push({
         element: 'Flange/Wall',
         lambda: b_t,
         lambdaHD: lambdaHD,
         lambdaMD: lambdaMD,
         classification: classifyDuctility(b_t, lambdaHD, lambdaMD)
     });
  }
  return results;
}

function checkAngleDuctility(state) {
  const { fy, E } = state.material;
  const b_t = state.section.b_t; 
  const sqrtEFy = Math.sqrt(E / fy);
  
  const results = [];
  if (b_t != null) {
      const lambda_HD = 0.30 * sqrtEFy;
      const lambda_MD = 0.38 * sqrtEFy;
      results.push({
          element: 'Leg',
          lambda: b_t,
          lambdaHD: lambda_HD,
          lambdaMD: lambda_MD,
          classification: classifyDuctility(b_t, lambda_HD, lambda_MD)
      });
  }
  return results;
}


// ─── MAIN EXPORT ──────────────────────────────────────────────────────────────

export function checkCompactness(state) {
  const type = state.section.type;
  if (['W', 'M', 'S', 'HP'].includes(type) || state.section.builtUpType === 'I-SECTION' || state.section.builtUpType === 'PLATE-GIRDER') {
      return checkWCompactness(state);
  } else if (['HSS Square', 'HSS Rectangular', 'HSS Round', 'Pipe'].includes(type) || state.section.builtUpType === 'BOX') {
      return checkHSSCompactness(state);
  } else if (['WT', 'MT', 'ST'].includes(type)) {
      return checkTeeCompactness(state);
  } else if (['L', 'DOUBLE_ANGLE', 'Double Angle'].includes(type)) {
      return checkAngleCompactness(state);
  }
  return [];
}

export function checkDuctility(state) {
  const type = state.section.type;
  if (['W', 'M', 'S', 'HP'].includes(type) || state.section.builtUpType === 'I-SECTION' || state.section.builtUpType === 'PLATE-GIRDER') {
      return checkWDuctility(state);
  } else if (['HSS Square', 'HSS Rectangular', 'HSS Round', 'Pipe'].includes(type) || state.section.builtUpType === 'BOX') {
      return checkHSSDuctility(state);
  } else if (['L', 'DOUBLE_ANGLE', 'Double Angle'].includes(type)) {
      return checkAngleDuctility(state);
  }
  return [];
}

export function checkSeismic(state) {
  // Legacy function format, but returns nested objects now.
  const compactnessResults = checkCompactness(state);
  const ductilityResults = checkDuctility(state);
  
  return { 
      compactness: compactnessResults, 
      ductility: ductilityResults,
      seismicNote: "Compactness and Ductility calculated based on section actual geometry."
  };
}
