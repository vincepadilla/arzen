export function renderList(shapes, sectionsList, resultCount, currentDesignation, onSelectCallback) {
  resultCount.textContent = shapes.length;
  sectionsList.innerHTML = '';

  shapes.forEach(shape => {
    const div = document.createElement('div');
    div.className = 'section-item';
    if (shape.designation === currentDesignation) {
      div.classList.add('active');
    }

    const nameSpan = document.createElement('span');
    nameSpan.textContent = shape.designation;

    const descSpan = document.createElement('span');
    descSpan.className = 'sec-desc';
    descSpan.textContent = `${shape.weight ? shape.weight.toFixed(1) + ' kg/m' : ''} | d=${shape.d || '-'}mm`;

    div.appendChild(nameSpan);
    div.appendChild(descSpan);

    div.addEventListener('click', () => {
      // Remove active from siblings
      Array.from(sectionsList.children).forEach(c => c.classList.remove('active'));
      div.classList.add('active');

      if (onSelectCallback) {
        onSelectCallback(shape.designation);
      }
    });

    sectionsList.appendChild(div);
  });
}

export function updateProperties(data, container) {
  if (!container) return;

  if (!data) {
    container.innerHTML = `<p style="color: var(--mist); font-family: var(--font-m); font-size: 0.9rem;">Select a section to view properties.</p>`;
    return;
  }

  const renderItem = (label, val, unit = '') => {
    if (val === null || val === undefined || val === '') return '';
    return `<div class="prop-item"><span>${label}</span><span class="val">${val} ${unit}</span></div>`;
  };

  let html = '';

  // Basic Properties
  html += `<div class="prop-category-title">Basic Properties</div>`;
  html += `<div class="properties-grid">`;
  html += renderItem('Designation', data.designation);
  html += renderItem('Type', data.type);
  html += renderItem('Weight (W)', data.weight, 'kg/m');
  html += renderItem('Area (A)', data.area, 'mm²');
  html += renderItem('Depth (d)', data.d, 'mm');
  html += renderItem('Width (bf)', data.bf, 'mm');
  html += renderItem('Web Thickness (tw)', data.tw, 'mm');
  html += renderItem('Flange Thickness (tf)', data.tf, 'mm');
  html += `</div>`;

  // Geometric Properties
  const geomItems = [
    renderItem('Ix', data.Ix, 'x10⁶ mm⁴'),
    renderItem('Iy', data.Iy, 'x10⁶ mm⁴'),
    renderItem('Sx', data.Sx, 'x10³ mm³'),
    renderItem('Sy', data.Sy, 'x10³ mm³'),
    renderItem('Zx', data.Zx, 'x10³ mm³'),
    renderItem('Zy', data.Zy, 'x10³ mm³'),
    renderItem('rx', data.rx, 'mm'),
    renderItem('ry', data.ry, 'mm'),
    renderItem('rz', data.rz, 'mm'),
    renderItem('J', data.J, 'x10³ mm⁴'),
    renderItem('Cw', data.Cw, 'x10⁹ mm⁶'),
    renderItem('x', data.x, 'mm'),
    renderItem('y', data.y, 'mm'),
    renderItem('xp', data.xp, 'mm'),
    renderItem('yp', data.yp, 'mm')
  ].filter(x => x !== '');

  if (geomItems.length > 0) {
    html += `<div class="prop-category-title">Geometric Properties</div>`;
    html += `<div class="properties-grid">${geomItems.join('')}</div>`;
  }

  // Additional Properties
  const addItems = [
    renderItem('rts', data.rts, 'mm'),
    renderItem('ho', data.ho, 'mm'),
    renderItem('kdes', data.kdes, 'mm'),
    renderItem('T', data.T_dim, 'mm'),
    renderItem('b/t', data.b_t),
    renderItem('h/tw', data.h_tw),
    renderItem('bf/2tf', data.bf_2tf),
    renderItem('D/t', data.D_t),
    renderItem('b/tdes', data.b_tdes),
    renderItem('h/tdes', data.h_tdes)
  ].filter(x => x !== '');

  if (addItems.length > 0) {
    html += `<div class="prop-category-title">Additional Properties</div>`;
    html += `<div class="properties-grid">${addItems.join('')}</div>`;
  }

  container.innerHTML = html;
}

