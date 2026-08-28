//
//  remembrance-rise.scene.js
//  Project27 worlds
//
//  Just south of Melbourne's CBD: a shrine on a grassed mound, two great flights
//  of stone steps down to a plaza, and a park of elms and pencil pines holding
//  the whole thing quiet while the city stands off in the haze to the north.
//
//  What it is made of, and why any of it is code:
//
//   · a sky shader with a real mackerel front rolling across half of it — the
//     altocumulus in the reference photograph is the picture, and no sprite
//     sheet does rows of cloud that stretch and thin towards the horizon;
//   · a lawn that is one displaced plane, tinted by noise, with the mound cut
//     out of two square frusta so the walk can climb it;
//   · a monument merged down to a handful of meshes and an instanced colonnade,
//     ashlar-textured with UVs rescaled per face so the courses stay the same
//     size on a stair riser and on a thirty-metre wall;
//   · three flags waved in the vertex stage, an eternal flame that flickers on
//     the one point light this world spends, and elms that move in the same
//     wind the flags are in.
//
//  North is +Z: the shrine faces the city down its own axis, the way it does.
//  Metres, y-up, plaza at y = 0.
//

//  The bench, the flagpole, the urn, the lamp and the wreath also live in
//  `props/` as library pieces anybody can drop into another world. They are
//  built again here rather than imported: the world's copies share its stone,
//  bronze and gold materials — five fewer textures on an iPad — and a couple of
//  them are posed for where they stand. Correctness over purity; the two copies
//  are allowed to drift.
//

import { mergeGeometries } from './BufferGeometryUtils.js';

