// Flexural capacity calculations (AISC 360 Chapter F)

function getFactor(state) {
  return state.designMethod === 'lrfd' ? 0.90 : 1.67;
}

// ─── MINOR AXIS FLEXURE ──────────────────────────────────────────────
export function checkMinorFlexure(state) {
  const fy = state.material.fy || 1;
  const E = state.material.E || 200000;
  const zy_mm3 = (state.section.Zy || 0) * 1000;
  const sy_mm3 = (state.section.Sy || 0) * 1000;
  const isLRFD = state.designMethod === 'lrfd';
  const factor = getFactor(state);
  const factorSymbol = isLRFD ? "\\phi_b" : "\\Omega_b";
  const muy = Math.abs(state.loadMuy || 0);
  
  const fyZy = fy * zy_mm3;
  const onePointSixFySy = 1.6 * fy * sy_mm3;
  let mpy = Math.min(fyZy, onePointSixFySy);
  
  const limitStates = {};
  
  // 1. Yielding
  limitStates.yielding = {
    limitState: "Minor-Axis Yielding",
    codeReference: { standard: "AISC 360", chapter: "F", section: "F6", limitState: "Yielding" },
    formula: "\\( M_{ny} = M_{py} = \\min(F_y Z_y, 1.6 F_y S_y) \\)",
    variables: { Fy: { symbol: "\\( F_y \\)", value: fy, unit: "MPa" }, Zy: { symbol: "\\( Z_y \\)", value: zy_mm3, unit: "mm³" }, Sy: { symbol: "\\( S_y \\)", value: sy_mm3, unit: "mm³" } },
    substitution: `\\( \\min(${fy} \\times ${zy_mm3}, 1.6 \\times ${fy} \\times ${sy_mm3}) \\)`,
    calculation: `Mny = ${(mpy / 1e6).toFixed(2)} kN-m`,
    result: { value: mpy / 1e6, unit: "kN-m" },
    resistanceFactor: { symbol: `\\( ${factorSymbol} \\)`, value: factor },
    designStrength: { formula: isLRFD ? "\\( \\phi_b M_{ny} \\)" : "\\( M_{ny} / \\Omega_b \\)", substitution: "", value: isLRFD ? (mpy / 1e6 * factor) : (mpy / 1e6 / factor), unit: "kN-m" },
    demand: { value: muy, unit: "kN-m" },
    ratio: { formula: isLRFD ? "\\( M_{uy} / \\phi_b M_{ny} \\)" : "\\( M_{ay} / (M_{ny} / \\Omega_b) \\)", substitution: "", value: muy / (isLRFD ? (mpy / 1e6 * factor) : (mpy / 1e6 / factor)) },
    status: (muy / (isLRFD ? (mpy / 1e6 * factor) : (mpy / 1e6 / factor))) <= 1.0 ? "PASS" : "FAIL",
    steps: []
  };
  
  // 2. Minor-Axis Local Buckling
  const type = state.section.type;
  if (['W', 'M', 'S', 'HP'].includes(type) || state.section.builtUpType === 'I-SECTION') {
      const lambda = state.section.bf_2tf;
      if (lambda != null) {
          const lambda_pf = 0.38 * Math.sqrt(E/fy);
          const lambda_rf = 1.00 * Math.sqrt(E/fy);
          
          let mnLocalBuckling = null;
          let fcr = null;
          let form = "";
          let sub = "";
          
          if (lambda > lambda_pf && lambda <= lambda_rf) {
              // Noncompact flange
              mnLocalBuckling = mpy - (mpy - 0.7 * fy * sy_mm3) * ((lambda - lambda_pf) / (lambda_rf - lambda_pf));
              form = "\\( M_n = M_p - (M_p - 0.7 F_y S_y) \\frac{\\lambda - \\lambda_{pf}}{\\lambda_{rf} - \\lambda_{pf}} \\)";
              sub = `\\( M_n = ${mpy} - (${mpy} - 0.7 \\times ${fy} \\times ${sy_mm3}) \\frac{${lambda} - ${lambda_pf.toFixed(2)}}{${lambda_rf.toFixed(2)} - ${lambda_pf.toFixed(2)}} \\)`;
          } else if (lambda > lambda_rf) {
              // Slender flange
              fcr = 0.69 * E / Math.pow(lambda, 2);
              mnLocalBuckling = fcr * sy_mm3;
              form = "\\( M_n = F_{cr} S_y \\) where \\( F_{cr} = \\frac{0.69 E}{(b/t)^2} \\)";
              sub = `\\( F_{cr} = \\frac{0.69 \\times ${E}}{${lambda}^2} = ${fcr.toFixed(2)} \\text{ MPa} \\) -> \\( M_n = ${fcr.toFixed(2)} \\times ${sy_mm3} \\)`;
          }
          
          if (mnLocalBuckling !== null) {
              limitStates.localBuckling = {
                  limitState: "Flange Local Buckling (Minor Axis)",
                  codeReference: { standard: "AISC 360", chapter: "F", section: "F6.2", limitState: "Flange Local Buckling" },
                  formula: form,
                  variables: { lambda: { symbol: "\\( \\lambda \\)", value: lambda, unit: "" } },
                  substitution: sub,
                  calculation: `Mny = ${(mnLocalBuckling / 1e6).toFixed(2)} kN-m`,
                  result: { value: mnLocalBuckling / 1e6, unit: "kN-m" },
                  resistanceFactor: { symbol: `\\( ${factorSymbol} \\)`, value: factor },
                  designStrength: { formula: isLRFD ? "\\( \\phi_b M_{ny} \\)" : "\\( M_{ny} / \\Omega_b \\)", substitution: "", value: isLRFD ? (mnLocalBuckling / 1e6 * factor) : (mnLocalBuckling / 1e6 / factor), unit: "kN-m" },
                  demand: { value: muy, unit: "kN-m" },
                  ratio: { formula: isLRFD ? "\\( M_{uy} / \\phi_b M_{ny} \\)" : "\\( M_{ay} / (M_{ny} / \\Omega_b) \\)", substitution: "", value: muy / (isLRFD ? (mnLocalBuckling / 1e6 * factor) : (mnLocalBuckling / 1e6 / factor)) },
                  status: (muy / (isLRFD ? (mnLocalBuckling / 1e6 * factor) : (mnLocalBuckling / 1e6 / factor))) <= 1.0 ? "PASS" : "FAIL",
                  steps: []
              };
          }
      }
  }
  
  // Determine governing
  let govKey = Object.keys(limitStates).reduce((minKey, key) => limitStates[key].result.value < limitStates[minKey].result.value ? key : minKey);
  const governingObj = limitStates[govKey];
  
  return {
     limitStates: limitStates,
     governingMn: governingObj.result.value,
     governingCapacity: governingObj.designStrength.value,
     governingLimitState: governingObj.limitState,
     passed: governingObj.status === "PASS"
  };
}