const fillColor = "#1e293b"; // Dark profile
const strokeColor = "none"; // No outer stroke needed if filled dark
const strokeWidth = "0.75";
const dimColor = "#475569"; // Clear, dark dimension lines

const drawLabel = (x, y, text, align = 'middle', baseline = 'middle') => `
  <text x="${x}" y="${y}" fill="${dimColor}" font-size="5" font-family="Inter, system-ui, sans-serif" font-weight="500" text-anchor="${align}" alignment-baseline="${baseline}" paint-order="stroke" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${text}</text>
`;

const drawVerticalDimension = (x, y1, y2, labelText, offset = -8) => {
  const lineX = x + offset;
  const midY = (y1 + y2) / 2;
  return `
    <line x1="${lineX - 2}" y1="${y1}" x2="${x > lineX ? x : lineX + 2}" y2="${y1}" stroke="${dimColor}" stroke-width="0.3" stroke-dasharray="1 1"/>
    <line x1="${lineX - 2}" y1="${y2}" x2="${x > lineX ? x : lineX + 2}" y2="${y2}" stroke="${dimColor}" stroke-width="0.3" stroke-dasharray="1 1"/>
    <line x1="${lineX}" y1="${y1}" x2="${lineX}" y2="${y2}" stroke="${dimColor}" stroke-width="0.5" marker-start="url(#dimArrow)" marker-end="url(#dimArrow)"/>
    ${drawLabel(lineX - 2, midY, labelText, 'end', 'middle')}
  `;
};

const drawHorizontalDimension = (x1, x2, y, labelText, offset = 8) => {
  const lineY = y + offset;
  const midX = (x1 + x2) / 2;
  return `
    <line x1="${x1}" y1="${lineY > y ? y : lineY - 2}" x2="${x1}" y2="${lineY > y ? lineY + 2 : y}" stroke="${dimColor}" stroke-width="0.3" stroke-dasharray="1 1"/>
    <line x1="${x2}" y1="${lineY > y ? y : lineY - 2}" x2="${x2}" y2="${lineY > y ? lineY + 2 : y}" stroke="${dimColor}" stroke-width="0.3" stroke-dasharray="1 1"/>
    <line x1="${x1}" y1="${lineY}" x2="${x2}" y2="${lineY}" stroke="${dimColor}" stroke-width="0.5" marker-start="url(#dimArrow)" marker-end="url(#dimArrow)"/>
    ${drawLabel(midX, lineY + (offset > 0 ? 3 : -3), labelText, 'middle', offset > 0 ? 'hanging' : 'baseline')}
  `;
};

