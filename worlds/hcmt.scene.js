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
    win:      '#131415',
    skirt:    '#2b2d2f',
    dark:     '#232527'
};

const CAR_L = 22, CAR_W = 3.05, GAP = 0.6, NOSE_L = 3.4;
const SIDE_X = 1.528;          // side plane offset
const SIDE_Y0 = 0.83, SIDE_Y1 = 3.44;   // side plane vertical extent
const ROOF_Y0 = 3.32, ROOF_Y1 = 3.99;   // 3.99 m over railhead — the real car height
const SHOULDER_Y = ROOF_Y1 - 0.26;      // where the roof cap folds down to the side

// Interior datum, metres over railhead. The saloon floor sits at 1.13 so the
// train boards level with a Metro Tunnel platform, and the clear door opening
// is 1.95 m — both taken from the real HCMT rather than eyeballed, because the
// platform screen doors on the other side of the gap have to line up with them.
const FLOOR_Y = 1.13, CEIL_Y = 3.30;    // ceiling sits below the roof-shell soffit
const SILL_Y = FLOOR_Y + 0.72;          // window sill  (1.85)
const WIN_TOP = FLOOR_Y + 1.85;         // window head  (2.98)
const DOOR_TOP = FLOOR_Y + 1.95;        // top of the real opening (3.08)
const DOOR_SILL = FLOOR_Y - 0.07;       // leaf bottom, below the opening (1.06)
const RAIL_Y = FLOOR_Y + 1.83;          // overhead grab rail (2.96)
const GANG_TOP = FLOOR_Y + 1.90;        // gangway aperture head (3.03)
const DOOR_W = 1.7, LEAF_W = 0.86, LEAF_TRAVEL = 0.88;
const LEAF_H = (DOOR_TOP + 0.04) - DOOR_SILL;
const LEAF_TOP = DOOR_SILL + LEAF_H;

// The nose is drawn in its own 0.35..3.05 m frame; the geometry remaps that
// frame onto the taller body, so raising the car raises the whole mask, screen
// and bib together without redrawing a pixel of it.
const NOSE_M0 = 0.35, NOSE_M1 = 3.05;
const NY0 = 0.30, NY1 = SIDE_Y1 - 0.02;
const NM = m => NY0 + (m - NOSE_M0) * (NY1 - NY0) / (NOSE_M1 - NOSE_M0);

// what the station needs to know to put its platform edge and screen doors in
// the right place relative to this train
export const HCMT_GEOM = {
    floorY: FLOOR_Y, sideX: SIDE_X, halfWidth: 1.528,
    doorW: DOOR_W, doorTop: DOOR_TOP, roofTop: ROOF_Y1, bodyBottom: SIDE_Y0
};

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

        // base charcoal with a faint vertical sheen
        const g = ctx.createLinearGradient(0, 0, 0, H);
        g.addColorStop(0, '#55585b'); g.addColorStop(0.35, '#46484b');
        g.addColorStop(0.8, C.charcoal); g.addColorStop(1, '#333537');
        ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

        // darker skirt strip
        ctx.fillStyle = C.skirt; ctx.fillRect(0, Y(FLOOR_Y - 0.13), W, H - Y(FLOOR_Y - 0.13));

        // blue faceted end wraps (over charcoal, under roof band)
        let si = 0;
        for (const z of layout.blue) {
            drawFacets(ctx, X(z[0]), Y(WIN_TOP + 0.10), X(z[1]) - X(z[0]), Y(SIDE_Y0) - Y(WIN_TOP + 0.10), seed + 17 * (si++));
        }

        // pale roof band along the top
        const bandY = Y(SIDE_Y1 - 0.34);
        const rg = ctx.createLinearGradient(0, 0, 0, bandY);
        rg.addColorStop(0, C.paleBlue); rg.addColorStop(0.85, C.paleBlue); rg.addColorStop(1, '#8fb4d4');
        ctx.fillStyle = rg; ctx.fillRect(0, 0, W, bandY);

        // windows — dark frame kept opaque, glazing painted SEMI-TRANSPARENT so the
        // interior reads dimly through it (material uses transparent:true)
        const wTop = Y(WIN_TOP), wBot = Y(SILL_Y);
        for (const wz of layout.windows) {
            const x0 = X(wz[0]), x1 = X(wz[1]);
            roundRect(ctx, x0 - 6, Y(WIN_TOP + 0.04), (x1 - x0) + 12, Y(SILL_Y - 0.04) - Y(WIN_TOP + 0.04), 12);
            ctx.fillStyle = '#08090a'; ctx.fill();
            ctx.save();
            roundRect(ctx, x0, wTop, x1 - x0, wBot - wTop, 8);
            ctx.clip();
            ctx.clearRect(x0, wTop, x1 - x0, wBot - wTop);
            // tinted glazing (~60% see-through)
            const wg = ctx.createLinearGradient(0, wTop, 0, wBot);
            wg.addColorStop(0, 'rgba(40,50,62,0.56)'); wg.addColorStop(0.4, 'rgba(16,21,26,0.48)');
            wg.addColorStop(1, 'rgba(10,13,17,0.52)');
            ctx.fillStyle = wg;
            ctx.fillRect(x0, wTop, x1 - x0, wBot - wTop);
            // diagonal sky reflection streak
            ctx.fillStyle = 'rgba(190,215,235,0.16)';
            ctx.beginPath();
            ctx.moveTo(x0 + (x1 - x0) * 0.1, wTop);
            ctx.lineTo(x0 + (x1 - x0) * 0.42, wTop);
            ctx.lineTo(x0 + (x1 - x0) * 0.2, wBot);
            ctx.lineTo(x0, wBot);
            ctx.closePath(); ctx.fill();
            ctx.restore();
        }

        // doorways — yellow frame surround stays painted on the body; the leaf
        // area is CUT OUT of the wall (alpha 0) and real sliding meshes sit behind
        const dw = layout.doorW, pad = 0.085 * S;
        for (const dx of layout.doors) {
            const x0 = X(dx), x1 = X(dx + dw);
            // yellow frame, standing proud of the opening on all four sides
            ctx.fillStyle = C.yellow;
            ctx.fillRect(x0 - pad, Y(DOOR_TOP + 0.10), (x1 - x0) + 2 * pad,
                Y(FLOOR_Y - 0.17) - Y(DOOR_TOP + 0.10));
            // the opening itself is the full DOOR_W, so the leaves behind it and
            // the screen doors across the gap read as one aperture
            ctx.clearRect(x0, Y(DOOR_TOP), x1 - x0, Y(FLOOR_Y - 0.02) - Y(DOOR_TOP));
        }

        // subtle panel seams between elements
        ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(0, Y(FLOOR_Y - 0.13)); ctx.lineTo(W, Y(FLOOR_Y - 0.13)); ctx.stroke();

        ctx.restore();
        // car number (drawn unmirrored so text reads correctly)
        if (layout.number) {
            let nx = X(layout.numberX);
            if (mirror) nx = W - nx;
            ctx.fillStyle = '#f2f4f6';
            ctx.font = 'bold ' + Math.round(S * 0.26) + 'px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(layout.number, nx, Y(FLOOR_Y + 1.45));
        }
    });
}

