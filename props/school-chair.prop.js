//
//  school-chair.prop.js
//  Project27 object library
//
//  A stacking school chair: a moulded polypropylene seat and back on a bent
//  steel tube frame, seat at 0.44 m, top of the back at 0.84 m.
//
//  Both shells are built as real shells — a top surface, an offset underside,
//  and a stitched rim — rather than as flat planes, because the giveaway on a
//  chair is the edge. A plane has none, and a box has the wrong one; a 9 mm
//  rolled lip is what the eye actually recognises.
//
//  Origin at the floor, centred, facing +Z.
//

import { mergeGeometries } from './BufferGeometryUtils.js';

export default function build(THREE, helpers) {
    const group = new THREE.Group();

    let seed = 4472;
    const rnd = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
    const rr = (a, b) => a + (b - a) * rnd();
    const smooth = (e0, e1, x) => {
        const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
        return t * t * (3 - 2 * t);
    };

    const paint = (w, h, draw) => (helpers && helpers.canvasTexture ? helpers.canvasTexture(w, h, draw) : null);
    const V = (x, y, z) => new THREE.Vector3(x, y, z);
    const merge = (parts) => mergeGeometries(parts.map((g) => (g.index ? g.toNonIndexed() : g)));

    /* ---- geometry helpers ------------------------------------------------ */

    /**
     * A moulded shell: the surface `at(u, v)` gives, its underside pushed along
     * `off`, and the two stitched together around the rim so the edge has the
     * thickness a pressed panel actually has.
     */
    function shellGeometry(rows, cols, at, off) {
        const pos = [], uvs = [], idx = [];
        const N = (rows + 1) * (cols + 1);
        for (const side of [0, 1]) {
            for (let i = 0; i <= rows; i++) for (let j = 0; j <= cols; j++) {
                const p = at(i / rows, j / cols);
                pos.push(p.x + off.x * side, p.y + off.y * side, p.z + off.z * side);
                uvs.push(i / rows, j / cols);
            }
        }
        const T = (i, j) => i * (cols + 1) + j;
        const B = (i, j) => N + T(i, j);
        for (let i = 0; i < rows; i++) for (let j = 0; j < cols; j++) {
            idx.push(T(i, j), T(i + 1, j), T(i, j + 1), T(i, j + 1), T(i + 1, j), T(i + 1, j + 1));
            idx.push(B(i, j), B(i, j + 1), B(i + 1, j), B(i, j + 1), B(i + 1, j + 1), B(i + 1, j));
        }
        const loop = [];
        for (let j = 0; j < cols; j++) loop.push([0, j]);
        for (let i = 0; i < rows; i++) loop.push([i, cols]);
        for (let j = cols; j > 0; j--) loop.push([rows, j]);
        for (let i = rows; i > 0; i--) loop.push([i, 0]);
        for (let k = 0; k < loop.length; k++) {
            const a = loop[k], b = loop[(k + 1) % loop.length];
            idx.push(T(a[0], a[1]), B(a[0], a[1]), T(b[0], b[1]));
            idx.push(T(b[0], b[1]), B(a[0], a[1]), B(b[0], b[1]));
        }
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
        g.setIndex(idx);
        g.computeVertexNormals();
        return g;
    }

    const UP = new THREE.Vector3(0, 1, 0);

    function rod(a, b, radius, segments = 10) {
        const dir = new THREE.Vector3().subVectors(b, a);
        const length = dir.length();
        const g = new THREE.CylinderGeometry(radius, radius, length, segments, 1);
        const m = new THREE.Matrix4().compose(
            new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5),
            new THREE.Quaternion().setFromUnitVectors(UP, dir.normalize()),
            new THREE.Vector3(1, 1, 1));
        g.applyMatrix4(m);
        return g;
    }

    const knuckle = (p, r) => new THREE.SphereGeometry(r, 10, 7).translate(p.x, p.y, p.z);

    /* ---- surfaces --------------------------------------------------------- */

    // Polypropylene does not shine and it does not stay clean. The map is
    // mostly scuff: a chair with an even surface reads as plastic-in-a-render.
    const shellTex = paint(512, 512, (g, cv) => {
        const s = cv.width;
        g.fillStyle = '#2f6fb0'; g.fillRect(0, 0, s, s);
        for (let i = 0; i < 900; i++) {   // moulding speckle
            g.fillStyle = `rgba(${rnd() > 0.5 ? '255,255,255' : '10,30,60'},${rr(0.02, 0.09)})`;
            g.fillRect(rr(0, s), rr(0, s), rr(1, 3), rr(1, 3));
        }
        for (let i = 0; i < 130; i++) {   // scuffs, mostly along the edges
            const edge = rnd() > 0.45;
            const x = edge ? (rnd() > 0.5 ? rr(0, s * 0.13) : rr(s * 0.87, s)) : rr(0, s);
            const y = rr(0, s), a = rr(0, Math.PI);
            const len = rr(6, 52);
            g.strokeStyle = `rgba(214,228,242,${rr(0.05, 0.22)})`;
            g.lineWidth = rr(0.6, 2.4);
            g.beginPath(); g.moveTo(x, y);
            g.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len);
            g.stroke();
        }
        // A moulded size mark, worn nearly away, and one shoe print of grime.
        g.fillStyle = 'rgba(16,40,72,0.35)';
        g.font = 'bold 44px sans-serif';
        g.fillText('4', s * 0.5, s * 0.86);
        const grime = g.createRadialGradient(s * 0.3, s * 0.24, 4, s * 0.3, s * 0.24, s * 0.2);
        grime.addColorStop(0, 'rgba(20,26,32,0.30)');
        grime.addColorStop(1, 'rgba(20,26,32,0)');
        g.fillStyle = grime; g.fillRect(0, 0, s, s);
    });

    const steelTex = paint(64, 256, (g, cv) => {
        const w = cv.width, h = cv.height;
        g.fillStyle = '#a4abb2'; g.fillRect(0, 0, w, h);
        for (let i = 0; i < 180; i++) {
            g.fillStyle = `rgba(${rnd() > 0.5 ? '216,222,228' : '112,118,126'},${rr(0.05, 0.28)})`;
            g.fillRect(rr(0, w), rr(0, h), rr(1, 3), rr(6, 70));
        }
        for (let i = 0; i < 20; i++) {
            g.fillStyle = rnd() > 0.65 ? 'rgba(128,76,44,0.45)' : 'rgba(236,242,248,0.5)';
            g.beginPath(); g.ellipse(rr(0, w), rr(0, h), rr(1, 4), rr(1, 5), rr(0, 3), 0, Math.PI * 2); g.fill();
        }
    });
    if (steelTex) { steelTex.wrapS = steelTex.wrapT = THREE.RepeatWrapping; steelTex.repeat.set(1, 2); }

    const shellMat = new THREE.MeshStandardMaterial({
        map: shellTex, color: 0xffffff, roughness: 0.62, metalness: 0.0,
        side: THREE.DoubleSide,
    });
    const steelMat = new THREE.MeshStandardMaterial({
        map: steelTex, color: 0xc2c9cf, roughness: 0.4, metalness: 0.85,
    });
    const glideMat = new THREE.MeshStandardMaterial({ color: 0x1d2024, roughness: 0.9 });

    /* ---- the seat --------------------------------------------------------- */

    const SEAT_Y = 0.44;

    const seat = new THREE.Mesh(shellGeometry(14, 14, (u, v) => {
        // u across the seat, v from the back edge (0) to the front lip (1).
        const halfWidth = (0.192 + 0.022 * v) * (1 - 0.14 * smooth(0.86, 1, v));
        const x = (u - 0.5) * 2 * halfWidth;
        const z = -0.185 + v * 0.375;
        // A dish to sit in, sides turned up, and the front edge falling away
        // so the underside of a knee has somewhere to go.
        const dish = -0.021 * Math.sin(Math.PI * u) * Math.sin(Math.PI * Math.min(1, v * 1.05));
        const sides = 0.014 * Math.pow(Math.abs(u - 0.5) * 2, 4);
        const waterfall = -0.055 * smooth(0.78, 1.0, v);
        const backLift = 0.010 * smooth(0.2, 0, v);
        return V(x, SEAT_Y + dish + sides + waterfall + backLift, z);
    }, V(0, -0.009, 0)), shellMat);
    seat.castShadow = true; seat.receiveShadow = true;
    group.add(seat);

    /* ---- the back --------------------------------------------------------- */

    const back = new THREE.Mesh(shellGeometry(12, 14, (u, v) => {
        // v runs bottom (0) to top (1) of the back panel.
        const waist = 0.150 + 0.030 * Math.sin(Math.PI * Math.min(1, v * 0.95));
        const shoulders = 1 - 0.30 * smooth(0.74, 1.0, v) - 0.14 * smooth(0.16, 0, v);
        const halfWidth = waist * shoulders;
        const x = (u - 0.5) * 2 * halfWidth;
        const y = 0.525 + v * 0.315;
        // Leaning back, and wrapped so the sides come forward around a spine.
        const lean = -0.055 * v;
        const wrap = 0.055 * (1 - Math.cos((u - 0.5) * 1.9));
        return V(x, y, -0.205 + lean + wrap);
    }, V(0, 0, -0.011)), shellMat);
    back.castShadow = true;
    // Somebody leaned back on it for a decade and it never came home square.
    back.rotation.y = -0.008;
    group.add(back);

    /* ---- the frame -------------------------------------------------------- */

    const TR = 0.0115;
    const steel = [];
    for (const sx of [-1, 1]) {
        const footFront = V(sx * 0.195, 0.018, 0.175);
        const footBack = V(sx * 0.185, 0.018, -0.165);
        const seatFront = V(sx * 0.198, SEAT_Y - 0.012, 0.135);
        const seatBack = V(sx * 0.191, SEAT_Y - 0.012, -0.155);
        // The back leg does not stop at the seat: it keeps going and becomes
        // the back support, which is the whole trick of a stacking chair.
        const backTop = V(sx * 0.135, 0.815, -0.253);
        steel.push(rod(footFront, seatFront, TR), rod(footBack, seatBack, TR));
        steel.push(rod(seatFront, seatBack, TR));
        steel.push(rod(seatBack, backTop, TR));
        steel.push(knuckle(seatFront, TR), knuckle(seatBack, TR));
    }
    // Cross members: one under the front of the seat, one low stretcher, and
    // the rail that pins the top of the back.
    steel.push(rod(V(-0.198, SEAT_Y - 0.012, 0.12), V(0.198, SEAT_Y - 0.012, 0.12), TR));
    steel.push(rod(V(-0.19, 0.185, -0.155), V(0.19, 0.185, -0.155), TR * 0.9));
    steel.push(rod(V(-0.135, 0.80, -0.251), V(0.135, 0.80, -0.251), TR * 0.9));
    // Stacking bumpers, so chairs on chairs do not chew each other's paint.
    for (const sx of [-1, 1]) steel.push(knuckle(V(sx * 0.198, SEAT_Y - 0.03, 0.06), 0.013));
    const frame = new THREE.Mesh(merge(steel), steelMat);
    frame.castShadow = true; frame.receiveShadow = true;
    group.add(frame);

    /* ---- glides ----------------------------------------------------------- */

    // Three of the four are still there. The fourth leg has been walking on
    // bare tube long enough to have worn a facet on it.
    const glides = [];
    const feet = [[-1, 0.175], [1, 0.175], [-1, -0.165]];
    for (const [sx, z] of feet) {
        const x = sx * (z > 0 ? 0.195 : 0.185);
        glides.push(new THREE.CylinderGeometry(0.014, 0.017, 0.02, 12).translate(x, 0.01, z));
    }
    const glideMesh = new THREE.Mesh(merge(glides), glideMat);
    glideMesh.receiveShadow = true;
    group.add(glideMesh);

    group.name = 'school-chair';
    return group;
}