export function renderSection(data) {
  const type = data.type || (data.designation ? data.designation.split(/[^a-zA-Z]/)[0] : 'BUILT-UP');
  
  const d = data.d || data.H || data.OD || 100;
  let bf = data.bf || data.b || data.B || 100;
  const tw = data.tw || data.t || data.tdes || 10;
  const tf = data.tf || data.t || data.tdes || 10;

  let spacing = data.spacing || 10;
  if (type === '2L' || data.builtUpType === 'DOUBLE-ANGLE') {
    bf = (data.b || data.bf || 50) * 2 + spacing;
  }

  const padding = 25;
  const maxDim = Math.max(d, bf);
  const scale = (100 - 2 * padding) / maxDim;

  const ctx = {
    data,
    scaledD: d * scale,
    scaledBf: bf * scale,
    scaledTw: Math.max(tw * scale, 1.5),
    scaledTf: Math.max(tf * scale, 1.5),
    spacing: spacing * scale,
    cx: 50,
    cy: 50,
    scale,
    get xLeft() { return this.cx - this.scaledBf / 2; },
    get yTop() { return this.cy - this.scaledD / 2; },
    get yBottom() { return this.cy + this.scaledD / 2; },
    get xRight() { return this.cx + this.scaledBf / 2; }
  };

  let result = { svgContent: '', dimLine: '' };

  if (['W', 'M', 'HP', 'S'].includes(type)) {
    result = renderWSection(ctx);
  } else if (['C', 'MC'].includes(type)) {
    result = renderChannel(ctx);
  } else if (type === 'L') {
    result = renderAngle(ctx);
  } else if (type === '2L') {
    result = renderDoubleAngle(ctx);
  } else if (['WT', 'MT', 'ST'].includes(type)) {
    result = renderTee(ctx);
  } else if (type === 'HSS') {
    if (data.OD) {
      result = renderRoundHSS(ctx);
    } else {
      result = renderHSS(ctx);
    }
  } else if (type === 'BUILT-UP') {
    result = renderBuiltUpSection(ctx, data);
  } else {
    // Default fallback
    result.svgContent = `<rect class="hover-component" data-tooltip="Section" x="${ctx.xLeft}" y="${ctx.yTop}" width="${ctx.scaledBf}" height="${ctx.scaledD}" fill="${fillColor}" stroke="${strokeColor}" stroke-width="${strokeWidth}" />`;
  }

  return `
    <svg width="100%" height="100%" viewBox="0 0 100 100" style="max-width: 350px; overflow: visible;">
      <defs>
        <marker id="dimArrow" markerWidth="4" markerHeight="4" refX="2" refY="2" orient="auto-start-reverse">
          <path d="M 0 0 L 4 2 L 0 4 z" fill="${dimColor}" />
        </marker>
      </defs>
      ${result.svgContent}
      ${result.dimLine}
    </svg>
  `;
}

export function updateIllustration(data, container) {
  if (!container) return;
  if (!data) {
    container.innerHTML = `<p style="color: var(--mist); font-family: var(--font-m); font-size: 0.9rem;">Select a section to view illustration.</p>`;
    return;
  }
  
  const designation = data.designation || 'Built-up Section';
  const type = data.type || data.builtUpType || 'Built-up';
  const source = data.source || 'AISC 14th Edition';
  let dims = [];
  if (data.d || data.H || data.OD) dims.push(`d=${data.d || data.H || data.OD}`);
  if (data.bf || data.b || data.B) dims.push(`bf=${data.bf || data.b || data.B}`);
  if (data.tw || data.t || data.tdes) dims.push(`tw=${data.tw || data.t || data.tdes}`);
  if (data.tf) dims.push(`tf=${data.tf}`);
  const dimensions = dims.join(', ');

  const svgHTML = renderSection(data);
  
  container.innerHTML = `
    <style>
      @keyframes sectionFadeIn {
        from { opacity: 0; transform: scale(0.98); }
        to { opacity: 1; transform: scale(1); }
      }
      .steel-illustration-container { display: flex; flex-direction: column; width: 100%; height: 100%; animation: sectionFadeIn 0.3s cubic-bezier(0.4, 0, 0.2, 1); }
      .steel-section-info { font-size: 0.8rem; color: var(--mist); text-align: left; padding-bottom: 12px; line-height: 1.4; border-bottom: 1px solid var(--border); margin-bottom: 12px; }
      .steel-section-info strong { color: var(--chalk); font-size: 1rem; display: block; margin-bottom: 4px; }
      .steel-illustration-wrapper { position: relative; width: 100%; flex-grow: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; overflow: hidden; min-height: 250px; }
      .steel-zoom-controls { position: absolute; bottom: 8px; right: 8px; display: flex; flex-direction: column; gap: 4px; z-index: 10; }
      .steel-zoom-controls button { background: #ffffff; color: #475569; border: 1px solid #cbd5e1; border-radius: 4px; width: 28px; height: 28px; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 1.1rem; box-shadow: 0 1px 2px rgba(0,0,0,0.05); transition: all 0.1s; }
      .steel-zoom-controls button:hover { background: #f8fafc; color: #0f172a; border-color: #94a3b8; }
      .steel-tooltip { position: absolute; display: none; background: #1e293b; color: #f8fafc; padding: 4px 8px; border-radius: 4px; font-size: 0.75rem; pointer-events: none; white-space: nowrap; z-index: 20; transform: translate(-50%, -100%); margin-top: -12px; transition: top 0.05s, left 0.05s; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); }
      .hover-component { transition: fill 0.15s; cursor: crosshair; }
      .hover-component:hover { fill: #3b82f6 !important; }
      .svg-pan-zoom-container { transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1); transform-origin: center; width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; background: #ffffff; border-radius: 8px; border: 1px solid #e2e8f0; }
    </style>
    <div class="steel-illustration-container">
      <div class="steel-section-info">
        <strong>${designation}</strong>
        Type: ${type} &nbsp;|&nbsp; Source: ${source}<br>
        Dimensions: ${dimensions}
      </div>
      <div class="steel-illustration-wrapper">
        <div class="steel-zoom-controls">
          <button id="zoomInBtn" title="Zoom In">+</button>
          <button id="zoomOutBtn" title="Zoom Out">-</button>
        </div>
        <div class="svg-pan-zoom-container" id="svgContainer" data-scale="1">
          ${svgHTML}
        </div>
        <div class="steel-tooltip" id="steelTooltip"></div>
      </div>
    </div>
  `;

  // Attach interactions
  const wrapper = container.querySelector('.steel-illustration-wrapper');
  const tooltip = container.querySelector('#steelTooltip');
  const components = container.querySelectorAll('.hover-component');
  const svgContainer = container.querySelector('#svgContainer');
  const zoomInBtn = container.querySelector('#zoomInBtn');
  const zoomOutBtn = container.querySelector('#zoomOutBtn');

  components.forEach(comp => {
    comp.addEventListener('mouseenter', (e) => {
      tooltip.textContent = comp.getAttribute('data-tooltip');
      tooltip.style.display = 'block';
    });
    comp.addEventListener('mousemove', (e) => {
      const rect = wrapper.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      tooltip.style.left = x + 'px';
      tooltip.style.top = y + 'px';
    });
    comp.addEventListener('mouseleave', () => {
      tooltip.style.display = 'none';
    });
  });

  let currentScale = 1;
  zoomInBtn.addEventListener('click', () => {
    currentScale = Math.min(currentScale + 0.2, 3);
    svgContainer.style.transform = `scale(${currentScale})`;
  });
  zoomOutBtn.addEventListener('click', () => {
    currentScale = Math.max(currentScale - 0.2, 0.5);
    svgContainer.style.transform = `scale(${currentScale})`;
  });
}

