//
//  traffic-signal.prop.js
//  Project27 — a three-aspect traffic signal on its kerbside post.
//
//  The Australian pattern: a slim grey post on a cast base, a single head with
//  red over amber over green under three cowls, a pedestrian push-button box
//  at hand height, and the black backing board that makes the head readable
//  against a bright sky.
//
//  It stands at red, which is what a signal somebody has just dropped into a
//  scene should be doing: green is a claim about traffic that is not there.
//
//  Origin at the foot of the post, centred; the head faces +Z.
//
import { mergeGeometries } from './BufferGeometryUtils.js';

export default function build(THREE, helpers) {
    void helpers;
    const G = new THREE.Group();

    const srgb = (hex) => new THREE.Color(hex).convertSRGBToLinear();
    const _q = new THREE.Quaternion(), _e = new THREE.Euler();
    const _v = new THREE.Vector3(), _s = new THREE.Vector3(1, 1, 1);
    const put = (g, x, y, z, rx, ry, rz) => {
        _e.set(rx || 0, ry || 0, rz || 0);
        return g.applyMatrix4(new THREE.Matrix4().compose(
            _v.set(x || 0, y || 0, z || 0), _q.setFromEuler(_e), _s.set(1, 1, 1)));
    };
    const merge = (parts) => mergeGeometries(parts.map((g) => (g.index ? g.toNonIndexed() : g)));
    const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
    const cyl = (rt, rb, h, s) => new THREE.CylinderGeometry(rt, rb, h, s || 10);

    const H = 3.55;                      // to the centre of the head
    const iron = [], dark = [];
    let g;

    g = cyl(0.065, 0.075, 5.2, 12); put(g, 0, 2.6, 0); iron.push(g);
    g = cyl(0.13, 0.16, 0.34, 12); put(g, 0, 0.17, 0); iron.push(g);
    g = cyl(0.17, 0.19, 0.06, 12); put(g, 0, 0.03, 0); iron.push(g);
    g = cyl(0.075, 0.075, 0.10, 12); put(g, 0, 5.20, 0); iron.push(g);      // the cap

    // the head, its backing board and the three cowls
    g = box(0.46, 1.35, 0.30); put(g, 0, H, 0.20); dark.push(g);
    g = box(0.62, 1.52, 0.03); put(g, 0, H, 0.045); dark.push(g);
    for (const y of [H + 0.42, H, H - 0.42]) {
        g = box(0.36, 0.05, 0.22); put(g, 0, y + 0.20, 0.44); dark.push(g);
        g = box(0.05, 0.28, 0.22); put(g, -0.175, y + 0.06, 0.44); dark.push(g);
        g = box(0.05, 0.28, 0.22); put(g, 0.175, y + 0.06, 0.44); dark.push(g);
    }
    // the push-button box, at the height a hand actually finds it
    g = box(0.16, 0.30, 0.20); put(g, 0, 1.15, 0.14); dark.push(g);
    g = cyl(0.035, 0.035, 0.03, 10); put(g, 0, 1.20, 0.25, Math.PI / 2, 0, 0); iron.push(g);

    const lens = (col, y, on) => {
        const m = new THREE.Mesh(new THREE.CircleGeometry(0.145, 16),
            new THREE.MeshStandardMaterial({
                color: srgb(on ? col : 0x1a1712),
                emissive: srgb(col),
                emissiveIntensity: on ? 3.0 : 0.04,
                roughness: 0.3,
            }));
        m.position.set(0, y, 0.355);
        return m;
    };

    G.add(new THREE.Mesh(merge(iron), new THREE.MeshStandardMaterial({
        color: srgb(0x6d7276), roughness: 0.44, metalness: 0.5,
    })));
    G.add(new THREE.Mesh(merge(dark), new THREE.MeshStandardMaterial({
        color: srgb(0x2c3238), roughness: 0.5, metalness: 0.4,
    })));
    G.add(lens(0xff2b16, H + 0.42, true));
    G.add(lens(0xffb219, H, false));
    G.add(lens(0x2bff62, H - 0.42, false));

    G.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    return G;
}
