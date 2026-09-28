// Shear capacity calculations (AISC 360 Chapter G)

function calculateShearCv({ lambda, kv, E, Fy }) {
  const limit1 = 1.10 * Math.sqrt((kv * E) / Fy);
  const limit2 = 1.37 * Math.sqrt((kv * E) / Fy);
  let Cv = 1.0;
  let region = 1;

  if (lambda <= limit1) {
    Cv = 1.0;
    region = 1;
  } else if (lambda <= limit2) {
    Cv = limit1 / lambda;
    region = 2;
  } else {
    Cv = (1.51 * kv * E) / (Math.pow(lambda, 2) * Fy);
    region = 3;
  }

  return { Cv, limit1, limit2, region };
}

function invalidResult(limitState, missingProp) {
  return {
    limitState: limitState,
    status: "INVALID",
    ratio: { value: 999.999 },
    designStrength: { value: 0 },
    steps: [{
      step: 1,
      title: "Missing Property",
      result: `SHEAR CHECK INVALID — MISSING PROPERTY: ${missingProp}`
    }]
  };
}

function buildResultObj(limitState, demand, Aw, lambda, kv, cvRes, Vn_N, factor, factorSymbol, isLRFD, formula, sub) {
  const vn_kN = Vn_N / 1000;
  const designStrength = isLRFD ? (vn_kN * factor) : (vn_kN / factor);
  const ratioVal = designStrength > 0 ? (demand / designStrength) : (demand > 0 ? 999.999 : 0);
  const status = ratioVal <= 1.0 ? "PASS" : "FAIL";

  let cvFormulaStr = "\\( C_v = 1.0 \\)";
  if (cvRes.region === 2) cvFormulaStr = "\\( C_v = \\frac{1.10\\sqrt{k_v E / F_y}}{h/t_w} \\)";
  if (cvRes.region === 3) cvFormulaStr = "\\( C_v = \\frac{1.51 k_v E}{(h/t_w)^2 F_y} \\)";

  return {
    limitState: limitState,
    codeReference: {
        standard: "NSCP 2015 / AISC 360-10",
        chapter: "G"
    },
    formula: formula || "\\( V_n = 0.6 F_y A_w C_v \\)",
    substitution: sub || `\\( V_n = 0.6 \\times F_y \\times ${Aw.toFixed(2)} \\times ${cvRes.Cv.toFixed(3)} \\)`,
    result: { value: vn_kN, unit: "kN" },
    designStrength: {
        value: designStrength,
        unit: "kN"
    },
    demand: { value: demand, unit: "kN" },
    ratio: { value: ratioVal },
    status: status,
    steps: [
        { step: 1, title: "Shear Area", result: `${Aw.toFixed(2)} mm²` },
        { step: 2, title: "Slenderness", result: `${lambda.toFixed(2)}` },
        { step: 3, title: "Shear Buckling Coefficient", formula: cvFormulaStr, result: `Cv = ${cvRes.Cv.toFixed(3)} (Region ${cvRes.region})` },
        { step: 4, title: "Nominal Shear Strength Vn", result: `${vn_kN.toFixed(2)} kN` },
        { step: 5, title: "Design Strength", formula: `${factorSymbol}Vn`, result: `${designStrength.toFixed(2)} kN` },
        { step: 6, title: "DCR", result: ratioVal.toFixed(3) }
    ]
  };
}

function calcIShapeMajor(sec, E, Fy, isLRFD, demand) {
  if (!sec.d) return invalidResult("Major Axis Shear", "d");
  if (!sec.tw) return invalidResult("Major Axis Shear", "tw");

  const d = sec.d;
  const tw = sec.tw;
  const h = sec.h || (d - 2 * (sec.tf || 0)); // fallback
  if (h <= 0) return invalidResult("Major Axis Shear", "h");

  const Aw = d * tw;
  const lambda = h / tw;
  const kv = 5.0; // Unstiffened web

  // AISC G2.1(a) special provision for rolled I-shapes
  const isRolled = !sec.isBuiltUp;
  const limitG21a = 2.24 * Math.sqrt(E / Fy);
  
  let factor = isLRFD ? 0.90 : 1.67;
  let factorSymbol = isLRFD ? "φv" : "Ωv";
  let cvRes = calculateShearCv({ lambda, kv, E, Fy });

  if (isRolled && lambda <= limitG21a) {
    factor = isLRFD ? 1.00 : 1.50;
    cvRes.Cv = 1.0;
    cvRes.region = 1;
  }

  const Vn_N = 0.6 * Fy * Aw * cvRes.Cv;
  return buildResultObj("Major Axis Shear (G2)", demand, Aw, lambda, kv, cvRes, Vn_N, factor, factorSymbol, isLRFD);
}