export default function build(world) {
    const { THREE, scene, camera } = world;

    world.ownsSky(true);
    world.groundLevel(0);
    // Sparing: the flame, the lamp glass and the gold finials are the only
    // things meant to bleed, and a memorial that glows is a memorial ruined.
    world.bloom({ strength: 0.17, radius: 0.72, threshold: 0.88 });

    /* ============================================================
       0 · small tools
       ============================================================ */

    const srgb = (hex) => new THREE.Color(hex).convertSRGBToLinear();
    const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
    const smoothstep = (e0, e1, x) => { const t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };

    let _seed = 19341112;
    const rnd = () => { _seed = (_seed * 1664525 + 1013904223) % 4294967296; return _seed / 4294967296; };
    const rr = (a, b) => a + (b - a) * rnd();

    const hash2 = (x, y) => { const n = Math.sin(x * 127.1 + y * 311.7) * 43758.545; return n - Math.floor(n); };
    function vnoise(x, y) {
        const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
        const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
        const a = hash2(xi, yi), b = hash2(xi + 1, yi), c = hash2(xi, yi + 1), d = hash2(xi + 1, yi + 1);
        return a * (1 - u) * (1 - v) + b * u * (1 - v) + c * (1 - u) * v + d * u * v;
    }
    function fbm2(x, y, oct = 4) {
        let s = 0, a = 0.5, f = 1;
        for (let i = 0; i < oct; i++) { s += a * vnoise(x * f, y * f); f *= 2.07; a *= 0.5; }
        return s;
    }

    /** Merge, having first agreed on indexed-ness — a null merge is a dead viewport. */
    const weld = (parts) => mergeGeometries(parts.map((g) => (g.index ? g.toNonIndexed() : g)));

    /**
     * A box whose UVs are in metres rather than in fractions of a face.
     *
     * Every stone in this world comes off one ashlar texture, and a texture
     * mapped 0..1 per face puts twenty-centimetre courses on a stair riser and
     * six-metre courses on the cella wall. Rescaling each face by its own size
     * is what makes one material serve a whole monument.
     */
    function stoneBox(w, h, d, tile = 2.4) {
        const g = new THREE.BoxGeometry(w, h, d);
        const uv = g.attributes.uv;
        const spans = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
        for (let f = 0; f < 6; f++) {
            const su = spans[f][0] / tile, sv = spans[f][1] / tile;
            for (let i = 0; i < 4; i++) {
                const k = f * 4 + i;
                uv.setXY(k, uv.getX(k) * su, uv.getY(k) * sv);
            }
        }
        uv.needsUpdate = true;
        return g;
    }

    /* ============================================================
       1 · the hour, and the light in it
       ============================================================ */

    // Late winter afternoon, the sun round to the north-west, which is what
    // lights the façade in the photographs and throws the mound's shadow east.
    const SUN_DIR = new THREE.Vector3(-0.46, 0.60, 0.66).normalize();
    const C_SUN = srgb(0xfff0d2);
    const C_SKY_TOP = srgb(0x1c5fc4);
    const C_SKY_MID = srgb(0x5ea3e6);
    const C_HORIZON = srgb(0xbcd8ea);

    scene.fog = new THREE.FogExp2(C_HORIZON.clone(), 0.0011);
    camera.position.set(6, 16, 168);

    const sun = new THREE.DirectionalLight(0xfff3da, 2.7);
    sun.position.copy(SUN_DIR).multiplyScalar(460);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    {
        const sc = sun.shadow.camera;
        sc.left = -125; sc.right = 125; sc.top = 125; sc.bottom = -125;
        sc.near = 150; sc.far = 900;
        sun.shadow.bias = -0.0011;
        sun.shadow.normalBias = 0.6;
    }
    scene.add(sun, sun.target);
    scene.add(new THREE.HemisphereLight(0xbcdcff, 0x4c5c34, 1.15));
    scene.add(new THREE.AmbientLight(0xdcebff, 0.24));

    // Everything that moves in the wind shares one clock.
    const uWind = { value: 0 };
    const uFlagTime = { value: 0 };

    /* ============================================================
       2 · sky: a mackerel front, half the dome of it
       ============================================================ */

    const skyUniforms = {
        uSunDir: { value: SUN_DIR.clone() },
        uSunCol: { value: C_SUN.clone() },
        uTop: { value: C_SKY_TOP.clone() },
        uMid: { value: C_SKY_MID.clone() },
        uHor: { value: C_HORIZON.clone() },
        uTime: { value: 0 },
    };

    const sky = new THREE.Mesh(
        new THREE.SphereGeometry(4200, 40, 26),
        new THREE.ShaderMaterial({
            side: THREE.BackSide, depthWrite: false, fog: false, uniforms: skyUniforms,
            vertexShader: /* glsl */`
                varying vec3 vDir;
                void main() {
                    vDir = position;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }`,
            fragmentShader: /* glsl */`
                varying vec3 vDir;
                uniform vec3 uSunDir, uSunCol, uTop, uMid, uHor;
                uniform float uTime;

                float hash21(vec2 p) {
                    p = fract(p * vec2(123.34, 456.21));
                    p += dot(p, p + 45.32);
                    return fract(p.x * p.y);
                }
                float vnoise(vec2 p) {
                    vec2 i = floor(p), f = fract(p);
                    vec2 u = f * f * (3.0 - 2.0 * f);
                    float a = hash21(i), b = hash21(i + vec2(1.0, 0.0));
                    float c = hash21(i + vec2(0.0, 1.0)), d = hash21(i + vec2(1.0, 1.0));
                    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
                }
                float fbm(vec2 p) {
                    float s = 0.0, a = 0.5;
                    for (int i = 0; i < 5; i++) { s += a * vnoise(p); p = p * 2.03 + 11.7; a *= 0.5; }
                    return s;
                }

                void main() {
                    vec3 d = normalize(vDir);

                    // The clear gradient first: horizon haze into a hard winter blue.
                    vec3 col = mix(uHor, uMid, smoothstep(-0.02, 0.28, d.y));
                    col = mix(col, uTop, smoothstep(0.14, 0.88, d.y));
                    float sd = max(dot(d, uSunDir), 0.0);
                    vec3 glow = mix(uSunCol, vec3(1.0), 0.4);
                    col += glow * pow(sd, 20.0) * 0.20;
                    col += glow * pow(sd, 4.0) * 0.028;

                    // Altocumulus: the plane at cloud height, projected onto the
                    // dome, so the rows compress towards the horizon on their own.
                    float up = max(d.y, 0.055);
                    vec2 uv = d.xz / up;
                    uv = uv * 0.052 + vec2(uTime * 0.0016, uTime * 0.0011);
                    float body = fbm(uv * vec2(1.9, 1.0));
                    float ripple = fbm(uv * vec2(9.5, 4.4) + 3.3);
                    float m = smoothstep(0.42, 0.80, body * 0.74 + ripple * 0.44);

                    // A front occupies a quarter of the sky rather than all of it.
                    vec3 flat_d = vec3(d.x, 0.0, d.z);
                    float fl = max(length(flat_d), 1e-4);
                    float side = dot(flat_d / fl, vec3(0.62, 0.0, 0.79));
                    float band = smoothstep(-0.35, 0.55, side);
                    float cover = m * band * smoothstep(0.015, 0.20, d.y) * (1.0 - 0.35 * smoothstep(0.7, 1.0, d.y));

                    // Thin cirrus, high and streaked, over the clear half.
                    float cir = smoothstep(0.55, 0.95, fbm(uv * vec2(0.7, 3.4) - 7.1));
                    cover = max(cover, cir * 0.30 * smoothstep(0.10, 0.45, d.y));

                    vec3 cloudLit = mix(vec3(0.82, 0.86, 0.93), vec3(1.06, 1.04, 1.00), pow(sd, 1.6) * 0.7 + 0.35);
                    col = mix(col, cloudLit, clamp(cover, 0.0, 0.94));

                    // The disc itself, small and cold.
                    col += uSunCol * smoothstep(0.9986, 0.99958, sd) * 5.0;
                    gl_FragColor = vec4(col, 1.0);
                }`,
        })
    );
    sky.renderOrder = -10;
    sky.frustumCulled = false;
    world.ghost(sky);
    scene.add(sky);

    /* ============================================================
       3 · materials: grass, stone, slate, paving
       ============================================================ */

    const grassTex = world.canvasTexture(256, 256, (g, cv) => {
        g.fillStyle = '#3f7231';
        g.fillRect(0, 0, cv.width, cv.height);
        for (let i = 0; i < 2600; i++) {
            const v = rr(0, 1);
            g.strokeStyle = `rgba(${(46 + v * 78) | 0},${(96 + v * 74) | 0},${(36 + v * 46) | 0},${rr(0.25, 0.7).toFixed(3)})`;
            g.lineWidth = rr(0.6, 1.8);
            const x = rr(0, cv.width), y = rr(0, cv.height), len = rr(3, 9);
            g.beginPath();
            g.moveTo(x, y);
            g.lineTo(x + rr(-1.5, 1.5), y - len);
            g.stroke();
        }
        // The mower has been over it in stripes, as it has since 1934.
        for (let i = 0; i < 4; i++) {
            g.fillStyle = i % 2 ? 'rgba(226,246,206,0.055)' : 'rgba(12,40,10,0.055)';
            g.fillRect(0, (i * cv.height) / 4, cv.width, cv.height / 4);
        }
    });
    grassTex.wrapS = grassTex.wrapT = THREE.RepeatWrapping;
    grassTex.repeat.set(120, 120);

    const grassTexMound = grassTex.clone();
    grassTexMound.needsUpdate = true;
    grassTexMound.wrapS = grassTexMound.wrapT = THREE.RepeatWrapping;
    grassTexMound.repeat.set(26, 26);

    const lawnMat = new THREE.MeshStandardMaterial({
        map: grassTex, roughness: 1.0, metalness: 0.0, vertexColors: true,
    });
    const moundMat = new THREE.MeshStandardMaterial({
        map: grassTexMound, color: 0xd8ecc4, roughness: 1.0, metalness: 0.0,
    });

    const stoneTex = world.canvasTexture(512, 512, (g, cv) => {
        g.fillStyle = '#cfc6ad';
        g.fillRect(0, 0, cv.width, cv.height);
        // Mottle first — granite is never one colour twice.
        for (let i = 0; i < 5200; i++) {
            const v = 150 + rr(0, 86);
            g.fillStyle = `rgba(${v | 0},${(v - 7) | 0},${(v - 30) | 0},${rr(0.05, 0.2).toFixed(3)})`;
            g.beginPath();
            g.arc(rr(0, cv.width), rr(0, cv.height), rr(1, 9), 0, Math.PI * 2);
            g.fill();
        }
        // Then the courses: one bed joint every quarter, perpends staggered.
        const rows = 4, rh = cv.height / rows;
        g.lineWidth = 3;
        for (let r = 0; r < rows; r++) {
            g.strokeStyle = 'rgba(118,110,92,0.42)';
            g.beginPath();
            g.moveTo(0, r * rh);
            g.lineTo(cv.width, r * rh);
            g.stroke();
            const off = (r % 2) * (cv.width / 4);
            for (let c = 0; c < 2; c++) {
                const x = off + c * (cv.width / 2);
                g.strokeStyle = 'rgba(118,110,92,0.30)';
                g.beginPath();
                g.moveTo(x, r * rh);
                g.lineTo(x, r * rh + rh);
                g.stroke();
            }
            // A whisper of shadow under each course.
            const sh = g.createLinearGradient(0, r * rh, 0, r * rh + 10);
            sh.addColorStop(0, 'rgba(90,84,68,0.20)');
            sh.addColorStop(1, 'rgba(90,84,68,0)');
            g.fillStyle = sh;
            g.fillRect(0, r * rh, cv.width, 10);
        }
        // Weathering, running down from wherever water sits.
        for (let i = 0; i < 14; i++) {
            const x = rr(0, cv.width);
            const st = g.createLinearGradient(x, 0, x, cv.height);
            st.addColorStop(0, 'rgba(104,96,78,0.16)');
            st.addColorStop(1, 'rgba(104,96,78,0)');
            g.fillStyle = st;
            g.fillRect(x, 0, rr(5, 22), cv.height);
        }
    });
    stoneTex.wrapS = stoneTex.wrapT = THREE.RepeatWrapping;

    const stoneMat = new THREE.MeshStandardMaterial({
        map: stoneTex, color: 0xf3ead4, roughness: 0.92, metalness: 0.0,
    });
    const stoneWarmMat = new THREE.MeshStandardMaterial({
        map: stoneTex, color: 0xe6d8b8, roughness: 0.94, metalness: 0.0,
    });

    const slateTex = world.canvasTexture(256, 256, (g, cv) => {
        g.fillStyle = '#4b4a48';
        g.fillRect(0, 0, cv.width, cv.height);
        for (let i = 0; i < 2400; i++) {
            const v = 52 + rr(0, 54);
            g.fillStyle = `rgba(${v | 0},${(v + 1) | 0},${(v + 3) | 0},${rr(0.08, 0.34).toFixed(3)})`;
            g.fillRect(rr(0, cv.width), rr(0, cv.height), rr(2, 14), rr(1, 5));
        }
        g.strokeStyle = 'rgba(28,28,30,0.5)';
        g.lineWidth = 2;
        for (let r = 1; r < 8; r++) {
            g.beginPath();
            g.moveTo(0, (r * cv.height) / 8);
            g.lineTo(cv.width, (r * cv.height) / 8);
            g.stroke();
        }
    });
    slateTex.wrapS = slateTex.wrapT = THREE.RepeatWrapping;
    const slateMat = new THREE.MeshStandardMaterial({
        map: slateTex, color: 0x8c8a88, roughness: 0.85, metalness: 0.08,
    });

    const paveTex = world.canvasTexture(512, 512, (g, cv) => {
        g.fillStyle = '#9c968d';
        g.fillRect(0, 0, cv.width, cv.height);
        for (let i = 0; i < 4200; i++) {
            const v = 128 + rr(0, 66);
            g.fillStyle = `rgba(${v | 0},${(v - 3) | 0},${(v - 9) | 0},${rr(0.05, 0.19).toFixed(3)})`;
            g.beginPath();
            g.arc(rr(0, cv.width), rr(0, cv.height), rr(1, 8), 0, Math.PI * 2);
            g.fill();
        }
        // Four slabs to the tile, sawn joints, each slab a touch off its neighbour.
        const n = 4, s = cv.width / n;
        for (let r = 0; r < n; r++) {
            for (let c = 0; c < n; c++) {
                g.fillStyle = `rgba(${rr(-1, 1) > 0 ? 255 : 60},${rr(-1, 1) > 0 ? 255 : 60},255,${rr(0.01, 0.05).toFixed(3)})`;
                g.fillRect(c * s, r * s, s, s);
            }
        }
        g.strokeStyle = 'rgba(78,74,68,0.55)';
        g.lineWidth = 3;
        for (let i = 1; i < n; i++) {
            g.beginPath(); g.moveTo(i * s, 0); g.lineTo(i * s, cv.height); g.stroke();
            g.beginPath(); g.moveTo(0, i * s); g.lineTo(cv.width, i * s); g.stroke();
        }
    });
    paveTex.wrapS = paveTex.wrapT = THREE.RepeatWrapping;
    const paveMat = new THREE.MeshStandardMaterial({
        map: paveTex, color: 0xbdb6ab, roughness: 0.95, metalness: 0.0,
    });

    const bronzeMat = new THREE.MeshStandardMaterial({ color: 0x50604a, roughness: 0.45, metalness: 0.8 });
    const goldMat = new THREE.MeshStandardMaterial({
        color: 0xb98f36, emissive: 0x3a2a08, emissiveIntensity: 1.0, roughness: 0.28, metalness: 0.95,
    });

    /* ============================================================
       4 · the park floor
       ============================================================ */

    /**
     * The lawn's height, and the only place it is decided.
     *
     * Flat across the precinct and all the way up the avenue, because paving is
     * flat and terrain that rolls through a slab is the oldest bug in outdoor
     * scenes; rolling once it is clear of both.
     */
    function terrainY(x, z) {
        const inPrecinct = Math.max(Math.abs(x) - 105, Math.abs(z - 30) - 145, 0);
        const inAvenue = Math.max(Math.abs(x) - 42, Math.abs(z - 330) - 168, 0);
        const k = smoothstep(0, 70, Math.min(inPrecinct, inAvenue));
        const h = (fbm2(x * 0.0055, z * 0.0055, 4) - 0.5) * 8.0
                + (fbm2(x * 0.021, z * 0.021, 2) - 0.5) * 1.1;
        return h * k;
    }

    const LAWN = 900;
    const lawnGeo = new THREE.PlaneGeometry(LAWN, LAWN, 110, 110);
    lawnGeo.rotateX(-Math.PI / 2);
    {
        const pos = lawnGeo.attributes.position;
        const colours = new Float32Array(pos.count * 3);
        const tint = new THREE.Color();
        for (let i = 0; i < pos.count; i++) {
            const x = pos.getX(i), z = pos.getZ(i);
            pos.setY(i, terrainY(x, z));

            // Big soft patches: watered, worn, shaded. Vertex colour is free.
            const p = fbm2(x * 0.011 + 5.5, z * 0.011 - 2.2, 3);
            tint.setRGB(0.78 + p * 0.42, 0.86 + p * 0.30, 0.72 + p * 0.34);
            colours[i * 3] = tint.r; colours[i * 3 + 1] = tint.g; colours[i * 3 + 2] = tint.b;
        }
        pos.needsUpdate = true;
        lawnGeo.setAttribute('color', new THREE.BufferAttribute(colours, 3));
        lawnGeo.computeVertexNormals();
    }
    const lawn = new THREE.Mesh(lawnGeo, lawnMat);
    lawn.receiveShadow = true;
    world.ground(lawn);
    scene.add(lawn);

    /* ---- plaza, forecourt and the avenue north --------------------------- */

    const PLAZA_Z0 = 66, PLAZA_Z1 = 152;

    function paving(w, d, cx, cz, y, tile) {
        const g = new THREE.PlaneGeometry(w, d);
        g.rotateX(-Math.PI / 2);
        const uv = g.attributes.uv;
        for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * (w / tile), uv.getY(i) * (d / tile));
        uv.needsUpdate = true;
        g.translate(cx, y, cz);
        const m = new THREE.Mesh(g, paveMat);
        m.receiveShadow = true;
        return m;
    }

    const plaza = paving(148, PLAZA_Z1 - PLAZA_Z0, 0, (PLAZA_Z0 + PLAZA_Z1) / 2, 0.04, 6);
    world.ground(plaza);
    scene.add(plaza);

    const forecourt = paving(74, 104, 0, 204, 0.04, 6);
    world.ground(forecourt);
    scene.add(forecourt);

    const avenue = paving(30, 210, 0, 360, 0.04, 6);
    world.ground(avenue);
    scene.add(avenue);

    // The chequer: grass squares set into the forecourt paving, two panels of
    // them either side of the line people walk. A couple of hundred slabs of
    // turf, and one draw call.
    {
        const squares = [];
        const cell = 3.2, pitch = cell * 1.06;
        for (let ix = 0; ix < 20; ix++) {
            for (let iz = 0; iz < 23; iz++) {
                if ((ix + iz) % 2) continue;
                const x = -34 + ix * pitch + cell / 2;
                if (Math.abs(x) < 9) continue;          // the line people walk stays stone
                squares.push([x, 162 + iz * pitch]);
            }
        }
        const turf = new THREE.InstancedMesh(
            new THREE.BoxGeometry(cell, 0.10, cell),
            new THREE.MeshStandardMaterial({ color: 0x4d7a38, roughness: 1.0 }),
            squares.length
        );
        const m4 = new THREE.Matrix4();
        for (let i = 0; i < squares.length; i++) {
            m4.makeTranslation(squares[i][0], 0.06, squares[i][1]);
            turf.setMatrixAt(i, m4);
        }
        turf.instanceMatrix.needsUpdate = true;
        turf.receiveShadow = true;
        // Ghosted: a hundred-odd ten-centimetre kerbs is collision work nobody
        // walking the forecourt would ever feel.
        world.ghost(turf);
        scene.add(turf);
    }

    // The line cut into the plaza. In the photograph you read it under your feet
    // before you look up, which is the whole design of the place.
    {
        const wordsTex = world.canvasTexture(1024, 256, (g, cv) => {
            g.clearRect(0, 0, cv.width, cv.height);
            g.fillStyle = 'rgba(58,54,48,0.72)';
            g.textAlign = 'center';
            g.font = 'bold 74px Georgia, serif';
            g.fillText('WE WILL', cv.width / 2, 88);
            g.fillText('REMEMBER THEM', cv.width / 2, 176);
            g.strokeStyle = 'rgba(226,222,212,0.35)';
            g.lineWidth = 2;
            g.strokeText('WE WILL', cv.width / 2, 86);
            g.strokeText('REMEMBER THEM', cv.width / 2, 174);
        });
        const words = new THREE.Mesh(
            new THREE.PlaneGeometry(20, 5).rotateX(-Math.PI / 2),
            new THREE.MeshStandardMaterial({
                map: wordsTex, transparent: true, roughness: 1.0, depthWrite: false,
            })
        );
        words.position.set(0, 0.06, 120);
        words.renderOrder = 1;
        world.ghost(words);
        scene.add(words);
    }

    /* ============================================================
       5 · the mound: two raised steps of it
       ============================================================ */

    const TA = { base: 66, top: 58, y0: 0, y1: 3.0 };
    const TB = { base: 46, top: 38, y0: 3.0, y1: 6.0 };

    /** A square frustum — the batter of a grassed terrace, four sides of it. */
    function terraceMesh(t) {
        const g = new THREE.CylinderGeometry(t.top * Math.SQRT2, t.base * Math.SQRT2, t.y1 - t.y0, 4, 1, false);
        g.rotateY(Math.PI / 4);
        g.translate(0, (t.y0 + t.y1) / 2, 0);
        const m = new THREE.Mesh(g, moundMat);
        m.castShadow = true;
        m.receiveShadow = true;
        return m;
    }
    const terraceA = terraceMesh(TA);
    const terraceB = terraceMesh(TB);
    world.ground(terraceA);
    world.ground(terraceB);
    scene.add(terraceA, terraceB);

    /** A flight of steps climbing south, built as the stack of boxes it is. */
    function flight(width, count, rise, tread, zFront, yBase, tile = 2.0) {
        const parts = [];
        for (let i = 0; i < count; i++) {
            const h = (i + 1) * rise;
            const g = stoneBox(width, h, tread, tile);
            g.translate(0, yBase + h / 2, zFront - tread / 2 - i * tread);
            parts.push(g);
        }
        const m = new THREE.Mesh(weld(parts), stoneMat);
        m.castShadow = true;
        m.receiveShadow = true;
        return m;
    }

    const stairA = flight(26, 10, 0.30, 0.80, TA.base, 0);
    const stairB = flight(22, 10, 0.30, 0.80, TB.base, TA.y1);
    scene.add(stairA, stairB);

    // Cheek walls either side of each flight, and the long stepped wing walls
    // that run out east and west along the foot of the mound.
    {
        const parts = [];
        for (const [half, zF, y0, h] of [[13.4, TA.base, 0, 3.0], [11.4, TB.base, TA.y1, 3.0]]) {
            for (const side of [-1, 1]) {
                const wall = stoneBox(1.6, h + 0.9, 8.6, 2.2);
                wall.translate(side * half, y0 + (h + 0.9) / 2, zF - 4.3);
                parts.push(wall);
                const plinth = stoneBox(2.6, 1.5, 2.6, 1.5);
                plinth.translate(side * half, y0 + 0.75, zF - 0.4);
                parts.push(plinth);
            }
        }
        // Wing walls: eight panels stepping down and away, as in the photographs.
        for (const side of [-1, 1]) {
            for (let i = 0; i < 5; i++) {
                const len = 11;
                const h = 3.1 - i * 0.46;
                const x = side * (18 + len / 2 + i * len);
                const g = stoneBox(len - 0.5, h, 1.5, 2.4);
                g.translate(x, h / 2, TA.base + 0.9);
                parts.push(g);
                const cap = stoneBox(len - 0.2, 0.28, 1.9, 2.4);
                cap.translate(x, h + 0.14, TA.base + 0.9);
                parts.push(cap);
            }
        }
        const walls = new THREE.Mesh(weld(parts), stoneMat);
        walls.castShadow = true;
        walls.receiveShadow = true;
        scene.add(walls);
    }

    // Paved landings on each terrace, so the climb is stone all the way up.
    {
        const landA = paving(26, TA.top - TB.base + 0.4, 0, (TA.top + TB.base) / 2, TA.y1 + 0.03, 5);
        world.ground(landA);
        scene.add(landA);
        const landB = paving(52, TB.top - 21 + 0.4, 0, (TB.top + 21) / 2, TB.y1 + 0.03, 5);
        world.ground(landB);
        scene.add(landB);
    }

    /* ============================================================
       6 · the shrine
       ============================================================ */

    const shrine = new THREE.Group();

    const FLOOR = 7.41;       // top of the crepidoma
    const CELLA = 11;         // half width of the main block
    const COL_TOP = 17.2;
    const ENTAB_TOP = 19.9;
    const ATTIC_TOP = 23.4;
    const BAND_TOP = 24.5;
    const ROOF_BASE = 25.0;

    const stoneParts = [];

    // Crepidoma: three steps, deeper north–south than east–west so the porticoes
    // stand on their own ground.
    for (let i = 0; i < 3; i++) {
        const w = 36 - i * 2, d = 42 - i * 2, h = (FLOOR - TB.y1) / 3;
        const g = stoneBox(w, h, d, 2.2);
        g.translate(0, TB.y1 + h * (i + 0.5), 0);
        stoneParts.push(g);
    }

    // The cella: one great block. The top step of the crepidoma runs on past it
    // north and south, and that is the floor both porticoes stand on.
    stoneParts.push(stoneBox(CELLA * 2, ENTAB_TOP - FLOOR, CELLA * 2, 3.0).translate(0, (FLOOR + ENTAB_TOP) / 2, 0));

    // Entablature, wrapped round the block and out over both porticoes.
    stoneParts.push(stoneBox(24, 0.95, 32.0, 3.0).translate(0, COL_TOP + 0.475, 0));
    stoneParts.push(stoneBox(24.6, 1.15, 32.6, 3.0).translate(0, COL_TOP + 1.53, 0));
    stoneParts.push(stoneBox(25.6, 0.65, 33.6, 3.0).translate(0, ENTAB_TOP - 0.325, 0));

    // Attic storey above the cornice, then the carved band under the roof.
    stoneParts.push(stoneBox(21, ATTIC_TOP - ENTAB_TOP, 21, 3.0).translate(0, (ENTAB_TOP + ATTIC_TOP) / 2, 0));
    stoneParts.push(stoneBox(22.4, 0.5, 22.4, 2.4).translate(0, BAND_TOP + 0.25, 0));

    // Corner buttress piers — where the sculpture groups stand.
    for (const sx of [-1, 1]) {
        for (const sz of [-1, 1]) {
            stoneParts.push(stoneBox(6.4, 12.5 - TB.y1, 6.4, 2.6)
                .translate(sx * 14.6, TB.y1 + (12.5 - TB.y1) / 2, sz * 15.6));
            stoneParts.push(stoneBox(7.2, 0.5, 7.2, 2.0).translate(sx * 14.6, 12.75, sz * 15.6));
        }
    }

    const shrineStone = new THREE.Mesh(weld(stoneParts), stoneWarmMat);
    shrineStone.castShadow = true;
    shrineStone.receiveShadow = true;
    shrine.add(shrineStone);

    /* ---- the colonnade --------------------------------------------------- */

    const fluteTex = world.canvasTexture(256, 128, (g, cv) => {
        g.fillStyle = '#ded2b6';
        g.fillRect(0, 0, cv.width, cv.height);
        const n = 20, w = cv.width / n;
        for (let i = 0; i < n; i++) {
            const grad = g.createLinearGradient(i * w, 0, (i + 1) * w, 0);
            grad.addColorStop(0, 'rgba(96,88,70,0.42)');
            grad.addColorStop(0.5, 'rgba(255,250,232,0.30)');
            grad.addColorStop(1, 'rgba(96,88,70,0.42)');
            g.fillStyle = grad;
            g.fillRect(i * w, 0, w, cv.height);
        }
        for (let i = 0; i < 700; i++) {
            g.fillStyle = `rgba(120,110,88,${rr(0.02, 0.1).toFixed(3)})`;
            g.fillRect(rr(0, cv.width), rr(0, cv.height), rr(1, 5), rr(1, 4));
        }
    });
    fluteTex.wrapS = fluteTex.wrapT = THREE.RepeatWrapping;
    fluteTex.repeat.set(1, 3);

    {
        const shaftH = COL_TOP - FLOOR - 0.62;
        const col = weld([
            new THREE.CylinderGeometry(0.60, 0.74, shaftH, 16, 1, true).translate(0, shaftH / 2, 0),
            new THREE.CylinderGeometry(0.78, 0.62, 0.26, 16).translate(0, shaftH + 0.13, 0),   // echinus
            new THREE.BoxGeometry(1.8, 0.36, 1.8).translate(0, shaftH + 0.44, 0),              // abacus
        ]);
        const positions = [];
        for (const sz of [-1, 1]) {
            for (let i = 0; i < 8; i++) positions.push([-10.5 + i * 3.0, sz * 14.6]);
        }
        const colonnade = new THREE.InstancedMesh(
            col,
            new THREE.MeshStandardMaterial({ map: fluteTex, color: 0xf0e6cc, roughness: 0.9 }),
            positions.length
        );
        const m4 = new THREE.Matrix4();
        for (let i = 0; i < positions.length; i++) {
            m4.makeTranslation(positions[i][0], FLOOR, positions[i][1]);
            colonnade.setMatrixAt(i, m4);
        }
        colonnade.instanceMatrix.needsUpdate = true;
        colonnade.castShadow = true;
        colonnade.receiveShadow = true;
        shrine.add(colonnade);
    }

    /* ---- pediments ------------------------------------------------------- */

    const PED_W = 11.4, PED_H = 3.3;

    const tympanumTex = world.canvasTexture(512, 160, (g, cv) => {
        g.fillStyle = '#d9cdae';
        g.fillRect(0, 0, cv.width, cv.height);
        // A frieze of figures, carved shallow: darker where the stone is cut back,
        // pale along every top edge where the light lands.
        for (let i = 0; i < 15; i++) {
            const t = (i + 0.5) / 15;
            const x = t * cv.width;
            const room = 1 - Math.abs(t - 0.5) * 1.85;      // the gable squeezes the ends
            const h = Math.max(14, room * cv.height * 0.74);
            const y = cv.height - 12;
            g.fillStyle = 'rgba(120,110,88,0.55)';
            g.beginPath();
            g.ellipse(x, y - h * 0.5, h * 0.16, h * 0.5, rr(-0.12, 0.12), 0, Math.PI * 2);
            g.fill();
            g.beginPath();
            g.arc(x, y - h * 0.92, h * 0.13, 0, Math.PI * 2);
            g.fill();
            g.fillStyle = 'rgba(255,248,226,0.5)';
            g.beginPath();
            g.ellipse(x - h * 0.05, y - h * 0.55, h * 0.09, h * 0.42, rr(-0.12, 0.12), 0, Math.PI * 2);
            g.fill();
            // Arms, spears, a standard — whatever the eye wants to complete.
            g.strokeStyle = 'rgba(110,100,80,0.5)';
            g.lineWidth = Math.max(2, h * 0.05);
            g.beginPath();
            g.moveTo(x, y - h * 0.7);
            g.lineTo(x + rr(-0.4, 0.4) * h, y - h * rr(0.85, 1.25));
            g.stroke();
        }
        const dust = g.createLinearGradient(0, 0, 0, cv.height);
        dust.addColorStop(0, 'rgba(60,54,42,0.22)');
        dust.addColorStop(1, 'rgba(255,250,236,0.16)');
        g.fillStyle = dust;
        g.fillRect(0, 0, cv.width, cv.height);
    });

    {
        const tri = new THREE.Shape();
        tri.moveTo(-PED_W, 0);
        tri.lineTo(PED_W, 0);
        tri.lineTo(0, PED_H);
        tri.closePath();
        const pedParts = [];
        const facParts = [];
        for (const sz of [-1, 1]) {
            const g = new THREE.ExtrudeGeometry(tri, { depth: 1.3, bevelEnabled: false });
            g.translate(0, ENTAB_TOP, sz * 15.4 - (sz > 0 ? 0 : 1.3));
            pedParts.push(g);

            // The sculpture in the gable, standing a centimetre proud of the
            // pediment face — relief is carved out of the wall, not into it.
            const inner = new THREE.Shape();
            inner.moveTo(-PED_W + 1.1, 0.55);
            inner.lineTo(PED_W - 1.1, 0.55);
            inner.lineTo(0, PED_H - 0.5);
            inner.closePath();
            const f = new THREE.ShapeGeometry(inner);
            const uv = f.attributes.uv;
            for (let i = 0; i < uv.count; i++) {
                uv.setXY(i, (uv.getX(i) + PED_W) / (PED_W * 2), (uv.getY(i) - 0.4) / (PED_H - 0.6));
            }
            uv.needsUpdate = true;
            if (sz < 0) f.rotateY(Math.PI);
            f.translate(0, ENTAB_TOP, sz * 15.4 + sz * 1.32);
            facParts.push(f);
        }
        const peds = new THREE.Mesh(weld(pedParts), stoneWarmMat);
        peds.castShadow = true;
        peds.receiveShadow = true;
        shrine.add(peds);

        const faces = new THREE.Mesh(weld(facParts), new THREE.MeshStandardMaterial({
            map: tympanumTex, color: 0xf0e4c6, roughness: 0.95, side: THREE.DoubleSide,
        }));
        faces.receiveShadow = true;
        shrine.add(faces);
    }

    /* ---- the carved band, and the bronze doors --------------------------- */

    {
        const bandTex = world.canvasTexture(512, 96, (g, cv) => {
            g.fillStyle = '#d6caa8';
            g.fillRect(0, 0, cv.width, cv.height);
            // A procession: horses, standards, and the long line of them.
            for (let i = 0; i < 34; i++) {
                const x = (i / 34) * cv.width + rr(-4, 4);
                g.fillStyle = 'rgba(118,108,84,0.5)';
                g.fillRect(x, 26, 7, 52);
                g.beginPath(); g.arc(x + 3, 22, 6, 0, Math.PI * 2); g.fill();
                g.fillStyle = 'rgba(255,248,224,0.36)';
                g.fillRect(x - 2, 26, 3, 52);
                if (i % 4 === 0) {
                    g.strokeStyle = 'rgba(110,100,78,0.45)';
                    g.lineWidth = 3;
                    g.beginPath(); g.moveTo(x + 3, 24); g.lineTo(x + 10, 4); g.stroke();
                }
            }
            g.fillStyle = 'rgba(70,64,48,0.16)';
            g.fillRect(0, 0, cv.width, 8);
        });
        bandTex.wrapS = bandTex.wrapT = THREE.RepeatWrapping;
        const band = new THREE.Mesh(
            new THREE.BoxGeometry(21.6, BAND_TOP - ATTIC_TOP - 0.1, 21.6),
            new THREE.MeshStandardMaterial({ map: bandTex, color: 0xeadfbe, roughness: 0.95 })
        );
        band.position.y = (ATTIC_TOP + BAND_TOP) / 2;
        band.castShadow = true;
        band.receiveShadow = true;
        shrine.add(band);

        // Doors: a dark recess at the head of each portico. Bronze, shut.
        const doorMat = new THREE.MeshStandardMaterial({ color: 0x2a2f28, roughness: 0.5, metalness: 0.7 });
        const doors = new THREE.Mesh(weld([
            new THREE.BoxGeometry(6.2, 8.4, 0.5).translate(0, FLOOR + 4.2, CELLA - 0.1),
            new THREE.BoxGeometry(6.2, 8.4, 0.5).translate(0, FLOOR + 4.2, -CELLA + 0.1),
        ]), doorMat);
        doors.castShadow = true;
        shrine.add(doors);
    }

    /* ---- the stepped roof ------------------------------------------------ */

    {
        const parts = [];
        let half = 10.4, y = ROOF_BASE;
        for (let i = 0; i < 9; i++) {
            const h = 0.82;
            parts.push(stoneBox(half * 2, h, half * 2, 1.6).translate(0, y + h / 2, 0));
            y += h;
            half -= 0.9;
        }
        const roof = new THREE.Mesh(weld(parts), slateMat);
        roof.castShadow = true;
        roof.receiveShadow = true;
        shrine.add(roof);

        const lantern = new THREE.Mesh(weld([
            stoneBox(4.4, 1.1, 4.4, 1.4).translate(0, y + 0.55, 0),
            new THREE.ConeGeometry(3.1, 1.2, 4).rotateY(Math.PI / 4).translate(0, y + 1.7, 0),
        ]), stoneWarmMat);
        lantern.castShadow = true;
        shrine.add(lantern);

        const finial = new THREE.Mesh(weld([
            new THREE.CylinderGeometry(0.10, 0.14, 1.5, 8).translate(0, y + 3.05, 0),
            new THREE.SphereGeometry(0.34, 12, 9).translate(0, y + 2.2, 0),
        ]), goldMat);
        finial.castShadow = true;
        shrine.add(finial);
    }

    /* ---- sculpture groups on the buttresses ------------------------------ */

    function figureGeo(h, lean) {
        const w = h / 1.7;
        return weld([
            new THREE.CylinderGeometry(0.20 * w, 0.34 * w, 0.66 * h, 9).translate(0, 0.40 * h, 0),
            new THREE.SphereGeometry(0.105 * w, 9, 7).translate(0, 0.86 * h, 0.02 * h),
            new THREE.BoxGeometry(0.52 * w, 0.13 * h, 0.20 * w).rotateZ(lean).translate(0, 0.66 * h, 0.07 * h),
        ]);
    }
    {
        const parts = [];
        for (const sx of [-1, 1]) {
            for (const sz of [-1, 1]) {
                for (let i = 0; i < 2; i++) {
                    const g = figureGeo(2.3 + rr(-0.15, 0.2), rr(-0.5, 0.5));
                    g.rotateY(rr(0, Math.PI * 2));
                    g.translate(sx * 14.6 + rr(-1.1, 1.1), 13.0, sz * 15.6 + rr(-1.1, 1.1));
                    parts.push(g);
                }
            }
        }
        const statues = new THREE.Mesh(weld(parts), stoneWarmMat);
        statues.castShadow = true;
        shrine.add(statues);
    }

    world.part('shrine_00', shrine);
    scene.add(shrine);

    /* ============================================================
       7 · what stands on the plaza
       ============================================================ */

    // Timber, for the one thing out here that is not stone or bronze.
    const timberTex = world.canvasTexture(256, 64, (g, cv) => {
        g.fillStyle = '#6b4426';
        g.fillRect(0, 0, cv.width, cv.height);
        for (let i = 0; i < 120; i++) {
            const y = rr(0, cv.height);
            g.strokeStyle = `rgba(${(40 + rr(0, 60)) | 0},${(24 + rr(0, 34)) | 0},10,${rr(0.05, 0.2).toFixed(3)})`;
            g.lineWidth = rr(0.5, 2.2);
            g.beginPath();
            g.moveTo(0, y);
            for (let x = 0; x <= cv.width; x += 16) g.lineTo(x, y + Math.sin(x * 0.05 + i) * 1.6);
            g.stroke();
        }
        const bleach = g.createLinearGradient(0, 0, 0, cv.height);
        bleach.addColorStop(0, 'rgba(214,178,132,0.30)');
        bleach.addColorStop(1, 'rgba(30,16,6,0.18)');
        g.fillStyle = bleach;
        g.fillRect(0, 0, cv.width, cv.height);
    });
    timberTex.wrapS = timberTex.wrapT = THREE.RepeatWrapping;
    timberTex.repeat.set(2, 1);

    const timberMat = new THREE.MeshStandardMaterial({ map: timberTex, roughness: 0.86 });
    const ironMat = new THREE.MeshStandardMaterial({ color: 0x243a2c, roughness: 0.55, metalness: 0.62 });

    /** A park bench: seven slats on two cast ends. */
    function makeBench() {
        const group = new THREE.Group();
        const LEN = 1.82, SEAT = 0.45, SW = 0.072, ST = 0.026;

        const slatParts = [];
        for (let i = 0; i < 4; i++) {
            slatParts.push(new THREE.BoxGeometry(LEN, ST, SW).translate(0, SEAT - i * 0.006, -0.16 + i * 0.108));
        }
        for (let i = 0; i < 3; i++) {
            const h = 0.60 + i * 0.135;
            slatParts.push(new THREE.BoxGeometry(LEN, ST, SW).rotateX(-0.21)
                .translate(0, SEAT + h - 0.32, -0.20 - (h - 0.28) * 0.21));
        }
        const slats = new THREE.Mesh(weld(slatParts), timberMat);
        slats.castShadow = true;
        slats.receiveShadow = true;
        group.add(slats);

        const endParts = [];
        for (const side of [-1, 1]) {
            const x = side * (LEN / 2 - 0.12);
            endParts.push(new THREE.BoxGeometry(0.05, SEAT + 0.02, 0.075).rotateX(0.10).translate(x, (SEAT + 0.02) / 2, 0.11));
            endParts.push(new THREE.BoxGeometry(0.05, 0.94, 0.075).rotateX(-0.16).translate(x, 0.47, -0.20));
            endParts.push(new THREE.BoxGeometry(0.045, 0.05, 0.42).translate(x, 0.66, -0.02));
            endParts.push(new THREE.TorusGeometry(0.055, 0.021, 6, 12, Math.PI * 1.5).rotateY(Math.PI / 2).translate(x, 0.62, 0.18));
            endParts.push(new THREE.BoxGeometry(0.09, 0.022, 0.30).translate(x, 0.011, -0.03));
            endParts.push(new THREE.BoxGeometry(0.038, 0.038, 0.34).translate(x, 0.20, -0.045));
        }
        endParts.push(new THREE.BoxGeometry(LEN - 0.20, 0.05, 0.045).translate(0, 0.235, -0.045));
        const ends = new THREE.Mesh(weld(endParts), ironMat);
        ends.castShadow = true;
        ends.receiveShadow = true;
        group.add(ends);
        return group;
    }

    /** A ceremonial flagpole: stone plinth, tapered mast, gold truck. */
    function makeFlagpole() {
        const group = new THREE.Group();
        const H = 9.0, BASE = 0.77;

        const plinth = new THREE.Mesh(weld([
            stoneBox(1.10, 0.16, 1.10, 1.2).translate(0, 0.08, 0),
            stoneBox(0.94, 0.52, 0.94, 1.2).translate(0, 0.42, 0),
            stoneBox(1.04, 0.09, 1.04, 1.0).translate(0, 0.725, 0),
        ]), stoneMat);
        plinth.castShadow = true;
        plinth.receiveShadow = true;
        group.add(plinth);

        const mast = new THREE.Mesh(
            new THREE.CylinderGeometry(0.052, 0.098, H - BASE, 12).translate(0, BASE + (H - BASE) / 2, 0),
            new THREE.MeshStandardMaterial({ color: 0xf2f0e8, roughness: 0.4, metalness: 0.25 })
        );
        mast.castShadow = true;
        group.add(mast);

        const fittings = new THREE.Mesh(weld([
            new THREE.CylinderGeometry(0.14, 0.16, 0.12, 12).translate(0, BASE + 0.05, 0),
            new THREE.SphereGeometry(0.11, 12, 8).translate(0, H + 0.06, 0),
            new THREE.CylinderGeometry(0.062, 0.062, 0.05, 10).translate(0, H - 0.01, 0),
            new THREE.BoxGeometry(0.16, 0.028, 0.028).translate(0, 1.35, 0.10),
        ]), goldMat);
        fittings.castShadow = true;
        group.add(fittings);
        return group;
    }

    /** A memorial urn on its plinth, the pair of them either side of a flight. */
    function makeUrn() {
        const group = new THREE.Group();

        const plinth = new THREE.Mesh(weld([
            stoneBox(0.96, 0.14, 0.96, 1.0).translate(0, 0.07, 0),
            stoneBox(0.80, 0.86, 0.80, 1.0).translate(0, 0.57, 0),
            stoneBox(0.92, 0.10, 0.92, 0.9).translate(0, 1.05, 0),
        ]), stoneMat);
        plinth.castShadow = true;
        plinth.receiveShadow = true;
        group.add(plinth);

        const profile = [];
        for (let i = 0; i <= 14; i++) {
            const t = i / 14;
            profile.push(new THREE.Vector2(Math.max(0.07, 0.11 + Math.sin(t * 2.55 + 0.30) * 0.26), t * 0.46));
        }
        profile.push(new THREE.Vector2(0.40, 0.50));
        profile.push(new THREE.Vector2(0.355, 0.53));
        const bowl = new THREE.Mesh(new THREE.LatheGeometry(profile, 20), bronzeMat);
        bowl.position.y = 1.28;
        bowl.castShadow = true;
        bowl.receiveShadow = true;
        group.add(bowl);

        const legs = [];
        for (let i = 0; i < 3; i++) {
            const a = (i / 3) * Math.PI * 2 + 0.4;
            legs.push(new THREE.CylinderGeometry(0.028, 0.038, 0.30, 7)
                .rotateX(0.16 * Math.cos(a)).rotateZ(-0.16 * Math.sin(a))
                .translate(Math.cos(a) * 0.13, 1.16, Math.sin(a) * 0.13));
        }
        legs.push(new THREE.CylinderGeometry(0.22, 0.26, 0.06, 14).translate(0, 1.13, 0));
        legs.push(new THREE.TorusGeometry(0.385, 0.022, 6, 20).rotateX(Math.PI / 2).translate(0, 1.79, 0));
        const fittings = new THREE.Mesh(weld(legs), bronzeMat);
        fittings.castShadow = true;
        group.add(fittings);
        return group;
    }

    /** A cast-iron park lamp. The glass is emissive; bloom does the rest. */
    const lampGlassTex = world.canvasTexture(64, 64, (g, cv) => {
        const rad = g.createRadialGradient(cv.width / 2, cv.height * 0.62, 2, cv.width / 2, cv.height / 2, cv.width * 0.7);
        rad.addColorStop(0, '#fff6de');
        rad.addColorStop(0.5, '#ffd792');
        rad.addColorStop(1, '#e8a648');
        g.fillStyle = rad;
        g.fillRect(0, 0, cv.width, cv.height);
    });
    const lampGlassMat = new THREE.MeshStandardMaterial({
        color: 0xffe6b4, map: lampGlassTex, emissive: 0xffcf82, emissiveMap: lampGlassTex,
        emissiveIntensity: 1.9, roughness: 0.3, transparent: true, opacity: 0.92,
    });

    function makeLamp() {
        const group = new THREE.Group();
        const TOP = 2.62, LY = TOP + 0.20;

        const parts = [
            new THREE.CylinderGeometry(0.30, 0.34, 0.10, 12).translate(0, 0.05, 0),
            new THREE.CylinderGeometry(0.23, 0.29, 0.16, 12).translate(0, 0.18, 0),
            new THREE.CylinderGeometry(0.15, 0.21, 0.22, 12).translate(0, 0.37, 0),
            new THREE.CylinderGeometry(0.062, 0.088, TOP - 0.48, 10).translate(0, 0.48 + (TOP - 0.48) / 2, 0),
            new THREE.CylinderGeometry(0.098, 0.098, 0.06, 10).translate(0, 1.74, 0),
            new THREE.CylinderGeometry(0.16, 0.075, 0.20, 10).translate(0, TOP + 0.09, 0),
            new THREE.BoxGeometry(0.34, 0.035, 0.34).translate(0, LY, 0),
            new THREE.BoxGeometry(0.32, 0.035, 0.32).translate(0, LY + 0.62, 0),
            new THREE.ConeGeometry(0.27, 0.26, 4).rotateY(Math.PI / 4).translate(0, LY + 0.76, 0),
            new THREE.SphereGeometry(0.045, 8, 6).translate(0, LY + 0.92, 0),
        ];
        for (let i = 0; i < 4; i++) {
            const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
            parts.push(new THREE.BoxGeometry(0.028, 0.62, 0.028)
                .translate(Math.cos(a) * 0.155, LY + 0.31, Math.sin(a) * 0.155));
        }
        const iron = new THREE.Mesh(weld(parts), ironMat);
        iron.castShadow = true;
        iron.receiveShadow = true;
        group.add(iron);

        const glass = new THREE.Mesh(new THREE.BoxGeometry(0.235, 0.56, 0.235), lampGlassMat);
        glass.position.y = LY + 0.31;
        glass.rotation.y = Math.PI / 4;
        group.add(glass);
        return group;
    }

    /** A wreath, laid flat where somebody left it. */
    const poppyMat = new THREE.MeshStandardMaterial({ color: 0xb5121b, roughness: 0.82, side: THREE.DoubleSide });
    const wreathMat = new THREE.MeshStandardMaterial({ color: 0x3c5c33, roughness: 0.95 });

    function makeWreath() {
        const group = new THREE.Group();
        const R = 0.30, N = 24;

        const ring = new THREE.Mesh(new THREE.TorusGeometry(R, 0.062, 8, 24).rotateX(-Math.PI / 2).translate(0, 0.062, 0), wreathMat);
        ring.castShadow = true;
        ring.receiveShadow = true;
        group.add(ring);

        const petals = new THREE.InstancedMesh(new THREE.CircleGeometry(0.036, 7), poppyMat, N);
        const m4 = new THREE.Matrix4();
        const q = new THREE.Quaternion();
        const e = new THREE.Euler();
        const p = new THREE.Vector3();
        const s = new THREE.Vector3();
        for (let i = 0; i < N; i++) {
            const a = (i / N) * Math.PI * 2 + rr(-0.06, 0.06);
            const rad = R + rr(-0.035, 0.035);
            p.set(Math.cos(a) * rad, 0.09 + rr(0, 0.05), Math.sin(a) * rad);
            e.set(-Math.PI / 2 + rr(-0.7, 0.7), 0, -a + rr(-0.3, 0.3), 'XYZ');
            q.setFromEuler(e);
            const k = rr(0.82, 1.2);
            s.set(k, k, k);
            m4.compose(p, q, s);
            petals.setMatrixAt(i, m4);
        }
        petals.instanceMatrix.needsUpdate = true;
        petals.castShadow = true;
        group.add(petals);
        return group;
    }

    /* ---- flags ----------------------------------------------------------- */

    function flagTexture(kind) {
        return world.canvasTexture(256, 128, (g, cv) => {
            const W = cv.width, H = cv.height;
            if (kind === 'aboriginal') {
                g.fillStyle = '#000000'; g.fillRect(0, 0, W, H / 2);
                g.fillStyle = '#c8102e'; g.fillRect(0, H / 2, W, H / 2);
                g.fillStyle = '#ffcd00';
                g.beginPath(); g.arc(W / 2, H / 2, H * 0.22, 0, Math.PI * 2); g.fill();
                return;
            }
            if (kind === 'torres') {
                g.fillStyle = '#00843d'; g.fillRect(0, 0, W, H);
                g.fillStyle = '#0057b8'; g.fillRect(0, H * 0.16, W, H * 0.68);
                g.fillStyle = '#ffffff'; g.fillRect(0, H * 0.13, W, H * 0.035);
                g.fillRect(0, H * 0.835, W, H * 0.035);
                g.fillStyle = '#ffffff';
                g.beginPath();
                g.ellipse(W / 2, H * 0.46, H * 0.20, H * 0.13, 0, Math.PI, 0);
                g.fill();
                g.fillRect(W / 2 - H * 0.02, H * 0.30, H * 0.04, H * 0.16);
                g.beginPath();
                for (let i = 0; i < 5; i++) {
                    const a = -Math.PI / 2 + (i / 5) * Math.PI * 2;
                    const r = H * 0.13;
                    g.lineTo(W / 2 + Math.cos(a) * r, H * 0.62 + Math.sin(a) * r);
                    const b = a + Math.PI / 5;
                    g.lineTo(W / 2 + Math.cos(b) * r * 0.4, H * 0.62 + Math.sin(b) * r * 0.4);
                }
                g.closePath();
                g.fill();
                return;
            }
            // Australian: navy, a canton, the Commonwealth Star, the Cross.
            g.fillStyle = '#00247d'; g.fillRect(0, 0, W, H);
            const cw = W / 2, ch = H / 2;
            g.fillStyle = '#00247d'; g.fillRect(0, 0, cw, ch);
            g.strokeStyle = '#ffffff'; g.lineWidth = H * 0.10;
            g.beginPath(); g.moveTo(0, 0); g.lineTo(cw, ch); g.moveTo(cw, 0); g.lineTo(0, ch); g.stroke();
            g.strokeStyle = '#cf142b'; g.lineWidth = H * 0.05;
            g.beginPath(); g.moveTo(0, 0); g.lineTo(cw, ch); g.moveTo(cw, 0); g.lineTo(0, ch); g.stroke();
            g.strokeStyle = '#ffffff'; g.lineWidth = H * 0.155;
            g.beginPath(); g.moveTo(cw / 2, 0); g.lineTo(cw / 2, ch); g.moveTo(0, ch / 2); g.lineTo(cw, ch / 2); g.stroke();
            g.strokeStyle = '#cf142b'; g.lineWidth = H * 0.095;
            g.beginPath(); g.moveTo(cw / 2, 0); g.lineTo(cw / 2, ch); g.moveTo(0, ch / 2); g.lineTo(cw, ch / 2); g.stroke();
            const star = (x, y, r) => {
                g.fillStyle = '#ffffff';
                g.beginPath();
                for (let i = 0; i < 7; i++) {
                    const a = -Math.PI / 2 + (i / 7) * Math.PI * 2;
                    g.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
                    const b = a + Math.PI / 7;
                    g.lineTo(x + Math.cos(b) * r * 0.45, y + Math.sin(b) * r * 0.45);
                }
                g.closePath();
                g.fill();
            };
            star(cw / 2, ch + (H - ch) / 2, H * 0.115);
            star(W * 0.74, H * 0.24, H * 0.062);
            star(W * 0.83, H * 0.50, H * 0.075);
            star(W * 0.74, H * 0.79, H * 0.062);
            star(W * 0.64, H * 0.60, H * 0.052);
            star(W * 0.775, H * 0.62, H * 0.032);
        });
    }

    const flagMat = (tex) => new THREE.ShaderMaterial({
        side: THREE.DoubleSide,
        uniforms: { uMap: { value: tex }, uTime: uFlagTime },
        vertexShader: /* glsl */`
            uniform float uTime;
            varying vec2 vUv;
            varying float vFold;
            void main() {
                vUv = uv;
                vec3 p = position;
                float grip = smoothstep(0.0, 0.30, uv.x);      // pinned at the hoist
                float w = sin(uv.x * 8.5 - uTime * 4.6) * 0.17
                        + sin(uv.x * 4.2 + uv.y * 3.1 - uTime * 2.9) * 0.10;
                p.z += w * grip;
                p.y += sin(uv.x * 3.6 - uTime * 3.7) * 0.045 * grip;
                vFold = cos(uv.x * 8.5 - uTime * 4.6) * grip;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
            }`,
        fragmentShader: /* glsl */`
            uniform sampler2D uMap;
            varying vec2 vUv;
            varying float vFold;
            void main() {
                vec3 c = texture2D(uMap, vUv).rgb;
                c *= 0.80 + 0.34 * (0.5 + 0.5 * vFold);
                gl_FragColor = vec4(c, 1.0);
            }`,
    });

    {
        const kinds = ['australian', 'aboriginal', 'torres'];
        for (let i = 0; i < 3; i++) {
            const pole = makeFlagpole();
            pole.position.set(30 + i * 9, 0, 108 - i * 2);
            world.part(`flagpole_0${i}`, pole);
            scene.add(pole);

            const cloth = new THREE.Mesh(
                new THREE.PlaneGeometry(2.6, 1.3, 14, 5).translate(1.3, 0, 0),
                flagMat(flagTexture(kinds[i]))
            );
            cloth.position.set(0.06, 7.6, 0);
            cloth.rotation.y = -0.5;
            world.ghost(cloth);
            pole.add(cloth);
        }
    }

    /* ---- the cenotaph pillar --------------------------------------------- */

    {
        const cenotaph = new THREE.Group();
        const base = new THREE.Mesh(weld([
            stoneBox(6.4, 0.5, 6.4, 2.0).translate(0, 0.25, 0),
            stoneBox(5.2, 0.9, 5.2, 2.0).translate(0, 0.95, 0),
            stoneBox(4.0, 0.6, 4.0, 1.6).translate(0, 1.7, 0),
        ]), stoneMat);
        base.castShadow = true;
        base.receiveShadow = true;
        cenotaph.add(base);

        const shaft = new THREE.Mesh(
            stoneBox(3.0, 11.5, 3.0, 2.6),
            new THREE.MeshStandardMaterial({ map: stoneTex, color: 0x9a8f7a, roughness: 0.9 })
        );
        shaft.position.y = 2.0 + 11.5 / 2;
        shaft.castShadow = true;
        shaft.receiveShadow = true;
        cenotaph.add(shaft);

        // Six bearers round the top, in bronze, carrying what they carry.
        const bearers = [];
        for (let i = 0; i < 6; i++) {
            const a = (i / 6) * Math.PI * 2;
            const g = figureGeo(2.0, rr(-0.3, 0.3));
            g.rotateY(-a);
            g.translate(Math.cos(a) * 1.35, 13.7, Math.sin(a) * 1.35);
            bearers.push(g);
        }
        bearers.push(new THREE.BoxGeometry(3.6, 0.35, 3.6).translate(0, 13.65, 0));
        const group = new THREE.Mesh(weld(bearers), bronzeMat);
        group.castShadow = true;
        cenotaph.add(group);

        cenotaph.position.set(-40, 0, 104);
        world.part('cenotaph_00', cenotaph);
        scene.add(cenotaph);
    }

    /* ---- the eternal flame ----------------------------------------------- */

    const flameUniforms = { uTime: { value: 0 } };
    let flameMesh = null;
    let flameLight = null;
    {
        const flame = new THREE.Group();
        const plinth = new THREE.Mesh(weld([
            stoneBox(3.6, 0.4, 3.6, 1.6).translate(0, 0.2, 0),
            stoneBox(2.6, 1.0, 2.6, 1.6).translate(0, 0.9, 0),
            stoneBox(3.0, 0.28, 3.0, 1.2).translate(0, 1.54, 0),
        ]), stoneMat);
        plinth.castShadow = true;
        plinth.receiveShadow = true;
        flame.add(plinth);

        const bowlProfile = [];
        for (let i = 0; i <= 12; i++) {
            const t = i / 12;
            bowlProfile.push(new THREE.Vector2(Math.max(0.18, 0.34 + Math.sin(t * 2.4 + 0.45) * 0.62), t * 0.9));
        }
        const bowl = new THREE.Mesh(new THREE.LatheGeometry(bowlProfile, 22), bronzeMat);
        bowl.position.y = 1.68;
        bowl.castShadow = true;
        bowl.receiveShadow = true;
        flame.add(bowl);

        flameMesh = new THREE.Mesh(
            new THREE.ConeGeometry(0.42, 1.5, 12, 4, true),
            new THREE.ShaderMaterial({
                transparent: true, depthWrite: false, side: THREE.DoubleSide,
                blending: THREE.AdditiveBlending, uniforms: flameUniforms,
                vertexShader: /* glsl */`
                    uniform float uTime;
                    varying float vH;
                    void main() {
                        vH = clamp(position.y / 0.75 + 0.5, 0.0, 1.0);
                        vec3 p = position;
                        float lick = vH * vH;
                        p.x += sin(uTime * 7.3 + position.y * 5.0) * 0.13 * lick;
                        p.z += cos(uTime * 5.9 + position.y * 4.2) * 0.11 * lick;
                        p.y += sin(uTime * 9.1) * 0.06 * lick;
                        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
                    }`,
                fragmentShader: /* glsl */`
                    varying float vH;
                    void main() {
                        vec3 hot = vec3(3.2, 2.3, 0.9);
                        vec3 tip = vec3(1.5, 0.45, 0.08);
                        vec3 c = mix(hot, tip, vH);
                        float a = (1.0 - vH) * 0.85;
                        gl_FragColor = vec4(c, a);
                    }`,
            })
        );
        flameMesh.position.y = 3.0;
        world.ghost(flameMesh);
        flame.add(flameMesh);

        // The one point light this world spends: it is the only thing here that
        // genuinely throws light onto stone, so it gets to be real.
        flameLight = new THREE.PointLight(0xffb35c, 22, 34, 2);
        flameLight.position.set(0, 3.4, 0);
        flame.add(flameLight);

        flame.position.set(-40, 0, 132);
        world.part('flame_00', flame);
        scene.add(flame);
    }

    /* ---- urns, benches, lamps, wreaths ----------------------------------- */

    {
        let n = 0;
        for (const [x, z, y] of [[-13.4, 65.4, 1.5], [13.4, 65.4, 1.5], [-11.4, 45.4, 4.5], [11.4, 45.4, 4.5]]) {
            const urn = makeUrn();
            urn.position.set(x, y, z);
            world.part(`urn_0${n}`, urn);
            scene.add(urn);
            n++;
        }
    }

    {
        const spots = [
            [-52, 96, Math.PI * 0.06], [52, 132, -Math.PI * 0.5],
            [-30, 176, Math.PI * 0.5], [30, 176, -Math.PI * 0.5],
        ];
        for (let i = 0; i < spots.length; i++) {
            const bench = makeBench();
            bench.position.set(spots[i][0], 0.06, spots[i][1]);
            bench.rotation.y = spots[i][2];
            world.part(`bench_0${i}`, bench);
            scene.add(bench);
        }
    }

    {
        const spots = [[-46, 152], [46, 152], [-46, 248]];
        for (let i = 0; i < spots.length; i++) {
            const lamp = makeLamp();
            lamp.position.set(spots[i][0], 0.06, spots[i][1]);
            world.part(`lamp_0${i}`, lamp);
            scene.add(lamp);
        }
    }

    {
        const spots = [[-2.4, 6.06, 22.8, 0.2], [2.6, 0.07, 67.4, -0.5]];
        for (let i = 0; i < spots.length; i++) {
            const wreath = makeWreath();
            wreath.position.set(spots[i][0], spots[i][1], spots[i][2]);
            wreath.rotation.y = spots[i][3];
            world.part(`wreath_0${i}`, wreath);
            scene.add(wreath);
        }
    }

    /* ============================================================
       8 · the park: elms, pencil pines, hedges, grass
       ============================================================ */

    /** Wind, injected into a standard material so it keeps its shadows. */
    function windy(material, key, amp) {
        const a = amp.toFixed(4);
        material.onBeforeCompile = (shader) => {
            shader.uniforms.uWind = uWind;
            shader.vertexShader = 'uniform float uWind;\n' + shader.vertexShader.replace(
                '#include <begin_vertex>',
                /* glsl */`
                #include <begin_vertex>
                float wPhase = 0.0;
                #ifdef USE_INSTANCING
                    wPhase = instanceMatrix[3].x * 0.21 + instanceMatrix[3].z * 0.13;
                #endif
                float wH = max(transformed.y, 0.0);
                transformed.x += sin(uWind * 1.15 + wPhase) * ${a} * wH;
                transformed.z += cos(uWind * 0.93 + wPhase * 1.7) * ${a} * 0.82 * wH;
                `
            );
        };
        material.customProgramCacheKey = () => key;
        return material;
    }

    const leafTex = world.canvasTexture(128, 128, (g, cv) => {
        g.fillStyle = '#2e4a24';
        g.fillRect(0, 0, cv.width, cv.height);
        for (let i = 0; i < 420; i++) {
            const v = rr(0.2, 1);
            g.save();
            g.translate(rr(0, cv.width), rr(0, cv.height));
            g.rotate(rr(0, Math.PI * 2));
            g.fillStyle = `rgba(${(40 + v * 74) | 0},${(76 + v * 88) | 0},${(30 + v * 50) | 0},0.85)`;
            g.beginPath();
            g.ellipse(0, 0, rr(3, 10), rr(1.5, 4), 0, 0, Math.PI * 2);
            g.fill();
            g.restore();
        }
    });
    leafTex.wrapS = leafTex.wrapT = THREE.RepeatWrapping;
    leafTex.repeat.set(3, 3);

    // A canopy: five lumps of icosahedron, welded, so no two trees read as the
    // same tree once they are rotated.
    function canopyGeo(r) {
        const parts = [];
        for (let i = 0; i < 5; i++) {
            const a = (i / 5) * Math.PI * 2 + rr(-0.4, 0.4);
            const rad = r * rr(0.5, 0.78);
            const g = new THREE.IcosahedronGeometry(rad, 1);
            g.scale(1, rr(0.62, 0.86), 1);
            g.translate(Math.cos(a) * r * rr(0.25, 0.5), r * rr(0.55, 0.95), Math.sin(a) * r * rr(0.25, 0.5));
            parts.push(g);
        }
        return weld(parts);
    }

    {
        // Elms and Moreton Bay figs, keeping to the edges of the lawn the way the
        // park does — nothing on the axis, nothing on the mound.
        const spots = [];
        for (let i = 0; i < 34; i++) {
            const a = rr(0, Math.PI * 2);
            const rad = rr(120, 330);
            const x = Math.cos(a) * rad * 1.25;
            const z = Math.sin(a) * rad + 90;
            if (Math.abs(x) < 60 && z > 40 && z < 520) continue;
            spots.push([x, z]);
        }
        const canopy = new THREE.InstancedMesh(
            canopyGeo(6.4),
            windy(new THREE.MeshStandardMaterial({
                map: leafTex, color: 0xcfe0b4, roughness: 0.95, metalness: 0.0,
            }), 'windy-canopy', 0.018),
            spots.length
        );
        const trunks = new THREE.InstancedMesh(
            new THREE.CylinderGeometry(0.42, 0.85, 6.2, 8).translate(0, 3.1, 0),
            new THREE.MeshStandardMaterial({ color: 0x5b4c3c, roughness: 0.98 }),
            spots.length
        );
        const m4 = new THREE.Matrix4();
        const q = new THREE.Quaternion();
        const e = new THREE.Euler();
        const p = new THREE.Vector3();
        const s = new THREE.Vector3();
        const tint = new THREE.Color();
        for (let i = 0; i < spots.length; i++) {
            const x = spots[i][0], z = spots[i][1];
            const y = terrainY(x, z);
            const scale = rr(0.8, 1.45);
            e.set(0, rr(0, Math.PI * 2), 0);
            q.setFromEuler(e);
            p.set(x, y - 0.4, z);
            s.set(scale, scale * rr(0.9, 1.2), scale);
            m4.compose(p, q, s);
            canopy.setMatrixAt(i, m4);
            trunks.setMatrixAt(i, m4);
            tint.setRGB(rr(0.72, 1.06), rr(0.84, 1.06), rr(0.66, 0.96));
            canopy.setColorAt(i, tint);
        }
        canopy.instanceMatrix.needsUpdate = true;
        trunks.instanceMatrix.needsUpdate = true;
        if (canopy.instanceColor) canopy.instanceColor.needsUpdate = true;
        canopy.castShadow = true;
        canopy.receiveShadow = true;
        trunks.castShadow = true;
        scene.add(canopy, trunks);
    }

    {
        // Pencil pines down the avenue: the dark punctuation in the long view
        // towards the city.
        const spots = [];
        for (let i = 0; i < 11; i++) {
            spots.push([-23, 268 + i * 23]);
            spots.push([23, 268 + i * 23]);
        }
        const pineGeo = weld([
            new THREE.ConeGeometry(2.1, 11.5, 9, 3).translate(0, 6.6, 0),
            new THREE.ConeGeometry(2.6, 5.0, 9, 2).translate(0, 3.4, 0),
            new THREE.CylinderGeometry(0.24, 0.4, 1.6, 6).translate(0, 0.8, 0),
        ]);
        const pines = new THREE.InstancedMesh(
            pineGeo,
            windy(new THREE.MeshStandardMaterial({
                map: leafTex, color: 0x6d8a58, roughness: 0.97,
            }), 'windy-pine', 0.009),
            spots.length
        );
        const m4 = new THREE.Matrix4();
        const q = new THREE.Quaternion();
        const e = new THREE.Euler();
        const p = new THREE.Vector3();
        const s = new THREE.Vector3();
        const tint = new THREE.Color();
        for (let i = 0; i < spots.length; i++) {
            e.set(0, rr(0, Math.PI * 2), 0);
            q.setFromEuler(e);
            p.set(spots[i][0] + rr(-1.2, 1.2), 0, spots[i][1] + rr(-1.5, 1.5));
            const k = rr(0.82, 1.22);
            s.set(k * rr(0.85, 1.05), k, k * rr(0.85, 1.05));
            m4.compose(p, q, s);
            pines.setMatrixAt(i, m4);
            tint.setRGB(rr(0.7, 1.05), rr(0.8, 1.05), rr(0.68, 0.95));
            pines.setColorAt(i, tint);
        }
        pines.instanceMatrix.needsUpdate = true;
        if (pines.instanceColor) pines.instanceColor.needsUpdate = true;
        pines.castShadow = true;
        scene.add(pines);
    }

    {
        // Clipped hedges holding the edge of the forecourt.
        const parts = [];
        for (const sx of [-1, 1]) {
            for (let i = 0; i < 5; i++) {
                const g = new THREE.BoxGeometry(2.0, 1.25, 17);
                g.translate(sx * 39, 0.62, 162 + i * 19);
                parts.push(g);
            }
        }
        const hedge = new THREE.Mesh(weld(parts), new THREE.MeshStandardMaterial({
            map: leafTex, color: 0x9ab77e, roughness: 0.98,
        }));
        hedge.castShadow = true;
        hedge.receiveShadow = true;
        scene.add(hedge);
    }

    {
        // Tufts, only where anyone stands close enough to see them, and ghosted:
        // eight hundred blades of collision nobody would ever feel.
        const tuftTex = world.canvasTexture(64, 64, (g, cv) => {
            g.clearRect(0, 0, cv.width, cv.height);
            for (let i = 0; i < 26; i++) {
                const x = rr(6, cv.width - 6);
                g.strokeStyle = `rgba(${(70 + rr(0, 70)) | 0},${(110 + rr(0, 80)) | 0},${(46 + rr(0, 40)) | 0},0.95)`;
                g.lineWidth = rr(1.5, 3.5);
                g.beginPath();
                g.moveTo(x, cv.height);
                g.quadraticCurveTo(x + rr(-9, 9), cv.height * 0.45, x + rr(-16, 16), rr(2, cv.height * 0.4));
                g.stroke();
            }
        });
        const blades = [];
        for (let i = 0; i < 3; i++) {
            const q = new THREE.PlaneGeometry(0.5, 0.46);
            q.translate(0, 0.23, 0);
            q.rotateY((i / 3) * Math.PI);
            blades.push(q);
        }
        const tufts = new THREE.InstancedMesh(
            weld(blades),
            windy(new THREE.MeshStandardMaterial({
                map: tuftTex, transparent: true, alphaTest: 0.42, side: THREE.DoubleSide, roughness: 1.0,
            }), 'windy-tuft', 0.16),
            760
        );
        const m4 = new THREE.Matrix4();
        const q = new THREE.Quaternion();
        const e = new THREE.Euler();
        const p = new THREE.Vector3();
        const s = new THREE.Vector3();
        let placed = 0;
        for (let guard = 0; guard < 4000 && placed < 760; guard++) {
            const x = rr(-150, 150), z = rr(-40, 300);
            // Off the paving, off the stone, on the grass either side.
            const onMound = Math.abs(x) < TA.base + 2 && Math.abs(z) < TA.base + 2;
            const onPlaza = Math.abs(x) < 76 && z > PLAZA_Z0 - 2 && z < 258;
            const onAvenue = Math.abs(x) < 17 && z >= 254;
            if (onMound || onPlaza || onAvenue) continue;
            e.set(0, rr(0, Math.PI * 2), 0);
            q.setFromEuler(e);
            p.set(x, 0.02, z);
            const k = rr(0.7, 1.5);
            s.set(k, k * rr(0.8, 1.4), k);
            m4.compose(p, q, s);
            tufts.setMatrixAt(placed, m4);
            placed++;
        }
        tufts.count = placed;
        tufts.instanceMatrix.needsUpdate = true;
        world.ghost(tufts);
        scene.add(tufts);
    }

    /* ============================================================
       9 · the city, standing off in the haze
       ============================================================ */

    {
        const towers = [];
        for (let i = 0; i < 46; i++) {
            const x = rr(-330, 210);
            const z = 640 + rr(0, 150);
            const w = rr(14, 34);
            const h = rr(34, 120) * (1 - Math.abs(x + 60) / 700);
            towers.push([x, z, w, Math.max(24, h)]);
        }
        const city = new THREE.InstancedMesh(
            new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0),
            new THREE.MeshStandardMaterial({ color: 0x9fb2c4, roughness: 0.42, metalness: 0.35 }),
            towers.length
        );
        const m4 = new THREE.Matrix4();
        const q = new THREE.Quaternion();
        const e = new THREE.Euler();
        const p = new THREE.Vector3();
        const s = new THREE.Vector3();
        const tint = new THREE.Color();
        for (let i = 0; i < towers.length; i++) {
            e.set(0, rr(-0.3, 0.3), 0);
            q.setFromEuler(e);
            p.set(towers[i][0], 0, towers[i][1]);
            s.set(towers[i][2], towers[i][3], towers[i][2] * rr(0.7, 1.3));
            m4.compose(p, q, s);
            city.setMatrixAt(i, m4);
            tint.setRGB(rr(0.78, 1.1), rr(0.84, 1.08), rr(0.9, 1.14));
            city.setColorAt(i, tint);
        }
        city.instanceMatrix.needsUpdate = true;
        if (city.instanceColor) city.instanceColor.needsUpdate = true;
        world.ghost(city);
        scene.add(city);

        // The one tower everybody in Melbourne can name, with its gold crown.
        const eureka = new THREE.Mesh(
            new THREE.BoxGeometry(26, 186, 22).translate(0, 93, 0),
            new THREE.MeshStandardMaterial({ color: 0x4d6478, roughness: 0.28, metalness: 0.55 })
        );
        eureka.position.set(-96, 0, 690);
        world.ghost(eureka);
        scene.add(eureka);

        const crown = new THREE.Mesh(
            new THREE.BoxGeometry(26.4, 26, 22.4).translate(0, 13, 0),
            goldMat
        );
        crown.position.set(-96, 158, 690);
        world.ghost(crown);
        scene.add(crown);

        const spire = new THREE.Mesh(
            weld([
                new THREE.CylinderGeometry(3.2, 6.5, 120, 8).translate(0, 60, 0),
                new THREE.CylinderGeometry(0.5, 2.2, 40, 6).translate(0, 138, 0),
            ]),
            new THREE.MeshStandardMaterial({ color: 0x8fa3b6, roughness: 0.4, metalness: 0.4 })
        );
        spire.position.set(-160, 0, 720);
        world.ghost(spire);
        scene.add(spire);
    }

    /* ============================================================
       10 · what else is alive out here
       ============================================================ */

    // Gulls, riding the same afternoon the flags are in.
    const BIRDS = 9;
    const birds = new THREE.InstancedMesh(
        weld([
            new THREE.BoxGeometry(0.14, 0.10, 0.52),
            new THREE.BoxGeometry(1.30, 0.045, 0.20).translate(0, 0.03, -0.02),
        ]),
        new THREE.MeshStandardMaterial({ color: 0xf2f4f6, roughness: 0.8 }),
        BIRDS
    );
    world.ghost(birds);
    scene.add(birds);
    const birdSeeds = [];
    for (let i = 0; i < BIRDS; i++) {
        birdSeeds.push({
            r: rr(60, 190), y: rr(26, 62), phase: rr(0, Math.PI * 2),
            speed: rr(0.07, 0.15), cx: rr(-40, 40), cz: rr(80, 240), bank: rr(0.2, 0.5),
        });
    }

    // Four people, small against all of it, which is the point of the place.
    const walkerMat = [0x2b2f38, 0x1f2430, 0x3a3630, 0x25303a];
    const walkers = [];
    for (let i = 0; i < 4; i++) {
        const person = new THREE.Group();
        const coat = new THREE.MeshStandardMaterial({ color: walkerMat[i], roughness: 0.92 });
        const body = new THREE.Mesh(weld([
            new THREE.CapsuleGeometry(0.20, 0.52, 4, 9).translate(0, 1.16, 0),
            new THREE.SphereGeometry(0.115, 9, 7).translate(0, 1.60, 0),
        ]), coat);
        body.castShadow = true;
        person.add(body);
        const legGeo = new THREE.BoxGeometry(0.15, 0.84, 0.16).translate(0, -0.42, 0);
        const legs = [];
        for (const sx of [-1, 1]) {
            const leg = new THREE.Mesh(legGeo, coat);
            leg.position.set(sx * 0.11, 0.86, 0);
            leg.castShadow = true;
            person.add(leg);
            legs.push(leg);
        }
        world.ghost(person);
        scene.add(person);
        walkers.push({
            group: person, legs,
            // Kept to the paving: nobody's loop wanders into a hedge or a lamp.
            cx: [0, -22, 24, 4][i], cz: [116, 190, 168, 232][i],
            rx: [26, 10, 10, 9][i], rz: [16, 22, 26, 14][i],
            u: rr(0, Math.PI * 2), speed: rr(0.055, 0.1), y: 0.05,
        });
    }

    /* ============================================================
       11 · the clock
       ============================================================ */

    const bm = new THREE.Matrix4();
    const bq = new THREE.Quaternion();
    const be = new THREE.Euler();
    const bp = new THREE.Vector3();
    const bs = new THREE.Vector3(1, 1, 1);

    world.frame((dt, t) => {
        uWind.value = t;
        uFlagTime.value = t;
        skyUniforms.uTime.value = t;
        flameUniforms.uTime.value = t;

        // A flame that is never twice the same size, and never quite steady.
        const flick = 0.86 + Math.sin(t * 8.3) * 0.09 + Math.sin(t * 15.7) * 0.05;
        flameMesh.scale.set(flick, 0.92 + Math.sin(t * 6.1) * 0.14, flick);
        flameLight.intensity = 19 + Math.sin(t * 7.9) * 4.5 + Math.sin(t * 13.3) * 2.5;

        for (let i = 0; i < BIRDS; i++) {
            const b = birdSeeds[i];
            const a = b.phase + t * b.speed;
            bp.set(b.cx + Math.cos(a) * b.r, b.y + Math.sin(t * 0.6 + b.phase) * 2.6, b.cz + Math.sin(a) * b.r * 0.72);
            be.set(Math.sin(t * 5.5 + b.phase) * 0.34, -a + Math.PI / 2, b.bank);
            bq.setFromEuler(be);
            bm.compose(bp, bq, bs);
            birds.setMatrixAt(i, bm);
        }
        birds.instanceMatrix.needsUpdate = true;

        for (let i = 0; i < walkers.length; i++) {
            const w = walkers[i];
            w.u += dt * w.speed;
            const x = w.cx + Math.cos(w.u) * w.rx;
            const z = w.cz + Math.sin(w.u) * w.rz;
            w.group.position.set(x, w.y + Math.abs(Math.sin(w.u * 26)) * 0.035, z);
            w.group.rotation.y = Math.atan2(-Math.sin(w.u) * w.rx, Math.cos(w.u) * w.rz);
            const swing = Math.sin(w.u * 26) * 0.5;
            w.legs[0].rotation.x = swing;
            w.legs[1].rotation.x = -swing;
        }
    });
}