// ─── MAJOR AXIS DISPATCH ─────────────────────────────────────────────
export function checkFlexure(state) {
  const type = state.section.type;
  let majorAxisObj = null;
  
  if (['W', 'M', 'S', 'HP'].includes(type) || state.section.builtUpType === 'I-SECTION' || state.section.builtUpType === 'PLATE-GIRDER') {
      majorAxisObj = checkWFlexure(state);
  } else if (['HSS Square', 'HSS Rectangular', 'HSS Round', 'Pipe'].includes(type) || state.section.builtUpType === 'BOX') {
      majorAxisObj = checkHSSFlexure(state);
  } else if (['WT', 'MT', 'ST'].includes(type)) {
      majorAxisObj = checkTeeFlexure(state);
  } else if (['L'].includes(type)) {
      majorAxisObj = checkSingleAngleFlexure(state);
  } else if (['DOUBLE_ANGLE', 'Double Angle'].includes(type)) {
      majorAxisObj = checkDoubleAngleFlexure(state);
  } else {
      majorAxisObj = checkWFlexure(state); 
  }
  
  const minorAxisObj = checkMinorFlexure(state);
  
  return {
     ...majorAxisObj,
     minor: minorAxisObj
  };
}

// ─── SECTION-SPECIFIC MAJOR AXIS HELPERS ──────────────────────────────────────