function renderWSection(ctx) {
  const { data, xLeft, yTop, yBottom, xRight, scaledBf, scaledTf, scaledTw, scaledD, cx, cy } = ctx;
  const bf = data.bf || data.b || '-';
  const tf = data.tf || data.t || '-';
  const d = data.d || data.H || '-';
  const tw = data.tw || data.t || '-';
  const svgContent = `
    <rect class="hover-component" data-tooltip="Top Flange: bf=${bf}, tf=${tf}" x="${xLeft}" y="${yTop}" width="${scaledBf}" height="${scaledTf}" fill="${fillColor}" stroke="${strokeColor}" stroke-width="${strokeWidth}" />
    <rect class="hover-component" data-tooltip="Web: d=${d}, tw=${tw}" x="${cx - scaledTw / 2}" y="${yTop + scaledTf}" width="${scaledTw}" height="${Math.max(0, scaledD - 2 * scaledTf)}" fill="${fillColor}" stroke="${strokeColor}" stroke-width="${strokeWidth}" />
    <rect class="hover-component" data-tooltip="Bottom Flange: bf=${bf}, tf=${tf}" x="${xLeft}" y="${yBottom - scaledTf}" width="${scaledBf}" height="${scaledTf}" fill="${fillColor}" stroke="${strokeColor}" stroke-width="${strokeWidth}" />
  `;
  let dimLine = '';
  dimLine += drawVerticalDimension(xLeft, yTop, yBottom, 'd');
  dimLine += drawHorizontalDimension(xLeft, xRight, yTop, 'bf', -15);
  dimLine += drawHorizontalDimension(cx, cx + scaledTw/2, cy, 'tw', 3);
  dimLine += drawVerticalDimension(xRight, yBottom - scaledTf, yBottom, 'tf', 8);
  return { svgContent, dimLine };
}

