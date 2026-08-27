//
//  whiteboard.prop.js
//  Project27 object library
//
//  A mobile whiteboard: a 1.5 m board in an aluminium frame, on an A-frame
//  trolley with four castors, pen tray loaded. Top of the board at 1.79 m.
//
//  Mobile rather than wall-mounted on purpose. A prop is placed on a floor,
//  and a board that needs a wall behind it can only ever be put in half the
//  rooms; this one stands anywhere.
//
//  The board face is drawn, not blank. Blank white is what a whiteboard looks
//  like for the five minutes a year nobody has used it, and a ghost of last
//  lesson under a fresh diagram is what it looks like the rest of the time.
//
//  Origin at the floor, centred, written face toward +Z.
//

import { mergeGeometries } from './BufferGeometryUtils.js';

export default function build(THREE, helpers) {
    const group = new THREE.Group();

    let seed = 91733;
    const rnd = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
    const rr = (a, b) => a + (b - a) * rnd();

    const paint = (w, h, draw) => (helpers && helpers.canvasTexture ? helpers.canvasTexture(w, h, draw) : null);
    const V = (x, y, z) => new THREE.Vector3(x, y, z);
    const merge = (parts) => mergeGeometries(parts.map((g) => (g.index ? g.toNonIndexed() : g)));

    const UP = new THREE.Vector3(0, 1, 0);
    function rod(a, b, radius, segments = 10) {
        const dir = new THREE.Vector3().subVectors(b, a);
        const length = dir.length();
        const g = new THREE.CylinderGeometry(radius, radius, length, segments, 1);
        g.applyMatrix4(new THREE.Matrix4().compose(
            new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5),
            new THREE.Quaternion().setFromUnitVectors(UP, dir.normalize()),
            new THREE.Vector3(1, 1, 1)));
        return g;
    }
    const box = (w, h, d, x, y, z) => new THREE.BoxGeometry(w, h, d).translate(x, y, z);

    const BW = 1.52, BH = 1.02, BOARD_Y = 1.28;

    /* ---- the face --------------------------------------------------------- */

    const faceTex = paint(1024, 704, (g, cv) => {
        const w = cv.width, h = cv.height;
        g.fillStyle = '#f6f7f5'; g.fillRect(0, 0, w, h);

        // Ghosting first: broad grey sweeps where an eraser went, plus the
        // permanent pink haze red marker leaves behind after a year.
        for (let i = 0; i < 26; i++) {
            const y = rr(0, h), x = rr(-100, w);
            g.strokeStyle = `rgba(${rnd() > 0.7 ? '196,168,172' : '178,184,186'},${rr(0.05, 0.16)})`;
            g.lineWidth = rr(14, 46);
            g.lineCap = 'round';
            g.beginPath(); g.moveTo(x, y); g.lineTo(x + rr(120, 460), y + rr(-14, 14)); g.stroke();
        }
        g.lineCap = 'butt';

        // Handwriting, as handwriting looks from four metres away: the rhythm
        // of a line of words rather than any actual letters.
        const writeLine = (x, y, len, size, colour, weight) => {
            g.strokeStyle = colour; g.lineWidth = weight; g.lineJoin = 'round';
            let px = x;
            while (px < x + len) {
                const wordLen = rr(size * 1.4, size * 4.2);
                g.beginPath();
                let cx = px, up = true;
                g.moveTo(cx, y);
                while (cx < px + wordLen) {
                    const step = rr(size * 0.3, size * 0.55);
                    g.quadraticCurveTo(cx + step * 0.5, y + (up ? -size : size * 0.35), cx + step, y);
                    cx += step; up = !up;
                }
                g.stroke();
                px += wordLen + rr(size * 0.5, size * 0.9);
            }
            g.lineJoin = 'miter';
        };

        // Title, underlined twice the way a teacher underlines a title.
        writeLine(60, 74, 380, 20, '#232830', 4.5);
        g.strokeStyle = '#c0392b'; g.lineWidth = 3;
        g.beginPath(); g.moveTo(56, 96); g.lineTo(452, 94); g.stroke();
        g.beginPath(); g.moveTo(56, 104); g.lineTo(438, 103); g.stroke();

        // The date, top right, small.
        writeLine(w - 230, 70, 170, 13, '#3b4250', 3);

        // A three-box flow with arrows: the diagram every subject draws.
        const boxAt = (x, y, bw, bh) => {
            g.strokeStyle = '#1f5fa8'; g.lineWidth = 4.5;
            g.beginPath();
            g.moveTo(x + rr(-3, 3), y);
            g.lineTo(x + bw, y + rr(-4, 4));
            g.lineTo(x + bw + rr(-3, 3), y + bh);
            g.lineTo(x + rr(-4, 4), y + bh + rr(-3, 3));
            g.closePath(); g.stroke();
            writeLine(x + 16, y + bh * 0.62, bw - 34, 11, '#1f5fa8', 3);
        };
        const arrow = (x0, y0, x1, y1) => {
            g.strokeStyle = '#c0392b'; g.lineWidth = 4; g.lineCap = 'round';
            g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
            const a = Math.atan2(y1 - y0, x1 - x0);
            g.beginPath();
            g.moveTo(x1, y1);
            g.lineTo(x1 - Math.cos(a - 0.42) * 18, y1 - Math.sin(a - 0.42) * 18);
            g.moveTo(x1, y1);
            g.lineTo(x1 - Math.cos(a + 0.42) * 18, y1 - Math.sin(a + 0.42) * 18);
            g.stroke();
            g.lineCap = 'butt';
        };
        boxAt(70, 180, 200, 92);
        boxAt(360, 180, 200, 92);
        boxAt(650, 180, 200, 92);
        arrow(276, 226, 354, 226);
        arrow(566, 226, 644, 226);

        // A curve with axes, because somebody always needs a graph.
        g.strokeStyle = '#2f3238'; g.lineWidth = 3.5;
        const ox = 120, oy = 620, ah = 210, aw = 300;
        g.beginPath(); g.moveTo(ox, oy - ah); g.lineTo(ox, oy); g.lineTo(ox + aw, oy); g.stroke();
        g.strokeStyle = '#1b8a4a'; g.lineWidth = 5;
        g.beginPath();
        for (let i = 0; i <= 60; i++) {
            const t = i / 60;
            const px = ox + t * aw;
            const py = oy - ah * (1 - Math.exp(-t * 3.1)) + Math.sin(t * 22) * 2;
            i ? g.lineTo(px, py) : g.moveTo(px, py);
        }
        g.stroke();

        // A bulleted list on the right, ticked off as it went.
        for (let i = 0; i < 4; i++) {
            const y = 430 + i * 62;
            g.fillStyle = '#2f3238';
            g.beginPath(); g.arc(560, y - 5, 5, 0, Math.PI * 2); g.fill();
            writeLine(582, y, rr(180, 290), 12, '#2f3238', 3.2);
            if (i < 2) {
                g.strokeStyle = '#1b8a4a'; g.lineWidth = 4.5; g.lineCap = 'round';
                g.beginPath();
                g.moveTo(520, y - 8); g.lineTo(534, y + 4); g.lineTo(552, y - 22);
                g.stroke(); g.lineCap = 'butt';
            }
        }

        // Somebody's initials in the far corner, small, in the wrong colour.
        writeLine(w - 120, h - 34, 70, 12, '#7a3fa8', 3);
    });

    const boardMat = new THREE.MeshStandardMaterial({
        map: faceTex, color: 0xffffff, roughness: 0.16, metalness: 0.0,
        envMapIntensity: 1.4,
    });
    const alu = new THREE.MeshStandardMaterial({ color: 0xb9bfc4, roughness: 0.36, metalness: 0.9 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x2a2d31, roughness: 0.8 });

    // The board hangs on its pivots, and it never hangs quite level.
    const panel = new THREE.Group();
    panel.position.y = BOARD_Y;
    panel.rotation.x = -0.024;
    panel.rotation.z = 0.004;
    group.add(panel);

    const face = new THREE.Mesh(new THREE.PlaneGeometry(BW, BH), boardMat);
    face.position.z = 0.012;
    face.receiveShadow = true;
    panel.add(face);

    const carcass = new THREE.Mesh(
        box(BW + 0.004, BH + 0.004, 0.024, 0, 0, 0),
        new THREE.MeshStandardMaterial({ color: 0x555b60, roughness: 0.85 })
    );
    carcass.castShadow = true; carcass.receiveShadow = true;
    panel.add(carcass);

    // The aluminium surround, one merged extrusion with mitred-looking corners.
    const F = 0.028;
    const frame = new THREE.Mesh(merge([
        box(BW + 2 * F, F, 0.036, 0, (BH + F) / 2, 0),
        box(BW + 2 * F, F, 0.036, 0, -(BH + F) / 2, 0),
        box(F, BH + 2 * F, 0.036, (BW + F) / 2, 0, 0),
        box(F, BH + 2 * F, 0.036, -(BW + F) / 2, 0, 0),
    ]), alu);
    frame.castShadow = true;
    panel.add(frame);

    /* ---- the pen tray and what is in it ------------------------------------ */

    const tray = new THREE.Mesh(merge([
        box(BW * 0.92, 0.008, 0.075, 0, -(BH / 2) - 0.05, 0.038),
        box(BW * 0.92, 0.026, 0.006, 0, -(BH / 2) - 0.04, 0.073),
        box(0.02, 0.05, 0.075, -BW * 0.46, -(BH / 2) - 0.03, 0.038),
        box(0.02, 0.05, 0.075, BW * 0.46, -(BH / 2) - 0.03, 0.038),
    ]), alu);
    tray.castShadow = true; tray.receiveShadow = true;
    panel.add(tray);

    function marker(colour, x, roll) {
        const body = merge([
            new THREE.CylinderGeometry(0.0085, 0.0085, 0.115, 12).rotateZ(Math.PI / 2),
            new THREE.CylinderGeometry(0.0072, 0.0072, 0.035, 12).rotateZ(Math.PI / 2).translate(0.072, 0, 0),
            new THREE.ConeGeometry(0.0072, 0.016, 12).rotateZ(-Math.PI / 2).translate(-0.062, 0, 0),
        ]);
        const m = new THREE.Mesh(body, new THREE.MeshStandardMaterial({ color: colour, roughness: 0.45 }));
        m.position.set(x, -(BH / 2) - 0.037, 0.038);
        m.rotation.y = roll;
        m.castShadow = true;
        return m;
    }
    // Three pens: two together where they were put down, one that rolled.
    panel.add(marker(0x1b1e22, -0.28, 0.05));
    panel.add(marker(0xc0392b, -0.24, -0.09));
    panel.add(marker(0x1f5fa8, 0.41, 0.22));

    const eraser = new THREE.Mesh(
        box(0.12, 0.042, 0.058, 0.06, -(BH / 2) - 0.026, 0.036),
        new THREE.MeshStandardMaterial({ color: 0x3b4148, roughness: 0.9 })
    );
    eraser.castShadow = true;
    // Face down in the felt, at the angle a hand leaves it.
    eraser.rotation.y = -0.16;
    panel.add(eraser);

    /* ---- the trolley -------------------------------------------------------- */

    const legs = [];
    for (const sx of [-1, 1]) {
        const x = sx * 0.66;
        const hub = V(x, BOARD_Y, 0);
        legs.push(rod(V(x * 0.98, 0.075, 0.30), hub, 0.017));
        legs.push(rod(V(x * 0.98, 0.075, -0.30), hub, 0.017));
        legs.push(rod(V(x * 0.98, 0.075, 0.30), V(x * 0.98, 0.075, -0.30), 0.014));
        legs.push(new THREE.SphereGeometry(0.019, 10, 8).translate(hub.x, hub.y, hub.z));
        // The knob that clamps the board's tilt, on the outside of each hub.
        legs.push(new THREE.CylinderGeometry(0.021, 0.021, 0.018, 12)
            .rotateZ(Math.PI / 2).translate(x + sx * 0.026, BOARD_Y, 0));
    }
    // The bar that keeps the two A-frames talking to each other.
    legs.push(rod(V(-0.647, 0.30, -0.16), V(0.647, 0.30, -0.16), 0.014));
    const trolley = new THREE.Mesh(merge(legs), alu);
    trolley.castShadow = true; trolley.receiveShadow = true;
    group.add(trolley);

    const castors = [];
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
        const x = sx * 0.647, z = sz * 0.30;
        // The swivel yoke trails behind the wheel, and no two point the same way.
        const yaw = rr(-0.9, 0.9);
        const offX = Math.sin(yaw) * 0.022, offZ = Math.cos(yaw) * 0.022;
        castors.push(new THREE.CylinderGeometry(0.016, 0.016, 0.05, 10).translate(x, 0.055, z));
        castors.push(box(0.04, 0.05, 0.012, x, 0.045, z).translate(0, 0, 0));
        castors.push(new THREE.CylinderGeometry(0.034, 0.034, 0.022, 14)
            .rotateZ(Math.PI / 2).translate(x - offX, 0.034, z - offZ));
    }
    const wheels = new THREE.Mesh(merge(castors), dark);
    wheels.castShadow = true; wheels.receiveShadow = true;
    group.add(wheels);

    group.name = 'whiteboard';
    return group;
}
