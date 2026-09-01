//
//  queen-street-detail.mod.js — richly furnished Queen Street shared-street,
//  Auckland CBD.  Draped onto the terrain along the 42 centreline polylines:
//  a continuous dark BLUESTONE carriageway with yellow centre lines, white
//  edge lines and lane arrows; broad pale PAVER footpaths with a darker kerb
//  lip; yellow+white TIGER crossings at the detected intersections; and the
//  signature Queen St furniture — big cylindrical flax PLANTERS, alternating
//  PALM and bare deciduous street TREES, tall cantilever SIGNAL / lamp poles,
//  blue BANNER flags, wooden-slat BENCHES and rubbish BINS along the kerb.
//  Everything is pushed into the shared kit buckets and merged into one part.
//

import { makeKit } from './queen-kit.mod.js';

// --- Queen Street centrelines (world metres): "type|lanes|x,z x,z ..." -------
const RAW = `pedestrian|2|198,-495 231,-588 257,-621
tertiary|3|-123,565 -113,535
tertiary|2|76,-24 105,-147
tertiary|2|0,210 46,76
tertiary|4|-37,313 -14,248
tertiary|4|-8,232 0,210
secondary|3|-249,922 -254,926
secondary|2|-254,926 -253,912 -217,814
secondary|2|-165,695 -210,818
secondary|6|-143,623 -137,607
secondary|2|-150,643 -152,659 -165,695
secondary|2|-174,693 -160,657 -150,643
secondary|2|-196,756 -177,703
secondary|3|-216,836 -249,922
secondary|5|-276,988 -264,953
secondary|2|-210,818 -216,836
secondary|2|-177,703 -174,693
secondary|2|-217,814 -196,756
secondary|5|-150,643 -143,623
secondary|6|-137,607 -123,565
secondary|6|-264,953 -254,926
tertiary|3|-71,413 -50,354
tertiary|4|-14,248 -8,232
tertiary|3|-101,502 -84,453
tertiary|2|191,-479 181,-466 167,-406
tertiary|2|58,41 69,5
tertiary|2|155,-357 140,-291
tertiary|2|157,-365 155,-357
tertiary|2|124,-223 132,-260
tertiary|4|-50,354 -37,313
tertiary|3|-84,453 -82,446
tertiary|3|-82,446 -71,413
tertiary|2|46,76 58,41
tertiary|2|70,0 76,-24
tertiary|2|113,-178 120,-207
tertiary|2|120,-207 124,-223
tertiary|2|105,-147 113,-178
tertiary|2|132,-260 140,-291
tertiary|2|167,-406 157,-365
pedestrian|2|191,-479 198,-495
tertiary|3|-113,535 -101,502
tertiary|2|69,5 70,0`;

