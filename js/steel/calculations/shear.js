// Shear capacity calculations (AISC 360 Chapter G)
export function checkShear(state) {
  const isLRFD = state.designMethod === 'lrfd';
  
  const fy = state.material.fy;
  const E = state.material.E;
  
  const d = state.section.d || 0;
  const tw = state.section.tw || 0;
  const h_tw = state.section.h_tw || 0;
  
  const vux = state.loadVux || 0;
  
  // Web Area
  const aw = d * tw;
  
  // Shear Coefficient Cv1
  const limitCv1 = 2.24 * Math.sqrt(E / fy);
  let cv1 = 1.0;
  let cv1Formula = "\\( C_{v1} = 1.0 \\)";
  let cv1Sub = `\\( h/t_w (${h_tw}) \\le 2.24\\sqrt{E/F_y} (${limitCv1.toFixed(2)}) \\)`;
  let isSpecialCase = false;
  
  if (h_tw <= limitCv1) {
    cv1 = 1.0;
    isSpecialCase = true; // AISC G2.1(a) allows phi_v = 1.00
  } else {
    // Assuming kv = 5.0 for webs without transverse stiffeners
    const limit2 = 1.10 * Math.sqrt((5 * E) / fy);
    if (h_tw <= limit2) {
       cv1 = 1.0;
       cv1Sub = `\\( h/t_w (${h_tw}) \\le 1.10\\sqrt{5E/F_y} (${limit2.toFixed(2)}) \\)`;
    } else {
       cv1 = limit2 / h_tw;
       cv1Formula = "\\( C_{v1} = \\frac{1.10\\sqrt{k_v E / F_y}}{h/t_w} \\)";
       cv1Sub = `\\( C_{v1} = \\frac{${limit2.toFixed(2)}}{${h_tw}} \\)`;
    }
  }
  
  // Resistance Factors (AISC G2.1a vs G2.1b)
  const factor = isSpecialCase ? (isLRFD ? 1.00 : 1.50) : (isLRFD ? 0.90 : 1.67);
  const factorSymbol = isLRFD ? "φv" : "Ωv";
  
  // Nominal Shear Strength
  const vn_N = 0.6 * fy * aw * cv1;
  const vn_kN = vn_N / 1000;
  
  const designStrength = isLRFD ? (vn_kN * factor) : (vn_kN / factor);
  const ratioVal = designStrength > 0 ? (vux / designStrength) : (vux > 0 ? 999.999 : 0);
  const status = ratioVal <= 1.0 ? "PASS" : "FAIL";

  const calcObj = {
    limitState: "Major Axis Shear",
    codeReference: {
        standard: state.designCode === 'nscp2015-aisc360-10' ? "NSCP 2015 / AISC 360-10" : "AISC 360",
        chapter: "G",
        section: "G2",
        limitState: "Major Axis Shear"
    },
    formula: "\\( V_n = 0.6 F_y A_w C_{v1} \\)",
    variables: {
        Aw: { symbol: "\\( A_w \\)", value: aw, unit: "mm²" },
        Cv1: { symbol: "\\( C_{v1} \\)", value: Number(cv1.toFixed(3)), unit: "" }
    },
    substitution: `\\( V_n = 0.6 \\times ${fy} \\times ${aw} \\times ${cv1.toFixed(2)} \\)`,
    calculation: `Vn = ${vn_N.toLocaleString()} N`,
    result: { value: vn_kN, unit: "kN" },
    resistanceFactor: { symbol: `\\( ${factorSymbol} \\)`, value: factor },
    designStrength: {
        formula: isLRFD ? "\\( \\phi_v V_n \\)" : "\\( V_n / \\Omega_v \\)",
        substitution: isLRFD ? `\\( ${factor.toFixed(2)} \\times ${vn_kN.toFixed(2)} \\)` : `\\( \\frac{${vn_kN.toFixed(2)}}{${factor.toFixed(2)}} \\)`,
        value: Number(designStrength.toFixed(2)),
        unit: "kN"
    },
    demand: { value: vux, unit: "kN" },
    ratio: {
        formula: isLRFD ? "\\( V_{ux} / \\phi_v V_n \\)" : "\\( V_{ax} / (V_n / \\Omega_v) \\)",
        substitution: `\\( \\frac{${vux}}{${designStrength.toFixed(2)}} \\)`,
        value: Number(ratioVal.toFixed(3))
    },
    status: status,
    steps: [
        {
            step: 1,
            title: "Web Dimensions & Area",
            formula: "Aw = d × tw",
            substitution: `Aw = ${d} × ${tw}`,
            result: `${aw} mm²`,
            unit: "mm²"
        },
        {
            step: 2,
            title: "Web Slenderness Check",
            formula: cv1Formula,
            substitution: cv1Sub,
            result: `Cv1 = ${cv1.toFixed(3)}`,
            unit: ""
        },
        {
            step: 3,
            title: "Nominal Shear Strength",
            formula: "Vn = 0.6 × Fy × Aw × Cv1",
            substitution: `Vn = 0.6 × ${fy} × ${aw} × ${cv1.toFixed(3)} / 1000`,
            result: vn_kN.toFixed(2),
            unit: "kN"
        },
        {
            step: 4,
            title: "Design Strength",
            formula: isLRFD ? "φvVn = φv × Vn" : "Vn/Ωv = Vn / Ωv",
            substitution: isLRFD ? `${factor.toFixed(2)} × ${vn_kN.toFixed(2)}` : `${vn_kN.toFixed(2)} / ${factor.toFixed(2)}`,
            result: designStrength.toFixed(2),
            unit: "kN"
        },
        {
            step: 5,
            title: "Demand / Capacity Ratio",
            formula: isLRFD ? "D/C = Vux / φvVn" : "D/C = Vax / (Vn/Ωv)",
            substitution: `${vux} / ${designStrength.toFixed(2)}`,
            result: ratioVal.toFixed(3),
            unit: ""
        }
    ]
  };

  return { 
    majorAxisShear: calcObj,
    governingCapacity: designStrength,
    governingRatio: ratioVal,
    passed: status === "PASS"
  };
}
