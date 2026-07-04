"""Quick serviceability check smoke-test."""
import sys, json
sys.path.insert(0, '.')
from api.compute_lrfd import run_design

inputs = {
    "beamType": "gravity",
    "b": 250, "h": 450, "spanLn": 5.0, "fc": 28, "cover": 40,
    "fyMain": 414, "diaMain": 20,
    "fyWeb": 275, "diaWeb": 10, "nLegs": 2,
    "fyTor": 414, "diaTor": 16,
    "lambda": 1.0, "maxAgg": 20,
    "leftMuTop": 80, "leftMuBot": 0, "leftVu": 120, "leftTu": 10,
    "midMuTop": 0,  "midMuBot": 60, "midVu": 20,  "midTu": 0,
    "rightMuTop": 85, "rightMuBot": 0, "rightVu": 125, "rightTu": 12,
    # Serviceability
    "svc_wD": 20, "svc_wL": 10,
    "svc_sus": 0.3, "svc_support": "both", "svc_sensitive": "sensitive",
}

result = run_design(inputs)
svc = result['svcRes']

print("=== SERVICEABILITY CHECK ===")
print(f"deltaLL   = {svc['deltaLL_mm']:.2f} mm  (allow {svc['deltaAllow_LL']:.1f} mm)  {'PASS' if svc['passLL'] else 'FAIL'}")
print(f"deltaPost = {svc['deltaPost_mm']:.2f} mm  (allow {svc['deltaAllow_LT']:.1f} mm)  {'PASS' if svc['passLT'] else 'FAIL'}")
print("\nCrack checks:")
for c in svc['crackChecks']:
    status = 'N/A' if c['nBars'] < 2 else ('PASS' if c['pass'] else 'FAIL')
    print(f"  {c['section']}: s_actual={c['s_actual']} mm  s_allow={c['s_allow']} mm  {status}")

print("\nSummary rows:")
for r in svc['summary']:
    print(f"  {r['label']}: {r['computed']}  ({r['allow']})  {'PASS' if r['pass'] else 'FAIL'}")
