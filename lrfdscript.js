function getRebarArea(dia) {
  return Math.PI * Math.pow(dia, 2) / 4;
}

/**
 * ACI 318-14 §18.6.5 — Probable Moment Strength
 * Uses 1.25fy (probable yield) and φ = 1.0
 */
function computeMpr(As_mm2, fy, fc, b, d) {
  if (As_mm2 <= 0 || d <= 0) return 0;
  const fy_pr = 1.25 * fy;
  const a = (As_mm2 * fy_pr) / (0.85 * fc * b);
  return As_mm2 * fy_pr * (d - a / 2) / 1e6; // kN·m, φ = 1.0
}

function calculateFlexureLayers(Mu_kNm, b, h, cover, fc, fyMain, diaMain, diaWeb, beamType, maxAgg) {
  if (Mu_kNm <= 0) return { As: 0, nBars: 0, layers: [], d: h - cover - diaWeb - diaMain / 2, txt: "0", doubly: false, rho: 0, details: "" };

  const phiFlex = 0.90;
  const Mu = Mu_kNm * 1e6;
  const mainBarArea = getRebarArea(diaMain);
  const minClearSpacing = Math.max(25, diaMain, (4/3) * maxAgg);
  const b_clear = b - 2 * (cover + diaWeb);

  let numLayers = 1;
  let d = h - cover - diaWeb - diaMain / 2;
  let As = 0, nBars = 0;
  let rho = 0, As_req = 0, As_min = 0;
  let details = "";

  details += `<p class="calc-step">&nbsp;&nbsp;Initial assumption: 1 layer, d = ${d.toFixed(1)} mm</p>`;

  while (numLayers <= 5) {
    const Rn = Mu / (phiFlex * b * Math.pow(d, 2));
    const inner = 1 - (2 * Rn) / (0.85 * fc);
    if (inner < 0) {
      details += `<p class="calc-step" style="color:#e74c3c;">&nbsp;&nbsp;<strong>Requires Doubly Reinforced Design</strong> (Rn too high for ${numLayers} layers, d=${d.toFixed(1)})</p>`;
      return { As: 0, nBars: 0, layers: [], d, txt: "Doubly Reinf.", doubly: true, rho: 0, details };
    }

    rho = (0.85 * fc / fyMain) * (1 - Math.sqrt(inner));
    const As_min1 = (Math.sqrt(fc) / (4 * fyMain)) * b * d;
    const As_min2 = (1.4 / fyMain) * b * d;
    As_min = Math.max(As_min1, As_min2);
    As_req = rho * b * d;
    As = Math.max(As_req, As_min);
    nBars = Math.ceil(As / mainBarArea);

    let maxBarsPerLayer = Math.floor((b_clear + minClearSpacing) / (diaMain + minClearSpacing));
    if (maxBarsPerLayer < 2) maxBarsPerLayer = 2; // practical minimum 2 bars for stirrup corners

    let requiredLayers = Math.ceil(nBars / maxBarsPerLayer);
    if (requiredLayers <= numLayers) {
      break; // It fits in the assumed number of layers!
    }

    // Need more layers, recalculate d
    numLayers = requiredLayers;
    const centroidDist = cover + diaWeb + diaMain / 2 + ((numLayers - 1) / 2) * 25; // 25mm vertical clear spacing
    d = h - centroidDist;
    details += `<p class="calc-step" style="color:#f39c12;">&nbsp;&nbsp;Rebars exceed width. Iterating to ${numLayers} layers, new d = ${d.toFixed(1)} mm</p>`;
  }

  let maxBarsPerLayer = Math.floor((b_clear + minClearSpacing) / (diaMain + minClearSpacing));
  if (maxBarsPerLayer < 2) maxBarsPerLayer = 2;
  let layers = [];
  let remaining = nBars;
  for (let i = 0; i < numLayers; i++) {
    if (remaining > maxBarsPerLayer) {
      layers.push(maxBarsPerLayer);
      remaining -= maxBarsPerLayer;
    } else {
      layers.push(remaining);
      remaining = 0;
      break;
    }
  }

  if (beamType === 'smrf' && rho > 0.025) {
    details += `<p class="calc-step" style="color:#e74c3c;">&nbsp;&nbsp;<strong>SMRF FAILED:</strong> &rho; = ${rho.toFixed(4)} > 0.025 (NSCP 418.6.3.1).</p>`;
  }

  details += `<p class="calc-step">&nbsp;&nbsp;&rho; = ${rho.toFixed(5)} &rarr; As_req = ${As_req.toFixed(1)} mm&sup2;</p>`;
  details += `<p class="calc-step">&nbsp;&nbsp;As_min = ${As_min.toFixed(1)} mm&sup2;</p>`;
  details += `<p class="calc-step">&nbsp;&nbsp;<strong>Provided:</strong> ${As.toFixed(1)} mm&sup2; <strong>(${nBars} - &empty;${diaMain})</strong></p>`;
  if (numLayers > 1) {
    details += `<p class="calc-step">&nbsp;&nbsp;<em>Layer detailing: [${layers.join(', ')}] (bottom/top to inner)</em></p>`;
  }

  const a_actual = (As * fyMain) / (0.85 * fc * b);
  const phiMn = phiFlex * As * fyMain * (d - a_actual / 2) / 1e6;

  const txt = `${nBars}xD${diaMain}`;
  return { As, nBars, layers, d, txt, doubly: false, rho, details, phiMn };
}

