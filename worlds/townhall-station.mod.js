//
//  townhall-station.mod.js
//  The Metro Tunnel station, verbatim.
//
//  This file is a copy. Lines 70-3537 of state-library-station_29.html — the
//  whole world module, its texture helpers, the HCMT and `build(world)` — are
//  reproduced here without a character changed, and the only additions are
//  this comment and the export at the foot.
//
//  It is a copy on purpose. The first attempt at bringing this station into
//  the city rewrote it: same station, said again in the host file's idiom,
//  its own arrays and its own vertex colours. That threw away three days of
//  somebody's work to save a few draw calls, which is a bad trade and was not
//  what was asked for. Anything that has to bend to live down there —
//  the lights, the fog, the environment map, the scene it adds to — is bent
//  by the caller in section 29, not by editing a line of this.
//
//  Not named `.scene.js`, because it is not a world on its own: the manifest
//  and the smoke test both key off that suffix, and this is a module the
//  Flinders & Swanston scene imports.
//

// ---- the world module -------------------------------------------------------
// Melbourne HCMT (High Capacity Metro Train) — exterior model, 7 cars.
// Built in metres, y-up, railhead at y=0, running along z, centred at origin.

const C = {
    paleBlue: '#A8CBE8',
    charcoal: '#3A3C3E',
    navy:     '#1B3F7A',
    mid:      '#2E6DB4',
    cyan:     '#47A8D8',
    yellow:   '#F7B500',
    silver:   '#C9CCCE',
    body:     '#B9B6AF',    // warm metallic silver / champagne (daylight)
    bodyHi:   '#CFCCC4',
    bodyLo:   '#A29F98',
    doorBlue: '#79BEE4',    // light sky blue passenger doors
    win:      '#131415',
    skirt:    '#2b2d2f',
    dark:     '#232527'
};

const CAR_L = 22, CAR_W = 3.05, GAP = 0.6, NOSE_L = 3.4;
const SIDE_X = 1.528;          // side plane offset
const SIDE_Y0 = 0.83, SIDE_Y1 = 3.08;   // side plane vertical extent
const ROOF_Y0 = 2.95, ROOF_Y1 = 3.68;

// interior datum
const FLOOR_Y = 1.0, CEIL_Y = 2.93;   // ceiling sits below the roof-shell soffit (y=2.95)
const DOOR_W = 1.7, LEAF_W = 0.85, LEAF_H = 2.1, LEAF_TRAVEL = 0.8;
const DOOR_TOP = 2.80;          // top of the real opening

// side layouts (module scope: used by the texture, the geometry AND HCMT_DOORS)
const cabBodyL = CAR_L - NOSE_L; // 18.6 m
const midLayout = {
    L: CAR_L, doorW: DOOR_W,
    blue: [[0, 2.0], [20.4, 22]],
    doors: [2.3, 10.0, 16.9],
    windows: [[5.0, 6.4], [7.1, 8.5], [12.2, 13.6], [14.3, 15.7], [19.0, 20.0]]
};
const cabLayout = {
    L: cabBodyL, doorW: DOOR_W,
    blue: [[0, 1.9], [17.4, 18.6]],
    doors: [2.1, 8.7, 14.4],
    windows: [[4.6, 5.9], [6.6, 7.9], [10.8, 12.1], [12.7, 14.0], [16.4, 17.2]]
};
const CAB_BODY_CZ = (-CAR_L / 2 + (CAR_L / 2 - NOSE_L)) / 2; // -1.7/... = -1.5

// door centres in body-plane-local z (u=0 of the side texture sits at +bodyL/2)
function doorCentresLocal(layout) {
    return layout.doors.map(d => layout.L / 2 - (d + layout.doorW / 2));
}

// door-centre z list, train-local, one side, sorted (21 doors)
const HCMT_DOORS = (() => {
    const pitch = CAR_L + GAP;
    const midC = doorCentresLocal(midLayout);              // car-local (mid body centred at 0)
    const cabC = doorCentresLocal(cabLayout).map(z => z + CAB_BODY_CZ); // car-local
    const all = [];
    for (let i = 0; i <= 6; i++) {
        const off = (3 - i) * pitch;
        if (i === 0) { for (const z of cabC) all.push(off + z); }        // front cab, nose +z
        else if (i === 6) { for (const z of cabC) all.push(off - z); }   // rear cab, rotated pi
        else { for (const z of midC) all.push(off + z); }
    }
    all.sort((a, b) => a - b);
    return { doorWidth: DOOR_W, all };
})();

// ---------------------------------------------------------------------------
// small helpers
function mulberry(seed) {
    let a = seed >>> 0;
    return function () {
        a |= 0; a = (a + 0x6D2B79F5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function mergeGeoms(THREE, items) {
    const pos = [], nor = [], uv = [];
    const nm = new THREE.Matrix3();
    const v = new THREE.Vector3();
    for (const it of items) {
        const g = it.geo.index ? it.geo.toNonIndexed() : it.geo;
        const p = g.attributes.position, no = g.attributes.normal, u = g.attributes.uv;
        nm.getNormalMatrix(it.m);
        for (let i = 0; i < p.count; i++) {
            v.fromBufferAttribute(p, i).applyMatrix4(it.m); pos.push(v.x, v.y, v.z);
            v.fromBufferAttribute(no, i).applyMatrix3(nm).normalize(); nor.push(v.x, v.y, v.z);
            if (u) uv.push(u.getX(i), u.getY(i)); else uv.push(0, 0);
        }
        if (g !== it.geo) g.dispose();
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    return g;
}

function mat4(THREE, x, y, z, rx, ry, rz, sx, sy, sz) {
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(rx || 0, ry || 0, rz || 0));
    m.compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(sx || 1, sy || 1, sz || 1));
    return m;
}

// quad from 4 corners (CCW seen from outside), uv per corner [[u,v]x4]
function quadGeo(THREE, a, b, c, d, uvs) {
    const g = new THREE.BufferGeometry();
    const p = [].concat(a, b, c, a, c, d);
    const U = uvs || [[0, 0], [1, 0], [1, 1], [0, 1]];
    const uv = [].concat(U[0], U[1], U[2], U[0], U[2], U[3]);
    g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.computeVertexNormals();
    return g;
}

function triGeo(THREE, a, b, c) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([].concat(a, b, c), 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1], 2));
    g.computeVertexNormals();
    return g;
}

function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
}

// faceted blue vinyl (angular triangles in navy / mid / cyan)
function drawFacets(ctx, x0, y0, w, h, seed) {
    const rnd = mulberry(seed);
    ctx.save();
    ctx.beginPath(); ctx.rect(x0, y0, w, h); ctx.clip();
    ctx.fillStyle = C.mid; ctx.fillRect(x0, y0, w, h);
    const cols = 3, rows = 4;
    const pts = [];
    for (let j = 0; j <= rows; j++) {
        pts.push([]);
        for (let i = 0; i <= cols; i++) {
            let px = x0 + (i / cols) * w, py = y0 + (j / rows) * h;
            if (i > 0 && i < cols) px += (rnd() - 0.5) * w * 0.42;
            if (j > 0 && j < rows) py += (rnd() - 0.5) * h * 0.42;
            pts[j].push([px, py]);
        }
    }
    const pal = [C.mid, C.navy, C.mid, C.cyan, '#3d84c4', '#63b6dd', '#255a9c', C.cyan];
    for (let j = 0; j < rows; j++) {
        for (let i = 0; i < cols; i++) {
            const A = pts[j][i], B = pts[j][i + 1], D = pts[j + 1][i], E = pts[j + 1][i + 1];
            ctx.fillStyle = pal[(rnd() * pal.length) | 0];
            ctx.beginPath(); ctx.moveTo(A[0], A[1]); ctx.lineTo(B[0], B[1]); ctx.lineTo(D[0], D[1]); ctx.closePath(); ctx.fill();
            ctx.fillStyle = pal[(rnd() * pal.length) | 0];
            ctx.beginPath(); ctx.moveTo(B[0], B[1]); ctx.lineTo(E[0], E[1]); ctx.lineTo(D[0], D[1]); ctx.closePath(); ctx.fill();
        }
    }
    ctx.restore();
}

// ---------------------------------------------------------------------------
// side livery texture
// layout: { L, blue:[[a,b],...], doors:[x...], doorW, windows:[[a,b],...], number, numberX }
function makeSideTex(canvasTexture, layout, mirror, seed) {
    const S = 96;
    const W = Math.round(layout.L * S), H = Math.round((SIDE_Y1 - SIDE_Y0) * S);
    const Y = m => (SIDE_Y1 - m) * S;
    const X = m => m * S;
    return canvasTexture(W, H, (ctx) => {
        ctx.save();
        if (mirror) { ctx.translate(W, 0); ctx.scale(-1, 1); }

        // base: warm metallic silver / champagne with a vertical sheen
        const g = ctx.createLinearGradient(0, 0, 0, H);
        g.addColorStop(0, C.bodyHi); g.addColorStop(0.3, C.body);
        g.addColorStop(0.72, '#AEABA4'); g.addColorStop(1, C.bodyLo);
        ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

        // blue faceted end wraps (cab ends keep the full wrap; mid ends modest)
        let si = 0;
        for (const z of layout.blue) {
            drawFacets(ctx, X(z[0]), Y(2.95), X(z[1]) - X(z[0]), Y(0.83) - Y(2.95), seed + 17 * (si++));
        }

        // pale roof band along the top
        const rg = ctx.createLinearGradient(0, 0, 0, Y(2.88));
        rg.addColorStop(0, C.paleBlue); rg.addColorStop(0.85, C.paleBlue); rg.addColorStop(1, '#8fb4d4');
        ctx.fillStyle = rg; ctx.fillRect(0, 0, W, Y(2.88));

        // windows — INDIVIDUAL rounded black bezels on the silver body,
        // glazing fully cut out (alpha 0); a separate tinted glass plane sits behind
        for (const wz of layout.windows) {
            const x0 = X(wz[0]), x1 = X(wz[1]);
            roundRect(ctx, x0 - 8, Y(2.86), (x1 - x0) + 16, Y(1.66) - Y(2.86), 14);
            ctx.fillStyle = '#131516'; ctx.fill();
            ctx.save();
            roundRect(ctx, x0, Y(2.80), x1 - x0, Y(1.72) - Y(2.80), 9);
            ctx.clip();
            ctx.clearRect(x0 - 2, Y(2.80) - 2, (x1 - x0) + 4, Y(1.72) - Y(2.80) + 4);
            ctx.restore();
        }

        // subtle horizontal panel seams on the silver body (UNDER the door frame)
        ctx.strokeStyle = 'rgba(60,58,52,0.30)'; ctx.lineWidth = 1;
        for (const sy of [1.20, 1.98, 2.90]) {
            ctx.beginPath(); ctx.moveTo(0, Y(sy) + 0.5); ctx.lineTo(W, Y(sy) + 0.5); ctx.stroke();
        }
        ctx.strokeStyle = 'rgba(255,255,255,0.18)';
        for (const sy of [1.20, 1.98, 2.90]) {
            ctx.beginPath(); ctx.moveTo(0, Y(sy) + 1.5); ctx.lineTo(W, Y(sy) + 1.5); ctx.stroke();
        }

        // doorways — a thick rounded-rect GOLDEN-YELLOW painted frame on the
        // body, a thin dark reveal inside it, then a real hole (alpha 0) with
        // steel blue-grey sliding leaf meshes behind. A black ribbed comb and a
        // bright metal sill lip close the gap under the leaves.
        const dw = layout.doorW;
        const P = m => X(m) - X(0);              // metres -> px (horizontal)
        for (const dx of layout.doors) {
            const x0 = X(dx), x1 = X(dx + dw);
            const fw = P(0.125);                 // frame band width
            // --- yellow frame, brighter at the top, weathered toward the base
            const fyT = Y(2.96), fyB = Y(0.86);
            const fg = ctx.createLinearGradient(0, fyT, 0, fyB);
            fg.addColorStop(0.00, '#FFD630');
            fg.addColorStop(0.16, '#FBC81C');
            fg.addColorStop(0.60, '#EFB714');
            fg.addColorStop(0.88, '#D8A312');
            fg.addColorStop(1.00, '#BC8D14');
            roundRect(ctx, x0 - fw, fyT, (x1 - x0) + 2 * fw, fyB - fyT, P(0.20));
            ctx.fillStyle = fg; ctx.fill();
            // faint vertical grime streaks on the lower half of the frame
            ctx.save();
            roundRect(ctx, x0 - fw, fyT, (x1 - x0) + 2 * fw, fyB - fyT, P(0.20));
            ctx.clip();
            const rnd = mulberry(seed + Math.round(dx * 31));
            for (let i = 0; i < 14; i++) {
                ctx.fillStyle = 'rgba(90,70,20,' + (0.05 + rnd() * 0.09).toFixed(3) + ')';
                const sx = x0 - fw + rnd() * ((x1 - x0) + 2 * fw);
                ctx.fillRect(sx, Y(1.9), 1 + rnd() * 3, Y(0.86) - Y(1.9));
            }
            ctx.restore();

            // --- dark reveal / shadow gap just inside the frame
            roundRect(ctx, x0 - P(0.014), Y(2.836), (x1 - x0) + P(0.028),
                Y(0.94) - Y(2.836), P(0.132));
            ctx.fillStyle = '#22262a'; ctx.fill();

            // --- cut the real opening (rounded, so the frame hides leaf corners)
            ctx.save();
            roundRect(ctx, x0 + P(0.016), Y(2.796), (x1 - x0) - P(0.032),
                Y(1.045) - Y(2.796), P(0.118));
            ctx.clip();
            ctx.clearRect(x0 - 4, Y(2.80) - 4, (x1 - x0) + 8, Y(1.04) - Y(2.80) + 8);
            ctx.restore();

            // --- black ribbed comb threshold (fine vertical teeth)
            const cy0 = Y(1.055), cy1 = Y(0.945);
            ctx.fillStyle = '#111315';
            ctx.fillRect(x0 - P(0.015), cy0, (x1 - x0) + P(0.03), cy1 - cy0);
            const step = Math.max(2, P(0.012));
            for (let tx = x0 - P(0.01); tx < x1 + P(0.01); tx += step) {
                ctx.fillStyle = 'rgba(186,184,172,0.82)';
                ctx.fillRect(tx, cy0 + 1, Math.max(1, step * 0.42), (cy1 - cy0) - 2);
            }
            ctx.fillStyle = 'rgba(0,0,0,0.5)';
            ctx.fillRect(x0 - P(0.015), cy0, (x1 - x0) + P(0.03), 2);

            // --- bright metal sill lip below the comb
            const sg = ctx.createLinearGradient(0, Y(0.945), 0, Y(0.900));
            sg.addColorStop(0, '#d6d9db'); sg.addColorStop(0.55, '#a9adb0'); sg.addColorStop(1, '#7c8083');
            ctx.fillStyle = sg;
            ctx.fillRect(x0 - P(0.008), Y(0.945), (x1 - x0) + P(0.016), Y(0.900) - Y(0.945));
        }

        ctx.restore();
        // car number (drawn unmirrored so text reads correctly)
        if (layout.number) {
            let nx = X(layout.numberX);
            if (mirror) nx = W - nx;
            ctx.fillStyle = '#4a4c4e';
            ctx.font = 'bold ' + Math.round(S * 0.22) + 'px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(layout.number, nx, Y(2.45));
        }
    });
}

// ---------------------------------------------------------------------------
// SMOOTH LOFTED NOSE — one continuous bullet slope from roofline to chin.
// Cross-section rings along z share their profile maths with the per-pixel
// texture painter, so livery regions land exactly on the 3D surface.
const NOSE = {
    zb: CAR_L / 2 - NOSE_L,   // 7.6  (bulkhead, matches body cross-section)
    len: NOSE_L + 0.1,        // ring run 7.6 -> 11.1
    rings: 34, around: 48, capT: 0.10, tMax: 1.10
};
function smoothstep(a, b, x) {
    x = Math.min(1, Math.max(0, (x - a) / (b - a)));
    return x * x * (3 - 2 * x);
}
// ONE shared convex easing drives BOTH the vertical drop and the plan taper,
// so the two convergences stay in step and the silhouette is a single clean
// bullet curve: a cosine arc (zero slope at the roof) blended with a
// superellipse term (steepening finish into the chin). Monotonic, convex,
// no inflection, no pinch.
const NOSE_TH = 1.35;
const NOSE_COS0 = 1 - Math.cos(NOSE_TH);
function noseEase(t) {
    const cosE = (1 - Math.cos(NOSE_TH * t)) / NOSE_COS0;
    const seE = 1 - Math.pow(1 - Math.pow(t, 2.6), 1 / 2.6);
    return 0.68 * cosE + 0.32 * seE;
}
// ring parameters at t in [0,1] (t=0 bulkhead, t=1 tip)
function noseProf(t) {
    const E = noseEase(t);
    const w = 1.522 - (1.522 - 0.62) * E;
    const y1 = 3.68 - (3.68 - 1.62) * E;
    const y0 = 0.83 - 0.31 * smoothstep(0.0, 0.6, t) + 0.12 * E * E * E;
    const r = Math.min(0.55 + 0.95 * E, w * 0.92, Math.max((y1 - y0) * 0.46, 0.06));
    const z = NOSE.zb + NOSE.len * t;
    const crown = 0.05 * (w / 1.522);
    return { w, y0, y1, r, z, crown, E };
}
// M equal-arc-length points around the ring (left-bottom over the top to right-bottom)
function noseRing(t, M) {
    const p = noseProf(t);
    const seg = [];
    seg.push([-p.w, p.y0]);
    seg.push([-p.w, p.y1 - p.r]);
    for (let i = 1; i <= 12; i++) {
        const a = Math.PI - (Math.PI / 2) * (i / 12);
        seg.push([-p.w + p.r + Math.cos(a) * p.r, p.y1 - p.r + Math.sin(a) * p.r]);
    }
    const flat = p.w - p.r;
    for (let i = 1; i <= 10; i++) {
        const x = -flat + (2 * flat) * (i / 10);
        seg.push([x, p.y1 + p.crown * Math.cos((x / (p.w || 1)) * 1.2)]);
    }
    for (let i = 1; i <= 12; i++) {
        const a = Math.PI / 2 - (Math.PI / 2) * (i / 12);
        seg.push([p.w - p.r + Math.cos(a) * p.r, p.y1 - p.r + Math.sin(a) * p.r]);
    }
    seg.push([p.w, p.y0]);
    // bottom closure run (keeps the nose watertight from every angle)
    for (let i = 1; i <= 8; i++) seg.push([p.w - (2 * p.w) * (i / 8), p.y0]);
    // cumulative arc length, resample to M points
    const cum = [0];
    for (let i = 1; i < seg.length; i++) {
        cum.push(cum[i - 1] + Math.hypot(seg[i][0] - seg[i - 1][0], seg[i][1] - seg[i - 1][1]));
    }
    const L = cum[cum.length - 1];
    const out = [];
    let si = 0;
    for (let j = 0; j < M; j++) {
        const d = (j / (M - 1)) * L;
        while (si < cum.length - 2 && cum[si + 1] < d) si++;
        const f = (d - cum[si]) / ((cum[si + 1] - cum[si]) || 1);
        out.push([seg[si][0] + (seg[si + 1][0] - seg[si][0]) * f,
                  seg[si][1] + (seg[si + 1][1] - seg[si][1]) * f]);
    }
    return out;
}
// ring + z at extended parameter t in [0, tMax]; t>1 folds the tip ring
// inward to a gently domed front face (real world-space cap, no UV smear)
function noseRingAt(t, M) {
    if (t <= 1) return { ring: noseRing(t, M), z: noseProf(t).z };
    const f = Math.min((t - 1) / NOSE.capT, 1);
    const p1 = noseProf(1);
    const base = noseRing(1, M);
    const cy = (p1.y0 + p1.y1) / 2;
    const s = Math.cos(f * Math.PI / 2);
    const ring = base.map(pt => [pt[0] * s, cy + (pt[1] - cy) * s]);
    return { ring, z: p1.z + 0.10 * Math.sin(f * Math.PI / 2) };
}
function noseGeometry(THREE) {
    const N = NOSE.rings, M = NOSE.around;
    const pos = [], uv = [], idx = [];
    for (let k = 0; k <= N; k++) {
        const t = (k / N) * NOSE.tMax;
        const R = noseRingAt(t, M);
        for (let j = 0; j < M; j++) {
            pos.push(R.ring[j][0], R.ring[j][1], R.z);
            uv.push(j / (M - 1), t / NOSE.tMax);
        }
    }
    for (let k = 0; k < N; k++) {
        for (let j = 0; j < M - 1; j++) {
            const a = k * M + j, b = a + 1, c = a + M, d = c + 1;
            idx.push(a, c, b, b, c, d);
        }
    }
    // tiny closing fan at the fold centre
    const Rt = noseRingAt(NOSE.tMax, 8);
    const ci = pos.length / 3;
    pos.push(0, Rt.ring[0][1], Rt.z);
    uv.push(0.5, 1);
    const base = N * M;
    for (let j = 0; j < M - 1; j++) idx.push(base + j, ci, base + j + 1);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
}
// per-pixel painted nose livery in the loft's (u,v) space
function makeNoseTexPair(canvasTexture) {
    const W = 1536, H = 768;
    const pal = [[46, 109, 180], [27, 63, 122], [71, 168, 216], [61, 132, 196], [37, 90, 156], [99, 182, 221]];
    const anchors = { led: [], lens: [] };   // canvas-px anchors from the pixel pass
    function hash2(a, b, c) {
        let h = (a * 374761393 + b * 668265263 + c * 1274126177) | 0;
        h = ((h ^ (h >> 13)) * 1103515245) | 0;
        return ((h >>> 16) & 255) / 255;
    }
    const map = canvasTexture(W, H, (ctx) => {
        const img = ctx.createImageData(W, H);
        const d = img.data;
        for (let j = 0; j < H; j++) {
            const t = (1 - j / (H - 1)) * NOSE.tMax;
            const p = noseProf(Math.min(t, 1));
            const R = noseRingAt(t, W);
            const ring = R.ring;
            // arc-space windscreen-edge columns for the headlamp pods
            const gh0 = 0.72 * p.w;
            let iL = -1, iR = -1;
            if (t > 0.4 && t <= 1) {
                for (let i = 1; i < W; i++) {
                    if (ring[i][1] < 1.9) continue;
                    if (iL < 0 && ring[i][0] >= -gh0) iL = i;
                    if (ring[i][0] <= gh0) iR = i;
                }
            }
            let arcL = 0;
            for (let i = 1; i < W; i++) arcL += Math.hypot(ring[i][0] - ring[i - 1][0], ring[i][1] - ring[i - 1][1]);
            const stepArc = arcL / (W - 1);
            for (let i = 0; i < W; i++) {
                const x = ring[i][0], y = ring[i][1], z = R.z;
                const ax = Math.abs(x);
                const gh = 0.72 * p.w;               // windscreen half-width this ring
                // base warm silver, slight vertical shade
                let r = 197, gg = 194, b = 186;
                const sh = 0.88 + 0.12 * Math.min(1, (y - 0.4) / 2.6);
                r *= sh; gg *= sh; b *= sh;
                const isGlass = ax < gh && y > 2.0 && y < 3.26 && t > 0.1 && t <= 1;
                const isRim = !isGlass && ax < gh + 0.03 && y > 1.95 && y < 3.31 && t > 0.1 && t <= 1;
                // flank facets (blue vinyl) with cab door; boundary sweeps
                // forward as y falls (mask curves down beside the windscreen)
                const flank = ax > 0.80 * p.w && y > p.y0 + 0.14 && y < 2.92 && z < 9.5 + (2.4 - y) * 0.55;
                if (flank) {
                    const u = i / (W - 1);
                    const fu = u * 9 + t * 2.0, fv = t * 5 - u * 3.0;
                    const iu = Math.floor(fu), iv = Math.floor(fv);
                    const dg = (fu - iu) + (fv - iv) > 1 ? 1 : 0;
                    const c = pal[Math.floor(hash2(iu, iv, dg) * pal.length)];
                    r = c[0]; gg = c[1]; b = c[2];
                    // cab access door (recessed, slightly darker + edge lines)
                    if (z > 8.55 && z < 9.4 && y > 0.98 && y < 2.85) {
                        r *= 0.82; gg *= 0.82; b *= 0.82;
                        if (z < 8.61 || z > 9.34 || y > 2.80) { r = 34; gg = 38; b = 44; }
                        if (z > 8.88 && z < 9.16 && y > 1.95 && y < 2.5) { r = 14; gg = 16; b = 18; }
                    }
                    // slim silver grab rail at the door's leading edge
                    if (z > 8.46 && z < 8.50 && y > 1.25 && y < 2.45) {
                        r = 185; gg = 187; b = 189;
                    }
                }
                // pale blue roof band flowing from the body onto the rear nose roof
                if (y > 3.24 && t < 0.5) {
                    const f = 1 - smoothstep(0.32, 0.5, t);
                    r = r + (168 - r) * f; gg = gg + (203 - gg) * f; b = b + (232 - b) * f;
                }
                // dark grey chin / lower nose (front-lower wrap)
                const chin = (y < 2.02 && z + 0.5 * (y - 1.0) > 10.2) || (t <= 1 && y < p.y0 + 0.05) || (t > 0.92 && y < 1.3);
                if (chin) { r = 66; gg = 70; b = 74; }
                // large rounded yellow bib centred below the windscreen
                if (chin || t > 0.72) {
                    const dxq = Math.max(ax - 0.48, 0), dyq = Math.max(Math.abs(y - 1.46) - 0.24, 0);
                    if (Math.hypot(dxq, dyq) < 0.28 && z > 10.15) { r = 247; gg = 181; b = 0; }
                }
                if (isRim) { r = 16; gg = 17; b = 18; }
                if (isGlass) {
                    // raked wrap-around windscreen with vertical gradient
                    const f = (y - 2.0) / 1.26;
                    r = 14 + 26 * f; gg = 17 + 32 * f; b = 20 + 38 * f;
                    // wiper arm
                    const wax = -0.5 + (y - 2.1) * 0.56;
                    if (y > 2.08 && y < 2.85 && Math.abs(x - wax) < 0.03) { r = 12; gg = 13; b = 14; }
                    if (y > 2.95) {  // destination display zone (dark backing)
                        r = 8; gg = 9; b = 10;
                        const dd = Math.hypot(x, y - 3.08);
                        if (!anchors.disp || dd < anchors.disp[2]) anchors.disp = [i, j, dd];
                    }
                }
                // headlamp teardrop pods: recessed pocket where the silver
                // mask curves down each side of the windscreen — painted in
                // ring-arc space so the pod hugs the glass edge exactly.
                // Wide at the top, tapering to a point below (teardrop), with
                // an LED strip of distinct dots along its inner edge.
                if (!isGlass && !isRim && t > 0.56 && t < 0.96 && y > 1.98) {
                    const podT = smoothstep(0.56, 0.96, t);   // 0 top -> 1 bottom
                    const hw = 0.135 - 0.105 * podT;          // arc half-profile
                    const edge = x < 0 ? iL : iR;
                    if (edge > 0) {
                        const dArc = (x < 0 ? (edge - i) : (i - edge)) * stepArc; // + = outside glass
                        if (dArc > 0.025 && dArc < 0.025 + hw) {
                            // dark recess
                            r = 24 + 8 * podT; gg = 26 + 8 * podT; b = 30 + 8 * podT;
                            // LED dot strip on the inner edge
                            if (dArc < 0.072 && podT < 0.92 && y < 2.95) {
                                if ((z * 22) % 1 < 0.55) {
                                    r = 240; gg = 246; b = 252;
                                    anchors.led.push([i, j]);
                                } else { r = 44; gg = 47; b = 52; }
                            }
                            // main lamp lens near the pod top
                            if (podT > 0.1 && podT < 0.3 && dArc > 0.075 && dArc < 0.025 + hw - 0.008) {
                                r = 242; gg = 238; b = 226;
                                anchors.lens.push([i, j]);
                            }
                        } else if (dArc >= 0.025 + hw && dArc < 0.047 + hw) {
                            // clean silver mask border highlight around the pod
                            r = 217; gg = 215; b = 208;
                        }
                    }
                }
                // small blue arrow decals at the bottom front edge (per-pixel,
                // so they stay crisp on the folded cap)
                if (t > 0.9 && y > p.y0 + 0.1 && y < 1.15) {
                    for (const s2 of [-1, 1]) {
                        const lx = x - s2 * 0.35, ly = y - 0.92;
                        if (Math.max(Math.abs(lx), Math.abs(ly)) < 0.055) {
                            r = 46; gg = 109; b = 180;
                            if ((ly > 0.002 && ly < 0.045 && Math.abs(lx) < Math.max(0.04 - ly * 0.85, 0)) ||
                                (ly > -0.042 && ly <= 0.002 && Math.abs(lx) < 0.012)) {
                                r = 250; gg = 252; b = 255;
                            }
                        }
                    }
                }
                // 9065 number anchor on each flank (facet zone behind the cab door)
                if (flank && Math.abs(z - 8.22) < 0.05 && Math.abs(y - 2.6) < 0.05) {
                    if (x < 0 && !anchors.numL) anchors.numL = [i, j];
                    if (x > 0 && !anchors.numR) anchors.numR = [i, j];
                }
                const o = (j * W + i) * 4;
                d[o] = r; d[o + 1] = gg; d[o + 2] = b; d[o + 3] = 255;
            }
        }
        ctx.putImageData(img, 0, 0);
        // ---- overdraw: display text, arrows, numbers (anchor-positioned)
        if (anchors.disp) {
            const [ax2, ay2] = anchors.disp;
            ctx.save();
            ctx.translate(ax2, ay2);
            ctx.scale(1, -1);   // v axis runs opposite to canvas rows on the rake
            ctx.fillStyle = '#f5d33f'; ctx.font = 'bold 30px Arial'; ctx.textAlign = 'center';
            ctx.fillText('Westall', 0, 10);
            ctx.restore();
        }
        for (const key of ['numL', 'numR']) {
            if (!anchors[key]) continue;
            const [ax2, ay2] = anchors[key];
            ctx.save();
            ctx.translate(ax2, ay2);
            ctx.rotate(key === 'numL' ? -Math.PI / 2 : Math.PI / 2);
            ctx.scale(1, -1);
            ctx.fillStyle = '#f2f4f6'; ctx.font = 'bold 28px Arial'; ctx.textAlign = 'center';
            ctx.fillText('9065', 0, 9);
            ctx.restore();
        }
    });
    const emissiveMap = canvasTexture(W, H, (ctx) => {
        ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
        if (anchors.disp) {
            const [ax2, ay2] = anchors.disp;
            ctx.save();
            ctx.translate(ax2, ay2);
            ctx.scale(1, -1);
            ctx.fillStyle = '#e8c433'; ctx.font = 'bold 30px Arial'; ctx.textAlign = 'center';
            ctx.fillText('Westall', 0, 10);
            ctx.restore();
        }
        ctx.fillStyle = '#b9cede';
        for (const [i, j] of anchors.led) ctx.fillRect(i, j, 1, 1);
        ctx.fillStyle = '#fff2dd';
        for (const [i, j] of anchors.lens) ctx.fillRect(i, j, 1, 1);
    });
    return { map, emissiveMap };
}