function calcIShapeMinor(sec, E, Fy, isLRFD, demand) {
  if (!sec.bf) return invalidResult("Minor Axis Shear", "bf");
  if (!sec.tf) return invalidResult("Minor Axis Shear", "tf");

  const bf = sec.bf;
  const tf = sec.tf;
  
  const Aw = 2 * bf * tf;
  const lambda = bf / (2 * tf);
  const kv = 1.2; // Weak axis shear typical assumption for flanges without stiffeners

  const cvRes = calculateShearCv({ lambda, kv, E, Fy });
  const Vn_N = 0.6 * Fy * Aw * cvRes.Cv;
  
  const factor = isLRFD ? 0.90 : 1.67;
  const factorSymbol = isLRFD ? "φv" : "Ωv";

  return buildResultObj("Minor Axis Shear (G6)", demand, Aw, lambda, kv, cvRes, Vn_N, factor, factorSymbol, isLRFD);
}

function calcChannelMajor(sec, E, Fy, isLRFD, demand) {
  if (!sec.d) return invalidResult("Major Axis Shear", "d");
  if (!sec.tw) return invalidResult("Major Axis Shear", "tw");

  const d = sec.d;
  const tw = sec.tw;
  const h = sec.h || (d - 2 * (sec.tf || 0));
  
  const Aw = d * tw;
  const lambda = h / tw;
  const kv = 5.0;

  const cvRes = calculateShearCv({ lambda, kv, E, Fy });
  const Vn_N = 0.6 * Fy * Aw * cvRes.Cv;
  const factor = isLRFD ? 0.90 : 1.67;
  const factorSymbol = isLRFD ? "φv" : "Ωv";

  return buildResultObj("Major Axis Shear (G2)", demand, Aw, lambda, kv, cvRes, Vn_N, factor, factorSymbol, isLRFD);
}

function calcChannelMinor(sec, E, Fy, isLRFD, demand) {
  if (!sec.bf) return invalidResult("Minor Axis Shear", "bf");
  if (!sec.tf) return invalidResult("Minor Axis Shear", "tf");

  const Aw = 2 * sec.bf * sec.tf;
  const lambda = sec.bf / sec.tf;
  const kv = 1.2;

  const cvRes = calculateShearCv({ lambda, kv, E, Fy });
  const Vn_N = 0.6 * Fy * Aw * cvRes.Cv;
  const factor = isLRFD ? 0.90 : 1.67;
  const factorSymbol = isLRFD ? "φv" : "Ωv";

  return buildResultObj("Minor Axis Shear (G6)", demand, Aw, lambda, kv, cvRes, Vn_N, factor, factorSymbol, isLRFD);
}

function calcTeeMajor(sec, E, Fy, isLRFD, demand) {
  if (!sec.d) return invalidResult("Major Axis Shear", "d");
  if (!sec.tw) return invalidResult("Major Axis Shear", "tw");
  if (!sec.tf) return invalidResult("Major Axis Shear", "tf");

  const d = sec.d;
  const tw = sec.tw;
  const tf = sec.tf;
  const stemDepth = d - tf;
  
  const Aw = d * tw; // G4 states Aw = d * tw for tees
  const lambda = stemDepth / tw;
  const kv = 1.2; // AISC G4

  const cvRes = calculateShearCv({ lambda, kv, E, Fy });
  const Vn_N = 0.6 * Fy * Aw * cvRes.Cv;
  const factor = isLRFD ? 0.90 : 1.67;
  const factorSymbol = isLRFD ? "φv" : "Ωv";

  return buildResultObj("Major Axis Shear (G4)", demand, Aw, lambda, kv, cvRes, Vn_N, factor, factorSymbol, isLRFD);
}

function calcTeeMinor(sec, E, Fy, isLRFD, demand) {
  if (!sec.bf) return invalidResult("Minor Axis Shear", "bf");
  if (!sec.tf) return invalidResult("Minor Axis Shear", "tf");

  const Aw = sec.bf * sec.tf;
  const lambda = sec.bf / (2 * sec.tf);
  const kv = 1.2;

  const cvRes = calculateShearCv({ lambda, kv, E, Fy });
  const Vn_N = 0.6 * Fy * Aw * cvRes.Cv;
  const factor = isLRFD ? 0.90 : 1.67;
  const factorSymbol = isLRFD ? "φv" : "Ωv";

  return buildResultObj("Minor Axis Shear (G6)", demand, Aw, lambda, kv, cvRes, Vn_N, factor, factorSymbol, isLRFD);
}