export const build = (world) => {
    const K = makeKit(world);
    const groundAt = world.groundAt || (() => 0);
    const col = K.col;

    // ---- palette --------------------------------------------------------
    const C_STONE  = col('#3a3d42');   // dark bluestone carriageway
    const C_STONE2 = col('#343840');   // slightly bluer paver joints tint
    const C_YELLOW = col('#d8b53a');   // yellow centre lines
    const C_WHITE  = col('#e6e6dd');   // white paint
    const C_FOOT   = col('#b9b4ab');   // pale paver footpath
    const C_FOOT2  = col('#aca79d');   // alternate paver tone
    const C_KERB   = col('#88857e');   // darker kerb lip
    const C_TIGERY = col('#e0b23a');   // tiger-crossing yellow bar
    const C_CHAR   = col('#35373b');   // planter / pole charcoal
    const C_CHAR2  = col('#2a2c2f');   // darker fittings
    const C_FLAX   = [col('#4f8a3e'), col('#6ba84e'), col('#3d6b34'), col('#5c9a44')];
    const C_PTRUNK = col('#8a7a5e');   // palm trunk
    const C_FROND  = col('#4e8f42');   // palm fronds
    const C_TTRUNK = col('#6b5a45');   // deciduous trunk
    const C_BRANCH = col('#8b8278');   // bare grey-brown branch mass
    const C_POLE   = col('#4a4d52');   // signal / lamp pole metal
    const C_BANNER = col('#2f5aa8');   // blue banner panel
    const C_WOOD   = col('#9c7d4f');   // bench slats
    const C_BIN    = col('#494c51');   // bin body

    // ---- lateral offsets from centreline (metres) -----------------------
    const HALF = 6.5;                 // carriageway half-width (13 m total)
    const EDGE_IN = 6.05, EDGE_OUT = 6.25;   // white edge line
    const KERB_IN = 6.5, KERB_OUT = 6.9;     // darker kerb lip
    const FOOT_IN = 6.5, FOOT_OUT = 10.6;    // ~4.1 m paver footpath
    const OFF_POLE = 6.75, OFF_PLANT = 7.05, OFF_BIN = 7.4,
          OFF_TREE = 8.4, OFF_BENCH = 8.7;

    // ---- y epsilons above the ground ribbon (painter sort: bigger=on top)
    const E_STONE = 0.03, E_EDGE = 0.07, E_YEL = 0.08, E_CROSS = 0.09,
          E_ARROW = 0.09, E_FOOT = 0.15, E_KERB = 0.17;

    const STEP = 12;                  // along-street terrain sampling (m)
    const wp = (x, z, eps) => [x, groundAt(x, z) + eps, z];   // draped point

    // --- parse polylines --------------------------------------------------
    const polys = RAW.split('\n').map((ln) => {
        const f = ln.split('|');
        const pts = f[2].trim().split(' ').map((p) => {
            const c = p.indexOf(','); return [+p.slice(0, c), +p.slice(c + 1)];
        });
        const len = polyLen(pts);
        // MAIN Queen St corridor (dense planting) vs short side-street stub
        const main = (f[0] === 'secondary') || (f[0] === 'tertiary' && len >= 30);
        return { pts, len, type: f[0], main };
    });
    function polyLen(pts) {
        let L = 0;
        for (let s = 0; s < pts.length - 1; s++)
            L += Math.hypot(pts[s + 1][0] - pts[s][0], pts[s + 1][1] - pts[s][1]);
        return L;
    }

    // =====================================================================
    //  SURFACE — bands draped laterally along a polyline (offsets oA..oB)
    // =====================================================================
    function band(pts, oA, oB, eps, color) {
        for (let s = 0; s < pts.length - 1; s++) {
            const p1 = pts[s], p2 = pts[s + 1];
            const dx = p2[0] - p1[0], dz = p2[1] - p1[1], len = Math.hypot(dx, dz);
            if (len < 1e-3) continue;
            const nx = -dz / len, nz = dx / len;
            const n = Math.max(1, Math.ceil(len / STEP));
            for (let i = 0; i < n; i++) {
                const f0 = i / n, f1 = (i + 1) / n;
                const x0 = p1[0] + dx * f0, z0 = p1[1] + dz * f0;
                const x1 = p1[0] + dx * f1, z1 = p1[1] + dz * f1;
                K.quad(K.opa,
                    wp(x0 + nx * oA, z0 + nz * oA, eps),
                    wp(x0 + nx * oB, z0 + nz * oB, eps),
                    wp(x1 + nx * oB, z1 + nz * oB, eps),
                    wp(x1 + nx * oA, z1 + nz * oA, eps), color);
            }
        }
    }
    // dashed line running along a polyline at lateral offset `off`
    function dashed(pts, off, halfw, eps, color, dash, gap) {
        const period = dash + gap;
        for (let s = 0; s < pts.length - 1; s++) {
            const p1 = pts[s], p2 = pts[s + 1];
            const dx = p2[0] - p1[0], dz = p2[1] - p1[1], len = Math.hypot(dx, dz);
            if (len < 1e-3) continue;
            const ux = dx / len, uz = dz / len, nx = -uz, nz = ux;
            for (let d = 0; d < len; d += period) {
                const d1 = Math.min(d + dash, len);
                const ax = p1[0] + ux * d + nx * off, az = p1[1] + uz * d + nz * off;
                const bx = p1[0] + ux * d1 + nx * off, bz = p1[1] + uz * d1 + nz * off;
                K.quad(K.opa,
                    wp(ax + nx * -halfw, az + nz * -halfw, eps),
                    wp(ax + nx * halfw, az + nz * halfw, eps),
                    wp(bx + nx * halfw, bz + nz * halfw, eps),
                    wp(bx + nx * -halfw, bz + nz * -halfw, eps), color);
            }
        }
    }
    // white lane arrow (shaft + head) pointing along the road at (x,z)
    function arrow(x, z, ux, uz) {
        const nx = -uz, nz = ux, y = E_ARROW;
        const P = (a, l) => wp(x + ux * a + nx * l, z + uz * a + nz * l, y);
        // shaft
        K.quad(K.opa, P(-1.6, -0.18), P(-1.6, 0.18), P(0.4, 0.18), P(0.4, -0.18), C_WHITE);
        // head (triangle)
        K.v(K.opa, P(1.6, 0), C_WHITE); K.v(K.opa, P(0.4, 0.6), C_WHITE); K.v(K.opa, P(0.4, -0.6), C_WHITE);
    }

    // =====================================================================
    //  FURNITURE PRIMITIVES — pushed into K.opa in world space
    // =====================================================================
    function cyl(cx, cz, y0, y1, r, c, seg, cap, r1) {
        seg = seg || 8; r1 = (r1 === undefined) ? r : r1;
        let prev = null;
        for (let s = 0; s <= seg; s++) {
            const a = s / seg * Math.PI * 2;
            const ca = Math.cos(a), sa = Math.sin(a);
            const pt = { x0: cx + r * ca, z0: cz + r * sa, x1: cx + r1 * ca, z1: cz + r1 * sa };
            if (prev) {
                K.quad(K.opa, [prev.x0, y0, prev.z0], [pt.x0, y0, pt.z0],
                    [pt.x1, y1, pt.z1], [prev.x1, y1, prev.z1], c);
                if (cap) { K.v(K.opa, [cx, y1, cz], c); K.v(K.opa, [prev.x1, y1, prev.z1], c); K.v(K.opa, [pt.x1, y1, pt.z1], c); }
            }
            prev = pt;
        }
    }
    function cone(cx, cz, y0, y1, r, c, seg) {
        seg = seg || 8; let prev = null;
        for (let s = 0; s <= seg; s++) {
            const a = s / seg * Math.PI * 2;
            const x = cx + r * Math.cos(a), z = cz + r * Math.sin(a);
            if (prev) { K.v(K.opa, [prev.x, y0, prev.z], c); K.v(K.opa, [x, y0, z], c); K.v(K.opa, [cx, y1, cz], c); }
            prev = { x, z };
        }
    }
    // oriented box: centre (cx,cz), along-axis (ux,uz), half-sizes hw(along)/hd(perp)
    function obox(cx, cz, ux, uz, u0, u1, t0, t1, y0, y1, c, faces) {
        const W = (u, t, y) => [cx + ux * u - uz * t, y, cz + uz * u + ux * t];
        K.box(W, u0, u1, t0, t1, y0, y1, c, faces || { front: 1, back: 1, left: 1, right: 1, top: 1, bottom: 1 });
    }
    // thin tapered strut (branch/twig) between two 3-D points, width r at base
    function strut(ax, ay, az, bx, by, bz, r, c) {
        const dx = bx - ax, dz = bz - az, hl = Math.hypot(dx, dz) || 1;
        const px = -dz / hl * r, pz = dx / hl * r;   // horizontal perpendicular
        K.quad(K.opa, [ax - px, ay, az - pz], [ax + px, ay, az + pz],
            [bx, by, bz], [bx, by, bz], c);          // tapers to a point at the tip
    }

    // ---- Planter: charcoal cylinder topped with a flax/foliage mound -----
    function planter(x, z, ix) {
        const g = groundAt(x, z) + 0.15, top = g + 0.9;
        cyl(x, z, g, top, 0.8, C_CHAR, 6, true, 0.9);          // pot (slight taper)
        cone(x, z, top - 0.05, top + 0.8, 0.72, C_FLAX[ix % 4], 6);   // foliage mound
        for (let k = 0; k < 4; k++) {                          // flax blades
            const a = k / 4 * Math.PI * 2 + ix, r = 0.42;
            cone(x + Math.cos(a) * r, z + Math.sin(a) * r, top, top + 1.5 - (k % 2) * 0.4,
                0.13, C_FLAX[(ix + k) % 4], 3);
        }
    }
    // ---- Palm: thin trunk + radiating frond crown -----------------------
    function palm(x, z) {
        const g = groundAt(x, z) + 0.15, th = 5.4, ty = g + th;
        cyl(x, z, g, ty, 0.16, C_PTRUNK, 5, true, 0.12);
        cone(x, z, ty - 0.2, ty + 0.45, 0.35, C_FROND, 5);     // crown core
        for (let k = 0; k < 8; k++) {                          // drooping fronds
            const a = k / 8 * Math.PI * 2, r = 2.2, tipy = ty - 0.35;
            const tx = x + Math.cos(a) * r, tz = z + Math.sin(a) * r;
            const nx = -Math.sin(a) * 0.5, nz = Math.cos(a) * 0.5;
            K.v(K.opa, [x + nx, ty + 0.1, z + nz], C_FROND);
            K.v(K.opa, [x - nx, ty + 0.1, z - nz], C_FROND);
            K.v(K.opa, [tx, tipy, tz], C_FROND);
        }
    }
    // ---- Bare deciduous winter tree: thin trunk + angled branch stubs ----
    function tree(x, z, ix) {
        const g = groundAt(x, z) + 0.15, th = 3.1, ty = g + th;
        cyl(x, z, g, ty, 0.13, C_TTRUNK, 5, true, 0.09);       // thin trunk
        // 4 primary branch stubs angling up-and-out from the crown fork
        const nb = 4, forky = ty - 0.3;
        for (let k = 0; k < nb; k++) {
            const a = k / nb * Math.PI * 2 + ix * 0.7, r = 1.15;
            const tx = x + Math.cos(a) * r, tz = z + Math.sin(a) * r, tyy = ty + 1.5;
            strut(x, forky, z, tx, tyy, tz, 0.12, C_BRANCH);
            // a short secondary twig off each branch
            strut(tx, tyy, tz, tx + Math.cos(a) * 0.5, tyy + 0.7, tz + Math.sin(a) * 0.5, 0.06, C_BRANCH);
        }
        // a small central leader + a faint open canopy blob (greyish-brown)
        strut(x, forky, z, x, ty + 2.1, z, 0.1, C_BRANCH);
        cone(x, z, ty + 0.6, ty + 2.2, 0.75, C_BRANCH, 5);
    }
    // ---- Signal pole: tall pole + cantilever arm + light box ------------
    // (rx,rz) is the unit direction from the pole toward the road centre.
    function signalPole(x, z, rx, rz) {
        const g = groundAt(x, z) + 0.15, ph = 6.8, py = g + ph;
        cyl(x, z, g, py, 0.13, C_POLE, 6, true, 0.1);
        // horizontal cantilever arm reaching ~5 m over the carriageway
        const armLen = 5.0, ay = py - 0.3;
        const ex = x + rx * armLen, ez = z + rz * armLen;
        const ux = rx, uz = rz;      // along the arm
        obox((x + ex) / 2, (z + ez) / 2, ux, uz, -armLen / 2, armLen / 2, -0.09, 0.09, ay, ay + 0.18, C_POLE);
        // hanging traffic-light box at the arm tip
        obox(ex, ez, ux, uz, -0.16, 0.16, -0.16, 0.16, ay - 0.75, ay, C_CHAR2);
        // three signal lenses (red/amber/green) on the road-facing side
        const lens = [col('#c8382f'), col('#d8a838'), col('#3fae4e')];
        for (let i = 0; i < 3; i++)
            obox(ex - rx * 0.17, ez - rz * 0.17, ux, uz, -0.09, 0.09, -0.09, 0.09,
                ay - 0.62 + i * 0.2, ay - 0.48 + i * 0.2, lens[i], { front: 1, back: 1, left: 1, right: 1 });
    }
    // ---- Simple lamp pole (optionally bannered) -------------------------
    function lampPole(x, z, ax, az, withBanner) {
        const g = groundAt(x, z) + 0.15, ph = 6.2, py = g + ph;
        cyl(x, z, g, py, 0.1, C_POLE, 6, true, 0.08);
        obox(x + ax * 0.5, z + az * 0.5, ax, az, -0.6, 0.6, -0.12, 0.12, py - 0.1, py + 0.05, C_POLE);
        cone(x + ax * 1.0, z + az * 1.0, py - 0.25, py - 0.02, 0.16, C_CHAR2, 5);  // lamp head
        if (withBanner) banner(x, z, ax, az, g);
    }
    // ---- Vertical blue banner flag bracketed to a pole ------------------
    function banner(x, z, ax, az, g) {
        const px = x + ax * 0.35, pz = z + az * 0.35;   // stand off the pole
        obox(px, pz, ax, az, -0.02, 0.02, -0.35, 0.35, g + 3.4, g + 5.4, C_BANNER);
        // a thin white band across the top of the banner
        obox(px, pz, ax, az, 0.0, 0.03, -0.35, 0.35, g + 5.1, g + 5.35, C_WHITE, { front: 1, back: 1 });
    }
    // ---- Wooden-slat bench ----------------------------------------------
    function bench(x, z, ux, uz) {
        const g = groundAt(x, z) + 0.15;
        obox(x, z, ux, uz, -0.9, 0.9, -0.28, 0.28, g + 0.45, g + 0.52, C_WOOD);      // seat
        obox(x - uz * 0.28, z + ux * 0.28, ux, uz, -0.9, 0.9, -0.05, 0.05, g + 0.52, g + 0.95, C_WOOD); // back
        obox(x, z, ux, uz, -0.78, 0.78, -0.22, 0.22, g, g + 0.45, C_CHAR2, { left: 1, right: 1 });      // leg bar
    }
    // ---- Rubbish bin -----------------------------------------------------
    function bin(x, z) {
        const g = groundAt(x, z) + 0.15;
        cyl(x, z, g, g + 0.95, 0.3, C_BIN, 6, false, 0.28);
        cyl(x, z, g + 0.95, g + 1.02, 0.32, C_CHAR2, 6, true);   // lid
    }

    // =====================================================================
    //  BUILD SURFACE
    // =====================================================================
    for (const poly of polys) {
        const pts = poly.pts;
        // continuous bluestone carriageway
        band(pts, -HALF, HALF, E_STONE, C_STONE);
        // paver footpaths both sides (raised)
        band(pts, FOOT_IN, FOOT_OUT, E_FOOT, C_FOOT);
        band(pts, -FOOT_OUT, -FOOT_IN, E_FOOT, C_FOOT);
        // darker kerb lip
        band(pts, KERB_IN, KERB_OUT, E_KERB, C_KERB);
        band(pts, -KERB_OUT, -KERB_IN, E_KERB, C_KERB);
        // white edge lines
        band(pts, EDGE_IN, EDGE_OUT, E_EDGE, C_WHITE);
        band(pts, -EDGE_OUT, -EDGE_IN, E_EDGE, C_WHITE);
        // yellow centre — double solid on long straights, dashed on the rest
        if (poly.len > 60) {
            band(pts, -0.35, -0.1, E_YEL, C_YELLOW);
            band(pts, 0.1, 0.35, E_YEL, C_YELLOW);
        } else {
            dashed(pts, 0, 0.18, E_YEL, C_YELLOW, 3.2, 3.2);
        }
    }

    // a few lane arrows on the two longest corridors
    const longest = polys.slice().sort((a, b) => b.len - a.len).slice(0, 3);
    for (const poly of longest) {
        const pts = poly.pts;
        for (const frac of [0.35, 0.7]) {
            let target = poly.len * frac, acc = 0;
            for (let s = 0; s < pts.length - 1; s++) {
                const p1 = pts[s], p2 = pts[s + 1];
                const dx = p2[0] - p1[0], dz = p2[1] - p1[1], len = Math.hypot(dx, dz);
                if (acc + len >= target) {
                    const t = (target - acc) / len, ux = dx / len, uz = dz / len;
                    const x = p1[0] + dx * t, z = p1[1] + dz * t, nx = -uz, nz = ux;
                    arrow(x + nx * 3.2, z + nz * 3.2, ux, uz);
                    break;
                }
                acc += len;
            }
        }
    }

    // =====================================================================
    //  DETECT INTERSECTIONS (endpoint / vertex clusters) — for crossings + poles
    // =====================================================================
    const nodes = [];
    polys.forEach((poly, pi) => {
        const pts = poly.pts;
        pts.forEach((p, k) => {
            let tx, tz;
            if (k < pts.length - 1) { tx = pts[k + 1][0] - p[0]; tz = pts[k + 1][1] - p[1]; }
            else { tx = p[0] - pts[k - 1][0]; tz = p[1] - pts[k - 1][1]; }
            const l = Math.hypot(tx, tz) || 1;
            nodes.push({ x: p[0], z: p[1], pi, k, dx: tx / l, dz: tz / l });
        });
    });
    const used = new Array(nodes.length).fill(false);
    const junctions = [];
    for (let i = 0; i < nodes.length; i++) {
        if (used[i]) continue;
        const cluster = [i]; used[i] = true;
        for (let j = i + 1; j < nodes.length; j++) {
            if (used[j]) continue;
            if (Math.hypot(nodes[j].x - nodes[i].x, nodes[j].z - nodes[i].z) < 12) {
                cluster.push(j); used[j] = true;
            }
        }
        const dp = new Set(cluster.map((k) => nodes[k].pi));
        if (cluster.length >= 3 && dp.size >= 2) {
            let cx = 0, cz = 0;
            for (const k of cluster) { cx += nodes[k].x; cz += nodes[k].z; }
            cx /= cluster.length; cz /= cluster.length;
            // outward APPROACH directions: from centre toward the neighbouring
            // vertex of each polyline meeting here (deduped by angle)
            const appr = [];
            for (const ci of cluster) {
                const nd = nodes[ci], pts = polys[nd.pi].pts;
                for (const nb of [nd.k - 1, nd.k + 1]) {
                    if (nb < 0 || nb >= pts.length) continue;
                    const vx = pts[nb][0] - cx, vz = pts[nb][1] - cz, d = Math.hypot(vx, vz);
                    if (d < 3) continue;
                    const a = { dx: vx / d, dz: vz / d };
                    if (!appr.some((u) => u.dx * a.dx + u.dz * a.dz > 0.9)) appr.push(a);
                }
            }
            junctions.push({ x: cx, z: cz, dx: appr[0] ? appr[0].dx : nodes[cluster[0]].dx,
                             dz: appr[0] ? appr[0].dz : nodes[cluster[0]].dz, appr });
        }
    }

    // ---- Tiger crossing set + stop-line on one approach ------------------
    // centre (cx,cz); ux,uz = direction along the approach road (out of junction)
    function crossingAt(cx, cz, ux, uz) {
        const px = -uz, pz = ux;                  // across the road
        const barW = 0.5, period = 1.1, span = 3.4, lat = HALF - 0.3;
        let idx = 0;
        for (let a = -span; a <= span; a += period, idx++) {
            const a0 = a - barW / 2, a1 = a + barW / 2;
            const c = (al, la) => wp(cx + ux * al + px * la, cz + uz * al + pz * la, E_CROSS);
            K.quad(K.opa, c(a0, -lat), c(a0, lat), c(a1, lat), c(a1, -lat),
                idx % 2 ? C_TIGERY : C_WHITE);
        }
    }
    // solid white stop-line across the approach, just inside the crossing
    function stopLine(cx, cz, ux, uz) {
        const px = -uz, pz = ux, lat = HALF - 0.3, hw = 0.25;
        const c = (al, la) => wp(cx + ux * al + px * la, cz + uz * al + pz * la, E_ARROW);
        K.quad(K.opa, c(-hw, -lat), c(-hw, 0), c(hw, 0), c(hw, -lat), C_WHITE);   // one half (near lane)
        K.quad(K.opa, c(-hw, 0), c(-hw, lat), c(hw, lat), c(hw, 0), C_WHITE);      // other half
    }
    for (const j of junctions) {
        // a tiger crossing + stop-line on EACH approach arm of the junction
        const arms = (j.appr && j.appr.length) ? j.appr : [{ dx: j.dx, dz: j.dz }];
        for (const a of arms) {
            const cx = j.x + a.dx * 6.5, cz = j.z + a.dz * 6.5;      // beyond the box
            crossingAt(cx, cz, a.dx, a.dz);
            stopLine(j.x + a.dx * 8.6, j.z + a.dz * 8.6, a.dx, a.dz);
        }
        // a cantilever signal pole on each side of the primary road axis
        const nx = -j.dz, nz = j.dx;
        signalPole(j.x + nx * OFF_POLE, j.z + nz * OFF_POLE, -nx, -nz);
        signalPole(j.x - nx * OFF_POLE, j.z - nz * OFF_POLE, nx, nz);
    }

    // =====================================================================
    //  PLACE KERB-LINE FURNITURE by walking each corridor
    // =====================================================================
    // continuous walk along a polyline, callback at every `spacing` metres
    function walk(pts, spacing, phase, cb) {
        let acc = phase;
        for (let s = 0; s < pts.length - 1; s++) {
            const p1 = pts[s], p2 = pts[s + 1];
            const dx = p2[0] - p1[0], dz = p2[1] - p1[1], len = Math.hypot(dx, dz);
            if (len < 1e-3) continue;
            const ux = dx / len, uz = dz / len;
            while (acc < len) {
                cb(p1[0] + ux * acc, p1[1] + uz * acc, ux, uz);
                acc += spacing;
            }
            acc -= len;
        }
    }

    let pi = 0, ti = 0;   // planter / tree running indices
    for (const poly of polys) {
        const pts = poly.pts;
        if (poly.len < 24) continue;                 // skip tiny fragments
        // DENSE planting on the main Queen St corridors, sparse on stubs
        const PL_SP = poly.main ? 34 : 64;           // planter spacing
        const TR_SP = poly.main ? 24 : 44;           // tree spacing
        // planters in pairs (both kerbs), with a bench some / a bin each stop
        walk(pts, PL_SP, PL_SP / 3, (x, z, ux, uz) => {
            const nx = -uz, nz = ux;
            planter(x + nx * OFF_PLANT, z + nz * OFF_PLANT, pi);
            planter(x - nx * OFF_PLANT, z - nz * OFF_PLANT, pi + 1);
            if (pi % 4 === 0) bench(x + nx * OFF_BENCH, z + nz * OFF_BENCH, ux, uz);
            else if (pi % 4 === 2) bench(x - nx * OFF_BENCH, z - nz * OFF_BENCH, ux, uz);
            if (pi % 2 === 0) bin(x - nx * OFF_BIN, z - nz * OFF_BIN);
            else bin(x + nx * OFF_BIN, z + nz * OFF_BIN);
            pi += 2;
        });
        // street trees alternating palm / deciduous, both sides
        walk(pts, TR_SP, TR_SP / 4, (x, z, ux, uz) => {
            const nx = -uz, nz = ux;
            (ti % 2 ? palm : tree)(x + nx * OFF_TREE, z + nz * OFF_TREE, ti);
            ((ti + 1) % 2 ? palm : tree)(x - nx * OFF_TREE, z - nz * OFF_TREE, ti + 1);
            ti++;
        });
        // banner lamp poles every ~64 m on the long corridors
        if (poly.len > 60) {
            walk(pts, 64, 40, (x, z, ux, uz) => {
                const nx = -uz, nz = ux;
                lampPole(x + nx * OFF_POLE, z + nz * OFF_POLE, -nx, -nz, true);
            });
        }
    }

    K.finish('queenstreet');
};