// gangway bellows texture
function makeBellowsTex(canvasTexture) {
    return canvasTexture(128, 128, (ctx) => {
        ctx.fillStyle = '#1c1d1e'; ctx.fillRect(0, 0, 128, 128);
        for (let x = 0; x < 128; x += 10) {
            ctx.fillStyle = '#2b2c2d'; ctx.fillRect(x, 0, 4, 128);
            ctx.fillStyle = '#0e0f10'; ctx.fillRect(x + 6, 0, 2, 128);
        }
    });
}

// ===========================================================================
// INTERIOR
// ===========================================================================
// axis-aligned quad helpers (winding chosen so the face normal points `face`)
function xRect(THREE, x, y0, y1, z0, z1, face, uvs) {
    return face > 0
        ? quadGeo(THREE, [x, y0, z1], [x, y0, z0], [x, y1, z0], [x, y1, z1], uvs)
        : quadGeo(THREE, [x, y0, z0], [x, y0, z1], [x, y1, z1], [x, y1, z0], uvs);
}
function zRect(THREE, z, x0, x1, y0, y1, face, uvs) {
    return face > 0
        ? quadGeo(THREE, [x0, y0, z], [x1, y0, z], [x1, y1, z], [x0, y1, z], uvs)
        : quadGeo(THREE, [x1, y0, z], [x0, y0, z], [x0, y1, z], [x1, y1, z], uvs);
}
function yRect(THREE, y, x0, x1, z0, z1, face, uvs) {
    return face > 0
        ? quadGeo(THREE, [x0, y, z1], [x1, y, z1], [x1, y, z0], [x0, y, z0], uvs)
        : quadGeo(THREE, [x0, y, z0], [x1, y, z0], [x1, y, z1], [x0, y, z1], uvs);
}
function uvRegion(geo, u0, u1, v0, v1) {
    const uv = geo.attributes.uv;
    for (let i = 0; i < uv.count; i++) {
        uv.setXY(i, u0 + (u1 - u0) * uv.getX(i), v0 + (v1 - v0) * uv.getY(i));
    }
    return geo;
}
// [zMin,zMax] minus sorted holes [[a,b],...] -> solid spans
function solidSpans(zMin, zMax, holes) {
    const hs = holes.filter(h => h[1] > zMin && h[0] < zMax)
        .map(h => [Math.max(h[0], zMin), Math.min(h[1], zMax)])
        .sort((a, b) => a[0] - b[0]);
    const out = []; let c = zMin;
    for (const h of hs) { if (h[0] > c + 0.01) out.push([c, h[0]]); c = Math.max(c, h[1]); }
    if (zMax > c + 0.01) out.push([c, zMax]);
    return out;
}

// deep blue speckled vinyl floor with yellow markings, parametric on door z
function makeFloorTex(canvasTexture, bodyL, doorZ) {
    const S = 64;
    const W = Math.round(2.9 * S), H = Math.round(bodyL * S);
    const px = (x) => (x + 1.45) * S;          // world x -> canvas x
    const pz = (z) => (z + bodyL / 2) * S;     // world z -> canvas y (top = -z end)
    return canvasTexture(W, H, (ctx) => {
        ctx.fillStyle = '#2b3c60'; ctx.fillRect(0, 0, W, H);
        const rnd = mulberry(777);
        // speckle
        for (let i = 0; i < bodyL * 480; i++) {
            const x = rnd() * W, y = rnd() * H, r = rnd();
            ctx.fillStyle = r < 0.35 ? '#4d6390' : (r < 0.6 ? '#a9b4c8' : (r < 0.8 ? '#1d2a46' : '#6f81a6'));
            ctx.globalAlpha = 0.5 + rnd() * 0.5;
            ctx.fillRect(x, y, 2, 2);
        }
        ctx.globalAlpha = 1;
        // yellow door threshold strips + priority outlines with wheelchair symbols
        ctx.strokeStyle = '#f0b421'; ctx.fillStyle = '#f0b421';
        for (const dz of doorZ) {
            for (const s of [-1, 1]) {
                // threshold strip along the doorway edge
                ctx.fillRect(s > 0 ? W - 0.16 * S : 0, pz(dz - DOOR_W / 2), 0.16 * S, DOOR_W * S);
                // priority space rounded-rect outline beside the doorway
                const cx = px(s * 0.72), cy = pz(dz) + (dz > 0 ? 1.35 : -1.35) * S;
                const bw = 1.05 * S, bh = 1.3 * S;
                ctx.lineWidth = 0.045 * S;
                roundRect(ctx, cx - bw / 2, cy - bh / 2, bw, bh, 0.16 * S);
                ctx.stroke();
                // simplified wheelchair glyph
                ctx.lineWidth = 0.065 * S;
                ctx.beginPath(); ctx.arc(cx - 0.05 * S, cy + 0.1 * S, 0.21 * S, 0, Math.PI * 2); ctx.stroke();
                ctx.beginPath();
                ctx.moveTo(cx - 0.02 * S, cy - 0.32 * S);
                ctx.lineTo(cx - 0.02 * S, cy - 0.02 * S);
                ctx.lineTo(cx + 0.24 * S, cy - 0.02 * S);
                ctx.lineTo(cx + 0.3 * S, cy + 0.22 * S);
                ctx.stroke();
                ctx.beginPath(); ctx.arc(cx - 0.02 * S, cy - 0.38 * S, 0.07 * S, 0, Math.PI * 2); ctx.fill();
            }
        }
        // faint panel seams
        ctx.strokeStyle = 'rgba(0,0,0,0.18)'; ctx.lineWidth = 1;
        for (let z = -bodyL / 2 + 2; z < bodyL / 2; z += 2) {
            ctx.beginPath(); ctx.moveTo(0, pz(z)); ctx.lineTo(W, pz(z)); ctx.stroke();
        }
    });
}

// white ceiling with grey ribbed vent band down the middle
function makeCeilTex(canvasTexture) {
    return canvasTexture(256, 1024, (ctx) => {
        ctx.fillStyle = '#e8ebed'; ctx.fillRect(0, 0, 256, 1024);
        // recessed light channels (drawn darker; real glow is separate meshes)
        for (const cx of [58, 198]) {
            ctx.fillStyle = '#c9cdd0'; ctx.fillRect(cx - 14, 0, 28, 1024);
        }
        // central ribbed vent band
        ctx.fillStyle = '#c3c7ca'; ctx.fillRect(96, 0, 64, 1024);
        ctx.fillStyle = '#aeb2b5';
        for (let y = 0; y < 1024; y += 8) ctx.fillRect(96, y, 64, 3);
        // occasional vent frames
        ctx.strokeStyle = '#96999c'; ctx.lineWidth = 2;
        for (let y = 60; y < 1024; y += 160) ctx.strokeRect(100, y, 56, 90);
    });
}

// seat cushion atlas: left = blue wave, right = orange/blue wave
function makeCushionTex(canvasTexture) {
    return canvasTexture(256, 256, (ctx) => {
        function waves(x0, base, cols) {
            ctx.save(); ctx.beginPath(); ctx.rect(x0, 0, 128, 256); ctx.clip();
            ctx.fillStyle = base; ctx.fillRect(x0, 0, 128, 256);
            const rnd = mulberry(x0 + 5);
            // layered ribbon shapes (filled between two sine edges), soft contrast
            for (let i = 0; i < 14; i++) {
                ctx.fillStyle = cols[i % cols.length];
                ctx.globalAlpha = 0.85;
                const yy = rnd() * 256, amp = 10 + rnd() * 14, ph = rnd() * 6;
                const th = 8 + rnd() * 14, ph2 = ph + rnd() * 1.5;
                ctx.beginPath();
                for (let x = 0; x <= 128; x += 8) {
                    const y = yy + Math.sin(x * 0.045 + ph) * amp;
                    if (x === 0) ctx.moveTo(x0 + x, y); else ctx.lineTo(x0 + x, y);
                }
                for (let x = 128; x >= 0; x -= 8) {
                    const y = yy + th + Math.sin(x * 0.05 + ph2) * amp * 0.8;
                    ctx.lineTo(x0 + x, y);
                }
                ctx.closePath(); ctx.fill();
            }
            ctx.globalAlpha = 1;
            ctx.restore();
        }
        waves(0, '#1a2c58', ['#243f7c', '#2f5fa3', '#101d3e', '#3f83b8', '#1b356b', '#5fa8cc']);
        waves(128, '#1a2c58', ['#d4691c', '#243f7c', '#101d3e', '#c2571a', '#2f5fa3', '#e07f2e']);
    });
}

