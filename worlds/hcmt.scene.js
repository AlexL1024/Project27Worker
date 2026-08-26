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
const SIDE_Y0 = 0.83, SIDE_Y1 = 3.08;   // side plane vertical extent
const ROOF_Y0 = 2.95, ROOF_Y1 = 3.68;

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
        ctx.fillStyle = C.skirt; ctx.fillRect(0, Y(1.0), W, H - Y(1.0));

        // blue faceted end wraps (over charcoal, under roof band)
        let si = 0;
        for (const z of layout.blue) {
            drawFacets(ctx, X(z[0]), Y(2.95), X(z[1]) - X(z[0]), Y(0.83) - Y(2.95), seed + 17 * (si++));
        }

        // pale roof band along the top
        const rg = ctx.createLinearGradient(0, 0, 0, Y(2.88));
        rg.addColorStop(0, C.paleBlue); rg.addColorStop(0.85, C.paleBlue); rg.addColorStop(1, '#8fb4d4');
        ctx.fillStyle = rg; ctx.fillRect(0, 0, W, Y(2.88));

        // windows
        for (const wz of layout.windows) {
            const x0 = X(wz[0]), x1 = X(wz[1]);
            roundRect(ctx, x0 - 6, Y(2.84), (x1 - x0) + 12, Y(1.68) - Y(2.84), 12);
            ctx.fillStyle = '#08090a'; ctx.fill();
            const wg = ctx.createLinearGradient(0, Y(2.80), 0, Y(1.72));
            wg.addColorStop(0, '#39434c'); wg.addColorStop(0.35, '#1c2228');
            wg.addColorStop(0.75, C.win); wg.addColorStop(1, '#0e1013');
            roundRect(ctx, x0, Y(2.80), x1 - x0, Y(1.72) - Y(2.80), 8);
            ctx.fillStyle = wg; ctx.fill();
            // diagonal sky reflection streak
            ctx.save();
            roundRect(ctx, x0, Y(2.80), x1 - x0, Y(1.72) - Y(2.80), 8); ctx.clip();
            ctx.fillStyle = 'rgba(190,215,235,0.14)';
            ctx.beginPath();
            ctx.moveTo(x0 + (x1 - x0) * 0.1, Y(2.80));
            ctx.lineTo(x0 + (x1 - x0) * 0.42, Y(2.80));
            ctx.lineTo(x0 + (x1 - x0) * 0.2, Y(1.72));
            ctx.lineTo(x0, Y(1.72));
            ctx.closePath(); ctx.fill();
            ctx.restore();
        }

        // doors
        const dw = layout.doorW;
        for (const dx of layout.doors) {
            const x0 = X(dx), x1 = X(dx + dw);
            // yellow frame
            ctx.fillStyle = C.yellow;
            ctx.fillRect(x0, Y(2.90), x1 - x0, Y(0.9) - Y(2.90));
            // leaves
            const fx0 = x0 + X(0.12) - X(0), fx1 = x1 - (X(0.12) - X(0));
            ctx.fillStyle = '#404346';
            ctx.fillRect(fx0, Y(2.82), fx1 - fx0, Y(0.95) - Y(2.82));
            const cx = (fx0 + fx1) / 2;
            // centre gap
            ctx.fillStyle = '#141516'; ctx.fillRect(cx - 3, Y(2.82), 6, Y(0.95) - Y(2.82));
            // leaf windows (tall, near centre)
            for (const s of [-1, 1]) {
                roundRect(ctx, s > 0 ? cx + X(0.07) : cx - X(0.07) - X(0.36), Y(2.76), X(0.36), Y(1.4) - Y(2.76), 8);
                ctx.fillStyle = '#0d0f11'; ctx.fill();
                const dg = ctx.createLinearGradient(0, Y(2.76), 0, Y(1.4));
                dg.addColorStop(0, 'rgba(120,140,155,0.25)'); dg.addColorStop(0.4, 'rgba(0,0,0,0)');
                ctx.fillStyle = dg;
                roundRect(ctx, s > 0 ? cx + X(0.07) : cx - X(0.07) - X(0.36), Y(2.76), X(0.36), Y(1.4) - Y(2.76), 8);
                ctx.fill();
                // pale blue stripe pair on each leaf, outboard of window
                const sx = s > 0 ? cx + X(0.55) : cx - X(0.55) - X(0.15);
                ctx.fillStyle = 'rgba(185,211,232,0.8)';
                ctx.fillRect(sx, Y(2.6), X(0.05), Y(1.05) - Y(2.6));
                ctx.fillRect(sx + X(0.1), Y(2.6), X(0.05), Y(1.05) - Y(2.6));
            }
        }

        // subtle panel seams between elements
        ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(0, Y(1.0)); ctx.lineTo(W, Y(1.0)); ctx.stroke();

        ctx.restore();
        // car number (drawn unmirrored so text reads correctly)
        if (layout.number) {
            let nx = X(layout.numberX);
            if (mirror) nx = W - nx;
            ctx.fillStyle = '#f2f4f6';
            ctx.font = 'bold ' + Math.round(S * 0.26) + 'px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(layout.number, nx, Y(2.45));
        }
    });
}

