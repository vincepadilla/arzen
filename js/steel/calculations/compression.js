// Compression capacity calculations (AISC 360 Chapter E)

function calculateEffectiveArea(state, fcr) {
    const ag = state.section.area;
    const fy = state.material.fy;
    const type = state.section.type;
    const E = state.material.E;
    
    let isSlender = false;
    let details = [];
    const elementsToEvaluate = [];
    
    if (['W', 'M', 'S', 'HP'].includes(type) || state.section.builtUpType === 'I-SECTION') {
        if (state.section.bf_2tf != null) {
            elementsToEvaluate.push({ name: 'Flange', b: state.section.bf / 2, t: state.section.tf, lambda: state.section.bf_2tf, lambda_r: 0.56 * Math.sqrt(E/fy), c1: 0.22, c2: 1.4854314511 });
        }
        if (state.section.h_tw != null) {
            elementsToEvaluate.push({ name: 'Web', b: state.section.d - 2*state.section.tf, t: state.section.tw, lambda: state.section.h_tw, lambda_r: 1.49 * Math.sqrt(E/fy), c1: 0.18, c2: 1.3079159383 });
        }
    } else if (['WT', 'MT', 'ST'].includes(type)) {
        if (state.section.bf_2tf != null) {
            elementsToEvaluate.push({ name: 'Flange', b: state.section.bf / 2, t: state.section.tf, lambda: state.section.bf_2tf, lambda_r: 0.56 * Math.sqrt(E/fy), c1: 0.22, c2: 1.4854314511 });
        }
        if (state.section.d_tw != null) {
            elementsToEvaluate.push({ name: 'Stem', b: state.section.d, t: state.section.tw, lambda: state.section.d_tw, lambda_r: 0.75 * Math.sqrt(E/fy), c1: 0.22, c2: 1.4854314511 });
        }
    } else if (['L'].includes(type)) {
        if (state.section.b_t != null) {
            elementsToEvaluate.push({ name: 'Leg', b: state.section.b, t: state.section.t, lambda: state.section.b_t, lambda_r: 0.45 * Math.sqrt(E/fy), c1: 0.22, c2: 1.4854314511 });
        }
    } else if (['DOUBLE_ANGLE', 'Double Angle'].includes(type)) {
        if (state.section.b_t != null) {
            elementsToEvaluate.push({ name: 'Leg', b: state.section.b, t: state.section.t, lambda: state.section.b_t, lambda_r: 0.45 * Math.sqrt(E/fy), c1: 0.22, c2: 1.4854314511 });
        }
    } else if (['HSS Square', 'HSS Rectangular', 'BOX'].includes(type)) {
        if (state.section.b_t != null) {
            elementsToEvaluate.push({ name: 'Wall', b: state.section.b, t: state.section.tdes || state.section.t, lambda: state.section.b_t, lambda_r: 1.40 * Math.sqrt(E/fy), c1: 0.20, c2: 1.38 });
        }
        if (state.section.h_t != null) {
            elementsToEvaluate.push({ name: 'Web', b: state.section.h, t: state.section.tdes || state.section.t, lambda: state.section.h_t, lambda_r: 1.40 * Math.sqrt(E/fy), c1: 0.20, c2: 1.38 });
        }
    }

    let totalIneffectiveArea = 0;
    
    for (let el of elementsToEvaluate) {
        const limit = el.lambda_r * Math.sqrt(fy / fcr);
        if (el.lambda > limit) {
            isSlender = true;
            const fel = fy * Math.pow((el.c2 * el.lambda_r) / el.lambda, 2);
            let be = el.b * Math.sqrt(fel / fcr) * (1 - el.c1 * Math.sqrt(fel / fcr));
            if (be > el.b) be = el.b;
            if (be < 0) be = 0;
            
            const widthLoss = el.b - be;
            let areaLoss = widthLoss * el.t;
            if (el.name === 'Flange' && ['W', 'M', 'S', 'HP'].includes(type)) areaLoss *= 4;
            if (el.name === 'Flange' && ['WT', 'MT', 'ST'].includes(type)) areaLoss *= 2;
            if (el.name === 'Wall' && ['HSS Square', 'HSS Rectangular', 'BOX'].includes(type)) areaLoss *= 2;
            if (el.name === 'Web' && ['HSS Square', 'HSS Rectangular', 'BOX'].includes(type)) areaLoss *= 2;
            if (type === 'DOUBLE_ANGLE' || type === 'Double Angle') areaLoss *= 2;
            
            totalIneffectiveArea += areaLoss;
            details.push(`Slender ${el.name}: b_e = ${be.toFixed(2)} mm`);
        } else {
            details.push(`Non-Slender ${el.name}`);
        }
    }
    
    let ae = ag - totalIneffectiveArea;
    if (ae < 0) ae = 0;
    
    return { Ae: ae, isSlender, totalIneffectiveArea, details };
}

