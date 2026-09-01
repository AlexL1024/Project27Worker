//
//  queen-lm-sap.mod.js — SAP Tower, 151 Queen Street, Auckland.
//
//  The gold/bronze reflective-glass tower on lower Queen Street: a slender
//  ~104 m slab on a faceted (chamfered) elongated plan, clad in warm graded
//  mirror glass with strong full-height gold piers, a tight mullion/spandrel
//  grid, a dark bronze podium, and a sculpted STEPPED crown where the front
//  piers rise past the roofline at staggered heights to an off-centre peak.
//  Built by following the OSM footprint's real angles. Two kit meshes only.
//
import { makeKit } from './queen-kit.mod.js';

export const ID = 'w911391687';
export const RING = '86,-233 48,-247 36,-215 45,-212 49,-210 104,-188 107,-190 113,-221 86,-231 86,-233';

const HEAD = 200;   // facade heading (faces Queen Street) — GIVEN, do not change

export function build(world) {
    const K = makeKit(world);
    const { L, D, W } = K.frame(RING, HEAD);
    const col = K.col, v = K.v, opa = K.opa, gla = K.gla, box = K.box;

    // ---- palette: warm gold / bronze mirror glass ----------------------
    const glassLo   = col('#402f14');   // deep bronze glass at the foot
    const glassMid  = col('#8a672a');   // amber glass mid-height (recessed field)
    const glassHi   = col('#e3c273');   // pale warm gold up top (sky reflect)
    const glassPod  = col('#281d10');   // very dark bronze podium glass
    const pierGold  = col('#dcac5a');   // lit gold pier face (brighter than glass)
    const pierHi    = col('#f8dd93');   // sunlit pier highlight
    const pierDk    = col('#8a6a30');   // shaded pier return
    const mull      = col('#b7924e');   // thin gold spandrel / mullion
    const mullSide  = col('#6f5a30');   // dimmer mullion on side/back faces
    const podStone  = col('#39301f');   // dark bronze-stone podium
    const podHi     = col('#4f4230');
    const crownDk   = col('#7a5c28');   // recessed mechanical crown
    const crownHi   = col('#a9823c');
    const plant     = col('#5c5548');   // rooftop plant
    const sapBlue   = col('#2aa5c9');   // SAP logo box

    // ---- heights (m above pavement) ------------------------------------
    const Y_PLINTH = 1.0;
    const Y_POD    = 11.0;    // podium / base top
    const Y_SHAFT  = 90.0;    // top of the main glazed shaft
    const nFloors  = Math.round((Y_SHAFT - Y_POD) / 3.6);   // ~22 storeys

    // ---- footprint ring in local (u,t), recomputed from the same heading
    const th = HEAD * Math.PI / 180;
    const Hx = Math.sin(th), Hz = -Math.cos(th), Ax = Math.cos(th), Az = Math.sin(th);
    let pts = RING.split(' ').map((p) => { const c = p.indexOf(','); return [+p.slice(0, c), +p.slice(c + 1)]; });
    let r = pts.slice();
    if (r[0][0] === r[r.length - 1][0] && r[0][1] === r[r.length - 1][1]) r = r.slice(0, -1);
    let cx = 0, cz = 0; for (const p of r) { cx += p[0]; cz += p[1]; } cx /= r.length; cz /= r.length;
    let umin = 1e9, tmax = -1e9;
    const raw = r.map((p) => {
        const du = (p[0] - cx) * Ax + (p[1] - cz) * Az;
        const dt = (p[0] - cx) * Hx + (p[1] - cz) * Hz;
        umin = Math.min(umin, du); tmax = Math.max(tmax, dt);
        return [du, dt];
    });
    const RL = raw.map(([du, dt]) => [du - umin, tmax - dt]);   // local (u, t)
    const NP = RL.length;
    const cen = [L / 2, D / 2];

    // build the closed list of edges; classify a "front" edge as one whose
    // outward normal points toward the street (local -t) — the Queen St faces.
    const EDGES = [];
    for (let i = 0; i < NP; i++) {
        const a = RL[i], b = RL[(i + 1) % NP];
        let du = b[0] - a[0], dt = b[1] - a[1];
        const len = Math.hypot(du, dt);
        if (len < 0.6) continue;                       // drop micro edges
        du /= len; dt /= len;
        let nu = dt, nt = -du;                          // one normal
        const mu = (a[0] + b[0]) / 2, mt = (a[1] + b[1]) / 2;
        if ((mu - cen[0]) * nu + (mt - cen[1]) * nt < 0) { nu = -nu; nt = -nt; }  // outward
        const front = nt < -0.35;                       // faces the street
        EDGES.push({ a, b, du, dt, nu, nt, len, front });
    }

    // world-space outward direction of an edge, for reflective face tinting
    const worldTint = (e) => {
        const p0 = W(e.a[0], e.a[1], 0), pn = W(e.a[0] + e.nu, e.a[1] + e.nt, 0);
        const wx = pn[0] - p0[0], wz = pn[2] - p0[2], l = Math.hypot(wx, wz) || 1;
        return 0.55 + 0.55 * Math.max(0, (wx / l) * 0.45 + (wz / l) * -0.6);
    };
    const lerp = (A, B, f) => col('#000').setRGB(A.r + (B.r - A.r) * f, A.g + (B.g - A.g) * f, A.b + (B.b - A.b) * f);
    // graded gold glass value at height y, biased by face tint
    const glow = (y, tint) => {
        const f = Math.max(0, Math.min(1, (y - Y_POD) / (Y_SHAFT - Y_POD)));
        const base = f < 0.5 ? lerp(glassLo, glassMid, f / 0.5) : lerp(glassMid, glassHi, (f - 0.5) / 0.5);
        return lerp(glassLo, base, Math.min(1, tint));
    };

    // point on an edge at fraction s, pushed out by o along the normal
    const P = (e, s, o, y) => W(e.a[0] + (e.b[0] - e.a[0]) * s + e.nu * o,
                                e.a[1] + (e.b[1] - e.a[1]) * s + e.nt * o, y);
    const quad = (bk, a, b, c, d, cB, cT) => { cT = cT || cB; v(bk, a, cB); v(bk, b, cB); v(bk, c, cT); v(bk, a, cB); v(bk, c, cT); v(bk, d, cT); };

    // crown step profile across the main front (fraction 0..1 → plateau height
    // above Y_SHAFT): a few chunky plateaus rising to an off-centre peak then
    // stepping down — the sculpted art-deco stepped top of the real tower.
    const crownH = (s) => {
        if (s < 0.14) return 4;
        if (s < 0.30) return 8;
        if (s < 0.46) return 12;
        if (s < 0.60) return 16;    // off-centre peak
        if (s < 0.74) return 12;
        if (s < 0.88) return 7;
        return 4;
    };
    // a solid proud stepped block spanning edge fractions s0..s1, Y_SHAFT..+h,
    // gold-graded, with a top cap and side risers so the steps read in 3D.
    function crownStep(e, s0, s1, h) {
        const y0 = Y_SHAFT, y1 = Y_SHAFT + h, dp = 1.6;
        const cB = pierGold, cT = pierHi;
        quad(opa, P(e, s0, 0.02, y0), P(e, s1, 0.02, y0), P(e, s1, 0.02, y1), P(e, s0, 0.02, y1), cB, cT); // front
        quad(opa, P(e, s0, 0.02, y1), P(e, s1, 0.02, y1), P(e, s1, dp, y1), P(e, s0, dp, y1), cT);         // top cap
        quad(opa, P(e, s0, 0.02, y0), P(e, s0, dp, y0), P(e, s0, dp, y1), P(e, s0, 0.02, y1), pierDk);      // left riser
        quad(opa, P(e, s1, dp, y0), P(e, s1, 0.02, y0), P(e, s1, 0.02, y1), P(e, s1, dp, y1), pierDk);      // right riser
    }

    // ============================ SHELL ================================
    for (const e of EDGES) {
        const tint = worldTint(e);
        const mProud = 0.04, pierProj = e.front ? 1.15 : 0.4;
        const nb = Math.max(2, Math.round(e.len / (e.front ? 6.2 : 8.0)));  // bays
        const pierW = e.front ? 1.15 : 0.5;

        // -- podium glass (dark) + solid podium body behind --
        quad(gla, P(e, 0.02, 0.02, Y_PLINTH), P(e, 0.98, 0.02, Y_PLINTH),
                  P(e, 0.98, 0.02, Y_POD), P(e, 0.02, 0.02, Y_POD),
                  glassPod, lerp(glassPod, glassMid, 0.35));

        // -- shaft: graded glass bands + a fine spandrel line per storey --
        const fh = (Y_SHAFT - Y_POD) / nFloors;
        for (let f = 0; f < nFloors; f++) {
            const y0 = Y_POD + f * fh, y1 = y0 + fh;
            quad(gla, P(e, 0.02, 0.02, y0 + 0.12), P(e, 0.98, 0.02, y0 + 0.12),
                      P(e, 0.98, 0.02, y1), P(e, 0.02, 0.02, y1),
                      glow(y0, tint), glow(y1, tint));
            // spandrel line (thin proud bar) — subtle, verticals dominate
            quad(opa, P(e, 0.03, mProud, y0), P(e, 0.97, mProud, y0),
                      P(e, 0.97, mProud, y0 + 0.16), P(e, 0.03, mProud, y0 + 0.16),
                      e.front ? mull : mullSide);
        }

        // -- vertical piers at each bay boundary (proud gold ribs) --
        // every 2nd boundary on the front is a MAJOR pier (wider, deeper) so the
        // face reads as grouped bays split by deep vertical channels.
        for (let i = 0; i <= nb; i++) {
            const s = i / nb;
            const major = e.front && (i % 2 === 0);
            emitPier(e, s, major ? pierW * 1.5 : pierW, major ? pierProj * 1.6 : pierProj,
                     Y_POD, Y_SHAFT, e.front, tint);
        }

        // -- stepped gold crown across the front (chunky plateaus) --
        if (e.front) {
            const bp = [0, 0.14, 0.30, 0.46, 0.60, 0.74, 0.88, 1.0];
            for (let i = 0; i < bp.length - 1; i++) {
                crownStep(e, bp[i], bp[i + 1], crownH((bp[i] + bp[i + 1]) / 2));
            }
            // thin vertical ribs continuing the piers up the step fronts,
            // clamped to their plateau so they never spike above it
            for (let i = 0; i <= nb; i++) {
                const s = i / nb, eps = 0.006;
                const h = Math.min(crownH(Math.max(0, s - eps)), crownH(Math.min(1, s + eps))) - 0.6;
                if (h > 0.5) emitPier(e, s, pierW * 0.6, pierProj * 0.45, Y_SHAFT, Y_SHAFT + h, true, tint);
            }
        }
    }

    // an oriented proud vertical pier straddling edge fraction s
    function emitPier(e, s, w, proj, y0, y1, bold, tint, capped) {
        const cu = e.a[0] + (e.b[0] - e.a[0]) * s, ct = e.a[1] + (e.b[1] - e.a[1]) * s;
        const tu = e.du, tt = e.dt;               // tangent along the edge
        const hw = (w / e.len) / 2 * e.len;       // half width in metres
        const nu = e.nu, nt = e.nt;
        const oL = [cu + tu * hw + nu * proj, ct + tt * hw + nt * proj];
        const oR = [cu - tu * hw + nu * proj, ct - tt * hw + nt * proj];
        const iL = [cu + tu * hw + nu * 0.05, ct + tt * hw + nt * 0.05];
        const iR = [cu - tu * hw + nu * 0.05, ct - tt * hw + nt * 0.05];
        const cFace = bold ? lerp(pierGold, pierHi, Math.min(1, tint * 0.95)) : mullSide;
        const cSide = bold ? pierDk : mullSide;
        const Q = (p, q, cc) => quad(opa, W(p[0], p[1], y0), W(q[0], q[1], y0),
                                          W(q[0], q[1], y1), W(p[0], p[1], y1), cc);
        Q(oL, oR, cFace);         // outer proud face
        Q(oL, iL, cSide);         // return
        Q(iR, oR, cSide);         // return
        if (capped) {
            v(opa, W(oL[0], oL[1], y1), pierHi); v(opa, W(oR[0], oR[1], y1), pierHi); v(opa, W(iR[0], iR[1], y1), pierHi);
            v(opa, W(oL[0], oL[1], y1), pierHi); v(opa, W(iR[0], iR[1], y1), pierHi); v(opa, W(iL[0], iL[1], y1), pierHi);
        }
    }

    // ============================ PODIUM ===============================
    // solid dark bronze podium body filling the whole footprint base
    box(W, 0.4, L - 0.4, 0.4, D - 0.4, 0, Y_POD, podStone,
        { front: 1, back: 1, left: 1, right: 1, top: 1 });
    box(W, 0.2, L - 0.2, 0.2, D - 0.2, Y_POD - 0.6, Y_POD, podHi,
        { front: 1, back: 1, left: 1, right: 1, top: 1 });   // capping band
    // stepped plaza terraces at the low front corner (aerial)
    for (let s = 0; s < 3; s++) {
        const off = (s + 1) * 1.7;
        box(W, 1.5, 13.5, -off, -off + 1.7, 0, (3 - s) * 1.4, podHi,
            { front: 1, back: 1, left: 1, right: 1, top: 1 });
    }

    // solid shaft core so the tower reads massed from behind the glass
    box(W, 1.5, L - 1.5, 1.5, D - 1.5, Y_POD, Y_SHAFT, crownDk,
        { back: 1, left: 1, right: 1, top: 1 });

    // ============================ CROWN ================================
    // recessed mechanical roof block (set well back, below the crowning fins)
    const Y_ROOF = Y_SHAFT + 4.0;
    box(W, 3.0, L - 3.0, 4.0, D - 3.0, Y_SHAFT - 0.5, Y_ROOF, crownHi,
        { back: 1, left: 1, right: 1, top: 1 });
    // rooftop plant boxes
    K.acbox(W, 9, 21, 8, D - 6, Y_ROOF, Y_ROOF + 3.0, plant);
    K.acbox(W, L - 26, L - 12, 8, D - 6, Y_ROOF, Y_ROOF + 2.2, plant);

    // ---- SAP logo box near the top-left of the front facade -----------
    const fe = EDGES.find((e) => e.front && e.len > 30) || EDGES.find((e) => e.front);
    if (fe) {
        const a = P(fe, 0.04, 1.5, Y_SHAFT + 9.5), b = P(fe, 0.15, 1.5, Y_SHAFT + 9.5);
        const c = P(fe, 0.15, 1.5, Y_SHAFT + 14.5), d = P(fe, 0.04, 1.5, Y_SHAFT + 14.5);
        quad(opa, a, b, c, d, sapBlue);
    }

    const tris = K.finish('sap', { glassRough: 0.05, glassMetal: 0.6, roughness: 0.55, metalness: 0.3 });
    return tris;
}
