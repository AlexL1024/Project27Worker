//
//  wall-clock.prop.js
//  Project27 object library
//
//  The white plastic clock every classroom has, 0.30 m across, red second
//  hand, one screw hanger on the back.
//
//  It hangs, so its origin is the bottom of the case rather than a foot it
//  does not have — place it on the floor and raise it to the height the wall
//  wants. Face toward +Z, like everything else here.
//
//  The time is ten past two, which is nearly the worst part of the afternoon
//  and reads well: three hands, three directions, no overlap.
//

import { mergeGeometries } from './BufferGeometryUtils.js';

export default function build(THREE, helpers) {
    const group = new THREE.Group();

    let seed = 21107;
    const rnd = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
    const rr = (a, b) => a + (b - a) * rnd();

    const paint = (w, h, draw) => (helpers && helpers.canvasTexture ? helpers.canvasTexture(w, h, draw) : null);
    const merge = (parts) => mergeGeometries(parts.map((g) => (g.index ? g.toNonIndexed() : g)));

    const R = 0.148;              // rim centreline
    const CY = R + 0.011;         // so the lowest point of the rim sits at y = 0

    /* ---- the dial ----------------------------------------------------------- */

    const dialTex = paint(512, 512, (g, cv) => {
        const s = cv.width, c = s / 2;
        g.fillStyle = '#f4f2ec'; g.fillRect(0, 0, s, s);
        // Age: a faint yellow bloom from the middle out, and fly specks.
        const age = g.createRadialGradient(c, c, s * 0.1, c, c, s * 0.5);
        age.addColorStop(0, 'rgba(226,206,160,0.10)');
        age.addColorStop(1, 'rgba(206,182,132,0.32)');
        g.fillStyle = age; g.fillRect(0, 0, s, s);

        // Minute ticks, with the five-minute marks longer and heavier.
        for (let i = 0; i < 60; i++) {
            const a = (i / 60) * Math.PI * 2 - Math.PI / 2;
            const major = i % 5 === 0;
            const r0 = s * (major ? 0.375 : 0.398), r1 = s * 0.425;
            g.strokeStyle = major ? '#1d2126' : '#5a6068';
            g.lineWidth = major ? 8 : 3;
            g.beginPath();
            g.moveTo(c + Math.cos(a) * r0, c + Math.sin(a) * r0);
            g.lineTo(c + Math.cos(a) * r1, c + Math.sin(a) * r1);
            g.stroke();
        }

        // Numerals: plain, condensed, the way a school clock is set.
        g.fillStyle = '#1d2126';
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.font = 'bold 54px Helvetica, Arial, sans-serif';
        for (let i = 1; i <= 12; i++) {
            const a = (i / 12) * Math.PI * 2 - Math.PI / 2;
            g.fillText(String(i), c + Math.cos(a) * s * 0.318, c + Math.sin(a) * s * 0.318 + 2);
        }
        g.font = '20px Helvetica, Arial, sans-serif';
        g.fillStyle = '#6b7178';
        g.fillText('QUARTZ', c, c + s * 0.17);

        for (let i = 0; i < 22; i++) {   // specks, and one small water stain
            g.fillStyle = `rgba(60,54,44,${rr(0.1, 0.3)})`;
            g.beginPath(); g.arc(rr(s * 0.15, s * 0.85), rr(s * 0.15, s * 0.85), rr(0.8, 2.2), 0, Math.PI * 2); g.fill();
        }
        const stain = g.createRadialGradient(s * 0.7, s * 0.72, 4, s * 0.7, s * 0.72, s * 0.13);
        stain.addColorStop(0, 'rgba(178,148,96,0.22)');
        stain.addColorStop(1, 'rgba(178,148,96,0)');
        g.fillStyle = stain; g.fillRect(0, 0, s, s);
    });

    const caseMat = new THREE.MeshStandardMaterial({ color: 0xf0efe9, roughness: 0.5, metalness: 0.0 });
    const dialMat = new THREE.MeshStandardMaterial({ map: dialTex, color: 0xffffff, roughness: 0.85 });
    const handMat = new THREE.MeshStandardMaterial({ color: 0x191c20, roughness: 0.45 });
    const secondMat = new THREE.MeshStandardMaterial({ color: 0xc32f22, roughness: 0.4 });

    /* ---- case, dial, glass ---------------------------------------------------- */

    const can = new THREE.Mesh(
        merge([
            new THREE.CylinderGeometry(R - 0.006, R - 0.014, 0.044, 40).rotateX(Math.PI / 2).translate(0, CY, -0.022),
            new THREE.CircleGeometry(R - 0.014, 40).rotateY(Math.PI).translate(0, CY, -0.044),
        ]),
        caseMat
    );
    can.castShadow = true; can.receiveShadow = true;
    group.add(can);

    const rim = new THREE.Mesh(new THREE.TorusGeometry(R, 0.011, 10, 44).translate(0, CY, 0.001), caseMat);
    rim.castShadow = true;
    group.add(rim);

    const dial = new THREE.Mesh(new THREE.CircleGeometry(R - 0.004, 44).translate(0, CY, -0.004), dialMat);
    dial.receiveShadow = true;
    group.add(dial);

    // Domed acrylic, faintly scratched, and only just transparent enough to
    // catch a highlight — a flat clear disc reads as a hole.
    const glass = new THREE.Mesh(
        new THREE.SphereGeometry(R - 0.002, 32, 16, 0, Math.PI * 2, 0, 0.42).rotateX(Math.PI / 2),
        new THREE.MeshStandardMaterial({
            color: 0xffffff, roughness: 0.05, metalness: 0.0,
            transparent: true, opacity: 0.16, depthWrite: false,
        })
    );
    glass.scale.set(1, 1, 0.30);
    glass.position.set(0, CY, 0.004);
    group.add(glass);

    /* ---- the hands ------------------------------------------------------------ */

    // Ten past two: the hour hand two-thirds of the way past 2, because a clock
    // whose hour hand points exactly at a numeral is a clock nobody believes.
    function hand(length, width, tailLength, angle, z) {
        const g = merge([
            new THREE.BoxGeometry(width, length, 0.003).translate(0, length / 2 - tailLength / 2, 0),
            new THREE.BoxGeometry(width * 0.7, tailLength, 0.003).translate(0, -tailLength / 2 - length / 2 + tailLength / 2, 0),
        ]);
        g.rotateZ(-angle);
        g.translate(0, CY, z);
        return g;
    }
    const hourAngle = ((2 + 10 / 60) / 12) * Math.PI * 2;
    const minuteAngle = (10 / 60) * Math.PI * 2;

    const hands = new THREE.Mesh(
        merge([
            hand(0.082, 0.0105, 0.020, hourAngle, 0.0075),
            hand(0.124, 0.0075, 0.022, minuteAngle, 0.0090),
            new THREE.CylinderGeometry(0.007, 0.007, 0.006, 14).rotateX(Math.PI / 2).translate(0, CY, 0.011),
        ]),
        handMat
    );
    hands.castShadow = true;
    group.add(hands);

    const second = new THREE.Mesh(hand(0.132, 0.0035, 0.034, (37 / 60) * Math.PI * 2, 0.0105), secondMat);
    group.add(second);

    /* ---- the back ------------------------------------------------------------- */

    // The hanger keyhole and the battery door: nobody sees them, and the clock
    // looks wrong from the side without them.
    const backParts = new THREE.Mesh(
        merge([
            new THREE.CylinderGeometry(0.020, 0.020, 0.012, 14).rotateX(Math.PI / 2).translate(0, CY + 0.09, -0.048),
            new THREE.BoxGeometry(0.055, 0.075, 0.010).translate(0.0, CY - 0.02, -0.048),
        ]),
        new THREE.MeshStandardMaterial({ color: 0xd9d7d0, roughness: 0.7 })
    );
    group.add(backParts);

    group.name = 'wall-clock';
    return group;
}
