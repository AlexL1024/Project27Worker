//
//  queen-landmarks.mod.js
//
//  Queen Street, Auckland — the LANDMARKS, each built bespoke from Google
//  Street View reference to the Flinders & Swanston standard: loose box/shape
//  geometry in a building-local frame, coloured per vertex, windows as real
//  recessed openings with a graded pane behind, cornices as stacked courses
//  with dentils, merged into a couple of meshes per building. No templates,
//  no duplication — every function here is one real building.
//
//  Hosted like the Melbourne module: a scene calls buildQueenLandmarks(shim)
//  with a world exposing groundAt(x,z); the massing module skips every id this
//  file builds (its DETAILED set), so a landmark is not drawn twice.
//
//  Footprints © OpenStreetMap contributors (ODbL). World metres: x east,
//  z south, y up.
//

// Each Queen Street landmark is its own module (built bespoke from Street
// View by a dedicated pass) exporting ID, RING and build(world). They share
// queen-kit.mod.js. The Ferry Building is still inline below for its grammar.
import * as LM_CPO from './queen-lm-cpo.mod.js';
import * as LM_DILWORTH from './queen-lm-dilworth.mod.js';
import * as LM_CIVIC from './queen-lm-civic.mod.js';
import * as LM_TOWNHALL from './queen-lm-townhall.mod.js';
import * as LM_ENDEANS from './queen-lm-endeans.mod.js';
import * as LM_BNZ from './queen-lm-bnz.mod.js';
import * as LM_SAP from './queen-lm-sap.mod.js';
import { build as buildQueenStreetDetail } from './queen-street-detail.mod.js';

const LANDMARK_MODULES = [LM_CPO, LM_DILWORTH, LM_CIVIC, LM_TOWNHALL, LM_ENDEANS, LM_BNZ, LM_SAP];

// The ids this module replaces with detailed builds — the massing module
// reads QUEEN_DETAILED and skips them. Ferry Building inline + every module id.
export const QUEEN_DETAILED = new Set([
    'w23904427',   // Ferry Building (inline, below)
    ...LANDMARK_MODULES.map((m) => m.ID),
]);

