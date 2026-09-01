//
//  queen-kit.mod.js — shared building kit for the Queen Street landmarks.
//
//  Every landmark module imports makeKit(world) and builds in a clean
//  building-local frame with vertex-coloured loose geometry, to the Flinders
//  & Swanston standard: windows are recessed openings with a graded pane,
//  cornices are stacked courses with dentils, one opaque + one glass mesh per
//  building, registered as a single named world.part(). Materials are
//  double-sided so winding never inverts.
//
//  Contract for a landmark file (queen-lm-<slug>.mod.js):
//     import { makeKit } from './queen-kit.mod.js';
//     export const ID = 'w....';                  // OSM id (massing skips it)
//     export const RING = 'x,z x,z ...';          // footprint, world metres
//     export function build(world) {
//         const K = makeKit(world);
//         const { L, D, W } = K.frame(RING, 'south');   // facade faces plaza/street
//         // ... K.box(...), K.windowRect(...), K.archHead(...), K.cornice(...) ...
//         K.finish('slug');                        // 2 meshes, one part
//     }
//

export function makeKit(world) {
    const { THREE, scene } = world;
    const groundAt = world.groundAt || (() => 0);
    const col = (hex) => new THREE.Color(hex).convertSRGBToLinear();

    // building-local frame from a footprint ring; facadeToward 'north'|'south'
    // |'east'|'west' OR a compass heading in DEGREES (0=N/-z, 90=E/+x,
    // 180=S/+z, 270=W/-x) points the detailed facade that way. Heading is the
    // robust path: the frontage axis is derived from the heading, not from the
    // longest footprint edge (Auckland's OSM rings are jagged, so the longest
    // edge is often a short diagonal that rotated the whole building).
    let FR = null;
    function frame(ringStr, facadeToward) {
        const pts = ringStr.split(' ').map((p) => { const c = p.indexOf(','); return [+p.slice(0, c), +p.slice(c + 1)]; });
        let r = pts.slice();
        if (r.length > 1 && r[0][0] === r[r.length - 1][0] && r[0][1] === r[r.length - 1][1]) r = r.slice(0, -1);
        let cx = 0, cz = 0; for (const p of r) { cx += p[0]; cz += p[1]; } cx /= r.length; cz /= r.length;
        // heading → facing-out unit vector H and along-frontage unit vector A
        const deg = (typeof facadeToward === 'number')
            ? facadeToward
            : ({ north: 0, east: 90, south: 180, west: 270 }[facadeToward] ?? 180);
        const th = deg * Math.PI / 180;
        const Hx = Math.sin(th), Hz = -Math.cos(th);   // facade normal, points toward the street/plaza
        const Ax = Math.cos(th), Az = Math.sin(th);    // along the frontage (perp to H)
        let umin = 1e9, umax = -1e9, tmin = 1e9, tmax = -1e9;
        for (const p of r) {
            const du = (p[0] - cx) * Ax + (p[1] - cz) * Az;
            const dt = (p[0] - cx) * Hx + (p[1] - cz) * Hz;
            umin = Math.min(umin, du); umax = Math.max(umax, du);
            tmin = Math.min(tmin, dt); tmax = Math.max(tmax, dt);
        }
        const L = umax - umin, D = tmax - tmin;
        let gmin = Infinity, gmax = -Infinity;
        for (const p of r) { const g = groundAt(p[0], p[1]); gmin = Math.min(gmin, g); gmax = Math.max(gmax, g); }
        if (!isFinite(gmin)) { gmin = 0; gmax = 0; }
        const yb = gmax - 0.2;                          // ground floor meets the HIGHEST adjacent ground
        // (u:0..L along frontage, t:0..D depth from facade, y up from pavement)
        const W = (u, t, y) => [
            cx + Ax * (umin + u) + Hx * (tmax - t),
            yb + y,
            cz + Az * (umin + u) + Hz * (tmax - t),
        ];
        FR = { L, D, W, gmin, gmax, yb };
        return { L, D, W, ground: 0, gmin, gmax };
    }

    const opa = { pos: [], col: [] }, gla = { pos: [], col: [] };
    const v = (bk, p, c) => { bk.pos.push(p[0], p[1], p[2]); bk.col.push(c.r, c.g, c.b); };
    const quad = (bk, a, b, c, d, cc) => { v(bk, a, cc); v(bk, b, cc); v(bk, c, cc); v(bk, a, cc); v(bk, c, cc); v(bk, d, cc); };
    function box(W, u0, u1, t0, t1, y0, y1, c, faces, bk) {
        bk = bk || opa;
        const f = faces || { front: 1, back: 1, left: 1, right: 1, top: 1, bottom: 0 };
        const P = W;
        if (f.front) quad(bk, P(u0, t0, y0), P(u1, t0, y0), P(u1, t0, y1), P(u0, t0, y1), c);
        if (f.back)  quad(bk, P(u1, t1, y0), P(u0, t1, y0), P(u0, t1, y1), P(u1, t1, y1), c);
        if (f.left)  quad(bk, P(u0, t1, y0), P(u0, t0, y0), P(u0, t0, y1), P(u0, t1, y1), c);
        if (f.right) quad(bk, P(u1, t0, y0), P(u1, t1, y0), P(u1, t1, y1), P(u1, t0, y1), c);
        if (f.top)   quad(bk, P(u0, t0, y1), P(u1, t0, y1), P(u1, t1, y1), P(u0, t1, y1), c);
        if (f.bottom) quad(bk, P(u0, t1, y0), P(u1, t1, y0), P(u1, t0, y0), P(u0, t0, y0), c);
    }
    // recessed rectangular opening + graded glass pane (sillC at sill → skyC at head)
    function windowRect(W, u0, u1, ta, y0, y1, reveal, frameC, skyC, sillC) {
        box(W, u0, u1, ta, ta + reveal, y0, y1, frameC, { front: 0, back: 0, top: 1, bottom: 1, left: 1, right: 1 });
        const tb = ta + reveal;
        const a = W(u0, tb, y0), b = W(u1, tb, y0), c = W(u1, tb, y1), d = W(u0, tb, y1);
        v(gla, a, sillC); v(gla, b, sillC); v(gla, c, skyC); v(gla, a, sillC); v(gla, c, skyC); v(gla, d, skyC);
    }
    // arched (semicircular) head over an opening, frame band + graded tympanum
    function archHead(W, u0, u1, ta, yspring, reveal, frameC, skyC) {
        const uc = (u0 + u1) / 2, rad = (u1 - u0) / 2, seg = 8, tb = ta + reveal;
        let prev = null;
        for (let s = 0; s <= seg; s++) {
            const ang = Math.PI * (s / seg);
            const u = uc - rad * Math.cos(ang), y = yspring + rad * Math.sin(ang);
            if (prev) {
                quad(opa, W(prev.u, ta, prev.y), W(u, ta, y), W(u, ta + 0.18, y), W(prev.u, ta + 0.18, prev.y), frameC);
                v(gla, W(prev.u, tb, prev.y), skyC); v(gla, W(u, tb, y), skyC); v(gla, W(uc, tb, yspring), skyC);
            }
            prev = { u, y };
        }
    }
    // stacked cornice courses (each proud) + a dentil row under the top course
    function cornice(W, u0, u1, tFace, y0, courses, c, dentilC) {
        let y = y0;
        for (let i = 0; i < courses; i++) {
            const proud = 0.18 + i * 0.16, h = 0.34;
            box(W, u0, u1, tFace - proud, tFace, y, y + h, c, { front: 1, top: 1, bottom: 1 });
            y += h;
        }
        const nd = Math.floor((u1 - u0) / 1.0);
        for (let i = 0; i < nd; i++) {
            const du = u0 + 0.3 + i * ((u1 - u0 - 0.6) / nd);
            box(W, du, du + 0.4, tFace - 0.34, tFace, y0 - 0.42, y0 - 0.04, dentilC, { front: 1, bottom: 1, left: 1, right: 1 });
        }
        return y;
    }
    // open balustrade parapet: base + cap rail with balusters between
    function balustrade(W, u0, u1, tFace, y0, h, c) {
        box(W, u0, u1, tFace - 0.3, tFace, y0, y0 + 0.22, c, { front: 1, top: 1, left: 1, right: 1 });
        box(W, u0, u1, tFace - 0.3, tFace, y0 + h - 0.24, y0 + h, c, { front: 1, top: 1, left: 1, right: 1 });
        const n = Math.floor((u1 - u0) / 0.85);
        for (let i = 0; i < n; i++) {
            const du = u0 + 0.25 + i * ((u1 - u0 - 0.5) / n);
            box(W, du, du + 0.28, tFace - 0.26, tFace - 0.02, y0 + 0.22, y0 + h - 0.24, c, { front: 1, back: 1, left: 1, right: 1 });
        }
    }
    // a filled disc (clock face etc.) on the facade plane at depth t, radius rad
    function disc(W, uc, yc, t, rad, c, seg) {
        seg = seg || 18; let prev = null;
        for (let s = 0; s <= seg; s++) {
            const a = (s / seg) * Math.PI * 2, u = uc + rad * Math.cos(a), y = yc + rad * Math.sin(a);
            if (prev) { v(opa, W(uc, t, yc), c); v(opa, W(prev.u, t, prev.y), c); v(opa, W(u, t, y), c); }
            prev = { u, y };
        }
    }
    // square pyramidal roof over a rectangular top (corners in (u,t)), apex up
    function pyramid(W, u0, u1, t0, t1, ybase, yapex, c) {
        const cu = (u0 + u1) / 2, ct = (t0 + t1) / 2;
        const cor = [[u0, t0], [u1, t0], [u1, t1], [u0, t1]];
        for (let k = 0; k < 4; k++) {
            const a = cor[k], b = cor[(k + 1) % 4];
            v(opa, W(a[0], a[1], ybase), c); v(opa, W(b[0], b[1], ybase), c); v(opa, W(cu, ct, yapex), c);
        }
    }

    // ---- Melbourne street-frontage layer -------------------------------
    // A cantilevered verandah over the footpath (t<0 is out toward the street).
    function verandah(W, u0, u1, yTop, proj, faceC, softC) {
        proj = proj || 3.4; yTop = yTop || 4.3;
        const fc = col(faceC || '#43423f'), sc = col(softC || '#c9c4b6');
        box(W, u0, u1, -proj, 0.1, yTop, yTop + 0.34, fc, { front: 1, back: 1, left: 1, right: 1, top: 1 });
        box(W, u0, u1, -proj, 0.1, yTop - 0.05, yTop, sc, { bottom: 1 });                 // lit soffit
        box(W, u0, u1, -proj - 0.02, -proj + 0.12, yTop - 0.6, yTop + 0.34, fc, { front: 1, left: 1, right: 1 }); // fascia
    }
    // A walk-up shopfront: recessed graded glass between dark mullions, a solid
    // riser, a transom bar and a sign fascia above (the Melbourne shop grammar).
    function shopfront(W, u0, u1, y0, y1, opts) {
        opts = opts || {};
        const tg = opts.reveal || 0.35;
        const riser = opts.riser || 0.5, transom = (opts.transom || 2.95) + y0, head = y1 - (opts.fascia || 0.9);
        const mullC = col(opts.mull || '#2f3033'), g0 = col(opts.sill || '#1e2228'), g1 = col(opts.sky || '#93a5b8');
        box(W, u0, u1, 0, tg, y0, y0 + riser, col(opts.riserC || '#26262a'), { front: 1, top: 1 });
        const a = W(u0, tg, y0 + riser), b = W(u1, tg, y0 + riser), c = W(u1, tg, head), d = W(u0, tg, head);
        v(gla, a, g0); v(gla, b, g0); v(gla, c, g1); v(gla, a, g0); v(gla, c, g1); v(gla, d, g1);
        const n = Math.max(1, Math.round((u1 - u0) / 2.2));
        for (let i = 0; i <= n; i++) { const u = u0 + (u1 - u0) * i / n; box(W, u - 0.06, u + 0.06, 0, tg + 0.05, y0 + riser, head, mullC, { front: 1, left: 1, right: 1 }); }
        box(W, u0, u1, 0, tg + 0.05, transom - 0.06, transom + 0.06, mullC, { front: 1 });
        box(W, u0, u1, 0, tg + 0.05, head, head + 0.08, mullC, { front: 1 });
        // sign fascia band
        box(W, u0, u1, -0.05, 0.14, head + 0.1, y1, col(opts.sign || '#8a2f2f'), { front: 1, top: 1, bottom: 1, left: 1, right: 1 });
    }
    // a proud fascia sign plate (shopfront band / parapet name)
    function signband(W, u0, u1, y0, y1, plateC) {
        box(W, u0, u1, -0.12, 0.05, y0, y1, col(plateC || '#b23a3a'), { front: 1, top: 1, bottom: 1, left: 1, right: 1 });
    }
    // aging: a downpipe run and a rooftop AC/plant box
    function downpipe(W, u, y0, y1, c) { box(W, u - 0.12, u + 0.12, 0.02, 0.3, y0, y1, col(c || '#37373a'), { front: 1, left: 1, right: 1 }); }
    function acbox(W, u0, u1, t0, t1, y0, y1, c) { box(W, u0, u1, t0, t1, y0, y1, col(c || '#6e7074'), { front: 1, back: 1, left: 1, right: 1, top: 1 }); }

    function finish(slug, opts) {
        opts = opts || {};
        // ground-fill skirt: from below the lowest adjacent ground up to just
        // above pavement, so a building on a slope meets the terrain instead of
        // floating on a plinth. Muted stone so it reads as a base, not a void.
        if (FR && !opts.noSkirt) {
            const depth = (FR.gmin - FR.yb) - 1.5;   // local y, well below grade
            const sc = col(opts.skirt || '#6f6a62');
            box(FR.W, 0.2, FR.L - 0.2, 0.2, FR.D - 0.2, depth, 0.7, sc,
                { front: 1, back: 1, left: 1, right: 1, top: 0, bottom: 0 });
        }
        const g = new THREE.Group();
        const mk = (bk, mat, name) => {
            const geo = new THREE.BufferGeometry();
            geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(bk.pos), 3));
            geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(bk.col), 3));
            geo.computeVertexNormals();
            const m = new THREE.Mesh(geo, mat); m.name = name; return m;
        };
        if (opa.pos.length) g.add(mk(opa, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: opts.roughness || 0.85, metalness: opts.metalness || 0.02, side: THREE.DoubleSide }), slug + '_opaque'));
        if (gla.pos.length) {
            const gm = mk(gla, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: opts.glassRough || 0.14, metalness: opts.glassMetal || 0.2, side: THREE.DoubleSide }), slug + '_glass');
            g.add(gm); world.ghost(gm);
        }
        g.name = slug;
        scene.add(g);
        world.part(slug + '_00', g);
        return (opa.pos.length + gla.pos.length) / 9;
    }

    return { THREE, col, frame, box, quad, v, windowRect, archHead, cornice, balustrade, disc, pyramid,
        verandah, shopfront, signband, downpipe, acbox, finish, opa, gla };
}