// ---------------------------------------------------------------------------
// nose front texture: silver mask, black windscreen band w/ Westall, yellow bib
function makeFrontTex(canvasTexture) {
    // covers x -1.35..1.35 (2.7 m) and the nose frame 0.35..3.05, which the
    // geometry stretches onto NY0..NY1 — so the canvas is made taller by the
    // same ratio and the pixels stay square on the car.
    const S = 200, W = 540;
    const SY = S * (NY1 - NY0) / (NOSE_M1 - NOSE_M0);
    const H = Math.round((NOSE_M1 - NOSE_M0) * SY);
    const X = m => (m + 1.35) * S;
    const Y = m => (3.05 - m) * SY;
    return canvasTexture(W, H, (ctx) => {
        // silver mask base
        const sg = ctx.createLinearGradient(0, 0, 0, H);
        sg.addColorStop(0, '#d4d7d9'); sg.addColorStop(0.4, C.silver); sg.addColorStop(1, '#b0b3b6');
        ctx.fillStyle = sg; ctx.fillRect(0, 0, W, H);

        // charcoal lower nose below the mask
        ctx.fillStyle = C.charcoal;
        ctx.beginPath();
        ctx.moveTo(X(-1.35), Y(1.3));
        ctx.lineTo(X(-1.12), Y(1.42));
        ctx.lineTo(X(1.12), Y(1.42));
        ctx.lineTo(X(1.35), Y(1.3));
        ctx.lineTo(X(1.35), H); ctx.lineTo(X(-1.35), H);
        ctx.closePath(); ctx.fill();

        // black windscreen band (large, wraps toward the corner folds)
        roundRect(ctx, X(-1.18), Y(2.95), X(1.18) - X(-1.18), Y(1.98) - Y(2.95), 26);
        ctx.fillStyle = '#0b0c0d'; ctx.fill();
        // destination display strip
        ctx.fillStyle = '#101010';
        ctx.fillRect(X(-0.9), Y(2.9), X(0.9) - X(-0.9), Y(2.65) - Y(2.9));
        ctx.fillStyle = '#f5d33f';
        ctx.font = 'bold 46px Arial'; ctx.textAlign = 'center';
        ctx.fillText('Westall', X(0), Y(2.705));
        // windscreen glass with faint reflection
        const wg = ctx.createLinearGradient(0, Y(2.62), 0, Y(2.02));
        wg.addColorStop(0, '#2a3138'); wg.addColorStop(0.45, '#181c20'); wg.addColorStop(1, '#0e0f11');
        ctx.fillStyle = wg;
        ctx.fillRect(X(-1.0), Y(2.62), X(1.0) - X(-1.0), Y(2.02) - Y(2.62));
        // centre pillar + wipers
        ctx.strokeStyle = '#1f2224'; ctx.lineWidth = 5;
        ctx.beginPath(); ctx.moveTo(X(0), Y(2.62)); ctx.lineTo(X(0), Y(2.02)); ctx.stroke();
        ctx.strokeStyle = '#0a0a0a'; ctx.lineWidth = 6;
        ctx.beginPath(); ctx.moveTo(X(-0.5), Y(2.06)); ctx.lineTo(X(-0.05), Y(2.55)); ctx.stroke();

        // LED headlight / marker strips at mask edges
        for (const s of [-1, 1]) {
            const lx = s * 1.22;
            roundRect(ctx, X(lx - 0.055), Y(2.8), S * 0.11, Y(1.75) - Y(2.8), 12);
            ctx.fillStyle = '#0d0e0f'; ctx.fill();
            ctx.fillStyle = '#eef6fc';
            const step = (Y(1.8) - Y(2.75)) / 10;
            for (let k = 0; k < 10; k++) {
                ctx.fillRect(X(lx - 0.022), Y(2.75) + k * step, S * 0.044, step * 0.45);
            }
        }

        // yellow bib (two-tone chevron shape)
        ctx.fillStyle = C.yellow;
        ctx.beginPath();
        ctx.moveTo(X(-0.95), Y(1.96));
        ctx.lineTo(X(0.95), Y(1.96));
        ctx.lineTo(X(0.75), Y(1.12));
        ctx.quadraticCurveTo(X(0.6), Y(0.98), X(0.4), Y(0.98));
        ctx.lineTo(X(-0.4), Y(0.98));
        ctx.quadraticCurveTo(X(-0.6), Y(0.98), X(-0.75), Y(1.12));
        ctx.closePath(); ctx.fill();
        // bib two-tone seam + hatch line
        ctx.strokeStyle = 'rgba(150,105,0,0.55)'; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.moveTo(X(-0.86), Y(1.56)); ctx.lineTo(X(0.86), Y(1.56)); ctx.stroke();
        ctx.strokeStyle = 'rgba(90,70,10,0.5)'; ctx.lineWidth = 3;
        roundRect(ctx, X(-0.26), Y(1.9), X(0.26) - X(-0.26), Y(1.72) - Y(1.9), 6);
        ctx.stroke();

        // skirt slot grille
        ctx.fillStyle = '#141516';
        roundRect(ctx, X(-0.65), Y(0.72), X(0.65) - X(-0.65), Y(0.52) - Y(0.72), 8);
        ctx.fill();
        ctx.fillStyle = '#000';
        for (let k = 0; k < 16; k++) {
            ctx.fillRect(X(-0.61) + k * 16, Y(0.7), 6, Y(0.54) - Y(0.7));
        }

        // blue arrow decals
        for (const s of [-1, 1]) {
            const ax = s * 0.44;
            ctx.fillStyle = C.mid;
            roundRect(ctx, X(ax - 0.06), Y(0.47), S * 0.12, S * 0.12, 5); ctx.fill();
            ctx.fillStyle = '#fff';
            ctx.beginPath();
            ctx.moveTo(X(ax), Y(0.445));
            ctx.lineTo(X(ax - 0.034), Y(0.405));
            ctx.lineTo(X(ax + 0.034), Y(0.405));
            ctx.closePath(); ctx.fill();
            ctx.fillRect(X(ax - 0.012), Y(0.407), S * 0.024, S * 0.034);
        }
    });
}