function checkWFlexure(state) {
  const isLRFD = state.designMethod === 'lrfd';
  const factor = getFactor(state);
  const factorSymbol = isLRFD ? "\\phi_b" : "\\Omega_b";
  
  const fy = state.material.fy;
  const E = state.material.E;
  
  const zx_mm3 = (state.section.Zx || 0) * 1000;
  const ry = state.section.ry || 0;
  
  const mux = Math.abs(state.loadMux || 0); // Symmetric section, magnitude is fine
  const cb = state.Cb || 1.0;
  
  const lenMultiplier = state.lengthUnit === 'm' ? 1000 : 1;
  const lb = (state.unbracedLengthTop ?? state.memberLength ?? 0) * lenMultiplier;

  // --- 1. Yielding (Y) ---
  const mn_yield_Nmm = fy * zx_mm3;
  const mn_yield_kNm = mn_yield_Nmm / 1000000;
  
  const ds_yield = isLRFD ? (mn_yield_kNm * factor) : (mn_yield_kNm / factor);
  const ratio_yield = ds_yield > 0 ? (mux / ds_yield) : (mux > 0 ? 999.999 : 0);

  const yieldObj = {
    limitState: "Yielding",
    codeReference: { standard: "AISC 360", chapter: "F", section: "F2.1", limitState: "Yielding" },
    formula: "\\( M_n = M_p = F_y Z_x \\)",
    variables: { Fy: { symbol: "\\( F_y \\)", value: fy, unit: "MPa" }, Zx: { symbol: "\\( Z_x \\)", value: zx_mm3, unit: "mm³" } },
    substitution: `\\( M_n = ${fy} \\times ${zx_mm3} \\)`,
    calculation: `Mn = ${mn_yield_Nmm.toLocaleString()} N-mm`,
    result: { value: mn_yield_kNm, unit: "kN-m" },
    resistanceFactor: { symbol: `\\( ${factorSymbol} \\)`, value: factor },
    designStrength: { formula: isLRFD ? "\\( \\phi_b M_{nx} \\)" : "\\( M_{nx} / \\Omega_b \\)", substitution: isLRFD ? `\\( ${factor} \\times ${mn_yield_kNm.toFixed(2)} \\)` : `\\( \\frac{${mn_yield_kNm.toFixed(2)}}{${factor}} \\)`, value: ds_yield, unit: "kN-m" },
    demand: { value: mux, unit: "kN-m" },
    ratio: { formula: isLRFD ? "\\( M_{ux} / \\phi_b M_{nx} \\)" : "\\( M_{ax} / (M_{nx} / \\Omega_b) \\)", substitution: `\\( \\frac{${mux}}{${ds_yield.toFixed(2)}} \\)`, value: ratio_yield },
    status: ratio_yield <= 1.0 ? "PASS" : "FAIL",
    steps: [] 
  };

  // --- 2. Lateral-Torsional Buckling (LTB) ---
  const lp = 1.76 * ry * Math.sqrt(E / fy);
  let mn_ltb_kNm = mn_yield_kNm;
  let ltbStatus = "\\( L_b \\le L_p \\) (LTB does not apply)";
  let ltbFormula = "\\( M_n = M_p \\)";
  
  const rts = state.section.rts || ry;
  const sx = (state.section.Sx || 0) * 1000;
  const J = (state.section.J || 0) * 1000; // Database 10^3 mm^4 converted to mm^4
  const ho = state.section.ho || (state.section.d - state.section.tf) || 1;
  const c = 1.0; 
  
  const fL = 0.7 * fy;
  const term1 = (J * c) / (sx * ho || 1);
  const term2 = 6.76 * Math.pow(fL / E, 2);
  const lr = 1.95 * rts * (E / fL) * Math.sqrt(term1 + Math.sqrt(term1*term1 + term2));
  
  if (lb > lp && lb <= lr) {
      ltbStatus = "\\( L_p < L_b \\le L_r \\) (Inelastic LTB applies)";
      const mr = fL * sx / 1000000; 
      mn_ltb_kNm = cb * (mn_yield_kNm - (mn_yield_kNm - mr) * ((lb - lp) / (lr - lp)));
      if (mn_ltb_kNm > mn_yield_kNm) mn_ltb_kNm = mn_yield_kNm;
      ltbFormula = "\\( M_n = C_b \\left[ M_p - (M_p - 0.7 F_y S_x) \\left( \\frac{L_b - L_p}{L_r - L_p} \\right) \\right] \\le M_p \\)";
  } else if (lb > lr) {
      ltbStatus = "\\( L_b > L_r \\) (Elastic LTB applies)";
      const fcr = (cb * Math.PI * Math.PI * E) / Math.pow(lb / rts, 2) * Math.sqrt(1 + 0.078 * (J * c) / (sx * ho) * Math.pow(lb / rts, 2));
      mn_ltb_kNm = (fcr * sx) / 1000000;
      if (mn_ltb_kNm > mn_yield_kNm) mn_ltb_kNm = mn_yield_kNm;
      ltbFormula = "\\( M_n = F_{cr} S_x \\le M_p \\)";
  }
  
  if (isNaN(mn_ltb_kNm) || !isFinite(mn_ltb_kNm)) mn_ltb_kNm = 0;
  
  const ds_ltb = isLRFD ? (mn_ltb_kNm * factor) : (mn_ltb_kNm / factor);
  const ratio_ltb = ds_ltb > 0 ? (mux / ds_ltb) : (mux > 0 ? 999.999 : 0);

  const ltbObj = {
    limitState: "Lateral-Torsional Buckling",
    codeReference: { standard: "AISC 360", chapter: "F", section: "F2.2", limitState: "Lateral-Torsional Buckling" },
    formula: ltbFormula,
    variables: { Lb: { symbol: "\\( L_b \\)", value: lb, unit: "mm" }, Lp: { symbol: "\\( L_p \\)", value: lp, unit: "mm" }, Cb: { symbol: "\\( C_b \\)", value: cb, unit: "" } },
    substitution: `\\( L_b = ${lb}, L_p = ${lp.toFixed(2)} \\)`,
    calculation: ltbStatus,
    result: { value: mn_ltb_kNm, unit: "kN-m" },
    resistanceFactor: { symbol: `\\( ${factorSymbol} \\)`, value: factor },
    designStrength: { formula: isLRFD ? "\\( \\phi_b M_{nx} \\)" : "\\( M_{nx} / \\Omega_b \\)", substitution: isLRFD ? `\\( ${factor} \\times ${mn_ltb_kNm.toFixed(2)} \\)` : `\\( \\frac{${mn_ltb_kNm.toFixed(2)}}{${factor}} \\)`, value: ds_ltb, unit: "kN-m" },
    demand: { value: mux, unit: "kN-m" },
    ratio: { formula: isLRFD ? "\\( M_{ux} / \\phi_b M_{nx} \\)" : "\\( M_{ax} / (M_{nx} / \\Omega_b) \\)", substitution: `\\( \\frac{${mux}}{${ds_ltb.toFixed(2)}} \\)`, value: ratio_ltb },
    status: ratio_ltb <= 1.0 ? "PASS" : "FAIL",
    steps: []
  };

  const limitStates = [
      { name: 'Yielding', obj: yieldObj, ds: ds_yield, ratio: ratio_yield },
      { name: 'Lateral-Torsional Buckling', obj: ltbObj, ds: ds_ltb, ratio: ratio_ltb }
  ];
  
  const governing = limitStates.reduce((min, item) => item.ds < min.ds ? item : min);

  return { 
    yielding: yieldObj,
    lateralTorsionalBuckling: ltbObj,
    governingCapacity: governing.ds,
    governingRatio: governing.ratio,
    passed: governing.ratio <= 1.0
  };
}

