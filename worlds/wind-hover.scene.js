//
//  wind-hover.scene.js
//  Project27 worlds
//
//  A seagull, doing the thing a seagull is actually for: hanging motionless in
//  the air off the lip of a sea cliff, three metres out over nothing, holding
//  station on the updraft with its wings locked and its head nailed to the
//  horizon while the whole rest of it gets shoved around by the wind.
//
//  The bird is the world, so the bird is where the work went. It is lofted and
//  laminated feather by feather — ten primaries per hand with the black tips and
//  the white mirrors, scalloped secondaries, a laterally compressed bill with the
//  gonys bulge in the right place, a white iris with a red orbital ring — and it
//  is lit by a shader that lets the low sun come *through* the vanes, because a
//  gull seen against the light is mostly a lantern with a wing-shape cut in it.
//
//  It holds, buffets, drops a wing, flaps twice when the lift goes soft, calls,
//  and every so often it swings its head round and looks straight at you. The
//  head counter-rotates against the body the whole time. That is the trick, and
//  it is the only reason any of this reads as a bird.
//
//  Everything else — the chalk-and-ochre cliff falling into a foaming sea, the
//  downs behind you streaming inland in one long gust, three more birds wheeling
//  out over the stacks, a feather nobody is coming back for — is there so the
//  gull has somewhere to hang.
//

