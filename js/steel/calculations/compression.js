// Compression capacity calculations (AISC 360 Chapter E)
export function checkCompression(state) {
  const isLRFD = state.designMethod === 'lrfd';
  const factor = isLRFD ? 0.90 : 1.67;
  const factorSymbol = isLRFD ? "\\phi_c" : "\\Omega_c";
  
  const fy = state.material.fy;
  const E = state.material.E;
  const ag = state.section.area;
  const rx = state.section.rx;
  const ry = state.section.ry;
  
  const pu = state.loadPu || 0;
  
  const kx = state.Kx || 1.0;
  const ky = state.Ky || 1.0;
  
  // Convert length to mm
  const lenMultiplier = state.lengthUnit === 'm' ? 1000 : 1;
  const lx = (state.unbracedLengthX ?? state.memberLength ?? 0) * lenMultiplier;
  const ly = (state.unbracedLengthY ?? state.memberLength ?? 0) * lenMultiplier;
  
  // Slenderness
  const klrx = (kx * lx) / rx;
  const klry = (ky * ly) / ry;
  const klr = Math.max(klrx, klry);
  const govAxis = klrx > klry ? "x-axis" : "y-axis";
  
  // Elastic Buckling Stress (Fe)
  const fe = (Math.PI * Math.PI * E) / (klr * klr);
  
  // Critical Stress (Fcr)
  const slendernessLimit = 4.71 * Math.sqrt(E / fy);
  let fcr;
  let fcrFormula;
  let fcrSub;
  if (klr <= slendernessLimit) {
    fcr = Math.pow(0.658, (fy / fe)) * fy;
    fcrFormula = "\\( F_{cr} = \\left[ 0.658^{\\frac{F_y}{F_e}} \\right] F_y \\)";
    fcrSub = `\\( F_{cr} = \\left[ 0.658^{\\frac{${fy}}{${fe.toFixed(2)}}} \\right] \\times ${fy} \\)`;
  } else {
    fcr = 0.877 * fe;
    fcrFormula = "\\( F_{cr} = 0.877 F_e \\)";
    fcrSub = `\\( F_{cr} = 0.877 \\times ${fe.toFixed(2)} \\)`;
  }
  
  // Nominal Strength (Pn)
  const pn_N = fcr * ag;
  const pn_kN = pn_N / 1000;
  
  // Design Strength
  const designStrength = isLRFD ? (pn_kN * factor) : (pn_kN / factor);
  const ratioVal = designStrength > 0 ? (pu / designStrength) : (pu > 0 ? 999.999 : 0);
  const status = ratioVal <= 1.0 ? "PASS" : "FAIL";

  const calcObj = {
    limitState: "Flexural Buckling",
    codeReference: {
        standard: state.designCode === 'nscp2015-aisc360-10' ? "NSCP 2015 / AISC 360-10" : "AISC 360",
        chapter: "E",
        section: "E3",
        limitState: "Flexural Buckling"
    },
    formula: "\\( P_n = F_{cr} A_g \\)",
    variables: {
        Fcr: { symbol: "\\( F_{cr} \\)", value: Number(fcr.toFixed(2)), unit: "MPa" },
        Ag: { symbol: "\\( A_g \\)", value: ag, unit: "mm²" }
    },
    substitution: `\\( P_n = ${fcr.toFixed(2)} \\times ${ag} \\)`,
    calculation: `Pn = ${pn_N.toLocaleString()} N`,
    result: { value: pn_kN, unit: "kN" },
    resistanceFactor: { symbol: `\\( ${factorSymbol} \\)`, value: factor },
    designStrength: {
        formula: isLRFD ? "\\( \\phi_c P_n \\)" : "\\( P_n / \\Omega_c \\)",
        substitution: isLRFD ? `\\( ${factor} \\times ${pn_kN.toFixed(2)} \\)` : `\\( \\frac{${pn_kN.toFixed(2)}}{${factor}} \\)`,
        value: Number(designStrength.toFixed(2)),
        unit: "kN"
    },
    demand: { value: pu, unit: "kN" },
    ratio: {
        formula: isLRFD ? "\\( P_u / \\phi_c P_n \\)" : "\\( P_a / (P_n / \\Omega_c) \\)",
        substitution: `\\( \\frac{${pu}}{${designStrength.toFixed(2)}} \\)`,
        value: Number(ratioVal.toFixed(3))
    },
    status: status,
    steps: [
        {
            step: 1,
            title: "Section Properties & Material",
            formula: "Ag, rx, ry, Fy, E",
            substitution: `Ag=${ag}, rx=${rx}, ry=${ry}, Fy=${fy}, E=${E}`,
            result: `Ag = ${ag} mm²`,
            unit: ""
        },
        {
            step: 2,
            title: "Effective Length & Slenderness",
            formula: "KL/r = K × L / r",
            substitution: `KL/rx = ${kx} × ${lx} / ${rx}\nKL/ry = ${ky} × ${ly} / ${ry}`,
            result: `KL/rx = ${klrx.toFixed(2)}\nKL/ry = ${klry.toFixed(2)}\nGoverns: ${govAxis} (KL/r = ${klr.toFixed(2)})`,
            unit: ""
        },
        {
            step: 3,
            title: "Elastic Buckling Stress",
            formula: "Fe = (π² × E) / (KL/r)²",
            substitution: `Fe = (π² × ${E}) / (${klr.toFixed(2)})²`,
            result: fe.toFixed(2),
            unit: "MPa"
        },
        {
            step: 4,
            title: "Critical Stress",
            formula: fcrFormula,
            substitution: fcrSub,
            result: fcr.toFixed(2),
            unit: "MPa"
        },
        {
            step: 5,
            title: "Nominal Compressive Strength",
            formula: "Pn = Fcr × Ag",
            substitution: `Pn = ${fcr.toFixed(2)} × ${ag} / 1000`,
            result: pn_kN.toFixed(2),
            unit: "kN"
        },
        {
            step: 6,
            title: "Design Strength",
            formula: isLRFD ? "φcPn = φc × Pn" : "Pn/Ωc = Pn / Ωc",
            substitution: isLRFD ? `${factor} × ${pn_kN.toFixed(2)}` : `${pn_kN.toFixed(2)} / ${factor}`,
            result: designStrength.toFixed(2),
            unit: "kN"
        },
        {
            step: 7,
            title: "Demand / Capacity Ratio",
            formula: isLRFD ? "D/C = Pu / φcPn" : "D/C = Pa / (Pn/Ωc)",
            substitution: `${pu} / ${designStrength.toFixed(2)}`,
            result: ratioVal.toFixed(3),
            unit: ""
        }
    ]
  };

  return { 
    flexuralBuckling: calcObj,
    governingCapacity: designStrength,
    governingRatio: ratioVal,
    passed: status === "PASS"
  };
}
