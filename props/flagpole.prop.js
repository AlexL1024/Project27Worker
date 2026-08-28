//
//  flagpole.prop.js
//  Project27 object library
//
//  A ceremonial flagpole: a tapered white mast on a stone plinth, gold ball
//  truck at the head, halyard down one side and cleated off at chest height.
//  No flag — a flag is cloth, and cloth belongs to the world that can move it.
//
//  Origin at the ground, centred. The cleat faces +Z.
//

import { mergeGeometries } from './BufferGeometryUtils.js';

export default function build(THREE, helpers) {
    const group = new THREE.Group();

    const HEIGHT = 9.0;
    const weld = (parts) => mergeGeometries(parts.map((g) => (g.index ? g.toNonIndexed() : g)));

    /* ---- plinth ---------------------------------------------------------- */

    const stoneTex = helpers && helpers.canvasTexture
        ? helpers.canvasTexture(256, 256, (g, cv) => {
            g.fillStyle = '#cdc3ae';
            g.fillRect(0, 0, cv.width, cv.height);
            // Mottling, then a faint bed-joint so it reads as cut stone.
            for (let i = 0; i < 900; i++) {
                const v = 150 + Math.random() * 80;
                g.fillStyle = `rgba(${v | 0},${(v - 6) | 0},${(v - 26) | 0},0.16)`;
                g.beginPath();
                g.arc(Math.random() * cv.width, Math.random() * cv.height, Math.random() * 7 + 1, 0, Math.PI * 2);
                g.fill();
            }
            g.strokeStyle = 'rgba(120,110,92,0.35)';
            g.lineWidth = 2;
            g.beginPath();
            g.moveTo(0, cv.height * 0.5);
            g.lineTo(cv.width, cv.height * 0.5);
            g.stroke();
        })
        : null;
    const stone = new THREE.MeshStandardMaterial({
        color: stoneTex ? 0xffffff : 0xcdc3ae, map: stoneTex, roughness: 0.94, metalness: 0.0,
    });

    const plinthParts = [
        new THREE.BoxGeometry(1.10, 0.16, 1.10).translate(0, 0.08, 0),
        new THREE.BoxGeometry(0.94, 0.52, 0.94).translate(0, 0.42, 0),
        new THREE.BoxGeometry(1.04, 0.09, 1.04).translate(0, 0.725, 0),
    ];
    const plinth = new THREE.Mesh(weld(plinthParts), stone);
    plinth.castShadow = true;
    plinth.receiveShadow = true;
    group.add(plinth);

    /* ---- mast ------------------------------------------------------------ */

    const BASE_Y = 0.77;
    const mast = new THREE.Mesh(
        new THREE.CylinderGeometry(0.052, 0.098, HEIGHT - BASE_Y, 14, 1, false),
        new THREE.MeshStandardMaterial({ color: 0xf2f0e8, roughness: 0.4, metalness: 0.25 })
    );
    mast.position.y = BASE_Y + (HEIGHT - BASE_Y) / 2;
    mast.castShadow = true;
    group.add(mast);

    // Collar where the mast meets the stone, the ball truck, and the little
    // cleat — three small bronze things, one mesh.
    const brass = new THREE.MeshStandardMaterial({ color: 0xb99242, roughness: 0.32, metalness: 0.9 });
    const brassParts = [
        new THREE.CylinderGeometry(0.14, 0.16, 0.12, 14).translate(0, BASE_Y + 0.05, 0),
        new THREE.SphereGeometry(0.11, 14, 10).translate(0, HEIGHT + 0.06, 0),
        new THREE.CylinderGeometry(0.062, 0.062, 0.05, 12).translate(0, HEIGHT - 0.01, 0),
        new THREE.BoxGeometry(0.16, 0.028, 0.028).translate(0, 1.35, 0.10),
        new THREE.BoxGeometry(0.028, 0.10, 0.028).translate(0, 1.32, 0.088),
    ];
    const fittings = new THREE.Mesh(weld(brassParts), brass);
    fittings.castShadow = true;
    group.add(fittings);

    // Halyard: down the front, cleated, with the loose tail hanging.
    const rope = new THREE.MeshStandardMaterial({ color: 0xd8d2bd, roughness: 0.95 });
    const ropeParts = [
        new THREE.CylinderGeometry(0.008, 0.008, HEIGHT - 1.30, 5)
            .translate(0, 1.32 + (HEIGHT - 1.30) / 2, 0.098),
        new THREE.CylinderGeometry(0.008, 0.008, 0.42, 5).rotateZ(0.06).translate(0, 1.12, 0.126),
    ];
    const halyard = new THREE.Mesh(weld(ropeParts), rope);
    halyard.castShadow = true;
    group.add(halyard);

    return group;
}
