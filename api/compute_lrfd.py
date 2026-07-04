"""
LRFD Beam Design — Python Serverless Endpoint
Vercel Python runtime (api/compute_lrfd.py → /api/compute_lrfd)

Ported faithfully from lrfdscript.js:
  - getRebarArea          → get_rebar_area
  - computeMpr            → compute_mpr
  - calculateFlexureLayers → calculate_flexure_layers
  - computeSection        → compute_section
  - SMRF 2-pass logic     → inside handler

All formulas, constants, and HTML detail strings are preserved exactly.
"""

import json
import math
from http.server import BaseHTTPRequestHandler


# ──────────────────────────────────────────────────────────────────────────────
# Pure Computation Functions
# ──────────────────────────────────────────────────────────────────────────────

def get_rebar_area(dia):
    """Cross-sectional area of a round bar, mm²."""
    return math.pi * dia ** 2 / 4


def compute_mpr(As_mm2, fy, fc, b, d):
    """
    ACI 318-14 §18.6.5 — Probable Moment Strength.
    Uses 1.25 fy (probable yield) and φ = 1.0.
    Returns kN·m.
    """
    if As_mm2 <= 0 or d <= 0:
        return 0.0
    fy_pr = 1.25 * fy
    a = (As_mm2 * fy_pr) / (0.85 * fc * b)
    return As_mm2 * fy_pr * (d - a / 2) / 1e6  # kN·m, φ = 1.0


def calculate_flexure_layers(Mu_kNm, b, h, cover, fc, fy_main, dia_main,
                              dia_web, beam_type, max_agg):
    """
    Singly-reinforced flexure design with layer iteration.
    Mirrors calculateFlexureLayers() in lrfdscript.js exactly.
    Returns dict: { As, nBars, layers, d, txt, doubly, rho, details, phiMn }
    """
    if Mu_kNm <= 0:
        d_init = h - cover - dia_web - dia_main / 2
        return {
            "As": 0, "nBars": 0, "layers": [], "d": d_init,
            "txt": "0", "doubly": False, "rho": 0, "details": "", "phiMn": 0
        }

    phi_flex = 0.90
    Mu = Mu_kNm * 1e6  # N·mm
    main_bar_area = get_rebar_area(dia_main)
    min_clear_spacing = max(25, dia_main, (4 / 3) * max_agg)
    b_clear = b - 2 * (cover + dia_web)

    num_layers = 1
    d = h - cover - dia_web - dia_main / 2
    As = 0
    nBars = 0
    rho = 0
    As_req = 0
    As_min = 0
    details = f'<p class="calc-step">&nbsp;&nbsp;Initial assumption: 1 layer, d = {d:.1f} mm</p>'

    while num_layers <= 5:
        Rn = Mu / (phi_flex * b * d ** 2)
        inner = 1 - (2 * Rn) / (0.85 * fc)
        if inner < 0:
            details += (
                f'<p class="calc-step" style="color:#e74c3c;">'
                f'&nbsp;&nbsp;<strong>Requires Doubly Reinforced Design</strong>'
                f' (Rn too high for {num_layers} layers, d={d:.1f})</p>'
            )
            return {
                "As": 0, "nBars": 0, "layers": [], "d": d,
                "txt": "Doubly Reinf.", "doubly": True, "rho": 0,
                "details": details, "phiMn": 0
            }

        rho = (0.85 * fc / fy_main) * (1 - math.sqrt(inner))
        As_min1 = (math.sqrt(fc) / (4 * fy_main)) * b * d
        As_min2 = (1.4 / fy_main) * b * d
        As_min = max(As_min1, As_min2)
        As_req = rho * b * d
        As = max(As_req, As_min)
        nBars = math.ceil(As / main_bar_area)

        max_bars_per_layer = math.floor(
            (b_clear + min_clear_spacing) / (dia_main + min_clear_spacing)
        )
        if max_bars_per_layer < 2:
            max_bars_per_layer = 2  # practical minimum: 2 bars for stirrup corners

        required_layers = math.ceil(nBars / max_bars_per_layer)
        if required_layers <= num_layers:
            break  # fits in the assumed number of layers

        # Need more layers — recalculate d
        num_layers = required_layers
        centroid_dist = (
            cover + dia_web + dia_main / 2
            + ((num_layers - 1) / 2) * 25  # 25 mm vertical clear spacing
        )
        d = h - centroid_dist
        details += (
            f'<p class="calc-step" style="color:#f39c12;">'
            f'&nbsp;&nbsp;Rebars exceed width. Iterating to {num_layers} layers,'
            f' new d = {d:.1f} mm</p>'
        )

    # Build layer list
    max_bars_per_layer = math.floor(
        (b_clear + min_clear_spacing) / (dia_main + min_clear_spacing)
    )
    if max_bars_per_layer < 2:
        max_bars_per_layer = 2
    layers = []
    remaining = nBars
    for _ in range(num_layers):
        if remaining > max_bars_per_layer:
            layers.append(max_bars_per_layer)
            remaining -= max_bars_per_layer
        else:
            layers.append(remaining)
            remaining = 0
            break

    if beam_type == 'smrf' and rho > 0.025:
        details += (
            f'<p class="calc-step" style="color:#e74c3c;">'
            f'&nbsp;&nbsp;<strong>SMRF FAILED:</strong>'
            f' &rho; = {rho:.4f} &gt; 0.025 (NSCP 418.6.3.1).</p>'
        )

    details += f'<p class="calc-step">&nbsp;&nbsp;&rho; = {rho:.5f} &rarr; As_req = {As_req:.1f} mm&sup2;</p>'
    details += f'<p class="calc-step">&nbsp;&nbsp;As_min = {As_min:.1f} mm&sup2;</p>'
    details += (
        f'<p class="calc-step">&nbsp;&nbsp;<strong>Provided:</strong>'
        f' {As:.1f} mm&sup2; <strong>({nBars} - &empty;{dia_main:.0f})</strong></p>'
    )
    if num_layers > 1:
        details += (
            f'<p class="calc-step">&nbsp;&nbsp;<em>'
            f'Layer detailing: [{", ".join(str(x) for x in layers)}] (bottom/top to inner)'
            f'</em></p>'
        )

    a_actual = (As * fy_main) / (0.85 * fc * b)
    phi_Mn = phi_flex * As * fy_main * (d - a_actual / 2) / 1e6  # kN·m

    txt = f"{nBars}x\u00D8{dia_main:.0f}"
    return {
        "As": As, "nBars": nBars, "layers": layers, "d": d,
        "txt": txt, "doubly": False, "rho": rho,
        "details": details, "phiMn": phi_Mn
    }


