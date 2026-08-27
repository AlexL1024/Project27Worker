//
//  long-call.scene.js
//  Project27 worlds
//
//  A seaside band rotunda on a headland, half past five, and somebody's chips
//  are on the floor of it. Three silver gulls have their heads down in them.
//
//  A fourth is not eating. It has its neck run straight up — a white column, a
//  hand taller than a gull has any business being — with the skull folded right
//  over the top of it, bill swung down and open, and it is yelling: the long
//  call, the head pumping down on every note. It is doing this while running,
//  which is the part that makes it funny, and it is running down a fifth bird,
//  a first-year with brown across the wing, who has decided that the way out of
//  this is around, and is going round and round the floorboards with its wings
//  half up and its tail cocked, passing the same three feeding birds every
//  four seconds. None of the three look up.
//
//  Everything else — the low sun coming in under the eaves as a hard wedge of
//  light across the concrete, the galvanised roof above, the sea a long way
//  down past the balustrade — is there so the argument has a floor to happen on.
//

import { mergeGeometries } from './BufferGeometryUtils.js';

export default function build(world) {
    const { THREE, scene, camera } = world;

    world.ownsSky(true);

    /* ==========================================================
       0 · Small tools
       ========================================================== */

    const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
    const V2 = (x, y) => new THREE.Vector2(x, y);
    const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
    const lerp = (a, b, t) => a + (b - a) * t;
    const smooth = (e0, e1, x) => { const t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };
    const srgb = (hex) => new THREE.Color(hex).convertSRGBToLinear();
    const TAU = Math.PI * 2;

    // Deterministic: the same five birds having the same argument every time.
    let _seed = 71104329;
    const rnd = () => { _seed = (_seed * 1664525 + 1013904223) % 4294967296; return _seed / 4294967296; };
    const rr = (a, b) => a + (b - a) * rnd();

    const hash2 = (x, y) => { const n = Math.sin(x * 127.1 + y * 311.7) * 43758.545; return n - Math.floor(n); };
    function vnoise(x, y) {
        const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
        const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
        const a = hash2(xi, yi), b = hash2(xi + 1, yi), c = hash2(xi, yi + 1), d = hash2(xi + 1, yi + 1);
        return a * (1 - u) * (1 - v) + b * u * (1 - v) + c * (1 - u) * v + d * u * v;
    }
    function fbm2(x, y, oct = 4) {
        let s = 0, a = 0.5, f = 1;
        for (let i = 0; i < oct; i++) { s += a * vnoise(x * f, y * f); f *= 2.03; a *= 0.5; }
        return s;
    }

    const _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion();
    const _eu = new THREE.Euler(), _pv = new THREE.Vector3(), _sv = new THREE.Vector3();
    /** A transformed copy of a geometry, ready for merging. */
    function placed(geo, px, py, pz, rx = 0, ry = 0, rz = 0, s = 1) {
        _eu.set(rx, ry, rz);
        _m4.compose(_pv.set(px, py, pz), _q.setFromEuler(_eu), _sv.setScalar(s));
        return geo.clone().applyMatrix4(_m4);
    }

    /**
     * mergeGeometries refuses a mixed bag of indexed and non-indexed parts, and
     * ExtrudeGeometry is the one thing here that comes back non-indexed. Give it
     * a trivial index rather than tearing every box apart to match it.
     */
    function indexed(g) {
        if (!g.index) {
            const n = g.attributes.position.count;
            const ix = new Array(n);
            for (let i = 0; i < n; i++) ix[i] = i;
            g.setIndex(ix);
        }
        for (const key of Object.keys(g.attributes))
            if (key !== 'position' && key !== 'normal' && key !== 'uv') g.deleteAttribute(key);
        return g;
    }

    /**
     * A closed tube swept along a polyline with a per-station radius. Necks,
     * tarsi, toes and balusters are all one of these — a bird is mostly tapered
     * tubes with a skull on the end.
     */
    function sweep(points, radiusOf, radialSegs = 12, cap = true) {
        const N = points.length;
        const pos = [], nor = [], uvs = [], idx = [];
        const tangents = [];
        for (let i = 0; i < N; i++) {
            const a = points[Math.max(0, i - 1)], b = points[Math.min(N - 1, i + 1)];
            const t = new THREE.Vector3().subVectors(b, a);
            if (t.lengthSq() < 1e-12) t.set(0, 1, 0);
            tangents.push(t.normalize());
        }
        const ref = Math.abs(tangents[0].y) > 0.9 ? V3(1, 0, 0) : V3(0, 1, 0);
        let nrm = new THREE.Vector3().crossVectors(tangents[0], ref).normalize();
        for (let i = 0; i < N; i++) {
            // Parallel transport, so the cross-section does not spin along the sweep.
            nrm = nrm.clone().addScaledVector(tangents[i], -nrm.dot(tangents[i]));
            if (nrm.lengthSq() < 1e-10) nrm = new THREE.Vector3().crossVectors(tangents[i], ref);
            nrm.normalize();
            const bin = new THREE.Vector3().crossVectors(tangents[i], nrm).normalize();
            const t = N > 1 ? i / (N - 1) : 0;
            const r = radiusOf(t, i);
            const ra = (typeof r === 'number') ? r : r[0];
            const rb = (typeof r === 'number') ? r : r[1];
            for (let j = 0; j <= radialSegs; j++) {
                const a = (j / radialSegs) * TAU;
                const dir = nrm.clone().multiplyScalar(Math.cos(a) * ra).addScaledVector(bin, Math.sin(a) * rb);
                const p = points[i].clone().add(dir);
                const n = nrm.clone().multiplyScalar(Math.cos(a) / Math.max(ra, 1e-5))
                    .addScaledVector(bin, Math.sin(a) / Math.max(rb, 1e-5)).normalize();
                pos.push(p.x, p.y, p.z);
                nor.push(n.x, n.y, n.z);
                uvs.push(j / radialSegs, t);
            }
        }
        for (let i = 0; i < N - 1; i++) {
            for (let j = 0; j < radialSegs; j++) {
                const a = i * (radialSegs + 1) + j, b = a + radialSegs + 1;
                idx.push(a, b, a + 1, b, b + 1, a + 1);
            }
        }
        if (cap) {
            for (const end of [0, N - 1]) {
                const c = pos.length / 3;
                pos.push(points[end].x, points[end].y, points[end].z);
                const tg = tangents[end], s = end === 0 ? -1 : 1;
                nor.push(tg.x * s, tg.y * s, tg.z * s);
                uvs.push(0.5, end === 0 ? 0 : 1);
                const ring = end * (radialSegs + 1);
                for (let j = 0; j < radialSegs; j++) {
                    const a = ring + j, b = ring + j + 1;
                    if (end === 0) idx.push(c, b, a); else idx.push(c, a, b);
                }
            }
        }
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
        g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
        g.setIndex(idx);
        return g;
    }

    /** One feather: base at the origin, tip at -z, uv.v running base → tip. */
    function featherGeo(len, wid, tipWid, droop) {
        const g = new THREE.PlaneGeometry(1, 1, 2, 8);
        g.rotateX(-Math.PI / 2);
        const p = g.attributes.position;
        for (let i = 0; i < p.count; i++) {
            const x = p.getX(i);
            const t = clamp(0.5 - p.getZ(i), 0, 1);
            const shape = Math.pow(Math.sin(Math.min(t, 0.995) * Math.PI * 0.80 + 0.30), 0.55);
            const nx = x * lerp(wid, tipWid, t) * shape;
            p.setX(i, nx);
            p.setZ(i, -t * len);
            p.setY(i, -droop * t * t + Math.abs(nx) * 0.12);
        }
        g.computeVertexNormals();
        return g;
    }

    /* ==========================================================
       1 · The dimensions of the rotunda, since everything refers to them
       ========================================================== */

    const FY = 0.62;             // top of the floor slab
    const R_FLOOR = 3.95;        // circumradius of the octagonal deck
    const R_COL = 3.55;          // the column ring
    const COL_H = 2.86;          // floor to the underside of the plate
    const PLATE_Y = FY + COL_H;
    const R_EAVE = 4.50;
    const ROOF_H = 1.95;
    const RAIL_Y = FY + 0.94;
    const SIDES = 8;
    // Corners of the octagon; bays are centred halfway between them. Two opposite
    // bays are left open for the steps, and the low sun comes in through one of
    // them and lands as a wedge on the concrete.
    const CORNER = (k) => Math.PI / SIDES + k * (TAU / SIDES);
    const BAY = (k) => k * (TAU / SIDES);
    const OPEN_BAYS = [1, 5];    // 45° (toward the camera) and 225° (toward the sun)

    /** Radius of a regular polygon of circumradius R at world angle a. */
    function polyR(a, R, sides = SIDES) {
        const step = TAU / sides;
        let d = ((a - Math.PI / sides) % step + step) % step - step / 2;
        return R * Math.cos(Math.PI / sides) / Math.cos(d);
    }

    world.groundLevel(FY);
    camera.position.set(1.62, FY + 0.68, 2.32);

    /* ==========================================================
       2 · The light of the hour
       ========================================================== */

    // Thirty degrees up and low in the west: high enough to clear the eaves on
    // the far side and reach the floor, low enough that what reaches it is a
    // hard-edged wedge rather than a room full of daylight.
    const SUN_DIR = V3(-0.60, 0.50, -0.62).normalize();
    const C_SUN = srgb(0xffd7a2);
    const C_ZEN = srgb(0x2f6fbb);
    const C_MID = srgb(0x8ab9e0);
    const C_HOR = srgb(0xf4dcbc);
    const C_DEEP = srgb(0x123f60);
    const C_SHAL = srgb(0x2c7f9c);
    const C_FOAM = srgb(0xf8f5ee);

    const FOG_COL = C_HOR.clone();
    const FOG_DENSITY = 0.0022;
    scene.fog = new THREE.FogExp2(FOG_COL.clone(), FOG_DENSITY);

    const sun = new THREE.DirectionalLight(0xffdcb0, 3.35);
    sun.position.copy(SUN_DIR).multiplyScalar(60);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    {
        const c = sun.shadow.camera;
        c.left = -9.5; c.right = 9.5; c.top = 9.5; c.bottom = -9.5;
        c.near = 34; c.far = 96;
        sun.shadow.bias = -0.00042;
        sun.shadow.normalBias = 0.018;
    }
    scene.add(sun, sun.target);

    // One cool fill out of the open sky on the shaded side, so the underside of
    // a roof and the shaded half of a white bird read blue rather than black.
    const fill = new THREE.DirectionalLight(0xa6c6ff, 0.62);
    fill.position.set(7, 8, 9);
    scene.add(fill);

    // Two real lights, and that is the whole budget spent. The warm ground
    // colour on the hemisphere is the sunlit concrete bouncing back up.
    scene.add(new THREE.HemisphereLight(0xbcd8ff, 0xd9bb8c, 1.15));
    scene.add(new THREE.AmbientLight(0xffeacf, 0.20));

    world.bloom({ strength: 0.24, radius: 0.70, threshold: 0.88 });

    const uTime = { value: 0 };
    const uCamPos = { value: new THREE.Vector3() };

    /* ==========================================================
       3 · Painted textures
       ========================================================== */

    /* --- The deck, drawn once in place ----------------------------
       The floor is one octagon and never tiles, so it gets one painted sheet
       with the compass band, the worn traffic ring, the grease halo under the
       chips and every splat exactly where it belongs.                      */
    const FLOOR_S = 1024;
    const toPx = (x, z) => [(x / (2 * R_FLOOR) + 0.5) * FLOOR_S, (z / (2 * R_FLOOR) + 0.5) * FLOOR_S];
    const CHIPS = V2(-0.58, -0.56);          // where the parcel went down

    const floorTex = world.canvasTexture(FLOOR_S, FLOOR_S, (g, cv) => {
        const S = cv.width, C = S / 2;
        const mPx = S / (2 * R_FLOOR);       // pixels per metre
        g.fillStyle = '#b9b3a4';
        g.fillRect(0, 0, S, S);
        // Cloudy curing, the way a poured slab goes off unevenly.
        for (let i = 0; i < 300; i++) {
            const x = Math.random() * S, y = Math.random() * S, r = 40 + Math.random() * 200;
            const grad = g.createRadialGradient(x, y, 0, x, y, r);
            const v = Math.random() < 0.5 ? 255 : 118;
            grad.addColorStop(0, `rgba(${v},${v - 6},${v - 18},${0.02 + Math.random() * 0.05})`);
            grad.addColorStop(1, 'rgba(0,0,0,0)');
            g.fillStyle = grad;
            g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
        }
        // Exposed aggregate.
        for (let i = 0; i < 16000; i++) {
            const x = Math.random() * S, y = Math.random() * S;
            const k = Math.random();
            g.fillStyle = k < 0.42 ? `rgba(96,90,80,${0.10 + Math.random() * 0.30})`
                : k < 0.78 ? `rgba(220,214,200,${0.10 + Math.random() * 0.35})`
                    : `rgba(152,134,110,${0.08 + Math.random() * 0.22})`;
            g.beginPath(); g.arc(x, y, 0.7 + Math.random() * 2.6, 0, TAU); g.fill();
        }
        // The painted compass band the council put down in 1974 and never renewed.
        const ring = (r, w, col, alpha) => {
            g.strokeStyle = col; g.globalAlpha = alpha; g.lineWidth = w * mPx;
            g.beginPath(); g.arc(C, C, r * mPx, 0, TAU); g.stroke();
            g.globalAlpha = 1;
        };
        ring(2.62, 0.085, '#8d3a2c', 0.46);
        ring(2.42, 0.030, '#8d3a2c', 0.30);
        ring(0.98, 0.060, '#8d3a2c', 0.38);
        // Eight rays out of the middle, one per bay, worn to nearly nothing.
        for (let k = 0; k < 8; k++) {
            const a = BAY(k);
            g.save();
            g.translate(C, C); g.rotate(a);
            g.globalAlpha = 0.26 + 0.1 * hash2(k, 3);
            g.fillStyle = '#8d3a2c';
            g.beginPath();
            g.moveTo(1.02 * mPx, -0.075 * mPx);
            g.lineTo(2.38 * mPx, -0.030 * mPx);
            g.lineTo(2.38 * mPx, 0.030 * mPx);
            g.lineTo(1.02 * mPx, 0.075 * mPx);
            g.closePath(); g.fill();
            g.restore();
        }
        g.globalAlpha = 1;
        // Wear: paint scrubbed off wherever anybody actually walks, which is a
        // ring inside the columns and two tracks in from the open bays.
        g.globalCompositeOperation = 'source-over';
        for (let i = 0; i < 2200; i++) {
            const a = Math.random() * TAU;
            const r = (1.6 + Math.random() * 1.5) * mPx;
            g.fillStyle = `rgba(188,182,170,${0.05 + Math.random() * 0.16})`;
            g.beginPath();
            g.arc(C + Math.cos(a) * r, C + Math.sin(a) * r, 4 + Math.random() * 26, 0, TAU);
            g.fill();
        }
        for (const k of OPEN_BAYS) {
            const a = BAY(k);
            for (let i = 0; i < 700; i++) {
                const t = Math.random();
                const r = lerp(0.2, 3.7, t) * mPx;
                const spread = (Math.random() - 0.5) * lerp(0.5, 1.1, t) * mPx;
                g.fillStyle = `rgba(192,186,174,${0.06 + Math.random() * 0.16})`;
                g.beginPath();
                g.arc(C + Math.cos(a) * r - Math.sin(a) * spread,
                    C + Math.sin(a) * r + Math.cos(a) * spread, 5 + Math.random() * 22, 0, TAU);
                g.fill();
            }
        }
        // Board-form joints radiating from the middle: the slab was poured in
        // eight segments, one per bay, and the saw cuts follow the corners.
        for (let k = 0; k < 8; k++) {
            const a = CORNER(k);
            const grad = g.createLinearGradient(C, C, C + Math.cos(a) * S, C + Math.sin(a) * S);
            grad.addColorStop(0, 'rgba(58,52,46,0.55)');
            grad.addColorStop(1, 'rgba(58,52,46,0.22)');
            g.strokeStyle = grad; g.lineWidth = 0.024 * mPx * 2;
            g.beginPath(); g.moveTo(C, C); g.lineTo(C + Math.cos(a) * S, C + Math.sin(a) * S); g.stroke();
        }
        // The grease halo under the chips, and everything that has spat out of it.
        const [gx, gy] = toPx(CHIPS.x, CHIPS.y);
        const blot = (x, y, r, col, a) => {
            const grad = g.createRadialGradient(x, y, 0, x, y, r);
            grad.addColorStop(0, `rgba(${col},${a})`);
            grad.addColorStop(0.55, `rgba(${col},${a * 0.5})`);
            grad.addColorStop(1, `rgba(${col},0)`);
            g.fillStyle = grad;
            g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
        };
        blot(gx, gy, 0.62 * mPx, '92,72,44', 0.30);
        blot(gx + 8, gy - 6, 0.30 * mPx, '76,56,30', 0.34);
        for (let i = 0; i < 34; i++) {
            const a = Math.random() * TAU, d = (0.25 + Math.random() * 1.1) * mPx;
            blot(gx + Math.cos(a) * d, gy + Math.sin(a) * d,
                (0.02 + Math.random() * 0.07) * mPx, '96,76,46', 0.12 + Math.random() * 0.20);
        }
        // Old salt, chewing gum, general rotunda filth.
        for (let i = 0; i < 70; i++)
            blot(Math.random() * S, Math.random() * S, 20 + Math.random() * 110,
                Math.random() < 0.5 ? '158,152,138' : '110,102,90', 0.05 + Math.random() * 0.07);
        // Gull splats. There is no rotunda without them.
        for (let i = 0; i < 46; i++) {
            const a = Math.random() * TAU, d = Math.pow(Math.random(), 0.6) * 0.48 * S;
            const x = C + Math.cos(a) * d, y = C + Math.sin(a) * d, r = 6 + Math.random() * 18;
            g.fillStyle = `rgba(246,244,234,${0.5 + Math.random() * 0.35})`;
            g.beginPath();
            for (let k = 0; k <= 14; k++) {
                const ang = (k / 14) * TAU;
                const rr2 = r * (0.6 + 0.6 * hash2(i * 3 + k, i));
                const px = x + Math.cos(ang) * rr2, py = y + Math.sin(ang) * rr2 * 0.82;
                k ? g.lineTo(px, py) : g.moveTo(px, py);
            }
            g.closePath(); g.fill();
            g.fillStyle = 'rgba(228,226,208,0.55)';
            for (let k = 0; k < 5; k++) {
                const ang = Math.random() * TAU, dd = r * (1.1 + Math.random() * 1.4);
                g.beginPath();
                g.arc(x + Math.cos(ang) * dd, y + Math.sin(ang) * dd * 0.8, 1.3 + Math.random() * 3, 0, TAU);
                g.fill();
            }
        }
        // Drifted grit and a few feathers gathered against the balustrade.
        g.fillStyle = 'rgba(176,162,136,0.42)';
        for (let i = 0; i < 2600; i++) {
            const a = Math.random() * TAU;
            const d = (3.2 + Math.pow(Math.random(), 0.4) * 0.7) * mPx;
            g.fillRect(C + Math.cos(a) * d, C + Math.sin(a) * d, 1.6, 1.6);
        }
    });

    /* --- The lined ceiling, also drawn in place -------------------- */
    const ceilTex = world.canvasTexture(1024, 1024, (g, cv) => {
        const S = cv.width, C = S / 2;
        g.fillStyle = '#a5764a';
        g.fillRect(0, 0, S, S);
        // Tongue-and-groove running out from the middle, one panel per bay,
        // with the boards laid parallel inside each panel.
        for (let k = 0; k < 8; k++) {
            const a0 = CORNER(k - 1), a1 = CORNER(k);
            g.save();
            g.beginPath();
            g.moveTo(C, C);
            g.lineTo(C + Math.cos(a0) * S, C + Math.sin(a0) * S);
            g.lineTo(C + Math.cos(a1) * S, C + Math.sin(a1) * S);
            g.closePath();
            g.clip();
            g.translate(C, C);
            g.rotate(BAY(k));
            const grain = (y, h, shade) => {
                g.fillStyle = shade;
                g.fillRect(-S, y, 2 * S, h);
            };
            for (let b = -18; b <= 18; b++) {
                const y = b * 26;
                const v = 0.5 + 0.5 * hash2(k * 7 + b, 11);
                grain(y, 24, `rgba(${(150 + v * 46) | 0},${(104 + v * 34) | 0},${(58 + v * 26) | 0},1)`);
                // The shadow line in the groove.
                g.fillStyle = 'rgba(52,32,16,0.45)';
                g.fillRect(-S, y + 24, 2 * S, 2.4);
                // Grain along the board.
                g.globalAlpha = 0.16;
                g.strokeStyle = '#5c3a1c';
                g.lineWidth = 1;
                for (let i = 0; i < 16; i++) {
                    const yy = y + 2 + Math.random() * 20;
                    g.beginPath();
                    g.moveTo(-S, yy);
                    for (let x = -S; x <= S; x += 90) g.lineTo(x, yy + Math.sin(x * 0.008 + i) * 1.8);
                    g.stroke();
                }
                g.globalAlpha = 1;
            }
            g.restore();
        }
        // Old varnish, gone amber where the sun gets in and grey where it does not.
        const glow = g.createRadialGradient(C, C, 0, C, C, S * 0.5);
        glow.addColorStop(0, 'rgba(255,214,150,0.10)');
        glow.addColorStop(1, 'rgba(60,54,58,0.28)');
        g.fillStyle = glow;
        g.fillRect(0, 0, S, S);
        for (let i = 0; i < 60; i++) {
            const x = Math.random() * S, y = Math.random() * S, r = 30 + Math.random() * 150;
            const st = g.createRadialGradient(x, y, 0, x, y, r);
            st.addColorStop(0, `rgba(70,58,44,${0.05 + Math.random() * 0.10})`);
            st.addColorStop(1, 'rgba(70,58,44,0)');
            g.fillStyle = st;
            g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
        }
        // Nests in the corners, and the mess under them.
        for (let k = 0; k < 8; k++) {
            const a = CORNER(k);
            const x = C + Math.cos(a) * S * 0.44, y = C + Math.sin(a) * S * 0.44;
            g.fillStyle = 'rgba(238,236,224,0.5)';
            for (let i = 0; i < 40; i++) {
                g.beginPath();
                g.arc(x + (Math.random() - 0.5) * 90, y + (Math.random() - 0.5) * 90, 2 + Math.random() * 7, 0, TAU);
                g.fill();
            }
        }
    });

    /* --- Galvanised corrugated iron, forty years of it -------------- */
    const ironTex = world.canvasTexture(512, 512, (g, cv) => {
        const S = cv.width;
        g.fillStyle = '#9aa0a2';
        g.fillRect(0, 0, S, S);
        // Spangle: the crystal pattern hot-dip galvanising leaves behind.
        for (let i = 0; i < 900; i++) {
            const x = Math.random() * S, y = Math.random() * S, r = 4 + Math.random() * 22;
            g.fillStyle = `rgba(${190 + Math.random() * 55 | 0},${196 + Math.random() * 50 | 0},200,${0.05 + Math.random() * 0.12})`;
            g.beginPath();
            g.moveTo(x, y - r);
            for (let k = 1; k < 6; k++) {
                const a = (k / 6) * TAU - Math.PI / 2;
                g.lineTo(x + Math.cos(a) * r * (0.6 + Math.random() * 0.6), y + Math.sin(a) * r * (0.6 + Math.random() * 0.6));
            }
            g.closePath(); g.fill();
        }
        // Sheet laps, running down the slope.
        g.strokeStyle = 'rgba(72,76,78,0.42)';
        g.lineWidth = 3;
        for (let i = 0; i < 4; i++) {
            const y = (i + 0.5) * (S / 4);
            g.beginPath(); g.moveTo(0, y); g.lineTo(S, y); g.stroke();
            // Roofing screws with neoprene washers, every third corrugation.
            for (let x = 14; x < S; x += 44) {
                g.fillStyle = 'rgba(58,60,62,0.6)';
                g.beginPath(); g.arc(x, y - 5, 3.4, 0, TAU); g.fill();
                g.fillStyle = 'rgba(206,210,212,0.5)';
                g.beginPath(); g.arc(x - 0.8, y - 6, 1.6, 0, TAU); g.fill();
            }
        }
        // Rust weeping down from the screws and along the laps.
        for (let i = 0; i < 220; i++) {
            const x = Math.random() * S, y = Math.random() * S;
            const h = 8 + Math.random() * 80;
            const rg = g.createLinearGradient(x, y, x, y + h);
            rg.addColorStop(0, `rgba(150,84,38,${0.10 + Math.random() * 0.30})`);
            rg.addColorStop(1, 'rgba(150,84,38,0)');
            g.fillStyle = rg;
            g.fillRect(x, y, 1.5 + Math.random() * 4, h);
        }
        // Lichen on the shaded side.
        for (let i = 0; i < 130; i++) {
            const x = Math.random() * S, y = Math.random() * S, r = 3 + Math.random() * 14;
            g.fillStyle = `rgba(${170 + Math.random() * 40 | 0},${180 + Math.random() * 40 | 0},${140 + Math.random() * 40 | 0},${0.06 + Math.random() * 0.14})`;
            g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
        }
    });
    ironTex.wrapS = ironTex.wrapT = THREE.RepeatWrapping;

    /* --- Grass, for the headland's colour map ---------------------- */
    const grassTex = world.canvasTexture(512, 512, (g, cv) => {
        const S = cv.width;
        g.fillStyle = '#7d8b52';
        g.fillRect(0, 0, S, S);
        for (let i = 0; i < 22000; i++) {
            const k = Math.random();
            g.strokeStyle = k < 0.3 ? 'rgba(158,176,96,0.55)'
                : k < 0.62 ? 'rgba(96,110,58,0.5)'
                    : k < 0.9 ? 'rgba(126,142,78,0.5)'
                        : 'rgba(186,178,116,0.45)';
            g.lineWidth = 1 + Math.random();
            const x = Math.random() * S, y = Math.random() * S, l = 3 + Math.random() * 9;
            const a = -Math.PI / 2 + (Math.random() - 0.5) * 1.1;
            g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
        }
        // Patches burnt off by the salt wind, and clover in the hollows.
        for (let i = 0; i < 90; i++) {
            const x = Math.random() * S, y = Math.random() * S, r = 20 + Math.random() * 110;
            const rg = g.createRadialGradient(x, y, 0, x, y, r);
            const dry = Math.random() < 0.55;
            rg.addColorStop(0, dry ? 'rgba(198,184,118,0.30)' : 'rgba(78,102,52,0.28)');
            rg.addColorStop(1, 'rgba(0,0,0,0)');
            g.fillStyle = rg;
            g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
        }
    });
    grassTex.wrapS = grassTex.wrapT = THREE.RepeatWrapping;

    /* --- Butcher's paper the chips came wrapped in ----------------- */
    const paperTex = world.canvasTexture(512, 512, (g, cv) => {
        const S = cv.width;
        g.fillStyle = '#f3ebd8';
        g.fillRect(0, 0, S, S);
        for (let i = 0; i < 9000; i++) {
            g.fillStyle = Math.random() < 0.5 ? 'rgba(210,198,172,0.30)' : 'rgba(255,253,246,0.4)';
            g.fillRect(Math.random() * S, Math.random() * S, 1 + Math.random() * 3, 1);
        }
        for (let i = 0; i < 30; i++) {
            const x = Math.random() * S, y = Math.random() * S, r = 22 + Math.random() * 96;
            const grad = g.createRadialGradient(x, y, 0, x, y, r);
            grad.addColorStop(0, `rgba(198,158,92,${0.24 + Math.random() * 0.26})`);
            grad.addColorStop(0.6, 'rgba(206,172,108,0.14)');
            grad.addColorStop(1, 'rgba(210,180,120,0)');
            g.fillStyle = grad;
            g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
        }
        g.strokeStyle = 'rgba(56,96,148,0.5)';
        g.lineWidth = 8;
        g.beginPath(); g.moveTo(0, 78); g.lineTo(S, 78); g.stroke();
        g.beginPath(); g.moveTo(0, S - 78); g.lineTo(S, S - 78); g.stroke();
        g.fillStyle = 'rgba(66,62,58,0.34)';
        g.font = 'bold 32px Georgia, serif';
        g.fillText('THE HEADLAND  ·  FISH & CHIPS', 40, 142);
        g.font = '19px Georgia, serif';
        g.fillStyle = 'rgba(66,62,58,0.20)';
        for (let i = 0; i < 6; i++) g.fillText('minimum chips  ·  potato scallop  ·  flake  ·  dim sim', 40, 186 + i * 28);
        g.strokeStyle = 'rgba(148,136,112,0.4)';
        g.lineWidth = 2;
        for (let i = 0; i < 16; i++) {
            g.beginPath();
            const x0 = Math.random() * S, y0 = Math.random() * S;
            g.moveTo(x0, y0);
            g.lineTo(x0 + (Math.random() - 0.5) * 300, y0 + (Math.random() - 0.5) * 300);
            g.stroke();
        }
    });

    /* --- A chip: hot an hour ago, golden, browned at the ends ------ */
    const chipTex = world.canvasTexture(256, 256, (g, cv) => {
        const S = cv.width;
        const grad = g.createLinearGradient(0, 0, 0, S);
        grad.addColorStop(0, '#c8862f');
        grad.addColorStop(0.18, '#e8b45c');
        grad.addColorStop(0.5, '#f0c876');
        grad.addColorStop(0.82, '#e6ae52');
        grad.addColorStop(1, '#b9762a');
        g.fillStyle = grad;
        g.fillRect(0, 0, S, S);
        for (let i = 0; i < 2600; i++) {
            g.fillStyle = Math.random() < 0.5
                ? `rgba(150,92,26,${0.05 + Math.random() * 0.28})`
                : `rgba(255,236,186,${0.05 + Math.random() * 0.3})`;
            g.beginPath(); g.arc(Math.random() * S, Math.random() * S, 0.7 + Math.random() * 3.2, 0, TAU); g.fill();
        }
        for (let i = 0; i < 70; i++) {
            const x = Math.random() * S, y = Math.random() * S, r = 3 + Math.random() * 11;
            const rg = g.createRadialGradient(x, y, 0, x, y, r);
            rg.addColorStop(0, 'rgba(122,66,16,0.32)');
            rg.addColorStop(1, 'rgba(122,66,16,0)');
            g.fillStyle = rg;
            g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
        }
        g.fillStyle = 'rgba(255,255,255,0.75)';
        for (let i = 0; i < 260; i++) g.fillRect(Math.random() * S, Math.random() * S, 1.4, 1.4);
    });

    /* --- Gull plumage ---------------------------------------------
       uv.v runs shoulder (0) → wingtip (1) on the folded wing, and base → tip
       on a single feather, so one painter serves both.                      */
    function wingCanvas(juvenile) {
        return world.canvasTexture(256, 512, (g, cv) => {
            const W = cv.width, H = cv.height;
            const grad = g.createLinearGradient(0, 0, 0, H);
            grad.addColorStop(0.00, '#fbfcfd');
            grad.addColorStop(0.16, '#e2e8ee');
            grad.addColorStop(0.34, '#bcc7d1');
            grad.addColorStop(0.62, '#aab6c2');
            grad.addColorStop(0.74, '#8e9aa6');
            grad.addColorStop(0.80, '#2a2d33');
            grad.addColorStop(1.00, '#141619');
            g.fillStyle = grad;
            g.fillRect(0, 0, W, H);
            for (let row = 0; row < 15; row++) {
                const v = 0.06 + row * 0.049;
                if (v > 0.78) break;
                const y = v * H;
                const n = 5 + (row % 3);
                for (let i = 0; i < n; i++) {
                    const x = (i + 0.5) * (W / n) + Math.sin(row * 2.1 + i) * 5;
                    const rw = W / n * 0.62, rh = 15 + row * 0.7;
                    g.fillStyle = `rgba(255,255,255,${0.13 + 0.06 * hash2(row, i)})`;
                    g.beginPath(); g.ellipse(x, y, rw, rh, 0, 0, TAU); g.fill();
                    g.fillStyle = 'rgba(96,108,120,0.16)';
                    g.beginPath(); g.ellipse(x, y + rh * 0.72, rw * 0.95, rh * 0.36, 0, 0, TAU); g.fill();
                }
            }
            if (juvenile) {
                for (let i = 0; i < 200; i++) {
                    const v = 0.08 + Math.random() * 0.66;
                    const x = Math.random() * W, y = v * H;
                    const s = 6 + Math.random() * 15;
                    g.strokeStyle = `rgba(${118 + Math.random() * 34 | 0},${88 + Math.random() * 26 | 0},${48 + Math.random() * 22 | 0},${0.30 + Math.random() * 0.4})`;
                    g.lineWidth = 3 + Math.random() * 4;
                    g.beginPath();
                    g.moveTo(x - s, y + s * 0.55);
                    g.lineTo(x, y - s * 0.4);
                    g.lineTo(x + s, y + s * 0.55);
                    g.stroke();
                }
                g.fillStyle = 'rgba(96,74,44,0.42)';
                g.fillRect(0, H * 0.78, W, H * 0.22);
            }
            g.strokeStyle = 'rgba(60,64,70,0.20)';
            g.lineWidth = 1.4;
            for (let i = 0; i < 9; i++) {
                const x = (i + 0.5) * (W / 9);
                g.beginPath(); g.moveTo(x, H * 0.10); g.lineTo(x + (W / 2 - x) * 0.22, H); g.stroke();
            }
            g.fillStyle = 'rgba(255,255,255,0.85)';
            g.fillRect(0, 0, 9, H * 0.86);
            for (let i = 0; i < 3; i++) {
                g.fillStyle = juvenile ? 'rgba(238,236,228,0.55)' : 'rgba(255,255,255,0.94)';
                g.beginPath();
                g.ellipse(W * (0.28 + i * 0.22), H * 0.935, 15, 11, 0, 0, TAU);
                g.fill();
            }
        });
    }
    function primaryCanvas(juvenile) {
        return world.canvasTexture(64, 256, (g, cv) => {
            const W = cv.width, H = cv.height;
            const grad = g.createLinearGradient(0, 0, 0, H);
            grad.addColorStop(0.00, '#cfd7de');
            grad.addColorStop(0.22, '#aab5c0');
            grad.addColorStop(0.40, juvenile ? '#6c5c42' : '#3a3e45');
            grad.addColorStop(0.72, juvenile ? '#4a3d2b' : '#17191d');
            grad.addColorStop(1.00, juvenile ? '#43371f' : '#0e1013');
            g.fillStyle = grad;
            g.fillRect(0, 0, W, H);
            g.fillStyle = juvenile ? 'rgba(226,220,204,0.40)' : 'rgba(255,255,255,0.92)';
            g.beginPath(); g.ellipse(W * 0.5, H * 0.855, W * 0.30, H * 0.045, 0, 0, TAU); g.fill();
            g.strokeStyle = 'rgba(250,250,250,0.35)';
            g.lineWidth = 2.2;
            g.beginPath(); g.moveTo(W * 0.5, 0); g.lineTo(W * 0.5, H); g.stroke();
            g.globalAlpha = 0.16;
            for (let i = 0; i < 130; i++) {
                g.strokeStyle = Math.random() < 0.5 ? '#ffffff' : '#000000';
                g.lineWidth = 1;
                const y = Math.random() * H;
                g.beginPath(); g.moveTo(W * 0.5, y); g.lineTo(Math.random() * W, y + 5); g.stroke();
            }
            g.globalAlpha = 1;
        });
    }
    function tailCanvas(juvenile) {
        return world.canvasTexture(64, 256, (g, cv) => {
            const W = cv.width, H = cv.height;
            g.fillStyle = '#fbfbf8';
            g.fillRect(0, 0, W, H);
            const grad = g.createLinearGradient(0, 0, 0, H);
            grad.addColorStop(0, 'rgba(196,202,208,0.5)');
            grad.addColorStop(0.4, 'rgba(255,255,255,0)');
            g.fillStyle = grad;
            g.fillRect(0, 0, W, H);
            if (juvenile) {
                const b = g.createLinearGradient(0, H * 0.68, 0, H);
                b.addColorStop(0, 'rgba(120,102,72,0)');
                b.addColorStop(0.45, 'rgba(104,86,58,0.72)');
                b.addColorStop(0.86, 'rgba(120,102,74,0.55)');
                b.addColorStop(1, 'rgba(240,236,224,0.6)');
                g.fillStyle = b;
                g.fillRect(0, H * 0.68, W, H * 0.32);
            }
            g.strokeStyle = 'rgba(150,156,164,0.28)';
            g.lineWidth = 2;
            g.beginPath(); g.moveTo(W * 0.5, 0); g.lineTo(W * 0.5, H); g.stroke();
            g.globalAlpha = 0.13;
            for (let i = 0; i < 90; i++) {
                g.strokeStyle = '#8d949c';
                g.lineWidth = 1;
                const y = Math.random() * H;
                g.beginPath(); g.moveTo(W * 0.5, y); g.lineTo(Math.random() * W, y + 6); g.stroke();
            }
            g.globalAlpha = 1;
        });
    }
    const wingTexAdult = wingCanvas(false), wingTexJuv = wingCanvas(true);
    const primTexAdult = primaryCanvas(false), primTexJuv = primaryCanvas(true);
    const tailTexAdult = tailCanvas(false), tailTexJuv = tailCanvas(true);

    /** Body feathering: white, but not flat white — faint quilting and shadow. */
    const bodyTex = world.canvasTexture(512, 512, (g, cv) => {
        const S = cv.width;
        g.fillStyle = '#fdfdfb';
        g.fillRect(0, 0, S, S);
        for (let row = 0; row < 26; row++) {
            const y = (row + 0.5) * (S / 26);
            const n = 20;
            for (let i = 0; i < n; i++) {
                const x = (i + (row % 2) * 0.5) * (S / n);
                const rw = S / n * 0.62, rh = S / 26 * 0.78;
                g.fillStyle = `rgba(206,214,222,${0.10 + 0.07 * hash2(row, i)})`;
                g.beginPath(); g.ellipse(x, y + rh * 0.5, rw, rh * 0.55, 0, 0, TAU); g.fill();
                g.fillStyle = 'rgba(255,255,255,0.5)';
                g.beginPath(); g.ellipse(x, y - rh * 0.1, rw * 0.8, rh * 0.42, 0, 0, TAU); g.fill();
            }
        }
        g.fillStyle = 'rgba(198,208,218,0.10)';
        for (let i = 0; i < 500; i++)
            g.fillRect(Math.random() * S, Math.random() * S, 1 + Math.random() * 6, 1);
    });
    bodyTex.wrapS = bodyTex.wrapT = THREE.RepeatWrapping;

    /* --- Soft round blob, for kicked-up grit ----------------------- */
    const puffTex = world.canvasTexture(128, 128, (g, cv) => {
        const S = cv.width;
        const grad = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
        grad.addColorStop(0, 'rgba(255,255,255,0.95)');
        grad.addColorStop(0.45, 'rgba(255,255,255,0.45)');
        grad.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = grad;
        g.fillRect(0, 0, S, S);
    });

    const cloudTex = world.canvasTexture(512, 512, (g, cv) => {
        const S = cv.width;
        const base = S * 0.70;
        const puff = (x, y, r, a) => {
            const rad = g.createRadialGradient(x, y - r * 0.22, r * 0.12, x, y, r);
            rad.addColorStop(0, `rgba(255,255,255,${a})`);
            rad.addColorStop(0.55, `rgba(255,252,246,${a * 0.86})`);
            rad.addColorStop(0.84, `rgba(252,242,230,${a * 0.30})`);
            rad.addColorStop(1, 'rgba(250,240,228,0)');
            g.fillStyle = rad;
            g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
        };
        for (let i = 0; i < 8; i++) {
            const t = i / 7;
            puff(S * 0.12 + t * S * 0.76 + rr(-14, 14), base - rr(4, 24),
                rr(44, 82) * (1 - Math.abs(t - 0.5) * 0.5), rr(0.70, 0.95));
        }
        for (let i = 0; i < 13; i++) {
            const t = i / 12;
            const lift = Math.sin(t * Math.PI) * S * 0.20;
            puff(S * 0.18 + t * S * 0.64 + rr(-26, 26), base - lift - rr(8, 44),
                rr(28, 62) * (0.6 + Math.sin(t * Math.PI) * 0.6), rr(0.5, 0.88));
        }
        g.globalCompositeOperation = 'source-atop';
        const shade = g.createLinearGradient(0, base - S * 0.3, 0, base + 12);
        shade.addColorStop(0, 'rgba(255,255,255,0)');
        shade.addColorStop(0.6, 'rgba(206,186,172,0.26)');
        shade.addColorStop(1, 'rgba(178,158,150,0.5)');
        g.fillStyle = shade;
        g.fillRect(0, 0, S, S);
        g.globalCompositeOperation = 'source-over';
    });

    /* ==========================================================
       4 · Sky
       ========================================================== */

    const SKY_GLSL = /* glsl */`
      vec3 skyColor(vec3 d, vec3 sunDir, vec3 zen, vec3 mid, vec3 hor, vec3 sunCol) {
        float h = d.y;
        vec3 col = mix(hor, mid, smoothstep(-0.04, 0.24, h));
        col = mix(col, zen, smoothstep(0.12, 0.86, h));
        float sd = max(dot(normalize(d), sunDir), 0.0);
        col += sunCol * pow(sd, 30.0) * 0.34;
        col += sunCol * pow(sd, 4.5) * 0.09;
        col = mix(col, hor * 1.03, smoothstep(0.06, -0.10, h));
        return col;
      }
    `;

    const skyUniforms = {
        uSunDir: { value: SUN_DIR.clone() }, uSunCol: { value: C_SUN.clone() },
        uZen: { value: C_ZEN.clone() }, uMid: { value: C_MID.clone() }, uHor: { value: C_HOR.clone() },
    };
    const sky = new THREE.Mesh(
        new THREE.SphereGeometry(4000, 40, 26),
        new THREE.ShaderMaterial({
            side: THREE.BackSide, depthWrite: false, fog: false, uniforms: skyUniforms,
            vertexShader: `varying vec3 vDir;
              void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
            fragmentShader: SKY_GLSL + `
              varying vec3 vDir; uniform vec3 uSunDir, uSunCol, uZen, uMid, uHor;
              void main(){
                vec3 d = normalize(vDir);
                vec3 col = skyColor(d, uSunDir, uZen, uMid, uHor, uSunCol);
                float sd = max(dot(d, uSunDir), 0.0);
                col += uSunCol * smoothstep(0.99900, 0.99975, sd) * 5.0;
                gl_FragColor = vec4(col, 1.0);
              }`,
        })
    );
    sky.renderOrder = -10;
    scene.add(world.ghost(sky));

    const clouds = [];
    for (let i = 0; i < 20; i++) {
        const sp = new THREE.Sprite(new THREE.SpriteMaterial({
            map: cloudTex, transparent: true, depthWrite: false, fog: false,
            opacity: rr(0.35, 0.80),
            color: new THREE.Color().setRGB(rr(1.5, 2.0), rr(1.38, 1.82), rr(1.24, 1.62)),
        }));
        const ang = rr(0, TAU), rad = rr(320, 1800);
        const sz = rr(160, 500) * (rad / 800 + 0.5);
        sp.position.set(Math.cos(ang) * rad, rr(160, 480) + rad * 0.05, Math.sin(ang) * rad);
        sp.scale.set(sz, sz * rr(0.34, 0.56), 1);
        sp.userData.drift = rr(0.6, 2.1);
        sp.renderOrder = -5;
        clouds.push(sp);
        scene.add(world.ghost(sp));
    }

    /* ==========================================================
       5 · The headland, and the sea a long way down
       ========================================================== */

    const SEA_Y = -22.0;

    /**
     * The shape of the land: a flat lawn out to about eleven metres, a crowned
     * shoulder, then the cliff, then whatever is underneath the water. The
     * rotunda sits on the flat, which is why councils put rotundas there.
     */
    function landH(x, z) {
        const d = Math.hypot(x, z);
        let y = 0;
        y -= smooth(11, 30, d) * 4.2;
        y -= smooth(26, 44, d) * 10.0;
        y -= smooth(40, 52, d) * 26.0;
        y -= smooth(50, 100, d) * 14.0;
        y += (fbm2(x * 0.045, z * 0.045, 4) - 0.5) * 2.6 * smooth(7, 24, d);
        y += (fbm2(x * 0.17, z * 0.17, 3) - 0.5) * 0.55 * smooth(5, 16, d);
        return y;
    }

    {
        // A graded radial mesh: half-metre resolution where a person is standing,
        // stretching out to a hundred and ten metres where nobody can tell.
        const NR = 84, NA = 96, R_LAND = 110;
        const pos = [], nrm = [], uvs = [], col = [], idx = [];
        const c = new THREE.Color(), SALT = new THREE.Color(0.62, 0.58, 0.36);
        for (let i = 0; i <= NR; i++) {
            const u = i / NR;
            const r = R_LAND * Math.pow(u, 2.15);
            for (let j = 0; j <= NA; j++) {
                const a = (j / NA) * TAU;
                const x = Math.cos(a) * r, z = Math.sin(a) * r;
                const y = landH(x, z);
                pos.push(x, y, z);
                nrm.push(0, 1, 0);
                uvs.push(x * 0.11, z * 0.11);
                // Grass on the flat, weathered rock on anything steep, bleached
                // tussock where the salt wind comes over the edge.
                const e = 0.9;
                const slope = clamp((landH(x + e, z) - landH(x - e, z)) ** 2 + (landH(x, z + e) - landH(x, z - e)) ** 2, 0, 400);
                const rocky = smooth(0.9, 7.0, Math.sqrt(slope));
                const salt = smooth(24, 42, Math.hypot(x, z)) * 0.75;
                const v = fbm2(x * 0.07 + 11, z * 0.07 - 4, 3);
                c.setRGB(
                    lerp(lerp(0.36, 0.62, v), 0.44, rocky),
                    lerp(lerp(0.44, 0.60, v), 0.42, rocky),
                    lerp(lerp(0.22, 0.30, v), 0.38, rocky)
                );
                c.lerp(SALT, salt * (1 - rocky) * v);
                if (y < SEA_Y + 1.2) c.multiplyScalar(0.55);
                col.push(c.r, c.g, c.b);
            }
        }
        const row = NA + 1;
        // Ring index runs outward and the angle counter-clockwise, so this is the
        // winding that puts the front face upward. Get it backwards and the
        // whole headland is lit from underneath.
        for (let i = 0; i < NR; i++)
            for (let j = 0; j < NA; j++) {
                const a = i * row + j, b = a + row;
                idx.push(a, a + 1, b, b, a + 1, b + 1);
            }
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
        g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
        g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
        g.setIndex(idx);
        g.computeVertexNormals();
        const land = new THREE.Mesh(g, new THREE.MeshStandardMaterial({
            map: grassTex, vertexColors: true, roughness: 0.98, metalness: 0.0,
        }));
        land.receiveShadow = true;
        scene.add(world.ground(land));
    }

    /* --- The water, from twenty-two metres up ---------------------- */
    const WAVES = [
        [0.18, -1.00, 0.085, 26.0, 0.95],
        [-0.42, -0.90, 0.062, 15.0, 1.06],
        [0.55, -0.83, 0.042, 8.6, 1.20],
        [-0.88, -0.47, 0.028, 4.8, 1.38],
    ];
    const WAVE_GLSL = /* glsl */`
      void addWave(vec2 dir, float steep, float wl, float spd, vec2 p, float t,
                   inout vec3 disp, inout vec3 tang, inout vec3 bino) {
        float k = 6.28318530718 / wl;
        float c = sqrt(9.81 / k) * spd;
        vec2 d = normalize(dir);
        float f = k * (dot(d, p) - c * t);
        float a = steep / k;
        float sf = sin(f), cf = cos(f);
        disp += vec3(d.x * a * cf, a * sf, d.y * a * cf);
        tang += vec3(-d.x * d.x * steep * sf, d.x * steep * cf, -d.x * d.y * steep * sf);
        bino += vec3(-d.x * d.y * steep * sf, d.y * steep * cf, -d.y * d.y * steep * sf);
      }
    `;
    const waveCalls = WAVES.map(w =>
        `addWave(vec2(${w[0].toFixed(3)}, ${w[1].toFixed(3)}), ${w[2].toFixed(3)}, ${w[3].toFixed(2)}, ${w[4].toFixed(2)}, p, t, disp, tang, bino);`
    ).join('\n            ');

    const seaUniforms = {
        uTime, uCamPos,
        uSunDir: { value: SUN_DIR.clone() }, uSunCol: { value: C_SUN.clone() },
        uZen: { value: C_ZEN.clone() }, uMid: { value: C_MID.clone() }, uHor: { value: C_HOR.clone() },
        uDeep: { value: C_DEEP.clone() }, uShal: { value: C_SHAL.clone() }, uFoam: { value: C_FOAM.clone() },
        uFogCol: { value: FOG_COL.clone() }, uFogDensity: { value: FOG_DENSITY },
    };

    const seaGeo = (() => {
        // Rings again, centred on the headland: dense where the swell is breaking
        // on the rocks below and stretched out toward the horizon.
        const NR = 120, NA = 128, R_SEA = 1400;
        const pos = [], nrm = [], uvs = [], idx = [];
        for (let i = 0; i <= NR; i++) {
            const u = i / NR;
            const r = 6 + R_SEA * Math.pow(u, 2.6);
            for (let j = 0; j <= NA; j++) {
                const a = (j / NA) * TAU;
                pos.push(Math.cos(a) * r, SEA_Y, Math.sin(a) * r);
                nrm.push(0, 1, 0);
                uvs.push(j / NA, u);
            }
        }
        const row = NA + 1;
        for (let i = 0; i < NR; i++)
            for (let j = 0; j < NA; j++) {
                const a = i * row + j, b = a + row;
                idx.push(a, a + 1, b, b, a + 1, b + 1);
            }
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
        g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
        g.setIndex(idx);
        return g;
    })();

    const sea = new THREE.Mesh(seaGeo, new THREE.ShaderMaterial({
        uniforms: seaUniforms,
        vertexShader: WAVE_GLSL + /* glsl */`
          uniform float uTime;
          varying vec3 vWorld; varying vec3 vNrm; varying float vCrest;
          void main(){
            vec3 wp = (modelMatrix * vec4(position, 1.0)).xyz;
            vec2 p = wp.xz; float t = uTime;
            vec3 disp = vec3(0.0), tang = vec3(1.0, 0.0, 0.0), bino = vec3(0.0, 0.0, 1.0);
            ${waveCalls}
            // Far water is flattened: the mesh cannot carry the detail out there,
            // and a stretched triangle waving about reads as a crawling seam.
            float far = 1.0 - smoothstep(220.0, 900.0, length(cameraPosition.xz - p)) * 0.85;
            disp *= far;
            vec3 wpos = wp + disp;
            vNrm = normalize(mix(vec3(0.0, 1.0, 0.0), normalize(cross(bino, tang)), far));
            vCrest = clamp(disp.y * 6.0, -1.0, 1.0);
            vWorld = wpos;
            gl_Position = projectionMatrix * viewMatrix * vec4(wpos, 1.0);
          }`,
        fragmentShader: SKY_GLSL + /* glsl */`
          uniform float uTime, uFogDensity;
          uniform vec3 uCamPos, uSunDir, uSunCol, uZen, uMid, uHor, uDeep, uShal, uFoam, uFogCol;
          varying vec3 vWorld; varying vec3 vNrm; varying float vCrest;

          float h21(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
          float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
            float a = h21(i), b = h21(i + vec2(1.0, 0.0)), c = h21(i + vec2(0.0, 1.0)), d = h21(i + vec2(1.0, 1.0));
            return mix(mix(a, b, f.x), mix(c, d, f.x), f.y); }
          float fbm(vec2 p){ float s = 0.0, a = 0.5; for(int i = 0; i < 4; i++){ s += a * vn(p); p *= 2.05; a *= 0.5; } return s; }

          void main(){
            float dist = length(uCamPos - vWorld);
            vec3 N = normalize(vNrm);
            float lod = clamp(dist / 110.0, 0.35, 7.0);
            vec2 rp = vWorld.xz * (0.55 / lod);
            float n1 = fbm(rp + vec2(uTime * 0.26, uTime * 0.15) / lod);
            float n2 = fbm(rp * 2.2 - vec2(uTime * 0.19, uTime * 0.31) / lod);
            N = normalize(N + vec3((n1 - 0.5) * 0.34, 0.0, (n2 - 0.5) * 0.34));

            vec3 V = normalize(uCamPos - vWorld);
            float fres = mix(0.026, 1.0, pow(1.0 - max(dot(N, V), 0.0), 5.0));
            vec3 R = reflect(-V, N); R.y = abs(R.y);
            vec3 refl = skyColor(R, uSunDir, uZen, uMid, uHor, uSunCol);

            // Shallow over the reef right under the cliff, deep everywhere else.
            float shelf = smoothstep(42.0, 120.0, length(vWorld.xz));
            vec3 body = mix(uShal, uDeep, shelf);
            body *= 0.80 + 0.44 * max(dot(N, uSunDir), 0.0);
            body += uShal * pow(max(vCrest, 0.0), 2.0) * 0.42 * (1.0 - shelf * 0.6);

            vec3 col = mix(body, refl, clamp(fres, 0.0, 1.0));

            vec3 H = normalize(V + uSunDir);
            float ndh = max(dot(N, H), 0.0);
            col += uSunCol * (pow(ndh, 480.0) * 0.95 + pow(ndh, 80.0) * 0.09 * (0.3 + 0.7 * fbm(vWorld.xz * 1.2 + uTime * 0.4)));

            // White water where the swell is standing up on the rocks below.
            float surf = smoothstep(58.0, 40.0, length(vWorld.xz));
            float lace = fbm(vWorld.xz * 0.34 + vec2(0.0, uTime * 0.5));
            float foam = surf * smoothstep(0.34, 0.70, lace * 0.6 + (0.5 + 0.5 * sin(uTime * 0.7 + lace * 6.0)) * 0.6);
            foam += smoothstep(0.62, 0.98, vCrest) * smoothstep(0.5, 0.95, fbm(vWorld.xz * 0.5 - uTime * 0.2)) * 0.30;
            col = mix(col, uFoam * (0.92 + 0.16 * n1), clamp(foam, 0.0, 1.0) * 0.92);

            col = mix(col, uFogCol, 1.0 - exp(-pow(dist * uFogDensity, 2.0)));
            gl_FragColor = vec4(col, 1.0);
          }`,
    }));
    sea.renderOrder = 1;
    scene.add(world.ghost(sea));

    /* ==========================================================
       6 · The rotunda
       ========================================================== */

    const MAT = {
        iron: new THREE.MeshStandardMaterial({          // painted cast iron, cream
            color: srgb(0xefe4cb), roughness: 0.58, metalness: 0.12,
        }),
        trim: new THREE.MeshStandardMaterial({          // heritage green joinery
            color: srgb(0x3b5a49), roughness: 0.66, metalness: 0.06, side: THREE.DoubleSide,
        }),
        stone: new THREE.MeshStandardMaterial({         // rendered plinth and steps
            color: srgb(0xbfb3a0), roughness: 0.95, metalness: 0.0,
        }),
        roof: new THREE.MeshStandardMaterial({
            map: ironTex, color: srgb(0xffffff), roughness: 0.44, metalness: 0.62,
            envMapIntensity: 1.0,
        }),
        ceiling: new THREE.MeshStandardMaterial({
            map: ceilTex, roughness: 0.78, metalness: 0.02, side: THREE.DoubleSide,
        }),
        floor: new THREE.MeshStandardMaterial({
            map: floorTex, roughness: 0.90, metalness: 0.0,
        }),
    };

    const rotunda = new THREE.Group();

    /** Local space for a bay: +x is outward, +z runs along the chord. */
    function bayPlace(geo, k, radius, y) {
        const a = BAY(k);
        return placed(geo, Math.cos(a) * radius, y, Math.sin(a) * radius, 0, -a, 0);
    }
    const CHORD = 2 * R_COL * Math.sin(Math.PI / SIDES);
    const R_MID = R_COL * Math.cos(Math.PI / SIDES);        // apothem of the column ring

    /* --- The deck ------------------------------------------------- */
    {
        const floorGeo = new THREE.CircleGeometry(R_FLOOR, SIDES, Math.PI / SIDES);
        floorGeo.rotateX(-Math.PI / 2);
        floorGeo.translate(0, FY, 0);
        const floor = new THREE.Mesh(floorGeo, MAT.floor);
        floor.receiveShadow = true;
        rotunda.add(floor);
    }

    /* --- Plinth, slab edge and the two flights of steps ------------ */
    {
        const parts = [];
        parts.push(new THREE.CylinderGeometry(3.93, 4.10, 1.60, SIDES, 1, false, Math.PI / SIDES)
            .translate(0, FY - 0.08 - 0.80, 0));
        // The slab lip, oversailed by the deck rather than the other way about,
        // so there is no slot around the edge to look down into.
        parts.push(new THREE.CylinderGeometry(R_FLOOR, R_FLOOR - 0.05, 0.16, SIDES, 1, true, Math.PI / SIDES)
            .translate(0, FY - 0.08, 0));
        for (const k of OPEN_BAYS) {
            for (let s = 0; s < 3; s++) {
                const top = FY - (s + 1) * 0.20;
                // Each tread tucks under the one above it, so the flight reads as
                // stone rather than as three floating slabs.
                const r0 = R_FLOOR - 0.10 + s * 0.34;
                parts.push(bayPlace(
                    new THREE.BoxGeometry(0.42 + s * 0.02, 0.60, 2.30 - s * 0.02).translate(0, -0.30, 0),
                    k, r0 + 0.18, top));
            }
            // Cheeks either side of the flight, so it is not a floating stack.
            for (const s of [-1, 1])
                parts.push(bayPlace(
                    new THREE.BoxGeometry(1.20, 0.70, 0.16).translate(0.60, -0.35, s * 1.23),
                    k, R_FLOOR - 0.12, FY - 0.06));
        }
        const plinth = new THREE.Mesh(mergeGeometries(parts.map(indexed)), MAT.stone);
        plinth.castShadow = plinth.receiveShadow = true;
        rotunda.add(plinth);
    }

    /* --- Eight cast-iron columns ----------------------------------- */
    {
        const profile = [
            [0.000, 0.00], [0.126, 0.00], [0.126, 0.09], [0.104, 0.11], [0.078, 0.15],
            [0.068, 0.22], [0.064, 0.40], [0.060, 1.60], [0.058, 2.44], [0.070, 2.52],
            [0.064, 2.56], [0.084, 2.66], [0.078, 2.70], [0.100, 2.78], [0.118, 2.84],
            [0.118, COL_H], [0.000, COL_H],
        ].map(([r, y]) => V2(r, y));
        const colGeo = new THREE.LatheGeometry(profile, 14);
        const cols = new THREE.InstancedMesh(colGeo, MAT.iron, SIDES);
        cols.castShadow = cols.receiveShadow = true;
        const d = new THREE.Object3D();
        for (let k = 0; k < SIDES; k++) {
            const a = CORNER(k);
            d.position.set(Math.cos(a) * R_COL, FY, Math.sin(a) * R_COL);
            d.rotation.set(0, -a, 0);
            d.updateMatrix();
            cols.setMatrixAt(k, d.matrix);
        }
        cols.instanceMatrix.needsUpdate = true;
        rotunda.add(cols);
    }

    /* --- The plate the roof sits on -------------------------------- */
    {
        const parts = [];
        parts.push(new THREE.CylinderGeometry(R_COL + 0.14, R_COL + 0.14, 0.22, SIDES, 1, false, Math.PI / SIDES)
            .translate(0, PLATE_Y + 0.11, 0));
        // The cornice stops well short of the eave: the roof's flared skirt comes
        // down past this height on its way out to 4.6 m, and the two must not
        // occupy the same air.
        parts.push(new THREE.CylinderGeometry(3.95, R_COL + 0.16, 0.10, SIDES, 1, false, Math.PI / SIDES)
            .translate(0, PLATE_Y + 0.27, 0));
        const plate = new THREE.Mesh(mergeGeometries(parts.map(indexed)), MAT.iron);
        plate.castShadow = plate.receiveShadow = true;
        rotunda.add(plate);
    }

    /* --- Balustrade, in every bay but the two with steps ------------ */
    {
        const closed = [];
        for (let k = 0; k < SIDES; k++) if (!OPEN_BAYS.includes(k)) closed.push(k);

        const rails = [];
        for (const k of closed) {
            // Bottom rail, top rail, and the moulded capping over it.
            rails.push(bayPlace(new THREE.BoxGeometry(0.10, 0.10, CHORD - 0.20), k, R_MID, FY + 0.17));
            rails.push(bayPlace(new THREE.BoxGeometry(0.13, 0.09, CHORD - 0.20), k, R_MID, FY + 0.88));
            rails.push(bayPlace(new THREE.BoxGeometry(0.20, 0.06, CHORD - 0.14), k, R_MID, RAIL_Y - 0.03));
        }
        const railMesh = new THREE.Mesh(mergeGeometries(rails.map(indexed)), MAT.trim);
        railMesh.castShadow = railMesh.receiveShadow = true;
        rotunda.add(railMesh);

        const balProfile = [
            [0.000, 0.00], [0.038, 0.00], [0.038, 0.05], [0.027, 0.075], [0.027, 0.10],
            [0.046, 0.15], [0.051, 0.21], [0.040, 0.28], [0.026, 0.36], [0.022, 0.44],
            [0.031, 0.50], [0.045, 0.56], [0.039, 0.63], [0.027, 0.67], [0.032, 0.70],
            [0.032, 0.75], [0.000, 0.75],
        ].map(([r, y]) => V2(r, y));
        const balGeo = new THREE.LatheGeometry(balProfile, 9);
        const PER_BAY = 7;
        const balusters = new THREE.InstancedMesh(balGeo, MAT.trim, closed.length * PER_BAY);
        balusters.castShadow = true;
        const d = new THREE.Object3D();
        let n = 0;
        for (const k of closed) {
            const a = BAY(k);
            for (let i = 0; i < PER_BAY; i++) {
                const along = (i / (PER_BAY - 1) - 0.5) * (CHORD - 0.44);
                d.position.set(
                    Math.cos(a) * R_MID - Math.sin(a) * along, FY + 0.13, Math.sin(a) * R_MID + Math.cos(a) * along);
                d.rotation.set(0, -a, 0);
                d.updateMatrix();
                balusters.setMatrixAt(n++, d.matrix);
            }
        }
        balusters.instanceMatrix.needsUpdate = true;
        rotunda.add(balusters);
    }

    /* --- Fretwork: the valance under the plate, and corner brackets -- */
    {
        const parts = [];

        // A scalloped board, cut in one shape and extruded thin.
        const vShape = new THREE.Shape();
        const L = CHORD - 0.16, TOP = 0.30, SC = 7, R_SC = L / (SC * 2);
        vShape.moveTo(-L / 2, 0);
        vShape.lineTo(L / 2, 0);
        vShape.lineTo(L / 2, -TOP + R_SC);
        for (let i = SC - 1; i >= 0; i--) {
            const cx = -L / 2 + (i + 0.5) * (L / SC);
            // Clockwise, so each lobe hangs below the board rather than biting
            // a half-moon out of the top of it.
            vShape.absarc(cx, -TOP + R_SC, R_SC, 0, Math.PI, true);
        }
        vShape.lineTo(-L / 2, 0);
        const vGeo = new THREE.ExtrudeGeometry(vShape, { depth: 0.022, bevelEnabled: false });
        vGeo.rotateY(Math.PI / 2);
        vGeo.translate(0.011, 0, 0);

        // A quarter bracket: a solid spandrel with three drilled roundels, which
        // is what every cast-iron bracket in the country actually looks like.
        const bShape = new THREE.Shape();
        const B = 0.46;
        bShape.moveTo(0, 0);
        bShape.lineTo(0, -B);
        bShape.quadraticCurveTo(-B * 0.42, -B * 0.42, B * 0 - B, 0);
        bShape.lineTo(-B, 0);
        bShape.lineTo(0, 0);
        for (const [hx, hy, hr] of [[-0.13, -0.13, 0.045], [-0.27, -0.09, 0.034], [-0.09, -0.27, 0.034]]) {
            const hole = new THREE.Path();
            hole.absarc(hx, hy, hr, 0, TAU, true);
            bShape.holes.push(hole);
        }
        const bGeo = new THREE.ExtrudeGeometry(bShape, { depth: 0.020, bevelEnabled: false });
        bGeo.rotateY(Math.PI / 2);
        bGeo.translate(0.010, 0, 0);

        // Both hang off the chord between two columns, not off the column ring:
        // a straight board set out at 3.55 m would have its ends poking a
        // quarter of a metre out through the neighbouring bay.
        for (let k = 0; k < SIDES; k++) {
            parts.push(bayPlace(vGeo, k, R_MID + 0.05, PLATE_Y - 0.02));
            for (const s of [-1, 1]) {
                const g = bGeo.clone();
                // The bracket springs from the column and reaches *in* along the
                // bay, so the one at the far end is the mirrored copy.
                if (s > 0) g.scale(1, 1, -1);
                const along = s * (CHORD / 2 - 0.12);
                parts.push(bayPlace(g, k, R_MID + 0.01, PLATE_Y - 0.03).translate(
                    -Math.sin(BAY(k)) * along, 0, Math.cos(BAY(k)) * along));
            }
        }
        const fret = new THREE.Mesh(mergeGeometries(parts.map(indexed)), MAT.trim);
        fret.castShadow = true;
        rotunda.add(fret);
    }

    /* --- The roof --------------------------------------------------
       A flared octagonal cone in corrugated iron. The corrugations are real
       geometry rather than a painted stripe, because the whole point of this
       roof is what the low sun does when it rakes along them.               */
    function roofStation(t) {
        const flare = Math.max(0, 1 - t / 0.16);
        return {
            r: R_EAVE * (1 - t) + 0.10 * flare * flare,
            y: PLATE_Y + 0.32 + ROOF_H * (0.80 * t + 0.20 * t * t) - 0.30 * Math.pow(flare, 1.7),
        };
    }
    {
        const RINGS = 13, NCORR = 88, COLS = NCORR * 4;
        const pos = [], uvs = [], idx = [];
        for (let i = 0; i <= RINGS; i++) {
            const t = i / RINGS;
            const st = roofStation(t);
            for (let j = 0; j <= COLS; j++) {
                const a = (j / COLS) * TAU;
                const base = polyR(a, st.r);
                const amp = 0.016 * clamp(st.r / R_EAVE, 0, 1);
                const r = base + amp * Math.cos(a * NCORR);
                pos.push(Math.cos(a) * r, st.y + amp * 0.35 * Math.cos(a * NCORR), Math.sin(a) * r);
                uvs.push((j / COLS) * 9, t * 2.4);
            }
        }
        const row = COLS + 1;
        // Here the ring index runs *up* the cone, so the radius shrinks as it
        // goes: the winding is the mirror of the ground's to keep the front face
        // pointing out at the sky.
        for (let i = 0; i < RINGS; i++)
            for (let j = 0; j < COLS; j++) {
                const a = i * row + j, b = a + row;
                idx.push(a, b, a + 1, b, b + 1, a + 1);
            }
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
        g.setIndex(idx);
        g.computeVertexNormals();
        const roof = new THREE.Mesh(g, MAT.roof);
        roof.castShadow = true;
        rotunda.add(roof);
    }

    /* --- Hip capping, and the finial -------------------------------- */
    {
        const parts = [];
        for (let k = 0; k < SIDES; k++) {
            const a = CORNER(k);
            const pts = [];
            for (let i = 0; i <= 10; i++) {
                const st = roofStation(i / 10);
                pts.push(V3(Math.cos(a) * st.r, st.y + 0.026, Math.sin(a) * st.r));
            }
            parts.push(sweep(pts, (t) => 0.036 * (1 - t * 0.4), 6));
        }
        const apex = roofStation(1).y;
        parts.push(new THREE.CylinderGeometry(0.10, 0.16, 0.16, 10).translate(0, apex + 0.05, 0));
        parts.push(new THREE.SphereGeometry(0.135, 14, 10).translate(0, apex + 0.24, 0));
        parts.push(new THREE.ConeGeometry(0.030, 0.34, 8).translate(0, apex + 0.50, 0));
        const cap = new THREE.Mesh(mergeGeometries(parts.map(indexed)), MAT.roof);
        cap.castShadow = true;
        rotunda.add(cap);
    }

    /* --- The lined ceiling under it --------------------------------- */
    {
        // Explicit rings rather than the roof's own stations: the lining stops at
        // the plate, not at the eave, and has to turn down to meet it.
        const RING = [[R_COL + 0.13, PLATE_Y + 0.18]];
        const STEPS = 9;
        for (let i = 0; i <= STEPS; i++) {
            const t = 0.185 + (1 - 0.185) * (i / STEPS);
            const st = roofStation(t);
            RING.push([Math.max(0, st.r - 0.06), st.y - 0.13]);
        }
        const RINGS = RING.length - 1, COLS = 64;
        const pos = [], uvs = [], idx = [];
        for (let i = 0; i <= RINGS; i++) {
            for (let j = 0; j <= COLS; j++) {
                const a = (j / COLS) * TAU;
                const r = polyR(a, RING[i][0]);
                pos.push(Math.cos(a) * r, RING[i][1], Math.sin(a) * r);
                // Planar uv, so the drawn boards land where they were drawn.
                uvs.push(Math.cos(a) * r / (2 * R_EAVE) + 0.5, Math.sin(a) * r / (2 * R_EAVE) + 0.5);
            }
        }
        const row = COLS + 1;
        for (let i = 0; i < RINGS; i++)
            for (let j = 0; j < COLS; j++) {
                const a = i * row + j, b = a + row;
                idx.push(a, b, a + 1, b, b + 1, a + 1);
            }
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
        g.setIndex(idx);
        g.computeVertexNormals();
        rotunda.add(new THREE.Mesh(g, MAT.ceiling));
    }

    scene.add(world.part('rotunda_00', rotunda));

    /* ==========================================================
       7 · The lawn around it
       ========================================================== */

    {
        const blade = new THREE.PlaneGeometry(0.024, 0.30, 1, 3);
        blade.translate(0, 0.15, 0);
        {
            const p = blade.attributes.position;
            for (let i = 0; i < p.count; i++) {
                const t = p.getY(i) / 0.30;
                p.setX(i, p.getX(i) * (1 - t * 0.85));
                p.setZ(i, -t * t * 0.11);
            }
            blade.computeVertexNormals();
        }
        const COUNT = 1100;
        const tufts = new THREE.InstancedMesh(blade, new THREE.MeshStandardMaterial({
            color: srgb(0x93a05e), roughness: 0.96, side: THREE.DoubleSide,
        }), COUNT);
        const d = new THREE.Object3D(), c = new THREE.Color();
        for (let i = 0; i < COUNT; i++) {
            const a = rr(0, TAU), r = 4.6 + Math.pow(rnd(), 0.7) * 22;
            const x = Math.cos(a) * r, z = Math.sin(a) * r;
            d.position.set(x, landH(x, z) - 0.02, z);
            d.rotation.set(rr(-0.18, 0.18), rr(0, TAU), rr(-0.30, 0.30));
            d.scale.set(rr(0.7, 1.6), rr(0.6, 1.7), 1);
            d.updateMatrix();
            tufts.setMatrixAt(i, d.matrix);
            c.setRGB(rr(0.55, 0.95), rr(0.62, 1.0), rr(0.42, 0.66));
            tufts.setColorAt(i, c);
        }
        tufts.instanceMatrix.needsUpdate = true;
        if (tufts.instanceColor) tufts.instanceColor.needsUpdate = true;
        scene.add(world.ghost(tufts));
    }

    /* --- Three Norfolk pines, leaning off the wind ------------------- */
    {
        const parts = [];
        parts.push(new THREE.CylinderGeometry(0.10, 0.34, 11.5, 8).translate(0, 5.75, 0));
        for (let i = 0; i < 13; i++) {
            const t = i / 12;
            const y = 1.9 + t * 9.4;
            const r = (1.85 - t * 1.45) * (0.9 + 0.2 * hash2(i, 5));
            parts.push(new THREE.ConeGeometry(r, 1.5 + (1 - t) * 0.5, 9)
                .translate(0, y + 0.4, 0));
        }
        const pineGeo = mergeGeometries(parts.map(indexed));
        const pineMat = new THREE.MeshStandardMaterial({ color: srgb(0x2f4a34), roughness: 0.98 });
        const pines = new THREE.InstancedMesh(pineGeo, pineMat, 3);
        pines.castShadow = true;
        const d = new THREE.Object3D();
        const SPOTS = [[-15.8, 11.4, 1.00], [-20.6, 15.2, 0.84], [-11.2, 17.9, 0.92]];
        for (let i = 0; i < SPOTS.length; i++) {
            const [x, z, s] = SPOTS[i];
            d.position.set(x, landH(x, z) - 0.2, z);
            d.rotation.set(0.05, i * 1.7, 0.075);      // everything here leans inland
            d.scale.setScalar(s);
            d.updateMatrix();
            pines.setMatrixAt(i, d.matrix);
        }
        pines.instanceMatrix.needsUpdate = true;
        scene.add(pines);
    }

    /* --- A council bench, facing the water --------------------------- */
    {
        const timber = new THREE.MeshStandardMaterial({ color: srgb(0x8a6a44), roughness: 0.88 });
        const parts = [];
        for (let i = 0; i < 3; i++)
            parts.push(new THREE.BoxGeometry(1.72, 0.045, 0.115).translate(0, 0.44, -0.14 + i * 0.145));
        for (let i = 0; i < 3; i++)
            parts.push(placed(new THREE.BoxGeometry(1.72, 0.045, 0.115), 0, 0.60 + i * 0.15, -0.30, -0.30));
        for (const s of [-1, 1]) {
            parts.push(new THREE.BoxGeometry(0.075, 0.44, 0.075).translate(s * 0.74, 0.22, -0.10));
            parts.push(new THREE.BoxGeometry(0.075, 0.44, 0.075).translate(s * 0.74, 0.22, 0.16));
            parts.push(placed(new THREE.BoxGeometry(0.06, 0.52, 0.07), s * 0.74, 0.66, -0.24, -0.30));
        }
        const bench = new THREE.Mesh(mergeGeometries(parts.map(indexed)), timber);
        bench.castShadow = bench.receiveShadow = true;
        bench.position.set(6.9, landH(6.9, 2.6), 2.6);
        bench.rotation.y = -2.05;
        scene.add(world.part('bench_00', bench));
    }

    /* ==========================================================
       8 · The chips
       ========================================================== */

    const chipMat = new THREE.MeshStandardMaterial({
        map: chipTex, roughness: 0.62, metalness: 0.02, envMapIntensity: 0.8,
    });
    const chipGeo = (() => {
        const g = new THREE.BoxGeometry(0.0125, 0.0125, 0.070, 1, 1, 4);
        const p = g.attributes.position;
        for (let i = 0; i < p.count; i++) {
            const z = p.getZ(i), t = z / 0.035;
            p.setX(i, p.getX(i) * (1 - Math.abs(t) * 0.16));
            p.setY(i, p.getY(i) * (1 - Math.abs(t) * 0.12) + t * t * 0.0035);
        }
        g.computeVertexNormals();
        return g;
    })();

    // The wrapper, opened out and gone limp.
    {
        const g = new THREE.PlaneGeometry(0.46, 0.40, 10, 9);
        g.rotateX(-Math.PI / 2);
        const p = g.attributes.position;
        for (let i = 0; i < p.count; i++) {
            const x = p.getX(i), z = p.getZ(i);
            const edge = Math.max(Math.abs(x) / 0.23, Math.abs(z) / 0.20);
            let y = (fbm2(x * 22 + 3, z * 22 - 7, 3) - 0.5) * 0.012;
            y += Math.pow(smooth(0.45, 1.0, edge), 1.6) * 0.055;      // the sides curl up
            p.setY(i, y + 0.004);
        }
        g.computeVertexNormals();
        const wrap = new THREE.Mesh(g, new THREE.MeshStandardMaterial({
            map: paperTex, roughness: 0.94, side: THREE.DoubleSide,
        }));
        wrap.castShadow = wrap.receiveShadow = true;
        wrap.position.set(CHIPS.x, FY + 0.001, CHIPS.y);
        wrap.rotation.y = 0.62;
        scene.add(world.part('wrap_00', wrap));
    }

    // Forty chips out of the parcel and across the concrete, in one call.
    {
        const N = 44;
        const spill = new THREE.InstancedMesh(chipGeo, chipMat, N);
        spill.castShadow = spill.receiveShadow = true;
        const d = new THREE.Object3D();
        for (let i = 0; i < N; i++) {
            const a = rr(0, TAU), r = Math.pow(rnd(), 0.55) * 0.62;
            d.position.set(CHIPS.x + Math.cos(a) * r, FY + 0.007 + (rnd() < 0.18 ? 0.011 : 0), CHIPS.y + Math.sin(a) * r);
            d.rotation.set(rr(-0.2, 0.2), rr(0, TAU), rr(-0.25, 0.25));
            d.scale.set(rr(0.8, 1.25), rr(0.8, 1.2), rr(0.55, 1.35));
            d.updateMatrix();
            spill.setMatrixAt(i, d.matrix);
        }
        spill.instanceMatrix.needsUpdate = true;
        scene.add(world.ghost(spill));
    }

    // And six that got kicked clear, which anyone can pick up.
    for (let i = 0; i < 6; i++) {
        const c = new THREE.Mesh(chipGeo, chipMat);
        const a = rr(0, TAU), r = rr(0.85, 2.1);
        c.position.set(CHIPS.x + Math.cos(a) * r, FY + 0.0075, CHIPS.y + Math.sin(a) * r);
        c.rotation.set(rr(-0.1, 0.1), rr(0, TAU), rr(-0.15, 0.15));
        c.scale.setScalar(rr(0.9, 1.2));
        c.castShadow = true;
        scene.add(world.part('chip_0' + i, c));
    }

    /* ==========================================================
       9 · One silver gull, cut once
       ========================================================== */

    const G = {};

    // Trunk: a sphere pulled into the deep-chested teardrop of a gull, with the
    // rump swell and the feathered thighs merged straight in.
    G.body = (() => {
        const s = new THREE.SphereGeometry(1, 24, 16);
        const p = s.attributes.position;
        for (let i = 0; i < p.count; i++) {
            const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
            const aft = Math.max(0, -z), fore = Math.max(0, z);
            const taper = Math.pow(1 - 0.56 * aft, 1.10);
            const rx = 0.0615 * taper;
            const ry = 0.0700 * taper * (y < 0 ? 1.10 : 0.95) * (1 + fore * 0.10);
            const yc = 0.1560 + 0.0180 * Math.pow(aft, 1.7) - 0.0060 * fore;
            p.setXYZ(i, x * rx, y * ry + yc, -0.014 + z * 0.126);
        }
        s.computeVertexNormals();
        const parts = [s];
        parts.push(placed(new THREE.SphereGeometry(0.038, 10, 8), 0, 0.1700, -0.1140).scale(1.05, 0.86, 1.30));
        for (const side of [-1, 1])
            parts.push(placed(new THREE.SphereGeometry(0.031, 10, 8), side * 0.040, 0.1985, 0.040).scale(0.85, 0.72, 1.20));
        for (const side of [-1, 1])
            parts.push(placed(new THREE.SphereGeometry(0.026, 10, 8), side * 0.0290, 0.0980, -0.0110).scale(0.90, 1.45, 1.25));
        parts.push(placed(new THREE.SphereGeometry(0.050, 12, 8), 0, 0.1520, 0.0850).scale(1.02, 1.02, 0.86));
        return mergeGeometries(parts);
    })();

    // The neck, drawn short. It is a concertina in life: seven vertebrae folded
    // into an S that can run out to twice this and does, every time this bird
    // opens its mouth. The rig scales it; the geometry only has to be the
    // resting length.
    const NECK_TOP = 0.082, HEAD_Y0 = 0.0965, HEAD_Z0 = 0.0245;
    G.neck = sweep([
        V3(0, -0.006, -0.004), V3(0, 0.016, 0.002), V3(0, 0.040, 0.008),
        V3(0, 0.064, 0.014), V3(0, NECK_TOP, 0.020),
    ], (t) => lerp(0.0500, 0.0270, Math.pow(t, 0.80)), 14);

    // Skull, with the flat crown and full nape a gull has, plus the throat.
    G.head = (() => {
        const s = new THREE.SphereGeometry(0.0335, 16, 12);
        const p = s.attributes.position;
        for (let i = 0; i < p.count; i++) {
            const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
            const yn = y / 0.0335, zn = z / 0.0335;
            const crown = 1 - 0.10 * smooth(0.2, 1.0, yn);
            const nape = 1 + 0.14 * smooth(0.1, -1.0, zn) * smooth(0.6, -0.4, yn);
            p.setXYZ(i, x * 0.94, y * 0.98 * crown, z * 1.16 * nape - 0.002);
        }
        s.computeVertexNormals();
        return mergeGeometries([
            s,
            placed(new THREE.SphereGeometry(0.026, 12, 8), 0, -0.0160, 0.0110).scale(0.94, 0.86, 1.06),
        ]);
    })();

    // The bill: a straightish upper mandible, and a lower one with the gonydeal
    // angle — the kink near the tip that makes a gull's face a gull's face.
    G.billUpper = (() => {
        const c = new THREE.ConeGeometry(0.0122, 0.0430, 12);
        c.rotateX(Math.PI / 2);
        c.scale(1.0, 0.72, 1.0);
        c.translate(0, 0.0020, 0.0196);
        const p = c.attributes.position;
        for (let i = 0; i < p.count; i++) {
            const z = p.getZ(i);
            const t = clamp((z - 0.014) / 0.028, 0, 1);
            p.setY(i, p.getY(i) - t * t * 0.0068);
            p.setX(i, p.getX(i) * (1 - t * 0.18));
        }
        c.computeVertexNormals();
        return c;
    })();
    G.billLower = (() => {
        const c = new THREE.ConeGeometry(0.0104, 0.0355, 10);
        c.rotateX(Math.PI / 2);
        c.scale(1.0, 0.60, 1.0);
        c.translate(0, -0.0006, 0.0160);
        const p = c.attributes.position;
        for (let i = 0; i < p.count; i++) {
            const z = p.getZ(i);
            const t = clamp((z - 0.010) / 0.024, 0, 1);
            p.setY(i, p.getY(i) - Math.pow(t, 1.6) * 0.0062 + Math.pow(t, 3.0) * 0.0034);
        }
        c.computeVertexNormals();
        return c;
    })();
    // The gape lining: red, and only ever seen when the bird is shouting, which
    // in this world is most of the time.
    G.gapeGeo = (() => {
        const g = new THREE.PlaneGeometry(0.019, 0.033, 1, 1);
        g.rotateX(-Math.PI / 2);
        // Origin at the base of the bill, running forward: the rig scales it out
        // along +z as the mandible drops, which is the pivot the mouth has.
        g.translate(0, 0, 0.0165);
        return g;
    })();

    const EYE = { x: 0.0224, y: 0.0060, z: 0.0128, yaw: 0.30 };
    G.iris = mergeGeometries([-1, 1].map(s =>
        placed(new THREE.SphereGeometry(0.0072, 10, 8), s * EYE.x, EYE.y, EYE.z, 0, s * EYE.yaw, 0)));
    G.pupil = mergeGeometries([-1, 1].map(s =>
        placed(new THREE.SphereGeometry(0.0039, 8, 6),
            s * (EYE.x + Math.sin(s * EYE.yaw) * 0.0034), EYE.y, EYE.z + Math.cos(EYE.yaw) * 0.0034,
            0, s * EYE.yaw, 0).scale(1, 1, 0.7)));
    const ringGeo = mergeGeometries([-1, 1].map(s =>
        placed(new THREE.TorusGeometry(0.0079, 0.0016, 5, 12), s * EYE.x, EYE.y, EYE.z, 0, -s * (Math.PI / 2 - EYE.yaw), 0)));
    // Both lids in one mesh, built around the origin rather than around the eyes:
    // the pair shares a y and a z, so one rotation about X through that point
    // swings both caps down in place.
    G.lid = mergeGeometries([-1, 1].map(s =>
        placed(new THREE.SphereGeometry(0.0082, 10, 5, 0, TAU, 0, Math.PI * 0.5), s * EYE.x, 0, 0)));

    // Only the lower mandible drops when a gull gapes, so the upper one is rigid
    // to the skull — bake its offset in and let it carry the orbital rings.
    G.billFixed = mergeGeometries([
        placed(G.billUpper, 0, -0.0020, 0.0300, -0.06, 0, 0),
        ringGeo,
    ]);

    // The folded wing: a lofted shell running from the shoulder back over the
    // flank, thinning as it goes, uv.v carrying the grey → black gradient.
    function foldedWingGeo(side) {
        const U = 20, TH = 12;
        const pos = [], uvs = [], idx = [];
        for (let i = 0; i <= U; i++) {
            const u = i / U;
            const cy = 0.1960 - 0.0330 * u - 0.0300 * u * u;
            const cz = 0.0660 - 0.2820 * u;
            const cx = side * (0.0520 * (1 - 0.62 * u * u));
            const ry = 0.0620 * Math.pow(Math.sin(Math.PI * (0.15 + 0.80 * u)), 0.66) * (1 - 0.97 * u * u * u);
            const rx = 0.0180 * (1 - 0.96 * u * u);
            for (let j = 0; j <= TH; j++) {
                const a = (j / TH) * TAU;
                pos.push(cx + side * rx * Math.sin(a), cy + ry * Math.cos(a), cz);
                uvs.push(j / TH, u);
            }
        }
        for (let i = 0; i < U; i++)
            for (let j = 0; j < TH; j++) {
                const a = i * (TH + 1) + j, b = a + TH + 1;
                if (side > 0) idx.push(a, b, a + 1, b, b + 1, a + 1);
                else idx.push(a, a + 1, b, b, a + 1, b + 1);
            }
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
        g.setIndex(idx);
        g.computeVertexNormals();
        {   // Weld the seam's normals, or a crease runs the whole wing.
            const n = g.attributes.normal;
            for (let i = 0; i <= U; i++) {
                const a = i * (TH + 1), b = a + TH;
                const nx = (n.getX(a) + n.getX(b)) * 0.5;
                const ny = (n.getY(a) + n.getY(b)) * 0.5;
                const nz = (n.getZ(a) + n.getZ(b)) * 0.5;
                const l = Math.hypot(nx, ny, nz) || 1;
                n.setXYZ(a, nx / l, ny / l, nz / l);
                n.setXYZ(b, nx / l, ny / l, nz / l);
            }
            n.needsUpdate = true;
        }
        return g;
    }
    G.wingL = foldedWingGeo(-1);
    G.wingR = foldedWingGeo(1);

    function primariesGeo(side) {
        const parts = [];
        for (let k = 0; k < 6; k++) {
            const t = k / 5;
            parts.push(placed(
                featherGeo(lerp(0.098, 0.152, t), 0.0180, 0.0058, 0.008),
                side * (0.0325 - t * 0.0075), 0.1560 - t * 0.0060, -0.1120,
                -0.06 - t * 0.05, side * (0.26 - t * 0.24), side * (0.20 - t * 0.09)
            ));
        }
        return mergeGeometries(parts);
    }
    G.primL = primariesGeo(-1);
    G.primR = primariesGeo(1);

    // Twelve tail feathers in a shallow fan, merged — a gull's tail spreads by
    // rotating at the root, not by splaying, so one mesh is honest here.
    G.tail = (() => {
        const parts = [];
        for (let i = 0; i < 12; i++) {
            const t = (i / 11) * 2 - 1;
            parts.push(placed(
                featherGeo(0.148 - Math.abs(t) * 0.020, 0.0210, 0.0140, 0.004),
                t * 0.0050, -Math.abs(t) * 0.0026, 0,
                -0.05 + Math.abs(t) * 0.02, t * 0.22, t * 0.11
            ));
        }
        parts.push(placed(new THREE.SphereGeometry(0.028, 10, 8), 0, 0.0040, 0.0100).scale(1.0, 0.72, 1.5));
        return mergeGeometries(parts);
    })();

    G.tarsus = sweep([
        V3(0, 0.000, 0.000), V3(0, -0.014, -0.0060), V3(0, -0.030, -0.0056),
        V3(0, -0.046, -0.0016), V3(0, -0.0530, 0.0022),
    ], (t) => lerp(0.0098, 0.0056, t), 10);

    G.foot = (() => {
        const parts = [];
        const TOES = [{ yaw: 0.00, len: 0.0360 }, { yaw: 0.52, len: 0.0330 }, { yaw: -0.52, len: 0.0330 }];
        for (const toe of TOES) {
            const pts = [];
            for (let i = 0; i < 5; i++) {
                const t = i / 4;
                pts.push(V3(Math.sin(toe.yaw) * toe.len * t, -t * t * 0.0060, Math.cos(toe.yaw) * toe.len * t));
            }
            parts.push(sweep(pts, (t) => lerp(0.0044, 0.0024, t), 7));
            parts.push(placed(new THREE.ConeGeometry(0.0022, 0.0090, 6),
                pts[4].x, pts[4].y, pts[4].z, Math.PI / 2 + 0.9, toe.yaw, 0));
        }
        parts.push(sweep([V3(0, 0, 0), V3(0, -0.0035, -0.0120), V3(0, -0.0062, -0.0210)],
            (t) => lerp(0.0038, 0.0020, t), 6));
        for (const s of [-1, 1]) {
            const web = new THREE.BufferGeometry();
            const a = V3(0, 0, 0.002);
            const b = V3(0, -0.0060, 0.0360);
            const c = V3(Math.sin(s * 0.52) * 0.0330, -0.0060, Math.cos(0.52) * 0.0330);
            const mid = V3((b.x + c.x) * 0.5 * 0.72, -0.0035, (b.z + c.z) * 0.5 * 0.80);
            const P = [a, b, mid, a, mid, c];
            const arr = [], nrm = [], uv = [];
            for (const v of P) { arr.push(v.x, v.y, v.z); nrm.push(0, 1, 0); uv.push(0.5, 0.5); }
            web.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3));
            web.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
            web.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
            web.setIndex([0, 1, 2, 3, 4, 5]);
            parts.push(web);
        }
        return mergeGeometries(parts);
    })();

    /* --- Two sets of feathers: an adult, and a first-year ------------- */
    function plumage(juv) {
        return {
            body: new THREE.MeshStandardMaterial({
                map: bodyTex, color: srgb(juv ? 0xece7dc : 0xfdfdfb),
                roughness: 0.86, metalness: 0.02, envMapIntensity: 0.5,
            }),
            wing: new THREE.MeshStandardMaterial({
                map: juv ? wingTexJuv : wingTexAdult, roughness: 0.80, metalness: 0.03, envMapIntensity: 0.45,
            }),
            prim: new THREE.MeshStandardMaterial({
                map: juv ? primTexJuv : primTexAdult, side: THREE.DoubleSide,
                roughness: 0.72, envMapIntensity: 0.45,
            }),
            tail: new THREE.MeshStandardMaterial({
                map: juv ? tailTexJuv : tailTexAdult, side: THREE.DoubleSide,
                roughness: 0.80, envMapIntensity: 0.4,
            }),
            bill: new THREE.MeshStandardMaterial({
                color: srgb(juv ? 0x4d3a2c : 0xd0341f), roughness: juv ? 0.62 : 0.34,
                metalness: 0.05, envMapIntensity: 0.9,
            }),
            gape: new THREE.MeshStandardMaterial({
                color: srgb(0x7c1d16), roughness: 0.35, side: THREE.DoubleSide,
            }),
            leg: new THREE.MeshStandardMaterial({
                color: srgb(juv ? 0x6b5442 : 0xd8452a), roughness: 0.52, metalness: 0.04, envMapIntensity: 0.7,
            }),
            iris: new THREE.MeshStandardMaterial({
                color: srgb(juv ? 0x6a5540 : 0xf6f4ea), roughness: 0.22, envMapIntensity: 1.5,
            }),
            pupil: new THREE.MeshStandardMaterial({ color: srgb(0x06070a), roughness: 0.10 }),
        };
    }
    const MATS = { adult: plumage(false), juv: plumage(true) };

    /** One bird, feet at the origin, facing +z. Returns the rig the brain drives. */
    function makeGull(kind, scale) {
        const M = MATS[kind];
        const root = new THREE.Group();

        // Everything above the ground, so the whole bird can crouch, pitch
        // forward into a threat, and bob as it walks.
        const carriage = new THREE.Group();
        root.add(carriage);

        const body = new THREE.Mesh(G.body, M.body);
        body.castShadow = body.receiveShadow = true;
        carriage.add(body);

        const headPivot = new THREE.Group();          // the base of the neck
        headPivot.position.set(0, 0.1830, 0.0560);
        carriage.add(headPivot);

        const neck = new THREE.Mesh(G.neck, M.body);
        neck.castShadow = true;
        headPivot.add(neck);

        const head = new THREE.Group();               // the skull, which turns against the neck
        head.position.set(0, HEAD_Y0, HEAD_Z0);
        headPivot.add(head);

        const skull = new THREE.Mesh(G.head, M.body);
        skull.castShadow = true;
        head.add(skull);

        const billFixed = new THREE.Mesh(G.billFixed, M.bill);
        billFixed.castShadow = true;
        head.add(billFixed);

        const gape = new THREE.Mesh(G.gapeGeo, M.gape);
        gape.position.set(0, -0.0056, 0.0300);
        head.add(gape);

        const bill = new THREE.Group();               // only the lower mandible swings
        bill.position.set(0, -0.0020, 0.0300);
        bill.rotation.x = -0.06;
        head.add(bill);
        const billLower = new THREE.Mesh(G.billLower, M.bill);
        billLower.position.set(0, -0.0052, 0.0010);
        bill.add(billLower);

        head.add(new THREE.Mesh(G.iris, M.iris));
        head.add(new THREE.Mesh(G.pupil, M.pupil));
        const lid = new THREE.Mesh(G.lid, M.body);
        lid.position.set(0, EYE.y, EYE.z);
        head.add(lid);

        const wings = [];
        for (const side of [-1, 1]) {
            const g = new THREE.Group();
            carriage.add(g);
            const shell = new THREE.Mesh(side < 0 ? G.wingL : G.wingR, M.wing);
            shell.castShadow = shell.receiveShadow = true;
            g.add(shell);
            const prim = new THREE.Mesh(side < 0 ? G.primL : G.primR, M.prim);
            prim.castShadow = true;
            g.add(prim);
            wings.push(g);
        }

        const tailPivot = new THREE.Group();
        tailPivot.position.set(0, 0.1660, -0.1160);
        carriage.add(tailPivot);
        const tail = new THREE.Mesh(G.tail, M.tail);
        tail.castShadow = true;
        tailPivot.add(tail);

        // The legs hang off the root, not the carriage. A bird that crouches
        // folds down over its feet; it does not push its feet into the paving.
        const legs = [];
        for (const side of [-1, 1]) {
            const hip = new THREE.Group();
            hip.position.set(side * 0.0270, 0.0585, -0.0060);
            root.add(hip);
            const tarsus = new THREE.Mesh(G.tarsus, M.leg);
            tarsus.castShadow = true;
            hip.add(tarsus);
            const foot = new THREE.Group();
            foot.position.set(0, -0.0530, 0.0022);
            hip.add(foot);
            const footMesh = new THREE.Mesh(G.foot, M.leg);
            footMesh.castShadow = true;
            foot.add(footMesh);
            legs.push({ hip, foot, side });
        }

        root.scale.setScalar(scale);
        return { root, carriage, body, headPivot, neck, head, bill, billLower, gape, lid, wings, tailPivot, legs, scale };
    }

    /* ==========================================================
       10 · Who is on the floor
       ========================================================== */

    const GULLS = [];

    /**
     * A bird, where it lives on the deck, and the small set of numbers the
     * argument writes into: where it wants to be, how it is standing, what its
     * head is doing. Everything eases, so nothing snaps.
     */
    function addGull(name, kind, scale, hx, hz, hy, heading, role) {
        const rig = makeGull(kind, scale);
        const part = new THREE.Group();
        part.position.set(hx, hy, hz);
        const motion = new THREE.Group();          // the sim moves this, not the part
        motion.add(rig.root);
        part.add(motion);
        scene.add(world.ghost(world.part(name, part)));

        const g = {
            name, rig, part, motion, role, kind,
            home: V2(hx, hz),
            pos: V2(hx, hz),
            goal: V2(hx, hz),
            // Its own patch of the spill, so three birds do not all stab at the
            // same square inch of concrete.
            food: V2(lerp(hx, CHIPS.x, 0.62) + rr(-0.16, 0.16), lerp(hz, CHIPS.y, 0.62) + rr(-0.16, 0.16)),
            heading, speed: 0, stepPhase: rnd() * TAU, gait: 0,
            neck: 0.32, neckT: 0.32,          // the neck's angle forward, 0 = straight up
            stretch: 0.06, stretchT: 0.06,    // how far the concertina is run out
            pitch: 0.10, pitchT: 0.10,        // the skull, against the neck
            yaw: 0, yawT: 0,
            crouch: 0, crouchT: 0,
            lean: 0, leanT: 0,
            wing: 0, wingT: 0,
            flap: 0, flapT: 0,
            tailUp: 0, tailUpT: 0,
            gape: 0, gapeT: 0,
            blink: 0, blinkTimer: rr(1.0, 5.0),
            timer: rr(0.2, 1.6), mode: 'idle',
            peck: 0, peckRate: rr(2.9, 3.5),
            ruffle: 0, wobble: rnd() * TAU,
            callPhase: rnd() * TAU,
        };
        GULLS.push(g);
        return g;
    }

    // Where the argument happens: a circle on the floorboards, wide enough to
    // clear the feeding birds and small enough to stay inside the balustrade.
    const CC = V2(-0.15, -0.05);
    const RUN_R = 1.62;

    // The one doing the yelling. Big adult, red legs, no patience.
    const YELL = addGull('gull_00', 'adult', 1.17, CC.x + 0.10, CC.y + 1.55, FY, -2.6, 'yeller');
    // The one it is yelling at: this year's bird, still brown across the wing.
    const RUN = addGull('gull_01', 'juv', 1.01, CC.x + 1.45, CC.y - 0.62, FY, 1.0, 'runner');
    // And three with their heads down, who could not care less.
    const FEEDERS = [
        // All three inside the chase circle, and close enough to the parcel that
        // the runner goes round them rather than through them.
        addGull('gull_02', 'adult', 1.11, -1.00, -0.42, FY, 2.30, 'feeder'),
        addGull('gull_03', 'adult', 1.07, -0.38, -0.98, FY, -0.30, 'feeder'),
        addGull('gull_04', 'juv', 1.00, -0.92, -0.92, FY, 1.05, 'feeder'),
    ];
    // One up on the balustrade, out of it, watching it happen.
    const WATCH = (() => {
        const a = BAY(7);
        return addGull('gull_05', 'adult', 1.08,
            Math.cos(a) * R_MID, Math.sin(a) * R_MID, RAIL_Y + 0.005, -Math.PI / 4 + 0.45, 'watcher');
    })();

    // One of the feeders has actually got a chip, which is the entire cause of this.
    {
        const held = new THREE.Mesh(chipGeo, chipMat);
        held.position.set(0.006, -0.0075, 0.030);
        held.rotation.set(0, 1.35, 0.12);
        held.scale.setScalar(1.15);
        held.castShadow = true;
        FEEDERS[0].rig.bill.add(held);
    }

    // The runner starts on the circle, and stays on it.
    let runAngle = Math.atan2(RUN.pos.y - CC.y, RUN.pos.x - CC.x);
    let runDir = 1;              // which way round it is going, until it changes its mind

    /* ==========================================================
       11 · Gulls in the air, drawn to the smell of it
       ========================================================== */

    const FLYERS = [];
    {
        function spreadWingGeo(side) {
            const parts = [];
            // Ten primaries fanned off the hand, then the arm's coverts as a slab.
            for (let k = 0; k < 10; k++) {
                const t = k / 9;
                const len = lerp(0.30, 0.15, Math.pow(t, 0.8));
                const spread = lerp(-0.35, 0.95, t);
                parts.push(placed(
                    featherGeo(len, 0.030, 0.012, 0.012),
                    side * lerp(0.34, 0.18, t), 0, lerp(-0.02, 0.04, t),
                    0, side * (Math.PI / 2 + spread - 1.35), side * 0.05
                ));
            }
            parts.push(placed(new THREE.BoxGeometry(0.34, 0.014, 0.115), side * 0.18, 0, 0.005)
                .translate(0, 0, 0));
            return mergeGeometries(parts.map(indexed));
        }
        const wingGeoL = spreadWingGeo(-1), wingGeoR = spreadWingGeo(1);
        const flyBody = (() => {
            const s = new THREE.SphereGeometry(1, 18, 12);
            const p = s.attributes.position;
            for (let i = 0; i < p.count; i++) {
                const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
                const taper = 1 - 0.42 * Math.abs(z);
                p.setXYZ(i, x * 0.058 * taper, y * 0.060 * taper, z * 0.20);
            }
            s.computeVertexNormals();
            return mergeGeometries([
                s,
                placed(new THREE.SphereGeometry(0.036, 12, 8), 0, 0.018, 0.185).scale(0.9, 0.9, 1.0),
                // Just the silhouette of a bill up here; nobody is close enough
                // to want the gonydeal angle on a bird fifteen metres up.
                placed(new THREE.ConeGeometry(0.011, 0.048, 8), 0, 0.012, 0.228, Math.PI / 2, 0, 0),
            ].map(indexed));
        })();
        const flyTail = placed(G.tail, 0, 0, -0.20, 0.04, 0, 0);

        for (let i = 0; i < 3; i++) {
            const grp = new THREE.Group();
            const M = MATS.adult;
            grp.add(new THREE.Mesh(flyBody, M.body));
            grp.add(new THREE.Mesh(flyTail, M.tail));
            const wings = [];
            for (const side of [-1, 1]) {
                const w = new THREE.Mesh(side < 0 ? wingGeoL : wingGeoR, M.prim);
                w.position.set(side * 0.045, 0.030, 0.010);
                grp.add(w);
                wings.push({ mesh: w, side });
            }
            grp.scale.setScalar(rr(1.0, 1.25));
            scene.add(world.ghost(grp));
            FLYERS.push({
                grp, wings,
                a: rr(0, TAU), r: rr(9, 26), cx: rr(-4, 4), cz: rr(-4, 4),
                y: rr(7.5, 15.5), spd: (rnd() < 0.5 ? -1 : 1) * rr(0.10, 0.26),
                flapPhase: rr(0, TAU), flapRate: rr(6.5, 8.6), glide: rnd(),
            });
        }
    }

    /* ==========================================================
       12 · Grit off the floor, and a feather that came loose
       ========================================================== */

    const DUST = [];
    {
        const mat = new THREE.SpriteMaterial({
            map: puffTex, transparent: true, depthWrite: false,
            color: srgb(0xd8ccb4), opacity: 0,
        });
        for (let i = 0; i < 22; i++) {
            const sp = new THREE.Sprite(mat.clone());
            sp.scale.setScalar(0.05);
            sp.visible = true;
            scene.add(world.ghost(sp));
            DUST.push({ sp, life: 9, ttl: 1, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, size: 0.05 });
        }
    }
    let dustNext = 0;
    function puffAt(x, z, strength) {
        const d = DUST[dustNext = (dustNext + 1) % DUST.length];
        d.life = 0; d.ttl = rr(0.5, 1.0);
        d.x = x + rr(-0.03, 0.03); d.y = FY + 0.012; d.z = z + rr(-0.03, 0.03);
        const a = rr(0, TAU);
        d.vx = Math.cos(a) * rr(0.05, 0.24) * strength;
        d.vz = Math.sin(a) * rr(0.05, 0.24) * strength;
        d.vy = rr(0.05, 0.20) * strength;
        d.size = rr(0.035, 0.075);
        d.sp.material.opacity = 0.4;
    }

    const LOOSE = [];
    {
        const mat = new THREE.MeshStandardMaterial({
            map: wingTexJuv, side: THREE.DoubleSide, roughness: 0.85, transparent: false,
        });
        for (let i = 0; i < 3; i++) {
            const m = new THREE.Mesh(featherGeo(0.075, 0.014, 0.006, 0.004), mat);
            m.visible = false;
            scene.add(world.ghost(m));
            LOOSE.push({ mesh: m, life: 99, x: 0, y: 0, z: 0, vy: 0, phase: 0, spin: rr(-1, 1) });
        }
    }
    let looseNext = 0;
    function shedFeather(x, y, z) {
        const f = LOOSE[looseNext = (looseNext + 1) % LOOSE.length];
        f.life = 0; f.x = x; f.y = y; f.z = z; f.vy = 0.05; f.phase = rr(0, TAU);
        f.mesh.visible = true;
    }

    /* ==========================================================
       13 · The argument
       ========================================================== */

    const DECK_R = 3.02;                 // how far out a bird will go before it turns

    /** Turn `g` toward a heading, no faster than a gull's neck lets it. */
    function steer(g, want, dt, rate) {
        let d = want - g.heading;
        while (d > Math.PI) d -= TAU;
        while (d < -Math.PI) d += TAU;
        g.heading += clamp(d, -rate * dt, rate * dt);
        return Math.abs(d);
    }

    function relax(g) {
        g.neckT = 0.30; g.stretchT = 0.08; g.pitchT = 0.10; g.yawT = 0;
        g.crouchT = 0; g.leanT = 0.02; g.wingT = 0; g.flapT = 0;
        g.tailUpT = 0; g.gapeT = 0;
    }

    /**
     * The long call, which is the whole reason this world exists.
     *
     * The neck runs straight up out of the shoulders — vertical, a hand taller
     * than the bird looked a second ago — and then the skull folds forward over
     * the top of it so the bill points down and out, and stays there while the
     * bird shouts. `drive` is how hard: at 1 it is the full display, at 0.4 it
     * is the same posture carried at a run.
     */
    function longCall(g, drive, dt) {
        g.callPhase += dt * lerp(3.4, 5.4, drive);
        const note = Math.pow(Math.max(0, Math.sin(g.callPhase)), 0.7);
        g.neckT = -0.10 - 0.04 * drive;              // straight up, and a shade past it
        g.stretchT = lerp(0.55, 1.02, drive);
        g.pitchT = lerp(0.92, 1.16, drive) + 0.44 * note * drive;
        g.gapeT = note * lerp(0.55, 1.0, drive);
        g.tailUpT = 0.20 + 0.22 * drive;
        g.wingT = 0.06 + 0.16 * note * drive;
        return note;
    }

    const drama = { mode: 'chase', timer: 3.2, jink: rr(4, 7), calls: 0 };
    const _v = V2(0, 0);

    function dramaStep(dt) {
        drama.timer -= dt;
        drama.jink -= dt;

        /* --- the one being chased -------------------------------------- */
        const gap = Math.hypot(YELL.pos.x - RUN.pos.x, YELL.pos.y - RUN.pos.y);
        // It runs harder the closer the shouting gets, and freewheels when the
        // adult stops to make its speech.
        const urgency = smooth(2.4, 0.5, gap);
        const runSpeed = drama.mode === 'plant'
            ? lerp(1.05, 2.15, urgency)
            : lerp(1.35, 2.85, urgency);

        if (drama.jink <= 0) {
            // Every so often it reverses, which is the only move it has, and
            // which works: the adult goes three metres the wrong way.
            runDir = -runDir;
            drama.jink = rr(5.5, 10.0);
            RUN.ruffle = 1;
            shedFeather(RUN.pos.x, FY + 0.20, RUN.pos.y);
        }
        runAngle += runDir * (runSpeed / RUN_R) * dt;
        // The circle breathes: pushed wide when the adult is on its tail,
        // pulled in toward the chips when it is not.
        const rad = RUN_R + Math.sin(runAngle * 2.0 + 1.1) * 0.16 + urgency * 0.26;
        RUN.pos.set(CC.x + Math.cos(runAngle) * rad, CC.y + Math.sin(runAngle) * rad);
        const vx = -Math.sin(runAngle) * runDir, vz = Math.cos(runAngle) * runDir;
        RUN.speed = runSpeed;
        steer(RUN, Math.atan2(vx, vz), dt, 9.0);

        // Head down, wings half up, tail cocked, and looking back over its own
        // shoulder at the thing that is shouting at it.
        const lookBack = smooth(2.6, 1.1, gap);
        RUN.neckT = 0.62 - urgency * 0.16;
        RUN.stretchT = 0.30 + urgency * 0.30;
        RUN.pitchT = -0.34 - urgency * 0.24;
        RUN.yawT = -lookBack * 1.15 * runDir;
        RUN.leanT = 0.20 + urgency * 0.22;
        RUN.crouchT = 0.10 + urgency * 0.18;
        RUN.wingT = 0.24 + urgency * 0.62;
        RUN.flapT = urgency > 0.72 ? 0.55 : 0;
        RUN.tailUpT = 0.34 + urgency * 0.36;
        // It is not silent about this either, but it is a squeak next to the adult.
        RUN.callPhase += dt * 6.4;
        RUN.gapeT = urgency > 0.45 ? Math.pow(Math.max(0, Math.sin(RUN.callPhase)), 1.2) * 0.55 : 0;

        /* --- the one doing the chasing ---------------------------------- */
        if (drama.mode === 'chase') {
            // Aim where the runner is going to be, not where it is.
            const lead = clamp(gap * 0.30, 0.10, 0.55);
            const ax = RUN.pos.x + vx * lead, az = RUN.pos.y + vz * lead;
            const dx = ax - YELL.pos.x, dz = az - YELL.pos.y;
            const off = steer(YELL, Math.atan2(dx, dz), dt, 5.2);
            // It cannot run flat out through a turn, which is exactly why it
            // never catches anything.
            YELL.speed = lerp(2.55, 1.15, smooth(0.15, 1.5, off));
            YELL.pos.x += Math.sin(YELL.heading) * YELL.speed * dt;
            YELL.pos.y += Math.cos(YELL.heading) * YELL.speed * dt;

            longCall(YELL, 0.62 + 0.22 * smooth(1.8, 0.5, gap), dt);
            YELL.leanT = 0.10;
            YELL.crouchT = 0.04;
            YELL.flapT = gap < 0.9 ? 0.35 : 0;

            if (gap < 0.44 || drama.timer <= 0) {
                drama.mode = 'plant';
                drama.timer = rr(1.5, 2.6);
                YELL.callPhase = 0;
            }
        } else {
            // Planted: both feet down, neck run all the way out, and the full
            // display given to the back of a departing juvenile.
            YELL.speed = Math.max(0, YELL.speed - dt * 6.5);
            YELL.pos.x += Math.sin(YELL.heading) * YELL.speed * dt;
            YELL.pos.y += Math.cos(YELL.heading) * YELL.speed * dt;
            steer(YELL, Math.atan2(RUN.pos.x - YELL.pos.x, RUN.pos.y - YELL.pos.y), dt, 2.6);

            const note = longCall(YELL, 1.0, dt);
            YELL.leanT = 0.02 + note * 0.06;
            YELL.crouchT = -0.10;
            YELL.flapT = 0;
            if (note > 0.9 && rnd() < dt * 6) puffAt(YELL.pos.x, YELL.pos.y, 0.3);

            if (drama.timer <= 0) {
                drama.mode = 'chase';
                drama.timer = rr(5.5, 9.5);
            }
        }

        // Neither of them leaves the deck, whatever they think they are doing.
        for (const g of [YELL, RUN]) {
            const r = Math.hypot(g.pos.x, g.pos.y);
            if (r > DECK_R) { g.pos.x *= DECK_R / r; g.pos.y *= DECK_R / r; }
        }
    }

    /* --- The three who are ignoring all of it ------------------------ */
    function feederBrain(g, dt) {
        g.timer -= dt;
        const chase = Math.min(
            Math.hypot(g.pos.x - RUN.pos.x, g.pos.y - RUN.pos.y),
            Math.hypot(g.pos.x - YELL.pos.x, g.pos.y - YELL.pos.y));

        if (g.mode !== 'flinch' && chase < 0.62) {
            g.mode = 'flinch';
            g.timer = rr(0.5, 0.9);
            g.ruffle = 1;
            // A step directly away from whichever of the two is closer — the
            // chase runs outside these three, so stepping away from the circle's
            // centre would put them straight under it.
            const near = Math.hypot(g.pos.x - RUN.pos.x, g.pos.y - RUN.pos.y) <=
                Math.hypot(g.pos.x - YELL.pos.x, g.pos.y - YELL.pos.y) ? RUN : YELL;
            _v.set(g.pos.x - near.pos.x, g.pos.y - near.pos.y);
            if (_v.lengthSq() < 1e-6) _v.set(1, 0);
            _v.normalize();
            // One step, and never one that takes it out of reach of the parcel.
            const gx = g.pos.x + _v.x * 0.34, gz = g.pos.y + _v.y * 0.34;
            const ox = gx - CHIPS.x, oz = gz - CHIPS.y, od = Math.hypot(ox, oz), CAP = 0.95;
            g.goal.set(
                od > CAP ? CHIPS.x + ox / od * CAP : gx,
                od > CAP ? CHIPS.y + oz / od * CAP : gz);
        }

        switch (g.mode) {
            case 'flinch':
                g.neckT = 0.16; g.stretchT = 0.52; g.pitchT = -0.16;
                g.yawT = 0; g.leanT = 0.05; g.crouchT = 0.10;
                g.wingT = 0.30; g.flapT = 0; g.tailUpT = 0.20; g.gapeT = 0.18;
                if (g.timer <= 0) { g.mode = 'peck'; g.timer = rr(0.4, 1.1); }
                break;

            case 'look':
                relax(g);
                g.neckT = 0.20; g.stretchT = 0.46;
                g.pitchT = -0.06;
                g.yawT = Math.sin(g.wobble + g.timer * 2.6) * 0.7;
                if (g.timer <= 0) { g.mode = 'peck'; g.timer = rr(1.4, 3.4); }
                break;

            default: {   // head down in it
                g.goal.copy(g.food);
                // The peck itself: a fast stab down, a slower lift, and a
                // sideways shake at the top to get the chip round the right way.
                g.peck += dt * g.peckRate;
                const s = (g.peck % 1);
                const down = s < 0.34 ? Math.pow(s / 0.34, 0.55) : Math.pow(1 - (s - 0.34) / 0.66, 1.7);
                g.neckT = lerp(0.98, 1.52, down);
                g.stretchT = lerp(0.30, 0.05, down);
                g.pitchT = lerp(0.16, 0.62, down);
                g.yawT = Math.sin(g.peck * 5.1 + g.wobble) * 0.22 * (1 - down);
                g.leanT = 0.14 + down * 0.10;
                g.crouchT = 0.14 + down * 0.12;
                g.wingT = 0; g.flapT = 0; g.tailUpT = 0.10; g.gapeT = down > 0.8 ? 0.25 : 0;
                if (g.timer <= 0) { g.mode = 'look'; g.timer = rr(0.7, 1.6); }
                break;
            }
        }

        // Drift toward whatever it is aiming at, at a shuffle.
        const dx = g.goal.x - g.pos.x, dz = g.goal.y - g.pos.y;
        const d = Math.hypot(dx, dz);
        if (d > 0.03) {
            const sp = Math.min(g.mode === 'flinch' ? 1.05 : 0.30, d * 2.6);
            steer(g, Math.atan2(dx, dz), dt, 3.4);
            g.pos.x += Math.sin(g.heading) * sp * dt;
            g.pos.y += Math.cos(g.heading) * sp * dt;
            g.speed = sp;
        } else {
            g.speed = Math.max(0, g.speed - dt * 4);
        }
    }

    /* --- The one on the rail ------------------------------------------ */
    function watcherBrain(g, dt) {
        g.timer -= dt;
        if (g.timer <= 0) {
            const r = rnd();
            g.mode = r < 0.40 ? 'watch' : r < 0.72 ? 'preen' : r < 0.90 ? 'shuffle' : 'shout';
            g.timer = g.mode === 'preen' ? rr(2.0, 4.5) : g.mode === 'shout' ? rr(1.2, 2.0) : rr(1.6, 3.6);
            g.wobble = rnd() * TAU;
        }
        g.speed = 0;
        switch (g.mode) {
            case 'preen':
                g.neckT = 1.18 + Math.sin(g.timer * 5.2) * 0.22;
                g.stretchT = 0.34;
                g.pitchT = 0.55 + Math.sin(g.timer * 7.4) * 0.28;
                g.yawT = (g.wobble > Math.PI ? 1 : -1) * (0.9 + Math.sin(g.timer * 3.1) * 0.35);
                g.crouchT = 0.10; g.leanT = 0.08; g.wingT = 0.04; g.tailUpT = 0.06; g.gapeT = 0;
                break;
            case 'shuffle':
                relax(g);
                g.stretchT = 0.34;
                g.crouchT = 0.16 + Math.sin(g.timer * 8) * 0.10;
                g.wingT = 0.14; g.ruffle = Math.max(g.ruffle, 0.7);
                break;
            case 'shout':
                // It has an opinion about the argument, from a safe distance.
                longCall(g, 0.80, dt);
                g.leanT = 0.04; g.crouchT = -0.04;
                break;
            default:
                relax(g);
                g.stretchT = 0.42;
                // Tracking the chase around the floor below it.
                g.yawT = clamp(Math.atan2(RUN.pos.x - g.part.position.x, RUN.pos.y - g.part.position.z) - g.heading, -1.2, 1.2);
                g.pitchT = 0.34;
                break;
        }
    }

    /** Nobody stands inside anybody else. */
    function separate() {
        for (let i = 0; i < FEEDERS.length; i++) {
            const a = FEEDERS[i];
            for (const b of GULLS) {
                if (b === a || b.role === 'watcher') continue;
                const dx = a.pos.x - b.pos.x, dz = a.pos.y - b.pos.y;
                const d2 = dx * dx + dz * dz;
                const R = 0.30;
                if (d2 > 1e-8 && d2 < R * R) {
                    const d = Math.sqrt(d2), push = (R - d) * (b.role === 'feeder' ? 0.5 : 1.0);
                    a.pos.x += (dx / d) * push;
                    a.pos.y += (dz / d) * push;
                }
            }
        }
    }

    /* ==========================================================
       14 · What moves
       ========================================================== */

    const _camScratch = new THREE.Vector3();

    /** Push posture toward its target and write it into the rig. */
    function poseGull(g, dt, t) {
        const ease = (cur, tgt, rate) => cur + (tgt - cur) * Math.min(1, dt * rate);

        g.neck = ease(g.neck, g.neckT, 9);
        g.stretch = ease(g.stretch, g.stretchT, 8);
        g.pitch = ease(g.pitch, g.pitchT, 10);
        g.yaw = ease(g.yaw, g.yawT, 6);
        g.crouch = ease(g.crouch, g.crouchT, 8);
        g.lean = ease(g.lean, g.leanT, 8);
        g.wing = ease(g.wing, g.wingT, 11);
        g.flap = ease(g.flap, g.flapT, 8);
        g.tailUp = ease(g.tailUp, g.tailUpT, 8);
        g.gape = ease(g.gape, g.gapeT, 24);

        const rig = g.rig;
        const s = rig.scale;

        // Gait: the step cycle is driven by ground covered, so nothing skates.
        const stride = 0.17 * s;
        g.stepPhase += (g.speed * dt / stride) * TAU + dt * 0.35;
        const gaitAmp = smooth(0.02, 0.80, g.speed);
        g.gait = gaitAmp;

        const sw = Math.sin(g.stepPhase);
        for (const leg of rig.legs) {
            const ph = leg.side < 0 ? g.stepPhase : g.stepPhase + Math.PI;
            const swing = Math.sin(ph);
            const lift = Math.max(0, swing) * 0.024 * gaitAmp;
            leg.hip.rotation.x = swing * 0.66 * gaitAmp - g.lean * 0.30 - g.crouch * 0.18;
            leg.hip.rotation.z = leg.side * (0.04 + g.crouch * 0.10);
            leg.foot.position.y = -0.0530 + lift;
            leg.foot.rotation.x = -leg.hip.rotation.x - 0.06 + Math.max(0, -swing) * 0.22 * gaitAmp;
        }

        // Carriage: crouch, forward pitch, the roll of a walking bird, and a bob.
        // It pivots down at the feet, so leaning into a threat tips the whole
        // bird forward over its legs, which is what the bird actually does.
        const bob = Math.cos(g.stepPhase * 2) * 0.010 * gaitAmp;
        rig.carriage.position.y = -g.crouch * 0.045 + bob;
        rig.carriage.position.z = g.lean * 0.012;
        rig.carriage.rotation.x = g.lean;
        rig.carriage.rotation.z = -sw * 0.055 * gaitAmp;

        // The neck: an angle, and a length. Running it out thins it, the way a
        // concertina of feathers does when the vertebrae underneath unfold.
        const thin = 1 / (1 + 0.42 * g.stretch);
        rig.neck.scale.set(thin, 1 + g.stretch, thin);
        rig.head.position.y = HEAD_Y0 + NECK_TOP * g.stretch;
        rig.head.position.z = HEAD_Z0 + 0.011 * g.stretch;

        // The skull turns back against the neck. That counter-rotation is the
        // whole trick: a head carried at the top of a vertical neck can still be
        // pointing at the floor, and a head carried low can still be looking up.
        const headBob = Math.sin(g.stepPhase + 1.0) * 0.070 * gaitAmp;
        rig.headPivot.rotation.x = g.neck + headBob;
        rig.headPivot.rotation.y = g.yaw * 0.35;
        rig.headPivot.rotation.z = Math.sin(t * 0.7 + g.wobble) * 0.02;
        rig.head.rotation.x = g.pitch - headBob * 0.6;
        rig.head.rotation.y = g.yaw * 0.65 + Math.sin(t * 1.1 + g.wobble) * 0.03;
        rig.head.rotation.z = g.yaw * 0.10;

        rig.billLower.rotation.x = g.gape * 0.46;
        rig.billLower.position.z = 0.0010 - g.gape * 0.0032;
        rig.gape.visible = g.gape > 0.05;
        if (rig.gape.visible) {
            rig.gape.rotation.x = g.gape * 0.30;
            rig.gape.scale.set(1, 1, 0.25 + g.gape * 0.85);
        }

        // Blink.
        g.blinkTimer -= dt;
        if (g.blinkTimer <= 0) { g.blink = 1; g.blinkTimer = rr(1.4, 6.5); }
        if (g.blink > 0) g.blink = Math.max(0, g.blink - dt * 7.5);
        // Parked, the lid hoods the top of the eye; shut, it swings forward over it.
        rig.lid.rotation.x = -0.35 + Math.sin(g.blink * Math.PI) * 1.88;

        // Wings: out from the body, and beating when the bird is running for it.
        const beat = Math.sin(t * 13.5 + g.wobble) * g.flap;
        for (let i = 0; i < 2; i++) {
            const side = i === 0 ? -1 : 1;
            const w = rig.wings[i];
            w.rotation.z = side * (g.wing * 0.95 + beat * 0.55 + g.ruffle * 0.12);
            w.rotation.x = -g.wing * 0.30 - Math.max(0, beat) * 0.22;
            w.rotation.y = side * (g.wing * 0.18);
        }
        if (g.ruffle > 0) g.ruffle = Math.max(0, g.ruffle - dt * 2.4);

        rig.tailPivot.rotation.x = -g.tailUp * 0.62 + g.lean * 0.35;
        rig.tailPivot.rotation.y = Math.sin(t * 0.9 + g.wobble) * 0.02;

        g.motion.position.set(g.pos.x - g.home.x, 0, g.pos.y - g.home.y);
        g.motion.rotation.y = g.heading;

        // A running bird kicks the grit off the concrete.
        if (g.speed > 1.3 && rnd() < dt * 16) puffAt(g.pos.x, g.pos.y, 0.6);
    }

    world.frame((dt, t) => {
        uTime.value = t;
        camera.getWorldPosition(_camScratch);
        uCamPos.value.copy(_camScratch);

        for (let i = 0; i < clouds.length; i++) {
            const sp = clouds[i];
            sp.position.x += sp.userData.drift * dt;
            if (sp.position.x > 2000) sp.position.x = -2000;
        }

        dramaStep(dt);
        for (const f of FEEDERS) feederBrain(f, dt);
        watcherBrain(WATCH, dt);
        separate();
        for (const g of GULLS) poseGull(g, dt, t);

        // Gulls overhead, circling the smell of it.
        for (const f of FLYERS) {
            f.a += f.spd * dt;
            const x = f.cx + Math.cos(f.a) * f.r;
            const z = f.cz + Math.sin(f.a) * f.r * 0.85;
            f.grp.position.set(x, f.y + Math.sin(f.a * 2.3) * 0.7, z);
            f.grp.rotation.y = Math.atan2(
                -Math.sin(f.a) * f.r * f.spd, Math.cos(f.a) * f.r * 0.85 * f.spd);
            f.grp.rotation.z = clamp(f.spd * 5.5, -0.6, 0.6);
            f.flapPhase += dt * f.flapRate;
            // Gulls glide more than they flap; the beat comes in bursts.
            const gate = smooth(0.55, 0.85, (Math.sin(f.flapPhase * 0.19 + f.glide * 6) + 1) * 0.5);
            const beat = Math.sin(f.flapPhase) * gate;
            for (const w of f.wings) {
                w.mesh.rotation.z = w.side * (beat * 0.62 - 0.10);
                w.mesh.rotation.x = -Math.max(0, beat) * 0.28 + 0.05;
            }
        }

        // Kicked-up grit.
        for (const d of DUST) {
            if (d.life >= d.ttl) { if (d.sp.material.opacity !== 0) d.sp.material.opacity = 0; continue; }
            d.life += dt;
            const u = d.life / d.ttl;
            d.x += d.vx * dt; d.y += d.vy * dt; d.z += d.vz * dt;
            d.vy -= 0.55 * dt;
            d.sp.position.set(d.x, Math.max(FY + 0.008, d.y), d.z);
            const sz = d.size * (0.5 + u * 1.9);
            d.sp.scale.set(sz, sz, 1);
            d.sp.material.opacity = 0.40 * (1 - u) * (1 - u);
        }

        // A feather or two, taking its time about landing.
        for (const f of LOOSE) {
            if (f.life > 7) { if (f.mesh.visible) f.mesh.visible = false; continue; }
            f.life += dt;
            f.phase += dt * 2.2;
            f.vy = Math.max(-0.10, f.vy - 0.16 * dt);
            f.y += f.vy * dt;
            if (f.y < FY + 0.006) { f.y = FY + 0.006; f.vy = 0; }
            f.x += Math.sin(f.phase) * 0.16 * dt;
            f.z += Math.cos(f.phase * 0.8) * 0.14 * dt;
            f.mesh.position.set(f.x, f.y, f.z);
            f.mesh.rotation.set(
                f.y > FY + 0.010 ? Math.sin(f.phase) * 0.7 : -Math.PI / 2 + 0.06,
                f.phase * f.spin * 0.5,
                Math.cos(f.phase * 1.3) * 0.6
            );
        }
    });
}








