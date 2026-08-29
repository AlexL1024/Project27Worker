//
//  flinders-swanston.scene.js
//  Project27 — "Flinders & Swanston"
//
//  Melbourne, the corner of Flinders and Swanston, at about twenty to five on a
//  wet afternoon. The rain has been falling long enough that the asphalt has
//  stopped absorbing it and started returning the sky, every light in the city
//  is on two hours early, and the four o'clock crowd is standing at the kerb
//  under a hundred black umbrellas waiting for the scramble.
//
//  North is −Z, east is +X, one unit is one metre, and the ground plane is the
//  roadway at y = 0. The four quadrants are the whole brief:
//
//      Q2  Young & Jackson   │   Q1  St Paul's Cathedral       (north side)
//      ──────────────────────┼────────────────────── Flinders Street
//      Q3  Flinders St Stn   │   Q4  Federation Square         (south side)
//                        Swanston Street
//
//  and Swanston Street runs on south over Princes Bridge to become St Kilda
//  Road, and north past Flinders Lane, Collins Street and Little Collins until
//  the rain closes over it.
//
//  What this module actually spends its effort on:
//
//    · the road. One shader, one 240 m canvas of hand-drawn line marking — lane
//      lines, the scramble crossing and its two diagonals, the green bike
//      lanes, the tram grooves and the four connecting curves — laid over an
//      analytic street layout that carries the same asphalt out to the cross
//      streets. On top of that a wet-surface model: the overcast sky mirrored
//      with a Fresnel weight, because in daylight a wet road is mostly a
//      picture of the clouds, plus ten named light sources smeared along the
//      camera→light axis the way standing water does it, and rain rings
//      expanding where the eye is close enough to see them.
//    · Flinders Street Station, read from the ground up the way the building
//      actually reads: granite plinth, the shopfronts under the verandah, the
//      great arcade of round-arched windows, the brick field, the cornice with
//      its dentils, the balustraded parapet, and at the corner the giant arch
//      with the indicator clocks set back inside it under the dome.
//    · everything static merged per material. The station is fifteen meshes and
//      about nine hundred pieces of geometry; the cathedral is five.
//    · the traffic. Trams that brake for the signals and dwell at Stop 13,
//      cars and bikes as instanced fleets, a hundred pedestrians who wait at
//      the corners and then cross diagonally when the scramble comes up — all
//      of it driven by one eight-phase signal cycle that the four mast signals
//      are showing at the same time.
//    · four real-time lights, total. The lamps, the signals, the tram
//      headlights, the LED billboards and the concourse mouth are emissive
//      materials, and world.bloom carries the shine.
//
//  Ported from a hand-built page that owned its own renderer and ran on
//  three r128. What that page did with a canvas, a slider and eleven camera
//  presets, this does with one committed hour and one committed weather.
//

import { mergeGeometries } from './BufferGeometryUtils.js';