function calcAngleMajor(sec, E, Fy, isLRFD, demand) {
  // Assume Major Axis shear is along the vertical leg (d)
  if (!sec.d) return invalidResult("Major Axis Shear", "d");
  if (!sec.t && !sec.tw) return invalidResult("Major Axis Shear", "t");

  const t = sec.t || sec.tw;
  const d = sec.d;
  
  const Aw = d * t;
  const lambda = d / t;
  const kv = 1.2; // AISC G4

  const cvRes = calculateShearCv({ lambda, kv, E, Fy });
  const Vn_N = 0.6 * Fy * Aw * cvRes.Cv;
  const factor = isLRFD ? 0.90 : 1.67;
  const factorSymbol = isLRFD ? "φv" : "Ωv";

  return buildResultObj("Major Axis Shear (G4)", demand, Aw, lambda, kv, cvRes, Vn_N, factor, factorSymbol, isLRFD);
}

function calcAngleMinor(sec, E, Fy, isLRFD, demand) {
  // Assume Minor Axis shear is along the horizontal leg (b)
  if (!sec.b && !sec.bf) return invalidResult("Minor Axis Shear", "b");
  if (!sec.t && !sec.tw) return invalidResult("Minor Axis Shear", "t");

  const t = sec.t || sec.tw;
  const b = sec.b || sec.bf;
  
  const Aw = b * t;
  const lambda = b / t;
  const kv = 1.2; // AISC G4

  const cvRes = calculateShearCv({ lambda, kv, E, Fy });
  const Vn_N = 0.6 * Fy * Aw * cvRes.Cv;
  const factor = isLRFD ? 0.90 : 1.67;
  const factorSymbol = isLRFD ? "φv" : "Ωv";

  return buildResultObj("Minor Axis Shear (G4)", demand, Aw, lambda, kv, cvRes, Vn_N, factor, factorSymbol, isLRFD);
}

function calcDoubleAngleMajor(sec, E, Fy, isLRFD, demand) {
  // Along the two vertical legs
  if (!sec.d) return invalidResult("Major Axis Shear", "d");
  if (!sec.t && !sec.tw) return invalidResult("Major Axis Shear", "t");

  const t = sec.t || sec.tw;
  const d = sec.d;
  
  const Aw = 2 * (d * t);
  const lambda = d / t;
  const kv = 1.2;

  const cvRes = calculateShearCv({ lambda, kv, E, Fy });
  const Vn_N = 0.6 * Fy * Aw * cvRes.Cv;
  const factor = isLRFD ? 0.90 : 1.67;
  const factorSymbol = isLRFD ? "φv" : "Ωv";

  return buildResultObj("Major Axis Shear (G4)", demand, Aw, lambda, kv, cvRes, Vn_N, factor, factorSymbol, isLRFD);
}

function calcDoubleAngleMinor(sec, E, Fy, isLRFD, demand) {
  // Along the two horizontal legs
  if (!sec.b && !sec.bf) return invalidResult("Minor Axis Shear", "b");
  if (!sec.t && !sec.tw) return invalidResult("Minor Axis Shear", "t");

  const t = sec.t || sec.tw;
  let b = sec.b || sec.bf;
  if (sec.isBuiltUp) {
     b = (sec.b || sec.bf || 0); // single leg width
  } else {
     // DB double angle might have bf as total width including gap, 
     // or just single leg b. Usually b is single leg.
     if (!sec.b) b = sec.bf;
  }
  
  const Aw = 2 * (b * t);
  const lambda = b / t;
  const kv = 1.2;

  const cvRes = calculateShearCv({ lambda, kv, E, Fy });
  const Vn_N = 0.6 * Fy * Aw * cvRes.Cv;
  const factor = isLRFD ? 0.90 : 1.67;
  const factorSymbol = isLRFD ? "φv" : "Ωv";

  return buildResultObj("Minor Axis Shear (G4)", demand, Aw, lambda, kv, cvRes, Vn_N, factor, factorSymbol, isLRFD);
}

