//
//  chip-thief.scene.js
//  Project27 worlds
//
//  Late afternoon on a seafront promenade, and somebody's hot chips are on the
//  concrete. Three silver gulls have their heads down in them. A fourth — a big
//  adult, breast low, neck flattened forward, bill tipped up and both white eyes
//  rolled up at the bird in front of it — is running a first-year juvenile off
//  the food, and the juvenile is going: wings half open, feet scrabbling, tail
//  cocked.
//
//  That posture is the whole scene, so the rig is built around it. The neck
//  pivot and the skull pivot turn against each other, which is the only way a
//  head can be carried low and still be looking up.
//
//  Everything else — the swash line running up the sand and back, the sun sitting
//  low over the water and rimming five white birds from behind, the chips going
//  cold — is there so the moment has somewhere to happen.
//

import { mergeGeometries } from './BufferGeometryUtils.js';

export default function build(world) {
    const { THREE, scene, camera } = world;

    world.ownsSky(true);
    world.groundLevel(0);
    // Sparingly: the subject is five white birds in direct sun, and a low
    // threshold here would turn every one of them into a smear. This is set to
    // catch the sun's own disc and the glitter off the water, and nothing else.
    world.bloom({ strength: 0.26, radius: 0.72, threshold: 0.90 });

    /* ==========================================================
       0 · Small tools
       ========================================================== */

    const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
    const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
    const lerp = (a, b, t) => a + (b - a) * t;
    const smooth = (e0, e1, x) => { const t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };
    const srgb = (hex) => new THREE.Color(hex).convertSRGBToLinear();
    const TAU = Math.PI * 2;

    // Deterministic: the same five birds having the same argument every time.
    let _seed = 20260827;
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

    /**
     * A closed tube swept along a polyline with a per-station radius. Necks,
     * tarsi, toes, handrails and bollards are all one of these — a bird is
     * mostly tapered tubes with a skull on the end.
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

    const _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion();
    const _eu = new THREE.Euler(), _pv = new THREE.Vector3(), _sv = new THREE.Vector3();
    /** A transformed copy of a geometry, ready for merging. */
    function placed(geo, px, py, pz, rx, ry, rz, s = 1) {
        _eu.set(rx, ry, rz);
        _m4.compose(_pv.set(px, py, pz), _q.setFromEuler(_eu), _sv.setScalar(s));
        return geo.clone().applyMatrix4(_m4);
    }

    /* ==========================================================
       1 · The light of the hour
       ========================================================== */

    // The sun is low over the water and slightly to the left, so five white birds
    // are lit from behind: rim on every back, faces carried by sky and sand bounce.
    const SUN_DIR = V3(-0.34, 0.255, -0.905).normalize();
    const C_SUN = srgb(0xffd6a0);
    const C_ZEN = srgb(0x2c6cb6);
    const C_MID = srgb(0x86b6de);
    const C_HOR = srgb(0xf6d9b4);
    const C_DEEP = srgb(0x15536f);
    const C_SHAL = srgb(0x35a3ad);
    const C_FOAM = srgb(0xfaf6ee);
    const C_SAND = srgb(0xe4d2ae);

    // The haze is exactly the sky's horizon colour, so the far edge of the water
    // dissolves into the sky rather than ending somewhere.
    const FOG_COL = C_HOR.clone();
    scene.fog = new THREE.FogExp2(FOG_COL.clone(), 0.0046);

    camera.position.set(2.05, 0.66, 2.55);

    const sun = new THREE.DirectionalLight(0xffdcae, 3.2);
    sun.position.copy(SUN_DIR).multiplyScalar(46);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    {
        const c = sun.shadow.camera;
        c.left = -7.5; c.right = 7.5; c.top = 7.5; c.bottom = -7.5;
        c.near = 20; c.far = 82;
        sun.shadow.bias = -0.00045;
        sun.shadow.normalBias = 0.016;
    }
    scene.add(sun, sun.target);

    // One cool fill out of the open sky behind the camera, so the shaded side of
    // a white bird reads blue rather than black. Two real lights, and that is all.
    const fill = new THREE.DirectionalLight(0xa9c8ff, 0.60);
    fill.position.set(6, 7, 10);
    scene.add(fill);

    scene.add(new THREE.HemisphereLight(0xbdd8ff, 0xc9b184, 1.05));
    scene.add(new THREE.AmbientLight(0xffe9cd, 0.22));

    const uTime = { value: 0 };
    // The swash: one number, shared by the sea shader and the sand shader, so the
    // wet line on the beach is the line the water actually reaches.
    const uSwash = { value: 0 };

    /* ==========================================================
       2 · Painted textures
       ========================================================== */

    /* --- Concrete paving, one 4 m tile ---------------------------- */
    const concreteTex = world.canvasTexture(1024, 1024, (g, cv) => {
        const S = cv.width;
        g.fillStyle = '#b6b0a3';
        g.fillRect(0, 0, S, S);
        // Cloudy patchiness, the way a poured slab cures unevenly.
        for (let i = 0; i < 340; i++) {
            const x = Math.random() * S, y = Math.random() * S, r = 40 + Math.random() * 190;
            const grad = g.createRadialGradient(x, y, 0, x, y, r);
            const v = Math.random() < 0.5 ? 255 : 120;
            grad.addColorStop(0, `rgba(${v},${v - 6},${v - 18},${0.02 + Math.random() * 0.05})`);
            grad.addColorStop(1, 'rgba(0,0,0,0)');
            g.fillStyle = grad;
            g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
        }
        // Exposed aggregate.
        for (let i = 0; i < 12000; i++) {
            const x = Math.random() * S, y = Math.random() * S;
            const r = 0.7 + Math.random() * 2.6;
            const k = Math.random();
            g.fillStyle = k < 0.42 ? `rgba(96,90,80,${0.10 + Math.random() * 0.30})`
                : k < 0.78 ? `rgba(216,210,196,${0.10 + Math.random() * 0.35})`
                    : `rgba(150,132,110,${0.08 + Math.random() * 0.22})`;
            g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
        }
        // Broom finish: fine parallel striations.
        g.globalAlpha = 0.14;
        for (let i = 0; i < 520; i++) {
            const y = Math.random() * S;
            g.strokeStyle = Math.random() < 0.5 ? '#8e887c' : '#cdc7ba';
            g.lineWidth = 0.6 + Math.random() * 1.4;
            g.beginPath();
            g.moveTo(0, y);
            for (let x = 0; x <= S; x += 64) g.lineTo(x, y + Math.sin(x * 0.011 + i) * 1.6);
            g.stroke();
        }
        g.globalAlpha = 1;
        // The saw-cut control joint along two edges, so the tiling makes a grid.
        const joint = (x, y, w, h) => {
            const grad = g.createLinearGradient(x, y, x + (w < h ? w : 0), y + (h < w ? h : 0));
            grad.addColorStop(0, 'rgba(72,66,58,0.10)');
            grad.addColorStop(0.5, 'rgba(52,47,41,0.72)');
            grad.addColorStop(1, 'rgba(72,66,58,0.10)');
            g.fillStyle = grad;
            g.fillRect(x, y, w, h);
        };
        joint(0, 0, S, 9);
        joint(0, 0, 9, S);
        // Grit gathered in the joints.
        g.fillStyle = 'rgba(180,166,140,0.5)';
        for (let i = 0; i < 900; i++) {
            const along = Math.random() * S;
            if (Math.random() < 0.5) g.fillRect(along, Math.random() * 12, 1.6, 1.6);
            else g.fillRect(Math.random() * 12, along, 1.6, 1.6);
        }
    });
    concreteTex.wrapS = concreteTex.wrapT = THREE.RepeatWrapping;

    /* --- The one-off marks: grease, salt, splats, scuffs ---------- */
    const stainTex = world.canvasTexture(1024, 1024, (g, cv) => {
        const S = cv.width;
        g.clearRect(0, 0, S, S);
        const blot = (x, y, r, col, a, squash = 1) => {
            const grad = g.createRadialGradient(x, y, 0, x, y, r);
            grad.addColorStop(0, `rgba(${col},${a})`);
            grad.addColorStop(0.55, `rgba(${col},${a * 0.5})`);
            grad.addColorStop(1, `rgba(${col},0)`);
            g.save();
            g.translate(x, y); g.scale(1, squash); g.translate(-x, -y);
            g.fillStyle = grad;
            g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
            g.restore();
        };
        // The grease halo under the chips, at the middle of the sheet.
        blot(S * 0.5, S * 0.5, 118, '92,72,44', 0.30);
        blot(S * 0.52, S * 0.49, 58, '78,58,32', 0.34);
        for (let i = 0; i < 30; i++) {
            const a = Math.random() * TAU, d = 60 + Math.random() * 190;
            blot(S * 0.5 + Math.cos(a) * d, S * 0.5 + Math.sin(a) * d * 0.8,
                4 + Math.random() * 13, '96,76,46', 0.14 + Math.random() * 0.2);
        }
        // Old dried salt and general promenade filth.
        for (let i = 0; i < 60; i++)
            blot(Math.random() * S, Math.random() * S, 30 + Math.random() * 120,
                Math.random() < 0.5 ? '156,150,136' : '112,104,92', 0.05 + Math.random() * 0.07);
        // Gull splats. There is no promenade without them.
        for (let i = 0; i < 22; i++) {
            const x = Math.random() * S, y = Math.random() * S, r = 7 + Math.random() * 17;
            g.fillStyle = `rgba(244,242,232,${0.5 + Math.random() * 0.35})`;
            g.beginPath();
            for (let k = 0; k <= 14; k++) {
                const a = (k / 14) * TAU;
                const rr2 = r * (0.6 + 0.6 * hash2(i * 3 + k, i));
                const px = x + Math.cos(a) * rr2, py = y + Math.sin(a) * rr2 * 0.8;
                k ? g.lineTo(px, py) : g.moveTo(px, py);
            }
            g.closePath(); g.fill();
            g.fillStyle = 'rgba(226,224,206,0.55)';
            for (let k = 0; k < 5; k++) {
                const a = Math.random() * TAU, d = r * (1.1 + Math.random() * 1.4);
                g.beginPath();
                g.arc(x + Math.cos(a) * d, y + Math.sin(a) * d * 0.8, 1.4 + Math.random() * 3, 0, TAU);
                g.fill();
            }
        }
        // Tyre scuffs and drag marks.
        g.globalAlpha = 0.16;
        for (let i = 0; i < 8; i++) {
            g.strokeStyle = '#4a443c';
            g.lineWidth = 4 + Math.random() * 16;
            g.beginPath();
            const x0 = Math.random() * S, y0 = Math.random() * S, a = Math.random() * TAU, L = 90 + Math.random() * 300;
            g.moveTo(x0, y0);
            g.quadraticCurveTo(x0 + Math.cos(a) * L * 0.5 + 40, y0 + Math.sin(a) * L * 0.5,
                x0 + Math.cos(a) * L, y0 + Math.sin(a) * L);
            g.stroke();
        }
        g.globalAlpha = 1;
    });

    /* --- Butcher's paper the chips came wrapped in ---------------- */
    const paperTex = world.canvasTexture(512, 512, (g, cv) => {
        const S = cv.width;
        g.fillStyle = '#f2ead6';
        g.fillRect(0, 0, S, S);
        // Paper fibre.
        for (let i = 0; i < 9000; i++) {
            g.fillStyle = Math.random() < 0.5 ? 'rgba(210,198,172,0.30)' : 'rgba(255,253,246,0.4)';
            g.fillRect(Math.random() * S, Math.random() * S, 1 + Math.random() * 3, 1);
        }
        // Grease coming through from underneath: warmer, darker, translucent.
        for (let i = 0; i < 26; i++) {
            const x = Math.random() * S, y = Math.random() * S, r = 22 + Math.random() * 96;
            const grad = g.createRadialGradient(x, y, 0, x, y, r);
            grad.addColorStop(0, `rgba(198,158,92,${0.24 + Math.random() * 0.24})`);
            grad.addColorStop(0.6, 'rgba(206,172,108,0.14)');
            grad.addColorStop(1, 'rgba(210,180,120,0)');
            g.fillStyle = grad;
            g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
        }
        // The printed red stripe and the shop's name, half soaked away.
        g.strokeStyle = 'rgba(186,52,44,0.55)';
        g.lineWidth = 9;
        g.beginPath(); g.moveTo(0, 84); g.lineTo(S, 84); g.stroke();
        g.beginPath(); g.moveTo(0, S - 84); g.lineTo(S, S - 84); g.stroke();
        g.fillStyle = 'rgba(70,66,60,0.34)';
        g.font = 'bold 34px Georgia, serif';
        g.fillText('ESPLANADE  FISH & CHIPS', 46, 150);
        g.font = '20px Georgia, serif';
        g.fillStyle = 'rgba(70,66,60,0.22)';
        for (let i = 0; i < 5; i++) g.fillText('minimum chips  ·  potato scallop  ·  flake', 46, 200 + i * 30);
        // Creases.
        g.strokeStyle = 'rgba(148,136,112,0.4)';
        g.lineWidth = 2;
        for (let i = 0; i < 14; i++) {
            g.beginPath();
            const x0 = Math.random() * S, y0 = Math.random() * S;
            g.moveTo(x0, y0);
            g.lineTo(x0 + (Math.random() - 0.5) * 300, y0 + (Math.random() - 0.5) * 300);
            g.stroke();
        }
    });

    /* --- A chip: hot, golden, browned at the ends ----------------- */
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
            const x = Math.random() * S, y = Math.random() * S;
            g.fillStyle = Math.random() < 0.5
                ? `rgba(150,92,26,${0.05 + Math.random() * 0.28})`
                : `rgba(255,236,186,${0.05 + Math.random() * 0.3})`;
            g.beginPath(); g.arc(x, y, 0.7 + Math.random() * 3.2, 0, TAU); g.fill();
        }
        // Blistered crust.
        for (let i = 0; i < 60; i++) {
            const x = Math.random() * S, y = Math.random() * S, r = 3 + Math.random() * 11;
            const rg = g.createRadialGradient(x, y, 0, x, y, r);
            rg.addColorStop(0, 'rgba(122,66,16,0.30)');
            rg.addColorStop(1, 'rgba(122,66,16,0)');
            g.fillStyle = rg;
            g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
        }
        // A dusting of salt.
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
            // Scalloped covert rows: each feather a pale crescent with a soft shadow.
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
                // First-year: brown chevrons scattered right across the coverts.
                for (let i = 0; i < 190; i++) {
                    const v = 0.08 + Math.random() * 0.66;
                    const x = Math.random() * W, y = v * H;
                    const s = 6 + Math.random() * 15;
                    g.strokeStyle = `rgba(${118 + Math.random() * 34},${88 + Math.random() * 26},${48 + Math.random() * 22},${0.30 + Math.random() * 0.4})`;
                    g.lineWidth = 3 + Math.random() * 4;
                    g.beginPath();
                    g.moveTo(x - s, y + s * 0.55);
                    g.lineTo(x, y - s * 0.4);
                    g.lineTo(x + s, y + s * 0.55);
                    g.stroke();
                }
                // Browner, less crisp black in the primaries.
                g.fillStyle = 'rgba(96,74,44,0.42)';
                g.fillRect(0, H * 0.78, W, H * 0.22);
            }
            // Feather shafts running out to the tip.
            g.strokeStyle = 'rgba(60,64,70,0.20)';
            g.lineWidth = 1.4;
            for (let i = 0; i < 9; i++) {
                const x = (i + 0.5) * (W / 9);
                g.beginPath(); g.moveTo(x, H * 0.10); g.lineTo(x + (W / 2 - x) * 0.22, H); g.stroke();
            }
            // White trailing edge, and the white mirrors at the very tip.
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
    const wingTexAdult = wingCanvas(false);
    const wingTexJuv = wingCanvas(true);

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
            // The white mirror near the tip of an outer primary.
            g.fillStyle = juvenile ? 'rgba(226,220,204,0.40)' : 'rgba(255,255,255,0.92)';
            g.beginPath(); g.ellipse(W * 0.5, H * 0.855, W * 0.30, H * 0.045, 0, 0, TAU); g.fill();
            // Shaft.
            g.strokeStyle = 'rgba(250,250,250,0.35)';
            g.lineWidth = 2.2;
            g.beginPath(); g.moveTo(W * 0.5, 0); g.lineTo(W * 0.5, H); g.stroke();
            // Vane texture.
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
    const primTexAdult = primaryCanvas(false);
    const primTexJuv = primaryCanvas(true);

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
            if (juvenile) {          // dusky subterminal band
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
    const tailTexAdult = tailCanvas(false);
    const tailTexJuv = tailCanvas(true);

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

    /* --- Sand, for the beach's colour map -------------------------- */
    const sandTex = world.canvasTexture(512, 512, (g, cv) => {
        const S = cv.width;
        g.fillStyle = '#e6d5b2';
        g.fillRect(0, 0, S, S);
        for (let i = 0; i < 26000; i++) {
            const k = Math.random();
            g.fillStyle = k < 0.3 ? 'rgba(255,250,236,0.55)'
                : k < 0.62 ? 'rgba(196,176,140,0.45)'
                    : k < 0.9 ? 'rgba(222,206,172,0.5)'
                        : 'rgba(126,108,84,0.4)';
            g.fillRect(Math.random() * S, Math.random() * S, 1.3, 1.3);
        }
        // Shell grit and a few wind ripples.
        g.globalAlpha = 0.2;
        for (let i = 0; i < 160; i++) {
            g.strokeStyle = '#c3ad86';
            g.lineWidth = 2 + Math.random() * 5;
            const y = Math.random() * S;
            g.beginPath();
            g.moveTo(0, y);
            for (let x = 0; x <= S; x += 48) g.lineTo(x, y + Math.sin(x * 0.02 + i) * 5);
            g.stroke();
        }
        g.globalAlpha = 1;
    });
    sandTex.wrapS = sandTex.wrapT = THREE.RepeatWrapping;

    /* --- Soft round blob, for dust and haze ------------------------ */
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
       3 · Sky
       ========================================================== */

    const SKY_GLSL = /* glsl */`
      vec3 skyColor(vec3 d, vec3 sunDir, vec3 zen, vec3 mid, vec3 hor, vec3 sunCol) {
        float h = d.y;
        vec3 col = mix(hor, mid, smoothstep(-0.03, 0.26, h));
        col = mix(col, zen, smoothstep(0.13, 0.82, h));
        float sd = max(dot(normalize(d), sunDir), 0.0);
        col += sunCol * pow(sd, 26.0) * 0.36;
        col += sunCol * pow(sd, 4.5) * 0.085;
        col = mix(col, hor * 1.04, smoothstep(0.07, -0.09, h));
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
                col += uSunCol * smoothstep(0.9990, 0.99975, sd) * 5.5;
                gl_FragColor = vec4(col, 1.0);
              }`,
        })
    );
    sky.renderOrder = -10;
    scene.add(world.ghost(sky));

    const clouds = [];
    for (let i = 0; i < 22; i++) {
        const sp = new THREE.Sprite(new THREE.SpriteMaterial({
            map: cloudTex, transparent: true, depthWrite: false, fog: false,
            opacity: rr(0.4, 0.85),
            color: new THREE.Color().setRGB(rr(1.5, 2.0), rr(1.38, 1.82), rr(1.24, 1.62)),
        }));
        const ang = rr(0, TAU), rad = rr(220, 1500);
        const sz = rr(150, 480) * (rad / 700 + 0.5);
        sp.position.set(Math.cos(ang) * rad, rr(120, 420) + rad * 0.05, Math.sin(ang) * rad);
        sp.scale.set(sz, sz * rr(0.34, 0.56), 1);
        sp.userData.drift = rr(0.5, 1.8);
        sp.renderOrder = -5;
        clouds.push(sp);
        scene.add(world.ghost(sp));
    }

    /* ==========================================================
       4 · Sea and sand
       ========================================================== */

    const SEA_Y = -1.62;          // water level
    const SHORE_Z = -30.0;        // where the still-water line meets the sand
    const BEACH_SLOPE = 0.031;    // 1 : 32, which is what a surf beach looks like
    const WALL_Z = -13.4;         // the seawall
    const WALL_FOOT_Y = SEA_Y + (WALL_Z - 1.0 - SHORE_Z) * BEACH_SLOPE;

    const bedHeight = (z) => SEA_Y + (z - SHORE_Z) * BEACH_SLOPE;

    /* --- Water ------------------------------------------------------ */
    const WAVES = [
        [0.05, -1.00, 0.115, 22.0, 0.95],
        [-0.36, -0.93, 0.085, 13.0, 1.08],
        [0.42, -0.91, 0.055, 7.4, 1.22],
        [-0.86, -0.51, 0.035, 4.2, 1.40],
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
    ).join('\n          ');
    const WAVE_AMP = WAVES.reduce((s, w) => s + w[2] * w[3] / TAU, 0);

    const seaUniforms = {
        uTime, uSwash,
        uCamPos: { value: new THREE.Vector3() },
        uSunDir: { value: SUN_DIR.clone() }, uSunCol: { value: C_SUN.clone() },
        uZen: { value: C_ZEN.clone() }, uMid: { value: C_MID.clone() }, uHor: { value: C_HOR.clone() },
        uDeep: { value: C_DEEP.clone() }, uShal: { value: C_SHAL.clone() }, uFoam: { value: C_FOAM.clone() },
        uSeaY: { value: SEA_Y }, uShoreZ: { value: SHORE_Z }, uSlope: { value: BEACH_SLOPE },
        uAmp: { value: WAVE_AMP }, uFogCol: { value: FOG_COL.clone() }, uFogDensity: { value: 0.0046 },
    };

    const SHORE_GLSL = /* glsl */`
      uniform float uSeaY, uShoreZ, uSlope, uSwash;
      // How deep the water is over the sand at a point, with the swash breathing
      // the whole waterline up and down the beach.
      float depthAt(vec2 p) {
        float bed = uSeaY + (p.y - uShoreZ) * uSlope;
        bed += sin(p.x * 0.055 + 1.3) * 0.10 + sin(p.x * 0.021 - 0.4) * 0.16;   // sand bars
        return (uSeaY + uSwash * uSlope) - bed;
      }
    `;

    const seaMat = new THREE.ShaderMaterial({
        uniforms: seaUniforms, transparent: true, depthWrite: true,
        vertexShader: WAVE_GLSL + SHORE_GLSL + /* glsl */`
          uniform float uTime, uAmp;
          varying vec3 vWorld; varying vec3 vNrm; varying float vCrest; varying float vDepth;
          void main(){
            vec3 wp = (modelMatrix * vec4(position, 1.0)).xyz;
            vec2 p = wp.xz; float t = uTime;
            vec3 disp = vec3(0.0), tang = vec3(1.0, 0.0, 0.0), bino = vec3(0.0, 0.0, 1.0);
            ${waveCalls}
            float d = length(cameraPosition.xz - p);
            float far = 1.0 - smoothstep(180.0, 700.0, d) * 0.75;
            float dep = depthAt(p);
            // Waves shoal: they steepen as the bottom comes up, then break.
            float shoal = smoothstep(3.2, 0.35, dep);
            disp.y *= (1.0 + shoal * 1.35) * smoothstep(0.02, 0.55, dep);
            disp.xz *= (1.0 - shoal * 0.45);
            disp *= far;
            vec3 wpos = wp + disp;
            wpos.y = min(wpos.y, uSeaY + 1.2);
            vNrm = normalize(mix(vec3(0.0, 1.0, 0.0), normalize(cross(bino, tang)), far));
            vCrest = clamp(disp.y / max(uAmp, 0.001), -1.0, 1.0);
            vDepth = dep;
            vWorld = wpos;
            gl_Position = projectionMatrix * viewMatrix * vec4(wpos, 1.0);
          }`,
        fragmentShader: SKY_GLSL + SHORE_GLSL + /* glsl */`
          uniform float uTime, uFogDensity;
          uniform vec3 uCamPos, uSunDir, uSunCol, uZen, uMid, uHor, uDeep, uShal, uFoam, uFogCol;
          varying vec3 vWorld; varying vec3 vNrm; varying float vCrest; varying float vDepth;

          float h21(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
          float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
            float a = h21(i), b = h21(i + vec2(1.0, 0.0)), c = h21(i + vec2(0.0, 1.0)), d = h21(i + vec2(1.0, 1.0));
            return mix(mix(a, b, f.x), mix(c, d, f.x), f.y); }
          float fbm(vec2 p){ float s = 0.0, a = 0.5; for(int i = 0; i < 4; i++){ s += a * vn(p); p *= 2.05; a *= 0.5; } return s; }

          void main(){
            float dist = length(uCamPos - vWorld);
            vec3 N = normalize(vNrm);
            float lod = clamp(dist / 90.0, 0.30, 6.0);
            vec2 rp = vWorld.xz * (0.85 / lod);
            float n1 = fbm(rp + vec2(uTime * 0.30, uTime * 0.17) / lod);
            float n2 = fbm(rp * 2.2 - vec2(uTime * 0.22, uTime * 0.34) / lod);
            N = normalize(N + vec3((n1 - 0.5) * 0.42, 0.0, (n2 - 0.5) * 0.42));

            vec3 V = normalize(uCamPos - vWorld);
            float fres = mix(0.028, 1.0, pow(1.0 - max(dot(N, V), 0.0), 5.0));
            vec3 R = reflect(-V, N); R.y = abs(R.y);
            vec3 refl = skyColor(R, uSunDir, uZen, uMid, uHor, uSunCol);

            float shallowF = smoothstep(0.0, 6.5, vDepth);
            vec3 body = mix(uShal, uDeep, shallowF);
            body *= 0.80 + 0.44 * max(dot(N, uSunDir), 0.0);
            body += uShal * pow(max(vCrest, 0.0), 2.0) * 0.55 * (1.0 - shallowF * 0.5);   // light through the back of a wave

            vec3 col = mix(body, refl, clamp(fres, 0.0, 1.0));

            vec3 H = normalize(V + uSunDir);
            float ndh = max(dot(N, H), 0.0);
            col += uSunCol * (pow(ndh, 520.0) * 0.9 + pow(ndh, 90.0) * 0.10 * (0.3 + 0.7 * fbm(vWorld.xz * 1.6 + uTime * 0.5)));

            // Foam: the broken band in the shallows, plus torn crests further out.
            float band = fbm(vWorld.xz * 0.20 + vec2(0.0, uTime * 0.16));
            float surge = 0.5 + 0.5 * sin(uTime * 0.62 - vDepth * 2.1 + band * 3.0);
            float foam = smoothstep(1.5, 0.02, vDepth) * smoothstep(0.18, 0.62, band * 0.5 + surge * 0.7);
            foam += smoothstep(0.72, 1.0, vCrest) * smoothstep(0.5, 0.95, fbm(vWorld.xz * 0.9 - uTime * 0.2)) * 0.35;
            foam = clamp(foam, 0.0, 1.0);
            col = mix(col, uFoam * (0.92 + 0.18 * n1), foam * 0.94);

            float alpha = clamp(max(smoothstep(0.0, 0.55, vDepth), foam), 0.0, 1.0);
            float fog = 1.0 - exp(-pow(dist * uFogDensity, 2.0));
            col = mix(col, uFogCol, fog);
            alpha = mix(alpha, 1.0, fog);
            gl_FragColor = vec4(col, alpha);
          }`,
    });

    // The mesh is graded rather than even: rows crowd into the shallows, where
    // the waves are doing something, and stretch out toward the horizon, where
    // they are not. A kilometre of water for the price of sixty thousand
    // triangles, and half a metre of resolution where the surf is.
    const seaGeo = (() => {
        const g = new THREE.PlaneGeometry(1, 1, 160, 110);
        g.rotateX(-Math.PI / 2);
        const p = g.attributes.position;
        for (let i = 0; i < p.count; i++) {
            const u = p.getX(i) * 2;                 // -1 .. 1, across
            const v = clamp(0.5 - p.getZ(i), 0, 1);  // 0 at the shore, 1 at the horizon
            p.setXYZ(i,
                Math.sign(u) * Math.pow(Math.abs(u), 1.7) * 820,
                SEA_Y,
                SHORE_Z + 6 - Math.pow(v, 2.2) * 980);
        }
        g.computeVertexNormals();
        return g;
    })();
    // Not registered as ground: it is a kilometre wide and behind a seawall, and
    // sizing the walk's grid to it would spend every cell on open water.
    const sea = new THREE.Mesh(seaGeo, seaMat);
    sea.renderOrder = 2;
    scene.add(world.ghost(sea));

    /* --- The sand, wet where the water has just been ---------------- */
    const beachUniforms = {
        uTime, uSwash,
        uSand: { value: sandTex },
        uSeaY: { value: SEA_Y }, uShoreZ: { value: SHORE_Z }, uSlope: { value: BEACH_SLOPE },
        uFoam: { value: C_FOAM.clone() },
        uDry: { value: C_SAND.clone() }, uWet: { value: srgb(0x9c8360) },
        uFogCol: { value: FOG_COL.clone() }, uFogDensity: { value: 0.0046 },
        uCamPos: seaUniforms.uCamPos,
        uSunDir: { value: SUN_DIR.clone() }, uSunCol: { value: C_SUN.clone() },
    };
    const beachGeo = new THREE.PlaneGeometry(520, 34, 130, 26);
    beachGeo.rotateX(-Math.PI / 2);
    {
        const p = beachGeo.attributes.position;
        for (let i = 0; i < p.count; i++) {
            const x = p.getX(i), z = p.getZ(i) + (SHORE_Z + 1.0);
            let y = bedHeight(z);
            y += Math.sin(x * 0.055 + 1.3) * 0.10 + Math.sin(x * 0.021 - 0.4) * 0.16;
            y += (fbm2(x * 0.09, z * 0.09, 3) - 0.5) * 0.16;
            p.setXYZ(i, x, y, p.getZ(i));
        }
        beachGeo.computeVertexNormals();
        beachGeo.translate(0, 0, SHORE_Z + 1.0);
    }
    const beach = new THREE.Mesh(beachGeo, new THREE.ShaderMaterial({
        uniforms: beachUniforms,
        vertexShader: `varying vec3 vWorld; varying vec3 vNrm;
          void main(){
            vWorld = (modelMatrix * vec4(position, 1.0)).xyz;
            vNrm = normalize(mat3(modelMatrix) * normal);
            gl_Position = projectionMatrix * viewMatrix * vec4(vWorld, 1.0);
          }`,
        fragmentShader: /* glsl */`
          uniform sampler2D uSand;
          uniform float uTime, uSwash, uSeaY, uShoreZ, uSlope, uFogDensity;
          uniform vec3 uFoam, uDry, uWet, uFogCol, uCamPos, uSunDir, uSunCol;
          varying vec3 vWorld; varying vec3 vNrm;

          float h21(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
          float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
            float a = h21(i), b = h21(i + vec2(1.0, 0.0)), c = h21(i + vec2(0.0, 1.0)), d = h21(i + vec2(1.0, 1.0));
            return mix(mix(a, b, f.x), mix(c, d, f.x), f.y); }
          float fbm(vec2 p){ float s = 0.0, a = 0.5; for(int i = 0; i < 4; i++){ s += a * vn(p); p *= 2.05; a *= 0.5; } return s; }

          void main(){
            vec3 tex = texture2D(uSand, vWorld.xz * vec2(0.10, 0.10)).rgb;
            // Where the water is now, and how far up it has ever reached today.
            float bed = uSeaY + (vWorld.z - uShoreZ) * uSlope;
            float here = (uSeaY + uSwash * uSlope) - bed;
            float wetted = smoothstep(-0.30, 0.10, here + 0.55);
            float wobble = fbm(vec2(vWorld.x * 0.09, uTime * 0.06)) * 0.35;

            vec3 col = mix(uDry, uWet, clamp(wetted + wobble * 0.35, 0.0, 1.0) * 0.85) * tex * 1.55;
            // The lace of foam right at the edge, and the scum line it leaves.
            float edge = smoothstep(0.16, 0.0, abs(here + 0.05));
            float lace = fbm(vWorld.xz * 2.4 + vec2(uTime * 0.4, uTime * 0.9));
            col = mix(col, uFoam, edge * smoothstep(0.35, 0.7, lace) * 0.9);
            float scum = smoothstep(0.10, 0.0, abs(here + 0.34));
            col = mix(col, uFoam * 0.94, scum * smoothstep(0.4, 0.8, fbm(vWorld.xz * 3.1)) * 0.4);

            float ndl = max(dot(normalize(vNrm), uSunDir), 0.0);
            col *= 0.42 + 0.75 * ndl;
            col += uSunCol * pow(ndl, 6.0) * wetted * 0.30;     // wet sand goes specular

            float dist = length(uCamPos - vWorld);
            col = mix(col, uFogCol, 1.0 - exp(-pow(dist * uFogDensity, 2.0)));
            gl_FragColor = vec4(col, 1.0);
          }`,
    }));
    beach.renderOrder = 0;
    scene.add(world.ground(beach));

    /* --- Dune grass along the foot of the wall ---------------------- */
    {
        const blade = new THREE.PlaneGeometry(0.022, 0.62, 1, 3);
        blade.translate(0, 0.31, 0);
        {
            const p = blade.attributes.position;
            for (let i = 0; i < p.count; i++) {
                const t = p.getY(i) / 0.62;
                p.setX(i, p.getX(i) * (1 - t * 0.85));
                p.setZ(i, -t * t * 0.20);
            }
            blade.computeVertexNormals();
        }
        const grassMat = new THREE.MeshStandardMaterial({
            color: srgb(0x9fa878), roughness: 0.95, side: THREE.DoubleSide,
        });
        const COUNT = 600;
        const grass = new THREE.InstancedMesh(blade, grassMat, COUNT);
        const dummy = new THREE.Object3D();
        const col = new THREE.Color();
        for (let i = 0; i < COUNT; i++) {
            const x = rr(-70, 70);
            const z = WALL_Z - 0.6 - Math.pow(rnd(), 1.7) * 5.6;
            dummy.position.set(x, bedHeight(z) - 0.03, z);
            dummy.rotation.set(rr(-0.2, 0.2), rr(0, TAU), rr(-0.35, 0.35));
            dummy.scale.set(rr(0.7, 1.5), rr(0.6, 1.5), 1);
            dummy.updateMatrix();
            grass.setMatrixAt(i, dummy.matrix);
            col.setRGB(rr(0.55, 0.9), rr(0.6, 0.92), rr(0.4, 0.62));
            grass.setColorAt(i, col);
        }
        grass.instanceMatrix.needsUpdate = true;
        if (grass.instanceColor) grass.instanceColor.needsUpdate = true;
        scene.add(world.ghost(grass));
    }

    /* --- A jetty out on the water, and a headland behind it ---------- */
    {
        const silhouette = new THREE.MeshStandardMaterial({ color: srgb(0x5a5f5c), roughness: 1.0 });
        const parts = [];
        const deckGeo = new THREE.BoxGeometry(3.0, 0.45, 96);
        parts.push(placed(deckGeo, -62, SEA_Y + 2.0, SHORE_Z - 78, 0, 0.16, 0));
        const pileGeo = new THREE.CylinderGeometry(0.24, 0.24, 5.4, 6);
        for (let i = 0; i < 22; i++) {
            const t = i / 21;
            const zz = SHORE_Z - 78 - 46 + t * 92;
            const xx = -62 + Math.sin(0.16) * (zz - (SHORE_Z - 78)) * -1;
            for (const s of [-1, 1])
                parts.push(placed(pileGeo, xx + s * 1.2, SEA_Y + 0.2, zz, 0, 0, 0));
        }
        const jetty = new THREE.Mesh(mergeGeometries(parts), silhouette);
        scene.add(world.ghost(jetty));

        const head = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 12), new THREE.MeshStandardMaterial({
            color: srgb(0x6d7a6c), roughness: 1.0,
        }));
        head.position.set(-360, SEA_Y - 6, SHORE_Z - 470);
        head.scale.set(220, 30, 90);
        scene.add(world.ghost(head));
    }

    /* ==========================================================
       5 · The promenade
       ========================================================== */

    const PROM_MIN_Z = WALL_Z, PROM_MAX_Z = 16;

    const promGeo = new THREE.PlaneGeometry(88, PROM_MAX_Z - PROM_MIN_Z, 40, 20);
    promGeo.rotateX(-Math.PI / 2);
    promGeo.translate(0, 0, (PROM_MIN_Z + PROM_MAX_Z) / 2);
    {   // The tiniest crossfall toward the sea, so it reads as a poured slab.
        const p = promGeo.attributes.position;
        for (let i = 0; i < p.count; i++) {
            const x = p.getX(i), z = p.getZ(i);
            p.setY(i, -smooth(PROM_MAX_Z, PROM_MIN_Z, z) * 0.10 + (fbm2(x * 0.13, z * 0.13, 2) - 0.5) * 0.012);
        }
        promGeo.computeVertexNormals();
    }
    const promTex = concreteTex.clone();
    promTex.needsUpdate = true;
    promTex.repeat.set(22, (PROM_MAX_Z - PROM_MIN_Z) / 4);   // one drawn tile = 4 m of slab
    const promenade = new THREE.Mesh(promGeo, new THREE.MeshStandardMaterial({
        map: promTex, color: srgb(0xffffff), roughness: 0.94, metalness: 0.0,
    }));
    promenade.receiveShadow = true;
    scene.add(world.ground(promenade));

    // The marks, laid over the paving as a decal: no repeat, no collision.
    const stains = new THREE.Mesh(
        (() => { const g = new THREE.PlaneGeometry(13, 13); g.rotateX(-Math.PI / 2); return g; })(),
        new THREE.MeshStandardMaterial({
            map: stainTex, transparent: true, depthWrite: false, opacity: 0.88,
            roughness: 0.95, metalness: 0.0,
        })
    );
    stains.position.set(0.2, 0.006, 0.4);
    stains.renderOrder = 3;
    scene.add(world.ghost(stains));

    /* --- Seawall and its cap ----------------------------------------- */
    {
        const wallMat = new THREE.MeshStandardMaterial({
            map: concreteTex.clone(), color: srgb(0xd8d1c2), roughness: 0.95,
        });
        wallMat.map.repeat.set(22, 0.4);
        wallMat.map.needsUpdate = true;

        const H = 0 - WALL_FOOT_Y;                    // the wall's face, promenade → sand
        const parts = [];
        parts.push(placed(new THREE.BoxGeometry(88, H + 0.1, 0.5), 0, WALL_FOOT_Y + (H + 0.1) / 2, WALL_Z - 0.25, 0, 0, 0));
        // Cap: a rounded coping, a hand's width proud of the concrete.
        // A rounded coping: half a cylinder, laid along the wall with its flat
        // face down on the parapet.
        const cap = new THREE.CylinderGeometry(0.17, 0.17, 88, 12, 1, false, 0, Math.PI);
        cap.rotateZ(Math.PI / 2);
        parts.push(placed(cap, 0, 0.30, WALL_Z - 0.25, 0, 0, 0));
        parts.push(placed(new THREE.BoxGeometry(88, 0.30, 0.62), 0, 0.15, WALL_Z - 0.25, 0, 0, 0));
        const wall = new THREE.Mesh(mergeGeometries(parts), wallMat);
        wall.castShadow = wall.receiveShadow = true;
        scene.add(world.ground(wall));
    }

    /* --- Galvanised rail, salt-blown ---------------------------------- */
    {
        const railMat = new THREE.MeshStandardMaterial({
            color: srgb(0xa9aeb0), roughness: 0.44, metalness: 0.72, envMapIntensity: 0.8,
        });
        const parts = [];
        const postGeo = new THREE.CylinderGeometry(0.030, 0.034, 0.92, 10);
        const railGeo = new THREE.CylinderGeometry(0.026, 0.026, 84, 10);
        railGeo.rotateZ(Math.PI / 2);
        for (let i = 0; i < 29; i++) {
            const x = -42 + i * 3.0;
            parts.push(placed(postGeo, x, 0.46, WALL_Z + 0.16, 0, 0, 0));
            parts.push(placed(new THREE.SphereGeometry(0.036, 8, 6), x, 0.92, WALL_Z + 0.16, 0, 0, 0));
        }
        parts.push(placed(railGeo, 0, 0.90, WALL_Z + 0.16, 0, 0, 0));
        parts.push(placed(railGeo, 0, 0.52, WALL_Z + 0.16, 0, 0, 0));
        const rail = new THREE.Mesh(mergeGeometries(parts), railMat);
        rail.castShadow = true;
        scene.add(rail);
    }

    /* --- A bin, because the chips did not go in it --------------------- */
    {
        const bin = new THREE.Group();
        const green = new THREE.MeshStandardMaterial({ color: srgb(0x2f5c47), roughness: 0.62, metalness: 0.18 });
        const steel = new THREE.MeshStandardMaterial({ color: srgb(0x8d9294), roughness: 0.5, metalness: 0.7 });

        const body = new THREE.Mesh(new THREE.CylinderGeometry(0.29, 0.25, 0.86, 20, 1, true), green);
        body.position.y = 0.47;
        body.castShadow = body.receiveShadow = true;
        bin.add(body);

        const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.07, 20), green);
        lid.position.y = 0.94;
        lid.castShadow = true;
        bin.add(lid);

        const hood = new THREE.Mesh(new THREE.SphereGeometry(0.31, 20, 10, 0, TAU, 0, Math.PI * 0.42), green);
        hood.position.y = 0.96;
        hood.scale.y = 0.55;
        hood.castShadow = true;
        bin.add(hood);

        // The gull-proof hood's mouth, and the frame it sits on.
        const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.30, 0.16, 0.03), new THREE.MeshStandardMaterial({
            color: srgb(0x0b0d0c), roughness: 1.0,
        }));
        mouth.position.set(0, 0.99, 0.29);
        bin.add(mouth);

        const legs = [];
        for (let i = 0; i < 3; i++) {
            const a = (i / 3) * TAU + 0.4;
            legs.push(placed(new THREE.CylinderGeometry(0.022, 0.022, 0.14, 8),
                Math.cos(a) * 0.20, 0.07, Math.sin(a) * 0.20, 0, 0, 0));
        }
        legs.push(placed(new THREE.TorusGeometry(0.27, 0.017, 6, 22), 0, 0.14, 0, Math.PI / 2, 0, 0));
        const frame = new THREE.Mesh(mergeGeometries(legs), steel);
        frame.castShadow = true;
        bin.add(frame);

        bin.position.set(-3.4, 0, -1.9);
        bin.rotation.y = 0.5;
        scene.add(world.part('bin_00', bin));
    }

    /* --- Bollards along the landward edge ------------------------------ */
    {
        const bollardGeo = mergeGeometries([
            sweep([V3(0, 0, 0), V3(0, 0.50, 0), V3(0, 0.72, 0), V3(0, 0.80, 0)],
                (t) => 0.075 * (1 - 0.25 * t * t) * (t > 0.86 ? 0.7 : 1), 14),
            placed(new THREE.SphereGeometry(0.062, 14, 8), 0, 0.80, 0, 0, 0, 0),
            placed(new THREE.TorusGeometry(0.078, 0.010, 6, 18), 0, 0.60, 0, Math.PI / 2, 0, 0),
        ]);
        const bollardMat = new THREE.MeshStandardMaterial({
            color: srgb(0x4c4f52), roughness: 0.58, metalness: 0.42,
        });
        const N = 12;
        const bollards = new THREE.InstancedMesh(bollardGeo, bollardMat, N);
        const dummy = new THREE.Object3D();
        for (let i = 0; i < N; i++) {
            dummy.position.set(-26 + i * 4.6, 0, 9.2);
            dummy.rotation.set(0, rr(0, TAU), rr(-0.02, 0.02));
            dummy.scale.setScalar(rr(0.97, 1.04));
            dummy.updateMatrix();
            bollards.setMatrixAt(i, dummy.matrix);
        }
        bollards.castShadow = true;
        bollards.instanceMatrix.needsUpdate = true;
        scene.add(bollards);
    }

    /* --- A stormwater grate, and blown sand on the concrete ------------- */
    {
        const grate = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.05, 0.42),
            new THREE.MeshStandardMaterial({ color: srgb(0x3d3a35), roughness: 0.75, metalness: 0.5 }));
        grate.position.set(2.9, -0.02, -2.4);
        grate.receiveShadow = true;
        scene.add(grate);

        const sandBits = new THREE.InstancedMesh(
            new THREE.PlaneGeometry(0.30, 0.30),
            new THREE.MeshBasicMaterial({ map: puffTex, color: srgb(0xdcc79f), transparent: true, depthWrite: false, opacity: 0.5 }),
            120
        );
        const dummy = new THREE.Object3D();
        for (let i = 0; i < 120; i++) {
            const x = rr(-9, 9), z = rr(WALL_Z + 0.4, 6);
            const near = smooth(WALL_Z + 4.5, WALL_Z, z);
            dummy.position.set(x, 0.004, z);
            dummy.rotation.set(-Math.PI / 2, 0, rr(0, TAU));
            dummy.scale.setScalar(rr(0.4, 1.5) * (0.4 + near));
            dummy.updateMatrix();
            sandBits.setMatrixAt(i, dummy.matrix);
        }
        sandBits.instanceMatrix.needsUpdate = true;
        sandBits.renderOrder = 4;
        scene.add(world.ghost(sandBits));
    }

    /* ==========================================================
       6 · The chips
       ========================================================== */

    const CHIPS = new THREE.Vector2(0.05, -0.10);   // where the food is

    const chipMat = new THREE.MeshStandardMaterial({
        map: chipTex, color: srgb(0xffffff), roughness: 0.62, metalness: 0.0, envMapIntensity: 0.4,
    });
    // One chip: a box, unevenly cut, corners knocked off.
    const chipGeo = (() => {
        const g = new THREE.BoxGeometry(0.011, 0.010, 0.058, 1, 1, 4);
        const p = g.attributes.position;
        for (let i = 0; i < p.count; i++) {
            const z = p.getZ(i);
            const k = 1 - Math.pow(Math.abs(z) / 0.029, 3) * 0.30;
            p.setX(i, p.getX(i) * k + (hash2(i, 3) - 0.5) * 0.0016);
            p.setY(i, p.getY(i) * k + (hash2(i, 7) - 0.5) * 0.0016);
        }
        g.computeVertexNormals();
        return g;
    })();

    // The wrap: a sheet of paper opened out, corners folded up, gone soft.
    {
        const g = new THREE.PlaneGeometry(0.40, 0.34, 10, 9);
        g.rotateX(-Math.PI / 2);
        const p = g.attributes.position;
        for (let i = 0; i < p.count; i++) {
            const x = p.getX(i), z = p.getZ(i);
            const rx = Math.abs(x) / 0.20, rz = Math.abs(z) / 0.17;
            const edge = Math.max(rx, rz);
            let y = Math.pow(smooth(0.42, 1.0, edge), 1.6) * 0.075;   // corners curling up
            y += (fbm2(x * 26 + 4, z * 26 - 2, 3) - 0.5) * 0.014;     // crumple
            y -= smooth(0.55, 0.0, edge) * 0.012;                     // sagging middle
            p.setY(i, y);
            p.setX(i, x * (1 + Math.sin(z * 12) * 0.02));
        }
        g.computeVertexNormals();
        const wrap = new THREE.Mesh(g, new THREE.MeshStandardMaterial({
            map: paperTex, color: srgb(0xffffff), roughness: 0.88, side: THREE.DoubleSide,
        }));
        wrap.position.set(CHIPS.x, 0.004, CHIPS.y);
        wrap.rotation.y = -0.38;
        wrap.castShadow = wrap.receiveShadow = true;
        scene.add(world.ghost(world.part('wrap_00', wrap)));
    }

    // The chips themselves: a heap on the paper, the rest kicked out across the
    // concrete, which is why there are four birds here and not one.
    {
        const N = 96;
        const chips = new THREE.InstancedMesh(chipGeo, chipMat, N);
        const dummy = new THREE.Object3D();
        for (let i = 0; i < N; i++) {
            const inWrap = i < 42;
            let x, z, y;
            if (inWrap) {
                const a = rr(0, TAU), d = Math.pow(rnd(), 0.6) * 0.14;
                x = CHIPS.x + Math.cos(a) * d;
                z = CHIPS.y + Math.sin(a) * d * 0.85;
                y = 0.012 + rnd() * 0.030;
            } else {
                const a = rr(0, TAU), d = 0.16 + Math.pow(rnd(), 0.7) * 1.35;
                x = CHIPS.x + Math.cos(a) * d;
                z = CHIPS.y + Math.sin(a) * d;
                y = 0.007;
            }
            dummy.position.set(x, y, z);
            dummy.rotation.set(inWrap ? rr(-0.7, 0.7) : rr(-0.10, 0.10), rr(0, TAU), inWrap ? rr(-0.7, 0.7) : rr(-0.12, 0.12));
            dummy.scale.set(rr(0.75, 1.35), rr(0.8, 1.25), rr(0.45, 1.25));
            dummy.updateMatrix();
            chips.setMatrixAt(i, dummy.matrix);
        }
        chips.instanceMatrix.needsUpdate = true;
        chips.castShadow = true;
        scene.add(world.ghost(chips));
    }

    // Three loose ones, big enough to be worth arguing over — and to pick up.
    const HERO_CHIPS = [[0.42, 0.28, 0.7], [-0.52, 0.16, -0.4], [0.30, -0.66, 2.3]];
    HERO_CHIPS.forEach(([x, z, ry], i) => {
        const c = new THREE.Mesh(chipGeo, chipMat);
        c.position.set(x, 0.007, z);
        c.rotation.set(0.04, ry, 0.03);
        c.scale.set(1.25, 1.2, 1.35);
        c.castShadow = true;
        scene.add(world.ghost(world.part('chip_0' + i, c)));
    });

    /* ==========================================================
       7 · One silver gull, built once
       ========================================================== */

    /* Shared geometry. Every bird here is the same species and near enough the
       same size, so the shapes are cut once and the birds differ by material,
       scale and what they are doing.                                          */

    const G = {};

    // Trunk: a sphere pulled into the deep-chested teardrop of a gull, with the
    // rump swell and the feathered thighs merged straight in.
    G.body = (() => {
        const s = new THREE.SphereGeometry(1, 24, 16);
        const p = s.attributes.position;
        for (let i = 0; i < p.count; i++) {
            const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
            const aft = Math.max(0, -z);                       // toward the tail
            const fore = Math.max(0, z);
            const taper = Math.pow(1 - 0.56 * aft, 1.10);
            const rx = 0.0615 * taper;
            const ry = 0.0700 * taper * (y < 0 ? 1.10 : 0.95) * (1 + fore * 0.10);
            const yc = 0.1560 + 0.0180 * Math.pow(aft, 1.7) - 0.0060 * fore;
            p.setXYZ(i, x * rx, y * ry + yc, -0.014 + z * 0.126);
        }
        s.computeVertexNormals();
        const parts = [s];
        // Rump.
        parts.push(placed(new THREE.SphereGeometry(0.038, 10, 8), 0, 0.1700, -0.1140, 0, 0, 0)
            .scale(1.05, 0.86, 1.30));
        // Shoulder coverts, hiding where the wing joins the mantle.
        for (const side of [-1, 1])
            parts.push(placed(new THREE.SphereGeometry(0.031, 10, 8), side * 0.040, 0.1985, 0.040, 0, 0, 0)
                .scale(0.85, 0.72, 1.20));
        // Feathered thighs, reaching down far enough to swallow the top of the
        // tarsus however far the bird crouches.
        for (const side of [-1, 1])
            parts.push(placed(new THREE.SphereGeometry(0.026, 10, 8), side * 0.0290, 0.0980, -0.0110, 0, 0, 0)
                .scale(0.90, 1.45, 1.25));
        // Breast, fuller than a sphere wants to be.
        parts.push(placed(new THREE.SphereGeometry(0.050, 12, 8), 0, 0.1520, 0.0850, 0, 0, 0)
            .scale(1.02, 1.02, 0.86));
        return mergeGeometries(parts);
    })();

    // Neck: short, thick, and able to fold right down onto the shoulders.
    G.neck = sweep([
        V3(0, -0.006, -0.004), V3(0, 0.016, 0.002), V3(0, 0.040, 0.008),
        V3(0, 0.064, 0.014), V3(0, 0.082, 0.020),
    ], (t) => lerp(0.0500, 0.0270, Math.pow(t, 0.80)), 14);

    // Skull, with the flat crown and full nape a gull has, plus the throat.
    G.head = (() => {
        const s = new THREE.SphereGeometry(0.0335, 16, 12);
        const p = s.attributes.position;
        for (let i = 0; i < p.count; i++) {
            const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
            const yn = y / 0.0335, zn = z / 0.0335;
            const crown = 1 - 0.10 * smooth(0.2, 1.0, yn);        // flatter on top
            const nape = 1 + 0.14 * smooth(0.1, -1.0, zn) * smooth(0.6, -0.4, yn);
            p.setXYZ(i, x * 0.94, y * 0.98 * crown, z * 1.16 * nape - 0.002);
        }
        s.computeVertexNormals();
        return mergeGeometries([
            s,
            placed(new THREE.SphereGeometry(0.026, 12, 8), 0, -0.0160, 0.0110, 0, 0, 0).scale(0.94, 0.86, 1.06),
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
            p.setY(i, p.getY(i) - t * t * 0.0068);                 // the hook at the tip
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
            p.setY(i, p.getY(i) - Math.pow(t, 1.6) * 0.0062 + Math.pow(t, 3.0) * 0.0034);  // gonys
        }
        c.computeVertexNormals();
        return c;
    })();

    // Eyes. A silver gull's is a white iris with a black pupil in a red rim, and
    // that rim is the same red as the bill — so the rings ride with the fixed
    // upper mandible below, and the eye itself is three merged pairs: irises,
    // pupils, and one lid that comes down over both at a blink.
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
    // swings both caps down in place. Baking the parked angle into the geometry
    // instead would swing them off the face entirely.
    G.lid = mergeGeometries([-1, 1].map(s =>
        placed(new THREE.SphereGeometry(0.0082, 10, 5, 0, TAU, 0, Math.PI * 0.5),
            s * EYE.x, 0, 0, 0, 0, 0)));

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
        for (let i = 0; i < U; i++) {
            for (let j = 0; j < TH; j++) {
                const a = i * (TH + 1) + j, b = a + TH + 1;
                if (side > 0) idx.push(a, b, a + 1, b, b + 1, a + 1);
                else idx.push(a, a + 1, b, b, a + 1, b + 1);
            }
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

    // The black primaries that cross over the tail and out past it.
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

    // The tail: twelve feathers in a shallow fan, merged — a gull's tail spreads
    // by rotating at the root, not by splaying, so one mesh is honest here.
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
        parts.push(placed(new THREE.SphereGeometry(0.028, 10, 8), 0, 0.0040, 0.0100, 0, 0, 0).scale(1.0, 0.72, 1.5));
        return mergeGeometries(parts);
    })();

    // Tarsus, and the webbed foot: three forward toes joined by the web, and the
    // small hind toe behind. Merged, because a foot never moves on its own.
    G.tarsus = sweep([
        V3(0, 0.000, 0.000), V3(0, -0.014, -0.0060), V3(0, -0.030, -0.0056),
        V3(0, -0.046, -0.0016), V3(0, -0.0530, 0.0022),
    ], (t) => lerp(0.0098, 0.0056, t), 10);
    G.foot = (() => {
        const parts = [];
        const TOES = [
            { yaw: 0.00, len: 0.0360 },
            { yaw: 0.52, len: 0.0330 },
            { yaw: -0.52, len: 0.0330 },
        ];
        for (const toe of TOES) {
            const pts = [];
            for (let i = 0; i < 5; i++) {
                const t = i / 4;
                pts.push(V3(Math.sin(toe.yaw) * toe.len * t, -t * t * 0.0060, Math.cos(toe.yaw) * toe.len * t));
            }
            parts.push(sweep(pts, (t) => lerp(0.0044, 0.0024, t), 7));
            const claw = new THREE.ConeGeometry(0.0022, 0.0090, 6);
            parts.push(placed(claw, pts[4].x, pts[4].y, pts[4].z, Math.PI / 2 + 0.9, toe.yaw, 0));
        }
        // Hind toe.
        parts.push(sweep([V3(0, 0, 0), V3(0, -0.0035, -0.0120), V3(0, -0.0062, -0.0210)],
            (t) => lerp(0.0038, 0.0020, t), 6));
        // The web: two thin triangles filling between the front toes.
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

    /* --- Two sets of feathers: an adult, and a first-year -------------- */
    function plumage(juv) {
        const white = juv ? 0xece7dc : 0xfdfdfb;
        return {
            body: new THREE.MeshStandardMaterial({
                map: bodyTex, color: srgb(white), roughness: 0.86, metalness: 0.02, envMapIntensity: 0.5,
            }),
            wing: new THREE.MeshStandardMaterial({
                map: juv ? wingTexJuv : wingTexAdult, color: srgb(0xffffff),
                roughness: 0.80, metalness: 0.03, envMapIntensity: 0.45,
            }),
            prim: new THREE.MeshStandardMaterial({
                map: juv ? primTexJuv : primTexAdult, color: srgb(0xffffff), side: THREE.DoubleSide,
                roughness: 0.72, envMapIntensity: 0.45,
            }),
            tail: new THREE.MeshStandardMaterial({
                map: juv ? tailTexJuv : tailTexAdult, color: srgb(0xffffff), side: THREE.DoubleSide,
                roughness: 0.80, envMapIntensity: 0.4,
            }),
            bill: new THREE.MeshStandardMaterial({
                color: srgb(juv ? 0x4d3a2c : 0xd0341f), roughness: juv ? 0.62 : 0.34,
                metalness: 0.05, envMapIntensity: 0.9,
            }),
            leg: new THREE.MeshStandardMaterial({
                color: srgb(juv ? 0x6b5442 : 0xd8452a), roughness: 0.52, metalness: 0.04, envMapIntensity: 0.7,
            }),
            iris: new THREE.MeshStandardMaterial({
                color: srgb(juv ? 0x6a5540 : 0xf6f4ea), roughness: 0.22, metalness: 0.0, envMapIntensity: 1.5,
            }),
            pupil: new THREE.MeshStandardMaterial({ color: srgb(0x06070a), roughness: 0.10 }),
        };
    }
    const MATS = { adult: plumage(false), juv: plumage(true) };

    /**
     * One bird, feet at the origin, facing +z. Returns the rig the brain drives.
     */
    function makeGull(kind, scale) {
        const M = MATS[kind];
        const root = new THREE.Group();

        // carriage: everything above the ground, so the whole bird can crouch,
        // pitch forward into a threat, and bob as it walks.
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
        head.position.set(0, 0.0965, 0.0245);
        headPivot.add(head);

        const skull = new THREE.Mesh(G.head, M.body);
        skull.castShadow = true;
        head.add(skull);

        const billFixed = new THREE.Mesh(G.billFixed, M.bill);
        billFixed.castShadow = true;
        head.add(billFixed);

        const bill = new THREE.Group();          // only the lower mandible swings
        bill.position.set(0, -0.0020, 0.0300);
        bill.rotation.x = -0.06;
        head.add(bill);
        const billLower = new THREE.Mesh(G.billLower, M.bill);
        billLower.position.set(0, -0.0052, 0.0010);
        bill.add(billLower);

        const iris = new THREE.Mesh(G.iris, M.iris);
        head.add(iris);
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
        return {
            root, carriage, body, headPivot, head, bill, billLower, lid, iris,
            wings, tailPivot, legs, scale,
            standY: 0,
        };
    }

    /* ==========================================================
       8 · Who is on the concrete
       ========================================================== */

    const GULLS = [];

    /**
     * A bird, its home on the paving, and the small set of numbers the drama
     * writes into: where it wants to be, how it is standing, what its head
     * is doing. Everything eases, so nothing snaps.
     */
    function addGull(name, kind, scale, hx, hz, heading, role) {
        const rig = makeGull(kind, scale);
        const part = new THREE.Group();
        part.position.set(hx, 0, hz);
        const motion = new THREE.Group();          // the sim moves this, not the part
        motion.add(rig.root);
        part.add(motion);
        scene.add(world.ghost(world.part(name, part)));

        const g = {
            name, rig, part, motion, role, kind,
            home: new THREE.Vector2(hx, hz),
            pos: new THREE.Vector2(hx, hz),
            goal: new THREE.Vector2(hx, hz),
            // Its own patch of spilled chips, between where it stands and the wrap,
            // so four birds do not all stab at the same square inch.
            food: new THREE.Vector2(lerp(hx, CHIPS.x, 0.45), lerp(hz, CHIPS.y, 0.45)),
            peckRate: rr(3.2, 4.0),
            heading, speed: 0, stepPhase: rnd() * TAU, gait: 0,
            // posture, and where the posture is heading
            neck: 0.30, neckT: 0.30,
            pitch: 0.00, pitchT: 0.00,        // skull, against the neck
            yaw: 0.00, yawT: 0.00,
            crouch: 0, crouchT: 0,
            lean: 0, leanT: 0,
            wing: 0, wingT: 0,
            flap: 0, flapT: 0,
            tailUp: 0, tailUpT: 0,
            gape: 0, gapeT: 0,
            blink: 0, blinkTimer: rr(1.0, 5.0),
            timer: rr(0.2, 1.6), mode: 'idle',
            peck: 0, pecking: 0,
            call: 0,
            ruffle: 0,
            wobble: rr(0, TAU),
        };
        GULLS.push(g);
        return g;
    }

    // The one doing the chasing: a big adult, right on the food.
    const BOSS = addGull('gull_00', 'adult', 1.14, 0.62, 0.58, -2.35, 'boss');
    // The one being chased: this year's bird, still brown across the wing.
    const RUNT = addGull('gull_01', 'juv', 1.02, 1.62, 1.34, -2.5, 'runt');
    // And three with their heads down, who could not care less.
    const FEEDERS = [
        addGull('gull_02', 'adult', 1.10, -0.66, 0.42, 2.05, 'feeder'),
        addGull('gull_03', 'adult', 1.06, -0.30, -0.86, 0.55, 'feeder'),
        addGull('gull_04', 'juv', 1.00, 0.86, -0.94, -0.95, 'feeder'),
    ];

    // One of them has actually got a chip, which is the entire cause of this.
    {
        const held = new THREE.Mesh(chipGeo, chipMat);
        held.position.set(0.006, -0.0075, 0.030);
        held.rotation.set(0, 1.35, 0.12);
        held.scale.setScalar(1.15);
        held.castShadow = true;
        FEEDERS[0].rig.bill.add(held);
        FEEDERS[0].heldChip = held;
    }

    /* ==========================================================
       9 · Gulls in the air
       ========================================================== */

    // Simpler birds, twelve metres up, ghosted so the walk passes under them.
    const FLYERS = [];
    {
        // A gull's tail is white, same as its back, so it merges into the body
        // and a bird in the air costs four draws instead of five.
        const flyTail = (() => {
            const parts = [];
            for (let i = 0; i < 7; i++) {
                const t = (i / 6) * 2 - 1;
                parts.push(placed(featherGeo(0.135 - Math.abs(t) * 0.030, 0.030, 0.020, 0.002),
                    0, 0.008, -0.120, 0, t * 0.30, 0));
            }
            return mergeGeometries(parts);
        })();

        const flyBody = mergeGeometries([
            (() => {
                const s = new THREE.SphereGeometry(1, 18, 12);
                const p = s.attributes.position;
                for (let i = 0; i < p.count; i++) {
                    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
                    const taper = Math.pow(1 - 0.52 * Math.max(0, -z), 1.1);
                    p.setXYZ(i, x * 0.058 * taper, y * 0.062 * taper, z * 0.135);
                }
                s.computeVertexNormals();
                return s;
            })(),
            // Neck and head, held out in front the way a gull flies.
            sweep([V3(0, 0.010, 0.100), V3(0, 0.014, 0.140), V3(0, 0.012, 0.172)],
                (t) => lerp(0.040, 0.026, t), 12),
            placed(new THREE.SphereGeometry(0.030, 12, 8), 0, 0.012, 0.196, 0, 0, 0).scale(0.95, 0.94, 1.16),
            flyTail,
        ]);
        const flyBill = placed(G.billUpper, 0, 0.008, 0.222, -0.04, 0, 0);

        // A spread wing: uv.v runs shoulder → tip so the same painting works.
        function spreadWingGeo(side) {
            const SPAN = 22, CH = 5;
            const pos = [], uvs = [], idx = [];
            for (let i = 0; i <= SPAN; i++) {
                const u = i / SPAN;
                const span = 0.46 * u;
                const chord = 0.115 * Math.pow(Math.sin(Math.PI * (0.13 + 0.80 * u)), 0.5) * (1 - 0.55 * u * u);
                const sweepBack = -0.020 - 0.115 * u * u;
                const rise = 0.030 * Math.sin(u * 2.2) - 0.030 * u * u;
                for (let j = 0; j <= CH; j++) {
                    const v = j / CH;
                    pos.push(side * span, 0.185 + rise - v * 0.012, 0.030 + sweepBack - (v - 0.2) * chord);
                    uvs.push(v, u);
                }
            }
            for (let i = 0; i < SPAN; i++) {
                for (let j = 0; j < CH; j++) {
                    const a = i * (CH + 1) + j, b = a + CH + 1;
                    if (side > 0) idx.push(a, b, a + 1, b, b + 1, a + 1);
                    else idx.push(a, a + 1, b, b, a + 1, b + 1);
                }
            }
            const g = new THREE.BufferGeometry();
            g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
            g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
            g.setIndex(idx);
            g.computeVertexNormals();
            return g;
        }
        const wingGeoL = spreadWingGeo(-1), wingGeoR = spreadWingGeo(1);

        for (let i = 0; i < 3; i++) {
            const grp = new THREE.Group();
            const M = MATS.adult;
            const b = new THREE.Mesh(flyBody, M.body);
            b.castShadow = true;
            grp.add(b);
            grp.add(new THREE.Mesh(flyBill, M.bill));
            const ws = [];
            for (const [geo, side] of [[wingGeoL, -1], [wingGeoR, 1]]) {
                const w = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
                    map: wingTexAdult, color: srgb(0xffffff), side: THREE.DoubleSide,
                    roughness: 0.78, envMapIntensity: 0.5,
                }));
                w.castShadow = true;
                grp.add(w);
                ws.push({ mesh: w, side });
            }
            grp.scale.setScalar(1.15);
            scene.add(world.ghost(grp));
            FLYERS.push({
                grp, wings: ws,
                r: rr(11, 24), y: rr(6.5, 13), a: rr(0, TAU),
                spd: rr(0.09, 0.17) * (rnd() < 0.5 ? -1 : 1),
                cx: rr(-6, 6), cz: rr(-8, 2),
                flapPhase: rr(0, TAU), flapRate: rr(2.6, 3.6), glide: rr(0, 1),
            });
        }
    }

    /* ==========================================================
       10 · Dust, and a loose feather
       ========================================================== */

    const DUST = [];
    for (let i = 0; i < 10; i++) {
        const sp = new THREE.Sprite(new THREE.SpriteMaterial({
            map: puffTex, color: srgb(0xd9c9a8), transparent: true, depthWrite: false, opacity: 0,
        }));
        sp.renderOrder = 5;
        scene.add(world.ghost(sp));
        DUST.push({ sp, life: 0, ttl: 1, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, size: 0 });
    }
    let dustCursor = 0;
    function puffAt(x, z, strength) {
        for (let k = 0; k < 2; k++) {
            const d = DUST[dustCursor];
            dustCursor = (dustCursor + 1) % DUST.length;
            d.life = 0;
            d.ttl = rr(0.55, 1.0);
            d.x = x + rr(-0.05, 0.05);
            d.y = 0.02;
            d.z = z + rr(-0.05, 0.05);
            d.vx = rr(-0.28, 0.28) * strength;
            d.vy = rr(0.10, 0.32) * strength;
            d.vz = rr(-0.28, 0.28) * strength;
            d.size = rr(0.10, 0.22) * strength;
        }
    }

    const LOOSE = [];
    {
        const fgeo = featherGeo(0.058, 0.020, 0.008, 0.004);
        for (let i = 0; i < 3; i++) {
            const f = new THREE.Mesh(fgeo, MATS.adult.tail);
            f.visible = false;
            scene.add(world.ghost(f));
            LOOSE.push({ mesh: f, life: 99, x: 0, y: 0, z: 0, vy: 0, spin: 0, phase: rr(0, TAU) });
        }
    }
    let looseCursor = 0;
    function shedFeather(x, y, z) {
        const f = LOOSE[looseCursor];
        looseCursor = (looseCursor + 1) % LOOSE.length;
        f.life = 0;
        f.x = x; f.y = y; f.z = z;
        f.vy = rr(0.02, 0.10);
        f.spin = rr(-1.6, 1.6);
        f.mesh.visible = true;
    }

    /* ==========================================================
       11 · The argument
       ========================================================== */

    // Where the juvenile gets driven to, and where it slinks back from. Both are
    // kept close: a chase that leaves the frame is a chase nobody watched.
    const FLEE_TO = new THREE.Vector2(2.50, 1.90);
    const LURK = new THREE.Vector2(1.80, 1.40);
    const BOSS_POST = new THREE.Vector2(0.47, 0.44);   // where the adult stands to eat

    const drama = { phase: 'feed', t: 0, timer: rr(11, 15) };

    const _dir = new THREE.Vector2();

    /** Turn toward a point and walk at it; returns the distance still to go. */
    function driveTo(g, tx, tz, speed, dt, turnRate) {
        _dir.set(tx - g.pos.x, tz - g.pos.y);
        const dist = _dir.length();
        if (dist > 1e-4) {
            const want = Math.atan2(_dir.x, _dir.y);
            let d = want - g.heading;
            while (d > Math.PI) d -= TAU;
            while (d < -Math.PI) d += TAU;
            const step = clamp(d, -turnRate * dt, turnRate * dt);
            g.heading += step;
        }
        const move = Math.min(speed * dt, dist);
        g.pos.x += Math.sin(g.heading) * move;
        g.pos.y += Math.cos(g.heading) * move;
        g.speed = dt > 1e-5 ? move / dt : 0;
        return dist - move;
    }

    /** Stand still, but keep turning to face something. */
    function faceToward(g, tx, tz, dt, turnRate) {
        _dir.set(tx - g.pos.x, tz - g.pos.y);
        if (_dir.lengthSq() < 1e-8) return;
        const want = Math.atan2(_dir.x, _dir.y);
        let d = want - g.heading;
        while (d > Math.PI) d -= TAU;
        while (d < -Math.PI) d += TAU;
        g.heading += clamp(d, -turnRate * dt, turnRate * dt);
        g.speed = 0;
    }

    /** The neutral standing posture of a gull that is not up to anything. */
    function relax(g) {
        g.neckT = 0.24; g.pitchT = -0.06; g.crouchT = 0; g.leanT = 0.02;
        g.wingT = 0; g.flapT = 0; g.tailUpT = 0; g.gapeT = 0;
    }

    /**
     * The threat: breast down, neck flat out along the ground, and the skull
     * cranked back the other way so the bill points up and the eyes come up
     * with it. Wings held a little off the body, tail cocked.
     */
    function threatPose(g, intensity) {
        g.neckT = lerp(0.24, 1.42, intensity);      // neck folds forward and down
        g.pitchT = lerp(-0.06, -1.80, intensity);   // skull cranks back against it
        g.crouchT = lerp(0, 0.74, intensity);
        g.leanT = lerp(0.02, 0.50, intensity);
        g.wingT = lerp(0, 0.34, intensity);
        g.tailUpT = lerp(0, 0.72, intensity);
    }

    /** Feeders: peck, chew, look up, shuffle, peck again. */
    function feederBrain(g, dt) {
        g.timer -= dt;
        if (g.timer <= 0) {
            const r = rnd();
            if (r < 0.50) { g.mode = 'peck'; g.timer = rr(0.7, 1.9); }
            else if (r < 0.70) { g.mode = 'look'; g.timer = rr(0.5, 1.6); g.yawT = rr(-0.9, 0.9); }
            else if (r < 0.86) {
                g.mode = 'step'; g.timer = rr(0.5, 1.1);
                g.goal.set(g.home.x + rr(-0.34, 0.34), g.home.y + rr(-0.34, 0.34));
            }
            else { g.mode = 'ruffle'; g.timer = rr(0.4, 0.8); }
        }
        if (g.mode === 'peck') {
            // A gull does not peck once; it stabs, tugs, and swallows.
            g.pecking += dt * g.peckRate;
            const s = (Math.sin(g.pecking) + 1) * 0.5;
            g.neckT = lerp(0.55, 1.52, s);
            g.pitchT = lerp(-0.10, 0.86, s);
            g.crouchT = 0.22 * s;
            g.leanT = 0.18 * s;
            g.wingT = 0; g.tailUpT = 0.10 * s;
            g.gapeT = s > 0.8 ? 0.5 : 0;
            faceToward(g, g.food.x, g.food.y, dt, 1.1);
        } else if (g.mode === 'look') {
            relax(g);
            g.neckT = 0.02; g.pitchT = 0.10;      // neck straight up, head high
            g.speed = 0;
        } else if (g.mode === 'step') {
            relax(g);
            g.neckT = 0.16;
            driveTo(g, g.goal.x, g.goal.y, 0.42, dt, 2.4);
        } else {
            relax(g);
            g.ruffle = 1;
            g.wingT = 0.20;
            g.speed = 0;
        }
    }

    /** The two principals, and the shape of the fight between them. */
    function dramaStep(dt) {
        drama.t += dt;
        drama.timer -= dt;
        const dBoss = Math.hypot(RUNT.pos.x - BOSS.pos.x, RUNT.pos.y - BOSS.pos.y);
        const dRuntFood = Math.hypot(RUNT.pos.x - CHIPS.x, RUNT.pos.y - CHIPS.y);

        switch (drama.phase) {
            /* --- Everyone eating; the juvenile edges in ---------------- */
            case 'feed': {
                // If the last chase carried it away, it walks back to the food
                // before it starts eating again.
                const strayed = Math.hypot(BOSS.pos.x - BOSS_POST.x, BOSS.pos.y - BOSS_POST.y);
                if (strayed > 0.55) {
                    relax(BOSS);
                    BOSS.neckT = 0.08;
                    driveTo(BOSS, BOSS_POST.x, BOSS_POST.y, 0.72, dt, 2.6);
                } else {
                    feederBrain(BOSS, dt);
                }
                // The juvenile creeps at the food, head high, ready to be shouted at.
                RUNT.neckT = 0.04; RUNT.pitchT = 0.16; RUNT.crouchT = 0.06;
                RUNT.wingT = 0; RUNT.tailUpT = 0.05; RUNT.gapeT = 0;
                driveTo(RUNT, CHIPS.x + 0.30, CHIPS.y + 0.34, 0.50, dt, 1.6);
                // The adult goes off when the youngster is inside its own length,
                // which is a good deal sooner than when it reaches the chips.
                if (dBoss < 0.70 || dRuntFood < 0.50 || drama.timer <= 0) {
                    drama.phase = 'threat';
                    drama.timer = rr(1.9, 2.5);
                    BOSS.mode = 'threat';
                    BOSS.call = 0;
                }
                break;
            }

            /* --- The stare. This is the picture. ----------------------- */
            case 'threat': {
                const k = smooth(0.0, 0.45, 2.2 - drama.timer);      // easing into the pose
                threatPose(BOSS, k);
                faceToward(BOSS, RUNT.pos.x, RUNT.pos.y, dt, 3.0);
                BOSS.call += dt * 5.2;
                BOSS.gapeT = (Math.sin(BOSS.call) > 0.35 ? 0.85 : 0.06) * k;   // the long call
                BOSS.speed = 0;

                // The juvenile freezes, then thinks better of it.
                RUNT.neckT = -0.10; RUNT.pitchT = 0.22; RUNT.crouchT = 0.30;
                RUNT.wingT = 0.14; RUNT.tailUpT = 0.12;
                faceToward(RUNT, BOSS.pos.x, BOSS.pos.y, dt, 2.0);
                if (drama.timer <= 0) {
                    drama.phase = 'charge';
                    drama.timer = rr(1.1, 1.5);
                    shedFeather(BOSS.pos.x, 0.22, BOSS.pos.y);
                    for (const f of FEEDERS) { f.mode = 'look'; f.timer = rr(0.7, 1.4); }
                }
                break;
            }

            /* --- The run at it, and the run away ----------------------- */
            case 'charge': {
                threatPose(BOSS, 1.0);                    // the pose is held while running
                BOSS.gapeT = 0.55 + 0.35 * Math.sin(drama.t * 16);
                BOSS.wingT = 0.46;
                driveTo(BOSS, RUNT.pos.x, RUNT.pos.y, 1.95, dt, 4.5);

                // The juvenile runs, wings out, head down and forward, tail up.
                RUNT.neckT = 0.62; RUNT.pitchT = -0.42; RUNT.crouchT = 0.42;
                RUNT.leanT = 0.30; RUNT.wingT = 0.86; RUNT.flapT = 1.0; RUNT.tailUpT = 0.55;
                RUNT.gapeT = 0.45;
                driveTo(RUNT, FLEE_TO.x, FLEE_TO.y, 2.55, dt, 5.0);

                if (rnd() < dt * 22) puffAt(RUNT.pos.x, RUNT.pos.y, 0.9);
                if (rnd() < dt * 9) puffAt(BOSS.pos.x, BOSS.pos.y, 0.7);
                if (rnd() < dt * 1.3) shedFeather(RUNT.pos.x + rr(-0.1, 0.1), 0.24, RUNT.pos.y);

                const gone = Math.hypot(RUNT.pos.x - FLEE_TO.x, RUNT.pos.y - FLEE_TO.y);
                if (drama.timer <= 0 || (gone < 0.25 && dBoss > 0.8)) {
                    drama.phase = 'break';
                    drama.timer = rr(1.1, 1.5);
                }
                break;
            }

            /* --- It stops; the juvenile keeps going a bit -------------- */
            case 'break': {
                const k = smooth(0.0, 1.0, drama.timer / 1.4);
                threatPose(BOSS, k * 0.7);
                BOSS.gapeT = k * 0.4 * (Math.sin(drama.t * 9) > 0 ? 1 : 0);
                faceToward(BOSS, RUNT.pos.x, RUNT.pos.y, dt, 2.0);

                RUNT.wingT = 0.72; RUNT.flapT = 0.8; RUNT.tailUpT = 0.4;
                RUNT.neckT = 0.46; RUNT.pitchT = -0.28; RUNT.crouchT = 0.30;
                driveTo(RUNT, FLEE_TO.x + 0.45, FLEE_TO.y + 0.35, 1.5, dt, 3.4);
                if (rnd() < dt * 10) puffAt(RUNT.pos.x, RUNT.pos.y, 0.6);

                if (drama.timer <= 0) {
                    drama.phase = 'strut';
                    drama.timer = rr(3.4, 4.2);
                    BOSS.call = 0;
                }
                break;
            }

            /* --- Back to the chips, saying so the whole way ------------ */
            case 'strut': {
                relax(BOSS);
                BOSS.neckT = -0.06; BOSS.pitchT = 0.06;   // chest out, head high
                BOSS.tailUpT = 0.16;
                BOSS.call += dt;
                if (BOSS.call > 0.7 && BOSS.call < 1.9) {
                    // The long call: head thrown right back, then swung down.
                    const u = (BOSS.call - 0.7) / 1.2;
                    const swing = Math.sin(u * Math.PI);
                    BOSS.neckT = -0.30 - swing * 0.55 + Math.pow(u, 2.4) * 1.1;
                    BOSS.pitchT = 0.10 + swing * 0.75 - Math.pow(u, 2.4) * 0.9;
                    BOSS.gapeT = swing * 0.9;
                    BOSS.wingT = swing * 0.30;
                } else {
                    BOSS.gapeT = 0;
                }
                driveTo(BOSS, BOSS_POST.x, BOSS_POST.y, 0.88, dt, 2.6);

                // The juvenile watches, preens at nothing, and starts creeping back.
                RUNT.wingT = 0.06; RUNT.flapT = 0;
                RUNT.neckT = drama.timer > 1.6 ? 0.02 : 0.30;
                RUNT.pitchT = drama.timer > 1.6 ? 0.22 : 0.06;
                RUNT.crouchT = 0.10; RUNT.tailUpT = 0.05; RUNT.gapeT = 0;
                if (drama.timer > 1.8) faceToward(RUNT, BOSS.pos.x, BOSS.pos.y, dt, 1.4);
                else driveTo(RUNT, LURK.x, LURK.y, 0.40, dt, 1.8);

                if (drama.timer <= 0) {
                    drama.phase = 'feed';
                    drama.timer = rr(11, 15);      // a fallback; proximity usually fires first
                    BOSS.mode = 'peck'; BOSS.timer = rr(0.8, 1.6);
                }
                break;
            }
        }
    }

    /**
     * Nobody stands inside anybody. Five birds all steering at one wrap of chips
     * will otherwise walk straight through each other, and a gull that can be
     * walked through stops being a gull.
     */
    function separate() {
        for (let i = 0; i < GULLS.length; i++) {
            for (let j = i + 1; j < GULLS.length; j++) {
                const a = GULLS[i], b = GULLS[j];
                const dx = b.pos.x - a.pos.x, dz = b.pos.y - a.pos.y;
                const d = Math.hypot(dx, dz);
                if (d > 0.32 || d < 1e-4) continue;
                const push = (0.32 - d) * 0.5;
                a.pos.x -= (dx / d) * push; a.pos.y -= (dz / d) * push;
                b.pos.x += (dx / d) * push; b.pos.y += (dz / d) * push;
            }
        }
    }

    /* ==========================================================
       12 · What moves
       ========================================================== */

    const _camScratch = new THREE.Vector3();

    /** Push posture toward its target and write it into the rig. */
    function poseGull(g, dt, t) {
        const ease = (cur, tgt, rate) => cur + (tgt - cur) * Math.min(1, dt * rate);

        g.neck = ease(g.neck, g.neckT, 9);
        g.pitch = ease(g.pitch, g.pitchT, 9);
        g.yaw = ease(g.yaw, g.yawT, 6);
        g.crouch = ease(g.crouch, g.crouchT, 8);
        g.lean = ease(g.lean, g.leanT, 8);
        g.wing = ease(g.wing, g.wingT, 11);
        g.flap = ease(g.flap, g.flapT, 8);
        g.tailUp = ease(g.tailUp, g.tailUpT, 8);
        g.gape = ease(g.gape, g.gapeT, 22);

        const rig = g.rig;
        const s = rig.scale;

        // Gait: the step cycle is driven by ground covered, so nothing skates.
        const stride = 0.16 * s;
        g.stepPhase += (g.speed * dt / stride) * TAU + dt * 0.35;
        const gaitAmp = smooth(0.02, 0.75, g.speed);
        g.gait = gaitAmp;

        const sw = Math.sin(g.stepPhase);
        for (const leg of rig.legs) {
            const ph = leg.side < 0 ? g.stepPhase : g.stepPhase + Math.PI;
            const swing = Math.sin(ph);
            const lift = Math.max(0, swing) * 0.022 * gaitAmp;
            leg.hip.rotation.x = swing * 0.62 * gaitAmp - g.lean * 0.30 - g.crouch * 0.18;
            leg.hip.rotation.z = leg.side * (0.04 + g.crouch * 0.10);
            leg.foot.position.y = -0.0530 + lift;
            leg.foot.rotation.x = -leg.hip.rotation.x - 0.06 + Math.max(0, -swing) * 0.20 * gaitAmp;
        }

        // Carriage: crouch, forward pitch, the roll of a walking bird, and a bob.
        // It pivots down at the feet, so leaning into a threat tips the whole
        // bird forward over its legs, which is what the bird actually does.
        const bob = Math.cos(g.stepPhase * 2) * 0.010 * gaitAmp;
        rig.carriage.position.y = -g.crouch * 0.045 + bob;
        rig.carriage.rotation.x = g.lean;
        rig.carriage.rotation.z = -sw * 0.055 * gaitAmp;
        rig.carriage.position.z = g.lean * 0.012;

        // Head. The neck folds forward; the skull turns back against it. That
        // counter-rotation is the entire trick of a bird looking up from low down.
        const headBob = Math.sin(g.stepPhase + 1.0) * 0.075 * gaitAmp;
        rig.headPivot.rotation.x = g.neck + headBob;
        rig.headPivot.rotation.y = g.yaw * 0.35;
        rig.headPivot.rotation.z = Math.sin(t * 0.7 + g.wobble) * 0.02;
        rig.head.rotation.x = g.pitch - headBob * 0.6;
        rig.head.rotation.y = g.yaw * 0.65 + Math.sin(t * 1.1 + g.wobble) * 0.03;
        rig.head.rotation.z = g.yaw * 0.10;

        rig.billLower.rotation.x = g.gape * 0.42;
        rig.billLower.position.z = 0.0010 - g.gape * 0.0030;

        // Blink.
        g.blinkTimer -= dt;
        if (g.blinkTimer <= 0) { g.blink = 1; g.blinkTimer = rr(1.4, 6.5); }
        if (g.blink > 0) g.blink = Math.max(0, g.blink - dt * 7.5);
        // Parked, the lid hoods the top of the eye; shut, it swings forward over it.
        const shut = Math.sin(g.blink * Math.PI);
        rig.lid.rotation.x = -0.35 + shut * 1.88;

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

        // Feet on the ground, and the bird where the sim says it is.
        g.motion.position.set(g.pos.x - g.home.x, 0, g.pos.y - g.home.y);
        g.motion.rotation.y = g.heading;

        // A running bird kicks up grit.
        if (g.speed > 1.2 && rnd() < dt * 14) puffAt(g.pos.x, g.pos.y, 0.55);
    }

    let swashT = 0;

    world.frame((dt, t) => {
        uTime.value = t;

        // The swash: a slow run up the sand and a slower drain back off it.
        swashT += dt;
        const sPhase = (swashT / 9.5) % 1;
        const run = sPhase < 0.30 ? Math.pow(sPhase / 0.30, 0.55) : Math.pow(1 - (sPhase - 0.30) / 0.70, 1.5);
        uSwash.value = lerp(-1.2, 9.0, run) + Math.sin(swashT * 0.63) * 0.6;

        camera.getWorldPosition(_camScratch);
        seaUniforms.uCamPos.value.copy(_camScratch);

        // Clouds, drifting off the sea.
        for (let i = 0; i < clouds.length; i++) {
            const sp = clouds[i];
            sp.position.x += sp.userData.drift * dt;
            if (sp.position.x > 1700) sp.position.x = -1700;
        }

        // The argument, then the three who are ignoring it.
        dramaStep(dt);
        for (const f of FEEDERS) feederBrain(f, dt);
        separate();
        for (const g of GULLS) poseGull(g, dt, t);

        // Gulls overhead, circling the smell of it.
        for (const f of FLYERS) {
            f.a += f.spd * dt;
            const x = f.cx + Math.cos(f.a) * f.r;
            const z = f.cz + Math.sin(f.a) * f.r * 0.8;
            f.grp.position.set(x, f.y + Math.sin(f.a * 2.3) * 0.6, z);
            // Fly along the tangent of the circle, banked into the turn.
            f.grp.rotation.y = Math.atan2(
                -Math.sin(f.a) * f.r * f.spd, Math.cos(f.a) * f.r * 0.8 * f.spd);
            const bank = clamp(f.spd * 5.5, -0.6, 0.6);
            f.grp.rotation.z = bank;
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
            d.sp.position.set(d.x, Math.max(0.008, d.y), d.z);
            const sz = d.size * (0.5 + u * 1.9);
            d.sp.scale.set(sz, sz, 1);
            d.sp.material.opacity = 0.42 * (1 - u) * (1 - u);
        }

        // A feather or two, taking its time about landing.
        for (const f of LOOSE) {
            if (f.life > 6) { if (f.mesh.visible) f.mesh.visible = false; continue; }
            f.life += dt;
            f.phase += dt * 2.2;
            f.vy = Math.max(-0.10, f.vy - 0.16 * dt);
            f.y += f.vy * dt;
            if (f.y < 0.006) { f.y = 0.006; f.vy = 0; }
            f.x += Math.sin(f.phase) * 0.16 * dt;
            f.z += Math.cos(f.phase * 0.8) * 0.14 * dt;
            f.mesh.position.set(f.x, f.y, f.z);
            f.mesh.rotation.set(
                f.y > 0.01 ? Math.sin(f.phase) * 0.7 : -Math.PI / 2 + 0.06,
                f.phase * f.spin * 0.5,
                Math.cos(f.phase * 1.3) * 0.6
            );
        }
    });
}
