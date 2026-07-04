"""Quick sanity test: run the default form values through run_design()."""
import sys
sys.stdout.reconfigure(encoding='utf-8')
from api.compute_lrfd import run_design

# Default values matching the HTML form (with serviceability inputs)
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
    "svc_wD": 20, "svc_wL": 10, "svc_sus": 0.3,
    "svc_support": "both", "svc_sensitive": "sensitive",
}

result = run_design(inputs)
left, mid, right = result["leftRes"], result["midRes"], result["rightRes"]
svc = result["svcRes"]

print("=== GRAVITY BEAM TEST ===")
print(f"Left  Support: top={left['top']}, bot={left['bot']}, web={left['web']}, tor={left['tor']}")
print(f"Midspan:       top={mid['top']},  bot={mid['bot']}, web={mid['web']}, tor={mid['tor']}")
print(f"Right Support: top={right['top']}, bot={right['bot']}, web={right['web']}, tor={right['tor']}")
print(f"Left  phiMnTop={left['svgData']['phiMnTop']:.1f} kN-m, phiVn={left['svgData']['phiVn']:.1f} kN, DCR={left['svgData']['maxDCR']:.3f}")
print(f"Mid   phiMnBot={mid['svgData']['phiMnBot']:.1f} kN-m, phiVn={mid['svgData']['phiVn']:.1f} kN, DCR={mid['svgData']['maxDCR']:.3f}")
print(f"Right phiMnTop={right['svgData']['phiMnTop']:.1f} kN-m, phiVn={right['svgData']['phiVn']:.1f} kN, DCR={right['svgData']['maxDCR']:.3f}")

# Serviceability assertions
assert svc is not None, "svcRes missing from response"
assert svc['deltaLL_mm'] > 0, "deltaLL should be positive"
assert svc['deltaPost_mm'] > 0, "deltaPost should be positive"
assert isinstance(svc['passLL'], bool), "passLL should be bool"
assert isinstance(svc['passLT'], bool), "passLT should be bool"
assert len(svc['crackChecks']) == 3, "Should have 3 crack checks"
assert all(isinstance(c['pass'], bool) for c in svc['crackChecks']), "crack pass should be bool"
print(f"Serviceability: deltaLL={svc['deltaLL_mm']:.2f} mm ({'PASS' if svc['passLL'] else 'FAIL'}), "
      f"deltaPost={svc['deltaPost_mm']:.2f} mm ({'PASS' if svc['passLT'] else 'FAIL'})")

# SMRF test
inputs_smrf = {**inputs,
    "beamType": "smrf",
    "wD": 20, "wL": 10, "vg": 0, "bCol": 0,
}
result_s = run_design(inputs_smrf)
ls, ms, rs = result_s["leftRes"], result_s["midRes"], result_s["rightRes"]
print("\n=== SMRF BEAM TEST ===")
print(f"Left  Support: top={ls['top']}, bot={ls['bot']}, web={ls['web']}")
print(f"Midspan:       top={ms['top']}, bot={ms['bot']}, web={ms['web']}")
print(f"Right Support: top={rs['top']}, bot={rs['bot']}, web={rs['web']}")
print(f"Left  DCR={ls['svgData']['maxDCR']:.3f}, phiVn={ls['svgData']['phiVn']:.1f} kN (SMRF Vc=0: {ls['svgData']['phiVn'] == 0})")

print("\nAll tests passed!")
