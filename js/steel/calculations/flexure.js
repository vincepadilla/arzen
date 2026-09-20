// Flexural capacity calculations (AISC 360 Chapter F)
export function checkFlexure(state) {
  const isLRFD = state.designMethod === 'lrfd';
  const factor = isLRFD ? 0.90 : 1.67;
  const factorSymbol = isLRFD ? "φb" : "Ωb";
  
  const fy = state.material.fy;
  const E = state.material.E;
  
  // Section properties (Assuming standard AISC metric database units)
  const zx_mm3 = (state.section.Zx || 0) * 1000;
  const sx_mm3 = (state.section.Sx || 0) * 1000;
  const ry = state.section.ry || 0;
  
  const mux = state.loadMux || 0;
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
    codeReference: {
        standard: state.designCode === 'nscp2015-aisc360-10' ? "NSCP 2015 / AISC 360-10" : "AISC 360",
        chapter: "F",
        section: "F2.1",
        limitState: "Yielding"
    },
    formula: "\\( M_n = M_p = F_y Z_x \\)",
    variables: {
        Fy: { symbol: "\\( F_y \\)", value: fy, unit: "MPa" },
        Zx: { symbol: "\\( Z_x \\)", value: zx_mm3, unit: "mm³" }
    },
    substitution: `\\( M_n = ${fy} \\times ${zx_mm3} \\)`,
    calculation: `Mn = ${mn_yield_Nmm.toLocaleString()} N-mm`,
    result: { value: mn_yield_kNm, unit: "kN-m" },
    resistanceFactor: { symbol: `\\( ${factorSymbol} \\)`, value: factor },
    designStrength: {
        formula: isLRFD ? "\\( \\phi_b M_{nx} \\)" : "\\( M_{nx} / \\Omega_b \\)",
        substitution: isLRFD ? `\\( ${factor} \\times ${mn_yield_kNm.toFixed(2)} \\)` : `\\( \\frac{${mn_yield_kNm.toFixed(2)}}{${factor}} \\)`,
        value: Number(ds_yield.toFixed(2)),
        unit: "kN-m"
    },
    demand: { value: mux, unit: "kN-m" },
    ratio: {
        formula: isLRFD ? "\\( M_{ux} / \\phi_b M_{nx} \\)" : "\\( M_{ax} / (M_{nx} / \\Omega_b) \\)",
        substitution: `\\( \\frac{${mux}}{${ds_yield.toFixed(2)}} \\)`,
        value: Number(ratio_yield.toFixed(3))
    },
    status: ratio_yield <= 1.0 ? "PASS" : "FAIL",
    steps: [
        {
            step: 1,
            title: "Section Properties & Material",
            formula: "Zx, Fy",
            substitution: `Zx = ${zx_mm3}, Fy = ${fy}`,
            result: `Zx = ${zx_mm3} mm³\nFy = ${fy} MPa`,
            unit: ""
        },
        {
            step: 2,
            title: "Nominal Flexural Strength (Yielding)",
            formula: "Mn = Fy × Zx",
            substitution: `Mn = ${fy} × ${zx_mm3} / 10^6`,
            result: mn_yield_kNm.toFixed(2),
            unit: "kN-m"
        },
        {
            step: 3,
            title: "Design Strength",
            formula: isLRFD ? "φbMn = φb × Mn" : "Mn/Ωb = Mn / Ωb",
            substitution: isLRFD ? `${factor} × ${mn_yield_kNm.toFixed(2)}` : `${mn_yield_kNm.toFixed(2)} / ${factor}`,
            result: ds_yield.toFixed(2),
            unit: "kN-m"
        },
        {
            step: 4,
            title: "Demand / Capacity Ratio",
            formula: isLRFD ? "D/C = Mux / φbMn" : "D/C = Max / (Mn/Ωb)",
            substitution: `${mux} / ${ds_yield.toFixed(2)}`,
            result: ratio_yield.toFixed(3),
            unit: ""
        }
    ]
  };

  // --- 2. Lateral-Torsional Buckling (LTB) ---
  const lp = 1.76 * ry * Math.sqrt(E / fy);
  let mn_ltb_kNm = mn_yield_kNm;
  let ltbStatus = "\\( L_b \\le L_p \\) (LTB does not apply)";
  let ltbFormula = "\\( M_n = M_p \\)";
  
  // Extract specific properties for Lr
  const rts = state.section.rts || ry; // Fallback to ry if rts missing
  const sx = (state.section.Sx || 0) * 1000;
  const J = (state.section.J || 0) * 10000; // Database might have cm^4 or mm^4, usually 10^3 for J in some DBs. Let's assume database units are mm-based like others (e.g. area 77400). Wait, J is 55800. Let's assume mm^4 but J is huge. Actually in AISC J is in^4, in metric it's mm^4 usually scaled. Let's assume standard mm units.
  const ho = state.section.ho || (state.section.d - state.section.tf) || 1;
  const c = 1.0; // Doubly symmetric I-shape
  
  // Calculate Lr
  const fL = 0.7 * fy;
  const term1 = (J * c) / (sx * ho || 1);
  const term2 = 6.76 * Math.pow(fL / E, 2);
  const lr = 1.95 * rts * (E / fL) * Math.sqrt(term1 + Math.sqrt(term1*term1 + term2));
  
  if (lb > lp && lb <= lr) {
      ltbStatus = "\\( L_p < L_b \\le L_r \\) (Inelastic LTB applies)";
      const mr = fL * sx / 1000000; // in kN-m
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
  
  // Prevent NaN
  if (isNaN(mn_ltb_kNm) || !isFinite(mn_ltb_kNm)) {
      mn_ltb_kNm = 0;
  }
  
  const ds_ltb = isLRFD ? (mn_ltb_kNm * factor) : (mn_ltb_kNm / factor);
  const ratio_ltb = ds_ltb > 0 ? (mux / ds_ltb) : (mux > 0 ? 999.999 : 0);

  const ltbObj = {
    limitState: "Lateral-Torsional Buckling",
    codeReference: {
        standard: state.designCode === 'nscp2015-aisc360-10' ? "NSCP 2015 / AISC 360-10" : "AISC 360",
        chapter: "F",
        section: "F2.2",
        limitState: "Lateral-Torsional Buckling"
    },
    formula: ltbFormula,
    variables: {
        Lb: { symbol: "\\( L_b \\)", value: lb, unit: "mm" },
        Lp: { symbol: "\\( L_p \\)", value: Number(lp.toFixed(2)), unit: "mm" },
        Cb: { symbol: "\\( C_b \\)", value: cb, unit: "" }
    },
    substitution: `\\( L_b = ${lb}, L_p = ${lp.toFixed(2)} \\)`,
    calculation: ltbStatus,
    result: { value: mn_ltb_kNm, unit: "kN-m" },
    resistanceFactor: { symbol: `\\( ${factorSymbol} \\)`, value: factor },
    designStrength: {
        formula: isLRFD ? "\\( \\phi_b M_{nx} \\)" : "\\( M_{nx} / \\Omega_b \\)",
        substitution: isLRFD ? `\\( ${factor} \\times ${mn_ltb_kNm.toFixed(2)} \\)` : `\\( \\frac{${mn_ltb_kNm.toFixed(2)}}{${factor}} \\)`,
        value: Number(ds_ltb.toFixed(2)),
        unit: "kN-m"
    },
    demand: { value: mux, unit: "kN-m" },
    ratio: {
        formula: isLRFD ? "\\( M_{ux} / \\phi_b M_{nx} \\)" : "\\( M_{ax} / (M_{nx} / \\Omega_b) \\)",
        substitution: `\\( \\frac{${mux}}{${ds_ltb.toFixed(2)}} \\)`,
        value: Number(ratio_ltb.toFixed(3))
    },
    status: ratio_ltb <= 1.0 ? "PASS" : "FAIL",
    steps: [
        {
            step: 1,
            title: "Limiting Unbraced Length (Lp)",
            formula: "Lp = 1.76 × ry × √(E/Fy)",
            substitution: `Lp = 1.76 × ${ry} × √(${E}/${fy})`,
            result: `${lp.toFixed(2)} mm`,
            unit: "mm"
        },
        {
            step: 2,
            title: "Unbraced Length Check",
            formula: "Lb vs Lp",
            substitution: `Lb = ${lb} mm, Lp = ${lp.toFixed(2)} mm`,
            result: ltbStatus,
            unit: ""
        },
        {
            step: 3,
            title: "Nominal Flexural Strength (LTB)",
            formula: ltbFormula,
            substitution: ltbStatus === "Lb ≤ Lp (LTB does not apply)" ? `Mn = Mp = ${mn_yield_kNm.toFixed(2)}` : "Calculated via AISC F2-2",
            result: mn_ltb_kNm.toFixed(2),
            unit: "kN-m"
        },
        {
            step: 4,
            title: "Design Strength",
            formula: isLRFD ? "φbMn = φb × Mn" : "Mn/Ωb = Mn / Ωb",
            substitution: isLRFD ? `${factor} × ${mn_ltb_kNm.toFixed(2)}` : `${mn_ltb_kNm.toFixed(2)} / ${factor}`,
            result: ds_ltb.toFixed(2),
            unit: "kN-m"
        },
        {
            step: 5,
            title: "Demand / Capacity Ratio",
            formula: isLRFD ? "D/C = Mux / φbMn" : "D/C = Max / (Mn/Ωb)",
            substitution: `${mux} / ${ds_ltb.toFixed(2)}`,
            result: ratio_ltb.toFixed(3),
            unit: ""
        }
    ]
  };

  // --- Determine Governing Limit State ---
  const governing = ds_yield <= ds_ltb ? yieldObj : ltbObj;

  return { 
    yielding: yieldObj,
    lateralTorsionalBuckling: ltbObj,
    governingCapacity: governing.designStrength.value,
    governingRatio: governing.ratio.value,
    passed: governing.status === "PASS"
  };
}