function computeSection(secName, beamType, MuTop_kNm, MuBot_kNm, Vu_kN, Tu_kNm, b, h, spanLn, cover, fc, fyMain, diaMain, fyWeb, diaWeb, nLegs, fyTor, diaTor, lambda = 1.0, maxAgg = 20, smrfData = null) {
  const phiFlex  = 0.90;
  const phiShear = 0.75;

  const mainBarArea = getRebarArea(diaMain);
  const webBarArea  = getRebarArea(diaWeb);
  const torBarArea  = getRebarArea(diaTor);
  const Av = nLegs * webBarArea;

  let detailsHTML = `<div class="calc-section"><h4>${secName} Section</h4>`;

  // ── §18.6.2 Geometry Checks ─────────────────────────────────────────────
  if (beamType === 'smrf') {
    if (b < 250)
      detailsHTML += `<p class="calc-step" style="color:#e74c3c;"><strong>SMRF §18.6.2.1 FAIL:</strong> b = ${b} mm &lt; 250 mm</p>`;
    if (b < 0.3 * h)
      detailsHTML += `<p class="calc-step" style="color:#e74c3c;"><strong>SMRF §18.6.2.1 FAIL:</strong> b = ${b} mm &lt; 0.3h = ${(0.3*h).toFixed(0)} mm</p>`;
    if (smrfData && smrfData.bCol > 0) {
      const bMax = smrfData.bCol + 3 * h;
      const ok18623 = b <= bMax;
      detailsHTML += `<p class="calc-step" style="color:${ok18623 ? '#16a34a' : '#e74c3c'};"><strong>SMRF §18.6.2.3:</strong> b = ${b} mm ${ok18623 ? '&le;' : '&gt;'} (bCol + 3h) = ${bMax.toFixed(0)} mm. ${ok18623 ? '✓' : 'FAIL'}</p>`;
    }
    detailsHTML += `<p class="calc-step"><strong>§18.6.3.1:</strong> Min 2 continuous bars top &amp; bottom throughout span.</p>`;
  }

  // ── FLEXURE — Top ───────────────────────────────────────────────────────
  let txtTop = '0';
  let topLayers = [];
  let dTop = h - cover - diaWeb - diaMain / 2;
  let phiMnTop = 0;
  let AsTop = 0;

  if (MuTop_kNm > 0) {
    detailsHTML += `<p class="calc-step"><strong>Top Flexure (&minus;Mu):</strong> ${MuTop_kNm} kN&middot;m</p>`;
    const tc = calculateFlexureLayers(MuTop_kNm, b, h, cover, fc, fyMain, diaMain, diaWeb, beamType, maxAgg);
    detailsHTML += tc.details;
    txtTop = tc.txt; topLayers = tc.layers; dTop = tc.d; phiMnTop = tc.phiMn; AsTop = tc.As;
  } else {
    AsTop = 2 * mainBarArea;
    topLayers = [2];
    const a_act = (AsTop * fyMain) / (0.85 * fc * b);
    phiMnTop = phiFlex * AsTop * fyMain * (dTop - a_act / 2) / 1e6;
    txtTop = beamType === 'smrf' ? `2xD${diaMain}` : '0';
    if (beamType === 'smrf')
      detailsHTML += `<p class="calc-step">Top: No moment demand &rarr; Min 2 hanger bars (§18.6.3.1).</p>`;
  }

  // ── FLEXURE — Bottom ────────────────────────────────────────────────────
  let txtBot = '0';
  let botLayers = [];
  let dBot = h - cover - diaWeb - diaMain / 2;
  let phiMnBot = 0;
  let AsBot = 0;

  if (MuBot_kNm > 0) {
    detailsHTML += `<p class="calc-step"><strong>Bottom Flexure (+Mu):</strong> ${MuBot_kNm} kN&middot;m</p>`;
    const bc = calculateFlexureLayers(MuBot_kNm, b, h, cover, fc, fyMain, diaMain, diaWeb, beamType, maxAgg);
    detailsHTML += bc.details;
    txtBot = bc.txt; botLayers = bc.layers; dBot = bc.d; phiMnBot = bc.phiMn; AsBot = bc.As;
  } else {
    AsBot = 2 * mainBarArea;
    botLayers = [2];
    const a_act = (AsBot * fyMain) / (0.85 * fc * b);
    phiMnBot = phiFlex * AsBot * fyMain * (dBot - a_act / 2) / 1e6;
    txtBot = beamType === 'smrf' ? `2xD${diaMain}` : '0';
    if (beamType === 'smrf')
      detailsHTML += `<p class="calc-step">Bottom: No moment demand &rarr; Min 2 hanger bars (§18.6.3.1).</p>`;
  }

  // ── §18.6.3 SMRF Flexural Proportion Checks ─────────────────────────────
  if (beamType === 'smrf') {

    // §18.6.3.2 — 25% Rule: As ≥ 0.25 × max joint As at any section
    if (smrfData && smrfData.minAny > 0) {
      const minAny = smrfData.minAny;
      detailsHTML += `<p class="calc-step"><strong>§18.6.3.2 (25% Rule):</strong> As at any section &ge; ${minAny.toFixed(0)} mm&sup2; (0.25 &times; max joint As = ${smrfData.maxJointAs.toFixed(0)} mm&sup2;)</p>`;

      if (AsTop < minAny - 0.5) {
        const nReq = Math.ceil(minAny / mainBarArea);
        AsTop = nReq * mainBarArea; topLayers = [nReq]; txtTop = `${nReq}xD${diaMain}`;
        const a = (AsTop * fyMain) / (0.85 * fc * b);
        phiMnTop = phiFlex * AsTop * fyMain * (dTop - a / 2) / 1e6;
        detailsHTML += `<p class="calc-step" style="color:#f39c12;">&nbsp;&nbsp;Top bars bumped &rarr; ${nReq}&times;D${diaMain} (As = ${AsTop.toFixed(0)} mm&sup2;) ✓</p>`;
      } else {
        detailsHTML += `<p class="calc-step">&nbsp;&nbsp;Top: As = ${AsTop.toFixed(0)} mm&sup2; &ge; ${minAny.toFixed(0)} mm&sup2; ✓</p>`;
      }

      if (AsBot < minAny - 0.5) {
        const nReq = Math.ceil(minAny / mainBarArea);
        AsBot = nReq * mainBarArea; botLayers = [nReq]; txtBot = `${nReq}xD${diaMain}`;
        const a = (AsBot * fyMain) / (0.85 * fc * b);
        phiMnBot = phiFlex * AsBot * fyMain * (dBot - a / 2) / 1e6;
        detailsHTML += `<p class="calc-step" style="color:#f39c12;">&nbsp;&nbsp;Bottom bars bumped &rarr; ${nReq}&times;D${diaMain} (As = ${AsBot.toFixed(0)} mm&sup2;) ✓</p>`;
      } else {
        detailsHTML += `<p class="calc-step">&nbsp;&nbsp;Bottom: As = ${AsBot.toFixed(0)} mm&sup2; &ge; ${minAny.toFixed(0)} mm&sup2; ✓</p>`;
      }
    }

    // §18.6.3.2 — 50% Rule: Mn+ ≥ 0.5·Mn− at joint faces (support sections)
    if (secName.includes('Support')) {
      const reqMnPos = 0.5 * phiMnTop;
      if (phiMnBot < reqMnPos - 0.1) {
        const nReq = Math.ceil(0.5 * AsTop / mainBarArea);
        AsBot = nReq * mainBarArea; botLayers = [nReq]; txtBot = `${nReq}xD${diaMain}`;
        const a = (AsBot * fyMain) / (0.85 * fc * b);
        phiMnBot = phiFlex * AsBot * fyMain * (dBot - a / 2) / 1e6;
        detailsHTML += `<p class="calc-step" style="color:#f39c12;"><strong>§18.6.3.2 (50% Rule):</strong> &phi;Mn&sup2; bumped &rarr; ${nReq}&times;D${diaMain} so &phi;Mn&sup2; = ${phiMnBot.toFixed(1)} kN&middot;m &ge; 0.5&times;&phi;Mn&minus; = ${reqMnPos.toFixed(1)} kN&middot;m ✓</p>`;
      } else {
        detailsHTML += `<p class="calc-step"><strong>§18.6.3.2 (50% Rule):</strong> &phi;Mn&sup2; = ${phiMnBot.toFixed(1)} kN&middot;m &ge; 0.5&times;&phi;Mn&minus; = ${reqMnPos.toFixed(1)} kN&middot;m ✓</p>`;
      }
      // §18.6.4.3: First hoop note
      detailsHTML += `<p class="calc-step"><strong>§18.6.4.3:</strong> First hoop &le; 50 mm from column face. Confinement zone = 2h = ${(2*h).toFixed(0)} mm.</p>`;
    }

    // Local Mpr for this section
    const MprT = computeMpr(AsTop, fyMain, fc, b, dTop);
    const MprB = computeMpr(AsBot, fyMain, fc, b, dBot);
    detailsHTML += `<p class="calc-step"><strong>Mpr (§18.6.5, this section):</strong> Top = ${MprT.toFixed(1)} kN&middot;m, Bot = ${MprB.toFixed(1)} kN&middot;m</p>`;
  }

  const d = Math.min(dTop, dBot);

  // ── SHEAR & TORSION ─────────────────────────────────────────────────────
  let txtWeb = 'Not Req.';
  let txtTor = 'Not Req.';

  const Vc_concrete = 0.17 * lambda * Math.sqrt(fc) * b * d;
  let Vc_design     = Vc_concrete; // will be set to 0 for SMRF
  let designVu_kN   = Vu_kN;

  if (beamType === 'smrf' && smrfData) {
    // §18.6.5.1 — Probable Shear from sway mechanism
    designVu_kN = smrfData.ve_kN;
    Vc_design   = 0; // §18.6.5.2: Vc = 0

    detailsHTML += `<p class="calc-step"><strong>SMRF Probable Shear (ACI 318-14 §18.6.5.1):</strong></p>`;
    if (smrfData.vg > 0) {
      detailsHTML += `<p class="calc-step">&nbsp;&nbsp;V<sub>g</sub> = ${smrfData.vg.toFixed(1)} kN (user override)</p>`;
    } else {
      detailsHTML += `<p class="calc-step">&nbsp;&nbsp;w<sub>u</sub> = 1.2(${smrfData.wD.toFixed(1)}) + 1.0(${smrfData.wL.toFixed(1)}) = ${smrfData.wu.toFixed(1)} kN/m</p>`;
    }
    detailsHTML += `<p class="calc-step">&nbsp;&nbsp;Mpr,LT = ${smrfData.Mpr_LT.toFixed(1)} kN&middot;m &nbsp; Mpr,LB = ${smrfData.Mpr_LB.toFixed(1)} kN&middot;m</p>`;
    detailsHTML += `<p class="calc-step">&nbsp;&nbsp;Mpr,RT = ${smrfData.Mpr_RT.toFixed(1)} kN&middot;m &nbsp; Mpr,RB = ${smrfData.Mpr_RB.toFixed(1)} kN&middot;m</p>`;
    detailsHTML += `<p class="calc-step">&nbsp;&nbsp;Sway L&rarr;R: Ve = ${smrfData.Ve_case1.toFixed(1)} kN &nbsp;&nbsp; Sway R&rarr;L: Ve = ${smrfData.Ve_case2.toFixed(1)} kN</p>`;
    detailsHTML += `<p class="calc-step">&nbsp;&nbsp;<strong>Design Ve = ${smrfData.ve_kN.toFixed(1)} kN</strong> (governs over user Vu = ${Vu_kN.toFixed(1)} kN)</p>`;
    detailsHTML += `<p class="calc-step" style="color:#f39c12;">&nbsp;&nbsp;<strong>§18.6.5.2: Vc = 0</strong> (seismic shear &ge; 50% Ve assumed; Pu &le; Agf'c/20 for beams)</p>`;
    detailsHTML += `<p class="calc-step">&nbsp;&nbsp;(Vc,calc = ${(phiShear * Vc_concrete / 1000).toFixed(1)} kN &mdash; neglected per §18.6.5.2)</p>`;
  } else {
    detailsHTML += `<p class="calc-step"><strong>Shear &amp; Torsion:</strong> Vu = ${Vu_kN} kN, Tu = ${Tu_kNm} kN&middot;m</p>`;
    detailsHTML += `<p class="calc-step">&nbsp;&nbsp;&phi;Vc = ${(phiShear * Vc_concrete / 1000).toFixed(2)} kN</p>`;
  }

  const designVu_N = designVu_kN * 1000;
  const Tu_Nmm    = Tu_kNm * 1e6;

  // Torsion threshold
  const Acp = b * h;
  const pcp = 2 * (b + h);
  const Tth = 0.083 * lambda * Math.sqrt(fc) * Math.pow(Acp, 2) / pcp;
  detailsHTML += `<p class="calc-step">&nbsp;&nbsp;Tth = ${(Tth / 1e6).toFixed(2)} kN&middot;m &rarr; &phi;Tth = ${(phiShear * Tth / 1e6).toFixed(2)} kN&middot;m</p>`;

  let At_s = 0;
  let hasTorsion = false;
  let ph = 0;
  if (Tu_Nmm > phiShear * Tth) {
    hasTorsion = true;
    detailsHTML += `<p class="calc-step">&nbsp;&nbsp;Tu &gt; &phi;Tth, Torsion must be considered.</p>`;
    const x1 = b - 2 * cover - diaWeb;
    const y1 = h - 2 * cover - diaWeb;
    ph = 2 * (x1 + y1);
    const Aoh = x1 * y1;
    const Ao  = 0.85 * Aoh;
    const Tn  = Tu_Nmm / phiShear;
    At_s = Tn / (2 * Ao * fyWeb);
    detailsHTML += `<p class="calc-step">&nbsp;&nbsp;Req. At/s = ${At_s.toFixed(3)} mm&sup2;/mm (per leg)</p>`;

    let Al_req  = At_s * ph * (fyWeb / fyTor);
    let At_s_min = Math.max(At_s, (0.175 * b) / fyWeb);
    let Al_min   = (0.42 * Math.sqrt(fc) * Acp / fyTor) - (At_s_min * ph * (fyWeb / fyTor));
    let Al = Math.max(Al_req, Al_min);
    detailsHTML += `<p class="calc-step">&nbsp;&nbsp;Req. Al = ${Al_req.toFixed(1)} mm&sup2;, Al_min = ${Al_min.toFixed(1)} mm&sup2;</p>`;

    const nTorBars_local = Math.ceil(Al / torBarArea);
    txtTor = `${nTorBars_local}xD${diaTor}`;
    detailsHTML += `<p class="calc-step">&nbsp;&nbsp;<strong>Provided Al:</strong> ${Al.toFixed(1)} mm&sup2; <strong>(${nTorBars_local} &minus; &empty;${diaTor})</strong></p>`;
  } else {
    detailsHTML += `<p class="calc-step">&nbsp;&nbsp;Tu &le; &phi;Tth, Torsion neglected.</p>`;
  }

  // Shear design
  const Vs_req = Math.max((designVu_N / phiShear) - Vc_design, 0);
  const Av_s   = Vs_req / (fyWeb * d);
  detailsHTML += `<p class="calc-step">&nbsp;&nbsp;Req. Av/s (Shear) = ${Av_s.toFixed(3)} mm&sup2;/mm</p>`;

  const min_Av_s = Math.max(0.062 * Math.sqrt(fc) * b / fyWeb, 0.35 * b / fyWeb);
  let total_Av_s = Av_s + 2 * At_s;
  detailsHTML += `<p class="calc-step">&nbsp;&nbsp;Total Av/s (Shear + Torsion) = ${total_Av_s.toFixed(3)} mm&sup2;/mm</p>`;

  if (total_Av_s < min_Av_s && (designVu_N > 0.5 * phiShear * Vc_concrete || Tu_Nmm > phiShear * Tth)) {
    total_Av_s = min_Av_s;
    detailsHTML += `<p class="calc-step">&nbsp;&nbsp;Minimum reinforcement controls: Av/s = ${min_Av_s.toFixed(3)} mm&sup2;/mm</p>`;
  }

  let s = 0;
  let smrf_s_max = 0;
  const isConfinement = beamType === 'smrf' && secName.includes('Support');

  if (total_Av_s > 0) {
    s = Av / total_Av_s;
    let s_max = Math.min(d / 2, 600);

    if (beamType === 'smrf') {
      if (isConfinement) {
        // §18.6.4.4: Within 2h confinement zone
        smrf_s_max = Math.min(d / 4, 6 * diaMain, 150);
        s_max = Math.min(s_max, smrf_s_max);
        detailsHTML += `<p class="calc-step"><strong>§18.6.4.4 Confinement Zone (2h = ${(2*h).toFixed(0)} mm):</strong> s_max = min(d/4=${(d/4).toFixed(0)}, 6db=${(6*diaMain).toFixed(0)}, 150) = ${smrf_s_max.toFixed(0)} mm</p>`;
        detailsHTML += `<p class="calc-step">&nbsp;&nbsp;<em>Closed hoops with 135&deg; hooks required (§18.6.4.1)</em></p>`;
      } else {
        // §18.6.4.5: Outside confinement zone
        s_max = Math.min(s_max, d / 2);
        detailsHTML += `<p class="calc-step"><strong>§18.6.4.5 (Midspan / Outside Confinement):</strong> s_max = d/2 = ${(d/2).toFixed(0)} mm</p>`;
      }
    }

    if (hasTorsion) {
      const x1t = b - 2 * cover - diaWeb;
      const y1t = h - 2 * cover - diaWeb;
      s_max = Math.min(s_max, Math.min(2 * (x1t + y1t) / 8, 300));
    }

    s = Math.min(s, s_max);
    s = Math.floor(s / 25) * 25;
    if (s < 50) s = 50;

    txtWeb = `D${diaWeb} @ ${s} mm`;
    if (isConfinement)                            txtWeb = `1@50, rest @ ${s} mm (Hinge Zone)`;
    else if (beamType === 'smrf')                 txtWeb += ` (Span)`;
    else if (hasTorsion)                          txtWeb += ` (Shear+Tor)`;

    detailsHTML += `<p class="calc-step">&nbsp;&nbsp;<strong>Provided Stirrups: 1@50, rest &empty;${diaWeb} @ ${s} mm</strong>`;
    if (isConfinement) detailsHTML += ` &nbsp;<em>(135&deg; closed hoops)</em>`;
    detailsHTML += `</p>`;
  } else {
    txtWeb = 'Provide Min.';
    detailsHTML += `<p class="calc-step">&nbsp;&nbsp;<strong>Provided Stirrups:</strong> Provide minimum spacing per code.</p>`;
  }

  detailsHTML += `</div>`;

  const nTorBars = Math.ceil(Math.max(
    At_s * ph * (fyWeb / fyTor),
    (0.42 * Math.sqrt(fc) * Acp / fyTor) - (Math.max(At_s, (0.175 * b) / fyWeb) * ph * (fyWeb / fyTor))
  ) / torBarArea) || 0;

  // Capacities and DCR
  let phiVn = phiShear * Vc_design / 1000; // 0 for SMRF
  let phiTn = 0;
  if (s > 0) {
    phiVn += phiShear * (Av * fyWeb * d / s) / 1000;
    if (hasTorsion) {
      const x1c = b - 2 * cover - diaWeb;
      const y1c = h - 2 * cover - diaWeb;
      const Aoh = x1c * y1c;
      const Ao  = 0.85 * Aoh;
      phiTn = phiShear * (2 * Ao * (Av / (2 * s)) * fyWeb) / 1e6;
    }
  }

  const dcrTop = phiMnTop > 0 ? (MuTop_kNm / phiMnTop) : 0;
  const dcrBot = phiMnBot > 0 ? (MuBot_kNm / phiMnBot) : 0;
  const dcrV   = phiVn   > 0 ? (designVu_kN / phiVn)   : 0;
  const dcrT   = phiTn   > 0 ? (Tu_kNm / phiTn)         : 0;
  const maxDCR = Math.max(dcrTop, dcrBot, dcrV, dcrT);

  return {
    top: txtTop,
    bot: txtBot,
    web: txtWeb,
    tor: txtTor,
    details: detailsHTML,
    svgData: {
      b, h, cover, topLayers, botLayers, diaMain, diaWeb, nTorBars, diaTor,
      sSpacing: s || 0, smrf_s_max: smrf_s_max || 0, hasTorsion,
      phiMnTop, phiMnBot, phiVn, phiTn, maxDCR,
      txtTop, txtBot, txtWeb, txtTor,
      Vu_kN: designVu_kN, // show Ve in card for SMRF
      Tu_kNm
    }
  };
}

