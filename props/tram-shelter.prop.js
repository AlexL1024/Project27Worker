//
//  tram-shelter.prop.js
//  Project27 — one bay of a Melbourne tram-stop shelter.
//
//  The standard kit that stands on every platform stop in the city: a dark
//  grey steel portal frame, a shallow roof, a glazed back wall and one glazed
//  end, a slatted bench along the back, the blue timetable and network-map
//  panels beside it, and a lit soffit that is the only warm thing on a
//  platform after four o'clock in the winter.
//
//  Origin at the foot, centred, with the open side facing +Z — so dropping it
//  on a platform and turning it to face the track is one rotation.
//
import { mergeGeometries } from './BufferGeometryUtils.js';

export default function build(THREE, helpers) {
    const G = new THREE.Group();

    const srgb = (hex) => new THREE.Color(hex).convertSRGBToLinear();
    const mat = (hex, o) => new THREE.MeshStandardMaterial(
        Object.assign({ color: srgb(hex), roughness: 0.5, metalness: 0.35 }, o || {}));
    const _q = new THREE.Quaternion(), _e = new THREE.Euler();
    const _v = new THREE.Vector3(), _s = new THREE.Vector3(1, 1, 1);
    const put = (g, x, y, z, rx, ry, rz) => {
        _e.set(rx || 0, ry || 0, rz || 0);
        return g.applyMatrix4(new THREE.Matrix4().compose(
            _v.set(x || 0, y || 0, z || 0), _q.setFromEuler(_e), _s.set(1, 1, 1)));
    };
    // Normalised on the way in, because mergeGeometries answers null the moment
    // a list mixes indexed with non-indexed geometry, and a null geometry is a
    // mesh that takes the viewport down with it.
    const merge = (parts) => mergeGeometries(parts.map((g) => (g.index ? g.toNonIndexed() : g)));
    const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
    const cyl = (r, h, s) => new THREE.CylinderGeometry(r, r, h, s || 10);

    const W = 2.5, D = 4.6, H = 2.66;          // one bay, to the underside of the roof

    const steel = [], glass = [], glow = [], navy = [], timber = [];
    let g;

    // ---- frame: four posts down the closed side, and the portal over them
    for (const z of [-D / 2 + 0.3, -D / 2 + D * 0.36, D / 2 - D * 0.36, D / 2 - 0.3]) {
        g = cyl(0.055, H, 8); put(g, -W / 2 + 0.22, H / 2, z); steel.push(g);
    }
    for (const z of [-D / 2 + 0.3, D / 2 - 0.3]) {
        g = cyl(0.048, H, 8); put(g, W / 2 - 0.22, H / 2, z); steel.push(g);
    }
    g = box(W, 0.14, D); put(g, 0, H + 0.07, 0); steel.push(g);              // roof deck
    g = box(W - 0.2, 0.06, D - 0.4); put(g, 0, H - 0.03, 0); steel.push(g);  // its liner
    g = box(W + 0.16, 0.10, 0.09); put(g, 0, H + 0.02, D / 2 + 0.06); steel.push(g);   // drip edge
    g = box(W + 0.16, 0.10, 0.09); put(g, 0, H + 0.02, -D / 2 - 0.06); steel.push(g);

    // ---- glazing: the whole back wall, and the upwind end
    g = box(0.06, 2.05, D - 0.5); put(g, -W / 2 + 0.14, 1.30, 0); glass.push(g);
    g = box(W - 0.5, 1.95, 0.06); put(g, 0.1, 1.30, -D / 2 + 0.16); glass.push(g);

    // ---- the lit soffit
    g = new THREE.PlaneGeometry(W - 0.5, D - 0.8); g.rotateX(Math.PI / 2);
    put(g, 0, H - 0.07, 0); glow.push(g);

    // ---- bench: hardwood slats on steel bearers
    for (let i = 0; i < 4; i++) {
        g = box(0.11, 0.05, D - 1.2); put(g, -W / 2 + 0.42 + i * 0.14, 0.86, 0); timber.push(g);
    }
    for (const z of [-D / 2 + 0.9, 0, D / 2 - 0.9]) {
        g = box(0.62, 0.06, 0.07); put(g, -W / 2 + 0.56, 0.82, z); steel.push(g);
        g = cyl(0.035, 0.82, 6); put(g, -W / 2 + 0.56, 0.41, z); steel.push(g);
    }

    // ---- the blue panels: timetable, network map, and the stop's own number
    for (const z of [-1.35, 0.0, 1.35]) {
        g = box(0.05, 1.10, 1.02); put(g, -W / 2 + 0.20, 1.46, z); navy.push(g);
    }

    const face = helpers && helpers.canvasTexture
        ? helpers.canvasTexture(256, 256, (c, cv) => {
            // a network diagram, at the distance anybody ever really reads it
            c.fillStyle = '#143257'; c.fillRect(0, 0, cv.width, cv.height);
            c.strokeStyle = '#dfe6ee'; c.lineWidth = 5;
            for (let i = 0; i < 6; i++) {
                c.beginPath();
                c.moveTo(20, 40 + i * 34); c.lineTo(120 + i * 14, 40 + i * 34);
                c.lineTo(210, 120 + i * 18); c.stroke();
            }
            c.fillStyle = '#ffd23f';
            for (let i = 0; i < 14; i++) c.fillRect(30 + (i * 37) % 190, 46 + (i * 53) % 180, 8, 8);
        })
        : null;
    const navyMat = mat(0x143257, { roughness: 0.6, metalness: 0.1 });
    if (face) navyMat.map = face;

    const parts = [
        new THREE.Mesh(merge(steel), mat(0x2b3136, { roughness: 0.5, metalness: 0.42 })),
        new THREE.Mesh(merge(glass), mat(0x9fc4d8, {
            roughness: 0.08, metalness: 0.18, transparent: true, opacity: 0.36,
        })),
        new THREE.Mesh(merge(navy), navyMat),
        new THREE.Mesh(merge(timber), mat(0x6b5a44, { roughness: 0.8, metalness: 0.0 })),
        // No light: a prop never spends one of the four its host world is
        // allowed. The soffit is emissive and the world's bloom carries it.
        new THREE.Mesh(merge(glow), new THREE.MeshStandardMaterial({
            color: srgb(0xf4f8ff), emissive: srgb(0xe4eefc), emissiveIntensity: 2.4,
            roughness: 0.4, side: THREE.DoubleSide,
        })),
    ];
    for (const m of parts) { m.castShadow = true; m.receiveShadow = true; G.add(m); }
    return G;
}
