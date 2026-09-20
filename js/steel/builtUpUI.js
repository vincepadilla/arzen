/**
 * builtUpUI.js
 * Renders the interactive Built-Up Section designer panel.
 * Provides live calculation preview and feeds the computed section to the
 * existing design engine via the onApply callback.
 */

import { computeBuiltUpProperties, validateBuiltUpInputs } from './builtUpGeometry.js';
import { updateIllustration, updateProperties } from './sectionRenderer.js';

// ─── Shape Configurations ────────────────────────────────────────────────────

const SHAPE_CONFIGS = {
  'I-SECTION': {
    label: 'Built-Up I-Section',
    icon: 'fa-i-cursor',
    description: 'Doubly-symmetric I-shaped member (two flange plates + web plate)',
    fields: ['d', 'bf', 'tw', 'tf'],
  },
  'PLATE-GIRDER': {
    label: 'Plate Girder',
    icon: 'fa-layer-group',
    description: 'Deep I-shaped plate girder (same geometry as Built-Up I, distinct label)',
    fields: ['d', 'bf', 'tw', 'tf'],
  },
  'BOX': {
    label: 'Built-Up Box Section',
    icon: 'fa-square',
    description: 'Hollow rectangular box (two flange + two web plates)',
    fields: ['d', 'bf', 'tw', 'tf'],
  },
  'BU-CHANNEL': {
    label: 'Built-Up Channel',
    icon: 'fa-grip-lines-vertical',
    description: 'Open channel section (web + two outstand flange plates)',
    fields: ['d', 'bf', 'tw', 'tf'],
  },
};

const FIELD_META = {
  d:  { label: 'Overall Depth, d', unit: 'mm', placeholder: 'e.g. 400', hint: 'Total height of section' },
  bf: { label: 'Flange Width, bf', unit: 'mm', placeholder: 'e.g. 200', hint: 'Width of flange plates' },
  tw: { label: 'Web Thickness, tw', unit: 'mm', placeholder: 'e.g. 10',  hint: 'Thickness of web plate' },
  tf: { label: 'Flange Thickness, tf', unit: 'mm', placeholder: 'e.g. 16',  hint: 'Thickness of flange plates' },
};

// ─── Main Export ─────────────────────────────────────────────────────────────

/**
 * Initialise the built-up section panel inside `container`.
 * @param {HTMLElement} container   - The #builtUpPanel element
 * @param {Function}    onApply     - Callback(sectionObj) when user clicks "Apply"
 * @param {Object|null} seedSection - Optional W section to pre-fill dimensions from
 */
export function initBuiltUpPanel(container, onApply, seedSection = null) {
  container.innerHTML = buildPanelHTML(seedSection);
  wirePanel(container, onApply, seedSection);
}

// ─── HTML Builder ─────────────────────────────────────────────────────────────

