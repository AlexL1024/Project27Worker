//
//  chip-carousel.scene.js
//  Project27 worlds
//
//  A takeaway shop's apron of asphalt, ten minutes after the rain has stopped,
//  at the blue end of dusk. Somebody's chips went over by the wheel stop and
//  three silver gulls have their heads down in them.
//
//  A fourth bird is not eating. It is standing bolt upright with its neck
//  stretched into a white column, its skull hanging off the top of it pointing
//  straight down at the ground, bill wide open, screaming — and it is running
//  the fifth bird, a first-year, round and round the spill. The juvenile will
//  not leave and will not stop, so it runs the only shape a cornered gull has:
//  a circle, on the same worn ring of wet asphalt, over and over.
//
//  That circle is the world's clock. The chase drives the ripple rings in the
//  puddles, the flinches of the birds still feeding, the rhythm of the calling,
//  and the shadows swinging round under the carpark lamp. Everything else — the
//  lit shopfront smeared upside-down in the standing water, the oil slick by the
//  grate, the two silhouettes up on the wire who have seen all this before — is
//  there so the argument has somewhere to happen.
//

import { mergeGeometries } from './BufferGeometryUtils.js';

export default function build(world) {
    const { THREE, scene, camera } = world;

    world.ownsSky(true);
    world.groundLevel(0);
    // A night scene wants bloom, but the subject is five white birds under a
    // lamp — so the threshold sits above lit plumage and catches only the sign,
    // the window, the lamp itself and what they leave in the water.
    world.bloom({ strength: 0.58, radius: 0.64, threshold: 0.86 });

    /* ==========================================================
       0 · Small tools
       ========================================================== */

    const TAU = Math.PI * 2;
    const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
    const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
    const lerp = (a, b, t) => a + (b - a) * t;
    const smooth = (e0, e1, x) => { const t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };
    const srgb = (hex) => new THREE.Color(hex).convertSRGBToLinear();

    // Deterministic: the same five birds having the same argument every time.
    let _seed = 91117;
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

    const _m4 = new THREE.Matrix4(), _q4 = new THREE.Quaternion();
    const _eu = new THREE.Euler(), _pv = new THREE.Vector3(), _sv = new THREE.Vector3();
    /** A transformed copy of a geometry, ready for merging. */
    function placed(geo, px, py, pz, rx = 0, ry = 0, rz = 0, s = 1) {
        _eu.set(rx, ry, rz);
        _m4.compose(_pv.set(px, py, pz), _q4.setFromEuler(_eu), _sv.setScalar(s));
        return geo.clone().applyMatrix4(_m4);
    }
    const box = (w, h, d, x, y, z, rx = 0, ry = 0, rz = 0) =>
        placed(new THREE.BoxGeometry(w, h, d), x, y, z, rx, ry, rz);

    /**
     * A closed tube swept along a polyline with a per-station radius. A gull is
     * mostly tapered tubes with a skull on the end, and so are handrails,
     * bollards and the arm of a carpark lamp.
     */
    function tube(points, radiusOf, radialSegs = 12, cap = true) {
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
            // Parallel transport, so the cross-section does not spin along the run.
            nrm = nrm.clone().addScaledVector(tangents[i], -nrm.dot(tangents[i]));
            if (nrm.lengthSq() < 1e-10) nrm = new THREE.Vector3().crossVectors(tangents[i], ref);
            nrm.normalize();
            const bin = new THREE.Vector3().crossVectors(tangents[i], nrm).normalize();
            const t = N > 1 ? i / (N - 1) : 0;
            const r = Math.max(radiusOf(t, i), 1e-5);
            for (let j = 0; j <= radialSegs; j++) {
                const a = (j / radialSegs) * TAU;
                const dir = nrm.clone().multiplyScalar(Math.cos(a) * r).addScaledVector(bin, Math.sin(a) * r);
                const p = points[i].clone().add(dir);
                const n = dir.clone().normalize();
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

    /**
     * One feather: base at the origin, tip at -z, with a droop and a vane that
     * narrows to a point. uv.v is remapped into [v0,v1] so a single painted
     * sheet can serve the folded coverts and the primaries that stick out past
     * them without ever leaving the same material.
     */
    function quill(len, wid, tipWid, droop, v0 = 0, v1 = 1) {
        const g = new THREE.PlaneGeometry(1, 1, 2, 8);
        g.rotateX(-Math.PI / 2);
        const p = g.attributes.position, uv = g.attributes.uv;
        for (let i = 0; i < p.count; i++) {
            const x = p.getX(i);
            const t = clamp(0.5 - p.getZ(i), 0, 1);
            const shape = Math.pow(Math.sin(Math.min(t, 0.995) * Math.PI * 0.80 + 0.30), 0.55);
            const nx = x * lerp(wid, tipWid, t) * shape;
            p.setX(i, nx);
            p.setZ(i, -t * len);
            p.setY(i, -droop * t * t + Math.abs(nx) * 0.10);
            uv.setY(i, lerp(v0, v1, t));
        }
        g.computeVertexNormals();
        return g;
    }

    /* ==========================================================
       1 · The light of the hour
       ========================================================== */

    // Twenty minutes after sunset. The sky still has a bar of ember low in the
    // west; everything else is coming from two man-made sources — a mercury
    // carpark lamp up and behind, and the shop's own warm window in front.
    const GLOW_DIR = V3(-0.86, 0, -0.51).normalize();   // where the sun went
    const C_ZEN = srgb(0x0a1230);
    const C_MID = srgb(0x18305a);
    const C_HOR = srgb(0x36486a);
    const C_EMBER = srgb(0xd0682f);
    const C_WIN = srgb(0xffc478);
    const C_SIGN = srgb(0xff4c34);
    const C_LAMP = srgb(0xd8e6ff);

    const FOG_COL = srgb(0x141d33);
    scene.fog = new THREE.FogExp2(FOG_COL.clone(), 0.0320);

    camera.position.set(1.62, 0.58, 1.94);

    const WALL_Z = -4.00;                 // the plane of the shopfront glass
    const LAMP_POS = V3(-3.95, 5.15, 2.35);
    const WIN = { x0: -2.62, x1: 0.92, y0: 0.96, y1: 2.44 };
    const SIGN = { x0: -3.00, x1: 2.62, y0: 2.80, y1: 3.36 };
    const PILE = new THREE.Vector2(0.02, -0.62);   // where the chips went over

    // One: the carpark lamp. It is the only thing here that throws a shadow,
    // and five birds' shadows swinging round the spill is most of the drama.
    const lamp = new THREE.SpotLight(0xcadcff, 190, 24, 0.66, 0.62, 2);
    lamp.position.copy(LAMP_POS);
    lamp.target.position.set(0.15, 0, -0.75);
    lamp.castShadow = true;
    lamp.shadow.mapSize.set(2048, 2048);
    lamp.shadow.camera.near = 1.4;
    lamp.shadow.camera.far = 16;
    lamp.shadow.bias = -0.00035;
    lamp.shadow.normalBias = 0.014;
    scene.add(lamp, lamp.target);

    // Two: the shop, spilling out of its own window. No shadow — a second
    // shadow map for a soft area source would be a lie and an expense both.
    const shopSpill = new THREE.PointLight(0xffbb70, 21, 11, 2);
    shopSpill.position.set(-0.75, 1.55, WALL_Z + 0.55);
    scene.add(shopSpill);

    // Three: what is left of the sky, cold and almost flat, so the top of every
    // white back reads blue rather than black.
    const skyFill = new THREE.DirectionalLight(0x6f8cc4, 0.55);
    skyFill.position.set(-9, 7, -6);
    scene.add(skyFill);

    scene.add(new THREE.HemisphereLight(0x2b3f6b, 0x101216, 0.85));
    scene.add(new THREE.AmbientLight(0x27324f, 0.30));

    const uTime = { value: 0 };
    // Where the running bird is, and how hard it just hit the water. The wet
    // asphalt reads both, so the rings in the puddles are its footfalls.
    const uRunner = { value: new THREE.Vector3(0, -1, 0) };

    /* ==========================================================
       2 · Painted textures
       ========================================================== */

    /* --- Asphalt, one 5 m tile ------------------------------------- */
    const asphaltTex = world.canvasTexture(1024, 1024, (g, cv) => {
        const S = cv.width;
        g.fillStyle = '#2e2f31';
        g.fillRect(0, 0, S, S);
        // Aggregate: the chips of bluestone that make up the mix.
        for (let i = 0; i < 26000; i++) {
            const x = Math.random() * S, y = Math.random() * S;
            const r = 1.0 + Math.random() * 4.2;
            const k = Math.random();
            g.fillStyle = k < 0.34 ? `rgba(120,124,130,${0.10 + Math.random() * 0.34})`
                : k < 0.68 ? `rgba(66,66,70,${0.16 + Math.random() * 0.36})`
                    : k < 0.9 ? `rgba(158,160,166,${0.06 + Math.random() * 0.20})`
                        : `rgba(196,168,132,${0.05 + Math.random() * 0.16})`;
            g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
        }
        // Cloudy patches — bitumen bleeds and old repairs.
        for (let i = 0; i < 160; i++) {
            const x = Math.random() * S, y = Math.random() * S, r = 50 + Math.random() * 210;
            const grad = g.createRadialGradient(x, y, 0, x, y, r);
            const v = Math.random() < 0.55 ? 18 : 118;
            grad.addColorStop(0, `rgba(${v},${v + 2},${v + 6},${0.03 + Math.random() * 0.07})`);
            grad.addColorStop(1, 'rgba(0,0,0,0)');
            g.fillStyle = grad;
            g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
        }
        // Cracks, and the tar someone brushed into them.
        for (let i = 0; i < 22; i++) {
            let x = Math.random() * S, y = Math.random() * S, a = Math.random() * TAU;
            g.strokeStyle = `rgba(16,16,18,${0.35 + Math.random() * 0.4})`;
            g.lineWidth = 1.2 + Math.random() * 3.4;
            g.beginPath(); g.moveTo(x, y);
            for (let k = 0; k < 16; k++) {
                a += (Math.random() - 0.5) * 1.1;
                x += Math.cos(a) * 24; y += Math.sin(a) * 24;
                g.lineTo(x, y);
            }
            g.stroke();
            g.strokeStyle = 'rgba(52,50,48,0.30)';
            g.lineWidth = 8 + Math.random() * 10;
            g.stroke();
        }
        // Loose grit gathered where nothing drives.
        g.fillStyle = 'rgba(150,142,124,0.30)';
        for (let i = 0; i < 2600; i++) g.fillRect(Math.random() * S, Math.random() * S, 1.4, 1.4);
    });
    asphaltTex.wrapS = asphaltTex.wrapT = THREE.RepeatWrapping;
    asphaltTex.repeat.set(14, 14);

    /* --- The shopfront window, lit from inside --------------------- */
    const windowTex = world.canvasTexture(1024, 448, (g, cv) => {
        const W = cv.width, H = cv.height;
        // The far wall of a takeaway shop: cream tile going yellow under fluoro.
        const bg = g.createLinearGradient(0, 0, 0, H);
        bg.addColorStop(0, '#fff3d2');
        bg.addColorStop(0.42, '#ffe3ab');
        bg.addColorStop(1, '#e8bf7c');
        g.fillStyle = bg;
        g.fillRect(0, 0, W, H);
        for (let x = 0; x < W; x += 34) {
            g.strokeStyle = 'rgba(214,178,120,0.35)'; g.lineWidth = 2;
            g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke();
        }
        for (let y = 0; y < H; y += 34) {
            g.strokeStyle = 'rgba(214,178,120,0.35)'; g.lineWidth = 2;
            g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke();
        }
        // Ceiling fluoro tubes, blown out.
        for (let i = 0; i < 3; i++) {
            const x = 90 + i * 320;
            const grad = g.createLinearGradient(x, 0, x + 200, 0);
            grad.addColorStop(0, 'rgba(255,255,255,0)');
            grad.addColorStop(0.5, 'rgba(255,255,255,0.95)');
            grad.addColorStop(1, 'rgba(255,255,255,0)');
            g.fillStyle = grad;
            g.fillRect(x, 14, 200, 20);
        }
        // The bain-marie: a glass box of hot golden things, glowing.
        const bm = g.createLinearGradient(0, H * 0.46, 0, H);
        bm.addColorStop(0, 'rgba(255,214,140,0.9)');
        bm.addColorStop(0.35, 'rgba(240,170,74,0.95)');
        bm.addColorStop(1, 'rgba(150,92,34,0.9)');
        g.fillStyle = bm;
        g.fillRect(60, H * 0.50, W - 260, H * 0.34);
        for (let i = 0; i < 700; i++) {   // the chips themselves, heaped
            const x = 70 + Math.random() * (W - 280);
            const y = H * 0.52 + Math.random() * H * 0.28;
            g.save();
            g.translate(x, y); g.rotate(Math.random() * TAU);
            g.fillStyle = Math.random() < 0.5 ? 'rgba(255,222,150,0.9)' : 'rgba(226,168,78,0.9)';
            g.fillRect(-11, -3, 22, 6);
            g.restore();
        }
        g.strokeStyle = 'rgba(255,255,255,0.55)'; g.lineWidth = 5;
        g.strokeRect(60, H * 0.50, W - 260, H * 0.34);
        // Menu board above, unreadable at this distance and all the better for it.
        g.fillStyle = 'rgba(40,44,52,0.88)';
        g.fillRect(W - 300, 60, 250, 150);
        g.fillStyle = 'rgba(255,240,190,0.85)';
        g.font = 'bold 22px Helvetica, Arial, sans-serif';
        const menu = ['FLAKE', 'POTATO CAKE', 'DIM SIM', 'MIN. CHIPS', 'CALAMARI'];
        menu.forEach((s, i) => g.fillText(s, W - 286, 92 + i * 26));
        g.fillStyle = 'rgba(255,132,84,0.9)';
        menu.forEach((_, i) => g.fillText('·', W - 92, 92 + i * 26));
        // Someone behind the counter, in silhouette, not looking out.
        g.fillStyle = 'rgba(58,44,34,0.62)';
        g.beginPath();
        g.ellipse(W * 0.30, H * 0.30, 40, 46, 0, 0, TAU); g.fill();
        g.fillRect(W * 0.30 - 62, H * 0.42, 124, H * 0.24);
        // The glass itself: a wash of reflection and old smears.
        g.globalAlpha = 0.22;
        for (let i = 0; i < 60; i++) {
            g.strokeStyle = '#ffffff';
            g.lineWidth = 2 + Math.random() * 12;
            const y = Math.random() * H;
            g.beginPath(); g.moveTo(0, y); g.lineTo(W, y + (Math.random() - 0.5) * 40); g.stroke();
        }
        g.globalAlpha = 1;
    });

    /* --- The lightbox sign ----------------------------------------- */
    const signTex = world.canvasTexture(1024, 128, (g, cv) => {
        const W = cv.width, H = cv.height;
        g.fillStyle = '#fbf6e8';
        g.fillRect(0, 0, W, H);
        // Acrylic goes uneven where the tubes sit behind it.
        for (let i = 0; i < 5; i++) {
            const x = (i + 0.5) * (W / 5);
            const grad = g.createRadialGradient(x, H / 2, 4, x, H / 2, 150);
            grad.addColorStop(0, 'rgba(255,255,255,0.9)');
            grad.addColorStop(1, 'rgba(255,250,232,0)');
            g.fillStyle = grad;
            g.fillRect(x - 150, 0, 300, H);
        }
        g.fillStyle = '#d8342a';
        g.font = 'bold 74px Georgia, serif';
        g.textBaseline = 'middle';
        g.fillText('OCEAN STAR', 40, H * 0.50);
        g.fillStyle = '#1b3f8a';
        g.font = 'bold 40px Helvetica, Arial, sans-serif';
        g.fillText('FISH  &  CHIPS', 545, H * 0.44);
        g.fillStyle = '#4a4a48';
        g.font = '24px Helvetica, Arial, sans-serif';
        g.fillText('OPEN  TILL  LATE', 545, H * 0.78);
        // Grime along the bottom lip, and one dead patch at the end.
        const dirt = g.createLinearGradient(0, H - 26, 0, H);
        dirt.addColorStop(0, 'rgba(90,84,70,0)');
        dirt.addColorStop(1, 'rgba(70,64,52,0.5)');
        g.fillStyle = dirt;
        g.fillRect(0, H - 26, W, 26);
        g.fillStyle = 'rgba(60,56,50,0.34)';
        g.fillRect(W - 96, 0, 96, H);
    });

    /* --- Rendered wall of the shop --------------------------------- */
    const wallTex = world.canvasTexture(512, 512, (g, cv) => {
        const S = cv.width;
        g.fillStyle = '#6d6a63';
        g.fillRect(0, 0, S, S);
        for (let i = 0; i < 14000; i++) {
            g.fillStyle = Math.random() < 0.5
                ? `rgba(120,116,108,${0.05 + Math.random() * 0.20})`
                : `rgba(48,46,42,${0.05 + Math.random() * 0.22})`;
            g.fillRect(Math.random() * S, Math.random() * S, 1 + Math.random() * 3, 1 + Math.random() * 3);
        }
        for (let i = 0; i < 40; i++) {
            const x = Math.random() * S, y = Math.random() * S, r = 20 + Math.random() * 110;
            const grad = g.createRadialGradient(x, y, 0, x, y, r);
            grad.addColorStop(0, `rgba(40,38,34,${0.05 + Math.random() * 0.12})`);
            grad.addColorStop(1, 'rgba(0,0,0,0)');
            g.fillStyle = grad;
            g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
        }
        // Rain streaks off the top edge.
        g.globalAlpha = 0.18;
        for (let i = 0; i < 90; i++) {
            g.strokeStyle = '#3a3833';
            g.lineWidth = 1 + Math.random() * 5;
            const x = Math.random() * S;
            g.beginPath(); g.moveTo(x, 0); g.lineTo(x + (Math.random() - 0.5) * 8, Math.random() * S * 0.8); g.stroke();
        }
        g.globalAlpha = 1;
    });
    wallTex.wrapS = wallTex.wrapT = THREE.RepeatWrapping;
    wallTex.repeat.set(5, 2);

    /* --- A chip: hot, golden, browned at the ends ------------------ */
    const chipTex = world.canvasTexture(256, 256, (g, cv) => {
        const S = cv.width;
        const grad = g.createLinearGradient(0, 0, 0, S);
        grad.addColorStop(0, '#bb7c2a');
        grad.addColorStop(0.20, '#e6b25c');
        grad.addColorStop(0.52, '#f2cc7c');
        grad.addColorStop(0.84, '#e0a84e');
        grad.addColorStop(1, '#a96b23');
        g.fillStyle = grad;
        g.fillRect(0, 0, S, S);
        for (let i = 0; i < 2400; i++) {
            g.fillStyle = Math.random() < 0.5
                ? `rgba(148,88,24,${0.05 + Math.random() * 0.28})`
                : `rgba(255,238,190,${0.05 + Math.random() * 0.30})`;
            g.beginPath();
            g.arc(Math.random() * S, Math.random() * S, 0.8 + Math.random() * 3.0, 0, TAU);
            g.fill();
        }
        for (let i = 0; i < 50; i++) {
            const x = Math.random() * S, y = Math.random() * S, r = 4 + Math.random() * 12;
            const rg = g.createRadialGradient(x, y, 0, x, y, r);
            rg.addColorStop(0, 'rgba(116,60,12,0.32)');
            rg.addColorStop(1, 'rgba(116,60,12,0)');
            g.fillStyle = rg;
            g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
        }
        g.fillStyle = 'rgba(255,255,255,0.75)';
        for (let i = 0; i < 240; i++) g.fillRect(Math.random() * S, Math.random() * S, 1.4, 1.4);
    });

    /* --- Butcher's paper and cardboard the chips came in ----------- */
    const cardTex = world.canvasTexture(512, 512, (g, cv) => {
        const S = cv.width;
        g.fillStyle = '#efe4c8';
        g.fillRect(0, 0, S, S);
        for (let i = 0; i < 9000; i++) {
            g.fillStyle = Math.random() < 0.5 ? 'rgba(206,190,158,0.32)' : 'rgba(255,252,242,0.4)';
            g.fillRect(Math.random() * S, Math.random() * S, 1 + Math.random() * 4, 1);
        }
        // Grease coming through from underneath.
        for (let i = 0; i < 30; i++) {
            const x = Math.random() * S, y = Math.random() * S, r = 26 + Math.random() * 110;
            const grad = g.createRadialGradient(x, y, 0, x, y, r);
            grad.addColorStop(0, `rgba(192,150,84,${0.26 + Math.random() * 0.26})`);
            grad.addColorStop(0.6, 'rgba(200,164,100,0.14)');
            grad.addColorStop(1, 'rgba(204,174,112,0)');
            g.fillStyle = grad;
            g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
        }
        g.strokeStyle = 'rgba(178,48,40,0.5)';
        g.lineWidth = 10;
        g.beginPath(); g.moveTo(0, 70); g.lineTo(S, 70); g.stroke();
        g.beginPath(); g.moveTo(0, S - 70); g.lineTo(S, S - 70); g.stroke();
        g.fillStyle = 'rgba(64,60,54,0.32)';
        g.font = 'bold 30px Georgia, serif';
        g.fillText('OCEAN STAR', 40, 132);
        g.font = '18px Georgia, serif';
        g.fillStyle = 'rgba(64,60,54,0.20)';
        for (let i = 0; i < 6; i++) g.fillText('minimum chips · potato cake · flake', 40, 178 + i * 28);
    });

    /* --- Gull plumage ----------------------------------------------
       One sheet per bird-age, with uv.v running shoulder (0) to wingtip (1).
       The folded coverts take v up to 0.78 and the primaries that stick out
       past the tail take the rest, so a whole wing is one material.        */
    function wingCanvas(juv) {
        return world.canvasTexture(256, 512, (g, cv) => {
            const W = cv.width, H = cv.height;
            const grad = g.createLinearGradient(0, 0, 0, H);
            grad.addColorStop(0.00, '#fbfcfd');
            grad.addColorStop(0.14, '#dfe6ee');
            grad.addColorStop(0.32, '#b7c3d0');
            grad.addColorStop(0.60, '#a5b2c0');
            grad.addColorStop(0.74, '#8a97a5');
            grad.addColorStop(0.80, '#25282e');
            grad.addColorStop(1.00, '#101216');
            g.fillStyle = grad;
            g.fillRect(0, 0, W, H);
            // Scalloped covert rows: a pale crescent with a soft shadow beneath.
            for (let row = 0; row < 15; row++) {
                const v = 0.06 + row * 0.048;
                if (v > 0.77) break;
                const y = v * H;
                const n = 5 + (row % 3);
                for (let i = 0; i < n; i++) {
                    const x = (i + 0.5) * (W / n) + Math.sin(row * 2.1 + i) * 5;
                    const rw = W / n * 0.62, rh = 14 + row * 0.7;
                    g.fillStyle = `rgba(255,255,255,${0.12 + 0.07 * hash2(row, i)})`;
                    g.beginPath(); g.ellipse(x, y, rw, rh, 0, 0, TAU); g.fill();
                    g.fillStyle = 'rgba(92,104,118,0.16)';
                    g.beginPath(); g.ellipse(x, y + rh * 0.74, rw * 0.95, rh * 0.34, 0, 0, TAU); g.fill();
                }
            }
            if (juv) {
                // First-year: brown chevrons right across the coverts.
                for (let i = 0; i < 200; i++) {
                    const v = 0.07 + Math.random() * 0.66;
                    const x = Math.random() * W, y = v * H, s = 6 + Math.random() * 15;
                    g.strokeStyle = `rgba(${116 + Math.random() * 36},${86 + Math.random() * 28},${46 + Math.random() * 24},${0.30 + Math.random() * 0.42})`;
                    g.lineWidth = 3 + Math.random() * 4;
                    g.beginPath();
                    g.moveTo(x - s, y + s * 0.55); g.lineTo(x, y - s * 0.4); g.lineTo(x + s, y + s * 0.55);
                    g.stroke();
                }
                g.fillStyle = 'rgba(94,72,42,0.44)';
                g.fillRect(0, H * 0.78, W, H * 0.22);
            }
            // Shafts running out to the tip.
            g.strokeStyle = 'rgba(58,62,70,0.20)';
            g.lineWidth = 1.4;
            for (let i = 0; i < 9; i++) {
                const x = (i + 0.5) * (W / 9);
                g.beginPath(); g.moveTo(x, H * 0.10); g.lineTo(x + (W / 2 - x) * 0.22, H); g.stroke();
            }
            // White trailing edge, and the mirrors at the very tips.
            g.fillStyle = 'rgba(255,255,255,0.85)';
            g.fillRect(0, 0, 9, H * 0.86);
            for (let i = 0; i < 3; i++) {
                g.fillStyle = juv ? 'rgba(236,232,222,0.5)' : 'rgba(255,255,255,0.94)';
                g.beginPath(); g.ellipse(W * (0.26 + i * 0.23), H * 0.94, 15, 11, 0, 0, TAU); g.fill();
            }
        });
    }
    const wingTexAdult = wingCanvas(false);
    const wingTexJuv = wingCanvas(true);

    function tailCanvas(juv) {
        return world.canvasTexture(64, 256, (g, cv) => {
            const W = cv.width, H = cv.height;
            g.fillStyle = '#fbfbf8';
            g.fillRect(0, 0, W, H);
            const grad = g.createLinearGradient(0, 0, 0, H);
            grad.addColorStop(0, 'rgba(192,200,208,0.5)');
            grad.addColorStop(0.4, 'rgba(255,255,255,0)');
            g.fillStyle = grad;
            g.fillRect(0, 0, W, H);
            if (juv) {   // the dusky subterminal band a first-year still carries
                const b = g.createLinearGradient(0, H * 0.66, 0, H);
                b.addColorStop(0, 'rgba(118,100,70,0)');
                b.addColorStop(0.45, 'rgba(102,84,56,0.74)');
                b.addColorStop(0.86, 'rgba(118,100,72,0.55)');
                b.addColorStop(1, 'rgba(238,234,222,0.6)');
                g.fillStyle = b;
                g.fillRect(0, H * 0.66, W, H * 0.34);
            }
            g.strokeStyle = 'rgba(148,154,162,0.28)';
            g.lineWidth = 2;
            g.beginPath(); g.moveTo(W * 0.5, 0); g.lineTo(W * 0.5, H); g.stroke();
            g.globalAlpha = 0.13;
            for (let i = 0; i < 90; i++) {
                g.strokeStyle = '#8b929a'; g.lineWidth = 1;
                const y = Math.random() * H;
                g.beginPath(); g.moveTo(W * 0.5, y); g.lineTo(Math.random() * W, y + 6); g.stroke();
            }
            g.globalAlpha = 1;
        });
    }
    const tailTexAdult = tailCanvas(false);
    const tailTexJuv = tailCanvas(true);

    /** Body feathering: white, but not flat white — faint quilting and shadow. */
    const bodyTex = world.canvasTexture(512, 512, (g, cv) => {
        const S = cv.width;
        g.fillStyle = '#fdfdfb';
        g.fillRect(0, 0, S, S);
        for (let row = 0; row < 26; row++) {
            const y = (row + 0.5) * (S / 26), n = 20;
            for (let i = 0; i < n; i++) {
                const x = (i + (row % 2) * 0.5) * (S / n);
                const rw = S / n * 0.62, rh = S / 26 * 0.78;
                g.fillStyle = `rgba(204,212,222,${0.10 + 0.07 * hash2(row, i)})`;
                g.beginPath(); g.ellipse(x, y + rh * 0.5, rw, rh * 0.55, 0, 0, TAU); g.fill();
                g.fillStyle = 'rgba(255,255,255,0.5)';
                g.beginPath(); g.ellipse(x, y - rh * 0.1, rw * 0.8, rh * 0.42, 0, 0, TAU); g.fill();
            }
        }
        g.fillStyle = 'rgba(196,206,218,0.10)';
        for (let i = 0; i < 500; i++) g.fillRect(Math.random() * S, Math.random() * S, 1 + Math.random() * 6, 1);
    });
    bodyTex.wrapS = bodyTex.wrapT = THREE.RepeatWrapping;

    /* --- A soft round blob, for breath and haze -------------------- */
    const puffTex = world.canvasTexture(128, 128, (g, cv) => {
        const S = cv.width;
        const grad = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
        grad.addColorStop(0, 'rgba(255,255,255,0.95)');
        grad.addColorStop(0.42, 'rgba(255,255,255,0.36)');
        grad.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = grad;
        g.fillRect(0, 0, S, S);
    });

    /* ==========================================================
       3 · Sky
       ========================================================== */

    // Shared by the sky dome and by the puddles, which have to reflect it —
    // one function, so the water can never disagree with what is above it.
    const SKY_GLSL = /* glsl */`
      vec3 skyColor(vec3 d, vec3 glowDir, vec3 zen, vec3 mid, vec3 hor, vec3 ember) {
        float h = d.y;
        vec3 col = mix(hor, mid, smoothstep(-0.03, 0.30, h));
        col = mix(col, zen, smoothstep(0.14, 0.88, h));
        vec3 dh = normalize(vec3(d.x, 0.0, d.z) + vec3(1e-5));
        float g = max(dot(dh, glowDir), 0.0);
        float band = smoothstep(0.36, -0.03, abs(h - 0.015));
        col += ember * pow(g, 3.0) * band * 0.95;
        col += ember * 0.11 * smoothstep(0.09, -0.05, h);     // sodium haze off the suburb
        return col;
      }
    `;

    const NOISE_GLSL = /* glsl */`
      float h21(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
      float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
        float a = h21(i), b = h21(i + vec2(1.0, 0.0)), c = h21(i + vec2(0.0, 1.0)), d = h21(i + vec2(1.0, 1.0));
        return mix(mix(a, b, f.x), mix(c, d, f.x), f.y); }
      float fbm(vec2 p){ float s = 0.0, a = 0.5; for(int i = 0; i < 4; i++){ s += a * vn(p); p *= 2.06; a *= 0.5; } return s; }
    `;

    const skyUniforms = {
        uTime,
        uGlowDir: { value: GLOW_DIR.clone() },
        uZen: { value: C_ZEN.clone() }, uMid: { value: C_MID.clone() },
        uHor: { value: C_HOR.clone() }, uEmber: { value: C_EMBER.clone() },
    };
    const sky = new THREE.Mesh(
        new THREE.SphereGeometry(900, 40, 26),
        new THREE.ShaderMaterial({
            side: THREE.BackSide, depthWrite: false, fog: false, uniforms: skyUniforms,
            vertexShader: `varying vec3 vDir;
              void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
            fragmentShader: SKY_GLSL + /* glsl */`
              varying vec3 vDir;
              uniform float uTime;
              uniform vec3 uGlowDir, uZen, uMid, uHor, uEmber;
              float h31(vec3 p){ return fract(sin(dot(p, vec3(12.99, 78.23, 45.16))) * 43758.5453); }
              void main(){
                vec3 d = normalize(vDir);
                vec3 col = skyColor(d, uGlowDir, uZen, uMid, uHor, uEmber);
                // The first stars, thin and only where the sky has gone dark enough.
                vec3 cell = floor(d * 260.0);
                float s = h31(cell);
                float star = smoothstep(0.9972, 0.99955, s) * smoothstep(0.14, 0.62, d.y);
                star *= 0.55 + 0.45 * sin(uTime * (1.4 + s * 5.0) + s * 40.0);
                col += vec3(0.86, 0.90, 1.0) * star * 1.6;
                gl_FragColor = vec4(col, 1.0);
              }`,
        })
    );
    sky.renderOrder = -10;
    scene.add(world.ghost(sky));

    /* --- Torn cloud, low and lit from beneath by the town ----------- */
    const cloudTex = world.canvasTexture(512, 256, (g, cv) => {
        const W = cv.width, H = cv.height;
        const base = H * 0.72;
        const puff = (x, y, r, a) => {
            const rad = g.createRadialGradient(x, y - r * 0.2, r * 0.1, x, y, r);
            rad.addColorStop(0, `rgba(150,164,196,${a})`);
            rad.addColorStop(0.6, `rgba(96,110,146,${a * 0.7})`);
            rad.addColorStop(1, 'rgba(70,84,118,0)');
            g.fillStyle = rad;
            g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
        };
        for (let i = 0; i < 16; i++) {
            const t = i / 15;
            const lift = Math.sin(t * Math.PI) * H * 0.28;
            puff(W * 0.10 + t * W * 0.80 + rr(-16, 16), base - lift - rr(2, 26),
                rr(22, 58) * (0.6 + Math.sin(t * Math.PI) * 0.7), rr(0.42, 0.86));
        }
        // The underside catches the ember and the suburb's own orange.
        g.globalCompositeOperation = 'source-atop';
        const shade = g.createLinearGradient(0, base - H * 0.3, 0, base + 8);
        shade.addColorStop(0, 'rgba(120,134,170,0)');
        shade.addColorStop(0.7, 'rgba(150,106,86,0.35)');
        shade.addColorStop(1, 'rgba(176,110,66,0.55)');
        g.fillStyle = shade;
        g.fillRect(0, 0, W, H);
        g.globalCompositeOperation = 'source-over';
    });
    for (let i = 0; i < 14; i++) {
        const sp = new THREE.Sprite(new THREE.SpriteMaterial({
            map: cloudTex, transparent: true, depthWrite: false, fog: false,
            opacity: rr(0.30, 0.70),
        }));
        const ang = rr(0, TAU), rad = rr(120, 520);
        const sz = rr(90, 240) * (rad / 300 + 0.4);
        sp.position.set(Math.cos(ang) * rad, rr(46, 150) + rad * 0.04, Math.sin(ang) * rad);
        sp.scale.set(sz, sz * rr(0.30, 0.48), 1);
        sp.renderOrder = -5;
        scene.add(world.ghost(sp));
    }

    /* --- What the horizon is, past the carpark ---------------------- */
    {
        // Rooflines, aerials and one water tower, all one dark merged band, so
        // the sky is stopped by a town rather than by nothing.
        const parts = [];
        for (let i = 0; i < 74; i++) {
            const a = rr(0, TAU), rad = rr(24, 48);
            const w = rr(4, 16), h = rr(2.4, 7.0), d = rr(4, 12);
            parts.push(box(w, h, d, Math.cos(a) * rad, h * 0.5, Math.sin(a) * rad, 0, rr(0, TAU), 0));
            if (rnd() < 0.28)      // a pitched roof on top of some of them
                parts.push(placed(new THREE.ConeGeometry(w * 0.72, rr(1.2, 2.4), 4),
                    Math.cos(a) * rad, h + 0.6, Math.sin(a) * rad, 0, Math.PI / 4, 0));
            if (rnd() < 0.2)       // a pole, an aerial, a palm
                parts.push(box(0.16, rr(3, 8), 0.16, Math.cos(a) * rad + rr(-4, 4), h + 2.4, Math.sin(a) * rad + rr(-4, 4)));
        }
        const town = new THREE.Mesh(mergeGeometries(parts), new THREE.MeshBasicMaterial({
            color: srgb(0x0d1626), fog: true,
        }));
        scene.add(world.ghost(town));
    }

    /* ==========================================================
       4 · The wet asphalt

       The most interesting surface here is the one everybody is standing on.
       It is a plain MeshStandardMaterial so it takes the lamp's shadows
       honestly, with the wet written into it at compile time: puddles that go
       smooth and dark, ripple rings spreading from wherever the running bird
       last put its foot down, painted bay lines worn where the tyres go, and —
       because a mirror at your feet is the whole reason to shoot a carpark at
       night — the shopfront reflected by an actual ray bounced off the water
       and intersected with the plane of the glass.
       ========================================================== */

    const asphaltMat = new THREE.MeshStandardMaterial({
        map: asphaltTex, color: srgb(0x51535a), roughness: 0.94, metalness: 0.0,
    });
    const groundUniforms = {
        uTime, uRunner,
        uGlowDir: { value: GLOW_DIR.clone() },
        uZen: { value: C_ZEN.clone() }, uMid: { value: C_MID.clone() },
        uHor: { value: C_HOR.clone() }, uEmber: { value: C_EMBER.clone() },
        uWinRect: { value: new THREE.Vector4(WIN.x0, WIN.x1, WIN.y0, WIN.y1) },
        uSignRect: { value: new THREE.Vector4(SIGN.x0, SIGN.x1, SIGN.y0, SIGN.y1) },
        uWallZ: { value: WALL_Z },
        uWinCol: { value: C_WIN.clone() },
        uSignCol: { value: C_SIGN.clone() },
        uLampPos: { value: LAMP_POS.clone() },
        uLampCol: { value: C_LAMP.clone() },
        uPile: { value: PILE.clone() },
    };
    asphaltMat.onBeforeCompile = (sh) => {
        Object.assign(sh.uniforms, groundUniforms);
        sh.vertexShader = sh.vertexShader
            .replace('#include <common>', `#include <common>
                varying vec3 vWPos;`)
            .replace('#include <begin_vertex>', `#include <begin_vertex>
                vWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;`);
        sh.fragmentShader = sh.fragmentShader
            .replace('#include <common>', `#include <common>
                varying vec3 vWPos;
                uniform float uTime, uWallZ;
                uniform vec3 uRunner, uGlowDir, uZen, uMid, uHor, uEmber, uWinCol, uSignCol, uLampPos, uLampCol;
                uniform vec4 uWinRect, uSignRect;
                uniform vec2 uPile;
                float gWet; vec3 gPert;
                ${NOISE_GLSL}
                ${SKY_GLSL}

                // How much standing water is at a point: broad shallow sheets in
                // the low corners of the apron, plus three proper puddles that
                // have not gone anywhere since the rain.
                float wetness(vec2 p) {
                  float sheet = smoothstep(0.44, 0.70, fbm(p * 0.42 + 3.7));
                  float pud = 0.0;
                  pud = max(pud, smoothstep(1.15, 0.30, length(p - vec2(-1.55,  0.95))));
                  pud = max(pud, smoothstep(0.95, 0.22, length(p - vec2( 2.10, -1.35))));
                  pud = max(pud, smoothstep(1.40, 0.45, length(p - vec2( 0.35,  2.35))));
                  pud *= 0.55 + 0.45 * fbm(p * 1.9);
                  return clamp(max(sheet * 0.62, pud), 0.0, 1.0);
                }`)

            // Wet, paint and grease, decided once and remembered for the chunks
            // further down that need it.
            .replace('#include <map_fragment>', `#include <map_fragment>
                {
                  vec2 p = vWPos.xz;
                  gWet = wetness(p);

                  // Painted bay lines: 2.85 m apart, only over the parking end of
                  // the apron, and worn to nothing where the tyres cross them.
                  float bx = abs(fract((p.x + 1.42) / 2.85) - 0.5) * 2.85;
                  float line = smoothstep(0.062, 0.034, bx);
                  line *= smoothstep(-3.35, -3.05, p.y) * smoothstep(2.95, 2.55, p.y);
                  line *= smoothstep(0.28, 0.62, fbm(p * 2.6 + 11.0));
                  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.62, 0.56, 0.34), line * 0.82);

                  // Water darkens what it sits on, and the tyre lanes are darker still.
                  float lane = smoothstep(0.55, 0.10, abs(abs(fract((p.x + 1.42) / 2.85) - 0.5) * 2.85 - 1.15));
                  diffuseColor.rgb *= 1.0 - 0.24 * lane;
                  diffuseColor.rgb *= mix(1.0, 0.34, gWet);

                  // The grease halo the chips have already left on the ground.
                  float halo = smoothstep(0.52, 0.05, length(p - uPile));
                  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.10, 0.085, 0.062), halo * 0.5);

                  // Ripples. One field of standing chop, and rings spreading from
                  // wherever the running bird last hit the water.
                  vec2 dR = p - uRunner.xy;
                  float rd = length(dR);
                  float ring = sin(rd * 42.0 - uTime * 11.0) * exp(-rd * 2.4) * uRunner.z;
                  float chop = (fbm(p * 9.0 + vec2(uTime * 0.13, -uTime * 0.09)) - 0.5) * 0.22;
                  vec2 grad = normalize(dR + vec2(1e-4)) * ring * 0.55;
                  gPert = vec3(grad.x + chop, 0.0, grad.y - chop) * gWet;
                }`)

            .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
                roughnessFactor = mix(roughnessFactor, 0.045, gWet * 0.94);`)

            .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
                normal = normalize(normal + (viewMatrix * vec4(gPert, 0.0)).xyz);`)

            // What the water gives back: sky, the shopfront reflected off the
            // actual plane of the glass, the lamp, and one rainbow of two-stroke
            // by the grate.
            .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
                if (gWet > 0.004) {
                  vec3 wn = normalize(vec3(0.0, 1.0, 0.0) + gPert * 0.85);
                  vec3 V = normalize(cameraPosition - vWPos);
                  vec3 R = reflect(-V, wn);
                  float F = 0.022 + 0.978 * pow(1.0 - clamp(dot(wn, V), 0.0, 1.0), 5.0);

                  vec3 refl = skyColor(R, uGlowDir, uZen, uMid, uHor, uEmber) * 0.55;

                  // Ray, meet plane of glass.
                  if (R.z < -0.0015) {
                    float tHit = (uWallZ - vWPos.z) / R.z;
                    if (tHit > 0.0) {
                      vec3 hit = vWPos + R * tHit;
                      float wx = smoothstep(uWinRect.x - 0.09, uWinRect.x + 0.09, hit.x)
                               * smoothstep(uWinRect.y + 0.09, uWinRect.y - 0.09, hit.x);
                      float wy = smoothstep(uWinRect.z - 0.10, uWinRect.z + 0.14, hit.y)
                               * smoothstep(uWinRect.w + 0.10, uWinRect.w - 0.14, hit.y);
                      refl += uWinCol * wx * wy * 2.3;
                      float sx = smoothstep(uSignRect.x - 0.07, uSignRect.x + 0.07, hit.x)
                               * smoothstep(uSignRect.y + 0.07, uSignRect.y - 0.07, hit.x);
                      float sy = smoothstep(uSignRect.z - 0.05, uSignRect.z + 0.09, hit.y)
                               * smoothstep(uSignRect.w + 0.05, uSignRect.w - 0.09, hit.y);
                      refl += mix(uSignCol, vec3(1.0), 0.45) * sx * sy * 1.9;
                    }
                  }

                  // The lamp, as a tight glossy lobe rather than a second light.
                  vec3 toLamp = normalize(uLampPos - vWPos);
                  refl += uLampCol * pow(max(dot(R, toLamp), 0.0), 340.0) * 26.0;
                  refl += uLampCol * pow(max(dot(R, toLamp), 0.0), 26.0) * 0.35;

                  // Two-stroke by the stormwater grate: an angle, not a colour.
                  float oil = smoothstep(1.05, 0.20, length(vWPos.xz - vec2(3.30, 2.60)));
                  if (oil > 0.001) {
                    float band = (1.0 - clamp(dot(wn, V), 0.0, 1.0)) * 9.0
                               + fbm(vWPos.xz * 3.4) * 5.0;
                    vec3 sheen = vec3(0.5) + 0.5 * vec3(sin(band), sin(band + 2.094), sin(band + 4.188));
                    refl = mix(refl, refl * sheen * 1.5 + sheen * 0.08, oil * 0.72);
                  }

                  totalEmissiveRadiance += refl * F * gWet;
                }`);
    };
    asphaltMat.customProgramCacheKey = () => 'wetasphalt';

    const apronGeo = new THREE.PlaneGeometry(110, 110, 120, 120);
    apronGeo.rotateX(-Math.PI / 2);
    {   // The apron falls a little toward the grate, and is not flat anywhere.
        const p = apronGeo.attributes.position;
        for (let i = 0; i < p.count; i++) {
            const x = p.getX(i), z = p.getZ(i);
            const r = Math.hypot(x - 3.30, z - 2.60);
            let y = -smooth(6.0, 0.4, r) * 0.045;
            y += (fbm2(x * 0.5, z * 0.5, 3) - 0.5) * 0.022;
            y += (fbm2(x * 0.12, z * 0.12, 2) - 0.5) * 0.05;
            // Dead flat where the birds are. Five sets of webbed feet at this
            // scale will find a three-centimetre hollow and stand in mid-air
            // over it, so the arena is levelled and the character kept outside.
            p.setY(i, y * smooth(1.45, 3.70, Math.hypot(x - PILE.x, z - PILE.y)));
        }
        apronGeo.computeVertexNormals();
    }
    const apron = new THREE.Mesh(apronGeo, asphaltMat);
    apron.receiveShadow = true;
    scene.add(world.ground(apron));

    /* ==========================================================
       5 · The shop, and everything else standing about
       ========================================================== */

    const MAT = {
        wall: new THREE.MeshStandardMaterial({ map: wallTex, color: srgb(0x7b7870), roughness: 0.92 }),
        trim: new THREE.MeshStandardMaterial({ color: srgb(0x1d3a72), roughness: 0.42, metalness: 0.25 }),
        steel: new THREE.MeshStandardMaterial({ color: srgb(0x8b9099), roughness: 0.44, metalness: 0.70 }),
        dark: new THREE.MeshStandardMaterial({ color: srgb(0x24262b), roughness: 0.78, metalness: 0.15 }),
        plastic: new THREE.MeshStandardMaterial({ color: srgb(0x2f5c35), roughness: 0.62 }),
        card: new THREE.MeshStandardMaterial({ map: cardTex, color: srgb(0xffffff), roughness: 0.94, side: THREE.DoubleSide }),
        chip: new THREE.MeshStandardMaterial({ map: chipTex, color: srgb(0xffffff), roughness: 0.58 }),
        kerb: new THREE.MeshStandardMaterial({ color: srgb(0x82817c), roughness: 0.88 }),
    };

    /* --- The building ---------------------------------------------- */
    {
        const parts = [];
        // The wall, cut around the window and the doorway rather than through them.
        parts.push(box(13.0, 4.30, 0.30, 0, 2.15, WALL_Z - 0.15));            // the mass behind
        parts.push(box(13.0, 0.34, 0.42, 0, 3.53, WALL_Z + 0.06));            // fascia over the sign
        parts.push(box(3.20, 1.00, 0.20, -0.85, 0.48, WALL_Z + 0.05));        // stallboard under the glass
        parts.push(box(0.24, 2.60, 0.24, -2.86, 1.30, WALL_Z + 0.04));        // mullions
        parts.push(box(0.24, 2.60, 0.24, 1.14, 1.30, WALL_Z + 0.04));
        parts.push(box(0.24, 2.60, 0.24, 2.44, 1.30, WALL_Z + 0.04));
        parts.push(box(3.90, 0.30, 0.26, -0.85, 2.60, WALL_Z + 0.04));        // window head
        parts.push(box(1.40, 0.28, 0.26, 1.80, 2.40, WALL_Z + 0.04));         // door head
        // The footpath step the shop sits on.
        parts.push(box(13.0, 0.14, 1.55, 0, 0.07, WALL_Z + 0.80));
        const shell = new THREE.Mesh(mergeGeometries(parts), MAT.wall);
        shell.castShadow = shell.receiveShadow = true;
        scene.add(shell);
    }

    // The window, and the door beside it: emissive sheets, not lights. The one
    // real lamp inside the shop is the PointLight already spending its budget.
    {
        const glassMat = new THREE.MeshStandardMaterial({
            map: windowTex, emissive: 0xffffff, emissiveMap: windowTex,
            emissiveIntensity: 2.05, color: 0x000000, roughness: 0.2,
        });
        const glass = new THREE.Mesh(
            new THREE.PlaneGeometry(WIN.x1 - WIN.x0, WIN.y1 - WIN.y0),
            glassMat);
        glass.position.set((WIN.x0 + WIN.x1) / 2, (WIN.y0 + WIN.y1) / 2, WALL_Z + 0.02);
        scene.add(glass);

        const doorMat = new THREE.MeshStandardMaterial({
            map: windowTex, emissive: 0xffffff, emissiveMap: windowTex,
            emissiveIntensity: 1.55, color: 0x000000, roughness: 0.2,
        });
        const door = new THREE.Mesh(new THREE.PlaneGeometry(1.22, 2.22), doorMat);
        door.position.set(1.80, 1.12, WALL_Z + 0.02);
        scene.add(door);
    }

    // The lightbox. Its face is the brightest thing at ground level and the
    // thing the puddles are chiefly reflecting.
    {
        const g = new THREE.Group();
        const boxGeo = box(SIGN.x1 - SIGN.x0 + 0.10, SIGN.y1 - SIGN.y0 + 0.10, 0.22,
            (SIGN.x0 + SIGN.x1) / 2, (SIGN.y0 + SIGN.y1) / 2, WALL_Z + 0.11);
        const shell = new THREE.Mesh(boxGeo, MAT.trim);
        shell.castShadow = true;
        g.add(shell);
        const face = new THREE.Mesh(
            new THREE.PlaneGeometry(SIGN.x1 - SIGN.x0, SIGN.y1 - SIGN.y0),
            new THREE.MeshStandardMaterial({
                map: signTex, emissive: 0xffffff, emissiveMap: signTex,
                emissiveIntensity: 2.4, color: 0x000000, roughness: 0.3,
            }));
        face.position.set((SIGN.x0 + SIGN.x1) / 2, (SIGN.y0 + SIGN.y1) / 2, WALL_Z + 0.225);
        g.add(face);
        scene.add(world.part('sign_00', g));
    }

    /* --- The awning ------------------------------------------------- */
    {
        const parts = [];
        parts.push(box(9.4, 0.06, 1.62, -0.6, 2.66, WALL_Z + 0.86, 0.075));
        parts.push(box(9.4, 0.16, 0.08, -0.6, 2.60, WALL_Z + 1.65));           // the drip edge
        for (let i = 0; i < 5; i++)                                            // tie rods back to the wall
            parts.push(placed(new THREE.CylinderGeometry(0.018, 0.018, 1.9, 6),
                -4.8 + i * 2.1, 2.95, WALL_Z + 0.85, Math.PI / 2 - 0.62));
        const aw = new THREE.Mesh(mergeGeometries(parts), MAT.trim);
        aw.castShadow = aw.receiveShadow = true;
        scene.add(aw);
    }

    /* --- The carpark lamp it all happens under ---------------------- */
    {
        const parts = [];
        parts.push(placed(new THREE.CylinderGeometry(0.075, 0.10, 5.05, 10), 0, 2.52, 0));
        parts.push(placed(new THREE.CylinderGeometry(0.16, 0.20, 0.34, 10), 0, 0.17, 0));
        parts.push(tube([V3(0, 5.0, 0), V3(0.14, 5.24, -0.05), V3(0.46, 5.32, -0.14), V3(0.78, 5.30, -0.24)],
            () => 0.055, 8));
        const pole = new THREE.Mesh(mergeGeometries(parts), MAT.steel);
        pole.position.copy(LAMP_POS).setY(0);
        pole.position.x -= 0.78; pole.position.z += 0.24;
        pole.castShadow = true;
        scene.add(pole);

        // The lantern: a shallow shell with an emissive lens under it.
        const head = new THREE.Group();
        head.position.copy(LAMP_POS);
        const shell = new THREE.Mesh(
            new THREE.CylinderGeometry(0.30, 0.16, 0.14, 12), MAT.steel);
        shell.position.y = 0.09;
        head.add(shell);
        const lens = new THREE.Mesh(
            new THREE.SphereGeometry(0.16, 14, 8, 0, TAU, Math.PI * 0.42, Math.PI * 0.58),
            new THREE.MeshStandardMaterial({
                color: 0x000000, emissive: 0xd6e6ff, emissiveIntensity: 4.2, roughness: 0.15,
            }));
        head.add(lens);
        scene.add(world.ghost(head));
    }

    /* --- Bollards, in one instanced row ----------------------------- */
    {
        const geo = mergeGeometries([
            tube([V3(0, 0, 0), V3(0, 0.72, 0), V3(0, 0.86, 0)], (t) => lerp(0.058, 0.050, t), 10),
            placed(new THREE.SphereGeometry(0.052, 10, 6), 0, 0.86, 0),
            placed(new THREE.TorusGeometry(0.055, 0.008, 5, 12), 0, 0.70, 0, Math.PI / 2),
        ]);
        const COUNT = 9;
        const bollards = new THREE.InstancedMesh(geo, MAT.steel, COUNT);
        const d = new THREE.Object3D();
        for (let i = 0; i < COUNT; i++) {
            d.position.set(-5.6 + i * 1.42, 0, WALL_Z + 1.92);
            d.rotation.set(rr(-0.02, 0.02), rr(0, TAU), rr(-0.03, 0.03));
            d.scale.setScalar(rr(0.97, 1.03));
            d.updateMatrix();
            bollards.setMatrixAt(i, d.matrix);
        }
        bollards.instanceMatrix.needsUpdate = true;
        bollards.castShadow = bollards.receiveShadow = true;
        scene.add(world.part('bollard_00', bollards));
    }

    /* --- The bin, which is where the chips came from ---------------- */
    {
        const g = new THREE.Group();
        g.position.set(3.42, 0, -2.05);
        g.rotation.y = -0.34;
        const bodyGeo = mergeGeometries([
            box(0.56, 0.86, 0.50, 0, 0.45, 0),
            box(0.60, 0.05, 0.54, 0, 0.90, 0),
            box(0.09, 0.30, 0.09, -0.20, 1.05, 0),
            box(0.09, 0.30, 0.09, 0.20, 1.05, 0),
            box(0.52, 0.06, 0.46, 0, 1.22, 0, 0.16),
        ]);
        const bin = new THREE.Mesh(bodyGeo, MAT.plastic);
        bin.castShadow = bin.receiveShadow = true;
        g.add(bin);
        // A torn bag out of the top, which is how this always starts.
        const bag = new THREE.Mesh(
            new THREE.SphereGeometry(0.24, 10, 8), new THREE.MeshStandardMaterial({
                color: srgb(0x2a2c30), roughness: 0.55, metalness: 0.05,
            }));
        bag.position.set(0.06, 1.02, 0.04);
        bag.scale.set(1.0, 0.72, 0.9);
        bag.castShadow = true;
        g.add(bag);
        scene.add(world.part('bin_00', g));
    }

    /* --- A stack of milk crates against the wall -------------------- */
    {
        const wall = 0.022;
        const crateGeo = mergeGeometries([
            box(0.34, wall, 0.34, 0, wall / 2, 0),
            box(0.34, 0.26, wall, 0, 0.13, 0.17 - wall / 2),
            box(0.34, 0.26, wall, 0, 0.13, -0.17 + wall / 2),
            box(wall, 0.26, 0.34, 0.17 - wall / 2, 0.13, 0),
            box(wall, 0.26, 0.34, -0.17 + wall / 2, 0.13, 0),
        ]);
        const crates = new THREE.InstancedMesh(crateGeo, new THREE.MeshStandardMaterial({
            color: srgb(0xb5342c), roughness: 0.66,
        }), 4);
        const d = new THREE.Object3D();
        // Up on the footpath step at the dark end of the shop, clear of both the
        // bollard line and the 140 mm lip they would otherwise be standing in.
        const at = [[-6.30, 0.14, -3.10, 0.10], [-6.30, 0.40, -3.10, 0.42], [-6.28, 0.66, -3.08, -0.18], [-5.78, 0.14, -3.24, 0.90]];
        at.forEach((a, i) => {
            d.position.set(a[0], a[1], a[2]);
            d.rotation.set(0, a[3], 0);
            d.updateMatrix();
            crates.setMatrixAt(i, d.matrix);
        });
        crates.instanceMatrix.needsUpdate = true;
        crates.castShadow = crates.receiveShadow = true;
        scene.add(world.part('crate_00', crates));
    }

    /* --- Wheel stops, kerb, and the stormwater grate ---------------- */
    {
        const stopGeo = mergeGeometries([
            box(1.62, 0.10, 0.15, 0, 0.05, 0),
            box(1.62, 0.06, 0.11, 0, 0.12, 0),
        ]);
        // Kept at the far end of the bays: the ring the juvenile runs comes out
        // to z = -1.6, and a bird at full tilt does not need a kerb in it.
        const stops = new THREE.InstancedMesh(stopGeo, MAT.kerb, 2);
        const d = new THREE.Object3D();
        [[-3.52, 2.08, 0.02], [-0.66, 2.10, -0.01]].forEach((a, i) => {
            d.position.set(a[0], 0, a[1]);
            d.rotation.set(0, a[2], 0);
            d.updateMatrix();
            stops.setMatrixAt(i, d.matrix);
        });
        stops.instanceMatrix.needsUpdate = true;
        stops.castShadow = stops.receiveShadow = true;
        scene.add(world.part('wheelstop_00', stops));

        const kerb = new THREE.Mesh(mergeGeometries([
            box(40, 0.15, 0.16, 0, 0.075, 3.62),
            box(40, 0.02, 0.42, 0, 0.01, 3.34),
        ]), MAT.kerb);
        kerb.receiveShadow = kerb.castShadow = true;
        scene.add(kerb);

        // The grate, with the water still going into it.
        const grate = new THREE.Mesh(mergeGeometries([
            box(0.62, 0.05, 0.44, 3.30, -0.035, 2.60),
            ...Array.from({ length: 7 }, (_, i) =>
                box(0.55, 0.055, 0.026, 3.30, -0.02, 2.42 + i * 0.06)),
        ]), MAT.dark);
        grate.receiveShadow = true;
        scene.add(grate);
    }

    /* --- The wire, and two who have seen all this before ------------ */
    {
        const parts = [];
        const SAG = 0.9, Y = 6.4, Z = 6.2;
        const pts = [];
        for (let i = 0; i <= 24; i++) {
            const t = i / 24, x = -34 + t * 68;
            pts.push(V3(x, Y - Math.sin(t * Math.PI) * SAG, Z));
        }
        parts.push(tube(pts, () => 0.016, 5, false));
        const pts2 = pts.map(p => V3(p.x, p.y - 0.42, p.z + 0.22));
        parts.push(tube(pts2, () => 0.014, 5, false));
        // Two roosting silhouettes, hunched, facing the same way.
        for (const [x, flip] of [[-3.1, 1], [-1.4, 1]]) {
            const t = (x + 34) / 68;
            const y = Y - Math.sin(t * Math.PI) * SAG;
            parts.push(placed(new THREE.SphereGeometry(0.085, 10, 8), x, y + 0.075, Z, 0, 0, 0).scale(0.72, 0.86, 1.5));
            parts.push(placed(new THREE.SphereGeometry(0.042, 8, 6), x, y + 0.175, Z + 0.085 * flip));
            parts.push(placed(new THREE.ConeGeometry(0.013, 0.05, 6), x, y + 0.168, Z + 0.145 * flip, Math.PI / 2 * flip));
            parts.push(placed(new THREE.ConeGeometry(0.030, 0.20, 5), x, y + 0.058, Z - 0.185 * flip, -Math.PI / 2 * flip));
        }
        const wire = new THREE.Mesh(mergeGeometries(parts), new THREE.MeshStandardMaterial({
            color: srgb(0x101725), roughness: 0.9,
        }));
        scene.add(world.ghost(wire));
    }

    /* ==========================================================
       6 · The chips
       ========================================================== */

    const chipSpots = [];       // where a bird can plausibly put its bill down
    {
        const g = new THREE.Group();
        g.position.set(PILE.x, 0, PILE.y);
        g.rotation.y = -0.42;

        // The cardboard boat, gone over on its side.
        const boat = new THREE.Mesh(mergeGeometries([
            box(0.30, 0.006, 0.20, 0, 0.003, 0),
            box(0.30, 0.075, 0.006, 0, 0.038, 0.100, -0.30),
            box(0.30, 0.075, 0.006, 0, 0.038, -0.100, 0.30),
            box(0.006, 0.075, 0.20, 0.150, 0.038, 0, 0, 0, 0.30),
            box(0.006, 0.075, 0.20, -0.150, 0.038, 0, 0, 0, -0.30),
        ]), MAT.card);
        boat.position.set(-0.13, 0.055, 0.06);
        boat.rotation.set(-0.16, 0.5, -1.28);
        boat.castShadow = boat.receiveShadow = true;
        g.add(boat);

        // The paper it was wrapped in, crumpled open.
        const paper = new THREE.Mesh(new THREE.PlaneGeometry(0.44, 0.40, 6, 6), MAT.card);
        {
            const p = paper.geometry.attributes.position;
            for (let i = 0; i < p.count; i++) {
                const x = p.getX(i), y = p.getY(i);
                p.setZ(i, (fbm2(x * 9 + 3, y * 9 + 7, 3) - 0.5) * 0.075 + (x * x + y * y) * 0.30);
            }
            paper.geometry.computeVertexNormals();
        }
        paper.rotation.set(-Math.PI / 2 + 0.09, 0.55, 0);
        paper.position.set(0.10, 0.006, -0.02);
        paper.receiveShadow = true;
        g.add(paper);

        // The chips: one instanced mesh, half still in the heap and half thrown
        // clear where somebody has already been through them.
        const chipGeo = (() => {
            const b = new THREE.BoxGeometry(0.011, 0.011, 0.058, 1, 1, 4);
            const p = b.attributes.position;
            for (let i = 0; i < p.count; i++) {
                const z = p.getZ(i);
                p.setY(i, p.getY(i) + z * z * 1.6 * 0.02);
                p.setX(i, p.getX(i) * (1 - Math.abs(z) * 1.4));
            }
            b.computeVertexNormals();
            return b;
        })();
        const COUNT = 52;
        const chips = new THREE.InstancedMesh(chipGeo, MAT.chip, COUNT);
        const d = new THREE.Object3D();
        for (let i = 0; i < COUNT; i++) {
            const heap = i < 26;
            const a = rr(0, TAU);
            const rad = heap ? Math.pow(rnd(), 0.7) * 0.13 : 0.16 + Math.pow(rnd(), 0.6) * 0.52;
            const x = Math.cos(a) * rad, z = Math.sin(a) * rad * 0.86;
            const y = heap ? 0.006 + Math.pow(1 - rad / 0.14, 2) * rr(0.005, 0.045) : 0.006;
            d.position.set(x, y, z);
            d.rotation.set(heap ? rr(-1.2, 1.2) : rr(-0.16, 0.16), rr(0, TAU), heap ? rr(-1.2, 1.2) : rr(-0.10, 0.10));
            d.scale.setScalar(rr(0.78, 1.28));
            d.updateMatrix();
            chips.setMatrixAt(i, d.matrix);
            if (!heap && chipSpots.length < 14)
                chipSpots.push(new THREE.Vector2(PILE.x + x * Math.cos(-0.42) + z * Math.sin(-0.42),
                    PILE.y - x * Math.sin(-0.42) + z * Math.cos(-0.42)));
        }
        chips.instanceMatrix.needsUpdate = true;
        chips.castShadow = chips.receiveShadow = true;
        g.add(chips);

        scene.add(world.part('chips_00', g));
    }

    /* --- Steam, because they have not been down long ---------------- */
    const steam = (() => {
        const m = new THREE.ShaderMaterial({
            // Its own fog rather than the renderer's: one plane, one formula,
            // and nothing for three to overwrite behind its back.
            transparent: true, depthWrite: false, fog: false,
            uniforms: {
                uTime,
                uCol: { value: srgb(0xffd9a4) },
                fogColor: { value: FOG_COL.clone() },
                fogDensity: { value: 0.0320 },
            },
            vertexShader: /* glsl */`
              varying vec2 vUv; varying float vFogDepth;
              void main(){
                vUv = uv;
                vec4 mv = modelViewMatrix * vec4(position, 1.0);
                vFogDepth = -mv.z;
                gl_Position = projectionMatrix * mv;
              }`,
            fragmentShader: NOISE_GLSL + /* glsl */`
              varying vec2 vUv; varying float vFogDepth;
              uniform float uTime; uniform vec3 uCol, fogColor; uniform float fogDensity;
              void main(){
                vec2 p = vec2(vUv.x * 3.0, vUv.y * 2.2 - uTime * 0.28);
                float n = fbm(p) * 0.68 + fbm(p * 2.3 + 9.0) * 0.32;
                // A wisp: narrow at the chips, wandering and thinning as it goes.
                float lean = sin(vUv.y * 3.4 + uTime * 0.5) * 0.10 * vUv.y;
                float across = abs(vUv.x - 0.5 - lean) / (0.09 + vUv.y * 0.30);
                float a = smoothstep(1.0, 0.0, across) * smoothstep(0.46, 0.80, n);
                a *= smoothstep(0.0, 0.16, vUv.y) * smoothstep(1.0, 0.35, vUv.y);
                float fog = 1.0 - exp(-pow(vFogDepth * fogDensity, 2.0));
                vec3 col = mix(uCol, fogColor, fog);
                gl_FragColor = vec4(col, a * 0.30 * (1.0 - fog));
              }`,
        });
        const mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.78), m);
        mesh.position.set(PILE.x, 0.39, PILE.y);
        mesh.renderOrder = 6;
        scene.add(world.ghost(mesh));
        return mesh;
    })();

    /* ==========================================================
       7 · One silver gull, built once

       Every bird here is the same species and near enough the same size, so the
       shapes are cut once and the birds differ by plumage, by scale, and by
       what they happen to be doing.
       ========================================================== */

    const G = {};

    // Trunk: a sphere pulled into the deep-chested teardrop of a gull, with the
    // rump swell, the shoulder coverts and the feathered thighs merged straight in.
    G.body = (() => {
        const s = new THREE.SphereGeometry(1, 24, 16);
        const p = s.attributes.position;
        for (let i = 0; i < p.count; i++) {
            const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
            const aft = Math.max(0, -z), fore = Math.max(0, z);
            const taper = Math.pow(1 - 0.55 * aft, 1.12);
            const rx = 0.0605 * taper;
            const ry = 0.0690 * taper * (y < 0 ? 1.10 : 0.94) * (1 + fore * 0.10);
            const yc = 0.1560 + 0.0190 * Math.pow(aft, 1.7) - 0.0060 * fore;
            p.setXYZ(i, x * rx, y * ry + yc, -0.012 + z * 0.124);
        }
        s.computeVertexNormals();
        return mergeGeometries([
            s,
            placed(new THREE.SphereGeometry(0.038, 10, 8), 0, 0.1700, -0.1130).scale(1.05, 0.86, 1.28),
            placed(new THREE.SphereGeometry(0.050, 12, 8), 0, 0.1510, 0.0840).scale(1.02, 1.04, 0.86),
            ...[-1, 1].map(s2 =>
                placed(new THREE.SphereGeometry(0.031, 10, 8), s2 * 0.0400, 0.1980, 0.0380).scale(0.85, 0.72, 1.20)),
            ...[-1, 1].map(s2 =>
                placed(new THREE.SphereGeometry(0.026, 10, 8), s2 * 0.0300, 0.1010, -0.0080).scale(0.92, 1.42, 1.24)),
        ]);
    })();

    // The neck comes in two lengths so it can do both of the things this scene
    // needs of it: fold right down onto the shoulders to get a bill into the
    // chips, and stand up as a straight white column with a head hung off the top.
    const NECK_A = 0.050, NECK_B = 0.050;
    G.neckLower = tube([V3(0, -0.008, 0), V3(0, 0.014, 0.002), V3(0, 0.032, 0.003), V3(0, NECK_A, 0.004)],
        (t) => lerp(0.0500, 0.0345, Math.pow(t, 0.85)), 14);
    G.neckUpper = tube([V3(0, -0.004, 0), V3(0, 0.016, 0.001), V3(0, 0.034, 0.002), V3(0, NECK_B, 0.003)],
        (t) => lerp(0.0345, 0.0250, Math.pow(t, 0.85)), 14);

    // Skull: the flat crown and full nape a gull has, and the throat under it.
    G.skull = (() => {
        const s = new THREE.SphereGeometry(0.0330, 16, 12);
        const p = s.attributes.position;
        for (let i = 0; i < p.count; i++) {
            const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
            const yn = y / 0.0330, zn = z / 0.0330;
            const crown = 1 - 0.11 * smooth(0.2, 1.0, yn);
            const nape = 1 + 0.15 * smooth(0.1, -1.0, zn) * smooth(0.6, -0.4, yn);
            p.setXYZ(i, x * 0.94, y * 0.98 * crown, z * 1.16 * nape - 0.002);
        }
        s.computeVertexNormals();
        return mergeGeometries([
            s,
            placed(new THREE.SphereGeometry(0.026, 12, 8), 0, -0.0165, 0.0105).scale(0.94, 0.86, 1.06),
        ]);
    })();

    // The bill. The upper mandible is rigid to the skull; only the lower one
    // drops, which is what a gape is — and this bird gapes a great deal.
    G.billUpper = (() => {
        const c = new THREE.ConeGeometry(0.0120, 0.0430, 12);
        c.rotateX(Math.PI / 2);
        c.scale(1.0, 0.72, 1.0);
        c.translate(0, 0.0020, 0.0196);
        const p = c.attributes.position;
        for (let i = 0; i < p.count; i++) {
            const z = p.getZ(i);
            const t = clamp((z - 0.014) / 0.028, 0, 1);
            p.setY(i, p.getY(i) - t * t * 0.0068);          // the hook at the tip
            p.setX(i, p.getX(i) * (1 - t * 0.18));
        }
        c.computeVertexNormals();
        return c;
    })();
    G.billLower = (() => {
        const c = new THREE.ConeGeometry(0.0103, 0.0356, 10);
        c.rotateX(Math.PI / 2);
        c.scale(1.0, 0.60, 1.0);
        c.translate(0, -0.0006, 0.0160);
        const p = c.attributes.position;
        for (let i = 0; i < p.count; i++) {
            const z = p.getZ(i);
            const t = clamp((z - 0.010) / 0.024, 0, 1);
            // The gonydeal angle — the kink that makes a gull's face a gull's face.
            p.setY(i, p.getY(i) - Math.pow(t, 1.6) * 0.0062 + Math.pow(t, 3.0) * 0.0034);
        }
        c.computeVertexNormals();
        return c;
    })();
    // The open mouth has to be something other than a hole, so the gape gets a
    // tongue and a dark throat that only show when it is screaming.
    G.mouth = placed(new THREE.SphereGeometry(0.0105, 10, 8), 0, -0.0035, 0.0090)
        .scale(0.85, 0.62, 1.5);

    const EYE = { x: 0.0222, y: 0.0062, z: 0.0126, yaw: 0.30 };
    G.eyes = mergeGeometries([
        mergeGeometries([-1, 1].map(s =>
            placed(new THREE.SphereGeometry(0.0071, 10, 8), s * EYE.x, EYE.y, EYE.z, 0, s * EYE.yaw, 0))),
        mergeGeometries([-1, 1].map(s =>
            placed(new THREE.SphereGeometry(0.0039, 8, 6),
                s * (EYE.x + Math.sin(s * EYE.yaw) * 0.0034), EYE.y, EYE.z + Math.cos(EYE.yaw) * 0.0034,
                0, s * EYE.yaw, 0).scale(1, 1, 0.7))),
    ], true);
    // The red orbital ring rides with the fixed upper mandible, being the same
    // red and never moving against the skull.
    G.billFixed = mergeGeometries([
        placed(G.billUpper, 0, -0.0020, 0.0298, -0.055),
        mergeGeometries([-1, 1].map(s =>
            placed(new THREE.TorusGeometry(0.0078, 0.0016, 5, 12), s * EYE.x, EYE.y, EYE.z,
                0, -s * (Math.PI / 2 - EYE.yaw), 0))),
    ]);
    // Both lids in one mesh, built about the origin so a single rotation swings
    // the pair down over the eyes in place rather than off the face.
    G.lid = mergeGeometries([-1, 1].map(s =>
        placed(new THREE.SphereGeometry(0.0081, 10, 5, 0, TAU, 0, Math.PI * 0.5), s * EYE.x, 0, 0)));

    /**
     * The folded wing, coverts and primaries in one shell so a whole wing is one
     * mesh: a lofted tube running from the shoulder back over the flank and
     * thinning as it goes, with six black primaries crossing over the tail.
     */
    function wingGeo(side) {
        const U = 20, TH = 12;
        const pos = [], uvs = [], idx = [];
        for (let i = 0; i <= U; i++) {
            const u = i / U;
            const cy = 0.1960 - 0.0330 * u - 0.0300 * u * u;
            const cz = 0.0650 - 0.2790 * u;
            const cx = side * (0.0515 * (1 - 0.62 * u * u));
            const ry = 0.0620 * Math.pow(Math.sin(Math.PI * (0.15 + 0.80 * u)), 0.66) * (1 - 0.97 * u * u * u);
            const rx = 0.0180 * (1 - 0.96 * u * u);
            for (let j = 0; j <= TH; j++) {
                const a = (j / TH) * TAU;
                pos.push(cx + side * rx * Math.sin(a), cy + ry * Math.cos(a), cz);
                uvs.push(j / TH, u * 0.775);
            }
        }
        for (let i = 0; i < U; i++) {
            for (let j = 0; j < TH; j++) {
                const a = i * (TH + 1) + j, b = a + TH + 1;
                if (side > 0) idx.push(a, b, a + 1, b, b + 1, a + 1);
                else idx.push(a, a + 1, b, b, a + 1, b + 1);
            }
        }
        const shell = new THREE.BufferGeometry();
        shell.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        shell.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
        shell.setIndex(idx);
        shell.computeVertexNormals();
        {   // Weld the seam's normals, or a crease runs the whole wing.
            const n = shell.attributes.normal;
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
        const parts = [shell];
        for (let k = 0; k < 6; k++) {
            const t = k / 5;
            parts.push(placed(
                quill(lerp(0.096, 0.150, t), 0.0180, 0.0056, 0.008, 0.775, 1.0),
                side * (0.0320 - t * 0.0075), 0.1555 - t * 0.0058, -0.1105,
                -0.06 - t * 0.05, side * (0.26 - t * 0.24), side * (0.20 - t * 0.09)
            ));
        }
        return mergeGeometries(parts);
    }
    G.wingL = wingGeo(-1);
    G.wingR = wingGeo(1);

    // Twelve rectrices in a shallow fan, merged: a gull's tail spreads by
    // rotating at the root, not by splaying, so one mesh is honest here.
    G.tail = mergeGeometries([
        ...Array.from({ length: 12 }, (_, i) => {
            const t = (i / 11) * 2 - 1;
            return placed(quill(0.146 - Math.abs(t) * 0.020, 0.0210, 0.0140, 0.004),
                t * 0.0050, -Math.abs(t) * 0.0026, 0,
                -0.05 + Math.abs(t) * 0.02, t * 0.22, t * 0.11);
        }),
        placed(new THREE.SphereGeometry(0.028, 10, 8), 0, 0.0040, 0.0100).scale(1.0, 0.72, 1.5),
    ]);

    // The leg, in the two bones that show: a feathered tibia and a bare tarsus.
    // Long enough that a standing bird's leg is properly bent and a crouching
    // one still has somewhere to go: the hip sits at 0.114 and the chain reaches
    // 0.150, so the knee is never solving against its own limit.
    const L1 = 0.075, L2 = 0.075, HIP_Y = 0.1140;
    G.tibia = tube([V3(0, 0.006, 0), V3(0, -0.022, -0.004), V3(0, -0.050, -0.006), V3(0, -L1, -0.004)],
        (t) => lerp(0.0225, 0.0130, Math.pow(t, 0.7)), 10);
    G.tarsus = tube([V3(0, 0, 0), V3(0, -0.022, 0.0028), V3(0, -0.048, 0.0042), V3(0, -L2, 0.0030)],
        (t) => lerp(0.0098, 0.0058, t), 10);
    G.foot = (() => {
        const parts = [];
        for (const toe of [{ yaw: 0, len: 0.0355 }, { yaw: 0.52, len: 0.0325 }, { yaw: -0.52, len: 0.0325 }]) {
            const pts = [];
            for (let i = 0; i < 5; i++) {
                const t = i / 4;
                pts.push(V3(Math.sin(toe.yaw) * toe.len * t, -t * t * 0.0055, Math.cos(toe.yaw) * toe.len * t));
            }
            parts.push(tube(pts, (t) => lerp(0.0044, 0.0024, t), 7));
            parts.push(placed(new THREE.ConeGeometry(0.0022, 0.0088, 6),
                pts[4].x, pts[4].y, pts[4].z, Math.PI / 2 + 0.9, toe.yaw, 0));
        }
        parts.push(tube([V3(0, 0, 0), V3(0, -0.0035, -0.0118), V3(0, -0.0062, -0.0206)],
            (t) => lerp(0.0038, 0.0020, t), 6));
        // The web, filling between the front toes.
        for (const s of [-1, 1]) {
            const a = V3(0, 0, 0.002), b = V3(0, -0.0058, 0.0355);
            const c = V3(Math.sin(s * 0.52) * 0.0325, -0.0058, Math.cos(0.52) * 0.0325);
            const mid = V3((b.x + c.x) * 0.5 * 0.72, -0.0034, (b.z + c.z) * 0.5 * 0.80);
            const P = s < 0 ? [a, mid, b, a, c, mid] : [a, b, mid, a, mid, c];
            const arr = [], nrm = [], uv = [];
            for (const v of P) { arr.push(v.x, v.y, v.z); nrm.push(0, 1, 0); uv.push(0.5, 0.5); }
            const web = new THREE.BufferGeometry();
            web.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3));
            web.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
            web.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
            web.setIndex([0, 1, 2, 3, 4, 5]);
            parts.push(web);
        }
        return mergeGeometries(parts);
    })();

    /* --- Two sets of feathers: an adult, and a first-year ------------ */
    function plumage(juv) {
        return {
            body: new THREE.MeshStandardMaterial({
                map: bodyTex, color: srgb(juv ? 0xeae4d6 : 0xfdfdfb), roughness: 0.86, metalness: 0.02,
            }),
            wing: new THREE.MeshStandardMaterial({
                map: juv ? wingTexJuv : wingTexAdult, roughness: 0.80, metalness: 0.03, side: THREE.DoubleSide,
            }),
            tail: new THREE.MeshStandardMaterial({
                map: juv ? tailTexJuv : tailTexAdult, roughness: 0.80, side: THREE.DoubleSide,
            }),
            bill: new THREE.MeshStandardMaterial({
                color: srgb(juv ? 0x4a3830 : 0xd23520), roughness: juv ? 0.60 : 0.32, metalness: 0.05,
            }),
            mouth: new THREE.MeshStandardMaterial({ color: srgb(0x59120e), roughness: 0.42 }),
            leg: new THREE.MeshStandardMaterial({
                color: srgb(juv ? 0x6a5342 : 0xd9452a), roughness: 0.50, metalness: 0.04,
            }),
            iris: new THREE.MeshStandardMaterial({
                color: srgb(juv ? 0x695440 : 0xf7f5ec), roughness: 0.20,
            }),
            pupil: new THREE.MeshStandardMaterial({ color: srgb(0x05060a), roughness: 0.10 }),
        };
    }
    const MATS = { adult: plumage(false), juv: plumage(true) };

    /**
     * One bird, feet on the ground at the origin, facing +z. Returns the rig
     * that the drama up in section 9 writes into.
     */
    function makeGull(kind, scale) {
        const M = MATS[kind];
        const root = new THREE.Group();

        // Everything above the hips, and hung at the hips: a bird that pitches
        // forward into its food rotates about its hip joints, not about a point
        // on the road between its feet. Get that wrong and the body slides off
        // the top of the legs every time it leans. Everything inside is written
        // in body space and offset down by HIP_Y to compensate.
        const carriage = new THREE.Group();
        carriage.position.y = HIP_Y;
        root.add(carriage);

        const body = new THREE.Mesh(G.body, M.body);
        body.position.y = -HIP_Y;
        body.castShadow = body.receiveShadow = true;
        carriage.add(body);

        const neck0 = new THREE.Group();                 // base of the neck
        neck0.position.set(0, 0.1810 - HIP_Y, 0.0530);
        carriage.add(neck0);
        const neckLower = new THREE.Mesh(G.neckLower, M.body);
        neckLower.castShadow = true;
        neck0.add(neckLower);

        const neck1 = new THREE.Group();                 // halfway up it
        neck1.position.set(0, NECK_A, 0.004);
        neck0.add(neck1);
        const neckUpper = new THREE.Mesh(G.neckUpper, M.body);
        neckUpper.castShadow = true;
        neck1.add(neckUpper);

        const head = new THREE.Group();                  // the skull, turning against the neck
        head.position.set(0, NECK_B + 0.0175, 0.0055);
        neck1.add(head);

        const skull = new THREE.Mesh(G.skull, M.body);
        skull.castShadow = true;
        head.add(skull);

        const billFixed = new THREE.Mesh(G.billFixed, M.bill);
        billFixed.castShadow = true;
        head.add(billFixed);

        const mouth = new THREE.Mesh(G.mouth, M.mouth);
        mouth.position.set(0, -0.0020, 0.0040);
        head.add(mouth);

        const jaw = new THREE.Group();                   // only the lower mandible swings
        jaw.position.set(0, -0.0020, 0.0298);
        jaw.rotation.x = -0.055;
        head.add(jaw);
        const billLower = new THREE.Mesh(G.billLower, M.bill);
        billLower.position.set(0, -0.0052, 0.0010);
        jaw.add(billLower);

        const eyes = new THREE.Mesh(G.eyes, [M.iris, M.pupil]);
        head.add(eyes);
        const lid = new THREE.Mesh(G.lid, M.body);
        lid.position.set(0, EYE.y, EYE.z);
        head.add(lid);

        const wings = [];
        for (const side of [-1, 1]) {
            const pivot = new THREE.Group();
            pivot.position.set(side * 0.0400, 0.1940 - HIP_Y, 0.0400);
            carriage.add(pivot);
            const w = new THREE.Mesh(side < 0 ? G.wingL : G.wingR, M.wing);
            w.position.set(-side * 0.0400, -0.1940, -0.0400);   // built in body space, hung off the pivot
            w.castShadow = true;
            pivot.add(w);
            wings.push(pivot);
        }

        const tailPivot = new THREE.Group();
        tailPivot.position.set(0, 0.1650 - HIP_Y, -0.1150);
        carriage.add(tailPivot);
        const tail = new THREE.Mesh(G.tail, M.tail);
        tail.castShadow = true;
        tailPivot.add(tail);

        // The legs hang off the root rather than the carriage. A bird that
        // crouches folds down over its feet; it does not push them into the road.
        const legs = [];
        for (const side of [-1, 1]) {
            const hip = new THREE.Group();
            hip.position.set(side * 0.0265, HIP_Y, -0.0040);
            root.add(hip);
            const tibia = new THREE.Mesh(G.tibia, M.body);
            tibia.castShadow = true;
            hip.add(tibia);

            const hock = new THREE.Group();
            hock.position.set(0, -L1, -0.004);
            hip.add(hock);
            const tarsus = new THREE.Mesh(G.tarsus, M.leg);
            tarsus.castShadow = true;
            hock.add(tarsus);

            const ankle = new THREE.Group();
            ankle.position.set(0, -L2, 0.0030);
            hock.add(ankle);
            const foot = new THREE.Mesh(G.foot, M.leg);
            foot.castShadow = true;
            ankle.add(foot);

            legs.push({ hip, hock, ankle, side });
        }

        root.scale.setScalar(scale);
        return { root, carriage, neck0, neck1, head, jaw, mouth, lid, wings, tailPivot, legs, scale };
    }

    /**
     * Two bones and a foot, solved to put that foot exactly where the gait says
     * it goes. A bird's hock bends backwards, so the elbow-up solution is the
     * one that is thrown away.
     *
     * `tz`, `ty` are the foot target relative to the hip, in the bird's own
     * frame; `pitch` is what the sole should be doing when it gets there.
     */
    function solveLeg(leg, tz, ty, pitch) {
        const d = clamp(Math.hypot(tz, ty), 0.020, (L1 + L2) * 0.995);
        const dir = Math.atan2(-tz, -ty);
        const A = Math.acos(clamp((L1 * L1 + d * d - L2 * L2) / (2 * L1 * d), -1, 1));
        const B = Math.acos(clamp((L1 * L1 + L2 * L2 - d * d) / (2 * L1 * L2), -1, 1));
        const a1 = dir + A, a2 = B - Math.PI;
        leg.hip.rotation.x = a1;
        leg.hock.rotation.x = a2;
        leg.ankle.rotation.x = -(a1 + a2) + pitch;
    }

    /* ==========================================================
       8 · Who is on the asphalt
       ========================================================== */

    const GULLS = [];

    /**
     * A bird and the small set of numbers the scene writes into: where it is,
     * where it wants to be, and what its neck, skull, jaw, wings and tail are
     * each doing about it. Everything is eased toward a target, so nothing snaps.
     */
    function addGull(name, kind, scale, x, z, heading, role) {
        const rig = makeGull(kind, scale);
        const part = new THREE.Group();
        part.position.set(x, 0, z);
        const motion = new THREE.Group();          // the chase drives this, not the part
        motion.add(rig.root);
        part.add(motion);
        scene.add(world.ghost(world.part(name, part)));

        const g = {
            name, rig, part, motion, role, kind, scale,
            home: new THREE.Vector2(x, z),
            pos: new THREE.Vector2(x, z),
            goal: new THREE.Vector2(x, z),
            food: new THREE.Vector2(x, z),
            heading, speed: 0, stepPhase: rnd(), lastStrike: -9,
            // Posture, and where the posture is going. Two numbers each, because
            // a gull's neck is fast but it is not instant.
            neckA: 0.5, neckAT: 0.5,           // lower neck, fold to upright
            neckB: 0.2, neckBT: 0.2,           // upper neck, against the lower
            pitch: 0, pitchT: 0,               // skull, against the neck
            yaw: 0, yawT: 0,                   // skull, side to side
            gape: 0, gapeT: 0,
            crouch: 0, crouchT: 0,
            lean: 0, leanT: 0,                 // body pitch
            roll: 0, rollT: 0,
            wing: 0.02, wingT: 0.02,
            tailUp: 0, tailUpT: 0,
            blink: 0, nextBlink: rr(1, 5),
            peckPhase: rnd() * TAU, peckRate: rr(2.6, 3.6),
            alarm: 0,
        };
        GULLS.push(g);
        return g;
    }

    // Three with their heads down, spaced around the spill so they are not all
    // stabbing at the same square inch of it.
    const FEED_AT = [
        [-0.34, -0.92, 0.72], [0.44, -0.90, -0.62], [-0.40, -0.34, 1.94],
    ];
    FEED_AT.forEach((a, i) => {
        const g = addGull(`gull_0${i}`, 'adult', 1.0, a[0], a[1], a[2], 'feeder');
        const spot = chipSpots.length ? chipSpots[(i * 5 + 2) % chipSpots.length] : PILE;
        g.food.set(lerp(a[0], spot.x, 0.86), lerp(a[1], spot.y, 0.86));
        g.peckRate = rr(2.4, 3.4);
    });

    // The one doing the shouting, and the one it will not leave alone.
    const caller = addGull('gull_03', 'adult', 1.06, 0.90, -0.10, 3.4, 'caller');
    const runner = addGull('gull_04', 'juv', 0.96, -0.86, 0.28, 1.2, 'runner');

    /* ==========================================================
       9 · The carousel

       The juvenile runs a ring around the spill because that is the only shape
       left to a bird that will not fly off and will not be allowed in. The
       adult runs the inside of the same ring, screaming, and never quite closes.
       ========================================================== */

    const RING_R = 0.96;              // the worn circle the juvenile runs
    const CHASE_R = 0.70;             // the adult cuts the corner, inside it
    let ringAngle = 1.2;              // where the juvenile is on that ring
    let callClock = 0, callDur = 0.3, callIndex = 0, callRest = false;

    // Breath. Cold night, hot bird, and a bill that is open more than it is not.
    const BREATH = [];
    {
        const mat = new THREE.SpriteMaterial({
            map: puffTex, transparent: true, depthWrite: false, opacity: 0,
            color: srgb(0xdfe8ff), blending: THREE.AdditiveBlending,
        });
        for (let i = 0; i < 7; i++) {
            const sp = new THREE.Sprite(mat.clone());
            sp.scale.setScalar(0.001);
            sp.renderOrder = 7;
            scene.add(world.ghost(sp));
            BREATH.push({ sp, life: -1, vx: 0, vy: 0, vz: 0 });
        }
    }
    let breathNext = 0;
    const _bp = new THREE.Vector3();
    function puffBreath(from, dirX, dirZ) {
        const b = BREATH[breathNext];
        breathNext = (breathNext + 1) % BREATH.length;
        b.sp.position.copy(from);
        b.vx = dirX * 0.30 + (rnd() - 0.5) * 0.10;
        b.vz = dirZ * 0.30 + (rnd() - 0.5) * 0.10;
        b.vy = -0.16 + rnd() * 0.06;      // the head is pointing at the ground
        b.life = 0;
    }

    /* --- Small helpers the sim leans on ------------------------------ */
    const approach = (cur, target, rate, dt) => cur + (target - cur) * (1 - Math.exp(-rate * dt));
    function angleTo(from, to) { return Math.atan2(to.x - from.x, to.y - from.y); }
    function wrapPi(a) { while (a > Math.PI) a -= TAU; while (a < -Math.PI) a += TAU; return a; }

    const _v2a = new THREE.Vector2(), _v2b = new THREE.Vector2();

    /**
     * The legs, for one bird, for one frame. The stance foot slides backwards
     * under the bird at exactly the rate the bird goes forwards, which is the
     * whole difference between walking and skating. Results come back in two
     * scratch numbers rather than a fresh object, because this runs five times
     * a frame forever.
     */
    let _bob = 0, _strike = 0;
    function driveLegs(g, dt, lift) {
        const v = g.speed;
        const cadence = v > 0.05 ? clamp(1.6 + v * 1.45, 1.6, 4.8) : 0;
        g.stepPhase = (g.stepPhase + cadence * dt) % 1;
        const stride = clamp(v * 0.32, 0.010, 0.19);
        const swing = 0.010 + clamp(v * 0.028, 0, 0.046);
        const duty = 0.58;
        _bob = 0; _strike = 0;
        for (const leg of g.rig.legs) {
            const ph = (g.stepPhase + (leg.side < 0 ? 0 : 0.5)) % 1;
            let fz = 0, fy = 0;
            if (cadence > 0) {
                if (ph < duty) {
                    const p = ph / duty;
                    fz = stride * (0.5 - p);
                    if (p < 0.10) _strike = Math.max(_strike, 1 - p / 0.10);
                } else {
                    const p = (ph - duty) / (1 - duty);
                    fz = stride * (p - 0.5);
                    fy = Math.sin(Math.PI * p) * swing;
                }
            }
            // The hip is HIP_Y above the sole plus however far the bird has
            // risen off it, so the solver is always told the truth about where
            // the ground is and the foot never sinks into the asphalt.
            solveLeg(leg, fz - 0.004, -(HIP_Y + lift) + fy,
                clamp(fy * 6.0, 0, 0.5) + (ph < duty || cadence === 0 ? 0 : 0.30));
            _bob += fy;
        }
    }

    /* ==========================================================
       10 · What moves
       ========================================================== */

    world.frame((dt, time) => {
        uTime.value = time;

        // --- where the juvenile is on its ring -----------------------
        // It is not going round at a constant rate: it surges when the adult
        // gets close and it dawdles, wanting the chips, when it does not.
        const surge = 0.5 + 0.5 * Math.sin(time * 0.62);
        const ringSpeed = 1.28 + surge * 0.72;
        ringAngle += ringSpeed * dt;
        const rWob = RING_R + Math.sin(time * 1.7) * 0.07;
        runner.goal.set(PILE.x + Math.sin(ringAngle) * rWob, PILE.y + Math.cos(ringAngle) * rWob);

        // The adult runs a tighter circle, always behind and always turning in.
        const lag = 0.62 + 0.30 * Math.sin(time * 0.47 + 1.1);
        const cAng = ringAngle - lag;
        const cR = CHASE_R + Math.sin(time * 1.13) * 0.09;
        caller.goal.set(PILE.x + Math.sin(cAng) * cR, PILE.y + Math.cos(cAng) * cR);

        // --- the calling ---------------------------------------------
        // A silver gull does not scream continuously: it comes in bursts of
        // three or four notes and then a held pause, bill still open, head
        // still hanging. Each note is a hard open and a slower close.
        callClock -= dt;
        if (callClock <= 0) {
            callIndex++;
            callRest = (callIndex % 4 === 0);
            callDur = callRest ? rr(0.85, 1.45) : rr(0.26, 0.34);
            callClock = callDur;
            if (!callRest) {
                caller.rig.head.getWorldPosition(_bp);
                _bp.y -= 0.035;
                puffBreath(_bp, Math.sin(caller.heading), Math.cos(caller.heading));
            }
        }
        const cu = clamp(1 - callClock / callDur, 0, 1);
        const calling = callRest
            ? 0.20 * (1 - cu * 0.55)
            : Math.pow(Math.sin(Math.PI * Math.pow(cu, 0.62)), 0.8);

        // --- each bird ------------------------------------------------
        for (const g of GULLS) {
            const rig = g.rig;

            if (g.role === 'runner' || g.role === 'caller') {
                // Go where the circle says, at whatever speed that needs.
                _v2a.copy(g.goal).sub(g.pos);
                const dist = _v2a.length();
                const want = clamp(dist * 5.2, 0, g.role === 'runner' ? 2.05 : 1.85);
                g.speed = approach(g.speed, want, 7.0, dt);
                if (dist > 1e-4) {
                    _v2a.multiplyScalar(Math.min(g.speed * dt, dist) / dist);
                    g.pos.add(_v2a);
                }
                // The runner looks where it is going; the adult looks at the runner.
                const face = g.role === 'runner'
                    ? angleTo(g.pos, g.goal)
                    : angleTo(g.pos, runner.pos);
                g.heading += wrapPi(face - g.heading) * (1 - Math.exp(-9.0 * dt));
                // Bank into the turn, the way anything running a circle does:
                // toward the middle, harder the faster it is going.
                const inward = Math.sin(wrapPi(angleTo(g.pos, PILE) - g.heading));
                g.rollT = clamp(-inward * g.speed * g.speed * 0.075, -0.30, 0.30);
            } else {
                // The feeders hold their patch, edging back to it if shoved.
                _v2a.copy(g.home).sub(g.pos);
                const dist = _v2a.length();
                g.speed = approach(g.speed, dist > 0.03 ? clamp(dist * 2.2, 0, 0.34) : 0, 5.0, dt);
                if (dist > 1e-4) {
                    _v2a.multiplyScalar(Math.min(g.speed * dt, dist) / dist);
                    g.pos.add(_v2a);
                }
                const face = angleTo(g.pos, g.alarm > 0.4 ? runner.pos : g.food);
                g.heading += wrapPi(face - g.heading) * (1 - Math.exp(-3.4 * dt));
            }

            /* --- postures ------------------------------------------- */
            if (g.role === 'caller') {
                // THE POSTURE. Neck driven straight up into a column, skull hung
                // off the top of it pointing at the ground, bill open, and the
                // whole bird jolting forward a little on every note.
                g.neckAT = -0.10 + calling * 0.16;          // vertical, and stretching
                g.neckBT = -0.04 + calling * 0.08;
                g.pitchT = 1.30 + calling * 0.46;           // skull swung right over
                g.gapeT = 0.10 + calling * 0.62;
                // Rocked back between notes and driven forward on each one, so
                // the shouting is something the whole bird does and not just a jaw.
                g.leanT = -0.20 + calling * 0.22;
                g.crouchT = 0.016 + calling * 0.008;
                g.wingT = 0.10 + calling * 0.16;            // carpals held out from the body
                g.tailUpT = 0.30 + calling * 0.16;
                g.yawT = Math.sin(time * 0.9) * 0.10;
            } else if (g.role === 'runner') {
                // Everything a bird does when it is being run off: body flat and
                // low, neck out in front, tail cocked, wings beating half open.
                const flap = Math.sin(time * 11.0);
                g.neckAT = 0.86;
                g.neckBT = -0.50;
                g.pitchT = -0.40;
                g.leanT = 0.34;
                g.crouchT = -0.012;
                g.gapeT = 0.10 + Math.max(0, Math.sin(time * 3.1)) * 0.22;
                g.wingT = 0.34 + flap * 0.26 * clamp(g.speed - 1.1, 0, 1);
                g.tailUpT = 0.44;
                // It keeps checking over its shoulder.
                g.yawT = -0.55 + Math.sin(time * 0.9) * 0.28;
            } else {
                // Head down in the chips, up on a stab, down again — and up
                // properly, fast, whenever the argument comes past.
                _v2b.copy(runner.pos).sub(g.pos);
                const near = smooth(0.95, 0.34, _v2b.length());
                g.alarm = approach(g.alarm, Math.max(near, calling * 0.30), 9.0, dt);

                g.peckPhase += dt * g.peckRate;
                const pk = 0.5 - 0.5 * Math.cos(g.peckPhase);
                const stab = Math.pow(pk, 2.2);
                const down = 1 - g.alarm;
                // Folded far enough that the bill actually reaches the road:
                // the neck carries most of it, the skull turns back against the
                // neck so the bird is looking at what it is stabbing.
                g.neckAT = lerp(1.48 + stab * 0.30, 0.05, g.alarm);
                g.neckBT = lerp(0.14 + stab * 0.18, 0.10, g.alarm);
                g.pitchT = lerp(-0.30 - stab * 0.34, -0.05, g.alarm);
                g.leanT = lerp(0.40, 0.06, g.alarm) * down + 0.06;
                g.crouchT = lerp(-0.008, 0.012, g.alarm);
                g.gapeT = (stab > 0.72 ? 0.30 : 0.03) * down;
                g.wingT = 0.02 + g.alarm * 0.14;
                g.tailUpT = 0.02 + g.alarm * 0.18;
                g.yawT = Math.sin(time * 0.7 + g.peckPhase * 0.2) * 0.14 * down;
            }

            // Ease every posture number toward where it wants to be. A neck is
            // fast, a body is slow, and a jaw is faster than either.
            g.neckA = approach(g.neckA, g.neckAT, 11, dt);
            g.neckB = approach(g.neckB, g.neckBT, 11, dt);
            g.pitch = approach(g.pitch, g.pitchT, 13, dt);
            g.yaw = approach(g.yaw, g.yawT, 6.5, dt);
            g.gape = approach(g.gape, g.gapeT, 22, dt);
            g.crouch = approach(g.crouch, g.crouchT, 8, dt);
            g.lean = approach(g.lean, g.leanT, 7, dt);
            g.roll = approach(g.roll, g.rollT, 8, dt);
            g.wing = approach(g.wing, g.wingT, 12, dt);
            g.tailUp = approach(g.tailUp, g.tailUpT, 9, dt);

            /* --- write it onto the rig ------------------------------- */
            // Offset from where the bird started, not from where its part now
            // is: that way somebody who picks a gull up and puts it down half a
            // metre to the left takes the whole circle with them.
            g.motion.position.set(g.pos.x - g.home.x, 0, g.pos.y - g.home.y);
            g.motion.rotation.y = g.heading;

            driveLegs(g, dt, g.crouch);
            rig.root.position.y = g.crouch * g.scale;
            rig.carriage.position.y = HIP_Y - _bob * 0.35;   // the body rides the stride
            rig.carriage.rotation.set(g.lean, 0, g.roll);
            rig.neck0.rotation.x = g.neckA;
            rig.neck1.rotation.x = g.neckB;
            rig.head.rotation.set(g.pitch, g.yaw, 0);
            rig.jaw.rotation.x = -0.055 - g.gape * 0.78;
            rig.mouth.visible = g.gape > 0.12;
            rig.tailPivot.rotation.x = -g.tailUp;
            for (let i = 0; i < 2; i++) {
                const side = i === 0 ? -1 : 1;
                rig.wings[i].rotation.z = side * g.wing;
                rig.wings[i].rotation.x = -g.wing * 0.35;
            }

            // Blinking. A gull's lid comes up from below and is gone again in
            // under a tenth of a second, so it is easy to miss and wrong to omit.
            g.nextBlink -= dt;
            if (g.nextBlink <= 0) { g.blink = 1; g.nextBlink = rr(1.6, 6.0); }
            if (g.blink > 0) g.blink = Math.max(0, g.blink - dt * 9);
            // Parked at -90° the caps sit behind the eyes and cannot be seen;
            // swung to +90° they come over the front. One sine takes them there
            // and back inside a tenth of a second.
            rig.lid.rotation.x = -Math.PI * 0.5 + Math.sin(Math.PI * g.blink) * Math.PI;

            // The runner's feet are what put the rings in the puddles.
            if (g.role === 'runner' && _strike > 0.6 && time - g.lastStrike > 0.14) {
                g.lastStrike = time;
                uRunner.value.set(g.pos.x, g.pos.y, 0.42);
            }
        }

        // The splash ring fades between footfalls, and follows the bird.
        uRunner.value.x = lerp(uRunner.value.x, runner.pos.x, 1 - Math.exp(-4 * dt));
        uRunner.value.y = lerp(uRunner.value.y, runner.pos.y, 1 - Math.exp(-4 * dt));
        uRunner.value.z = Math.max(0, uRunner.value.z - dt * 0.75);

        // Breath.
        for (const b of BREATH) {
            if (b.life < 0) continue;
            b.life += dt;
            if (b.life > 1.5) { b.life = -1; b.sp.material.opacity = 0; continue; }
            const u = b.life / 1.5;
            b.sp.position.x += b.vx * dt;
            b.sp.position.y += (b.vy + u * 0.34) * dt;
            b.sp.position.z += b.vz * dt;
            b.sp.scale.setScalar(0.03 + u * 0.16);
            b.sp.material.opacity = Math.sin(Math.PI * u) * 0.16;
        }

        // Steam off the chips turns to face whoever is looking at it.
        steam.rotation.y = Math.atan2(camera.position.x - steam.position.x, camera.position.z - steam.position.z);
    });
}
