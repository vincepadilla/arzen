export function renderCalculationResults(results, containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;
  
  let html = '';
  
  // Render Global Summary First
  if (results.globalSummary) {
    const summary = results.globalSummary;
    const isPass = summary.status === 'PASS';
    html += `
      <div style="background: var(--surface); border: 2px solid ${isPass ? 'rgba(46, 204, 113, 0.5)' : 'rgba(231, 76, 60, 0.5)'}; border-radius: 8px; margin-bottom: 2rem; padding: 1.5rem; text-align: center; box-shadow: 0 4px 15px rgba(0,0,0,0.1);">
        <h2 style="margin: 0 0 1rem 0; color: var(--chalk); font-size: 1.5em; text-transform: uppercase; letter-spacing: 1px;">Overall Result: <span style="color: ${isPass ? '#2ecc71' : '#e74c3c'};">${summary.status}</span></h2>
        
        <div style="display: flex; justify-content: space-around; flex-wrap: wrap; gap: 1rem; color: var(--text-light); font-size: 1.05em;">
          <div>
            <div style="font-size: 0.85em; text-transform: uppercase; letter-spacing: 1px; color: var(--text); opacity: 0.7;">Governing Limit State</div>
            <div style="font-weight: 600; color: var(--primary); margin-top: 4px;">${summary.limitState}</div>
          </div>
          <div>
            <div style="font-size: 0.85em; text-transform: uppercase; letter-spacing: 1px; color: var(--text); opacity: 0.7;">Max D/C Ratio</div>
            <div style="font-weight: 600; color: ${isPass ? '#2ecc71' : '#e74c3c'}; margin-top: 4px; font-size: 1.2em;">${summary.ratio.toFixed(3)}</div>
          </div>
          <div>
            <div style="font-size: 0.85em; text-transform: uppercase; letter-spacing: 1px; color: var(--text); opacity: 0.7;">Demand</div>
            <div style="font-weight: 600; color: var(--primary); margin-top: 4px;">${summary.demand}</div>
          </div>
          <div>
            <div style="font-size: 0.85em; text-transform: uppercase; letter-spacing: 1px; color: var(--text); opacity: 0.7;">Capacity</div>
            <div style="font-weight: 600; color: var(--primary); margin-top: 4px;">${summary.capacity}</div>
          </div>
        </div>
      </div>
    `;
  }
  
  // Helper to render a limit state calcObj
  const renderLimitState = (calcObj) => {
    if (!calcObj) return '';
    
    // ── Variables table ──────────────────────────────────────────────────────
    let varsRows = '';
    if (calcObj.variables) {
      for (const [key, val] of Object.entries(calcObj.variables)) {
        varsRows += `
          <tr>
            <td style="padding:6px 10px; font-size:0.88rem; color:var(--mist,#999);">${val.symbol.replace(/\\\(/g,'').replace(/\\\)/g,'')}</td>
            <td style="padding:6px 10px; font-weight:600; color:var(--chalk,#eee);">${val.value}</td>
            <td style="padding:6px 10px; color:var(--mist,#999); font-size:0.85rem;">${val.unit}</td>
          </tr>`;
      }
    }
    const varsTable = varsRows ? `
      <table style="border-collapse:collapse; width:100%; margin-bottom:0.75rem;">
        <thead><tr>
          <th style="padding:6px 10px; text-align:left; color:var(--primary,#f5a623); font-size:0.8rem; text-transform:uppercase; letter-spacing:1px;">Symbol</th>
          <th style="padding:6px 10px; text-align:left; color:var(--primary,#f5a623); font-size:0.8rem; text-transform:uppercase; letter-spacing:1px;">Value</th>
          <th style="padding:6px 10px; text-align:left; color:var(--primary,#f5a623); font-size:0.8rem; text-transform:uppercase; letter-spacing:1px;">Unit</th>
        </tr></thead>
        <tbody>${varsRows}</tbody>
      </table>` : '';

    // ── Step-by-step trace table ─────────────────────────────────────────────
    let stepsRows = '';
    if (calcObj.steps && calcObj.steps.length) {
      calcObj.steps.forEach(s => {
        stepsRows += `
          <tr style="border-top:1px solid var(--border,#333);">
            <td style="padding:8px 10px; color:var(--mist,#999); font-size:0.83rem; white-space:nowrap; vertical-align:top;">Step ${s.step}</td>
            <td style="padding:8px 10px; color:var(--chalk,#eee); font-weight:600; vertical-align:top;">${s.title}</td>
            <td style="padding:8px 10px; color:var(--mist,#bbb); font-family:monospace; font-size:0.88rem; vertical-align:top;">${s.formula}</td>
            <td style="padding:8px 10px; color:var(--mist,#999); font-family:monospace; font-size:0.83rem; vertical-align:top;">${s.substitution}</td>
            <td style="padding:8px 10px; color:var(--amber,#f5a623); font-weight:700; white-space:nowrap; vertical-align:top;">${s.result} ${s.unit}</td>
          </tr>`;
      });
    }
    const stepsTable = stepsRows ? `
      <div style="overflow-x:auto; margin-bottom:0.75rem;">
      <table style="border-collapse:collapse; width:100%; min-width:500px;">
        <thead><tr style="background:rgba(0,0,0,0.25);">
          <th style="padding:6px 10px; text-align:left; color:var(--primary,#f5a623); font-size:0.78rem; text-transform:uppercase; letter-spacing:1px;">#</th>
          <th style="padding:6px 10px; text-align:left; color:var(--primary,#f5a623); font-size:0.78rem; text-transform:uppercase; letter-spacing:1px;">Step</th>
          <th style="padding:6px 10px; text-align:left; color:var(--primary,#f5a623); font-size:0.78rem; text-transform:uppercase; letter-spacing:1px;">Formula</th>
          <th style="padding:6px 10px; text-align:left; color:var(--primary,#f5a623); font-size:0.78rem; text-transform:uppercase; letter-spacing:1px;">Substitution</th>
          <th style="padding:6px 10px; text-align:left; color:var(--primary,#f5a623); font-size:0.78rem; text-transform:uppercase; letter-spacing:1px;">Result</th>
        </tr></thead>
        <tbody>${stepsRows}</tbody>
      </table>
      </div>` : '';
    
    // ── Expandable card HTML ─────────────────────────────────────────────────
    const statusColor = calcObj.status === 'PASS' ? '#2ecc71' : '#e74c3c';
    let objHtml = `
      <details style="background: var(--surface,#1e1e24); border: 1px solid var(--border,#333); border-radius: 8px; margin-bottom: 1.5rem; overflow: hidden;">
        <summary style="background: var(--border,#2a2a35); padding: 1rem 1.25rem; font-weight: 600;
                        display: flex; justify-content: space-between; align-items: center;
                        cursor:pointer; user-select:none; -webkit-user-select:none;
                        list-style: none; border-bottom:1px solid var(--border,#333);">
          <span style="display:flex; flex-direction:column; gap:3px;">
            <span style="font-size: 1.05em; color: var(--chalk,#eee);">${calcObj.limitState}</span>
            <span style="font-size: 0.8rem; opacity:0.6; color:var(--mist,#999);"
              >${calcObj.codeReference.standard} &nbsp;·&nbsp; Ch.${calcObj.codeReference.chapter} Sec.${calcObj.codeReference.section}</span>
          </span>
          <span style="display:flex; align-items:center; gap:12px; flex-shrink:0;">
            ${calcObj.ratio !== null ? `<span style="font-size:0.9rem; color:var(--mist,#999);">D/C = <strong style="color:${statusColor};">${calcObj.ratio.value}</strong></span>` : ''}
            <span style="padding: 5px 14px; border-radius: 20px;
                         background: ${calcObj.status === 'PASS' ? 'rgba(46,204,113,0.15)' : 'rgba(231,76,60,0.15)'};
                         border: 1px solid ${statusColor};
                         color: ${statusColor}; font-size: 0.9em; font-weight:700; letter-spacing:1px;">
              ${calcObj.status}
            </span>
          </span>
        </summary>

        <div style="padding: 1.5rem; font-family: monospace; font-size: 0.95em;
                    color: var(--text-light,#ccc); line-height: 1.6;">

          <!-- Formula reference -->
          <div style="margin-bottom:1rem; padding:0.75rem 1rem;
                      background:rgba(245,166,35,0.07); border-left:3px solid var(--primary,#f5a623);
                      border-radius:0 6px 6px 0;">
            <div style="font-size:0.78rem; text-transform:uppercase; letter-spacing:1px;
                        color:var(--primary,#f5a623); margin-bottom:6px;">Governing Formula (${calcObj.codeReference.standard})</div>
            <div style="color:var(--chalk,#eee); font-size:1.05em;">${calcObj.formula}</div>
          </div>

          <!-- Input variables table -->
          ${varsTable ? `<div style="margin-bottom:1rem;">
            <div style="font-size:0.78rem; text-transform:uppercase; letter-spacing:1px;
                        color:var(--primary,#f5a623); margin-bottom:6px;">Input Values</div>
            ${varsTable}
          </div>` : ''}

          <!-- Step-by-step calculation trace -->
          ${stepsTable ? `<div style="margin-bottom:1rem;">
            <div style="font-size:0.78rem; text-transform:uppercase; letter-spacing:1px;
                        color:var(--primary,#f5a623); margin-bottom:6px;">Step-by-Step Calculation Trace</div>
            ${stepsTable}
          </div>` : `
          <!-- Fallback: raw substitution + calculation -->
          <div style="margin-bottom:1rem;">
            <div style="font-size:0.78rem; text-transform:uppercase; letter-spacing:1px;
                        color:var(--primary,#f5a623); margin-bottom:6px;">Substitution</div>
            ${calcObj.substitution}
          </div>
          <div style="margin-bottom:1rem;">
            <div style="font-size:0.78rem; text-transform:uppercase; letter-spacing:1px;
                        color:var(--primary,#f5a623); margin-bottom:6px;">Calculation</div>
            ${calcObj.calculation}
          </div>`}

          <!-- Design strength -->
          <div style="margin-bottom:1rem; display:grid; grid-template-columns:1fr 1fr; gap:1rem;">
            <div style="padding:0.75rem; background:rgba(0,0,0,0.2); border-radius:6px;">
              <div style="font-size:0.78rem; text-transform:uppercase; letter-spacing:1px;
                          color:var(--primary,#f5a623); margin-bottom:4px;">
                ${(calcObj.designStrength.formula || '').includes('φ') || (calcObj.designStrength.formula || '').includes('phi') ? 'LRFD Design Strength' : 'ASD Allowable Strength'}
              </div>
              <div style="color:var(--chalk,#eee); margin-bottom:4px;">${calcObj.designStrength.formula || ''}</div>
              <div style="color:var(--mist,#bbb); font-size:0.9em;">${calcObj.designStrength.substitution || ''}</div>
              <div style="color:var(--amber,#f5a623); font-size:1.1em; font-weight:700; margin-top:6px;">
                ${calcObj.designStrength.value} ${calcObj.designStrength.unit || ''}
              </div>
            </div>
            <div style="padding:0.75rem; background:rgba(0,0,0,0.2); border-radius:6px;">
              <div style="font-size:0.78rem; text-transform:uppercase; letter-spacing:1px;
                          color:var(--primary,#f5a623); margin-bottom:4px;">Demand</div>
              <div style="color:var(--chalk,#eee); font-size:1.05em; font-weight:600; margin-bottom:4px;">
                ${calcObj.demand ? calcObj.demand.value : ''} ${calcObj.demand && calcObj.demand.unit ? calcObj.demand.unit : ''}
              </div>
              ${calcObj.ratio !== null ? `
              <div style="font-size:0.78rem; text-transform:uppercase; letter-spacing:1px;
                          color:var(--primary,#f5a623); margin-top:0.75rem; margin-bottom:4px;">D/C Ratio</div>
              <div style="color:var(--mist,#bbb); font-size:0.88em; margin-bottom:4px;">${calcObj.ratio.formula || ''}</div>
              <div style="color:var(--mist,#bbb); font-size:0.88em; margin-bottom:4px;">${calcObj.ratio.substitution ? calcObj.ratio.substitution + ' =' : ''} <strong style="color:${statusColor}; font-size:1.1em;">${calcObj.ratio.value}</strong></div>
              ` : ''}
            </div>
          </div>

          <!-- Final status banner -->
          <div style="text-align:center; padding:0.75rem; border-radius:6px;
                      background:${calcObj.status === 'PASS' || calcObj.status === 'COMPACT' ? 'rgba(46,204,113,0.1)' : 'rgba(231,76,60,0.1)'};
                      border:1px solid ${statusColor};">
            <span style="color:${statusColor}; font-weight:700; font-size:1.1em; letter-spacing:2px;">${calcObj.status}</span>
            &nbsp;— ${calcObj.limitState} ${calcObj.ratio !== null ? `D/C = ${calcObj.ratio.value} ${calcObj.status === 'PASS' ? '≤ 1.0' : '> 1.0'}` : ''}
          </div>

        </div>
      </details>
    `;
    return objHtml;
  };

  if (results.tension) {
    html += `<h3 style="margin-top: 2rem; margin-bottom: 1rem; color: var(--chalk); border-bottom: 1px solid var(--border); padding-bottom: 0.5rem;">Tension Checks</h3>`;
    html += renderLimitState(results.tension.grossYielding);
    html += renderLimitState(results.tension.netFracture);
  }

  if (results.compression) {
    html += `<h3 style="margin-top: 2rem; margin-bottom: 1rem; color: var(--chalk); border-bottom: 1px solid var(--border); padding-bottom: 0.5rem;">Compression Checks</h3>`;
    if (results.compression.flexuralBuckling) html += renderLimitState(results.compression.flexuralBuckling);
    if (results.compression.flexuralTorsionalBuckling) html += renderLimitState(results.compression.flexuralTorsionalBuckling);
  }

  if (results.flexure) {
    html += `<h3 style="margin-top: 2rem; margin-bottom: 1rem; color: var(--chalk); border-bottom: 1px solid var(--border); padding-bottom: 0.5rem;">Flexure Checks</h3>`;
    
    // Dynamically render all limit states attached directly to flexure (Major Axis)
    for (const key in results.flexure) {
        if (key !== 'minor' && key !== 'governingCapacity' && key !== 'governingRatio' && key !== 'passed' && typeof results.flexure[key] === 'object' && results.flexure[key].limitState) {
            html += renderLimitState(results.flexure[key]);
        }
    }
    
    // Minor-axis flexure rendering
    if (results.flexure.minor && results.flexure.minor.limitStates) {
        html += `<h4 style="margin-top: 1.5rem; margin-bottom: 1rem; color: var(--primary);">Minor-Axis Flexure</h4>`;
        for (const key in results.flexure.minor.limitStates) {
            html += renderLimitState(results.flexure.minor.limitStates[key]);
        }
    } else if (results.flexure.minor && results.flexure.minor.governingLimitState) {
        html += `<div style="margin-top: 1rem; color:var(--primary); font-weight:bold;">Minor-Axis Flexure</div>`;
        html += `<div style="margin-bottom: 1rem; padding: 1rem; background: var(--surface); border: 1px solid var(--border); border-radius: 8px;">
            <div>Governing Limit State: ${results.flexure.minor.governingLimitState}</div>
            <div>Governing Capacity: ${results.flexure.minor.governingCapacity.toFixed(2)} kN-m</div>
        </div>`;
    }
  }

  if (results.shear) {
    html += `<h3 style="margin-top: 2rem; margin-bottom: 1rem; color: var(--chalk); border-bottom: 1px solid var(--border); padding-bottom: 0.5rem;">Shear Checks</h3>`;
    html += renderLimitState(results.shear.majorAxisShear);
  }

  if (results.interaction) {
    html += `<h3 style="margin-top: 2rem; margin-bottom: 1rem; color: var(--chalk); border-bottom: 1px solid var(--border); padding-bottom: 0.5rem;">Combined Forces</h3>`;
    html += renderLimitState(results.interaction.combinedForces);
  }

  if (results.seismic && (results.seismic.compactness?.length > 0 || results.seismic.ductility?.length > 0)) {
    html += `<h3 style="margin-top: 2rem; margin-bottom: 1rem; color: var(--chalk); border-bottom: 1px solid var(--border); padding-bottom: 0.5rem;">Seismic Provisions & Compactness</h3>`;
    
    html += `<div style="background:var(--surface); border:1px solid var(--border); border-radius:8px; overflow:hidden; margin-bottom:1rem;">`;

    if (results.seismic.seismicNote) {
      html += `<div style="padding: 1rem 1.5rem; background: rgba(52, 152, 219, 0.1); border-bottom: 1px solid rgba(52, 152, 219, 0.2); color: var(--chalk); font-size: 0.95em; display:flex; align-items:center; gap:10px;">
        <i class="fas fa-info-circle" style="color: #3498db; font-size:1.2em;"></i> <span>${results.seismic.seismicNote}</span>
      </div>`;
    }
    
    html += `<div style="padding: 1.5rem; display:flex; flex-direction:column; gap:2rem;">`;
    
    if (results.seismic.compactness?.length > 0) {
        html += `<div>
            <h4 style="margin:0 0 1rem 0; color:var(--primary); font-size:1.05em; text-transform:uppercase; letter-spacing:1px; border-bottom:1px solid rgba(255,255,255,0.05); padding-bottom:0.5rem;">Compactness</h4>
            <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 1rem;">`;
        results.seismic.compactness.forEach(c => {
            html += `<div style="background:rgba(0,0,0,0.25); padding:1.25rem; border-radius:8px; border:1px solid rgba(255,255,255,0.05); transition: transform 0.2s, box-shadow 0.2s;" onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 4px 12px rgba(0,0,0,0.2)';" onmouseout="this.style.transform='none'; this.style.boxShadow='none';">
                <div style="font-weight:700; color:var(--chalk); margin-bottom:0.25rem; font-size:1.1em;">${c.limitState || c.element}</div>
                <div style="color:var(--mist); font-size:0.9em; margin-bottom:1rem;">Slenderness λ = <span style="color:#fff;">${c.lambda?.toFixed ? c.lambda.toFixed(2) : c.lambda}</span></div>
                <div style="display:flex; flex-direction:column; gap:0.5rem;">
                    <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(255,255,255,0.03); padding:0.5rem 0.75rem; border-radius:4px;">
                        <span style="color:var(--text-light); font-size:0.85em; text-transform:uppercase; letter-spacing:0.5px;">Axial</span>
                        <span style="color:${c.axial.classification === 'SLENDER' ? '#e74c3c' : '#2ecc71'}; font-weight:700; font-size:0.9em;">${c.axial.classification}</span>
                    </div>
                    <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(255,255,255,0.03); padding:0.5rem 0.75rem; border-radius:4px;">
                        <span style="color:var(--text-light); font-size:0.85em; text-transform:uppercase; letter-spacing:0.5px;">Flexural</span>
                        <span style="color:${c.flexural.classification === 'SLENDER' ? '#e74c3c' : '#2ecc71'}; font-weight:700; font-size:0.9em;">${c.flexural.classification}</span>
                    </div>
                </div>
            </div>`;
        });
        html += `</div></div>`;
    }
    
    if (results.seismic.ductility?.length > 0) {
        html += `<div>
            <h4 style="margin:0 0 1rem 0; color:var(--primary); font-size:1.05em; text-transform:uppercase; letter-spacing:1px; border-bottom:1px solid rgba(255,255,255,0.05); padding-bottom:0.5rem;">Ductility</h4>
            <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem;">`;
        results.seismic.ductility.forEach(d => {
            const isHD = d.classification === 'HIGHLY DUCTILE';
            const isMD = d.classification === 'MODERATELY DUCTILE';
            const color = isHD ? '#2ecc71' : (isMD ? '#f39c12' : '#e74c3c');
            html += `<div style="background:rgba(0,0,0,0.25); padding:1.25rem; border-radius:8px; border:1px solid rgba(255,255,255,0.05); text-align:center; transition: transform 0.2s, box-shadow 0.2s;" onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 4px 12px rgba(0,0,0,0.2)';" onmouseout="this.style.transform='none'; this.style.boxShadow='none';">
                <div style="font-weight:700; color:var(--chalk); margin-bottom:0.25rem; font-size:1.1em;">${d.element}</div>
                <div style="color:var(--mist); font-size:0.85em; margin-bottom:1rem;">λ = ${d.lambda?.toFixed ? d.lambda.toFixed(2) : d.lambda}</div>
                <div style="display:inline-block; padding:0.4rem 1rem; background:rgba(255,255,255,0.05); border-radius:20px; font-size:0.85em; font-weight:700; color:${color}; letter-spacing:0.5px;">${d.classification}</div>
            </div>`;
        });
        html += `</div></div>`;
    }
    
    html += `</div></div>`;
  }

  if (html === '') {
    html = `<div style="padding: 2rem; text-align: center; color: var(--text-light);">No calculations were executed for this member type.</div>`;
  }

  container.innerHTML = html;
  
  // Show section if this is the main calculation
  if (containerId === 'calculationResults') {
    const capSection = document.getElementById('capacitySection');
    if (capSection) capSection.style.display = 'block';
  }

  // Trigger MathJax parsing
  if (window.MathJax) {
    MathJax.typesetPromise([container]).catch((err) => console.log('MathJax error: ', err));
  }
}
