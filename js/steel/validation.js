export function showError(inputEl, msg) {
  if (!inputEl) return;
  inputEl.style.borderColor = 'var(--red, #ef4444)';
  let err = inputEl.parentNode.querySelector('.error-msg');
  if (!err) {
    err = document.createElement('span');
    err.className = 'error-msg';
    err.style.color = 'var(--red, #ef4444)';
    err.style.fontSize = '0.8rem';
    err.style.marginTop = '4px';
    err.style.display = 'block';
    inputEl.parentNode.appendChild(err);
  }
  err.textContent = msg;
}

export function clearError(inputEl) {
  if (!inputEl) return;
  inputEl.style.borderColor = '';
  const err = inputEl.parentNode.querySelector('.error-msg');
  if (err) err.remove();
}

export function checkValidField(id, name, minVal = 0, requiresPositive = false) {
  const el = document.getElementById(id);
  if (!el || (el.parentNode && el.parentNode.style.display === 'none')) {
    if (el) clearError(el);
    return true; // Not required/visible
  }
  const val = parseFloat(el.value);
  if (isNaN(val) || (requiresPositive ? val <= minVal : val < minVal)) {
    showError(el, `Invalid ${name} (must be > ${minVal})`);
    return false;
  } else {
    clearError(el);
    return true;
  }
}
