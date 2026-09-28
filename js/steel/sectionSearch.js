// Map dropdown values to AISC types
const typeMap = {
  'all': [],
  'w-shape': ['W'],
  'wt-shape': ['WT'],
  'c-shape': ['C', 'MC'],
  'angle': ['L'],
  'double-angle': ['DOUBLE_ANGLE'],
  'hss-rect': ['HSS'], // Simplified mapping
  'hss-round': ['HSS']
};

export function filterSections(database, typeVal, term, wMin, wMax, dMin, dMax, aMin, aMax) {
  const allowedTypes = typeMap[typeVal] || [];
  
  return database.filter(s => {
    // Type filter
    if (allowedTypes.length > 0 && !allowedTypes.includes(s.type)) return false;
    
    // Text search
    if (term && !s.designation.toLowerCase().includes(term)) return false;

    // Range filters
    if (wMin !== null && s.weight < wMin) return false;
    if (wMax !== null && s.weight > wMax) return false;

    if (dMin !== null && s.d < dMin) return false;
    if (dMax !== null && s.d > dMax) return false;

    if (aMin !== null && s.area < aMin) return false;
    if (aMax !== null && s.area > aMax) return false;

    return true;
  });
}