function buildPanelHTML(seed) {
  const typeOptions = Object.entries(SHAPE_CONFIGS)
    .map(([key, cfg]) =>
      `<option value="${key}">${cfg.label}</option>`
    ).join('');

  const seedD  = seed?.d  ?? '';
  const seedBf = seed?.bf ?? '';
  const seedTw = seed?.tw ?? '';
  const seedTf = seed?.tf ?? '';

  return `
    <div id="builtUpDesigner" style="
      background: var(--plate, #1a1a2e);
      border: 1px solid var(--line, #333);
      border-radius: 10px;
      padding: 1.5rem;
      margin-top: 1.25rem;
      animation: fadeInDown 0.3s ease;
    ">
      <style>
        @keyframes fadeInDown {
          from { opacity: 0; transform: translateY(-10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .bu-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 1rem; }
        .bu-field { display: flex; flex-direction: column; gap: 4px; }
        .bu-field label { font-size: 0.85rem; color: var(--mist, #999); font-family: var(--font-m, monospace); }
        .bu-field .hint  { font-size: 0.75rem; color: var(--mist, #999); opacity: 0.7; margin-top: 2px; }
        .bu-field input  { padding: 0.65rem 0.75rem; background: var(--steel, #222); border: 1px solid var(--line, #333);
                           color: var(--chalk, #eee); border-radius: 6px; font-size: 0.95rem; outline: none;
                           transition: border-color 0.2s; width: 100%; box-sizing: border-box; }
        .bu-field input:focus  { border-color: var(--amber, #f5a623); }
        .bu-field input.invalid { border-color: #e74c3c !important; }
        .bu-input-unit { position: relative; }
        .bu-input-unit span { position: absolute; right: 10px; top: 50%; transform: translateY(-50%);
                              color: var(--mist, #999); font-size: 0.8rem; pointer-events: none; }
        .bu-error-list { margin: 0.75rem 0 0 0; padding: 0.75rem 1rem; background: rgba(231,76,60,0.1);
                         border: 1px solid rgba(231,76,60,0.4); border-radius: 6px; color: #e74c3c;
                         font-size: 0.85rem; list-style: disc; padding-left: 2rem; }
        .bu-prop-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 0.6rem; margin-top: 0.75rem; }
        .bu-prop-item { background: var(--steel, #222); border: 1px solid var(--line, #333);
                        border-radius: 6px; padding: 0.55rem 0.75rem; }
        .bu-prop-item .bu-plbl { font-size: 0.75rem; color: var(--mist, #999); font-family: var(--font-m, monospace); display: block; }
        .bu-prop-item .bu-pval { color: var(--amber, #f5a623); font-size: 1rem; font-weight: 600; display: block; margin-top: 2px; }
        .bu-type-btn { display: flex; flex-direction: column; align-items: center; justify-content: center;
                       gap: 6px; padding: 0.75rem; border-radius: 8px; border: 2px solid var(--line, #333);
                       background: var(--steel, #222); color: var(--mist, #999); cursor: pointer;
                       transition: all 0.2s; font-size: 0.82rem; text-align: center; min-width: 0; }
        .bu-type-btn:hover  { border-color: var(--amber, #f5a623); color: var(--chalk, #eee); }
        .bu-type-btn.active { border-color: var(--amber, #f5a623); background: rgba(245,166,35,0.12); color: var(--chalk, #eee); }
        .bu-type-btn i { font-size: 1.2rem; }
        .bu-section-header { display: flex; align-items: center; gap: 10px; margin-bottom: 1rem; }
        .bu-section-header i { color: var(--amber, #f5a623); }
        .bu-section-header span { color: var(--chalk, #eee); font-size: 1rem; font-weight: 600; }
        .bu-divider { border: none; border-top: 1px solid var(--line, #333); margin: 1.25rem 0; }
        #buDesignationInput { font-family: var(--font-b, monospace); font-size: 0.95rem; }
      </style>

      <!-- Panel Header -->
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.25rem;">
        <div style="display:flex; align-items:center; gap:10px;">
          <i class="fas fa-drafting-compass" style="color:var(--amber,#f5a623); font-size:1.3rem;"></i>
          <div>
            <div style="color:var(--chalk,#eee); font-size:1.1rem; font-weight:700;">Built-Up Section Designer</div>
            <div style="color:var(--mist,#999); font-size:0.82rem; margin-top:2px;">Define plate dimensions — properties calculated automatically</div>
          </div>
        </div>
        <button id="buCloseBtn" style="background:none; border:none; color:var(--mist,#999); font-size:1.5rem; cursor:pointer; line-height:1;" title="Close">✕</button>
      </div>

      <!-- Type Selector -->
      <div class="bu-section-header">
        <i class="fas fa-shapes"></i>
        <span>Section Type</span>
      </div>
      <div style="display:grid; grid-template-columns:repeat(auto-fit,minmax(130px,1fr)); gap:0.75rem; margin-bottom:1.25rem;" id="buTypeGrid">
        ${Object.entries(SHAPE_CONFIGS).map(([key, cfg]) => `
          <button class="bu-type-btn ${key === 'I-SECTION' ? 'active' : ''}" data-type="${key}">
            <i class="fas ${cfg.icon}"></i>
            <span>${cfg.label}</span>
          </button>
        `).join('')}
      </div>
      <div id="buTypeDesc" style="font-size:0.83rem; color:var(--mist,#999); margin-bottom:1rem; font-style:italic;">
        ${SHAPE_CONFIGS['I-SECTION'].description}
      </div>

      <hr class="bu-divider">

      <!-- Designation Name -->
      <div class="bu-section-header">
        <i class="fas fa-tag"></i>
        <span>Section Designation</span>
      </div>
      <div class="bu-field" style="margin-bottom:1.25rem;">
        <label>Custom Designation (optional)</label>
        <input type="text" id="buDesignationInput" placeholder="e.g. PG-450x200x10x16" style="max-width:400px;">
        <span class="hint">Leave blank to auto-generate from dimensions</span>
      </div>

      <!-- Dimension Inputs -->
      <div class="bu-section-header">
        <i class="fas fa-ruler-combined"></i>
        <span>Plate Dimensions</span>
      </div>
      <div class="bu-grid" id="buDimGrid">
        ${['d','bf','tw','tf'].map(key => buildFieldHTML(key,
            key === 'd' ? seedD : key === 'bf' ? seedBf : key === 'tw' ? seedTw : seedTf
        )).join('')}
      </div>

      <!-- Validation Errors -->
      <ul class="bu-error-list" id="buErrors" style="display:none;"></ul>

      <hr class="bu-divider">

      <!-- Computed Section Properties -->
      <div class="bu-section-header">
        <i class="fas fa-calculator"></i>
        <span>Computed Section Properties</span>
        <span id="buStatusBadge" style="margin-left:auto; font-size:0.8rem; padding:3px 10px; border-radius:12px; background:rgba(100,100,100,0.2); color:var(--mist,#999);">Enter dimensions above</span>
      </div>

      <div style="display:grid; grid-template-columns:1fr 1fr; gap:1.25rem;">
        <!-- Properties Grid -->
        <div>
          <div class="bu-prop-grid" id="buPropGrid">
            <!-- populated by JS -->
          </div>
        </div>
        <!-- Live Illustration -->
        <div id="buIllustrationContainer" style="min-height:200px; display:flex; align-items:center; justify-content:center;">
          <span style="color:var(--mist,#999); font-size:0.85rem;">Enter dimensions to preview section</span>
        </div>
      </div>

      <hr class="bu-divider">

      <!-- Apply Button -->
      <div style="display:flex; align-items:center; gap:1rem; flex-wrap:wrap;">
        <button id="buApplyBtn" class="btn btn-primary" style="font-size:1rem; padding:0.75rem 2rem; display:inline-flex; align-items:center; gap:8px;" disabled>
          <i class="fas fa-check-circle"></i> Apply Built-Up Section
        </button>
        <span style="font-size:0.82rem; color:var(--mist,#999);">
          Applies section to the design form. Original W section is preserved in the list.
        </span>
      </div>
    </div>
  `;
}

