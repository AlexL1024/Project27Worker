//
//  teacher.prop.js
//  Project27 object library
//
//  An adult standing at 1.72 m: buttoned cardigan over a shirt, wool trousers,
//  a stack of exercise books held against one hip, a marker in the other hand,
//  a lanyard, and glasses.
//
//  Built on the same two shapes as `student.prop.js` — a lofted stack of
//  superelliptical rings for the masses, a swept tube for the limbs — with a
//  grown-up's proportions rather than a teenager's: seven heads, squarer
//  shoulders, and the weight settled rather than slouched. The props are
//  deliberately separate files with the geometry helpers copied into each,
//  because a prop has to build with nothing beside it but three.js, and a
//  shared helper module is one more file the app has to know to fetch.
//
//  What makes this read as a teacher rather than as a tall student is entirely
//  the load: something in both hands, a lanyard, and a stance that is holding
//  still while talking rather than waiting to be somewhere else.
//
//  Origin between the feet on the floor, facing +Z.
//

import { mergeGeometries } from './BufferGeometryUtils.js';

export default function build(THREE, helpers) {
    const group = new THREE.Group();

    let seed = 30241;
    const rnd = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
    const rr = (a, b) => a + (b - a) * rnd();

    const paint = (w, h, draw) => (helpers && helpers.canvasTexture ? helpers.canvasTexture(w, h, draw) : null);
    const V = (x, y, z) => new THREE.Vector3(x, y, z);
    const merge = (parts) => mergeGeometries(parts.map((g) => (g.index ? g.toNonIndexed() : g)));

    /* ==========================================================
       0 · The two shapes a body is made of
       ========================================================== */

    /** A stack of superelliptical rings up the y axis: every mass here is one. */
    function loft(sections, sides = 20, capBottom = true, capTop = true) {
        const pos = [], nor = [], uvs = [], idx = [];
        const rings = sections.length;
        for (let i = 0; i < rings; i++) {
            const s = sections[i];
            const p = s.p === undefined ? 1 : s.p;
            for (let j = 0; j <= sides; j++) {
                const a = (j / sides) * Math.PI * 2;
                const ca = Math.cos(a), sa = Math.sin(a);
                pos.push(
                    (s.cx || 0) + s.hx * Math.sign(ca) * Math.pow(Math.abs(ca), p),
                    s.y,
                    (s.cz || 0) + s.hz * Math.sign(sa) * Math.pow(Math.abs(sa), p));
                nor.push(0, 0, 0);
                uvs.push(j / sides, i / (rings - 1));
            }
        }
        for (let i = 0; i < rings - 1; i++) {
            for (let j = 0; j < sides; j++) {
                const a = i * (sides + 1) + j, b = a + sides + 1;
                idx.push(a, b, a + 1, a + 1, b, b + 1);
            }
        }
        const cap = (ring, up) => {
            const s = sections[ring];
            const centre = pos.length / 3;
            pos.push(s.cx || 0, s.y, s.cz || 0);
            nor.push(0, 0, 0);
            uvs.push(0.5, up ? 1 : 0);
            const base = ring * (sides + 1);
            for (let j = 0; j < sides; j++) {
                if (up) idx.push(centre, base + j, base + j + 1);
                else idx.push(centre, base + j + 1, base + j);
            }
        };
        if (capBottom) cap(0, false);
        if (capTop) cap(rings - 1, true);
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
        g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
        g.setIndex(idx);
        g.computeVertexNormals();
        return g;
    }

    /** A limb: a tube swept along a bent path, on a parallel-transported frame. */
    function sweep(points, radiusAt, sides = 12) {
        const pos = [], nor = [], uvs = [], idx = [];
        const N = points.length;
        const tangents = [];
        for (let i = 0; i < N; i++) {
            const a = points[Math.max(0, i - 1)], b = points[Math.min(N - 1, i + 1)];
            const t = new THREE.Vector3().subVectors(b, a);
            if (t.lengthSq() < 1e-12) t.set(0, 1, 0);
            tangents.push(t.normalize());
        }
        const ref = Math.abs(tangents[0].y) > 0.9 ? V(1, 0, 0) : V(0, 1, 0);
        let nrm = new THREE.Vector3().crossVectors(tangents[0], ref).normalize();
        for (let i = 0; i < N; i++) {
            nrm = nrm.clone().addScaledVector(tangents[i], -nrm.dot(tangents[i]));
            if (nrm.lengthSq() < 1e-10) nrm = new THREE.Vector3().crossVectors(tangents[i], ref);
            nrm.normalize();
            const bin = new THREE.Vector3().crossVectors(tangents[i], nrm).normalize();
            const t = N > 1 ? i / (N - 1) : 0;
            const r = radiusAt(t, i);
            for (let j = 0; j <= sides; j++) {
                const a = (j / sides) * Math.PI * 2;
                const dir = nrm.clone().multiplyScalar(Math.cos(a) * r).addScaledVector(bin, Math.sin(a) * r);
                const p = points[i].clone().add(dir);
                pos.push(p.x, p.y, p.z);
                nor.push(dir.x / r, dir.y / r, dir.z / r);
                uvs.push(j / sides, t);
            }
        }
        for (let i = 0; i < N - 1; i++) {
            for (let j = 0; j < sides; j++) {
                const a = i * (sides + 1) + j, b = a + sides + 1;
                idx.push(a, b, a + 1, b, b + 1, a + 1);
            }
        }
        for (const end of [0, N - 1]) {
            const centre = pos.length / 3;
            pos.push(points[end].x, points[end].y, points[end].z);
            const sign = end === 0 ? -1 : 1;
            nor.push(tangents[end].x * sign, tangents[end].y * sign, tangents[end].z * sign);
            uvs.push(0.5, end === 0 ? 0 : 1);
            const ring = end * (sides + 1);
            for (let j = 0; j < sides; j++) {
                if (end === 0) idx.push(centre, ring + j, ring + j + 1);
                else idx.push(centre, ring + j + 1, ring + j);
            }
        }
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
        g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
        g.setIndex(idx);
        return g;
    }

    const spline = (points, steps) =>
        new THREE.CatmullRomCurve3(points, false, 'catmullrom', 0.4).getPoints(steps);

    function tint(geometry, colour) {
        const c = new THREE.Color(colour);
        const n = geometry.attributes.position.count;
        const data = new Float32Array(n * 3);
        for (let i = 0; i < n; i++) { data[i * 3] = c.r; data[i * 3 + 1] = c.g; data[i * 3 + 2] = c.b; }
        geometry.setAttribute('color', new THREE.Float32BufferAttribute(data, 3));
        return geometry;
    }

    /* ==========================================================
       1 · Cloth and skin
       ========================================================== */

    const skinTex = paint(256, 256, (g, cv) => {
        const s = cv.width;
        g.fillStyle = '#dfae87'; g.fillRect(0, 0, s, s);
        for (let i = 0; i < 1500; i++) {
            g.fillStyle = `rgba(${rnd() > 0.5 ? '246,214,188' : '178,130,96'},${rr(0.03, 0.12)})`;
            g.beginPath(); g.arc(rr(0, s), rr(0, s), rr(1, 4), 0, Math.PI * 2); g.fill();
        }
        for (let i = 0; i < 60; i++) {
            g.fillStyle = `rgba(150,96,66,${rr(0.08, 0.24)})`;
            g.beginPath(); g.arc(rr(0, s), rr(0, s), rr(0.8, 2.4), 0, Math.PI * 2); g.fill();
        }
    });

    // Lambswool: vertical ribs of chain stitch, which is the one thing that
    // separates a knitted cardigan from a rubber one at any distance.
    const knitTex = paint(256, 256, (g, cv) => {
        const s = cv.width;
        g.fillStyle = '#6d4f4a'; g.fillRect(0, 0, s, s);
        for (let col = 0; col < 18; col++) {
            const x = (col / 18) * s;
            g.strokeStyle = 'rgba(38,24,22,0.35)'; g.lineWidth = 2.4;
            g.beginPath(); g.moveTo(x, 0); g.lineTo(x, s); g.stroke();
            for (let row = 0; row < 34; row++) {
                const y = (row / 34) * s;
                g.strokeStyle = `rgba(${rnd() > 0.5 ? '156,124,116' : '58,38,36'},${rr(0.15, 0.45)})`;
                g.lineWidth = rr(1.2, 2.6);
                g.beginPath();
                g.moveTo(x + 2, y);
                g.quadraticCurveTo(x + s / 36, y + s / 68, x + s / 18 - 2, y);
                g.stroke();
            }
        }
        for (let i = 0; i < 800; i++) {   // the fuzz that catches the light
            g.fillStyle = `rgba(${rnd() > 0.5 ? '198,170,160' : '46,30,28'},${rr(0.04, 0.2)})`;
            g.fillRect(rr(0, s), rr(0, s), rr(1, 2), rr(1, 3));
        }
    });
    if (knitTex) { knitTex.wrapS = knitTex.wrapT = THREE.RepeatWrapping; knitTex.repeat.set(2, 2); }

    const shirtTex = paint(256, 256, (g, cv) => {
        const s = cv.width;
        g.fillStyle = '#e6ecf2'; g.fillRect(0, 0, s, s);
        g.strokeStyle = 'rgba(96,130,172,0.5)'; g.lineWidth = 2;
        for (let x = 0; x < s; x += 26) {   // a fine blue stripe
            g.beginPath(); g.moveTo(x, 0); g.lineTo(x, s); g.stroke();
        }
        for (let i = 0; i < 1200; i++) {    // oxford weave
            g.fillStyle = `rgba(${rnd() > 0.5 ? '255,255,255' : '160,172,186'},${rr(0.05, 0.2)})`;
            g.fillRect(rr(0, s), rr(0, s), rr(1, 2), rr(1, 2));
        }
    });
    if (shirtTex) { shirtTex.wrapS = shirtTex.wrapT = THREE.RepeatWrapping; shirtTex.repeat.set(3, 3); }

    const woolTex = paint(256, 256, (g, cv) => {
        const s = cv.width;
        g.fillStyle = '#3b414c'; g.fillRect(0, 0, s, s);
        g.lineWidth = 1.1;
        for (let i = -s; i < s * 2; i += 4) {   // worsted twill, both ways
            g.strokeStyle = `rgba(${rnd() > 0.5 ? '112,122,138' : '22,26,32'},${rr(0.08, 0.26)})`;
            g.beginPath(); g.moveTo(i, 0); g.lineTo(i + s * 0.5, s); g.stroke();
        }
        for (let i = 0; i < 600; i++) {
            g.fillStyle = `rgba(${rnd() > 0.5 ? '150,158,172' : '18,22,28'},${rr(0.04, 0.18)})`;
            g.fillRect(rr(0, s), rr(0, s), rr(1, 2), rr(1, 2));
        }
    });
    if (woolTex) { woolTex.wrapS = woolTex.wrapT = THREE.RepeatWrapping; woolTex.repeat.set(2, 3); }

    const hairTex = paint(128, 256, (g, cv) => {
        const w = cv.width, h = cv.height;
        g.fillStyle = '#3c322c'; g.fillRect(0, 0, w, h);
        for (let i = 0; i < 460; i++) {
            // A few of these are grey, which is most of what says "adult".
            const grey = rnd() > 0.84;
            g.strokeStyle = grey
                ? `rgba(198,192,186,${rr(0.2, 0.6)})`
                : `rgba(${rnd() > 0.5 ? '108,86,70' : '26,20,16'},${rr(0.1, 0.5)})`;
            g.lineWidth = rr(0.6, 2.2);
            const x = rr(0, w);
            g.beginPath(); g.moveTo(x, rr(-10, h)); g.lineTo(x + rr(-12, 12), rr(0, h)); g.stroke();
        }
    });

    const skinMat = new THREE.MeshStandardMaterial({ map: skinTex, color: 0xffffff, roughness: 0.7 });
    const knitMat = new THREE.MeshStandardMaterial({ map: knitTex, color: 0xffffff, roughness: 0.95 });
    const shirtMat = new THREE.MeshStandardMaterial({ map: shirtTex, color: 0xffffff, roughness: 0.82 });
    const woolMat = new THREE.MeshStandardMaterial({ map: woolTex, color: 0xffffff, roughness: 0.9 });
    const hairMat = new THREE.MeshStandardMaterial({ map: hairTex, color: 0xffffff, roughness: 0.62 });
    const leatherMat = new THREE.MeshStandardMaterial({ color: 0x3a2a20, roughness: 0.42, metalness: 0.05 });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x1b1e22, roughness: 0.4 });

    /* ==========================================================
       2 · The body
       ========================================================== */

    // The shirt is only seen at the collar and the cuffs, but it is built as a
    // whole torso anyway: it costs one loft, and it means the cardigan can be
    // a layer over a body rather than a body in its own right.
    const shirt = new THREE.Mesh(loft([
        { y: 0.900, hx: 0.140, hz: 0.100, p: 0.88 },
        { y: 1.050, hx: 0.136, hz: 0.098, cz: 0.006, p: 0.9 },
        { y: 1.180, hx: 0.156, hz: 0.108, cz: 0.008, p: 0.88 },
        { y: 1.290, hx: 0.180, hz: 0.114, cz: 0.004, p: 0.86 },
        { y: 1.380, hx: 0.196, hz: 0.114, cz: -0.002, p: 0.84 },
        { y: 1.420, hx: 0.130, hz: 0.092, cz: -0.006, p: 0.9 },
        { y: 1.448, hx: 0.082, hz: 0.074, cz: -0.004, p: 1 },
    ]), shirtMat);
    shirt.castShadow = true;
    group.add(shirt);

    // The cardigan: the same body a size larger, buttoned, and hanging past the
    // waist the way a knitted thing does rather than following the ribs.
    const cardigan = new THREE.Mesh(loft([
        { y: 0.855, hx: 0.166, hz: 0.118, cz: 0.004, p: 0.86 },
        { y: 0.900, hx: 0.170, hz: 0.121, cz: 0.005, p: 0.86 },
        { y: 1.000, hx: 0.163, hz: 0.117, cz: 0.008, p: 0.88 },
        { y: 1.080, hx: 0.161, hz: 0.116, cz: 0.010, p: 0.88 },
        { y: 1.180, hx: 0.172, hz: 0.122, cz: 0.010, p: 0.87 },
        { y: 1.280, hx: 0.192, hz: 0.126, cz: 0.006, p: 0.85 },
        { y: 1.370, hx: 0.204, hz: 0.124, cz: -0.002, p: 0.83 },
        { y: 1.408, hx: 0.150, hz: 0.100, cz: -0.008, p: 0.88 },
        { y: 1.432, hx: 0.098, hz: 0.082, cz: -0.006, p: 0.95 },
    ]), knitMat);
    cardigan.castShadow = true; cardigan.receiveShadow = true;
    group.add(cardigan);

    // Placket and buttons, slightly off the centre line because a cardigan
    // never hangs straight once it has been worn in.
    const placket = [];
    for (let i = 0; i < 5; i++) {
        const y = 0.960 + i * 0.100;
        placket.push(new THREE.CylinderGeometry(0.008, 0.008, 0.004, 10)
            .rotateX(Math.PI / 2).translate(0.010 + i * 0.001, y, 0.120 + i * 0.004));
    }
    const buttons = new THREE.Mesh(merge(placket), new THREE.MeshStandardMaterial({
        color: 0x2e2420, roughness: 0.35,
    }));
    group.add(buttons);

    // The shirt collar: a band and two points, sitting outside the knit.
    const collar = new THREE.Mesh(merge([
        loft([
            { y: 1.420, hx: 0.090, hz: 0.080, cz: -0.004, p: 0.95 },
            { y: 1.455, hx: 0.086, hz: 0.077, cz: -0.004, p: 0.95 },
        ], 18, false, false),
        new THREE.BoxGeometry(0.052, 0.048, 0.006).rotateY(0.5).rotateX(0.22)
            .translate(-0.036, 1.428, 0.070),
        new THREE.BoxGeometry(0.052, 0.048, 0.006).rotateY(-0.5).rotateX(0.22)
            .translate(0.036, 1.428, 0.070),
    ]), shirtMat);
    collar.castShadow = true;
    group.add(collar);

    /* ---- legs ---------------------------------------------------------------- */

    // Weight settled on the right leg, the left one easy and turned out a
    // little. Trousers break over the shoe rather than stopping at the ankle.
    const rightLeg = sweep(spline([
        V(0.088, 0.960, 0.004), V(0.090, 0.720, 0.006), V(0.092, 0.470, 0.000),
        V(0.090, 0.250, -0.006), V(0.090, 0.098, -0.014),
    ], 22), (t) => 0.098 - 0.034 * t + 0.010 * Math.sin(t * Math.PI * 1.5), 14);

    const leftLeg = sweep(spline([
        V(-0.088, 0.960, 0.004), V(-0.098, 0.720, 0.018), V(-0.108, 0.472, 0.026),
        V(-0.112, 0.250, -0.002), V(-0.114, 0.098, -0.026),
    ], 22), (t) => 0.096 - 0.032 * t + 0.011 * Math.sin(t * Math.PI * 1.5), 14);

    const seat = loft([
        { y: 0.820, hx: 0.158, hz: 0.114, p: 0.88 },
        { y: 0.880, hx: 0.164, hz: 0.118, p: 0.86 },
        { y: 0.940, hx: 0.156, hz: 0.110, p: 0.88 },
        { y: 0.995, hx: 0.142, hz: 0.102, p: 0.9 },
    ], 18);

    const trousers = new THREE.Mesh(merge([seat, leftLeg, rightLeg]), woolMat);
    trousers.castShadow = true; trousers.receiveShadow = true;
    group.add(trousers);

    /* ---- shoes ---------------------------------------------------------------- */

    // Flat leather, lower and longer than a trainer, with a heel block under
    // the back of the sole. Stations are given as the top and bottom of the
    // shoe along the foot, so the sole stays on the floor by construction.
    function shoePart(stations) {
        const g = loft(stations.map((s) => ({
            y: s.t, hx: s.hx, hz: (s.top - s.bot) / 2, cz: -(s.top + s.bot) / 2, p: 0.76,
        })), 16);
        g.rotateX(Math.PI / 2);
        return g;
    }
    const UPPER = [
        { t: 0.000, hx: 0.034, bot: 0.026, top: 0.084 },
        { t: 0.035, hx: 0.039, bot: 0.020, top: 0.092 },
        { t: 0.090, hx: 0.043, bot: 0.016, top: 0.086 },
        { t: 0.150, hx: 0.046, bot: 0.015, top: 0.070 },
        { t: 0.210, hx: 0.044, bot: 0.015, top: 0.050 },
        { t: 0.255, hx: 0.036, bot: 0.016, top: 0.036 },
        { t: 0.282, hx: 0.020, bot: 0.019, top: 0.030 },
    ];
    const SOLE = [
        { t: -0.006, hx: 0.033, bot: 0.000, top: 0.030 },
        { t: 0.045, hx: 0.041, bot: 0.000, top: 0.030 },
        { t: 0.080, hx: 0.044, bot: 0.000, top: 0.017 },
        { t: 0.170, hx: 0.048, bot: 0.000, top: 0.016 },
        { t: 0.250, hx: 0.043, bot: 0.001, top: 0.017 },
        { t: 0.288, hx: 0.022, bot: 0.005, top: 0.019 },
    ];
    const shoeParts = [];
    for (const [x, ankleZ, yaw] of [[0.090, -0.014, 0.16], [-0.114, -0.026, -0.34]]) {
        const place = (g) => { g.rotateY(yaw); g.translate(x, 0, ankleZ - 0.082); return g; };
        shoeParts.push(place(shoePart(UPPER)), place(shoePart(SOLE)));
    }
    const shoes = new THREE.Mesh(merge(shoeParts), leatherMat);
    shoes.castShadow = true; shoes.receiveShadow = true;
    group.add(shoes);

    /* ---- arms ----------------------------------------------------------------- */

    // Right arm hangs with a marker in it; the left forearm comes across the
    // body to hold a stack of books against the hip. Both elbows are soft: a
    // straight arm is the fastest way to make a figure look switched off.
    const rightArm = sweep(spline([
        V(0.178, 1.382, -0.006), V(0.216, 1.250, 0.006), V(0.228, 1.100, 0.020),
        V(0.220, 0.960, 0.040), V(0.212, 0.868, 0.056),
    ], 20), (t) => 0.062 - 0.022 * t, 12);

    const leftArm = sweep(spline([
        V(-0.178, 1.382, -0.006), V(-0.218, 1.250, 0.000), V(-0.228, 1.108, 0.014),
        V(-0.196, 1.012, 0.078), V(-0.146, 0.964, 0.116),
    ], 20), (t) => 0.062 - 0.022 * t, 12);

    const arms = new THREE.Mesh(merge([
        rightArm, leftArm,
        new THREE.SphereGeometry(0.062, 14, 10).translate(-0.176, 1.380, -0.006),
        new THREE.SphereGeometry(0.062, 14, 10).translate(0.176, 1.380, -0.006),
    ]), knitMat);
    arms.castShadow = true;
    group.add(arms);

    // Shirt cuffs, showing past the knit the way a sleeve that is a size short
    // always does.
    const cuffs = new THREE.Mesh(merge([
        new THREE.CylinderGeometry(0.041, 0.040, 0.030, 14).rotateZ(-0.06).translate(0.213, 0.876, 0.054),
        new THREE.CylinderGeometry(0.041, 0.040, 0.030, 14).rotateZ(0.72).rotateX(-0.5)
            .translate(-0.152, 0.970, 0.112),
    ]), shirtMat);
    group.add(cuffs);

    function hand(x, y, z, yaw, pitch, roll) {
        const g = merge([
            loft([
                { y: 0.000, hx: 0.028, hz: 0.018, p: 0.8 },
                { y: 0.042, hx: 0.036, hz: 0.021, p: 0.8 },
                { y: 0.090, hx: 0.034, hz: 0.019, p: 0.8 },
                { y: 0.116, hx: 0.023, hz: 0.015, p: 0.9 },
            ], 12),
            new THREE.SphereGeometry(0.014, 10, 8).scale(1, 1.7, 1).translate(0.028, 0.038, 0.009),
        ]);
        g.rotateX(pitch); g.rotateZ(roll); g.rotateY(yaw);
        g.translate(x, y, z);
        return g;
    }
    const hands = new THREE.Mesh(merge([
        hand(0.211, 0.760, 0.060, 0.1, -0.12, 0.04),
        hand(-0.132, 0.928, 0.128, -0.5, 1.35, 0.4),
    ]), skinMat);
    hands.castShadow = true;
    group.add(hands);

    const marker = new THREE.Mesh(
        merge([
            new THREE.CylinderGeometry(0.0085, 0.0085, 0.12, 12),
            new THREE.CylinderGeometry(0.0072, 0.0072, 0.036, 12).translate(0, 0.074, 0),
        ]).rotateX(1.15).rotateZ(0.12).translate(0.208, 0.752, 0.062),
        new THREE.MeshStandardMaterial({ color: 0x1c4f8c, roughness: 0.4 })
    );
    marker.castShadow = true;
    group.add(marker);

    /* ---- the books under the arm ------------------------------------------------ */

    // Six exercise books, squared up and then pulled slightly out of square by
    // being carried. This is the silhouette that says teacher from behind.
    const stack = [];
    let by = 0;
    for (let i = 0; i < 6; i++) {
        const th = rr(0.007, 0.011);
        const g = new THREE.BoxGeometry(0.185, th, 0.250);
        g.rotateY(rr(-0.06, 0.06));
        g.translate(rr(-0.006, 0.006), by + th / 2, rr(-0.008, 0.008));
        stack.push(tint(g, [0xb8532f, 0x2f5f8c, 0x4a7a3a, 0xc8a13a, 0x7a3a6a, 0x3a6a72][i]));
        by += th;
    }
    const books = new THREE.Mesh(merge(stack), new THREE.MeshStandardMaterial({
        vertexColors: true, roughness: 0.8,
    }));
    books.rotation.set(0.10, 0.18, 1.44);       // held on edge against the hip
    books.position.set(-0.196, 0.905, 0.070);
    books.castShadow = true; books.receiveShadow = true;
    group.add(books);

    /* ==========================================================
       3 · Head
       ========================================================== */

    const head = new THREE.Group();
    head.position.set(0.000, 1.452, 0.000);
    // Level, turned a little across the room, chin fractionally up: talking.
    head.rotation.set(-0.03, 0.26, -0.02);
    group.add(head);

    const neck = new THREE.Mesh(sweep(spline([
        V(0, -0.040, -0.004), V(0, 0.000, 0.000), V(0, 0.036, 0.008),
    ], 8), (t) => 0.047 - 0.005 * t, 12), skinMat);
    neck.castShadow = true;
    head.add(neck);

    const skull = new THREE.Mesh(loft([
        { y: 0.030, hx: 0.030, hz: 0.038, cz: 0.014, p: 0.9 },
        { y: 0.054, hx: 0.052, hz: 0.060, cz: 0.010, p: 0.85 },
        { y: 0.082, hx: 0.069, hz: 0.079, cz: 0.004, p: 0.82 },
        { y: 0.116, hx: 0.076, hz: 0.091, cz: -0.002, p: 0.8 },
        { y: 0.152, hx: 0.078, hz: 0.095, cz: -0.007, p: 0.82 },
        { y: 0.192, hx: 0.074, hz: 0.090, cz: -0.011, p: 0.85 },
        { y: 0.226, hx: 0.058, hz: 0.070, cz: -0.013, p: 0.9 },
        { y: 0.250, hx: 0.024, hz: 0.030, cz: -0.011, p: 1 },
    ], 22), skinMat);
    skull.castShadow = true;
    head.add(skull);

    const features = new THREE.Mesh(merge([
        loft([
            { y: 0.000, hx: 0.011, hz: 0.010, p: 0.8 },
            { y: 0.020, hx: 0.015, hz: 0.015, p: 0.8 },
            { y: 0.042, hx: 0.011, hz: 0.011, p: 0.9 },
        ], 10).translate(0, 0.100, 0.090),
        new THREE.SphereGeometry(0.020, 10, 8).scale(0.35, 1.1, 0.75).translate(-0.076, 0.144, -0.004),
        new THREE.SphereGeometry(0.020, 10, 8).scale(0.35, 1.1, 0.75).translate(0.076, 0.144, -0.004),
        new THREE.SphereGeometry(0.017, 10, 8).scale(1.5, 0.42, 0.5).translate(0, 0.078, 0.080),
    ]), skinMat);
    features.castShadow = true;
    head.add(features);

    const eyes = new THREE.Mesh(merge([
        new THREE.SphereGeometry(0.0125, 12, 10).scale(1.25, 0.76, 0.7).translate(-0.032, 0.1345, 0.072),
        new THREE.SphereGeometry(0.0125, 12, 10).scale(1.25, 0.76, 0.7).translate(0.032, 0.1355, 0.072),
    ]), new THREE.MeshStandardMaterial({ color: 0x2a2018, roughness: 0.2, metalness: 0.05 }));
    head.add(eyes);

    // Hair: pulled back off the face into a low knot, which is a silhouette
    // rather than a texture and therefore reads at any distance.
    const cap = loft([
        { y: 0.116, hx: 0.081, hz: 0.098, cz: -0.010, p: 0.82 },
        { y: 0.152, hx: 0.083, hz: 0.100, cz: -0.010, p: 0.82 },
        { y: 0.192, hx: 0.078, hz: 0.094, cz: -0.012, p: 0.85 },
        { y: 0.228, hx: 0.061, hz: 0.074, cz: -0.013, p: 0.9 },
        { y: 0.256, hx: 0.026, hz: 0.032, cz: -0.011, p: 1 },
    ], 22, false, true);
    {
        // The front of the cap is cut back off the forehead, so there is a face
        // under the hair rather than a helmet over one.
        const pos = cap.attributes.position;
        const v = new THREE.Vector3();
        for (let i = 0; i < pos.count; i++) {
            v.fromBufferAttribute(pos, i);
            const front = Math.max(0, (v.z - 0.02) / 0.08);
            const drop = Math.max(0, (0.17 - v.y) / 0.06);
            const pull = Math.min(1, front * drop);
            pos.setXYZ(i, v.x * (1 - pull * 0.10), v.y + pull * 0.030, v.z * (1 - pull * 0.28));
        }
        pos.needsUpdate = true;
        cap.computeVertexNormals();
    }
    const knot = new THREE.SphereGeometry(0.042, 14, 12)
        .scale(1, 0.9, 0.85).translate(0, 0.150, -0.106);
    // Two loose strands that never stay in the knot.
    const strands = [
        sweep(spline([V(-0.072, 0.170, 0.026), V(-0.086, 0.120, 0.030), V(-0.088, 0.068, 0.020)], 8),
            (t) => 0.008 - 0.003 * t, 6),
        sweep(spline([V(0.070, 0.176, 0.020), V(0.084, 0.132, 0.012), V(0.082, 0.098, -0.004)], 8),
            (t) => 0.007 - 0.003 * t, 6),
    ];
    const hair = new THREE.Mesh(merge([cap, knot, ...strands]), hairMat);
    hair.castShadow = true;
    head.add(hair);

    const brows = new THREE.Mesh(merge([
        new THREE.SphereGeometry(0.015, 8, 6).scale(1.5, 0.28, 0.4).translate(-0.033, 0.153, 0.076),
        new THREE.SphereGeometry(0.015, 8, 6).scale(1.5, 0.28, 0.4).translate(0.033, 0.156, 0.076),
    ]), hairMat);
    head.add(brows);

    /* ---- glasses ---------------------------------------------------------------- */

    const frames = new THREE.Mesh(merge([
        new THREE.TorusGeometry(0.0245, 0.0022, 8, 22).scale(1, 0.82, 1).translate(-0.032, 0.136, 0.079),
        new THREE.TorusGeometry(0.0245, 0.0022, 8, 22).scale(1, 0.82, 1).translate(0.032, 0.137, 0.079),
        new THREE.CylinderGeometry(0.0018, 0.0018, 0.016, 6).rotateZ(Math.PI / 2).translate(0, 0.140, 0.080),
        new THREE.CylinderGeometry(0.0018, 0.0018, 0.085, 6).rotateZ(Math.PI / 2).rotateY(1.30)
            .translate(-0.062, 0.140, 0.042),
        new THREE.CylinderGeometry(0.0018, 0.0018, 0.085, 6).rotateZ(Math.PI / 2).rotateY(-1.30)
            .translate(0.062, 0.140, 0.042),
    ]), new THREE.MeshStandardMaterial({ color: 0x24282e, roughness: 0.3, metalness: 0.5 }));
    head.add(frames);

    const lenses = new THREE.Mesh(merge([
        new THREE.CircleGeometry(0.0235, 20).scale(1, 0.82, 1).translate(-0.032, 0.136, 0.0785),
        new THREE.CircleGeometry(0.0235, 20).scale(1, 0.82, 1).translate(0.032, 0.137, 0.0785),
    ]), new THREE.MeshStandardMaterial({
        color: 0xdfeaf4, roughness: 0.03, metalness: 0.1,
        transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide,
    }));
    head.add(lenses);

    /* ---- lanyard ------------------------------------------------------------------ */

    const lanyard = new THREE.Mesh(
        merge([
            sweep(spline([
                V(-0.052, 1.442, 0.020), V(-0.086, 1.380, 0.052), V(-0.070, 1.290, 0.098),
                V(-0.024, 1.230, 0.116),
            ], 14), () => 0.0045, 6),
            sweep(spline([
                V(0.052, 1.442, 0.020), V(0.086, 1.380, 0.052), V(0.062, 1.286, 0.100),
                V(0.020, 1.230, 0.116),
            ], 14), () => 0.0045, 6),
        ]),
        new THREE.MeshStandardMaterial({ color: 0x1d5f8c, roughness: 0.85 })
    );
    lanyard.castShadow = true;
    group.add(lanyard);

    const badge = new THREE.Mesh(
        new THREE.BoxGeometry(0.058, 0.086, 0.003).rotateX(0.30).rotateZ(0.10)
            .translate(-0.002, 1.182, 0.126),
        new THREE.MeshStandardMaterial({ color: 0xf2f0ea, roughness: 0.35 })
    );
    badge.castShadow = true;
    group.add(badge);

    group.name = 'teacher';
    return group;
}