function renderBuiltUpSection(ctx, data) {
  const shape = data.builtUpType || 'I-SECTION'; // default

  if (shape === 'BOX') {
    return renderBoxSection(ctx);
  } else if (shape === 'CHANNEL') {
    return renderChannel(ctx);
  } else if (shape === 'DOUBLE-ANGLE') {
    return renderDoubleAngle(ctx);
  } else {
    // I-SECTION or PLATE GIRDER
    return renderWSection(ctx);
  }
}

function renderBoxSection(ctx) {
  const { data, xLeft, yTop, yBottom, xRight, scaledBf, scaledTf, scaledTw, scaledD, cx, cy } = ctx;
  const b = data.b || data.B || data.bf || '-';
  const h = data.d || data.H || '-';
  const tf = data.tf || data.t || '-';
  const tw = data.tw || data.t || '-';
  const svgContent = `
    <rect class="hover-component" data-tooltip="Top Plate: b=${b}, t=${tf}" x="${xLeft}" y="${yTop}" width="${scaledBf}" height="${scaledTf}" fill="${fillColor}" stroke="${strokeColor}" stroke-width="${strokeWidth}" />
    <rect class="hover-component" data-tooltip="Bottom Plate: b=${b}, t=${tf}" x="${xLeft}" y="${yBottom - scaledTf}" width="${scaledBf}" height="${scaledTf}" fill="${fillColor}" stroke="${strokeColor}" stroke-width="${strokeWidth}" />
    <rect class="hover-component" data-tooltip="Left Web: d=${h}, t=${tw}" x="${xLeft}" y="${yTop + scaledTf}" width="${scaledTw}" height="${Math.max(0, scaledD - 2 * scaledTf)}" fill="${fillColor}" stroke="${strokeColor}" stroke-width="${strokeWidth}" />
    <rect class="hover-component" data-tooltip="Right Web: d=${h}, t=${tw}" x="${xRight - scaledTw}" y="${yTop + scaledTf}" width="${scaledTw}" height="${Math.max(0, scaledD - 2 * scaledTf)}" fill="${fillColor}" stroke="${strokeColor}" stroke-width="${strokeWidth}" />
  `;
  let dimLine = '';
  dimLine += drawVerticalDimension(xLeft, yTop, yBottom, 'd');
  dimLine += drawHorizontalDimension(xLeft, xRight, yTop, 'bf', -15);
  dimLine += drawHorizontalDimension(xLeft, xLeft + scaledTw, cy, 'tw', 3);
  dimLine += drawVerticalDimension(xRight, yBottom - scaledTf, yBottom, 'tf', 8);
  return { svgContent, dimLine };
}

function renderChannel(ctx) {
  const { data, xLeft, yTop, yBottom, xRight, scaledBf, scaledTf, scaledTw, scaledD, cx, cy } = ctx;
  const bf = data.bf || data.b || '-';
  const tf = data.tf || data.t || '-';
  const d = data.d || data.H || '-';
  const tw = data.tw || data.t || '-';
  const svgContent = `
    <rect class="hover-component" data-tooltip="Web: d=${d}, tw=${tw}" x="${xLeft}" y="${yTop}" width="${scaledTw}" height="${scaledD}" fill="${fillColor}" stroke="${strokeColor}" stroke-width="${strokeWidth}" />
    <rect class="hover-component" data-tooltip="Top Flange: bf=${bf}, tf=${tf}" x="${xLeft + scaledTw}" y="${yTop}" width="${Math.max(0, scaledBf - scaledTw)}" height="${scaledTf}" fill="${fillColor}" stroke="${strokeColor}" stroke-width="${strokeWidth}" />
    <rect class="hover-component" data-tooltip="Bottom Flange: bf=${bf}, tf=${tf}" x="${xLeft + scaledTw}" y="${yTop + scaledD - scaledTf}" width="${Math.max(0, scaledBf - scaledTw)}" height="${scaledTf}" fill="${fillColor}" stroke="${strokeColor}" stroke-width="${strokeWidth}" />
  `;
  let dimLine = '';
  dimLine += drawVerticalDimension(xLeft, yTop, yBottom, 'd');
  dimLine += drawHorizontalDimension(xLeft, xRight, yBottom, 'bf');
  dimLine += drawHorizontalDimension(xLeft, xLeft + scaledTw, cy, 'tw', 3);
  dimLine += drawVerticalDimension(xRight, yTop, yTop + scaledTf, 'tf', 8);
  return { svgContent, dimLine };
}

