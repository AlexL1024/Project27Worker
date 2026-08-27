//
//  student.prop.js
//  Project27 object library
//
//  A secondary-school student, 1.62 m, standing with their weight on one leg,
//  one hand in the hoodie pocket, bag over the right shoulder.
//
//  Stylised, but built on real proportions: seven and a bit heads tall,
//  shoulders 0.39 m across, the pelvis a little narrower than the ribcage.
//  Those numbers are what make a figure read as a person at a glance; a face
//  is what makes it read as a person up close, and it is the proportions that
//  matter more, because in a world this figure is nearly always across a room.
//
//  Nothing here is rigged. The pose is baked into the skeleton points below —
//  a prop is a thing, not an animation — so the asymmetry has to be modelled:
//  hips off level, one knee soft, the shoulders rolled forward, the head
//  tipped down and to one side. A figure standing perfectly square is the one
//  thing that reads instantly as a mannequin.
//
//  Origin between the feet on the floor, facing +Z.
//

import { mergeGeometries } from './BufferGeometryUtils.js';

export default function build(THREE, helpers) {
    const group = new THREE.Group();

    let seed = 13907;
    const rnd = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
    const rr = (a, b) => a + (b - a) * rnd();

    const paint = (w, h, draw) => (helpers && helpers.canvasTexture ? helpers.canvasTexture(w, h, draw) : null);
    const V = (x, y, z) => new THREE.Vector3(x, y, z);
    const merge = (parts) => mergeGeometries(parts.map((g) => (g.index ? g.toNonIndexed() : g)));

    /* ==========================================================
       0 · The two shapes a body is made of
       ========================================================== */

    /**
     * A lofted body: a stack of superelliptical rings up the y axis. Every
     * solid mass here — the torso, the head, the bag, a shoe — is one of
     * these, because a body is a series of cross-sections and nothing else.
     *
     * `p` below 1 squares the section off, which is how a ribcage differs from
     * a sausage: flatter at the front and back than a true ellipse.
     */
    function loft(sections, sides = 20, capBottom = true, capTop = true) {
        const pos = [], nor = [], uvs = [], idx = [];
        const rings = sections.length;
        for (let i = 0; i < rings; i++) {
            const s = sections[i];
            const p = s.p === undefined ? 1 : s.p;
            for (let j = 0; j <= sides; j++) {
                const a = (j / sides) * Math.PI * 2;
                const ca = Math.cos(a), sa = Math.sin(a);
                const x = (s.cx || 0) + s.hx * Math.sign(ca) * Math.pow(Math.abs(ca), p);
                const z = (s.cz || 0) + s.hz * Math.sign(sa) * Math.pow(Math.abs(sa), p);
                pos.push(x, s.y, z);
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

    /**
     * A limb: a round tube swept along a bent path with a varying radius,
     * carried by a parallel-transported frame so it does not spin at the knee.
     */
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
                const dir = nrm.clone().multiplyScalar(Math.cos(a) * r)
                    .addScaledVector(bin, Math.sin(a) * r);
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

    /** Resample a bent path so a sweep bends smoothly rather than in facets. */
    function spline(points, steps) {
        const curve = new THREE.CatmullRomCurve3(points, false, 'catmullrom', 0.4);
        return curve.getPoints(steps);
    }

    /* ==========================================================
       1 · Cloth and skin
       ========================================================== */

    const skinTex = paint(256, 256, (g, cv) => {
        const s = cv.width;
        g.fillStyle = '#b4805c'; g.fillRect(0, 0, s, s);
        for (let i = 0; i < 1600; i++) {   // the mottle that keeps skin off plastic
            g.fillStyle = `rgba(${rnd() > 0.5 ? '206,158,124' : '134,92,64'},${rr(0.03, 0.13)})`;
            g.beginPath(); g.arc(rr(0, s), rr(0, s), rr(1, 4), 0, Math.PI * 2); g.fill();
        }
        for (let i = 0; i < 40; i++) {     // freckles and small marks
            g.fillStyle = `rgba(96,58,36,${rr(0.1, 0.3)})`;
            g.beginPath(); g.arc(rr(0, s), rr(0, s), rr(0.8, 2.2), 0, Math.PI * 2); g.fill();
        }
    });

    const jerseyTex = paint(256, 256, (g, cv) => {
        const s = cv.width;
        g.fillStyle = '#4a5560'; g.fillRect(0, 0, s, s);
        // Marl: two greys flecked through each other, then the loop of the knit.
        for (let i = 0; i < 4200; i++) {
            g.fillStyle = `rgba(${rnd() > 0.45 ? '126,140,152' : '38,46,54'},${rr(0.05, 0.28)})`;
            g.fillRect(rr(0, s), rr(0, s), rr(1, 3), rr(1, 2));
        }
        g.globalAlpha = 0.12;
        for (let y = 0; y < s; y += 4) {
            g.strokeStyle = '#101418'; g.lineWidth = 1;
            g.beginPath(); g.moveTo(0, y); g.lineTo(s, y + 1); g.stroke();
        }
        g.globalAlpha = 1;
        // Bobbling, worn into the places a bag strap rubs.
        for (let i = 0; i < 90; i++) {
            g.fillStyle = `rgba(180,192,204,${rr(0.1, 0.4)})`;
            g.beginPath(); g.arc(rr(0, s), rr(0, s), rr(0.8, 2.4), 0, Math.PI * 2); g.fill();
        }
    });
    if (jerseyTex) { jerseyTex.wrapS = jerseyTex.wrapT = THREE.RepeatWrapping; jerseyTex.repeat.set(2, 2); }

    const denimTex = paint(256, 256, (g, cv) => {
        const s = cv.width;
        g.fillStyle = '#3f5b7d'; g.fillRect(0, 0, s, s);
        // Twill runs on the diagonal; that diagonal is the whole read of denim.
        g.lineWidth = 1.2;
        for (let i = -s; i < s * 2; i += 3) {
            g.strokeStyle = `rgba(${rnd() > 0.5 ? '132,164,198' : '26,40,58'},${rr(0.1, 0.34)})`;
            g.beginPath(); g.moveTo(i, 0); g.lineTo(i + s, s); g.stroke();
        }
        for (let i = 0; i < 8; i++) {      // whiskering at the hip and knee
            const x = rr(0, s), y = rr(0, s);
            const wear = g.createRadialGradient(x, y, 2, x, y, rr(20, 60));
            wear.addColorStop(0, 'rgba(196,214,232,0.30)');
            wear.addColorStop(1, 'rgba(196,214,232,0)');
            g.fillStyle = wear; g.fillRect(x - 64, y - 64, 128, 128);
        }
    });
    if (denimTex) { denimTex.wrapS = denimTex.wrapT = THREE.RepeatWrapping; denimTex.repeat.set(2, 3); }

    const hairTex = paint(128, 256, (g, cv) => {
        const w = cv.width, h = cv.height;
        g.fillStyle = '#2b211c'; g.fillRect(0, 0, w, h);
        for (let i = 0; i < 420; i++) {
            g.strokeStyle = `rgba(${rnd() > 0.5 ? '92,68,52' : '18,12,10'},${rr(0.1, 0.5)})`;
            g.lineWidth = rr(0.6, 2.2);
            const x = rr(0, w);
            g.beginPath(); g.moveTo(x, rr(-10, h));
            g.lineTo(x + rr(-14, 14), rr(0, h));
            g.stroke();
        }
    });

    const skinMat = new THREE.MeshStandardMaterial({ map: skinTex, color: 0xffffff, roughness: 0.72 });
    const hoodieMat = new THREE.MeshStandardMaterial({ map: jerseyTex, color: 0xffffff, roughness: 0.92 });
    const denimMat = new THREE.MeshStandardMaterial({ map: denimTex, color: 0xffffff, roughness: 0.94 });
    const hairMat = new THREE.MeshStandardMaterial({ map: hairTex, color: 0xffffff, roughness: 0.66 });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x1a1c20, roughness: 0.45 });
    const rubberMat = new THREE.MeshStandardMaterial({ color: 0xe6e3dc, roughness: 0.7 });
    const canvasMat = new THREE.MeshStandardMaterial({ color: 0x25313f, roughness: 0.88 });

    /* ==========================================================
       2 · The body
       ========================================================== */

    // The hoodie is the torso: there is no body under it worth building, and a
    // sweatshirt hangs off the shoulders rather than following the ribs.
    // The weight is on the left leg, so the spine leans back over that hip and
    // the shoulders drift with it, and the chest carries forward into a slouch.
    // All of that is in the `cx` and `cz` of the sections: tilting the mesh
    // instead would pivot at the figure's feet and slide the hem off the hips.
    const torso = new THREE.Mesh(loft([
        { y: 0.795, hx: 0.152, hz: 0.108, cx: 0.000, cz: 0.004, p: 0.86 },
        { y: 0.840, hx: 0.161, hz: 0.113, cx: -0.003, cz: 0.006, p: 0.86 },   // the hem kicks out
        { y: 0.930, hx: 0.148, hz: 0.104, cx: -0.008, cz: 0.010, p: 0.88 },
        { y: 1.010, hx: 0.143, hz: 0.100, cx: -0.012, cz: 0.015, p: 0.9 },
        { y: 1.100, hx: 0.156, hz: 0.107, cx: -0.016, cz: 0.018, p: 0.88 },
        { y: 1.190, hx: 0.174, hz: 0.113, cx: -0.019, cz: 0.016, p: 0.86 },
        { y: 1.265, hx: 0.188, hz: 0.114, cx: -0.021, cz: 0.008, p: 0.84 },
        { y: 1.312, hx: 0.183, hz: 0.108, cx: -0.022, cz: -0.002, p: 0.84 },
        { y: 1.345, hx: 0.120, hz: 0.086, cx: -0.020, cz: -0.008, p: 0.9 },
        { y: 1.368, hx: 0.078, hz: 0.070, cx: -0.016, cz: -0.008, p: 1 },
    ]), hoodieMat);
    torso.castShadow = true; torso.receiveShadow = true;
    group.add(torso);

    // The hood, bunched at the back of the neck where a hood actually lives.
    const hoodGeo = loft([
        { y: -0.085, hx: 0.070, hz: 0.040, p: 0.9 },
        { y: -0.045, hx: 0.100, hz: 0.060, p: 0.85 },
        { y: 0.005, hx: 0.108, hz: 0.066, p: 0.85 },
        { y: 0.055, hx: 0.086, hz: 0.052, p: 0.9 },
        { y: 0.085, hx: 0.050, hz: 0.032, p: 1 },
    ], 16);
    hoodGeo.rotateX(-0.42);          // lolling back off the shoulders
    hoodGeo.scale(1.05, 1, 1);
    hoodGeo.translate(-0.020, 1.296, -0.094);
    const hood = new THREE.Mesh(hoodGeo, hoodieMat);
    hood.castShadow = true;
    group.add(hood);

    // Pocket lip and the two drawstrings, one longer than the other.
    const pocket = new THREE.Mesh(merge([
        new THREE.BoxGeometry(0.20, 0.012, 0.02).translate(0, 0.985, 0.104),
        new THREE.CylinderGeometry(0.0035, 0.0035, 0.16, 6).translate(-0.026, 1.275, 0.072),
        new THREE.CylinderGeometry(0.0035, 0.0035, 0.115, 6).translate(0.024, 1.253, 0.076),
        new THREE.CylinderGeometry(0.006, 0.006, 0.012, 8).translate(-0.026, 1.196, 0.072),
        new THREE.CylinderGeometry(0.006, 0.006, 0.012, 8).translate(0.024, 1.197, 0.076),
    ]), hoodieMat);
    pocket.castShadow = true;
    group.add(pocket);

    /* ---- legs ---------------------------------------------------------------- */

    // Left leg takes the weight and is nearly straight; the right knee is soft
    // and turned out, and its foot has drifted back. That is standing.
    const leftLeg = sweep(spline([
        V(-0.082, 0.930, 0.004), V(-0.086, 0.700, 0.006), V(-0.090, 0.450, 0.000),
        V(-0.086, 0.240, -0.004), V(-0.084, 0.090, -0.010),
    ], 22), (t) => 0.088 - 0.030 * t + 0.010 * Math.sin(t * Math.PI * 1.4), 14);

    const rightLeg = sweep(spline([
        V(0.082, 0.930, 0.004), V(0.096, 0.700, 0.026), V(0.108, 0.452, 0.042),
        V(0.106, 0.240, -0.006), V(0.104, 0.090, -0.048),
    ], 22), (t) => 0.086 - 0.028 * t + 0.011 * Math.sin(t * Math.PI * 1.4), 14);

    const seat = loft([
        { y: 0.760, hx: 0.150, hz: 0.108, p: 0.88 },
        { y: 0.830, hx: 0.158, hz: 0.114, p: 0.86 },
        { y: 0.900, hx: 0.152, hz: 0.108, p: 0.88 },
        { y: 0.960, hx: 0.140, hz: 0.100, p: 0.9 },
    ], 18);

    const jeans = new THREE.Mesh(merge([seat, leftLeg, rightLeg]), denimMat);
    jeans.castShadow = true; jeans.receiveShadow = true;
    group.add(jeans);

    /* ---- shoes ---------------------------------------------------------------- */

    /**
     * A shoe: the same loft laid on its side, so the axis that gave a torso its
     * height gives a foot its length. Each station is given as the top and the
     * bottom of the shoe at that point down the foot, because that is how a
     * shoe is actually shaped — a flat sole and a falling instep — and asking
     * for a centre and a radius instead is how a shoe ends up floating.
     */
    function shoePart(stations) {
        const g = loft(stations.map((s) => ({
            y: s.t, hx: s.hx, hz: (s.top - s.bot) / 2, cz: -(s.top + s.bot) / 2, p: 0.78,
        })), 16);
        g.rotateX(Math.PI / 2);      // length along +z, standing on its sole
        return g;
    }

    const UPPER = [
        { t: 0.000, hx: 0.033, bot: 0.022, top: 0.098 },   // heel
        { t: 0.030, hx: 0.038, bot: 0.020, top: 0.112 },   // ankle collar
        { t: 0.075, hx: 0.041, bot: 0.019, top: 0.106 },
        { t: 0.130, hx: 0.045, bot: 0.019, top: 0.090 },   // instep
        { t: 0.190, hx: 0.045, bot: 0.019, top: 0.068 },
        { t: 0.235, hx: 0.040, bot: 0.020, top: 0.050 },
        { t: 0.266, hx: 0.024, bot: 0.024, top: 0.038 },   // toe
    ];
    const SOLE = [
        { t: -0.004, hx: 0.032, bot: 0.001, top: 0.026 },
        { t: 0.040, hx: 0.041, bot: 0.000, top: 0.028 },
        { t: 0.150, hx: 0.047, bot: 0.000, top: 0.027 },
        { t: 0.240, hx: 0.043, bot: 0.002, top: 0.026 },
        { t: 0.274, hx: 0.026, bot: 0.007, top: 0.026 },   // toe spring
    ];

    const uppers = [], soles = [];
    // The ankle is a third of the way down a foot, not at the heel, so the shoe
    // is pushed back from the point the leg lands on.
    for (const [x, ankleZ, yaw] of [[-0.084, -0.010, -0.09], [0.104, -0.048, 0.30]]) {
        const place = (g) => { g.rotateY(yaw); g.translate(x, 0, ankleZ - 0.078); return g; };
        uppers.push(place(shoePart(UPPER)));
        soles.push(place(shoePart(SOLE)));
    }
    const shoeMesh = new THREE.Mesh(merge(uppers), canvasMat);
    shoeMesh.castShadow = true; shoeMesh.receiveShadow = true;
    group.add(shoeMesh);
    const soleMesh = new THREE.Mesh(merge(soles), rubberMat);
    soleMesh.castShadow = true; soleMesh.receiveShadow = true;
    group.add(soleMesh);

    /* ---- arms ----------------------------------------------------------------- */

    // The right hand is in the pocket, so that arm crosses inward; the left one
    // hangs, with the small outward bow a relaxed arm has.
    const leftArm = sweep(spline([
        V(-0.168, 1.300, -0.006), V(-0.196, 1.190, 0.004), V(-0.206, 1.040, 0.012),
        V(-0.198, 0.900, 0.030), V(-0.190, 0.812, 0.046),
    ], 20), (t) => 0.058 - 0.022 * t, 12);

    const rightArm = sweep(spline([
        V(0.168, 1.300, -0.006), V(0.200, 1.190, 0.012), V(0.204, 1.048, 0.038),
        V(0.168, 0.945, 0.088), V(0.116, 0.902, 0.108),
    ], 20), (t) => 0.058 - 0.022 * t, 12);

    const shoulders = [
        new THREE.SphereGeometry(0.058, 14, 10).translate(-0.166, 1.298, -0.006),
        new THREE.SphereGeometry(0.058, 14, 10).translate(0.166, 1.298, -0.006),
    ];
    const arms = new THREE.Mesh(merge([leftArm, rightArm, ...shoulders]), hoodieMat);
    arms.castShadow = true;
    group.add(arms);

    /** A hand as a mitt with a thumb — enough at this scale, and honest. */
    function hand(x, y, z, yaw, pitch) {
        const g = merge([
            loft([
                { y: 0.000, hx: 0.026, hz: 0.017, p: 0.8 },
                { y: 0.040, hx: 0.033, hz: 0.020, p: 0.8 },
                { y: 0.085, hx: 0.031, hz: 0.018, p: 0.8 },
                { y: 0.110, hx: 0.022, hz: 0.014, p: 0.9 },
            ], 12),
            new THREE.SphereGeometry(0.013, 10, 8).scale(1, 1.6, 1).translate(0.026, 0.036, 0.008),
        ]);
        g.rotateX(pitch);
        g.rotateZ(yaw);
        g.translate(x, y, z);
        return g;
    }
    const hands = new THREE.Mesh(merge([
        hand(-0.190, 0.700, 0.048, 0.06, -0.10),
        hand(0.112, 0.870, 0.106, -0.55, 0.35),
    ]), skinMat);
    hands.castShadow = true;
    group.add(hands);

    /* ==========================================================
       3 · Head
       ========================================================== */

    const head = new THREE.Group();
    head.position.set(0.004, 1.372, 0.002);
    // Tipped down and turned a little: a student looking at something on a desk.
    head.rotation.set(0.10, -0.20, 0.03);
    group.add(head);

    const neck = new THREE.Mesh(sweep(spline([
        V(0, -0.03, -0.004), V(0, 0.01, 0.000), V(0, 0.045, 0.006),
    ], 8), (t) => 0.043 - 0.004 * t, 12), skinMat);
    neck.castShadow = true;
    head.add(neck);

    const skull = new THREE.Mesh(loft([
        { y: 0.038, hx: 0.028, hz: 0.036, cz: 0.014, p: 0.9 },     // the chin
        { y: 0.060, hx: 0.050, hz: 0.058, cz: 0.010, p: 0.85 },
        { y: 0.086, hx: 0.066, hz: 0.076, cz: 0.004, p: 0.82 },    // jaw
        { y: 0.118, hx: 0.073, hz: 0.088, cz: -0.002, p: 0.8 },    // cheekbones
        { y: 0.152, hx: 0.075, hz: 0.092, cz: -0.006, p: 0.82 },   // temples
        { y: 0.190, hx: 0.072, hz: 0.088, cz: -0.010, p: 0.85 },
        { y: 0.222, hx: 0.056, hz: 0.068, cz: -0.012, p: 0.9 },
        { y: 0.243, hx: 0.024, hz: 0.030, cz: -0.010, p: 1 },      // crown
    ], 22), skinMat);
    skull.castShadow = true;
    head.add(skull);

    // Nose, ears and lips: four small pieces, and the difference between a
    // person and an egg.
    const features = new THREE.Mesh(merge([
        loft([
            { y: 0.000, hx: 0.011, hz: 0.010, p: 0.8 },
            { y: 0.018, hx: 0.014, hz: 0.014, p: 0.8 },
            { y: 0.038, hx: 0.010, hz: 0.010, p: 0.9 },
        ], 10).translate(0, 0.108, 0.088),
        new THREE.SphereGeometry(0.019, 10, 8).scale(0.35, 1.1, 0.75).translate(-0.073, 0.148, -0.004),
        new THREE.SphereGeometry(0.019, 10, 8).scale(0.35, 1.1, 0.75).translate(0.073, 0.148, -0.004),
        new THREE.SphereGeometry(0.016, 10, 8).scale(1.5, 0.42, 0.5).translate(0, 0.086, 0.078),
    ]), skinMat);
    features.castShadow = true;
    head.add(features);

    // The eyes. Set into the sockets rather than stuck on the front, and not
    // quite level, because nobody's are.
    const eyes = new THREE.Mesh(merge([
        new THREE.SphereGeometry(0.0125, 12, 10).scale(1.25, 0.78, 0.7).translate(-0.031, 0.1385, 0.070),
        new THREE.SphereGeometry(0.0125, 12, 10).scale(1.25, 0.78, 0.7).translate(0.031, 0.1395, 0.070),
    ]), new THREE.MeshStandardMaterial({ color: 0x241a14, roughness: 0.22, metalness: 0.05 }));
    head.add(eyes);

    // Hair: a cap over the cranium, roughed up so it is not a swim hat, plus a
    // fringe that has been pushed sideways and stayed there.
    const cap = loft([
        { y: 0.148, hx: 0.080, hz: 0.097, cz: -0.006, p: 0.82 },
        { y: 0.180, hx: 0.079, hz: 0.095, cz: -0.010, p: 0.84 },
        { y: 0.214, hx: 0.066, hz: 0.079, cz: -0.012, p: 0.88 },
        { y: 0.240, hx: 0.040, hz: 0.048, cz: -0.010, p: 0.95 },
        { y: 0.252, hx: 0.014, hz: 0.017, cz: -0.008, p: 1 },
    ], 22, false, true);
    {
        const pos = cap.attributes.position;
        const v = new THREE.Vector3();
        for (let i = 0; i < pos.count; i++) {
            v.fromBufferAttribute(pos, i);
            const n = Math.sin(v.x * 190 + v.z * 130) * Math.sin(v.y * 90 + 1.7);
            pos.setXYZ(i, v.x * (1 + n * 0.05), v.y + n * 0.004, v.z * (1 + n * 0.05));
        }
        pos.needsUpdate = true;
        cap.computeVertexNormals();
    }
    const tufts = [];
    for (let i = 0; i < 7; i++) {
        const a = -0.9 + i * 0.30;
        const g = new THREE.ConeGeometry(0.014, rr(0.03, 0.055), 6)
            .rotateX(rr(0.9, 1.5))
            .rotateY(a * 0.6)
            .translate(Math.sin(a) * 0.062, 0.196 + rr(-0.02, 0.02), Math.cos(a) * 0.070 + 0.006);
        tufts.push(g);
    }
    // The fringe, swept across and hanging over one eyebrow.
    tufts.push(loft([
        { y: 0.128, hx: 0.062, hz: 0.030, cz: 0.062, p: 0.7 },
        { y: 0.150, hx: 0.074, hz: 0.042, cz: 0.056, p: 0.7 },
        { y: 0.172, hx: 0.076, hz: 0.048, cz: 0.046, p: 0.75 },
    ], 14).rotateZ(0.12));
    const hair = new THREE.Mesh(merge([cap, ...tufts]), hairMat);
    hair.castShadow = true;
    head.add(hair);

    // Eyebrows, in the hair colour, one raised higher than the other.
    const brows = new THREE.Mesh(merge([
        new THREE.SphereGeometry(0.014, 8, 6).scale(1.5, 0.30, 0.4).translate(-0.032, 0.156, 0.074),
        new THREE.SphereGeometry(0.014, 8, 6).scale(1.5, 0.30, 0.4).translate(0.032, 0.159, 0.074),
    ]), hairMat);
    head.add(brows);

    /* ==========================================================
       4 · The bag
       ========================================================== */

    // Over one shoulder only, hanging low against the back — which is how a
    // fifteen-year-old carries a bag and a hiker does not.
    const bag = new THREE.Mesh(
        loft([
            { y: 0.960, hx: 0.130, hz: 0.058, cx: 0.014, cz: -0.192, p: 0.7 },
            { y: 1.030, hx: 0.152, hz: 0.076, cx: 0.010, cz: -0.200, p: 0.7 },
            { y: 1.140, hx: 0.156, hz: 0.082, cx: 0.004, cz: -0.198, p: 0.7 },
            { y: 1.240, hx: 0.148, hz: 0.072, cx: -0.002, cz: -0.186, p: 0.72 },
            { y: 1.290, hx: 0.116, hz: 0.050, cx: -0.006, cz: -0.172, p: 0.8 },
        ], 18),
        new THREE.MeshStandardMaterial({ color: 0x2e4a3c, roughness: 0.86 })
    );
    bag.castShadow = true; bag.receiveShadow = true;
    group.add(bag);

    const straps = new THREE.Mesh(merge([
        sweep(spline([
            V(0.150, 1.300, -0.030), V(0.176, 1.220, 0.030), V(0.150, 1.090, 0.062),
            V(0.096, 1.010, -0.020), V(0.070, 1.000, -0.140),
        ], 16), () => 0.016, 8),
        // The loose end of the other strap, swinging free.
        sweep(spline([
            V(-0.120, 1.230, -0.180), V(-0.150, 1.140, -0.196), V(-0.156, 1.040, -0.214),
        ], 10), () => 0.014, 8),
    ]), new THREE.MeshStandardMaterial({ color: 0x22352c, roughness: 0.9 }));
    straps.castShadow = true;
    group.add(straps);

    group.name = 'student';
    return group;
}
