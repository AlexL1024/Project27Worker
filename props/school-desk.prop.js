//
//  school-desk.prop.js
//  Project27 object library
//
//  One student desk: a beech laminate top on a bent steel tube frame, with a
//  wire book basket slung underneath and somebody's gum on the far corner.
//
//  The gum, the biro scribble and the initials scratched into the laminate are
//  the whole point of hand-writing this one. A desk modelled honestly is a box
//  on four legs, and a box on four legs is what makes a generated classroom
//  look generated. The wear is what makes it a school desk rather than a desk.
//
//  Origin at the floor, centred, front to +Z. Top surface at 0.75 m.
//

import { mergeGeometries } from './BufferGeometryUtils.js';

export default function build(THREE, helpers) {
    const group = new THREE.Group();

    // Deterministic: the same desk every time it is placed, so a room full of
    // them can be varied by the world rather than by luck.
    let seed = 8811;
    const rnd = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
    const rr = (a, b) => a + (b - a) * rnd();

    const paint = (w, h, draw) => (helpers && helpers.canvasTexture ? helpers.canvasTexture(w, h, draw) : null);

    const W = 0.66, D = 0.48, TOP = 0.75, THICK = 0.024;

    /* ---- geometry helpers ------------------------------------------------ */

    /** A rounded rectangle in the XY plane, ready to extrude. */
    function roundedRect(w, d, r) {
        const s = new THREE.Shape();
        const x = w / 2, z = d / 2;
        s.moveTo(-x + r, -z);
        s.lineTo(x - r, -z); s.quadraticCurveTo(x, -z, x, -z + r);
        s.lineTo(x, z - r); s.quadraticCurveTo(x, z, x - r, z);
        s.lineTo(-x + r, z); s.quadraticCurveTo(-x, z, -x, z - r);
        s.lineTo(-x, -z + r); s.quadraticCurveTo(-x, -z, -x + r, -z);
        return s;
    }

    /** A slab: the rounded rectangle laid flat, its top face at y. */
    function slab(w, d, r, thickness, y) {
        const g = new THREE.ExtrudeGeometry(roundedRect(w, d, r), {
            depth: thickness, bevelEnabled: false, curveSegments: 5,
        });
        g.rotateX(-Math.PI / 2);
        g.translate(0, y, 0);
        return g;
    }

    const UP = new THREE.Vector3(0, 1, 0);
    const scratchQ = new THREE.Quaternion();
    const scratchM = new THREE.Matrix4();
    const scratchV = new THREE.Vector3();

    /** A length of tube running from a to b — every steel part here is one. */
    function rod(a, b, radius, segments = 10) {
        const dir = scratchV.subVectors(b, a);
        const length = dir.length();
        const g = new THREE.CylinderGeometry(radius, radius, length, segments, 1);
        scratchQ.setFromUnitVectors(UP, dir.clone().normalize());
        scratchM.compose(
            new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5),
            scratchQ, new THREE.Vector3(1, 1, 1));
        g.applyMatrix4(scratchM);
        return g;
    }

    /** The weld at a bend, so a corner is not two tubes ending in mid-air. */
    function knuckle(p, radius) {
        return new THREE.SphereGeometry(radius, 10, 7).translate(p.x, p.y, p.z);
    }

    const V = (x, y, z) => new THREE.Vector3(x, y, z);

    // mergeGeometries answers null on a list that mixes indexed and non-indexed
    // geometry, and a null geometry is a mesh that kills the viewport.
    const merge = (parts) => mergeGeometries(parts.map((g) => (g.index ? g.toNonIndexed() : g)));

    /* ---- surfaces --------------------------------------------------------- */

    const laminateTex = paint(512, 384, (g, cv) => {
        const w = cv.width, h = cv.height;
        g.fillStyle = '#cfa972'; g.fillRect(0, 0, w, h);
        // Beech: long pale grain with the occasional darker ray.
        for (let i = 0; i < 260; i++) {
            const y = rr(0, h);
            g.strokeStyle = `rgba(${rnd() > 0.35 ? '226,196,150' : '150,112,66'},${rr(0.08, 0.4)})`;
            g.lineWidth = rr(0.6, 3.2);
            g.beginPath(); g.moveTo(-10, y);
            let py = y;
            for (let x = 0; x < w + 20; x += 26) { py += rr(-2.6, 2.6); g.lineTo(x, py); }
            g.stroke();
        }
        for (let i = 0; i < 14; i++) {   // knots and darker figure
            const x = rr(0, w), y = rr(0, h);
            const grad = g.createRadialGradient(x, y, 1, x, y, rr(8, 26));
            grad.addColorStop(0, 'rgba(120,84,44,0.55)');
            grad.addColorStop(1, 'rgba(120,84,44,0)');
            g.fillStyle = grad; g.fillRect(x - 30, y - 30, 60, 60);
        }
        // Years of biro. Loops, not lines — a bored hand draws in circles.
        g.strokeStyle = 'rgba(28,44,120,0.5)'; g.lineWidth = 1.6;
        for (let s = 0; s < 5; s++) {
            const cx = rr(60, w - 60), cy = rr(50, h - 50);
            g.beginPath();
            for (let t = 0; t < 40; t++) {
                const a = t * 0.55, rad = 3 + t * rr(0.5, 0.8);
                const px = cx + Math.cos(a) * rad * 0.8, py = cy + Math.sin(a) * rad * 0.45;
                t ? g.lineTo(px, py) : g.moveTo(px, py);
            }
            g.stroke();
        }
        // Initials, scratched rather than drawn: the laminate under is white.
        g.strokeStyle = 'rgba(250,246,238,0.75)'; g.lineWidth = 2.2;
        const ix = w * 0.68, iy = h * 0.63, sz = 26;
        g.beginPath();
        g.moveTo(ix, iy + sz); g.lineTo(ix + sz * 0.4, iy); g.lineTo(ix + sz * 0.8, iy + sz);
        g.moveTo(ix + sz * 0.16, iy + sz * 0.62); g.lineTo(ix + sz * 0.64, iy + sz * 0.62);
        g.moveTo(ix + sz * 1.1, iy); g.lineTo(ix + sz * 1.1, iy + sz); g.lineTo(ix + sz * 1.6, iy + sz);
        g.stroke();
        // Hairline scratches everywhere, from ten thousand pencil cases.
        for (let i = 0; i < 300; i++) {
            const x = rr(0, w), y = rr(0, h), a = rr(0, Math.PI);
            const len = rr(4, 34);
            g.strokeStyle = `rgba(255,250,240,${rr(0.04, 0.16)})`;
            g.lineWidth = rr(0.5, 1.2);
            g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len); g.stroke();
        }
        // One ring from a drink that should not have been on the desk.
        g.strokeStyle = 'rgba(96,64,30,0.28)'; g.lineWidth = 3;
        g.beginPath(); g.arc(w * 0.24, h * 0.34, 30, 0, Math.PI * 2); g.stroke();
    });
    if (laminateTex) {
        // The extrude UVs come out in metres of shape space, so the map is
        // scaled to cover the top once rather than tiling forty times.
        laminateTex.repeat.set(1 / W, 1 / D);
        laminateTex.offset.set(0.5, 0.5);
    }

    const steelTex = paint(64, 256, (g, cv) => {
        const w = cv.width, h = cv.height;
        g.fillStyle = '#9aa1a8'; g.fillRect(0, 0, w, h);
        for (let i = 0; i < 200; i++) {
            g.fillStyle = `rgba(${rnd() > 0.5 ? '210,216,222' : '110,116,124'},${rr(0.05, 0.3)})`;
            g.fillRect(rr(0, w), rr(0, h), rr(1, 3), rr(6, 60));
        }
        for (let i = 0; i < 26; i++) {   // chips down to bare metal, and rust
            const x = rr(0, w), y = rr(0, h);
            g.fillStyle = rnd() > 0.6 ? 'rgba(126,74,42,0.5)' : 'rgba(232,238,244,0.55)';
            g.beginPath(); g.ellipse(x, y, rr(1, 4), rr(1, 5), rr(0, 3), 0, Math.PI * 2); g.fill();
        }
    });
    if (steelTex) { steelTex.wrapS = steelTex.wrapT = THREE.RepeatWrapping; steelTex.repeat.set(1, 2); }

    const laminateMat = new THREE.MeshStandardMaterial({
        map: laminateTex, color: 0xffffff, roughness: 0.42, metalness: 0.0,
    });
    const bandMat = new THREE.MeshStandardMaterial({ color: 0x3a3f44, roughness: 0.7 });
    const steelMat = new THREE.MeshStandardMaterial({
        map: steelTex, color: 0xbfc6cc, roughness: 0.44, metalness: 0.85,
    });
    const plasticMat = new THREE.MeshStandardMaterial({ color: 0x22252a, roughness: 0.85 });

    /* ---- the top ---------------------------------------------------------- */

    // Band first, laminate proud of it by a hair: that thin dark edge is what
    // says "school furniture" from across a room.
    const band = new THREE.Mesh(slab(W, D, 0.03, THICK, TOP - THICK), bandMat);
    band.castShadow = true; band.receiveShadow = true;

    const top = new THREE.Mesh(
        slab(W - 0.007, D - 0.007, 0.028, THICK + 0.0016, TOP - THICK - 0.0008), laminateMat);
    top.castShadow = true; top.receiveShadow = true;

    // The whole top sits a degree out of true on its frame, because they all do.
    const topGroup = new THREE.Group();
    topGroup.add(band, top);
    topGroup.rotation.y = 0.011;
    group.add(topGroup);

    /* ---- the frame -------------------------------------------------------- */

    const TR = 0.014;                       // 28 mm tube
    const RAIL_Y = TOP - THICK - 0.028;
    const steel = [];
    for (const sx of [-1, 1]) {
        const x = sx * 0.275;
        const footFront = V(x * 1.09, 0.02, 0.205);
        const footBack = V(x * 1.09, 0.02, -0.205);
        const kneeFront = V(x, RAIL_Y, 0.185);
        const kneeBack = V(x, RAIL_Y, -0.185);
        steel.push(rod(footFront, kneeFront, TR), rod(footBack, kneeBack, TR));
        steel.push(rod(kneeFront, kneeBack, TR));
        steel.push(knuckle(kneeFront, TR), knuckle(kneeBack, TR));
        // The rail that actually carries the top, set in from the side frame.
        steel.push(rod(V(x, RAIL_Y, 0.16), V(-x, RAIL_Y, 0.16), TR * 0.85));
    }
    // One low stretcher, and the two hangers the basket swings from.
    steel.push(rod(V(-0.29, 0.20, -0.19), V(0.29, 0.20, -0.19), TR * 0.85));
    steel.push(rod(V(-0.27, RAIL_Y, -0.16), V(0.27, RAIL_Y, -0.16), TR * 0.85));
    const frame = new THREE.Mesh(merge(steel), steelMat);
    frame.castShadow = true; frame.receiveShadow = true;
    group.add(frame);

    /* ---- the wire basket -------------------------------------------------- */

    const WIRE = 0.0035, BY = 0.56, BZ = 0.165, BX = 0.255;
    const wires = [];
    for (let i = 0; i <= 8; i++) {
        const x = -BX + (2 * BX) * (i / 8);
        wires.push(rod(V(x, BY, -BZ), V(x, BY, BZ), WIRE, 6));
    }
    for (const z of [-BZ, -BZ * 0.4, BZ * 0.4, BZ]) {
        wires.push(rod(V(-BX, BY - 0.004, z), V(BX, BY - 0.004, z), WIRE, 6));
    }
    // A shallow lip, so books stay in when the desk is dragged.
    for (const z of [-BZ, BZ]) {
        wires.push(rod(V(-BX, BY, z), V(-BX, BY + 0.055, z), WIRE, 6));
        wires.push(rod(V(BX, BY, z), V(BX, BY + 0.055, z), WIRE, 6));
        wires.push(rod(V(-BX, BY + 0.055, z), V(BX, BY + 0.055, z), WIRE, 6));
    }
    for (const sx of [-1, 1]) {
        wires.push(rod(V(sx * BX, BY, -BZ), V(sx * BX, BY + 0.055, BZ), WIRE, 6));
        wires.push(rod(V(sx * (BX - 0.01), BY + 0.05, 0), V(sx * 0.272, RAIL_Y - 0.01, -0.16), WIRE, 6));
    }
    const basket = new THREE.Mesh(merge(wires), steelMat);
    basket.castShadow = true;
    // Something heavy went in it once and it never came back square.
    basket.rotation.z = -0.012;
    group.add(basket);

    /* ---- feet ------------------------------------------------------------- */

    const glides = [];
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
        const h = sx * sz > 0 ? 0.022 : 0.017;   // one pair worn flatter than the other
        glides.push(new THREE.CylinderGeometry(0.019, 0.021, h, 12)
            .translate(sx * 0.30, h / 2, sz * 0.205));
    }
    const feet = new THREE.Mesh(merge(glides), plasticMat);
    feet.receiveShadow = true;
    group.add(feet);

    /* ---- the things that make it somebody's ------------------------------- */

    const stickerTex = paint(128, 128, (g, cv) => {
        const s = cv.width;
        g.fillStyle = '#e8452f'; g.beginPath(); g.arc(s / 2, s / 2, s * 0.46, 0, Math.PI * 2); g.fill();
        g.fillStyle = '#ffe9a8';
        g.beginPath();
        for (let i = 0; i < 10; i++) {
            const a = -Math.PI / 2 + i * Math.PI / 5;
            const rad = i % 2 ? s * 0.14 : s * 0.31;
            const px = s / 2 + Math.cos(a) * rad, py = s / 2 + Math.sin(a) * rad;
            i ? g.lineTo(px, py) : g.moveTo(px, py);
        }
        g.closePath(); g.fill();
        // Half of it has been picked off, the way stickers go.
        g.globalCompositeOperation = 'destination-out';
        g.beginPath(); g.ellipse(s * 0.78, s * 0.35, s * 0.3, s * 0.36, 0.6, 0, Math.PI * 2); g.fill();
        g.globalCompositeOperation = 'source-over';
    });
    const sticker = new THREE.Mesh(
        new THREE.CircleGeometry(0.032, 20).rotateX(-Math.PI / 2),
        new THREE.MeshStandardMaterial({
            map: stickerTex, color: 0xffffff, roughness: 0.35,
            transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2,
        })
    );
    sticker.position.set(-0.19, TOP + 0.0009, 0.128);
    sticker.rotation.y = 0.5;
    topGroup.add(sticker);

    // The gum. Underneath, near the front edge, where a hand goes.
    const gum = new THREE.Mesh(
        new THREE.SphereGeometry(0.016, 8, 6).scale(1, 0.45, 0.9),
        new THREE.MeshStandardMaterial({ color: 0xb0c0d8, roughness: 0.55 })
    );
    gum.position.set(0.16, TOP - THICK - 0.004, 0.19);
    topGroup.add(gum);

    // A bag hook on the near side, bent slightly out of line by a heavy bag.
    const hook = new THREE.Mesh(
        merge([
            rod(V(0.283, 0.62, 0.185), V(0.318, 0.60, 0.20), 0.006, 8),
            rod(V(0.318, 0.60, 0.20), V(0.316, 0.645, 0.212), 0.006, 8),
            knuckle(V(0.318, 0.601, 0.20), 0.006),
        ]),
        steelMat
    );
    hook.castShadow = true;
    group.add(hook);

    group.name = 'school-desk';
    return group;
}