function buildFieldHTML(key, seedVal) {
  const m = FIELD_META[key];
  return `
    <div class="bu-field">
      <label for="buInput_${key}">${m.label}</label>
      <div class="bu-input-unit">
        <input type="number" id="buInput_${key}" data-field="${key}"
               placeholder="${m.placeholder}" min="0.1" step="0.1"
               value="${seedVal !== '' && seedVal != null ? seedVal : ''}">
        <span>${m.unit}</span>
      </div>
      <span class="hint">${m.hint}</span>
    </div>
  `;
}

// ─── Wiring ───────────────────────────────────────────────────────────────────

function wirePanel(container, onApply, seedSection) {
  let currentType = 'I-SECTION';
  let currentSection = null;

  // Type buttons
  container.querySelectorAll('.bu-type-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      container.querySelectorAll('.bu-type-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentType = btn.dataset.type;
      const desc = container.querySelector('#buTypeDesc');
      if (desc) desc.textContent = SHAPE_CONFIGS[currentType]?.description ?? '';
      recalculate();
    });
  });

  // Dimension inputs
  container.querySelectorAll('input[data-field]').forEach(input => {
    input.addEventListener('input', recalculate);
    input.addEventListener('change', recalculate);
  });

  // Designation input
  const desigInput = container.querySelector('#buDesignationInput');
  if (desigInput) desigInput.addEventListener('input', recalculate);

  // Close button
  const closeBtn = container.querySelector('#buCloseBtn');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      container.style.display = 'none';
      const trigBar = document.getElementById('builtUpTriggerBar');
      if (trigBar) {
        const btn = trigBar.querySelector('#createBuiltUpBtn');
        if (btn) btn.innerHTML = '<i class="fas fa-drafting-compass"></i> Create Built-Up Section';
      }
    });
  }

  // Apply button
  const applyBtn = container.querySelector('#buApplyBtn');
  if (applyBtn) {
    applyBtn.addEventListener('click', () => {
      if (currentSection) onApply(currentSection);
    });
  }

  // Trigger initial calculation if seed values present
  if (seedSection) recalculate();

  // ─── Live Recalculate ──────────────────────────────────────────────────────
  function recalculate() {
    const getVal = id => {
      const el = container.querySelector(`#buInput_${id}`);
      if (!el) return null;
      const v = parseFloat(el.value);
      return isNaN(v) ? null : v;
    };

    const d  = getVal('d');
    const bf = getVal('bf');
    const tw = getVal('tw');
    const tf = getVal('tf');

    const desig = desigInput?.value?.trim() || null;
    const config = { type: currentType, d, bf, tw, tf, designation: desig };

    // Validate
    const errors = validateBuiltUpInputs(config);
    const errorList = container.querySelector('#buErrors');
    const applyBtn  = container.querySelector('#buApplyBtn');
    const statusBadge = container.querySelector('#buStatusBadge');

    // Clear input highlights
    ['d','bf','tw','tf'].forEach(k => {
      const el = container.querySelector(`#buInput_${k}`);
      if (el) el.classList.remove('invalid');
    });

    if (errors.length > 0) {
      errorList.style.display = 'block';
      errorList.innerHTML = errors.map(e => `<li>${e}</li>`).join('');
      applyBtn.disabled = true;
      statusBadge.style.background = 'rgba(231,76,60,0.15)';
      statusBadge.style.color = '#e74c3c';
      statusBadge.textContent = 'Invalid dimensions';
      // Highlight problematic fields (simple heuristic: if all 4 fields null, none)
      if (d === null)  container.querySelector('#buInput_d')?.classList.add('invalid');
      if (bf === null) container.querySelector('#buInput_bf')?.classList.add('invalid');
      if (tw === null) container.querySelector('#buInput_tw')?.classList.add('invalid');
      if (tf === null) container.querySelector('#buInput_tf')?.classList.add('invalid');
      clearPreview(container);
      currentSection = null;
      return;
    }

    errorList.style.display = 'none';
    errorList.innerHTML = '';

    // Compute
    try {
      const sec = computeBuiltUpProperties(config);
      currentSection = sec;

      // Show properties
      renderPropertiesPreview(container, sec);

      // Show illustration
      const illContainer = container.querySelector('#buIllustrationContainer');
      if (illContainer) updateIllustration(sec, illContainer);

      applyBtn.disabled = false;
      statusBadge.style.background = 'rgba(46,204,113,0.15)';
      statusBadge.style.color = '#2ecc71';
      statusBadge.textContent = '✓ Ready to apply';
    } catch (err) {
      console.error('[builtUpUI] Calculation error:', err);
      applyBtn.disabled = true;
      statusBadge.style.background = 'rgba(231,76,60,0.15)';
      statusBadge.style.color = '#e74c3c';
      statusBadge.textContent = 'Calculation error';
      currentSection = null;
    }
  }
}

