//
//  last-tram.scene.js
//  Project27 — "Last Tram"
//
//  A light-rail platform stop in the outer east of Melbourne, close to
//  midnight, in the kind of rain that has already been falling for hours.
//
//  Everything the eye can hold is inside about forty metres: a concrete
//  platform, a green steel shelter, four cobra-head lamps throwing a pale
//  fluorescent white that the rain makes colder still, and one tram standing
//  at the stop with its interior lit the colour of a kitchen at night. Past
//  that the world stops. The rails run out under the headlight and then keep
//  going, unlit, until the fog closes over them.
//
//  What the module actually spends its effort on:
//
//    · a wet-surface shader — analytic mirror streaks for ten named light
//      sources, smeared along the camera→light axis the way a puddle does it,
//      wobbled by expanding rain rings. The platform, the asphalt path and the
//      puddles in the ballast all run it, so every lamp writes itself twice.
//    · rain as one instanced draw that wraps around the camera, billboards
//      around its own fall direction, gusts, and is lit per-drop by the same
//      ten sources — so the rain is only visible where light is.
//    · the tram's warmth is a canvas emissive map: individual windows, seat
//      backs in silhouette, water running down the glass.
//    · the service. The tram is not parked here. It comes out of the fog up
//      the line at sixty, brakes into the stop on a real deceleration, stands
//      with its doors open and its warmth lying across the wet platform, then
//      powers away toward Vermont South until the fog takes it — and for a
//      while there is nobody at all. Every reflection it writes, every shaft
//      of its headlight and the mist off its skirt travel with it.
//    · four real-time lights, total. Everything else glows.
//
//  Scale is metres. The near track is x = 0, the platform is on +x, and the
//  darkness is −z.
//

import { mergeGeometries } from './BufferGeometryUtils.js';

