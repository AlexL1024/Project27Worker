//
//  berth-mark.scene.js
//  Berth Mark — a station cavern built around one thing being true:
//  the train stops where it is supposed to stop.
//
//  The section is drawn once and everything else is hung off it. Half a metre
//  of error anywhere in this column and a 3.05 m car ends up standing on the
//  platform slab, outboard of its own screen doors:
//
//      x  0.00   platform centreline
//      x  6.20   tactile strip
//      x  6.50   yellow line
//      x  6.85   platform screen doors
//      x  7.00   platform edge / coping        <- nothing crosses this
//      x  7.105  train bodyside                   (105 mm platform gap)
//      x  8.65   track centreline                 (7.105 + 1.545 half-body)
//      x 11.05   cavern springing / tunnel face
//      y  0.00   platform level
//      y -0.92   railhead — puts the door sill 20 mm low, a level board
//
//  Because the section is right, the doors can line up. Every screen-door
//  opening is placed at the exact z of a car door on a berthed seven-car
//  HCMT — the positions are read out of the train module's own livery
//  layouts, so the glass cannot drift out of step with the train — and the
//  two sets of leaves slide together. The stop mark at z ±78.8 is where the
//  nose comes to rest, to the centimetre, every cycle, and the readout on the
//  column counts the error down to nothing while you watch.
//
//  Written against the Project27 runtime; the app keeps the camera, the loop
//  and the walk.
//

import { buildHCMT } from './hcmt.scene.js';

