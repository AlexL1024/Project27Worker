//
//  park-bench.prop.js
//  Project27 object library
//
//  A public-park bench: seven hardwood slats bolted onto two cast-iron ends,
//  the pattern every council in Melbourne has bought since about 1890. Dark
//  green iron, weathered jarrah, one slat replaced at some point and never
//  stained to match.
//
//  Origin at the ground, centred, front (the side you sit facing) to +Z.
//  Seat at 0.45 m, back at 0.92 m.
//

import { mergeGeometries } from './BufferGeometryUtils.js';

export default function build(THREE, helpers) {
    const group = new THREE.Group();

    let seed = 4471;
    const rnd = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
    const rr = (a, b) => a + (b - a) * rnd();

    const LEN = 1.82;          // along x
    const SEAT_Y = 0.45;
    const SLAT_W = 0.072;      // slat width, across the seat
    const SLAT_T = 0.026;

    const weld = (parts) => mergeGeometries(parts.map((g) => (g.index ? g.toNonIndexed() : g)));

    /* ---- timber ---------------------------------------------------------- */

    // Slats, drawn from a canvas so the grain and the one pale replacement read
    // as timber rather than as brown plastic.
    const grain = helpers && helpers.canvasTexture
        ? helpers.canvasTexture(256, 64, (g, cv) => {
            g.fillStyle = '#6b4426';
            g.fillRect(0, 0, cv.width, cv.height);
            for (let i = 0; i < 130; i++) {
                const y = rr(0, cv.height);
                g.strokeStyle = `rgba(${40 + rr(0, 60) | 0},${24 + rr(0, 34) | 0},10,${rr(0.05, 0.2).toFixed(3)})`;
                g.lineWidth = rr(0.5, 2.2);
                g.beginPath();
                g.moveTo(0, y);
                for (let x = 0; x <= cv.width; x += 16) g.lineTo(x, y + Math.sin(x * 0.05 + i) * 1.6);
                g.stroke();
            }
            // Sun bleach along the top edge, and a few dark knots.
            const bleach = g.createLinearGradient(0, 0, 0, cv.height);
            bleach.addColorStop(0, 'rgba(214,178,132,0.30)');
            bleach.addColorStop(1, 'rgba(30,16,6,0.18)');
            g.fillStyle = bleach;
            g.fillRect(0, 0, cv.width, cv.height);
            for (let i = 0; i < 4; i++) {
                g.fillStyle = 'rgba(38,20,8,0.45)';
                g.beginPath();
                g.ellipse(rr(0, cv.width), rr(8, cv.height - 8), rr(3, 6), rr(2, 4), 0, 0, Math.PI * 2);
                g.fill();
            }
        })
        : null;
    if (grain) {
        grain.wrapS = grain.wrapT = THREE.RepeatWrapping;
        grain.repeat.set(2, 1);
    }

    const timber = new THREE.MeshStandardMaterial({
        color: grain ? 0xffffff : 0x6b4426, map: grain, roughness: 0.86, metalness: 0.0,
    });
    const timberPale = new THREE.MeshStandardMaterial({
        color: grain ? 0xc9a279 : 0xa98559, map: grain, roughness: 0.9, metalness: 0.0,
    });

    // Seat: four slats stepping back and down a little, as a bench does.
    const seatSlats = [];
    const paleIndex = 2;
    const paleGeo = [];
    for (let i = 0; i < 4; i++) {
        const z = -0.16 + i * 0.108;
        const g = new THREE.BoxGeometry(LEN, SLAT_T, SLAT_W);
        g.translate(0, SEAT_Y - i * 0.006, z);
        (i === paleIndex ? paleGeo : seatSlats).push(g);
    }
    // Back: three slats raked back 12°.
    for (let i = 0; i < 3; i++) {
        const g = new THREE.BoxGeometry(LEN, SLAT_T, SLAT_W);
        const h = 0.60 + i * 0.135;
        g.rotateX(-0.21);
        g.translate(0, SEAT_Y + h - 0.32, -0.20 - (h - 0.28) * 0.21);
        seatSlats.push(g);
    }

    const slats = new THREE.Mesh(weld(seatSlats), timber);
    slats.castShadow = true;
    slats.receiveShadow = true;
    group.add(slats);

    const replaced = new THREE.Mesh(weld(paleGeo), timberPale);
    replaced.castShadow = true;
    replaced.receiveShadow = true;
    group.add(replaced);

    /* ---- cast iron ends -------------------------------------------------- */

    const iron = new THREE.MeshStandardMaterial({
        color: 0x243a2c, roughness: 0.55, metalness: 0.62,
    });

    const endParts = [];
    for (const side of [-1, 1]) {
        const x = side * (LEN / 2 - 0.12);

        // Front leg, splayed; rear leg carrying the back rail.
        const front = new THREE.BoxGeometry(0.05, SEAT_Y + 0.02, 0.075);
        front.rotateX(0.10);
        front.translate(x, (SEAT_Y + 0.02) / 2, 0.11);
        endParts.push(front);

        const rear = new THREE.BoxGeometry(0.05, 0.94, 0.075);
        rear.rotateX(-0.16);
        rear.translate(x, 0.47, -0.20);
        endParts.push(rear);

        // The scrolled arm — a bar plus the little curl the casting always has.
        const arm = new THREE.BoxGeometry(0.045, 0.05, 0.42);
        arm.translate(x, 0.66, -0.02);
        endParts.push(arm);
        const curl = new THREE.TorusGeometry(0.055, 0.021, 6, 12, Math.PI * 1.5);
        curl.rotateY(Math.PI / 2);
        curl.translate(x, 0.62, 0.18);
        endParts.push(curl);

        // Foot plate on the paving, and the stretcher tying the legs together.
        const foot = new THREE.BoxGeometry(0.09, 0.022, 0.30);
        foot.translate(x, 0.011, -0.03);
        endParts.push(foot);
        const brace = new THREE.BoxGeometry(0.038, 0.038, 0.34);
        brace.translate(x, 0.20, -0.045);
        endParts.push(brace);
    }
    // The rail between the two ends, under the seat.
    const rail = new THREE.BoxGeometry(LEN - 0.20, 0.05, 0.045);
    rail.translate(0, 0.235, -0.045);
    endParts.push(rail);

    const ends = new THREE.Mesh(weld(endParts), iron);
    ends.castShadow = true;
    ends.receiveShadow = true;
    group.add(ends);

    /* ---- the brass donor plaque, because these always have one ----------- */

    const plaqueTex = helpers && helpers.canvasTexture
        ? helpers.canvasTexture(256, 96, (g, cv) => {
            g.fillStyle = '#8a6b2f';
            g.fillRect(0, 0, cv.width, cv.height);
            const sheen = g.createLinearGradient(0, 0, cv.width, cv.height);
            sheen.addColorStop(0, 'rgba(255,236,178,0.55)');
            sheen.addColorStop(0.5, 'rgba(120,92,40,0.1)');
            sheen.addColorStop(1, 'rgba(255,232,170,0.4)');
            g.fillStyle = sheen;
            g.fillRect(0, 0, cv.width, cv.height);
            g.fillStyle = 'rgba(40,28,8,0.75)';
            g.font = 'bold 22px Georgia, serif';
            g.textAlign = 'center';
            g.fillText('IN LOVING MEMORY', cv.width / 2, 40);
            g.font = '18px Georgia, serif';
            g.fillText('who loved this garden', cv.width / 2, 68);
        })
        : null;
    const plaque = new THREE.Mesh(
        new THREE.BoxGeometry(0.20, 0.075, 0.006),
        new THREE.MeshStandardMaterial({
            color: plaqueTex ? 0xffffff : 0x9c7a37, map: plaqueTex,
            roughness: 0.34, metalness: 0.85,
        })
    );
    plaque.position.set(0, 0.855, -0.284);
    plaque.rotation.x = -0.21;
    plaque.castShadow = true;
    group.add(plaque);

    return group;
}
