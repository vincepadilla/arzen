// Interaction (combined loads) capacity calculations (AISC 360 Chapter H)
export function checkInteraction(state, tensionResult, compressionResult, flexureResult, shearResult) {
  const isLRFD = state.designMethod === 'lrfd';
  
  // Demands
  const pr = state.loadPu || 0; // Axial Demand
  const mrx = state.loadMux || 0; // Major-axis Moment Demand
  const mry = state.loadMuy || 0; // Minor-axis Moment Demand
  
  // Capacities (fallback to 1.0 to prevent division by zero if missing)
  // Determine if axial load is tension or compression. For simplicity, we use compression capacity if passed, else tension.
  let pc = 1.0; 
  let pcLabel = "Pc";
  if (compressionResult && compressionResult.governingCapacity) {
    pc = compressionResult.governingCapacity;
    pcLabel = isLRFD ? "φcPn" : "Pn/Ωc";
  } else if (tensionResult && tensionResult.governingCapacity) {
    pc = tensionResult.governingCapacity;
    pcLabel = isLRFD ? "φtPn" : "Pn/Ωt";
  }
  
  const mcx = (flexureResult && flexureResult.governingCapacity) ? flexureResult.governingCapacity : 1.0;
  const mcxLabel = isLRFD ? "φbMnx" : "Mnx/Ωb";

  // Minor-axis Capacity (Yielding - AISC F6)
  const fy = state.material.fy || 1;
  const zy_mm3 = (state.section.Zy || 0) * 1000;
  const sy_mm3 = (state.section.Sy || 0) * 1000;
  
  let mny_kNm = (fy * zy_mm3) / 1000000;
  const mny_limit = (1.6 * fy * sy_mm3) / 1000000;
  if (mny_kNm > mny_limit && mny_limit > 0) mny_kNm = mny_limit;
  
  const factor = isLRFD ? 0.90 : 1.67;
  let mcy = isLRFD ? (mny_kNm * factor) : (mny_kNm / factor);
  if (isNaN(mcy) || !isFinite(mcy) || mcy <= 0) mcy = 1.0; // Prevent div by zero
  const mcyLabel = isLRFD ? "φbMny" : "Mny/Ωb";
  
  // Ratios (safe division)
  const axialRatio = pc > 0 ? (pr / pc) : (pr > 0 ? 999.999 : 0);
  const mxRatio = mcx > 0 ? (mrx / mcx) : (mrx > 0 ? 999.999 : 0);
  const myRatio = mcy > 0 ? (mry / mcy) : (mry > 0 ? 999.999 : 0);
  
  // AISC H1-1 Equations
  let eq = "";
  let sub = "";
  let interactionVal = 0;
  
  if (axialRatio >= 0.2) {
    eq = "\\( \\frac{P_r}{P_c} + \\frac{8}{9} \\left( \\frac{M_{rx}}{M_{cx}} + \\frac{M_{ry}}{M_{cy}} \\right) \\le 1.0 \\)";
    sub = `\\( ${axialRatio.toFixed(3)} + \\frac{8}{9} \\left( ${mxRatio.toFixed(3)} + ${myRatio.toFixed(3)} \\right) \\)`;
    interactionVal = axialRatio + (8.0/9.0) * (mxRatio + myRatio);
  } else {
    eq = "\\( \\frac{P_r}{2P_c} + \\left( \\frac{M_{rx}}{M_{cx}} + \\frac{M_{ry}}{M_{cy}} \\right) \\le 1.0 \\)";
    sub = `\\( \\frac{${pr}}{2 \\times ${pc.toFixed(2)}} + \\left( ${mxRatio.toFixed(3)} + ${myRatio.toFixed(3)} \\right) \\)`;
    interactionVal = (axialRatio / 2.0) + (mxRatio + myRatio);
  }
  
  const status = interactionVal <= 1.0 ? "PASS" : "FAIL";

  const calcObj = {
    limitState: "Axial-Flexure Interaction",
    codeReference: {
        standard: state.designCode === 'nscp2015-aisc360-10' ? "NSCP 2015 / AISC 360-10" : "AISC 360",
        chapter: "H",
        section: "H1",
        limitState: "Axial-Flexure Interaction"
    },
    formula: eq,
    variables: {
        Pr: { symbol: "\\( P_r \\)", value: pr, unit: "kN" },
        Pc: { symbol: `\\( ${pcLabel.replace('φ', '\\phi ').replace('Ω', '\\Omega ')} \\)`, value: Number(pc.toFixed(2)), unit: "kN" },
        Mrx: { symbol: "\\( M_{rx} \\)", value: mrx, unit: "kN-m" },
        Mcx: { symbol: `\\( ${mcxLabel.replace('φ', '\\phi ').replace('Ω', '\\Omega ')} \\)`, value: Number(mcx.toFixed(2)), unit: "kN-m" },
        Mry: { symbol: "\\( M_{ry} \\)", value: mry, unit: "kN-m" },
        Mcy: { symbol: `\\( ${mcyLabel.replace('φ', '\\phi ').replace('Ω', '\\Omega ')} \\)`, value: Number(mcy.toFixed(2)), unit: "kN-m" }
    },
    substitution: sub,
    calculation: `Interaction Ratio = ${interactionVal.toFixed(3)}`,
    result: { value: Number(interactionVal.toFixed(3)), unit: "" },
    resistanceFactor: { symbol: "", value: null },
    designStrength: {
        formula: "Allowable Limit",
        substitution: "1.0",
        value: 1.0,
        unit: ""
    },
    demand: { value: Number(interactionVal.toFixed(3)), unit: "" },
    ratio: {
        formula: "Interaction Ratio",
        substitution: sub,
        value: Number(interactionVal.toFixed(3))
    },
    status: status,
    steps: [
        {
            step: 1,
            title: "Axial Demand vs Capacity",
            formula: `Pr / ${pcLabel}`,
            substitution: `${pr} / ${pc.toFixed(2)}`,
            result: axialRatio.toFixed(3),
            unit: ""
        },
        {
            step: 2,
            title: "Major-Axis Flexure Ratio",
            formula: `Mrx / ${mcxLabel}`,
            substitution: `${mrx} / ${mcx.toFixed(2)}`,
            result: mxRatio.toFixed(3),
            unit: ""
        },
        {
            step: 3,
            title: "Minor-Axis Flexure Ratio",
            formula: `Mry / ${mcyLabel}`,
            substitution: `${mry} / ${mcy.toFixed(2)}`,
            result: myRatio.toFixed(3),
            unit: ""
        },
        {
            step: 4,
            title: "Determine Applicable Equation",
            formula: `Pr / ${pcLabel} vs 0.2`,
            substitution: `${axialRatio.toFixed(3)} ${axialRatio >= 0.2 ? '≥' : '<'} 0.2`,
            result: axialRatio >= 0.2 ? "Use Eq. H1-1a" : "Use Eq. H1-1b",
            unit: ""
        },
        {
            step: 5,
            title: "Interaction Ratio",
            formula: eq,
            substitution: sub,
            result: interactionVal.toFixed(3),
            unit: ""
        }
    ]
  };

  return { 
    combinedForces: calcObj,
    governingRatio: interactionVal,
    passed: status === "PASS"
  };
}