export default function build(world) {
    const { THREE, scene } = world;

    world.ownsSky(true);
    world.groundLevel(0);
    world.bloom({ strength: 0.34, radius: 0.6, threshold: 0.80 });

    /* ============================================================
       0 · the section, and the helpers everything is built with
       ============================================================ */
    const LEN = 176, HALF = LEN / 2;      // cavern length, z in [-88, 88]
    const PW = 7.00;                      // platform half-width / edge
    const PSD_X = 6.85;                   // screen-door plane
    const TRACK_X = 8.65;                 // track centreline
    const GAUGE = 0.7175;                 // half standard gauge
    const RAIL_Y = -0.92;                 // railhead, below platform level
    const TUN_X = 11.05;                  // cavern springing / tunnel face
    const R = 11.20, CY = 1.20;           // vault radius / centre (crown 12.4)
    const BAY = 5.5;                      // structural bay
    const COL_X = 3.6;                    // blade column line
    const BEAM_Y = 5.0, BEAM_H = 0.9;
    const ARCH_Y0 = 5.55, ARCH_H = 4.15;
    const PSD_H = 2.95;                   // top of the screen-door glass
    const HEAD_Y0 = 3.05, HEAD_Y1 = 5.35; // dark header band above the doors
    const SOFFIT_Y = 5.45;                // dark ceiling over the tracks
    const TL = 520;                       // trackway run through the portals
    const FOG_COL = 0x6d6c68, FOG_NEAR = 34, FOG_FAR = 155;

    const tex = (w, h, draw, rx, ry) => {
        const t = world.canvasTexture(w, h, (ctx, cv) => draw(ctx, cv.width, cv.height));
        if (rx || ry) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx || 1, ry || 1); }
        return t;
    };
    const reTex = (src, rx, ry) => {
        const t = src.clone();
        t.wrapS = t.wrapT = THREE.RepeatWrapping;
        t.repeat.set(rx, ry);
        t.needsUpdate = true;
        return t;
    };
    const M = (x, y, z, rx, ry, rz) => {
        const m = new THREE.Matrix4();
        m.compose(new THREE.Vector3(x, y, z),
            new THREE.Quaternion().setFromEuler(new THREE.Euler(rx || 0, ry || 0, rz || 0)),
            new THREE.Vector3(1, 1, 1));
        return m;
    };
    function mergeGeos(items) {
        const pos = [], nor = [], uv = [];
        const nm = new THREE.Matrix3(), v = new THREE.Vector3();
        for (const it of items) {
            const src = it.geo.index ? it.geo.toNonIndexed() : it.geo;
            const p = src.attributes.position, no = src.attributes.normal, u = src.attributes.uv;
            const m = it.m || new THREE.Matrix4();
            nm.getNormalMatrix(m);
            for (let i = 0; i < p.count; i++) {
                v.fromBufferAttribute(p, i).applyMatrix4(m); pos.push(v.x, v.y, v.z);
                if (no) { v.fromBufferAttribute(no, i).applyMatrix3(nm).normalize(); nor.push(v.x, v.y, v.z); }
                else nor.push(0, 1, 0);
                if (u) uv.push(u.getX(i), u.getY(i)); else uv.push(0, 0);
            }
            if (src !== it.geo) src.dispose();
        }
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
        g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
        return g;
    }
    const smooth = (x) => { const t = Math.min(1, Math.max(0, x)); return t * t * (3 - 2 * t); };

    /* ============================================================
       1 · where the doors are
       ------------------------------------------------------------
       Read straight off the HCMT module's livery layouts: a car door drawn
       at metre d, on a car whose texture origin sits at car-local z = u0,
       lands at z = u0 - (d + w/2). Change the train and this follows.
       ============================================================ */
    const CAR_L = 22, GAP_C = 0.6, NOSE_L = 3.4, PITCH = CAR_L + GAP_C;   // 22.6
    const CAB_BODY_L = CAR_L - NOSE_L;                                    // 18.6
    const DOOR_W = 1.7;
    const MID_D = [2.3, 10.0, 16.9];
    const CAB_D = [2.1, 8.7, 14.4];
    const CAB_U0 = -1.5 + CAB_BODY_L / 2;      // 7.8

    const DOOR_Z = (() => {
        const out = [];
        for (const d of CAB_D) out.push(3 * PITCH + CAB_U0 - (d + DOOR_W / 2));
        for (let i = 1; i <= 5; i++) {
            const zc = (3 - i) * PITCH;
            for (const d of MID_D) out.push(zc + CAR_L / 2 - (d + DOOR_W / 2));
        }
        for (const d of CAB_D) out.push(-3 * PITCH - (CAB_U0 - (d + DOOR_W / 2)));
        return out.sort((a, b) => a - b);
    })();
    const NOSE_Z = 3 * PITCH + CAR_L / 2;      // 78.8 — where the nose stops
    const psdDoorZ = (side) => side > 0 ? DOOR_Z.slice() : DOOR_Z.map(z => -z).sort((a, b) => a - b);

    /* ============================================================
       2 · textures
       ============================================================ */
    const concreteTex = tex(512, 512, (ctx, w, h) => {
        ctx.fillStyle = '#a8a7a2'; ctx.fillRect(0, 0, w, h);
        for (let i = 0; i < 240; i++) {
            const x = Math.random() * w, y = Math.random() * h, r = 14 + Math.random() * 60;
            const g = ctx.createRadialGradient(x, y, 0, x, y, r);
            const tone = Math.random() < 0.5 ? '140,139,135' : '184,183,179';
            g.addColorStop(0, `rgba(${tone},${0.05 + Math.random() * 0.09})`);
            g.addColorStop(1, `rgba(${tone},0)`);
            ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
        }
        for (let i = 0; i < 2400; i++) {
            ctx.fillStyle = `rgba(${Math.random() < 0.5 ? '118,116,110' : '220,218,212'},${Math.random() * 0.13})`;
            ctx.fillRect(Math.random() * w, Math.random() * h, 1.4, 1.4);
        }
        ctx.strokeStyle = 'rgba(108,106,100,0.26)'; ctx.lineWidth = 1.6;
        for (let i = 1; i < 4; i++) { ctx.beginPath(); ctx.moveTo(i * w / 4, 0); ctx.lineTo(i * w / 4, h); ctx.stroke(); }
        ctx.strokeStyle = 'rgba(108,106,100,0.14)';
        ctx.beginPath(); ctx.moveTo(0, h / 2); ctx.lineTo(w, h / 2); ctx.stroke();
    }, 4, 4);

    const floorTex = tex(512, 512, (ctx, w, h) => {
        ctx.fillStyle = '#b2b0ac'; ctx.fillRect(0, 0, w, h);
        const n = 4, s = w / n;
        for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
            const v = 170 + Math.floor(Math.random() * 15);
            ctx.fillStyle = `rgb(${v},${v},${v - 4})`;
            ctx.fillRect(i * s + 1, j * s + 1, s - 2, s - 2);
            for (let k = 0; k < 200; k++) {
                ctx.fillStyle = `rgba(${Math.random() < 0.5 ? '116,115,112' : '236,235,231'},${Math.random() * 0.15})`;
                ctx.fillRect(i * s + Math.random() * s, j * s + Math.random() * s, 1.2, 1.2);
            }
        }
        ctx.strokeStyle = 'rgba(122,119,112,0.5)'; ctx.lineWidth = 2;
        for (let i = 0; i <= n; i++) {
            ctx.beginPath(); ctx.moveTo(i * s, 0); ctx.lineTo(i * s, h); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(0, i * s); ctx.lineTo(w, i * s); ctx.stroke();
        }
    }, 5, 63);

    // slab track: sleepers cast in, no ballast, oil-dark
    const trackTex = tex(256, 512, (ctx, w, h) => {
        ctx.fillStyle = '#26272a'; ctx.fillRect(0, 0, w, h);
        for (let y = 0; y < h; y += 26) {
            ctx.fillStyle = '#313336'; ctx.fillRect(0, y, w, 13);
            ctx.fillStyle = '#1c1d1f'; ctx.fillRect(0, y + 13, w, 13);
        }
        for (let i = 0; i < 900; i++) {
            ctx.fillStyle = `rgba(${Math.random() < 0.5 ? '10,10,11' : '72,74,76'},${Math.random() * 0.35})`;
            ctx.fillRect(Math.random() * w, Math.random() * h, 2, 2);
        }
    }, 1, 90);

    // train-door leaf: charcoal plug leaf, tall glass near the meeting edge
    const leafTex = (mirror) => tex(192, 384, (ctx, w, h) => {
        ctx.save();
        if (mirror) { ctx.translate(w, 0); ctx.scale(-1, 1); }
        const g = ctx.createLinearGradient(0, 0, 0, h);
        g.addColorStop(0, '#4c4f52'); g.addColorStop(0.42, '#414447'); g.addColorStop(1, '#303234');
        ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = '#131415'; ctx.fillRect(w - 7, 0, 7, h);          // meeting edge
        const gx = w * 0.44, gw = w * 0.44;
        ctx.fillStyle = '#0c0e10'; ctx.fillRect(gx - 5, h * 0.05, gw + 10, h * 0.60);
        const wg = ctx.createLinearGradient(0, h * 0.06, 0, h * 0.64);
        wg.addColorStop(0, 'rgba(126,148,164,0.45)'); wg.addColorStop(0.45, 'rgba(24,29,34,1)');
        wg.addColorStop(1, '#0e1013');
        ctx.fillStyle = wg; ctx.fillRect(gx, h * 0.06, gw, h * 0.58);
        ctx.fillStyle = 'rgba(186,212,233,0.85)';
        ctx.fillRect(w * 0.15, h * 0.12, w * 0.045, h * 0.70);
        ctx.fillRect(w * 0.235, h * 0.12, w * 0.045, h * 0.70);
        ctx.fillStyle = '#26282a'; ctx.fillRect(0, h * 0.86, w, h * 0.14);
        ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(0, h * 0.855, w, 3);
        ctx.restore();
    });

    // what you see through an open car door
    const insideTex = tex(256, 256, (ctx, w, h) => {
        const g = ctx.createLinearGradient(0, 0, 0, h);
        g.addColorStop(0, '#d2d7d9'); g.addColorStop(0.16, '#8d949a');
        g.addColorStop(0.55, '#3d4348'); g.addColorStop(1, '#191c1f');
        ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = 'rgba(220,228,232,0.55)';
        for (const x of [w * 0.2, w * 0.78]) ctx.fillRect(x, 0, 5, h);     // grab poles
        ctx.fillStyle = 'rgba(255,242,214,0.35)'; ctx.fillRect(0, 0, w, h * 0.06);
        ctx.fillStyle = 'rgba(40,110,180,0.35)'; ctx.fillRect(w * 0.3, h * 0.60, w * 0.4, h * 0.11);
        for (let i = 0; i < 400; i++) {
            ctx.fillStyle = `rgba(0,0,0,${Math.random() * 0.12})`;
            ctx.fillRect(Math.random() * w, Math.random() * h, 2, 2);
        }
    });

    const hatchTex = tex(256, 64, (ctx, w, h) => {
        ctx.fillStyle = '#9a9791'; ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = '#E8B419';
        for (let i = -h; i < w; i += 26) {
            ctx.beginPath(); ctx.moveTo(i, h); ctx.lineTo(i + h, 0);
            ctx.lineTo(i + h + 13, 0); ctx.lineTo(i + 13, h); ctx.closePath(); ctx.fill();
        }
        ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.fillRect(0, 0, w, 4);
    });

    /* ============================================================
       3 · materials, and the screen-door glass shader
       ============================================================ */
    const vaultMat = new THREE.MeshStandardMaterial({
        map: reTex(concreteTex, 10, 44), roughness: 0.94, side: THREE.BackSide });
    const endWallMat = new THREE.MeshStandardMaterial({ map: reTex(concreteTex, 0.3, 0.3), roughness: 0.94 });
    const edgeFaceMat = new THREE.MeshStandardMaterial({ map: reTex(concreteTex, 60, 0.4), roughness: 0.93 });
    const tunWallMat = new THREE.MeshStandardMaterial({ map: reTex(concreteTex, 150, 1.5), roughness: 0.93 });
    const columnMat = new THREE.MeshStandardMaterial({ map: reTex(concreteTex, 2, 2), roughness: 0.9 });
    const beamMat = new THREE.MeshStandardMaterial({ map: reTex(concreteTex, 60, 1), roughness: 0.9 });
    const floorMat = new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.68, metalness: 0.05 });
    const trackMat = new THREE.MeshStandardMaterial({ map: trackTex, roughness: 0.96 });
    const orangeMat = new THREE.MeshStandardMaterial({
        color: 0xF2611C, roughness: 0.5, metalness: 0.05, emissive: 0xD84A10, emissiveIntensity: 0.14 });
    const amberMat = new THREE.MeshStandardMaterial({ color: 0xD79A33, roughness: 0.45, metalness: 0.22 });
    const coreMat = new THREE.MeshStandardMaterial({ color: 0x443311, emissive: 0xFFD98F, emissiveIntensity: 2.3 });
    const finMat = new THREE.MeshStandardMaterial({
        color: 0xF2E4BE, emissive: 0xD9C08A, emissiveIntensity: 0.6,
        transparent: true, opacity: 0.78, side: THREE.DoubleSide });
    const steelMat = new THREE.MeshStandardMaterial({ color: 0xB4B7BA, roughness: 0.45, metalness: 0.35 });
    const darkMetal = new THREE.MeshStandardMaterial({ color: 0x33363A, roughness: 0.48, metalness: 0.35 });
    const blackMat = new THREE.MeshStandardMaterial({ color: 0x121314, roughness: 0.9 });
    const cladMat = new THREE.MeshStandardMaterial({ color: 0x131416, roughness: 0.38, metalness: 0.5 });
    const timberBack = new THREE.MeshStandardMaterial({ color: 0x14100c, roughness: 0.96 });
    const timberRib = new THREE.MeshStandardMaterial({ color: 0x2F241A, roughness: 0.82 });
    const slatMat = new THREE.MeshStandardMaterial({ color: 0xB3B6B9, roughness: 0.5, metalness: 0.25 });
    const ledMat = new THREE.MeshStandardMaterial({ color: 0x8a8a8a, emissive: 0xF0F6F4, emissiveIntensity: 2.4 });
    const coneGlowMat = new THREE.MeshStandardMaterial({ color: 0x442200, emissive: 0xF08A28, emissiveIntensity: 1.7 });
    const railMat = new THREE.MeshStandardMaterial({ color: 0x8E9194, roughness: 0.3, metalness: 0.75 });
    const hatchMat = new THREE.MeshStandardMaterial({ map: hatchTex, roughness: 0.85 });
    const leafMatA = new THREE.MeshStandardMaterial({
        map: leafTex(false), roughness: 0.5, metalness: 0.15, side: THREE.DoubleSide });
    const leafMatB = new THREE.MeshStandardMaterial({
        map: leafTex(true), roughness: 0.5, metalness: 0.15, side: THREE.DoubleSide });
    const insideMat = new THREE.MeshStandardMaterial({
        map: insideTex, roughness: 0.85, emissive: 0xffffff, emissiveMap: insideTex, emissiveIntensity: 0.24 });

    // Screen-door glass. This one earns a shader: the fresnel rim is what makes
    // 176 m of glass read as glass rather than grey paint, and the streak of
    // reflected cone lamps is the only cue that tells you the doors are there
    // at all when you look straight through them.
    const glassMats = [];
    function newGlass() {
        const m = new THREE.ShaderMaterial({
            uniforms: {
                uTime: { value: 0 },
                uTint: { value: new THREE.Color(0x9db3c1) },
                uFogColor: { value: new THREE.Color(FOG_COL) },
                uFogNear: { value: FOG_NEAR },
                uFogFar: { value: FOG_FAR }
            },
            vertexShader: `
                varying vec3 vW;
                varying vec3 vN;
                varying float vDepth;
                void main() {
                    #ifdef USE_INSTANCING
                        mat4 mm = modelMatrix * instanceMatrix;
                    #else
                        mat4 mm = modelMatrix;
                    #endif
                    vec4 wp = mm * vec4(position, 1.0);
                    vW = wp.xyz;
                    vN = normalize(mat3(mm) * normal);
                    vec4 mv = viewMatrix * wp;
                    vDepth = -mv.z;
                    gl_Position = projectionMatrix * mv;
                }`,
            fragmentShader: `
                uniform float uTime;
                uniform vec3 uTint;
                uniform vec3 uFogColor;
                uniform float uFogNear;
                uniform float uFogFar;
                varying vec3 vW;
                varying vec3 vN;
                varying float vDepth;
                void main() {
                    vec3 V = normalize(cameraPosition - vW);
                    vec3 N = normalize(vN);
                    float f = pow(1.0 - abs(dot(N, V)), 3.0);
                    float grad = smoothstep(-0.3, 3.2, vW.y);
                    float streak = pow(max(0.0, sin(vW.z * 0.5712 + 1.1)), 26.0) * (1.0 - grad * 0.75);
                    float sheen = 0.045 * sin(vW.z * 0.21 - uTime * 0.22);
                    vec3 col = uTint * (0.11 + 0.55 * f + 0.17 * grad + sheen)
                             + vec3(1.0, 0.93, 0.80) * streak * 0.42;
                    float a = clamp(0.11 + 0.50 * f + 0.10 * grad + streak * 0.35, 0.0, 0.80);
                    float fogF = smoothstep(uFogNear, uFogFar, vDepth);
                    col = mix(col, uFogColor, fogF);
                    gl_FragColor = vec4(col, a * (1.0 - fogF * 0.55));
                }`,
            transparent: true,
            depthWrite: false,
            side: THREE.DoubleSide
        });
        glassMats.push(m);
        return m;
    }

    /* ============================================================
       4 · vault, floor, edge, trackway
       ============================================================ */
    {   // one barrel springing off the two tunnel faces
        const spring = Math.asin(TUN_X / R);            // 80.6° from the crown
        const vg = new THREE.CylinderGeometry(R, R, LEN, 88, 1, true, Math.PI - spring, 2 * spring);
        vg.rotateX(Math.PI / 2);
        const vault = new THREE.Mesh(vg, vaultMat);
        vault.position.y = CY;
        scene.add(vault);
    }

    const floor = new THREE.Mesh(new THREE.PlaneGeometry(PW * 2, LEN), floorMat);
    floor.rotation.x = -Math.PI / 2;
    scene.add(world.ground(floor));

    {   // the line you do not cross, the studs that tell you where it is
        const yellow = new THREE.MeshStandardMaterial({ color: 0xE8B419, roughness: 0.7 });
        const tactile = new THREE.MeshStandardMaterial({ color: 0x8d8a84, roughness: 0.88 });
        const guide = new THREE.MeshStandardMaterial({ color: 0xa3a099, roughness: 0.85 });
        for (const s of [-1, 1]) {
            for (const [x, w, mat, y] of [[6.50, 0.11, yellow, 0.014], [6.20, 0.42, tactile, 0.012], [2.40, 0.26, guide, 0.012]]) {
                const m = new THREE.Mesh(new THREE.PlaneGeometry(w, LEN), mat);
                m.rotation.x = -Math.PI / 2;
                m.position.set(s * x, y, 0);
                scene.add(world.ghost(m));
            }
        }
    }

    {   // platform coping, the face below it, the edge light seen from the track
        for (const s of [-1, 1]) {
            const cope = new THREE.Mesh(new THREE.BoxGeometry(0.30, 0.06, LEN), blackMat);
            cope.position.set(s * (PW - 0.15), 0.017, 0);
            scene.add(cope);
            const face = new THREE.Mesh(new THREE.BoxGeometry(0.26, 1.14, LEN), edgeFaceMat);
            face.position.set(s * (PW - 0.13), -0.57, 0);
            scene.add(face);
            const lip = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.09, LEN), ledMat);
            lip.position.set(s * (PW - 0.02), -0.10, 0);
            scene.add(world.ghost(lip));
        }
    }

    {   // trough, rails, tunnel faces, cable route
        const blueLine = new THREE.MeshStandardMaterial({
            color: 0x223038, emissive: 0x5DA8C8, emissiveIntensity: 1.5 });
        for (const s of [-1, 1]) {
            const slab = new THREE.Mesh(new THREE.BoxGeometry(4.5, 0.5, TL), trackMat);
            slab.position.set(s * TRACK_X, RAIL_Y - 0.08 - 0.25, 0);
            scene.add(slab);
            for (const rr of [-GAUGE, GAUGE]) {
                const rail = new THREE.Mesh(new THREE.BoxGeometry(0.072, 0.16, TL), railMat);
                rail.position.set(s * TRACK_X + rr, RAIL_Y - 0.08, 0);
                scene.add(rail);
                const web = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.05, TL), darkMetal);
                web.position.set(s * TRACK_X + rr, RAIL_Y - 0.185, 0);
                scene.add(web);
            }
            const tw = new THREE.Mesh(new THREE.BoxGeometry(0.4, 4.3, TL), tunWallMat);
            tw.position.set(s * (TUN_X + 0.2), 0.95, 0);
            scene.add(tw);
            const tray = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.09, TL), darkMetal);
            tray.position.set(s * (TUN_X - 0.18), 1.45, 0);
            scene.add(tray);
            const tline = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, TL), blueLine);
            tline.position.set(s * (TUN_X - 0.18), 2.35, 0);
            scene.add(world.ghost(tline));
        }
    }

    {   // dark soffit over each track, ribbed underneath, clearing the pantograph
        const ribs = [];
        const ribG = new THREE.BoxGeometry(4.0, 0.07, 0.16);
        for (const s of [-1, 1]) {
            const soffit = new THREE.Mesh(new THREE.BoxGeometry(4.15, 0.25, LEN), cladMat);
            soffit.position.set(s * (PSD_X + 2.1), SOFFIT_Y, 0);
            scene.add(soffit);
            for (let z = -HALF + 0.4; z <= HALF; z += 0.8) {
                ribs.push({ geo: ribG, m: M(s * (PSD_X + 2.1), SOFFIT_Y - 0.16, z) });
            }
        }
        scene.add(world.ghost(new THREE.Mesh(mergeGeos(ribs), timberRib)));
    }

    {   // vault linings: dark timber bands over the platform edges, slats over the centre
        const slats = [], backs = [], ribs = [];
        const slatG = new THREE.BoxGeometry(0.36, 0.07, LEN);
        const backG = new THREE.BoxGeometry(1.3, 0.06, LEN);
        const ribG = new THREE.BoxGeometry(0.15, 0.11, LEN);
        for (let a = 76; a <= 104; a += 2.6) {
            const phi = a * Math.PI / 180;
            slats.push({ geo: slatG, m: M(Math.cos(phi) * (R - 0.3), CY + Math.sin(phi) * (R - 0.3), 0, 0, 0, phi) });
        }
        for (const s of [-1, 1]) {
            for (let a = 50; a <= 74; a += 6.2) {
                const phi = (s > 0 ? a : 180 - a) * Math.PI / 180;
                backs.push({ geo: backG, m: M(Math.cos(phi) * (R - 0.15), CY + Math.sin(phi) * (R - 0.15), 0, 0, 0, phi) });
            }
            for (let a = 48.5; a <= 75; a += 1.5) {
                const phi = (s > 0 ? a : 180 - a) * Math.PI / 180;
                ribs.push({ geo: ribG, m: M(Math.cos(phi) * (R - 0.31), CY + Math.sin(phi) * (R - 0.31), 0, 0, 0, phi) });
            }
        }
        scene.add(world.ghost(new THREE.Mesh(mergeGeos(slats), slatMat)));
        scene.add(world.ghost(new THREE.Mesh(mergeGeos(backs), timberBack)));
        scene.add(world.ghost(new THREE.Mesh(mergeGeos(ribs), timberRib)));

        const conduit = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, LEN),
            new THREE.MeshStandardMaterial({ color: 0xA83228, roughness: 0.6 }));
        conduit.position.set(0, CY + R - 0.18, 0);
        scene.add(world.ghost(conduit));
        const pipeG = new THREE.CylinderGeometry(0.05, 0.05, LEN, 8); pipeG.rotateX(Math.PI / 2);
        for (const px of [-0.62, 0.62]) {
            const p = new THREE.Mesh(pipeG, steelMat);
            p.position.set(px, CY + R - 0.24, 0);
            scene.add(world.ghost(p));
        }
    }

    /* ============================================================
       5 · crossing arches, lanterns, blade columns, beams, cone lamps
       ------------------------------------------------------------
       One bay is extruded once and stamped down the cavern; thirty-two
       ExtrudeGeometry calls would cost more than the rest of the world.
       ============================================================ */
    class ArchCurve extends THREE.Curve {
        constructor(sx, ex, z0, z1) { super(); this.sx = sx; this.ex = ex; this.z0 = z0; this.z1 = z1; }
        getPoint(t, target = new THREE.Vector3()) {
            return target.set(
                this.sx + (this.ex - this.sx) * (1 - Math.cos(Math.PI * t)) / 2,
                ARCH_Y0 + ARCH_H * Math.sin(Math.PI * t),
                this.z0 + (this.z1 - this.z0) * t);
        }
    }
    {
        const shape = new THREE.Shape();
        shape.moveTo(-0.28, -0.085); shape.lineTo(0.28, -0.085);
        shape.lineTo(0.28, 0.085); shape.lineTo(-0.28, 0.085); shape.closePath();
        const opts = { steps: 44, bevelEnabled: false };
        const baseA = new THREE.ExtrudeGeometry(shape,
            Object.assign({ extrudePath: new ArchCurve(-COL_X, COL_X, -BAY / 2, BAY / 2) }, opts));
        const baseB = new THREE.ExtrudeGeometry(shape,
            Object.assign({ extrudePath: new ArchCurve(COL_X, -COL_X, -BAY / 2, BAY / 2) }, opts));
        const archItems = [], steelItems = [];
        const nodeG = new THREE.BoxGeometry(0.28, 0.5, 0.28);
        const rodG = new THREE.CylinderGeometry(0.032, 0.032, 2.7, 8);   // reaches the crown
        const brktG = new THREE.BoxGeometry(0.75, 0.46, 0.75);
        for (let zc = -HALF + BAY / 2 + 0.5; zc <= HALF - BAY / 2 - 0.5; zc += BAY) {
            archItems.push({ geo: baseA, m: M(0, 0, zc) }, { geo: baseB, m: M(0, 0, zc) });
            steelItems.push({ geo: nodeG, m: M(0, ARCH_Y0 + ARCH_H, zc) });
            steelItems.push({ geo: rodG, m: M(0, ARCH_Y0 + ARCH_H + 1.35, zc) });
            for (const s of [-1, 1]) {
                steelItems.push({ geo: brktG, m: M(s * (COL_X + 0.08), BEAM_Y + BEAM_H / 2 + 0.24, zc - BAY / 2) });
            }
        }
        scene.add(world.ghost(new THREE.Mesh(mergeGeos(archItems), orangeMat)));
        scene.add(world.ghost(new THREE.Mesh(mergeGeos(steelItems), steelMat)));
        baseA.dispose(); baseB.dispose();
    }

    {   // stacked gold lanterns, every other bay
        const amber = [], cores = [], fins = [], rods = [];
        const rodG = new THREE.CylinderGeometry(0.022, 0.022, 3.0, 8);
        const capG = new THREE.CylinderGeometry(0.125, 0.125, 0.44, 14);
        const botG = new THREE.CylinderGeometry(0.125, 0.125, 0.36, 14);
        const coreG = new THREE.CylinderGeometry(0.105, 0.105, 0.26, 12);
        const finG = new THREE.CylinderGeometry(0.155, 0.155, 0.045, 16);
        for (let zc = -HALF + BAY + 0.5; zc <= HALF - BAY; zc += BAY * 2) {
            rods.push({ geo: rodG, m: M(0, 10.9, zc) });
            amber.push({ geo: capG, m: M(0, 9.20, zc) });
            for (let j = 0; j < 7; j++) {
                const y = 8.84 - j * 0.28;
                cores.push({ geo: coreG, m: M(0, y, zc) });
                fins.push({ geo: finG, m: M(0, y - 0.14, zc) });
            }
            amber.push({ geo: botG, m: M(0, 6.70, zc) });
        }
        scene.add(world.ghost(new THREE.Mesh(mergeGeos(rods), steelMat)));
        scene.add(world.ghost(new THREE.Mesh(mergeGeos(amber), amberMat)));
        scene.add(world.ghost(new THREE.Mesh(mergeGeos(cores), coreMat)));
        scene.add(world.ghost(new THREE.Mesh(mergeGeos(fins), finMat)));
    }

    {   // blade columns and the beams the arches spring from
        const colItems = [], plinthItems = [], spotItems = [], lensItems = [];
        const colH = BEAM_Y - BEAM_H / 2;
        const endG = new THREE.CylinderGeometry(0.42, 0.42, colH, 14);
        const midG = new THREE.BoxGeometry(0.84, colH, 1.7);
        const pEndG = new THREE.CylinderGeometry(0.5, 0.5, 0.22, 14);
        const pMidG = new THREE.BoxGeometry(1.0, 0.22, 1.7);
        const spotG = new THREE.CylinderGeometry(0.085, 0.085, 0.46, 12);
        const lensG = new THREE.CylinderGeometry(0.066, 0.066, 0.03, 12);
        for (let z = -HALF + BAY / 2 + 0.5; z <= HALF - BAY / 2; z += BAY) {
            for (const s of [-1, 1]) {
                const x = s * COL_X;
                colItems.push({ geo: midG, m: M(x, colH / 2, z) });
                colItems.push({ geo: endG, m: M(x, colH / 2, z - 0.85) });
                colItems.push({ geo: endG, m: M(x, colH / 2, z + 0.85) });
                plinthItems.push({ geo: pMidG, m: M(x, 0.11, z) });
                plinthItems.push({ geo: pEndG, m: M(x, 0.11, z - 0.85) });
                plinthItems.push({ geo: pEndG, m: M(x, 0.11, z + 0.85) });
                spotItems.push({ geo: spotG, m: M(x + s * 0.55, colH - 0.28, z + 2.0) });
                lensItems.push({ geo: lensG, m: M(x + s * 0.55, colH - 0.53, z + 2.0) });
            }
        }
        scene.add(new THREE.Mesh(mergeGeos(colItems), columnMat));
        scene.add(new THREE.Mesh(mergeGeos(plinthItems), blackMat));
        scene.add(world.ghost(new THREE.Mesh(mergeGeos(spotItems), steelMat)));
        scene.add(world.ghost(new THREE.Mesh(mergeGeos(lensItems), ledMat)));

        for (const s of [-1, 1]) {
            const beam = new THREE.Mesh(new THREE.BoxGeometry(1.02, BEAM_H, LEN), beamMat);
            beam.position.set(s * COL_X, BEAM_Y, 0);
            scene.add(beam);
        }
    }

    {   // orange cone lamps over the platform edges — the streaks in the glass
        const coneItems = [], glowItems = [], stemItems = [];
        const coneG = new THREE.CylinderGeometry(0.3, 0.07, 0.36, 12, 1, true);
        const glowG = new THREE.CylinderGeometry(0.26, 0.26, 0.02, 12);
        const stemG = new THREE.CylinderGeometry(0.02, 0.02, 4.0, 6);
        const coneMat = new THREE.MeshStandardMaterial({
            color: 0x453325, roughness: 0.55, metalness: 0.4, side: THREE.DoubleSide });
        for (let z = -HALF + 5.5; z <= HALF - 5; z += 5.5) {
            for (const s of [-1, 1]) {
                const x = s * 5.9;
                stemItems.push({ geo: stemG, m: M(x, 8.55, z) });
                coneItems.push({ geo: coneG, m: M(x, 6.55, z) });
                glowItems.push({ geo: glowG, m: M(x, 6.49, z) });
            }
        }
        scene.add(world.ghost(new THREE.Mesh(mergeGeos(stemItems), darkMetal)));
        scene.add(world.ghost(new THREE.Mesh(mergeGeos(coneItems), coneMat)));
        scene.add(world.ghost(new THREE.Mesh(mergeGeos(glowItems), coneGlowMat)));
    }

    /* ============================================================
       6 · platform screen doors — the openings ARE the door list
       ============================================================ */
    const PSD_OPEN = 1.80;
    const PSD_LEAF_W = 0.95, PSD_LEAF_H = 2.54, PSD_LEAF_Y = 1.33, PSD_TRAVEL = 0.95;

    const psdSides = [];
    for (const side of [1, -1]) {
        const x = side * PSD_X;
        const rotY = side > 0 ? -Math.PI / 2 : Math.PI / 2;
        const doors = psdDoorZ(side);

        const panels = [], frames = [];
        const edges = [-HALF];
        for (const dz of doors) edges.push(dz - PSD_OPEN / 2, dz + PSD_OPEN / 2);
        edges.push(HALF);
        for (let i = 0; i < edges.length; i += 2) {
            const z0 = edges[i], z1 = edges[i + 1], w = z1 - z0;
            if (w < 0.05) continue;
            const pg = new THREE.PlaneGeometry(w, PSD_H - 0.10);
            pg.rotateY(rotY);
            panels.push({ geo: pg, m: M(x, 0.05 + (PSD_H - 0.10) / 2, (z0 + z1) / 2) });
            const n = Math.max(1, Math.round(w / 1.7));
            for (let k = 1; k < n; k++) {
                frames.push({
                    geo: new THREE.BoxGeometry(0.11, PSD_H - 0.1, 0.075),
                    m: M(x, 0.05 + (PSD_H - 0.1) / 2, z0 + w * k / n)
                });
            }
        }
        const jambG = new THREE.BoxGeometry(0.16, PSD_H - 0.05, 0.11);
        for (const dz of doors) {
            frames.push({ geo: jambG, m: M(x, (PSD_H - 0.05) / 2, dz - PSD_OPEN / 2 - 0.08) });
            frames.push({ geo: jambG, m: M(x, (PSD_H - 0.05) / 2, dz + PSD_OPEN / 2 + 0.08) });
        }
        frames.push({ geo: new THREE.BoxGeometry(0.17, 0.24, LEN), m: M(x, PSD_H + 0.09, 0) });
        frames.push({ geo: new THREE.BoxGeometry(0.22, 0.10, LEN), m: M(x, 0.05, 0) });
        scene.add(new THREE.Mesh(mergeGeos(panels), newGlass()));
        scene.add(new THREE.Mesh(mergeGeos(frames), darkMetal));

        // the dark header band above the doors, and its cove light
        const clad = new THREE.Mesh(new THREE.PlaneGeometry(LEN, HEAD_Y1 - HEAD_Y0), cladMat);
        clad.rotation.y = rotY;
        clad.position.set(side * (PSD_X + 0.03), (HEAD_Y0 + HEAD_Y1) / 2, 0);
        scene.add(clad);
        const cove = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.08, LEN), ledMat);
        cove.position.set(side * (PSD_X - 0.22), HEAD_Y1 - 0.14, 0);
        scene.add(world.ghost(cove));
        const coveLip = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.06, LEN), darkMetal);
        coveLip.position.set(side * (PSD_X - 0.17), HEAD_Y1, 0);
        scene.add(world.ghost(coveLip));

        // sliding leaves: one instanced glass pass, one instanced frame pass,
        // driven off the same matrices so they cannot come apart
        const lg = new THREE.PlaneGeometry(PSD_LEAF_W, PSD_LEAF_H);
        lg.rotateY(rotY);
        const lfg = mergeGeos([
            { geo: new THREE.BoxGeometry(0.09, PSD_LEAF_H, 0.07), m: M(0, 0, -PSD_LEAF_W / 2 + 0.035) },
            { geo: new THREE.BoxGeometry(0.09, PSD_LEAF_H, 0.07), m: M(0, 0, PSD_LEAF_W / 2 - 0.035) },
            { geo: new THREE.BoxGeometry(0.09, 0.09, PSD_LEAF_W), m: M(0, PSD_LEAF_H / 2 - 0.045, 0) },
            { geo: new THREE.BoxGeometry(0.09, 0.14, PSD_LEAF_W), m: M(0, -PSD_LEAF_H / 2 + 0.07, 0) },
            { geo: new THREE.BoxGeometry(0.10, 0.05, PSD_LEAF_W * 0.62), m: M(0, -PSD_LEAF_H / 2 + 0.68, 0) }
        ]);
        const n = doors.length * 2;
        const leafGlass = new THREE.InstancedMesh(lg, newGlass(), n);
        const leafFrame = new THREE.InstancedMesh(lfg, darkMetal, n);
        leafGlass.frustumCulled = false; leafFrame.frustumCulled = false;
        scene.add(leafGlass); scene.add(leafFrame);

        // hatched threshold on the platform at every opening
        for (const dz of doors) {
            const m = new THREE.Mesh(new THREE.PlaneGeometry(PSD_OPEN + 0.2, 0.55), hatchMat);
            m.rotation.x = -Math.PI / 2;
            m.rotation.z = Math.PI / 2;
            m.position.set(side * (PSD_X - 0.45), 0.016, dz);
            scene.add(world.ghost(m));
        }

        psdSides.push({ side, x, doors, leafGlass, leafFrame });
    }

    /* ============================================================
       7 · end walls with portals, and the bores beyond
       ------------------------------------------------------------
       The opening has to clear a raised pantograph — 4.29 m above platform
       level — not just the 2.76 m roof, so it is a rounded rectangle rather
       than the semicircle it wants to be.
       ============================================================ */
    const PORT_HW = 2.6, PORT_Y0 = -1.7, PORT_YT = 2.5, BORE_R = 4.3, BORE_Y = 1.5;
    {
        const shp = new THREE.Shape();
        shp.moveTo(-12.4, -2.6); shp.lineTo(12.4, -2.6);
        shp.lineTo(12.4, 13.2); shp.lineTo(-12.4, 13.2); shp.closePath();
        for (const s of [-1, 1]) {
            const hx = s * TRACK_X;
            const hole = new THREE.Path();
            hole.moveTo(hx - PORT_HW, PORT_Y0);
            hole.lineTo(hx - PORT_HW, PORT_YT);
            hole.absarc(hx, PORT_YT, PORT_HW, Math.PI, 0, true);
            hole.lineTo(hx + PORT_HW, PORT_Y0);
            hole.closePath();
            shp.holes.push(hole);
        }
        const wg = new THREE.ShapeGeometry(shp, 20);
        for (const s of [-1, 1]) {
            const wall = new THREE.Mesh(wg, endWallMat);
            wall.position.set(0, 0, s * (HALF + 0.35));
            if (s < 0) wall.rotation.y = Math.PI;
            scene.add(wall);
        }
    }

    // the bores: shaded so the light falls away with distance instead of
    // ending on a flat black plate
    const boreMat = new THREE.ShaderMaterial({
        vertexShader: `
            varying float vD;
            void main() {
                vec4 wp = modelMatrix * vec4(position, 1.0);
                vD = abs(wp.z);
                gl_Position = projectionMatrix * viewMatrix * wp;
            }`,
        fragmentShader: `
            varying float vD;
            void main() {
                float k = clamp((vD - 88.0) / 46.0, 0.0, 1.0);
                gl_FragColor = vec4(mix(vec3(0.072, 0.076, 0.084), vec3(0.004, 0.005, 0.008), k), 1.0);
            }`,
        side: THREE.BackSide
    });
    for (const s of [-1, 1]) for (const t of [-1, 1]) {
        const bg = new THREE.CylinderGeometry(BORE_R, BORE_R, 160, 20, 1, true);
        bg.rotateX(Math.PI / 2);
        const bore = new THREE.Mesh(bg, boreMat);
        bore.position.set(t * TRACK_X, BORE_Y, s * (HALF + 80));
        scene.add(world.ghost(bore));
    }

    /* ============================================================
       8 · signage, live screens, and the stop mark itself
       ============================================================ */
    function signMesh(w, h, drawFn, opts = {}) {
        const px = Math.round(256 * w / h);
        const t = tex(px, 256, drawFn);
        const face = new THREE.MeshStandardMaterial({
            map: t, roughness: 0.6, metalness: 0.05,
            emissive: opts.glow ? 0xffffff : 0x000000,
            emissiveMap: opts.glow ? t : null,
            emissiveIntensity: opts.glow ? 0.8 : 0
        });
        const edge = new THREE.MeshStandardMaterial({ color: opts.edge || 0x222325, roughness: 0.6 });
        return new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.08), [edge, edge, edge, edge, face, face]);
    }
    let signN = 0;
    function hungSign(w, h, drawFn, x, y, z, topY, spread, opts) {
        const grp = new THREE.Group();
        const s = signMesh(w, h, drawFn, opts);
        s.position.set(x, y, z);
        grp.add(s);
        const rg = new THREE.CylinderGeometry(0.016, 0.016, 1, 6);
        const y0 = y + h / 2 - 0.05, hgt = topY - y0;
        for (const sx of [-1, 1]) {
            const rod = new THREE.Mesh(rg, darkMetal);
            rod.scale.y = hgt;
            rod.position.set(x + sx * spread, y0 + hgt / 2, z);
            grp.add(rod);
        }
        world.part(`sign_${String(signN++).padStart(2, '0')}`, grp);
        scene.add(grp);
        return grp;
    }

    const drawPlat = (num, dest, arrowRight) => (ctx, w, h) => {
        ctx.fillStyle = '#F4F4F1'; ctx.fillRect(0, 0, w, h);
        ctx.textBaseline = 'middle'; ctx.fillStyle = '#2E2E2E';
        if (arrowRight) {
            ctx.font = '500 60px Arial'; ctx.fillText(dest, 44, h / 2);
            ctx.fillStyle = '#2C7BC4'; ctx.fillRect(w - 300, h * 0.15, 7, h * 0.7);
            ctx.fillStyle = '#2E2E2E'; ctx.font = '600 96px Arial'; ctx.fillText(num, w - 268, h / 2);
            ctx.font = '500 84px Arial'; ctx.fillText('→', w - 168, h / 2);
        } else {
            ctx.font = '500 84px Arial'; ctx.fillText('←', 40, h / 2);
            ctx.font = '600 96px Arial'; ctx.fillText(num, 168, h / 2);
            ctx.fillStyle = '#2C7BC4'; ctx.fillRect(262, h * 0.15, 7, h * 0.7);
            ctx.fillStyle = '#2E2E2E'; ctx.font = '500 58px Arial'; ctx.fillText(dest, 300, h / 2);
        }
    };
    const drawExit = (title, line2) => (ctx, w, h) => {
        ctx.fillStyle = '#101112'; ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = '#F5C400'; ctx.font = '700 70px Arial'; ctx.textBaseline = 'middle';
        ctx.fillText(title, 40, h * 0.34);
        ctx.fillStyle = '#fff'; ctx.font = '400 44px Arial';
        ctx.fillText(line2, 40, h * 0.68);
        ctx.strokeStyle = '#F5C400'; ctx.lineWidth = 9; ctx.lineCap = 'round';
        const ax = w - 80, ay = h * 0.34;
        ctx.beginPath(); ctx.moveTo(ax, ay + 26); ctx.lineTo(ax, ay - 26);
        ctx.moveTo(ax - 20, ay - 6); ctx.lineTo(ax, ay - 28); ctx.lineTo(ax + 20, ay - 6); ctx.stroke();
    };
    for (const z of [-58, -14, 30, 70]) {
        hungSign(2.6, 0.62, drawPlat('1', 'Sunbury', true), 5.2, 4.35, z, 10.2, 0.9, { edge: 0xd9d9d6 });
        hungSign(2.6, 0.62, drawPlat('2', 'Pakenham', false), -5.2, 4.35, z + 5.5, 10.2, 0.9, { edge: 0xd9d9d6 });
    }
    for (const z of [-72, 6, 76]) {
        hungSign(2.3, 0.66, drawExit('Exit', 'Concourse and lifts'), 0, 4.7, z, 11.9, 0.8);
    }

    {   // station name on the header band, facing the platform
        const nameTex = tex(1024, 128, (ctx, w, h) => {
            ctx.fillStyle = '#0f1011'; ctx.fillRect(0, 0, w, h);
            ctx.fillStyle = '#2C7BC4'; ctx.fillRect(0, 0, 10, h);
            ctx.fillStyle = '#F2F3F0'; ctx.font = '600 62px Arial'; ctx.textBaseline = 'middle';
            ctx.fillText('Berth Mark', 34, h / 2);
            ctx.fillStyle = '#8d949a'; ctx.font = '400 34px Arial';
            ctx.fillText('Metro Tunnel', 350, h / 2 + 2);
        });
        const nameMat = new THREE.MeshStandardMaterial({
            map: nameTex, roughness: 0.5, emissive: 0xffffff, emissiveMap: nameTex, emissiveIntensity: 0.35 });
        for (const side of [-1, 1]) for (const z of [-44, 0, 44]) {
            const p = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 0.43), nameMat);
            p.position.set(side * (PSD_X - 0.02), 3.75, z);
            p.rotation.y = side > 0 ? -Math.PI / 2 : Math.PI / 2;
            scene.add(p);
        }
    }

    function makeScreen(w, h, cw, ch, x, y, z, faceSide, name) {
        const canvas = document.createElement('canvas');
        canvas.width = cw; canvas.height = ch;
        const t = new THREE.CanvasTexture(canvas);
        t.colorSpace = THREE.SRGBColorSpace;
        const face = new THREE.MeshStandardMaterial({
            map: t, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: 0.9, roughness: 0.55 });
        const edge = new THREE.MeshStandardMaterial({ color: 0x141516, roughness: 0.6 });
        const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.09), [edge, edge, edge, edge, face, face]);
        m.position.set(x, y, z);
        m.rotation.y = faceSide > 0 ? Math.PI / 2 : -Math.PI / 2;   // faces the platform edge
        const grp = new THREE.Group(); grp.add(m);
        world.part(name, grp);
        scene.add(grp);
        return { canvas, ctx: canvas.getContext('2d'), t, w: cw, h: ch };
    }

    const pids = [];
    [[1, -34], [-1, -26], [1, 22], [-1, 46]].forEach(([side, z], i) => {
        const rec = makeScreen(1.32, 0.8, 432, 262, side * (COL_X + 0.42), 3.65, z, side,
            `screen_pid_${String(i).padStart(2, '0')}`);
        pids.push({ rec, side, offset: i * 2 });
    });
    const berthScreens = [];
    for (const side of [1, -1]) {
        const rec = makeScreen(1.12, 0.63, 384, 216, side * (COL_X + 0.42), 2.45,
            side > 0 ? NOSE_Z - 4.8 : -(NOSE_Z - 4.8), side,
            `screen_berth_${side > 0 ? '00' : '01'}`);
        berthScreens.push({ rec, side });
    }

    function drawPID(p, tSec) {
        const { ctx, w, h } = p.rec;
        const lead = p.side > 0 ? 'Sunbury' : 'Pakenham';
        const stops = p.side > 0
            ? ['Berth Mark', 'Parkville', 'Arden', 'Footscray', 'Sunshine', 'Sunbury']
            : ['Berth Mark', 'Town Hall', 'Anzac', 'Caulfield', 'Dandenong', 'Pakenham'];
        const min0 = ((3 + p.offset - Math.floor(tSec / 40)) % 14 + 14) % 14;
        ctx.fillStyle = '#F2F4F6'; ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = '#123A63'; ctx.fillRect(0, 0, w, 58);
        ctx.fillStyle = '#fff'; ctx.font = '600 34px Arial'; ctx.textBaseline = 'middle';
        ctx.fillText(`${6 + (p.offset % 2)}:${String((17 + p.offset * 7) % 60).padStart(2, '0')}pm  ${lead}`, 16, 29);
        ctx.fillStyle = '#0F2338'; ctx.fillRect(w - 118, 8, 104, 42);
        ctx.fillStyle = '#FFD34D'; ctx.font = '600 30px Arial';
        ctx.fillText(min0 === 0 ? 'Now' : `${min0} min`, w - 104, 29);
        ctx.fillStyle = '#4A5560'; ctx.font = '400 21px Arial';
        ctx.fillText('7 car  ·  all doors  ·  level boarding', 16, 78);
        ctx.strokeStyle = '#2C7BC4'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(26, 102); ctx.lineTo(26, h - 34); ctx.stroke();
        ctx.font = '400 24px Arial';
        for (let i = 0; i < stops.length; i++) {
            ctx.beginPath(); ctx.arc(26, 112 + i * 24, 4.5, 0, 7);
            ctx.fillStyle = i === 0 ? '#2C7BC4' : '#8A949C'; ctx.fill();
            ctx.fillStyle = '#2E3338'; ctx.fillText(stops[i], 46, 112 + i * 24);
        }
        p.rec.t.needsUpdate = true;
    }

    // the readout that says the world's point out loud
    function drawBerth(b, state, offsetM, speed) {
        const { ctx, w, h } = b.rec;
        const aligned = state === 'berthed' || state === 'doors open';
        ctx.fillStyle = '#0D1013'; ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = '#161B20'; ctx.fillRect(0, 0, w, 46);
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#8FA3B2'; ctx.font = '600 24px Arial';
        ctx.fillText(`BERTH ${b.side > 0 ? '1' : '2'}  ·  7 CAR`, 14, 23);
        ctx.fillStyle = aligned ? '#2BD07A' : '#E8B419';
        ctx.beginPath(); ctx.arc(w - 26, 23, 9, 0, 7); ctx.fill();

        ctx.fillStyle = aligned ? '#2BD07A' : '#DDE4E9';
        ctx.font = '700 44px Arial';
        ctx.fillText(aligned ? 'ALIGNED' : state.toUpperCase(), 14, 84);

        ctx.fillStyle = '#5D6B76'; ctx.font = '400 20px Arial';
        ctx.fillText('nose offset from mark', 14, 121);
        ctx.fillText('speed', w - 132, 121);
        const mm = Math.round(offsetM * 1000);
        const sign = mm < 0 ? '−' : (mm > 0 ? '+' : '');
        const shown = Math.abs(mm) >= 1000 ? (Math.abs(mm) / 1000).toFixed(1) + ' m' : Math.abs(mm) + ' mm';
        ctx.fillStyle = '#DDE4E9'; ctx.font = '600 38px Arial';
        ctx.fillText(sign + shown, 14, 152);
        ctx.fillText(`${Math.round(speed * 3.6)} km/h`, w - 132, 152);

        ctx.fillStyle = '#1D242A'; ctx.fillRect(14, h - 30, w - 28, 14);
        const k = Math.max(-1, Math.min(1, offsetM / 12));
        ctx.fillStyle = aligned ? '#2BD07A' : '#E8B419';
        ctx.fillRect(14 + (w - 28) / 2 - 3 - k * (w - 34) / 2, h - 33, 6, 20);
        ctx.fillStyle = '#3C4750'; ctx.fillRect(14 + (w - 28) / 2 - 1, h - 37, 2, 28);
        b.rec.t.needsUpdate = true;
    }

    {   // the stop mark, and the legend painted under it
        const markTex = tex(256, 256, (ctx, w, h) => {
            ctx.fillStyle = '#141516'; ctx.fillRect(0, 0, w, h);
            ctx.fillStyle = '#E8B419'; ctx.fillRect(9, 9, w - 18, h - 18);
            ctx.fillStyle = '#141516';
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.font = '700 140px Arial'; ctx.fillText('7', w / 2, h / 2 - 16);
            ctx.font = '600 34px Arial'; ctx.fillText('STOP', w / 2, h - 46);
        });
        const markMat = new THREE.MeshStandardMaterial({
            map: markTex, roughness: 0.5, emissive: 0xffffff, emissiveMap: markTex, emissiveIntensity: 0.2 });
        const markEdge = new THREE.MeshStandardMaterial({ color: 0x1c1d1e, roughness: 0.6 });
        const legendTex = tex(512, 128, (ctx, w, h) => {
            ctx.clearRect(0, 0, w, h);
            ctx.fillStyle = 'rgba(232,180,25,0.92)';
            ctx.fillRect(0, h * 0.36, w, 11);
            ctx.textBaseline = 'middle';
            ctx.font = '700 54px Arial'; ctx.fillText('7 CAR', 12, h * 0.74);
            ctx.font = '500 34px Arial'; ctx.fillText('FRONT OF TRAIN', 196, h * 0.75);
        });
        const legendMat = new THREE.MeshStandardMaterial({ map: legendTex, transparent: true, roughness: 0.85 });
        for (const side of [1, -1]) {
            const grp = new THREE.Group();
            const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.3, 10), darkMetal);
            post.position.y = 1.15; grp.add(post);
            const board = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.06),
                [markEdge, markEdge, markEdge, markEdge, markMat, markMat]);
            board.position.set(0, 2.1, 0.04); grp.add(board);
            grp.position.set(side * 5.75, 0, side > 0 ? NOSE_Z : -NOSE_Z);
            grp.rotation.y = side > 0 ? Math.PI / 2 : -Math.PI / 2;
            world.part(`stopmark_${side > 0 ? '00' : '01'}`, grp);
            scene.add(grp);

            const m = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 0.9), legendMat);
            m.rotation.x = -Math.PI / 2;
            m.rotation.z = side > 0 ? -Math.PI / 2 : Math.PI / 2;
            m.position.set(side * 4.5, 0.016, side > 0 ? NOSE_Z - 1.1 : -(NOSE_Z - 1.1));
            scene.add(world.ghost(m));
        }
    }

    /* ============================================================
       9 · things to sit on and stand by
       ============================================================ */
    const benchFrame = new THREE.MeshStandardMaterial({ color: 0x8B9094, roughness: 0.45, metalness: 0.4 });
    const plinthMat = new THREE.MeshStandardMaterial({ color: 0x6E6B66, roughness: 0.7, metalness: 0.15 });
    let benchN = 0;
    function bench(x, z, ry) {
        const g = new THREE.Group();
        const plinth = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.1, 0.85), plinthMat);
        plinth.position.y = 0.05; g.add(plinth);
        for (const [yy, zz] of [[0.62, 0], [0.78, 0.01], [0.94, 0.02]]) {
            const rail = new THREE.Mesh(new THREE.BoxGeometry(2.55, 0.07, 0.04), benchFrame);
            rail.position.set(0, yy, zz); g.add(rail);
        }
        for (const sx of [-1.2, 0, 1.2]) {
            const post = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.55, 0.05), benchFrame);
            post.position.set(sx, 0.72, 0); g.add(post);
        }
        for (const s2 of [-1, 1]) for (let i = 0; i < 4; i++) {
            const slat = new THREE.Mesh(new THREE.BoxGeometry(2.55, 0.035, 0.09), benchFrame);
            slat.position.set(0, 0.46, s2 * (0.1 + i * 0.1));
            g.add(slat);
        }
        g.position.set(x, 0, z);
        if (ry) g.rotation.y = ry;
        world.part(`bench_${String(benchN++).padStart(2, '0')}`, g);
        scene.add(g);
    }
    for (const z of [-66, -40, -8, 18, 52, 78]) {
        bench(-1.35, z, 0);
        bench(1.35, z + 3, Math.PI);
    }

    let binN = 0;
    for (const [x, z] of [[-2.3, -30], [2.3, 12], [-2.3, 60], [2.3, -62]]) {
        const g = new THREE.Group();
        const body = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.21, 0.86, 16), steelMat);
        body.position.y = 0.43; g.add(body);
        const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.06, 16), darkMetal);
        lid.position.y = 0.89; g.add(lid);
        const band = new THREE.Mesh(new THREE.CylinderGeometry(0.245, 0.245, 0.1, 16),
            new THREE.MeshStandardMaterial({ color: 0x2C7BC4, roughness: 0.6 }));
        band.position.y = 0.72; g.add(band);
        g.position.set(x, 0, z);
        world.part(`bin_${String(binN++).padStart(2, '0')}`, g);
        scene.add(g);
    }

    /* ============================================================
       10 · the trains, and the doors that agree with the platform
       ------------------------------------------------------------
       The livery texture paints a shut door; a shut door cannot open. So
       each opening gets a dark interior panel sitting just proud of the
       painted leaves, and two real leaves over that, which slide out along
       the bodyside the way plug doors actually do.
       ============================================================ */
    const T_LEAF_W = 0.77, T_LEAF_H = 1.87, T_LEAF_Y = 1.885, T_TRAVEL = 0.86;
    const APER_W = 1.46, APER_H = 1.83, APER_Y = 1.885;
    const BODY_X = 1.545;                  // outer face of the leaves, train-local

    const apertureGeo = (() => {
        const pg = new THREE.PlaneGeometry(APER_W, APER_H);
        pg.rotateY(-Math.PI / 2);          // faces train-local -x; width runs along z
        const items = DOOR_Z.map(dz => ({ geo: pg, m: M(-BODY_X + 0.012, APER_Y, dz) }));
        const g = mergeGeos(items);
        pg.dispose();
        return g;
    })();
    const trainLeafGeo = (() => {
        const g = new THREE.PlaneGeometry(T_LEAF_W, T_LEAF_H);
        g.rotateY(-Math.PI / 2);
        return g;
    })();

    const baseTrain = buildHCMT(THREE, (w, h, fn) => world.canvasTexture(w, h, fn));
    baseTrain.add(new THREE.Mesh(apertureGeo, insideMat));

    function fitOut(group) {
        const leafA = new THREE.InstancedMesh(trainLeafGeo, leafMatA, DOOR_Z.length);
        const leafB = new THREE.InstancedMesh(trainLeafGeo, leafMatB, DOOR_Z.length);
        leafA.frustumCulled = false; leafB.frustumCulled = false;
        group.add(leafA); group.add(leafB);

        const headMat = new THREE.MeshStandardMaterial({ color: 0x999999, emissive: 0xEAF2FF, emissiveIntensity: 3.0 });
        const tailMat = new THREE.MeshStandardMaterial({ color: 0x330000, emissive: 0xFF2A1A, emissiveIntensity: 2.2 });
        const nz = NOSE_Z - 0.6;
        for (const sx of [-1.16, 1.16]) {
            const hl = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.34, 0.05), headMat);
            hl.position.set(sx, 1.55, nz + 0.18); group.add(hl);
            const tl = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.20, 0.05), tailMat);
            tl.position.set(sx, 1.30, -nz - 0.18); group.add(tl);
        }
        const beam = new THREE.PointLight(0xEDF2FF, 0, 26, 2);
        beam.position.set(0, 1.5, nz + 2.6);
        group.add(beam);
        return { leafA, leafB, beam };
    }

    const nearTrain = baseTrain;
    nearTrain.position.set(TRACK_X, RAIL_Y, 0);
    scene.add(world.ghost(nearTrain));
    const farTrain = baseTrain.clone(true);         // shares geometry and materials
    farTrain.rotation.y = Math.PI;                  // nose toward -z, doors mirrored
    farTrain.position.set(-TRACK_X, RAIL_Y, 0);
    scene.add(world.ghost(farTrain));

    const trains = [
        { g: nearTrain, dir: 1, phase: 0, side: 1, fit: fitOut(nearTrain), psd: psdSides[0] },
        { g: farTrain, dir: -1, phase: 37, side: -1, fit: fitOut(farTrain), psd: psdSides[1] }
    ];

    /* ============================================================
       11 · the air the trains push around
       ============================================================ */
    const DUST_N = 1100;
    const dustMat = new THREE.ShaderMaterial({
        uniforms: {
            uTime: { value: 0 },
            uWakeZ: { value: 0 },
            uWakeAmt: { value: 0 },
            uWakeDir: { value: 1 },
            uFogFar: { value: FOG_FAR }
        },
        vertexShader: `
            attribute float aSeed;
            attribute float aSize;
            varying float vA;
            uniform float uTime;
            uniform float uWakeZ;
            uniform float uWakeAmt;
            uniform float uWakeDir;
            uniform float uFogFar;
            void main() {
                vec3 p = position;
                float t = uTime * 0.11 + aSeed * 9.0;
                p.x += sin(t * 1.31 + aSeed * 5.0) * 0.55;
                p.y += sin(t * 0.87 + aSeed * 3.0) * 0.42 + mod(uTime * 0.045 + aSeed, 1.0) * 1.4;
                p.z += cos(t * 0.71 + aSeed * 7.0) * 0.9;
                float d = p.z - uWakeZ;
                float g = exp(-d * d / 1100.0) * uWakeAmt;
                p.z += g * uWakeDir * 7.5;
                p.y += g * 1.3;
                vec4 mv = modelViewMatrix * vec4(p, 1.0);
                float dist = -mv.z;
                gl_Position = projectionMatrix * mv;
                gl_PointSize = (aSize * 240.0) / max(dist, 1.0);
                vA = (0.15 + g * 0.75) * (1.0 - smoothstep(20.0, uFogFar, dist));
            }`,
        fragmentShader: `
            varying float vA;
            void main() {
                float d = length(gl_PointCoord - vec2(0.5));
                float a = smoothstep(0.5, 0.06, d) * vA;
                if (a < 0.004) discard;
                gl_FragColor = vec4(vec3(1.0, 0.95, 0.86), a);
            }`,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending
    });
    {
        const pos = new Float32Array(DUST_N * 3);
        const seed = new Float32Array(DUST_N);
        const size = new Float32Array(DUST_N);
        for (let i = 0; i < DUST_N; i++) {
            pos[i * 3] = (Math.random() * 2 - 1) * 9.6;
            pos[i * 3 + 1] = 0.25 + Math.random() * 5.4;
            pos[i * 3 + 2] = (Math.random() * 2 - 1) * (HALF - 2);
            seed[i] = Math.random();
            size[i] = 0.5 + Math.random() * 1.5;
        }
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
        g.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
        const pts = new THREE.Points(g, dustMat);
        pts.frustumCulled = false;
        scene.add(world.ghost(pts));
    }

    /* ============================================================
       12 · light
       ============================================================ */
    try {
        const pmrem = new THREE.PMREMGenerator(world.renderer);
        const envScene = new THREE.Scene();
        const envTex = tex(4, 64, (ctx, w, h) => {
            const g = ctx.createLinearGradient(0, 0, 0, h);
            g.addColorStop(0, '#BAB7B1'); g.addColorStop(0.45, '#8E8B85');
            g.addColorStop(0.78, '#6C6963'); g.addColorStop(1, '#4E4B47');
            ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
        });
        const dome = new THREE.Mesh(new THREE.SphereGeometry(50, 16, 12),
            new THREE.MeshBasicMaterial({ map: envTex, side: THREE.BackSide }));
        envScene.add(dome);
        const warm = new THREE.Mesh(new THREE.BoxGeometry(44, 1.6, 3),
            new THREE.MeshBasicMaterial({ color: 0xFFE3B4 }));
        warm.position.set(0, 15, 0); envScene.add(warm);
        for (const sx of [-9, 9]) {
            const cool = new THREE.Mesh(new THREE.BoxGeometry(1.6, 4.5, 34),
                new THREE.MeshBasicMaterial({ color: 0xC0C6CA }));
            cool.position.set(sx, 5.2, 0); envScene.add(cool);
        }
        scene.environment = pmrem.fromScene(envScene, 0.03).texture;
        if ('environmentIntensity' in scene) scene.environmentIntensity = 0.62;
        pmrem.dispose();
    } catch (e) { /* the environment map is a nicety; the world stands without it */ }

    scene.fog = new THREE.Fog(FOG_COL, FOG_NEAR, FOG_FAR);
    scene.add(new THREE.HemisphereLight(0xE9EAEB, 0x6F6D6A, 0.58));
    scene.add(new THREE.AmbientLight(0x9aa0a4, 0.22));
    for (let z = -HALF + 11; z <= HALF - 8; z += 22) {
        const pl = new THREE.PointLight(0xFFDFAE, 46, 25, 2);
        pl.position.set(0, 7.1, z);
        scene.add(pl);
        for (const s of [-1, 1]) {
            const wl = new THREE.PointLight(0xFFB569, 13, 12, 2);
            wl.position.set(s * 6.0, 5.9, z + 11);
            scene.add(wl);
        }
    }
    const midLight = new THREE.PointLight(0xFFEFD8, 40, 34, 2);
    midLight.position.set(0, 7.6, 0);
    scene.add(midLight);

    /* ============================================================
       13 · the berth cycle
       ============================================================ */
    const T_APP = 15, T_SETTLE = 2, T_OPEN = 2.2, T_DWELL = 22,
        T_CLOSE = 2.2, T_HOLD = 1.6, T_DEP = 13, CYCLE = 72;
    const RUN = 200;
    const M_APP = T_APP,
        M_SETTLE = M_APP + T_SETTLE,
        M_OPEN = M_SETTLE + T_OPEN,
        M_DWELL = M_OPEN + T_DWELL,
        M_CLOSE = M_DWELL + T_CLOSE,
        M_HOLD = M_CLOSE + T_HOLD,
        M_DEP = M_HOLD + T_DEP;

    function runState(u) {
        if (u < M_APP) {
            const k = 1 - u / T_APP;
            return { pos: -RUN * k * k * k, speed: 3 * RUN * k * k / T_APP, doors: 0, present: true };
        }
        if (u < M_SETTLE) return { pos: 0, speed: 0, doors: 0, present: true };
        if (u < M_OPEN) return { pos: 0, speed: 0, doors: smooth((u - M_SETTLE) / T_OPEN), present: true };
        if (u < M_DWELL) return { pos: 0, speed: 0, doors: 1, present: true };
        if (u < M_CLOSE) return { pos: 0, speed: 0, doors: 1 - smooth((u - M_DWELL) / T_CLOSE), present: true };
        if (u < M_HOLD) return { pos: 0, speed: 0, doors: 0, present: true };
        if (u < M_DEP) {
            const s = (u - M_HOLD) / T_DEP;
            return { pos: RUN * s * s * s, speed: 3 * RUN * s * s / T_DEP, doors: 0, present: true };
        }
        return { pos: RUN, speed: 0, doors: 0, present: false };
    }
    function stateName(u) {
        if (u < M_APP) return 'approaching';
        if (u < M_OPEN) return 'berthed';
        if (u < M_DWELL) return 'doors open';
        if (u < M_HOLD) return 'berthed';
        if (u < M_DEP) return 'departing';
        return 'clear';
    }

    const dummy = new THREE.Object3D();
    function setTrainLeaves(im, x, y, halfClosed, travel, frac, sign) {
        for (let i = 0; i < DOOR_Z.length; i++) {
            dummy.position.set(x, y, DOOR_Z[i] + sign * (halfClosed + travel * frac));
            dummy.rotation.set(0, 0, 0);
            dummy.updateMatrix();
            im.setMatrixAt(i, dummy.matrix);
        }
        im.instanceMatrix.needsUpdate = true;
    }
    function setPSDLeaves(p, frac) {
        for (let i = 0; i < p.doors.length; i++) {
            for (let k = 0; k < 2; k++) {
                const sign = k === 0 ? -1 : 1;
                dummy.position.set(p.x, PSD_LEAF_Y,
                    p.doors[i] + sign * (PSD_LEAF_W / 2 - 0.02 + PSD_TRAVEL * frac));
                dummy.rotation.set(0, 0, 0);
                dummy.updateMatrix();
                p.leafGlass.setMatrixAt(i * 2 + k, dummy.matrix);
                p.leafFrame.setMatrixAt(i * 2 + k, dummy.matrix);
            }
        }
        p.leafGlass.instanceMatrix.needsUpdate = true;
        p.leafFrame.instanceMatrix.needsUpdate = true;
    }
    const HALF_CLOSED = T_LEAF_W / 2 - 0.015;

    // everything in its place before the first frame is drawn
    for (const tr of trains) {
        setTrainLeaves(tr.fit.leafA, -BODY_X, T_LEAF_Y, HALF_CLOSED, T_TRAVEL, 0, -1);
        setTrainLeaves(tr.fit.leafB, -BODY_X, T_LEAF_Y, HALF_CLOSED, T_TRAVEL, 0, 1);
    }
    for (const p of psdSides) setPSDLeaves(p, 0);
    pids.forEach(p => drawPID(p, 0));
    berthScreens.forEach(b => drawBerth(b, 'clear', -RUN, 0));

    let clock = 0, pidStep = -1, berthStep = -1;
    world.frame((dt) => {
        clock += dt;
        for (const m of glassMats) m.uniforms.uTime.value = clock;

        let wakeZ = 0, wakeAmt = 0, wakeDir = 1;

        for (const tr of trains) {
            const u = (clock + tr.phase) % CYCLE;
            const st = runState(u);
            tr.g.position.z = tr.dir * st.pos;
            tr.g.visible = st.present;
            tr.state = stateName(u);
            tr.offset = st.pos;
            tr.speed = st.speed;

            setTrainLeaves(tr.fit.leafA, -BODY_X, T_LEAF_Y, HALF_CLOSED, T_TRAVEL, st.doors, -1);
            setTrainLeaves(tr.fit.leafB, -BODY_X, T_LEAF_Y, HALF_CLOSED, T_TRAVEL, st.doors, 1);
            setPSDLeaves(tr.psd, st.doors);

            tr.fit.beam.intensity = st.present ? 6 + Math.min(1, st.speed / 20) * 42 : 0;

            if (st.present && st.speed > 3) {
                const amt = Math.min(1, st.speed / 26);
                if (amt > wakeAmt) {
                    wakeAmt = amt;
                    wakeZ = tr.dir * (st.pos + NOSE_Z);
                    wakeDir = tr.dir;
                }
            }
        }

        dustMat.uniforms.uTime.value = clock;
        dustMat.uniforms.uWakeZ.value = wakeZ;
        dustMat.uniforms.uWakeAmt.value = wakeAmt;
        dustMat.uniforms.uWakeDir.value = wakeDir;

        const ps = Math.floor(clock / 40);
        if (ps !== pidStep) { pidStep = ps; pids.forEach(p => drawPID(p, clock)); }

        const bs = Math.floor(clock * 5);
        if (bs !== berthStep) {
            berthStep = bs;
            for (const b of berthScreens) {
                const tr = trains.find(t => t.side === b.side);
                drawBerth(b, tr.state, tr.offset, tr.speed);
            }
        }
    });
}