export function checkCompression(state) {
  const isLRFD = state.designMethod === 'lrfd';
  const factor = isLRFD ? 0.90 : 1.67;
  const factorSymbol = isLRFD ? "\\phi_c" : "\\Omega_c";
  
  const fy = state.material.fy;
  const E = state.material.E;
  const ag = state.section.area;
  const rx = state.section.rx;
  const ry = state.section.ry;
  const type = state.section.type;
  
  const pu = state.loadPc || 0;
  
  const kx = state.Kx || 1.0;
  const ky = state.Ky || 1.0;
  const kz = state.Kz || 1.0;
  
  const lenMultiplier = state.lengthUnit === 'm' ? 1000 : 1;
  const lx = (state.unbracedLengthX ?? state.memberLength ?? 0) * lenMultiplier;
  const ly = (state.unbracedLengthY ?? state.memberLength ?? 0) * lenMultiplier;
  const lz = (state.unbracedLengthZ ?? state.memberLength ?? 0) * lenMultiplier;
  
  // Normal Slenderness
  let klrx = (kx * lx) / rx;
  let klry = (ky * ly) / ry;
  let klr = Math.max(klrx, klry);
  const govAxis = klrx > klry ? "x-axis" : "y-axis";
  
  // Double Angle Modified Slenderness
  let modifiedKlr = null;
  let builtUpAdjustmentApplied = false;
  if ((type === 'DOUBLE_ANGLE' || type === 'Double Angle') && state.builtUpCondition && state.builtUpCondition.applicable) {
      const a = state.builtUpCondition.a || 0; // connector spacing
      const ri = state.builtUpCondition.ri || 1; // individual angle ry
      const Ki = state.builtUpCondition.Ki || 0.50; // connector factor
      const aOverRi = a / ri;
      const modifiedKlrY = Math.sqrt(Math.pow(klry, 2) + Math.pow(Ki * aOverRi, 2));
      if (modifiedKlrY > klrx) {
          modifiedKlr = modifiedKlrY;
          klr = modifiedKlr;
          builtUpAdjustmentApplied = true;
      }
  }
  
  // 1. Flexural Buckling Limit State
  const fe_flexural = (Math.pow(Math.PI, 2) * E) / Math.pow(klr, 2);
  
  let fcr_flexural;
  let fcrFormula_flexural;
  let fcrSub_flexural;
  if ((fy / fe_flexural) <= 2.25) { 
    fcr_flexural = Math.pow(0.658, (fy / fe_flexural)) * fy;
    fcrFormula_flexural = "\\( F_{cr} = \\left[ 0.658^{\\frac{F_y}{F_e}} \\right] F_y \\)";
    fcrSub_flexural = `\\( F_{cr} = \\left[ 0.658^{\\frac{${fy}}{${fe_flexural.toFixed(2)}}} \\right] \\times ${fy} \\)`;
  } else {
    fcr_flexural = 0.877 * fe_flexural;
    fcrFormula_flexural = "\\( F_{cr} = 0.877 F_e \\)";
    fcrSub_flexural = `\\( F_{cr} = 0.877 \\times ${fe_flexural.toFixed(2)} \\)`;
  }
  
  const areaDataFlexural = calculateEffectiveArea(state, fcr_flexural);
  const ae_flexural = areaDataFlexural.Ae;
  const pn_flexural = fcr_flexural * ae_flexural / 1000;
  
  const flexuralBucklingObj = {
    limitState: "Flexural Buckling",
    codeReference: { standard: "AISC 360", chapter: "E", section: "E3", limitState: "Flexural Buckling" },
    formula: "\\( P_n = F_{cr} A_e \\)",
    variables: { Fcr: { symbol: "\\( F_{cr} \\)", value: fcr_flexural, unit: "MPa" }, Ae: { symbol: "\\( A_e \\)", value: ae_flexural, unit: "mm²" } },
    substitution: `\\( P_n = ${fcr_flexural.toFixed(2)} \\times ${ae_flexural.toFixed(2)} \\)`,
    calculation: `Pn = ${(fcr_flexural * ae_flexural).toLocaleString()} N`,
    result: { value: pn_flexural, unit: "kN" },
    resistanceFactor: { symbol: `\\( ${factorSymbol} \\)`, value: factor },
    designStrength: { formula: isLRFD ? "\\( \\phi_c P_n \\)" : "\\( P_n / \\Omega_c \\)", substitution: isLRFD ? `\\( ${factor} \\times ${pn_flexural.toFixed(2)} \\)` : `\\( \\frac{${pn_flexural.toFixed(2)}}{${factor}} \\)`, value: isLRFD ? (pn_flexural * factor) : (pn_flexural / factor), unit: "kN" },
    demand: { value: pu, unit: "kN" },
    ratio: { formula: isLRFD ? "\\( P_u / \\phi_c P_n \\)" : "\\( P_a / (P_n / \\Omega_c) \\)", substitution: `\\( \\frac{${pu}}{${(isLRFD ? (pn_flexural * factor) : (pn_flexural / factor)).toFixed(2)}} \\)`, value: pu / (isLRFD ? (pn_flexural * factor) : (pn_flexural / factor)) },
    status: (pu / (isLRFD ? (pn_flexural * factor) : (pn_flexural / factor))) <= 1.0 ? "PASS" : "FAIL",
    steps: [
        { step: 1, title: "Slenderness (KL/r)", formula: "max(KL/rx, KL/ry)", substitution: "", result: klr.toFixed(2), unit: "" },
        { step: 2, title: "Elastic Buckling Stress", formula: "Fe = (π² × E) / (KL/r)²", substitution: `Fe = (π² × ${E}) / (${klr.toFixed(2)})²`, result: fe_flexural.toFixed(2), unit: "MPa" },
        { step: 3, title: "Critical Stress", formula: fcrFormula_flexural, substitution: fcrSub_flexural, result: fcr_flexural.toFixed(2), unit: "MPa" },
        { step: 4, title: "Effective Area", formula: areaDataFlexural.isSlender ? "Ae < Ag (Slender Element)" : "Ae = Ag", substitution: areaDataFlexural.details.join(", "), result: ae_flexural.toFixed(2), unit: "mm²" }
    ]
  };
  
  const limitStatesList = [
      { name: 'Flexural Buckling', Pn: pn_flexural, obj: flexuralBucklingObj }
  ];

  // 2. Torsional / Flexural-Torsional Buckling Limit State
  let tfObj = null;
  let feTF = 0;
  let feTFFormula = "";
  let pn_TF = null;
  let fcrTF = null;
  let ae_TF = null;
  let areaDataTF = null;
  
  // --- NORMALIZED VARIABLES FOR TORSIONAL BUCKLING ---
  const E_MPa = E;
  const G_MPa = state.material.G || 77200;
  
  const Cw_mm6 = (state.section.Cw || 0) * 1e9;
  
  let tempJ = state.section.J || 0;
  if (tempJ < 10000) tempJ *= 1000;
  const J_mm4 = tempJ;
  
  const Ix_mm4 = (state.section.Ix || 0) * 1000000;
  const Iy_mm4 = (state.section.Iy || 0) * 1000000;
  
  const L_mm = kz * lz;

  const fey = (Math.pow(Math.PI, 2) * E_MPa) / Math.pow(klry, 2);
  
  let validTorsional = false;
  let ro = state.section.ro || Math.sqrt(rx*rx + ry*ry);
  let H = state.section.H || 1.0;
  
  if (['W', 'M', 'S', 'HP'].includes(type) || state.section.builtUpType === 'I-SECTION') {
      const piSquared = Math.pow(Math.PI, 2);
      const warpingTerm = (piSquared * E_MPa * Cw_mm6) / Math.pow(L_mm, 2);
      const torsionalTerm = G_MPa * J_mm4;
      const polarInertiaSum = Ix_mm4 + Iy_mm4;
      
      const FeTCheck = (warpingTerm + torsionalTerm) / polarInertiaSum;
      feTF = FeTCheck;
      
      feTFFormula = "W-Shape Torsional Buckling: FeT = [π²ECw/L² + GJ]/(Ix+Iy)";
      
      // Self-consistency check
      if (Math.abs(feTF - FeTCheck) >= 1e-9) {
          console.error("W torsional FeT inconsistency: displayed terms and calculated FeT do not match.");
      }
      
      validTorsional = true;
  } else if (['WT', 'MT', 'ST'].includes(type)) {
      if (state.section.ro && state.section.H) {
          const Lcz = kz * lz;
          const fez = ((Math.pow(Math.PI, 2) * E_MPa * Cw_mm6 / Math.pow(Lcz, 2)) + G_MPa * J_mm4) / (ag * ro * ro);
          const rootArg = 1 - (4 * fey * fez * H) / Math.pow(fey + fez, 2);
          const clampedRoot = rootArg < 0 && rootArg > -1e-6 ? 0 : rootArg;
          
          if (clampedRoot >= 0) {
              feTF = ((fey + fez) / (2 * H)) * (1 - Math.sqrt(clampedRoot));
              feTFFormula = "Tee Flexural-Torsional Buckling: FeTF";
              validTorsional = true;
          }
      }
  } else if (['L'].includes(type)) {
      if (state.section.ro && state.section.H) {
          const fez = (G_MPa * J_mm4) / (ag * ro * ro);
          const rootArg = 1 - (4 * fey * fez * H) / Math.pow(fey + fez, 2);
          const clampedRoot = rootArg < 0 && rootArg > -1e-6 ? 0 : rootArg;
          
          if (clampedRoot >= 0) {
              feTF = ((fey + fez) / (2 * H)) * (1 - Math.sqrt(clampedRoot));
              feTFFormula = "Angle Flexural-Torsional Buckling: FeTF";
              validTorsional = true;
          }
      }
  } else if (['DOUBLE_ANGLE', 'Double Angle'].includes(type)) {
      let doubleAngleJ = J_mm4;
      if (!doubleAngleJ) {
          const dPrime = state.section.d - 0.5 * state.section.t;
          const bPrime = state.section.b - 0.5 * state.section.t;
          doubleAngleJ = 2 * (dPrime + bPrime) * Math.pow(state.section.t, 3) / 3;
      }
      if (state.section.ro && state.section.H) {
          const fez = (G_MPa * doubleAngleJ) / (ag * ro * ro);
          const rootArg = 1 - (4 * fey * fez * H) / Math.pow(fey + fez, 2);
          const clampedRoot = rootArg < 0 && rootArg > -1e-6 ? 0 : rootArg;
          
          if (clampedRoot >= 0) {
              feTF = ((fey + fez) / (2 * H)) * (1 - Math.sqrt(clampedRoot));
              feTFFormula = "Double Angle Flexural-Torsional Buckling: FeTF";
              validTorsional = true;
          }
      }
  }
  
  if (validTorsional && feTF > 0) {
      if ((fy / feTF) <= 2.25) {
          fcrTF = Math.pow(0.658, (fy / feTF)) * fy;
      } else {
          fcrTF = 0.877 * feTF;
      }
      
      areaDataTF = calculateEffectiveArea(state, fcrTF);
      ae_TF = areaDataTF.Ae;
      pn_TF = (fcrTF * ae_TF) / 1000;
      
      tfObj = {
          limitState: "Torsional / Flexural-Torsional Buckling",
          codeReference: { standard: "AISC 360", chapter: "E", section: "E4", limitState: "Torsional/Flexural-Torsional Buckling" },
          formula: "\\( P_n = F_{cr} A_e \\)",
          variables: { Fcr: { symbol: "\\( F_{cr} \\)", value: fcrTF, unit: "MPa" }, Ae: { symbol: "\\( A_e \\)", value: ae_TF, unit: "mm²" } },
          substitution: `\\( P_n = ${fcrTF.toFixed(2)} \\times ${ae_TF.toFixed(2)} \\)`,
          calculation: `Pn = ${(fcrTF * ae_TF).toLocaleString()} N`,
          result: { value: pn_TF, unit: "kN" },
          resistanceFactor: { symbol: `\\( ${factorSymbol} \\)`, value: factor },
          designStrength: { formula: isLRFD ? "\\( \\phi_c P_n \\)" : "\\( P_n / \\Omega_c \\)", substitution: isLRFD ? `\\( ${factor} \\times ${pn_TF.toFixed(2)} \\)` : `\\( \\frac{${pn_TF.toFixed(2)}}{${factor}} \\)`, value: isLRFD ? (pn_TF * factor) : (pn_TF / factor), unit: "kN" },
          demand: { value: pu, unit: "kN" },
          ratio: { formula: isLRFD ? "\\( P_u / \\phi_c P_n \\)" : "\\( P_a / (P_n / \\Omega_c) \\)", substitution: `\\( \\frac{${pu}}{${(isLRFD ? (pn_TF * factor) : (pn_TF / factor)).toFixed(2)}} \\)`, value: pu / (isLRFD ? (pn_TF * factor) : (pn_TF / factor)) },
          status: (pu / (isLRFD ? (pn_TF * factor) : (pn_TF / factor))) <= 1.0 ? "PASS" : "FAIL",
          steps: [
              { step: 1, title: "Torsional Buckling Parameters", formula: "Cw used, J used, L used, Ix used, Iy used", substitution: "", result: `Cw=${Cw_mm6}, J=${J_mm4}, L=${L_mm}, Ix=${Ix_mm4}, Iy=${Iy_mm4}`, unit: "" },
              { step: 2, title: "Buckling Stress Formula", formula: feTFFormula, substitution: "", result: feTF.toFixed(2), unit: "MPa" },
              { step: 3, title: "Critical Stress", formula: "\\( F_{cr} \\)", substitution: "", result: fcrTF.toFixed(2), unit: "MPa" },
              { step: 4, title: "Effective Area", formula: areaDataTF.isSlender ? "Ae < Ag (Slender Element)" : "Ae = Ag", substitution: areaDataTF.details.join(", "), result: ae_TF.toFixed(2), unit: "mm²" }
          ]
      };
      
      limitStatesList.push({ name: 'Torsional / Flexural-Torsional Buckling', Pn: pn_TF, obj: tfObj });
  }

  // 3. Select Governing Limit State
  const governingItem = limitStatesList.reduce((min, item) => item.Pn < min.Pn ? item : min);
  const governingObj = governingItem.obj;

  return { 
    flexuralBuckling: flexuralBucklingObj,
    flexuralTorsionalBuckling: tfObj,
    governingLimitState: governingObj.limitState,
    governingCapacity: governingObj.designStrength.value,
    governingRatio: governingObj.ratio.value,
    passed: governingObj.status === "PASS"
  };
}
