//
//  pin-board.prop.js
//  Project27 object library
//
//  A 1.2 m cork board in a pine frame, with nine things pinned to it and a
//  tenth curling off its bottom corner.
//
//  Like the clock, this hangs: its origin is the bottom of the frame, so
//  placing it puts the frame's lower edge on the ground and the room lifts it
//  to whatever the wall wants. Front toward +Z.
//
//  The notices come off one four-panel texture and each sheet takes a quadrant
//  of it, which means nine pieces of paper cost one texture and one mesh. The
//  overlaps, the tilts and the one that has come loose at a corner are what
//  make it a board somebody uses rather than a rectangle of brown.
//

import { mergeGeometries } from './BufferGeometryUtils.js';

export default function build(THREE, helpers) {
    const group = new THREE.Group();

    let seed = 77419;
    const rnd = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
    const rr = (a, b) => a + (b - a) * rnd();
    const pick = (list) => list[Math.min(list.length - 1, Math.floor(rnd() * list.length))];

    const paint = (w, h, draw) => (helpers && helpers.canvasTexture ? helpers.canvasTexture(w, h, draw) : null);
    const merge = (parts) => mergeGeometries(parts.map((g) => (g.index ? g.toNonIndexed() : g)));
    const box = (w, h, d, x, y, z) => new THREE.BoxGeometry(w, h, d).translate(x, y, z);

    function tint(geometry, colour) {
        const c = new THREE.Color(colour);
        const n = geometry.attributes.position.count;
        const data = new Float32Array(n * 3);
        for (let i = 0; i < n; i++) { data[i * 3] = c.r; data[i * 3 + 1] = c.g; data[i * 3 + 2] = c.b; }
        geometry.setAttribute('color', new THREE.Float32BufferAttribute(data, 3));
        return geometry;
    }

    const W = 1.22, H = 0.92, F = 0.045, T = 0.026;

    /* ---- cork --------------------------------------------------------------- */

    const corkTex = paint(512, 384, (g, cv) => {
        const w = cv.width, h = cv.height;
        g.fillStyle = '#b98d5a'; g.fillRect(0, 0, w, h);
        // Cork is granules, not noise: overlapping pale flakes with dark seams.
        for (let i = 0; i < 2600; i++) {
            const x = rr(0, w), y = rr(0, h);
            g.fillStyle = `rgba(${pick(['214,176,124', '150,110,66', '190,150,100', '120,86,50'])},${rr(0.25, 0.85)})`;
            g.beginPath();
            g.ellipse(x, y, rr(2, 9), rr(2, 7), rr(0, 3.14), 0, Math.PI * 2);
            g.fill();
        }
        // Thousands of old pin holes, in drifts where the notices always go.
        for (let i = 0; i < 900; i++) {
            const x = rr(0, w), y = rr(0, h);
            g.fillStyle = `rgba(58,38,20,${rr(0.15, 0.5)})`;
            g.beginPath(); g.arc(x, y, rr(0.7, 1.9), 0, Math.PI * 2); g.fill();
        }
        // Sun bleach down one side, from a window that is always on the left.
        const sun = g.createLinearGradient(0, 0, w * 0.6, 0);
        sun.addColorStop(0, 'rgba(255,238,200,0.30)');
        sun.addColorStop(1, 'rgba(255,238,200,0)');
        g.fillStyle = sun; g.fillRect(0, 0, w, h);
    });

    const pineTex = paint(256, 256, (g, cv) => {
        const s = cv.width;
        g.fillStyle = '#d8b585'; g.fillRect(0, 0, s, s);
        for (let i = 0; i < 180; i++) {
            const y = rr(0, s);
            g.strokeStyle = `rgba(${rnd() > 0.4 ? '236,208,166' : '158,118,72'},${rr(0.1, 0.4)})`;
            g.lineWidth = rr(0.6, 2.6);
            g.beginPath(); g.moveTo(-6, y);
            let py = y;
            for (let x = 0; x < s + 12; x += 22) { py += rr(-2, 2); g.lineTo(x, py); }
            g.stroke();
        }
        for (let i = 0; i < 5; i++) {
            const x = rr(0, s), y = rr(0, s);
            const knot = g.createRadialGradient(x, y, 1, x, y, rr(6, 18));
            knot.addColorStop(0, 'rgba(96,62,30,0.65)');
            knot.addColorStop(1, 'rgba(96,62,30,0)');
            g.fillStyle = knot; g.fillRect(x - 22, y - 22, 44, 44);
        }
    });
    if (pineTex) { pineTex.wrapS = pineTex.wrapT = THREE.RepeatWrapping; pineTex.repeat.set(4, 1); }

    // Four notices on one sheet: a timetable, a handwritten note, a painting,
    // and a printed poster. Each pinned sheet takes one quadrant.
    const noticeTex = paint(1024, 1024, (g, cv) => {
        const q = cv.width / 2;
        const scribble = (x, y, len, size, colour, weight) => {
            g.strokeStyle = colour; g.lineWidth = weight; g.lineJoin = 'round';
            let px = x;
            while (px < x + len) {
                const word = rr(size * 1.5, size * 4);
                g.beginPath();
                let cx = px, up = true;
                g.moveTo(cx, y);
                while (cx < px + word) {
                    const step = rr(size * 0.35, size * 0.6);
                    g.quadraticCurveTo(cx + step * 0.5, y + (up ? -size : size * 0.4), cx + step, y);
                    cx += step; up = !up;
                }
                g.stroke();
                px += word + rr(size * 0.5, size);
            }
            g.lineJoin = 'miter';
        };

        // 0,0 — a timetable grid, printed, with one row highlighted.
        g.fillStyle = '#fbfaf6'; g.fillRect(0, 0, q, q);
        g.fillStyle = '#2b4d7a'; g.fillRect(24, 24, q - 48, 54);
        g.strokeStyle = '#8e96a0'; g.lineWidth = 2;
        for (let r = 0; r <= 8; r++) {
            const y = 96 + r * ((q - 130) / 8);
            g.beginPath(); g.moveTo(24, y); g.lineTo(q - 24, y); g.stroke();
        }
        for (let c = 0; c <= 5; c++) {
            const x = 24 + c * ((q - 48) / 5);
            g.beginPath(); g.moveTo(x, 78); g.lineTo(x, q - 34); g.stroke();
        }
        g.fillStyle = 'rgba(240,208,84,0.55)';
        g.fillRect(26, 96 + 3 * ((q - 130) / 8), q - 52, (q - 130) / 8);
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 5; c++) {
                scribble(34 + c * ((q - 48) / 5), 120 + r * ((q - 130) / 8), (q - 48) / 5 - 24, 7, '#3a4048', 2);
            }
        }

        // 1,0 — a note in biro on lined paper, with a heavy underline.
        g.fillStyle = '#fefdf4'; g.fillRect(q, 0, q, q);
        g.strokeStyle = 'rgba(130,160,200,0.5)'; g.lineWidth = 1.6;
        for (let i = 1; i < 22; i++) {
            const y = i * (q / 22);
            g.beginPath(); g.moveTo(q + 20, y); g.lineTo(2 * q - 20, y); g.stroke();
        }
        g.strokeStyle = 'rgba(210,120,120,0.55)';
        g.beginPath(); g.moveTo(q + 70, 0); g.lineTo(q + 70, q); g.stroke();
        scribble(q + 84, 74, q - 190, 18, '#1c2a6b', 4);
        g.strokeStyle = '#c0392b'; g.lineWidth = 4;
        g.beginPath(); g.moveTo(q + 80, 96); g.lineTo(q + 380, 94); g.stroke();
        for (let i = 0; i < 9; i++) scribble(q + 84, 150 + i * 44, rr(q * 0.5, q - 200), 11, '#1c2a6b', 3);

        // 0,1 — somebody's painting: big wet shapes, a sun, a strip of grass.
        g.fillStyle = '#fdfbf2'; g.fillRect(0, q, q, q);
        g.fillStyle = '#8fbcdc'; g.fillRect(20, q + 20, q - 40, q * 0.5);
        g.fillStyle = '#6fa544'; g.fillRect(20, q + q * 0.52, q - 40, q * 0.44);
        g.fillStyle = '#f2c53a';
        g.beginPath(); g.arc(q * 0.76, q + q * 0.2, q * 0.11, 0, Math.PI * 2); g.fill();
        g.strokeStyle = '#f2c53a'; g.lineWidth = 8;
        for (let i = 0; i < 8; i++) {
            const a = (i / 8) * Math.PI * 2;
            g.beginPath();
            g.moveTo(q * 0.76 + Math.cos(a) * q * 0.13, q + q * 0.2 + Math.sin(a) * q * 0.13);
            g.lineTo(q * 0.76 + Math.cos(a) * q * 0.19, q + q * 0.2 + Math.sin(a) * q * 0.19);
            g.stroke();
        }
        g.fillStyle = '#c0563a';
        g.fillRect(q * 0.2, q + q * 0.42, q * 0.26, q * 0.3);
        g.fillStyle = '#7a3a2a';
        g.beginPath();
        g.moveTo(q * 0.17, q + q * 0.42); g.lineTo(q * 0.33, q + q * 0.28); g.lineTo(q * 0.49, q + q * 0.42);
        g.closePath(); g.fill();

        // 1,1 — a printed poster: title bar, an image block, two columns.
        g.fillStyle = '#ffffff'; g.fillRect(q, q, q, q);
        g.fillStyle = '#1b7a5a'; g.fillRect(q + 24, q + 24, q - 48, 96);
        g.fillStyle = 'rgba(255,255,255,0.9)';
        for (let i = 0; i < 3; i++) g.fillRect(q + 48, q + 48 + i * 22, rr(q * 0.3, q * 0.7), 10);
        g.fillStyle = '#d8d2c4'; g.fillRect(q + 24, q + 140, q - 48, q * 0.34);
        g.fillStyle = '#9aa3ad';
        g.beginPath();
        g.moveTo(q + 60, q + 140 + q * 0.34); g.lineTo(q + q * 0.42, q + 190); g.lineTo(q + q * 0.8, q + 140 + q * 0.34);
        g.closePath(); g.fill();
        for (let c = 0; c < 2; c++) {
            for (let i = 0; i < 12; i++) {
                g.fillStyle = 'rgba(60,66,74,0.7)';
                g.fillRect(q + 30 + c * (q / 2 - 10), q + 160 + q * 0.36 + i * 22, rr(q * 0.2, q * 0.42), 8);
            }
        }
    });

    const corkMat = new THREE.MeshStandardMaterial({ map: corkTex, color: 0xffffff, roughness: 0.95 });
    const pineMat = new THREE.MeshStandardMaterial({ map: pineTex, color: 0xffffff, roughness: 0.62 });
    const paperMat = new THREE.MeshStandardMaterial({
        map: noticeTex, color: 0xffffff, roughness: 0.9, side: THREE.DoubleSide,
    });
    const pinMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.32, metalness: 0.05 });

    /* ---- board and frame ----------------------------------------------------- */

    const cork = new THREE.Mesh(box(W - 2 * F, H - 2 * F, 0.012, 0, H / 2, 0.004), corkMat);
    cork.receiveShadow = true;
    group.add(cork);

    const frame = new THREE.Mesh(merge([
        box(W, F, T, 0, H - F / 2, 0),
        box(W, F, T, 0, F / 2, 0),
        box(F, H - 2 * F, T, -(W - F) / 2, H / 2, 0),
        box(F, H - 2 * F, T, (W - F) / 2, H / 2, 0),
        box(W - 2 * F, H - 2 * F, 0.008, 0, H / 2, -T / 2 + 0.004),   // the backing board
    ]), pineMat);
    frame.castShadow = true; frame.receiveShadow = true;
    group.add(frame);

    /* ---- what is pinned to it -------------------------------------------------- */

    // One quadrant of the notice sheet per piece of paper, so nine notices ride
    // on one texture and one draw call.
    function sheet(w, h, x, y, z, tilt, quadX, quadY, curl) {
        const g = new THREE.PlaneGeometry(w, h, 4, 5);
        const uv = g.attributes.uv;
        for (let i = 0; i < uv.count; i++) {
            uv.setXY(i, (uv.getX(i) * 0.48 + 0.01) + quadX * 0.5, (uv.getY(i) * 0.48 + 0.01) + quadY * 0.5);
        }
        if (curl) {
            // The bottom corner has come off its pin and is lifting away.
            const pos = g.attributes.position;
            const v = new THREE.Vector3();
            for (let i = 0; i < pos.count; i++) {
                v.fromBufferAttribute(pos, i);
                const u = (v.x / w) + 0.5, t = 0.5 - (v.y / h);
                const lift = Math.max(0, (u - 0.5) / 0.5) * Math.max(0, (t - 0.5) / 0.5);
                pos.setZ(i, v.z + lift * lift * 0.05 * curl);
            }
            pos.needsUpdate = true;
            g.computeVertexNormals();
        }
        g.rotateZ(tilt);
        g.translate(x, y, z);
        return g;
    }

    const sheets = [];
    const pins = [];
    const PIN_COLOURS = [0xc0392b, 0xe0a92b, 0x2f7fc0, 0x35a05a, 0xffffff];

    // Laid out by hand rather than at random: a board has drifts, and the two
    // big things go up first with the small ones filling in around them.
    const layout = [
        { w: 0.30, h: 0.40, x: -0.40, y: 0.60, q: [0, 0], tilt: -0.03, curl: 0 },
        { w: 0.22, h: 0.30, x: -0.10, y: 0.66, q: [1, 0], tilt: 0.05, curl: 0 },
        { w: 0.26, h: 0.20, x: 0.20, y: 0.68, q: [0, 1], tilt: -0.06, curl: 0 },
        { w: 0.20, h: 0.27, x: 0.43, y: 0.58, q: [1, 1], tilt: 0.03, curl: 0 },
        { w: 0.24, h: 0.32, x: -0.38, y: 0.26, q: [1, 1], tilt: 0.04, curl: 0 },
        { w: 0.18, h: 0.24, x: -0.11, y: 0.28, q: [0, 1], tilt: -0.08, curl: 1 },
        { w: 0.28, h: 0.21, x: 0.16, y: 0.32, q: [1, 0], tilt: 0.02, curl: 0 },
        { w: 0.15, h: 0.21, x: 0.42, y: 0.24, q: [0, 0], tilt: 0.10, curl: 1 },
        { w: 0.13, h: 0.09, x: 0.03, y: 0.13, q: [1, 0], tilt: -0.14, curl: 0 },
    ];

    layout.forEach((s, i) => {
        const z = 0.0118 + i * 0.0006;      // each layer a fraction proud of the last
        sheets.push(sheet(s.w, s.h, s.x, s.y, z, s.tilt, s.q[0], s.q[1], s.curl));
        // One pin at the top, and a second one only if the sheet is big.
        const heads = [[s.x - s.w * 0.32, s.y + s.h * 0.42]];
        if (s.w > 0.2) heads.push([s.x + s.w * 0.32, s.y + s.h * 0.42]);
        if (!s.curl && s.h > 0.28) heads.push([s.x, s.y - s.h * 0.44]);
        for (const [px, py] of heads) {
            const colour = pick(PIN_COLOURS);
            pins.push(tint(new THREE.SphereGeometry(0.008, 10, 7).scale(1, 1, 0.7)
                .translate(px, py, z + 0.008), colour));
            pins.push(tint(new THREE.CylinderGeometry(0.0016, 0.0016, 0.012, 6)
                .rotateX(Math.PI / 2).translate(px, py, z + 0.002), 0xb8bcc2));
        }
    });

    const notices = new THREE.Mesh(merge(sheets), paperMat);
    notices.castShadow = true;
    group.add(notices);

    const pinMesh = new THREE.Mesh(merge(pins), pinMat);
    pinMesh.castShadow = true;
    group.add(pinMesh);

    group.name = 'pin-board';
    return group;
}