function createCalcObj(state, limitStateName, sectionRef, formulaStr, substitutionStr, mn_Nmm, Mux) {
    const isLRFD = state.designMethod === 'lrfd';
    const factor = isLRFD ? 0.90 : 1.67;
    const factorSymbol = isLRFD ? "\\phi_b" : "\\Omega_b";
    
    const mn_kNm = mn_Nmm / 1e6;
    const ds = isLRFD ? mn_kNm * factor : mn_kNm / factor;
    const ratio = ds > 0 ? Mux / ds : 999;
    
    return {
        limitState: limitStateName,
        codeReference: { standard: "AISC 360", chapter: "F", section: sectionRef, limitState: limitStateName },
        formula: formulaStr,
        variables: {},
        substitution: substitutionStr,
        calculation: `Mn = ${mn_Nmm.toLocaleString()} N-mm`,
        result: { value: mn_kNm, unit: "kN-m" },
        resistanceFactor: { symbol: `\\( ${factorSymbol} \\)`, value: factor },
        designStrength: { formula: isLRFD ? "\\( \\phi_b M_{n} \\)" : "\\( M_{n} / \\Omega_b \\)", substitution: "", value: ds, unit: "kN-m" },
        demand: { value: Mux, unit: "kN-m" },
        ratio: { formula: isLRFD ? "\\( M_u / \\phi_b M_n \\)" : "\\( M_a / (M_n / \\Omega_b) \\)", substitution: "", value: ratio },
        status: ratio <= 1.0 ? "PASS" : "FAIL",
        steps: []
    };
}