def compute_section(sec_name, beam_type,
                    Mu_top_kNm, Mu_bot_kNm, Vu_kN, Tu_kNm,
                    b, h, span_Ln, cover,
                    fc, fy_main, dia_main,
                    fy_web, dia_web, n_legs,
                    fy_tor, dia_tor,
                    lmbda=1.0, max_agg=20, smrf_data=None):
    """
    Full section design: flexure (top + bottom) + shear + torsion.
    Mirrors computeSection() in lrfdscript.js exactly.
    Returns dict matching the JS return value.
    """
    phi_flex  = 0.90
    phi_shear = 0.75

    main_bar_area = get_rebar_area(dia_main)
    web_bar_area  = get_rebar_area(dia_web)
    tor_bar_area  = get_rebar_area(dia_tor)
    Av = n_legs * web_bar_area

    details_html = f'<div class="calc-section"><h4>{sec_name} Section</h4>'

    # ── §18.6.2 Geometry Checks ──────────────────────────────────────────────
    if beam_type == 'smrf':
        if b < 250:
            details_html += (
                f'<p class="calc-step" style="color:#e74c3c;">'
                f'<strong>SMRF §18.6.2.1 FAIL:</strong> b = {b:.0f} mm &lt; 250 mm</p>'
            )
        if b < 0.3 * h:
            details_html += (
                f'<p class="calc-step" style="color:#e74c3c;">'
                f'<strong>SMRF §18.6.2.1 FAIL:</strong> b = {b:.0f} mm &lt; 0.3h = {0.3*h:.0f} mm</p>'
            )
        if smrf_data and smrf_data.get('bCol', 0) > 0:
            b_max = smrf_data['bCol'] + 3 * h
            ok_18623 = b <= b_max
            details_html += (
                f'<p class="calc-step" style="color:{"#16a34a" if ok_18623 else "#e74c3c"};">'
                f'<strong>SMRF §18.6.2.3:</strong> b = {b:.0f} mm '
                f'{"&le;" if ok_18623 else "&gt;"} '
                f'(bCol + 3h) = {b_max:.0f} mm. {"✓" if ok_18623 else "FAIL"}</p>'
            )
        details_html += (
            '<p class="calc-step"><strong>§18.6.3.1:</strong>'
            ' Min 2 continuous bars top &amp; bottom throughout span.</p>'
        )

    # ── FLEXURE — Top ────────────────────────────────────────────────────────
    txt_top = '0'
    top_layers = []
    d_top = h - cover - dia_web - dia_main / 2
    phi_Mn_top = 0.0
    As_top = 0.0

    if Mu_top_kNm > 0:
        details_html += (
            f'<p class="calc-step"><strong>Top Flexure (&minus;Mu):</strong>'
            f' {Mu_top_kNm} kN&middot;m</p>'
        )
        tc = calculate_flexure_layers(Mu_top_kNm, b, h, cover, fc,
                                      fy_main, dia_main, dia_web, beam_type, max_agg)
        details_html += tc['details']
        txt_top    = tc['txt']
        top_layers = tc['layers']
        d_top      = tc['d']
        phi_Mn_top = tc['phiMn']
        As_top     = tc['As']
    else:
        As_top = 2 * main_bar_area
        top_layers = [2]
        a_act = (As_top * fy_main) / (0.85 * fc * b)
        phi_Mn_top = phi_flex * As_top * fy_main * (d_top - a_act / 2) / 1e6
        txt_top = f'2x\u00D8{dia_main:.0f}' if beam_type == 'smrf' else '0'
        if beam_type == 'smrf':
            details_html += (
                '<p class="calc-step">Top: No moment demand &rarr; Min 2 hanger bars (§18.6.3.1).</p>'
            )

    # ── FLEXURE — Bottom ─────────────────────────────────────────────────────
    txt_bot = '0'
    bot_layers = []
    d_bot = h - cover - dia_web - dia_main / 2
    phi_Mn_bot = 0.0
    As_bot = 0.0

    if Mu_bot_kNm > 0:
        details_html += (
            f'<p class="calc-step"><strong>Bottom Flexure (+Mu):</strong>'
            f' {Mu_bot_kNm} kN&middot;m</p>'
        )
        bc = calculate_flexure_layers(Mu_bot_kNm, b, h, cover, fc,
                                      fy_main, dia_main, dia_web, beam_type, max_agg)
        details_html += bc['details']
        txt_bot    = bc['txt']
        bot_layers = bc['layers']
        d_bot      = bc['d']
        phi_Mn_bot = bc['phiMn']
        As_bot     = bc['As']
    else:
        As_bot = 2 * main_bar_area
        bot_layers = [2]
        a_act = (As_bot * fy_main) / (0.85 * fc * b)
        phi_Mn_bot = phi_flex * As_bot * fy_main * (d_bot - a_act / 2) / 1e6
        txt_bot = f'2x\u00D8{dia_main:.0f}' if beam_type == 'smrf' else '0'
        if beam_type == 'smrf':
            details_html += (
                '<p class="calc-step">Bottom: No moment demand &rarr; Min 2 hanger bars (§18.6.3.1).</p>'
            )

    # ── §18.6.3 SMRF Flexural Proportion Checks ──────────────────────────────
    if beam_type == 'smrf':

        # §18.6.3.2 — 25% Rule
        if smrf_data and smrf_data.get('minAny', 0) > 0:
            min_any     = smrf_data['minAny']
            max_jnt_As  = smrf_data['maxJointAs']
            details_html += (
                f'<p class="calc-step"><strong>§18.6.3.2 (25% Rule):</strong>'
                f' As at any section &ge; {min_any:.0f} mm&sup2;'
                f' (0.25 &times; max joint As = {max_jnt_As:.0f} mm&sup2;)</p>'
            )

            if As_top < min_any - 0.5:
                n_req = math.ceil(min_any / main_bar_area)
                As_top = n_req * main_bar_area
                top_layers = [n_req]
                txt_top = f'{n_req}x\u00D8{dia_main:.0f}'
                a = (As_top * fy_main) / (0.85 * fc * b)
                phi_Mn_top = phi_flex * As_top * fy_main * (d_top - a / 2) / 1e6
                details_html += (
                    f'<p class="calc-step" style="color:#f39c12;">'
                    f'&nbsp;&nbsp;Top bars bumped &rarr; {n_req}&times;\u00D8{dia_main:.0f}'
                    f' (As = {As_top:.0f} mm&sup2;) ✓</p>'
                )
            else:
                details_html += (
                    f'<p class="calc-step">&nbsp;&nbsp;Top: As = {As_top:.0f} mm&sup2;'
                    f' &ge; {min_any:.0f} mm&sup2; ✓</p>'
                )

            if As_bot < min_any - 0.5:
                n_req = math.ceil(min_any / main_bar_area)
                As_bot = n_req * main_bar_area
                bot_layers = [n_req]
                txt_bot = f'{n_req}x\u00D8{dia_main:.0f}'
                a = (As_bot * fy_main) / (0.85 * fc * b)
                phi_Mn_bot = phi_flex * As_bot * fy_main * (d_bot - a / 2) / 1e6
                details_html += (
                    f'<p class="calc-step" style="color:#f39c12;">'
                    f'&nbsp;&nbsp;Bottom bars bumped &rarr; {n_req}&times;\u00D8{dia_main:.0f}'
                    f' (As = {As_bot:.0f} mm&sup2;) ✓</p>'
                )
            else:
                details_html += (
                    f'<p class="calc-step">&nbsp;&nbsp;Bottom: As = {As_bot:.0f} mm&sup2;'
                    f' &ge; {min_any:.0f} mm&sup2; ✓</p>'
                )

        # §18.6.3.2 — 50% Rule (support sections only)
        if 'Support' in sec_name:
            req_Mn_pos = 0.5 * phi_Mn_top
            if phi_Mn_bot < req_Mn_pos - 0.1:
                n_req = math.ceil(0.5 * As_top / main_bar_area)
                As_bot = n_req * main_bar_area
                bot_layers = [n_req]
                txt_bot = f'{n_req}x\u00D8{dia_main:.0f}'
                a = (As_bot * fy_main) / (0.85 * fc * b)
                phi_Mn_bot = phi_flex * As_bot * fy_main * (d_bot - a / 2) / 1e6
                details_html += (
                    f'<p class="calc-step" style="color:#f39c12;">'
                    f'<strong>§18.6.3.2 (50% Rule):</strong> &phi;Mn&sup2; bumped &rarr;'
                    f' {n_req}&times;\u00D8{dia_main:.0f} so &phi;Mn&sup2; = {phi_Mn_bot:.1f} kN&middot;m'
                    f' &ge; 0.5&times;&phi;Mn&minus; = {req_Mn_pos:.1f} kN&middot;m ✓</p>'
                )
            else:
                details_html += (
                    f'<p class="calc-step">'
                    f'<strong>§18.6.3.2 (50% Rule):</strong> &phi;Mn&sup2; = {phi_Mn_bot:.1f} kN&middot;m'
                    f' &ge; 0.5&times;&phi;Mn&minus; = {req_Mn_pos:.1f} kN&middot;m ✓</p>'
                )
            # §18.6.4.3 first hoop note
            details_html += (
                f'<p class="calc-step"><strong>§18.6.4.3:</strong>'
                f' First hoop &le; 50 mm from column face.'
                f' Confinement zone = 2h = {2*h:.0f} mm.</p>'
            )

        # Local Mpr for this section
        Mpr_T = compute_mpr(As_top, fy_main, fc, b, d_top)
        Mpr_B = compute_mpr(As_bot, fy_main, fc, b, d_bot)
        details_html += (
            f'<p class="calc-step"><strong>Mpr (§18.6.5, this section):</strong>'
            f' Top = {Mpr_T:.1f} kN&middot;m, Bot = {Mpr_B:.1f} kN&middot;m</p>'
        )

    d = min(d_top, d_bot)

    # ── SHEAR & TORSION ──────────────────────────────────────────────────────
    txt_web = 'Not Req.'
    txt_tor = 'Not Req.'

    Vc_concrete = 0.17 * lmbda * math.sqrt(fc) * b * d   # N
    Vc_design   = Vc_concrete
    design_Vu_kN = Vu_kN

    if beam_type == 'smrf' and smrf_data:
        # §18.6.5.1 — Probable Shear from sway mechanism
        design_Vu_kN = smrf_data['ve_kN']
        Vc_design    = 0.0  # §18.6.5.2: Vc = 0

        details_html += (
            '<p class="calc-step"><strong>SMRF Probable Shear (ACI 318-14 §18.6.5.1):</strong></p>'
        )
        if smrf_data.get('vg', 0) > 0:
            details_html += (
                f'<p class="calc-step">&nbsp;&nbsp;V<sub>g</sub> = {smrf_data["vg"]:.1f} kN (user override)</p>'
            )
        else:
            details_html += (
                f'<p class="calc-step">&nbsp;&nbsp;w<sub>u</sub> = '
                f'1.2({smrf_data["wD"]:.1f}) + 1.0({smrf_data["wL"]:.1f})'
                f' = {smrf_data["wu"]:.1f} kN/m</p>'
            )
        details_html += (
            f'<p class="calc-step">&nbsp;&nbsp;Mpr,LT = {smrf_data["Mpr_LT"]:.1f} kN&middot;m'
            f' &nbsp; Mpr,LB = {smrf_data["Mpr_LB"]:.1f} kN&middot;m</p>'
        )
        details_html += (
            f'<p class="calc-step">&nbsp;&nbsp;Mpr,RT = {smrf_data["Mpr_RT"]:.1f} kN&middot;m'
            f' &nbsp; Mpr,RB = {smrf_data["Mpr_RB"]:.1f} kN&middot;m</p>'
        )
        details_html += (
            f'<p class="calc-step">&nbsp;&nbsp;Sway L&rarr;R: Ve = {smrf_data["Ve_case1"]:.1f} kN'
            f' &nbsp;&nbsp; Sway R&rarr;L: Ve = {smrf_data["Ve_case2"]:.1f} kN</p>'
        )
        details_html += (
            f'<p class="calc-step">&nbsp;&nbsp;<strong>Design Ve = {smrf_data["ve_kN"]:.1f} kN</strong>'
            f' (governs over user Vu = {Vu_kN:.1f} kN)</p>'
        )
        details_html += (
            f'<p class="calc-step" style="color:#f39c12;">'
            f'&nbsp;&nbsp;<strong>§18.6.5.2: Vc = 0</strong>'
            f' (seismic shear &ge; 50% Ve assumed; Pu &le; Agf\'c/20 for beams)</p>'
        )
        details_html += (
            f'<p class="calc-step">&nbsp;&nbsp;'
            f'(Vc,calc = {phi_shear * Vc_concrete / 1000:.1f} kN &mdash; neglected per §18.6.5.2)</p>'
        )
    else:
        details_html += (
            f'<p class="calc-step"><strong>Shear &amp; Torsion:</strong>'
            f' Vu = {Vu_kN} kN, Tu = {Tu_kNm} kN&middot;m</p>'
        )
        details_html += (
            f'<p class="calc-step">&nbsp;&nbsp;&phi;Vc = {phi_shear * Vc_concrete / 1000:.2f} kN</p>'
        )

    design_Vu_N = design_Vu_kN * 1000  # N
    Tu_Nmm      = Tu_kNm * 1e6         # N·mm

    # Torsion threshold
    Acp = b * h
    pcp = 2 * (b + h)
    Tth = 0.083 * lmbda * math.sqrt(fc) * (Acp ** 2) / pcp   # N·mm
    details_html += (
        f'<p class="calc-step">&nbsp;&nbsp;Tth = {Tth / 1e6:.2f} kN&middot;m'
        f' &rarr; &phi;Tth = {phi_shear * Tth / 1e6:.2f} kN&middot;m</p>'
    )

    At_s      = 0.0
    has_torsion = False
    ph        = 0.0

    if Tu_Nmm > phi_shear * Tth:
        has_torsion = True
        details_html += '<p class="calc-step">&nbsp;&nbsp;Tu &gt; &phi;Tth, Torsion must be considered.</p>'
        x1  = b - 2 * cover - dia_web
        y1  = h - 2 * cover - dia_web
        ph  = 2 * (x1 + y1)
        Aoh = x1 * y1
        Ao  = 0.85 * Aoh
        Tn  = Tu_Nmm / phi_shear
        At_s = Tn / (2 * Ao * fy_web)
        details_html += f'<p class="calc-step">&nbsp;&nbsp;Req. At/s = {At_s:.3f} mm&sup2;/mm (per leg)</p>'

        Al_req   = At_s * ph * (fy_web / fy_tor)
        At_s_min = max(At_s, (0.175 * b) / fy_web)
        Al_min   = (0.42 * math.sqrt(fc) * Acp / fy_tor) - (At_s_min * ph * (fy_web / fy_tor))
        Al = max(Al_req, Al_min)
        details_html += (
            f'<p class="calc-step">&nbsp;&nbsp;Req. Al = {Al_req:.1f} mm&sup2;,'
            f' Al_min = {Al_min:.1f} mm&sup2;</p>'
        )

        n_tor_bars_local = math.ceil(Al / tor_bar_area)
        txt_tor = f'{n_tor_bars_local}x\u00D8{dia_tor:.0f}'
        details_html += (
            f'<p class="calc-step">&nbsp;&nbsp;<strong>Provided Al:</strong>'
            f' {Al:.1f} mm&sup2; <strong>({n_tor_bars_local} &minus; &empty;{dia_tor:.0f})</strong></p>'
        )
    else:
        details_html += '<p class="calc-step">&nbsp;&nbsp;Tu &le; &phi;Tth, Torsion neglected.</p>'

    # Shear design
    Vs_req   = max((design_Vu_N / phi_shear) - Vc_design, 0)
    Av_s     = Vs_req / (fy_web * d)
    details_html += f'<p class="calc-step">&nbsp;&nbsp;Req. Av/s (Shear) = {Av_s:.3f} mm&sup2;/mm</p>'

    min_Av_s    = max(0.062 * math.sqrt(fc) * b / fy_web, 0.35 * b / fy_web)
    total_Av_s  = Av_s + 2 * At_s
    details_html += (
        f'<p class="calc-step">&nbsp;&nbsp;Total Av/s (Shear + Torsion)'
        f' = {total_Av_s:.3f} mm&sup2;/mm</p>'
    )

    if (total_Av_s < min_Av_s
            and (design_Vu_N > 0.5 * phi_shear * Vc_concrete
                 or Tu_Nmm > phi_shear * Tth)):
        total_Av_s = min_Av_s
        details_html += (
            f'<p class="calc-step">&nbsp;&nbsp;Minimum reinforcement controls:'
            f' Av/s = {min_Av_s:.3f} mm&sup2;/mm</p>'
        )

    s = 0.0
    smrf_s_max = 0.0
    is_confinement = (beam_type == 'smrf') and ('Support' in sec_name)

    if total_Av_s > 0:
        s = Av / total_Av_s
        s_max = min(d / 2, 600)

        if beam_type == 'smrf':
            if is_confinement:
                # §18.6.4.4: Within 2h confinement zone
                smrf_s_max = min(d / 4, 6 * dia_main, 150)
                s_max = min(s_max, smrf_s_max)
                details_html += (
                    f'<p class="calc-step">'
                    f'<strong>§18.6.4.4 Confinement Zone (2h = {2*h:.0f} mm):</strong>'
                    f' s_max = min(d/4={d/4:.0f}, 6db={6*dia_main:.0f}, 150)'
                    f' = {smrf_s_max:.0f} mm</p>'
                )
                details_html += (
                    '<p class="calc-step">&nbsp;&nbsp;<em>'
                    'Closed hoops with 135&deg; hooks required (§18.6.4.1)'
                    '</em></p>'
                )
            else:
                # §18.6.4.5: Outside confinement zone
                s_max = min(s_max, d / 2)
                details_html += (
                    f'<p class="calc-step">'
                    f'<strong>§18.6.4.5 (Midspan / Outside Confinement):</strong>'
                    f' s_max = d/2 = {d/2:.0f} mm</p>'
                )

        if has_torsion:
            x1t = b - 2 * cover - dia_web
            y1t = h - 2 * cover - dia_web
            s_max = min(s_max, min(2 * (x1t + y1t) / 8, 300))

        s = min(s, s_max)
        s = math.floor(s / 25) * 25
        if s < 50:
            s = 50

        txt_web = f'\u00D8{dia_web:.0f} @ {s:.0f} mm'
        if is_confinement:
            txt_web = f'1@50, rest @ {s:.0f} mm (Hinge Zone)'
        elif beam_type == 'smrf':
            txt_web += ' (Span)'
        elif has_torsion:
            txt_web += ' (Shear+Tor)'

        details_html += (
            f'<p class="calc-step">&nbsp;&nbsp;<strong>'
            f'Provided Stirrups: 1@50, rest &empty;{dia_web:.0f} @ {s:.0f} mm</strong>'
        )
        if is_confinement:
            details_html += ' &nbsp;<em>(135&deg; closed hoops)</em>'
        details_html += '</p>'
    else:
        txt_web = 'Provide Min.'
        details_html += (
            '<p class="calc-step">&nbsp;&nbsp;<strong>Provided Stirrups:</strong>'
            ' Provide minimum spacing per code.</p>'
        )

    details_html += '</div>'

    # ── Torsion longitudinal bars count (for svgData) ────────────────────────
    if has_torsion and ph > 0:
        At_s_for_calc = At_s
        At_s_min_val  = max(At_s_for_calc, (0.175 * b) / fy_web)
        Al_req_val    = At_s_for_calc * ph * (fy_web / fy_tor)
        Al_min_val    = (0.42 * math.sqrt(fc) * Acp / fy_tor) - (At_s_min_val * ph * (fy_web / fy_tor))
        n_tor_bars    = math.ceil(max(Al_req_val, Al_min_val) / tor_bar_area)
    else:
        n_tor_bars = 0

    # ── Capacities and DCR ───────────────────────────────────────────────────
    phi_Vn = phi_shear * Vc_design / 1000   # kN  (0 for SMRF)
    phi_Tn = 0.0
    if s > 0:
        phi_Vn += phi_shear * (Av * fy_web * d / s) / 1000  # kN
        if has_torsion:
            x1c = b - 2 * cover - dia_web
            y1c = h - 2 * cover - dia_web
            Aoh = x1c * y1c
            Ao  = 0.85 * Aoh
            phi_Tn = phi_shear * (2 * Ao * (Av / (2 * s)) * fy_web) / 1e6  # kN·m

    dcr_top = (Mu_top_kNm / phi_Mn_top) if phi_Mn_top > 0 else 0.0
    dcr_bot = (Mu_bot_kNm / phi_Mn_bot) if phi_Mn_bot > 0 else 0.0
    dcr_V   = (design_Vu_kN / phi_Vn)   if phi_Vn    > 0 else 0.0
    dcr_T   = (Tu_kNm      / phi_Tn)    if phi_Tn    > 0 else 0.0
    max_DCR = max(dcr_top, dcr_bot, dcr_V, dcr_T)

    return {
        "top": txt_top,
        "bot": txt_bot,
        "web": txt_web,
        "tor": txt_tor,
        "details": details_html,
        "svgData": {
            "b": b, "h": h, "cover": cover,
            "topLayers": top_layers, "botLayers": bot_layers,
            "diaMain": dia_main, "diaWeb": dia_web,
            "nTorBars": n_tor_bars, "diaTor": dia_tor,
            "sSpacing": s if s else 0,
            "smrf_s_max": smrf_s_max if smrf_s_max else 0,
            "hasTorsion": has_torsion,
            "phiMnTop": phi_Mn_top, "phiMnBot": phi_Mn_bot,
            "phiVn": phi_Vn, "phiTn": phi_Tn,
            "maxDCR": max_DCR,
            "txtTop": txt_top, "txtBot": txt_bot,
            "txtWeb": txt_web, "txtTor": txt_tor,
            "Vu_kN": design_Vu_kN,   # show Ve in card for SMRF
            "Tu_kNm": Tu_kNm
        }
    }