function calcHSSMajor(sec, E, Fy, isLRFD, demand) {
  if (!sec.H && !sec.d) return invalidResult("Major Axis Shear", "H");
  if (!sec.tdes && !sec.t && !sec.tw) return invalidResult("Major Axis Shear", "t");

  const H = sec.H || sec.d;
  const t = sec.tdes || sec.t || sec.tw;
  const h = H - 3 * t; // AISC B4.1b clear distance
  
  const Aw = 2 * H * t; // G5
  const lambda = h / t;
  const kv = 5.0; // G5

  const cvRes = calculateShearCv({ lambda, kv, E, Fy });
  const Vn_N = 0.6 * Fy * Aw * cvRes.Cv;
  const factor = isLRFD ? 0.90 : 1.67;
  const factorSymbol = isLRFD ? "φv" : "Ωv";

  return buildResultObj("Major Axis Shear (G5)", demand, Aw, lambda, kv, cvRes, Vn_N, factor, factorSymbol, isLRFD);
}

function calcHSSMinor(sec, E, Fy, isLRFD, demand) {
  if (!sec.B && !sec.b && !sec.bf) return invalidResult("Minor Axis Shear", "B");
  if (!sec.tdes && !sec.t && !sec.tw) return invalidResult("Minor Axis Shear", "t");

  const B = sec.B || sec.b || sec.bf;
  const t = sec.tdes || sec.t || sec.tw;
  const b = B - 3 * t; // clear distance
  
  const Aw = 2 * B * t;
  const lambda = b / t;
  const kv = 5.0;

  const cvRes = calculateShearCv({ lambda, kv, E, Fy });
  const Vn_N = 0.6 * Fy * Aw * cvRes.Cv;
  const factor = isLRFD ? 0.90 : 1.67;
  const factorSymbol = isLRFD ? "φv" : "Ωv";

  return buildResultObj("Minor Axis Shear (G5)", demand, Aw, lambda, kv, cvRes, Vn_N, factor, factorSymbol, isLRFD);
}

function calcRoundHSS(sec, E, Fy, isLRFD, demand, Lv) {
  const D = sec.OD || sec.d || sec.H;
  const t = sec.tdes || sec.t || sec.tw;

  if (!D) return invalidResult("Shear", "OD");
  if (!t) return invalidResult("Shear", "t");

  const Ag = Math.PI * (Math.pow(D, 2) - Math.pow(D - 2*t, 2)) / 4;
  const Aw = Ag / 2; // G6
  
  const Lv_D = Lv / D;
  const D_t = D / t;

  let Fcr1 = 1.60 * E / (Math.sqrt(Lv_D) * Math.pow(D_t, 1.25));
  let Fcr2 = 0.78 * E / Math.pow(D_t, 1.5);
  
  let Fcr = Math.max(Fcr1, Fcr2);
  if (Fcr > 0.6 * Fy) {
    Fcr = 0.6 * Fy;
  }

  const Vn_N = Fcr * Aw;
  const factor = isLRFD ? 0.90 : 1.67;
  const factorSymbol = isLRFD ? "φv" : "Ωv";

  const vn_kN = Vn_N / 1000;
  const designStrength = isLRFD ? (vn_kN * factor) : (vn_kN / factor);
  const ratioVal = designStrength > 0 ? (demand / designStrength) : (demand > 0 ? 999.999 : 0);
  const status = ratioVal <= 1.0 ? "PASS" : "FAIL";

  return {
    limitState: "Shear (G6)",
    codeReference: {
        standard: "NSCP 2015 / AISC 360-10",
        chapter: "G"
    },
    formula: "\\( V_n = F_{cr} A_g / 2 \\)",
    substitution: `\\( V_n = ${Fcr.toFixed(2)} \\times ${Aw.toFixed(2)} \\)`,
    result: { value: vn_kN, unit: "kN" },
    designStrength: {
        value: designStrength,
        unit: "kN"
    },
    demand: { value: demand, unit: "kN" },
    ratio: { value: ratioVal },
    status: status,
    steps: [
        { step: 1, title: "Slenderness", result: `D/t = ${D_t.toFixed(2)}, Lv/D = ${Lv_D.toFixed(2)}` },
        { step: 2, title: "Critical Stress Fcr", result: `${Fcr.toFixed(2)} MPa` },
        { step: 3, title: "Nominal Shear Strength Vn", result: `${vn_kN.toFixed(2)} kN` },
        { step: 4, title: "Design Strength", formula: `${factorSymbol}Vn`, result: `${designStrength.toFixed(2)} kN` },
        { step: 5, title: "DCR", result: ratioVal.toFixed(3) }
    ]
  };
}