export default function build(world) {
    const { THREE, scene, camera } = world;

    world.ownsSky(true);
    world.groundLevel(0);
    // Daylight, so the threshold sits high: the grey sky must not bloom, but the
    // signal aspects, the billboards and the destination boxes must.
    world.bloom({ strength: 0.36, radius: 0.72, threshold: 0.80 });

    /* ============================================================
       0 · helpers
       ============================================================ */

    // Every colour in this file is written the way a designer reads one — sRGB
    // hex, off a paint chip — and converted once, here, because the renderer
    // works in linear space and a hex typed straight into a material is a
    // colour nobody chose.
    const srgb = (hex) => new THREE.Color(hex).convertSRGBToLinear();
    /* And a second reading of the same paint chip, honest about what three
       already did with it. `new THREE.Color(hex)` has converted sRGB into the
       renderer's linear working space by itself since r152 — colour management
       is on by default — so `srgb` above converts a second time, and a second
       conversion is not a small error: it costs 0x9aa2a8 a factor of 3.8 and
       0x3a3c40 a factor of 12.9. Every dark colour in this world is crushed
       and every pale one is barely touched, which is why the world has facades
       but no midtones. Every albedo here has been lit and tuned against that,
       and re-reading all of them at once would be a re-grade rather than a
       fix, so they stay as they are. The sky and the fog cannot stay: nothing
       lights them, their colour goes to the screen exactly as it is written,
       and read twice the overcast at twenty to five came out at fourteen
       greylevels overhead. That is not a wet afternoon, it is midnight, and it
       is most of why this world has been reading as one. */
    const daylight = (hex) => new THREE.Color(hex);
    const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
    const lerp = (a, b, t) => a + (b - a) * t;
    const smoothstep = (e0, e1, x) => { const t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };

    // Deterministic, so the same tram carries the same fleet number and the
    // same puddle sits in the same place every time anybody opens this world.
    let _seed = 19540904;                          // the day the station clock tower was finished, near enough
    const rnd = () => { _seed = (_seed * 1664525 + 1013904223) % 4294967296; return _seed / 4294967296; };
    const rr = (a, b) => a + (b - a) * rnd();
    const irr = (a, b) => Math.floor(rr(a, b + 0.999));
    const pickOf = (a) => a[Math.floor(rnd() * a.length)];

    const _q = new THREE.Quaternion();
    const _e = new THREE.Euler();
    const _v = new THREE.Vector3();
    const _s = new THREE.Vector3(1, 1, 1);
    const MX = (x, y, z, rx, ry, rz, sx, sy, sz) => {
        _e.set(rx || 0, ry || 0, rz || 0);
        return new THREE.Matrix4().compose(
            _v.set(x || 0, y || 0, z || 0), _q.setFromEuler(_e),
            _s.set(sx === undefined ? 1 : sx, sy === undefined ? 1 : sy, sz === undefined ? 1 : sz));
    };

    // Geometry factories. Everything static in this world is built as loose
    // geometry, moved into place with `put`, and merged per material at the end
    // of its section — so a facade of four hundred mouldings is one draw call.
    const boxG = (w, h, d) => new THREE.BoxGeometry(w, h, d);
    const cylG = (rt, rb, h, seg) => new THREE.CylinderGeometry(rt, rb, h, seg || 12);
    const coneG = (r, h, seg) => new THREE.ConeGeometry(r, h, seg || 8);
    const sphG = (r, w, h) => new THREE.SphereGeometry(r, w || 12, h || 9);
    const put = (g, x, y, z, rx, ry, rz, sx, sy, sz) => g.applyMatrix4(MX(x, y, z, rx, ry, rz, sx, sy, sz));

    /* Merging is where a city fits inside a mesh budget, and it is also where a
       world quietly dies: mergeGeometries answers null the moment the list
       mixes indexed with non-indexed geometry, and three's own primitives
       disagree about that. A null geometry is a mesh with no position
       attribute, which takes the whole viewport down with it — so everything
       is normalised on the way in, every time, without asking what it is. */
    const merge = (parts) => mergeGeometries(parts.map((g) => (g.index ? g.toNonIndexed() : g)));

    const mesh = (geo, mat, x, y, z, rx, ry, rz) => {
        const m = new THREE.Mesh(geo, mat);
        m.position.set(x || 0, y || 0, z || 0);
        m.rotation.set(rx || 0, ry || 0, rz || 0);
        return m;
    };
    const merged = (parts, mat, x, y, z) => mesh(merge(parts), mat, x, y, z);

    // A repeating texture on merged boxes needs the repeat baked into the UVs,
    // because a merged mesh has one material and one repeat but a hundred
    // differently-sized faces. Scaling the attribute per piece before the merge
    // is what keeps a band course the same height on a 9 m tower and a 50 m nave.
    const uvScale = (g, sx, sy) => {
        const uv = g.attributes.uv;
        for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * sx, uv.getY(i) * sy);
        return g;
    };

    const stdMat = (hex, o) => {
        const p = Object.assign({ color: srgb(hex), roughness: 0.92, metalness: 0.0 }, o || {});
        if (p.emissive !== undefined && typeof p.emissive === 'number') p.emissive = srgb(p.emissive);
        return new THREE.MeshStandardMaterial(p);
    };

    const tex = (w, h, draw, rx, ry) => {
        const t = world.canvasTexture(w, h, (g, cv) => draw(g, cv.width, cv.height));
        if (rx) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry || 1); }
        return t;
    };

    /* ============================================================
       1 · the plan — every dimension measured off the real corner
       ============================================================ */
    const SW = 11.5;              // Swanston Street roadway half-width
    const FL = 13.5;              // Flinders Street roadway half-width
    const FP = 7.0;               // footpath width
    const BX = SW + FP;           // 18.5 — the building line either side of Swanston
    const BZ = FL + FP;           // 20.5 — and either side of Flinders
    const TRS = 3.70;             // Swanston track centre, off the street axis
    const TRF = 4.30;             // Flinders track centre
    const RAIL = 1.435 / 2;       // standard gauge, half
    const WIRE_H = 5.90;          // trolley wire
    const KERB_H = 0.16;
    const XLEN = 240;             // the square the road texture covers
    const STOPL = 6.6;            // stop line, beyond the roadway edge

    const RIV_N = 138, RIV_S = 232;    // the Yarra's two banks
    const WATER = -8.2;                // water level below street
    const BR_W = 30, BR_Y = 0.45;      // Princes Bridge deck

    // Swanston Street carried north, measured from the Flinders kerb line.
    const NST = [
        { z: -115, h: 5.2, tram: false },     // Flinders Lane, one way east→west
        { z: -230, h: 13.5, tram: true },     // Collins Street, two way, trams both ways
        { z: -345, h: 5.6, tram: false },     // Little Collins Street
    ];
    const NX = 158;               // how far east and west each cross street runs
    const NZ_END = -404;

    // 101 Collins Street, on this scene's simplified Hoddle Grid.
    const C101 = { x: 345, z: -146, W: 47, D: 40, H: 188, H2: 200, TIP: 260 };

    const C = {
        asphalt: 0x3a3c40, paving: 0x9d9a94, kerb: 0x6f6d6a, rail: 0x9a9187,
        stone: 0xd9ccb3, stoneHi: 0xefe6d3, brick: 0xa16852, copper: 0x4f9e83,
        sand: 0xdccba6, sandBand: 0xc09a6b, spire: 0xb9765a, slate: 0x4a4f55,
        pubWall: 0xe7d3c2, pubTrim: 0x2f6b4f, zinc: 0x7d838a, fedSand: 0xc8ac82,
        trunk: 0x6b6155, leaf: 0x4d6b34, pole: 0x4b4f52,
    };

    /* The weather, said once. Everything downstream — the sky shader, the wet
       road, the rain, the standard materials' own fog — reads these four
       numbers, so the horizon in the shader and the horizon in three's fog are
       the same horizon rather than two that nearly agree. */
    const FOG_COL = daylight(0x9aa2a8);
    const FOG_NEAR = 34, FOG_FAR = 470;
    scene.fog = new THREE.Fog(FOG_COL.clone(), FOG_NEAR, FOG_FAR);

    // Where the sun is behind all that cloud: west-north-west and low, which is
    // where 16:40 in a Melbourne winter puts it, and which is why the western
    // faces of everything are the pale ones.
    const SUN = new THREE.Vector3(-0.763, 0.450, -0.458).normalize();

    camera.position.set(46, 12, 44);

    /* ------------------------------------------------------------
       The ten light sources the wet road knows about.

       Only two of them are real lights. All ten write reflections,
       because a reflection costs a few instructions in a shader the
       ground is already running and a PointLight costs a full pass
       over every lit fragment in the scene.
       ------------------------------------------------------------ */
    const WL = [];
    const addWL = (x, y, z, col, str, rad) => WL.push({ p: new THREE.Vector3(x, y, z), c: col.clone(), s: str, r: rad });
    const C_WARM = srgb(0xffc98a);
    const C_COLD = srgb(0xdfeaf8);

    addWL(-27.8, 5.4, 29.8, C_WARM, 1.30, 16.0);              // 0  the station's concourse mouth
    addWL(-20.6, 5.2, -22.6, srgb(0xffd9a2), 0.72, 12.0);     // 1  Young & Jackson's ground floor
    addWL(-26.5, 30.4, -41.6, srgb(0xff6a48), 0.85, 26.0);    // 2  the two LED billboards up Swanston
    addWL(-40.0, 30.4, -42.4, srgb(0x3aa4f0), 0.80, 26.0);    // 3
    addWL(74.0, 8.4, 51.6, srgb(0x5f9ad2), 0.60, 20.0);       // 4  Fed Square's big screen
    addWL(-6.66, 3.05, 50.0, C_COLD, 0.62, 9.0);              // 5  Stop 13, the western shelters
    addWL(6.66, 3.05, 78.0, C_COLD, 0.62, 9.0);               // 6  and the eastern
    addWL(0, 1.25, 0, C_COLD, 0.95, 8.0);                     // 7  three tram headlights, which travel
    addWL(0, 1.25, 0, C_COLD, 0.95, 8.0);                     // 8
    addWL(0, 1.25, 0, C_COLD, 0.95, 8.0);                     // 9
    const HEAD_WL = [7, 8, 9];

    const U = {
        uTime: { value: 0 },
        uCamPos: { value: new THREE.Vector3(46, 12, 44) },
        uWind: { value: new THREE.Vector2(0.26, 0.09) },
        uFogCol: { value: FOG_COL.clone() },
        uFogNear: { value: FOG_NEAR },
        uFogFar: { value: FOG_FAR },
        uSkyLo: { value: srgb(0x9fa8ae) },        // the grey the ground sits in
        uSkyHi: { value: srgb(0x6f767c) },        // and the darker grey it mirrors overhead
        uSun: { value: SUN.clone() },
        uLPos: { value: WL.map((l) => l.p) },
        uLCol: { value: WL.map((l) => l.c) },
        uLStr: { value: WL.map((l) => l.s) },
        uLRad: { value: WL.map((l) => l.r) },
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

    // Rain rings. Two grids of impacts, each cell firing on its own hashed
    // phase — a thousand separate raindrops would be a thousand draw calls, and
    // this is the same picture for the price of an fbm.
    const RIPPLE_GLSL = /* glsl */`
      float ripple(vec2 p, float t){
        float acc = 0.0;
        for (int k = 0; k < 2; k++) {
          float fk = float(k);
          float sc = 1.55 + fk * 2.9;
          vec2 q = p * sc + fk * 23.7;
          vec2 id = floor(q), f = fract(q) - 0.5;
          float ph = h21(id + fk * 7.3);
          float tt = fract(t * 1.35 + ph);
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

    /* The wet ground, analytically.

       A wet road at night is a row of lamps smeared towards you. A wet road at
       four in the afternoon is something else: it is mostly a low-contrast
       photograph of the overcast sky, weighted by Fresnel so it brightens
       towards the horizon and almost vanishes underfoot — which is why the
       street reads as a mirror down the block and as dark asphalt at your feet.
       So the sky term comes first and carries the look, and the ten sources are
       accents laid over it, each one stretched along the camera→light axis with
       a perpendicular width that grows with the source's height and distance. */
    const WET_GLSL = /* glsl */`
      #define NL ${NL}
      uniform vec3  uLPos[NL];
      uniform vec3  uLCol[NL];
      uniform float uLStr[NL];
      uniform float uLRad[NL];
      uniform vec3  uSkyLo, uSkyHi;
      vec3 skyMirror(vec3 wp, vec3 cp, float rip){
        vec3 V = normalize(cp - wp);
        float f = pow(1.0 - clamp(V.y + rip * 0.22, 0.0, 1.0), 3.4);
        return mix(uSkyHi, uSkyLo, clamp(0.35 + f * 0.85, 0.0, 1.0)) * (0.30 + 1.35 * f);
      }
      void wetLight(vec3 wp, vec3 cp, float rip, float gloss, out vec3 diff, out vec3 spec){
        diff = vec3(0.0); spec = vec3(0.0);
        vec2 c = cp.xz;
        float H = max(cp.y - wp.y, 0.25);
        // The same Fresnel weight skyMirror uses, and for the same reason: what
        // standing water hands back is strong at a grazing angle and next to
        // nothing straight down. Without it every smear ran at full strength in
        // the metre in front of the camera — which is exactly where the road
        // fills most of the screen — so ten accents drowned the sky they were
        // supposed to be laid on top of.
        float fres = pow(1.0 - clamp(normalize(cp - wp).y, 0.0, 1.0), 3.4);
        for (int i = 0; i < NL; i++) {
          vec3  lp = uLPos[i];
          vec3  lc = uLCol[i];
          float ls = uLStr[i];
          float lr = uLRad[i];

          vec3  dv = lp - wp;
          float dd = dot(dv, dv);
          float dl = sqrt(dd) + 1e-4;
          // The lesson the specular streak below already learned, and about the
          // same two panels. A rational falloff never actually reaches zero, so
          // a source with a thirty-metre radius was still laying an eighth of
          // its colour on the road a hundred metres off — while the sky term
          // this is all supposed to be an accent on sits at about 0.06. One
          // billboard is red and the other is blue, both of them are thirty
          // metres up, and the two floods overlapped along the whole run of
          // Swanston Street: red and blue over a pale surface is lilac, and
          // that is what the footpaths and the carriageway had gone.
          //
          // 1.9 radii is fifty metres for a billboard and seventeen for the
          // pub's ground floor. It keeps the pool of colour directly under a
          // source — which is the whole reason the source is in this list —
          // and ends it at the next kerb rather than at the cathedral.
          float reach = 1.0 - smoothstep(lr * 0.9, lr * 1.9, dl);
          diff += lc * (ls / (1.0 + dd / (lr * lr))) * clamp(dv.y / dl, 0.0, 1.0) * reach;

          vec2  g  = lp.xz - c;
          float gl = max(length(g), 1e-3);
          vec2  dir = g / gl;
          float h  = max(lp.y - wp.y, 0.05);
          vec2  mp = c + dir * (gl * H / (H + h));
          vec2  qv = wp.xz - mp;
          float al = dot(qv, dir);
          float pe = dot(qv, vec2(-dir.y, dir.x)) + rip * 0.55;
          // min() keeps the exponents inside mediump range on the tiles that want it
          float w  = 0.10 + 0.050 * h + 0.016 * gl;
          float lat = exp(-min((pe * pe) / (w * w), 40.0));
          float lon = al > 0.0 ? exp(-min(al / (0.60 + h * 0.30), 40.0))
                               : exp(-min(-al / (1.9 + h * 1.6), 40.0));
          // Eighteen gave a source a specular reach of four times its own
          // radius, which let the two thirty-metre billboards lay saturated
          // colour over a hundred metres of Swanston Street. Six is still two
          // and a half radii — a long streak, but one that ends.
          //
          // It ended sixty-five metres out, though, and the middle of the
          // scramble crossing is fifty-seven metres from the billboards: the
          // smear was still arriving at the corner, and arriving there as red
          // laid over blue. The same window the diffuse pool uses closes it at
          // 1.9 radii instead, which is fifty metres — long enough to still
          // read as a smear down the wet street, short enough that it stops
          // before the crossing it was tinting lilac.
          spec += lc * ls * lat * lon * reach / (1.0 + dd / (lr * lr * 6.0));
        }
        spec *= gloss * fres;
      }
    `;

    // Linear fog, matching scene.fog exactly, because a custom shader that
    // invents its own falloff draws a visible seam where it meets a standard
    // material at the same distance.
    const FOG_GLSL = /* glsl */`
      uniform vec3 uFogCol; uniform float uFogNear; uniform float uFogFar;
      vec3 applyFog(vec3 col, float dist){
        float f = clamp((dist - uFogNear) / (uFogFar - uFogNear), 0.0, 1.0);
        return mix(col, uFogCol, f);
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
       3 · the sky — nimbostratus, and a city underneath it
       ============================================================ */
    const skyMat = new THREE.ShaderMaterial({
        side: THREE.BackSide, depthWrite: false, fog: false,
        uniforms: Object.assign(pick('uTime', 'uSun'), {
            uZen: { value: daylight(0x5c666e) },
            uMid: { value: daylight(0x8f979c) },
            uHor: { value: daylight(0xb6bbbc) },
            uWarm: { value: daylight(0xd8c8ab) },
        }),
        vertexShader: `varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
        fragmentShader: NOISE_GLSL + /* glsl */`
          varying vec3 vDir;
          uniform vec3 uZen, uMid, uHor, uWarm, uSun;
          uniform float uTime;
          void main(){
            vec3 d = normalize(vDir);
            float h = clamp(d.y, -1.0, 1.0);

            // An overcast sky is brightest just above the horizon and darkest
            // overhead, which is the opposite of a clear one and most of why a
            // grey day looks the way it does.
            vec3 col = mix(uHor, uMid, smoothstep(-0.04, 0.30, h));
            col = mix(col, uZen, smoothstep(0.18, 0.92, h));

            // ragged low cloud, dragged east on the same wind that leans the rain
            vec2 cp = d.xz / max(abs(h) + 0.14, 0.14);
            float c1 = fbm(cp * 0.42 + vec2(uTime * 0.0125, uTime * 0.0048));
            float c2 = fbm(cp * 1.15 - vec2(uTime * 0.0082, 0.0));
            float cloud = smoothstep(0.28, 0.82, c1 * 0.72 + c2 * 0.42);
            col *= 0.86 + cloud * 0.30;
            col -= vec3(0.030, 0.028, 0.024) * smoothstep(0.5, 1.0, cloud);

            // the sun is in there somewhere, west-north-west, and the cloud is
            // thin enough over it to go the colour of weak tea
            float s = max(dot(d, normalize(uSun)), 0.0);
            col += uWarm * pow(s, 3.2) * 0.14 * (1.0 - cloud * 0.55);

            // and below the horizon the dome just carries the fog, so the
            // ground plane running out of the world has nothing to meet
            col = mix(col, uHor * 0.86, smoothstep(0.0, -0.16, h));
            gl_FragColor = vec4(col, 1.0);
          }`,
    });
    {
        const sky = mesh(new THREE.SphereGeometry(2400, 36, 24), skyMat);
        sky.renderOrder = -20;
        scene.add(sky);
        world.ghost(sky);
    }

    /* ============================================================
       4 · lights — four, and no more

       On an overcast day the sky is the light: a hemisphere doing most of the
       work, a weak cold directional standing in for the sun behind the cloud,
       and two point lights where warm interior light visibly falls on wet
       pavement. Everything else that glows in this world glows because its
       material says so.
       ============================================================ */
    scene.add(new THREE.HemisphereLight(0xc4ced6, 0x555049, 1.95));
    scene.add(new THREE.AmbientLight(0xcbd6de, 0.30));

    const sun = new THREE.DirectionalLight(0xd6e0ea, 1.15);
    sun.position.copy(SUN).multiplyScalar(340);
    sun.castShadow = false;          // no sun means no shadows; the source page knew it too
    scene.add(sun);

    // The concourse mouth under the great arch, which on a wet afternoon is the
    // warmest thing on this corner and lies right across the footpath.
    const archLight = new THREE.PointLight(0xffc07a, 46, 30, 2);
    archLight.position.set(-27.4, 4.6, 29.4);
    scene.add(archLight);

    // Young & Jackson's ground floor, doing the same thing across the crossing.
    const pubLight = new THREE.PointLight(0xffcb8c, 26, 20, 2);
    pubLight.position.set(-20.4, 3.4, -22.4);
    scene.add(pubLight);

    // And the fourth: Stop 13's shelters. This is the one place in the world
    // where a person stands close enough to something lit to be lit by it, so
    // it is worth a real light rather than another emissive panel.
    const stopLight = new THREE.PointLight(0xdfeaf8, 30, 24, 2);
    stopLight.position.set(-6.66, 3.0, 52);
    scene.add(stopLight);

    /* ============================================================
       5 · canvas textures

       This is where most of the world's detail actually lives. Modelling a
       hundred and forty metres of line marking, a PTV livery, nine indicator
       clocks and a cast-iron verandah lace as geometry would cost thousands of
       triangles for something a canvas draws in a millisecond and a mip chain
       filters better than any polygon ever will.
       ============================================================ */

    const HOUR = 16, MINUTE = 40;    // the hour this world is committed to

    /* ---- the road surface, top-down: 2048 px over a 240 m square ---- */
    const roadTex = tex(2048, 2048, (g, S) => {
        const W = XLEN;
        const px = (x) => (x + W / 2) / W * S;
        const pz = (z) => (z + W / 2) / W * S;
        const u = (m) => m / W * S;
        const R = 7.0;                              // kerb corner radius
        let i, k, x, z;

        // footpath / plaza base, and its bluestone flagging
        g.fillStyle = '#9d9a94'; g.fillRect(0, 0, S, S);
        for (i = 0; i < 22000; i++) {
            g.fillStyle = 'rgba(0,0,0,' + (rnd() * 0.05) + ')';
            g.fillRect(rnd() * S, rnd() * S, 2, 2);
        }
        g.strokeStyle = 'rgba(0,0,0,.10)'; g.lineWidth = 1;
        for (i = -W / 2; i < W / 2; i += 1.2) {
            g.beginPath(); g.moveTo(px(i), 0); g.lineTo(px(i), S); g.stroke();
            g.beginPath(); g.moveTo(0, pz(i)); g.lineTo(S, pz(i)); g.stroke();
        }
        // the two quadrants that are not paving: Fed Square's sandstone and the
        // cathedral's forecourt
        g.fillStyle = 'rgba(150,120,80,.16)'; g.fillRect(px(BX), pz(BZ), u(W / 2 - BX), u(W / 2 - BZ));
        g.fillStyle = 'rgba(120,125,110,.10)'; g.fillRect(px(BX), 0, u(W / 2 - BX), u(W / 2 - BZ));

        // roadway
        g.fillStyle = '#3a3c40';
        g.fillRect(px(-SW), 0, u(SW * 2), S);
        g.fillRect(0, pz(-FL), S, u(FL * 2));
        const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
        for (k = 0; k < 4; k++) {                    // the rounded kerb fillets
            const sx = corners[k][0], sz = corners[k][1];
            g.beginPath();
            g.moveTo(px(sx * SW), pz(sz * FL));
            g.lineTo(px(sx * (SW + R)), pz(sz * FL));
            for (i = 0; i <= 12; i++) {
                const fa = (Math.PI / 2) * (i / 12);
                g.lineTo(px(sx * (SW + R - R * Math.cos(fa))), pz(sz * (FL + R - R * Math.sin(fa))));
            }
            g.closePath(); g.fill();
        }
        // mottling and the patched-over repairs
        for (i = 0; i < 4200; i++) {
            x = rr(-W / 2, W / 2); z = rr(-W / 2, W / 2);
            if (Math.abs(x) > SW && Math.abs(z) > FL) continue;
            g.fillStyle = 'rgba(255,255,255,' + (rnd() * 0.045) + ')';
            g.fillRect(px(x), pz(z), 3, 3);
        }
        for (i = 0; i < 26; i++) {
            x = rr(-W / 2, W / 2); z = rr(-W / 2, W / 2);
            if (Math.abs(x) > SW && Math.abs(z) > FL) continue;
            g.fillStyle = 'rgba(0,0,0,.13)';
            g.beginPath(); g.ellipse(px(x), pz(z), u(rr(1, 4)), u(rr(1, 3)), rnd() * 3, 0, 6.3); g.fill();
        }

        const seg = (x0, z0, x1, z1) => { g.beginPath(); g.moveTo(px(x0), pz(z0)); g.lineTo(px(x1), pz(z1)); g.stroke(); };

        // kerb line
        g.strokeStyle = '#c3bfb7'; g.lineWidth = u(0.42); g.lineCap = 'butt';
        for (k = 0; k < 4; k++) {
            const cx = corners[k][0], cz = corners[k][1];
            seg(cx * SW, cz * (W / 2), cx * SW, cz * (FL + R));
            seg(cx * (SW + R), cz * FL, cx * (W / 2), cz * FL);
            g.beginPath();
            for (i = 0; i <= 16; i++) {
                const aa = (Math.PI / 2) * (i / 16);
                const ax = cx * (SW + R - R * Math.cos(aa)), az = cz * (FL + R - R * Math.sin(aa));
                if (i === 0) g.moveTo(px(ax), pz(az)); else g.lineTo(px(ax), pz(az));
            }
            g.stroke();
        }

        const dash = (x0, z0, x1, z1, wm, on, off, col) => {
            g.strokeStyle = col || '#e8e6e0'; g.lineWidth = u(wm);
            g.setLineDash([u(on), u(off)]); seg(x0, z0, x1, z1); g.setLineDash([]);
        };
        const solid = (x0, z0, x1, z1, wm, col) => {
            g.strokeStyle = col || '#e8e6e0'; g.lineWidth = u(wm); seg(x0, z0, x1, z1);
        };
        // Swanston: centre line and lane divisions, broken through the junction
        [-1, 1].forEach((s) => {
            dash(0, s * (FL + 3), 0, s * W / 2, 0.12, 3, 3, 'rgba(232,230,224,.85)');
            dash(s * 7.6, s * (FL + 3), s * 7.6, s * W / 2, 0.12, 3, 3, 'rgba(232,230,224,.6)');
            dash(-s * 7.6, s * (FL + 3), -s * 7.6, s * W / 2, 0.12, 3, 3, 'rgba(232,230,224,.6)');
        });
        // Flinders: the lane lines either side of the safety zones
        [-1, 1].forEach((s) => {
            solid(s * (SW + 3), 8.6, s * W / 2, 8.6, 0.12, 'rgba(232,230,224,.8)');
            solid(s * (SW + 3), -8.6, s * W / 2, -8.6, 0.12, 'rgba(232,230,224,.8)');
            dash(s * (SW + 3), 11.7, s * W / 2, 11.7, 0.12, 2, 2, 'rgba(232,230,224,.7)');
            dash(s * (SW + 3), -11.7, s * W / 2, -11.7, 0.12, 2, 2, 'rgba(232,230,224,.7)');
        });
        // the green kerbside bike lanes, both streets
        g.fillStyle = 'rgba(40,110,60,.30)';
        [-SW + 0.2, SW - 2.1].forEach((bl) => {
            g.fillRect(px(bl), pz(-W / 2), u(1.9), u(W / 2 - FL - STOPL));
            g.fillRect(px(bl), pz(FL + STOPL), u(1.9), u(W / 2 - FL - STOPL));
        });
        [-FL + 0.2, FL - 2.1].forEach((bl) => {
            g.fillRect(px(-W / 2), pz(bl), u(W / 2 - SW - STOPL), u(1.9));
            g.fillRect(px(SW + STOPL), pz(bl), u(W / 2 - SW - STOPL), u(1.9));
        });

        // tram grooves — the rails themselves stand proud in geometry, but the
        // groove and its stain are paint as far as the eye is concerned
        g.strokeStyle = 'rgba(20,20,22,.65)'; g.lineWidth = u(0.10);
        [-TRS, TRS].forEach((o) => { [-RAIL, RAIL].forEach((r) => seg(o + r, -W / 2, o + r, W / 2)); });
        [-TRF, TRF].forEach((o) => { [-RAIL, RAIL].forEach((r) => seg(-W / 2, o + r, W / 2, o + r)); });
        g.strokeStyle = 'rgba(20,20,22,.55)'; g.lineWidth = u(0.09);
        const grooveCurve = (ccx, ccz, R2, a0, a1) => {
            [-RAIL, RAIL].forEach((q) => {
                g.beginPath();
                for (let n = 0; n <= 20; n++) {
                    const t = a0 + (a1 - a0) * n / 20;
                    const gx = ccx + Math.cos(t) * (R2 + q), gz = ccz + Math.sin(t) * (R2 + q);
                    if (n === 0) g.moveTo(px(gx), pz(gz)); else g.lineTo(px(gx), pz(gz));
                }
                g.stroke();
            });
        };
        const CR = 15;
        grooveCurve(-TRS - CR, -TRF - CR, CR, 0, Math.PI / 2);
        grooveCurve(TRS + CR, -TRF - CR, CR, Math.PI, Math.PI / 2);
        grooveCurve(-TRS - CR, TRF + CR, CR, 0, -Math.PI / 2);
        grooveCurve(TRS + CR, TRF + CR, CR, Math.PI, Math.PI * 1.5);

        // stop lines — left-hand traffic, so each approach stops on its own half
        g.fillStyle = '#eceae4';
        g.fillRect(px(0), pz(-(FL + STOPL)), u(SW), u(0.45));
        g.fillRect(px(-SW), pz(FL + STOPL - 0.45), u(SW), u(0.45));
        g.fillRect(px(SW + STOPL - 0.45), pz(0), u(0.45), u(FL));
        g.fillRect(px(-(SW + STOPL)), pz(-FL), u(0.45), u(FL));

        /* the scramble: four arms of bars, and the two diagonals that make this
           crossing the one everybody knows */
        const XW = 4.2, XN = -(FL + 1.2), XS = (FL + 1.2), XE = (SW + 1.2), XWt = -(SW + 1.2);
        const crossBars = (x0, z0, x1, z1, along) => {
            g.fillStyle = 'rgba(240,238,230,.92)';
            let p;
            if (along === 'z') for (p = x0 + 0.35; p < x1 - 0.5; p += 0.92) g.fillRect(px(p), pz(z0), u(0.55), u(z1 - z0));
            else for (p = z0 + 0.35; p < z1 - 0.5; p += 0.92) g.fillRect(px(x0), pz(p), u(x1 - x0), u(0.55));
        };
        crossBars(-SW, XN - XW, SW, XN, 'z');
        crossBars(-SW, XS, SW, XS + XW, 'z');
        crossBars(XE, -FL, XE + XW, FL, 'x');
        crossBars(XWt - XW, -FL, XWt, FL, 'x');
        g.save();
        g.strokeStyle = 'rgba(240,238,230,.85)'; g.lineWidth = u(0.35);
        g.setLineDash([u(0.9), u(0.9)]);
        [-1, 1].forEach((s) => {
            g.beginPath();
            g.moveTo(px(s * (SW - 0.6)), pz(-(FL - 0.6)));
            g.lineTo(px(-s * (SW - 0.6)), pz(FL - 0.6));
            g.stroke();
            g.beginPath();
            g.moveTo(px(s * (SW - 2.8)), pz(-(FL - 2.6)));
            g.lineTo(px(-s * (SW - 2.8)), pz(FL - 2.6));
            g.stroke();
        });
        g.setLineDash([]); g.restore();

        // lane arrows on the four approaches
        const arrow = (x, z, south) => {
            g.save(); g.translate(px(x), pz(z));
            g.fillStyle = 'rgba(236,234,228,.85)';
            const L = u(3.4), Wd = u(1.1), d = south ? 1 : -1;
            g.beginPath();
            g.moveTo(-Wd * 0.28, -d * L / 2); g.lineTo(Wd * 0.28, -d * L / 2);
            g.lineTo(Wd * 0.28, d * L * 0.14); g.lineTo(Wd * 0.62, d * L * 0.14);
            g.lineTo(0, d * L / 2); g.lineTo(-Wd * 0.62, d * L * 0.14); g.lineTo(-Wd * 0.28, d * L * 0.14);
            g.closePath(); g.fill(); g.restore();
        };
        const arrowX = (x, z, dir) => {
            g.save(); g.translate(px(x), pz(z));
            g.fillStyle = 'rgba(236,234,228,.85)';
            const L = u(3.4), Wd = u(1.1);
            g.beginPath();
            g.moveTo(-dir * L / 2, -Wd * 0.28); g.lineTo(-dir * L / 2, Wd * 0.28);
            g.lineTo(dir * L * 0.14, Wd * 0.28); g.lineTo(dir * L * 0.14, Wd * 0.62);
            g.lineTo(dir * L / 2, 0); g.lineTo(dir * L * 0.14, -Wd * 0.62); g.lineTo(dir * L * 0.14, -Wd * 0.28);
            g.closePath(); g.fill(); g.restore();
        };
        [24, 46, 74].forEach((d) => {
            arrow(8.4, -(FL + STOPL) - d, true);
            arrow(-8.4, (FL + STOPL) + d, false);
            arrowX(-(SW + STOPL) - d, -10.2, 1);
            arrowX((SW + STOPL) + d, 10.2, -1);
        });
        // bicycle symbols in the kerbside lanes
        const bike = (x, z, across) => {
            g.save(); g.translate(px(x), pz(z));
            g.strokeStyle = 'rgba(240,238,230,.8)'; g.lineWidth = u(0.13);
            const q = u(0.42), a = u(0.7);
            if (across) {
                g.beginPath(); g.arc(-a, 0, q, 0, 6.3); g.stroke();
                g.beginPath(); g.arc(a, 0, q, 0, 6.3); g.stroke();
                g.beginPath(); g.moveTo(-a, 0); g.lineTo(0, -u(0.3)); g.lineTo(a, 0); g.stroke();
            } else {
                g.beginPath(); g.arc(0, -a, q, 0, 6.3); g.stroke();
                g.beginPath(); g.arc(0, a, q, 0, 6.3); g.stroke();
                g.beginPath(); g.moveTo(0, -a); g.lineTo(u(0.3), 0); g.lineTo(0, a); g.stroke();
                g.beginPath(); g.moveTo(-u(0.45), -u(0.95)); g.lineTo(u(0.45), -u(0.95)); g.stroke();
            }
            g.restore();
        };
        [-70, -46, -24, 24, 46, 70].forEach((z2) => { bike(-SW + 1.15, z2, false); bike(SW - 1.15, z2, false); });
        [-74, -50, -28, 28, 50, 74].forEach((x2) => { bike(x2, -FL + 1.15, true); bike(x2, FL - 1.15, true); });

        // and the painted outline of the two Flinders Street safety zones
        g.strokeStyle = 'rgba(236,234,228,.85)'; g.lineWidth = u(0.15);
        [[-7.15, 28, 56], [7.15, -56, -28]].forEach((sz) => {
            g.strokeRect(px(sz[1]), pz(sz[0] - 1.45), u(sz[2] - sz[1]), u(2.9));
        });
    });

    /* ---- bluestone flagging for the raised footpaths ---- */
    const paveTex = tex(512, 512, (g, S) => {
        g.fillStyle = '#8f8d89'; g.fillRect(0, 0, S, S);
        const n = 8, w = S / n;
        for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
            const off = (j % 2) * w / 2;
            g.fillStyle = 'rgba(' + irr(0, 30) + ',' + irr(0, 30) + ',' + irr(0, 30) + ',' + (rnd() * 0.08) + ')';
            g.fillRect(i * w + off, j * w, w - 2, w - 2);
            g.strokeStyle = 'rgba(0,0,0,.16)'; g.lineWidth = 2;
            g.strokeRect(i * w + off, j * w, w - 2, w - 2);
        }
        for (let i = 0; i < 3000; i++) {
            g.fillStyle = 'rgba(255,255,255,' + (rnd() * 0.05) + ')';
            g.fillRect(rnd() * S, rnd() * S, 2, 2);
        }
    }, 30, 30);

    /* ---- office curtain wall: one sheet of windows, plus the emissive map
            that decides which of them have somebody still at a desk ---- */
    const officeTex = (cols, rows, wall, win, lit) => {
        const CW = 24, RH = 30, S = 8;
        const draw = (emissive) => (g, w, h) => {
            const cw = w / cols, rh = h / rows;
            if (emissive) { g.fillStyle = '#000'; g.fillRect(0, 0, w, h); }
            else { g.fillStyle = wall; g.fillRect(0, 0, w, h); }
            let k = 0;
            for (let r = 0; r < rows; r++) for (let i = 0; i < cols; i++) {
                const x = i * cw + S * cw / CW, y = r * rh + S * rh / RH;
                const ww = cw - 2 * S * cw / CW, hh = rh - 1.6 * S * rh / RH;
                // the same hash on both passes, so a lit window is lit in both
                const n = Math.sin((i * 12.9898 + r * 78.233) * 43758.5453);
                const on = (n - Math.floor(n)) < lit;
                if (emissive) {
                    if (!on) { k++; continue; }
                    g.fillStyle = ['#ffd9a0', '#ffe7c4', '#e8f0ff', '#fff3d6'][(i + r * 3) % 4];
                    g.globalAlpha = 0.45 + 0.55 * ((k * 0.618) % 1);
                    g.fillRect(x, y, ww, hh); g.globalAlpha = 1;
                } else {
                    g.fillStyle = win; g.fillRect(x, y, ww, hh);
                    g.fillStyle = 'rgba(255,255,255,.07)'; g.fillRect(x, y, ww, hh * 0.34);
                }
                k++;
            }
            if (!emissive) {
                g.fillStyle = 'rgba(0,0,0,.12)';
                for (let r = 0; r < rows; r++) g.fillRect(0, r * rh + rh - 3, w, 3);
            }
        };
        const W = Math.min(2048, cols * CW), H = Math.min(2048, rows * RH);
        return { map: tex(W, H, draw(false)), emis: tex(W, H, draw(true)) };
    };

    /* ---- lettering: the station's name band, the hotel's parapet ---- */
    const textTex = (lines, o) => {
        o = o || {};
        const W = o.w || 1024, H = o.h || 256;
        return tex(W, H, (g, w, h) => {
            if (o.bg) { g.fillStyle = o.bg; g.fillRect(0, 0, w, h); } else g.clearRect(0, 0, w, h);
            g.fillStyle = o.fg || '#fff';
            g.textAlign = 'center'; g.textBaseline = 'middle';
            const n = lines.length;
            for (let i = 0; i < n; i++) {
                const size = o.size || h / (n + 0.6);
                g.font = (o.weight || '600') + ' ' + size + 'px ' + (o.font || 'Georgia, serif');
                if (o.track) {
                    const t = lines[i];
                    let tw = 0, j;
                    for (j = 0; j < t.length; j++) tw += g.measureText(t[j]).width + o.track;
                    let xx = w / 2 - tw / 2;
                    g.textAlign = 'left';
                    for (j = 0; j < t.length; j++) {
                        g.fillText(t[j], xx, h * (i + 0.5) / n);
                        xx += g.measureText(t[j]).width + o.track;
                    }
                } else {
                    g.fillText(lines[i], w / 2, h * (i + 0.5) / n);
                }
            }
        });
    };

    /* ---- a clock face, and the row of nine that hangs inside the arch ----
            All of them read the hour this world is set at, because a station
            full of clocks disagreeing with each other is the one detail
            everybody would notice. */
    const drawClock = (g, cx, cy, R, hh, mm, roman) => {
        g.fillStyle = '#f6f2e6'; g.beginPath(); g.arc(cx, cy, R * 0.97, 0, 6.3); g.fill();
        g.strokeStyle = '#1c1c1c'; g.lineWidth = R * 0.04; g.beginPath(); g.arc(cx, cy, R * 0.93, 0, 6.3); g.stroke();
        g.fillStyle = '#1c1c1c'; g.textAlign = 'center'; g.textBaseline = 'middle';
        const num = roman ? ['XII', 'I', 'II', 'III', 'IIII', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI']
                          : ['12', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11'];
        g.font = 'bold ' + (R * (roman ? 0.16 : 0.20)).toFixed(0) + 'px Georgia, serif';
        for (let i = 0; i < 12; i++) {
            const a = i / 12 * Math.PI * 2 - Math.PI / 2;
            g.fillText(num[i], cx + Math.cos(a) * R * 0.76, cy + Math.sin(a) * R * 0.76);
            g.beginPath(); g.lineWidth = R * 0.024;
            g.moveTo(cx + Math.cos(a) * R * 0.90, cy + Math.sin(a) * R * 0.90);
            g.lineTo(cx + Math.cos(a) * R * 0.86, cy + Math.sin(a) * R * 0.86); g.stroke();
        }
        const hand = (ang, len, wid) => {
            g.strokeStyle = '#111'; g.lineWidth = wid; g.lineCap = 'round';
            g.beginPath(); g.moveTo(cx, cy);
            g.lineTo(cx + Math.cos(ang - Math.PI / 2) * len, cy + Math.sin(ang - Math.PI / 2) * len); g.stroke();
        };
        hand((hh % 12 + mm / 60) / 12 * Math.PI * 2, R * 0.46, R * 0.062);
        hand(mm / 60 * Math.PI * 2, R * 0.72, R * 0.040);
        g.fillStyle = '#111'; g.beginPath(); g.arc(cx, cy, R * 0.05, 0, 6.3); g.fill();
    };
    const clockTex = (hh, mm, roman) => tex(256, 256, (g, S) => drawClock(g, S / 2, S / 2, S / 2, hh, mm, roman));
    // The indicator board: nine faces on one strip, so nine clocks are one mesh.
    // Each is a few minutes out from the next, the way a rank of independently
    // wound platform clocks always was.
    const clockRowTex = tex(2048, 256, (g, W, H) => {
        g.fillStyle = '#141210'; g.fillRect(0, 0, W, H);
        const R = H * 0.42;
        for (let i = 0; i < 9; i++) {
            drawClock(g, W * (i + 0.5) / 9, H / 2, R, HOUR, (MINUTE + i * 3 - 6 + 60) % 60, false);
        }
    });

    /* ---- the dot-matrix destination box on the front of a tram ---- */
    const destTex = (route, dest, via) => tex(1024, 192, (g, W, H) => {
        g.fillStyle = '#0a0a0a'; g.fillRect(0, 0, W, H);
        g.fillStyle = '#ffb020'; g.textBaseline = 'middle';
        g.font = 'bold ' + (H * 0.44).toFixed(0) + 'px "Courier New", monospace';
        g.textAlign = 'right'; g.fillText(route, W - 26, H / 2);
        g.textAlign = 'left';
        if (via) {
            g.font = 'bold ' + (H * 0.32).toFixed(0) + 'px "Courier New", monospace'; g.fillText(dest, 26, H * 0.31);
            g.font = 'bold ' + (H * 0.24).toFixed(0) + 'px "Courier New", monospace'; g.fillText(via, 26, H * 0.74);
        } else {
            g.font = 'bold ' + (H * 0.41).toFixed(0) + 'px "Courier New", monospace'; g.fillText(dest, 26, H / 2);
        }
        g.fillStyle = 'rgba(0,0,0,.42)';
        for (let y = 0; y < H; y += 4) g.fillRect(0, y, W, 1.6);
        for (let x = 0; x < W; x += 4) g.fillRect(x, 0, 1.6, H);
    });

    /* ---- the PTV livery ------------------------------------------------
       The "shards": a fan of long hard-edged wedges springing from a point
       just off the panel, in a handful of greens, with white left showing
       between some of them and a fine lime line on a few of the edges.
       Deterministic for a given seed, so the whole fleet matches itself. */
    const ptvPattern = (g, x0, y0, w, h, seed) => {
        const greens = ['#8cc63e', '#63a832', '#a9d65c', '#42913b', '#76b83a',
                        '#2f7d33', '#b9de79', '#1d6b34'];
        let st = (seed * 9781 + 12347) >>> 0;
        const r = () => { st = (st * 1103515245 + 12345) >>> 0; return (st >>> 8) / 16777216; };
        for (let b = 0; b < 2; b++) {
            const down = (b + seed) % 2 === 0;
            const ox = x0 + w * (0.16 + 0.52 * b + r() * 0.14);
            const oy = y0 + (down ? -h * 0.30 : h * 1.30);
            const dir = down ? 1 : -1;
            let t = -0.62 - r() * 0.2;
            const n = 5 + Math.floor(r() * 3);
            for (let i = 0; i < n; i++) {
                const t1 = t + 0.15 + r() * 0.26;
                const len = h * (1.15 + r() * 0.85);
                if (r() > 0.24) {                       // a quarter of the wedges stay white
                    g.fillStyle = greens[Math.floor(r() * greens.length)];
                    g.beginPath();
                    g.moveTo(ox, oy);
                    g.lineTo(ox + t * w * 1.30, oy + dir * len);
                    g.lineTo(ox + t1 * w * 1.30, oy + dir * len * (0.72 + r() * 0.5));
                    g.closePath(); g.fill();
                    if (r() < 0.34) {
                        g.strokeStyle = '#dbec4e'; g.lineWidth = Math.max(1, h / 110);
                        g.beginPath(); g.moveTo(ox, oy);
                        g.lineTo(ox + t * w * 1.30, oy + dir * len); g.stroke();
                    }
                }
                t = t1;
            }
        }
    };

    /* One flank of an A-class. u = 0 is the cab end. The window and door glass
       is cleared straight out of the texture so the saloon shows through, and
       the material runs alphaTest rather than transparency — nine windows a
       side across four trams is not a sorting problem worth having. */
    const tramSideTex = (fleet, mirror) => tex(2048, 420, (g, W, H) => {
        if (mirror) { g.translate(W, 0); g.scale(-1, 1); }
        g.clearRect(0, 0, W, H);
        g.fillStyle = '#f3f5f1'; g.fillRect(0, 0, W, H);

        const burst = (a, b, seed) => {
            g.save(); g.beginPath(); g.rect(W * a, 0, W * (b - a), H); g.clip();
            ptvPattern(g, W * (a - 0.03), 0, W * (b - a + 0.06), H, seed); g.restore();
        };
        burst(0.100, 0.360, 3);
        burst(0.845, 1.00, 11);
        // the green flash along the roof fascia over the cab
        g.fillStyle = '#4f9c2e';
        g.beginPath(); g.moveTo(0, 0); g.lineTo(W * 0.115, 0); g.lineTo(0, H * 0.30); g.closePath(); g.fill();
        g.fillStyle = '#8cc63e';
        g.beginPath(); g.moveTo(0, 0); g.lineTo(W * 0.070, 0); g.lineTo(0, H * 0.17); g.closePath(); g.fill();
        // lime line along the lower body, then the dark underframe
        g.fillStyle = '#c5d92f'; g.fillRect(0, H * 0.845, W, H * 0.022);
        g.fillStyle = '#4d5257'; g.fillRect(0, H * 0.895, W, H * 0.105);

        const glassY = H * 0.16, glassH = H * 0.40;
        const opening = (u0, u1) => {
            g.clearRect(W * u0, glassY, W * (u1 - u0), glassH);
            g.strokeStyle = '#15191c'; g.lineWidth = W / 340;       // rubber surround
            g.strokeRect(W * u0, glassY, W * (u1 - u0), glassH);
            g.fillStyle = '#2a3036';                                // hopper vent rail
            g.fillRect(W * u0, glassY + glassH * 0.30, W * (u1 - u0), Math.max(2, H / 90));
        };
        opening(0.028, 0.082);                                      // the driver's window
        [[0.180, 0.252], [0.257, 0.329], [0.334, 0.406],
         [0.497, 0.569], [0.574, 0.646], [0.651, 0.723],
         [0.812, 0.884], [0.889, 0.961]].forEach((p) => opening(p[0], p[1]));

        [[0.098, 0.166], [0.420, 0.488], [0.735, 0.803]].forEach((d) => {
            const dx = W * d[0], dw = W * (d[1] - d[0]);
            g.fillStyle = '#dfe62b'; g.fillRect(dx, H * 0.055, dw, H * 0.795);      // lime door frame
            g.fillStyle = '#f3f5f1'; g.fillRect(dx + dw * 0.085, H * 0.075, dw * 0.83, H * 0.755);
            g.clearRect(dx + dw * 0.06, glassY, dw * 0.88, glassH * 0.95);
            g.strokeStyle = '#15191c'; g.lineWidth = W / 380;
            g.strokeRect(dx + dw * 0.06, glassY, dw * 0.88, glassH * 0.95);
            g.strokeStyle = '#9aa018'; g.lineWidth = W / 620;
            g.beginPath(); g.moveTo(dx + dw / 2, H * 0.055); g.lineTo(dx + dw / 2, H * 0.85); g.stroke();
            g.strokeRect(dx, H * 0.055, dw, H * 0.795);
            g.fillStyle = '#2f3439'; g.fillRect(dx + dw * 0.40, H * 0.66, dw * 0.20, H * 0.10);
        });

        g.textBaseline = 'middle';
        g.fillStyle = '#26301a';
        g.font = 'bold ' + (H * 0.085).toFixed(0) + 'px Helvetica, Arial, sans-serif';
        g.textAlign = 'left'; g.fillText(String(fleet), W * 0.088, H * 0.735);
        g.textAlign = 'right'; g.fillText(String(fleet), W * 0.975, H * 0.735);
        g.textAlign = 'left';
        [0.545, 0.600].forEach((u) => {                              // two PT> marks amidships
            g.fillStyle = '#0f5c2e';
            g.font = 'bold ' + (H * 0.075).toFixed(0) + 'px Helvetica, Arial, sans-serif';
            g.fillText('PT', W * u, H * 0.735);
            g.beginPath();
            g.moveTo(W * (u + 0.020), H * 0.695); g.lineTo(W * (u + 0.030), H * 0.735);
            g.lineTo(W * (u + 0.020), H * 0.775); g.closePath(); g.fill();
        });
        const ax = W * 0.640, aw = W * 0.085, ay = H * 0.640, ah = H * 0.185;
        g.fillStyle = '#ffffff'; g.fillRect(ax, ay, aw, ah);
        g.fillStyle = '#78be20'; g.fillRect(ax + aw * 0.66, ay + ah * 0.16, aw * 0.26, ah * 0.68);
        g.fillStyle = '#1c6b3a';
        g.font = 'bold ' + (H * 0.048).toFixed(0) + 'px Helvetica, Arial, sans-serif';
        g.fillText('myki', ax + aw * 0.07, ay + ah * 0.34);
        g.fillStyle = '#3d4348';
        g.font = (H * 0.040).toFixed(0) + 'px Helvetica, Arial, sans-serif';
        g.fillText('auto top up', ax + aw * 0.07, ay + ah * 0.68);
    });

    const tramFrontTex = tex(512, 176, (g, W, H) => {
        g.fillStyle = '#f7f8f5'; g.fillRect(0, 0, W, H);
        g.fillStyle = '#1c6b3a'; g.textBaseline = 'middle'; g.textAlign = 'left';
        g.font = 'bold ' + (H * 0.17).toFixed(0) + 'px Helvetica, Arial, sans-serif';
        g.fillText('Set and forget with', W * 0.05, H * 0.24);
        g.fillText('myki auto top up', W * 0.05, H * 0.50);
        g.fillStyle = '#3d4348';
        g.font = (H * 0.15).toFixed(0) + 'px Helvetica, Arial, sans-serif';
        g.fillText('on the PTV app', W * 0.05, H * 0.76);
        g.fillStyle = '#78be20'; g.fillRect(W * 0.72, H * 0.14, W * 0.14, H * 0.72);
        g.fillStyle = '#12351f'; g.fillRect(W * 0.745, H * 0.22, W * 0.09, H * 0.44);
        g.fillStyle = '#f7f8f5';
        g.font = 'bold ' + (H * 0.12).toFixed(0) + 'px Helvetica, Arial, sans-serif';
        g.textAlign = 'center'; g.fillText('myki', W * 0.79, H * 0.44);
    });

    const tramBackTex = (fleet) => tex(256, 292, (g, W, H) => {
        g.fillStyle = '#f4f6f3'; g.fillRect(0, 0, W, H);
        g.save(); g.beginPath(); g.rect(0, H * 0.60, W, H * 0.40); g.clip();
        ptvPattern(g, 0, H * 0.60, W, H * 0.40, 11); g.restore();
        g.fillStyle = '#0a0a0a'; g.fillRect(W * 0.30, H * 0.05, W * 0.40, H * 0.09);
        g.fillStyle = '#ffb020'; g.font = 'bold ' + (H * 0.12).toFixed(0) + 'px "Courier New", monospace';
        g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillText(String(fleet), W * 0.5, H * 0.095);
        g.fillStyle = '#1b2126'; g.fillRect(W * 0.09, H * 0.20, W * 0.82, H * 0.36);
        g.fillStyle = 'rgba(150,190,220,.16)'; g.fillRect(W * 0.09, H * 0.20, W * 0.82, H * 0.15);
        g.strokeStyle = '#e6e8e4'; g.lineWidth = W / 45; g.strokeRect(W * 0.09, H * 0.20, W * 0.82, H * 0.36);
        g.fillStyle = '#c8341f';
        [[0.16, 0.78], [0.84, 0.78]].forEach((p) => {
            g.beginPath(); g.ellipse(W * p[0], H * p[1], W * 0.07, H * 0.03, 0, 0, 6.3); g.fill();
        });
        g.fillStyle = '#2c3238'; g.fillRect(0, H * 0.90, W, H * 0.10);
    });

    /* the green moquette of an A-class seat */
    const seatTex = tex(128, 128, (g, S) => {
        g.fillStyle = '#1f8a34'; g.fillRect(0, 0, S, S);
        g.strokeStyle = '#0d5a1e'; g.lineWidth = 3;
        for (let i = 0; i < 5; i++) {
            g.beginPath();
            g.moveTo(-10 + i * 30, S); g.quadraticCurveTo(10 + i * 30, S * 0.4, 40 + i * 30, -10);
            g.stroke();
        }
        g.fillStyle = '#e0c93a';
        for (let i = 0; i < 90; i++) g.fillRect(rnd() * S, rnd() * S, 3, 3);
        g.strokeStyle = '#e0c93a'; g.lineWidth = 2;
        for (let i = 0; i < 4; i++) {
            g.beginPath();
            g.moveTo(i * 34, S); g.quadraticCurveTo(24 + i * 34, S * 0.5, 8 + i * 34, 0);
            g.stroke();
        }
    }, 3, 2);

    /* ---- the two LED billboards up Swanston Street ---- */
    const adTex = (i) => tex(1024, 512, (g, W, H) => {
        let grad;
        if (i === 0) {
            grad = g.createLinearGradient(0, 0, W, H);
            grad.addColorStop(0, '#ff5a3c'); grad.addColorStop(1, '#c2185b');
            g.fillStyle = grad; g.fillRect(0, 0, W, H);
            g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle';
            g.font = 'bold ' + (H * 0.19).toFixed(0) + 'px Helvetica, Arial, sans-serif';
            g.fillText('SUMMER', W / 2, H * 0.40);
            g.font = '300 ' + (H * 0.11).toFixed(0) + 'px Helvetica, Arial, sans-serif';
            g.fillText('in the city', W / 2, H * 0.62);
        } else if (i === 1) {
            grad = g.createLinearGradient(0, 0, 0, H);
            grad.addColorStop(0, '#0d3b66'); grad.addColorStop(1, '#1d9bf0');
            g.fillStyle = grad; g.fillRect(0, 0, W, H);
            g.fillStyle = 'rgba(255,255,255,.9)';
            for (let k = 0; k < 40; k++) {
                g.globalAlpha = rr(0.1, 0.5);
                g.fillRect(rr(0, W), rr(0, H), rr(4, 90), 4);
            }
            g.globalAlpha = 1;
            g.fillStyle = '#fff'; g.textAlign = 'left'; g.textBaseline = 'middle';
            g.font = 'bold ' + (H * 0.15).toFixed(0) + 'px Helvetica, Arial, sans-serif';
            g.fillText('GO', W * 0.06, H * 0.44);
            g.font = '300 ' + (H * 0.10).toFixed(0) + 'px Helvetica, Arial, sans-serif';
            g.fillText('somewhere', W * 0.06, H * 0.66);
        } else {
            g.fillStyle = '#111'; g.fillRect(0, 0, W, H);
            for (let q = 0; q < 90; q++) {
                g.fillStyle = 'hsl(' + irr(0, 360) + ',70%,' + irr(35, 65) + '%)';
                g.globalAlpha = 0.75;
                g.fillRect(irr(0, W), irr(0, H), irr(20, 160), irr(10, 60));
            }
            g.globalAlpha = 1;
            g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle';
            g.font = 'bold ' + (H * 0.21).toFixed(0) + 'px Helvetica, Arial, sans-serif';
            g.fillText('MELBOURNE', W / 2, H / 2);
        }
    });

    /* ---- Federation Square's plaza: Kimberley sandstone in radiating bands ---- */
    const plazaTex = tex(1024, 1024, (g, S) => {
        g.fillStyle = '#c9ab82'; g.fillRect(0, 0, S, S);
        const cx = S * 0.28, cy = S * 1.05;
        for (let i = 0; i < 46; i++) {
            const a0 = -Math.PI * 0.72 + i * 0.032, wd = 0.016 + rnd() * 0.012;
            g.fillStyle = ['#d7bc95', '#c09468', '#e0caa7', '#b98d63', '#cdb28c'][i % 5];
            g.beginPath(); g.moveTo(cx, cy);
            for (let j = 0; j <= 12; j++) {
                const r = j / 12 * S * 1.5, a = a0 + Math.sin(j / 12 * 2.2) * 0.10;
                g.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
            }
            for (let j = 12; j >= 0; j--) {
                const r = j / 12 * S * 1.5, a = a0 + wd + Math.sin(j / 12 * 2.2) * 0.10;
                g.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
            }
            g.closePath(); g.fill();
        }
        g.strokeStyle = 'rgba(0,0,0,.10)'; g.lineWidth = 1.5;
        for (let i = 0; i < S; i += 26) {
            g.beginPath(); g.moveTo(i, 0); g.lineTo(i, S); g.stroke();
            g.beginPath(); g.moveTo(0, i); g.lineTo(S, i); g.stroke();
        }
        for (let i = 0; i < 5000; i++) {
            g.fillStyle = 'rgba(255,255,255,' + (rnd() * 0.05) + ')';
            g.fillRect(rnd() * S, rnd() * S, 2, 2);
        }
    });

    /* ---- three repeating strips: the bridge's arcaded parapet, the station's
            stone balustrade, and Young & Jackson's cast-iron lace ---- */
    const parapetTex = tex(1024, 128, (g, W, H) => {
        g.fillStyle = '#e8e4d8'; g.fillRect(0, 0, W, H);
        g.fillStyle = '#d6d1c2'; g.fillRect(0, 0, W, 16); g.fillRect(0, H - 20, W, 20);
        const n = 24, bw = W / n;
        for (let i = 0; i < n; i++) {
            const x = i * bw + bw * 0.28, w = bw * 0.44;
            g.fillStyle = '#5d6f7c';
            g.beginPath();
            g.moveTo(x, H - 26); g.lineTo(x, 44);
            g.quadraticCurveTo(x + w / 2, 20, x + w, 44);
            g.lineTo(x + w, H - 26); g.closePath(); g.fill();
            g.strokeStyle = '#cfc9b8'; g.lineWidth = 3;
            g.beginPath();
            g.moveTo(x - 2, H - 26); g.lineTo(x - 2, 44);
            g.quadraticCurveTo(x + w / 2, 18, x + w + 2, 44);
            g.lineTo(x + w + 2, 44); g.stroke();
        }
    }, 40, 1);

    const balusterTex = tex(512, 128, (g, W, H) => {
        g.clearRect(0, 0, W, H);
        g.fillStyle = '#ece2cd';
        g.fillRect(0, 0, W, 20); g.fillRect(0, H - 24, W, 24);
        const n = 16, bw = W / n;
        for (let i = 0; i < n; i++) {
            const cx = i * bw + bw / 2;
            g.beginPath();
            g.moveTo(cx - bw * 0.26, 20);
            g.quadraticCurveTo(cx - bw * 0.15, 46, cx - bw * 0.20, 70);
            g.quadraticCurveTo(cx - bw * 0.30, 92, cx - bw * 0.26, H - 24);
            g.lineTo(cx + bw * 0.26, H - 24);
            g.quadraticCurveTo(cx + bw * 0.30, 92, cx + bw * 0.20, 70);
            g.quadraticCurveTo(cx + bw * 0.15, 46, cx + bw * 0.26, 20);
            g.closePath(); g.fill();
        }
    }, 1, 1);

    const laceTex = tex(256, 96, (g, W, H) => {
        g.clearRect(0, 0, W, H);
        g.fillStyle = '#2f6b4f';
        g.fillRect(0, 0, W, 10); g.fillRect(0, H - 8, W, 8);
        for (let i = 0; i < 8; i++) {
            const x = i * 32 + 16;
            g.beginPath();
            g.moveTo(x - 16, 10); g.quadraticCurveTo(x, 46, x + 16, 10);
            g.lineTo(x + 16, 16); g.quadraticCurveTo(x, 54, x - 16, 16); g.closePath(); g.fill();
            g.beginPath(); g.arc(x, 22, 6, 0, 6.3); g.fill();
            g.fillRect(x - 2, 10, 4, 26);
        }
    }, 12, 1);

    /* ---- St Paul's banded freestone: cream, with the darker courses that
            make the cathedral read as striped from a block away ---- */
    const bandTex = tex(64, 128, (g, W, H) => {
        g.fillStyle = '#e2cfaa'; g.fillRect(0, 0, W, H);
        g.fillStyle = '#c49a6a'; g.fillRect(0, H * 0.30, W, H * 0.11);
        g.fillStyle = '#d3b385'; g.fillRect(0, H * 0.47, W, H * 0.05);
        g.fillStyle = '#b98d5c'; g.fillRect(0, H * 0.66, W, H * 0.07);
        g.fillStyle = '#d3b385'; g.fillRect(0, H * 0.86, W, H * 0.05);
        g.strokeStyle = 'rgba(0,0,0,.10)'; g.lineWidth = 1;
        for (let y = 0; y < H; y += 16) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
        for (let i = 0; i < 700; i++) {
            g.fillStyle = 'rgba(0,0,0,' + (rnd() * 0.05) + ')';
            g.fillRect(rnd() * W, rnd() * H, 2, 2);
        }
    }, 1, 1);
    bandTex.wrapS = bandTex.wrapT = THREE.RepeatWrapping;

    /* ============================================================
       6 · the shared palette of materials

       One material per surface for the whole city, so that a hundred and forty
       metres of station frontage can be merged into one mesh per stone.
       ============================================================ */
    const MATS = {
        stone: stdMat(C.stone, { roughness: 0.72, metalness: 0.03 }),
        cream: stdMat(C.stoneHi, { roughness: 0.68, metalness: 0.03 }),
        brick: stdMat(C.brick, { roughness: 0.80 }),
        deepred: stdMat(0x50241d, { roughness: 0.82 }),
        reveal: stdMat(0x6b3227, { roughness: 0.80 }),
        granite: stdMat(0x807d76, { roughness: 0.46, metalness: 0.16 }),
        copper: stdMat(C.copper, { roughness: 0.42, metalness: 0.30 }),
        glass: stdMat(0x17222c, { roughness: 0.14, metalness: 0.50 }),
        glassLt: stdMat(0x2b4356, { roughness: 0.12, metalness: 0.45 }),
        dark: stdMat(0x2a2e33, { roughness: 0.55 }),
        slate: stdMat(C.slate, { roughness: 0.42, metalness: 0.18 }),
        iron: stdMat(0x2c3238, { roughness: 0.42, metalness: 0.50 }),
        green: stdMat(C.pubTrim, { roughness: 0.40, metalness: 0.10 }),
        pub: stdMat(C.pubWall, { roughness: 0.70 }),
        white: stdMat(0xf0efe9, { roughness: 0.64 }),
        steel: stdMat(0x8d9296, { roughness: 0.34, metalness: 0.55 }),
        navy: stdMat(0x143257, { roughness: 0.52 }),
        yellow: stdMat(0xd9c22c, { roughness: 0.58 }),
        concrete: stdMat(0x8b8883, { roughness: 0.74 }),
        // St Paul's, striped: the band texture repeats through UVs baked per
        // piece before the merge, so the courses stay 3.2 m whatever the wall.
        banded: stdMat(0xffffff, { map: bandTex, roughness: 0.74 }),
        sand: stdMat(C.sand, { roughness: 0.74 }),
        spire: stdMat(C.spire, { roughness: 0.72 }),
    };
    // A wet city is a darker, glossier, less colourful city. Rather than
    // rewriting every hex, the whole palette is desaturated and glazed once,
    // here — the same move the source page made with a "wet" toggle, made
    // permanent because this world only has the one weather.
    for (const k in MATS) {
        const m = MATS[k];
        if (!m.color) continue;
        const c = m.color;
        const lum = c.r * 0.30 + c.g * 0.59 + c.b * 0.11;
        c.setRGB(lerp(c.r, lum, 0.34) * 0.80, lerp(c.g, lum, 0.34) * 0.80, lerp(c.b, lum, 0.30) * 0.84);
        m.roughness = Math.max(0.06, m.roughness * 0.78);
        m.metalness = Math.min(0.80, m.metalness + 0.14);
    }

    const emissive = (hex, glow, intensity, o) => stdMat(hex, Object.assign({
        emissive: glow, emissiveIntensity: intensity, roughness: 0.34,
    }, o || {}));

    /* ============================================================
       7 · the road

       One plane, one shader, and the whole of the wet-afternoon look. The baked
       240 m canvas carries the intersection's line marking; outside it the same
       shader lays Swanston Street and its three cross streets out analytically,
       so the city runs to the fog without another draw call.
       ============================================================ */
    const roadMat = new THREE.ShaderMaterial({
        uniforms: Object.assign(
            pick('uTime', 'uCamPos', 'uFogCol', 'uFogNear', 'uFogFar', 'uSkyLo', 'uSkyHi',
                 'uLPos', 'uLCol', 'uLStr', 'uLRad'),
            { uRoad: { value: roadTex } }),
        vertexShader: WORLD_VS,
        fragmentShader: NOISE_GLSL + RIPPLE_GLSL + WET_GLSL + FOG_GLSL + /* glsl */`
          uniform float uTime; uniform vec3 uCamPos; uniform sampler2D uRoad;
          varying vec3 vWorld;

          // The street layout beyond the baked square, as a set of bands. Two
          // numbers come back: how much of this point is carriageway, and how
          // much is footpath; whatever is left is the ground buildings stand on.
          //
          // Not called "layout". That was its name on the r128 page, where the
          // shader compiled as GLSL ES 1.00 and the word was free; three builds
          // this as GLSL ES 3.00 on any WebGL2 context, and there "layout" is a
          // reserved qualifier keyword — so the whole road program failed to
          // compile on the iPad and the ground drew with whatever was bound last.
          void streetBands(vec2 p, out float road, out float path){
            float ax = abs(p.x);
            // Swanston Street, carried north past three cross streets and south
            // over the bridge
            road = smoothstep(${(SW + 0.35).toFixed(2)}, ${(SW - 0.35).toFixed(2)}, ax);
            path = smoothstep(${(SW - 0.2).toFixed(2)}, ${(SW + 0.3).toFixed(2)}, ax)
                 * smoothstep(${(BX + 0.4).toFixed(2)}, ${(BX - 0.2).toFixed(2)}, ax);
            for (int i = 0; i < 3; i++) {
              float cz = i == 0 ? ${NST[0].z.toFixed(1)} : (i == 1 ? ${NST[1].z.toFixed(1)} : ${NST[2].z.toFixed(1)});
              float h  = i == 0 ? ${NST[0].h.toFixed(1)} : (i == 1 ? ${NST[1].h.toFixed(1)} : ${NST[2].h.toFixed(1)});
              // p.y, because p is the ground point flattened to (world x, world
              // z). The r128 source said p.z, which was right when this took a
              // vec3 and is the second reason the program never compiled.
              float dz = abs(p.y - cz);
              float within = smoothstep(${(NX + 2.0).toFixed(1)}, ${(NX - 2.0).toFixed(1)}, ax);
              road = max(road, smoothstep(h + 0.35, h - 0.35, dz) * within);
              path = max(path, smoothstep(h - 0.2, h + 0.3, dz)
                             * smoothstep(h + ${(FP + 0.4).toFixed(1)}, h + ${(FP - 0.2).toFixed(1)}, dz) * within);
            }
            path = clamp(path - road, 0.0, 1.0);
          }

          void main(){
            vec3 wp = vWorld;
            float dist = length(uCamPos - wp);
            float det = 1.0 - smoothstep(18.0, 90.0, dist);

            float n1 = fbm(wp.xz * 2.2);
            float n2 = fbm(wp.xz * 0.34 + 11.0);

            float road, path;
            streetBands(wp.xz, road, path);

            vec3 cRoad = vec3(0.0175, 0.0185, 0.0205) * (0.72 + 0.70 * n1);
            vec3 cPath = vec3(0.114, 0.110, 0.101) * (0.78 + 0.44 * n1);
            vec3 cBack = mix(vec3(0.048, 0.046, 0.041), vec3(0.086, 0.082, 0.070), n2);
            vec3 albedo = cRoad * road + cPath * path + cBack * clamp(1.0 - road - path, 0.0, 1.0);

            // and over the middle of all that, the hand-drawn intersection
            vec2 ruv = vec2(wp.x / ${XLEN.toFixed(1)} + 0.5, 0.5 - wp.z / ${XLEN.toFixed(1)});
            float inSq = smoothstep(0.008, 0.055, ruv.x) * smoothstep(0.992, 0.945, ruv.x)
                       * smoothstep(0.008, 0.055, ruv.y) * smoothstep(0.992, 0.945, ruv.y);
            vec3 baked = texture2D(uRoad, ruv).rgb * 0.42;
            albedo = mix(albedo, baked, inSq);

            // Where it stands. The camber holds water against the kerb and in
            // the tram grooves, and the low spots in the asphalt keep the rest.
            float ax = abs(wp.x);
            float gutter = smoothstep(${(SW - 2.4).toFixed(2)}, ${(SW - 0.3).toFixed(2)}, ax) * road;
            float groove = smoothstep(0.55, 0.18, abs(ax - ${TRS.toFixed(2)})) * road * 0.55;
            float pool = smoothstep(0.52, 0.74, fbm(wp.xz * 0.42 + 4.0)) * road;
            pool = clamp(pool * 0.85 + gutter * 0.75 + groove, 0.0, 1.0);
            albedo = mix(albedo, albedo * 0.42, pool);

            float gloss = clamp(road * 0.88 + path * 0.42 + pool * 0.55, 0.0, 1.0);
            float rip = ripple(wp.xz, uTime) * gloss * det;

            vec3 diff, spec;
            wetLight(wp, uCamPos, rip, gloss, diff, spec);

            // On an overcast afternoon the road is mostly a photograph of the
            // cloud, so the sky term leads and the ten sources are the accents
            // laid on top of it.
            //
            // These two weights were the ones tuned blind, against a program
            // that never compiled, and they had the balance exactly backwards:
            // the mirror was contributing about three greylevels where the
            // smears were clipping. The sky now carries roughly four fifths of
            // the road's brightness at a grazing angle and the sources ride on
            // it, which is the split the paragraph above describes. Together
            // with the Fresnel weight in wetLight they also keep the road under
            // the 0.80 bloom threshold, so the street stops feeding the bloom
            // pass that is meant for the signals and the destination boxes.
            vec3 col = albedo * (uSkyLo * 0.55 + diff);
            col += skyMirror(wp, uCamPos, rip) * gloss * (0.52 + 0.22 * n1);
            col += spec * (0.16 + 0.07 * n1);
            col += vec3(0.60, 0.66, 0.74) * max(rip, 0.0) * 0.045;

            gl_FragColor = vec4(applyFog(col, dist), 1.0);
          }`,
    });

    /* The near plane is also the walk's grid: `ground.js` sizes the field from
       what a world declares as ground, and a flat city declares nothing but
       flat ground — so the plane's own extent is the answer to "how far can
       somebody walk on this in detail". Three hundred and twenty metres by four
       hundred and sixty puts the intersection, both landmarks, Stop 13 and the
       bridge inside it at about a metre a cell. */
    {
        const near = new THREE.PlaneGeometry(320, 460, 8, 8);
        near.rotateX(-Math.PI / 2);
        const roadway = mesh(near, roadMat, 0, 0, 20);
        scene.add(roadway);
        world.ground(roadway);

        // and the same shader carried out to the fog, so Swanston Street runs
        // north to Little Collins and south over the river without an edge
        const far = new THREE.PlaneGeometry(1000, 1200, 8, 8);
        far.rotateX(-Math.PI / 2);
        const distance = mesh(far, roadMat, 0, -0.02, -60);
        scene.add(distance);
    }

    /* ---- footpaths, raised by the kerb, and the bluestone edging ---- */
    paveTex.repeat.set(1 / 4.8, 1 / 4.8);
    const paveMat = stdMat(0xffffff, { map: paveTex, roughness: 0.34, metalness: 0.18, side: THREE.DoubleSide });
    {
        // One corner's footpath, rounded where it meets the kerb radius.
        const quad = (sX, sZ, R, Lz) => {
            const L = XLEN / 2, pts = [];
            pts.push([sX * L, sZ * FL]);
            pts.push([sX * (SW + R), sZ * FL]);
            for (let i = 0; i <= 8; i++) {
                const a = (Math.PI / 2) * (1 - i / 8);
                pts.push([sX * (SW + R - R * Math.cos(a)), sZ * (FL + R - R * Math.sin(a))]);
            }
            pts.push([sX * SW, sZ * Lz]);
            pts.push([sX * L, sZ * Lz]);
            return pts;
        };
        const slabs = [];
        for (const s of [[1, -1], [-1, -1], [1, 1], [-1, 1]]) {
            const pts = quad(s[0], s[1], 7.0, s[1] < 0 ? 102.8 : XLEN / 2);
            const shape = new THREE.Shape();
            shape.moveTo(pts[0][0], -pts[0][1]);
            for (let i = 1; i < pts.length; i++) shape.lineTo(pts[i][0], -pts[i][1]);
            shape.closePath();
            const g = new THREE.ExtrudeGeometry(shape, { depth: KERB_H + 0.07, bevelEnabled: false });
            g.rotateX(-Math.PI / 2);
            g.translate(0, -0.07, 0);
            slabs.push(g);
        }
        // the footpaths of the three cross streets carried north
        for (const st of NST) {
            for (const s of [-1, 1]) {
                for (const r of [[-NX, -BX], [BX, NX]]) {
                    const g = boxG(r[1] - r[0], KERB_H + 0.02, FP);
                    put(g, (r[0] + r[1]) / 2, (KERB_H + 0.02) / 2 - 0.01, st.z + s * (st.h + FP / 2));
                    slabs.push(g);
                }
            }
            // and Swanston's own, between the cross streets
            for (const s of [-1, 1]) {
                const g = boxG(FP, KERB_H + 0.02, 96);
                put(g, s * (SW + FP / 2), (KERB_H + 0.02) / 2 - 0.01, st.z + 58);
                slabs.push(g);
            }
        }
        const paths = merged(slabs, paveMat);
        scene.add(paths);
        world.ground(paths);
    }
    {
        const kerbMat = stdMat(C.kerb, { roughness: 0.44, metalness: 0.20 });
        const parts = [];
        const L = XLEN / 2;
        for (const s of [[1, -1], [-1, -1], [1, 1], [-1, 1]]) {
            const Lz = s[1] < 0 ? 102.8 : L;
            let g = boxG(0.34, KERB_H + 0.02, Lz - FL - 7.0);
            put(g, s[0] * (SW + 0.17), (KERB_H + 0.02) / 2, s[1] * (FL + 7.0 + (Lz - FL - 7.0) / 2));
            parts.push(g);
            g = boxG(L - SW - 7.0, KERB_H + 0.02, 0.34);
            put(g, s[0] * (SW + 7.0 + (L - SW - 7.0) / 2), (KERB_H + 0.02) / 2, s[1] * (FL + 0.17));
            parts.push(g);
            g = new THREE.TorusGeometry(7.0, 0.17, 6, 10, Math.PI / 2);
            put(g, s[0] * (SW + 7.0), (KERB_H + 0.02) / 2, s[1] * (FL + 7.0),
                -Math.PI / 2, 0, (s[0] > 0 ? (s[1] > 0 ? Math.PI * 1.5 : 0) : (s[1] > 0 ? Math.PI : Math.PI * 0.5)));
            parts.push(g);
        }
        for (const st of NST) {
            for (const s of [-1, 1]) for (const r of [[-NX, -BX], [BX, NX]]) {
                const g = boxG(r[1] - r[0], KERB_H + 0.04, 0.34);
                put(g, (r[0] + r[1]) / 2, (KERB_H + 0.04) / 2, st.z + s * (st.h + 0.17));
                parts.push(g);
            }
            for (const s of [-1, 1]) {
                const g = boxG(0.34, KERB_H + 0.02, 92);
                put(g, s * (SW + 0.17), (KERB_H + 0.02) / 2, st.z + 58);
                parts.push(g);
            }
        }
        scene.add(merged(parts, kerbMat));
    }

    /* ---- running rails. The grooves and their stain are in the road texture;
            this is the steel that stands proud of it and catches what light
            there is. ---- */
    {
        const railMat = stdMat(C.rail, {
            roughness: 0.14, metalness: 0.92, emissive: 0x1e242c, emissiveIntensity: 0.55,
        });
        const parts = [];
        const runZ = (off, z0, z1) => { for (const r of [-RAIL, RAIL]) { const g = boxG(0.075, 0.05, z1 - z0); put(g, off + r, 0.025, (z0 + z1) / 2); parts.push(g); } };
        const runX = (off, x0, x1) => { for (const r of [-RAIL, RAIL]) { const g = boxG(x1 - x0, 0.05, 0.075); put(g, (x0 + x1) / 2, 0.025, off + r); parts.push(g); } };
        runZ(-TRS, NZ_END, 250); runZ(TRS, NZ_END, 250);
        runX(-TRF, -NX, NX); runX(TRF, -NX, NX);
        runX(-230 - TRF, -NX, NX); runX(-230 + TRF, -NX, NX);
        // the four connecting curves, Swanston to Flinders, as short chords
        const curve = (cx, cz, R, a0, a1) => {
            for (const k of [-1, 1]) {
                const rr2 = R + k * RAIL;
                for (let i = 0; i < 12; i++) {
                    const t0 = a0 + (a1 - a0) * i / 12, t1 = a0 + (a1 - a0) * (i + 1) / 12;
                    const x0 = cx + Math.cos(t0) * rr2, z0 = cz + Math.sin(t0) * rr2;
                    const x1 = cx + Math.cos(t1) * rr2, z1 = cz + Math.sin(t1) * rr2;
                    const g = boxG(Math.hypot(x1 - x0, z1 - z0) * 1.07, 0.05, 0.075);
                    put(g, (x0 + x1) / 2, 0.025, (z0 + z1) / 2, 0, -Math.atan2(z1 - z0, x1 - x0), 0);
                    parts.push(g);
                }
            }
        };
        const CR = 15;
        curve(-TRS - CR, -TRF - CR, CR, 0, Math.PI / 2);
        curve(TRS + CR, -TRF - CR, CR, Math.PI, Math.PI / 2);
        curve(-TRS - CR, TRF + CR, CR, 0, -Math.PI / 2);
        curve(TRS + CR, TRF + CR, CR, Math.PI, Math.PI * 1.5);
        const rails = merged(parts, railMat);
        scene.add(rails);
        world.ghost(rails);      // 50 mm of steel is not something to walk into
    }

    /* ============================================================
       8 · the tram stops

       Stop 13 — Flinders Street Station — is the pair of long platform stops on
       Swanston Street between Federation Square and the station, at the city
       end of Princes Bridge, and it is where most of the people in this world
       are standing. `side` points from the platform towards the track it
       serves; everything else is measured off that.
       ============================================================ */
    const glassMat = stdMat(0x9fc4d8, { roughness: 0.09, metalness: 0.18, transparent: true, opacity: 0.36 });
    const soffitMat = emissive(0xf4f8ff, 0xe4eefc, 2.4, { side: THREE.DoubleSide });

    function tramStop(name, cx, cz, len, side, axis, shelters) {
        const G = new THREE.Group();
        const conc = [], yell = [], steel = [], glass = [], navy = [], glow = [];
        const W2 = 3.0, H2 = 0.28;

        let g = boxG(W2, H2, len); put(g, 0, H2 / 2, 0); conc.push(g);
        // the boarding edge: yellow nosing, then the tactile strip behind it
        g = boxG(0.52, H2 + 0.02, len); put(g, side * (W2 / 2 - 0.26), (H2 + 0.02) / 2, 0); yell.push(g);
        g = boxG(0.62, 0.03, len - 1.2); put(g, side * (W2 / 2 - 0.85), H2 + 0.015, 0); conc.push(g);
        for (const e of [-1, 1]) {          // ramped ends
            g = boxG(W2, H2, 3.0); put(g, 0, H2 / 2 - 0.09, e * (len / 2 + 1.5), e * 0.055); conc.push(g);
        }

        // the fence and glass screen down the traffic side
        const fx = -side * (W2 / 2 - 0.12);
        for (const y of [H2 + 1.02, H2 + 0.62]) { g = boxG(0.07, 0.07, len); put(g, fx, y, 0); steel.push(g); }
        const posts = Math.max(2, Math.round(len / 2.4));
        for (let i = 0; i <= posts; i++) {
            g = cylG(0.045, 0.05, 1.06, 6); put(g, fx, H2 + 0.53, -len / 2 + i * (len / posts)); steel.push(g);
        }
        for (const q of [-0.30, 0.30]) { g = boxG(0.05, 1.5, len * 0.30); put(g, fx, H2 + 0.78, q * len); glass.push(g); }

        for (const q of shelters) {
            const z = q * len;
            g = boxG(2.5, 0.14, 9.2); put(g, 0, H2 + 2.72, z); steel.push(g);
            g = boxG(2.3, 0.06, 8.8); put(g, 0, H2 + 2.62, z); steel.push(g);
            for (const o of [-4.3, -1.45, 1.45, 4.3]) {
                g = cylG(0.055, 0.055, 2.66, 8); put(g, -side * 1.02, H2 + 1.33, z + o); steel.push(g);
            }
            g = boxG(0.06, 2.05, 8.8); put(g, -side * 1.16, H2 + 1.30, z); glass.push(g);
            g = boxG(2.0, 0.95, 0.06); put(g, 0, H2 + 1.30, z - 4.5); glass.push(g);
            g = boxG(0.52, 0.09, 4.2); put(g, -side * 0.66, H2 + 0.84, z + 0.8); steel.push(g);
            // the lit soffit, which is the only warm thing on a platform in the rain
            g = new THREE.PlaneGeometry(2.1, 8.4); g.rotateX(Math.PI / 2);
            put(g, 0, H2 + 2.60, z); glow.push(g);
            // the blue timetable and network-map panels on the back wall
            for (let b = 0; b < 3; b++) {
                g = boxG(0.05, 1.15, 1.05); put(g, -side * 1.22, H2 + 1.45, z - 2.6 + b * 2.6); navy.push(g);
            }
        }

        // the route sign at the southern end, and the stop-number totem
        g = cylG(0.05, 0.055, 3.0, 8); put(g, -side * 0.9, H2 + 1.5, -len / 2 + 3.0); steel.push(g);
        g = boxG(0.06, 1.05, 1.9); put(g, -side * 0.9, H2 + 2.35, -len / 2 + 3.0); navy.push(g);
        g = cylG(0.06, 0.07, 3.6, 8); put(g, side * 1.1, H2 + 1.8, len / 2 - 3.0); steel.push(g);
        g = boxG(0.08, 1.6, 0.62); put(g, side * 1.1, H2 + 2.90, len / 2 - 3.0); navy.push(g);
        g = boxG(0.10, 0.46, 0.46); put(g, side * 1.1, H2 + 3.42, len / 2 - 3.0); glow.push(g);
        // myki reader posts and a bin
        for (const q of [-len * 0.18, len * 0.20]) {
            g = cylG(0.07, 0.08, 1.25, 8); put(g, side * 0.5, H2 + 0.62, q); steel.push(g);
            g = boxG(0.30, 0.34, 0.20); put(g, side * 0.5, H2 + 1.32, q); navy.push(g);
        }
        g = cylG(0.30, 0.26, 0.95, 10); put(g, -side * 0.9, H2 + 0.48, len * 0.12); steel.push(g);

        // The blue timetable boards are merged in with the steel rather than
        // kept apart: at platform scale they are dark panels either way, and a
        // fifth mesh on each of five stops is a quarter of what the crowd costs.
        G.add(merged(conc, MATS.concrete), merged(yell, MATS.yellow),
              merged(steel.concat(navy), MATS.iron), merged(glass, glassMat));
        const lit = merged(glow, soffitMat);
        G.add(lit); world.ghost(lit);
        G.position.set(cx, 0, cz);
        if (axis === 'x') G.rotation.y = Math.PI / 2;
        scene.add(G);
        world.part(name, G);
        return G;
    }

    // The platform face clears the 2.66 m tram body by about a hundred
    // millimetres, which is what makes stepping across feel like a step.
    tramStop('tramstop_00', -(TRS + 2.96), 64, 68, 1, 'z', [-0.24, 0.20]);
    tramStop('tramstop_01', TRS + 2.96, 64, 68, -1, 'z', [-0.20, 0.24]);
    // and the safety zones: Flinders Street either side of the crossing, and
    // one more up Swanston past Flinders Lane
    tramStop('safetyzone_00', 42, -7.15, 28, -1, 'x', [0.0]);
    tramStop('safetyzone_01', -42, 7.15, 28, 1, 'x', [0.0]);
    tramStop('safetyzone_02', -(TRS + 2.35), -45, 30, 1, 'z', [-0.12]);

    /* ============================================================
       9 · Flinders Street Station — the south-west quadrant

       The building reads from the ground up in bands, and modelling it that way
       is what makes it recognisable at fifty metres in the rain: bluestone and
       granite plinth, the shopfronts under the street verandah, the great
       arcade of round-arched windows, a field of red brick behind a second
       smaller tier, the cornice and its dentils, and a balustraded parapet with
       urns over every second pilaster. At the corner all of that stops and the
       giant arch takes over.

       Every piece below goes into a bucket by material and the buckets are
       merged at the end, so nine hundred mouldings arrive as fifteen meshes.
       ============================================================ */
    const archShape = (w, h) => {
        const s = new THREE.Shape(), hw = w / 2, sh = h - hw;
        s.moveTo(-hw, 0); s.lineTo(-hw, sh);
        s.absarc(0, sh, hw, Math.PI, 0, true);
        s.lineTo(hw, 0); s.closePath();
        return s;
    };
    /* A pointed arch, struck as two arcs from opposite springings — the one
       piece of geometry that separates St Paul's from everything around it. */
    const gothicShape = (w, h, sp) => {
        const hw = w / 2;
        if (sp === undefined) sp = h - w * 0.72;
        sp = clamp(sp, 0.05, h - 0.2);
        const R = Math.sqrt((h - sp) * (h - sp) + hw * hw);
        const a0 = Math.acos(clamp(w / R, -1, 1));
        const a1 = Math.acos(clamp(hw / R, -1, 1));
        const s = new THREE.Shape(), N = 8;
        s.moveTo(-hw, 0); s.lineTo(-hw, sp);
        for (let i = 1; i <= N; i++) { const t = a0 + (a1 - a0) * (i / N); s.lineTo(hw - R * Math.cos(t), sp + R * Math.sin(t)); }
        for (let i = N - 1; i >= 0; i--) { const t = a0 + (a1 - a0) * (i / N); s.lineTo(-hw + R * Math.cos(t), sp + R * Math.sin(t)); }
        s.lineTo(hw, 0); s.closePath();
        return s;
    };
    const shapeG = (s) => new THREE.ShapeGeometry(s, 10);
    const prismG = (w, h, d) => {
        const s = new THREE.Shape();
        s.moveTo(-w / 2, 0); s.lineTo(w / 2, 0); s.lineTo(0, h); s.closePath();
        const g = new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: false });
        g.translate(0, 0, -d / 2);
        return g;
    };

    const STN = {
        stone: [], cream: [], brick: [], reveal: [], granite: [], glass: [],
        copper: [], iron: [], green: [], slate: [], balus: [], glow: [],
    };
    // Everything in this section is built at the origin and then carried into
    // place by one matrix, so a wing can be written once and stood up three
    // times facing three different streets.
    const carry = (arr, g, M0) => { if (M0) g.applyMatrix4(M0); arr.push(g); };

    function classicalWing(B, M0, w, h, d, o) {
        o = o || {};
        const bays = Math.max(1, Math.round(w / (o.bay || 4.6)));
        const bw = w / bays;
        let g, i, x;

        g = boxG(w, h, d); put(g, 0, h / 2, -d / 2); carry(B.stone, g, M0);
        g = boxG(w + 0.55, 2.7, d - 0.24); put(g, 0, 1.35, 0.12 - (d - 0.24) / 2); carry(B.granite, g, M0);
        g = boxG(w + 0.35, 0.42, 0.55); put(g, 0, 2.85, 0.16); carry(B.cream, g, M0);
        g = boxG(w, 4.6, 0.10); put(g, 0, 15.6, 0.03); carry(B.brick, g, M0);
        g = boxG(w, 1.15, 0.14); put(g, 0, 13.35, 0.06); carry(B.reveal, g, M0);

        // one arched opening: cream archivolt, deep red-brown reveal, dark glass
        const opening = (ow, oh, y, bars) => {
            let a = shapeG(archShape(ow + 1.0, oh + 0.8)); put(a, x, y, 0.16); carry(B.cream, a, M0);
            a = shapeG(archShape(ow + 0.30, oh + 0.26)); put(a, x, y, 0.20); carry(B.reveal, a, M0);
            a = shapeG(archShape(ow, oh)); put(a, x, y, 0.23); carry(B.glass, a, M0);
            a = boxG(0.44, 1.05, 0.34); put(a, x, y + oh - 0.15, 0.24); carry(B.cream, a, M0);
            if (bars) {
                a = boxG(0.10, oh - ow / 2 - 0.3, 0.04); put(a, x, y + (oh - ow / 2) / 2, 0.26); carry(B.cream, a, M0);
                a = boxG(ow * 0.88, 0.10, 0.04); put(a, x, y + oh - ow / 2, 0.26); carry(B.cream, a, M0);
            }
        };
        for (i = 0; i < bays; i++) {
            x = -w / 2 + (i + 0.5) * bw;
            opening(bw * 0.60, 6.6, 5.8, true);          // the great arcade
            opening(bw * 0.50, 3.4, 14.0, false);        // the smaller upper tier
            if (o.verandah !== false) {                  // shopfront under the verandah
                g = boxG(bw * 0.88, 1.7, 0.24); put(g, x, 3.55, 0.20); carry(B.green, g, M0);
                g = boxG(bw * 0.74, 1.25, 0.28); put(g, x, 3.55, 0.30); carry(B.glass, g, M0);
            }
        }
        for (i = 0; i <= bays; i++) {                    // pilasters, base and capital
            x = -w / 2 + i * bw;
            g = boxG(0.95, 11.6, 0.52); put(g, x, 7.4, 0.16); carry(B.cream, g, M0);
            g = boxG(1.35, 0.60, 0.72); put(g, x, 13.4, 0.24); carry(B.cream, g, M0);
            g = boxG(1.25, 0.42, 0.66); put(g, x, 5.55, 0.22); carry(B.cream, g, M0);
            g = boxG(0.80, 3.9, 0.42); put(g, x, 15.9, 0.12); carry(B.cream, g, M0);
        }
        for (const y of [5.55, 12.95, 17.85]) {          // string courses and the main cornice
            g = boxG(w + 0.6, y === 5.55 ? 0.50 : 0.46, y === 5.55 ? 0.62 : 0.58);
            put(g, 0, y, y === 17.85 ? 0.22 : 0.20); carry(B.cream, g, M0);
        }
        const nd = Math.round(w / 1.05);
        for (i = 0; i < nd; i++) {
            g = boxG(0.40, 0.44, 0.5); put(g, -w / 2 + 0.35 + i * (w - 0.7) / (nd - 1), 18.35, 0.44); carry(B.cream, g, M0);
        }
        g = boxG(w + 1.8, 1.05, 1.35); put(g, 0, 19.05, 0.42); carry(B.cream, g, M0);

        if (o.extraFloor) {
            for (i = 0; i < bays; i++) {
                x = -w / 2 + (i + 0.5) * bw;
                g = boxG(bw * 0.44 + 0.44, 2.94, 0.10); put(g, x, 21.45, 0.19); carry(B.cream, g, M0);
                g = boxG(bw * 0.44, 2.5, 0.10); put(g, x, 21.45, 0.23); carry(B.glass, g, M0);
            }
            g = boxG(w, 3.4, 0.10); put(g, 0, 21.4, 0.03); carry(B.brick, g, M0);
            g = boxG(w + 1.8, 0.95, 1.25); put(g, 0, 23.5, 0.42); carry(B.cream, g, M0);
        }

        // the balustraded parapet, with urns over every second pilaster
        const pTop = o.extraFloor ? 24.0 : 19.6;
        g = boxG(w + 1.2, 0.35, 0.75); put(g, 0, pTop, 0.20); carry(B.cream, g, M0);
        g = uvScale(new THREE.PlaneGeometry(w, 1.45), Math.max(1, Math.round(w / 3.2)), 1);
        put(g, 0, pTop + 0.9, 0.26); carry(B.balus, g, M0);
        g = boxG(w + 1.3, 0.34, 0.85); put(g, 0, pTop + 1.75, 0.22); carry(B.cream, g, M0);
        for (i = 0; i <= bays; i += 2) {
            x = -w / 2 + i * bw;
            g = boxG(1.15, 1.9, 0.75); put(g, x, pTop + 0.95, 0.22); carry(B.cream, g, M0);
            g = cylG(0.28, 0.38, 0.62, 8); put(g, x, pTop + 2.2, 0.22); carry(B.cream, g, M0);
            g = sphG(0.34, 10, 8); put(g, x, pTop + 2.6, 0.22); carry(B.cream, g, M0);
        }

        if (o.verandah !== false) {                      // the street verandah over the footpath
            g = boxG(w, 0.26, 4.6); put(g, 0, 4.55, 2.3); carry(B.iron, g, M0);
            g = boxG(w, 0.72, 0.20); put(g, 0, 4.26, 4.55); carry(B.green, g, M0);
            g = boxG(w, 0.18, 0.52); put(g, 0, 4.72, 4.5); carry(B.cream, g, M0);
            for (i = 0; i <= bays; i++) {
                x = -w / 2 + i * bw;
                g = cylG(0.08, 0.10, 4.4, 8); put(g, x, 2.2, 4.35); carry(B.iron, g, M0);
                g = boxG(0.5, 0.5, 0.5); put(g, x, 4.35, 4.1); carry(B.iron, g, M0);
            }
        }
    }

    // A dome: a slightly ogee shell of revolution, its ribs, and a cupola.
    function domeGeo(B, M0, r, o) {
        o = o || {};
        const rise = o.rise === undefined ? 0.92 : o.rise;
        const pts = [];
        for (let i = 0; i <= 12; i++) {
            const t = i / 12, a = t * Math.PI / 2;
            pts.push(new THREE.Vector2(Math.cos(a) * r * (1 + 0.06 * Math.sin(a * 2)) + 0.001, Math.sin(a) * r * rise));
        }
        let g = new THREE.LatheGeometry(pts, 20); carry(B.copper, g, M0);
        if (o.ribs !== false) {
            for (let k = 0; k < 8; k++) {
                g = new THREE.TorusGeometry(r, 0.09, 5, 12, Math.PI / 2);
                put(g, 0, 0, 0, 0, k / 8 * Math.PI * 2, 0, 1, rise, 1);
                carry(B.copper, g, M0);
            }
        }
        const apex = r * rise, lh = r * 0.30;
        g = cylG(r * 0.22, r * 0.24, 0.5, 12); put(g, 0, apex - 0.1, 0); carry(B.copper, g, M0);
        g = cylG(r * 0.19, r * 0.21, lh, 12); put(g, 0, apex + lh / 2 + 0.2, 0); carry(B.copper, g, M0);
        g = new THREE.SphereGeometry(r * 0.19, 12, 7, 0, 6.3, 0, Math.PI / 2);
        put(g, 0, apex + lh + 0.2, 0, 0, 0, 0, 1, 0.8, 1); carry(B.copper, g, M0);
        g = cylG(0.05, 0.05, r * 0.30, 6); put(g, 0, apex + lh + r * 0.20, 0); carry(B.iron, g, M0);
        g = sphG(r * 0.05, 8, 6); put(g, 0, apex + lh + r * 0.16, 0); carry(B.copper, g, M0);
    }

    {
        const B = STN;
        const W = (x, y, z, ry) => MX(x, y, z, 0, ry, 0);
        let g;

        /* --- the Flinders Street frontage. Three storeys at the Swanston
               Street end, four by the time it reaches Elizabeth Street where
               the ground falls away. --- */
        classicalWing(B, W(-68, 0, BZ, Math.PI), 60, 20.5, 30, { bay: 4.6 });
        classicalWing(B, W(-126, 0.02, BZ, Math.PI), 56, 24.6, 30, { bay: 4.6, extraFloor: true });
        /* --- and the Swanston Street frontage, which was never finished as
               designed: a short masonry front, then the concourse. --- */
        classicalWing(B, W(-BX, 0.045, 55, Math.PI / 2), 30, 20.5, 26, { bay: 4.6 });

        /* --- the corner entrance bay, set on the diagonal so it faces the
               crossing squarely. Read from the ground up: a giant round arch,
               and set back inside it the row of indicator clocks with the name
               band above them; then three tall windows behind a balustrade;
               then the entablature and a pediment with the big clock in its
               tympanum; and behind all of that the drum and the copper dome. --- */
        const P = W(-28.25, 0, 30.25, Math.PI * 0.75);
        const pw = 27.0, pd = 26, ph = 25.4;
        g = boxG(pw, ph, pd); put(g, 0, ph / 2, -pd / 2 + 0.5); carry(B.stone, g, P);
        g = boxG(pw + 0.6, 3.2, pd); put(g, 0, 1.6, -pd / 2 + 0.5); carry(B.granite, g, P);

        const AW = 14.2, AH = 16.6, SPR = AH - AW / 2;
        g = shapeG(archShape(AW + 0.5, AH + 0.42)); put(g, 0, 0.9, 0.59); carry(B.cream, g, P);
        g = shapeG(archShape(AW, AH)); put(g, 0, 0.9, 0.61); carry(B.glass, g, P);
        for (let v = 0; v <= 16; v++) {          // radiating voussoirs round the head
            const va = Math.PI * v / 16;
            g = boxG(1.05, 1.5, 0.55);
            put(g, Math.cos(va) * (AW / 2 + 0.62), 0.9 + SPR + Math.sin(va) * (AW / 2 + 0.62), 0.72, 0, 0, va - Math.PI / 2);
            carry(B.cream, g, P);
        }
        g = boxG(1.5, 2.4, 0.85); put(g, 0, 0.9 + AH + 0.15, 0.8); carry(B.cream, g, P);
        g = boxG(AW + 4.4, 0.75, 0.75); put(g, 0, 0.9 + SPR, 0.66); carry(B.cream, g, P);

        // inside the arch: the concourse mouth, which is the warmest thing on
        // this corner and the reason the footpath outside it is gold
        g = boxG(AW - 1.2, 15.0, 6.0); put(g, 0, 7.5, -2.55); carry(B.glass, g, P);
        g = boxG(AW - 2.6, 3.4, 0.3); put(g, 0, 2.6, 0.60); carry(B.glow, g, P);
        g = boxG(AW - 3.6, 0.28, 0.3); put(g, 0, 5.4, 0.62); carry(B.glow, g, P);
        g = boxG(11.0, 4.6, 0.3); put(g, 0, 2.3, 0.62); carry(B.glass, g, P);
        for (const s of [-3.7, 3.7]) { g = boxG(0.34, 4.6, 0.4); put(g, s, 2.3, 0.66); carry(B.cream, g, P); }

        // the indicator clocks, set back under the arch; the case is one box
        // and the nine faces are one texture, because nine clocks is nine
        // meshes and this is a station, not a clock shop
        g = boxG(12.6, 1.9, 0.42); put(g, 0, 7.6, 0.62); carry(B.glass, g, P);
        for (const y of [8.65, 6.55]) { g = boxG(13.0, 0.24, 0.6); put(g, 0, y, 0.66); carry(B.cream, g, P); }
        const clockRow = mesh(new THREE.PlaneGeometry(12.2, 1.36),
            emissive(0xffffff, 0xffd79a, 0.85, { map: clockRowTex, roughness: 0.52 }));
        clockRow.applyMatrix4(MX(0, 7.6, 0.85));
        clockRow.applyMatrix4(P);
        for (const y of [9.95, 8.68]) { g = boxG(13.8, 0.26, 0.5); put(g, 0, y, 0.66); carry(B.cream, g, P); }

        const nameBand = mesh(new THREE.PlaneGeometry(13.4, 0.95),
            emissive(0xffffff, 0x2a2419, 0.5, {
                map: textTex(['FLINDERS  STREET  STATION'], {
                    w: 2048, h: 128, fg: '#efe6cf', bg: '#1a1714', size: 74, font: 'Georgia, serif', track: 5,
                }), roughness: 0.7,
            }));
        nameBand.applyMatrix4(MX(0, 9.3, 0.72));
        nameBand.applyMatrix4(P);

        // rusticated flanks either side, and their ground-floor openings
        for (const sf of [-1, 1]) {
            const fx = sf * (AW / 2 + 3.1);
            g = boxG(4.6, 22.5, 0.95); put(g, fx, 11.4, 0.45); carry(B.cream, g, P);
            for (let r = 0; r < 10; r++) { g = boxG(4.9, 0.16, 1.05); put(g, fx, 1.6 + r * 2.2, 0.5); carry(B.stone, g, P); }
            for (const q of [[2.4, 4.4, 2.0], [2.2, 3.6, 9.4]]) {
                g = shapeG(archShape(q[0] + 0.5, q[1] + 0.42)); put(g, fx, q[2], 1.02); carry(B.cream, g, P);
                g = shapeG(archShape(q[0], q[1])); put(g, fx, q[2], 1.04); carry(B.glass, g, P);
            }
            g = boxG(2.44, 2.84, 0.10); put(g, fx, 17.8, 1.02); carry(B.cream, g, P);
            g = boxG(2.0, 2.4, 0.10); put(g, fx, 17.8, 1.06); carry(B.glass, g, P);
        }

        // the wide staircase — "I'll meet you on the steps"
        for (let s = 0; s < 5; s++) { g = boxG(18.5 - s * 0.5, 0.18, 0.95); put(g, 0, 0.09 + s * 0.18, 0.9 + s * 0.95); carry(B.granite, g, P); }
        for (const x of [-9.8, 9.8]) { g = boxG(0.95, 1.4, 5.6); put(g, x, 0.7, 3.2); carry(B.granite, g, P); }

        // the storey above the arch: three windows behind a balustrade
        g = boxG(pw + 0.8, 0.7, 1.0); put(g, 0, 19.2, 0.5); carry(B.cream, g, P);
        g = uvScale(new THREE.PlaneGeometry(15.5, 1.5), 5, 1); put(g, 0, 20.25, 0.9); carry(B.balus, g, P);
        for (let u = -1; u <= 1; u++) {
            g = boxG(2.94, 4.04, 0.10); put(g, u * 4.4, 21.6, 0.58); carry(B.cream, g, P);
            g = boxG(2.5, 3.6, 0.10); put(g, u * 4.4, 21.6, 0.62); carry(B.glass, g, P);
            for (const s of [-1.9, 1.9]) { g = boxG(1.0, 4.6, 0.55); put(g, u * 4.4 + s, 21.8, 0.55); carry(B.cream, g, P); }
        }

        // entablature, dentils, and the pediment with its clock
        g = boxG(pw + 1.4, 0.9, 1.2); put(g, 0, 24.6, 0.45); carry(B.cream, g, P);
        for (let d = 0; d < 34; d++) { g = boxG(0.34, 0.42, 0.5); put(g, -pw / 2 + 0.6 + d * (pw - 1.2) / 33, 24.0, 0.7); carry(B.cream, g, P); }
        g = boxG(pw + 1.9, 0.55, 1.6); put(g, 0, 25.3, 0.55); carry(B.cream, g, P);

        const PEDW = 21.0, PEDH = 4.7, PEDY = 25.6;
        g = prismG(PEDW, PEDH, 1.1); put(g, 0, PEDY, 0.45); carry(B.stone, g, P);
        g = prismG(PEDW + 1.6, PEDH + 0.7, 0.7); put(g, 0, PEDY - 0.2, 0.15); carry(B.cream, g, P);
        g = boxG(PEDW + 1.6, 0.5, 1.3); put(g, 0, PEDY - 0.15, 0.5); carry(B.cream, g, P);
        g = new THREE.TorusGeometry(1.95, 0.24, 8, 20); put(g, 0, PEDY + 1.7, 1.02); carry(B.cream, g, P);
        g = sphG(0.5, 12, 9); put(g, 0, PEDY + PEDH + 0.5, 0.4); carry(B.cream, g, P);
        for (const s of [-1, 1]) { g = boxG(0.9, 0.9, 0.9); put(g, s * (PEDW / 2 + 0.8), PEDY + 0.35, 0.5); carry(B.cream, g, P); }

        // the clock faces: the one in the tympanum and the four on the tower,
        // all reading the same twenty to five, and all one mesh
        const clockFaces = [];
        g = new THREE.CircleGeometry(1.75, 22); put(g, 0, PEDY + 1.7, 1.06); g.applyMatrix4(P); clockFaces.push(g);

        // balustrades, the domed corner turrets and the flagstaffs
        for (const s of [-1, 1]) {
            const bx = s * (pw / 2 - 2.3);
            g = uvScale(new THREE.PlaneGeometry(6.0, 1.9), 2, 1); put(g, s * (PEDW / 2 + 3.4), 26.55, 0.42); carry(B.balus, g, P);
            g = boxG(5.2, 7.4, 5.2); put(g, bx, 25.6, -3.6); carry(B.cream, g, P);
            g = boxG(5.9, 0.8, 5.9); put(g, bx, 29.7, -3.6); carry(B.cream, g, P);
            g = shapeG(archShape(1.8, 3.0)); put(g, bx, 25.4, -0.8); carry(B.glass, g, P);
            domeGeo(B, MX(bx, 30.0, -3.6).premultiply(P), 2.75, { rise: 1.0, ribs: false });
            g = cylG(0.09, 0.12, 9.0, 8); put(g, s * (PEDW / 2 + 3.4), 31.6, 0.2); carry(B.cream, g, P);
            g = sphG(0.16, 8, 6); put(g, s * (PEDW / 2 + 3.4), 36.2, 0.2); carry(B.cream, g, P);
        }

        // the drum and the copper dome, set back behind the pediment
        const D = MX(0, 25.0, -13.5).premultiply(P);
        g = cylG(10.6, 11.0, 2.0, 18); put(g, 0, 1.0, 0); carry(B.cream, g, D);
        g = cylG(9.7, 9.7, 5.8, 18); put(g, 0, 4.9, 0); carry(B.stone, g, D);
        for (let d = 0; d < 8; d++) {
            const da = d / 8 * Math.PI * 2;
            g = shapeG(archShape(3.0, 4.2));
            put(g, Math.sin(da) * 9.65, 2.5, Math.cos(da) * 9.65, 0, da, 0); carry(B.glass, g, D);
            for (const po of [-0.20, 0.20]) {
                const pa = da + Math.PI / 8 + po;
                g = cylG(0.42, 0.46, 5.4, 8); put(g, Math.sin(pa) * 9.5, 4.8, Math.cos(pa) * 9.5); carry(B.cream, g, D);
            }
        }
        g = cylG(11.0, 10.1, 1.5, 18); put(g, 0, 8.6, 0); carry(B.cream, g, D);
        domeGeo(B, MX(0, 9.2, 0).premultiply(D), 10.2, { rise: 0.82 });

        // the corner awnings, either side of the entrance bay
        for (const sv of [-1, 1]) {
            g = boxG(4.0, 0.24, 4.2); put(g, sv * 9.2, 5.4, 2.3); carry(B.iron, g, P);
            g = boxG(4.0, 0.62, 0.18); put(g, sv * 9.2, 5.1, 4.35); carry(B.green, g, P);
        }

        /* --- the Swanston Street concourse: a low hall under a broad glazed
               roof, and the ticket barriers behind its glass wall --- */
        g = boxG(24, 11.0, 34); put(g, -30.6, 5.5, 82); B.stone.push(g);
        g = boxG(25, 1.0, 35); put(g, -30.6, 11.3, 82); B.cream.push(g);
        g = boxG(16, 0.35, 34); put(g, -12.0, 7.6, 82); B.iron.push(g);
        g = boxG(15, 0.10, 33); put(g, -12.0, 7.85, 82); B.glass.push(g);
        for (let c = 0; c < 6; c++) {
            g = cylG(0.16, 0.20, 7.5, 8); put(g, -5.2, 3.75, 68 + c * 5.6); B.iron.push(g);
            g = boxG(0.22, 0.22, 8.0); put(g, -8.6, 7.4, 68 + c * 5.6); B.iron.push(g);
        }
        g = boxG(0.5, 1.6, 34); put(g, -4.0, 6.9, 82); B.green.push(g);
        g = boxG(0.4, 4.2, 30); put(g, -18.42, 2.1, 82); B.glass.push(g);
        for (let c = 0; c < 7; c++) { g = boxG(1.2, 1.2, 0.6); put(g, -16.4, 0.6, 70 + c * 4.0); B.iron.push(g); }

        /* --- the projecting entrance bays along the Flinders Street frontage:
               Degraves Street's subway, and the next one west --- */
        const entranceBay = (x, w, h) => {
            const E = MX(x, 0, BZ + 0.9);
            let q;
            q = boxG(w, h, 3.0); put(q, 0, h / 2, -1.5); carry(B.stone, q, E);
            q = boxG(w + 1.2, 1.1, 3.4); put(q, 0, h - 0.48, -1.4); carry(B.cream, q, E);
            q = boxG(w * 0.72, 1.5, 1.4); put(q, 0, h + 0.75, -0.5); carry(B.cream, q, E);
            q = prismG(w * 0.72, 1.7, 1.4); put(q, 0, h + 1.5, -0.5); carry(B.cream, q, E);
            for (const a of [[w * 0.40, 6.4, 8.4], [w * 0.34, 4.2, 15.0]]) {
                q = shapeG(archShape(a[0] + 0.5, a[1] + 0.42)); put(q, 0, a[2], 1.62, 0, Math.PI, 0); carry(B.cream, q, E);
                q = shapeG(archShape(a[0], a[1])); put(q, 0, a[2], 1.64, 0, Math.PI, 0); carry(B.glass, q, E);
            }
            // an attic pedestal running back into the building carries the drum,
            // so the turret has mass under it rather than hanging over the path
            q = boxG(w * 0.88, 3.6, 8.4); put(q, 0, h + 1.8, 1.2); carry(B.stone, q, E);
            q = boxG(w * 0.96, 0.75, 8.8); put(q, 0, h + 3.98, 1.2); carry(B.cream, q, E);
            const DR = w * 0.26;
            q = cylG(DR + 0.55, DR + 0.7, 1.2, 14); put(q, 0, h + 4.9, 0.2); carry(B.cream, q, E);
            q = cylG(DR, DR, 2.9, 14); put(q, 0, h + 6.9, 0.2); carry(B.stone, q, E);
            for (let d = 0; d < 6; d++) {
                const da = d / 6 * Math.PI * 2;
                q = shapeG(archShape(1.2, 1.8));
                put(q, Math.sin(da) * (DR + 0.02), h + 6.3, 0.2 + Math.cos(da) * (DR + 0.02), 0, da, 0);
                carry(B.glass, q, E);
            }
            q = cylG(DR + 0.62, DR + 0.18, 0.85, 14); put(q, 0, h + 8.55, 0.2); carry(B.cream, q, E);
            domeGeo(B, MX(0, h + 8.85, 0.2).premultiply(E), DR + 0.35, { rise: 0.95, ribs: false });
            // the subway entrance in the footpath below it
            q = boxG(w * 0.5, 0.9, 3.0); put(q, 0, 0.45 + KERB_H, 4.6); carry(B.iron, q, E);
            q = boxG(w * 0.42, 0.16, 2.4); put(q, 0, 0.98 + KERB_H, 4.6); carry(B.glass, q, E);
        };
        entranceBay(-58, 13, 21.0);
        entranceBay(-104, 13, 25.1);

        /* --- the clock tower at the Elizabeth Street end. It rises out of the
               frontage itself: the north face sits half a metre proud of the
               building line and the shaft runs back south into the block. --- */
        const T = MX(-146, 0, BZ - 2.0);
        const TZ = 9.0, TF = TZ - 7.5;
        g = boxG(15, 30, 15); put(g, 0, 15, TZ); carry(B.stone, g, T);
        g = boxG(15.6, 3.0, 16); put(g, 0, 1.5, TZ); carry(B.granite, g, T);
        for (const y of [8.0, 15.0, 22.0]) {
            g = shapeG(archShape(3.5, 4.82)); put(g, 0, y, TF - 0.04, 0, Math.PI, 0); carry(B.cream, g, T);
            g = shapeG(archShape(3.0, 4.4)); put(g, 0, y, TF - 0.06, 0, Math.PI, 0); carry(B.glass, g, T);
        }
        g = boxG(16.4, 1.2, 16.4); put(g, 0, 30.4, TZ); carry(B.cream, g, T);
        g = boxG(13.6, 6.4, 13.6); put(g, 0, 34.0, TZ); carry(B.stone, g, T);
        for (const f of [[0, 0, 6.9], [Math.PI, 0, -6.9], [Math.PI / 2, 6.9, 0], [-Math.PI / 2, -6.9, 0]]) {
            g = new THREE.CircleGeometry(2.6, 24);
            put(g, f[1], 34.2, TZ + f[2], 0, f[0], 0); g.applyMatrix4(T); clockFaces.push(g);
            g = new THREE.TorusGeometry(2.85, 0.28, 8, 20);
            put(g, f[1], 34.2, TZ + f[2], 0, f[0], 0); carry(B.cream, g, T);
        }
        g = boxG(15.2, 1.3, 15.2); put(g, 0, 38.0, TZ); carry(B.cream, g, T);
        for (const bq of [[0, -7.4, Math.PI], [0, 7.4, 0], [7.4, 0, Math.PI / 2], [-7.4, 0, -Math.PI / 2]]) {
            g = uvScale(new THREE.PlaneGeometry(14.4, 1.9), 4, 1);
            put(g, bq[0], 39.65, TZ + bq[1], 0, bq[2], 0); carry(B.balus, g, T);
        }
        g = cylG(5.2, 5.6, 2.6, 14); put(g, 0, 40.0, TZ); carry(B.stone, g, T);
        domeGeo(B, MX(0, 41.3, TZ).premultiply(T), 5.2, { rise: 1.15 });

        /* --- roofs over the frontage, and the train shed behind it --- */
        g = prismG(26, 2.8, 60); put(g, -68, 20.4, BZ + 16.0, 0, Math.PI / 2, 0); B.slate.push(g);
        g = prismG(26, 2.8, 55.4); put(g, -126, 24.5, BZ + 16.0, 0, Math.PI / 2, 0); B.slate.push(g);
        g = prismG(22, 2.4, 30); put(g, -BX - 13, 20.4, 55); B.slate.push(g);
        g = boxG(150, 0.4, 78); put(g, -85, 0.2, 92); B.stone.push(g);
        for (let t = 0; t < 6; t++) {
            const zc = 60 + t * 11.0;
            g = prismG(10.0, 2.0, 140); put(g, -88, 7.4, zc, 0, Math.PI / 2, 0); B.slate.push(g);
            g = boxG(140, 0.25, 9.6); put(g, -88, 7.3, zc); B.slate.push(g);
            for (let q = 0; q < 10; q++) { g = cylG(0.12, 0.14, 7.2, 8); put(g, -150 + q * 14, 3.6, zc); B.iron.push(g); }
        }

        /* --- and the signage on the verandah fascia, which is how you find the
               place from a hundred metres down Flinders Street --- */
        const fascia = mesh(new THREE.PlaneGeometry(46, 0.9),
            stdMat(0xffffff, {
                map: textTex(['FLINDERS  STREET  STATION'], {
                    w: 2048, h: 128, fg: '#efe4cb', bg: '#12371c', size: 66, font: 'Georgia, serif', track: 4,
                }), roughness: 0.7,
            }), -58, 4.20, BZ - 4.62);
        fascia.rotation.y = Math.PI;

        const station = new THREE.Group();
        station.add(
            merged(B.stone, MATS.stone), merged(B.cream, MATS.cream),
            merged(B.brick, MATS.brick),
            merged(B.granite, MATS.granite), merged(B.glass.concat(B.reveal), MATS.glass),
            merged(B.copper, MATS.copper), merged(B.iron, MATS.iron),
            merged(B.green, MATS.green), merged(B.slate, MATS.slate),
            mesh(merge(B.balus), stdMat(0xffffff, {
                map: balusterTex, transparent: true, alphaTest: 0.45,
                side: THREE.DoubleSide, roughness: 0.7,
            })),
            mesh(merge(clockFaces), emissive(0xffffff, 0xffd79a, 0.55, {
                map: clockTex(HOUR, MINUTE, true), roughness: 0.5,
            })),
            clockRow, nameBand, fascia);
        const concourseGlow = merged(B.glow, emissive(0x6a5a44, 0xffc987, 2.1));
        station.add(concourseGlow);
        world.ghost(concourseGlow);
        scene.add(station);
        world.part('station_00', station);
    }

    /* ============================================================
       10 · St Paul's Cathedral — the north-east quadrant

       Banded Gothic Transitional, and set to the city grid rather than to
       liturgical east: the nave runs east-west along Flinders Street and the
       twin-towered ceremonial front looks down Swanston Street. Three spires,
       the central one very much the tallest.
       ============================================================ */
    {
        const B = { band: [], trim: [], spire: [], slate: [], glass: [], iron: [], lawn: [] };
        // The band course has to stay 3.2 m tall whatever wall it is on, so the
        // repeat is baked into each box's UVs before anything is merged.
        const bandBox = (w, h, d) => uvScale(boxG(w, h, d), Math.max(1, w / 4.0), Math.max(1, h / 3.2));

        const gothicWindow = (M0, w, h, x, y, z, ry, dark) => {
            let g = shapeG(gothicShape(w + 0.5, h + 0.5));
            put(g, x, y, z, 0, ry, 0); carry(B.trim, g, M0);
            g = shapeG(gothicShape(w, h));
            put(g, x + Math.sin(ry) * 0.03, y, z + Math.cos(ry) * 0.03, 0, ry, 0);
            carry(dark ? B.iron : B.glass, g, M0);
            const n = w > 4 ? 3 : (w > 2.2 ? 2 : 1);
            for (let i = 1; i < n; i++) {
                g = boxG(0.14, h * 0.7, 0.1);
                put(g, x - w / 2 + w * i / n + Math.sin(ry) * 0.06, y + h * 0.35, z + Math.cos(ry) * 0.06, 0, ry, 0);
                carry(B.trim, g, M0);
            }
            g = boxG(w * 0.92, 0.14, 0.1);
            put(g, x + Math.sin(ry) * 0.06, y + h * 0.62, z + Math.cos(ry) * 0.06, 0, ry, 0);
            carry(B.trim, g, M0);
        };
        const pinnacle = (M0, r, h, x, y, z, arr) => {
            let g = boxG(r * 1.7, h * 0.55, r * 1.7); put(g, x, y + h * 0.275, z); carry(arr, g, M0);
            g = coneG(r * 1.15, h * 0.5, 4); put(g, x, y + h * 0.55 + h * 0.25, z, 0, Math.PI / 4, 0); carry(arr, g, M0);
        };
        const gothicTower = (M0, w, hT, hS) => {
            let g = bandBox(w, hT, w); put(g, 0, hT / 2, 0); carry(B.band, g, M0);
            for (const s of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
                g = boxG(1.5, hT * 0.92, 1.5); put(g, s[0] * (w / 2 - 0.2), hT * 0.46, s[1] * (w / 2 - 0.2)); carry(B.trim, g, M0);
            }
            for (let f = 0; f < 4; f++) {
                const a = f / 4 * Math.PI * 2;
                gothicWindow(M0, w * 0.30, hT * 0.22, Math.sin(a) * (w / 2 + 0.05), hT * 0.68, Math.cos(a) * (w / 2 + 0.05), a, true);
                gothicWindow(M0, w * 0.24, hT * 0.15, Math.sin(a) * (w / 2 + 0.05), hT * 0.40, Math.cos(a) * (w / 2 + 0.05), a, true);
            }
            g = boxG(w + 1.3, 0.9, w + 1.3); put(g, 0, hT + 0.45, 0); carry(B.trim, g, M0);
            g = boxG(w + 0.7, 1.5, w + 0.7); put(g, 0, hT + 1.6, 0); carry(B.trim, g, M0);
            g = coneG(w * 0.62, hS, 8); put(g, 0, hT + 2.3 + hS / 2, 0); carry(B.spire, g, M0);
            g = cylG(0.14, 0.14, 2.2, 6); put(g, 0, hT + 2.3 + hS + 1.0, 0); carry(B.iron, g, M0);
            for (const s of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
                pinnacle(M0, 0.75, 6.5, s[0] * (w / 2 + 0.2), hT + 2.3, s[1] * (w / 2 + 0.2), B.spire);
            }
        };

        // The cathedral is modelled on a west-front-facing-(−X) local axis and
        // then turned a quarter turn, so its front looks back down Swanston.
        const G0 = MX(80, 0, -1, 0, Math.PI / 2, 0);
        const WF = 26.0, zS = -24.0, zN = -54.0, zMid = -39.0;
        const naveW = 50, naveD = 18, aisD = 6;
        const zAS = zS - aisD / 2, zAN = zN + aisD / 2;
        const trX = WF + 33;
        let g;

        g = bandBox(naveW, 24, naveD); put(g, WF + naveW / 2, 12, zMid); carry(B.band, g, G0);
        g = prismG(naveD + 0.8, 8.4, naveW); put(g, WF + naveW / 2, 24, zMid, 0, Math.PI / 2, 0); carry(B.slate, g, G0);

        for (const a of [[zAS, 1], [zAN, -1]]) {
            const zc = a[0], s = a[1], outer = zc + s * aisD / 2;
            g = bandBox(naveW, 13.5, aisD); put(g, WF + naveW / 2, 6.75, zc); carry(B.band, g, G0);
            g = prismG(aisD + 0.7, 3.2, naveW); put(g, WF + naveW / 2, 13.5, zc, 0, Math.PI / 2, 0); carry(B.slate, g, G0);
            for (let i = 0; i < 8; i++) {
                const x = WF + 6.4 + i * 5.6;
                gothicWindow(G0, 2.7, 6.4, x, 4.2, outer + s * 0.08, s > 0 ? 0 : Math.PI, false);
                g = boxG(1.4, 12.8, 1.7); put(g, x + 2.8, 6.4, outer + s * 0.75); carry(B.trim, g, G0);
                g = prismG(1.7, 1.3, 1.4); put(g, x + 2.8, 12.8, outer + s * 0.75, 0, Math.PI / 2, 0); carry(B.trim, g, G0);
                pinnacle(G0, 0.55, 3.6, x + 2.8, 13.9, outer + s * 0.75, B.trim);
                gothicWindow(G0, 2.3, 5.0, x, 15.6, zMid + s * (naveD / 2 + 0.08), s > 0 ? 0 : Math.PI, false);
                g = boxG(1.0, 0.8, Math.abs(zMid + s * naveD / 2 - (outer - s * 1.4)));
                put(g, x + 2.8, 13.2, (zMid + s * naveD / 2 + outer - s * 1.4) / 2); carry(B.trim, g, G0);
            }
        }

        // the west front, facing Swanston Street
        const W1 = MX(WF, 0, zMid, 0, -Math.PI / 2, 0).premultiply(G0);
        g = bandBox(naveD + 0.6, 27, 1.4); put(g, 0, 13.5, 0.3); carry(B.band, g, W1);
        g = prismG(naveD + 0.8, 8.0, 1.4); put(g, 0, 27, 0.3); carry(B.trim, g, W1);
        gothicWindow(W1, 9.4, 13.0, 0, 11.8, 1.15, 0, false);
        gothicWindow(W1, 4.6, 6.8, 0, 0.5, 1.2, 0, true);
        g = boxG(7.0, 1.0, 3.0); put(g, 0, 7.7, 2.0); carry(B.trim, g, W1);
        for (const q of [-1, 1]) { g = boxG(1.1, 7.5, 1.6); put(g, q * 3.4, 3.8, 1.9); carry(B.trim, g, W1); }
        g = boxG(naveD + 1.2, 0.8, 1.9); put(g, 0, 23.4, 0.8); carry(B.trim, g, W1);
        for (let k = 0; k < 4; k++) { g = boxG(11 - k * 0.5, 0.22, 1.1); put(g, 0, 0.11 + k * 0.22, 2.6 + k * 0.9); carry(B.trim, g, W1); }

        // the two western towers, on the aisle axes
        gothicTower(MX(WF + 4.6, 0, zAS).premultiply(G0), 9.4, 34, 26);
        gothicTower(MX(WF + 4.6, 0, zAN).premultiply(G0), 9.4, 34, 26);

        // the transepts; the southern gable fronts Flinders Street
        for (const s of [1, -1]) {
            const zc = zMid + s * (naveD / 2 + 4.5);
            g = bandBox(15, 24, 9.0); put(g, trX, 12, zc); carry(B.band, g, G0);
            g = prismG(15.6, 7.6, 9.0); put(g, trX, 24, zc); carry(B.slate, g, G0);
            const F = MX(trX, 0, zc + s * 4.5, 0, s > 0 ? 0 : Math.PI, 0).premultiply(G0);
            g = prismG(15.6, 7.7, 1.0); put(g, 0, 24, -0.3); carry(B.trim, g, F);
            gothicWindow(F, 8.0, 12.0, 0, 9.4, 0.14, 0, false);
            gothicWindow(F, 3.8, 5.8, 0, 0.35, 0.2, 0, true);
            g = boxG(6.0, 0.9, 2.6); put(g, 0, 6.6, 1.3); carry(B.trim, g, F);
            for (let m = 0; m < 4; m++) { g = boxG(9.5 - m * 0.4, 0.22, 1.0); put(g, 0, 0.11 + m * 0.22, 1.0 + m * 0.9); carry(B.trim, g, F); }
            for (const q of [-1, 1]) pinnacle(F, 0.7, 7.5, q * 7.9, 23.5, -0.2, B.trim);
        }

        // the central tower and its ninety-three metre spire
        gothicTower(MX(trX, 0, zMid).premultiply(G0), 14.2, 51, 42);

        // chancel, east end and the Chapter House on the Flinders Street side
        g = bandBox(17, 21, naveD); put(g, WF + naveW + 7, 10.5, zMid); carry(B.band, g, G0);
        g = prismG(naveD + 0.6, 7.0, 17); put(g, WF + naveW + 7, 21, zMid, 0, Math.PI / 2, 0); carry(B.slate, g, G0);
        gothicWindow(G0, 7.0, 11.0, WF + naveW + 15.6, 6.5, zMid, Math.PI / 2, false);
        g = boxG(13, 15, 13); put(g, 48, 7.5, -14); carry(B.trim, g, G0);
        g = coneG(9.9, 7.4, 4); put(g, 48, 18.7, -14, 0, Math.PI / 4, 0); carry(B.slate, g, G0);

        /* --- the forecourt: a low bluestone wall, iron railings, the lawn
               behind them, and Matthew Flinders on his granite plinth --- */
        g = boxG(0.6, 1.0, 62); put(g, BX + 1.4, 0.66 + KERB_H, -56); B.trim.push(g);
        g = boxG(34, 1.0, 0.6); put(g, BX + 20, 0.66 + KERB_H, -BZ - 1.6); B.trim.push(g);
        for (let i = 0; i < 40; i++) { g = cylG(0.05, 0.05, 1.1, 6); put(g, BX + 1.4, 1.7 + KERB_H, -26 - i * 1.5); B.iron.push(g); }
        for (let i = 0; i < 22; i++) { g = cylG(0.05, 0.05, 1.1, 6); put(g, BX + 4 + i * 1.5, 1.7 + KERB_H, -BZ - 1.6); B.iron.push(g); }
        g = boxG(52, 0.12, 62); put(g, 86, KERB_H + 0.03, -58); B.lawn.push(g);
        g = boxG(2.8, 0.4, 2.8); put(g, BX + 5.2, KERB_H + 0.2, -BZ - 5.0); B.trim.push(g);
        g = boxG(2.1, 2.8, 2.1); put(g, BX + 5.2, KERB_H + 1.8, -BZ - 5.0); B.trim.push(g);
        g = boxG(2.5, 0.3, 2.5); put(g, BX + 5.2, KERB_H + 3.35, -BZ - 5.0); B.trim.push(g);
        g = cylG(0.45, 0.55, 1.9, 10); put(g, BX + 5.2, KERB_H + 4.45, -BZ - 5.0); B.iron.push(g);
        g = sphG(0.32, 12, 8); put(g, BX + 5.2, KERB_H + 5.6, -BZ - 5.0); B.iron.push(g);
        g = boxG(0.24, 1.4, 0.24); put(g, BX + 5.7, KERB_H + 4.6, -BZ - 4.8); B.iron.push(g);

        const cathedral = new THREE.Group();
        cathedral.add(
            merged(B.band, MATS.banded), merged(B.trim, MATS.sand),
            merged(B.spire, MATS.spire), merged(B.slate, MATS.slate),
            merged(B.glass, MATS.glassLt), merged(B.iron, MATS.iron),
            merged(B.lawn, stdMat(0x5f6d45, { roughness: 0.86 })));
        scene.add(cathedral);
        world.part('cathedral_00', cathedral);
    }

    /* ============================================================
       11 · Young & Jackson, and the billboards behind it
                                              — the north-west quadrant

       A three-storey 1870s corner hotel with a splayed corner bay, a
       cast-iron verandah wrapping both frontages, and its name across the
       parapet. Behind it the block steps up and carries two LED billboards
       facing back down Swanston Street, which on a wet afternoon are the two
       brightest things at this end of the city.
       ============================================================ */
    {
        const B = { pub: [], white: [], green: [], glass: [], slate: [], lace: [] };
        const x0 = -BX, z0 = -BZ, w = 27, d = 23;
        const cx = x0 - w / 2, cz = z0 - d / 2;
        const H1 = 4.9, H2 = 4.3, H3 = 4.0, HT = H1 + H2 + H3;      // 13.2 to the cornice
        let g, i;

        g = boxG(w, HT, d); put(g, cx, HT / 2, cz); B.pub.push(g);
        g = boxG(5.6, HT + 0.09, 3.2); put(g, x0 - 1.5, (HT + 0.09) / 2, z0 - 1.5, 0, Math.PI / 4, 0); B.pub.push(g);

        // the ground floor: cream pilasters over a dark green timber shopfront
        g = boxG(w + 0.2, 3.5, 0.26); put(g, cx, 1.75, z0 + 0.1); B.green.push(g);
        g = boxG(0.26, 3.5, d + 0.2); put(g, x0 + 0.1, 1.75, cz); B.green.push(g);
        g = boxG(w + 0.3, 0.8, 0.36); put(g, cx, 3.9, z0 + 0.14); B.green.push(g);
        g = boxG(0.36, 0.8, d + 0.3); put(g, x0 + 0.14, 3.9, cz); B.green.push(g);
        g = boxG(w + 0.15, 0.55, 0.3); put(g, cx, 4.62, z0 + 0.12); B.white.push(g);
        g = boxG(0.3, 0.55, d + 0.15); put(g, x0 + 0.12, 4.62, cz); B.white.push(g);
        for (i = 0; i < 7; i++) { g = boxG(0.55, 4.3, 0.42); put(g, x0 - 1.4 - i * 4.0, 2.15, z0 + 0.16); B.white.push(g); }
        for (i = 0; i < 6; i++) { g = boxG(0.42, 4.3, 0.55); put(g, x0 + 0.16, 2.15, z0 - 1.4 - i * 4.0); B.white.push(g); }
        const pubWindow = (ow, oh, x, y, z, ry, frameArr) => {
            let q = shapeG(archShape(ow + 0.5, oh + 0.42)); put(q, x, y, z, 0, ry, 0); frameArr.push(q);
            q = shapeG(archShape(ow, oh));
            put(q, x + Math.sin(ry) * 0.03, y, z + Math.cos(ry) * 0.03, 0, ry, 0); B.glass.push(q);
        };
        for (i = 0; i < 6; i++) pubWindow(2.5, 3.6, x0 - 3.4 - i * 4.0, 0.5, z0 + 0.28, Math.PI, B.green);
        for (i = 0; i < 5; i++) pubWindow(2.5, 3.6, x0 + 0.28, 0.5, z0 - 3.4 - i * 4.0, Math.PI / 2, B.green);

        // the first-floor cast-iron verandah, wrapping both frontages
        const verandah = (len, along) => {
            const V = along === 'x' ? MX(cx, 0, z0) : MX(x0, 0, cz, 0, Math.PI / 2, 0);
            let q;
            q = boxG(len, 0.16, 3.0); put(q, 0, H1 + 0.18, 1.5); carry(B.green, q, V);
            q = boxG(len, 0.14, 3.3); put(q, 0, H1 + H2 - 0.2, 1.65); carry(B.slate, q, V);
            q = uvScale(new THREE.PlaneGeometry(len, 1.05), len / 2.2, 1);
            put(q, 0, H1 + H2 - 0.75, 3.15); carry(B.lace, q, V);
            q = uvScale(new THREE.PlaneGeometry(len, 0.95), len / 2.2, 1);
            put(q, 0, H1 + 0.75, 3.0); carry(B.lace, q, V);
            const n = Math.round(len / 3.0);
            for (let k = 0; k <= n; k++) {
                q = cylG(0.07, 0.09, H2 - 0.3, 8); put(q, -len / 2 + k * (len / n), H1 + H2 / 2, 3.0); carry(B.green, q, V);
            }
        };
        verandah(w, 'x'); verandah(d, 'z');

        for (i = 0; i < 6; i++) {
            pubWindow(1.7, 3.0, x0 - 3.4 - i * 4.0, H1 + 1.0, z0 + 0.18, Math.PI, B.white);
            pubWindow(1.5, 2.5, x0 - 3.4 - i * 4.0, H1 + H2 + 0.8, z0 + 0.18, Math.PI, B.white);
        }
        for (i = 0; i < 5; i++) {
            pubWindow(1.7, 3.0, x0 + 0.18, H1 + 1.0, z0 - 3.4 - i * 4.0, Math.PI / 2, B.white);
            pubWindow(1.5, 2.5, x0 + 0.18, H1 + H2 + 0.8, z0 - 3.4 - i * 4.0, Math.PI / 2, B.white);
        }

        // cornice, parapet, the raised corner pediment and its urns
        g = boxG(w + 1.4, 0.8, d + 1.4); put(g, cx, HT + 0.4, cz); B.white.push(g);
        g = boxG(w + 0.6, 2.0, d + 0.6); put(g, cx, HT + 1.8, cz); B.pub.push(g);
        g = boxG(w + 0.9, 0.35, d + 0.9); put(g, cx, HT + 2.9, cz); B.white.push(g);
        g = boxG(6.4, 2.6, 3.6); put(g, x0 - 2.0, HT + 4.2, z0 - 2.0, 0, Math.PI / 4, 0); B.pub.push(g);
        for (const o of [[-8, 0], [-16, 0], [0, -8], [0, -16]]) {
            g = cylG(0.30, 0.42, 0.55, 8); put(g, x0 + o[0] - 0.6, HT + 3.58, z0 + o[1] - 0.6); B.white.push(g);
            g = sphG(0.40, 10, 8); put(g, x0 + o[0] - 0.6, HT + 4.12, z0 + o[1] - 0.6); B.white.push(g);
            g = boxG(1.1, 0.22, 1.1); put(g, x0 + o[0] - 0.6, HT + 3.36, z0 + o[1] - 0.6); B.white.push(g);
        }
        g = prismG(d - 2, 2.6, w - 2); put(g, cx, HT + 0.9, cz, 0, Math.PI / 2, 0); B.slate.push(g);

        const nameTex = textTex(['YOUNG  AND  JACKSON'], {
            w: 1024, h: 128, fg: '#5c4632', bg: '#e7d3c2', size: 62, font: 'Georgia, serif', track: 2,
        });
        const names = [];
        let n0 = new THREE.PlaneGeometry(18, 1.7); put(n0, cx + 1, HT + 1.9, z0 + 0.35); names.push(n0);
        n0 = new THREE.PlaneGeometry(15, 1.7); put(n0, x0 + 0.35, HT + 1.9, cz - 1, 0, Math.PI / 2, 0); names.push(n0);

        const fascia = new THREE.PlaneGeometry(16, 1.0);
        put(fascia, cx + 1, H1 + 0.62, z0 + 0.4);

        const pub = new THREE.Group();
        pub.add(
            merged(B.pub.concat(B.slate), MATS.pub), merged(B.white, MATS.white),
            merged(B.green, MATS.green), merged(B.glass, MATS.glassLt),
            mesh(merge(B.lace), stdMat(0x2f6b4f, {
                map: laceTex, transparent: true, alphaTest: 0.4, side: THREE.DoubleSide, roughness: 0.5,
            })),
            mesh(merge(names), stdMat(0xffffff, { map: nameTex, roughness: 0.7 })),
            mesh(fascia, emissive(0xffffff, 0x2a3a26, 0.7, {
                map: textTex(['YOUNG & JACKSON'], {
                    w: 1024, h: 96, fg: '#e8d49a', bg: '#1f4a33', size: 54, font: 'Georgia, serif', track: 2,
                }), roughness: 0.6,
            })));
        scene.add(pub);
        world.part('younghotel_00', pub);
    }

    /* ---- the block behind it, and the two LED panels ---- */
    const billboards = [];
    {
        const ot = officeTex(10, 9, '#cfc7ba', '#4c5a66', 0.34);
        const host = stdMat(0xffffff, {
            map: ot.map, emissive: 0xffffff, emissiveMap: ot.emis, emissiveIntensity: 1.05, roughness: 0.62,
        });
        const G = new THREE.Group();
        G.add(mesh(boxG(28, 26, 22), host, -32.6, 13, -53));
        G.add(mesh(boxG(20, 30, 22), MATS.stone, -58, 15, -54));

        const frames = [];
        const panel = (x, y, z, w, h, rotY, i) => {
            const t = adTex(i);
            const m = emissive(0xffffff, 0xffffff, 1.35, { map: t, emissiveMap: t, roughness: 0.4 });
            const p = mesh(new THREE.PlaneGeometry(w, h), m, x, y, z);
            p.rotation.y = rotY;
            G.add(p); world.ghost(p);
            billboards.push({ mesh: p, texs: [adTex(0), adTex(1), adTex(2)], k: i });
            let g = boxG(w + 0.8, h + 0.8, 0.5); put(g, x, y, z, 0, rotY, 0);
            g.translate(Math.sin(rotY) * -0.35, 0, Math.cos(rotY) * -0.35);
            frames.push(g);
            for (const s of [-1, 1]) {
                g = boxG(0.4, 9, 0.4); put(g, x + s * (w / 2 - 1), y - h / 2 - 4.5, z - 1.2); frames.push(g);
            }
        };
        panel(-26.5, 30.4, -41.6, 14, 8.2, 0.06, 0);
        panel(-40.0, 30.4, -42.4, 12, 8.2, 0.34, 1);
        G.add(merged(frames, MATS.iron));
        scene.add(G);
        world.part('billboard_00', G);
    }

    /* ============================================================
       12 · Federation Square — the south-east quadrant

       The pinwheel-fractal cladding is the whole building: a rectangle cut into
       four triangles about a point somewhere off-centre, in zinc, sandstone and
       glass, repeated until the wall stops being a wall. It is written here as
       raw vertex colours, so every face of every block on the site is one mesh
       and one draw.
       ============================================================ */
    {
        const frac = [], cores = [], roofs = [], glassy = [], lattice = [], sandy = [], plazaG = [];
        const pos = [], col = [], nor = [];
        const pal = [[0.50, 0.53, 0.56], [0.78, 0.67, 0.51], [0.17, 0.27, 0.36],
                     [0.63, 0.60, 0.55], [0.32, 0.35, 0.38], [0.70, 0.55, 0.38]];

        const fracWall = (w, h, cols, rows, M0) => {
            const base = pos.length / 3;
            const cw = w / cols, rh = h / rows;
            for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
                const x0 = -w / 2 + c * cw, y0 = r * rh;
                const corner = [[x0, y0], [x0 + cw, y0], [x0 + cw, y0 + rh], [x0, y0 + rh]];
                const px = x0 + cw * rr(0.25, 0.75), py = y0 + rh * rr(0.25, 0.75);
                for (let i = 0; i < 4; i++) {
                    const a = corner[i], b = corner[(i + 1) % 4];
                    pos.push(px, py, 0, a[0], a[1], 0, b[0], b[1], 0);
                    const cc = pal[irr(0, pal.length - 1)], sh = rr(0.86, 1.12);
                    for (let k = 0; k < 3; k++) {
                        col.push(clamp(cc[0] * sh, 0, 1), clamp(cc[1] * sh, 0, 1), clamp(cc[2] * sh, 0, 1));
                        nor.push(0, 0, 1);
                    }
                }
            }
            // one wall's worth of loose triangles, carried into place in bulk
            for (let i = base * 3; i < pos.length; i += 3) {
                _v.set(pos[i], pos[i + 1], pos[i + 2]).applyMatrix4(M0);
                pos[i] = _v.x; pos[i + 1] = _v.y; pos[i + 2] = _v.z;
            }
            const nm = new THREE.Matrix3().setFromMatrix4(M0);
            for (let i = base * 3; i < nor.length; i += 3) {
                _v.set(nor[i], nor[i + 1], nor[i + 2]).applyMatrix3(nm).normalize();
                nor[i] = _v.x; nor[i + 1] = _v.y; nor[i + 2] = _v.z;
            }
        };
        void frac;

        const fedBlock = (cx, cz, w, d, h, rotY) => {
            const M0 = MX(cx, 0, cz, 0, rotY || 0, 0);
            let g = boxG(w, h, d); put(g, 0, h / 2, 0); carry(cores, g, M0);
            const cw = Math.max(5, Math.round(w / 4.2)), cd = Math.max(5, Math.round(d / 4.2));
            const rows = Math.max(4, Math.round(h / 3.8));
            fracWall(w, h, cw, rows, MX(0, 0, d / 2 + 0.1).premultiply(M0));
            fracWall(w, h, cw, rows, MX(0, 0, -d / 2 - 0.1, 0, Math.PI, 0).premultiply(M0));
            fracWall(d, h, cd, rows, MX(-w / 2 - 0.1, 0, 0, 0, -Math.PI / 2, 0).premultiply(M0));
            fracWall(d, h, cd, rows, MX(w / 2 + 0.1, 0, 0, 0, Math.PI / 2, 0).premultiply(M0));
            g = boxG(w + 0.4, 0.55, d + 0.4); put(g, 0, h + 0.28, 0); carry(roofs, g, M0);
            g = boxG(w * 0.30, 1.6, d * 0.24); put(g, w * 0.12, h + 1.3, -d * 0.16); carry(roofs, g, M0);
            return M0;
        };

        // the buildings, west to east
        const pot = fedBlock(33, 68, 22, 48, 20, -0.02);       // NGV Australia / the Ian Potter Centre
        void pot;
        const wing = fedBlock(32, 33, 20, 18, 14, 0.03);       // its lower northern wing
        for (let s = 0; s < 5; s++) {
            const g = prismG(20, 1.6, 3.6); put(g, 0, 14.3, -7.4 + s * 3.6); carry(roofs, g, wing);
        }
        fedBlock(72, 36, 24, 28, 21, 0.015);                   // ACMI, fronting Flinders Street
        fedBlock(100, 35, 24, 26, 25, -0.03);                  // SBS at the north-east corner
        fedBlock(107, 64, 14, 24, 16, 0.04);                   // the eastern edge of the plaza
        fedBlock(59, 119, 26, 18, 11, -0.02);                  // Transport, on the river side

        /* --- the Atrium: a glazed lattice street running from Flinders Street
               through to the plaza, roofed in shallow crystalline gables --- */
        {
            const A = MX(51.5, 0, 42);
            const AW = 11, AL = 40, AH = 24;
            let g = boxG(AW, AH, AL); put(g, 0, AH / 2, 0); carry(glassy, g, A);
            for (let i = 0; i <= 10; i++) for (const x of [-AW / 2, AW / 2]) {
                g = boxG(0.24, AH, 0.24); put(g, x, AH / 2, -AL / 2 + i * AL / 10); carry(lattice, g, A);
            }
            for (let i = 0; i <= 6; i++) {
                const y = 1 + i * (AH - 2) / 6;
                for (const z of [-AL / 2, AL / 2]) { g = boxG(AW + 0.4, 0.22, 0.22); put(g, 0, y, z); carry(lattice, g, A); }
                for (const x of [-AW / 2, AW / 2]) { g = boxG(0.22, 0.22, AL); put(g, x, y, 0); carry(lattice, g, A); }
            }
            for (let i = 0; i < 9; i++) {
                const gz = -AL / 2 + 2.3 + i * 4.6;
                g = prismG(AW + 0.6, 2.4, 4.4); put(g, 0, AH, gz); carry(glassy, g, A);
                g = boxG(0.18, 0.18, 4.6); put(g, 0, AH + 2.4, gz); carry(lattice, g, A);
                for (const s of [-1, 1]) { g = boxG(0.16, 6.4, 0.16); put(g, s * 3, AH + 1.2, gz, 0, 0, -s * 0.9); carry(lattice, g, A); }
            }
        }

        /* --- Deakin Edge: the glass amphitheatre sitting on the plaza --- */
        {
            const E = MX(103, 0, 107, 0, -0.10, 0);
            let g = boxG(26, 3.0, 22); put(g, 0, 1.5, 0); carry(cores, g, E);
            g = boxG(24, 8.5, 20); put(g, 0, 7.2, 0); carry(glassy, g, E);
            g = boxG(27, 0.5, 22); put(g, 0, 12.2, 0, -0.13); carry(lattice, g, E);
            for (let i = 0; i <= 6; i++) { g = boxG(0.22, 0.22, 22); put(g, -12 + i * 4, 12.4, 0, -0.13); carry(lattice, g, E); }
            for (let i = 0; i < 5; i++) { g = boxG(24, 0.45, 1.8); put(g, 0, 0.22 + i * 0.45, -9 + i * 1.8); carry(sandy, g, E); }
        }

        /* --- the plaza itself: Kimberley sandstone laid in radiating bands,
               falling away south towards the river --- */
        {
            let g = boxG(68, 0.7, 60); put(g, 79, 0.15, 93, 0.030); plazaG.push(g);
            for (let i = 0; i < 9; i++) { g = boxG(62, 0.28, 1.7); put(g, 78, 0.14 + i * 0.28, 51.5 + i * 1.7); sandy.push(g); }
            g = boxG(20, 0.5, 22); put(g, 30, 0.25 + KERB_H, 32); sandy.push(g);
            for (let i = 0; i < 5; i++) { g = boxG(20, 0.26, 1.5); put(g, 30, 0.13 + i * 0.26, 21.5 + i * 1.5); sandy.push(g); }
            for (let i = 0; i < 7; i++) { g = boxG(74, 0.45, 2.0); put(g, 80, -0.2 - i * 0.45, 126 + i * 2.0); sandy.push(g); }
            g = boxG(0.7, 0.95, 26); put(g, 21.4, 0.48 + KERB_H, 46); sandy.push(g);      // the low seating wall on Swanston
        }

        // market umbrellas and the timber benches under them
        const brolly = [], benches = [];
        for (let i = 0; i < 24; i++) {
            const ux = rr(50, 106), uz = rr(72, 116);
            let g = cylG(0.06, 0.07, 2.3, 6); put(g, ux, 1.4, uz); brolly.push(g);
            g = cylG(1.55, 0.25, 0.35, 10); put(g, ux, 2.65, uz); brolly.push(g);
        }
        for (let i = 0; i < 10; i++) {
            const g = boxG(2.6, 0.45, 0.7); put(g, rr(48, 106), 0.9, rr(72, 118), 0, rr(0, 3.1), 0); benches.push(g);
        }

        // the big screen, facing back into the plaza
        const screenMat = emissive(0x1b2733, 0x3f6a94, 1.15, { roughness: 0.36 });
        const screen = mesh(new THREE.PlaneGeometry(13, 7.4), screenMat, 74, 8.4, 51.6);
        {
            let g = boxG(14, 8.8, 0.6); put(g, 74, 8.4, 51.2); lattice.push(g);
            for (const x of [68, 80]) { g = boxG(0.5, 4.4, 0.5); put(g, x, 2.2, 51.2); lattice.push(g); }
        }

        const fracGeo = new THREE.BufferGeometry();
        fracGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        fracGeo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
        fracGeo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));

        const fed = new THREE.Group();
        fed.add(
            merged(cores.concat(roofs), stdMat(0x60635f, { roughness: 0.68 })),
            mesh(fracGeo, new THREE.MeshStandardMaterial({
                vertexColors: true, roughness: 0.48, metalness: 0.32, side: THREE.DoubleSide,
            })),
            merged(glassy, stdMat(0x8fb0c6, {
                roughness: 0.08, metalness: 0.34, transparent: true, opacity: 0.34, side: THREE.DoubleSide,
            })),
            merged(lattice.concat(brolly), stdMat(0x343a40, { roughness: 0.40, metalness: 0.55 })),
            merged(sandy.concat(benches), stdMat(0xbb9f7a, { roughness: 0.72 })),
            screen);
        const plaza = merged(plazaG, stdMat(0xffffff, { map: plazaTex, roughness: 0.70 }));
        fed.add(plaza);
        scene.add(fed);
        world.part('fedsquare_00', fed);
        world.ground(plaza);
        billboards.push({ mesh: screen, texs: [adTex(2), adTex(0), adTex(1)], k: 2 });
    }

    /* ============================================================
       13 · 101 Collins Street, standing in the rain a third of a kilometre
            north-east — Denton Corker Marshall, 1991: a polished grey granite
            shaft articulated by four framed glass buttresses that step back at
            half height, and a sixty-metre open lattice spire with twin needles.
            At this distance the fog has most of it, which is the point: it is
            what tells you the city keeps going.
       ============================================================ */
    {
        const gran = [], granD = [], slot = [], steel = [];
        const M0 = MX(C101.x, 0, C101.z);
        const W = C101.W, D = C101.D, H = C101.H, H2 = C101.H2;
        let g;

        const tw = officeTex(11, 44, '#a3a099', '#414c58', 0.26);
        const wallMat = stdMat(0xffffff, {
            map: tw.map, emissive: 0xffffff, emissiveMap: tw.emis, emissiveIntensity: 0.9,
            roughness: 0.28, metalness: 0.20,
        });
        const bt = officeTex(5, 44, '#6d757e', '#39454f', 0.34);
        const bayMat = stdMat(0xffffff, {
            map: bt.map, emissive: 0xffffff, emissiveMap: bt.emis, emissiveIntensity: 1.0,
            roughness: 0.12, metalness: 0.55,
        });
        const shaft = [], bays = [];

        g = boxG(W, H2, D); put(g, 0, H2 / 2, 0); carry(shaft, g, M0);
        const PW = 10.0, PP = 1.1;
        for (const c of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
            g = boxG(PW + PP, H2 - 0.6, PW + PP);
            put(g, c[0] * (W / 2 - PW / 2 + PP / 2), (H2 - 0.6) / 2, c[1] * (D / 2 - PW / 2 + PP / 2));
            carry(gran, g, M0);
        }
        const SW2 = 2.0, SD = 1.4, y0 = 26, y1 = H2 - 7, sh = y1 - y0, sy = (y0 + y1) / 2;
        for (const s of [-1, 1]) for (const t of [-1, 1]) {
            g = boxG(SW2, sh, SD * 2); put(g, t * (W / 2 - PW - SW2 / 2 - 0.6), sy, s * (D / 2 - SD / 2)); carry(slot, g, M0);
            g = boxG(SD * 2, sh, SW2); put(g, s * (W / 2 - SD / 2), sy, t * (D / 2 - PW - SW2 / 2 - 0.6)); carry(slot, g, M0);
        }

        /* Each face carries one buttress in two stages. Below the mid-height
           break it comes right out of the building, wider and much deeper, and
           its flat top reads as a horizontal cap; above it steps back nearly
           flush, so the silhouette narrows at half height. */
        const buttress = (w, F, rot) => {
            const Bm = MX(0, 0, 0, 0, rot, 0).premultiply(M0);
            const FR = 2.0, MID = 104, PLO = 4.8, PHI = 1.2, XW = 2.2;
            const wl = w + XW * 2, zl = F + PLO / 2, zu = F + PHI / 2;
            let q;
            q = boxG(wl + FR * 2, MID, PLO); put(q, 0, MID / 2, zl); carry(gran, q, Bm);
            q = boxG(wl, MID - 1.0, PLO + 0.3); put(q, 0, MID / 2, zl + 0.35); carry(bays, q, Bm);
            q = boxG(wl + FR * 2 + 1.1, 1.5, PLO + 1.1); put(q, 0, MID + 0.75, zl + 0.05); carry(gran, q, Bm);
            q = boxG(wl + FR * 2 + 1.7, 0.55, PLO + 1.7); put(q, 0, MID + 1.65, zl + 0.10); carry(granD, q, Bm);
            const yu = MID + 2.1, hu = H - yu;
            q = boxG(w + FR * 2, hu, PHI); put(q, 0, yu + hu / 2, zu); carry(gran, q, Bm);
            q = boxG(w, hu - 1.0, PHI + 0.3); put(q, 0, yu + hu / 2, zu + 0.35); carry(bays, q, Bm);
            q = boxG(w + FR * 2 + 0.6, 1.1, PHI + 0.7); put(q, 0, H, zu + 0.10); carry(gran, q, Bm);
            // the centre blade, stopping at 61.8 % of the tower's full height
            const BT = C101.TIP * 0.618, BB = 25.4, BLW = 2.3, BLD = 1.8;
            const bl = F + PLO + 0.5 + BLD / 2, bu = F + PHI + 0.5 + BLD / 2;
            q = boxG(BLW, MID - BB, BLD); put(q, 0, (MID + BB) / 2, bl); carry(gran, q, Bm);
            q = boxG(BLW + 0.7, 0.85, BLD + 0.45); put(q, 0, BB - 0.42, bl); carry(granD, q, Bm);
            q = boxG(BLW, BT - yu, BLD); put(q, 0, (BT + yu) / 2, bu); carry(gran, q, Bm);
            q = boxG(BLW + 0.7, 0.85, BLD + 0.45); put(q, 0, BT + 0.42, bu); carry(granD, q, Bm);
        };
        buttress(13, D / 2, 0); buttress(13, D / 2, Math.PI);
        buttress(8, W / 2, Math.PI / 2); buttress(8, W / 2, -Math.PI / 2);

        g = boxG(W + 3.0, 2.6, D + 3.0); put(g, 0, H2 + 1.15, 0); carry(gran, g, M0);
        g = boxG(W + 3.6, 0.9, D + 3.6); put(g, 0, H2 + 2.9, 0); carry(granD, g, M0);
        g = boxG(W - 9, 4.6, D - 9); put(g, 0, H2 + 5.6, 0); carry(granD, g, M0);
        g = boxG(10, 2.4, 8); put(g, -11, H2 + 6.0, 4); carry(steel, g, M0);
        g = boxG(8, 1.8, 6.5); put(g, 12, H2 + 5.6, -5); carry(steel, g, M0);

        // the sixty-metre spire: an open square lattice and the twin needles
        const LY = H2 + 8, LH = 26, R = 3.5, BAYS = 6, bh = LH / BAYS;
        for (const c of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
            g = boxG(0.48, LH, 0.48); put(g, c[0] * R, LY + LH / 2, c[1] * R); carry(steel, g, M0);
        }
        for (let i = 0; i <= BAYS; i++) {
            const yy = LY + i * bh;
            for (const s of [-1, 1]) {
                g = boxG(R * 2 + 0.34, 0.22, 0.22); put(g, 0, yy, s * R); carry(steel, g, M0);
                g = boxG(0.22, 0.22, R * 2 + 0.34); put(g, s * R, yy, 0); carry(steel, g, M0);
            }
            if (i < BAYS) {
                const dl = Math.hypot(R * 2, bh), an = Math.atan2(R * 2, bh);
                for (const s of [-1, 1]) {
                    g = boxG(0.20, dl, 0.20); put(g, 0, yy + bh / 2, s * R, 0, 0, -s * an); carry(steel, g, M0);
                    g = boxG(0.20, dl, 0.20); put(g, s * R, yy + bh / 2, 0, s * an, 0, 0); carry(steel, g, M0);
                }
            }
        }
        g = boxG(R * 2 + 1.2, 0.5, R * 2 + 1.2); put(g, 0, LY + LH, 0); carry(steel, g, M0);
        const MB = H2 + 7.0, MH = C101.TIP - MB;
        for (const mx of [-2.3, 2.3]) { g = cylG(0.26, 0.72, MH, 6); put(g, mx, MB + MH / 2, 0); carry(steel, g, M0); }
        for (const f of [0.62, 0.84]) { g = boxG(5.6, 0.34, 0.9); put(g, 0, MB + MH * f, 0); carry(steel, g, M0); }

        // the podium, holding the Collins Street wall in front of the tower
        const pt = officeTex(20, 7, '#8a8983', '#3c4650', 0.22);
        g = boxG(86, 24, 72); put(g, -10, 12, -4); g.applyMatrix4(M0);
        const podium = mesh(g, stdMat(0xffffff, {
            map: pt.map, emissive: 0xffffff, emissiveMap: pt.emis, emissiveIntensity: 0.85,
            roughness: 0.34, metalness: 0.14,
        }));
        g = boxG(88, 1.6, 74); put(g, -10, 24.8, -4); carry(gran, g, M0);

        const tower = new THREE.Group();
        tower.add(
            merged(shaft, wallMat), merged(bays, bayMat),
            merged(gran.concat(granD), MATS.granite),
            merged(slot, stdMat(0x232a33, { roughness: 0.14, metalness: 0.55 })),
            merged(steel, stdMat(0x4d5255, { roughness: 0.40, metalness: 0.55 })),
            podium);
        scene.add(tower);
        world.part('tower_00', tower);
    }

    /* ============================================================
       14 · the Yarra, and Princes Bridge

       Swanston Street runs on across the river and becomes St Kilda Road. The
       bridge is the 1888 one: three shallow segmental spans in red ironwork on
       bluestone piers, cream spandrels and an arcaded parapet, with ornamental
       lamp standards over every pier.
       ============================================================ */
    {
        const water = new THREE.ShaderMaterial({
            uniforms: pick('uTime', 'uCamPos', 'uWind', 'uFogCol', 'uFogNear', 'uFogFar', 'uSkyLo', 'uSkyHi',
                           'uLPos', 'uLCol', 'uLStr', 'uLRad'),
            vertexShader: WORLD_VS,
            fragmentShader: NOISE_GLSL + RIPPLE_GLSL + WET_GLSL + FOG_GLSL + /* glsl */`
              uniform float uTime; uniform vec3 uCamPos; uniform vec2 uWind;
              varying vec3 vWorld;
              void main(){
                float dist = length(uCamPos - vWorld);
                // The Yarra is not blue and never has been: it is the colour of
                // the silt it carries, and in the rain it is darker still.
                vec2 p = vWorld.xz;
                float w1 = fbm(p * 0.36 + vec2(uTime * 0.10, uTime * 0.045) * 6.0 * uWind.x);
                float w2 = fbm(p * 1.15 - vec2(uTime * 0.16, 0.0));
                float chop = (w1 - 0.5) * 0.7 + (w2 - 0.5) * 0.35;
                vec3 body = mix(vec3(0.0135, 0.0175, 0.0130), vec3(0.030, 0.036, 0.026), w1);

                float rip = ripple(p * 0.55, uTime) * (1.0 - smoothstep(20.0, 90.0, dist));
                vec3 diff, spec;
                wetLight(vWorld, uCamPos, rip + chop * 0.8, 1.0, diff, spec);

                vec3 col = body * (uSkyLo * 0.5 + diff * 0.5);
                col += skyMirror(vWorld, uCamPos, rip * 0.7 + chop) * (0.34 + 0.16 * w2);
                col += spec * 1.15;
                col += vec3(0.55, 0.60, 0.66) * max(rip, 0.0) * 0.05;
                gl_FragColor = vec4(applyFog(col, dist), 1.0);
              }`,
        });
        const wg = new THREE.PlaneGeometry(420, RIV_S - RIV_N, 6, 6);
        wg.rotateX(-Math.PI / 2);
        const river = mesh(wg, water, 0, WATER, (RIV_N + RIV_S) / 2);
        scene.add(river);

        const blue = [], prom = [], rails = [], boats = [], bank = [];
        let g = boxG(420, 4, RIV_S - RIV_N); put(g, 0, WATER - 2.2, (RIV_N + RIV_S) / 2); bank.push(g);
        for (const b of [[RIV_N, 1], [RIV_S, -1]]) {
            const zw = b[0], s = b[1];
            g = boxG(420, 8.6, 2.4); put(g, 0, WATER + 4.3, zw - s * 1.18); blue.push(g);
            g = boxG(420, 0.5, 3.0); put(g, 0, 0.05, zw - s * 1.4); prom.push(g);
            g = boxG(420, 0.7, 8.0); put(g, 0, WATER + 1.7, zw + s * 4.0); prom.push(g);
            g = boxG(420, 0.9, 0.5); put(g, 0, WATER + 2.5, zw + s * 8.0); blue.push(g);
            for (let r = 0; r < 34; r++) { g = cylG(0.05, 0.06, 1.1, 6); put(g, -130 + r * 7.0, 0.55, zw - s * 0.2); rails.push(g); }
            g = boxG(460, 0.09, 0.09); put(g, 0, 1.08, zw - s * 0.2); rails.push(g);
            g = boxG(460, 0.07, 0.07); put(g, 0, 0.62, zw - s * 0.2); rails.push(g);
        }
        for (const bp of [[-52, RIV_N + 12], [64, RIV_S - 13]]) {     // two moored river boats
            const M0 = MX(bp[0], WATER, bp[1]);
            g = boxG(22, 1.4, 4.6); put(g, 0, 0.5, 0); carry(boats, g, M0);
            g = boxG(15, 1.8, 4.0); put(g, -1, 2.0, 0); carry(boats, g, M0);
            g = boxG(14, 0.9, 4.2); put(g, -1, 2.2, 0); carry(blue, g, M0);
            g = boxG(2.4, 1.2, 2.4); put(g, 6, 3.4, 0); carry(boats, g, M0);
        }
        // Southbank: Hamer Hall's drum and the low arts-centre podium
        g = cylG(21, 22, 12, 22); put(g, -6, 6, RIV_S + 46); bank.push(g);
        g = cylG(22.5, 21.5, 1.6, 22); put(g, -6, 12.6, RIV_S + 46); prom.push(g);
        g = boxG(110, 8, 26); put(g, 40, 4, RIV_S + 20); bank.push(g);
        g = boxG(70, 14, 30); put(g, -110, 7, RIV_S + 34); bank.push(g);

        const yarra = new THREE.Group();
        yarra.add(
            merged(blue, stdMat(0x555a55, { roughness: 0.62 })),
            merged(prom.concat(boats, rails), stdMat(0x8e8b84, { roughness: 0.50, metalness: 0.14 })),
            merged(bank, stdMat(0x9a938a, { roughness: 0.68 })));
        scene.add(yarra);

        /* ---- the bridge ---- */
        const ironR = [], cream = [], stone = [], deck = [], lampI = [], lampG = [], parapets = [];
        const DK = BR_Y, UND = DK - 1.5;
        const piers = [RIV_N, RIV_N + 31.3, RIV_N + 62.6, RIV_S];
        const segArc = (zc, span, y0, rise) => {
            const R = (span * span / 4 + rise * rise) / (2 * rise);
            return { R, cy: y0 + rise - R, half: Math.asin(clamp(span / 2 / R, 0, 1)), zc };
        };
        for (let sp = 0; sp < 3; sp++) {
            const z0 = piers[sp], z1 = piers[sp + 1];
            const zc = (z0 + z1) / 2, span = z1 - z0 - 4.6;
            const A = segArc(zc, span, -4.4, 3.6);
            const N = 11;
            for (let i = 0; i < N; i++) {
                const a0 = -A.half + 2 * A.half * i / N, a1 = -A.half + 2 * A.half * (i + 1) / N;
                const pz0 = zc + Math.sin(a0) * A.R, py0 = A.cy + Math.cos(a0) * A.R;
                const pz1 = zc + Math.sin(a1) * A.R, py1 = A.cy + Math.cos(a1) * A.R;
                const len = Math.hypot(pz1 - pz0, py1 - py0) * 1.05;
                const tilt = -Math.atan2(py1 - py0, pz1 - pz0);
                let q = boxG(BR_W - 1.0, 0.85, len); put(q, 0, (py0 + py1) / 2, (pz0 + pz1) / 2, tilt); ironR.push(q);
                for (let rb = -3; rb <= 3; rb++) {                  // the fan of ribs on the soffit
                    q = boxG(0.62, 0.30, len); put(q, rb * 4.2, (py0 + py1) / 2 - 0.5, (pz0 + pz1) / 2, tilt); ironR.push(q);
                }
                const yTop = (py0 + py1) / 2 + 0.45, h = UND - yTop;
                if (h > 0.15) { q = boxG(BR_W, h, Math.abs(pz1 - pz0) + 0.15); put(q, 0, yTop + h / 2, (pz0 + pz1) / 2); cream.push(q); }
                for (const sx of [-1, 1]) {                          // the red archivolt on both faces
                    q = boxG(0.55, 1.15, len); put(q, sx * (BR_W / 2 + 0.2), (py0 + py1) / 2 + 0.15, (pz0 + pz1) / 2, tilt); ironR.push(q);
                }
            }
        }
        piers.forEach((pz, k) => {
            const isEnd = (k === 0 || k === piers.length - 1);
            const pd = isEnd ? 6.5 : 5.0;
            let q = boxG(BR_W + 1.4, 14.0, pd); put(q, 0, WATER + 2.6, pz); stone.push(q);
            q = boxG(BR_W + 2.6, 1.1, pd + 1.4); put(q, 0, -4.4, pz); stone.push(q);
            q = boxG(BR_W + 2.2, 0.9, pd + 1.0); put(q, 0, WATER + 0.6, pz); stone.push(q);
            if (!isEnd) for (const sz of [-1, 1]) {                  // cutwaters
                q = prismG(pd + 1.0, 3.2, 13.0);
                put(q, sz * (BR_W / 2 + 3.0), WATER + 2.6, pz, 0, Math.PI / 2, Math.PI / 2); stone.push(q);
            }
            if (k === 0) return;
            for (const sx of [-1, 1]) {
                const px = sx * (BR_W / 2 - 0.6);
                q = boxG(2.6, 2.5, 3.4); put(q, px, DK + 1.25, pz); stone.push(q);
                q = boxG(3.0, 0.35, 3.8); put(q, px, DK + 2.6, pz); cream.push(q);
                const L = MX(px, DK + 2.75, pz);
                q = boxG(1.5, 0.5, 1.5); put(q, 0, 0.25, 0); carry(lampI, q, L);
                q = cylG(0.30, 0.42, 3.4, 10); put(q, 0, 2.2, 0); carry(lampI, q, L);
                q = cylG(0.44, 0.36, 0.5, 10); put(q, 0, 4.1, 0); carry(lampI, q, L);
                q = boxG(0.85, 1.25, 0.85); put(q, 0, 5.0, 0); carry(lampG, q, L);
                q = cylG(0.30, 0.52, 0.55, 8); put(q, 0, 5.8, 0); carry(lampI, q, L);
                q = cylG(0.05, 0.05, 0.6, 6); put(q, 0, 6.3, 0); carry(lampI, q, L);
            }
        });
        const BL = RIV_S - RIV_N + 22, BC = (RIV_N + RIV_S) / 2;
        let q = boxG(BR_W, 1.5, BL); put(q, 0, DK - 0.75, BC); deck.push(q);
        // the raised footways go in with the carriageway: both are wet grey today
        for (const sx of [-1, 1]) { const f = boxG(5.5, 0.28, BL); put(f, sx * 12.0, DK + 0.15, BC); deck.push(f); }
        q = boxG(BR_W - 11, 0.10, BL); put(q, 0, DK + 0.06, BC); deck.push(q);
        q = boxG(BR_W, 0.3, 40); put(q, 0, 0.12, 120); deck.push(q);
        q = boxG(BR_W, 0.3, 60); put(q, 0, 0.12, RIV_S + 30); deck.push(q);
        for (const sx of [-1, 1]) {
            q = uvScale(boxG(0.55, 1.35, BL), 1, 1); parapets.push(put(q, sx * (BR_W / 2 - 0.3), DK + 0.95, BC));
            q = boxG(0.95, 0.28, BL); put(q, sx * (BR_W / 2 - 0.3), DK + 1.72, BC); cream.push(q);
            q = boxG(0.22, 0.16, BL); put(q, sx * (BR_W / 2 - 0.3), DK + 1.9, BC); ironR.push(q);
            q = boxG(0.9, 1.65, BL); put(q, sx * (BR_W / 2 + 0.05), DK - 0.55, BC); cream.push(q);
            q = boxG(1.15, 0.30, BL); put(q, sx * (BR_W / 2 + 0.1), DK + 0.20, BC); cream.push(q);
            for (const pz of piers) {                                // red roundels over every pier
                q = new THREE.CircleGeometry(1.15, 18);
                put(q, sx * (BR_W / 2 + 1.5), DK - 2.5, pz, 0, sx > 0 ? Math.PI / 2 : -Math.PI / 2, 0); ironR.push(q);
                q = new THREE.TorusGeometry(1.32, 0.16, 6, 16);
                put(q, sx * (BR_W / 2 + 1.5), DK - 2.5, pz, 0, sx > 0 ? Math.PI / 2 : -Math.PI / 2, 0); cream.push(q);
            }
        }
        // rails and the trolley wire carried across
        for (const o of [-TRS, TRS]) {
            for (const r of [-RAIL, RAIL]) { q = boxG(0.075, 0.05, BL + 60); put(q, o + r, DK + 0.14, RIV_N + 40); deck.push(q); }
            q = boxG(0.035, 0.035, BL + 60); put(q, o, DK + WIRE_H, RIV_N + 40); ironR.push(q);
        }

        const bridge = new THREE.Group();
        const deckMesh = merged(deck, stdMat(0x3c3e42, { roughness: 0.30, metalness: 0.22 }));
        bridge.add(
            merged(ironR, stdMat(0xa8442c, { roughness: 0.46, metalness: 0.28 })),
            merged(cream, stdMat(0xe6e2d6, { roughness: 0.62 })),
            merged(stone.concat(lampI), stdMat(0x5a5f59, { roughness: 0.66 })),
            deckMesh,
            merged(parapets, stdMat(0xffffff, { map: parapetTex, roughness: 0.60 })));
        const lamps = merged(lampG, emissive(0xf3ecd6, 0xffe0a8, 2.6));
        bridge.add(lamps); world.ghost(lamps);
        scene.add(bridge);
        world.part('bridge_00', bridge);
        world.ground(deckMesh);
    }

    /* ============================================================
       15 · what stands on the footpath

       Plane trees, tram poles and their overhead, the signals, and the bollards
       and bins that make a Melbourne kerb look like one. Everything that
       repeats eight times or more is one InstancedMesh; everything else is
       merged. The signals are the exception — they are the only things here
       that change during the cycle, so each one is a part in its own right.
       ============================================================ */

    // ---- plane trees. Pruned into knuckled limbs every winter, which is why a
    // Melbourne plane tree is a fat trunk, three elbows and a cloud.
    {
        const spots = [];
        for (let i = 0; i < 9; i++) spots.push([-14.9, -48 - i * 10]);
        for (let i = 0; i < 10; i++) spots.push([14.9, -30 - i * 10]);
        for (let i = 0; i < 9; i++) spots.push([14.9, 30 + i * 10]);
        for (const xx of [28, 58, 68, 78, 88, 98, 108]) spots.push([xx, -16.6]);
        for (let i = 0; i < 7; i++) spots.push([-34 - i * 10, -16.6]);
        for (let i = 0; i < 6; i++) spots.push([48 + i * 11, 18.4]);
        for (let i = 0; i < 8; i++) spots.push([64 + rr(0, 44), -32 - rr(0, 56)]);   // the cathedral's grounds
        for (let i = 0; i < 5; i++) spots.push([78 + i * 9, 122 + rr(-3, 3)]);       // Fed Square's terrace
        for (let i = 0; i < 12; i++) spots.push([-190 + i * 34, RIV_S + 6]);         // Southbank promenade

        // The trunk and its three limbs, built once and stood up sixty times.
        const trunk = [];
        let g = cylG(0.26, 0.42, 4.4, 8); put(g, 0, 2.2, 0); trunk.push(g);
        for (let i = 0; i < 3; i++) {
            const a = i / 3 * Math.PI * 2 + 0.4;
            g = cylG(0.10, 0.20, 3.5, 6);
            put(g, Math.cos(a) * 0.9, 5.2, Math.sin(a) * 0.9, Math.sin(a) * 0.55, 0, -Math.cos(a) * 0.55);
            trunk.push(g);
        }
        const trunkIM = new THREE.InstancedMesh(merge(trunk), stdMat(C.trunk, { roughness: 0.80 }), spots.length);
        const leafIM = new THREE.InstancedMesh(sphG(1, 9, 6), stdMat(C.leaf, { roughness: 0.78 }), spots.length * 4);
        const pitIM = new THREE.InstancedMesh(boxG(1.8, 0.06, 1.8), stdMat(0x4a4238, { roughness: 0.86 }), spots.length);
        const tint = new THREE.Color();
        let k = 0;
        spots.forEach((p, i) => {
            const h = rr(10.5, 14), s = h / 11.6;
            const x = p[0] + rr(-0.5, 0.5), z = p[1] + rr(-0.5, 0.5);
            trunkIM.setMatrixAt(i, MX(x, KERB_H, z, 0, rr(0, 6.28), 0, s, s, s));
            pitIM.setMatrixAt(i, MX(p[0], KERB_H + 0.03, p[1]));
            for (let b = 0; b < 4; b++) {
                const r = rr(2.6, 4.3) * s;
                leafIM.setMatrixAt(k, MX(x + rr(-2.6, 2.6), KERB_H + h * 0.42 + rr(1.0, h * 0.34), z + rr(-2.6, 2.6),
                                         0, rr(0, 3), 0, r, r * 0.78, r));
                const v = rr(0.72, 1.22);
                tint.setRGB(v * 0.94, v, v * 0.78);
                leafIM.setColorAt(k, tint);
                k++;
            }
        });
        trunkIM.instanceMatrix.needsUpdate = true;
        leafIM.instanceMatrix.needsUpdate = true;
        pitIM.instanceMatrix.needsUpdate = true;
        if (leafIM.instanceColor) leafIM.instanceColor.needsUpdate = true;
        scene.add(trunkIM, leafIM, pitIM);
        world.ghost(leafIM);       // a canopy is not something to walk into
        world.ghost(pitIM);
    }

    // ---- tram poles, their mast-arm lamps and the overhead
    {
        const poles = [];
        for (let i = 0; i < 6; i++) {
            const z = -20 - i * 26;
            poles.push([-(SW + 1.4), z, Math.PI / 2], [SW + 1.4, z, -Math.PI / 2],
                       [-(SW + 1.4), -z, Math.PI / 2], [SW + 1.4, -z, -Math.PI / 2]);
        }
        for (let i = 0; i < 5; i++) {
            const x = 22 + i * 26;
            poles.push([x, -(FL + 1.4), Math.PI], [x, FL + 1.4, 0],
                       [-x, -(FL + 1.4), Math.PI], [-x, FL + 1.4, 0]);
        }
        for (let i = 0; i < 9; i++) {                       // Swanston carried north
            const z = -130 - i * 26;
            if (z < NZ_END) break;
            poles.push([-(SW + 1.2), z, Math.PI / 2], [SW + 1.2, z, -Math.PI / 2]);
        }

        const body = [];
        let g = cylG(0.20, 0.26, 9.4, 10); put(g, 0, 4.7, 0); body.push(g);
        g = cylG(0.34, 0.40, 0.9, 10); put(g, 0, 0.45, 0); body.push(g);
        g = boxG(0.13, 0.13, 2.7); put(g, 0, 8.95, 1.35); body.push(g);      // the outreach arm
        g = boxG(0.55, 0.22, 1.3); put(g, 0, 9.06, 2.55); body.push(g);      // the luminaire's housing
        const poleIM = new THREE.InstancedMesh(merge(body), stdMat(0x39423f, { roughness: 0.42, metalness: 0.34 }), poles.length);
        // The lamps are emissive, not lights: forty-four cobra heads would be
        // forty-four full-screen passes, and bloom does the same job for free.
        const lampMat = emissive(0xf6efdc, 0xffdca8, 2.6, { roughness: 0.34 });
        const lensIM = new THREE.InstancedMesh(boxG(0.44, 0.06, 1.1), lampMat, poles.length);
        poles.forEach((p, i) => {
            poleIM.setMatrixAt(i, MX(p[0], KERB_H, p[1], 0, p[2], 0));
            _e.set(0, p[2], 0);
            _v.set(0, 0, 2.55).applyEuler(_e);
            lensIM.setMatrixAt(i, MX(p[0] + _v.x, KERB_H + 8.94, p[1] + _v.z, 0, p[2], 0));
        });
        poleIM.instanceMatrix.needsUpdate = true;
        lensIM.instanceMatrix.needsUpdate = true;
        scene.add(poleIM, lensIM);
        world.ghost(lensIM);

        // contact wires, as thin boxes so they catch what light there is, and
        // the span wires as lines, which cost nothing and collide with nothing
        const wires = [];
        const wireMat = stdMat(0x22262a, { roughness: 0.30, metalness: 0.62 });
        for (const o of [-TRS, TRS]) { g = boxG(0.035, 0.035, 660); put(g, o, WIRE_H, -80); wires.push(g); }
        for (const o of [-TRF, TRF]) { g = boxG(2 * NX, 0.035, 0.035); put(g, 0, WIRE_H, o); wires.push(g); }
        for (const o of [-230 - TRF, -230 + TRF]) { g = boxG(2 * NX, 0.035, 0.035); put(g, 0, WIRE_H, o); wires.push(g); }
        for (const p of [[-TRS, -TRF], [-TRS, TRF], [TRS, -TRF], [TRS, TRF]]) {
            g = boxG(Math.hypot(p[0] * 2, p[1] * 2) + 26, 0.03, 0.03);
            put(g, 0, WIRE_H, 0, 0, Math.atan2(p[1] * 1.6, p[0] * 1.6), 0);
            wires.push(g);
        }
        const wireMesh = merged(wires, wireMat);
        scene.add(wireMesh); world.ghost(wireMesh);

        const seg = [];
        const line = (a, b) => seg.push(a[0], a[1], a[2], b[0], b[1], b[2]);
        const HH = 8.3 + KERB_H;
        for (const p of poles) {
            if (Math.abs(p[0]) > SW + 3) {                  // a Flinders Street pole
                line([p[0], HH, p[1]], [p[0], HH, -p[1]]);
            } else {
                line([-(SW + 1.4), HH, p[1]], [SW + 1.4, HH, p[1]]);
                for (const o of [-TRS, TRS]) line([o, HH - Math.abs(o) * 0.012, p[1]], [o, WIRE_H, p[1]]);
            }
        }
        const corners = [[-(SW + 1.4), -(FL + 1.4)], [SW + 1.4, -(FL + 1.4)],
                         [SW + 1.4, FL + 1.4], [-(SW + 1.4), FL + 1.4]];
        line([corners[0][0], HH, corners[0][1]], [corners[2][0], HH, corners[2][1]]);
        line([corners[1][0], HH, corners[1][1]], [corners[3][0], HH, corners[3][1]]);
        for (let i = 0; i < 4; i++) {
            const a = corners[i], b = corners[(i + 1) % 4];
            line([a[0], HH, a[1]], [b[0], HH, b[1]]);
        }
        for (const o of [-TRS, TRS]) {
            line([o, HH - 0.4, -(FL + 1.4)], [o, WIRE_H, -(FL + 1.4)]);
            line([o, HH - 0.4, FL + 1.4], [o, WIRE_H, FL + 1.4]);
            line([o, HH - 0.6, 0], [o, WIRE_H, 0]);
        }
        const lg = new THREE.BufferGeometry();
        lg.setAttribute('position', new THREE.Float32BufferAttribute(seg, 3));
        scene.add(new THREE.LineSegments(lg, new THREE.LineBasicMaterial({
            color: srgb(0x1c1f22), transparent: true, opacity: 0.8,
        })));
    }

    /* ---- the signals.

       A three-aspect head drawn as a texture rather than as three lit discs:
       one aspect is lit at a time, so four small canvases and a swapped map say
       exactly what three emissive meshes per signal would have said, for a
       quarter of the meshes and none of the per-frame material churn. ---- */
    const aspectTex = {};
    for (const st of ['r', 'y', 'g', 'o']) {
        aspectTex[st] = tex(96, 288, (g, W, H) => {
            g.fillStyle = '#241f18'; g.fillRect(0, 0, W, H);
            const cols = { r: '#ff2b16', y: '#ffb219', g: '#2bff62' };
            const on = { r: st === 'r', y: st === 'y', g: st === 'g' };
            ['r', 'y', 'g'].forEach((k, i) => {
                g.fillStyle = on[k] ? cols[k] : '#181410';
                g.beginPath(); g.arc(W / 2, H * (i + 0.5) / 3, W * 0.30, 0, 6.3); g.fill();
                if (on[k]) {
                    g.fillStyle = 'rgba(255,255,255,.55)';
                    g.beginPath(); g.arc(W / 2, H * (i + 0.5) / 3, W * 0.13, 0, 6.3); g.fill();
                }
                g.fillStyle = '#100d0a';                       // the cowl over each aspect
                g.fillRect(W * 0.10, H * (i + 0.5) / 3 - W * 0.40, W * 0.80, W * 0.09);
            });
        });
    }
    const pedTex = {};
    for (const st of ['r', 'g', 'o']) {
        pedTex[st] = tex(96, 192, (g, W, H) => {
            g.fillStyle = '#241f18'; g.fillRect(0, 0, W, H);
            [['r', 0.28], ['g', 0.72]].forEach((q) => {
                const on = st === q[0];
                g.fillStyle = on ? (q[0] === 'r' ? '#ff3020' : '#35ff62') : '#181410';
                // a standing figure over a walking one, as flatly as the real ones
                g.fillRect(W * 0.42, H * q[1] - H * 0.16, W * 0.16, H * 0.10);
                g.beginPath(); g.arc(W * 0.5, H * q[1] - H * 0.20, W * 0.09, 0, 6.3); g.fill();
                g.fillRect(W * (q[0] === 'r' ? 0.44 : 0.36), H * q[1] - H * 0.06, W * 0.12, H * 0.12);
                if (q[0] === 'g') g.fillRect(W * 0.52, H * q[1] - H * 0.06, W * 0.12, H * 0.12);
            });
        });
    }

    const SIGNALS = [];
    {
        const approaches = [
            { x: -(SW + 1.0), z: -(FL + 2.2), face: Math.PI, dir: 'NS', reach: SW * 1.15 },
            { x: (SW + 1.0), z: (FL + 2.2), face: 0, dir: 'NS', reach: SW * 1.15 },
            { x: (SW + 2.2), z: -(FL + 1.0), face: Math.PI / 2, dir: 'EW', reach: FL * 1.15 },
            { x: -(SW + 2.2), z: (FL + 1.0), face: -Math.PI / 2, dir: 'EW', reach: FL * 1.15 },
        ];
        approaches.forEach((a, i) => {
            const G = new THREE.Group();
            const body = [], lens = [];
            let g = cylG(0.13, 0.16, 5.4, 10); put(g, 0, 2.7, 0); body.push(g);
            g = cylG(0.24, 0.28, 0.5, 10); put(g, 0, 0.25, 0); body.push(g);
            g = boxG(0.46, 1.35, 0.30); put(g, 0, 3.6, 0.28); body.push(g);
            g = new THREE.PlaneGeometry(0.40, 1.20); put(g, 0, 3.6, 0.44); lens.push(g);
            // the mast arm out over the roadway, and its second head
            g = boxG(a.reach, 0.14, 0.14); put(g, -a.reach / 2, 6.1, 0); body.push(g);
            g = boxG(0.46, 1.35, 0.30); put(g, -a.reach + 1.0, 5.2, 0.10); body.push(g);
            g = new THREE.PlaneGeometry(0.40, 1.20); put(g, -a.reach + 1.0, 5.2, 0.26); lens.push(g);
            const lensMat = emissive(0x241f18, 0xffffff, 2.4, { map: aspectTex.r, emissiveMap: aspectTex.r, roughness: 0.34 });
            G.add(merged(body, MATS.iron));
            const lm = mesh(merge(lens), lensMat);
            G.add(lm); world.ghost(lm);
            G.position.set(a.x, KERB_H, a.z);
            G.rotation.y = a.face;
            scene.add(G);
            world.part('signal_0' + i, G);
            SIGNALS.push({ dir: a.dir, mat: lensMat, state: '' });
        });
    }

    // pedestrian lanterns on all four corners, facing both ways across
    const PEDMAT = emissive(0x241f18, 0xffffff, 2.2, { map: pedTex.r, emissiveMap: pedTex.r, roughness: 0.34 });
    {
        const body = [], lens = [];
        for (const s of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
            const M0 = MX(s[0] * (SW + 0.9), KERB_H, s[1] * (FL + 0.9));
            let g = cylG(0.09, 0.11, 3.0, 8); put(g, 0, 1.5, 0); carry(body, g, M0);
            g = boxG(0.16, 0.3, 0.2); put(g, 0, 1.15, 0.16); carry(body, g, M0);
            for (const q of [[0.24 * -s[0], 0, s[1] > 0 ? 0 : Math.PI], [0, 0.24 * -s[1], s[0] > 0 ? Math.PI / 2 : -Math.PI / 2]]) {
                g = boxG(0.42, 0.86, 0.26); put(g, q[0], 2.35, q[1], 0, q[2], 0); carry(body, g, M0);
                g = new THREE.PlaneGeometry(0.34, 0.74);
                put(g, q[0] + Math.sin(q[2]) * 0.15, 2.35, q[1] + Math.cos(q[2]) * 0.15, 0, q[2], 0);
                carry(lens, g, M0);
            }
        }
        scene.add(merged(body, MATS.iron));
        const pl = merged(lens, PEDMAT);
        scene.add(pl); world.ghost(pl);
    }

    /* ---- bollards, crowd barriers, bike hoops, fencing and bins ---- */
    {
        const bollards = [];
        for (let i = 0; i < 26; i++) bollards.push([-20 - i * 2.6, FL + 1.5]);
        for (let i = 0; i < 10; i++) bollards.push([-(SW + 1.5), 21 + i * 2.6]);
        for (let i = 0; i < 12; i++) bollards.push([SW + 1.5, -21 - i * 2.6]);
        const bm = stdMat(0x2f3439, { roughness: 0.42, metalness: 0.40 });
        const bIM = new THREE.InstancedMesh(cylG(0.11, 0.13, 0.95, 8), bm, bollards.length);
        bollards.forEach((p, i) => bIM.setMatrixAt(i, MX(p[0], KERB_H + 0.47, p[1])));
        bIM.instanceMatrix.needsUpdate = true;
        scene.add(bIM);

        // the crowd barriers outside the station, which are there every peak
        const barrier = [];
        let g = boxG(0.06, 1.05, 2.2); put(g, 0, 0.55, 0); barrier.push(g);
        g = cylG(0.05, 0.06, 1.1, 6); put(g, 0, 0.55, -1.0); barrier.push(g);
        const barIM = new THREE.InstancedMesh(merge(barrier), stdMat(0x9a9ea1, { roughness: 0.38, metalness: 0.44 }), 26);
        for (let i = 0; i < 26; i++) barIM.setMatrixAt(i, MX(-21 - i * 2.4, KERB_H, FL + 2.6));
        barIM.instanceMatrix.needsUpdate = true;
        scene.add(barIM);

        // bike hoops on the Flinders Street footpath
        const hoop = [];
        g = new THREE.TorusGeometry(0.36, 0.035, 5, 12, Math.PI); put(g, 0, 0.38, 0); hoop.push(g);
        for (const s of [-0.36, 0.36]) { g = boxG(0.06, 0.4, 0.06); put(g, s, 0.2, 0); hoop.push(g); }
        const hoopIM = new THREE.InstancedMesh(merge(hoop), stdMat(0x585f64, { roughness: 0.38, metalness: 0.46 }), 14);
        for (let i = 0; i < 14; i++) hoopIM.setMatrixAt(i, MX(-74 - i * 1.5, KERB_H, BZ - 2.2));
        hoopIM.instanceMatrix.needsUpdate = true;
        scene.add(hoopIM);

        // pedestrian fencing outside the station entrance
        const fence = [];
        for (let i = 0; i < 3; i++) {
            for (const y of [1.05, 0.55]) { g = boxG(9, 0.1, 0.06); put(g, -34 - i * 12, KERB_H + y, FL + 3.4); fence.push(g); }
            for (let k = 0; k < 7; k++) { g = cylG(0.03, 0.03, 1.1, 6); put(g, -38 - i * 12 + k * 1.5, KERB_H + 0.55, FL + 3.4); fence.push(g); }
        }
        scene.add(merged(fence, bm));

        // and two litter bins, which are the smallest things in this world
        // somebody might actually want to pick up and move
        [[-24, 16.6], [20, -16.6]].forEach((p, i) => {
            const B = new THREE.Group();
            const drum = [], lid = [];
            let q = cylG(0.34, 0.30, 1.0, 10); put(q, 0, 0.5, 0); drum.push(q);
            q = cylG(0.34, 0.34, 0.06, 10); put(q, 0, 0.02, 0); drum.push(q);
            q = cylG(0.38, 0.36, 0.12, 10); put(q, 0, 1.05, 0); lid.push(q);
            q = new THREE.TorusGeometry(0.22, 0.03, 5, 12); put(q, 0, 1.12, 0, Math.PI / 2, 0, 0); lid.push(q);
            B.add(merged(drum, bm), merged(lid, stdMat(0x4d5459, { roughness: 0.40, metalness: 0.42 })));
            B.position.set(p[0], KERB_H, p[1]);
            scene.add(B);
            world.part('bin_0' + i, B);
        });
    }

    /* ============================================================
       16 · the trams

       A-class (Comeng, Dandenong, 1984–87): a single-ended four-axle bogie car,
       16.64 m over the body, 2.67 m wide, roof 3.22 m above rail, three
       doorways a side, a cab at the leading end only, an air-conditioning pod
       well forward on the roof and a single-arm pantograph behind it.

       Seven meshes each, which is what four of them cost together: the body is
       one box with six materials, and everything else is merged by material.
       ============================================================ */
    const lampCellTex = tex(96, 32, (g, W, H) => {
        // three cells, so one emissive mesh can carry a headlight, an indicator
        // and a tail lamp without three materials to go with them
        const cols = ['#fff3d8', '#ff8a12', '#ff2a12'];
        for (let i = 0; i < 3; i++) { g.fillStyle = cols[i]; g.fillRect(W * i / 3, 0, W / 3, H); }
    });
    const uvCell = (g, n, i) => {
        const uv = g.attributes.uv;
        for (let k = 0; k < uv.count; k++) uv.setX(k, (uv.getX(k) + i) / n);
        return g;
    };

    const TRAM_L = 16.64;
    function makeTram(fleet, route, dest, via) {
        const G = new THREE.Group();
        const L = TRAM_L, W = 2.67, FLOOR = 0.88, BH = 2.34;
        const ROOF = FLOOR + BH, NOSE = 1.95, Lb = L - NOSE, Zb = -NOSE / 2, FZ = L / 2, SET = 0.32;
        const white = [], dark = [], glass = [], inside = [], lamps = [];
        let g;

        // ---- body: one box, six materials, the livery painted on two of them
        const sideR = stdMat(0xffffff, { map: tramSideTex(fleet, false), roughness: 0.24, metalness: 0.10, alphaTest: 0.5 });
        const sideL = stdMat(0xffffff, { map: tramSideTex(fleet, true), roughness: 0.24, metalness: 0.10, alphaTest: 0.5 });
        const roofM = stdMat(0xdcdeda, { roughness: 0.58 });
        const backM = stdMat(0xffffff, { map: tramBackTex(fleet), roughness: 0.30 });
        const whiteM = stdMat(0xf3f5f1, { roughness: 0.22, metalness: 0.10 });
        const body = mesh(boxG(W, BH, Lb),
            [sideR, sideL, roofM, stdMat(0x22272b, { roughness: 0.60 }), whiteM, backM],
            0, FLOOR + BH / 2, Zb);
        G.add(body);

        // ---- roof crown and the rain gutter that runs the whole length
        g = boxG(W - 0.20, 0.11, L - 0.5); put(g, 0, ROOF + 0.05, -0.1); white.push(g);
        g = boxG(W + 0.05, 0.09, L - 0.3); put(g, 0, ROOF - 0.085, -0.1); dark.push(g);

        /* ---- the cab end. The lower half runs out to the front face; above
                the windscreen sill the body steps back, and the raked screen
                bridges the two. ---- */
        g = boxG(W - 0.05, 0.68, NOSE); put(g, 0, 1.20, FZ - NOSE / 2); white.push(g);
        g = boxG(W - 0.13, ROOF - 1.52, NOSE - SET); put(g, 0, (1.52 + ROOF) / 2, FZ - SET - (NOSE - SET) / 2); white.push(g);
        const wsB = 1.60, wsT = 2.80, rake = Math.atan2(SET, wsT - wsB), wsL = Math.hypot(wsT - wsB, SET);
        g = boxG(W - 0.36, wsL, 0.05); put(g, 0, (wsB + wsT) / 2, FZ - SET / 2 + 0.02, -rake); glass.push(g);
        g = boxG(W - 0.30, wsL + 0.09, 0.03); put(g, 0, (wsB + wsT) / 2, FZ - SET / 2 - 0.01, -rake); dark.push(g);
        g = boxG(0.05, 1.05, 0.04); put(g, -0.30, (wsB + wsT) / 2 - 0.06, FZ - SET / 2 + 0.06, -rake, 0, 0.62); dark.push(g);
        g = boxG(W - 0.24, 0.14, 0.34); put(g, 0, 2.90, FZ - SET - 0.02); white.push(g);
        g = boxG(W - 0.26, 0.32, 0.30); put(g, 0, 3.10, FZ - SET - 0.02); dark.push(g);
        for (const s of [-1, 1]) {                        // the front corners are rounded off
            g = boxG(0.26, ROOF - 1.00, 0.26); put(g, s * (W / 2 - 0.19), (1.00 + ROOF) / 2, FZ - 0.10, 0, s * Math.PI / 4, 0);
            white.push(g);
        }
        // bumper and the light clusters either side of it
        g = boxG(W - 0.02, 0.46, 0.34); put(g, 0, 0.86, FZ - 0.10); dark.push(g);
        g = boxG(W + 0.02, 0.14, 0.40); put(g, 0, 0.66, FZ - 0.12); dark.push(g);
        for (const s of [-1, 1]) {
            const cx = s * (W / 2 - 0.42);
            g = boxG(0.62, 0.30, 0.06); put(g, cx, 0.86, FZ + 0.06); dark.push(g);
            g = uvCell(new THREE.PlaneGeometry(0.17, 0.19), 3, 0); put(g, cx - s * 0.19, 0.86, FZ + 0.10); lamps.push(g);
            g = uvCell(new THREE.PlaneGeometry(0.15, 0.19), 3, 1); put(g, cx + s * 0.19, 0.86, FZ + 0.10); lamps.push(g);
            g = uvCell(new THREE.PlaneGeometry(0.15, 0.19), 3, 2); put(g, cx, 0.86, FZ + 0.10); lamps.push(g);
            g = uvCell(new THREE.PlaneGeometry(0.20, 0.16), 3, 2);
            put(g, s * (W / 2 - 0.5), 1.05, -L / 2 - 0.02, 0, Math.PI, 0); lamps.push(g);   // and the tail lamps
        }
        for (const s of [1, -1]) { g = boxG(0.34, 0.30, 0.42); put(g, 0, 0.58, s * (L / 2 - 0.06)); dark.push(g); }

        // ---- skirt, bogies and wheels
        g = boxG(W - 0.09, 0.52, L - 1.1); put(g, 0, 0.62, -0.1); dark.push(g);
        for (const s of [-1, 1]) {
            const bz = s * L * 0.285;
            g = boxG(2.16, 0.46, 2.7); put(g, 0, 0.55, bz); dark.push(g);
            g = boxG(1.2, 0.30, 1.5); put(g, 0, 0.40, bz); dark.push(g);
            for (const a of [-1, 1]) for (const b of [-1, 1]) {
                g = cylG(0.33, 0.33, 0.11, 12); put(g, a * 0.72, 0.33, bz + b * 0.95, 0, 0, Math.PI / 2); dark.push(g);
                g = cylG(0.20, 0.20, 0.13, 10); put(g, a * 0.62, 0.33, bz + b * 0.95, 0, 0, Math.PI / 2); dark.push(g);
            }
            g = boxG(1.7, 0.16, 0.5); put(g, 0, 0.20, bz); dark.push(g);
        }

        // ---- roof equipment: the air-conditioning pod, well forward
        g = boxG(1.62, 0.34, 2.30); put(g, 0, ROOF + 0.27, FZ - 3.05); dark.push(g);
        g = boxG(1.48, 0.07, 2.10); put(g, 0, ROOF + 0.47, FZ - 3.05); white.push(g);
        g = boxG(1.05, 0.22, 1.30); put(g, 0, ROOF + 0.16, -L * 0.34); dark.push(g);

        // ---- the single-arm pantograph, reaching for the wire at 5.90 m
        {
            const py = ROOF + 0.11, TOP = WIRE_H - py - 0.06;
            const kneeY = TOP * 0.58, kneeZ = 0.05, pz0 = -L * 0.14;
            g = boxG(1.55, 0.12, 0.62); put(g, 0, py + 0.06, pz0 - 0.5); dark.push(g);
            const lowL = Math.hypot(kneeY - 0.1, kneeZ + 0.62), lowA = Math.atan2(kneeZ + 0.62, kneeY - 0.1);
            const upL = Math.hypot(TOP - kneeY, 0.85 - kneeZ), upA = Math.atan2(0.85 - kneeZ, TOP - kneeY);
            for (const xo of [-0.42, 0.42]) {
                g = boxG(0.09, lowL, 0.09); put(g, xo, py + (0.1 + kneeY) / 2, pz0 + (-0.62 + kneeZ) / 2, lowA); dark.push(g);
                g = boxG(0.07, upL, 0.07); put(g, xo, py + (kneeY + TOP) / 2, pz0 + (kneeZ + 0.85) / 2, upA); dark.push(g);
            }
            g = boxG(1.05, 0.07, 0.07); put(g, 0, py + kneeY, pz0 + kneeZ); dark.push(g);
            g = boxG(1.85, 0.06, 0.14); put(g, 0, py + TOP, pz0 + 0.85); dark.push(g);
            g = boxG(1.85, 0.05, 0.10); put(g, 0, py + TOP - 0.10, pz0 + 0.62); dark.push(g);
        }

        /* ---- the saloon, seen through the windows cut out of the livery.
                This is what makes a tram in the rain read as a tram: a warm
                lit box moving behind wet glass, with people in it. ---- */
        g = boxG(W - 0.18, 0.06, Lb - 0.2); put(g, 0, FLOOR + 0.03, Zb); inside.push(g);
        g = boxG(W - 0.22, 0.06, Lb - 0.3); put(g, 0, ROOF - 0.20, Zb); inside.push(g);
        for (const s of [-1, 1]) {
            g = boxG(0.05, 0.92, Lb - 0.3); put(g, s * (W / 2 - 0.10), FLOOR + 0.52, Zb); inside.push(g);
            for (const z of [-6.0, -3.4, -0.8, 1.8, 4.4]) {
                g = boxG(0.92, 0.10, 0.92); put(g, s * (W / 2 - 0.62), FLOOR + 0.46, z); inside.push(g);
                g = boxG(0.92, 0.52, 0.11); put(g, s * (W / 2 - 0.62), FLOOR + 0.72, z - 0.45); inside.push(g);
            }
            for (const z of [-5.2, -2.6, 0.0, 2.6, 5.0]) {
                g = cylG(0.042, 0.042, ROOF - FLOOR - 0.24, 6); put(g, s * (W / 2 - 1.12), FLOOR + (ROOF - FLOOR - 0.24) / 2 + 0.12, z);
                inside.push(g);
            }
            g = boxG(0.06, 0.06, Lb - 1.2); put(g, s * (W / 2 - 1.12), ROOF - 0.30, Zb); inside.push(g);
        }
        g = boxG(W - 0.30, 1.9, 0.08); put(g, 0, FLOOR + 0.95, FZ - NOSE - 0.1); inside.push(g);
        for (let p = 0; p < 7; p++) {                      // a few passengers, in silhouette
            const px = (p % 2 ? 1 : -1) * (W / 2 - 0.62), pz = -6.0 + p * 1.9;
            g = boxG(0.42, 0.56, 0.30); put(g, px, FLOOR + 0.80, pz); dark.push(g);
            g = sphG(0.115, 8, 6); put(g, px, FLOOR + 1.20, pz); dark.push(g);
        }

        // ---- the destination box, which at this hour is the most legible
        //      thing on the whole car
        const dt = destTex(route, dest, via);
        const disp = mesh(new THREE.PlaneGeometry(W - 0.42, 0.24),
            emissive(0xffffff, 0xffffff, 1.45, { map: dt, emissiveMap: dt, roughness: 0.4 }),
            0, 3.10, FZ - SET + 0.14);
        const apron = mesh(new THREE.PlaneGeometry(W - 0.62, 0.50),
            stdMat(0xffffff, { map: tramFrontTex, roughness: 0.30 }), 0, 1.20, FZ + 0.012);

        G.add(
            merged(white, whiteM),
            // The windscreen rides with the skirt and the bogies. On a day like
            // this they are all the same wet dark grey, and four cars is four meshes.
            merged(dark.concat(glass), stdMat(0x232a30, { roughness: 0.22, metalness: 0.44 })),
            // 1.25 was a night-time number. Under ACES at twenty to five the
            // saloon it lit clipped to a white hole, and because that sat at
            // roughly twice the 0.80 bloom threshold the hole then bled out over
            // the livery around it — a lit tram read as a blank one. 0.85 keeps
            // the warm box the comment above asks for, with the seats and the
            // standing passengers still legible against it, and keeps the saloon
            // just under the threshold so the bloom pass is left for the things
            // that are actually meant to flare: the destination box, the
            // headlights, the signals and the billboards.
            merged(inside, emissive(0xd7cdb2, 0xfff0d0, 0.85, { roughness: 0.70 })),
            mesh(merge(lamps), emissive(0xffffff, 0xffffff, 2.8, {
                map: lampCellTex, emissiveMap: lampCellTex, roughness: 0.3,
            })),
            disp, apron);
        // Ghosted, all of it. The walk's grid is rasterised once from where
        // things stand at build time, so a tram left solid would leave a
        // sixteen-metre wall across Swanston Street that nobody can see.
        G.traverse((o) => { if (o.isMesh) world.ghost(o); });
        return G;
    }

    /* ------------------------------------------------------------
       The service. Four cars: two down Swanston past Stop 13, and two
       along Flinders. Each one runs its own lane, brakes for the
       signal at the stop line, dwells where there is a platform, and
       keeps its distance from whatever is in front of it.
       ------------------------------------------------------------ */
    const TRAMS = [];
    {
        const defs = [
            { ax: 'z', dir: 1, s: -70, fleet: 2071, route: '3', dest: 'MELB UNI', via: 'SWANSTON ST' },
            { ax: 'z', dir: -1, s: 66, fleet: 2118, route: '67', dest: 'CARNEGIE', via: 'SWANSTON ST' },
            { ax: 'x', dir: 1, s: -46, fleet: 272, route: '109', dest: 'BOX HILL', via: 'via Collins St' },
            { ax: 'x', dir: -1, s: 74, fleet: 221, route: '70', dest: 'WATTLE PK', via: 'via Flinders St' },
        ];
        defs.forEach((d, i) => {
            const t = makeTram(d.fleet, d.route, d.dest, d.via);
            const off = (d.ax === 'z') ? d.dir * TRS : -d.dir * TRF;
            t.rotation.y = (d.ax === 'z') ? (d.dir > 0 ? 0 : Math.PI) : (d.dir > 0 ? Math.PI / 2 : -Math.PI / 2);
            const o = {
                mesh: t, ax: d.ax, dir: d.dir, off, s: d.s, v: 0,
                vmax: rr(9, 12), len: TRAM_L, dwell: 0, wl: i < 3 ? HEAD_WL[i] : -1,
            };
            if (d.ax === 'z') t.position.set(off, 0.05, d.s); else t.position.set(d.s, 0.05, off);
            scene.add(t);
            world.part('tram_0' + i, t);
            TRAMS.push(o);
        });
    }

    /* ============================================================
       17 · the traffic and the crowd

       Twenty-odd vehicles and a hundred people, in seven meshes. Everything
       here is an InstancedMesh whose matrices are rewritten in the frame
       callback — which is the only way a hundred pedestrians and their hundred
       umbrellas fit inside a budget of a hundred and fifty meshes.
       ============================================================ */
    const _m4 = new THREE.Matrix4();
    const setM = (im, i, x, y, z, ry, sx, sy, sz) => {
        _e.set(0, ry || 0, 0);
        _q.setFromEuler(_e);
        _v.set(x, y, z);
        _s.set(sx === undefined ? 1 : sx, sy === undefined ? 1 : sy, sz === undefined ? 1 : sz);
        _m4.compose(_v, _q, _s);
        im.setMatrixAt(i, _m4);
    };

    const CAR_COLS = [0xd8d9db, 0x2b2f33, 0x8f959b, 0x9c2b26, 0x1f3a63, 0xe4e2dc,
                      0x394048, 0xb9bcc0, 0x5c6b52, 0xcfa63a];
    const CARS = [], LANES = new Map();
    let carBodyIM, carGlassIM, carWheelIM, carLampIM, bikeIM;
    {
        const lanes = [
            { ax: 'z', dir: 1, off: 8.4, n: 3, taxi: true },
            { ax: 'z', dir: -1, off: -8.4, n: 3, taxi: true },
            { ax: 'x', dir: 1, off: -10.2, n: 5 },
            { ax: 'x', dir: -1, off: 10.2, n: 5 },
            { ax: 'x', dir: -1, off: -115 - 2.6, n: 2 },
            { ax: 'x', dir: -1, off: -115 + 2.6, n: 2 },
            { ax: 'x', dir: 1, off: -230 - 10.2, n: 2 },
            { ax: 'x', dir: -1, off: -230 + 10.2, n: 2 },
        ];
        lanes.forEach((ln, li) => {
            for (let i = 0; i < ln.n; i++) {
                const van = rnd() < 0.16;
                const taxi = !van && (ln.taxi ? rnd() < 0.62 : rnd() < 0.15);
                CARS.push({
                    ax: ln.ax, dir: ln.dir, off: ln.off, lane: li, van, taxi,
                    s: -ln.dir * (26 + i * rr(18, 34)), v: 8, vmax: rr(10.5, 14.5),
                    len: van ? 5.6 : 4.7,
                });
            }
        });
        for (const c of CARS) { if (!LANES.has(c.lane)) LANES.set(c.lane, []); LANES.get(c.lane).push(c); }
        for (const arr of LANES.values()) arr.sort((a, b) => (b.s * b.dir) - (a.s * a.dir));

        // one saloon shape, stretched into a van and repainted into a taxi
        const bodyG = [];
        let g = boxG(1.84, 0.70, 4.6); put(g, 0, 0.68, 0); bodyG.push(g);
        g = boxG(1.54, 0.10, 2.3); put(g, 0, 1.60, -0.18); bodyG.push(g);
        g = boxG(1.88, 0.26, 4.0); put(g, 0, 0.38, 0); bodyG.push(g);
        carBodyIM = new THREE.InstancedMesh(merge(bodyG), stdMat(0xffffff, { roughness: 0.24, metalness: 0.40 }), CARS.length);
        carGlassIM = new THREE.InstancedMesh(boxG(1.62, 0.60, 2.4), stdMat(0x1a222a, { roughness: 0.08, metalness: 0.50 }), CARS.length);
        const wheels = [];
        for (const s of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) {
            g = cylG(0.33, 0.33, 0.22, 10); put(g, s[0] * 0.86, 0.33, s[1] * 1.45, 0, 0, Math.PI / 2); wheels.push(g);
        }
        carWheelIM = new THREE.InstancedMesh(merge(wheels), stdMat(0x202326, { roughness: 0.60 }), CARS.length);
        const lampG2 = [];
        for (const s of [-0.6, 0.6]) { g = uvCell(new THREE.PlaneGeometry(0.24, 0.16), 3, 0); put(g, s, 0.72, 2.31); lampG2.push(g); }
        for (const s of [-0.62, 0.62]) { g = uvCell(new THREE.PlaneGeometry(0.22, 0.14), 3, 2); put(g, s, 0.75, -2.31, 0, Math.PI, 0); lampG2.push(g); }
        carLampIM = new THREE.InstancedMesh(merge(lampG2),
            emissive(0xffffff, 0xffffff, 2.2, { map: lampCellTex, emissiveMap: lampCellTex, roughness: 0.3 }), CARS.length);

        const tint = new THREE.Color();
        CARS.forEach((c, i) => {
            tint.copy(srgb(c.taxi ? 0xf2c518 : pickOf(CAR_COLS)));
            carBodyIM.setColorAt(i, tint);
        });
        if (carBodyIM.instanceColor) carBodyIM.instanceColor.needsUpdate = true;
        scene.add(carBodyIM, carGlassIM, carWheelIM, carLampIM);
        for (const m of [carBodyIM, carGlassIM, carWheelIM, carLampIM]) world.ghost(m);
    }

    // ---- bikes, in the green kerbside lanes both streets keep for them
    const BIKES = [];
    {
        const parts = [];
        let g;
        for (const z of [-0.52, 0.52]) {
            g = new THREE.TorusGeometry(0.34, 0.035, 5, 12); put(g, 0, 0.34, z, 0, Math.PI / 2, 0); parts.push(g);
        }
        g = boxG(0.05, 0.05, 0.95); put(g, 0, 0.62, 0); parts.push(g);
        g = boxG(0.05, 0.42, 0.05); put(g, 0, 0.52, -0.30); parts.push(g);
        g = boxG(0.05, 0.46, 0.05); put(g, 0, 0.55, 0.34); parts.push(g);
        g = boxG(0.42, 0.04, 0.05); put(g, 0, 0.98, 0.36); parts.push(g);
        g = boxG(0.34, 0.50, 0.26); put(g, 0, 1.14, -0.10); parts.push(g);     // the rider
        g = boxG(0.16, 0.50, 0.16); put(g, -0.12, 0.62, -0.02); parts.push(g);
        g = boxG(0.16, 0.50, 0.16); put(g, 0.12, 0.62, 0.06); parts.push(g);
        g = sphG(0.14, 10, 7); put(g, 0, 1.50, -0.02); parts.push(g);          // helmet
        const lanesB = [['z', -10.35, -1], ['z', 10.35, 1], ['x', -12.35, 1], ['x', 12.35, -1]];
        for (const ln of lanesB) for (let i = 0; i < 4; i++) {
            BIKES.push({ ax: ln[0], off: ln[1], dir: ln[2], s: -ln[2] * (18 + i * rr(20, 46)), v: 5, vmax: rr(5.0, 7.2) });
        }
        bikeIM = new THREE.InstancedMesh(merge(parts), stdMat(0xffffff, { roughness: 0.36, metalness: 0.30 }), BIKES.length);
        const tint = new THREE.Color();
        BIKES.forEach((b, i) => {
            tint.copy(srgb(pickOf([0x1d2b3a, 0x7a2422, 0x2c2c2e, 0xd8d5cc, 0x1f5c3d, 0xc4483a])));
            bikeIM.setColorAt(i, tint);
        });
        if (bikeIM.instanceColor) bikeIM.instanceColor.needsUpdate = true;
        scene.add(bikeIM); world.ghost(bikeIM);
    }

    /* ---- the crowd.

       Half of them are waiting at the four corners for the scramble, half are
       walking the footpaths, and two thirds of them have an umbrella up —
       which, seen from above, is what this crossing looks like in the rain. ---- */
    const PEDS = [];
    const CORNERS = [[-(SW + 2.2), -(FL + 2.2)], [SW + 2.2, -(FL + 2.2)],
                     [SW + 2.2, FL + 2.2], [-(SW + 2.2), FL + 2.2]];
    let pedBodyIM, pedHeadIM, brollyIM;
    {
        const SKIN = [0xf0c8a0, 0xd9a273, 0xa8724a, 0x6f4a30, 0x3f2a1c, 0xf6d9bd];
        const CLOTH = [0x2b3138, 0x1f2a3a, 0x6d2f2a, 0x39473a, 0x8a8378, 0xc9c3b6, 0x2f4858, 0x53344a, 0xb0533a];
        const UMB = [0x14171b, 0x1b1f24, 0x232a33, 0x2b2320, 0x33272c, 0x1f2a2e, 0x5e1c1f, 0x1d3350, 0x2e2f28];

        for (let i = 0; i < 54; i++) {                    // waiting at the corners
            const c = irr(0, 3);
            PEDS.push({
                mode: 'wait', corner: c, sp: rr(1.15, 1.65), phase: rr(0, 6.3),
                x: CORNERS[c][0] + rr(-3.4, 3.4), z: CORNERS[c][1] + rr(-3.4, 3.4),
                t: rr(0, 10), ry: rr(0, 6.3), wx: 0, wz: 0, tx: 0, tz: 0, tgt: 0,
                brolly: rnd() < 0.72, lean: rr(-0.10, 0.10),
            });
        }
        for (let i = 0; i < 46; i++) {                    // walking the footpaths
            const onSwanston = rnd() < 0.62;
            const side = rnd() < 0.5 ? -1 : 1, dir = rnd() < 0.5 ? -1 : 1;
            const off = onSwanston ? side * (SW + rr(1.8, 5.6)) : side * (FL + rr(1.8, 5.6));
            const s = rr(-110, 110);
            PEDS.push({
                mode: 'walk', ax: onSwanston ? 'z' : 'x', off, s, dir,
                sp: rr(1.1, 1.7), phase: rr(0, 6.3),
                x: onSwanston ? off : s, z: onSwanston ? s : off,
                ry: onSwanston ? (dir > 0 ? 0 : Math.PI) : (dir > 0 ? Math.PI / 2 : -Math.PI / 2),
                wx: 0, wz: 0, tx: 0, tz: 0, tgt: 0, t: 0,
                brolly: rnd() < 0.72, lean: rr(-0.10, 0.10),
            });
        }

        const bodyP = [];
        let g = boxG(0.42, 0.86, 0.26); put(g, 0, 0.43, 0); bodyP.push(g);
        g = boxG(0.46, 0.62, 0.29); put(g, 0, 1.16, 0); bodyP.push(g);
        for (const s of [-0.30, 0.30]) { g = boxG(0.13, 0.55, 0.15); put(g, s, 1.16, 0); bodyP.push(g); }
        pedBodyIM = new THREE.InstancedMesh(merge(bodyP), stdMat(0xffffff, { roughness: 0.80 }), PEDS.length);
        const headP = [];
        g = sphG(0.115, 8, 6); put(g, 0, 1.60, 0); headP.push(g);
        pedHeadIM = new THREE.InstancedMesh(merge(headP), stdMat(0xffffff, { roughness: 0.86 }), PEDS.length);
        const umbP = [];
        g = coneG(0.56, 0.34, 10); put(g, 0, 2.06, 0); umbP.push(g);
        g = cylG(0.017, 0.017, 1.02, 6); put(g, 0, 1.60, 0); umbP.push(g);
        brollyIM = new THREE.InstancedMesh(merge(umbP), stdMat(0xffffff, { roughness: 0.44, metalness: 0.10, side: THREE.DoubleSide }), PEDS.length);

        const tint = new THREE.Color();
        PEDS.forEach((p, i) => {
            tint.copy(srgb(pickOf(CLOTH))); pedBodyIM.setColorAt(i, tint);
            tint.copy(srgb(pickOf(SKIN))); pedHeadIM.setColorAt(i, tint);
            tint.copy(srgb(pickOf(UMB))); brollyIM.setColorAt(i, tint);
        });
        for (const m of [pedBodyIM, pedHeadIM, brollyIM]) {
            if (m.instanceColor) m.instanceColor.needsUpdate = true;
            scene.add(m); world.ghost(m);
        }
    }

    /* ============================================================
       18 · the rain

       One instanced draw per layer, wrapping around the camera so it never runs
       out and never needs more drops than the eye can hold. Each streak
       billboards around its own fall direction rather than facing the camera
       flat, which is what stops rain looking like confetti, and each is lit by
       the same ten sources the road is — so the rain brightens where the
       billboards and the concourse are and stays a grey smear everywhere else.
       ============================================================ */
    function makeRain(count, R, H, thick, len, speed, opacity, base) {
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
            transparent: true, depthWrite: false, side: THREE.DoubleSide,
            uniforms: Object.assign(pick('uTime', 'uWind', 'uLPos', 'uLCol', 'uLStr', 'uLRad'), {
                uR: { value: R }, uH: { value: H },
                uThick: { value: thick }, uLen: { value: len }, uSpeed: { value: speed },
                uOpacity: { value: opacity }, uBase: { value: base },
            }),
            vertexShader: /* glsl */`
              #define NL ${NL}
              attribute vec3 aSeed; attribute float aScale;
              uniform float uTime, uR, uH, uThick, uLen, uSpeed;
              uniform vec2 uWind;
              uniform vec3 uLPos[NL]; uniform vec3 uLCol[NL];
              uniform float uLStr[NL]; uniform float uLRad[NL];
              varying vec2 vUvv; varying vec3 vLit; varying float vA;
              void main(){
                vUvv = uv;
                vec3 c = cameraPosition;
                float sp = uSpeed * (0.72 + 0.55 * aScale);
                float y  = mod(aSeed.y - uTime * sp, uH);
                float fall = uH - y;
                float x = mod(aSeed.x + uWind.x * fall - c.x + uR, 2.0 * uR) - uR + c.x;
                float z = mod(aSeed.z + uWind.y * fall - c.z + uR, 2.0 * uR) - uR + c.z;
                vec3 P = vec3(x, y, z);

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
                  float dl = sqrt(dd) + 1e-4;
                  // Bounded exactly as the road's diffuse pool now is, because
                  // this reads the same ten sources and had the fault twice
                  // over: 2.4 radii of falloff, and no end to it. Rain is drawn
                  // in front of everything, so where the road could only tint
                  // the ground, this was carrying the billboards' red and blue
                  // across the pale facades as well — the one surface in the
                  // scene the road shader can never reach.
                  float reach = 1.0 - smoothstep(uLRad[i] * 0.9, uLRad[i] * 1.9, dl);
                  lit += uLCol[i] * (uLStr[i] / (1.0 + dd / (uLRad[i] * uLRad[i] * 2.4))) * reach;
                }
                vLit = lit;

                float dCam = length(toC);
                vA = smoothstep(0.35, 1.8, dCam) * (1.0 - smoothstep(uR * 0.5, uR * 0.96, dCam));
                gl_Position = projectionMatrix * viewMatrix * vec4(wpos, 1.0);
              }`,
            fragmentShader: /* glsl */`
              uniform vec3 uBase; uniform float uOpacity;
              varying vec2 vUvv; varying vec3 vLit; varying float vA;
              void main(){
                float a = 1.0 - abs(vUvv.x * 2.0 - 1.0);
                a *= smoothstep(0.0, 0.22, vUvv.y) * smoothstep(1.0, 0.55, vUvv.y);
                a *= vA;
                // In daylight a raindrop is a pale grey streak, not a spark, so
                // this blends normally and only warms where a light reaches it.
                gl_FragColor = vec4(uBase + vLit * 0.35, a * uOpacity);
              }`,
        });
        const m = mesh(g, mat);
        m.frustumCulled = false;
        m.renderOrder = 8;
        scene.add(m);
        world.ghost(m);
        return m;
    }
    makeRain(5200, 54, 34, 0.011, 0.95, 19.0, 0.36, srgb(0xb9c2c8));
    makeRain(1600, 15, 20, 0.019, 1.45, 24.0, 0.26, srgb(0xc9d1d6));

    /* ============================================================
       19 · what moves

       One eight-phase cycle drives the whole intersection: Swanston green,
       amber, all-red, Flinders green, amber, all-red, then the scramble and its
       clearance. The trams and the cars read it to decide whether to stop, and
       the crowd reads it to decide whether to cross — so the traffic and the
       people are not two animations that happen to run at the same time, they
       are one intersection.
       ============================================================ */
    const PHASES = [
        { ns: 'g', ew: 'r', ped: 0, t: 17.0 },
        { ns: 'y', ew: 'r', ped: 0, t: 3.6 },
        { ns: 'r', ew: 'r', ped: 0, t: 1.8 },
        { ns: 'r', ew: 'g', ped: 0, t: 15.0 },
        { ns: 'r', ew: 'y', ped: 0, t: 3.6 },
        { ns: 'r', ew: 'r', ped: 0, t: 1.8 },
        { ns: 'r', ew: 'r', ped: 1, t: 14.0 },   // the scramble
        { ns: 'r', ew: 'r', ped: 2, t: 6.0 },    // clearance, the red man flashing
    ];
    let phaseIdx = 0, phaseT = 0, pedPainted = '', adT = 0;
    const _cam = new THREE.Vector3();
    const TRAM_STOPS_Z = [-45, 64], TRAM_STOPS_X = [-42, 42];

    world.frame((dt, t) => {
        camera.getWorldPosition(_cam);
        U.uCamPos.value.copy(_cam);
        U.uTime.value = t;

        // the gusts that lean the rain and stir the cloud
        const gx = 0.26 + 0.16 * Math.sin(t * 0.19) + 0.07 * Math.sin(t * 0.61 + 1.2);
        const gz = 0.09 + 0.08 * Math.sin(t * 0.15 + 2.1) + 0.04 * Math.sin(t * 0.47);
        U.uWind.value.set(gx, gz);

        /* ---- the signal cycle ---------------------------------------- */
        phaseT += dt;
        if (phaseT > PHASES[phaseIdx].t) { phaseT = 0; phaseIdx = (phaseIdx + 1) % PHASES.length; }
        const P = PHASES[phaseIdx];
        for (const sig of SIGNALS) {
            const st = sig.dir === 'NS' ? P.ns : P.ew;
            if (st !== sig.state) {          // only when it actually changes
                sig.state = st;
                sig.mat.map = aspectTex[st];
                sig.mat.emissiveMap = aspectTex[st];
                sig.mat.needsUpdate = true;
            }
        }
        const want = P.ped === 1 ? 'g' : 'r';
        if (want !== pedPainted) {
            pedPainted = want;
            PEDMAT.map = pedTex[want];
            PEDMAT.emissiveMap = pedTex[want];
            PEDMAT.needsUpdate = true;
        }
        // the clearance flash is intensity, not a texture swap: a material that
        // recompiles twice a second is a stutter nobody can explain later
        PEDMAT.emissiveIntensity = P.ped === 2 ? (Math.sin(t * 9.4) > 0 ? 2.4 : 0.25) : 2.2;

        /* ---- trams --------------------------------------------------- */
        for (let i = 0; i < TRAMS.length; i++) {
            const o = TRAMS[i];
            const half = (o.ax === 'z') ? FL : SW;
            let target = o.vmax;

            const stopPos = -o.dir * (half + STOPL);
            const d = o.dir * (stopPos - o.s);
            const green = (o.ax === 'z') ? P.ns : P.ew;
            if (green !== 'g' && d > -0.8 && d < 46) {
                if (!(green === 'y' && d < 6)) target = Math.min(target, Math.max(0, (d - 0.6) * 0.55));
            }
            // and the platform stops, where a tram stands with its doors open
            const stops = o.ax === 'z' ? TRAM_STOPS_Z : TRAM_STOPS_X;
            let best = 1e9;
            for (let q = 0; q < stops.length; q++) {
                const dq = o.dir * (stops[q] - o.s);
                if (dq > -22 && dq < best) best = dq;
            }
            if (best > -14 && best < 16) {
                if (o.dwell === 0 && best < 1.5 && best > -1.5) o.dwell = rr(4.0, 8.0);
                if (o.dwell > 0) target = Math.min(target, Math.max(0, best * 0.5));
            } else if (best < -20) o.dwell = 0;
            if (o.dwell > 0) { o.dwell -= dt; if (o.dwell < 0) o.dwell = 0; }

            // whatever is in front, on the same track
            for (let j = 0; j < TRAMS.length; j++) {
                if (j === i) continue;
                const b = TRAMS[j];
                if (b.ax !== o.ax || Math.abs(b.off - o.off) > 0.5) continue;
                const gap = (b.s - o.s) * o.dir - o.len - 2.0;
                if (gap > -o.len && gap < 40) target = Math.min(target, Math.max(0, gap * 0.6));
            }

            o.v = lerp(o.v, target, 1 - Math.exp(-dt * (target < o.v ? 2.6 : 1.0)));
            o.s += o.dir * o.v * dt;
            if (o.dir > 0 && o.s > 150) o.s = -150;
            if (o.dir < 0 && o.s < -150) o.s = 150;
            if (o.ax === 'z') o.mesh.position.set(o.off, 0.05, o.s);
            else o.mesh.position.set(o.s, 0.05, o.off);
            // the headlight is one of the ten mirrors the wet road keeps, so
            // the white smear on the asphalt travels with the car
            if (o.wl >= 0) {
                const nose = o.dir * (o.len / 2 + 0.4);
                if (o.ax === 'z') WL[o.wl].p.set(o.off, 1.25, o.s + nose);
                else WL[o.wl].p.set(o.s + nose, 1.25, o.off);
                U.uLStr.value[o.wl] = 0.55 + 0.45 * clamp(o.v / o.vmax, 0, 1);
            }
        }

        /* ---- cars, lane by lane, leader first ------------------------ */
        for (const arr of LANES.values()) {
            for (let i = 0; i < arr.length; i++) {
                const o = arr[i];
                const half = (o.ax === 'z') ? FL : SW;
                let target = o.vmax;
                // the cross streets have their own stop lines; this is the one
                // signal the whole world is actually measured off
                if (Math.abs(o.off) < 40) {
                    const stopPos = -o.dir * (half + STOPL);
                    const d = o.dir * (stopPos - o.s);
                    const green = (o.ax === 'z') ? P.ns : P.ew;
                    if (green !== 'g' && d > -0.8 && d < 45) {
                        if (!(green === 'y' && d < 6)) target = Math.min(target, Math.max(0, (d - 0.6) * 0.55));
                    }
                }
                if (i > 0) {
                    const lead = arr[i - 1];
                    const gap = (lead.s - o.s) * o.dir - (lead.len + o.len) / 2 - 1.6;
                    target = Math.min(target, Math.max(0, gap * 0.62));
                }
                o.v = lerp(o.v, target, 1 - Math.exp(-dt * (target < o.v ? 2.8 : 1.2)));
                o.s += o.dir * o.v * dt;
                if (o.dir > 0 && o.s > 140) o.s = -140;
                if (o.dir < 0 && o.s < -140) o.s = 140;
            }
        }
        for (let i = 0; i < CARS.length; i++) {
            const o = CARS[i];
            const x = o.ax === 'z' ? o.off : o.s, z = o.ax === 'z' ? o.s : o.off;
            const ry = (o.ax === 'z') ? (o.dir > 0 ? 0 : Math.PI) : (o.dir > 0 ? Math.PI / 2 : -Math.PI / 2);
            const sy = o.van ? 1.55 : 1, sz = o.van ? 1.2 : 1;
            setM(carBodyIM, i, x, 0, z, ry, 1, sy, sz);
            setM(carGlassIM, i, x, o.van ? 1.62 : 1.31, z, ry, 1, o.van ? 1.1 : 1, sz);
            setM(carWheelIM, i, x, 0, z, ry, 1, 1, sz);
            setM(carLampIM, i, x, 0, z, ry, 1, sy, sz);
        }
        carBodyIM.instanceMatrix.needsUpdate = true;
        carGlassIM.instanceMatrix.needsUpdate = true;
        carWheelIM.instanceMatrix.needsUpdate = true;
        carLampIM.instanceMatrix.needsUpdate = true;

        for (let i = 0; i < BIKES.length; i++) {
            const b = BIKES[i];
            const green = (b.ax === 'z') ? P.ns : P.ew;
            const half = (b.ax === 'z') ? FL : SW;
            const d = b.dir * (-b.dir * (half + STOPL) - b.s);
            let target = b.vmax;
            if (green !== 'g' && d > -0.8 && d < 26) target = Math.min(target, Math.max(0, (d - 0.6) * 0.5));
            b.v = lerp(b.v, target, 1 - Math.exp(-dt * 2.4));
            b.s += b.dir * b.v * dt;
            if (b.dir > 0 && b.s > 130) b.s = -130;
            if (b.dir < 0 && b.s < -130) b.s = 130;
            const x = b.ax === 'z' ? b.off : b.s, z = b.ax === 'z' ? b.s : b.off;
            const ry = (b.ax === 'z') ? (b.dir > 0 ? 0 : Math.PI) : (b.dir > 0 ? Math.PI / 2 : -Math.PI / 2);
            setM(bikeIM, i, x, 0, z, ry);
        }
        bikeIM.instanceMatrix.needsUpdate = true;

        /* ---- the crowd ----------------------------------------------- */
        for (let i = 0; i < PEDS.length; i++) {
            const o = PEDS[i];
            let moving = false;
            if (o.mode === 'walk') {
                o.s += o.dir * o.sp * dt;
                if (o.s > 118) o.s = -118;
                if (o.s < -118) o.s = 118;
                // people stop at the kerb rather than strolling into the road
                const near = (o.ax === 'z') ? Math.abs(o.s) < FL + 2.8 : Math.abs(o.s) < SW + 2.8;
                if (near && P.ped !== 1) o.s -= o.dir * o.sp * dt; else moving = true;
                o.x = (o.ax === 'z') ? o.off : o.s;
                o.z = (o.ax === 'z') ? o.s : o.off;
            } else if (o.mode === 'wait') {
                o.t -= dt;
                if (P.ped === 1 && o.t < 0 && rnd() < dt * 2.4) {
                    const tgt = (o.corner + irr(1, 3)) % 4;
                    o.tx = CORNERS[tgt][0] + rr(-2.6, 2.6);
                    o.tz = CORNERS[tgt][1] + rr(-2.6, 2.6);
                    o.tgt = tgt; o.mode = 'cross';
                } else if (rnd() < dt * 0.25) {
                    o.wx = rr(-0.4, 0.4); o.wz = rr(-0.4, 0.4);
                }
                o.x += o.wx * dt * 0.4; o.z += o.wz * dt * 0.4;
            } else {
                const dx = o.tx - o.x, dz = o.tz - o.z, len = Math.hypot(dx, dz);
                if (len < 0.6) {
                    o.mode = 'wait'; o.corner = o.tgt; o.t = rr(2, 14); o.wx = 0; o.wz = 0;
                } else {
                    const sp = o.sp * (P.ped === 2 ? 1.55 : 1.0);
                    o.x += dx / len * sp * dt; o.z += dz / len * sp * dt;
                    o.ry = Math.atan2(dx, dz);
                    moving = true;
                }
            }
            const ph = o.phase + t * 7.4;
            const y = KERB_H + (moving ? Math.abs(Math.sin(ph)) * 0.035 : 0);
            setM(pedBodyIM, i, o.x, y, o.z, o.ry);
            setM(pedHeadIM, i, o.x, y, o.z, o.ry);
            // the umbrella sits a little forward and off to one side, and every
            // one of them is tilted its own way into the weather
            setM(brollyIM, i, o.x + 0.07, o.brolly ? y : -60, o.z + 0.03, o.ry + o.lean);
        }
        pedBodyIM.instanceMatrix.needsUpdate = true;
        pedHeadIM.instanceMatrix.needsUpdate = true;
        brollyIM.instanceMatrix.needsUpdate = true;

        /* ---- and the billboards, which change every eight seconds or so -- */
        adT += dt;
        if (adT > 8.5) {
            adT = 0;
            for (const b of billboards) {
                b.k = (b.k + 1) % b.texs.length;
                b.mesh.material.map = b.texs[b.k];
                b.mesh.material.emissiveMap = b.texs[b.k];
                b.mesh.material.needsUpdate = true;
            }
        }

        // the two real interior lights breathe, because fluorescent light in a
        // big room never quite holds still
        const hum = 1.0 + 0.022 * Math.sin(t * 1.9) + 0.013 * Math.sin(t * 0.71 + 2.0);
        archLight.intensity = 46 * hum;
        pubLight.intensity = 26 * (2.0 - hum);
    });
}