// ---------- Modal controls ----------
const resultsModal = document.getElementById('resultsModal');
const reopenBtn    = document.getElementById('reopenResultsBtn');

window.showNotes = function (calcId) {
  const content = document.getElementById(calcId).innerHTML;
  document.getElementById('notesModalContent').innerHTML = content;
  document.getElementById('notesModal').classList.add('active');
};

function openResultsModal() {
  resultsModal.classList.add('active');
  document.body.style.overflow = 'hidden';
}
function closeResultsModal() {
  resultsModal.classList.remove('active');
  document.body.style.overflow = '';
}
document.getElementById('modalCloseBtn').addEventListener('click', closeResultsModal);
resultsModal.addEventListener('click', (e) => { if (e.target === resultsModal) closeResultsModal(); });
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && resultsModal.classList.contains('active')) closeResultsModal();
});
reopenBtn.addEventListener('click', openResultsModal);

// Show/hide SMRF-specific parameter fields
document.getElementById('beamType').addEventListener('change', (e) => {
  const card = document.getElementById('smrfParamsCard');
  if (card) card.style.display = e.target.value === 'smrf' ? '' : 'none';
});

document.getElementById('computeBtn').addEventListener('click', () => {
  const beamType = document.getElementById('beamType').value;
  const b      = parseFloat(document.getElementById('b').value)      || 0;
  const h      = parseFloat(document.getElementById('h').value)      || 0;
  const spanLn = parseFloat(document.getElementById('spanLn').value) || 0;
  const fc     = parseFloat(document.getElementById('fc').value)     || 0;
  const cover  = parseFloat(document.getElementById('cover').value)  || 0;

  const fyMain  = parseFloat(document.getElementById('fyMain').value)  || 0;
  const diaMain = parseFloat(document.getElementById('diaMain').value) || 0;
  const fyWeb   = parseFloat(document.getElementById('fyWeb').value)   || 0;
  const diaWeb  = parseFloat(document.getElementById('diaWeb').value)  || 0;
  const nLegs   = parseFloat(document.getElementById('nLegs').value)   || 0;
  const fyTor   = parseFloat(document.getElementById('fyTor').value)   || 0;
  const diaTor  = parseFloat(document.getElementById('diaTor').value)  || 0;

  const lambda  = parseFloat(document.getElementById('concreteWeight').value) || 1.0;
  const maxAgg  = parseFloat(document.getElementById('maxAgg').value) || 20;

  if (b <= 0 || h <= 0 || spanLn <= 0 || fc <= 0 || fyMain <= 0 || fyWeb <= 0 || nLegs <= 0 || fyTor <= 0 || cover <= 0) {
    alert('Please enter valid beam and reinforcement parameters.');
    return;
  }

  const l_muTop = parseFloat(document.getElementById('leftMuTop').value)  || 0;
  const l_muBot = parseFloat(document.getElementById('leftMuBot').value)  || 0;
  const l_vu    = parseFloat(document.getElementById('leftVu').value)     || 0;
  const l_tu    = parseFloat(document.getElementById('leftTu').value)     || 0;
  const m_muTop = parseFloat(document.getElementById('midMuTop').value)   || 0;
  const m_muBot = parseFloat(document.getElementById('midMuBot').value)   || 0;
  const m_vu    = parseFloat(document.getElementById('midVu').value)      || 0;
  const m_tu    = parseFloat(document.getElementById('midTu').value)      || 0;
  const r_muTop = parseFloat(document.getElementById('rightMuTop').value) || 0;
  const r_muBot = parseFloat(document.getElementById('rightMuBot').value) || 0;
  const r_vu    = parseFloat(document.getElementById('rightVu').value)    || 0;
  const r_tu    = parseFloat(document.getElementById('rightTu').value)    || 0;

  let leftRes, midRes, rightRes;

  if (beamType === 'smrf') {
    // ══════════════════════════════════════════════════════════════════════
    // SMRF 2-Pass Computation  —  ACI 318-14 §18.6
    // ══════════════════════════════════════════════════════════════════════
    const wD   = parseFloat(document.getElementById('wD').value)   || 0;
    const wL   = parseFloat(document.getElementById('wL').value)   || 0;
    const vg   = parseFloat(document.getElementById('vg').value)   || 0;
    const bCol = parseFloat(document.getElementById('bCol').value) || 0;

    const wu   = 1.2 * wD + 1.0 * wL;

    if (wu <= 0 && vg <= 0) {
      alert('SMRF mode requires Service Dead and Live loads, or an explicit Service Shear Vg.\nPlease enter them in the SMRF Seismic Parameters section.');
      return;
    }

    const mainBarArea = getRebarArea(diaMain);
    const minBars2    = 2 * mainBarArea; // §18.6.3.1: min 2 bars
    const d0 = h - cover - diaWeb - diaMain / 2; // nominal effective depth

    // ── Pass 1: Preliminary flexure for all sections ──────────────────────
    const ltP = calculateFlexureLayers(l_muTop, b, h, cover, fc, fyMain, diaMain, diaWeb, 'smrf', maxAgg);
    const lbP = calculateFlexureLayers(l_muBot, b, h, cover, fc, fyMain, diaMain, diaWeb, 'smrf', maxAgg);
    const rtP = calculateFlexureLayers(r_muTop, b, h, cover, fc, fyMain, diaMain, diaWeb, 'smrf', maxAgg);
    const rbP = calculateFlexureLayers(r_muBot, b, h, cover, fc, fyMain, diaMain, diaWeb, 'smrf', maxAgg);

    const d_LT = ltP.As > 0 ? ltP.d : d0;
    const d_LB = lbP.As > 0 ? lbP.d : d0;
    const d_RT = rtP.As > 0 ? rtP.d : d0;
    const d_RB = rbP.As > 0 ? rbP.d : d0;

    // Enforce §18.6.3.1 minimum 2 bars at every face
    let As_LT = Math.max(ltP.As, minBars2);
    let As_LB = Math.max(lbP.As, minBars2);
    let As_RT = Math.max(rtP.As, minBars2);
    let As_RB = Math.max(rbP.As, minBars2);

    // §18.6.3.2 — 50% Rule at joint faces
    if (As_LB < 0.5 * As_LT) As_LB = 0.5 * As_LT;
    if (As_RB < 0.5 * As_RT) As_RB = 0.5 * As_RT;

    // §18.6.3.2 — 25% Rule: min As at any section
    const maxJointAs = Math.max(As_LT, As_LB, As_RT, As_RB);
    const minAny     = Math.max(0.25 * maxJointAs, minBars2);

    // ── Compute Mpr at each support face (§18.6.5, 1.25fy, φ=1.0) ─────────
    const Mpr_LT = computeMpr(As_LT, fyMain, fc, b, d_LT);
    const Mpr_LB = computeMpr(As_LB, fyMain, fc, b, d_LB);
    const Mpr_RT = computeMpr(As_RT, fyMain, fc, b, d_RT);
    const Mpr_RB = computeMpr(As_RB, fyMain, fc, b, d_RB);

    // ── §18.6.5.1 Probable Shear ──────────────────────────────────────────
    // Sway L→R:  left face hogging (top), right face sagging (bot)
    //   Ve_left  = (Mpr_LT + Mpr_RB)/Ln + wu·Ln/2
    //   Ve_right = (Mpr_LT + Mpr_RB)/Ln − wu·Ln/2
    // Sway R→L:  left face sagging (bot), right face hogging (top)
    //   Ve_left  = (Mpr_LB + Mpr_RT)/Ln − wu·Ln/2
    //   Ve_right = (Mpr_LB + Mpr_RT)/Ln + wu·Ln/2
    const wuShear   = vg > 0 ? vg : (wu * spanLn / 2);                      // kN
    const sum_c1    = (Mpr_LT + Mpr_RB) / spanLn;           // kN
    const sum_c2    = (Mpr_LB + Mpr_RT) / spanLn;

    const Ve_L1 = sum_c1 + wuShear;  // sway L→R, left end
    const Ve_L2 = sum_c2 - wuShear;  // sway R→L, left end
    const Ve_R1 = sum_c1 - wuShear;  // sway L→R, right end
    const Ve_R2 = sum_c2 + wuShear;  // sway R→L, right end

    const Ve_left  = Math.max(Math.abs(Ve_L1), Math.abs(Ve_L2));
    const Ve_right = Math.max(Math.abs(Ve_R1), Math.abs(Ve_R2));
    const Ve_mid   = (Ve_left + Ve_right) / 2; // linear midpoint

    const smrfBase = { Mpr_LT, Mpr_LB, Mpr_RT, Mpr_RB, wu, wD, wL, vg, wuShear, minAny, maxJointAs, bCol };

    const smrfLeft  = { ...smrfBase, ve_kN: Ve_left,  Ve_case1: Ve_L1, Ve_case2: Ve_L2 };
    const smrfMid   = { ...smrfBase, ve_kN: Ve_mid,   Ve_case1: Ve_L1, Ve_case2: Ve_L2 };
    const smrfRight = { ...smrfBase, ve_kN: Ve_right, Ve_case1: Ve_R1, Ve_case2: Ve_R2 };

    // ── Pass 2: Full design with SMRF data ────────────────────────────────
    leftRes  = computeSection('Left Support',  beamType, l_muTop, l_muBot, l_vu, l_tu, b, h, spanLn, cover, fc, fyMain, diaMain, fyWeb, diaWeb, nLegs, fyTor, diaTor, lambda, maxAgg, smrfLeft);
    midRes   = computeSection('Midspan',       beamType, m_muTop, m_muBot, m_vu, m_tu, b, h, spanLn, cover, fc, fyMain, diaMain, fyWeb, diaWeb, nLegs, fyTor, diaTor, lambda, maxAgg, smrfMid);
    rightRes = computeSection('Right Support', beamType, r_muTop, r_muBot, r_vu, r_tu, b, h, spanLn, cover, fc, fyMain, diaMain, fyWeb, diaWeb, nLegs, fyTor, diaTor, lambda, maxAgg, smrfRight);

  } else {
    // ── Standard Gravity Computation ─────────────────────────────────────
    leftRes  = computeSection('Left Support',  beamType, l_muTop, l_muBot, l_vu, l_tu, b, h, spanLn, cover, fc, fyMain, diaMain, fyWeb, diaWeb, nLegs, fyTor, diaTor, lambda, maxAgg);
    midRes   = computeSection('Midspan',       beamType, m_muTop, m_muBot, m_vu, m_tu, b, h, spanLn, cover, fc, fyMain, diaMain, fyWeb, diaWeb, nLegs, fyTor, diaTor, lambda, maxAgg);
    rightRes = computeSection('Right Support', beamType, r_muTop, r_muBot, r_vu, r_tu, b, h, spanLn, cover, fc, fyMain, diaMain, fyWeb, diaWeb, nLegs, fyTor, diaTor, lambda, maxAgg);
  }

  // ── Update results table ────────────────────────────────────────────────
  document.getElementById('resLeftTop').textContent  = leftRes.top;
  document.getElementById('resLeftBot').textContent  = leftRes.bot;
  document.getElementById('resLeftWeb').textContent  = leftRes.web;
  document.getElementById('resLeftTor').textContent  = leftRes.tor;
  document.getElementById('calcLeft').innerHTML      = leftRes.details;

  document.getElementById('resMidTop').textContent   = midRes.top;
  document.getElementById('resMidBot').textContent   = midRes.bot;
  document.getElementById('resMidWeb').textContent   = midRes.web;
  document.getElementById('resMidTor').textContent   = midRes.tor;
  document.getElementById('calcMid').innerHTML       = midRes.details;

  document.getElementById('resRightTop').textContent = rightRes.top;
  document.getElementById('resRightBot').textContent = rightRes.bot;
  document.getElementById('resRightWeb').textContent = rightRes.web;
  document.getElementById('resRightTor').textContent = rightRes.tor;
  document.getElementById('calcRight').innerHTML     = rightRes.details;

  // ── Diagrams ────────────────────────────────────────────────────────────
  const diagContainer = document.getElementById('diagramContainer');
  let diagHTML = `<h3 style="text-align:center; color:var(--amber); margin-bottom:1rem;">Detailing Diagrams</h3>`;
  diagHTML += drawElevationSVG(spanLn, beamType, leftRes.svgData, midRes.svgData, rightRes.svgData);
  diagHTML += `<div class="cross-sections-row" style="display:flex; justify-content:space-between; gap:1rem; flex-wrap:wrap;">`;
  diagHTML += `<div class="diagram-wrapper" style="flex:1; min-width:250px; width:100%;">${drawCrossSectionSVG('Left Support',  leftRes.svgData)}</div>`;
  diagHTML += `<div class="diagram-wrapper" style="flex:1; min-width:250px; width:100%;">${drawCrossSectionSVG('Midspan',       midRes.svgData)}</div>`;
  diagHTML += `<div class="diagram-wrapper" style="flex:1; min-width:250px; width:100%;">${drawCrossSectionSVG('Right Support', rightRes.svgData)}</div>`;
  diagHTML += `</div>`;
  diagContainer.innerHTML = diagHTML;

  openResultsModal();
  reopenBtn.style.display = 'inline-block';

  window.currentDesignData = {
    beamType, b, h, spanLn, fc, cover, fyMain, diaMain, fyWeb, diaWeb, nLegs, fyTor, diaTor,
    leftRes, midRes, rightRes
  };
});
document.getElementById('downloadPdfBtn').addEventListener('click', () => {
  if (!window.currentDesignData) return;
  const d = window.currentDesignData;
  const beamTypeLabel = document.getElementById('beamType').options[document.getElementById('beamType').selectedIndex].text;

  // ── PDF-safe helpers ────────────────────────────────────────────────────────

  /**
   * Convert an HTML string (produced by computeSection) into a pdfmake
   * content array.  We parse the lightweight subset produced by our code:
   *   <div class="calc-section"><h4>…</h4><p class="calc-step">…</p>…</div>
   * We deliberately do NOT use html-to-pdfmake because the source HTML
   * embeds CSS-variable inline styles that pdfmake cannot resolve.
   */
  function calcHtmlToPdf(htmlStr) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlStr, 'text/html');
    const sections = doc.querySelectorAll('.calc-section');
    const out = [];

    sections.forEach(sec => {
      // Section heading
      const h4 = sec.querySelector('h4');
      if (h4) {
        out.push({
          text: h4.textContent.trim(),
          style: 'calcSectionTitle',
          margin: [0, 10, 0, 4]
        });
        out.push({ canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 0.5, lineColor: '#d97706' }], margin: [0, 0, 0, 6] });
      }

      // Calc steps
      sec.querySelectorAll('.p').forEach(() => {}); // no-op; use generic
      const steps = sec.querySelectorAll('p');
      steps.forEach(p => {
        const rawText = p.textContent.replace(/\u00a0/g, ' ').trim();
        if (!rawText) return;

        // Detect inline style for colour hints (error = red, warn = orange)
        const style = p.getAttribute('style') || '';
        let color = '#475569';
        if (style.includes('#e74c3c') || style.includes('red')) color = '#dc2626';
        else if (style.includes('#f39c12') || style.includes('orange')) color = '#d97706';

        // Split on <strong> so bold tokens render correctly
        const inlineContent = [];
        p.childNodes.forEach(node => {
          if (node.nodeType === Node.TEXT_NODE) {
            const t = node.textContent.replace(/\u00a0/g, ' ');
            if (t) inlineContent.push({ text: t, color });
          } else if (node.nodeName === 'STRONG' || node.nodeName === 'B') {
            inlineContent.push({ text: node.textContent.replace(/\u00a0/g, ' '), bold: true, color: color === '#475569' ? '#1e293b' : color });
          } else if (node.nodeName === 'EM' || node.nodeName === 'I') {
            inlineContent.push({ text: node.textContent.replace(/\u00a0/g, ' '), italics: true, color });
          } else {
            const t = node.textContent.replace(/\u00a0/g, ' ');
            if (t) inlineContent.push({ text: t, color });
          }
        });

        out.push({ text: inlineContent.length ? inlineContent : [{ text: rawText, color }], fontSize: 9, margin: [8, 1, 0, 1], lineHeight: 1.4 });
      });

      out.push({ text: '', margin: [0, 6, 0, 0] });
    });

    return out.length ? out : [{ text: '(no calculations)', fontSize: 9, color: '#94a3b8' }];
  }

  /**
   * Draw a cross-section SVG with NO CSS variables – uses hard-coded hex
   * colours so pdfmake can render it correctly.
   */
  function drawPdfCrossSectionSVG(data) {
    const { b, h, cover, topLayers, botLayers, diaMain, diaWeb, nTorBars, diaTor } = data;
    const svgW = 280;
    const svgH = 340;
    const scale = Math.min(220 / h, 220 / b);
    const sw = b * scale;
    const sh = h * scale;
    const offsetX = (svgW - sw) / 2;
    const offsetY = (svgH - sh) / 2 + 10;
    const c = cover * scale;

    let svg = `<svg viewBox="0 0 ${svgW} ${svgH}" width="${svgW}" height="${svgH}" xmlns="http://www.w3.org/2000/svg">`;
    svg += `<rect x="${offsetX}" y="${offsetY}" width="${sw}" height="${sh}" fill="#f1f5f9" stroke="#0f172a" stroke-width="2.5"/>`;
    svg += `<rect x="${offsetX + c}" y="${offsetY + c}" width="${sw - 2 * c}" height="${sh - 2 * c}" fill="none" stroke="#db2777" stroke-width="1.5" stroke-dasharray="3,3"/>`;

    const drawLayer = (layers, isTop) => {
      let currentY = isTop
        ? offsetY + c + (diaWeb * scale) + (diaMain * scale) / 2
        : offsetY + sh - c - (diaWeb * scale) - (diaMain * scale) / 2;
      const yDir = isTop ? 1 : -1;
      layers.forEach(numBars => {
        if (numBars > 0) {
          const barSpace = (sw - 2 * c - 2 * (diaWeb * scale) - (diaMain * scale)) / (numBars === 1 ? 1 : numBars - 1);
          const startX = offsetX + c + (diaWeb * scale) + (diaMain * scale) / 2;
          for (let i = 0; i < numBars; i++) {
            const bx = numBars === 1 ? offsetX + sw / 2 : startX + i * barSpace;
            svg += `<circle cx="${bx}" cy="${currentY}" r="${Math.max((diaMain * scale) / 2, 4)}" fill="#2563eb" stroke="#0f172a" stroke-width="1"/>`;
          }
        }
        currentY += yDir * (25 * scale + (diaMain * scale));
      });
    };
    drawLayer(topLayers, true);
    drawLayer(botLayers, false);

    if (nTorBars > 0) {
      const barsPerSide = Math.ceil(nTorBars / 2);
      const vSpace = (sh - 2 * c) / (barsPerSide + 1);
      for (let i = 1; i <= barsPerSide; i++) {
        const ty = offsetY + c + i * vSpace;
        svg += `<circle cx="${offsetX + c + (diaWeb * scale / 2)}" cy="${ty}" r="${Math.max((diaTor * scale) / 2, 3)}" fill="#ea580c" stroke="#0f172a" stroke-width="1"/>`;
        svg += `<circle cx="${offsetX + sw - c - (diaWeb * scale / 2)}" cy="${ty}" r="${Math.max((diaTor * scale) / 2, 3)}" fill="#ea580c" stroke="#0f172a" stroke-width="1"/>`;
      }
    }

    // Dimension labels – no CSS font vars
    svg += `<text x="${offsetX + sw / 2}" y="${offsetY - 6}" text-anchor="middle" font-size="10" font-family="Helvetica" font-weight="bold" fill="#475569">${b.toFixed(0)} mm</text>`;
    svg += `<text x="${offsetX - 8}" y="${offsetY + sh / 2}" text-anchor="middle" font-size="10" font-family="Helvetica" font-weight="bold" fill="#475569" transform="rotate(-90 ${offsetX - 8} ${offsetY + sh / 2})">${h.toFixed(0)} mm</text>`;

    svg += `</svg>`;
    return svg;
  }

  /**
   * Draw the elevation/span SVG with NO CSS variables.
   */
  function drawPdfElevationSVG(spanLn, beamType, leftData, midData, rightData) {
    const svgW = 500;
    const svgH = 130;
    const h = leftData.h;
    const L = spanLn * 1000;
    const bH = 50;
    const bW = 420;
    const offsetX = 40;
    const offsetY = 30;

    let svg = `<svg viewBox="0 0 ${svgW} ${svgH}" width="${svgW}" height="${svgH}" xmlns="http://www.w3.org/2000/svg">`;

    // Beam body
    svg += `<rect x="${offsetX}" y="${offsetY}" width="${bW}" height="${bH}" fill="#e5e7eb" stroke="#0f172a" stroke-width="2"/>`;
    // Supports
    svg += `<rect x="${offsetX - 22}" y="${offsetY}" width="22" height="${bH + 30}" fill="#94a3b8" stroke="#0f172a"/>`;
    svg += `<rect x="${offsetX + bW}" y="${offsetY}" width="22" height="${bH + 30}" fill="#94a3b8" stroke="#0f172a"/>`;

    const zone2h_px = (2 * h / L) * bW;
    const leftZoneW = beamType === 'smrf' ? Math.min(zone2h_px, bW / 3) : bW / 4;
    const rightZoneW = beamType === 'smrf' ? Math.min(zone2h_px, bW / 3) : bW / 4;

    // Rebar lines
    svg += `<line x1="${offsetX}" y1="${offsetY + 7}" x2="${offsetX + bW}" y2="${offsetY + 7}" stroke="#2563eb" stroke-width="3"/>`;
    svg += `<line x1="${offsetX}" y1="${offsetY + bH - 7}" x2="${offsetX + bW}" y2="${offsetY + bH - 7}" stroke="#2563eb" stroke-width="3"/>`;

    // Stirrups
    const drawLines = (start, width, density, color) => {
      const count = Math.floor(width / density);
      for (let i = 0; i <= count; i++) {
        const x = start + i * density;
        svg += `<line x1="${x}" y1="${offsetY + 5}" x2="${x}" y2="${offsetY + bH - 5}" stroke="${color}" stroke-width="1.2"/>`;
      }
    };
    drawLines(offsetX + 4, leftZoneW, beamType === 'smrf' ? 4 : 10, '#db2777');
    drawLines(offsetX + leftZoneW + 8, bW - leftZoneW - rightZoneW - 16, 14, '#94a3b8');
    drawLines(offsetX + bW - rightZoneW, rightZoneW - 4, beamType === 'smrf' ? 4 : 10, '#db2777');

    // Zone labels
    const hingeTxt = beamType === 'smrf' ? `Hinge (${(2 * h).toFixed(0)}mm)` : 'Support Zone';
    svg += `<line x1="${offsetX}" y1="${offsetY + bH + 12}" x2="${offsetX + leftZoneW}" y2="${offsetY + bH + 12}" stroke="#db2777" stroke-width="0.8"/>`;
    svg += `<text x="${offsetX + leftZoneW / 2}" y="${offsetY + bH + 24}" text-anchor="middle" font-size="8" font-family="Helvetica" font-weight="bold" fill="#db2777">${hingeTxt}</text>`;
    svg += `<line x1="${offsetX + bW - rightZoneW}" y1="${offsetY + bH + 12}" x2="${offsetX + bW}" y2="${offsetY + bH + 12}" stroke="#db2777" stroke-width="0.8"/>`;
    svg += `<text x="${offsetX + bW - rightZoneW / 2}" y="${offsetY + bH + 24}" text-anchor="middle" font-size="8" font-family="Helvetica" font-weight="bold" fill="#db2777">${hingeTxt}</text>`;
    svg += `<text x="${offsetX + bW / 2}" y="${offsetY + bH + 22}" text-anchor="middle" font-size="9" font-family="Helvetica" font-weight="bold" fill="#475569">Midspan</text>`;

    // Span label
    svg += `<text x="${offsetX + bW / 2}" y="${offsetY - 6}" text-anchor="middle" font-size="10" font-family="Helvetica" fill="#1e293b">Clear Span: ${spanLn} m</text>`;

    svg += `</svg>`;
    return svg;
  }

  // ── Summary table rows ──────────────────────────────────────────────────────
  function summaryRow(label, left, mid, right) {
    return [
      { text: label, bold: true, fontSize: 9, color: '#475569' },
      { text: left, fontSize: 9, color: '#1e293b' },
      { text: mid, fontSize: 9, color: '#1e293b' },
      { text: right, fontSize: 9, color: '#1e293b' }
    ];
  }

  // ── Capacity row helper ─────────────────────────────────────────────────────
  function capacityTable(svgData) {
    const { phiMnTop, phiMnBot, phiVn, phiTn, maxDCR, Vu_kN, Tu_kNm, txtTop, txtBot, txtWeb, txtTor } = svgData;
    const dcrColor = maxDCR <= 1.0 ? '#16a34a' : '#dc2626';
    return {
      table: {
        widths: ['*', '*'],
        body: [
          [{ text: 'Capacity', colSpan: 2, bold: true, fontSize: 8, fillColor: '#f8fafc', color: '#1e293b' }, {}],
          [{ text: '\u03c6Mn Top', fontSize: 8 }, { text: `${phiMnTop.toFixed(1)} kN·m`, fontSize: 8 }],
          [{ text: '\u03c6Mn Bot', fontSize: 8 }, { text: `${phiMnBot.toFixed(1)} kN·m`, fontSize: 8 }],
          [{ text: '\u03c6Vn / Vu', fontSize: 8 }, { text: `${phiVn.toFixed(1)} / ${Vu_kN.toFixed(1)} kN`, fontSize: 8 }],
          [{ text: '\u03c6Tn', fontSize: 8 }, { text: `${phiTn.toFixed(1)} kN·m`, fontSize: 8 }],
          [{ text: 'DCR', bold: true, fontSize: 8 }, { text: `${maxDCR.toFixed(2)} ${maxDCR <= 1.0 ? '\u2264' : '>'} 1.00`, bold: true, fontSize: 8, color: dcrColor }],
          [{ text: 'Reinforcement', colSpan: 2, bold: true, fontSize: 8, fillColor: '#f8fafc', color: '#1e293b' }, {}],
          [{ text: 'Top Bars', fontSize: 8 }, { text: txtTop, fontSize: 8 }],
          [{ text: 'Bot Bars', fontSize: 8 }, { text: txtBot, fontSize: 8 }],
          [{ text: 'Web Bars', fontSize: 8 }, { text: txtTor, fontSize: 8 }],
          [{ text: 'Stirrups', fontSize: 8 }, { text: txtWeb, fontSize: 8 }]
        ]
      },
      layout: 'lightHorizontalLines',
      margin: [0, 4, 0, 8]
    };
  }

  // ── Build document ──────────────────────────────────────────────────────────
  const docDefinition = {
    pageSize: 'A4',
    pageMargins: [40, 60, 40, 50],

    header: (currentPage, pageCount) => ({
      columns: [
        { text: 'LRFD Beam Design Report', fontSize: 8, color: '#94a3b8', margin: [40, 20, 0, 0] },
        { text: `Page ${currentPage} of ${pageCount}`, fontSize: 8, color: '#94a3b8', alignment: 'right', margin: [0, 20, 40, 0] }
      ]
    }),

    footer: () => ({
      text: 'Generated by ARZEN Engineering Tools  ·  NSCP 2015 / ACI 318-19',
      fontSize: 7,
      color: '#94a3b8',
      alignment: 'center',
      margin: [0, 10, 0, 0]
    }),

    content: [
      // ── Cover / title ──────────────────────────────────────────────────────
      {
        canvas: [{ type: 'rect', x: 0, y: 0, w: 515, h: 4, r: 2, color: '#d97706' }],
        margin: [0, 0, 0, 12]
      },
      { text: 'LRFD BEAM DESIGN REPORT', style: 'title' },
      { text: 'Flexure · Shear · Torsion  ·  NSCP 2015 / ACI 318-19', style: 'subtitle' },
      {
        canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 0.5, lineColor: '#e2e8f0' }],
        margin: [0, 8, 0, 14]
      },

      // ── Input Parameters ───────────────────────────────────────────────────
      { text: 'INPUT PARAMETERS', style: 'sectionLabel' },
      {
        columns: [
          {
            width: '50%',
            stack: [
              { text: 'Beam Geometry', style: 'subheader', margin: [0, 4, 0, 4] },
              {
                table: {
                  widths: ['*', '*'],
                  body: [
                    [{ text: 'Beam Type', bold: true, fontSize: 9 }, { text: beamTypeLabel, fontSize: 9 }],
                    [{ text: "f'c", bold: true, fontSize: 9 }, { text: `${d.fc} MPa`, fontSize: 9 }],
                    [{ text: 'Width b', bold: true, fontSize: 9 }, { text: `${d.b} mm`, fontSize: 9 }],
                    [{ text: 'Depth h', bold: true, fontSize: 9 }, { text: `${d.h} mm`, fontSize: 9 }],
                    [{ text: 'Clear Span', bold: true, fontSize: 9 }, { text: `${d.spanLn} m`, fontSize: 9 }],
                    [{ text: 'Cover', bold: true, fontSize: 9 }, { text: `${d.cover} mm`, fontSize: 9 }]
                  ]
                },
                layout: 'lightHorizontalLines'
              }
            ]
          },
          {
            width: '50%',
            stack: [
              { text: 'Reinforcement', style: 'subheader', margin: [0, 4, 0, 4] },
              {
                table: {
                  widths: ['*', '*'],
                  body: [
                    [{ text: 'fy Main', bold: true, fontSize: 9 }, { text: `${d.fyMain} MPa, D${d.diaMain}`, fontSize: 9 }],
                    [{ text: 'fy Stirrup', bold: true, fontSize: 9 }, { text: `${d.fyWeb} MPa, D${d.diaWeb} (${d.nLegs} legs)`, fontSize: 9 }],
                    [{ text: 'fy Torsion', bold: true, fontSize: 9 }, { text: `${d.fyTor} MPa, D${d.diaTor}`, fontSize: 9 }]
                  ]
                },
                layout: 'lightHorizontalLines'
              }
            ]
          }
        ],
        columnGap: 20,
        margin: [0, 0, 0, 16]
      },

      // ── Design Summary ─────────────────────────────────────────────────────
      { text: 'DESIGN SUMMARY', style: 'sectionLabel' },
      {
        table: {
          headerRows: 1,
          widths: ['*', '*', '*', '*'],
          body: [
            [
              { text: 'Parameter', bold: true, fontSize: 9, fillColor: '#1e293b', color: '#f8fafc' },
              { text: 'Left Support', bold: true, fontSize: 9, fillColor: '#1e293b', color: '#f8fafc' },
              { text: 'Midspan', bold: true, fontSize: 9, fillColor: '#1e293b', color: '#f8fafc' },
              { text: 'Right Support', bold: true, fontSize: 9, fillColor: '#1e293b', color: '#f8fafc' }
            ],
            summaryRow('Top Main Bars', d.leftRes.svgData.txtTop, d.midRes.svgData.txtTop, d.rightRes.svgData.txtTop),
            summaryRow('Bottom Main Bars', d.leftRes.svgData.txtBot, d.midRes.svgData.txtBot, d.rightRes.svgData.txtBot),
            summaryRow('Stirrups', d.leftRes.svgData.txtWeb, d.midRes.svgData.txtWeb, d.rightRes.svgData.txtWeb),
            summaryRow('Torsion Bars', d.leftRes.svgData.txtTor, d.midRes.svgData.txtTor, d.rightRes.svgData.txtTor),
            summaryRow('\u03c6Mn Top (kN·m)', `${d.leftRes.svgData.phiMnTop.toFixed(1)}`, `${d.midRes.svgData.phiMnTop.toFixed(1)}`, `${d.rightRes.svgData.phiMnTop.toFixed(1)}`),
            summaryRow('\u03c6Mn Bot (kN·m)', `${d.leftRes.svgData.phiMnBot.toFixed(1)}`, `${d.midRes.svgData.phiMnBot.toFixed(1)}`, `${d.rightRes.svgData.phiMnBot.toFixed(1)}`),
            summaryRow('\u03c6Vn (kN)', `${d.leftRes.svgData.phiVn.toFixed(1)}`, `${d.midRes.svgData.phiVn.toFixed(1)}`, `${d.rightRes.svgData.phiVn.toFixed(1)}`),
            summaryRow('Max DCR', `${d.leftRes.svgData.maxDCR.toFixed(2)}`, `${d.midRes.svgData.maxDCR.toFixed(2)}`, `${d.rightRes.svgData.maxDCR.toFixed(2)}`)
          ]
        },
        layout: {
          fillColor: (rowIndex) => rowIndex % 2 === 1 ? '#f8fafc' : null
        },
        margin: [0, 0, 0, 20]
      },

      // ── Beam Elevation Diagram ─────────────────────────────────────────────
      { text: 'BEAM ELEVATION — DETAILING ZONES', style: 'sectionLabel' },
      {
        svg: drawPdfElevationSVG(d.spanLn, d.beamType, d.leftRes.svgData, d.midRes.svgData, d.rightRes.svgData),
        width: 500,
        alignment: 'center',
        margin: [0, 6, 0, 18]
      },

      // ── Cross Section Diagrams ─────────────────────────────────────────────
      { text: 'CROSS-SECTION DIAGRAMS', style: 'sectionLabel' },
      {
        columns: [
          {
            width: '33%',
            stack: [
              { text: 'Left Support', style: 'subheader', alignment: 'center', margin: [0, 0, 0, 4] },
              { svg: drawPdfCrossSectionSVG(d.leftRes.svgData), width: 155, alignment: 'center' },
              capacityTable(d.leftRes.svgData)
            ]
          },
          {
            width: '33%',
            stack: [
              { text: 'Midspan', style: 'subheader', alignment: 'center', margin: [0, 0, 0, 4] },
              { svg: drawPdfCrossSectionSVG(d.midRes.svgData), width: 155, alignment: 'center' },
              capacityTable(d.midRes.svgData)
            ]
          },
          {
            width: '33%',
            stack: [
              { text: 'Right Support', style: 'subheader', alignment: 'center', margin: [0, 0, 0, 4] },
              { svg: drawPdfCrossSectionSVG(d.rightRes.svgData), width: 155, alignment: 'center' },
              capacityTable(d.rightRes.svgData)
            ]
          }
        ],
        columnGap: 10,
        margin: [0, 0, 0, 10]
      },

      // ── Detailed Calculations ──────────────────────────────────────────────
      {
        text: 'DETAILED CALCULATIONS — LEFT SUPPORT',
        style: 'sectionLabel',
        pageBreak: 'before'
      },
      ...calcHtmlToPdf(d.leftRes.details),

      { text: 'DETAILED CALCULATIONS — MIDSPAN', style: 'sectionLabel', pageBreak: 'before' },
      ...calcHtmlToPdf(d.midRes.details),

      { text: 'DETAILED CALCULATIONS — RIGHT SUPPORT', style: 'sectionLabel', pageBreak: 'before' },
      ...calcHtmlToPdf(d.rightRes.details)
    ],

    styles: {
      title: {
        fontSize: 22,
        bold: true,
        alignment: 'center',
        color: '#1e293b',
        margin: [0, 4, 0, 4]
      },
      subtitle: {
        fontSize: 10,
        alignment: 'center',
        color: '#64748b',
        margin: [0, 0, 0, 8]
      },
      sectionLabel: {
        fontSize: 10,
        bold: true,
        color: '#d97706',
        letterSpacing: 1,
        margin: [0, 10, 0, 6],
        decoration: 'underline',
        decorationStyle: 'solid',
        decorationColor: '#fde68a'
      },
      subheader: {
        fontSize: 10,
        bold: true,
        color: '#1e293b',
        margin: [0, 8, 0, 4]
      },
      calcSectionTitle: {
        fontSize: 11,
        bold: true,
        color: '#1e293b',
        margin: [0, 8, 0, 2]
      }
    },

    defaultStyle: {
      font: 'Roboto',
      fontSize: 10,
      color: '#1e293b',
      lineHeight: 1.3
    }
  };

  pdfMake.createPdf(docDefinition).download('LRFD_Beam_Design_Report.pdf');
});