export default function build(world) {
    const { THREE, scene, camera } = world;

    world.ownsSky(true);
    world.groundLevel(0);
    world.bloom({ strength: 0.62, radius: 0.74, threshold: 0.58 });

    /* ============================================================
       0 · helpers
       ============================================================ */
    const srgb = (hex) => new THREE.Color(hex).convertSRGBToLinear();
    const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
    const lerp = (a, b, t) => a + (b - a) * t;
    const smoothstep = (e0, e1, x) => { const t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };

    let _seed = 20260827;
    const rnd = () => { _seed = (_seed * 1664525 + 1013904223) % 4294967296; return _seed / 4294967296; };
    const rr = (a, b) => a + (b - a) * rnd();

    const hash2 = (x, y) => { const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return n - Math.floor(n); };
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

    const tex = (w, h, draw, rx, ry) => {
        const t = world.canvasTexture(w, h, (ctx, cv) => draw(ctx, cv.width, cv.height));
        if (rx || ry) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx || 1, ry || 1); }
        return t;
    };

    const _q = new THREE.Quaternion();
    const _e = new THREE.Euler();
    const _v = new THREE.Vector3();
    const _s = new THREE.Vector3(1, 1, 1);
    const M = (x, y, z, rx, ry, rz, sx, sy, sz) => {
        _e.set(rx || 0, ry || 0, rz || 0);
        return new THREE.Matrix4().compose(
            _v.set(x, y, z), _q.setFromEuler(_e),
            _s.set(sx === undefined ? 1 : sx, sy === undefined ? 1 : sy, sz === undefined ? 1 : sz));
    };
    const put = (geo, x, y, z, rx, ry, rz) => geo.applyMatrix4(M(x, y, z, rx, ry, rz));
    const mesh = (geo, mat, x, y, z, rx, ry, rz) => {
        const m = new THREE.Mesh(geo, mat);
        m.position.set(x || 0, y || 0, z || 0);
        m.rotation.set(rx || 0, ry || 0, rz || 0);
        return m;
    };

    /* ============================================================
       1 · the plan
       ============================================================ */
    const TRK_A = 0.00;            // near track — the tram stands here
    const TRK_B = -3.35;           // the other road, empty
    const HG = 0.7175;             // half gauge
    const BALLAST_Y = 0.16;
    const RAIL_Y = 0.30;

    const PLAT_X0 = 1.55, PLAT_X1 = 5.75, PLAT_Y = 1.00;
    const PLAT_Z0 = -24.0, PLAT_Z1 = 20.0;
    const RAMP_Z1 = 28.5;

    const FENCE_W = -6.35, FENCE_E = 10.35;
    const LINE_FAR = 430;

    const TRAM_Z = -1.0;           // centre
    const TRAM_L = 16.4, TRAM_HW = 1.31;
    const TRAM_Y0 = 0.98, TRAM_Y1 = 3.30;
    const NOSE_Z = TRAM_Z - TRAM_L / 2;
    const TAIL_Z = TRAM_Z + TRAM_L / 2;
    const DOOR_U = [0.245, 0.615];                       // along the body, nose→tail
    const doorZ = (u) => NOSE_Z + (u + 0.026) * TRAM_L;  // centre of a door

    const LAMP_X = 5.30, LAMP_ARM = 1.35, LAMP_Y = 4.95;
    const LAMP_Z = [-19.0, -8.5, 7.2, 16.0];   // clear of the shelter, which sits z −0.4 … 3.4

    /* ------------------------------------------------------------
       The service.

       One tram, on a loop, in a tram's own numbers: sixty down the
       reservation, 1.85 m/s² into the stop because that is what a
       braking tram feels like from the platform, and a gentler
       1.15 m/s² out of it because a standing load does not like being
       thrown. Everything else in this world — the pitch of the body,
       the mist off the skirt, the reflection running down the wet
       concrete — is derived from these four numbers, so it all agrees.
       ------------------------------------------------------------ */
    const V_LINE = 16.6;                                    // m/s on the straight
    const A_BRAKE = 1.85, A_POWER = 1.15;
    const Z_IN = 205;                                       // where it waits, far past seeing
    const D_BRAKE = (V_LINE * V_LINE) / (2 * A_BRAKE);      // 74.5 m
    const T_BRAKE = V_LINE / A_BRAKE;                       // 8.97 s
    const T_COAST = (Z_IN - D_BRAKE) / V_LINE;              // 7.86 s
    const T_APPROACH = T_COAST + T_BRAKE;                   // 16.8 s
    const T_DWELL = 14.0;
    const T_HOLD = 1.1;                                     // doors shut, driver waiting on the interlock
    const T_POWER = V_LINE / A_POWER;                       // 14.4 s to line speed
    const T_DEPART = T_HOLD + T_POWER + 2.6;
    const D_OUT = 0.5 * A_POWER * T_POWER * T_POWER + V_LINE * 2.6;   // ~163 m by the time it is gone
    const T_GONE = 12.0;                                    // the platform to itself
    const T_CYCLE = T_APPROACH + T_DWELL + T_DEPART + T_GONE;
    // The world opens with one already coming: five seconds of a headlight
    // growing in the fog behind you, then it slides past the ramp at thirty-six
    // and stands down the platform.
    const T_START = T_APPROACH - 10.5;

    const FOG_COL = srgb(0x090c13);
    const FOG_DEN = 0.0128;
    const C_COLD = srgb(0xd6e3f6);
    const C_WARM = srgb(0xffb46a);

    scene.fog = new THREE.FogExp2(FOG_COL.clone(), FOG_DEN);
    camera.position.set(8.6, 3.1, 27.5);

    /* ------------------------------------------------------------
       The ten light sources the wet ground knows about. Only four of
       them are real lights; all ten write reflections.
       ------------------------------------------------------------ */
    const WL = [];
    const addWL = (x, y, z, col, str, rad) => WL.push({ p: new THREE.Vector3(x, y, z), c: col.clone(), s: str, r: rad });
    const LAMP_WY = PLAT_Y + LAMP_Y - 0.05;                                            // lamps stand on the deck
    for (const z of LAMP_Z) addWL(LAMP_X - LAMP_ARM, LAMP_WY, z, C_COLD, 1.15, 8.6);   // 0..3 cobra heads
    addWL(4.25, PLAT_Y + 2.56, 1.5, srgb(0xe3edfd), 0.90, 5.6);                        // 4  shelter soffit
    addWL(TRAM_HW + 0.05, 2.35, doorZ(DOOR_U[0]) - 3.2, C_WARM, 0.42, 6.4);            // 5  window band
    addWL(TRAM_HW + 0.05, 2.35, TRAM_Z + 0.6, C_WARM, 0.42, 6.4);                      // 6
    addWL(TRAM_HW + 0.05, 2.35, TAIL_Z - 3.0, C_WARM, 0.38, 6.0);                      // 7
    addWL(TRAM_HW + 0.22, 1.60, doorZ(DOOR_U[0]), srgb(0xffc98d), 1.25, 4.6);          // 8  the open door
    addWL(0.0, 1.30, NOSE_Z - 0.35, srgb(0xd9e6ff), 0.95, 7.2);                        // 9  headlights

    // Five of the ten ride with the tram. Their z here is where they sit when
    // it is standing at the stop; the frame callback slides them along.
    const RIDE = [5, 6, 7, 8, 9];
    const RIDE_Z = RIDE.map((i) => WL[i].p.z);
    const DOOR_WL = 8, DOOR_WL_S = WL[DOOR_WL].s;

    const U = {
        uTime: { value: 0 },
        uCamPos: { value: new THREE.Vector3(8.6, 3.1, 27.5) },
        uWind: { value: new THREE.Vector2(0.17, 0.05) },
        uFogCol: { value: FOG_COL.clone() },
        uFogDen: { value: FOG_DEN },
        uSkyLo: { value: srgb(0x11182a) },
        uLPos: { value: WL.map(l => l.p) },
        uLCol: { value: WL.map(l => l.c) },
        uLStr: { value: WL.map(l => l.s) },
        uLRad: { value: WL.map(l => l.r) },
    };
    const pick = (...keys) => { const o = {}; for (const k of keys) o[k] = U[k]; return o; };

    /* ============================================================
       2 · shared GLSL
       ============================================================ */
    const NL = WL.length;

    const NOISE_GLSL = /* glsl */`
      float h21(vec2 p){ p = fract(p * vec2(127.1, 311.7)); p += dot(p, p + 34.23); return fract(p.x * p.y); }
      float vn(vec2 p){
        vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
        float a = h21(i), b = h21(i + vec2(1.0, 0.0)), c = h21(i + vec2(0.0, 1.0)), d = h21(i + vec2(1.0, 1.0));
        return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
      }
      float fbm(vec2 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 4; i++){ s += a * vn(p); p *= 2.03; a *= 0.5; } return s; }
    `;

    // Rain rings. Two grids of impacts, each cell firing on its own hashed phase.
    const RIPPLE_GLSL = /* glsl */`
      float ripple(vec2 p, float t){
        float acc = 0.0;
        for (int k = 0; k < 2; k++) {
          float fk = float(k);
          float sc = 1.75 + fk * 2.7;
          vec2 q = p * sc + fk * 23.7;
          vec2 id = floor(q), f = fract(q) - 0.5;
          float ph = h21(id + fk * 7.3);
          float tt = fract(t * 1.20 + ph);
          vec2 off = (vec2(h21(id + 3.1), h21(id + 6.7)) - 0.5) * 0.58;
          float r = length(f - off);
          float rad = tt * 0.46;
          float e = (r - rad) * 24.0;
          float ring = exp(-min(e * e, 40.0)) * sin((r - rad) * 44.0 + 1.5707963);
          acc += ring * (1.0 - tt) * smoothstep(0.0, 0.10, tt) / (1.0 + fk);
        }
        return acc;
      }
    `;

    // Wet ground, analytically. For every source: a diffuse pool, and the
    // mirror image smeared along the camera→light axis. A rough wet surface
    // stretches a highlight toward the viewer; the perpendicular width grows
    // with the source's height and its distance, which is the whole look.
    const WET_GLSL = /* glsl */`
      #define NL ${NL}
      uniform vec3  uLPos[NL];
      uniform vec3  uLCol[NL];
      uniform float uLStr[NL];
      uniform float uLRad[NL];
      void wetLight(vec3 wp, vec3 cp, float rip, float gloss, out vec3 diff, out vec3 spec){
        diff = vec3(0.0); spec = vec3(0.0);
        vec2 c = cp.xz;
        float H = max(cp.y - wp.y, 0.25);
        for (int i = 0; i < NL; i++) {
          vec3  lp = uLPos[i];
          vec3  lc = uLCol[i];
          float ls = uLStr[i];
          float lr = uLRad[i];

          vec3  dv = lp - wp;
          float dd = dot(dv, dv);
          float dl = sqrt(dd) + 1e-4;
          diff += lc * (ls / (1.0 + dd / (lr * lr))) * clamp(dv.y / dl, 0.0, 1.0);

          vec2  g  = lp.xz - c;
          float gl = max(length(g), 1e-3);
          vec2  dir = g / gl;
          float h  = max(lp.y - wp.y, 0.05);
          vec2  mp = c + dir * (gl * H / (H + h));
          vec2  qv = wp.xz - mp;
          float al = dot(qv, dir);
          float pe = dot(qv, vec2(-dir.y, dir.x)) + rip * 0.55;
          // min() keeps the exponents inside mediump range on the tiles that want it
          float w  = 0.085 + 0.048 * h + 0.013 * gl;
          float lat = exp(-min((pe * pe) / (w * w), 40.0));
          float lon = al > 0.0 ? exp(-min(al / (0.55 + h * 0.30), 40.0))
                               : exp(-min(-al / (1.7 + h * 1.6), 40.0));
          spec += lc * ls * lat * lon / (1.0 + dd / (lr * lr * 18.0));
        }
        spec *= gloss;
      }
    `;

    const FOG_GLSL = /* glsl */`
      uniform vec3 uFogCol; uniform float uFogDen;
      vec3 applyFog(vec3 col, float dist){
        float f = 1.0 - exp(-(dist * uFogDen) * (dist * uFogDen));
        return mix(col, uFogCol, clamp(f, 0.0, 1.0));
      }
    `;

    const WORLD_VS = /* glsl */`
      varying vec3 vWorld;
      void main(){
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorld = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `;

    /* ============================================================
       3 · sky — overcast, lit from underneath by a city forty minutes away
       ============================================================ */
    const skyMat = new THREE.ShaderMaterial({
        side: THREE.BackSide, depthWrite: false, fog: false,
        uniforms: Object.assign(pick('uTime'), {
            uZen: { value: srgb(0x05070d) },
            uMid: { value: srgb(0x0a0e18) },
            uHor: { value: srgb(0x1a1e28) },
            uGlow: { value: srgb(0x6b4526) },
        }),
        vertexShader: `varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
        fragmentShader: NOISE_GLSL + /* glsl */`
          varying vec3 vDir;
          uniform vec3 uZen, uMid, uHor, uGlow;
          uniform float uTime;
          void main(){
            vec3 d = normalize(vDir);
            float h = clamp(d.y, -1.0, 1.0);
            vec3 col = mix(uHor, uMid, smoothstep(-0.02, 0.24, h));
            col = mix(col, uZen, smoothstep(0.14, 0.82, h));

            // low cloud, dragged slowly across, brighter where the city is
            vec2 cp = d.xz / max(abs(h) + 0.16, 0.16);
            float c1 = fbm(cp * 0.55 + vec2(uTime * 0.0075, uTime * 0.0032));
            float c2 = fbm(cp * 1.45 - vec2(uTime * 0.0052, 0.0));
            float cloud = smoothstep(0.34, 0.86, c1 * 0.7 + c2 * 0.45);

            // sodium bounce off the cloud base, strongest low and toward +z
            float city = smoothstep(0.42, -0.04, h) * smoothstep(-0.25, 0.85, d.z);
            col += uGlow * city * (0.30 + cloud * 0.85);
            col += uGlow * 0.16 * smoothstep(0.30, -0.08, h);
            col *= 0.80 + cloud * 0.30;
            gl_FragColor = vec4(col, 1.0);
          }`,
    });
    const sky = mesh(new THREE.SphereGeometry(2600, 40, 26), skyMat);
    sky.renderOrder = -20;
    scene.add(sky);
    world.ghost(sky);

    /* ============================================================
       4 · lights — four, and no more
       ============================================================ */
    scene.add(new THREE.HemisphereLight(0x1d2a44, 0x06080c, 0.80));
    scene.add(new THREE.AmbientLight(0x16203a, 0.26));

    const platLight = new THREE.PointLight(0xdbe7f9, 38, 26, 2);
    platLight.position.set(LAMP_X - LAMP_ARM, LAMP_WY, -8.5);
    scene.add(platLight);

    const platLight2 = new THREE.PointLight(0xdbe7f9, 32, 26, 2);
    platLight2.position.set(LAMP_X - LAMP_ARM, LAMP_WY, 7.2);
    scene.add(platLight2);

    /* The tram is two nested groups. `tram` is the part — what someone reaches
       out and places by hand, and where a hand placement lands. `car` is what
       the service moves along the rails inside it, so the run stays relative to
       wherever its owner left the thing. Everything that belongs to the tram —
       its lights, its headlight shafts, the mist off its skirt — hangs off
       `car` and travels for free. */
    const tram = new THREE.Group();
    const car = new THREE.Group();
    tram.add(car);

    const tramWarm = new THREE.PointLight(0xffb066, 27, 15, 2);
    tramWarm.position.set(TRAM_HW + 0.35, 1.85, doorZ(DOOR_U[0]));
    car.add(tramWarm);

    const headSpot = new THREE.SpotLight(0xe8f0ff, 620, 180, 0.215, 0.68, 1.35);
    headSpot.position.set(0, 1.30, NOSE_Z - 0.1);
    headSpot.target.position.set(0, 0.10, NOSE_Z - 140);
    car.add(headSpot, headSpot.target);

    /* ============================================================
       5 · ground — ballast, asphalt, dead verge, and the puddles between
       ============================================================ */
    function groundHeight(x, z) {
        let h = 0;
        const bed = smoothstep(2.3, 1.1, x) * smoothstep(-6.6, -5.3, x);
        h += BALLAST_Y * bed;
        if (x < FENCE_W) h += smoothstep(FENCE_W, FENCE_W - 4.0, x) * 0.55;
        if (x > FENCE_E) h += smoothstep(FENCE_E, FENCE_E + 5.0, x) * 0.70;
        if (x > 5.6 && x < FENCE_E) h += 0.11;                       // the footpath sits a little proud
        h += (fbm2(x * 0.55 + 3, z * 0.55 - 7, 3) - 0.5) * 0.055;    // where the water pools
        h += (fbm2(x * 0.13 - 9, z * 0.13 + 2, 3) - 0.5) * 0.10;
        return h;
    }

    const groundGeo = new THREE.PlaneGeometry(170, 900, 170, 300);
    groundGeo.rotateX(-Math.PI / 2);
    {
        const p = groundGeo.attributes.position;
        for (let i = 0; i < p.count; i++) p.setY(i, groundHeight(p.getX(i), p.getZ(i)));
        groundGeo.computeVertexNormals();
    }
    const groundMat = new THREE.ShaderMaterial({
        uniforms: pick('uTime', 'uCamPos', 'uFogCol', 'uFogDen', 'uSkyLo', 'uLPos', 'uLCol', 'uLStr', 'uLRad'),
        vertexShader: WORLD_VS,
        fragmentShader: NOISE_GLSL + RIPPLE_GLSL + WET_GLSL + FOG_GLSL + /* glsl */`
          uniform float uTime; uniform vec3 uCamPos, uSkyLo;
          varying vec3 vWorld;
          void main(){
            float x = vWorld.x;
            float dist = length(uCamPos - vWorld);
            float det = 1.0 - smoothstep(16.0, 70.0, dist);

            float ballast = smoothstep(1.80, 1.44, x) * smoothstep(-6.05, -5.65, x);
            float path    = smoothstep(5.62, 5.88, x) * smoothstep(10.55, 10.15, x);
            float verge   = clamp(1.0 - ballast - path, 0.0, 1.0);

            float n1 = fbm(vWorld.xz * 2.6);
            float n2 = fbm(vWorld.xz * 0.40 + 11.0);
            float n3 = fbm(vWorld.xz * 8.5 + 3.0);

            vec3 cBal = mix(vec3(0.026, 0.025, 0.024), vec3(0.082, 0.078, 0.070), smoothstep(0.34, 0.74, n3));
            cBal *= 0.65 + 0.70 * n1;
            vec3 cPath = vec3(0.021, 0.022, 0.026) * (0.70 + 0.60 * n1);
            vec3 cVerge = mix(vec3(0.010, 0.014, 0.010), vec3(0.032, 0.038, 0.022), n2) * (0.55 + 0.85 * n1);

            vec3 albedo = cBal * ballast + cPath * path + cVerge * verge;

            // where it has puddled: darker, and a mirror
            float pud = smoothstep(0.55, 0.71, fbm(vWorld.xz * 0.52 + 4.0)) * (ballast * 0.95 + verge * 0.30);
            pud += smoothstep(0.60, 0.78, fbm(vWorld.xz * 1.9 - 6.0)) * path * 0.5;
            pud = clamp(pud, 0.0, 1.0);
            albedo = mix(albedo, albedo * 0.32, pud);

            float gloss = clamp(path * 0.80 + ballast * 0.06 + pud * 1.05, 0.0, 1.0);
            float rip = ripple(vWorld.xz, uTime) * gloss * det;

            vec3 diff, spec;
            wetLight(vWorld, uCamPos, rip, gloss, diff, spec);

            vec3 col = albedo * (uSkyLo + diff);
            col += spec * (0.80 + 0.40 * n1);
            col += vec3(0.52, 0.64, 0.86) * max(rip, 0.0) * 0.055 * clamp(length(diff) * 2.6, 0.0, 1.0);

            gl_FragColor = vec4(applyFog(col, dist), 1.0);
          }`,
    });
    const ground = mesh(groundGeo, groundMat);   // geometry-local == world, so scatter can sample groundHeight
    scene.add(ground);
    world.ground(ground);

    /* ============================================================
       6 · track — rails, sleepers, ballast
       ============================================================ */
    const railWebMat = new THREE.MeshStandardMaterial({ color: srgb(0x1d1b19), roughness: 0.68, metalness: 0.55 });
    const railHeadMat = new THREE.MeshStandardMaterial({
        color: srgb(0x8e959c), roughness: 0.16, metalness: 0.94,
        emissive: srgb(0x141c28), emissiveIntensity: 0.85,
    });
    {
        const webs = [], heads = [];
        for (const c of [TRK_A, TRK_B]) {
            for (const s of [-1, 1]) {
                const x = c + s * HG;
                const foot = new THREE.BoxGeometry(0.17, 0.035, LINE_FAR * 2);
                put(foot, x, BALLAST_Y + 0.035, 0);
                const web = new THREE.BoxGeometry(0.045, 0.105, LINE_FAR * 2);
                put(web, x, BALLAST_Y + 0.10, 0);
                webs.push(foot, web);
                const head = new THREE.BoxGeometry(0.075, 0.032, LINE_FAR * 2);
                put(head, x, RAIL_Y - 0.016, 0);
                heads.push(head);
            }
        }
        const rails = mesh(mergeGeometries(webs), railWebMat);
        const railTops = mesh(mergeGeometries(heads), railHeadMat);
        scene.add(rails, railTops);
        world.ghost(railTops);
    }

    {   // concrete sleepers, both roads, out to the edge of what the fog keeps
        const sleeperGeo = new THREE.BoxGeometry(2.52, 0.19, 0.26);
        const sleeperMat = new THREE.MeshStandardMaterial({ color: srgb(0x2e2c29), roughness: 0.95 });
        const spacing = 0.63, span = 132;
        const per = Math.floor((span * 2) / spacing);
        const im = new THREE.InstancedMesh(sleeperGeo, sleeperMat, per * 2);
        const col = new THREE.Color();
        let k = 0;
        for (const c of [TRK_A, TRK_B]) {
            for (let i = 0; i < per; i++) {
                const z = -span + i * spacing;
                im.setMatrixAt(k, M(c + rr(-0.02, 0.02), BALLAST_Y - 0.04, z, rr(-0.012, 0.012), rr(-0.02, 0.02), rr(-0.012, 0.012)));
                const g = rr(0.62, 1.12);
                col.setRGB(g * 0.98, g * 0.96, g * 0.92);
                im.setColorAt(k, col);
                k++;
            }
        }
        im.instanceMatrix.needsUpdate = true;
        if (im.instanceColor) im.instanceColor.needsUpdate = true;
        scene.add(im);
        world.ghost(im);
    }

    {   // loose ballast, only where anyone will ever be close enough to see it
        const stoneGeo = new THREE.DodecahedronGeometry(0.085, 0);
        const stoneMat = new THREE.MeshStandardMaterial({ color: srgb(0x3a3833), roughness: 1.0, flatShading: true });
        const im = new THREE.InstancedMesh(stoneGeo, stoneMat, 520);
        const col = new THREE.Color();
        for (let i = 0; i < 520; i++) {
            const x = rr(-5.6, 1.4), z = rr(-70, 46);
            im.setMatrixAt(i, M(x, BALLAST_Y + rr(-0.02, 0.05), z, rr(0, 3), rr(0, 3), rr(0, 3), rr(0.6, 1.7), rr(0.5, 1.2), rr(0.6, 1.7)));
            const g = rr(0.5, 1.35); col.setRGB(g, g * 0.98, g * 0.93);
            im.setColorAt(i, col);
        }
        im.instanceMatrix.needsUpdate = true;
        if (im.instanceColor) im.instanceColor.needsUpdate = true;
        scene.add(im);
        world.ghost(im);
    }

    /* ============================================================
       7 · platform
       ============================================================ */
    const concreteMat = new THREE.MeshStandardMaterial({ color: srgb(0x6b6a66), roughness: 0.94 });
    const kerbMat = new THREE.MeshStandardMaterial({ color: srgb(0x4c4a46), roughness: 0.90 });
    const steelGreen = new THREE.MeshStandardMaterial({ color: srgb(0x1c3a30), roughness: 0.52, metalness: 0.35 });
    const steelDark = new THREE.MeshStandardMaterial({ color: srgb(0x191b1d), roughness: 0.58, metalness: 0.42 });

    const PW = PLAT_X1 - PLAT_X0, PL = PLAT_Z1 - PLAT_Z0;
    const PCX = (PLAT_X0 + PLAT_X1) / 2, PCZ = (PLAT_Z0 + PLAT_Z1) / 2;
    {
        const slab = new THREE.BoxGeometry(PW, PLAT_Y, PL);
        put(slab, PCX, PLAT_Y / 2, PCZ);
        const nose = new THREE.BoxGeometry(0.12, 0.30, PL);         // the dark nosing at the edge
        put(nose, PLAT_X0 + 0.06, PLAT_Y - 0.15, PCZ);
        scene.add(mesh(mergeGeometries([slab]), concreteMat));
        scene.add(mesh(mergeGeometries([nose]), kerbMat));
    }

    // the surface itself — the brightest thing in the world, and the wettest
    const platTopMat = new THREE.ShaderMaterial({
        uniforms: pick('uTime', 'uCamPos', 'uFogCol', 'uFogDen', 'uSkyLo', 'uLPos', 'uLCol', 'uLStr', 'uLRad'),
        vertexShader: WORLD_VS,
        fragmentShader: NOISE_GLSL + RIPPLE_GLSL + WET_GLSL + FOG_GLSL + /* glsl */`
          uniform float uTime; uniform vec3 uCamPos, uSkyLo;
          varying vec3 vWorld;
          void main(){
            float x = vWorld.x, z = vWorld.z;
            float dist = length(uCamPos - vWorld);
            float det = 1.0 - smoothstep(14.0, 55.0, dist);

            float n1 = fbm(vWorld.xz * 3.4);
            float n2 = fbm(vWorld.xz * 0.75 + 5.0);

            // poured concrete, panel joints every three metres
            vec3 col0 = mix(vec3(0.115, 0.113, 0.106), vec3(0.185, 0.183, 0.175), n1);
            col0 *= 0.86 + 0.26 * n2;
            float jz = abs(fract(z / 3.0) - 0.5) * 2.0;
            float jx = abs(fract((x - ${PLAT_X0.toFixed(2)}) / 2.1) - 0.5) * 2.0;
            float joint = smoothstep(0.94, 1.0, jz) + smoothstep(0.96, 1.0, jx);
            col0 *= 1.0 - clamp(joint, 0.0, 1.0) * 0.45;

            // the yellow line, and the tactile studs inside it
            float yb = smoothstep(1.60, 1.65, x) * smoothstep(2.09, 2.04, x);
            vec2 sg = vec2((x - 1.66) / 0.088, z / 0.088);
            vec2 sf = fract(sg) - 0.5;
            float stud = 1.0 - smoothstep(0.20, 0.34, length(sf));
            vec3 yellow = mix(vec3(0.235, 0.170, 0.020), vec3(0.330, 0.245, 0.030), stud * 0.8 + n1 * 0.3);
            yellow *= 0.78 + 0.30 * n2;
            vec3 albedo = mix(col0, yellow, yb * (0.86 - 0.20 * smoothstep(0.6, 0.0, n2)));

            // gutter along the edge holds water; the rest is just slick
            float wetEdge = smoothstep(3.3, 1.7, x) * 0.55;
            float pud = smoothstep(0.58, 0.74, fbm(vWorld.xz * 0.85 - 2.0)) * 0.7 + wetEdge;
            float gloss = clamp(0.52 + pud * 0.65, 0.0, 1.0);
            albedo = mix(albedo, albedo * 0.46, clamp(pud, 0.0, 1.0));

            float rip = ripple(vWorld.xz, uTime) * gloss * det;

            vec3 diff, spec;
            wetLight(vWorld, uCamPos, rip, gloss, diff, spec);

            vec3 col = albedo * (uSkyLo + diff);
            col += spec * (0.85 + 0.30 * n1);
            col += vec3(0.55, 0.66, 0.88) * max(rip, 0.0) * 0.075 * clamp(length(diff) * 2.2, 0.0, 1.0);

            gl_FragColor = vec4(applyFog(col, dist), 1.0);
          }`,
    });
    {
        const g = new THREE.PlaneGeometry(PW - 0.12, PL, 20, 90);
        g.rotateX(-Math.PI / 2);
        const top = mesh(g, platTopMat, PCX + 0.06, PLAT_Y + 0.006, PCZ);
        scene.add(top);
        world.ghost(top);   // the slab underneath is what anyone stands on
    }

    {   // the ramp up from the crossing at the far end — a triangular prism,
        // wound so the walkable slope faces the sky
        const rampGeo = new THREE.BufferGeometry();
        const w = 3.1, z0 = PLAT_Z1, z1 = RAMP_Z1, y1 = PLAT_Y;
        const x0 = PCX - w / 2, x1 = PCX + w / 2;
        const V = [
            // slope
            x0, y1, z0, x1, 0.02, z1, x1, y1, z0,
            x0, y1, z0, x0, 0.02, z1, x1, 0.02, z1,
            // cheeks
            x0, y1, z0, x0, 0.0, z0, x0, 0.02, z1,
            x0, 0.02, z1, x0, 0.0, z0, x0, 0.0, z1,
            x1, y1, z0, x1, 0.02, z1, x1, 0.0, z0,
            x1, 0.02, z1, x1, 0.0, z1, x1, 0.0, z0,
        ];
        rampGeo.setAttribute('position', new THREE.Float32BufferAttribute(V, 3));
        rampGeo.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array((V.length / 3) * 2), 2));
        rampGeo.computeVertexNormals();
        const rampMat = concreteMat.clone(); rampMat.side = THREE.DoubleSide;
        scene.add(mesh(rampGeo, rampMat));

        // pipe handrail along both sides of the ramp
        const rails = [];
        for (const sx of [x0 + 0.08, x1 - 0.08]) {
            for (let i = 0; i <= 6; i++) {
                const t = i / 6;
                const z = lerp(z0, z1, t), y = lerp(y1, 0.02, t);
                const post = new THREE.CylinderGeometry(0.035, 0.035, 0.98, 8);
                put(post, sx, y + 0.49, z);
                rails.push(post);
            }
            const len = Math.hypot(z1 - z0, y1 - 0.02);
            const tilt = Math.PI / 2 + Math.atan2(y1 - 0.02, z1 - z0);   // falls away with +z, like the slope
            const top = new THREE.CylinderGeometry(0.042, 0.042, len, 8);
            put(top, sx, (y1 + 0.02) / 2 + 0.95, (z0 + z1) / 2, tilt, 0, 0);
            const mid = new THREE.CylinderGeometry(0.030, 0.030, len, 6);
            put(mid, sx, (y1 + 0.02) / 2 + 0.52, (z0 + z1) / 2, tilt, 0, 0);
            rails.push(top, mid);
        }
        scene.add(mesh(mergeGeometries(rails), steelGreen));
    }

    /* ============================================================
       8 · lamps — the pale white the request asked for
       ============================================================ */
    const lensMat = new THREE.MeshStandardMaterial({
        color: srgb(0xf2f7ff), emissive: srgb(0xd8e6ff), emissiveIntensity: 3.4, roughness: 0.35,
    });
    {
        const bodies = [], lenses = [];
        for (const z of LAMP_Z) {
            const pole = new THREE.CylinderGeometry(0.068, 0.092, 5.0, 10);
            put(pole, LAMP_X, 2.5, z);
            const base = new THREE.CylinderGeometry(0.125, 0.15, 0.34, 10);
            put(base, LAMP_X, 0.17, z);                                   // geometry is deck-local
            const arm = new THREE.CylinderGeometry(0.048, 0.056, LAMP_ARM + 0.12, 8);
            arm.rotateZ(Math.PI / 2);
            put(arm, LAMP_X - (LAMP_ARM + 0.12) / 2, LAMP_Y + 0.06, z);
            const head = new THREE.BoxGeometry(0.56, 0.15, 0.28);
            put(head, LAMP_X - LAMP_ARM, LAMP_Y + 0.04, z);
            const cowl = new THREE.BoxGeometry(0.62, 0.05, 0.32);
            put(cowl, LAMP_X - LAMP_ARM, LAMP_Y + 0.115, z);
            bodies.push(pole, base, arm, head, cowl);

            const lens = new THREE.BoxGeometry(0.44, 0.045, 0.21);
            put(lens, LAMP_X - LAMP_ARM, LAMP_Y - 0.035, z);
            lenses.push(lens);
        }
        // the poles stand on the platform, so lift the bases to the deck
        scene.add(mesh(mergeGeometries(bodies), steelGreen, 0, PLAT_Y, 0));
        const lensMesh = mesh(mergeGeometries(lenses), lensMat, 0, PLAT_Y, 0);
        scene.add(lensMesh);
        world.ghost(lensMesh);
    }

    /* ============================================================
       9 · the shafts of light the rain makes visible
       ============================================================ */
    const shaftMat = new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        uniforms: Object.assign(pick('uTime', 'uCamPos', 'uFogCol', 'uFogDen'), {
            uCol: { value: srgb(0xbcd2f2) }, uInt: { value: 0.10 },
        }),
        vertexShader: /* glsl */`
          varying vec3 vWorld; varying vec3 vNrm; varying vec2 vUvv;
          void main(){
            vUvv = uv;
            vec4 wp = modelMatrix * vec4(position, 1.0);
            vWorld = wp.xyz;
            vNrm = normalize(mat3(modelMatrix) * normal);
            gl_Position = projectionMatrix * viewMatrix * wp;
          }`,
        fragmentShader: NOISE_GLSL + /* glsl */`
          uniform vec3 uCamPos, uCol, uFogCol; uniform float uTime, uInt, uFogDen;
          varying vec3 vWorld; varying vec3 vNrm; varying vec2 vUvv;
          void main(){
            vec3 V = normalize(uCamPos - vWorld);
            float face = clamp(abs(dot(normalize(vNrm), V)), 0.0, 1.0);
            float a = pow(face, 1.35);
            a *= mix(0.06, 1.0, vUvv.y);                       // brightest at the lamp
            float speck = 0.72 + 0.55 * fbm(vec2(vWorld.x * 2.2 + vWorld.z * 1.1, vWorld.y * 3.0 - uTime * 2.4));
            a *= speck;
            float dist = length(uCamPos - vWorld);
            a *= 1.0 - smoothstep(30.0, 90.0, dist);
            gl_FragColor = vec4(uCol * a * uInt * 6.0, a * uInt);
          }`,
    });
    {
        for (const z of LAMP_Z) {
            const cone = mesh(new THREE.ConeGeometry(3.5, 4.9, 20, 1, true), shaftMat,
                LAMP_X - LAMP_ARM, PLAT_Y + LAMP_Y - 2.45, z);
            scene.add(cone); world.ghost(cone);
        }
        const soffit = mesh(new THREE.ConeGeometry(2.4, 2.4, 16, 1, true), shaftMat, 4.25, PLAT_Y + 1.35, 1.5);
        scene.add(soffit); world.ghost(soffit);
    }
    const headShaftMat = shaftMat.clone();
    headShaftMat.uniforms = Object.assign(pick('uTime', 'uCamPos', 'uFogCol', 'uFogDen'), {
        uCol: { value: srgb(0xdfeaff) }, uInt: { value: 0.085 },
    });
    {   // these belong to the tram, not the place: they leave with it
        for (const sx of [-0.78, 0.78]) {
            const c = mesh(new THREE.ConeGeometry(2.3, 30, 14, 1, true), headShaftMat, sx, 1.30, NOSE_Z - 15, -Math.PI / 2);
            car.add(c); world.ghost(c);
        }
    }

    /* ============================================================
       10 · the shelter
       ============================================================ */
    const shelter = new THREE.Group();
    {
        const SX0 = 3.05, SX1 = 5.45, SZ0 = -0.4, SZ1 = 3.4, SH = 2.62;
        const frame = [];
        for (const x of [SX0, SX1]) for (const z of [SZ0, SZ1]) {
            const p = new THREE.BoxGeometry(0.085, SH, 0.085);
            put(p, x, SH / 2, z); frame.push(p);
        }
        for (const z of [SZ0, SZ1]) {
            const b = new THREE.BoxGeometry(SX1 - SX0, 0.09, 0.09);
            put(b, (SX0 + SX1) / 2, SH - 0.05, z); frame.push(b);
        }
        for (const x of [SX0, SX1]) {
            const b = new THREE.BoxGeometry(0.09, 0.09, SZ1 - SZ0);
            put(b, x, SH - 0.05, (SZ0 + SZ1) / 2); frame.push(b);
        }
        // mullions on the back wall
        for (const z of [lerp(SZ0, SZ1, 0.5)]) {
            const p = new THREE.BoxGeometry(0.06, SH, 0.06);
            put(p, SX1, SH / 2, z); frame.push(p);
        }
        shelter.add(mesh(mergeGeometries(frame), steelGreen));

        const roof = mesh(new THREE.BoxGeometry(SX1 - SX0 + 0.55, 0.14, SZ1 - SZ0 + 0.55), steelGreen,
            (SX0 + SX1) / 2 + 0.10, SH + 0.07, (SZ0 + SZ1) / 2);
        shelter.add(roof);
        const fascia = mesh(new THREE.BoxGeometry(SX1 - SX0 + 0.57, 0.10, 0.06), steelDark,
            (SX0 + SX1) / 2 + 0.10, SH - 0.02, SZ0 - 0.28);
        shelter.add(fascia);

        // the cold soffit lightbox — the pale white of the whole scene
        const soffitMat = new THREE.MeshStandardMaterial({
            color: srgb(0xf4f8ff), emissive: srgb(0xd2e2fb), emissiveIntensity: 2.5,
            roughness: 0.4, side: THREE.DoubleSide,
        });
        const sg = new THREE.PlaneGeometry(SX1 - SX0 - 0.30, SZ1 - SZ0 - 0.30);
        sg.rotateX(Math.PI / 2);
        const soff = mesh(sg, soffitMat, (SX0 + SX1) / 2, SH - 0.06, (SZ0 + SZ1) / 2);
        shelter.add(soff);
        world.ghost(soff);

        // glazing: back wall and the downwind end only
        const glassMat = new THREE.MeshStandardMaterial({
            color: srgb(0x0f1720), roughness: 0.08, metalness: 0.15,
            transparent: true, opacity: 0.34, depthWrite: false, side: THREE.DoubleSide,
        });
        const back = new THREE.PlaneGeometry(SZ1 - SZ0 - 0.12, SH - 0.30);
        const bm = mesh(back, glassMat, SX1 - 0.02, SH / 2 - 0.02, (SZ0 + SZ1) / 2, 0, -Math.PI / 2);
        shelter.add(bm); world.ghost(bm);
        const end = new THREE.PlaneGeometry(SX1 - SX0 - 0.12, SH - 0.30);
        const em = mesh(end, glassMat, (SX0 + SX1) / 2, SH / 2 - 0.02, SZ1 - 0.02);
        shelter.add(em); world.ghost(em);

        shelter.position.y = PLAT_Y;
        scene.add(shelter);
        world.part('shelter_00', shelter);
    }

    /* the bench — steel slats, wet at one end where the rain gets in */
    {
        const bench = new THREE.Group();
        const slatMat = new THREE.MeshStandardMaterial({ color: srgb(0x22443a), roughness: 0.62, metalness: 0.28 });
        const parts = [];
        for (let i = 0; i < 5; i++) {
            const s = new THREE.BoxGeometry(0.10, 0.035, 3.0);
            put(s, -0.24 + i * 0.115, 0.46, 0); parts.push(s);
        }
        for (let i = 0; i < 4; i++) {
            const s = new THREE.BoxGeometry(0.035, 0.10, 3.0);
            put(s, 0.30, 0.60 + i * 0.115, 0); parts.push(s);
        }
        for (const z of [-1.34, 0, 1.34]) {
            const l = new THREE.BoxGeometry(0.72, 0.05, 0.06); put(l, 0.02, 0.44, z); parts.push(l);
            const v1 = new THREE.BoxGeometry(0.05, 0.44, 0.06); put(v1, -0.24, 0.22, z); parts.push(v1);
            const v2 = new THREE.BoxGeometry(0.05, 0.44, 0.06); put(v2, 0.28, 0.22, z); parts.push(v2);
            const bk = new THREE.BoxGeometry(0.05, 0.45, 0.06); put(bk, 0.32, 0.62, z); parts.push(bk);
        }
        bench.add(mesh(mergeGeometries(parts), slatMat));
        bench.position.set(4.85, PLAT_Y, 1.5);
        scene.add(bench);
        world.part('bench_00', bench);
    }

    /* ============================================================
       11 · signage — canvas, because that is where the words live
       ============================================================ */
    const dotText = (ctx, text, x, y, size, colour, spacing) => {
        ctx.save();
        ctx.font = `bold ${size}px "Helvetica Neue", Helvetica, Arial, sans-serif`;
        ctx.fillStyle = colour;
        ctx.textBaseline = 'middle';
        let cx = x;
        for (const ch of text) {
            ctx.fillText(ch, cx, y);
            cx += ctx.measureText(ch).width + (spacing || 0);
        }
        ctx.restore();
        return cx;
    };

    // the green route totem, exactly the wrong shade of hopeful
    const totemTex = tex(512, 1024, (c, W, H) => {
        c.fillStyle = '#0d1b16'; c.fillRect(0, 0, W, H);
        c.fillStyle = '#1f6b3a'; c.fillRect(W * 0.06, H * 0.04, W * 0.88, H * 0.92);
        c.fillStyle = '#ffffff'; c.fillRect(W * 0.10, H * 0.08, W * 0.80, H * 0.16);
        c.fillStyle = '#1f6b3a';
        c.font = `bold ${Math.round(H * 0.105)}px Helvetica, Arial, sans-serif`;
        c.textAlign = 'center'; c.textBaseline = 'middle';
        c.fillText('75', W * 0.5, H * 0.163);
        c.fillStyle = '#ffffff';
        c.font = `bold ${Math.round(H * 0.042)}px Helvetica, Arial, sans-serif`;
        c.fillText('TRAM STOP', W * 0.5, H * 0.305);
        c.font = `bold ${Math.round(H * 0.062)}px Helvetica, Arial, sans-serif`;
        c.fillText('42', W * 0.5, H * 0.375);
        c.strokeStyle = 'rgba(255,255,255,0.55)'; c.lineWidth = 3;
        c.beginPath(); c.moveTo(W * 0.14, H * 0.435); c.lineTo(W * 0.86, H * 0.435); c.stroke();
        c.font = `${Math.round(H * 0.033)}px Helvetica, Arial, sans-serif`;
        c.fillText('to Vermont South', W * 0.5, H * 0.49);
        c.fillText('to Central Pier', W * 0.5, H * 0.545);
        c.globalAlpha = 0.75;
        c.font = `${Math.round(H * 0.026)}px Helvetica, Arial, sans-serif`;
        c.fillText('LAST TRAM 12.14 AM', W * 0.5, H * 0.63);
        c.globalAlpha = 1;
        c.fillStyle = '#ffffff'; c.fillRect(W * 0.24, H * 0.70, W * 0.52, W * 0.52 * 0.62);
        c.fillStyle = '#1f6b3a';
        c.font = `bold ${Math.round(H * 0.055)}px Helvetica, Arial, sans-serif`;
        c.fillText('PT', W * 0.44, H * 0.70 + W * 0.52 * 0.31);
        c.beginPath();
        c.moveTo(W * 0.58, H * 0.70 + W * 0.52 * 0.18);
        c.lineTo(W * 0.70, H * 0.70 + W * 0.52 * 0.31);
        c.lineTo(W * 0.58, H * 0.70 + W * 0.52 * 0.44);
        c.closePath(); c.fill();
        // rain, running down the face of it
        c.strokeStyle = 'rgba(210,235,255,0.14)'; c.lineWidth = 2;
        for (let i = 0; i < 42; i++) {
            const x = Math.random() * W, y0 = Math.random() * H, l = 20 + Math.random() * 120;
            c.beginPath(); c.moveTo(x, y0); c.lineTo(x + 3, y0 + l); c.stroke();
        }
    });
    {
        const totem = new THREE.Group();
        const pole = mesh(new THREE.CylinderGeometry(0.045, 0.055, 2.9, 8), steelGreen, 0, 1.45, 0);
        totem.add(pole);
        const faceMat = new THREE.MeshStandardMaterial({
            map: totemTex, color: srgb(0xffffff), roughness: 0.55, metalness: 0.05, side: THREE.DoubleSide,
            emissive: srgb(0x1a2a22), emissiveIntensity: 0.5,
        });
        const face = mesh(new THREE.PlaneGeometry(0.62, 1.24), faceMat, 0, 2.16, 0.04, 0, Math.PI / 2);
        totem.add(face);
        totem.position.set(5.32, PLAT_Y, -13.5);
        scene.add(totem);
        world.part('totem_00', totem);
    }

    // the departure board: scrolling amber dot matrix, the only thing that speaks.
    // Two faces of it, because it has two things to say — one while the tram is
    // coming or standing, one for the long minutes after it has gone.
    const makePids = (when, whenCol) => {
        const t = tex(2048, 128, (c, W, H) => {
            c.fillStyle = '#000000'; c.fillRect(0, 0, W, H);
            c.textBaseline = 'middle';
            let x = 30;
            x = dotText(c, '75  VERMONT SOUTH', x, H * 0.5, Math.round(H * 0.62), '#ffa227', 2);
            x = dotText(c, `   ${when}   `, x, H * 0.5, Math.round(H * 0.62), whenCol, 2);
            x = dotText(c, '•   LAST SERVICE   •   ', x, H * 0.5, Math.round(H * 0.62), '#c97a1e', 2);
            // punch it out into a dot grid
            c.globalCompositeOperation = 'destination-out';
            c.fillStyle = '#000';
            for (let y = 0; y < H; y += 4) c.fillRect(0, y + 3, W, 1.6);
            for (let xx = 0; xx < W; xx += 4) c.fillRect(xx + 3, 0, 1.6, H);
            c.globalCompositeOperation = 'source-over';
        }, 1, 1);
        t.wrapS = THREE.RepeatWrapping;
        t.repeat.set(0.30, 1);
        return t;
    };
    const pidsNow = makePids('NOW', '#ffd07a');
    const pidsSoon = makePids('12.14 AM', '#ffa227');
    const pidsFaces = [pidsNow, pidsSoon];
    const pidsScreenMat = new THREE.MeshStandardMaterial({
        map: pidsNow, emissiveMap: pidsNow, emissive: srgb(0xffffff), emissiveIntensity: 2.6,
        color: srgb(0x000000), roughness: 0.35,
    });
    let pidsFace = 0, pidsOff = 0;
    const setPids = (i) => {
        if (i === pidsFace) return;
        pidsFace = i;
        pidsScreenMat.map = pidsFaces[i];
        pidsScreenMat.emissiveMap = pidsFaces[i];
        pidsScreenMat.needsUpdate = true;   // twice a cycle, not once a frame
    };
    {
        const pids = new THREE.Group();
        const box = mesh(new THREE.BoxGeometry(0.16, 0.46, 1.55), steelDark, 0, 2.55, 0);
        pids.add(box);
        const screen = mesh(new THREE.PlaneGeometry(1.42, 0.34), pidsScreenMat, -0.085, 2.55, 0, 0, -Math.PI / 2);
        pids.add(screen); world.ghost(screen);
        const arm = mesh(new THREE.CylinderGeometry(0.05, 0.06, 2.6, 8), steelGreen, 0, 1.30, 0);
        pids.add(arm);
        pids.position.set(5.30, PLAT_Y, -3.5);
        scene.add(pids);
        world.part('pids_00', pids);
    }

    // the timetable case on the shelter's back wall, backlit and half-unread
    {
        const posterTex = tex(512, 700, (c, W, H) => {
            c.fillStyle = '#f2f1ec'; c.fillRect(0, 0, W, H);
            c.fillStyle = '#1f6b3a'; c.fillRect(0, 0, W, H * 0.11);
            c.fillStyle = '#ffffff';
            c.font = `bold ${Math.round(H * 0.045)}px Helvetica, Arial, sans-serif`;
            c.textBaseline = 'middle';
            c.fillText('ROUTE 75 · TIMETABLE', W * 0.06, H * 0.055);
            c.fillStyle = '#2b2b28';
            c.font = `${Math.round(H * 0.022)}px Helvetica, Arial, sans-serif`;
            for (let r = 0; r < 22; r++) {
                for (let col = 0; col < 6; col++) {
                    const hh = 5 + Math.floor((r * 6 + col) / 6);
                    const mm = ((r * 7 + col * 11) % 60).toString().padStart(2, '0');
                    c.fillStyle = (r > 18) ? '#9b9a95' : '#2b2b28';
                    c.fillText(`${(hh % 24).toString().padStart(2, '0')}:${mm}`, W * 0.06 + col * W * 0.155, H * 0.16 + r * H * 0.033);
                }
            }
            c.strokeStyle = '#c9c8c2'; c.lineWidth = 1;
            for (let r = 0; r < 23; r++) { c.beginPath(); c.moveTo(W * 0.04, H * 0.145 + r * H * 0.033); c.lineTo(W * 0.96, H * 0.145 + r * H * 0.033); c.stroke(); }
            c.fillStyle = 'rgba(120,150,180,0.10)';
            for (let i = 0; i < 60; i++) c.fillRect(Math.random() * W, Math.random() * H, 2, 8 + Math.random() * 40);
        });
        const poster = new THREE.Group();
        const case_ = mesh(new THREE.BoxGeometry(0.05, 0.94, 0.70), steelDark, 0, 0, 0);
        poster.add(case_);
        const pmat = new THREE.MeshStandardMaterial({
            map: posterTex, color: srgb(0xffffff), roughness: 0.42,
            emissive: srgb(0xbcd0e8), emissiveIntensity: 0.55,
        });
        const face = mesh(new THREE.PlaneGeometry(0.64, 0.88), pmat, -0.028, 0, 0, 0, -Math.PI / 2);
        poster.add(face);
        poster.position.set(5.40, PLAT_Y + 1.55, 2.5);
        scene.add(poster);
        world.part('timetable_00', poster);
    }

    /* the bin, and the things nobody came back for */
    {
        const bin = new THREE.Group();
        const bmat = new THREE.MeshStandardMaterial({ color: srgb(0x22443a), roughness: 0.70, metalness: 0.20 });
        bin.add(mesh(new THREE.CylinderGeometry(0.30, 0.26, 0.82, 14, 1, true), bmat, 0, 0.44, 0));
        bin.add(mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.10, 14), steelDark, 0, 0.90, 0));
        bin.position.set(4.55, PLAT_Y, -6.4);
        scene.add(bin);
        world.part('bin_00', bin);
    }
    {
        // a blown-out umbrella, left where the wind broke it
        const umb = new THREE.Group();
        const cloth = new THREE.MeshStandardMaterial({ color: srgb(0x16181d), roughness: 0.72, side: THREE.DoubleSide, metalness: 0.05 });
        const canopy = mesh(new THREE.SphereGeometry(0.44, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.46), cloth, 0, 0.18, 0, Math.PI * 0.92, 0, 0.35);
        umb.add(canopy);
        const shaft = mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.86, 6), steelDark, 0.28, 0.07, 0.16, 0, 0, Math.PI / 2 - 0.12);
        umb.add(shaft);
        const ribs = [];
        for (let i = 0; i < 5; i++) {
            const g = new THREE.CylinderGeometry(0.006, 0.006, 0.42, 4);
            put(g, Math.cos(i * 1.26) * 0.20, 0.10 + rr(0, 0.06), Math.sin(i * 1.26) * 0.20, rr(-1.4, -1.0), i * 1.26, 0);
            ribs.push(g);
        }
        umb.add(mesh(mergeGeometries(ribs), steelDark));
        umb.position.set(3.30, PLAT_Y, -9.6);
        umb.rotation.y = 0.7;
        scene.add(umb);
        world.part('umbrella_00', umb);
    }
    {
        const cup = new THREE.Group();
        const paper = new THREE.MeshStandardMaterial({ color: srgb(0xbcb4a6), roughness: 0.92 });
        cup.add(mesh(new THREE.CylinderGeometry(0.042, 0.032, 0.115, 10, 1, true), paper, 0, 0.042, 0, Math.PI / 2 - 0.12, 0, 0.3));
        cup.add(mesh(new THREE.CylinderGeometry(0.044, 0.044, 0.012, 10), new THREE.MeshStandardMaterial({ color: srgb(0x2a2622), roughness: 0.8 }), 0.05, 0.044, 0.01, Math.PI / 2 - 0.12, 0, 0.3));
        cup.position.set(4.20, PLAT_Y, 4.9);
        scene.add(cup);
        world.part('cup_00', cup);
    }

    /* ============================================================
       12 · the tram
       ============================================================ */
    // ---- livery layout, shared between the colour map and the glow map ----
    const DOOR_W = 0.052;
    const WIN_V0 = 0.15, WIN_V1 = 0.575;
    const WINDOWS = [
        [0.052, 0.114], [0.124, 0.186], [0.196, 0.238],
        [0.305, 0.367], [0.377, 0.439], [0.449, 0.511], [0.521, 0.583], [0.593, 0.608],
        [0.675, 0.737], [0.747, 0.809], [0.819, 0.881], [0.891, 0.953], [0.963, 0.988],
    ];
    const ADS = [[0.124, 0.186], [0.449, 0.511], [0.819, 0.881]];
    const isAd = (w) => ADS.some(a => Math.abs(a[0] - w[0]) < 1e-6);

    const rainStreaks = (c, x0, y0, w, h, n, alpha) => {
        c.save();
        c.beginPath(); c.rect(x0, y0, w, h); c.clip();
        for (let i = 0; i < n; i++) {
            const x = x0 + Math.random() * w, y = y0 + Math.random() * h * 0.6;
            const l = h * (0.15 + Math.random() * 0.6);
            const g = c.createLinearGradient(x, y, x + w * 0.004, y + l);
            g.addColorStop(0, `rgba(0,0,0,0)`);
            g.addColorStop(0.4, `rgba(0,0,0,${alpha})`);
            g.addColorStop(1, `rgba(0,0,0,0)`);
            c.strokeStyle = g; c.lineWidth = 1.2 + Math.random() * 2.2;
            c.beginPath(); c.moveTo(x, y); c.lineTo(x + w * 0.004, y + l); c.stroke();
        }
        c.restore();
    };

    const sideTexA = tex(2048, 290, (c, W, H) => {
        c.fillStyle = '#e6eaea'; c.fillRect(0, 0, W, H);
        // green above the windows and a swoop below them
        c.fillStyle = '#2f7d3a'; c.fillRect(0, 0, W, H * 0.135);
        c.fillStyle = '#0b0e12'; c.fillRect(0, H * WIN_V0, W, H * (WIN_V1 - WIN_V0));
        c.beginPath();
        c.moveTo(0, H); c.lineTo(0, H * 0.86);
        c.bezierCurveTo(W * 0.30, H * 0.79, W * 0.55, H * 1.00, W, H * 0.88);
        c.lineTo(W, H); c.closePath();
        c.fillStyle = '#2f7d3a'; c.fill();
        // the geometric nose panel
        c.save();
        c.beginPath(); c.moveTo(0, 0); c.lineTo(W * 0.185, 0); c.lineTo(W * 0.115, H); c.lineTo(0, H); c.closePath(); c.clip();
        c.fillStyle = '#2f7d3a'; c.fillRect(0, 0, W * 0.2, H);
        for (let i = 0; i < 26; i++) {
            const x = Math.random() * W * 0.19, y = Math.random() * H, s = 18 + Math.random() * 60;
            c.fillStyle = ['#3f9647', '#256b32', '#4fae55', '#1d5a2a'][i % 4];
            c.beginPath(); c.moveTo(x, y); c.lineTo(x + s, y + s * 0.5); c.lineTo(x + s * 0.3, y + s); c.closePath(); c.fill();
        }
        c.restore();
        // window glass and pillars
        for (const w of WINDOWS) {
            const x = W * w[0], ww = W * (w[1] - w[0]);
            if (isAd(w)) {
                c.fillStyle = '#c8452a'; c.fillRect(x, H * (WIN_V0 - 0.02), ww, H * (WIN_V1 - WIN_V0 + 0.24));
                c.fillStyle = '#ffffff';
                c.font = `bold ${Math.round(H * 0.10)}px Helvetica, Arial, sans-serif`;
                c.textAlign = 'center'; c.textBaseline = 'middle';
                c.fillText('NO', x + ww / 2, H * 0.30);
                c.fillText('LOCK-IN', x + ww / 2, H * 0.42);
                c.font = `${Math.round(H * 0.055)}px Helvetica, Arial, sans-serif`;
                c.fillText('every month, forever', x + ww / 2, H * 0.56);
                c.textAlign = 'left';
            } else {
                c.fillStyle = '#0a0d10'; c.fillRect(x, H * WIN_V0, ww, H * (WIN_V1 - WIN_V0));
                c.strokeStyle = '#39414a'; c.lineWidth = 2.5;
                c.strokeRect(x, H * WIN_V0, ww, H * (WIN_V1 - WIN_V0));
            }
        }
        // doors
        for (const d of DOOR_U) {
            const x = W * d, ww = W * DOOR_W;
            c.fillStyle = '#e9c118'; c.fillRect(x, H * 0.10, ww, H * 0.90);
            c.fillStyle = '#0a0d10'; c.fillRect(x + 5, H * 0.165, ww - 10, H * 0.40);
            c.fillStyle = 'rgba(0,0,0,0.55)'; c.fillRect(x + ww / 2 - 1.5, H * 0.10, 3, H * 0.90);
            c.fillStyle = '#c9a512'; c.fillRect(x - 4, H * 0.10, 4, H * 0.90);
            c.fillRect(x + ww, H * 0.10, 4, H * 0.90);
        }
        // marks of a public thing
        c.fillStyle = '#2f7d3a';
        c.font = `bold ${Math.round(H * 0.14)}px Helvetica, Arial, sans-serif`;
        c.textBaseline = 'middle';
        c.fillText('PT', W * 0.700, H * 0.71);
        c.beginPath();
        c.moveTo(W * 0.728, H * 0.645); c.lineTo(W * 0.748, H * 0.71); c.lineTo(W * 0.728, H * 0.775);
        c.closePath(); c.fill();
        c.fillStyle = '#1d2126';
        c.font = `bold ${Math.round(H * 0.10)}px Helvetica, Arial, sans-serif`;
        c.fillText('2131', W * 0.055, H * 0.71);
        c.fillStyle = 'rgba(20,26,32,0.55)';
        c.font = `${Math.round(H * 0.045)}px Helvetica, Arial, sans-serif`;
        c.fillText('ROUTE 75  ·  VERMONT SOUTH', W * 0.30, H * 0.81);
        // road film up from the skirt, and rain over everything
        const grime = c.createLinearGradient(0, H, 0, H * 0.55);
        grime.addColorStop(0, 'rgba(24,26,24,0.55)');
        grime.addColorStop(1, 'rgba(24,26,24,0)');
        c.fillStyle = grime; c.fillRect(0, 0, W, H);
        rainStreaks(c, 0, 0, W, H, 260, 0.20);
    });
    // Two glow maps for the same flank: doors shut, and the leading door open
    // and pouring onto the platform. Swapped at the two moments of the dwell —
    // a door that is painted open all the way to Vermont South is a lie.
    const makeSideEmis = (open) => tex(2048, 290, (c, W, H) => {
        c.fillStyle = '#000000'; c.fillRect(0, 0, W, H);
        for (const w of WINDOWS) {
            if (isAd(w)) continue;
            const x = W * w[0], ww = W * (w[1] - w[0]);
            const y = H * WIN_V0, hh = H * (WIN_V1 - WIN_V0);
            const g = c.createLinearGradient(0, y, 0, y + hh);
            g.addColorStop(0, '#ffdca8');
            g.addColorStop(0.45, '#ffc178');
            g.addColorStop(1, '#e08f3e');
            c.fillStyle = g; c.fillRect(x + 3, y + 3, ww - 6, hh - 6);
            // the ceiling strip, brighter than the rest
            c.fillStyle = 'rgba(255,240,210,0.85)'; c.fillRect(x + 3, y + 3, ww - 6, hh * 0.13);
            // seat backs, in silhouette
            c.fillStyle = 'rgba(46,28,12,0.80)';
            const seats = 1 + Math.floor(ww / (W * 0.030));
            for (let s = 0; s < seats; s++) {
                const sx = x + 6 + s * (ww - 12) / seats;
                const sw = (ww - 12) / seats * 0.62;
                c.fillRect(sx, y + hh * 0.52, sw, hh * 0.48);
                c.fillRect(sx, y + hh * 0.44, sw, hh * 0.10);
            }
            // a grab pole
            if ((w[0] * 100 | 0) % 3 === 0) { c.fillStyle = 'rgba(60,36,14,0.7)'; c.fillRect(x + ww * 0.45, y + 4, 4, hh - 8); }
        }
        // the doors' glass, and — when it is standing — the one pouring out
        DOOR_U.forEach((d, i) => {
            const x = W * d, ww = W * DOOR_W;
            if (i === 0 && open) {
                const g = c.createLinearGradient(0, H * 0.10, 0, H);
                g.addColorStop(0, '#fff0cf'); g.addColorStop(0.6, '#ffc078'); g.addColorStop(1, '#f0a24a');
                c.fillStyle = g; c.fillRect(x + 4, H * 0.115, ww - 8, H * 0.86);
                c.fillStyle = 'rgba(40,22,8,0.55)'; c.fillRect(x + ww * 0.46, H * 0.115, 5, H * 0.86);
            } else {
                c.fillStyle = '#f2ab5c'; c.fillRect(x + 6, H * 0.170, ww - 12, H * 0.39);
            }
        });
        rainStreaks(c, 0, 0, W, H, 300, 0.42);
    });
    const mirrored = (t) => { const m = t.clone(); m.repeat.set(-1, 1); m.offset.set(1, 0); m.needsUpdate = true; return m; };
    const sideEmisA = makeSideEmis(true);            // the platform side, doors open
    const sideEmisShutA = makeSideEmis(false);
    const sideTexB = mirrored(sideTexA);
    const sideEmisB = mirrored(sideEmisA);
    const sideEmisShutB = mirrored(sideEmisShutA);

    const frontTex = tex(1024, 1024, (c, W, H) => {
        c.fillStyle = '#dfe3e3'; c.fillRect(0, 0, W, H);
        c.fillStyle = '#2f7d3a'; c.fillRect(0, 0, W, H * 0.055);
        c.fillStyle = '#101418'; c.fillRect(W * 0.10, H * 0.065, W * 0.80, H * 0.105);      // destination box
        c.fillStyle = '#0a0d11';                                                            // windscreen
        c.beginPath();
        c.moveTo(W * 0.055, H * 0.20); c.lineTo(W * 0.945, H * 0.20);
        c.lineTo(W * 0.915, H * 0.575); c.lineTo(W * 0.085, H * 0.575); c.closePath(); c.fill();
        c.strokeStyle = '#2a3038'; c.lineWidth = 5; c.stroke();
        c.fillStyle = '#e9c118'; c.fillRect(0, H * 0.60, W, H * 0.022);                     // yellow band
        c.fillStyle = '#2f7d3a';
        c.font = `bold ${Math.round(H * 0.085)}px Helvetica, Arial, sans-serif`;
        c.textBaseline = 'middle';
        c.fillText('PT', W * 0.40, H * 0.70);
        c.beginPath(); c.moveTo(W * 0.535, H * 0.655); c.lineTo(W * 0.585, H * 0.70); c.lineTo(W * 0.535, H * 0.745); c.closePath(); c.fill();
        c.fillStyle = '#1d2126';
        c.font = `bold ${Math.round(H * 0.055)}px Helvetica, Arial, sans-serif`;
        c.fillText('2131', W * 0.06, H * 0.70);
        c.fillStyle = '#17191c'; c.fillRect(0, H * 0.84, W, H * 0.16);                      // bumper
        c.fillStyle = '#0e1013';
        c.fillRect(W * 0.075, H * 0.775, W * 0.25, H * 0.062);
        c.fillRect(W * 0.675, H * 0.775, W * 0.25, H * 0.062);
        c.fillStyle = '#3a3f45';
        c.fillRect(W * 0.10, H * 0.782, W * 0.075, H * 0.048);
        c.fillRect(W * 0.225, H * 0.782, W * 0.075, H * 0.048);
        c.fillRect(W * 0.700, H * 0.782, W * 0.075, H * 0.048);
        c.fillRect(W * 0.825, H * 0.782, W * 0.075, H * 0.048);
        c.fillStyle = '#6b3a1c';
        c.fillRect(W * 0.078, H * 0.782, W * 0.020, H * 0.048);
        c.fillRect(W * 0.902, H * 0.782, W * 0.020, H * 0.048);
        rainStreaks(c, 0, 0, W, H, 220, 0.28);
    });
    const frontEmis = tex(1024, 1024, (c, W, H) => {
        c.fillStyle = '#000000'; c.fillRect(0, 0, W, H);
        // destination roll, amber dots
        c.fillStyle = '#ffa227';
        c.font = `bold ${Math.round(H * 0.072)}px "Helvetica Neue", Helvetica, Arial, sans-serif`;
        c.textBaseline = 'middle'; c.textAlign = 'center';
        c.fillText('75  VERMONT STH', W * 0.5, H * 0.118);
        c.textAlign = 'left';
        c.save();
        c.globalCompositeOperation = 'destination-out'; c.fillStyle = '#000';
        for (let y = 0; y < H; y += 5) c.fillRect(0, y + 3.4, W, 1.6);
        for (let x = 0; x < W; x += 5) c.fillRect(x + 3.4, 0, 1.6, H);
        c.restore();
        // cab, faintly lit from the driver's own instruments
        const g = c.createLinearGradient(0, H * 0.30, 0, H * 0.575);
        g.addColorStop(0, 'rgba(30,22,12,0)');
        g.addColorStop(1, 'rgba(150,96,38,0.55)');
        c.fillStyle = g;
        c.beginPath();
        c.moveTo(W * 0.055, H * 0.20); c.lineTo(W * 0.945, H * 0.20);
        c.lineTo(W * 0.915, H * 0.575); c.lineTo(W * 0.085, H * 0.575); c.closePath(); c.fill();
        c.fillStyle = 'rgba(90,200,150,0.55)'; c.fillRect(W * 0.60, H * 0.50, W * 0.11, H * 0.03);
        // headlights
        for (const x of [0.10, 0.225, 0.700, 0.825]) {
            const gr = c.createRadialGradient(W * (x + 0.037), H * 0.806, 2, W * (x + 0.037), H * 0.806, W * 0.075);
            gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.35, '#dfeaff'); gr.addColorStop(1, 'rgba(120,160,220,0)');
            c.fillStyle = gr; c.fillRect(W * (x - 0.04), H * 0.75, W * 0.16, H * 0.12);
        }
        for (const x of [0.078, 0.902]) {
            c.fillStyle = 'rgba(190,90,20,0.55)';
            c.fillRect(W * x, H * 0.782, W * 0.020, H * 0.048);
        }
    });
    const rearTex = tex(1024, 1024, (c, W, H) => {
        c.fillStyle = '#dfe3e3'; c.fillRect(0, 0, W, H);
        c.fillStyle = '#2f7d3a'; c.fillRect(0, 0, W, H * 0.16);
        c.fillStyle = '#0a0d11'; c.fillRect(W * 0.09, H * 0.20, W * 0.82, H * 0.36);
        c.strokeStyle = '#2a3038'; c.lineWidth = 5; c.strokeRect(W * 0.09, H * 0.20, W * 0.82, H * 0.36);
        c.fillStyle = '#e9c118'; c.fillRect(0, H * 0.60, W, H * 0.022);
        c.fillStyle = '#1d2126';
        c.font = `bold ${Math.round(H * 0.055)}px Helvetica, Arial, sans-serif`;
        c.textBaseline = 'middle';
        c.fillText('2131', W * 0.06, H * 0.70);
        c.fillStyle = '#17191c'; c.fillRect(0, H * 0.84, W, H * 0.16);
        c.fillStyle = '#3a1512';
        c.fillRect(W * 0.075, H * 0.775, W * 0.22, H * 0.062);
        c.fillRect(W * 0.705, H * 0.775, W * 0.22, H * 0.062);
        rainStreaks(c, 0, 0, W, H, 200, 0.30);
    });
    const rearEmis = tex(1024, 1024, (c, W, H) => {
        c.fillStyle = '#000000'; c.fillRect(0, 0, W, H);
        const g = c.createLinearGradient(0, H * 0.20, 0, H * 0.56);
        g.addColorStop(0, '#ffd79c'); g.addColorStop(1, '#e59a4a');
        c.fillStyle = g; c.fillRect(W * 0.095, H * 0.205, W * 0.81, H * 0.35);
        c.fillStyle = 'rgba(45,26,10,0.8)';
        for (let i = 0; i < 5; i++) c.fillRect(W * (0.13 + i * 0.155), H * 0.36, W * 0.10, H * 0.20);
        rainStreaks(c, W * 0.09, H * 0.20, W * 0.82, H * 0.36, 90, 0.45);
        for (const x of [0.075, 0.705]) {
            const gr = c.createLinearGradient(W * x, 0, W * (x + 0.22), 0);
            gr.addColorStop(0, '#ff2a14'); gr.addColorStop(1, '#c01808');
            c.fillStyle = gr; c.fillRect(W * x, H * 0.775, W * 0.22, H * 0.062);
        }
    });

    const tramSideMats = [];
    {
        const bodyDark = new THREE.MeshStandardMaterial({ color: srgb(0x090b0e), roughness: 0.85 });
        const whiteMat = new THREE.MeshStandardMaterial({ color: srgb(0xcdd2d2), roughness: 0.55, metalness: 0.10 });
        const roofMat = new THREE.MeshStandardMaterial({ color: srgb(0x6d7276), roughness: 0.72, metalness: 0.18 });
        const skirtMat = new THREE.MeshStandardMaterial({ color: srgb(0x25282b), roughness: 0.80, metalness: 0.12 });

        const CH = TRAM_Y1 - TRAM_Y0, CY = (TRAM_Y0 + TRAM_Y1) / 2;

        // core
        car.add(mesh(new THREE.BoxGeometry(TRAM_HW * 2 - 0.04, CH, TRAM_L - 0.02), bodyDark, 0, CY, TRAM_Z));

        // livery panels — the platform side is +x, so it takes the mirrored map
        const sideGeo = new THREE.PlaneGeometry(TRAM_L, CH);
        const matA = new THREE.MeshStandardMaterial({
            map: sideTexA, emissiveMap: sideEmisA, emissive: srgb(0xffffff), emissiveIntensity: 2.55,
            color: srgb(0xffffff), roughness: 0.38, metalness: 0.06,
        });
        const matB = new THREE.MeshStandardMaterial({
            map: sideTexB, emissiveMap: sideEmisB, emissive: srgb(0xffffff), emissiveIntensity: 2.55,
            color: srgb(0xffffff), roughness: 0.38, metalness: 0.06,
        });
        tramSideMats.push(matA, matB);
        car.add(mesh(sideGeo, matA, -TRAM_HW, CY, TRAM_Z, 0, -Math.PI / 2));
        car.add(mesh(sideGeo.clone(), matB, TRAM_HW, CY, TRAM_Z, 0, Math.PI / 2));

        // corner chamfers, so the nose is not a brick
        const chams = [];
        for (const sx of [-1, 1]) {
            for (const sz of [-1, 1]) {
                const g = new THREE.BoxGeometry(0.30, CH, 0.05);
                put(g, sx * (TRAM_HW - 0.105), CY, TRAM_Z + sz * (TRAM_L / 2 - 0.10), 0, sx * sz * -Math.PI / 4, 0);
                chams.push(g);
            }
        }
        car.add(mesh(mergeGeometries(chams), whiteMat));

        // front and rear
        const fMat = new THREE.MeshStandardMaterial({
            map: frontTex, emissiveMap: frontEmis, emissive: srgb(0xffffff), emissiveIntensity: 2.9,
            color: srgb(0xffffff), roughness: 0.34, metalness: 0.06,
        });
        const rMat = new THREE.MeshStandardMaterial({
            map: rearTex, emissiveMap: rearEmis, emissive: srgb(0xffffff), emissiveIntensity: 2.2,
            color: srgb(0xffffff), roughness: 0.34, metalness: 0.06,
        });
        tramSideMats.push(fMat, rMat);
        car.add(mesh(new THREE.PlaneGeometry(2.24, CH), fMat, 0, CY, NOSE_Z - 0.012, 0, Math.PI));
        car.add(mesh(new THREE.PlaneGeometry(2.24, CH), rMat, 0, CY, TAIL_Z + 0.012));

        // roof, shoulder, air conditioning
        const roofBits = [];
        const shoulder = new THREE.BoxGeometry(TRAM_HW * 2, 0.10, TRAM_L - 0.10);
        put(shoulder, 0, TRAM_Y1 + 0.05, TRAM_Z);
        const roof = new THREE.BoxGeometry(2.42, 0.14, TRAM_L - 0.55);
        put(roof, 0, TRAM_Y1 + 0.16, TRAM_Z);
        roofBits.push(shoulder, roof);
        for (const z of [TRAM_Z + 3.1, TRAM_Z - 4.4]) {
            const ac = new THREE.BoxGeometry(1.34, 0.30, 2.9);
            put(ac, 0, TRAM_Y1 + 0.37, z);
            roofBits.push(ac);
        }
        const duct = new THREE.BoxGeometry(0.34, 0.16, TRAM_L - 3.0);
        put(duct, 0.72, TRAM_Y1 + 0.30, TRAM_Z);
        roofBits.push(duct);
        car.add(mesh(mergeGeometries(roofBits), roofMat));

        // skirt and underframe
        const under = [];
        const skirt = new THREE.BoxGeometry(TRAM_HW * 2 - 0.06, 0.56, TRAM_L - 0.30);
        put(skirt, 0, TRAM_Y0 - 0.28, TRAM_Z);
        under.push(skirt);
        for (const z of [TRAM_Z - 5.1, TRAM_Z + 5.1]) {
            const bg = new THREE.BoxGeometry(2.05, 0.42, 2.5);
            put(bg, 0, 0.74, z);
            under.push(bg);
        }
        car.add(mesh(mergeGeometries(under), skirtMat));

        const wheelMat = new THREE.MeshStandardMaterial({ color: srgb(0x161719), roughness: 0.55, metalness: 0.6 });
        const wheelGeo = new THREE.CylinderGeometry(0.33, 0.33, 0.10, 14);
        wheelGeo.rotateZ(Math.PI / 2);
        const wim = new THREE.InstancedMesh(wheelGeo, wheelMat, 8);
        let wi = 0;
        for (const bz of [TRAM_Z - 5.1, TRAM_Z + 5.1])
            for (const dz of [-0.95, 0.95])
                for (const sx of [-HG, HG])
                    wim.setMatrixAt(wi++, M(sx, RAIL_Y + 0.33, bz + dz));   // tread on the railhead
        wim.instanceMatrix.needsUpdate = true;
        car.add(wim); world.ghost(wim);

        // pantograph, up to the wire
        const pan = [];
        const base1 = new THREE.BoxGeometry(1.30, 0.09, 0.16); put(base1, 0, TRAM_Y1 + 0.30, TRAM_Z - 1.4); pan.push(base1);
        const armL = 2.05;
        for (const sx of [-0.52, 0.52]) {
            const a = new THREE.CylinderGeometry(0.035, 0.045, armL, 6);
            put(a, sx, TRAM_Y1 + 0.30 + armL * 0.42, TRAM_Z - 1.4 + armL * 0.30, 0.62, 0, 0);
            pan.push(a);
            // the knuckle back to the pan head — the lower arm tops out at
            // (y 5.30, z −1.19) and the head sits at (y 5.62, z −1.42)
            const b = new THREE.CylinderGeometry(0.028, 0.032, 0.42, 6);
            put(b, sx, 5.458, TRAM_Z - 0.305, -0.618, 0, 0);
            pan.push(b);
        }
        const bar = new THREE.BoxGeometry(1.32, 0.05, 0.12);
        put(bar, 0, 5.62, TRAM_Z - 0.42); pan.push(bar);
        const shoe = new THREE.BoxGeometry(1.02, 0.03, 0.05);
        put(shoe, 0, 5.66, TRAM_Z - 0.42); pan.push(shoe);
        car.add(mesh(mergeGeometries(pan), steelDark));

        // the arc that jumps at the shoe every so often
        const arcTex = tex(128, 128, (c, W, H) => {
            c.clearRect(0, 0, W, H);
            const g = c.createRadialGradient(W / 2, H / 2, 1, W / 2, H / 2, W / 2);
            g.addColorStop(0, 'rgba(255,255,255,1)');
            g.addColorStop(0.18, 'rgba(200,228,255,0.85)');
            g.addColorStop(0.55, 'rgba(120,175,255,0.22)');
            g.addColorStop(1, 'rgba(80,140,255,0)');
            c.fillStyle = g; c.fillRect(0, 0, W, H);
            c.strokeStyle = 'rgba(235,245,255,0.9)'; c.lineWidth = 3;
            for (let i = 0; i < 5; i++) {
                c.beginPath(); c.moveTo(W / 2, H / 2);
                const a = i * 1.25, r = W * (0.16 + Math.random() * 0.22);
                c.lineTo(W / 2 + Math.cos(a) * r, H / 2 + Math.sin(a) * r * 0.5);
                c.stroke();
            }
        });
        const arcMat = new THREE.SpriteMaterial({
            map: arcTex, color: new THREE.Color(0x9fd0ff), transparent: true, opacity: 0,
            depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
        });
        const arc = new THREE.Sprite(arcMat);
        arc.position.set(0.12, 5.68, TRAM_Z - 0.42);
        arc.scale.set(1.1, 1.1, 1);
        car.add(arc); world.ghost(arc);
        car.userData.arc = arcMat;

        // the light the open door lays on the platform. This one stays behind
        // with the platform — it is the stop's light, borrowed.
        const spillMat = new THREE.MeshBasicMaterial({
            color: srgb(0xffc178), transparent: true, opacity: 0.0,
            depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
        });
        const spillGeo = new THREE.PlaneGeometry(2.6, 1.5);
        spillGeo.rotateX(-Math.PI / 2);
        const spill = mesh(spillGeo, spillMat, PLAT_X0 + 1.4, PLAT_Y + 0.012, doorZ(DOOR_U[0]));
        scene.add(spill); world.ghost(spill);
        car.userData.spill = spillMat;

        /* The two lights you actually see first and last.
           At a hundred metres in this fog there is no tram, no rails and no
           overhead — there is a smear of white where a tram is going to be,
           and later a smear of red where one was. Fog is off for these on
           purpose: they are what survives it. */
        const haloTex = tex(128, 128, (c, W, H) => {
            c.clearRect(0, 0, W, H);
            const g = c.createRadialGradient(W / 2, H / 2, 1, W / 2, H / 2, W / 2);
            g.addColorStop(0, 'rgba(255,255,255,1)');
            g.addColorStop(0.10, 'rgba(255,255,255,0.72)');
            g.addColorStop(0.34, 'rgba(190,215,255,0.20)');
            g.addColorStop(1, 'rgba(120,160,230,0)');
            c.fillStyle = g; c.fillRect(0, 0, W, H);
        });
        const makeHalo = (col, x, y, z) => {
            const m = new THREE.SpriteMaterial({
                map: haloTex, color: col, transparent: true, opacity: 0,
                depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
            });
            const s = new THREE.Sprite(m);
            s.position.set(x, y, z);
            s.renderOrder = 12;
            car.add(s); world.ghost(s);
            return s;
        };
        car.userData.headHalo = makeHalo(new THREE.Color(0xcfe2ff), 0, 1.22, NOSE_Z - 0.4);
        car.userData.tailHalo = makeHalo(new THREE.Color(0xff5a2a), 0, 1.20, TAIL_Z + 0.4);

        /* ---- the mist a tram throws off standing water -------------------
           Only when it is moving, and lit by the same ten sources as the rain,
           so it is white where the lamps are and nothing at all where they
           aren't. One instanced draw, riding in the tram's own frame. */
        {
            const N = 210;
            const quad = new THREE.PlaneGeometry(1, 1);
            const g = new THREE.InstancedBufferGeometry();
            g.setIndex(quad.index);
            g.setAttribute('position', quad.attributes.position);
            g.setAttribute('uv', quad.attributes.uv);
            g.instanceCount = N;
            const seed = new Float32Array(N * 3), life = new Float32Array(N * 2);
            for (let i = 0; i < N; i++) {
                seed[i * 3] = (i % 2 ? 1 : -1) * rr(0.55, 1.45);
                seed[i * 3 + 1] = rr(0.02, 0.42);
                seed[i * 3 + 2] = rr(NOSE_Z - 0.6, TAIL_Z + 1.4);
                life[i * 2] = rr(0.55, 1.30);      // rate
                life[i * 2 + 1] = rr(0.30, 0.95);  // size
            }
            g.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seed, 3));
            g.setAttribute('aLife', new THREE.InstancedBufferAttribute(life, 2));
            const sprayMat = new THREE.ShaderMaterial({
                transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
                uniforms: Object.assign(pick('uTime', 'uLPos', 'uLCol', 'uLStr', 'uLRad'), {
                    uSpray: { value: 0 }, uBase: { value: srgb(0x141c28) },
                }),
                vertexShader: /* glsl */`
                  #define NL ${NL}
                  attribute vec3 aSeed; attribute vec2 aLife;
                  uniform float uTime, uSpray;
                  uniform vec3 uLPos[NL]; uniform vec3 uLCol[NL];
                  uniform float uLStr[NL]; uniform float uLRad[NL];
                  varying vec2 vUvv; varying vec3 vLit; varying float vA;
                  void main(){
                    vUvv = uv;
                    float k = fract(aSeed.z * 0.137 + aSeed.x * 2.31 + uTime * aLife.x);
                    vec3 P = aSeed;
                    P.x += sign(aSeed.x) * k * 1.35;
                    P.y += k * k * 1.05 + 0.10;
                    P.z += k * 3.6;                       // dragged out behind
                    vec4 wp = modelMatrix * vec4(P, 1.0);
                    vec3 lit = vec3(0.0);
                    for (int i = 0; i < NL; i++) {
                      vec3 d = uLPos[i] - wp.xyz;
                      float dd = dot(d, d);
                      lit += uLCol[i] * (uLStr[i] / (1.0 + dd / (uLRad[i] * uLRad[i] * 1.8)));
                    }
                    vLit = lit * 0.24;
                    // and it goes when the fog goes, or there is mist hanging in
                    // the air around a tram nobody can see any more
                    float dCam = distance(cameraPosition, wp.xyz);
                    vA = uSpray * sin(k * 3.14159) * (0.35 + 0.65 * aLife.y)
                       * (1.0 - smoothstep(40.0, 92.0, dCam));
                    vec4 mv = viewMatrix * wp;
                    mv.xy += position.xy * (aLife.y * (0.42 + k * 1.7));
                    gl_Position = projectionMatrix * mv;
                  }`,
                fragmentShader: /* glsl */`
                  uniform vec3 uBase;
                  varying vec2 vUvv; varying vec3 vLit; varying float vA;
                  void main(){
                    vec2 q = vUvv * 2.0 - 1.0;
                    float a = 1.0 - smoothstep(0.15, 1.0, length(q));
                    a *= a * vA;
                    vec3 col = uBase + vLit;
                    gl_FragColor = vec4(col * a * 1.8, a);
                  }`,
            });
            const sprayMesh = mesh(g, sprayMat);
            sprayMesh.frustumCulled = false;
            sprayMesh.renderOrder = 7;
            car.add(sprayMesh);
            car.userData.spray = sprayMat.uniforms.uSpray;
        }

        scene.add(tram);
        world.part('tram_00', tram);
        // A tram that moves must not be baked into the walk's collision grid —
        // it would leave a wall standing at the stop long after it had gone,
        // and put a second one wherever it happened to be. So the whole car is
        // a ghost, and the platform it stands beside is what anyone stands on.
        tram.traverse((o) => world.ghost(o));
    }

    /* ============================================================
       13 · overhead — masts and wire, disappearing both ways
       ============================================================ */
    {
        const mastParts = [];
        const mast = new THREE.CylinderGeometry(0.085, 0.13, 7.6, 8);
        put(mast, 0, 3.8, 0); mastParts.push(mast);
        const arm = new THREE.CylinderGeometry(0.045, 0.05, 7.0, 6);
        arm.rotateZ(Math.PI / 2);
        put(arm, 3.5, 7.0, 0); mastParts.push(arm);
        const stay = new THREE.CylinderGeometry(0.022, 0.022, 3.1, 5);
        put(stay, 1.55, 6.2, 0, 0, 0, -0.62); mastParts.push(stay);
        for (const lx of [2.70, 6.05]) {                 // droppers down to the messenger
            const d = new THREE.CylinderGeometry(0.018, 0.018, 0.40, 4);
            put(d, lx, 6.80, 0); mastParts.push(d);
        }
        const mastGeo = mergeGeometries(mastParts);

        const count = 21;
        const im = new THREE.InstancedMesh(mastGeo, steelGreen, count);
        for (let i = 0; i < count; i++) {
            const z = -320 + i * 32;
            im.setMatrixAt(i, M(-6.05, 0.0, z));
        }
        im.instanceMatrix.needsUpdate = true;
        scene.add(im);

        // contact wire, messenger, droppers — thin lines read better than tubes here
        const pts = [];
        for (const c of [TRK_A, TRK_B]) {
            const stag = c === TRK_A ? 0.22 : -0.20;
            for (let z = -LINE_FAR; z < LINE_FAR - 16; z += 16) {
                const a = c + stag * Math.sin(z * 0.0982), b = c + stag * Math.sin((z + 16) * 0.0982);
                pts.push(a, 5.66, z, b, 5.66, z + 16);
                pts.push(a, 6.62, z, b, 6.62, z + 16);
            }
            for (let z = -140; z < 140; z += 8) {
                const a = c + stag * Math.sin(z * 0.0982);
                pts.push(a, 5.66, z, a, 6.62, z);
            }
        }
        const wg = new THREE.BufferGeometry();
        wg.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
        const wires = new THREE.LineSegments(wg, new THREE.LineBasicMaterial({
            color: srgb(0x39424f), transparent: true, opacity: 0.85, fog: true,
        }));
        scene.add(wires);
        world.ghost(wires);
    }

    /* ============================================================
       14 · fences, footpath railing, and the bush that swallows the light
       ============================================================ */
    const chainTex = tex(128, 128, (c, W, H) => {
        c.clearRect(0, 0, W, H);
        c.strokeStyle = '#9aa4ac'; c.lineWidth = 4.5; c.lineCap = 'round';
        for (let i = -2; i < 4; i++) {
            c.beginPath(); c.moveTo(i * 64, 0); c.lineTo(i * 64 + 128, 128); c.stroke();
            c.beginPath(); c.moveTo(i * 64, 128); c.lineTo(i * 64 + 128, 0); c.stroke();
        }
    }, 1, 1);
    chainTex.wrapS = chainTex.wrapT = THREE.RepeatWrapping;

    {
        const chainMat = new THREE.MeshStandardMaterial({
            map: chainTex, color: srgb(0x565d63), roughness: 0.62, metalness: 0.55,
            transparent: true, alphaTest: 0.45, side: THREE.DoubleSide,
        });
        const FL = 170;
        for (const [fx, h] of [[FENCE_W, 1.55], [FENCE_E, 1.85]]) {
            const t = chainTex.clone();
            t.wrapS = t.wrapT = THREE.RepeatWrapping;
            t.repeat.set(FL / 0.55, h / 0.55);
            t.needsUpdate = true;
            const m = chainMat.clone(); m.map = t;
            const p = mesh(new THREE.PlaneGeometry(FL, h), m, fx, h / 2 + 0.05, -34, 0, Math.PI / 2);
            scene.add(p);
        }
        // posts and top rails
        const postGeo = new THREE.CylinderGeometry(0.035, 0.035, 1.9, 7);
        const perSide = Math.floor(170 / 3.0) + 1;
        const im = new THREE.InstancedMesh(postGeo, steelDark, perSide * 2);
        let i = 0;
        for (const [fx, h] of [[FENCE_W, 1.55], [FENCE_E, 1.85]]) {
            for (let k = 0; k < perSide; k++) {
                const z = -34 - 85 + k * 3.0;
                im.setMatrixAt(i++, M(fx, (h + 0.14) / 2, z, 0, 0, 0, 1, (h + 0.14) / 1.9, 1));
            }
        }
        im.count = i;
        im.instanceMatrix.needsUpdate = true;
        scene.add(im); world.ghost(im);
        const railBits = [];
        for (const [fx, h] of [[FENCE_W, 1.55], [FENCE_E, 1.85]]) {
            const g = new THREE.CylinderGeometry(0.032, 0.032, 170, 6);
            put(g, fx, h + 0.09, -34, Math.PI / 2, 0, 0);
            railBits.push(g);
        }
        scene.add(mesh(mergeGeometries(railBits), steelDark));
    }

    {   // the pipe railing between the path and the drop, as in the photograph
        const bits = [];
        for (let k = 0; k < 26; k++) {
            const z = -22 + k * 2.6;
            const p = new THREE.CylinderGeometry(0.030, 0.030, 1.05, 7);
            put(p, 6.15, 0.63, z); bits.push(p);
        }
        const top = new THREE.CylinderGeometry(0.036, 0.036, 67, 7);
        put(top, 6.15, 1.13, 10.5, Math.PI / 2, 0, 0); bits.push(top);
        const mid = new THREE.CylinderGeometry(0.028, 0.028, 67, 6);
        put(mid, 6.15, 0.72, 10.5, Math.PI / 2, 0, 0); bits.push(mid);
        scene.add(mesh(mergeGeometries(bits), steelGreen));
    }

    {   // eucalypts — a wall of near-black that the lamps refuse to reach
        const parts = [];
        const trunk = new THREE.CylinderGeometry(0.13, 0.26, 7.0, 6);
        put(trunk, 0, 3.5, 0); parts.push(trunk);
        for (let i = 0; i < 3; i++) {
            const b = new THREE.CylinderGeometry(0.05, 0.10, 3.0, 5);
            put(b, Math.cos(i * 2.1) * 0.8, 6.4, Math.sin(i * 2.1) * 0.8, 0.5 * Math.sin(i * 2.1), i * 2.1, 0.5 * Math.cos(i * 2.1));
            parts.push(b);
        }
        for (let i = 0; i < 6; i++) {
            const a = i * 1.05, r = 1.1 + (i % 3) * 0.55;
            const c = new THREE.IcosahedronGeometry(1.5 + (i % 4) * 0.42, 0);
            put(c, Math.cos(a) * r, 7.4 + Math.sin(i * 1.7) * 1.5, Math.sin(a) * r,
                i * 0.5, i * 0.9, i * 0.3, 1.25, 0.72, 1.25);
            parts.push(c);
        }
        // Made alike before merging. `IcosahedronGeometry` comes out non-indexed
        // and the cylinders come out indexed; `mergeGeometries` refuses a mixed
        // list and answers null — which is an InstancedMesh with no geometry, and
        // a viewport that dies the first time anything touches it.
        const treeGeo = mergeGeometries(parts.map((g) => (g.index ? g.toNonIndexed() : g)));
        const treeMat = new THREE.MeshStandardMaterial({ color: srgb(0x111d15), roughness: 1.0, flatShading: true });
        const im = new THREE.InstancedMesh(treeGeo, treeMat, 44);
        const col = new THREE.Color();
        for (let i = 0; i < 44; i++) {
            const east = i % 2 === 0;
            const x = east ? rr(FENCE_E + 1.4, FENCE_E + 22) : rr(FENCE_W - 1.6, FENCE_W - 20);
            const z = rr(-105, 55);
            const s = rr(0.75, 1.55);
            im.setMatrixAt(i, M(x, groundHeight(x, z) - 0.2, z, rr(-0.05, 0.05), rr(0, 6.28), rr(-0.05, 0.05), s, s * rr(0.85, 1.35), s));
            const g = rr(0.55, 1.25); col.setRGB(g * 0.9, g, g * 0.85);
            im.setColorAt(i, col);
        }
        im.instanceMatrix.needsUpdate = true;
        if (im.instanceColor) im.instanceColor.needsUpdate = true;
        scene.add(im); world.ghost(im);
    }

    {   // scrub along the fence lines
        const bushGeo = new THREE.IcosahedronGeometry(0.62, 0);
        const bushMat = new THREE.MeshStandardMaterial({ color: srgb(0x18261a), roughness: 1.0, flatShading: true });
        const im = new THREE.InstancedMesh(bushGeo, bushMat, 150);
        for (let i = 0; i < 150; i++) {
            const east = i % 2 === 0;
            const x = east ? rr(FENCE_E + 0.4, FENCE_E + 8) : rr(FENCE_W - 0.4, FENCE_W - 7);
            const z = rr(-95, 50);
            im.setMatrixAt(i, M(x, groundHeight(x, z) + rr(0.05, 0.35), z, rr(0, 3), rr(0, 3), rr(0, 3),
                rr(0.6, 1.6), rr(0.45, 1.0), rr(0.6, 1.6)));
        }
        im.instanceMatrix.needsUpdate = true;
        scene.add(im); world.ghost(im);
    }

    {   // weeds through the ballast, where nobody sprays any more
        const bladeGeo = new THREE.PlaneGeometry(0.05, 0.42, 1, 2);
        bladeGeo.translate(0, 0.21, 0);
        const grassMat = new THREE.MeshStandardMaterial({
            color: srgb(0x2b3520), roughness: 1.0, side: THREE.DoubleSide,
        });
        const im = new THREE.InstancedMesh(bladeGeo, grassMat, 420);
        for (let i = 0; i < 420; i++) {
            const x = rr(-6.4, 1.5), z = rr(-80, 46);
            im.setMatrixAt(i, M(x, groundHeight(x, z) - 0.02, z, rr(-0.2, 0.2), rr(0, 3.14), rr(-0.3, 0.3),
                1, rr(0.5, 1.5), 1));
        }
        im.instanceMatrix.needsUpdate = true;
        scene.add(im); world.ghost(im);
    }

    /* ============================================================
       15 · the rain
       ============================================================ */
    const RAIN_GLSL_V = /* glsl */`
      #define NL ${NL}
      attribute vec3 aSeed;
      attribute float aScale;
      uniform float uTime, uR, uH, uY0, uThick, uLen, uSpeed;
      uniform vec2 uWind;
      uniform vec3 uLPos[NL];
      uniform vec3 uLCol[NL];
      uniform float uLStr[NL];
      uniform float uLRad[NL];
      varying vec2 vUvv; varying vec3 vLit; varying float vA;
      void main(){
        vUvv = uv;
        vec3 c = cameraPosition;
        float sp = uSpeed * (0.72 + 0.55 * aScale);
        float y  = mod(aSeed.y - uTime * sp, uH);
        float fall = uH - y;
        float x = mod(aSeed.x + uWind.x * fall - c.x + uR, 2.0 * uR) - uR + c.x;
        float z = mod(aSeed.z + uWind.y * fall - c.z + uR, 2.0 * uR) - uR + c.z;
        vec3 P = vec3(x, y + uY0, z);

        vec3 dir = normalize(vec3(uWind.x, -1.0, uWind.y));
        vec3 toC = c - P;
        vec3 rv = cross(dir, toC);
        float rl = length(rv);
        vec3 rightv = rl > 1e-4 ? rv / rl : vec3(1.0, 0.0, 0.0);

        float lenS = uLen * (0.55 + 0.9 * aScale);
        vec3 wpos = P + rightv * (position.x * uThick) - dir * (position.y * lenS);

        vec3 lit = vec3(0.0);
        for (int i = 0; i < NL; i++) {
          vec3 d = uLPos[i] - P;
          float dd = dot(d, d);
          lit += uLCol[i] * (uLStr[i] / (1.0 + dd / (uLRad[i] * uLRad[i] * 2.4)));
        }
        vLit = lit;

        float dCam = length(toC);
        vA = smoothstep(0.30, 1.5, dCam) * (1.0 - smoothstep(uR * 0.55, uR * 0.98, dCam));

        gl_Position = projectionMatrix * viewMatrix * vec4(wpos, 1.0);
      }`;
    const RAIN_GLSL_F = /* glsl */`
      uniform vec3 uBase; uniform float uOpacity;
      varying vec2 vUvv; varying vec3 vLit; varying float vA;
      void main(){
        float a = 1.0 - abs(vUvv.x * 2.0 - 1.0);
        a *= smoothstep(0.0, 0.22, vUvv.y) * smoothstep(1.0, 0.55, vUvv.y);
        a *= vA;
        vec3 col = uBase + vLit * 0.65;
        gl_FragColor = vec4(col * a * uOpacity * 3.0, a * uOpacity);
      }`;

    function makeRain(count, R, H, Y0, thick, len, speed, opacity, base) {
        const quad = new THREE.PlaneGeometry(1, 1);
        const g = new THREE.InstancedBufferGeometry();
        g.setIndex(quad.index);
        g.setAttribute('position', quad.attributes.position);
        g.setAttribute('uv', quad.attributes.uv);
        g.instanceCount = count;
        const seed = new Float32Array(count * 3), sca = new Float32Array(count);
        for (let i = 0; i < count; i++) {
            seed[i * 3] = rr(-R, R);
            seed[i * 3 + 1] = rr(0, H);
            seed[i * 3 + 2] = rr(-R, R);
            sca[i] = rnd();
        }
        g.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seed, 3));
        g.setAttribute('aScale', new THREE.InstancedBufferAttribute(sca, 1));
        const mat = new THREE.ShaderMaterial({
            transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
            side: THREE.DoubleSide,
            uniforms: Object.assign(pick('uTime', 'uWind', 'uLPos', 'uLCol', 'uLStr', 'uLRad'), {
                uR: { value: R }, uH: { value: H }, uY0: { value: Y0 },
                uThick: { value: thick }, uLen: { value: len }, uSpeed: { value: speed },
                uOpacity: { value: opacity }, uBase: { value: base },
            }),
            vertexShader: RAIN_GLSL_V,
            fragmentShader: RAIN_GLSL_F,
        });
        const m = mesh(g, mat);
        m.frustumCulled = false;
        m.renderOrder = 8;
        scene.add(m);
        world.ghost(m);
        return m;
    }
    makeRain(4200, 46, 24, 0.0, 0.013, 0.85, 15.5, 0.30, srgb(0x1b2534));
    makeRain(1500, 13, 17, 0.0, 0.020, 1.35, 19.0, 0.22, srgb(0x212c3d));

    /* ============================================================
       16 · what moves
       ============================================================ */
    const _cam = new THREE.Vector3();
    const arcMat = car.userData.arc;
    const spillMat = car.userData.spill;
    const headHalo = car.userData.headHalo;
    const tailHalo = car.userData.tailHalo;
    const uSpray = car.userData.spray;
    const matA = tramSideMats[0], matB = tramSideMats[1];
    let arcT = 1.4;
    let doorsPainted = -1;

    /* Where the tram is, how fast it is going and how hard it is working —
       one answer per frame, written into a record made once, because the frame
       callback is not allowed to allocate. Position comes out of the physics
       rather than a keyframe, so the pitch of the body under the brake and the
       mist off its skirt are reading the same motion the eye is. */
    const SRV = { z: 0, v: 0, a: 0, door: 0, warn: 0, gone: 0 };
    function service(ct) {
        SRV.door = 0; SRV.warn = 0; SRV.gone = 0;
        if (ct < T_APPROACH) {                                   // out of the fog, and braking
            if (ct < T_COAST) { SRV.z = Z_IN - V_LINE * ct; SRV.v = -V_LINE; SRV.a = 0; }
            else {
                const b = ct - T_COAST;
                SRV.z = D_BRAKE - (V_LINE * b - 0.5 * A_BRAKE * b * b);
                SRV.v = -(V_LINE - A_BRAKE * b);
                SRV.a = A_BRAKE;
            }
            return;
        }
        ct -= T_APPROACH;
        if (ct < T_DWELL) {                                      // standing, doors open
            SRV.z = 0; SRV.v = 0; SRV.a = 0;
            const shut = T_DWELL - 3.2;
            SRV.door = smoothstep(0.5, 2.1, ct) * (1 - smoothstep(shut, shut + 1.5, ct));
            SRV.warn = smoothstep(shut - 1.8, shut - 1.3, ct) * (1 - smoothstep(shut + 1.4, shut + 1.7, ct));
            return;
        }
        ct -= T_DWELL;
        if (ct < T_DEPART) {                                     // away toward Vermont South
            const p = ct - T_HOLD;
            if (p <= 0) { SRV.z = 0; SRV.v = 0; SRV.a = 0; }
            else if (p < T_POWER) {
                SRV.z = -0.5 * A_POWER * p * p;
                SRV.v = -A_POWER * p;
                SRV.a = -A_POWER;
            } else {
                SRV.z = -(0.5 * A_POWER * T_POWER * T_POWER + V_LINE * (p - T_POWER));
                SRV.v = -V_LINE; SRV.a = 0;
            }
            return;
        }
        // and then nobody, for a while. Held far enough out that neither the
        // fog nor the tail-light halo has anything left to show.
        SRV.z = -D_OUT - 70; SRV.v = 0; SRV.a = 0; SRV.gone = 1;
    }

    world.frame((dt, t) => {
        camera.getWorldPosition(_cam);
        U.uCamPos.value.copy(_cam);
        U.uTime.value = t;

        // the gusts that make the rain lean, and the lamps swing a little
        const gx = 0.17 + 0.13 * Math.sin(t * 0.21) + 0.055 * Math.sin(t * 0.67 + 1.2);
        const gz = 0.05 + 0.07 * Math.sin(t * 0.17 + 2.1) + 0.03 * Math.sin(t * 0.49);
        U.uWind.value.set(gx, gz);

        /* ---- the tram ---------------------------------------------------- */
        service((t + T_START) % T_CYCLE);
        const speed = Math.abs(SRV.v);
        const sn = clamp(speed / V_LINE, 0, 1);

        car.position.z = SRV.z;
        car.rotation.x = -SRV.a * 0.0040;            // nose down on the brake, tail down under power
        const jz = SRV.z * 0.0755, jf = jz - Math.floor(jz);   // one kick per rail length
        car.position.y = sn * (0.010 * Math.sin(t * 3.7) + 0.018 * Math.exp(-jf * 16.0));
        car.rotation.z = sn * 0.0055 * Math.sin(t * 2.3 + 0.8);

        // five of the ten wet-ground mirrors are aboard, so the warm smear on
        // the concrete runs down the platform with it
        for (let k = 0; k < RIDE.length; k++) WL[RIDE[k]].p.z = RIDE_Z[k] + SRV.z;

        // the doorway: a slow open, then the closing lamps flashing over it
        const blink = SRV.warn > 0.01 ? (0.42 + 0.58 * (Math.sin(t * 11.0) > 0 ? 1 : 0)) : 1;
        const doorGlow = clamp(SRV.door + SRV.warn * 0.30, 0, 1) * blink;
        spillMat.opacity = 0.21 * doorGlow;
        U.uLStr.value[DOOR_WL] = DOOR_WL_S * doorGlow;

        // and the painted door, swapped at the two moments it actually changes
        const wantOpen = SRV.door > 0.5 ? 1 : 0;
        if (wantOpen !== doorsPainted) {
            doorsPainted = wantOpen;
            matA.emissiveMap = wantOpen ? sideEmisA : sideEmisShutA;
            matB.emissiveMap = wantOpen ? sideEmisB : sideEmisShutB;
            matA.needsUpdate = true; matB.needsUpdate = true;
        }

        // a smear of white where a tram is going to be; later a red one where
        // one was. Both live past the distance the fog eats everything else at.
        const ahead = Math.max(SRV.z, 0), behind = Math.max(-SRV.z, 0);
        const hh = smoothstep(28, 72, ahead) * smoothstep(195, 150, ahead);
        headHalo.material.opacity = 0.90 * hh;
        const hs = 1.2 + 3.2 * smoothstep(185, 45, ahead);
        headHalo.scale.set(hs, hs, 1);
        const th = smoothstep(14, 46, behind) * smoothstep(160, 108, behind);
        tailHalo.material.opacity = 0.72 * th;
        const ts = 0.9 + 2.0 * smoothstep(150, 30, behind);
        tailHalo.scale.set(ts, ts, 1);

        // mist off the skirt, only where there is speed to throw it
        uSpray.value = sn * sn * 0.42;

        // the board: NOW while it is coming or standing, a time once it isn't
        setPids(SRV.gone > 0.5 || SRV.z < -45 ? 1 : 0);
        pidsOff = (pidsOff - dt * 0.055) % 1;
        pidsFaces[pidsFace].offset.x = pidsOff;

        // fluorescent tubes never quite hold still
        const hum = 1.0 + 0.030 * Math.sin(t * 21.7) + 0.018 * Math.sin(t * 7.3 + 1.1);
        const dip = (vnoise(t * 0.9, 4.2) > 0.965) ? 0.55 : 1.0;
        lensMat.emissiveIntensity = 3.4 * hum * dip;
        platLight.intensity = 38 * hum * dip;
        platLight2.intensity = 32 * (2.0 - hum) * dip;

        // the tram's warmth breathes; the headlight is dipped at the stop and
        // comes back up as it pulls away
        const warm = 1.0 + 0.022 * Math.sin(t * 1.7) + 0.014 * Math.sin(t * 0.63 + 2.0);
        matA.emissiveIntensity = 2.55 * warm;
        matB.emissiveIntensity = 2.55 * warm;
        tramWarm.intensity = 27 * warm * (0.58 + 0.42 * doorGlow);
        const beam = 0.40 + 0.60 * smoothstep(0.4, 5.5, speed);
        headSpot.intensity = 620 * beam * (1.0 + 0.012 * Math.sin(t * 2.3));
        U.uLStr.value[9] = 0.95 * beam;

        // a blue crack at the pantograph shoe — rare standing, often under power
        arcT -= dt;
        if (arcT <= 0) {
            arcT = speed > 1.0 ? rr(0.7, 3.4) : rr(4.5, 13.0);
            arcMat.opacity = 0.95;
        } else if (arcMat.opacity > 0) arcMat.opacity = Math.max(0, arcMat.opacity - dt * 6.5);
    });
}