function checkHSSFlexure(state) {
    const fy = state.material.fy;
    const E = state.material.E;
    const zx = (state.section.Zx || 0) * 1000;
    const sx = (state.section.Sx || 0) * 1000;
    const ag = state.section.area;
    const ry = state.section.ry || 0;
    const J = (state.section.J || 0) * 1000; 
    
    const mux = Math.abs(state.loadMux || 0);
    const cb = state.Cb || 1.0;
    const lenMultiplier = state.lengthUnit === 'm' ? 1000 : 1;
    const lb = (state.unbracedLengthTop ?? state.memberLength ?? 0) * lenMultiplier;
    
    const limitStates = {};
    
    // Yielding
    const mpz = fy * zx;
    limitStates.yielding = createCalcObj(state, "Major-Axis Yielding", "F7.1", "\\( M_n = M_p = F_y Z_x \\)", `\\( ${fy} \\times ${zx} \\)`, mpz, mux);
    
    // Flange Local Buckling
    const b_t = state.section.b_tdes || state.section.b_t || state.section.bf_2tf * 2;
    if (b_t != null) {
        const lambda_p = 1.12 * Math.sqrt(E/fy);
        const lambda_r = 1.40 * Math.sqrt(E/fy);
        
        if (b_t > lambda_p && b_t <= lambda_r) {
            let mn_flb = mpz - (mpz - fy * sx) * (3.57 * b_t * Math.sqrt(fy/E) - 4);
            if (mn_flb > mpz) mn_flb = mpz;
            limitStates.flangeLocalBuckling = createCalcObj(state, "Flange Local Buckling (Noncompact)", "F7.2", "\\( M_n = M_p - (M_p - F_y S_x)[3.57 \\lambda \\sqrt{F_y/E} - 4] \\)", `\\( ${mpz} - (${mpz} - ${fy*sx})[3.57(${b_t})\\sqrt{${fy}/${E}} - 4] \\)`, mn_flb, mux);
        } else if (b_t > lambda_r) {
            const b = state.section.b || 1;
            const t = state.section.tdes || state.section.t || 1;
            let be = 1.92 * t * Math.sqrt(E/fy) * (1 - 0.38 / (b_t) * Math.sqrt(E/fy));
            if (be > b) be = b;
            if (be < 0) be = 0;
            const area_loss = (b - be) * t * 2; 
            const y_dist = (state.section.d || state.section.h) / 2;
            const i_loss = area_loss * Math.pow(y_dist, 2);
            const ix = (state.section.Ix || 0) * 1000000;
            const ix_eff = Math.max(ix - i_loss, 0);
            const se_mm3 = ix_eff / y_dist;
            const mn_slb = fy * se_mm3;
            limitStates.flangeLocalBuckling = createCalcObj(state, "Flange Local Buckling (Slender)", "F7.2", "\\( M_n = F_y S_e \\)", `\\( ${fy} \\times ${se_mm3.toFixed(2)} \\)`, mn_slb, mux);
            limitStates.flangeLocalBuckling.steps.push({step: 1, title: "Effective Width", formula: "be = 1.92 t sqrt(E/Fy)[1 - 0.38/(b/t)sqrt(E/Fy)]", substitution: "", result: be.toFixed(2), unit: "mm"});
        }
    }
    
    // Web Local Buckling
    const h_t = state.section.h_tdes || state.section.h_t || state.section.h_tw;
    if (h_t != null) {
        const lambda_p = 2.42 * Math.sqrt(E/fy);
        const lambda_r = 5.70 * Math.sqrt(E/fy);
        
        if (h_t > lambda_p && h_t <= lambda_r) {
            let mn_wlb = mpz - (mpz - fy * sx) * (0.305 * h_t * Math.sqrt(fy/E) - 0.738);
            if (mn_wlb > mpz) mn_wlb = mpz;
            limitStates.webLocalBuckling = createCalcObj(state, "Web Local Buckling", "F7.3", "\\( M_n = M_p - (M_p - F_y S_x)[0.305 \\lambda \\sqrt{F_y/E} - 0.738] \\)", "", mn_wlb, mux);
        }
    }
    
    // LTB
    if (J > 0 && ag > 0 && ry > 0 && state.section.type !== 'Pipe') {
        const lp = 0.13 * E * ry * Math.sqrt(J * ag) / mpz;
        const lr = 2 * E * ry * Math.sqrt(J * ag) / (0.7 * fy * sx);
        
        let mn_ltb = mpz;
        if (lb > lp && lb <= lr) {
            mn_ltb = cb * (mpz - (mpz - 0.7 * fy * sx) * ((lb - lp)/(lr - lp)));
            if (mn_ltb > mpz) mn_ltb = mpz;
            limitStates.lateralTorsionalBuckling = createCalcObj(state, "Lateral-Torsional Buckling (Inelastic)", "F7.4", "\\( M_n = C_b [M_p - (M_p - 0.7 F_y S_x)(\\frac{L_b - L_p}{L_r - L_p})] \\)", "", mn_ltb, mux);
        } else if (lb > lr) {
            mn_ltb = (2 * E * cb * Math.sqrt(J * ag)) / (lb / ry);
            if (mn_ltb > mpz) mn_ltb = mpz;
            limitStates.lateralTorsionalBuckling = createCalcObj(state, "Lateral-Torsional Buckling (Elastic)", "F7.4", "\\( M_n = \\frac{2 E C_b \\sqrt{J A_g}}{L_b/r_y} \\)", "", mn_ltb, mux);
        }
    }

    let govKey = Object.keys(limitStates).reduce((minKey, key) => limitStates[key].result.value < limitStates[minKey].result.value ? key : minKey);
    const governingObj = limitStates[govKey];
    
    return {
        ...limitStates,
        governingCapacity: governingObj.designStrength.value,
        governingRatio: governingObj.ratio.value,
        passed: governingObj.status === "PASS"
    };
}