function drawCrossSectionSVG(title, data, returnOnlySVG = false) {
  const { b, h, cover, topLayers, botLayers, diaMain, diaWeb, nTorBars, diaTor, sSpacing } = data;
  const svgW = 300;
  const svgH = 400;
  const scale = Math.min(250 / h, 250 / b);
  const sw = b * scale;
  const sh = h * scale;
  const offsetX = (svgW - sw) / 2;
  const offsetY = (svgH - sh) / 2 + 20;
  const c = cover * scale;

  let svg = `<svg viewBox="0 0 ${svgW} ${svgH}" width="100%" height="auto" style="background:#f8fafc; border-radius:8px; display:block;">`;

  // Concrete Outline
  svg += `<rect x="${offsetX}" y="${offsetY}" width="${sw}" height="${sh}" fill="#f1f5f9" stroke="#0f172a" stroke-width="3" rx="2"/>`;

  // Stirrup (always drawn visually to enclose the section)
  svg += `<rect x="${offsetX + c}" y="${offsetY + c}" width="${sw - 2 * c}" height="${sh - 2 * c}" fill="none" stroke="#db2777" stroke-width="2" stroke-dasharray="4,4" rx="4"/>`;

  // Rebars
  const drawLayer = (layers, isTop) => {
    let currentY = isTop ? offsetY + c + (diaWeb * scale) + (diaMain * scale) / 2 : offsetY + sh - c - (diaWeb * scale) - (diaMain * scale) / 2;
    const yDir = isTop ? 1 : -1;
    layers.forEach(numBars => {
      if (numBars > 0) {
        const barSpace = (sw - 2 * c - 2 * (diaWeb * scale) - (diaMain * scale)) / (numBars === 1 ? 1 : numBars - 1);
        const startX = offsetX + c + (diaWeb * scale) + (diaMain * scale) / 2;
        for (let i = 0; i < numBars; i++) {
          const bx = numBars === 1 ? offsetX + sw / 2 : startX + i * barSpace;
          svg += `<circle cx="${bx}" cy="${currentY}" r="${Math.max((diaMain * scale) / 2, 4)}" fill="#2563eb" stroke="#0f172a" stroke-width="1.5"/>`;
        }
      }
      currentY += yDir * (25 * scale + (diaMain * scale)); // 25mm clear
    });
  };
  drawLayer(topLayers, true);
  drawLayer(botLayers, false);

  if (nTorBars > 0) {
    const barsPerSide = Math.ceil(nTorBars / 2);
    const vSpace = (sh - 2 * c) / (barsPerSide + 1);
    for (let i = 1; i <= barsPerSide; i++) {
      const ty = offsetY + c + i * vSpace;
      svg += `<circle cx="${offsetX + c + (diaWeb * scale / 2)}" cy="${ty}" r="${Math.max((diaTor * scale) / 2, 3)}" fill="#ea580c" stroke="#0f172a" stroke-width="1.5"/>`;
      svg += `<circle cx="${offsetX + sw - c - (diaWeb * scale / 2)}" cy="${ty}" r="${Math.max((diaTor * scale) / 2, 3)}" fill="#ea580c" stroke="#0f172a" stroke-width="1.5"/>`;
    }
  }

  // Dimensions
  svg += `<text x="${offsetX + sw / 2}" y="${offsetY - 10}" text-anchor="middle" font-size="12" font-family="var(--font-m)" font-weight="bold" fill="#475569">${b.toFixed(1)} mm</text>`;
  svg += `<text x="${offsetX - 10}" y="${offsetY + sh / 2}" text-anchor="middle" font-size="12" font-family="var(--font-m)" font-weight="bold" fill="#475569" transform="rotate(-90 ${offsetX - 10} ${offsetY + sh / 2})">${h.toFixed(1)} mm</text>`;

  svg += `</svg>`;

  if (returnOnlySVG) {
    return svg;
  }

  // Wrapper
  let html = `<div style="background:#0f172a; border:1px solid #1e293b; border-radius:8px; padding:1.5rem; color:#f8fafc; display:flex; flex-direction:column; gap:1.5rem; height: 100%;">`;
  html += `<div><h3 style="color:#38bdf8; margin-top:0; margin-bottom:1rem; font-family:var(--font-b); font-size: 1.25rem;">${title}</h3>${svg}</div>`;

  // Capacities Block
  const { phiMnTop, phiMnBot, phiVn, phiTn, maxDCR, txtTop, txtBot, txtWeb, txtTor, Vu_kN } = data;
  const dcrColor = maxDCR <= 1.0 ? '#16a34a' : '#ef4444';
  const boxStyle = "border:1px solid #1e293b; border-radius:4px; padding:0.8rem; margin-bottom:0.4rem; display:flex; justify-content:space-between; align-items:center;";

  html += `<div style="font-family:var(--font-m); font-size:0.85rem;">
         <h4 style="color:#f8fafc; margin-top:0; margin-bottom:0.8rem; text-transform:uppercase; letter-spacing:0.05em; font-size:1rem;">Capacities</h4>
         
         <div style="border:1px solid #1e293b; border-radius:4px; padding:0.8rem; margin-bottom:0.4rem; display:flex; flex-direction:column; gap:0.5rem;">
            <div style="color:#f8fafc; font-weight:bold;">Flexure (&phi;Mn) Top/Bot</div>
            <div style="color:#f59e0b; font-weight:bold; font-family:monospace; font-size:0.95rem;">${phiMnTop.toFixed(1)} / ${phiMnBot.toFixed(1)} kN&middot;m</div>
         </div>
         
         <div style="${boxStyle}">
            <span style="color:#f8fafc; font-weight:bold;">Shear (&phi;Vn / Vu)</span>
            <span style="color:#f59e0b; font-weight:bold; font-family:monospace; font-size:0.95rem;">${phiVn.toFixed(1)} / ${Vu_kN.toFixed(1)} kN</span>
         </div>
         
         <div style="${boxStyle}">
            <span style="color:#f8fafc; font-weight:bold;">Torsion (&phi;Tn)</span>
            <span style="color:#f59e0b; font-weight:bold; font-family:monospace; font-size:0.95rem;">${phiTn.toFixed(1)} kN&middot;m</span>
         </div>
         
         <div style="${boxStyle}">
            <span style="color:#f8fafc; font-weight:bold;">DCR</span>
            <span style="background:${dcrColor}; color:#fff; padding:0.2rem 0.6rem; border-radius:4px; font-weight:bold; font-family:monospace; font-size:0.9rem;">${maxDCR.toFixed(2)} ${maxDCR <= 1.0 ? '&le;' : '&gt;'} 1.00</span>
         </div>
      </div>`;

  // Reinforcements Block
  html += `<div style="font-family:var(--font-m); font-size:0.85rem; margin-top:1rem;">
         <h4 style="color:#f8fafc; margin-top:0; margin-bottom:0.8rem; text-transform:uppercase; letter-spacing:0.05em; font-size:1rem;">Reinforcements</h4>
         
         <div style="${boxStyle}">
            <span style="color:#f8fafc; font-weight:bold;">Top bars</span>
            <strong style="color:#3b82f6; font-family:monospace; font-size:0.95rem;">${txtTop}</strong>
         </div>
         
         <div style="${boxStyle}">
            <span style="color:#f8fafc; font-weight:bold;">Bottom bars</span>
            <strong style="color:#3b82f6; font-family:monospace; font-size:0.95rem;">${txtBot}</strong>
         </div>
         
         <div style="${boxStyle}">
            <span style="color:#f8fafc; font-weight:bold;">Web bars</span>
            <strong style="color:#f59e0b; font-family:monospace; font-size:0.95rem;">${txtTor}</strong>
         </div>
         
         <div style="${boxStyle}">
            <span style="color:#f8fafc; font-weight:bold;">Stirrups</span>
            <strong style="color:#ec4899; font-family:monospace; font-size:0.95rem;">${txtWeb}</strong>
         </div>
      </div>`;

  let calcId = title === "Left Support" ? "calcLeft" : (title === "Midspan" ? "calcMid" : "calcRight");
  html += `<button type="button" onclick="showNotes('${calcId}')" style="background:#38bdf8; color:#0f172a; border:none; border-radius:4px; padding:0.6rem 1rem; font-family:var(--font-b); font-weight:bold; font-size:0.9rem; cursor:pointer; width:100%; margin-top:auto; transition:background 0.2s;" onmouseover="this.style.background='#0284c7'" onmouseout="this.style.background='#38bdf8'">View Calculations</button>`;

  html += `</div>`;
  return html;
}