export default function build(world) {
    const { THREE, scene, camera } = world;

    world.ownsSky(true);
    world.bloom({ strength: 0.30, radius: 0.72, threshold: 0.90 });

    /* ============================================================
       0 · kitchen
       ============================================================ */
    const TAU = Math.PI * 2;
    const lerp = (a, b, t) => a + (b - a) * t;
    const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
    const smooth = (e0, e1, x) => { const t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };
    const srgb = (hex) => new THREE.Color(hex).convertSRGBToLinear();

    // Deterministic: the same coast, the same birds, every time it opens.
    let _seed = 20260827;
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
        for (let i = 0; i < oct; i++) { s += a * vnoise(x * f, y * f); f *= 2.03; a *= 0.5; }
        return s;
    }

    const _p = new THREE.Vector3();
    const _v = new THREE.Vector3();
    const _m4 = new THREE.Matrix4();
    const _cA = new THREE.Color(), _cB = new THREE.Color();

    /* ============================================================
       1 · the light, said once
       ============================================================ */
    const TOP = 44;                                     // clifftop, metres above the sea

    const SUN_DIR = new THREE.Vector3(-0.42, 0.265, -0.87).normalize();   // low, out over the water
    const WIND = new THREE.Vector3(0.86, 0, 0.51).normalize();            // onshore, off the sea

    const C_SUNLIGHT = srgb(0xffe0b4);
    const C_SKY_TOP = srgb(0x2b5fb2);
    const C_SKY_MID = srgb(0x7fabdb);
    const C_HOR = srgb(0xe4d5c0);
    const C_HEMI_SKY = srgb(0xb9d6f2);
    const C_HEMI_GND = srgb(0x51533f);
    const C_AMB = srgb(0xcfdeee);

    const SUN_I = 2.7, HEMI_I = 1.25, AMB_I = 0.30;
    const FOG_D = 0.00135;

    scene.fog = new THREE.FogExp2(C_HOR.clone(), FOG_D);

    const sun = new THREE.DirectionalLight(0xffe0b4, SUN_I);
    sun.position.copy(SUN_DIR).multiplyScalar(300);
    sun.position.y += TOP;
    sun.target.position.set(0, TOP, -12);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    {
        const c = sun.shadow.camera;
        c.left = -70; c.right = 70; c.top = 70; c.bottom = -70; c.near = 40; c.far = 520;
        sun.shadow.bias = -0.0009; sun.shadow.normalBias = 0.35;
    }
    scene.add(sun, sun.target);
    scene.add(new THREE.HemisphereLight(0xb9d6f2, 0x51533f, HEMI_I));
    scene.add(new THREE.AmbientLight(0xcfdeee, AMB_I));

    // The custom shaders have to agree with those lights or the bird floats free
    // of its own world. three's lambert is albedo * colour * intensity / PI, so
    // that is exactly what gets handed over.
    const K = 1 / Math.PI;
    const U_SUN = C_SUNLIGHT.clone().multiplyScalar(SUN_I * K);
    const U_SKY = C_HEMI_SKY.clone().multiplyScalar(HEMI_I * K).add(C_AMB.clone().multiplyScalar(AMB_I * K));
    const U_GND = C_HEMI_GND.clone().multiplyScalar(HEMI_I * K).add(C_AMB.clone().multiplyScalar(AMB_I * K));

    const LIT_U = {
        uSunDir: { value: SUN_DIR.clone() },
        uSunCol: { value: U_SUN.clone() },
        uSkyCol: { value: U_SKY.clone() },
        uGndCol: { value: U_GND.clone() },
        uHor: { value: C_HOR.clone() },
        uCamPos: { value: new THREE.Vector3() },
        uFogD: { value: FOG_D },
        uTime: { value: 0 },
    };
    const litU = (extra) => Object.assign({}, LIT_U, extra || {});

    const LIT_GLSL = /* glsl */`
      uniform vec3 uSunDir, uSunCol, uSkyCol, uGndCol, uHor, uCamPos;
      uniform float uFogD, uTime;

      // One surface model for every hand-written material in this world: a
      // hemisphere ambient, a lambert key, a rim off the sky, and — the whole
      // reason it exists — light coming through a thin thing from behind.
      vec3 litSurface(vec3 N, vec3 wp, vec3 base, float trans, float rimK, float spec) {
        vec3 V = normalize(uCamPos - wp);
        vec3 amb = mix(uGndCol, uSkyCol, N.y * 0.5 + 0.5);
        vec3 col = base * (amb + uSunCol * max(dot(N, uSunDir), 0.0));
        float back = pow(max(dot(V, -uSunDir), 0.0), 3.0) * max(-dot(N, uSunDir), 0.0);
        col += base * uSunCol * back * trans * 2.2;
        col += uSkyCol * pow(1.0 - max(dot(N, V), 0.0), 3.0) * rimK;
        vec3 H = normalize(V + uSunDir);
        col += uSunCol * pow(max(dot(N, H), 0.0), 30.0) * spec;
        return col;
      }
      vec3 applyFog(vec3 col, vec3 wp) {
        float d = length(uCamPos - wp);
        return mix(col, uHor, 1.0 - exp(-pow(d * uFogD, 2.0)));
      }
    `;

    const SKY_GLSL = /* glsl */`
      vec3 skyColor(vec3 d, vec3 sunDir, vec3 top, vec3 mid, vec3 hor, vec3 sunCol) {
        float h = d.y;
        vec3 col = mix(hor, mid, smoothstep(-0.015, 0.34, h));
        col = mix(col, top, smoothstep(0.18, 0.92, h));
        float sd = max(dot(normalize(d), sunDir), 0.0);
        vec3 glow = mix(sunCol, vec3(1.0), 0.35);
        col += glow * pow(sd, 16.0) * 0.30;
        col += glow * pow(sd, 3.5) * 0.075;
        col = mix(col, hor * 1.04, smoothstep(0.10, -0.05, h));
        return col;
      }
    `;

    /* ============================================================
       2 · sky
       ============================================================ */
    const skyU = {
        uSunDir: LIT_U.uSunDir, uSunCol: { value: C_SUNLIGHT.clone() },
        uTop: { value: C_SKY_TOP.clone() }, uMid: { value: C_SKY_MID.clone() }, uHor: LIT_U.uHor,
    };
    const sky = new THREE.Mesh(
        new THREE.SphereGeometry(6000, 40, 26),
        new THREE.ShaderMaterial({
            side: THREE.BackSide, depthWrite: false, fog: false, uniforms: skyU,
            vertexShader: `varying vec3 vDir;
              void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
            fragmentShader: SKY_GLSL + `
              varying vec3 vDir; uniform vec3 uSunDir, uSunCol, uTop, uMid, uHor;
              void main(){
                vec3 d = normalize(vDir);
                vec3 col = skyColor(d, uSunDir, uTop, uMid, uHor, uSunCol);
                float sd = max(dot(d, uSunDir), 0.0);
                col += uSunCol * smoothstep(0.9990, 0.99968, sd) * 7.0;
                gl_FragColor = vec4(col, 1.0);
              }`,
        })
    );
    sky.renderOrder = -10;
    scene.add(world.ghost(sky));

    /* ---------- cloud sprites, running inland fast ---------- */
    function cloudTexture(shift) {
        return world.canvasTexture(384, 384, (g, cv) => {
            const S = cv.width, base = S * 0.66;
            const puff = (x, y, r, a) => {
                const rad = g.createRadialGradient(x, y - r * 0.24, r * 0.10, x, y, r);
                rad.addColorStop(0, `rgba(255,255,255,${a})`);
                rad.addColorStop(0.55, `rgba(255,254,250,${a * 0.86})`);
                rad.addColorStop(0.84, `rgba(250,247,240,${a * 0.30})`);
                rad.addColorStop(1, 'rgba(248,246,240,0)');
                g.fillStyle = rad; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
            };
            for (let i = 0; i < 6; i++) {
                const t = i / 5;
                puff(S * 0.14 + t * S * 0.72 + rr(-10, 10), base - rr(4, 20), rr(34, 62) * (1 - Math.abs(t - 0.5) * 0.45), rr(0.7, 0.95));
            }
            for (let i = 0; i < 11; i++) {
                const t = (i + shift * 0.4) / 11;
                const lift = Math.sin(t * Math.PI) * S * 0.19;
                puff(S * 0.2 + t * S * 0.6 + rr(-22, 22), base - lift - rr(8, 40), rr(24, 52) * (0.6 + Math.sin(t * Math.PI) * 0.7), rr(0.5, 0.9));
            }
            for (let i = 0; i < 14; i++) {
                const a = rr(0, TAU);
                puff(S / 2 + Math.cos(a) * rr(60, 150), base - rr(0, 96) + Math.sin(a) * 14, rr(10, 26), rr(0.14, 0.36));
            }
            g.globalCompositeOperation = 'source-atop';
            const shade = g.createLinearGradient(0, base - S * 0.28, 0, base + 10);
            shade.addColorStop(0, 'rgba(255,255,255,0)');
            shade.addColorStop(0.6, 'rgba(178,196,214,.26)');
            shade.addColorStop(1, 'rgba(142,164,188,.52)');
            g.fillStyle = shade; g.fillRect(0, 0, S, S);
            g.globalCompositeOperation = 'source-over';
        });
    }
    const CLOUD_TEX = [cloudTexture(0), cloudTexture(1), cloudTexture(2)];
    const clouds = [];
    for (let i = 0; i < 34; i++) {
        const far = i > 20;
        const sp = new THREE.Sprite(new THREE.SpriteMaterial({
            map: CLOUD_TEX[i % 3], transparent: true, depthWrite: false, fog: false,
            opacity: rr(0.5, 0.92),
            color: new THREE.Color().setRGB(rr(1.5, 1.95), rr(1.48, 1.9), rr(1.42, 1.84)),
        }));
        const rad = far ? rr(2200, 5200) : rr(700, 2000);
        const ang = rr(0, TAU);
        const sz = far ? rr(420, 1050) : rr(220, 560);
        sp.position.set(Math.cos(ang) * rad, far ? rr(180, 520) : rr(380, 1000), Math.sin(ang) * rad);
        sp.scale.set(sz, sz * rr(0.40, 0.62), 1);
        sp.userData.spd = rr(9, 20);
        sp.renderOrder = -5;
        clouds.push(sp);
        scene.add(world.ghost(sp));
    }

    /* ============================================================
       3 · the cliff
       ============================================================ */
    const FOOT = -3.2;                                  // where the face meets the water

    // The coastline, as one line the whole world is hung off.
    function edgeZ(x) {
        return -7 + 6.5 * Math.sin(x * 0.0255 + 0.3) + 3.2 * Math.sin(x * 0.061 - 1.1) + 1.5 * Math.sin(x * 0.148 + 2.4);
    }
    function faceWidth(x) {
        return 5.5 + 4.5 * fbm2(x * 0.032 + 17, 3.5, 3) + 2.4 * fbm2(x * 0.11 - 4, 8.0, 2);
    }
    // t is metres inland of the brink — negative is out over the drop.
    function hAt(x, t) {
        const z = edgeZ(x) + t;
        const cape = smooth(148, 206, Math.abs(x));                 // the land runs out into haze
        let top = TOP + 0.035 * Math.max(0, t) + (fbm2(x * 0.017 + 31, z * 0.017 - 12, 4) - 0.5) * 4.2;
        top += (fbm2(x * 0.085 - 5, z * 0.085 + 7, 3) - 0.5) * 0.65;
        // the downs behind you, high enough to close the horizon off
        top += 58 * smooth(70, 190, t) * (0.85 + 0.30 * fbm2(x * 0.0075 + 3, 1.7, 3)) * (1 - 0.28 * smooth(190, 262, t));
        top = lerp(top, -19, cape);

        if (t >= 0) return top;

        const w = faceWidth(x) * (1 - 0.7 * cape) + 1.5;
        const d = -t;
        if (d <= w) {
            const f = d / w;
            let h = lerp(top, FOOT, smooth(0, 1, Math.pow(f, 0.70)));
            // horizontal strata: the cheapest honest cliff there is
            h += Math.sin(h * 0.62 + fbm2(x * 0.055, h * 0.05, 2) * 5.0) * 0.95 * (1 - Math.abs(f - 0.5) * 1.4) * (1 - cape);
            return h;
        }
        const o = d - w;
        const rubble = (fbm2(x * 0.09 + 2, o * 0.09 - 6, 3) - 0.5) * 2.6 * Math.exp(-o * 0.05);
        return Math.max(-24, FOOT - 1.5 * Math.pow(o, 0.78) * (0.75 + 0.55 * fbm2(x * 0.04, o * 0.04, 2)) + rubble);
    }

    const MAPX = 420, SEG_X = 300, SEG_T = 330;
    const T_IN = 246, T_OUT = 182;
    // Rows are laid out in distance-from-the-brink, not in z, so the grid follows
    // the coast: half a metre of resolution on the face, three metres out on the
    // downs, and not one wasted vertex.
    const tOf = (v) => {
        const s = v < 0 ? -1 : 1, a = Math.abs(v);
        return s * (0.25 * a + 0.75 * a * a) * (s > 0 ? T_IN : T_OUT);
    };

    const cliffGeo = new THREE.BufferGeometry();
    {
        const nx = SEG_X + 1, nt = SEG_T + 1;
        const pos = new Float32Array(nx * nt * 3);
        const col = new Float32Array(nx * nt * 3);
        const idx = new Uint32Array(SEG_X * SEG_T * 6);
        const cGrass = srgb(0x6f7a41), cGrassDry = srgb(0x97925a), cScour = srgb(0xb0a682),
            cRock = srgb(0x9c9079), cRockDk = srgb(0x6e6352), cOchre = srgb(0x9a7c4e),
            cGuano = srgb(0xd8d6c8), cWet = srgb(0x4a4740), cWeed = srgb(0x3c4a35),
            cSub = srgb(0x2b4650);
        const c = new THREE.Color();
        let vi = 0;
        for (let i = 0; i < nx; i++) {
            const x = -MAPX / 2 + (i / SEG_X) * MAPX;
            const w = faceWidth(x);
            const cape = smooth(148, 206, Math.abs(x));
            for (let j = 0; j < nt; j++) {
                const t = tOf((j / SEG_T) * 2 - 1);
                const z = edgeZ(x) + t;
                const h = hAt(x, t);
                pos[vi * 3] = x; pos[vi * 3 + 1] = h; pos[vi * 3 + 2] = z;

                const nz = fbm2(x * 0.13 + 9, z * 0.13 - 3, 3);
                if (t > -1.2) {
                    // clifftop: thin windburnt turf, scoured back to chalk at the brink
                    c.copy(cGrass).lerp(cGrassDry, smooth(0.35, 0.72, nz));
                    c.lerp(cScour, smooth(6.0, 0.4, t) * (0.35 + 0.5 * nz));
                    c.lerp(cRock, smooth(3.0, -0.5, t) * 0.55);
                    c.lerp(cGrassDry, smooth(60, 150, t) * 0.35 * (0.5 + nz));
                } else {
                    const f = clamp(-t / w, 0, 1);
                    const band = Math.sin(h * 0.55 + fbm2(x * 0.05, h * 0.04, 2) * 5.5) * 0.5 + 0.5;
                    c.copy(cRock).lerp(cOchre, band * 0.65);
                    c.lerp(cRockDk, smooth(0.35, 0.95, fbm2(x * 0.07 + 5, h * 0.09, 3)) * 0.55);
                    // guano: high-frequency across the face, near-constant down it
                    const streak = smooth(0.62, 0.93, vnoise(x * 1.05, h * 0.035));
                    c.lerp(cGuano, streak * smooth(0.05, 0.35, f) * smooth(1.0, 0.55, f) * 0.85);
                    c.lerp(cWet, smooth(6.0, 1.6, h));
                    c.lerp(cWeed, smooth(2.4, 0.4, h) * 0.8);
                    c.lerp(cSub, smooth(-0.2, -5.0, h));
                    c.lerp(cRock, cape * 0.5);
                }
                c.multiplyScalar(0.86 + nz * 0.28);
                col[vi * 3] = c.r; col[vi * 3 + 1] = c.g; col[vi * 3 + 2] = c.b;
                vi++;
            }
        }
        let ii = 0;
        for (let i = 0; i < SEG_X; i++) {
            for (let j = 0; j < SEG_T; j++) {
                const a = i * nt + j, b = a + nt;
                idx[ii++] = a; idx[ii++] = a + 1; idx[ii++] = b;
                idx[ii++] = a + 1; idx[ii++] = b + 1; idx[ii++] = b;
            }
        }
        cliffGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        cliffGeo.setAttribute('color', new THREE.BufferAttribute(col, 3));
        cliffGeo.setIndex(new THREE.BufferAttribute(idx, 1));
        cliffGeo.computeVertexNormals();
    }
    const cliff = new THREE.Mesh(cliffGeo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.98 }));
    cliff.receiveShadow = true;
    scene.add(cliff);
    world.ground(cliff);
    world.groundLevel(hAt(0, 8));

    /* ---------- the bed, for the water to know how deep it is ---------- */
    const BEDN = 256, BEDSPAN = 660;
    const bedData = new Uint8Array(BEDN * BEDN * 4);
    for (let j = 0; j < BEDN; j++) {
        for (let i = 0; i < BEDN; i++) {
            const x = (i / (BEDN - 1) - 0.5) * BEDSPAN;
            const z = (j / (BEDN - 1) - 0.5) * BEDSPAN;
            const h = clamp(hAt(x, z - edgeZ(x)), -40, 90);
            const k = (j * BEDN + i) * 4;
            bedData[k] = Math.round((h + 40) / 130 * 255);
            bedData[k + 3] = 255;
        }
    }
    const bedTex = new THREE.DataTexture(bedData, BEDN, BEDN, THREE.RGBAFormat);
    bedTex.minFilter = bedTex.magFilter = THREE.LinearFilter;
    bedTex.wrapS = bedTex.wrapT = THREE.ClampToEdgeWrapping;
    bedTex.needsUpdate = true;

    /* ============================================================
       4 · the sea
       ============================================================ */
    const STACKS = [
        { x: -47, z: -62, r: 8.5, h: 20.5 },
        { x: 33, z: -84, r: 6.4, h: 15.0 },
        { x: -13, z: -134, r: 10.5, h: 25.0 },
    ];

    const WAVES = [                                     // dirX, dirZ, steep, wavelength, speed
        [0.86, 0.51, 0.130, 58.0, 0.96],
        [0.62, 0.78, 0.100, 33.0, 1.05],
        [0.96, 0.28, 0.078, 20.0, 0.92],
        [0.74, 0.67, 0.052, 11.5, 1.22],
        [0.99, -0.14, 0.036, 6.6, 1.40],
    ];
    const WAVE_GLSL = /* glsl */`
      void addWave(vec2 dir, float steep, float wl, float spd, vec2 p, float t,
                   inout vec3 disp, inout vec3 tang, inout vec3 bino) {
        float k = 6.28318530718 / wl;
        float c = sqrt(9.81 / k) * spd;
        vec2 d = normalize(dir);
        float f = k * (dot(d, p) - c * t);
        float a = steep / k;
        float sf = sin(f), cf = cos(f);
        disp += vec3(d.x * a * cf, a * sf, d.y * a * cf);
        tang += vec3(-d.x * d.x * steep * sf, d.x * steep * cf, -d.x * d.y * steep * sf);
        bino += vec3(-d.x * d.y * steep * sf, d.y * steep * cf, -d.y * d.y * steep * sf);
      }
    `;
    const waveCalls = WAVES.map(w =>
        `addWave(vec2(${w[0].toFixed(3)}, ${w[1].toFixed(3)}), ${w[2].toFixed(3)}, ${w[3].toFixed(2)}, ${w[4].toFixed(2)}, p, t, disp, tang, bino);`
    ).join('\n          ');
    const WAVE_AMP = WAVES.reduce((s, w) => s + w[2] * w[3] / TAU, 0);

    const C_DEEP = srgb(0x0a3c58), C_SHAL = srgb(0x1c7d8e), C_FOAM = srgb(0xeef5f4);

    const waterU = litU({
        uTop: skyU.uTop, uMid: skyU.uMid, uSkyRaw: { value: C_SUNLIGHT.clone() },
        uDeep: { value: C_DEEP.clone() }, uShal: { value: C_SHAL.clone() }, uFoam: { value: C_FOAM.clone() },
        uBed: { value: bedTex }, uBedSpan: { value: BEDSPAN }, uAmp: { value: WAVE_AMP },
        uStack: { value: STACKS.map(s => new THREE.Vector3(s.x, s.z, s.r)) },
    });
    const waterMat = new THREE.ShaderMaterial({
        uniforms: waterU, transparent: true, depthWrite: true,
        vertexShader: WAVE_GLSL + /* glsl */`
          uniform float uTime, uAmp;
          varying vec3 vWorld; varying vec3 vNrm; varying float vCrest;
          void main(){
            vec3 wp = (modelMatrix * vec4(position, 1.0)).xyz;
            vec2 p = wp.xz; float t = uTime;
            vec3 disp = vec3(0.0), tang = vec3(1.0, 0.0, 0.0), bino = vec3(0.0, 0.0, 1.0);
            ${waveCalls}
            float d = length(cameraPosition.xz - p);
            float damp = 1.0 - smoothstep(300.0, 1200.0, d) * 0.78;
            disp *= damp;
            vec3 wpos = wp + disp;
            vNrm = normalize(mix(vec3(0.0, 1.0, 0.0), normalize(cross(bino, tang)), damp));
            vCrest = clamp(disp.y / max(uAmp, 0.001), -1.0, 1.0);
            vWorld = wpos;
            gl_Position = projectionMatrix * viewMatrix * vec4(wpos, 1.0);
          }`,
        fragmentShader: LIT_GLSL + SKY_GLSL + /* glsl */`
          uniform float uBedSpan;
          uniform vec3 uTop, uMid, uSkyRaw, uDeep, uShal, uFoam;
          uniform vec3 uStack[3];
          uniform sampler2D uBed;
          varying vec3 vWorld; varying vec3 vNrm; varying float vCrest;

          float h21(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
          float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
            float a = h21(i), b = h21(i + vec2(1.0, 0.0)), c = h21(i + vec2(0.0, 1.0)), d = h21(i + vec2(1.0, 1.0));
            return mix(mix(a, b, f.x), mix(c, d, f.x), f.y); }
          float fbm(vec2 p){ float s = 0.0, a = 0.5; for(int i = 0; i < 4; i++){ s += a * vn(p); p *= 2.05; a *= 0.5; } return s; }

          void main(){
            float dist = length(uCamPos - vWorld);
            float detail = 1.0 - smoothstep(50.0, 400.0, dist);

            vec3 N = normalize(vNrm);
            float lod = clamp(dist / 190.0, 0.30, 7.0);
            vec2 rp = vWorld.xz * (0.42 / lod);
            float n1 = fbm(rp + vec2(uTime * 0.36, uTime * 0.22) / lod);
            float n2 = fbm(rp * 2.3 - vec2(uTime * 0.28, uTime * 0.41) / lod);
            N = normalize(N + vec3((n1 - 0.5) * 0.46, 0.0, (n2 - 0.5) * 0.46));

            vec2 uv = vWorld.xz / uBedSpan + 0.5;
            float bed = -40.0;
            if (uv.x > 0.0 && uv.x < 1.0 && uv.y > 0.0 && uv.y < 1.0)
              bed = texture2D(uBed, uv).r * 130.0 - 40.0;
            float depth = max(0.0, -bed);

            vec3 V = normalize(uCamPos - vWorld);
            float fres = mix(0.028, 1.0, pow(1.0 - max(dot(N, V), 0.0), 5.0));
            vec3 R = reflect(-V, N); R.y = abs(R.y);
            vec3 refl = skyColor(R, uSunDir, uTop, uMid, uHor, uSkyRaw);

            float sf = smoothstep(0.0, 14.0, depth);
            vec3 body = mix(uShal, uDeep, sf);
            body *= 0.80 + 0.45 * max(dot(N, uSunDir), 0.0);
            body += uShal * pow(max(vCrest, 0.0), 2.4) * 0.35 * (1.0 - sf * 0.55);

            vec3 col = mix(body, refl, clamp(fres, 0.0, 1.0));

            vec3 H = normalize(V + uSunDir);
            float ndh = max(dot(N, H), 0.0);
            float glitter = pow(ndh, 190.0) * (0.2 + 0.8 * fbm(vWorld.xz * 0.95 + uTime * 0.45));
            col += uSkyRaw * (pow(ndh, 620.0) * 0.95 + glitter * 0.17 * detail);

            // foam: the swell piling into the foot of the cliff, and the wash
            // going round each stack
            float band = fbm(vWorld.xz * 0.16 + vec2(0.0, uTime * 0.24));
            float surge = 0.5 + 0.5 * sin(uTime * 0.72 - depth * 1.1 + band * 3.4);
            float foam = smoothstep(5.5, 0.05, depth) * smoothstep(0.18, 0.62, band * 0.55 + surge * 0.66);
            for (int i = 0; i < 3; i++) {
              float e = length(vWorld.xz - uStack[i].xy) / uStack[i].z;
              foam += smoothstep(0.92, 1.02, e) * smoothstep(1.55, 1.05, e)
                    * (0.35 + 0.65 * fbm(vWorld.xz * 0.7 + uTime * 0.35)) * 0.9;
            }
            foam += smoothstep(0.88, 1.0, vCrest) * smoothstep(0.55, 0.98, fbm(vWorld.xz * 0.75 - uTime * 0.2)) * 0.20 * detail;
            foam = clamp(foam, 0.0, 1.0);
            col = mix(col, uFoam * (0.92 + 0.16 * n1), foam * 0.94);

            float alpha = clamp(max(mix(0.45, 1.0, smoothstep(0.05, 2.4, depth)), foam), 0.0, 1.0);
            float fog = 1.0 - exp(-pow(dist * uFogD, 2.0));
            col = mix(col, uHor, fog);
            alpha = mix(alpha, 1.0, fog);
            gl_FragColor = vec4(col, alpha);
          }`,
    });
    const waterGeo = new THREE.PlaneGeometry(1500, 1500, 340, 340);
    waterGeo.rotateX(-Math.PI / 2);
    const water = new THREE.Mesh(waterGeo, waterMat);
    water.renderOrder = 1;
    scene.add(water);
    world.ground(water);

    const farSea = new THREE.Mesh(
        (() => { const g = new THREE.RingGeometry(660, 7000, 96, 4); g.rotateX(-Math.PI / 2); return g; })(),
        new THREE.ShaderMaterial({
            uniforms: litU({ uTop: skyU.uTop, uMid: skyU.uMid, uSkyRaw: waterU.uSkyRaw, uDeep: waterU.uDeep }),
            vertexShader: `varying vec3 vWorld;
              void main(){ vWorld = (modelMatrix * vec4(position, 1.0)).xyz;
                gl_Position = projectionMatrix * viewMatrix * vec4(vWorld, 1.0); }`,
            fragmentShader: LIT_GLSL + SKY_GLSL + `
              uniform vec3 uTop, uMid, uSkyRaw, uDeep;
              varying vec3 vWorld;
              void main(){
                vec3 N = vec3(0.0, 1.0, 0.0);
                vec3 V = normalize(uCamPos - vWorld);
                float fres = mix(0.028, 1.0, pow(1.0 - max(dot(N, V), 0.0), 5.0));
                vec3 R = reflect(-V, N); R.y = abs(R.y);
                vec3 col = mix(uDeep * 0.95, skyColor(R, uSunDir, uTop, uMid, uHor, uSkyRaw), clamp(fres, 0.0, 1.0));
                vec3 H = normalize(V + uSunDir);
                col += uSkyRaw * pow(max(dot(N, H), 0.0), 200.0) * 0.7;
                gl_FragColor = vec4(applyFog(col, vWorld), 1.0);
              }`,
        })
    );
    farSea.position.y = -0.2;
    farSea.renderOrder = 0;
    scene.add(world.ghost(farSea));

    /* ============================================================
       5 · stacks, boulders, spray
       ============================================================ */
    const rockMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.97, flatShading: false });

    function stackGeometry(s) {
        const nt = 22, nr = 18;
        const g = new THREE.CylinderGeometry(1, 1, 1, nr, nt, false);
        const p = g.attributes.position;
        const cols = new Float32Array(p.count * 3);
        const cRock = srgb(0x8f8471), cOchre = srgb(0x8d7048), cWet = srgb(0x40403a),
            cWeed = srgb(0x3a4733), cCap = srgb(0xd6d3c4);
        const c = new THREE.Color();
        for (let i = 0; i < p.count; i++) {
            const px = p.getX(i), py = p.getY(i), pz = p.getZ(i);
            const u = py + 0.5;                                   // 0 base, 1 top
            // the end caps come in at radius < 1: keep their radial fraction so
            // the top of the stack stays a top and not a hole
            const orig = Math.hypot(px, pz);
            const ca = orig > 1e-6 ? px / orig : 1, sa = orig > 1e-6 ? pz / orig : 0;
            const ang = Math.atan2(sa, ca);
            const y = -7 + u * (s.h + 7);
            let r = s.r * (1.05 - 0.42 * Math.pow(u, 1.7));
            r *= 1 + 0.16 * Math.sin(ang * 3 + u * 2.1 + s.x) + 0.10 * Math.sin(ang * 7 - u * 3.3);
            r *= 1 + (fbm2(ang * 3.4 + s.z, y * 0.35, 3) - 0.5) * 0.30;
            r += Math.sin(y * 0.9 + fbm2(ang * 2.0, y * 0.2, 2) * 4.0) * 0.28;   // strata
            r *= orig;
            p.setXYZ(i, ca * r, y, sa * r);
            const nz = fbm2(ang * 5.0 + 3, y * 0.5, 3);
            const band = Math.sin(y * 0.7 + fbm2(ang * 2.2, y * 0.25, 2) * 5.0) * 0.5 + 0.5;
            c.copy(cRock).lerp(cOchre, band * 0.6);
            c.lerp(cCap, smooth(0.72, 1.0, u) * (0.35 + 0.55 * smooth(0.45, 0.85, nz)));
            c.lerp(cWet, smooth(4.5, 1.2, y));
            c.lerp(cWeed, smooth(2.0, -0.5, y) * 0.85);
            c.multiplyScalar(0.85 + nz * 0.3);
            cols[i * 3] = c.r; cols[i * 3 + 1] = c.g; cols[i * 3 + 2] = c.b;
        }
        g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
        g.computeVertexNormals();
        return g;
    }
    for (const s of STACKS) {
        const m = new THREE.Mesh(stackGeometry(s), rockMat);
        m.position.set(s.x, 0, s.z);
        m.castShadow = true; m.receiveShadow = true;
        scene.add(m);
        s.mesh = m;
    }

    // Rubble at the foot of the cliff — one draw call for all of it.
    {
        const N = 90;
        const g = new THREE.DodecahedronGeometry(1, 0);
        const cols = new Float32Array(g.attributes.position.count * 3);
        const cr = srgb(0x7d7565);
        for (let i = 0; i < cols.length; i += 3) { cols[i] = cr.r; cols[i + 1] = cr.g; cols[i + 2] = cr.b; }
        g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
        const inst = new THREE.InstancedMesh(g, rockMat, N);
        const dummy = new THREE.Object3D();
        const cw = new THREE.Color();
        for (let i = 0; i < N; i++) {
            const x = rr(-135, 135);
            const t = -faceWidth(x) - rr(0.5, 26);
            const z = edgeZ(x) + t;
            const y = hAt(x, t) + rr(0.2, 1.6);
            dummy.position.set(x, y, z);
            dummy.rotation.set(rr(0, 3), rr(0, 3), rr(0, 3));
            dummy.scale.set(rr(0.7, 3.4), rr(0.5, 2.2), rr(0.7, 3.2));
            dummy.updateMatrix();
            inst.setMatrixAt(i, dummy.matrix);
            const k = rr(0.7, 1.15);
            inst.setColorAt(i, cw.setRGB(k, k * 0.98, k * 0.92));
        }
        inst.castShadow = true;
        inst.instanceMatrix.needsUpdate = true;
        scene.add(inst);
    }

    // Spray: the swell hitting the foot, going up the face and being taken inland.
    const sprayTex = world.canvasTexture(128, 128, (g, cv) => {
        const S = cv.width;
        const rad = g.createRadialGradient(S / 2, S / 2, 2, S / 2, S / 2, S / 2);
        rad.addColorStop(0, 'rgba(255,255,255,0.95)');
        rad.addColorStop(0.45, 'rgba(250,253,255,0.42)');
        rad.addColorStop(1, 'rgba(240,248,255,0)');
        g.fillStyle = rad; g.fillRect(0, 0, S, S);
    });
    const spray = [];
    for (let i = 0; i < 26; i++) {
        const sp = new THREE.Sprite(new THREE.SpriteMaterial({
            map: sprayTex, transparent: true, depthWrite: false, fog: true,
            opacity: 0.0, color: new THREE.Color().setRGB(1.5, 1.55, 1.55),
        }));
        const x = rr(-95, 95);
        sp.userData = {
            x, z: edgeZ(x) - faceWidth(x) * rr(0.1, 0.7),
            u: rr(0, 1), spd: rr(0.16, 0.34), rise: rr(11, 34), sz: rr(3.5, 11),
        };
        sp.renderOrder = 2;
        spray.push(sp);
        scene.add(world.ghost(sp));
    }

    /* ============================================================
       6 · grass — one mesh, one gust
       ============================================================ */
    const grassMat = new THREE.ShaderMaterial({
        uniforms: litU({ uWind: { value: new THREE.Vector2(WIND.x, WIND.z) } }),
        side: THREE.DoubleSide,
        vertexShader: LIT_GLSL + /* glsl */`
          attribute vec3 aTop;
          attribute float aH;
          attribute float aPh;
          uniform vec2 uWind;
          varying vec3 vN; varying vec3 vW; varying vec3 vCol; varying float vH;
          void main(){
            vec3 pos = position;
            float gust = 0.55 + 0.45 * sin(dot(pos.xz, uWind) * 0.11 - uTime * 1.55 + aPh * 0.6)
                              + 0.22 * sin(dot(pos.xz, uWind) * 0.42 - uTime * 3.1 + aPh);
            float bend = pow(aH, 1.7) * (0.30 + 0.34 * gust);
            pos.xz += uWind * bend * 0.34;
            pos.y -= bend * bend * 0.11;
            pos.x += sin(uTime * 7.0 + aPh * 3.0) * 0.012 * pow(aH, 2.5) * gust;
            vec4 wp = modelMatrix * vec4(pos, 1.0);
            vW = wp.xyz;
            vN = normalize(mat3(modelMatrix) * normal);
            vCol = aTop; vH = aH;
            gl_Position = projectionMatrix * viewMatrix * wp;
          }`,
        fragmentShader: LIT_GLSL + /* glsl */`
          varying vec3 vN; varying vec3 vW; varying vec3 vCol; varying float vH;
          void main(){
            vec3 N = normalize(vN);
            if (!gl_FrontFacing) N = -N;
            vec3 col = litSurface(N, vW, vCol, 0.55 + 0.45 * vH, 0.30, 0.05);
            gl_FragColor = vec4(applyFog(col, vW), 1.0);
          }`,
    });
    {
        const TUFTS = 1500, PER = 3, SEGS = 4;
        const vpb = (SEGS + 1) * 2;
        const nv = TUFTS * PER * vpb;
        const pos = new Float32Array(nv * 3), top = new Float32Array(nv * 3);
        const aH = new Float32Array(nv), aPh = new Float32Array(nv);
        const idx = new Uint32Array(TUFTS * PER * SEGS * 6);
        const cBase = srgb(0x53602f), cMid = srgb(0x828b46), cTip = srgb(0xc4b87c);
        const c = new THREE.Color();
        let v = 0, ii = 0;
        for (let ti = 0; ti < TUFTS; ti++) {
            // thickest along the brink, thinning inland; nothing over the edge
            const x = rr(-115, 115);
            const t = Math.pow(rnd(), 1.9) * 62 + rr(0.1, 1.4);
            const bx = x, bz = edgeZ(x) + t, by = hAt(x, t) - 0.02;
            const dry = smooth(0.3, 0.75, fbm2(x * 0.06, t * 0.06, 2));
            for (let b = 0; b < PER; b++) {
                const ang = rr(0, TAU);
                const ox = Math.cos(ang) * rr(0, 0.16), oz = Math.sin(ang) * rr(0, 0.16);
                const hgt = rr(0.16, 0.40);
                const wid = rr(0.006, 0.011);
                const lean = rr(0, TAU);
                const lx = Math.cos(lean) * 0.10, lz = Math.sin(lean) * 0.10;
                const ph = rr(0, TAU);
                const base = v;
                for (let s = 0; s <= SEGS; s++) {
                    const u = s / SEGS;
                    const w = wid * (1 - Math.pow(u, 1.5) * 0.95);
                    const px = bx + ox + lx * u * u, pz = bz + oz + lz * u * u;
                    const py = by + hgt * u;
                    c.copy(cBase).lerp(cMid, smooth(0.05, 0.55, u)).lerp(cTip, smooth(0.45, 1.0, u) * (0.35 + dry * 0.75));
                    for (let k = 0; k < 2; k++) {
                        const sgn = k === 0 ? -1 : 1;
                        pos[v * 3] = px + sgn * w * Math.cos(lean + 1.5708);
                        pos[v * 3 + 1] = py;
                        pos[v * 3 + 2] = pz + sgn * w * Math.sin(lean + 1.5708);
                        top[v * 3] = c.r; top[v * 3 + 1] = c.g; top[v * 3 + 2] = c.b;
                        aH[v] = u; aPh[v] = ph;
                        v++;
                    }
                }
                for (let s = 0; s < SEGS; s++) {
                    const a = base + s * 2;
                    idx[ii++] = a; idx[ii++] = a + 1; idx[ii++] = a + 2;
                    idx[ii++] = a + 1; idx[ii++] = a + 3; idx[ii++] = a + 2;
                }
            }
        }
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        g.setAttribute('aTop', new THREE.BufferAttribute(top, 3));
        g.setAttribute('aH', new THREE.BufferAttribute(aH, 1));
        g.setAttribute('aPh', new THREE.BufferAttribute(aPh, 1));
        g.setIndex(new THREE.BufferAttribute(idx, 1));
        g.computeVertexNormals();
        const grass = new THREE.Mesh(g, grassMat);
        grass.frustumCulled = false;
        scene.add(world.ghost(grass));
    }

    /* ============================================================
       7 · the geometry kitchen — everything a bird is made of
       ============================================================ */
    // Two shapes cover a whole gull: a lamina (a flat vane on a quad grid) and
    // a loft (a tube of elliptical sections). Both write the same four
    // attributes, so any number of them go into one buffer and one shader.
    function Surf() { this.p = []; this.t = []; this.b = []; this.r = []; this.i = []; }

    Surf.prototype.lamina = function (ns, nc, fn, m, flip) {
        const base = this.p.length / 3;
        const o = { x: 0, y: 0, z: 0, top: _cA, bot: _cB, tr: 0 };
        for (let i = 0; i <= ns; i++) {
            for (let j = 0; j <= nc; j++) {
                o.top = _cA; o.bot = _cB; o.tr = 0;
                fn(i / ns, j / nc, o);
                _p.set(o.x, o.y, o.z);
                if (m) _p.applyMatrix4(m);
                this.p.push(_p.x, _p.y, _p.z);
                this.t.push(o.top.r, o.top.g, o.top.b);
                this.b.push(o.bot.r, o.bot.g, o.bot.b);
                this.r.push(o.tr);
            }
        }
        for (let i = 0; i < ns; i++) {
            for (let j = 0; j < nc; j++) {
                const a = base + i * (nc + 1) + j, b = a + nc + 1;
                if (flip) this.i.push(a, a + 1, b, a + 1, b + 1, b);
                else this.i.push(a, b, a + 1, a + 1, b, b + 1);
            }
        }
        return this;
    };

    Surf.prototype.loft = function (nt, nr, fn, colFn, m) {
        const base = this.p.length / 3;
        const s = { x: 0, y: 0, z: 0, w: 0, hu: 0, hd: 0 };
        const o = { top: _cA, bot: _cB, tr: 0 };
        for (let i = 0; i <= nt; i++) {
            const t = i / nt;
            fn(t, s);
            for (let k = 0; k < nr; k++) {
                const a = (k / nr) * TAU, ca = Math.cos(a), sa = Math.sin(a);
                const hh = sa >= 0 ? s.hu : s.hd;
                _p.set(s.x + s.w * ca, s.y + hh * sa, s.z);
                if (m) _p.applyMatrix4(m);
                this.p.push(_p.x, _p.y, _p.z);
                o.top = _cA; o.bot = _cB; o.tr = 0;
                colFn(t, ca, sa, o);
                this.t.push(o.top.r, o.top.g, o.top.b);
                this.b.push(o.bot.r, o.bot.g, o.bot.b);
                this.r.push(o.tr);
            }
        }
        for (let i = 0; i < nt; i++) {
            for (let k = 0; k < nr; k++) {
                const a = base + i * nr + k, a2 = base + i * nr + ((k + 1) % nr);
                this.i.push(a, a2, a + nr, a2, a2 + nr, a + nr);
            }
        }
        return this;
    };

    Surf.prototype.geo = function () {
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(this.p), 3));
        g.setAttribute('aTop', new THREE.BufferAttribute(new Float32Array(this.t), 3));
        g.setAttribute('aBot', new THREE.BufferAttribute(new Float32Array(this.b), 3));
        g.setAttribute('aTrans', new THREE.BufferAttribute(new Float32Array(this.r), 1));
        g.setIndex(new THREE.BufferAttribute(new Uint16Array(this.i), 1));
        g.computeVertexNormals();
        return g;
    };

    function mirrorGeo(src) {
        const g = src.clone();
        const p = g.attributes.position;
        for (let i = 0; i < p.count; i++) p.setX(i, -p.getX(i));
        const idx = g.index.array;
        for (let i = 0; i < idx.length; i += 3) { const t = idx[i + 1]; idx[i + 1] = idx[i + 2]; idx[i + 2] = t; }
        g.index.needsUpdate = true;
        p.needsUpdate = true;
        g.computeVertexNormals();
        return g;
    }

    // Interpolate a hand-written profile table.
    function profile(P, t, out) {
        let i = 1;
        while (i < P.length - 1 && P[i][0] < t) i++;
        const a = P[i - 1], b = P[i];
        const u = clamp((t - a[0]) / (b[0] - a[0] || 1), 0, 1);
        out.w = lerp(a[1], b[1], u);
        out.hu = lerp(a[2], b[2], u);
        out.hd = lerp(a[3], b[3], u);
        out.y = lerp(a[4], b[4], u);
        return out;
    }

    const birdU = litU({});
    const birdSolidMat = new THREE.ShaderMaterial({
        uniforms: birdU, side: THREE.FrontSide,
        vertexShader: LIT_GLSL + /* glsl */`
          attribute vec3 aTop; attribute vec3 aBot; attribute float aTrans;
          varying vec3 vN; varying vec3 vW; varying vec3 vT; varying vec3 vB; varying float vR;
          void main(){
            vec4 wp = modelMatrix * vec4(position, 1.0);
            vW = wp.xyz;
            vN = normalize(mat3(modelMatrix) * normal);
            vT = aTop; vB = aBot; vR = aTrans;
            gl_Position = projectionMatrix * viewMatrix * wp;
          }`,
        fragmentShader: LIT_GLSL + /* glsl */`
          varying vec3 vN; varying vec3 vW; varying vec3 vT; varying vec3 vB; varying float vR;
          void main(){
            vec3 N = normalize(vN);
            vec3 base = vT;
            if (!gl_FrontFacing) { N = -N; base = vB; }
            vec3 col = litSurface(N, vW, base, vR, 0.42, 0.13);
            gl_FragColor = vec4(applyFog(col, vW), 1.0);
          }`,
    });
    const birdVaneMat = birdSolidMat.clone();
    birdVaneMat.uniforms = birdU;
    birdVaneMat.side = THREE.DoubleSide;

    /* ---------- plumage ---------- */
    const PLUMAGE = {
        adult: {
            white: srgb(0xf4f7f6), shade: srgb(0xd7e0e4), mantle: srgb(0xa9b8c3), mantleDk: srgb(0x8b9ba8),
            black: srgb(0x24272b), bill: srgb(0xd4342a), billTip: srgb(0x9d251d), leg: srgb(0xd2453a),
            nape: srgb(0xeef2f2), underWing: srgb(0xe6ecee),
        },
        juvenile: {
            white: srgb(0xe9e7de), shade: srgb(0xcfc9b8), mantle: srgb(0x9a8768), mantleDk: srgb(0x74624a),
            black: srgb(0x3a332a), bill: srgb(0x6c5a44), billTip: srgb(0x413428), leg: srgb(0x7d6a52),
            nape: srgb(0xdcd6c6), underWing: srgb(0xdad4c6),
        },
    };

    /* ---------- body ---------- */
    const BODY_P = [
        [0.00, 0.000, 0.000, 0.000, 0.030],
        [0.07, 0.020, 0.021, 0.017, 0.026],
        [0.20, 0.039, 0.041, 0.035, 0.013],
        [0.36, 0.052, 0.056, 0.053, 0.004],
        [0.52, 0.057, 0.059, 0.063, 0.000],
        [0.68, 0.055, 0.057, 0.058, 0.005],
        [0.82, 0.047, 0.049, 0.045, 0.016],
        [0.93, 0.036, 0.038, 0.032, 0.030],
        [1.00, 0.008, 0.010, 0.008, 0.042],
    ];
    function bodyGeometry(P) {
        const s = new Surf();
        const tmp = { w: 0, hu: 0, hd: 0, y: 0 };
        s.loft(22, 18,
            (t, o) => { profile(BODY_P, t, tmp); o.x = 0; o.y = tmp.y; o.z = lerp(-0.135, 0.108, t); o.w = tmp.w; o.hu = tmp.hu; o.hd = tmp.hd; },
            (t, ca, sa, o) => {
                const mant = smooth(0.20, 0.40, t) * (1 - smooth(0.80, 0.96, t)) * smooth(0.12, 0.60, sa);
                o.top = _cA.copy(P.white).lerp(P.mantle, mant);
                if (P === PLUMAGE.juvenile) o.top.lerp(P.mantleDk, mant * (0.4 + 0.6 * vnoise(t * 26, ca * 9)));
                o.top.lerp(P.shade, smooth(0.2, -0.9, sa) * 0.35);
                o.bot = _cB.copy(o.top);
                o.tr = 0.05;
            });
        // scapulars, lying over the wing root so the shoulder never shows a seam
        for (const sgn of [-1, 1]) {
            _m4.makeRotationY(sgn > 0 ? -0.30 : 0.30);
            _m4.setPosition(sgn * 0.028, 0.043, 0.052);
            s.lamina(5, 4, (u, c, o) => {
                o.x = sgn * u * 0.055;
                o.z = -c * lerp(0.085, 0.060, u);
                o.y = -u * u * 0.026 + Math.sin(c * Math.PI) * 0.006;
                o.top = _cA.copy(P.mantle).lerp(P.white, smooth(0.75, 1.0, c) * 0.8);
                o.bot = _cB.copy(P.white);
                o.tr = 0.25 * c;
            }, _m4, sgn < 0);
        }
        return s.geo();
    }

    /* ---------- neck / head / bill / eyes ---------- */
    const NECK_P = [
        [0.00, 0.036, 0.036, 0.034, 0.000],
        [0.45, 0.033, 0.034, 0.031, 0.024],
        [1.00, 0.028, 0.029, 0.026, 0.050],
    ];
    function neckGeometry(P) {
        const s = new Surf();
        const tmp = { w: 0, hu: 0, hd: 0, y: 0 };
        s.loft(7, 16,
            (t, o) => { profile(NECK_P, t, tmp); o.x = 0; o.y = tmp.y; o.z = t * 0.055; o.w = tmp.w; o.hu = tmp.hu; o.hd = tmp.hd; },
            (t, ca, sa, o) => {
                o.top = _cA.copy(P.white).lerp(P.nape, smooth(-0.2, 0.9, sa) * 0.7);
                o.bot = _cB.copy(o.top); o.tr = 0.05;
            });
        return s.geo();
    }

    const HEAD_R = { x: 0.0300, y: 0.0320, z: 0.0400 };
    function headLoft(s, P) {
        s.loft(14, 16,
            (t, o) => {
                const k = Math.sin(Math.PI * t);
                o.x = 0; o.z = -HEAD_R.z * Math.cos(Math.PI * t);
                o.w = HEAD_R.x * k;
                o.hu = HEAD_R.y * k * (1 - 0.10 * smooth(0.45, 1.0, t));      // flatter crown forward
                o.hd = HEAD_R.y * k * (1 - 0.12 * smooth(0.55, 0.0, t));
                o.y = 0.0035 * Math.sin(Math.PI * t) * (1 - t);               // fuller nape
            },
            (t, ca, sa, o) => {
                o.top = _cA.copy(P.white);
                if (P === PLUMAGE.juvenile) o.top.lerp(P.mantleDk, 0.35 * vnoise(t * 22, ca * 11 + sa * 5) * smooth(0.1, 0.5, t));
                o.top.lerp(P.nape, smooth(0.35, -0.6, sa) * 0.4);
                o.bot = _cB.copy(o.top); o.tr = 0.04;
            });
    }
    function headGeometry(P, withBill) {
        const s = new Surf();
        headLoft(s, P);
        if (withBill) { billLoft(s, P, true, 0); billLoft(s, P, false, 0); }
        return s.geo();
    }

    // Laterally compressed, culmen dropping to the tip, gonys bulging under.
    function billLoft(s, P, upper, yOff) {
        const L = 0.052;
        s.loft(12, 12,
            (t, o) => {
                const close = 1 - smooth(0.90, 1.0, t);
                o.z = 0.034 + t * L;
                o.y = yOff - 0.004 - 0.0042 * Math.pow(t, 2.5);
                o.w = 0.0082 * (1 - 0.70 * t * t) * close;
                if (upper) {
                    o.hu = 0.0074 * (1 - 0.50 * t * t) * close;
                    o.hd = -0.0004;
                } else {
                    const gonys = 0.0034 * Math.pow(Math.max(0, 1 - Math.abs(t - 0.62) / 0.30), 1.6);
                    o.hu = -0.0004;
                    o.hd = (0.0066 * (1 - 0.45 * t * t) + gonys) * close;
                }
            },
            (t, ca, sa, o) => {
                o.top = _cA.copy(P.bill).lerp(P.billTip, smooth(0.62, 1.0, t) * 0.75);
                o.top.lerp(P.white, smooth(0.10, 0.0, t) * 0.35);
                o.bot = _cB.copy(o.top); o.tr = 0.12 * smooth(0.4, 1.0, t);
            });
    }
    function billGeometry(P, upper) {
        const s = new Surf();
        billLoft(s, P, upper, 0);
        const g = s.geo();
        // the lower mandible swings on the gape, so its buffer is moved to put
        // the origin exactly where the two mandibles meet
        if (!upper) g.translate(0, 0.004, -0.034);
        return g;
    }

    // A white iris with a black pupil and a red orbital ring, painted into the
    // vertices of a small sphere. Both eyes in one buffer so a blink is one scale.
    function eyesGeometry(P) {
        const s = new Surf();
        const R = 0.0072;
        const IRIS = P === PLUMAGE.juvenile ? srgb(0x6b6252) : srgb(0xf2f4f0);
        const PUP = srgb(0x101215), RING = P === PLUMAGE.juvenile ? srgb(0x6b5a45) : srgb(0xc42f24);
        for (const sgn of [-1, 1]) {
            s.loft(10, 14,
                (t, o) => {
                    const k = Math.sin(Math.PI * t);
                    o.x = sgn * 0.0196; o.z = -R * Math.cos(Math.PI * t); o.y = 0;
                    o.w = R * k; o.hu = R * k; o.hd = R * k;
                },
                (t, ca, sa, o) => {
                    // how far this vertex faces outboard
                    const k = Math.sin(Math.PI * t);
                    const out = sgn * ca * k;
                    o.top = _cA.copy(IRIS);
                    o.top.lerp(RING, smooth(0.60, 0.80, out) * (1 - smooth(0.86, 0.93, out)));
                    o.top.lerp(PUP, smooth(0.93, 0.965, out));
                    o.bot = _cB.copy(o.top); o.tr = 0;
                });
        }
        return s.geo();
    }

    /* ---------- feathers ---------- */
    // One primary, lying along +x with its chord running back into -z.
    function featherLamina(s, opt, m) {
        const { len, w0, colFn } = opt;
        const shaft = opt.shaft === undefined ? 0.28 : opt.shaft;   // wing vanes are
        s.lamina(opt.ns || 9, 3, (u, c, o) => {                     // lopsided, tail vanes are not
            const W = w0 * Math.pow(Math.sin(Math.PI * Math.pow(u, 0.80)), 0.55);
            o.x = u * len;
            o.z = W * (shaft - c) * 2.0;
            o.y = -0.012 * Math.pow(u, 2.2) + Math.sin(Math.PI * c) * 0.0035 * (1 - u * 0.5);
            colFn(u, c, o);
            o.tr = 0.35 + 0.65 * smooth(0.15, 0.95, c) * (0.4 + 0.6 * u);
        }, m);
    }

    function handGeometry(P) {
        const s = new Surf();
        const N = 10;
        for (let i = 0; i < N; i++) {
            const u = i / (N - 1);
            const len = lerp(0.104, 0.186, Math.pow(u, 0.88));
            const sweep = 0.17 + u * 0.50;
            const up = 0.02 + u * 0.10;
            _m4.makeRotationY(sweep);
            _m4.multiply(new THREE.Matrix4().makeRotationZ(up));
            _m4.setPosition(0.006 + u * 0.055, 0.001 - u * 0.0015, -0.012 - u * 0.016);
            const blackAt = lerp(1.25, 0.50, smooth(0.30, 1.0, u));
            featherLamina(s, {
                len, w0: lerp(0.030, 0.019, u), ns: 11,
                colFn: (a, c, o) => {
                    o.top = _cA.copy(P.mantle).lerp(P.mantleDk, 0.25);
                    if (a > blackAt) o.top.copy(P.black);
                    if (u > 0.70 && a > 0.845 && a < 0.945) o.top.copy(P.white);      // the mirror
                    if (a > 0.975) o.top.lerp(P.white, 0.8);
                    o.bot = _cB.copy(o.top).lerp(P.underWing, 0.45);
                },
            }, _m4);
        }
        // the carpal covert patch, hiding where the quills meet the wrist
        s.lamina(4, 3, (u, c, o) => {
            o.x = u * 0.062;
            o.z = -0.004 - c * lerp(0.058, 0.040, u);
            o.y = 0.002 + Math.sin(Math.PI * c) * 0.004;
            o.top = _cA.copy(P.mantle);
            o.bot = _cB.copy(P.underWing);
            o.tr = 0.15;
        });
        return s.geo();
    }

    // The arm: leading edge forward, trailing edge scalloped by the secondaries,
    // white trailing band, camber in section. `x0..x1` is the span it covers.
    function armLamina(s, P, x0, x1, cRoot, cTip, zle0, zle1, scallop, y0, y1) {
        s.lamina(9, 7, (u, c, o) => {
            const chord = lerp(cRoot, cTip, u) * (1 + scallop * Math.sin(u * Math.PI * 2 * 6.5));
            const zle = lerp(zle0, zle1, u);
            o.x = lerp(x0, x1, u);
            o.z = zle - c * chord;
            o.y = lerp(y0, y1, u) + Math.sin(Math.pow(c, 0.55) * Math.PI) * 0.016 * (1 - 0.25 * u);
            const white = smooth(0.86, 0.99, c);
            o.top = _cA.copy(P.mantle);
            o.top.lerp(P.mantleDk, smooth(0.30, 0.02, c) * 0.55);
            o.top.lerp(P.white, Math.max(white, smooth(0.06, 0.0, c) * 0.7));
            if (P === PLUMAGE.juvenile) o.top.lerp(P.mantleDk, 0.5 * vnoise(u * 15, c * 9));
            o.bot = _cB.copy(P.underWing).lerp(P.shade, smooth(0.45, 0.95, c) * 0.5).lerp(P.white, white);
            o.tr = 0.25 + 0.75 * smooth(0.30, 1.0, c);
        });
    }

    // The joints carry no offset but their span, so the inner arm's tip chord and
    // the forearm's root chord are the same chord and the wing has no step in it.
    function armGeometry(P, detail) {
        const s = new Surf();
        armLamina(s, P, 0.0, 0.100, 0.150, 0.126, 0.055, 0.045, 0.0, 0.004, 0.000);
        if (detail < 2) armLamina(s, P, 0.100, 0.240, 0.126, 0.100, 0.045, 0.031, 0.055, 0.000, -0.004);
        return s.geo();
    }
    function forearmGeometry(P) {
        const s = new Surf();
        armLamina(s, P, 0.0, 0.140, 0.126, 0.100, 0.045, 0.031, 0.055, 0.000, -0.004);
        return s.geo();
    }

    function tailGeometry(P) {
        const s = new Surf();
        const N = 12;
        for (let i = 0; i < N; i++) {
            const u = (i / (N - 1)) * 2 - 1;                      // -1 .. 1 across the fan
            const a = u * 0.34;
            _m4.makeRotationY(Math.PI / 2 - a);                   // feathers run back into -z
            _m4.setPosition(u * 0.006, -Math.abs(u) * 0.004, 0);
            const len = lerp(0.118, 0.096, Math.abs(u));
            featherLamina(s, {
                len, w0: 0.021, ns: 7, shaft: 0.5,
                colFn: (t, c, o) => {
                    o.top = _cA.copy(P.white);
                    if (P === PLUMAGE.juvenile) {
                        o.top.lerp(P.black, smooth(0.68, 0.80, t) * (1 - smooth(0.93, 0.99, t)) * 0.9);
                    }
                    o.bot = _cB.copy(o.top);
                },
            }, _m4);
        }
        return s.geo();
    }

    function legGeometry(P) {
        const s = new Surf();
        // tarsus, straight down from the hip
        s.loft(5, 8,
            (t, o) => { o.x = 0; o.y = -t * 0.055; o.z = lerp(0, -0.004, t); const r = lerp(0.0075, 0.0048, t); o.w = r; o.hu = r; o.hd = r; },
            (t, ca, sa, o) => { o.top = _cA.copy(P.leg).lerp(P.billTip, t * 0.25); o.bot = _cB.copy(o.top); o.tr = 0.1; });
        // the webbed foot: three toes and the skin between them
        _m4.makeTranslation(0, -0.055, 0);
        s.lamina(4, 6, (u, c, o) => {
            const spread = (c - 0.5) * 2;
            const w = 0.020 * Math.sin(Math.PI * Math.pow(u, 0.7));
            o.x = spread * w * 1.5;
            o.z = u * 0.034;
            o.y = -0.001 - Math.abs(spread) * 0.002 * (1 - u);
            o.top = _cA.copy(P.leg).lerp(P.billTip, 0.15 + 0.25 * (1 - Math.abs(spread)));
            o.bot = _cB.copy(o.top);
            o.tr = 0.55 * (1 - Math.abs(spread) * 0.5);
        }, _m4);
        return s.geo();
    }

    /* ---------- the bird itself ---------- */
    const GEO_CACHE = new Map();
    function gullGeo(plumage, detail) {
        const key = plumage + detail;
        let G = GEO_CACHE.get(key);
        if (G) return G;
        const P = PLUMAGE[plumage];
        G = {
            body: bodyGeometry(P),
            neck: neckGeometry(P),
            head: headGeometry(P, detail === 0),
            billU: detail > 0 ? billGeometry(P, true) : null,
            billL: detail > 0 ? billGeometry(P, false) : null,
            eyes: detail > 0 ? eyesGeometry(P) : null,
            tail: tailGeometry(P),
            arm: armGeometry(P, detail),
            fore: detail >= 2 ? forearmGeometry(P) : null,
            hand: handGeometry(P),
            leg: detail > 0 ? legGeometry(P) : null,
        };
        G.armR = mirrorGeo(G.arm);
        G.handR = mirrorGeo(G.hand);
        if (G.fore) G.foreR = mirrorGeo(G.fore);
        GEO_CACHE.set(key, G);
        return G;
    }

    // A hand-written shader has no depth pass of its own, so the near birds are
    // handed one — otherwise a gull standing in a low sun throws no shadow.
    const birdDepthMat = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });

    function makeGull(plumage, detail) {
        const G = gullGeo(plumage, detail);
        const root = new THREE.Group();
        const b = { root, wings: [] };
        const mesh = (geo, mat) => {
            const m = new THREE.Mesh(geo, mat);
            if (detail > 0) { m.castShadow = true; m.customDepthMaterial = birdDepthMat; }
            return m;
        };

        const body = mesh(G.body, birdSolidMat);
        root.add(body);

        const tail = new THREE.Group();
        tail.position.set(0, 0.030, -0.128);
        tail.add(mesh(G.tail, birdVaneMat));
        root.add(tail);
        b.tail = tail;

        const neck = new THREE.Group();
        neck.position.set(0, 0.040, 0.078);
        neck.add(mesh(G.neck, birdSolidMat));
        root.add(neck);
        b.neck = neck;

        const head = new THREE.Group();
        head.position.set(0, 0.050, 0.056);
        head.add(mesh(G.head, birdSolidMat));
        neck.add(head);
        b.head = head;

        if (detail > 0) {
            head.add(mesh(G.billU, birdSolidMat));
            const gape = new THREE.Group();
            gape.position.set(0, -0.004, 0.034);
            gape.add(mesh(G.billL, birdSolidMat));
            head.add(gape);
            b.gape = gape;

            const eyes = mesh(G.eyes, birdSolidMat);
            eyes.castShadow = false;
            eyes.position.set(0, 0.0085, 0.0215);
            head.add(eyes);
            b.eyes = eyes;

            const legs = new THREE.Group();
            legs.position.set(0, -0.034, -0.012);
            for (const sgn of [-1, 1]) {
                const leg = mesh(G.leg, birdVaneMat);
                leg.position.x = sgn * 0.019;
                leg.rotation.y = sgn * 0.12;
                legs.add(leg);
            }
            root.add(legs);
            b.legs = legs;
        }

        for (const sgn of [1, -1]) {
            const shoulder = new THREE.Group();
            // YXZ, so that x is a twist about the wing's own span — pronation on
            // the downstroke, and the roll that lets a folded wing drape down the
            // flank instead of lying flat across the bird's back.
            shoulder.rotation.order = 'YXZ';
            shoulder.position.set(sgn * 0.044, 0.032, 0.028);
            root.add(shoulder);
            const w = { shoulder, sgn };
            const mirrored = sgn < 0;
            shoulder.add(mesh(mirrored ? G.armR : G.arm, birdVaneMat));
            let wristParent = shoulder, wx = 0.240;
            if (detail >= 2) {
                const elbow = new THREE.Group();
                elbow.position.set(sgn * 0.100, 0, 0);
                elbow.add(mesh(mirrored ? G.foreR : G.fore, birdVaneMat));
                shoulder.add(elbow);
                w.elbow = elbow;
                wristParent = elbow; wx = 0.140;
            }
            const wrist = new THREE.Group();
            wrist.position.set(sgn * wx, 0, 0);
            wrist.add(mesh(mirrored ? G.handR : G.hand, birdVaneMat));
            wristParent.add(wrist);
            w.wrist = wrist;
            b.wings.push(w);
        }
        return b;
    }

    // Every joint on a mirrored wing turns the other way; saying so once here
    // keeps every pose below written for one wing only.
    function setWing(w, sh_z, sh_y, sh_x, el_y, el_z, wr_y, wr_z) {
        const s = w.sgn;
        w.shoulder.rotation.set(sh_x * s, sh_y * s, sh_z * s);
        if (w.elbow) w.elbow.rotation.set(0, el_y * s, el_z * s);
        w.wrist.rotation.set(0, wr_y * s, wr_z * s);
    }

    /* ============================================================
       8 · where the birds are
       ============================================================ */
    const BIRD_YAW = Math.atan2(-WIND.x, -WIND.z);      // everything faces into it

    /* ---------- the one that matters ---------- */
    // Four nested frames, because attitude has to happen inside the heading or
    // a roll becomes a roll about the world and the bird swims instead of flies.
    const heroPart = new THREE.Group();
    heroPart.position.set(-0.6, hAt(-0.6, 0) + 1.9, edgeZ(-0.6) - 3.0);
    const heroAnim = new THREE.Group();                 // buffet, in metres
    const heroDir = new THREE.Group();                  // heading
    const heroAtt = new THREE.Group();                  // pitch and roll, in its own frame
    heroPart.add(heroAnim); heroAnim.add(heroDir); heroDir.add(heroAtt);
    heroDir.rotation.y = BIRD_YAW;
    const hero = makeGull('adult', 2);
    heroAtt.add(hero.root);
    scene.add(world.ghost(world.part('gull_00', heroPart)));

    /* ---------- three more, out over the stacks ---------- */
    const flyers = [];
    const FLY = [
        { c: [-44, TOP + 6, -66], r: 21, per: 27, ph: 0.0, tilt: 0.10 },
        { c: [26, TOP - 9, -92], r: 30, per: 36, ph: 2.1, tilt: -0.07 },
        { c: [-16, TOP + 21, -128], r: 38, per: 44, ph: 4.0, tilt: 0.05 },
    ];
    FLY.forEach((f, i) => {
        const part = new THREE.Group();
        part.position.set(f.c[0], f.c[1], f.c[2]);
        const anim = new THREE.Group();
        part.add(anim);
        const g = makeGull(i === 1 ? 'juvenile' : 'adult', 0);
        anim.add(g.root);
        scene.add(world.ghost(world.part('gull_0' + (i + 1), part)));
        flyers.push({ f, anim, g, phase: f.ph, flap: rr(0, 6), next: rr(3, 9) });
    });

    /* ---------- two standing, one on a stack and one on the fence ---------- */
    const perched = [];
    // Folded, properly: humerus back, forearm folded forward against it, hand
    // back again over the tail. Two hinges of nearly half a turn each — which is
    // the only reason the perched birds carry an elbow they never fly with.
    const FOLD = [-0.05, 1.50, -1.35, -3.05, 0.10, 3.02, -0.15];
    function perch(name, x, y, z, yaw, plumage) {
        const part = new THREE.Group();
        part.position.set(x, y, z);
        const anim = new THREE.Group();
        anim.rotation.y = yaw;
        part.add(anim);
        const g = makeGull(plumage, 2);
        g.root.position.y = 0.090;                       // stand it on its feet
        g.root.rotation.x = -0.14;                       // and up on its breast
        anim.add(g.root);
        scene.add(world.ghost(world.part(name, part)));
        for (const w of g.wings) setWing(w, FOLD[0], FOLD[1], FOLD[2], FOLD[3], FOLD[4], FOLD[5], FOLD[6]);
        g.neck.rotation.x = -0.30;
        perched.push({ g, anim, t: rr(0, 5), next: rr(2, 6), yaw, blink: rr(1, 4) });
        return g;
    }

    /* ============================================================
       9 · what a person finds on the clifftop
       ============================================================ */
    const woodMat = new THREE.MeshStandardMaterial({ color: srgb(0x8e8574), roughness: 0.95 });
    const wireMat = new THREE.MeshStandardMaterial({ color: srgb(0x5b5c58), roughness: 0.6, metalness: 0.5 });

    // A fence that gave up some time ago: posts along the brink, two sagging wires.
    const POSTS = [];
    {
        const N = 13;
        const pg = new THREE.CylinderGeometry(0.055, 0.070, 1.25, 7);
        pg.translate(0, 0.5, 0);
        const inst = new THREE.InstancedMesh(pg, woodMat, N);
        const d = new THREE.Object3D();
        for (let i = 0; i < N; i++) {
            const x = -30 + i * 5.2 + rr(-0.5, 0.5);
            const t = 2.6 + rr(-0.5, 0.9);
            const y = hAt(x, t);
            d.position.set(x, y - 0.15, edgeZ(x) + t);
            d.rotation.set(rr(-0.12, 0.12), rr(0, 3), rr(-0.16, 0.16));
            d.scale.set(1, rr(0.85, 1.15), 1);
            d.updateMatrix();
            inst.setMatrixAt(i, d.matrix);
            POSTS.push({ x, t, y, top: y - 0.15 + 1.25 * d.scale.y * 0.98, z: edgeZ(x) + t });
        }
        inst.castShadow = true;
        inst.receiveShadow = true;
        inst.instanceMatrix.needsUpdate = true;
        scene.add(inst);

        for (let k = 0; k < 2; k++) {
            const pts = [];
            for (let i = 0; i < POSTS.length; i++) {
                const p = POSTS[i];
                pts.push(new THREE.Vector3(p.x, p.top - 0.18 - k * 0.42, p.z));
                if (i < POSTS.length - 1) {
                    const q = POSTS[i + 1];
                    pts.push(new THREE.Vector3((p.x + q.x) / 2, (p.top + q.top) / 2 - 0.42 - k * 0.44, (p.z + q.z) / 2));
                }
            }
            const curve = new THREE.CatmullRomCurve3(pts);
            const wire = new THREE.Mesh(new THREE.TubeGeometry(curve, 140, 0.010, 5, false), wireMat);
            scene.add(wire);
        }
    }

    // The post at the brink is the one with a bird on it.
    {
        const px = 5.4, pt = 1.4;
        const py = hAt(px, pt);
        const post = new THREE.Group();
        post.position.set(px, py - 0.2, edgeZ(px) + pt);
        post.rotation.z = 0.09;
        post.rotation.x = -0.05;
        const m = new THREE.Mesh(new THREE.CylinderGeometry(0.070, 0.090, 1.55, 8), woodMat);
        m.position.y = 0.775;
        m.castShadow = true; m.receiveShadow = true;
        post.add(m);
        scene.add(world.part('post_00', post));
        perch('gull_04', px + 0.06, py + 1.34, edgeZ(px) + pt + 0.02, BIRD_YAW + 0.55, 'adult');
    }
    perch('gull_05', STACKS[0].x + 1.4, STACKS[0].h + 0.02, STACKS[0].z - 1.1, BIRD_YAW - 0.35, 'juvenile');

    // Somebody moulted. Nobody is coming back for it.
    let driftFeather;
    {
        const P = PLUMAGE.adult;
        const s = new Surf();
        _m4.identity();
        featherLamina(s, {
            len: 0.185, w0: 0.030, ns: 11,
            colFn: (u, c, o) => {
                o.top = _cA.copy(P.mantle).lerp(P.white, 0.35);
                if (u > 0.62) o.top.lerp(P.black, smooth(0.62, 0.82, u));
                if (u > 0.86 && u < 0.95) o.top.copy(P.white);
                o.bot = _cB.copy(o.top).lerp(P.underWing, 0.4);
            },
        }, _m4);
        const featherGeo = s.geo();

        const lying = new THREE.Mesh(featherGeo, birdVaneMat);
        const fx = 1.9, ft = 3.4;
        lying.position.set(fx, hAt(fx, ft) + 0.035, edgeZ(fx) + ft);
        lying.rotation.set(-0.25, 2.4, 0.35);
        lying.scale.setScalar(1.35);
        scene.add(world.ghost(world.part('feather_00', lying)));

        // and one still coming down, taking its time about it
        const drift = new THREE.Mesh(featherGeo, birdVaneMat);
        drift.scale.setScalar(1.3);
        drift.userData.u = 0;
        scene.add(world.ghost(drift));
        driftFeather = drift;
    }

    camera.position.set(1.2, hAt(1.2, 5.3) + 1.7, edgeZ(1.2) + 5.3);

    /* ============================================================
       10 · what moves
       ============================================================ */
    const HOLD = { sh_z: 0.155, sh_y: -0.06, sh_x: 0.10, el_y: -0.20, el_z: 0.06, wr_y: -0.16, wr_z: 0.10 };

    const hs = {                                        // hero state
        flap: -1, flaps: 0, hold: 0, next: 2.6,
        call: -1, nextCall: 7.5,
        look: -1, nextLook: 5.0,
        blink: -1, nextBlink: 3.2,
        drop: 0,
    };
    const _look = new THREE.Vector3();

    world.frame((dt, t) => {
        LIT_U.uTime.value = t;
        LIT_U.uCamPos.value.copy(camera.position);

        /* --- sea, sky, spray --- */
        for (const sp of clouds) {
            sp.position.x += WIND.x * sp.userData.spd * dt;
            sp.position.z += WIND.z * sp.userData.spd * dt;
            if (sp.position.z > 5400) { sp.position.z -= 9000; sp.position.x -= 5200; }
            if (sp.position.x > 5400) sp.position.x -= 9000;
        }
        for (const sp of spray) {
            const u = sp.userData;
            u.u += dt * u.spd;
            if (u.u > 1) u.u -= 1;
            const e = u.u;
            const rise = Math.pow(e, 0.62);
            sp.position.set(
                u.x + WIND.x * rise * 9 + Math.sin(e * 9 + u.rise) * 0.8,
                -1 + rise * u.rise,
                u.z + WIND.z * rise * 9
            );
            const k = u.sz * (0.45 + rise * 1.5);
            sp.scale.set(k, k, 1);
            sp.material.opacity = Math.sin(Math.PI * Math.min(1, e * 1.12)) * 0.42 * (0.5 + 0.5 * Math.sin(t * 0.7 + u.rise));
        }

        /* --- the gust, which everything obeys --- */
        const gust = 0.62 + 0.30 * Math.sin(t * 0.37) + 0.20 * Math.sin(t * 0.91 + 1.7) + 0.13 * Math.sin(t * 2.29 + 0.4);

        /* --- the hero --- */
        if (hs.flap < 0) {
            hs.hold += dt;
            if (hs.hold > hs.next) { hs.flap = 0; hs.flaps = 2 + Math.floor(rnd() * 2.4); hs.hold = 0; hs.next = 3.0 + rnd() * 5.0; }
        } else {
            hs.flap += dt * 2.35;
            if (hs.flap > hs.flaps) hs.flap = -1;
        }

        const flapping = hs.flap >= 0;
        let lift = 0;
        if (flapping) {
            const env = Math.min(1, Math.min(hs.flap, hs.flaps - hs.flap) * 3.2);
            const ph = hs.flap * TAU;
            const a = Math.sin(ph);
            const down = Math.max(0, -a);
            const sh_z = HOLD.sh_z + (0.72 * a - 0.10) * env;
            const sh_x = HOLD.sh_x + 0.30 * Math.cos(ph) * env;
            const el_y = HOLD.el_y - (0.34 * down) * env;
            const wr_y = HOLD.wr_y - (0.30 + 0.42 * Math.sin(ph - 0.75)) * env;
            const wr_z = HOLD.wr_z + (0.55 * Math.sin(ph - 0.5)) * env;
            for (const w of hero.wings) setWing(w, sh_z, HOLD.sh_y, sh_x, el_y, HOLD.el_z, wr_y, wr_z);
            lift = 0.10 * Math.sin(ph - 0.9) * env;
        } else {
            const buf = Math.sin(t * 5.3) * 0.035 + Math.sin(t * 8.9 + 1.2) * 0.018;
            const sh_z = HOLD.sh_z + buf * gust + 0.05 * Math.sin(t * 0.83);
            const sh_x = HOLD.sh_x + 0.06 * Math.sin(t * 1.13 + 0.6) * gust;
            const wr_y = HOLD.wr_y + 0.10 * Math.sin(t * 1.9 + 2.0) * gust;
            const wr_z = HOLD.wr_z + Math.sin(t * 6.7 + 0.9) * 0.075 * gust;
            for (const w of hero.wings) setWing(w, sh_z, HOLD.sh_y, sh_x, HOLD.el_y, HOLD.el_z, wr_y, wr_z);
        }

        const bob = 0.15 * Math.sin(t * 1.31) + 0.085 * Math.sin(t * 2.17 + 1.2) + 0.045 * Math.sin(t * 3.71 + 0.3);
        const surge = 0.10 * Math.sin(t * 0.83 + 0.5) + 0.055 * Math.sin(t * 1.93 + 2.2);
        const sway = 0.075 * Math.sin(t * 0.67 + 2.0) + 0.03 * Math.sin(t * 1.7);
        heroAnim.position.set(sway * gust, bob * gust + lift, surge * gust);

        // nose up, because that is what holding station in a headwind costs
        const pitch = -0.10 + 0.055 * Math.sin(t * 1.17 + 0.4) * gust + (flapping ? 0.06 * Math.sin(hs.flap * TAU) : 0);
        const roll = 0.135 * Math.sin(t * 0.90 + 1.1) * gust + 0.065 * Math.sin(t * 2.31);
        const yaw = 0.095 * Math.sin(t * 0.71 + 0.9) * gust;
        heroDir.rotation.y = BIRD_YAW + yaw;
        heroAtt.rotation.x = pitch;
        heroAtt.rotation.z = roll;

        // The head does not go with it. That is the whole bird.
        hero.neck.rotation.x = -0.10 - pitch * 0.88;
        hero.neck.rotation.z = -roll * 0.45;

        hs.nextLook -= dt;
        if (hs.look < 0 && hs.nextLook <= 0) { hs.look = 0; hs.nextLook = 6 + rnd() * 9; }
        let hy = 0.12 * Math.sin(t * 0.53) + 0.22 * Math.sin(t * 0.19 + 1.4);
        let hp = 0;
        if (hs.look >= 0) {
            hs.look += dt;
            if (hs.look > 3.4) hs.look = -1;
            else {
                _look.copy(camera.position);
                hero.neck.updateWorldMatrix(true, false);
                hero.neck.worldToLocal(_look);
                _look.y -= hero.head.position.y;
                _look.z -= hero.head.position.z;
                const wantY = clamp(Math.atan2(_look.x, _look.z), -1.35, 1.35);
                const wantP = clamp(-Math.atan2(_look.y, Math.hypot(_look.x, _look.z)), -0.5, 0.5);
                const k = smooth(0, 0.55, hs.look) * (1 - smooth(2.9, 3.4, hs.look));
                hy = lerp(hy, wantY, k);
                hp = wantP * k;
            }
        }
        hero.head.rotation.y = hy - yaw * 0.85;
        hero.head.rotation.z = -roll * 0.55;
        hero.head.rotation.x = hp - pitch * 0.10;

        // calling: three shoves of the bill, and the neck goes with them
        hs.nextCall -= dt;
        if (hs.call < 0 && hs.nextCall <= 0) { hs.call = 0; hs.nextCall = 9 + rnd() * 12; }
        let gape = 0;
        if (hs.call >= 0) {
            hs.call += dt;
            if (hs.call > 1.5) hs.call = -1;
            else {
                const p = hs.call / 1.5;
                const pulse = Math.max(0, Math.sin(p * Math.PI * 3.0)) * (1 - smooth(0.75, 1.0, p));
                gape = pulse * 0.36;
                hero.head.rotation.x -= pulse * 0.22;
                hero.neck.rotation.x -= pulse * 0.10;
            }
        }
        if (hero.gape) hero.gape.rotation.x = -gape;

        hs.nextBlink -= dt;
        if (hs.blink < 0 && hs.nextBlink <= 0) { hs.blink = 0; hs.nextBlink = 2.2 + rnd() * 5; }
        if (hs.blink >= 0) {
            hs.blink += dt;
            if (hs.blink > 0.16) { hs.blink = -1; hero.eyes.scale.y = 1; }
            else hero.eyes.scale.y = 1 - 0.9 * Math.sin(Math.PI * (hs.blink / 0.16));
        }

        // legs: mostly tucked, dropped when the lift goes soft
        hs.drop += ((gust < 0.5 ? 1 : 0) - hs.drop) * Math.min(1, dt * 1.6);
        if (hero.legs) {
            hero.legs.rotation.x = lerp(1.92, 0.30, hs.drop) + 0.06 * Math.sin(t * 3.1);
            hero.legs.position.z = lerp(-0.058, -0.012, hs.drop);
        }
        hero.tail.rotation.x = -pitch * 0.55 + 0.11 * Math.sin(t * 1.4) - hs.drop * 0.18;
        hero.tail.rotation.z = roll * 0.75;
        hero.tail.scale.x = 1 + 0.28 * hs.drop + 0.06 * Math.sin(t * 0.9);

        /* --- the others, wheeling --- */
        for (const fl of flyers) {
            const f = fl.f;
            const a = fl.phase + t * (TAU / f.per);
            const x = Math.cos(a) * f.r, z = Math.sin(a) * f.r * 0.78;
            fl.anim.position.set(x, Math.sin(a * 2 + f.ph) * 2.6 + Math.sin(t * 0.6) * 1.1, z);
            fl.anim.rotation.y = Math.atan2(-Math.sin(a), 0.78 * Math.cos(a));
            const bank = 0.42 + f.tilt + 0.10 * Math.sin(a * 2);
            fl.anim.rotation.z = -bank;
            fl.anim.rotation.x = 0.05 * Math.sin(a * 3);

            fl.next -= dt;
            if (fl.flap < 0 && fl.next <= 0) { fl.flap = 0; fl.next = 4 + rnd() * 7; }
            if (fl.flap >= 0) {
                fl.flap += dt * 2.1;
                if (fl.flap > 3) fl.flap = -1;
            }
            if (fl.flap >= 0) {
                const env = Math.min(1, Math.min(fl.flap, 3 - fl.flap) * 3.0);
                const ph = fl.flap * TAU;
                const s = Math.sin(ph);
                for (const w of fl.g.wings)
                    setWing(w, 0.13 + (0.68 * s - 0.08) * env, -0.05, 0.26 * Math.cos(ph) * env,
                        0, 0, -0.18 - (0.30 + 0.40 * Math.sin(ph - 0.75)) * env, 0.10 + 0.45 * Math.sin(ph - 0.5) * env);
            } else {
                const w1 = 0.10 + 0.05 * Math.sin(t * 1.4 + fl.phase);
                for (const w of fl.g.wings) setWing(w, w1, -0.05, 0.06, 0, 0, -0.16, 0.12);
            }
            fl.g.neck.rotation.x = -0.12;
            fl.g.head.rotation.y = 0.25 * Math.sin(t * 0.4 + fl.phase);
        }

        /* --- the two standing about --- */
        for (const p of perched) {
            p.t += dt;
            p.next -= dt;
            if (p.next <= 0) { p.next = 1.4 + rnd() * 4.5; p.tgt = (rnd() - 0.5) * 1.9; }
            const want = p.tgt || 0;
            p.g.head.rotation.y += (want - p.g.head.rotation.y) * Math.min(1, dt * 6.5);
            p.g.head.rotation.x = 0.06 * Math.sin(p.t * 2.2) - 0.04;
            p.g.neck.rotation.x = -0.30 + 0.05 * Math.sin(p.t * 1.1);
            // shoulders into the wind, tail flicking with the gusts
            p.anim.rotation.y = p.yaw + 0.05 * Math.sin(p.t * 0.5);
            p.anim.rotation.z = -0.035 * gust * Math.sin(p.t * 1.7);
            p.g.tail.rotation.x = 0.10 + 0.14 * Math.sin(p.t * 0.9) * gust;
            p.blink -= dt;
            if (p.blink <= 0) { p.blink = 2 + rnd() * 5; }
            if (p.g.eyes) p.g.eyes.scale.y = p.blink < 0.14 ? 0.16 : 1;
            const ruf = Math.max(0, Math.sin(p.t * 0.33) - 0.93) * 9;
            for (const w of p.g.wings)
                setWing(w, FOLD[0] - ruf * 0.13, FOLD[1] - ruf * 0.10, FOLD[2], FOLD[3], FOLD[4], FOLD[5], FOLD[6]);
        }

        /* --- one feather, still coming down --- */
        {
            const u = (driftFeather.userData.u += dt * 0.055) % 1;
            const fall = 1 - u;
            driftFeather.position.set(
                -6.5 + WIND.x * u * 26 + Math.sin(u * 18) * 1.5,
                TOP + 6 - u * 26,
                -13 + WIND.z * u * 26 + Math.cos(u * 14) * 1.1
            );
            driftFeather.rotation.set(Math.sin(u * 21) * 1.1, u * 13, Math.cos(u * 17) * 0.9 + fall * 0.2);
        }
    });
}
