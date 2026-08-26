//
//  crumb-hour.scene.js
//  Project27 worlds
//
//  A city park at the hour the crumbs come out: low gold light across a
//  flagstone plaza, a cast-iron bench, and one pigeon standing on the back
//  rail with the whole square to itself.
//
//  The bird is the point, so the bird is where the work went — a swept neck
//  carrying a fresnel-banded iridescence shader, canvas-painted wing bars,
//  a fanned tail, gripping toes, and a small nervous system that bobs,
//  scans, blinks, ruffles and preens on its own irregular clock.
//

export default function build(world) {
    const { THREE, scene, camera } = world;

    world.ownsSky(true);
    world.groundLevel(0);
    world.bloom({ strength: 0.34, radius: 0.62, threshold: 0.80 });

    /* ==========================================================
       0 · Small tools
       ========================================================== */

    const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
    const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
    const lerp = (a, b, t) => a + (b - a) * t;
    const smooth = (e0, e1, x) => { const t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };
    const srgb = (hex) => new THREE.Color(hex).convertSRGBToLinear();

    // Deterministic: the square is arranged the same way every time it opens.
    let _seed = 20260826;
    const rnd = () => { _seed = (_seed * 1664525 + 1013904223) % 4294967296; return _seed / 4294967296; };
    const rr = (a, b) => a + (b - a) * rnd();
    const pick = (arr) => arr[Math.floor(rnd() * arr.length) % arr.length];

    const uTime = { value: 0 };

    /**
     * A closed tube swept along a polyline with a per-station elliptical
     * radius. Nearly every organic piece here — neck, legs, toes, folded
     * wings, bench ironwork, branches — is one of these.
     */
    function sweep(points, radiusOf, radialSegs = 12, cap = true) {
        const N = points.length;
        const pos = [], nor = [], uvs = [], idx = [];
        const tangents = [];
        for (let i = 0; i < N; i++) {
            const a = points[Math.max(0, i - 1)], b = points[Math.min(N - 1, i + 1)];
            const t = new THREE.Vector3().subVectors(b, a);
            if (t.lengthSq() < 1e-12) t.set(0, 1, 0);
            tangents.push(t.normalize());
        }
        const ref = Math.abs(tangents[0].y) > 0.9 ? V3(1, 0, 0) : V3(0, 1, 0);
        let nrm = new THREE.Vector3().crossVectors(tangents[0], ref).normalize();
        for (let i = 0; i < N; i++) {
            // Parallel transport keeps the frame from spinning along the sweep.
            nrm = nrm.clone().addScaledVector(tangents[i], -nrm.dot(tangents[i]));
            if (nrm.lengthSq() < 1e-10) nrm = new THREE.Vector3().crossVectors(tangents[i], ref);
            nrm.normalize();
            const bin = new THREE.Vector3().crossVectors(tangents[i], nrm).normalize();
            const t = N > 1 ? i / (N - 1) : 0;
            const r = radiusOf(t, i);
            const ra = (typeof r === 'number') ? r : r[0];
            const rb = (typeof r === 'number') ? r : r[1];
            for (let j = 0; j <= radialSegs; j++) {
                const a = (j / radialSegs) * Math.PI * 2;
                const dir = nrm.clone().multiplyScalar(Math.cos(a) * ra)
                    .addScaledVector(bin, Math.sin(a) * rb);
                const p = points[i].clone().add(dir);
                const n = nrm.clone().multiplyScalar(Math.cos(a) / Math.max(ra, 1e-5))
                    .addScaledVector(bin, Math.sin(a) / Math.max(rb, 1e-5)).normalize();
                pos.push(p.x, p.y, p.z);
                nor.push(n.x, n.y, n.z);
                uvs.push(j / radialSegs, t);
            }
        }
        for (let i = 0; i < N - 1; i++) {
            for (let j = 0; j < radialSegs; j++) {
                const a = i * (radialSegs + 1) + j, b = a + radialSegs + 1;
                idx.push(a, b, a + 1, b, b + 1, a + 1);
            }
        }
        if (cap) {
            for (const end of [0, N - 1]) {
                const centre = points[end];
                const sign = end === 0 ? -1 : 1;
                const nrmv = tangents[end].clone().multiplyScalar(sign);
                const base = pos.length / 3;
                pos.push(centre.x, centre.y, centre.z);
                nor.push(nrmv.x, nrmv.y, nrmv.z);
                uvs.push(0.5, end === 0 ? 0 : 1);
                const ring = end * (radialSegs + 1);
                for (let j = 0; j < radialSegs; j++) {
                    const a = ring + j, b = ring + j + 1;
                    if (end === 0) idx.push(base, a, b); else idx.push(base, b, a);
                }
            }
        }
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
        g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
        g.setIndex(idx);
        // The analytic normals above are kept on purpose: recomputing them
        // would crease every sweep along its UV seam.
        return g;
    }

    /** A slat with rounded long edges — bench wood, without a bevel modifier. */
    function slatGeometry(length, thick, depth) {
        return new THREE.CylinderGeometry(0.5, 0.5, length, 14, 1)
            .rotateZ(Math.PI / 2).scale(1, thick, depth);
    }

    /** A tapered flat feather in the XZ plane, root at origin, tip at -z. */
    function featherGeometry(len, wide, tipWide, curl) {
        const rows = 8, cols = 3;
        const pos = [], uvs = [], idx = [];
        for (let i = 0; i <= rows; i++) {
            const t = i / rows;
            const w = lerp(wide, tipWide, Math.pow(t, 0.8)) * (1 - 0.25 * t * t);
            const drop = -curl * t * t;
            for (let j = 0; j <= cols; j++) {
                const u = j / cols;
                pos.push((u - 0.5) * w, drop + Math.cos((u - 0.5) * Math.PI) * 0.0015, -t * len);
                uvs.push(u, t);
            }
        }
        for (let i = 0; i < rows; i++) for (let j = 0; j < cols; j++) {
            const a = i * (cols + 1) + j, b = a + cols + 1;
            idx.push(a, b, a + 1, b, b + 1, a + 1);
        }
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
        g.setIndex(idx);
        g.computeVertexNormals();
        return g;
    }

    /* ==========================================================
       1 · Light, sky, air
       ========================================================== */

    const SUN_DIR = V3(0.63, 0.235, -0.74).normalize();
    const C_SUN = srgb(0xffdca6);
    const C_TOP = srgb(0x2c69bf);
    const C_MID = srgb(0x86b6e0);
    const C_HOR = srgb(0xf2d4a8);

    scene.fog = new THREE.FogExp2(0xe4cba9, 0.0125);
    camera.position.set(1.35, 1.18, 1.75);

    const sun = new THREE.DirectionalLight(0xffdcac, 3.4);
    sun.position.copy(SUN_DIR).multiplyScalar(60);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    {
        const c = sun.shadow.camera;
        c.left = -9; c.right = 9; c.top = 9; c.bottom = -9; c.near = 20; c.far = 110;
        sun.shadow.bias = -0.0004;
        sun.shadow.normalBias = 0.018;
        sun.shadow.radius = 1.6;
    }
    scene.add(sun, sun.target);
    scene.add(new THREE.HemisphereLight(0xbcd8ff, 0x6a5a44, 1.15));
    scene.add(new THREE.AmbientLight(0xffe6c8, 0.22));
    // A cool fill from the shadow side so slate feathers keep their blue.
    const fill = new THREE.DirectionalLight(0x9fc4ff, 0.55);
    fill.position.set(-4, 3, 5);
    scene.add(fill);

    const SKY_GLSL = /* glsl */`
      vec3 skyColor(vec3 d, vec3 sunDir, vec3 top, vec3 mid, vec3 hor, vec3 sunCol) {
        float h = d.y;
        vec3 col = mix(hor, mid, smoothstep(-0.01, 0.26, h));
        col = mix(col, top, smoothstep(0.14, 0.82, h));
        float sd = max(dot(normalize(d), sunDir), 0.0);
        vec3 glow = mix(sunCol, vec3(1.0), 0.35);
        col += glow * pow(sd, 26.0) * 0.55;
        col += glow * pow(sd, 4.0) * 0.085;
        col = mix(col, hor * 1.02, smoothstep(0.10, -0.05, h));
        return col;
      }
    `;

    const skyUniforms = {
        uSunDir: { value: SUN_DIR.clone() }, uSunCol: { value: C_SUN.clone() },
        uTop: { value: C_TOP.clone() }, uMid: { value: C_MID.clone() }, uHor: { value: C_HOR.clone() },
    };

    const sky = new THREE.Mesh(
        new THREE.SphereGeometry(900, 48, 32),
        new THREE.ShaderMaterial({
            side: THREE.BackSide, depthWrite: false, fog: false, uniforms: skyUniforms,
            vertexShader: `varying vec3 vDir;
              void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
            fragmentShader: SKY_GLSL + `
              varying vec3 vDir; uniform vec3 uSunDir, uSunCol, uTop, uMid, uHor;
              void main(){
                vec3 d = normalize(vDir);
                vec3 col = skyColor(d, uSunDir, uTop, uMid, uHor, uSunCol);
                col += uSunCol * smoothstep(0.9990, 0.99975, max(dot(d, uSunDir), 0.0)) * 7.0;
                gl_FragColor = vec4(col, 1.0);
              }`,
        })
    );
    sky.renderOrder = -10;
    scene.add(sky);

    // A cheap equirect environment so the ironwork and the eye have something
    // to reflect. three PMREM-filters this for us once it is handed over.
    const envTex = world.canvasTexture(256, 128, (g, cv) => {
        const grad = g.createLinearGradient(0, 0, 0, cv.height);
        grad.addColorStop(0.00, '#2f6cc2');
        grad.addColorStop(0.42, '#8fbde4');
        grad.addColorStop(0.52, '#f6dcb2');
        grad.addColorStop(0.62, '#c9a681');
        grad.addColorStop(1.00, '#4a4034');
        g.fillStyle = grad; g.fillRect(0, 0, cv.width, cv.height);
        const sunx = cv.width * 0.30, suny = cv.height * 0.46;
        const s = g.createRadialGradient(sunx, suny, 1, sunx, suny, cv.width * 0.22);
        s.addColorStop(0, 'rgba(255,246,224,1)');
        s.addColorStop(1, 'rgba(255,236,200,0)');
        g.fillStyle = s; g.fillRect(0, 0, cv.width, cv.height);
    });
    envTex.mapping = THREE.EquirectangularReflectionMapping;
    scene.environment = envTex;

    /* ==========================================================
       2 · Painted textures
       ========================================================== */

    const speckle = (g, w, h, n, fn) => { for (let i = 0; i < n; i++) fn(g, rr(0, w), rr(0, h)); };

    const pavingTex = world.canvasTexture(512, 512, (g, cv) => {
        const S = cv.width;
        g.fillStyle = '#5f5850'; g.fillRect(0, 0, S, S);
        const cells = 4, cw = S / cells, grout = 6;
        for (let i = 0; i < cells; i++) for (let j = 0; j < cells; j++) {
            const tone = 150 + rr(-22, 22), warm = rr(0, 12);
            g.fillStyle = `rgb(${tone + warm | 0},${tone + warm * 0.6 | 0},${tone - warm * 0.3 | 0})`;
            g.fillRect(i * cw + grout, j * cw + grout, cw - grout * 2, cw - grout * 2);
            // Worn, lighter centres and darker corners.
            const cx = i * cw + cw / 2, cy = j * cw + cw / 2;
            const rad = g.createRadialGradient(cx + rr(-14, 14), cy + rr(-14, 14), 4, cx, cy, cw * 0.62);
            rad.addColorStop(0, 'rgba(255,248,232,0.16)');
            rad.addColorStop(1, 'rgba(60,52,44,0.20)');
            g.fillStyle = rad;
            g.fillRect(i * cw + grout, j * cw + grout, cw - grout * 2, cw - grout * 2);
        }
        g.globalAlpha = 0.10;
        speckle(g, S, S, 2600, (gg, x, y) => {
            gg.fillStyle = rnd() > 0.5 ? '#ffffff' : '#241d16';
            gg.fillRect(x, y, 1.4, 1.4);
        });
        g.globalAlpha = 0.22;
        g.strokeStyle = '#3a332c'; g.lineWidth = 1.1;
        for (let i = 0; i < 10; i++) {  // hairline cracks, kept off the tile seams
            const x = rr(40, S - 40), y = rr(40, S - 40);
            g.beginPath(); g.moveTo(x, y);
            let px = x, py = y;
            for (let k = 0; k < 5; k++) { px += rr(-22, 22); py += rr(-22, 22); g.lineTo(px, py); }
            g.stroke();
        }
        g.globalAlpha = 1;
    });
    pavingTex.wrapS = pavingTex.wrapT = THREE.RepeatWrapping;
    pavingTex.repeat.set(11, 11);

    const woodTex = world.canvasTexture(128, 512, (g, cv) => {
        const W = cv.width, H = cv.height;
        g.fillStyle = '#6d4f34'; g.fillRect(0, 0, W, H);
        for (let i = 0; i < 90; i++) {   // grain, running the length of the slat
            const x = rr(0, W);
            g.strokeStyle = `rgba(${40 + rr(0, 70) | 0},${28 + rr(0, 48) | 0},${18 + rr(0, 34) | 0},${rr(0.10, 0.42)})`;
            g.lineWidth = rr(0.6, 2.6);
            g.beginPath(); g.moveTo(x, -8);
            let px = x;
            for (let y = 0; y <= H + 8; y += 26) { px += rr(-2.6, 2.6); g.lineTo(px, y); }
            g.stroke();
        }
        for (let i = 0; i < 3; i++) {    // knots
            const x = rr(10, W - 10), y = rr(30, H - 30);
            for (let k = 6; k > 0; k--) {
                g.strokeStyle = `rgba(46,30,18,${0.10 + k * 0.045})`;
                g.lineWidth = 1.4;
                g.beginPath(); g.ellipse(x, y, k * 2.2, k * 4.4, rr(-0.3, 0.3), 0, Math.PI * 2); g.stroke();
            }
        }
        // Sun-bleached streaks: this bench has stood a while.
        g.globalAlpha = 0.20;
        for (let i = 0; i < 14; i++) {
            g.fillStyle = rnd() > 0.4 ? '#cfae86' : '#3a2718';
            g.fillRect(rr(0, W), rr(0, H), rr(2, 9), rr(24, 150));
        }
        g.globalAlpha = 1;
    });
    woodTex.wrapS = woodTex.wrapT = THREE.RepeatWrapping;
    woodTex.repeat.set(1, 3);

    const barkTex = world.canvasTexture(256, 256, (g, cv) => {
        const S = cv.width;
        g.fillStyle = '#7d7566'; g.fillRect(0, 0, S, S);
        for (let i = 0; i < 220; i++) {  // plane-tree camouflage plates
            const x = rr(0, S), y = rr(0, S), w = rr(10, 46), h = rr(14, 54);
            const tone = pick(['#a49a86', '#8d8676', '#5e5a4c', '#c3b8a0', '#6f6858']);
            g.fillStyle = tone; g.globalAlpha = rr(0.35, 0.9);
            g.beginPath(); g.ellipse(x, y, w * 0.5, h * 0.5, rr(0, 3.14), 0, Math.PI * 2); g.fill();
        }
        g.globalAlpha = 0.35; g.strokeStyle = '#453f34'; g.lineWidth = 1.4;
        for (let i = 0; i < 40; i++) {
            const x = rr(0, S);
            g.beginPath(); g.moveTo(x, 0);
            let px = x;
            for (let y = 0; y < S; y += 24) { px += rr(-4, 4); g.lineTo(px, y); }
            g.stroke();
        }
        g.globalAlpha = 1;
    });
    barkTex.wrapS = barkTex.wrapT = THREE.RepeatWrapping;
    barkTex.repeat.set(2, 4);

    const leafTex = world.canvasTexture(256, 256, (g, cv) => {
        const S = cv.width;
        const leaf = (x, y, r, rot, col) => {
            g.save(); g.translate(x, y); g.rotate(rot);
            g.fillStyle = col;
            g.beginPath();
            g.moveTo(0, -r);
            g.bezierCurveTo(r * 0.95, -r * 0.55, r * 0.75, r * 0.55, 0, r);
            g.bezierCurveTo(-r * 0.75, r * 0.55, -r * 0.95, -r * 0.55, 0, -r);
            g.fill();
            g.strokeStyle = 'rgba(40,60,26,0.35)'; g.lineWidth = 1.1;
            g.beginPath(); g.moveTo(0, -r * 0.9); g.lineTo(0, r * 0.9); g.stroke();
            g.restore();
        };
        const greens = ['#5f8c37', '#71a044', '#4d7a2c', '#87ab52', '#3f6626', '#9cb75c'];
        for (let i = 0; i < 44; i++) {
            const a = rr(0, Math.PI * 2), rad = rr(0, S * 0.44);
            leaf(S / 2 + Math.cos(a) * rad, S / 2 + Math.sin(a) * rad * 0.86,
                rr(20, 42), rr(0, Math.PI * 2), pick(greens));
        }
    });

    const featherTex = world.canvasTexture(256, 256, (g, cv) => {
        const S = cv.width;
        g.fillStyle = '#ffffff'; g.fillRect(0, 0, S, S);
        // Soft scalloped feather rows — the mottle that keeps a bird off-plastic.
        for (let row = 0; row < 22; row++) {
            const y = (row / 22) * S;
            for (let i = 0; i < 26; i++) {
                const x = (i / 26) * S + (row % 2) * (S / 52);
                g.fillStyle = `rgba(${rnd() > 0.5 ? '255,255,255' : '196,200,208'},${rr(0.10, 0.34)})`;
                g.beginPath(); g.ellipse(x, y, S / 46, S / 30, 0, 0, Math.PI * 2); g.fill();
            }
            g.strokeStyle = `rgba(120,126,138,${rr(0.05, 0.14)})`;
            g.lineWidth = 1.2;
            g.beginPath(); g.moveTo(0, y + S / 40); g.lineTo(S, y + S / 40); g.stroke();
        }
        g.globalAlpha = 0.10;
        speckle(g, S, S, 900, (gg, x, y) => { gg.fillStyle = '#7d8492'; gg.fillRect(x, y, 1.6, 1.6); });
        g.globalAlpha = 1;
    });
    featherTex.wrapS = featherTex.wrapT = THREE.RepeatWrapping;

    /** The folded wing, bars and all. v runs root (0) → tip (1). */
    function wingTexture(barDark, base) {
        return world.canvasTexture(128, 512, (g, cv) => {
            const W = cv.width, H = cv.height;
            const vy = (v) => (1 - v) * H;      // flipY: canvas top is v = 1
            g.fillStyle = base; g.fillRect(0, 0, W, H);
            // Coverts: rows of small scallops thinning toward the tip.
            for (let row = 0; row < 30; row++) {
                const v = row / 30;
                const y = vy(v);
                for (let i = 0; i < 9; i++) {
                    g.fillStyle = `rgba(255,255,255,${rr(0.03, 0.13)})`;
                    g.beginPath();
                    g.ellipse((i / 9) * W + (row % 2) * (W / 18), y, W / 15, H / 90, 0, 0, Math.PI * 2);
                    g.fill();
                }
            }
            // The two bars. Every blue-bar pigeon in every square has these.
            const bar = (v0, v1) => {
                const grad = g.createLinearGradient(0, vy(v1), 0, vy(v0));
                grad.addColorStop(0, 'rgba(0,0,0,0)');
                grad.addColorStop(0.3, barDark);
                grad.addColorStop(0.7, barDark);
                grad.addColorStop(1, 'rgba(0,0,0,0)');
                g.fillStyle = grad;
                g.fillRect(0, vy(v1), W, vy(v0) - vy(v1));
            };
            bar(0.395, 0.455);
            bar(0.545, 0.605);
            // Primaries darken and streak toward the tip.
            const tip = g.createLinearGradient(0, vy(1.0), 0, vy(0.70));
            tip.addColorStop(0, 'rgba(38,42,50,0.92)');
            tip.addColorStop(1, 'rgba(38,42,50,0)');
            g.fillStyle = tip; g.fillRect(0, 0, W, vy(0.70));
            g.strokeStyle = 'rgba(24,26,32,0.45)'; g.lineWidth = 1.6;
            for (let i = 0; i < 7; i++) {
                const x = (i / 7) * W + W / 14;
                g.beginPath(); g.moveTo(x, vy(1.0)); g.lineTo(x + rr(-6, 6), vy(0.66)); g.stroke();
            }
            // A pale shoulder where the wing meets the mantle.
            const root = g.createLinearGradient(0, vy(0.0), 0, vy(0.22));
            root.addColorStop(0, 'rgba(255,252,246,0.30)');
            root.addColorStop(1, 'rgba(255,252,246,0)');
            g.fillStyle = root; g.fillRect(0, vy(0.22), W, vy(0.0) - vy(0.22));
        });
    }

    /** Tail feathers: slate with the black terminal band. */
    function tailTexture(base) {
        return world.canvasTexture(64, 256, (g, cv) => {
            const W = cv.width, H = cv.height;
            const vy = (v) => (1 - v) * H;
            g.fillStyle = base; g.fillRect(0, 0, W, H);
            g.strokeStyle = 'rgba(255,255,255,0.14)'; g.lineWidth = 1;
            for (let i = 0; i < 40; i++) {
                const y = rr(0, H);
                g.beginPath(); g.moveTo(0, y); g.lineTo(W, y + rr(-3, 3)); g.stroke();
            }
            const band = g.createLinearGradient(0, vy(1.0), 0, vy(0.66));
            band.addColorStop(0, 'rgba(22,24,30,0.96)');
            band.addColorStop(0.55, 'rgba(22,24,30,0.88)');
            band.addColorStop(1, 'rgba(22,24,30,0)');
            g.fillStyle = band; g.fillRect(0, 0, W, vy(0.66));
            g.fillStyle = 'rgba(214,218,226,0.55)';
            g.fillRect(0, vy(0.70), W, 4);
        });
    }

    /* ==========================================================
       3 · The square underfoot
       ========================================================== */

    const PLAZA_R = 13.5;

    const plaza = new THREE.Mesh(
        new THREE.CircleGeometry(PLAZA_R, 96).rotateX(-Math.PI / 2),
        new THREE.MeshStandardMaterial({
            map: pavingTex, color: 0xb9ad9c, roughness: 0.92, metalness: 0.0,
            envMapIntensity: 0.35,
        })
    );
    plaza.receiveShadow = true;
    scene.add(world.ground(plaza));

    // Kerb ring: the plaza sits a hand's width proud of the lawn.
    const kerb = new THREE.Mesh(
        new THREE.CylinderGeometry(PLAZA_R, PLAZA_R - 0.02, 0.17, 96, 1, true),
        new THREE.MeshStandardMaterial({ color: 0x9a9084, roughness: 0.95, side: THREE.DoubleSide })
    );
    kerb.position.y = -0.08;
    kerb.receiveShadow = true;
    scene.add(world.ground(kerb));

    const lawn = new THREE.Mesh(
        new THREE.RingGeometry(PLAZA_R - 0.08, 62, 96, 6).rotateX(-Math.PI / 2),
        new THREE.MeshStandardMaterial({ color: 0x4c6a33, roughness: 1.0, envMapIntensity: 0.2 })
    );
    lawn.position.y = -0.16;
    lawn.receiveShadow = true;
    scene.add(world.ground(lawn));

    /* --- Grass: one draw call, wind in the vertex stage ------------------ */

    function windPatch(material, bendPower, amount, rate) {
        material.onBeforeCompile = (sh) => {
            sh.uniforms.uTime = uTime;
            sh.vertexShader = sh.vertexShader
                .replace('#include <common>', `#include <common>
                    uniform float uTime;`)
                .replace('#include <begin_vertex>', `#include <begin_vertex>
                    #ifdef USE_INSTANCING
                      vec3 iOrigin = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
                    #else
                      vec3 iOrigin = vec3(0.0);
                    #endif
                    float ph = iOrigin.x * 1.9 + iOrigin.z * 2.7;
                    float gust = 0.62 + 0.38 * sin(uTime * 0.23 + iOrigin.x * 0.09 + iOrigin.z * 0.07);
                    float swayA = sin(uTime * ${rate.toFixed(3)} + ph) * 0.7
                                + sin(uTime * ${(rate * 2.31).toFixed(3)} + ph * 1.7) * 0.3;
                    float w = pow(max(transformed.y, 0.0), ${bendPower.toFixed(2)}) * ${amount.toFixed(4)} * gust;
                    transformed.x += swayA * w;
                    transformed.z += swayA * 0.55 * w;`);
        };
        material.customProgramCacheKey = () => 'wind' + bendPower + amount + rate;
        return material;
    }

    {
        const blade = new THREE.BufferGeometry();
        const bp = [], bu = [], bi = [];
        const segs = 3, half = 0.011;
        for (let i = 0; i <= segs; i++) {
            const t = i / segs;
            const w = half * (1 - t * 0.92);
            const y = t * 0.19;
            bp.push(-w, y, t * t * 0.03, w, y, t * t * 0.03);
            bu.push(0, t, 1, t);
        }
        for (let i = 0; i < segs; i++) {
            const a = i * 2;
            bi.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
        }
        blade.setAttribute('position', new THREE.Float32BufferAttribute(bp, 3));
        blade.setAttribute('uv', new THREE.Float32BufferAttribute(bu, 2));
        blade.setIndex(bi);
        blade.computeVertexNormals();

        const grassMat = windPatch(new THREE.MeshStandardMaterial({
            color: 0x77a04a, roughness: 0.95, side: THREE.DoubleSide, envMapIntensity: 0.25,
        }), 1.6, 0.30, 1.5);

        const COUNT = 7000;
        const grass = new THREE.InstancedMesh(blade, grassMat, COUNT);
        const m = new THREE.Matrix4(), q = new THREE.Quaternion(),
            p = new THREE.Vector3(), s = new THREE.Vector3(), e = new THREE.Euler();
        const tint = new THREE.Color();
        for (let i = 0; i < COUNT; i++) {
            const a = rr(0, Math.PI * 2);
            const rad = PLAZA_R + 0.25 + Math.pow(rnd(), 0.65) * 12;
            p.set(Math.cos(a) * rad, -0.16, Math.sin(a) * rad);
            e.set(rr(-0.12, 0.12), rr(0, Math.PI * 2), rr(-0.16, 0.16));
            q.setFromEuler(e);
            const sc = rr(0.7, 1.5);
            s.set(sc, sc * rr(0.8, 1.35), sc);
            m.compose(p, q, s);
            grass.setMatrixAt(i, m);
            tint.setHSL(rr(0.20, 0.27), rr(0.35, 0.60), rr(0.28, 0.48));
            grass.setColorAt(i, tint);
        }
        grass.instanceMatrix.needsUpdate = true;
        if (grass.instanceColor) grass.instanceColor.needsUpdate = true;
        grass.castShadow = false;
        grass.receiveShadow = true;
        scene.add(world.ghost(grass));
    }

    /* --- A puddle left over from the night, reflecting the same sky ------ */

    const puddleUniforms = {
        uTime, uSunDir: { value: SUN_DIR.clone() }, uSunCol: { value: C_SUN.clone() },
        uTop: { value: C_TOP.clone() }, uMid: { value: C_MID.clone() }, uHor: { value: C_HOR.clone() },
        uTint: { value: srgb(0x2b2620) },
    };
    const puddle = new THREE.Mesh(
        new THREE.CircleGeometry(1.0, 64).rotateX(-Math.PI / 2),
        new THREE.ShaderMaterial({
            uniforms: puddleUniforms, transparent: true, depthWrite: false,
            vertexShader: `
              varying vec3 vWorld; varying vec2 vUvp;
              void main(){
                vUvp = uv;
                vec4 wp = modelMatrix * vec4(position, 1.0);
                vWorld = wp.xyz;
                gl_Position = projectionMatrix * viewMatrix * wp;
              }`,
            fragmentShader: SKY_GLSL + `
              varying vec3 vWorld; varying vec2 vUvp;
              uniform float uTime; uniform vec3 uSunDir, uSunCol, uTop, uMid, uHor, uTint;
              void main(){
                vec2 c = vUvp * 2.0 - 1.0;
                float r = length(c);
                float edge = smoothstep(1.0, 0.62, r);
                if (edge <= 0.002) discard;
                vec2 q = vWorld.xz;
                // Four crossed ripples, differentiated by hand so the normal is exact.
                float w  = 0.0, dx = 0.0, dz = 0.0;
                vec3 A = vec3(0.0016, 0.0011, 0.0007);
                vec2 k1 = vec2( 21.0,  13.0), k2 = vec2(-15.0, 24.0), k3 = vec2( 34.0, -29.0);
                float p1 = dot(q, k1) + uTime * 1.9;
                float p2 = dot(q, k2) + uTime * 1.35;
                float p3 = dot(q, k3) + uTime * 2.7;
                w += A.x * sin(p1) + A.y * sin(p2) + A.z * sin(p3);
                dx += A.x * cos(p1) * k1.x + A.y * cos(p2) * k2.x + A.z * cos(p3) * k3.x;
                dz += A.x * cos(p1) * k1.y + A.y * cos(p2) * k2.y + A.z * cos(p3) * k3.y;
                // A slow ring, as though something touched the surface a moment ago.
                float rr2 = length(q - vec2(0.25, 0.1));
                float ring = sin(rr2 * 46.0 - uTime * 3.4) * 0.0009 * exp(-rr2 * 2.2);
                w += ring;
                vec3 N = normalize(vec3(-dx * 6.0, 1.0, -dz * 6.0));
                vec3 V = normalize(cameraPosition - vWorld);
                vec3 R = reflect(-V, N);
                if (R.y < 0.0) R.y = -R.y * 0.4;
                vec3 refl = skyColor(normalize(R), uSunDir, uTop, uMid, uHor, uSunCol);
                float f = pow(1.0 - clamp(dot(N, V), 0.0, 1.0), 4.0);
                float fres = 0.06 + 0.94 * f;
                vec3 col = mix(uTint, refl, clamp(fres + 0.30, 0.0, 1.0));
                col += uSunCol * pow(max(dot(normalize(R), uSunDir), 0.0), 260.0) * 3.0;
                gl_FragColor = vec4(col, edge * (0.52 + 0.48 * fres));
              }`,
        })
    );
    puddle.position.set(1.85, 0.004, 1.35);
    puddle.scale.set(1.0, 1, 0.72);
    puddle.rotation.y = 0.4;
    puddle.renderOrder = 2;
    scene.add(world.ghost(puddle));

    // A damp halo on the stone around it.
    const damp = new THREE.Mesh(
        new THREE.CircleGeometry(1.28, 48).rotateX(-Math.PI / 2),
        new THREE.MeshStandardMaterial({
            color: 0x3d372f, roughness: 0.65, transparent: true, opacity: 0.30, depthWrite: false,
        })
    );
    damp.position.set(1.85, 0.002, 1.35);
    damp.scale.set(1.0, 1, 0.74);
    damp.rotation.y = 0.4;
    damp.renderOrder = 1;
    scene.add(world.ghost(damp));

    /* ==========================================================
       4 · Plane trees
       ========================================================== */

    const barkMat = new THREE.MeshStandardMaterial({
        map: barkTex, color: 0xbdb5a4, roughness: 0.95, envMapIntensity: 0.25,
    });
    const leafMat = new THREE.MeshStandardMaterial({
        map: leafTex, alphaTest: 0.44, side: THREE.DoubleSide,
        roughness: 0.85, color: 0xd8e0b8, envMapIntensity: 0.4,
    });
    // A leaf cluster hangs from a branch rather than rooted at y=0, so it gets
    // a whole-quad drift instead of the grass bend.
    leafMat.onBeforeCompile = (sh) => {
        sh.uniforms.uTime = uTime;
        sh.vertexShader = sh.vertexShader
            .replace('#include <common>', `#include <common>
                uniform float uTime;`)
            .replace('#include <begin_vertex>', `#include <begin_vertex>
                #ifdef USE_INSTANCING
                  vec3 iOrigin = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
                #else
                  vec3 iOrigin = vec3(0.0);
                #endif
                float ph = iOrigin.x * 1.4 + iOrigin.z * 2.2 + iOrigin.y * 0.8;
                float gust = 0.55 + 0.45 * sin(uTime * 0.27 + iOrigin.x * 0.12);
                float s1 = sin(uTime * 1.05 + ph) * 0.7 + sin(uTime * 2.37 + ph * 1.6) * 0.3;
                transformed.x += s1 * 0.055 * gust;
                transformed.y += cos(uTime * 1.3 + ph) * 0.022 * gust;
                transformed.z += s1 * 0.040 * gust;`);
    };
    leafMat.customProgramCacheKey = () => 'leafwind';

    function makeTree(height, crownR, seedLean) {
        const tree = new THREE.Group();
        const lean = V3(Math.cos(seedLean), 0, Math.sin(seedLean));

        const trunkPts = [];
        const N = 10;
        for (let i = 0; i < N; i++) {
            const t = i / (N - 1);
            trunkPts.push(V3(
                lean.x * (t * t * height * 0.09) + Math.sin(t * 4.1 + seedLean) * 0.045,
                t * height * 0.62,
                lean.z * (t * t * height * 0.09) + Math.cos(t * 3.3 + seedLean) * 0.045
            ));
        }
        const trunk = new THREE.Mesh(
            sweep(trunkPts, (t) => height * 0.052 * (1 - t * 0.62) + 0.012, 14),
            barkMat
        );
        trunk.castShadow = trunk.receiveShadow = true;
        tree.add(trunk);

        // Buttressed root flare.
        for (let i = 0; i < 5; i++) {
            const a = rr(0, Math.PI * 2);
            const root = new THREE.Mesh(
                sweep([
                    V3(Math.cos(a) * height * 0.10, 0.0, Math.sin(a) * height * 0.10),
                    V3(Math.cos(a) * height * 0.05, height * 0.05, Math.sin(a) * height * 0.05),
                    V3(0, height * 0.16, 0),
                ], (t) => lerp(height * 0.030, height * 0.012, t), 8),
                barkMat
            );
            root.castShadow = true;
            tree.add(root);
        }

        const tips = [];
        const branches = 7;
        for (let i = 0; i < branches; i++) {
            const a = (i / branches) * Math.PI * 2 + rr(-0.35, 0.35);
            const up = height * (0.55 + rr(0, 0.28));
            const out = crownR * rr(0.42, 0.95);
            const base = trunkPts[Math.floor(lerp(4, N - 1, rr(0, 1)))].clone();
            const mid = V3(Math.cos(a) * out * 0.45, lerp(base.y, up, 0.55), Math.sin(a) * out * 0.45);
            const tip = V3(Math.cos(a) * out, up, Math.sin(a) * out);
            const br = new THREE.Mesh(
                sweep([base, base.clone().lerp(mid, 0.5), mid, mid.clone().lerp(tip, 0.55), tip],
                    (t) => lerp(height * 0.026, 0.012, t), 8),
                barkMat
            );
            br.castShadow = true;
            tree.add(br);
            tips.push(tip);
            // A second-order fork, so the crown has something to hang from.
            for (let k = 0; k < 2; k++) {
                const a2 = a + rr(-0.9, 0.9);
                const t2 = V3(tip.x + Math.cos(a2) * crownR * 0.35, tip.y + rr(0.2, 0.8),
                    tip.z + Math.sin(a2) * crownR * 0.35);
                const b2 = new THREE.Mesh(
                    sweep([tip, tip.clone().lerp(t2, 0.5), t2], (t) => lerp(0.012, 0.005, t), 6),
                    barkMat
                );
                b2.castShadow = true;
                tree.add(b2);
                tips.push(t2);
            }
        }

        const CLUSTERS = 300;
        const quad = new THREE.PlaneGeometry(0.9, 0.9);
        const foliage = new THREE.InstancedMesh(quad, leafMat, CLUSTERS);
        const m = new THREE.Matrix4(), q = new THREE.Quaternion(),
            p = new THREE.Vector3(), s = new THREE.Vector3(), e = new THREE.Euler();
        const tint = new THREE.Color();
        for (let i = 0; i < CLUSTERS; i++) {
            const anchor = tips[Math.floor(rnd() * tips.length) % tips.length];
            const a = rr(0, Math.PI * 2), rad = Math.pow(rnd(), 0.5) * crownR * 0.5;
            p.set(anchor.x + Math.cos(a) * rad, anchor.y + rr(-0.5, 0.75) + Math.sin(rad) * 0.2,
                anchor.z + Math.sin(a) * rad);
            e.set(rr(0, Math.PI * 2), rr(0, Math.PI * 2), rr(0, Math.PI * 2));
            q.setFromEuler(e);
            const sc = rr(0.85, 1.7);
            s.set(sc, sc, sc);
            m.compose(p, q, s);
            foliage.setMatrixAt(i, m);
            const up = clamp((p.y - (height * 0.55)) / (height * 0.6), 0, 1);
            tint.setHSL(lerp(0.22, 0.17, rnd()), rr(0.30, 0.50), lerp(0.30, 0.62, up * rr(0.6, 1)));
            foliage.setColorAt(i, tint);
        }
        foliage.instanceMatrix.needsUpdate = true;
        if (foliage.instanceColor) foliage.instanceColor.needsUpdate = true;
        foliage.castShadow = true;
        foliage.receiveShadow = true;
        tree.add(foliage);
        return tree;
    }

    const treeA = makeTree(7.2, 3.6, 0.8);
    treeA.position.set(-4.6, 0.0, -4.4);
    scene.add(world.part('tree_00', treeA));

    const treeB = makeTree(8.4, 4.2, 3.9);
    treeB.position.set(5.4, 0.0, -6.2);
    scene.add(world.part('tree_01', treeB));

    const treeC = makeTree(6.0, 3.0, 2.2);
    treeC.position.set(-8.2, 0.0, 5.4);
    treeC.scale.setScalar(0.9);
    scene.add(world.part('tree_02', treeC));

    /* --- The park beyond: hedge, poplars, a hint of the street ---------- */

    {
        const hedgeMat = new THREE.MeshStandardMaterial({ color: 0x33501f, roughness: 1 });
        const blobs = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 8, 6), hedgeMat, 260);
        const m = new THREE.Matrix4(), q = new THREE.Quaternion(),
            p = new THREE.Vector3(), s = new THREE.Vector3(), e = new THREE.Euler();
        const tint = new THREE.Color();
        for (let i = 0; i < 260; i++) {
            const a = (i / 260) * Math.PI * 2 + rr(-0.02, 0.02);
            const rad = 27 + rr(-1.2, 1.2);
            p.set(Math.cos(a) * rad, rr(0.2, 1.0) - 0.16, Math.sin(a) * rad);
            e.set(0, rr(0, 3.14), 0); q.setFromEuler(e);
            s.set(rr(1.4, 2.4), rr(0.9, 1.6), rr(1.4, 2.4));
            m.compose(p, q, s);
            blobs.setMatrixAt(i, m);
            tint.setHSL(rr(0.22, 0.28), rr(0.30, 0.5), rr(0.16, 0.30));
            blobs.setColorAt(i, tint);
        }
        blobs.instanceMatrix.needsUpdate = true;
        if (blobs.instanceColor) blobs.instanceColor.needsUpdate = true;
        scene.add(world.ghost(blobs));

        const poplarMat = new THREE.MeshStandardMaterial({ color: 0x3c5c28, roughness: 1, flatShading: true });
        for (let i = 0; i < 16; i++) {
            const a = rr(0, Math.PI * 2), rad = rr(31, 48);
            const h = rr(7, 15);
            const p2 = new THREE.Mesh(new THREE.ConeGeometry(h * rr(0.13, 0.2), h, 7), poplarMat);
            p2.position.set(Math.cos(a) * rad, h / 2 - 0.16, Math.sin(a) * rad);
            scene.add(world.ghost(p2));
        }

        const blockMat = new THREE.MeshStandardMaterial({ color: 0xa08d78, roughness: 1 });
        for (let i = 0; i < 9; i++) {
            const a = rr(-2.6, 0.9), rad = rr(58, 76);
            const h = rr(9, 22);
            const b = new THREE.Mesh(new THREE.BoxGeometry(rr(8, 18), h, rr(8, 16)), blockMat);
            b.position.set(Math.cos(a) * rad, h / 2 - 0.16, Math.sin(a) * rad);
            b.rotation.y = rr(0, 1.6);
            scene.add(world.ghost(b));
        }
    }

    /* ==========================================================
       5 · The bench
       ========================================================== */

    const RAIL_Y = 0.960;       // centre of the capping rail
    const RAIL_Z = -0.235;
    const RAIL_TOP = RAIL_Y + 0.026;

    const bench = new THREE.Group();
    {
        const ironMat = new THREE.MeshStandardMaterial({
            color: 0x27332c, roughness: 0.46, metalness: 0.55, envMapIntensity: 0.85,
        });
        const woodMat = new THREE.MeshStandardMaterial({
            map: woodTex, color: 0xb99a76, roughness: 0.82, metalness: 0.0, envMapIntensity: 0.3,
        });
        const boltMat = new THREE.MeshStandardMaterial({
            color: 0x584c3e, roughness: 0.4, metalness: 0.75, envMapIntensity: 0.9,
        });

        const HALF = 0.755;
        const yz = (arr) => arr.map(([y, z]) => V3(0, y, z));

        for (const side of [-1, 1]) {
            const end = new THREE.Group();
            end.position.x = side * HALF;

            // The single sweeping cast rail: front foot, under the seat, up
            // the back, finishing at the capping rail.
            const spine = new THREE.Mesh(
                sweep(yz([
                    [0.010, 0.355], [0.075, 0.352], [0.230, 0.336], [0.400, 0.300],
                    [0.452, 0.230], [0.455, 0.060], [0.520, -0.055], [0.660, -0.130],
                    [0.820, -0.190], [0.960, -0.238],
                ]), (t) => 0.0175 * (1 + 0.55 * Math.pow(1 - t, 5)) * (1 - 0.25 * t), 12),
                ironMat
            );
            spine.castShadow = spine.receiveShadow = true;
            end.add(spine);

            const rear = new THREE.Mesh(
                sweep(yz([
                    [0.010, -0.300], [0.090, -0.296], [0.250, -0.270], [0.390, -0.200], [0.470, -0.110],
                ]), (t) => 0.0165 * (1 + 0.5 * Math.pow(1 - t, 5)), 10),
                ironMat
            );
            rear.castShadow = true;
            end.add(rear);

            // Armrest: riser, then a bar running back into the spine.
            const arm = new THREE.Mesh(
                sweep(yz([
                    [0.430, 0.322], [0.545, 0.352], [0.638, 0.348], [0.668, 0.270],
                    [0.690, 0.100], [0.716, -0.060], [0.760, -0.160],
                ]), (t) => lerp(0.0165, 0.014, t), 10),
                ironMat
            );
            arm.castShadow = true;
            end.add(arm);

            // Scroll ornament in the gap under the arm.
            const scroll = new THREE.Mesh(new THREE.TorusGeometry(0.062, 0.0105, 8, 22), ironMat);
            scroll.position.set(0, 0.560, 0.180);
            scroll.rotation.y = Math.PI / 2;
            scroll.castShadow = true;
            end.add(scroll);
            const spoke = new THREE.Mesh(new THREE.TorusGeometry(0.030, 0.008, 6, 16), ironMat);
            spoke.position.copy(scroll.position);
            spoke.rotation.y = Math.PI / 2;
            end.add(spoke);

            // Feet: flared pads on the flagstones.
            for (const fz of [0.355, -0.300]) {
                const pad = new THREE.Mesh(
                    new THREE.CylinderGeometry(0.040, 0.052, 0.022, 12), ironMat);
                pad.position.set(0, 0.011, fz);
                pad.scale.z = 1.5;
                pad.castShadow = pad.receiveShadow = true;
                end.add(pad);
            }

            bench.add(end);
        }

        // Seat slats.
        const SEAT = [
            [0.452, 0.320], [0.452, 0.230], [0.450, 0.140], [0.449, 0.050], [0.450, -0.040],
        ];
        for (let i = 0; i < SEAT.length; i++) {
            const [y, z] = SEAT[i];
            const s = new THREE.Mesh(slatGeometry(1.62, 0.030, 0.078), woodMat);
            s.position.set(0, y + 0.014, z);
            s.castShadow = s.receiveShadow = true;
            bench.add(s);
        }

        // Back slats, leaning with the frame.
        const BACK = [[0.585, -0.098], [0.700, -0.146], [0.822, -0.192]];
        for (const [y, z] of BACK) {
            const s = new THREE.Mesh(slatGeometry(1.62, 0.100, 0.028), woodMat);
            s.position.set(0, y, z);
            s.rotation.x = 0.36;
            s.castShadow = s.receiveShadow = true;
            bench.add(s);
        }

        // The capping rail — a broad rounded top, which is the whole reason a
        // pigeon can stand here at all.
        const rail = new THREE.Mesh(slatGeometry(1.70, 0.052, 0.104), woodMat);
        rail.position.set(0, RAIL_Y, RAIL_Z);
        rail.castShadow = rail.receiveShadow = true;
        bench.add(rail);

        // Bolt heads where slats meet iron.
        for (const side of [-1, 1]) {
            for (const [y, z] of [...SEAT, ...BACK, [RAIL_Y, RAIL_Z]]) {
                const bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.0075, 0.0075, 0.012, 8), boltMat);
                bolt.rotation.z = Math.PI / 2;
                bolt.position.set(side * (HALF - 0.012), y + (z > -0.05 ? 0.014 : 0.0), z);
                bench.add(bolt);
            }
        }

        // A brass dedication plate, because every bench in every park has one.
        const plateTex = world.canvasTexture(256, 64, (g, cv) => {
            g.fillStyle = '#8d7238'; g.fillRect(0, 0, cv.width, cv.height);
            g.fillStyle = 'rgba(255,240,190,0.25)'; g.fillRect(0, 0, cv.width, 6);
            g.fillStyle = 'rgba(30,22,10,0.75)';
            g.font = 'bold 15px serif'; g.textAlign = 'center';
            g.fillText('FOR ALL WHO SIT A WHILE', cv.width / 2, 27);
            g.font = '12px serif';
            g.fillText('and for the birds', cv.width / 2, 46);
        });
        const plate = new THREE.Mesh(
            new THREE.PlaneGeometry(0.20, 0.05),
            new THREE.MeshStandardMaterial({
                map: plateTex, color: 0xffe6b0, roughness: 0.35, metalness: 0.8, envMapIntensity: 1.1,
            })
        );
        plate.position.set(0.30, 0.700, -0.146 + 0.016);
        plate.rotation.x = 0.36;
        bench.add(plate);
    }
    bench.rotation.y = 0.16;
    bench.position.set(0, 0, 0);
    scene.add(world.part('bench_00', bench));

    /* --- A newspaper somebody left behind ------------------------------- */
    {
        const paperTex = world.canvasTexture(256, 256, (g, cv) => {
            const S = cv.width;
            g.fillStyle = '#ded6c4'; g.fillRect(0, 0, S, S);
            g.fillStyle = '#2a2620';
            g.font = 'bold 26px serif'; g.textAlign = 'center';
            g.fillText('THE EVENING', S / 2, 34);
            g.globalAlpha = 0.55;
            for (let col = 0; col < 3; col++) {
                for (let i = 0; i < 26; i++) {
                    g.fillStyle = '#4a453c';
                    g.fillRect(10 + col * 82, 52 + i * 7, rr(30, 70), 2.2);
                }
            }
            g.globalAlpha = 0.25;
            g.fillStyle = '#6b6355';
            g.fillRect(96, 96, 74, 54);
            g.globalAlpha = 1;
        });
        const paper = new THREE.Group();
        const sheet = new THREE.Mesh(
            new THREE.PlaneGeometry(0.30, 0.24, 10, 6),
            new THREE.MeshStandardMaterial({
                map: paperTex, color: 0xffffff, roughness: 0.95, side: THREE.DoubleSide,
            })
        );
        const pp = sheet.geometry.attributes.position;
        for (let i = 0; i < pp.count; i++) {
            const x = pp.getX(i), y = pp.getY(i);
            pp.setZ(i, Math.sin(x * 9) * 0.006 + Math.cos(y * 7) * 0.004 + Math.abs(x) * 0.02);
        }
        sheet.geometry.computeVertexNormals();
        sheet.rotation.x = -Math.PI / 2 + 0.04;
        sheet.castShadow = sheet.receiveShadow = true;
        paper.add(sheet);
        paper.position.set(0.42, 0.470, 0.16);
        paper.rotation.y = 0.5 + 0.16;
        scene.add(world.part('newspaper_00', paper));
    }

    /* ==========================================================
       6 · The pigeon
       ========================================================== */

    /**
     * Neck iridescence. A rock dove's throat is not a colour, it is an angle —
     * so the hue is driven by the fresnel term and banded, green through
     * violet through bronze, and added as emission so it survives the shade.
     */
    function iridescentMaterial(base, strength) {
        const m = new THREE.MeshStandardMaterial({
            color: base, roughness: 0.38, metalness: 0.30, envMapIntensity: 0.7,
        });
        m.onBeforeCompile = (sh) => {
            sh.uniforms.uIridA = { value: srgb(0x1fd07f) };
            sh.uniforms.uIridB = { value: srgb(0x8046d6) };
            sh.uniforms.uIridC = { value: srgb(0xd88a2a) };
            sh.uniforms.uIridK = { value: strength };
            sh.fragmentShader = sh.fragmentShader
                .replace('#include <common>', `#include <common>
                    uniform vec3 uIridA, uIridB, uIridC; uniform float uIridK;`)
                .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
                    {
                      vec3 vd = normalize(vViewPosition);
                      float f = 1.0 - clamp(dot(normalize(normal), vd), 0.0, 1.0);
                      float band = f * f * 5.6 + f * 1.4;
                      vec3 irid = uIridA * (0.5 + 0.5 * sin(band + 0.0))
                                + uIridB * (0.5 + 0.5 * sin(band + 2.094))
                                + uIridC * (0.5 + 0.5 * sin(band + 4.188));
                      irid *= 0.62;
                      totalEmissiveRadiance += irid * uIridK * smoothstep(0.02, 0.62, f);
                    }`);
        };
        m.customProgramCacheKey = () => 'irid' + strength;
        return m;
    }

    const PLUMAGE = {
        blueBar: {
            body: 0x8b95a3, head: 0x6c7787, wing: '#8b93a1', bar: 'rgba(30,34,42,0.92)',
            tail: '#7c8593', neck: 0x2c333d, irid: 1.5, leg: 0xcf5f52,
        },
        checker: {
            body: 0x59616d, head: 0x474f5b, wing: '#5b636f', bar: 'rgba(20,22,28,0.95)',
            tail: '#4e5662', neck: 0x232931, irid: 1.7, leg: 0xc35a4e,
        },
        pied: {
            body: 0xdfdcd4, head: 0xc8c6bf, wing: '#cfccc4', bar: 'rgba(70,72,80,0.75)',
            tail: '#b9b6ae', neck: 0x4a4f57, irid: 1.1, leg: 0xd98a72,
        },
        ash: {
            body: 0xa4a096, head: 0x87847c, wing: '#a09c92', bar: 'rgba(56,54,58,0.8)',
            tail: '#918d84', neck: 0x3a3d42, irid: 1.3, leg: 0xcc6a58,
        },
    };

    /**
     * Builds one bird, feet at the origin, facing +z. Returns the rig the
     * brain below drives.
     */
    function makePigeon(kind, scale) {
        const P = PLUMAGE[kind];
        const root = new THREE.Group();

        const bodyMat = new THREE.MeshStandardMaterial({
            map: featherTex, color: P.body, roughness: 0.80, metalness: 0.06, envMapIntensity: 0.55,
        });
        const headMat = new THREE.MeshStandardMaterial({
            map: featherTex, color: P.head, roughness: 0.78, metalness: 0.06, envMapIntensity: 0.55,
        });
        const wingMat = new THREE.MeshStandardMaterial({
            map: wingTexture(P.bar, P.wing), color: 0xffffff,
            roughness: 0.78, metalness: 0.05, envMapIntensity: 0.5,
        });
        const tailMat = new THREE.MeshStandardMaterial({
            map: tailTexture(P.tail), color: 0xffffff, side: THREE.DoubleSide,
            roughness: 0.8, envMapIntensity: 0.4,
        });
        const neckMat = iridescentMaterial(P.neck, P.irid);
        const beakMat = new THREE.MeshStandardMaterial({
            color: 0x3f424b, roughness: 0.42, metalness: 0.1, envMapIntensity: 0.8,
        });
        const cereMat = new THREE.MeshStandardMaterial({
            color: 0xe7e2d8, roughness: 0.95, envMapIntensity: 0.4,
        });
        const legMat = new THREE.MeshStandardMaterial({
            color: P.leg, roughness: 0.55, metalness: 0.05, envMapIntensity: 0.6,
        });
        const clawMat = new THREE.MeshStandardMaterial({ color: 0x3b3128, roughness: 0.5 });
        const irisMat = new THREE.MeshStandardMaterial({
            color: 0xff9c22, emissive: 0xff7a00, emissiveIntensity: 0.75,
            roughness: 0.25, metalness: 0.0, envMapIntensity: 1.4,
        });
        const pupilMat = new THREE.MeshStandardMaterial({ color: 0x07080a, roughness: 0.12, metalness: 0.0 });
        const ringMat = new THREE.MeshStandardMaterial({ color: 0xb9b2a4, roughness: 0.7 });

        /* --- Body: a sphere pulled into a teardrop -------------------- */
        const bodyGeo = new THREE.SphereGeometry(1, 34, 26);
        {
            const pos = bodyGeo.attributes.position;
            for (let i = 0; i < pos.count; i++) {
                const x = pos.getX(i), y = pos.getY(i), s = pos.getZ(i);
                const taper = Math.pow(1 - 0.60 * Math.max(0, -s), 1.15);
                const rx = 0.0515 * taper;
                const ry = 0.0575 * taper * (y < 0 ? 1.07 : 0.97);
                const yc = 0.1040 + 0.0150 * Math.pow(Math.max(0, -s), 1.6) - 0.0045 * Math.max(0, s);
                pos.setXYZ(i, x * rx, y * ry + yc, -0.014 + s * 0.108);
            }
            bodyGeo.computeVertexNormals();
        }
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        body.castShadow = body.receiveShadow = true;
        root.add(body);

        // Rump: a small extra swell where the tail leaves the body.
        const rump = new THREE.Mesh(new THREE.SphereGeometry(0.030, 16, 12), bodyMat);
        rump.position.set(0, 0.117, -0.098);
        rump.scale.set(1.05, 0.85, 1.25);
        rump.castShadow = true;
        root.add(rump);

        /* --- Head group: neck, skull, beak, eyes ---------------------- */
        const headPivot = new THREE.Group();
        headPivot.position.set(0, 0.108, 0.026);
        root.add(headPivot);

        const neck = new THREE.Mesh(
            sweep([
                V3(0, -0.004, -0.006), V3(0, 0.014, 0.000), V3(0, 0.034, 0.010),
                V3(0, 0.052, 0.020), V3(0, 0.066, 0.026),
            ], (t) => lerp(0.046, 0.0235, Math.pow(t, 0.85)), 18),
            neckMat
        );
        neck.castShadow = true;
        headPivot.add(neck);

        const head = new THREE.Group();
        head.position.set(0, 0.082, 0.030);
        headPivot.add(head);

        const skullGeo = new THREE.SphereGeometry(0.0305, 22, 16);
        {
            const pos = skullGeo.attributes.position;
            for (let i = 0; i < pos.count; i++) {
                const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
                // High forehead, flatter crown, tucked nape.
                const fore = 1 + 0.16 * smooth(0.0, 0.9, (y / 0.0305)) * smooth(-0.2, 0.8, (z / 0.0305));
                pos.setXYZ(i, x * 0.93, y * 1.02 * fore, z * 1.10 - 0.002);
            }
            skullGeo.computeVertexNormals();
        }
        const skull = new THREE.Mesh(skullGeo, headMat);
        skull.castShadow = true;
        head.add(skull);

        // Throat: the iridescence carries up under the chin.
        const throat = new THREE.Mesh(new THREE.SphereGeometry(0.024, 16, 12), neckMat);
        throat.position.set(0, -0.014, 0.010);
        throat.scale.set(0.92, 0.80, 1.02);
        head.add(throat);

        /* Beak: two mandibles and the waxy white cere at the base. */
        const beak = new THREE.Group();
        beak.position.set(0, -0.001, 0.0295);
        beak.rotation.x = -0.20;
        head.add(beak);

        const upper = new THREE.Mesh(new THREE.ConeGeometry(0.0098, 0.0285, 12), beakMat);
        upper.geometry.rotateX(Math.PI / 2);
        upper.geometry.scale(1.0, 0.66, 1.0);
        upper.geometry.translate(0, 0.0018, 0.0128);
        {   // a downturned tip, the way a pigeon's bill actually ends
            const pos = upper.geometry.attributes.position;
            for (let i = 0; i < pos.count; i++) {
                const z = pos.getZ(i);
                const t = clamp((z - 0.008) / 0.020, 0, 1);
                pos.setY(i, pos.getY(i) - t * t * 0.0055);
            }
            upper.geometry.computeVertexNormals();
        }
        upper.castShadow = true;
        beak.add(upper);

        const lower = new THREE.Mesh(new THREE.ConeGeometry(0.0080, 0.0225, 10), beakMat);
        lower.geometry.rotateX(Math.PI / 2);
        lower.geometry.scale(1.0, 0.50, 1.0);
        lower.position.set(0, -0.0042, 0.0098);
        beak.add(lower);

        const cere = new THREE.Mesh(new THREE.SphereGeometry(0.0072, 14, 10), cereMat);
        cere.position.set(0, 0.0052, 0.0018);
        cere.scale.set(1.5, 0.85, 1.05);
        head.add(cere);
        for (const s of [-1, 1]) {  // the paired nostril swellings
            const n = new THREE.Mesh(new THREE.SphereGeometry(0.0044, 10, 8), cereMat);
            n.position.set(s * 0.0056, 0.0048, 0.0068);
            n.scale.set(1.0, 0.8, 1.3);
            head.add(n);
        }

        /* Eyes: orange iris, black pupil, pale ring, and a lid that flicks. */
        const lids = [];
        for (const s of [-1, 1]) {
            const eye = new THREE.Group();
            eye.position.set(s * 0.0206, 0.0042, 0.0128);
            eye.rotation.y = s * 0.34;
            head.add(eye);

            const ball = new THREE.Mesh(new THREE.SphereGeometry(0.0064, 14, 12), irisMat);
            eye.add(ball);
            const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.0033, 12, 10), pupilMat);
            pupil.position.set(s * 0.0036, 0.0002, 0.0026);
            pupil.scale.set(1, 1, 0.7);
            eye.add(pupil);
            const ring = new THREE.Mesh(new THREE.TorusGeometry(0.0068, 0.0016, 6, 16), ringMat);
            ring.rotation.y = -s * Math.PI / 2;
            eye.add(ring);

            const lid = new THREE.Mesh(
                new THREE.SphereGeometry(0.0070, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.52),
                headMat
            );
            lid.rotation.x = -1.15;                 // parked above the eye
            eye.add(lid);
            lids.push(lid);
        }

        /* --- Folded wings --------------------------------------------- */
        const wings = [];
        for (const side of [-1, 1]) {
            const g = new THREE.Group();
            root.add(g);

            const U = 22, TH = 16;
            const pos = [], uvs = [], idx = [];
            for (let i = 0; i <= U; i++) {
                const u = i / U;
                const cy = 0.1300 - 0.0300 * u - 0.0230 * u * u;
                const cz = 0.0560 - 0.2180 * u;
                const cx = side * (0.0435 * (1 - 0.55 * u * u));
                const ry = 0.0505 * Math.pow(Math.sin(Math.PI * (0.16 + 0.80 * u)), 0.70)
                    * (1 - 0.97 * u * u * u);
                const rx = 0.0150 * (1 - 0.97 * u * u);
                for (let j = 0; j <= TH; j++) {
                    const a = (j / TH) * Math.PI * 2;
                    pos.push(cx + side * rx * Math.sin(a), cy + ry * Math.cos(a), cz);
                    uvs.push(j / TH, u);
                }
            }
            for (let i = 0; i < U; i++) for (let j = 0; j < TH; j++) {
                const a = i * (TH + 1) + j, b = a + TH + 1;
                if (side > 0) idx.push(a, b, a + 1, b, b + 1, a + 1);
                else idx.push(a, a + 1, b, b, a + 1, b + 1);
            }
            const wg = new THREE.BufferGeometry();
            wg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
            wg.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
            wg.setIndex(idx);
            wg.computeVertexNormals();
            {   // Weld the UV seam's normals, or a crease runs the wing's length.
                const nAttr = wg.attributes.normal;
                for (let i = 0; i <= U; i++) {
                    const a = i * (TH + 1), b = a + TH;
                    const nx = (nAttr.getX(a) + nAttr.getX(b)) * 0.5;
                    const ny = (nAttr.getY(a) + nAttr.getY(b)) * 0.5;
                    const nz = (nAttr.getZ(a) + nAttr.getZ(b)) * 0.5;
                    const l = Math.hypot(nx, ny, nz) || 1;
                    nAttr.setXYZ(a, nx / l, ny / l, nz / l);
                    nAttr.setXYZ(b, nx / l, ny / l, nz / l);
                }
                nAttr.needsUpdate = true;
            }
            const wing = new THREE.Mesh(wg, wingMat);
            wing.castShadow = wing.receiveShadow = true;
            g.add(wing);

            // Primaries crossing back over the tail base.
            for (let k = 0; k < 6; k++) {
                const t = k / 5;
                const f = new THREE.Mesh(
                    featherGeometry(lerp(0.075, 0.115, t), 0.0135, 0.0065, 0.006), tailMat);
                f.position.set(side * (0.030 - t * 0.008), 0.0985 - t * 0.006, -0.108);
                f.rotation.set(-0.10 - t * 0.06, side * (0.30 - t * 0.26), side * (0.22 - t * 0.10));
                f.castShadow = true;
                g.add(f);
            }

            // Shoulder covert, hiding the seam into the mantle.
            const shoulder = new THREE.Mesh(new THREE.SphereGeometry(0.026, 14, 10), bodyMat);
            shoulder.position.set(side * 0.030, 0.1345, 0.036);
            shoulder.scale.set(0.85, 0.72, 1.15);
            g.add(shoulder);

            wings.push(g);
        }

        /* --- Tail ------------------------------------------------------ */
        const tailPivot = new THREE.Group();
        tailPivot.position.set(0, 0.1150, -0.1050);
        root.add(tailPivot);
        const tailFeathers = [];
        for (let i = 0; i < 12; i++) {
            const t = (i / 11) * 2 - 1;                  // -1 .. 1 across the fan
            const f = new THREE.Mesh(
                featherGeometry(0.128 - Math.abs(t) * 0.016, 0.0165, 0.0125, 0.004), tailMat);
            f.rotation.y = t * 0.20;
            f.rotation.x = -0.06 + Math.abs(t) * 0.02;
            f.rotation.z = t * 0.10;
            f.position.set(t * 0.004, -Math.abs(t) * 0.002, 0);
            f.castShadow = true;
            tailPivot.add(f);
            tailFeathers.push({ mesh: f, t });
        }
        // Undertail coverts, so the fan does not start from nothing.
        const coverts = new THREE.Mesh(new THREE.SphereGeometry(0.024, 14, 10), bodyMat);
        coverts.position.set(0, 0.1085, -0.0980);
        coverts.scale.set(1.0, 0.75, 1.5);
        root.add(coverts);

        /* --- Legs, feet, toes ------------------------------------------ */
        const legs = [];
        for (const side of [-1, 1]) {
            const hip = new THREE.Group();
            hip.position.set(side * 0.0205, 0.0500, -0.0020);
            root.add(hip);

            const tarsus = new THREE.Mesh(
                sweep([
                    V3(0, 0.000, 0.000), V3(side * 0.0008, -0.012, -0.0058),
                    V3(side * 0.0006, -0.026, -0.0052), V3(0, -0.038, -0.0010),
                    V3(0, -0.0425, 0.0025),
                ], (t) => lerp(0.0082, 0.0046, t), 10),
                legMat
            );
            tarsus.castShadow = true;
            hip.add(tarsus);

            // Feathered thigh above the joint.
            const thigh = new THREE.Mesh(new THREE.SphereGeometry(0.019, 12, 10), bodyMat);
            thigh.position.set(0, 0.006, -0.004);
            thigh.scale.set(0.85, 1.0, 1.15);
            hip.add(thigh);

            const foot = new THREE.Group();
            foot.position.set(0, -0.0425, 0.0025);
            hip.add(foot);

            // Toes lie almost flat with just enough curl to read as a grip —
            // the same foot has to sit on a rail and on flagstones.
            const TOES = [
                { yaw: 0.00, len: 0.0290, curl: 0.0080 },
                { yaw: 0.62, len: 0.0250, curl: 0.0075 },
                { yaw: -0.62, len: 0.0250, curl: 0.0075 },
                { yaw: Math.PI, len: 0.0205, curl: 0.0070 },
            ];
            for (const toe of TOES) {
                const pts = [];
                const N = 5;
                for (let i = 0; i < N; i++) {
                    const t = i / (N - 1);
                    pts.push(V3(
                        Math.sin(toe.yaw) * toe.len * t,
                        -t * t * toe.curl,
                        Math.cos(toe.yaw) * toe.len * t
                    ));
                }
                const tmesh = new THREE.Mesh(sweep(pts, (t) => lerp(0.0035, 0.0019, t), 7), legMat);
                tmesh.castShadow = true;
                foot.add(tmesh);

                const claw = new THREE.Mesh(new THREE.ConeGeometry(0.0019, 0.0080, 6), clawMat);
                claw.position.copy(pts[N - 1]);
                claw.rotation.x = Math.PI / 2 + 0.85;
                claw.rotation.y = toe.yaw;
                foot.add(claw);
            }
            legs.push({ hip, foot });
        }

        root.scale.setScalar(scale || 1);
        return { root, body, headPivot, head, tailPivot, tailFeathers, wings, legs, lids, neck, irisMat };
    }

    /* ==========================================================
       7 · A small nervous system
       ========================================================== */

    /**
     * What makes a bird look alive is not the loop, it is that you cannot
     * predict the loop. Everything below runs on its own irregular timers:
     * a scan, a head thrust, a blink, a ruffle, a preen, a shuffle of wings.
     */
    function makeBrain(rig, opts) {
        const o = Object.assign({ perched: true, home: new THREE.Vector3(), roam: 0.0 }, opts || {});
        const base = {
            headZ: rig.headPivot.position.z,
            headY: rig.headPivot.position.y,
            bodyY: rig.root.position.y,
        };
        return {
            rig, o, base,
            t: rr(0, 10),
            timer: rr(0.2, 1.4),
            mode: 'scan',
            yaw: 0, yawT: 0, pitch: 0, pitchT: 0, roll: 0, rollT: 0,
            bobLeft: 0, bobPhase: rnd(), bobRate: rr(2.1, 2.7),
            thrust: 0,
            ruffle: 0, wingLift: 0, wingLiftT: 0,
            tailUp: 0, tailUpT: 0, fan: 0, fanT: 0,
            throatPuff: 0,
            blink: 0, blinkTimer: rr(0.8, 4.5),
            peck: 0,
            walk: 0, walkT: 0, heading: rr(0, Math.PI * 2), stepPhase: rnd(),
            shiftT: 0, shift: 0,
        };
    }

    function chooseAction(b) {
        const r = rnd();
        if (b.o.perched) {
            if (r < 0.34) { b.mode = 'scan'; b.yawT = rr(-1.15, 1.15); b.pitchT = rr(-0.14, 0.24); b.timer = rr(0.5, 2.4); }
            else if (r < 0.58) { b.mode = 'bob'; b.bobLeft = 2 + Math.floor(rnd() * 4); b.timer = rr(1.0, 2.0); }
            else if (r < 0.70) { b.mode = 'ruffle'; b.ruffle = 1; b.timer = rr(0.7, 1.3); }
            else if (r < 0.80) { b.mode = 'wing'; b.wingLiftT = rr(0.22, 0.42); b.timer = rr(0.5, 0.9); }
            else if (r < 0.90) { b.mode = 'preen'; b.yawT = (rnd() > 0.5 ? 1 : -1) * rr(1.25, 1.55); b.pitchT = rr(0.75, 1.05); b.timer = rr(1.2, 2.8); }
            else { b.mode = 'coo'; b.timer = rr(1.2, 2.2); b.pitchT = rr(-0.10, 0.05); b.yawT = rr(-0.3, 0.3); }
        } else {
            if (r < 0.30) { b.mode = 'peck'; b.timer = rr(0.7, 1.6); }
            else if (r < 0.52) { b.mode = 'walk'; b.walkT = 1; b.heading += rr(-1.3, 1.3); b.timer = rr(0.8, 2.4); }
            else if (r < 0.70) { b.mode = 'bob'; b.bobLeft = 3 + Math.floor(rnd() * 5); b.timer = rr(1.0, 2.2); }
            else if (r < 0.82) { b.mode = 'scan'; b.yawT = rr(-1.2, 1.2); b.pitchT = rr(-0.18, 0.22); b.timer = rr(0.5, 1.8); }
            else if (r < 0.92) { b.mode = 'ruffle'; b.ruffle = 1; b.timer = rr(0.6, 1.2); }
            else { b.mode = 'preen'; b.yawT = (rnd() > 0.5 ? 1 : -1) * rr(1.2, 1.5); b.pitchT = rr(0.8, 1.1); b.timer = rr(1.0, 2.4); }
        }
        if (b.mode !== 'walk') b.walkT = 0;
        if (b.mode !== 'wing') b.wingLiftT = 0;
        b.tailUpT = rr(-0.05, 0.10);
        b.fanT = b.mode === 'coo' ? rr(0.25, 0.5) : rr(0, 0.10);
    }

    function updateBrain(b, dt) {
        const rig = b.rig;
        b.t += dt;
        b.timer -= dt;
        if (b.timer <= 0) chooseAction(b);

        const k = (rate) => 1 - Math.exp(-rate * dt);

        // --- head aim
        b.yaw += (b.yawT - b.yaw) * k(b.mode === 'scan' ? 11 : 7);
        b.pitch += (b.pitchT - b.pitch) * k(9);
        b.roll += (b.rollT - b.roll) * k(6);
        if (b.mode === 'preen') b.rollT = b.yawT * 0.35; else b.rollT = 0;

        // --- the bob: quick thrust out, slow settle back
        if (b.bobLeft > 0) {
            b.bobPhase += dt * b.bobRate;
            if (b.bobPhase >= 1) { b.bobPhase -= 1; b.bobLeft -= 1; }
            const p = b.bobPhase;
            b.thrust = p < 0.26
                ? 1 - Math.pow(1 - p / 0.26, 3)
                : 1 - smooth(0, 1, (p - 0.26) / 0.74);
        } else {
            b.thrust += (0 - b.thrust) * k(6);
        }

        // --- peck: down to the stone, snatch, up
        if (b.mode === 'peck') {
            const cyc = (b.t * 1.55) % 1;
            b.peck = cyc < 0.30 ? smooth(0, 1, cyc / 0.30)
                : cyc < 0.42 ? 1
                    : 1 - smooth(0, 1, (cyc - 0.42) / 0.36);
            b.peck = clamp(b.peck, 0, 1);
        } else {
            b.peck += (0 - b.peck) * k(7);
        }

        // --- involuntary bits
        b.blinkTimer -= dt;
        if (b.blinkTimer <= 0) { b.blinkTimer = rr(1.1, 5.5); b.blink = 1; }
        b.blink = Math.max(0, b.blink - dt * 8.5);
        const lidFlick = Math.sin(Math.min(1, b.blink) * Math.PI);
        for (const lid of rig.lids) lid.rotation.x = lerp(-1.15, 1.15, lidFlick);

        b.ruffle = Math.max(0, b.ruffle - dt * 1.9);
        const ruff = Math.sin(clamp(b.ruffle, 0, 1) * Math.PI) * (0.5 + 0.5 * Math.sin(b.t * 34));

        b.wingLift += (b.wingLiftT - b.wingLift) * k(10);
        b.tailUp += (b.tailUpT - b.tailUp) * k(4);
        b.fan += (b.fanT - b.fan) * k(5);

        const cooing = b.mode === 'coo';
        b.throatPuff += ((cooing ? 0.5 + 0.5 * Math.sin(b.t * 4.2) : 0) - b.throatPuff) * k(4);

        b.shiftT -= dt;
        if (b.shiftT <= 0) { b.shiftT = rr(1.6, 5.0); b.shift = rr(-1, 1); }

        // --- walking, for the birds on the stones
        let stepBob = 0;
        if (b.walkT > 0 && !b.o.perched) {
            const speed = 0.20;
            b.stepPhase += dt * 2.6;
            const dx = Math.sin(b.heading) * speed * dt;
            const dz = Math.cos(b.heading) * speed * dt;
            rig.root.position.x += dx;
            rig.root.position.z += dz;
            const away = rig.root.position.distanceTo(b.o.home);
            if (away > b.o.roam) {
                // turn back toward the crumbs
                const to = Math.atan2(b.o.home.x - rig.root.position.x, b.o.home.z - rig.root.position.z);
                b.heading = to + rr(-0.4, 0.4);
            }
            rig.root.rotation.y += (b.heading - rig.root.rotation.y) * k(3.2);
            stepBob = Math.abs(Math.sin(b.stepPhase * Math.PI)) * 0.006;
            for (let i = 0; i < rig.legs.length; i++) {
                const ph = b.stepPhase * Math.PI * 2 + i * Math.PI;
                rig.legs[i].hip.rotation.x = Math.sin(ph) * 0.42;
                rig.legs[i].foot.rotation.x = -Math.sin(ph) * 0.30;
            }
        } else {
            for (let i = 0; i < rig.legs.length; i++) {
                rig.legs[i].hip.rotation.x += (0 - rig.legs[i].hip.rotation.x) * k(5);
                rig.legs[i].foot.rotation.x += (0 - rig.legs[i].foot.rotation.x) * k(5);
            }
        }

        // --- write the pose
        const hp = rig.headPivot;
        hp.rotation.y = b.yaw;
        hp.rotation.x = -b.pitch + b.peck * 0.95 + (b.mode === 'preen' ? 0.15 : 0);
        hp.rotation.z = b.roll;
        hp.position.z = b.base.headZ + b.thrust * 0.0245 - b.peck * 0.012;
        hp.position.y = b.base.headY + b.thrust * 0.0035 - b.peck * 0.030
            + Math.sin(b.t * 1.7) * 0.0011;

        const puff = 1 + b.throatPuff * 0.30 + ruff * 0.05;
        rig.neck.scale.set(puff, 1 + b.throatPuff * 0.06, puff);

        const breathe = 1 + Math.sin(b.t * 1.35) * 0.006 + ruff * 0.028;
        rig.body.scale.set(breathe, breathe, 1 + ruff * 0.012);

        rig.root.position.y = b.base.bodyY + stepBob - b.thrust * 0.0015
            + Math.sin(b.t * 1.35) * 0.0012;
        rig.root.rotation.z = b.shift * 0.020 + ruff * 0.012;

        for (let i = 0; i < rig.wings.length; i++) {
            const side = i === 0 ? -1 : 1;
            const lift = b.wingLift + ruff * 0.10;
            rig.wings[i].rotation.z = side * -lift;
            rig.wings[i].rotation.x = -lift * 0.35;
            rig.wings[i].position.x = side * lift * 0.010;
            rig.wings[i].position.y = ruff * 0.004;
        }

        rig.tailPivot.rotation.x = -b.tailUp - b.peck * 0.30 + ruff * 0.06
            + Math.sin(b.t * 0.8) * 0.02;
        rig.tailPivot.rotation.y = b.yaw * 0.10;
        for (const f of rig.tailFeathers) {
            f.mesh.rotation.y = f.t * (0.20 + b.fan * 0.42 + ruff * 0.08);
        }

        rig.irisMat.emissiveIntensity = 0.55 + 0.35 * (1 - lidFlick);
    }

    /* ==========================================================
       8 · Who is here
       ========================================================== */

    const brains = [];

    // --- The one this world is about: on the back rail of the bench.
    const hero = makePigeon('blueBar', 1.0);
    {
        const th = bench.rotation.y, px = -0.16;
        hero.root.position.set(
            px * Math.cos(th) + RAIL_Z * Math.sin(th),
            RAIL_TOP,
            -px * Math.sin(th) + RAIL_Z * Math.cos(th)
        );
        hero.root.rotation.y = -0.34;
        scene.add(world.part('pigeon_00', hero.root));
        const b = makeBrain(hero, { perched: true });
        b.bobLeft = 3;
        brains.push(b);
    }

    // --- The rest of the congregation, working the flagstones.
    const GROUND_BIRDS = [
        { kind: 'checker', at: [0.62, 0, 1.28], yaw: -2.3, s: 0.98 },
        { kind: 'ash', at: [-1.05, 0, 1.62], yaw: 1.1, s: 0.94 },
        { kind: 'pied', at: [1.72, 0, 0.42], yaw: -1.5, s: 1.02 },
        { kind: 'blueBar', at: [-1.95, 0, 0.35], yaw: 0.4, s: 0.96 },
        { kind: 'checker', at: [2.45, 0, 2.15], yaw: 2.6, s: 0.92 },
    ];
    GROUND_BIRDS.forEach((spec, i) => {
        const rig = makePigeon(spec.kind, spec.s);
        rig.root.position.set(spec.at[0], spec.at[1], spec.at[2]);
        rig.root.rotation.y = spec.yaw;
        scene.add(world.part('pigeon_' + String(i + 1).padStart(2, '0'), rig.root));
        const b = makeBrain(rig, {
            perched: false,
            home: rig.root.position.clone(),
            roam: rr(0.55, 1.1),
        });
        b.heading = spec.yaw;
        brains.push(b);
    });

    // --- Two more in the air, wheeling over the square.
    const flyers = [];
    {
        const flyerBody = new THREE.MeshStandardMaterial({
            map: featherTex, color: 0x8b95a3, roughness: 0.8, envMapIntensity: 0.5,
        });
        const flyerWing = new THREE.MeshStandardMaterial({
            map: wingTexture(PLUMAGE.blueBar.bar, PLUMAGE.blueBar.wing), color: 0xffffff,
            side: THREE.DoubleSide, roughness: 0.8, envMapIntensity: 0.5,
        });
        for (let i = 0; i < 5; i++) {
            const g = new THREE.Group();
            const b = new THREE.Mesh(new THREE.CapsuleGeometry(0.048, 0.13, 6, 12), flyerBody);
            b.rotation.x = Math.PI / 2;
            b.scale.set(1, 1, 0.85);
            g.add(b);
            const h = new THREE.Mesh(new THREE.SphereGeometry(0.030, 12, 10), flyerBody);
            h.position.set(0, 0.020, 0.115);
            g.add(h);
            const tail = new THREE.Mesh(new THREE.PlaneGeometry(0.10, 0.13), flyerWing);
            tail.rotation.x = -Math.PI / 2;
            tail.position.set(0, 0, -0.155);
            g.add(tail);
            const ws = [];
            for (const side of [-1, 1]) {
                const pivot = new THREE.Group();
                pivot.position.set(side * 0.035, 0.020, 0.02);
                const geo = new THREE.PlaneGeometry(0.30, 0.13, 6, 2);
                const pos = geo.attributes.position;
                for (let v = 0; v < pos.count; v++) {
                    const x = pos.getX(v), y = pos.getY(v);
                    // root → tip, measured outward on whichever side this is
                    const t = clamp(((side > 0 ? x : -x) + 0.15) / 0.30, 0, 1);
                    pos.setY(v, y * lerp(1.0, 0.42, t) - t * t * 0.012);
                    pos.setZ(v, -t * t * 0.05);
                }
                geo.computeVertexNormals();
                geo.translate(side * 0.15, 0, 0);
                const w = new THREE.Mesh(geo, flyerWing);
                pivot.add(w);
                g.add(pivot);
                ws.push(pivot);
            }
            g.scale.setScalar(rr(0.85, 1.15));
            world.ghost(g);
            scene.add(g);
            flyers.push({
                g, wings: ws,
                radius: rr(7, 16), height: rr(5.5, 13), phase: rr(0, Math.PI * 2),
                speed: rr(0.16, 0.30), flap: rr(5.5, 8.0), bank: rr(0.25, 0.45),
            });
        }
    }

    /* ==========================================================
       9 · The rest of the square
       ========================================================== */

    // --- Lamppost, still burning from the night.
    const lampGlowMat = new THREE.MeshStandardMaterial({
        color: 0xfff0cc, emissive: 0xffb84a, emissiveIntensity: 3.2,
        transparent: true, opacity: 0.85,
    });
    const lampLight = new THREE.PointLight(0xffb44c, 2.4, 7.5, 2);
    {
        const lamp = new THREE.Group();
        const ironMat = new THREE.MeshStandardMaterial({
            color: 0x22292a, roughness: 0.45, metalness: 0.6, envMapIntensity: 0.9,
        });
        const post = new THREE.Mesh(
            sweep([V3(0, 0, 0), V3(0, 0.5, 0), V3(0, 1.6, 0), V3(0, 2.7, 0), V3(0, 3.05, 0)],
                (t) => lerp(0.052, 0.028, Math.pow(t, 0.7)), 14),
            ironMat
        );
        post.castShadow = post.receiveShadow = true;
        lamp.add(post);
        const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.10, 0.16, 0.22, 14), ironMat);
        foot.position.y = 0.11;
        foot.castShadow = true;
        lamp.add(foot);
        for (let i = 0; i < 3; i++) {
            const ring = new THREE.Mesh(new THREE.TorusGeometry(0.045 - i * 0.004, 0.010, 6, 18), ironMat);
            ring.rotation.x = Math.PI / 2;
            ring.position.y = 0.36 + i * 0.10;
            lamp.add(ring);
        }
        const cage = new THREE.Mesh(
            new THREE.CylinderGeometry(0.135, 0.105, 0.38, 4), ironMat);
        cage.position.y = 3.26;
        cage.rotation.y = Math.PI / 4;
        cage.castShadow = true;
        lamp.add(cage);
        const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.115, 0.088, 0.34, 4), lampGlowMat);
        glass.position.y = 3.26;
        glass.rotation.y = Math.PI / 4;
        lamp.add(glass);
        const cap = new THREE.Mesh(new THREE.ConeGeometry(0.185, 0.16, 4), ironMat);
        cap.position.y = 3.52;
        cap.rotation.y = Math.PI / 4;
        cap.castShadow = true;
        lamp.add(cap);
        const finial = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8), ironMat);
        finial.position.y = 3.62;
        lamp.add(finial);
        lampLight.position.set(0, 3.22, 0);
        lamp.add(lampLight);
        lamp.position.set(-2.55, 0, 1.75);
        scene.add(world.part('lamppost_00', lamp));
    }

    // --- A planter, for something alive that is not a bird.
    {
        const planter = new THREE.Group();
        const stone = new THREE.MeshStandardMaterial({ color: 0x9c9284, roughness: 0.95 });
        const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.36, 0.44, 22), stone);
        bowl.position.y = 0.22;
        bowl.castShadow = bowl.receiveShadow = true;
        planter.add(bowl);
        const lip = new THREE.Mesh(new THREE.TorusGeometry(0.455, 0.038, 8, 24), stone);
        lip.rotation.x = Math.PI / 2;
        lip.position.y = 0.44;
        lip.castShadow = true;
        planter.add(lip);
        const soil = new THREE.Mesh(new THREE.CircleGeometry(0.44, 20).rotateX(-Math.PI / 2),
            new THREE.MeshStandardMaterial({ color: 0x38291d, roughness: 1 }));
        soil.position.y = 0.42;
        planter.add(soil);
        // Geraniums: instanced blades plus a scatter of red heads.
        const stem = new THREE.BufferGeometry();
        {
            const sp = [], su = [], si = [];
            const segs = 3;
            for (let i = 0; i <= segs; i++) {
                const t = i / segs, w = 0.014 * (1 - t * 0.7), y = t * 0.24;
                sp.push(-w, y, 0, w, y, 0);
                su.push(0, t, 1, t);
            }
            for (let i = 0; i < segs; i++) { const a = i * 2; si.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
            stem.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
            stem.setAttribute('uv', new THREE.Float32BufferAttribute(su, 2));
            stem.setIndex(si);
            stem.computeVertexNormals();
        }
        const foliageMat = windPatch(new THREE.MeshStandardMaterial({
            color: 0x4f7a2e, roughness: 0.9, side: THREE.DoubleSide,
        }), 1.5, 0.16, 1.9);
        const clump = new THREE.InstancedMesh(stem, foliageMat, 340);
        const m = new THREE.Matrix4(), q = new THREE.Quaternion(),
            p = new THREE.Vector3(), s = new THREE.Vector3(), e = new THREE.Euler();
        for (let i = 0; i < 340; i++) {
            const a = rr(0, Math.PI * 2), rad = Math.pow(rnd(), 0.5) * 0.40;
            p.set(Math.cos(a) * rad, 0.40, Math.sin(a) * rad);
            e.set(rr(-0.3, 0.3), rr(0, 6.28), rr(-0.3, 0.3)); q.setFromEuler(e);
            s.setScalar(rr(0.7, 1.5));
            m.compose(p, q, s);
            clump.setMatrixAt(i, m);
        }
        clump.instanceMatrix.needsUpdate = true;
        clump.castShadow = true;
        planter.add(clump);
        const bloomMat = new THREE.MeshStandardMaterial({
            color: 0xd63b3b, emissive: 0x6b1010, emissiveIntensity: 0.5, roughness: 0.75,
        });
        const heads = new THREE.InstancedMesh(new THREE.SphereGeometry(0.030, 8, 6), bloomMat, 30);
        for (let i = 0; i < 30; i++) {
            const a = rr(0, Math.PI * 2), rad = Math.pow(rnd(), 0.5) * 0.36;
            p.set(Math.cos(a) * rad, rr(0.56, 0.68), Math.sin(a) * rad);
            q.setFromEuler(e.set(0, 0, 0));
            s.set(rr(0.8, 1.3), rr(0.7, 1.1), rr(0.8, 1.3));
            m.compose(p, q, s);
            heads.setMatrixAt(i, m);
        }
        heads.instanceMatrix.needsUpdate = true;
        heads.castShadow = true;
        planter.add(heads);
        planter.position.set(3.15, 0, -1.15);
        scene.add(world.part('planter_00', planter));
    }

    // --- Crumbs. The reason for the gathering.
    {
        const crumbMat = new THREE.MeshStandardMaterial({ color: 0xd8bf90, roughness: 0.9 });
        const crumbs = new THREE.InstancedMesh(new THREE.TetrahedronGeometry(0.011, 0), crumbMat, 120);
        const m = new THREE.Matrix4(), q = new THREE.Quaternion(),
            p = new THREE.Vector3(), s = new THREE.Vector3(), e = new THREE.Euler();
        const tint = new THREE.Color();
        for (let i = 0; i < 120; i++) {
            const a = rr(0, Math.PI * 2), rad = Math.pow(rnd(), 0.6) * 1.8;
            p.set(0.7 + Math.cos(a) * rad, 0.008, 1.15 + Math.sin(a) * rad * 0.8);
            e.set(rr(0, 6.28), rr(0, 6.28), rr(0, 6.28)); q.setFromEuler(e);
            s.set(rr(0.5, 1.6), rr(0.4, 1.0), rr(0.5, 1.6));
            m.compose(p, q, s);
            crumbs.setMatrixAt(i, m);
            tint.setHSL(rr(0.07, 0.12), rr(0.25, 0.5), rr(0.55, 0.82));
            crumbs.setColorAt(i, tint);
        }
        crumbs.instanceMatrix.needsUpdate = true;
        if (crumbs.instanceColor) crumbs.instanceColor.needsUpdate = true;
        crumbs.castShadow = true;
        scene.add(world.ghost(crumbs));
    }

    // --- Fallen leaves drifted across the flagstones.
    {
        const leafFlatMat = new THREE.MeshStandardMaterial({
            map: leafTex, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.9, color: 0xc9a15c,
        });
        const litter = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.20, 0.20), leafFlatMat, 90);
        const m = new THREE.Matrix4(), q = new THREE.Quaternion(),
            p = new THREE.Vector3(), s = new THREE.Vector3(), e = new THREE.Euler();
        const tint = new THREE.Color();
        for (let i = 0; i < 90; i++) {
            const a = rr(0, Math.PI * 2), rad = Math.pow(rnd(), 0.55) * (PLAZA_R - 0.5);
            p.set(Math.cos(a) * rad, 0.006 + rr(0, 0.004), Math.sin(a) * rad);
            e.set(-Math.PI / 2 + rr(-0.25, 0.25), rr(0, 6.28), rr(-0.2, 0.2));
            q.setFromEuler(e);
            s.setScalar(rr(0.55, 1.1));
            m.compose(p, q, s);
            litter.setMatrixAt(i, m);
            tint.setHSL(rr(0.07, 0.16), rr(0.35, 0.65), rr(0.30, 0.55));
            litter.setColorAt(i, tint);
        }
        litter.instanceMatrix.needsUpdate = true;
        if (litter.instanceColor) litter.instanceColor.needsUpdate = true;
        litter.receiveShadow = true;
        scene.add(world.ghost(litter));
    }

    /* ==========================================================
       10 · The air
       ========================================================== */

    // Dust and down turning over in the low sun. All of the motion is in the
    // vertex stage; the CPU only advances one clock.
    {
        const COUNT = 900;
        const geo = new THREE.BufferGeometry();
        const pos = new Float32Array(COUNT * 3);
        const phase = new Float32Array(COUNT);
        const speed = new Float32Array(COUNT);
        const size = new Float32Array(COUNT);
        for (let i = 0; i < COUNT; i++) {
            const a = rr(0, Math.PI * 2), rad = Math.pow(rnd(), 0.6) * 9;
            pos[i * 3] = Math.cos(a) * rad;
            pos[i * 3 + 1] = rr(0.05, 3.2);
            pos[i * 3 + 2] = Math.sin(a) * rad;
            phase[i] = rnd();
            speed[i] = rr(0.02, 0.10);
            size[i] = rr(0.6, 2.6);
        }
        geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        geo.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1));
        geo.setAttribute('aSpeed', new THREE.BufferAttribute(speed, 1));
        geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));

        const dust = new THREE.Points(geo, new THREE.ShaderMaterial({
            uniforms: { uTime, uCol: { value: srgb(0xffe2b4) } },
            transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
            vertexShader: `
              uniform float uTime;
              attribute float aPhase, aSpeed, aSize;
              varying float vA;
              void main(){
                vec3 p = position;
                p.y += mod(uTime * aSpeed + aPhase * 3.4, 3.4);
                p.x += sin(uTime * 0.36 + aPhase * 6.283) * 0.42;
                p.z += cos(uTime * 0.29 + aPhase * 6.283) * 0.42;
                vec4 mv = modelViewMatrix * vec4(p, 1.0);
                gl_PointSize = aSize * (150.0 / max(-mv.z, 0.2));
                vA = 0.25 + 0.75 * (0.5 + 0.5 * sin(uTime * 1.4 + aPhase * 21.0));
                gl_Position = projectionMatrix * mv;
              }`,
            fragmentShader: `
              varying float vA; uniform vec3 uCol;
              void main(){
                float d = length(gl_PointCoord - 0.5);
                float a = smoothstep(0.5, 0.04, d);
                if (a < 0.01) discard;
                gl_FragColor = vec4(uCol, a * vA * 0.42);
              }`,
        }));
        dust.frustumCulled = false;
        scene.add(world.ghost(dust));
    }

    // Warm haze stacked against the sun so the light has somewhere to land.
    {
        const hazeTex = world.canvasTexture(128, 128, (g, cv) => {
            const S = cv.width;
            const rad = g.createRadialGradient(S / 2, S / 2, 2, S / 2, S / 2, S / 2);
            rad.addColorStop(0, 'rgba(255,232,190,0.85)');
            rad.addColorStop(0.45, 'rgba(255,220,170,0.28)');
            rad.addColorStop(1, 'rgba(255,214,160,0)');
            g.fillStyle = rad; g.fillRect(0, 0, S, S);
        });
        for (let i = 0; i < 5; i++) {
            const sp = new THREE.Sprite(new THREE.SpriteMaterial({
                map: hazeTex, transparent: true, depthWrite: false, fog: false,
                blending: THREE.AdditiveBlending, opacity: rr(0.10, 0.26),
            }));
            const d = rr(18, 40);
            sp.position.copy(SUN_DIR).multiplyScalar(d).add(V3(rr(-6, 6), rr(-3, 3), rr(-6, 6)));
            const sz = rr(10, 26);
            sp.scale.set(sz, sz * rr(0.5, 0.9), 1);
            sp.renderOrder = -4;
            scene.add(world.ghost(sp));
        }
    }

    // A few leaves still coming down.
    const fallers = [];
    {
        const fallMat = new THREE.MeshStandardMaterial({
            map: leafTex, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.9, color: 0xd8b06a,
        });
        for (let i = 0; i < 9; i++) {
            const m = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.16), fallMat);
            world.ghost(m);
            scene.add(m);
            fallers.push({
                mesh: m,
                x: rr(-5, 5), z: rr(-6, 4),
                y: rr(0.5, 6.5), fall: rr(0.22, 0.45),
                sway: rr(0.5, 1.3), phase: rr(0, 6.28), spin: rr(-1.6, 1.6),
            });
        }
    }

    /* ==========================================================
       11 · What moves
       ========================================================== */

    const tmpV = new THREE.Vector3();

    world.frame((dt, t) => {
        uTime.value = t;

        for (const b of brains) updateBrain(b, dt);

        for (const f of flyers) {
            const a = f.phase + t * f.speed;
            const x = Math.cos(a) * f.radius;
            const z = Math.sin(a) * f.radius;
            const y = f.height + Math.sin(a * 2.3 + f.phase) * 0.8;
            tmpV.set(x, y, z);
            f.g.position.copy(tmpV);
            f.g.rotation.y = -a + Math.PI / 2;
            f.g.rotation.z = f.bank * Math.sin(a * 1.0 + 0.4);
            const flap = Math.sin(t * f.flap + f.phase);
            const up = flap > 0 ? Math.pow(flap, 0.6) : -Math.pow(-flap, 1.5) * 0.7;
            f.wings[0].rotation.z = -up * 0.95;
            f.wings[1].rotation.z = up * 0.95;
            f.wings[0].rotation.y = up * 0.16;
            f.wings[1].rotation.y = -up * 0.16;
        }

        for (const f of fallers) {
            f.y -= f.fall * dt;
            if (f.y < 0.02) { f.y = rr(5.5, 8.0); f.x = rr(-5, 5); f.z = rr(-6, 4); }
            f.mesh.position.set(
                f.x + Math.sin(t * f.sway + f.phase) * 0.45,
                f.y,
                f.z + Math.cos(t * f.sway * 0.8 + f.phase) * 0.35
            );
            f.mesh.rotation.set(t * f.spin * 0.7, t * f.spin, Math.sin(t * f.sway) * 0.9);
        }

        // The lamp is on borrowed time: it flickers and slowly gives up as the
        // sun takes over.
        const fade = 0.55 + 0.45 * Math.max(0, Math.cos(t * 0.035));
        const flick = 1 + Math.sin(t * 21) * 0.03 + Math.sin(t * 47) * 0.018;
        lampGlowMat.emissiveIntensity = 3.2 * fade * flick;
        lampLight.intensity = 2.4 * fade * flick;
    });
}
