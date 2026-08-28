//
//  park-lamp.prop.js
//  Project27 object library
//
//  A cast-iron park lamp: fluted column on a stepped base, four-pane lantern
//  with a copper cap and a finial. The glass is emissive rather than lit — a
//  prop never spends one of a world's four real lights on itself; the world's
//  bloom is what makes it glow.
//
//  Origin at the ground, centred. 3.6 m to the finial.
//

import { mergeGeometries } from './BufferGeometryUtils.js';

export default function build(THREE, helpers) {
    const group = new THREE.Group();

    const weld = (parts) => mergeGeometries(parts.map((g) => (g.index ? g.toNonIndexed() : g)));

    const COLUMN_TOP = 2.62;

    /* ---- iron ------------------------------------------------------------ */

    const iron = new THREE.MeshStandardMaterial({
        color: 0x1c2622, roughness: 0.52, metalness: 0.68,
    });

    const ironParts = [
        // Stepped base: three courses, each smaller than the last.
        new THREE.CylinderGeometry(0.30, 0.34, 0.10, 14).translate(0, 0.05, 0),
        new THREE.CylinderGeometry(0.23, 0.29, 0.16, 14).translate(0, 0.18, 0),
        new THREE.CylinderGeometry(0.15, 0.21, 0.22, 14).translate(0, 0.37, 0),
        // Column, very slightly tapered, with a collar two-thirds up.
        new THREE.CylinderGeometry(0.062, 0.088, COLUMN_TOP - 0.48, 12).translate(0, 0.48 + (COLUMN_TOP - 0.48) / 2, 0),
        new THREE.CylinderGeometry(0.098, 0.098, 0.06, 12).translate(0, 1.74, 0),
        // Corbel under the lantern.
        new THREE.CylinderGeometry(0.16, 0.075, 0.20, 12).translate(0, COLUMN_TOP + 0.09, 0),
    ];
    // Four flutes running the column, so it is not a smooth pipe.
    for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2;
        const flute = new THREE.BoxGeometry(0.018, COLUMN_TOP - 0.62, 0.018);
        flute.translate(Math.cos(a) * 0.076, 0.55 + (COLUMN_TOP - 0.62) / 2, Math.sin(a) * 0.076);
        ironParts.push(flute);
    }
    const column = new THREE.Mesh(weld(ironParts), iron);
    column.castShadow = true;
    column.receiveShadow = true;
    group.add(column);

    /* ---- lantern --------------------------------------------------------- */

    const LANTERN_Y = COLUMN_TOP + 0.20;
    const frameParts = [
        new THREE.BoxGeometry(0.34, 0.035, 0.34).translate(0, LANTERN_Y, 0),
        new THREE.BoxGeometry(0.32, 0.035, 0.32).translate(0, LANTERN_Y + 0.62, 0),
    ];
    for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
        const post = new THREE.BoxGeometry(0.028, 0.62, 0.028);
        post.translate(Math.cos(a) * 0.155, LANTERN_Y + 0.31, Math.sin(a) * 0.155);
        frameParts.push(post);
    }
    // Copper cap and finial.
    frameParts.push(new THREE.ConeGeometry(0.27, 0.26, 4, 1).rotateY(Math.PI / 4).translate(0, LANTERN_Y + 0.76, 0));
    frameParts.push(new THREE.SphereGeometry(0.045, 10, 8).translate(0, LANTERN_Y + 0.92, 0));
    frameParts.push(new THREE.CylinderGeometry(0.012, 0.012, 0.10, 6).translate(0, LANTERN_Y + 0.99, 0));

    const cap = new THREE.Mesh(weld(frameParts), new THREE.MeshStandardMaterial({
        color: 0x3f5a4a, roughness: 0.55, metalness: 0.72,
    }));
    cap.castShadow = true;
    group.add(cap);

    // The glass itself: warm, slightly dirty, and bright enough for bloom.
    const glassTex = helpers && helpers.canvasTexture
        ? helpers.canvasTexture(64, 64, (g, cv) => {
            const rad = g.createRadialGradient(cv.width / 2, cv.height * 0.62, 2, cv.width / 2, cv.height / 2, cv.width * 0.7);
            rad.addColorStop(0, '#fff6de');
            rad.addColorStop(0.5, '#ffd792');
            rad.addColorStop(1, '#e8a648');
            g.fillStyle = rad;
            g.fillRect(0, 0, cv.width, cv.height);
            for (let i = 0; i < 40; i++) {
                g.fillStyle = `rgba(90,70,40,${(Math.random() * 0.16).toFixed(3)})`;
                g.fillRect(Math.random() * cv.width, Math.random() * cv.height, 2, 2);
            }
        })
        : null;
    const glass = new THREE.Mesh(
        new THREE.BoxGeometry(0.235, 0.56, 0.235),
        new THREE.MeshStandardMaterial({
            color: 0xffe6b4, map: glassTex, emissive: 0xffcf82, emissiveMap: glassTex,
            emissiveIntensity: 1.9, roughness: 0.3, metalness: 0.0,
            transparent: true, opacity: 0.92,
        })
    );
    glass.position.y = LANTERN_Y + 0.31;
    glass.rotation.y = Math.PI / 4;
    group.add(glass);

    return group;
}
