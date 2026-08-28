//
//  poppy-wreath.prop.js
//  Project27 object library
//
//  A remembrance wreath, laid flat the way they are left on memorial steps: a
//  ring of woven greenery, red paper poppies pinned round it at every angle,
//  and a small card with a ribbon that has already been rained on once.
//
//  Origin at the ground, centred; it lies in the x–z plane about 0.14 m high.
//  The card faces +Z.
//

export default function build(THREE, helpers) {
    const group = new THREE.Group();

    let seed = 1918;
    const rnd = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
    const rr = (a, b) => a + (b - a) * rnd();

    const R = 0.30;          // ring radius
    const N = 26;            // poppies

    /* ---- the greenery ---------------------------------------------------- */

    const foliageTex = helpers && helpers.canvasTexture
        ? helpers.canvasTexture(128, 128, (g, cv) => {
            g.fillStyle = '#2f4a2a';
            g.fillRect(0, 0, cv.width, cv.height);
            for (let i = 0; i < 260; i++) {
                const x = rr(0, cv.width), y = rr(0, cv.height);
                g.save();
                g.translate(x, y);
                g.rotate(rr(0, Math.PI * 2));
                const v = rr(0.35, 1);
                g.fillStyle = `rgb(${(38 + v * 60) | 0},${(72 + v * 78) | 0},${(34 + v * 42) | 0})`;
                g.beginPath();
                g.ellipse(0, 0, rr(3, 9), rr(1.2, 3), 0, 0, Math.PI * 2);
                g.fill();
                g.restore();
            }
        })
        : null;
    if (foliageTex) {
        foliageTex.wrapS = foliageTex.wrapT = THREE.RepeatWrapping;
        foliageTex.repeat.set(6, 2);
    }

    const ring = new THREE.Mesh(
        new THREE.TorusGeometry(R, 0.062, 10, 30),
        new THREE.MeshStandardMaterial({
            color: foliageTex ? 0xffffff : 0x3c5c33, map: foliageTex, roughness: 0.95, metalness: 0.0,
        })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.062;
    ring.castShadow = true;
    ring.receiveShadow = true;
    group.add(ring);

    /* ---- the poppies ----------------------------------------------------- */

    // One instanced mesh for the petals and one for the black centres — a
    // wreath is two draw calls rather than fifty-two.
    const petalGeo = new THREE.CircleGeometry(0.036, 7);
    const petals = new THREE.InstancedMesh(
        petalGeo,
        new THREE.MeshStandardMaterial({
            color: 0xb5121b, roughness: 0.82, metalness: 0.0, side: THREE.DoubleSide,
        }),
        N
    );
    const centreGeo = new THREE.SphereGeometry(0.011, 6, 5);
    const centres = new THREE.InstancedMesh(
        centreGeo,
        new THREE.MeshStandardMaterial({ color: 0x14100e, roughness: 0.7 }),
        N
    );

    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const p = new THREE.Vector3();
    const s = new THREE.Vector3();
    for (let i = 0; i < N; i++) {
        const a = (i / N) * Math.PI * 2 + rr(-0.06, 0.06);
        const lean = rr(-0.7, 0.7);                 // some face out, some up
        const rad = R + rr(-0.035, 0.035);
        p.set(Math.cos(a) * rad, 0.085 + rr(0, 0.05), Math.sin(a) * rad);
        e.set(-Math.PI / 2 + lean, 0, -a + rr(-0.3, 0.3), 'XYZ');
        q.setFromEuler(e);
        const k = rr(0.82, 1.2);
        s.set(k, k, k);
        m.compose(p, q, s);
        petals.setMatrixAt(i, m);

        p.y += 0.012;
        s.set(1, 1, 1);
        m.compose(p, q, s);
        centres.setMatrixAt(i, m);
    }
    petals.instanceMatrix.needsUpdate = true;
    centres.instanceMatrix.needsUpdate = true;
    petals.castShadow = true;
    centres.castShadow = true;
    group.add(petals, centres);

    /* ---- the card -------------------------------------------------------- */

    const cardTex = helpers && helpers.canvasTexture
        ? helpers.canvasTexture(256, 160, (g, cv) => {
            g.fillStyle = '#efe7d6';
            g.fillRect(0, 0, cv.width, cv.height);
            for (let i = 0; i < 200; i++) {
                g.fillStyle = `rgba(150,140,120,${(rnd() * 0.12).toFixed(3)})`;
                g.fillRect(rr(0, cv.width), rr(0, cv.height), rr(2, 9), rr(2, 6));
            }
            // Rain has been through the ink once already.
            g.fillStyle = 'rgba(90,110,130,0.10)';
            g.beginPath();
            g.ellipse(cv.width * 0.7, cv.height * 0.6, 60, 40, 0.4, 0, Math.PI * 2);
            g.fill();
            g.fillStyle = 'rgba(38,44,60,0.72)';
            g.font = 'italic 30px Georgia, serif';
            g.textAlign = 'center';
            g.fillText('Lest we forget', cv.width / 2, 66);
            g.font = 'italic 22px Georgia, serif';
            g.fillStyle = 'rgba(38,44,60,0.5)';
            g.fillText('— from all of us', cv.width / 2, 108);
        })
        : null;
    const card = new THREE.Mesh(
        new THREE.PlaneGeometry(0.17, 0.11),
        new THREE.MeshStandardMaterial({
            color: cardTex ? 0xffffff : 0xefe7d6, map: cardTex, roughness: 0.95,
            side: THREE.DoubleSide,
        })
    );
    card.position.set(0, 0.031, R * 0.42);
    card.rotation.set(-Math.PI / 2 + 0.18, 0.06, 0);
    card.receiveShadow = true;
    group.add(card);

    const ribbon = new THREE.Mesh(
        new THREE.BoxGeometry(0.026, 0.004, 0.30),
        new THREE.MeshStandardMaterial({ color: 0x6d1420, roughness: 0.7 })
    );
    ribbon.position.set(0.02, 0.014, R * 0.1);
    ribbon.rotation.y = 0.22;
    ribbon.castShadow = true;
    group.add(ribbon);

    return group;
}