function renderAngle(ctx) {
  const { data, xLeft, yTop, yBottom, xRight, scaledBf, scaledTf, scaledTw, scaledD, cx, cy } = ctx;
  const d = data.d || data.H || '-';
  const b = data.b || data.B || data.bf || '-';
  const t = data.t || data.tw || '-';
  const svgContent = `
    <rect class="hover-component" data-tooltip="Vertical Leg: d=${d}, t=${t}" x="${xLeft}" y="${yTop}" width="${scaledTw}" height="${scaledD}" fill="${fillColor}" stroke="${strokeColor}" stroke-width="${strokeWidth}" />
    <rect class="hover-component" data-tooltip="Horizontal Leg: b=${b}, t=${t}" x="${xLeft + scaledTw}" y="${yBottom - scaledTf}" width="${Math.max(0, scaledBf - scaledTw)}" height="${scaledTf}" fill="${fillColor}" stroke="${strokeColor}" stroke-width="${strokeWidth}" />
  `;
  let dimLine = '';
  dimLine += drawVerticalDimension(xLeft, yTop, yBottom, 'd');
  dimLine += drawHorizontalDimension(xLeft, xRight, yBottom, 'b');
  dimLine += drawHorizontalDimension(xLeft, xLeft + scaledTw, yTop + scaledD/4, 't', -3);
  return { svgContent, dimLine };
}

function renderDoubleAngle(ctx) {
  const { data, xLeft, yTop, yBottom, xRight, scaledBf, scaledTf, scaledTw, scaledD, cx, cy, spacing } = ctx;
  const singleBf = (scaledBf - spacing) / 2;
  const d = data.d || data.H || '-';
  const b = data.b || data.B || data.bf || '-';
  const t = data.t || data.tw || '-';
  const s = data.spacing || '10';
  const svgContent = `
    <rect class="hover-component" data-tooltip="Left Vertical Leg: d=${d}, t=${t}" x="${cx - spacing/2 - scaledTw}" y="${yTop}" width="${scaledTw}" height="${scaledD}" fill="${fillColor}" stroke="${strokeColor}" stroke-width="${strokeWidth}" />
    <rect class="hover-component" data-tooltip="Left Horizontal Leg: b=${b}, t=${t}" x="${cx - spacing/2 - singleBf}" y="${yBottom - scaledTf}" width="${Math.max(0, singleBf - scaledTw)}" height="${scaledTf}" fill="${fillColor}" stroke="${strokeColor}" stroke-width="${strokeWidth}" />
    <rect class="hover-component" data-tooltip="Right Vertical Leg: d=${d}, t=${t}" x="${cx + spacing/2}" y="${yTop}" width="${scaledTw}" height="${scaledD}" fill="${fillColor}" stroke="${strokeColor}" stroke-width="${strokeWidth}" />
    <rect class="hover-component" data-tooltip="Right Horizontal Leg: b=${b}, t=${t}" x="${cx + spacing/2 + scaledTw}" y="${yBottom - scaledTf}" width="${Math.max(0, singleBf - scaledTw)}" height="${scaledTf}" fill="${fillColor}" stroke="${strokeColor}" stroke-width="${strokeWidth}" />
  `;
  let dimLine = '';
  dimLine += drawVerticalDimension(xLeft, yTop, yBottom, 'd');
  dimLine += drawHorizontalDimension(xLeft, xRight, yBottom, '2b+s');
  dimLine += drawHorizontalDimension(xLeft, cx - spacing/2, cy, 'b', -10);
  dimLine += drawHorizontalDimension(cx - spacing/2, cx + spacing/2, cy, 's', -5);
  return { svgContent, dimLine };
}