// ─── Property Preview Renderer ────────────────────────────────────────────────

function renderPropertiesPreview(container, sec) {
  const propGrid = container.querySelector('#buPropGrid');
  if (!propGrid) return;

  const props = [
    { label: 'Area (A)',         val: sec.area,   unit: 'mm²' },
    { label: 'Weight',           val: sec.weight, unit: 'kg/m' },
    { label: 'Ix',               val: sec.Ix,     unit: '×10⁶ mm⁴' },
    { label: 'Iy',               val: sec.Iy,     unit: '×10⁶ mm⁴' },
    { label: 'Sx',               val: sec.Sx,     unit: '×10³ mm³' },
    { label: 'Sy',               val: sec.Sy,     unit: '×10³ mm³' },
    { label: 'Zx',               val: sec.Zx,     unit: '×10³ mm³' },
    { label: 'Zy',               val: sec.Zy,     unit: '×10³ mm³' },
    { label: 'rx',               val: sec.rx,     unit: 'mm' },
    { label: 'ry',               val: sec.ry,     unit: 'mm' },
    { label: 'J',                val: sec.J,      unit: '×10³ mm⁴' },
    { label: 'Cw',               val: sec.Cw,     unit: '×10⁹ mm⁶' },
    { label: 'hw (clear web)',   val: sec.hw,     unit: 'mm' },
    { label: 'bf/(2tf)',         val: sec.bf_2tf, unit: '' },
    { label: 'hw/tw',            val: sec.h_tw,   unit: '' },
    { label: 'ho',               val: sec.ho,     unit: 'mm' },
    { label: 'rts',              val: sec.rts,    unit: 'mm' },
  ].filter(p => p.val !== null && p.val !== undefined);

  propGrid.innerHTML = props.map(p => `
    <div class="bu-prop-item">
      <span class="bu-plbl">${p.label}</span>
      <span class="bu-pval">${p.val} <small style="font-size:0.7em; font-weight:400; color:var(--mist,#999);">${p.unit}</small></span>
    </div>
  `).join('');
}

function clearPreview(container) {
  const propGrid = container.querySelector('#buPropGrid');
  if (propGrid) propGrid.innerHTML = '';
  const illContainer = container.querySelector('#buIllustrationContainer');
  if (illContainer) illContainer.innerHTML = '<span style="color:var(--mist,#999); font-size:0.85rem;">Enter dimensions to preview section</span>';
}
