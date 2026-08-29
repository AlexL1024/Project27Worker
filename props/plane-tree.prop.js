//
//  plane-tree.prop.js
//  Project27 — a London plane, the tree of Melbourne's streets.
//
//  Pruned back to the knuckles every winter and left to throw a new head out
//  every summer, which is why a street plane is a fat mottled trunk, three
//  elbows, and a cloud that sits well above head height. About twelve metres,
//  with the crown clear of a tram's pantograph and a grate at its foot.
//
//  Origin at the foot, centred.
//
import { mergeGeometries } from './BufferGeometryUtils.js';

export default function build(THREE, helpers) {
    const G = new THREE.Group();

    const srgb = (hex) => new THREE.Color(hex).convertSRGBToLinear();
    const _q = new THREE.Quaternion(), _e = new THREE.Euler();
    const _v = new THREE.Vector3(), _s = new THREE.Vector3(1, 1, 1);
    const put = (g, x, y, z, rx, ry, rz, s) => {
        _e.set(rx || 0, ry || 0, rz || 0);
        return g.applyMatrix4(new THREE.Matrix4().compose(
            _v.set(x || 0, y || 0, z || 0), _q.setFromEuler(_e),
            _s.set(s || 1, s || 1, s || 1)));
    };
    const merge = (parts) => mergeGeometries(parts.map((g) => (g.index ? g.toNonIndexed() : g)));

    // Deterministic, so two of them dropped side by side are the same tree
    // rather than two arguments about what a tree is.
    let seed = 20260904;
    const rnd = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
    const rr = (a, b) => a + (b - a) * rnd();

    const H = 12.0, TH = H * 0.40;
    const wood = [], leaf = [];
    let g;

    g = new THREE.CylinderGeometry(0.28, 0.46, TH, 10); put(g, 0, TH / 2, 0); wood.push(g);
    g = new THREE.CylinderGeometry(0.50, 0.62, 0.5, 10); put(g, 0, 0.25, 0); wood.push(g);   // the root flare
    for (let i = 0; i < 3; i++) {
        const a = i / 3 * Math.PI * 2 + 0.5;
        g = new THREE.CylinderGeometry(0.10, 0.22, H * 0.30, 7);
        put(g, Math.cos(a) * 0.85, TH + H * 0.11, Math.sin(a) * 0.85,
            Math.sin(a) * 0.55, 0, -Math.cos(a) * 0.55);
        wood.push(g);
        // the knuckle where last winter's cut was
        g = new THREE.SphereGeometry(0.20, 8, 6);
        put(g, Math.cos(a) * 1.5, TH + H * 0.24, Math.sin(a) * 1.5);
        wood.push(g);
    }
    for (let i = 0; i < 5; i++) {
        const r = rr(2.3, 3.6);
        g = new THREE.SphereGeometry(1, 10, 7);
        put(g, rr(-2.3, 2.3), TH + rr(1.5, H * 0.46), rr(-2.3, 2.3), 0, rr(0, 3), 0, r);
        g.scale(1, 0.78, 1);
        leaf.push(g);
    }

    // the bark: a London plane sheds in plates, so it is never one colour
    const bark = helpers && helpers.canvasTexture
        ? helpers.canvasTexture(256, 256, (c, cv) => {
            c.fillStyle = '#8b8272'; c.fillRect(0, 0, cv.width, cv.height);
            for (let i = 0; i < 120; i++) {
                c.fillStyle = ['#6d6355', '#a49a86', '#c3bba4', '#5b5346'][i % 4];
                c.globalAlpha = 0.55;
                c.beginPath();
                c.ellipse(rnd() * 256, rnd() * 256, rr(8, 30), rr(6, 22), rr(0, 3), 0, 6.3);
                c.fill();
            }
            c.globalAlpha = 1;
        })
        : null;
    const woodMat = new THREE.MeshStandardMaterial({ color: srgb(0x8b8272), roughness: 0.9 });
    if (bark) woodMat.map = bark;

    const trunk = new THREE.Mesh(merge(wood), woodMat);
    const crown = new THREE.Mesh(merge(leaf), new THREE.MeshStandardMaterial({
        color: srgb(0x4d6b34), roughness: 0.88, flatShading: true,
    }));
    const grate = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.06, 1.8),
        new THREE.MeshStandardMaterial({ color: srgb(0x3e3830), roughness: 0.9 }));
    grate.position.y = 0.03;

    trunk.castShadow = true; trunk.receiveShadow = true;
    crown.castShadow = true;
    grate.receiveShadow = true;
    G.add(trunk, crown, grate);
    return G;
}