function buildQueenLandmarks(world) {
    const { THREE, scene } = world;
    const groundAt = world.groundAt || (() => 0);
    const col = (hex) => new THREE.Color(hex).convertSRGBToLinear();

    // ---- one building's local frame from its footprint -------------------
    // Real landmarks are rectangular; the OSM outline is a noisy sliver, so we
    // fit an oriented box (longest edge = frontage) and build in a clean local
    // frame (u along frontage 0..L, t depth 0..D from the chosen facade, y up).
    function frameFromRing(ringStr, facadeToward) {
        const pts = ringStr.split(' ').map((p) => { const c = p.indexOf(','); return [+p.slice(0, c), +p.slice(c + 1)]; });
        let r = pts.slice();
        if (r.length > 1 && r[0][0] === r[r.length - 1][0] && r[0][1] === r[r.length - 1][1]) r = r.slice(0, -1);
        // longest edge → frontage direction
        let bx = 0, bz = 0, blen = 0;
        for (let i = 0; i < r.length; i++) {
            const a = r[i], b = r[(i + 1) % r.length];
            const dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz);
            if (l > blen) { blen = l; bx = dx / l; bz = dz / l; }
        }
        let cx = 0, cz = 0; for (const p of r) { cx += p[0]; cz += p[1]; } cx /= r.length; cz /= r.length;
        const Ax = bx, Az = bz;          // along
        let Nx = -bz, Nz = bx;           // perp
        // extents
        let umin = 1e9, umax = -1e9, tmin = 1e9, tmax = -1e9;
        for (const p of r) {
            const du = (p[0] - cx) * Ax + (p[1] - cz) * Az;
            const dt = (p[0] - cx) * Nx + (p[1] - cz) * Nz;
            umin = Math.min(umin, du); umax = Math.max(umax, du);
            tmin = Math.min(tmin, dt); tmax = Math.max(tmax, dt);
        }
        const L = umax - umin, D = tmax - tmin;
        // point N toward the facade side (e.g. the harbour: smaller z)
        const midU = (umin + umax) / 2, midT = (tmin + tmax) / 2;
        const oCx = cx + Ax * midU + Nx * midT, oCz = cz + Az * midU + Nz * midT;
        const frontSign = ((oCz + Nz) < oCz) === (facadeToward === 'north') ? 1 : -1;
        if (frontSign < 0) { Nx = -Nx; Nz = -Nz; }
        // front-face centre = box centre + N*(D/2)
        const fCx = oCx + Nx * (D / 2), fCz = oCz + Nz * (D / 2);
        // ground: lowest terrain under the footprint
        let gmin = Infinity; for (const p of r) gmin = Math.min(gmin, groundAt(p[0], p[1]));
        if (!isFinite(gmin)) gmin = 0;
        const W = (u, t, y) => [fCx + Ax * (u - L / 2) - Nx * t, gmin - 0.4 + y, fCz + Az * (u - L / 2) - Nz * t];
        return { L, D, W, ground: gmin };
    }

    // ---- vertex-colour emit ---------------------------------------------
    function bucket() { return { pos: [], col: [] }; }
    function v(bk, p, c) { bk.pos.push(p[0], p[1], p[2]); bk.col.push(c.r, c.g, c.b); }
    // quad a-b-c-d (already world triples), wound as given (caller ensures out-facing)
    function quad(bk, a, b, c, d, cc) { v(bk, a, cc); v(bk, b, cc); v(bk, c, cc); v(bk, a, cc); v(bk, c, cc); v(bk, d, cc); }
    // an axis-local box in (u,t,y); faces optional to skip hidden ones
    function box(bk, W, u0, u1, t0, t1, y0, y1, c, faces) {
        const f = faces || { front: 1, back: 1, left: 1, right: 1, top: 1, bottom: 0 };
        const P = (u, t, y) => W(u, t, y);
        // front = t0 (toward facade), back = t1
        if (f.front) quad(bk, P(u0, t0, y0), P(u1, t0, y0), P(u1, t0, y1), P(u0, t0, y1), c);
        if (f.back)  quad(bk, P(u1, t1, y0), P(u0, t1, y0), P(u0, t1, y1), P(u1, t1, y1), c);
        if (f.left)  quad(bk, P(u0, t1, y0), P(u0, t0, y0), P(u0, t0, y1), P(u0, t1, y1), c);
        if (f.right) quad(bk, P(u1, t0, y0), P(u1, t1, y0), P(u1, t1, y1), P(u1, t0, y1), c);
        if (f.top)   quad(bk, P(u0, t0, y1), P(u1, t0, y1), P(u1, t1, y1), P(u0, t1, y1), c);
        if (f.bottom)quad(bk, P(u0, t1, y0), P(u1, t1, y0), P(u1, t0, y0), P(u0, t0, y0), c);
    }
    // a recessed window: dark reveal box + a graded glass pane at the back.
    // Glass goes in the glass bucket, graded dark(sill)→pale(head) in vertex colour.
    function windowRect(opa, gla, W, u0, u1, ta, y0, y1, reveal, frameC, skyC, sillC) {
        // reveal walls (frame) around the opening
        box(opa, W, u0, u1, ta, ta + reveal, y0, y1, frameC, { front: 0, back: 0, top: 1, bottom: 1, left: 1, right: 1 });
        // pane at back of reveal, graded
        const tb = ta + reveal;
        const a = W(u0, tb, y0), b = W(u1, tb, y0), c = W(u1, tb, y1), d = W(u0, tb, y1);
        v(gla, a, sillC); v(gla, b, sillC); v(gla, c, skyC); v(gla, a, sillC); v(gla, c, skyC); v(gla, d, skyC);
    }
    // arched window head: semicircle of thin quad segments in the frame colour,
    // with a graded glass tympanum behind.
    function archHead(opa, gla, W, u0, u1, ta, yspring, reveal, frameC, skyC) {
        const uc = (u0 + u1) / 2, rad = (u1 - u0) / 2, seg = 7, tb = ta + reveal;
        let prev = null;
        for (let s = 0; s <= seg; s++) {
            const ang = Math.PI * (s / seg);
            const u = uc - rad * Math.cos(ang), y = yspring + rad * Math.sin(ang);
            if (prev) {
                // frame band on the face
                quad(opa, W(prev.u, ta, prev.y), W(u, ta, y), W(u, ta + 0.18, y), W(prev.u, ta + 0.18, prev.y), frameC);
                // glass tympanum triangle to spring centre
                v(gla, W(prev.u, tb, prev.y), skyC); v(gla, W(u, tb, y), skyC); v(gla, W(uc, tb, yspring), skyC);
            }
            prev = { u, y };
        }
    }
    // stacked cornice courses (each slightly proud) + a dentil row
    function cornice(opa, W, u0, u1, tFace, y0, courses, c, dentilC) {
        let y = y0;
        for (let i = 0; i < courses; i++) {
            const proud = 0.18 + i * 0.16, h = 0.34;
            box(opa, W, u0, u1, tFace - proud, tFace, y, y + h, c, { front: 1, top: 1, bottom: 1, left: 0, right: 0 });
            y += h;
        }
        // dentils under the top course
        const nd = Math.floor((u1 - u0) / 1.0);
        for (let i = 0; i < nd; i++) {
            const du = u0 + 0.3 + i * ((u1 - u0 - 0.6) / nd);
            box(opa, W, du, du + 0.4, tFace - 0.34, tFace, y0 - 0.42, y0 - 0.04, dentilC, { front: 1, bottom: 1, left: 1, right: 1, top: 0 });
        }
        return y;
    }
    // balustrade parapet: posts with gaps, capped rail
    function balustrade(opa, W, u0, u1, tFace, y0, h, c) {
        box(opa, W, u0, u1, tFace - 0.3, tFace, y0, y0 + 0.22, c, { front: 1, top: 1, left: 1, right: 1 });       // base rail
        box(opa, W, u0, u1, tFace - 0.3, tFace, y0 + h - 0.24, y0 + h, c, { front: 1, top: 1, left: 1, right: 1 }); // cap rail
        const n = Math.floor((u1 - u0) / 0.85);
        for (let i = 0; i < n; i++) {
            const du = u0 + 0.25 + i * ((u1 - u0 - 0.5) / n);
            box(opa, W, du, du + 0.28, tFace - 0.26, tFace - 0.02, y0 + 0.22, y0 + h - 0.24, c, { front: 1, back: 1, left: 1, right: 1 });
        }
    }

    // ============================ FERRY BUILDING =========================
    // 1912, Alex Wiseman. Edwardian Baroque: banded-rusticated arched arcade at
    // street level, a piano nobile of tall keystoned arched windows between
    // pilasters, a heavy modillion cornice, a red-brick attic storey with a
    // stone balustrade, projecting end pavilions and a central pedimented bay,
    // and a copper-cupola clock tower at the east end. Cream Oamaru-stone
    // dressings over red brick. (Street View, Quay St frontage, facing north.)
    function ferryBuilding(id, ringStr) {
        const { L, D, W } = frameFromRing(ringStr, 'south');   // grand facade faces the plaza / Quay St
        const opa = bucket(), gla = bucket();

        // Palette from Street View: warm ochre Oamaru stone for the arcade,
        // the giant-order piano nobile and every dressing; red brick only on
        // the upper storey and the tower shaft; white multi-pane sashes.
        const stone = col('#bfa274'), stoneHi = col('#cdb488'), stoneSh = col('#a5885c');
        const brick = col('#9c5a45'), brickSh = col('#8a4f3c');
        const white = col('#d8d2c4'), granite = col('#726d64');
        const skyC = col('#a9c0cf'), sillC = col('#2a3138'), glassDk = col('#2c333b');
        const gold = col('#c7a24e'), lead = col('#6b6f6f');

        // storey lines (metres above plinth)
        const Y_PLINTH = 1.0, Y_ARC = 7.0, Y_NOB = 16.6, Y_BAND = 17.0,
              Y_BRICK = 21.2, Y_CORN = 22.5, Y_PARA = 24.0, Y_PENT = 25.4;

        // solid ochre body up to the brick storey; brick body above it
        box(opa, W, 0, L, 0, D, 0, Y_BAND, stone, { front: 0, back: 1, left: 1, right: 1, top: 0 });
        box(opa, W, 0, L, 0, D, Y_BAND, Y_CORN, brickSh, { front: 0, back: 1, left: 1, right: 1, top: 0 });
        // dummy legacy names so the untouched tail refers to something valid
        const cream = stone, creamHi = stoneHi, creamSh = stoneSh, copper = lead, slate = lead;
        const H_ARCADE = Y_ARC, H_NOBILE = Y_NOB, H_CORN = Y_CORN, H_ATTIC = Y_BRICK, H_PARA = Y_PARA;
        void (H_ARCADE + H_NOBILE + H_CORN + H_ATTIC + H_PARA + creamSh.r + copper.r + slate.r);

        // ============ rebuilt facade (ignores the legacy loop below) =======
        const NB = Math.max(9, Math.round(L / 6.0)), bw = L / NB;
        const towerBay = Math.round(NB * 0.30);      // campanile sits west-of-centre
        const lunBay = Math.round(NB * 0.52);        // central relieving-arch bay
        const eastPav = NB - 1;                      // squared corner pavilion

        // granite plinth
        box(opa, W, -0.25, L + 0.25, -0.05, 0.5, 0, Y_PLINTH, granite, { front: 1, left: 1, right: 1, top: 1 });

        for (let i = 0; i < NB; i++) {
            const u0 = i * bw + 0.35, u1 = (i + 1) * bw - 0.35, uc = (u0 + u1) / 2;
            const proj = (i === eastPav || i === 0) ? -0.5 : 0;   // end pavilions project

            // -- ground: rusticated round-arched arcade --------------------
            // banded-rusticated piers (two stone tones stacked)
            for (const [pu0, pu1] of [[u0 - 0.35, u0 + 0.1], [u1 - 0.1, u1 + 0.35]]) {
                for (let b = 0; b < 6; b++) {
                    const yy = Y_PLINTH + b * ((Y_ARC - Y_PLINTH) / 6);
                    box(opa, W, pu0, pu1, proj, proj + 0.55, yy, yy + ((Y_ARC - Y_PLINTH) / 6) - 0.06, b % 2 ? stone : stoneSh, { front: 1, left: 1, right: 1 });
                }
            }
            const gy0 = Y_PLINTH + 0.2, gspring = Y_ARC - (u1 - u0) / 2 - 0.2;
            windowRect(opa, gla, W, u0 + 0.15, u1 - 0.15, proj + 0.32, gy0, gspring, 0.55, stoneSh, skyC, col('#181008'));
            archHead(opa, gla, W, u0 + 0.15, u1 - 0.15, proj + 0.32, gspring, 0.55, stone, col('#22160c'));
            box(opa, W, uc - 0.3, uc + 0.3, proj - 0.14, proj + 0.22, gspring + (u1 - u0) / 2 - 0.5, Y_ARC - 0.1, stoneHi, { front: 1, left: 1, right: 1, top: 1 }); // keystone

            // string course over the arcade
            box(opa, W, u0 - 0.5, u1 + 0.5, proj - 0.14, proj + 0.12, Y_ARC, Y_ARC + 0.5, stoneHi, { front: 1, top: 1, bottom: 1 });

            // -- piano nobile: GIANT ORDER pilasters + tall windows --------
            for (const pu of [u0 - 0.2, u1 - 0.4]) {   // engaged pilaster each side of the bay
                box(opa, W, pu, pu + 0.6, proj, proj + 0.4, Y_ARC + 0.5, Y_NOB - 0.6, stone, { front: 1, left: 1, right: 1 });
                box(opa, W, pu - 0.12, pu + 0.72, proj, proj + 0.5, Y_NOB - 0.6, Y_NOB - 0.1, stoneHi, { front: 1, left: 1, right: 1, top: 1 }); // capital
                box(opa, W, pu - 0.1, pu + 0.7, proj, proj + 0.48, Y_ARC + 0.5, Y_ARC + 1.0, stoneHi, { front: 1, left: 1, right: 1 });          // base
            }
            const ny0 = Y_ARC + 1.6, nyH = Y_NOB - 1.4;
            if (i === lunBay || i === lunBay + 1) {
                // central relieving arch / lunette spanning the middle bays
                windowRect(opa, gla, W, u0 + 0.3, u1 - 0.3, proj + 0.3, ny0, nyH - (u1 - u0) / 2, 0.5, stone, skyC, sillC);
                archHead(opa, gla, W, u0 + 0.3, u1 - 0.3, proj + 0.3, nyH - (u1 - u0) / 2, 0.5, stoneHi, skyC);
                box(opa, W, uc - 0.26, uc + 0.26, proj - 0.12, proj + 0.2, nyH - 0.6, nyH + 0.3, stoneHi, { front: 1, left: 1, right: 1, top: 1 });
            } else {
                windowRect(opa, gla, W, u0 + 0.35, u1 - 0.35, proj + 0.3, ny0, nyH, 0.45, white, skyC, sillC);
                // alternating pediment over the window head
                const pu0 = u0 + 0.05, pu1 = u1 - 0.05, ph = 1.0;
                box(opa, W, pu0, pu1, proj - 0.1, proj + 0.14, nyH, nyH + 0.28, stoneHi, { front: 1, top: 1, bottom: 1 }); // cornice base
                if (i % 2 === 0) {  // triangular
                    for (let s = 0; s < 5; s++) {
                        const f = s / 5, a0 = pu0 + (pu1 - pu0) * 0.5 * f, a1 = pu1 - (pu1 - pu0) * 0.5 * f;
                        box(opa, W, a0, a1, proj - 0.08, proj + 0.1, nyH + 0.28 + f * ph, nyH + 0.28 + f * ph + 0.24, stone, { front: 1, top: 1 });
                    }
                } else {            // segmental
                    for (let s = 0; s <= 5; s++) {
                        const f = s / 5, y = nyH + 0.28 + Math.sin(f * Math.PI) * ph * 0.7;
                        const a0 = pu0 + (pu1 - pu0) * f, wseg = (pu1 - pu0) / 5;
                        box(opa, W, a0, a0 + wseg, proj - 0.08, proj + 0.1, y, y + 0.24, stone, { front: 1, top: 1 });
                    }
                }
                // sill + console brackets
                box(opa, W, u0 + 0.2, u1 - 0.2, proj - 0.06, proj + 0.14, ny0 - 0.35, ny0, stoneHi, { front: 1, top: 1, bottom: 1 });
            }

            // -- upper brick storey: paired white sash windows -------------
            if (i === 0 || i === eastPav) {   // stone quoins on the pavilions
                for (let b = 0; b < 5; b++) {
                    const yy = Y_BAND + b * ((Y_BRICK - Y_BAND) / 5);
                    box(opa, W, (i === 0 ? u0 - 0.35 : u1 - 0.15), (i === 0 ? u0 + 0.25 : u1 + 0.35), proj + 0.02, proj + 0.34, yy, yy + ((Y_BRICK - Y_BAND) / 10), stoneHi, { front: 1, left: 1, right: 1 });
                }
            }
            for (const wu of [uc - 1.05, uc + 0.15]) {   // a pair of sashes
                windowRect(opa, gla, W, wu, wu + 0.9, proj + 0.28, Y_BAND + 0.7, Y_BRICK - 0.7, 0.3, white, skyC, sillC);
                box(opa, W, wu - 0.15, wu + 1.05, proj - 0.05, proj + 0.14, Y_BAND + 0.4, Y_BAND + 0.7, stoneHi, { front: 1, top: 1, bottom: 1 });   // stone sill
                box(opa, W, wu - 0.15, wu + 1.05, proj - 0.05, proj + 0.14, Y_BRICK - 0.7, Y_BRICK - 0.42, stoneHi, { front: 1, top: 1, bottom: 1 }); // stone lintel
            }
        }

        // heavy modillion cornice, then a solid panelled parapet
        cornice(opa, W, -0.5, L + 0.5, -0.2, Y_CORN, 3, stoneHi, stoneSh);
        box(opa, W, -0.3, L + 0.3, -0.35, -0.02, Y_PARA, Y_PARA + 1.4, stone, { front: 1, back: 1, top: 1, left: 1, right: 1 });
        for (let i = 0; i < NB; i++) {  // recessed panels in the parapet
            const u0 = i * bw + 0.6, u1 = (i + 1) * bw - 0.6;
            box(opa, W, u0, u1, -0.38, -0.34, Y_PARA + 0.25, Y_PARA + 1.15, stoneSh, { front: 1 });
        }

        // set-back modern dark-glass penthouse behind the parapet
        {
            const setback = 2.6, y0 = Y_CORN + 0.2, y1 = Y_PENT + 1.0;
            const a = W(1, setback, y0), b = W(L - 1, setback, y0), c = W(L - 1, setback, y1), d = W(1, setback, y1);
            v(gla, a, glassDk); v(gla, b, glassDk); v(gla, c, col('#3c4a54')); v(gla, a, glassDk); v(gla, c, col('#3c4a54')); v(gla, d, col('#3c4a54'));
            box(opa, W, 0.8, L - 0.8, setback, setback + 0.25, y1, y1 + 0.4, lead, { front: 1, top: 1 }); // capping
            // mullions
            for (let u = 3; u < L - 2; u += 3.2) box(opa, W, u, u + 0.12, setback - 0.04, setback + 0.02, y0, y1, lead, { front: 1 });
        }

        // ================= CAMPANILE (west-of-centre) ======================
        {
            const tcu = towerBay * bw + bw / 2, tw = 6.6, tu0 = tcu - tw / 2, tu1 = tcu + tw / 2;
            const tFront = -0.4, tBack = D * 0.5;    // projects only slightly past the facade
            const S0 = Y_CORN, S1 = S0 + 9.0, S2 = S1 + 4.6, S3 = S2 + 1.4; // shaft rises from the cornice; belfry; parapet
            // brick shaft with stone quoins
            box(opa, W, tu0, tu1, tFront, tBack, S0, S1, brick, { front: 1, back: 1, left: 1, right: 1, top: 0 });
            for (let b = 0; b < 7; b++) {
                const yy = S0 + b * ((S1 - S0) / 7);
                box(opa, W, tu0, tu0 + 0.55, tFront - 0.02, tBack, yy, yy + ((S1 - S0) / 14), stoneHi, { front: 1, left: 1 });
                box(opa, W, tu1 - 0.55, tu1, tFront - 0.02, tBack, yy, yy + ((S1 - S0) / 14), stoneHi, { front: 1, right: 1 });
            }
            // stone belfry stage with paired pilasters + clock faces (front + west side)
            box(opa, W, tu0 - 0.3, tu1 + 0.3, tFront - 0.15, tBack + 0.15, S1, S2, stone, { front: 1, back: 1, left: 1, right: 1, top: 1 });
            const clock = (cx3, cz3, faceT) => {
                const cy = (S1 + S2) / 2, rad = 1.35, fc = col('#20201c');
                let prev = null;
                for (let s = 0; s <= 16; s++) {
                    const a = (s / 16) * Math.PI * 2;
                    const u = tcu + rad * Math.cos(a), y = cy + rad * Math.sin(a);
                    if (prev) { v(opa, W(tcu, faceT, cy), fc); v(opa, W(prev.u, faceT, prev.y), fc); v(opa, W(u, faceT, y), fc); }
                    prev = { u, y };
                }
                box(opa, W, tcu - 0.05, tcu + 0.05, faceT - 0.04, faceT, cy, cy + rad * 0.72, gold, { front: 1 });
                box(opa, W, tcu - 0.04, tcu + rad * 0.5, faceT - 0.04, faceT, cy - 0.04, cy + 0.04, gold, { front: 1 });
            };
            clock(0, 0, tFront - 0.17);   // front (harbour) face
            // pilasters framing the belfry
            for (const pu of [tu0 - 0.1, tu1 - 0.4]) box(opa, W, pu, pu + 0.5, tFront - 0.28, tFront - 0.1, S1, S2, stoneHi, { front: 1, left: 1, right: 1 });
            // cornice + parapet with corner pinnacles
            cornice(opa, W, tu0 - 0.4, tu1 + 0.4, tFront - 0.3, S2, 2, stoneHi, stoneSh);
            box(opa, W, tu0 - 0.2, tu1 + 0.2, tFront - 0.2, tBack + 0.2, S2 + 0.7, S3, stone, { front: 1, back: 1, left: 1, right: 1, top: 1 });
            for (const pu of [tu0 - 0.2, tu1 - 0.4]) box(opa, W, pu, pu + 0.6, tFront - 0.25, tFront + 0.35, S3, S3 + 1.0, stoneHi, { front: 1, back: 1, left: 1, right: 1, top: 1 }); // pinnacles
            // small pyramidal lead cap + flag mast
            {
                const cx3 = tcu, cz3 = (tFront + tBack) / 2, base = S3, apex = S3 + 2.6, r = tw / 2 - 0.1;
                const corners = [[tu0 - 0.1, tFront - 0.1], [tu1 + 0.1, tFront - 0.1], [tu1 + 0.1, tBack + 0.1], [tu0 - 0.1, tBack + 0.1]];
                for (let k = 0; k < 4; k++) {
                    const a = corners[k], b = corners[(k + 1) % 4];
                    v(opa, W(a[0], a[1], base), lead); v(opa, W(b[0], b[1], base), lead); v(opa, W(cx3, cz3, apex), lead);
                }
                box(opa, W, cx3 - 0.06, cx3 + 0.06, cz3 - 0.06, cz3 + 0.06, apex, apex + 3.2, col('#3a3a38'), { front: 1, back: 1, left: 1, right: 1, top: 1 }); // flag mast
                box(opa, W, cx3 - 0.02, cx3 + 0.9, cz3 - 0.02, cz3 + 0.02, apex + 2.2, apex + 3.0, gold, { front: 1, back: 1 }); // weathervane arm
            }
        }

        // legacy body block kept but hidden under the rebuilt facade
        box(opa, W, 0, 0.001, 0, 0.001, 0, 0.001, stone, { front: 1 });
        if (false) {

        // granite plinth
        box(opa, W, -0.2, L + 0.2, 0, 0.35, 0, 0.9, granite, { front: 1, left: 1, right: 1, top: 1 });

        // --- bay rhythm along the frontage -------------------------------
        // 13 bays; ends (0 and 12) are projecting pavilions, bay 6 is the
        // pedimented entrance. The east pavilion carries the tower.
        const NB = 13, bw = L / NB;
        const pav = new Set([0, 12]);
        for (let i = 0; i < NB; i++) {
            const u0 = i * bw + 0.5, u1 = (i + 1) * bw - 0.5, uc = (u0 + u1) / 2;
            const isPav = pav.has(i);
            const tFront = isPav ? -0.6 : 0;   // pavilions project toward the street

            // ground arcade: a big round-arched opening (banded rustication read
            // via two-tone courses on the pier)
            box(opa, W, u0 - 0.35, u0 + 0.15, tFront, tFront + 0.6, 0.9, H_ARCADE, creamSh, { front: 1, left: 1, right: 1 }); // pier L
            box(opa, W, u1 - 0.15, u1 + 0.35, tFront, tFront + 0.6, 0.9, H_ARCADE, creamSh, { front: 1, left: 1, right: 1 }); // pier R
            windowRect(opa, gla, W, u0 + 0.2, u1 - 0.2, tFront + 0.35, 1.1, H_ARCADE - 1.3, 0.5, granite, skyC, col('#20130c'));
            archHead(opa, gla, W, u0 + 0.2, u1 - 0.2, tFront + 0.35, H_ARCADE - 1.3, 0.5, cream, skyC);
            // keystone
            box(opa, W, uc - 0.28, uc + 0.28, tFront - 0.12, tFront + 0.2, H_ARCADE - 1.3 + (u1 - u0 - 0.4) / 2 - 0.5, H_ARCADE - 0.2, creamHi, { front: 1, left: 1, right: 1, top: 1 });

            // string course over the arcade
            box(opa, W, u0 - 0.6, u1 + 0.6, tFront - 0.12, tFront + 0.1, H_ARCADE, H_ARCADE + 0.5, creamHi, { front: 1, top: 1, bottom: 1 });

            // piano nobile: tall round-arched window between pilasters
            box(opa, W, u0 - 0.3, u0 + 0.1, tFront, tFront + 0.35, H_ARCADE + 0.5, H_NOBILE, creamSh, { front: 1, left: 1, right: 1 });
            box(opa, W, u1 - 0.1, u1 + 0.3, tFront, tFront + 0.35, H_ARCADE + 0.5, H_NOBILE, creamSh, { front: 1, left: 1, right: 1 });
            const wy0 = H_ARCADE + 1.4, wspring = H_NOBILE - 1.6;
            windowRect(opa, gla, W, u0 + 0.25, u1 - 0.25, tFront + 0.28, wy0, wspring, 0.45, cream, skyC, sillC);
            archHead(opa, gla, W, u0 + 0.25, u1 - 0.25, tFront + 0.28, wspring, 0.45, creamHi, skyC);
            box(opa, W, uc - 0.24, uc + 0.24, tFront - 0.1, tFront + 0.18, wspring + (u1 - u0 - 0.5) / 2 - 0.4, H_NOBILE - 0.1, creamHi, { front: 1, left: 1, right: 1, top: 1 }); // keystone
            // sill
            box(opa, W, u0 + 0.1, u1 - 0.1, tFront - 0.08, tFront + 0.12, wy0 - 0.3, wy0, granite, { front: 1, top: 1, bottom: 1 });

            // attic storey: red brick with a small square window
            box(opa, W, u0 - 0.5, u1 + 0.5, tFront + 0.02, tFront + 0.28, H_CORN, H_ATTIC, (i % 2 ? brick : brickSh), { front: 1 });
            windowRect(opa, gla, W, uc - 0.9, uc + 0.9, tFront + 0.28, H_CORN + 0.7, H_ATTIC - 0.7, 0.3, cream, skyC, sillC);

            if (i === 6) {
                // central entrance: pediment over the nobile
                const py = H_NOBILE + 0.1;
                for (let s = 0; s < 6; s++) {
                    const f = s / 6, uu0 = u0 - 1 + (L / NB) * 0 + (u1 - u0 + 2) * f * 0.5, uu1 = u1 + 1 - (u1 - u0 + 2) * f * 0.5;
                    box(opa, W, uu0, uu1, tFront - 0.15, tFront + 0.05, py + f * 2.2, py + f * 2.2 + 0.42, creamHi, { front: 1, top: 1 });
                }
            }
        }

        // continuous modillion cornice at the top of the nobile
        cornice(opa, W, -0.4, L + 0.4, -0.15, H_NOBILE, 3, creamHi, creamSh);
        // top cornice + balustrade over the attic
        cornice(opa, W, -0.4, L + 0.4, -0.15, H_ATTIC, 2, creamHi, creamSh);
        for (let i = 0; i < NB; i++) {
            const u0 = i * bw + 0.4, u1 = (i + 1) * bw - 0.4;
            if (pav.has(i) || i === 6) box(opa, W, u0, u1, -0.35, -0.05, H_PARA, H_PARA + 1.1, cream, { front: 1, back: 1, top: 1, left: 1, right: 1 }); // solid parapet blocks over pavilions/entry
            else balustrade(opa, W, u0, u1, -0.1, H_PARA, 1.0, creamHi);
        }

        // --- clock tower at the east pavilion ----------------------------
        const tu0 = L - bw - 0.5, tu1 = L + 0.3, tcu = (tu0 + tu1) / 2, tw = tu1 - tu0;
        const T0 = H_PARA + 1.1, T1 = T0 + 6.5, T2 = T1 + 5.5;   // brick shaft, clock stage, cupola base
        box(opa, W, tu0, tu1, -0.6, D * 0.6, T0, T1, brick, { front: 1, back: 1, left: 1, right: 1, top: 0 });
        // stone quoins on the tower corners
        for (let q = 0; q < 6; q++) {
            const yy = T0 + q * ((T1 - T0) / 6);
            box(opa, W, tu0, tu0 + 0.5, -0.62, D * 0.6, yy, yy + ((T1 - T0) / 12), creamHi, { front: 1, left: 1 });
            box(opa, W, tu1 - 0.5, tu1, -0.62, D * 0.6, yy, yy + ((T1 - T0) / 12), creamHi, { front: 1, right: 1 });
        }
        // clock stage: cream, a clock face on the front
        box(opa, W, tu0 - 0.2, tu1 + 0.2, -0.7, D * 0.6, T1, T2, creamHi, { front: 1, back: 1, left: 1, right: 1, top: 1 });
        // clock face (dark disc via an octagon) + gold rim
        {
            const cy = (T1 + T2) / 2, rad = Math.min(1.5, tw * 0.35), fc = col('#1c1c20');
            let prev = null;
            for (let s = 0; s <= 16; s++) {
                const a = (s / 16) * Math.PI * 2, u = tcu + rad * Math.cos(a), y = cy + rad * Math.sin(a);
                if (prev) { v(opa, W(tcu, -0.72, cy), fc); v(opa, W(prev.u, -0.72, prev.y), fc); v(opa, W(u, -0.72, y), fc); }
                prev = { u, y };
            }
            // hands
            box(opa, W, tcu - 0.06, tcu + 0.06, -0.75, -0.72, cy, cy + rad * 0.7, gold, { front: 1 });
            box(opa, W, tcu - 0.05, tcu + rad * 0.5, -0.75, -0.72, cy - 0.05, cy + 0.05, gold, { front: 1 });
        }
        // copper cupola: a stepped, tapering lantern topped by a small dome + finial
        box(opa, W, tu0 - 0.4, tu1 + 0.4, -0.9, D * 0.6 + 0.3, T2, T2 + 0.6, creamHi, { front: 1, back: 1, left: 1, right: 1, top: 1 }); // cornice ring
        box(opa, W, tu0 + 0.5, tu1 - 0.5, -0.3, D * 0.6 - 0.3, T2 + 0.6, T2 + 3.4, copper, { front: 1, back: 1, left: 1, right: 1, top: 0 }); // lantern
        // dome via lathe-ish rings
        {
            const domeBase = T2 + 3.4, domeH = 2.6, cu = tcu, cd = (-0.3 + D * 0.6 - 0.3) / 2, rad = tw * 0.42;
            let prevY = domeBase, prevR = rad;
            for (let s = 1; s <= 5; s++) {
                const f = s / 5, y = domeBase + Math.sin(f * Math.PI / 2) * domeH, rr = rad * Math.cos(f * Math.PI / 2);
                for (let a = 0; a < 10; a++) {
                    const a0 = (a / 10) * Math.PI * 2, a1 = ((a + 1) / 10) * Math.PI * 2;
                    const p0 = W(cu + prevR * Math.cos(a0), cd + prevR * Math.sin(a0) + D * 0.15, prevY);
                    const p1 = W(cu + prevR * Math.cos(a1), cd + prevR * Math.sin(a1) + D * 0.15, prevY);
                    const p2 = W(cu + rr * Math.cos(a1), cd + rr * Math.sin(a1) + D * 0.15, y);
                    const p3 = W(cu + rr * Math.cos(a0), cd + rr * Math.sin(a0) + D * 0.15, y);
                    quad(opa, p0, p1, p2, p3, copper);
                }
                prevY = y; prevR = rr;
            }
            // finial
            box(opa, W, cu - 0.12, cu + 0.12, cd + D * 0.15 - 0.12, cd + D * 0.15 + 0.12, domeBase + domeH, domeBase + domeH + 1.4, gold, { front: 1, back: 1, left: 1, right: 1, top: 1 });
        }

        } // end legacy (disabled) facade block

        // --- assemble: opaque + glass, two meshes, one part ---------------
        const g = new THREE.Group();
        const mkMesh = (bk, mat, name) => {
            const geo = new THREE.BufferGeometry();
            geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(bk.pos), 3));
            geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(bk.col), 3));
            geo.computeVertexNormals();
            const m = new THREE.Mesh(geo, mat); m.name = name; return m;
        };
        g.add(mkMesh(opa, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0.02, side: THREE.DoubleSide }), 'ferry_stone'));
        const glassM = mkMesh(gla, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.16, metalness: 0.1, side: THREE.DoubleSide }), 'ferry_glass');
        g.add(glassM); world.ghost(glassM);
        g.name = 'ferrybuilding';
        scene.add(g);
        world.part('ferrybuilding_00', g);
        return (opa.pos.length + gla.pos.length) / 9;
    }

    // registry of landmark builders keyed by OSM id + its footprint ring
    const RINGS = {
        'w23904427': '240,-650 229,-653 214,-658 207,-661 180,-669 184,-682 185,-683 233,-667 245,-663 240,-650',
    };
    let tris = 0;
    tris += ferryBuilding('w23904427', RINGS['w23904427']);
    // each bespoke landmark module plants itself on the terrain via the shim
    for (const m of LANDMARK_MODULES) {
        try { m.build(world); } catch (e) { /* one landmark never takes the rest down */ }
    }
    // dress Queen Street itself: footpaths, kerbs, cycle lanes, crossings
    try { buildQueenStreetDetail(world); } catch (e) { /* additive */ }
    return { landmarks: QUEEN_DETAILED.size, tris };
}

export { buildQueenLandmarks };
