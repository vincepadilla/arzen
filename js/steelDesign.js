import steelDatabase from './steel/sectionDatabase.js';
import { filterSections } from './steel/sectionSearch.js';
import { renderList, updateProperties, updateIllustration } from './steel/sectionRenderer.js';
import { designState } from './steel/designState.js';
import { updateMaterialUI } from './steel/materialDatabase.js';
import { checkValidField } from './steel/validation.js';
import { initMemberInputs } from './steel/memberInputs.js';
import { runSteelDesign } from './steel/calculations/steelDesign.js';
import { renderCalculationResults } from './steel/calculations/resultRenderer.js';
import { initBuiltUpPanel } from './steel/builtUpUI.js';
import { authService } from '../src/services/authService.js';

authService.getCurrentUser().then(user => {
  if (!user) {
    window.location.href = '/admin.html';
  }
});

document.addEventListener('DOMContentLoaded', () => {
  console.log("Steel Design Interface Loaded");

  const typeSelect = document.getElementById('sectionType');
  const searchDesignation = document.getElementById('searchDesignation');
  
  const minWeight = document.getElementById('minWeight');
  const maxWeight = document.getElementById('maxWeight');
  const minDepth = document.getElementById('minDepth');
  const maxDepth = document.getElementById('maxDepth');
  const minArea = document.getElementById('minArea');
  const maxArea = document.getElementById('maxArea');
  
  const sectionsList = document.getElementById('sectionsList');
  const resultCount = document.getElementById('resultCount');
  const propertiesContainer = document.getElementById('sectionPropertiesContainer');
  const illustrationContainer = document.getElementById('memberIllustration');

  let currentDesignation = null;
  let currentBuiltUpSection = null; // Holds computed built-up section when active

  // W-family types that enable the Built-Up option
  const W_FAMILIES = ['W', 'M', 'HP', 'S'];

  initMemberInputs();

  const materialGrade = document.getElementById('materialGrade');
  if (materialGrade) {
    materialGrade.addEventListener('change', updateMaterialUI);
    updateMaterialUI();
  }

  // ─── Trigger bar elements ─────────────────────────────────────────────────
  const builtUpTriggerBar = document.getElementById('builtUpTriggerBar');
  const builtUpPanel      = document.getElementById('builtUpPanel');
  const createBuiltUpBtn  = document.getElementById('createBuiltUpBtn');

  function showBuiltUpTrigger(show) {
    if (builtUpTriggerBar) builtUpTriggerBar.style.display = show ? 'block' : 'none';
    if (!show && builtUpPanel) {
      builtUpPanel.style.display = 'none';
      builtUpPanel.innerHTML = '';
    }
  }

  if (createBuiltUpBtn) {
    createBuiltUpBtn.addEventListener('click', () => {
      if (!builtUpPanel) return;

      // Toggle panel
      if (builtUpPanel.style.display === 'block') {
        builtUpPanel.style.display = 'none';
        createBuiltUpBtn.innerHTML = '<i class="fas fa-drafting-compass"></i> Create Built-Up Section';
        return;
      }

      builtUpPanel.style.display = 'block';
      createBuiltUpBtn.innerHTML = '<i class="fas fa-times"></i> Close Designer';

      // Seed dimensions from current W section if one is selected
      const seedSection = currentDesignation
        ? steelDatabase.find(s => s.designation === currentDesignation)
        : null;

      initBuiltUpPanel(builtUpPanel, onBuiltUpApply, seedSection);
      builtUpPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  function onBuiltUpApply(sectionObj) {
    currentBuiltUpSection = sectionObj;
    currentDesignation    = null; // decouple from DB

    // Update the Section Details card
    updateProperties(sectionObj, propertiesContainer);
    updateIllustration(sectionObj, illustrationContainer);

    // Show a confirmation banner inside the trigger bar
    if (builtUpTriggerBar) {
      const info = builtUpTriggerBar.querySelector('div');
      if (info) info.innerHTML = `
        <i class="fas fa-check-circle" style="color:#2ecc71; margin-right:5px;"></i>
        Built-up section <strong style="color:var(--chalk,#eee);">${sectionObj.designation}</strong> applied.
        Area = ${sectionObj.area} mm², Weight = ${sectionObj.weight} kg/m.
        <span style="opacity:0.6; margin-left:8px;">Run design check below.</span>
      `;
    }

    // Scroll to top (section 1 content is shown inline in step panel)
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function handleSelect(designation) {
    currentDesignation    = designation;
    currentBuiltUpSection = null; // clear any previously applied built-up section

    const data = steelDatabase.find(s => s.designation === designation);
    updateProperties(data, propertiesContainer);
    updateIllustration(data, illustrationContainer);

    // Show trigger bar only for W-family sections
    const isWFamily = data && W_FAMILIES.includes(data.type);
    showBuiltUpTrigger(isWFamily);

    // Reset create button label
    if (createBuiltUpBtn) {
      createBuiltUpBtn.innerHTML = '<i class="fas fa-drafting-compass"></i> Create Built-Up Section';
    }
  }

  function applyFilters() {
    if (!sectionsList) return;

    const typeVal = typeSelect ? typeSelect.value : 'all';
    const term = (searchDesignation.value || '').toLowerCase().trim();
    
    const filterVal = (el) => {
      const v = parseFloat(el.value);
      return isNaN(v) ? null : v;
    };

    const wMin = filterVal(minWeight);
    const wMax = filterVal(maxWeight);
    const dMin = filterVal(minDepth);
    const dMax = filterVal(maxDepth);
    const aMin = filterVal(minArea);
    const aMax = filterVal(maxArea);

    const filtered = filterSections(steelDatabase, typeVal, term, wMin, wMax, dMin, dMax, aMin, aMax);

    renderList(filtered, sectionsList, resultCount, currentDesignation, handleSelect);
  }

  // Bind events
  const filterInputs = [
    typeSelect, searchDesignation, 
    minWeight, maxWeight, 
    minDepth, maxDepth, 
    minArea, maxArea
  ];

  filterInputs.forEach(el => {
    if (el) {
      el.addEventListener('input', applyFilters);
      el.addEventListener('change', applyFilters);
    }
  });

  // Initial population
  applyFilters();



  const computeBtn = document.getElementById('computeBtn');
  const capacitySection = document.getElementById('capacitySection');
  const recommendationSection = document.getElementById('recommendationSection');
  const reportSection = document.getElementById('reportSection');
  const capacityResults = document.getElementById('capacityResults');
  const recommendationResults = document.getElementById('recommendationResults');

  if (computeBtn) {
    computeBtn.addEventListener('click', () => {
      // ── 1. Section guard ──────────────────────────────────────────────────
      if (!currentDesignation && !currentBuiltUpSection) {
        alert("Please select a steel section from the Available Sections list, or apply a built-up section first.");
        return;
      }

      // ── 2. Field validation ───────────────────────────────────────────────
      let isValid = true;
      const checkValid = (id, name, minVal = 0, requiresPositive = false) => {
        if (!checkValidField(id, name, minVal, requiresPositive)) {
          isValid = false;
        }
      };

      checkValid('fy', 'Yield Strength', 0, true);
      checkValid('fu', 'Tensile Strength', 0, true);
      checkValid('E', 'Elastic Modulus', 0, true);
      checkValid('G', 'Shear Modulus', 0, true);
      checkValid('memberLength', 'Member Length', 0, true);
      checkValid('unbracedLengthX', 'Unbraced Length X', 0, true);
      checkValid('unbracedLengthY', 'Unbraced Length Y', 0, true);
      checkValid('unbracedLengthTop', 'Unsupp. Length (Top)', 0, true);
      checkValid('unbracedLengthBot', 'Unsupp. Length (Bot)', 0, true);
      checkValid('kxFactor', 'Kx', 0, true);
      checkValid('kyFactor', 'Ky', 0, true);
      checkValid('kzFactor', 'Kz', 0, true);
      checkValid('cbFactor', 'Cb', 0, true);

      if (!isValid) return;

      // ── 3. Build design state ─────────────────────────────────────────────
      const getVal = id => {
        const el = document.getElementById(id);
        if (!el || (el.parentNode && el.parentNode.style.display === 'none')) return null;
        const num = parseFloat(el.value);
        return isNaN(num) ? el.value : num;
      };

      const selectedMethod = document.getElementById('designMethod').value;
      const selectedCode   = document.getElementById('designCode').value;

      const dbSection = currentDesignation
        ? steelDatabase.find(s => s.designation === currentDesignation)
        : null;
      const resolvedSection = currentBuiltUpSection || dbSection;

      if (!resolvedSection) {
        alert("Section data not found. Please re-select a section.");
        return;
      }

      designState.memberType        = document.getElementById('memberType').value;
      designState.section           = resolvedSection;
      designState.material          = {
        grade: document.getElementById('materialGrade').value,
        fy:    getVal('fy'),
        fu:    getVal('fu'),
        E:     getVal('E'),
        G:     getVal('G'),
      };
      designState.designMethod      = selectedMethod;
      designState.designCode        = selectedCode;
      designState.lengthUnit        = document.getElementById('lengthUnit').value;
      designState.memberLength      = getVal('memberLength');
      designState.unbracedLengthX   = getVal('unbracedLengthX');
      designState.unbracedLengthY   = getVal('unbracedLengthY');
      designState.unbracedLengthTop = getVal('unbracedLengthTop');
      designState.unbracedLengthBot = getVal('unbracedLengthBot');
      designState.Kx                = getVal('kxFactor');
      designState.Ky                = getVal('kyFactor');
      designState.Kz                = getVal('kzFactor');
      designState.Cb                = getVal('cbFactor');
      designState.loadPu            = getVal('loadPu')  || 0;
      designState.loadVux           = getVal('loadVux') || 0;
      designState.loadVuy           = getVal('loadVuy') || 0;
      designState.loadMux           = getVal('loadMux') || 0;
      designState.loadMuy           = getVal('loadMuy') || 0;
      designState.loadTu            = getVal('loadTu')  || 0;

      const seismicToggle = document.getElementById('seismicToggle');
      designState.seismicEnabled = seismicToggle ? seismicToggle.checked : false;
      if (designState.seismicEnabled) {
        designState.seismicParams = {
          system:      document.getElementById('seismicSystem').value,
          sdc:         document.getElementById('sdc').value,
          ductility:   document.getElementById('ductilityLevel').value,
          compactness: document.getElementById('compactnessReq').value,
        };
      } else {
        designState.seismicParams = null;
      }

      console.log("[Check Capacity] Design state:", designState);

      // ── 4. Show loading state ─────────────────────────────────────────────
      // capacitySection, recommendationSection, reportSection are inside tabs
      // in the new UI — no need to toggle display here.

      const secLabel = resolvedSection.designation || 'Built-Up Section';
      const methodLabel = selectedMethod.toUpperCase();

      capacityResults.innerHTML = `
        <div style="text-align:center; padding:2rem; color:var(--mist,#999);">
          <i class="fas fa-spinner fa-spin" style="font-size:2rem; margin-bottom:1rem; display:block;"></i>
          Running capacity checks for <strong style="color:var(--chalk,#eee);">${secLabel}</strong>…
        </div>
      `;
      // Navigate to results tab while loading
      if (typeof sdSetStep === 'function') sdSetStep(4);

      // ── 5. Run real calculations (deferred to allow repaint) ──────────────
      setTimeout(() => {
        try {
          const results = runSteelDesign(designState);

          if (!results.globalSummary) {
            capacityResults.innerHTML = `
              <div style="padding:1.5rem; background:rgba(231,76,60,0.1); border:1px solid rgba(231,76,60,0.4);
                          border-radius:8px; color:#e74c3c; text-align:center;">
                <i class="fas fa-exclamation-triangle" style="margin-right:8px;"></i>
                No limit states were triggered for member type
                <strong>${designState.memberType}</strong> with the given loads.
                Verify that non-zero loads are applied for the applicable member type.
              </div>
            `;
            return;
          }

          // Build header banner summarising inputs used
          const inputSummary = buildInputSummaryHTML(designState, resolvedSection, selectedCode, methodLabel);

          // Render the full step-by-step calculation trace
          renderCalculationResults(results, 'capacityResults');

          // Prepend input summary ahead of calculations
          capacityResults.insertAdjacentHTML('afterbegin', inputSummary);

          // Store results globally so the wizard KPI bar can read them
          window.__lastDesignResults = results;

          // Update wizard KPI summary row and navigate to results tab
          if (typeof window.__sdUpdateKPIs === 'function') {
            window.__sdUpdateKPIs(results);
          }

          // Trigger MathJax if loaded
          if (window.MathJax) {
            MathJax.typesetPromise([capacityResults]).catch(err => console.warn('MathJax:', err));
          }

        } catch (err) {
          console.error('[Check Capacity] Calculation error:', err);
          capacityResults.innerHTML = `
            <div style="padding:1.5rem; background:rgba(231,76,60,0.1); border:1px solid rgba(231,76,60,0.4);
                        border-radius:8px; color:#e74c3c;">
              <i class="fas fa-exclamation-triangle" style="margin-right:8px;"></i>
              <strong>Calculation Error:</strong> ${err.message || String(err)}<br>
              <small style="opacity:0.7;">Check the browser console for details.</small>
            </div>
          `;
        }
      }, 30); // minimal delay for spinner repaint
    });
  }

  /**
   * Builds a collapsible "Inputs Used" summary card shown above the calculation
   * trace so the user can verify exactly what values were fed into the engine.
   */
  function buildInputSummaryHTML(state, sec, code, method) {
    const lenUnit = state.lengthUnit === 'm' ? 'm' : 'mm';
    const lenMult = state.lengthUnit === 'm' ? 1 : 0.001;

    const row = (label, val, unit = '') =>
      val !== null && val !== undefined
        ? `<tr>
             <td style="padding:5px 10px; color:var(--mist,#999); font-size:0.88rem;">${label}</td>
             <td style="padding:5px 10px; color:var(--chalk,#eee); font-weight:600;">${val} ${unit}</td>
           </tr>`
        : '';

    return `
      <details style="background:var(--surface,#1e1e24); border:1px solid var(--border,#333);
                      border-radius:8px; margin-bottom:1.5rem; overflow:hidden;">
        <summary style="padding:1rem 1.25rem; cursor:pointer; font-weight:600; color:var(--chalk,#eee);
                        list-style:none; display:flex; justify-content:space-between; align-items:center;
                        background:var(--border,#333);">
          <span><i class="fas fa-clipboard-list" style="margin-right:8px; color:var(--primary,#f5a623);"></i>
            Inputs Used for This Calculation</span>
          <span style="font-size:0.8rem; color:var(--mist,#999);">Click to expand</span>
        </summary>
        <div style="padding:1.25rem; display:grid; grid-template-columns:1fr 1fr 1fr; gap:0 1rem;">

          <!-- Section & Method -->
          <div>
            <div style="font-size:0.8rem; text-transform:uppercase; letter-spacing:1px;
                        color:var(--primary,#f5a623); margin-bottom:0.5rem; border-bottom:1px solid var(--border,#333);
                        padding-bottom:4px;">Section &amp; Design Basis</div>
            <table style="width:100%; border-collapse:collapse;">
              ${row('Section',       sec.designation || 'Built-Up')}
              ${row('Type',          sec.type + (sec.builtUpType ? ' / ' + sec.builtUpType : ''))}
              ${row('Code',          code)}
              ${row('Method',        method)}
              ${row('Member Type',   state.memberType)}
            </table>
          </div>

          <!-- Material -->
          <div>
            <div style="font-size:0.8rem; text-transform:uppercase; letter-spacing:1px;
                        color:var(--primary,#f5a623); margin-bottom:0.5rem; border-bottom:1px solid var(--border,#333);
                        padding-bottom:4px;">Material Properties</div>
            <table style="width:100%; border-collapse:collapse;">
              ${row('Fy',  state.material.fy,  'MPa')}
              ${row('Fu',  state.material.fu,  'MPa')}
              ${row('E',   state.material.E,   'MPa')}
              ${row('G',   state.material.G,   'MPa')}
            </table>
          </div>

          <!-- Member Geometry -->
          <div>
            <div style="font-size:0.8rem; text-transform:uppercase; letter-spacing:1px;
                        color:var(--primary,#f5a623); margin-bottom:0.5rem; border-bottom:1px solid var(--border,#333);
                        padding-bottom:4px;">Member Geometry</div>
            <table style="width:100%; border-collapse:collapse;">
              ${row('Length',       state.memberLength,      lenUnit)}
              ${row('Lb,x',         state.unbracedLengthX,   lenUnit)}
              ${row('Lb,y',         state.unbracedLengthY,   lenUnit)}
              ${row('Lb,top',       state.unbracedLengthTop, lenUnit)}
              ${row('Lb,bot',       state.unbracedLengthBot, lenUnit)}
              ${row('Kx',          state.Kx)}
              ${row('Ky',          state.Ky)}
              ${row('Kz',          state.Kz)}
              ${row('Cb',          state.Cb)}
            </table>
          </div>

          <!-- Section Properties -->
          <div style="margin-top:1rem;">
            <div style="font-size:0.8rem; text-transform:uppercase; letter-spacing:1px;
                        color:var(--primary,#f5a623); margin-bottom:0.5rem; border-bottom:1px solid var(--border,#333);
                        padding-bottom:4px;">Section Properties</div>
            <table style="width:100%; border-collapse:collapse;">
              ${row('Area (Ag)',    sec.area,   'mm²')}
              ${row('Weight',      sec.weight, 'kg/m')}
              ${row('d',           sec.d,      'mm')}
              ${row('bf',          sec.bf,     'mm')}
              ${row('tw',          sec.tw,     'mm')}
              ${row('tf',          sec.tf,     'mm')}
              ${row('rx',          sec.rx,     'mm')}
              ${row('ry',          sec.ry,     'mm')}
              ${row('Ix',          sec.Ix,     '×10⁶ mm⁴')}
              ${row('Iy',          sec.Iy,     '×10⁶ mm⁴')}
              ${row('Zx',          sec.Zx,     '×10³ mm³')}
              ${row('Sx',          sec.Sx,     '×10³ mm³')}
              ${row('J',           sec.J,      '×10³ mm⁴')}
              ${row('Cw',          sec.Cw,     '×10⁹ mm⁶')}
              ${row('rts',         sec.rts,    'mm')}
              ${row('ho',          sec.ho,     'mm')}
              ${row('h/tw',        sec.h_tw)}
              ${row('bf/(2tf)',     sec.bf_2tf)}
            </table>
          </div>

          <!-- Applied Loads -->
          <div style="margin-top:1rem;">
            <div style="font-size:0.8rem; text-transform:uppercase; letter-spacing:1px;
                        color:var(--primary,#f5a623); margin-bottom:0.5rem; border-bottom:1px solid var(--border,#333);
                        padding-bottom:4px;">Applied Loads</div>
            <table style="width:100%; border-collapse:collapse;">
              ${row('Pu / Pa',   state.loadPu,  'kN')}
              ${row('Vux / Vax', state.loadVux, 'kN')}
              ${row('Vuy / Vay', state.loadVuy, 'kN')}
              ${row('Mux / Max', state.loadMux, 'kN-m')}
              ${row('Muy / May', state.loadMuy, 'kN-m')}
              ${row('Tu / Ta',   state.loadTu,  'kN-m')}
            </table>
          </div>

        </div>
      </details>
    `;
  }


  const findSectionsBtn = document.getElementById('findSectionsBtn');
  if (findSectionsBtn) {
    findSectionsBtn.addEventListener('click', () => {
      // Basic validation
      let isValid = true;
      const checkValid = (id, name, minVal = 0, requiresPositive = false) => {
        if (!checkValidField(id, name, minVal, requiresPositive)) {
          isValid = false;
        }
      };
      checkValid('fy', 'Yield Strength', 0, true);
      if (!isValid) return;

      recommendationResults.innerHTML = '<div style="padding:1rem; text-align:center;">Calculating candidate sections...</div>';

      // Use a small timeout to allow UI to update with "Calculating..."
      setTimeout(() => {
        const allowedFamilies = ['W', 'S', 'M', 'HP', 'C', 'MC', 'WT', 'MT', 'ST', 'L', 'Double Angle', 'HSS', 'HSS Square', 'HSS Rectangular', 'HSS Round', 'Pipe', 'Built-Up'];
        
        const isAppropriate = (type, memType) => {
          if (!allowedFamilies.includes(type)) return false;
          
          // Filter out section types not appropriate for specific member configurations
          if (memType === 'beam' || memType === 'beam-column') {
             // For bending, single/double angles and tees are typically not appropriate as primary beams
             const inappropriate = ['L', 'Double Angle', 'WT', 'MT', 'ST'];
             if (inappropriate.includes(type)) return false;
          }
          return true;
        };

        const currentMemType = document.getElementById('memberType').value;
        const candidates = steelDatabase.filter(s => isAppropriate(s.type, currentMemType));
        let passingSections = [];

        // Build base state without a specific section, globally accessible
        window.buildStateForSection = (sec) => {
          const state = { ...designState };
          const getVal = id => {
            const el = document.getElementById(id);
            if (!el || (el.parentNode && el.parentNode.style.display === 'none')) return null;
            const num = parseFloat(el.value);
            return isNaN(num) ? el.value : num;
          };
          
          state.memberType = document.getElementById('memberType').value;
          state.section = sec;
          state.material = {
            grade: document.getElementById('materialGrade').value,
            fy: getVal('fy'),
            fu: getVal('fu'),
            E: getVal('E'),
            G: getVal('G')
          };
          state.designMethod = document.getElementById('designMethod').value;
          state.designCode = document.getElementById('designCode').value;
          state.lengthUnit = document.getElementById('lengthUnit').value;
          state.memberLength = getVal('memberLength');
          state.unbracedLengthX = getVal('unbracedLengthX');
          state.unbracedLengthY = getVal('unbracedLengthY');
          state.unbracedLengthTop = getVal('unbracedLengthTop');
          state.unbracedLengthBot = getVal('unbracedLengthBot');
          state.Kx = getVal('kxFactor');
          state.Ky = getVal('kyFactor');
          state.Kz = getVal('kzFactor');
          state.Cb = getVal('cbFactor');
          state.loadPu = getVal('loadPu') || 0;
          state.loadVux = getVal('loadVux') || 0;
          state.loadVuy = getVal('loadVuy') || 0;
          state.loadMux = getVal('loadMux') || 0;
          state.loadMuy = getVal('loadMuy') || 0;
          state.loadTu = getVal('loadTu') || 0;

          const seismicToggle = document.getElementById('seismicToggle');
          state.seismicEnabled = seismicToggle ? seismicToggle.checked : false;
          if (state.seismicEnabled) {
            state.seismicParams = {
              system:      document.getElementById('seismicSystem').value,
              sdc:         document.getElementById('sdc').value,
              ductility:   document.getElementById('ductilityLevel').value,
              compactness: document.getElementById('compactnessReq').value,
            };
          } else {
            state.seismicParams = null;
          }

          return state;
        };

        const recSectionType = document.getElementById('recSectionType') ? document.getElementById('recSectionType').value : 'all';
        const recSortBy = document.getElementById('recSortBy') ? document.getElementById('recSortBy').value : 'weight';
        const maxRatioRaw = document.getElementById('recMaxRatio') ? document.getElementById('recMaxRatio').value : '';
        const recMaxRatio = maxRatioRaw ? parseFloat(maxRatioRaw) : 1.0;
        const maxWeightRaw = document.getElementById('recMaxWeight') ? document.getElementById('recMaxWeight').value : '';
        const recMaxWeight = maxWeightRaw ? parseFloat(maxWeightRaw) : null;
        const maxDepthRaw = document.getElementById('recMaxDepth') ? document.getElementById('recMaxDepth').value : '';
        const recMaxDepth = maxDepthRaw ? parseFloat(maxDepthRaw) : null;
        const minCapRaw = document.getElementById('recMinCap') ? document.getElementById('recMinCap').value : '';
        const recMinCap = minCapRaw ? parseFloat(minCapRaw) : null;

        for (const sec of candidates) {
          try {
            // Apply simple geometry & type filters early
            if (recSectionType !== 'all' && sec.type !== recSectionType) continue;
            if (recMaxWeight !== null && sec.weight > recMaxWeight) continue;
            if (recMaxDepth !== null && sec.d > recMaxDepth) continue;

            const testState = window.buildStateForSection(sec);
            const res = runSteelDesign(testState);
            if (res.globalSummary && res.globalSummary.status === 'PASS' && res.globalSummary.ratio <= recMaxRatio) {
              const axVal = (res.compression && typeof res.compression.governingCapacity === 'number') ? res.compression.governingCapacity : ((res.tension && typeof res.tension.governingCapacity === 'number') ? res.tension.governingCapacity : null);
              const flexVal = (res.flexure && typeof res.flexure.governingCapacity === 'number') ? res.flexure.governingCapacity : null;
              const shearVal = (res.shear && typeof res.shear.governingCapacity === 'number') ? res.shear.governingCapacity : null;
              
              if (recMinCap !== null) {
                // If min capacity filter is active, check if ANY capacity >= minCap
                const hasValidCap = (axVal !== null && axVal >= recMinCap) || 
                                    (flexVal !== null && flexVal >= recMinCap) || 
                                    (shearVal !== null && shearVal >= recMinCap);
                if (!hasValidCap) continue;
              }

              let axCap = axVal !== null ? axVal.toFixed(1) : '-';
              let flexCap = flexVal !== null ? flexVal.toFixed(1) : '-';
              let shearCap = shearVal !== null ? shearVal.toFixed(1) : '-';

              passingSections.push({ 
                section: sec, 
                ratio: res.globalSummary.ratio, 
                limitState: res.globalSummary.limitState,
                capacityStr: res.globalSummary.capacity,
                axCap,
                flexCap,
                shearCap,
                weight: sec.weight || (sec.area * 7850 / 1000000) 
              });
            }
          } catch (e) {
            // Ignore sections that throw errors during calculation
          }
        }

        // Apply dynamic sorting
        passingSections.sort((a, b) => {
          if (recSortBy === 'weight') return a.weight - b.weight;
          if (recSortBy === 'area') return a.section.area - b.section.area;
          if (recSortBy === 'ratio') return a.ratio - b.ratio;
          if (recSortBy === 'depth') return (a.section.d || 0) - (b.section.d || 0);
          if (recSortBy === 'designation') return a.section.designation.localeCompare(b.section.designation);
          return a.weight - b.weight; // fallback
        });

        // Display results
        if (passingSections.length === 0) {
          recommendationResults.innerHTML = '<div style="padding:1rem; text-align:center; color: #e74c3c;">No sections passed all limit states for the given loads and geometry.</div>';
          document.getElementById('compareSelectedBtn').style.display = 'none';
        } else {
          window.selectedSectionsForComparison = [];
          
          window.toggleSectionCompare = function(designation) {
            const idx = window.selectedSectionsForComparison.indexOf(designation);
            if (idx === -1) {
              window.selectedSectionsForComparison.push(designation);
            } else {
              window.selectedSectionsForComparison.splice(idx, 1);
            }
            const btn = document.getElementById('compareSelectedBtn');
            if (btn) {
              btn.style.display = window.selectedSectionsForComparison.length > 0 ? 'inline-block' : 'none';
              btn.textContent = `Compare Selected Sections (${window.selectedSectionsForComparison.length})`;
            }
          };

          window.viewIllustration = function(designation) {
            if (window.selectSection) {
              window.selectSection(designation);
              const drawingDiv = document.getElementById('crossSectionDrawing');
              if (drawingDiv) drawingDiv.scrollIntoView({ behavior: 'smooth' });
            }
          };

          window.viewCandidateDetails = function(designation) {
            const item = passingSections.find(p => p.section.designation === designation);
            if (!item) return;

            const sec = item.section;
            document.getElementById('candModalTitle').textContent = sec.designation;

            document.getElementById('candModalProps').innerHTML = `
              <div style="display:flex;justify-content:space-between;"><span>Type:</span> <strong style="color:var(--chalk,#eee);">${sec.type}</strong></div>
              <div style="display:flex;justify-content:space-between;"><span>Weight:</span> <strong style="color:var(--chalk,#eee);">${(sec.weight||0).toFixed(1)} kg/m</strong></div>
              <div style="display:flex;justify-content:space-between;"><span>Area:</span> <strong style="color:var(--chalk,#eee);">${sec.area||'-'} mm²</strong></div>
              <div style="display:flex;justify-content:space-between;"><span>Depth (d):</span> <strong style="color:var(--chalk,#eee);">${sec.d||'-'} mm</strong></div>
              <div style="display:flex;justify-content:space-between;"><span>I<sub>x</sub>:</span> <strong style="color:var(--chalk,#eee);">${sec.Ix||'-'} 10⁶ mm⁴</strong></div>
              <div style="display:flex;justify-content:space-between;"><span>I<sub>y</sub>:</span> <strong style="color:var(--chalk,#eee);">${sec.Iy||'-'} 10⁶ mm⁴</strong></div>
              <div style="display:flex;justify-content:space-between;"><span>S<sub>x</sub>:</span> <strong style="color:var(--chalk,#eee);">${sec.Sx||'-'} 10³ mm³</strong></div>
              <div style="display:flex;justify-content:space-between;"><span>S<sub>y</sub>:</span> <strong style="color:var(--chalk,#eee);">${sec.Sy||'-'} 10³ mm³</strong></div>
              <div style="display:flex;justify-content:space-between;"><span>Z<sub>x</sub>:</span> <strong style="color:var(--chalk,#eee);">${sec.Zx||'-'} 10³ mm³</strong></div>
              <div style="display:flex;justify-content:space-between;"><span>Z<sub>y</sub>:</span> <strong style="color:var(--chalk,#eee);">${sec.Zy||'-'} 10³ mm³</strong></div>
            `;

            const isPassStr = item.ratio <= 1.0 ? 'PASS' : 'FAIL';
            const isPassColor = item.ratio <= 1.0 ? '#2ecc71' : '#e74c3c';
            document.getElementById('candModalSummary').innerHTML = `
              <div style="display:flex;justify-content:space-between;margin-bottom:8px;"><span>Overall Status:</span> <span style="background:rgba(46,204,113,0.2);color:${isPassColor};font-weight:bold;padding:2px 10px;border-radius:4px;">${isPassStr}</span></div>
              <div style="display:flex;justify-content:space-between;margin-bottom:8px;"><span>Governing Limit State:</span> <strong style="color:var(--primary,#f5a623);">${item.limitState}</strong></div>
              <div style="display:flex;justify-content:space-between;margin-bottom:8px;"><span>D/C Ratio:</span> <strong style="color:var(--chalk,#eee);font-size:1.1em;">${item.ratio.toFixed(3)}</strong></div>
              <div style="display:flex;justify-content:space-between;margin-bottom:8px;"><span>Available Capacity:</span> <strong style="color:var(--chalk,#eee);">${item.capacityStr||'-'}</strong></div>
              <div style="display:flex;justify-content:space-between;margin-bottom:8px;"><span>Axial Capacity:</span> <strong style="color:var(--chalk,#eee);">${item.axCap} kN</strong></div>
              <div style="display:flex;justify-content:space-between;margin-bottom:8px;"><span>Flexural Capacity:</span> <strong style="color:var(--chalk,#eee);">${item.flexCap} kN·m</strong></div>
              <div style="display:flex;justify-content:space-between;"><span>Shear Capacity:</span> <strong style="color:var(--chalk,#eee);">${item.shearCap} kN</strong></div>
            `;

            // Render illustration inside modal
            const illContainer = document.getElementById('candModalIllustration');
            if (illContainer) {
              illContainer.innerHTML = '';
              updateIllustration(sec, illContainer);
            }

            const calcContainer = document.getElementById('candidateCalcResults');
            calcContainer.style.display = 'none';
            calcContainer.innerHTML = '';
            
            // Pre-run calculations for trace
            const testState = window.buildStateForSection(sec);
            const res = runSteelDesign(testState);
            renderCalculationResults(res, 'candidateCalcResults');

            const viewCalcsBtn = document.getElementById('viewCandCalcsBtn');
            viewCalcsBtn.onclick = () => {
              if (calcContainer.style.display === 'none') {
                calcContainer.style.display = 'block';
                viewCalcsBtn.innerHTML = '<i class="fas fa-eye-slash"></i> Hide Calculations';
              } else {
                calcContainer.style.display = 'none';
                viewCalcsBtn.innerHTML = '<i class="fas fa-calculator"></i> Show Detailed Calculations';
              }
            };

            const useBtn = document.getElementById('useCandSectionBtn');
            useBtn.onclick = () => {
              closeModal();
              // Switch back to a DB section — clear built-up state
              currentBuiltUpSection = null;
              handleSelect(sec.designation);
              // Navigate to section step so engineer can confirm, then go to loads
              if (typeof sdSetStep === 'function') sdSetStep(0);
            };

            openModal();
          };
          
          // Modal open / close helpers
          const modal = document.getElementById('candidateDetailModal');
          function openModal()  { modal.classList.add('is-open'); document.body.style.overflow = 'hidden'; }
          function closeModal() { modal.classList.remove('is-open'); document.body.style.overflow = ''; }

          const closeCandidateModal = document.getElementById('closeCandidateModal');
          if (closeCandidateModal) {
            closeCandidateModal.onclick = closeModal;
          }
          // Close on backdrop click (click on the dim overlay, not the content)
          modal.addEventListener('click', (e) => {
            if (e.target === modal) closeModal();
          });
          // Close on Escape key
          document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && modal.classList.contains('is-open')) closeModal();
          });

          const compareBtn = document.getElementById('compareSelectedBtn');
          if (compareBtn) {
            compareBtn.onclick = () => {
              const compSec = document.getElementById('comparisonSection');
              const compRes = document.getElementById('comparisonResults');
              compSec.style.display = 'block';

              let html = `
                <div style="overflow-x: auto;">
                  <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 0.9em; margin-top: 1rem;">
                    <thead>
                      <tr style="background: var(--surface); border-bottom: 2px solid var(--border); color: var(--chalk);">
                        <th style="padding: 12px; white-space: nowrap;">Designation</th>
                        <th style="padding: 12px;">Weight (kg/m)</th>
                        <th style="padding: 12px;">Area (mm²)</th>
                        <th style="padding: 12px;">Depth (mm)</th>
                        <th style="padding: 12px;">Ix (10⁶ mm⁴)</th>
                        <th style="padding: 12px;">Iy (10⁶ mm⁴)</th>
                        <th style="padding: 12px;">Sx (10³ mm³)</th>
                        <th style="padding: 12px;">Sy (10³ mm³)</th>
                        <th style="padding: 12px;">Zx (10³ mm³)</th>
                        <th style="padding: 12px;">Zy (10³ mm³)</th>
                        <th style="padding: 12px;">Gov. D/C</th>
                        <th style="padding: 12px;">Limit State</th>
                        <th style="padding: 12px;">Avail. Strength</th>
                        <th style="padding: 12px;">Action</th>
                      </tr>
                    </thead>
                    <tbody>
              `;

              window.selectedSectionsForComparison.forEach(desig => {
                const item = passingSections.find(p => p.section.designation === desig);
                if (item) {
                  const sec = item.section;
                  html += `
                    <tr style="border-bottom: 1px solid var(--border); transition: background-color 0.2s;">
                      <td style="padding: 12px; font-weight: bold; color: var(--primary); white-space: nowrap;">${sec.designation}</td>
                      <td style="padding: 12px;">${(sec.weight || 0).toFixed(1)}</td>
                      <td style="padding: 12px;">${sec.area || '-'}</td>
                      <td style="padding: 12px;">${sec.d || '-'}</td>
                      <td style="padding: 12px;">${sec.Ix || '-'}</td>
                      <td style="padding: 12px;">${sec.Iy || '-'}</td>
                      <td style="padding: 12px;">${sec.Sx || '-'}</td>
                      <td style="padding: 12px;">${sec.Sy || '-'}</td>
                      <td style="padding: 12px;">${sec.Zx || '-'}</td>
                      <td style="padding: 12px;">${sec.Zy || '-'}</td>
                      <td style="padding: 12px; font-weight: bold; color: ${item.ratio > 0.9 ? '#e67e22' : 'inherit'};">${item.ratio.toFixed(3)}</td>
                      <td style="padding: 12px; font-size: 0.9em;">${item.limitState}</td>
                      <td style="padding: 12px; white-space: nowrap;">${item.capacityStr || '-'}</td>
                      <td style="padding: 12px; white-space: nowrap;">
                        <button onclick="window.viewCandidateDetails('${sec.designation}')" class="action-icon-btn" title="View Details & Illustration">
                          <i class="fas fa-magnifying-glass-chart"></i> Details
                        </button>
                      </td>
                    </tr>
                  `;
                }
              });

              html += `
                    </tbody>
                  </table>
                </div>
              `;
              compRes.innerHTML = html;
              // Switch to the Compare sub-tab in the results panel
              if (typeof sdSetStep === 'function') sdSetStep(4);
              const compareTabBtn = document.getElementById('rtab-compare');
              if (compareTabBtn) compareTabBtn.click();

            };
          }

          window.renderRecommendationPage = function(page) {
            const rowsPerPage = 10;
            const totalPages = Math.ceil(passingSections.length / rowsPerPage);
            if (page < 1) page = 1;
            if (page > totalPages) page = totalPages;
            
            const start = (page - 1) * rowsPerPage;
            const end = start + rowsPerPage;
            const pageData = passingSections.slice(start, end);

            let html = `
              <div style="overflow-x: auto;">
                <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 0.9em; margin-top: 1rem;">
                  <thead>
                    <tr style="background: var(--surface); border-bottom: 2px solid var(--border); color: var(--chalk);">
                      <th style="padding: 12px; width: 40px; text-align: center;">Compare</th>
                      <th style="padding: 12px; white-space: nowrap;">Section</th>
                      <th style="padding: 12px;">Type</th>
                      <th style="padding: 12px;">Weight (kg/m)</th>
                      <th style="padding: 12px;">Area (mm²)</th>
                      <th style="padding: 12px;">Gov. D/C Ratio</th>
                      <th style="padding: 12px;">Gov. Limit State</th>
                      <th style="padding: 12px;">Axial Cap (kN)</th>
                      <th style="padding: 12px;">Flexural Cap (kN-m)</th>
                      <th style="padding: 12px;">Shear Cap (kN)</th>
                      <th style="padding: 12px; text-align: center;">Status</th>
                      <th style="padding: 12px; text-align: center;">Action</th>
                    </tr>
                  </thead>
                  <tbody>
            `;
            
            pageData.forEach(item => {
              const sec = item.section;
              const isChecked = window.selectedSectionsForComparison.includes(sec.designation) ? 'checked' : '';
              html += `
                <tr style="border-bottom: 1px solid var(--border); transition: background-color 0.2s;">
                  <td style="padding: 12px; text-align: center;">
                    <input type="checkbox" onchange="window.toggleSectionCompare('${sec.designation}')" ${isChecked} style="cursor: pointer; transform: scale(1.2);">
                  </td>
                  <td style="padding: 12px; font-weight: bold; color: var(--primary); white-space: nowrap;">${sec.designation}</td>
                  <td style="padding: 12px;">${sec.type}</td>
                  <td style="padding: 12px;">${item.weight.toFixed(1)}</td>
                  <td style="padding: 12px;">${sec.area}</td>
                  <td style="padding: 12px; font-weight: bold; color: ${item.ratio > 0.9 ? '#e67e22' : 'inherit'};">${item.ratio.toFixed(3)}</td>
                  <td style="padding: 12px; font-size: 0.9em;">${item.limitState}</td>
                  <td style="padding: 12px;">${item.axCap}</td>
                  <td style="padding: 12px;">${item.flexCap}</td>
                  <td style="padding: 12px;">${item.shearCap}</td>
                  <td style="padding: 12px; text-align: center;">
                    <span style="background: rgba(46, 204, 113, 0.15); color: #2ecc71; padding: 4px 10px; border-radius: 6px; font-size: 0.85em; font-weight: 500;">PASS</span>
                  </td>
                  <td style="padding: 12px; text-align: center;">
                    <button onclick="window.viewCandidateDetails('${sec.designation}')" class="btn btn-secondary" style="padding: 6px 10px; font-size: 1em; border-radius: 4px;" title="View Details"><i class="fas fa-info-circle"></i></button>
                  </td>
                </tr>
              `;
            });
            
            html += `
                  </tbody>
                </table>
              </div>
              <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 15px; font-size: 0.9em; color: var(--mist);">
                <div>
                  Showing ${start + 1} to ${Math.min(end, passingSections.length)} of ${passingSections.length} adequate section(s)
                </div>
                <div style="display: flex; gap: 8px; align-items: center;">
                  <button onclick="window.renderRecommendationPage(${page - 1})" ${page === 1 ? 'disabled' : ''} style="padding: 6px 12px; border-radius: 4px; background: var(--surface); border: 1px solid var(--border); color: var(--text); cursor: ${page === 1 ? 'not-allowed' : 'pointer'}; opacity: ${page === 1 ? '0.5' : '1'}; transition: background 0.2s;">Prev</button>
                  <span style="padding: 4px 8px; color: var(--chalk); font-weight: 500;">Page ${page} of ${totalPages}</span>
                  <button onclick="window.renderRecommendationPage(${page + 1})" ${page === totalPages ? 'disabled' : ''} style="padding: 6px 12px; border-radius: 4px; background: var(--surface); border: 1px solid var(--border); color: var(--text); cursor: ${page === totalPages ? 'not-allowed' : 'pointer'}; opacity: ${page === totalPages ? '0.5' : '1'}; transition: background 0.2s;">Next</button>
                </div>
              </div>
            `;
            
            recommendationResults.innerHTML = html;
          };
          
          window.renderRecommendationPage(1);
        }
      }, 50);
    });
  }

  const exportPdfBtn = document.getElementById('exportPdfBtn');
  if (exportPdfBtn) {
    exportPdfBtn.addEventListener('click', () => {
      alert("PDF Export functionality will be implemented soon!");
    });
  }
});