function drawElevationSVG(spanLn, beamType, leftData, midData, rightData) {
  const svgW = 900;
  const svgH = 180;
  const h = leftData.h;
  const L = spanLn * 1000;
  const bH = 60;
  const bW = 800;
  const offsetX = 50;
  const offsetY = 50;

  let svg = `<svg viewBox="0 0 ${svgW} ${svgH}" width="100%" height="auto" style="background:#f8fafc; border-radius:8px; margin-bottom: 1.5rem;">`;

  // Concrete beam
  svg += `<rect x="${offsetX}" y="${offsetY}" width="${bW}" height="${bH}" fill="#e5e7eb" stroke="#0f172a" stroke-width="2"/>`;
  svg += `<rect x="${offsetX - 30}" y="${offsetY}" width="30" height="${bH + 40}" fill="#94a3b8" stroke="#0f172a"/>`;
  svg += `<rect x="${offsetX + bW}" y="${offsetY}" width="30" height="${bH + 40}" fill="#94a3b8" stroke="#0f172a"/>`;

  const zone2h_px = (2 * h / L) * bW;
  const leftZoneW = beamType === 'smrf' ? Math.min(zone2h_px, bW / 3) : bW / 4;
  const rightZoneW = beamType === 'smrf' ? Math.min(zone2h_px, bW / 3) : bW / 4;

  // Top and Bottom Rebars (Thick blue lines)
  svg += `<line x1="${offsetX}" y1="${offsetY + 8}" x2="${offsetX + bW}" y2="${offsetY + 8}" stroke="#2563eb" stroke-width="4"/>`;
  svg += `<line x1="${offsetX}" y1="${offsetY + bH - 8}" x2="${offsetX + bW}" y2="${offsetY + bH - 8}" stroke="#2563eb" stroke-width="4"/>`;

  const drawLines = (start, width, density, color) => {
    const count = Math.floor(width / density);
    for (let i = 0; i <= count; i++) {
      const x = start + i * density;
      // Vertical stirrup lines between top and bot rebars
      svg += `<line x1="${x}" y1="${offsetY + 6}" x2="${x}" y2="${offsetY + bH - 6}" stroke="${color}" stroke-width="1.5"/>`;
    }
  };

  drawLines(offsetX + 5, leftZoneW, beamType === 'smrf' ? 5 : 12, '#db2777'); // Magenta/pink
  drawLines(offsetX + leftZoneW + 10, bW - leftZoneW - rightZoneW - 20, 18, '#94a3b8'); // Blue-grey
  drawLines(offsetX + bW - rightZoneW, rightZoneW - 5, beamType === 'smrf' ? 5 : 12, '#db2777'); // Magenta/pink

  // Labels
  const hingeTxt = beamType === 'smrf' ? `Hinge (${(2 * h).toFixed(0)}mm)` : 'Support Zone';
  svg += `<line x1="${offsetX}" y1="${offsetY + bH + 15}" x2="${offsetX + leftZoneW}" y2="${offsetY + bH + 15}" stroke="#db2777" stroke-width="1"/>`;
  svg += `<text x="${offsetX + leftZoneW / 2}" y="${offsetY + bH + 30}" text-anchor="middle" font-size="11" font-family="var(--font-m)" font-weight="bold" fill="#db2777">${hingeTxt}</text>`;

  svg += `<line x1="${offsetX + bW - rightZoneW}" y1="${offsetY + bH + 15}" x2="${offsetX + bW}" y2="${offsetY + bH + 15}" stroke="#db2777" stroke-width="1"/>`;
  svg += `<text x="${offsetX + bW - rightZoneW / 2}" y="${offsetY + bH + 30}" text-anchor="middle" font-size="11" font-family="var(--font-m)" font-weight="bold" fill="#db2777">${hingeTxt}</text>`;

  svg += `<text x="${offsetX + bW / 2}" y="${offsetY + bH + 25}" text-anchor="middle" font-size="12" font-family="var(--font-m)" font-weight="bold" fill="#475569">Midspan</text>`;

  svg += `</svg>`;
  return svg;
}