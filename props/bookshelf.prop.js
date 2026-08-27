//
//  bookshelf.prop.js
//  Project27 object library
//
//  A five-bay classroom bookcase, 1.82 m tall and 0.90 m wide, in the beech
//  veneer every school buys, with about two hundred books in it.
//
//  All of those books are one mesh. They are boxes of different sizes leaning
//  at different angles with a colour baked into each one's vertices, merged
//  into a single geometry — which is the only way a shelf can be full without
//  a shelf costing two hundred draw calls. The gaps, the leaners and the
//  stacks lying flat on their sides are what stop a full shelf reading as a
//  striped wall.
//
//  Origin at the floor, centred, open front toward +Z.
//

import { mergeGeometries } from './BufferGeometryUtils.js';

export default function build(THREE, helpers) {
    const group = new THREE.Group();

    let seed = 55021;
    const rnd = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
    const rr = (a, b) => a + (b - a) * rnd();
    const pick = (list) => list[Math.min(list.length - 1, Math.floor(rnd() * list.length))];

    const paint = (w, h, draw) => (helpers && helpers.canvasTexture ? helpers.canvasTexture(w, h, draw) : null);
    const merge = (parts) => mergeGeometries(parts.map((g) => (g.index ? g.toNonIndexed() : g)));
    const box = (w, h, d, x, y, z) => new THREE.BoxGeometry(w, h, d).translate(x, y, z);

    /** Bakes one flat colour into a geometry, so a hundred books can share a mesh. */
    function tint(geometry, colour) {
        const c = new THREE.Color(colour);
        const n = geometry.attributes.position.count;
        const data = new Float32Array(n * 3);
        for (let i = 0; i < n; i++) { data[i * 3] = c.r; data[i * 3 + 1] = c.g; data[i * 3 + 2] = c.b; }
        geometry.setAttribute('color', new THREE.Float32BufferAttribute(data, 3));
        return geometry;
    }

    const W = 0.90, D = 0.30, H = 1.82, T = 0.018;
    const BAYS = [0.10, 0.435, 0.755, 1.075, 1.395];   // the underside of each bay
    const BAY_TOP = [0.415, 0.735, 1.055, 1.375, 1.79];

    /* ---- surfaces ---------------------------------------------------------- */

    const veneerTex = paint(512, 512, (g, cv) => {
        const s = cv.width;
        g.fillStyle = '#c9a978'; g.fillRect(0, 0, s, s);
        for (let i = 0; i < 320; i++) {
            const y = rr(0, s);
            g.strokeStyle = `rgba(${rnd() > 0.4 ? '224,197,152' : '146,110,66'},${rr(0.08, 0.36)})`;
            g.lineWidth = rr(0.6, 3.4);
            g.beginPath(); g.moveTo(-10, y);
            let py = y;
            for (let x = 0; x < s + 20; x += 30) { py += rr(-3, 3); g.lineTo(x, py); }
            g.stroke();
        }
        for (let i = 0; i < 10; i++) {
            const x = rr(0, s), y = rr(0, s);
            const knot = g.createRadialGradient(x, y, 1, x, y, rr(10, 30));
            knot.addColorStop(0, 'rgba(112,76,40,0.5)');
            knot.addColorStop(1, 'rgba(112,76,40,0)');
            g.fillStyle = knot; g.fillRect(x - 34, y - 34, 68, 68);
        }
        // The wear a shelf edge gets: pale, only along one band.
        g.fillStyle = 'rgba(246,236,214,0.30)';
        g.fillRect(0, s * 0.46, s, 26);
    });
    if (veneerTex) { veneerTex.wrapS = veneerTex.wrapT = THREE.RepeatWrapping; }

    // Book cloth, seen mostly edge-on: paper tooth, two gilt rules near the
    // head of the spine, and a lighter block where a label was peeled off.
    const clothTex = paint(256, 256, (g, cv) => {
        const s = cv.width;
        g.fillStyle = '#ffffff'; g.fillRect(0, 0, s, s);
        for (let i = 0; i < 2200; i++) {
            g.fillStyle = `rgba(${rnd() > 0.5 ? '255,255,255' : '96,92,88'},${rr(0.03, 0.16)})`;
            g.fillRect(rr(0, s), rr(0, s), rr(1, 3), rr(1, 3));
        }
        g.fillStyle = 'rgba(255,244,196,0.75)';
        g.fillRect(0, s * 0.12, s, 4);
        g.fillRect(0, s * 0.18, s, 2);
        g.fillStyle = 'rgba(250,250,248,0.55)';
        g.fillRect(s * 0.2, s * 0.66, s * 0.6, s * 0.16);
        // The dark, greasy band where every hand pulls it off the shelf.
        g.fillStyle = 'rgba(40,34,28,0.18)';
        g.fillRect(0, s * 0.88, s, s * 0.12);
    });

    const veneerMat = new THREE.MeshStandardMaterial({
        map: veneerTex, color: 0xffffff, roughness: 0.55, metalness: 0.0,
    });
    const backMat = new THREE.MeshStandardMaterial({ color: 0x8b7150, roughness: 0.9 });
    const bookMat = new THREE.MeshStandardMaterial({
        map: clothTex, vertexColors: true, roughness: 0.78, metalness: 0.0,
    });

    /* ---- the carcass -------------------------------------------------------- */

    const carcass = new THREE.Mesh(merge([
        box(T, H, D, -(W - T) / 2, H / 2, 0),
        box(T, H, D, (W - T) / 2, H / 2, 0),
        box(W, T, D, 0, H - T / 2, 0),
        box(W, T, D, 0, 0.10 - T / 2, 0),
        box(W - 2 * T, 0.10 - T, 0.02, 0, (0.10 - T) / 2, -D / 2 + 0.01),   // plinth rail
    ]), veneerMat);
    carcass.castShadow = true; carcass.receiveShadow = true;
    group.add(carcass);

    const back = new THREE.Mesh(box(W - 2 * T, H - 0.12, 0.006, 0, 0.10 + (H - 0.12) / 2 - 0.005, -D / 2 + 0.006), backMat);
    back.receiveShadow = true;
    group.add(back);

    const shelves = [];
    for (let i = 1; i < BAYS.length; i++) {
        // Each shelf sags a hair in the middle, and the sag is what tells the
        // eye these are 18 mm chipboard rather than stone.
        const g = box(W - 2 * T, T, D - 0.02, 0, BAYS[i] - T / 2, 0.008);
        const pos = g.attributes.position;
        const v = new THREE.Vector3();
        for (let k = 0; k < pos.count; k++) {
            v.fromBufferAttribute(pos, k);
            const t = Math.cos((v.x / (W / 2)) * Math.PI * 0.5);
            pos.setY(k, v.y - 0.004 * t * t);
        }
        pos.needsUpdate = true;
        g.computeVertexNormals();
        shelves.push(g);
    }
    const shelfMesh = new THREE.Mesh(merge(shelves), veneerMat);
    shelfMesh.castShadow = true; shelfMesh.receiveShadow = true;
    group.add(shelfMesh);

    /* ---- the books ---------------------------------------------------------- */

    const SPINES = [
        0x8c2f2a, 0x1f4e79, 0x2e6b3f, 0xb5822c, 0x5b3a72, 0x27506b, 0xa04a24,
        0x35424a, 0xc2733a, 0x1c6b6b, 0x7a2f4a, 0xd0b26a, 0x4a5f2c, 0x93321f,
    ];
    const books = [];
    const INNER = W - 2 * T - 0.012;

    for (let bay = 0; bay < BAYS.length; bay++) {
        const floorY = BAYS[bay];
        const clear = BAY_TOP[bay] - floorY;
        let x = -INNER / 2;
        // Every shelf has one hole in it where a book is out on loan.
        const gapAt = rr(0.25, 0.75);
        let leanRun = 0;

        while (x < INNER / 2 - 0.03) {
            const t = (x + INNER / 2) / INNER;
            if (Math.abs(t - gapAt) < 0.06) { x += 0.075; continue; }

            const thick = rr(0.014, 0.046);
            if (x + thick > INNER / 2) break;
            const height = Math.min(clear - 0.02, rr(0.16, 0.30));
            const depth = Math.min(D - 0.05, rr(0.13, 0.22));

            // Books lean in runs: one goes, the next few follow it over.
            if (leanRun <= 0 && rnd() > 0.86) leanRun = Math.floor(rr(2, 5));
            const lean = leanRun > 0 ? rr(0.10, 0.22) : rr(-0.012, 0.012);
            if (leanRun > 0) leanRun--;

            const g = box(thick, height, depth, 0, height / 2, 0);
            g.rotateZ(-lean);
            // A few are pulled proud of the shelf edge, the way a used book is.
            g.translate(x + thick / 2, floorY + 0.001, D / 2 - depth / 2 - rr(0.005, 0.055));
            books.push(tint(g, pick(SPINES)));
            x += thick + rr(0.0005, 0.004);
        }

        // A short stack lying flat, filling the space the leaners opened up.
        if (rnd() > 0.45) {
            let y = floorY + 0.002;
            const n = Math.floor(rr(2, 5));
            const sx = rr(-INNER / 2 + 0.10, INNER / 2 - 0.22);
            for (let i = 0; i < n; i++) {
                const th = rr(0.016, 0.032);
                const g = box(rr(0.14, 0.19), th, rr(0.15, 0.21), sx, y + th / 2, D / 2 - 0.12 + rr(-0.02, 0.02));
                g.rotateY(rr(-0.09, 0.09));
                books.push(tint(g, pick(SPINES)));
                y += th;
            }
        }
    }

    // On top of the case: a lever-arch file on its side and a leaning stack of
    // exercise books, because the top of a bookcase is where things end up.
    {
        const g = box(0.075, 0.31, 0.26, -0.24, H + 0.155, -0.01);
        g.rotateZ(0.03);
        books.push(tint(g, 0x2b3a4a));
        let y = H + 0.002;
        for (let i = 0; i < 7; i++) {
            const th = rr(0.008, 0.013);
            const g2 = box(rr(0.17, 0.20), th, rr(0.24, 0.26), 0.19 + rr(-0.01, 0.01), y + th / 2, 0.0);
            g2.rotateY(rr(-0.12, 0.12));
            books.push(tint(g2, pick([0xd8cfa8, 0x6f8f5a, 0xc06a3a, 0x4a6f8f])));
            y += th;
        }
    }

    const bookMesh = new THREE.Mesh(merge(books), bookMat);
    bookMesh.castShadow = true; bookMesh.receiveShadow = true;
    group.add(bookMesh);

    /* ---- one mug, left on the top, cold ------------------------------------- */

    const mug = new THREE.Mesh(
        merge([
            new THREE.CylinderGeometry(0.041, 0.036, 0.095, 20, 1, true).translate(0.36, H + 0.048, 0.06),
            new THREE.CircleGeometry(0.036, 20).rotateX(-Math.PI / 2).translate(0.36, H + 0.003, 0.06),
            new THREE.TorusGeometry(0.026, 0.006, 8, 18).rotateY(Math.PI / 2).translate(0.40, H + 0.048, 0.06),
        ]),
        new THREE.MeshStandardMaterial({ color: 0xe7e2d8, roughness: 0.35, side: THREE.DoubleSide })
    );
    mug.castShadow = true;
    group.add(mug);

    const tea = new THREE.Mesh(
        new THREE.CircleGeometry(0.036, 20).rotateX(-Math.PI / 2).translate(0.36, H + 0.055, 0.06),
        new THREE.MeshStandardMaterial({ color: 0x2e1c10, roughness: 0.18, metalness: 0.1 })
    );
    group.add(tea);

    group.name = 'bookshelf';
    return group;
}