// signage / decal atlas (1024 x 1024)
function makeDecalTex(canvasTexture) {
    return canvasTexture(1024, 1024, (ctx) => {
        ctx.fillStyle = '#666'; ctx.fillRect(0, 0, 1024, 1024);
        // --- route map display (0,0 - 1024,200)
        ctx.fillStyle = '#101418'; ctx.fillRect(0, 0, 1024, 200);
        ctx.fillStyle = '#e8eef4'; ctx.font = 'bold 34px Arial'; ctx.textAlign = 'left';
        ctx.fillText('To Westall', 30, 150);
        ctx.font = '26px Arial'; ctx.fillStyle = '#c3cdd6';
        ctx.fillText('Limited express', 200, 150);
        ctx.fillText('via Metro Tunnel', 400, 174);
        // blue diagonal line with station dots
        ctx.strokeStyle = '#2f7fd2'; ctx.lineWidth = 7;
        ctx.beginPath(); ctx.moveTo(60, 96); ctx.lineTo(960, 40); ctx.stroke();
        const stops = ['Arden', 'Parkville', 'State Library', 'Town Hall', 'Anzac', 'Caulfield', 'Carnegie', 'Murrumbeena', 'Hughesdale', 'Oakleigh', 'Huntingdale', 'Clayton', 'Westall'];
        ctx.font = '17px Arial'; ctx.textAlign = 'center';
        for (let i = 0; i < stops.length; i++) {
            const x = 70 + i * 72, y = 95 - i * 4.3;
            ctx.fillStyle = '#dfe7ee'; ctx.beginPath(); ctx.arc(x, y, 7, 0, Math.PI * 2); ctx.fill();
            ctx.save(); ctx.translate(x + 4, y - 16); ctx.rotate(-0.5);
            ctx.fillStyle = '#aab6c0'; ctx.fillText(stops[i], 0, 0); ctx.restore();
        }
        // --- PID (0,210 - 400,340)
        ctx.fillStyle = '#0b0e11'; ctx.fillRect(0, 210, 400, 130);
        ctx.fillStyle = '#2f7fd2'; roundRect(ctx, 60, 224, 280, 46, 10); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.font = 'bold 34px Arial'; ctx.textAlign = 'center';
        ctx.fillText('Westall', 200, 258);
        ctx.font = '24px Arial'; ctx.fillStyle = '#dfe5ea';
        ctx.fillText('Limited express via Metro Tunnel', 200, 310);
        // --- network map poster (420,210 - 700,650)
        ctx.fillStyle = '#f4f5f6'; ctx.fillRect(420, 210, 280, 440);
        ctx.fillStyle = '#222'; ctx.font = 'bold 20px Arial'; ctx.textAlign = 'left';
        ctx.fillText('Victorian train network', 434, 240);
        const lncols = ['#2f7fd2', '#d02f2f', '#2fa356', '#e0a41f', '#8a4fc8', '#28b8c8', '#e06e9c'];
        const rnd2 = mulberry(31);
        for (let i = 0; i < lncols.length; i++) {
            ctx.strokeStyle = lncols[i]; ctx.lineWidth = 4;
            ctx.beginPath(); ctx.moveTo(560, 430);
            const a = i / lncols.length * Math.PI * 2;
            ctx.quadraticCurveTo(560 + Math.cos(a) * 60, 430 + Math.sin(a) * 60 + (rnd2() - 0.5) * 40,
                560 + Math.cos(a) * 125, 430 + Math.sin(a) * 168);
            ctx.stroke();
        }
        ctx.fillStyle = '#333'; ctx.beginPath(); ctx.arc(560, 430, 12, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#555'; ctx.font = '11px Arial';
        for (let r = 0; r < 14; r++) ctx.fillRect(434, 600 + (r % 3) * 12, 40 + (r * 13) % 60, 5);
        // --- emergency panel (720,210 - 850,450)
        ctx.fillStyle = '#e8e9ea'; ctx.fillRect(720, 210, 130, 240);
        ctx.fillStyle = '#c92222'; ctx.fillRect(720, 210, 130, 56);
        ctx.fillStyle = '#fff'; ctx.font = 'bold 20px Arial'; ctx.textAlign = 'center';
        ctx.fillText('Emergency', 785, 248);
        ctx.fillStyle = '#f0b421'; roundRect(ctx, 748, 300, 74, 74, 37); ctx.fill();
        ctx.fillStyle = '#c92222'; ctx.beginPath(); ctx.arc(785, 337, 24, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#222'; ctx.font = '13px Arial';
        ctx.fillText('Press for help', 785, 412);
        // --- carriage plate (0,360 - 300,440)
        ctx.fillStyle = '#111'; ctx.fillRect(0, 360, 300, 80);
        ctx.fillStyle = '#eee'; ctx.font = '26px Arial'; ctx.textAlign = 'left';
        ctx.fillText('Carriage', 16, 410);
        ctx.font = 'bold 40px Arial'; ctx.fillText('9855', 150, 414);
        // --- cab bulkhead door w/ KEEP CLEAR (860,0 - 1024,470)
        ctx.fillStyle = '#dfe1e3'; ctx.fillRect(860, 0, 164, 470);
        ctx.strokeStyle = '#9a9ea1'; ctx.lineWidth = 4; ctx.strokeRect(866, 6, 152, 458);
        ctx.fillStyle = '#f0b421'; ctx.fillRect(884, 90, 116, 54);
        ctx.fillStyle = '#111'; ctx.font = 'bold 22px Arial'; ctx.textAlign = 'center';
        ctx.fillText('KEEP', 942, 112); ctx.fillText('CLEAR', 942, 136);
        ctx.fillStyle = '#8d9093'; ctx.fillRect(880, 250, 30, 8);
        ctx.fillStyle = '#c92222'; ctx.font = '13px Arial';
        ctx.fillText('NO ACCESS', 942, 180);
        // --- diamond plate (0,470 - 200,670)
        ctx.fillStyle = '#9aa0a4'; ctx.fillRect(0, 470, 200, 200);
        ctx.strokeStyle = '#7d8286'; ctx.lineWidth = 3;
        for (let y = 0; y < 200; y += 25) {
            for (let x = 0; x < 200; x += 25) {
                const o = ((y / 25) % 2) * 12;
                ctx.beginPath(); ctx.moveTo(x + o + 4, 470 + y + 12); ctx.lineTo(x + o + 16, 470 + y + 4); ctx.stroke();
            }
        }
        // --- priority space sticker (blue) (220,470 - 340,610)
        ctx.fillStyle = '#2456a8'; ctx.fillRect(220, 470, 120, 140);
        ctx.fillStyle = '#fff'; ctx.font = 'bold 15px Arial';
        ctx.fillText('PRIORITY', 280, 560); ctx.fillText('SPACE', 280, 580);
        ctx.beginPath(); ctx.arc(280, 512, 16, 0, Math.PI * 2); ctx.stroke();
    });
}
// atlas px rect -> uv corners for quadGeo
function uvR(x0, y0, x1, y1) {
    const N = 1024;
    return [[x0 / N, 1 - y1 / N], [x1 / N, 1 - y1 / N], [x1 / N, 1 - y0 / N], [x0 / N, 1 - y0 / N]];
}

// door leaf atlas: columns [extN | extP | intN | intP].  extN = the leaf whose
// meeting edge is on its RIGHT (the left-hand leaf of a pair).
const LEAF_CW = 512, LEAF_TH = 1024;
function makeLeafTex(canvasTexture) {
    const W = LEAF_CW * 4, H = LEAF_TH;
    // leaf spans y 0.88..2.98 and LEAF_W across
    const ly = m => (2.98 - m) / LEAF_H * H;             // metres -> canvas y
    const lx = (cx0, m) => cx0 + m / LEAF_W * LEAF_CW;   // metres from leaf left edge
    const PH = m => m / LEAF_W * LEAF_CW;                // metres -> px horizontally
    const PV = m => m / LEAF_H * H;                      // metres -> px vertically
    // window geometry: ONE tall rounded pane in the upper part of each leaf
    // measured off the reference close-up: the pane is ~0.48 x 0.87 and sits
    // essentially CENTRED across the leaf, high in the doorway
    const WIN_H0 = 1.790, WIN_H1 = 2.655, WIN_W = 0.480, WIN_INSET = (LEAF_W - 0.480) / 2;
    return canvasTexture(W, H, (ctx) => {
        ctx.textBaseline = 'alphabetic';

        // ---- exterior base: muted steel blue-grey with a soft vertical sheen
        function extBase(cx0) {
            const g = ctx.createLinearGradient(cx0, 0, cx0 + LEAF_CW, 0);
            g.addColorStop(0.00, '#6B8296');
            g.addColorStop(0.14, '#7B96AE');
            g.addColorStop(0.46, '#89A4BA');
            g.addColorStop(0.74, '#7E99B0');
            g.addColorStop(1.00, '#6A8195');
            ctx.fillStyle = g; ctx.fillRect(cx0, 0, LEAF_CW, H);
            const v = ctx.createLinearGradient(0, 0, 0, H);
            v.addColorStop(0.00, 'rgba(255,255,255,0.07)');
            v.addColorStop(0.45, 'rgba(255,255,255,0.01)');
            v.addColorStop(1.00, 'rgba(0,0,0,0.10)');
            ctx.fillStyle = v; ctx.fillRect(cx0, 0, LEAF_CW, H);
        }
        function intBase(cx0) {
            const g = ctx.createLinearGradient(cx0, 0, cx0 + LEAF_CW, 0);
            g.addColorStop(0, '#d8dbde'); g.addColorStop(0.5, '#cdd1d4'); g.addColorStop(1, '#bec2c5');
            ctx.fillStyle = g; ctx.fillRect(cx0, 0, LEAF_CW, H);
            ctx.strokeStyle = '#a7abae'; ctx.lineWidth = 4;
            ctx.strokeRect(cx0 + 18, 18, LEAF_CW - 36, H - 36);
        }
        function winSpan(nearRight) {
            return nearRight
                ? [LEAF_W - WIN_INSET - WIN_W, LEAF_W - WIN_INSET]
                : [WIN_INSET, WIN_INSET + WIN_W];
        }
        // thick black rubber gasket + pane
        function leafWindow(cx0, nearRight, ext) {
            const sp = winSpan(nearRight);
            const wx0 = lx(cx0, sp[0]), wx1 = lx(cx0, sp[1]);
            const gy0 = ly(WIN_H1), gy1 = ly(WIN_H0);
            const gk = PH(0.046), gkv = PV(0.046);       // gasket thickness
            roundRect(ctx, wx0 - gk, gy0 - gkv, (wx1 - wx0) + 2 * gk, (gy1 - gy0) + 2 * gkv, PH(0.135));
            ctx.fillStyle = '#0d0f10'; ctx.fill();
            ctx.strokeStyle = 'rgba(255,255,255,0.10)'; ctx.lineWidth = 3; ctx.stroke();
            ctx.save();
            roundRect(ctx, wx0, gy0, wx1 - wx0, gy1 - gy0, PH(0.10));
            ctx.clip();
            if (ext) {
                // bright, lit saloon seen through the glass
                const pg = ctx.createLinearGradient(0, gy0, 0, gy1);
                pg.addColorStop(0.00, '#f2f5f7');
                pg.addColorStop(0.42, '#dfe5e9');
                pg.addColorStop(0.78, '#c6ced4');
                pg.addColorStop(1.00, '#aeb7bd');
                ctx.fillStyle = pg; ctx.fillRect(wx0, gy0, wx1 - wx0, gy1 - gy0);
                // hint of the saloon behind: ceiling / wall / seat backs / floor
                const pw = wx1 - wx0, ph = gy1 - gy0;
                ctx.fillStyle = 'rgba(196,203,209,0.55)';
                ctx.fillRect(wx0, gy0 + ph * 0.60, pw, ph * 0.06);      // wall-to-seat line
                ctx.fillStyle = 'rgba(146,155,163,0.60)';               // seat backs
                roundRect(ctx, wx0 + pw * 0.04, gy0 + ph * 0.63, pw * 0.52, ph * 0.30, pw * 0.08);
                ctx.fill();
                ctx.fillStyle = 'rgba(120,131,142,0.50)';               // floor band
                ctx.fillRect(wx0, gy0 + ph * 0.92, pw, ph * 0.08);
                ctx.fillStyle = 'rgba(178,186,193,0.45)';               // far pillar
                ctx.fillRect(wx0 + pw * 0.78, gy0, pw * 0.13, ph * 0.62);
                ctx.fillStyle = 'rgba(226,178,40,0.88)';                // yellow grab pole
                ctx.fillRect(wx0 + pw * 0.58, gy0 + ph * 0.02, PH(0.026), ph * 0.94);
                // faint outside reflection streak
                ctx.fillStyle = 'rgba(255,255,255,0.15)';
                ctx.beginPath();
                ctx.moveTo(wx0 + (wx1 - wx0) * 0.05, gy0);
                ctx.lineTo(wx0 + (wx1 - wx0) * 0.34, gy0);
                ctx.lineTo(wx0 + (wx1 - wx0) * 0.12, gy1);
                ctx.lineTo(wx0, gy1);
                ctx.closePath(); ctx.fill();
            } else {
                // from inside: darker view out to the platform
                const pg = ctx.createLinearGradient(0, gy0, 0, gy1);
                pg.addColorStop(0, '#4a5259'); pg.addColorStop(0.5, '#2c3339'); pg.addColorStop(1, '#1b2126');
                ctx.fillStyle = pg; ctx.fillRect(wx0, gy0, wx1 - wx0, gy1 - gy0);
                ctx.fillStyle = 'rgba(190,210,228,0.12)';
                ctx.fillRect(wx0, gy0, (wx1 - wx0) * 0.35, gy1 - gy0);
            }
            ctx.restore();
        }
        // --- decals at window-sill height, clustered near the seam
        function pressSigns(cx0, nearRight) {
            const gy = 1.688, gh = 0.094;
            const wGreen = 0.152, wWait = 0.094, gapS = 0.012;
            const total = wGreen + gapS + wWait;
            const right = nearRight ? LEAF_W - 0.070 : WIN_INSET + WIN_W - 0.004;
            const m0 = right - total;
            const y1 = ly(gy), y0 = ly(gy + gh);
            const gx0 = lx(cx0, m0), gx1 = lx(cx0, m0 + wGreen);
            roundRect(ctx, gx0, y0, gx1 - gx0, y1 - y0, PH(0.008));
            ctx.fillStyle = '#0e5c34'; ctx.fill();
            ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 2; ctx.stroke();
            ctx.fillStyle = '#ffffff'; ctx.textAlign = 'center';
            ctx.font = 'bold ' + Math.round(PV(0.030)) + 'px Arial';
            ctx.fillText('Press to', (gx0 + gx1) / 2, y0 + (y1 - y0) * 0.44);
            ctx.fillText('Open Door', (gx0 + gx1) / 2, y0 + (y1 - y0) * 0.84);
            const bx0 = lx(cx0, m0 + wGreen + gapS), bx1 = lx(cx0, right);
            roundRect(ctx, bx0, y0, bx1 - bx0, y1 - y0, PH(0.008));
            ctx.fillStyle = '#c9d21f'; ctx.fill();
            ctx.strokeStyle = 'rgba(0,0,0,0.45)'; ctx.stroke();
            ctx.fillStyle = '#16321a';
            ctx.font = 'bold ' + Math.round(PV(0.026)) + 'px Arial';
            ctx.fillText('Wait for', (bx0 + bx1) / 2, y0 + (y1 - y0) * 0.34);
            ctx.fillText('green', (bx0 + bx1) / 2, y0 + (y1 - y0) * 0.62);
            ctx.fillText('light', (bx0 + bx1) / 2, y0 + (y1 - y0) * 0.90);
        }
        function pushButton(cx0, nearRight) {
            const cm = nearRight ? LEAF_W - 0.088 : 0.088;
            const cx = lx(cx0, cm), cy = ly(1.735);
            const R = 0.048;
            function disc(rr, fill) {
                ctx.beginPath();
                ctx.ellipse(cx, cy, PH(rr), PV(rr), 0, 0, Math.PI * 2);
                ctx.fillStyle = fill; ctx.fill();
            }
            disc(R, '#6d6a2a');            // darker outer ring
            disc(R * 0.82, '#c9bf3a');     // olive/yellow disc
            disc(R * 0.55, '#a89e2c');
            disc(R * 0.24, '#2fbe52');     // green centre lamp
            ctx.strokeStyle = 'rgba(0,0,0,0.45)'; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.ellipse(cx, cy, PH(R), PV(R), 0, 0, Math.PI * 2); ctx.stroke();
        }
        // --- crisp centre seam with a subtle highlight either side
        function seam(cx0, nearRight) {
            const ex = nearRight ? cx0 + LEAF_CW : cx0;
            const w = Math.max(2, Math.round(PH(0.010)));
            ctx.fillStyle = 'rgba(255,255,255,0.18)';
            ctx.fillRect(nearRight ? ex - w * 3 : ex + w, 0, w * 2, H);
            ctx.fillStyle = '#1d2830';
            ctx.fillRect(nearRight ? ex - w : ex, 0, w, H);
        }
        function extLeaf(cx0, nearRight, withButton) {
            extBase(cx0);
            leafWindow(cx0, nearRight, true);
            if (withButton) pushButton(cx0, nearRight); else pressSigns(cx0, nearRight);
            seam(cx0, nearRight);
        }
        function intLeaf(cx0, nearRight) {
            intBase(cx0);
            leafWindow(cx0, nearRight, false);
            const ex = nearRight ? cx0 + LEAF_CW - 22 : cx0 + 8;
            ctx.fillStyle = '#f0b421'; ctx.fillRect(ex, ly(2.45), 14, ly(1.1) - ly(2.45));
        }
        // extN = left-hand leaf (meeting edge on its right) -> carries the signs
        // extP = right-hand leaf (meeting edge on its left) -> carries the button
        extLeaf(0, true, false);
        extLeaf(LEAF_CW, false, true);
        intLeaf(LEAF_CW * 2, true);
        intLeaf(LEAF_CW * 3, false);
        // dark rubber sliver at the very left of column 0, sampled by EDGE_UV
        // for each leaf's meeting-edge face quad
        ctx.fillStyle = '#141b21'; ctx.fillRect(0, 0, 14, H);
    });
}
const LEAF_COL = { extN: [0, 0.25], extP: [0.25, 0.5], intN: [0.5, 0.75], intP: [0.75, 1.0] };
// thin dark slice used for the leaf's meeting-edge face
const EDGE_UV = [[0.0012, 0], [0.0055, 0], [0.0055, 1], [0.0012, 1]];
function leafUV(col, mirrorU) {
    const [u0, u1] = LEAF_COL[col];
    return mirrorU
        ? [[u1, 0], [u0, 0], [u0, 1], [u1, 1]]
        : [[u0, 0], [u1, 0], [u1, 1], [u0, 1]];
}

// ---------------------------------------------------------------------------
// interior template for one car body.
// P: { bodyL, zMin, zMax, doorZ, winZ, cab, carNumberZ }
// mats: shared interior materials
function buildInterior(THREE, mats, P) {
    const g = new THREE.Group();
    const { bodyL, zMin, zMax, doorZ, winZ, cab } = P;
    const wallX = 1.42;
    const doorHoles = doorZ.map(z => [z - DOOR_W / 2, z + DOOR_W / 2]);

    const wall = [], grey = [], yellow = [], steel = [], seatGrey = [], cushion = [], decal = [], lights = [];
    const reveal = [];   // dark door-jamb / head reveals (read as shadow from outside)
    const M = () => new THREE.Matrix4();

    // ---- floor & ceiling
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(2.9, zMax - zMin), mats.floorFor(P));
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, FLOOR_Y, (zMin + zMax) / 2);
    g.add(floor);
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(2.9, zMax - zMin), mats.ceil);
    ceil.rotation.x = Math.PI / 2;
    ceil.position.set(0, CEIL_Y, (zMin + zMax) / 2);
    g.add(ceil);

    // ---- light strips (always-bright) + doorway downlights
    for (const sx of [-0.78, 0.78]) {
        lights.push({ geo: new THREE.BoxGeometry(0.17, 0.03, zMax - zMin - 0.8), m: mat4(THREE, sx, CEIL_Y - 0.018, (zMin + zMax) / 2) });
    }
    for (const dz of doorZ) {
        lights.push({ geo: new THREE.CylinderGeometry(0.06, 0.06, 0.02, 10), m: mat4(THREE, 0, CEIL_Y - 0.008, dz) });
    }

    // ---- side wall lining (off-white), with real holes at doors + windows
    for (const s of [-1, 1]) {
        const x = s * wallX, face = -s;
        // low band: floor..window sill, minus doorways
        for (const sp of solidSpans(zMin, zMax, doorHoles)) {
            wall.push({ geo: xRect(THREE, x, FLOOR_Y, 1.72, sp[0], sp[1], face), m: M() });
        }
        // window band, minus doors and windows
        for (const sp of solidSpans(zMin, zMax, doorHoles.concat(winZ))) {
            wall.push({ geo: xRect(THREE, x, 1.72, DOOR_TOP, sp[0], sp[1], face), m: M() });
        }
        // top band solid
        wall.push({ geo: xRect(THREE, x, DOOR_TOP, CEIL_Y, zMin, zMax, face), m: M() });
        // door jamb + head reveals (wall thickness) — dark, so any sliver seen
        // past a leaf edge reads as shadow rather than a bright white line
        for (const dz of doorZ) {
            const jx0 = Math.min(s * wallX, s * SIDE_X), jx1 = Math.max(s * wallX, s * SIDE_X);
            for (const e of [-1, 1]) {
                reveal.push({ geo: zRect(THREE, dz + e * DOOR_W / 2, jx0, jx1, FLOOR_Y, DOOR_TOP, -e), m: M() });
            }
            reveal.push({ geo: yRect(THREE, DOOR_TOP, jx0, jx1, dz - DOOR_W / 2, dz + DOOR_W / 2, -1), m: M() });
        }
        // window reveals (top/bottom sills)
        for (const wz of winZ) {
            wall.push({ geo: yRect(THREE, 1.72, Math.min(s * wallX, s * SIDE_X), Math.max(s * wallX, s * SIDE_X), wz[0], wz[1], 1), m: M() });
        }
    }

    // ---- end walls
    const ends = [];
    if (cab) ends.push({ z: zMax, face: -1, type: 'bulkhead' }, { z: zMin, face: 1, type: 'gangway' });
    else ends.push({ z: zMax, face: -1, type: 'gangway' }, { z: zMin, face: 1, type: 'gangway' });
    for (const e of ends) {
        if (e.type === 'gangway') {
            wall.push({ geo: zRect(THREE, e.z, -1.42, -0.65, FLOOR_Y, CEIL_Y, e.face), m: M() });
            wall.push({ geo: zRect(THREE, e.z, 0.65, 1.42, FLOOR_Y, CEIL_Y, e.face), m: M() });
            wall.push({ geo: zRect(THREE, e.z, -0.65, 0.65, 2.72, CEIL_Y, e.face), m: M() });
        } else {
            // white bulkhead with door decal + KEEP CLEAR
            wall.push({ geo: zRect(THREE, e.z, -1.42, 1.42, FLOOR_Y, CEIL_Y, e.face), m: M() });
            decal.push({ geo: zRect(THREE, e.z + e.face * 0.01, -0.05, 0.8, FLOOR_Y, 2.88, e.face, uvR(860, 0, 1024, 470)), m: M() });
        }
    }

    // ---- seats -------------------------------------------------------------
    // longitudinal flip-up row: n seats from z0, on side s. variant: 0 blue, 1 orange
    function seatRow(s, z0, n, variant, folded) {
        const u0 = variant ? 0.52 : 0.02, u1 = variant ? 0.98 : 0.48;
        for (let i = 0; i < n; i++) {
            const zc = z0 + 0.235 + i * 0.48;
            if (folded) {
                // folded-up grey pad against the wall
                seatGrey.push({ geo: new THREE.BoxGeometry(0.09, 0.62, 0.44), m: mat4(THREE, s * (wallX - 0.075), 1.62, zc) });
                seatGrey.push({ geo: new THREE.BoxGeometry(0.05, 0.1, 0.4), m: mat4(THREE, s * (wallX - 0.045), 1.27, zc) });
            } else {
                // back cushion
                const bk = new THREE.BoxGeometry(0.07, 0.52, 0.44);
                uvRegion(bk, u0, u1, 0, 1);
                cushion.push({ geo: bk, m: mat4(THREE, s * (wallX - 0.065), 1.76, zc, 0, 0, s * 0.08) });
                // seat pad
                const pd = new THREE.BoxGeometry(0.42, 0.07, 0.44);
                uvRegion(pd, u0, u1, 0, 1);
                cushion.push({ geo: pd, m: mat4(THREE, s * (wallX - 0.26), 1.45, zc) });
                // grey base
                seatGrey.push({ geo: new THREE.BoxGeometry(0.36, 0.34, 0.4), m: mat4(THREE, s * (wallX - 0.24), 1.24, zc) });
            }
        }
        // shared grey backrest board behind the row
        if (!folded) {
            seatGrey.push({ geo: new THREE.BoxGeometry(0.04, 0.75, n * 0.48 + 0.06), m: mat4(THREE, s * (wallX - 0.025), 1.72, z0 + n * 0.24), });
        }
    }
    // facing fixed bay: two benches (2-seat) facing each other, orange variant
    function facingBay(s, zc) {
        for (const d of [-1, 1]) {
            const zb = zc + d * 0.62;
            const u0 = 0.52, u1 = 0.98;
            const pd = new THREE.BoxGeometry(0.9, 0.08, 0.44); uvRegion(pd, u0, u1, 0, 1);
            cushion.push({ geo: pd, m: mat4(THREE, s * 0.93, 1.46, zb) });
            const bk = new THREE.BoxGeometry(0.9, 0.55, 0.08); uvRegion(bk, u0, u1, 0, 1);
            cushion.push({ geo: bk, m: mat4(THREE, s * 0.93, 1.74, zb + d * 0.22, d * -0.12, 0, 0) });
            seatGrey.push({ geo: new THREE.BoxGeometry(0.86, 0.34, 0.38), m: mat4(THREE, s * 0.93, 1.25, zb) });
            // grey back shell
            seatGrey.push({ geo: new THREE.BoxGeometry(0.9, 0.64, 0.05), m: mat4(THREE, s * 0.93, 1.73, zb + d * 0.3) });
        }
    }

    if (!cab) {
        seatRow(-1, 1.55, 4, 0, false); seatRow(1, 1.55, 4, 0, false);
        seatRow(-1, 4.1, 4, 0, false); seatRow(1, 4.1, 4, 1, false);
        seatRow(-1, 9.0, 3, 0, false); seatRow(1, 9.0, 3, 0, true);
        seatRow(-1, -10.4, 3, 0, true); seatRow(1, -10.4, 3, 0, false);
        seatRow(-1, -2.5, 3, 0, false); seatRow(1, -2.5, 3, 0, false);
        facingBay(-1, -4.25); facingBay(1, -4.25);
    } else {
        seatRow(-1, 1.0, 3, 0, false); seatRow(1, 1.0, 3, 0, false);
        seatRow(-1, 3.0, 3, 0, false); seatRow(1, 3.0, 3, 1, false);
        seatRow(-1, -8.7, 3, 0, false); seatRow(1, -8.7, 3, 0, true);
        facingBay(-1, -3.6); facingBay(1, -3.6);
        seatRow(-1, -2.2, 2, 0, false); seatRow(1, -2.2, 2, 0, false);
    }

    // ---- poles, overhead rails, straps ------------------------------------
    // yellow grab rails beside every doorway
    for (const s of [-1, 1]) {
        for (const dz of doorZ) {
            for (const e of [-1, 1]) {
                yellow.push({ geo: new THREE.CylinderGeometry(0.019, 0.019, 1.25, 8), m: mat4(THREE, s * 1.36, 1.78, dz + e * (DOOR_W / 2 + 0.09)) });
            }
        }
    }
    // overhead longitudinal rails
    const railLen = zMax - zMin - 1.4;
    const RAIL_Y = 2.72;
    for (const sx of [-0.55, 0.55]) {
        yellow.push({ geo: new THREE.CylinderGeometry(0.021, 0.021, railLen, 8), m: mat4(THREE, sx, RAIL_Y, (zMin + zMax) / 2, Math.PI / 2, 0, 0) });
        // steel drop clamps
        for (let z = zMin + 1.2; z < zMax - 0.7; z += 2.2) {
            steel.push({ geo: new THREE.CylinderGeometry(0.013, 0.013, CEIL_Y - RAIL_Y, 6), m: mat4(THREE, sx, (CEIL_Y + RAIL_Y) / 2, z) });
        }
        // hanging straps (skip doorway zones and hung displays)
        for (let z = zMin + 1.1; z < zMax - 0.9; z += 0.95) {
            if (doorZ.some(dz => Math.abs(z - dz) < 1.05)) continue;
            if (P.rmZ && P.rmZ.some(rz => Math.abs(z - rz) < 0.9)) continue;
            yellow.push({ geo: new THREE.TorusGeometry(0.062, 0.011, 6, 12), m: mat4(THREE, sx, RAIL_Y - 0.105, z) });
            yellow.push({ geo: new THREE.BoxGeometry(0.03, 0.08, 0.018), m: mat4(THREE, sx, RAIL_Y - 0.035, z) });
        }
    }
    // vertical poles: straight ones near doorway/seat boundaries + centre tripods
    const poleZ = cab ? [[0.75, -0.9], [0.75, 0.75], [-0.85, 2.7], [0.85, 2.7], [-0.85, -4.9], [0.85, -4.9]]
        : [[-0.85, 1.35], [0.85, 1.35], [-0.85, 6.65], [0.85, 6.65], [-0.85, -1.05], [0.85, -1.05], [-0.85, -5.6], [0.85, -5.6]];
    for (const [px2, pz2] of poleZ) {
        yellow.push({ geo: new THREE.CylinderGeometry(0.023, 0.023, CEIL_Y - FLOOR_Y, 10), m: mat4(THREE, px2, (FLOOR_Y + CEIL_Y) / 2, pz2) });
        steel.push({ geo: new THREE.CylinderGeometry(0.035, 0.035, 0.05, 8), m: mat4(THREE, px2, 2.9, pz2) });
    }
    // centre tripod poles
    const triZ = cab ? [4.2] : [3.85, -3.35];
    for (const tz of triZ) {
        yellow.push({ geo: new THREE.CylinderGeometry(0.024, 0.024, CEIL_Y - 1.9, 10), m: mat4(THREE, 0, (CEIL_Y + 1.9) / 2, tz) });
        for (const a of [-1, 0, 1]) {
            const dx = a * 0.28;
            const len = Math.sqrt((1.9 - FLOOR_Y) ** 2 + dx * dx);
            yellow.push({ geo: new THREE.CylinderGeometry(0.02, 0.02, len, 8), m: mat4(THREE, dx / 2, (1.9 + FLOOR_Y) / 2, tz, 0, 0, Math.atan2(dx, 1.9 - FLOOR_Y)) });
        }
        steel.push({ geo: new THREE.CylinderGeometry(0.04, 0.04, 0.07, 8), m: mat4(THREE, 0, 1.9, tz) });
    }

    // ---- signage -----------------------------------------------------------
    // hung route-map displays transverse over the aisle (~2 per car)
    const rmZ = P.rmZ || (cab ? [2.0, -4.9] : [2.6, -2.9]);
    for (const rz of rmZ) {
        grey.push({ geo: new THREE.BoxGeometry(1.56, 0.34, 0.055), m: mat4(THREE, 0, 2.68, rz) });
        steel.push({ geo: new THREE.BoxGeometry(0.03, 0.12, 0.03), m: mat4(THREE, -0.6, CEIL_Y - 0.06, rz) });
        steel.push({ geo: new THREE.BoxGeometry(0.03, 0.12, 0.03), m: mat4(THREE, 0.6, CEIL_Y - 0.06, rz) });
        for (const f of [-1, 1]) {
            decal.push({ geo: zRect(THREE, rz + f * 0.03, f > 0 ? -0.75 : 0.75, f > 0 ? 0.75 : -0.75, 2.54, 2.83, f, uvR(0, 0, 1024, 200)), m: M() });
        }
    }
    // ceiling PID boxes near two doorways
    const pidZ = [doorZ[0] - 1.35, doorZ[2] + 1.35];
    for (const pz3 of pidZ) {
        grey.push({ geo: new THREE.BoxGeometry(0.6, 0.19, 0.1), m: mat4(THREE, 0, 2.83, pz3) });
        for (const f of [-1, 1]) {
            decal.push({ geo: zRect(THREE, pz3 + f * 0.051, f > 0 ? -0.28 : 0.28, f > 0 ? 0.28 : -0.28, 2.745, 2.915, f, uvR(0, 210, 400, 340)), m: M() });
        }
    }
    // wall decals: carriage plates, network map poster, emergency panel, priority sticker
    for (const s of [-1, 1]) {
        const x = s * (wallX - 0.006), face = -s;
        const midDoor = doorZ[1];
        decal.push({ geo: xRect(THREE, x, 2.5, 2.61, zMin + 0.5, zMin + 0.92, face, s > 0 ? uvR(0, 360, 300, 440) : uvR(0, 360, 300, 440)), m: M() });
        decal.push({ geo: xRect(THREE, x, 1.85, 2.57, midDoor + 1.02, midDoor + 1.52, face, uvR(420, 210, 700, 650)), m: M() });
        decal.push({ geo: xRect(THREE, x, 1.7, 2.1, midDoor - 1.42, midDoor - 1.2, face, uvR(720, 210, 850, 450)), m: M() });
        decal.push({ geo: xRect(THREE, x, 2.55, 2.83, doorZ[2] - 1.2, doorZ[2] - 0.96, face, uvR(220, 470, 340, 610)), m: M() });
    }

    // ---- build merged meshes
    function addMerged(items, mat, name) {
        if (!items.length) return;
        const mesh = new THREE.Mesh(mergeGeoms(THREE, items), mat);
        if (name) mesh.name = name;
        g.add(mesh);
    }
    addMerged(wall, mats.wall);
    addMerged(grey, mats.grey);
    addMerged(yellow, mats.yellow);
    addMerged(steel, mats.steel);
    addMerged(seatGrey, mats.seatGrey);
    addMerged(cushion, mats.cushion);
    addMerged(decal, mats.decal);
    addMerged(lights, mats.light);
    addMerged(reveal, mats.reveal);

    // ---- sliding door leaves: 4 mover meshes (side x dir), merged ----------
    for (const s of [-1, 1]) {
        for (const dir of [-1, 1]) {
            const items = [];
            const xo = s * 1.505, xi = s * 1.478;
            for (const dz of doorZ) {
                const z0 = dir > 0 ? dz : dz - LEAF_W;
                const z1 = dir > 0 ? dz + LEAF_W : dz;
                const y0 = 0.88, y1 = 0.88 + LEAF_H;
                // The leaf's meeting edge is at dz. Pick the atlas column so the
                // painted meeting edge lands there AND the artwork is never
                // mirrored on screen (the decals carry text).
                //   s=+1 seen from +x: screen-right is -z  -> u grows toward -z
                //   s=-1 seen from -x: screen-right is +z  -> u grows toward +z
                const extCol = ((dir > 0) === (s > 0)) ? 'extN' : 'extP';
                const intCol = dir > 0 ? 'intP' : 'intN';
                items.push({ geo: xRect(THREE, xo, y0, y1, z0, z1, s, leafUV(extCol, false)), m: M() });
                items.push({ geo: xRect(THREE, xi, y0, y1, z0, z1, -s, leafUV(intCol, s < 0)), m: M() });
                // meeting-edge face: a thin dark rubber slice from the atlas
                items.push({ geo: quadGeo(THREE,
                    [Math.min(xo, xi), y0, dz], [Math.max(xo, xi), y0, dz],
                    [Math.max(xo, xi), y1, dz], [Math.min(xo, xi), y1, dz],
                    EDGE_UV), m: M() });
            }
            const mesh = new THREE.Mesh(mergeGeoms(THREE, items), mats.leaf);
            mesh.name = 'leaf';
            mesh.userData.leaf = { s, dir };
            g.add(mesh);
        }
    }

    return g;
}

