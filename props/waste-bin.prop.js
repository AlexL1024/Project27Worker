//
//  waste-bin.prop.js
//  Project27 object library
//
//  The metal bin from beside the teacher's desk: 0.40 m tall, dented on one
//  side, half a liner hanging out, and three misses on their way to the floor.
//
//  The dent is the reason to build this by hand. A perfect tapered cylinder is
//  a kitchen bin in a catalogue photograph; a bin that has been kicked down a
//  corridor is furniture in a school.
//
//  Origin at the floor, centred. The dent faces +Z, so the good side is the
//  back and a placer can turn it whichever way the room needs.
//

import { mergeGeometries } from './BufferGeometryUtils.js';

export default function build(THREE, helpers) {
    const group = new THREE.Group();

    let seed = 60613;
    const rnd = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
    const rr = (a, b) => a + (b - a) * rnd();

    const paint = (w, h, draw) => (helpers && helpers.canvasTexture ? helpers.canvasTexture(w, h, draw) : null);
    const merge = (parts) => mergeGeometries(parts.map((g) => (g.index ? g.toNonIndexed() : g)));

    const H = 0.385, RTOP = 0.146, RBOT = 0.112;

    /* ---- surfaces ------------------------------------------------------------- */

    const steelTex = paint(512, 256, (g, cv) => {
        const w = cv.width, h = cv.height;
        g.fillStyle = '#7f8790'; g.fillRect(0, 0, w, h);
        // Brushed vertical grain, then the horizontal scars of being dragged.
        for (let i = 0; i < 700; i++) {
            g.fillStyle = `rgba(${rnd() > 0.5 ? '186,194,202' : '92,98,106'},${rr(0.04, 0.22)})`;
            g.fillRect(rr(0, w), rr(0, h), rr(1, 2.5), rr(10, 90));
        }
        for (let i = 0; i < 60; i++) {
            const y = rr(h * 0.55, h);
            g.strokeStyle = `rgba(${rnd() > 0.5 ? '222,228,234' : '58,62,68'},${rr(0.1, 0.35)})`;
            g.lineWidth = rr(0.7, 2.2);
            g.beginPath(); g.moveTo(rr(0, w), y); g.lineTo(rr(0, w), y + rr(-3, 3)); g.stroke();
        }
        for (let i = 0; i < 26; i++) {   // chips, and rust creeping out of them
            const x = rr(0, w), y = rr(h * 0.6, h);
            g.fillStyle = `rgba(126,78,44,${rr(0.2, 0.5)})`;
            g.beginPath(); g.ellipse(x, y, rr(2, 8), rr(2, 6), rr(0, 3), 0, Math.PI * 2); g.fill();
        }
        // A stencilled ward number, mostly worn off.
        g.globalAlpha = 0.22;
        g.fillStyle = '#20242a';
        g.font = 'bold 90px Helvetica, Arial, sans-serif';
        g.textAlign = 'center';
        g.fillText('B7', w * 0.5, h * 0.55);
        g.globalAlpha = 1;
    });
    if (steelTex) { steelTex.wrapS = THREE.RepeatWrapping; }

    const paperTex = paint(256, 256, (g, cv) => {
        const s = cv.width;
        g.fillStyle = '#f2efe6'; g.fillRect(0, 0, s, s);
        for (let i = 0; i < 16; i++) {   // ruled lines, showing through the folds
            g.strokeStyle = 'rgba(120,150,190,0.35)'; g.lineWidth = 1.4;
            const y = 14 + i * (s / 17);
            g.beginPath(); g.moveTo(0, y); g.lineTo(s, y); g.stroke();
        }
        g.strokeStyle = 'rgba(40,44,52,0.55)'; g.lineWidth = 2.2;
        for (let i = 0; i < 30; i++) {   // whatever it was, crossed out
            const y = rr(0, s), x = rr(0, s * 0.6);
            g.beginPath(); g.moveTo(x, y); g.lineTo(x + rr(20, 90), y + rr(-3, 3)); g.stroke();
        }
        g.strokeStyle = 'rgba(190,40,30,0.6)'; g.lineWidth = 4;
        g.beginPath(); g.moveTo(s * 0.15, s * 0.2); g.lineTo(s * 0.8, s * 0.78); g.stroke();
        for (let i = 0; i < 700; i++) {  // crease shading, so folds read as folds
            g.fillStyle = `rgba(${rnd() > 0.5 ? '255,255,255' : '150,146,138'},${rr(0.03, 0.16)})`;
            g.fillRect(rr(0, s), rr(0, s), rr(1, 5), rr(1, 5));
        }
    });

    const steelMat = new THREE.MeshStandardMaterial({
        map: steelTex, color: 0xffffff, roughness: 0.52, metalness: 0.72,
        side: THREE.DoubleSide,
    });
    const paperMat = new THREE.MeshStandardMaterial({
        map: paperTex, color: 0xffffff, roughness: 0.94, side: THREE.DoubleSide,
    });

    /* ---- the bin --------------------------------------------------------------- */

    // A lathed profile: base, taper, rolled rim, and back down the inside so
    // the wall has thickness when you look in over the top.
    const profile = [];
    const P = (x, y) => profile.push(new THREE.Vector2(x, y));
    P(0.001, 0.004);
    P(RBOT - 0.012, 0.004);
    P(RBOT, 0.016);
    P(RTOP - 0.004, H - 0.014);
    P(RTOP, H - 0.004);
    P(RTOP - 0.002, H);
    P(RTOP - 0.007, H - 0.004);
    P(RTOP - 0.010, H - 0.020);
    P(RBOT - 0.008, 0.017);
    P(0.001, 0.017);
    const bin = new THREE.Mesh(new THREE.LatheGeometry(profile, 40), steelMat);

    // Now the kick. One dent pushed in on the +Z side, a shallower one beside
    // it, and the rim pulled slightly out of round above them.
    {
        const pos = bin.geometry.attributes.position;
        const v = new THREE.Vector3();
        const dents = [
            { x: 0.02, y: 0.16, z: 0.14, r: 0.115, depth: 0.030 },
            { x: -0.09, y: 0.27, z: 0.10, r: 0.075, depth: 0.014 },
        ];
        for (let i = 0; i < pos.count; i++) {
            v.fromBufferAttribute(pos, i);
            for (const d of dents) {
                const dist = Math.hypot(v.x - d.x, v.y - d.y, v.z - d.z);
                if (dist >= d.r) continue;
                const fall = Math.cos((dist / d.r) * Math.PI * 0.5);
                const radial = Math.hypot(v.x, v.z) || 1;
                const push = d.depth * fall * fall;
                pos.setX(i, v.x - (v.x / radial) * push);
                pos.setZ(i, v.z - (v.z / radial) * push);
            }
        }
        pos.needsUpdate = true;
        bin.geometry.computeVertexNormals();
    }
    bin.castShadow = true; bin.receiveShadow = true;
    group.add(bin);

    /* ---- the liner -------------------------------------------------------------- */

    // A black sack folded back over the rim, gathered where it was tucked in.
    const linerProfile = [];
    for (let i = 0; i <= 10; i++) {
        const t = i / 10;
        const y = H + 0.026 - t * 0.13;
        const radius = RTOP + 0.010 - t * 0.028 + Math.sin(t * 9) * 0.004;
        linerProfile.push(new THREE.Vector2(radius, y));
    }
    const liner = new THREE.Mesh(
        new THREE.LatheGeometry(linerProfile, 32),
        new THREE.MeshStandardMaterial({
            color: 0x1b1f24, roughness: 0.42, metalness: 0.05, side: THREE.DoubleSide,
        })
    );
    {
        // Crumple it: the plastic never sits as a surface of revolution.
        const pos = liner.geometry.attributes.position;
        const v = new THREE.Vector3();
        for (let i = 0; i < pos.count; i++) {
            v.fromBufferAttribute(pos, i);
            const a = Math.atan2(v.z, v.x);
            const wobble = 1 + 0.06 * Math.sin(a * 7 + v.y * 30) + 0.03 * Math.sin(a * 13);
            pos.setX(i, v.x * wobble);
            pos.setZ(i, v.z * wobble);
            pos.setY(i, v.y + 0.008 * Math.sin(a * 5 + 1.2));
        }
        pos.needsUpdate = true;
        liner.geometry.computeVertexNormals();
    }
    liner.castShadow = true;
    group.add(liner);

    /* ---- the misses -------------------------------------------------------------- */

    // Crumpled paper: an icosahedron with every vertex shoved about, which is
    // what a ball of paper is. Two in the bin, one that did not make it.
    function ball(radius, x, y, z, spin) {
        const g = new THREE.IcosahedronGeometry(radius, 1);
        const pos = g.attributes.position;
        const v = new THREE.Vector3();
        for (let i = 0; i < pos.count; i++) {
            v.fromBufferAttribute(pos, i);
            const n = Math.sin(v.x * 61 + v.y * 37 + v.z * 23) * 0.5 + 0.5;
            v.multiplyScalar(0.72 + n * 0.5);
            pos.setXYZ(i, v.x, v.y, v.z);
        }
        g.computeVertexNormals();
        g.rotateY(spin);
        g.translate(x, y, z);
        return g;
    }
    const paper = new THREE.Mesh(
        merge([
            ball(0.052, 0.02, H - 0.055, -0.01, 0.7),
            ball(0.042, -0.05, H - 0.075, 0.045, 2.1),
            ball(0.047, 0.176, 0.042, 0.128, 4.4),
        ]),
        paperMat
    );
    paper.castShadow = true; paper.receiveShadow = true;
    group.add(paper);

    group.name = 'waste-bin';
    return group;
}
