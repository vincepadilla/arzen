import { checkTension } from './tension.js';
import { checkCompression } from './compression.js';
import { checkFlexure } from './flexure.js';
import { checkShear } from './shear.js';
import { checkInteraction } from './interaction.js';
import { checkSeismic } from './seismic.js';
import { stepLogger } from './calculationSteps.js';

export function runSteelDesign(state) {
  stepLogger.clear();
  stepLogger.log("Starting structural design checks...");

  const results = {
    tension: null,
    compression: null,
    flexure: null,
    shear: null,
    interaction: null,
    seismic: null
  };

  const type = state.memberType;
  
  // Conditionally run checks based on member application
  if (type === 'tension' || type === 'brace' || type === 'column' || type === 'beam-column') {
    if (state.loadPu > 0 || type === 'tension' || type === 'brace') {
      // Technically Pu > 0 could be tension or compression, but we simplify here.
      results.tension = checkTension(state);
    }
  }

  if (type === 'compression' || type === 'brace' || type === 'column' || type === 'beam-column') {
    results.compression = checkCompression(state);
  }

  if (type === 'beam' || type === 'column' || type === 'beam-column') {
    results.flexure = checkFlexure(state);
    results.shear = checkShear(state);
  }

  if (type === 'column' || type === 'beam-column') {
    results.interaction = checkInteraction(state, results.tension, results.compression, results.flexure, results.shear);
  }

  results.seismic = checkSeismic(state);

  // --- Calculate Global Governing Limit State ---
  let maxRatio = -1;
  let governingState = null;

  let hasFailed = false;

  const traverseAndFindMax = (obj) => {
    if (!obj) return;
    if (typeof obj === 'object') {
      // Check status even if ratio is null (e.g. seismic compactness)
      if (obj.status === 'FAIL' || obj.status === 'NON-COMPACT') {
        hasFailed = true;
      }

      if (obj.ratio !== undefined && obj.limitState !== undefined) {
        // This is a limit state calcObj
        if (obj.ratio !== null && obj.ratio.value > maxRatio) {
          maxRatio = obj.ratio.value;
          governingState = obj;
        }
      } else {
        // Iterate over keys
        for (const key in obj) {
          if (obj.hasOwnProperty(key)) {
            traverseAndFindMax(obj[key]);
          }
        }
      }
    }
  };

  traverseAndFindMax(results);

  if (governingState) {
    results.globalSummary = {
      limitState: governingState.limitState,
      ratio: governingState.ratio.value,
      demand: `${governingState.demand.value} ${governingState.demand.unit}`,
      capacity: `${governingState.designStrength.value} ${governingState.designStrength.unit}`,
      status: hasFailed ? 'FAIL' : 'PASS'
    };
  } else {
    results.globalSummary = null;
  }

  return results;
}