// ---------------------------------------------------------------------------
function buildHCMT(THREE, canvasTexture) {
    const train = new THREE.Group();

    // shared materials
    const matRoof = new THREE.MeshStandardMaterial({ color: '#9dc4e6', roughness: 0.65, metalness: 0.05 });
    const matChar = new THREE.MeshStandardMaterial({ color: C.charcoal, roughness: 0.6, metalness: 0.15 });
    const matUnder = new THREE.MeshStandardMaterial({ color: '#232527', roughness: 0.9 });
    const matBogie = new THREE.MeshStandardMaterial({ color: '#35322f', roughness: 0.95 });
    const matEquip = new THREE.MeshStandardMaterial({ color: '#a7adb1', roughness: 0.8 });
    const matPanto = new THREE.MeshStandardMaterial({ color: '#2a2b2c', roughness: 0.7 });
    const bellowsTex = makeBellowsTex(canvasTexture);
    const matBellows = new THREE.MeshStandardMaterial({ map: bellowsTex, roughness: 0.95 });

    // car end caps: charcoal with facet wrap edges + recessed gangway door
    const endTex = canvasTexture(306, 226, (ctx) => {
        ctx.fillStyle = C.dark; ctx.fillRect(0, 0, 306, 226);
        drawFacets(ctx, 0, 0, 72, 226, 5);
        drawFacets(ctx, 234, 0, 72, 226, 9);
        ctx.fillStyle = '#141516'; ctx.fillRect(103, 16, 100, 210);
        // open gangway aperture (real hole; alphaTest cuts it)
        ctx.clearRect(88, 8, 130, 201);
    });
    // NOTE: walls stay in the OPAQUE render pass (alphaTest only, never
    // transparent:true) — transparent walls get depth-rejected when viewed
    // through other transparent surfaces (e.g. platform screen doors) and the
    // train appears to have missing walls.
    const matEnd = new THREE.MeshStandardMaterial({ map: endTex, roughness: 0.7, alphaTest: 0.5, side: THREE.DoubleSide });

    const midTexR = makeSideTex(canvasTexture, midLayout, false, 40);
    const midTexL = makeSideTex(canvasTexture, midLayout, true, 40);
    const cabTexR = makeSideTex(canvasTexture, cabLayout, false, 71);
    const cabTexL = makeSideTex(canvasTexture, cabLayout, true, 71);
    const sideOpts = { roughness: 0.38, metalness: 0.35, alphaTest: 0.5, side: THREE.DoubleSide };
    const matMidR = new THREE.MeshStandardMaterial({ map: midTexR, ...sideOpts });
    const matMidL = new THREE.MeshStandardMaterial({ map: midTexL, ...sideOpts });
    const matCabR = new THREE.MeshStandardMaterial({ map: cabTexR, ...sideOpts });
    const matCabL = new THREE.MeshStandardMaterial({ map: cabTexL, ...sideOpts });

    // tinted window glass (separate planes behind the cut-out bezels)
    const matGlass = new THREE.MeshStandardMaterial({
        color: '#26343d', roughness: 0.12, metalness: 0.4,
        transparent: true, opacity: 0.52, depthWrite: false, side: THREE.DoubleSide
    });
    // merged glass quads for one car side; sGn is the layout, s the side sign
    function glassGeo(layoutL, windows, s) {
        const items = [];
        const gx = s * (SIDE_X - 0.025);
        for (const wz of windows) {
            const z0 = layoutL / 2 - wz[1], z1 = layoutL / 2 - wz[0];
            items.push({ geo: xRect(THREE, gx, 1.72, 2.80, z0, z1, s), m: mat4(THREE, 0, 0, 0) });
        }
        return mergeGeoms(THREE, items);
    }
    const midGlassR = glassGeo(CAR_L, midLayout.windows, 1);
    const midGlassL = glassGeo(CAR_L, midLayout.windows, -1);
    const cabGlassR = glassGeo(cabBodyL, cabLayout.windows, 1);
    const cabGlassL = glassGeo(cabBodyL, cabLayout.windows, -1);

    // lofted nose (geometry + painted livery + emissive display/headlights)
    const noseTexs = makeNoseTexPair(canvasTexture);
    const matNose = new THREE.MeshStandardMaterial({
        map: noseTexs.map, roughness: 0.42, metalness: 0.3,
        emissive: '#ffffff', emissiveMap: noseTexs.emissiveMap, emissiveIntensity: 0.85
    });
    const noseGeo = noseGeometry(THREE);

    // ---- interior shared materials ----------------------------------------
    const midDoorZ = doorCentresLocal(midLayout);
    const cabDoorZ = doorCentresLocal(cabLayout);
    const midP = {
        bodyL: CAR_L, zMin: -CAR_L / 2 + 0.05, zMax: CAR_L / 2 - 0.05,
        doorZ: midDoorZ,
        winZ: midLayout.windows.map(w => [CAR_L / 2 - w[1], CAR_L / 2 - w[0]]),
        cab: false, rmZ: [2.6, -2.9]
    };
    const cabP = {
        bodyL: cabBodyL, zMin: -cabBodyL / 2 + 0.15, zMax: 7.7,
        doorZ: cabDoorZ,
        winZ: cabLayout.windows.map(w => [cabBodyL / 2 - w[1], cabBodyL / 2 - w[0]]),
        cab: true, rmZ: [2.0, -4.9]
    };
    const floorTexMid = makeFloorTex(canvasTexture, midP.zMax - midP.zMin, midP.doorZ.map(z => z - (midP.zMin + midP.zMax) / 2));
    const floorTexCab = makeFloorTex(canvasTexture, cabP.zMax - cabP.zMin, cabP.doorZ.map(z => z - (cabP.zMin + cabP.zMax) / 2));
    const matFloorMid = new THREE.MeshStandardMaterial({ map: floorTexMid, roughness: 0.85 });
    const matFloorCab = new THREE.MeshStandardMaterial({ map: floorTexCab, roughness: 0.85 });
    const ceilTex = makeCeilTex(canvasTexture);
    const decalTex = makeDecalTex(canvasTexture);
    const cushTex = makeCushionTex(canvasTexture);
    const leafTex = makeLeafTex(canvasTexture);
    // interior surfaces get an emissive lift so the cabin reads lit (no real
    // interior lights in the harness; sun/hemi barely reach downward faces)
    const intMats = {
        floorFor: (P) => (P.cab ? matFloorCab : matFloorMid),
        ceil: new THREE.MeshStandardMaterial({ map: ceilTex, roughness: 0.9, emissive: '#ffffff', emissiveMap: ceilTex, emissiveIntensity: 0.52 }),
        wall: new THREE.MeshStandardMaterial({ color: '#e7e9eb', roughness: 0.85, emissive: '#6c6e70', emissiveIntensity: 0.5 }),
        grey: new THREE.MeshStandardMaterial({ color: '#7d8184', roughness: 0.7, emissive: '#37393b', emissiveIntensity: 0.5 }),
        yellow: new THREE.MeshStandardMaterial({ color: '#f0b421', roughness: 0.45, emissive: '#8a6410', emissiveIntensity: 0.5 }),
        steel: new THREE.MeshStandardMaterial({ color: '#b9bdc1', roughness: 0.35, metalness: 0.7, emissive: '#46484a', emissiveIntensity: 0.5 }),
        seatGrey: new THREE.MeshStandardMaterial({ color: '#a2a6aa', roughness: 0.8, emissive: '#4a4d50', emissiveIntensity: 0.5 }),
        cushion: new THREE.MeshStandardMaterial({ map: cushTex, roughness: 0.95, emissive: '#ffffff', emissiveMap: cushTex, emissiveIntensity: 0.3 }),
        decal: new THREE.MeshStandardMaterial({ map: decalTex, roughness: 0.7, emissive: '#ffffff', emissiveMap: decalTex, emissiveIntensity: 0.55 }),
        light: new THREE.MeshBasicMaterial({ color: '#f7fbff' }),
        reveal: new THREE.MeshStandardMaterial({ color: '#24282b', roughness: 0.85, emissive: '#101214', emissiveIntensity: 0.5 }),
        leaf: new THREE.MeshStandardMaterial({ map: leafTex, roughness: 0.74, metalness: 0.02, emissive: '#ffffff', emissiveMap: leafTex, emissiveIntensity: 0.18 })
    };
    matFloorMid.emissive = new THREE.Color('#ffffff');
    matFloorMid.emissiveMap = floorTexMid; matFloorMid.emissiveIntensity = 0.35;
    matFloorCab.emissive = new THREE.Color('#ffffff');
    matFloorCab.emissiveMap = floorTexCab; matFloorCab.emissiveIntensity = 0.35;
    const midInterior = buildInterior(THREE, intMats, midP);
    const cabInterior = buildInterior(THREE, intMats, cabP);

    // roof shell geometry (cross-section extruded along z)
    function roofShellGeo(L) {
        const hw = 1.522, r = 0.55;
        const s = new THREE.Shape();
        s.moveTo(-hw, ROOF_Y0);
        s.lineTo(hw, ROOF_Y0);
        s.lineTo(hw, ROOF_Y1 - r);
        s.quadraticCurveTo(hw, ROOF_Y1, hw - r, ROOF_Y1);
        s.lineTo(-hw + r, ROOF_Y1);
        s.quadraticCurveTo(-hw, ROOF_Y1, -hw, ROOF_Y1 - r);
        s.closePath();
        const g = new THREE.ExtrudeGeometry(s, { depth: L, bevelEnabled: false, curveSegments: 6 });
        g.translate(0, 0, -L / 2);
        return g;
    }

    // bogie: one merged geometry
    function bogieGeo() {
        const items = [];
        // narrow central frame so the wheels stay visible
        items.push({ geo: new THREE.BoxGeometry(1.25, 0.4, 2.9), m: mat4(THREE, 0, 0.58, 0) });
        // side frame beams (outboard, above wheel tops)
        for (const sx of [-0.95, 0.95]) {
            items.push({ geo: new THREE.BoxGeometry(0.16, 0.3, 3.0), m: mat4(THREE, sx, 0.78, 0) });
        }
        const wheel = new THREE.CylinderGeometry(0.42, 0.42, 0.09, 20);
        for (const zx of [-1.15, 1.15]) {
            for (const sx of [-0.74, 0.74]) {
                items.push({ geo: wheel, m: mat4(THREE, sx, 0.42, zx, 0, 0, Math.PI / 2) });
            }
        }
        const axleBox = new THREE.BoxGeometry(0.3, 0.34, 0.42);
        for (const zx of [-1.15, 1.15]) {
            for (const sx of [-0.95, 0.95]) {
                items.push({ geo: axleBox, m: mat4(THREE, sx, 0.5, zx) });
            }
        }
        return mergeGeoms(THREE, items);
    }
    const bogieG = bogieGeo();

    // roof equipment (merged boxes)
    function roofEquipGeo(withHVAC) {
        const items = [];
        if (withHVAC) {
            items.push({ geo: new THREE.BoxGeometry(1.9, 0.28, 4.4), m: mat4(THREE, 0, ROOF_Y1 + 0.1, -4.5) });
            items.push({ geo: new THREE.BoxGeometry(1.9, 0.28, 4.4), m: mat4(THREE, 0, ROOF_Y1 + 0.1, 4.5) });
        }
        items.push({ geo: new THREE.BoxGeometry(1.2, 0.16, 2.2), m: mat4(THREE, 0, ROOF_Y1 + 0.04, 0) });
        items.push({ geo: new THREE.BoxGeometry(0.35, 0.1, 15), m: mat4(THREE, 1.05, ROOF_Y1 + 0.02, 0) });
        return mergeGeoms(THREE, items);
    }
    const roofEquipG = roofEquipGeo(true);

    // underframe boxes (merged)
    function underGeo(L) {
        const items = [];
        items.push({ geo: new THREE.BoxGeometry(2.6, 0.5, L - 2.4), m: mat4(THREE, 0, 0.63, 0) });
        items.push({ geo: new THREE.BoxGeometry(2.72, 0.34, 3.4), m: mat4(THREE, 0, 0.52, -2.2) });
        items.push({ geo: new THREE.BoxGeometry(2.72, 0.34, 2.2), m: mat4(THREE, 0, 0.52, 2.8) });
        return mergeGeoms(THREE, items);
    }

    // -----------------------------------------------------------------------
    // middle car template
    function makeMidCar() {
        const car = new THREE.Group();
        const sideG = new THREE.PlaneGeometry(CAR_L, SIDE_Y1 - SIDE_Y0);

        const right = new THREE.Mesh(sideG, matMidR);
        right.position.set(SIDE_X, (SIDE_Y0 + SIDE_Y1) / 2, 0);
        right.rotation.y = Math.PI / 2;
        car.add(right);

        const left = new THREE.Mesh(sideG, matMidL);
        left.position.set(-SIDE_X, (SIDE_Y0 + SIDE_Y1) / 2, 0);
        left.rotation.y = -Math.PI / 2;
        car.add(left);

        const roof = new THREE.Mesh(roofShellGeo(CAR_L), matRoof);
        car.add(roof);

        // end caps (both, merged, plain dark)
        const capG = mergeGeoms(THREE, [
            { geo: new THREE.PlaneGeometry(CAR_W, SIDE_Y1 - SIDE_Y0), m: mat4(THREE, 0, (SIDE_Y0 + SIDE_Y1) / 2, CAR_L / 2) },
            { geo: new THREE.PlaneGeometry(CAR_W, SIDE_Y1 - SIDE_Y0), m: mat4(THREE, 0, (SIDE_Y0 + SIDE_Y1) / 2, -CAR_L / 2, 0, Math.PI, 0) }
        ]);
        car.add(new THREE.Mesh(capG, matEnd));

        const under = new THREE.Mesh(underGeo(CAR_L), matUnder);
        car.add(under);

        for (const bz of [-7.3, 7.3]) {
            const b = new THREE.Mesh(bogieG, matBogie);
            b.position.z = bz;
            car.add(b);
        }

        const eq = new THREE.Mesh(roofEquipG, matEquip);
        car.add(eq);

        car.add(new THREE.Mesh(midGlassR, matGlass));
        car.add(new THREE.Mesh(midGlassL, matGlass));

        car.add(midInterior.clone());
        return car;
    }

    // -----------------------------------------------------------------------
    // cab car (front toward local +z; car spans -11..+11, body -11..+8, nose 8..11)
    function makeCabCar() {
        const car = new THREE.Group();
        const zb = CAR_L / 2 - NOSE_L;   // 8
        const zf = CAR_L / 2;            // 11
        const bodyCz = (-CAR_L / 2 + zb) / 2; // centre of 19 m body = -1.5

        const sideG = new THREE.PlaneGeometry(cabBodyL, SIDE_Y1 - SIDE_Y0);
        // texture u=0 must be the FRONT (bulkhead end)
        const right = new THREE.Mesh(sideG, matCabR);
        right.position.set(SIDE_X, (SIDE_Y0 + SIDE_Y1) / 2, bodyCz);
        right.rotation.y = Math.PI / 2;   // u runs toward -z => u=0 at +z (front). good.
        car.add(right);
        const left = new THREE.Mesh(sideG, matCabL);
        left.position.set(-SIDE_X, (SIDE_Y0 + SIDE_Y1) / 2, bodyCz);
        left.rotation.y = -Math.PI / 2;   // u runs toward +z => u=0 at -z (rear) -> mirrored texture fixes
        car.add(left);

        const roof = new THREE.Mesh(roofShellGeo(cabBodyL), matRoof);
        roof.position.z = bodyCz;
        car.add(roof);

        // rear cap
        const cap = new THREE.Mesh(new THREE.PlaneGeometry(CAR_W, SIDE_Y1 - SIDE_Y0), matEnd);
        cap.position.set(0, (SIDE_Y0 + SIDE_Y1) / 2, -CAR_L / 2);
        cap.rotation.y = Math.PI;
        car.add(cap);

        const under = new THREE.Mesh(underGeo(cabBodyL - 1.0), matUnder);
        under.position.z = bodyCz;
        car.add(under);

        for (const bz of [-7.3, 6.8]) {
            const b = new THREE.Mesh(bogieG, matBogie);
            b.position.z = bz;
            car.add(b);
        }

        const eq = new THREE.Mesh(roofEquipG, matEquip);
        eq.position.z = -1.7;
        car.add(eq);

        // small equipment/antenna box on the cab roof
        const ant = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.14, 1.6), matEquip);
        ant.position.set(0, ROOF_Y1 + 0.05, 5.6);
        car.add(ant);

        // window glass planes (body section)
        const gR = new THREE.Mesh(cabGlassR, matGlass); gR.position.z = bodyCz; car.add(gR);
        const gL = new THREE.Mesh(cabGlassL, matGlass); gL.position.z = bodyCz; car.add(gL);

        // ---- nose: smooth lofted bullet slope (single mesh) ----
        car.add(new THREE.Mesh(noseGeo, matNose));

        // under-nose skirt + coupler
        const skirtItems = [
            { geo: new THREE.BoxGeometry(1.6, 0.34, 1.7), m: mat4(THREE, 0, 0.3, zf - 1.15) },
            { geo: new THREE.BoxGeometry(0.44, 0.3, 1.0), m: mat4(THREE, 0, 0.32, zf - 0.45) },
            // filler under the tapered cab side, closes the daylight gap
            { geo: new THREE.BoxGeometry(2.4, 0.5, 2.2), m: mat4(THREE, 0, 0.6, zb + 1.1) }
        ];
        car.add(new THREE.Mesh(mergeGeoms(THREE, skirtItems), matUnder));

        const inte = cabInterior.clone();
        inte.position.z = CAB_BODY_CZ;
        car.add(inte);

        return car;
    }

    // -----------------------------------------------------------------------
    // gangway between cars — open walk-through with concertina interior
    function makeGangway() {
        const g = new THREE.Group();
        // exterior bellows shell: 4 slabs (sides + roof + under) so the passage is open
        const shellItems = [
            { geo: new THREE.BoxGeometry(0.36, 2.3, 0.62), m: mat4(THREE, -0.895, 2.2, 0) },
            { geo: new THREE.BoxGeometry(0.36, 2.3, 0.62), m: mat4(THREE, 0.895, 2.2, 0) },
            { geo: new THREE.BoxGeometry(2.15, 0.32, 0.62), m: mat4(THREE, 0, 3.19, 0) },
            { geo: new THREE.BoxGeometry(2.15, 0.30, 0.62), m: mat4(THREE, 0, 0.84, 0) }
        ];
        g.add(new THREE.Mesh(mergeGeoms(THREE, shellItems), matBellows));
        const cap = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.45, GAP + 0.2), matRoof);
        cap.position.y = 3.42;
        g.add(cap);
        // interior lining: inward-facing tunnel walls + ceiling, ribbed grey
        const lin = [];
        lin.push({ geo: xRect(THREE, -0.71, 1.03, 2.86, -0.55, 0.55, 1), m: new THREE.Matrix4() });
        lin.push({ geo: xRect(THREE, 0.71, 1.03, 2.86, -0.55, 0.55, -1), m: new THREE.Matrix4() });
        lin.push({ geo: yRect(THREE, 2.86, -0.71, 0.71, -0.55, 0.55, -1), m: new THREE.Matrix4() });
        // concertina ribs: rectangular loops standing proud of the lining
        for (const rz of [-0.3, -0.1, 0.1, 0.3]) {
            lin.push({ geo: new THREE.BoxGeometry(0.06, 1.8, 0.075), m: mat4(THREE, -0.665, 1.93, rz) });
            lin.push({ geo: new THREE.BoxGeometry(0.06, 1.8, 0.075), m: mat4(THREE, 0.665, 1.93, rz) });
            lin.push({ geo: new THREE.BoxGeometry(1.4, 0.06, 0.075), m: mat4(THREE, 0, 2.8, rz) });
        }
        const linMesh = new THREE.Mesh(mergeGeoms(THREE, lin), matGangIn);
        g.add(linMesh);
        // diamond-plate floor strip
        const fl = new THREE.Mesh(new THREE.BoxGeometry(1.32, 0.05, 1.05), matDiamond);
        fl.position.y = FLOOR_Y + 0.015;
        g.add(fl);
        // yellow grab rails at the opening corners
        const yr = [];
        for (const sx of [-0.58, 0.58]) {
            for (const sz of [-0.44, 0.44]) {
                yr.push({ geo: new THREE.CylinderGeometry(0.02, 0.02, 1.5, 8), m: mat4(THREE, sx, 1.86, sz) });
            }
        }
        g.add(new THREE.Mesh(mergeGeoms(THREE, yr), intMats.yellow));
        return g;
    }
    const matGangIn = new THREE.MeshStandardMaterial({ color: '#8b8f92', roughness: 0.9, side: THREE.DoubleSide, emissive: '#3e4144', emissiveIntensity: 0.5 });
    const diamondTex = canvasTexture(128, 128, (ctx) => {
        ctx.fillStyle = '#9aa0a4'; ctx.fillRect(0, 0, 128, 128);
        ctx.strokeStyle = '#7d8286'; ctx.lineWidth = 3;
        for (let y = 0; y < 128; y += 16) {
            for (let x = 0; x < 128; x += 16) {
                const o = ((y / 16) % 2) * 8;
                ctx.beginPath(); ctx.moveTo(x + o + 2, y + 8); ctx.lineTo(x + o + 10, y + 2); ctx.stroke();
            }
        }
    });
    const matDiamond = new THREE.MeshStandardMaterial({ map: diamondTex, roughness: 0.6, metalness: 0.4, emissive: '#ffffff', emissiveMap: diamondTex, emissiveIntensity: 0.3 });

    // pantograph (single-arm, connected joints), merged
    function pantoGeo() {
        const items = [];
        const baseY = ROOF_Y1 + 0.14;
        items.push({ geo: new THREE.BoxGeometry(1.5, 0.14, 2.2), m: mat4(THREE, 0, ROOF_Y1 + 0.07, 0) });
        // insulator feet
        for (const px of [-0.55, 0.55]) {
            for (const pz of [-0.85, 0.85]) {
                items.push({ geo: new THREE.CylinderGeometry(0.07, 0.09, 0.16, 8), m: mat4(THREE, px, ROOF_Y1 + 0.06, pz) });
            }
        }
        // hinge at rear of base: (0, baseY, -0.9); knee at (0, baseY+0.75, 0.35); head at (0, baseY+1.3, -0.35)
        const hinge = [0, baseY, -0.9], knee = [0, baseY + 0.75, 0.35], head = [0, baseY + 1.3, -0.35];
        function arm(a, b, t) {
            const dy = b[1] - a[1], dz = b[2] - a[2];
            const len = Math.sqrt(dy * dy + dz * dz);
            const ang = Math.atan2(dy, dz); // rotation about x: box z axis toward +z
            return { geo: new THREE.BoxGeometry(t, t, len), m: mat4(THREE, 0, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2, -ang, 0, 0) };
        }
        items.push(arm(hinge, knee, 0.14));
        items.push(arm(knee, head, 0.1));
        // twin lower arms visual (offset pair)
        const a2 = arm(hinge, knee, 0.07); a2.m = a2.m.clone().premultiply(mat4(THREE, 0.16, 0, 0));
        items.push(a2);
        // head bar + horns
        items.push({ geo: new THREE.BoxGeometry(2.1, 0.12, 0.2), m: mat4(THREE, 0, head[1] + 0.09, head[2] - 0.2) });
        items.push({ geo: new THREE.BoxGeometry(2.1, 0.12, 0.2), m: mat4(THREE, 0, head[1] + 0.09, head[2] + 0.2) });
        items.push({ geo: new THREE.BoxGeometry(0.12, 0.1, 0.55), m: mat4(THREE, -0.95, head[1] + 0.06, head[2]) });
        items.push({ geo: new THREE.BoxGeometry(0.12, 0.1, 0.55), m: mat4(THREE, 0.95, head[1] + 0.06, head[2]) });
        return mergeGeoms(THREE, items);
    }
    const pantoG = pantoGeo();

    // -----------------------------------------------------------------------
    // assemble train: 7 cars, front car facing +z
    const pitch = CAR_L + GAP; // 22.6
    const midTemplate = makeMidCar();
    for (let i = 1; i <= 5; i++) {
        const c = midTemplate.clone();
        c.position.z = (3 - i) * pitch;
        train.add(c);
        if (i === 1 || i === 4) {
            const p = new THREE.Mesh(pantoG, matPanto);
            p.position.z = (3 - i) * pitch + 3;
            train.add(p);
        }
    }
    const frontCar = makeCabCar();
    frontCar.position.z = 3 * pitch;
    train.add(frontCar);
    const rearCar = makeCabCar();
    rearCar.position.z = -3 * pitch;
    rearCar.rotation.y = Math.PI;
    train.add(rearCar);

    for (let i = 0; i < 6; i++) {
        const gw = makeGangway();
        gw.position.z = (2.5 - i) * pitch;
        train.add(gw);
    }

    // ---- door control ------------------------------------------------------
    // collect leaf mover meshes, classified by their TRAIN-local side
    train.updateMatrixWorld(true);
    const moversP = [], moversN = [];
    const q = new THREE.Quaternion(), ax = new THREE.Vector3();
    train.traverse((o) => {
        if (!o.isMesh || !o.userData.leaf) return;
        const { s, dir } = o.userData.leaf;
        o.getWorldQuaternion(q);
        ax.set(1, 0, 0).applyQuaternion(q);
        const worldSide = s * Math.sign(ax.x || 1);
        (worldSide > 0 ? moversP : moversN).push({ mesh: o, dir });
    });
    train.userData.setDoors = (k, localSide) => {
        k = Math.max(0, Math.min(1, k || 0));
        const arr = localSide < 0 ? moversN : moversP;
        for (let i = 0; i < arr.length; i++) {
            arr[i].mesh.position.z = arr[i].dir * LEAF_TRAVEL * k;
        }
    };

    return train;
}

function __hcmtWorld(world) {
    const { THREE, scene } = world;
    world.ownsSky(false);
    world.groundLevel(0);
    const train = buildHCMT(THREE, (w, h, fn) => world.canvasTexture(w, h, fn));
    world.part('hcmt_train', train);
    scene.add(train);
}


//
//  station.scene.js
//  State Library Station — Metro Tunnel, Melbourne
//
//  The full cavern as built: central concourse between the two platforms,
//  crossing orange arches and stacked gold lanterns over the middle, dark
//  timber-banded vaults with orange cone lamps over the platforms, blade
//  columns carrying longitudinal beams, full-height platform screen doors,
//  the mid-station escalators up to the Exit 1 mezzanine (with the glazed
//  Information box in the walk-under space beneath), the Exit 2 escalator
//  bank at one end and the lift core at the other.
//
//  Written against the Project27 runtime (build(world)) — the app keeps the
//  camera, the loop and the walk; this module says what is in the station.
//
//  Plan (z runs the length of the cavern):
//      z -55 ─ end wall · lifts ─ open concourse ─ end wall z +55
//


// Recorded HCMT audio, embedded so the world stays a single file.
const SND_DEPART = 'data:audio/mpeg;base64,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';
const SND_ARRIVE = 'data:audio/mpeg;base64,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BdAKVItJ1WFynRKNP5ClyoW5RNb6yeZrJNUOTuBYPr4ZfWvb/oo6aiv4vZlrmtaGByC0VBqItr/8pS/0//NAxOYWorpECHja8HhilL6GYz0f/UBZE///VlCiW/JcSgqd9XyoiVWHSSg7gGCAAFDWJBuiPjErF0pnD9NxlpKlSL3I+tW2bS/fW1dy/VpLUgmePlEewnoVwfRHiSDnJQ3NEzhNJpX/80LE5hL5+jguelocGbP/6lqUtX6//Z2SLpkTSaTC+aH2S0LJaUxBTUUzLjEwMFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVX/80DE9he6XggMegTYVVVVVVVVVVVVVVVVVVVVVVVVVUxBTUUzLjEwMFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVf/zQsTyFQIRaLRgGyVVVVVVVVVVVVVVVVVVVVVVVVVVVUxBTUUzLjEwMFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVf/zQMSkAAADSAAAAABVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV//NCxKMAAANIAAAAAFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV';

