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
//      of it driven by four signal controllers, one for each street Swanston
//      crosses, running the same cycle length off four offsets so that a tram
//      going north meets a progression rather than a wall. Every vehicle in
//      the world stops at the lantern on its own approach, and every person
//      waits for the walking figure on the crossing they are standing at.
//    · four real-time lights, total. The lamps, the signals, the tram
//      headlights, the LED billboards and the concourse mouth are emissive
//      materials, and world.bloom carries the shine.
//    · City Square, behind St Paul's between Flinders Lane and Collins Street:
//      the plaza, the steel canopy on its six tree columns, the entrance to
//      Town Hall Station facing Collins, and the hotel behind them — five
//      floors of French doors, then eleven arched bays of pale zinc with a
//      four-storey loggia behind each and a rolled cap over the lot, the same
//      module from Flinders Lane to Collins Street. Section 21.
//    · the west side of Swanston: the white curtain-walled block opposite
//      City Square with its neighbours down to Flinders Lane, and opposite
//      the Town Hall the cream tower on Little Collins with three older
//      frontages beside it. Sections 22 and 23.
//    · the cross streets — Collins, Little Collins and Flinders Lane, east
//      and west of Swanston — filled by a seeded generator rather than by a
//      photograph, because there is no photograph of them. Five archetypes,
//      random widths and heights, a shop you can walk into under every
//      building near the intersection and a merged backdrop past it.
//      Invention, and said to be. Section 26.
//    · the verandah, and the five kinds of sign hung off it. Melbourne's
//      footpath is roofed by one continuous cantilever — a deep fascia beam
//      with the shop's name on the face of it, a lined soffit with a row of
//      recessed downlights, ties back into the wall — and under it a shop
//      signs itself four or five times over at four or five different depths:
//      a board on the fascia, a lightbox slung under the soffit facing the
//      way you are walking, blades bracketed out at right angles, a menu case
//      beside the door, a number on the pier. Their own atlas, their own
//      brightnesses, and no two the same size, because a street where every
//      sign is the same size is a street nobody has ever stood in. Two
//      meshes for all of it. Sections 22, 23 and 26.
//    · nothing on either frontage is painted. Every window is an opening with
//      a pane at the back of it, every cornice is courses and brackets, and
//      the colour is on the vertices — so a whole building is one draw and
//      still has relief you can walk up to.
//    · the escalators go down and stop. What is at the bottom of that shaft
//      is a lined concrete room and nothing else: the station that used to be
//      under this world has been taken out.
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
    /* Princes Bridge. The deck used to sit at 0.45, which is a step of nearly
       half a metre onto the carriageway and most of one onto the footway, at
       both ends, with nothing to climb it by — and the tram wire over the deck
       ran forty-five centimetres higher than the tram wire over the street it
       is spliced to. Carried at street level instead, the walk on and off the
       bridge is a centimetre, the rails line up and the overhead is one wire. */
    const BR_W = 30, BR_Y = 0.0;
    const QUAY = -6.15;                // the promenade at river level, two metres over the water

    /* Where the two road sheets stop and the riverbanks take over.

       They did not stop anywhere, and that was the largest thing wrong with
       this end of the world: `sheet()` in section 7 lays a solid plane at
       y = 0 from z = −210 to z = 250, which is straight over the Yarra. Seen
       from anywhere above the water the river was a strip of dark ground with
       a bridge over it, and the water — which is lit, rippled and mirroring
       the whole sunset — was only ever visible from below the sheet, which is
       to say from nowhere a person can stand. Both sheets now have the channel
       cut out of them, and everything inside the cut — the water, the bridge
       deck that carries the street over it, the two bank walls, the river-level
       promenades and the steps down to them — is built in sections 15 and 27. */
    const CUT_N = 132, CUT_S = 238;

    // Swanston Street carried north, measured from the Flinders kerb line.
    const NST = [
        { z: -115, h: 5.2, tram: false },     // Flinders Lane, one way east→west
        { z: -230, h: 13.5, tram: true },     // Collins Street, two way, trams both ways
        { z: -345, h: 5.6, tram: false },     // Little Collins Street
    ];
    const NX = 158;               // how far east and west each cross street runs
    const NZ_END = -404;

    /* How far anything on wheels runs before it is taken off one end of the
       street and put back on at the other. Swanston is the long one and has to
       be: a car that turns round at a hundred and forty metres never gets north
       of Flinders Lane, so it never meets Collins Street's lantern or Little
       Collins', and the offsets that make this a coordinated corridor rather
       than four separate intersections are a thing nobody in the world ever
       experiences. Half a kilometre of Swanston is four lanterns in a row.

       The southern end used to be 152, which is fourteen metres onto Princes
       Bridge: every southbound vehicle in the world vanished a car's length
       past the north abutment and no vehicle at all ever crossed the river.
       It now runs the whole bridge and out onto St Kilda Road, past the fifth
       lantern at Alexandra Avenue, which is what puts traffic on the deck. */
    const RUN_Z0 = -368, RUN_Z1 = 300, RUN_X = 148;

    /* St Kilda Road at Alexandra Avenue, the intersection at the south end of
       the bridge. Not one of `NST`: those three are cut into the road shader
       and this one is not, so the carriageway across it is laid as geometry in
       section 27 instead. Everything else about it — the lanterns, the phases,
       the crossings — is exactly the other four. */
    const SKR = { z: 268, h: 9.0 };

    // 101 Collins Street, on this scene's simplified Hoddle Grid.
    const C101 = { x: 345, z: -146, W: 47, D: 40, H: 188, H2: 200, TIP: 260 };

    /* City Square — the block directly behind St Paul's, east of Swanston
       between Flinders Lane and Collins Street. Section 21 builds all of it;
       the plan lives up here because the roadway in section 7 has to know
       where the station shaft goes through it, and section 7 runs first.

           x 18.5 ─── plaza ─── 49 ─── the Westin ─── 88
           z −133 (Flinders Lane end)  …  −203 (Collins Street end)

       Y is the one thing this world had never needed. The plaza is at kerb
       height and the escalators go fifteen metres down through it into a
       lined concrete room, which is as far as this world goes below its own
       ground — but the walk down is continuous, and the hole through the two
       road sheets in section 7 is cut for it. */
    const SQ = {
        X0: BX, X1: 49.0,                  // the plaza, west edge to the building line
        Z0: -127.2, Z1: -209.5,            // Flinders Lane footpath to the Collins Street one
        BX0: 49.0, BX1: 88.0,              // the hotel's footprint, the rest of the block
        BZ0: -127.2, BZ1: -209.5,
        VX0: 25.5, VX1: 35.4,              // the escalator shaft, through plaza and roadway
        VZ0: -181.5, VZ1: -155.0,          // its north end is the top of the flight
        HALL: -15.0,                       // the floor at the bottom of the shaft
        DECK: KERB_H + 0.01,               // the paving, level with the footpath beside it
    };

    /* Town Hall Station's other end, on the Flinders Street footpath at the
       Federation Square corner. Same station, opposite end of it, and no
       connection between the two: what is under this world is two lined
       concrete rooms and nothing joining them, which is the honest state of a
       world whose underground was taken out.

           x 25.0 ─── the opening in the paving ─── 34.2
           z 15.6 (the head of the flight) … 19.8 (where it goes under the plaza)

       The opening is a hole in the footpath and nothing stands over it — the
       real one has no head-house, and the photograph shows a glass rectangle
       set into the paving with the escalators diving out of sight under
       Federation Square's forecourt. Which is where they go here too: the
       flight runs south, out from under the daylight at z ≈ 20 and on under
       the sandstone to z = 42, and the room it lands in is under the
       forecourt. Nothing on this site is below ground, so there is nothing
       down there to collide with.

       The brief asked for it at z 20.5–26. That is Federation Square's
       sandstone forecourt — a 0.5 m slab from z = 20 to z = 44 with five steps
       up its northern edge — so the opening is a few metres north of it, in
       the clear footpath, hard against the same corner. Everything from the
       kerb at z 13.84 to the forecourt at z 20 was empty; the entrance takes
       the southern two thirds of it and leaves a lane along the kerb.

       IX/IZ is the lined room round the flight: the void plus a margin, the
       same way City Square's is, and the rectangle the two road sheets in
       section 7 have cut out of them — because section 7 runs first and a
       solid sheet at y = 0 is a lid over the whole descent. */
    const FQ = {
        VX0: 25.0, VX1: 34.2,              // the opening cut into the footpath
        VZ0: 15.6, VZ1: 19.8,              // its north edge is the head of the flight
        IX0: 24.7, IX1: 34.5,              // the lined room, clear inside
        IZN: 15.2, IZS: 46.0,
        ZB: 42.1,                          // where the flight meets the floor
        HALL: -15.0,                       // the same depth the City Square end lands at
        DECK: KERB_H,                      // the footpath itself, not a paving slab over it
        SOFF: -0.07,                       // and its underside — the shaft's ceiling
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
    const FOG_COL = daylight(0xe8c6a0);
    const FOG_NEAR = 95, FOG_FAR = 1250;
    scene.fog = new THREE.Fog(FOG_COL.clone(), FOG_NEAR, FOG_FAR);

    // Where the sun is behind all that cloud: west-north-west and low, which is
    // where 16:40 in a Melbourne winter puts it, and which is why the western
    // faces of everything are the pale ones.
    const SUN = new THREE.Vector3(-0.845, 0.132, -0.518).normalize();

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
        uSkyLo: { value: srgb(0xf2cda2) },        // the warm low sky the ground sits in
        uSkyHi: { value: srgb(0x5f86bd) },        // and the blue it mirrors overhead
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
            uZen: { value: daylight(0x2c5591) },
            uMid: { value: daylight(0x93bada) },
            uHor: { value: daylight(0xf7c894) },
            uWarm: { value: daylight(0xff9b46) },
        }),
        vertexShader: `varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
        fragmentShader: NOISE_GLSL + /* glsl */`
          varying vec3 vDir;
          uniform vec3 uZen, uMid, uHor, uWarm, uSun;
          uniform float uTime;
          void main(){
            vec3 d = normalize(vDir);
            float h = clamp(d.y, -1.0, 1.0);

            // Twenty minutes before the sun goes: deep blue overhead, a pale
            // band, and the whole western horizon the colour of the inside of
            // a peach. The gradient runs the same way it did under cloud —
            // horizon, middle, zenith — but the three colours it runs between
            // are a different day.
            vec3 col = mix(uHor, uMid, smoothstep(-0.04, 0.30, h));
            col = mix(col, uZen, smoothstep(0.18, 0.92, h));

            // High thin cloud, and much less of it — enough to catch the light
            // and go copper on its underside, not enough to shut the sky in.
            vec2 cp = d.xz / max(abs(h) + 0.14, 0.14);
            float c1 = fbm(cp * 0.34 + vec2(uTime * 0.0090, uTime * 0.0035));
            float c2 = fbm(cp * 0.95 - vec2(uTime * 0.0060, 0.0));
            float cloud = smoothstep(0.52, 0.94, c1 * 0.70 + c2 * 0.40);
            float s = max(dot(d, normalize(uSun)), 0.0);
            col = mix(col, uWarm * (0.55 + 0.75 * pow(s, 1.6)), cloud * 0.55);

            /* And the sun itself, which under cloud was a smear and is now the
               brightest thing in the world: a wide warm bloom for the sky
               around it, and a small hard core that the bloom pass will take
               and turn into the flare you get looking west down Flinders
               Street at this hour. */
            col += uWarm * pow(s, 5.0) * 0.85;
            col += vec3(1.0, 0.86, 0.66) * pow(s, 400.0) * 6.0;
            col += uWarm * pow(max(s, 0.0), 1.4) * 0.16 * smoothstep(0.28, -0.02, h);

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

       Twenty minutes before sunset the sun is the light, not the sky: a low
       directional coming in almost level from the west-north-west, warm
       enough to be orange on anything facing it, with the hemisphere pulled
       back to the blue fill an evening sky actually gives. The two shop
       lights and the tram stop stay — they are only now beginning to tell.
       Everything else that glows in this world glows because its material
       says so.
       ============================================================ */
    scene.add(new THREE.HemisphereLight(0xbcd4f0, 0x7a6a52, 1.45));
    scene.add(new THREE.AmbientLight(0xffdcb4, 0.40));

    const sun = new THREE.DirectionalLight(0xffb166, 2.75);
    sun.position.copy(SUN).multiplyScalar(340);
    sun.castShadow = false;          // still no shadow maps: four lights, no passes to spare
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

    /* ---- one plane leaf, at the origin, tip up ----

            Five lobes, deep sinuses between them, broader than it is long, and
            a notch where the stalk goes in. Everything leafy in this world is
            drawn from this one outline: the canopy texture puts two hundred of
            them on a transparent ground, the paving puts down the ones that
            came off in March, and the tree pit collects what fell last week.
            A plane tree is the one street tree anybody can name at fifty
            metres, and this shape is how they name it. */
    const leafPath = (g, r) => {
        g.beginPath();
        for (let i = 0; i <= 44; i++) {
            const a = -2.78 + 5.56 * i / 44;
            const k = Math.pow(Math.abs(Math.cos(2.5 * a)), 0.55);
            const rad = r * (0.30 + 0.70 * k);
            const x = Math.sin(a) * rad * 1.08, y = -Math.cos(a) * rad * 0.90;
            i ? g.lineTo(x, y) : g.moveTo(x, y);
        }
        g.closePath();
    };

    /* ---- bluestone flagging for the raised footpaths ----

            The footpath was a flat grey ribbon, and it was flat for two
            reasons. One was the drawing: eight anonymous squares with a black
            line round each. The other was the mapping — the paths that run
            north up Swanston are box geometry, whose UVs go nought to one
            across a ninety-six metre strip, so whatever was drawn here was
            stretched to a fifth of one slab and the near footpath had no
            texture on it at all. Both are fixed; this is the drawing.

            A Melbourne footpath is bluestone, and bluestone is not grey. It is
            a dark blue-grey that goes warm where a low sun catches the sawn
            face and stays cold in the joint, laid six hundred by nine hundred
            in courses with the long dimension along the kerb, and no two slabs
            in a course are the same value — which is the single thing that
            makes a paved surface read as stone rather than as concrete.

            One tile is 5.4 m square: nine six-hundreds across it and six
            nine-hundreds along, so a slab comes out the size of a slab
            whichever way the path runs. Over that, in the same tile because a
            tile is all the texture there is — the wear that collects along a
            joint, a few stains, and the plane leaves that have been coming
            down all autumn. The leaves are drawn nine times each, wrapped, so
            none of them is cut in half at the tile edge. */
    const PAVE_M = 5.4;
    const paveTex = tex(1024, 1024, (g, S) => {
        const u = S / PAVE_M;
        g.fillStyle = '#3f434a'; g.fillRect(0, 0, S, S);        // the joint, under everything
        const CW = 0.6 * u, CH = 0.9 * u;
        for (let j = -1; j * CH < S; j++) {
            const lap = (j & 1) * CW * 0.5;
            for (let i = -1; i * CW < S; i++) {
                const x = i * CW + lap, y = j * CH, v = rr(-17, 15);
                g.fillStyle = 'rgb(' + Math.round(116 + v) + ',' + Math.round(120 + v * 0.94)
                            + ',' + Math.round(127 + v * 0.86) + ')';
                g.fillRect(x + 1.5, y + 1.5, CW - 3, CH - 3);
                // the sawn face is never one value across a whole slab
                for (let k = 0; k < 3; k++) {
                    g.fillStyle = 'rgba(' + (rnd() < 0.5 ? '255,255,255,' : '20,26,34,') + rr(0.02, 0.07).toFixed(3) + ')';
                    g.beginPath();
                    g.ellipse(x + rr(0.1, 0.9) * CW, y + rr(0.1, 0.9) * CH,
                              rr(0.15, 0.5) * CW, rr(0.10, 0.4) * CH, rnd() * 3, 0, 6.2832);
                    g.fill();
                }
                // and the darker margin where forty years of feet have worn
                // the arris off and the dirt has gone into it
                g.strokeStyle = 'rgba(28,32,38,.22)'; g.lineWidth = 3;
                g.strokeRect(x + 3, y + 3, CW - 6, CH - 6);
            }
        }
        // the pale flecks that are half of what bluestone actually looks like
        for (let i = 0; i < 5200; i++) {
            g.fillStyle = 'rgba(226,232,238,' + (rnd() * 0.13).toFixed(3) + ')';
            g.fillRect(rnd() * S, rnd() * S, 2, 2);
        }
        // stains: a spilt coffee, the shadow of a bin that stood there
        for (let i = 0; i < 7; i++) {
            g.fillStyle = 'rgba(24,20,14,' + rr(0.05, 0.13).toFixed(3) + ')';
            g.beginPath();
            g.ellipse(rnd() * S, rnd() * S, rr(0.10, 0.34) * u, rr(0.08, 0.26) * u, rnd() * 3, 0, 6.2832);
            g.fill();
        }
        // and the litter. Wrapped, so a leaf that runs off one edge of the
        // tile arrives at the other one whole rather than cut in half.
        const LITTER = ['#9c6a30', '#b07c3d', '#7c5628', '#c08e48', '#8b6f34', '#a45f27'];
        for (let i = 0; i < 22; i++) {
            const x = rnd() * S, y = rnd() * S, r = rr(0.075, 0.135) * u;
            const rot = rnd() * 6.2832, col = pickOf(LITTER), curl = rr(0.55, 1.0);
            for (let ox = -1; ox <= 1; ox++) for (let oy = -1; oy <= 1; oy++) {
                g.save();
                g.translate(x + ox * S, y + oy * S); g.rotate(rot); g.scale(1, curl);
                g.fillStyle = 'rgba(0,0,0,.20)'; leafPath(g, r * 1.04); g.translate(2, 3); g.fill();
                g.restore();
                g.save();
                g.translate(x + ox * S, y + oy * S); g.rotate(rot); g.scale(1, curl);
                g.fillStyle = col; leafPath(g, r); g.fill();
                g.restore();
            }
        }
    }, 1, 1);

    /* ---- and the band along the kerb ----

            The photograph shows it and this world did not have it: the last
            half-metre before the kerb is not the same paving as the rest of
            the footpath. It is a lighter, smaller unit laid as a margin — the
            line a person's eye follows down the street, and the thing that
            tells the footpath from the road at a distance where neither has
            any other detail left. Three hundred millimetre setts, pale, one
            metre two to a tile. */
    const kerbBandTex = tex(256, 256, (g, S) => {
        g.fillStyle = '#5c5f63'; g.fillRect(0, 0, S, S);
        const n = 4, w = S / n;
        for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
            const v = rr(-14, 12);
            g.fillStyle = 'rgb(' + Math.round(142 + v) + ',' + Math.round(141 + v)
                        + ',' + Math.round(138 + v * 0.9) + ')';
            g.fillRect(i * w + 2, j * w + 2, w - 4, w - 4);
        }
        for (let i = 0; i < 1400; i++) {
            g.fillStyle = 'rgba(' + (rnd() < 0.55 ? '255,252,244,' : '40,40,38,') + (rnd() * 0.14).toFixed(3) + ')';
            g.fillRect(rnd() * S, rnd() * S, 2, 2);
        }
    }, 1, 1);

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

    /* One flank of an A-class, and the same flank whichever way round you are
       standing. The car this world runs is double-ended, so this is drawn
       symmetric about its own middle: a cab window and a fleet number at each
       end, three doorways at a fifth, a half and four fifths of the length,
       and three saloon windows in each bay between them. Mirror the canvas and
       draw the same green burst again and the two ends match to the pixel,
       which no amount of eyeballing two separate drawings would have managed.

       The doorways are cleared straight out now rather than painted on. They
       are real openings with real leaves sliding across them, so what the
       texture keeps is the yellow frame the leaves slide over. The window
       glass is cleared the same way so the saloon shows through, and the
       material runs alphaTest rather than transparency — twenty openings a
       side across nine cars is not a sorting problem worth having. */
    const CAB_U = [0.0325, 0.0926];
    const DOOR_U = [[0.1397, 0.2203], [0.4597, 0.5403], [0.7797, 0.8603]];
    const WIN_U = [[0.1000, 0.1320],
                   [0.2323, 0.2961], [0.3081, 0.3719], [0.3839, 0.4477],
                   [0.5523, 0.6161], [0.6281, 0.6919], [0.7039, 0.7677],
                   [0.8680, 0.9000]];
    const tramSideTex = (fleet, mirror) => tex(2048, 420, (g, W, H) => {
        if (mirror) { g.translate(W, 0); g.scale(-1, 1); }
        g.clearRect(0, 0, W, H);
        g.fillStyle = '#f3f5f1'; g.fillRect(0, 0, W, H);

        // The shards, at one end and then the same shards mirrored at the
        // other. Two calls to the same seed rather than two seeds, because the
        // whole point of this rebuild is that the back looks like the front.
        const burst = (a, b, seed) => {
            g.save(); g.beginPath(); g.rect(W * a, 0, W * (b - a), H); g.clip();
            ptvPattern(g, W * (a - 0.02), 0, W * (b - a + 0.04), H, seed); g.restore();
        };
        g.save(); burst(0.000, 0.300, 3); g.restore();
        g.save(); g.translate(W, 0); g.scale(-1, 1); burst(0.000, 0.300, 3); g.restore();
        // and the green flash along the roof fascia over each cab
        for (const m of [0, 1]) {
            g.save(); if (m) { g.translate(W, 0); g.scale(-1, 1); }
            g.fillStyle = '#4f9c2e';
            g.beginPath(); g.moveTo(0, 0); g.lineTo(W * 0.105, 0); g.lineTo(0, H * 0.26); g.closePath(); g.fill();
            g.fillStyle = '#8cc63e';
            g.beginPath(); g.moveTo(0, 0); g.lineTo(W * 0.062, 0); g.lineTo(0, H * 0.15); g.closePath(); g.fill();
            g.restore();
        }
        // lime line along the lower body, then the dark rubbing strip at the hem
        g.fillStyle = '#c5d92f'; g.fillRect(0, H * 0.872, W, H * 0.020);
        g.fillStyle = '#4d5257'; g.fillRect(0, H * 0.940, W, H * 0.060);

        /* The window band. The body box runs from the floor at 0.88 to the
           roof at 3.22, so the glass — 1.95 to 2.62 off the rail, a sill just
           over a metre above the saloon floor — lands between these two
           fractions and nowhere else, and the hopper rail is the hinge line of
           the top-hung light that opens over it. */
        const glassY = H * 0.256, glassH = H * 0.286;
        const opening = (u0, u1) => {
            g.clearRect(W * u0, glassY, W * (u1 - u0), glassH);
            g.strokeStyle = '#15191c'; g.lineWidth = W / 340;
            g.strokeRect(W * u0, glassY, W * (u1 - u0), glassH);
            g.fillStyle = '#2a3036';
            g.fillRect(W * u0, glassY + glassH * 0.30, W * (u1 - u0), Math.max(2, H / 88));
        };
        opening(CAB_U[0], CAB_U[1]);
        WIN_U.forEach((p) => opening(p[0], p[1]));

        // The doorways: a yellow frame painted on the body, and nothing at all
        // inside it. The leaf that fills it is geometry, and it slides.
        DOOR_U.forEach((d) => {
            const dx = W * d[0], dw = W * (d[1] - d[0]);
            g.fillStyle = '#dfe62b'; g.fillRect(dx - dw * 0.09, H * 0.140, dw * 1.18, H * 0.838);
            g.clearRect(dx, H * 0.155, dw, H * 0.810);
            g.strokeStyle = '#9aa018'; g.lineWidth = W / 620;
            g.strokeRect(dx - dw * 0.09, H * 0.140, dw * 1.18, H * 0.838);
        });

        g.textBaseline = 'middle';
        for (const m of [0, 1]) {
            g.save(); if (m) { g.translate(W, 0); g.scale(-1, 1); g.textAlign = 'right'; }
            else g.textAlign = 'left';
            const at = (u) => (m ? W * (1 - u) : W * u);
            g.fillStyle = '#26301a';
            g.font = 'bold ' + (H * 0.090).toFixed(0) + 'px Helvetica, Arial, sans-serif';
            g.fillText(String(fleet), at(0.036), H * 0.760);
            g.font = 'bold ' + (H * 0.048).toFixed(0) + 'px Helvetica, Arial, sans-serif';
            g.fillText(String(fleet), at(0.036), H * 0.208);
            g.restore();
        }
        g.textAlign = 'left';
        [0.398, 0.578].forEach((u) => {                              // two PT> marks amidships
            g.fillStyle = '#0f5c2e';
            g.font = 'bold ' + (H * 0.078).toFixed(0) + 'px Helvetica, Arial, sans-serif';
            g.fillText('PT', W * u, H * 0.760);
            g.beginPath();
            g.moveTo(W * (u + 0.019), H * 0.718); g.lineTo(W * (u + 0.029), H * 0.760);
            g.lineTo(W * (u + 0.019), H * 0.802); g.closePath(); g.fill();
        });
    });

    /* Either end of the car, which on a double-ended tram is the same drawing
       twice: the cab dark behind its screen, the black destination surround
       over it, and the myki panel on the white below the sill. */
    const tramEndTex = (fleet) => tex(512, 448, (g, W, H) => {
        g.fillStyle = '#f4f6f3'; g.fillRect(0, 0, W, H);
        g.fillStyle = '#1b2126'; g.fillRect(0, H * 0.09, W, H * 0.595);      // the cab, seen through the screen
        g.fillStyle = 'rgba(150,190,220,.13)'; g.fillRect(0, H * 0.19, W, H * 0.20);
        g.fillStyle = '#0a0a0a'; g.fillRect(W * 0.10, H * 0.090, W * 0.80, H * 0.098);
        g.fillStyle = '#2b3138';                                              // the driver, in silhouette
        g.beginPath(); g.ellipse(W * 0.30, H * 0.60, W * 0.13, H * 0.13, 0, 0, 6.3); g.fill();
        g.beginPath(); g.ellipse(W * 0.30, H * 0.44, W * 0.055, H * 0.055, 0, 0, 6.3); g.fill();
        for (const m of [0, 1]) {
            g.save();
            if (m) { g.translate(W, 0); g.scale(-1, 1); }
            g.beginPath(); g.rect(0, H * 0.700, W * 0.20, H * 0.300); g.clip();
            ptvPattern(g, -W * 0.04, H * 0.690, W * 0.28, H * 0.320, 3);
            g.restore();
        }
        g.fillStyle = '#c5d92f'; g.fillRect(0, H * 0.700, W, H * 0.016);
        g.fillStyle = '#f7f8f5'; g.fillRect(W * 0.13, H * 0.760, W * 0.74, H * 0.185);
        g.fillStyle = '#1c6b3a'; g.textBaseline = 'middle'; g.textAlign = 'left';
        g.font = 'bold ' + (H * 0.048).toFixed(0) + 'px Helvetica, Arial, sans-serif';
        g.fillText('Set and forget with', W * 0.16, H * 0.805);
        g.fillText('myki auto top up', W * 0.16, H * 0.862);
        g.fillStyle = '#3d4348';
        g.font = (H * 0.040).toFixed(0) + 'px Helvetica, Arial, sans-serif';
        g.fillText('on the PTV app', W * 0.16, H * 0.915);
        g.fillStyle = '#78be20'; g.fillRect(W * 0.71, H * 0.785, W * 0.13, H * 0.135);
        g.fillStyle = '#f7f8f5';
        g.font = 'bold ' + (H * 0.034).toFixed(0) + 'px Helvetica, Arial, sans-serif';
        g.textAlign = 'center'; g.fillText('myki', W * 0.775, H * 0.852);
        g.fillStyle = '#26301a';
        g.font = 'bold ' + (H * 0.036).toFixed(0) + 'px Helvetica, Arial, sans-serif';
        g.textAlign = 'left'; g.fillText(String(fleet), W * 0.05, H * 0.736);
        g.fillStyle = '#2c3238'; g.fillRect(0, H * 0.955, W, H * 0.045);
    });

    /* One door leaf. Yellow all the way round its edge, which is the thing you
       actually see of a Melbourne tram door from across the street, tinted
       glass in the top two thirds and a white panel under it. */
    const doorLeafTex = tex(128, 384, (g, W, H) => {
        g.fillStyle = '#dfe62b'; g.fillRect(0, 0, W, H);
        g.fillStyle = '#15191c'; g.fillRect(W * 0.10, H * 0.030, W * 0.80, H * 0.940);
        g.fillStyle = '#2b343c'; g.fillRect(W * 0.14, H * 0.055, W * 0.72, H * 0.520);
        g.fillStyle = 'rgba(160,196,224,.16)'; g.fillRect(W * 0.14, H * 0.055, W * 0.72, H * 0.200);
        g.fillStyle = '#f3f5f1'; g.fillRect(W * 0.14, H * 0.600, W * 0.72, H * 0.345);
        g.fillStyle = '#dfe62b'; g.fillRect(W * 0.14, H * 0.585, W * 0.72, H * 0.018);
        g.fillStyle = '#c8341f'; g.fillRect(W * 0.36, H * 0.660, W * 0.28, H * 0.055);
    });

    /* ---- the saloon of an A-class, as one texture ----------------------
       Everything inside the car — the cream panels, the blue floor, the green
       moquette, the perforated ceiling, a myki reader, a poster, a
       passenger's coat — is one patch of this one atlas. That is what lets the
       whole interior of nine trams be a single mesh drawn nine times: one
       texture is one material, and one material is one InstancedMesh. The
       tram material reads it twice, as colour and as emission, which is how a
       saloon lights itself without spending one of the four real lights this
       world is allowed on a tram that is mostly seen through wet glass. */
    const ATL_C = 8, ATL_R = 3;
    const interiorAtlas = tex(1024, 384, (g, W, H) => {
        const CW = W / ATL_C, CH = H / ATL_R;
        const cell = (col, row, draw) => {
            const x = col * CW, y = (ATL_R - 1 - row) * CH;
            g.save(); g.beginPath(); g.rect(x, y, CW, CH); g.clip(); g.translate(x, y);
            draw(CW, CH); g.restore();
        };
        const flat = (col, row, hex, then) => cell(col, row, (w, h) => {
            g.fillStyle = hex; g.fillRect(0, 0, w, h);
            if (then) then(w, h);
        });

        flat(0, 0, '#b8ac93', (w, h) => {                 // cream-beige wall panel
            g.fillStyle = 'rgba(120,104,78,.16)';
            for (let i = 0; i < 3; i++) g.fillRect(0, h * (0.24 + i * 0.26), w, 1.5);
        });
        flat(1, 0, '#6f747b', (w, h) => {                 // grey panel under the windows
            g.fillStyle = 'rgba(30,34,38,.20)'; g.fillRect(0, h * 0.88, w, h * 0.12);
        });
        flat(2, 0, '#182a54', (w, h) => {                 // the deep blue floor
            g.fillStyle = 'rgba(140,160,200,.10)';
            for (let i = 0; i < 260; i++) g.fillRect(rnd() * w, rnd() * h, 2, 2);
        });
        flat(3, 0, '#aeaca2', (w, h) => {                 // pale perforated ceiling
            g.fillStyle = 'rgba(90,92,86,.32)';
            for (let y = 4; y < h; y += 7) for (let x = 4; x < w; x += 7) g.fillRect(x, y, 2, 2);
        });
        flat(4, 0, '#fffbef');                            // the fluorescent strip
        flat(5, 0, '#1a6f2c', (w, h) => {                 // the moquette: green, with yellow and black
            g.strokeStyle = '#0b4a1a'; g.lineWidth = 4;
            for (let i = 0; i < 5; i++) {
                g.beginPath(); g.moveTo(-12 + i * 30, h);
                g.quadraticCurveTo(8 + i * 30, h * 0.42, 38 + i * 30, -10); g.stroke();
            }
            g.strokeStyle = '#e0c93a'; g.lineWidth = 2.5;
            for (let i = 0; i < 4; i++) {
                g.beginPath(); g.moveTo(i * 34, h);
                g.quadraticCurveTo(22 + i * 34, h * 0.52, 6 + i * 34, 0); g.stroke();
            }
            g.strokeStyle = '#121b12'; g.lineWidth = 1.1;
            for (let i = 0; i < 4; i++) {
                g.beginPath(); g.moveTo(i * 34 - 8, 0); g.lineTo(i * 34 + 30, h); g.stroke();
            }
            g.fillStyle = '#e0c93a';
            for (let i = 0; i < 70; i++) g.fillRect(rnd() * w, rnd() * h, 2.5, 2.5);
        });
        flat(6, 0, '#7d8388', (w, h) => {                 // the grey moulded seat shell
            g.fillStyle = 'rgba(40,44,48,.16)'; g.fillRect(0, h * 0.80, w, h * 0.20);
            g.fillStyle = 'rgba(255,255,255,.14)'; g.fillRect(0, 0, w, h * 0.10);
        });
        flat(7, 0, '#2f8c33');                            // the bright green of the poles and grabs

        flat(0, 1, '#f2c318', (w, h) => {                 // a myki reader, yellow, with its screen
            g.fillStyle = '#1a1d20'; g.fillRect(w * 0.16, h * 0.10, w * 0.68, h * 0.34);
            g.fillStyle = '#4fd0e0'; g.fillRect(w * 0.20, h * 0.14, w * 0.60, h * 0.26);
            g.fillStyle = '#1c6b3a';
            g.beginPath(); g.arc(w * 0.5, h * 0.68, w * 0.20, 0, 6.3); g.fill();
            g.fillStyle = '#f2c318';
            g.beginPath(); g.arc(w * 0.5, h * 0.68, w * 0.11, 0, 6.3); g.fill();
        });
        flat(1, 1, '#1b3f8f', (w, h) => {                 // the blue oval it is mounted on
            g.fillStyle = '#2b58c0';
            g.beginPath(); g.ellipse(w * 0.5, h * 0.5, w * 0.42, h * 0.46, 0, 0, 6.3); g.fill();
            g.fillStyle = '#f2c318'; g.fillRect(w * 0.20, h * 0.80, w * 0.60, h * 0.05);
        });
        flat(2, 1, '#1b3f8f', (w, h) => {                 // the blue cab door, with its white graphics
            g.fillStyle = '#e9eef6';
            g.fillRect(w * 0.10, h * 0.12, w * 0.30, h * 0.05);
            g.fillRect(w * 0.10, h * 0.22, w * 0.52, h * 0.03);
            g.beginPath(); g.arc(w * 0.5, h * 0.55, w * 0.18, 0, 6.3); g.fill();
            g.fillStyle = '#1b3f8f';
            g.beginPath(); g.arc(w * 0.5, h * 0.55, w * 0.12, 0, 6.3); g.fill();
            g.fillStyle = '#e9eef6'; g.fillRect(w * 0.46, h * 0.74, w * 0.08, h * 0.16);
        });
        flat(3, 1, '#d8d6cd', (w, h) => {                 // a route diagram
            g.strokeStyle = '#1c6b3a'; g.lineWidth = 5;
            g.beginPath(); g.moveTo(w * 0.12, h * 0.72); g.lineTo(w * 0.88, h * 0.72); g.stroke();
            g.fillStyle = '#1c6b3a';
            for (let i = 0; i < 6; i++) { g.beginPath(); g.arc(w * (0.14 + i * 0.145), h * 0.72, 5, 0, 6.3); g.fill(); }
            g.fillStyle = '#25313a'; g.fillRect(w * 0.10, h * 0.16, w * 0.52, h * 0.10);
            g.fillStyle = '#7c8790'; g.fillRect(w * 0.10, h * 0.32, w * 0.70, h * 0.05);
        });
        flat(4, 1, '#ccd3da', (w, h) => {                 // and a notice beside it
            g.fillStyle = '#1b3f8f'; g.fillRect(0, 0, w, h * 0.22);
            g.fillStyle = '#e8eef4'; g.fillRect(w * 0.08, h * 0.07, w * 0.56, h * 0.08);
            g.fillStyle = '#5b6670';
            for (let i = 0; i < 5; i++) g.fillRect(w * 0.10, h * (0.34 + i * 0.12), w * (0.50 + rnd() * 0.32), h * 0.05);
        });
        flat(5, 1, '#c8321c', (w, h) => {                 // the stop-request red
            g.fillStyle = 'rgba(255,255,255,.30)'; g.fillRect(0, 0, w, h * 0.16);
        });
        flat(6, 1, '#98a2a8', (w, h) => {                 // the convex mirror
            const grd = g.createRadialGradient(w * 0.38, h * 0.34, 2, w * 0.5, h * 0.5, w * 0.6);
            grd.addColorStop(0, '#f2f6f8'); grd.addColorStop(1, '#6f7c85');
            g.fillStyle = grd; g.fillRect(0, 0, w, h);
        });
        flat(7, 1, '#15191c');                            // black: rubber, screens, shadow

        flat(0, 2, '#2a3550');                            // a passenger's coat, navy
        flat(1, 2, '#7d2b2b');                            // and a red one
        flat(2, 2, '#4a5340');                            // and an olive one
        flat(3, 2, '#c39b7c');                            // skin
        flat(4, 2, '#2b2620');                            // hair
        flat(5, 2, '#cbbfa6');                            // the cream of a window surround
        flat(6, 2, '#7f8a90');                            // brushed handrail
        flat(7, 2, '#3a4046');                            // dark grey trim
    });

    /* Where a piece of the saloon looks up its colour. Called on the geometry
       before it goes in the bucket, and never after — the merge that follows
       has one uv attribute for everything in it, and this is the only chance
       to say which square of the atlas each face reads. */
    const atl = (geo, col, row) => {
        const uv = geo.attributes.uv, m = 0.055;
        for (let k = 0; k < uv.count; k++) {
            uv.setXY(k, (col + m + uv.getX(k) * (1 - 2 * m)) / ATL_C,
                        (row + m + uv.getY(k) * (1 - 2 * m)) / ATL_R);
        }
        return geo;
    };

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
          //
          // A third and a fourth number come back now. The channel: every kerb
          // in this city has half a metre of dressed bluestone laid along it to
          // take the water, and it is a colder and lighter thing than the
          // asphalt beside it, which is most of why a Melbourne road does not
          // read as one flat brown sheet. And the cross term, which is how
          // much of this point belongs to a cross street rather than to
          // Swanston, so the line marking laid on further down knows which
          // street's lines it is drawing and stops both of them at the
          // junction, the way paint actually stops at a junction.
          void streetBands(vec2 p, out float road, out float path, out float chan, out float cross){
            float ax = abs(p.x);
            // Swanston Street, carried north past three cross streets and south
            // over the bridge
            road = smoothstep(${(SW + 0.35).toFixed(2)}, ${(SW - 0.35).toFixed(2)}, ax);
            path = smoothstep(${(SW - 0.2).toFixed(2)}, ${(SW + 0.3).toFixed(2)}, ax)
                 * smoothstep(${(BX + 0.4).toFixed(2)}, ${(BX - 0.2).toFixed(2)}, ax);
            chan = smoothstep(${(SW - 0.86).toFixed(2)}, ${(SW - 0.40).toFixed(2)}, ax) * road;
            cross = 0.0;
            for (int i = 0; i < 3; i++) {
              float cz = i == 0 ? ${NST[0].z.toFixed(1)} : (i == 1 ? ${NST[1].z.toFixed(1)} : ${NST[2].z.toFixed(1)});
              float h  = i == 0 ? ${NST[0].h.toFixed(1)} : (i == 1 ? ${NST[1].h.toFixed(1)} : ${NST[2].h.toFixed(1)});
              // p.y, because p is the ground point flattened to (world x, world
              // z). The r128 source said p.z, which was right when this took a
              // vec3 and is the second reason the program never compiled.
              float dz = abs(p.y - cz);
              float within = smoothstep(${(NX + 2.0).toFixed(1)}, ${(NX - 2.0).toFixed(1)}, ax);
              float band = smoothstep(h + 0.35, h - 0.35, dz) * within;
              road = max(road, band);
              cross = max(cross, band);
              chan = max(chan, smoothstep(h - 0.86, h - 0.40, dz) * band);
              path = max(path, smoothstep(h - 0.2, h + 0.3, dz)
                             * smoothstep(h + ${(FP + 0.4).toFixed(1)}, h + ${(FP - 0.2).toFixed(1)}, dz) * within);
            }
            path = clamp(path - road, 0.0, 1.0);
            chan = clamp(chan - path, 0.0, 1.0);
          }

          void main(){
            vec3 wp = vWorld;
            float dist = length(uCamPos - wp);
            float det = 1.0 - smoothstep(18.0, 90.0, dist);

            float n1 = fbm(wp.xz * 2.2);
            float n2 = fbm(wp.xz * 0.34 + 11.0);

            float road, path, chan, cross;
            streetBands(wp.xz, road, path, chan, cross);

            /* Asphalt, and it is not brown. Warm ambient plus a low orange sun
               on a colourless surface gives brown every time, so the albedo is
               taken the other way — a little lighter and a little blue, which
               is what bitumen with bluestone chip in it actually is. And close
               up it gets its aggregate back: at two metres a road is not a
               colour at all, it is chips of stone in black binder, and that
               grain is the difference between standing on a road and standing
               on a painted floor. */
            vec3 cRoad = vec3(0.0452, 0.0470, 0.0512) * (0.76 + 0.54 * n1);
            cRoad *= 1.0 + det * (h21(floor(wp.xz * 42.0)) - 0.46) * 0.62;
            vec3 cPath = vec3(0.160, 0.170, 0.192) * (0.78 + 0.44 * n1);
            vec3 cBack = mix(vec3(0.048, 0.046, 0.041), vec3(0.086, 0.082, 0.070), n2);
            vec3 albedo = cRoad * road + cPath * path + cBack * clamp(1.0 - road - path, 0.0, 1.0);

            /* The line marking, outside the baked square.

               The 240 m canvas carries the intersection and nothing else, so
               from Flinders Lane north Swanston Street was four hundred metres
               of bare asphalt with tram rails lying on it — and the eye reads
               an unmarked road as a car park. These are only the things that
               run the whole length: the green kerbside bike lane, the two lane
               divisions and the centre line, the tram grooves, and a centre
               line down each cross street with Collins keeping its rails.
               Everything is laid before the baked mix below, so wherever the
               canvas has its own answer the canvas still wins.  */
            float ax0 = abs(wp.x);
            float sw = smoothstep(${(SW + 0.35).toFixed(2)}, ${(SW - 0.35).toFixed(2)}, ax0) * (1.0 - cross);
            float dashZ = step(0.5, fract(wp.z / 6.0));
            float dashX = step(0.5, fract(wp.x / 6.0));
            float mark = sw * dashZ * (smoothstep(0.13, 0.06, abs(wp.x))
                                     + smoothstep(0.13, 0.06, abs(ax0 - 7.6)));
            float bike = sw * smoothstep(${(SW - 2.22).toFixed(2)}, ${(SW - 2.04).toFixed(2)}, ax0)
                            * smoothstep(${(SW - 0.14).toFixed(2)}, ${(SW - 0.30).toFixed(2)}, ax0);
            float grv  = sw * smoothstep(0.075, 0.032, abs(abs(ax0 - ${TRS.toFixed(2)}) - ${RAIL.toFixed(3)}));
            ${NST.map((st, i) => `
            {
              float dz${i} = abs(wp.z - ${st.z.toFixed(1)});
              float in${i} = smoothstep(${(st.h + 0.35).toFixed(2)}, ${(st.h - 0.35).toFixed(2)}, dz${i})
                           * smoothstep(${(NX + 2.0).toFixed(1)}, ${(NX - 2.0).toFixed(1)}, ax0);
              mark = max(mark, in${i} * dashX * smoothstep(0.13, 0.06, dz${i}));${st.tram ? `
              grv  = max(grv, in${i} * smoothstep(0.075, 0.032, abs(abs(dz${i} - ${TRF.toFixed(2)}) - ${RAIL.toFixed(3)})));` : ''}
            }`).join('')}
            albedo = mix(albedo, vec3(0.0082, 0.0138, 0.0080), clamp(bike, 0.0, 1.0) * 0.55);
            albedo = mix(albedo, vec3(0.0358, 0.0372, 0.0412), chan * 0.82);
            albedo = mix(albedo, albedo * 0.40, clamp(grv, 0.0, 1.0) * 0.85);
            albedo = mix(albedo, vec3(0.262, 0.256, 0.234), clamp(mark, 0.0, 1.0) * 0.80);

            // and over the middle of all that, the hand-drawn intersection
            vec2 ruv = vec2(wp.x / ${XLEN.toFixed(1)} + 0.5, 0.5 - wp.z / ${XLEN.toFixed(1)});
            float inSq = smoothstep(0.008, 0.055, ruv.x) * smoothstep(0.992, 0.945, ruv.x)
                       * smoothstep(0.008, 0.055, ruv.y) * smoothstep(0.992, 0.945, ruv.y);
            vec3 baked = texture2D(uRoad, ruv).rgb * 0.50;
            albedo = mix(albedo, baked, inSq);

            // Where it stands. The camber holds water against the kerb and in
            // the tram grooves, and the low spots in the asphalt keep the rest.
            float ax = abs(wp.x);
            float gutter = smoothstep(${(SW - 2.4).toFixed(2)}, ${(SW - 0.3).toFixed(2)}, ax) * road;
            float groove = smoothstep(0.55, 0.18, abs(ax - ${TRS.toFixed(2)})) * road * 0.55;
            float pool = smoothstep(0.52, 0.74, fbm(wp.xz * 0.42 + 4.0)) * road;
            pool = clamp(pool * 0.85 + gutter * 0.75 + groove, 0.0, 1.0);
            albedo = mix(albedo, albedo * 0.82, pool * 0.35);

            /* Dry, near enough. The pools, the gutter smear and the ripple
               were the whole reason this road read as wet; at twenty to six on
               a clear evening what is left is the low sheen a road always has
               into the sun, so gloss comes down to about a third and the
               ripple goes to nothing. */
            float gloss = clamp(road * 0.30 + path * 0.12 + pool * 0.20, 0.0, 1.0);
            float rip = 0.0;

            vec3 diff, spec;
            wetLight(wp, uCamPos, rip, gloss, diff, spec);

            // Under cloud the road was mostly a photograph of the sky and the
            // ten sources were accents on it. Dry and lit from the side, the
            // albedo leads and the mirror is a quarter of what it was.
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
            /* What is actually falling on the ground, which is not what this
               was using and is most of why the roadway read as flat brown.

               uSkyLo is the warm band along the western horizon. At twenty to
               six that colour is seven to one red over blue, and taking the
               whole of a road's diffuse from it means a colourless surface can
               only come out orange, whatever it is painted. Meanwhile the
               footpath running alongside — an ordinary standard material — is
               lit by the three lights section 4 hangs over the street, and the
               brightest of those by a distance is a blue hemisphere. So the
               road and the footpath were being lit by two different afternoons
               and the seam between them was the whole width of the kerb.

               This is those three lights, said as one number. It can be one
               number because the ground's normal is always straight up, so
               every one of them collapses to a constant: 1.45 of the
               hemisphere's sky colour, 0.40 of the warm ambient, and the sun
               at the 0.132 of itself that a level surface gets from a sun this
               low — all of it over pi, which is what a Lambert surface keeps.
               Change a light in section 4 and this wants changing with it. */
            vec3 col = albedo * (vec3(0.477, 0.450, 0.491) + diff);
            col += skyMirror(wp, uCamPos, rip) * gloss * (0.15 + 0.07 * n1);
            col += spec * (0.09 + 0.04 * n1);

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
        /* Cut, not a plane, because of the two places in this world where the
           ground is not the bottom of it. The escalators at City Square go
           down through the plaza to Town Hall Station, and the ones on the
           Flinders Street footpath at Federation Square go down to the other
           end of it, and `ground.js` fills every cell inside every triangle it
           is given — so a solid sheet at y = 0 over either shaft is a lid, and
           the walk stops on it a hand's width below the paving with the
           station still twenty metres under its feet. Both shafts are holes in
           the sheet instead.

           The Federation Square hole is cut to the lined room rather than to
           the opening in the paving above it: the room runs thirty metres
           south under the forecourt and every metre of that is roofed by the
           footpath slab already, so a rectangle of roadway left inside it
           would be a second ceiling nobody can see and the walk would find at
           the top of the descent.

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
            /* Three holes, and each is a lid that would otherwise be there.
               Two are the ways down into Town Hall Station — the City Square
               shaft and the Federation Square one — and the third is the
               river. The whole width of the channel goes, not the channel
               with a strip left in under the bridge: a strip left in is a
               grey floor between the piers that hides every arch from
               anybody standing on the bank. The bridge brings its own deck
               across the gap and section 27 brings the banks. */
            for (const r of [[SQ.VX0, SQ.VZ0, SQ.VX1, SQ.VZ1],
                             [FQ.IX0, FQ.IZN, FQ.IX1, FQ.IZS]]) {
                const shaft = new THREE.Path();
                ring(shaft, r[0], r[1], r[2], r[3]);
                shape.holes.push(shaft);
            }
            const channel = new THREE.Path();
            ring(channel, x0, CUT_N, x1, CUT_S);
            shape.holes.push(channel);
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
        // It used to be cut with the same holes as the sheet above, for the
        // same reason — twenty millimetres down, it was the lid that sheet had
        // stopped being, and from the top of the escalators the shaft came out
        // as a flat grey floor at street level. Ghosting it says that once
        // instead of three times, and says it about the river as well.
        const distance = mesh(sheet(-60, -500, -660, 500, 540), roadMat, 0, -0.02, -60);
        scene.add(distance);
        world.ghost(distance);
    }

    /* ---- footpaths, raised by the kerb, and the bluestone edging ---- */
    /* The repeat is what turns UVs into metres, and every piece of paving in
       this section is written to agree with it: the extruded quadrants carry
       shape coordinates, which are already world metres, and the box strips
       are scaled to metres by `uvScale` before they are merged. One tile is
       PAVE_M across in both, so a slab is a slab everywhere.

       Metalness came down from 0.18 to nothing. There is no environment map in
       this world, so metalness on a matte material is not sheen — it is
       diffuse taken away and given to a specular lobe with nothing to
       reflect, which is why the footpath was reading as a pale flat sheet
       whichever way the sun fell on it. Bluestone is a rough stone and this is
       now a rough stone. */
    paveTex.repeat.set(1 / PAVE_M, 1 / PAVE_M);
    const paveMat = stdMat(0xffffff, { map: paveTex, roughness: 0.80, metalness: 0.0, side: THREE.DoubleSide });
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
            /* And the one quadrant with a hole in it. The south-east footpath
               is the ground Federation Square stands on, and the station
               entrance is a rectangle cut out of it — the same cut the plaza
               at City Square gets in 21c and for the same reason: a sheet of
               paving over a shaft is a lid, however carefully the escalators
               are drawn under it. Only the opening is cut, not the whole room;
               the thirty metres of shaft that run south under the forecourt
               want the slab left over them, because a tunnel with the roof
               taken off is a trench. */
            if (s[0] > 0 && s[1] > 0) {
                const hole = new THREE.Path();
                [[FQ.VX0, FQ.VZ0], [FQ.VX1, FQ.VZ0], [FQ.VX1, FQ.VZ1], [FQ.VX0, FQ.VZ1]]
                    .forEach((p, i) => { i ? hole.lineTo(p[0], -p[1]) : hole.moveTo(p[0], -p[1]); });
                hole.closePath();
                shape.holes.push(hole);
            }
            const g = new THREE.ExtrudeGeometry(shape, { depth: KERB_H + 0.07, bevelEnabled: false });
            g.rotateX(-Math.PI / 2);
            g.translate(0, -0.07, 0);
            slabs.push(g);
        }
        /* the footpaths of the three cross streets carried north, and
           Swanston's own between them.

           `uvScale` on every one of these, in metres, is the whole reason the
           near footpath now has paving on it. A box's UVs run nought to one
           across whatever the box is, so a ninety-six metre strip was showing
           a fifth of one tile: eight slabs stretched over the length of a city
           block, which at eye height is a flat grey ribbon and nothing else.
           Scaled to metres and divided by the repeat above, the same texture
           lays a six-hundred course on it the whole way north. */
        for (const st of NST) {
            for (const s of [-1, 1]) {
                for (const r of [[-NX, -BX], [BX, NX]]) {
                    const g = boxG(r[1] - r[0], KERB_H + 0.02, FP);
                    uvScale(g, r[1] - r[0], FP);
                    put(g, (r[0] + r[1]) / 2, (KERB_H + 0.02) / 2 - 0.01, st.z + s * (st.h + FP / 2));
                    slabs.push(g);
                }
            }
            for (const s of [-1, 1]) {
                const g = boxG(FP, KERB_H + 0.02, 96);
                uvScale(g, FP, 96);
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

        /* ---- and the pale margin laid inside every one of those kerbs ----

                Sixty-two centimetres of smaller, lighter unit between the kerb
                and the flagging, which is what the photograph shows and what a
                Melbourne footpath does: the flagging is laid to the building
                and the margin takes up whatever is left over against a kerb
                that was set by a surveyor a century earlier. It earns its own
                draw because it is the only line in the whole view that runs
                unbroken from the camera to the fog — at two hundred metres
                there is no slab left, no leaf left and no kerb left, and this
                band is still telling you where the footpath stops.

                Fifteen millimetres proud of the flagging. Far enough not to
                fight it in the depth buffer at the far end of the street, near
                enough that nobody's foot finds it: `ground.js` merges any two
                surfaces within 1.4 m into one span, so the footpath under this
                stays one continuous walkable thing. */
        const bandParts = [];
        const BW = 0.62, BY = KERB_H + 0.025, BT = 0.05;
        const bandZ = (x, z0, z1) => {
            const g = boxG(BW, BT, Math.abs(z1 - z0));
            uvScale(g, BW / 1.2, Math.abs(z1 - z0) / 1.2);
            put(g, x, BY - BT / 2, (z0 + z1) / 2);
            bandParts.push(g);
        };
        const bandX = (z, x0, x1) => {
            const g = boxG(Math.abs(x1 - x0), BT, BW);
            uvScale(g, Math.abs(x1 - x0) / 1.2, BW / 1.2);
            put(g, (x0 + x1) / 2, BY - BT / 2, z);
            bandParts.push(g);
        };
        for (const s of [[1, -1], [-1, -1], [1, 1], [-1, 1]]) {
            const Lz = s[1] < 0 ? 102.8 : L;
            bandZ(s[0] * (SW + 0.34 + BW / 2), s[1] * (FL + 7.0), s[1] * Lz);
            bandX(s[1] * (FL + 0.34 + BW / 2), s[0] * (SW + 7.0), s[0] * L);
            // the fillet, as a flat quarter-annulus rather than a bent box
            const g = new THREE.RingGeometry(7.0 - 0.34 - BW, 7.0 - 0.34, 10, 1, 0, Math.PI / 2);
            put(g, s[0] * (SW + 7.0), BY, s[1] * (FL + 7.0),
                -Math.PI / 2, 0, (s[0] > 0 ? (s[1] > 0 ? Math.PI * 1.5 : 0) : (s[1] > 0 ? Math.PI : Math.PI * 0.5)));
            bandParts.push(g);
        }
        for (const st of NST) {
            for (const s of [-1, 1]) for (const r of [[-NX, -BX], [BX, NX]]) {
                bandX(st.z + s * (st.h + 0.34 + BW / 2), r[0], r[1]);
            }
            for (const s of [-1, 1]) bandZ(s * (SW + 0.34 + BW / 2), st.z + 12, st.z + 104);
        }
        scene.add(merged(bandParts, stdMat(0xffffff, { map: kerbBandTex, roughness: 0.78 })));
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
        // Stopped at the bridge and picked up again beyond it: between 130 and
        // 240 the rails belong to the deck, which is a metre and a half of
        // ironwork over a hole in the road sheet, and a rail run straight
        // through would hang in the air over the water.
        runZ(-TRS, NZ_END, 130); runZ(TRS, NZ_END, 130);
        runZ(-TRS, 240, RUN_Z1 + 12); runZ(TRS, 240, RUN_Z1 + 12);
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
       8b · Collins Street, Stop 11 — the pair of platform stops

       Swanston between Flinders Lane and Collins Street. Not a safety zone
       like the ones above but a platform stop: the footpath's own level
       carried out into the roadway until it reaches the rail, so the step
       from the platform into a low-floor tram is a step across rather than a
       step up. Two of them, one to each track, and each is its own object.

       One decision worth setting down, because it is the only place this
       departs from the photograph. A real platform stop takes the whole
       kerbside lane: the platform runs from the building line to the rail and
       what traffic there is uses the tram lane. Swanston Street really is
       closed to cars along here, so that costs nothing on the actual street —
       but it is not closed in this world, and twelve cars a lane run the whole
       six hundred metres of it. Rather than route them onto the tracks and
       have them drive through the trams, the platform stops 2.6 m short of the
       kerb and the cars squeeze past behind it, which is what a platform stop
       leaves at the places where the lane does survive. So it still reaches
       the rail, it is still an island you climb onto from the road, and the
       street stays busy.

       Which is also why the ramps matter. You arrive at this one off the
       carriageway rather than off the footpath, so each end runs down to the
       road at about one in eleven — well under the 0.35 the walk calls too
       steep to stand on — and the walk can get up either of them.
       ============================================================ */
    {
        /* The fascia, which is the whole of how you know which stop this is.
           Green band, white type, and the name and the number on separate
           patches of one sheet so a fifty-metre canopy can carry the name at
           one end, the number at the other and plain green between them
           without stretching a single glyph. */
        const stopSheet = tex(1024, 256, (g, W, H) => {
            g.fillStyle = '#00843d'; g.fillRect(0, 0, W, H);
            g.fillStyle = '#ffffff';
            g.textAlign = 'center'; g.textBaseline = 'middle';
            /* Each patch is cut to the shape of the piece of band it goes on,
               which is the whole trick: a name plate six metres long wants a
               rect thirteen times as wide as it is tall or the type comes out
               stretched to five metres of letter, which is what the first pass
               of this did. */
            g.font = '600 50px "Helvetica Neue", Helvetica, Arial, sans-serif';
            g.fillText('Collins Street', 512, 40);
            g.font = '600 58px "Helvetica Neue", Helvetica, Arial, sans-serif';
            g.fillText('Stop 11', 256, 146);
            // the plain white the downlights take, and the disc on the pole:
            // white ground, red ring, red S, which is what says a tram stops
            g.fillStyle = '#ffffff'; g.fillRect(556, 206, 108, 48);
            g.fillStyle = '#ffffff'; g.fillRect(702, 132, 116, 116);
            g.beginPath(); g.arc(760, 190, 58, 0, 6.284); g.fill();
            g.strokeStyle = '#d0202a'; g.lineWidth = 9;
            g.beginPath(); g.arc(760, 190, 50, 0, 6.284); g.stroke();
            g.fillStyle = '#d0202a';
            g.font = '700 72px "Helvetica Neue", Helvetica, Arial, sans-serif';
            g.fillText('S', 760, 194);
        });
        const FAS = {
            name:  [0.00, 0.055, 1.00, 0.258],     // 6.0 m x 0.46 — thirteen to one
            stop:  [0.00, 0.383, 0.50, 0.766],     // 2.4 m x 0.46 — five to one
            /* Bottom left, and it has to be somewhere nothing else is: the
               plain patch was over on the right where the white and the disc
               were later drawn, so the twenty-metre middle run of the band
               came out as one enormously stretched tram-stop disc. */
            plain: [0.020, 0.820, 0.195, 0.977],
            white: [0.547, 0.812, 0.645, 0.984],
            disc:  [0.686, 0.516, 0.799, 0.977],
        };
        const fasMat = emissive(0xffffff, 0xffffff, 0.55, { map: stopSheet, emissiveMap: stopSheet });
        const fas = (g, k) => {
            const r = FAS[k], uv = g.attributes.uv;
            for (let i = 0; i < uv.count; i++) {
                uv.setXY(i, r[0] + uv.getX(i) * (r[2] - r[0]),
                            (1 - r[3]) + uv.getY(i) * (r[3] - r[1]));
            }
            return g;
        };

        const platformStop = (name, side, cz, len) => {
            const conc = [], yell = [], steel = [], glass = [], lit = [], sign = [];
            const D = 0.28;                     // the platform's own height
            const XF = TRS + 1.46;              // 5.16 — the face, a hundred mm off the tram
            const XW = 3.74;                    // and how far out into the road it comes
            /* u is measured out from the rail, so everything below reads the
               same for both platforms and the sign of `side` does the mirror. */
            const B = (arr, u0, y0, z0, u1, y1, z1) => {
                const g = boxG(Math.abs(u1 - u0), Math.abs(y1 - y0), Math.abs(z1 - z0));
                put(g, side * (XF + (u0 + u1) / 2), (y0 + y1) / 2, cz + (z0 + z1) / 2);
                arr.push(g); return g;
            };
            const C = (arr, r0, r1, h, u, y, z, rx, ry, rz) => {
                const g = cylG(r0, r1, h, 10);
                put(g, side * (XF + u), y, cz + z, rx, ry, rz);
                arr.push(g); return g;
            };
            const HL = len / 2;

            // ---- the deck, its ramps, and the two edges
            B(conc, 0, 0, -HL, XW, D, HL);
            for (const e of [-1, 1]) {          // one in eleven down to the carriageway
                const g = boxG(XW, D, 3.2);
                put(g, side * (XF + XW / 2), D / 2 - 0.10, cz + e * (HL + 1.6), e * side * 0.088);
                conc.push(g);
            }
            B(yell, 0, D, -HL, 0.50, D + 0.025, HL);                   // the nosing at the rail
            B(yell, 0.58, D, -HL + 1.0, 1.18, D + 0.03, HL - 1.0);     // and the tactile behind it
            B(conc, XW - 0.16, D, -HL, XW, D + 0.13, HL);              // the upstand on the road side

            /* The canopy. Its leading edge is a run of shallow folds rather
               than a straight line, which is the thing you actually recognise
               these shelters by: from the footpath opposite it reads as a
               zigzag of light and shadow along the whole length, and it is the
               only part of the stop that does anything at all at this hour. */
            const CH = D + 3.02, CZ0 = -len * 0.44, CZ1 = len * 0.44;
            B(steel, 0.42, CH, CZ0, 3.30, CH + 0.13, CZ1);
            {
                const n = Math.max(8, Math.round((CZ1 - CZ0) / 1.30)), st = (CZ1 - CZ0) / n;
                for (let i = 0; i < n; i++) {
                    const g = boxG(0.62, 0.05, st * 0.98);
                    put(g, side * (XF + 0.30), CH + 0.02, cz + CZ0 + st * (i + 0.5),
                        0, 0, side * (i % 2 ? 0.34 : -0.34));
                    steel.push(g);
                }
            }
            // the green band, front and back, and the number on the far end
            for (const u of [0.40, 3.28]) {
                for (const seg of [[CZ0, CZ0 + 6.0, 'name'],
                                   [CZ0 + 6.0, CZ1 - 2.4, 'plain'],
                                   [CZ1 - 2.4, CZ1, 'stop']]) {
                    const g = boxG(0.09, 0.46, Math.abs(seg[1] - seg[0]));
                    put(g, side * (XF + u), CH - 0.24, cz + (seg[0] + seg[1]) / 2);
                    sign.push(fas(g, seg[2]));
                }
            }
            // the posts, and the downlights in a row under the soffit
            for (let i = 0; i <= 5; i++) {
                const z = CZ0 + (CZ1 - CZ0) * (i / 5);
                B(steel, 3.06, D, z - 0.07, 3.20, CH, z + 0.07);
            }
            for (let i = 0; i < 14; i++) {
                const z = CZ0 + (CZ1 - CZ0) * ((i + 0.5) / 14);
                sign.push(fas(B(lit, 1.62, CH - 0.06, z - 0.10, 1.86, CH - 0.01, z + 0.10), 'white'));
            }
            lit.length = 0;

            /* Two shelters under the one canopy, one at each end, which is
               what the photograph shows and is not decoration: the gap between
               them is where you stand to get on, and it is where the pole and
               the machine go. */
            for (const q of [-0.235, 0.235]) {
                const z = len * q, SL = 8.6;
                B(glass, 3.32, D, z - SL / 2, 3.38, D + 2.10, z + SL / 2);     // the back screen
                /* Glazed on the outer end only, and only across the back half
                   of it. Both ends full width was the first pass and it made
                   each shelter a sealed glass box: the walk, quite rightly,
                   would not let anybody in — every cell inside came back
                   unreachable. A shelter you cannot get into is scenery, and
                   the photograph does not show one anyway. The track side and
                   the inner end stay open, which is where you board from. */
                const e = Math.sign(q);
                B(glass, 2.40, D, z + e * SL / 2 - 0.03, 3.38, D + 2.10, z + e * SL / 2 + 0.03);
                B(steel, 1.86, D + 2.06, z - SL / 2, 3.42, D + 2.14, z + SL / 2);
                // the timetable and the network map, hung on the back screen
                for (const b of [-2.2, 0.3]) {
                    B(steel, 3.24, D + 0.95, z + b - 0.55, 3.32, D + 2.00, z + b + 0.55);
                }
                /* The bench: a slatted seat on slim legs with a slatted back,
                   which is a stainless bench and not a concrete one because at
                   this hour the stainless is the one thing on the platform
                   that catches the sun coming up Collins Street. */
                B(steel, 2.42, D + 0.44, z - 3.1, 3.16, D + 0.50, z + 3.1);
                for (let i = 0; i < 9; i++) {
                    const zz = z - 3.1 + 6.2 * (i / 8);
                    B(steel, 2.86, D + 0.50, zz - 0.05, 3.14, D + 1.02, zz + 0.05);
                }
                for (const e of [-2.6, 0, 2.6]) {
                    B(steel, 2.56, D, z + e - 0.04, 2.66, D + 0.44, z + e + 0.04);
                }
            }

            /* The stop pole, between the two shelters: the disc with the S on
               it that means a tram stops here, and the flag under it. */
            C(steel, 0.075, 0.085, 4.35, 1.55, D + 2.17, 0);
            sign.push(fas(B(lit, 1.44, D + 3.60, -0.36, 1.52, D + 4.32, 0.36), 'disc'));
            sign.push(fas(B(lit, 1.46, D + 2.30, -0.13, 1.52, D + 3.30, 0.13), 'plain'));
            lit.length = 0;
            // the ticket machine, and a bin beside it
            B(steel, 2.62, D, 3.9, 3.14, D + 1.42, 4.42);
            B(steel, 2.58, D + 0.62, 3.98, 2.62, D + 1.24, 4.34);
            C(steel, 0.28, 0.24, 0.92, 2.9, D + 0.46, -4.6);
            // and the grate in the paving, which is the one thing down there
            B(steel, 1.90, D - 0.01, -8.6, 2.70, D + 0.015, -7.0);

            const G = new THREE.Group();
            G.add(merged(conc, MATS.concrete), merged(yell, MATS.yellow),
                  merged(steel, MATS.iron), merged(glass, glassMat));
            const em = merged(sign, fasMat);
            G.add(em); world.ghost(em);
            scene.add(G);
            world.part(name, G);
            return G;
        };

        platformStop('tramstop_11e', 1, -182, 52);
        platformStop('tramstop_11w', -1, -182, 52);
    }

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
            /* The awning that used to hang here — three metres of flat slab
               at four thirty-five with a plain fascia off its edge, pointed at
               a patch of grey on this sheet — is gone. These three blocks
               front the west side of Swanston between Flinders Street and
               Flinders Lane, which is sixty metres of footpath somebody
               actually walks, and they now get the same verandah as the rest
               of the street: a lined soffit, downlights and signage, built in
               section 23c where that verandah lives. It could not be built
               here because the frame it is written in wants the vertex-colour
               helpers and the sign atlas, and neither exists yet this far up
               the file. */
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
       in the plaza and a hole in the roadway sheet and land fifteen metres
       under it, on a bare concrete floor with four walls round it and nothing
       else. The station itself is not built: the entrance is signed for it and
       goes down towards it, and what is at the bottom of the dark is somebody
       else's question. You still walk it, which is why the floor and the four
       walls are there: the walk's grid keeps four vertical spans per cell, the
       paving and the landing spend two of them, and the canopy roof is
       ghosted rather than being a third.
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
            wool:   [0.250, 0.000, 0.500, 0.095],
            linen:  [0.500, 0.000, 0.750, 0.095],
            dior:   [0.750, 0.000, 1.000, 0.095],
            westin: [0.000, 0.100, 0.350, 0.195],
            kozmin: [0.350, 0.100, 0.600, 0.195],
            bergen: [0.600, 0.100, 0.850, 0.195],
            regent: [0.850, 0.100, 1.000, 0.195],
            blade:  [0.000, 0.205, 0.075, 0.620],
            bulbs:  [0.090, 0.205, 1.000, 0.250],
            poster: [0.090, 0.270, 0.290, 0.620],
            bill:   [0.310, 0.270, 0.780, 0.620],
            atelier:[0.800, 0.270, 1.000, 0.352],
            pho:    [0.800, 0.360, 1.000, 0.442],
            facet:  [0.800, 0.450, 1.000, 0.532],
            bar:    [0.800, 0.540, 1.000, 0.620],
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
            fascia('wool',   'THE WOOLSTORE',    '#f4ece0', '#3a4048', 54, 'knitwear · alterations');
            fascia('linen',  'LINEN & CO',       '#fbf6ec', '#7d6a4e', 58, 'shirtmakers since 1962');
            fascia('dior',   'DIOR',             '#f6f2ea', '#101012', 128);
            fascia('westin', 'THE WESTIN',       '#f0e2bd', '#1b232b', 78, 'MELBOURNE');
            fascia('kozmin', 'KOZMIN',           '#ffeec2', '#1b1a18', 74, 'fine jewellery');
            fascia('bergen', 'BERGEN & CO',      '#ffeec2', '#2a1f16', 58, 'jewellers since 1911');
            fascia('regent', 'REGENT',           '#fff3d2', '#7d1f1a', 84);
            fascia('boss',   'BOSS',             '#f2f0ec', '#141416', 96);
            fascia('coco',   'COCO BLACK',       '#f6e9d2', '#2b1a12', 62, 'chocolate · since 2008');
            fascia('sbux',   'STARBUCKS',        '#e8f6ec', '#0d5c3f', 60, 'coffee');
            fascia('noodle', 'HOT POT & NOODLE', '#fff0d0', '#9a1f1a', 50, 'open till late');
            fascia('wales',  'Wales Corner',      '#f4f2ee', '#101114', 62);
            fascia('atelier','ATELIER SIX',       '#f2efe6', '#2b2f33', 52, 'womenswear · made here');
            fascia('pho',    'PHO HOA',           '#fff4d8', '#8a2418', 56, 'vietnamese · dine in');
            fascia('facet',  'FACET',             '#fff2cf', '#231d2e', 60, 'diamonds · watches');
            fascia('bar',    'THE MITRE',         '#ffe6b8', '#241a12', 52, 'public bar · upstairs');
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

        /* And a third sheet, for the signs that are not flat on a wall.

           The shop atlas above is one plate per tenant and it is always the
           same plate — same height, same size, same white on the same dark —
           which is most of why this street reads as a prototype. A real
           frontage signs itself four or five times over and at four or five
           different depths: a board on the face of the verandah, a lightbox
           slung under the soffit facing the way you are walking, blades
           bracketed out at right angles to the wall, a menu case beside the
           door, a number on the pier. No two of them are the size of the
           neighbour's, and half of them are only legible from underneath,
           which is where the person actually is.

           Its own sheet rather than more room on SHOP, because SHOP is being
           worked on elsewhere tonight and two hands on one canvas is one
           corrupted atlas.

           Drawn once rather than twice: the emissive pass is the same artwork
           under a global alpha. A black ground stays black and emits nothing
           however bright the sign is, white type on it carries the whole glow,
           and the alpha is how alight this particular sign is — a new neon one
           at 1.0, a tired one nobody has re-lamped at a third of that. Which
           is the variation the street is short of, got for free.

           Every rect is laid out at the aspect of the plate it lands on, and
           the placement code sizes each plate from its key rather than the
           other way round. Not tidiness: a 12:1 label stretched onto a 3:1 box
           is how this world got letters five metres long this morning. */
        const AWN = {
            // boards for the face of the verandah fascia — 11.7 : 1
            fNel: [0.005, 0.004, 0.965, 0.086],
            fSus: [0.005, 0.094, 0.965, 0.176],
            fVic: [0.005, 0.184, 0.965, 0.266],
            fDen: [0.005, 0.274, 0.965, 0.356],
            fGld: [0.005, 0.364, 0.965, 0.446],
            fPrl: [0.005, 0.454, 0.965, 0.536],
            // lightboxes slung under the soffit — 3.2 : 1, then 2.2 : 1
            hgA: [0.005, 0.548, 0.318, 0.646],
            hgB: [0.335, 0.548, 0.648, 0.646],
            hgC: [0.665, 0.548, 0.978, 0.646],
            hgD: [0.005, 0.652, 0.221, 0.750],
            hgE: [0.253, 0.652, 0.469, 0.750],
            hgF: [0.501, 0.652, 0.717, 0.750],
            hgG: [0.749, 0.652, 0.965, 0.750],
            // menu and poster cases, flat on the wall — 0.44 : 1
            mnA: [0.005, 0.756, 0.1115, 0.998],
            mnB: [0.115, 0.756, 0.2215, 0.998],
            mnC: [0.225, 0.756, 0.3315, 0.998],
            mnD: [0.335, 0.756, 0.4415, 0.998],
            // round blades, square because a disc's uv fills its own square
            rbA: [0.452, 0.756, 0.572, 0.876],
            rbB: [0.578, 0.756, 0.698, 0.876],
            rbC: [0.704, 0.756, 0.824, 0.876],
            rbD: [0.830, 0.756, 0.950, 0.876],
            // and rectangular ones — 2.5 : 1
            xbA: [0.452, 0.882, 0.592, 0.938],
            xbB: [0.598, 0.882, 0.738, 0.938],
            xbC: [0.744, 0.882, 0.884, 0.938],
            // street numbers, and the one downlight the whole soffit repeats
            nbA: [0.452, 0.944, 0.511, 0.998],
            nbB: [0.518, 0.944, 0.577, 0.998],
            nbC: [0.584, 0.944, 0.643, 0.998],
            nbD: [0.650, 0.944, 0.709, 0.998],
            dl:  [0.760, 0.944, 0.814, 0.998],
        };
        const awnSheet = (emis) => tex(2048, 2048, (g, W, H) => {
            const R = (k) => [AWN[k][0] * W, AWN[k][1] * H,
                              (AWN[k][2] - AWN[k][0]) * W, (AWN[k][3] - AWN[k][1]) * H];
            g.fillStyle = emis ? '#000' : '#15171a'; g.fillRect(0, 0, W, H);

            const SANS = '"Helvetica Neue", Helvetica, Arial, sans-serif';
            const SER = 'Georgia, "Times New Roman", serif';
            // Clipped and moved to the patch's own origin, so every drawing
            // below is written in its own rectangle and cannot spill into the
            // neighbour's — which is the other way this system breaks.
            const patch = (k, lit, draw) => {
                const [x, y, w, h] = R(k);
                g.save();
                g.beginPath(); g.rect(x, y, w, h); g.clip();
                g.translate(x, y);
                if (emis) g.globalAlpha = lit;
                draw(w, h);
                g.restore();
            };
            const T = (t, px, x, y, col, weight, face, align) => {
                g.fillStyle = col;
                g.textAlign = align || 'center'; g.textBaseline = 'middle';
                g.font = `${weight || 700} ${px}px ${face || SANS}`;
                g.fillText(t, x, y);
            };
            // grime, which is what tells a sign put up last year from one put
            // up in 1994 and never washed since
            const worn = (w, h, amount) => {
                g.fillStyle = `rgba(20,16,10,${amount})`;
                for (let i = 0; i < 26; i++) {
                    const u = ((i * 61) % 100) / 100, v = ((i * 37) % 100) / 100;
                    g.fillRect(u * w, v * h, w * 0.05, h * (0.10 + v * 0.5));
                }
            };

            /* ---- the boards on the face of the verandah ---- */
            const board = (k, o) => patch(k, o.lit, (w, h) => {
                g.fillStyle = o.field; g.fillRect(0, 0, w, h);
                if (o.rule) { g.fillStyle = o.rule; g.fillRect(w * 0.03, h * 0.86, w * 0.94, h * 0.05); }
                const cx = o.mark ? w * 0.58 : w * 0.50;
                T(o.name, h * (o.sub ? 0.50 : 0.62), cx, h * (o.sub ? 0.38 : 0.48),
                  o.ink, o.weight, o.face);
                if (o.sub) T(o.sub, h * 0.19, cx, h * 0.72, o.subInk || o.ink, 400);
                if (o.mark) o.mark(w, h);
                if (o.grime) worn(w, h, o.grime);
            });
            // the fish beside the restaurant's name, which is the one thing on
            // that board that is not a word and the thing you recognise first
            /* Beside the name and not at the far end of the board. On a plate
               eleven times as wide as it is high, "at the left" is four metres
               away from the word it belongs to, and the two stop reading as
               one sign. */
            const fish = (col) => (w, h) => {
                const cx = w * 0.36, cy = h * 0.48, r = h * 0.30;
                g.fillStyle = col;
                g.beginPath(); g.ellipse(cx, cy, r * 1.5, r * 0.66, -0.10, 0, 7); g.fill();
                g.beginPath();
                g.moveTo(cx + r * 1.30, cy); g.lineTo(cx + r * 2.35, cy - r * 0.72);
                g.lineTo(cx + r * 2.35, cy + r * 0.72); g.closePath(); g.fill();
                g.fillStyle = '#0b0b0c';
                g.beginPath(); g.arc(cx - r * 0.80, cy - r * 0.14, r * 0.11, 0, 7); g.fill();
            };
            board('fNel', { lit: 0.92, field: '#0d0d0f', ink: '#f6f1e4', face: SER,
                            name: 'NELAYAN', sub: 'RESTAURANT  ·  SEAFOOD  ·  DINE IN',
                            subInk: '#d8cdb4', mark: fish('#d8352a') });
            board('fSus', { lit: 1.00, field: '#a8161a', ink: '#fff6ea',
                            name: 'sushi train', sub: 'hand roll bar  ·  open till late',
                            subInk: '#ffd9c0', weight: 600 });
            board('fVic', { lit: 0.62, field: '#efe7d3', ink: '#23402f', face: SER,
                            name: 'VICTORIA & CO', sub: 'womenswear  ·  since 1946',
                            subInk: '#5b6f5c', rule: '#23402f' });
            board('fDen', { lit: 0.30, field: '#3b4046', ink: '#c9c3b4',
                            name: 'DENIM BAR', sub: 'jeans · repairs · alterations',
                            subInk: '#8f8b80', grime: 0.16 });
            board('fGld', { lit: 0.78, field: '#101014', ink: '#e5bb63', face: SER,
                            name: 'GOLD & CO', sub: 'WATCHES  ·  REPAIRS  ·  VALUATIONS',
                            subInk: '#a58c50', rule: '#8a6d34' });
            board('fPrl', { lit: 0.55, field: '#17203a', ink: '#dfe4ee', face: SER,
                            name: 'PEARL & SON', sub: 'fine jewellery', subInk: '#9fabc4' });

            /* ---- the lightboxes under the soffit. These are the ones that
                    have to work read end-on from thirty metres up the
                    footpath, so they are a name and a strapline and nothing
                    else, and the name takes two thirds of the box. ---- */
            const hang = (k, o) => patch(k, o.lit, (w, h) => {
                g.fillStyle = o.field; g.fillRect(0, 0, w, h);
                g.fillStyle = o.edge || o.field; g.fillRect(0, 0, w, h * 0.06);
                g.fillRect(0, h * 0.94, w, h * 0.06);
                T(o.name, h * 0.40, w / 2, h * (o.sub ? 0.36 : 0.50), o.ink, o.weight, o.face);
                if (o.sub) T(o.sub, h * 0.16, w / 2, h * 0.72, o.subInk || o.ink, 400);
                if (o.grime) worn(w, h, o.grime);
            });
            hang('hgA', { lit: 0.95, field: '#0c0c0e', edge: '#d8352a', ink: '#e8442f',
                          name: 'NELAYAN', sub: 'seafood  ·  malaysian  ·  level 1',
                          subInk: '#f0a04a', face: SER });
            hang('hgB', { lit: 1.00, field: '#f7f2e8', edge: '#a8161a', ink: '#b41d1d',
                          name: 'sushi train', sub: 'hand roll bar', subInk: '#7b1414', weight: 600 });
            hang('hgC', { lit: 0.70, field: '#12321f', edge: '#c8a45a', ink: '#f2e7cd',
                          name: 'ESPRESSO BAR', sub: 'sandwiches  ·  cakes', subInk: '#c8a45a' });
            hang('hgD', { lit: 1.00, field: '#f2c114', edge: '#1b1a16', ink: '#1b1a16',
                          name: 'BANH MI  $9', sub: 'rolls · coffee', subInk: '#3c3a30' });
            hang('hgE', { lit: 0.58, field: '#132a4e', ink: '#eaf1fb',
                          name: 'OPTOMETRIST', sub: 'eye tests  ·  walk in', subInk: '#a8bcd8' });
            hang('hgF', { lit: 0.26, field: '#4a1f22', ink: '#d6c3ae',
                          name: 'TAILOR', sub: 'alterations while you wait',
                          subInk: '#9c8a78', grime: 0.20 });
            hang('hgG', { lit: 1.00, field: '#1a0d22', ink: '#ff5fc8',
                          name: 'KARAOKE', sub: 'level 1  ·  open 6pm', subInk: '#6fe6ff' });

            /* ---- the menu and poster cases, flat on the wall beside a door.
                    A grid of photographed dishes is the one sign on this
                    street that is a picture rather than a word, and at this
                    hour it is also the brightest thing at eye level. ---- */
            patch('mnA', 1.00, (w, h) => {                 // the photo menu
                g.fillStyle = '#f7f3ea'; g.fillRect(0, 0, w, h);
                g.fillStyle = '#b41d1d'; g.fillRect(0, 0, w, h * 0.10);
                T('MENU', h * 0.055, w / 2, h * 0.052, '#fff6ea');
                const DISH = ['#c4652a', '#e2b24a', '#8d3f2c', '#d9d3c0', '#6f8a4a',
                              '#b8452f', '#e8c98a', '#7d4a2c', '#cf8b3a', '#94a86a'];
                for (let r = 0; r < 5; r++) for (let c = 0; c < 2; c++) {
                    const x = w * (0.05 + c * 0.48), y = h * (0.135 + r * 0.172);
                    g.fillStyle = DISH[(r * 2 + c) % DISH.length];
                    g.fillRect(x, y, w * 0.42, h * 0.115);
                    g.fillStyle = 'rgba(255,255,255,0.20)';
                    g.fillRect(x, y, w * 0.42, h * 0.030);
                    g.fillStyle = '#3a3630';
                    g.fillRect(x, y + h * 0.122, w * 0.30, h * 0.014);
                }
            });
            patch('mnB', 0.72, (w, h) => {                 // a printed menu card
                g.fillStyle = '#f4ecd8'; g.fillRect(0, 0, w, h);
                g.fillStyle = '#2b2620'; g.fillRect(w * 0.08, h * 0.05, w * 0.84, h * 0.012);
                T('TODAY', h * 0.048, w / 2, h * 0.105, '#2b2620', 700, SER);
                for (let i = 0; i < 14; i++) {
                    g.fillStyle = i % 4 === 0 ? '#8a2f22' : '#4a443a';
                    g.fillRect(w * 0.10, h * (0.17 + i * 0.056), w * (i % 4 === 0 ? 0.52 : 0.66), h * 0.013);
                    g.fillRect(w * 0.80, h * (0.17 + i * 0.056), w * 0.10, h * 0.013);
                }
            });
            patch('mnC', 0.85, (w, h) => {                 // a poster case
                g.fillStyle = '#14161c'; g.fillRect(0, 0, w, h);
                g.fillStyle = '#e04b1f'; g.fillRect(w * 0.06, h * 0.06, w * 0.88, h * 0.52);
                g.fillStyle = '#14161c';
                g.beginPath(); g.arc(w * 0.50, h * 0.32, h * 0.16, 0, 7); g.fill();
                T('NOW', h * 0.075, w / 2, h * 0.68, '#f4efe4');
                T('SHOWING', h * 0.048, w / 2, h * 0.76, '#f0a04a');
                g.fillStyle = '#6d6a62'; g.fillRect(w * 0.16, h * 0.84, w * 0.68, h * 0.012);
            });
            patch('mnD', 0.22, (w, h) => {                 // and one nobody has changed
                g.fillStyle = '#cdc6b4'; g.fillRect(0, 0, w, h);
                g.fillStyle = '#7a736a';
                for (let i = 0; i < 11; i++) g.fillRect(w * 0.12, h * (0.10 + i * 0.078), w * 0.70, h * 0.016);
                worn(w, h, 0.26);
            });

            /* ---- the blades, which are the only signs on the street that
                    are square-on to somebody walking toward them ---- */
            const disc = (k, o) => patch(k, o.lit, (w, h) => {
                g.fillStyle = o.field;
                g.beginPath(); g.arc(w / 2, h / 2, w * 0.49, 0, 7); g.fill();
                if (o.ring) {
                    g.strokeStyle = o.ring; g.lineWidth = w * 0.045;
                    g.beginPath(); g.arc(w / 2, h / 2, w * 0.42, 0, 7); g.stroke();
                }
                if (o.cross) {
                    g.fillStyle = o.ink;
                    g.fillRect(w * 0.20, h * 0.42, w * 0.60, h * 0.16);
                    g.fillRect(w * 0.42, h * 0.20, w * 0.16, h * 0.60);
                    return;
                }
                T(o.name, w * (o.name.length > 9 ? 0.115 : 0.155), w / 2,
                  h * (o.sub ? 0.42 : 0.50), o.ink, o.weight, o.face);
                if (o.sub) T(o.sub, w * 0.085, w / 2, h * 0.62, o.subInk || o.ink, 400);
            });
            disc('rbA', { lit: 1.00, field: '#f8f4ec', ink: '#b41d1d', name: 'sushi',
                          sub: 'train', weight: 600 });
            disc('rbB', { lit: 0.95, field: '#f8f4ec', ink: '#b41d1d', name: 'hand roll',
                          sub: 'bar', weight: 600 });
            disc('rbC', { lit: 0.66, field: '#101014', ink: '#e5bb63', ring: '#8a6d34',
                          name: '1888', sub: 'PUBLIC BAR', face: SER });
            disc('rbD', { lit: 0.88, field: '#1c7a4a', ink: '#f2fbf5', cross: true });
            const blade = (k, o) => patch(k, o.lit, (w, h) => {
                g.fillStyle = o.field; g.fillRect(0, 0, w, h);
                if (o.edge) { g.fillStyle = o.edge; g.fillRect(0, 0, w * 0.05, h); }
                T(o.name, h * 0.44, w * 0.54, h * 0.50, o.ink, o.weight);
                if (o.grime) worn(w, h, o.grime);
            });
            blade('xbA', { lit: 0.80, field: '#101216', edge: '#3f7fd8', ink: '#eaf1fb',
                           name: 'ATM  24 HRS' });
            blade('xbB', { lit: 1.00, field: '#c21f16', ink: '#fff3d8', name: 'HOT FOOD' });
            blade('xbC', { lit: 0.34, field: '#2a3550', ink: '#c3ccdd',
                           name: 'MASSAGE  L1', grime: 0.18 });

            /* ---- the number on the wall, which is the smallest sign on the
                    street and the only one anybody has ever needed ---- */
            const numb = (k, n, field, ink, lit) => patch(k, lit, (w, h) => {
                g.fillStyle = field; g.fillRect(0, 0, w, h);
                T(n, h * 0.58, w / 2, h * 0.54, ink);
            });
            numb('nbA', '163', '#1a1c20', '#e8e2d4', 0.30);
            numb('nbB', '169', '#e6dfcd', '#25231e', 0.14);
            numb('nbC', '175', '#1a1c20', '#e8e2d4', 0.30);
            numb('nbD', '181', '#7d1f18', '#f4e7cf', 0.42);

            /* ---- and the downlight, one patch stamped a few hundred times
                    down the soffit. Warm, small and hot in the middle: at this
                    hour it is the only reason the underside of a verandah is
                    not a black lid over the footpath. ---- */
            patch('dl', 1.00, (w, h) => {
                g.fillStyle = '#2a2724'; g.fillRect(0, 0, w, h);
                g.fillStyle = '#6a6259';
                g.beginPath(); g.arc(w / 2, h / 2, w * 0.40, 0, 7); g.fill();
                g.fillStyle = '#ffdda6';
                g.beginPath(); g.arc(w / 2, h / 2, w * 0.32, 0, 7); g.fill();
                g.fillStyle = '#fff6e4';
                g.beginPath(); g.arc(w / 2, h / 2, w * 0.19, 0, 7); g.fill();
            });
        });

        const signMap = signSheet(false), signEmis = signSheet(true);
        const shopMap = shopSheet(false), shopEmis = shopSheet(true);
        const awnMap = awnSheet(false), awnEmis = awnSheet(true);

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
            /* And a second glass, for balustrades rather than for windows.
               `glass` above is tuned to disappear so that the rooms behind it
               can be seen, and at a fifth it does exactly that — which is
               right for a shopfront and wrong for a metre of glass standing
               on a footpath with nothing behind it. The frameless balustrade
               at the Federation Square entrance came out as two steel lines
               with air between them and the escalator handrails as six bright
               sticks leaning out of a slot. A quarter opacity, both sides
               drawn because you look through it from inside the shaft as well
               as from the street, and no metalness worth the name: there is no
               environment map in this world and a metallic pane finds nothing
               to reflect. */
            pane:   stdMat(0xbcd2dc, {
                        roughness: 0.05, metalness: 0.04,
                        transparent: true, opacity: 0.26, side: THREE.DoubleSide,
                    }),
            /* Emissive concrete, which sounds wrong and is the only honest
               way to have anything under the paving read at all. The four
               real-time lights are all spent above ground and a forward
               renderer gives a room no bounce: under a hemisphere light the
               walls of a shaft face away from every source there is, so the
               bottom of it went to pure black while the plaza over it read
               fine. A third of a stop of emissive across the concrete is the
               little that reaches down there, at the price of no light at
               all — and it stays dim on purpose, because the whole of what
               the opening in the paving is for is that it is dark. */
            crete:  wet(stdMat(0xa9a6a0, {
                        emissive: 0x8d949b, emissiveIntensity: 0.46,
                        roughness: 0.70, metalness: 0.04,
                    })),
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
            /* The verandah signage — every board, lightbox, blade, menu case
               and downlight on the four streets, one material and one draw.
               Metalness stays at nothing and it never goes through `wet`: a
               metallic sign face in a world with no environment map is a black
               rectangle, and these are the things the whole street is for.

               Brighter than `lit`, because these are the signs read from
               underneath — a soffit is the one place in this world that no
               light of any kind reaches, so what a sign under there looks like
               is entirely what its own emissive says it looks like. How bright
               each individual sign is comes off the sheet, not off here. */
            awn:    stdMat(0xffffff, {
                        map: awnMap, emissive: 0xffffff, emissiveMap: awnEmis,
                        emissiveIntensity: 1.60, roughness: 0.38, metalness: 0.0,
                    }),
            /* And the lining under the verandah, which is its own material for
               exactly the reason the canopy in the square is: it is a downward
               face, everything that lights this world comes from above, and a
               plaster soffit painted the pale grey it really is came out
               black. Half a stop of emissive is the bounce off a lit shopfront
               that a forward renderer will not give it, and it stays well
               under the bloom threshold so the ceiling does not glow — the
               downlights punched into it are what glow. */
            vsoff:  stdMat(0xd6d0c4, {
                        emissive: 0x8c8175, emissiveIntensity: 0.52,
                        roughness: 0.62, metalness: 0.0,
                    }),
            /* Two more for the tower in section 25, because `body` is a wall
               and Eureka has no walls. Its curtain wall wants to be glossy and
               nearly black and the gold wants to be the brightest thing south
               of the river, and neither of those is a precast facade at
               roughness three quarters.

               Both are metalness one tenth and no higher, for the reason the
               canopy steel above already had to learn: there is no environment
               map in this world, so a metallic surface has nothing to reflect
               and goes to black wherever the sun does not strike it square.
               What makes this glass read as glass is the gradient painted up
               its own height, not the material. */
            euGlass: stdMat(0xffffff, {
                        vertexColors: true, roughness: 0.22, metalness: 0.10,
                    }),
            /* And a third of a stop of emissive on the gold, which is not a
               cheat but the only way a crown lit from behind stays gold. The
               sun is west-north-west and low; the crown's south and east faces
               see none of it, and the fog it stands in is warm. Without this
               the top ten storeys went the same grey as the shaft from the one
               place in the world anybody looks at them from. */
            euGold: stdMat(0xffffff, {
                        vertexColors: true, roughness: 0.30, metalness: 0.10,
                        emissive: 0xc98a33, emissiveIntensity: 0.42,
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
        const awn = (g, k) => uvRect(g, AWN[k][0] + 0.0008, 1 - AWN[k][3] + 0.0008,
                                        AWN[k][2] - 0.0008, 1 - AWN[k][1] - 0.0008);
        /* How wide a patch is drawn against how tall, on a sheet that is
           square so the two fractions are directly comparable. Every plate on
           the street is sized `AR(k) * height` rather than to the tenancy, and
           that one line is the whole defence against the trap that has bitten
           this system twice today: artwork drawn at one proportion and mapped
           onto a box at another does not crop, it stretches. */
        const AR = (k) => (AWN[k][2] - AWN[k][0]) / (AWN[k][3] - AWN[k][1]);

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
            /* Australia 108, across the river and in nobody else's colours:
               blue mirror glass graded sill to head the way every pane in
               this world is, the pale rule that runs at every slab of it,
               and the two golds — the flank you photograph and the soffit
               under the teeth, which is a shade lighter because it is the
               face that has to carry from four hundred metres. */
            a108Lo:   0x22405e, a108Hi:   0x86b2d6, a108Band: 0xc6dbec,
            a108Gold: 0xd8a238, a108Soff: 0xf0cd6e, a108Base: 0x39434e,
            /* Eureka's own eight, and they are the building's argument rather
               than its materials: blue for the flag, white for its cross, red
               for what was spilled under it, gold for what everybody was
               there for. Written brighter than they look, because every hex
               in this file is read through the double conversion section 0
               owns up to and then graded again by TONE — a blue-black typed
               as blue-black comes out as nothing at all. */
            euGlassLo: 0x22406e, euGlassHi: 0x5389c9, euBand: 0x6d8098,
            euWhite:  0xeef1f2, euWhiteLo: 0xc6ccd0, euRed: 0xcf3327,
            euGoldLo: 0xe0ac3d, euGoldHi: 0xffde90, euGoldBand: 0xe7ba58,
            euBase:   0x6c6f70,
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
            // the verandahs over the footpath: the lining under them, which is
            // the one surface on the street that faces away from every source
            // of light there is, and everything hung off them or bolted
            // through them that is alight. Two arrays, two draws, four streets
            awnSoff: [], awnLit: [],
            // the square: the canopy, the entrance box, the paving furniture
            qSteel: [], qRoof: [], qClad: [], qGlass: [], qTrim: [], qSign: [],
            // the way down: the escalator banks, the stairs, and the concrete
            // boxes at the bottom of the two shafts — both ends of Town Hall
            // Station accumulate into these, because they are one station
            // however little there is between them
            sCrete: [], sSteel: [], sTrim: [],
            // and its signage, which is the one thing at the Federation Square
            // end that neither concrete nor steel nor bronze can carry: the
            // blue blades, the panel on the balustrade, the light line in the
            // base shoe and the strips down the shaft wall
            sSign: [],
            // and the inclined balustrades, which are ghosted — see 21f
            gGlass: [], gTrim: [],
            // the Federation Square end's balustrades, inclined and flat
            // alike, ghosted for the same reason and in the glass a
            // balustrade wants rather than the glass a shopfront wants
            sPane: [],
            // Australia 108, half a kilometre away over the river: the whole
            // of it in two arrays, because at that range the only decision
            // that survives is which of the two colours a surface is.
            a108: [], a108g: [],
            // Eureka Tower, three hundred metres south over the river: its
            // painted work, its curtain wall, and the ten storeys of gold on
            // top of it — see section 25
            eu: [], euG: [], euGold: [],
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
            if (arr === P.qClad) {
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
                        F(A, 0x59524a, XF + 1.9, 0.95, zc + sd * 2.3, XF + 2.35, 1.28, zc + sd * 1.9);
                        F(A, CF.gold,  XF + 1.95, 1.28, zc + sd * 2.25, XF + 2.30, 1.40, zc + sd * 1.95);
                    }
                    let g = cylG(0.17, 0.13, 1.05, 9); put(g, XF + 2.1, 1.05, zc); FG(A, 0xe8e0d2, g);
                    g = cylG(0.09, 0.17, 0.62, 9); put(g, XF + 2.1, 1.88, zc); FG(A, 0xe8e0d2, g);
                    g = sphG(0.13, 9, 7); put(g, XF + 2.1, 2.30, zc); FG(A, 0xe8e0d2, g);
                    F(A, 0x4a4a4e, XF + 1.85, 1.30, zc + 0.30, XF + 2.35, 2.05, zc - 0.30);
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

           Three escalators and a stair, side by side, dropping fifteen metres
           through the hole in the plaza. You come at it from the Collins
           Street end and ride south, which is the one thing about this flight
           that is worth saying twice: the top of it is the north edge of the
           hole and the bottom is the south edge, and nothing below types
           either number. It asks the void which end it starts at, so turning
           the whole entrance round is swapping two names.

           The angle is not typed either. It is read off the two ends, because
           the two ends are the plaza and the landing at the bottom of the
           shaft, and an escalator that arrives half a metre under its landing
           is a hole somebody falls down.
           ------------------------------------------------------------ */
        const ESC = { ZT: SQ.VZ0, ZB: SQ.VZ1, YT: SQ.DECK, YB: SQ.HALL };
        {
            const slope = (ESC.YB - ESC.YT) / (ESC.ZB - ESC.ZT);      // −15.17 over 26.5
            const yAt = (z) => ESC.YT + (z - ESC.ZT) * slope;
            // Which way down is, in z. Everything that has to sit a little
            // inside one end or a little past the other reads it off here
            // rather than off a sign somebody typed once and would have to
            // remember to turn over.
            const DOWN = Math.sign(ESC.ZB - ESC.ZT);
            const OVER = 1.4;                                          // run past the bottom landing
            const ZB2 = ESC.ZB + DOWN * OVER;

            /* one escalator: the step band you walk on, the truss under it,
               two glass balustrades and the bronze handrail along each */
            const escalator = (cx, w) => {
                rampZ(w, 0.24, ESC.ZT, ESC.YT - 0.12, ZB2, yAt(ZB2) - 0.12, cx, P.sSteel);
                // The truss is wider than the escalator on purpose. The walk's
                // cells are about a metre and a half here and the gaps between
                // three escalators and a stair are two hundred millimetres, so
                // the trusses are what has to overlap: a cell centre that lands
                // in a gap must still find solid, or the bank has a slot down
                // it that a person falls through on the way to the bottom.
                rampZ(w + 0.90, 1.30, ESC.ZT, ESC.YT - 0.95, ZB2, yAt(ZB2) - 0.95, cx, P.sCrete);
                for (const s of [-1, 1]) {
                    const bxx = cx + s * (w / 2 + 0.14);
                    rampZ(0.10, 1.02, ESC.ZT, ESC.YT + 0.51, ZB2, yAt(ZB2) + 0.51, bxx, P.gGlass);
                    rampZ(0.16, 0.11, ESC.ZT, ESC.YT + 1.07, ZB2, yAt(ZB2) + 1.07, bxx, P.gTrim);
                }
                // the comb plates, top and bottom, in the same bronze
                for (const zz of [ESC.ZT + DOWN * 0.4, ESC.ZB - DOWN * 0.4]) {
                    bx3(P.sTrim, null, cx - w / 2, yAt(zz) - 0.02, zz - 0.55, cx + w / 2, yAt(zz) + 0.05, zz + 0.55);
                }
            };
            escalator(26.90, 1.62);
            escalator(28.70, 1.62);
            escalator(30.50, 1.62);

            /* the stair beside them, with every tread in it. Eighty-three
               boxes is nothing merged, and a public stair drawn as a smooth
               ramp is the one thing in a station that always looks wrong. */
            {
                const cx = 33.50, w = 3.00, n = 83;
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

            /* The balustrade round the rest of the hole. Open on the north
               side, because the north side is where you walk in — and solid
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
                rail(SQ.VX0 - 0.11, SQ.VZ1, SQ.VX1 + 0.11, SQ.VZ1 - 0.11);
            }

            /* ---- the bottom of the shaft.

                   There is no station down here. The flight arrives at a bare
                   concrete landing fifteen metres under the paving and stops,
                   and the only thing this box is for is that it is a floor and
                   four walls: somebody who rides all the way down and keeps
                   walking has to be stopped by something, and the alternative
                   to a wall is falling out of the world. Lined right up to the
                   underside of the plaza slab, so the sides of the shaft are
                   concrete the whole way rather than a hole in the air with
                   escalators hanging in it — and lit by nothing, because the
                   world's four lights are all spent above ground and the point
                   of the opening in the paving is that it is dark.

                   Held clear of the flight at every side: the trusses reach a
                   little past the void in x and the escalators overrun it in
                   z, so the room is the void plus a margin rather than the
                   void itself. ---- */
            {
                const IX0 = SQ.VX0 - 0.3, IX1 = SQ.VX1 + 0.3;          // the clear inside
                const IZN = SQ.VZ0 - 0.4, IZS = SQ.VZ1 + 2.4;
                const T = 0.5, TOP = SQ.DECK - 0.34;                   // the plaza soffit
                const C_ = (x0, y0, z0, x1, y1, z1) => bx3(P.sCrete, null, x0, y0, z0, x1, y1, z1);
                C_(IX0 - T, SQ.HALL - T, IZN - T, IX1 + T, SQ.HALL, IZS + T);   // the landing
                C_(IX0 - T, SQ.HALL, IZN - T, IX0, TOP, IZS + T);              // west
                C_(IX1, SQ.HALL, IZN - T, IX1 + T, TOP, IZS + T);              // east
                C_(IX0 - T, SQ.HALL, IZN - T, IX1 + T, TOP, IZN);              // the head end
                C_(IX0 - T, SQ.HALL, IZS, IX1 + T, TOP, IZS + T);              // and the far one
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
            /* A sign, as a thin box with a rect of the atlas on it.

               The whole of this assembly stands the other way round from the
               way it was first drawn — you come at the shaft from the Collins
               Street end now and walk south into it — and the thing to check
               when a sign is turned round is that it has not become mirror
               writing. It has not, and no face here needs turning over to make
               that true: a box's six sides are each built with their own u
               running the way a reader standing outside that side reads, so a
               blade two centimetres thick is the right way round from both of
               them and moving it only moves it. */
            const S = (k, x0, y0, z0, x1, y1, z1) => {
                const g = boxG(Math.abs(x1 - x0), Math.abs(y1 - y0), Math.abs(z1 - z0));
                put(g, (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
                P.qSign.push(sgn(g, k));
            };

            // ---- the two batten walls down the sides of the escalator hole,
            //      and the head canopy across the north end of them, which is
            //      the end you walk in at
            B(24.55, SQ.DECK, -184.5, 25.45, SQ.DECK + 3.70, -173.5);
            B(35.45, SQ.DECK, -184.5, 36.35, SQ.DECK + 3.70, -173.5);
            B(24.55, SQ.DECK + 3.70, -185.1, 36.35, SQ.DECK + 4.25, -175.5);
            B(24.55, SQ.DECK + 2.42, -185.1, 36.35, SQ.DECK + 3.70, -184.5);  // the header you walk under

            // and the lights in the soffit of it, which are the only thing
            // that makes the top of the shaft read as a way down rather than
            // as a hole in the paving
            for (let i = 0; i < 4; i++) {
                const g = boxG(2.20, 0.08, 0.42);
                put(g, 33.30 - (i % 2) * 5.4, SQ.DECK + 3.66, -183.10 + Math.floor(i / 2) * 4.6);
                P.qSign.push(sgn(g, 'warm'));
            }

            // the station's name across the front of it, and the wayfinding
            // hanging under the head canopy where you read it walking in
            S('townhall', 26.30, SQ.DECK + 2.52, -185.20, 34.60, SQ.DECK + 3.62, -185.22);
            S('collins', 27.20, SQ.DECK + 2.30, -178.90, 33.70, SQ.DECK + 3.20, -178.92);
            S('metro', 36.38, SQ.DECK + 2.10, -172.50, 36.40, SQ.DECK + 3.10, -166.70);

            // ---- the lift, standing on the plaza beside the escalators
            B(22.45, SQ.DECK, -179.60, 24.95, SQ.DECK + 0.30, -176.00);
            for (const s of [[22.45, 22.70], [24.70, 24.95]]) B(s[0], SQ.DECK, -179.60, s[1], SQ.DECK + 3.55, -176.00);
            B(22.45, SQ.DECK + 3.20, -179.60, 24.95, SQ.DECK + 3.70, -176.00);
            G(22.70, SQ.DECK + 0.30, -179.56, 24.70, SQ.DECK + 3.20, -179.60);
            G(22.70, SQ.DECK + 0.30, -176.00, 24.70, SQ.DECK + 3.20, -175.96);
            G(22.66, SQ.DECK + 0.30, -179.50, 22.70, SQ.DECK + 3.20, -176.10);

            // ---- the glazed pavilion on the hotel side, on its stone
            //      plinth, with the bench along the front of it
            B(37.50, SQ.DECK, -180.50, 41.30, SQ.DECK + 0.55, -173.50);
            for (const c of [[37.50, 37.76], [41.04, 41.30]]) {
                B(c[0], SQ.DECK + 0.55, -180.50, c[1], SQ.DECK + 3.40, -173.50);
            }
            B(37.50, SQ.DECK + 3.10, -180.64, 41.30, SQ.DECK + 3.60, -173.36);
            G(37.76, SQ.DECK + 0.55, -180.54, 41.04, SQ.DECK + 3.10, -180.50);
            G(37.76, SQ.DECK + 0.55, -173.50, 41.04, SQ.DECK + 3.10, -173.46);
            G(41.04, SQ.DECK + 0.55, -180.50, 41.08, SQ.DECK + 3.10, -173.50);
            bx3(P.qTrim, null, 40.00, SQ.DECK + 0.42, -173.50, 41.30, SQ.DECK + 0.55, -172.40);

        }

        /* ------------------------------------------------------------
           21h · the other end — Flinders Street, at Federation Square

           The same station, four hundred metres away, and nothing like the
           same object. City Square's entrance is a building: batten walls
           either side of the hole, a head canopy over the top of it, a lift
           and a pavilion on the plaza beside it. This one is a hole in the
           footpath and nothing else. There is no head-house on the real one
           and there is none here — what you see from across Flinders Street is
           a rectangle of frameless glass set into the paving, an escalator
           bank going down out of it, and the descent disappearing under
           Federation Square's forecourt.

           So the vocabulary is 21f's and the object is not. Escalators, a
           stair, an inclined glass balustrade with a lit handrail along it,
           and a lined concrete room at the bottom: all of that is the same and
           accumulates into the same arrays, because it is the same station.
           What is different is everything above the paving. The balustrade
           round the opening is frameless — clear panes in a slim brushed-steel
           base shoe with a thin cap rail on top, rather than City Square's
           bronze — the signs stand on a slim post instead of hanging off a
           canopy, and along the kerb beside it there is the grey tubular guard
           railing that stops people stepping into Flinders Street.

           Two things about the shape of it are collision rather than design.

           The flight runs south, which is the only direction the footpath will
           take it: twenty-six and a half metres of escalator at thirty degrees
           does not fit in seven metres of kerb-to-building, so the opening is
           four metres of it and the rest goes under Federation Square's
           forecourt, which is where the real one goes as well. The slab over
           that is the footpath's own, left uncut — a tunnel with the roof
           taken off is a trench.

           And the frameless balustrade is two objects rather than one. Every
           pane here — the three round the opening and the six standing on the
           escalators and the stair — is ghosted, because a metre of glass
           standing on the paving merges with the paving and the walk would
           offer the top of the cap rail as somewhere to stand, which is the
           same thing that put a person a metre above the steps at City Square.
           What stops anybody is the base shoe and the cap rail themselves:
           they are solid, they are a metre apart, and the walk merges anything
           closer together than 1.4 m into one span — so a shoe at the paving
           and a rail at chest height come out of the encoder as the wall the
           balustrade actually is, with the glass between them costing nothing.
           Which is also the truth of the thing: in a frameless balustrade the
           glass is the infill and the shoe is the structure.
           ------------------------------------------------------------ */
        {
            const D = FQ.DECK;
            const F2 = { ZT: FQ.VZ0, ZB: FQ.ZB, YT: D, YB: FQ.HALL };
            // Read off the two ends, the way 21f's is, and for the same
            // reason: the two ends are the footpath and the floor of the room,
            // and an escalator that arrives half a metre under its landing is
            // a hole somebody falls down.
            const slope = (F2.YB - F2.YT) / (F2.ZB - F2.ZT);      // −15.16 over 26.5
            const yAt = (z) => F2.YT + (z - F2.ZT) * slope;
            const DOWN = Math.sign(F2.ZB - F2.ZT);                 // +1: south, under the forecourt
            const OVER = 1.4;
            const ZB2 = F2.ZB + DOWN * OVER;

            const S = (k, x0, y0, z0, x1, y1, z1) => {
                const g = boxG(Math.abs(x1 - x0), Math.abs(y1 - y0), Math.abs(z1 - z0));
                put(g, (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
                P.sSign.push(sgn(g, k));
            };

            /* ---- the flight: two escalators and a stair beside them. Two,
                    not three — this is the quieter end of the station and the
                    footpath is seven metres wide. The trusses are deliberately
                    wider than what stands on them and overlap each other,
                    because the walk's cells are about a metre and a half here
                    and the gaps between the machines are two hundred
                    millimetres: a cell centre that lands in a gap must still
                    find solid, or the bank has a slot down it. ---- */
            const escalator = (cx, w) => {
                rampZ(w, 0.24, F2.ZT, F2.YT - 0.12, ZB2, yAt(ZB2) - 0.12, cx, P.sSteel);
                rampZ(w + 0.90, 1.30, F2.ZT, F2.YT - 0.95, ZB2, yAt(ZB2) - 0.95, cx, P.sCrete);
                for (const s of [-1, 1]) {
                    const bxx = cx + s * (w / 2 + 0.14);
                    rampZ(0.10, 1.02, F2.ZT, F2.YT + 0.51, ZB2, yAt(ZB2) + 0.51, bxx, P.sPane);
                    rampZ(0.16, 0.11, F2.ZT, F2.YT + 1.07, ZB2, yAt(ZB2) + 1.07, bxx, P.gTrim);
                }
                for (const zz of [F2.ZT + DOWN * 0.4, F2.ZB - DOWN * 0.4]) {
                    bx3(P.sTrim, null, cx - w / 2, yAt(zz) - 0.02, zz - 0.55, cx + w / 2, yAt(zz) + 0.05, zz + 0.55);
                }
            };
            escalator(26.60, 1.62);
            escalator(28.40, 1.62);

            {
                const cx = 31.60, w = 3.00, n = 83;
                rampZ(w + 1.60, 1.10, F2.ZT, F2.YT - 0.80, ZB2, yAt(ZB2) - 0.80, cx, P.sCrete);
                for (let i = 0; i < n; i++) {
                    const z0 = F2.ZT - (F2.ZT - F2.ZB) * (i / n);
                    const z1 = F2.ZT - (F2.ZT - F2.ZB) * ((i + 1) / n);
                    bx3(P.sCrete, null, cx - w / 2, yAt(z1) - 0.34, z0, cx + w / 2, yAt(z1), z1);
                }
                for (const s of [-1, 1]) {
                    const bxx = cx + s * (w / 2 + 0.10);
                    rampZ(0.09, 1.02, F2.ZT, F2.YT + 0.53, ZB2, yAt(ZB2) + 0.53, bxx, P.sPane);
                    rampZ(0.15, 0.10, F2.ZT, F2.YT + 1.09, ZB2, yAt(ZB2) + 1.09, bxx, P.gTrim);
                }
            }

            /* ---- the frameless balustrade round the opening.

                   Three runs and no fourth: the north edge is the head of the
                   flight and you walk straight into it off the footpath, which
                   is the whole of what an entrance without a building is. The
                   far run stands on the two hundred millimetres of paving
                   between the opening and the forecourt, over the top of the
                   shaft as it goes under. ---- */
            {
                const rail = (x0, z0, x1, z1, ox, oz) => {
                    bx3(P.sPane, null, x0, D, z0, x1, D + 1.12, z1);            // the pane, ghosted
                    // Both of these are slimmer than they want to be drawn.
                    // A shoe and a cap heavy enough to see from across the
                    // road stop reading as steel sections and start reading as
                    // two planks lying round a hole, which is what the first
                    // pass of this looked like — the rectangle is made by the
                    // light line and by the gap between the two lines, not by
                    // the sections themselves.
                    bx3(P.sSteel, null, x0 - 0.03, D, z0 - 0.03,
                                        x1 + 0.03, D + 0.10, z1 + 0.03);        // the base shoe
                    bx3(P.sSteel, null, x0 - 0.025, D + 1.10, z0 - 0.025,
                                        x1 + 0.025, D + 1.16, z1 + 0.025);      // and the cap rail
                    // The light line recessed into the face of the shoe that
                    // looks into the opening, which is what makes the
                    // rectangle read from the far kerb once the sun is off the
                    // paving. Emissive; there is no light in it, and there is
                    // no light to spare.
                    const g = boxG(ox ? 0.05 : Math.abs(x1 - x0) + 0.12, 0.06,
                                   oz ? 0.05 : Math.abs(z1 - z0) + 0.12);
                    put(g, (x0 + x1) / 2 - ox * 0.06, D + 0.06, (z0 + z1) / 2 - oz * 0.06);
                    P.sSign.push(sgn(g, 'strip'));
                };
                rail(FQ.VX0 - 0.06, FQ.VZ0, FQ.VX0, FQ.VZ1, -1, 0);            // west
                rail(FQ.VX1, FQ.VZ0, FQ.VX1 + 0.06, FQ.VZ1, 1, 0);             // east
                rail(FQ.VX0 - 0.06, FQ.VZ1, FQ.VX1 + 0.06, FQ.VZ1 + 0.06, 0, 1); // and across the far end
            }

            /* ---- the tactile indicators at the head of the descent, in the
                    brass they are laid in here, and the wayfinding beside
                    them: the station's name on a slim post at the corner of
                    the opening, the roundel under it, and one more panel flat
                    on the balustrade facing the crossing. ---- */
            bx3(P.sTrim, null, FQ.VX0 + 0.10, D, FQ.VZ0 - 0.78, FQ.VX1 - 0.10, D + 0.03, FQ.VZ0 - 0.02);

            // The post stands behind its own blades rather than through them:
            // a sign box two centimetres thick and a post twelve is a post
            // that reads as a stripe down the middle of the lettering from the
            // one side anybody looks at it from.
            bx3(P.sSteel, null, 23.44, D, 16.18, 23.56, D + 3.30, 16.30);
            S('townhall', 22.55, D + 2.36, 16.10, 24.45, D + 2.98, 16.14);
            S('metro', 22.72, D + 1.55, 16.10, 24.28, D + 2.17, 16.14);
            S('metro', 24.90, D + 0.40, 17.10, 24.93, D + 0.82, 18.20);

            /* ---- the guard railing along the kerb, either side of the
                    opening and not across the front of it — which is where the
                    real one stops as well, because the front of it is where
                    everybody is walking in. Two rails on posts, a metre high,
                    and in the encoder the whole thing merges into the one span
                    it is meant to be: a barrier. ---- */
            {
                const guard = (x0, x1) => {
                    const zr = 14.10;
                    const n = Math.round((x1 - x0) / 1.9);
                    for (let i = 0; i <= n; i++) {
                        const g = cylG(0.045, 0.045, 1.02, 8);
                        put(g, x0 + (x1 - x0) * (i / n), D + 0.51, zr);
                        P.sSteel.push(g);
                    }
                    for (const yy of [0.50, 0.98]) {
                        const g = cylG(0.035, 0.035, x1 - x0, 8);
                        put(g, (x0 + x1) / 2, D + yy, zr, 0, 0, Math.PI / 2);
                        P.sSteel.push(g);
                    }
                };
                guard(12.60, 20.50);
                guard(36.60, 46.10);
            }

            /* ---- the bottom of the shaft, and it is the same nothing that is
                    at the bottom of the other one: a lined concrete room
                    fifteen metres under the footpath, four walls and a floor,
                    and where the concourse would be there is a wall. The
                    station under this world was taken out and inventing half
                    of it here to make the descent feel finished would be a
                    worse answer than the wall.

                    Lined the whole way up to the soffit of the footpath slab,
                    so the sides of the shaft are concrete rather than a hole
                    in the air with escalators hanging in it — and lit by
                    nothing. The four real-time lights are all spent above
                    ground; what carries down here is the third of a stop of
                    emissive in the concrete itself, the lit handrails on the
                    balustrades, and a run of light strips down the two walls
                    where the shaft is deep enough for them to clear the
                    paving. ---- */
            {
                const T = 0.5, TOP = FQ.SOFF;
                const C_ = (x0, y0, z0, x1, y1, z1) => bx3(P.sCrete, null, x0, y0, z0, x1, y1, z1);
                C_(FQ.IX0 - T, FQ.HALL - T, FQ.IZN - T, FQ.IX1 + T, FQ.HALL, FQ.IZS + T);   // the floor
                C_(FQ.IX0 - T, FQ.HALL, FQ.IZN - T, FQ.IX0, TOP, FQ.IZS + T);               // west
                C_(FQ.IX1, FQ.HALL, FQ.IZN - T, FQ.IX1 + T, TOP, FQ.IZS + T);               // east
                C_(FQ.IX0 - T, FQ.HALL, FQ.IZN - T, FQ.IX1 + T, TOP, FQ.IZN);               // the head end
                C_(FQ.IX0 - T, FQ.HALL, FQ.IZS, FQ.IX1 + T, TOP, FQ.IZS + T);               // and the far one

                for (let i = 0; i < 6; i++) {
                    const zz = 21.5 + i * 3.4;
                    for (const s of [-1, 1]) {
                        const g = boxG(0.06, 0.20, 2.20);
                        put(g, s < 0 ? FQ.IX0 + 0.03 : FQ.IX1 - 0.03, yAt(zz) + 2.35, zz);
                        P.sSign.push(sgn(g, 'strip'));
                    }
                }
            }
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

        /* ---- one shop, on either street ----

           A shopfront is the same thing whichever way the street runs, so it
           is written once in its own frame — x into the shop, z along the
           frontage, origin at the middle of the glass line — and carried into
           the world by one matrix. Building it twice, once per axis, is how
           the earlier signs came out mirrored.

           There are three trades on this street and no more, repeated down it
           the way real ones are: a clothes shop, a jeweller, a restaurant.
           Three rooms built properly beat eight sketched, because these are
           rooms you walk into, and from the inside the only thing that counts
           is whether there is anything in them. Each keeps its own floor, its
           own walls and its own metal so the trade is legible from the far
           footpath: pale ash and brass with cloth on rails, near-black
           lacquer with lit cases in it, oiled boards under white tablecloths.

           There is nobody behind any of the counters. There was — forty
           shopkeepers, stood up as two instanced meshes at the end of the
           section — and they have been taken out along with everybody else in
           this world. The rooms are lit and open and empty, and the fitouts
           are what has to carry them now.

           The names are two tiers and the comment at each call site says
           which: the ones I know are on these blocks — the burger shop on the
           bronze building, the coffee chain up by Little Collins — and, for
           the rest, invented tenants sized to the tenancy. I cannot check a
           street directory from here, and a guess dressed up as a fact is
           worse than an honest invention. */
        const shopUnit = (face, t0, t1, axis, kind, sign) => {
            const span = Math.abs(t1 - t0), cz = (t0 + t1) / 2;
            if (span < 3.0) return;
            /* A quarter turn the other way for the cross street. Turned the
               way it was, the local x that means "into the shop" came out
               pointing away from the building, and the two rooms on the
               Little Collins frontage were built standing in the roadway with
               their backs to the facade — which the walk read, correctly, as
               a shop nobody can enter.

               Which is why there are two of them now. A cross street has a
               frontage on each side and they look at each other, so 'x' is
               the one whose shop runs north out of the glass and 'X' the one
               whose shop runs south. Same room, opposite quarter turn. */
            const M0 = axis === 'z' ? MX(face, 0, cz, 0, Math.PI, 0)
                    : axis === 'X' ? MX(cz, 0, face, 0, Math.PI / 2, 0)
                                   : MX(cz, 0, face, 0, -Math.PI / 2, 0);
            const D = 6.30, Y_SILL = 0.55, Y_HEAD = 3.90, Y_CEIL = 4.05;
            const HW = span / 2 - 0.30;                       // half the clear opening

            /* Four numbers the whole fitout obeys, and the only reason any of
               these rooms can be walked into. The walk rasterises every
               visible mesh into a grid of about a metre and a half to the
               cell, and a cell goes solid the moment anything at all stands in
               it — so a way through narrower than two cells exists or does not
               exist depending on where the grid's edges happen to fall. That
               is what was keeping people out: a 2.3 m doorway is a metre and a
               half of doorway plus two slivers, and the slivers were catching
               the mullions. Hence an entrance 3.30 m in the clear, an aisle
               the same width running from it to the back, and every stick of
               furniture either beyond `ZL` on the far side or behind `XB`
               where the room ends anyway. */
            const DW = 1.65;                                  // half the entrance
            const DZ = HW - 0.35 - DW;                        // its centre, a jamb off the wall
            const ZW = -HW - 0.16;                            // the far wall's inner face
            const ZL = DZ - DW;                               // the aisle's far edge
            const XB = 5.10;                                  // where the back of the shop starts
            const band = ZL - ZW;                             // the depth the fitout gets

            const g_ = (w, h, d, x, y, z) => put(boxG(w, h, d), x, y, z);
            const LF = (hex, x0, y0, z0, x1, y1, z1) => {
                const g = g_(Math.abs(x1 - x0), Math.abs(y1 - y0), Math.abs(z1 - z0),
                             (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
                g.applyMatrix4(M0); P.shop.push(paint(g, hex)); return g;
            };
            const LG = (x0, y0, z0, x1, y1, z1) => {
                const g = g_(Math.abs(x1 - x0), Math.abs(y1 - y0), Math.abs(z1 - z0),
                             (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
                g.applyMatrix4(M0); P.shopGlass.push(g); return g;
            };
            const LL = (k, x0, y0, z0, x1, y1, z1) => {
                const g = g_(Math.abs(x1 - x0), Math.abs(y1 - y0), Math.abs(z1 - z0),
                             (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
                g.applyMatrix4(M0); P.shopLit.push(shp(g, k)); return g;
            };
            const LC = (hex, r0, r1, h, x, y, z) => {          // a turned thing: a stool, a leg
                const g = cylG(r0, r1, h, 8); put(g, x, y, z);
                g.applyMatrix4(M0); P.shop.push(paint(g, hex)); return g;
            };
            const LX = (hex, r, t, x, y, z) => {               // and one lying on its side
                const g = cylG(r, r, t, 14); put(g, x, y, z, 0, 0, Math.PI / 2);
                g.applyMatrix4(M0); P.shop.push(paint(g, hex)); return g;
            };
            const LS = (x, y, z, r, h) => {                    // a shade, lit, hung nose down
                const g = coneG(r, h, 8); put(g, x, y, z, Math.PI, 0, 0);
                g.applyMatrix4(M0); P.shopLit.push(shp(g, 'warm')); return g;
            };
            const pick = (a) => a[irr(0, a.length - 1)];

            // ---- the shopfront: a riser and glass either side of the entrance
            for (const s of [-1, 1]) {
                const a = s * HW, b = s > 0 ? DZ + DW : ZL;
                if (Math.abs(a - b) < 0.25) continue;
                LF(0x2b2c2e, -0.16, 0, a, 0.10, Y_SILL, b);
                LG(-0.04, Y_SILL, a, 0.04, Y_HEAD, b);
                LF(0x3a3b3d, -0.09, Y_SILL, a, 0.11, Y_SILL + 0.10, b);
                LF(0x3a3b3d, -0.09, 2.95, a, 0.11, 3.05, b);          // the transom bar
                const n = Math.max(1, Math.round(Math.abs(a - b) / 1.35));
                for (let i = 0; i <= n; i++) {
                    const z = a + (b - a) * (i / n);
                    LF(0x3a3b3d, -0.08, Y_SILL, z - 0.045, 0.10, Y_HEAD, z + 0.045);
                }
            }
            // ---- the entrance, its jambs turned outward and its leaf open
            LF(0x3a3b3d, -0.10, 0, DZ + DW, 0.12, Y_HEAD, DZ + DW + 0.10);
            LF(0x3a3b3d, -0.10, 0, ZL, 0.12, Y_HEAD, ZL - 0.10);
            LF(0x3a3b3d, -0.10, 2.95, ZL, 0.12, Y_HEAD, DZ + DW);
            /* The leaf stands open along the jamb, running back into the shop
               and out of the opening it is supposed to have opened — and it
               lies on the glass side of `ZL`, because a leaf three centimetres
               into the clear width is three centimetres of clear width gone. */
            LG(0.16, 0.16, ZL - 0.05, 1.92, 2.82, ZL - 0.02);
            LF(0x6a5a3a, 0.10, 0.10, ZL - 0.08, 0.26, 2.92, ZL - 0.01);
            LF(0x6a5a3a, 1.82, 0.10, ZL - 0.08, 1.98, 2.92, ZL - 0.01);
            LF(0x6a5a3a, 0.10, 0.10, ZL - 0.08, 1.98, 0.30, ZL - 0.01);
            LF(0x6a5a3a, 0.10, 2.78, ZL - 0.08, 1.98, 2.92, ZL - 0.01);
            LF(0xb08a4e, 1.66, 0.94, ZL - 0.13, 1.76, 1.98, ZL - 0.08);
            LF(0x1e1f21, -0.30, 0.02, ZL, 0.40, 0.08, DZ + DW);       // the mat

            // ---- the banner under the awning, at right angles to the wall
            LF(0x585a5e, -1.62, 3.30, DZ - 0.06, -0.20, 3.44, DZ + 0.06);
            LL(sign, -1.55, 2.52, DZ - 0.035, -0.35, 3.26, DZ - 0.005);
            LL(sign, -1.55, 2.52, DZ + 0.005, -0.35, 3.26, DZ + 0.035);

            // ---- the room
            /* Pale, and paler than looks right written down. Everything here
               goes through the world's wet grade on its way to the vertex,
               which takes a warm off-white to about a third of what it says,
               and then it is lit by a hemisphere and nothing else — the four
               real lights are all spent outdoors. A room that reads as a room
               through glass at dusk has to start nearly white, and the
               jeweller, which wants to be dark, gets its darkness from having
               almost nothing but lit cases in it rather than from paint. */
            const PAL = kind === 'jewel'
                ? { floor: 0x9d948a, wall: 0x726a60, ceil: 0x8d857b, cove: 'warm' }
                : kind === 'restaurant'
                ? { floor: 0xa87d4e, wall: 0xded3be, ceil: 0xf2ecdd, cove: 'warm' }
                : { floor: 0xdbd4c6, wall: 0xf4f1e8, ceil: 0xfefcf5, cove: 'cool' };
            LF(PAL.floor, 0.10, 0.06, -HW - 0.3, D, 0.14, HW + 0.3);
            LF(PAL.wall, 0.10, 0.14, -HW - 0.3, D + 0.18, Y_CEIL, ZW);
            LF(PAL.wall, 0.10, 0.14, HW + 0.16, D + 0.18, Y_CEIL, HW + 0.3);
            LF(PAL.wall, D, 0.14, ZW, D + 0.18, Y_CEIL, HW + 0.16);
            LF(PAL.ceil, 0.10, Y_CEIL - 0.12, -HW - 0.3, D + 0.18, Y_CEIL, HW + 0.3);
            /* A lit band across the back rather than a lit back wall. Wall
               to wall and floor to ceiling — which is what it was — it is a
               lightbox with a room silhouetted against it, and everything the
               fitout puts in front of it goes black. Held up at clerestory
               height it does the one job it was for, which is that the back of
               the room is visible from the footpath. */
            LL(PAL.cove, D - 0.14, 2.58, ZW + 0.10, D - 0.06, Y_CEIL - 0.34, HW - 0.10);
            for (let i = 0; i < 3; i++) {
                LL(PAL.cove, 1.1 + i * 1.9, Y_CEIL - 0.22, ZW + 0.25, 1.8 + i * 1.9, Y_CEIL - 0.12, HW - 0.05);
            }

            // ---- and what trade it is
            if (kind === 'clothes') {
                /* Ash, brass and cloth. The window is two dressed forms on a
                   low plinth; the length of the far wall is rail; the back of
                   the room is a fitting room and a wrapping counter, which is
                   the whole shape of every small clothes shop there has ever
                   been. What varies with the tenancy is how much of the middle
                   is free — a narrow bay gets the wall rail and nothing else,
                   a wide one gets a table of folded stock and a second rail
                   standing off the wall. */
                const ASH = 0xd3c7ab, BRASS = 0xc7a457, DK = 0x6f6555;
                const RAG = [0x36414d, 0x6d4a44, 0x2c3330, 0x8a7f6c, 0x463c52, 0x5c6b6a, 0xa89a86];

                // the window: a plinth and two forms dressed differently
                LF(ASH, 0.50, 0.14, ZW + 0.06, 2.20, 0.26, ZW + Math.min(1.20, band - 0.35));
                const form = (x, z, cloth, skirt) => {
                    for (const s of [-1, 1]) LC(0xe4ddcd, 0.055, 0.075, 0.74, x, 0.63, z + s * 0.085);
                    if (skirt) LC(cloth, 0.15, 0.31, 0.58, x, 1.03, z);
                    else { for (const s of [-1, 1]) LC(cloth, 0.085, 0.10, 0.80, x, 0.70, z + s * 0.085); }
                    LC(0xe4ddcd, 0.16, 0.13, 0.46, x, 1.48, z);
                    LC(cloth, 0.19, 0.17, 0.44, x, 1.50, z);
                    LC(0xe4ddcd, 0.10, 0.19, 0.20, x, 1.82, z);
                    LC(0xe4ddcd, 0.05, 0.07, 0.13, x, 1.98, z);
                };
                form(0.95, ZW + 0.60, 0x3f4a58, true);
                form(1.75, ZW + 0.55, 0x6b5340, false);

                // the wall rail, and what is hanging on it
                LF(DK, 2.30, 1.93, ZW + 0.03, 4.92, 2.01, ZW + 0.12);
                LF(BRASS, 2.35, 1.86, ZW + 0.50, 4.88, 1.91, ZW + 0.56);
                for (let i = 0; i < 11; i++) {
                    const x = 2.44 + i * 0.22;
                    LF(pick(RAG), x, 0.99, ZW + 0.28, x + 0.15, 1.80, ZW + 0.72);
                    LF(0xb8b4ac, x + 0.055, 1.78, ZW + 0.50, x + 0.085, 1.93, ZW + 0.54);
                }

                // a table of folded stock, when the bay is deep enough for one
                if (band >= 2.45) {
                    const tz = ZW + 1.42, tz1 = ZW + 2.18;
                    LF(ASH, 0.70, 0.62, tz, 2.20, 0.72, tz1);
                    for (const x of [0.78, 2.06]) for (const z of [tz + 0.08, tz1 - 0.08]) {
                        LF(DK, x - 0.04, 0.14, z - 0.04, x + 0.04, 0.62, z + 0.04);
                    }
                    for (let i = 0; i < 3; i++) {
                        const x = 0.85 + i * 0.45;
                        for (let s = 0; s < 3; s++) {
                            LF(pick(RAG), x, 0.72 + s * 0.055, tz + 0.14,
                                          x + 0.36, 0.77 + s * 0.055, tz1 - 0.14);
                        }
                    }
                }
                // and a rail standing off the wall, when there is room to walk round it
                if (band >= 3.05) {
                    const rz = ZW + 2.15;
                    for (const x of [2.62, 4.66]) {
                        LC(0x8f8779, 0.028, 0.042, 1.60, x, 0.96, rz);
                        LC(0x8f8779, 0.24, 0.26, 0.06, x, 0.19, rz);
                    }
                    LF(BRASS, 2.60, 1.72, rz - 0.03, 4.68, 1.77, rz + 0.03);
                    for (let i = 0; i < 9; i++) {
                        const x = 2.76 + i * 0.21;
                        LF(pick(RAG), x, 0.88, rz - 0.22, x + 0.15, 1.68, rz + 0.22);
                    }
                }

                // the full-length mirror, on the wall the rails face
                LF(0x8a7442, 3.02, 0.16, HW + 0.05, 4.48, 2.30, HW + 0.16);
                LL('cool', 3.12, 0.24, HW + 0.02, 4.38, 2.20, HW + 0.05);

                // the fitting room, in the far back corner, curtained
                LF(0xe6e1d4, 5.22, 0.14, ZW + 1.22, D, 2.44, ZW + 1.32);
                LF(0xe6e1d4, 5.22, 2.30, ZW, 5.32, 2.44, ZW + 1.32);
                for (let i = 0; i < 7; i++) {
                    const x = 5.16 + (i % 2) * 0.11;
                    LF(0x6d3a3e, x, 0.18, ZW + 0.04 + i * 0.175, x + 0.10, 2.28, ZW + 0.19 + i * 0.175);
                }
                LL('cool', D - 0.06, 0.40, ZW + 0.26, D - 0.02, 1.96, ZW + 1.02);
                LC(0x8f8779, 0.14, 0.15, 0.06, 5.75, 0.47, ZW + 0.62);
                LC(0x8f8779, 0.04, 0.05, 0.34, 5.75, 0.27, ZW + 0.62);

                // the wrapping counter, and the light under its lip
                const cz0 = ZW + 1.62, cz1 = Math.min(HW - 0.55, ZL + 1.30);
                LF(ASH, 5.28, 0.14, cz0, 5.98, 1.02, cz1);
                LF(DK, 5.20, 1.02, cz0 - 0.06, 6.06, 1.10, cz1 + 0.06);
                LL('warm', 5.24, 0.24, cz0, 5.28, 0.42, cz1);
                LF(0x3a3b3d, 5.46, 1.10, cz1 - 0.52, 5.82, 1.36, cz1 - 0.18);
                LL('cool', 5.43, 1.16, cz1 - 0.49, 5.46, 1.33, cz1 - 0.21);
                LF(0xd8cdb4, 5.34, 1.10, cz0 + 0.10, 5.60, 1.33, cz0 + 0.46);
                LC(0xb08a4e, 0.055, 0.055, 0.16, 5.88, 1.18, cz0 + 0.28);

                // spots on two tracks, because a clothes shop is lit at the wall
                for (const tz of [ZW + 0.55, ZW + Math.min(1.95, band - 0.30)]) {
                    LF(0x4a4844, 1.00, 3.90, tz - 0.03, 4.90, 3.96, tz + 0.03);
                    for (let i = 0; i < 4; i++) {
                        const x = 1.35 + i * 1.05;
                        LC(0x3a3835, 0.055, 0.075, 0.18, x, 3.80, tz);
                        LL('warm', x - 0.06, 3.66, tz - 0.06, x + 0.06, 3.71, tz + 0.06);
                    }
                }

            } else if (kind === 'jewel') {
                /* Almost nothing in the room, and all of it lit from inside.
                   Cases in a horseshoe with its mouth to the aisle, a wall of
                   small niches at the back with the safe beside them, and a
                   velvet writing counter in the middle of the far run with a
                   stool at each end of it. The emissive deck under the glass
                   is what does the work: it lights the pieces without spending
                   one of the four lights this world has, and at dusk it is the
                   brightest thing on the block. */
                const CASE = 0x2c2823, RIM = 0xa8904f, VEL = 0x46222a, STONE = 0xd9cdae;
                const cabinet = (x0, z0, x1, z1) => {
                    LF(CASE, x0, 0.14, z0, x1, 0.84, z1);
                    LF(RIM, x0 - 0.02, 0.84, z0 - 0.02, x1 + 0.02, 0.90, z1 + 0.02);
                    LL('warm', x0 + 0.05, 0.90, z0 + 0.05, x1 - 0.05, 0.96, z1 - 0.05);
                    LG(x0, 0.96, z0, x1, 1.24, z1);
                    LF(RIM, x0 - 0.02, 1.24, z0 - 0.02, x1 + 0.02, 1.30, z1 + 0.02);
                };
                const piece = (x, z) => {
                    LC(0x1c1916, 0.05, 0.075, 0.10, x, 1.01, z);
                    LC(STONE, 0.032, 0.018, 0.13, x, 1.12, z);
                    LF(0xf2e8c8, x - 0.03, 1.17, z - 0.03, x + 0.03, 1.21, z + 0.03);
                };
                // the horseshoe: the far wall, and a return at each end of it
                cabinet(1.10, ZW + 0.04, 2.50, ZW + 0.62);
                cabinet(3.80, ZW + 0.04, 4.90, ZW + 0.62);
                for (let i = 0; i < 4; i++) piece(1.28 + i * 0.36, ZW + 0.33);
                for (let i = 0; i < 3; i++) piece(3.98 + i * 0.36, ZW + 0.33);
                const rz1 = ZL - 0.24;
                for (const x0 of [1.10, 4.30]) {
                    cabinet(x0, ZW + 0.62, x0 + 0.60, rz1);
                    const n = Math.max(1, Math.floor((rz1 - ZW - 0.62) / 0.40));
                    for (let i = 0; i < n; i++) piece(x0 + 0.30, ZW + 0.82 + i * 0.40);
                }
                // the velvet counter, between the two halves of the far run
                LF(CASE, 2.55, 0.14, ZW + 0.04, 3.75, 0.98, ZW + 0.74);
                LF(VEL, 2.58, 0.98, ZW + 0.07, 3.72, 1.02, ZW + 0.71);
                LF(0x1c1916, 2.72, 1.02, ZW + 0.20, 3.18, 1.05, ZW + 0.56);
                LF(VEL, 2.75, 1.05, ZW + 0.23, 3.15, 1.08, ZW + 0.53);
                for (let i = 0; i < 3; i++) {
                    LF(0xf2e8c8, 2.82 + i * 0.11, 1.08, ZW + 0.31, 2.86 + i * 0.11, 1.11, ZW + 0.45);
                }
                LC(0x2b2724, 0.028, 0.036, 0.075, 3.44, 1.06, ZW + 0.36);
                LC(RIM, 0.024, 0.024, 0.02, 3.44, 1.11, ZW + 0.36);
                // a stool at each end of it
                for (const x of [2.42, 3.90]) {
                    LC(VEL, 0.17, 0.15, 0.07, x, 0.66, ZW + 1.02);
                    LC(0x2b2724, 0.03, 0.045, 0.48, x, 0.38, ZW + 1.02);
                    LC(0x2b2724, 0.19, 0.20, 0.04, x, 0.16, ZW + 1.02);
                }
                // the back wall: small lit niches, and the safe beside them
                LF(0x241f1c, 6.02, 0.82, ZW + 0.10, 6.18, 3.06, ZL);
                const nn = Math.max(2, Math.floor((ZL - ZW - 0.30) / 0.56));
                for (let r = 0; r < 3; r++) for (let c = 0; c < nn; c++) {
                    const z = ZW + 0.26 + c * 0.56;
                    LL('warm', 5.97, 1.04 + r * 0.62, z, 6.02, 1.46 + r * 0.62, z + 0.32);
                }
                const sz = (ZL + HW) / 2 + 0.05;
                LF(0x4e4a42, 5.98, 0.26, sz - 0.80, 6.18, 2.24, sz + 0.80);
                LX(0x9a9287, 0.66, 0.08, 5.96, 1.24, sz);
                LX(0x82796c, 0.60, 0.12, 5.88, 1.24, sz);
                LX(0x2f2a25, 0.09, 0.14, 5.79, 1.24, sz);
                for (let i = 0; i < 4; i++) {
                    const a = Math.PI * i / 4;
                    const g = boxG(0.05, 0.62, 0.05);
                    put(g, 5.82, 1.24, sz, a, 0, 0);
                    g.applyMatrix4(M0); P.shop.push(paint(g, 0xb0a795));
                }
                // and a downlight over each arm of the horseshoe
                for (let i = 0; i < 4; i++) LS(1.45 + i * 1.15, Y_CEIL - 0.66, ZW + 0.62, 0.10, 0.15);

            } else {
                /* Oiled boards, a green banquette the length of the far wall,
                   cloths on the tables and a pass across the back with the
                   kitchen lit behind it. The tables sit against the banquette
                   with their chairs on the aisle side, which is the only way
                   a room seven metres wide seats anybody and still lets the
                   walk down the middle of it — and it is also, as it happens,
                   exactly how every narrow restaurant in this city is laid
                   out. */
                const TIM = 0x7a5636, GRN = 0x27423a, LIN = 0xf2efe6, STEEL = 0xb2b6b8;
                // the banquette
                LF(GRN, 0.65, 0.14, ZW, 4.90, 0.46, ZW + 0.58);
                LF(GRN, 0.65, 0.46, ZW, 4.90, 1.14, ZW + 0.16);
                LF(0x35564a, 0.65, 1.14, ZW, 4.90, 1.20, ZW + 0.18);
                for (let i = 0; i < 6; i++) {
                    LF(0x1d3229, 0.90 + i * 0.68, 0.62, ZW + 0.16, 0.98 + i * 0.68, 0.70, ZW + 0.20);
                }
                // tables against it: one of four, then two of two
                const TBL = [[0.85, 2.15], [2.45, 3.25], [3.55, 4.35]];
                const tz0 = ZW + 0.55, tz1 = ZW + 1.20;
                for (const [x0, x1] of TBL) {
                    LF(TIM, x0 + 0.06, 0.30, tz0 + 0.06, x1 - 0.06, 0.74, tz1 - 0.06);
                    LF(LIN, x0, 0.74, tz0, x1, 0.78, tz1);
                    LF(LIN, x0 + 0.03, 0.34, tz0 + 0.03, x1 - 0.03, 0.74, tz1 - 0.03);
                    const seats = x1 - x0 > 1.0 ? [x0 + 0.33, x0 + 0.97] : [(x0 + x1) / 2];
                    for (const sx of seats) {
                        LC(0xf7f5ef, 0.115, 0.115, 0.018, sx, 0.79, ZW + 0.78);
                        LC(0xf7f5ef, 0.115, 0.115, 0.018, sx, 0.79, ZW + 1.02);
                        LC(0xcfdce0, 0.032, 0.026, 0.13, sx + 0.17, 0.85, ZW + 0.80);
                        LC(0xcfdce0, 0.032, 0.026, 0.13, sx + 0.17, 0.85, ZW + 1.04);
                        // a chair on the aisle side, and the menu on the cloth
                        LF(0x6f5334, sx - 0.21, 0.14, ZW + 1.24, sx + 0.21, 0.44, ZW + 1.62);
                        LF(0x6f5334, sx - 0.19, 0.44, ZW + 1.58, sx + 0.19, 0.92, ZW + 1.64);
                        for (const c of [-0.18, 0.18]) {
                            LF(0x5b432a, sx + c - 0.02, 0.14, ZW + 1.26, sx + c + 0.02, 0.44, ZW + 1.30);
                        }
                        LF(0xe4d8bc, sx - 0.07, 0.78, ZW + 0.88, sx + 0.07, 0.98, ZW + 0.91);
                    }
                    LS((x0 + x1) / 2, 2.68, ZW + 0.88, 0.17, 0.22);
                    LF(0x2a2724, (x0 + x1) / 2 - 0.012, 2.86, ZW + 0.868,
                                 (x0 + x1) / 2 + 0.012, Y_CEIL - 0.12, ZW + 0.892);
                }
                // the pass, its stools, and the kitchen behind it
                const bz = Math.min(ZL + 1.30, HW - 0.75);
                LF(TIM, 5.14, 0.14, ZW, 5.84, 1.02, bz);
                LF(0x2f2b26, 5.06, 1.02, ZW, 5.92, 1.10, bz + 0.06);
                LL('warm', 5.10, 0.24, ZW, 5.14, 0.42, bz);
                LF(0xb08a4e, 5.02, 0.52, ZW, 5.06, 0.58, bz);
                for (const sz2 of [ZW + 0.55, ZW + 1.45]) {
                    LC(0x6f5334, 0.18, 0.16, 0.07, 4.80, 0.70, sz2);
                    LC(0x3a3835, 0.032, 0.048, 0.52, 4.80, 0.40, sz2);
                    LC(0x3a3835, 0.20, 0.21, 0.04, 4.80, 0.16, sz2);
                }
                LF(STEEL, 5.88, 1.30, ZW, 6.00, 1.40, bz);            // the pass shelf
                LF(STEEL, 6.02, 0.14, ZW, 6.26, 0.95, bz);            // the bench behind it
                LF(0x9aa0a2, 6.00, 1.96, ZW + 0.20, 6.28, 2.46, ZW + 1.70);
                for (let i = 0; i < 2; i++) {
                    LF(STEEL, 6.04, 2.02 + i * 0.42, bz - 1.55, 6.26, 2.08 + i * 0.42, bz);
                    for (let j = 0; j < 3; j++) {
                        LF(pick([0x8f9396, 0xd8d2c4, 0x6a5a2a]),
                           6.08, 2.08 + i * 0.42, bz - 1.42 + j * 0.42,
                           6.22, 2.30 + i * 0.42, bz - 1.14 + j * 0.42);
                    }
                }
                LL('cool', 6.27, 1.46, ZW + 0.15, 6.29, 2.12, bz - 0.15);
                // the menu on the wall over the pass
                LF(0x232a24, 5.16, 1.86, ZW, 5.82, 2.86, ZW + 0.05);
                for (let i = 0; i < 5; i++) {
                    LL('warm', 5.24, 2.62 - i * 0.17, ZW, 5.24 + (i % 2 ? 0.34 : 0.50), 2.70 - i * 0.17, ZW + 0.02);
                }
                // and a menu on a stand where you come in
                LF(0x4a3a2a, 0.46, 0.14, ZL - 0.44, 0.62, 1.16, ZL - 0.30);
                LL('warm', 0.42, 0.72, ZL - 0.44, 0.46, 1.12, ZL - 0.30);
            }
        };
        /* Where a unit's entrance falls, in the street's own numbers, so that
           the base a bay sits on can stop either side of it. Run straight
           through, that base is a knee-high step across the doorway — and a
           knee-high step is the walk climbing into a shop instead of walking
           into one. The three constants are `shopUnit`'s own, said once more
           here rather than passed back out of it. */
        const shopDoor = (t0, t1) => {
            const span = Math.abs(t1 - t0), cz = (t0 + t1) / 2;
            const HW = span / 2 - 0.30, DW = 1.65, DZ = HW - 0.35 - DW;
            return [cz - DZ - DW, cz - DZ + DW];
        };

        /* ---- the verandah, and everything a shop hangs off it ----

           Melbourne's footpath is roofed, and not by an awning per tenancy.
           It is one continuous cantilevered structure running the whole
           block: a deep fascia beam along its edge with the shop's name on
           the face of it, a lined soffit with a regular row of downlights
           punched down the middle, the flashing where it is bolted back to
           the wall, and the ties that hold three and a bit metres of it out
           over the paving with nothing standing on the footpath. The signs
           change from tenancy to tenancy. The verandah does not.

           What was here instead was a slab: a hundred and seventy millimetres
           of flat dark box two and a quarter metres deep, per tenancy, with a
           red edge. From underneath — which is where the person is — it read
           as a black lid, because a downward face in a world lit entirely
           from above has nothing at all falling on it.

           Written once, in a frame of its own — `d` out from the building
           line over the footpath, `u` along the frontage, y up — and carried
           onto whichever street by two lambdas rather than by four copies.
           Swanston runs north and south with its frontages facing east and
           west; the cross streets run east and west with theirs facing north
           and south; and the last set of signs built twice, once per axis,
           came out mirrored on one of them. */
        const FR = (axis, face, o) => ({
            axis, o,
            // where a point (d out over the footpath, u along the frontage) is
            wx: axis === 'z' ? (d, u) => face + o * d : (d, u) => u,
            wz: axis === 'z' ? (d, u) => u : (d, u) => face + o * d,
            // the turn that faces a plane out over the footpath — for a board
            // on a fascia and a case on a wall
            out: axis === 'z' ? (o > 0 ? Math.PI / 2 : -Math.PI / 2) : (o > 0 ? 0 : Math.PI),
            /* and the turn that faces one along the frontage, in the +u
               direction, which is the whole reason this pass exists: a sign
               flat on the wall is a sign nobody walking toward it can read,
               and the hanging boxes and the blades all face this way. It does
               not depend on which side of the street the frontage is, only on
               which way the street runs — the other reading of it put every
               blade on the east side of Swanston back to front. */
            along: axis === 'z' ? 0 : Math.PI / 2,
        });
        // a box in that frame, between two opposite corners
        const FBX = (fr, d0, y0, u0, d1, y1, u1) => {
            const x0 = fr.wx(d0, u0), z0 = fr.wz(d0, u0);
            const x1 = fr.wx(d1, u1), z1 = fr.wz(d1, u1);
            return put(boxG(Math.abs(x1 - x0), Math.abs(y1 - y0), Math.abs(z1 - z0)),
                       (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
        };
        // a lit plate in it, sized off its own artwork rather than off the
        // hole it is going into — see `AR` in 21b
        const FPL = (fr, k, h, d, y, u, yaw) => {
            const g = new THREE.PlaneGeometry(AR(k) * h, h);
            put(g, fr.wx(d, u), y, fr.wz(d, u), 0, yaw, 0);
            P.awnLit.push(awn(g, k));
            return g;
        };
        // the same, round — a disc's uv already fills its own square, which is
        // why every round key on the sheet is drawn in one
        const FDS = (fr, k, r, d, y, u, yaw) => {
            const g = new THREE.CircleGeometry(r, 20);
            put(g, fr.wx(d, u), y, fr.wz(d, u), 0, yaw, 0);
            P.awnLit.push(awn(g, k));
            return g;
        };

        const VER = { deep: 3.20, soff: 3.52, lin: 3.62, deck: 3.94, flash: 4.30 };
        const verandah = (arr, fr, t0, t1, o) => {
            const opt = o || {};
            const D = opt.deep || VER.deep;
            const lo = Math.min(t0, t1), hi = Math.max(t0, t1);
            const beam = opt.beam === undefined ? 0x2f2e2b : opt.beam;

            // the fascia beam. Deep on purpose: it is what carries the board,
            // and from a hundred metres up the street the line of it is the
            // only thing that says this is a Melbourne block and not a mall
            FG(arr, beam, FBX(fr, D - 0.22, 3.16, lo, D + 0.02, 3.98, hi));
            // the deck over the lining, and the flashing back into the wall
            FG(arr, opt.deck || 0x3b3a36, FBX(fr, -0.02, VER.lin, lo, D - 0.20, VER.deck, hi));
            FG(arr, beam, FBX(fr, -0.04, VER.deck, lo, 0.30, VER.flash, hi));

            if (opt.plain) return;               // a backdrop gets the shape and no more

            // the lining, in its own material for its own reason — see 21b
            P.awnSoff.push(FBX(fr, 0.02, VER.soff, lo, D - 0.20, VER.lin, hi));

            /* the ties. Nothing stands on the footpath — a Melbourne verandah
               has not been propped since about 1920 — so all of this hangs off
               a rod every three and a half metres, and those rods are most of
               what says the thing is structure rather than a shelf. Built by
               angle rather than by two endpoints, because the frame's two
               lambdas carry points and cannot carry a rotation: the lean is a
               turn about z on a street that runs north, and about x on one
               that runs east. */
            const dH = 0.20, yH = 5.00, dL = D - 0.26, yL = VER.deck;
            const ang = Math.atan2(dL - dH, yH - yL), len = Math.hypot(dL - dH, yH - yL);
            const nt = Math.max(2, Math.round((hi - lo) / 3.6));
            for (let i = 0; i <= nt; i++) {
                const u = lo + (hi - lo) * (i / nt);
                const g = cylG(0.05, 0.05, len, 6);
                put(g, fr.wx((dH + dL) / 2, u), (yH + yL) / 2, fr.wz((dH + dL) / 2, u),
                    fr.axis === 'z' ? 0 : -fr.o * ang, 0, fr.axis === 'z' ? fr.o * ang : 0);
                FG(arr, beam, g);
            }

            /* and the downlights, in the one regular row every verandah in
               this city has and this world had none of. Emissive plates rather
               than lights: there are four real ones in this world, all of them
               spent, and there is no fifth coming. */
            for (let u = lo + 1.05; u < hi - 0.5; u += 1.62) {
                const g = new THREE.PlaneGeometry(0.30, 0.30);
                put(g, fr.wx(D * 0.46, u), VER.soff - 0.008, fr.wz(D * 0.46, u), Math.PI / 2, 0, 0);
                P.awnLit.push(awn(g, 'dl'));
            }
        };

        /* What one tenancy signs itself with.

           Not a kit every shop gets. A handful of coin tosses, so that the
           shop next door has done it differently, two in a row are never the
           same height, and some of them have barely bothered — which is the
           whole of what was missing. A street where every sign is the same
           size is the thing this pass is for, and replacing one uniform system
           with a second uniform system would be no fix at all.

           Its own seeded stream and not the world's, deliberately. The world's
           `rnd` is what decides how wide the buildings on Collins Street are
           and how many floors they have; drawing four hundred signs out of it
           would move every building on four streets, and a signwriter should
           not be able to move a building. */
        let _sgs = 20250831;
        const srn = () => { _sgs = (_sgs * 1664525 + 1013904223) % 4294967296; return _sgs / 4294967296; };
        const srr = (a, b) => a + (b - a) * srn();
        const spick = (a) => a[Math.floor(srn() * a.length)];
        const FASCIA = { restaurant: ['fNel', 'fSus'], clothes: ['fVic', 'fDen'],
                         jewel: ['fGld', 'fPrl'] };
        const HANGER = { restaurant: ['hgA', 'hgB', 'hgD', 'hgC'],
                         clothes: ['hgF', 'hgE', 'hgG'],
                         jewel: ['hgE', 'hgC', 'hgG'] };

        /* `dc` is where this tenancy's door falls, in u — the cases go on the
           other side of the shopfront from it, because a lightbox across a
           doorway is a lightbox in the way. Answers whether it put a board on
           the fascia, so that the caller can leave the plate off the wall band
           above and no shop ends up wearing two different names. */
        const shopSigns = (arr, fr, t0, t1, kind, dc, o) => {
            const opt = o || {};
            const lo = Math.min(t0, t1), hi = Math.max(t0, t1), span = hi - lo;
            const mid = (lo + hi) / 2, D = opt.deep || VER.deep;
            /* Where the underside is, because not every roof over this
               footpath is the standard verandah — the stainless canopy round
               the cream tower's corner is at four ninety, and a lightbox hung
               off the height a verandah would have been floats under it. */
            const SF = opt.soff || VER.soff;
            const K = FASCIA[kind] ? kind : 'clothes';
            let board = false;

            // 1 · the board on the face of the fascia, which is the sign the
            //     whole street is read by from up at the crossing
            if (opt.board !== false && srn() < 0.62) {
                const k = spick(FASCIA[K]);
                let h = srr(0.50, 0.70);
                if (AR(k) * h > span - 0.5) h = (span - 0.5) / AR(k);
                if (h > 0.26) { FPL(fr, k, h, D + 0.05, SF + 0.05, mid, fr.out); board = true; }
            }

            // 2 · the lightbox slung under the soffit, square-on to somebody
            //     walking toward it. Two faces back to back on one case: the
            //     footpath has people coming both ways down it
            if (srn() < 0.72) {
                const k = spick(HANGER[K]);
                const h = srr(0.44, 0.62), w = AR(k) * h;
                const cd = Math.min(D - 0.50, Math.max(w / 2 + 0.30, srr(1.15, 1.95)));
                const top = SF - srr(0.34, 0.50), bot = top - h - 0.10;
                const u = mid + srr(-0.20, 0.20) * span;
                FG(arr, 0x24231f, FBX(fr, cd - w / 2 - 0.05, bot, u - 0.055,
                                          cd + w / 2 + 0.05, top, u + 0.055));
                for (const s of [-1, 1]) {
                    FG(arr, 0x3a382f, FBX(fr, cd + s * w * 0.32 - 0.025, top, u - 0.025,
                                              cd + s * w * 0.32 + 0.025, SF, u + 0.025));
                }
                for (const s of [-1, 1]) {
                    FPL(fr, k, h, cd, top - (h + 0.10) / 2, u + s * 0.058,
                        fr.along + (s > 0 ? 0 : Math.PI));
                }
            }

            /* 3 · the blades, bracketed out at right angles. Some go above the
                   verandah, stacked two high on one post the way they are on
                   the corner of the real building, where they carry a hundred
                   metres; the rest go under it at a height that clears a head,
                   where they carry ten. Both, because the person is sometimes
                   under the verandah and sometimes out at the kerb. */
            const bl = srn();
            if (bl < 0.20 && opt.hi !== false) {
                const r = srr(0.32, 0.42), u = lo + srr(0.10, 0.26) * span;
                const cd = r + 0.44, y0 = SF + 1.38;
                FG(arr, 0x2a2926, FBX(fr, 0.02, y0 - 0.54, u - 0.055, cd + 0.06, y0 - 0.42, u + 0.055));
                FG(arr, 0x2a2926, FBX(fr, cd - 0.055, y0 - 0.46, u - 0.055, cd + 0.055,
                                          y0 + r * 3 + 0.30, u + 0.055));
                const ks = [spick(['rbA', 'rbC', 'rbD']), spick(['rbB', 'rbD', 'rbA'])];
                for (let i = 0; i < 2; i++) {
                    const y = y0 + i * (r * 2 + 0.18);
                    for (const s of [-1, 1]) {
                        FDS(fr, ks[i], r, cd, y, u + s * 0.045,
                            fr.along + (s > 0 ? 0 : Math.PI));
                    }
                }
            } else if (bl < 0.48) {
                const u = lo + srr(0.12, 0.32) * span;
                if (srn() < 0.5) {
                    const k = spick(['rbA', 'rbB', 'rbC', 'rbD']), r = srr(0.30, 0.38);
                    const cd = r + 0.40, y = SF - srr(0.46, 0.56);
                    FG(arr, 0x2a2926, FBX(fr, 0.02, y - 0.05, u - 0.05, cd, y + 0.05, u + 0.05));
                    for (const s of [-1, 1]) {
                        FDS(fr, k, r, cd, y, u + s * 0.045, fr.along + (s > 0 ? 0 : Math.PI));
                    }
                } else {
                    const k = spick(['xbA', 'xbB', 'xbC']);
                    const h = srr(0.28, 0.38), w = AR(k) * h, cd = w / 2 + 0.26;
                    const y = SF - srr(0.48, 0.60);
                    FG(arr, 0x2a2926, FBX(fr, 0.02, y - h / 2 - 0.05, u - 0.05,
                                              cd + w / 2, y + h / 2 + 0.05, u + 0.05));
                    for (const s of [-1, 1]) {
                        FPL(fr, k, h, cd, y, u + s * 0.055, fr.along + (s > 0 ? 0 : Math.PI));
                    }
                }
            }

            /* 4 · the menu case flat on the wall beside the door — the only
                   sign on the street read from an arm's length, and once the
                   sun is off the road the brightest thing at eye level. It
                   starts at one metre seventy-five rather than at the waist,
                   which is not how a menu case is hung: under one metre four
                   the walk merges it into the paving and a case beside a door
                   becomes a wall across the footpath. */
            if (srn() < 0.52 && span > 4.6) {
                const k = spick(['mnA', 'mnB', 'mnC', 'mnD']);
                const h = srr(1.10, 1.55), w = AR(k) * h;
                const u = dc > mid ? lo + w / 2 + 0.40 : hi - w / 2 - 0.40;
                const y = 1.80 + h / 2;
                FG(arr, 0x1e1d1a, FBX(fr, 0.02, y - h / 2 - 0.06, u - w / 2 - 0.06,
                                          0.15, y + h / 2 + 0.06, u + w / 2 + 0.06));
                FPL(fr, k, h, 0.165, y, u, fr.out);
            }

            // 5 · and the number, which is the smallest sign on the street and
            //     the only one anybody has ever actually needed
            if (srn() < 0.36) {
                const h = srr(0.24, 0.32);
                const u = srn() < 0.5 ? lo + 0.34 : hi - 0.34;
                FPL(fr, spick(['nbA', 'nbB', 'nbC', 'nbD']), h, 0.15,
                    SF - srr(0.24, 0.46), u, fr.out);
            }
            return board;
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

            /* The core stops at the shopfront head and starts again seven and
               a half metres back, because the shops below are rooms you walk
               into. Drawn solid to the pavement — as it was — the rooms are
               inside the stone and the walk finds one block from the footpath
               to the parapet, which is a window display, not a shop. */
            F(A, C.lo, X0, Y_SHOP, ZS, XC, Y_TOP, ZC);
            /* And the same seven and a half metres of it taken out behind the
               Little Collins frontage, which the first version forgot: the
               core ran up to that glass line unbroken, so the two rooms on
               that face were built inside solid stone. A shop the walk finds
               filled is not a shop. What is left of the core down there is the
               strip west of the last tenancy and the party wall between the
               two of them. */
            F(A, C.lo, X0, 0, ZS, XC - 7.5, Y_SHOP, ZC + 7.5);
            F(A, C.lo, X0, 0, ZC + 7.5, -39.4, Y_SHOP, ZC);
            F(A, C.lo, -32.1, 0, ZC + 7.5, -31.7, Y_SHOP, ZC);

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
            /* The signage under the canopy. This corner keeps its stainless
               sweep — that curve is the one thing about the building anybody
               remembers — so it gets no verandah of its own, only the things
               that hang under one: the soffit here is at four ninety rather
               than at three fifty, so `soff` is passed and every drop, blade
               and board hangs off that instead. No board on the fascia and no
               blade above it, because both of those belong to a painted
               timber fascia and this one is a rolled stainless edge. */
            const FRZ = FR('z', XF, 1), FRX = FR('x', ZF, -1);
            for (let i = 0; i < 2; i++) {
                const z0 = ZF + R + 0.5 + i * 7.4, z1 = z0 + 6.8;
                F(A, C.deep, XF + 0.02, 0, z0 - 0.25, XC, Y_SHOP, z0);
                // the trade rotates so no two neighbours are the same room
                const T = [['bergen', 'jewel'], ['dior', 'clothes']][i % 2];
                P.shopLit.push(shp(put(boxG(0.06, 0.52, z1 - z0 - 0.3), XF + 0.10, 4.24, (z0 + z1) / 2), T[0]));
                const dz = shopDoor(z0, z1);
                shopSigns(A, FRZ, z0, z1, T[1], (dz[0] + dz[1]) / 2,
                          { soff: Y_SHOP - 0.26, deep: 1.70, board: false, hi: false });
                shopUnit(XC, z0, z1, 'z', T[1], T[0]);
            }
            for (let i = 0; i < 2; i++) {
                const x0 = XF - R - 0.5 - i * 7.6, x1 = x0 - 7.0;
                F(A, C.deep, x0 + 0.25, 0, ZF + 0.02, x0, Y_SHOP, ZC);
                // the coffee chain on this corner is the one tenancy up here I
                // am sure of; the rest are invented at the right size
                const T = [['pho', 'restaurant'], ['wool', 'clothes'], ['sbux', 'restaurant']][i % 3];
                P.shopLit.push(shp(put(boxG(Math.abs(x1 - x0) - 0.3, 0.52, 0.06),
                                   (x0 + x1) / 2, 4.24, ZF + 0.10), T[0]));
                shopSigns(A, FRX, x0, x1, T[1], (x0 + x1) / 2 + 2.0,
                          { soff: Y_SHOP - 0.26, deep: 1.70, board: false, hi: false });
                shopUnit(ZC, x0, x1, 'x', T[1], T[0]);
            }
            /* the canopy: straight along both streets, and eight facets round.
               The Little Collins leg was set out with the sign of its depth
               taken off the Swanston leg's, and the two frontages face at
               right angles: it was drawn a metre and a quarter *into* the
               stone core, so the whole of that side of the corner had a
               shopfront with nothing over it while the quadrant swept out
               correctly beside it. Subtracted here, which is the way that
               facade's own normal points. */
            F(A, 0xb9bec0, XF + 1.65, Y_SHOP, ZF + R, XC, Y_SHOP + 0.34, ZS);
            F(A, 0xb9bec0, XF - R, Y_SHOP, ZF - 1.65, X0, Y_SHOP + 0.34, ZC);
            F(A, 0x8e9397, XF + 1.70, Y_SHOP - 0.26, ZF + R, XF + 1.58, Y_SHOP + 0.34, ZS);
            F(A, 0x8e9397, XF - R, Y_SHOP - 0.26, ZF - 1.70, X0, Y_SHOP + 0.34, ZF - 1.58);
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
            /* what a verandah fascia gets painted, which on this street is
               whatever the tenant painted it last time and never the same as
               next door's */
            const VBEAM = [0x2f2e2b, 0x1d2a24, 0x3a2420, 0x24303c, 0x2b2b2f, 0x4a3a24];
            const shopRun = (z0, z1, n, faces) => {
                /* One verandah for the whole frontage rather than one per
                   tenancy. The real thing breaks where the buildings meet, not
                   where the leases do, and a run of eight separate slabs with
                   eight separate edges is most of why the old one read as
                   scenery rather than as structure. */
                const fr = FR('z', XF, 1);
                verandah(A, fr, z0 + 0.4, z1 - 0.4, { beam: spick(VBEAM) });
                for (let i = 0; i < n; i++) {
                    const a = z0 - (z0 - z1) * (i / n) - 0.35, b = z0 - (z0 - z1) * ((i + 1) / n) + 0.35;
                    const [d0, d1] = shopDoor(a, b);
                    F(A, 0x232326, XF + 0.02, 0, Math.max(a, b), XC, 0.40, d1);
                    F(A, 0x232326, XF + 0.02, 0, d0, XC, 0.40, Math.min(a, b));
                    F(A, 0x232326, XF + 0.02, 0, d0, XC, 0.14, d1);
                    F(A, 0x2c2a26, XF + 0.04, 0, a + 0.35, XC, 4.10, a + 0.50);
                    const T = faces[i % faces.length];
                    /* and the plate on the wall band above the verandah, but
                       only where the fascia has not already taken the name.
                       It is up at 4.66 rather than 4.42 now because the
                       flashing comes to 4.30, and it is a sign for the far
                       footpath rather than for this one — from under the
                       verandah you cannot see it at all, which is the whole
                       reason the other four kinds exist. */
                    const board = shopSigns(A, fr, a, b, T[1], (d0 + d1) / 2);
                    if (!board) {
                        P.shopLit.push(shp(put(boxG(0.06, 0.55, Math.abs(b - a) - 0.4),
                                           XF + 0.10, 4.66, (a + b) / 2), T[0]));
                    }
                    shopUnit(XC, a, b, 'z', T[1], T[0]);
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
                shopRun(ZS, ZN, 2, [['sbux', 'restaurant'], ['facet', 'jewel']]);
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
                shopRun(ZS, ZN, 3, [['linen', 'clothes'], ['cup', 'restaurant'], ['boss', 'clothes']]);
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
                shopRun(ZS, ZN, 3, [['kozmin', 'jewel'], ['noodle', 'restaurant'], ['atelier', 'clothes']]);
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
                        F(A, 0x8b8f93, B.x1, 5.20, B.z0, XC, B.top, B.z1);
                        F(A, 0x8b8f93, B.x1, 0, B.z0, XC - 7.5, 5.20, B.z1);
                        for (let f = 0; f < 10; f++) {
                            const y = 5.4 + f * 3.15;
                            W(A, XC, y, B.z0 - 0.4, XC + 0.07, y + 2.35, B.z1 + 0.4, 0x1a2026, 0x4e6672);
                            F(A, 0x9aa0a4, XF, y + 2.35, B.z0 - 0.4, XC, y + 3.15, B.z1 + 0.4);
                        }
                        /* Added, not subtracted. In this table `z0` is the
                           north end and `z1` the south, so setting out from
                           `z0` runs southward and `z0 − span` walks straight
                           out of the building into its neighbour: these fins
                           were being drawn up the face of the tower next door,
                           which is why this block read as a blank box above
                           its own shops. */
                        for (let i = 0; i <= 12; i++) {
                            const z = B.z0 + span * (i / 12);
                            F(A, 0xb2b6b8, XF - 0.34, 5.0, z - 0.10, XC, B.top, z + 0.10);
                        }
                        F(A, 0x9aa0a4, XF - 0.30, B.top, B.z0, XC, B.top + 1.2, B.z1);

                    } else if (B.kind === 'bronze') {
                        F(A, 0x9e8866, B.x1, 5.20, B.z0, XC, B.top, B.z1);
                        F(A, 0x9e8866, B.x1, 0, B.z0, XC - 7.5, 5.20, B.z1);
                        for (let f = 0; f < 8; f++) {
                            const y = 5.4 + f * 2.95;
                            W(A, XC, y + 0.72, B.z0 - 0.5, XC + 0.07, y + 2.60, B.z1 + 0.5, 0x241d16, 0x6e6152);
                            F(A, 0xb39b76, XF - 0.16, y, B.z0 - 0.5, XC, y + 0.72, B.z1 + 0.5);
                            F(A, 0xc6ae88, XF - 0.24, y + 0.46, B.z0 - 0.7, XC, y + 0.72, B.z1 + 0.7);
                        }
                        F(A, 0xb39b76, XF - 0.34, B.top, B.z0, XC, B.top + 1.0, B.z1);
                        // lifted clear of the verandah flashing, which now
                        // comes to 4.30 — at four fifty-five the two were in
                        // each other
                        P.shopLit.push(shp(put(boxG(0.06, 0.90, 5.0), XF + 0.12, 4.80,
                                           (B.z0 + B.z1) / 2), 'maccas'));

                    } else if (B.kind === 'render') {
                        F(A, 0xc6bda8, B.x1, 5.20, B.z0, XC, B.top, B.z1);
                        F(A, 0xc6bda8, B.x1, 0, B.z0, XC - 7.5, 5.20, B.z1);
                        for (let f = 0; f < 6; f++) {
                            const y = 5.4 + f * 3.20;
                            for (let i = 0; i < 4; i++) {
                                const zc = B.z0 + span * ((i + 0.5) / 4);   // southward, as above
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
                        F(A, 0x3c3a34, XF + 0.46, 7.0, B.z1 - 1.5, XF + 0.10, 20.5, B.z1 - 2.6);
                        P.shopLit.push(shp(put(boxG(0.06, 13.0, 1.05), XF + 0.52, 13.7,
                                           B.z1 - 2.05), 'stpaul'));

                    } else {
                        /* The bank's order is set out from `z0` toward `z1`,
                           which is northward — subtracted, as the rest of this
                           block still is, its columns walked south out of the
                           building and stood in the middle of the rendered
                           block's shopfronts, one of them square in a doorway.
                           Only this bay is corrected here, because only this
                           bay's stonework lands on a shop. */
                        F(A, 0xcfc4a8, B.x1, 5.20, B.z0, XC, B.top, B.z1);
                        F(A, 0xcfc4a8, B.x1, 0, B.z0, XC - 7.5, 5.20, B.z1);
                        F(A, 0x8d8272, XF - 0.10, 0, B.z0, XC, 1.10, B.z1);
                        for (let i = 0; i <= 4; i++) {                    // a giant order
                            const z = B.z0 + span * (i / 4);
                            F(A, 0xe0d6ba, XF - 0.62, 1.10, z + 0.55, XC, B.top - 2.4, z - 0.55);
                            F(A, 0xefe6cc, XF - 0.80, B.top - 2.4, z + 0.72, XC, B.top - 1.8, z - 0.72);
                        }
                        for (let f = 0; f < 3; f++) {
                            const y = 2.2 + f * 4.6;
                            for (let i = 0; i < 4; i++) {
                                const zc = B.z0 + span * ((i + 0.5) / 4);
                                W(A, XC, y, zc + 1.05, XC + 0.07, y + 3.30, zc - 1.05);
                                F(A, 0xb7ab90, XF - 0.20, y - 0.22, zc + 1.28, XC, y, zc - 1.28);
                            }
                        }
                        F(A, 0xe0d6ba, XF - 0.46, B.top - 1.8, B.z0, XC, B.top - 1.2, B.z1);
                        for (let i = 0; i < 16; i++) {
                            const z = B.z0 + 0.3 + i * ((span - 0.6) / 15);
                            F(A, 0xefe6cc, XF - 0.96, B.top - 1.2, z + 0.13, XF - 0.10, B.top - 0.5, z - 0.13);
                        }
                        F(A, 0xefe6cc, XF - 1.14, B.top - 0.5, B.z0 - 0.2, XC, B.top, B.z1 + 0.2);
                        F(A, 0xcfc4a8, XF - 0.30, B.top, B.z0, XF + 0.22, B.top + 1.9, B.z1);
                    }

                    /* the shops under every one of them, because this side of
                       the street is shops the whole way and always has been —
                       except the bank, whose ground floor is a banking chamber
                       standing on a metre of rusticated stone with a giant
                       order coming down into it. There is no room for a
                       shopfront in that and there never was one: a shop the
                       walk cannot get into is worse than no shop, so this bay
                       keeps its stone and skips the fitout. */
                    if (B.kind === 'bank') continue;
                    /* Northward, which is the direction this list of bays
                       runs: subtracted rather than added, the whole run of
                       shopfronts landed one bay south of the building it
                       belongs to, and the first block's shops were standing
                       inside the tower on the Collins corner. */
                    const n = Math.max(1, Math.round(span / 9.0));
                    const step = (B.z1 - B.z0) / n;
                    // one verandah for the whole bay, and each of the three
                    // buildings paints its fascia its own colour — which is
                    // what a Melbourne block looks like from the far kerb
                    const fr = FR('z', XF, 1);
                    verandah(A, fr, B.z0 + 0.2, B.z1 - 0.2,
                             { beam: B.kind === 'bronze' ? 0x4a3a24
                                   : B.kind === 'fin' ? 0x24303c : 0x3a2420 });
                    for (let i = 0; i < n; i++) {
                        const a = B.z0 + step * i + 0.35, b = B.z0 + step * (i + 1) - 0.35;
                        const [d0, d1] = shopDoor(a, b);
                        F(A, 0x232326, XF + 0.02, 0, Math.max(a, b), XC, 0.40, d1);
                        F(A, 0x232326, XF + 0.02, 0, d0, XC, 0.40, Math.min(a, b));
                        F(A, 0x232326, XF + 0.02, 0, d0, XC, 0.14, d1);
                        F(A, 0x2c2a26, XF + 0.04, 0, a - 0.35, XC, 4.10, a - 0.50);
                        /* The burger shop is on this block and goes where the
                           photograph puts it; the others are invented at the
                           right size for the bay. */
                        const T = B.kind === 'bronze' ? [['maccas', 'restaurant'], ['wool', 'clothes']][i % 2]
                                : B.kind === 'fin'    ? [['bar', 'restaurant'], ['bergen', 'jewel']][i % 2]
                                :                       [['coco', 'restaurant'], ['facet', 'jewel']][i % 2];
                        const board = shopSigns(A, fr, a, b, T[1], (d0 + d1) / 2);
                        if (!board) {
                            P.shopLit.push(shp(put(boxG(0.06, 0.55, Math.abs(b - a) - 0.4),
                                               XF + 0.10, 4.66, (a + b) / 2), T[0]));
                        }
                        shopUnit(XC, a, b, 'z', T[1], T[0]);
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
           23c · the verandah over the three blocks south of Flinders Lane

           The west side of Swanston between Flinders Street and Flinders Lane
           is not built as itself: it is three boxes off the street sheet in
           section 11, with a whole facade — windows, shopfront, lit ground
           floor and all — drawn onto each of them. That is the right answer
           for a backdrop and the wrong one for sixty metres of footpath
           somebody walks up from the station, because a painted shopfront
           cannot have anything hanging in front of it.

           So the verandah and its signage are built here, in real geometry,
           against the same building line those boxes stand on. Their own flat
           awning has been taken out of section 11 rather than left underneath
           this one; the note there says where it went.

           No fascia boards, because these blocks have no tenancies — the shop
           divisions are painted on and a board would land halfway across one.
           What they get is the roof, the light under it, and the signs that
           hang from it, which between them are the whole of what the walk up
           from Flinders Street is missing.
           ------------------------------------------------------------ */
        {
            const A = P.shop;
            // cx and w of the three section 11 blocks that front Swanston,
            // said again here because that table is local to its own section
            for (const [fx, z0, z1] of [[-18.6, -64.0, -42.0],
                                        [-18.5, -85.0, -66.0],
                                        [-18.5, -102.8, -85.0]]) {
                const fr = FR('z', fx, 1);
                /* Two ninety rather than the three twenty the rest of the
                   street gets, and the one place on it where the depth is not
                   a preference. The plane trees down this block stand at
                   x = −14.9 give or take half a metre, and a trunk pruned to
                   four hundred millimetres puts bark as far in as −15.8: at
                   full depth the verandah grows through six of them. The slab
                   that was here reached −15.5 and did exactly that. */
                verandah(A, fr, z0 + 0.3, z1 - 0.3,
                         { deep: 2.90, beam: spick([0x2f2e2b, 0x3a2420, 0x24303c]) });
                const n = Math.max(2, Math.round((z1 - z0) / 8.5));
                for (let i = 0; i < n; i++) {
                    const a = z0 + (z1 - z0) * (i / n) + 0.3;
                    const b = z0 + (z1 - z0) * ((i + 1) / n) - 0.3;
                    shopSigns(A, fr, a, b, ['restaurant', 'clothes', 'jewel'][i % 3],
                              (a + b) / 2 - 1.6, { board: false, deep: 2.90 });
                }
            }
        }

        /* ------------------------------------------------------------
           26 · the cross streets

           Collins, Little Collins and Flinders Lane run east and west out of
           Swanston, and until now they ran out of buildings about ninety
           metres from the corner: two kerbs, a pair of rails, and then bare
           ground all the way to the fog. Standing at the Town Hall and
           looking east down Collins you could see the edge of the world.

           Everything in this section is invention and is meant to be. The
           accuracy budget went on the four blocks around the intersection,
           where the photographs are; what these streets need is not another
           surveyed facade but somewhere for the eye to stop. So: a generator,
           seeded off the same `rnd` as the rest of the file, laying a run of
           buildings along every clear stretch of frontage. Five archetypes,
           because five is about how many kinds of thing actually stand on a
           Melbourne cross street — a boom-era brick terrace, an Edwardian
           stuccoed chambers, a sixties slab, a brick warehouse, and a piece
           of dark modern infill where one of the others burnt down. Widths,
           heights, depths, bay rhythms and openings all come off `rnd`, so
           the four streets are different from each other and the same every
           time the world loads.

           Two decisions worth writing down.

           The first is that heights fall off with distance from Swanston.
           Not for the look of it — for the walk. A street that keeps its
           full height to the horizon reads as a canyon and gives the eye
           nothing to aim at; a street that steps down says the city ends
           somewhere, which is true.

           The second is granularity. Every building inside about ninety
           metres of Swanston is its own array, its own mesh and its own
           part, which is the expensive choice and the right one: a building
           you cannot pick up and move is not a building, it is wallpaper,
           and the near field is where somebody in edit mode is standing.
           Past that, a whole run merges into one backdrop object, because at
           a hundred and twenty metres nobody is moving anything — they are
           looking down a street. The shops underneath go into the shared
           `P.shop` arrays and cost no draw at all.
           ------------------------------------------------------------ */
        {
            const NEAR = 88.0;          // out to here a building is its own object

            /* The trades, and the signs that go with them. Every one of these
               names is invented — a jeweller called Facet, a noodle place —
               because these are streets I have no photograph of and a guess
               dressed up as an address is worse than an honest invention. */
            const TRADE = [
                ['wool', 'clothes'], ['linen', 'clothes'], ['dior', 'clothes'],
                ['boss', 'clothes'], ['coco', 'clothes'], ['atelier', 'clothes'],
                ['regent', 'clothes'],
                ['bergen', 'jewel'], ['facet', 'jewel'], ['kozmin', 'jewel'],
                ['cup', 'restaurant'], ['pho', 'restaurant'], ['bar', 'restaurant'],
                ['sbux', 'restaurant'], ['noodle', 'restaurant'],
            ];

            /* `emph` is the whole difference between a nineteenth-century
               facade and a nineteen-sixties one, and it is one letter: 'v'
               puts the piers in front of the spandrels and the wall reads
               vertical, 'h' does the reverse and it reads as stacked trays,
               'c' drops both and leaves a mullion grid on glass. */
            const ARCH = [
                { p: 0.24, fh: 3.95, nf: [3, 5],  bay: 3.00, wf: 0.46, mull: 2, emph: 'v',
                  sill: true,  arch: true,  body: [0x8f6a52, 0x9a6f50, 0x7d5c48], trim: 0xe4d9c0 },
                { p: 0.21, fh: 3.85, nf: [3, 6],  bay: 3.35, wf: 0.54, mull: 2, emph: 'v',
                  sill: true,  arch: false, body: [0xd6c9ac, 0xcabd9e, 0xdfd4b8], trim: 0xefe7d2 },
                { p: 0.20, fh: 3.15, nf: [5, 10], bay: 2.45, wf: 0.76, mull: 3, emph: 'h',
                  sill: false, arch: false, body: [0xcfcfc8, 0xc2c4be, 0xd6d3c8], trim: 0xb4b4ab },
                { p: 0.20, fh: 4.25, nf: [2, 4],  bay: 3.70, wf: 0.62, mull: 2, emph: 'v',
                  sill: false, arch: true,  body: [0x7a4f3c, 0x6d4636, 0x855744], trim: 0x9c8c74 },
                { p: 0.15, fh: 3.35, nf: [6, 12], bay: 2.25, wf: 0.88, mull: 1, emph: 'c',
                  sill: false, arch: false, body: [0x3a3f45, 0x33383e, 0x444a52], trim: 0x2a2e33 },
            ];
            const pickArch = () => {
                const r = rnd(); let a = 0;
                for (const t of ARCH) { a += t.p; if (r <= a) return t; }
                return ARCH[0];
            };

            /* Where the door lands in a tenancy. `shopDoor` above answers for
               a frontage that runs the other way: the local z that carries
               the door maps to −x on the south-facing streets and to +x on
               the north-facing ones, so the sign of the offset follows the
               facade's own normal or the plinth comes out unbroken on one
               side of every street and cut twice on the other. */
            const xDoor = (a, b, o) => {
                const c = (a + b) / 2 + o * (Math.abs(b - a) / 2 - 2.30);
                return [c - 1.65, c + 1.65];
            };

            const crossBuilding = (A, zf, o, x0, x1, detail) => {
                const w = x1 - x0;
                if (w < 9.0) return;
                const t = pickArch();
                const near = Math.min(Math.abs(x0), Math.abs(x1));
                const fall = 1 - smoothstep(40, 155, near) * 0.52;
                const nf = Math.max(2, Math.round(irr(t.nf[0], t.nf[1]) * fall));
                const HG = 5.10, fh = t.fh, H = HG + nf * fh;
                const zc = zf - o * 0.62;                 // the plane the openings sit in
                const zb = zf - o * rr(19, 29);           // the back
                const body = t.body[irr(0, t.body.length - 1)], trim = t.trim;

                F(A, body, x0, HG, zc, x1, H, zb);                    // the mass over the shops
                F(A, body, x0, 0, zf - o * 7.5, x1, HG, zb);          // and behind them
                F(A, body, x0, 0, zf, x0 + 0.42, HG, zf - o * 7.5);   // the party walls, which
                F(A, body, x1 - 0.42, 0, zf, x1, HG, zf - o * 7.5);   // are what a shop is between

                // ---- the facade above
                const nbay = Math.max(2, Math.round(w / t.bay));
                const bw = w / nbay, ow = bw * t.wf, gap = bw - ow;
                const pierZ = t.emph === 'h' ? zf - o * 0.34 : zf;
                const spanZ = t.emph === 'h' ? zf : zf - o * 0.30;
                for (let f = 0; f < nf; f++) {
                    const yb = HG + f * fh;
                    const y0 = yb + (t.emph === 'c' ? 0.24 : 0.82);
                    const y1 = yb + fh - (t.emph === 'c' ? 0.24 : 0.52);
                    for (let k = 0; k < nbay; k++) {
                        const cx = x0 + bw * (k + 0.5), oa = cx - ow / 2, ob = cx + ow / 2;
                        W(A, oa, y0, zc, ob, y1, zc + o * 0.06);
                        for (let m = 1; m < t.mull; m++) {
                            const mx = oa + ow * (m / t.mull);
                            F(A, CF.mullion, mx - 0.04, y0, zc, mx + 0.04, y1, zc + o * 0.13);
                        }
                        if (t.sill) F(A, trim, oa - 0.16, y0 - 0.18, zc, ob + 0.16, y0, zf + o * 0.10);
                        if (t.arch && f === nf - 1) {
                            F(A, trim, oa - 0.12, y1, zc, ob + 0.12, y1 + 0.24, zf + o * 0.05);
                            F(A, trim, oa + ow * 0.20, y1 + 0.24, zc, ob - ow * 0.20, y1 + 0.42, zf + o * 0.03);
                        }
                    }
                    F(A, t.emph === 'h' ? trim : body,
                       x0, Math.max(HG, yb - 0.28), zc, x1, yb + (t.emph === 'h' ? 0.88 : 0.52), spanZ);
                }
                for (let k = 0; k <= nbay; k++) {
                    const px = x0 + bw * k;
                    const pa = Math.max(x0, px - gap / 2), pb = Math.min(x1, px + gap / 2);
                    if (pb - pa < 0.12) continue;
                    F(A, t.emph === 'h' ? body : trim, pa, HG, zc, pb, H, pierZ);
                }

                // ---- the cornice, its brackets, and the parapet standing on it
                if (t.arch) for (let k = 0; k < nbay * 2; k++) {
                    const cx = x0 + w * ((k + 0.5) / (nbay * 2));
                    F(A, trim, cx - 0.13, H - 0.58, zf + o * 0.44, cx + 0.13, H, zf);
                }
                F(A, trim, x0 - 0.32, H, zf + o * 0.58, x1 + 0.32, H + 0.62, zc);
                F(A, body, x0 - 0.18, H + 0.62, zf + o * 0.28, x1 + 0.18, H + 0.62 + rr(0.9, 2.1), zf - o * 0.50);
                if (detail && rnd() < 0.7) {                  // a lift overrun on the roof
                    const px = x0 + rr(0.25, 0.75) * w, pw = rr(2.4, 4.6);
                    const pz = rr(3.0, 7.0), pd = rr(3.0, 6.0);
                    F(A, 0x8c887e, px - pw / 2, H, zc - o * pz, px + pw / 2, H + rr(1.6, 3.0), zc - o * (pz + pd));
                }

                // ---- the ground floor
                const zg = zc;
                if (!detail) {
                    /* A backdrop building gets a glazed base and a verandah
                       and nothing else. Nobody is walking down there, and a
                       fitout you cannot reach is geometry spent on nothing. */
                    F(A, 0x232326, x0, 0, zf + o * 0.02, x1, 0.45, zg);
                    W(A, x0 + 0.6, 0.60, zg, x1 - 0.6, 3.72, zg - o * 0.06);
                    // the verandah's shape and no more: no lining, no
                    // downlights, no ties. Nobody is walking under this one
                    verandah(A, FR('x', zf, o), x0, x1, { plain: true, deep: 2.60 });
                    F(A, body, x0, 3.72, zf, x1, HG, zc);
                    return;
                }
                F(A, body, x0, 3.90, zf, x1, HG, zc);        // the band the signs go on
                const fr = FR('x', zf, o);
                // and the verandah, once for the building rather than once per
                // lease — see the note on it above section 22
                verandah(A, fr, x0, x1, { beam: spick([0x2f2e2b, 0x1d2a24, 0x3a2420,
                                                       0x24303c, 0x2b2b2f, 0x4a3a24]) });
                const n = Math.max(1, Math.round((w - 0.9) / 9.5));
                const step = (w - 0.9) / n;
                const fitted = irr(0, n - 1);                // one room you can walk into per building
                for (let i = 0; i < n; i++) {
                    const a = x0 + 0.45 + step * i + 0.30;
                    const b = x0 + 0.45 + step * (i + 1) - 0.30;
                    if (b - a < 3.2) continue;
                    const T = TRADE[irr(0, TRADE.length - 1)];
                    if (i === fitted) {
                        const [d0, d1] = xDoor(a, b, o);      // broken for the doorway
                        F(A, 0x232326, a, 0, zf + o * 0.02, d0, 0.40, zg);
                        F(A, 0x232326, d1, 0, zf + o * 0.02, b, 0.40, zg);
                        F(A, 0x232326, d0, 0, zf + o * 0.02, d1, 0.14, zg);
                    } else {
                        F(A, 0x232326, a, 0, zf + o * 0.02, b, 0.40, zg);
                    }
                    F(A, 0x2c2a26, a - 0.34, 0, zf + o * 0.04, a - 0.16, 4.05, zg);
                    if (i === n - 1) F(A, 0x2c2a26, b + 0.16, 0, zf + o * 0.04, b + 0.34, 4.05, zg);

                    /* What this tenancy signs itself with — a board on the
                       fascia, a lightbox slung under the soffit facing along
                       the walk, blades at right angles to the wall, a case
                       beside the door. What was here was one banner the width
                       of the lease on the edge of the awning and one plate the
                       width of the lease on the wall band, every shop the
                       same, which is what this pass exists to undo. */
                    const dcx = (a + b) / 2 + o * (Math.abs(b - a) / 2 - 2.30);
                    const board = shopSigns(A, fr, a, b, T[1], dcx);
                    if (!board) {
                        const sg = new THREE.PlaneGeometry(Math.abs(b - a) - 0.40, 0.52);
                        put(sg, (a + b) / 2, 4.66, zf + o * 0.06, 0, o > 0 ? 0 : Math.PI, 0);
                        P.shopLit.push(shp(sg, T[0]));
                    }

                    if (i === fitted) {
                        shopUnit(zg, a, b, o > 0 ? 'X' : 'x', T[1], T[0]);
                    } else {
                        /* and a shallow tenancy for the rest: glass, a back
                           wall three metres in, and the light on behind it.
                           Nobody is going to walk into every shop on four
                           streets, but every one of them has to look from the
                           footpath as though they could. */
                        F(A, 0x2b2c2e, a, 0, zg, b, 0.55, zg + o * 0.10);
                        W(A, a, 0.55, zg, b, 3.90, zg - o * 0.06);
                        F(A, 0x3a3b3d, a, 2.95, zg, b, 3.05, zg - o * 0.11);
                        const nm = Math.max(1, Math.round((b - a) / 1.40));
                        for (let m = 0; m <= nm; m++) {
                            const mx = a + (b - a) * (m / nm);
                            F(A, 0x3a3b3d, mx - 0.045, 0.55, zg, mx + 0.045, 3.90, zg - o * 0.10);
                        }
                        F(A, 0x5a5348, a, 0, zg - o * 3.10, b, 4.05, zg - o * 3.30);
                        const li = new THREE.PlaneGeometry(Math.abs(b - a) - 0.60, 1.50);
                        put(li, (a + b) / 2, 2.10, zg - o * 3.04, 0, o > 0 ? 0 : Math.PI, 0);
                        P.shopLit.push(shp(li, 'warm'));
                        /* and something standing in front of it, because a lit
                           back wall on its own is a lightbox and reads as one.
                           A counter across the room and two shades over it is
                           the least a shop can have and still be a shop. */
                        F(A, 0x3b332b, a + 0.7, 0, zg - o * 2.30, b - 0.7, 0.95, zg - o * 2.85);
                        F(A, 0x6d6355, a + 0.6, 0.95, zg - o * 2.24, b - 0.6, 1.05, zg - o * 2.91);
                        for (const u of [0.32, 0.68]) {
                            const sh = coneG(0.20, 0.26, 8);
                            put(sh, a + (b - a) * u, 2.55, zg - o * 2.55, Math.PI, 0, 0);
                            P.shopLit.push(shp(sh, 'warm'));
                            F(A, 0x2a2721, a + (b - a) * u - 0.02, 2.68, zg - o * 2.53,
                                       a + (b - a) * u + 0.02, 4.05, zg - o * 2.57);
                        }
                    }
                }
            };

            /* The clear stretches, read off what is already standing: the
               Town Hall holds Collins from 18.5 to 84.5, the hotel holds it
               from 49 to 88 on the other side, the car park and the Wales
               tower hold the west end, the cathedral holds the Flinders Lane
               corner, and the two west-side blocks are about thirty metres
               deep off Swanston. Everything else on these four streets is
               fair game. */
            const RUNS = [
                /* The cathedral's block is not the cathedral: it runs east
                   to a hundred and twelve and north to Flinders Lane, and
                   both of its street frontages are already standing. So
                   these two runs start on the far corner rather than on
                   Swanston. Likewise the long west-side wall, which holds
                   Flinders Lane from the corner out to sixty-eight. */
                ['fsne',  -20.5,   1,  114.0,  152.0],   // Flinders St, north side, past the cathedral block
                ['flse',  -102.8, -1,  114.0,  152.0],   // Flinders Lane, south side
                ['flsw',  -102.8, -1,  -70.0, -152.0],
                ['flne',  -127.2,  1,   88.0,  152.0],   // Flinders Lane, north side
                ['flnw',  -127.2,  1,  -70.0, -152.0],
                ['cose',  -209.5, -1,   88.0,  152.0],   // Collins, south side
                ['cosw',  -209.5, -1,  -68.0, -152.0],
                ['cone',  -250.5,  1,   84.5,  152.0],   // Collins, north side
                ['conw',  -250.5,  1,  -48.0, -152.0],
                ['lcse',  -332.4, -1,   84.5,  152.0],   // Little Collins, south side
                ['lcsw',  -332.4, -1,  -48.0, -152.0],
                ['lcne',  -357.6,  1,   18.5,  152.0],   // Little Collins, north side
                ['lcnw',  -357.6,  1,  -18.5, -152.0],
            ];
            for (const [tag, zf, o, xa, xb] of RUNS) {
                const dir = Math.sign(xb - xa), back = [];
                let x = xa, i = 0;
                while ((xb - x) * dir >= 11.0) {
                    const w = Math.min(rr(12.5, 26.0), (xb - x) * dir);
                    const a = dir > 0 ? x : x - w, b = dir > 0 ? x + w : x;
                    if (Math.min(Math.abs(a), Math.abs(b)) <= NEAR) {
                        const A = [];
                        crossBuilding(A, zf, o, a + 0.30, b - 0.30, true);
                        if (A.length) {
                            const m = merged(A, M21.body);
                            m.receiveShadow = true;
                            scene.add(m);
                            world.part(`${tag}${String(i).padStart(2, '0')}_00`, m);
                        }
                    } else {
                        crossBuilding(back, zf, o, a + 0.30, b - 0.30, false);
                    }
                    x += dir * w; i++;
                }
                if (back.length) {
                    const m = merged(back, M21.body);
                    m.receiveShadow = true;
                    scene.add(m);
                    world.part(`${tag}far_00`, m);
                }
            }
        }

        /* ============================================================
           25 · Eureka Tower, three hundred metres south over the river

           Stand at Flinders and Swanston looking down Princes Bridge and the
           tallest thing in the view is not in the city at all: it is in
           Southbank, close to the far bank, and it is two hundred and
           ninety-seven metres to a flat roof. Fender Katsalidis, 2006, and the
           whole building is one argument about 1854 — blue glass for the flag,
           gold-plated glass on top for the reason anybody was on the
           goldfields at all, and a white blade up one flank with a small red
           mark near the top of it for the blood.

           Built once from memory before the photograph arrived, and the
           photograph corrected three things, all of them the same mistake of
           taking a description literally. The white is not a stripe running
           the full height: it is a tapered blade on the eastern flank that
           comes to a point somewhere past halfway and widens to the crown. The
           red is not a stripe either: it is a short cross near the top of that
           blade, and at this range it is four pixels. And the crown is not a
           solid gold block — it is gold at its ends with the glass carrying
           through the middle of it, capped by the dark of the plant on the
           roof. What runs the full height instead is a dark slot left of
           centre, which the description never mentioned and the photograph
           makes the most legible thing on the shaft.

           It is three hundred metres away and the fog has a fifth of it, so
           everything here is spent on the four things that survive that
           distance — the slender upright silhouette with the two white cores
           stepping out at its ends, the fine ruled floor lines, the two
           stripes, and the crown. There are no window frames on this building
           and no lit rooms in it, because at three hundred metres in daylight
           there is no such thing as either.
           ============================================================ */
        {
            const A = P.eu, G = P.euG, GD = P.euGold;

            /* Where it stands. The real bearing from this crossing is about
               thirty degrees west of south and the better part of half a
               kilometre out, but Southbank in this world is compressed the way
               the rest of the far side is, and what has to be true is the
               relationship rather than the survey: Eureka in front and close
               to the south bank, Australia 108 standing further back, and
               Eureka the westerly of the two, which is the order this crossing
               reads them in. Slid off the line of the bridge until it stands
               over the station's western shoulder the way it does in life. */
            const EX = -118, EZ = 296;
            /* The slab: much wider than it is deep, and the broad faces look
               north and south, which is why the face this world sees is the
               broad one. Forty-three and a half by twenty-six is slender
               enough that the tower reads as a blade rather than a tower —
               eleven to one on the narrow axis. */
            const HW = 21.75, HD = 13.0;
            const H = 297.3;                    // to the roof, and the mast is not in it
            const Y_POD = 21.0;                 // the car park podium it grows out of
            const FF = 3.20, Y_F0 = 25.4;       // ninety-odd residential floors, near enough
            const Y_GOLD = 265.3;               // ten storeys of gold, and the shaft stops here

            // The whole building is set out from its own centre and lives out
            // there, so the helpers here take local metres and put them where
            // the tower is rather than making every line carry the offset.
            const bx = (arr, hex, x0, y0, z0, x1, y1, z1) =>
                F(arr, hex, EX + x0, y0, EZ + z0, EX + x1, y1, EZ + z1);

            /* Nothing on this tower is laid over anything else, and that is a
               depth-buffer decision rather than a modelling one. Three hundred
               metres out, with the app's near plane at a centimetre, a
               twenty-four-bit depth buffer resolves about half a metre — so a
               panel set a hundred millimetres proud of the wall behind it is
               not a panel, it is a field of speckle that crawls as you turn
               your head, which is exactly what the first cut of this did. So
               every panel on this facade butts the panels around it instead:
               two surfaces sharing an edge cannot fight, however far away they
               are, and a building whose whole detail is flat panels of colour
               loses nothing by being built the way it is actually built. The
               podium and the crown are the only things that step, and they
               step in metres. */

            /* ---- the podium. Eureka does not meet the ground the way it
                    meets the sky: there are levels of car park and a lobby
                    under it, wider than the tower and dark at the bottom, and
                    without them the shaft reads as a slab somebody stood on
                    the grass. ---- */
            bx(A, CF.spandrel,  -30.4, 0, -22.4, 30.4, 4.6, 22.4);
            bx(A, CF.euBase,    -30.0, 4.6, -22.0, 30.0, Y_POD, 22.0);
            bx(A, CF.euWhiteLo, -31.0, Y_POD, -23.0, 31.0, Y_POD + 1.2, 23.0);

            /* ---- the curtain wall.

                   Nothing on this facade stands proud of anything. The first
                   cut of it had every slab edge projecting a metre and a
                   third, which is what it took to keep the depth buffer from
                   speckling at this range — and from the footpath, which is
                   below every one of those ninety soffits, the tower read as a
                   stack of shelves rather than as a wall of glass. Eureka is a
                   flat building. So the wall is laid up instead: three
                   columns across the face, and up each column a vision pane
                   and a spandrel and a vision pane, every box butting the box
                   below it. Flush geometry cannot fight, and there is nothing
                   for the sun to catch an underside of.

                   Three columns and not one, because the white and the red run
                   between them. The stripes are cut out of the wall rather
                   than laid over it, so they come up unbroken from the podium
                   to the gold — and running the floor lines straight across
                   them, which is what the first cut did, turns the whole
                   argument of this building into two dashed lines.

                   Every pane is graded against the tower's whole height rather
                   than its own, which is the one thing `pane` has to be told
                   here: ninety panes each grading from black to sky over three
                   metres is a barcode, and one gradient carried up two hundred
                   and sixty-five metres is what a curtain wall actually does —
                   nearly black at the bottom where it has the roofs of
                   Southbank in it, taking the sky by the time it reaches the
                   gold. ---- */
            const DK0 = -9.6, DK1 = -5.4;                  // the dark slot, left of centre
            const COLS = [[-HW, DK0], [DK1, HW]];
            const VIS = 2.66;                              // glass, and the rest of the floor is slab

            const gp = (x0, y0, x1, y1, lo, hi, gy0, gy1) => {
                const g = boxG(Math.abs(x1 - x0), Math.abs(y1 - y0), HD * 2);
                put(g, EX + (x0 + x1) / 2, (y0 + y1) / 2, EZ);
                G.push(pane(g, lo, hi, gy0, gy1));
                return g;
            };

            const NF = Math.floor((Y_GOLD - Y_F0) / FF);
            for (const [a, b] of COLS) {
                gp(a, 0, b, Y_F0, CF.euGlassLo, CF.euGlassHi, 0, Y_GOLD);
                for (let f = 0; f < NF; f++) {
                    const y = Y_F0 + f * FF;
                    gp(a, y, b, y + VIS, CF.euGlassLo, CF.euGlassHi, 0, Y_GOLD);
                    bx(A, CF.euBand, a, y + VIS, -HD, b, y + FF, HD);
                }
                gp(a, Y_F0 + NF * FF, b, Y_GOLD, CF.euGlassLo, CF.euGlassHi, 0, Y_GOLD);
            }
            bx(A, CF.spandrel, DK0, 0, -HD, DK1, Y_GOLD, HD);   // the slot, unbroken

            /* ---- the white blade on the eastern flank. It is not a stripe:
                    it comes to a point a little past halfway and widens all
                    the way to the crown, and its straight diagonal edge is the
                    one line on this building that is not horizontal. Stepped
                    by the floor, because it is a curtain wall and its edge
                    steps too, and stood eight tenths of a metre proud of the
                    glass — far enough that a twenty-four-bit depth buffer can
                    still tell the two apart at three hundred metres, which
                    anything closer cannot. ---- */
            {
                const YB = Y_GOLD * 0.52, BW = 15.4, NB = Math.floor((Y_GOLD - YB) / FF);
                for (let f = 0; f < NB; f++) {
                    const y = YB + f * FF;
                    const t = (y - YB) / (Y_GOLD - YB);
                    bx(A, f % 3 === 2 ? CF.euWhiteLo : CF.euWhite,
                       HW - BW * t, y, -HD - 0.8, HW, y + FF, HD + 0.8);
                }
                // and the red, which is a cross and not a line, near its top
                const YR = Y_GOLD - 34.0;
                bx(A, CF.euRed, HW - 6.4, YR, -HD - 1.4, HW - 4.2, YR + 22.0, HD + 1.4);
                bx(A, CF.euRed, HW - 10.6, YR + 12.0, -HD - 1.4, HW - 1.0, YR + 14.4, HD + 1.4);
            }

            /* ---- the cores. Two white blades on the narrow ends, standing
                    out past the slab and set well in from its broad faces, and
                    they are the whole reason the silhouette has shoulders
                    rather than corners. They stop at the roof: I had them
                    over-running it by four metres, and the photograph has a
                    flat top with the gold carried right to the parapet and
                    nothing standing past it. ---- */
            for (const s of [-1, 1]) {
                bx(A, CF.euWhite, s * (HW - 1.2), 0, -8.6, s * (HW + 5.0), H, 8.6);
            }

            /* ---- the crown. Ten storeys of gold-plated glass, cantilevered a
                    little past the shaft on all four sides so that it sits on
                    the tower rather than being painted onto it, with a pale
                    soffit under the overhang to say where it starts. Laid up
                    the same way the shaft is and graded the same way, and it
                    is the only warm thing in the southern half of this world:
                    from the crossing you find Eureka by looking for it. ---- */
            const GW = HW + 1.2, GD_ = HD + 2.5;
            bx(A, CF.euWhiteLo, -GW - 0.3, Y_GOLD - 0.60, -GD_ - 0.3, GW + 0.3, Y_GOLD, GD_ + 0.3);
            const gpG = (y0, y1) => {
                const g = boxG(GW * 2, Math.abs(y1 - y0), GD_ * 2);
                put(g, EX, (y0 + y1) / 2, EZ);
                GD.push(pane(g, CF.euGoldLo, CF.euGoldHi, Y_GOLD, H));
                return g;
            };
            const NG = Math.floor((H - Y_GOLD) / FF);
            for (let f = 0; f < NG; f++) {
                const y = Y_GOLD + f * FF;
                gpG(y, y + VIS);
                bx(A, CF.euGoldBand, -GW, y + VIS, -GD_, GW, y + FF, GD_);
            }
            gpG(Y_GOLD + NG * FF, H);
            /* The glass carrying through the middle of the crown, and the dark
               of the plant across the top of it. Without these the crown is a
               gold brick, which is what everybody says it is and not what the
               photograph shows. Stood proud of the gold by a metre for the
               same depth-buffer reason the blade is. */
            {
                const CW = 7.2, CT = Y_GOLD + (H - Y_GOLD) * 0.72;
                const g = boxG(CW * 2, CT - Y_GOLD - 2.0, (GD_ + 1.0) * 2);
                put(g, EX, (Y_GOLD + 2.0 + CT) / 2, EZ);
                G.push(pane(g, CF.euGlassLo, CF.euGlassHi, Y_GOLD, H));
                bx(A, CF.spandrel, -GW - 0.2, H - 7.0, -GD_ - 0.2, GW + 0.2, H, GD_ + 0.2);
            }

            /* ---- the roof, which is flat, and the little that stands on it.
                    The mast is kept to almost nothing on purpose: at this range
                    it is two pixels wide, and a spire built any bigger than the
                    truth is the fastest way to make a tower somebody knows look
                    like a tower somebody guessed at. ---- */
            bx(A, CF.euWhiteLo, -GW, H, -GD_, GW, H + 0.7, GD_);
            bx(A, CF.spandrel,  -7.5, H + 0.7, -4.5, 3.5, H + 3.7, 4.5);
            bx(A, CF.mullion,   -0.55, H + 0.7, -0.55, 0.55, H + 15.4, 0.55);
        }

        /* ------------------------------------------------------------
           21k · Australia 108 — Fender Katsalidis, 2020. Three hundred and
                 seventeen metres of blue glass standing in Southbank half a
                 kilometre south-west of this corner, and every one of those
                 metres is building: there is no spire on it, no mast and no
                 aerial, so what you are looking at when you look at the top
                 of it is the roof. That is the whole of why the argument
                 about the tallest tower in the country is an argument.

                 It is filed in this section rather than given one of its own
                 because it is made the way the frontage in front of it is
                 made — the colour is in the vertices — and because that is
                 what buys the only thing that matters at this range. The
                 tower is ruled with a pale line at every one of its hundred
                 slabs, and from the crossing that ruling is most of what you
                 see of it. As geometry it would be a hundred rings of trim;
                 as a texture it would be a texture, in a section that threw
                 its facade textures away. As a sawtooth read off each
                 vertex's own height it costs nothing and rides on the mesh
                 that had to exist anyway.

                 Southbank puts it behind Eureka and well west of it — a
                 hundred and twenty metres further off Swanston's axis and a
                 hundred and forty further back — which from this corner is
                 about eight degrees of separation: far enough apart to read
                 as two towers, near enough to read as one skyline.
           ------------------------------------------------------------ */
        const M108 = {
            /* Its own material and not M21.body, for one reason. Every other
               wall in this section is stone with holes punched in it and
               wants to be matt; this is a hundred storeys of mirror. The
               metalness stays low all the same, because nothing in this world
               carries an environment map and a metal with nothing to reflect
               renders as a hole in the fog. */
            glass: new THREE.MeshStandardMaterial({
                vertexColors: true, roughness: 0.26, metalness: 0.14,
            }),
            /* The gold carries a little emissive for the same reason the
               canopy soffit does. The faces that make the starburst read from
               the north are the ones pointing outward and down, away from
               every source there is up there — and without a bounce term the
               one warm thing on the building comes out as the darkest thing
               on it. */
            gold: new THREE.MeshStandardMaterial({
                vertexColors: true, emissive: srgb(0x6d5220),
                emissiveIntensity: 0.55, roughness: 0.34, metalness: 0.20,
            }),
        };
        {
            const OX = -198, OZ = 430;      // where Southbank puts it
            const FLR = 3.17;               // and a hundred of these is the roof

            /* The plan, walked by arc length rather than by angle: a square
               with the corners taken off, six points to a face and three
               facets to a corner. Three is what makes a corner read as
               softened instead of as either sharp or round, and six to a face
               is what the starburst needs to fold itself across. Every point
               carries the outward normal of the piece of plan it sits on,
               because a chevron pushes out square to the face it hangs off
               and not away from the middle of the building — sample a plan by
               angle and the projections skew round towards the corners. */
            const planPts = (hw, hd, r) => {
                const pts = [], NS = 6, NC = 3, cx = hw - r, cz = hd - r;
                const face = (x0, z0, x1, z1, nx, nz) => {
                    for (let i = 0; i < NS; i++) {
                        const t = i / NS;
                        pts.push({ x: x0 + (x1 - x0) * t, z: z0 + (z1 - z0) * t, nx, nz, u: t });
                    }
                };
                const corner = (ox, oz, a0) => {
                    for (let i = 0; i < NC; i++) {
                        const a = a0 + Math.PI / 2 * (i / NC), c = Math.cos(a), s = Math.sin(a);
                        pts.push({ x: ox + c * r, z: oz + s * r, nx: c, nz: s, u: -1 });
                    }
                };
                face(hw, -cz, hw, cz, 1, 0);     corner(cx, cz, 0);
                face(cx, hd, -cx, hd, 0, 1);     corner(-cx, cz, Math.PI / 2);
                face(-hw, cz, -hw, -cz, -1, 0);  corner(-cx, -cz, Math.PI);
                face(-cx, -hd, cx, -hd, 0, -1);  corner(cx, -cz, -Math.PI / 2);
                return pts;
            };

            // That plan lifted to a height, scaled, pushed out and dropped —
            // the four things anything on this tower ever asks of it.
            const ring = (pl, y, sc, out, dip) => pl.map((p) => {
                const o = out ? out(p) : 0;
                return { x: p.x * sc + p.nx * o, y: y - (dip ? dip(p) : 0), z: p.z * sc + p.nz * o };
            });

            /* Rings skinned into one geometry, and non-indexed on purpose:
               computeVertexNormals over a non-indexed strip gives every quad
               its own flat normal, which is the whole of why the corners come
               out as facets and the starburst comes out as folds rather than
               as a smeared cylinder with a bulge in it. */
            const tube = (rings) => {
                const S = rings.length - 1, N = rings[0].length;
                const pos = new Float32Array(S * N * 18);
                let k = 0;
                for (let s = 0; s < S; s++) {
                    const r0 = rings[s], r1 = rings[s + 1];
                    for (let i = 0; i < N; i++) {
                        const j = (i + 1) % N;
                        const v = [r0[i], r1[i], r1[j], r0[i], r1[j], r0[j]];
                        for (let t = 0; t < 6; t++) { pos[k++] = v[t].x; pos[k++] = v[t].y; pos[k++] = v[t].z; }
                    }
                }
                const g = new THREE.BufferGeometry();
                g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
                g.computeVertexNormals();
                return g;
            };
            // and the flat roof, which is the one thing on this building
            // everybody argues about, fanned off its own centre
            const lid = (r) => {
                const N = r.length, pos = new Float32Array(N * 9), cy = r[0].y;
                let k = 0;
                for (let i = 0; i < N; i++) {
                    const j = (i + 1) % N;
                    pos[k++] = 0; pos[k++] = cy; pos[k++] = 0;
                    pos[k++] = r[j].x; pos[k++] = cy; pos[k++] = r[j].z;
                    pos[k++] = r[i].x; pos[k++] = cy; pos[k++] = r[i].z;
                }
                const g = new THREE.BufferGeometry();
                g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
                g.computeVertexNormals();
                return g;
            };

            /* The ruling, which is the building. Rings go up two to a floor
               and the second of them only three tenths of the way up the
               storey — that asymmetry is what turns a soft stripe into a
               line: the glass goes dark fast under each slab and then takes
               the rest of the floor to come back to it. Every eighth slab
               takes the gold instead, which is the accent the tower carries
               the whole way up, and the base colour walks from the dark it
               takes off the buildings opposite at the bottom to the sky it
               takes at the top, the way `pane` does it everywhere else. */
            /* And the one thing in this section that does not take the wet
               grade `TONE` puts on everything else. That grade is a wet-street
               grade: it exists so that precast and bluestone forty metres away
               read as rained on, and it costs two thirds of the saturation of
               whatever it touches. Half a kilometre off, behind four hundred
               metres of warm haze that is already draining this tower for
               nothing, paying it twice leaves the blue grey and the gold
               beige — and the blue and the gold are the only two things
               anybody recognises the building by. So these colours are set
               where they land, and the haze does the rest. */
            const _hue = new Map();
            const HU = (hex) => { let c = _hue.get(hex); if (!c) { c = srgb(hex); _hue.set(hex, c); } return c; };
            const flat = (arr, hex, g) => {
                const c = HU(hex), n = g.attributes.position.count, a = new Float32Array(n * 3);
                for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
                g.setAttribute('color', new THREE.BufferAttribute(a, 3));
                arr.push(g);
                return g;
            };
            /* The accent lines are the pale rule warmed halfway towards the
               gold and not the gold itself. At full strength, under a sun
               this low and this orange, every eighth floor came out as a band
               of rust and the tower read as striped rather than as ruled —
               and the point of the accent is that you notice it after you
               notice the building. */
            const G_LO = HU(CF.a108Lo), G_HI = HU(CF.a108Hi), G_BND = HU(CF.a108Band);
            const G_GLD = HU(CF.a108Band).clone().lerp(HU(CF.a108Gold), 0.52);
            const rule = (g) => {
                const p = g.attributes.position, n = p.count, a = new Float32Array(n * 3);
                for (let i = 0; i < n; i++) {
                    const y = p.getY(i), f = y / FLR, fr = f - Math.floor(f);
                    const s = fr < 0.32 ? (1 - fr / 0.32) * 0.52 : 0;
                    const gd = Math.round(f) % 8 === 0 ? 1 : 0;
                    const t = smoothstep(-30, 340, y);
                    a[i * 3] = lerp(lerp(G_LO.r, G_HI.r, t), lerp(G_BND.r, G_GLD.r, gd), s);
                    a[i * 3 + 1] = lerp(lerp(G_LO.g, G_HI.g, t), lerp(G_BND.g, G_GLD.g, gd), s);
                    a[i * 3 + 2] = lerp(lerp(G_LO.b, G_HI.b, t), lerp(G_BND.b, G_GLD.b, gd), s);
                }
                g.setAttribute('color', new THREE.BufferAttribute(a, 3));
                return g;
            };
            // Painted where it stands, then carried out to Southbank. Nothing
            // here goes into an array by any other door: one geometry in this
            // section without a colour attribute on it and the merge at the
            // end of 21j answers null, and a null geometry is the viewport.
            const glazed = (g) => { P.a108.push(rule(put(g, OX, 0, OZ))); return g; };

            const rungs = (pl, f0, f1, sc) => {
                const out = [];
                for (let f = f0; f <= f1; f++) {
                    out.push(ring(pl, f * FLR, sc ? sc(f) : 1));
                    if (f < f1) out.push(ring(pl, (f + 0.30) * FLR, sc ? sc(f + 0.30) : 1));
                }
                return out;
            };

            /* The block it stands on, the podium over that, and then the
               shaft — which starts a floor inside the podium so the two
               never argue about where they meet. Every step back is closed
               with a flat annulus rather than left open, because an open
               shoulder at this range is a black seam three metres wide. */
            const plinth = planPts(58, 50, 15);
            const podium = planPts(34, 30, 9);
            const lower  = planPts(23.6, 22.4, 6.2);
            const upper  = planPts(19.8, 18.8, 5.6);
            const F_POD = 5, F_GOLD = 71, F_TOP = 100;

            const based = (g) => flat(P.a108, CF.a108Base, put(g, OX, 0, OZ));
            based(tube([ring(plinth, 0, 1), ring(plinth, 8.4, 1)]));
            based(tube([ring(plinth, 8.4, 1), ring(podium, 8.4, 1)]));
            glazed(tube(rungs(podium, 0, F_POD)));
            based(tube([ring(podium, F_POD * FLR, 1), ring(lower, F_POD * FLR, 1)]));
            glazed(tube(rungs(lower, F_POD - 1, F_GOLD)));
            based(tube([ring(lower, F_GOLD * FLR, 1), ring(upper, F_GOLD * FLR, 1)]));

            /* The last three and a half floors draw themselves in by a tenth,
               which at four hundred metres is the entire parapet: it is what
               gives the roofline the curved, banded profile it has instead of
               the flat cut a prism ends on. */
            const crown = (f) => 1 - 0.10 * smoothstep(96.5, F_TOP, f);
            glazed(tube(rungs(upper, F_GOLD, F_TOP, crown)));
            based(lid(ring(upper, F_TOP * FLR, crown(F_TOP))));

            /* And the starburst, two thirds of the way up, which is the thing
               anybody actually recognises this tower by.

               Three chevrons to a face. Each one pushes out square to its own
               face and is dragged down as it goes, so the lower edge of the
               gold is a saw of six-metre teeth and the surface between that
               edge and the shaft below it is a soffit — the face you see from
               this side of the river, looking up at it through twenty-three
               degrees, and the reason the material has a bounce term in it.
               Above the teeth the same band leans back into the tower over
               six storeys, and that leaning face is the gold in every
               photograph of the place. The corner facets keep a metre and a
               bit of projection and no drop at all, so the band carries round
               the corners as a band instead of stopping dead at them. */
            const F_GB = 59, F_GM = 65;
            const tri = (u) => { const k = (u * 3) % 1; return 1 - Math.abs(k * 2 - 1); };
            const proj = (p) => (p.u < 0 ? 1.6 : 1.6 + 8.4 * tri(p.u));
            const drop = (p) => (p.u < 0 ? 0 : 8.0 * tri(p.u));
            const gA = ring(lower, F_GB * FLR, 1, () => 0.5);
            const gB = ring(lower, F_GM * FLR, 1, proj, drop);
            const gC = ring(lower, F_GOLD * FLR, 1, () => 0.9);
            flat(P.a108g, CF.a108Soff, put(tube([gA, gB]), OX, 0, OZ));
            flat(P.a108g, CF.a108Gold, put(tube([gB, gC]), OX, 0, OZ));
        }

        /* ------------------------------------------------------------
           21j · everything merged
           ------------------------------------------------------------ */
        {
            /* Three objects, each a group of the meshes it is made of — the
               shape `cathedral_00` and `fedsquare_00` already have, and the
               reason somebody in edit mode picks up the hotel rather than
               picking up every pale surface in the precinct. */
            const OBJECTS = [
                // Two meshes and three hundred and seventeen metres: the whole
                // tower is one colour attribute and the starburst is the other.
                ['australia108_00', [[P.a108, M108.glass], [P.a108g, M108.gold]], []],
                ['centurybuilding_00', [[P.m2, M21.body]], []],
                ['walescorner_00', [[P.w1, M21.body]], []],
                ['swanstonwestlower_00', [[P.w2, M21.body]], []],
                ['swanstonwest_00', [[P.m3, M21.body]], []],
                ['westin_00', [[P.b2, M21.body], [P.b2g, M21.glass], [P.b2l, M21.lit]], []],
                ['swanstonwestshops_00', [[P.shop, M21.body], [P.shopGlass, M21.glass],
                                      [P.shopLit, M21.lit]], []],
                /* Every verandah on the four streets in two draws: the lining
                   under all of them, and every board, lightbox, blade, case,
                   number and downlight hung off them. One object rather than
                   one per block because it is one system — the fascia beams,
                   the ties and the flashings are colour on the vertices and
                   travel with the building they are bolted to, and only these
                   two, which are a map and a lit map, cannot. */
                ['verandahsigns_00', [[P.awnSoff, M21.vsoff], [P.awnLit, M21.awn]], []],
                ['citysquare_00', [
                    [P.qSteel, M21.steel], [P.qClad, M21.batten], [P.qGlass, M21.glass],
                    [P.qTrim, M21.bronze], [P.qSign, M21.sign],
                ], [
                    // The canopy deck is nine metres up over open paving with
                    // no way onto it, so it is scenery rather than surface.
                    // Ghosted, it stops spending one of the four vertical spans
                    // the walk keeps per cell on every square metre of the
                    // plaza — spans the plaza needs for the paving and for the
                    // shaft under it.
                    [P.qRoof, M21.soffit],
                ]],
                ['townhallstation_00', [
                    [P.sCrete, M21.crete], [P.sSteel, M21.steel], [P.sTrim, M21.bronze],
                    [P.sSign, M21.sign],
                ], [
                    /* And the balustrades down the escalators, for a reason
                       worth writing down: the walk merges two surfaces less
                       than 1.4 m apart into one solid, because nobody fits
                       between them. A metre of glass standing on an escalator
                       deck is exactly that — so left solid, the surface the
                       walk offers down the whole flight is the top of the
                       handrail, and you ride to the bottom floating a metre
                       above the steps. The deck is what you stand on; the rail
                       beside it is scenery, and the batten walls either side of
                       the bank are what actually stops anybody.

                       The frameless panes round the opening at the Federation
                       Square end are in here for the same arithmetic read the
                       other way: a metre of glass standing on the footpath
                       merges with the footpath, and the walk would offer the
                       cap rail as a surface. Ghosted, the shoe and the rail
                       are the two solids, 0.94 m apart, and the encoder joins
                       them into the wall the balustrade is. */
                    [P.gGlass, M21.glass], [P.sPane, M21.pane], [P.gTrim, M21.rail],
                ]],
                // and the one thing in this list that is not on this block at
                // all: three draws for three hundred metres of tower, which is
                // what a building made of colour rather than of texture buys.
                ['eurekatower_00', [
                    [P.eu, M21.body], [P.euG, M21.euGlass], [P.euGold, M21.euGold],
                ], []],
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
    }

    /* ============================================================
       15 · the Yarra, and Princes Bridge

       The water first, then the 1888 bridge standing in it.

       Three shallow segmental spans of cast iron on rusticated bluestone
       piers, a pale balustrade with a solid pedestal and an ornamental
       standard over every pier, and under the deck the thing that makes this
       bridge itself: the arch ribs and the fan of radiating spandrel bracing
       between them and the soffit, the whole underside painted oxide red.
       That red is what you see from the bank and from the water, and it was
       the one thing the roughed-in version had no depth in — a flat plate
       where there should be seven ribs and eighty struts.

       Everything on the banks is section 27. This section is the water and
       the structure, and nothing else.
       ============================================================ */
    {
        const water = new THREE.ShaderMaterial({
            uniforms: pick('uTime', 'uCamPos', 'uWind', 'uFogCol', 'uFogNear', 'uFogFar', 'uSkyLo', 'uSkyHi',
                           'uSun', 'uLPos', 'uLCol', 'uLStr', 'uLRad'),
            vertexShader: WORLD_VS,
            fragmentShader: NOISE_GLSL + RIPPLE_GLSL + WET_GLSL + FOG_GLSL + /* glsl */`
              uniform float uTime; uniform vec3 uCamPos; uniform vec2 uWind; uniform vec3 uSun;
              varying vec3 vWorld;
              void main(){
                float dist = length(uCamPos - vWorld);
                // The Yarra is not blue and never has been: it is the colour of
                // the silt it carries, and into a low sun it is mostly a
                // picture of the sky with the silt showing through the chop.
                vec2 p = vWorld.xz;
                float w1 = fbm(p * 0.36 + vec2(uTime * 0.10, uTime * 0.045) * 6.0 * uWind.x);
                float w2 = fbm(p * 1.15 - vec2(uTime * 0.16, 0.0));
                float w3 = fbm(p * 0.045 + vec2(uTime * 0.02, 0.0));
                /* The one thing that says river rather than ground at any
                   distance, including from three hundred feet where there is
                   no ripple left to resolve: the streaks. A current draws the
                   surface out along itself, so the noise that breaks the sky
                   up is sampled eighteen times wider across the channel than
                   along it, and what comes back is long bright and dark bands
                   running with the flow. This is a much bigger part of reading
                   as water than the colour is. */
                float streak = fbm(vec2(p.x * 0.055, p.y * 0.62) + vec2(uTime * 0.075, 0.0));
                float chop = (w1 - 0.5) * 0.7 + (w2 - 0.5) * 0.35;
                /* Silt, and it leads. Everything under this heading used to be
                   sky: the body colour was two hundredths of a unit and the
                   mirror was weighted at a third, which into a low sun made the
                   whole channel one flat sheet of gold — a sandbank with a
                   bridge over it rather than a river. The Yarra is the colour of
                   what it carries first and a picture of the sky second, and the
                   long wave w3 is what stops the second half being one value
                   from bank to bank. */
                vec3 body = mix(vec3(0.0205, 0.0290, 0.0175), vec3(0.042, 0.058, 0.033), w1);
                body *= 0.44 + 0.50 * w3 + 0.82 * streak;

                float rip = ripple(p * 0.55, uTime) * (1.0 - smoothstep(20.0, 90.0, dist));
                vec3 diff, spec;
                wetLight(vWorld, uCamPos, rip + chop * 0.8, 1.0, diff, spec);

                vec3 col = body * (0.34 + uSkyLo * 0.17 + uSkyHi * 0.40 + diff * 0.32);
                float mir = (0.040 + 0.036 * w2)
                          * (0.30 + 1.55 * streak)
                          * (0.66 + 0.62 * smoothstep(-0.22, 0.26, chop + (w3 - 0.5) * 0.9));
                col += skyMirror(vWorld, uCamPos, rip * 0.7 + chop) * mir;
                col += spec * 0.55;
                /* And the one thing that says water rather than mud from
                   directly overhead, where there is no grazing angle left for
                   the sky to come back off: the sun's own track. The normal is
                   tilted by the chop, so the track breaks up into the long
                   scatter of glitter a river actually shows into a low sun
                   instead of one clean highlight. */
                vec3 V = normalize(uCamPos - vWorld);
                vec3 Hf = normalize(V + uSun);
                vec3 N = normalize(vec3(chop * 0.42 + (w2 - 0.5) * 0.55, 1.0, chop * 0.30));
                col += vec3(1.00, 0.56, 0.24) * pow(max(dot(N, Hf), 0.0), 22.0) * 0.90;
                col += vec3(0.55, 0.60, 0.66) * max(rip, 0.0) * 0.05;
                gl_FragColor = vec4(applyFog(col, dist), 1.0);
              }`,
        });
        /* Wide enough to fill the cut in both road sheets and then run out to
           the fog. The old plane stopped at 210 metres either side, which was
           further than the near sheet reached and nowhere near as far as the
           distance one — so with the channel opened up the river used to end
           in mid-air on both sides of the city. */
        const wg = new THREE.PlaneGeometry(1240, CUT_S - CUT_N + 10, 10, 4);
        wg.rotateX(-Math.PI / 2);
        const river = mesh(wg, water, 0, WATER, (CUT_N + CUT_S) / 2);
        scene.add(river);

        /* ---- Princes Bridge -------------------------------------------

           One vertex-coloured mesh for the whole structure. Six materials was
           six draws for one bridge and, worse, six palettes: the piers had to
           be the same grey as the lamp standards because they shared a merge.
           Painted per vertex the bluestone can be bluestone, the ironwork can
           be oxide red, the balustrade can be warm cream and the standards
           can be dark bronze-green, and it is still one draw. */
        const _bt = new Map();
        const bc = (hex) => { let c = _bt.get(hex); if (!c) { c = srgb(hex); _bt.set(hex, c); } return c; };
        // Every geometry that goes into these merges is painted here, without
        // exception: mergeGeometries answers null the moment one member of the
        // array has a colour attribute and another does not, and a null
        // geometry is a mesh with no position, which is the viewport.
        const col = (g, hex) => {
            const c = bc(hex), n = g.attributes.position.count, a = new Float32Array(n * 3);
            for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
            g.setAttribute('color', new THREE.BufferAttribute(a, 3));
            return g;
        };
        const PG = (arr, hex, g) => { arr.push(col(g, hex)); return g; };
        const PB = (arr, hex, w, h, d, x, y, z, rx, ry, rz) =>
            PG(arr, hex, put(boxG(w, h, d), x, y, z, rx, ry, rz));

        /* The paint chips, read off the photograph. Written a shade brighter
           than the eye wants because `srgb` reads every hex in this file
           twice — see section 0 — and a dark one comes out of that a great
           deal darker than it went in. */
        const IRON = 0xbe5236;        // the archivolts and the medallions, into the sun
        const IRON_D = 0x9c412a;      // the same paint on the soffit, which is never in it
        const BLUE = 0x929ca7;        // rusticated bluestone
        const BLUE_D = 0x808b96;      // and the alternate course, so the rustication reads
        const CREAM = 0xe4dfd0;       // the parapet, the spandrel panels, the pedestals
        const CREAM_D = 0xcdc6b4;
        const BAND = 0x9fadba;        // the blue-grey line that runs through the moulding
        const BRONZE = 0x5e7d6a;      // the lamp standards, dark green bronze
        const GOLD = 0xd6c089;        // the arms in the middle of each medallion
        const ASPH = 0x8a8e95;        // the carriageway, and a shade up from the street's
        const LINE = 0xdad5c2;
        const IRONW = 0x35393c;       // wire, and the poles that hold it
        const POLE = 0x7a8083;

        const body = [], deck = [], balus = [], glow = [];

        const DK = BR_Y;                          // the carriageway top, level with the street
        const FWY = DK + KERB_H + 0.02;           // the footways, up one kerb from it
        /* 1.30 under the carriageway rather than 1.50, and the twenty
           centimetres are the walk's rather than the eye's: `ground.js` reads
           two surfaces more than 1.4 m apart as two solids, so a deck exactly
           1.52 thick registered as a floor with an unrelated ceiling a metre
           and a half under it instead of as one slab. */
        const UND = DK - 1.30;                    // the deck soffit
        const SPRING = DK - 4.30;                 // where every arch springs off its pier
        const BZ0 = 130, BZ1 = 240;               // the deck, running two metres past the cut
        const BL = BZ1 - BZ0, BC = (BZ0 + BZ1) / 2;
        const HW = BR_W / 2;                      // 15 — the outer face of the structure
        const FW_W = 5.0, FW_X = 12.35;           // the footways: 9.85 to 14.85 either side
        const PIER = [RIV_N, RIV_N + 31.3, RIV_N + 62.6, RIV_S];
        const PED_D = 3.6;                        // the pedestal over each pier, in z

        // A segmental arch: very flat and very broad, which is the whole look
        // of this bridge. Given a span and a rise it answers the circle that
        // passes through both springings and the crown.
        const segArc = (zc, span, y0, rise) => {
            const R = (span * span / 4 + rise * rise) / (2 * rise);
            return { R, cy: y0 + rise - R, half: Math.asin(clamp(span / 2 / R, 0, 1)), zc };
        };

        /* ---- the three spans, from the soffit up ---------------------- */
        const RIBX = [-13.1, -8.7, -4.35, 0, 4.35, 8.7, 13.1];
        for (let sp = 0; sp < 3; sp++) {
            const z0 = PIER[sp], z1 = PIER[sp + 1];
            const zc = (z0 + z1) / 2, span = z1 - z0 - 5.4;
            const A = segArc(zc, span, SPRING, 2.50);
            const N = 14;

            for (let i = 0; i < N; i++) {
                const a0 = -A.half + 2 * A.half * i / N, a1 = -A.half + 2 * A.half * (i + 1) / N;
                const pz0 = zc + Math.sin(a0) * A.R, py0 = A.cy + Math.cos(a0) * A.R;
                const pz1 = zc + Math.sin(a1) * A.R, py1 = A.cy + Math.cos(a1) * A.R;
                const len = Math.hypot(pz1 - pz0, py1 - py0) * 1.06;
                const tilt = -Math.atan2(py1 - py0, pz1 - pz0);
                const my = (py0 + py1) / 2, mz = (pz0 + pz1) / 2;

                // the ribs — seven of them, following the curve, and the only
                // thing actually carrying the deck
                for (const rx of RIBX) PB(body, IRON_D, 0.62, 0.55, len, rx, my, mz, tilt);

                // the archivolt on each face, which is the arc a photograph of
                // this bridge is mostly made of
                for (const sx of [-1, 1]) {
                    PB(body, IRON, 0.60, 1.05, len, sx * (HW + 0.10), my + 0.12, mz, tilt);
                }

                /* and the cream spandrel over it, on the two outer faces only.
                   The roughed-in version filled the whole width with it, which
                   from below walled the fan in behind a solid sheet — on an
                   iron bridge there is nothing up there but air and bracing. */
                const yT = my + 0.62, h = UND - yT;
                if (h > 0.12) {
                    for (const sx of [-1, 1]) {
                        PB(body, sx * SUN.x > 0 ? CREAM : CREAM_D, 0.62, h,
                           Math.abs(pz1 - pz0) + 0.12, sx * (HW - 0.30), yT + h / 2, mz);
                    }
                }
            }

            /* The fan. Radiating struts standing on the extrados of every rib
               and reaching the soffit, spreading out of the springing at each
               pier — which is why the underside of this bridge looks like a
               pair of open hands and not like a beam. */
            const NF = 15;
            for (let i = 0; i <= NF; i++) {
                const a = -A.half + 2 * A.half * i / NF;
                const pz = zc + Math.sin(a) * A.R, py = A.cy + Math.cos(a) * A.R;
                const h = (UND - py - 0.34) / Math.cos(a);
                if (h < 0.30) continue;
                const mid = 0.34 + h / 2;
                for (const rx of RIBX) {
                    PB(body, IRON_D, 0.24, h, 0.20, rx,
                       py + Math.cos(a) * mid, pz + Math.sin(a) * mid, a);
                }
            }
        }

        /* ---- the piers, and the two abutments ------------------------ */
        PIER.forEach((pz, k) => {
            const isEnd = (k === 0 || k === PIER.length - 1);
            /* Eight metres at the abutments rather than twelve, and the
               difference is the whole of whether a person can walk under this
               bridge: the river-level promenade comes in at 144 on one bank
               and 226 on the other, and a mass that deep pushed its capping
               course up through the quay and closed the way through. */
            const pd = isEnd ? 8.0 : 5.2;
            const y0 = WATER - 3.2, y1 = SPRING - 1.05;

            /* Battered and rusticated: eight courses, each a little narrower
               than the one under it and each a shade off its neighbour, so a
               pier reads as coursed rough-faced stone from the water without
               a texture and without a second material. */
            const NCO = 8;
            for (let c = 0; c < NCO; c++) {
                const a = y0 + (y1 - y0) * c / NCO, b = y0 + (y1 - y0) * (c + 1) / NCO;
                const t = (c + 0.5) / NCO;
                PB(body, c % 2 ? BLUE : BLUE_D,
                   BR_W + 3.2 - t * 2.2, b - a, pd + 2.2 - t * 1.5, 0, (a + b) / 2, pz);
            }
            // the moulded cap the arch springs off, in two projections
            PB(body, BLUE, BR_W + 2.4, 0.45, pd + 1.7, 0, y1 + 0.22, pz);
            PB(body, BLUE, BR_W + 3.0, 0.55, pd + 2.3, 0, y1 + 0.72, pz);

            // cutwaters, at the two piers that actually stand in the stream.
            // A three-sided prism standing on end is a nose upstream and a
            // nose down, for two geometries and no thought.
            if (!isEnd) for (const sx of [-1, 1]) {
                PG(body, BLUE_D, put(cylG(3.2, 4.4, y1 + 0.5 - y0, 3),
                   sx * (HW - 0.9), (y0 + y1 + 0.5) / 2, pz, 0, sx > 0 ? Math.PI / 2 : -Math.PI / 2, 0));
            }

            /* The spandrel over the pier, and on it the medallion: a red
               roundel with the arms in cream and gold inside a moulded ring,
               and a small panel either side of it. */
            for (const sx of [-1, 1]) {
                const fx = sx * (HW - 0.30);
                PB(body, sx * SUN.x > 0 ? CREAM : CREAM_D, 0.62, UND - (SPRING + 0.4), pd + 1.2,
                   fx, (UND + SPRING + 0.4) / 2, pz);
                const ry = sx > 0 ? Math.PI / 2 : -Math.PI / 2;
                const mx = sx * (HW + 0.02), my = (UND + SPRING) / 2 + 0.22;
                PG(body, IRON, put(new THREE.CircleGeometry(1.16, 20), mx + sx * 0.06, my, pz, 0, ry, 0));
                PG(body, GOLD, put(new THREE.CircleGeometry(0.60, 14), mx + sx * 0.13, my, pz, 0, ry, 0));
                PG(body, CREAM, put(new THREE.TorusGeometry(1.24, 0.15, 6, 18), mx + sx * 0.08, my, pz, 0, ry, 0));
                for (const dz of [-2.35, 2.35]) {
                    PB(body, IRON, 0.16, 1.30, 0.72, mx + sx * 0.06, my, pz + dz);
                    PB(body, CREAM, 0.14, 1.46, 0.90, mx + sx * 0.04, my, pz + dz);
                }
            }
        });

        /* ---- the deck ------------------------------------------------ */
        // The carriageway. Two millimetres of it stand over the road sheets it
        // overlaps at each end rather than sharing their plane, because two
        // surfaces at exactly one height is a seam that flickers.
        PB(deck, ASPH, BR_W - 0.3, 1.32, BL, 0, DK - 0.64, BC);
        // and the lane lines, which are the only marking out here: the road
        // texture is a 240 m square around Flinders Street and stops long
        // before the river.
        for (const sx of [-1, 1]) for (const lx of [6.35, 9.45]) {
            PB(deck, LINE, 0.17, 0.04, BL, sx * lx, DK + 0.018, BC);
        }
        // the raised footways, and the kerb face under them
        for (const sx of [-1, 1]) {
            PB(deck, 0xb6b2a6, FW_W, KERB_H + 0.02, BL, sx * FW_X, DK + (KERB_H + 0.02) / 2, BC);
            PB(deck, 0x8f8d89, 0.20, KERB_H + 0.02, BL, sx * (FW_X - FW_W / 2 - 0.06), DK + (KERB_H + 0.02) / 2, BC);
        }

        /* ---- the fascia, the parapet and its pedestals ---------------- */
        for (const sx of [-1, 1]) {
            const lit = sx * SUN.x > 0;                 // which face the sun is on
            const face = lit ? CREAM : CREAM_D;
            PB(body, face, 0.90, 1.20, BL, sx * (HW - 0.05), UND + 0.60, BC);        // the girder face
            PB(body, face, 1.22, 0.32, BL, sx * (HW + 0.03), UND + 1.36, BC);        // and its cornice
            PB(body, BAND, 1.26, 0.10, BL, sx * (HW + 0.05), DK + 0.24, BC);         // the blue-grey line
            PB(body, face, 1.04, 0.24, BL, sx * (HW - 0.20), DK + 0.11, BC);         // the plinth

            /* The balustrade, broken at every pedestal rather than run through
               behind them. Its UVs are scaled by the length of each run so a
               baluster stays the same width whether the run is four metres or
               twenty-eight. */
            const stops = [BZ0, ...PIER.flatMap((p) => [p - PED_D / 2, p + PED_D / 2]), BZ1];
            for (let i = 0; i < stops.length; i += 2) {
                const d = stops[i + 1] - stops[i];
                if (d < 0.4) continue;
                const g = uvScale(boxG(0.55, 1.02, d), d / BL, 1);
                balus.push(put(g, sx * (HW - 0.32), DK + 0.78, (stops[i] + stops[i + 1]) / 2));
            }
            PB(body, face, 0.98, 0.24, BL, sx * (HW - 0.32), DK + 1.41, BC);         // the handrail over it
        }

        /* ---- the pedestals, and the standards that stand on them ------ */
        for (const pz of PIER) for (const sx of [-1, 1]) {
            const px = sx * (HW - 0.32);
            PB(body, sx * SUN.x > 0 ? CREAM : CREAM_D, 0.98, 1.31, PED_D, px, DK + 0.895, pz);
            PB(body, CREAM, 1.20, 0.22, PED_D + 0.30, px, DK + 1.62, pz);

            /* An ornamental standard: a moulded base, a fluted shaft, a
               heraldic figure under the lantern and a finial over it, in the
               dark green bronze every piece of nineteenth-century street iron
               in this city was painted. Metalness stays at nothing — this
               world has no environment map, and a metallic standard material
               with nothing to reflect renders black. */
            const L = MX(px, DK + 1.73, pz);
            const carryP = (hex, g) => { g.applyMatrix4(L); PG(body, hex, g); };
            const carryG = (hex, g) => { g.applyMatrix4(L); PG(glow, hex, g); };
            carryP(BRONZE, put(boxG(1.02, 0.34, 1.02), 0, 0.17, 0));
            carryP(BRONZE, put(cylG(0.40, 0.52, 0.62, 10), 0, 0.65, 0));
            carryP(BRONZE, put(cylG(0.20, 0.30, 3.10, 10), 0, 2.51, 0));
            for (let f = 0; f < 6; f++) {                       // the flutes
                const a = f * Math.PI / 3;
                carryP(BRONZE, put(boxG(0.07, 3.10, 0.07), Math.sin(a) * 0.24, 2.51, Math.cos(a) * 0.24));
            }
            carryP(BRONZE, put(cylG(0.34, 0.26, 0.30, 10), 0, 4.20, 0));
            carryP(BRONZE, put(sphG(0.22, 8, 6), 0, 4.52, 0));  // the figure under the lantern
            carryP(BRONZE, put(boxG(0.36, 0.44, 0.24), 0, 4.66, 0));
            carryG(0xf6efd8, put(boxG(0.66, 0.92, 0.66), 0, 5.36, 0));
            carryP(BRONZE, put(cylG(0.08, 0.48, 0.42, 8), 0, 6.02, 0));
            carryP(BRONZE, put(cylG(0.04, 0.04, 0.46, 6), 0, 6.42, 0));
        }

        // and the pylon that closes the parapet at each end of the bridge
        for (const bz of [BZ0 + 0.9, BZ1 - 0.9]) for (const sx of [-1, 1]) {
            PB(body, BLUE, 1.40, 2.30, 2.20, sx * (HW - 0.35), DK + 1.05, bz);
            PB(body, BLUE_D, 1.60, 0.26, 2.40, sx * (HW - 0.35), DK + 2.30, bz);
        }

        /* ---- the overhead, and the poles that hold it up --------------
           The wire runs the whole length of the corridor, so a tram coming up
           from St Kilda Road is under wire the entire way; the poles are the
           bridge's own, standing on the footway kerb the way they do on the
           real deck. */
        for (const o of [-TRS, TRS]) {
            for (const r of [-RAIL, RAIL]) {
                PB(deck, 0xb0a89a, 0.075, 0.05, BL, o + r, DK + 0.05, BC);
            }
            PB(body, IRONW, 0.035, 0.035, RUN_Z1 - 96, o, DK + WIRE_H, (96 + RUN_Z1) / 2);
        }
        for (let i = 0; i < 5; i++) {
            const pz = BZ0 + 12 + i * 22.5, sx = (i % 2) ? 1 : -1;
            const px = sx * (FW_X + FW_W / 2 - 0.45);
            PB(body, POLE, 0.20, 8.2, 0.20, px, FWY + 4.1, pz);
            PB(body, POLE, Math.abs(px) - 1.2, 0.14, 0.14, sx * (Math.abs(px) + 1.2) / 2, DK + WIRE_H + 0.55, pz);
            // and on every second one a modern outreach light over the roadway
            if (i % 2 === 0) {
                PB(body, POLE, 2.6, 0.14, 0.14, px - sx * 1.3, FWY + 8.00, pz);
                PG(glow, 0xf3e6c6, put(boxG(0.86, 0.10, 0.34), px - sx * 2.4, FWY + 7.86, pz));
            }
        }

        const bridge = new THREE.Group();
        const deckMesh = merged(deck, new THREE.MeshStandardMaterial({
            vertexColors: true, roughness: 0.52, metalness: 0.05,
        }));
        bridge.add(
            merged(body, new THREE.MeshStandardMaterial({
                vertexColors: true, roughness: 0.66, metalness: 0.04,
            })),
            deckMesh,
            merged(balus, stdMat(0xffffff, { map: parapetTex, roughness: 0.60 })));
        const lamps = merged(glow, emissive(0xf3ecd6, 0xffe0a8, 2.4));
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

    /* ---- plane trees.

       This world had sixty of them, all in the middle distance, and not one on
       the footpath a person actually walks down. That was the largest single
       thing wrong with it. Swanston Street is a London plane avenue: a tree
       every seven or eight metres hard against the kerb, the whole way from
       the station to Little Collins and out along all three cross streets,
       with the crowns closing overhead into a green tunnel and the sun coming
       through it in patches. Take the trees out and what is left is a road
       with shops on it, which is precisely how the world was reading.

       So: about three hundred of them, in three instanced meshes and no more.

         · the trunk. Pruned back to its knuckles every winter, which is why a
           Melbourne plane is a heavy trunk running clear to four and a half
           metres — above every verandah on the street, which is the reason
           this is the tree the city plants — and then four knuckled limbs with
           a second order off each. It is the branching that reads against a
           bright sky, not the mass.
         · the crown, as eleven clumps of leaves on the surface of a squashed
           sphere. Each clump is three cards standing in a star with a fourth
           lying across the top of them, drawn against an alpha-cut texture of
           two hundred five-lobed leaves — so the crown has a leafy edge, and
           holes in it, and something to look at from underneath. Eleven
           clumps cover about two thirds of the shell they sit on: the third
           that is missing is the sky you see through the tree.
         · the pit. Every street tree stands in one and the photograph is full
           of them — an opening in the paving with a cast grate over it and a
           dressed stone edge round that. One flat card each, because at eye
           height a grate is a pattern seen at fifteen degrees and its edge is
           twenty millimetres proud, and neither is worth geometry.

       All three are instanced, so `ground.js` leaves all three out of the walk
       — which is right. You walk past a plane tree; you do not walk into one,
       and a tree pit is not a step. */
    {
        /* The bark, and it is the bark that names the tree at fifty metres.
           The outer plate flakes off a plane in scales and leaves a pale
           cream-green underneath, so the trunk is piebald rather than brown —
           and no colour in a paint chip does mottling, which is why this is
           painted rather than tinted.

           Seamless in both directions, and the vertical one is the one that
           mattered. A trunk four metres long carries three tiles of this, so
           anything the drawing does differently at the top of the canvas from
           the bottom comes out as a band painted round the tree every metre
           and a half — which is exactly what the first cut of this did: it had
           a gradient of dirt at the foot, and every plane tree in the world
           wore three of them like rings on a sock. So there is no gradient,
           and every mark is drawn nine times, once for each way it can leave
           the tile. */
        const barkTex = tex(256, 512, (g, W, H) => {
            g.fillStyle = '#87897a'; g.fillRect(0, 0, W, H);
            const FLAKE = ['#b6b6a0', '#c4c2ac', '#9ba290', '#7a7e6e', '#6a6e60', '#a7ab94',
                           '#8b9179', '#5d6153', '#adae97'];
            const around = (draw) => {
                for (const ox of [-W, 0, W]) for (const oy of [-H, 0, H]) draw(ox, oy);
            };
            /* Two passes at two sizes. One pass of anything is a pattern; the
               plate that has just come off is a hand's width across and the
               weathering inside it is a thumbnail, and it is having both at
               once that stops this reading as camouflage. */
            for (const pass of [[150, 9, 26, 0.78], [300, 3, 9, 0.46]]) {
                for (let i = 0; i < pass[0]; i++) {
                    const x = rr(0, W), y = rr(0, H), r = rr(pass[1], pass[2]);
                    const col = pickOf(FLAKE), al = rr(0.22, pass[3]);
                    const shape = [];
                    for (let k = 0; k <= 9; k++) {
                        const a = k / 9 * 6.2832, q = r * rr(0.52, 1.0);
                        shape.push([Math.cos(a) * q, Math.sin(a) * q * 1.55]);
                    }
                    around((ox, oy) => {
                        g.globalAlpha = al; g.fillStyle = col;
                        g.beginPath();
                        shape.forEach((p, k) => (k ? g.lineTo(x + ox + p[0], y + oy + p[1])
                                                   : g.moveTo(x + ox + p[0], y + oy + p[1])));
                        g.closePath(); g.fill();
                    });
                }
            }
            g.globalAlpha = 1;
            // and the vertical grain the flakes sit in
            for (let i = 0; i < 220; i++) {
                const x = rr(0, W), y = rr(0, H), w2 = rr(1, 2), h2 = rr(24, 150);
                g.fillStyle = 'rgba(44,46,38,' + rr(0.03, 0.10).toFixed(3) + ')';
                around((ox, oy) => g.fillRect(x + ox, y + oy, w2, h2));
            }
        }, 1, 1);

        /* One clump of leaves, on nothing. Solid in the middle and thrown away
           towards the edge, so the alpha cut leaves a ragged leafy outline
           rather than a square one — which is the entire difference between
           this and the four spheres it replaces. */
        const leafTex = tex(768, 768, (g, S) => {
            g.clearRect(0, 0, S, S);
            const GREEN = ['#4e6d2c', '#5a7b32', '#688a3a', '#3d5a24', '#78924a', '#87a04d',
                           '#33501f', '#617d31', '#9aa953', '#446127', '#8d9c46'];
            /* Sixteen hundred of them, and the count is not decoration. One
               clump is four and a bit metres across when it is stood up, so a
               leaf drawn at a fortieth of this canvas is a leaf two thirds of
               a metre wide — which is what the first cut of this did, and from
               underneath it read as a cartoon. Twenty pixels of seven hundred
               and sixty-eight is eleven centimetres, which is a plane leaf. */
            for (let i = 0; i < 1600; i++) {
                const x = rr(0.02, 0.98) * S, y = rr(0.02, 0.98) * S;
                const d = Math.max(Math.abs(x / S - 0.5), Math.abs(y / S - 0.5)) * 2;
                if (rnd() < smoothstep(0.46, 1.00, d)) continue;
                g.save();
                g.translate(x, y); g.rotate(rnd() * 6.2832); g.scale(1, rr(0.72, 1.0));
                g.fillStyle = pickOf(GREEN);
                leafPath(g, rr(13, 24));
                g.fill();
                g.restore();
            }
        });

        /* The pit: stone edge, cast grate, an opening in the middle of it for
           the trunk, and the week's worth of leaves that have blown into the
           slots. */
        const pitTex = tex(256, 256, (g, S) => {
            const m = S * 0.085, c = S / 2, R = S * 0.40;
            g.fillStyle = '#9a978f'; g.fillRect(0, 0, S, S);            // the dressed edge
            for (let i = 0; i < 900; i++) {
                g.fillStyle = 'rgba(' + (rnd() < 0.55 ? '255,252,246,' : '38,38,36,') + (rnd() * 0.13).toFixed(3) + ')';
                g.fillRect(rnd() * S, rnd() * S, 2, 2);
            }
            g.fillStyle = 'rgba(0,0,0,.30)'; g.fillRect(m * 0.72, m * 0.72, S - m * 1.44, S - m * 1.44);
            g.save();
            g.beginPath(); g.rect(m, m, S - m * 2, S - m * 2); g.clip();
            g.fillStyle = '#6e716b'; g.fillRect(m, m, S - m * 2, S - m * 2);   // the casting
            g.strokeStyle = '#241f18'; g.lineCap = 'butt';
            g.lineWidth = S * 0.026;
            for (let k = 0; k < 30; k++) {                                     // and the slots in it
                const a = k / 30 * 6.2832;
                g.beginPath();
                g.moveTo(c + Math.cos(a) * R * 0.34, c + Math.sin(a) * R * 0.34);
                g.lineTo(c + Math.cos(a) * R * 1.9, c + Math.sin(a) * R * 1.9);
                g.stroke();
            }
            g.lineWidth = S * 0.024;
            for (const q of [0.55, 0.80, 1.06, 1.34]) { g.beginPath(); g.arc(c, c, R * q, 0, 6.2832); g.stroke(); }
            g.fillStyle = '#2b241b'; g.beginPath(); g.arc(c, c, S * 0.115, 0, 6.2832); g.fill();
            for (let i = 0; i < 9; i++) {                                      // what blew into it
                g.save();
                g.translate(rr(m, S - m), rr(m, S - m)); g.rotate(rnd() * 6.2832);
                g.fillStyle = pickOf(['#9c6a30', '#a8752f', '#7c5628', '#b8853f']);
                leafPath(g, rr(9, 16)); g.fill();
                g.restore();
            }
            g.restore();
            g.strokeStyle = 'rgba(0,0,0,.45)'; g.lineWidth = S * 0.014;
            g.strokeRect(m, m, S - m * 2, S - m * 2);
        });

        /* ---- where they stand ----

           Two kinds. A street tree gets a pit, stands two and a bit metres in
           from the kerb face and takes its place in a row; the rest — the
           cathedral's grounds, City Square, the Fed Square terrace, the grass
           on both banks of the river — are trees in ground and get none.

           The rows stop short of every intersection, because paint, kerb
           radius and four signal poles are what is on a corner, and they step
           over anything already standing on the kerb line. */
        const STREET = 1, GROUND = 0;
        const spots = [];

        // what is already bolted to the kerb: the tram poles up Swanston and
        // the ones along Flinders, from the block below
        const TAKEN = [];
        for (let i = 0; i < 6; i++) {
            const z = 20 + i * 26;
            TAKEN.push([-(SW + 1.4), z], [SW + 1.4, z], [-(SW + 1.4), -z], [SW + 1.4, -z]);
        }
        for (let i = 0; i < 5; i++) {
            const x = 22 + i * 26;
            TAKEN.push([x, -(FL + 1.4)], [x, FL + 1.4], [-x, -(FL + 1.4)], [-x, FL + 1.4]);
        }
        const clear = (x, z) => {
            for (const t of TAKEN) if (Math.abs(t[0] - x) < 2.6 && Math.abs(t[1] - z) < 3.4) return false;
            return true;
        };

        /* An avenue. The step is jittered rather than the position: a plane
           avenue read down a footpath is dead straight and near enough evenly
           spaced, and what varies from one tree to the next is the height, the
           crown and which way the trunk happens to face — not the line. */
        const avenue = (axis, at, from, to, gap) => {
            const dir = to > from ? 1 : -1;
            for (let s = from; (to - s) * dir > 0.5; s += dir * gap * rr(0.90, 1.10)) {
                const x = axis === 'z' ? at : s, z = axis === 'z' ? s : at;
                if (!clear(x, z)) continue;
                spots.push([x + rr(-0.20, 0.20), z + rr(-0.20, 0.20), STREET]);
            }
        };

        const TL = SW + 2.35;             // Swanston's tree line, off the street axis
        for (const s of [-1, 1]) {
            // north of Flinders, in three runs — one to each cross street
            avenue('z', s * TL, -26, -104, 7.8);
            avenue('z', s * TL, -126, -213, 7.8);
            avenue('z', s * TL, -246, -336, 7.8);
            // and south of it, as far as the bridge takes the footpath
            avenue('z', s * TL, 28, 116, 7.8);
        }
        // Flinders Street's own north footpath, east and west of the corner
        for (const s of [-1, 1]) avenue('x', -(FL + 2.1), s * 26, s * 148, 8.0);
        // and its south one east of the station entrance, clear of the opening
        // in the paving that the escalators go down through
        avenue('x', FL + 2.1, 40, 148, 8.0);

        // the three cross streets, out to where the frontages give up
        for (const st of NST) {
            const gap = st.tram ? 8.2 : 9.6, out = st.tram ? 132 : 104;
            for (const s of [-1, 1]) for (const d of [-1, 1]) {
                avenue('x', st.z + d * (st.h + 2.1), s * 24, s * out, gap);
            }
        }

        // and the ones that are not on a footpath at all
        const inGround = [];
        for (let i = 0; i < 8; i++) inGround.push([64 + rr(0, 44), -32 - rr(0, 56)]);   // the cathedral's grounds
        for (let i = 0; i < 4; i++) inGround.push([23.5 + i * 6.4, -136.5 + rr(-1.2, 1.2)]);  // City Square, the
        for (let i = 0; i < 4; i++) inGround.push([23.5 + i * 6.4, -199.0 + rr(-1.2, 1.2)]);  // two ends of it
        for (let i = 0; i < 3; i++) inGround.push([46.8, -132.0 - i * 4.6]);                  // and along the hotel
        for (let i = 0; i < 5; i++) inGround.push([78 + i * 9, 122 + rr(-3, 3)]);       // Fed Square's terrace
        for (let i = 0; i < 12; i++) inGround.push([-190 + i * 34, RIV_S + 11.5]);      // Southbank, in the grass
        for (let i = 0; i < 9; i++) inGround.push([-176 + i * 40, RIV_N - 1.5]);        // and the north bank wall
        for (const p of inGround) spots.push([p[0], p[1], GROUND]);

        /* ---- one tree, built once at thirteen and a half metres ---- */
        const TREE_H = 13.5;
        const bark = [];
        const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
        const UP = V3(0, 1, 0);
        /* A limb, from one point to another. Open-ended, because both ends of
           every one of these is inside something else and a cylinder's two
           caps are a third of its triangles. */
        const limb = (a, b, r0, r1, seg) => {
            const dir = new THREE.Vector3().subVectors(b, a);
            const len = dir.length();
            const g = new THREE.CylinderGeometry(r1, r0, len, seg, 1, true);
            g.translate(0, len / 2, 0);
            g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(UP, dir.normalize()));
            g.translate(a.x, a.y, a.z);
            // in metres, so a flake on a limb is the size of a flake on the
            // trunk. The bark tile is a metre round and 1.4 m up.
            uvScale(g, 6.2832 * (r0 + r1) / 2, len / 1.4);
            bark.push(g);
        };
        {
            // The flare at the foot, and it is one piece with the trunk above
            // it: two cylinders of different lengths carry the same texture at
            // two different rates, and the join between them reads as a ring
            // painted round the tree at chest height.
            const g = cylG(0.30, 0.45, 0.62, 9); put(g, 0, 0.28, 0);
            uvScale(g, 2.36, 0.44); bark.push(g);
        }
        limb(V3(0, 0.52, 0), V3(0.04, 4.66, 0.03), 0.30, 0.20, 9);
        {
            const g = sphG(0.25, 7, 5); put(g, 0.04, 4.70, 0.03);
            uvScale(g, 1.6, 1.0); bark.push(g);                      // the knuckle it breaks at
        }
        for (let i = 0; i < 4; i++) {
            const a = i / 4 * 6.2832 + 0.55;
            const out = rr(0.52, 0.80), L = rr(3.0, 3.9);
            const tip = V3(Math.cos(a) * L * out, 4.66 + L * 0.86, Math.sin(a) * L * out);
            limb(V3(0.03, 4.55, 0.03), tip, 0.175, 0.085, 6);
            for (let k = 0; k < 2; k++) {                            // and the second order off it
                const b2 = a + rr(-1.0, 1.0), L2 = rr(1.9, 2.9);
                limb(tip, V3(tip.x + Math.cos(b2) * L2 * 0.70, tip.y + L2 * 0.82,
                             tip.z + Math.sin(b2) * L2 * 0.70), 0.08, 0.032, 5);
            }
        }

        /* One clump: three cards in a star and one lying across them. The
           normals are the whole trick — every vertex is given the normal it
           would have on a sphere of the same size rather than the flat normal
           of the card it belongs to, so a clump shades like a ball of leaves
           instead of like four pieces of cardboard, and a crown full of them
           has no facets in it anywhere. */
        const card = (rx, ry) => {
            const g = new THREE.PlaneGeometry(2, 2, 1, 1);
            g.applyMatrix4(MX(0, 0, 0, rx, ry, 0));
            const pos = g.attributes.position, nrm = g.attributes.normal;
            const q = new THREE.Vector3();
            for (let i = 0; i < pos.count; i++) {
                q.set(pos.getX(i), pos.getY(i), pos.getZ(i)).multiplyScalar(0.60)
                 .addScaledVector(V3(nrm.getX(i), nrm.getY(i), nrm.getZ(i)), 0.92).normalize();
                nrm.setXYZ(i, q.x, q.y, q.z);
            }
            return g;
        };
        const clump = merge([card(0, 0), card(0, 1.0472), card(0, 2.0944), card(-Math.PI / 2, 0)]);

        const CLUMPS = 11;
        const street = spots.filter((p) => p[2] === STREET).length;
        const SHRUBS = Math.ceil(street * 0.36) * 3;

        const trunkIM = new THREE.InstancedMesh(
            merge(bark), stdMat(0xffffff, { map: barkTex, roughness: 0.88 }), spots.length);
        /* The emissive is not a light and is not a mistake. A leaf is thin
           enough to be lit through, so the underside of a canopy in the
           afternoon glows rather than going black — and a matte double-sided
           card cannot know that: the sun is behind every leaf you are standing
           under, so every one of them shades to nothing and the tunnel comes
           out as a hole. A little green added back is the cheapest honest
           answer, and it is well under the 0.80 the bloom pass watches for.

           The alpha cut is at a half rather than at the third it started on,
           and that is an artefact rather than a taste. A card seen edge-on is
           a sliver a pixel or two wide, and the filter fills that sliver by
           averaging half a metre of texture into it — so a third of a leaf's
           alpha survives the test all the way down the card and every tree in
           the avenue had two or three pale streaks hanging out of it. Cut at a
           half, the smear does not clear the bar and the crown does not lose
           anything it was keeping. */
        const leafIM = new THREE.InstancedMesh(clump, stdMat(0xffffff, {
            map: leafTex, alphaTest: 0.50, side: THREE.DoubleSide, roughness: 0.86,
            emissive: 0x4e6b2e, emissiveIntensity: 2.4,
        }), spots.length * CLUMPS + SHRUBS);
        const pitG = new THREE.PlaneGeometry(1.92, 1.92); pitG.rotateX(-Math.PI / 2);
        const pitIM = new THREE.InstancedMesh(
            pitG, stdMat(0xffffff, { map: pitTex, roughness: 0.82 }), street);

        const tint = new THREE.Color();
        let k = 0, np = 0;
        for (let i = 0; i < spots.length; i++) {
            const p = spots[i], onPath = p[2] === STREET;
            const x = p[0], z = p[1];
            const h = onPath ? rr(12.2, 17.4) : rr(9.5, 14.0);
            const s = h / TREE_H, y = onPath ? KERB_H + 0.01 : KERB_H;
            trunkIM.setMatrixAt(i, MX(x, y, z, 0, rr(0, 6.2832), 0, s, s, s));

            if (onPath) {
                pitIM.setMatrixAt(np++, MX(x, KERB_H + 0.030, z, 0, irr(0, 3) * 1.5708, 0));
            }

            /* The crown. Eleven clumps up the shell of a squashed sphere, the
               elevation stepped rather than drawn so no tree ever comes out
               with all eleven on one side of itself, and every one pulled in
               off the shell by its own amount so the outline is lumpy. */
            const cy = y + 9.0 * s, RH = 4.3 * s, RV = 3.3 * s;
            const spin = rr(0, 6.2832);
            const v0 = rr(0.72, 1.10), sat = rr(0.80, 1.0);
            for (let j = 0; j < CLUMPS; j++) {
                const a = spin + j * 2.39996 + rr(-0.24, 0.24);
                const el = clamp(-0.56 + 1.52 * (j + 0.5) / CLUMPS + rr(-0.10, 0.10), -0.72, 0.96);
                const w = Math.sqrt(Math.max(0, 1 - el * el)), f = rr(0.68, 0.96);
                const r = RH * rr(0.35, 0.50);
                leafIM.setMatrixAt(k, MX(x + Math.cos(a) * w * RH * f, cy + el * RV * f, z + Math.sin(a) * w * RH * f,
                                         0, rr(0, 6.2832), 0, r, r * 0.88, r));
                // a shade paler and yellower at the top, where the sun is
                const v = v0 * (1.0 + el * 0.14) * rr(0.94, 1.06);
                tint.setRGB(v * (1.02 + (1 - sat) * 0.3), v, v * sat * 0.86);
                leafIM.setColorAt(k, tint);
                k++;
            }
        }

        /* And a third of the street pits get a bed in them instead of bare
           grate — three low masses of the same leaf, which is what the
           photograph shows under about that many of the trees and what stops
           three hundred identical grates reading as three hundred stamps. */
        let sh = 0;
        for (let i = 0; i < spots.length && sh < SHRUBS; i++) {
            const p = spots[i];
            if (p[2] !== STREET || rnd() > 0.36) continue;
            for (let j = 0; j < 3 && sh < SHRUBS; j++) {
                const a = j / 3 * 6.2832 + rr(0, 2), d = rr(0.42, 0.66), r = rr(0.34, 0.50);
                leafIM.setMatrixAt(k, MX(p[0] + Math.cos(a) * d, KERB_H + 0.05 + r * 0.62, p[1] + Math.sin(a) * d,
                                         0, rr(0, 6.2832), 0, r, r * 0.80, r));
                const v = rr(0.62, 0.88);
                tint.setRGB(v * 0.92, v, v * 0.72);
                leafIM.setColorAt(k, tint);
                k++; sh++;
            }
        }
        // whatever is left over is parked inside the ground, where nothing sees
        // it — an InstancedMesh draws its whole count whether it is set or not,
        // and an unset matrix is the identity, which is a clump of leaves lying
        // in the middle of the crossing.
        for (; k < leafIM.count; k++) leafIM.setMatrixAt(k, MX(0, -60, 0, 0, 0, 0, 0.01, 0.01, 0.01));

        trunkIM.instanceMatrix.needsUpdate = true;
        leafIM.instanceMatrix.needsUpdate = true;
        pitIM.instanceMatrix.needsUpdate = true;
        if (leafIM.instanceColor) leafIM.instanceColor.needsUpdate = true;
        scene.add(trunkIM, leafIM, pitIM);
        world.ghost(trunkIM); world.ghost(leafIM); world.ghost(pitIM);
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

       Swanston crosses four streets inside this world — Flinders Street,
       Flinders Lane, Collins Street and Little Collins — and every one of them
       is signalised the way this city signalises an intersection: a lantern out
       on a mast arm over the approach lanes, a second one post-top on the
       near-left corner for the driver who has already pulled up under the first
       and can no longer see it, and on every corner a pedestrian lantern facing
       each crossing with its push button on the back of the same post.

       That is thirty-two vehicle heads and thirty-two pedestrian ones, and not
       one of them may be a mesh of its own. The posts, the arms and the button
       boxes merge per intersection into a single iron mesh; the housings are one
       InstancedMesh each; and every lit aspect in the world — red, amber, green,
       the standing figure and the walking one — is an instance carrying its own
       colour. Turning a signal green is writing three colours into a buffer,
       which is why the whole corridor costs eight meshes rather than two hundred.

       The aspect colours are written well above one and their materials are
       taken out of tone mapping, because these lanterns are the only surfaces
       here that are their own light source rather than something lit. They land
       in the half-float buffer at a luminance that clears the bloom threshold,
       and the halo comes back down the pipe for nothing. ---- */

    const CYCLE = 56.0;      // one cycle length for the whole corridor. Four
                             // controllers on four different lengths are four
                             // clocks that drift past each other; a coordinated
                             // street is one length and four offsets.
    const cum = (rows) => { let a = 0; for (const r of rows) { a += r.t; r.end = a; } return rows; };

    /* A phase says what each of the two streets is showing and what each of the
       two pedestrian movements is showing, and the pedestrian movement runs with
       the traffic beside it: the crossing over the cross street walks on
       Swanston's green, goes to flashing red for its clearance while that green
       is still running, and is at a steady red well before the amber. */
    const P_STD = cum([
        { ns: 'g', ew: 'r', pns: 'w', pew: 'd', t: 16.0 },
        { ns: 'g', ew: 'r', pns: 'c', pew: 'd', t: 6.0 },
        { ns: 'g', ew: 'r', pns: 'd', pew: 'd', t: 2.0 },
        { ns: 'y', ew: 'r', pns: 'd', pew: 'd', t: 3.5 },
        { ns: 'r', ew: 'r', pns: 'd', pew: 'd', t: 1.5 },
        { ns: 'r', ew: 'g', pns: 'd', pew: 'w', t: 14.0 },
        { ns: 'r', ew: 'g', pns: 'd', pew: 'c', t: 6.0 },
        { ns: 'r', ew: 'g', pns: 'd', pew: 'd', t: 2.0 },
        { ns: 'r', ew: 'y', pns: 'd', pew: 'd', t: 3.5 },
        { ns: 'r', ew: 'r', pns: 'd', pew: 'd', t: 1.5 },
    ]);

    /* Flinders and Swanston is the exception, and has been since 2013: it is a
       scramble, so the two pedestrian movements do not run with anybody's green.
       They wait, and then everything on wheels is held while the whole
       intersection belongs to the crowd, diagonals included. */
    const P_SCR = cum([
        { ns: 'g', ew: 'r', pns: 'd', pew: 'd', t: 14.0 },
        { ns: 'y', ew: 'r', pns: 'd', pew: 'd', t: 3.5 },
        { ns: 'r', ew: 'r', pns: 'd', pew: 'd', t: 1.5 },
        { ns: 'r', ew: 'g', pns: 'd', pew: 'd', t: 12.0 },
        { ns: 'r', ew: 'y', pns: 'd', pew: 'd', t: 3.5 },
        { ns: 'r', ew: 'r', pns: 'd', pew: 'd', t: 1.5 },
        { ns: 'r', ew: 'r', pns: 'w', pew: 'w', t: 14.0, scr: 1 },
        { ns: 'r', ew: 'r', pns: 'c', pew: 'c', t: 6.0 },
    ]);

    /* The offsets are the whole point of a corridor. A hundred and fifteen
       metres at the fifty a tram actually holds between stops is a little over
       ten seconds, so each intersection north of Flinders Street takes its green
       ten and a half seconds after the one south of it and a northbound tram
       meets a progression rather than a wall. Southbound traffic pays for it,
       which is exactly what happens on the real street in the evening peak.

       Alexandra Avenue is the one south of Flinders Street, so its offset is
       the same step the other way: a tram or a car coming off the bridge into
       the city meets Flinders Street's green two hundred and sixty metres
       later, which at the thirty-odd a vehicle holds over the deck is about
       the ten and a half seconds that separates the two. */
    const XSEC = [
        { z: 0, h: FL, table: P_SCR, off: 0.0 },
        { z: NST[0].z, h: NST[0].h, table: P_STD, off: 10.5 },
        { z: NST[1].z, h: NST[1].h, table: P_STD, off: 21.0 },
        { z: NST[2].z, h: NST[2].h, table: P_STD, off: 31.5 },
        { z: SKR.z, h: SKR.h, table: P_STD, off: -10.5 },
    ];
    for (const X of XSEC) { X.ns = 'r'; X.ew = 'r'; X.pns = 'd'; X.pew = 'd'; X.scr = 0; X.left = 0; X.code = -1; }

    // Which intersection a thing running east–west is standing at. Nothing in
    // this world ever changes streets, so four comparisons a frame is cheaper
    // than the bookkeeping it would take to avoid them.
    const xsecAt = (z) => {
        let best = XSEC[0], bd = 1e9;
        for (let i = 0; i < XSEC.length; i++) { const d = Math.abs(XSEC[i].z - z); if (d < bd) { bd = d; best = XSEC[i]; } }
        return best;
    };

    /* What a driver may do about the next lantern in front of them. A red or an
       amber inside the approach is a braking curve down to the stop line; an
       amber already under the nose is not, because a car that stands on the
       brakes at a metre and a half from the line is a car that has stopped in
       the intersection. Swanston reads all four intersections, since a car
       running north up it meets every one of them. */
    const STOP_LOOK = 48;
    const vehTarget = (ax, dir, s, off, vmax) => {
        let target = vmax;
        if (ax === 'z') {
            for (let i = 0; i < XSEC.length; i++) {
                const X = XSEC[i];
                if (X.ns === 'g') continue;
                const d = dir * (X.z - dir * (X.h + STOPL) - s);
                if (d < -0.8 || d > STOP_LOOK) continue;
                if (X.ns === 'y' && d < 6) continue;
                const cap = Math.max(0, (d - 0.6) * 0.55);
                if (cap < target) target = cap;
            }
        } else {
            const X = xsecAt(off);
            if (X.ew !== 'g') {
                const d = dir * (-dir * (SW + STOPL) - s);
                if (d > -0.8 && d < STOP_LOOK && !(X.ew === 'y' && d < 6)) {
                    const cap = Math.max(0, (d - 0.6) * 0.55);
                    if (cap < target) target = cap;
                }
            }
        }
        return target;
    };

    /* The aspects themselves, as colours rather than as textures, because the
       lit one is chosen per instance and an instance cannot have a map of its
       own. Each is scaled so its luminance lands a little over the bloom
       threshold of 0.80 — a red lantern with no halo at dusk looks painted on. */
    const ASP = {
        red: new THREE.Color(4.40, 0.35, 0.14),
        amber: new THREE.Color(2.60, 1.05, 0.08),
        green: new THREE.Color(0.30, 1.55, 0.55),
        stand: new THREE.Color(3.60, 0.30, 0.12),
        walk: new THREE.Color(0.30, 1.45, 0.52),
        off: new THREE.Color(0.020, 0.018, 0.015),
    };

    let sigHeadIM, sigAspIM, plHeadIM, plStandIM, plWalkIM;
    {
        // The lens, hot in the middle the way a lit one is and dark at the rim
        // where the cowl shades it. One map for ninety-six aspects; the colour
        // is the instance's business.
        const lensTex = tex(64, 64, (g, W, H) => {
            g.fillStyle = '#000000'; g.fillRect(0, 0, W, H);
            const rg = g.createRadialGradient(W * 0.5, H * 0.46, 0, W * 0.5, H * 0.5, W * 0.5);
            rg.addColorStop(0.00, '#ffffff');
            rg.addColorStop(0.42, '#e6e6e6');
            rg.addColorStop(0.86, '#6e6e6e');
            rg.addColorStop(1.00, '#141414');
            g.fillStyle = rg;
            g.beginPath(); g.arc(W * 0.5, H * 0.5, W * 0.5, 0, 6.3); g.fill();
        });
        // And the two figures, drawn as flatly as the real ones are: a man
        // standing with his feet together, and the same man mid-stride.
        const figTex = (walking) => tex(64, 96, (g, W, H) => {
            g.fillStyle = '#000000'; g.fillRect(0, 0, W, H);
            g.fillStyle = '#ffffff';
            g.beginPath(); g.arc(W * 0.50, H * 0.20, W * 0.115, 0, 6.3); g.fill();
            if (walking) {
                g.fillRect(W * 0.40, H * 0.30, W * 0.22, H * 0.27);
                g.fillRect(W * 0.20, H * 0.34, W * 0.21, H * 0.075);
                g.fillRect(W * 0.61, H * 0.39, W * 0.19, H * 0.075);
                g.fillRect(W * 0.25, H * 0.56, W * 0.17, H * 0.26);
                g.fillRect(W * 0.55, H * 0.56, W * 0.17, H * 0.26);
                g.fillRect(W * 0.19, H * 0.79, W * 0.16, H * 0.06);
                g.fillRect(W * 0.62, H * 0.79, W * 0.16, H * 0.06);
            } else {
                g.fillRect(W * 0.38, H * 0.30, W * 0.24, H * 0.29);
                g.fillRect(W * 0.25, H * 0.32, W * 0.12, H * 0.25);
                g.fillRect(W * 0.63, H * 0.32, W * 0.12, H * 0.25);
                g.fillRect(W * 0.39, H * 0.58, W * 0.10, H * 0.27);
                g.fillRect(W * 0.51, H * 0.58, W * 0.10, H * 0.27);
            }
        });

        /* three only lets an InstancedMesh's per-instance colour reach the
           fragment when the material declares vertexColors — and a material
           that declares it over geometry with no colour attribute draws every
           instance black, because a missing attribute reads as zero. So the
           aspect geometry carries a white one, and the instance colour is the
           only thing that decides what any of these lanterns is showing. */
        const white = (g) => {
            const n = g.attributes.position.count;
            const a = new Float32Array(n * 3); a.fill(1);
            g.setAttribute('color', new THREE.BufferAttribute(a, 3));
            return g;
        };
        const litMat = (map) => new THREE.MeshBasicMaterial({
            color: 0xffffff, map, vertexColors: true, toneMapped: false,
        });

        const CASE = stdMat(0x1e2226, { roughness: 0.50, metalness: 0.36 });

        // the three-aspect vehicle head, its cap and its three cowls
        const headParts = [];
        let g = boxG(0.42, 1.34, 0.26); headParts.push(g);
        g = boxG(0.50, 0.07, 0.12); put(g, 0, 0.70, 0.05); headParts.push(g);
        for (const y of [0.44, 0.0, -0.44]) { g = boxG(0.42, 0.05, 0.19); put(g, 0, y + 0.19, 0.15); headParts.push(g); }
        g = boxG(0.11, 0.18, 0.16); put(g, 0, 0, -0.19); headParts.push(g);
        const headG = merge(headParts);

        // and the two-aspect pedestrian one, which is squarer and lower
        const plParts = [];
        g = boxG(0.40, 0.76, 0.24); plParts.push(g);
        g = boxG(0.46, 0.07, 0.11); put(g, 0, 0.41, 0.04); plParts.push(g);
        for (const y of [0.17, -0.17]) { g = boxG(0.40, 0.05, 0.17); put(g, 0, y + 0.20, 0.14); plParts.push(g); }
        g = boxG(0.11, 0.16, 0.15); put(g, 0, 0, -0.18); plParts.push(g);
        const plG = merge(plParts);

        // Everything below is written in the frame of the person the lantern is
        // talking to: it faces local +z and the mast arm reaches local +x. One
        // description, turned four ways, stands up every approach in the world.
        const at = (px, pz, yaw, lx, ly, lz) => {
            _e.set(0, yaw, 0);
            _v.set(lx, 0, lz).applyEuler(_e);
            return MX(px + _v.x, ly, pz + _v.z, 0, yaw, 0);
        };

        const HEADS = [], ASPECTS = [], PLHEADS = [], FIGS = [];
        for (let i = 0; i < XSEC.length; i++) {
            const X = XSEC[i];
            const iron = [];

            /* The four approaches, each signalled from the corner on its own
               left, because that is the kerb an Australian driver stops beside
               and the arm has to reach out over the lanes from somewhere. */
            const app = [
                { x: (SW + 1.1), z: X.z - (X.h + 2.0), yaw: Math.PI, reach: SW * 0.90 },
                { x: -(SW + 1.1), z: X.z + (X.h + 2.0), yaw: 0, reach: SW * 0.90 },
                { x: -(SW + 2.0), z: X.z - (X.h + 1.1), yaw: -Math.PI / 2, reach: X.h * 0.90 },
                { x: (SW + 2.0), z: X.z + (X.h + 1.1), yaw: Math.PI / 2, reach: X.h * 0.90 },
            ];
            for (const a of app) {
                const M0 = MX(a.x, KERB_H, a.z, 0, a.yaw, 0);
                g = cylG(0.13, 0.17, 6.6, 10); put(g, 0, 3.30, 0); carry(iron, g, M0);
                g = cylG(0.26, 0.30, 0.50, 10); put(g, 0, 0.25, 0); carry(iron, g, M0);
                g = boxG(a.reach, 0.15, 0.15); put(g, a.reach * 0.5, 6.45, 0); carry(iron, g, M0);
                g = boxG(1.30, 0.09, 0.09); put(g, 0.46, 6.00, 0, 0, 0, 0.62); carry(iron, g, M0);
                // the head out over the roadway, and the post-top secondary
                for (const h of [[a.reach - 0.80, KERB_H + 5.75, 0.0], [0.0, KERB_H + 3.55, 0.31]]) {
                    HEADS.push(at(a.x, a.z, a.yaw, h[0], h[1], h[2]));
                    for (const dy of [0.44, 0.0, -0.44]) ASPECTS.push(at(a.x, a.z, a.yaw, h[0], h[1] + dy, h[2] + 0.14));
                }
            }

            /* Four corners, and on each of them a lantern down each of the two
               crossings that corner touches — facing the far end, because the
               lantern a person reads is the one on the other side of the road,
               and the button they press is on the post beside them. */
            for (let lc = 0; lc < 4; lc++) {
                const sx = (lc === 0 || lc === 3) ? -1 : 1, sz = (lc < 2) ? -1 : 1;
                const cx = sx * (SW + 2.4), cz = X.z + sz * (X.h + 2.4);
                g = cylG(0.10, 0.13, 3.00, 8); put(g, cx, KERB_H + 1.50, cz); iron.push(g);
                g = cylG(0.22, 0.24, 0.40, 8); put(g, cx, KERB_H + 0.20, cz); iron.push(g);
                // q 0 is the crossing over Swanston, q 1 the one over the cross
                // street, and the frame loop leans on that order
                for (let q = 0; q < 2; q++) {
                    const yaw = q === 0 ? -sx * Math.PI / 2 : (sz > 0 ? Math.PI : 0);
                    PLHEADS.push(at(cx, cz, yaw, 0, KERB_H + 2.44, 0.21));
                    FIGS.push(at(cx, cz, yaw, 0, KERB_H + 2.60, 0.34), at(cx, cz, yaw, 0, KERB_H + 2.28, 0.34));
                    const B = MX(cx, KERB_H, cz, 0, yaw, 0);
                    g = boxG(0.18, 0.32, 0.15); put(g, 0, 1.06, -0.20); carry(iron, g, B);
                    g = cylG(0.05, 0.05, 0.07, 8); put(g, 0, 0, -0.04, Math.PI / 2, 0, 0);
                    put(g, 0, 1.10, -0.28); carry(iron, g, B);
                }
            }

            const post = merged(iron, MATS.iron);
            scene.add(post);
            world.part('signal_0' + i, post);
        }

        sigHeadIM = new THREE.InstancedMesh(headG, CASE, HEADS.length);
        HEADS.forEach((m, k) => sigHeadIM.setMatrixAt(k, m));
        sigAspIM = new THREE.InstancedMesh(white(new THREE.CircleGeometry(0.125, 16)), litMat(lensTex), ASPECTS.length);
        ASPECTS.forEach((m, k) => { sigAspIM.setMatrixAt(k, m); sigAspIM.setColorAt(k, ASP.off); });
        plHeadIM = new THREE.InstancedMesh(plG, CASE, PLHEADS.length);
        PLHEADS.forEach((m, k) => plHeadIM.setMatrixAt(k, m));
        plStandIM = new THREE.InstancedMesh(white(new THREE.PlaneGeometry(0.26, 0.34)), litMat(figTex(false)), PLHEADS.length);
        plWalkIM = new THREE.InstancedMesh(white(new THREE.PlaneGeometry(0.26, 0.34)), litMat(figTex(true)), PLHEADS.length);
        for (let k = 0; k < PLHEADS.length; k++) {
            plStandIM.setMatrixAt(k, FIGS[k * 2]); plStandIM.setColorAt(k, ASP.off);
            plWalkIM.setMatrixAt(k, FIGS[k * 2 + 1]); plWalkIM.setColorAt(k, ASP.off);
        }
        for (const m of [sigHeadIM, sigAspIM, plHeadIM, plStandIM, plWalkIM]) {
            m.instanceMatrix.needsUpdate = true;
            if (m.instanceColor) m.instanceColor.needsUpdate = true;
            scene.add(m);
            world.ghost(m);          // the posts collide; the lanterns on them need not
        }
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

       A-class (Comeng, Dandenong, 1984–87): 16.64 m over the body, 2.67 m
       wide, roof 3.22 m above rail, three doorways a side, bogies at the
       quarter points. The real ones are single-ended, with a cab at one end
       and a blank back at the other. These are not: somebody asked to be able
       to walk round one and have it read the same from every side, so the car
       here is built double-ended — cab, raked screen, destination box, bumper,
       headlights and tail lamps at both ends — and mirror-symmetric across its
       centreline, with the same three doorways on each flank. Every end piece
       is drawn once at +Z and cloned through a half turn to -Z, so the two
       ends agree to the millimetre rather than to the eye.

       Nine cars for twenty-five meshes, where eight used to cost fifty-six.
       The shell, the dark work, the lamps, the saloon fittings, the saloon
       floor and the twelve sliding door leaves are all one geometry each, and
       every car is one more matrix in six InstancedMeshes. What stays private
       to a car is what says which car it is: the flanks with its fleet number
       painted on and the two destination boxes. That is one body and one
       display each, and everything else is shared.
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

    const TRAM_L = 16.64, TRAM_W = 2.67, TRAM_FLOOR = 0.88, TRAM_ROOF = 3.22;
    const TRAM_BH = TRAM_ROOF - TRAM_FLOOR;
    const DOOR_W = 1.34;                       // clear width of one double doorway
    const DOOR_Z = [-TRAM_L * 0.32, 0, TRAM_L * 0.32];
    const LEAF_W = DOOR_W / 2 - 0.01;

    /* ---- the shell: everything outside the glass, built once -------------
       Two buckets, white and dark, because a wet A-class is exactly two
       colours plus its livery, and two merges is two draw calls for nine
       trams. The lamps are a third, emissive, reading three cells out of one
       strip so a headlight, an indicator and a tail lamp cost one material. */
    const tramShell = () => {
        const white = [], dark = [], lamps = [];
        const L = TRAM_L, W = TRAM_W, ROOF = TRAM_ROOF, FZ = L / 2;
        let g;

        // the roof crown, and the rain gutter that runs the whole length
        g = boxG(W - 0.16, 0.10, L - 0.9); put(g, 0, ROOF + 0.045, 0); white.push(g);
        g = boxG(W + 0.04, 0.08, L - 0.7); put(g, 0, ROOF - 0.075, 0); dark.push(g);

        /* One end, at +Z. It goes into the world twice, the second time turned
           through half a circle — which is the cheapest possible guarantee
           that the back of this tram is the front of it. */
        const eW = [], eD = [], eL = [];
        {
            const wsB = 1.62, wsT = 2.76, SET = 0.30;
            const rake = Math.atan2(SET, wsT - wsB), wsL = Math.hypot(wsT - wsB, SET);
            let q;
            // the full-height wraparound screen, raked back, and its rubber
            q = boxG(W - 0.38, wsL, 0.05); put(q, 0, (wsB + wsT) / 2, FZ - SET / 2 + 0.07, -rake); eD.push(q);
            q = boxG(W - 0.30, wsL + 0.10, 0.03); put(q, 0, (wsB + wsT) / 2, FZ - SET / 2 + 0.03, -rake); eD.push(q);
            q = boxG(0.04, 1.02, 0.03); put(q, -0.26, (wsB + wsT) / 2 - 0.10, FZ - SET / 2 + 0.11, -rake, 0, 0.58); eD.push(q);
            // the soffit closing the wedge over the screen, the fascia, and
            // the black box the destination reads out of
            q = boxG(W - 0.32, 0.11, 0.36); put(q, 0, wsT + 0.05, FZ - 0.18); eW.push(q);
            q = boxG(W - 0.06, 0.15, 0.12); put(q, 0, 2.89, FZ + 0.03); eW.push(q);
            q = boxG(W - 0.22, 0.32, 0.09); put(q, 0, 3.06, FZ + 0.05); eD.push(q);
            q = boxG(W - 0.02, 0.11, 0.24); put(q, 0, ROOF - 0.03, FZ - 0.05); eW.push(q);
            // the front corners, taken off at forty-five degrees
            for (const s of [-1, 1]) {
                q = boxG(0.26, ROOF - 1.02, 0.26);
                put(q, s * (W / 2 - 0.19), (1.02 + ROOF) / 2, FZ - 0.10, 0, s * Math.PI / 4, 0);
                eW.push(q);
            }
            // the black rubber bumper, and a light cluster either side of it
            q = boxG(W + 0.02, 0.26, 0.30); put(q, 0, 0.78, FZ + 0.02); eD.push(q);
            q = boxG(W - 0.04, 0.13, 0.36); put(q, 0, 0.60, FZ + 0.00); eD.push(q);
            for (const s of [-1, 1]) {
                const cx = s * (W / 2 - 0.44);
                q = boxG(0.68, 0.30, 0.06); put(q, cx, 1.08, FZ + 0.04); eD.push(q);
                q = uvCell(new THREE.PlaneGeometry(0.18, 0.20), 3, 0); put(q, cx - s * 0.20, 1.08, FZ + 0.08); eL.push(q);
                q = uvCell(new THREE.PlaneGeometry(0.15, 0.20), 3, 1); put(q, cx + s * 0.20, 1.08, FZ + 0.08); eL.push(q);
                q = uvCell(new THREE.PlaneGeometry(0.15, 0.20), 3, 2); put(q, cx, 1.08, FZ + 0.08); eL.push(q);
            }
            q = boxG(0.34, 0.30, 0.44); put(q, 0, 0.50, FZ - 0.18); eD.push(q);      // the coupler pocket
        }
        for (const e of [1, -1]) {
            const R = MX(0, 0, 0, 0, e > 0 ? 0 : Math.PI, 0);
            for (const q of eW) white.push(q.clone().applyMatrix4(R));
            for (const q of eD) dark.push(q.clone().applyMatrix4(R));
            for (const q of eL) lamps.push(q.clone().applyMatrix4(R));
        }

        // ---- the skirt, and the two bogies showing under it
        g = boxG(W - 0.08, 0.48, L - 2.2); put(g, 0, 0.62, 0); dark.push(g);
        for (const s of [-1, 1]) {
            const bz = s * L * 0.285;
            g = boxG(2.16, 0.44, 2.7); put(g, 0, 0.56, bz); dark.push(g);
            g = boxG(1.2, 0.30, 1.5); put(g, 0, 0.40, bz); dark.push(g);
            for (const a of [-1, 1]) for (const b of [-1, 1]) {
                g = cylG(0.33, 0.33, 0.11, 12); put(g, a * 0.72, 0.33, bz + b * 0.95, 0, 0, Math.PI / 2); dark.push(g);
                g = cylG(0.20, 0.20, 0.13, 10); put(g, a * 0.62, 0.33, bz + b * 0.95, 0, 0, Math.PI / 2); dark.push(g);
            }
            g = boxG(1.7, 0.16, 0.5); put(g, 0, 0.20, bz); dark.push(g);
            // and an air-conditioning pod over each bogie, which is the other
            // half of making the roof read the same whichever end you are at
            g = boxG(1.62, 0.32, 2.10); put(g, 0, ROOF + 0.26, s * L * 0.27); dark.push(g);
            g = boxG(1.46, 0.06, 1.92); put(g, 0, ROOF + 0.45, s * L * 0.27); white.push(g);
        }

        // ---- the single-arm pantograph, amidships, reaching for the wire
        {
            const py = ROOF + 0.11, TOP = WIRE_H - py - 0.06;
            const kneeY = TOP * 0.58, kneeZ = 0.05, pz0 = 0;
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
        return { white, dark, lamps };
    };

    /* ---- the saloon -----------------------------------------------------
       Cream-beige panels and window surrounds, a pale perforated ceiling with
       the fluorescents recessed along it, a deep blue floor, grey under the
       windows, green transverse pairs in moquette with a moulded grab across
       the top of every back, bright green stanchions floor to ceiling with
       grabs branching off them and loops hanging from the rail, yellow myki
       readers on blue ovals at chest height, red stop buttons, the blue cab
       doors with their white graphics, a convex mirror at each end and route
       and notice boards on the panels.

       Two buckets, and the split is not cosmetic. `floor` is the saloon's
       floor and its two cab bulkheads, and on the car parked at Stop 13 that
       one mesh is the only thing in the whole tram that collides — it is what
       somebody stands on. `fit` is everything else in here and is ghosted on
       every car, because the walk's grid at this stop is 1.46 m to a cell and
       a seat left solid in it would swallow the aisle whole and leave people
       walking down the tram on top of the seat backs. */
    const tramSaloon = () => {
        const fit = [], floor = [];
        const L = TRAM_L, IX = 1.19, IZ = 6.86, FL = 0.95, CL = 3.03;
        const zOf = (u) => (u - 0.5) * L;
        let g;

        g = boxG(IX * 2, 0.07, IZ * 2); put(g, 0, FL - 0.035, 0); floor.push(atl(g, 2, 0));
        for (const s of [-1, 1]) {
            g = boxG(IX * 2, CL - FL, 0.10); put(g, 0, (FL + CL) / 2, s * (IZ + 0.05));
            floor.push(atl(g, 0, 0));
        }

        // ceiling, and the two recessed fluorescent runs down the length of it
        g = boxG(IX * 2 - 0.06, 0.05, IZ * 2 - 0.10); put(g, 0, CL + 0.025, 0); fit.push(atl(g, 3, 0));
        for (const s of [-1, 1]) {
            g = boxG(0.22, 0.04, IZ * 2 - 1.30); put(g, s * 0.60, CL - 0.015, 0); fit.push(atl(g, 4, 0));
        }

        /* The lining. The body box is drawn from outside, so from in here its
           walls are not there at all — backfaces, culled — and without this
           you would stand in the saloon looking straight through the wall at
           your elbow. It is built in the runs between the three doorways,
           because a doorway is a hole right through the car. */
        const SEG = [];
        {
            let a = -IZ + 0.06;
            for (const dz of DOOR_Z) {
                const d0 = dz - DOOR_W / 2, d1 = dz + DOOR_W / 2;
                if (d0 > a) SEG.push([a, Math.min(d0, IZ - 0.06)]);
                if (d1 > a) a = d1;
            }
            if (IZ - 0.06 > a) SEG.push([a, IZ - 0.06]);
        }
        for (const s of [-1, 1]) for (const seg of SEG) {
            const zc = (seg[0] + seg[1]) / 2, zl = seg[1] - seg[0];
            if (zl < 0.05) continue;
            g = boxG(0.05, 0.83, zl); put(g, s * IX, 1.385, zc); fit.push(atl(g, 1, 0));
            g = boxG(0.08, 0.15, zl); put(g, s * (IX - 0.015), 1.875, zc); fit.push(atl(g, 5, 2));
            g = boxG(0.08, 0.12, zl); put(g, s * (IX - 0.015), 2.680, zc); fit.push(atl(g, 5, 2));
            g = boxG(0.05, 0.29, zl); put(g, s * IX, 2.885, zc); fit.push(atl(g, 0, 0));
        }
        /* and a pillar in every gap the openings leave in the window band, so
           the strip of body between two windows is body from both sides. */
        {
            const OPEN = [CAB_U, [1 - CAB_U[1], 1 - CAB_U[0]]].concat(WIN_U).concat(DOOR_U)
                .slice().sort((a, b) => a[0] - b[0]);
            for (let i = 0; i <= OPEN.length; i++) {
                const u0 = i === 0 ? 0 : OPEN[i - 1][1], u1 = i === OPEN.length ? 1 : OPEN[i][0];
                const z0 = Math.max(zOf(u0), -IZ + 0.06), z1 = Math.min(zOf(u1), IZ - 0.06);
                if (z1 - z0 < 0.04) continue;
                for (const s of [-1, 1]) {
                    g = boxG(0.05, 0.67, z1 - z0); put(g, s * IX, 2.285, (z0 + z1) / 2);
                    fit.push(atl(g, 0, 0));
                }
            }
        }

        /* Transverse pairs, facing the end of the car they are nearest, which
           is what a double-ended tram does with its seats. Moquette on the
           faces you sit against, a grey moulded shell behind them, and the
           green grab moulded across the top of every back — the thing you
           actually hold on an A-class, before you ever reach a pole. */
        const ROWS = [-6.30, -4.10, -3.22, -2.34, -1.46, 1.46, 2.34, 3.22, 4.10, 6.30];
        for (const z of ROWS) {
            const f = z < 0 ? -1 : 1;
            for (const s of [-1, 1]) {
                const x = s * 0.72;
                g = boxG(0.90, 0.09, 0.46); put(g, x, 1.360, z); fit.push(atl(g, 5, 0));
                g = boxG(0.92, 0.17, 0.07); put(g, x, 1.265, z + f * 0.245); fit.push(atl(g, 6, 0));
                g = boxG(0.88, 0.54, 0.06); put(g, x, 1.680, z - f * 0.235); fit.push(atl(g, 5, 0));
                g = boxG(0.92, 0.66, 0.07); put(g, x, 1.720, z - f * 0.300); fit.push(atl(g, 6, 0));
                g = boxG(0.80, 0.055, 0.10); put(g, x, 2.035, z - f * 0.290); fit.push(atl(g, 7, 0));
                g = boxG(0.12, 0.36, 0.28); put(g, x, 1.130, z); fit.push(atl(g, 6, 0));
            }
        }

        // stanchions, the grabs branching off their tops, the rail they run
        // under and the loops hanging from it
        const POLE_Z = [-6.00, -4.55, -0.95, 0.95, 4.55, 6.00];
        for (const s of [-1, 1]) {
            for (const z of POLE_Z) {
                g = cylG(0.024, 0.024, CL - FL, 8); put(g, s * 0.31, (FL + CL) / 2, z); fit.push(atl(g, 7, 0));
                g = boxG(0.34, 0.05, 0.05); put(g, s * 0.48, 2.880, z); fit.push(atl(g, 7, 0));
            }
            g = cylG(0.026, 0.026, IZ * 2 - 1.6, 8); put(g, s * 0.31, 2.880, 0, Math.PI / 2);
            fit.push(atl(g, 7, 0));
            for (const z of [-5.30, -3.60, -1.90, 1.90, 3.60, 5.30]) {
                g = boxG(0.022, 0.17, 0.03); put(g, s * 0.31, 2.780, z); fit.push(atl(g, 7, 0));
                g = new THREE.TorusGeometry(0.062, 0.011, 4, 10);
                put(g, s * 0.31, 2.630, z, 0, Math.PI / 2, 0); fit.push(atl(g, 7, 0));
            }
            // the myki readers: a yellow reader on a blue oval, at chest height
            for (const z of [-4.55, 0.95, 4.55]) {
                g = cylG(0.19, 0.19, 0.03, 14); put(g, s * 0.265, 1.440, z, 0, 0, Math.PI / 2, 1.3, 1, 1);
                fit.push(atl(g, 1, 1));
                g = boxG(0.09, 0.20, 0.15); put(g, s * 0.200, 1.460, z); fit.push(atl(g, 0, 1));
                g = boxG(0.05, 0.06, 0.05); put(g, s * 0.310, 1.640, z); fit.push(atl(g, 5, 1));
            }
            // a red lamp over each doorway, and the posters on the panels
            for (const dz of DOOR_Z) {
                g = boxG(0.09, 0.05, 0.14); put(g, s * (IX - 0.05), 2.740, dz); fit.push(atl(g, 5, 1));
            }
            g = boxG(0.03, 0.30, 0.52); put(g, s * (IX - 0.035), 2.860, -3.05); fit.push(atl(g, 3, 1));
            g = boxG(0.03, 0.30, 0.52); put(g, s * (IX - 0.035), 2.860, 3.05); fit.push(atl(g, 4, 1));
        }
        // the blue cab doors in the bulkheads, and a convex mirror at each end
        for (const s of [-1, 1]) {
            g = boxG(0.78, 1.92, 0.05); put(g, 0, 1.910, s * (IZ - 0.02)); fit.push(atl(g, 2, 1));
            g = boxG(0.03, 0.03, 0.24); put(g, s * 1.02, 2.720, s * (IZ - 0.78)); fit.push(atl(g, 7, 2));
            g = sphG(0.15, 10, 6); put(g, s * 1.02, 2.720, s * (IZ - 0.62)); fit.push(atl(g, 6, 1));
        }

        /* The saloon is empty, and lit. Seven sitting and three standing used
           to ride in every car; they have gone the way of everybody else in
           this world. What is left is a tram at twenty to five with its lights
           on and nobody aboard, which is its own kind of true. */
        return { fit, floor };
    };

    // The materials. Four for the car and one for its leaves, shared by every
    // tram in the world — which is the whole reason the instancing works.
    const tramWhiteM = stdMat(0xf3f5f1, { roughness: 0.22, metalness: 0.10 });
    // The screen rides with the skirt and the bogies. On a day like this they
    // are all the same wet dark grey, and nine cars is one mesh.
    const tramDarkM = stdMat(0x232a30, { roughness: 0.22, metalness: 0.44 });
    const tramLampM = emissive(0xffffff, 0xffffff, 2.8, {
        map: lampCellTex, emissiveMap: lampCellTex, roughness: 0.3,
    });
    /* 0.40, and the number matters. The saloon has to be a warm lit box behind
       wet glass without becoming a white hole: read twice — once as albedo and
       once as emission — the cream panels land near 0.45 and only the
       fluorescent strips reach the 0.80 bloom threshold, so the strips flare a
       little and nothing else does, and the bloom pass is left for the things
       that are meant to have it: the destination boxes, the headlights, the
       signals and the billboards up the street. The first pass at this ran at
       0.62, which made a saloon nobody could look at. */
    const tramIntM = emissive(0xffffff, 0xffffff, 0.40, {
        map: interiorAtlas, emissiveMap: interiorAtlas, roughness: 0.76,
    });
    const tramLeafM = stdMat(0xffffff, { map: doorLeafTex, roughness: 0.28, metalness: 0.08 });

    /* ---- the fleet ------------------------------------------------------
       Ten running and one standing. The one standing is at Stop 13 with its
       doors open, and it is standing for a reason that is not scenery: see
       section 20, where the walk's floor is worked out.

       A car stabled across a road closes that road, so the service runs on the
       other one. The northbound track through Stop 13 belongs to 272 and to
       nothing else; the eight going north share the southbound track up
       Swanston and the two tracks along Flinders.

       The last two are southbound over Princes Bridge, and they are the reason
       the run range became a per-car thing. A southbound car on the northbound
       track meets 272 standing at Stop 13 and queues behind it for the rest of
       the afternoon, because 272 is never going to move — so these two are
       given a run of their own that begins south of it, at 84, and ends out on
       St Kilda Road. Nothing about that is visible from the bridge, which is
       where anybody watching them is standing. */
    const TRAM_DEFS = [
        { ax: 'z', dir: -1, s: 96, fleet: 2071, route: '3', dest: 'MELB UNI', via: 'SWANSTON ST' },
        { ax: 'z', dir: -1, s: 8, fleet: 2118, route: '67', dest: 'CARNEGIE', via: 'SWANSTON ST' },
        { ax: 'x', dir: 1, s: -46, fleet: 261, route: '75', dest: 'VERMONT S', via: 'via Flinders St' },
        { ax: 'x', dir: -1, s: 74, fleet: 221, route: '70', dest: 'WATTLE PK', via: 'via Flinders St' },
        { ax: 'z', dir: -1, s: -80, fleet: 2094, route: '1', dest: 'STH MELB', via: 'SWANSTON ST' },
        { ax: 'z', dir: -1, s: -168, fleet: 2135, route: '64', dest: 'BRIGHTON', via: 'SWANSTON ST' },
        { ax: 'z', dir: -1, s: -256, fleet: 2168, route: '72', dest: 'CAMBERWELL', via: 'SWANSTON ST' },
        { ax: 'z', dir: -1, s: -344, fleet: 2103, route: '16', dest: 'KEW', via: 'SWANSTON ST' },
        { ax: 'z', dir: 1, s: 64, fleet: 272, route: '109', dest: 'BOX HILL', via: 'via Collins St', park: true },
        { ax: 'z', dir: 1, s: 178, fleet: 2088, route: '8', dest: 'TOORAK', via: 'ST KILDA RD', rz0: 84, rz1: RUN_Z1 },
        { ax: 'z', dir: 1, s: 96, fleet: 2141, route: '55', dest: 'DOMAIN INT', via: 'ST KILDA RD', rz0: 84, rz1: RUN_Z1 },
    ];

    const TRAMS = [];
    let tramWhiteIM, tramDarkIM, tramLampIM, tramFitIM, tramFloorIM, tramLeafIM;
    {
        const shell = tramShell(), saloon = tramSaloon();
        const N = TRAM_DEFS.length;
        const im = (geo, mat, n) => {
            const m = new THREE.InstancedMesh(geo, mat, n);
            // An InstancedMesh takes its bounding sphere from the geometry it
            // was built out of, which here sits at the origin. Left culled, the
            // whole fleet blinks out the moment the camera turns away from
            // Flinders Street, wherever the trams themselves happen to be.
            m.frustumCulled = false;
            scene.add(m); world.ghost(m);
            return m;
        };
        tramWhiteIM = im(merge(shell.white), tramWhiteM, N);
        tramDarkIM = im(merge(shell.dark), tramDarkM, N);
        tramLampIM = im(merge(shell.lamps), tramLampM, N);
        tramFitIM = im(merge(saloon.fit), tramIntM, N);
        /* The parked car's slot in this one is never written. Its floor is a
           mesh of its own, because a floor somebody stands on has to be in the
           collision grid and an instance never is — and the slot is left in
           rather than the buffer shortened, because the parked car is no
           longer the last of the fleet and an index that skips it walks the
           two southbound cars off the end of the array. An unwritten instance
           matrix is sixteen zeroes, which draws nothing at all. */
        tramFloorIM = im(merge(saloon.floor), tramIntM, N);
        tramLeafIM = im(boxG(0.055, 1.90, LEAF_W), tramLeafM, N * 12);

        TRAM_DEFS.forEach((d, i) => {
            const G = new THREE.Group();
            const sideR = stdMat(0xffffff, { map: tramSideTex(d.fleet, false), roughness: 0.24, metalness: 0.10, alphaTest: 0.5 });
            const sideL = stdMat(0xffffff, { map: tramSideTex(d.fleet, true), roughness: 0.24, metalness: 0.10, alphaTest: 0.5 });
            const endM = stdMat(0xffffff, { map: tramEndTex(d.fleet), roughness: 0.30 });
            const body = mesh(boxG(TRAM_W, TRAM_BH, TRAM_L),
                [sideR, sideL, stdMat(0xdcdeda, { roughness: 0.58 }),
                 stdMat(0x22272b, { roughness: 0.60 }), endM, endM],
                0, TRAM_FLOOR + TRAM_BH / 2, 0);
            G.add(body);

            const dtex = destTex(d.route, d.dest, d.via);
            const dg = [];
            for (const e of [1, -1]) {
                const p = new THREE.PlaneGeometry(TRAM_W - 0.44, 0.24);
                put(p, 0, 3.06, e * (TRAM_L / 2 + 0.10), 0, e > 0 ? 0 : Math.PI, 0);
                dg.push(p);
            }
            G.add(mesh(merge(dg), emissive(0xffffff, 0xffffff, 1.45, {
                map: dtex, emissiveMap: dtex, roughness: 0.4,
            })));
            G.traverse((o) => { if (o.isMesh) world.ghost(o); });

            /* The standing car's floor, and the only mesh in any tram in this
               world that the walk can feel. Everything else about a tram is
               ghosted, as it has always been: the grid is rasterised once from
               where things stand at build time, so a moving tram left solid
               would leave a sixteen-metre wall across Swanston Street with
               nothing visible in it. */
            if (d.park) G.add(mesh(merge(saloon.floor), tramIntM));

            const off = (d.ax === 'z') ? d.dir * TRS : -d.dir * TRF;
            G.rotation.y = (d.ax === 'z') ? (d.dir > 0 ? 0 : Math.PI) : (d.dir > 0 ? Math.PI / 2 : -Math.PI / 2);
            if (d.ax === 'z') G.position.set(off, 0.05, d.s); else G.position.set(d.s, 0.05, off);
            scene.add(G);
            world.part('tram_0' + i, G);
            TRAMS.push({
                mesh: G, ax: d.ax, dir: d.dir, off, s: d.s, v: 0,
                vmax: d.park ? 0 : rr(9, 12), len: TRAM_L, dwell: 0,
                doors: d.park ? 1 : 0, parked: !!d.park, served: -1,
                ry: G.rotation.y, wl: (!d.park && i < 3) ? HEAD_WL[i] : -1,
                rz0: d.rz0, rz1: d.rz1,
            });
        });
    }

    /* Twelve leaves to a car: three doorways, two flanks, two leaves that part
       in the middle of each. Where a leaf is at any moment is its own little
       matrix multiplied through its tram's, which is the whole of the door
       animation — a hundred and eight of them a frame, and not one allocation
       between them, because everything it composes into was made right here
       and is never made again.

       1.368 in x, which is thirty millimetres proud of the bodyside. An
       A-class door is a plug door: it swings out that far and then slides
       along the outside of the car, so a leaf that opened flush would
       disappear into the body and the whole animation with it. */
    const TRAM_LEAF = [];
    for (const dz of DOOR_Z) for (const sx of [-1, 1]) for (const sz of [-1, 1]) TRAM_LEAF.push({ sx, dz, sz });

    const _trM = new THREE.Matrix4(), _trLM = new THREE.Matrix4();
    const _trP = new THREE.Vector3(), _trLP = new THREE.Vector3();
    const _trQ = new THREE.Quaternion(), _trI = new THREE.Quaternion();
    const _trS = new THREE.Vector3(1, 1, 1), _trUp = new THREE.Vector3(0, 1, 0);

    const tramPlace = (i, o) => {
        _trP.set(o.ax === 'z' ? o.off : o.s, 0.05, o.ax === 'z' ? o.s : o.off);
        _trQ.setFromAxisAngle(_trUp, o.ry);
        _trM.compose(_trP, _trQ, _trS);
        tramWhiteIM.setMatrixAt(i, _trM);
        tramDarkIM.setMatrixAt(i, _trM);
        tramLampIM.setMatrixAt(i, _trM);
        tramFitIM.setMatrixAt(i, _trM);
        if (!o.parked) tramFloorIM.setMatrixAt(i, _trM);
        for (let k = 0; k < 12; k++) {
            const lf = TRAM_LEAF[k];
            _trLP.set(lf.sx * 1.368, 1.90,
                      lf.dz + lf.sz * (DOOR_W / 4 + o.doors * (LEAF_W + 0.06)));
            _trLM.compose(_trLP, _trI, _trS);
            _trLM.premultiply(_trM);
            tramLeafIM.setMatrixAt(i * 12 + k, _trLM);
        }
    };
    // Once at build, so the first frame drawn has nine trams up the street
    // rather than nine trams stacked on the origin.
    TRAMS.forEach((o, i) => tramPlace(i, o));
    for (const m of [tramWhiteIM, tramDarkIM, tramLampIM, tramFitIM, tramFloorIM, tramLeafIM]) {
        m.instanceMatrix.needsUpdate = true;
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
    let carBodyIM, carGlassIM, carWheelIM, carLampIM;
    {
        /* Little Collins gets its two lanes as well, because an intersection
           with a lantern over it and nothing ever arriving at it is a lantern
           talking to itself — and every one of the four is signalised now.
           Swanston carries twice the cars it used to for the same reason: the
           run from the bridge to Little Collins is half a kilometre, and three
           cars spread over that is an empty street with a signal on it. */
        const lanes = [
            /* Twelve now rather than eight, because the run grew by a hundred
               and fifty metres at the southern end and eight cars spread over
               six hundred and seventy is one car every eighty metres, which
               reads as a street that has been closed. Twelve is one every
               fifty-odd, which is what a peak-hour bridge looks like. */
            /* 10.1 rather than 8.4, which is where the Stop 11 platforms
               put them: a platform stop takes the lane the traffic was in and
               the traffic takes what is left between it and the kerb. It is
               also a better line everywhere else on this street — at 8.4 a car
               passed the Stop 13 platforms with 240 mm to spare. */
            { ax: 'z', dir: 1, off: 10.1, n: 12, taxi: true },
            { ax: 'z', dir: -1, off: -10.1, n: 12, taxi: true },
            { ax: 'x', dir: 1, off: -10.2, n: 5 },
            { ax: 'x', dir: -1, off: 10.2, n: 5 },
            { ax: 'x', dir: -1, off: -115 - 2.6, n: 2 },
            { ax: 'x', dir: -1, off: -115 + 2.6, n: 2 },
            { ax: 'x', dir: 1, off: -230 - 10.2, n: 2 },
            { ax: 'x', dir: -1, off: -230 + 10.2, n: 2 },
            { ax: 'x', dir: 1, off: -345 - 1.9, n: 2 },
            { ax: 'x', dir: 1, off: -345 + 1.9, n: 2 },
            // Alexandra Avenue, along the south bank. It has a lantern over it
            // now, and a lantern with nothing ever arriving at it is a lantern
            // talking to itself — the same argument Little Collins won.
            { ax: 'x', dir: 1, off: SKR.z - 4.6, n: 3, rx1: 118 },
            { ax: 'x', dir: -1, off: SKR.z + 4.6, n: 3, rx1: 118 },
        ];
        lanes.forEach((ln, li) => {
            /* Dealt out behind the leader, because the lane is sorted once at
               build and never again: the car with the largest s in the
               direction it is going is the one in front, and everybody else is
               laid down the street behind it. Swanston's are spread over the
               whole half-kilometre; a cross street only ever holds the hundred
               metres either side of Swanston. */
            const head = ln.ax === 'z' ? (ln.dir > 0 ? RUN_Z1 - 10 : RUN_Z0 + 10) : -ln.dir * 22;
            for (let i = 0; i < ln.n; i++) {
                const van = rnd() < 0.16;
                const taxi = !van && (ln.taxi ? rnd() < 0.62 : rnd() < 0.15);
                CARS.push({
                    ax: ln.ax, dir: ln.dir, off: ln.off, lane: li, van, taxi,
                    s: head - ln.dir * i * (ln.ax === 'z' ? rr(38, 62) : rr(18, 34)),
                    v: 8, vmax: rr(10.5, 14.5),
                    len: van ? 5.6 : 4.7, rx1: ln.rx1,
                });
            }
        });
        // Grouped by lane and left in the order they were dealt. There is no
        // sort any more: the frame loop asks who is in front rather than being
        // told, because being told is only true until the first car wraps.
        for (const c of CARS) { if (!LANES.has(c.lane)) LANES.set(c.lane, []); LANES.get(c.lane).push(c); }

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

    /* ---- the bikes, which went with the people.

       Twenty of them ran the green kerbside lanes, and every one had a rider
       modelled on it — a body, two arms and a helmet. A rider is a person, so
       the riders had to go; and a bicycle riding itself down Swanston Street
       at fifteen an hour is a stranger thing than an empty lane. The lane is
       still marked on the road, which is the honest end of it: the paint is
       infrastructure, the cyclist was not.

       The kerbside width they were using is now the traffic lane, because the
       Stop 11 platforms took the lane the cars were in. ---- */

    /* ---- the crowd, which is not here any more.

       There were three hundred people on this street: a hundred and ten
       waiting at the four crossings for the scramble, a hundred and eighty
       walking the footpaths, a shopkeeper behind every counter and ten
       passengers in every tram. They have all been taken out — deliberately,
       and everywhere. No figure of a person stands in this world.

       The machinery they drove is still here, because it was never really
       theirs: the signals run their phases, the cars stop for the red, the
       trams keep their dwell, and the walk goes everywhere it went. The one
       human shape left is the green walking figure on the pedestrian lanterns,
       and that is a pictogram painted on a signal head rather than somebody
       standing on a corner — without it the crossings have nothing to say.
       ---- */

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
    /* It has stopped. `makeRain` stays because the weather in this world was
       always meant to be a thing you could change your mind about, and two
       calls is the whole of what it costs to turn it back on. */

    /* ============================================================
       24 · gulls and pigeons

       A city with nobody in it is a model of a city, and the thing that
       finally stops this one reading as a model is not another building — it
       is something small moving on the ground at the edge of your eye.
       Melbourne's version of that is silver gulls, which come up from the bay
       and stand about on the paving looking for what people drop, and pigeons,
       which do the same thing closer together and with less confidence.

       Two instanced meshes and a state machine per bird. A bird is walking, or
       it has stopped to peck at something, or it is putting in a short hop —
       and the whole difference between a flock that looks alive and one that
       looks like a screensaver is that they do not change state together, so
       every timer starts at a different place in its own cycle.

       One of the flocks is not wandering. Six gulls are locked to a spilled
       box of chips on the plaza and are having the argument gulls have about
       it: their targets are re-picked every half second within half a metre
       of the chips, so they shoulder each other off the pile and take short
       hops to get back on, and none of them ever quite wins.

       The pigeons are not in flocks at all, and the loose gulls out on the
       roadway are not either, because that is not how either bird uses this
       street — see where they are placed, below.
       ============================================================ */
    {
        const bcol = (g, hex) => {
            const c = new THREE.Color(hex);
            const n = g.attributes.position.count, a = new Float32Array(n * 3);
            for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
            g.setAttribute('color', new THREE.BufferAttribute(a, 3));
            return g;
        };
        const bmat = () => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.74 });

        /* A silver gull, forty centimetres of it: a body that leans forward, a
           head set well up on the neck, the grey mantle over the back that is
           the only marking you read at this distance, a red bill and red legs.
           Built nose-north so a heading is one rotation about y. */
        const gullG = () => {
            const parts = [];
            let g = sphG(0.115, 9, 7); put(g, 0, 0.185, 0, 0, 0, 0, 1.0, 0.86, 1.75); parts.push(bcol(g, 0xf4f2ee));
            g = sphG(0.098, 9, 7); put(g, 0, 0.205, -0.045, 0, 0, 0, 1.0, 0.72, 1.35); parts.push(bcol(g, 0xb9c0c4));
            g = sphG(0.062, 8, 6); put(g, 0, 0.275, 0.145); parts.push(bcol(g, 0xf6f5f2));
            g = coneG(0.026, 0.105, 6); put(g, 0, 0.268, 0.215, Math.PI / 2, 0, 0); parts.push(bcol(g, 0xd8402c));
            g = boxG(0.055, 0.022, 0.135); put(g, 0, 0.176, -0.215, -0.22, 0, 0); parts.push(bcol(g, 0xdedbd4));
            for (const sx of [-0.042, 0.042]) {
                g = cylG(0.011, 0.011, 0.115, 5); put(g, sx, 0.062, 0.012); parts.push(bcol(g, 0xd8402c));
                g = boxG(0.042, 0.014, 0.062); put(g, sx, 0.010, 0.032); parts.push(bcol(g, 0xd8402c));
            }
            return merge(parts);
        };

        /* And a feral pigeon, which is rounder, lower and greyer than a gull,
           and which earns more geometry than the gull does for one reason: a
           gull is mostly seen at twenty metres across the plaza, and a pigeon
           is seen at two, standing on the paving you are about to walk over.
           At two metres a bird made of four merged spheres is not a bird, it
           is a grey pebble with legs, which is what these were. It is still
           one merged geometry stood up fifty times, so everything below has to
           earn the triangles it spends. */
        const pigeonG = () => {
            const parts = [];
            const P = (g, hex) => parts.push(bcol(g, hex));
            let g;

            /* The body, leaning forward off the legs, with the darker saddle
               riding just proud of it over the back and the pale rump under the
               tail. Everything that follows has to stand clear of this
               ellipsoid rather than inside it — the reason the old bird was one
               grey blob is that its wing and its neck patch were both smaller
               than the body they were drawn on and never once came out of it. */
            g = sphG(0.092, 9, 7); put(g, 0, 0.130, -0.028, 0, 0, 0, 0.94, 0.88, 1.46); P(g, 0x7d8288);
            g = sphG(0.088, 7, 6); put(g, 0, 0.158, -0.045, 0, 0, 0, 0.94, 0.66, 1.20); P(g, 0x5c6167);
            g = sphG(0.048, 5, 4); put(g, 0, 0.118, -0.130, 0, 0, 0, 1.0, 0.66, 0.92); P(g, 0xc7c3ba);

            // the folded wing: a flat plane laid down each flank, standing two
            // centimetres off the body so it reads as a wing and not as shading,
            // and the two black bars across it that say rock dove
            for (const s of [-1, 1]) {
                g = sphG(0.078, 6, 5);
                put(g, s * 0.072, 0.140, -0.036, 0, 0, s * -0.04, 0.30, 0.62, 1.12); P(g, 0x8f959c);
                for (const w of [[0.083, -0.088], [0.088, -0.044]]) {
                    g = boxG(0.024, 0.042, 0.011);
                    put(g, s * w[0], 0.138, w[1], 0, 0, s * -0.04); P(g, 0x2f3338);
                }
            }

            /* The neck, which the old bird did not have at all: the head sat
               straight on the shoulders and the green patch was a sphere inside
               a bigger sphere. Two short tapered drums instead, leaning forward
               out of the shoulders, green low and purple over it, because that
               is the way the iridescence actually runs — up the neck, not
               around it in a collar. */
            g = cylG(0.036, 0.048, 0.078, 7); put(g, 0, 0.186, 0.044, 0.38, 0, 0); P(g, 0x35604b);
            g = cylG(0.040, 0.037, 0.042, 7); put(g, 0, 0.228, 0.060, 0.38, 0, 0); P(g, 0x4c4059);
            g = sphG(0.050, 8, 6); put(g, 0, 0.250, 0.086); P(g, 0x6a7076);

            // the bill, and the white cere swollen over the base of it, which is
            // the one marking on this bird that nothing else on the corner has
            g = coneG(0.014, 0.044, 6); put(g, 0, 0.244, 0.152, Math.PI / 2, 0, 0); P(g, 0x33363a);
            g = sphG(0.012, 5, 4); put(g, 0, 0.256, 0.128, 0, 0, 0, 0.95, 0.85, 0.80); P(g, 0xd7d2c6);

            /* The eye, and it is worth two discs rather than a sphere. A sphere
               cheap enough to instance fifty times is a hexagon at this size and
               reads as a bolt head; a nine-sided disc set flat into the side of
               the skull reads as a circle, and the bead standing two millimetres
               proud of it reads as an eye. Slightly over life size on purpose —
               honest scale here is four pixels of nothing. */
            for (const s of [-1, 1]) {
                g = cylG(0.0092, 0.0092, 0.007, 9);
                put(g, s * 0.0425, 0.260, 0.110, 0, 0, Math.PI / 2); P(g, 0xcfc6b4);
                g = cylG(0.0056, 0.0056, 0.007, 7);
                put(g, s * 0.0455, 0.260, 0.110, 0, 0, Math.PI / 2); P(g, 0x141517);
            }

            /* The tail: a seven-sided cone squashed flat, narrow end buried in
               the body and the fan trailing back and down, with the dark
               terminal band across the end of it. A slab could never do the one
               thing a tail does here, which is spread when the bird brakes out
               of a hop and close again when it walks. */
            g = cylG(0.024, 0.090, 0.165, 7);
            put(g, 0, 0.113, -0.196, Math.PI / 2 - 0.16, 0, 0, 1.0, 1.0, 0.17); P(g, 0x6f757b);
            g = cylG(0.084, 0.091, 0.026, 7);
            put(g, 0, 0.1020, -0.2646, Math.PI / 2 - 0.16, 0, 0, 1.0, 1.0, 0.17); P(g, 0x2b2e32);

            for (const sx of [-0.034, 0.034]) {
                g = cylG(0.009, 0.009, 0.082, 5); put(g, sx, 0.046, 0.010); P(g, 0xc45a4a);
                g = boxG(0.032, 0.011, 0.048); put(g, sx, 0.008, 0.026); P(g, 0xc45a4a);
            }
            return merge(parts);
        };

        /* Where they are. The chips are on the plaza in front of the station
           canopy, which is exactly where a dropped box of chips ends up. */
        const CHIP = { x: 31.5, z: -142.5 };

        const BIRDS = [];
        /* One bird, placed on its own, with its own patch of ground. `hr` is
           how far it will wander from where it was put down; `gy` is the
           surface it is standing on, because the footpath is a kerb above the
           roadway and a bird on the crossing is not a bird on the paving. */
        const addBird = (kind, x, z, r) => {
            const b = {
                kind, fight: false, hx: x, hz: z, hr: r,
                x, z, tx: x, tz: z, ry: rr(0, 6.283), y: 0, gy: KERB_H,
                st: irr(0, 2), t: rr(0.1, 1.4), sp: rr(0.55, 1.05) * (kind ? 0.72 : 1.0),
                bob: rr(0, 6.283), road: false, ex: x, ez: z,
            };
            BIRDS.push(b);
            return b;
        };

        /* The gulls that do stand in flocks: the fight on the plaza, and three
           loose groups over the river end and Federation Square. */
        const FLOCKS = [
            { n: 7, x: CHIP.x, z: CHIP.z, r: 1.9, fight: true },
            { n: 9, x: 27.0,  z: 44.0,   r: 10.0 },
            { n: 5, x: -6.0,  z: -104.0, r: 7.0 },
            { n: 4, x: 62.0,  z: 96.0,   r: 9.0 },
        ];
        for (const f of FLOCKS) {
            for (let i = 0; i < f.n; i++) {
                const a = rr(0, 6.283), rad = f.r * Math.sqrt(rnd());
                const b = addBird(0, f.x, f.z, f.r);
                b.fight = !!f.fight;
                b.x = f.x + Math.cos(a) * rad;
                b.z = f.z + Math.sin(a) * rad;
            }
        }

        // the chips they are arguing over, and the box they came out of
        {
            const parts = [];
            let g = boxG(0.20, 0.05, 0.14); put(g, CHIP.x, KERB_H + 0.03, CHIP.z, 0, 0.4, 0);
            parts.push(bcol(g, 0xe8d9a8));
            for (let i = 0; i < 22; i++) {
                const a = rr(0, 6.283), rad = rr(0.05, 0.95);
                g = boxG(rr(0.035, 0.085), 0.022, 0.022);
                put(g, CHIP.x + Math.cos(a) * rad, KERB_H + 0.012, CHIP.z + Math.sin(a) * rad, 0, rr(0, 3.14), 0);
                parts.push(bcol(g, i % 4 ? 0xe4c878 : 0xd8b45e));
            }
            const chips = mesh(merge(parts), bmat());
            scene.add(chips); world.ghost(chips);
        }

        /* The pigeons, which are not a flock and never were. Four tight
           clusters is what a bird system looks like when it has been written as
           a bird system; what a Swanston Street footpath actually looks like is
           one pigeon here, two more a few metres on, then nothing for twenty
           metres, all the way up the street. So every one of them is placed on
           its own and gets its own metre or two of paving to work over, and
           about a third of them are given one companion within a stride, which
           is the "twos" in ones and twos. */
        const PIG = [];
        const pigSpot = (x, z, gy) => {
            PIG.push({ x, z, gy });
            if (rnd() < 0.34) {
                const a = rr(0, 6.283), rad = rr(0.6, 1.7);
                PIG.push({ x: x + Math.cos(a) * rad, z: z + Math.sin(a) * rad, gy });
            }
        };
        // both footpaths, one bird to each thirty metre band of the street,
        // alternating sides so neither one goes empty for long
        for (let i = 0; i < 20; i++) {
            const side = (i % 2) ? 1 : -1;
            pigSpot(side * (SW + rr(1.1, 6.2)), -330 + (i + rr(0.1, 0.9)) * 27.9, KERB_H);
        }
        // the City Square plaza, which has spilled food on it and a wall to sit on
        for (let i = 0; i < 6; i++) {
            pigSpot(rr(SQ.X0 + 1.6, SQ.X1 - 2.2), rr(SQ.Z1 + 4.5, SQ.Z0 - 4.5), KERB_H);
        }
        // and out on the scramble crossing, which they hold until the phase changes
        for (let i = 0; i < 4; i++) pigSpot(rr(-9.5, 9.5), rr(-11.0, 11.0), 0);
        // with a few more along Flinders Street either side of the corner
        for (let i = 0; i < 4; i++) {
            const side = (i % 2) ? 1 : -1;
            pigSpot((i < 2 ? -1 : 1) * rr(24, 96), side * (FL + rr(1.4, 5.4)), KERB_H);
        }
        /* Where a bird runs to when something big comes past. Out to the edge
           of its own carriageway, clear of both rails — except for one standing
           inside the intersection, which goes diagonally into a corner of it,
           because on a scramble crossing the corner is the only asphalt that no
           tram passes through. */
        const escapeTo = (b, ax) => {
            if (b.x > -12.0 && b.x < 12.0 && b.z > -14.0 && b.z < 14.0) {
                b.ex = (b.x >= 0 ? 1 : -1) * rr(8.8, 10.8);
                b.ez = (b.z >= 0 ? 1 : -1) * rr(9.4, 12.4);
            } else if (ax === 'z') {
                b.ex = (b.x >= 0 ? 1 : -1) * rr(9.0, 10.9);
                b.ez = b.z + rr(-2.6, 2.6);
            } else {
                b.ez = (b.z >= 0 ? 1 : -1) * rr(10.6, 12.7);
                b.ex = b.x + rr(-2.6, 2.6);
            }
        };
        for (const p of PIG) {
            const b = addBird(1, p.x, p.z, rr(0.55, 1.9));
            b.gy = p.gy;
            // the ones down on the asphalt are the ones a tram can reach
            if (p.gy === 0) { b.road = true; escapeTo(b, 'z'); }
        }

        /* And the gulls that are not in a flock, which is most of the gulls you
           actually see here: single birds standing in the middle of the road,
           on the tram tracks, on the crossing, walking about on wet asphalt as
           though the traffic were somebody else's problem. They are on the
           roadway, so they stand at y = 0 rather than up on the kerb.

           When a moving tram comes down the lane one of these is standing in,
           it runs for its escape point with a flutter in it, waits there, and
           then walks back to where it was. Nothing about that is a scripted
           flight: it is the ordinary walk state machine with one more state in
           front of it, so a gull that has been startled is still a gull. */
        const STREET_GULLS = [
            { ax: 'z', x: 3.6,  z: -86 },
            { ax: 'z', x: -3.4, z: -18 },
            { ax: 'z', x: 4.2,  z: -170 },
            { ax: 'z', x: -3.9, z: 40 },
            { ax: 'z', x: 2.4,  z: 96 },
            { ax: 'z', x: -4.6, z: -198 },
            { ax: 'z', x: 5.8,  z: -132 },
            { ax: 'z', x: -1.2, z: 8 },
            { ax: 'z', x: 7.4,  z: 168 },
            { ax: 'z', x: -6.8, z: 206 },
            { ax: 'x', x: -44,  z: -4.2 },
            { ax: 'x', x: 52,   z: 4.6 },
            { ax: 'x', x: -78,  z: 4.0 },
            { ax: 'x', x: 33,   z: -4.8 },
        ];
        for (const s of STREET_GULLS) {
            const b = addBird(0, s.x, s.z, rr(1.3, 2.8));
            b.gy = 0;
            b.road = true;
            escapeTo(b, s.ax);
        }

        const nG = BIRDS.filter((b) => b.kind === 0).length;
        const nP = BIRDS.length - nG;
        const gullIM = new THREE.InstancedMesh(gullG(), bmat(), nG);
        const pigIM = new THREE.InstancedMesh(pigeonG(), bmat(), nP);
        scene.add(gullIM); scene.add(pigIM);
        world.ghost(gullIM); world.ghost(pigIM);

        /* Nothing in here allocates. The matrix and its three parts are made
           once and composed into every bird every frame, which is the whole
           reason a hundred of them cost what they cost. The tram test is the
           same deal: it reads positions that are already there and compares
           numbers, so a gull noticing a tram costs no memory at all.

           A stationary tram is not frightening — a gull will stand beside one
           dwelling at Stop 13 all day — so the test asks for speed as well as
           nearness, which is also what keeps a bird from fluttering in place
           for the whole of a red phase. */
        const SCARE_ALONG = 21.0, SCARE_ACROSS = 5.2;
        const _bm = new THREE.Matrix4();
        const _bp = new THREE.Vector3();
        const _bq = new THREE.Quaternion();
        const _be = new THREE.Euler();
        const _bs = new THREE.Vector3(1, 1, 1);

        world.frame((dt) => {
            let gi = 0, pi = 0;
            for (const b of BIRDS) {
                b.t -= dt;
                if (b.road) {
                    let near = false;
                    for (let i = 0; i < TRAMS.length; i++) {
                        const T = TRAMS[i];
                        if (T.v < 2.0) continue;
                        const tp = T.mesh.position;
                        const along = T.ax === 'z' ? tp.z - b.z : tp.x - b.x;
                        if (along > SCARE_ALONG || along < -SCARE_ALONG) continue;
                        const across = T.ax === 'z' ? tp.x - b.x : tp.z - b.z;
                        if (across < SCARE_ACROSS && across > -SCARE_ACROSS) { near = true; break; }
                    }
                    if (near) {
                        if (b.st !== 3) { b.st = 3; b.tx = b.ex; b.tz = b.ez; }
                        if (b.t < 0.6) b.t = rr(0.6, 1.2);
                    }
                }
                if (b.t <= 0) {
                    /* A bird that has arrived decides again. The fighters skip
                       standing still: there is a chip under somebody else. A
                       gull coming off a startle falls through here too, which
                       is how it walks itself back out into the road. */
                    b.st = b.fight ? (rnd() < 0.45 ? 2 : 0)
                                   : (rnd() < 0.44 ? 1 : (rnd() < 0.82 ? 0 : 2));
                    if (b.st === 0) {
                        const a = rr(0, 6.283), rad = b.hr * Math.sqrt(rnd());
                        b.tx = b.hx + Math.cos(a) * rad;
                        b.tz = b.hz + Math.sin(a) * rad;
                        b.t = rr(0.7, 2.0);
                    } else if (b.st === 1) {
                        b.t = rr(0.5, 1.5);
                    } else {
                        const a = rr(0, 6.283), rad = b.fight ? rr(0.15, 0.85) : rr(0.4, 1.4);
                        b.tx = (b.fight ? b.hx : b.x) + Math.cos(a) * rad;
                        b.tz = (b.fight ? b.hz : b.z) + Math.sin(a) * rad;
                        b.t = 0.42;
                    }
                }
                const dx = b.tx - b.x, dz = b.tz - b.z;
                const d = Math.hypot(dx, dz);
                if (b.st !== 1 && d > 0.04) {
                    const v = (b.st === 3 ? 4.4 : b.st === 2 ? 2.6 : 1.0) * b.sp;
                    const k = Math.min(1, (v * dt) / d);
                    b.x += dx * k; b.z += dz * k;
                    // turn towards where it is going rather than snapping
                    const want = Math.atan2(dx, dz);
                    let turn = want - b.ry;
                    while (turn > Math.PI) turn -= 6.283;
                    while (turn < -Math.PI) turn += 6.283;
                    b.ry += turn * Math.min(1, dt * (b.st === 3 ? 16.0 : 9.0));
                }
                /* Startled, it is half running and half flapping — off the
                   ground and back on it twice a stride — and once it is clear
                   it puts its feet down and stands there watching instead. */
                b.y = b.st === 3 ? (d > 0.30 ? Math.abs(Math.sin(b.bob)) * 0.26 : 0)
                    : b.st === 2 ? Math.sin(Math.PI * clamp(1 - b.t / 0.42, 0, 1)) * 0.32 : 0;
                b.bob += dt * (b.st === 3 ? 16.0 : b.st === 1 ? 7.5 : 3.0);
                const pitch = b.st === 3 ? -0.16
                    : b.st === 1 ? 0.75 + Math.sin(b.bob) * 0.30 : Math.sin(b.bob) * 0.05;

                _be.set(pitch, b.ry, 0);
                _bm.compose(_bp.set(b.x, b.gy + b.y, b.z), _bq.setFromEuler(_be), _bs);
                if (b.kind === 0) gullIM.setMatrixAt(gi++, _bm); else pigIM.setMatrixAt(pi++, _bm);
            }
            gullIM.instanceMatrix.needsUpdate = true;
            pigIM.instanceMatrix.needsUpdate = true;
        });
    }

    /* ============================================================
       20 · what moves

       Four controllers, one per intersection, each running the phase table it
       was given back in section 16 against its own offset off the one clock. The
       trams, the cars and the bikes read the intersection in front of them to
       decide whether to stop, and the crowd reads the crossing it is standing on
       to decide whether to go — so the traffic and the people up this whole
       street are not two animations that happen to run at the same time, they
       are four intersections.
       ============================================================ */
    let adT = 0;
    const _cam = new THREE.Vector3();
    const TRAM_STOPS_Z = [-45, 64], TRAM_STOPS_X = [-42, 42];

    /* Off one end of the street and back on at the other, which is the whole of
       the traffic model's memory. It runs on the axis rather than on a constant
       because Swanston is nearly twice the cross streets: a vehicle taken off at
       a hundred and forty metres never sees the northern half of the corridor,
       and the corridor is the point.

       A vehicle may also carry a run of its own, which is how the two
       southbound trams keep clear of the car standing at Stop 13 without any
       of the rest of the fleet knowing about it. */
    const wrapS = (o) => {
        if (o.ax === 'z') {
            const z0 = o.rz0 === undefined ? RUN_Z0 : o.rz0;
            const z1 = o.rz1 === undefined ? RUN_Z1 : o.rz1;
            if (o.s > z1) o.s = z0; else if (o.s < z0) o.s = z1;
        } else {
            const x1 = o.rx1 === undefined ? RUN_X : o.rx1;
            if (o.s > x1) o.s = -x1; else if (o.s < -x1) o.s = x1;
        }
    };

    world.frame((dt, t) => {
        camera.getWorldPosition(_cam);
        U.uCamPos.value.copy(_cam);
        U.uTime.value = t;

        // the gusts that lean the rain and stir the cloud
        const gx = 0.26 + 0.16 * Math.sin(t * 0.19) + 0.07 * Math.sin(t * 0.61 + 1.2);
        const gz = 0.09 + 0.08 * Math.sin(t * 0.15 + 2.1) + 0.04 * Math.sin(t * 0.47);
        U.uWind.value.set(gx, gz);

        /* ---- the four controllers ------------------------------------ */
        /* Each intersection is its own clock read off the one time: nothing
           accumulates, so no controller can drift out of the corridor no matter
           what the frame rate did, and a phase is a lookup rather than a state
           machine to keep in step. Nothing is repainted unless what it is
           showing actually changed — the flashing red is the only thing that
           changes at speed, and only while there is a clearance running. */
        let repaint = false;
        for (let i = 0; i < XSEC.length; i++) {
            const X = XSEC[i];
            let lt = (t - X.off) % CYCLE;
            if (lt < 0) lt += CYCLE;
            const tb = X.table;
            let k = 0;
            while (k < tb.length - 1 && lt >= tb[k].end) k++;
            const R = tb[k];
            X.ns = R.ns; X.ew = R.ew; X.pns = R.pns; X.pew = R.pew; X.scr = R.scr || 0;
            X.left = R.end - lt;      // what the crowd needs to know before it steps off

            const flash = (R.pns === 'c' || R.pew === 'c') ? (Math.sin(t * 9.4) > 0 ? 1 : 0) : 0;
            const code = k * 2 + flash;
            if (code === X.code) continue;
            X.code = code;
            repaint = true;

            // the first four heads of an intersection face along Swanston and
            // the last four face along its cross street, in the order they were
            // built in; three aspects each, top to bottom
            for (let hh = 0; hh < 8; hh++) {
                const st = hh < 4 ? X.ns : X.ew;
                const b = (i * 8 + hh) * 3;
                sigAspIM.setColorAt(b, st === 'r' ? ASP.red : ASP.off);
                sigAspIM.setColorAt(b + 1, st === 'y' ? ASP.amber : ASP.off);
                sigAspIM.setColorAt(b + 2, st === 'g' ? ASP.green : ASP.off);
            }
            // and the pedestrian lanterns two to a corner: the even one belongs
            // to the crossing over Swanston, the odd one to the crossing over
            // the cross street
            for (let c = 0; c < 8; c++) {
                const p = (c & 1) ? X.pns : X.pew;
                const idx = i * 8 + c;
                plStandIM.setColorAt(idx, (p === 'd' || (p === 'c' && flash)) ? ASP.stand : ASP.off);
                plWalkIM.setColorAt(idx, p === 'w' ? ASP.walk : ASP.off);
            }
        }
        if (repaint) {
            sigAspIM.instanceColor.needsUpdate = true;
            plStandIM.instanceColor.needsUpdate = true;
            plWalkIM.instanceColor.needsUpdate = true;
        }

        /* ---- trams --------------------------------------------------- */
        for (let i = 0; i < TRAMS.length; i++) {
            const o = TRAMS[i];
            /* The car at Stop 13 is skipped entirely, and that is load-bearing
               rather than tidy. Its floor is in the walk's collision grid,
               which was rasterised once from where it stood when the world
               landed; the moment anything here moved it, the floor somebody is
               standing on would stay behind at Swanston and 64 and they would
               be walking on nothing. Nothing in this loop may touch it. */
            if (!o.parked) {
                let target = vehTarget(o.ax, o.dir, o.s, o.off, o.vmax);

                // and the platform stops, where a tram stands with its doors open
                const stops = o.ax === 'z' ? TRAM_STOPS_Z : TRAM_STOPS_X;
                let best = 1e9, bestQ = -1;
                for (let q = 0; q < stops.length; q++) {
                    const dq = o.dir * (stops[q] - o.s);
                    if (dq > -22 && dq < best) { best = dq; bestQ = q; }
                }
                /* Which platform this car has already worked, so that it
                   leaves one. Without it a tram that runs its dwell down to
                   zero is still sitting within a metre and a half of the stop
                   line, which is the same test that started the dwell — so it
                   starts another one, and another, and the 3 to Melbourne Uni
                   stands at Stop 13 for the rest of the afternoon. Cleared six
                   metres past the platform, where it cannot be triggered again
                   by the stop behind it. */
                if (best < -6) o.served = -1;
                if (best > -14 && best < 16) {
                    if (o.dwell === 0 && o.served !== bestQ && best < 1.5 && best > -1.5) {
                        o.dwell = rr(4.0, 8.0); o.served = bestQ;
                    }
                    if (o.dwell > 0) target = Math.min(target, Math.max(0, best * 0.5));
                } else if (best < -20) o.dwell = 0;
                if (o.dwell > 0) { o.dwell -= dt; if (o.dwell < 0) o.dwell = 0; }

                /* The doors, and the interlock that belongs with them. They
                   open once the car has actually come to a stand at a
                   platform, they stay open through the dwell, and they start
                   closing a second before it runs out — and nothing moves
                   until they are shut, which is what makes the end of a dwell
                   read as a tram waiting for its own doors rather than as a
                   tram idling for no reason. */
                const want = (o.dwell > 1.0 && o.v < 0.25) ? 1 : 0;
                o.doors += clamp(want - o.doors, -dt * 1.15, dt * 1.15);
                if (o.doors > 0.02) target = 0;

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
                wrapS(o);
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
            // and out into the six meshes the whole fleet is drawn from
            tramPlace(i, o);
        }
        tramWhiteIM.instanceMatrix.needsUpdate = true;
        tramDarkIM.instanceMatrix.needsUpdate = true;
        tramLampIM.instanceMatrix.needsUpdate = true;
        tramFitIM.instanceMatrix.needsUpdate = true;
        tramFloorIM.instanceMatrix.needsUpdate = true;
        tramLeafIM.instanceMatrix.needsUpdate = true;

        /* ---- cars, lane by lane -------------------------------------- */
        for (const arr of LANES.values()) {
            for (let i = 0; i < arr.length; i++) {
                const o = arr[i];
                // the cross streets have their own stop lines now, and their own
                // controllers behind them: a car on Flinders Lane is held by
                // Flinders Lane's lantern, not by the one four blocks south
                let target = vehTarget(o.ax, o.dir, o.s, o.off, o.vmax);

                /* Whatever is genuinely in front in this lane, found the way the
                   trams find it, rather than by trusting the order the lane was
                   sorted into at build. That order stops being true the first
                   time a car runs off the end of the street and comes back on at
                   the other: the car this one had been following is suddenly
                   half a kilometre behind it, the gap goes hugely negative, and
                   a follower that believes that pulls up against a vehicle that
                   is not there and never moves again for the rest of the
                   session — which is what used to happen to a whole lane of
                   Swanston Street a minute or so after the world opened.

                   Asking who is ahead every frame costs sixty-four comparisons
                   in the worst lane and cannot go stale. Measuring forward only
                   is what keeps two cars abreast from each stopping for the
                   other, and the forty-six metre window is what keeps a car that
                   has just wrapped from being anybody's problem. */
                for (let j = 0; j < arr.length; j++) {
                    if (j === i) continue;
                    const ahead = (arr[j].s - o.s) * o.dir;
                    if (ahead <= 0 || ahead > 46) continue;
                    const gap = ahead - (arr[j].len + o.len) / 2 - 1.6;
                    const cap = Math.max(0, gap * 0.62);
                    if (cap < target) target = cap;
                }

                o.v = lerp(o.v, target, 1 - Math.exp(-dt * (target < o.v ? 2.8 : 1.2)));
                o.s += o.dir * o.v * dt;
                wrapS(o);
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

    /* ============================================================
       27 · the riverbanks

       Everything inside the cut the two road sheets now have taken out of
       them, which is to say everything between the top of one bank wall and
       the top of the other: the bluestone river walls, the promenade at water
       level under the bridge on both sides, the two long flights of steps down
       to it, the broad sitting steps into the water on the south bank, and the
       buildings, gardens, palms and kiosks that stand on either side.

       Also Alexandra Avenue, which runs along the south bank and is the cross
       street at the south end of the bridge. It is not one of the three cut
       into the road shader in section 7 — that loop is a fixed three and the
       shader is not this section's to change — so its carriageway, footpaths
       and kerbs are laid here as geometry, over the top of the sheet that runs
       out to the fog. Everything else about it, the lantern included, is the
       same intersection as the other four.

       One honest departure from the photograph. The reference has the park
       with the palms north-west of the bridge, running down to the water. In
       this world the north bank is Flinders Street Station: `station_00` runs
       from x −160 to −4 and from z 16 all the way to 131, which is the cut,
       and Federation Square fills the same band on the other side of Swanston.
       There is no north bank here to put a park on — nine metres of quay wall
       and nothing else. So the palms, the lawn, the winding paths and the
       domed drum have gone to the south-west quadrant instead, which in
       Melbourne is Queen Victoria Gardens and reads the same way from the
       bridge; the north bank gets its own row of palms along the wall.
       ============================================================ */
    {
        const _rt = new Map();
        const rc = (hex) => { let c = _rt.get(hex); if (!c) { c = srgb(hex); _rt.set(hex, c); } return c; };
        // Same rule as the bridge, for the same reason: a merge whose members
        // disagree about having a colour attribute answers null.
        const col = (g, hex) => {
            const c = rc(hex), n = g.attributes.position.count, a = new Float32Array(n * 3);
            for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
            g.setAttribute('color', new THREE.BufferAttribute(a, 3));
            return g;
        };
        const PG = (arr, hex, g) => { arr.push(col(g, hex)); return g; };
        const PB = (arr, hex, w, h, d, x, y, z, rx, ry, rz) =>
            PG(arr, hex, put(boxG(w, h, d), x, y, z, rx, ry, rz));
        // a box from two opposite corners, which is how a plan is actually read
        const BOX = (arr, hex, x0, y0, z0, x1, y1, z1) =>
            PB(arr, hex, Math.abs(x1 - x0), Math.abs(y1 - y0), Math.abs(z1 - z0),
               (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);

        const ground = [], stone = [], built = [], glow = [];

        // Every colour here is written light, because `srgb` reads it twice.
        const PAVE = 0xb4b0a4, PAVE_D = 0xa09c94, KERBC = 0x94918c;
        const BLUE = 0x929ca7, BLUE_D = 0x808b96;      // the same bluestone as the piers
        const ASPH = 0x63666c, LAWN = 0x7f9464, PATH = 0xb5aa92;
        const RAILC = 0x6d7478;

        /* ---- the plan, in one place ------------------------------------
           NPAV/SPAV are the strips of bank at street level, NWAL/SWAL the
           faces of the two river walls, NQ/SQ the promenades six metres
           under them. The two stair slots are the gaps in the wall where the
           flights come down; there is no wall and no railing across them. */
        const TOP = KERB_H + 0.01;                   // the bank, level with the footpath
        const NPAV0 = 131.5, NPAV1 = 141.5, NWAL1 = 143.6, NQ1 = 156.5;
        const SQ0 = 214.0, SWAL0 = 226.4, SPAV0 = 228.5, SPAV1 = 238.5;
        const STEP0 = 205.0;                          // the sitting steps run down to here
        const AB = 15.0;                              // half the deck, and where the bank meets it
        const NSX0 = -58, NSX1 = -32;                 // the north flight, west of the bridge
        const SSX0 = 32, SSX1 = 58;                   // and the south one, east of it
        const NSZ0 = 136.0, NSZ1 = 152.0;
        const SSZ0 = 218.0, SSZ1 = 234.0;
        const EDGE = 190;                             // how far the promenades run either way
        const FAR = 520;                              // and the plain bank behind them

        /* ---- the two banks at street level ----------------------------
           Laid in three pieces a side rather than one, because the flight
           down has to break the strip: the paving in a stair slot stops
           short and the top tread carries on from where it stopped. */
        for (const b of [{ p0: NPAV0, p1: NPAV1, sx0: NSX0, sx1: NSX1, cut: NSZ0, s: 1 },
                         { p0: SPAV0, p1: SPAV1, sx0: SSX0, sx1: SSX1, cut: SSZ1, s: -1 }]) {
            const far = b.s > 0 ? b.p0 : b.p1;
            for (const r of [[-FAR, -AB], [AB, FAR]]) {
                // the strip, minus the slot the flight comes down through
                if (b.sx0 > r[0] && b.sx1 < r[1]) {
                    BOX(ground, PAVE, r[0], -0.6, b.p0, b.sx0, TOP, b.p1);
                    BOX(ground, PAVE, b.sx1, -0.6, b.p0, r[1], TOP, b.p1);
                    BOX(ground, PAVE, b.sx0, -0.6, b.s > 0 ? far : b.cut, b.sx1, TOP, b.s > 0 ? b.cut : far);
                } else {
                    BOX(ground, PAVE, r[0], -0.6, b.p0, r[1], TOP, b.p1);
                }
            }
        }

        /* ---- the river walls, and the abutment between them ------------
           Split round two gaps, not one: the bridge takes the middle of the
           bank and the flight down takes a slot in it, and a wall run through
           either of them is a wall across the only way to the water. */
        const runs = (excl) => {
            const sorted = excl.slice().sort((a, b) => a[0] - b[0]);
            const out = []; let a = -FAR;
            for (const e of sorted) { if (e[0] > a + 0.5) out.push([a, e[0]]); a = Math.max(a, e[1]); }
            if (a < FAR - 0.5) out.push([a, FAR]);
            return out;
        };
        for (const w of [{ z0: NPAV1, z1: NWAL1, sx0: NSX0, sx1: NSX1 },
                         { z0: SWAL0, z1: SPAV0, sx0: SSX0, sx1: SSX1 }]) {
            for (const r of runs([[-AB, AB], [w.sx0, w.sx1]])) {
                BOX(stone, BLUE, r[0], -9.2, w.z0, r[1], TOP + 0.04, w.z1);
                // a coursing line along it, so six metres of wall is not one flat face
                BOX(stone, BLUE_D, r[0], -3.30, w.z0 - 0.10, r[1], -2.90, w.z1 + 0.10);
                BOX(stone, BLUE_D, r[0], -6.40, w.z0 - 0.10, r[1], -6.05, w.z1 + 0.10);
                // and a coping over it. Without one the top of the wall was a
                // pale blue stripe along the river seen from every angle,
                // because bluestone read face-on and bluestone read from above
                // are not the same colour and only one of them is the wall.
                BOX(stone, PAVE, r[0], TOP - 0.02, w.z0 - 0.12, r[1], TOP + 0.10, w.z1 + 0.12);
            }
        }
        /* And the abutment, closing the end of the bridge between the wall on
           one side of it and the wall on the other. Its top stops just under
           the deck soffit so it never becomes part of the deck. */
        BOX(stone, BLUE_D, -AB, -9.2, 130.0, AB, -1.62, NWAL1);
        BOX(stone, BLUE_D, -AB, -9.2, SWAL0, AB, -1.62, 240.0);

        /* ---- the promenades -------------------------------------------
           Both run under the bridge, which is the whole point of them: the
           first arch springs at four and a third under the deck and the quay
           is at six and a bit, so there is three metres of headroom in the
           middle of the span and a red soffit over your head. */
        BOX(ground, PAVE_D, -EDGE, -9.0, NWAL1, EDGE, QUAY, NQ1);
        BOX(ground, PAVE_D, -EDGE, -9.0, SQ0, EDGE, QUAY, SWAL0);
        // a raised lip along the water's edge of the north quay, which is what
        // stops a promenade reading as a raft
        BOX(ground, PAVE, -EDGE, QUAY, NQ1 - 0.45, EDGE, QUAY + 0.22, NQ1);

        /* ---- the broad steps into the water, on the south bank ---------
           Ten treads at nine hundred deep and two hundred and ten high, which
           is a stair nobody would choose to climb and exactly the thing
           everybody sits on. The last one is a hand's width over the river. */
        for (let k = 0; k < Math.round((SQ0 - STEP0) / 0.90); k++) {
            const z1 = SQ0 - k * 0.90, z0 = z1 - 0.90;
            BOX(ground, k % 2 ? PAVE_D : PAVE, -104, -9.0, z0, 152, QUAY - k * 0.21, z1);
        }

        /* ---- the two long flights down ---------------------------------
           A quarter in twenty-six metres, which is under the gradient the walk
           calls a slope rather than a wall — a flight that answers `STEEP` is
           a flight nobody can use, and this is the only way down to the water
           in the world. */
        for (const f of [{ x0: NSX0, x1: NSX1, z0: NSZ0, z1: NSZ1, dir: 1 },
                         { x0: SSX1, x1: SSX0, z0: SSZ0, z1: SSZ1, dir: -1 }]) {
            const N = 30, run = Math.abs(f.x1 - f.x0) / N;
            const rise = (TOP - QUAY) / (N - 1);
            for (let k = 0; k < N; k++) {
                const a = f.x0 + f.dir * k * run, b = a + f.dir * run;
                BOX(ground, k % 2 ? PAVE : PAVE_D,
                    Math.min(a, b), -9.0, f.z0, Math.max(a, b) + 0.02, TOP - k * rise, f.z1);
            }
            // and a cheek wall down each side of it
            for (const cz of [f.z0 - 0.55, f.z1 + 0.55]) {
                BOX(stone, BLUE, Math.min(f.x0, f.x1), -9.0, cz - 0.55,
                    Math.max(f.x0, f.x1), TOP + 0.05, cz + 0.55);
            }
        }

        /* ---- the railing along the top of both walls -------------------
           Merged rather than instanced: a hundred and twenty posts is one
           geometry either way and this one is already being merged. */
        for (const g of [{ z: NPAV1 + 0.9, sx0: NSX0, sx1: NSX1 },
                         { z: SPAV0 - 0.9, sx0: SSX0, sx1: SSX1 }]) {
            for (const r of runs([[-AB, AB], [g.sx0, g.sx1]])) {
                if (r[1] - r[0] < 2) continue;
                if (r[0] < -EDGE || r[1] > EDGE) { r[0] = Math.max(r[0], -EDGE); r[1] = Math.min(r[1], EDGE); }
                for (let x = r[0]; x < r[1] - 1; x += 2.6) {
                    PB(stone, RAILC, 0.10, 1.05, 0.10, x, TOP + 0.52, g.z);
                }
                BOX(stone, RAILC, r[0], TOP + 0.98, g.z - 0.05, r[1], TOP + 1.06, g.z + 0.05);
                BOX(stone, RAILC, r[0], TOP + 0.56, g.z - 0.04, r[1], TOP + 0.62, g.z + 0.04);
            }
        }

        /* ---- Alexandra Avenue ------------------------------------------ */
        const AZ0 = SKR.z - SKR.h, AZ1 = SKR.z + SKR.h;
        BOX(ground, ASPH, -180, -0.4, AZ0, 180, 0.015, AZ1);
        for (const r of [[-180, -SW], [SW, 180]]) {
            BOX(ground, PAVE, r[0], -0.4, AZ0 - FP, r[1], TOP, AZ0);
            BOX(ground, PAVE, r[0], -0.4, AZ1, r[1], TOP, AZ1 + FP);
            BOX(ground, KERBC, r[0], -0.4, AZ0 - 0.34, r[1], TOP + 0.02, AZ0);
            BOX(ground, KERBC, r[0], -0.4, AZ1, r[1], TOP + 0.02, AZ1 + 0.34);
        }

        /* ---- and the paving that gets a person on and off the bridge ----
           The street's own footpath is the flat band the road shader paints
           either side of Swanston and it has no height at all; the bridge's is
           a kerb up from the carriageway and five metres wide. Without this
           the walk down to the river was a step off a raised footway onto
           nothing, twice. */
        for (const sx of [-1, 1]) {
            for (const r of [[117.0, NPAV0 + 0.5], [SPAV1 - 0.5, AZ0 - FP], [AZ1 + FP, 304]]) {
                BOX(ground, PAVE, sx * 9.6, -0.4, r[0], sx * 19.6, TOP, r[1]);
                BOX(ground, KERBC, sx * 9.6, -0.4, r[0], sx * 9.94, TOP + 0.02, r[1]);
            }
        }

        /* ---- the lawn, the winding paths and the drum -------------------
           South-west, between the bank and Alexandra Avenue and again behind
           it, which is where this world has room for a garden. */
        BOX(ground, LAWN, -178, -0.4, SPAV1, -24, TOP - 0.02, AZ0 - FP);
        BOX(ground, LAWN, 24, -0.4, SPAV1, 178, TOP - 0.02, AZ0 - FP);
        BOX(ground, LAWN, -84, -0.4, AZ1 + FP, -24, TOP - 0.02, 352);
        // Two paths, each a chain of short slabs off a sine, because a garden
        // path that runs straight is a footpath with grass beside it.
        for (const w of [{ x0: -168, x1: -30, z: 244, amp: 3.4, ph: 0.0 },
                         { x0: -80, x1: -28, z: 316, amp: 5.5, ph: 1.7 }]) {
            const N = 26;
            for (let k = 0; k < N; k++) {
                const t0 = k / N, t1 = (k + 1) / N;
                const ax = lerp(w.x0, w.x1, t0), bx = lerp(w.x0, w.x1, t1);
                const az = w.z + Math.sin(t0 * 4.2 + w.ph) * w.amp;
                const bz = w.z + Math.sin(t1 * 4.2 + w.ph) * w.amp;
                const len = Math.hypot(bx - ax, bz - az) * 1.12;
                PB(ground, PATH, len, 0.06, 2.6, (ax + bx) / 2, TOP - 0.01, (az + bz) / 2,
                   0, -Math.atan2(bz - az, bx - ax), 0);
            }
        }
        /* The drum, set back in the garden under its pale dome. Built in
           courses — plinth, shaft, cornice, dome, lantern — because a cylinder
           with a lid on it is a water tank, and the difference between the two
           is entirely in what happens at the top and the bottom of the wall. */
        const DX = -48, DZ = 306;
        PG(built, 0xbdb5a4, put(cylG(16.4, 17.0, 1.20, 26), DX, 0.60, DZ));
        PG(built, 0xd4cdbc, put(cylG(15.2, 15.8, 9.60, 26), DX, 6.00, DZ));
        for (let k = 0; k < 20; k++) {                 // pilasters round the shaft
            const a = k / 20 * 6.283;
            PG(built, 0xe0dac9, put(boxG(0.85, 9.60, 0.50), DX + Math.sin(a) * 15.5, 6.00, DZ + Math.cos(a) * 15.5, 0, a, 0));
        }
        PG(built, 0xe6e0d0, put(cylG(16.9, 16.1, 1.30, 26), DX, 11.35, DZ));
        PG(built, 0xd9d2c0, put(cylG(14.4, 15.0, 1.40, 26), DX, 12.70, DZ));
        PG(built, 0xe9e4d6, put(sphG(14.4, 26, 10), DX, 13.10, DZ, 0, 0, 0, 1, 0.66, 1));
        PG(built, 0xd4cdbc, put(cylG(2.30, 2.90, 2.20, 12), DX, 23.20, DZ));
        PG(built, 0xe9e4d6, put(sphG(2.90, 12, 7), DX, 24.10, DZ, 0, 0, 0, 1, 0.70, 1));
        PG(built, 0xbfb7a4, put(cylG(0.14, 0.26, 2.40, 8), DX, 27.10, DZ));
        for (let k = 0; k < 16; k++) {                 // the lit openings at its foot
            const a = k / 16 * 6.283;
            PG(glow, 0xf6e6c4, put(boxG(1.5, 3.4, 0.30), DX + Math.sin(a) * 15.7, 4.4, DZ + Math.cos(a) * 15.7, 0, a, 0));
        }

        /* ---- south-east: the arts complex on the water ------------------
           Low, long and pale-roofed, standing on the bank with its river
           frontage over the promenade — the thing in the photograph with the
           restaurants under it. */
        BOX(built, 0xcfc7b4, 40, TOP, SPAV0 + 0.2, 130, 7.4, 240.0);
        BOX(built, 0xe7e2d4, 38, 7.4, SPAV0 - 0.8, 132, 8.5, 241.0);      // the pale roof
        BOX(built, 0xb9b1a0, 44, 8.5, 246.0, 96, 13.5, 258.0);            // and the block behind it
        BOX(built, 0xe7e2d4, 42, 13.5, 245.0, 98, 14.4, 259.0);
        for (let k = 0; k < 15; k++) {                                     // the glazed frontage
            PG(glow, 0xf3dfba, put(boxG(4.2, 1.9, 0.3), 44 + k * 5.8, 2.9, SPAV0 + 0.05));
        }
        // a wide stone forecourt in front of it, and the steps down to the quay
        BOX(ground, PAVE, 34, -0.4, SPAV1, 136, TOP + 0.02, SPAV1 + 4.0);

        /* ---- the blue-clad building, and the grey-roofed hall behind ---- */
        BOX(built, 0x93b4ce, 34, TOP, 292, 90, 26.0, 326);
        BOX(built, 0x8d99a4, 32, 26.0, 291, 92, 27.2, 327);
        BOX(built, 0xb6ada0, 100, TOP, 292, 158, 15.0, 322);
        BOX(built, 0x8b9096, 98, 15.0, 291, 160, 16.4, 323);

        /* ---- the boathouses and kiosks on the south water's edge --------
           Small, low and cheerful, which is the whole of what they are for:
           three bright roofs and a handful of umbrellas at river level, west
           of the bridge where the quay is widest. */
        const ROOFS = [0xc2503c, 0x3f9e97, 0xe4ded0, 0xc2503c, 0x3f9e97];
        for (let k = 0; k < 5; k++) {
            const kx = -104 + k * 17.5, kz = 218.6;
            BOX(built, 0xd8d2c2, kx - 3.2, QUAY, kz - 2.6, kx + 3.2, QUAY + 2.9, kz + 2.6);
            PG(built, ROOFS[k], put(coneG(5.0, 1.5, 4), kx, QUAY + 3.6, kz, 0, Math.PI / 4, 0));
            PG(glow, 0xf6e2b6, put(boxG(2.8, 0.70, 0.24), kx, QUAY + 1.85, kz - 2.7));
            // and the umbrellas outside, which is where anybody is actually sitting
            for (const u of [[-5.2, 3.4], [5.4, 3.0]]) {
                PG(built, k % 2 ? 0xe8e2d2 : 0xc2503c,
                   put(coneG(1.9, 0.55, 8), kx + u[0], QUAY + 2.55, kz + u[1]));
                PG(built, 0x9a938a, put(cylG(0.05, 0.05, 2.4, 6), kx + u[0], QUAY + 1.2, kz + u[1]));
            }
        }
        // a punt moored off the steps, and a second one further down
        for (const bp of [[-140, 209.5], [126, 208.0]]) {
            BOX(built, 0xe3ddcc, bp[0] - 5.5, WATER - 0.35, bp[1] - 1.35, bp[0] + 5.5, WATER + 0.55, bp[1] + 1.35);
            BOX(built, 0x8d5a3c, bp[0] - 4.2, WATER + 0.55, bp[1] - 1.0, bp[0] + 2.6, WATER + 0.80, bp[1] + 1.0);
            BOX(built, 0x3f9e97, bp[0] - 3.4, WATER + 0.80, bp[1] - 1.1, bp[0] + 1.4, WATER + 1.95, bp[1] + 1.1);
        }

        /* ---- the palms ---------------------------------------------------
           One geometry, twenty-eight matrices: a leaning trunk in rings and a
           crown of nine fronds, which at this scale is the whole of what a
           Canary Island date palm is from across a river. */
        /* Vertex-coloured, so a trunk can be trunk-coloured and a frond can be
           green out of one instanced draw. The instance colour still varies
           each tree, because it multiplies the vertex colour rather than
           replacing it — twenty-eight palms, one geometry, one mesh, and not
           one of them the same green. */
        const palm = [];
        for (let r = 0; r < 9; r++) {
            const t = r / 9;
            PG(palm, r % 2 ? 0xe6dcc4 : 0xd2c6ab,
               put(cylG(0.30 - t * 0.10, 0.36 - t * 0.10, 0.86, 7),
                   Math.sin(t * 1.6) * 0.55, 0.45 + r * 0.82, 0));
        }
        /* Fourteen fronds rather than nine, wider and shorter, and each one
           tapered by building it as two pieces: a stiff inner half and a
           drooping outer. Nine bare battens read from the far bank as a
           spider rather than as a palm. */
        for (let f = 0; f < 14; f++) {
            const a = f / 14 * 6.283 + (f % 2) * 0.18, droop = 0.30 + (f % 3) * 0.20;
            // droop it about its own axis first, then swing the whole thing
            // round the crown — one Euler could not do both in the right order
            const inner = boxG(0.62, 0.09, 2.20);
            put(inner, 0, 0, 1.15, droop * 0.55);
            PG(palm, 0xe8f0c8, put(inner, 0.9, 7.55, 0, 0, a, 0));
            const outer = boxG(0.44, 0.07, 2.30);
            put(outer, 0, -0.42, 3.30, droop * 1.35);
            PG(palm, 0xd6e2ae, put(outer, 0.9, 7.55, 0, 0, a, 0));
        }
        // and the dead skirt every date palm carries under the crown
        for (let f = 0; f < 8; f++) {
            const a = f / 8 * 6.283;
            const sk = boxG(0.36, 1.10, 0.30);
            put(sk, 0, 0, 1.00, -0.55);
            PG(palm, 0xb49a72, put(sk, 0.9, 7.05, 0, 0, a, 0));
        }
        const palmSpots = [];
        for (let k = 0; k < 9; k++) palmSpots.push([-150 + k * 15 + rr(-2, 2), 136.4 + rr(-1.2, 1.2)]);
        for (let k = 0; k < 5; k++) palmSpots.push([34 + k * 15 + rr(-2, 2), 136.4 + rr(-1.2, 1.2)]);
        for (let k = 0; k < 8; k++) palmSpots.push([-166 + k * 18 + rr(-3, 3), 243.0 + rr(-2.5, 2.5)]);
        for (let k = 0; k < 6; k++) palmSpots.push([-78 + k * 9 + rr(-3, 3), 296 + rr(-6, 26)]);
        const palmIM = new THREE.InstancedMesh(merge(palm),
            new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.82, metalness: 0.02 }),
            palmSpots.length);
        const ptint = new THREE.Color();
        palmSpots.forEach((p, i) => {
            const s = rr(0.82, 1.28);
            palmIM.setMatrixAt(i, MX(p[0], TOP, p[1], 0, rr(0, 6.28), 0, s, s, s));
            const v = rr(0.80, 1.14);
            ptint.setRGB(v * 0.96, v, v * 0.86);
            palmIM.setColorAt(i, ptint);
        });
        palmIM.instanceMatrix.needsUpdate = true;
        if (palmIM.instanceColor) palmIM.instanceColor.needsUpdate = true;
        scene.add(palmIM);
        world.ghost(palmIM);          // a frond is not something to walk into

        const banks = new THREE.Group();
        const groundMesh = merged(ground, new THREE.MeshStandardMaterial({
            vertexColors: true, roughness: 0.74, metalness: 0.04,
        }));
        banks.add(
            groundMesh,
            merged(stone, new THREE.MeshStandardMaterial({
                vertexColors: true, roughness: 0.70, metalness: 0.04,
            })),
            merged(built, new THREE.MeshStandardMaterial({
                vertexColors: true, roughness: 0.72, metalness: 0.05,
            })));
        const lit = merged(glow, emissive(0xd9cfb6, 0xffe6bc, 0.85));
        banks.add(lit); world.ghost(lit);
        scene.add(banks);
        world.part('riverbank_00', banks);
        /* And deliberately not `world.ground`. Everything here is walkable —
           `ground.js` rasterises every visible, un-ghosted, un-instanced mesh
           whatever a world calls it — but `world.ground` also decides how big
           the walk's grid is, and that is a different question with a much
           worse answer. The grid is five hundred and twelve cells across the
           largest declared solid that is not a flat sheet at ground level.
           These banks are a kilometre of paving with a six-metre drop in the
           middle of them, which is not flat and not small: declared, they take
           the corner of Flinders and Swanston from 1.46 m a cell to 2.34, or —
           if they end up the only non-flat solid in the list — recentre the
           whole field on the river and leave the city off the edge of it.
           So the quays and the flights collide, and the roadway still says
           where the walk is. */
    }

    /* ============================================================
       28 · what the footpath is actually full of

       The paving was a grey ribbon with trees standing in it and nothing
       else. Everything a person walks past on Swanston Street was missing:
       the planters at the kerb with their clipped shrubs, the bins in pairs,
       the hoops with bicycles locked to them, the share scooters — one of
       them, as always, lying on its side — the bollards, the benches, the
       pink phone pillar, the grey cabinets with stickers all over them, the
       boards outside the cafés, the plates on their posts and the grates set
       into the paving. That clutter is most of the difference between a
       street and a plane with buildings standing on it.

       Three meshes, for the whole of it.

       Two are instanced kits rather than instanced objects: a unit box and a
       unit tube, each carrying its own colour per instance. A bin is four
       tubes, a sandwich board is six boxes, a scooter is both — so a
       thousand pieces of street furniture come out of the pair in two draws.
       It is a stranger way to build than one geometry per kind of thing, and
       on a budget this tight it is the only way this much of it fits.

       The third is merged and solid, and holds what has real bulk: the beds,
       the benches, the leaning rails, the cabinets, the phone boxes, and the
       hoops with their bikes. Those are the things nobody should be able to
       walk through. Everything instanced is left out of the walk grid by
       `ground.js` — which is the right answer for the rest of it. You pass a
       bin; you do not climb one.

       Everything solid stays within about a metre and a half of the kerb.
       Only the instanced things go anywhere else — a board against the
       building line, a scooter dropped in the middle of the paving — because
       those are the ones the walk never sees. The footpath is seven metres
       wide and the grid rasterises at 1.365 m to the cell: fill the middle of
       it with solids and Swanston Street stops being walkable, which is a
       worse fault than an empty footpath.
       ============================================================ */
    {
        /* The paint chips. Read through `srgb` like everything else in this
           file, which means read twice — see section 0 — so these are
           written a shade brighter than the eye wants and land where the
           bollards and bins already standing in section 16 land. */
        const FC = {
            iron:    0x7e858c,     // galvanised street steel, the grey of everything
            ironLo:  0x4c5359,
            dark:    0x3d4348,     // the near-black of a bin drum, a bollard
            band:    0xc9cdd0,     // the reflective collar near the top of one
            yellow:  0xb8a52c,     // a recycling lid
            green:   0x4f7b64,     // the bottle green a utility cabinet is painted
            grey:    0x9a9c98,     // and the grey one beside it
            leaf:    0x6d8e4b,     // clipped shrub, into the sun
            leafLo:  0x4f6c36,     // and the side of it that never is
            soil:    0x4a4238,
            timber:  0xc0955f,     // bench slats
            pink:    0xff8ec6,     // Telstra
            white:   0xe4e0d6,
            deck:    0x6f777e,     // a share scooter
            deckAcc: 0xc8c2b4,
            tyre:    0x2b2f32,
            frame:   0xa6aaad,     // a bicycle, aluminium
            frameB:  0xa46854,     // and the one somebody sprayed maroon
            frameC:  0x4d8b9d,
            blue:    0x4f88c9,     // a street name blade
            red:     0xd0604c,
            board:   0x35312b,     // an A-frame's chalkboard
            boardRim:0x8a6c47,
            card:    0xa89272,     // cardboard, gone soft in the weather
            cup:     0xdad4c6,
            sticker: 0xcf6a3a,
        };
        const _fc = new Map();
        const FCOL = (hex) => { let c = _fc.get(hex); if (!c) { c = srgb(hex); _fc.set(hex, c); } return c; };
        const fpaint = (g, hex) => {
            const c = FCOL(hex), n = g.attributes.position.count, a = new Float32Array(n * 3);
            for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
            g.setAttribute('color', new THREE.BufferAttribute(a, 3));
            return g;
        };

        /* Everything below is written in the frame of the thing being built:
           local +x runs along the footpath, local +z points at the road, and
           local y = 0 is the top of the paving. One description of a bin
           stands up on either side of either street. */
        let FRAME = new THREE.Matrix4();
        const stand = (x, z, yaw, rx, rz, dy) => {
            FRAME = MX(x, KERB_H + (dy || 0), z, 0, yaw, 0);
            if (rx || rz) FRAME.multiply(MX(0, 0, 0, rx || 0, 0, rz || 0));
        };

        const IB = [], IBC = [], IT = [], ITC = [], SOLID = [];
        const iBox = (hex, w, h, d, x, y, z, rx, ry, rz) => {
            IB.push(new THREE.Matrix4().multiplyMatrices(FRAME, MX(x, y, z, rx, ry, rz, w, h, d)));
            IBC.push(hex);
        };
        const iTube = (hex, r, h, x, y, z, rx, ry, rz) => {
            IT.push(new THREE.Matrix4().multiplyMatrices(FRAME, MX(x, y, z, rx, ry, rz, r * 2, h, r * 2)));
            ITC.push(hex);
        };
        const sBox = (hex, w, h, d, x, y, z, rx, ry, rz) => {
            const g = boxG(w, h, d); put(g, x, y, z, rx, ry, rz);
            SOLID.push(fpaint(g.applyMatrix4(FRAME), hex));
        };
        const sTube = (hex, r, h, x, y, z, rx, ry, rz) => {
            const g = cylG(r, r, h, 10); put(g, x, y, z, rx, ry, rz);
            SOLID.push(fpaint(g.applyMatrix4(FRAME), hex));
        };
        const sBall = (hex, r, x, y, z, flat) => {
            const g = sphG(r, 9, 6); put(g, x, y, z, 0, rr(0, 6.28), 0, 1, flat || 0.78, 1);
            SOLID.push(fpaint(g.applyMatrix4(FRAME), hex));
        };
        const sRing = (hex, R, r, x, y, z, ry) => {
            const g = new THREE.TorusGeometry(R, r, 5, 14); put(g, x, y, z, 0, ry || 0, 0);
            SOLID.push(fpaint(g.applyMatrix4(FRAME), hex));
        };

        /* A tube between two points, which is how a bicycle is described and
           the only way a frame comes out looking like a frame rather than a
           set of boxes. */
        const _sa = new THREE.Vector3(), _sb = new THREE.Vector3(), _sd = new THREE.Vector3();
        const _sq = new THREE.Quaternion(), _sy = new THREE.Vector3(0, 1, 0), _s1 = new THREE.Vector3(1, 1, 1);
        const strut = (ax, ay, az, bx, by, bz) => {
            _sa.set(ax, ay, az); _sb.set(bx, by, bz);
            _sd.subVectors(_sb, _sa);
            const len = Math.max(_sd.length(), 1e-4);
            _sq.setFromUnitVectors(_sy, _sd.divideScalar(len));
            return { len, m: new THREE.Matrix4().compose(_sa.lerp(_sb, 0.5), _sq, _s1) };
        };
        const sLeg = (hex, r, ax, ay, az, bx, by, bz) => {
            const s = strut(ax, ay, az, bx, by, bz);
            const g = cylG(r, r, s.len, 7);
            SOLID.push(fpaint(g.applyMatrix4(s.m).applyMatrix4(FRAME), hex));
        };
        const iLeg = (hex, r, ax, ay, az, bx, by, bz) => {
            const s = strut(ax, ay, az, bx, by, bz);
            IT.push(new THREE.Matrix4().multiplyMatrices(FRAME, s.m)
                .multiply(new THREE.Matrix4().makeScale(r * 2, s.len, r * 2)));
            ITC.push(hex);
        };

        /* ---- the things themselves ----------------------------------- */

        // A planter bed: steel edging, wet soil, and three or four clipped
        // shrubs that have been cut square once and then left to it.
        const planter = (len) => {
            const d = 1.05, w = 0.07;
            sBox(FC.ironLo, len, 0.44, w, 0, 0.22, d / 2);
            sBox(FC.ironLo, len, 0.44, w, 0, 0.22, -d / 2);
            sBox(FC.ironLo, w, 0.44, d, len / 2, 0.22, 0);
            sBox(FC.ironLo, w, 0.44, d, -len / 2, 0.22, 0);
            sBox(FC.soil, len - 0.13, 0.34, d - 0.13, 0, 0.17, 0);
            const n = Math.max(2, Math.round(len / 1.15));
            for (let i = 0; i < n; i++) {
                const x = -len / 2 + len * ((i + 0.5) / n) + rr(-0.12, 0.12);
                const r = rr(0.30, 0.44);
                sBall(rnd() < 0.4 ? FC.leafLo : FC.leaf, r, x, 0.34 + r * 0.62, rr(-0.14, 0.14));
                if (rnd() < 0.55) sBall(FC.leaf, r * 0.72, x + rr(-0.2, 0.2), 0.34 + r * 1.05, rr(-0.2, 0.2));
            }
        };

        // The bench outside a shop: two cast ends, five slats and a back.
        const bench = () => {
            for (const s of [-0.78, 0.78]) {
                sBox(FC.ironLo, 0.07, 0.43, 0.52, s, 0.215, 0);
                sBox(FC.ironLo, 0.07, 0.40, 0.06, s, 0.63, -0.20, 0.22);
            }
            for (let i = 0; i < 4; i++) sBox(FC.timber, 1.72, 0.045, 0.10, 0, 0.45, -0.19 + i * 0.14);
            for (let i = 0; i < 3; i++) sBox(FC.timber, 1.72, 0.045, 0.10, 0, 0.60 + i * 0.14, -0.24 - i * 0.032, 0.22);
        };

        // A leaning rail, which is what this city puts where a bench will not fit.
        const leanRail = (len) => {
            for (const s of [-len / 2 + 0.1, len / 2 - 0.1]) {
                sTube(FC.iron, 0.045, 0.76, s, 0.38, 0.06, 0.14);
                sTube(FC.iron, 0.035, 0.42, s, 0.21, -0.16, -0.5);
            }
            sTube(FC.iron, 0.05, len, 0, 0.74, 0.11, 0, 0, Math.PI / 2);
            sTube(FC.iron, 0.035, len - 0.3, 0, 0.44, 0.07, 0, 0, Math.PI / 2);
        };

        // The tall public bins, which come in pairs — one for rubbish, one
        // for the bottles, and only the lid says which.
        const binPair = () => {
            [[-0.42, FC.dark], [0.42, FC.yellow]].forEach(([x, lid], i) => {
                const yaw = rr(-0.2, 0.2);
                iTube(FC.dark, 0.31, 1.02, x, 0.51, 0, 0, yaw, 0);
                iTube(FC.ironLo, 0.335, 0.07, x, 0.035, 0);
                iTube(FC.band, 0.325, 0.045, x, 0.86, 0);
                iTube(lid, 0.35, 0.13, x, 1.085, 0);
                iBox(0x1a1c1e, 0.30, 0.17, 0.05, x + Math.sin(yaw) * 0.3, 0.95, 0.30, 0, yaw, 0);
                if (i === 1) iBox(FC.white, 0.16, 0.20, 0.02, x + Math.sin(yaw) * 0.32, 0.62, 0.315, 0, yaw, 0);
            });
        };

        // And the wheelie bin a shop has left out and not brought back in.
        const wheelie = () => {
            iBox(FC.green, 0.60, 0.94, 0.70, 0, 0.53, 0, 0.06);
            iBox(rnd() < 0.5 ? FC.yellow : FC.red, 0.63, 0.09, 0.73, 0, 1.03, -0.02, 0.06);
            for (const s of [-0.24, 0.24]) iTube(FC.dark, 0.085, 0.06, s, 0.085, -0.30, 0, 0, Math.PI / 2);
            iBox(FC.dark, 0.06, 0.30, 0.06, 0, 1.14, -0.30);
        };

        // A bike hoop — the flattened staple this city bolts to its footpaths.
        const hoop = () => {
            for (const s of [-0.36, 0.36]) sTube(FC.iron, 0.032, 0.60, s, 0.30, 0);
            for (const s of [-1, 1]) sLeg(FC.iron, 0.032, s * 0.36, 0.60, 0, s * 0.24, 0.72, 0);
            sTube(FC.iron, 0.032, 0.50, 0, 0.72, 0, 0, 0, Math.PI / 2);
            for (const s of [-0.36, 0.36]) sTube(FC.ironLo, 0.055, 0.05, s, 0.025, 0);
        };

        /* A bicycle locked to one, leaning the way a locked bicycle leans.
           Built without a rider: the fleet that used to run in this world had
           one modelled into the geometry and the fleet is gone. */
        const bicycle = (hex) => {
            const RW = -0.53, FW = 0.55, BB = -0.06, SEAT = -0.24, HEAD = 0.40;
            sRing(FC.tyre, 0.325, 0.028, RW, 0.325, 0);
            sRing(FC.tyre, 0.325, 0.028, FW, 0.325, 0);
            sTube(FC.frame, 0.055, 0.035, RW, 0.325, 0, 0, 0, Math.PI / 2);
            sTube(FC.frame, 0.055, 0.035, FW, 0.325, 0, 0, 0, Math.PI / 2);
            sLeg(hex, 0.030, BB, 0.29, 0, SEAT + 0.02, 1.00, 0);          // seat tube
            sLeg(hex, 0.030, BB, 0.29, 0, HEAD, 0.94, 0);                 // down tube
            sLeg(hex, 0.028, SEAT + 0.02, 0.97, 0, HEAD + 0.02, 1.00, 0); // top tube
            sLeg(hex, 0.022, BB, 0.29, 0, RW, 0.325, 0);                  // chain stay
            sLeg(hex, 0.020, SEAT + 0.02, 0.96, 0, RW, 0.325, 0);         // seat stay
            sLeg(hex, 0.024, HEAD + 0.02, 0.98, 0, FW, 0.325, 0);         // fork
            sTube(FC.dark, 0.055, 0.10, SEAT - 0.02, 1.05, 0);            // saddle
            sBox(FC.dark, 0.26, 0.05, 0.11, SEAT - 0.02, 1.07, 0, 0, 0, -0.14);
            sTube(FC.dark, 0.018, 0.44, HEAD + 0.05, 1.03, 0, Math.PI / 2, 0, 0);
            sTube(FC.frame, 0.028, 0.14, BB, 0.29, 0, Math.PI / 2, 0, 0); // the crank
        };

        /* A share scooter. Upright on its stand, or — and the photograph has
           one — lying flat on the paving where somebody dropped it. Either
           way it is the same eleven pieces; the frame it stands in is the
           only thing that differs. */
        const scooter = (acc) => {
            iBox(FC.deck, 0.56, 0.055, 0.17, 0, 0.155, 0);
            iBox(FC.deck, 0.10, 0.09, 0.19, -0.26, 0.14, 0);
            for (const [s, y] of [[-0.28, 0.115], [0.26, 0.115]]) {
                iTube(FC.tyre, 0.115, 0.055, s, y, 0, Math.PI / 2, 0, 0);
                iTube(FC.deckAcc, 0.05, 0.06, s, y, 0, Math.PI / 2, 0, 0);
            }
            iLeg(FC.deck, 0.026, 0.24, 0.18, 0, 0.17, 1.03, 0);
            iBox(acc, 0.09, 0.26, 0.13, 0.185, 0.66, 0, 0, 0, 0.06);
            iTube(FC.deck, 0.017, 0.46, 0.17, 1.05, 0, Math.PI / 2, 0, 0);
            for (const s of [-0.20, 0.20]) iTube(FC.dark, 0.024, 0.10, 0.17, 1.05, s, Math.PI / 2, 0, 0);
            iBox(FC.deckAcc, 0.10, 0.07, 0.05, 0.17, 1.11, 0);
            iTube(FC.ironLo, 0.014, 0.20, -0.20, 0.09, 0.06, 0.5);        // the stand
        };

        // The pink pillar. There is one of these on nearly every block of
        // this street and it is the most recognisable thing standing on it.
        const phoneBox = () => {
            sBox(FC.ironLo, 0.80, 0.09, 0.52, 0, 0.045, 0);
            sBox(FC.pink, 0.72, 2.24, 0.44, 0, 1.16, 0);
            sBox(FC.white, 0.60, 1.16, 0.03, 0, 1.42, 0.225);
            sBox(FC.dark, 0.34, 0.46, 0.04, 0, 1.34, 0.245);
            sBox(FC.dark, 0.07, 0.26, 0.05, -0.20, 1.34, 0.245);
            sBox(FC.white, 0.82, 0.20, 0.52, 0, 2.36, 0);
            sBox(FC.pink, 0.74, 0.10, 0.46, 0, 2.50, 0);
            sBox(FC.white, 0.46, 0.30, 0.03, 0, 2.02, 0.228);
            sBox(FC.pink, 0.30, 0.16, 0.03, 0, 0.44, 0.228);
        };

        // The steel boxes: a signal controller, a comms cabinet, whatever the
        // grey one on the corner is. Stickered, and sprayed at least once.
        const cabinet = (tall) => {
            const w = tall ? 0.58 : 0.86, h = tall ? 1.52 : 1.24, d = tall ? 0.40 : 0.48;
            const body = tall ? FC.green : FC.grey;
            sBox(FC.ironLo, w + 0.08, 0.09, d + 0.08, 0, 0.045, 0);
            sBox(body, w, h, d, 0, 0.09 + h / 2, 0);
            sBox(FC.ironLo, w + 0.05, 0.06, d + 0.05, 0, 0.12 + h, 0);
            sBox(FC.ironLo, 0.03, h - 0.16, 0.02, 0, 0.09 + h / 2, d / 2 + 0.005);
            for (let i = 0; i < irr(2, 5); i++) {
                sBox(rnd() < 0.5 ? FC.sticker : FC.white,
                     rr(0.07, 0.16), rr(0.08, 0.15), 0.012,
                     rr(-w / 2 + 0.12, w / 2 - 0.12), rr(0.5, h - 0.1), d / 2 + 0.006);
            }
            if (rnd() < 0.6) sBox(FC.dark, w * 0.7, 0.22, 0.012, rr(-0.1, 0.1), rr(0.6, 1.0), d / 2 + 0.008, 0, 0, rr(-0.2, 0.2));
        };

        // The board outside a café, angled at the footpath so it can be read
        // from up the street rather than from in front of it.
        const aFrame = () => {
            for (const s of [-1, 1]) {
                iBox(FC.boardRim, 0.66, 0.94, 0.035, 0, 0.47, s * 0.15, s * 0.19);
                iBox(FC.board, 0.56, 0.80, 0.015, 0, 0.47, s * 0.165, s * 0.19);
                for (let i = 0; i < 3; i++) {
                    iBox(FC.white, rr(0.16, 0.40), 0.035, 0.006, rr(-0.06, 0.06),
                         0.62 - i * 0.17, s * 0.185, s * 0.19);
                }
            }
            iTube(FC.boardRim, 0.02, 0.60, 0, 0.90, 0, Math.PI / 2, 0, 0);
        };

        // Plates on a post: a one-way arrow, a no-standing, a clearway, and
        // the blue blade with the street's name on it.
        const signPost = (blade) => {
            iTube(FC.iron, 0.042, 2.72, 0, 1.36, 0);
            iTube(FC.ironLo, 0.075, 0.10, 0, 0.05, 0);
            let y = 2.28;
            const n = irr(1, 2);
            for (let i = 0; i < n; i++) {
                const kind = rnd();
                if (kind < 0.36) {                       // a one-way arrow
                    iBox(FC.white, 0.62, 0.24, 0.022, 0, y, 0.03);
                    iBox(FC.dark, 0.40, 0.055, 0.010, -0.04, y, 0.043);
                    iBox(FC.dark, 0.11, 0.11, 0.010, 0.19, y, 0.043, 0, 0, 0.78);
                } else if (kind < 0.72) {                // no standing
                    iBox(FC.white, 0.30, 0.44, 0.022, 0, y, 0.03);
                    iBox(FC.red, 0.24, 0.05, 0.010, 0, y + 0.10, 0.043);
                    iBox(FC.dark, 0.20, 0.05, 0.010, 0, y - 0.06, 0.043);
                } else {                                 // a clearway plate
                    iBox(FC.white, 0.34, 0.52, 0.022, 0, y, 0.03);
                    iBox(FC.red, 0.26, 0.26, 0.012, 0, y + 0.09, 0.043);
                    iBox(FC.dark, 0.24, 0.06, 0.010, 0, y - 0.16, 0.043);
                }
                y -= 0.60;
            }
            if (blade) {
                iBox(FC.blue, 0.98, 0.21, 0.025, 0.30, 2.60, 0, 0, 0, 0);
                iBox(FC.white, 0.92, 0.04, 0.028, 0.30, 2.68, 0);
                iBox(FC.white, 0.92, 0.04, 0.028, 0.30, 2.52, 0);
            }
        };

        // What is set into the paving rather than standing on it.
        const grate = () => {
            iBox(FC.ironLo, 1.02, 0.05, 0.44, 0, 0.015, 0);
            for (let i = 0; i < 6; i++) iBox(0x1c1e20, 0.075, 0.03, 0.32, -0.38 + i * 0.152, 0.030, 0);
        };
        const lid = () => {
            iTube(FC.ironLo, 0.34, 0.05, 0, 0.015, 0);
            iTube(FC.iron, 0.26, 0.03, 0, 0.028, 0);
            iBox(FC.ironLo, 0.34, 0.02, 0.05, 0, 0.036, 0, 0, rr(0, 3), 0);
        };

        // And the mess. A little of it says a city; much of it says a tip.
        const mess = (kind) => {
            if (kind === 0) {                            // a dropped cup
                iTube(FC.cup, 0.042, 0.115, 0, 0.058, 0, rr(-0.1, 1.5), rr(0, 3), 0);
                iTube(FC.white, 0.045, 0.02, 0, 0.12, 0);
            } else if (kind === 1) {                     // a box flattened by a doorway
                iBox(FC.card, 0.72, 0.025, 0.52, 0, 0.014, 0, 0, rr(0, 3), 0);
                iBox(FC.card, 0.50, 0.025, 0.38, rr(-0.2, 0.2), 0.040, rr(-0.2, 0.2), 0, rr(0, 3), 0);
            } else {                                     // a pallet of stock
                const yaw = rr(-0.4, 0.4);
                for (let i = 0; i < 5; i++) iBox(FC.card, 1.14, 0.045, 0.10, 0, 0.11, -0.35 + i * 0.175, 0, yaw, 0);
                for (const s of [-0.5, 0, 0.5]) iBox(FC.card, 0.12, 0.10, 0.82, s, 0.05, 0, 0, yaw, 0);
                for (let i = 0; i < irr(2, 4); i++) {
                    iBox(rnd() < 0.5 ? FC.card : FC.white, rr(0.5, 0.9), rr(0.22, 0.34), rr(0.4, 0.6),
                         rr(-0.2, 0.2), 0.28 + i * 0.30, rr(-0.1, 0.1), 0, yaw + rr(-0.3, 0.3), 0);
                }
            }
        };

        /* ---- where all of it goes ------------------------------------

           A footpath, described the way you walk one: which axis it runs
           along, where its kerb is, and which way the buildings are. `out`
           is always measured in from the kerb, so one recipe stands up on
           four sides of four streets without a single mirrored copy. */
        const WALKS = [
            // Swanston, both sides, the whole of its built length. The west
            // side stops at Flinders Street: south of it the footpath climbs
            // onto the station's granite plinth, which is not a footpath.
            { ax: 'z', kerb: -SW, into: -1, a0: -396, a1: -18 },
            { ax: 'z', kerb: SW, into: 1, a0: -396, a1: 112 },
        ];
        /* and the three cross streets, both kerbs of each, out to about where
           the modelled frontage gives way to the merged backdrop. `NST`
           carries half-widths, so the kerb is the centre plus or minus one
           and the footpath is on the far side of it. */
        for (const S of NST) {
            WALKS.push({ ax: 'x', kerb: S.z + S.h, into: 1, a0: -102, a1: 102 });
            WALKS.push({ ax: 'x', kerb: S.z - S.h, into: -1, a0: -102, a1: 102 });
        }

        // Where a thing goes, and which way it looks. A footpath's furniture
        // faces the road, because that is where it is read from.
        const site = (w, a, out) => {
            const p = w.kerb + w.into * out;
            return w.ax === 'z' ? { x: p, z: a, yaw: -w.into * Math.PI / 2 }
                                : { x: a, z: p, yaw: w.into < 0 ? 0 : Math.PI };
        };
        const put_ = (w, a, out, yawOff, rx, rz, dy) => {
            const s = site(w, a, out);
            stand(s.x, s.z, s.yaw + (yawOff || 0), rx, rz, dy);
        };

        /* What has to be left alone.

           The tram poles stand at 1.2 to 1.4 m off the Swanston kerb, which
           is exactly where a planter wants to be; the crossings have to stay
           clear at every corner, kerb ramps included; and the Town Hall's
           frontage is being rebuilt tonight by somebody else, so nothing
           solid goes in front of it. */
        const POLEZ = [];
        for (let i = 0; i < 6; i++) { const z = -20 - i * 26; POLEZ.push(z, -z); }
        for (let i = 0; i < 9; i++) { const z = -130 - i * 26; if (z >= NZ_END) POLEZ.push(z); }

        const barred = (w, a) => {
            if (w.ax === 'z') {
                for (const X of XSEC) if (Math.abs(a - X.z) < X.h + 4.0) return true;
                for (const z of POLEZ) if (Math.abs(a - z) < 2.1) return true;
                return false;
            }
            return Math.abs(a) < SW + 4.5;
        };
        // The Town Hall's footpath, and the run on the east side where
        // section 16 has already stood a line of bollards.
        const noSolid = (w, a) => w.ax === 'z' && w.into > 0 && a > -316 && a < -262;
        const preBollard = (w, a) => w.ax === 'z' && w.into > 0 && a > -54 && a < -18;

        // How far the nearest crossing is, which is the one number the whole
        // distribution turns on.
        const toCorner = (w, a) => {
            if (w.ax !== 'z') return Math.abs(a) - SW;
            let best = 1e9;
            for (const X of XSEC) best = Math.min(best, Math.abs(a - X.z) - X.h);
            return best;
        };

        /* The menu, weighted twice: once for a corner and once for the middle
           of a block, and mixed between the two by how close this spot is to
           a crossing. It is the whole reason the street does not read as a
           grid — bins and signs and boxes gather where the crossings are, and
           two thirds of the way down a block there is a planter and nothing
           else for twenty metres. */
        const MENU = [
            ['planter', 1.9, 0.5], ['bins', 0.4, 1.5], ['hoops', 1.0, 0.6],
            ['scooters', 0.9, 1.0], ['bench', 0.75, 0.25], ['rail', 0.35, 0.5],
            ['cabinet', 0.5, 1.25], ['aframe', 0.85, 0.35], ['sign', 0.6, 1.5],
            ['drain', 0.55, 0.8], ['wheelie', 0.35, 0.25], ['mess', 0.45, 0.4],
        ];

        let messes = 0;
        const place = (w, a, tight) => {
            let total = 0;
            for (const m of MENU) total += lerp(m[1], m[2], tight);
            let r = rnd() * total, kind = MENU[0][0];
            for (const m of MENU) { r -= lerp(m[1], m[2], tight); if (r <= 0) { kind = m[0]; break; } }
            const solidOK = !noSolid(w, a);

            switch (kind) {
                case 'planter': {
                    if (!solidOK) return 0;
                    const len = rr(2.0, 3.4);
                    put_(w, a, rr(0.92, 1.12));
                    planter(len);
                    return len;
                }
                case 'bench':
                    if (!solidOK) return 0;
                    put_(w, a, rr(1.05, 1.35), rr(-0.06, 0.06));
                    bench();
                    return 1.9;
                case 'rail':
                    if (!solidOK) return 0;
                    put_(w, a, rr(0.85, 1.05));
                    leanRail(rr(2.0, 3.0));
                    return 2.6;
                case 'cabinet':
                    if (!solidOK) return 0;
                    put_(w, a, rr(1.0, 1.35), rr(-0.12, 0.12));
                    cabinet(rnd() < 0.5);
                    if (rnd() < 0.35) { put_(w, a + 1.15, rr(1.0, 1.3), rr(-0.1, 0.1)); cabinet(true); return 2.2; }
                    return 1.2;
                case 'hoops': {
                    if (!solidOK) return 0;
                    const n = irr(2, 4);
                    for (let i = 0; i < n; i++) {
                        const at = a + i * 1.35;
                        put_(w, at, rr(0.95, 1.15));
                        hoop();
                        if (rnd() < 0.6) {
                            put_(w, at + rr(-0.25, 0.25), rr(0.90, 1.20), rr(-0.25, 0.25),
                                 rr(0.10, 0.21) * (rnd() < 0.5 ? -1 : 1));
                            bicycle(pickOf([FC.frame, FC.frameB, FC.frameC, FC.dark]));
                        }
                    }
                    return (n - 1) * 1.35;
                }
                case 'scooters': {
                    const n = irr(1, 3);
                    for (let i = 0; i < n; i++) {
                        const at = a + i * rr(0.7, 1.1);
                        const acc = pickOf([0xc23a2e, 0x2f6f4a, 0xc9a32b, 0x2b4f86]);
                        if (rnd() < 0.24) {
                            // and one on its side, which is the thing the
                            // photograph actually shows
                            put_(w, at, rr(1.7, 3.4), rr(0, 6.28), Math.PI / 2, 0, 0.10);
                            scooter(acc);
                        } else {
                            put_(w, at, rr(0.75, 1.15), rr(-0.4, 0.4));
                            scooter(acc);
                        }
                    }
                    return (n - 1) * 0.9;
                }
                case 'bins':
                    put_(w, a, rr(0.85, 1.05), rr(-0.2, 0.2));
                    binPair();
                    return 1.1;
                case 'wheelie':
                    put_(w, a, FP - rr(0.6, 1.1), rr(-0.5, 0.5) + Math.PI);
                    wheelie();
                    return 0.8;
                case 'aframe':
                    put_(w, a, FP - rr(0.9, 1.6), rr(-0.7, 0.7));
                    aFrame();
                    return 0.9;
                case 'sign':
                    put_(w, a, rr(0.45, 0.70), rr(-0.15, 0.15));
                    signPost(rnd() < 0.3);
                    return 0.4;
                case 'drain':
                    if (rnd() < 0.55) { put_(w, a, rr(0.32, 0.45)); grate(); return 1.1; }
                    put_(w, a, rr(0.9, 2.6), rr(0, 3)); lid(); return 0.7;
                case 'mess':
                    if (messes > 26) return 0;
                    messes++;
                    if (rnd() < 0.42) { put_(w, a, rr(0.8, 4.2), rr(0, 6.28)); mess(0); return 0.2; }
                    if (rnd() < 0.6) { put_(w, a, FP - rr(0.5, 1.2), rr(0, 6.28)); mess(1); return 0.7; }
                    put_(w, a, FP - rr(0.9, 1.5), rr(-0.5, 0.5)); mess(2);
                    return 1.3;
            }
            return 0;
        };

        for (const w of WALKS) {
            let a = w.a0 + rr(0, 9);
            while (a < w.a1) {
                const tight = smoothstep(40, 7, toCorner(w, a));
                if (!barred(w, a)) a += place(w, a, tight);
                a += lerp(rr(3.6, 10.5), rr(1.6, 4.2), tight);
            }
        }

        /* And the bollard line, which is laid down the kerb rather than drawn
           out of the menu above — because that is how it goes in. A council
           does not scatter bollards; it runs a line of them across a corner,
           stops for a crossing or a loading bay, and starts again. So a run
           of thirty or seventy metres, then a gap of ten or twenty, up both
           sides of Swanston and out along the three cross streets — and never
           where section 16 has already stood a line of its own. */
        for (const w of WALKS) {
            let a = w.a0 + rr(0, 14);
            while (a < w.a1) {
                const run = w.ax === 'z' ? rr(26, 74) : rr(14, 38);
                const out = rr(0.50, 0.58);
                for (let at = a; at < a + run && at < w.a1; at += 2.2) {
                    if (barred(w, at) || preBollard(w, at)) continue;
                    put_(w, at, out);
                    iTube(FC.dark, 0.115, 0.94, 0, 0.47, 0);
                    iTube(FC.band, 0.122, 0.055, 0, 0.79, 0);
                }
                a += run + rr(6, 21);
            }
        }

        /* The four phone boxes, sited by hand rather than drawn out of the
           menu. There is one on nearly every block of the real street and
           there is one in the photograph; a landmark that lands where the
           dice put it is not a landmark. */
        for (const [x, z, yaw] of [
            [-(SW + 1.55), -103.0, Math.PI / 2],       // west side, short of Flinders Lane
            [SW + 1.55, -60.0, -Math.PI / 2],          // east, along the cathedral's railing
            [SW + 1.60, -196.0, -Math.PI / 2],         // east, at the City Square end
            [-(SW + 1.55), -255.0, Math.PI / 2],       // west, north of Collins
        ]) {
            stand(x, z, yaw + rr(-0.05, 0.05));
            phoneBox();
        }

        /* ---- and out of all that, three meshes ---------------------- */

        // three only lets an instance's own colour reach the fragment when
        // the material declares vertexColors — and a material that declares
        // it over geometry with no colour attribute draws black, because a
        // missing attribute reads as zero. So both kits carry a white one.
        const white = (g) => {
            const n = g.attributes.position.count, a = new Float32Array(n * 3);
            a.fill(1);
            g.setAttribute('color', new THREE.BufferAttribute(a, 3));
            return g;
        };
        // Metalness stays near zero on all three. There is no envMap in this
        // world, and a metallic standard material without one renders black —
        // which is how a street of galvanised steel becomes a street of holes.
        const kitMat = () => new THREE.MeshStandardMaterial({
            vertexColors: true, roughness: 0.58, metalness: 0.04,
        });

        const boxIM = new THREE.InstancedMesh(white(boxG(1, 1, 1)), kitMat(), IB.length);
        /* Eight sides, which is what section 16's bollards are cut from and as
           many as anything 230 mm across earns at walking distance. Twelve
           costs forty thousand triangles across the street and shows on
           nothing. */
        const tubeIM = new THREE.InstancedMesh(white(cylG(0.5, 0.5, 1, 8)), kitMat(), IT.length);
        const tint = new THREE.Color();
        IB.forEach((m, i) => { boxIM.setMatrixAt(i, m); boxIM.setColorAt(i, tint.copy(FCOL(IBC[i]))); });
        IT.forEach((m, i) => { tubeIM.setMatrixAt(i, m); tubeIM.setColorAt(i, tint.copy(FCOL(ITC[i]))); });
        for (const m of [boxIM, tubeIM]) {
            m.instanceMatrix.needsUpdate = true;
            if (m.instanceColor) m.instanceColor.needsUpdate = true;
            scene.add(m);
        }

        const kerbside = merged(SOLID, new THREE.MeshStandardMaterial({
            vertexColors: true, roughness: 0.60, metalness: 0.04,
        }));
        scene.add(kerbside);
        /* Not `world.ground`, and not `world.part` either. The grid is sized
           off the declared grounds and a new one would coarsen the whole
           city's walk; and a single mesh holding every planter on Swanston
           Street is not one object anybody would want to pick up — it is
           scenery that happens to be solid, which is exactly what it is left
           as. Splitting it into eighty parts is eighty meshes, and there are
           three to spend here. */
    }
}