# ──────────────────────────────────────────────────────────────────────────────
# Serviceability Check  (ACI 318-14 §24 / NSCP 2015 §406)
# ──────────────────────────────────────────────────────────────────────────────

def compute_serviceability(inputs, left_res, mid_res, right_res):
    """
    Performs ACI 318-14 §24 serviceability checks:
      1. Deflection  — immediate (LL) and long-term, checked against code limits.
      2. Crack width — bar spacing check per §24.3.2.

    Returns a dict:
      { details, deltaLL_mm, deltaLT_mm, deltaAllow_LL, deltaAllow_LT,
        passLL, passLT, crackChecks, summary }
    """
    # ── Geometry & material ──────────────────────────────────────────────────
    b       = float(inputs['b'])
    h       = float(inputs['h'])
    span_Ln = float(inputs['spanLn'])   # m
    fc      = float(inputs['fc'])       # MPa
    cover   = float(inputs['cover'])    # mm
    fy_main = float(inputs['fyMain'])   # MPa
    dia_main = float(inputs['diaMain']) # mm
    dia_web  = float(inputs['diaWeb'])  # mm
    lmbda   = float(inputs.get('lambda', 1.0))

    # Service loads (from serviceability card; fall back to SMRF wD/wL)
    wD  = float(inputs.get('svc_wD', 0) or inputs.get('wD', 0) or 0)  # kN/m
    wL  = float(inputs.get('svc_wL', 0) or inputs.get('wL', 0) or 0)  # kN/m
    beta_sus = float(inputs.get('svc_sus', 0.3) or 0.3)               # fraction of LL sustained
    support  = inputs.get('svc_support', 'both')
    sensitive = inputs.get('svc_sensitive', 'sensitive')

    Ln_mm = span_Ln * 1000   # mm

    # Deflection coefficient K based on support condition
    K_map = {'ss': 5/384, 'one': 0.0099, 'both': 0.0069, 'cant': 1/8}
    K = K_map.get(support, 0.0069)
    support_label = {
        'ss': 'Simply Supported', 'one': 'One End Continuous',
        'both': 'Both Ends Continuous', 'cant': 'Cantilever'
    }.get(support, 'Both Ends Continuous')

    # Allowable deflection denominators
    allow_LL_denom  = 360  # L/360 — floors (immediate LL)
    if sensitive == 'sensitive':
        allow_LT_denom = 480   # L/480 — sensitive non-structural elements
    elif sensitive == 'not_sensitive':
        allow_LT_denom = 240   # L/240 — not-sensitive non-structural elements
    else:
        allow_LT_denom = 360   # L/360 — no non-structural elements (use same)

    delta_allow_LL = Ln_mm / allow_LL_denom
    delta_allow_LT = Ln_mm / allow_LT_denom

    # ── Material properties ──────────────────────────────────────────────────
    Es = 200_000.0              # MPa
    Ec = 4700.0 * math.sqrt(fc)  # MPa (ACI §19.2.2.1, normal weight)
    n  = Es / Ec                 # modular ratio

    fr = 0.62 * lmbda * math.sqrt(fc)   # MPa (ACI §19.2.3.1)
    Ig = b * h**3 / 12                   # mm⁴
    yt = h / 2.0                         # mm
    Mcr = fr * Ig / yt / 1e6            # kN·m

    # ── Midspan section (governing for deflection) ───────────────────────────
    mid_svg = mid_res.get('svgData', {})
    As_mid  = mid_res.get('_As', 0.0)   # injected below in run_design if available

    # Fallback: estimate As from midspan bot layers + diaMain
    bot_layers = mid_svg.get('botLayers', [])
    if not As_mid and bot_layers:
        n_bars = sum(bot_layers)
        As_mid = n_bars * math.pi * dia_main**2 / 4

    if As_mid <= 0:
        # Cannot compute — return a skipped result
        return {
            'details': '<div class="calc-section"><h4>Serviceability</h4>'
                       '<p class="calc-step" style="color:#f39c12;">No tension reinforcement '
                       'found at midspan — serviceability check skipped.</p></div>',
            'deltaLL_mm': 0, 'deltaLT_mm': 0,
            'deltaAllow_LL': delta_allow_LL, 'deltaAllow_LT': delta_allow_LT,
            'passLL': True, 'passLT': True, 'crackChecks': [], 'summary': []
        }

    d_mid = h - cover - dia_web - dia_main / 2   # effective depth at midspan

    # ── Cracked moment of inertia (Icr) ──────────────────────────────────────
    rho  = As_mid / (b * d_mid)
    k    = math.sqrt(2 * rho * n + (rho * n)**2) - rho * n
    kd   = k * d_mid
    Icr  = b * kd**3 / 3 + n * As_mid * (d_mid - kd)**2   # mm⁴

    # ── Service moment at midspan (from wD + wL) ─────────────────────────────
    # Use w_total · Ln² / 8 (simply supported analogy) for Ma
    w_total_N_mm = (wD + wL) * 1000 / 1000   # N/mm  (kN/m → N/mm)
    Ma_kNm = (wD + wL) * span_Ln**2 / 8 if (wD + wL) > 0 else 0.01

    # ── Effective Ie (Branson's formula) ─────────────────────────────────────
    ratio = min(Mcr / Ma_kNm, 1.0) if Ma_kNm > 0 else 1.0
    Ie = ratio**3 * Ig + (1 - ratio**3) * Icr
    Ie = min(Ie, Ig)

    # ── Immediate deflection ──────────────────────────────────────────────────
    w_total_Nmm  = (wD + wL) * 1000 / 1000   # N/mm
    w_LL_Nmm     = wL * 1000 / 1000           # N/mm (live only)
    w_sust_Nmm   = (wD + beta_sus * wL) * 1000 / 1000  # N/mm (sustained)

    if Ec * Ie > 0:
        delta_total  = K * w_total_Nmm * Ln_mm**4 / (Ec * Ie)   # mm
        delta_LL     = K * w_LL_Nmm    * Ln_mm**4 / (Ec * Ie)   # mm
        delta_sust   = K * w_sust_Nmm  * Ln_mm**4 / (Ec * Ie)   # mm
    else:
        delta_total = delta_LL = delta_sust = 0.0

    # ── Long-term multiplier (ACI §24.2.4) ───────────────────────────────────
    # Assume no compression steel (conservative) → rho' = 0
    xi      = 2.0   # ≥ 5 years sustained
    rho_pr  = 0.0   # compression steel ratio (conservative)
    lambda_lt = xi / (1 + 50 * rho_pr)
    delta_lt  = lambda_lt * delta_sust

    # Total post-construction deflection = ΔLT + ΔimLL
    delta_post = delta_lt + delta_LL

    pass_LL = delta_LL   <= delta_allow_LL
    pass_LT = delta_post <= delta_allow_LT

    # ── Crack width check (ACI §24.3.2) ──────────────────────────────────────
    # fs (service) = 2/3 fy  (conservative, ACI Commentary R24.3.2)
    fs = (2.0 / 3.0) * fy_main   # MPa
    cc = cover + dia_web          # clear cover to longitudinal bar skin

    s_max1 = 380 * (280 / fs) - 2.5 * cc   # mm
    s_max2 = 300 * (280 / fs)               # mm
    s_allow = min(s_max1, s_max2)

    crack_checks = []
    for sec_name, res in [('Left Support', left_res), ('Midspan', mid_res), ('Right Support', right_res)]:
        svg = res.get('svgData', {})
        # Determine governing tension bars (top for support, bot for midspan)
        if 'Support' in sec_name:
            layers = svg.get('topLayers', [])
        else:
            layers = svg.get('botLayers', [])
        n_bars = sum(layers) if layers else 0
        if n_bars >= 2:
            b_clear = b - 2 * (cover + dia_web)
            s_actual = (b_clear - dia_main) / (n_bars - 1)
        elif n_bars == 1:
            s_actual = 0  # single bar — no spacing concern
        else:
            s_actual = float('inf')

        if n_bars >= 2:
            crack_pass = s_actual <= s_allow
        else:
            crack_pass = True

        crack_checks.append({
            'section': sec_name,
            'nBars': n_bars,
            's_actual': round(s_actual, 1) if n_bars >= 2 else 0,
            's_allow': round(s_allow, 1),
            'pass': crack_pass,
        })

    # ── Build HTML detail string ──────────────────────────────────────────────
    dh = '<div class="calc-section"><h4>Serviceability Check (ACI 318-14 \u00a724 / NSCP 2015 \u00a7406)</h4>'

    dh += f'<p class="calc-step"><strong>Material Properties:</strong></p>'
    dh += f'<p class="calc-step">&nbsp;&nbsp;Ec = 4700&radic;f\u2019c = {Ec:.0f} MPa | Es = {Es:.0f} MPa | n = {n:.1f}</p>'
    dh += f'<p class="calc-step">&nbsp;&nbsp;fr = 0.62&lambda;&radic;f\u2019c = {fr:.2f} MPa</p>'
    dh += f'<p class="calc-step">&nbsp;&nbsp;Ig = {Ig/1e6:.4f} \u00d710\u2076 mm\u2074 | yt = {yt:.0f} mm</p>'
    dh += f'<p class="calc-step">&nbsp;&nbsp;Mcr = {Mcr:.2f} kN&middot;m</p>'

    dh += f'<p class="calc-step"><strong>Midspan Section (governs deflection):</strong></p>'
    dh += f'<p class="calc-step">&nbsp;&nbsp;As,mid = {As_mid:.0f} mm\u00b2 | d = {d_mid:.1f} mm | &rho; = {rho:.5f}</p>'
    dh += f'<p class="calc-step">&nbsp;&nbsp;k = {k:.4f} &rarr; kd = {kd:.1f} mm | Icr = {Icr/1e6:.4f} \u00d710\u2076 mm\u2074</p>'
    dh += f'<p class="calc-step">&nbsp;&nbsp;Ma (service) = {Ma_kNm:.2f} kN&middot;m | Mcr/Ma = {ratio:.3f}</p>'
    dh += f'<p class="calc-step">&nbsp;&nbsp;Ie = {Ie/1e6:.4f} \u00d710\u2076 mm\u2074 (&le; Ig = {Ig/1e6:.4f})</p>'

    dh += f'<p class="calc-step"><strong>Deflection ({support_label}, K = {K:.4f}):</strong></p>'
    dh += f'<p class="calc-step">&nbsp;&nbsp;wD = {wD:.1f} kN/m | wL = {wL:.1f} kN/m | &beta;sus = {beta_sus:.2f}</p>'
    dh += f'<p class="calc-step">&nbsp;&nbsp;&Delta;imm (LL only) = {delta_LL:.2f} mm | Allow L/{allow_LL_denom} = {delta_allow_LL:.1f} mm'
    ok1_c = '#16a34a' if pass_LL else '#e74c3c'
    dh += f' <strong style="color:{ok1_c};">&rarr; {"PASS" if pass_LL else "FAIL"}</strong></p>'

    dh += f'<p class="calc-step">&nbsp;&nbsp;&lambda;&Delta; = &xi;/(1+50&rho;\u2019) = {xi:.1f}/(1+0) = {lambda_lt:.2f}</p>'
    dh += f'<p class="calc-step">&nbsp;&nbsp;&Delta;LT (sustained) = {delta_lt:.2f} mm</p>'
    dh += f'<p class="calc-step">&nbsp;&nbsp;&Delta;post = &Delta;LT + &Delta;LL = {delta_lt:.2f} + {delta_LL:.2f} = {delta_post:.2f} mm | Allow L/{allow_LT_denom} = {delta_allow_LT:.1f} mm'
    ok2_c = '#16a34a' if pass_LT else '#e74c3c'
    dh += f' <strong style="color:{ok2_c};">&rarr; {"PASS" if pass_LT else "FAIL"}</strong></p>'

    dh += f'<p class="calc-step"><strong>Crack Width Check (ACI \u00a724.3.2):</strong></p>'
    dh += f'<p class="calc-step">&nbsp;&nbsp;fs = 2/3 \u00d7 fy = {fs:.1f} MPa | cc = {cc:.0f} mm</p>'
    dh += f'<p class="calc-step">&nbsp;&nbsp;s\u2081 = 380(280/fs) \u2212 2.5cc = {s_max1:.1f} mm | s\u2082 = 300(280/fs) = {s_max2:.1f} mm</p>'
    dh += f'<p class="calc-step">&nbsp;&nbsp;s_allow = {s_allow:.1f} mm</p>'

    for ck in crack_checks:
        ok_c = '#16a34a' if ck['pass'] else '#e74c3c'
        if ck['nBars'] >= 2:
            dh += (f'<p class="calc-step">&nbsp;&nbsp;{ck["section"]}: s_actual = {ck["s_actual"]:.1f} mm '
                   f'<strong style="color:{ok_c};">&rarr; {"PASS" if ck["pass"] else "FAIL"}</strong></p>')
        else:
            dh += f'<p class="calc-step">&nbsp;&nbsp;{ck["section"]}: single bar or no bars &rarr; N/A</p>'

    dh += '</div>'

    summary = [
        {'label': '\u0394 Immediate LL', 'computed': f'{delta_LL:.2f} mm',
         'allow': f'L/{allow_LL_denom} = {delta_allow_LL:.1f} mm', 'pass': pass_LL},
        {'label': '\u0394 Post-Construction (\u0394LT + \u0394LL)', 'computed': f'{delta_post:.2f} mm',
         'allow': f'L/{allow_LT_denom} = {delta_allow_LT:.1f} mm', 'pass': pass_LT},
    ]
    for ck in crack_checks:
        if ck['nBars'] >= 2:
            summary.append({'label': f'Crack \u2014 {ck["section"]}',
                             'computed': f's = {ck["s_actual"]:.1f} mm',
                             'allow': f's_allow = {ck["s_allow"]:.1f} mm',
                             'pass': ck['pass']})

    return {
        'details': dh,
        'deltaLL_mm': round(delta_LL, 3),
        'deltaLT_mm': round(delta_lt, 3),
        'deltaPost_mm': round(delta_post, 3),
        'deltaAllow_LL': round(delta_allow_LL, 1),
        'deltaAllow_LT': round(delta_allow_LT, 1),
        'passLL': pass_LL,
        'passLT': pass_LT,
        'crackChecks': crack_checks,
        'summary': summary,
    }


