export function updateMemberTypeFields() {
  const memberTypeSelect = document.getElementById('memberType');
  const groupL = document.getElementById('group-l');
  const groupLbx = document.getElementById('group-lbx');
  const groupLby = document.getElementById('group-lby');
  const groupLbt = document.getElementById('group-lbt');
  const groupLbb = document.getElementById('group-lbb');
  const groupKx = document.getElementById('group-kx');
  const groupKy = document.getElementById('group-ky');
  const groupKz = document.getElementById('group-kz');
  const groupCb = document.getElementById('group-cb');
  const groupAxial = document.getElementById('group-pu');
  const groupVux = document.getElementById('group-vux');
  const groupVuy = document.getElementById('group-vuy');
  const groupMux = document.getElementById('group-mux');
  const groupMuy = document.getElementById('group-muy');
  const groupTu = document.getElementById('group-tu');

  if (!memberTypeSelect) return;
  const type = memberTypeSelect.value;
  
  // Hide all conditionally displayed fields first
  if(groupL) groupL.style.display = 'none';
  if(groupLbx) groupLbx.style.display = 'none';
  if(groupLby) groupLby.style.display = 'none';
  if(groupLbt) groupLbt.style.display = 'none';
  if(groupLbb) groupLbb.style.display = 'none';
  if(groupKx) groupKx.style.display = 'none';
  if(groupKy) groupKy.style.display = 'none';
  if(groupKz) groupKz.style.display = 'none';
  if(groupCb) groupCb.style.display = 'none';
  if(groupAxial) groupAxial.style.display = 'none';
  if(groupVux) groupVux.style.display = 'none';
  if(groupVuy) groupVuy.style.display = 'none';
  if(groupMux) groupMux.style.display = 'none';
  if(groupMuy) groupMuy.style.display = 'none';
  if(groupTu) groupTu.style.display = 'none';
  
  // Show fields based on application
  if (type === 'beam') {
    if(groupL) groupL.style.display = 'block';
    if(groupLbx) groupLbx.style.display = 'block';
    if(groupLby) groupLby.style.display = 'block';
    if(groupLbt) groupLbt.style.display = 'block';
    if(groupLbb) groupLbb.style.display = 'block';
    if(groupCb) groupCb.style.display = 'block';
    if(groupVux) groupVux.style.display = 'block';
    if(groupVuy) groupVuy.style.display = 'block';
    if(groupMux) groupMux.style.display = 'block';
    if(groupMuy) groupMuy.style.display = 'block';
    if(groupTu) groupTu.style.display = 'block';
  } else if (type === 'column' || type === 'compression') {
    if(groupL) groupL.style.display = 'block';
    if(groupLbx) groupLbx.style.display = 'block';
    if(groupLby) groupLby.style.display = 'block';
    if(groupKx) groupKx.style.display = 'block';
    if(groupKy) groupKy.style.display = 'block';
    if(groupKz) groupKz.style.display = 'block';
    if(groupAxial) groupAxial.style.display = 'block';
    if (type === 'column') {
       if(groupLbt) groupLbt.style.display = 'block';
       if(groupLbb) groupLbb.style.display = 'block';
       if(groupVux) groupVux.style.display = 'block';
       if(groupVuy) groupVuy.style.display = 'block';
       if(groupMux) groupMux.style.display = 'block';
       if(groupMuy) groupMuy.style.display = 'block';
       if(groupTu) groupTu.style.display = 'block';
    }
  } else if (type === 'brace' || type === 'tension') {
    if(groupL) groupL.style.display = 'block';
    if(groupAxial) groupAxial.style.display = 'block';
  } else if (type === 'beam-column') {
    if(groupL) groupL.style.display = 'block';
    if(groupLbx) groupLbx.style.display = 'block';
    if(groupLby) groupLby.style.display = 'block';
    if(groupLbt) groupLbt.style.display = 'block';
    if(groupLbb) groupLbb.style.display = 'block';
    if(groupKx) groupKx.style.display = 'block';
    if(groupKy) groupKy.style.display = 'block';
    if(groupKz) groupKz.style.display = 'block';
    if(groupCb) groupCb.style.display = 'block';
    if(groupAxial) groupAxial.style.display = 'block';
    if(groupVux) groupVux.style.display = 'block';
    if(groupVuy) groupVuy.style.display = 'block';
    if(groupMux) groupMux.style.display = 'block';
    if(groupMuy) groupMuy.style.display = 'block';
    if(groupTu) groupTu.style.display = 'block';
  }
}

export function initMemberInputs() {
  const memberTypeSelect = document.getElementById('memberType');
  if (memberTypeSelect) {
    memberTypeSelect.addEventListener('change', updateMemberTypeFields);
    updateMemberTypeFields();
  }

  // Length Units handling
  const lengthUnitSelect = document.getElementById('lengthUnit');
  const lenInputs = [
    document.getElementById('memberLength'),
    document.getElementById('unbracedLengthX'),
    document.getElementById('unbracedLengthY'),
    document.getElementById('unbracedLengthTop'),
    document.getElementById('unbracedLengthBot')
  ];
  
  if (lengthUnitSelect) {
    let currentUnit = lengthUnitSelect.value;
    lengthUnitSelect.addEventListener('change', () => {
      const newUnit = lengthUnitSelect.value;
      if (newUnit !== currentUnit) {
        document.querySelectorAll('.unit-lbl').forEach(lbl => lbl.textContent = newUnit);
        
        // Convert values if they exist
        const factor = (newUnit === 'mm' && currentUnit === 'm') ? 1000 : 
                       (newUnit === 'm' && currentUnit === 'mm') ? 0.001 : 1;
                       
        lenInputs.forEach(input => {
          if (input && input.value) {
            input.value = (parseFloat(input.value) * factor).toFixed(newUnit === 'm' ? 3 : 0);
          }
        });
        
        currentUnit = newUnit;
      }
    });
  }

  const seismicToggle = document.getElementById('seismicToggle');
  const seismicParams = document.getElementById('seismicParams');

  if (seismicToggle) {
    seismicToggle.addEventListener('change', () => {
      if (seismicParams) {
        seismicParams.style.display = seismicToggle.checked ? 'grid' : 'none';
      }
    });
  }
}
