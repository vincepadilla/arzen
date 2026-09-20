// Tension capacity calculations
export function checkTension(state) {
  const fy = state.material.fy; // MPa (N/mm2)
  const fu = state.material.fu; // MPa (N/mm2)
  const ag = state.section.area; // mm2
  const pu = state.loadPu || 0; // kN
  const isLRFD = state.designMethod === 'lrfd';

  // --- Gross Section Yielding ---
  const pn_yield_N = fy * ag;
  const pn_yield_kN = pn_yield_N / 1000;
  const factor_yield = isLRFD ? 0.90 : 1.67;
  const factorSym_yield = isLRFD ? "φ" : "Ω";
  const ds_yield = isLRFD ? (pn_yield_kN * factor_yield) : (pn_yield_kN / factor_yield);
  const ratio_yield = ds_yield > 0 ? (pu / ds_yield) : (pu > 0 ? 999.999 : 0);

  const yieldObj = {
    limitState: "Gross Section Yielding",
    codeReference: {
        standard: state.designCode === 'nscp2015-aisc360-10' ? "NSCP 2015 / AISC 360-10" : "AISC 360",
        chapter: "D",
        section: "D2",
        limitState: "Tensile Yielding"
    },
    formula: "\\( P_n = F_y A_g \\)",
    variables: {
        Fy: { symbol: "\\( F_y \\)", value: fy, unit: "MPa" },
        Ag: { symbol: "\\( A_g \\)", value: ag, unit: "mm²" }
    },
    substitution: `\\( P_n = ${fy} \\times ${ag} \\)`,
    calculation: `Pn = ${pn_yield_N.toLocaleString()} N`,
    result: { value: pn_yield_kN, unit: "kN" },
    resistanceFactor: { symbol: `\\( ${factorSym_yield} \\)`, value: factor_yield },
    designStrength: {
        formula: isLRFD ? "\\( \\phi P_n \\)" : "\\( P_n / \\Omega \\)",
        substitution: isLRFD ? `\\( ${factor_yield} \\times ${pn_yield_kN.toFixed(2)} \\)` : `\\( \\frac{${pn_yield_kN.toFixed(2)}}{${factor_yield}} \\)`,
        value: Number(ds_yield.toFixed(2)),
        unit: "kN"
    },
    demand: { value: pu, unit: "kN" },
    ratio: {
        formula: isLRFD ? "\\( P_u / \\phi P_n \\)" : "\\( P_a / (P_n / \\Omega) \\)",
        substitution: `\\( \\frac{${pu}}{${ds_yield.toFixed(2)}} \\)`,
        value: Number(ratio_yield.toFixed(3))
    },
    status: ratio_yield <= 1.0 ? "PASS" : "FAIL",
    steps: [
        {
            step: 1,
            title: "Section Property & Material",
            formula: "Ag, Fy",
            substitution: `Ag = ${ag}, Fy = ${fy}`,
            result: `${ag} mm², ${fy} MPa`,
            unit: ""
        },
        {
            step: 2,
            title: "Nominal Strength",
            formula: "Pn = Fy × Ag",
            substitution: `Pn = ${fy} × ${ag} / 1000`,
            result: pn_yield_kN.toFixed(2),
            unit: "kN"
        },
        {
            step: 3,
            title: "Design Strength",
            formula: isLRFD ? "φPn = φ × Pn" : "Pn/Ω = Pn / Ω",
            substitution: isLRFD ? `${factor_yield} × ${pn_yield_kN.toFixed(2)}` : `${pn_yield_kN.toFixed(2)} / ${factor_yield}`,
            result: ds_yield.toFixed(2),
            unit: "kN"
        },
        {
            step: 4,
            title: "Demand / Capacity Ratio",
            formula: isLRFD ? "D/C = Pu / φPn" : "D/C = Pa / (Pn/Ω)",
            substitution: `${pu} / ${ds_yield.toFixed(2)}`,
            result: ratio_yield.toFixed(3),
            unit: ""
        }
    ]
  };

  // --- Net Section Fracture ---
  // Assumption: Ae = 0.75 * Ag (Simplified for unknown connection)
  const ae = 0.75 * ag;
  const pn_frac_N = fu * ae;
  const pn_frac_kN = pn_frac_N / 1000;
  const factor_frac = isLRFD ? 0.75 : 2.00;
  const factorSym_frac = isLRFD ? "φ" : "Ω";
  const ds_frac = isLRFD ? (pn_frac_kN * factor_frac) : (pn_frac_kN / factor_frac);
  const ratio_frac = ds_frac > 0 ? (pu / ds_frac) : (pu > 0 ? 999.999 : 0);

  const fracObj = {
    limitState: "Net Section Fracture",
    codeReference: {
        standard: state.designCode === 'nscp2015-aisc360-10' ? "NSCP 2015 / AISC 360-10" : "AISC 360",
        chapter: "D",
        section: "D2",
        limitState: "Tensile Rupture"
    },
    formula: "\\( P_n = F_u A_e \\)",
    variables: {
        Fu: { symbol: "\\( F_u \\)", value: fu, unit: "MPa" },
        Ae: { symbol: "\\( A_e \\)", value: ae, unit: "mm²" }
    },
    substitution: `\\( P_n = ${fu} \\times ${ae} \\)`,
    calculation: `Pn = ${pn_frac_N.toLocaleString()} N`,
    result: { value: pn_frac_kN, unit: "kN" },
    resistanceFactor: { symbol: `\\( ${factorSym_frac} \\)`, value: factor_frac },
    designStrength: {
        formula: isLRFD ? "\\( \\phi P_n \\)" : "\\( P_n / \\Omega \\)",
        substitution: isLRFD ? `\\( ${factor_frac} \\times ${pn_frac_kN.toFixed(2)} \\)` : `\\( \\frac{${pn_frac_kN.toFixed(2)}}{${factor_frac}} \\)`,
        value: Number(ds_frac.toFixed(2)),
        unit: "kN"
    },
    demand: { value: pu, unit: "kN" },
    ratio: {
        formula: isLRFD ? "\\( P_u / \\phi P_n \\)" : "\\( P_a / (P_n / \\Omega) \\)",
        substitution: `\\( \\frac{${pu}}{${ds_frac.toFixed(2)}} \\)`,
        value: Number(ratio_frac.toFixed(3))
    },
    status: ratio_frac <= 1.0 ? "PASS" : "FAIL",
    steps: [
        {
            step: 1,
            title: "Effective Net Area",
            formula: "Ae = 0.75 × Ag (Assumed)",
            substitution: `Ae = 0.75 × ${ag}`,
            result: `${ae}`,
            unit: "mm²"
        },
        {
            step: 2,
            title: "Nominal Fracture Strength",
            formula: "Pn = Fu × Ae",
            substitution: `Pn = ${fu} × ${ae} / 1000`,
            result: pn_frac_kN.toFixed(2),
            unit: "kN"
        },
        {
            step: 3,
            title: "Design Strength",
            formula: isLRFD ? "φPn = φ × Pn" : "Pn/Ω = Pn / Ω",
            substitution: isLRFD ? `${factor_frac} × ${pn_frac_kN.toFixed(2)}` : `${pn_frac_kN.toFixed(2)} / ${factor_frac}`,
            result: ds_frac.toFixed(2),
            unit: "kN"
        },
        {
            step: 4,
            title: "Demand / Capacity Ratio",
            formula: isLRFD ? "D/C = Pu / φPn" : "D/C = Pa / (Pn/Ω)",
            substitution: `${pu} / ${ds_frac.toFixed(2)}`,
            result: ratio_frac.toFixed(3),
            unit: ""
        }
    ]
  };

  // --- Determine Governing Limit State ---
  const governing = ds_yield <= ds_frac ? yieldObj : fracObj;

  return { 
    grossYielding: yieldObj,
    netFracture: fracObj,
    governing: governing,
    governingCapacity: governing.designStrength.value,
    governingRatio: governing.ratio.value,
    passed: governing.status === "PASS"
  };
}
