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
//    · City Square, behind St Paul's between Flinders Lane and Collins Street:
//      the plaza, the steel canopy on its six tree columns, the hotel behind
//      them and Town Hall Station under the lot. The hotel is built shape
//      first — five floors of French doors, then eight arched bays of pale
//      zinc with a four-storey loggia behind each, a rolled cap over them and
//      four planted terraces stepping down to Collins Street.
//    · and the west side of Swanston opposite the Town Hall — the terracotta
//      tower on the Collins corner, the cream one on Little Collins, and the
//      three older frontages between them. Nothing on that frontage is painted:
//      every window is an opening with a pane at the back of it, every
//      cornice is courses and brackets, and the colour is on the vertices, so
//      a whole building is one draw and still has relief you can walk up to. Which is the first place
//      in this world where the ground is not the bottom of the world — you
//      walk down the escalators, through the ticket hall, and out onto a
//      Metro Tunnel platform twenty-five metres under Swanston Street with a
//      seven-car HCMT standing at the screen doors. Section 21.
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

    /* City Square — the block directly behind St Paul's, east of Swanston
       between Flinders Lane and Collins Street. Section 21 builds all of it;
       the plan lives up here because the roadway in section 7 has to know
       where the station shaft goes through it, and section 7 runs first.

           x 18.5 ─── plaza ─── 49 ─── the Westin ─── 88
           z −133 (Flinders Lane end)  …  −203 (Collins Street end)

       Y is the one thing this world had never needed: the plaza is at kerb
       height, the ticket hall twelve metres under it and the platforms
       twenty-four, and everything in between is one continuous walk. */
    const SQ = {
        X0: BX, X1: 49.0,                  // the plaza, west edge to the building line
        Z0: -127.2, Z1: -209.5,            // Flinders Lane footpath to the Collins Street one
        /* The rest of the block behind the plaza. Vacant: the building that
           stood here was a rectilinear box with a Roman arcade on top of it
           and the real one is a curved zinc mass with arched loggias cut into
           it, which is not a detail — it is the whole building. Demolished
           rather than patched. The footprint is kept because the plaza, the
           canopy and the station under them are all measured off it. */
        BX0: 49.0, BX1: 88.0,
        BZ0: -127.2, BZ1: -209.5,
        VX0: 25.5, VX1: 35.4,              // the escalator shaft, through plaza and roadway
        VZ0: -181.5, VZ1: -155.0,
        HALL: -15.0,                       // the ticket hall floor
        PLAT: -25.0,                       // the platforms
        DECK: KERB_H + 0.01,               // the paving, level with the footpath beside it
    };

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
        /* Cut, not a plane, because of the one place in this world where the
           ground is not the bottom of it. The escalators at City Square go
           down through the plaza to Town Hall Station, and `ground.js` fills
           every cell inside every triangle it is given — so a solid sheet at
           y = 0 over the shaft is a lid, and the walk stops on it a hand's
           width below the paving with the station still twenty metres under
           its feet. The shaft is a hole in the sheet instead.

           The shader wants nothing but `position`, so a triangulated shape
           draws exactly as the plane did. Shape space is (x, −z) about the
           mesh's own origin at z = +20, which is what SH_ converts. */
        const sheet = (zc, x0, z0, x1, z1) => {
            // Shape space is (x, −z) about the mesh's own origin, and every
            // sheet at street level gets the same rectangle cut out of it.
            const S_ = (x, z) => [x, zc - z];
            const ring = (path, a, b, c, d) => {
                [[a, b], [c, b], [c, d], [a, d]].forEach((q, i) => {
                    const p2 = S_(q[0], q[1]);
                    i ? path.lineTo(p2[0], p2[1]) : path.moveTo(p2[0], p2[1]);
                });
                path.closePath();
            };
            const shape = new THREE.Shape();
            ring(shape, x0, z0, x1, z1);
            const shaft = new THREE.Path();
            ring(shaft, SQ.VX0, SQ.VZ0, SQ.VX1, SQ.VZ1);
            shape.holes.push(shaft);
            const g = new THREE.ShapeGeometry(shape);
            g.rotateX(-Math.PI / 2);
            return g;
        };
        const roadway = mesh(sheet(20, -160, -210, 160, 250), roadMat, 0, 0, 20);
        scene.add(roadway);
        world.ground(roadway);

        // and the same shader carried out to the fog, so Swanston Street runs
        // north to Little Collins and south over the river without an edge.
        // Ghosted: it lies twenty millimetres under the sheet above and reaches
        // half a kilometre past the end of the walk's own grid, so every one of
        // its cells is either a cell the roadway already owns or a cell nobody
        // can reach — and rasterising 1.2 million square metres of it is the
        // most expensive nothing in the world.
        // The same hole, because this sheet lies twenty millimetres under the
        // other one and would otherwise be the lid the other one stopped
        // being: from the top of the escalators the shaft came out as a flat
        // grey floor at street level with the whole station behind it.
        const distance = mesh(sheet(-60, -500, -660, 500, 540), roadMat, 0, -0.02, -60);
        scene.add(distance);
        world.ghost(distance);
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
        // The two masses this part used to carry — a textured box and a plain
        // stone one — went into the street wall below, which is what they
        // always were: the first two buildings of the block. What is left here
        // is the two panels and the steel holding them up, which is what the
        // part is named after.
        const G = new THREE.Group();
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

    /* ---- Swanston Street carried north, and the shopfronts under it ----

       Everything between the back of Young & Jackson and Little Collins was
       bare ground with tram poles standing in it, so the street ran out of the
       world about eighty metres up and the Town Hall stood at the end of
       nothing. Melbourne's mid-block frontage is one thing before it is
       anything else: a cantilevered awning at four metres with a lit shopfront
       under it, running the whole block, under whatever the upper storeys
       happen to be that year.

       One mesh for all of it, including the two blocks behind the hotel that
       used to be a textured box and a plain stone one. The variety is in the
       sheet rather than in the materials — four whole facades drawn side by
       side on one texture, each with its own render, its own window rhythm and
       its own shopfront, and every building's UVs pointed at one of the four.
       The awnings and the parapets sample the flat cornice band along the top
       of the first facade, so they come out of the same sheet and cost
       nothing. And the lit shopfront is the emissive map's job, exactly as the
       lit offices above it already are: at twenty to five the ground floor is
       the brightest thing on the block, which is the entire reason the awning
       over it is in shadow. ---- */
    {
        /* UVs remapped into a sub-rectangle rather than merely scaled. Scaling
           alone picks the facade's grain; it cannot pick which of the four
           facades, and it cannot point an awning at a patch of flat grey. */
        const uvRect = (g, u0, v0, u1, v1) => {
            const uv = g.attributes.uv;
            for (let i = 0; i < uv.count; i++) {
                uv.setXY(i, u0 + uv.getX(i) * (u1 - u0), v0 + uv.getY(i) * (v1 - v0));
            }
            return g;
        };

        const streetSheet = (emis) => tex(2048, 1024, (g, W, H) => {
            const walls = ['#c9c2b4', '#9c6c58', '#767d85', '#ddd3bc'];
            const wins = ['#3d4750', '#2c343c', '#28343f', '#424c55'];
            const VW = W / 4;
            for (let k = 0; k < 4; k++) {
                const x0 = k * VW;
                g.fillStyle = emis ? '#000' : walls[k];
                g.fillRect(x0, 0, VW, H);

                // the cornice, along the top of the sheet — which is also the
                // flat grey the awnings and the parapets are pointed at
                if (!emis) { g.fillStyle = '#3b3f44'; g.fillRect(x0, 0, VW, H * 0.055); }

                // twelve floors between the cornice and the awning line
                const y0 = H * 0.055, y1 = H * 0.855, rows = 12, cols = 7;
                const rh = (y1 - y0) / rows, cw = VW / cols;
                for (let r = 0; r < rows; r++) for (let i = 0; i < cols; i++) {
                    const wx = x0 + i * cw + cw * 0.16, wy = y0 + r * rh + rh * 0.18;
                    const ww = cw * 0.68, wh = rh * 0.62;
                    // the same hash on both passes, so a lit window is lit in both
                    const n = Math.sin((i * 12.9898 + r * 78.233 + k * 41.13) * 43758.5453);
                    const on = (n - Math.floor(n)) < 0.32;
                    if (emis) {
                        if (!on) continue;
                        g.fillStyle = ['#ffd9a0', '#ffe7c4', '#e8f0ff', '#fff3d6'][(i + r * 3) % 4];
                        g.globalAlpha = 0.40 + 0.5 * (((i * 7 + r * 3) % 5) / 5);
                        g.fillRect(wx, wy, ww, wh); g.globalAlpha = 1;
                    } else {
                        g.fillStyle = wins[k]; g.fillRect(wx, wy, ww, wh);
                        g.fillStyle = 'rgba(255,255,255,.06)'; g.fillRect(wx, wy, ww, wh * 0.30);
                        g.fillStyle = 'rgba(0,0,0,.13)'; g.fillRect(x0, y0 + r * rh + rh - 2, VW, 2);
                    }
                }

                // what the awning does to the wall it is bolted to
                if (!emis) { g.fillStyle = 'rgba(0,0,0,.44)'; g.fillRect(x0, H * 0.855, VW, H * 0.058); }

                // the shopfront: five bays of glazing on a dark stallriser,
                // and at this hour every one of them is on
                const sy = H * 0.913, sh = H * 0.070;
                if (!emis) { g.fillStyle = '#22262b'; g.fillRect(x0, sy - H * 0.006, VW, H * 0.093); }
                for (let b = 0; b < 5; b++) {
                    const bx = x0 + VW * (b + 0.06) / 5, bw = VW * 0.88 / 5;
                    g.fillStyle = emis ? ['#ffd7a2', '#ffe9c8', '#ffdcb0', '#ffeed4', '#ffd39a'][b]
                                       : ['#c9b184', '#d8c49b', '#cbb88f', '#e0cfa8', '#c6ad80'][b];
                    g.fillRect(bx, sy, bw, sh);
                    if (!emis) { g.fillStyle = 'rgba(0,0,0,.32)'; g.fillRect(bx, sy + sh * 0.60, bw, sh * 0.40); }
                }
                // and the signs on the fascia, which on a wet footpath are the
                // other thing you actually see
                for (let b = 0; b < 3; b++) {
                    const bx = x0 + VW * (0.06 + b * 0.31), bw = VW * 0.24;
                    g.fillStyle = emis ? ['#ffb27a', '#9fd8ff', '#ffe08a'][b] : '#2a2f34';
                    g.fillRect(bx, H * 0.870, bw, H * 0.030);
                }
            }
        });

        const CORN = [0.03, 0.958, 0.22, 0.992];        // the flat grey, in uv
        const parts = [];
        const flat = (g) => uvRect(g, CORN[0], CORN[1], CORN[2], CORN[3]);

        /* cx, cz, w (back from the street), d (frontage), h, which facade, and
           which way the awning faces — 0 for the two masses behind the hotel
           that do not front Swanston at all. Written out rather than seeded:
           this is a block of a real city and the heights in it are not random,
           they are what got built when. */
        const BLOCKS = [
            [-32.6, -53.0, 28, 22, 26, 3, 1],           // behind Young & Jackson, under the billboards
            [-58.0, -54.0, 20, 22, 30, 1, 0],           // and the one behind that
            [-33.5, -75.5, 30, 19, 34, 0, 1],
            [-33.5, -93.9, 30, 17.8, 22, 1, 1],
            /* Nothing on the west side from Flinders Lane all the way to
               Little Collins. That whole side of Swanston — the side you are
               looking at from City Square and from in front of the Town Hall —
               is built as itself in sections 22 and 23. Seven boxes off this
               sheet used to stand there. */
            /* Nothing on the east side between Flinders Lane and Collins
               Street. That whole frontage — the eighty metres directly behind
               St Paul's — is City Square, the Westin and the Town Hall Station
               entrance, and it is built as itself in section 21. Three generic
               boxes used to stand there. */
        ];

        for (const b of BLOCKS) {
            const [cx, cz, w, d, h, k, awn] = b;
            const u0 = k / 4 + 0.004, u1 = (k + 1) / 4 - 0.004;
            parts.push(uvRect(put(boxG(w, h, d), cx, h / 2, cz), u0, 0, u1, 1));
            parts.push(flat(put(boxG(w + 0.7, 0.6, d + 0.7), cx, h + 0.3, cz)));
            if (!awn) continue;
            // the awning: three metres of cantilever at four and a bit, with
            // the fascia hanging off its edge. No posts — a Melbourne verandah
            // has not been propped on the footpath since about 1920.
            const fx = cx + awn * w / 2;
            parts.push(flat(put(boxG(3.0, 0.22, d * 0.97), fx + awn * 1.5, 4.35, cz)));
            parts.push(flat(put(boxG(0.16, 0.9, d * 0.97), fx + awn * 2.96, 3.95, cz)));
        }
        // a little roof plant, so the parapet line is not a run of clean edges
        for (const p of [[-33.5, -138.6, 46]]) {
            parts.push(flat(put(boxG(7, 2.6, 6), p[0] + 4, p[2] + 1.9, p[1] - 3)));
            parts.push(flat(put(boxG(4, 1.6, 4), p[0] - 6, p[2] + 1.4, p[1] + 4)));
        }

        const sheet = streetSheet(false), sheetE = streetSheet(true);
        const walls = merged(parts, stdMat(0xffffff, {
            map: sheet, emissive: 0xffffff, emissiveMap: sheetE, emissiveIntensity: 1.0,
            roughness: 0.66,
        }));
        scene.add(walls);
        world.part('swanstonwall_00', walls);
    }


    /* ============================================================
       12 · Federation Square — the south-east quadrant

       The pinwheel fractal is the whole building: a rectangle cut into four
       triangles about a point somewhere off-centre, in sandstone, zinc and
       glass, repeated until the wall stops being a wall. It is written here as
       raw vertex colours, so every clad face of every volume on the site is
       one mesh and one draw.

       What was here before was six boxes with flat pale lids, and from the air
       that is the one view where the complex is nothing like itself. Two
       things fix that and both are shape rather than texture. Nothing on this
       site is a single prism: each building is two or three masses at slightly
       different angles and heights, so the silhouette breaks. And nothing on
       this site has a flat top: every roof is two or three shallow planes
       meeting at a ridge that is never in the middle and never straight, in
       standing-seam zinc, with the fractal carried up over the steeper folds.
       Those two moves cost triangles, which are cheap here, and no meshes at
       all, which are not.

       Seven meshes for the whole complex, which is what it cost before: the
       cladding, the zinc, the glass, the dark steel, the sandstone, the big
       screen and the plaza.
       ============================================================ */
    {
        const dark = [], zinc = [], glassy = [], sandy = [], plazaG = [];
        const pos = [], col = [], nor = [];

        /* The cladding is not confetti. On the real building a whole face is
           predominantly one of the three materials and the other two are the
           accents in it — sandstone here, zinc there, and the black glass
           reserved for SBS on the corner — which is why the complex reads as
           several buildings rather than one pattern. Written linear, because
           these are vertex colours and three does not convert those. */
        const SAND_L = [0.300, 0.238, 0.162], SAND_M = [0.196, 0.150, 0.098];
        const ZINC_L = [0.238, 0.256, 0.276], ZINC_M = [0.142, 0.158, 0.180];
        const GLAS_D = [0.030, 0.044, 0.062], GLAS_M = [0.072, 0.096, 0.122];
        const PAL = {
            sand: [SAND_L, SAND_M, SAND_L, ZINC_M, GLAS_D, SAND_M, SAND_L, GLAS_M],
            zinc: [ZINC_L, ZINC_M, ZINC_L, SAND_M, GLAS_D, ZINC_M, SAND_L, GLAS_M],
            dark: [GLAS_D, GLAS_M, GLAS_D, ZINC_M, GLAS_M, ZINC_L, GLAS_D, SAND_M],
        };

        /* One clad plane, cut into a pinwheel of triangles about a point that
           moves cell by cell. `cell` is metres, not a count, so a nine-metre
           wing and a forty-metre facade come out with the same grain — which is
           the whole point of a fractal cladding and was the thing lost when the
           divisions were counted per wall instead. */
        const fracPlane = (w, h, cell, M0, mix) => {
            const pal = PAL[mix];
            const base = pos.length / 3;
            const cols = Math.max(2, Math.round(w / cell));
            const rows = Math.max(2, Math.round(h / cell));
            const cw = w / cols, rh = h / rows;
            for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
                const x0 = -w / 2 + c * cw, y0 = r * rh;
                const corner = [[x0, y0], [x0 + cw, y0], [x0 + cw, y0 + rh], [x0, y0 + rh]];
                const px = x0 + cw * rr(0.22, 0.78), py = y0 + rh * rr(0.22, 0.78);
                for (let i = 0; i < 4; i++) {
                    const a = corner[i], b = corner[(i + 1) % 4];
                    pos.push(px, py, 0, a[0], a[1], 0, b[0], b[1], 0);
                    const cc = pal[irr(0, pal.length - 1)], sh = rr(0.82, 1.18);
                    for (let k = 0; k < 3; k++) {
                        col.push(clamp(cc[0] * sh, 0, 1), clamp(cc[1] * sh, 0, 1), clamp(cc[2] * sh, 0, 1));
                        nor.push(0, 0, 1);
                    }
                }
            }
            // one plane's worth of loose triangles, carried into place in bulk
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

        /* A wedge, from a profile in (x, y) extruded across `depth`. Every
           folded roof plane and the glass shard on the river are one of these:
           an extruded triangle closes its own gable ends, which a pair of
           tilted slabs does not, and a roof you can see the underside of is a
           roof somebody will notice from the bridge. */
        const wedgeG = (pts, depth) => {
            const s = new THREE.Shape();
            s.moveTo(pts[0][0], pts[0][1]);
            for (let i = 1; i < pts.length; i++) s.lineTo(pts[i][0], pts[i][1]);
            s.closePath();
            const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false });
            g.translate(0, 0, -depth / 2);
            return g;
        };

        /* Standing seams, laid up the slope of one roof plane. From the air
           this is most of what the real roofs are: a fine grain of ribs
           running with the fall, which is what tells the eye the plane is
           metal and which way it is tilted. */
        const seams = (M0, x0, y0, x1, y1, zc, depth, n) => {
            const L = Math.hypot(x1 - x0, y1 - y0);
            const a = Math.atan2(y1 - y0, x1 - x0);
            const mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
            for (let i = 0; i < n; i++) {
                const g = boxG(L * 0.97, 0.10, 0.10);
                put(g, mx, my + 0.08, zc + depth * ((i + 0.5) / n - 0.5), 0, 0, a);
                carry(zinc, g, M0);
            }
        };

        /* One mass: a clad prism with a folded roof. Three or four of these at
           slightly different angles make one building, which is how the site
           actually works — the Ian Potter Centre is not a block, it is a heap
           of them leaning on each other. */
        const fedMass = (M0, w, d, h, o) => {
            o = o || {};
            const mix = o.clad || 'sand';
            const cell = o.cell || 2.9;

            // the solid inside the cladding, in the same dark steel the
            // mullions are: it is never seen except as the sliver behind a
            // fold, and a bucket of its own for that would be a mesh wasted
            let g = boxG(w, h, d); put(g, 0, h / 2, 0); carry(dark, g, M0);

            fracPlane(w, h, cell, MX(0, 0, d / 2 + 0.08).premultiply(M0), mix);
            fracPlane(w, h, cell, MX(0, 0, -d / 2 - 0.08, 0, Math.PI, 0).premultiply(M0), mix);
            fracPlane(d, h, cell, MX(-w / 2 - 0.08, 0, 0, 0, -Math.PI / 2, 0).premultiply(M0), mix);
            fracPlane(d, h, cell, MX(w / 2 + 0.08, 0, 0, 0, Math.PI / 2, 0).premultiply(M0), mix);

            // the fascia at the eaves, which is what hides the joint between
            // the cladding and the roof all the way round
            g = boxG(w + 0.5, 0.62, d + 0.5); put(g, 0, h + 0.20, 0); carry(zinc, g, M0);

            /* The roof, in two or three bands across the depth, each with its
               own ridge offset and its own rise — so the ridge kinks from band
               to band instead of running straight, and the planes either side
               of it are never the same pitch. That kink is the single thing
               that reads as Federation Square from above. */
            const bands = o.bands || (d > 26 ? 3 : 2);
            const bd = d / bands;
            for (let b = 0; b < bands; b++) {
                const zc = -d / 2 + bd * (b + 0.5);
                const ox = w * rr(-0.30, 0.30);
                const rise = (o.rise || 2.6) * rr(0.72, 1.28);
                g = wedgeG([[-w / 2, 0], [w / 2, 0], [ox, rise]], bd + 0.06);
                put(g, 0, h + 0.45, zc); carry(zinc, g, M0);
                const nS = Math.max(2, Math.round(bd / 1.7));
                seams(M0, -w / 2, h + 0.45, ox, h + 0.45 + rise, zc, bd, nS);
                seams(M0, w / 2, h + 0.45, ox, h + 0.45 + rise, zc, bd, nS);

                // and on the steeper of the two falls, the cladding carried
                // straight up over the fold — which the real building does
                // often enough that a complex without it looks tiled rather
                // than wrapped
                if (o.cladRoof && b === (o.cladRoof - 1)) {
                    const run = w / 2 - ox, L = Math.hypot(run, rise);
                    // Built basis-first rather than from Euler angles: the
                    // plane has to lie in the fall of this particular fold,
                    // and three angles that happen to look right at one pitch
                    // are three angles that are wrong at the next.
                    const M = new THREE.Matrix4().makeBasis(
                        new THREE.Vector3(run / L, -rise / L, 0),
                        new THREE.Vector3(0, 0, -1),
                        new THREE.Vector3(rise / L, run / L, 0));
                    M.setPosition(ox + run / 2, h + 0.53 + rise / 2, zc + bd * 0.46);
                    fracPlane(L, bd * 0.92, cell * 0.8, M.premultiply(M0), mix);
                }
            }

            // rooftop plant: the boxy rooms and, on the tall ones, a dish
            if (o.plant) {
                g = boxG(w * 0.26, 1.8, d * 0.20); put(g, w * 0.14, h + 1.3, -d * 0.18); carry(zinc, g, M0);
                g = boxG(w * 0.18, 1.2, d * 0.14); put(g, -w * 0.20, h + 1.0, d * 0.22); carry(zinc, g, M0);
                g = cylG(1.5, 1.5, 0.35, 12); put(g, -w * 0.20, h + 2.0, d * 0.22, -0.5); carry(zinc, g, M0);
            }
            return M0;
        };

        /* --- the buildings, west to east. The names are the real tenants,
               and the footprints are the real footprints; the second and third
               mass of each is where the box used to be one. --- */

        // NGV Australia in the Ian Potter Centre, holding the Swanston Street
        // frontage and the tallest thing on the site after SBS
        fedMass(MX(31, 0, 62, 0, -0.02, 0), 22, 40, 20, { clad: 'sand', rise: 3.8, plant: 1, cladRoof: 2 });
        fedMass(MX(37, 0, 92, 0, 0.11, 0), 18, 22, 16, { clad: 'sand', rise: 3.0 });
        // its lower northern wing, stepping down to the Flinders Street corner
        fedMass(MX(32, 0, 33, 0, 0.03, 0), 20, 18, 13, { clad: 'zinc', rise: 3.3, cladRoof: 1 });
        // ACMI, fronting Flinders Street, and the smaller volume behind it
        fedMass(MX(72, 0, 36, 0, 0.015, 0), 24, 26, 20, { clad: 'zinc', rise: 3.6, plant: 1 });
        fedMass(MX(85, 0, 52, 0, -0.24, 0), 14, 16, 14, { clad: 'sand', rise: 2.9 });
        // SBS on the north-east corner: the dark one, mostly black glass
        fedMass(MX(101, 0, 34, 0, -0.03, 0), 24, 24, 25, { clad: 'dark', rise: 2.9, plant: 1, cladRoof: 1 });
        // the eastern edge of the plaza
        fedMass(MX(107, 0, 64, 0, 0.04, 0), 14, 24, 16, { clad: 'sand', rise: 3.2 });
        // Transport and the Visitor Centre, low, on the river side
        fedMass(MX(59, 0, 119, 0, -0.02, 0), 26, 18, 11, { clad: 'zinc', rise: 3.0, cladRoof: 1 });
        fedMass(MX(41, 0, 122, 0, 0.17, 0), 14, 13, 9, { clad: 'sand', rise: 2.6 });

        /* --- the Atrium: a glazed street running from Flinders Street through
               to the plaza. It was a steel cage with a pane in it, because the
               mullions were on a grid a metre and a bit apart in both
               directions and the glass was darker than they were. It is a
               concertina now — the walls fold in and out of plane facet by
               facet, the framing is only at the folds, and the roof is a run
               of shallow crystalline gables at three different pitches. --- */
        {
            const A = MX(51.5, 0, 42);
            const AW = 12, AL = 40, AH = 23, N = 8;
            let g;

            for (let i = 0; i < N; i++) {
                const z = -AL / 2 + AL * (i + 0.5) / N;
                const t = (i % 2 ? 1 : -1) * 0.10;
                for (const s of [-1, 1]) {
                    g = boxG(0.10, AH, AL / N + 0.30);
                    put(g, s * (AW / 2), AH / 2, z, 0, s * t, 0); carry(glassy, g, A);
                }
            }
            for (let i = 0; i <= N; i++) for (const s of [-1, 1]) {
                g = boxG(0.24, AH, 0.24); put(g, s * (AW / 2), AH / 2, -AL / 2 + i * AL / N); carry(dark, g, A);
            }
            for (const y of [6.2, 12.6, 19.0]) for (const s of [-1, 1]) {
                g = boxG(0.15, 0.15, AL); put(g, s * (AW / 2), y, 0); carry(dark, g, A);
            }
            // the two ends, glazed right up into the gable
            for (const s of [-1, 1]) {
                g = boxG(AW, AH, 0.10); put(g, 0, AH / 2, s * AL / 2); carry(glassy, g, A);
                g = prismG(AW, 2.9, 0.12); put(g, 0, AH, s * AL / 2); carry(glassy, g, A);
            }

            // the roof: eight gables, three pitches, ridge bar and rafters at
            // every fold, so it breaks the light instead of lying flat
            for (let i = 0; i < N; i++) {
                const z = -AL / 2 + AL * (i + 0.5) / N, seg = AL / N;
                const rise = 2.1 + (i % 3) * 0.8;
                g = prismG(AW + 0.6, rise, seg + 0.08); put(g, 0, AH, z); carry(glassy, g, A);
                g = boxG(0.18, 0.18, seg + 0.2); put(g, 0, AH + rise, z); carry(dark, g, A);
                const L = Math.hypot(AW / 2, rise);
                for (const s of [-1, 1]) for (const e of [-1, 1]) {
                    g = boxG(L, 0.13, 0.13);
                    put(g, s * AW / 4, AH + rise / 2, z + e * seg / 2, 0, 0, -s * Math.atan2(rise, AW / 2));
                    carry(dark, g, A);
                }
            }
        }

        /* --- the shard on the river side. Deakin Edge is a glass wedge that
               stands tallest where it faces the plaza and falls away towards
               the Yarra, and the face it turns on the square is broken into
               raking triangles by its own framing. A gable would have been
               easier and would have read as a greenhouse. --- */
        {
            const E = MX(99, 0, 110, 0, -0.14, 0);
            let g;
            g = boxG(30, 3.0, 23); put(g, 0, 1.5, 0); carry(dark, g, E);
            g = boxG(31, 0.5, 24); put(g, 0, 3.1, 0); carry(zinc, g, E);

            // the wedge itself: 16 m at the plaza corner, 5 at the river
            g = wedgeG([[-15, 0], [15, 0], [15, 5], [-15, 16]], 23);
            put(g, 0, 3.2, 0); carry(glassy, g, E);

            // the framing that breaks the rake into shards: purlins across
            // the raking face, mullions on both end walls, and a diagonal in
            // every bay, which is where the triangles come from
            const yAt = (x) => 3.2 + 16 - ((x + 15) / 30) * 11;
            for (let i = 0; i <= 6; i++) {
                const x = -15 + i * 5, y = yAt(x);
                g = boxG(0.26, 0.26, 23.4); put(g, x, y, 0); carry(dark, g, E);
                for (const z of [-11.7, 11.7]) {
                    g = boxG(0.22, y - 3.2, 0.22); put(g, x, (3.2 + y) / 2, z); carry(dark, g, E);
                }
            }
            for (let i = 0; i < 6; i++) {
                const xa = -15 + i * 5, xb = xa + 5, yb = yAt(xb);
                const L = Math.hypot(xb - xa, yb - 3.2), an = Math.atan2(yb - 3.2, xb - xa);
                for (const z of [-11.7, 11.7]) {
                    g = boxG(L, 0.20, 0.20); put(g, (xa + xb) / 2, (3.2 + yb) / 2, z, 0, 0, an); carry(dark, g, E);
                }
            }
            g = boxG(0.36, 0.36, 23.6); put(g, -15, 3.2 + 16, 0); carry(dark, g, E);
            g = boxG(0.30, 0.30, 23.6); put(g, 15, 3.2 + 5, 0); carry(dark, g, E);
            // the amphitheatre steps it sits behind, facing back into the plaza
            for (let i = 0; i < 5; i++) { g = boxG(26, 0.45, 1.8); put(g, 0, 0.22 + i * 0.45, -11.5 - i * 1.8); carry(sandy, g, E); }
        }

        /* --- the plaza: Kimberley sandstone laid in radiating bands that fan
               out of the Flinders Street corner, falling away south towards
               the river. --- */
        {
            let g = boxG(74, 0.7, 64); put(g, 80, 0.15, 92, 0.030); plazaG.push(g);
            for (let i = 0; i < 9; i++) { g = boxG(66, 0.28, 1.7); put(g, 79, 0.14 + i * 0.28, 51.5 + i * 1.7); sandy.push(g); }
            g = boxG(22, 0.5, 24); put(g, 31, 0.25 + KERB_H, 32); sandy.push(g);
            for (let i = 0; i < 5; i++) { g = boxG(22, 0.26, 1.5); put(g, 31, 0.13 + i * 0.26, 21.5 + i * 1.5); sandy.push(g); }
            for (let i = 0; i < 7; i++) { g = boxG(78, 0.45, 2.0); put(g, 80, -0.2 - i * 0.45, 126 + i * 2.0); sandy.push(g); }
            g = boxG(0.7, 0.95, 26); put(g, 21.4, 0.48 + KERB_H, 46); sandy.push(g);      // the low seating wall on Swanston
        }

        // Market umbrellas and the timber benches under them. The canopies go
        // in with the sandstone rather than with the steel they stand on: in
        // the dark bucket two dozen of them read as black lily pads lying on a
        // pale plaza, which is the one thing on this square nobody has ever
        // seen there.
        const brolly = [], canopies = [], benches = [];
        for (let i = 0; i < 24; i++) {
            const ux = rr(52, 106), uz = rr(74, 116);
            let g = cylG(0.06, 0.07, 2.3, 6); put(g, ux, 1.4, uz); brolly.push(g);
            g = cylG(1.55, 0.25, 0.35, 10); put(g, ux, 2.65, uz); canopies.push(g);
        }
        for (let i = 0; i < 10; i++) {
            const g = boxG(2.6, 0.45, 0.7); put(g, rr(50, 106), 0.9, rr(74, 118), 0, rr(0, 3.1), 0); benches.push(g);
        }

        // the big screen, facing back into the plaza
        const screenMat = emissive(0x1b2733, 0x3f6a94, 1.15, { roughness: 0.36 });
        const screen = mesh(new THREE.PlaneGeometry(13, 7.4), screenMat, 74, 8.4, 51.6);
        {
            let g = boxG(14, 8.8, 0.6); put(g, 74, 8.4, 51.2); dark.push(g);
            for (const x of [68, 80]) { g = boxG(0.5, 4.4, 0.5); put(g, x, 2.2, 51.2); dark.push(g); }
        }

        const fracGeo = new THREE.BufferGeometry();
        fracGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        fracGeo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
        fracGeo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));

        const fed = new THREE.Group();
        fed.add(
            mesh(fracGeo, new THREE.MeshStandardMaterial({
                vertexColors: true, roughness: 0.52, metalness: 0.28, side: THREE.DoubleSide,
            })),
            /* Written pale because `srgb` reads it twice (see the helper at the
               top): 0xb9c1c9 lands where a paint chip of about 0x8e9299 would
               if it were read once, and a paint chip of 0x8e9299 is what the
               real standing-seam roofs are — the palest large surface on the
               site, and the reason the complex reads as roofs at all from the
               bridge. */
            merged(zinc, stdMat(0xb9c1c9, { roughness: 0.44, metalness: 0.46 })),
            merged(glassy, stdMat(0x9dbcd2, {
                roughness: 0.07, metalness: 0.36, transparent: true, opacity: 0.40, side: THREE.DoubleSide,
            })),
            merged(dark.concat(brolly), stdMat(0x343a40, { roughness: 0.40, metalness: 0.55 })),
            merged(sandy.concat(benches, canopies), stdMat(0xbb9f7a, { roughness: 0.72 })),
            screen);
        const plaza = merged(plazaG, stdMat(0xffffff, { map: plazaTex, roughness: 0.70 }));
        fed.add(plaza);
        scene.add(fed);
        world.part('fedsquare_00', fed);
        /* Not `world.ground`, and the reason is the whole walk.

           `ground.js` sizes its grid from the union of what a world declares
           as ground, minus anything that is a flat sheet lying at ground
           level — because an ocean or a roadway would otherwise spend the
           entire resolution on the part of the world where every cell holds
           the same number. Every ground in this world is exactly such a
           sheet, except this one: Fed Square's deck falls two and a half
           metres across it, which made it the only thing with a say. The grid
           came out eighty-seven metres square, centred on Fed Square, at a
           sixth of a metre a cell — so the crossing, both landmarks, Swanston
           Street and everything else in this world stood outside it, where
           the walk knows nothing and falls back to a flat plane at y = 0.
           Which is why, until now, you could walk through the cathedral.

           The deck is still drawn and still collides — collision is read off
           what is visible, not off what is declared — it simply no longer
           decides how big the walk is. With it out, the region falls back to
           the union of the flat grounds, which is the whole city: seven
           hundred metres at 1.37 m a cell, covering the bridge, both sides of
           Swanston, the Town Hall and Town Hall Station under it. */
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
       14 · Melbourne Town Hall — the whole east side of Swanston Street
            between Collins and Little Collins, four hundred metres north

       Reed and Barnes, 1870, rebuilt behind its own facade after the 1925
       fire: Second Empire, a giant Corinthian order in Barrabool sandstone
       over a rusticated bluestone base, a mansard roof behind a balustraded
       parapet, the long colonnaded elevation down Swanston Street, the
       pedimented portico with its arched entrance in the middle of it, and
       the clock tower standing on the Collins Street corner.

       Built for the range it is seen at rather than for its own sake. From
       Flinders Street this is three hundred metres up a wet street and the
       fog has three fifths of it, so what has to survive that is the
       silhouette — the tower, the parapet line, the shadow rhythm of a
       colonnade — and the colour, which is the one honey-coloured building on
       a grey street. A carved capital at this distance is a carved capital
       nobody will ever see, so there are none. The column count is right
       instead, because the count is what makes the rhythm read, and the
       rhythm is what makes it the Town Hall rather than a sandstone box.

       Three meshes: the sandstone, the dark (bluestone, slate and the reveals
       behind the order) and the lit clock dials. They were paid for out of
       the two litter bins, whose lids are now the same galvanised grey as
       their drums, and out of the tree pits, which went in with the trunks.
       ============================================================ */
    {
        const sand = [], dk = [], glow = [];

        /* The block, off the same simplified Hoddle Grid as everything else
           up this street: the building line east of Swanston, the north kerb
           of Collins and the south kerb of Little Collins. */
        const HX = BX, HZS = -(230 + 13.5 + FP), HZN = -(345 - 5.6 - FP);
        const HW = 66, HD = HZS - HZN;                 // 66 m along Collins, 81.9 along Swanston
        const HCX = HX + HW / 2, HCZ = (HZS + HZN) / 2;
        const H0 = 5.0;            // top of the bluestone base
        const H1 = 20.4;           // top of the giant order
        const H2 = 23.6;           // top of the cornice
        const H3 = 26.0;           // top of the balustrade
        let g, i;

        // the bluestone base, and the four rusticated courses in it that give
        // it its weight from the far end of the street
        g = boxG(HW + 0.7, H0, HD + 0.7); put(g, HCX, H0 / 2, HCZ); dk.push(g);
        for (i = 0; i < 4; i++) {
            const y = 1.15 + i * 1.05;
            g = boxG(0.16, 0.13, HD + 1.0); put(g, HX - 0.45, y, HCZ); dk.push(g);
            g = boxG(HW + 1.0, 0.13, 0.16); put(g, HCX, y, HZS + 0.45); dk.push(g);
        }

        // the wall behind the order, and the entablature and cornice over it
        g = boxG(HW, H1 - H0, HD); put(g, HCX, (H0 + H1) / 2, HCZ); sand.push(g);
        g = boxG(HW + 1.0, 2.2, HD + 1.0); put(g, HCX, H1 + 1.1, HCZ); sand.push(g);
        g = boxG(HW + 2.3, 1.0, HD + 2.3); put(g, HCX, H1 + 2.7, HCZ); sand.push(g);

        /* The giant order. One column every four and a half metres, standing
           on the bluestone and running the full two storeys to the
           entablature, with a plinth and an abacus and nothing between them —
           at this distance a flute is a wasted triangle and a capital is a
           lie you cannot see. Two elevations only: Swanston and Collins are
           the two anybody in this world will ever look at. */
        const bay = 4.55;
        const column = (x, z, ry) => {
            let q = boxG(1.75, 0.55, 1.75); put(q, x, H0 + 0.28, z, 0, ry, 0); sand.push(q);
            q = cylG(0.62, 0.72, H1 - H0 - 1.3, 10); put(q, x, (H0 + H1) / 2 + 0.1, z); sand.push(q);
            q = boxG(1.65, 0.75, 1.65); put(q, x, H1 - 0.38, z, 0, ry, 0); sand.push(q);
        };
        // the reveal behind a bay: two tiers of window, the lower one arched
        const bayLight = (x, z, ry) => {
            let q = shapeG(archShape(2.5, 5.2)); put(q, x, H0 + 1.4, z, 0, ry, 0); dk.push(q);
            q = new THREE.PlaneGeometry(2.4, 3.6); put(q, x, H0 + 10.2, z, 0, ry, 0); dk.push(q);
        };

        const nW = Math.floor((HD - 6) / bay);
        for (i = 0; i <= nW; i++) {
            const z = HZN + 3 + i * bay + (HD - 6 - nW * bay) / 2;
            column(HX - 0.5, z, 0);
            if (i < nW) bayLight(HX + 0.06, z + bay / 2, -Math.PI / 2);
        }
        const nS = Math.floor((HW - 6) / bay);
        for (i = 0; i <= nS; i++) {
            const x = HX + 3 + i * bay + (HW - 6 - nS * bay) / 2;
            column(x, HZS + 0.5, 0);
            if (i < nS) bayLight(x + bay / 2, HZS - 0.06, 0);
        }

        /* The balustrade, as a rim rather than a lid: a plinth, a row of
           balusters and a coping, on the two elevations that face the city.
           Written as four rails rather than one slab because a slab across
           the footprint is a flat roof, which is the thing the mansard behind
           it exists to not be. */
        for (const r of [[HCX, HZS + 1.15, HW + 2.3, 0.5], [HCX, HZN - 1.15, HW + 2.3, 0.5],
                         [HX - 1.15, HCZ, 0.5, HD + 2.3], [HX + HW + 1.15, HCZ, 0.5, HD + 2.3]]) {
            g = boxG(r[2], 0.4, r[3]); put(g, r[0], H2 + 0.2, r[1]); sand.push(g);
            g = boxG(r[2], 0.35, r[3]); put(g, r[0], H3 - 0.18, r[1]); sand.push(g);
        }
        for (const e of [['z', HZS + 1.15, HX + 1.2, HW - 2.4], ['x', HX - 1.15, HZN + 1.2, HD - 2.4]]) {
            const n = Math.round(e[3] / 2.3);
            for (i = 0; i <= n; i++) {
                const t = e[2] + e[3] * (i / n);
                g = cylG(0.17, 0.21, 1.45, 6);
                put(g, e[0] === 'z' ? t : e[1], H2 + 1.12, e[0] === 'z' ? e[1] : t); sand.push(g);
            }
        }

        /* The mansard, in slate, behind the parapet: four slopes leaning in
           to a flat deck. It reads for about four metres of its height and
           that is all it has to do — it is the difference between a Second
           Empire roof and a parapet with the sky behind it. */
        const MR = 5.2, MIN = 4.2;                     // rise, and how far it leans in
        const mLen = Math.hypot(MIN, MR), mA = Math.atan2(MIN, MR);
        g = boxG(HW - 2 * MIN, 0.6, HD - 2 * MIN); put(g, HCX, H2 + MR, HCZ); dk.push(g);
        g = boxG(0.5, mLen, HD - 1.0); put(g, HX + MIN / 2 + 0.4, H2 + MR / 2, HCZ, 0, 0, -mA); dk.push(g);
        g = boxG(0.5, mLen, HD - 1.0); put(g, HX + HW - MIN / 2 - 0.4, H2 + MR / 2, HCZ, 0, 0, mA); dk.push(g);
        g = boxG(HW - 1.0, mLen, 0.5); put(g, HCX, H2 + MR / 2, HZS - MIN / 2 - 0.4, -mA); dk.push(g);
        g = boxG(HW - 1.0, mLen, 0.5); put(g, HCX, H2 + MR / 2, HZN + MIN / 2 + 0.4, mA); dk.push(g);

        /* --- the portico on Swanston Street: six free-standing columns on a
               bluestone podium, three arches under them, and the pediment
               over. This is the one piece of the building anybody photographs
               and it is the one piece that has to project, because a portico
               flush with its wall is a pilaster. --- */
        {
            const PZ = HCZ + 2, PW = 21.0, PX = HX - 3.2;
            g = boxG(4.0, H0, PW + 2.0); put(g, PX + 1.6, H0 / 2, PZ); dk.push(g);
            for (i = 0; i < 3; i++) {                                  // the steps up off the footpath
                g = boxG(1.2, 0.42, PW - 1.0); put(g, PX - 0.6 - i * 1.2, 0.21 + i * 0.42 - 0.9, PZ); dk.push(g);
            }
            for (i = 0; i < 3; i++) {                                  // the three arches behind the columns
                g = shapeG(archShape(3.4, 4.4));
                put(g, PX + 1.9, 0.5, PZ - 6.4 + i * 6.4, 0, -Math.PI / 2, 0); dk.push(g);
            }
            for (i = 0; i < 6; i++) {
                const z = PZ - PW / 2 + 1.6 + i * ((PW - 3.2) / 5);
                column(PX + 1.0, z, 0);
            }
            g = boxG(4.6, 2.4, PW + 2.4); put(g, PX + 1.5, H1 + 1.2, PZ); sand.push(g);
            g = boxG(5.2, 1.0, PW + 3.4); put(g, PX + 1.4, H1 + 2.9, PZ); sand.push(g);
            // the pediment, its gable turned to face down Swanston Street
            g = prismG(PW + 3.4, 4.4, 4.6); put(g, PX + 1.5, H2 + 0.4, PZ, 0, Math.PI / 2, 0); sand.push(g);
            g = boxG(5.0, 0.4, PW + 4.2); put(g, PX + 1.4, H2 + 0.2, PZ); sand.push(g);
        }

        /* --- the clock tower, on the Collins Street corner. Fifty-one metres
               to the finial, which at this range is the only part of the
               building tall enough to stand above the fog line and the only
               part anybody navigates by. --- */
        {
            const TX = HX + 8.5, TZ = HZS - 8.5;
            const T0 = 30.0, T1 = 39.4, T2 = 40.8;     // shaft, clock stage, cornice
            g = boxG(16.0, T0, 16.0); put(g, TX, T0 / 2, TZ); sand.push(g);
            g = boxG(16.8, H0, 16.8); put(g, TX, H0 / 2, TZ); dk.push(g);
            for (const c of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {   // the corner pilasters
                g = boxG(1.5, T0 - H0, 1.5); put(g, TX + c[0] * 7.4, (H0 + T0) / 2, TZ + c[1] * 7.4); sand.push(g);
            }
            g = boxG(17.6, 1.0, 17.6); put(g, TX, 22.6, TZ); sand.push(g);
            g = boxG(17.4, 1.3, 17.4); put(g, TX, T0 + 0.65, TZ); sand.push(g);

            // the clock stage and its four dials, which are lit — at twenty to
            // five in November rain the Town Hall clock is on, and from the
            // bottom of Swanston Street it is the only thing up here you can
            // actually read
            g = boxG(14.4, T1 - T0 - 1.3, 14.4); put(g, TX, (T0 + 1.3 + T1) / 2, TZ); sand.push(g);
            const dialY = 35.4;
            for (const f of [[0, 0, 7.3], [0, Math.PI, -7.3], [1, Math.PI / 2, 7.3], [1, -Math.PI / 2, -7.3]]) {
                const dx = f[0] ? f[2] : 0, dz = f[0] ? 0 : f[2];
                g = new THREE.CircleGeometry(2.35, 20); put(g, TX + dx * 1.02, dialY, TZ + dz * 1.02, 0, f[1], 0); dk.push(g);
                g = new THREE.CircleGeometry(1.95, 20); put(g, TX + dx * 1.05, dialY, TZ + dz * 1.05, 0, f[1], 0); glow.push(g);
            }
            g = boxG(16.6, 1.4, 16.6); put(g, TX, T1 + 0.7, TZ); sand.push(g);
            g = boxG(15.4, 0.5, 15.4); put(g, TX, T2 + 0.25, TZ); sand.push(g);

            // the mansard cap, the lantern, and the little slate cupola over
            // it. Four radial segments turned a quarter-bay so the flat faces
            // land on the axes rather than the diagonals.
            g = cylG(4.8 / 0.7071, 7.6 / 0.7071, 5.0, 4); put(g, TX, T2 + 3.0, TZ, 0, Math.PI / 4, 0); dk.push(g);
            g = boxG(6.6, 0.4, 6.6); put(g, TX, T2 + 5.6, TZ); sand.push(g);
            g = boxG(5.6, 2.9, 5.6); put(g, TX, T2 + 7.2, TZ); sand.push(g);
            for (const f of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
                g = new THREE.PlaneGeometry(3.0, 1.9);
                put(g, TX + f[0] * 2.9, T2 + 7.3, TZ + f[1] * 2.9, 0, Math.atan2(f[0], f[1]), 0); glow.push(g);
            }
            g = boxG(6.4, 0.45, 6.4); put(g, TX, T2 + 8.85, TZ); sand.push(g);
            g = cylG(0.5 / 0.7071, 3.2 / 0.7071, 2.6, 4); put(g, TX, T2 + 10.4, TZ, 0, Math.PI / 4, 0); dk.push(g);
            g = sphG(0.55, 8, 6); put(g, TX, T2 + 11.9, TZ); sand.push(g);
            g = cylG(0.10, 0.13, 5.4, 6); put(g, TX, T2 + 14.9, TZ); dk.push(g);
        }

        const hall = new THREE.Group();
        hall.add(
            merged(sand, stdMat(0xdccdaf, { roughness: 0.86 })),
            merged(dk, stdMat(0x5d636b, { roughness: 0.74 })),
            /* One emissive level for the dials and the lantern together, and it
               is set by the dials: at 2.2 they clipped to flat white discs a
               hundred metres away and the hands nobody has drawn would not
               have shown anyway. 1.7 keeps them above the 0.80 bloom
               threshold, so from the bottom of Swanston Street they are still
               the two lit things up here — which is the entire job. */
            merged(glow, emissive(0xf4ecd6, 0xffe6ae, 1.7, { side: THREE.DoubleSide, roughness: 0.5 })));
        scene.add(hall);
        world.part('townhall_00', hall);
    }


    /* ============================================================
       21 · City Square, the Westin, and Town Hall Station

       The block directly behind St Paul's — east of Swanston, between
       Flinders Lane and Collins Street. Three generic boxes stood here until
       now, which is what an eighty-metre frontage gets when nobody has looked
       at it. What is actually there is one of the few places in the middle of
       Melbourne where the street opens out instead of closing in:

           · a plaza on the Swanston frontage, at footpath level, in grey
             granite, with a steel canopy over the middle of it;
           · behind the plaza the hotel, a big warm mass that steps back twice
             on its way up and finishes in a run of tall arched bays under a
             curved zinc roof;
           · and in the middle of the plaza, under the canopy, the escalators
             down into Town Hall Station.

       The canopy is the thing worth getting right, because it is the thing you
       stand under. Six columns, each a tapered blade that rises four metres
       and then splits into four branches that lean out and up to meet the
       roof beams — so the roof is carried on six points and reads as six
       trees. Between the beams the deck is a fine grid of slats with solid
       bands of soffit between them, which is what makes the light under there
       striped rather than flat.

       And then down. This section is the only place in this world where the
       ground is not the bottom of the world: the escalators go through a hole
       in the plaza and a hole in the roadway sheet, land in a ticket hall
       twelve and a half metres down, and a second flight goes from there into
       the station cavern at twenty-six. You walk it — the walk's grid keeps
       four vertical spans per cell and this precinct is built to spend three
       of them, so the plaza, the hall and the platform are three floors you
       can be on and the canopy roof is ghosted rather than being a fourth.
       ============================================================ */
    {
        /* ---- the sub-rectangle trick, again: four facades on one sheet, and
                every wall's UVs pointed at the one it wants. ---- */
        const uvRect = (g, u0, v0, u1, v1) => {
            const uv = g.attributes.uv;
            for (let i = 0; i < uv.count; i++) {
                uv.setXY(i, u0 + uv.getX(i) * (u1 - u0), v0 + uv.getY(i) * (v1 - v0));
            }
            return g;
        };

        /* An inclined slab, along z or along x. Every escalator, every stair
           and every landing in this section is one of these, and the angle is
           read off the two ends rather than typed — because the two ends are
           what has to meet the floors above and below them, and an escalator
           that arrives half a metre under its landing is a hole. */
        const rampZ = (w, t, z0, y0, z1, y1, x, arr) => {
            const L = Math.hypot(z1 - z0, y1 - y0);
            const g = boxG(w, t, L);
            put(g, x, (y0 + y1) / 2, (z0 + z1) / 2, -Math.atan2(y1 - y0, z1 - z0), 0, 0);
            if (arr) arr.push(g);
            return g;
        };
        const rampX = (d, t, x0, y0, x1, y1, z, arr) => {
            const L = Math.hypot(x1 - x0, y1 - y0);
            const g = boxG(L, t, d);
            put(g, (x0 + x1) / 2, (y0 + y1) / 2, z, 0, 0, Math.atan2(y1 - y0, x1 - x0));
            if (arr) arr.push(g);
            return g;
        };

        /* A profile in (x, y), extruded along z. The vault, the arched bays and
           the canopy's tapered blades are all one of these — an extrusion
           closes its own ends, which two tilted slabs never do. */
        const profileG = (pts, depth) => {
            const s = new THREE.Shape();
            s.moveTo(pts[0][0], pts[0][1]);
            for (let i = 1; i < pts.length; i++) s.lineTo(pts[i][0], pts[i][1]);
            s.closePath();
            // Absolute, because half the depths in this section are measured
            // northwards and come out negative — and a negative extrusion is a
            // solid turned inside out, which lights as a hole.
            const d = Math.abs(depth);
            const g = new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: false });
            g.translate(0, 0, -d / 2);
            return g;
        };

        /* ------------------------------------------------------------
           21a · textures
           ------------------------------------------------------------ */

        // The plaza's granite. Big sawn flags with a fine dark joint, a run of
        // narrow setts where the paving changes direction, and enough tonal
        // drift between flags that the field does not read as one grey sheet.
        const paveSq = tex(1024, 1024, (g, W, H) => {
            g.fillStyle = '#6e6e6d'; g.fillRect(0, 0, W, H);
            const cols = 8, rows = 8, cw = W / cols, ch = H / rows;
            for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
                const n = Math.sin((c * 31.7 + r * 12.3) * 43758.5453);
                const t = n - Math.floor(n);
                const v = 96 + Math.floor(t * 34);
                g.fillStyle = `rgb(${v},${v},${v - 2})`;
                g.fillRect(c * cw + 1.2, r * ch + 1.2, cw - 2.4, ch - 2.4);
                // the sawn face: a faint diagonal grain, and a wet sheen at one corner
                g.fillStyle = `rgba(255,255,255,${0.02 + t * 0.03})`;
                g.fillRect(c * cw + 1.2, r * ch + 1.2, cw - 2.4, ch * 0.22);
                g.fillStyle = 'rgba(0,0,0,0.10)';
                g.fillRect(c * cw + 1.2, r * ch + ch - 4.4, cw - 2.4, 3.2);
            }
            // the grit in it, and the odd stain
            for (let i = 0; i < 5200; i++) {
                g.fillStyle = `rgba(${Math.random() < 0.5 ? '58,58,56' : '178,177,172'},${Math.random() * 0.12})`;
                g.fillRect(Math.random() * W, Math.random() * H, 1.6, 1.6);
            }
            for (let i = 0; i < 26; i++) {
                const x = Math.random() * W, y = Math.random() * H, r = 22 + Math.random() * 70;
                const rg = g.createRadialGradient(x, y, 0, x, y, r);
                rg.addColorStop(0, 'rgba(52,53,55,0.13)'); rg.addColorStop(1, 'rgba(52,53,55,0)');
                g.fillStyle = rg; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
            }
        }, 1, 1);
        paveSq.wrapS = paveSq.wrapT = THREE.RepeatWrapping;

        // Dark bronze battens — the entrance box, the screen wall behind the
        // steps, the lift core. Vertical fins with a shadow gap between them,
        // which is the whole of what that cladding is.
        const battenTex = tex(512, 512, (g, W, H) => {
            g.fillStyle = '#39332b'; g.fillRect(0, 0, W, H);
            const n = 26, p = W / n;
            for (let i = 0; i < n; i++) {
                const t = (Math.sin(i * 78.233) * 43758.5453) % 1;
                const v = 118 + Math.abs(t) * 44;
                g.fillStyle = `rgb(${Math.floor(v)},${Math.floor(v * 0.86)},${Math.floor(v * 0.68)})`;
                g.fillRect(i * p + p * 0.16, 0, p * 0.56, H);
                g.fillStyle = 'rgba(255,238,205,0.16)';
                g.fillRect(i * p + p * 0.16, 0, p * 0.13, H);
                g.fillStyle = 'rgba(0,0,0,0.55)';
                g.fillRect(i * p + p * 0.70, 0, p * 0.10, H);
            }
        }, 1, 1);
        battenTex.wrapS = battenTex.wrapT = THREE.RepeatWrapping;

        /* The frontage's own signs, all of them on one sheet: eight shop
           fascias, the theatre's blade and its marquee, a poster case, the
           billboard, and two plain fields for the light inside a shop. Drawn
           twice, the second time as the emissive map, because at twenty to
           five on a wet afternoon a shopfront is the brightest thing at
           street level and its sign is the brightest thing on it. */
        const SHOP = {
            cup:    [0.000, 0.000, 0.250, 0.095],
            news:   [0.250, 0.000, 0.500, 0.095],
            chem:   [0.500, 0.000, 0.750, 0.095],
            dior:   [0.750, 0.000, 1.000, 0.095],
            westin: [0.000, 0.100, 0.350, 0.195],
            optic:  [0.350, 0.100, 0.600, 0.195],
            bergen: [0.600, 0.100, 0.850, 0.195],
            regent: [0.850, 0.100, 1.000, 0.195],
            blade:  [0.000, 0.205, 0.075, 0.620],
            bulbs:  [0.090, 0.205, 1.000, 0.250],
            poster: [0.090, 0.270, 0.290, 0.620],
            bill:   [0.310, 0.270, 1.000, 0.620],
            boss:   [0.000, 0.635, 0.250, 0.720],
            coco:   [0.250, 0.635, 0.500, 0.720],
            sbux:   [0.500, 0.635, 0.750, 0.720],
            noodle: [0.750, 0.635, 1.000, 0.720],
            wales:   [0.000, 0.728, 0.320, 0.800],
            maccas:  [0.330, 0.728, 0.560, 0.800],
            parking: [0.570, 0.728, 0.780, 0.800],
            stpaul:  [0.800, 0.728, 0.870, 0.982],
            warm:   [0.020, 0.815, 0.470, 0.975],
            cool:   [0.490, 0.815, 0.780, 0.975],
        };
        const shopSheet = (emis) => tex(2048, 2048, (g, W, H) => {
            const R = (k) => [SHOP[k][0] * W, SHOP[k][1] * H, (SHOP[k][2] - SHOP[k][0]) * W,
                              (SHOP[k][3] - SHOP[k][1]) * H];
            g.fillStyle = emis ? '#000' : '#191b1d'; g.fillRect(0, 0, W, H);

            // a fascia board: a field, a rule under it, and the name on it
            const fascia = (k, name, ink, field, size, sub) => {
                const [x, y, w, h] = R(k);
                g.fillStyle = emis ? '#000' : field;
                g.fillRect(x, y, w, h);
                if (emis) { g.fillStyle = field; g.globalAlpha = 0.16; g.fillRect(x, y, w, h); g.globalAlpha = 1; }
                g.fillStyle = ink;
                g.textAlign = 'center'; g.textBaseline = 'middle';
                g.font = `600 ${size}px "Helvetica Neue", Helvetica, Arial, sans-serif`;
                g.fillText(name, x + w / 2, y + h * (sub ? 0.40 : 0.52));
                if (sub) {
                    g.font = `300 ${size * 0.34}px "Helvetica Neue", Helvetica, Arial, sans-serif`;
                    g.fillText(sub, x + w / 2, y + h * 0.74);
                }
                g.fillStyle = ink; g.globalAlpha = emis ? 0.5 : 0.28;
                g.fillRect(x + w * 0.06, y + h * 0.90, w * 0.88, 3);
                g.globalAlpha = 1;
            };
            fascia('cup',    'Little Cup',       '#f4e6cc', '#2f4038', 74, 'coffee · all day');
            fascia('news',   'CITY NEWS',        '#fff2c8', '#7a2b22', 72, 'tobacco · lotto · maps');
            fascia('chem',   'COLLINS CHEMIST',  '#eafff0', '#14513a', 56, 'dispensary open till 9');
            fascia('dior',   'DIOR',             '#f6f2ea', '#101012', 128);
            fascia('westin', 'THE WESTIN',       '#f0e2bd', '#1b232b', 78, 'MELBOURNE');
            fascia('optic',  'NEU OPTICAL',      '#e8f2ff', '#1d3550', 62, 'eyes tested here');
            fascia('bergen', 'BERGEN & CO',      '#ffeec2', '#2a1f16', 58, 'jewellers since 1911');
            fascia('regent', 'REGENT',           '#fff3d2', '#7d1f1a', 84);
            fascia('boss',   'BOSS',             '#f2f0ec', '#141416', 96);
            fascia('coco',   'COCO BLACK',       '#f6e9d2', '#2b1a12', 62, 'chocolate · since 2008');
            fascia('sbux',   'STARBUCKS',        '#e8f6ec', '#0d5c3f', 60, 'coffee');
            fascia('noodle', 'HOT POT & NOODLE', '#fff0d0', '#9a1f1a', 50, 'open till late');
            fascia('wales',  'Wales Corner',      '#f4f2ee', '#101114', 62);
            fascia('maccas', "McDonald's",        '#ffd23a', '#2a1a10', 58);
            fascia('parking','PARKING',           '#eaf2ff', '#17497e', 70, '↙  entry');
            // the sign up the flank, read from the bottom of it upward
            {
                const [x, y, w, h] = R('stpaul');
                g.fillStyle = emis ? '#0f3b2a' : '#0c2b20'; g.fillRect(x, y, w, h);
                g.fillStyle = emis ? '#f6e9c0' : '#cbbe98';
                g.textAlign = 'center'; g.textBaseline = 'middle';
                const word = 'ST PAUL';
                for (let i = 0; i < word.length; i++) {
                    g.font = `700 ${w * 0.56}px "Helvetica Neue", Helvetica, Arial, sans-serif`;
                    g.fillText(word[i], x + w / 2, y + h * (i + 0.62) / word.length);
                }
                for (let i = 0; i < 18; i++) {
                    g.fillStyle = emis ? '#ffe9b4' : '#c3b184';
                    g.beginPath(); g.arc(x + w * 0.11, y + h * (i + 0.5) / 18, w * 0.05, 0, 7); g.fill();
                    g.beginPath(); g.arc(x + w * 0.89, y + h * (i + 0.5) / 18, w * 0.05, 0, 7); g.fill();
                }
            }

            // the theatre's blade, read from the bottom up
            {
                const [x, y, w, h] = R('blade');
                g.fillStyle = emis ? '#c8241c' : '#7d1f1a'; g.fillRect(x, y, w, h);
                g.fillStyle = emis ? '#fff6de' : '#f0dcae';
                g.textAlign = 'center'; g.textBaseline = 'middle';
                const word = 'REGENT';
                for (let i = 0; i < word.length; i++) {
                    g.font = `700 ${w * 0.62}px "Helvetica Neue", Helvetica, Arial, sans-serif`;
                    g.fillText(word[i], x + w / 2, y + h * (i + 0.62) / word.length);
                }
                // the lamp studs down both edges
                for (let i = 0; i < 22; i++) {
                    const yy = y + h * (i + 0.5) / 22;
                    g.fillStyle = emis ? '#ffe9b4' : '#d8c58e';
                    g.beginPath(); g.arc(x + w * 0.10, yy, w * 0.055, 0, 7); g.fill();
                    g.beginPath(); g.arc(x + w * 0.90, yy, w * 0.055, 0, 7); g.fill();
                }
            }
            // the bulb band that runs round the edge of the marquee
            {
                const [x, y, w, h] = R('bulbs');
                g.fillStyle = emis ? '#000' : '#2b1d18'; g.fillRect(x, y, w, h);
                for (let i = 0; i < 96; i++) {
                    g.fillStyle = emis
                        ? ['#fff0c4', '#ffe08a', '#fff6dd'][i % 3]
                        : '#c9b283';
                    g.beginPath(); g.arc(x + w * (i + 0.5) / 96, y + h * 0.5, h * 0.30, 0, 7); g.fill();
                }
            }
            // a poster case beside the doors — a show nobody has heard of,
            // which is the honest thing to put in one
            {
                const [x, y, w, h] = R('poster');
                g.fillStyle = emis ? '#3a2a44' : '#2a1f30'; g.fillRect(x, y, w, h);
                const rg = g.createLinearGradient(x, y, x, y + h);
                rg.addColorStop(0, emis ? 'rgba(255,196,120,0.9)' : 'rgba(150,110,70,0.7)');
                rg.addColorStop(1, emis ? 'rgba(60,30,90,0.2)' : 'rgba(30,18,45,0.2)');
                g.fillStyle = rg; g.fillRect(x + w * 0.06, y + h * 0.06, w * 0.88, h * 0.88);
                g.fillStyle = emis ? '#fff4dc' : '#e2d2b4';
                g.textAlign = 'center'; g.textBaseline = 'middle';
                g.font = `700 ${w * 0.15}px "Helvetica Neue", Helvetica, Arial, sans-serif`;
                g.fillText('THE', x + w / 2, y + h * 0.56);
                g.fillText('LONG', x + w / 2, y + h * 0.68);
                g.fillText('CALL', x + w / 2, y + h * 0.80);
                g.font = `300 ${w * 0.062}px "Helvetica Neue", Helvetica, Arial, sans-serif`;
                g.fillText('a new musical · from 7 August', x + w / 2, y + h * 0.90);
            }
            // and the billboard on the flank wall, which in the photograph is
            // a show poster the size of a house
            {
                const [x, y, w, h] = R('bill');
                g.fillStyle = emis ? '#e8c98e' : '#c2a877'; g.fillRect(x, y, w, h);
                g.fillStyle = emis ? '#f6e6bf' : '#d8c49a';
                g.fillRect(x + w * 0.02, y + h * 0.03, w * 0.96, h * 0.94);
                g.fillStyle = emis ? '#8e1f1a' : '#6d1c17';
                g.textAlign = 'left'; g.textBaseline = 'middle';
                g.font = `800 ${h * 0.115}px "Helvetica Neue", Helvetica, Arial, sans-serif`;
                g.fillText('THE MUSICAL', x + w * 0.06, y + h * 0.30);
                g.fillText('YOU ALREADY', x + w * 0.06, y + h * 0.46);
                g.fillText('KNOW EVERY', x + w * 0.06, y + h * 0.62);
                g.fillText('WORD OF', x + w * 0.06, y + h * 0.78);
                g.fillStyle = emis ? '#2a2118' : '#3a2f22';
                g.font = `300 ${h * 0.055}px "Helvetica Neue", Helvetica, Arial, sans-serif`;
                g.fillText('REGENT THEATRE  ·  NOW BOOKING', x + w * 0.06, y + h * 0.90);
                // the flood lamps along the top of the frame
                for (let i = 0; i < 5; i++) {
                    g.fillStyle = emis ? '#fff2cf' : '#9a9186';
                    g.fillRect(x + w * (0.10 + i * 0.2), y + h * 0.005, w * 0.06, h * 0.02);
                }
            }
            // the two plain fields a lit interior points at
            {
                let [x, y, w, h] = R('warm');
                g.fillStyle = emis ? '#ffe6bb' : '#c9b795'; g.fillRect(x, y, w, h);
                [x, y, w, h] = R('cool');
                g.fillStyle = emis ? '#eef4fb' : '#b6bfc8'; g.fillRect(x, y, w, h);
            }
        });

        /* The signage. One sheet for every lit sign in the precinct, laid out
           in four quarters, so a hotel fascia, a station totem, a platform
           number and a train's destination are one emissive material and one
           draw. Drawn white-on-blue in the PTV manner because that is what is
           on the box in the plaza, and read as an emissive map so the sign is
           the same sign in the rain and on the platform. */
        const SIGN = {
            townhall: [0.00, 0.00, 0.50, 0.25],
            collins:  [0.50, 0.00, 1.00, 0.25],
            platform: [0.00, 0.25, 0.50, 0.50],
            metro:    [0.50, 0.25, 1.00, 0.50],
            strip:    [0.00, 0.50, 1.00, 0.62],
            blank:    [0.02, 0.66, 0.48, 0.98],
            warm:     [0.52, 0.66, 0.98, 0.98],
        };
        const signSheet = (emis) => tex(2048, 1024, (g, W, H) => {
            const R = (k) => [SIGN[k][0] * W, SIGN[k][1] * H, (SIGN[k][2] - SIGN[k][0]) * W, (SIGN[k][3] - SIGN[k][1]) * H];
            g.fillStyle = emis ? '#000' : '#11151b'; g.fillRect(0, 0, W, H);

            const blueBox = (k, lines, sizes) => {
                const [x, y, w, h] = R(k);
                g.fillStyle = emis ? '#1b3f7a' : '#16305c';
                g.fillRect(x + 4, y + 4, w - 8, h - 8);
                g.fillStyle = emis ? '#ffffff' : '#e8eef6';
                g.textAlign = 'center'; g.textBaseline = 'middle';
                lines.forEach((t, i) => {
                    g.font = `700 ${sizes[i]}px "Helvetica Neue", Helvetica, Arial, sans-serif`;
                    g.fillText(t, x + w / 2, y + h * (i + 0.5) / lines.length);
                });
            };
            // the totem over the escalators, and the wayfinding beside it
            blueBox('townhall', ['TOWN HALL', 'STATION'], [128, 128]);
            blueBox('collins', ['Collins Street', '↓  Platforms  ·  Lifts'], [86, 62]);
            blueBox('platform', ['Platform 1', 'Sunbury  ·  Watergardens'], [96, 58]);

            // the roundel — the one thing on the box that is not words
            {
                const [x, y, w, h] = R('metro');
                g.fillStyle = emis ? '#1b3f7a' : '#16305c'; g.fillRect(x + 4, y + 4, w - 8, h - 8);
                const cx = x + w * 0.30, cy = y + h * 0.5, r = h * 0.30;
                g.strokeStyle = emis ? '#ffffff' : '#e8eef6'; g.lineWidth = r * 0.30;
                g.beginPath(); g.arc(cx, cy, r, 0, 7); g.stroke();
                g.fillStyle = emis ? '#ffffff' : '#e8eef6';
                g.fillRect(cx - r * 1.32, cy - r * 0.20, r * 2.64, r * 0.40);
                g.textAlign = 'left'; g.textBaseline = 'middle';
                g.font = `600 ${h * 0.24}px "Helvetica Neue", Helvetica, Arial, sans-serif`;
                g.fillText('Metro Tunnel', x + w * 0.54, cy);
            }
            // a plain lit strip, for coves and light lines
            {
                const [x, y, w, h] = R('strip');
                g.fillStyle = emis ? '#eef4ff' : '#cfd8e2'; g.fillRect(x, y + h * 0.18, w, h * 0.64);
            }
            // and the two flat fields the light panels point at
            {
                let [x, y, w, h] = R('blank');
                g.fillStyle = emis ? '#e9f1fb' : '#b9c2cc'; g.fillRect(x, y, w, h);
                [x, y, w, h] = R('warm');
                g.fillStyle = emis ? '#ffe3b8' : '#cbbb9e'; g.fillRect(x, y, w, h);
            }
        });

        const signMap = signSheet(false), signEmis = signSheet(true);
        const shopMap = shopSheet(false), shopEmis = shopSheet(true);

        /* ------------------------------------------------------------
           21b · materials — nine, and every one of them wet
           ------------------------------------------------------------ */
        const wet = (m) => {                       // the same grade section 6 gives MATS
            const c = m.color;
            const lum = c.r * 0.30 + c.g * 0.59 + c.b * 0.11;
            c.setRGB(lerp(c.r, lum, 0.34) * 0.80, lerp(c.g, lum, 0.34) * 0.80, lerp(c.b, lum, 0.30) * 0.84);
            m.roughness = Math.max(0.06, m.roughness * 0.78);
            m.metalness = Math.min(0.80, m.metalness + 0.14);
            return m;
        };
        const M21 = {
            pave:   wet(stdMat(0xffffff, { map: paveSq, roughness: 0.36, metalness: 0.18 })),
            /* One material for every building on the frontage. The colour
               comes off the geometry, so six buildings in six different
               stones are six draws and not sixty. */
            body:   new THREE.MeshStandardMaterial({
                        vertexColors: true, roughness: 0.76, metalness: 0.06,
                    }),
            zinc:   wet(stdMat(0x9aa0a4, { roughness: 0.40, metalness: 0.42 })),
            /* Not run through `wet`, and not metallic, which is the same
               decision said twice. `wet` adds fourteen points of metalness to
               everything it grades, and a metallic MeshStandardMaterial in a
               world with no environment map has nothing to reflect: its
               diffuse is scaled away and its specular finds no sky, so it
               renders black wherever no light falls square on it. The canopy
               is painted steel and the escalator treads are cleated aluminium
               — both matte, both of them things you are standing under or on,
               and both of them were coming out as holes. */
            steel:  stdMat(0xdedcd5, { roughness: 0.55, metalness: 0.04 }),      // canopy, treads, screens
            /* The soffit is its own material and not the columns' because it
               is a downward face under an overcast sky: everything that lights
               this world comes from above, so the underside of the canopy —
               which is the whole of what somebody standing in the square looks
               at — went to the grey of a surface facing away from all of it.
               A little emissive is the bounce that a forward renderer with no
               global illumination will not give it. */
            soffit: stdMat(0xd8d6cf, {
                        emissive: 0x9fa4a8, emissiveIntensity: 0.34,
                        roughness: 0.52, metalness: 0.16,
                    }),
            batten: wet(stdMat(0xffffff, { map: battenTex, roughness: 0.52, metalness: 0.34 })),
            bronze: stdMat(0xa8834a, { roughness: 0.34, metalness: 0.30 }),
            // the balustrade rail, lit along its length the way an escalator's
            // is — and the only thing that makes the shaft read as somewhere to
            // go rather than a hole in the paving
            rail:   stdMat(0xb08a4e, {
                        emissive: 0xffdaa4, emissiveIntensity: 1.15,
                        roughness: 0.30, metalness: 0.25,
                    }),
            /* Barely there, on purpose. A shopfront is worth building an
               interior behind only if you can see the interior: at four
               tenths this glass was a dark mirror and every room behind it a
               black hole, which is the whole of what a shop looks like when
               nobody has built one. */
            glass:  stdMat(0x5d7d8c, {
                        roughness: 0.08, metalness: 0.10,
                        transparent: true, opacity: 0.19,
                    }),
            /* Emissive concrete, which sounds wrong and is the only honest
               way to light a cavern in this world. The four real-time lights
               are all spent above ground and a forward renderer gives a room
               no bounce: under a hemisphere light the inside of a vault faces
               away from every source there is, so the ceiling of the station
               went black while its floor read fine. A third of a stop of
               emissive across the concrete is the uplighting that is actually
               up there, at the price of no light at all. */
            crete:  wet(stdMat(0xa9a6a0, {
                        emissive: 0x8d949b, emissiveIntensity: 0.46,
                        roughness: 0.70, metalness: 0.04,
                    })),
            tact:   wet(stdMat(0xe8c033, { roughness: 0.78, metalness: 0.02 })),
            /* The frontage's lit things — a fascia, a blade, a marquee lamp,
               the light on a shop's back wall. Emissive on its own map, so a
               shop is bright in the rain without costing a light. */
            lit:    stdMat(0xffffff, {
                        map: shopMap, emissive: 0xffffff, emissiveMap: shopEmis,
                        emissiveIntensity: 1.55, roughness: 0.40,
                    }),
            sign:   stdMat(0xffffff, {
                        map: signMap, emissive: 0xffffff, emissiveMap: signEmis,
                        emissiveIntensity: 1.35, roughness: 0.32,
                    }),
        };
        /* Canvas y counts down from the top and uv v counts up from the
           bottom, and three uploads a CanvasTexture flipped so the two meet:
           canvas y = 0 is v = 1. The atlas above is laid out in canvas
           fractions, so every rect out of it has to be turned over on the way
           into uv — without which every sign in this precinct showed whatever
           happened to be drawn in the mirror-image quarter of the sheet, and
           the one over the escalators came out a blank white lightbox. */
        const sgn = (g, k) => uvRect(g, SIGN[k][0] + 0.002, 1 - SIGN[k][3] + 0.004,
                                        SIGN[k][2] - 0.002, 1 - SIGN[k][1] - 0.004);
        const shp = (g, k) => uvRect(g, SHOP[k][0] + 0.001, 1 - SHOP[k][3] + 0.002,
                                        SHOP[k][2] - 0.001, 1 - SHOP[k][1] - 0.002);

        /* Every surface in the precinct accumulates into one of these and is
           merged once at the end of the section, so eighty metres of frontage,
           a canopy, a plaza and a whole station underneath it cost fourteen
           draws between them. */
        /* ---- colour in the vertices ----

           Everything from here to the end of the frontage is built rather
           than painted: there is no facade texture in this section any more.
           A wall is piers and spandrels with a pane at the back of every
           opening, a cornice is three courses, a balcony is a slab with a
           rail on it — and the stone, the reveal, the spandrel and the glass
           are told apart by a colour attribute on the merged geometry rather
           than by a rectangle of canvas. Which is why a whole building comes
           out as one draw and still has relief you can walk up to.

           The tones go through the same wet grade section 6 gives every
           material in this world, once, and are cached — a facade asks for the
           same six colours a thousand times. */
        const _tone = new Map();
        const TONE = (hex) => {
            let c = _tone.get(hex);
            if (c) return c;
            c = srgb(hex);
            const lum = c.r * 0.30 + c.g * 0.59 + c.b * 0.11;
            c.setRGB(lerp(c.r, lum, 0.34) * 0.80, lerp(c.g, lum, 0.34) * 0.80, lerp(c.b, lum, 0.30) * 0.84);
            _tone.set(hex, c);
            return c;
        };
        const paint = (g, hex) => {
            const c = TONE(hex), n = g.attributes.position.count, a = new Float32Array(n * 3);
            for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
            g.setAttribute('color', new THREE.BufferAttribute(a, 3));
            return g;
        };
        /* A pane, graded up its own height. Under this sky a window is not a
           colour, it is the cloud reflected in it: pale at the head where it
           takes the sky, nearly black at the sill where it takes the building
           opposite. One attribute doing what a reflection probe would, for
           nothing — and it is most of what makes a wall of windows read as
           glass rather than as dark paint. */
        const pane = (g, lo, hi, y0, y1) => {
            const p = g.attributes.position, n = p.count, a = new Float32Array(n * 3);
            const c0 = TONE(lo), c1 = TONE(hi);
            for (let i = 0; i < n; i++) {
                const t = smoothstep(y0, y1, p.getY(i));
                a[i * 3] = lerp(c0.r, c1.r, t);
                a[i * 3 + 1] = lerp(c0.g, c1.g, t);
                a[i * 3 + 2] = lerp(c0.b, c1.b, t);
            }
            g.setAttribute('color', new THREE.BufferAttribute(a, 3));
            return g;
        };
        // a box from two corners, painted, filed. The workhorse of the whole
        // frontage: every pier, sill, bracket, tread and mullion below is one.
        const F = (arr, hex, x0, y0, z0, x1, y1, z1) => {
            const g = boxG(Math.abs(x1 - x0), Math.abs(y1 - y0), Math.abs(z1 - z0));
            put(g, (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
            arr.push(paint(g, hex));
            return g;
        };
        // the same, but glazed
        const W = (arr, x0, y0, z0, x1, y1, z1, lo, hi) => {
            const g = boxG(Math.abs(x1 - x0), Math.abs(y1 - y0), Math.abs(z1 - z0));
            put(g, (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
            arr.push(pane(g, lo || CF.glassLo, hi || CF.glassHi, Math.min(y0, y1), Math.max(y0, y1)));
            return g;
        };
        // and a painted piece of anything that is not a box
        const FG = (arr, hex, g) => { arr.push(paint(g, hex)); return g; };

        /* The frontage's palette, read off the photograph: warm precast on the
           hotel, a paler stucco on the theatre, dark bronze in every reveal,
           and the two ends of what a pane does between its sill and its head. */
        const CF = {
            stone:    0xd9c7a6, stoneHi: 0xeadcc0, stoneLo: 0xb0997a,
            spandrel: 0x4b463d, reveal:  0x33312c, mullion: 0x2a2a27,
            glassLo:  0x232c35, glassHi: 0x7d95a4,
            zinc:     0x939ba1, zincLo:  0x676e75,
            cream:    0xe7dabd, creamHi: 0xf6eeda, creamLo: 0xbfae8c,
            brickRed: 0x9d6a50, theatre: 0x8f2a22,
            granite:  0x33342f, bronze:  0x6a5330, gold: 0xbe9c58,
            leaf:     0x40592c, trunk:   0x4b4237,
            towerLo:  0x9fa3a4, towerHi: 0xc9c6bd, towerBand: 0x2f363e,
        };

        /* Every surface accumulates into one of these and is merged once at
           the end of the section. Grouped by what it is part of rather than
           only by what it is made of, because a part is a thing somebody picks
           up in edit mode: `westin_00` has to be the hotel — its precast, its
           zinc roof, its balcony glass and its handrails — and not a bucket of
           every pale surface in the precinct. Three groups come out of this,
           the same shape `cathedral_00` and `fedsquare_00` already have. */
        const P = {
            /* One array per building along the frontage, because one array per
               building is one mesh per building — the colour is in the
               vertices rather than in a map, so a wall, the reveal behind it,
               the spandrel under it and the pane in it are four numbers on the
               same merged geometry. */
            // the hotel behind the square: its stone, its glass, its lit things
            b2: [], b2g: [], b2l: [],
            // the west side of Swanston, opposite the Town Hall
            m2: [], m3: [],
            // and the block opposite City Square
            w1: [], w2: [],
            // the shops under them, and the light inside the shops
            shop: [], shopGlass: [], shopLit: [],
            // the square: the canopy, the entrance box, the paving furniture
            qSteel: [], qRoof: [], qClad: [], qGlass: [], qTrim: [], qSign: [],
            // the station, from the top of the escalators down
            sCrete: [], sSteel: [], sClad: [], sGlass: [], sTrim: [], sSign: [], sTact: [],
            // and the inclined balustrades, which are ghosted — see 21f
            gGlass: [], gTrim: [],
        };

        /* A box from two opposite corners rather than from a centre and three
           sizes, because everything in this precinct is measured off a street
           line or a floor level and never off its own middle. Written to take
           its corners in any order: north is −z here, so half the depths in
           this section count downwards and a signed width is a box turned
           inside out. */
        const bx3 = (arr, _k, x0, y0, z0, x1, y1, z1) => {
            const g = boxG(Math.abs(x1 - x0), Math.abs(y1 - y0), Math.abs(z1 - z0));
            put(g, (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
            // The batten cladding is a tiling sheet rather than an atlas, so
            // its repeat has to be baked per piece the way the band course on
            // the cathedral is: 2.6 m of wall is one sheet, which makes a
            // batten a hundred millimetres wide on a jamb and on a screen.
            if (arr === P.qClad || arr === P.sClad) {
                uvScale(g, Math.max(0.5, Math.abs(x1 - x0), Math.abs(z1 - z0)) / 2.6,
                           Math.max(0.5, Math.abs(y1 - y0)) / 2.6);
            }
            arr.push(g);
            return g;
        };

        /* ------------------------------------------------------------
           21c · the plaza

           One sheet of granite with a hole in it. The hole is the station:
           `ground.js` gives each cell four vertical spans and fills every
           triangle it is handed, so a plaza drawn as a solid rectangle is a
           lid over the escalators however carefully the escalators are
           modelled underneath it. Extruded from a shape with a hole in it
           instead — which is also, as it happens, what the real slab is.
           ------------------------------------------------------------ */
        {
            const rect = (path, x0, z0, x1, z1) => {
                // Shape space is (x, −z): ExtrudeGeometry lies in xy and the
                // whole thing is turned a quarter turn about x to lie down.
                [[x0, z0], [x1, z0], [x1, z1], [x0, z1]].forEach((p, i) => {
                    i ? path.lineTo(p[0], -p[1]) : path.moveTo(p[0], -p[1]);
                });
                path.closePath();
            };
            const shape = new THREE.Shape();
            rect(shape, SQ.X0, SQ.Z0, SQ.X1, SQ.Z1);
            const hole = new THREE.Path();
            rect(hole, SQ.VX0, SQ.VZ0, SQ.VX1, SQ.VZ1);
            shape.holes.push(hole);

            const g = new THREE.ExtrudeGeometry(shape, { depth: 0.34, bevelEnabled: false });
            g.rotateX(-Math.PI / 2);
            g.translate(0, SQ.DECK - 0.34, 0);
            // Extrude hands back uv in metres, which is what a paving texture
            // wants: one tile is one 4.8 m field of flags however big the slab.
            M21.pave.map.repeat.set(1 / 4.8, 1 / 4.8);
            const plaza = mesh(g, M21.pave);
            plaza.receiveShadow = true;
            scene.add(plaza);
            world.ground(plaza);
        }

        /* ------------------------------------------------------------
           21d · the frontage — six buildings, and not one of them a box

           What stood here was a stack of prisms with a four-panel facade
           sheet wrapped round it, the same sheet from Flinders Lane to
           Collins. That is a painting of a block, not a block: from the
           square you are looking at half a dozen buildings of different ages
           standing shoulder to shoulder, and the only reason a street wall is
           worth walking along is that they do not match.

           So there is no facade texture in this section. Every window is an
           opening with a sill under it, a reveal round it and a pane at the
           back of it. Every balcony is a slab with a rail on it. Every cornice
           is courses, with brackets between them where the photograph shows
           brackets. The arcade at the top of the hotel is seven arches on
           fourteen piers with a loggia behind each one. And the shops below
           are built one at a time — their own frames, their own doors, their
           own lit ceilings and their own things in the window.

           XW is the building line: 49 metres east of the middle of Swanston
           Street, and the west face of everything on this block.
           ------------------------------------------------------------ */
        const XW = SQ.BX0;

        /* ------------------------------------------------------------
           21d · the hotel behind the square

           Built again, and the second time around the shape came first.

           The building that was here before was a rectangular box with a row
           of small round arches sitting on its parapet, which is a thing you
           could draw from a written description and is not this building at
           all. What is actually on this site is one continuous curved mass:
           the wall rises flat for six floors, then a giant arcade of pale
           metal ribs stands on it — ribs a storey wide that run up thirteen
           metres and then bend over to meet the rib beside them — and behind
           those arches the whole top of the building rolls back in a quarter
           of a circle of standing-seam zinc with the top floors punched into
           the curve. The curve is not a detail on this building, it is the
           building, and every sill and course spent on the wrong silhouette
           was wasted.

           Bottom to top, then: a stone podium with the shops in it, six
           floors of warm precast with a French door and a railing in every
           bay, eleven arched bays with a four-storey loggia behind each, the
           zinc shoulder rolling back over them, and — at the Collins Street
           end, where the photograph shows trees growing out of the roof —
           four terraces stepping down and back with gardens on them.
           ------------------------------------------------------------ */
        {
            const A = P.b2, GB = P.b2g, LB = P.b2l;
            const XW = SQ.BX0, XE = SQ.BX1;                  // 49 to 88
            const ZS = SQ.BZ0, ZN = SQ.BZ1, ZT = ZN;         // Flinders Lane to Collins Street
            const D = 0.40, XC = XW + D;

            const Y_SHOP = 5.60, Y_POD = 8.60;
            const FH = 3.72, FLOORS = 5, Y_MID = Y_POD + FH * FLOORS;   // 27.20
            const Y_SPR = Y_MID + 13.60;                                // 40.80, the springing
            const NB = 11, BW = (ZS - ZN) / NB, RIB = 1.30;             // eleven wide bays
            const AR = (BW - RIB) / 2;                                  // the arch's radius
            const Y_CRN = Y_SPR + AR;                                   // its crown
            const XL = XW + 2.30;                                       // the back of a loggia
            const RSH = 6.10, XSH = XW + RSH;                           // the rolled cap's centre
            const Y_ROOF = Y_CRN + RSH;                                 // the flat roof behind it

            /* Painted even though the glass material never reads the colour:
               `mergeGeometries` answers null the moment one array mixes
               geometry that has a colour attribute with geometry that has
               not, and a null geometry is a mesh that takes the viewport down
               with it. The shopfront glass and the balcony glass share an
               array, so they have to share an attribute set. */
            const glassy = (arr, x0, y0, z0, x1, y1, z1) => {
                const g = boxG(Math.abs(x1 - x0), Math.abs(y1 - y0), Math.abs(z1 - z0));
                put(g, (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
                arr.push(pane(g, CF.glassLo, CF.glassHi, Math.min(y0, y1), Math.max(y0, y1)));
                return g;
            };
            const litP = (k, x0, y0, z0, x1, y1, z1) => {
                const g = boxG(Math.abs(x1 - x0), Math.abs(y1 - y0), Math.abs(z1 - z0));
                put(g, (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
                LB.push(shp(g, k));
                return g;
            };
            const H = { zinc: 0xbcbdb5, zincHi: 0xdcdcd2, zincLo: 0x8b8f90 };

            /* ---- the core. It stops at the shopfront head and picks up nine
                    metres back, because the shops below are rooms. ---- */
            F(A, CF.stoneLo, XC, Y_SHOP, ZS, XE, Y_MID, ZN);
            F(A, CF.stoneLo, XW + 9.0, 0, ZS, XE, Y_SHOP, ZN);
            F(A, CF.stoneLo, XL, Y_MID, ZS, XE, Y_CRN, ZN);
            F(A, CF.stoneLo, XSH, Y_CRN, ZS, XE - 2, Y_ROOF, ZN);
            /* the back of it. Collins Street looks straight at this face and it
               was one flat slab of stone; it gets the same floors as the front,
               plainly, because that is what the back of a hotel is. */
            for (let f = 0; f < FLOORS + 3; f++) {
                const y = Y_POD + 0.46 + f * FH;
                for (let i = 0; i < 14; i++) {
                    const zc = ZS - (i + 0.5) * ((ZS - ZN) / 14);
                    W(A, XE, y + 0.44, zc + 1.30, XE - 0.07, y + FH - 0.72, zc - 1.30);
                    F(A, CF.stoneLo, XE - 0.02, y + FH - 0.72, zc + 1.55, XE + 0.10, y + FH + 0.44, zc - 1.55);
                }
                F(A, CF.stoneLo, XE, y, ZS, XE + 0.10, y + 0.44, ZN);
            }

            /* ---- the podium: a deep stone band over the shops with the
                    hotel's own windows in it, and the cornice the wall above
                    stands on ---- */
            F(A, CF.stoneLo, XW - 0.12, Y_SHOP, ZS, XC, Y_SHOP + 0.95, ZN);
            F(A, CF.stone,   XW - 0.30, Y_SHOP + 0.95, ZS, XC, Y_SHOP + 1.28, ZN);
            for (let i = 0; i < NB * 2; i++) {
                const zc = ZS - (i + 0.5) * (BW / 2);
                W(A, XC - 0.07, Y_SHOP + 1.70, zc + 1.05, XC, Y_POD - 0.42, zc - 1.05);
                F(A, CF.mullion, XC - 0.10, Y_SHOP + 1.70, zc - 0.05, XC - 0.02, Y_POD - 0.42, zc + 0.05);
                F(A, CF.stoneLo, XW - 0.14, Y_SHOP + 1.48, zc + 1.24, XC, Y_SHOP + 1.70, zc - 1.24);
            }
            F(A, CF.stone,   XW - 0.24, Y_POD - 0.42, ZS, XC, Y_POD, ZN);
            F(A, CF.stoneHi, XW - 0.44, Y_POD, ZS + 0.2, XC, Y_POD + 0.46, ZN - 0.2);

            /* ---- the wall: six floors of warm precast, and in every bay a
                    pair of French doors with a dark railing across them,
                    which is what the middle of this building actually is —
                    not punched holes but doors you could stand in. ---- */
            const HALF = BW / 2;
            for (let i = 0; i <= NB * 2; i++) {
                const z = ZS - i * HALF;
                F(A, CF.stone, XW, Y_POD + 0.46, z + 0.90, XC, Y_MID, z - 0.90);
            }
            for (let i = 0; i < NB * 2; i++) {
                const zc = ZS - (i + 0.5) * HALF;
                for (let f = 0; f < FLOORS; f++) {
                    const y = Y_POD + 0.46 + f * FH;
                    const s = y + 0.34, h = y + FH - 0.62;
                    W(A, XC - 0.07, s, zc + 0.86, XC, h, zc - 0.86);
                    F(A, CF.mullion, XC - 0.11, s, zc - 0.05, XC - 0.01, h, zc + 0.05);
                    F(A, CF.mullion, XC - 0.11, h - 0.62, zc + 0.86, XC - 0.01, h - 0.54, zc - 0.86);
                    F(A, CF.stone,  XW, h, zc + 0.86, XC, y + FH + 0.34, zc - 0.86);   // the spandrel
                    F(A, CF.stoneHi, XW - 0.16, h, zc + 1.04, XC, h + 0.20, zc - 1.04); // its lintel
                    // the railing: a sill plate, a top rail and nine uprights
                    F(A, CF.stoneLo, XW - 0.20, s - 0.14, zc + 1.06, XC, s, zc - 1.06);
                    F(A, CF.mullion, XW - 0.22, s + 1.02, zc + 0.94, XW - 0.11, s + 1.11, zc - 0.94);
                    F(A, CF.mullion, XW - 0.22, s + 0.06, zc + 0.94, XW - 0.11, s + 0.13, zc - 0.94);
                    for (let b = 0; b < 7; b++) {
                        const bz = zc + 0.86 - b * (1.72 / 6);
                        F(A, CF.mullion, XW - 0.20, s, bz - 0.022, XW - 0.13, s + 1.08, bz + 0.022);
                    }
                }
            }
            F(A, CF.stone,   XW - 0.22, Y_MID, ZS, XC, Y_MID + 0.36, ZN);
            F(A, CF.stoneHi, XW - 0.42, Y_MID + 0.36, ZS + 0.2, XC, Y_MID + 0.80, ZN - 0.2);

            /* ---- the arcade.

                   Eleven ribs a metre wide, standing on the cornice and
                   running thirteen metres straight up before each one bends
                   over a quarter of a circle to meet the rib beside it. Built
                   as what it is — a leg, an arc of segments, and the same
                   again mirrored — rather than as a torus, because these
                   arches are not half-round: the leg is long and the head is
                   small, and the proportion between the two is most of what
                   the elevation looks like. ---- */
            for (let i = 0; i <= NB; i++) {
                const z = ZS - i * BW;
                F(A, H.zinc,   XW, Y_MID + 0.80, z + RIB / 2, XL, Y_SPR, z - RIB / 2);
                F(A, H.zincHi, XW - 0.14, Y_MID + 0.80, z + RIB / 2 - 0.16, XW + 0.10, Y_SPR, z - RIB / 2 + 0.16);
            }
            const SEG = 7;
            for (let i = 0; i < NB; i++) {
                const zc = ZS - (i + 0.5) * BW;
                for (const s of [-1, 1]) for (let k = 0; k < SEG; k++) {
                    const a0 = (Math.PI / 2) * (k / SEG), a1 = (Math.PI / 2) * ((k + 1) / SEG);
                    const am = (a0 + a1) / 2;
                    const zm = zc + s * AR * Math.cos(am), ym = Y_SPR + AR * Math.sin(am);
                    const len = AR * (a1 - a0) * 1.14;
                    let g = boxG(XL - XW, RIB, len);
                    put(g, (XW + XL) / 2, ym, zm, s * am, 0, 0);
                    FG(A, H.zinc, g);
                    g = boxG(0.24, RIB - 0.32, len);
                    put(g, XW - 0.02, ym, zm, s * am, 0, 0);
                    FG(A, H.zincHi, g);
                }
                /* the loggia behind: four floors of balcony, a dark reveal and
                   a glass rail on each, which is the shadow inside every arch */
                F(A, CF.reveal, XL, Y_MID + 0.80, zc + AR, XL + 0.18, Y_SPR + AR, zc - AR);
                for (let f = 0; f < 4; f++) {
                    const y = Y_MID + 1.10 + f * 3.36;
                    F(A, CF.stoneLo, XW + 0.20, y, zc + AR - 0.10, XL, y + 0.24, zc - AR + 0.10);
                    F(A, CF.reveal,  XW + 0.20, y - 0.16, zc + AR - 0.10, XL, y, zc - AR + 0.10);
                    W(GB, XW + 0.34, y + 0.24, zc + AR - 0.16, XW + 0.42, y + 1.20, zc - AR + 0.16, 0x33505f, 0x9ab2c0);
                    F(A, CF.bronze, XW + 0.28, y + 1.16, zc + AR - 0.10, XW + 0.48, y + 1.28, zc - AR + 0.10);
                    W(A, XL - 0.07, y + 0.30, zc + AR - 0.55, XL, y + 2.60, zc - AR + 0.55);
                }
                // and the tympanum inside the arch head
                W(A, XL - 0.07, Y_SPR, zc + AR * 0.72, XL, Y_SPR + AR * 0.68, zc - AR * 0.72);
            }

            /* ---- the shoulder: a quarter of a circle of standing-seam zinc,
                    rolling the whole top of the building back from the head of
                    the arcade to the roof, with the last two floors punched
                    into the curve. This is the silhouette. ---- */
            {
                const inner = [], outer = [];
                for (let k = 0; k <= 14; k++) {
                    const a = Math.PI - (Math.PI / 2) * (k / 14);
                    inner.push([XSH + RSH * Math.cos(a), Y_CRN + RSH * Math.sin(a)]);
                    outer.push([XSH + (RSH + 0.55) * Math.cos(a), Y_CRN + (RSH + 0.55) * Math.sin(a)]);
                }
                const g = profileG(inner.concat(outer.reverse()), ZS - ZN);
                put(g, 0, 0, (ZS + ZN) / 2);
                FG(A, H.zinc, g);
                // the seams, one per bay boundary, running up over the curve
                for (let i = 0; i <= NB * 2; i++) {
                    const z = ZS - i * HALF;
                    for (let k = 0; k < 12; k++) {
                        const a = Math.PI - (Math.PI / 2) * ((k + 0.5) / 12);
                        const px = XSH + (RSH + 0.60) * Math.cos(a), py = Y_CRN + (RSH + 0.60) * Math.sin(a);
                        F(A, H.zincLo, px - 0.09, py - 0.09, z - 0.07, px + 0.09, py + 0.09, z + 0.07);
                    }
                }
                /* ---- the dormers, and the reason the top of this building
                        was a mess.

                        The openings punched into the cap were turned a quarter
                        turn out of the surface they sit in: the box's long axis
                        is its depth into the curve, so it wants the surface
                        normal, which at swept angle `a` is simply (cos a,
                        sin a) — and the code was rotating to `a − π/2` and
                        pushing the pane outward instead of in. Eight bays'
                        worth of that is the serrated dark fringe that was
                        along the whole parapet.

                        Set right, it is one module repeated: a pair of dormers
                        per bay, on the bay's own centres, with a zinc cheek
                        either side and a flat head over both, twice up the
                        curve. The whole point of this elevation is that it is
                        the same thing eight times; it has to actually be the
                        same thing eight times. ---- */
                for (let f = 0; f < 2; f++) {
                    const a = Math.PI - (Math.PI / 2) * (0.26 + f * 0.30);
                    const nx = Math.cos(a), ny = Math.sin(a);            // the surface normal
                    const px = XSH + (RSH - 0.16) * nx, py = Y_CRN + (RSH - 0.16) * ny;
                    const DW = BW * 0.30, DH = 2.10 - f * 0.25;
                    for (let i = 0; i < NB; i++) for (const sd of [-1, 1]) {
                        const zc = ZS - (i + 0.5) * BW + sd * BW * 0.21;
                        let g2 = boxG(1.30, DH, DW);
                        put(g2, px, py, zc, 0, 0, a);
                        FG(A, CF.reveal, g2);
                        g2 = boxG(0.10, DH - 0.26, DW - 0.20);
                        put(g2, px - 0.50 * nx, py - 0.50 * ny, zc, 0, 0, a);
                        A.push(pane(g2, CF.glassLo, CF.glassHi, py - DH / 2, py + DH / 2));
                        for (const ck of [-1, 1]) {                       // the cheeks
                            g2 = boxG(1.34, DH + 0.30, 0.20);
                            put(g2, px + 0.10 * nx, py + 0.10 * ny, zc + ck * (DW / 2 + 0.10), 0, 0, a);
                            FG(A, H.zincHi, g2);
                        }
                        g2 = boxG(1.44, 0.22, DW + 0.44);                 // and the head over it
                        put(g2, px + 0.14 * nx + 0.10 * ny * DH, py + 0.14 * ny + DH / 2 + 0.08, zc, 0, 0, a);
                        FG(A, H.zincHi, g2);
                    }
                }
            }
            F(A, CF.stoneLo, XSH - 1.0, Y_ROOF - 0.4, ZS, XE - 2, Y_ROOF, ZN);
            for (const p of [[XE - 16, ZS - 8], [XE - 9, ZS - 34], [XE - 14, ZN + 12]]) {
                F(A, CF.stoneLo, p[0], Y_ROOF, p[1], p[0] + 7.0, Y_ROOF + 2.9, p[1] - 6.0);
                F(A, CF.granite, p[0] + 1.4, Y_ROOF + 2.9, p[1] - 1.2, p[0] + 3.2, Y_ROOF + 4.6, p[1] - 3.0);
            }

            /* ---- the ground floor.

                   What the photograph has along here and nothing else: a
                   colonnade for most of the length — square piers on the
                   building line, the wall four and a half metres behind them,
                   a lit soffit over the walk and the hotel's banners hung off
                   every second pier — one boutique with a room behind it, the
                   hotel's own door, and a pair of black service gates. ---- */
            {
                const XP0 = XW - 0.34, XP1 = XW + 0.82, XBK = XW + 4.70;
                const Y_HD = 4.35, Y_F0 = 4.46, Y_F1 = 5.52;
                const room = (z0, z1) => {
                    F(A, 0x9b968c, XP1, 0.10, z0, XBK, 0.18, z1);
                    F(A, 0xd7d2c6, XBK, 0.18, z0, XBK + 0.42, Y_HD + 1.10, z1);
                    litP('warm', XBK - 0.14, 0.60, z0 + 0.30, XBK - 0.10, Y_HD - 0.25, z1 - 0.30);
                    glassy(GB, XBK - 0.06, 0.55, z0 + 0.25, XBK + 0.02, Y_HD - 0.15, z1 - 0.25);
                    F(A, CF.granite, XBK - 0.08, 0.18, z0 + 0.12, XBK + 0.04, 0.55, z1 - 0.12);
                    F(A, CF.bronze,  XBK - 0.09, Y_HD - 0.15, z0 + 0.12, XBK + 0.05, Y_HD - 0.03, z1 - 0.12);
                };

                for (const [z0, z1] of [[-127.6, -149.8], [-176.2, -190.2], [-193.9, -208.8]]) {
                    const n = Math.max(2, Math.round(Math.abs(z1 - z0) / 4.4));
                    F(A, 0xcfc7b6, XP0, Y_HD + 0.85, z0, XBK, Y_F1, z1);          // the soffit
                    F(A, CF.granite, XP0 - 0.06, Y_HD + 0.70, z0, XBK, Y_HD + 0.85, z1);
                    for (let i = 0; i <= n; i++) {
                        const z = z0 - (z0 - z1) * (i / n);
                        F(A, CF.granite, XP0 - 0.10, 0, z + 0.64, XP1 + 0.10, 0.58, z - 0.64);
                        F(A, CF.stone,   XP0, 0.58, z + 0.56, XP1, Y_HD + 0.62, z - 0.56);
                        F(A, CF.stoneHi, XP0 - 0.09, Y_HD + 0.36, z + 0.68, XP1 + 0.09, Y_HD + 0.70, z - 0.68);
                        F(A, CF.stoneHi, XP0 - 0.07, 0.58, z + 0.64, XP1 + 0.07, 0.92, z - 0.64);
                    }
                    for (let i = 0; i < n; i++) {
                        const a = z0 - (z0 - z1) * ((i + 0.15) / n);
                        const b = z0 - (z0 - z1) * ((i + 0.85) / n);
                        room(a, b);
                        litP('warm', XP1 + 0.95, Y_HD + 0.74, a, XP1 + 1.45, Y_HD + 0.80, b);
                        if (i % 2) continue;
                        const zc = (a + b) / 2;
                        F(A, CF.bronze, XP0 - 0.58, Y_HD + 0.20, zc - 0.04, XP0, Y_HD + 0.30, zc + 0.04);
                        litP('westin', XP0 - 0.55, Y_HD - 1.72, zc - 0.02, XP0 - 0.51, Y_HD + 0.22, zc + 0.02);
                    }
                }

                /* the boutique: its own frame, its own door, a lit ceiling and
                   two plinths, a mannequin and a hanging rail in the window */
                {
                    const z0 = -150.2, z1 = -159.4, zc = (z0 + z1) / 2, zd = z0 - (z0 - z1) * 0.5;
                    const XF = XW + 1.55, XB = XW + 8.60;
                    for (const zz of [z0, z1]) {
                        F(A, CF.granite, XW - 0.10, 0, zz + 0.55, XF + 0.30, 0.75, zz - 0.55);
                        F(A, CF.stone,   XW, 0.75, zz + 0.46, XF + 0.30, Y_F0, zz - 0.46);
                    }
                    F(A, CF.stone,   XW, Y_HD + 0.10, z0, XF + 0.30, Y_F0, z1);
                    F(A, CF.granite, XF - 0.06, 0, z0 - 0.46, XF + 0.16, 0.62, z1 + 0.46);
                    F(A, CF.bronze,  XF - 0.09, 0.62, z0 - 0.46, XF + 0.19, 0.72, z1 + 0.46);
                    glassy(GB, XF - 0.03, 0.72, z0 - 0.46, XF + 0.05, Y_HD, z1 + 0.46);
                    for (let m = 0; m <= 6; m++) {
                        const z = (z0 - 0.46) - (z0 - z1 - 0.92) * (m / 6);
                        F(A, CF.bronze, XF - 0.07, 0.62, z - 0.045, XF + 0.09, Y_HD, z + 0.045);
                    }
                    F(A, CF.bronze, XF - 0.07, 3.35, z0 - 0.46, XF + 0.09, 3.44, z1 + 0.46);
                    F(A, CF.bronze, XF - 0.08, 0, zd + 0.62, XF + 0.10, 3.47, zd + 0.52);
                    F(A, CF.bronze, XF - 0.08, 0, zd - 0.52, XF + 0.10, 3.47, zd - 0.62);
                    glassy(GB, XF + 0.16, 0.28, zd + 0.50, XF + 0.22, 3.35, zd - 0.50);
                    F(A, CF.gold, XF + 0.10, 1.02, zd + 0.36, XF + 0.17, 1.12, zd - 0.20);
                    F(A, CF.granite, XW - 0.14, Y_F0, z0, XF + 0.30, Y_F1, z1);
                    litP('dior', XW - 0.22, Y_F0 + 0.10, z0 - 0.30, XW - 0.16, Y_F1 - 0.10, z1 + 0.30);
                    litP('warm', XW + 0.10, Y_F0 - 0.12, z0 - 0.50, XW + 0.55, Y_F0 - 0.06, z1 + 0.50);
                    // the room
                    F(A, 0x9b968c, XF, 0.10, z0 - 0.46, XB, 0.20, z1 + 0.46);
                    F(A, 0xd7d2c6, XF, 0.20, z0 - 0.46, XB, Y_HD, z0 - 0.62);
                    F(A, 0xd7d2c6, XF, 0.20, z1 + 0.46, XB, Y_HD, z1 + 0.62);
                    F(A, 0xe4dfd3, XF, Y_HD - 0.14, z0 - 0.46, XB, Y_HD, z1 + 0.46);
                    litP('cool', XB - 0.10, 0.20, z0 - 0.46, XB, Y_HD - 0.14, z1 + 0.46);
                    for (let i = 0; i < 3; i++) {
                        litP('warm', XF + 1.2 + i * 2.3, Y_HD - 0.22, z0 - 0.70, XF + 1.6 + i * 2.3, Y_HD - 0.14, z1 + 0.70);
                    }
                    for (const sd of [-1, 1]) {
                        F(A, 0xf0ece4, XF + 1.6, 0.20, zc + sd * 2.6, XF + 2.6, 0.95, zc + sd * 1.6);
                        F(A, 0x2a2622, XF + 1.9, 0.95, zc + sd * 2.3, XF + 2.35, 1.28, zc + sd * 1.9);
                        F(A, CF.gold,  XF + 1.95, 1.28, zc + sd * 2.25, XF + 2.30, 1.40, zc + sd * 1.95);
                    }
                    let g = cylG(0.17, 0.13, 1.05, 9); put(g, XF + 2.1, 1.05, zc); FG(A, 0xe8e0d2, g);
                    g = cylG(0.09, 0.17, 0.62, 9); put(g, XF + 2.1, 1.88, zc); FG(A, 0xe8e0d2, g);
                    g = sphG(0.13, 9, 7); put(g, XF + 2.1, 2.30, zc); FG(A, 0xe8e0d2, g);
                    F(A, 0x1c1c1e, XF + 1.85, 1.30, zc + 0.30, XF + 2.35, 2.05, zc - 0.30);
                    F(A, CF.gold, XF + 4.2, 2.25, zc + 2.4, XF + 4.28, 2.33, zc - 2.4);
                    for (let h = 0; h < 8; h++) {
                        F(A, [0x24242a, 0x3a3630, 0x1e2228, 0x2e2a26][h % 4],
                          XF + 4.05, 1.30, zc + 2.1 - h * 0.62, XF + 4.45, 2.25, zc + 1.82 - h * 0.62);
                    }
                }

                /* the hotel's own door: three bays of glass in a bronze
                   surround under a canopy, the name in gold over it */
                {
                    const z0 = -161.0, z1 = -175.0;
                    F(A, CF.granite, XW - 0.10, 0, z0 + 0.4, XW + 1.9, 0.16, z1 - 0.4);
                    for (let i = 0; i < 3; i++) {
                        const zc = z0 - 1.9 - i * 4.4;
                        F(A, CF.bronze, XW + 0.10, 0.16, zc + 1.55, XW + 0.34, 3.30, zc + 1.35);
                        F(A, CF.bronze, XW + 0.10, 0.16, zc - 1.35, XW + 0.34, 3.30, zc - 1.55);
                        F(A, CF.bronze, XW + 0.10, 3.10, zc + 1.55, XW + 0.34, 3.30, zc - 1.55);
                        glassy(GB, XW + 0.16, 0.16, zc + 1.35, XW + 0.26, 3.10, zc - 1.35);
                        F(A, CF.bronze, XW + 0.06, 1.10, zc + 1.30, XW + 0.16, 1.22, zc - 1.30);
                        F(A, CF.bronze, XW + 0.14, 0.16, zc + 0.06, XW + 0.30, 3.10, zc - 0.06);
                    }
                    F(A, CF.stone,   XW - 2.50, 3.62, z0 + 0.2, XW + 1.0, 4.05, z1 - 0.2);
                    F(A, CF.granite, XW - 2.58, 3.26, z0 + 0.2, XW - 2.50, 4.05, z1 - 0.2);
                    litP('westin', XW - 0.14, 4.20, z0 - 1.2, XW - 0.08, 5.20, z1 + 1.2);
                    for (const zz of [z0 - 0.6, z1 + 0.6]) {
                        const g = cylG(0.17, 0.13, 0.9, 8);
                        put(g, XW - 0.34, 2.5, zz); LB.push(shp(g, 'warm'));
                        F(A, CF.bronze, XW - 0.40, 2.95, zz - 0.06, XW, 3.05, zz + 0.06);
                    }
                    for (let i = 0; i < 4; i++) {
                        litP('warm', XW - 1.9, 3.56, z0 - 1.4 - i * 3.6, XW - 1.4, 3.62, z0 - 2.6 - i * 3.6);
                    }
                }

                // the service gates, which every block has and nobody photographs
                {
                    const z0 = -190.5, z1 = -193.6;
                    F(A, CF.granite, XW - 0.08, 0, z0 + 0.4, XW + 1.5, 4.60, z0);
                    F(A, CF.granite, XW - 0.08, 0, z1, XW + 1.5, 4.60, z1 - 0.4);
                    F(A, CF.granite, XW - 0.14, 4.30, z0 + 0.4, XW + 1.5, 4.60, z1 - 0.4);
                    for (let i = 0; i < 26; i++) {
                        F(A, i % 2 ? 0x2a2c2c : 0x1e2020, XW + 0.18, 0.06 + i * 0.164, z0,
                                                          XW + 0.30, 0.20 + i * 0.164, z1);
                    }
                    F(A, CF.granite, XW + 0.10, 0, z0, XW + 0.34, 0.10, z1);
                }
            }

            /* ---- the two end walls. Both were blank slabs of stone, and
                    both are seen: the Flinders Lane end closes the view south
                    out of the square, and the Collins Street end is what you
                    walk towards coming down Swanston. Plainer than the front,
                    as the ends of a hotel are, but not nothing. ---- */
            for (const [zf, dir] of [[ZS, 1], [ZT, -1]]) {
                for (let f = 0; f < FLOORS + 5; f++) {
                    const y = Y_POD + 0.46 + f * FH;
                    for (let i = 0; i < 8; i++) {
                        const xc = XW + 3.4 + i * 4.85;
                        if (xc > XE - 2) break;
                        W(A, xc - 1.15, y + 0.44, zf, xc + 1.15, y + FH - 0.72, zf - dir * 0.07);
                        F(A, CF.stone, xc - 1.42, y + FH - 0.72, zf + dir * 0.10,
                                       xc + 1.42, y + FH + 0.44, zf - dir * 0.02);
                        F(A, CF.stoneLo, xc - 1.42, y + 0.20, zf + dir * 0.14, xc + 1.42, y + 0.44, zf);
                    }
                    F(A, CF.stone, XW, y, zf, XE, y + 0.44, zf + dir * 0.10);
                }
                for (let i = 0; i <= 8; i++) {
                    const x = XW + 1.0 + i * 4.85;
                    if (x > XE) break;
                    F(A, CF.stone, x - 1.0, Y_POD, zf, x + 1.0, Y_CRN - 1.2, zf + dir * 0.12);
                }
                // and the parapet that stops them, so the end does not simply
                // run out into the sky
                F(A, CF.stone,   XW, Y_CRN - 1.2, zf + dir * 0.10, XE, Y_CRN - 0.8, zf - dir * 0.16);
                F(A, CF.stoneHi, XW, Y_CRN - 0.8, zf + dir * 0.10, XE, Y_CRN - 0.3, zf - dir * 0.34);
            }

        }

        /* ------------------------------------------------------------
           21e · the canopy

           Six columns, and the whole roof stands on them. Each one is a
           tapered blade that rises four metres out of the paving and then
           splits into four branches leaning out and up to meet the beams —
           so the thing reads as six trees holding a deck, which is the only
           reason a flat roof over an empty square is worth looking at.

           The deck is ghosted. Nothing about it is reachable — it is nine
           metres up over open paving with no stair to it — and leaving it in
           the walk's grid would spend a whole vertical span in every cell of
           the plaza on a surface nobody can ever stand on. The columns stay
           solid, because a column is something you walk into.
           ------------------------------------------------------------ */
        const CAN = { X0: 20.0, X1: 44.0, ZS: -146.0, ZN: -188.0, Y: 8.70 };
        {
            const CX = [22.5, 38.0], CZ = [-152.0, -167.0, -182.0];

            for (const cx of CX) for (const cz of CZ) {
                // the footing, and the tapered shaft out of it
                bx3(P.qSteel, null, cx - 0.75, SQ.DECK, cz - 0.75, cx + 0.75, SQ.DECK + 0.12, cz + 0.75);
                let g = cylG(0.52, 0.30, 4.10, 4);
                put(g, cx, SQ.DECK + 2.17, cz, 0, Math.PI / 4, 0);
                P.qSteel.push(g);
                // the four branches. 2.6 m out over 4.05 up, which is the lean
                // in the photograph and also the lean that puts the branch tips
                // exactly under the two beams it has to carry.
                const LEAN = Math.atan2(2.6, 4.05), L = Math.hypot(2.6, 4.05);
                for (const b of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
                    g = cylG(0.16, 0.30, L, 4);
                    // One axis each, never two: an Euler with x, y and z all
                    // set composes in an order that leans a branch somewhere
                    // between the two directions it was asked for.
                    put(g, cx + b[0] * 1.30, SQ.DECK + 4.22 + 2.02, cz + b[1] * 1.30,
                        b[1] * LEAN, 0, -b[0] * LEAN);
                    P.qSteel.push(g);
                }
            }

            // ---- the beams: two long ones down the column lines, and one
            //      across at every row, cantilevering out to the roof edge
            for (const cx of CX) bx3(P.qRoof, null, cx - 0.19, 7.55, CAN.ZS, cx + 0.19, 8.45, CAN.ZN);
            for (const cz of CZ) bx3(P.qRoof, null, CAN.X0, 8.45, cz - 0.16, CAN.X1, 8.85, cz + 0.16);

            /* The deck. Bands of solid soffit alternating with bands of slat,
               which is what makes the light under there striped rather than
               flat — and the one detail of this canopy a photograph of it is
               mostly about. */
            {
                const LEN = CAN.ZS - CAN.ZN;                 // 42, running north
                const nBand = 14, bandZ = LEN / nBand;
                for (let i = 0; i < nBand; i++) {
                    const z0 = CAN.ZS - i * bandZ, z1 = z0 - bandZ;
                    if (i % 2 === 0) {
                        bx3(P.qRoof, null, CAN.X0, CAN.Y, z0, CAN.X1, CAN.Y + 0.12, z1);
                    } else {
                        const n = Math.max(2, Math.round(bandZ / 0.40));
                        for (let s = 0; s < n; s++) {
                            const z = z0 - bandZ * (s + 0.5) / n;
                            bx3(P.qRoof, null, CAN.X0, CAN.Y - 0.02, z - 0.055, CAN.X1, CAN.Y + 0.16, z + 0.055);
                        }
                    }
                }
                // the fascia all the way round, which is the canopy's edge
                for (const e of [[CAN.X0 - 0.14, CAN.ZS + 0.14, CAN.X0, CAN.ZN - 0.14],
                                 [CAN.X1, CAN.ZS + 0.14, CAN.X1 + 0.14, CAN.ZN - 0.14],
                                 [CAN.X0 - 0.14, CAN.ZS + 0.14, CAN.X1 + 0.14, CAN.ZS],
                                 [CAN.X0 - 0.14, CAN.ZN, CAN.X1 + 0.14, CAN.ZN - 0.14]]) {
                    bx3(P.qRoof, null, e[0], CAN.Y - 0.30, e[1], e[2], CAN.Y + 0.30, e[3]);
                }
            }

            // ---- the downlights slung under the beams. Emissive, not lights:
            //      twelve of them would be twelve full-screen passes.
            for (const cx of CX) for (let i = 0; i < 5; i++) {
                const cz = CAN.ZS - 4.2 - i * 8.4;
                bx3(P.qRoof, null, cx - 0.10, 7.10, cz - 0.10, cx + 0.10, 7.55, cz + 0.10);
                const g = cylG(0.19, 0.19, 0.10, 8);
                put(g, cx, 7.06, cz);
                P.qSign.push(sgn(g, 'warm'));
            }
        }

        /* ------------------------------------------------------------
           21f · the way down

           Three escalators and a stair, side by side, dropping twelve and a
           half metres through the hole in the plaza into the ticket hall. The
           angle is not typed: it is read off the two ends, because the two
           ends are the plaza and the hall floor and an escalator that arrives
           half a metre under its landing is a hole somebody falls down.
           ------------------------------------------------------------ */
        const ESC = { ZT: SQ.VZ1, ZB: SQ.VZ0, YT: SQ.DECK, YB: SQ.HALL };
        {
            const slope = (ESC.YB - ESC.YT) / (ESC.ZB - ESC.ZT);      // −12.67 over −26.5
            const yAt = (z) => ESC.YT + (z - ESC.ZT) * slope;
            const OVER = 1.4;                                          // run past the bottom landing
            const ZB2 = ESC.ZB - OVER;

            /* one escalator: the step band you walk on, the truss under it,
               two glass balustrades and the bronze handrail along each */
            const escalator = (cx, w) => {
                rampZ(w, 0.24, ESC.ZT, ESC.YT - 0.12, ZB2, yAt(ZB2) - 0.12, cx, P.sSteel);
                // The truss is wider than the escalator on purpose. The walk's
                // cells are about a metre and a half here and the gaps between
                // three escalators and a stair are two hundred millimetres, so
                // the trusses are what has to overlap: a cell centre that lands
                // in a gap must still find solid, or the bank has a slot down
                // it that a person falls through on the way to the platform.
                rampZ(w + 0.90, 1.30, ESC.ZT, ESC.YT - 0.95, ZB2, yAt(ZB2) - 0.95, cx, P.sCrete);
                for (const s of [-1, 1]) {
                    const bxx = cx + s * (w / 2 + 0.14);
                    rampZ(0.10, 1.02, ESC.ZT, ESC.YT + 0.51, ZB2, yAt(ZB2) + 0.51, bxx, P.gGlass);
                    rampZ(0.16, 0.11, ESC.ZT, ESC.YT + 1.07, ZB2, yAt(ZB2) + 1.07, bxx, P.gTrim);
                }
                // the comb plates, top and bottom, in the same bronze
                for (const zz of [ESC.ZT - 0.4, ESC.ZB + 0.4]) {
                    bx3(P.sTrim, null, cx - w / 2, yAt(zz) - 0.02, zz - 0.55, cx + w / 2, yAt(zz) + 0.05, zz + 0.55);
                }
            };
            escalator(30.40, 1.62);
            escalator(32.20, 1.62);
            escalator(34.00, 1.62);

            /* the stair beside them, with every tread in it. Eighty-three
               boxes is nothing merged, and a public stair drawn as a smooth
               ramp is the one thing in a station that always looks wrong. */
            {
                const cx = 27.40, w = 3.00, n = 83;
                rampZ(w + 1.10, 1.10, ESC.ZT, ESC.YT - 0.80, ZB2, yAt(ZB2) - 0.80, cx, P.sCrete);
                for (let i = 0; i < n; i++) {
                    const z0 = ESC.ZT - (ESC.ZT - ESC.ZB) * (i / n);
                    const z1 = ESC.ZT - (ESC.ZT - ESC.ZB) * ((i + 1) / n);
                    bx3(P.sCrete, null, cx - w / 2, yAt(z1) - 0.34, z0, cx + w / 2, yAt(z1), z1);
                }
                for (const s of [-1, 1]) {
                    const bxx = cx + s * (w / 2 + 0.10);
                    rampZ(0.09, 1.02, ESC.ZT, ESC.YT + 0.53, ZB2, yAt(ZB2) + 0.53, bxx, P.gGlass);
                    rampZ(0.15, 0.10, ESC.ZT, ESC.YT + 1.09, ZB2, yAt(ZB2) + 1.09, bxx, P.gTrim);
                }
            }

            /* The balustrade round the rest of the hole. Open on the south
               side, because the south side is where you walk in — and solid
               everywhere else, because the walk reads glass with depth as
               something to be stopped by, which is exactly what it is. */
            {
                const rail = (x0, z0, x1, z1) => {
                    bx3(P.qGlass, null, x0, SQ.DECK, z0, x1, SQ.DECK + 1.06, z1);
                    bx3(P.qTrim, null, x0 - 0.05, SQ.DECK + 1.02, z0 - 0.05,
                                       x1 + 0.05, SQ.DECK + 1.14, z1 + 0.05);
                };
                rail(SQ.VX0 - 0.11, SQ.VZ1, SQ.VX0, SQ.VZ0);
                rail(SQ.VX1, SQ.VZ1, SQ.VX1 + 0.11, SQ.VZ0);
                rail(SQ.VX0 - 0.11, SQ.VZ0, SQ.VX1 + 0.11, SQ.VZ0 + 0.11);
            }
        }

        /* ------------------------------------------------------------
           21g · the entrance box, the lift, the pavilion and the steps

           Everything else standing on the plaza, in the dark bronze batten
           cladding the whole entrance is clad in — and the blue signs, which
           at this hour are the brightest thing at ground level on the block.
           ------------------------------------------------------------ */
        {
            const B = (x0, y0, z0, x1, y1, z1) => bx3(P.qClad, null, x0, y0, z0, x1, y1, z1);
            const G = (x0, y0, z0, x1, y1, z1) => bx3(P.qGlass, null, x0, y0, z0, x1, y1, z1);
            const S = (k, x0, y0, z0, x1, y1, z1) => {
                const g = boxG(Math.abs(x1 - x0), Math.abs(y1 - y0), Math.abs(z1 - z0));
                put(g, (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
                P.qSign.push(sgn(g, k));
            };

            // ---- the two batten walls down the sides of the escalator hole,
            //      and the head canopy across the top of them
            B(24.55, SQ.DECK, -152.0, 25.45, SQ.DECK + 3.70, -163.0);
            B(35.45, SQ.DECK, -152.0, 36.35, SQ.DECK + 3.70, -163.0);
            B(24.55, SQ.DECK + 3.70, -151.4, 36.35, SQ.DECK + 4.25, -161.0);
            B(24.55, SQ.DECK + 2.42, -151.4, 36.35, SQ.DECK + 3.70, -152.0);  // the header you walk under

            // and the lights in the soffit of it, which are the only thing
            // that makes the top of the shaft read as a way down rather than
            // as a hole in the paving
            for (let i = 0; i < 4; i++) {
                const g = boxG(2.20, 0.08, 0.42);
                put(g, 27.6 + (i % 2) * 5.4, SQ.DECK + 3.66, -153.4 - Math.floor(i / 2) * 4.6);
                P.qSign.push(sgn(g, 'warm'));
            }

            // the station's name across the front of it, and the wayfinding
            // hanging under the head canopy where you read it walking in
            S('townhall', 26.30, SQ.DECK + 2.52, -151.30, 34.60, SQ.DECK + 3.62, -151.28);
            S('collins', 27.20, SQ.DECK + 2.30, -157.60, 33.70, SQ.DECK + 3.20, -157.58);
            S('metro', 24.52, SQ.DECK + 2.10, -164.00, 24.50, SQ.DECK + 3.10, -169.80);

            // ---- the lift, standing on the plaza beside the escalators
            B(35.95, SQ.DECK, -156.90, 38.45, SQ.DECK + 0.30, -160.50);
            for (const s of [[35.95, 36.20], [38.20, 38.45]]) B(s[0], SQ.DECK, -156.90, s[1], SQ.DECK + 3.55, -160.50);
            B(35.95, SQ.DECK + 3.20, -156.90, 38.45, SQ.DECK + 3.70, -160.50);
            G(36.20, SQ.DECK + 0.30, -156.94, 38.20, SQ.DECK + 3.20, -156.90);
            G(36.20, SQ.DECK + 0.30, -160.50, 38.20, SQ.DECK + 3.20, -160.54);
            G(38.20, SQ.DECK + 0.30, -157.0, 38.24, SQ.DECK + 3.20, -160.4);

            // ---- the glazed pavilion on the Swanston side, on its stone
            //      plinth, with the bench along the front of it
            B(19.60, SQ.DECK, -156.00, 23.40, SQ.DECK + 0.55, -163.00);
            for (const c of [[19.60, 19.86], [23.14, 23.40]]) {
                B(c[0], SQ.DECK + 0.55, -156.00, c[1], SQ.DECK + 3.40, -163.00);
            }
            B(19.60, SQ.DECK + 3.10, -155.86, 23.40, SQ.DECK + 3.60, -163.14);
            G(19.86, SQ.DECK + 0.55, -155.96, 23.14, SQ.DECK + 3.10, -156.00);
            G(19.86, SQ.DECK + 0.55, -163.00, 23.14, SQ.DECK + 3.10, -163.04);
            G(19.82, SQ.DECK + 0.55, -156.0, 19.86, SQ.DECK + 3.10, -163.0);
            bx3(P.qTrim, null, 19.60, SQ.DECK + 0.42, -163.00, 20.90, SQ.DECK + 0.55, -164.10);

        }

        /* ---- the bollards along the Swanston edge, stainless and knocked
                about, which is how you know where the footpath stops and the
                square starts. Instanced: twenty-six of anything is one mesh. ---- */
        {
            const bod = [];
            let g = cylG(0.115, 0.125, 1.00, 10); put(g, 0, 0.50, 0); bod.push(g);
            g = cylG(0.128, 0.128, 0.09, 10); put(g, 0, 0.86, 0); bod.push(g);
            g = cylG(0.12, 0.12, 0.03, 10); put(g, 0, 1.00, 0); bod.push(g);
            const N = 26;
            const im = new THREE.InstancedMesh(merge(bod),
                wet(stdMat(0xb9bcbe, { roughness: 0.26, metalness: 0.66 })), N);
            for (let i = 0; i < N; i++) {
                im.setMatrixAt(i, MX(19.70 + rr(-0.04, 0.04), SQ.DECK, -136.5 - i * 2.55, 0, rr(-0.06, 0.06), 0));
            }
            im.instanceMatrix.needsUpdate = true;
            scene.add(im);
        }

        /* ============================================================
           21h · Town Hall Station — the Metro Tunnel, twenty-five metres down

           This is the part of the brief that is not in the photograph: going
           in through the box in the plaza means going into the tunnel world.
           There is no portal in the runtime and there does not need to be —
           the walk keeps four vertical spans per cell, so the station is
           simply built underneath, and the escalators are a walk rather than
           a transition. Three floors, in the order you meet them:

               0.17   the plaza
             −15.0    the ticket hall, under the square
             −25.0    the concourse, the platforms and the train

           Built in the language the Metro Tunnel's own stations are built in
           and the one `station.scene.js` already speaks: a single cavern with
           a segmental vault, the concourse down the middle of it, a platform
           either side, full-height screen doors onto both tracks, and cone
           lamps on the blade columns.

           No lights. The world's four are spent above ground and a station
           lit by four more would be four more full-screen passes on an iPad;
           so every bright thing down here is an emissive material with a dark
           albedo under it, which is also what an artificially lit room
           actually is.
           ============================================================ */
        const ST = {
            HALL: SQ.HALL, HCEIL: -9.5,
            PLAT: SQ.PLAT, SPRING: -19.0, RISE: 6.0, WALL: 17.0,
            CONC: 6.5, EDGE: 12.7, TRACK: 15.2, RAIL: -26.1,
            ZN: -236.0, ZS: -56.0,                 // the cavern's two ends
            PZN: -216.0, PZS: -57.0,               // the platforms'
            SHAFT_N: -236.0, SHAFT_S: -218.0,      // the flat-ceilinged end the escalators land in
        };
        /* The train is seven twenty-two-metre cars with three doors in each,
           so the screen doors in the platform wall are drilled on 7.53 m
           centres off where the train stops — which is the only way a screen
           door and the door behind it are ever in the same place. */
        const CAR_L = 22.6, TRAIN_N = 7, DOOR_W = 1.72, DOOR_P = CAR_L / 3;
        const BERTH_Z = -134.0;
        const doorZs = [];
        for (let i = 0; i < TRAIN_N * 3; i++) {
            doorZs.push(BERTH_Z - (TRAIN_N / 2) * CAR_L + DOOR_P * (i + 0.5));
        }
        {
            const C_ = (x0, y0, z0, x1, y1, z1) => bx3(P.sCrete, null, x0, y0, z0, x1, y1, z1);

            /* ---- the ticket hall, under the square. A floor, four walls, and
                   a ceiling with the escalator hole in it — drawn as the four
                   pieces around the hole rather than as a shape, because four
                   boxes are cheaper than a triangulation and this hole is a
                   rectangle. ---- */
            const HX0 = 18.6, HX1 = 43.0, HZS = -150.0, HZN = -198.0;
            C_(HX0, ST.HALL - 0.5, HZS, HX1, ST.HALL, HZN);                      // floor
            C_(HX0 - 0.5, ST.HALL, HZS, HX0, ST.HCEIL, HZN);                     // west wall
            C_(HX1, ST.HALL, HZS, HX1 + 0.5, ST.HCEIL, HZN);                     // east
            C_(HX0 - 0.5, ST.HALL, HZS, HX1 + 0.5, ST.HCEIL, HZS + 0.5);         // south
            C_(HX0 - 0.5, ST.HALL, HZN, 19.5, ST.HCEIL, HZN - 0.5);              // north, either
            C_(34.0, ST.HALL, HZN, HX1 + 0.5, ST.HCEIL, HZN - 0.5);              // side of the passage
            for (const c of [[HX0, HZS, HX1, SQ.VZ1], [HX0, SQ.VZ0, HX1, HZN],
                             [HX0, SQ.VZ1, SQ.VX0, SQ.VZ0], [SQ.VX1, SQ.VZ1, HX1, SQ.VZ0]]) {
                C_(c[0], ST.HCEIL, c[1], c[2], ST.HCEIL + 0.5, c[3]);
            }

            /* the fare gates, across the hall where the passage leaves it —
               eight aisles, and the one thing down here that tells you which
               side of the barrier you are standing on */
            for (let i = 0; i < 10; i++) {
                const x = 21.0 + i * 1.55;
                bx3(P.sClad, null, x, ST.HALL, -186.2, x + 0.32, ST.HALL + 1.02, -184.2);
                const g = boxG(0.26, 0.06, 0.44);          // the arrow on the pedestal
                put(g, x + 0.16, ST.HALL + 1.05, -185.2);
                P.sSign.push(sgn(g, 'strip'));
            }
            /* the light lines in the hall and the passage. A room this size
               lit only by what leaks down the escalators is a corridor, and
               the whole point of the hall is that you come out of the weather
               into somewhere. */
            for (const r of [[19.6, 42.0, -154.0], [19.6, 42.0, -193.0],
                             [19.6, 24.6, -172.0], [37.0, 42.0, -172.0]]) {
                const g = boxG(Math.abs(r[1] - r[0]), 0.10, 0.62);
                put(g, (r[0] + r[1]) / 2, ST.HCEIL - 0.22, r[2]);
                P.sSign.push(sgn(g, 'strip'));
            }
            for (let i = 0; i < 3; i++) {
                const g = boxG(0.62, 0.10, 9.0);
                put(g, 27.5, ST.HCEIL - 0.22, -203.0 - i * 10.5);
                P.sSign.push(sgn(g, 'strip'));
            }

            /* ---- the passage north to the shaft, and the landing that
                   cantilevers out of its west end over the concourse ---- */
            const PX0 = 17.0, PX1 = 34.0, PZS = -198.0, PZN = -232.0;
            C_(PX0, ST.HALL - 0.5, PZS, PX1, ST.HALL, PZN);
            C_(PX0, ST.HCEIL, PZS, PX1, ST.HCEIL + 0.5, PZN);
            C_(PX0 - 0.5, ST.HALL, PZN, PX1, ST.HCEIL, PZN - 0.5);
            C_(PX1, ST.HALL, PZS, PX1 + 0.5, ST.HCEIL, PZN);
            C_(14.0, ST.HALL - 0.5, -230.0, PX0, ST.HALL, -218.0);               // the landing

            /* ---- the cavern ----

               A segmental vault, springing at −19 and six metres of rise, over
               a floor at −25. Written as one profile extruded a hundred and
               sixty metres, which is what it is — and the reason the two ends
               are drawn as a rectangle with the same profile cut out of them,
               so the mouth of the vault is the mouth of the vault rather than
               a rectangle that nearly is. */
            const arcPts = (r, rise, n) => {
                const out = [];
                for (let i = 0; i <= n; i++) {
                    const a = Math.PI * (i / n);
                    out.push([-Math.cos(a) * r, Math.sin(a) * rise]);
                }
                return out;
            };
            {
                const inner = arcPts(ST.WALL, ST.RISE, 20);
                const outer = arcPts(ST.WALL + 0.7, ST.RISE + 0.7, 20).reverse();
                const g = profileG(inner.concat(outer), ST.SHAFT_S - ST.ZS);
                put(g, 0, ST.SPRING, (ST.SHAFT_S + ST.ZS) / 2);
                P.sCrete.push(g);
            }
            // the side walls under the springing, and the floor across the lot
            for (const s of [-1, 1]) {
                C_(s * ST.WALL, ST.PLAT, ST.ZN, s * (ST.WALL + 0.7), ST.SPRING, ST.ZS);
            }
            /* One-point-two metres thick, and the thickness is load-bearing
               in a way that has nothing to do with structure. The walk merges
               two surfaces less than 1.4 m apart into one solid; a slab
               thicker than that is a top and a bottom the grid keeps as two
               separate spans, and the platform column already spends three on
               the street overhead, the vault and the floor. A fourth pushed it
               to the cap, and a cap that overflows folds the newest sample into
               whichever span is nearest — which put the hanging platform signs
               into the floor and stood anybody underneath one three metres in
               the air. Thinner than the merge gap, the slab is one span. */
            C_(-ST.EDGE, ST.PLAT - 1.2, ST.ZN, ST.EDGE, ST.PLAT, ST.ZS);      // concourse + platforms
            for (const s of [-1, 1]) {                                        // and the trackbed beside them
                C_(s * ST.EDGE, ST.RAIL - 0.55, ST.ZN, s * ST.WALL, ST.RAIL - 0.15, ST.ZS);
            }
            // the flat-ceilinged end the escalators come down into
            C_(-ST.WALL, ST.HCEIL, ST.SHAFT_N, ST.WALL, ST.HCEIL + 0.7, ST.SHAFT_S);
            C_(-ST.WALL - 0.7, ST.PLAT, ST.ZN, ST.WALL + 0.7, ST.HCEIL + 0.7, ST.ZN - 0.7);

            /* the spandrel where the flat ceiling meets the vault: a wall with
               the vault's own section cut out of it, so what you walk towards
               from the escalator is an arch */
            {
                const shape = new THREE.Shape();
                shape.moveTo(-ST.WALL - 0.7, -0.4);
                shape.lineTo(ST.WALL + 0.7, -0.4);
                shape.lineTo(ST.WALL + 0.7, ST.HCEIL - ST.SPRING + 0.7);
                shape.lineTo(-ST.WALL - 0.7, ST.HCEIL - ST.SPRING + 0.7);
                shape.closePath();
                const hole = new THREE.Path();
                const a = arcPts(ST.WALL, ST.RISE, 18);
                hole.moveTo(a[0][0], a[0][1]);
                for (let i = 1; i < a.length; i++) hole.lineTo(a[i][0], a[i][1]);
                hole.lineTo(ST.WALL, -0.4); hole.lineTo(-ST.WALL, -0.4);
                hole.closePath();
                shape.holes.push(hole);
                const g = new THREE.ExtrudeGeometry(shape, { depth: 0.7, bevelEnabled: false });
                put(g, 0, ST.SPRING, ST.SHAFT_S - 0.35);
                P.sCrete.push(g);
            }

            /* the two portal walls, at either end of the platforms, with the
               tunnels going on through them */
            for (const e of [[ST.ZS, -1], [ST.ZN + 0.7, 1]]) {
                C_(-ST.EDGE, ST.PLAT, e[0], ST.EDGE, ST.SPRING + ST.RISE, e[0] + e[1] * 0.8);
                for (const s of [-1, 1]) {
                    C_(s * ST.EDGE, ST.PLAT + 5.4, e[0], s * ST.WALL, ST.SPRING + ST.RISE, e[0] + e[1] * 0.8);
                }
            }
            // and the bores themselves, an annulus extruded, so the train has
            // somewhere to be when it is not here
            {
                const ring = new THREE.Shape();
                ring.absarc(0, 0, 4.3, 0, Math.PI * 2, false);
                const hole = new THREE.Path();
                hole.absarc(0, 0, 3.10, 0, Math.PI * 2, true);
                ring.holes.push(hole);
                for (const s of [-1, 1]) for (const e of [[ST.ZS, 30], [ST.ZN, -30]]) {
                    const g = new THREE.ExtrudeGeometry(ring, { depth: Math.abs(e[1]), bevelEnabled: false, curveSegments: 14 });
                    g.translate(0, 0, e[1] > 0 ? 0 : -Math.abs(e[1]));
                    put(g, s * ST.TRACK, ST.RAIL + 2.6, e[0]);
                    P.sCrete.push(g);
                }
            }

            /* ---- the platform edge, its tactile strip, and the screen doors.

                   Full height, because that is what the Metro Tunnel built and
                   because a person who can walk can walk onto a track. Every
                   post and header is here; the leaves that slide are instanced
                   further down, where the train is. ---- */
            for (const s of [-1, 1]) {
                const x = s * ST.EDGE;
                bx3(P.sTact, null, x - s * 0.62, ST.PLAT - 0.03, ST.PZN, x, ST.PLAT + 0.02, ST.PZS);
                // the header over the whole run, and a post at every jamb
                bx3(P.sSteel, null, x, ST.PLAT + 3.05, ST.PZN, x + s * 0.22, ST.PLAT + 3.45, ST.PZS);
                bx3(P.sSteel, null, x, ST.PLAT, ST.PZN, x + s * 0.22, ST.PLAT + 0.16, ST.PZS);
                let z = ST.PZN;
                for (const dz of doorZs) {
                    if (dz - DOOR_W / 2 > z) {
                        bx3(P.sGlass, null, x + s * 0.02, ST.PLAT + 0.16, z, x + s * 0.16, ST.PLAT + 3.05, dz - DOOR_W / 2);
                    }
                    for (const j of [-1, 1]) {
                        bx3(P.sSteel, null, x, ST.PLAT, dz + j * (DOOR_W / 2), x + s * 0.24, ST.PLAT + 3.05, dz + j * (DOOR_W / 2 + 0.13));
                    }
                    z = dz + DOOR_W / 2;
                }
                bx3(P.sGlass, null, x + s * 0.02, ST.PLAT + 0.16, z, x + s * 0.16, ST.PLAT + 3.05, ST.PZS);
            }

            /* ---- the blade columns down the concourse, their longitudinal
                   beams, and the cone lamps on them: the station's whole
                   lighting scheme and the reason it is warm down here ---- */
            for (const s of [-1, 1]) {
                const x = s * ST.CONC;
                bx3(P.sClad, null, x - 0.19, ST.PLAT + 4.30, ST.PZN, x + 0.19, ST.PLAT + 5.20, ST.PZS);
                for (let i = 0; ; i++) {
                    const z = ST.PZN + 6.0 + i * 7.6;
                    if (z > ST.PZS - 4.0) break;
                    bx3(P.sClad, null, x - 0.16, ST.PLAT, z - 0.55, x + 0.16, ST.PLAT + 4.30, z + 0.55);
                    if (i % 2) continue;
                    const g = coneG(0.42, 0.86, 10);
                    put(g, x + s * 0.60, ST.PLAT + 4.05, z, Math.PI, 0, 0);
                    P.sSign.push(sgn(g, 'warm'));
                }
            }
            /* the light line along the crown of the vault, which is what makes
               a two-hundred-metre tube read as one room */
            {
                const g = boxG(1.30, 0.10, Math.abs(ST.PZN - ST.PZS));
                put(g, 0, ST.SPRING + ST.RISE - 0.24, (ST.PZN + ST.PZS) / 2);
                P.sSign.push(sgn(g, 'strip'));
            }
            // and the cove under the platform edge, washing the floor
            for (const s of [-1, 1]) {
                const g = boxG(0.16, 0.16, Math.abs(ST.PZN - ST.PZS));
                put(g, s * (ST.EDGE - 0.78), ST.PLAT + 2.90, (ST.PZN + ST.PZS) / 2);
                P.sSign.push(sgn(g, 'strip'));
            }
            // the two lines in the haunches, which are what actually light the
            // platforms: the one along the crown lights the vault, and a vault
            // is not what anybody down here is standing on
            for (const s of [-1, 1]) {
                const g = boxG(0.70, 0.14, Math.abs(ST.PZN - ST.PZS));
                put(g, s * (ST.EDGE - 2.6), ST.PLAT + 7.40, (ST.PZN + ST.PZS) / 2);
                P.sSign.push(sgn(g, 'strip'));
            }

            /* ---- the platform signs, hung off the beams where they are hung
                   in every station anybody has ever waited in ---- */
            for (const s of [-1, 1]) for (let i = 0; i < 5; i++) {
                const z = ST.PZN + 16.0 + i * 30.0;
                bx3(P.sClad, null, s * ST.CONC - 0.06, ST.PLAT + 3.55, z - 0.03, s * (ST.CONC + 3.4), ST.PLAT + 3.62, z + 0.03);
                const g = boxG(2.60, 0.80, 0.06);
                put(g, s * (ST.CONC + 1.9), ST.PLAT + 3.10, z);
                P.sSign.push(sgn(g, 'platform'));
            }
            // the station's name on the concourse wall you face coming down
            {
                const g = boxG(9.0, 1.6, 0.06);
                put(g, 0, ST.PLAT + 3.4, ST.SHAFT_S - 0.72);
                P.sSign.push(sgn(g, 'townhall'));
            }

            /* ---- the escalators from the ticket hall down to the concourse.
                   Two and a stair, the same as above, and the same rule: the
                   angle is read off the two ends. ---- */
            {
                const X0 = 14.0, X1 = -6.0, Y0 = ST.HALL, Y1 = ST.PLAT;
                const sl = (Y1 - Y0) / (X1 - X0);
                const yAt = (x) => Y0 + (x - X0) * sl;
                const X2 = X1 - 1.6;
                const bank = (cz, w, stair) => {
                    rampX(w, 0.24, X0, Y0 - 0.12, X2, yAt(X2) - 0.12, cz, stair ? P.sCrete : P.sSteel);
                    rampX(w + 0.90, 1.30, X0, Y0 - 0.95, X2, yAt(X2) - 0.95, cz, P.sCrete);
                    if (stair) {
                        const n = 62;
                        for (let i = 0; i < n; i++) {
                            const xa = X0 + (X1 - X0) * (i / n), xb = X0 + (X1 - X0) * ((i + 1) / n);
                            bx3(P.sCrete, null, xa, yAt(xb) - 0.34, cz - w / 2, xb, yAt(xb), cz + w / 2);
                        }
                    }
                    for (const s of [-1, 1]) {
                        const zz = cz + s * (w / 2 + 0.14);
                        rampX(0.10, 1.02, X0, Y0 + 0.51, X2, yAt(X2) + 0.51, zz, P.gGlass);
                        rampX(0.16, 0.11, X0, Y0 + 1.07, X2, yAt(X2) + 1.07, zz, P.gTrim);
                    }
                };
                bank(-221.4, 1.62, false);
                bank(-223.2, 1.62, false);
                bank(-226.6, 3.00, true);
            }
        }

        /* ------------------------------------------------------------
           21i · the train

           A seven-car HCMT, which is what runs through this tunnel. Not the
           library model in `hcmt.scene.js` — that one is two hundred meshes
           because it is the subject of its own world, and here it is one
           thing standing at a platform in a world that already spends a
           hundred and fifty. So: one car, drawn once as merged geometry with
           the livery on a canvas, stood up seven times as an InstancedMesh,
           with the two nose cars' fronts merged in separately.

           Instanced geometry is left out of the walk's grid on purpose — the
           app cannot know where the instances went — which happens to be
           exactly right for a train that moves.
           ------------------------------------------------------------ */
        const CAR_W = 3.05;
        const TRAIN = { z: BERTH_Z, v: 0, t: 0, phase: 'dwell', door: 1 };
        let trainIM = null, trainNose = null, doorIM = null;
        {
            // the livery: pale champagne body, a dark window band, sky-blue
            // doors, and the yellow front the whole fleet is known by
            const skin = tex(2048, 512, (g, W, H) => {
                const grad = g.createLinearGradient(0, 0, 0, H);
                grad.addColorStop(0.00, '#8f8c86'); grad.addColorStop(0.22, '#c6c3bb');
                grad.addColorStop(0.62, '#b3b0a8'); grad.addColorStop(1.00, '#43454a');
                g.fillStyle = grad; g.fillRect(0, 0, W, H);
                // the window band
                g.fillStyle = '#121316'; g.fillRect(0, H * 0.26, W, H * 0.30);
                // three doors, on the pitch the screen doors are drilled to
                for (let d = 0; d < 3; d++) {
                    const cx = W * ((d + 0.5) / 3), w = W * 0.075;
                    g.fillStyle = '#79bee4'; g.fillRect(cx - w / 2, H * 0.16, w, H * 0.54);
                    g.fillStyle = 'rgba(0,0,0,0.55)'; g.fillRect(cx - 0.8, H * 0.16, 1.6, H * 0.54);
                    g.fillStyle = '#0f1114'; g.fillRect(cx - w / 2 + 3, H * 0.22, w - 6, H * 0.22);
                }
                // the windows between them
                for (let i = 0; i < 12; i++) {
                    const x = W * (0.045 + i * 0.0785);
                    if (Math.abs((x / W) % (1 / 3) - 1 / 6) < 0.045) continue;
                    g.fillStyle = 'rgba(150,178,196,0.16)'; g.fillRect(x, H * 0.28, W * 0.052, H * 0.24);
                }
                // the skirt, and the lime line along the lower body
                g.fillStyle = '#2b2d2f'; g.fillRect(0, H * 0.74, W, H * 0.26);
                g.fillStyle = '#b6d34a'; g.fillRect(0, H * 0.705, W, H * 0.022);
            });
            const skinE = tex(1024, 256, (g, W, H) => {
                g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
                g.fillStyle = '#e8f2ff'; g.fillRect(0, H * 0.28, W, H * 0.26);      // the saloon, lit
                for (let d = 0; d < 3; d++) {
                    const cx = W * ((d + 0.5) / 3), w = W * 0.075;
                    g.fillStyle = '#dff0ff'; g.fillRect(cx - w / 2, H * 0.22, w, H * 0.22);
                }
            });
            const trainMat = stdMat(0xffffff, {
                map: skin, emissive: 0xffffff, emissiveMap: skinE,
                emissiveIntensity: 0.85, roughness: 0.30, metalness: 0.30,
            });

            // one car: body, roof, skirt, and two bogies
            const carP = [];
            let g = boxG(CAR_W, 2.30, CAR_L - 0.6);
            put(g, 0, 2.05, 0); carP.push(g);
            g = boxG(CAR_W - 0.30, 0.70, CAR_L - 0.9);
            put(g, 0, 3.50, 0); carP.push(uvScale(g, 1, 0.12));
            g = boxG(CAR_W - 0.42, 0.86, CAR_L - 0.6);
            put(g, 0, 0.52, 0); carP.push(uvScale(g, 1, 0.12));
            for (const bz of [-CAR_L * 0.29, CAR_L * 0.29]) {
                g = boxG(CAR_W - 0.85, 0.52, 3.20); put(g, 0, 0.62, bz); carP.push(uvScale(g, 1, 0.10));
                for (const wz of [-1.05, 1.05]) for (const s of [-1, 1]) {
                    g = cylG(0.42, 0.42, 0.11, 10);
                    put(g, s * 0.72, 0.42, bz + wz, 0, 0, Math.PI / 2);
                    carP.push(uvScale(g, 0.06, 0.06));
                }
            }
            trainIM = new THREE.InstancedMesh(merge(carP), trainMat, TRAIN_N);
            scene.add(trainIM);
            world.ghost(trainIM);

            // the two cab noses, which are the one part of the train that is
            // not seven of the same thing
            {
                const noseP = [];
                for (const e of [-1, 1]) {
                    const z0 = e * ((TRAIN_N * CAR_L) / 2 - 0.3);
                    let n = boxG(CAR_W - 0.16, 2.10, 1.9);
                    put(n, 0, 2.00, z0 + e * 0.95); noseP.push(uvScale(n, 1, 0.10));
                    n = boxG(CAR_W - 0.55, 1.35, 1.2);
                    put(n, 0, 2.55, z0 + e * 1.75); noseP.push(uvScale(n, 1, 0.10));
                    n = boxG(CAR_W - 0.30, 0.90, 0.5);
                    put(n, 0, 1.10, z0 + e * 2.05); noseP.push(uvScale(n, 1, 0.10));
                }
                trainNose = mesh(merge(noseP), trainMat);
                scene.add(trainNose);
                world.ghost(trainNose);
            }

            /* The doors. Every screen door on both platforms and every train
               door that lines up with one, as one instanced set of leaves —
               they only ever move together, because a train's doors and the
               screen's doors in front of them are one mechanism as far as
               anybody standing on the platform is concerned. The train's
               leaves are scaled to nothing whenever the train is not berthed,
               which is the cheapest way to make them not be there. */
            {
                const leaf = boxG(0.12, 2.86, DOOR_W / 2 - 0.02);
                doorIM = new THREE.InstancedMesh(leaf, M21.glass, doorZs.length * 8);
                scene.add(doorIM);
                world.ghost(doorIM);
            }
        }

        /* A room behind a shopfront, said once for the whole west side.

           A pane with nothing behind it is a black rectangle, and a street of
           black rectangles is the thing that makes a model look like a model.
           Six metres of floor, a back wall with the light on it and a strip in
           the ceiling is all it takes, and merged it costs nothing. */
        const shopRoom = (_unused, face, t0, t1, axis) => {
            const D2 = 6.2, y0 = 0.14, y1 = 4.20;
            if (axis === 'z') {
                F(P.shop, 0x9b968c, face, y0 - 0.10, t0, face - D2, y0, t1);
                F(P.shop, 0xd7d2c6, face, y0, t0, face - D2, y1, t0 + 0.14);
                F(P.shop, 0xd7d2c6, face, y0, t1 - 0.14, face - D2, y1, t1);
                F(P.shop, 0xe4dfd3, face, y1 - 0.12, t0, face - D2, y1, t1);
                P.shopLit.push(shp(put(boxG(0.10, y1 - y0 - 0.4, Math.abs(t1 - t0) - 0.3),
                                   face - D2 + 0.05, (y0 + y1) / 2, (t0 + t1) / 2), 'warm'));
                P.shopLit.push(shp(put(boxG(D2 - 1.2, 0.09, 0.42),
                                   face - D2 / 2, y1 - 0.16, (t0 + t1) / 2), 'cool'));
            } else {
                F(P.shop, 0x9b968c, t0, y0 - 0.10, face, t1, y0, face - D2);
                F(P.shop, 0xd7d2c6, t0, y0, face, t0 - 0.14, y1, face - D2);
                F(P.shop, 0xd7d2c6, t1 + 0.14, y0, face, t1, y1, face - D2);
                F(P.shop, 0xe4dfd3, t0, y1 - 0.12, face, t1, y1, face - D2);
                P.shopLit.push(shp(put(boxG(Math.abs(t1 - t0) - 0.3, y1 - y0 - 0.4, 0.10),
                                   (t0 + t1) / 2, (y0 + y1) / 2, face - D2 + 0.05), 'warm'));
                P.shopLit.push(shp(put(boxG(0.42, 0.09, D2 - 1.2),
                                   (t0 + t1) / 2, y1 - 0.16, face - D2 / 2), 'cool'));
            }
        };

        /* ============================================================
           22 · the west side of Swanston Street, opposite the Town Hall

           Everything here is off the two photographs taken up the street from
           the crossing, and it is built the way the block behind St Paul's is
           built: no facade texture, colour on the vertices, every opening an
           opening. Three things stand here — the terracotta tower on the
           Collins Street corner, the cream one on the Little Collins corner,
           and the run of older frontages between them that faces the Town
           Hall across the road.
           ============================================================ */

        /* ------------------------------------------------------------
           the cream tower on the Little Collins corner

           The other half of the second photograph: the same idea as the
           terracotta one down the street and twenty years later, so the piers
           are thinner, the stone is nearly white, the glass between them is
           green, and instead of gathering into a Gothic crown it steps back
           twice and finishes in a little stepped cap. The thing you actually
           notice first is at the bottom — the corner is rounded, and a
           stainless canopy sweeps all the way round it over the shops.
           ------------------------------------------------------------ */
        {
            const A = P.m2;
            const XF = -BX, ZF = -332.4;                  // Swanston face, Little Collins face
            const X0 = -44.0, ZS = -312.0;
            const D = 0.46, XC = XF - D, ZC = ZF + D;
            const Y_SHOP = 4.90, Y_ENT = 6.30;
            const FH = 3.28, FLOORS = 13, Y_TOP = Y_ENT + FH * FLOORS;    // 48.9
            const PITCH = 1.48, PW = 0.52, R = 5.6;       // pier pitch, width, corner radius
            const C = { face: 0xd7d1c2, hi: 0xefe9d8, lo: 0xa9a396, deep: 0x5f5c54 };
            const GL_LO = 0x24403f, GL_HI = 0x86ada6;     // the green glass, sill to head

            F(A, C.lo, X0, 0, ZS, XC, Y_TOP, ZC);

            // ---- the piers, both elevations, the glass sunk between them
            const runZ = Math.floor((ZS - ZF - R) / PITCH);
            for (let i = 0; i <= runZ; i++) {
                const z = ZF + R + i * PITCH;
                F(A, C.face, XF, Y_ENT, z - PW / 2, XC, Y_TOP, z + PW / 2);
                if (i === runZ) break;
                for (let f = 0; f < FLOORS; f++) {
                    const y = Y_ENT + f * FH;
                    W(A, XC, y + 0.46, z + PW / 2, XC + 0.07, y + FH - 0.30, z + PITCH - PW / 2, GL_LO, GL_HI);
                    F(A, C.lo, XF - 0.16, y, z + PW / 2, XC, y + 0.46, z + PITCH - PW / 2);
                }
            }
            const runX = Math.floor((XF - R - X0) / PITCH);
            for (let i = 0; i <= runX; i++) {
                const x = XF - R - i * PITCH;
                F(A, C.face, x - PW / 2, Y_ENT, ZF, x + PW / 2, Y_TOP, ZC);
                if (i === runX) break;
                for (let f = 0; f < FLOORS; f++) {
                    const y = Y_ENT + f * FH;
                    W(A, x - PW / 2, y + 0.46, ZC, x - PITCH + PW / 2, y + FH - 0.30, ZC - 0.07, GL_LO, GL_HI);
                    F(A, C.lo, x - PW / 2, y, ZF + 0.16, x - PITCH + PW / 2, y + 0.46, ZC);
                }
            }
            // ---- and the corner, which is a quadrant of the same piers
            for (let i = 0; i <= 5; i++) {
                const a = (Math.PI / 2) * (i / 5);
                const px = XF - R + Math.sin(a) * R, pz = ZF + R - Math.cos(a) * R;
                const g = boxG(PW, Y_TOP - Y_ENT, PW * 1.5);
                put(g, px, (Y_ENT + Y_TOP) / 2, pz, 0, -a, 0);
                FG(A, C.face, g);
                if (i === 5) break;
                const a2 = (Math.PI / 2) * ((i + 0.5) / 5);
                const qx = XF - R + Math.sin(a2) * (R - 0.30), qz = ZF + R - Math.cos(a2) * (R - 0.30);
                for (let f = 0; f < FLOORS; f++) {
                    const y = Y_ENT + f * FH;
                    const w = boxG(1.05, FH - 0.76, 0.07);
                    put(w, qx, y + (FH + 0.16) / 2, qz, 0, -a2 + Math.PI / 2, 0);
                    A.push(pane(w, GL_LO, GL_HI, y + 0.46, y + FH - 0.30));
                }
            }
            F(A, C.lo, XF - R, Y_ENT, ZF, XC, Y_TOP, ZF + R);      // the corner's own core

            /* ---- the shopfronts, and the stainless canopy that runs round
                    the corner over them — the one detail of this building
                    everybody has stood under ---- */
            for (let i = 0; i < 5; i++) {
                const z0 = ZF + R + 0.4 + i * 2.9, z1 = z0 + 2.4;
                P.shopGlass.push(put(boxG(0.08, 3.55, z1 - z0), XC + 0.04, 2.10, (z0 + z1) / 2));
                F(A, C.deep, XF + 0.02, 0, z0 - 0.25, XC, Y_SHOP, z0);
                F(A, 0x26262a, XF + 0.02, 0, z0, XC, 0.42, z1);
                P.shopLit.push(shp(put(boxG(0.06, 0.52, z1 - z0 - 0.3), XF + 0.10, 4.24, (z0 + z1) / 2),
                                   ['sbux', 'noodle', 'cool'][i % 3]));
                shopRoom(null, XC, z0, z1, 'z');
            }
            for (let i = 0; i < 6; i++) {
                const x0 = XF - R - 0.4 - i * 2.9, x1 = x0 - 2.4;
                P.shopGlass.push(put(boxG(Math.abs(x1 - x0), 3.55, 0.08), (x0 + x1) / 2, 2.10, ZC - 0.04));
                F(A, C.deep, x0 + 0.25, 0, ZF + 0.02, x0, Y_SHOP, ZC);
                F(A, 0x26262a, x0, 0, ZF + 0.02, x1, 0.42, ZC);
                P.shopLit.push(shp(put(boxG(Math.abs(x1 - x0) - 0.3, 0.52, 0.06),
                                   (x0 + x1) / 2, 4.24, ZF + 0.10), ['noodle', 'warm', 'sbux'][i % 3]));
                shopRoom(null, ZC, x0, x1, 'x');
            }
            // the canopy: straight along both streets, and eight facets round
            F(A, 0xb9bec0, XF + 1.65, Y_SHOP, ZF + R, XC, Y_SHOP + 0.34, ZS);
            F(A, 0xb9bec0, XF - R, Y_SHOP, ZF + 1.65, X0, Y_SHOP + 0.34, ZC);
            F(A, 0x8e9397, XF + 1.70, Y_SHOP - 0.26, ZF + R, XF + 1.58, Y_SHOP + 0.34, ZS);
            F(A, 0x8e9397, XF - R, Y_SHOP - 0.26, ZF + 1.70, X0, Y_SHOP + 0.34, ZF + 1.58);
            for (let i = 0; i < 8; i++) {
                const a0 = (Math.PI / 2) * (i / 8), a1 = (Math.PI / 2) * ((i + 1) / 8);
                const am = (a0 + a1) / 2, rr2 = R + 1.65;
                const g = boxG(rr2 * 0.42, 0.34, 1.9);
                put(g, XF - R + Math.sin(am) * (rr2 - 0.95), Y_SHOP + 0.17,
                       ZF + R - Math.cos(am) * (rr2 - 0.95), 0, -am, 0);
                FG(A, 0xb9bec0, g);
                const f2 = boxG(rr2 * 0.42, 0.60, 0.12);
                put(f2, XF - R + Math.sin(am) * rr2, Y_SHOP + 0.04,
                        ZF + R - Math.cos(am) * rr2, 0, -am, 0);
                FG(A, 0x8e9397, f2);
            }
            // ---- the entablature, and the two setbacks and the cap on top
            F(A, C.hi, XF + 0.26, Y_ENT - 0.55, ZF - 0.26, X0, Y_ENT, ZS);
            F(A, C.hi, XF + 0.26, Y_TOP, ZF - 0.26, X0 + 1, Y_TOP + 0.50, ZS + 1);
            for (let k = 0; k < 2; k++) {
                const y0 = Y_TOP + 0.5 + k * 3.9, ins = 2.6 + k * 3.4;
                F(A, C.lo, XF - ins - 9, y0, ZF + ins, XC - ins, y0 + 3.9, ZF + ins + 9);
                for (let i = 0; i < 7; i++) {
                    F(A, C.face, XF - ins, y0, ZF + ins + i * 1.3, XC - ins, y0 + 3.9, ZF + ins + i * 1.3 + 0.44);
                    F(A, C.face, XF - ins - i * 1.3, y0, ZF + ins, XF - ins - i * 1.3 - 0.44, y0 + 3.9, ZC - ins);
                }
                F(A, C.hi, XF - ins + 0.24, y0 + 3.9, ZF + ins - 0.24, XC - ins - 9, y0 + 4.3, ZF + ins + 9);
            }
            {
                const y0 = Y_TOP + 8.8;
                F(A, C.face, XF - 9.4, y0, ZF + 9.4, XF - 5.6, y0 + 4.4, ZF + 13.2);
                F(A, C.hi,   XF - 9.8, y0 + 4.4, ZF + 9.0, XF - 5.2, y0 + 5.0, ZF + 13.6);
                F(A, C.face, XF - 8.9, y0 + 5.0, ZF + 9.9, XF - 6.1, y0 + 7.4, ZF + 12.7);
                F(A, C.hi,   XF - 8.3, y0 + 7.4, ZF + 10.5, XF - 6.7, y0 + 8.6, ZF + 12.1);
            }
        }

        /* ------------------------------------------------------------
           and the frontage between them — the side of the street the Town
           Hall looks at

           Three buildings of three different centuries standing shoulder to
           shoulder, which is what the second photograph shows and what
           Swanston Street actually is: an Edwardian block with a heavy
           cornice, a brown Victorian with arched windows and cast-iron
           balconettes, and a white sixties slab with its floors in bands.
           Shops and awnings under all three.
           ------------------------------------------------------------ */
        {
            const A = P.m3;
            const XF = -BX, X0 = -44.0, D = 0.42, XC = XF - D;
            const shopRun = (z0, z1, n, faces) => {
                for (let i = 0; i < n; i++) {
                    const a = z0 - (z0 - z1) * (i / n) - 0.35, b = z0 - (z0 - z1) * ((i + 1) / n) + 0.35;
                    P.shopGlass.push(put(boxG(0.08, 3.30, Math.abs(b - a)), XC + 0.04, 1.95, (a + b) / 2));
                    F(A, 0x232326, XF + 0.02, 0, a, XC, 0.40, b);
                    F(A, 0x2c2a26, XF + 0.04, 0, a + 0.35, XC, 4.10, a + 0.50);
                    P.shopLit.push(shp(put(boxG(0.06, 0.55, Math.abs(b - a) - 0.4), XF + 0.10, 4.42, (a + b) / 2),
                                       faces[i % faces.length]));
                    shopRoom(null, XC, a, b, 'z');
                    // the awning, on two rods, which is most of what a
                    // Melbourne footpath is made of
                    F(A, 0x33322e, XF + 2.30, 3.55, a - 0.1, XF + 0.06, 3.72, b + 0.1);
                    F(A, 0x8a2f26, XF + 2.38, 3.10, a - 0.1, XF + 2.24, 3.72, b + 0.1);
                    for (const zz of [a - 0.05, b + 0.05]) {
                        const g = cylG(0.04, 0.04, 1.9, 5);
                        put(g, XF + 1.25, 4.30, zz, 0, 0, Math.PI / 2.9);
                        FG(A, 0x33322e, g);
                    }
                }
            };

            // ---- the Edwardian, next to the cream tower
            {
                const ZS = -296.0, ZN = -312.0, Y0 = 5.20, FH = 3.75, FLOORS = 6;
                const Y_TOP = Y0 + FH * FLOORS, E = { f: 0xd2c6a9, h: 0xeadfc4, l: 0xa79b82 };
                F(A, E.l, X0, Y0, ZS, XC, Y_TOP, ZN);
                F(A, E.l, XF - 9, 0, ZS, X0, Y0, ZN);
                for (let i = 0; i <= 4; i++) {
                    const z = ZS - i * ((ZS - ZN) / 4);
                    F(A, E.f, XF, Y0, z + 0.62, XC, Y_TOP, z - 0.62);
                }
                for (let i = 0; i < 4; i++) {
                    const zc = ZS - (i + 0.5) * ((ZS - ZN) / 4);
                    for (let f = 0; f < FLOORS; f++) {
                        const y = Y0 + 0.35 + f * FH;
                        for (const s2 of [-1, 1]) {
                            W(A, XC, y + 0.75, zc + s2 * 0.30, XC + 0.07, y + FH - 0.55, zc + s2 * 1.35);
                            F(A, E.l, XF - 0.18, y + 0.52, zc + s2 * 0.30, XC, y + 0.75, zc + s2 * 1.48);
                            F(A, E.h, XF - 0.10, y + FH - 0.55, zc + s2 * 0.24, XC, y + FH - 0.30, zc + s2 * 1.48);
                        }
                        F(A, E.f, XF, y, zc + 0.30, XC, y + FH, zc - 0.30);
                    }
                }
                F(A, E.f, XF - 0.20, Y_TOP, ZS, XC, Y_TOP + 0.32, ZN);
                for (let i = 0; i < 22; i++) {
                    const z = ZS - 0.4 - i * ((ZS - ZN - 0.8) / 21);
                    F(A, E.h, XF - 0.78, Y_TOP + 0.32, z + 0.14, XF - 0.06, Y_TOP + 1.05, z - 0.14);
                }
                F(A, E.h, XF - 0.96, Y_TOP + 1.05, ZS - 0.2, XC, Y_TOP + 1.48, ZN + 0.2);
                F(A, E.f, XF - 0.24, Y_TOP + 1.48, ZS, XF + 0.20, Y_TOP + 3.10, ZN);
                shopRun(ZS, ZN, 4, ['sbux', 'cool', 'noodle', 'warm']);
            }

            // ---- the brown Victorian in the middle
            {
                const ZS = -276.0, ZN = -296.0, Y0 = 5.20, FH = 3.95, FLOORS = 4;
                const Y_TOP = Y0 + FH * FLOORS, V = { f: 0x8f7357, h: 0xc0a888, l: 0x6b5643 };
                F(A, V.l, X0, Y0, ZS, XC, Y_TOP, ZN);
                F(A, V.l, XF - 9, 0, ZS, X0, Y0, ZN);
                for (let i = 0; i <= 5; i++) {
                    const z = ZS - i * ((ZS - ZN) / 5);
                    F(A, V.f, XF, Y0, z + 0.55, XC, Y_TOP, z - 0.55);
                    F(A, V.h, XF - 0.24, Y0, z + 0.70, XC, Y0 + 0.44, z - 0.70);
                    F(A, V.h, XF - 0.24, Y_TOP - 0.60, z + 0.70, XC, Y_TOP - 0.16, z - 0.70);
                }
                for (let i = 0; i < 5; i++) {
                    const zc = ZS - (i + 0.5) * ((ZS - ZN) / 5);
                    for (let f = 0; f < FLOORS; f++) {
                        const y = Y0 + 0.5 + f * FH;
                        const h = y + FH - 1.35;
                        W(A, XC, y + 0.6, zc + 1.05, XC + 0.07, h, zc - 1.05);
                        const arc = new THREE.CircleGeometry(1.05, 12, 0, Math.PI);
                        put(arc, XC + 0.03, h, zc, 0, Math.PI / 2, 0);
                        A.push(pane(arc, CF.glassLo, CF.glassHi, h - 2.1, h));
                        const ring = new THREE.TorusGeometry(1.20, 0.16, 5, 12, Math.PI);
                        put(ring, XF - 0.08, h, zc, 0, Math.PI / 2, 0);
                        FG(A, V.h, ring);
                        F(A, V.h, XF - 0.26, y + 0.34, zc + 1.34, XC, y + 0.60, zc - 1.34);
                        if (f === 1) {                     // a cast-iron balconette
                            for (let b = 0; b < 9; b++) {
                                const g = cylG(0.035, 0.035, 0.68, 5);
                                put(g, XF - 0.34, y + 0.68, zc - 1.0 + b * 0.25);
                                FG(A, 0x2a2724, g);
                            }
                            F(A, 0x2a2724, XF - 0.44, y + 1.00, zc + 1.15, XF - 0.24, y + 1.10, zc - 1.15);
                            F(A, 0x2a2724, XF - 0.44, y + 0.30, zc + 1.15, XF - 0.24, y + 0.40, zc - 1.15);
                        }
                    }
                }
                F(A, V.h, XF - 0.34, Y_TOP, ZS, XC, Y_TOP + 0.40, ZN);
                F(A, V.h, XF - 0.72, Y_TOP + 0.40, ZS - 0.2, XC, Y_TOP + 0.96, ZN + 0.2);
                F(A, V.f, XF - 0.20, Y_TOP + 0.96, ZS, XF + 0.18, Y_TOP + 2.60, ZN);
                for (let i = 0; i < 6; i++) {
                    const z = ZS - 1.2 - i * ((ZS - ZN - 2.4) / 5);
                    const g = cylG(0.20, 0.26, 1.0, 8);
                    put(g, XF - 0.02, Y_TOP + 3.10, z);
                    FG(A, V.h, g);
                }
                shopRun(ZS, ZN, 5, ['noodle', 'sbux', 'warm', 'cool', 'noodle']);
            }

            // ---- and the sixties slab at the Collins end
            {
                const ZS = -250.5, ZN = -276.0, Y0 = 5.60, FH = 3.15, FLOORS = 11;
                const Y_TOP = Y0 + FH * FLOORS, S6 = { f: 0xd6d6d0, h: 0xeceae2, l: 0x9d9d97 };
                F(A, S6.l, X0, Y0, ZS, XC, Y_TOP, ZN);
                F(A, S6.l, XF - 9, 0, ZS, X0, Y0, ZN);
                for (let f = 0; f < FLOORS; f++) {
                    const y = Y0 + f * FH;
                    W(A, XC, y + 0.90, ZS - 0.5, XC + 0.07, y + FH - 0.35, ZN + 0.5);
                    F(A, S6.f, XF, y, ZS - 0.5, XC, y + 0.90, ZN + 0.5);           // the spandrel band
                    F(A, S6.h, XF - 0.22, y + 0.62, ZS - 0.6, XC, y + 0.90, ZN + 0.6);
                    for (let i = 0; i <= 8; i++) {                                  // the mullions
                        const z = ZS - 0.5 - i * ((ZS - ZN - 1.0) / 8);
                        F(A, S6.f, XF - 0.08, y + 0.90, z - 0.09, XC, y + FH - 0.35, z + 0.09);
                    }
                }
                F(A, S6.f, XF, Y0, ZS, XC, Y_TOP, ZS - 0.5);
                F(A, S6.f, XF, Y0, ZN, XC, Y_TOP, ZN + 0.5);
                F(A, S6.h, XF - 0.30, Y_TOP, ZS, XC, Y_TOP + 0.44, ZN);
                F(A, S6.l, XF - 0.10, Y_TOP + 0.44, ZS, XF + 0.16, Y_TOP + 1.60, ZN);
                shopRun(ZS, ZN, 6, ['boss', 'coco', 'sbux', 'warm', 'noodle', 'cool']);
            }
        }

        /* ============================================================
           23 · the west side of Swanston, Flinders Lane to Collins Street

           Directly opposite City Square and the station entrance, and the
           thing you are looking at whenever you stand in the square. A
           terracotta Gothic tower stood on this corner until now and it is the
           wrong building on the wrong corner: what is here is a white
           curtain-walled office block of about 1970 — eighteen floors of the
           same narrow window between the same precast mullion, a sharp
           corner, no crown at all, and a black fascia round the bottom of it.
           The whole character of the thing is that it does not vary. Building
           it means resisting the urge to give it something to look at.

           Then, going south towards Flinders Lane: a dark slab with fins, a
           bronze one with the burger shop under it, an older rendered
           building with a sign up its flank, and a little classical bank on
           the Flinders Lane corner. And behind the tower, on Collins Street,
           the open-deck car park.
           ============================================================ */
        {
            const XF = -BX;                                   // the Swanston building line
            const WT = { pale: 0xd8d6cf, hi: 0xeeece4, lo: 0x9d9c96, dark: 0x484b50 };

            /* ---- the tower on the Collins Street corner ---- */
            {
                const A = P.w1;
                const ZF = -209.5, ZS = -186.0, X0 = -44.0;
                const D = 0.30, XC = XF - D, ZC = ZF + D;
                const Y_FAS = 1.55, Y_POD = 9.60, Y_T0 = 10.55;
                const FH = 3.23, FLOORS = 16, Y_TOP = Y_T0 + FH * FLOORS;   // 62.2
                const P_E = 1.45, P_N = 1.42;                 // the mullion pitch, each way
                const NE = Math.round((ZS - ZF) / P_E), NN = Math.round((XF - X0) / P_N);

                F(A, WT.lo, X0, 0, ZS, XC, Y_TOP, ZC);

                /* the podium: two floors of dark glass in a plain grid, and
                   the black fascia with the bank's name round the foot of it */
                F(A, WT.dark, XC, 0, ZF, XF + 0.10, Y_FAS, ZS);
                F(A, WT.dark, XF - 0.10, 0, ZC, X0, Y_FAS, ZF);
                for (let i = 0; i < 2; i++) {
                    P.shopLit.push(shp(put(boxG(0.06, 0.62, 3.4), XF + 0.16, 0.94, ZF + 3.4 + i * 9.5), 'wales'));
                    P.shopLit.push(shp(put(boxG(3.4, 0.62, 0.06), XF - 3.4 - i * 9.5, 0.94, ZF - 0.16), 'wales'));
                }
                for (let f = 0; f < 2; f++) {
                    const y = Y_FAS + 0.30 + f * 3.85;
                    W(A, XC, y, ZF + 0.4, XC + 0.07, y + 3.20, ZS - 0.4, 0x1b2228, 0x54707e);
                    W(A, XF - 0.4, y, ZC, X0 + 0.4, y + 3.20, ZC - 0.07, 0x1b2228, 0x54707e);
                    F(A, WT.dark, XC, y + 3.20, ZF, XF + 0.04, y + 3.85, ZS);
                    F(A, WT.dark, XF - 0.04, y + 3.20, ZC, X0, y + 3.85, ZF);
                    for (let i = 0; i <= NE; i++) {
                        const z = ZF + i * ((ZS - ZF) / NE);
                        F(A, WT.dark, XC, y, z - 0.07, XF + 0.02, y + 3.20, z + 0.07);
                    }
                    for (let i = 0; i <= NN; i++) {
                        const x = XF - i * ((XF - X0) / NN);
                        F(A, WT.dark, x - 0.07, y, ZC, x + 0.07, y + 3.20, ZF + 0.02);
                    }
                }
                // the white slab that separates the podium from the tower
                F(A, WT.hi, XF + 0.46, Y_POD, ZF - 0.46, X0, Y_T0, ZS);
                F(A, WT.hi, XF + 0.46, Y_POD, ZF - 0.46, XC, Y_T0, ZC);

                /* the tower. A mullion every metre and a half running the whole
                   height without a break, a window between each pair, a
                   spandrel at every floor — and nothing else, ever. Written
                   out twice rather than through one clever helper, because the
                   two elevations run along different axes and the last time I
                   tried to share that the signs came out mirrored. */
                {
                    const PE = (ZS - ZF) / NE, PN = (XF - X0) / NN;
                    for (let i = 0; i <= NE; i++) {                 // Swanston
                        const z = ZF + i * PE;
                        F(A, WT.hi, XC, Y_T0, z - 0.15, XF + 0.30, Y_TOP, z + 0.15);
                        if (i === NE) break;
                        for (let f = 0; f < FLOORS; f++) {
                            const y = Y_T0 + f * FH;
                            W(A, XC, y + 0.86, z + 0.15, XC + 0.07, y + FH - 0.10, z + PE - 0.15,
                              0x223440, 0x8fa9b6);
                            F(A, WT.pale, XC, y, z + 0.15, XF + 0.14, y + 0.86, z + PE - 0.15);
                        }
                    }
                    for (let i = 0; i <= NN; i++) {                 // Collins
                        const x = XF - i * PN;
                        F(A, WT.hi, x - 0.15, Y_T0, ZC, x + 0.15, Y_TOP, ZF - 0.30);
                        if (i === NN) break;
                        for (let f = 0; f < FLOORS; f++) {
                            const y = Y_T0 + f * FH;
                            W(A, x - 0.15, y + 0.86, ZC, x - PN + 0.15, y + FH - 0.10, ZC - 0.07,
                              0x223440, 0x8fa9b6);
                            F(A, WT.pale, x - 0.15, y, ZC, x - PN + 0.15, y + 0.86, ZF - 0.14);
                        }
                    }
                }
                // the corner, the one place the grid is wider
                F(A, WT.hi, XC, Y_T0, ZF - 0.02, XF + 0.30, Y_TOP, ZF + 0.34);
                F(A, WT.hi, XF - 0.34, Y_T0, ZC, XF + 0.02, Y_TOP, ZF - 0.30);
                // and the parapet, which is all this building gets
                F(A, WT.hi, XF + 0.42, Y_TOP, ZF - 0.42, X0, Y_TOP + 1.10, ZS);
                F(A, WT.hi, XF + 0.42, Y_TOP, ZF - 0.42, XC, Y_TOP + 1.10, ZC);
                F(A, WT.lo, XF + 0.10, Y_TOP + 1.10, ZF - 0.10, X0 + 1, Y_TOP + 1.45, ZS + 1);
                F(A, WT.lo, X0 + 5, Y_TOP + 1.45, ZF + 4, X0 + 12, Y_TOP + 4.2, ZF + 11);
                const mast = cylG(0.05, 0.09, 6.5, 5);
                put(mast, XF - 6.0, Y_TOP + 4.5, ZF + 5.0);
                FG(A, WT.dark, mast);
            }

            /* ---- and what stands south of it, down to Flinders Lane ---- */
            {
                const A = P.w2;
                const N = [
                    /* dark slab with fins */      { z0: -186.0, z1: -168.0, x1: -42, top: 37.0, kind: 'fin' },
                    /* bronze, burger shop */      { z0: -168.0, z1: -150.0, x1: -42, top: 29.0, kind: 'bronze' },
                    /* rendered, sign up its side */{ z0: -150.0, z1: -136.0, x1: -40, top: 25.0, kind: 'render' },
                    /* the little bank */          { z0: -136.0, z1: SQ.BZ0, x1: -40, top: 19.5, kind: 'bank' },
                ];
                for (const B of N) {
                    const D = 0.36, XC = XF - D, span = Math.abs(B.z1 - B.z0);

                    if (B.kind === 'fin') {
                        F(A, 0x8b8f93, B.x1, 0, B.z0, XC, B.top, B.z1);
                        for (let f = 0; f < 10; f++) {
                            const y = 5.4 + f * 3.15;
                            W(A, XC, y, B.z0 - 0.4, XC + 0.07, y + 2.35, B.z1 + 0.4, 0x1a2026, 0x4e6672);
                            F(A, 0x9aa0a4, XF, y + 2.35, B.z0 - 0.4, XC, y + 3.15, B.z1 + 0.4);
                        }
                        for (let i = 0; i <= 12; i++) {
                            const z = B.z0 - span * (i / 12);
                            F(A, 0xb2b6b8, XF - 0.34, 5.0, z - 0.10, XC, B.top, z + 0.10);
                        }
                        F(A, 0x9aa0a4, XF - 0.30, B.top, B.z0, XC, B.top + 1.2, B.z1);

                    } else if (B.kind === 'bronze') {
                        F(A, 0x9e8866, B.x1, 0, B.z0, XC, B.top, B.z1);
                        for (let f = 0; f < 8; f++) {
                            const y = 5.4 + f * 2.95;
                            W(A, XC, y + 0.72, B.z0 - 0.5, XC + 0.07, y + 2.60, B.z1 + 0.5, 0x241d16, 0x6e6152);
                            F(A, 0xb39b76, XF - 0.16, y, B.z0 - 0.5, XC, y + 0.72, B.z1 + 0.5);
                            F(A, 0xc6ae88, XF - 0.24, y + 0.46, B.z0 - 0.7, XC, y + 0.72, B.z1 + 0.7);
                        }
                        F(A, 0xb39b76, XF - 0.34, B.top, B.z0, XC, B.top + 1.0, B.z1);
                        P.shopLit.push(shp(put(boxG(0.06, 0.95, 5.0), XF + 0.12, 4.55,
                                           (B.z0 + B.z1) / 2), 'maccas'));

                    } else if (B.kind === 'render') {
                        F(A, 0xc6bda8, B.x1, 0, B.z0, XC, B.top, B.z1);
                        for (let f = 0; f < 6; f++) {
                            const y = 5.4 + f * 3.20;
                            for (let i = 0; i < 4; i++) {
                                const zc = B.z0 - span * ((i + 0.5) / 4);
                                W(A, XC, y + 0.62, zc + 1.15, XC + 0.07, y + 2.55, zc - 1.15);
                                F(A, 0xa89c84, XF - 0.18, y + 0.40, zc + 1.38, XC, y + 0.62, zc - 1.38);
                                F(A, 0xdad2bc, XF - 0.12, y + 2.55, zc + 1.30, XC, y + 2.78, zc - 1.30);
                            }
                            F(A, 0xc6bda8, XF, y, B.z0, XC, y + 0.40, B.z1);
                        }
                        F(A, 0xdad2bc, XF - 0.40, B.top, B.z0, XC, B.top + 0.9, B.z1);
                        F(A, 0xc6bda8, XF - 0.16, B.top + 0.9, B.z0, XF + 0.20, B.top + 2.4, B.z1);
                        // the sign up its flank, which is what you actually
                        // remember about this building from the square
                        F(A, 0x3c3a34, XF + 0.46, 7.0, B.z1 + 1.5, XF + 0.10, 20.5, B.z1 + 2.6);
                        P.shopLit.push(shp(put(boxG(0.06, 13.0, 1.05), XF + 0.52, 13.7,
                                           B.z1 + 2.05), 'stpaul'));

                    } else {
                        F(A, 0xcfc4a8, B.x1, 0, B.z0, XC, B.top, B.z1);
                        F(A, 0x8d8272, XF - 0.10, 0, B.z0, XC, 1.10, B.z1);
                        for (let i = 0; i <= 4; i++) {                    // a giant order
                            const z = B.z0 - span * (i / 4);
                            F(A, 0xe0d6ba, XF - 0.62, 1.10, z + 0.55, XC, B.top - 2.4, z - 0.55);
                            F(A, 0xefe6cc, XF - 0.80, B.top - 2.4, z + 0.72, XC, B.top - 1.8, z - 0.72);
                        }
                        for (let f = 0; f < 3; f++) {
                            const y = 2.2 + f * 4.6;
                            for (let i = 0; i < 4; i++) {
                                const zc = B.z0 - span * ((i + 0.5) / 4);
                                W(A, XC, y, zc + 1.05, XC + 0.07, y + 3.30, zc - 1.05);
                                F(A, 0xb7ab90, XF - 0.20, y - 0.22, zc + 1.28, XC, y, zc - 1.28);
                            }
                        }
                        F(A, 0xe0d6ba, XF - 0.46, B.top - 1.8, B.z0, XC, B.top - 1.2, B.z1);
                        for (let i = 0; i < 16; i++) {
                            const z = B.z0 - 0.3 - i * ((span - 0.6) / 15);
                            F(A, 0xefe6cc, XF - 0.96, B.top - 1.2, z + 0.13, XF - 0.10, B.top - 0.5, z - 0.13);
                        }
                        F(A, 0xefe6cc, XF - 1.14, B.top - 0.5, B.z0 - 0.2, XC, B.top, B.z1 + 0.2);
                        F(A, 0xcfc4a8, XF - 0.30, B.top, B.z0, XF + 0.22, B.top + 1.9, B.z1);
                    }

                    /* the shops under every one of them, because this side of
                       the street is shops the whole way and always has been */
                    const n = Math.max(2, Math.round(span / 5.4));
                    for (let i = 0; i < n; i++) {
                        const a = B.z0 - span * (i / n) - 0.35, b = B.z0 - span * ((i + 1) / n) + 0.35;
                        P.shopGlass.push(put(boxG(0.08, 3.30, Math.abs(b - a)), XC + 0.04, 1.95, (a + b) / 2));
                        F(A, 0x232326, XF + 0.02, 0, a, XC, 0.40, b);
                        F(A, 0x2c2a26, XF + 0.04, 0, a + 0.35, XC, 4.10, a + 0.50);
                        P.shopLit.push(shp(put(boxG(0.06, 0.55, Math.abs(b - a) - 0.4),
                                           XF + 0.10, 4.42, (a + b) / 2),
                                       ['sbux', 'noodle', 'cool', 'boss'][i % 4]));
                        shopRoom(null, XC, a, b, 'z');
                        F(A, 0x33322e, XF + 2.30, 3.55, a - 0.1, XF + 0.06, 3.72, b + 0.1);
                        F(A, 0x7a2a22, XF + 2.38, 3.10, a - 0.1, XF + 2.24, 3.72, b + 0.1);
                    }
                }

                /* ---- and the car park behind the tower, on Collins Street:
                        eight open decks with a spandrel across each and the
                        ramp showing through, which is the one building on this
                        block nobody has ever looked at twice ---- */
                {
                    const X1 = -46.0, X0 = -66.0, ZF = -209.5, ZS = -192.0;
                    F(A, 0x9a7b5e, X0, 0, ZS, X1, 5.0, ZF + 0.4);
                    for (let f = 0; f < 8; f++) {
                        const y = 5.0 + f * 3.05;
                        F(A, 0xa88a68, X0, y, ZS, X1, y + 0.44, ZF);          // the deck
                        F(A, 0x8a6e52, X0 + 0.2, y + 0.44, ZS, X1 - 0.2, y + 1.30, ZF - 0.14);
                        F(A, 0x2b2622, X0 + 0.3, y + 1.30, ZS, X1 - 0.3, y + 3.05, ZF - 0.30);
                        for (let i = 0; i <= 5; i++) {
                            const x = X0 + (X1 - X0) * (i / 5);
                            F(A, 0xa88a68, x - 0.26, y, ZF - 0.42, x + 0.26, y + 3.05, ZF);
                        }
                    }
                    F(A, 0xa88a68, X0 - 0.2, 5.0 + 8 * 3.05, ZS, X1 + 0.2, 5.0 + 8 * 3.05 + 1.1, ZF - 0.2);
                    P.shopLit.push(shp(put(boxG(1.9, 4.6, 0.06), X1 - 2.6, 12.0, ZF - 0.10), 'parking'));
                }
            }
        }

        /* ------------------------------------------------------------
           21j · everything merged, and the one thing that moves
           ------------------------------------------------------------ */
        {
            /* Three objects, each a group of the meshes it is made of — the
               shape `cathedral_00` and `fedsquare_00` already have, and the
               reason somebody in edit mode picks up the hotel rather than
               picking up every pale surface in the precinct. */
            const OBJECTS = [
                ['centurybuilding_00', [[P.m2, M21.body]], []],
                ['walescorner_00', [[P.w1, M21.body]], []],
                ['swanstonwestlower_00', [[P.w2, M21.body]], []],
                ['swanstonwest_00', [[P.m3, M21.body]], []],
                ['westin_00', [[P.b2, M21.body], [P.b2g, M21.glass], [P.b2l, M21.lit]], []],
                ['swanstonwestshops_00', [[P.shop, M21.body], [P.shopGlass, M21.glass],
                                      [P.shopLit, M21.lit]], []],
                ['citysquare_00', [
                    [P.qSteel, M21.steel], [P.qClad, M21.batten], [P.qGlass, M21.glass],
                    [P.qTrim, M21.bronze], [P.qSign, M21.sign],
                ], [
                    // The canopy deck is nine metres up over open paving with
                    // no way onto it, so it is scenery rather than surface.
                    // Ghosted, it stops spending one of the four vertical spans
                    // the walk keeps per cell on every square metre of the
                    // plaza — spans the plaza needs for the paving, the ticket
                    // hall and the platform under them.
                    [P.qRoof, M21.soffit],
                ]],
                ['townhallstation_00', [
                    [P.sCrete, M21.crete], [P.sSteel, M21.steel], [P.sClad, M21.batten],
                    [P.sGlass, M21.glass], [P.sTrim, M21.bronze], [P.sSign, M21.sign],
                    [P.sTact, M21.tact],
                ], [
                    /* And the balustrades down the escalators, for a reason
                       worth writing down: the walk merges two surfaces less
                       than 1.4 m apart into one solid, because nobody fits
                       between them. A metre of glass standing on an escalator
                       deck is exactly that — so left solid, the surface the
                       walk offers down the whole flight is the top of the
                       handrail, and you ride to the platform floating a metre
                       above the steps. The deck is what you stand on; the rail
                       beside it is scenery, and the batten walls either side of
                       the bank are what actually stops anybody. */
                    [P.gGlass, M21.glass], [P.gTrim, M21.rail],
                ]],
            ];
            for (const [name, solid, ghosted] of OBJECTS) {
                const group = new THREE.Group();
                for (const [parts, mat] of solid) {
                    if (!parts.length) continue;
                    const m = merged(parts, mat);
                    m.receiveShadow = true;
                    group.add(m);
                }
                for (const [parts, mat] of ghosted) {
                    if (!parts.length) continue;
                    const m = merged(parts, mat);
                    world.ghost(m);
                    group.add(m);
                }
                scene.add(group);
                world.part(name, group);
            }
        }

        /* The train, and the doors with it. One eighty-second round: it stands
           at the platform with the doors open, they close, it goes north into
           the tunnel, and two minutes of railway later another one comes in
           from the south and stops in the same place. Nothing in here
           allocates — the matrix and the two vectors are made once, up
           there, and composed into every frame. */
        {
            const _mm = new THREE.Matrix4();
            const _pp = new THREE.Vector3();
            const _qq = new THREE.Quaternion();
            const _ss = new THREE.Vector3(1, 1, 1);
            const BERTH = TRAIN.z, TUNNEL_N = BERTH - 210, TUNNEL_S = BERTH + 210;

            world.frame((dt, t) => {
                const T = TRAIN;
                T.t += dt;
                if (T.phase === 'dwell') {
                    T.door = Math.min(1, T.door + dt * 0.55);
                    if (T.t > 22) { T.phase = 'closing'; T.t = 0; }
                } else if (T.phase === 'closing') {
                    T.door = Math.max(0, T.door - dt * 0.55);
                    if (T.door <= 0 && T.t > 3.6) { T.phase = 'away'; T.t = 0; T.v = 0; }
                } else if (T.phase === 'away') {
                    T.v = Math.min(19, T.v + dt * 1.15);
                    T.z -= T.v * dt;
                    if (T.z < TUNNEL_N) { T.phase = 'gap'; T.t = 0; T.z = TUNNEL_S; T.v = 19; }
                } else if (T.phase === 'gap') {
                    if (T.t > 26) T.phase = 'in';
                } else {
                    const left = T.z - BERTH;
                    T.v = Math.max(1.1, Math.min(T.v, Math.sqrt(Math.max(0, left) * 2 * 1.05)));
                    T.z -= T.v * dt;
                    if (T.z <= BERTH) { T.z = BERTH; T.v = 0; T.phase = 'dwell'; T.t = 0; T.door = 0; }
                }

                for (let i = 0; i < TRAIN_N; i++) {
                    _pp.set(-ST.TRACK, ST.RAIL, T.z + (i - (TRAIN_N - 1) / 2) * CAR_L);
                    _mm.compose(_pp, _qq.set(0, 0, 0, 1), _ss.set(1, 1, 1));
                    trainIM.setMatrixAt(i, _mm);
                }
                trainIM.instanceMatrix.needsUpdate = true;
                trainNose.position.set(-ST.TRACK, ST.RAIL, T.z);

                // the leaves: two per doorway, both platforms' screens always,
                // and the train's own only while it is standing here
                const berthed = T.phase === 'dwell' || T.phase === 'closing';
                const slide = T.door * (DOOR_W / 2 - 0.03);
                let k = 0;
                for (const s of [-1, 1]) {
                    for (const dz of doorZs) {
                        for (const j of [-1, 1]) {
                            _pp.set(s * (ST.EDGE + 0.09), ST.PLAT + 1.51,
                                    dz + j * (DOOR_W / 4 + slide));
                            _mm.compose(_pp, _qq.set(0, 0, 0, 1), _ss.set(1, 1, 1));
                            doorIM.setMatrixAt(k++, _mm);
                        }
                    }
                }
                for (const dz of doorZs) {
                    for (const j of [-1, 1]) {
                        const on = berthed ? 1 : 0.0001;
                        _pp.set(-(ST.TRACK - 1.55), ST.RAIL + 1.95,
                                dz + j * (DOOR_W / 4 + slide));
                        _mm.compose(_pp, _qq.set(0, 0, 0, 1), _ss.set(on, on, on));
                        doorIM.setMatrixAt(k++, _mm);
                    }
                }
                for (; k < doorIM.count; k++) {
                    _mm.compose(_pp.set(0, -900, 0), _qq.set(0, 0, 0, 1), _ss.set(0.0001, 0.0001, 0.0001));
                    doorIM.setMatrixAt(k, _mm);
                }
                doorIM.instanceMatrix.needsUpdate = true;
            });
        }
    }

    /* ============================================================
       15 · the Yarra, and Princes Bridge

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
       16 · what stands on the footpath

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
        for (let i = 0; i < 4; i++) spots.push([23.5 + i * 6.4, -136.5 + rr(-1.2, 1.2)]);  // City Square, the
        for (let i = 0; i < 4; i++) spots.push([23.5 + i * 6.4, -199.0 + rr(-1.2, 1.2)]);  // two ends of it
        for (let i = 0; i < 3; i++) spots.push([46.8, -132.0 - i * 4.6]);                   // and along the hotel
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
        // The tree pit goes into the trunk's own geometry rather than into a
        // second instanced mesh of its own. It is a one-point-eight-metre
        // square of wet soil seen at a grazing angle from the far side of a
        // road, and the difference between 0x4a4238 and the trunk's brown at
        // that angle is nothing; a whole mesh for it, out of a hundred and
        // fifty, is not nothing.
        g = boxG(1.8, 0.06, 1.8); put(g, 0, 0.03, 0); trunk.push(g);
        const trunkIM = new THREE.InstancedMesh(merge(trunk), stdMat(C.trunk, { roughness: 0.80 }), spots.length);
        const leafIM = new THREE.InstancedMesh(sphG(1, 9, 6), stdMat(C.leaf, { roughness: 0.78 }), spots.length * 4);
        const tint = new THREE.Color();
        let k = 0;
        spots.forEach((p, i) => {
            const h = rr(10.5, 14), s = h / 11.6;
            const x = p[0] + rr(-0.5, 0.5), z = p[1] + rr(-0.5, 0.5);
            trunkIM.setMatrixAt(i, MX(x, KERB_H, z, 0, rr(0, 6.28), 0, s, s, s));
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
        if (leafIM.instanceColor) leafIM.instanceColor.needsUpdate = true;
        scene.add(trunkIM, leafIM);
        world.ghost(leafIM);       // a canopy is not something to walk into
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
            q = cylG(0.38, 0.36, 0.12, 10); put(q, 0, 1.05, 0); drum.push(q);
            q = new THREE.TorusGeometry(0.22, 0.03, 5, 12); put(q, 0, 1.12, 0, Math.PI / 2, 0, 0); drum.push(q);
            // The lid used to be a second mesh for a second grey. On a street
            // bin a metre tall the drum and the lid are the same galvanised
            // steel anyway, and two meshes each, twice over, is a clock tower.
            void lid;
            B.add(merged(drum, bm));
            B.position.set(p[0], KERB_H, p[1]);
            scene.add(B);
            world.part('bin_0' + i, B);
        });
    }

    /* ============================================================
       17 · the trams

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
       18 · the traffic and the crowd

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
       19 · the rain

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
       20 · what moves

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
