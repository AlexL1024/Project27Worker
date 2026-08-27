//
//  projector.prop.js
//  Project27 object library
//
//  A classroom data projector, the kind that lives on a trolley or the front
//  desk: 0.31 m across, lens off-centre to the left, one adjustable front foot
//  wound out because the image was never square.
//
//  The lens glows and the standby light glows, and neither of them is a light.
//  A prop that adds a PointLight spends one of the four a whole world is
//  allowed on itself; emissive material plus the world's bloom does the same
//  job and costs the world nothing.
//
//  Origin at the feet, centred, lens toward +Z.
//

import { mergeGeometries } from './BufferGeometryUtils.js';

export default function build(THREE, helpers) {
    const group = new THREE.Group();

    let seed = 3301;
    const rnd = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
    const rr = (a, b) => a + (b - a) * rnd();

    const paint = (w, h, draw) => (helpers && helpers.canvasTexture ? helpers.canvasTexture(w, h, draw) : null);
    const V = (x, y, z) => new THREE.Vector3(x, y, z);
    const merge = (parts) => mergeGeometries(parts.map((g) => (g.index ? g.toNonIndexed() : g)));

    const UP = new THREE.Vector3(0, 1, 0);
    function rod(a, b, radius, segments = 8) {
        const dir = new THREE.Vector3().subVectors(b, a);
        const length = dir.length();
        const g = new THREE.CylinderGeometry(radius, radius, length, segments, 1);
        g.applyMatrix4(new THREE.Matrix4().compose(
            new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5),
            new THREE.Quaternion().setFromUnitVectors(UP, dir.normalize()),
            new THREE.Vector3(1, 1, 1)));
        return g;
    }

    function roundedRect(w, d, r) {
        const s = new THREE.Shape();
        const x = w / 2, z = d / 2;
        s.moveTo(-x + r, -z);
        s.lineTo(x - r, -z); s.quadraticCurveTo(x, -z, x, -z + r);
        s.lineTo(x, z - r); s.quadraticCurveTo(x, z, x - r, z);
        s.lineTo(-x + r, z); s.quadraticCurveTo(-x, z, -x, z - r);
        s.lineTo(-x, -z + r); s.quadraticCurveTo(-x, -z, -x + r, -z);
        return s;
    }
    function slab(w, d, r, thickness, y) {
        const g = new THREE.ExtrudeGeometry(roundedRect(w, d, r), {
            depth: thickness, bevelEnabled: false, curveSegments: 5,
        });
        g.rotateX(-Math.PI / 2);
        g.translate(0, y, 0);
        return g;
    }

    const W = 0.31, D = 0.26, FOOT = 0.014, BODY = 0.088;

    /* ---- surfaces ---------------------------------------------------------- */

    // Off-white plastic that has been in a room with a projector's own exhaust
    // for years: warm, faintly yellowed on the vent side, dusty on top.
    const caseTex = paint(512, 512, (g, cv) => {
        const s = cv.width;
        g.fillStyle = '#dcd7cd'; g.fillRect(0, 0, s, s);
        const warm = g.createLinearGradient(0, 0, s, 0);
        warm.addColorStop(0, 'rgba(212,196,160,0)');
        warm.addColorStop(1, 'rgba(206,186,142,0.5)');
        g.fillStyle = warm; g.fillRect(0, 0, s, s);
        for (let i = 0; i < 1400; i++) {   // the fine pebble of moulded ABS
            g.fillStyle = `rgba(${rnd() > 0.5 ? '255,253,246' : '160,154,142'},${rr(0.03, 0.14)})`;
            g.fillRect(rr(0, s), rr(0, s), rr(1, 2.4), rr(1, 2.4));
        }
        for (let i = 0; i < 40; i++) {     // dust settled in a still room
            const x = rr(0, s), y = rr(0, s);
            const grad = g.createRadialGradient(x, y, 1, x, y, rr(10, 40));
            grad.addColorStop(0, 'rgba(150,146,138,0.16)');
            grad.addColorStop(1, 'rgba(150,146,138,0)');
            g.fillStyle = grad; g.fillRect(x - 44, y - 44, 88, 88);
        }
    });

    const ventTex = paint(256, 128, (g, cv) => {
        const w = cv.width, h = cv.height;
        g.fillStyle = '#c9c4ba'; g.fillRect(0, 0, w, h);
        for (let i = 0; i < 18; i++) {     // louvre slots, dark inside
            const x = 12 + i * ((w - 24) / 18);
            g.fillStyle = '#2b2926';
            g.fillRect(x, 14, 6, h - 28);
            g.fillStyle = 'rgba(255,255,255,0.35)';
            g.fillRect(x + 6, 14, 2, h - 28);
        }
        // Dust caked along the bottom of every slot, because it is an intake.
        g.fillStyle = 'rgba(122,112,96,0.5)';
        g.fillRect(0, h - 22, w, 8);
    });

    const caseMat = new THREE.MeshStandardMaterial({
        map: caseTex, color: 0xffffff, roughness: 0.66, metalness: 0.0,
    });
    const lidMat = new THREE.MeshStandardMaterial({ color: 0x53575c, roughness: 0.55 });
    const ventMat = new THREE.MeshStandardMaterial({ map: ventTex, color: 0xffffff, roughness: 0.8 });
    const metalMat = new THREE.MeshStandardMaterial({ color: 0x8d949a, roughness: 0.3, metalness: 0.9 });
    const rubberMat = new THREE.MeshStandardMaterial({ color: 0x22252a, roughness: 0.95 });

    /* ---- the body ----------------------------------------------------------- */

    const body = new THREE.Mesh(slab(W, D, 0.022, BODY, FOOT), caseMat);
    body.castShadow = true; body.receiveShadow = true;
    group.add(body);

    // The lid is a separate moulding on every one of these, and the seam is
    // the only thing that stops the case reading as a single grey brick.
    const lid = new THREE.Mesh(slab(W - 0.026, D - 0.026, 0.016, 0.010, FOOT + BODY - 0.002), lidMat);
    lid.castShadow = true;
    group.add(lid);

    const vent = new THREE.Mesh(new THREE.PlaneGeometry(0.20, 0.056), ventMat);
    vent.position.set(-W / 2 - 0.0012, FOOT + 0.040, -0.01);
    vent.rotation.y = -Math.PI / 2;
    group.add(vent);

    const exhaust = new THREE.Mesh(new THREE.PlaneGeometry(0.13, 0.05), ventMat);
    exhaust.position.set(0.115, FOOT + 0.044, D / 2 + 0.0012);
    group.add(exhaust);

    /* ---- the lens ----------------------------------------------------------- */

    const LX = -0.072, LY = FOOT + 0.046, LZ = D / 2;

    const barrel = new THREE.Mesh(merge([
        // The recessed housing the barrel sits in, then the barrel itself.
        new THREE.CylinderGeometry(0.047, 0.047, 0.016, 24).rotateX(Math.PI / 2).translate(LX, LY, LZ - 0.004),
        new THREE.CylinderGeometry(0.038, 0.040, 0.034, 24).rotateX(Math.PI / 2).translate(LX, LY, LZ + 0.014),
        // A knurled focus ring: a ridge of small boxes rather than a smooth tube.
        new THREE.CylinderGeometry(0.042, 0.042, 0.010, 30, 1).rotateX(Math.PI / 2).translate(LX, LY, LZ + 0.022),
    ]), new THREE.MeshStandardMaterial({ color: 0x3a3d42, roughness: 0.45, metalness: 0.35 }));
    barrel.castShadow = true;
    group.add(barrel);

    // The glass. Cool, bright, and a touch of the coating's magenta at the rim.
    const glass = new THREE.Mesh(
        new THREE.SphereGeometry(0.062, 20, 12, 0, Math.PI * 2, 0, 0.55).rotateX(Math.PI / 2),
        new THREE.MeshStandardMaterial({
            color: 0x1a2434, roughness: 0.08, metalness: 0.6,
            emissive: 0xbfd8ff, emissiveIntensity: 1.9,
        })
    );
    glass.scale.set(0.55, 0.55, 0.24);
    glass.position.set(LX, LY, LZ + 0.030);
    group.add(glass);

    const lensRing = new THREE.Mesh(
        new THREE.TorusGeometry(0.0345, 0.0035, 8, 26).translate(LX, LY, LZ + 0.031),
        metalMat
    );
    group.add(lensRing);

    /* ---- controls ----------------------------------------------------------- */

    const buttons = [];
    for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        buttons.push(new THREE.CylinderGeometry(0.0075, 0.0075, 0.004, 10)
            .translate(0.088 + Math.cos(a) * 0.021, FOOT + BODY + 0.009, -0.062 + Math.sin(a) * 0.021));
    }
    buttons.push(new THREE.CylinderGeometry(0.011, 0.011, 0.004, 12).translate(0.088, FOOT + BODY + 0.009, -0.062));
    const keypad = new THREE.Mesh(merge(buttons), new THREE.MeshStandardMaterial({ color: 0x2e3237, roughness: 0.7 }));
    group.add(keypad);

    // Standby amber and lamp green, side by side, one of them always on.
    const lamps = new THREE.Mesh(
        merge([
            new THREE.SphereGeometry(0.0045, 8, 6).translate(-0.014, FOOT + BODY + 0.008, -0.086),
            new THREE.SphereGeometry(0.0045, 8, 6).translate(0.004, FOOT + BODY + 0.008, -0.086),
        ]),
        new THREE.MeshStandardMaterial({ color: 0x2b7d3a, emissive: 0x4fe07a, emissiveIntensity: 2.6, roughness: 0.3 })
    );
    group.add(lamps);

    /* ---- feet and tail ------------------------------------------------------- */

    // Two fixed rubber feet at the back, one screw foot at the front wound
    // most of the way out — which is how every projector on a desk sits.
    const feet = merge([
        new THREE.CylinderGeometry(0.014, 0.016, FOOT, 12).translate(-0.11, FOOT / 2, -0.095),
        new THREE.CylinderGeometry(0.014, 0.016, FOOT, 12).translate(0.11, FOOT / 2, -0.095),
        new THREE.CylinderGeometry(0.011, 0.011, 0.020, 12).translate(0.0, 0.010, 0.093),
        new THREE.CylinderGeometry(0.006, 0.006, 0.016, 8).translate(0.0, 0.022, 0.093),
    ]);
    const footMesh = new THREE.Mesh(feet, rubberMat);
    footMesh.receiveShadow = true;
    group.add(footMesh);

    // The mains lead, leaving the back and falling to the floor in the loose
    // curve a cable takes when nobody has ever coiled it.
    const cable = [];
    const path = [];
    for (let i = 0; i <= 12; i++) {
        const t = i / 12;
        path.push(V(
            0.12 + t * 0.03 + Math.sin(t * 4.2) * 0.025,
            (FOOT + 0.03) * (1 - t) * (1 - t) + 0.006,
            -D / 2 - t * 0.075 + Math.sin(t * 5.1) * 0.018
        ));
    }
    for (let i = 0; i < path.length - 1; i++) cable.push(rod(path[i], path[i + 1], 0.0045, 6));
    const lead = new THREE.Mesh(merge(cable), rubberMat);
    lead.castShadow = true;
    group.add(lead);

    group.name = 'projector';
    return group;
}