function getTeeBendingCase({ moment, orientation }) {
    if ((orientation === 'TOP' && moment >= 0) || (orientation === 'BOTTOM' && moment < 0)) {
        return 'STEM_TENSION';
    } else {
        return 'STEM_COMPRESSION';
    }
}

function checkTeeFlexure(state) {
    const fy = state.material.fy;
    const E = state.material.E;
    const sx = (state.section.Sx || 0) * 1000;
    const zx = (state.section.Zx || 0) * 1000;
    const ry = state.section.ry || 0;
    const J = (state.section.J || 0) * 1000;
    const Iy = (state.section.Iy || 0) * 1000000;
    const d = state.section.d || 1;
    
    const signedMux = state.loadMux || 0; 
    const mux = Math.abs(signedMux);
    const cb = state.Cb || 1.0;
    const lenMultiplier = state.lengthUnit === 'm' ? 1000 : 1;
    const lb = (state.unbracedLengthTop ?? state.memberLength ?? 0) * lenMultiplier;
    
    const orientation = state.sectionOrientation || 'TOP';
    const bendingCase = getTeeBendingCase({ moment: signedMux, orientation });
    
    const limitStates = {};
    
    // Yielding
    const my = fy * sx;
    const mp = fy * zx;
    let mn_yield = Math.min(mp, 1.6 * my);
    limitStates.yielding = createCalcObj(state, "Yielding", "F9.1", "\\( M_n = M_p \\le 1.6 M_y \\)", `\\( M_y=${my}, M_p=${mp} \\)`, mn_yield, mux);
    
    // LTB
    const lp = 1.76 * ry * Math.sqrt(E/fy);
    let B_ltb = 2.3 * (d/lb) * Math.sqrt(Iy/J);
    if (bendingCase === 'STEM_COMPRESSION') {
        B_ltb = -B_ltb;
    }
    const mcr = (1.95 * E / lb) * Math.sqrt(Iy * J) * (B_ltb + Math.sqrt(1 + B_ltb*B_ltb));
    
    // For Tee LTB intermediate region we need Lr. For brevity, assuming elastic LTB governs if lb > lp, else inelastic.
    // Full AISC F9 Lr derivation requires more properties. We will use Mcr directly for Lb > Lp as a conservative stand-in for this snippet.
    if (lb > lp) {
        let mn_ltb = mcr;
        if (mn_ltb > mn_yield) mn_ltb = mn_yield;
        limitStates.lateralTorsionalBuckling = createCalcObj(state, "Lateral-Torsional Buckling", "F9.2", "\\( M_n = M_{cr} \\le M_p \\)", `\\( M_{cr} = ${mcr.toFixed(0)} \\)`, mn_ltb, mux);
    }
    
    // Flange Local Buckling
    const lambda_f = state.section.bf_2tf;
    if (lambda_f != null) {
        const lambdaPf = 0.38 * Math.sqrt(E/fy);
        const lambdaRf = 1.00 * Math.sqrt(E/fy);
        if (lambda_f > lambdaPf && lambda_f <= lambdaRf) {
            let mn_flb = mp - (mp - 0.7 * fy * sx) * ((lambda_f - lambdaPf) / (lambdaRf - lambdaPf));
            if (mn_flb > 1.6 * my) mn_flb = 1.6 * my;
            limitStates.flangeLocalBuckling = createCalcObj(state, "Flange Local Buckling", "F9.3", "\\( M_n = M_p - (M_p - 0.7 F_y S_{xc})(\\dots) \\)", "", mn_flb, mux);
        } else if (lambda_f > lambdaRf) {
            let mn_flb = 0.7 * E * sx / Math.pow(lambda_f, 2);
            limitStates.flangeLocalBuckling = createCalcObj(state, "Flange Local Buckling (Slender)", "F9.3", "\\( M_n = \\frac{0.7 E S_{xc}}{(b/2t_f)^2} \\)", "", mn_flb, mux);
        }
    }
    
    // Stem Local Buckling
    const d_t = state.section.d_tw || state.section.h_tw;
    if (d_t != null) {
        let fcr_stem = fy;
        if (d_t <= 0.84 * Math.sqrt(E/fy)) {
            fcr_stem = fy;
        } else if (d_t <= 1.52 * Math.sqrt(E/fy)) {
            fcr_stem = (1.43 - 0.515 * d_t * Math.sqrt(fy/E)) * fy;
        } else {
            fcr_stem = 1.52 * E / Math.pow(d_t, 2);
        }
        const mn_slb = fcr_stem * sx;
        limitStates.stemLocalBuckling = createCalcObj(state, "Stem Local Buckling", "F9.4", "\\( M_n = F_{cr} S_x \\)", `\\( F_{cr} = ${fcr_stem.toFixed(2)} \\)`, mn_slb, mux);
    }
    
    let govKey = Object.keys(limitStates).reduce((minKey, key) => limitStates[key].result.value < limitStates[minKey].result.value ? key : minKey);
    const governingObj = limitStates[govKey];
    
    return {
        ...limitStates,
        bendingCase: bendingCase,
        governingCapacity: governingObj.designStrength.value,
        governingRatio: governingObj.ratio.value,
        passed: governingObj.status === "PASS"
    };
}