function renderTee(ctx) {
  const { data, xLeft, yTop, yBottom, xRight, scaledBf, scaledTf, scaledTw, scaledD, cx, cy } = ctx;
  const bf = data.bf || data.b || '-';
  const tf = data.tf || data.t || '-';
  const d = data.d || data.H || '-';
  const tw = data.tw || data.t || '-';
  const svgContent = `
    <rect class="hover-component" data-tooltip="Flange: bf=${bf}, tf=${tf}" x="${xLeft}" y="${yTop}" width="${scaledBf}" height="${scaledTf}" fill="${fillColor}" stroke="${strokeColor}" stroke-width="${strokeWidth}" />
    <rect class="hover-component" data-tooltip="Stem: d=${d}, tw=${tw}" x="${cx - scaledTw / 2}" y="${yTop + scaledTf}" width="${scaledTw}" height="${Math.max(0, scaledD - scaledTf)}" fill="${fillColor}" stroke="${strokeColor}" stroke-width="${strokeWidth}" />
  `;
  let dimLine = '';
  dimLine += drawVerticalDimension(xLeft, yTop, yBottom, 'd');
  dimLine += drawHorizontalDimension(xLeft, xRight, yTop, 'bf', -15);
  dimLine += drawHorizontalDimension(cx, cx + scaledTw/2, yBottom - 5, 'tw', 3);
  dimLine += drawVerticalDimension(xRight, yTop, yTop + scaledTf, 'tf', 8);
  return { svgContent, dimLine };
}

function renderHSS(ctx) {
  const { data, xLeft, yTop, yBottom, xRight, scaledBf, scaledTw, scaledD, cx, cy } = ctx;
  const H = data.H || data.d || '-';
  const B = data.B || data.b || data.bf || '-';
  const t = data.t || data.tdes || '-';
  const svgContent = `
    <rect class="hover-component" data-tooltip="Outer Wall: H=${H}, B=${B}, t=${t}" x="${xLeft}" y="${yTop}" width="${scaledBf}" height="${scaledD}" rx="3" ry="3" fill="${fillColor}" stroke="${strokeColor}" stroke-width="${strokeWidth}" />
    <rect x="${xLeft + scaledTw}" y="${yTop + scaledTw}" width="${Math.max(0, scaledBf - 2 * scaledTw)}" height="${Math.max(0, scaledD - 2 * scaledTw)}" rx="1.5" ry="1.5" fill="var(--surface, #1e1e24)" stroke="${strokeColor}" stroke-width="${strokeWidth}" />
  `;
  let dimLine = '';
  dimLine += drawVerticalDimension(xLeft, yTop, yBottom, 'H');
  dimLine += drawHorizontalDimension(xLeft, xRight, yBottom, 'B');
  dimLine += drawHorizontalDimension(xLeft, xLeft + scaledTw, cy, 't', 3);
  return { svgContent, dimLine };
}

function renderRoundHSS(ctx) {
  const { data, cx, cy, scaledTw, scaledD } = ctx;
  const rOuter = scaledD / 2;
  const rInner = rOuter - scaledTw;
  const OD = data.OD || data.d || data.H || '-';
  const t = data.t || data.tdes || '-';
  const svgContent = `
    <circle class="hover-component" data-tooltip="Outer Wall: OD=${OD}, t=${t}" cx="${cx}" cy="${cy}" r="${rOuter}" fill="${fillColor}" stroke="${strokeColor}" stroke-width="${strokeWidth}" />
    <circle cx="${cx}" cy="${cy}" r="${rInner > 0 ? rInner : 0}" fill="var(--surface, #1e1e24)" stroke="${strokeColor}" stroke-width="${strokeWidth}" />
  `;
  let dimLine = '';
  dimLine += drawVerticalDimension(cx - scaledD/2, cy - scaledD/2, cy + scaledD/2, 'D');
  dimLine += drawHorizontalDimension(cx, cx + scaledD/2, cy, 't', -3);
  return { svgContent, dimLine };
}