# ──────────────────────────────────────────────────────────────────────────────
# Main Computation Orchestrator  (mirrors the computeBtn click handler)
# ──────────────────────────────────────────────────────────────────────────────

def run_design(inputs):
    """
    Accepts the dict of inputs collected from the HTML form.
    Returns { leftRes, midRes, rightRes, svcRes } or raises ValueError.
    """
    beam_type = inputs['beamType']
    b       = float(inputs['b'])
    h       = float(inputs['h'])
    span_Ln = float(inputs['spanLn'])
    fc      = float(inputs['fc'])
    cover   = float(inputs['cover'])

    fy_main  = float(inputs['fyMain'])
    dia_main = float(inputs['diaMain'])
    fy_web   = float(inputs['fyWeb'])
    dia_web  = float(inputs['diaWeb'])
    n_legs   = float(inputs['nLegs'])
    fy_tor   = float(inputs['fyTor'])
    dia_tor  = float(inputs['diaTor'])

    lmbda   = float(inputs.get('lambda', 1.0))
    max_agg = float(inputs.get('maxAgg', 20))

    l_mu_top = float(inputs.get('leftMuTop',  0) or 0)
    l_mu_bot = float(inputs.get('leftMuBot',  0) or 0)
    l_vu     = float(inputs.get('leftVu',     0) or 0)
    l_tu     = float(inputs.get('leftTu',     0) or 0)
    m_mu_top = float(inputs.get('midMuTop',   0) or 0)
    m_mu_bot = float(inputs.get('midMuBot',   0) or 0)
    m_vu     = float(inputs.get('midVu',      0) or 0)
    m_tu     = float(inputs.get('midTu',      0) or 0)
    r_mu_top = float(inputs.get('rightMuTop', 0) or 0)
    r_mu_bot = float(inputs.get('rightMuBot', 0) or 0)
    r_vu     = float(inputs.get('rightVu',    0) or 0)
    r_tu     = float(inputs.get('rightTu',    0) or 0)

    if beam_type == 'smrf':
        # ══════════════════════════════════════════════════════════════════════
        # SMRF 2-Pass Computation  —  ACI 318-14 §18.6
        # ══════════════════════════════════════════════════════════════════════
        wD   = float(inputs.get('wD',   0) or 0)
        wL   = float(inputs.get('wL',   0) or 0)
        vg   = float(inputs.get('vg',   0) or 0)
        bCol = float(inputs.get('bCol', 0) or 0)
        wu   = 1.2 * wD + 1.0 * wL

        if wu <= 0 and vg <= 0:
            raise ValueError(
                'SMRF mode requires Service Dead and Live loads, '
                'or an explicit Service Shear Vg.'
            )

        main_bar_area = get_rebar_area(dia_main)
        min_bars2     = 2 * main_bar_area   # §18.6.3.1: min 2 bars
        d0            = h - cover - dia_web - dia_main / 2   # nominal effective depth

        # ── Pass 1: Preliminary flexure for all sections ──────────────────────
        lt_P = calculate_flexure_layers(l_mu_top, b, h, cover, fc, fy_main, dia_main, dia_web, 'smrf', max_agg)
        lb_P = calculate_flexure_layers(l_mu_bot, b, h, cover, fc, fy_main, dia_main, dia_web, 'smrf', max_agg)
        rt_P = calculate_flexure_layers(r_mu_top, b, h, cover, fc, fy_main, dia_main, dia_web, 'smrf', max_agg)
        rb_P = calculate_flexure_layers(r_mu_bot, b, h, cover, fc, fy_main, dia_main, dia_web, 'smrf', max_agg)

        d_LT = lt_P['d'] if lt_P['As'] > 0 else d0
        d_LB = lb_P['d'] if lb_P['As'] > 0 else d0
        d_RT = rt_P['d'] if rt_P['As'] > 0 else d0
        d_RB = rb_P['d'] if rb_P['As'] > 0 else d0

        # Enforce §18.6.3.1 minimum 2 bars at every face
        As_LT = max(lt_P['As'], min_bars2)
        As_LB = max(lb_P['As'], min_bars2)
        As_RT = max(rt_P['As'], min_bars2)
        As_RB = max(rb_P['As'], min_bars2)

        # §18.6.3.2 — 50% Rule at joint faces
        if As_LB < 0.5 * As_LT: As_LB = 0.5 * As_LT
        if As_RB < 0.5 * As_RT: As_RB = 0.5 * As_RT

        # §18.6.3.2 — 25% Rule
        max_joint_As = max(As_LT, As_LB, As_RT, As_RB)
        min_any      = max(0.25 * max_joint_As, min_bars2)

        # ── Compute Mpr at each support face ─────────────────────────────────
        Mpr_LT = compute_mpr(As_LT, fy_main, fc, b, d_LT)
        Mpr_LB = compute_mpr(As_LB, fy_main, fc, b, d_LB)
        Mpr_RT = compute_mpr(As_RT, fy_main, fc, b, d_RT)
        Mpr_RB = compute_mpr(As_RB, fy_main, fc, b, d_RB)

        # ── §18.6.5.1 Probable Shear ──────────────────────────────────────────
        # Sway L→R:  Ve_left  = (Mpr_LT + Mpr_RB)/Ln + wu·Ln/2
        #            Ve_right = (Mpr_LT + Mpr_RB)/Ln − wu·Ln/2
        # Sway R→L:  Ve_left  = (Mpr_LB + Mpr_RT)/Ln − wu·Ln/2
        #            Ve_right = (Mpr_LB + Mpr_RT)/Ln + wu·Ln/2
        wu_shear = vg if vg > 0 else (wu * span_Ln / 2)   # kN
        sum_c1   = (Mpr_LT + Mpr_RB) / span_Ln             # kN
        sum_c2   = (Mpr_LB + Mpr_RT) / span_Ln

        Ve_L1 = sum_c1 + wu_shear   # sway L→R, left end
        Ve_L2 = sum_c2 - wu_shear   # sway R→L, left end
        Ve_R1 = sum_c1 - wu_shear   # sway L→R, right end
        Ve_R2 = sum_c2 + wu_shear   # sway R→L, right end

        Ve_left  = max(abs(Ve_L1), abs(Ve_L2))
        Ve_right = max(abs(Ve_R1), abs(Ve_R2))
        Ve_mid   = (Ve_left + Ve_right) / 2   # linear midpoint

        smrf_base = {
            'Mpr_LT': Mpr_LT, 'Mpr_LB': Mpr_LB,
            'Mpr_RT': Mpr_RT, 'Mpr_RB': Mpr_RB,
            'wu': wu, 'wD': wD, 'wL': wL,
            'vg': vg, 'wuShear': wu_shear,
            'minAny': min_any, 'maxJointAs': max_joint_As,
            'bCol': bCol
        }

        smrf_left  = {**smrf_base, 've_kN': Ve_left,  'Ve_case1': Ve_L1, 'Ve_case2': Ve_L2}
        smrf_mid   = {**smrf_base, 've_kN': Ve_mid,   'Ve_case1': Ve_L1, 'Ve_case2': Ve_L2}
        smrf_right = {**smrf_base, 've_kN': Ve_right, 'Ve_case1': Ve_R1, 'Ve_case2': Ve_R2}

        # ── Pass 2: Full design with SMRF data ────────────────────────────────
        left_res  = compute_section('Left Support',  beam_type, l_mu_top, l_mu_bot, l_vu, l_tu,
                                    b, h, span_Ln, cover, fc, fy_main, dia_main,
                                    fy_web, dia_web, n_legs, fy_tor, dia_tor, lmbda, max_agg, smrf_left)
        mid_res   = compute_section('Midspan',       beam_type, m_mu_top, m_mu_bot, m_vu, m_tu,
                                    b, h, span_Ln, cover, fc, fy_main, dia_main,
                                    fy_web, dia_web, n_legs, fy_tor, dia_tor, lmbda, max_agg, smrf_mid)
        right_res = compute_section('Right Support', beam_type, r_mu_top, r_mu_bot, r_vu, r_tu,
                                    b, h, span_Ln, cover, fc, fy_main, dia_main,
                                    fy_web, dia_web, n_legs, fy_tor, dia_tor, lmbda, max_agg, smrf_right)

    else:
        # ── Standard Gravity Computation ──────────────────────────────────────
        left_res  = compute_section('Left Support',  beam_type, l_mu_top, l_mu_bot, l_vu, l_tu,
                                    b, h, span_Ln, cover, fc, fy_main, dia_main,
                                    fy_web, dia_web, n_legs, fy_tor, dia_tor, lmbda, max_agg)
        mid_res   = compute_section('Midspan',       beam_type, m_mu_top, m_mu_bot, m_vu, m_tu,
                                    b, h, span_Ln, cover, fc, fy_main, dia_main,
                                    fy_web, dia_web, n_legs, fy_tor, dia_tor, lmbda, max_agg)
        right_res = compute_section('Right Support', beam_type, r_mu_top, r_mu_bot, r_vu, r_tu,
                                    b, h, span_Ln, cover, fc, fy_main, dia_main,
                                    fy_web, dia_web, n_legs, fy_tor, dia_tor, lmbda, max_agg)

    # ── Inject actual midspan As so serviceability can use it exactly ─────────
    mid_bot_layers = mid_res.get('svgData', {}).get('botLayers', [])
    mid_top_layers = mid_res.get('svgData', {}).get('topLayers', [])
    mid_bot_As = sum(mid_bot_layers) * math.pi * float(inputs['diaMain'])**2 / 4 if mid_bot_layers else 0
    mid_top_As = sum(mid_top_layers) * math.pi * float(inputs['diaMain'])**2 / 4 if mid_top_layers else 0
    # Use the larger (governing tension side at midspan is typically bottom)
    mid_res['_As'] = max(mid_bot_As, mid_top_As)

    svc_res = compute_serviceability(inputs, left_res, mid_res, right_res)

    return {"leftRes": left_res, "midRes": mid_res, "rightRes": right_res, "svcRes": svc_res}