export function checkShear(state) {
  const isLRFD = state.designMethod === 'lrfd';
  const fy = state.material.fy;
  const E = state.material.E;
  const vux = Math.abs(state.loadVux || 0); // major-axis shear
  const vuy = Math.abs(state.loadVuy || 0); // minor-axis shear
  const lv = state.loadLv || state.memberLength || 1000; // avoid 0
  
  const sec = state.section;
  
  let family = sec.isBuiltUp ? sec.builtUpType : (sec.type || (sec.designation ? sec.designation.split(/[^a-zA-Z]/)[0] : 'I-SECTION'));
  
  const getCanonicalType = (t) => {
    if (['W', 'M', 'HP', 'S', 'I-SECTION', 'PLATE-GIRDER'].includes(t)) return 'I';
    if (['C', 'MC', 'BU-CHANNEL', 'CHANNEL'].includes(t)) return 'C';
    if (['L', 'SINGLE-ANGLE'].includes(t)) return 'L';
    if (['2L', 'DOUBLE_ANGLE', 'Double Angle', 'DOUBLE-ANGLE'].includes(t)) return '2L';
    if (['WT', 'MT', 'ST', 'BU-TEE', 'TEE'].includes(t)) return 'T';
    if (['HSS', 'BOX', 'SQUARE-HSS', 'RECT-HSS'].includes(t)) return 'HSS';
    if (['ROUND-HSS', 'PIPE'].includes(t) || sec.OD) return 'ROUND-HSS';
    return 'I';
  };

  const canonical = getCanonicalType(family);
  let majorAxisShear = null;
  let minorAxisShear = null;

  if (canonical === 'I') {
     majorAxisShear = calcIShapeMajor(sec, E, fy, isLRFD, vux);
     minorAxisShear = calcIShapeMinor(sec, E, fy, isLRFD, vuy);
  } else if (canonical === 'C') {
     majorAxisShear = calcChannelMajor(sec, E, fy, isLRFD, vux);
     minorAxisShear = calcChannelMinor(sec, E, fy, isLRFD, vuy);
  } else if (canonical === 'T') {
     majorAxisShear = calcTeeMajor(sec, E, fy, isLRFD, vux);
     minorAxisShear = calcTeeMinor(sec, E, fy, isLRFD, vuy);
  } else if (canonical === 'L') {
     majorAxisShear = calcAngleMajor(sec, E, fy, isLRFD, vux);
     minorAxisShear = calcAngleMinor(sec, E, fy, isLRFD, vuy);
  } else if (canonical === '2L') {
     majorAxisShear = calcDoubleAngleMajor(sec, E, fy, isLRFD, vux);
     minorAxisShear = calcDoubleAngleMinor(sec, E, fy, isLRFD, vuy);
  } else if (canonical === 'HSS') {
     majorAxisShear = calcHSSMajor(sec, E, fy, isLRFD, vux);
     minorAxisShear = calcHSSMinor(sec, E, fy, isLRFD, vuy);
  } else if (canonical === 'ROUND-HSS') {
     majorAxisShear = calcRoundHSS(sec, E, fy, isLRFD, vux, lv);
     minorAxisShear = calcRoundHSS(sec, E, fy, isLRFD, vuy, lv);
  }

  let governingRatio = 0;
  let governingCapacity = 0;
  let hasFailed = false;

  if (majorAxisShear && majorAxisShear.ratio) {
     if (majorAxisShear.ratio.value > governingRatio) {
        governingRatio = majorAxisShear.ratio.value;
        governingCapacity = majorAxisShear.designStrength.value;
     }
     if (majorAxisShear.status === "FAIL" || majorAxisShear.status === "INVALID") hasFailed = true;
  }
  
  if (minorAxisShear && minorAxisShear.ratio) {
     if (minorAxisShear.ratio.value > governingRatio) {
        governingRatio = minorAxisShear.ratio.value;
        governingCapacity = minorAxisShear.designStrength.value;
     }
     if (minorAxisShear.status === "FAIL" || minorAxisShear.status === "INVALID") hasFailed = true;
  }

  return {
     majorAxisShear,
     minorAxisShear,
     governingCapacity,
     governingRatio,
     passed: !hasFailed && governingRatio <= 1.0
  };
}
