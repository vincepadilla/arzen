import { runSteelDesign } from './calculations/steelDesign.js';

export function designMember(params) {
  const { family, sections, designState, economicMetric, maxDcr = 1.0, isSeismic } = params;

  const candidates = [];
  let evaluatedCount = 0;

  for (const dbSection of sections) {
    evaluatedCount++;
    
    // Copy the design state and inject the section to test
    const testState = {
      ...designState,
      section: dbSection
    };

    try {
      // run steel design for this section
      const results = runSteelDesign(testState);
      
      // If no global summary, assume it didn't trigger any limit states or failed parsing
      if (!results || !results.globalSummary) continue;

      const dcr = results.globalSummary.maxDcr;
      const governing = results.globalSummary.governingLimitState;
      const pass = results.globalSummary.pass;
      const failureReasons = results.globalSummary.failureReasons || [];

      // Ensure every mandatory check passes
      let acceptable = pass && dcr <= maxDcr;
      
      // Filter out sections lacking properties, this should be caught by failureReasons usually
      
      const candidate = {
        section: dbSection,
        passed: acceptable,
        weight: dbSection.weight || 0,
        area: dbSection.area || 0,
        dcr: dcr,
        governingLimitState: governing,
        failureReasons: failureReasons,
        fullResults: results, // keep for viewing later
        seismicPass: true // default
      };

      // Seismic Qualification
      if (isSeismic && testState.seismicParams) {
         // Determine if it passes the requested ductility
         const reqDuctility = testState.seismicParams.ductility;
         const seismicResult = results.seismicSummary; // assuming the engine returns this

         if (!seismicResult) {
            candidate.seismicPass = false;
            candidate.passed = false;
            candidate.failureReasons.push('Seismic evaluation missing or failed');
         } else {
            const isHD = seismicResult.classification === 'HIGHLY_DUCTILE' || seismicResult.classification === 'HD';
            const isMD = seismicResult.classification === 'MODERATELY_DUCTILE' || seismicResult.classification === 'MD';
            
            if (reqDuctility === 'HIGHLY_DUCTILE' || reqDuctility === 'HD' || reqDuctility === 'high') {
               if (!isHD) {
                  candidate.seismicPass = false;
                  candidate.passed = false;
                  candidate.failureReasons.push('Does not satisfy Highly Ductile requirement');
               }
            } else if (reqDuctility === 'MODERATELY_DUCTILE' || reqDuctility === 'MD' || reqDuctility === 'moderate') {
               if (!isHD && !isMD) {
                  candidate.seismicPass = false;
                  candidate.passed = false;
                  candidate.failureReasons.push('Does not satisfy Moderately Ductile requirement');
               }
            }
            
            candidate.seismicClassification = seismicResult.classification;
         }
      }

      candidates.push(candidate);
    } catch (e) {
      console.warn("Error evaluating section", dbSection.designation, e);
    }
  }

  // Filter passing candidates
  const passingCandidates = candidates.filter(c => c.passed);
  const rejectedCandidates = candidates.filter(c => !c.passed);

  // Economic Ranking
  passingCandidates.sort((a, b) => {
    // 1. weight
    if (Math.abs(a.weight - b.weight) > 0.001) {
      return a.weight - b.weight;
    }
    // 2. gross area (if weight missing or equal)
    if (Math.abs(a.area - b.area) > 0.001) {
      return a.area - b.area;
    }
    // 3. dcr
    return a.dcr - b.dcr;
  });

  const recommendedSection = passingCandidates.length > 0 ? passingCandidates[0] : null;

  return {
    recommendedSection,
    passingCandidates,
    rejectedCandidates,
    evaluatedCount
  };
}
