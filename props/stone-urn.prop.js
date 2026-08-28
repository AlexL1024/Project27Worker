//
//  stone-urn.prop.js
//  Project27 object library
//
//  A memorial urn: a bronze bowl on three cast legs, standing on a square
//  bluestone plinth with a bronze wreath plaque on its face. The kind that
//  flanks the stairs of a war memorial in fours, going green at the seams.
//
//  Origin at the ground, centred. The plaque faces +Z. About 1.9 m tall.
//

import { mergeGeometries } from './BufferGeometryUtils.js';

export default function build(THREE, helpers) {
    const group = new THREE.Group();

    const weld = (parts) => mergeGeometries(parts.map((g) => (g.index ? g.toNonIndexed() : g)));

    /* ---- plinth ---------------------------------------------------------- */

    const stoneTex = helpers && helpers.canvasTexture
        ? helpers.canvasTexture(256, 256, (g, cv) => {
            g.fillStyle = '#c6bda6';
            g.fillRect(0, 0, cv.width, cv.height);
            for (let i = 0; i < 1200; i++) {
                const v = 140 + Math.random() * 90;
                g.fillStyle = `rgba(${v | 0},${(v - 5) | 0},${(v - 28) | 0},0.14)`;
                g.beginPath();
                g.arc(Math.random() * cv.width, Math.random() * cv.height, Math.random() * 6 + 1, 0, Math.PI * 2);
                g.fill();
            }
            // Two bed joints and a weathering streak down from the cap.
            g.strokeStyle = 'rgba(112,104,86,0.34)';
            g.lineWidth = 2.5;
            for (const y of [cv.height * 0.34, cv.height * 0.68]) {
                g.beginPath(); g.moveTo(0, y); g.lineTo(cv.width, y); g.stroke();
            }
            for (let i = 0; i < 5; i++) {
                const x = Math.random() * cv.width;
                const streak = g.createLinearGradient(x, 0, x, cv.height);
                streak.addColorStop(0, 'rgba(96,88,70,0.22)');
                streak.addColorStop(1, 'rgba(96,88,70,0)');
                g.fillStyle = streak;
                g.fillRect(x, 0, 6 + Math.random() * 12, cv.height);
            }
        })
        : null;
    const stone = new THREE.MeshStandardMaterial({
        color: stoneTex ? 0xffffff : 0xc6bda6, map: stoneTex, roughness: 0.95, metalness: 0.0,
    });

    const plinthParts = [
        new THREE.BoxGeometry(0.96, 0.14, 0.96).translate(0, 0.07, 0),
        new THREE.BoxGeometry(0.80, 0.86, 0.80).translate(0, 0.57, 0),
        new THREE.BoxGeometry(0.92, 0.10, 0.92).translate(0, 1.05, 0),
    ];
    const plinth = new THREE.Mesh(weld(plinthParts), stone);
    plinth.castShadow = true;
    plinth.receiveShadow = true;
    group.add(plinth);

    /* ---- bronze ---------------------------------------------------------- */

    const bronze = new THREE.MeshStandardMaterial({
        color: 0x5a6b52, roughness: 0.48, metalness: 0.78,
    });

    // The bowl, turned as a lathe so the profile is a real curve rather than a
    // stack of cylinders: a narrow foot, a belly, a flared lip.
    const profile = [];
    for (let i = 0; i <= 14; i++) {
        const t = i / 14;
        const y = t * 0.46;
        const r = 0.11 + Math.sin(t * 2.55 + 0.30) * 0.26;
        profile.push(new THREE.Vector2(Math.max(0.07, r), y));
    }
    profile.push(new THREE.Vector2(0.40, 0.50));   // the flared lip
    profile.push(new THREE.Vector2(0.355, 0.53));
    const bowl = new THREE.Mesh(new THREE.LatheGeometry(profile, 22), bronze);
    bowl.position.y = 1.28;
    bowl.castShadow = true;
    bowl.receiveShadow = true;
    group.add(bowl);

    const fittingParts = [];
    // Three legs down to the plinth cap, splayed the way a tripod is.
    for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2 + 0.4;
        const leg = new THREE.CylinderGeometry(0.028, 0.038, 0.30, 8);
        leg.rotateX(0.16 * Math.cos(a));
        leg.rotateZ(-0.16 * Math.sin(a));
        leg.translate(Math.cos(a) * 0.13, 1.16, Math.sin(a) * 0.13);
        fittingParts.push(leg);
    }
    fittingParts.push(new THREE.CylinderGeometry(0.22, 0.26, 0.06, 16).translate(0, 1.13, 0));
    fittingParts.push(new THREE.TorusGeometry(0.385, 0.022, 6, 22).rotateX(Math.PI / 2).translate(0, 1.79, 0));
    const fittings = new THREE.Mesh(weld(fittingParts), bronze);
    fittings.castShadow = true;
    group.add(fittings);

    /* ---- plaque ---------------------------------------------------------- */

    const plaqueTex = helpers && helpers.canvasTexture
        ? helpers.canvasTexture(256, 256, (g, cv) => {
            g.fillStyle = '#4e5c46';
            g.fillRect(0, 0, cv.width, cv.height);
            const sheen = g.createLinearGradient(0, 0, cv.width, cv.height);
            sheen.addColorStop(0, 'rgba(186,204,168,0.4)');
            sheen.addColorStop(0.55, 'rgba(46,58,42,0.35)');
            sheen.addColorStop(1, 'rgba(150,172,136,0.28)');
            g.fillStyle = sheen;
            g.fillRect(0, 0, cv.width, cv.height);
            // A laurel ring and a date, cast proud of the face.
            g.strokeStyle = 'rgba(214,228,196,0.6)';
            g.lineWidth = 7;
            g.beginPath();
            g.arc(cv.width / 2, cv.height / 2, 78, 0.5, Math.PI * 2 - 0.5);
            g.stroke();
            for (let i = 0; i < 22; i++) {
                const a = 0.5 + (i / 21) * (Math.PI * 2 - 1.0);
                g.save();
                g.translate(cv.width / 2 + Math.cos(a) * 78, cv.height / 2 + Math.sin(a) * 78);
                g.rotate(a);
                g.fillStyle = 'rgba(196,214,178,0.55)';
                g.beginPath();
                g.ellipse(0, 0, 16, 6, 0.6, 0, Math.PI * 2);
                g.fill();
                g.restore();
            }
            g.fillStyle = 'rgba(222,236,206,0.75)';
            g.font = 'bold 44px Georgia, serif';
            g.textAlign = 'center';
            g.fillText('1914', cv.width / 2, cv.height / 2 - 4);
            g.fillText('1918', cv.width / 2, cv.height / 2 + 44);
        })
        : null;
    const plaque = new THREE.Mesh(
        new THREE.BoxGeometry(0.46, 0.46, 0.012),
        new THREE.MeshStandardMaterial({
            color: plaqueTex ? 0xffffff : 0x4e5c46, map: plaqueTex, roughness: 0.5, metalness: 0.75,
        })
    );
    plaque.position.set(0, 0.60, 0.404);
    plaque.castShadow = true;
    group.add(plaque);

    return group;
}
