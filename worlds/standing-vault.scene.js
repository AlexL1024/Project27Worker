//
//  standing-vault.scene.js
//  Standing Vault — a deep island-platform cavern with every seat taken out
//
//  One mined cavern, twenty-eight metres wide: a single island platform down
//  the middle, a track either side behind full-height screen doors, a segmental
//  vault of ribbed concrete overhead, and a glazed slot cut through the crown
//  that drops a tilted shaft of daylight onto the platform at chainage -50.
//
//  The brief was to take the seating out. So there is none — not a bench, not a
//  perch, not a leaning rail, not a planter with a rim the right height. What is
//  left is the evidence: paler unweathered rectangles of terrazzo where the
//  benches were bolted down, the studs still standing proud of the floor, a
//  scuff halo where ten thousand pairs of heels rested, and a laminated notice
//  on a stand beside each one. Even the trains standing at the doors are
//  all-standing stock, poles and nothing else.
//
//  Built against the Project27 runtime (build(world)). The app keeps the camera,
//  the loop and the walk; this module only says what is in the cavern.
//
//      z runs the length of the cavern: portals at ±88, mezzanine over +66..+86,
//      daylight slot at -50, trains halt with their centre at z = 0.
//

export default function build(world) {
    const { THREE, scene } = world;

    world.ownsSky(true);
    world.groundLevel(0);
    world.bloom({ strength: 0.42, radius: 0.62, threshold: 0.74 });

    /* ============================================================
       0 · dimensions + small helpers
       ============================================================ */
    const LEN = 176, HALF = LEN / 2;
    const R = 13.9, CY = 1.0;                       // vault radius / centre (crown 14.9)
    const TH0 = 1.470, THL = 3.344;                 // vault arc: springs just below floor
    const SLOT_Z0 = -54, SLOT_Z1 = -46;             // daylight slot in the crown
    const SLOT_A0 = 2.880, SLOT_A1 = 3.403;         // 165°..195°, the crown strip removed
    const PLAT_X = 8.15;                            // platform edge
    const PSD_X = 8.3;                              // screen-door line
    const TRK_X = 9.95;                             // track centre
    const TRENCH = -1.15;                           // top of the track slab
    const DECK_Y = 7.6, DECK_Z0 = 66, DECK_Z1 = 86; // mezzanine
    const ESC_Z0 = 52.6, ESC_Z1 = 66;               // escalator run, bottom to top
    const OCU_X = 4.5, OCU_Z = -50;                 // where the daylight lands
    const CAR = 20, NCAR = 6;                       // 6 cars of 20 m
    const SPINE_Y = 8.6;

    const DOOR_Z = [];
    for (let i = 0; i < NCAR; i++) {
        const c = (i - (NCAR - 1) / 2) * CAR;
        for (const o of [-6.5, 0, 6.5]) DOOR_Z.push(c + o);
    }

    const uTime = { value: 0 };

    const tex = (w, h, draw, rx, ry) => {
        const t = world.canvasTexture(w, h, (ctx, cv) => draw(ctx, cv.width, cv.height));
        if (rx || ry) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx || 1, ry || 1); }
        return t;
    };

    /** A canvas texture the world keeps a handle on, so a frame can redraw it. */
    function liveTex(w, h, draw) {
        let canvas = null;
        const t = world.canvasTexture(w, h, (ctx, cv) => { canvas = cv; draw(ctx, cv.width, cv.height, 0); });
        return {
            tex: t,
            redraw(time) {
                if (!canvas) return;
                draw(canvas.getContext('2d'), canvas.width, canvas.height, time);
                t.needsUpdate = true;
            }
        };
    }

    const M = (x, y, z, rx, ry, rz) => {
        const m = new THREE.Matrix4();
        m.compose(new THREE.Vector3(x, y, z),
            new THREE.Quaternion().setFromEuler(new THREE.Euler(rx || 0, ry || 0, rz || 0)),
            new THREE.Vector3(1, 1, 1));
        return m;
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
        out.computeBoundingSphere();
        return out;
    }
    const mesh = (items, mat) => new THREE.Mesh(mergeGeos(items), mat);

    /* ============================================================
       1 · textures
       ============================================================ */
    // board-marked cavern concrete, pale limestone-grey
    const concreteTex = tex(512, 512, (ctx, w, h) => {
        ctx.fillStyle = '#b4b1a9'; ctx.fillRect(0, 0, w, h);
        for (let i = 0; i < 240; i++) {
            const x = Math.random() * w, y = Math.random() * h, r = 14 + Math.random() * 62;
            const g = ctx.createRadialGradient(x, y, 0, x, y, r);
            const tone = Math.random() < 0.5 ? '150,147,139' : '196,193,185';
            g.addColorStop(0, `rgba(${tone},${0.05 + Math.random() * 0.09})`);
            g.addColorStop(1, `rgba(${tone},0)`);
            ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
        }
        for (let y = 0; y < h; y += 64) {                 // board marks
            ctx.fillStyle = 'rgba(126,123,115,0.20)'; ctx.fillRect(0, y, w, 2);
            ctx.fillStyle = 'rgba(226,223,214,0.14)'; ctx.fillRect(0, y + 2, w, 2);
        }
        for (let i = 0; i < 2400; i++) {
            ctx.fillStyle = `rgba(${Math.random() < 0.5 ? '128,125,117' : '224,221,213'},${Math.random() * 0.13})`;
            ctx.fillRect(Math.random() * w, Math.random() * h, 1.4, 1.4);
        }
        for (let i = 0; i < 26; i++) {                    // tie-bolt plugs
            const x = 32 + Math.floor(Math.random() * 8) * 64, y = 32 + Math.floor(Math.random() * 8) * 64;
            ctx.fillStyle = 'rgba(140,137,129,0.5)';
            ctx.beginPath(); ctx.arc(x, y, 4, 0, 7); ctx.fill();
        }
    }, 8, 26);

    const pierTex = concreteTex.clone(); pierTex.repeat.set(4, 4); pierTex.needsUpdate = true;

    // platform terrazzo: grey-green chips, 2.3 m joint grid
    const floorTex = tex(512, 512, (ctx, w, h) => {
        ctx.fillStyle = '#9a9c96'; ctx.fillRect(0, 0, w, h);
        const chips = ['#6f7a72', '#c3c6bf', '#7d7f79', '#adb2a8', '#5c625d', '#d3d5cd'];
        for (let i = 0; i < 5200; i++) {
            ctx.fillStyle = chips[Math.floor(Math.random() * chips.length)];
            ctx.globalAlpha = 0.35 + Math.random() * 0.45;
            const x = Math.random() * w, y = Math.random() * h, r = 1 + Math.random() * 4;
            ctx.beginPath(); ctx.ellipse(x, y, r, r * (0.5 + Math.random() * 0.6), Math.random() * 3, 0, 7); ctx.fill();
        }
        ctx.globalAlpha = 1;
        ctx.strokeStyle = 'rgba(108,110,105,0.55)'; ctx.lineWidth = 2.5;
        for (const i of [0, 0.5, 1]) {
            ctx.beginPath(); ctx.moveTo(i * w, 0); ctx.lineTo(i * w, h); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(0, i * h); ctx.lineTo(w, i * h); ctx.stroke();
        }
    }, 7, 76);

    // the same terrazzo, unweathered — what was under a bench for fifteen years
    const patchTex = tex(256, 256, (ctx, w, h) => {
        ctx.clearRect(0, 0, w, h);
        ctx.fillStyle = 'rgba(216,218,210,0.55)';                 // paler, unpolished
        ctx.fillRect(16, 12, w - 32, h - 24);
        const g = ctx.createRadialGradient(w / 2, h / 2, w * 0.32, w / 2, h / 2, w * 0.62);
        g.addColorStop(0, 'rgba(96,94,88,0.0)');
        g.addColorStop(0.6, 'rgba(96,94,88,0.16)');               // scuff halo of heels
        g.addColorStop(1, 'rgba(96,94,88,0.0)');
        ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = 'rgba(120,118,110,0.45)'; ctx.lineWidth = 2;
        ctx.strokeRect(16, 12, w - 32, h - 24);
        for (const [bx, by] of [[52, 46], [w - 52, 46], [52, h - 46], [w - 52, h - 46], [w / 2, 46], [w / 2, h - 46]]) {
            ctx.fillStyle = 'rgba(66,64,60,0.75)';                // drilled fixing holes, filled
            ctx.beginPath(); ctx.arc(bx, by, 7, 0, 7); ctx.fill();
            ctx.fillStyle = 'rgba(178,176,168,0.7)';
            ctx.beginPath(); ctx.arc(bx, by, 3.4, 0, 7); ctx.fill();
        }
    });

    // yellow tactile paving strip
    const tactileTex = tex(128, 128, (ctx, w, h) => {
        ctx.fillStyle = '#8d8a82'; ctx.fillRect(0, 0, w, h);
        for (let x = 8; x < w; x += 21) for (let y = 8; y < h; y += 21) {
            ctx.fillStyle = 'rgba(60,58,54,0.55)';
            ctx.beginPath(); ctx.arc(x + 1, y + 1, 6, 0, 7); ctx.fill();
            ctx.fillStyle = '#a4a099';
            ctx.beginPath(); ctx.arc(x, y, 6, 0, 7); ctx.fill();
        }
    }, 1, 90);

    // track bed seen from the platform: sleepers on a concrete slab
    const trackTex = tex(256, 256, (ctx, w, h) => {
        ctx.fillStyle = '#3a3b3c'; ctx.fillRect(0, 0, w, h);
        for (let i = 0; i < 1800; i++) {
            ctx.fillStyle = `rgba(${Math.random() < 0.5 ? '24,24,25' : '84,84,86'},${Math.random() * 0.5})`;
            ctx.fillRect(Math.random() * w, Math.random() * h, 2, 2);
        }
        for (let y = 0; y < h; y += 32) {
            ctx.fillStyle = '#4c4d4e'; ctx.fillRect(0, y, w, 13);
            ctx.fillStyle = 'rgba(20,20,21,0.45)'; ctx.fillRect(0, y + 13, w, 3);
        }
    }, 2, 88);

    // escalator treads — cleated aluminium, scrolled every frame
    const stepTex = tex(128, 128, (ctx, w, h) => {
        ctx.fillStyle = '#8f9295'; ctx.fillRect(0, 0, w, h);
        for (let x = 2; x < w; x += 7) {
            ctx.fillStyle = '#a8abae'; ctx.fillRect(x, 0, 3, h);
            ctx.fillStyle = '#6b6e71'; ctx.fillRect(x + 3, 0, 2, h);
        }
        ctx.fillStyle = '#26282a'; ctx.fillRect(0, 0, w, 7);          // tread nosing shadow
        ctx.fillStyle = '#F2C230'; ctx.fillRect(0, 7, w, 3);          // yellow demarcation
        ctx.fillStyle = 'rgba(20,21,22,0.35)'; ctx.fillRect(0, h - 4, w, 4);
    }, 1, 1);
    stepTex.wrapS = stepTex.wrapT = THREE.RepeatWrapping;

    const handTex = tex(64, 64, (ctx, w, h) => {
        ctx.fillStyle = '#1c1d1f'; ctx.fillRect(0, 0, w, h);
        for (let y = 0; y < h; y += 16) {
            ctx.fillStyle = 'rgba(120,124,128,0.30)'; ctx.fillRect(0, y, w, 2);
        }
    }, 1, 1);
    handTex.wrapS = handTex.wrapT = THREE.RepeatWrapping;

    // glazed brick for the lift core and the back of the exit lobby
    const brickTex = tex(512, 512, (ctx, w, h) => {
        ctx.fillStyle = '#20262a'; ctx.fillRect(0, 0, w, h);
        const bh = 32, bw = 128;
        for (let r = 0, y = 0; y < h; y += bh, r++) {
            for (let x = (r % 2) * -bw / 2; x < w; x += bw) {
                const v = 34 + Math.floor(Math.random() * 22);
                ctx.fillStyle = `rgb(${v - 6},${v + 6},${v + 10})`;
                ctx.fillRect(x + 2, y + 2, bw - 4, bh - 4);
                const g = ctx.createLinearGradient(x, y, x, y + bh);
                g.addColorStop(0, 'rgba(255,255,255,0.10)');
                g.addColorStop(1, 'rgba(0,0,0,0.16)');
                ctx.fillStyle = g; ctx.fillRect(x + 2, y + 2, bw - 4, bh - 4);
            }
        }
    }, 6, 3);

    // the interior of an all-standing car, seen through its windows
    const carInsideTex = tex(512, 128, (ctx, w, h) => {
        const g = ctx.createLinearGradient(0, 0, 0, h);
        g.addColorStop(0, '#f4efe2'); g.addColorStop(0.55, '#ded8c9'); g.addColorStop(1, '#b9b3a6');
        ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
        for (let x = 26; x < w; x += 52) {                     // stanchions, and nothing to sit on
            ctx.fillStyle = 'rgba(150,152,150,0.9)'; ctx.fillRect(x, 0, 4, h);
            ctx.fillStyle = 'rgba(70,72,72,0.35)'; ctx.fillRect(x + 4, 0, 2, h);
        }
        ctx.fillStyle = 'rgba(40,42,44,0.55)';
        for (let i = 0; i < 16; i++) {                          // standing passengers
            const x = 12 + Math.random() * (w - 24), s = 0.75 + Math.random() * 0.4;
            ctx.beginPath(); ctx.ellipse(x, h * 0.62, 9 * s, 26 * s, 0, 0, 7); ctx.fill();
            ctx.beginPath(); ctx.arc(x, h * 0.62 - 26 * s, 7 * s, 0, 7); ctx.fill();
        }
        ctx.fillStyle = 'rgba(255,252,240,0.35)'; ctx.fillRect(0, 0, w, 10);
    }, 4, 1);

    /* ============================================================
       2 · materials
       ============================================================ */
    const vaultMat = new THREE.MeshStandardMaterial({ map: concreteTex, roughness: 0.95, side: THREE.BackSide });
    const concreteMat = new THREE.MeshStandardMaterial({ map: pierTex, roughness: 0.93 });
    const floorMat = new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.42, metalness: 0.08 });
    const tactileMat = new THREE.MeshStandardMaterial({ map: tactileTex, roughness: 0.85 });
    const darkMetal = new THREE.MeshStandardMaterial({ color: 0x34383b, roughness: 0.48, metalness: 0.45 });
    const bronzeMat = new THREE.MeshStandardMaterial({ color: 0x9c7a44, roughness: 0.34, metalness: 0.82 });
    const steelMat = new THREE.MeshStandardMaterial({ color: 0xb6babd, roughness: 0.4, metalness: 0.5 });
    const blackMat = new THREE.MeshStandardMaterial({ color: 0x121415, roughness: 0.9 });
    const tunnelMat = new THREE.MeshStandardMaterial({ color: 0x17181a, roughness: 0.98, side: THREE.BackSide });
    const railMat = new THREE.MeshStandardMaterial({ color: 0x8b8e90, roughness: 0.3, metalness: 0.75 });
    const trackMat = new THREE.MeshStandardMaterial({ map: trackTex, roughness: 0.95 });
    const brickMat = new THREE.MeshStandardMaterial({ map: brickTex, roughness: 0.28, metalness: 0.12 });
    const glassMat = new THREE.MeshStandardMaterial({
        color: 0xa9b6bb, roughness: 0.06, metalness: 0.3, transparent: true, opacity: 0.24, side: THREE.DoubleSide });
    const psdGlassMat = new THREE.MeshStandardMaterial({
        color: 0x4d585d, roughness: 0.07, metalness: 0.45, transparent: true, opacity: 0.34, side: THREE.DoubleSide });
    const coveMat = new THREE.MeshStandardMaterial({ color: 0x8e8a80, emissive: 0xFFE9C6, emissiveIntensity: 2.4 });
    const spineMat = new THREE.MeshStandardMaterial({ color: 0x9a968c, emissive: 0xFFF3DC, emissiveIntensity: 2.8 });
    const tealMat = new THREE.MeshStandardMaterial({ color: 0x1E8C86, roughness: 0.45, metalness: 0.15,
        emissive: 0x0E6E68, emissiveIntensity: 0.2 });
    const redMat = new THREE.MeshStandardMaterial({ color: 0x9d2b21, roughness: 0.55 });
    const carBodyMat = new THREE.MeshStandardMaterial({ color: 0xc8cbcd, roughness: 0.34, metalness: 0.55 });
    const carDarkMat = new THREE.MeshStandardMaterial({ color: 0x1b1d1f, roughness: 0.55, metalness: 0.3 });
    const carGlassMat = new THREE.MeshStandardMaterial({
        map: carInsideTex, emissive: 0xffffff, emissiveMap: carInsideTex, emissiveIntensity: 0.75, roughness: 0.15 });
    const headMat = new THREE.MeshStandardMaterial({ color: 0x808080, emissive: 0xEAF2FF, emissiveIntensity: 3.2 });
    const tailMat = new THREE.MeshStandardMaterial({ color: 0x552020, emissive: 0xFF3322, emissiveIntensity: 2.2 });

    /* ============================================================
       3 · the shell — vault, floor, trenches, portals
       ============================================================ */
    function vaultSegment(z0, z1, a0, a1) {
        const g = new THREE.CylinderGeometry(R, R, z1 - z0, 80, 1, true, a0, a1 - a0);
        g.rotateX(Math.PI / 2);
        const m = new THREE.Mesh(g, vaultMat);
        m.position.set(0, CY, (z0 + z1) / 2);
        scene.add(m);
        return m;
    }
    vaultSegment(-HALF, SLOT_Z0, TH0, TH0 + THL);
    vaultSegment(SLOT_Z1, HALF, TH0, TH0 + THL);
    // at the daylight slot the crown strip is missing: two flank pieces only
    vaultSegment(SLOT_Z0, SLOT_Z1, TH0, SLOT_A0);
    vaultSegment(SLOT_Z0, SLOT_Z1, SLOT_A1, TH0 + THL);

    const floor = new THREE.Mesh(new THREE.PlaneGeometry(PLAT_X * 2, LEN), floorMat);
    floor.rotation.x = -Math.PI / 2;
    scene.add(world.ground(floor));

    for (const s of [-1, 1]) {
        // tactile warning strip along each platform edge
        const t = new THREE.Mesh(new THREE.PlaneGeometry(0.6, LEN), tactileMat);
        t.rotation.x = -Math.PI / 2;
        t.position.set(s * (PLAT_X - 0.42), 0.012, 0);
        scene.add(world.ghost(t));

        // platform edge face down to the track slab
        const face = new THREE.Mesh(new THREE.BoxGeometry(0.26, 1.2, LEN), concreteMat);
        face.position.set(s * (PLAT_X - 0.13), -0.55, 0);
        scene.add(face);

        // track slab, rails, and the low outer upstand carrying the cable route
        const slab = new THREE.Mesh(new THREE.BoxGeometry(5.0, 0.3, LEN + 56), trackMat);
        slab.position.set(s * 10.7, TRENCH - 0.15, 0);
        scene.add(slab);
        for (const rr of [-0.7175, 0.7175]) {
            const rail = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.18, LEN + 56), railMat);
            rail.position.set(s * TRK_X + rr, TRENCH + 0.09, 0);
            scene.add(rail);
        }
        const upstand = new THREE.Mesh(new THREE.BoxGeometry(0.55, 2.3, LEN + 56), concreteMat);
        upstand.position.set(s * 13.15, -0.05, 0);
        scene.add(upstand);
        const tray = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.1, LEN + 40), darkMetal);
        tray.position.set(s * 12.95, 1.95, 0);
        scene.add(tray);
    }

    // end walls, each with a rectangular portal over its track
    for (const s of [-1, 1]) {
        const zc = s * (HALF + 0.35);
        const pieces = [];
        if (s > 0) {
            // the +z end wall carries the exit opening at mezzanine level
            pieces.push({ geo: new THREE.BoxGeometry(15.8, 8.8, 0.7), m: M(0, 3.2, zc) });
            pieces.push({ geo: new THREE.BoxGeometry(15.8, 4.2, 0.7), m: M(0, 13.1, zc) });
            for (const sx of [-1, 1]) {
                pieces.push({ geo: new THREE.BoxGeometry(5.4, 3.4, 0.7), m: M(sx * 5.2, DECK_Y + 1.7, zc) });
            }
        } else {
            pieces.push({ geo: new THREE.BoxGeometry(15.8, 16.4, 0.7), m: M(0, 7.0, zc) });
        }
        for (const sx of [-1, 1]) {
            pieces.push({ geo: new THREE.BoxGeometry(2.8, 16.4, 0.7), m: M(sx * 13.8, 7.0, zc) });   // outer piers
            pieces.push({ geo: new THREE.BoxGeometry(4.5, 10.6, 0.7), m: M(sx * 10.15, 9.9, zc) });  // portal lintels
        }
        scene.add(mesh(pieces, concreteMat));

        // running tunnels beyond, boxes seen from the inside
        for (const sx of [-1, 1]) {
            const tube = new THREE.Mesh(new THREE.BoxGeometry(4.5, 5.75, 30), tunnelMat);
            tube.position.set(sx * 10.15, 1.7, s * (HALF + 15.5));
            scene.add(tube);
            const ring = new THREE.Mesh(new THREE.BoxGeometry(4.7, 5.9, 0.25), darkMetal);
            ring.position.set(sx * 10.15, 1.7, zc - s * 0.4);
            scene.add(world.ghost(ring));
        }
    }

    /* ============================================================
       4 · ribs, brass edging, the lighting spine, services
       ============================================================ */
    {
        const ribs = [], edging = [], hangers = [];
        const ribGeo = new THREE.TorusGeometry(R - 0.18, 0.17, 8, 72, Math.PI + 0.22);
        const edgeGeo = new THREE.TorusGeometry(R - 0.4, 0.045, 6, 72, Math.PI + 0.22);
        const rodGeo = new THREE.CylinderGeometry(0.022, 0.022, 6.2, 6);
        for (let z = -HALF + 4; z <= HALF - 4; z += 6) {
            const inSlot = z > SLOT_Z0 - 1 && z < SLOT_Z1 + 1;
            if (!inSlot) {
                ribs.push({ geo: ribGeo, m: M(0, CY, z, 0, 0, -0.11) });
                edging.push({ geo: edgeGeo, m: M(0, CY, z, 0, 0, -0.11) });
            }
            if (Math.abs(z) < HALF - 8 && !(z > DECK_Z0 - 2 && z < DECK_Z1)) {
                hangers.push({ geo: rodGeo, m: M(0, SPINE_Y + 3.2, z) });
            }
        }
        scene.add(mesh(ribs, concreteMat));
        scene.add(mesh(edging, bronzeMat));
        scene.add(mesh(hangers, darkMetal));

        // suspended lighting spine down the centre of the platform
        const spineRun = (z0, z1) => {
            const trough = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.26, z1 - z0), darkMetal);
            trough.position.set(0, SPINE_Y + 0.13, (z0 + z1) / 2);
            scene.add(trough);
            const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.06, z1 - z0 - 0.4), spineMat);
            lamp.position.set(0, SPINE_Y - 0.02, (z0 + z1) / 2);
            scene.add(world.ghost(lamp));
        };
        spineRun(-HALF + 6, DECK_Z0 - 2);

        // cove strips washing the vault flanks, and the service runs at the crown
        for (const s of [-1, 1]) {
            const cove = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.1, LEN - 6), coveMat);
            cove.position.set(s * 12.55, 1.05, 0);
            scene.add(world.ghost(cove));
            const shroud = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.34, LEN - 6), darkMetal);
            shroud.position.set(s * 12.7, 1.02, 0);
            scene.add(shroud);
        }
        const conduit = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, LEN - 4), redMat);
        conduit.position.set(-0.9, CY + R - 0.55, 0);
        scene.add(conduit);
        const pipeG = new THREE.CylinderGeometry(0.05, 0.05, LEN - 4, 8); pipeG.rotateX(Math.PI / 2);
        for (const px of [0.75, 1.05]) {
            const p = new THREE.Mesh(pipeG, steelMat);
            p.position.set(px, CY + R - 0.6, 0);
            scene.add(p);
        }
    }

    /* ============================================================
       5 · the daylight slot: shaft, sky, beam, dust
       ============================================================ */
    const skyMat = new THREE.ShaderMaterial({
        uniforms: { uTime },
        side: THREE.DoubleSide,
        fog: false,
        vertexShader: `
            varying vec2 vUv;
            void main() {
                vUv = uv;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }`,
        fragmentShader: `
            uniform float uTime;
            varying vec2 vUv;
            float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
            float noise(vec2 p) {
                vec2 i = floor(p), f = fract(p);
                f = f * f * (3.0 - 2.0 * f);
                return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
                           mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
            }
            float fbm(vec2 p) {
                float a = 0.5, s = 0.0;
                for (int i = 0; i < 5; i++) { s += a * noise(p); p *= 2.03; a *= 0.5; }
                return s;
            }
            void main() {
                vec2 p = vUv * 2.0 - 1.0;
                vec3 sky = mix(vec3(0.72, 0.83, 0.96), vec3(0.36, 0.56, 0.88), clamp(length(p) * 0.7, 0.0, 1.0));
                float c = fbm(p * 2.1 + vec2(uTime * 0.011, uTime * 0.004));
                float cloud = smoothstep(0.44, 0.86, c);
                vec3 col = mix(sky, vec3(1.06, 1.04, 1.0), cloud * 0.9);
                col += 0.12 * smoothstep(0.7, 1.0, 1.0 - length(p * vec2(0.7, 1.0)));
                gl_FragColor = vec4(col, 1.0);
            }`
    });

    {
        const SW = 7.2, SL = SLOT_Z1 - SLOT_Z0, TOP = 30;
        // the shaft up to the street, seen from inside
        const shaft = new THREE.Mesh(new THREE.BoxGeometry(SW, TOP - 14.0, SL),
            new THREE.MeshStandardMaterial({ color: 0xdedbd2, roughness: 0.85, side: THREE.BackSide }));
        shaft.position.set(0, (14.0 + TOP) / 2, OCU_Z);
        scene.add(shaft);

        const sky = new THREE.Mesh(new THREE.PlaneGeometry(SW - 0.1, SL - 0.1), skyMat);
        sky.rotation.x = Math.PI / 2;
        sky.position.set(0, TOP - 0.15, OCU_Z);
        scene.add(world.ghost(sky));

        // glazing across the slot, with mullions
        const glaze = new THREE.Mesh(new THREE.PlaneGeometry(SW, SL), glassMat);
        glaze.rotation.x = -Math.PI / 2;
        glaze.position.set(0, 14.5, OCU_Z);
        scene.add(world.ghost(glaze));
        const mull = [];
        for (let i = 0; i <= 4; i++) {
            mull.push({ geo: new THREE.BoxGeometry(SW, 0.12, 0.12), m: M(0, 14.5, SLOT_Z0 + i * SL / 4) });
        }
        for (const mx of [-SW / 2, 0, SW / 2]) {
            mull.push({ geo: new THREE.BoxGeometry(0.12, 0.12, SL), m: M(mx, 14.5, OCU_Z) });
        }
        scene.add(mesh(mull, bronzeMat));

        // the beam itself: a sheared box, additive, shimmering
        const beamGeo = new THREE.BoxGeometry(SW - 0.6, 29.4, SL - 0.5, 1, 30, 1);
        beamGeo.translate(0, 29.4 / 2, 0);
        {
            const p = beamGeo.attributes.position;
            for (let i = 0; i < p.count; i++) {
                const y = p.getY(i);
                p.setX(i, p.getX(i) + (29.4 - y) * (OCU_X / 29.4));
            }
            p.needsUpdate = true;
            beamGeo.computeVertexNormals();
        }
        const beamMat = new THREE.ShaderMaterial({
            uniforms: { uTime },
            transparent: true, depthWrite: false, fog: false,
            side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
            vertexShader: `
                varying float vH;
                varying vec3 vLocal;
                void main() {
                    vH = clamp(position.y / 29.4, 0.0, 1.0);
                    vLocal = position;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }`,
            fragmentShader: `
                uniform float uTime;
                varying float vH;
                varying vec3 vLocal;
                void main() {
                    float body = mix(0.22, 1.0, pow(vH, 0.8));
                    float shimmer = 0.86 + 0.14 * sin(vLocal.z * 1.7 + uTime * 0.5)
                                          * sin(vLocal.y * 0.6 - uTime * 0.31);
                    vec3 col = mix(vec3(0.95, 0.90, 0.78), vec3(1.0, 0.98, 0.92), vH);
                    gl_FragColor = vec4(col * body * shimmer * 0.085, 1.0);
                }`
        });
        const beam = new THREE.Mesh(beamGeo, beamMat);
        beam.position.set(0, 0.05, OCU_Z);
        scene.add(world.ghost(beam));

        // the pool it lands in
        const poolMat = new THREE.ShaderMaterial({
            uniforms: { uTime },
            transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending,
            vertexShader: `
                varying vec2 vUv;
                void main() {
                    vUv = uv;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }`,
            fragmentShader: `
                uniform float uTime;
                varying vec2 vUv;
                void main() {
                    vec2 p = (vUv - 0.5) * 2.0;
                    float d = max(abs(p.x), abs(p.y));
                    float a = 1.0 - smoothstep(0.55, 1.0, d);
                    a *= 0.9 + 0.1 * sin(uTime * 0.4 + p.y * 3.0);
                    gl_FragColor = vec4(vec3(1.0, 0.96, 0.86) * a * 0.30, 1.0);
                }`
        });
        const pool = new THREE.Mesh(new THREE.PlaneGeometry(9.5, 10.5), poolMat);
        pool.rotation.x = -Math.PI / 2;
        pool.position.set(OCU_X, 0.02, OCU_Z);
        scene.add(world.ghost(pool));

        // dust turning over in the beam
        const N = 900;
        const pos = new Float32Array(N * 3), seed = new Float32Array(N);
        for (let i = 0; i < N; i++) {
            const h = Math.random() * 15.5;
            pos[i * 3] = (h / 29.4) * OCU_X + (Math.random() - 0.5) * (SW - 1.2) + 0.6;
            pos[i * 3 + 1] = h;
            pos[i * 3 + 2] = OCU_Z + (Math.random() - 0.5) * (SL - 1.0);
            seed[i] = Math.random();
        }
        const dustGeo = new THREE.BufferGeometry();
        dustGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        dustGeo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
        const dustMat = new THREE.ShaderMaterial({
            uniforms: { uTime },
            transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending,
            vertexShader: `
                attribute float aSeed;
                uniform float uTime;
                varying float vA;
                void main() {
                    vec3 p = position;
                    float t = uTime * 0.25 + aSeed * 6.2831;
                    p.y = mod(p.y - uTime * 0.11 - aSeed * 4.0, 15.5) + 0.15;
                    p.x += sin(t * 0.9) * 0.42;
                    p.z += cos(t * 0.7) * 0.42;
                    vec4 mv = modelViewMatrix * vec4(p, 1.0);
                    gl_PointSize = (1.4 + 3.4 * aSeed) * (55.0 / max(1.0, -mv.z));
                    vA = 0.25 + 0.75 * aSeed;
                    gl_Position = projectionMatrix * mv;
                }`,
            fragmentShader: `
                varying float vA;
                void main() {
                    vec2 c = gl_PointCoord - 0.5;
                    float d = 1.0 - smoothstep(0.15, 0.5, length(c));
                    gl_FragColor = vec4(vec3(1.0, 0.95, 0.85) * d * vA * 0.55, d);
                }`
        });
        const dust = new THREE.Points(dustGeo, dustMat);
        scene.add(world.ghost(dust));
    }

    /* ============================================================
       6 · platform screen doors
       ============================================================ */
    const psdLeaves = { '1': [], '-1': [] };
    const edgeStrips = [];
    {
        const leafMat = new THREE.MeshStandardMaterial({
            color: 0x232a2e, roughness: 0.08, metalness: 0.5, transparent: true, opacity: 0.7 });
        const plateTex = (n) => tex(128, 128, (ctx, w, h) => {
            ctx.fillStyle = '#F2F2EE'; ctx.fillRect(0, 0, w, h);
            ctx.fillStyle = '#1E8C86'; ctx.fillRect(0, h - 12, w, 12);
            ctx.fillStyle = '#242526'; ctx.font = '600 84px Arial';
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText(String(n), w / 2, h / 2 - 2);
        });
        const numMats = { '1': new THREE.MeshBasicMaterial({ map: plateTex(1) }),
            '-1': new THREE.MeshBasicMaterial({ map: plateTex(2) }) };

        const stripMats = {};
        for (const sd of [-1, 1]) {
            const x = sd * PSD_X;
            const rotY = sd > 0 ? -Math.PI / 2 : Math.PI / 2;
            const frames = [], posts = [];

            frames.push({ geo: new THREE.BoxGeometry(0.2, 0.12, LEN), m: M(x, 0.06, 0) });        // base rail
            frames.push({ geo: new THREE.BoxGeometry(0.26, 0.4, LEN), m: M(x, 2.72, 0) });        // transom
            frames.push({ geo: new THREE.BoxGeometry(0.22, 0.3, LEN), m: M(x, 4.55, 0) });        // head

            // louvred over-panel between transom and head
            const over = new THREE.Mesh(new THREE.PlaneGeometry(LEN, 1.6),
                new THREE.MeshStandardMaterial({ color: 0x1a1d1f, roughness: 0.7, metalness: 0.3, side: THREE.DoubleSide }));
            over.rotation.y = rotY;
            over.position.set(sd * (PSD_X + 0.04), 3.72, 0);
            scene.add(over);

            // the platform-edge light line: idle blue-white, running amber on approach
            const stripMat = new THREE.ShaderMaterial({
                uniforms: { uTime, uApproach: { value: 0 } },
                fog: false,
                vertexShader: `
                    varying vec2 vUv;
                    void main() {
                        vUv = uv;
                        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                    }`,
                fragmentShader: `
                    uniform float uTime;
                    uniform float uApproach;
                    varying vec2 vUv;
                    void main() {
                        float wave = 0.5 + 0.5 * sin(vUv.x * 90.0 - uTime * 3.0);
                        wave = smoothstep(0.3, 0.95, wave);
                        vec3 idle = vec3(0.42, 0.52, 0.56);
                        vec3 warn = mix(vec3(0.55, 0.24, 0.03), vec3(1.4, 0.85, 0.22), wave);
                        gl_FragColor = vec4(mix(idle, warn, uApproach), 1.0);
                    }`
            });
            stripMats[String(sd)] = stripMat;
            const strip = new THREE.Mesh(new THREE.PlaneGeometry(LEN, 0.09), stripMat);
            strip.rotation.y = rotY;
            strip.position.set(sd * (PSD_X - 0.14), 0.2, 0);
            scene.add(world.ghost(strip));
            edgeStrips.push(stripMat);

            for (const dz of DOOR_Z) {
                for (const pz of [dz - 1.06, dz + 1.06]) {
                    posts.push({ geo: new THREE.BoxGeometry(0.18, 2.6, 0.16), m: M(x, 1.3, pz) });
                }
                for (const lr of [-1, 1]) {
                    const leaf = new THREE.Mesh(new THREE.BoxGeometry(0.07, 2.4, 0.98), leafMat);
                    leaf.position.set(x, 1.24, dz + lr * 0.49);
                    scene.add(leaf);
                    psdLeaves[String(sd)].push({ leaf, z0: dz + lr * 0.49, dir: lr });
                }
                const tile = new THREE.Mesh(new THREE.PlaneGeometry(0.36, 0.36), numMats[String(sd)]);
                tile.rotation.y = rotY;
                tile.position.set(sd * (PSD_X + 0.02), 3.2, dz);
                scene.add(world.ghost(tile));
            }

            // fixed glazed bays between the doorways
            const edges = [-HALF + 0.4, ...DOOR_Z.flatMap(z => [z - 1.06, z + 1.06]), HALF - 0.4];
            for (let i = 0; i < edges.length; i += 2) {
                const a = edges[i], b = edges[i + 1];
                if (b - a < 0.4) continue;
                const glass = new THREE.Mesh(new THREE.PlaneGeometry(b - a - 0.08, 2.44), psdGlassMat);
                glass.rotation.y = rotY;
                glass.position.set(x, 1.26, (a + b) / 2);
                scene.add(glass);
                frames.push({ geo: new THREE.BoxGeometry(0.12, 0.09, b - a), m: M(x, 1.28, (a + b) / 2) });
                for (let k = 1; k * 3.2 < b - a; k++) {
                    frames.push({ geo: new THREE.BoxGeometry(0.1, 2.44, 0.09), m: M(x, 1.26, a + k * 3.2) });
                }
            }
            scene.add(mesh(frames, darkMetal));
            scene.add(mesh(posts, steelMat));
        }
        edgeStrips.length = 0;
        edgeStrips.push(stripMats['1'], stripMats['-1']);
    }

    /* ============================================================
       7 · escalators, lift, mezzanine, the way out
       ============================================================ */
    const scrollers = [];
    const liftParts = {};
    {
        const rise = DECK_Y, run = ESC_Z1 - ESC_Z0;
        const ang = Math.atan2(rise, run);
        const inclineLen = Math.hypot(rise, run);
        const zc = (ESC_Z0 + ESC_Z1) / 2, yc = rise / 2;

        function escalator(x, dir) {
            const g = new THREE.Group();
            const truss = new THREE.Mesh(new THREE.BoxGeometry(1.45, 0.9, inclineLen + 1.4), darkMetal);
            truss.rotation.x = -ang;
            truss.position.set(x, yc - 0.62, zc);
            g.add(truss);

            const st = stepTex.clone();
            st.wrapS = st.wrapT = THREE.RepeatWrapping;
            st.repeat.set(1, inclineLen / 0.42);
            st.needsUpdate = true;
            const steps = new THREE.Mesh(new THREE.PlaneGeometry(1.06, inclineLen),
                new THREE.MeshStandardMaterial({ map: st, roughness: 0.5, metalness: 0.55 }));
            steps.rotation.x = -Math.PI / 2 - ang;
            steps.position.set(x, yc - 0.14, zc);
            g.add(steps);
            scrollers.push({ t: st, rate: -dir * 0.34 });

            for (const sx of [-1, 1]) {
                const balGeo = new THREE.PlaneGeometry(inclineLen, 1.0);
                balGeo.rotateY(Math.PI / 2);                      // long axis along z, facing ±x
                const bal = new THREE.Mesh(balGeo, glassMat);
                bal.rotation.x = -ang;
                bal.position.set(x + sx * 0.62, yc + 0.42, zc);
                g.add(bal);

                const ht = handTex.clone();
                ht.wrapS = ht.wrapT = THREE.RepeatWrapping;
                ht.repeat.set(1, inclineLen / 0.6);
                ht.needsUpdate = true;
                const rail = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.07, inclineLen),
                    new THREE.MeshStandardMaterial({ map: ht, roughness: 0.65 }));
                rail.rotation.x = -ang;
                rail.position.set(x + sx * 0.62, yc + 0.94, zc);
                g.add(rail);
                scrollers.push({ t: ht, rate: -dir * 0.34 });
            }
            // landings
            const low = new THREE.Mesh(new THREE.BoxGeometry(1.45, 0.16, 2.0), steelMat);
            low.position.set(x, 0.08, ESC_Z0 - 1.0);
            g.add(low);
            const high = new THREE.Mesh(new THREE.BoxGeometry(1.45, 0.16, 2.0), steelMat);
            high.position.set(x, DECK_Y - 0.08, ESC_Z1 + 0.6);
            g.add(high);
            scene.add(g);
        }
        escalator(-2.5, 1);    // up
        escalator(0.0, -1);    // down
        escalator(2.5, 1);     // up

        // fixed stair alongside
        {
            const steps = [], n = 24;
            for (let i = 0; i < n; i++) {
                const y = (i + 0.5) * (rise / n), z = ESC_Z0 + (i + 0.5) * (run / n);
                steps.push({ geo: new THREE.BoxGeometry(1.7, y, run / n + 0.02), m: M(5.3, y / 2, z) });
            }
            scene.add(mesh(steps, concreteMat));
            const balGeo = new THREE.PlaneGeometry(inclineLen, 1.05);
            balGeo.rotateY(Math.PI / 2);
            const bal = new THREE.Mesh(balGeo, glassMat);
            bal.rotation.x = -ang;
            bal.position.set(4.42, yc + 0.5, zc);
            scene.add(bal);
        }

        // mezzanine deck over the platform
        const deckLen = DECK_Z1 - DECK_Z0;
        const deck = new THREE.Mesh(new THREE.BoxGeometry(12.8, 0.4, deckLen), concreteMat);
        deck.position.set(0, DECK_Y - 0.2, (DECK_Z0 + DECK_Z1) / 2);
        scene.add(deck);
        const soffit = new THREE.Mesh(new THREE.BoxGeometry(12.6, 0.08, deckLen - 0.4),
            new THREE.MeshStandardMaterial({ color: 0xd6d8d5, roughness: 0.55, metalness: 0.2 }));
        soffit.position.set(0, DECK_Y - 0.45, (DECK_Z0 + DECK_Z1) / 2);
        scene.add(soffit);
        const fascia = new THREE.Mesh(new THREE.BoxGeometry(10.3, 0.75, 0.2), bronzeMat);
        fascia.position.set(1.3, DECK_Y - 0.3, DECK_Z0 - 0.1);
        scene.add(fascia);
        // the plate you step out onto when the lift reaches the top
        const landing = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.4, 1.0), concreteMat);
        landing.position.set(-5.4, DECK_Y - 0.2, DECK_Z0 - 0.5);
        scene.add(landing);

        // deck balustrades — glass, capped high enough that nobody mistakes it for a seat
        for (const sx of [-1, 1]) {
            const b = new THREE.Mesh(new THREE.PlaneGeometry(deckLen, 1.15), glassMat);
            b.rotation.y = Math.PI / 2;
            b.position.set(sx * 6.3, DECK_Y + 0.58, (DECK_Z0 + DECK_Z1) / 2);
            scene.add(b);
            const cap = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.06, deckLen), bronzeMat);
            cap.position.set(sx * 6.3, DECK_Y + 1.16, (DECK_Z0 + DECK_Z1) / 2);
            scene.add(cap);
        }
        {   // the balustrade across the escalator void, left open where the lift lands
            const b = new THREE.Mesh(new THREE.PlaneGeometry(9.8, 1.15), glassMat);
            b.position.set(1.5, DECK_Y + 0.58, DECK_Z0 - 0.05);
            scene.add(b);
            const cap = new THREE.Mesh(new THREE.BoxGeometry(9.8, 0.06, 0.09), bronzeMat);
            cap.position.set(1.5, DECK_Y + 1.16, DECK_Z0 - 0.05);
            scene.add(cap);
        }

        // lift: a glazed car running the full height beside the escalators
        {
            const LX = -5.4, LZ = 64.5, LH = DECK_Y + 2.9;   // lands hard against the deck edge
            const core = new THREE.Group();
            const posts = [];
            for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
                posts.push({ geo: new THREE.BoxGeometry(0.16, LH, 0.16), m: M(LX + sx * 1.05, LH / 2, LZ + sz * 1.05) });
            }
            posts.push({ geo: new THREE.BoxGeometry(2.4, 0.2, 2.4), m: M(LX, LH, LZ) });
            core.add(mesh(posts, darkMetal));
            for (const [dx, dz, ry] of [[-1.05, 0, Math.PI / 2], [1.05, 0, Math.PI / 2], [0, -1.05, 0]]) {
                const p = new THREE.Mesh(new THREE.PlaneGeometry(2.1, LH - 0.1), glassMat);
                p.rotation.y = ry;
                p.position.set(LX + dx, (LH - 0.1) / 2, LZ + dz);
                core.add(p);
            }
            const car = new THREE.Group();
            const shell = new THREE.Mesh(new THREE.BoxGeometry(1.9, 2.25, 1.9), glassMat);
            shell.position.y = 1.15;
            car.add(shell);
            const roof = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.1, 2.0), darkMetal);
            roof.position.y = 2.3; car.add(roof);
            const flr = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.12, 1.9), darkMetal);
            flr.position.y = 0.06; car.add(flr);
            const lamp = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.05, 1.3),
                new THREE.MeshStandardMaterial({ color: 0x999999, emissive: 0xFFF6E4, emissiveIntensity: 2.0 }));
            lamp.position.y = 2.2; car.add(lamp);
            for (const lr of [-1, 1]) {          // bi-parting doors that vanish behind the jambs
                const leaf = new THREE.Mesh(new THREE.BoxGeometry(0.5, 2.1, 0.05), steelMat);
                leaf.position.set(lr * 0.25, 1.06, 0.93);
                car.add(leaf);
                liftParts[lr > 0 ? 'r' : 'l'] = leaf;
                const jamb = new THREE.Mesh(new THREE.BoxGeometry(0.45, 2.2, 0.06), darkMetal);
                jamb.position.set(lr * 0.725, 1.1, 0.97);
                car.add(jamb);
            }
            car.position.set(LX, 0.02, LZ);
            core.add(car);
            liftParts.car = car;
            scene.add(core);
            world.part('lift_00', core);
        }

        // the exit lobby glowing through the opening in the end wall
        {
            const lobby = new THREE.Mesh(new THREE.BoxGeometry(5.6, 3.6, 9), brickMat.clone());
            lobby.material.side = THREE.BackSide;
            lobby.position.set(0, DECK_Y + 1.7, HALF + 4.6);
            scene.add(lobby);
            const jamb = [];
            jamb.push({ geo: new THREE.BoxGeometry(0.25, 3.5, 0.3), m: M(-2.6, DECK_Y + 1.75, HALF - 0.1) });
            jamb.push({ geo: new THREE.BoxGeometry(0.25, 3.5, 0.3), m: M(2.6, DECK_Y + 1.75, HALF - 0.1) });
            jamb.push({ geo: new THREE.BoxGeometry(5.4, 0.25, 0.3), m: M(0, DECK_Y + 3.45, HALF - 0.1) });
            scene.add(mesh(jamb, bronzeMat));
            // the escalators onward, hinted: a lit incline running away up the lobby
            const st = stepTex.clone();
            st.wrapS = st.wrapT = THREE.RepeatWrapping;
            st.repeat.set(1, 14);
            st.needsUpdate = true;
            const onward = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 8.0),
                new THREE.MeshStandardMaterial({ map: st, roughness: 0.5, metalness: 0.55 }));
            onward.rotation.x = -Math.PI / 2 - 0.5;
            onward.position.set(0, DECK_Y + 1.9, HALF + 5.4);
            scene.add(onward);
            scrollers.push({ t: st, rate: -0.3 });
        }
    }

    /* ============================================================
       8 · signage — hung boards, live departure screens
       ============================================================ */
    let signN = 0;
    function boardMesh(w, h, drawFn, glow) {
        const px = Math.round(256 * w / h);
        const t = tex(px, 256, drawFn);
        const face = new THREE.MeshStandardMaterial({
            map: t, roughness: 0.55, metalness: 0.05,
            emissive: glow ? 0xffffff : 0x000000,
            emissiveMap: glow ? t : null,
            emissiveIntensity: glow ? 0.7 : 0 });
        const edge = new THREE.MeshStandardMaterial({ color: 0x1d1f21, roughness: 0.6 });
        return new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.09), [edge, edge, edge, edge, face, face]);
    }
    function hungSign(w, h, drawFn, x, y, z, topY, spread, glow) {
        const grp = new THREE.Group();
        const s = boardMesh(w, h, drawFn, glow);
        s.position.set(x, y, z);
        grp.add(s);
        const rodG = new THREE.CylinderGeometry(0.016, 0.016, 1, 6);
        const y0 = y + h / 2, hgt = topY - y0;
        for (const sx of [-1, 1]) {
            const rod = new THREE.Mesh(rodG, darkMetal);
            rod.scale.y = hgt;
            rod.position.set(x + sx * spread, y0 + hgt / 2, z);
            grp.add(rod);
        }
        world.part(`sign_${String(signN++).padStart(2, '0')}`, grp);
        scene.add(grp);
        return grp;
    }

    const drawExit = (ctx, w, h) => {
        ctx.fillStyle = '#111315'; ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = '#F2C230'; ctx.font = '700 74px Arial'; ctx.textBaseline = 'middle';
        ctx.fillText('Exit', 40, h * 0.31);
        ctx.fillStyle = '#fff'; ctx.font = '400 44px Arial';
        ctx.fillText('Merchant Street', 40, h * 0.63);
        ctx.fillStyle = '#1E8C86'; ctx.fillRect(30, h * 0.79, w - 60, h * 0.17);
        ctx.fillStyle = '#fff'; ctx.font = '500 32px Arial';
        ctx.fillText('Lifts · Escalators · Street level', 44, h * 0.875);
        ctx.strokeStyle = '#F2C230'; ctx.lineWidth = 9; ctx.lineCap = 'round';
        const ax = w - 80, ay = h * 0.31;
        ctx.beginPath();
        ctx.moveTo(ax, ay + 26); ctx.lineTo(ax, ay - 26);
        ctx.moveTo(ax - 20, ay - 6); ctx.lineTo(ax, ay - 28); ctx.lineTo(ax + 20, ay - 6);
        ctx.stroke();
    };
    const drawPlatform = (num, dest, arrow) => (ctx, w, h) => {
        ctx.fillStyle = '#F4F4F1'; ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = '#1E8C86'; ctx.fillRect(0, h - 14, w, 14);
        ctx.textBaseline = 'middle'; ctx.fillStyle = '#2a2c2d';
        if (arrow < 0) {
            ctx.font = '500 86px Arial'; ctx.fillText('←', 34, h / 2);
            ctx.font = '600 96px Arial'; ctx.fillText(String(num), 150, h / 2);
            ctx.fillStyle = '#1E8C86'; ctx.fillRect(245, h * 0.16, 7, h * 0.66);
            ctx.fillStyle = '#2a2c2d'; ctx.font = '500 56px Arial';
            ctx.fillText(dest, 285, h / 2);
        } else {
            ctx.font = '500 56px Arial'; ctx.fillText(dest, 44, h / 2);
            ctx.fillStyle = '#1E8C86'; ctx.fillRect(w - 300, h * 0.16, 7, h * 0.66);
            ctx.fillStyle = '#2a2c2d'; ctx.font = '600 96px Arial';
            ctx.fillText(String(num), w - 268, h / 2);
            ctx.font = '500 86px Arial'; ctx.fillText('→', w - 150, h / 2);
        }
    };
    const drawName = (ctx, w, h) => {
        ctx.fillStyle = '#F6F6F2'; ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = '#1E8C86'; ctx.fillRect(0, 0, w, h * 0.09);
        ctx.fillStyle = '#1d1f20'; ctx.font = '600 78px Arial'; ctx.textBaseline = 'middle';
        ctx.fillText('Vault Street', 40, h * 0.34);
        ctx.fillStyle = '#111315'; ctx.fillRect(0, h * 0.55, w, h * 0.45);
        ctx.fillStyle = '#F2C230'; ctx.font = '600 42px Arial';
        ctx.fillText('Exit →', 40, h * 0.70);
        ctx.fillStyle = '#fff'; ctx.font = '400 30px Arial';
        ctx.fillText('Merchant St · Vault Sq · Museum 240m', 44, h * 0.87);
    };
    const drawNotice = (ctx, w, h) => {
        ctx.fillStyle = '#FBF9F2'; ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = '#B4372C'; ctx.lineWidth = 8; ctx.strokeRect(10, 10, w - 20, h - 20);
        ctx.fillStyle = '#B4372C'; ctx.fillRect(10, 10, w - 20, h * 0.22);
        ctx.fillStyle = '#fff'; ctx.font = '700 34px Arial'; ctx.textBaseline = 'middle';
        ctx.fillText('SEATING REMOVED', 28, h * 0.21);
        ctx.fillStyle = '#26282a'; ctx.font = '400 26px Arial';
        ctx.fillText('All benches on this platform', 28, h * 0.44);
        ctx.fillText('have been taken out of service', 28, h * 0.56);
        ctx.fillText('and will not be replaced.', 28, h * 0.68);
        ctx.fillStyle = '#6a6c6d'; ctx.font = '400 20px Arial';
        ctx.fillText('Please stand clear of the platform edge.', 28, h * 0.85);
    };

    // the exit boards hang off the lighting spine; the platform boards off the vault
    hungSign(2.6, 0.82, drawExit, 0, 5.6, DECK_Z0 - 6, 8.62, 0.26, true);
    hungSign(2.6, 0.82, drawExit, 0, 5.6, -30, 8.62, 0.26, true);
    hungSign(2.4, 0.78, drawExit, 0, 5.6, -76, 8.62, 0.26, true);
    // long droppers up to a rib, the way a cavern station has to hang a sign
    hungSign(2.8, 0.68, drawPlatform(1, 'Northfield', 1), 4.4, 4.9, -14, 13.85, 0.35, false);
    hungSign(2.8, 0.68, drawPlatform(2, 'Harbour Quay', -1), -4.4, 4.9, -14, 13.85, 0.35, false);
    hungSign(2.8, 0.68, drawPlatform(1, 'Northfield', 1), 4.4, 4.9, 42, 13.85, 0.35, false);
    hungSign(2.8, 0.68, drawPlatform(2, 'Harbour Quay', -1), -4.4, 4.9, 42, 13.85, 0.35, false);

    {   // station name panels facing each platform edge, on their own posts
        const t = tex(640, 320, drawName);
        const m = new THREE.MeshStandardMaterial({ map: t, roughness: 0.55, side: THREE.DoubleSide });
        const g = new THREE.PlaneGeometry(1.7, 0.85);
        const posts = [];
        for (let z = -HALF + 14; z <= HALF - 26; z += 24) {
            for (const s of [-1, 1]) {
                const p = new THREE.Mesh(g, m);
                p.position.set(s * (PSD_X - 0.55), 2.05, z);
                p.rotation.y = s > 0 ? -Math.PI / 2 : Math.PI / 2;
                scene.add(p);
                posts.push({ geo: new THREE.BoxGeometry(0.07, 1.7, 0.07), m: M(s * (PSD_X - 0.5), 0.85, z - 0.75) });
                posts.push({ geo: new THREE.BoxGeometry(0.07, 1.7, 0.07), m: M(s * (PSD_X - 0.5), 0.85, z + 0.75) });
            }
        }
        scene.add(mesh(posts, darkMetal));
    }

    // live departure screens
    const pids = [];
    {
        function drawPID(side, offset) {
            return (ctx, w, h, time) => {
                const lead = side > 0 ? 'Northfield' : 'Harbour Quay';
                const alt = side > 0 ? ['Ridgeway', 'Northfield'] : ['Old Harbour', 'Harbour Quay'];
                const m0 = ((4 + offset - Math.floor(time / 40)) % 12 + 12) % 12;
                ctx.fillStyle = '#F3F5F6'; ctx.fillRect(0, 0, w, h);
                ctx.fillStyle = '#0E3B39'; ctx.fillRect(0, 0, w, 56);
                ctx.fillStyle = '#fff'; ctx.font = '600 32px Arial'; ctx.textBaseline = 'middle';
                ctx.fillText(`Platform ${side > 0 ? 1 : 2}`, 14, 28);
                ctx.fillStyle = '#8FD7CE'; ctx.font = '400 24px Arial';
                ctx.fillText('every 4 min', w - 140, 28);
                ctx.fillStyle = '#1b1d1e'; ctx.font = '600 34px Arial';
                ctx.fillText(lead, 14, 86);
                ctx.fillStyle = '#0E3B39'; ctx.fillRect(w - 116, 66, 102, 40);
                ctx.fillStyle = '#FFD34D'; ctx.font = '600 28px Arial';
                ctx.fillText(m0 === 0 ? 'Now' : `${m0} min`, w - 102, 87);
                ctx.strokeStyle = '#1E8C86'; ctx.lineWidth = 3;
                ctx.beginPath(); ctx.moveTo(14, 112); ctx.lineTo(w - 14, 112); ctx.stroke();
                ctx.font = '400 24px Arial';
                for (let i = 0; i < 2; i++) {
                    ctx.fillStyle = '#33383a';
                    ctx.fillText(alt[i], 14, 140 + i * 34);
                    ctx.fillStyle = '#5d6265';
                    ctx.fillText(`${m0 + 4 + i * 5} min`, w - 100, 140 + i * 34);
                }
                ctx.fillStyle = '#B4372C'; ctx.fillRect(0, h - 42, w, 42);
                ctx.fillStyle = '#fff'; ctx.font = '500 20px Arial';
                const msgs = [
                    'All seating on this platform has been removed.',
                    'Please stand well clear of the platform edge.',
                    'Seating will not be reinstated. We apologise.' ];
                ctx.fillText(msgs[Math.floor(time / 8 + offset) % msgs.length], 12, h - 20);
            };
        }
        const edge = new THREE.MeshStandardMaterial({ color: 0x16181a, roughness: 0.6 });
        const mk = (side, z, idx) => {
            const live = liveTex(432, 256, drawPID(side, idx * 3));
            const face = new THREE.MeshStandardMaterial({
                map: live.tex, emissive: 0xffffff, emissiveMap: live.tex, emissiveIntensity: 0.9, roughness: 0.55 });
            const grp = new THREE.Group();
            const board = new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.8, 0.1), [edge, edge, edge, edge, face, face]);
            board.position.set(side * (PSD_X - 0.6), 3.2, z);
            board.rotation.y = side > 0 ? -Math.PI / 2 : Math.PI / 2;
            grp.add(board);
            const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 8.6, 8), darkMetal);
            arm.position.set(side * (PSD_X - 0.6), 7.9, z);
            grp.add(arm);
            world.part(`screen_${String(idx).padStart(2, '0')}`, grp);
            scene.add(grp);
            pids.push(live);
        };
        mk(1, -62, 0); mk(-1, -26, 1); mk(1, 12, 2); mk(-1, 48, 3);
    }

    /* ============================================================
       9 · what is left on the platform — none of it sittable
       ============================================================ */
    let binN = 0, helpN = 0, posterN = 0;
    function bin(x, z) {
        const g = new THREE.Group();
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.05, 10), darkMetal);
        post.position.y = 0.52; g.add(post);
        const hoop = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.035, 8, 20), steelMat);
        hoop.rotation.x = Math.PI / 2; hoop.position.y = 1.0; g.add(hoop);
        const bag = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.2, 0.62, 14, 1, true),
            new THREE.MeshStandardMaterial({ color: 0x2b2e30, roughness: 0.85, transparent: true,
                opacity: 0.55, side: THREE.DoubleSide }));
        bag.position.y = 0.69; g.add(bag);
        const base = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.28, 0.08, 12), darkMetal);
        base.position.y = 0.04; g.add(base);
        g.position.set(x, 0, z);
        world.part(`bin_${String(binN++).padStart(2, '0')}`, g);
        scene.add(g);
    }
    const beacons = [];
    function helpPoint(x, z, ry) {
        const g = new THREE.Group();
        const body = new THREE.Mesh(new THREE.BoxGeometry(0.5, 2.2, 0.26),
            new THREE.MeshStandardMaterial({ color: 0x14406e, roughness: 0.45, metalness: 0.2 }));
        body.position.y = 1.1; g.add(body);
        const panel = tex(128, 256, (ctx, w, h) => {
            ctx.fillStyle = '#12406e'; ctx.fillRect(0, 0, w, h);
            ctx.fillStyle = '#1E8C86'; ctx.fillRect(0, 0, w, 60);
            ctx.fillStyle = '#fff'; ctx.font = '700 28px Arial'; ctx.textAlign = 'center';
            ctx.fillText('HELP', w / 2, 40);
            ctx.fillStyle = '#e8ecef'; ctx.fillRect(20, 84, w - 40, 60);
            ctx.fillStyle = '#12406e'; ctx.font = '600 22px Arial';
            ctx.fillText('INFORMATION', w / 2, 118);
            ctx.fillStyle = '#B4372C'; ctx.fillRect(20, 158, w - 40, 60);
            ctx.fillStyle = '#fff'; ctx.fillText('EMERGENCY', w / 2, 192);
        });
        const front = new THREE.Mesh(new THREE.PlaneGeometry(0.46, 1.0),
            new THREE.MeshStandardMaterial({ map: panel, emissive: 0xffffff, emissiveMap: panel,
                emissiveIntensity: 0.5, roughness: 0.5 }));
        front.position.set(0, 1.55, 0.14); g.add(front);
        const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 8),
            new THREE.MeshStandardMaterial({ color: 0x223344, emissive: 0x3FA9F5, emissiveIntensity: 1.4 }));
        beacon.position.set(0, 2.3, 0); g.add(beacon);
        beacons.push(beacon.material);
        g.position.set(x, 0, z);
        if (ry) g.rotation.y = ry;
        world.part(`help_${String(helpN++).padStart(2, '0')}`, g);
        scene.add(g);
    }
    function posterBox(x, z, ry, hue, line) {
        const t = tex(256, 384, (ctx, w, h) => {
            const g = ctx.createLinearGradient(0, 0, w, h);
            g.addColorStop(0, hue[0]); g.addColorStop(1, hue[1]);
            ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
            ctx.fillStyle = 'rgba(255,255,255,0.9)';
            for (let i = 0; i < 5; i++) ctx.fillRect(24, 60 + i * 18, (w - 48) * (0.4 + Math.random() * 0.6), 6);
            ctx.fillStyle = '#fff'; ctx.font = '700 30px Arial';
            ctx.fillText(line, 24, 300);
            ctx.font = '400 18px Arial'; ctx.fillStyle = 'rgba(255,255,255,0.75)';
            ctx.fillText('vaultstreet.transit', 24, 336);
        });
        const g = new THREE.Group();
        const frame = new THREE.Mesh(new THREE.BoxGeometry(1.3, 1.9, 0.12), darkMetal);
        frame.position.y = 1.55; g.add(frame);
        const face = new THREE.Mesh(new THREE.PlaneGeometry(1.16, 1.76),
            new THREE.MeshStandardMaterial({ map: t, emissive: 0xffffff, emissiveMap: t,
                emissiveIntensity: 0.75, roughness: 0.45 }));
        face.position.set(0, 1.55, 0.065); g.add(face);
        const foot = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.6, 0.16), darkMetal);
        foot.position.y = 0.3; g.add(foot);
        g.position.set(x, 0, z);
        if (ry) g.rotation.y = ry;
        world.part(`poster_${String(posterN++).padStart(2, '0')}`, g);
        scene.add(g);
    }

    bin(6.6, -66); bin(-6.6, -40); bin(6.6, 4); bin(-6.6, 30); bin(6.6, 58);
    helpPoint(-6.9, -58, Math.PI / 2); helpPoint(6.9, 24, -Math.PI / 2);
    posterBox(-1.5, -78, 0, ['#1E8C86', '#0E3B39'], 'Stand clear.');
    posterBox(1.5, -78, Math.PI, ['#7a2f5e', '#2a1030'], 'Night service');
    posterBox(-1.5, 39, 0, ['#b4552c', '#3a1a0e'], 'Museum of Ore');
    posterBox(1.5, 39, Math.PI, ['#2b4f8a', '#101c33'], 'Mind the doors');

    {   // fare gates in miniature: validators on pedestals by the escalator foot
        const grp = new THREE.Group();
        const pods = [], heads = [];
        for (const x of [-3.6, -1.2, 1.2, 3.6]) {
            pods.push({ geo: new THREE.BoxGeometry(0.34, 1.0, 0.34), m: M(x, 0.5, 48.5) });
            heads.push({ geo: new THREE.BoxGeometry(0.4, 0.14, 0.4), m: M(x, 1.06, 48.5) });
        }
        grp.add(mesh(pods, darkMetal));
        grp.add(mesh(heads, tealMat));
        world.part('validators_00', grp);
        scene.add(grp);
    }
    {   // fire services cabinet and a hose reel against the blind end wall
        const grp = new THREE.Group();
        const cab = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.3, 0.3), redMat);
        cab.position.set(-3.4, 0.75, -HALF + 0.35);
        grp.add(cab);
        const reel = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.16, 16), redMat);
        reel.rotation.z = Math.PI / 2;
        reel.position.set(-2.4, 1.2, -HALF + 0.28);
        grp.add(reel);
        world.part('fire_00', grp);
        scene.add(grp);
    }
    {   // the blind end wall carries the station's one piece of art: cut rock, backlit
        const artTex = tex(512, 512, (ctx, w, h) => {
            ctx.fillStyle = '#1b1a19'; ctx.fillRect(0, 0, w, h);
            const bands = ['#7a5636', '#8f6a41', '#3f4a52', '#5d6b74', '#a58459', '#2f3a42'];
            let y = 0;
            while (y < h) {
                const bh = 8 + Math.random() * 46;
                ctx.fillStyle = bands[Math.floor(Math.random() * bands.length)];
                ctx.globalAlpha = 0.55 + Math.random() * 0.4;
                ctx.beginPath();
                ctx.moveTo(0, y);
                for (let x = 0; x <= w; x += 32) ctx.lineTo(x, y + Math.sin(x * 0.02 + y * 0.05) * 7);
                ctx.lineTo(w, y + bh);
                for (let x = w; x >= 0; x -= 32) ctx.lineTo(x, y + bh + Math.sin(x * 0.02 + y * 0.03) * 6);
                ctx.closePath(); ctx.fill();
                y += bh;
            }
            ctx.globalAlpha = 1;
            for (let i = 0; i < 900; i++) {           // quartz flecks
                ctx.fillStyle = `rgba(255,246,220,${Math.random() * 0.5})`;
                ctx.fillRect(Math.random() * w, Math.random() * h, 2, 2);
            }
        });
        const art = new THREE.Mesh(new THREE.PlaneGeometry(13.0, 6.0),
            new THREE.MeshStandardMaterial({ map: artTex, roughness: 0.8,
                emissive: 0xffffff, emissiveMap: artTex, emissiveIntensity: 0.32 }));
        art.position.set(0, 4.4, -HALF + 0.05);
        scene.add(world.ghost(art));
    }
    {   // cameras and speakers along the spine
        const cams = [], spk = [];
        for (let z = -HALF + 12; z < DECK_Z0 - 4; z += 18) {
            for (const s of [-1, 1]) {
                cams.push({ geo: new THREE.CylinderGeometry(0.07, 0.07, 0.3, 10), m: M(s * 0.4, SPINE_Y - 0.35, z, 0.9, 0, 0) });
            }
            spk.push({ geo: new THREE.CylinderGeometry(0.11, 0.11, 0.12, 12), m: M(0, SPINE_Y - 0.3, z + 9) });
        }
        scene.add(world.ghost(mesh(cams, blackMat)));
        scene.add(world.ghost(mesh(spk, darkMetal)));
    }

    /* ============================================================
       10 · where the seats used to be
       ============================================================ */
    {
        const patchMat = new THREE.MeshStandardMaterial({
            map: patchTex, transparent: true, roughness: 0.5, metalness: 0.05, depthWrite: false });
        const studs = [], studG = new THREE.CylinderGeometry(0.028, 0.032, 0.035, 8);
        const noticeTex = tex(384, 256, drawNotice);
        const noticeMat = new THREE.MeshStandardMaterial({ map: noticeTex, roughness: 0.55, side: THREE.DoubleSide });
        let noticeN = 0;
        const spots = [-70, -44, -18, 8, 34, 62];
        spots.forEach((z, i) => {
            const patch = new THREE.Mesh(new THREE.PlaneGeometry(1.75, 2.75), patchMat);
            patch.rotation.x = -Math.PI / 2;
            patch.position.set(0, 0.016, z);
            scene.add(world.ghost(patch));
            for (const sx of [-0.62, 0.62]) for (const sz of [-1.05, 0, 1.05]) {
                studs.push({ geo: studG, m: M(sx, 0.017, z + sz) });
            }
            // the notice on its own stand, facing whichever way people come from
            const g = new THREE.Group();
            const post = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 1.15, 8), darkMetal);
            post.position.y = 0.575; g.add(post);
            const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.2, 0.05, 14), darkMetal);
            foot.position.y = 0.025; g.add(foot);
            const card = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.28), noticeMat);
            card.position.set(0, 1.24, 0);
            card.rotation.x = -0.28;
            g.add(card);
            g.position.set(i % 2 ? 1.35 : -1.35, 0, z + 1.9);
            g.rotation.y = i % 2 ? -0.3 : 0.3;
            world.part(`notice_${String(noticeN++).padStart(2, '0')}`, g);
            scene.add(g);
        });
        scene.add(world.ghost(mesh(studs, steelMat)));
    }

    /* ============================================================
       11 · the trains
       ============================================================ */
    function buildTrain() {
        const g = new THREE.Group();
        const body = [], dark = [], accent = [], gear = [];
        const leaves = [];
        const HW = 1.45;
        const L = CAR - 0.9;

        for (let i = 0; i < NCAR; i++) {
            const c = (i - (NCAR - 1) / 2) * CAR;
            body.push({ geo: new THREE.BoxGeometry(2.9, 2.65, L), m: M(0, 1.08, c) });          // -0.245 .. 2.405
            body.push({ geo: new THREE.BoxGeometry(2.62, 0.26, L - 0.1), m: M(0, 2.52, c) });   // roof cap
            dark.push({ geo: new THREE.BoxGeometry(2.72, 0.34, L), m: M(0, -0.3, c) });         // skirt
            accent.push({ geo: new THREE.BoxGeometry(2.93, 0.2, L), m: M(0, 0.42, c) });        // livery band
            dark.push({ geo: new THREE.BoxGeometry(1.5, 0.3, 3.2), m: M(0, 2.78, c - 4) });     // roof plant
            dark.push({ geo: new THREE.BoxGeometry(1.5, 0.3, 3.2), m: M(0, 2.78, c + 4) });
            for (const bz of [c - 6.4, c + 6.4]) {                    // bogies, wheels on the railhead
                gear.push({ geo: new THREE.BoxGeometry(2.1, 0.46, 2.4), m: M(0, -0.56, bz) });
                for (const wx of [-1.0, 1.0]) for (const wz of [bz - 0.9, bz + 0.9]) {
                    gear.push({ geo: new THREE.CylinderGeometry(0.38, 0.38, 0.12, 14), m: M(wx, -0.59, wz, 0, 0, Math.PI / 2) });
                }
            }
            // gangway between cars
            if (i < NCAR - 1) dark.push({ geo: new THREE.BoxGeometry(2.4, 2.3, 0.95), m: M(0, 1.1, c + CAR / 2) });

            // window band and doorways on both sides
            for (const s of [-1, 1]) {
                const win = new THREE.Mesh(new THREE.PlaneGeometry(L - 0.4, 1.0), carGlassMat);
                win.rotation.y = s > 0 ? Math.PI / 2 : -Math.PI / 2;
                win.position.set(s * (HW + 0.012), 1.62, c);
                g.add(win);
            }
        }
        const leafMat = new THREE.MeshStandardMaterial({ color: 0x1E8C86, roughness: 0.4, metalness: 0.25 });
        for (const dz of DOOR_Z) {
            for (const s of [-1, 1]) {
                dark.push({ geo: new THREE.BoxGeometry(0.04, 2.3, 2.3), m: M(s * (HW + 0.02), 1.0, dz) });   // door surround
                for (const lr of [-1, 1]) {
                    const leaf = new THREE.Mesh(new THREE.BoxGeometry(0.06, 2.1, 0.96), leafMat);
                    leaf.position.set(s * (HW + 0.06), 1.0, dz + lr * 0.48);
                    g.add(leaf);
                    leaves.push({ leaf, z0: dz + lr * 0.48, dir: lr });
                }
            }
        }
        // noses: white to -z, red markers to +z
        const nz = (NCAR / 2) * CAR - 0.45;
        body.push({ geo: new THREE.BoxGeometry(2.72, 2.5, 1.3), m: M(0, 1.15, -nz - 0.65) });
        body.push({ geo: new THREE.BoxGeometry(2.72, 2.5, 1.3), m: M(0, 1.15, nz + 0.65) });
        dark.push({ geo: new THREE.BoxGeometry(2.3, 1.05, 0.1), m: M(0, 1.85, -nz - 1.31) });   // windscreen
        dark.push({ geo: new THREE.BoxGeometry(2.3, 1.05, 0.1), m: M(0, 1.85, nz + 1.31) });
        const lampG = new THREE.CylinderGeometry(0.14, 0.14, 0.08, 14); lampG.rotateX(Math.PI / 2);
        const heads = [], tails = [];
        for (const lx of [-0.9, 0.9]) {
            heads.push({ geo: lampG, m: M(lx, 0.62, -nz - 1.32) });
            tails.push({ geo: lampG, m: M(lx, 0.62, nz + 1.32) });
        }
        g.add(mesh(body, carBodyMat));
        g.add(mesh(dark, carDarkMat));
        g.add(mesh(accent, tealMat));
        g.add(mesh(gear, blackMat));
        g.add(mesh(heads, headMat));
        g.add(mesh(tails, tailMat));

        g.userData.setDoors = (k) => {
            for (const d of leaves) d.leaf.position.z = d.z0 + d.dir * k * 0.92;
        };
        return g;
    }

    const trains = [];
    {
        const t1 = buildTrain();
        t1.position.set(TRK_X, 0, 400);
        scene.add(world.ghost(t1));
        const t2 = buildTrain();
        t2.rotation.y = Math.PI;
        t2.position.set(-TRK_X, 0, -400);
        scene.add(world.ghost(t2));
        const l1 = new THREE.PointLight(0xDCE8FF, 26, 26, 2);
        const l2 = new THREE.PointLight(0xDCE8FF, 26, 26, 2);
        scene.add(l1); scene.add(l2);
        trains.push({ g: t1, sd: 1, sign: 1, phase: 0, lamp: l1 });
        trains.push({ g: t2, sd: -1, sign: -1, phase: 46, lamp: l2 });
    }

    /* ============================================================
       12 · light
       ============================================================ */
    try {   // a small environment so the bronze and the glass have something to hold
        const pmrem = new THREE.PMREMGenerator(world.renderer);
        const envScene = new THREE.Scene();
        const envTex = tex(4, 64, (ctx, w, h) => {
            const g = ctx.createLinearGradient(0, 0, 0, h);
            g.addColorStop(0, '#C6C3BB'); g.addColorStop(0.4, '#948F86');
            g.addColorStop(0.75, '#6C6862'); g.addColorStop(1, '#4C4945');
            ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
        });
        const dome = new THREE.Mesh(new THREE.SphereGeometry(60, 16, 12),
            new THREE.MeshBasicMaterial({ map: envTex, side: THREE.BackSide }));
        envScene.add(dome);
        const spineGlow = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 60),
            new THREE.MeshBasicMaterial({ color: 0xFFF0D8 }));
        spineGlow.position.set(0, 9, 0);
        envScene.add(spineGlow);
        const day = new THREE.Mesh(new THREE.BoxGeometry(7, 1, 8),
            new THREE.MeshBasicMaterial({ color: 0xFFFFFF }));
        day.position.set(0, 15, -50);
        envScene.add(day);
        scene.environment = pmrem.fromScene(envScene, 0.04).texture;
        if ('environmentIntensity' in scene) scene.environmentIntensity = 0.7;
        pmrem.dispose();
    } catch (e) { /* an environment is a nicety; carry on without one */ }

    scene.fog = new THREE.Fog(0x4c4d4d, 44, 190);
    scene.add(new THREE.HemisphereLight(0xE4E7E6, 0x5C5A56, 0.42));

    for (let z = -HALF + 8; z < DECK_Z0; z += 14) {           // spine pools
        const pl = new THREE.PointLight(0xFFEFD4, 28, 19, 2);
        pl.position.set(0, SPINE_Y - 0.6, z);
        scene.add(pl);
    }
    for (let z = -HALF + 14; z < HALF - 10; z += 34) {        // cove wash on the vault flanks
        for (const s of [-1, 1]) {
            const cl = new THREE.PointLight(0xF7E6C6, 14, 22, 2);
            cl.position.set(s * 12.2, 1.6, z);
            scene.add(cl);
        }
    }
    {   // daylight down the shaft
        const sun = new THREE.SpotLight(0xFFF6E2, 900, 42, 0.20, 0.45, 2);
        sun.position.set(0, 27, OCU_Z);
        sun.target.position.set(OCU_X, 0, OCU_Z);
        scene.add(sun);
        scene.add(sun.target);
        const bounce = new THREE.PointLight(0xFFF2DE, 34, 20, 2);
        bounce.position.set(OCU_X, 1.4, OCU_Z);
        scene.add(bounce);
    }
    {   // under the mezzanine, and the way out
        const u1 = new THREE.PointLight(0xF6EFE0, 26, 16, 2);
        u1.position.set(0, DECK_Y - 1.2, 72);
        scene.add(u1);
        const u2 = new THREE.PointLight(0xF6EFE0, 22, 15, 2);
        u2.position.set(0, DECK_Y - 1.2, 82);
        scene.add(u2);
        const lobby = new THREE.PointLight(0xFFE9C4, 44, 22, 2);
        lobby.position.set(0, DECK_Y + 2.0, HALF + 3.2);
        scene.add(lobby);
        const esc = new THREE.PointLight(0xF2ECDE, 26, 18, 2);
        esc.position.set(0, 4.4, 58);
        scene.add(esc);
    }
    const flicker = new THREE.PointLight(0xEFF3F0, 16, 12, 2);
    flicker.position.set(-4.2, DECK_Y - 1.0, 68.5);
    scene.add(flicker);
    const flickerLamp = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.05, 1.5),
        new THREE.MeshStandardMaterial({ color: 0x9a9a96, emissive: 0xEFF6F2, emissiveIntensity: 1.6 }));
    flickerLamp.position.set(-4.2, DECK_Y - 0.52, 68.5);
    scene.add(world.ghost(flickerLamp));

    /* ============================================================
       13 · what moves
       ============================================================ */
    const CYCLE = 92, APPROACH = 14, DWELL = 22, DEPART = 13, FAR = 340;
    function trainAt(u) {
        if (u < APPROACH) {
            const k = u / APPROACH;
            return [FAR - (1 - Math.pow(1 - k, 3)) * FAR, true];
        }
        if (u < APPROACH + DWELL) return [0, true];
        if (u < APPROACH + DWELL + DEPART) {
            const k = (u - APPROACH - DWELL) / DEPART;
            return [-Math.pow(k, 2.4) * FAR, true];
        }
        return [-FAR, false];
    }

    let clock = 0, pidStep = -1;
    world.frame((dt, t) => {
        clock += dt;
        uTime.value = clock;

        for (const s of scrollers) s.t.offset.y += s.rate * dt;

        // departure boards: countdowns and the notice under them, a few times a minute
        const step = Math.floor(clock / 4);
        if (step !== pidStep) {
            pidStep = step;
            for (const p of pids) p.redraw(clock);
        }

        for (const tr of trains) {
            const u = (clock + tr.phase) % CYCLE;
            const [z, vis] = trainAt(u);
            const near = vis && Math.abs(z) < 200;      // beyond that it is behind the tunnel end
            tr.g.position.z = tr.sign * z;
            tr.g.visible = near;
            tr.lamp.visible = near;
            tr.lamp.position.set(tr.sd * TRK_X, 1.2, tr.sign * (z - (NCAR / 2) * CAR - 4));

            let k = 0;
            const od = u - APPROACH;
            if (od > 0 && od < DWELL) {
                const open = Math.min(1, Math.max(0, (od - 0.8) / 1.6));
                const close = Math.min(1, Math.max(0, (DWELL - 1.0 - od) / 1.8));
                k = Math.min(open, close);
                k = k * k * (3 - 2 * k);
            }
            if (tr.g.userData.setDoors) tr.g.userData.setDoors(k);
            for (const d of psdLeaves[String(tr.sd)]) {
                d.leaf.position.z = d.z0 + d.dir * k * 0.92;
            }
            // the platform-edge line runs amber from the moment the train is called
            const warn = u < APPROACH ? Math.min(1, u / 3) : (u < APPROACH + 1.5 ? 1 - (u - APPROACH) / 1.5 : 0);
            const strip = edgeStrips[tr.sd > 0 ? 0 : 1];
            if (strip) strip.uniforms.uApproach.value = Math.max(0, Math.min(1, warn));
        }

        // the lift, up and down all day
        {
            const period = 34, u = clock % period;
            let y = 0, door = 0;
            if (u < 6) { y = 0; door = Math.min(1, Math.min(u, 6 - u) / 1.2); }
            else if (u < 13) { const k = (u - 6) / 7; y = DECK_Y * (k * k * (3 - 2 * k)); }
            else if (u < 19) { y = DECK_Y; door = Math.min(1, Math.min(u - 13, 19 - u) / 1.2); }
            else if (u < 26) { const k = (u - 19) / 7; y = DECK_Y * (1 - k * k * (3 - 2 * k)); }
            if (liftParts.car) liftParts.car.position.y = 0.02 + y;
            if (liftParts.l) liftParts.l.position.x = -0.25 - door * 0.5;
            if (liftParts.r) liftParts.r.position.x = 0.25 + door * 0.5;
        }

        // help-point beacons breathing, and one tired fluorescent under the deck
        const b = 0.9 + 0.7 * (0.5 + 0.5 * Math.sin(clock * 1.6));
        for (const m of beacons) m.emissiveIntensity = b;
        const n = Math.sin(clock * 21.0) * Math.sin(clock * 7.3) * Math.sin(clock * 2.1);
        const bad = n > 0.55 ? 0.25 + 0.4 * Math.abs(Math.sin(clock * 60.0)) : 1.0;
        flicker.intensity = 16 * bad;
        flickerLamp.material.emissiveIntensity = 1.6 * bad;
    });
}
