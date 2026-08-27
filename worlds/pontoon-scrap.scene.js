//
//  pontoon-scrap.scene.js
//  Project27 worlds
//
//  A ferry pontoon at the bottom of a jetty, half past two on a hot day, and
//  somebody has put a parcel of chips down on the timber and walked off up the
//  gangway. Three silver gulls have their heads in it and have not looked up
//  since.
//
//  A fourth is not eating. It has run its neck straight up out of its shoulders
//  — a white column, twice the neck it was standing on a second ago — and
//  folded the skull right over the top of it, bill swung down the front of the
//  column and open, and it is yelling: the long call, five notes, the head
//  pumping down on each one. It is doing this while running, which is what
//  makes it funny, and what it is running down is a first-year with brown still
//  across the wing, who has decided the way out of this is *around*, and is
//  going round and round the pontoon with its wings half up and its tail cocked,
//  passing the same three feeding birds every four seconds.
//
//  Underneath all of them the pontoon is moving. It is a floating thing on a
//  running tide: it lifts, it tips, it grinds against the guide piles, and the
//  whole argument rides on it — the birds, the chips, the paper, the tinnie tied
//  off at the end. The water and the deck agree because they are the same four
//  waves, once in the vertex shader and once in JavaScript.
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
    const TAU = Math.PI * 2;
    const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
    const lerp = (a, b, t) => a + (b - a) * t;
    const smooth = (e0, e1, x) => { const t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };
    const srgb = (hex) => new THREE.Color(hex).convertSRGBToLinear();
    /** Exponential ease that behaves the same at any frame rate. */
    const ease = (cur, target, rate, dt) => cur + (target - cur) * (1 - Math.exp(-rate * dt));
    const wrapPi = (a) => { while (a > Math.PI) a -= TAU; while (a < -Math.PI) a += TAU; return a; };

    // Deterministic: the same six birds having the same argument every time.
    let _seed = 20260827;
    const rnd = () => { _seed = (_seed * 1664525 + 1013904223) % 4294967296; return _seed / 4294967296; };
    const rr = (a, b) => a + (b - a) * rnd();
    const pick = (arr) => arr[Math.min(arr.length - 1, (rnd() * arr.length) | 0)];

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
     * a trivial index rather than tearing every box apart to match it, and drop
     * any stray attribute the merge would choke on.
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
     * A closed tube swept along a polyline with a per-station radius, cross
     * sections parallel-transported so nothing spins along the sweep. Necks,
     * tarsi, toes, handrails and mooring lines are all one of these — a gull is
     * mostly tapered tubes with a skull on the end, and so is a jetty.
     */
    function sweep(points, radiusOf, radialSegs = 12, cap = true) {
        const N = points.length;
        const pos = [], nor = [], uvs = [], idx = [], tangents = [];
        for (let i = 0; i < N; i++) {
            const a = points[Math.max(0, i - 1)], b = points[Math.min(N - 1, i + 1)];
            const t = new THREE.Vector3().subVectors(b, a);
            if (t.lengthSq() < 1e-12) t.set(0, 1, 0);
            tangents.push(t.normalize());
        }
        const ref = Math.abs(tangents[0].y) > 0.9 ? V3(1, 0, 0) : V3(0, 1, 0);
        let nrm = new THREE.Vector3().crossVectors(tangents[0], ref).normalize();
        for (let i = 0; i < N; i++) {
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
        for (let i = 0; i < N - 1; i++)
            for (let j = 0; j < radialSegs; j++) {
                const a = i * (radialSegs + 1) + j, b = a + radialSegs + 1;
                idx.push(a, b, a + 1, b, b + 1, a + 1);
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

    /** A rounded box, because nothing built by people has a sharp arris left. */
    function roundedBox(w, h, d, r, seg = 2) {
        const g = new THREE.BoxGeometry(w, h, d, seg + 1, seg + 1, seg + 1);
        const p = g.attributes.position;
        const hx = w / 2 - r, hy = h / 2 - r, hz = d / 2 - r;
        for (let i = 0; i < p.count; i++) {
            const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
            const cx = clamp(x, -hx, hx), cy = clamp(y, -hy, hy), cz = clamp(z, -hz, hz);
            const dx = x - cx, dy = y - cy, dz = z - cz;
            const l = Math.hypot(dx, dy, dz) || 1;
            p.setXYZ(i, cx + dx / l * r, cy + dy / l * r, cz + dz / l * r);
        }
        g.computeVertexNormals();
        return g;
    }

    /* ==========================================================
       1 · The dimensions of the pontoon, since everything refers to them
       ========================================================== */

    const DECK_Y = 0.44;            // top of the timber, at rest, above still water
    const HX = 3.60, HZ = 1.75;     // half-extents of the deck: 7.2 m by 3.5 m
    const FLOAT_TOP = 0.20;
    const FLOAT_BOT = -0.42;
    const PILE_X = 2.42, PILE_Z = 2.06;    // the two guide piles, on the seaward side
    const PILE_R = 0.165;
    const PILE_TOP = 2.62;
    const JETTY_Y = 1.94;           // the fixed jetty, four hours of tide above us
    const JETTY_X0 = -8.10;         // where its seaward end is
    const JETTY_HZ = 1.30;

    // Where the chips went down, and the ring the runner has worn into the
    // afternoon: an oval, because a pontoon is a long thin thing to run round.
    const CHIPS = V2(-1.52, -0.26);
    const CC = V2(0.86, 0.02);
    const RUN_RX = 1.94, RUN_RZ = 1.10;

    world.groundLevel(DECK_Y);
    camera.position.set(3.28, DECK_Y + 0.92, 1.42);

    /* ==========================================================
       2 · The light of the hour
       ========================================================== */

    // Two in the afternoon, sun well round to the west and still high: hard
    // short shadows, a glitter path running out past the end of the pontoon,
    // and every white bird rimmed along the back.
    const SUN_DIR = V3(-0.55, 0.66, 0.51).normalize();
    const C_SUN = srgb(0xfff2d6);
    const C_ZEN = srgb(0x1d5cc4);
    const C_MID = srgb(0x69a4e2);
    const C_HOR = srgb(0xd6e4ec);
    const C_DEEP = srgb(0x073246);
    const C_SHAL = srgb(0x1a7f96);
    const C_FOAM = srgb(0xf6fbfd);

    const FOG_COL = C_HOR.clone();
    const FOG_DENSITY = 0.0032;
    scene.fog = new THREE.FogExp2(FOG_COL.clone(), FOG_DENSITY);

    const sun = new THREE.DirectionalLight(0xfff0cf, 3.10);
    sun.position.copy(SUN_DIR).multiplyScalar(48);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    {
        const c = sun.shadow.camera;
        c.left = -8.5; c.right = 8.5; c.top = 8.5; c.bottom = -8.5;
        c.near = 28; c.far = 78;
        sun.shadow.bias = -0.00040;
        sun.shadow.normalBias = 0.016;
    }
    scene.add(sun, sun.target);

    // One cool fill out of the open sky opposite, so the shaded half of a white
    // bird reads blue-grey rather than black, and the water bounces back up
    // through the hemisphere's ground colour.
    const fill = new THREE.DirectionalLight(0x9dc4ff, 0.70);
    fill.position.set(6, 7, -8);
    scene.add(fill);

    scene.add(new THREE.HemisphereLight(0xbcdcff, 0x4e7f92, 1.20));
    scene.add(new THREE.AmbientLight(0xffefdc, 0.16));

    world.bloom({ strength: 0.30, radius: 0.62, threshold: 0.90 });

    const uTime = { value: 0 };
    const uCamPos = { value: new THREE.Vector3() };

    /* ==========================================================
       3 · Painted textures
       ========================================================== */

    /* --- Pontoon decking: hardwood, salt-bleached, screwed down ---- */
    const deckTex = world.canvasTexture(1024, 512, (g, cv) => {
        const W = cv.width, H = cv.height;
        // The sheet runs the length of the pontoon; boards lie across it, so
        // one board is a horizontal band here and 90 mm on the deck.
        g.fillStyle = '#a89a86';
        g.fillRect(0, 0, W, H);
        const BOARDS = 24, bh = H / BOARDS;   // 3.5 m of deck: 145 mm boards
        for (let b = 0; b < BOARDS; b++) {
            const y = b * bh;
            const v = hash2(b * 3.1, 7.7);
            const base = [176 + v * 32, 162 + v * 30, 140 + v * 26];
            g.fillStyle = `rgb(${base[0] | 0},${base[1] | 0},${base[2] | 0})`;
            g.fillRect(0, y, W, bh - 2);
            // Grain, running along the board.
            for (let i = 0; i < 90; i++) {
                const yy = y + 2 + Math.random() * (bh - 6);
                g.strokeStyle = Math.random() < 0.5
                    ? `rgba(120,102,80,${0.05 + Math.random() * 0.16})`
                    : `rgba(226,216,196,${0.05 + Math.random() * 0.18})`;
                g.lineWidth = 0.8 + Math.random() * 1.8;
                g.beginPath();
                g.moveTo(-10, yy);
                for (let x = 0; x <= W; x += 64) g.lineTo(x, yy + Math.sin(x * 0.011 + i) * 1.6);
                g.stroke();
            }
            // Checking: hardwood in the sun splits along the grain.
            for (let i = 0; i < 7; i++) {
                const x0 = Math.random() * W, l = 30 + Math.random() * 220;
                g.strokeStyle = `rgba(72,58,44,${0.20 + Math.random() * 0.30})`;
                g.lineWidth = 1 + Math.random() * 2.2;
                g.beginPath();
                g.moveTo(x0, y + 3 + Math.random() * (bh - 8));
                g.lineTo(x0 + l, y + 3 + Math.random() * (bh - 8));
                g.stroke();
            }
            // The gap between boards, where the water goes through.
            g.fillStyle = 'rgba(28,26,24,0.72)';
            g.fillRect(0, y + bh - 2.6, W, 2.6);
            // Two decking screws per board per bearer, cupped and rust-stained.
            for (let k = 0; k < 6; k++) {
                const x = (k + 0.5) * (W / 6) + (b % 2 ? 10 : -10);
                for (const dx of [-16, 16]) {
                    g.fillStyle = 'rgba(58,50,42,0.55)';
                    g.beginPath(); g.arc(x + dx, y + bh * 0.5, 3.4, 0, TAU); g.fill();
                    g.fillStyle = 'rgba(196,188,176,0.35)';
                    g.beginPath(); g.arc(x + dx - 0.8, y + bh * 0.5 - 0.9, 1.8, 0, TAU); g.fill();
                    const rg = g.createRadialGradient(x + dx, y + bh * 0.5, 2, x + dx, y + bh * 0.5, 13);
                    rg.addColorStop(0, 'rgba(126,72,34,0.30)');
                    rg.addColorStop(1, 'rgba(126,72,34,0)');
                    g.fillStyle = rg;
                    g.beginPath(); g.arc(x + dx, y + bh * 0.5, 13, 0, TAU); g.fill();
                }
            }
        }
        // Wet: the last wave over the low corner has not dried off yet.
        for (let i = 0; i < 26; i++) {
            const x = Math.random() * W, y = Math.random() * H, r = 30 + Math.random() * 150;
            const rg = g.createRadialGradient(x, y, 0, x, y, r);
            rg.addColorStop(0, `rgba(64,58,50,${0.10 + Math.random() * 0.20})`);
            rg.addColorStop(1, 'rgba(64,58,50,0)');
            g.fillStyle = rg;
            g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
        }
        // Non-slip strip along the boarding edge, gone chalky.
        g.fillStyle = 'rgba(222,196,64,0.55)';
        g.fillRect(0, H - 26, W, 20);
        g.globalAlpha = 0.5;
        for (let i = 0; i < 900; i++) {
            g.fillStyle = Math.random() < 0.5 ? 'rgba(120,104,44,0.5)' : 'rgba(255,244,190,0.6)';
            g.fillRect(Math.random() * W, H - 26 + Math.random() * 20, 2, 2);
        }
        g.globalAlpha = 1;
        // Gull splats. There is no pontoon without them.
        for (let i = 0; i < 40; i++) {
            const x = Math.random() * W, y = Math.random() * H, r = 5 + Math.random() * 15;
            g.fillStyle = `rgba(246,244,236,${0.45 + Math.random() * 0.4})`;
            g.beginPath();
            for (let k = 0; k <= 14; k++) {
                const a = (k / 14) * TAU;
                const rad = r * (0.55 + 0.7 * hash2(i * 5 + k, i));
                const px = x + Math.cos(a) * rad, py = y + Math.sin(a) * rad * 0.8;
                k ? g.lineTo(px, py) : g.moveTo(px, py);
            }
            g.closePath(); g.fill();
        }
        // Old grease where the last parcel of chips sat, and the one before it.
        for (let i = 0; i < 14; i++) {
            const x = Math.random() * W, y = Math.random() * H, r = 16 + Math.random() * 60;
            const rg = g.createRadialGradient(x, y, 0, x, y, r);
            rg.addColorStop(0, 'rgba(96,74,44,0.22)');
            rg.addColorStop(1, 'rgba(96,74,44,0)');
            g.fillStyle = rg;
            g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
        }
    });

    /* --- Aluminium: mill finish, chalked, salted ------------------- */
    const alumTex = world.canvasTexture(512, 512, (g, cv) => {
        const S = cv.width;
        g.fillStyle = '#b6bcc0';
        g.fillRect(0, 0, S, S);
        for (let i = 0; i < 2400; i++) {
            g.strokeStyle = Math.random() < 0.5
                ? `rgba(230,236,240,${0.04 + Math.random() * 0.14})`
                : `rgba(118,126,132,${0.04 + Math.random() * 0.14})`;
            g.lineWidth = 0.8 + Math.random() * 1.6;
            const y = Math.random() * S;
            g.beginPath(); g.moveTo(0, y); g.lineTo(S, y + (Math.random() - 0.5) * 6); g.stroke();
        }
        for (let i = 0; i < 120; i++) {
            const x = Math.random() * S, y = Math.random() * S, r = 6 + Math.random() * 44;
            const rg = g.createRadialGradient(x, y, 0, x, y, r);
            rg.addColorStop(0, `rgba(244,246,248,${0.05 + Math.random() * 0.12})`);
            rg.addColorStop(1, 'rgba(244,246,248,0)');
            g.fillStyle = rg;
            g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
        }
        // Salt bloom and the white powder aluminium goes to by the sea.
        for (let i = 0; i < 260; i++) {
            const x = Math.random() * S, y = Math.random() * S;
            g.fillStyle = `rgba(238,242,244,${0.06 + Math.random() * 0.18})`;
            g.beginPath(); g.arc(x, y, 2 + Math.random() * 9, 0, TAU); g.fill();
        }
        for (let i = 0; i < 60; i++) {
            const x = Math.random() * S, y = Math.random() * S, h = 10 + Math.random() * 70;
            const lg = g.createLinearGradient(x, y, x, y + h);
            lg.addColorStop(0, `rgba(122,86,56,${0.06 + Math.random() * 0.14})`);
            lg.addColorStop(1, 'rgba(122,86,56,0)');
            g.fillStyle = lg;
            g.fillRect(x, y, 2 + Math.random() * 5, h);
        }
    });
    alumTex.wrapS = alumTex.wrapT = THREE.RepeatWrapping;

    /* --- Checker plate, for the gangway --------------------------- */
    const treadTex = world.canvasTexture(256, 256, (g, cv) => {
        const S = cv.width;
        g.fillStyle = '#a9b0b4';
        g.fillRect(0, 0, S, S);
        for (let i = 0; i < 1200; i++) {
            g.fillStyle = Math.random() < 0.5 ? 'rgba(226,232,236,0.10)' : 'rgba(120,128,132,0.10)';
            g.fillRect(Math.random() * S, Math.random() * S, 3 + Math.random() * 12, 1.5);
        }
        // Two lentils per cell, crossed — the pattern on every jetty in the country.
        const cell = S / 8;
        for (let i = 0; i < 8; i++)
            for (let j = 0; j < 8; j++) {
                const cx = (i + 0.5) * cell, cy = (j + 0.5) * cell;
                for (const [a, off] of [[0.6, -cell * 0.16], [-0.6, cell * 0.16]]) {
                    g.save();
                    g.translate(cx, cy + off);
                    g.rotate(a);
                    const lg = g.createLinearGradient(0, -4, 0, 4);
                    lg.addColorStop(0, 'rgba(240,246,250,0.75)');
                    lg.addColorStop(0.5, 'rgba(178,186,190,0.5)');
                    lg.addColorStop(1, 'rgba(92,100,106,0.6)');
                    g.fillStyle = lg;
                    g.beginPath();
                    g.ellipse(0, 0, cell * 0.30, 3.4, 0, 0, TAU);
                    g.fill();
                    g.restore();
                }
            }
    });
    treadTex.wrapS = treadTex.wrapT = THREE.RepeatWrapping;

    /* --- Pile timber: turpentine, tarred, growing things ----------- */
    const pileTex = world.canvasTexture(512, 1024, (g, cv) => {
        const W = cv.width, H = cv.height;
        // The canvas runs top of pile (v=0 here, the top row) to well below the
        // water. Both the guide piles and the jetty's stand with the waterline
        // between a quarter and two-fifths of the way down, so everything that
        // grows lives in the band from 0.28 to 0.52 and the dry timber is above.
        const lg = g.createLinearGradient(0, 0, 0, H);
        lg.addColorStop(0.00, '#8d7f6c');
        lg.addColorStop(0.20, '#6f6250');
        lg.addColorStop(0.30, '#4a4034');
        lg.addColorStop(0.44, '#2c261e');
        lg.addColorStop(1.00, '#1b2a26');
        g.fillStyle = lg;
        g.fillRect(0, 0, W, H);
        for (let i = 0; i < 900; i++) {
            const x = Math.random() * W, y = Math.random() * H, l = 20 + Math.random() * 220;
            g.strokeStyle = Math.random() < 0.5
                ? `rgba(28,22,16,${0.06 + Math.random() * 0.22})`
                : `rgba(196,182,158,${0.04 + Math.random() * 0.14})`;
            g.lineWidth = 0.8 + Math.random() * 2.6;
            g.beginPath();
            g.moveTo(x, y);
            g.lineTo(x + (Math.random() - 0.5) * 8, y + l);
            g.stroke();
        }
        // The tide band: oysters and barnacles from mid-tide down, then weed.
        for (let i = 0; i < 2600; i++) {
            const v = 0.28 + Math.pow(Math.random(), 0.7) * 0.26;
            const x = Math.random() * W, y = v * H;
            const r = 2 + Math.random() * 7;
            const white = Math.random() < 0.62;
            g.fillStyle = white
                ? `rgba(${216 + Math.random() * 34 | 0},${208 + Math.random() * 30 | 0},${190 + Math.random() * 30 | 0},${0.35 + Math.random() * 0.5})`
                : `rgba(${70 + Math.random() * 40 | 0},${62 + Math.random() * 34 | 0},${48 + Math.random() * 30 | 0},${0.4 + Math.random() * 0.4})`;
            g.beginPath(); g.ellipse(x, y, r, r * (0.5 + Math.random() * 0.5), Math.random() * TAU, 0, TAU); g.fill();
        }
        // Green weed just under the waterline, where the sun still reaches it.
        for (let i = 0; i < 700; i++) {
            const v = 0.40 + Math.random() * 0.34;
            g.fillStyle = `rgba(${44 + Math.random() * 40 | 0},${76 + Math.random() * 50 | 0},${40 + Math.random() * 30 | 0},${0.15 + Math.random() * 0.35})`;
            g.beginPath();
            g.ellipse(Math.random() * W, v * H, 4 + Math.random() * 26, 8 + Math.random() * 40, 0, 0, TAU);
            g.fill();
        }
        // Rope wear and the paint band the council put round the top.
        g.fillStyle = 'rgba(226,196,72,0.55)';
        g.fillRect(0, H * 0.055, W, H * 0.030);
        g.fillStyle = 'rgba(30,30,32,0.35)';
        g.fillRect(0, H * 0.088, W, H * 0.010);
        for (let i = 0; i < 300; i++) {
            g.fillStyle = `rgba(248,246,238,${0.10 + Math.random() * 0.35})`;
            g.beginPath();
            g.arc(Math.random() * W, Math.random() * H * 0.30, 1 + Math.random() * 5, 0, TAU);
            g.fill();
        }
    });

    /* --- Butcher's paper the chips came wrapped in ----------------- */
    const paperTex = world.canvasTexture(512, 512, (g, cv) => {
        const S = cv.width;
        g.fillStyle = '#f4ecda';
        g.fillRect(0, 0, S, S);
        for (let i = 0; i < 9000; i++) {
            g.fillStyle = Math.random() < 0.5 ? 'rgba(208,196,170,0.28)' : 'rgba(255,253,246,0.4)';
            g.fillRect(Math.random() * S, Math.random() * S, 1 + Math.random() * 3, 1);
        }
        // Grease, coming through from the inside.
        for (let i = 0; i < 34; i++) {
            const x = Math.random() * S, y = Math.random() * S, r = 20 + Math.random() * 110;
            const grad = g.createRadialGradient(x, y, 0, x, y, r);
            grad.addColorStop(0, `rgba(196,154,88,${0.26 + Math.random() * 0.28})`);
            grad.addColorStop(0.6, 'rgba(204,170,104,0.14)');
            grad.addColorStop(1, 'rgba(208,178,118,0)');
            g.fillStyle = grad;
            g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
        }
        g.strokeStyle = 'rgba(42,88,142,0.5)';
        g.lineWidth = 9;
        g.beginPath(); g.moveTo(0, 70); g.lineTo(S, 70); g.stroke();
        g.beginPath(); g.moveTo(0, S - 70); g.lineTo(S, S - 70); g.stroke();
        g.fillStyle = 'rgba(58,54,50,0.36)';
        g.font = 'bold 30px Georgia, serif';
        g.fillText('WHARF ST FISH SUPPLY', 44, 132);
        g.font = '18px Georgia, serif';
        g.fillStyle = 'rgba(58,54,50,0.20)';
        for (let i = 0; i < 6; i++)
            g.fillText('minimum chips · potato scallop · flake · dim sim', 44, 176 + i * 27);
        g.strokeStyle = 'rgba(146,134,110,0.4)';
        g.lineWidth = 2;
        for (let i = 0; i < 18; i++) {
            const x0 = Math.random() * S, y0 = Math.random() * S;
            g.beginPath();
            g.moveTo(x0, y0);
            g.lineTo(x0 + (Math.random() - 0.5) * 320, y0 + (Math.random() - 0.5) * 320);
            g.stroke();
        }
    });

    /* --- A chip: hot forty minutes ago ----------------------------- */
    const chipTex = world.canvasTexture(256, 256, (g, cv) => {
        const S = cv.width;
        const grad = g.createLinearGradient(0, 0, 0, S);
        grad.addColorStop(0, '#c5822c');
        grad.addColorStop(0.18, '#e7b358');
        grad.addColorStop(0.5, '#f2cb79');
        grad.addColorStop(0.82, '#e4ab4e');
        grad.addColorStop(1, '#b57126');
        g.fillStyle = grad;
        g.fillRect(0, 0, S, S);
        for (let i = 0; i < 2600; i++) {
            g.fillStyle = Math.random() < 0.5
                ? `rgba(148,90,24,${0.05 + Math.random() * 0.28})`
                : `rgba(255,238,190,${0.05 + Math.random() * 0.3})`;
            g.beginPath(); g.arc(Math.random() * S, Math.random() * S, 0.7 + Math.random() * 3.2, 0, TAU); g.fill();
        }
        for (let i = 0; i < 70; i++) {
            const x = Math.random() * S, y = Math.random() * S, r = 3 + Math.random() * 11;
            const rg = g.createRadialGradient(x, y, 0, x, y, r);
            rg.addColorStop(0, 'rgba(120,64,14,0.32)');
            rg.addColorStop(1, 'rgba(120,64,14,0)');
            g.fillStyle = rg;
            g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
        }
        g.fillStyle = 'rgba(255,255,255,0.75)';       // salt
        for (let i = 0; i < 300; i++) g.fillRect(Math.random() * S, Math.random() * S, 1.5, 1.5);
    });

    /* --- Gull plumage ---------------------------------------------
       uv.v runs shoulder (0) → wingtip (1) on the folded wing, and base → tip
       on a single feather, so one painter serves both.                      */
    function wingCanvas(juvenile) {
        return world.canvasTexture(256, 512, (g, cv) => {
            const W = cv.width, H = cv.height;
            const grad = g.createLinearGradient(0, 0, 0, H);
            grad.addColorStop(0.00, '#fcfdfe');
            grad.addColorStop(0.16, '#e4eaf0');
            grad.addColorStop(0.34, '#bdc8d2');
            grad.addColorStop(0.62, '#a9b5c1');
            grad.addColorStop(0.74, '#8c98a5');
            grad.addColorStop(0.80, '#2b2e34');
            grad.addColorStop(1.00, '#131518');
            g.fillStyle = grad;
            g.fillRect(0, 0, W, H);
            // Rows of coverts, each row a little bigger than the last.
            for (let row = 0; row < 15; row++) {
                const v = 0.06 + row * 0.049;
                if (v > 0.78) break;
                const y = v * H, n = 5 + (row % 3);
                for (let i = 0; i < n; i++) {
                    const x = (i + 0.5) * (W / n) + Math.sin(row * 2.1 + i) * 5;
                    const rw = W / n * 0.62, rh = 15 + row * 0.7;
                    g.fillStyle = `rgba(255,255,255,${0.13 + 0.06 * hash2(row, i)})`;
                    g.beginPath(); g.ellipse(x, y, rw, rh, 0, 0, TAU); g.fill();
                    g.fillStyle = 'rgba(94,106,118,0.16)';
                    g.beginPath(); g.ellipse(x, y + rh * 0.72, rw * 0.95, rh * 0.36, 0, 0, TAU); g.fill();
                }
            }
            if (juvenile) {
                // First-year silver gull: brown chevrons across the coverts.
                for (let i = 0; i < 210; i++) {
                    const v = 0.08 + Math.random() * 0.66;
                    const x = Math.random() * W, y = v * H, s = 6 + Math.random() * 15;
                    g.strokeStyle = `rgba(${116 + Math.random() * 36 | 0},${86 + Math.random() * 28 | 0},${46 + Math.random() * 24 | 0},${0.30 + Math.random() * 0.4})`;
                    g.lineWidth = 3 + Math.random() * 4;
                    g.beginPath();
                    g.moveTo(x - s, y + s * 0.55);
                    g.lineTo(x, y - s * 0.4);
                    g.lineTo(x + s, y + s * 0.55);
                    g.stroke();
                }
                g.fillStyle = 'rgba(94,72,42,0.42)';
                g.fillRect(0, H * 0.78, W, H * 0.22);
            }
            g.strokeStyle = 'rgba(58,62,68,0.20)';
            g.lineWidth = 1.4;
            for (let i = 0; i < 9; i++) {
                const x = (i + 0.5) * (W / 9);
                g.beginPath(); g.moveTo(x, H * 0.10); g.lineTo(x + (W / 2 - x) * 0.22, H); g.stroke();
            }
            g.fillStyle = 'rgba(255,255,255,0.85)';
            g.fillRect(0, 0, 9, H * 0.86);
            // The white mirrors in the black wingtip.
            for (let i = 0; i < 3; i++) {
                g.fillStyle = juvenile ? 'rgba(236,234,226,0.5)' : 'rgba(255,255,255,0.94)';
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
            grad.addColorStop(0.00, '#d0d8df');
            grad.addColorStop(0.22, '#aab5c0');
            grad.addColorStop(0.40, juvenile ? '#6b5b41' : '#3a3e45');
            grad.addColorStop(0.72, juvenile ? '#493c2a' : '#17191d');
            grad.addColorStop(1.00, juvenile ? '#42361e' : '#0d0f12');
            g.fillStyle = grad;
            g.fillRect(0, 0, W, H);
            g.fillStyle = juvenile ? 'rgba(224,218,202,0.40)' : 'rgba(255,255,255,0.92)';
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
            grad.addColorStop(0, 'rgba(194,200,208,0.5)');
            grad.addColorStop(0.4, 'rgba(255,255,255,0)');
            g.fillStyle = grad;
            g.fillRect(0, 0, W, H);
            if (juvenile) {
                const b = g.createLinearGradient(0, H * 0.68, 0, H);
                b.addColorStop(0, 'rgba(118,100,70,0)');
                b.addColorStop(0.45, 'rgba(102,84,56,0.72)');
                b.addColorStop(0.86, 'rgba(118,100,72,0.55)');
                b.addColorStop(1, 'rgba(240,236,224,0.6)');
                g.fillStyle = b;
                g.fillRect(0, H * 0.68, W, H * 0.32);
            }
            g.strokeStyle = 'rgba(148,154,162,0.28)';
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
            const y = (row + 0.5) * (S / 26), n = 20;
            for (let i = 0; i < n; i++) {
                const x = (i + (row % 2) * 0.5) * (S / n);
                const rw = S / n * 0.62, rh = S / 26 * 0.78;
                g.fillStyle = `rgba(204,212,220,${0.10 + 0.07 * hash2(row, i)})`;
                g.beginPath(); g.ellipse(x, y + rh * 0.5, rw, rh * 0.55, 0, 0, TAU); g.fill();
                g.fillStyle = 'rgba(255,255,255,0.5)';
                g.beginPath(); g.ellipse(x, y - rh * 0.1, rw * 0.8, rh * 0.42, 0, 0, TAU); g.fill();
            }
        }
        g.fillStyle = 'rgba(196,206,216,0.10)';
        for (let i = 0; i < 500; i++)
            g.fillRect(Math.random() * S, Math.random() * S, 1 + Math.random() * 6, 1);
    });
    bodyTex.wrapS = bodyTex.wrapT = THREE.RepeatWrapping;

    /* --- Soft round blob, for spray -------------------------------- */
    const puffTex = world.canvasTexture(128, 128, (g, cv) => {
        const S = cv.width;
        const grad = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
        grad.addColorStop(0, 'rgba(255,255,255,0.95)');
        grad.addColorStop(0.42, 'rgba(250,253,255,0.42)');
        grad.addColorStop(1, 'rgba(246,252,255,0)');
        g.fillStyle = grad;
        g.fillRect(0, 0, S, S);
    });

    /* --- Fair-weather cumulus, drawn once and reused --------------- */
    const cloudTex = world.canvasTexture(512, 512, (g, cv) => {
        const S = cv.width, base = S * 0.70;
        const puff = (x, y, r, a) => {
            const rad = g.createRadialGradient(x, y - r * 0.22, r * 0.12, x, y, r);
            rad.addColorStop(0, `rgba(255,255,255,${a})`);
            rad.addColorStop(0.55, `rgba(253,253,252,${a * 0.86})`);
            rad.addColorStop(0.84, `rgba(246,248,252,${a * 0.28})`);
            rad.addColorStop(1, 'rgba(244,247,252,0)');
            g.fillStyle = rad;
            g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
        };
        for (let i = 0; i < 8; i++) {
            const t = i / 7;
            puff(S * 0.12 + t * S * 0.76 + rr(-14, 14), base - rr(4, 24),
                rr(44, 82) * (1 - Math.abs(t - 0.5) * 0.5), rr(0.70, 0.95));
        }
        for (let i = 0; i < 13; i++) {
            const t = i / 12, lift = Math.sin(t * Math.PI) * S * 0.22;
            puff(S * 0.18 + t * S * 0.64 + rr(-26, 26), base - lift - rr(8, 44),
                rr(28, 62) * (0.6 + Math.sin(t * Math.PI) * 0.6), rr(0.5, 0.88));
        }
        g.globalCompositeOperation = 'source-atop';
        const shade = g.createLinearGradient(0, base - S * 0.3, 0, base + 12);
        shade.addColorStop(0, 'rgba(255,255,255,0)');
        shade.addColorStop(0.6, 'rgba(186,198,214,0.24)');
        shade.addColorStop(1, 'rgba(158,174,196,0.48)');
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
        vec3 col = mix(hor, mid, smoothstep(-0.03, 0.20, h));
        col = mix(col, zen, smoothstep(0.10, 0.92, h));
        float sd = max(dot(normalize(d), sunDir), 0.0);
        // The wash of light around the sun, and the haze that thickens down to
        // the water — a hot day is never a clean gradient.
        col += sunCol * pow(sd, 26.0) * 0.30;
        col += sunCol * pow(sd, 3.6) * 0.10 * (1.0 - smoothstep(0.0, 0.55, h));
        col = mix(col, hor * 1.04, smoothstep(0.08, -0.08, h));
        return col;
      }
    `;

    const skyUniforms = {
        uSunDir: { value: SUN_DIR.clone() }, uSunCol: { value: C_SUN.clone() },
        uZen: { value: C_ZEN.clone() }, uMid: { value: C_MID.clone() }, uHor: { value: C_HOR.clone() },
    };
    const sky = new THREE.Mesh(
        new THREE.SphereGeometry(3200, 40, 26),
        new THREE.ShaderMaterial({
            side: THREE.BackSide, depthWrite: false, fog: false, uniforms: skyUniforms,
            vertexShader: /* glsl */`
              varying vec3 vDir;
              void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
            fragmentShader: SKY_GLSL + /* glsl */`
              varying vec3 vDir;
              uniform vec3 uSunDir, uSunCol, uZen, uMid, uHor;
              void main(){
                vec3 d = normalize(vDir);
                vec3 col = skyColor(d, uSunDir, uZen, uMid, uHor, uSunCol);
                float sd = max(dot(d, uSunDir), 0.0);
                col += uSunCol * smoothstep(0.99920, 0.99980, sd) * 4.5;
                gl_FragColor = vec4(col, 1.0);
              }`,
        })
    );
    sky.renderOrder = -10;
    scene.add(world.ghost(sky));

    const clouds = [];
    for (let i = 0; i < 16; i++) {
        const sp = new THREE.Sprite(new THREE.SpriteMaterial({
            map: cloudTex, transparent: true, depthWrite: false, fog: false,
            opacity: rr(0.30, 0.72),
            color: new THREE.Color().setRGB(rr(1.5, 1.95), rr(1.5, 1.9), rr(1.45, 1.85)),
        }));
        const ang = rr(0, TAU), rad = rr(340, 1700);
        const sz = rr(180, 480) * (rad / 800 + 0.5);
        sp.position.set(Math.cos(ang) * rad, rr(200, 520) + rad * 0.05, Math.sin(ang) * rad);
        sp.scale.set(sz, sz * rr(0.30, 0.50), 1);
        sp.userData.drift = rr(0.8, 2.4);
        sp.renderOrder = -5;
        clouds.push(sp);
        scene.add(world.ghost(sp));
    }

    /* ==========================================================
       5 · The water, and the four waves everything agrees on

       The same numbers run twice: once in the vertex shader, so the surface
       moves, and once in JavaScript below, so the pontoon rides the surface it
       is actually floating on rather than one of its own invention.
       ========================================================== */

    // [dir x, dir z, steepness, wavelength m, speed multiplier]
    const WAVES = [
        [0.86, 0.51, 0.020, 14.00, 0.85],   // what is left of the swell, in past the heads
        [0.62, 0.78, 0.055, 3.60, 1.00],    // the sea breeze chop
        [-0.35, 0.94, 0.048, 2.10, 1.12],
        [0.95, -0.31, 0.030, 1.10, 1.25],   // the wash off something that went by
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
        `addWave(vec2(${w[0].toFixed(3)}, ${w[1].toFixed(3)}), ${w[2].toFixed(4)}, ${w[3].toFixed(3)}, ${w[4].toFixed(3)}, p, t, disp, tang, bino);`
    ).join('\n            ');

    /** The JavaScript half of the same sum: how high the water is, right there. */
    const WAVE_JS = WAVES.map(([dx, dz, steep, wl, spd]) => {
        const l = Math.hypot(dx, dz) || 1;
        const k = TAU / wl;
        return { dx: dx / l, dz: dz / l, k, a: steep / k, c: Math.sqrt(9.81 / k) * spd };
    });
    function waterY(x, z, t) {
        let y = 0;
        for (let i = 0; i < WAVE_JS.length; i++) {
            const w = WAVE_JS[i];
            y += w.a * Math.sin(w.k * (w.dx * x + w.dz * z - w.c * t));
        }
        return y;
    }

    const seaUniforms = {
        uTime, uCamPos,
        uSunDir: { value: SUN_DIR.clone() }, uSunCol: { value: C_SUN.clone() },
        uZen: { value: C_ZEN.clone() }, uMid: { value: C_MID.clone() }, uHor: { value: C_HOR.clone() },
        uDeep: { value: C_DEEP.clone() }, uShal: { value: C_SHAL.clone() }, uFoam: { value: C_FOAM.clone() },
        uFogCol: { value: FOG_COL.clone() }, uFogDensity: { value: FOG_DENSITY },
        // What is sitting in the water, so the water can foam against it and be
        // shadowed by it: the pontoon's footprint and the two guide piles.
        uHullHalf: { value: V2(HX, HZ) },
        uHullPos: { value: V2(0, 0) },
        uPileA: { value: V2(PILE_X, PILE_Z) },
        uPileB: { value: V2(-PILE_X, PILE_Z) },
        uPileR: { value: PILE_R },
    };

    /** A disc of water, dense in the middle and stretched at the rim. */
    function seaRing(r0, r1, NR, NA, power) {
        const pos = [], nrm = [], uvs = [], idx = [];
        for (let i = 0; i <= NR; i++) {
            const u = i / NR;
            const r = r0 + (r1 - r0) * Math.pow(u, power);
            for (let j = 0; j <= NA; j++) {
                const a = (j / NA) * TAU;
                pos.push(Math.cos(a) * r, 0, Math.sin(a) * r);
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
    }

    const seaMat = new THREE.ShaderMaterial({
        uniforms: seaUniforms,
        vertexShader: WAVE_GLSL + /* glsl */`
          uniform float uTime;
          varying vec3 vWorld; varying vec3 vNrm; varying float vCrest;
          void main(){
            vec3 wp = (modelMatrix * vec4(position, 1.0)).xyz;
            vec2 p = wp.xz; float t = uTime;
            vec3 disp = vec3(0.0), tang = vec3(1.0, 0.0, 0.0), bino = vec3(0.0, 0.0, 1.0);
            ${waveCalls}
            // Far water is flattened: the mesh cannot carry the chop out there,
            // and a stretched triangle waving about reads as a crawling seam.
            float far = 1.0 - smoothstep(70.0, 400.0, length(cameraPosition.xz - p)) * 0.88;
            disp *= far;
            vec3 wpos = wp + disp;
            vNrm = normalize(mix(vec3(0.0, 1.0, 0.0), normalize(cross(bino, tang)), far));
            vCrest = clamp(disp.y * 9.0, -1.0, 1.0);
            vWorld = wpos;
            gl_Position = projectionMatrix * viewMatrix * vec4(wpos, 1.0);
          }`,
        fragmentShader: SKY_GLSL + /* glsl */`
          uniform float uTime, uFogDensity, uPileR;
          uniform vec3 uCamPos, uSunDir, uSunCol, uZen, uMid, uHor, uDeep, uShal, uFoam, uFogCol;
          uniform vec2 uHullHalf, uHullPos, uPileA, uPileB;
          varying vec3 vWorld; varying vec3 vNrm; varying float vCrest;

          float h21(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
          float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
            float a = h21(i), b = h21(i + vec2(1.0, 0.0)), c = h21(i + vec2(0.0, 1.0)), d = h21(i + vec2(1.0, 1.0));
            return mix(mix(a, b, f.x), mix(c, d, f.x), f.y); }
          float fbm(vec2 p){ float s = 0.0, a = 0.5; for(int i = 0; i < 4; i++){ s += a * vn(p); p *= 2.05; a *= 0.5; } return s; }

          /// Distance to the pontoon's rectangle, negative inside.
          float boxSDF(vec2 p, vec2 c, vec2 h){
            vec2 d = abs(p - c) - h;
            return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
          }

          void main(){
            float dist = length(uCamPos - vWorld);
            vec3 N = normalize(vNrm);

            // Ripple detail, scaled by distance so it never aliases into moire.
            float lod = clamp(dist / 26.0, 0.30, 6.0);
            vec2 rp = vWorld.xz * (1.35 / lod);
            float n1 = fbm(rp + vec2(uTime * 0.30, uTime * 0.17) / lod);
            float n2 = fbm(rp * 2.3 - vec2(uTime * 0.21, uTime * 0.35) / lod);
            N = normalize(N + vec3((n1 - 0.5) * 0.42, 0.0, (n2 - 0.5) * 0.42));

            vec3 V = normalize(uCamPos - vWorld);
            float fres = mix(0.024, 1.0, pow(1.0 - max(dot(N, V), 0.0), 5.0));
            vec3 R = reflect(-V, N); R.y = abs(R.y);
            vec3 refl = skyColor(R, uSunDir, uZen, uMid, uHor, uSunCol);

            // Harbour water: green over the sand off the jetty, blue-black where
            // the channel drops away past the end of the pontoon.
            float shelf = smoothstep(10.0, 70.0, length(vWorld.xz - vec2(-14.0, 0.0)));
            vec3 body = mix(uShal, uDeep, shelf);
            body *= 0.78 + 0.46 * max(dot(N, uSunDir), 0.0);
            body += uShal * pow(max(vCrest, 0.0), 2.0) * 0.40 * (1.0 - shelf * 0.6);

            // What the pontoon and its piles do to the light in the water: the
            // shadow they throw, and the skylight they take away underneath.
            // A point is in shadow when the ray from it towards the sun passes
            // through the deck, which for a flat slab is the footprint shifted
            // the other way: hence +off, not -off.
            float hull = boxSDF(vWorld.xz, uHullPos, uHullHalf);
            vec2 off = uSunDir.xz * (0.30 / max(uSunDir.y, 0.15));
            float shade = 1.0 - 0.72 * (1.0 - smoothstep(-0.10, 0.55, boxSDF(vWorld.xz + off, uHullPos, uHullHalf)));
            shade *= 1.0 - 0.30 * (1.0 - smoothstep(-0.05, 0.35, hull));
            shade *= 1.0 - 0.42 * (1.0 - smoothstep(uPileR, uPileR + 0.70, length(vWorld.xz + off * 5.0 - uPileA)));
            shade *= 1.0 - 0.42 * (1.0 - smoothstep(uPileR, uPileR + 0.70, length(vWorld.xz + off * 5.0 - uPileB)));
            body *= shade;
            refl *= mix(1.0, 0.86, 1.0 - smoothstep(-0.05, 0.30, hull));

            vec3 col = mix(body, refl, clamp(fres, 0.0, 1.0));

            // The glitter path. Two lobes: the hard sparkle and the sheen.
            vec3 H = normalize(V + uSunDir);
            float ndh = max(dot(N, H), 0.0);
            col += uSunCol * (pow(ndh, 520.0) * 1.05
                 + pow(ndh, 74.0) * 0.10 * (0.28 + 0.72 * fbm(vWorld.xz * 1.6 + uTime * 0.5)));

            // White water: slop against the hull and the piles, plus the odd
            // crest breaking on itself out in the channel.
            float wob = 0.16 * sin(uTime * 1.9 + vWorld.x * 1.7 + vWorld.z * 1.1)
                      + 0.10 * fbm(vWorld.xz * 2.6 - uTime * 0.6);
            float slop = 1.0 - smoothstep(0.02, 0.62 + wob, hull);
            float pileFoam = 1.0 - smoothstep(uPileR + 0.02, uPileR + 0.40 + wob, length(vWorld.xz - uPileA));
            pileFoam = max(pileFoam, 1.0 - smoothstep(uPileR + 0.02, uPileR + 0.40 + wob, length(vWorld.xz - uPileB)));
            float lace = fbm(vWorld.xz * 3.0 + vec2(0.0, uTime * 0.7));
            float foam = max(slop, pileFoam) * (0.45 + 0.55 * lace);
            foam += smoothstep(0.70, 0.99, vCrest) * smoothstep(0.55, 0.95, fbm(vWorld.xz * 0.8 - uTime * 0.25)) * 0.26;
            col = mix(col, uFoam * (0.92 + 0.16 * n1), clamp(foam, 0.0, 1.0) * 0.90);

            col = mix(col, uFogCol, 1.0 - exp(-pow(dist * uFogDensity, 2.0)));
            gl_FragColor = vec4(col, 1.0);
          }`,
    });

    // Near water, where a person can see it move — and the thing the walk's
    // grid gets sized to. The far half is a separate mesh so the grid does not
    // have to stretch to the horizon to hold it.
    const seaNear = new THREE.Mesh(seaRing(0.0, 46.0, 108, 128, 1.9), seaMat);
    seaNear.renderOrder = 1;
    scene.add(world.ground(seaNear));

    const seaFar = new THREE.Mesh(seaRing(45.0, 760.0, 60, 96, 2.4), seaMat);
    seaFar.renderOrder = 1;
    scene.add(world.ghost(seaFar));

    /* --- The other side of the harbour, a long way off ------------- */
    {
        const R = 265, NA = 200;
        const pos = [], col = [], idx = [];
        const c = new THREE.Color();
        for (let j = 0; j <= NA; j++) {
            const a = (j / NA) * TAU;
            const x = Math.cos(a) * R, z = Math.sin(a) * R;
            // A headland to the north-west, a low sandy shore to the south, and
            // a gap where the harbour goes on out to sea.
            const ridge = fbm2(a * 5.1 + 3.0, 11.0, 4);
            const head = Math.exp(-Math.pow(wrapPi(a - 2.55) * 1.4, 2)) * 26.0;
            const gap = 1.0 - Math.exp(-Math.pow(wrapPi(a + 0.55) * 2.2, 2)) * 0.92;
            const h = Math.max(0.6, (3.5 + ridge * 9.0 + head) * gap);
            pos.push(x, -1.0, z); col.push(0.09, 0.14, 0.17);
            pos.push(x, h, z);
            // Bush green on the high ground, bleached scrub and roofs at the water.
            const t = clamp(h / 26, 0, 1);
            c.setRGB(lerp(0.20, 0.11, t), lerp(0.24, 0.17, t), lerp(0.20, 0.13, t));
            if (hash2(j, 3) > 0.86) c.setRGB(0.34, 0.31, 0.28);   // something with a roof on it
            col.push(c.r, c.g, c.b);
        }
        for (let j = 0; j < NA; j++) {
            const a = j * 2;
            idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
        }
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
        g.setIndex(idx);
        g.computeVertexNormals();
        const shore = new THREE.Mesh(g, new THREE.MeshBasicMaterial({
            vertexColors: true, side: THREE.DoubleSide, fog: true,
        }));
        shore.renderOrder = 0;
        scene.add(world.ghost(shore));
    }

    /* ==========================================================
       6 · Things made of metal and timber
       ========================================================== */

    const jettyTex = deckTex.clone();
    jettyTex.wrapS = jettyTex.wrapT = THREE.RepeatWrapping;
    jettyTex.repeat.set(6, 1.2);
    jettyTex.needsUpdate = true;

    const MAT = {
        deck: new THREE.MeshStandardMaterial({ map: deckTex, roughness: 0.88, metalness: 0.0 }),
        jetty: new THREE.MeshStandardMaterial({ map: jettyTex, roughness: 0.90, metalness: 0.0 }),
        alum: new THREE.MeshStandardMaterial({
            map: alumTex, color: srgb(0xd7dde1), roughness: 0.46, metalness: 0.68, envMapIntensity: 1.0,
        }),
        tread: new THREE.MeshStandardMaterial({
            map: treadTex, color: srgb(0xd2d8dc), roughness: 0.40, metalness: 0.70,
        }),
        galv: new THREE.MeshStandardMaterial({ color: srgb(0x9aa2a6), roughness: 0.38, metalness: 0.80 }),
        rubber: new THREE.MeshStandardMaterial({ color: srgb(0x22242a), roughness: 0.92, metalness: 0.02 }),
        pile: new THREE.MeshStandardMaterial({ map: pileTex, roughness: 0.92, metalness: 0.0 }),
        float: new THREE.MeshStandardMaterial({ color: srgb(0x35414a), roughness: 0.72, metalness: 0.04 }),
        paint: new THREE.MeshStandardMaterial({ color: srgb(0xd8b32c), roughness: 0.62, metalness: 0.05 }),
        rope: new THREE.MeshStandardMaterial({ color: srgb(0xc8bda0), roughness: 0.95 }),
        paper: new THREE.MeshStandardMaterial({
            map: paperTex, roughness: 0.86, metalness: 0.0, side: THREE.DoubleSide,
        }),
        chip: new THREE.MeshStandardMaterial({ map: chipTex, roughness: 0.62, metalness: 0.0 }),
        ringRed: new THREE.MeshStandardMaterial({ color: srgb(0xd4341c), roughness: 0.52 }),
        plastic: new THREE.MeshStandardMaterial({ color: srgb(0xd8dee2), roughness: 0.44, metalness: 0.02 }),
        signWhite: new THREE.MeshStandardMaterial({ color: srgb(0xeef2f4), roughness: 0.50, metalness: 0.10 }),
        can: new THREE.MeshStandardMaterial({ color: srgb(0x2c6f4a), roughness: 0.30, metalness: 0.72 }),
    };

    // Everything that floats hangs off this. The frame moves it, and the birds,
    // the chips and the paper are all under it, so the whole argument rides.
    const pontoon = new THREE.Group();
    scene.add(pontoon);

    /* --- Deck, frame and floats ------------------------------------ */
    {
        const top = new THREE.PlaneGeometry(2 * HX, 2 * HZ, 1, 1);
        top.rotateX(-Math.PI / 2);
        top.translate(0, DECK_Y, 0);
        const deck = new THREE.Mesh(top, MAT.deck);
        deck.receiveShadow = true;
        pontoon.add(deck);
    }
    {
        // The aluminium frame: perimeter channel, cross bearers, and the two
        // black floats slung under it.
        const parts = [];
        const fasciaH = 0.16, fasciaY = DECK_Y - fasciaH / 2;
        parts.push(placed(new THREE.BoxGeometry(2 * HX + 0.06, fasciaH, 0.09), 0, fasciaY, HZ + 0.02));
        parts.push(placed(new THREE.BoxGeometry(2 * HX + 0.06, fasciaH, 0.09), 0, fasciaY, -HZ - 0.02));
        parts.push(placed(new THREE.BoxGeometry(0.09, fasciaH, 2 * HZ - 0.10), HX + 0.02, fasciaY, 0));
        parts.push(placed(new THREE.BoxGeometry(0.09, fasciaH, 2 * HZ - 0.10), -HX - 0.02, fasciaY, 0));
        for (let i = 0; i < 7; i++) {
            const x = -HX + 0.30 + i * ((2 * HX - 0.60) / 6);
            parts.push(placed(new THREE.BoxGeometry(0.07, 0.13, 2 * HZ), x, DECK_Y - 0.14, 0));
        }
        for (const z of [-1.16, 1.16])
            parts.push(placed(new THREE.BoxGeometry(2 * HX - 0.40, 0.10, 0.16), 0, FLOAT_TOP + 0.06, z));
        const frame = new THREE.Mesh(mergeGeometries(parts.map(indexed)), MAT.alum);
        frame.castShadow = frame.receiveShadow = true;
        pontoon.add(frame);

        const floats = [];
        for (const z of [-1.16, 1.16])
            floats.push(placed(roundedBox(2 * HX - 0.44, FLOAT_TOP - FLOAT_BOT, 1.18, 0.13, 3),
                0, (FLOAT_TOP + FLOAT_BOT) / 2, z));
        const hull = new THREE.Mesh(mergeGeometries(floats.map(indexed)), MAT.float);
        hull.castShadow = true;
        pontoon.add(hull);
    }
    {
        // The rubber fender, all the way round, scuffed grey where the ferry
        // comes alongside. One sweep round a rounded rectangle.
        const pts = [];
        const rx = HX + 0.07, rz = HZ + 0.07, c = 0.34;
        const push = (x, z) => pts.push(V3(x, DECK_Y - 0.10, z));
        const corner = (cx, cz, a0) => {
            for (let i = 0; i <= 5; i++) {
                const a = a0 + (i / 5) * (Math.PI / 2);
                push(cx + Math.cos(a) * c, cz + Math.sin(a) * c);
            }
        };
        push(rx - c, -rz); push(rx - c + 0.001, -rz);
        corner(rx - c, -rz + c, -Math.PI / 2);
        push(rx, rz - c);
        corner(rx - c, rz - c, 0);
        push(-rx + c, rz);
        corner(-rx + c, rz - c, Math.PI / 2);
        push(-rx, -rz + c);
        corner(-rx + c, -rz + c, Math.PI);
        push(rx - c, -rz);
        const fender = new THREE.Mesh(sweep(pts, () => [0.075, 0.055], 10), MAT.rubber);
        fender.castShadow = true;
        pontoon.add(fender);
    }
    {
        // Four cleats, a bollard at the seaward end, and the swim ladder.
        const parts = [];
        const cleatGeo = (() => {
            const g = [];
            g.push(placed(new THREE.CylinderGeometry(0.028, 0.030, 0.115, 10), 0, 0.058, 0));
            g.push(placed(new THREE.CylinderGeometry(0.026, 0.026, 0.30, 10), 0, 0.115, 0, 0, 0, Math.PI / 2));
            for (const s of [-1, 1])
                g.push(placed(new THREE.SphereGeometry(0.032, 8, 6), s * 0.15, 0.115, 0).scale(1.0, 0.8, 0.9));
            g.push(placed(new THREE.BoxGeometry(0.13, 0.016, 0.09), 0, 0.008, 0));
            return mergeGeometries(g.map(indexed));
        })();
        for (const [x, z, ry] of [
            [HX - 0.34, -HZ + 0.30, 0.0], [HX - 0.34, HZ - 0.30, 0.0],
            [-HX + 0.34, -HZ + 0.30, 0.0], [-HX + 0.34, HZ - 0.30, 0.0],
        ]) parts.push(placed(cleatGeo, x, DECK_Y, z, 0, ry, 0));
        // The swim ladder, over the seaward end and down into the water, which
        // is where anybody who slips on wet timber comes back aboard.
        const LAD_Z = 0.86;
        for (const s of [-1, 1]) {
            const z = LAD_Z + s * 0.20;
            parts.push(sweep([
                V3(HX - 0.30, DECK_Y + 0.38, z), V3(HX - 0.12, DECK_Y + 0.32, z),
                V3(HX + 0.10, DECK_Y + 0.10, z), V3(HX + 0.20, DECK_Y - 0.20, z),
                V3(HX + 0.21, -0.62, z),
            ], () => 0.024, 8));
        }
        for (let i = 0; i < 3; i++)
            parts.push(placed(new THREE.CylinderGeometry(0.020, 0.020, 0.44, 8),
                HX + 0.20, DECK_Y - 0.22 - i * 0.30, LAD_Z, Math.PI / 2, 0, 0));
        const fittings = new THREE.Mesh(mergeGeometries(parts.map(indexed)), MAT.galv);
        fittings.castShadow = true;
        pontoon.add(fittings);
    }

    /* --- The guide piles, and the collars the pontoon rides on ----- */
    {
        const parts = [];
        for (const s of [-1, 1]) {
            const g = new THREE.CylinderGeometry(PILE_R * 0.92, PILE_R, PILE_TOP + 4.2, 14, 1, false);
            g.translate(s * PILE_X, (PILE_TOP - 4.2) / 2, PILE_Z);
            parts.push(g);
            // The cap, and the bird-worn top of it.
            parts.push(placed(new THREE.CylinderGeometry(PILE_R + 0.03, PILE_R + 0.03, 0.05, 14),
                s * PILE_X, PILE_TOP + 0.02, PILE_Z));
        }
        const piles = new THREE.Mesh(mergeGeometries(parts.map(indexed)), MAT.pile);
        piles.castShadow = piles.receiveShadow = true;
        scene.add(piles);

        // Guide collars: they belong to the pontoon, so they slide up and down
        // the pile as it lifts, which is exactly what they do in life.
        const coll = [];
        for (const s of [-1, 1]) {
            coll.push(placed(new THREE.TorusGeometry(PILE_R + 0.075, 0.045, 8, 20),
                s * PILE_X, DECK_Y - 0.06, PILE_Z, Math.PI / 2, 0, 0));
            coll.push(placed(new THREE.TorusGeometry(PILE_R + 0.075, 0.038, 8, 20),
                s * PILE_X, DECK_Y - 0.42, PILE_Z, Math.PI / 2, 0, 0));
            for (const dz of [-1, 1])
                coll.push(placed(new THREE.BoxGeometry(0.10, 0.42, 0.05),
                    s * PILE_X + dz * (PILE_R + 0.07), DECK_Y - 0.24, PILE_Z));
            coll.push(placed(new THREE.BoxGeometry(0.16, 0.09, 0.46), s * PILE_X, DECK_Y - 0.10, PILE_Z - 0.24));
        }
        const collars = new THREE.Mesh(mergeGeometries(coll.map(indexed)), MAT.galv);
        collars.castShadow = true;
        pontoon.add(collars);
    }

    /* --- The gangway, hinged on the jetty and rolling on the deck --- */
    const gangway = new THREE.Group();
    const GANG_L = 4.86, GANG_W = 1.16;
    gangway.position.set(JETTY_X0 + 0.14, JETTY_Y - 0.06, 0);
    scene.add(gangway);
    {
        const parts = [];
        parts.push(placed(new THREE.BoxGeometry(GANG_L, 0.05, GANG_W), GANG_L / 2, -0.03, 0));
        for (const s of [-1, 1]) {
            parts.push(placed(new THREE.BoxGeometry(GANG_L, 0.17, 0.06), GANG_L / 2, -0.11, s * (GANG_W / 2 - 0.03)));
            // Handrail: two rails and the posts under them.
            parts.push(placed(new THREE.CylinderGeometry(0.024, 0.024, GANG_L, 8),
                GANG_L / 2, 0.90, s * (GANG_W / 2 - 0.02), 0, 0, Math.PI / 2));
            parts.push(placed(new THREE.CylinderGeometry(0.020, 0.020, GANG_L, 8),
                GANG_L / 2, 0.52, s * (GANG_W / 2 - 0.02), 0, 0, Math.PI / 2));
            for (let i = 0; i <= 4; i++)
                parts.push(placed(new THREE.CylinderGeometry(0.024, 0.024, 0.94, 8),
                    0.30 + i * ((GANG_L - 0.6) / 4), 0.45, s * (GANG_W / 2 - 0.02)));
        }
        // Rollers on the bottom end, so it can ride the tide.
        for (const s of [-1, 1])
            parts.push(placed(new THREE.CylinderGeometry(0.06, 0.06, 0.10, 10),
                GANG_L - 0.10, -0.10, s * (GANG_W / 2 - 0.10), 0, 0, Math.PI / 2));
        const walk = new THREE.Mesh(mergeGeometries(parts.map(indexed)), MAT.alum);
        walk.castShadow = walk.receiveShadow = true;
        gangway.add(walk);

        // The tread plate itself gets its own mesh so it can wear the pattern.
        const plate = new THREE.PlaneGeometry(GANG_L, GANG_W, 1, 1);
        plate.rotateX(-Math.PI / 2);
        plate.translate(GANG_L / 2, 0.001, 0);
        const pl = plate.attributes.uv;
        for (let i = 0; i < pl.count; i++) pl.setXY(i, pl.getX(i) * 8, pl.getY(i) * 2);
        const tread = new THREE.Mesh(plate, MAT.tread);
        tread.receiveShadow = true;
        gangway.add(tread);
    }

    /* --- The jetty it all hangs off -------------------------------- */
    {
        const jetty = new THREE.Group();
        const X1 = JETTY_X0, X0 = -50.0, L = X1 - X0;
        const parts = [];
        const deckGeo = new THREE.BoxGeometry(L, 0.14, 2 * JETTY_HZ);
        deckGeo.translate((X0 + X1) / 2, JETTY_Y - 0.07, 0);
        const deckMesh = new THREE.Mesh(deckGeo, MAT.jetty);
        deckMesh.castShadow = deckMesh.receiveShadow = true;
        jetty.add(deckMesh);

        // Bearers, handrail and kerb, all merged into one piece of timber.
        for (const s of [-1, 1]) {
            parts.push(placed(new THREE.BoxGeometry(L, 0.24, 0.10), (X0 + X1) / 2, JETTY_Y - 0.26, s * (JETTY_HZ - 0.08)));
            parts.push(placed(new THREE.BoxGeometry(L, 0.09, 0.16), (X0 + X1) / 2, JETTY_Y + 0.045, s * (JETTY_HZ - 0.08)));
            parts.push(placed(new THREE.BoxGeometry(L, 0.10, 0.14), (X0 + X1) / 2, JETTY_Y + 1.06, s * (JETTY_HZ - 0.08)));
            parts.push(placed(new THREE.BoxGeometry(L, 0.07, 0.10), (X0 + X1) / 2, JETTY_Y + 0.62, s * (JETTY_HZ - 0.08)));
        }
        const timber = new THREE.Mesh(mergeGeometries(parts.map(indexed)), MAT.jetty);
        timber.castShadow = timber.receiveShadow = true;
        jetty.add(timber);

        // Rail posts, one instanced mesh for the lot of them.
        const NP = 13;
        const postGeo = new THREE.BoxGeometry(0.11, 1.22, 0.11);
        const posts = new THREE.InstancedMesh(postGeo, MAT.jetty, NP * 2);
        posts.castShadow = true;
        const m = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(1, 1, 1);
        let n = 0;
        for (let i = 0; i < NP; i++) {
            const x = X1 - 0.6 - i * ((L - 1.0) / (NP - 1));
            for (const s of [-1, 1]) {
                m.compose(_pv.set(x, JETTY_Y + 0.50, s * (JETTY_HZ - 0.08)), q, sc);
                posts.setMatrixAt(n++, m);
            }
        }
        posts.instanceMatrix.needsUpdate = true;
        jetty.add(posts);

        // And the piles, in pairs, disappearing under the water.
        const pileGeo = new THREE.CylinderGeometry(0.15, 0.17, 6.4, 12);
        pileGeo.translate(0, JETTY_Y - 0.34 - 3.2, 0);
        const jpiles = new THREE.InstancedMesh(pileGeo, MAT.pile, NP * 2);
        jpiles.castShadow = true;
        n = 0;
        for (let i = 0; i < NP; i++) {
            const x = X1 - 0.6 - i * ((L - 1.0) / (NP - 1));
            for (const s of [-1, 1]) {
                _eu.set(0, hash2(i, s) * 0.6, (hash2(i, s + 9) - 0.5) * 0.05);
                m.compose(_pv.set(x, 0, s * (JETTY_HZ - 0.18)), q.setFromEuler(_eu), sc);
                jpiles.setMatrixAt(n++, m);
            }
        }
        jpiles.instanceMatrix.needsUpdate = true;
        jetty.add(jpiles);

        scene.add(jetty);
    }

    /* --- The shore the jetty is attached to, off in the heat ------- */
    {
        const X0 = -52, X1 = -128, NZ = 60, NX = 26;
        const pos = [], col = [], idx = [];
        const c = new THREE.Color();
        const landH = (x, z) => {
            const inland = smooth(X0 + 1.0, X0 - 30, x);
            let y = -0.9 + inland * 7.4;
            y += (fbm2(x * 0.06, z * 0.06, 4) - 0.5) * 5.4 * inland;
            y += (fbm2(x * 0.22, z * 0.22, 3) - 0.5) * 0.9;
            return y;
        };
        for (let i = 0; i <= NX; i++) {
            const x = X0 + (X1 - X0) * Math.pow(i / NX, 1.4);
            for (let j = 0; j <= NZ; j++) {
                const z = -170 + (340 * j) / NZ;
                const y = landH(x, z);
                pos.push(x, y, z);
                const beach = smooth(1.4, -0.2, y);
                const v = fbm2(x * 0.09 + 4, z * 0.09, 3);
                c.setRGB(lerp(0.16, 0.30, v), lerp(0.21, 0.31, v), lerp(0.13, 0.18, v));
                c.lerp(new THREE.Color(0.62, 0.56, 0.42), beach);
                col.push(c.r, c.g, c.b);
            }
        }
        const row = NZ + 1;
        for (let i = 0; i < NX; i++)
            for (let j = 0; j < NZ; j++) {
                const a = i * row + j, b = a + row;
                idx.push(a, b, a + 1, b, b + 1, a + 1);
            }
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
        g.setIndex(idx);
        g.computeVertexNormals();
        const land = new THREE.Mesh(g, new THREE.MeshStandardMaterial({
            vertexColors: true, roughness: 0.98, metalness: 0.0,
        }));
        scene.add(world.ghost(land));

        // Norfolk pines along the front, because there is a row of them along
        // every harbour front in the country.
        const treeGeo = mergeGeometries([
            new THREE.ConeGeometry(2.0, 12.0, 7).translate(0, 6.6, 0),
            new THREE.ConeGeometry(2.9, 7.0, 7).translate(0, 3.2, 0),
            new THREE.CylinderGeometry(0.20, 0.32, 2.0, 6).translate(0, 0.8, 0),
        ].map(indexed));
        const trees = new THREE.InstancedMesh(treeGeo, new THREE.MeshStandardMaterial({
            color: srgb(0x2d4432), roughness: 0.95,
        }), 22);
        const m2 = new THREE.Matrix4(), q2 = new THREE.Quaternion(), s2 = new THREE.Vector3();
        for (let i = 0; i < 22; i++) {
            const z = -130 + i * 12 + rr(-4, 4);
            const x = X0 - 5 - rr(0, 9);
            _eu.set(0, rr(0, TAU), 0);
            s2.setScalar(rr(0.8, 1.35));
            m2.compose(_pv.set(x, landH(x, z) - 0.4, z), q2.setFromEuler(_eu), s2);
            trees.setMatrixAt(i, m2);
        }
        trees.instanceMatrix.needsUpdate = true;
        scene.add(world.ghost(trees));
    }

    /* ==========================================================
       7 · The cause of the argument, and what else is on the deck
       ========================================================== */

    /* --- The parcel: butcher's paper, opened out, gone soft -------- */
    {
        const g = new THREE.PlaneGeometry(0.62, 0.58, 14, 14);
        g.rotateX(-Math.PI / 2);
        const p = g.attributes.position;
        for (let i = 0; i < p.count; i++) {
            const x = p.getX(i), z = p.getZ(i);
            const r = Math.hypot(x / 0.31, z / 0.29);
            // A shallow dish in the middle, corners lifting and curling, and
            // creases where it was folded over the chips on the counter.
            let y = 0.004 + Math.pow(clamp(r, 0, 1.4), 3.0) * 0.075;
            y += (fbm2(x * 26 + 5, z * 26, 3) - 0.5) * 0.020;
            y += Math.abs(Math.sin(x * 9.4)) * 0.006 + Math.abs(Math.sin(z * 7.7)) * 0.005;
            p.setXYZ(i, x * (1 + 0.06 * Math.sin(z * 6.0)), y, z * (1 + 0.05 * Math.cos(x * 5.0)));
        }
        g.computeVertexNormals();
        const parcel = new THREE.Group();
        const sheet = new THREE.Mesh(g, MAT.paper);
        sheet.castShadow = sheet.receiveShadow = true;
        parcel.add(sheet);
        // The torn-off corner, blown up against the fender an hour ago.
        const scrap = new THREE.Mesh(new THREE.PlaneGeometry(0.19, 0.14, 4, 4), MAT.paper);
        scrap.rotation.set(-Math.PI / 2 + 0.5, 0.9, 0.2);
        scrap.position.set(0.48, 0.03, -0.42);
        parcel.add(scrap);
        parcel.position.set(CHIPS.x, DECK_Y, CHIPS.y);
        parcel.rotation.y = -0.42;
        pontoon.add(world.part('parcel_00', parcel));
    }

    /* --- The chips themselves -------------------------------------- */
    const chipGeo = (() => {
        // A chip is a box with a bend in it and one end darker than the other;
        // the bend is what stops forty of them reading as forty identical boxes.
        const g = new THREE.BoxGeometry(0.017, 0.015, 0.082, 1, 1, 5);
        const p = g.attributes.position;
        for (let i = 0; i < p.count; i++) {
            const z = p.getZ(i), t = z / 0.041;
            p.setY(i, p.getY(i) + t * t * 0.006);
            p.setX(i, p.getX(i) * (1 - Math.abs(t) * 0.16));
        }
        g.computeVertexNormals();
        return g;
    })();
    {
        const N = 46;
        const chips = new THREE.InstancedMesh(chipGeo, MAT.chip, N);
        chips.castShadow = chips.receiveShadow = true;
        const m = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3();
        for (let i = 0; i < N; i++) {
            // Most of them still in the paper, a scatter of them out on the deck
            // where feet and beaks have knocked them about.
            const inParcel = i < 22;
            const a = rr(0, TAU);
            const d = inParcel ? Math.pow(rnd(), 0.6) * 0.24 : 0.30 + Math.pow(rnd(), 0.7) * 1.35;
            const x = CHIPS.x + Math.cos(a) * d, z = CHIPS.y + Math.sin(a) * d * 0.85;
            const lie = rnd() < 0.82;
            _eu.set(lie ? rr(-0.12, 0.12) : rr(-1.2, 1.2), rr(0, TAU), lie ? rr(-0.2, 0.2) : rr(-1.4, 1.4));
            sc.set(rr(0.85, 1.25), rr(0.85, 1.2), rr(0.7, 1.35));
            m.compose(_pv.set(x, DECK_Y + (inParcel ? rr(0.012, 0.045) : 0.009), z), q.setFromEuler(_eu), sc);
            chips.setMatrixAt(i, m);
        }
        chips.instanceMatrix.needsUpdate = true;
        pontoon.add(chips);
    }

    /* --- The little wooden fork, and a can somebody left ----------- */
    {
        const parts = [];
        parts.push(new THREE.BoxGeometry(0.012, 0.0035, 0.070).translate(0, 0, -0.020));
        for (const s of [-1, 1])
            parts.push(new THREE.BoxGeometry(0.0035, 0.0035, 0.030).translate(s * 0.0038, 0, 0.030));
        const fork = new THREE.Mesh(mergeGeometries(parts.map(indexed)), new THREE.MeshStandardMaterial({
            color: srgb(0xd9c79c), roughness: 0.85,
        }));
        fork.castShadow = true;
        fork.position.set(CHIPS.x + 0.52, DECK_Y + 0.004, CHIPS.y + 0.30);
        fork.rotation.set(0, 1.15, 0.06);
        pontoon.add(world.part('fork_00', fork));

        const canGeo = (() => {
            const g = new THREE.CylinderGeometry(0.033, 0.033, 0.125, 14, 4);
            const p = g.attributes.position;
            for (let i = 0; i < p.count; i++) {
                const y = p.getY(i), x = p.getX(i), z = p.getZ(i);
                // Stood on, so the middle is folded in and the top is oval.
                const crush = Math.exp(-Math.pow(y / 0.030, 2)) * 0.55;
                const k = 1 - crush * (0.5 + 0.5 * Math.sin(Math.atan2(z, x) * 3.0));
                p.setXYZ(i, x * k, y * (1 - crush * 0.35), z * k);
            }
            g.computeVertexNormals();
            return g;
        })();
        const can = new THREE.Mesh(canGeo, MAT.can);
        can.castShadow = true;
        can.position.set(HX - 0.72, DECK_Y + 0.030, -HZ + 0.36);
        can.rotation.set(Math.PI / 2 - 0.05, 0.4, 0.2);
        pontoon.add(world.part('can_00', can));
    }

    /* --- The esky somebody is fishing out of ----------------------- */
    {
        const esky = new THREE.Group();
        const box = new THREE.Mesh(roundedBox(0.58, 0.34, 0.36, 0.035, 2), MAT.plastic);
        box.position.y = 0.17;
        box.castShadow = box.receiveShadow = true;
        esky.add(box);
        const lid = new THREE.Mesh(roundedBox(0.60, 0.075, 0.38, 0.030, 2), new THREE.MeshStandardMaterial({
            color: srgb(0x2f4a6b), roughness: 0.44,
        }));
        lid.position.set(-0.03, 0.372, 0);
        lid.rotation.z = 0.12;                 // left ajar, which is how this started
        lid.castShadow = true;
        esky.add(lid);
        const handle = new THREE.Mesh(sweep([
            V3(-0.30, 0.10, 0), V3(-0.36, 0.18, 0), V3(-0.30, 0.26, 0),
        ], () => 0.014, 8), MAT.rubber);
        esky.add(handle);
        esky.position.set(HX - 1.30, DECK_Y, HZ - 0.62);
        esky.rotation.y = 0.36;
        pontoon.add(world.part('esky_00', esky));
    }

    /* --- Life ring, post and the sign nobody reads ----------------- */
    {
        const signTex = world.canvasTexture(512, 384, (g, cv) => {
            const W = cv.width, H = cv.height;
            g.fillStyle = '#eef2f4'; g.fillRect(0, 0, W, H);
            g.strokeStyle = '#1d4f8f'; g.lineWidth = 12;
            g.strokeRect(14, 14, W - 28, H - 28);
            g.fillStyle = '#1d4f8f';
            g.font = 'bold 62px Helvetica, Arial, sans-serif';
            g.textAlign = 'center';
            g.fillText('NO FISHING', W / 2, 118);
            g.fillText('FROM PONTOON', W / 2, 184);
            g.font = 'bold 44px Helvetica, Arial, sans-serif';
            g.fillStyle = '#b02418';
            g.fillText('FERRIES ONLY', W / 2, 262);
            g.font = '28px Helvetica, Arial, sans-serif';
            g.fillStyle = '#555c62';
            g.fillText('4 KNOTS  ·  KEEP CLEAR OF GANGWAY', W / 2, 322);
            // Sun-bleached, salt-etched, and shot at by something.
            g.globalAlpha = 0.5;
            for (let i = 0; i < 260; i++) {
                g.fillStyle = Math.random() < 0.5 ? 'rgba(255,255,255,0.6)' : 'rgba(150,158,164,0.35)';
                g.beginPath(); g.arc(Math.random() * W, Math.random() * H, 1 + Math.random() * 7, 0, TAU); g.fill();
            }
            g.globalAlpha = 1;
        });

        const post = new THREE.Group();
        const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.042, 1.34, 10), MAT.galv);
        stem.position.y = 0.67;
        stem.castShadow = true;
        post.add(stem);
        const ring = new THREE.Group();
        const torus = new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.058, 10, 22), MAT.ringRed);
        torus.castShadow = true;
        ring.add(torus);
        // The white quarters, four little arcs of tape.
        const tape = new THREE.Mesh(
            new THREE.TorusGeometry(0.191, 0.059, 8, 8, 0.55), MAT.signWhite);
        ring.add(tape);
        const tape2 = new THREE.Mesh(
            new THREE.TorusGeometry(0.191, 0.059, 8, 8, 0.55), MAT.signWhite);
        tape2.rotation.z = Math.PI;
        ring.add(tape2);
        ring.position.set(0.0, 1.02, 0.075);
        ring.rotation.x = 0.10;
        post.add(world.part('ring_00', ring));
        const sign = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.33, 0.012), [
            MAT.signWhite, MAT.signWhite, MAT.signWhite, MAT.signWhite,
            new THREE.MeshStandardMaterial({ map: signTex, roughness: 0.52, metalness: 0.10 }),
            MAT.signWhite,
        ]);
        sign.position.set(0, 0.52, 0.058);
        sign.castShadow = true;
        post.add(sign);
        post.position.set(-HX + 0.80, DECK_Y, -HZ + 0.62);   // clear of the corner cleat
        post.rotation.y = 1.16;                 // square-on to anybody stepping off the gangway
        pontoon.add(post);
    }

    /* --- A tinnie tied off at the end, riding the same waves -------- */
    const tinnie = new THREE.Group();
    {
        // Lofted hull: a vee forward that flattens right out aft, which is what
        // makes an aluminium dinghy slap like that in any chop at all.
        const L = 3.30, NU = 22, NV = 11;
        const pos = [], uvs = [], idx = [];
        for (let i = 0; i <= NU; i++) {
            const u = i / NU;                       // 0 bow → 1 transom
            const x = lerp(1.62, -1.68, u);
            const halfW = 0.10 + Math.pow(Math.sin(Math.min(1, u * 1.18) * Math.PI * 0.62), 0.7) * 0.62;
            const vee = lerp(0.34, 0.09, Math.pow(u, 0.7));
            const sheer = 0.30 + Math.pow(1 - u, 2.2) * 0.20;
            for (let j = 0; j <= NV; j++) {
                const v = j / NV;                   // port gunwale → keel → starboard
                const s = (v - 0.5) * 2;
                const z = s * halfW;
                const y = lerp(-vee, sheer, Math.pow(Math.abs(s), 0.85));
                pos.push(x, y, z);
                uvs.push(u, v);
            }
        }
        const row = NV + 1;
        for (let i = 0; i < NU; i++)
            for (let j = 0; j < NV; j++) {
                const a = i * row + j, b = a + row;
                idx.push(a, a + 1, b, b, a + 1, b + 1);
            }
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
        g.setIndex(idx);
        g.computeVertexNormals();
        const hullMat = new THREE.MeshStandardMaterial({
            map: alumTex, color: srgb(0xb9c0c4), roughness: 0.44, metalness: 0.66,
            side: THREE.DoubleSide, envMapIntensity: 1.1,
        });
        const hull = new THREE.Mesh(g, hullMat);
        hull.castShadow = hull.receiveShadow = true;
        tinnie.add(hull);
        // Transom, thwarts and the gunwale rail.
        const parts = [];
        parts.push(placed(new THREE.BoxGeometry(0.05, 0.44, 1.30), -1.68, 0.10, 0));
        for (const x of [0.62, -0.42, -1.28])
            parts.push(placed(new THREE.BoxGeometry(0.20, 0.045, 1.36), x, 0.20, 0));
        const fittings = new THREE.Mesh(mergeGeometries(parts.map(indexed)), hullMat);
        fittings.castShadow = true;
        tinnie.add(fittings);
        const kicker = new THREE.Mesh(roundedBox(0.30, 0.46, 0.26, 0.05, 2), new THREE.MeshStandardMaterial({
            color: srgb(0x2b3138), roughness: 0.42, metalness: 0.30,
        }));
        kicker.position.set(-1.86, 0.22, 0);
        kicker.castShadow = true;
        tinnie.add(kicker);
        const water = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.0), new THREE.MeshStandardMaterial({
            color: srgb(0x0e3b4a), roughness: 0.18, metalness: 0.0,
        }));
        water.rotation.x = -Math.PI / 2;            // the inch of harbour in the bilge
        water.position.set(-0.2, -0.22, 0);
        tinnie.add(water);

        tinnie.position.set(1.05, 0, -HZ - 1.36);
        tinnie.rotation.y = 0.06;
        scene.add(world.ghost(world.part('tinnie_00', tinnie)));

        // The painter, from the tinnie's bow to the pontoon cleat. It hangs off
        // the pontoon, and the tinnie lies close enough alongside that the slack
        // in it covers the difference.
        const rope = new THREE.Mesh(sweep([
            V3(HX - 0.34, DECK_Y + 0.10, -HZ + 0.30),
            V3(2.95, DECK_Y - 0.08, -HZ - 0.30),
            V3(2.70, DECK_Y - 0.18, -HZ - 0.85),
            V3(2.60, DECK_Y + 0.02, -HZ - 1.27),
        ], () => 0.016, 7), MAT.rope);
        rope.castShadow = true;
        pontoon.add(rope);
    }

    /* ==========================================================
       8 · One silver gull, cut once and used six times

       Everything here is in bird space: feet on the ground at the origin,
       facing +z, metres. A silver gull is a small bird — a foot and a half
       from bill to tail — and the whole trick of the long call is that the
       neck it does it with is not there when the bird is standing about.
       ========================================================== */

    const G = {};

    // Trunk: a sphere pulled into the deep chest and tucked rump of a gull,
    // with the shoulders, the folded thighs and the throat merged straight in.
    G.body = (() => {
        const s = new THREE.SphereGeometry(1, 24, 16);
        const p = s.attributes.position;
        for (let i = 0; i < p.count; i++) {
            const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
            const aft = Math.max(0, -z), fore = Math.max(0, z);
            const taper = Math.pow(1 - 0.58 * aft, 1.12);
            const rx = 0.0600 * taper;
            const ry = 0.0685 * taper * (y < 0 ? 1.12 : 0.94) * (1 + fore * 0.10);
            const yc = 0.1540 + 0.0190 * Math.pow(aft, 1.7) - 0.0055 * fore;
            p.setXYZ(i, x * rx, y * ry + yc, -0.012 + z * 0.124);
        }
        s.computeVertexNormals();
        const parts = [s];
        parts.push(placed(new THREE.SphereGeometry(0.037, 10, 8), 0, 0.1680, -0.1120).scale(1.05, 0.86, 1.30));
        for (const side of [-1, 1])
            parts.push(placed(new THREE.SphereGeometry(0.030, 10, 8), side * 0.040, 0.1970, 0.038).scale(0.86, 0.72, 1.20));
        for (const side of [-1, 1])
            parts.push(placed(new THREE.SphereGeometry(0.026, 10, 8), side * 0.0285, 0.0965, -0.0110).scale(0.90, 1.45, 1.25));
        parts.push(placed(new THREE.SphereGeometry(0.048, 12, 8), 0, 0.1660, 0.0740).scale(1.02, 1.00, 0.90));
        return mergeGeometries(parts);
    })();

    /**
     * One length of neck, built along +y at unit length so the rig can run it
     * out and pull it back in by scaling. Three of these in a chain give the
     * resting S — and, straightened and run out to two and a half times this,
     * the white column the yelling happens on top of.
     */
    function neckSeg(r0, r1) {
        const pts = [];
        for (let i = 0; i <= 5; i++) pts.push(V3(0, i / 5, 0));
        // Capped: at a hard bend the cap of one length fills the mouth of the
        // next, and nobody ever sees down a gull's neck.
        return sweep(pts, (t) => lerp(r0, r1, t), 12, true);
    }
    const NECK = {
        // rest length, called length, radii
        A: { rest: 0.031, call: 0.075, geo: neckSeg(0.0455, 0.0370) },
        B: { rest: 0.029, call: 0.072, geo: neckSeg(0.0370, 0.0300) },
        C: { rest: 0.026, call: 0.062, geo: neckSeg(0.0300, 0.0250) },
    };
    const NECK_BASE = V3(0, 0.1755, 0.0480);

    // Skull: flat crown, full nape, and the throat under it.
    G.head = (() => {
        const s = new THREE.SphereGeometry(0.0330, 16, 12);
        const p = s.attributes.position;
        for (let i = 0; i < p.count; i++) {
            const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
            const yn = y / 0.0330, zn = z / 0.0330;
            const crown = 1 - 0.11 * smooth(0.2, 1.0, yn);
            const nape = 1 + 0.15 * smooth(0.1, -1.0, zn) * smooth(0.6, -0.4, yn);
            p.setXYZ(i, x * 0.94, y * 0.97 * crown, z * 1.18 * nape - 0.002);
        }
        s.computeVertexNormals();
        return mergeGeometries([
            s,
            placed(new THREE.SphereGeometry(0.0255, 12, 8), 0, -0.0165, 0.0105).scale(0.94, 0.88, 1.06),
        ]);
    })();

    // The bill: a straightish upper mandible, and a lower one with the gonydeal
    // angle — the kink near the tip that makes a gull's face a gull's face.
    G.billUpper = (() => {
        const c = new THREE.ConeGeometry(0.0120, 0.0425, 12);
        c.rotateX(Math.PI / 2);
        c.scale(1.0, 0.72, 1.0);
        c.translate(0, 0.0020, 0.0194);
        const p = c.attributes.position;
        for (let i = 0; i < p.count; i++) {
            const z = p.getZ(i);
            const t = clamp((z - 0.014) / 0.028, 0, 1);
            p.setY(i, p.getY(i) - t * t * 0.0066);
            p.setX(i, p.getX(i) * (1 - t * 0.18));
        }
        c.computeVertexNormals();
        return c;
    })();
    G.billLower = (() => {
        const c = new THREE.ConeGeometry(0.0102, 0.0350, 10);
        c.rotateX(Math.PI / 2);
        c.scale(1.0, 0.60, 1.0);
        c.translate(0, -0.0006, 0.0158);
        const p = c.attributes.position;
        for (let i = 0; i < p.count; i++) {
            const z = p.getZ(i);
            const t = clamp((z - 0.010) / 0.024, 0, 1);
            p.setY(i, p.getY(i) - Math.pow(t, 1.6) * 0.0060 + Math.pow(t, 3.0) * 0.0033);
        }
        c.computeVertexNormals();
        return c;
    })();
    // The lining of the mouth: red, and only ever seen when the bird is
    // shouting, which in this world is most of the time.
    G.gape = (() => {
        const g = new THREE.PlaneGeometry(0.018, 0.032, 1, 1);
        g.rotateX(-Math.PI / 2);
        g.translate(0, 0, 0.0160);
        return g;
    })();

    const EYE = { x: 0.0218, y: 0.0058, z: 0.0126, yaw: 0.30 };
    G.iris = mergeGeometries([-1, 1].map(s =>
        placed(new THREE.SphereGeometry(0.0070, 10, 8), s * EYE.x, EYE.y, EYE.z, 0, s * EYE.yaw, 0)));
    G.pupil = mergeGeometries([-1, 1].map(s =>
        placed(new THREE.SphereGeometry(0.0038, 8, 6),
            s * (EYE.x + Math.sin(s * EYE.yaw) * 0.0033), EYE.y, EYE.z + Math.cos(EYE.yaw) * 0.0033,
            0, s * EYE.yaw, 0).scale(1, 1, 0.7)));
    const orbitalGeo = mergeGeometries([-1, 1].map(s =>
        placed(new THREE.TorusGeometry(0.0077, 0.0016, 5, 12), s * EYE.x, EYE.y, EYE.z,
            0, -s * (Math.PI / 2 - EYE.yaw), 0)));
    // Both lids in one mesh, built about the origin rather than about the eyes,
    // so a single rotation swings the pair of caps down where they belong.
    G.lid = mergeGeometries([-1, 1].map(s =>
        placed(new THREE.SphereGeometry(0.0080, 10, 5, 0, TAU, 0, Math.PI * 0.5), s * EYE.x, 0, 0)));

    // Only the lower mandible drops when a gull gapes, so the upper is rigid to
    // the skull: bake its offset in, and let it carry the orbital rings.
    G.billFixed = mergeGeometries([
        placed(G.billUpper, 0, -0.0020, 0.0296, -0.06, 0, 0),
        orbitalGeo,
    ]);

    const SHOULDER = V3(0.0480, 0.1960, 0.0540);

    /** The folded wing: a lofted shell over the flank, thinning as it goes. */
    function foldedWingGeo(side) {
        const U = 20, TH = 12;
        const pos = [], uvs = [], idx = [];
        for (let i = 0; i <= U; i++) {
            const u = i / U;
            const cy = 0.1950 - 0.0320 * u - 0.0310 * u * u;
            const cz = 0.0640 - 0.2790 * u;
            const cx = side * (0.0515 * (1 - 0.62 * u * u));
            const ry = 0.0615 * Math.pow(Math.sin(Math.PI * (0.15 + 0.80 * u)), 0.66) * (1 - 0.97 * u * u * u);
            const rx = 0.0178 * (1 - 0.96 * u * u);
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
        {   // Weld the seam's normals, or a crease runs the length of the wing.
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
        // Built in body coordinates, then dropped onto the shoulder pivot, so
        // the rig can lift the whole wing without the geometry sliding.
        g.translate(-side * SHOULDER.x, -SHOULDER.y, -SHOULDER.z);
        return g;
    }
    G.wingL = foldedWingGeo(-1);
    G.wingR = foldedWingGeo(1);

    function primariesGeo(side) {
        const parts = [];
        for (let k = 0; k < 6; k++) {
            const t = k / 5;
            parts.push(placed(
                featherGeo(lerp(0.096, 0.150, t), 0.0178, 0.0056, 0.008),
                side * (0.0320 - t * 0.0072), 0.1545 - t * 0.0058, -0.1105,
                -0.06 - t * 0.05, side * (0.26 - t * 0.24), side * (0.20 - t * 0.09)
            ));
        }
        const g = mergeGeometries(parts);
        g.translate(-side * SHOULDER.x, -SHOULDER.y, -SHOULDER.z);
        return g;
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
                featherGeo(0.146 - Math.abs(t) * 0.020, 0.0208, 0.0138, 0.004),
                t * 0.0050, -Math.abs(t) * 0.0026, 0,
                -0.05 + Math.abs(t) * 0.02, t * 0.22, t * 0.11
            ));
        }
        parts.push(placed(new THREE.SphereGeometry(0.027, 10, 8), 0, 0.0040, 0.0100).scale(1.0, 0.72, 1.5));
        return mergeGeometries(parts);
    })();

    G.tarsus = sweep([
        V3(0, 0.000, 0.000), V3(0, -0.014, -0.0058), V3(0, -0.030, -0.0054),
        V3(0, -0.046, -0.0014), V3(0, -0.0530, 0.0022),
    ], (t) => lerp(0.0096, 0.0055, t), 10);

    G.foot = (() => {
        const parts = [];
        const TOES = [{ yaw: 0.00, len: 0.0350 }, { yaw: 0.52, len: 0.0322 }, { yaw: -0.52, len: 0.0322 }];
        for (const toe of TOES) {
            const pts = [];
            for (let i = 0; i < 5; i++) {
                const t = i / 4;
                pts.push(V3(Math.sin(toe.yaw) * toe.len * t, -t * t * 0.0058, Math.cos(toe.yaw) * toe.len * t));
            }
            parts.push(sweep(pts, (t) => lerp(0.0043, 0.0023, t), 7));
            parts.push(placed(new THREE.ConeGeometry(0.0022, 0.0088, 6),
                pts[4].x, pts[4].y, pts[4].z, Math.PI / 2 + 0.9, toe.yaw, 0));
        }
        // The hind toe, and the webs between the front three.
        parts.push(sweep([V3(0, 0, 0), V3(0, -0.0034, -0.0118), V3(0, -0.0060, -0.0205)],
            (t) => lerp(0.0037, 0.0020, t), 6));
        for (const s of [-1, 1]) {
            const web = new THREE.BufferGeometry();
            const a = V3(0, 0, 0.002);
            const b = V3(0, -0.0058, 0.0350);
            const c = V3(Math.sin(s * 0.52) * 0.0322, -0.0058, Math.cos(0.52) * 0.0322);
            const mid = V3((b.x + c.x) * 0.5 * 0.72, -0.0034, (b.z + c.z) * 0.5 * 0.80);
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

    /* --- Two sets of feathers: an adult, and a first-year ---------- */
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
            // Adult silver gull: bill, legs and eye-ring all the same hot red.
            bill: new THREE.MeshStandardMaterial({
                color: srgb(juv ? 0x4a382a : 0xd2331d), roughness: juv ? 0.62 : 0.32,
                metalness: 0.05, envMapIntensity: 0.9,
            }),
            gape: new THREE.MeshStandardMaterial({
                color: srgb(0x7e1e16), roughness: 0.34, side: THREE.DoubleSide,
            }),
            leg: new THREE.MeshStandardMaterial({
                color: srgb(juv ? 0x69523f : 0xd9452a), roughness: 0.52, metalness: 0.04, envMapIntensity: 0.7,
            }),
            iris: new THREE.MeshStandardMaterial({
                color: srgb(juv ? 0x6b5640 : 0xf7f5eb), roughness: 0.20, envMapIntensity: 1.5,
            }),
            pupil: new THREE.MeshStandardMaterial({ color: srgb(0x06070a), roughness: 0.10 }),
        };
    }
    const MATS = { adult: plumage(false), juv: plumage(true) };

    /** One bird, feet at the origin, facing +z. Returns the rig the brain drives. */
    function makeGull(kind, scale) {
        const M = MATS[kind];
        const root = new THREE.Group();

        // Everything above the ankles, so the whole bird can crouch, pitch into
        // a threat and bob as it walks without its feet leaving the timber.
        const carriage = new THREE.Group();
        root.add(carriage);

        const body = new THREE.Mesh(G.body, M.body);
        body.castShadow = body.receiveShadow = true;
        carriage.add(body);

        // The neck, in three lengths that stretch. Rest is a folded S; run them
        // out and straighten them and the bird has a column instead.
        const neckA = new THREE.Group();
        neckA.position.copy(NECK_BASE);
        carriage.add(neckA);
        const segA = new THREE.Mesh(NECK.A.geo, M.body);
        segA.castShadow = true;
        neckA.add(segA);

        const neckB = new THREE.Group();
        neckA.add(neckB);
        const segB = new THREE.Mesh(NECK.B.geo, M.body);
        segB.castShadow = true;
        neckB.add(segB);

        const neckC = new THREE.Group();
        neckB.add(neckC);
        const segC = new THREE.Mesh(NECK.C.geo, M.body);
        segC.castShadow = true;
        neckC.add(segC);

        const head = new THREE.Group();
        neckC.add(head);

        const skull = new THREE.Mesh(G.head, M.body);
        skull.castShadow = true;
        head.add(skull);

        const billFixed = new THREE.Mesh(G.billFixed, M.bill);
        billFixed.castShadow = true;
        head.add(billFixed);

        const gape = new THREE.Mesh(G.gape, M.gape);
        gape.position.set(0, -0.0054, 0.0296);
        head.add(gape);

        const jaw = new THREE.Group();               // only the lower mandible swings
        jaw.position.set(0, -0.0020, 0.0296);
        jaw.rotation.x = -0.06;
        head.add(jaw);
        const billLower = new THREE.Mesh(G.billLower, M.bill);
        billLower.position.set(0, -0.0050, 0.0010);
        jaw.add(billLower);

        head.add(new THREE.Mesh(G.iris, M.iris));
        head.add(new THREE.Mesh(G.pupil, M.pupil));
        const lid = new THREE.Mesh(G.lid, M.body);
        lid.position.set(0, EYE.y, EYE.z);
        head.add(lid);

        const wings = [];
        for (const side of [-1, 1]) {
            const w = new THREE.Group();
            w.position.set(side * SHOULDER.x, SHOULDER.y, SHOULDER.z);
            carriage.add(w);
            const shell = new THREE.Mesh(side < 0 ? G.wingL : G.wingR, M.wing);
            shell.castShadow = shell.receiveShadow = true;
            w.add(shell);
            const prim = new THREE.Mesh(side < 0 ? G.primL : G.primR, M.prim);
            prim.castShadow = true;
            w.add(prim);
            wings.push(w);
        }

        const tailPivot = new THREE.Group();
        tailPivot.position.set(0, 0.1650, -0.1150);
        carriage.add(tailPivot);
        const tail = new THREE.Mesh(G.tail, M.tail);
        tail.castShadow = true;
        tailPivot.add(tail);

        // The legs hang off the root, not the carriage: a bird that crouches
        // folds down over its feet, it does not push its feet into the timber.
        const legs = [];
        for (const side of [-1, 1]) {
            const hip = new THREE.Group();
            hip.position.set(side * 0.0265, 0.0580, -0.0055);
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
            root, carriage, body, neckA, neckB, neckC, segA, segB, segC,
            head, jaw, gape, lid, wings, tailPivot, legs, scale,
        };
    }

    /* ==========================================================
       9 · Who is on the pontoon
       ========================================================== */

    const GULLS = [];

    /**
     * A bird, where it lives on the deck, and the small set of numbers the
     * argument writes into: where it wants to be, how it is standing, what its
     * neck and its mouth are doing. Everything eases, so nothing snaps.
     *
     * The part group is where a person's hands get to put it; the sim drives
     * the motion group inside it, so a bird that has been picked up and set
     * down somewhere else goes on having the same argument there.
     */
    function addGull(name, kind, scale, hx, hz, hy, heading, role, parent) {
        const rig = makeGull(kind, scale);
        const part = new THREE.Group();
        part.position.set(hx, hy, hz);
        const motion = new THREE.Group();
        motion.add(rig.root);
        part.add(motion);
        parent.add(world.ghost(world.part(name, part)));

        const g = {
            name, rig, part, motion, role, kind,
            home: V2(hx, hz),
            pos: V2(hx, hz),
            heading, speed: 0, gait: 0, stepPhase: rnd() * TAU,
            // Posture, current and wanted. nA/nB/nC are the angles the three
            // lengths of neck stand at, from straight up; stretch is how far
            // the concertina is run out.
            nA: 0.55, nAT: 0.55,
            nB: 0.15, nBT: 0.15,
            nC: 0.40, nCT: 0.40,
            stretch: 0.12, stretchT: 0.12,
            headPitch: 0.12, headPitchT: 0.12,
            headYaw: 0, headYawT: 0,
            neckYaw: 0, neckYawT: 0,
            jaw: 0, jawT: 0,
            crouch: 0, crouchT: 0,
            bodyPitch: 0.06, bodyPitchT: 0.06,
            wing: 0, wingT: 0,
            flap: 0,
            tailUp: 0, tailUpT: 0,
            lid: 0, blinkTimer: rr(1.0, 5.0),
            timer: rr(0.2, 1.6), mode: 'idle',
            notePhase: 0, peckPhase: rnd(),
            peckRate: rr(1.35, 1.75),
            food: V2(hx, hz),
            wobble: rnd() * TAU,
        };
        GULLS.push(g);
        return g;
    }

    // The one doing the yelling: a full adult, red bill, red legs, no patience.
    const YELL = addGull('gull_00', 'adult', 1.16, CC.x + 0.05, CC.y + 1.42, DECK_Y, -2.5, 'yeller', pontoon);
    // The one it is yelling at: this year's bird, brown still across the wing.
    const RUN = addGull('gull_01', 'juv', 1.00, CC.x + RUN_RX, CC.y, DECK_Y, 1.0, 'runner', pontoon);
    // And three with their heads down, who could not care less.
    const FEEDERS = [
        addGull('gull_02', 'adult', 1.10, CHIPS.x - 0.46, CHIPS.y - 0.34, DECK_Y, 0.65, 'feeder', pontoon),
        addGull('gull_03', 'adult', 1.06, CHIPS.x + 0.10, CHIPS.y + 0.52, DECK_Y, -1.85, 'feeder', pontoon),
        addGull('gull_04', 'juv', 0.99, CHIPS.x - 0.52, CHIPS.y + 0.40, DECK_Y, -0.55, 'feeder', pontoon),
    ];
    // One up on a pile, out of it, watching it happen from a thing that is not
    // moving — which on a pontoon is the whole luxury of a pile.
    const WATCH = addGull('gull_05', 'adult', 1.09, PILE_X, PILE_Z, PILE_TOP + 0.045, -2.1, 'watcher', scene);

    for (let i = 0; i < FEEDERS.length; i++) {
        const f = FEEDERS[i];
        // Each has its own square inch of the spill, so three birds do not all
        // stab at the same chip.
        f.food.set(lerp(f.home.x, CHIPS.x, 0.70) + rr(-0.12, 0.12),
            lerp(f.home.y, CHIPS.y, 0.70) + rr(-0.12, 0.12));
        f.peckPhase = rnd();
    }

    // One of them has actually got a chip, which is the entire cause of this.
    {
        const held = new THREE.Mesh(chipGeo, MAT.chip);
        held.position.set(0.005, -0.0072, 0.030);
        held.rotation.set(0, 1.30, 0.14);
        held.scale.setScalar(1.12);
        held.castShadow = true;
        FEEDERS[0].rig.jaw.add(held);
    }

    // The runner starts on the ring it is going to spend the afternoon on.
    let runAngle = 0, runDir = 1, runPanic = 0;

    /* ==========================================================
       10 · Gulls in the air, because the smell carries
       ========================================================== */

    const FLYERS = [];
    {
        /** The inner wing: shoulder to wrist, cambered, uv running with chord. */
        function innerWingGeo(side) {
            const NU = 5, NV = 5;
            const pos = [], uvs = [], idx = [];
            for (let i = 0; i <= NU; i++) {
                const u = i / NU;
                const x = side * u * 0.135;
                const lead = 0.055 - u * 0.012, trail = -0.075 - u * 0.020;
                for (let j = 0; j <= NV; j++) {
                    const v = j / NV;
                    const z = lerp(lead, trail, v);
                    const camber = Math.sin(v * Math.PI) * 0.013 * (1 - u * 0.3);
                    pos.push(x, camber + u * 0.006, z);
                    uvs.push(v, u * 0.28);
                }
            }
            const row = NV + 1;
            for (let i = 0; i < NU; i++)
                for (let j = 0; j < NV; j++) {
                    const a = i * row + j, b = a + row;
                    if (side > 0) idx.push(a, a + 1, b, b, a + 1, b + 1);
                    else idx.push(a, b, a + 1, b, b + 1, a + 1);
                }
            const g = new THREE.BufferGeometry();
            g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
            g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
            g.setIndex(idx);
            g.computeVertexNormals();
            return g;
        }
        /** The hand: a short panel, then ten primaries fanned off the end. */
        function outerWingGeo(side) {
            const parts = [];
            const NU = 4, NV = 4;
            const pos = [], uvs = [], idx = [];
            for (let i = 0; i <= NU; i++) {
                const u = i / NU;
                const x = side * u * 0.085;
                const lead = 0.043 - u * 0.014, trail = -0.095 + u * 0.030;
                for (let j = 0; j <= NV; j++) {
                    const v = j / NV;
                    pos.push(x, u * 0.004, lerp(lead, trail, v));
                    uvs.push(v, 0.30 + u * 0.14);
                }
            }
            const row = NV + 1;
            for (let i = 0; i < NU; i++)
                for (let j = 0; j < NV; j++) {
                    const a = i * row + j, b = a + row;
                    if (side > 0) idx.push(a, a + 1, b, b, a + 1, b + 1);
                    else idx.push(a, b, a + 1, b, b + 1, a + 1);
                }
            const g = new THREE.BufferGeometry();
            g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
            g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
            g.setIndex(idx);
            g.computeVertexNormals();
            parts.push(g);
            for (let k = 0; k < 9; k++) {
                const t = k / 8;
                const len = lerp(0.175, 0.105, Math.pow(t, 0.85));
                parts.push(placed(
                    featherGeo(len, 0.0165, 0.0060, 0.006),
                    side * (0.085 - t * 0.006), 0.004, lerp(0.030, -0.062, t),
                    0, side * (Math.PI / 2 - lerp(0.10, 0.95, t)), side * lerp(0.05, -0.12, t)
                ));
            }
            return mergeGeometries(parts);
        }

        const IN_L = innerWingGeo(-1), IN_R = innerWingGeo(1);
        const OUT_L = outerWingGeo(-1), OUT_R = outerWingGeo(1);

        // A bird in the air has nothing to say and nothing to pick up, so it
        // gets none of the rig: neck, skull, tail and trailing legs are all
        // baked into two meshes, and only the wings are still joints. Six draws
        // instead of twenty, at ten metres, where nobody can tell.
        const FLIGHT_HEAD = V3(0, 0.2560, 0.1220), FLIGHT_PITCH = 0.14;
        const flightBody = (() => {
            const pts = [V3(0, NECK_BASE.y, NECK_BASE.z)];
            let y = NECK_BASE.y, z = NECK_BASE.z;
            for (const phi of [1.05, 0.85, 0.62, 0.45]) {
                y += Math.cos(phi) * 0.028;
                z += Math.sin(phi) * 0.028;
                pts.push(V3(0, y, z));
            }
            return mergeGeometries([
                G.body,
                sweep(pts, (t) => lerp(0.0455, 0.0262, t), 12, true),
                placed(G.head, FLIGHT_HEAD.x, FLIGHT_HEAD.y, FLIGHT_HEAD.z, FLIGHT_PITCH, 0, 0),
                placed(G.tail, 0, 0.1650, -0.1150, 0.12, 0, 0),
            ]);
        })();
        // Bill and trailing legs share a mesh: on a silver gull they are the
        // same red anyway, and at this distance nobody is checking.
        const flightRed = mergeGeometries([
            placed(G.billFixed, FLIGHT_HEAD.x, FLIGHT_HEAD.y, FLIGHT_HEAD.z, FLIGHT_PITCH, 0, 0),
            placed(G.billLower, FLIGHT_HEAD.x, FLIGHT_HEAD.y - 0.0068, FLIGHT_HEAD.z + 0.0296, FLIGHT_PITCH - 0.03, 0, 0),
            ...[-1, 1].map(s => placed(G.tarsus, s * 0.0265, 0.0580, -0.0055, -2.35, 0, 0)),
            ...[-1, 1].map(s => placed(G.foot, s * 0.0265, 0.0930, -0.0980, -1.20, 0, 0)),
        ]);

        for (let i = 0; i < 3; i++) {
            const kind = i === 2 ? 'juv' : 'adult';
            const M = MATS[kind];
            const bird = new THREE.Group();
            bird.scale.setScalar(rr(1.02, 1.14));
            const body = new THREE.Mesh(flightBody, M.body);
            body.castShadow = true;
            bird.add(body);
            bird.add(new THREE.Mesh(flightRed, M.bill));

            const arms = [];
            for (const side of [-1, 1]) {
                const inner = new THREE.Group();
                inner.position.set(side * SHOULDER.x * 0.7, SHOULDER.y - 0.004, SHOULDER.z - 0.030);
                bird.add(inner);
                const shell = new THREE.Mesh(side < 0 ? IN_L : IN_R, M.wing);
                shell.castShadow = true;
                inner.add(shell);
                const outer = new THREE.Group();
                outer.position.set(side * 0.135, 0.006, -0.014);
                inner.add(outer);
                outer.add(new THREE.Mesh(side < 0 ? OUT_L : OUT_R, M.prim));
                arms.push({ inner, outer, side });
            }
            const holder = new THREE.Group();
            holder.add(bird);
            scene.add(world.ghost(holder));
            FLYERS.push({
                bird, arms, holder,
                radius: rr(7.5, 15.0), height: rr(4.2, 9.5), phase: rr(0, TAU),
                omega: rr(0.14, 0.26) * (i % 2 ? -1 : 1),
                flapPhase: rr(0, TAU), flapRate: rr(2.3, 3.1),
                glide: rr(0.3, 0.8), bob: rr(0.5, 1.1),
            });
        }
    }

    /* ==========================================================
       11 · Water off the hull, and one feather nobody is going to miss
       ========================================================== */

    const SPRAY_N = 40;
    const sprayPos = new Float32Array(SPRAY_N * 3);
    const sprayVel = new Float32Array(SPRAY_N * 3);
    const sprayLife = new Float32Array(SPRAY_N);
    const sprayGeo = new THREE.BufferGeometry();
    {
        for (let i = 0; i < SPRAY_N; i++) sprayPos[i * 3 + 1] = -80;
        sprayGeo.setAttribute('position', new THREE.BufferAttribute(sprayPos, 3));
        const spray = new THREE.Points(sprayGeo, new THREE.PointsMaterial({
            map: puffTex, size: 0.085, transparent: true, depthWrite: false,
            opacity: 0.75, sizeAttenuation: true, color: 0xffffff, fog: true,
        }));
        spray.frustumCulled = false;
        scene.add(world.ghost(spray));
    }

    const looseFeather = new THREE.Mesh(
        featherGeo(0.085, 0.016, 0.006, 0.010),
        new THREE.MeshStandardMaterial({ map: wingTexAdult, side: THREE.DoubleSide, roughness: 0.85 })
    );
    looseFeather.position.set(1.9, DECK_Y + 0.45, 0.8);
    scene.add(world.ghost(looseFeather));

    /* ==========================================================
       12 · The argument
       ========================================================== */

    const DECK_LIM_X = HX - 0.30, DECK_LIM_Z = HZ - 0.28;
    const _a2 = V2(0, 0), _b2 = V2(0, 0);

    /** Where the runner is on its ring, and which way it is pointing. */
    function ovalAt(angle, out) {
        out.set(CC.x + Math.cos(angle) * RUN_RX, CC.y + Math.sin(angle) * RUN_RZ);
        return out;
    }

    function steer(g, tx, tz, speed, turnRate, dt) {
        const dx = tx - g.pos.x, dz = tz - g.pos.y;
        const want = Math.atan2(dx, dz);
        const turn = wrapPi(want - g.heading);
        g.heading += clamp(turn, -turnRate * dt, turnRate * dt);
        // A bird that is turning hard is not running flat out.
        const eff = speed * (1 - Math.min(0.45, Math.abs(turn) * 0.30));
        g.speed = ease(g.speed, eff, 6, dt);
        g.pos.x += Math.sin(g.heading) * g.speed * dt;
        g.pos.y += Math.cos(g.heading) * g.speed * dt;
        g.pos.x = clamp(g.pos.x, -DECK_LIM_X, DECK_LIM_X);
        g.pos.y = clamp(g.pos.y, -DECK_LIM_Z, DECK_LIM_Z);
    }

    /** The five notes, and the head coming down on every one of them. */
    function longCall(g, dt) {
        g.notePhase += dt * 3.05;
        const n = Math.floor(g.notePhase);
        const frac = g.notePhase - n;
        if (n < 5) {
            const pump = Math.pow(Math.sin(frac * Math.PI), 0.65);
            // Neck run right out and straight up: three lengths of it, none
            // standing more than a few degrees off vertical. This is the shape
            // of the whole world.
            g.stretchT = 1.0 - pump * 0.11;      // and the column drops on each note
            g.nAT = -0.04 + pump * 0.13;
            g.nBT = 0.00 + pump * 0.06;
            g.nCT = -0.05 + pump * 0.11;
            // And the skull folded over the top of it, bill swung down the front
            // of the column and driven further over with every note.
            g.headPitchT = 1.32 + pump * 0.62;
            g.jawT = 0.30 + pump * 0.70;
            g.crouchT = pump * 0.30;
            g.bodyPitchT = 0.02 + pump * 0.10;
            g.tailUpT = 0.12 + pump * 0.20;
            g.wingT = pump * 0.16;
            return true;
        }
        // The tail of the call: the neck comes down but not all the way, because
        // it is going to be needed again in about two seconds.
        g.stretchT = 0.62;
        g.nAT = 0.30; g.nBT = 0.26; g.nCT = 0.40;
        g.headPitchT = 0.55;
        g.jawT = 0.05;
        g.crouchT = 0;
        g.tailUpT = 0.08;
        g.wingT = 0;
        return false;
    }

    function updateBrain(g, dt, t) {
        g.timer -= dt;

        if (g.role === 'runner') {
            // Round and round: the ring is the whole plan, and the only decision
            // left is how fast and, once in a while, which way.
            const dist = Math.hypot(YELL.pos.x - g.pos.x, YELL.pos.y - g.pos.y);
            runPanic = ease(runPanic, clamp(1.6 - dist * 0.62, 0.12, 1.0), 3.5, dt);
            const omega = lerp(0.86, 1.86, runPanic);
            runAngle += runDir * omega * dt;
            ovalAt(runAngle + runDir * 0.22, _a2);
            const prev = _b2.copy(g.pos);
            ovalAt(runAngle, g.pos);
            const step = Math.hypot(g.pos.x - prev.x, g.pos.y - prev.y);
            g.speed = dt > 0 ? step / dt : 0;
            g.heading += wrapPi(Math.atan2(_a2.x - g.pos.x, _a2.y - g.pos.y) - g.heading) * (1 - Math.exp(-12 * dt));

            // Cut off on the near side of the ring? Then round the other way,
            // which never works, and it does it anyway.
            if (dist < 0.62 && g.timer <= 0) {
                const ahead = Math.cos(wrapPi(Math.atan2(YELL.pos.x - g.pos.x, YELL.pos.y - g.pos.y) - g.heading));
                if (ahead > 0.25 && rnd() < 0.7) { runDir *= -1; g.timer = 1.6; }
                else g.timer = 0.5;
            }

            g.gait = 1;
            // Running: the neck comes out and forward, and the faster it goes
            // the flatter and further out in front of itself the bird gets.
            g.stretchT = lerp(0.34, 0.64, runPanic);
            g.nAT = lerp(0.58, 0.44, runPanic);
            g.nBT = lerp(0.64, 0.56, runPanic);
            g.nCT = lerp(0.80, 0.64, runPanic);
            g.headPitchT = lerp(0.26, 0.10, runPanic);
            g.bodyPitchT = lerp(0.14, 0.30, runPanic);
            g.tailUpT = lerp(0.20, 0.62, runPanic);   // tail cocked, which is panic said out loud
            g.wingT = lerp(0.10, 0.60, runPanic);
            g.crouchT = 0.1;
            // A short protest every so often, mid-stride.
            g.jawT = (runPanic > 0.55 && Math.sin(t * 7.3 + g.wobble) > 0.86) ? 0.55 : 0.0;
            g.headYawT = Math.sin(t * 1.7 + g.wobble) * 0.18 - 0.22 * runDir;
            return;
        }

        if (g.role === 'yeller') {
            if (g.mode === 'idle') { g.mode = 'call'; g.timer = 2.9; g.notePhase = 0; }

            const dx = RUN.pos.x - g.pos.x, dz = RUN.pos.y - g.pos.y;
            const dist = Math.hypot(dx, dz);

            if (g.mode !== 'lunge' && dist < 0.46) { g.mode = 'lunge'; g.timer = 0.55; }

            let speed = 1.62;
            if (g.mode === 'call') {
                const calling = longCall(g, dt);
                // Yelling costs it the chase. That is the joke and the physics.
                speed = calling ? 1.16 : 1.55;
                if (g.timer <= 0) { g.mode = 'chase'; g.timer = rr(1.5, 2.8); }
            } else if (g.mode === 'lunge') {
                // Neck thrown forward instead of up, bill wide open, and a
                // hop-step that never quite lands on anybody.
                speed = 2.15;
                g.stretchT = 0.86;
                g.nAT = 1.00; g.nBT = 1.30; g.nCT = 1.48;
                g.headPitchT = 0.34;
                g.jawT = 0.92;
                g.bodyPitchT = 0.40;
                g.wingT = 0.52;
                g.tailUpT = 0.30;
                g.crouchT = 0.25;
                if (g.timer <= 0) { g.mode = 'call'; g.timer = 2.9; g.notePhase = 0; }
            } else {
                // Between calls: head forward, bill shut, gaining — briefly.
                g.stretchT = 0.46;
                g.nAT = 0.46; g.nBT = 0.44; g.nCT = 0.58;
                g.headPitchT = 0.18;
                g.jawT = Math.sin(t * 9.1) > 0.90 ? 0.4 : 0.0;
                g.bodyPitchT = 0.26;
                g.wingT = 0.14;
                g.tailUpT = 0.24;
                g.crouchT = 0.08;
                if (g.timer <= 0) { g.mode = 'call'; g.timer = 2.9; g.notePhase = 0; }
            }

            // Pure pursuit, with a cut across the ring, which is why it spends
            // its afternoon a quarter of a lap behind something smaller.
            const lead = 0.34;
            let tx = RUN.pos.x + Math.sin(RUN.heading) * RUN.speed * lead;
            let tz = RUN.pos.y + Math.cos(RUN.heading) * RUN.speed * lead;
            tx = lerp(tx, CC.x, 0.16); tz = lerp(tz, CC.y, 0.16);
            steer(g, tx, tz, speed, 3.4, dt);
            // It goes round the feeding birds rather than through them — not out
            // of manners, but because they would have something to say about it.
            for (let i = 0; i < FEEDERS.length; i++) {
                const f = FEEDERS[i];
                const sx = g.pos.x - f.pos.x, sz = g.pos.y - f.pos.y;
                const d = Math.hypot(sx, sz);
                if (d > 1e-3 && d < 0.34) {
                    g.pos.x += (sx / d) * (0.34 - d);
                    g.pos.y += (sz / d) * (0.34 - d);
                }
            }
            g.gait = 1;
            g.headYawT = clamp(wrapPi(Math.atan2(dx, dz) - g.heading), -0.5, 0.5) * 0.5;
            return;
        }

        if (g.role === 'feeder') {
            // Head down. Something is happening about a metre away and it is
            // none of their business.
            g.peckPhase += dt * g.peckRate;
            const s = g.peckPhase % 1;
            const down = Math.pow(Math.sin(clamp(s * 1.35, 0, 1) * Math.PI), 1.4);
            const toss = s > 0.86 ? smooth(0.86, 0.95, s) * (1 - smooth(0.95, 1.0, s)) : 0;

            g.gait = 0;
            // The neck arches over and the bill comes down onto the timber; the
            // toss at the end of the cycle is the chip going back down the neck.
            g.stretchT = 0.25 + down * 0.32;
            g.nAT = 1.00 + down * 0.30;
            g.nBT = 1.85 + down * 0.50;
            g.nCT = 2.30 + down * 0.65 - toss * 0.95;
            g.headPitchT = 0.95 + down * 0.35 - toss * 1.15;
            g.jawT = down > 0.75 ? 0.5 : (toss > 0.2 ? 0.35 : 0.04);
            g.bodyPitchT = 0.30 + down * 0.10;
            g.crouchT = 0.18 + down * 0.16;
            g.tailUpT = 0.18;
            g.wingT = 0;
            g.headYawT = Math.sin(g.peckPhase * 2.1 + g.wobble) * 0.30;

            if (g.timer <= 0) {
                // Shuffle to another bit of the spill now and then, and squabble
                // with whoever is nearest without ever raising its head.
                g.mode = rnd() < 0.34 ? 'shuffle' : 'peck';
                g.timer = g.mode === 'shuffle' ? rr(0.5, 1.1) : rr(1.8, 4.2);
                if (g.mode === 'shuffle')
                    // Never east of the parcel: that side of it is a racetrack.
                    g.food.set(CHIPS.x + rr(-0.44, 0.22), CHIPS.y + rr(-0.40, 0.40));
            }
            if (g.mode === 'shuffle') {
                steer(g, g.food.x, g.food.y, 0.34, 2.2, dt);
                g.gait = 0.7;
                g.stretchT = 0.30;
                g.nAT = 0.86; g.nBT = 1.30; g.nCT = 1.62;
                g.headPitchT = 0.72;
            } else {
                g.speed = ease(g.speed, 0, 8, dt);
                // Feet still, but the deck under them is not, so they trim.
                g.heading += Math.sin(t * 0.7 + g.wobble) * 0.10 * dt;
            }
            return;
        }

        // The watcher, up the pile: does nothing, misses nothing.
        g.gait = 0;
        g.speed = 0;
        const toRunner = Math.atan2(RUN.pos.x - g.pos.x, RUN.pos.y - g.pos.y);
        g.headYawT = clamp(wrapPi(toRunner - g.heading), -1.1, 1.1);
        if (g.timer <= 0) {
            g.mode = pick(['stand', 'stand', 'preen', 'shake', 'stand']);
            g.timer = g.mode === 'stand' ? rr(2.4, 6.0) : rr(1.0, 2.0);
        }
        if (g.mode === 'preen') {
            // Head round and down into the flank, working at something.
            g.stretchT = 0.34;
            g.nAT = 1.05; g.nBT = 1.75; g.nCT = 2.15;
            g.headPitchT = 1.15;
            g.headYawT = 0.95 * (Math.sin(t * 1.3) > 0 ? 1 : -1);
            g.jawT = Math.sin(t * 11.0) > 0.4 ? 0.32 : 0.06;
            g.wingT = 0.10;
        } else if (g.mode === 'shake') {
            g.stretchT = 0.34;
            g.nAT = 0.34 + Math.sin(t * 22) * 0.10;
            g.nBT = 0.20; g.nCT = 0.36;
            g.headPitchT = 0.08;
            g.headYawT += Math.sin(t * 24) * 0.22;
            g.wingT = 0.30 + Math.sin(t * 18) * 0.12;
            g.jawT = 0;
        } else {
            g.stretchT = 0.32;
            g.nAT = 0.50; g.nBT = 0.16; g.nCT = 0.42;
            g.headPitchT = 0.14;
            g.wingT = 0;
            g.jawT = (Math.sin(t * 0.7 + g.wobble) > 0.985) ? 0.5 : 0;
        }
        g.bodyPitchT = 0.06;
        g.crouchT = 0.05;
        g.tailUpT = 0.12 + Math.sin(t * 0.6 + g.wobble) * 0.05;
    }

    /** Everything the brain decided, put into the bones. */
    function poseGull(g, dt, t) {
        const rig = g.rig;

        g.nA = ease(g.nA, g.nAT, 9, dt);
        g.nB = ease(g.nB, g.nBT, 9, dt);
        g.nC = ease(g.nC, g.nCT, 10, dt);
        g.stretch = ease(g.stretch, g.stretchT, 8.5, dt);
        g.headPitch = ease(g.headPitch, g.headPitchT, 11, dt);
        g.headYaw = ease(g.headYaw, g.headYawT, 6.5, dt);
        g.jaw = ease(g.jaw, g.jawT, 16, dt);
        g.crouch = ease(g.crouch, g.crouchT, 8, dt);
        g.bodyPitch = ease(g.bodyPitch, g.bodyPitchT, 7, dt);
        g.wing = ease(g.wing, g.wingT, 9, dt);
        g.tailUp = ease(g.tailUp, g.tailUpT, 8, dt);

        // The three lengths of neck, run out and pulled back in. A stretched
        // neck is a thinner neck: the feathers have to cover more of it.
        const la = lerp(NECK.A.rest, NECK.A.call, g.stretch);
        const lb = lerp(NECK.B.rest, NECK.B.call, g.stretch);
        const lc = lerp(NECK.C.rest, NECK.C.call, g.stretch);
        // A neck run out to two and a half times its resting length is a much
        // thinner neck: the same feathers have that much more to cover.
        const thin = lerp(1.0, 0.70, g.stretch);
        rig.segA.scale.set(thin, la, thin);
        rig.neckB.position.y = la;
        rig.segB.scale.set(thin, lb, thin);
        rig.neckC.position.y = lb;
        rig.segC.scale.set(thin, lc, thin);
        rig.head.position.y = lc;

        // nA/nB/nC are the angle each length of neck stands at, measured from
        // straight up, and headPitch is where the bill points: 0 is level, a
        // right angle is straight down. Absolute, because that is how a posture
        // is actually described — the differences are what the joints get, and
        // the body's own pitch comes out of the first one so that leaning
        // forward does not swing the head with it.
        rig.neckA.rotation.set(g.nA - g.bodyPitch, g.headYaw * 0.35, 0);
        rig.neckB.rotation.set(g.nB - g.nA, g.headYaw * 0.20, 0);
        rig.neckC.rotation.set(g.nC - g.nB, g.headYaw * 0.20, 0);
        rig.head.rotation.set(g.headPitch - g.nC, g.headYaw * 0.45, 0);

        rig.jaw.rotation.x = -0.06 - g.jaw * 0.66;
        rig.gape.visible = g.jaw > 0.04;
        rig.gape.rotation.x = -g.jaw * 0.33;
        rig.gape.scale.set(1, 1, 0.35 + g.jaw * 0.9);

        // Blink. Nothing needs it, and everything looks dead without it.
        g.blinkTimer -= dt;
        if (g.blinkTimer < 0) { g.blinkTimer = rr(1.6, 6.5); g.lid = 1; }
        g.lid = ease(g.lid, 0, 11, dt);
        rig.lid.rotation.x = -Math.PI / 2 + g.lid * Math.PI * 0.92;

        // Walking. The gait is one number; everything below it follows.
        const strideLen = 0.16 * rig.scale;
        g.stepPhase += (g.speed / strideLen) * dt * g.gait;
        const bob = g.gait * clamp(g.speed * 0.9, 0, 1);
        for (let i = 0; i < rig.legs.length; i++) {
            const leg = rig.legs[i];
            const ph = g.stepPhase + (i === 0 ? 0 : Math.PI);
            const swing = Math.sin(ph) * 0.62 * bob;
            const lift = Math.max(0, Math.sin(ph)) * 0.30 * bob;
            leg.hip.rotation.x = swing + g.crouch * 0.25 + g.bodyPitch * 0.30;
            leg.hip.scale.setScalar(1 - lift * 0.16);
            leg.foot.rotation.x = -leg.hip.rotation.x * 0.90 + lift * 0.42;
        }
        rig.carriage.position.y = -g.crouch * 0.030 + Math.abs(Math.sin(g.stepPhase)) * 0.009 * bob;
        rig.carriage.position.z = g.bodyPitch * 0.010;
        rig.carriage.rotation.x = g.bodyPitch;
        rig.carriage.rotation.z = Math.sin(g.stepPhase) * 0.07 * bob;

        // Wings: half up is a whole sentence in gull.
        g.flap += dt * (6.0 + g.wing * 5.0);
        const flick = g.wing > 0.45 ? Math.sin(g.flap) * 0.16 * (g.wing - 0.45) : 0;
        for (let i = 0; i < 2; i++) {
            const side = i === 0 ? -1 : 1;
            rig.wings[i].rotation.set(-g.wing * 0.30, side * g.wing * 0.10, side * (g.wing * 0.95 + flick));
        }
        rig.tailPivot.rotation.x = -g.tailUp * 0.85 + 0.05;
        rig.tailPivot.rotation.z = Math.sin(g.stepPhase) * 0.05 * bob;

        // Where it actually is, said to the motion group rather than the part,
        // so hand placements survive.
        g.motion.position.set(g.pos.x - g.home.x, 0, g.pos.y - g.home.y);
        g.motion.rotation.y = g.heading;
    }

    /* ==========================================================
       13 · What moves
       ========================================================== */

    // Scratch state, made once. The frame callback allocates nothing.
    let heaveY = 0, heaveVY = 0, pitchZ = 0, rollX = 0, yawY = 0;
    let tinnieY = 0, tinniePitch = 0, tinnieRoll = 0;
    let featherT = rr(0, 6);

    world.frame((dt, t) => {
        uTime.value = t;
        uCamPos.value.copy(camera.position);

        for (let i = 0; i < clouds.length; i++) {
            const c = clouds[i];
            c.position.x += c.userData.drift * dt;
            if (c.position.x > 1900) c.position.x = -1900;
        }

        /* --- The pontoon, riding the water it is actually floating on --- */
        {
            const yC = waterY(0, 0, t);
            const yF = waterY(2.7, 0, t), yA = waterY(-2.7, 0, t);
            const yP = waterY(0, -1.3, t), yS = waterY(0, 1.3, t);
            // A float this size does not follow the short chop; it averages it
            // and lags behind, which is what the spring and the damping are.
            const targetY = yC * 0.82;
            // The spring is integrated on a short step even when the frame is
            // long: a stiff spring and a fat dt is how a pontoon leaves orbit.
            const h = Math.min(dt, 0.033);
            heaveVY += (targetY - heaveY) * 26.0 * h;
            heaveVY *= Math.exp(-4.2 * h);
            heaveY += heaveVY * h;
            pitchZ = ease(pitchZ, (yF - yA) / (2 * 2.7) * 0.90, 5.0, dt);
            rollX = ease(rollX, -(yS - yP) / (2 * 1.3) * 0.78, 5.5, dt);
            yawY = ease(yawY, Math.sin(t * 0.19) * 0.010 + (yF - yA) * 0.02, 2.0, dt);
            pontoon.position.y = heaveY;
            pontoon.rotation.set(rollX, yawY, pitchZ);
            // It grinds up and down the piles on its collars; the surge in the
            // mooring is a couple of centimetres and no more.
            pontoon.position.x = Math.sin(t * 0.37) * 0.017 + Math.sin(t * 0.91) * 0.008;
            pontoon.position.z = Math.sin(t * 0.29 + 1.1) * 0.020;
        }

        /* --- The gangway: hinged up there, rolling on the deck down here --- */
        {
            const deckEdgeY = DECK_Y + heaveY + Math.sin(pitchZ) * -3.3;
            const drop = clamp((JETTY_Y - 0.06) - deckEdgeY, 0.4, GANG_L * 0.92);
            gangway.rotation.z = -Math.asin(drop / GANG_L);
        }

        /* --- The tinnie, which is smaller and shows it --------------- */
        {
            const px = tinnie.position.x, pz = tinnie.position.z;
            const yC = waterY(px, pz, t);
            const yF = waterY(px + 1.4, pz, t), yA = waterY(px - 1.4, pz, t);
            const yP = waterY(px, pz - 0.6, t), yS = waterY(px, pz + 0.6, t);
            tinnieY = ease(tinnieY, yC * 0.96 - 0.06, 9.0, dt);
            tinniePitch = ease(tinniePitch, (yF - yA) / 2.8 * 0.9, 8.0, dt);
            tinnieRoll = ease(tinnieRoll, -(yS - yP) / 1.2 * 0.8 + Math.sin(t * 0.8) * 0.02, 7.0, dt);
            tinnie.position.y = tinnieY;
            tinnie.rotation.set(tinnieRoll, 0.06 + Math.sin(t * 0.23) * 0.03, tinniePitch);
        }

        /* --- The argument -------------------------------------------- */
        for (let i = 0; i < GULLS.length; i++) {
            const g = GULLS[i];
            updateBrain(g, dt, t);
            poseGull(g, dt, t);
        }

        /* --- The ones in the air ------------------------------------- */
        for (let i = 0; i < FLYERS.length; i++) {
            const f = FLYERS[i];
            f.phase += f.omega * dt;
            const x = Math.cos(f.phase) * f.radius;
            const z = Math.sin(f.phase) * f.radius * 0.82;
            const y = f.height + Math.sin(t * 0.31 + f.phase) * f.bob;
            f.holder.position.set(x, y, z);
            // Facing along the circle, banked into it.
            // atan2 of the velocity already carries the direction of travel, so
            // a bird going the other way round needs no help facing that way.
            f.holder.rotation.y = Math.atan2(-Math.sin(f.phase) * f.omega, Math.cos(f.phase) * f.omega * 0.82);
            // Banked into the turn: the outside wing comes up.
            f.holder.rotation.z = clamp(f.omega * 1.9, -0.5, 0.5);

            // A gull flaps in bursts and then rides. The rest is shoulder and wrist.
            f.flapPhase += dt * f.flapRate * (0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t * 0.27 + f.glide * 9)));
            const s = Math.sin(f.flapPhase), c = Math.cos(f.flapPhase * 1.0 - 0.7);
            for (let k = 0; k < f.arms.length; k++) {
                const arm = f.arms[k];
                arm.inner.rotation.set(0.06 - s * 0.12, 0, arm.side * (0.16 + s * 0.62));
                arm.outer.rotation.set(0, arm.side * (-0.12 - c * 0.20), arm.side * (0.10 + c * 0.55));
            }
            // The body rides its own wingbeat: nose down on the downstroke.
            f.bird.rotation.x = -0.05 - s * 0.05;
        }

        /* --- Water off the hull -------------------------------------- */
        for (let i = 0; i < SPRAY_N; i++) {
            const o = i * 3;
            sprayLife[i] -= dt;
            if (sprayLife[i] > 0) {
                sprayVel[o + 1] -= 9.81 * dt;
                sprayPos[o] += sprayVel[o] * dt;
                sprayPos[o + 1] += sprayVel[o + 1] * dt;
                sprayPos[o + 2] += sprayVel[o + 2] * dt;
                continue;
            }
            // Pick a spot on the hull and see whether the water is coming up it.
            const edge = rnd();
            let ex, ez, nx, nz;
            if (edge < 0.34) { ex = rr(-HX, HX); ez = -HZ - 0.07; nx = 0; nz = -1; }
            else if (edge < 0.68) { ex = rr(-HX, HX); ez = HZ + 0.07; nx = 0; nz = 1; }
            else if (edge < 0.84) { ex = HX + 0.07; ez = rr(-HZ, HZ); nx = 1; nz = 0; }
            else { ex = -HX - 0.07; ez = rr(-HZ, HZ); nx = -1; nz = 0; }
            const now = waterY(ex, ez, t);
            const rise = (now - waterY(ex, ez, t - 0.12)) / 0.12;
            if (rise > 0.24 && now > heaveY - 0.02) {
                sprayPos[o] = ex + nx * 0.03;
                sprayPos[o + 1] = now + 0.04;
                sprayPos[o + 2] = ez + nz * 0.03;
                sprayVel[o] = nx * rr(0.20, 0.55) + rr(-0.1, 0.1);
                sprayVel[o + 1] = rr(0.55, 1.35) * clamp(rise, 0.4, 1.6);
                sprayVel[o + 2] = nz * rr(0.20, 0.55) + rr(-0.1, 0.1);
                sprayLife[i] = rr(0.45, 0.95);
            } else {
                sprayPos[o + 1] = -80;      // parked, out of everybody's way
            }
        }
        // Forty vectors back up to the card, which is nothing.
        sprayGeo.attributes.position.needsUpdate = true;

        /* --- The one feather, going nowhere in particular ------------- */
        featherT += dt;
        {
            const fall = (featherT % 9.0) / 9.0;
            const x = 1.9 + Math.sin(featherT * 0.5) * 0.8 + fall * 1.4;
            const z = 0.8 + Math.cos(featherT * 0.37) * 0.7;
            const y = DECK_Y + 1.55 - fall * 1.45 + Math.sin(featherT * 1.7) * 0.05;
            looseFeather.position.set(x, y, z);
            looseFeather.rotation.set(
                Math.sin(featherT * 2.3) * 0.9,
                featherT * 0.8,
                Math.cos(featherT * 1.9) * 0.7
            );
        }
    });
}