function checkSingleAngleFlexure(state) {
    const fy = state.material.fy;
    const E = state.material.E;
    const sc = (state.section.Sz || state.section.Sx || 0) * 1000;
    const zx = (state.section.Zz || state.section.Zx || 0) * 1000;
    const J = (state.section.J || 0) * 1000;
    const Iy = (state.section.Iy || 0) * 1000000;
    const d = state.section.d || 1;
    
    const signedMux = state.loadMux || 0; 
    const mux = Math.abs(signedMux);
    const cb = state.Cb || 1.0;
    const lenMultiplier = state.lengthUnit === 'm' ? 1000 : 1;
    const lb = (state.unbracedLengthTop ?? state.memberLength ?? 0) * lenMultiplier;
    
    const limitStates = {};
    
    // Yielding
    const my = fy * sc;
    const mp = fy * zx;
    let mn_yield = 1.5 * my; // typical angle limit
    limitStates.yielding = createCalcObj(state, "Yielding", "F10.1", "\\( M_n = 1.5 M_y \\)", `\\( M_y = ${my} \\)`, mn_yield, mux);
    
    // LTB
    const tensionSideCase = signedMux >= 0; // Simplified assumption for demonstration
    let B_ltb = 2.3 * (d/lb) * Math.sqrt(Iy/J);
    if (!tensionSideCase) B_ltb = -B_ltb;
    
    const mcr = (1.95 * E / lb) * Math.sqrt(Iy * J) * (B_ltb + Math.sqrt(1 + B_ltb*B_ltb));
    let mn_ltb = 0;
    const ratio = my / mcr;
    if (ratio <= 1.0) {
        mn_ltb = Math.min(1.5 * my, (1.92 - 1.17 * Math.sqrt(ratio)) * my);
    } else {
        mn_ltb = (0.92 - 0.17 * (mcr / my)) * mcr;
    }
    limitStates.lateralTorsionalBuckling = createCalcObj(state, "Lateral-Torsional Buckling", "F10.2", ratio <= 1 ? "\\( M_n = (1.92 - 1.17\\sqrt{M_y/M_{cr}})M_y \\)" : "\\( M_n = (0.92 - 0.17 M_{cr}/M_y)M_{cr} \\)", `\\( M_{cr} = ${mcr.toFixed(0)} \\)`, mn_ltb, mux);
    
    // Local Buckling
    const b_t = state.section.b_t;
    if (b_t != null) {
        const lambda_p = 0.54 * Math.sqrt(E/fy);
        const lambda_r = 0.91 * Math.sqrt(E/fy);
        
        let mn_lb = null;
        if (b_t > lambda_p && b_t <= lambda_r) {
            mn_lb = fy * sc * (2.43 - 1.72 * b_t * Math.sqrt(fy/E));
            limitStates.localBuckling = createCalcObj(state, "Local Buckling (Noncompact)", "F10.3", "\\( M_n = F_y S_c (2.43 - 1.72(b/t)\\sqrt{F_y/E}) \\)", "", mn_lb, mux);
        } else if (b_t > lambda_r) {
            const fcr = 0.71 * E / Math.pow(b_t, 2);
            mn_lb = fcr * sc;
            limitStates.localBuckling = createCalcObj(state, "Local Buckling (Slender)", "F10.3", "\\( M_n = F_{cr} S_c \\)", `\\( F_{cr} = ${fcr.toFixed(2)} \\)`, mn_lb, mux);
        }
    }
    
    let govKey = Object.keys(limitStates).reduce((minKey, key) => limitStates[key].result.value < limitStates[minKey].result.value ? key : minKey);
    const governingObj = limitStates[govKey];
    
    return {
        ...limitStates,
        sectionFamily: 'ANGLE',
        governingCapacity: governingObj.designStrength.value,
        governingRatio: governingObj.ratio.value,
        passed: governingObj.status === "PASS"
    };
}

function checkDoubleAngleFlexure(state) {
    // Reusing identical underlying angle mechanics per F10 where applicable.
    const res = checkSingleAngleFlexure(state);
    res.sectionFamily = 'DOUBLE_ANGLE';
    return res;
}
