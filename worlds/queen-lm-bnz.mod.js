//
//  queen-lm-bnz.mod.js — BNZ Tower / BNZ Centre, 125 Queen Street, Auckland.
//
//  A slender ~106 m dark modernist office tower: near-black reflective glass
//  curtain wall, chamfered corners (octagonal cross-section), fine vertical
//  mullions + horizontal spandrel banding, green anodised corner mullions, a
//  plain podium, and a faceted dark-glass crown with a rooftop deck + mast.
//
import { makeKit } from './queen-kit.mod.js';

export const ID = 'w157332769';
export const RING = '93,-291 100,-295 115,-289 120,-278 116,-267 104,-262 93,-266 88,-277 93,-291';

export function build(world) {
    const K = makeKit(world);
    const { L, D, W } = K.frame(RING, 255);
    const col = K.col, v = K.v, opa = K.opa, gla = K.gla;

    // ---- palette --------------------------------------------------------
    // Reflective dark curtain wall: the harness draws glass UNSHADED (vertex
    // colour straight to pixel), so "reflective" lives entirely in these
    // baked tones — a dark charcoal base rising to a pale, cold overcast-sky
    // reflection up high, with brighter cloud bands streaked across.
    const glassLo   = col('#1b232b');   // charcoal base (reflects dark neighbours/ground)
    const glassMid  = col('#3c4c5a');   // mid grey-blue reflection
    const glassHi   = col('#8494a1');   // pale overcast sky reflected up high
    const cloudC    = col('#a6b1ba');   // bright reflected cloud streak
    const glassPod  = col('#171d23');   // podium storefront (very dark)
    const lobbyLo   = col('#2a333b');   // lit lobby glazing (base)
    const lobbyHi   = col('#586773');   // lit lobby glazing (head)
    const crownLo   = col('#12171c');
    const crownHi   = col('#3a4d5d');
    const mull      = col('#aeb6bc');   // bright aluminium mullion (verticals dominate)
    const mullDk    = col('#59636a');
    const spandrel  = col('#3b444b');
    const green     = col('#4f8f68');   // anodised green corner mullion
    const greenHi   = col('#79bd8f');   // lit green highlight
    const podStone  = col('#2b3033');   // dark granite podium
    const podStoneHi= col('#434a4e');
    const lead      = col('#454d52');   // parapet / plant / mast
    const gold      = col('#c79a4e');   // warm lit accent on the crown

    // ---- massing heights ------------------------------------------------
    const Y_PLINTH = 0.9;
    const Y_POD    = 6.5;      // podium / street wall top
    const Y_SHAFT  = 97.0;     // curtain wall top
    const Y_CR     = 105.5;    // crown / roof deck level
    const Y_PARA   = 107.5;    // parapet rail top
    const nFloors  = Math.round((Y_SHAFT - Y_POD) / 3.55);   // ~25 storeys of glass

    // ---- chamfered (octagonal) cross-section in local (u,t) -------------
    const c = Math.min(L, D) * 0.16;
    const oct = [
        [c, 0], [L - c, 0],          // front (main)
        [L, c], [L, D - c],          // right (main)
        [L - c, D], [c, D],          // back  (main)
        [0, D - c], [0, c],          // left  (main)
    ];
    // edges: index i from oct[i] -> oct[(i+1)%8]; even edges are the 4 main faces
    const EDGES = [];
    for (let i = 0; i < 8; i++) EDGES.push([oct[i], oct[(i + 1) % 8], i % 2 === 0]);

    // outward normal in (u,t) for an edge, plus world outward for face tinting
    const cen = [L / 2, D / 2];
    function edgeGeom(e) {
        const [a, b] = e;
        let du = b[0] - a[0], dt = b[1] - a[1];
        const len = Math.hypot(du, dt); du /= len; dt /= len;
        const nu = dt, nt = -du;                       // outward normal (u,t)
        // world outward (for reflective tinting) via the affine map W
        const p0 = W(a[0], a[1], 0), pn = W(a[0] + nu, a[1] + nt, 0);
        const wx = pn[0] - p0[0], wz = pn[2] - p0[2];
        const wl = Math.hypot(wx, wz) || 1;
        return { du, dt, nu, nt, len, wx: wx / wl, wz: wz / wl };
    }
    // reflection bias: faces turned toward the light read paler / brighter
    const refx = 0.5, refz = -0.62;
    const faceTint = (g) => 0.55 + 0.55 * Math.max(0, g.wx * refx + g.wz * refz);

    // point on a face at fraction s along its base edge, pushed out by `o`
    const facePt = (e, g, s, o, y) => {
        const u = e[0][0] + (e[1][0] - e[0][0]) * s + g.nu * o;
        const t = e[0][1] + (e[1][1] - e[0][1]) * s + g.nt * o;
        return W(u, t, y);
    };
    // a vertically graded glass quad on a face (bottom colour -> top colour)
    const gradGlass = (bk, e, g, s0, s1, y0, y1, o, cB, cT) => {
        const a = facePt(e, g, s0, o, y0), b = facePt(e, g, s1, o, y0);
        const cc = facePt(e, g, s1, o, y1), d = facePt(e, g, s0, o, y1);
        v(bk, a, cB); v(bk, b, cB); v(bk, cc, cT); v(bk, a, cB); v(bk, cc, cT); v(bk, d, cT);
    };
    // a thin proud bar (single outward quad) — mullion / spandrel / trim
    const bar = (e, g, s0, s1, y0, y1, o, cc) => {
        const a = facePt(e, g, s0, o, y0), b = facePt(e, g, s1, o, y0);
        const cq = facePt(e, g, s1, o, y1), d = facePt(e, g, s0, o, y1);
        v(opa, a, cc); v(opa, b, cc); v(opa, cq, cc); v(opa, a, cc); v(opa, cq, cc); v(opa, d, cc);
    };

    const lerp = (A, B, f) => col('#000').setRGB(A.r + (B.r - A.r) * f, A.g + (B.g - A.g) * f, A.b + (B.b - A.b) * f);

    // ---- build each face's curtain wall ---------------------------------
    for (const e of EDGES) {
        const [a, b, isMain] = e;
        const g = edgeGeom(e);
        // narrow chamfer facets read as brighter reflective strips in the photo
        const tint = Math.min(1.15, faceTint(g) * (isMain ? 1.0 : 1.18));
        const wMul = 0.35, wSp = 0.22;   // mullion / spandrel widths in metres
        const mProud = 0.28, gProud = 0.02;

        // -- glazed lobby podium (a bank HQ lobby, not shops) --
        // Main faces read as a lit, taller lobby glazing; chamfer facets stay
        // dark granite pier. Granite surround frames the whole base.
        if (isMain) {
            gradGlass(gla, e, g, 0.06, 0.94, Y_PLINTH, Y_POD - 0.6, gProud, lobbyLo, lobbyHi);
            // tall lobby mullions (fewer, thicker than the shaft grid)
            const nl = Math.max(2, Math.round(g.len / 3.2));
            for (let m = 0; m <= nl; m++) {
                const s = m / nl, half = (0.5 / g.len) / 2;
                bar(e, g, s - half, s + half, Y_PLINTH, Y_POD - 0.6, mProud + 0.06, mullDk);
            }
            // transom over the lobby glass
            bar(e, g, 0.04, 0.96, Y_POD - 0.75, Y_POD - 0.6, mProud + 0.06, mullDk);
        } else {
            gradGlass(gla, e, g, 0.02, 0.98, Y_PLINTH, Y_POD, gProud, glassPod, lerp(glassPod, glassMid, 0.3));
        }
        // dark granite plinth band at the very base + podium cap band
        bar(e, g, -0.01, 1.01, 0, Y_PLINTH, mProud + 0.16, podStone);
        bar(e, g, -0.01, 1.01, Y_POD - 0.55, Y_POD, mProud + 0.10, podStoneHi);   // podium cap / spandrel

        // -- shaft: graded reflective glass, one band per storey ----------
        // A cold sky ramp (dark base -> pale head) with two brighter cloud
        // reflection streaks; chamfer facets read paler (tint>1).
        const fh = (Y_SHAFT - Y_POD) / nFloors;
        const sky = (h) => {                       // 0..1 up the shaft
            let c = (h < 0.5) ? lerp(glassLo, glassMid, h / 0.5)
                              : lerp(glassMid, glassHi, (h - 0.5) / 0.5);
            // reflected cloud streaks around 0.42 and 0.72
            const g1 = (h - 0.42) * 12, g2 = (h - 0.72) * 14;
            const cl = Math.max(Math.exp(-(g1 * g1)), 0.8 * Math.exp(-(g2 * g2)));
            if (cl > 0.02) c = lerp(c, cloudC, cl * 0.7);
            return c;
        };
        for (let f = 0; f < nFloors; f++) {
            const y0 = Y_POD + f * fh, y1 = y0 + fh;
            const hf0 = (y0 - Y_POD) / (Y_SHAFT - Y_POD);
            const hf1 = (y1 - Y_POD) / (Y_SHAFT - Y_POD);
            let cB = sky(hf0), cT = sky(hf1);
            cB = lerp(glassLo, cB, Math.min(1.25, tint));   // reflective face tint
            cT = lerp(glassLo, cT, Math.min(1.25, tint));
            gradGlass(gla, e, g, 0.02, 0.98, y0 + 0.10, y1, gProud, cB, cT);
            // very slim, dark horizontal spandrel line at each floor — kept
            // subordinate so the vertical mullions dominate (as in the photo)
            bar(e, g, 0.04, 0.96, y0, y0 + wSp * 0.35, mProud - 0.14, lerp(glassLo, spandrel, 0.5));
        }

        // -- tight vertical mullion grid (the verticals read strongest) ---
        const nm = Math.max(3, Math.round(g.len / 1.7));
        for (let m = 0; m <= nm; m++) {
            const s = m / nm;
            const half = (wMul / g.len) / 2;
            const cc = lerp(mull, col('#eef1f3'), Math.max(0, tint - 0.7));  // bright, brighter on lit facets
            bar(e, g, s - half, s + half, Y_POD, Y_SHAFT, mProud + 0.04, cc);
        }
    }

    // ---- prominent green anodised corner mullions (full height) ---------
    for (let i = 0; i < 8; i++) {
        const p = oct[i];
        // build a slim vertical bar straddling the corner, facing outward
        const outu = (p[0] - cen[0]), outt = (p[1] - cen[1]);
        const ol = Math.hypot(outu, outt) || 1;
        const nu = outu / ol, nt = outt / ol;
        const w = 0.42, o = 0.40;
        const e = [[p[0] - nt * w, p[1] + nu * w], [p[0] + nt * w, p[1] - nu * w]];
        const g = { du: -nt, dt: nu, nu, nt };
        const tint = faceTint({ wx: nu ? nu : 0, wz: nt ? nt : 0 });
        const cB = lerp(green, greenHi, 0.25 + tint * 0.2), cT = lerp(green, greenHi, 0.5 + tint * 0.3);
        // shaft — bright anodised green pier catching the light
        gradGlass(opa, e, g, 0, 1, Y_POD, Y_SHAFT, o, cB, cT);
        // podium portion (thinner, darker)
        bar(e, g, 0, 1, Y_PLINTH, Y_POD, o, lerp(green, mullDk, 0.4));
    }

    // ---- pale mechanical / crown-base band across the top of the shaft --
    for (const e of EDGES) {
        const g = edgeGeom(e);
        const tint = faceTint(g);
        bar(e, g, -0.01, 1.01, Y_SHAFT - 1.4, Y_SHAFT - 0.2, 0.3, lerp(mullDk, col('#9aa4ab'), 0.4 + tint * 0.4));
        bar(e, g, -0.01, 1.01, Y_SHAFT - 0.2, Y_SHAFT, 0.34, podStoneHi);   // shadow reveal
    }

    // ---- faceted crown: sloped dark-glass facets stepping inward --------
    const insetK = 0.16;                    // ~ pulls the roof edge ~in a few m
    const inset = (p) => [p[0] + (cen[0] - p[0]) * insetK, p[1] + (cen[1] - p[1]) * insetK];
    for (const e of EDGES) {
        const [a, b, isMain] = e;
        const g = edgeGeom(e);
        const tint = faceTint(g);
        const ia = inset(a), ib = inset(b);
        // sloped facet quad: base edge at Y_SHAFT -> inset edge at Y_CR
        const pa = W(a[0] + g.nu * 0.02, a[1] + g.nt * 0.02, Y_SHAFT);
        const pb = W(b[0] + g.nu * 0.02, b[1] + g.nt * 0.02, Y_SHAFT);
        const pc = W(ib[0], ib[1], Y_CR);
        const pd = W(ia[0], ia[1], Y_CR);
        const cB = lerp(crownLo, crownHi, 0.15);
        const cT = lerp(crownLo, lerp(crownHi, glassHi, 0.5), 0.45 + tint * 0.55);
        v(gla, pa, cB); v(gla, pb, cB); v(gla, pc, cT); v(gla, pa, cB); v(gla, pc, cT); v(gla, pd, cT);
        // spandrel banding on the crown facet (2 lines)
        for (let k = 1; k <= 2; k++) {
            const fr = k / 3;
            const y = Y_SHAFT + (Y_CR - Y_SHAFT) * fr;
            const A = [a[0] + (ia[0] - a[0]) * fr, a[1] + (ia[1] - a[1]) * fr];
            const B = [b[0] + (ib[0] - b[0]) * fr, b[1] + (ib[1] - b[1]) * fr];
            const q0 = W(A[0], A[1], y), q1 = W(B[0], B[1], y);
            const q2 = W(B[0], B[1], y + 0.18), q3 = W(A[0], A[1], y + 0.18);
            v(opa, q0, mullDk); v(opa, q1, mullDk); v(opa, q2, mullDk);
            v(opa, q0, mullDk); v(opa, q2, mullDk); v(opa, q3, mullDk);
        }
    }
    // warm lit accent band on the front crown facet (matches photo glow)
    {
        const e = EDGES[0], g = edgeGeom(e);
        const ia = inset(e[0]), ib = inset(e[1]);
        const y = Y_SHAFT + (Y_CR - Y_SHAFT) * 0.55;
        const A = [e[0][0] + (ia[0] - e[0][0]) * 0.55, e[0][1] + (ia[1] - e[0][1]) * 0.55];
        const B = [e[1][0] + (ib[0] - e[1][0]) * 0.55, e[1][1] + (ib[1] - e[1][1]) * 0.55];
        const q0 = W(A[0] + (B[0] - A[0]) * 0.55, A[1] + (B[1] - A[1]) * 0.55, y);
        const q1 = W(A[0] + (B[0] - A[0]) * 0.78, A[1] + (B[1] - A[1]) * 0.78, y);
        const q2 = W(A[0] + (B[0] - A[0]) * 0.78, A[1] + (B[1] - A[1]) * 0.78, y + 1.1);
        const q3 = W(A[0] + (B[0] - A[0]) * 0.55, A[1] + (B[1] - A[1]) * 0.55, y + 1.1);
        v(opa, q0, gold); v(opa, q1, gold); v(opa, q2, gold);
        v(opa, q0, gold); v(opa, q2, gold); v(opa, q3, gold);
    }

    // ---- flat roof deck + parapet rail + rooftop plant + mast -----------
    const inOct = oct.map(inset);
    // roof deck (fan from centroid)
    for (let i = 0; i < 8; i++) {
        const p = inOct[i], q = inOct[(i + 1) % 8];
        v(opa, W(cen[0], cen[1], Y_CR), lead);
        v(opa, W(p[0], p[1], Y_CR), lead);
        v(opa, W(q[0], q[1], Y_CR), lead);
    }
    // parapet rail around the inset perimeter + a bright aluminium coping
    for (let i = 0; i < 8; i++) {
        const p = inOct[i], q = inOct[(i + 1) % 8];
        const a0 = W(p[0], p[1], Y_CR), b0 = W(q[0], q[1], Y_CR);
        const a1 = W(p[0], p[1], Y_PARA), b1 = W(q[0], q[1], Y_PARA);
        v(opa, a0, lead); v(opa, b0, lead); v(opa, b1, lead);
        v(opa, a0, lead); v(opa, b1, lead); v(opa, a1, lead);
        // bright coping cap on the rail
        const cop = col('#c2cace');
        const a2 = W(p[0], p[1] + 0.0, Y_PARA + 0.25), b2 = W(q[0], q[1] + 0.0, Y_PARA + 0.25);
        v(opa, a1, cop); v(opa, b1, cop); v(opa, b2, cop);
        v(opa, a1, cop); v(opa, b2, cop); v(opa, a2, cop);
    }
    // rooftop mechanical plant cluster (several boxes at varied heights)
    const plantC = col('#585f64'), plantHi = col('#6d747a');
    K.acbox(W, cen[0] - 4.6, cen[0] + 1.2, cen[1] - 3.8, cen[1] + 2.4, Y_CR, Y_CR + 3.4, plantC);
    K.acbox(W, cen[0] + 0.6, cen[0] + 4.4, cen[1] - 1.2, cen[1] + 4.0, Y_CR, Y_CR + 2.2, plantHi);
    K.acbox(W, cen[0] - 3.2, cen[0] - 0.4, cen[1] + 1.0, cen[1] + 4.2, Y_CR, Y_CR + 1.6, plantC);
    K.acbox(W, cen[0] + 1.6, cen[0] + 3.0, cen[1] - 4.4, cen[1] - 2.2, Y_CR, Y_CR + 1.1, lead);
    // low equipment rail / screen around part of the deck
    K.box(W, cen[0] - 5.0, cen[0] + 5.0, cen[1] - 4.6, cen[1] - 4.2, Y_CR, Y_CR + 1.0, mullDk,
          { front: 1, back: 1, top: 1 });
    // two slim antenna masts of different heights
    K.box(W, cen[0] - 0.16, cen[0] + 0.16, cen[1] + 2.0, cen[1] + 2.3, Y_CR + 3.4, Y_CR + 9.0, mullDk,
          { front: 1, back: 1, left: 1, right: 1, top: 1 });
    K.box(W, cen[0] + 2.4, cen[0] + 2.7, cen[1] + 1.4, cen[1] + 1.7, Y_CR + 2.2, Y_CR + 6.2, mull,
          { front: 1, back: 1, left: 1, right: 1, top: 1 });

    K.finish('bnz', { glassRough: 0.06, glassMetal: 0.5, roughness: 0.6, metalness: 0.2 });
}