function build(world) {
    const { THREE, scene } = world;

    world.ownsSky(true);
    world.groundLevel(0);
    world.bloom({ strength: 0.3, radius: 0.55, threshold: 0.82 });

    /* ============================================================
       0 · constants + helpers
       ============================================================ */
    const LEN = 220, HALF = LEN / 2;      // cavern length, z in [-110, 110] (10-car provision)
    const R = 11.9, CY = 2.4;             // vault radius / centre height (crown 14.3)
    const COL_X = 5.2;                    // blade column line
    const BEAM_Y = 5.1, BEAM_H = 1.0;     // longitudinal beam centre / depth
    const BAY = 6;                        // arch bay
    const ARCH_X = 4.8, ARCH_Y0 = 5.45, ARCH_H = 4.4;   // arch span/spring/rise (crown ~9.85)
    const PSD_X = 11.4;                   // platform screen door wall (6.2 m platforms)
    const MEZZ = { z0: -8, z1: 8, y: 4.0 };             // Exit 1 mezzanine

    const tex = (w, h, draw, rx, ry) => {
        const t = world.canvasTexture(w, h, (ctx, cv) => draw(ctx, cv.width, cv.height));
        if (rx || ry) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx || 1, ry || 1); }
        return t;
    };
    function mergeGeos(items) {
        const pos = [], nor = [], uv = [];
        for (const it of items) {
            let g = it.geo.clone();
            if (it.m) g.applyMatrix4(it.m);
            g = g.index ? g.toNonIndexed() : g;
            pos.push(...g.attributes.position.array);
            nor.push(...g.attributes.normal.array);
            const u = g.attributes.uv;
            if (u) uv.push(...u.array); else uv.push(...new Float32Array(g.attributes.position.count * 2));
            g.dispose();
        }
        const out = new THREE.BufferGeometry();
        out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
        out.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
        return out;
    }
    const M = (x, y, z, rx, ry, rz) => {
        const m = new THREE.Matrix4();
        m.compose(new THREE.Vector3(x, y, z),
            new THREE.Quaternion().setFromEuler(new THREE.Euler(rx || 0, ry || 0, rz || 0)),
            new THREE.Vector3(1, 1, 1));
        return m;
    };

    /* ============================================================
       1 · textures
       ============================================================ */
    const concreteTex = tex(512, 512, (ctx, w, h) => {
        ctx.fillStyle = '#a6a5a1'; ctx.fillRect(0, 0, w, h);
        for (let i = 0; i < 260; i++) {
            const x = Math.random() * w, y = Math.random() * h, r = 12 + Math.random() * 55;
            const g = ctx.createRadialGradient(x, y, 0, x, y, r);
            const tone = Math.random() < 0.5 ? '142,141,138' : '177,176,173';
            g.addColorStop(0, `rgba(${tone},${0.05 + Math.random() * 0.08})`);
            g.addColorStop(1, `rgba(${tone},0)`);
            ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
        }
        for (let i = 0; i < 2600; i++) {
            ctx.fillStyle = `rgba(${Math.random() < 0.5 ? '120,118,112' : '215,213,207'},${Math.random() * 0.14})`;
            ctx.fillRect(Math.random() * w, Math.random() * h, 1.4, 1.4);
        }
        ctx.strokeStyle = 'rgba(110,108,102,0.28)'; ctx.lineWidth = 1.5;
        for (let i = 1; i < 4; i++) { ctx.beginPath(); ctx.moveTo(i * w / 4, 0); ctx.lineTo(i * w / 4, h); ctx.stroke(); }
        ctx.strokeStyle = 'rgba(110,108,102,0.16)';
        ctx.beginPath(); ctx.moveTo(0, h / 2); ctx.lineTo(w, h / 2); ctx.stroke();
    }, 10, 3);
    const colTex = concreteTex.clone(); colTex.repeat.set(2, 2); colTex.needsUpdate = true;

    const floorTex = tex(512, 512, (ctx, w, h) => {
        ctx.fillStyle = '#b0aeaa'; ctx.fillRect(0, 0, w, h);
        const n = 4, s = w / n;
        for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
            const v = 168 + Math.floor(Math.random() * 16);
            ctx.fillStyle = `rgb(${v},${v},${v - 3})`;
            ctx.fillRect(i * s + 1, j * s + 1, s - 2, s - 2);
            for (let k = 0; k < 190; k++) {
                ctx.fillStyle = `rgba(${Math.random() < 0.5 ? '118,117,114' : '232,231,228'},${Math.random() * 0.16})`;
                ctx.fillRect(i * s + Math.random() * s, j * s + Math.random() * s, 1.2, 1.2);
            }
        }
        ctx.strokeStyle = 'rgba(125,122,115,0.55)'; ctx.lineWidth = 2;
        for (let i = 0; i <= n; i++) {
            ctx.beginPath(); ctx.moveTo(i * s, 0); ctx.lineTo(i * s, h); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(0, i * s); ctx.lineTo(w, i * s); ctx.stroke();
        }
    }, 5, 32);


    // dark timber battens over the platforms
    const battenTex = tex(256, 256, (ctx, w, h) => {
        ctx.fillStyle = '#221b15'; ctx.fillRect(0, 0, w, h);
        for (let x = 0; x < w; x += 12) {
            ctx.fillStyle = '#2e241b'; ctx.fillRect(x, 0, 7, h);
            ctx.fillStyle = '#171310'; ctx.fillRect(x + 7, 0, 5, h);
        }
    }, 24, 2);

    // flat metal panel ceilings (under mezzanine / near Exit 2)
    const panelTex = tex(512, 512, (ctx, w, h) => {
        ctx.fillStyle = '#cfd1d0'; ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = 'rgba(90,92,92,0.6)'; ctx.lineWidth = 3;
        for (let i = 0; i <= 4; i++) {
            ctx.beginPath(); ctx.moveTo(i * w / 4, 0); ctx.lineTo(i * w / 4, h); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(0, i * h / 4); ctx.lineTo(w, i * h / 4); ctx.stroke();
        }
        for (let i = 0; i < 900; i++) {
            ctx.fillStyle = `rgba(120,122,122,${Math.random() * 0.08})`;
            ctx.fillRect(Math.random() * w, Math.random() * h, 1.5, 1.5);
        }
    }, 4, 6);

    // white glazed panelling with black grid (lift core / info box)
    const glazedTex = tex(512, 512, (ctx, w, h) => {
        ctx.fillStyle = '#E9EBE7'; ctx.fillRect(0, 0, w, h);
        const g = ctx.createLinearGradient(0, 0, w, h);
        g.addColorStop(0, 'rgba(255,255,255,0.25)'); g.addColorStop(1, 'rgba(180,184,180,0.2)');
        ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = '#1c1d1e'; ctx.lineWidth = 6;
        for (let i = 0; i <= 4; i++) { ctx.beginPath(); ctx.moveTo(i * w / 4, 0); ctx.lineTo(i * w / 4, h); ctx.stroke(); }
        for (let i = 0; i <= 3; i++) { ctx.beginPath(); ctx.moveTo(0, i * h / 3); ctx.lineTo(w, i * h / 3); ctx.stroke(); }
    }, 3, 1);

    /* ============================================================
       2 · materials
       ============================================================ */
    const concreteMat = new THREE.MeshStandardMaterial({ map: concreteTex, roughness: 0.94 });
    const columnMat = new THREE.MeshStandardMaterial({ map: colTex, roughness: 0.9 });
    const floorMat = new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.7, metalness: 0.05 });
    const orangeMat = new THREE.MeshStandardMaterial({ color: 0xF2611C, roughness: 0.5, metalness: 0.05,
        emissive: 0xD84A10, emissiveIntensity: 0.12 });
    const amberMat = new THREE.MeshStandardMaterial({ color: 0xD79A33, roughness: 0.45, metalness: 0.2 });
    const coreMat = new THREE.MeshStandardMaterial({ color: 0x443311, emissive: 0xFFD98F, emissiveIntensity: 2.2 });
    const finMat = new THREE.MeshStandardMaterial({
        color: 0xF2E4BE, emissive: 0xD9C08A, emissiveIntensity: 0.55,
        transparent: true, opacity: 0.78, side: THREE.DoubleSide });
    const steelMat = new THREE.MeshStandardMaterial({ color: 0xB4B7BA, roughness: 0.45, metalness: 0.35 });
    const darkMetal = new THREE.MeshStandardMaterial({ color: 0x3A3D40, roughness: 0.5, metalness: 0.3 });
    const blackMat = new THREE.MeshStandardMaterial({ color: 0x121314, roughness: 0.9 });
    const slatMat = new THREE.MeshStandardMaterial({ color: 0xB3B6B9, roughness: 0.5, metalness: 0.25 });
    const glassMat = new THREE.MeshStandardMaterial({
        color: 0xBFC8CC, roughness: 0.08, metalness: 0.25, transparent: true, opacity: 0.45 });
    const psdGlassMat = new THREE.MeshStandardMaterial({
        color: 0x5A6266, roughness: 0.08, metalness: 0.4, transparent: true, opacity: 0.35 });
    const lensMat = new THREE.MeshStandardMaterial({ color: 0x777777, emissive: 0xFFF4DC, emissiveIntensity: 1.1 });
    const ledMat = new THREE.MeshStandardMaterial({ color: 0x888888, emissive: 0xEDF3F2, emissiveIntensity: 2.2 });
    const coneGlowMat = new THREE.MeshStandardMaterial({ color: 0x442200, emissive: 0xF08A28, emissiveIntensity: 1.6 });
    const magentaMat = new THREE.MeshStandardMaterial({ color: 0x6B1F45, emissive: 0xC2347C, emissiveIntensity: 0.3 });
    const redMat = new THREE.MeshStandardMaterial({ color: 0xA83228, roughness: 0.6 });
    const glazedMat = new THREE.MeshStandardMaterial({ map: glazedTex, roughness: 0.35, metalness: 0.05,
        emissive: 0xB9BCB6, emissiveMap: glazedTex, emissiveIntensity: 0.28 });
    const panelMat = new THREE.MeshStandardMaterial({ map: panelTex, roughness: 0.6, metalness: 0.15 });

    /* ============================================================
       3 · vault, floor, ceiling bands
       ============================================================ */
    const roofVault = new THREE.Group(); scene.add(roofVault);
    const vaultGeo = new THREE.CylinderGeometry(R, R, LEN, 64, 1, true, 1.782, 2.72);
    vaultGeo.rotateX(Math.PI / 2);
    const vault = new THREE.Mesh(vaultGeo, new THREE.MeshStandardMaterial({
        map: concreteTex, roughness: 0.94, side: THREE.BackSide }));
    vault.position.y = CY;
    roofVault.add(vault);

    const floor = new THREE.Mesh(new THREE.PlaneGeometry(23.4, LEN), floorMat);
    floor.rotation.x = -Math.PI / 2;
    scene.add(world.ground(floor));

    const strip = (x, wdt, col) => {
        const m = new THREE.Mesh(new THREE.PlaneGeometry(wdt, LEN),
            new THREE.MeshStandardMaterial({ color: col, roughness: 0.85 }));
        m.rotation.x = -Math.PI / 2; m.position.set(x, 0.012, 0);
        scene.add(world.ghost(m));
    };
    strip(-9.9, 0.45, 0x8f8c86); strip(9.9, 0.45, 0x8f8c86);   // platform tactiles
    strip(-3.9, 0.3, 0xa5a29b); strip(3.9, 0.3, 0xa5a29b);     // concourse guides
    strip(0, 0.28, 0xa19e97);

    {   // aluminium slats over the centre, dark battens over the platforms
        const items = [];
        const slat = new THREE.BoxGeometry(0.36, 0.07, LEN);
        const rc = R - 0.28;
        const band = (a0, a1) => {
            for (let a = a0; a <= a1; a += 2.8) {
                const phi = a * Math.PI / 180;
                items.push({ geo: slat, m: M(Math.cos(phi) * rc, CY + Math.sin(phi) * rc, 0, 0, 0, phi) });
            }
        };
        band(66, 87); band(93, 114);
        roofVault.add(new THREE.Mesh(mergeGeos(items), slatMat));

        // dark timber vault bands over each platform (backing + batten ribs)
        const darkBack = new THREE.MeshStandardMaterial({ color: 0x15100c, roughness: 0.95 });
        const darkRib = new THREE.MeshStandardMaterial({ color: 0x2E241B, roughness: 0.8 });
        const backs = [], ribs = [];
        const backG = new THREE.BoxGeometry(1.15, 0.06, LEN);
        const ribG = new THREE.BoxGeometry(0.16, 0.1, LEN);
        for (const s2 of [-1, 1]) {
            for (let a = 13; a <= 57; a += 7) {
                const phi = (s2 > 0 ? a : 180 - a) * Math.PI / 180;
                backs.push({ geo: backG, m: M(Math.cos(phi) * (R - 0.14), CY + Math.sin(phi) * (R - 0.14), 0, 0, 0, phi) });
            }
            for (let a = 11.5; a <= 59; a += 1.6) {
                const phi = (s2 > 0 ? a : 180 - a) * Math.PI / 180;
                ribs.push({ geo: ribG, m: M(Math.cos(phi) * (R - 0.3), CY + Math.sin(phi) * (R - 0.3), 0, 0, 0, phi) });
            }
        }
        roofVault.add(new THREE.Mesh(mergeGeos(backs), darkBack));
        roofVault.add(new THREE.Mesh(mergeGeos(ribs), darkRib));

        // crown services: red conduit + steel pipes
        const conduit = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.07, LEN), redMat);
        conduit.position.set(0, CY + R - 0.16, 0); roofVault.add(conduit);
        const pipeG = new THREE.CylinderGeometry(0.045, 0.045, LEN, 8); pipeG.rotateX(Math.PI / 2);
        const p1 = new THREE.Mesh(pipeG, steelMat); p1.position.set(-0.55, CY + R - 0.2, 0); roofVault.add(p1);
        const p2 = p1.clone(); p2.position.x = 0.55; roofVault.add(p2);

        // magenta art panels on the vault flanks above the mezzanine
        const mag = [];
        const magG = new THREE.BoxGeometry(0.5, 0.09, 10);
        for (const s of [-1, 1]) for (let a = 58; a <= 74; a += 5.5) {
            const phi = (s > 0 ? a : 180 - a) * Math.PI / 180;
            mag.push({ geo: magG, m: M(Math.cos(phi) * (R - 0.34), CY + Math.sin(phi) * (R - 0.34), 0, 0, 0, phi) });
        }
        roofVault.add(new THREE.Mesh(mergeGeos(mag), magentaMat));
    }

    /* ============================================================
       4 · crossing orange arches + pendant lanterns
       ============================================================ */
    class ArchCurve extends THREE.Curve {
        constructor(sx, ex, z0, z1) { super(); this.sx = sx; this.ex = ex; this.z0 = z0; this.z1 = z1; }
        getPoint(t) {
            return new THREE.Vector3(
                this.sx + (this.ex - this.sx) * (1 - Math.cos(Math.PI * t)) / 2,
                ARCH_Y0 + ARCH_H * Math.sin(Math.PI * t),
                this.z0 + (this.z1 - this.z0) * t);
        }
    }
    {
        const shape = new THREE.Shape();
        shape.moveTo(-0.30, -0.09); shape.lineTo(0.30, -0.09);
        shape.lineTo(0.30, 0.09); shape.lineTo(-0.30, 0.09); shape.closePath();
        const archItems = [], steelItems = [], rodItems = [];
        const rodG = new THREE.CylinderGeometry(0.035, 0.035, 4.5, 8);
        const nodeG = new THREE.BoxGeometry(0.3, 0.55, 0.3);
        const brktG = new THREE.BoxGeometry(0.8, 0.5, 0.8);
        for (let z0 = -HALF + 1; z0 + BAY <= HALF - 0.99; z0 += BAY) {
            const z1 = z0 + BAY;
            archItems.push(
                { geo: new THREE.ExtrudeGeometry(shape, { steps: 56, bevelEnabled: false, extrudePath: new ArchCurve(-ARCH_X, ARCH_X, z0, z1) }) },
                { geo: new THREE.ExtrudeGeometry(shape, { steps: 56, bevelEnabled: false, extrudePath: new ArchCurve(ARCH_X, -ARCH_X, z0, z1) }) });
            const zc = z0 + BAY / 2;
            steelItems.push({ geo: nodeG, m: M(0, ARCH_Y0 + ARCH_H, zc) });
            rodItems.push({ geo: rodG, m: M(0, ARCH_Y0 + ARCH_H + 2.5, zc) });
        }
        for (let z = -HALF + 1; z <= HALF - 0.99; z += BAY) {
            steelItems.push({ geo: brktG, m: M(-ARCH_X - 0.1, BEAM_Y + BEAM_H / 2 + 0.25, z) });
            steelItems.push({ geo: brktG, m: M(ARCH_X + 0.1, BEAM_Y + BEAM_H / 2 + 0.25, z) });
        }
        roofVault.add(new THREE.Mesh(mergeGeos(archItems), orangeMat));
        roofVault.add(new THREE.Mesh(mergeGeos(steelItems), steelMat));
        roofVault.add(new THREE.Mesh(mergeGeos(rodItems), steelMat));
    }
    {   // pendant lanterns at every crossing
        const amber = [], cores = [], fins = [], rods = [];
        const rodG = new THREE.CylinderGeometry(0.022, 0.022, 2.6, 8);
        const capG = new THREE.CylinderGeometry(0.125, 0.125, 0.45, 14);
        const botG = new THREE.CylinderGeometry(0.125, 0.125, 0.38, 14);
        const coreG = new THREE.CylinderGeometry(0.105, 0.105, 0.26, 12);
        const finG = new THREE.CylinderGeometry(0.155, 0.155, 0.045, 16);
        const dotG = new THREE.CylinderGeometry(0.075, 0.075, 0.03, 12);
        for (let z0 = -HALF + 1; z0 + BAY <= HALF - 0.99; z0 += BAY) {
            const zc = z0 + BAY / 2;
            if (zc < -43.5) continue;
            if (zc > -6 && zc < 10) continue;      // the Exit 2 escalator rises here
            rods.push({ geo: rodG, m: M(0, 10.1, zc) });
            amber.push({ geo: capG, m: M(0, 8.68, zc) });
            for (let j = 0; j < 7; j++) {
                const y = 8.31 - j * 0.28;
                cores.push({ geo: coreG, m: M(0, y, zc) });
                fins.push({ geo: finG, m: M(0, y - 0.14, zc) });
            }
            amber.push({ geo: botG, m: M(0, 6.16, zc) });
            cores.push({ geo: dotG, m: M(0, 5.95, zc) });
        }
        roofVault.add(new THREE.Mesh(mergeGeos(rods), steelMat));
        roofVault.add(new THREE.Mesh(mergeGeos(amber), amberMat));
        roofVault.add(new THREE.Mesh(mergeGeos(cores), coreMat));
        roofVault.add(new THREE.Mesh(mergeGeos(fins), finMat));
    }

    /* ============================================================
       5 · blade columns, beams, fixtures, platform cone lamps
       ============================================================ */
    {
        const colItems = [], plinthItems = [], steelItems = [], lensItems = [];
        // blade column: two round ends + slab between (pill plan, long axis along z)
        const endG = new THREE.CylinderGeometry(0.42, 0.42, 4.6, 14);
        const midG = new THREE.BoxGeometry(0.84, 4.6, 1.7);
        const pEndG = new THREE.CylinderGeometry(0.5, 0.5, 0.24, 14);
        const pMidG = new THREE.BoxGeometry(1.0, 0.24, 1.7);
        const spotG = new THREE.CylinderGeometry(0.09, 0.09, 0.5, 12);
        const lensG = new THREE.CylinderGeometry(0.07, 0.07, 0.03, 12);
        for (let z = -HALF + 3; z <= HALF - 2; z += BAY) {
            for (const s of [-1, 1]) {
                const x = s * COL_X;
                colItems.push({ geo: midG, m: M(x, 2.3, z) });
                colItems.push({ geo: endG, m: M(x, 2.3, z - 0.85) });
                colItems.push({ geo: endG, m: M(x, 2.3, z + 0.85) });
                plinthItems.push({ geo: pMidG, m: M(x, 0.12, z) });
                plinthItems.push({ geo: pEndG, m: M(x, 0.12, z - 0.85) });
                plinthItems.push({ geo: pEndG, m: M(x, 0.12, z + 0.85) });
                // uplights on the beam top + downlights under the beam (platform side)
                steelItems.push({ geo: spotG, m: M(x - s * 0.2, BEAM_Y + BEAM_H / 2 + 0.35, z + 2.2, 0, 0, s * 0.45) });
                lensItems.push({ geo: lensG, m: M(x - s * 0.2 - Math.sin(s * 0.45) * 0.27, BEAM_Y + BEAM_H / 2 + 0.35 + Math.cos(s * 0.45) * 0.27, z + 2.2, 0, 0, s * 0.45) });
                steelItems.push({ geo: spotG, m: M(x + s * 0.55, BEAM_Y - BEAM_H / 2 - 0.3, z + 2.8, 0, 0, 0) });
                lensItems.push({ geo: lensG, m: M(x + s * 0.55, BEAM_Y - BEAM_H / 2 - 0.57, z + 2.8, 0, 0, 0) });
            }
        }
        roofVault.add(new THREE.Mesh(mergeGeos(colItems), columnMat));
        roofVault.add(new THREE.Mesh(mergeGeos(plinthItems), blackMat));
        roofVault.add(new THREE.Mesh(mergeGeos(steelItems), steelMat));
        roofVault.add(new THREE.Mesh(mergeGeos(lensItems), lensMat));

        // longitudinal beams the arches spring from
        for (const s of [-1, 1]) {
            const beam = new THREE.Mesh(new THREE.BoxGeometry(1.05, BEAM_H, LEN), columnMat);
            beam.position.set(s * COL_X, BEAM_Y, 0);
            roofVault.add(beam);
        }
        // the beam itself continues as a solid wall all the way up to the vault
        for (const s2 of [-1, 1]) {
            const upH = 8.0;
            const up = new THREE.Mesh(new THREE.BoxGeometry(0.9, upH, LEN), concreteMat);
            up.position.set(s2 * COL_X, BEAM_Y + BEAM_H / 2 + upH / 2, 0);
            roofVault.add(up);
        }

        // orange cone lamps over the platforms
        const coneItems = [], glowItems = [], stemItems = [];
        const coneG = new THREE.CylinderGeometry(0.3, 0.07, 0.36, 12, 1, true);
        const glowG = new THREE.CylinderGeometry(0.26, 0.26, 0.02, 12);
        const stemG = new THREE.CylinderGeometry(0.02, 0.02, 3.4, 6);
        const coneMat = new THREE.MeshStandardMaterial({ color: 0x453325, roughness: 0.55, metalness: 0.4, side: THREE.DoubleSide });
        for (let z = -HALF + 4; z <= HALF - 3; z += 5.5) {
            for (const s of [-1, 1]) {
                const x = s * 8.5;
                stemItems.push({ geo: stemG, m: M(x, 9.1, z) });
                coneItems.push({ geo: coneG, m: M(x, 7.35, z) });
                glowItems.push({ geo: glowG, m: M(x, 7.29, z) });
            }
        }
        roofVault.add(new THREE.Mesh(mergeGeos(stemItems), darkMetal));
        roofVault.add(new THREE.Mesh(mergeGeos(coneItems), coneMat));
        roofVault.add(new THREE.Mesh(mergeGeos(glowItems), coneGlowMat));
    }

    /* ============================================================
       6 · full-height platform screen doors
       ============================================================ */
    const psdMovers = { '1': null, '-1': null };
    {
        const psSteel = new THREE.MeshStandardMaterial({ color: 0xC9CCCE, roughness: 0.3, metalness: 0.6 });
        const leafMat = new THREE.MeshStandardMaterial({ color: 0x22262A, roughness: 0.08, metalness: 0.5,
            transparent: true, opacity: 0.72 });
        const louvreTex = tex(256, 256, (ctx, w, h) => {
            ctx.fillStyle = '#101112'; ctx.fillRect(0, 0, w, h);
            for (let x = 0; x < w; x += 10) {
                ctx.fillStyle = '#1E2022'; ctx.fillRect(x, 0, 5, h);
                ctx.fillStyle = '#070808'; ctx.fillRect(x + 5, 0, 5, h);
            }
        }, LEN / 2, 1);
        const arrowTex = tex(96, 64, (ctx, w, h) => {
            ctx.clearRect(0, 0, w, h);
            ctx.fillStyle = '#2C7BC4'; ctx.fillRect(8, 12, 80, 40);
            ctx.fillStyle = '#fff'; ctx.font = '700 34px Arial'; ctx.textBaseline = 'middle'; ctx.textAlign = 'center';
            ctx.fillText('→', w / 2, h / 2 + 2);
        });
        const arrowMat = new THREE.MeshBasicMaterial({ map: arrowTex, transparent: true });
        const STOP = 35.5;   // where a train's centre halts (front 21 of 30 doorways)
        const trainDoors = (typeof HCMT_DOORS !== 'undefined' && HCMT_DOORS.all ? HCMT_DOORS.all : [])
            .map(z => z + STOP);
        const extraDoors = [];
        for (const c of [-90.4, -113, -135.6]) {
            for (const o of [-7.85, -0.15, 6.75]) extraDoors.push(c + o + STOP);
        }
        const activeSet = new Set(trainDoors.map(z => z.toFixed(1)));
        const doorZBase = [...trainDoors, ...extraDoors].filter(z => Math.abs(z) < HALF - 1.6);
        const numTexs = { '1': tex(128, 128, (ctx, w, h) => {
                ctx.fillStyle = '#F4F4F1'; ctx.fillRect(0, 0, w, h);
                ctx.fillStyle = '#222'; ctx.font = '600 84px Arial'; ctx.textBaseline = 'middle'; ctx.textAlign = 'center';
                ctx.fillText('1', w / 2, h / 2 + 4); }),
            '-1': tex(128, 128, (ctx, w, h) => {
                ctx.fillStyle = '#F4F4F1'; ctx.fillRect(0, 0, w, h);
                ctx.fillStyle = '#222'; ctx.font = '600 84px Arial'; ctx.textBaseline = 'middle'; ctx.textAlign = 'center';
                ctx.fillText('2', w / 2, h / 2 + 4); }) };
        const leafG = new THREE.BoxGeometry(0.06, 2.52, 0.96);
        const arrowG = new THREE.PlaneGeometry(0.34, 0.22);
        const tileG = new THREE.PlaneGeometry(0.34, 0.34);
        for (const sd of [-1, 1]) {
            const x = sd * PSD_X;
            const rotY = sd > 0 ? -Math.PI / 2 : Math.PI / 2;
            const doorZ = sd > 0 ? doorZBase : doorZBase.map(z => -z);
            const frames = [], posts = [], glassGeos = [], tileGeos = [];
            const actL = [], actR = [], statLeaf = [], arrActL = [], arrActR = [], arrStat = [];
            frames.push({ geo: new THREE.BoxGeometry(0.14, 0.1, LEN), m: M(x, 0.05, 0) });
            frames.push({ geo: new THREE.BoxGeometry(0.2, 0.35, LEN), m: M(x, 2.75, 0) });
            const band = new THREE.Mesh(new THREE.PlaneGeometry(LEN, 2.0),
                new THREE.MeshStandardMaterial({ map: louvreTex, roughness: 0.7, metalness: 0.3 }));
            band.rotation.y = rotY; band.position.set(sd * (PSD_X + 0.06), 3.95, 0);
            scene.add(band);
            const led = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.07, LEN), ledMat);
            led.position.set(sd * (PSD_X - 0.25), 4.72, 0);
            scene.add(led);
            const sorted = [...doorZ].sort((a, b) => a - b);
            for (const dz of sorted) {
                const active = activeSet.has((sd > 0 ? dz : -dz).toFixed(1));
                for (const pz of [dz - 1.05, dz + 1.05]) {
                    posts.push({ geo: new THREE.BoxGeometry(0.15, 2.72, 0.15), m: M(x, 1.36, pz) });
                }
                for (const lr of [-1, 1]) {
                    const lm = M(x, 1.31, dz + lr * 0.48);
                    const am = M(sd * (PSD_X - 0.055), 1.5, dz + lr * 0.48, 0, rotY, 0);
                    if (active) {
                        (lr < 0 ? actL : actR).push({ geo: leafG, m: lm });
                        (lr < 0 ? arrActL : arrActR).push({ geo: arrowG, m: am });
                    } else {
                        statLeaf.push({ geo: leafG, m: lm });
                        arrStat.push({ geo: arrowG, m: am });
                    }
                }
                tileGeos.push({ geo: tileG, m: M(sd * (PSD_X + 0.02), 3.5, dz, 0, rotY, 0) });
            }
            const edges = [-HALF + 3.1, ...sorted.flatMap(z => [z - 1.05, z + 1.05]), HALF - 3.1];
            for (let i = 0; i < edges.length; i += 2) {
                const a = edges[i], b = edges[i + 1];
                if (b - a < 0.35) continue;
                glassGeos.push({ geo: new THREE.PlaneGeometry(b - a - 0.06, 2.55), m: M(x, 1.325, (a + b) / 2, 0, rotY, 0) });
                frames.push({ geo: new THREE.BoxGeometry(0.1, 0.08, b - a), m: M(x, 1.32, (a + b) / 2) });
                if (b - a > 3.4) frames.push({ geo: new THREE.BoxGeometry(0.09, 2.55, 0.08), m: M(x, 1.325, (a + b) / 2) });
            }
            scene.add(new THREE.Mesh(mergeGeos(frames), darkMetal));
            scene.add(new THREE.Mesh(mergeGeos(posts), psSteel));
            scene.add(new THREE.Mesh(mergeGeos(glassGeos), psdGlassMat));
            scene.add(new THREE.Mesh(mergeGeos(tileGeos), new THREE.MeshBasicMaterial({ map: numTexs[String(sd)] })));
            if (statLeaf.length) scene.add(new THREE.Mesh(mergeGeos(statLeaf), leafMat));
            if (arrStat.length) scene.add(new THREE.Mesh(mergeGeos(arrStat), arrowMat));
            const mv = {
                L: new THREE.Mesh(mergeGeos(actL), leafMat),
                R: new THREE.Mesh(mergeGeos(actR), leafMat),
                aL: new THREE.Mesh(mergeGeos(arrActL), arrowMat),
                aR: new THREE.Mesh(mergeGeos(arrActR), arrowMat),
            };
            for (const k2 of ['L', 'R', 'aL', 'aR']) scene.add(mv[k2]);
            psdMovers[String(sd)] = mv;
        }
    }

    /* ============================================================
       7 · escalators (shared builder)
       ============================================================ */


    /* ============================================================
       8 · Exit 1 mezzanine (mid-station), info box, lifts, Exit 2
       ============================================================ */
    {   // ---- Exit 1 lift wall: full-height glazed wall closing the -z end ----
        const WALL_Z = -105, WW = 10.4, WH = 11.0;
        const px = 1024;
        const mx = (m) => (m / WW + 0.5) * px;          // metres (x, centred) -> canvas x
        const my = (m) => (1 - m / WH) * px;            // metres (height)     -> canvas y
        const liftWallTex = tex(px, px, (ctx) => {
            // glazed white panels with a soft sheen
            ctx.fillStyle = '#E7E8E3'; ctx.fillRect(0, 0, px, px);
            const g = ctx.createLinearGradient(0, 0, 0, px);
            g.addColorStop(0, 'rgba(200,203,198,0.25)');
            g.addColorStop(0.55, 'rgba(255,255,255,0.18)');
            g.addColorStop(1, 'rgba(210,212,206,0.2)');
            ctx.fillStyle = g; ctx.fillRect(0, 0, px, px);
            for (let i = 0; i < 40; i++) {              // faint per-panel tone shifts
                ctx.fillStyle = `rgba(${205 + Math.floor(Math.random() * 20)},${207 + Math.floor(Math.random() * 18)},${202 + Math.floor(Math.random() * 18)},0.12)`;
                ctx.fillRect(Math.floor(Math.random() * 8) * 128, Math.floor(Math.random() * 8) * 128, 128, 128);
            }
            // dark joint grid
            ctx.strokeStyle = '#3A3B3D'; ctx.lineWidth = 3;
            for (let x = 128; x < px; x += 128) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, px); ctx.stroke(); }
            for (const h of [10.2, 8.8, 7.4, 6.0, 4.6, 1.7]) {
                ctx.beginPath(); ctx.moveTo(0, my(h)); ctx.lineTo(px, my(h)); ctx.stroke();
            }
            // heavier lintel line over the door zone
            ctx.strokeStyle = '#2E2F31'; ctx.lineWidth = 6;
            ctx.beginPath(); ctx.moveTo(0, my(3.4)); ctx.lineTo(px, my(3.4)); ctx.stroke();
            // base skirt
            ctx.fillStyle = '#1A1B1C'; ctx.fillRect(0, my(0.12), px, px - my(0.12));
            // two lift doors + navy headers + yellow Exit 1 chips
            for (const cxm of [-2.6, 2.6]) {
                const dx = mx(cxm - 0.8), dw = mx(cxm + 0.8) - dx;
                const dy = my(2.45), dh = my(0.12) - dy;
                ctx.fillStyle = '#5F6367'; ctx.fillRect(dx - 8, dy - 8, dw + 16, dh + 8);   // frame
                const dg = ctx.createLinearGradient(dx, 0, dx + dw, 0);                     // brushed doors
                dg.addColorStop(0, '#B2B6BA'); dg.addColorStop(0.5, '#9FA3A7'); dg.addColorStop(1, '#AEB2B6');
                ctx.fillStyle = dg; ctx.fillRect(dx, dy, dw, dh);
                ctx.strokeStyle = '#6A6E72'; ctx.lineWidth = 4;
                ctx.beginPath(); ctx.moveTo(dx + dw / 2, dy); ctx.lineTo(dx + dw / 2, dy + dh); ctx.stroke();
                // navy header band
                const bx = mx(cxm - 1.15), bw = mx(cxm + 1.15) - bx;
                ctx.fillStyle = '#161E2A'; ctx.fillRect(bx, my(3.25), bw, my(2.62) - my(3.25));
                ctx.fillStyle = '#F5C400'; ctx.fillRect(bx + 8, my(2.86), 74, my(2.62) - my(2.86));
                ctx.fillStyle = '#161E2A'; ctx.font = '600 20px Arial'; ctx.textBaseline = 'middle';
                ctx.fillText('Exit 1', bx + 14, (my(2.86) + my(2.62)) / 2);
                ctx.fillStyle = '#fff'; ctx.font = '600 34px Arial';
                ctx.fillText('Lifts', bx + bw / 2 - 20, (my(3.25) + my(2.86)) / 2);
                ctx.fillStyle = '#2C7BC4'; ctx.fillRect(bx + bw / 2 - 62, (my(3.25) + my(2.86)) / 2 - 15, 30, 30);
                // accessibility square beside the door
                ctx.fillStyle = '#2C7BC4'; ctx.fillRect(mx(cxm + 0.95), my(2.35), 17, 17);
                // call button plate
                ctx.fillStyle = '#8F9397'; ctx.fillRect(mx(cxm - 1.05), my(1.35), 14, 40);
            }
        });
        const liftWallMat = new THREE.MeshStandardMaterial({ map: liftWallTex, roughness: 0.28, metalness: 0.05,
            emissive: 0xCBCDC8, emissiveMap: liftWallTex, emissiveIntensity: 0.16 });
        const wall = new THREE.Mesh(new THREE.PlaneGeometry(WW, WH), liftWallMat);
        wall.position.set(0, WH / 2, WALL_Z);
        scene.add(wall);

        // twin-arm wall luminaire high on the wall
        {
            const grp = new THREE.Group();
            const plate = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.5, 0.06), steelMat);
            plate.position.set(0, 6.35, WALL_Z + 0.04); grp.add(plate);
            const stemG = new THREE.CylinderGeometry(0.03, 0.03, 0.55, 8); stemG.rotateX(Math.PI / 2);
            const stem = new THREE.Mesh(stemG, steelMat);
            stem.position.set(0, 6.35, WALL_Z + 0.32); grp.add(stem);
            const arm = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.05, 0.05), steelMat);
            arm.position.set(0, 6.35, WALL_Z + 0.6); grp.add(arm);
            for (const sx of [-0.8, 0.8]) {
                const head = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.26, 10), steelMat);
                head.position.set(sx, 6.2, WALL_Z + 0.6); grp.add(head);
                const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.02, 10), lensMat);
                lens.position.set(sx, 6.06, WALL_Z + 0.6); grp.add(lens);
            }
            scene.add(grp);
        }
        // steel cylinder totem (fire services cabinet) against the wall centre
        {
            const tot = new THREE.Mesh(new THREE.CylinderGeometry(0.33, 0.33, 2.3, 20), steelMat);
            tot.position.set(0, 1.15, WALL_Z + 0.6);
            scene.add(tot);
            const band = new THREE.Mesh(new THREE.CylinderGeometry(0.335, 0.335, 0.4, 20), darkMetal);
            band.position.set(0, 1.95, WALL_Z + 0.6);
            scene.add(band);
        }
        // low bench against the wall between the lift doors
        {
            const g = new THREE.Group();
            const pl = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.1, 0.5),
                new THREE.MeshStandardMaterial({ color: 0x6E6B66, roughness: 0.7, metalness: 0.15 }));
            pl.position.y = 0.05; g.add(pl);
            const seatMat = new THREE.MeshStandardMaterial({ color: 0x8B9094, roughness: 0.45, metalness: 0.4 });
            for (let i = 0; i < 4; i++) {
                const slat = new THREE.Mesh(new THREE.BoxGeometry(1.75, 0.035, 0.09), seatMat);
                slat.position.set(0, 0.45, -0.17 + i * 0.11);
                g.add(slat);
            }
            g.position.set(-1.1, 0, WALL_Z + 0.55);
            world.part('bench_lift', g);
            scene.add(g);
        }
        // tactile mats at each lift door + the mosaic floor artwork inlay
        for (const sx of [-2.6, 2.6]) {
            const mat = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.9),
                new THREE.MeshStandardMaterial({ color: 0x8f8c86, roughness: 0.85 }));
            mat.rotation.x = -Math.PI / 2;
            mat.position.set(sx, 0.013, WALL_Z + 1.2);
            scene.add(world.ghost(mat));
        }
        {
            const artTex = tex(512, 256, (ctx, w, h) => {
                ctx.clearRect(0, 0, w, h);
                ctx.globalAlpha = 0.8;
                for (let k = 0; k < 3; k++) {                       // three winding mosaic trails
                    let px2 = w * (0.18 + k * 0.1), py2 = h * (0.3 + k * 0.22), ang = 0.3 - k * 0.3;
                    for (let i = 0; i < 46; i++) {
                        ang += (Math.random() - 0.5) * 0.7;
                        px2 += Math.cos(ang) * 13; py2 += Math.sin(ang) * 7;
                        if (px2 < 10 || px2 > w - 10 || py2 < 8 || py2 > h - 8) break;
                        ctx.fillStyle = ['#B0713B', '#8A5A33', '#C9955A', '#6E4A2C'][Math.floor(Math.random() * 4)];
                        ctx.save(); ctx.translate(px2, py2); ctx.rotate(ang);
                        ctx.fillRect(-6, -2, 12, 4); ctx.restore();
                    }
                }
                ctx.globalAlpha = 1;
            });
            const art = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 2.1),
                new THREE.MeshStandardMaterial({ map: artTex, transparent: true, roughness: 0.85 }));
            art.rotation.x = -Math.PI / 2;
            art.position.set(0, 0.014, -100.5);
            scene.add(world.ghost(art));
        }
    }

    /* ============================================================
       9 · signage
       ============================================================ */
    function textSign(w, h, drawFn, opts = {}) {
        const px = Math.round(256 * w / h);
        const t = tex(px, 256, drawFn);
        const face = new THREE.MeshStandardMaterial({
            map: t, roughness: 0.6, metalness: 0.05,
            emissive: opts.glow ? 0xffffff : 0x000000,
            emissiveMap: opts.glow ? t : null,
            emissiveIntensity: opts.glow ? 0.85 : 0 });
        const edge = new THREE.MeshStandardMaterial({ color: opts.edge || 0x222325, roughness: 0.6 });
        const g = new THREE.BoxGeometry(w, h, opts.t || 0.08);
        g.clearGroups();
        g.addGroup(0, 24, 0);      // the four edge faces
        g.addGroup(24, 12, 1);     // front + back
        return new THREE.Mesh(g, [edge, face]);
    }
    function hangRods(group, sign, topY, spread) {
        const g = new THREE.CylinderGeometry(0.016, 0.016, 1, 6);
        const y0 = sign.position.y + 0.3, hgt = topY - y0;
        for (const s of [-1, 1]) {
            const rod = new THREE.Mesh(g, darkMetal);
            rod.scale.y = hgt;
            rod.position.set(sign.position.x + s * spread, y0 + hgt / 2, sign.position.z);
            group.add(rod);
        }
    }
    const mkExit = (title, line2, sub) => (ctx, w, h) => {
        ctx.fillStyle = '#101112'; ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = '#F5C400'; ctx.font = '700 72px Arial'; ctx.textBaseline = 'middle';
        ctx.fillText(title, 40, h * 0.3);
        ctx.fillStyle = '#fff'; ctx.font = '400 46px Arial';
        ctx.fillText(line2, 40, h * 0.62);
        if (sub) {
            ctx.fillStyle = '#2C7BC4'; ctx.fillRect(30, h * 0.78, w - 60, h * 0.18);
            ctx.fillStyle = '#fff'; ctx.font = '500 34px Arial';
            ctx.fillText(sub, 44, h * 0.87);
        }
        ctx.strokeStyle = '#F5C400'; ctx.lineWidth = 9; ctx.lineCap = 'round';
        const ax = w - 84, ay = h * 0.3;
        ctx.beginPath(); ctx.moveTo(ax, ay + 26); ctx.lineTo(ax, ay - 26);
        ctx.moveTo(ax - 20, ay - 6); ctx.lineTo(ax, ay - 28); ctx.lineTo(ax + 20, ay - 6); ctx.stroke();
    };
    const drawPlat1 = (ctx, w, h) => {
        ctx.fillStyle = '#F4F4F1'; ctx.fillRect(0, 0, w, h);
        ctx.textBaseline = 'middle'; ctx.fillStyle = '#2E2E2E'; ctx.font = '500 64px Arial';
        ctx.fillText('Sunbury', 50, h / 2);
        ctx.fillStyle = '#2C7BC4'; ctx.fillRect(w - 320, h * 0.15, 7, h * 0.7);
        ctx.fillStyle = '#2E2E2E'; ctx.font = '600 100px Arial';
        ctx.fillText('1', w - 285, h / 2);
        ctx.font = '500 90px Arial'; ctx.fillText('→', w - 180, h / 2);
    };
    const drawPlat2 = (ctx, w, h) => {
        ctx.fillStyle = '#F4F4F1'; ctx.fillRect(0, 0, w, h);
        ctx.textBaseline = 'middle'; ctx.fillStyle = '#2E2E2E';
        ctx.font = '500 90px Arial'; ctx.fillText('←', 40, h / 2);
        ctx.font = '600 100px Arial'; ctx.fillText('2', 175, h / 2);
        ctx.fillStyle = '#2C7BC4'; ctx.fillRect(275, h * 0.15, 7, h * 0.7);
        ctx.fillStyle = '#2E2E2E'; ctx.font = '500 52px Arial';
        ctx.fillText('Cranbourne', 320, h * 0.34);
        ctx.fillText('or Pakenham', 320, h * 0.68);
    };
    const drawNameFor = (nm, e1, e2) => (ctx, w, h) => {
        ctx.fillStyle = '#F6F6F3'; ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = '#2C7BC4'; ctx.fillRect(0, 0, w, h * 0.06);
        ctx.fillStyle = '#1E1E1E'; ctx.font = '600 64px Arial'; ctx.textBaseline = 'middle';
        ctx.fillText(nm, 40, h * 0.22);
        ctx.fillStyle = '#101112'; ctx.fillRect(0, h * 0.38, w, h * 0.62);
        ctx.fillStyle = '#F5C400'; ctx.font = '600 44px Arial';
        ctx.fillText('← Exit 1', 40, h * 0.52);
        ctx.fillStyle = '#fff'; ctx.font = '400 32px Arial';
        ctx.fillText(e1, 52, h * 0.63);
        ctx.fillStyle = '#2C7BC4'; ctx.fillRect(30, h * 0.7, w - 60, h * 0.11);
        ctx.fillStyle = '#fff'; ctx.font = '500 30px Arial';
        ctx.fillText('M  Melbourne Central Station  210m', 44, h * 0.755);
        ctx.fillStyle = '#F5C400'; ctx.font = '600 40px Arial';
        ctx.fillText('Exit 2 →', w - 260, h * 0.88);
        ctx.fillStyle = '#fff'; ctx.font = '400 30px Arial';
        ctx.fillText(e2, w - 250, h * 0.96 - 6);
    };
    const plate = (num) => (ctx, w, h) => {
        ctx.fillStyle = '#F4F4F1'; ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = '#2E2E2E'; ctx.font = '600 170px Arial'; ctx.textBaseline = 'middle';
        ctx.fillText(num, 55, h / 2 + 8);
        ctx.fillStyle = '#2C7BC4'; ctx.fillRect(w - 72, 30, 12, h - 60);
    };

    let signN = 0;
    function hungSign(w, h, drawFn, x, y, z, topY, spread, opts) {
        const grp = new THREE.Group();
        const s = textSign(w, h, drawFn, opts);
        s.position.set(x, y, z);
        grp.add(s);
        if (topY) hangRods(grp, s, topY, spread);
        world.part(`sign_${String(signN++).padStart(2, '0')}`, grp);
        scene.add(grp);
        return grp;
    }
    // Exit 1 (mid-station) and Exit 2 (end) hanging signs
    hungSign(2.5, 0.8, mkExit('Exit 1', 'Lifts to Swanston St', 'M Melbourne Central Station'), 0, 5.0, -19.5, 9.4, 0.9);
    hungSign(2.5, 0.8, mkExit('Exit 1', 'Lifts to Swanston St', 'M Melbourne Central Station'), 0, 5.0, 19.5, 9.4, 0.9);
    hungSign(2.1, 0.6, mkExit('Exit 2', 'Franklin Street'), -3.0, 5.1, 92, 10.4, 0.7);
    hungSign(2.1, 0.6, mkExit('Exit 2', 'Franklin Street'), 3.0, 5.1, 92, 10.4, 0.7);
    hungSign(2.4, 0.78, mkExit('Exit 1', 'Lifts to Swanston St', 'M Melbourne Central Station  70m'), -3.6, 5.0, -102.6, 9.2, 0.85);
    hungSign(2.4, 0.78, mkExit('Exit 1', 'Lifts to Swanston St', 'M Melbourne Central Station  70m'), 3.6, 5.0, -102.6, 9.2, 0.85);
    // white destination signs over each platform
    for (const [x, z, fn] of [[-8.8, -26, drawPlat2], [8.8, -26, drawPlat1], [-8.8, 30, drawPlat2], [8.8, 30, drawPlat1], [-8.8, -75, drawPlat2], [8.8, -75, drawPlat1], [-8.8, 76, drawPlat2], [8.8, 76, drawPlat1]]) {
        hungSign(2.6, 0.62, fn, x, 4.6, z, 10.4, 0.9, { edge: 0xd9d9d6 });
    }
    // station name signs on the blade columns, facing the platforms
    let nameMat, nameTexSL, nameTexTH, nameTexAN;
    {
        nameTexSL = tex(640, 420, drawNameFor('State Library', 'Swanston St', 'Franklin St'));
        nameTexTH = tex(640, 420, drawNameFor('Town Hall', 'Collins St', 'City Square'));
        nameTexAN = tex(640, 420, drawNameFor('Anzac', 'St Kilda Rd', 'Domain Rd'));
        const t = nameTexSL;
        const m = new THREE.MeshStandardMaterial({ map: t, roughness: 0.55 });
        nameMat = m;
        const g = new THREE.PlaneGeometry(1.5, 0.98);
        for (let z = -HALF + 9; z <= HALF - 6; z += BAY * 3) {
            for (const s of [-1, 1]) {
                const p = new THREE.Mesh(g, m);
                p.position.set(s * (COL_X + 0.45), 3.0, z);
                p.rotation.y = s > 0 ? -Math.PI / 2 : Math.PI / 2;
                roofVault.add(p);
            }
        }
    }
    // platform number plates on Y-brackets at the beams
    {
        const t1 = tex(256, 256, plate('1')), t2 = tex(256, 256, plate('2'));
        const e = new THREE.MeshStandardMaterial({ color: 0xd9d9d6, roughness: 0.6 });
        for (let z = -HALF + 9; z <= HALF - 6; z += BAY * 4) {
            for (const s of [-1, 1]) {
                const m = new THREE.MeshStandardMaterial({ map: s > 0 ? t1 : t2, roughness: 0.6 });
                const p = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.05), [e, e, e, e, m, m]);
                p.position.set(s * (COL_X - 0.2), BEAM_Y - BEAM_H / 2 - 0.45, z + 3);
                roofVault.add(p);
                const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.25, 6), darkMetal);
                stem.position.set(s * (COL_X - 0.2), BEAM_Y - BEAM_H / 2 - 0.12, z + 3);
                roofVault.add(stem);
            }
        }
    }
    // live departure screens under the beams, facing the platforms
    const pids = [];
    {
        const mk = (side, z, idx) => {
            const canvas = document.createElement('canvas');
            canvas.width = 432; canvas.height = 256;
            const t = new THREE.CanvasTexture(canvas);
            t.colorSpace = THREE.SRGBColorSpace;
            const face = new THREE.MeshStandardMaterial({
                map: t, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: 0.85, roughness: 0.6 });
            const edge = new THREE.MeshStandardMaterial({ color: 0x1a1b1c, roughness: 0.6 });
            const bg = new THREE.BoxGeometry(1.3, 0.78, 0.1);
            bg.clearGroups(); bg.addGroup(0, 24, 0); bg.addGroup(24, 12, 1);
            const s = new THREE.Mesh(bg, [edge, face]);
            s.position.set(side * (COL_X + 0.35), 3.85, z);
            s.rotation.y = side > 0 ? -Math.PI / 2 : Math.PI / 2;
            s.rotation.z = side > 0 ? -0.08 : 0.08;
            const grp = new THREE.Group(); grp.add(s);
            world.part(`screen_pid_${idx}`, grp);
            roofVault.add(grp);
            pids.push({ canvas, t, side, z, offset: idx * 2 });
        };
        mk(1, -104, 0); mk(-1, -30, 1); mk(1, 26, 2); mk(-1, 104, 3);
    }
    function drawPIDNow(p, tSec) {
        const ctx = p.canvas.getContext('2d'), w = p.canvas.width, h = p.canvas.height;
        const lead = p.side > 0 ? 'Sunbury' : 'Cranbourne';
        const alts = p.side > 0 ? ['Watergardens', 'Sunbury'] : ['Pakenham', 'East Pakenham'];
        const min0 = ((3 + p.offset - Math.floor(tSec / 45)) % 15 + 15) % 15;
        ctx.fillStyle = '#F2F4F6'; ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = '#123A63'; ctx.fillRect(0, 0, w, 58);
        ctx.fillStyle = '#fff'; ctx.font = '600 34px Arial'; ctx.textBaseline = 'middle';
        ctx.fillText(`6:0${(p.offset + 8) % 10}pm  ${lead}`, 16, 29);
        ctx.fillStyle = '#0F2338'; ctx.fillRect(w - 118, 8, 104, 42);
        ctx.fillStyle = '#FFD34D'; ctx.font = '600 30px Arial';
        ctx.fillText(min0 === 0 ? 'Now' : `${min0} min`, w - 104, 29);
        ctx.fillStyle = '#4A5560'; ctx.font = '400 22px Arial';
        ctx.fillText('Express via Metro Tunnel', 16, 78);
        ctx.strokeStyle = '#2C7BC4'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(26, 100); ctx.lineTo(26, h - 40); ctx.stroke();
        ctx.fillStyle = '#2E3338'; ctx.font = '400 24px Arial';
        const stops = ['State Library', 'Town Hall', 'Anzac', 'Caulfield', alts[0], alts[1]];
        for (let i = 0; i < stops.length; i++) {
            ctx.beginPath(); ctx.arc(26, 112 + i * 22, 4, 0, 7);
            ctx.fillStyle = i === 0 ? '#2C7BC4' : '#8A949C'; ctx.fill();
            ctx.fillStyle = '#2E3338'; ctx.fillText(stops[i], 44, 112 + i * 22);
        }
        p.t.needsUpdate = true;
    }
    pids.forEach(p => drawPIDNow(p, 0));

    /* ============================================================
       10 · benches
       ============================================================ */
    const benchFrame = new THREE.MeshStandardMaterial({ color: 0x8B9094, roughness: 0.45, metalness: 0.4 });
    const benchPlinthMat = new THREE.MeshStandardMaterial({ color: 0x6E6B66, roughness: 0.7, metalness: 0.15 });
    let benchN = 0;
    function bench(x, z, ry) {
        const g = new THREE.Group();
        const plinth = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.1, 0.85), benchPlinthMat);
        plinth.position.y = 0.05; g.add(plinth);
        const items = [];
        for (const [yy, zz] of [[0.62, 0], [0.78, 0.01], [0.94, 0.02]]) {
            items.push({ geo: new THREE.BoxGeometry(2.55, 0.07, 0.04), m: M(0, yy, zz) });
        }
        for (const sx of [-1.2, 0, 1.2]) {
            items.push({ geo: new THREE.BoxGeometry(0.05, 0.55, 0.05), m: M(sx, 0.72, 0) });
        }
        for (const s2 of [-1, 1]) for (let i = 0; i < 4; i++) {
            items.push({ geo: new THREE.BoxGeometry(2.55, 0.035, 0.09), m: M(0, 0.46, s2 * (0.1 + i * 0.1)) });
        }
        g.add(new THREE.Mesh(mergeGeos(items), benchFrame));
        g.position.set(x, 0, z);
        if (ry) g.rotation.y = ry;
        world.part(`bench_${String(benchN).padStart(2, '0')}`, g); benchN++;
        scene.add(g);
    }
    bench(0, -88); bench(0, -70); bench(-2.2, -20); bench(2.2, 10); bench(0, 58); bench(2.2, 84);

    /* ============================================================
       10b · track cavities + HCMTs passing through
       ============================================================ */
    const TL = 940;                      // tunnel length either side of centre
    for (const s2 of [-1, 1]) {
        const slab = new THREE.Mesh(new THREE.BoxGeometry(4.8, 0.3, TL),
            new THREE.MeshStandardMaterial({ color: 0x232426, roughness: 0.95 }));
        slab.position.set(s2 * 13.15, -1.2, 0);
        scene.add(slab);
        const railMat = new THREE.MeshStandardMaterial({ color: 0x8A8D8F, roughness: 0.35, metalness: 0.7 });
        for (const rr of [-0.72, 0.72]) {
            const rail = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.17, TL), railMat);
            rail.position.set(s2 * 13.15 + rr, -0.915, 0);
            scene.add(rail);
        }
        const wallT = new THREE.Mesh(new THREE.BoxGeometry(0.3, 7.2, LEN + 4),
            new THREE.MeshStandardMaterial({ color: 0x121314, roughness: 0.95 }));
        wallT.position.set(s2 * 15.6, 2.2, 0);
        scene.add(wallT);
        const soffit = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.2, LEN + 4),
            new THREE.MeshStandardMaterial({ color: 0x0C0D0E, roughness: 0.95 }));
        soffit.position.set(s2 * 13.6, 5.15, 0);
        scene.add(soffit);
        const edge = new THREE.Mesh(new THREE.BoxGeometry(0.28, 1.35, LEN),
            new THREE.MeshStandardMaterial({ color: 0x3A3A3C, roughness: 0.85 }));
        edge.position.set(s2 * 11.52, -0.62, 0);
        scene.add(edge);
        for (const lz of (s2 > 0 ? [34] : [-34])) {                   // light the dwell zone
            const cl = new THREE.PointLight(0xEDE9DF, 110, 34, 2);
            cl.position.set(s2 * 12.45, 3.1, lz);
            scene.add(cl);
        }
    }
    {   // TBM running tunnels beyond the cavern (segmented rings, trays, catwalk, lights)
        const ringTex = tex(256, 512, (ctx, w, h) => {
            ctx.fillStyle = '#B9B7B2'; ctx.fillRect(0, 0, w, h);
            for (let i = 0; i < 1400; i++) {
                ctx.fillStyle = `rgba(${Math.random() < 0.5 ? '138,136,130' : '205,203,197'},${Math.random() * 0.15})`;
                ctx.fillRect(Math.random() * w, Math.random() * h, 1.6, 1.6);
            }
            ctx.strokeStyle = 'rgba(90,88,84,0.55)'; ctx.lineWidth = 4;
            for (let y = 0; y <= h; y += 128) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
            ctx.lineWidth = 2.5;
            for (let y = 0; y < h; y += 128) {
                const off = (y / 128) % 2 ? 64 : 0;
                for (let x = off; x <= w; x += 128) {
                    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + 128); ctx.stroke();
                }
            }
        }, 5, 1);
        const tubeMat = new THREE.MeshStandardMaterial({ map: ringTex, roughness: 0.92, side: THREE.BackSide });
        const trayMat = new THREE.MeshStandardMaterial({ color: 0x8E9194, roughness: 0.5, metalness: 0.5 });
        const walkMat = new THREE.MeshStandardMaterial({ color: 0xA9A7A0, roughness: 0.8 });
        const tubeLight = new THREE.MeshStandardMaterial({ color: 0x888888, emissive: 0xE8EDEE, emissiveIntensity: 1.6 });
        for (const s2 of [-1, 1]) {
            const xc = s2 * 13.15;
            for (const [z0, z1] of [[HALF, 470], [-470, -HALF]]) {
                const len = z1 - z0, zc = (z0 + z1) / 2;
                const cg = new THREE.CylinderGeometry(3.45, 3.45, len, 20, 1, true);
                cg.rotateX(Math.PI / 2);
                const tube = new THREE.Mesh(cg, tubeMat);
                const rt = ringTex.clone(); rt.needsUpdate = true; rt.repeat.set(5, Math.abs(len) / 1.75);
                tube.material = tubeMat.clone(); tube.material.map = rt;
                tube.position.set(xc, 2.0, zc);
                scene.add(tube);
                const items = [];
                items.push({ geo: new THREE.BoxGeometry(0.4, 0.12, Math.abs(len)), m: M(xc - s2 * 3.05, 3.3, zc) });
                items.push({ geo: new THREE.BoxGeometry(0.35, 0.1, Math.abs(len)), m: M(xc - s2 * 3.2, 2.2, zc) });
                scene.add(new THREE.Mesh(mergeGeos(items), trayMat));
                const walk = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.1, Math.abs(len)), walkMat);
                walk.position.set(xc + s2 * 2.35, -0.55, zc);
                scene.add(walk);
                const rail = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, Math.abs(len)), trayMat);
                rail.position.set(xc + s2 * 2.85, 0.45, zc);
                scene.add(rail);
                const dots = [];
                const dotG = new THREE.BoxGeometry(0.5, 0.07, 0.14);
                for (let z = z0 + 8 * Math.sign(len); Math.abs(z - z0) < Math.abs(len); z += 16 * Math.sign(len)) {
                    dots.push({ geo: dotG, m: M(xc - s2 * 2.6, 4.6, z, 0, 0, s2 * 0.5) });
                }
                scene.add(new THREE.Mesh(mergeGeos(dots), tubeLight));
            }
        }
    }
    const trains = [];
    let heroTrain;
    {
        heroTrain = buildHCMT(THREE, (w, h, fn) => world.canvasTexture(w, h, fn));
        heroTrain.position.set(13.15, -0.83, -260);
        scene.add(world.ground(heroTrain));   // solid: you can stand inside it
        // a little light aboard so the ride isn't pitch black in the tunnel
        for (const lz of [33]) {
            const cab = new THREE.PointLight(0xF2EFE6, 22, 18, 2);
            cab.position.set(13.15, 2.4, lz);
            heroTrain.userData.keepLit = true;
            scene.add(cab);
            cab.userData.followTrain = lz - 35.5;   // offset from stop point
            trains.push({ light: cab });
        }
    }
    // The other direction. Its own build (a clone would lose the door rig),
    // turned about so its doors face platform 2.
    const train2 = buildHCMT(THREE, (w, h, fn) => world.canvasTexture(w, h, fn));
    train2.rotation.y = Math.PI;
    train2.position.set(-13.15, -0.83, 260);
    scene.add(world.ground(train2));

    /* ============================================================
       11 · end walls
       ============================================================ */
    {
        // concourse end walls (the lift wall handles most of the -z end)
        for (const s2 of [-1, 1]) {
            const wall = new THREE.Mesh(new THREE.BoxGeometry(11.8, 14.5, 0.6), concreteMat);
            wall.position.set(0, 6.5, s2 * (HALF + 0.3));
            scene.add(wall);
        }
        // fire-door texture for the platform end walls
        const fireDoorTex = tex(384, 480, (ctx, w, h) => {
            ctx.fillStyle = '#9A9DA0'; ctx.fillRect(0, 0, w, h);
            ctx.strokeStyle = '#6E7174'; ctx.lineWidth = 8;
            ctx.strokeRect(6, 6, w - 12, h - 12);
            ctx.beginPath(); ctx.moveTo(w / 2, 10); ctx.lineTo(w / 2, h - 10); ctx.stroke();
            ctx.fillStyle = '#7E8184';                                  // push bars + kick plates
            ctx.fillRect(30, h * 0.52, w / 2 - 45, 14); ctx.fillRect(w / 2 + 15, h * 0.52, w / 2 - 45, 14);
            ctx.fillStyle = '#8A8D90'; ctx.fillRect(14, h - 70, w - 28, 56);
            ctx.fillStyle = '#F5C400'; ctx.fillRect(w * 0.1, h * 0.16, w * 0.34, h * 0.11);   // alarm warning
            ctx.fillStyle = '#111'; ctx.font = '600 15px Arial';
            ctx.fillText('WARNING', w * 0.13, h * 0.21);
            ctx.fillText('DOOR ALARMED', w * 0.11, h * 0.245);
            ctx.fillStyle = '#EDEEEA'; ctx.fillRect(w * 0.56, h * 0.15, w * 0.32, h * 0.14);  // notice sheets
            ctx.fillStyle = '#2E7D46'; ctx.fillRect(w * 0.56, h * 0.33, w * 0.2, h * 0.06);
        });
        const fireDoorMat = new THREE.MeshStandardMaterial({ map: fireDoorTex, roughness: 0.6, metalness: 0.2 });
        const exitMat = new THREE.MeshStandardMaterial({ color: 0x2AA05A, emissive: 0x2AE07A, emissiveIntensity: 0.9 });
        const staffTex = tex(256, 96, (ctx, w, h) => {
            ctx.fillStyle = '#F2F2EF'; ctx.fillRect(0, 0, w, h);
            ctx.fillStyle = '#333'; ctx.font = '600 22px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText('Authorised staff only', w / 2, h / 2);
        });
        const staffMat = new THREE.MeshBasicMaterial({ map: staffTex });
        const endGlass = new THREE.MeshStandardMaterial({ color: 0x8FA0A8, roughness: 0.08, metalness: 0.4,
            transparent: true, opacity: 0.35 });
        const endBand = new THREE.MeshStandardMaterial({ color: 0x141517, roughness: 0.5, metalness: 0.4 });
        const psSteel2 = new THREE.MeshStandardMaterial({ color: 0xC9CCCE, roughness: 0.3, metalness: 0.6 });
        const gridTex = tex(256, 256, (ctx, w, h) => {
            ctx.fillStyle = '#0E1013'; ctx.fillRect(0, 0, w, h);
            const g = ctx.createLinearGradient(0, 0, w, h);
            g.addColorStop(0, 'rgba(70,76,82,0.18)'); g.addColorStop(0.5, 'rgba(20,22,24,0)'); g.addColorStop(1, 'rgba(60,66,72,0.12)');
            ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
            ctx.strokeStyle = '#2A2D31'; ctx.lineWidth = 4;
            for (let i = 0; i <= 4; i++) {
                ctx.beginPath(); ctx.moveTo(i * w / 4, 0); ctx.lineTo(i * w / 4, h); ctx.stroke();
                ctx.beginPath(); ctx.moveTo(0, i * h / 4); ctx.lineTo(w, i * h / 4); ctx.stroke();
            }
        }, 1.5, 1.6);
        const darkWallMat = new THREE.MeshStandardMaterial({ map: gridTex, roughness: 0.16, metalness: 0.55 });
        const redSignMat = new THREE.MeshStandardMaterial({ color: 0xB02020, emissive: 0x701010, emissiveIntensity: 0.5 });
        // clear corner glazing — the tunnel is meant to read through it
        const cornerGlass = new THREE.MeshStandardMaterial({
            color: 0xAFC0C8, roughness: 0.04, metalness: 0.35,
            transparent: true, opacity: 0.17, depthWrite: false });
        const portalMat = new THREE.MeshStandardMaterial({ color: 0x17181A, roughness: 0.95 });
        const signalMat = new THREE.MeshStandardMaterial({ color: 0x400808, emissive: 0xD82020, emissiveIntensity: 2.2 });

        function platformEnd(zs, xs) {
            const zw = zs * (HALF - 0.35);          // end wall plane
            const faceRot = zs > 0 ? Math.PI : 0;   // face back down the platform
            const inner = 5.65, glassStart = 8.7;   // wall runs from the beam line to the corner
            const wallW = glassStart - inner, wallCx = xs * (inner + wallW / 2);
            const glassW = 11.7 - glassStart, glassCx = xs * (glassStart + glassW / 2);

            // --- lower solid wall with the fire door ---
            const wall = new THREE.Mesh(new THREE.BoxGeometry(wallW, 3.15, 0.45), concreteMat);
            wall.position.set(wallCx, 1.575, zw); scene.add(wall);
            const door = new THREE.Mesh(new THREE.PlaneGeometry(2.05, 2.3), fireDoorMat);
            door.rotation.y = faceRot;
            door.position.set(wallCx, 1.16, zw - zs * 0.25); scene.add(door);
            const ex = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.24, 0.08), exitMat);
            ex.position.set(wallCx, 3.42, zw - zs * 0.26); scene.add(ex);

            // --- corner glazing: end plane + return along the PSD line ---
            const gEnd = new THREE.Mesh(new THREE.PlaneGeometry(glassW, 3.15), cornerGlass);
            gEnd.rotation.y = faceRot;
            gEnd.position.set(glassCx, 1.575, zw - zs * 0.2); scene.add(gEnd);
            const retLen = 2.4;
            const gRet = new THREE.Mesh(new THREE.PlaneGeometry(retLen, 3.15), cornerGlass);
            gRet.rotation.y = xs > 0 ? -Math.PI / 2 : Math.PI / 2;
            gRet.position.set(xs * PSD_X, 1.575, zw - zs * retLen / 2); scene.add(gRet);

            // black frames around both panes
            const fr = [];
            const vG = new THREE.BoxGeometry(0.09, 3.15, 0.09);
            for (const px of [glassStart, glassStart + glassW / 2, 11.66]) {
                fr.push({ geo: vG, m: M(xs * px, 1.575, zw - zs * 0.2) });
            }
            fr.push({ geo: new THREE.BoxGeometry(glassW, 0.1, 0.12), m: M(glassCx, 3.12, zw - zs * 0.2) });
            fr.push({ geo: new THREE.BoxGeometry(glassW, 0.07, 0.1), m: M(glassCx, 1.42, zw - zs * 0.2) });
            const vG2 = new THREE.BoxGeometry(0.09, 3.15, 0.09);
            for (const pz of [0.25, retLen - 0.1]) fr.push({ geo: vG2, m: M(xs * PSD_X, 1.575, zw - zs * pz) });
            fr.push({ geo: new THREE.BoxGeometry(0.12, 0.1, retLen), m: M(xs * PSD_X, 3.12, zw - zs * retLen / 2) });
            fr.push({ geo: new THREE.BoxGeometry(0.1, 0.07, retLen), m: M(xs * PSD_X, 1.42, zw - zs * retLen / 2) });
            scene.add(new THREE.Mesh(mergeGeos(fr), blackMat));

            const staff = new THREE.Mesh(new THREE.PlaneGeometry(0.85, 0.28), staffMat);
            staff.rotation.y = faceRot;
            staff.position.set(glassCx, 2.05, zw - zs * 0.27); scene.add(staff);

            // --- dark glazed wall filling everything above ---
            const upW = 11.7 - inner;
            const upper = new THREE.Mesh(new THREE.BoxGeometry(upW, 6.5, 0.3), darkWallMat);
            upper.position.set(xs * (inner + upW / 2), 6.4, zw); scene.add(upper);
            const red = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.3, 0.06), redSignMat);
            red.position.set(xs * 9.0, 4.4, zw - zs * 0.2); scene.add(red);

            // --- what you actually see through the glass: tunnel portal + signal ---
            const jamb = new THREE.Mesh(new THREE.BoxGeometry(1.5, 5.6, 7), portalMat);
            jamb.position.set(xs * 9.1, 2.2, zs * (HALF + 3.4)); scene.add(jamb);
            const lintel = new THREE.Mesh(new THREE.BoxGeometry(4.6, 1.4, 7), portalMat);
            lintel.position.set(xs * 11.5, 5.2, zs * (HALF + 3.4)); scene.add(lintel);
            const sig = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.22, 0.1), signalMat);
            sig.position.set(xs * 10.4, 3.1, zs * (HALF + 5)); scene.add(sig);
            if (xs > 0) {                       // one glow per end is plenty
                const glow = new THREE.PointLight(0xE08A46, 52, 30, 2);
                glow.position.set(0, 2.4, zs * (HALF + 8)); scene.add(glow);
            }

            // tactile strip before the end
            const tact = new THREE.Mesh(new THREE.PlaneGeometry(5.9, 0.5),
                new THREE.MeshStandardMaterial({ color: 0x8f8c86, roughness: 0.85 }));
            tact.rotation.x = -Math.PI / 2;
            tact.position.set(xs * (inner + upW / 2), 0.014, zw - zs * 2.3);
            scene.add(world.ghost(tact));
        }
        for (const zs of [-1, 1]) for (const xs of [-1, 1]) platformEnd(zs, xs);
    }

    /* ============================================================
       11b · Exit 2 escalator bank (State Library / Town Hall only)
             Four lanes of real moving steps, a solid clad mass beneath,
             and the Information / Help Point box on the far side.
       ============================================================ */
    const escBanks = [];
    {
        const ZB = 7.0, H = 5.2, RUN = 9.0;          // bottom z, rise, horizontal run
        const ZT = ZB - RUN;                          // top of the incline
        const A = Math.atan2(H, RUN);                 // 30 degrees
        const SLOPE = Math.sqrt(RUN * RUN + H * H);
        const LANES = 4, LW = 1.02, LG = 0.07;
        const TOT = LANES * LW + (LANES - 1) * LG;
        const laneX = [];
        for (let i = 0; i < LANES; i++) laneX.push(-TOT / 2 + LW / 2 + i * (LW + LG));

        const cladMat2 = new THREE.MeshStandardMaterial({ color: 0x8E8983, roughness: 0.2, metalness: 0.78 });
        const steelBright = new THREE.MeshStandardMaterial({ color: 0xC9CCCE, roughness: 0.3, metalness: 0.6 });
        const escGlass = new THREE.MeshStandardMaterial({ color: 0xBFC8CC, roughness: 0.05, metalness: 0.2,
            transparent: true, opacity: 0.22, depthWrite: false });
        const combMat = new THREE.MeshStandardMaterial({ color: 0xC8A93C, roughness: 0.5, metalness: 0.4 });

        // --- moving steps: one InstancedMesh for every lane and tread ---
        const treadTex = tex(64, 64, (ctx, w, h) => {
            ctx.fillStyle = '#9DA0A2'; ctx.fillRect(0, 0, w, h);
            for (let x = 2; x < w; x += 5) { ctx.fillStyle = '#8A8D8F'; ctx.fillRect(x, 0, 2, h); }
            ctx.fillStyle = '#D8B43A'; ctx.fillRect(0, h - 7, w, 7);
        });
        const riserTex = tex(64, 64, (ctx, w, h) => {
            ctx.fillStyle = '#6E7173'; ctx.fillRect(0, 0, w, h);
            for (let x = 2; x < w; x += 5) { ctx.fillStyle = '#5C5F61'; ctx.fillRect(x, 0, 2, h); }
        });
        const sideM = new THREE.MeshStandardMaterial({ color: 0x8A8D8F, roughness: 0.45, metalness: 0.45 });
        const treadM = new THREE.MeshStandardMaterial({ map: treadTex, roughness: 0.55, metalness: 0.35 });
        const riserM = new THREE.MeshStandardMaterial({ map: riserTex, roughness: 0.6, metalness: 0.35 });
        const P = 0.40;                               // horizontal advance per step
        const perLane = Math.ceil(RUN / P) + 1;
        const stepGeo = new THREE.BoxGeometry(LW, 0.26, P);
        const steps = new THREE.InstancedMesh(stepGeo,
            [sideM, sideM, treadM, sideM, riserM, sideM], LANES * perLane);
        steps.frustumCulled = false;
        roofVault.add(steps);
        escBanks.push({ mesh: steps, laneX, perLane, P, RUN, ZB, H,
                        tanA: Math.tan(A), dummy: new THREE.Object3D(), off: 0 });

        // --- balustrades, handrails, LED strips, skirts ---
        const zc = (ZB + ZT) / 2, yc = H / 2;
        for (const bx of [-TOT / 2 - 0.16, TOT / 2 + 0.16]) {
            const bal = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.0, SLOPE * 0.99), escGlass);
            bal.position.set(bx, yc + 0.76, zc); bal.rotation.x = A;
            roofVault.add(bal);
            const hr = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.09, SLOPE), blackMat);
            hr.position.set(bx, yc + 1.3, zc); hr.rotation.x = A;
            roofVault.add(hr);
            for (const o of [-0.05, 0.05]) {
                const led = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, SLOPE * 0.98), ledMat);
                led.position.set(bx + o, yc + 1.12, zc); led.rotation.x = A;
                roofVault.add(led);
            }
            const skirt = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.75, SLOPE * 0.99), steelBright);
            skirt.position.set(bx, yc + 0.12, zc); skirt.rotation.x = A;
            roofVault.add(skirt);
        }
        // inner lane dividers
        for (let i = 1; i < LANES; i++) {
            const dx = laneX[i] - (LW + LG) / 2;
            const bal = new THREE.Mesh(new THREE.BoxGeometry(0.05, 1.0, SLOPE * 0.99), escGlass);
            bal.position.set(dx, yc + 0.76, zc); bal.rotation.x = A; roofVault.add(bal);
            const hr = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.09, SLOPE), blackMat);
            hr.position.set(dx, yc + 1.3, zc); hr.rotation.x = A; roofVault.add(hr);
            const deck = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.06, SLOPE), steelBright);
            deck.position.set(dx, yc + 0.2, zc); deck.rotation.x = A; roofVault.add(deck);
        }
        // comb plates and landings, which also hide the step wrap-around
        const combB = new THREE.Mesh(new THREE.BoxGeometry(TOT, 0.07, 1.5), combMat);
        combB.position.set(0, 0.035, ZB + 0.7); roofVault.add(combB);
        const combT = new THREE.Mesh(new THREE.BoxGeometry(TOT, 0.07, 1.5), combMat);
        combT.position.set(0, H + 0.035, ZT - 0.7); roofVault.add(combT);
        const plateB = new THREE.Mesh(new THREE.BoxGeometry(TOT + 0.9, 0.06, 2.2), steelBright);
        plateB.position.set(0, 0.03, ZB + 2.2); roofVault.add(world.ground(plateB));

        // --- the solid clad mass under the escalator ---
        // Its top edge follows the step line exactly, so nothing pokes through;
        // the underside slopes down and meets the floor ahead of the bottom comb.
        {
            const tanA = Math.tan(A);
            const yStep = (z) => (ZB - z) * tanA;
            const TH = 1.3;                                   // truss depth
            const zFront = ZB + 0.9, zBack = ZT - 0.9;
            const zToe = ZB - TH / tanA;                      // where the underside meets the floor
            const prof = new THREE.Shape();
            prof.moveTo(zFront, yStep(zFront));
            prof.lineTo(zBack, yStep(zBack));
            prof.lineTo(zBack, yStep(zBack) - TH);
            prof.lineTo(zToe, 0);
            prof.lineTo(zFront, yStep(zFront) - 0.05);
            prof.closePath();
            const g = new THREE.ExtrudeGeometry(prof, { depth: TOT + 0.95, bevelEnabled: false });
            g.rotateY(-Math.PI / 2); g.translate((TOT + 0.95) / 2, 0, 0);
            const soff = new THREE.Mesh(g, cladMat2);
            roofVault.add(soff);                              // its own side faces are the clad walls
        }

        // --- upper landing slab, and the Information box beneath its far side ---
        const slab = new THREE.Mesh(new THREE.BoxGeometry(TOT + 1.2, 0.34, 8.4), concreteMat);
        slab.position.set(0, H - 0.17, ZT - 1.5 - 4.2);
        roofVault.add(world.ground(slab));
        {
            const panelTex2 = tex(256, 256, (ctx, w, h) => {
                ctx.fillStyle = '#CFD1D0'; ctx.fillRect(0, 0, w, h);
                ctx.strokeStyle = 'rgba(90,92,92,0.55)'; ctx.lineWidth = 3;
                for (let i = 0; i <= 4; i++) {
                    ctx.beginPath(); ctx.moveTo(i * w / 4, 0); ctx.lineTo(i * w / 4, h); ctx.stroke();
                    ctx.beginPath(); ctx.moveTo(0, i * h / 4); ctx.lineTo(w, i * h / 4); ctx.stroke();
                }
            }, 3, 4);
            const ceil2 = new THREE.Mesh(new THREE.PlaneGeometry(TOT + 1.2, 8.4),
                new THREE.MeshStandardMaterial({ map: panelTex2, roughness: 0.6, metalness: 0.15 }));
            ceil2.rotation.x = Math.PI / 2;
            ceil2.position.set(0, H - 0.38, ZT - 1.5 - 4.2);
            roofVault.add(ceil2);

            const infoTex2 = tex(1024, 640, (ctx, w, h) => {
                ctx.fillStyle = '#F0F1EE'; ctx.fillRect(0, 0, w, h);
                const g2 = ctx.createLinearGradient(0, 0, 0, h);
                g2.addColorStop(0, 'rgba(255,255,255,0.5)'); g2.addColorStop(1, 'rgba(200,203,200,0.3)');
                ctx.fillStyle = g2; ctx.fillRect(0, 0, w, h);
                ctx.strokeStyle = '#17181A'; ctx.lineWidth = 7;
                for (const x of [0, 0.28, 0.5, 0.72, 1]) { ctx.beginPath(); ctx.moveTo(x * w, 0); ctx.lineTo(x * w, h); ctx.stroke(); }
                for (const y of [0, 0.26, 0.42, 0.78, 1]) { ctx.beginPath(); ctx.moveTo(0, y * h); ctx.lineTo(w, y * h); ctx.stroke(); }
                ctx.fillStyle = '#2A2F49'; ctx.fillRect(w * 0.28, h * 0.26, w * 0.44, h * 0.16);
                ctx.fillStyle = '#fff'; ctx.font = '600 32px Arial'; ctx.textBaseline = 'middle';
                ctx.fillText('i  Information', w * 0.30, h * 0.34);
                ctx.fillText('Help Point', w * 0.55, h * 0.34);
                ctx.fillStyle = '#DCE8F2'; ctx.fillRect(w * 0.30, h * 0.5, w * 0.16, h * 0.24);
                ctx.fillStyle = '#C8DCE8'; ctx.fillRect(w * 0.475, h * 0.5, w * 0.03, h * 0.24);
                ctx.fillStyle = '#9EA3A7'; ctx.fillRect(w * 0.53, h * 0.5, w * 0.1, h * 0.26);
                ctx.fillStyle = '#1D3E6E'; ctx.fillRect(w * 0.545, h * 0.54, w * 0.07, h * 0.07);
            });
            const infoFace = new THREE.MeshStandardMaterial({ map: infoTex2, roughness: 0.35,
                emissive: 0xBFC2BD, emissiveMap: infoTex2, emissiveIntensity: 0.3 });
            const infoSide = new THREE.MeshStandardMaterial({ color: 0xE7E8E4, roughness: 0.35,
                emissive: 0xA8ABA6, emissiveIntensity: 0.22 });
            const box = new THREE.Mesh(new THREE.BoxGeometry(4.6, 3.4, 3.6),
                [infoSide, infoSide, infoSide, infoSide, infoSide, infoFace]);
            box.position.set(0, 1.7, ZT - 8.6);
            roofVault.add(box);

        }

        // --- Exit 2 signs flanking the escalator, and its lighting ---
        hungSign(2.2, 0.62, mkExit('Exit 2', 'Franklin Street'), -3.4, 4.35, ZB + 1.0, 8.6, 0.7);
        hungSign(2.2, 0.62, mkExit('Exit 2', 'Franklin Street'), 3.4, 4.35, ZB + 1.0, 8.6, 0.7);
        for (const [ez, ei] of [[zc, 30]]) {
            const el = new THREE.PointLight(0xFFF0DA, ei, 15, 2);
            el.position.set(0, 6.8, ez); roofVault.add(el);
        }
    }

    /* ============================================================
       12 · light
       ============================================================ */
    try {   // small PMREM environment: grey cavern + warm lantern band, so metals reflect
        const pmrem = new THREE.PMREMGenerator(world.renderer);
        const envScene = new THREE.Scene();
        const envTex = tex(4, 64, (ctx, w, h) => {
            const g = ctx.createLinearGradient(0, 0, 0, h);
            g.addColorStop(0, '#B7B4AE'); g.addColorStop(0.45, '#8E8B85');
            g.addColorStop(0.75, '#6F6C66'); g.addColorStop(1, '#55524D');
            ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
        });
        const dome = new THREE.Mesh(new THREE.SphereGeometry(50, 16, 12),
            new THREE.MeshBasicMaterial({ map: envTex, side: THREE.BackSide }));
        envScene.add(dome);
        const warm = new THREE.Mesh(new THREE.BoxGeometry(40, 1.5, 3),
            new THREE.MeshBasicMaterial({ color: 0xFFE3B4 }));
        warm.position.set(0, 14, 0);
        envScene.add(warm);
        for (const sx of [-12, 12]) {
            const cool = new THREE.Mesh(new THREE.BoxGeometry(2, 5, 30),
                new THREE.MeshBasicMaterial({ color: 0xB9BEC1 }));
            cool.position.set(sx, 6, 0);
            envScene.add(cool);
        }
        scene.environment = pmrem.fromScene(envScene, 0.03).texture;
        if ('environmentIntensity' in scene) scene.environmentIntensity = 0.65;
        pmrem.dispose();
    } catch (e) { /* environment is a nicety — carry on without it */ }

    scene.fog = new THREE.Fog(0x7b7a76, 52, 165);
    scene.add(new THREE.HemisphereLight(0xEDEEEF, 0x86847F, 0.95));   // carries most of the room now
    for (let bi = 0; bi * BAY < LEN - 4; bi += 14) {        // lantern pools
        const zc = -HALF + 1 + bi * BAY + BAY / 2;
        if (zc > HALF - 2) break;
        if (zc < -103.5) continue;
        if (zc > -6 && zc < 10) continue;
        const pl = new THREE.PointLight(0xFFDFAE, 55, 22, 2);
        pl.position.set(0, 6.9, zc);
        roofVault.add(pl);
    }
    for (const [z, i] of [[-58, 130], [58, 130]]) {                  // concourse fill
        const fill = new THREE.PointLight(0xFFF0DC, i, 52, 2);
        fill.position.set(0, 8.0, z);
        scene.add(fill);
    }
    // (the platform cone pools are carried by the lamps' own emissive glow)
    for (const s2 of [-1, 1]) {                              // one wash per platform
        const wl = new THREE.PointLight(0xF5EEDD, 34, 30, 2);
        wl.position.set(s2 * 6.9, 4.6, 20);
        scene.add(wl);
    }
    const endLight = new THREE.PointLight(0xFFF0DC, 60, 30, 2);
    endLight.position.set(0, 8.0, 102);
    scene.add(endLight);

    /* ============================================================
       12b · the Anzac roof — flat soffit, crossing orange ribbon
             beams, gold-drum domes with a glowing rim
       ============================================================ */
    const roofAnzac = new THREE.Group();
    roofAnzac.visible = false;
    scene.add(roofAnzac);
    {
        const CEIL = 7.8;
        const ribTex = tex(128, 128, (ctx, w, h) => {
            ctx.fillStyle = '#2B2C2E'; ctx.fillRect(0, 0, w, h);
            for (let x = 0; x < w; x += 8) { ctx.fillStyle = '#161719'; ctx.fillRect(x, 0, 4, h); }
        }, 70, 2);
        const beamTex = tex(64, 128, (ctx, w, h) => {
            ctx.fillStyle = '#C4491C'; ctx.fillRect(0, 0, w, h);
            for (let x = 0; x < w; x += 6) {
                ctx.fillStyle = 'rgba(255,255,255,0.10)'; ctx.fillRect(x, 0, 3, h);
                ctx.fillStyle = 'rgba(0,0,0,0.14)'; ctx.fillRect(x + 3, 0, 3, h);
            }
        }, 1, 26);
        const slabMat = new THREE.MeshStandardMaterial({ color: 0x5B5C60, roughness: 0.92 });
        const soffitMat = new THREE.MeshStandardMaterial({ map: ribTex, roughness: 0.85 });
        const beamMat = new THREE.MeshStandardMaterial({ map: beamTex, roughness: 0.62 });
        const goldMat = new THREE.MeshStandardMaterial({ color: 0xB2842F, roughness: 0.45, metalness: 0.45,
            side: THREE.DoubleSide });
        const rimMat = new THREE.MeshStandardMaterial({ color: 0xF0EADA, emissive: 0xFFF6E4, emissiveIntensity: 2.6 });
        const domeMat = new THREE.MeshStandardMaterial({ color: 0xF4F5F7, emissive: 0xD8DEE6,
            emissiveIntensity: 0.75, side: THREE.DoubleSide });
        const ribMat2 = new THREE.MeshStandardMaterial({ color: 0xDDE0E4, roughness: 0.5 });
        const potMat = new THREE.MeshStandardMaterial({ color: 0xF2F1EC, emissive: 0xEFE6D2,
            emissiveIntensity: 0.9, side: THREE.DoubleSide });

        // structural slab + ribbed black soffits over the platforms
        const slab = new THREE.Mesh(new THREE.PlaneGeometry(24, LEN), slabMat);
        slab.rotation.x = Math.PI / 2; slab.position.y = CEIL + 0.5;
        roofAnzac.add(slab);
        for (const s2 of [-1, 1]) {
            const sf = new THREE.Mesh(new THREE.PlaneGeometry(6.4, LEN), soffitMat);
            sf.rotation.x = Math.PI / 2; sf.position.set(s2 * 8.5, CEIL - 0.15, 0);
            roofAnzac.add(sf);
        }
        // --- diamond lattice of orange ribbon beams ---
        // Two families of parallel beams crossing on the centreline every S,
        // so the cells between them are diamonds centred at (n + 1/2)·S.
        const DS = 16, DHW = 12.2, DZH = 17.7;
        const beamAng = Math.atan2(DZH, DHW);
        const beamLen = 2 * Math.sqrt(DHW * DHW + DZH * DZH);
        // The diagonals stop at the diamond's left/right vertices; from there a
        // single straight arm carries on out over each platform, rather than the
        // two beams crossing and splitting apart again.
        const XD = DS * DHW / (2 * DZH);                       // diamond half-width
        const diagLen = 2 * Math.sqrt(XD * XD + (DS / 2) * (DS / 2));
        const armLen = 11.9 - XD;
        {
            const items = [];
            const bg = new THREE.BoxGeometry(diagLen, 0.46, 0.72);
            const arm = new THREE.BoxGeometry(armLen, 0.46, 0.72);
            for (let n = -9; n <= 9; n++) {
                const z0 = n * DS;
                if (z0 < -HALF - DS || z0 > HALF + DS) continue;
                items.push({ geo: bg, m: M(0, CEIL - 0.45, z0, 0, -beamAng, 0) });
                items.push({ geo: bg, m: M(0, CEIL - 0.45, z0, 0, beamAng, 0) });
            }
            for (let n = -9; n <= 8; n++) {
                const cz = (n + 0.5) * DS;
                if (Math.abs(cz) > HALF - 1) continue;
                for (const sx of [-1, 1]) {
                    items.push({ geo: arm, m: M(sx * (XD + armLen / 2), CEIL - 0.45, cz) });
                }
            }
            roofAnzac.add(new THREE.Mesh(mergeGeos(items), beamMat));
        }

        // --- what sits in the middle of each diamond: light, pillar, light, pillar ---
        const domeZ = [], pillarZ = [];
        {
            let i = 0;
            for (let n = -9; n <= 8; n++) {
                const cz = (n + 0.5) * DS;
                if (Math.abs(cz) > HALF - 12) continue;
                (i % 2 === 0 ? domeZ : pillarZ).push(cz);
                i++;
            }
        }

        // gold drum domes with the bright rim
        for (const dz of domeZ) {
            const drum = new THREE.Mesh(new THREE.CylinderGeometry(3.05, 3.05, 1.35, 36, 1, true), goldMat);
            drum.position.set(0, CEIL - 1.15, dz); roofAnzac.add(drum);
            const cap = new THREE.Mesh(new THREE.CircleGeometry(3.05, 36), goldMat);
            cap.rotation.x = -Math.PI / 2; cap.position.set(0, CEIL - 0.48, dz); roofAnzac.add(cap);
            const rim = new THREE.Mesh(new THREE.TorusGeometry(2.95, 0.13, 8, 44), rimMat);
            rim.rotation.x = Math.PI / 2; rim.position.set(0, CEIL - 1.82, dz); roofAnzac.add(rim);
            const dome = new THREE.Mesh(new THREE.SphereGeometry(6, 32, 10, 0, Math.PI * 2, 0, 0.5), domeMat);
            dome.position.set(0, CEIL - 1.82 - 6 * Math.cos(0.5), dz);
            roofAnzac.add(dome);
            const ribs = [];
            const rg = new THREE.BoxGeometry(2.5, 0.04, 0.07);
            for (let i = 0; i < 10; i++) {
                const a = i * Math.PI / 5;
                ribs.push({ geo: rg, m: M(Math.cos(a) * 1.52, CEIL - 1.48, dz + Math.sin(a) * 1.52, 0, -a, 0) });
            }
            roofAnzac.add(new THREE.Mesh(mergeGeos(ribs), ribMat2));
            const boss = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.2, 20), ribMat2);
            boss.position.set(0, CEIL - 1.34, dz); roofAnzac.add(boss);
            const bossRing = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.05, 6, 20), goldMat);
            bossRing.rotation.x = Math.PI / 2; bossRing.position.set(0, CEIL - 1.45, dz);
            roofAnzac.add(bossRing);
            if (domeZ.indexOf(dz) % 2 === 0) {
                const dl = new THREE.PointLight(0xFFF0D6, 105, 46, 2);
                dl.position.set(0, CEIL - 2.3, dz); roofAnzac.add(dl);
            }
        }

        // big round concrete columns on the centreline — the only columns here
        for (const cz of pillarZ) {
            const H = CEIL + 0.5;
            const col = new THREE.Mesh(new THREE.CylinderGeometry(0.84, 0.9, H, 24), columnMat);
            col.position.set(0, H / 2, cz); roofAnzac.add(col);
            const base = new THREE.Mesh(new THREE.CylinderGeometry(0.99, 0.99, 0.22, 24), blackMat);
            base.position.set(0, 0.11, cz); roofAnzac.add(base);
            for (const sx of [-1, 1]) {          // station name plates facing each platform
                const p = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.92), nameMat);
                p.position.set(sx * 0.88, 3.0, cz);
                p.rotation.y = sx > 0 ? Math.PI / 2 : -Math.PI / 2;
                roofAnzac.add(p);
            }
        }

        // departure screens hung from the soffit over each platform
        for (const p of pids) {
            const face = new THREE.MeshStandardMaterial({ map: p.t, emissive: 0xffffff,
                emissiveMap: p.t, emissiveIntensity: 0.85, roughness: 0.6 });
            const edge = new THREE.MeshStandardMaterial({ color: 0x1a1b1c, roughness: 0.6 });
            const bg2 = new THREE.BoxGeometry(1.3, 0.78, 0.1);
            bg2.clearGroups(); bg2.addGroup(0, 24, 0); bg2.addGroup(24, 12, 1);
            const scr = new THREE.Mesh(bg2, [edge, face]);
            scr.position.set(p.side * 6.4, 4.05, p.z);
            scr.rotation.y = p.side > 0 ? -Math.PI / 2 : Math.PI / 2;
            roofAnzac.add(scr);
            const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 3.1, 6), darkMetal);
            rod.position.set(p.side * 6.4, 5.9, p.z); roofAnzac.add(rod);
        }

        // white saucer pendants along the platform edges + soffit downlights
        {
            const stems = [], pots = [], dots = [];
            const stemG = new THREE.CylinderGeometry(0.02, 0.02, 0.5, 6);
            const potG = new THREE.CylinderGeometry(0.36, 0.26, 0.14, 16);
            const dotG = new THREE.CylinderGeometry(0.22, 0.22, 0.03, 12);
            for (let z = -HALF + 6; z <= HALF - 6; z += 7) {
                for (const s2 of [-1, 1]) {
                    stems.push({ geo: stemG, m: M(s2 * 8.5, CEIL - 0.55, z) });
                    pots.push({ geo: potG, m: M(s2 * 8.5, CEIL - 0.87, z) });
                    dots.push({ geo: dotG, m: M(s2 * 8.5, CEIL - 0.95, z) });
                }
            }
            roofAnzac.add(new THREE.Mesh(mergeGeos(stems), darkMetal));
            roofAnzac.add(new THREE.Mesh(mergeGeos(pots), potMat));
            roofAnzac.add(new THREE.Mesh(mergeGeos(dots), rimMat));
        }

    }

    // which station we are standing in
    const STATIONS = [
        { tex: () => nameTexSL, roof: 'vault' },
        { tex: () => nameTexAN, roof: 'anzac' },
        { tex: () => nameTexTH, roof: 'vault' },
    ];
    let stationIdx = 0;
    function applyStation(i) {
        const st = STATIONS[i];
        nameMat.map = st.tex();
        nameMat.needsUpdate = true;
        roofVault.visible = st.roof === 'vault';
        roofAnzac.visible = st.roof === 'anzac';
    }
    applyStation(0);
    scene.userData.applyStation = applyStation;   // handy for previews/tests

    /* ============================================================
       13 · what moves: the ride loop
       ------------------------------------------------------------
       One hero train. If you are aboard when the doors close, the
       train stays put and the WORLD slides past (the only way a
       rider can work while the app owns the camera). Mid-tunnel,
       hidden by fog, the world swaps ends and the same cavern
       re-docks wearing Town Hall signage.
       ============================================================ */
    let pidClock = 0, pidLast = -1;
    const STOPZ = 35.5, FAR = 260;
    const RIDE_D = 420, JUMP_AT = 210, VMAX = 12;
    // Acceleration is exponential — hardest off the mark, easing as it gains
    // speed — and braking is constant-rate with a floor so it never crawls in.
    const BRAKE = 0.72;           // m/s^2, used for both braking and pulling away
    const VCRAWL = 1.1;           // never slower than this until it stops
    function timeToStop(R, v) {
        const dBrake = v * v / (2 * BRAKE);
        if (R <= dBrake) return v / BRAKE;
        return (R - dBrake) / Math.max(v, 0.1) + v / BRAKE;
    }
    // ---- sound: buffers loaded once, a rig mounted on each train ----
    const sndDur = { arrive: 26 };
    const rigs = [];
    let listener = null;
    try {
        listener = new THREE.AudioListener();
        if (world.camera) world.camera.add(listener);
    } catch (e) { listener = null; }

    function makeRig(parent) {
        const rig = { depart: null, arrive: null };
        if (!listener) return rig;
        try {
            for (const key of ['depart', 'arrive']) {
                const a = new THREE.PositionalAudio(listener);
                a.setRefDistance(15);
                a.setRolloffFactor(1.1);
                a.setDistanceModel('inverse');
                a.setVolume(0.95);
                parent.add(a);                      // travels with its train
                rig[key] = a;
            }
            rigs.push(rig);
        } catch (e) {}
        return rig;
    }
    const snd = makeRig(heroTrain);
    const snd2 = makeRig(train2);
    if (listener) {
        const grab = (uri, key) => new THREE.AudioLoader().load(uri, (buf) => {
            if (key === 'arrive') sndDur.arrive = buf.duration;
            for (const r of rigs) if (r[key]) r[key].setBuffer(buf);
        }, undefined, () => {});
        grab(SND_DEPART, 'depart');
        grab(SND_ARRIVE, 'arrive');
        const wake = () => {                        // browsers hold audio until a gesture
            const ctx = THREE.AudioContext.getContext();
            if (ctx && ctx.state === 'suspended') ctx.resume();
        };
        for (const ev of ['pointerdown', 'touchstart', 'keydown']) {
            window.addEventListener(ev, wake, { passive: true });
        }
    }

    function playOn(rig, key) {
        const a = rig && rig[key];
        if (!a || !a.buffer) return;
        try {
            const ctx = THREE.AudioContext.getContext();
            if (ctx && ctx.state === 'suspended') ctx.resume();
            if (a.isPlaying) a.stop();
            a.play();
        } catch (e) {}
    }
    function stopOn(rig, key) {
        const a = rig && rig[key];
        if (a && a.isPlaying) { try { a.stop(); } catch (e) {} }
    }
    const playSnd = (key) => playOn(snd, key);
    const stopSnd = (key) => stopOn(snd, key);
    let arriveCued = false;

    let phase = 'approach', pt = 0, traveled = 0, riding = false;
    // platform 2 runs the same cycle, half a lap out of step
    const S2 = -STOPZ;
    let p2 = 'away', p2t = 20, p2cued = false;
    train2.position.z = S2 - 150;
    scene.userData.dockTrain2 = () => {           // for previews/tests
        p2 = 'dwell'; p2t = 8; p2cued = false;
        train2.position.z = S2; train2.visible = true;
    };
    heroTrain.position.z = -FAR;

    function playerAboard() {
        const p = world.camera && world.camera.position;
        if (!p) return false;
        return Math.abs(p.x - 13.15) < 1.7 && Math.abs(p.z - STOPZ) < 80 && p.y < 4.2;
    }

    // everything except the train (and its lights, and the sky light) rides in worldG
    const worldG = new THREE.Group();
    {
        for (const c of [...scene.children]) {
            if (c === heroTrain) continue;
            if (c.isLight && (c.type === 'HemisphereLight' || c.userData.followTrain !== undefined)) continue;
            worldG.add(c);
        }
        scene.add(worldG);
    }

    let lastMs = (typeof performance !== 'undefined' ? performance.now() : Date.now());
    world.frame(() => {
        // Drive everything from the wall clock, not the runtime's clamped dt:
        // at low frame rates a clamped dt runs the whole schedule in slow motion
        // and drifts out of sync with the audio.
        const nowMs = (typeof performance !== 'undefined' ? performance.now() : Date.now());
        let dt = (nowMs - lastMs) / 1000;
        lastMs = nowMs;
        if (!(dt > 0)) dt = 0.016;
        if (dt > 0.25) dt = 0.25;          // returning from the background must not lurch
        pidClock += dt;
        if (roofVault.visible) {
            for (const e of escBanks) {
                e.off = (e.off + dt * 0.62) % e.P;
                let i = 0;
                for (const lx of e.laneX) {
                    for (let k = 0; k < e.perLane; k++) {
                        let u = k * e.P + e.off;
                        if (u > e.RUN) u -= e.RUN + e.P;
                        const yTop = Math.max(0, u) * e.tanA;
                        e.dummy.position.set(lx, yTop - 0.13, e.ZB - u);
                        e.dummy.updateMatrix();
                        e.mesh.setMatrixAt(i++, e.dummy.matrix);
                    }
                }
                e.mesh.instanceMatrix.needsUpdate = true;
            }
        }
        const step = Math.floor(pidClock / 45);
        if (step !== pidLast) {
            pidLast = step;
            pids.forEach(p => drawPIDNow(p, pidClock));
        }
        let k = 0;
        if (phase === 'approach') {
            const R = Math.max(0, STOPZ - heroTrain.position.z);
            const v = Math.min(VMAX, Math.max(VCRAWL, Math.sqrt(2 * BRAKE * R)));
            heroTrain.visible = true;
            heroTrain.position.z += v * dt;
            if (!arriveCued && timeToStop(R, v) <= sndDur.arrive) {
                arriveCued = true; playSnd('arrive');       // ends as the train halts
            }
            if (R <= v * dt + 0.05) {
                heroTrain.position.z = STOPZ; phase = 'dwell'; pt = 0;
            }
        } else if (phase === 'dwell') {
            pt += dt;
            const DW = 26;
            const open = Math.min(1, Math.max(0, (pt - 0.8) / 1.5));
            const close = Math.min(1, Math.max(0, (DW - 1.0 - pt) / 1.7));
            k = Math.max(0, Math.min(open, close));
            k = k * k * (3 - 2 * k);
            if (pt >= DW) {
                riding = playerAboard();
                traveled = 0;
                phase = riding ? 'ride' : 'away';
                pt = 0;
                arriveCued = false;
                stopSnd('arrive');
                playSnd('depart');                          // the moment it pulls away
            }
        } else if (phase === 'ride') {
            const remaining = Math.max(0.01, RIDE_D - traveled);
            pt += dt;
            // pulling away is the arrival curve reversed: build at the same
            // constant rate up to line speed, then hold it
            const vAcc = Math.max(VCRAWL, Math.sqrt(2 * BRAKE * traveled));
            const vBrk = Math.max(VCRAWL, Math.sqrt(2 * BRAKE * remaining));
            const v = Math.min(VMAX, vAcc, vBrk);
            const before = traveled;
            traveled += v * dt;
            if (before < JUMP_AT && traveled >= JUMP_AT) {
                stationIdx = (stationIdx + 1) % STATIONS.length;   // next stop down the line
                applyStation(stationIdx);
            }
            if (!arriveCued && timeToStop(remaining, v) <= sndDur.arrive) {
                arriveCued = true; playSnd('arrive');
            }
            worldG.position.z = traveled < JUMP_AT ? -traveled : (RIDE_D - traveled);
            if (traveled >= RIDE_D - v * dt - 0.05) { traveled = RIDE_D; worldG.position.z = 0; phase = 'dwell'; pt = 0; arriveCued = false; }
        } else if (phase === 'away') {
            pt += dt;
            // the arrival curve reversed — builds up at the same rate it brakes
            const d = Math.max(0, heroTrain.position.z - STOPZ);
            const v = Math.min(VMAX, Math.max(VCRAWL, Math.sqrt(2 * BRAKE * d)));
            heroTrain.position.z += v * dt;
            if (heroTrain.position.z >= FAR) heroTrain.visible = false;
            if (pt > 36) { phase = 'approach'; pt = 0; arriveCued = false; heroTrain.position.z = -FAR; }
        }
        // 220-odd draw calls are not worth spending on a speck in the fog
        if (heroTrain.visible && world.camera) {
            const dz2 = heroTrain.position.z - world.camera.position.z;
            const dx2 = heroTrain.position.x - world.camera.position.x;
            if (dx2 * dx2 + dz2 * dz2 > 145 * 145) heroTrain.visible = false;
        }
        if (heroTrain.userData.setDoors) heroTrain.userData.setDoors(k, -1);
        const mv = psdMovers['1'];
        if (mv) {
            const o = k * 0.94;
            mv.L.position.z = -o; mv.aL.position.z = -o;
            mv.R.position.z = o; mv.aR.position.z = o;
        }

        // ---------- the other direction, on platform 2 ----------
        let k2 = 0;
        if (p2 === 'approach') {
            const R = Math.max(0, train2.position.z - S2);
            const v = Math.min(VMAX, Math.max(VCRAWL, Math.sqrt(2 * BRAKE * R)));
            train2.visible = true;
            train2.position.z -= v * dt;
            if (!p2cued && timeToStop(R, v) <= sndDur.arrive) {
                p2cued = true; playOn(snd2, 'arrive');
            }
            if (R <= v * dt + 0.05) { train2.position.z = S2; p2 = 'dwell'; p2t = 0; }
        } else if (p2 === 'dwell') {
            p2t += dt;
            const DW2 = 26;
            const o2 = Math.min(1, Math.max(0, (p2t - 0.8) / 1.5));
            const c2 = Math.min(1, Math.max(0, (DW2 - 1.0 - p2t) / 1.7));
            k2 = Math.max(0, Math.min(o2, c2));
            k2 = k2 * k2 * (3 - 2 * k2);
            if (p2t >= DW2) {
                p2 = 'away'; p2t = 0; p2cued = false;
                stopOn(snd2, 'arrive'); playOn(snd2, 'depart');
            }
        } else {
            p2t += dt;
            const d2 = Math.max(0, S2 - train2.position.z);
            const v = Math.min(VMAX, Math.max(VCRAWL, Math.sqrt(2 * BRAKE * d2)));
            train2.position.z -= v * dt;
            if (train2.position.z <= -FAR) train2.visible = false;
            if (p2t > 36) { p2 = 'approach'; p2t = 0; p2cued = false; train2.position.z = FAR; }
        }
        if (train2.visible && world.camera) {         // same distance cull, in world space
            const az = train2.position.z + worldG.position.z - world.camera.position.z;
            const ax = train2.position.x - world.camera.position.x;
            if (ax * ax + az * az > 145 * 145) train2.visible = false;
        }
        if (train2.userData.setDoors) train2.userData.setDoors(k2, -1);
        const mv2 = psdMovers['-1'];
        if (mv2) {
            const o = k2 * 0.94;
            mv2.L.position.z = -o; mv2.aL.position.z = -o;
            mv2.R.position.z = o; mv2.aR.position.z = o;
        }
        for (const tr of trains) {
            if (tr.light) tr.light.position.z = heroTrain.position.z + tr.light.userData.followTrain;
        }
    });
}

export { build as buildStation };
