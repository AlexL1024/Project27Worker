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
export const HCMT_DOORS = (() => {
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

        // doorways — yellow painted surround on the body; the leaf area is CUT
        // OUT of the wall (alpha 0) and real light-blue sliding meshes sit behind
        const dw = layout.doorW;
        for (const dx of layout.doors) {
            const x0 = X(dx), x1 = X(dx + dw);
            // yellow frame surround
            ctx.fillStyle = C.yellow;
            ctx.fillRect(x0 - 3, Y(2.92), (x1 - x0) + 6, Y(0.86) - Y(2.92));
            // thin darker-gold sill strip under the doorway
            ctx.fillStyle = '#b0954e';
            ctx.fillRect(x0 - 3, Y(0.95), (x1 - x0) + 6, Y(0.86) - Y(0.95));
            // real opening (slight frame reveal kept at both jambs + head)
            const hx0 = x0 + (X(0.07) - X(0)), hx1 = x1 - (X(0.07) - X(0));
            ctx.clearRect(hx0, Y(DOOR_TOP), hx1 - hx0, Y(0.98) - Y(DOOR_TOP));
        }

        // subtle horizontal panel seams on the silver body
        ctx.strokeStyle = 'rgba(60,58,52,0.28)'; ctx.lineWidth = 1;
        for (const sy of [1.55, 2.9]) {
            ctx.beginPath(); ctx.moveTo(0, Y(sy)); ctx.lineTo(W, Y(sy)); ctx.stroke();
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

// door leaf atlas: columns [extN | extP | intN | intP] (N = leaf left of centre)
function makeLeafTex(canvasTexture) {
    const W = 512, H = 512;
    // leaf is LEAF_W wide, LEAF_H tall; column width 128
    return canvasTexture(W, H, (ctx) => {
        function extBase(cx0) {
            const g = ctx.createLinearGradient(0, 0, 0, H);
            g.addColorStop(0, '#8ecdee'); g.addColorStop(0.35, C.doorBlue);
            g.addColorStop(0.8, '#69b2da'); g.addColorStop(1, '#5da5cd');
            ctx.fillStyle = g; ctx.fillRect(cx0, 0, 128, H);
        }
        function intBase(cx0) {
            const g = ctx.createLinearGradient(0, 0, 0, H);
            g.addColorStop(0, '#d6d9dc'); g.addColorStop(1, '#bfc3c6');
            ctx.fillStyle = g; ctx.fillRect(cx0, 0, 128, H);
            ctx.strokeStyle = '#a7abae'; ctx.lineWidth = 2;
            ctx.strokeRect(cx0 + 6, 6, 116, H - 12);
        }
        // y mapping: leaf spans y 0.88..2.98 -> canvas 512..0
        const ly = m => (2.98 - m) / LEAF_H * H;
        const lx = (cx0, m) => cx0 + m / LEAF_W * 128; // m from leaf left edge
        function leafWindow(cx0, nearRight) {
            // window 0.36 wide, 0.07 from the centre-meeting edge, y 1.45..2.72
            const wx0 = nearRight ? lx(cx0, LEAF_W - 0.07 - 0.36) : lx(cx0, 0.07);
            const wx1 = nearRight ? lx(cx0, LEAF_W - 0.07) : lx(cx0, 0.07 + 0.36);
            roundRect(ctx, wx0 - 3, ly(2.75) - 3, (wx1 - wx0) + 6, ly(1.42) - ly(2.75) + 6, 8);
            ctx.fillStyle = '#1a1c1e'; ctx.fill();
            const dg = ctx.createLinearGradient(0, ly(2.72), 0, ly(1.45));
            dg.addColorStop(0, '#39434c'); dg.addColorStop(0.4, '#15191d'); dg.addColorStop(1, '#0c0e10');
            ctx.fillStyle = dg;
            roundRect(ctx, wx0, ly(2.72), wx1 - wx0, ly(1.45) - ly(2.72), 6); ctx.fill();
            ctx.fillStyle = 'rgba(180,205,225,0.13)';
            ctx.fillRect(wx0 + 2, ly(2.72), (wx1 - wx0) * 0.3, ly(1.45) - ly(2.72));
        }
        function extLeaf(cx0, nearRight) {
            extBase(cx0);
            leafWindow(cx0, nearRight);
            // small green press-to-open sticker under the window
            const stx = nearRight ? lx(cx0, LEAF_W - 0.32) : lx(cx0, 0.18);
            ctx.fillStyle = '#1f7a3c';
            ctx.fillRect(stx, ly(1.32), 18, 10);
            // meeting-edge dark rubber
            const ex = nearRight ? cx0 + 124 : cx0;
            ctx.fillStyle = '#2a4c60'; ctx.fillRect(ex, 0, 4, H);
        }
        function intLeaf(cx0, nearRight) {
            intBase(cx0);
            leafWindow(cx0, nearRight);
            // yellow edge highlight at meeting edge (interior)
            const ex = nearRight ? cx0 + 120 : cx0 + 2;
            ctx.fillStyle = '#f0b421'; ctx.fillRect(ex, ly(2.4), 6, ly(1.1) - ly(2.4));
        }
        extLeaf(0, true);      // extN: leaf left of centre, meeting edge on its right
        extLeaf(128, false);   // extP
        intLeaf(256, true);    // intN
        intLeaf(384, false);   // intP
    });
}
const LEAF_COL = { extN: [0, 0.25], extP: [0.25, 0.5], intN: [0.5, 0.75], intP: [0.75, 1.0] };
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
        // door jamb reveals (wall thickness)
        for (const dz of doorZ) {
            const jx0 = Math.min(s * wallX, s * SIDE_X), jx1 = Math.max(s * wallX, s * SIDE_X);
            for (const e of [-1, 1]) {
                wall.push({ geo: zRect(THREE, dz + e * DOOR_W / 2, jx0, jx1, FLOOR_Y, DOOR_TOP, -e), m: M() });
            }
            wall.push({ geo: yRect(THREE, DOOR_TOP, jx0, jx1, dz - DOOR_W / 2, dz + DOOR_W / 2, -1), m: M() });
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

    // ---- sliding door leaves: 4 mover meshes (side x dir), merged ----------
    for (const s of [-1, 1]) {
        for (const dir of [-1, 1]) {
            const items = [];
            const xo = s * 1.47, xi = s * 1.44;
            for (const dz of doorZ) {
                const z0 = dir > 0 ? dz : dz - LEAF_W;
                const z1 = dir > 0 ? dz + LEAF_W : dz;
                const y0 = 0.88, y1 = 0.88 + LEAF_H;
                // near meeting edge is at dz. ext texture column: leaf left-of-centre = N
                // for s=+1 (right side, u toward -z when seen from +x): choose by geometry
                const extCol = dir > 0 ? 'extP' : 'extN';
                const intCol = dir > 0 ? 'intP' : 'intN';
                // outer face seen from +s: for s=1, z decreases left-to-right in view.
                items.push({ geo: xRect(THREE, xo, y0, y1, z0, z1, s, leafUV(extCol, s > 0)), m: M() });
                items.push({ geo: xRect(THREE, xi, y0, y1, z0, z1, -s, leafUV(intCol, s < 0)), m: M() });
                // meeting-edge strip
                items.push({ geo: quadGeo(THREE,
                    [Math.min(xo, xi), y0, dz], [Math.max(xo, xi), y0, dz],
                    [Math.max(xo, xi), y1, dz], [Math.min(xo, xi), y1, dz],
                    leafUV(extCol, false)), m: M() });
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
export function buildHCMT(THREE, canvasTexture) {
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
        leaf: new THREE.MeshStandardMaterial({ map: leafTex, roughness: 0.55, metalness: 0.1, emissive: '#ffffff', emissiveMap: leafTex, emissiveIntensity: 0.22 })
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

export default function build(world) {
    const { THREE, scene } = world;
    world.ownsSky(false);
    world.groundLevel(0);
    const train = buildHCMT(THREE, (w, h, fn) => world.canvasTexture(w, h, fn));
    world.part('hcmt_train', train);
    scene.add(train);
}