// ---------------------------------------------------------------------------
// nose front texture: silver mask, black windscreen band w/ Westall, yellow bib
function makeFrontTex(canvasTexture) {
    // covers x -1.35..1.35 (2.7 m), y 0.35..3.05 (2.7 m); 200 px/m
    const S = 200, W = 540, H = 540;
    const X = m => (m + 1.35) * S;
    const Y = m => (3.05 - m) * S;
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
            for (let k = 0; k < 10; k++) {
                ctx.fillRect(X(lx - 0.022), Y(2.75) + k * 19, S * 0.044, 9);
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
    const W = 560, H = 500;
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
        ctx.fillStyle = '#0b0c0d'; ctx.fillRect(123, 30, 60, 140);
    });
    const matEnd = new THREE.MeshStandardMaterial({ map: endTex, roughness: 0.7 });

    // layouts
    const midLayout = {
        L: CAR_L, doorW: 1.7,
        blue: [[0, 2.0], [20.4, 22]],
        doors: [2.3, 10.0, 16.9],
        windows: [[5.0, 6.4], [7.1, 8.5], [12.2, 13.6], [14.3, 15.7], [19.0, 20.0]]
    };
    const cabBodyL = CAR_L - NOSE_L; // 18.6 m
    const cabLayout = {
        L: cabBodyL, doorW: 1.7,
        blue: [[0, 1.9], [17.4, 18.6]],
        doors: [2.1, 8.7, 14.4],
        windows: [[4.6, 5.9], [6.6, 7.9], [10.8, 12.1], [12.7, 14.0], [16.4, 17.2]]
    };

    const midTexR = makeSideTex(canvasTexture, midLayout, false, 40);
    const midTexL = makeSideTex(canvasTexture, midLayout, true, 40);
    const cabTexR = makeSideTex(canvasTexture, cabLayout, false, 71);
    const cabTexL = makeSideTex(canvasTexture, cabLayout, true, 71);
    const matMidR = new THREE.MeshStandardMaterial({ map: midTexR, roughness: 0.55, metalness: 0.1 });
    const matMidL = new THREE.MeshStandardMaterial({ map: midTexL, roughness: 0.55, metalness: 0.1 });
    const matCabR = new THREE.MeshStandardMaterial({ map: cabTexR, roughness: 0.55, metalness: 0.1 });
    const matCabL = new THREE.MeshStandardMaterial({ map: cabTexL, roughness: 0.55, metalness: 0.1 });

    const frontTex = makeFrontTex(canvasTexture);
    const matFront = new THREE.MeshStandardMaterial({ map: frontTex, roughness: 0.5, metalness: 0.1 });
    const noseSideTexR = makeNoseSideTex(canvasTexture, false);
    const noseSideTexL = makeNoseSideTex(canvasTexture, true);
    const matNoseR = new THREE.MeshStandardMaterial({ map: noseSideTexR, roughness: 0.5, metalness: 0.1 });
    const matNoseL = new THREE.MeshStandardMaterial({ map: noseSideTexL, roughness: 0.5, metalness: 0.1 });

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
        const yBot = 0.35, yMid = 1.95, yTop = 3.05;
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
        const rearPts = [[-1.5, 3.42], [-0.76, ROOF_Y1], [0.76, ROOF_Y1], [1.5, 3.42]];
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
        rc.push({ geo: triGeo(THREE, [1.5, 3.42, zb], [foTopX, yTop, foTopZ], [SIDE_X, SIDE_Y1, zb]), m: new THREE.Matrix4() });
        rc.push({ geo: triGeo(THREE, [-SIDE_X, SIDE_Y1, zb], [-foTopX, yTop, foTopZ], [-1.5, 3.42, zb]), m: new THREE.Matrix4() });
        car.add(new THREE.Mesh(mergeGeoms(THREE, rc), matRoof));

        // under-nose skirt + coupler
        const skirtItems = [
            { geo: new THREE.BoxGeometry(2.2, 0.42, 2.2), m: mat4(THREE, 0, 0.35, zf - 1.0) },
            { geo: new THREE.BoxGeometry(0.44, 0.34, 0.9), m: mat4(THREE, 0, 0.5, zf - 0.35) },
            // filler under the tapered cab side, closes the daylight gap
            { geo: new THREE.BoxGeometry(2.4, 0.5, 2.2), m: mat4(THREE, 0, 0.6, zb + 1.1) }
        ];
        car.add(new THREE.Mesh(mergeGeoms(THREE, skirtItems), matUnder));

        return car;
    }

    // -----------------------------------------------------------------------
    // gangway between cars
    function makeGangway() {
        const g = new THREE.Group();
        const bell = new THREE.Mesh(new THREE.BoxGeometry(2.15, 2.3, GAP + 0.25), matBellows);
        bell.position.y = 1.05 + 2.3 / 2;
        g.add(bell);
        const cap = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.45, GAP + 0.2), matRoof);
        cap.position.y = 3.42;
        g.add(cap);
        return g;
    }

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
