export function renderDesignResults(optimizerRes, container, designState) {
  const { recommendedSection, passingCandidates, rejectedCandidates, evaluatedCount } = optimizerRes;

  if (!recommendedSection) {
    container.innerHTML = `
      <div style="padding: 2rem; background: rgba(231,76,60,0.1); border: 1px solid rgba(231,76,60,0.4); border-radius: 8px; color: #e74c3c; text-align: center;">
        <h3 style="margin-top: 0;">NO ACCEPTABLE SECTION FOUND</h3>
        <p>${evaluatedCount} sections evaluated.</p>
        <p>0 sections satisfy both strength and applicable seismic requirements.</p>
        <button id="viewRejectedBtn" class="sd-btn ghost" style="margin-top:1rem;color:#e74c3c;border-color:#e74c3c;">View Rejected Sections</button>
      </div>
      <div id="rejectedContainer" style="display:none; margin-top:1.5rem;">
        ${renderRejected(rejectedCandidates)}
      </div>
    `;

    document.getElementById('viewRejectedBtn').addEventListener('click', (e) => {
      const el = document.getElementById('rejectedContainer');
      el.style.display = el.style.display === 'none' ? 'block' : 'none';
    });
    return;
  }

  // Determine why it was selected
  const reasonText = designState.seismicEnabled 
    ? 'Selected because it is the lightest section that passes all strength and seismic requirements.'
    : 'Selected because it is the lightest section that passes all applicable strength checks.';

  const lengthM = (designState.memberLength || 0) / 1000;
  const totalWeight = (recommendedSection.weight * lengthM).toFixed(1);

  // Generate HTML
  let html = `
    <div style="margin-bottom:2rem;">
      <h2 style="color:var(--chalk); border-bottom:1px solid var(--line); padding-bottom:0.5rem;">RECOMMENDED SECTION</h2>
      <div style="background:var(--steel); border:1px solid var(--amber); border-radius:8px; padding:1.5rem; margin-top:1rem; position:relative;">
        <div style="font-size:2rem; color:var(--amber); font-family:var(--font-h); line-height:1; margin-bottom:0.5rem;">${recommendedSection.section.designation}</div>
        <p style="color:var(--mist); font-size:0.9rem; margin-bottom:1.5rem;">${reasonText}</p>
        
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:1rem;">
          <div><strong>Design Method:</strong> ${designState.designMethod.toUpperCase()}</div>
          <div><strong>Weight:</strong> ${recommendedSection.weight.toFixed(1)} kg/m</div>
          <div><strong>Total Member Weight:</strong> ${totalWeight} kg</div>
          <div><strong>Maximum DCR:</strong> ${recommendedSection.dcr.toFixed(2)}</div>
          <div><strong>Governing Limit State:</strong> ${recommendedSection.governingLimitState}</div>
          <div><strong>Seismic Qualification:</strong> ${recommendedSection.seismicClassification || 'N/A'}</div>
          <div><strong>Status:</strong> <span style="color:#2ecc71; font-weight:bold;">PASS</span></div>
        </div>

        <div style="margin-top:1.5rem;">
          <button id="applyRecommendedBtn" class="sd-btn success">
            <i class="fas fa-check-circle"></i> USE THIS SECTION
          </button>
        </div>
      </div>
    </div>
  `;

  // Render Alternative Passing Sections
  if (passingCandidates.length > 1) {
    html += `
      <div style="margin-bottom:2rem;">
        <h3 style="color:var(--chalk); border-bottom:1px solid var(--line); padding-bottom:0.5rem;">PASSING ALTERNATIVES</h3>
        <table class="sd-table" style="width:100%; text-align:left; border-collapse:collapse; margin-top:1rem; font-size:0.9rem;">
          <thead>
            <tr style="border-bottom:1px solid var(--line);">
              <th style="padding:0.5rem;">Section</th>
              <th style="padding:0.5rem;">Weight (kg/m)</th>
              <th style="padding:0.5rem;">DCR</th>
              <th style="padding:0.5rem;">Governing</th>
              <th style="padding:0.5rem;">Seismic</th>
            </tr>
          </thead>
          <tbody>
            ${passingCandidates.slice(1, 10).map(c => `
              <tr style="border-bottom:1px solid var(--line);">
                <td style="padding:0.5rem; color:var(--chalk);">${c.section.designation}</td>
                <td style="padding:0.5rem;">${c.weight.toFixed(1)}</td>
                <td style="padding:0.5rem;">${c.dcr.toFixed(2)}</td>
                <td style="padding:0.5rem;">${c.governingLimitState || '-'}</td>
                <td style="padding:0.5rem;">${c.seismicClassification || '-'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  // Render Rejected Sections
  if (rejectedCandidates.length > 0) {
    html += `
      <div>
        <button id="toggleRejectedBtn" class="sd-btn ghost" style="width:100%; text-align:left;">
          <i class="fas fa-chevron-down"></i> Show Rejected Sections (${rejectedCandidates.length})
        </button>
        <div id="rejectedSectionsList" style="display:none; margin-top:1rem;">
          ${renderRejected(rejectedCandidates)}
        </div>
      </div>
    `;
  }

  container.innerHTML = html;

  // Interactions
  const applyBtn = document.getElementById('applyRecommendedBtn');
  if (applyBtn) {
    applyBtn.addEventListener('click', () => {
      // 1. Switch back to Check mode
      const radio = document.querySelector('input[name="calcMode"][value="CHECK"]');
      if (radio) {
        radio.checked = true;
        radio.dispatchEvent(new Event('change'));
      }
      
      // 2. Make it a Standard section source and fill in designation
      const sourceRadio = document.querySelector('input[name="sectionSource"][value="STANDARD"]');
      if (sourceRadio) {
        sourceRadio.checked = true;
        sourceRadio.dispatchEvent(new Event('change'));
      }
      
      const searchBox = document.getElementById('searchDesignation');
      if (searchBox) {
        searchBox.value = recommendedSection.section.designation;
        searchBox.dispatchEvent(new Event('input')); // filter list
      }

      // Simulate a click on the item in the list
      setTimeout(() => {
         const listWrap = document.querySelector('.sd-section-list-wrap');
         if (listWrap) {
           const items = listWrap.querySelectorAll('.section-item');
           for (const item of items) {
             if (item.querySelector('span').textContent === recommendedSection.section.designation) {
               item.click();
               break;
             }
           }
         }
         
         // Auto-compute to show details
         const computeBtn = document.getElementById('computeBtn');
         if (computeBtn) {
           computeBtn.click();
         }
      }, 50);

    });
  }

  const toggleRej = document.getElementById('toggleRejectedBtn');
  if (toggleRej) {
    toggleRej.addEventListener('click', () => {
      const list = document.getElementById('rejectedSectionsList');
      if (list.style.display === 'none') {
        list.style.display = 'block';
        toggleRej.innerHTML = '<i class="fas fa-chevron-up"></i> Hide Rejected Sections';
      } else {
        list.style.display = 'none';
        toggleRej.innerHTML = `<i class="fas fa-chevron-down"></i> Show Rejected Sections (${rejectedCandidates.length})`;
      }
    });
  }
}

function renderRejected(rejectedCandidates) {
  return `
    <ul style="list-style:none; padding:0; margin:0; font-size:0.85rem;">
      ${rejectedCandidates.slice(0, 50).map(c => `
        <li style="margin-bottom:0.75rem; padding-bottom:0.75rem; border-bottom:1px dashed var(--line);">
          <strong style="color:var(--chalk);">${c.section.designation}</strong><br>
          <span style="color:#e74c3c;">FAIL — ${c.failureReasons.length > 0 ? c.failureReasons.join(', ') : 'Limit State Exceeded'} ${c.dcr > 1.0 ? `(DCR = ${c.dcr.toFixed(2)})` : ''}</span>
        </li>
      `).join('')}
      ${rejectedCandidates.length > 50 ? `<li style="color:var(--mist);">...and ${rejectedCandidates.length - 50} more</li>` : ''}
    </ul>
  `;
}
