/**
 * lrfdscript.js -- UI, SVG, PDF, and event-handling layer.
 *
 * All engineering computation (flexure, shear, torsion, SMRF) has been
 * migrated to the Python serverless backend at /api/compute_lrfd.
 * The computeBtn click handler below POSTs the form inputs to that
 * endpoint and receives { leftRes, midRes, rightRes } in return.
 */


// ---------- Set defaults ----------
document.getElementById('projDate').value = new Date().toISOString().split('T')[0];

// ---------- Modal controls ----------
const resultsModal = document.getElementById('resultsModal');
const reopenBtn = document.getElementById('reopenResultsBtn');

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

document.getElementById('computeBtn').addEventListener('click', async () => {
  const beamType = document.getElementById('beamType').value;
  const b = parseFloat(document.getElementById('b').value) || 0;
  const h = parseFloat(document.getElementById('h').value) || 0;
  const spanLn = parseFloat(document.getElementById('spanLn').value) || 0;
  const fc = parseFloat(document.getElementById('fc').value) || 0;
  const cover = parseFloat(document.getElementById('cover').value) || 0;

  const fyMain = parseFloat(document.getElementById('fyMain').value) || 0;
  const diaMain = parseFloat(document.getElementById('diaMain').value) || 0;
  const fyWeb = parseFloat(document.getElementById('fyWeb').value) || 0;
  const diaWeb = parseFloat(document.getElementById('diaWeb').value) || 0;
  const nLegs = parseFloat(document.getElementById('nLegs').value) || 0;
  const fyTor = parseFloat(document.getElementById('fyTor').value) || 0;
  const diaTor = parseFloat(document.getElementById('diaTor').value) || 0;

  const lambda = parseFloat(document.getElementById('concreteWeight').value) || 1.0;
  const maxAgg = parseFloat(document.getElementById('maxAgg').value) || 20;

  if (b <= 0 || h <= 0 || spanLn <= 0 || fc <= 0 || fyMain <= 0 || fyWeb <= 0 || nLegs <= 0 || fyTor <= 0 || cover <= 0) {
    alert('Please enter valid beam and reinforcement parameters.');
    return;
  }

  // ── Build payload (matches all form fields) ──────────────────────────────
  const payload = {
    beamType, b, h, spanLn, fc, cover,
    fyMain, diaMain, fyWeb, diaWeb, nLegs, fyTor, diaTor,
    lambda, maxAgg,
    leftMuTop: parseFloat(document.getElementById('leftMuTop').value) || 0,
    leftMuBot: parseFloat(document.getElementById('leftMuBot').value) || 0,
    leftVu: parseFloat(document.getElementById('leftVu').value) || 0,
    leftTu: parseFloat(document.getElementById('leftTu').value) || 0,
    midMuTop: parseFloat(document.getElementById('midMuTop').value) || 0,
    midMuBot: parseFloat(document.getElementById('midMuBot').value) || 0,
    midVu: parseFloat(document.getElementById('midVu').value) || 0,
    midTu: parseFloat(document.getElementById('midTu').value) || 0,
    rightMuTop: parseFloat(document.getElementById('rightMuTop').value) || 0,
    rightMuBot: parseFloat(document.getElementById('rightMuBot').value) || 0,
    rightVu: parseFloat(document.getElementById('rightVu').value) || 0,
    rightTu: parseFloat(document.getElementById('rightTu').value) || 0,
    // Serviceability parameters
    svc_wD: parseFloat(document.getElementById('svc_wD').value) || 0,
    svc_wL: parseFloat(document.getElementById('svc_wL').value) || 0,
    svc_sus: parseFloat(document.getElementById('svc_sus').value) || 0.3,
    svc_support: document.getElementById('svc_support').value,
    svc_sensitive: document.getElementById('svc_sensitive').value,
  };

  if (beamType === 'smrf') {
    const wu = 1.2 * (parseFloat(document.getElementById('wD').value) || 0)
      + 1.0 * (parseFloat(document.getElementById('wL').value) || 0);
    const vg = parseFloat(document.getElementById('vg').value) || 0;
    if (wu <= 0 && vg <= 0) {
      alert('SMRF mode requires Service Dead and Live loads, or an explicit Service Shear Vg.\nPlease enter them in the SMRF Seismic Parameters section.');
      return;
    }
    payload.wD = parseFloat(document.getElementById('wD').value) || 0;
    payload.wL = parseFloat(document.getElementById('wL').value) || 0;
    payload.vg = vg;
    payload.bCol = parseFloat(document.getElementById('bCol').value) || 0;
  }

  // ── Call Python backend ──────────────────────────────────────────────────
  // Uses standalone Python server on :8000 (bypasses Vercel dev module cache)
  const computeBtn = document.getElementById('computeBtn');
  const origText = computeBtn.textContent;
  computeBtn.textContent = 'Calculating...';
  computeBtn.disabled = true;

  const API_URL = window.location.hostname === 'localhost'
    ? 'http://localhost:8000/api/compute_lrfd'
    : '/api/compute_lrfd';

  let leftRes, midRes, rightRes, svcRes;
  try {
    const resp = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await resp.json();
    if (!resp.ok) {
      alert('Computation error: ' + (data.error || resp.statusText));
      return;
    }
    leftRes = data.leftRes;
    midRes = data.midRes;
    rightRes = data.rightRes;
    svcRes = data.svcRes;
  } catch (err) {
    alert('Network error -- could not reach the compute API.\n' + err.message);
    return;
  } finally {
    computeBtn.textContent = origText;
    computeBtn.disabled = false;
  }

  // ── Update results table ────────────────────────────────────────────────
  document.getElementById('resLeftTop').textContent = leftRes.top;
  document.getElementById('resLeftBot').textContent = leftRes.bot;
  document.getElementById('resLeftWeb').textContent = leftRes.web;
  document.getElementById('resLeftTor').textContent = leftRes.tor;
  document.getElementById('calcLeft').innerHTML = leftRes.details;

  document.getElementById('resMidTop').textContent = midRes.top;
  document.getElementById('resMidBot').textContent = midRes.bot;
  document.getElementById('resMidWeb').textContent = midRes.web;
  document.getElementById('resMidTor').textContent = midRes.tor;
  document.getElementById('calcMid').innerHTML = midRes.details;

  document.getElementById('resRightTop').textContent = rightRes.top;
  document.getElementById('resRightBot').textContent = rightRes.bot;
  document.getElementById('resRightWeb').textContent = rightRes.web;
  document.getElementById('resRightTor').textContent = rightRes.tor;
  document.getElementById('calcRight').innerHTML = rightRes.details;

  // ── Diagrams ────────────────────────────────────────────────────────────
  const diagContainer = document.getElementById('diagramContainer');
  let diagHTML = `<h3 style="text-align:center; color:var(--amber); margin-bottom:1rem;">Detailing Diagrams</h3>`;
  diagHTML += drawElevationSVG(spanLn, beamType, leftRes.svgData, midRes.svgData, rightRes.svgData);
  diagHTML += `<div class="cross-sections-row" style="display:flex; justify-content:space-between; gap:1rem; flex-wrap:wrap;">`;
  diagHTML += `<div class="diagram-wrapper" style="flex:1; min-width:250px; width:100%;">${drawCrossSectionSVG('Left Support', leftRes.svgData)}</div>`;
  diagHTML += `<div class="diagram-wrapper" style="flex:1; min-width:250px; width:100%;">${drawCrossSectionSVG('Midspan', midRes.svgData)}</div>`;
  diagHTML += `<div class="diagram-wrapper" style="flex:1; min-width:250px; width:100%;">${drawCrossSectionSVG('Right Support', rightRes.svgData)}</div>`;
  diagHTML += `</div>`;
  diagContainer.innerHTML = diagHTML;

  // ── Serviceability Results ──────────────────────────────────────────────
  const svcPanel = document.getElementById('svcResults');
  const svcBody  = document.getElementById('svcTableBody');
  const svcDet   = document.getElementById('svcDetails');
  if (svcRes && svcRes.summary && svcRes.summary.length) {
    svcPanel.style.display = '';
    svcBody.innerHTML = svcRes.summary.map(row => {
      const badge = row.pass
        ? '<span style="background:#16a34a;color:#fff;padding:2px 8px;border-radius:4px;font-size:0.75rem;">PASS</span>'
        : '<span style="background:#dc2626;color:#fff;padding:2px 8px;border-radius:4px;font-size:0.75rem;">FAIL</span>';
      return `<tr><td>${row.label}</td><td>${row.computed}</td><td>${row.allow}</td><td>${badge}</td></tr>`;
    }).join('');
    if (svcDet) svcDet.innerHTML = svcRes.details || '';
  } else {
    svcPanel.style.display = 'none';
  }

  openResultsModal();
  reopenBtn.style.display = 'inline-block';

  // ── Sync SMRF wD/wL with serviceability fields ───────────────────────────
  if (beamType === 'smrf') {
    const smrfWD = parseFloat(document.getElementById('wD')?.value) || 0;
    const smrfWL = parseFloat(document.getElementById('wL')?.value) || 0;
    if (smrfWD) document.getElementById('svc_wD').value = smrfWD;
    if (smrfWL) document.getElementById('svc_wL').value = smrfWL;
  }

  window.currentDesignData = {
    beamType, b, h, spanLn, fc, cover, fyMain, diaMain, fyWeb, diaWeb, nLegs, fyTor, diaTor,
    leftRes, midRes, rightRes, svcRes,
    proj: {
      name:       document.getElementById('projName').value || '',
      no:         document.getElementById('projNo').value || '',
      client:     document.getElementById('projClient').value || '',
      designedBy: document.getElementById('projDesignedBy').value || '',
      checkedBy:  document.getElementById('projCheckedBy').value || '',
      date:       document.getElementById('projDate').value || '',
    },
    svcInputs: {
      wD:        parseFloat(document.getElementById('svc_wD').value) || 0,
      wL:        parseFloat(document.getElementById('svc_wL').value) || 0,
      sus:       parseFloat(document.getElementById('svc_sus').value) || 0.3,
      support:   document.getElementById('svc_support').options[document.getElementById('svc_support').selectedIndex].text,
      sensitive: document.getElementById('svc_sensitive').options[document.getElementById('svc_sensitive').selectedIndex].text,
    },
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
   *   <div class="calc-section"><h4>...</h4><p class="calc-step">...</p>...</div>
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
      sec.querySelectorAll('.p').forEach(() => { }); // no-op; use generic
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
   * Draw a cross-section SVG with NO CSS variables -- uses hard-coded hex
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

    // Dimension labels -- no CSS font vars
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
          [{ text: '\u03c6Mn Top', fontSize: 8 }, { text: `${phiMnTop.toFixed(1)} kN\u00B7m`, fontSize: 8 }],
          [{ text: '\u03c6Mn Bot', fontSize: 8 }, { text: `${phiMnBot.toFixed(1)} kN\u00B7m`, fontSize: 8 }],
          [{ text: '\u03c6Vn / Vu', fontSize: 8 }, { text: `${phiVn.toFixed(1)} / ${Vu_kN.toFixed(1)} kN`, fontSize: 8 }],
          [{ text: '\u03c6Tn', fontSize: 8 }, { text: `${phiTn.toFixed(1)} kN\u00B7m`, fontSize: 8 }],
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
        { text: (d.proj && d.proj.name) ? `${d.proj.name}  \u2014  LRFD Beam Design` : 'LRFD Beam Design Report', fontSize: 8, color: '#94a3b8', margin: [40, 20, 0, 0] },
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
      // ── Project Information ─────────────────────────────────────────────────
      ...(d.proj && (d.proj.name || d.proj.no || d.proj.designedBy) ? [{
        table: {
          widths: ['*', '*'],
          body: [
            [
              {
                stack: [
                  { text: d.proj.name || '\u2014', fontSize: 14, bold: true, color: '#1e293b', margin: [0, 0, 0, 2] },
                  { text: `Project No.: ${d.proj.no || '\u2014'}`, fontSize: 8, color: '#64748b' },
                  { text: `Client: ${d.proj.client || '\u2014'}`, fontSize: 8, color: '#64748b' }
                ],
                border: [false, false, false, false]
              },
              {
                stack: [
                  { text: `Designed by: ${d.proj.designedBy || '\u2014'}`, fontSize: 8, color: '#475569', margin: [0, 2, 0, 1] },
                  { text: `Checked by:  ${d.proj.checkedBy || '\u2014'}`, fontSize: 8, color: '#475569', margin: [0, 0, 0, 1] },
                  { text: `Date: ${d.proj.date || '\u2014'}`, fontSize: 8, color: '#475569' }
                ],
                alignment: 'right',
                border: [false, false, false, false]
              }
            ]
          ]
        },
        layout: 'noBorders',
        margin: [0, 0, 0, 6]
      }, {
        canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 0.5, lineColor: '#e2e8f0' }],
        margin: [0, 0, 0, 14]
      }] : [{
        canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 0.5, lineColor: '#e2e8f0' }],
        margin: [0, 8, 0, 14]
      }]),

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
                    [{ text: 'fy Main', bold: true, fontSize: 9 }, { text: `${d.fyMain} MPa, \u00D8${d.diaMain}`, fontSize: 9 }],
                    [{ text: 'fy Stirrup', bold: true, fontSize: 9 }, { text: `${d.fyWeb} MPa, \u00D8${d.diaWeb} (${d.nLegs} legs)`, fontSize: 9 }],
                    [{ text: 'fy Torsion', bold: true, fontSize: 9 }, { text: `${d.fyTor} MPa, \u00D8${d.diaTor}`, fontSize: 9 }]
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
            summaryRow('\u03c6Mn Top (kN\u00B7m)', `${d.leftRes.svgData.phiMnTop.toFixed(1)}`, `${d.midRes.svgData.phiMnTop.toFixed(1)}`, `${d.rightRes.svgData.phiMnTop.toFixed(1)}`),
            summaryRow('\u03c6Mn Bot (kN\u00B7m)', `${d.leftRes.svgData.phiMnBot.toFixed(1)}`, `${d.midRes.svgData.phiMnBot.toFixed(1)}`, `${d.rightRes.svgData.phiMnBot.toFixed(1)}`),
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
      { text: 'BEAM ELEVATION -- DETAILING ZONES', style: 'sectionLabel' },
      {
        svg: drawPdfElevationSVG(d.spanLn, d.beamType, d.leftRes.svgData, d.midRes.svgData, d.rightRes.svgData),
        width: 500,
        alignment: 'center',
        margin: [0, 6, 0, 18]
      },

      // ── Cross Section Diagrams ─────────────────────────────────────────────
      { text: 'CROSS-SECTION DIAGRAMS', style: 'sectionLabel', pageBreak: 'before' },
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
        text: 'DETAILED CALCULATIONS -- LEFT SUPPORT',
        style: 'sectionLabel',
        pageBreak: 'before'
      },
      ...calcHtmlToPdf(d.leftRes.details),

      { text: 'DETAILED CALCULATIONS -- MIDSPAN', style: 'sectionLabel', pageBreak: 'before' },
      ...calcHtmlToPdf(d.midRes.details),

      { text: 'DETAILED CALCULATIONS -- RIGHT SUPPORT', style: 'sectionLabel', pageBreak: 'before' },
      ...calcHtmlToPdf(d.rightRes.details),

      // ── Serviceability Check ───────────────────────────────────────────────
      ...(d.svcRes ? [
        { text: 'SERVICEABILITY CHECK (ACI 318-14 \u00a724 / NSCP 2015 \u00a7406)', style: 'sectionLabel', pageBreak: 'before' },
        // Summary table
        {
          table: {
            headerRows: 1,
            widths: ['*', 'auto', 'auto', 'auto'],
            body: [
              [
                { text: 'Check', bold: true, fontSize: 9, fillColor: '#1e293b', color: '#f8fafc' },
                { text: 'Computed', bold: true, fontSize: 9, fillColor: '#1e293b', color: '#f8fafc' },
                { text: 'Allowable', bold: true, fontSize: 9, fillColor: '#1e293b', color: '#f8fafc' },
                { text: 'Status', bold: true, fontSize: 9, fillColor: '#1e293b', color: '#f8fafc' }
              ],
              ...(d.svcRes.summary || []).map(row => [
                { text: row.label, fontSize: 9 },
                { text: row.computed, fontSize: 9 },
                { text: row.allow, fontSize: 9 },
                { text: row.pass ? 'PASS' : 'FAIL', fontSize: 9, bold: true, color: row.pass ? '#16a34a' : '#dc2626' }
              ])
            ]
          },
          layout: { fillColor: (r) => r % 2 === 1 ? '#f8fafc' : null },
          margin: [0, 0, 0, 16]
        },
        // Serviceability inputs summary
        ...(d.svcInputs ? [{
          columns: [
            { text: `wD = ${d.svcInputs.wD} kN/m`, fontSize: 8, color: '#475569' },
            { text: `wL = ${d.svcInputs.wL} kN/m`, fontSize: 8, color: '#475569' },
            { text: `\u03b2sus = ${d.svcInputs.sus}`, fontSize: 8, color: '#475569' },
            { text: d.svcInputs.support, fontSize: 8, color: '#475569' },
            { text: d.svcInputs.sensitive, fontSize: 8, color: '#475569' }
          ],
          columnGap: 8,
          margin: [0, 0, 0, 14]
        }] : []),
        // Detailed serviceability calcs
        ...calcHtmlToPdf(d.svcRes.details || '')
      ] : [])
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
