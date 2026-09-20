export function getMaterialProperties(grade) {
  let fy = 345, fu = 450;
  let isCustom = false;
  
  switch (grade) {
    case 'a36': fy = 250; fu = 400; break;
    case 'a572-50': fy = 345; fu = 450; break;
    case 'a992': fy = 345; fu = 450; break;
    case 'a500-b': fy = 290; fu = 400; break;
    case 'a500-c': fy = 345; fu = 427; break;
    case 'custom': isCustom = true; break;
  }
  return { fy, fu, isCustom, E: 200000, G: 77200 };
}

export function updateMaterialUI() {
  const materialGrade = document.getElementById('materialGrade');
  const inputFy = document.getElementById('fy');
  const inputFu = document.getElementById('fu');
  const inputE = document.getElementById('E');
  const inputG = document.getElementById('G');

  if (!materialGrade || !inputFy || !inputFu) return;
  const grade = materialGrade.value;
  
  const { fy, fu, isCustom, E, G } = getMaterialProperties(grade);
  
  if (!isCustom) {
    inputFy.value = fy;
    inputFu.value = fu;
    inputFy.setAttribute('readonly', 'true');
    inputFu.setAttribute('readonly', 'true');
    inputE.setAttribute('readonly', 'true');
    inputG.setAttribute('readonly', 'true');
  } else {
    inputFy.removeAttribute('readonly');
    inputFu.removeAttribute('readonly');
    inputE.removeAttribute('readonly');
    inputG.removeAttribute('readonly');
  }
}