// nose side texture (u=0 front, u=1 at bulkhead), covers roughly 3 m x 2.7 m
function makeNoseSideTex(canvasTexture, flip) {
    const W = 560, H = Math.round(500 * (NY1 - NY0) / (NOSE_M1 - NOSE_M0));
    return canvasTexture(W, H, (ctx) => {
        ctx.save();
        if (flip) { ctx.translate(W, 0); ctx.scale(-1, 1); }
        // charcoal base with sheen (matches body sides)
        const g = ctx.createLinearGradient(0, 0, 0, H);
        g.addColorStop(0, '#4a4d50'); g.addColorStop(0.4, '#404245');
        g.addColorStop(0.8, C.charcoal); g.addColorStop(1, '#2f3133');
        ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
        // silver mask wedge at the front (left), upper-front only
        ctx.fillStyle = C.silver;
        ctx.beginPath();
        ctx.moveTo(0, H * 0.04);
        ctx.lineTo(W * 0.22, H * 0.03);
        ctx.lineTo(W * 0.13, H * 0.5);
        ctx.lineTo(0, H * 0.66);
        ctx.closePath(); ctx.fill();
        // black cab side glazing sliver behind mask edge
        ctx.fillStyle = '#0d0e0f';
        ctx.beginPath();
        ctx.moveTo(W * 0.13, H * 0.1);
        ctx.lineTo(W * 0.26, H * 0.09);
        ctx.lineTo(W * 0.22, H * 0.4);
        ctx.lineTo(W * 0.1, H * 0.44);
        ctx.closePath(); ctx.fill();
        // pale blue roof band along the top, dipping toward the front
        ctx.fillStyle = C.paleBlue;
        ctx.beginPath();
        ctx.moveTo(W * 0.22, H * 0.03); ctx.lineTo(W, 0); ctx.lineTo(W, H * 0.1);
        ctx.lineTo(W * 0.28, H * 0.08); ctx.closePath(); ctx.fill();
        // cab access door
        ctx.fillStyle = '#2e3032';
        ctx.fillRect(W * 0.33, H * 0.12, W * 0.1, H * 0.76);
        ctx.strokeStyle = '#1a1b1c'; ctx.lineWidth = 2;
        ctx.strokeRect(W * 0.33, H * 0.12, W * 0.1, H * 0.76);
        ctx.fillStyle = '#0d0e0f';
        ctx.fillRect(W * 0.35, H * 0.16, W * 0.065, H * 0.26);
        // facets at the rear of the nose section (join with bodyside wrap)
        drawFacets(ctx, W * 0.62, H * 0.1, W * 0.38, H * 0.8, 991);
        ctx.restore();
        // 9002 number on the facet zone
        ctx.fillStyle = '#f2f4f6';
        ctx.font = 'bold 58px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('9002', flip ? W * 0.47 : W * 0.53, H * 0.28);
    });
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

        // --- pictogram band that runs over every doorway (0,700 - 664,790)
        ctx.fillStyle = '#f2f3f4'; ctx.fillRect(0, 700, 664, 90);
        // green running-man emergency exit
        ctx.fillStyle = '#12874a'; ctx.fillRect(12, 710, 96, 70);
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(44, 732, 7, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 7; ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(36, 745); ctx.lineTo(50, 752); ctx.lineTo(44, 768);
        ctx.moveTo(50, 752); ctx.lineTo(64, 762);
        ctx.moveTo(36, 745); ctx.lineTo(26, 758);
        ctx.stroke();
        ctx.lineWidth = 4;
        ctx.beginPath(); ctx.moveTo(76, 742); ctx.lineTo(98, 742);
        ctx.moveTo(90, 734); ctx.lineTo(98, 742); ctx.lineTo(90, 750); ctx.stroke();
        // blue accessibility square
        ctx.fillStyle = '#2456a8'; ctx.fillRect(120, 710, 70, 70);
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 5;
        ctx.beginPath(); ctx.arc(149, 752, 13, 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(152, 726); ctx.lineTo(152, 746); ctx.lineTo(170, 746); ctx.lineTo(174, 762);
        ctx.stroke();
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(152, 720, 5, 0, Math.PI * 2); ctx.fill();
        // row of small prohibition roundels — no smoking, no food, no skating…
        for (let i = 0; i < 6; i++) {
            const cx = 240 + i * 68;
            ctx.strokeStyle = '#c92222'; ctx.lineWidth = 5;
            ctx.beginPath(); ctx.arc(cx, 745, 24, 0, Math.PI * 2); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(cx - 17, 762); ctx.lineTo(cx + 17, 728); ctx.stroke();
            ctx.fillStyle = '#3a3d40';
            ctx.beginPath(); ctx.arc(cx, 745, 11, 0, Math.PI * 2); ctx.fill();
        }

        // --- black/white hazard stripe for the door pillar (700,700 - 744,1024)
        ctx.fillStyle = '#f4f4f4'; ctx.fillRect(700, 700, 44, 324);
        ctx.fillStyle = '#141414';
        for (let y = 700; y < 1030; y += 34) {
            ctx.beginPath();
            ctx.moveTo(700, y); ctx.lineTo(744, y - 20); ctx.lineTo(744, y - 2); ctx.lineTo(700, y + 18);
            ctx.closePath(); ctx.fill();
        }
        ctx.fillStyle = '#141414'; ctx.fillRect(718, 700, 6, 324);

        // --- navy line-diagram display strip, wall mounted (0,820 - 1024,900)
        ctx.fillStyle = '#0e1c33'; ctx.fillRect(0, 820, 1024, 80);
        ctx.strokeStyle = '#3f8ede'; ctx.lineWidth = 6;
        ctx.beginPath(); ctx.moveTo(40, 862); ctx.lineTo(980, 862); ctx.stroke();
        const line = ['Arden', 'Parkville', 'State Library', 'Town Hall', 'Anzac', 'Caulfield',
            'Carnegie', 'Hughesdale', 'Oakleigh', 'Clayton', 'Westall'];
        ctx.textAlign = 'center'; ctx.font = '13px Arial';
        for (let i = 0; i < line.length; i++) {
            const x = 60 + i * 86;
            ctx.fillStyle = i < 2 ? '#5fa8e8' : '#e9eef4';
            ctx.beginPath(); ctx.arc(x, 862, 8, 0, Math.PI * 2); ctx.fill();
            ctx.save(); ctx.translate(x + 3, 846); ctx.rotate(-0.55);
            ctx.fillStyle = '#b9c6d4'; ctx.textAlign = 'left'; ctx.fillText(line[i], 0, 0); ctx.restore();
        }
        ctx.fillStyle = '#e9eef4'; ctx.font = 'bold 16px Arial'; ctx.textAlign = 'left';
        ctx.fillText('To Westall', 20, 892);
        ctx.fillStyle = '#8fa2b4'; ctx.font = '14px Arial';
        ctx.fillText('Limited express  via Metro Tunnel', 130, 892);

        // --- ceiling air-conditioning grille (760,700 - 900,840)
        ctx.fillStyle = '#c6cacd'; ctx.fillRect(760, 700, 140, 116);
        ctx.strokeStyle = '#9da1a4'; ctx.lineWidth = 3; ctx.strokeRect(766, 706, 128, 104);
        ctx.fillStyle = '#a8acaf';
        for (let y = 714; y < 806; y += 9) ctx.fillRect(772, y, 116, 5);
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
            g.addColorStop(0, '#55585b'); g.addColorStop(0.35, '#46484b');
            g.addColorStop(0.8, C.charcoal); g.addColorStop(1, '#333537');
            ctx.fillStyle = g; ctx.fillRect(cx0, 0, 128, H);
        }
        function intBase(cx0) {
            const g = ctx.createLinearGradient(0, 0, 0, H);
            g.addColorStop(0, '#d6d9dc'); g.addColorStop(1, '#bfc3c6');
            ctx.fillStyle = g; ctx.fillRect(cx0, 0, 128, H);
            ctx.strokeStyle = '#a7abae'; ctx.lineWidth = 2;
            ctx.strokeRect(cx0 + 6, 6, 116, H - 12);
        }
        // y mapping: leaf spans DOOR_SILL..LEAF_TOP -> canvas 512..0
        const ly = m => (LEAF_TOP - m) / LEAF_H * H;
        const lx = (cx0, m) => cx0 + m / LEAF_W * 128; // m from leaf left edge
        const WT = FLOOR_Y + 1.78, WB = FLOOR_Y + 0.50;   // door window head / sill
        function leafWindow(cx0, nearRight) {
            // tall narrow window, 0.36 wide, 0.07 in from the centre-meeting edge
            const wx0 = nearRight ? lx(cx0, LEAF_W - 0.07 - 0.36) : lx(cx0, 0.07);
            const wx1 = nearRight ? lx(cx0, LEAF_W - 0.07) : lx(cx0, 0.07 + 0.36);
            roundRect(ctx, wx0 - 3, ly(WT + 0.03) - 3, (wx1 - wx0) + 6, ly(WB - 0.03) - ly(WT + 0.03) + 6, 8);
            ctx.fillStyle = '#1a1c1e'; ctx.fill();
            const dg = ctx.createLinearGradient(0, ly(WT), 0, ly(WB));
            dg.addColorStop(0, '#39434c'); dg.addColorStop(0.4, '#15191d'); dg.addColorStop(1, '#0c0e10');
            ctx.fillStyle = dg;
            roundRect(ctx, wx0, ly(WT), wx1 - wx0, ly(WB) - ly(WT), 6); ctx.fill();
            ctx.fillStyle = 'rgba(180,205,225,0.13)';
            ctx.fillRect(wx0 + 2, ly(WT), (wx1 - wx0) * 0.3, ly(WB) - ly(WT));
        }
        function extLeaf(cx0, nearRight) {
            extBase(cx0);
            leafWindow(cx0, nearRight);
            // pale-blue vertical stripe pair, outboard of window
            const sxm = nearRight ? 0.18 : LEAF_W - 0.18 - 0.15;
            ctx.fillStyle = 'rgba(178,205,228,0.68)';
            ctx.fillRect(lx(cx0, sxm), ly(FLOOR_Y + 1.55), 0.045 / LEAF_W * 128, ly(FLOOR_Y - 0.05) - ly(FLOOR_Y + 1.55));
            ctx.fillRect(lx(cx0, sxm + 0.1), ly(FLOOR_Y + 1.55), 0.045 / LEAF_W * 128, ly(FLOOR_Y - 0.05) - ly(FLOOR_Y + 1.55));
            // meeting-edge dark rubber
            const ex = nearRight ? cx0 + 124 : cx0;
            ctx.fillStyle = '#141516'; ctx.fillRect(ex, 0, 4, H);
        }
        function intLeaf(cx0, nearRight) {
            intBase(cx0);
            leafWindow(cx0, nearRight);
            // yellow edge highlight at meeting edge (interior)
            const ex = nearRight ? cx0 + 120 : cx0 + 2;
            ctx.fillStyle = '#f0b421'; ctx.fillRect(ex, ly(FLOOR_Y + 1.40), 6, ly(FLOOR_Y + 0.10) - ly(FLOOR_Y + 1.40));
            // green "press to open" button and its plate, outboard of the window
            const bx = nearRight ? lx(cx0, 0.16) : lx(cx0, LEAF_W - 0.24);
            ctx.fillStyle = '#c8cbce';
            roundRect(ctx, bx, ly(FLOOR_Y + 1.20), 0.14 / LEAF_W * 128, ly(FLOOR_Y + 0.98) - ly(FLOOR_Y + 1.20), 6);
            ctx.fill();
            ctx.fillStyle = '#3fae4a';
            ctx.beginPath();
            ctx.arc(bx + 0.07 / LEAF_W * 128, (ly(FLOOR_Y + 1.20) + ly(FLOOR_Y + 0.98)) / 2,
                0.045 / LEAF_W * 128, 0, Math.PI * 2);
            ctx.fill();
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
            wall.push({ geo: xRect(THREE, x, FLOOR_Y, SILL_Y, sp[0], sp[1], face), m: M() });
        }
        // window band, minus doors and windows
        for (const sp of solidSpans(zMin, zMax, doorHoles.concat(winZ))) {
            wall.push({ geo: xRect(THREE, x, SILL_Y, DOOR_TOP, sp[0], sp[1], face), m: M() });
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
            // diamond-plate threshold in the doorway, as in the reference photos
            decal.push({
                geo: yRect(THREE, FLOOR_Y + 0.004, jx0, jx1, dz - DOOR_W / 2, dz + DOOR_W / 2, 1,
                    uvR(0, 470, 200, 670)), m: M()
            });
        }
        // window reveals (top/bottom sills)
        for (const wz of winZ) {
            wall.push({ geo: yRect(THREE, SILL_Y, Math.min(s * wallX, s * SIDE_X), Math.max(s * wallX, s * SIDE_X), wz[0], wz[1], 1), m: M() });
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
            wall.push({ geo: zRect(THREE, e.z, -0.65, 0.65, GANG_TOP, CEIL_Y, e.face), m: M() });
        } else {
            // white bulkhead with door decal + KEEP CLEAR
            wall.push({ geo: zRect(THREE, e.z, -1.42, 1.42, FLOOR_Y, CEIL_Y, e.face), m: M() });
            decal.push({ geo: zRect(THREE, e.z + e.face * 0.01, -0.05, 0.8, FLOOR_Y, CEIL_Y - 0.05, e.face, uvR(860, 0, 1024, 470)), m: M() });
        }
    }

    // ---- seats -------------------------------------------------------------
    // Every seat records the length of wall it occupies, so the vestibule
    // pilasters placed later can simply refuse to stand where a seat already is
    // rather than relying on me to have done the arithmetic right six times.
    const occupied = { '-1': [], '1': [] };
    const occupy = (s, z0, z1) => occupied[String(s)].push([Math.min(z0, z1), Math.max(z0, z1)]);
    const isFree = (s, z0, z1, pad = 0.05) =>
        !occupied[String(s)].some(o => o[1] + pad > z0 && o[0] - pad < z1);

    // longitudinal flip-up row: n seats from z0, on side s. variant: 0 blue, 1 orange
    function seatRow(s, z0, n, variant, folded) {
        const u0 = variant ? 0.52 : 0.02, u1 = variant ? 0.98 : 0.48;
        occupy(s, z0 - 0.06, z0 + n * 0.48 + 0.06);   // seats plus the backboard behind them
        for (let i = 0; i < n; i++) {
            const zc = z0 + 0.235 + i * 0.48;
            if (folded) {
                // folded-up grey pad against the wall
                seatGrey.push({ geo: new THREE.BoxGeometry(0.09, 0.62, 0.44), m: mat4(THREE, s * (wallX - 0.075), FLOOR_Y + 0.62, zc) });
                seatGrey.push({ geo: new THREE.BoxGeometry(0.05, 0.1, 0.4), m: mat4(THREE, s * (wallX - 0.045), FLOOR_Y + 0.27, zc) });
            } else {
                // back cushion
                const bk = new THREE.BoxGeometry(0.07, 0.52, 0.44);
                uvRegion(bk, u0, u1, 0, 1);
                cushion.push({ geo: bk, m: mat4(THREE, s * (wallX - 0.065), FLOOR_Y + 0.76, zc, 0, 0, s * 0.08) });
                // seat pad
                const pd = new THREE.BoxGeometry(0.42, 0.07, 0.44);
                uvRegion(pd, u0, u1, 0, 1);
                cushion.push({ geo: pd, m: mat4(THREE, s * (wallX - 0.26), FLOOR_Y + 0.45, zc) });
                // grey base
                seatGrey.push({ geo: new THREE.BoxGeometry(0.36, 0.34, 0.4), m: mat4(THREE, s * (wallX - 0.24), FLOOR_Y + 0.24, zc) });
                // moulded grey side shell with the wave relief the real seats have
                seatGrey.push({ geo: new THREE.BoxGeometry(0.30, 0.50, 0.035), m: mat4(THREE, s * (wallX - 0.23), FLOOR_Y + 0.72, zc - 0.225) });
            }
        }
        // shared grey backrest board behind the row
        if (!folded) {
            seatGrey.push({ geo: new THREE.BoxGeometry(0.04, 0.75, n * 0.48 + 0.06), m: mat4(THREE, s * (wallX - 0.025), FLOOR_Y + 0.72, z0 + n * 0.24), });
        }
    }
    // facing fixed bay: two benches (2-seat) facing each other, orange variant
    function facingBay(s, zc) {
        occupy(s, zc - 1.0, zc + 1.0);
        for (const d of [-1, 1]) {
            const zb = zc + d * 0.62;
            const u0 = 0.52, u1 = 0.98;
            const pd = new THREE.BoxGeometry(0.9, 0.08, 0.44); uvRegion(pd, u0, u1, 0, 1);
            cushion.push({ geo: pd, m: mat4(THREE, s * 0.93, FLOOR_Y + 0.46, zb) });
            const bk = new THREE.BoxGeometry(0.9, 0.55, 0.08); uvRegion(bk, u0, u1, 0, 1);
            cushion.push({ geo: bk, m: mat4(THREE, s * 0.93, FLOOR_Y + 0.74, zb + d * 0.22, d * -0.12, 0, 0) });
            seatGrey.push({ geo: new THREE.BoxGeometry(0.86, 0.34, 0.38), m: mat4(THREE, s * 0.93, FLOOR_Y + 0.25, zb) });
            // grey back shell
            seatGrey.push({ geo: new THREE.BoxGeometry(0.9, 0.64, 0.05), m: mat4(THREE, s * 0.93, FLOOR_Y + 0.73, zb + d * 0.3) });
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

    // ---- vestibule pilasters ------------------------------------------------
    // The moulded pillar that stands between a doorway and the seating bay: it
    // is what you actually see framing the door from the platform, and it gives
    // the grab pole and the hazard stripe something to sit on.
    const PIL_D = 0.10, PIL_L = 0.28;                 // depth into the saloon / length along z
    const pilasters = [];
    for (const s of [-1, 1]) {
        for (const dz of doorZ) {
            for (const e of [-1, 1]) {
                const z0 = dz + e * (DOOR_W / 2 + 0.02), z1 = dz + e * (DOOR_W / 2 + 0.02 + PIL_L);
                if (!isFree(s, z0, z1)) continue;      // a seat is already there
                occupy(s, z0, z1);
                pilasters.push({ s, e, dz, zc: (z0 + z1) / 2 });
                wall.push({
                    geo: new THREE.BoxGeometry(PIL_D, CEIL_Y - FLOOR_Y, PIL_L),
                    m: mat4(THREE, s * (wallX - PIL_D / 2), (FLOOR_Y + CEIL_Y) / 2, (z0 + z1) / 2)
                });
                // hazard stripe up the face of it, as on the real door pillar
                decal.push({
                    geo: xRect(THREE, s * (wallX - PIL_D - 0.006), FLOOR_Y + 0.12, DOOR_TOP - 0.06,
                        Math.min(z0, z1) + 0.03, Math.min(z0, z1) + 0.10, -s, uvR(700, 700, 744, 1024)), m: M()
                });
            }
        }
    }

    // yellow grab poles, standing proud of the pilaster face
    for (const p of pilasters) {
        yellow.push({
            geo: new THREE.CylinderGeometry(0.019, 0.019, CEIL_Y - FLOOR_Y - 0.06, 8),
            m: mat4(THREE, p.s * (wallX - PIL_D - 0.05), (FLOOR_Y + CEIL_Y) / 2, p.zc)
        });
        steel.push({ geo: new THREE.CylinderGeometry(0.03, 0.03, 0.05, 8), m: mat4(THREE, p.s * (wallX - PIL_D - 0.05), CEIL_Y - 0.03, p.zc) });
    }
    // overhead longitudinal rails
    const railLen = zMax - zMin - 1.4;
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
            // the strap is a long yellow loop, not a ring — stretch the torus
            yellow.push({ geo: new THREE.TorusGeometry(0.062, 0.011, 6, 14), m: mat4(THREE, sx, RAIL_Y - 0.155, z, 0, 0, 0, 1, 2.1, 1) });
            yellow.push({ geo: new THREE.BoxGeometry(0.03, 0.09, 0.018), m: mat4(THREE, sx, RAIL_Y - 0.04, z) });
        }
    }
    // vertical poles: straight ones near doorway/seat boundaries + centre tripods
    const poleZ = cab ? [[0.75, -0.9], [0.75, 0.75], [-0.85, 2.7], [0.85, 2.7], [-0.85, -4.9], [0.85, -4.9]]
        : [[-0.85, 1.35], [0.85, 1.35], [-0.85, 6.65], [0.85, 6.65], [-0.85, -1.05], [0.85, -1.05], [-0.85, -5.6], [0.85, -5.6]];
    for (const [px2, pz2] of poleZ) {
        yellow.push({ geo: new THREE.CylinderGeometry(0.023, 0.023, CEIL_Y - FLOOR_Y, 10), m: mat4(THREE, px2, (FLOOR_Y + CEIL_Y) / 2, pz2) });
        steel.push({ geo: new THREE.CylinderGeometry(0.035, 0.035, 0.05, 8), m: mat4(THREE, px2, CEIL_Y - 0.04, pz2) });
    }
    // centre tripod poles
    const TRI_Y = FLOOR_Y + 0.90;
    const triZ = cab ? [4.2] : [3.85, -3.35];
    for (const tz of triZ) {
        yellow.push({ geo: new THREE.CylinderGeometry(0.024, 0.024, CEIL_Y - TRI_Y, 10), m: mat4(THREE, 0, (CEIL_Y + TRI_Y) / 2, tz) });
        for (const a of [-1, 0, 1]) {
            const dx = a * 0.28;
            const len = Math.sqrt((TRI_Y - FLOOR_Y) ** 2 + dx * dx);
            yellow.push({ geo: new THREE.CylinderGeometry(0.02, 0.02, len, 8), m: mat4(THREE, dx / 2, (TRI_Y + FLOOR_Y) / 2, tz, 0, 0, Math.atan2(dx, TRI_Y - FLOOR_Y)) });
        }
        steel.push({ geo: new THREE.CylinderGeometry(0.04, 0.04, 0.07, 8), m: mat4(THREE, 0, TRI_Y, tz) });
    }

    // ---- signage -----------------------------------------------------------
    // hung route-map displays transverse over the aisle (~2 per car)
    const rmZ = P.rmZ || (cab ? [2.0, -4.9] : [2.6, -2.9]);
    const RM_Y = CEIL_Y - 0.28;
    for (const rz of rmZ) {
        grey.push({ geo: new THREE.BoxGeometry(1.56, 0.34, 0.055), m: mat4(THREE, 0, RM_Y, rz) });
        steel.push({ geo: new THREE.BoxGeometry(0.03, 0.12, 0.03), m: mat4(THREE, -0.6, CEIL_Y - 0.06, rz) });
        steel.push({ geo: new THREE.BoxGeometry(0.03, 0.12, 0.03), m: mat4(THREE, 0.6, CEIL_Y - 0.06, rz) });
        for (const f of [-1, 1]) {
            decal.push({ geo: zRect(THREE, rz + f * 0.03, f > 0 ? -0.75 : 0.75, f > 0 ? 0.75 : -0.75, RM_Y - 0.14, RM_Y + 0.15, f, uvR(0, 0, 1024, 200)), m: M() });
        }
    }
    // ceiling PID boxes near two doorways
    const PID_Y = CEIL_Y - 0.11;
    const pidZ = [doorZ[0] - 1.35, doorZ[2] + 1.35];
    for (const pz3 of pidZ) {
        grey.push({ geo: new THREE.BoxGeometry(0.6, 0.19, 0.1), m: mat4(THREE, 0, PID_Y, pz3) });
        for (const f of [-1, 1]) {
            decal.push({ geo: zRect(THREE, pz3 + f * 0.051, f > 0 ? -0.28 : 0.28, f > 0 ? 0.28 : -0.28, PID_Y - 0.085, PID_Y + 0.085, f, uvR(0, 210, 400, 340)), m: M() });
        }
    }
    // ceiling air-conditioning grilles down the centre band
    for (let z = zMin + 2.6; z < zMax - 1.4; z += 3.6) {
        if (doorZ.some(dz => Math.abs(z - dz) < 1.9)) continue;   // clear of doorways and the PID boxes beside them
        decal.push({ geo: yRect(THREE, CEIL_Y - 0.012, -0.28, 0.28, z - 0.3, z + 0.3, -1, uvR(760, 700, 900, 816)), m: M() });
    }

    // wall decals: carriage plates, network map poster, emergency panel, priority sticker
    for (const s of [-1, 1]) {
        const x = s * (wallX - 0.006), face = -s;
        const midDoor = doorZ[1];

        // the pictogram band that sits over every doorway
        for (const dz of doorZ) {
            decal.push({ geo: xRect(THREE, x, DOOR_TOP + 0.03, DOOR_TOP + 0.155, dz - 0.62, dz + 0.62, face, uvR(0, 700, 664, 790)), m: M() });
        }

        // the long navy line-diagram display, high on the wall between doorways
        const dispZ = (doorZ[0] + doorZ[1]) / 2;
        decal.push({ geo: xRect(THREE, x, DOOR_TOP + 0.05, DOOR_TOP + 0.20, dispZ - 1.35, dispZ + 1.35, face, uvR(0, 820, 1024, 900)), m: M() });
        decal.push({ geo: xRect(THREE, x, FLOOR_Y + 1.50, FLOOR_Y + 1.61, zMin + 0.5, zMin + 0.92, face, uvR(0, 360, 300, 440)), m: M() });
        decal.push({ geo: xRect(THREE, x, FLOOR_Y + 0.85, FLOOR_Y + 1.57, midDoor + 1.22, midDoor + 1.72, face, uvR(420, 210, 700, 650)), m: M() });
        decal.push({ geo: xRect(THREE, x, FLOOR_Y + 0.70, FLOOR_Y + 1.10, midDoor - 1.42, midDoor - 1.2, face, uvR(720, 210, 850, 450)), m: M() });
        decal.push({ geo: xRect(THREE, x, FLOOR_Y + 1.55, FLOOR_Y + 1.83, doorZ[2] - 1.48, doorZ[2] - 1.24, face, uvR(220, 470, 340, 610)), m: M() });
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
                const y0 = DOOR_SILL, y1 = LEAF_TOP;
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
    // 100 px per metre: the cap spans x -1.525..1.525 and y SIDE_Y0..SIDE_Y1
    const capW = Math.round(CAR_W * 100), capH = Math.round((SIDE_Y1 - SIDE_Y0) * 100);
    const cX = m => (m + CAR_W / 2) * 100, cY = m => (SIDE_Y1 - m) * 100;
    const endTex = canvasTexture(capW, capH, (ctx) => {
        ctx.fillStyle = C.dark; ctx.fillRect(0, 0, capW, capH);
        drawFacets(ctx, 0, 0, 72, capH, 5);
        drawFacets(ctx, capW - 72, 0, 72, capH, 9);
        ctx.fillStyle = '#141516';
        ctx.fillRect(cX(-0.84), cY(GANG_TOP + 0.16), cX(0.84) - cX(-0.84), cY(FLOOR_Y - 0.28) - cY(GANG_TOP + 0.16));
        // open gangway aperture (real hole; alphaTest cuts it)
        ctx.clearRect(cX(-0.71), cY(GANG_TOP), cX(0.71) - cX(-0.71), cY(FLOOR_Y - 0.15) - cY(GANG_TOP));
    });
    const matEnd = new THREE.MeshStandardMaterial({ map: endTex, roughness: 0.7, transparent: true, alphaTest: 0.5, side: THREE.DoubleSide });

    const midTexR = makeSideTex(canvasTexture, midLayout, false, 40);
    const midTexL = makeSideTex(canvasTexture, midLayout, true, 40);
    const cabTexR = makeSideTex(canvasTexture, cabLayout, false, 71);
    const cabTexL = makeSideTex(canvasTexture, cabLayout, true, 71);
    const sideOpts = { roughness: 0.55, metalness: 0.1, transparent: true, alphaTest: 0.05, side: THREE.DoubleSide };
    const matMidR = new THREE.MeshStandardMaterial({ map: midTexR, ...sideOpts });
    const matMidL = new THREE.MeshStandardMaterial({ map: midTexL, ...sideOpts });
    const matCabR = new THREE.MeshStandardMaterial({ map: cabTexR, ...sideOpts });
    const matCabL = new THREE.MeshStandardMaterial({ map: cabTexL, ...sideOpts });

    const frontTex = makeFrontTex(canvasTexture);
    const matFront = new THREE.MeshStandardMaterial({ map: frontTex, roughness: 0.5, metalness: 0.1 });
    const noseSideTexR = makeNoseSideTex(canvasTexture, false);
    const noseSideTexL = makeNoseSideTex(canvasTexture, true);
    const matNoseR = new THREE.MeshStandardMaterial({ map: noseSideTexR, roughness: 0.5, metalness: 0.1 });
    const matNoseL = new THREE.MeshStandardMaterial({ map: noseSideTexL, roughness: 0.5, metalness: 0.1 });

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

        // ---- nose ----
        // front face: 3 vertical strips x 2 rows — raked windscreen above,
        // protruding chin/bib below (widest at the mid line)
        const colX = [-1.35, -0.72, 0.72, 1.35];
        const colZ = [zf - 0.55, zf, zf, zf - 0.55];
        const topShrink = 0.96, rake = 0.62;
        const yBot = NM(0.35), yMid = NM(1.95), yTop = NM(3.05);
        const botShrink = 0.92, chin = 0.18, botTuck = 0.28;
        function frontCol(i, row) {
            if (row === 2) return [colX[i] * topShrink, yTop, colZ[i] - rake];
            if (row === 1) return [colX[i], yMid, colZ[i] + chin];
            return [colX[i] * botShrink, yBot, colZ[i] + chin - botTuck];
        }
        const vMid = (yMid - yBot) / (yTop - yBot);
        const rowV = [0, vMid, 1];
        const frontItems = [];
        for (let i = 0; i < 3; i++) {
            const u0 = (colX[i] + 1.35) / 2.7, u1 = (colX[i + 1] + 1.35) / 2.7;
            for (let r = 0; r < 2; r++) {
                frontItems.push({
                    geo: quadGeo(THREE,
                        frontCol(i, r), frontCol(i + 1, r), frontCol(i + 1, r + 1), frontCol(i, r + 1),
                        [[u0, rowV[r]], [u1, rowV[r]], [u1, rowV[r + 1]], [u0, rowV[r + 1]]]),
                    m: new THREE.Matrix4()
                });
            }
        }
        car.add(new THREE.Mesh(mergeGeoms(THREE, frontItems), matFront));

        const foTopX = 1.35 * topShrink, foTopZ = zf - 0.55 - rake; // outer front-top corner
        const fiTopZ = zf - rake;
        const foMidZ = zf - 0.55 + chin;
        const foBotX = 1.35 * botShrink, foBotZ = zf - 0.55 + chin - botTuck;
        const rMidY = SIDE_Y0 + (SIDE_Y1 - SIDE_Y0) * vMid; // rear edge mid point
        const vMidTex = vMid;

        // nose side quads (two rows to follow the chin profile)
        const srLow = quadGeo(THREE,
            [SIDE_X, SIDE_Y0, zb],
            [SIDE_X, rMidY, zb],
            [1.35, yMid, foMidZ],
            [foBotX, yBot, foBotZ],
            [[1, 0], [1, vMidTex], [0, vMidTex], [0, 0]]);
        const srHigh = quadGeo(THREE,
            [SIDE_X, rMidY, zb],
            [SIDE_X, SIDE_Y1, zb],
            [foTopX, yTop, foTopZ],
            [1.35, yMid, foMidZ],
            [[1, vMidTex], [1, 1], [0, 1], [0, vMidTex]]);
        car.add(new THREE.Mesh(mergeGeoms(THREE, [
            { geo: srLow, m: new THREE.Matrix4() }, { geo: srHigh, m: new THREE.Matrix4() }
        ]), matNoseR));
        const slLow = quadGeo(THREE,
            [-foBotX, yBot, foBotZ],
            [-1.35, yMid, foMidZ],
            [-SIDE_X, rMidY, zb],
            [-SIDE_X, SIDE_Y0, zb],
            [[0, 0], [0, vMidTex], [1, vMidTex], [1, 0]]);
        const slHigh = quadGeo(THREE,
            [-1.35, yMid, foMidZ],
            [-foTopX, yTop, foTopZ],
            [-SIDE_X, SIDE_Y1, zb],
            [-SIDE_X, rMidY, zb],
            [[0, vMidTex], [0, 1], [1, 1], [1, vMidTex]]);
        const sl = mergeGeoms(THREE, [
            { geo: slLow, m: new THREE.Matrix4() }, { geo: slHigh, m: new THREE.Matrix4() }
        ]);
        car.add(new THREE.Mesh(sl, matNoseL));

        // roof cap over cab (pale blue), 3 strips + corner fillers
        const rc = [];
        const rearPts = [[-1.5, SHOULDER_Y], [-0.76, ROOF_Y1], [0.76, ROOF_Y1], [1.5, SHOULDER_Y]];
        const frontPts = [
            [-foTopX, yTop, foTopZ],
            [-0.72 * topShrink, yTop, fiTopZ],
            [0.72 * topShrink, yTop, fiTopZ],
            [foTopX, yTop, foTopZ]
        ];
        for (let i = 0; i < 3; i++) {
            rc.push({
                geo: quadGeo(THREE,
                    [rearPts[i + 1][0], rearPts[i + 1][1], zb],
                    [rearPts[i][0], rearPts[i][1], zb],
                    frontPts[i],
                    frontPts[i + 1]),
                m: new THREE.Matrix4()
            });
        }
        // corner fillers between roof cap and nose sides
        rc.push({ geo: triGeo(THREE, [1.5, SHOULDER_Y, zb], [foTopX, yTop, foTopZ], [SIDE_X, SIDE_Y1, zb]), m: new THREE.Matrix4() });
        rc.push({ geo: triGeo(THREE, [-SIDE_X, SIDE_Y1, zb], [-foTopX, yTop, foTopZ], [-1.5, SHOULDER_Y, zb]), m: new THREE.Matrix4() });
        car.add(new THREE.Mesh(mergeGeoms(THREE, rc), matRoof));

        // under-nose skirt + coupler
        const skirtItems = [
            { geo: new THREE.BoxGeometry(2.2, 0.42, 2.2), m: mat4(THREE, 0, 0.35, zf - 1.0) },
            { geo: new THREE.BoxGeometry(0.44, 0.34, 0.9), m: mat4(THREE, 0, 0.5, zf - 0.35) },
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
        const shellBot = FLOOR_Y - 0.46, shellTop = CEIL_Y + 0.42;
        const shellItems = [
            { geo: new THREE.BoxGeometry(0.36, shellTop - shellBot, 0.62), m: mat4(THREE, -0.895, (shellBot + shellTop) / 2, 0) },
            { geo: new THREE.BoxGeometry(0.36, shellTop - shellBot, 0.62), m: mat4(THREE, 0.895, (shellBot + shellTop) / 2, 0) },
            { geo: new THREE.BoxGeometry(2.15, 0.32, 0.62), m: mat4(THREE, 0, shellTop - 0.16, 0) },
            { geo: new THREE.BoxGeometry(2.15, 0.30, 0.62), m: mat4(THREE, 0, shellBot + 0.15, 0) }
        ];
        g.add(new THREE.Mesh(mergeGeoms(THREE, shellItems), matBellows));
        const cap = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.45, GAP + 0.2), matRoof);
        cap.position.y = SHOULDER_Y;
        g.add(cap);
        // interior lining: inward-facing tunnel walls + ceiling, ribbed grey
        const linBot = FLOOR_Y - 0.10, linTop = CEIL_Y - 0.07;
        const lin = [];
        lin.push({ geo: xRect(THREE, -0.71, linBot, linTop, -0.55, 0.55, 1), m: new THREE.Matrix4() });
        lin.push({ geo: xRect(THREE, 0.71, linBot, linTop, -0.55, 0.55, -1), m: new THREE.Matrix4() });
        lin.push({ geo: yRect(THREE, linTop, -0.71, 0.71, -0.55, 0.55, -1), m: new THREE.Matrix4() });
        // concertina ribs: rectangular loops standing proud of the lining
        for (const rz of [-0.3, -0.1, 0.1, 0.3]) {
            lin.push({ geo: new THREE.BoxGeometry(0.06, linTop - linBot, 0.075), m: mat4(THREE, -0.665, (linBot + linTop) / 2, rz) });
            lin.push({ geo: new THREE.BoxGeometry(0.06, linTop - linBot, 0.075), m: mat4(THREE, 0.665, (linBot + linTop) / 2, rz) });
            lin.push({ geo: new THREE.BoxGeometry(1.4, 0.06, 0.075), m: mat4(THREE, 0, linTop - 0.03, rz) });
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
                yr.push({ geo: new THREE.CylinderGeometry(0.02, 0.02, 1.62, 8), m: mat4(THREE, sx, FLOOR_Y + 0.79, sz) });
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