# ──────────────────────────────────────────────────────────────────────────────
# Vercel Serverless Handler
# ──────────────────────────────────────────────────────────────────────────────

class handler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        """Pre-flight CORS."""
        self.send_response(204)
        self._send_cors_headers()
        self.end_headers()

    def do_POST(self):
        content_length = int(self.headers.get('Content-Length', 0))
        raw = self.rfile.read(content_length)
        try:
            inputs = json.loads(raw)
        except json.JSONDecodeError:
            self._respond(400, {"error": "Invalid JSON body"})
            return

        try:
            result = run_design(inputs)
        except (ValueError, KeyError, TypeError, ZeroDivisionError) as exc:
            self._respond(400, {"error": str(exc)})
            return
        except Exception as exc:
            self._respond(500, {"error": f"Computation error: {str(exc)}"})
            return

        self._respond(200, result)

    # ── helpers ────────────────────────────────────────────────────────────────
    def _send_cors_headers(self):
        self.send_header('Access-Control-Allow-Origin',  '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')

    def _respond(self, status, body):
        payload = json.dumps(body).encode()
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(payload)))
        self._send_cors_headers()
        self.end_headers()
        self.wfile.write(payload)

    def log_message(self, fmt, *args):  # suppress default access log noise
        pass

if __name__ == '__main__':
    from http.server import HTTPServer
    
    port = 8000
    server = HTTPServer(('localhost', port), handler)
    print(f"Starting standalone Python backend on http://localhost:{port}")
    print("Press Ctrl+C to stop.")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping server...")
        server.server_close()
