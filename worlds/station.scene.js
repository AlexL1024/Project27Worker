//
//  station.scene.js
//  State Library Station — Metro Tunnel, Melbourne
//
//  The full cavern as built: central concourse between the two platforms,
//  crossing orange arches and stacked gold lanterns over the middle, dark
//  timber-banded vaults with orange cone lamps over the platforms, blade
//  columns carrying longitudinal beams, full-height platform screen doors,
//  the mid-station escalators up to the Exit 1 mezzanine (with the glazed
//  Information box in the walk-under space beneath), the Exit 2 escalator
//  bank at one end and the lift core at the other.
//
//  Written against the Project27 runtime (build(world)) — the app keeps the
//  camera, the loop and the walk; this module says what is in the station.
//
//  Plan (z runs the length of the cavern):
//      z -55 ─ end wall · lifts ─ open concourse ─ end wall z +55
//

import { buildHCMT, HCMT_DOORS } from './hcmt.scene.js';

export default function build(world) {
    const { THREE, scene } = world;

    world.ownsSky(true);
    world.groundLevel(0);
    world.bloom({ strength: 0.3, radius: 0.55, threshold: 0.82 });

    /* ============================================================
       0 · constants + helpers
       ============================================================ */
    const LEN = 220, HALF = LEN / 2;      // cavern length, z in [-110, 110] (10-car provision)
    const R = 11.9, CY = 2.4;             // vault radius / centre height (crown 14.3)
    const COL_X = 5.2;                    // blade column line
    const BEAM_Y = 5.1, BEAM_H = 1.0;     // longitudinal beam centre / depth
    const BAY = 6;                        // arch bay
    const ARCH_X = 4.8, ARCH_Y0 = 5.45, ARCH_H = 4.4;   // arch span/spring/rise (crown ~9.85)
    const PSD_X = 11.4;                   // platform screen door wall (6.2 m platforms)
    const MEZZ = { z0: -8, z1: 8, y: 4.0 };             // Exit 1 mezzanine

    const tex = (w, h, draw, rx, ry) => {
        const t = world.canvasTexture(w, h, (ctx, cv) => draw(ctx, cv.width, cv.height));
        if (rx || ry) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx || 1, ry || 1); }
        return t;
    };
    function mergeGeos(items) {
        const pos = [], nor = [], uv = [];
        for (const it of items) {
            let g = it.geo.clone();
            if (it.m) g.applyMatrix4(it.m);
            g = g.index ? g.toNonIndexed() : g;
            pos.push(...g.attributes.position.array);
            nor.push(...g.attributes.normal.array);
            const u = g.attributes.uv;
            if (u) uv.push(...u.array); else uv.push(...new Float32Array(g.attributes.position.count * 2));
            g.dispose();
        }
        const out = new THREE.BufferGeometry();
        out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
        out.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
        return out;
    }
    const M = (x, y, z, rx, ry, rz) => {
        const m = new THREE.Matrix4();
        m.compose(new THREE.Vector3(x, y, z),
            new THREE.Quaternion().setFromEuler(new THREE.Euler(rx || 0, ry || 0, rz || 0)),
            new THREE.Vector3(1, 1, 1));
        return m;
    };

    /* ============================================================
       1 · textures
       ============================================================ */
    const concreteTex = tex(512, 512, (ctx, w, h) => {
        ctx.fillStyle = '#a6a5a1'; ctx.fillRect(0, 0, w, h);
        for (let i = 0; i < 260; i++) {
            const x = Math.random() * w, y = Math.random() * h, r = 12 + Math.random() * 55;
            const g = ctx.createRadialGradient(x, y, 0, x, y, r);
            const tone = Math.random() < 0.5 ? '142,141,138' : '177,176,173';
            g.addColorStop(0, `rgba(${tone},${0.05 + Math.random() * 0.08})`);
            g.addColorStop(1, `rgba(${tone},0)`);
            ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
        }
        for (let i = 0; i < 2600; i++) {
            ctx.fillStyle = `rgba(${Math.random() < 0.5 ? '120,118,112' : '215,213,207'},${Math.random() * 0.14})`;
            ctx.fillRect(Math.random() * w, Math.random() * h, 1.4, 1.4);
        }
        ctx.strokeStyle = 'rgba(110,108,102,0.28)'; ctx.lineWidth = 1.5;
        for (let i = 1; i < 4; i++) { ctx.beginPath(); ctx.moveTo(i * w / 4, 0); ctx.lineTo(i * w / 4, h); ctx.stroke(); }
        ctx.strokeStyle = 'rgba(110,108,102,0.16)';
        ctx.beginPath(); ctx.moveTo(0, h / 2); ctx.lineTo(w, h / 2); ctx.stroke();
    }, 10, 3);
    const colTex = concreteTex.clone(); colTex.repeat.set(2, 2); colTex.needsUpdate = true;

    const floorTex = tex(512, 512, (ctx, w, h) => {
        ctx.fillStyle = '#b0aeaa'; ctx.fillRect(0, 0, w, h);
        const n = 4, s = w / n;
        for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
            const v = 168 + Math.floor(Math.random() * 16);
            ctx.fillStyle = `rgb(${v},${v},${v - 3})`;
            ctx.fillRect(i * s + 1, j * s + 1, s - 2, s - 2);
            for (let k = 0; k < 190; k++) {
                ctx.fillStyle = `rgba(${Math.random() < 0.5 ? '118,117,114' : '232,231,228'},${Math.random() * 0.16})`;
                ctx.fillRect(i * s + Math.random() * s, j * s + Math.random() * s, 1.2, 1.2);
            }
        }
        ctx.strokeStyle = 'rgba(125,122,115,0.55)'; ctx.lineWidth = 2;
        for (let i = 0; i <= n; i++) {
            ctx.beginPath(); ctx.moveTo(i * s, 0); ctx.lineTo(i * s, h); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(0, i * s); ctx.lineTo(w, i * s); ctx.stroke();
        }
    }, 5, 32);


    // dark timber battens over the platforms
    const battenTex = tex(256, 256, (ctx, w, h) => {
        ctx.fillStyle = '#221b15'; ctx.fillRect(0, 0, w, h);
        for (let x = 0; x < w; x += 12) {
            ctx.fillStyle = '#2e241b'; ctx.fillRect(x, 0, 7, h);
            ctx.fillStyle = '#171310'; ctx.fillRect(x + 7, 0, 5, h);
        }
    }, 24, 2);

    // flat metal panel ceilings (under mezzanine / near Exit 2)
    const panelTex = tex(512, 512, (ctx, w, h) => {
        ctx.fillStyle = '#cfd1d0'; ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = 'rgba(90,92,92,0.6)'; ctx.lineWidth = 3;
        for (let i = 0; i <= 4; i++) {
            ctx.beginPath(); ctx.moveTo(i * w / 4, 0); ctx.lineTo(i * w / 4, h); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(0, i * h / 4); ctx.lineTo(w, i * h / 4); ctx.stroke();
        }
        for (let i = 0; i < 900; i++) {
            ctx.fillStyle = `rgba(120,122,122,${Math.random() * 0.08})`;
            ctx.fillRect(Math.random() * w, Math.random() * h, 1.5, 1.5);
        }
    }, 4, 6);

    // white glazed panelling with black grid (lift core / info box)
    const glazedTex = tex(512, 512, (ctx, w, h) => {
        ctx.fillStyle = '#E9EBE7'; ctx.fillRect(0, 0, w, h);
        const g = ctx.createLinearGradient(0, 0, w, h);
        g.addColorStop(0, 'rgba(255,255,255,0.25)'); g.addColorStop(1, 'rgba(180,184,180,0.2)');
        ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = '#1c1d1e'; ctx.lineWidth = 6;
        for (let i = 0; i <= 4; i++) { ctx.beginPath(); ctx.moveTo(i * w / 4, 0); ctx.lineTo(i * w / 4, h); ctx.stroke(); }
        for (let i = 0; i <= 3; i++) { ctx.beginPath(); ctx.moveTo(0, i * h / 3); ctx.lineTo(w, i * h / 3); ctx.stroke(); }
    }, 3, 1);

    /* ============================================================
       2 · materials
       ============================================================ */
    const concreteMat = new THREE.MeshStandardMaterial({ map: concreteTex, roughness: 0.94 });
    const columnMat = new THREE.MeshStandardMaterial({ map: colTex, roughness: 0.9 });
    const floorMat = new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.7, metalness: 0.05 });
    const orangeMat = new THREE.MeshStandardMaterial({ color: 0xF2611C, roughness: 0.5, metalness: 0.05,
        emissive: 0xD84A10, emissiveIntensity: 0.12 });
    const amberMat = new THREE.MeshStandardMaterial({ color: 0xD79A33, roughness: 0.45, metalness: 0.2 });
    const coreMat = new THREE.MeshStandardMaterial({ color: 0x443311, emissive: 0xFFD98F, emissiveIntensity: 2.2 });
    const finMat = new THREE.MeshStandardMaterial({
        color: 0xF2E4BE, emissive: 0xD9C08A, emissiveIntensity: 0.55,
        transparent: true, opacity: 0.78, side: THREE.DoubleSide });
    const steelMat = new THREE.MeshStandardMaterial({ color: 0xB4B7BA, roughness: 0.45, metalness: 0.35 });
    const darkMetal = new THREE.MeshStandardMaterial({ color: 0x3A3D40, roughness: 0.5, metalness: 0.3 });
    const blackMat = new THREE.MeshStandardMaterial({ color: 0x121314, roughness: 0.9 });
    const slatMat = new THREE.MeshStandardMaterial({ color: 0xB3B6B9, roughness: 0.5, metalness: 0.25 });
    const glassMat = new THREE.MeshStandardMaterial({
        color: 0xBFC8CC, roughness: 0.08, metalness: 0.25, transparent: true, opacity: 0.45 });
    const psdGlassMat = new THREE.MeshStandardMaterial({
        color: 0x5A6266, roughness: 0.08, metalness: 0.4, transparent: true, opacity: 0.35 });
    const lensMat = new THREE.MeshStandardMaterial({ color: 0x777777, emissive: 0xFFF4DC, emissiveIntensity: 1.1 });
    const ledMat = new THREE.MeshStandardMaterial({ color: 0x888888, emissive: 0xEDF3F2, emissiveIntensity: 2.2 });
    const coneGlowMat = new THREE.MeshStandardMaterial({ color: 0x442200, emissive: 0xF08A28, emissiveIntensity: 1.6 });
    const magentaMat = new THREE.MeshStandardMaterial({ color: 0x6B1F45, emissive: 0xC2347C, emissiveIntensity: 0.3 });
    const redMat = new THREE.MeshStandardMaterial({ color: 0xA83228, roughness: 0.6 });
    const glazedMat = new THREE.MeshStandardMaterial({ map: glazedTex, roughness: 0.35, metalness: 0.05,
        emissive: 0xB9BCB6, emissiveMap: glazedTex, emissiveIntensity: 0.28 });
    const panelMat = new THREE.MeshStandardMaterial({ map: panelTex, roughness: 0.6, metalness: 0.15 });

    /* ============================================================
       3 · vault, floor, ceiling bands
       ============================================================ */
    const roofVault = new THREE.Group(); scene.add(roofVault);
    const vaultGeo = new THREE.CylinderGeometry(R, R, LEN, 64, 1, true, 1.782, 2.72);
    vaultGeo.rotateX(Math.PI / 2);
    const vault = new THREE.Mesh(vaultGeo, new THREE.MeshStandardMaterial({
        map: concreteTex, roughness: 0.94, side: THREE.BackSide }));
    vault.position.y = CY;
    roofVault.add(vault);

    const floor = new THREE.Mesh(new THREE.PlaneGeometry(23.4, LEN), floorMat);
    floor.rotation.x = -Math.PI / 2;
    scene.add(world.ground(floor));

    const strip = (x, wdt, col) => {
        const m = new THREE.Mesh(new THREE.PlaneGeometry(wdt, LEN),
            new THREE.MeshStandardMaterial({ color: col, roughness: 0.85 }));
        m.rotation.x = -Math.PI / 2; m.position.set(x, 0.012, 0);
        scene.add(world.ghost(m));
    };
    strip(-9.9, 0.45, 0x8f8c86); strip(9.9, 0.45, 0x8f8c86);   // platform tactiles
    strip(-3.9, 0.3, 0xa5a29b); strip(3.9, 0.3, 0xa5a29b);     // concourse guides
    strip(0, 0.28, 0xa19e97);

    {   // aluminium slats over the centre, dark battens over the platforms
        const items = [];
        const slat = new THREE.BoxGeometry(0.36, 0.07, LEN);
        const rc = R - 0.28;
        const band = (a0, a1) => {
            for (let a = a0; a <= a1; a += 2.8) {
                const phi = a * Math.PI / 180;
                items.push({ geo: slat, m: M(Math.cos(phi) * rc, CY + Math.sin(phi) * rc, 0, 0, 0, phi) });
            }
        };
        band(66, 87); band(93, 114);
        roofVault.add(new THREE.Mesh(mergeGeos(items), slatMat));

        // dark timber vault bands over each platform (backing + batten ribs)
        const darkBack = new THREE.MeshStandardMaterial({ color: 0x15100c, roughness: 0.95 });
        const darkRib = new THREE.MeshStandardMaterial({ color: 0x2E241B, roughness: 0.8 });
        const backs = [], ribs = [];
        const backG = new THREE.BoxGeometry(1.15, 0.06, LEN);
        const ribG = new THREE.BoxGeometry(0.16, 0.1, LEN);
        for (const s2 of [-1, 1]) {
            for (let a = 13; a <= 57; a += 7) {
                const phi = (s2 > 0 ? a : 180 - a) * Math.PI / 180;
                backs.push({ geo: backG, m: M(Math.cos(phi) * (R - 0.14), CY + Math.sin(phi) * (R - 0.14), 0, 0, 0, phi) });
            }
            for (let a = 11.5; a <= 59; a += 1.6) {
                const phi = (s2 > 0 ? a : 180 - a) * Math.PI / 180;
                ribs.push({ geo: ribG, m: M(Math.cos(phi) * (R - 0.3), CY + Math.sin(phi) * (R - 0.3), 0, 0, 0, phi) });
            }
        }
        roofVault.add(new THREE.Mesh(mergeGeos(backs), darkBack));
        roofVault.add(new THREE.Mesh(mergeGeos(ribs), darkRib));

        // crown services: red conduit + steel pipes
        const conduit = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.07, LEN), redMat);
        conduit.position.set(0, CY + R - 0.16, 0); roofVault.add(conduit);
        const pipeG = new THREE.CylinderGeometry(0.045, 0.045, LEN, 8); pipeG.rotateX(Math.PI / 2);
        const p1 = new THREE.Mesh(pipeG, steelMat); p1.position.set(-0.55, CY + R - 0.2, 0); roofVault.add(p1);
        const p2 = p1.clone(); p2.position.x = 0.55; roofVault.add(p2);

        // magenta art panels on the vault flanks above the mezzanine
        const mag = [];
        const magG = new THREE.BoxGeometry(0.5, 0.09, 10);
        for (const s of [-1, 1]) for (let a = 58; a <= 74; a += 5.5) {
            const phi = (s > 0 ? a : 180 - a) * Math.PI / 180;
            mag.push({ geo: magG, m: M(Math.cos(phi) * (R - 0.34), CY + Math.sin(phi) * (R - 0.34), 0, 0, 0, phi) });
        }
        roofVault.add(new THREE.Mesh(mergeGeos(mag), magentaMat));
    }

    /* ============================================================
       4 · crossing orange arches + pendant lanterns
       ============================================================ */
    class ArchCurve extends THREE.Curve {
        constructor(sx, ex, z0, z1) { super(); this.sx = sx; this.ex = ex; this.z0 = z0; this.z1 = z1; }
        getPoint(t) {
            return new THREE.Vector3(
                this.sx + (this.ex - this.sx) * (1 - Math.cos(Math.PI * t)) / 2,
                ARCH_Y0 + ARCH_H * Math.sin(Math.PI * t),
                this.z0 + (this.z1 - this.z0) * t);
        }
    }
    {
        const shape = new THREE.Shape();
        shape.moveTo(-0.30, -0.09); shape.lineTo(0.30, -0.09);
        shape.lineTo(0.30, 0.09); shape.lineTo(-0.30, 0.09); shape.closePath();
        const archItems = [], steelItems = [], rodItems = [];
        const rodG = new THREE.CylinderGeometry(0.035, 0.035, 4.5, 8);
        const nodeG = new THREE.BoxGeometry(0.3, 0.55, 0.3);
        const brktG = new THREE.BoxGeometry(0.8, 0.5, 0.8);
        for (let z0 = -HALF + 1; z0 + BAY <= HALF - 0.99; z0 += BAY) {
            const z1 = z0 + BAY;
            archItems.push(
                { geo: new THREE.ExtrudeGeometry(shape, { steps: 56, bevelEnabled: false, extrudePath: new ArchCurve(-ARCH_X, ARCH_X, z0, z1) }) },
                { geo: new THREE.ExtrudeGeometry(shape, { steps: 56, bevelEnabled: false, extrudePath: new ArchCurve(ARCH_X, -ARCH_X, z0, z1) }) });
            const zc = z0 + BAY / 2;
            steelItems.push({ geo: nodeG, m: M(0, ARCH_Y0 + ARCH_H, zc) });
            rodItems.push({ geo: rodG, m: M(0, ARCH_Y0 + ARCH_H + 2.5, zc) });
        }
        for (let z = -HALF + 1; z <= HALF - 0.99; z += BAY) {
            steelItems.push({ geo: brktG, m: M(-ARCH_X - 0.1, BEAM_Y + BEAM_H / 2 + 0.25, z) });
            steelItems.push({ geo: brktG, m: M(ARCH_X + 0.1, BEAM_Y + BEAM_H / 2 + 0.25, z) });
        }
        roofVault.add(new THREE.Mesh(mergeGeos(archItems), orangeMat));
        roofVault.add(new THREE.Mesh(mergeGeos(steelItems), steelMat));
        roofVault.add(new THREE.Mesh(mergeGeos(rodItems), steelMat));
    }
    {   // pendant lanterns at every crossing
        const amber = [], cores = [], fins = [], rods = [];
        const rodG = new THREE.CylinderGeometry(0.022, 0.022, 2.6, 8);
        const capG = new THREE.CylinderGeometry(0.125, 0.125, 0.45, 14);
        const botG = new THREE.CylinderGeometry(0.125, 0.125, 0.38, 14);
        const coreG = new THREE.CylinderGeometry(0.105, 0.105, 0.26, 12);
        const finG = new THREE.CylinderGeometry(0.155, 0.155, 0.045, 16);
        const dotG = new THREE.CylinderGeometry(0.075, 0.075, 0.03, 12);
        for (let z0 = -HALF + 1; z0 + BAY <= HALF - 0.99; z0 += BAY) {
            const zc = z0 + BAY / 2;
            if (zc < -43.5) continue;
            if (zc > -6 && zc < 10) continue;      // the Exit 2 escalator rises here
            rods.push({ geo: rodG, m: M(0, 10.1, zc) });
            amber.push({ geo: capG, m: M(0, 8.68, zc) });
            for (let j = 0; j < 7; j++) {
                const y = 8.31 - j * 0.28;
                cores.push({ geo: coreG, m: M(0, y, zc) });
                fins.push({ geo: finG, m: M(0, y - 0.14, zc) });
            }
            amber.push({ geo: botG, m: M(0, 6.16, zc) });
            cores.push({ geo: dotG, m: M(0, 5.95, zc) });
        }
        roofVault.add(new THREE.Mesh(mergeGeos(rods), steelMat));
        roofVault.add(new THREE.Mesh(mergeGeos(amber), amberMat));
        roofVault.add(new THREE.Mesh(mergeGeos(cores), coreMat));
        roofVault.add(new THREE.Mesh(mergeGeos(fins), finMat));
    }

    /* ============================================================
       5 · blade columns, beams, fixtures, platform cone lamps
       ============================================================ */
    {
        const colItems = [], plinthItems = [], steelItems = [], lensItems = [];
        // blade column: two round ends + slab between (pill plan, long axis along z)
        const endG = new THREE.CylinderGeometry(0.42, 0.42, 4.6, 14);
        const midG = new THREE.BoxGeometry(0.84, 4.6, 1.7);
        const pEndG = new THREE.CylinderGeometry(0.5, 0.5, 0.24, 14);
        const pMidG = new THREE.BoxGeometry(1.0, 0.24, 1.7);
        const spotG = new THREE.CylinderGeometry(0.09, 0.09, 0.5, 12);
        const lensG = new THREE.CylinderGeometry(0.07, 0.07, 0.03, 12);
        for (let z = -HALF + 3; z <= HALF - 2; z += BAY) {
            for (const s of [-1, 1]) {
                const x = s * COL_X;
                colItems.push({ geo: midG, m: M(x, 2.3, z) });
                colItems.push({ geo: endG, m: M(x, 2.3, z - 0.85) });
                colItems.push({ geo: endG, m: M(x, 2.3, z + 0.85) });
                plinthItems.push({ geo: pMidG, m: M(x, 0.12, z) });
                plinthItems.push({ geo: pEndG, m: M(x, 0.12, z - 0.85) });
                plinthItems.push({ geo: pEndG, m: M(x, 0.12, z + 0.85) });
                // uplights on the beam top + downlights under the beam (platform side)
                steelItems.push({ geo: spotG, m: M(x - s * 0.2, BEAM_Y + BEAM_H / 2 + 0.35, z + 2.2, 0, 0, s * 0.45) });
                lensItems.push({ geo: lensG, m: M(x - s * 0.2 - Math.sin(s * 0.45) * 0.27, BEAM_Y + BEAM_H / 2 + 0.35 + Math.cos(s * 0.45) * 0.27, z + 2.2, 0, 0, s * 0.45) });
                steelItems.push({ geo: spotG, m: M(x + s * 0.55, BEAM_Y - BEAM_H / 2 - 0.3, z + 2.8, 0, 0, 0) });
                lensItems.push({ geo: lensG, m: M(x + s * 0.55, BEAM_Y - BEAM_H / 2 - 0.57, z + 2.8, 0, 0, 0) });
            }
        }
        roofVault.add(new THREE.Mesh(mergeGeos(colItems), columnMat));
        roofVault.add(new THREE.Mesh(mergeGeos(plinthItems), blackMat));
        roofVault.add(new THREE.Mesh(mergeGeos(steelItems), steelMat));
        roofVault.add(new THREE.Mesh(mergeGeos(lensItems), lensMat));

        // longitudinal beams the arches spring from
        for (const s of [-1, 1]) {
            const beam = new THREE.Mesh(new THREE.BoxGeometry(1.05, BEAM_H, LEN), columnMat);
            beam.position.set(s * COL_X, BEAM_Y, 0);
            roofVault.add(beam);
        }
        // the beam itself continues as a solid wall all the way up to the vault
        for (const s2 of [-1, 1]) {
            const upH = 8.0;
            const up = new THREE.Mesh(new THREE.BoxGeometry(0.9, upH, LEN), concreteMat);
            up.position.set(s2 * COL_X, BEAM_Y + BEAM_H / 2 + upH / 2, 0);
            roofVault.add(up);
        }

        // orange cone lamps over the platforms
        const coneItems = [], glowItems = [], stemItems = [];
        const coneG = new THREE.CylinderGeometry(0.3, 0.07, 0.36, 12, 1, true);
        const glowG = new THREE.CylinderGeometry(0.26, 0.26, 0.02, 12);
        const stemG = new THREE.CylinderGeometry(0.02, 0.02, 3.4, 6);
        const coneMat = new THREE.MeshStandardMaterial({ color: 0x453325, roughness: 0.55, metalness: 0.4, side: THREE.DoubleSide });
        for (let z = -HALF + 4; z <= HALF - 3; z += 5.5) {
            for (const s of [-1, 1]) {
                const x = s * 8.5;
                stemItems.push({ geo: stemG, m: M(x, 9.1, z) });
                coneItems.push({ geo: coneG, m: M(x, 7.35, z) });
                glowItems.push({ geo: glowG, m: M(x, 7.29, z) });
            }
        }
        roofVault.add(new THREE.Mesh(mergeGeos(stemItems), darkMetal));
        roofVault.add(new THREE.Mesh(mergeGeos(coneItems), coneMat));
        roofVault.add(new THREE.Mesh(mergeGeos(glowItems), coneGlowMat));
    }

    /* ============================================================
       6 · full-height platform screen doors
       ============================================================ */
    const psdMovers = { '1': null, '-1': null };
    {
        const psSteel = new THREE.MeshStandardMaterial({ color: 0xC9CCCE, roughness: 0.3, metalness: 0.6 });
        const leafMat = new THREE.MeshStandardMaterial({ color: 0x22262A, roughness: 0.08, metalness: 0.5,
            transparent: true, opacity: 0.72 });
        const louvreTex = tex(256, 256, (ctx, w, h) => {
            ctx.fillStyle = '#101112'; ctx.fillRect(0, 0, w, h);
            for (let x = 0; x < w; x += 10) {
                ctx.fillStyle = '#1E2022'; ctx.fillRect(x, 0, 5, h);
                ctx.fillStyle = '#070808'; ctx.fillRect(x + 5, 0, 5, h);
            }
        }, LEN / 2, 1);
        const arrowTex = tex(96, 64, (ctx, w, h) => {
            ctx.clearRect(0, 0, w, h);
            ctx.fillStyle = '#2C7BC4'; ctx.fillRect(8, 12, 80, 40);
            ctx.fillStyle = '#fff'; ctx.font = '700 34px Arial'; ctx.textBaseline = 'middle'; ctx.textAlign = 'center';
            ctx.fillText('→', w / 2, h / 2 + 2);
        });
        const arrowMat = new THREE.MeshBasicMaterial({ map: arrowTex, transparent: true });
        const STOP = 35.5;   // where a train's centre halts (front 21 of 30 doorways)
        const trainDoors = (typeof HCMT_DOORS !== 'undefined' && HCMT_DOORS.all ? HCMT_DOORS.all : [])
            .map(z => z + STOP);
        const extraDoors = [];
        for (const c of [-90.4, -113, -135.6]) {
            for (const o of [-7.85, -0.15, 6.75]) extraDoors.push(c + o + STOP);
        }
        const activeSet = new Set(trainDoors.map(z => z.toFixed(1)));
        const doorZBase = [...trainDoors, ...extraDoors].filter(z => Math.abs(z) < HALF - 1.6);
        const numTexs = { '1': tex(128, 128, (ctx, w, h) => {
                ctx.fillStyle = '#F4F4F1'; ctx.fillRect(0, 0, w, h);
                ctx.fillStyle = '#222'; ctx.font = '600 84px Arial'; ctx.textBaseline = 'middle'; ctx.textAlign = 'center';
                ctx.fillText('1', w / 2, h / 2 + 4); }),
            '-1': tex(128, 128, (ctx, w, h) => {
                ctx.fillStyle = '#F4F4F1'; ctx.fillRect(0, 0, w, h);
                ctx.fillStyle = '#222'; ctx.font = '600 84px Arial'; ctx.textBaseline = 'middle'; ctx.textAlign = 'center';
                ctx.fillText('2', w / 2, h / 2 + 4); }) };
        const leafG = new THREE.BoxGeometry(0.06, 2.52, 0.96);
        const arrowG = new THREE.PlaneGeometry(0.34, 0.22);
        const tileG = new THREE.PlaneGeometry(0.34, 0.34);
        for (const sd of [-1, 1]) {
            const x = sd * PSD_X;
            const rotY = sd > 0 ? -Math.PI / 2 : Math.PI / 2;
            const doorZ = sd > 0 ? doorZBase : doorZBase.map(z => -z);
            const frames = [], posts = [], glassGeos = [], tileGeos = [];
            const actL = [], actR = [], statLeaf = [], arrActL = [], arrActR = [], arrStat = [];
            frames.push({ geo: new THREE.BoxGeometry(0.14, 0.1, LEN), m: M(x, 0.05, 0) });
            frames.push({ geo: new THREE.BoxGeometry(0.2, 0.35, LEN), m: M(x, 2.75, 0) });
            const band = new THREE.Mesh(new THREE.PlaneGeometry(LEN, 2.0),
                new THREE.MeshStandardMaterial({ map: louvreTex, roughness: 0.7, metalness: 0.3 }));
            band.rotation.y = rotY; band.position.set(sd * (PSD_X + 0.06), 3.95, 0);
            scene.add(band);
            const led = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.07, LEN), ledMat);
            led.position.set(sd * (PSD_X - 0.25), 4.72, 0);
            scene.add(led);
            const sorted = [...doorZ].sort((a, b) => a - b);
            for (const dz of sorted) {
                const active = activeSet.has((sd > 0 ? dz : -dz).toFixed(1));
                for (const pz of [dz - 1.05, dz + 1.05]) {
                    posts.push({ geo: new THREE.BoxGeometry(0.15, 2.72, 0.15), m: M(x, 1.36, pz) });
                }
                for (const lr of [-1, 1]) {
                    const lm = M(x, 1.31, dz + lr * 0.48);
                    const am = M(sd * (PSD_X - 0.055), 1.5, dz + lr * 0.48, 0, rotY, 0);
                    if (active) {
                        (lr < 0 ? actL : actR).push({ geo: leafG, m: lm });
                        (lr < 0 ? arrActL : arrActR).push({ geo: arrowG, m: am });
                    } else {
                        statLeaf.push({ geo: leafG, m: lm });
                        arrStat.push({ geo: arrowG, m: am });
                    }
                }
                tileGeos.push({ geo: tileG, m: M(sd * (PSD_X + 0.02), 3.5, dz, 0, rotY, 0) });
            }
            const edges = [-HALF + 3.1, ...sorted.flatMap(z => [z - 1.05, z + 1.05]), HALF - 3.1];
            for (let i = 0; i < edges.length; i += 2) {
                const a = edges[i], b = edges[i + 1];
                if (b - a < 0.35) continue;
                glassGeos.push({ geo: new THREE.PlaneGeometry(b - a - 0.06, 2.55), m: M(x, 1.325, (a + b) / 2, 0, rotY, 0) });
                frames.push({ geo: new THREE.BoxGeometry(0.1, 0.08, b - a), m: M(x, 1.32, (a + b) / 2) });
                if (b - a > 3.4) frames.push({ geo: new THREE.BoxGeometry(0.09, 2.55, 0.08), m: M(x, 1.325, (a + b) / 2) });
            }
            scene.add(new THREE.Mesh(mergeGeos(frames), darkMetal));
            scene.add(new THREE.Mesh(mergeGeos(posts), psSteel));
            scene.add(new THREE.Mesh(mergeGeos(glassGeos), psdGlassMat));
            scene.add(new THREE.Mesh(mergeGeos(tileGeos), new THREE.MeshBasicMaterial({ map: numTexs[String(sd)] })));
            if (statLeaf.length) scene.add(new THREE.Mesh(mergeGeos(statLeaf), leafMat));
            if (arrStat.length) scene.add(new THREE.Mesh(mergeGeos(arrStat), arrowMat));
            const mv = {
                L: new THREE.Mesh(mergeGeos(actL), leafMat),
                R: new THREE.Mesh(mergeGeos(actR), leafMat),
                aL: new THREE.Mesh(mergeGeos(arrActL), arrowMat),
                aR: new THREE.Mesh(mergeGeos(arrActR), arrowMat),
            };
            for (const k2 of ['L', 'R', 'aL', 'aR']) scene.add(mv[k2]);
            psdMovers[String(sd)] = mv;
        }
    }

    /* ============================================================
       7 · escalators (shared builder)
       ============================================================ */


    /* ============================================================
       8 · Exit 1 mezzanine (mid-station), info box, lifts, Exit 2
       ============================================================ */
    {   // ---- Exit 1 lift wall: full-height glazed wall closing the -z end ----
        const WALL_Z = -105, WW = 10.4, WH = 11.0;
        const px = 1024;
        const mx = (m) => (m / WW + 0.5) * px;          // metres (x, centred) -> canvas x
        const my = (m) => (1 - m / WH) * px;            // metres (height)     -> canvas y
        const liftWallTex = tex(px, px, (ctx) => {
            // glazed white panels with a soft sheen
            ctx.fillStyle = '#E7E8E3'; ctx.fillRect(0, 0, px, px);
            const g = ctx.createLinearGradient(0, 0, 0, px);
            g.addColorStop(0, 'rgba(200,203,198,0.25)');
            g.addColorStop(0.55, 'rgba(255,255,255,0.18)');
            g.addColorStop(1, 'rgba(210,212,206,0.2)');
            ctx.fillStyle = g; ctx.fillRect(0, 0, px, px);
            for (let i = 0; i < 40; i++) {              // faint per-panel tone shifts
                ctx.fillStyle = `rgba(${205 + Math.floor(Math.random() * 20)},${207 + Math.floor(Math.random() * 18)},${202 + Math.floor(Math.random() * 18)},0.12)`;
                ctx.fillRect(Math.floor(Math.random() * 8) * 128, Math.floor(Math.random() * 8) * 128, 128, 128);
            }
            // dark joint grid
            ctx.strokeStyle = '#3A3B3D'; ctx.lineWidth = 3;
            for (let x = 128; x < px; x += 128) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, px); ctx.stroke(); }
            for (const h of [10.2, 8.8, 7.4, 6.0, 4.6, 1.7]) {
                ctx.beginPath(); ctx.moveTo(0, my(h)); ctx.lineTo(px, my(h)); ctx.stroke();
            }
            // heavier lintel line over the door zone
            ctx.strokeStyle = '#2E2F31'; ctx.lineWidth = 6;
            ctx.beginPath(); ctx.moveTo(0, my(3.4)); ctx.lineTo(px, my(3.4)); ctx.stroke();
            // base skirt
            ctx.fillStyle = '#1A1B1C'; ctx.fillRect(0, my(0.12), px, px - my(0.12));
            // two lift doors + navy headers + yellow Exit 1 chips
            for (const cxm of [-2.6, 2.6]) {
                const dx = mx(cxm - 0.8), dw = mx(cxm + 0.8) - dx;
                const dy = my(2.45), dh = my(0.12) - dy;
                ctx.fillStyle = '#5F6367'; ctx.fillRect(dx - 8, dy - 8, dw + 16, dh + 8);   // frame
                const dg = ctx.createLinearGradient(dx, 0, dx + dw, 0);                     // brushed doors
                dg.addColorStop(0, '#B2B6BA'); dg.addColorStop(0.5, '#9FA3A7'); dg.addColorStop(1, '#AEB2B6');
                ctx.fillStyle = dg; ctx.fillRect(dx, dy, dw, dh);
                ctx.strokeStyle = '#6A6E72'; ctx.lineWidth = 4;
                ctx.beginPath(); ctx.moveTo(dx + dw / 2, dy); ctx.lineTo(dx + dw / 2, dy + dh); ctx.stroke();
                // navy header band
                const bx = mx(cxm - 1.15), bw = mx(cxm + 1.15) - bx;
                ctx.fillStyle = '#161E2A'; ctx.fillRect(bx, my(3.25), bw, my(2.62) - my(3.25));
                ctx.fillStyle = '#F5C400'; ctx.fillRect(bx + 8, my(2.86), 74, my(2.62) - my(2.86));
                ctx.fillStyle = '#161E2A'; ctx.font = '600 20px Arial'; ctx.textBaseline = 'middle';
                ctx.fillText('Exit 1', bx + 14, (my(2.86) + my(2.62)) / 2);
                ctx.fillStyle = '#fff'; ctx.font = '600 34px Arial';
                ctx.fillText('Lifts', bx + bw / 2 - 20, (my(3.25) + my(2.86)) / 2);
                ctx.fillStyle = '#2C7BC4'; ctx.fillRect(bx + bw / 2 - 62, (my(3.25) + my(2.86)) / 2 - 15, 30, 30);
                // accessibility square beside the door
                ctx.fillStyle = '#2C7BC4'; ctx.fillRect(mx(cxm + 0.95), my(2.35), 17, 17);
                // call button plate
                ctx.fillStyle = '#8F9397'; ctx.fillRect(mx(cxm - 1.05), my(1.35), 14, 40);
            }
        });
        const liftWallMat = new THREE.MeshStandardMaterial({ map: liftWallTex, roughness: 0.28, metalness: 0.05,
            emissive: 0xCBCDC8, emissiveMap: liftWallTex, emissiveIntensity: 0.16 });
        const wall = new THREE.Mesh(new THREE.PlaneGeometry(WW, WH), liftWallMat);
        wall.position.set(0, WH / 2, WALL_Z);
        scene.add(wall);

        // twin-arm wall luminaire high on the wall
        {
            const grp = new THREE.Group();
            const plate = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.5, 0.06), steelMat);
            plate.position.set(0, 6.35, WALL_Z + 0.04); grp.add(plate);
            const stemG = new THREE.CylinderGeometry(0.03, 0.03, 0.55, 8); stemG.rotateX(Math.PI / 2);
            const stem = new THREE.Mesh(stemG, steelMat);
            stem.position.set(0, 6.35, WALL_Z + 0.32); grp.add(stem);
            const arm = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.05, 0.05), steelMat);
            arm.position.set(0, 6.35, WALL_Z + 0.6); grp.add(arm);
            for (const sx of [-0.8, 0.8]) {
                const head = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.26, 10), steelMat);
                head.position.set(sx, 6.2, WALL_Z + 0.6); grp.add(head);
                const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.02, 10), lensMat);
                lens.position.set(sx, 6.06, WALL_Z + 0.6); grp.add(lens);
            }
            scene.add(grp);
        }
        // steel cylinder totem (fire services cabinet) against the wall centre
        {
            const tot = new THREE.Mesh(new THREE.CylinderGeometry(0.33, 0.33, 2.3, 20), steelMat);
            tot.position.set(0, 1.15, WALL_Z + 0.6);
            scene.add(tot);
            const band = new THREE.Mesh(new THREE.CylinderGeometry(0.335, 0.335, 0.4, 20), darkMetal);
            band.position.set(0, 1.95, WALL_Z + 0.6);
            scene.add(band);
        }
        // low bench against the wall between the lift doors
        {
            const g = new THREE.Group();
            const pl = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.1, 0.5),
                new THREE.MeshStandardMaterial({ color: 0x6E6B66, roughness: 0.7, metalness: 0.15 }));
            pl.position.y = 0.05; g.add(pl);
            const seatMat = new THREE.MeshStandardMaterial({ color: 0x8B9094, roughness: 0.45, metalness: 0.4 });
            for (let i = 0; i < 4; i++) {
                const slat = new THREE.Mesh(new THREE.BoxGeometry(1.75, 0.035, 0.09), seatMat);
                slat.position.set(0, 0.45, -0.17 + i * 0.11);
                g.add(slat);
            }
            g.position.set(-1.1, 0, WALL_Z + 0.55);
            world.part('bench_lift', g);
            scene.add(g);
        }
        // tactile mats at each lift door + the mosaic floor artwork inlay
        for (const sx of [-2.6, 2.6]) {
            const mat = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.9),
                new THREE.MeshStandardMaterial({ color: 0x8f8c86, roughness: 0.85 }));
            mat.rotation.x = -Math.PI / 2;
            mat.position.set(sx, 0.013, WALL_Z + 1.2);
            scene.add(world.ghost(mat));
        }
        {
            const artTex = tex(512, 256, (ctx, w, h) => {
                ctx.clearRect(0, 0, w, h);
                ctx.globalAlpha = 0.8;
                for (let k = 0; k < 3; k++) {                       // three winding mosaic trails
                    let px2 = w * (0.18 + k * 0.1), py2 = h * (0.3 + k * 0.22), ang = 0.3 - k * 0.3;
                    for (let i = 0; i < 46; i++) {
                        ang += (Math.random() - 0.5) * 0.7;
                        px2 += Math.cos(ang) * 13; py2 += Math.sin(ang) * 7;
                        if (px2 < 10 || px2 > w - 10 || py2 < 8 || py2 > h - 8) break;
                        ctx.fillStyle = ['#B0713B', '#8A5A33', '#C9955A', '#6E4A2C'][Math.floor(Math.random() * 4)];
                        ctx.save(); ctx.translate(px2, py2); ctx.rotate(ang);
                        ctx.fillRect(-6, -2, 12, 4); ctx.restore();
                    }
                }
                ctx.globalAlpha = 1;
            });
            const art = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 2.1),
                new THREE.MeshStandardMaterial({ map: artTex, transparent: true, roughness: 0.85 }));
            art.rotation.x = -Math.PI / 2;
            art.position.set(0, 0.014, -100.5);
            scene.add(world.ghost(art));
        }
    }

    /* ============================================================
       9 · signage
       ============================================================ */
    function textSign(w, h, drawFn, opts = {}) {
        const px = Math.round(256 * w / h);
        const t = tex(px, 256, drawFn);
        const face = new THREE.MeshStandardMaterial({
            map: t, roughness: 0.6, metalness: 0.05,
            emissive: opts.glow ? 0xffffff : 0x000000,
            emissiveMap: opts.glow ? t : null,
            emissiveIntensity: opts.glow ? 0.85 : 0 });
        const edge = new THREE.MeshStandardMaterial({ color: opts.edge || 0x222325, roughness: 0.6 });
        const g = new THREE.BoxGeometry(w, h, opts.t || 0.08);
        g.clearGroups();
        g.addGroup(0, 24, 0);      // the four edge faces
        g.addGroup(24, 12, 1);     // front + back
        return new THREE.Mesh(g, [edge, face]);
    }
    function hangRods(group, sign, topY, spread) {
        const g = new THREE.CylinderGeometry(0.016, 0.016, 1, 6);
        const y0 = sign.position.y + 0.3, hgt = topY - y0;
        for (const s of [-1, 1]) {
            const rod = new THREE.Mesh(g, darkMetal);
            rod.scale.y = hgt;
            rod.position.set(sign.position.x + s * spread, y0 + hgt / 2, sign.position.z);
            group.add(rod);
        }
    }
    const mkExit = (title, line2, sub) => (ctx, w, h) => {
        ctx.fillStyle = '#101112'; ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = '#F5C400'; ctx.font = '700 72px Arial'; ctx.textBaseline = 'middle';
        ctx.fillText(title, 40, h * 0.3);
        ctx.fillStyle = '#fff'; ctx.font = '400 46px Arial';
        ctx.fillText(line2, 40, h * 0.62);
        if (sub) {
            ctx.fillStyle = '#2C7BC4'; ctx.fillRect(30, h * 0.78, w - 60, h * 0.18);
            ctx.fillStyle = '#fff'; ctx.font = '500 34px Arial';
            ctx.fillText(sub, 44, h * 0.87);
        }
        ctx.strokeStyle = '#F5C400'; ctx.lineWidth = 9; ctx.lineCap = 'round';
        const ax = w - 84, ay = h * 0.3;
        ctx.beginPath(); ctx.moveTo(ax, ay + 26); ctx.lineTo(ax, ay - 26);
        ctx.moveTo(ax - 20, ay - 6); ctx.lineTo(ax, ay - 28); ctx.lineTo(ax + 20, ay - 6); ctx.stroke();
    };
    const drawPlat1 = (ctx, w, h) => {
        ctx.fillStyle = '#F4F4F1'; ctx.fillRect(0, 0, w, h);
        ctx.textBaseline = 'middle'; ctx.fillStyle = '#2E2E2E'; ctx.font = '500 64px Arial';
        ctx.fillText('Sunbury', 50, h / 2);
        ctx.fillStyle = '#2C7BC4'; ctx.fillRect(w - 320, h * 0.15, 7, h * 0.7);
        ctx.fillStyle = '#2E2E2E'; ctx.font = '600 100px Arial';
        ctx.fillText('1', w - 285, h / 2);
        ctx.font = '500 90px Arial'; ctx.fillText('→', w - 180, h / 2);
    };
    const drawPlat2 = (ctx, w, h) => {
        ctx.fillStyle = '#F4F4F1'; ctx.fillRect(0, 0, w, h);
        ctx.textBaseline = 'middle'; ctx.fillStyle = '#2E2E2E';
        ctx.font = '500 90px Arial'; ctx.fillText('←', 40, h / 2);
        ctx.font = '600 100px Arial'; ctx.fillText('2', 175, h / 2);
        ctx.fillStyle = '#2C7BC4'; ctx.fillRect(275, h * 0.15, 7, h * 0.7);
        ctx.fillStyle = '#2E2E2E'; ctx.font = '500 52px Arial';
        ctx.fillText('Cranbourne', 320, h * 0.34);
        ctx.fillText('or Pakenham', 320, h * 0.68);
    };
    const drawNameFor = (nm, e1, e2) => (ctx, w, h) => {
        ctx.fillStyle = '#F6F6F3'; ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = '#2C7BC4'; ctx.fillRect(0, 0, w, h * 0.06);
        ctx.fillStyle = '#1E1E1E'; ctx.font = '600 64px Arial'; ctx.textBaseline = 'middle';
        ctx.fillText(nm, 40, h * 0.22);
        ctx.fillStyle = '#101112'; ctx.fillRect(0, h * 0.38, w, h * 0.62);
        ctx.fillStyle = '#F5C400'; ctx.font = '600 44px Arial';
        ctx.fillText('← Exit 1', 40, h * 0.52);
        ctx.fillStyle = '#fff'; ctx.font = '400 32px Arial';
        ctx.fillText(e1, 52, h * 0.63);
        ctx.fillStyle = '#2C7BC4'; ctx.fillRect(30, h * 0.7, w - 60, h * 0.11);
        ctx.fillStyle = '#fff'; ctx.font = '500 30px Arial';
        ctx.fillText('M  Melbourne Central Station  210m', 44, h * 0.755);
        ctx.fillStyle = '#F5C400'; ctx.font = '600 40px Arial';
        ctx.fillText('Exit 2 →', w - 260, h * 0.88);
        ctx.fillStyle = '#fff'; ctx.font = '400 30px Arial';
        ctx.fillText(e2, w - 250, h * 0.96 - 6);
    };
    const plate = (num) => (ctx, w, h) => {
        ctx.fillStyle = '#F4F4F1'; ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = '#2E2E2E'; ctx.font = '600 170px Arial'; ctx.textBaseline = 'middle';
        ctx.fillText(num, 55, h / 2 + 8);
        ctx.fillStyle = '#2C7BC4'; ctx.fillRect(w - 72, 30, 12, h - 60);
    };

    let signN = 0;
    function hungSign(w, h, drawFn, x, y, z, topY, spread, opts) {
        const grp = new THREE.Group();
        const s = textSign(w, h, drawFn, opts);
        s.position.set(x, y, z);
        grp.add(s);
        if (topY) hangRods(grp, s, topY, spread);
        world.part(`sign_${String(signN++).padStart(2, '0')}`, grp);
        scene.add(grp);
        return grp;
    }
    // Exit 1 (mid-station) and Exit 2 (end) hanging signs
    hungSign(2.5, 0.8, mkExit('Exit 1', 'Lifts to Swanston St', 'M Melbourne Central Station'), 0, 5.0, -19.5, 9.4, 0.9);
    hungSign(2.5, 0.8, mkExit('Exit 1', 'Lifts to Swanston St', 'M Melbourne Central Station'), 0, 5.0, 19.5, 9.4, 0.9);
    hungSign(2.1, 0.6, mkExit('Exit 2', 'Franklin Street'), -3.0, 5.1, 92, 10.4, 0.7);
    hungSign(2.1, 0.6, mkExit('Exit 2', 'Franklin Street'), 3.0, 5.1, 92, 10.4, 0.7);
    hungSign(2.4, 0.78, mkExit('Exit 1', 'Lifts to Swanston St', 'M Melbourne Central Station  70m'), -3.6, 5.0, -102.6, 9.2, 0.85);
    hungSign(2.4, 0.78, mkExit('Exit 1', 'Lifts to Swanston St', 'M Melbourne Central Station  70m'), 3.6, 5.0, -102.6, 9.2, 0.85);
    // white destination signs over each platform
    for (const [x, z, fn] of [[-8.8, -26, drawPlat2], [8.8, -26, drawPlat1], [-8.8, 30, drawPlat2], [8.8, 30, drawPlat1], [-8.8, -75, drawPlat2], [8.8, -75, drawPlat1], [-8.8, 76, drawPlat2], [8.8, 76, drawPlat1]]) {
        hungSign(2.6, 0.62, fn, x, 4.6, z, 10.4, 0.9, { edge: 0xd9d9d6 });
    }
    // station name signs on the blade columns, facing the platforms
    let nameMat, nameTexSL, nameTexTH, nameTexAN;
    {
        nameTexSL = tex(640, 420, drawNameFor('State Library', 'Swanston St', 'Franklin St'));
        nameTexTH = tex(640, 420, drawNameFor('Town Hall', 'Collins St', 'City Square'));
        nameTexAN = tex(640, 420, drawNameFor('Anzac', 'St Kilda Rd', 'Domain Rd'));
        const t = nameTexSL;
        const m = new THREE.MeshStandardMaterial({ map: t, roughness: 0.55 });
        nameMat = m;
        const g = new THREE.PlaneGeometry(1.5, 0.98);
        for (let z = -HALF + 9; z <= HALF - 6; z += BAY * 3) {
            for (const s of [-1, 1]) {
                const p = new THREE.Mesh(g, m);
                p.position.set(s * (COL_X + 0.45), 3.0, z);
                p.rotation.y = s > 0 ? -Math.PI / 2 : Math.PI / 2;
                roofVault.add(p);
            }
        }
    }
    // platform number plates on Y-brackets at the beams
    {
        const t1 = tex(256, 256, plate('1')), t2 = tex(256, 256, plate('2'));
        const e = new THREE.MeshStandardMaterial({ color: 0xd9d9d6, roughness: 0.6 });
        for (let z = -HALF + 9; z <= HALF - 6; z += BAY * 4) {
            for (const s of [-1, 1]) {
                const m = new THREE.MeshStandardMaterial({ map: s > 0 ? t1 : t2, roughness: 0.6 });
                const p = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.05), [e, e, e, e, m, m]);
                p.position.set(s * (COL_X - 0.2), BEAM_Y - BEAM_H / 2 - 0.45, z + 3);
                roofVault.add(p);
                const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.25, 6), darkMetal);
                stem.position.set(s * (COL_X - 0.2), BEAM_Y - BEAM_H / 2 - 0.12, z + 3);
                roofVault.add(stem);
            }
        }
    }
    // live departure screens under the beams, facing the platforms
    const pids = [];
    {
        const mk = (side, z, idx) => {
            const canvas = document.createElement('canvas');
            canvas.width = 432; canvas.height = 256;
            const t = new THREE.CanvasTexture(canvas);
            t.colorSpace = THREE.SRGBColorSpace;
            const face = new THREE.MeshStandardMaterial({
                map: t, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: 0.85, roughness: 0.6 });
            const edge = new THREE.MeshStandardMaterial({ color: 0x1a1b1c, roughness: 0.6 });
            const bg = new THREE.BoxGeometry(1.3, 0.78, 0.1);
            bg.clearGroups(); bg.addGroup(0, 24, 0); bg.addGroup(24, 12, 1);
            const s = new THREE.Mesh(bg, [edge, face]);
            s.position.set(side * (COL_X + 0.35), 3.85, z);
            s.rotation.y = side > 0 ? -Math.PI / 2 : Math.PI / 2;
            s.rotation.z = side > 0 ? -0.08 : 0.08;
            const grp = new THREE.Group(); grp.add(s);
            world.part(`screen_pid_${idx}`, grp);
            roofVault.add(grp);
            pids.push({ canvas, t, side, z, offset: idx * 2 });
        };
        mk(1, -104, 0); mk(-1, -30, 1); mk(1, 26, 2); mk(-1, 104, 3);
    }
    function drawPIDNow(p, tSec) {
        const ctx = p.canvas.getContext('2d'), w = p.canvas.width, h = p.canvas.height;
        const lead = p.side > 0 ? 'Sunbury' : 'Cranbourne';
        const alts = p.side > 0 ? ['Watergardens', 'Sunbury'] : ['Pakenham', 'East Pakenham'];
        const min0 = ((3 + p.offset - Math.floor(tSec / 45)) % 15 + 15) % 15;
        ctx.fillStyle = '#F2F4F6'; ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = '#123A63'; ctx.fillRect(0, 0, w, 58);
        ctx.fillStyle = '#fff'; ctx.font = '600 34px Arial'; ctx.textBaseline = 'middle';
        ctx.fillText(`6:0${(p.offset + 8) % 10}pm  ${lead}`, 16, 29);
        ctx.fillStyle = '#0F2338'; ctx.fillRect(w - 118, 8, 104, 42);
        ctx.fillStyle = '#FFD34D'; ctx.font = '600 30px Arial';
        ctx.fillText(min0 === 0 ? 'Now' : `${min0} min`, w - 104, 29);
        ctx.fillStyle = '#4A5560'; ctx.font = '400 22px Arial';
        ctx.fillText('Express via Metro Tunnel', 16, 78);
        ctx.strokeStyle = '#2C7BC4'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(26, 100); ctx.lineTo(26, h - 40); ctx.stroke();
        ctx.fillStyle = '#2E3338'; ctx.font = '400 24px Arial';
        const stops = ['State Library', 'Town Hall', 'Anzac', 'Caulfield', alts[0], alts[1]];
        for (let i = 0; i < stops.length; i++) {
            ctx.beginPath(); ctx.arc(26, 112 + i * 22, 4, 0, 7);
            ctx.fillStyle = i === 0 ? '#2C7BC4' : '#8A949C'; ctx.fill();
            ctx.fillStyle = '#2E3338'; ctx.fillText(stops[i], 44, 112 + i * 22);
        }
        p.t.needsUpdate = true;
    }
    pids.forEach(p => drawPIDNow(p, 0));

    /* ============================================================
       10 · benches
       ============================================================ */
    const benchFrame = new THREE.MeshStandardMaterial({ color: 0x8B9094, roughness: 0.45, metalness: 0.4 });
    const benchPlinthMat = new THREE.MeshStandardMaterial({ color: 0x6E6B66, roughness: 0.7, metalness: 0.15 });
    let benchN = 0;
    function bench(x, z, ry) {
        const g = new THREE.Group();
        const plinth = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.1, 0.85), benchPlinthMat);
        plinth.position.y = 0.05; g.add(plinth);
        const items = [];
        for (const [yy, zz] of [[0.62, 0], [0.78, 0.01], [0.94, 0.02]]) {
            items.push({ geo: new THREE.BoxGeometry(2.55, 0.07, 0.04), m: M(0, yy, zz) });
        }
        for (const sx of [-1.2, 0, 1.2]) {
            items.push({ geo: new THREE.BoxGeometry(0.05, 0.55, 0.05), m: M(sx, 0.72, 0) });
        }
        for (const s2 of [-1, 1]) for (let i = 0; i < 4; i++) {
            items.push({ geo: new THREE.BoxGeometry(2.55, 0.035, 0.09), m: M(0, 0.46, s2 * (0.1 + i * 0.1)) });
        }
        g.add(new THREE.Mesh(mergeGeos(items), benchFrame));
        g.position.set(x, 0, z);
        if (ry) g.rotation.y = ry;
        world.part(`bench_${String(benchN).padStart(2, '0')}`, g); benchN++;
        scene.add(g);
    }
    bench(0, -88); bench(0, -70); bench(-2.2, -20); bench(2.2, 10); bench(0, 58); bench(2.2, 84);

    /* ============================================================
       10b · track cavities + HCMTs passing through
       ============================================================ */
    const TL = 940;                      // tunnel length either side of centre
    for (const s2 of [-1, 1]) {
        const slab = new THREE.Mesh(new THREE.BoxGeometry(4.8, 0.3, TL),
            new THREE.MeshStandardMaterial({ color: 0x232426, roughness: 0.95 }));
        slab.position.set(s2 * 13.15, -1.2, 0);
        scene.add(slab);
        const railMat = new THREE.MeshStandardMaterial({ color: 0x8A8D8F, roughness: 0.35, metalness: 0.7 });
        for (const rr of [-0.72, 0.72]) {
            const rail = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.17, TL), railMat);
            rail.position.set(s2 * 13.15 + rr, -0.915, 0);
            scene.add(rail);
        }
        const wallT = new THREE.Mesh(new THREE.BoxGeometry(0.3, 7.2, LEN + 4),
            new THREE.MeshStandardMaterial({ color: 0x121314, roughness: 0.95 }));
        wallT.position.set(s2 * 15.6, 2.2, 0);
        scene.add(wallT);
        const soffit = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.2, LEN + 4),
            new THREE.MeshStandardMaterial({ color: 0x0C0D0E, roughness: 0.95 }));
        soffit.position.set(s2 * 13.6, 5.15, 0);
        scene.add(soffit);
        const edge = new THREE.Mesh(new THREE.BoxGeometry(0.28, 1.35, LEN),
            new THREE.MeshStandardMaterial({ color: 0x3A3A3C, roughness: 0.85 }));
        edge.position.set(s2 * 11.52, -0.62, 0);
        scene.add(edge);
        for (const lz of (s2 > 0 ? [8, 36, 62] : [-8, -36, -62])) {   // light the dwell zone
            const cl = new THREE.PointLight(0xEDE9DF, 70, 15, 2);
            cl.position.set(s2 * 12.45, 3.1, lz);
            scene.add(cl);
        }
    }
    {   // TBM running tunnels beyond the cavern (segmented rings, trays, catwalk, lights)
        const ringTex = tex(256, 512, (ctx, w, h) => {
            ctx.fillStyle = '#B9B7B2'; ctx.fillRect(0, 0, w, h);
            for (let i = 0; i < 1400; i++) {
                ctx.fillStyle = `rgba(${Math.random() < 0.5 ? '138,136,130' : '205,203,197'},${Math.random() * 0.15})`;
                ctx.fillRect(Math.random() * w, Math.random() * h, 1.6, 1.6);
            }
            ctx.strokeStyle = 'rgba(90,88,84,0.55)'; ctx.lineWidth = 4;
            for (let y = 0; y <= h; y += 128) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
            ctx.lineWidth = 2.5;
            for (let y = 0; y < h; y += 128) {
                const off = (y / 128) % 2 ? 64 : 0;
                for (let x = off; x <= w; x += 128) {
                    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + 128); ctx.stroke();
                }
            }
        }, 5, 1);
        const tubeMat = new THREE.MeshStandardMaterial({ map: ringTex, roughness: 0.92, side: THREE.BackSide });
        const trayMat = new THREE.MeshStandardMaterial({ color: 0x8E9194, roughness: 0.5, metalness: 0.5 });
        const walkMat = new THREE.MeshStandardMaterial({ color: 0xA9A7A0, roughness: 0.8 });
        const tubeLight = new THREE.MeshStandardMaterial({ color: 0x888888, emissive: 0xE8EDEE, emissiveIntensity: 1.6 });
        for (const s2 of [-1, 1]) {
            const xc = s2 * 13.15;
            for (const [z0, z1] of [[HALF, 470], [-470, -HALF]]) {
                const len = z1 - z0, zc = (z0 + z1) / 2;
                const cg = new THREE.CylinderGeometry(3.45, 3.45, len, 20, 1, true);
                cg.rotateX(Math.PI / 2);
                const tube = new THREE.Mesh(cg, tubeMat);
                const rt = ringTex.clone(); rt.needsUpdate = true; rt.repeat.set(5, Math.abs(len) / 1.75);
                tube.material = tubeMat.clone(); tube.material.map = rt;
                tube.position.set(xc, 2.0, zc);
                scene.add(tube);
                const items = [];
                items.push({ geo: new THREE.BoxGeometry(0.4, 0.12, Math.abs(len)), m: M(xc - s2 * 3.05, 3.3, zc) });
                items.push({ geo: new THREE.BoxGeometry(0.35, 0.1, Math.abs(len)), m: M(xc - s2 * 3.2, 2.2, zc) });
                scene.add(new THREE.Mesh(mergeGeos(items), trayMat));
                const walk = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.1, Math.abs(len)), walkMat);
                walk.position.set(xc + s2 * 2.35, -0.55, zc);
                scene.add(walk);
                const rail = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, Math.abs(len)), trayMat);
                rail.position.set(xc + s2 * 2.85, 0.45, zc);
                scene.add(rail);
                const dots = [];
                const dotG = new THREE.BoxGeometry(0.5, 0.07, 0.14);
                for (let z = z0 + 8 * Math.sign(len); Math.abs(z - z0) < Math.abs(len); z += 16 * Math.sign(len)) {
                    dots.push({ geo: dotG, m: M(xc - s2 * 2.6, 4.6, z, 0, 0, s2 * 0.5) });
                }
                scene.add(new THREE.Mesh(mergeGeos(dots), tubeLight));
            }
        }
    }
    const trains = [];
    let heroTrain;
    {
        heroTrain = buildHCMT(THREE, (w, h, fn) => world.canvasTexture(w, h, fn));
        heroTrain.position.set(13.15, -0.83, -260);
        scene.add(world.ground(heroTrain));   // solid: you can stand inside it
        // a little light aboard so the ride isn't pitch black in the tunnel
        for (const lz of [20, 45]) {
            const cab = new THREE.PointLight(0xF2EFE6, 14, 12, 2);
            cab.position.set(13.15, 2.4, lz);
            heroTrain.userData.keepLit = true;
            scene.add(cab);
            cab.userData.followTrain = lz - 35.5;   // offset from stop point
            trains.push({ light: cab });
        }
    }

    /* ============================================================
       11 · end walls
       ============================================================ */
    {
        // concourse end walls (the lift wall handles most of the -z end)
        for (const s2 of [-1, 1]) {
            const wall = new THREE.Mesh(new THREE.BoxGeometry(11.8, 14.5, 0.6), concreteMat);
            wall.position.set(0, 6.5, s2 * (HALF + 0.3));
            scene.add(wall);
        }
        // fire-door texture for the platform end walls
        const fireDoorTex = tex(384, 480, (ctx, w, h) => {
            ctx.fillStyle = '#9A9DA0'; ctx.fillRect(0, 0, w, h);
            ctx.strokeStyle = '#6E7174'; ctx.lineWidth = 8;
            ctx.strokeRect(6, 6, w - 12, h - 12);
            ctx.beginPath(); ctx.moveTo(w / 2, 10); ctx.lineTo(w / 2, h - 10); ctx.stroke();
            ctx.fillStyle = '#7E8184';                                  // push bars + kick plates
            ctx.fillRect(30, h * 0.52, w / 2 - 45, 14); ctx.fillRect(w / 2 + 15, h * 0.52, w / 2 - 45, 14);
            ctx.fillStyle = '#8A8D90'; ctx.fillRect(14, h - 70, w - 28, 56);
            ctx.fillStyle = '#F5C400'; ctx.fillRect(w * 0.1, h * 0.16, w * 0.34, h * 0.11);   // alarm warning
            ctx.fillStyle = '#111'; ctx.font = '600 15px Arial';
            ctx.fillText('WARNING', w * 0.13, h * 0.21);
            ctx.fillText('DOOR ALARMED', w * 0.11, h * 0.245);
            ctx.fillStyle = '#EDEEEA'; ctx.fillRect(w * 0.56, h * 0.15, w * 0.32, h * 0.14);  // notice sheets
            ctx.fillStyle = '#2E7D46'; ctx.fillRect(w * 0.56, h * 0.33, w * 0.2, h * 0.06);
        });
        const fireDoorMat = new THREE.MeshStandardMaterial({ map: fireDoorTex, roughness: 0.6, metalness: 0.2 });
        const exitMat = new THREE.MeshStandardMaterial({ color: 0x2AA05A, emissive: 0x2AE07A, emissiveIntensity: 0.9 });
        const staffTex = tex(256, 96, (ctx, w, h) => {
            ctx.fillStyle = '#F2F2EF'; ctx.fillRect(0, 0, w, h);
            ctx.fillStyle = '#333'; ctx.font = '600 22px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText('Authorised staff only', w / 2, h / 2);
        });
        const staffMat = new THREE.MeshBasicMaterial({ map: staffTex });
        const endGlass = new THREE.MeshStandardMaterial({ color: 0x8FA0A8, roughness: 0.08, metalness: 0.4,
            transparent: true, opacity: 0.35 });
        const endBand = new THREE.MeshStandardMaterial({ color: 0x141517, roughness: 0.5, metalness: 0.4 });
        const psSteel2 = new THREE.MeshStandardMaterial({ color: 0xC9CCCE, roughness: 0.3, metalness: 0.6 });
        const gridTex = tex(256, 256, (ctx, w, h) => {
            ctx.fillStyle = '#0E1013'; ctx.fillRect(0, 0, w, h);
            const g = ctx.createLinearGradient(0, 0, w, h);
            g.addColorStop(0, 'rgba(70,76,82,0.18)'); g.addColorStop(0.5, 'rgba(20,22,24,0)'); g.addColorStop(1, 'rgba(60,66,72,0.12)');
            ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
            ctx.strokeStyle = '#2A2D31'; ctx.lineWidth = 4;
            for (let i = 0; i <= 4; i++) {
                ctx.beginPath(); ctx.moveTo(i * w / 4, 0); ctx.lineTo(i * w / 4, h); ctx.stroke();
                ctx.beginPath(); ctx.moveTo(0, i * h / 4); ctx.lineTo(w, i * h / 4); ctx.stroke();
            }
        }, 1.5, 1.6);
        const darkWallMat = new THREE.MeshStandardMaterial({ map: gridTex, roughness: 0.16, metalness: 0.55 });
        const redSignMat = new THREE.MeshStandardMaterial({ color: 0xB02020, emissive: 0x701010, emissiveIntensity: 0.5 });
        // clear corner glazing — the tunnel is meant to read through it
        const cornerGlass = new THREE.MeshStandardMaterial({
            color: 0xAFC0C8, roughness: 0.04, metalness: 0.35,
            transparent: true, opacity: 0.17, depthWrite: false });
        const portalMat = new THREE.MeshStandardMaterial({ color: 0x17181A, roughness: 0.95 });
        const signalMat = new THREE.MeshStandardMaterial({ color: 0x400808, emissive: 0xD82020, emissiveIntensity: 2.2 });

        function platformEnd(zs, xs) {
            const zw = zs * (HALF - 0.35);          // end wall plane
            const faceRot = zs > 0 ? Math.PI : 0;   // face back down the platform
            const inner = 5.65, glassStart = 8.7;   // wall runs from the beam line to the corner
            const wallW = glassStart - inner, wallCx = xs * (inner + wallW / 2);
            const glassW = 11.7 - glassStart, glassCx = xs * (glassStart + glassW / 2);

            // --- lower solid wall with the fire door ---
            const wall = new THREE.Mesh(new THREE.BoxGeometry(wallW, 3.15, 0.45), concreteMat);
            wall.position.set(wallCx, 1.575, zw); scene.add(wall);
            const door = new THREE.Mesh(new THREE.PlaneGeometry(2.05, 2.3), fireDoorMat);
            door.rotation.y = faceRot;
            door.position.set(wallCx, 1.16, zw - zs * 0.25); scene.add(door);
            const ex = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.24, 0.08), exitMat);
            ex.position.set(wallCx, 3.42, zw - zs * 0.26); scene.add(ex);

            // --- corner glazing: end plane + return along the PSD line ---
            const gEnd = new THREE.Mesh(new THREE.PlaneGeometry(glassW, 3.15), cornerGlass);
            gEnd.rotation.y = faceRot;
            gEnd.position.set(glassCx, 1.575, zw - zs * 0.2); scene.add(gEnd);
            const retLen = 2.4;
            const gRet = new THREE.Mesh(new THREE.PlaneGeometry(retLen, 3.15), cornerGlass);
            gRet.rotation.y = xs > 0 ? -Math.PI / 2 : Math.PI / 2;
            gRet.position.set(xs * PSD_X, 1.575, zw - zs * retLen / 2); scene.add(gRet);

            // black frames around both panes
            const fr = [];
            const vG = new THREE.BoxGeometry(0.09, 3.15, 0.09);
            for (const px of [glassStart, glassStart + glassW / 2, 11.66]) {
                fr.push({ geo: vG, m: M(xs * px, 1.575, zw - zs * 0.2) });
            }
            fr.push({ geo: new THREE.BoxGeometry(glassW, 0.1, 0.12), m: M(glassCx, 3.12, zw - zs * 0.2) });
            fr.push({ geo: new THREE.BoxGeometry(glassW, 0.07, 0.1), m: M(glassCx, 1.42, zw - zs * 0.2) });
            const vG2 = new THREE.BoxGeometry(0.09, 3.15, 0.09);
            for (const pz of [0.25, retLen - 0.1]) fr.push({ geo: vG2, m: M(xs * PSD_X, 1.575, zw - zs * pz) });
            fr.push({ geo: new THREE.BoxGeometry(0.12, 0.1, retLen), m: M(xs * PSD_X, 3.12, zw - zs * retLen / 2) });
            fr.push({ geo: new THREE.BoxGeometry(0.1, 0.07, retLen), m: M(xs * PSD_X, 1.42, zw - zs * retLen / 2) });
            scene.add(new THREE.Mesh(mergeGeos(fr), blackMat));

            const staff = new THREE.Mesh(new THREE.PlaneGeometry(0.85, 0.28), staffMat);
            staff.rotation.y = faceRot;
            staff.position.set(glassCx, 2.05, zw - zs * 0.27); scene.add(staff);

            // --- dark glazed wall filling everything above ---
            const upW = 11.7 - inner;
            const upper = new THREE.Mesh(new THREE.BoxGeometry(upW, 6.5, 0.3), darkWallMat);
            upper.position.set(xs * (inner + upW / 2), 6.4, zw); scene.add(upper);
            const red = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.3, 0.06), redSignMat);
            red.position.set(xs * 9.0, 4.4, zw - zs * 0.2); scene.add(red);

            // --- what you actually see through the glass: tunnel portal + signal ---
            const jamb = new THREE.Mesh(new THREE.BoxGeometry(1.5, 5.6, 7), portalMat);
            jamb.position.set(xs * 9.1, 2.2, zs * (HALF + 3.4)); scene.add(jamb);
            const lintel = new THREE.Mesh(new THREE.BoxGeometry(4.6, 1.4, 7), portalMat);
            lintel.position.set(xs * 11.5, 5.2, zs * (HALF + 3.4)); scene.add(lintel);
            const sig = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.22, 0.1), signalMat);
            sig.position.set(xs * 10.4, 3.1, zs * (HALF + 5)); scene.add(sig);
            const glow = new THREE.PointLight(0xE08A46, 30, 19, 2);
            glow.position.set(xs * 12.6, 2.4, zs * (HALF + 8)); scene.add(glow);

            // tactile strip before the end
            const tact = new THREE.Mesh(new THREE.PlaneGeometry(5.9, 0.5),
                new THREE.MeshStandardMaterial({ color: 0x8f8c86, roughness: 0.85 }));
            tact.rotation.x = -Math.PI / 2;
            tact.position.set(xs * (inner + upW / 2), 0.014, zw - zs * 2.3);
            scene.add(world.ghost(tact));
        }
        for (const zs of [-1, 1]) for (const xs of [-1, 1]) platformEnd(zs, xs);
    }

    /* ============================================================
       11b · Exit 2 escalator bank (State Library / Town Hall only)
             Four lanes of real moving steps, a solid clad mass beneath,
             and the Information / Help Point box on the far side.
       ============================================================ */
    const escBanks = [];
    {
        const ZB = 7.0, H = 5.2, RUN = 9.0;          // bottom z, rise, horizontal run
        const ZT = ZB - RUN;                          // top of the incline
        const A = Math.atan2(H, RUN);                 // 30 degrees
        const SLOPE = Math.sqrt(RUN * RUN + H * H);
        const LANES = 4, LW = 1.02, LG = 0.07;
        const TOT = LANES * LW + (LANES - 1) * LG;
        const laneX = [];
        for (let i = 0; i < LANES; i++) laneX.push(-TOT / 2 + LW / 2 + i * (LW + LG));

        const cladMat2 = new THREE.MeshStandardMaterial({ color: 0x8E8983, roughness: 0.2, metalness: 0.78 });
        const steelBright = new THREE.MeshStandardMaterial({ color: 0xC9CCCE, roughness: 0.3, metalness: 0.6 });
        const escGlass = new THREE.MeshStandardMaterial({ color: 0xBFC8CC, roughness: 0.05, metalness: 0.2,
            transparent: true, opacity: 0.22, depthWrite: false });
        const combMat = new THREE.MeshStandardMaterial({ color: 0xC8A93C, roughness: 0.5, metalness: 0.4 });

        // --- moving steps: one InstancedMesh for every lane and tread ---
        const treadTex = tex(64, 64, (ctx, w, h) => {
            ctx.fillStyle = '#9DA0A2'; ctx.fillRect(0, 0, w, h);
            for (let x = 2; x < w; x += 5) { ctx.fillStyle = '#8A8D8F'; ctx.fillRect(x, 0, 2, h); }
            ctx.fillStyle = '#D8B43A'; ctx.fillRect(0, h - 7, w, 7);
        });
        const riserTex = tex(64, 64, (ctx, w, h) => {
            ctx.fillStyle = '#6E7173'; ctx.fillRect(0, 0, w, h);
            for (let x = 2; x < w; x += 5) { ctx.fillStyle = '#5C5F61'; ctx.fillRect(x, 0, 2, h); }
        });
        const sideM = new THREE.MeshStandardMaterial({ color: 0x8A8D8F, roughness: 0.45, metalness: 0.45 });
        const treadM = new THREE.MeshStandardMaterial({ map: treadTex, roughness: 0.55, metalness: 0.35 });
        const riserM = new THREE.MeshStandardMaterial({ map: riserTex, roughness: 0.6, metalness: 0.35 });
        const P = 0.40;                               // horizontal advance per step
        const perLane = Math.ceil(RUN / P) + 1;
        const stepGeo = new THREE.BoxGeometry(LW, 0.26, P);
        const steps = new THREE.InstancedMesh(stepGeo,
            [sideM, sideM, treadM, sideM, riserM, sideM], LANES * perLane);
        steps.frustumCulled = false;
        roofVault.add(steps);
        escBanks.push({ mesh: steps, laneX, perLane, P, RUN, ZB, H,
                        tanA: Math.tan(A), dummy: new THREE.Object3D(), off: 0 });

        // --- balustrades, handrails, LED strips, skirts ---
        const zc = (ZB + ZT) / 2, yc = H / 2;
        for (const bx of [-TOT / 2 - 0.16, TOT / 2 + 0.16]) {
            const bal = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.0, SLOPE * 0.99), escGlass);
            bal.position.set(bx, yc + 0.76, zc); bal.rotation.x = A;
            roofVault.add(bal);
            const hr = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.09, SLOPE), blackMat);
            hr.position.set(bx, yc + 1.3, zc); hr.rotation.x = A;
            roofVault.add(hr);
            for (const o of [-0.05, 0.05]) {
                const led = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, SLOPE * 0.98), ledMat);
                led.position.set(bx + o, yc + 1.12, zc); led.rotation.x = A;
                roofVault.add(led);
            }
            const skirt = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.75, SLOPE * 0.99), steelBright);
            skirt.position.set(bx, yc + 0.12, zc); skirt.rotation.x = A;
            roofVault.add(skirt);
        }
        // inner lane dividers
        for (let i = 1; i < LANES; i++) {
            const dx = laneX[i] - (LW + LG) / 2;
            const bal = new THREE.Mesh(new THREE.BoxGeometry(0.05, 1.0, SLOPE * 0.99), escGlass);
            bal.position.set(dx, yc + 0.76, zc); bal.rotation.x = A; roofVault.add(bal);
            const hr = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.09, SLOPE), blackMat);
            hr.position.set(dx, yc + 1.3, zc); hr.rotation.x = A; roofVault.add(hr);
            const deck = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.06, SLOPE), steelBright);
            deck.position.set(dx, yc + 0.2, zc); deck.rotation.x = A; roofVault.add(deck);
        }
        // comb plates and landings, which also hide the step wrap-around
        const combB = new THREE.Mesh(new THREE.BoxGeometry(TOT, 0.07, 1.5), combMat);
        combB.position.set(0, 0.035, ZB + 0.7); roofVault.add(combB);
        const combT = new THREE.Mesh(new THREE.BoxGeometry(TOT, 0.07, 1.5), combMat);
        combT.position.set(0, H + 0.035, ZT - 0.7); roofVault.add(combT);
        const plateB = new THREE.Mesh(new THREE.BoxGeometry(TOT + 0.9, 0.06, 2.2), steelBright);
        plateB.position.set(0, 0.03, ZB + 2.2); roofVault.add(world.ground(plateB));

        // --- the solid clad mass under the escalator ---
        // Its top edge follows the step line exactly, so nothing pokes through;
        // the underside slopes down and meets the floor ahead of the bottom comb.
        {
            const tanA = Math.tan(A);
            const yStep = (z) => (ZB - z) * tanA;
            const TH = 1.3;                                   // truss depth
            const zFront = ZB + 0.9, zBack = ZT - 0.9;
            const zToe = ZB - TH / tanA;                      // where the underside meets the floor
            const prof = new THREE.Shape();
            prof.moveTo(zFront, yStep(zFront));
            prof.lineTo(zBack, yStep(zBack));
            prof.lineTo(zBack, yStep(zBack) - TH);
            prof.lineTo(zToe, 0);
            prof.lineTo(zFront, yStep(zFront) - 0.05);
            prof.closePath();
            const g = new THREE.ExtrudeGeometry(prof, { depth: TOT + 0.95, bevelEnabled: false });
            g.rotateY(-Math.PI / 2); g.translate((TOT + 0.95) / 2, 0, 0);
            const soff = new THREE.Mesh(g, cladMat2);
            roofVault.add(soff);                              // its own side faces are the clad walls
        }

        // --- upper landing slab, and the Information box beneath its far side ---
        const slab = new THREE.Mesh(new THREE.BoxGeometry(TOT + 1.2, 0.34, 8.4), concreteMat);
        slab.position.set(0, H - 0.17, ZT - 1.5 - 4.2);
        roofVault.add(world.ground(slab));
        {
            const panelTex2 = tex(256, 256, (ctx, w, h) => {
                ctx.fillStyle = '#CFD1D0'; ctx.fillRect(0, 0, w, h);
                ctx.strokeStyle = 'rgba(90,92,92,0.55)'; ctx.lineWidth = 3;
                for (let i = 0; i <= 4; i++) {
                    ctx.beginPath(); ctx.moveTo(i * w / 4, 0); ctx.lineTo(i * w / 4, h); ctx.stroke();
                    ctx.beginPath(); ctx.moveTo(0, i * h / 4); ctx.lineTo(w, i * h / 4); ctx.stroke();
                }
            }, 3, 4);
            const ceil2 = new THREE.Mesh(new THREE.PlaneGeometry(TOT + 1.2, 8.4),
                new THREE.MeshStandardMaterial({ map: panelTex2, roughness: 0.6, metalness: 0.15 }));
            ceil2.rotation.x = Math.PI / 2;
            ceil2.position.set(0, H - 0.38, ZT - 1.5 - 4.2);
            roofVault.add(ceil2);

            const infoTex2 = tex(1024, 640, (ctx, w, h) => {
                ctx.fillStyle = '#F0F1EE'; ctx.fillRect(0, 0, w, h);
                const g2 = ctx.createLinearGradient(0, 0, 0, h);
                g2.addColorStop(0, 'rgba(255,255,255,0.5)'); g2.addColorStop(1, 'rgba(200,203,200,0.3)');
                ctx.fillStyle = g2; ctx.fillRect(0, 0, w, h);
                ctx.strokeStyle = '#17181A'; ctx.lineWidth = 7;
                for (const x of [0, 0.28, 0.5, 0.72, 1]) { ctx.beginPath(); ctx.moveTo(x * w, 0); ctx.lineTo(x * w, h); ctx.stroke(); }
                for (const y of [0, 0.26, 0.42, 0.78, 1]) { ctx.beginPath(); ctx.moveTo(0, y * h); ctx.lineTo(w, y * h); ctx.stroke(); }
                ctx.fillStyle = '#2A2F49'; ctx.fillRect(w * 0.28, h * 0.26, w * 0.44, h * 0.16);
                ctx.fillStyle = '#fff'; ctx.font = '600 32px Arial'; ctx.textBaseline = 'middle';
                ctx.fillText('i  Information', w * 0.30, h * 0.34);
                ctx.fillText('Help Point', w * 0.55, h * 0.34);
                ctx.fillStyle = '#DCE8F2'; ctx.fillRect(w * 0.30, h * 0.5, w * 0.16, h * 0.24);
                ctx.fillStyle = '#C8DCE8'; ctx.fillRect(w * 0.475, h * 0.5, w * 0.03, h * 0.24);
                ctx.fillStyle = '#9EA3A7'; ctx.fillRect(w * 0.53, h * 0.5, w * 0.1, h * 0.26);
                ctx.fillStyle = '#1D3E6E'; ctx.fillRect(w * 0.545, h * 0.54, w * 0.07, h * 0.07);
            });
            const infoFace = new THREE.MeshStandardMaterial({ map: infoTex2, roughness: 0.35,
                emissive: 0xBFC2BD, emissiveMap: infoTex2, emissiveIntensity: 0.3 });
            const infoSide = new THREE.MeshStandardMaterial({ color: 0xE7E8E4, roughness: 0.35,
                emissive: 0xA8ABA6, emissiveIntensity: 0.22 });
            const box = new THREE.Mesh(new THREE.BoxGeometry(4.6, 3.4, 3.6),
                [infoSide, infoSide, infoSide, infoSide, infoSide, infoFace]);
            box.position.set(0, 1.7, ZT - 8.6);
            roofVault.add(box);
            const bl = new THREE.PointLight(0xF2F0E6, 20, 12, 2);
            bl.position.set(0, 3.4, ZT - 10.6); roofVault.add(bl);
        }

        // --- Exit 2 signs flanking the escalator, and its lighting ---
        hungSign(2.2, 0.62, mkExit('Exit 2', 'Franklin Street'), -3.4, 4.35, ZB + 1.0, 8.6, 0.7);
        hungSign(2.2, 0.62, mkExit('Exit 2', 'Franklin Street'), 3.4, 4.35, ZB + 1.0, 8.6, 0.7);
        for (const [ez, ei] of [[ZB + 1.5, 16], [zc, 18], [ZT - 2.5, 16]]) {
            const el = new THREE.PointLight(0xFFF0DA, ei, 15, 2);
            el.position.set(0, 6.8, ez); roofVault.add(el);
        }
    }

    /* ============================================================
       12 · light
       ============================================================ */
    try {   // small PMREM environment: grey cavern + warm lantern band, so metals reflect
        const pmrem = new THREE.PMREMGenerator(world.renderer);
        const envScene = new THREE.Scene();
        const envTex = tex(4, 64, (ctx, w, h) => {
            const g = ctx.createLinearGradient(0, 0, 0, h);
            g.addColorStop(0, '#B7B4AE'); g.addColorStop(0.45, '#8E8B85');
            g.addColorStop(0.75, '#6F6C66'); g.addColorStop(1, '#55524D');
            ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
        });
        const dome = new THREE.Mesh(new THREE.SphereGeometry(50, 16, 12),
            new THREE.MeshBasicMaterial({ map: envTex, side: THREE.BackSide }));
        envScene.add(dome);
        const warm = new THREE.Mesh(new THREE.BoxGeometry(40, 1.5, 3),
            new THREE.MeshBasicMaterial({ color: 0xFFE3B4 }));
        warm.position.set(0, 14, 0);
        envScene.add(warm);
        for (const sx of [-12, 12]) {
            const cool = new THREE.Mesh(new THREE.BoxGeometry(2, 5, 30),
                new THREE.MeshBasicMaterial({ color: 0xB9BEC1 }));
            cool.position.set(sx, 6, 0);
            envScene.add(cool);
        }
        scene.environment = pmrem.fromScene(envScene, 0.03).texture;
        if ('environmentIntensity' in scene) scene.environmentIntensity = 0.65;
        pmrem.dispose();
    } catch (e) { /* environment is a nicety — carry on without it */ }

    scene.fog = new THREE.Fog(0x7b7a76, 52, 165);
    scene.add(new THREE.HemisphereLight(0xE9EAEB, 0x7A7876, 0.52));
    for (let bi = 0; bi * BAY < LEN - 4; bi += 6) {         // lantern pools
        const zc = -HALF + 1 + bi * BAY + BAY / 2;
        if (zc > HALF - 2) break;
        if (zc < -103.5) continue;
        if (zc > -6 && zc < 10) continue;
        const pl = new THREE.PointLight(0xFFDFAE, 40, 16, 2);
        pl.position.set(0, 6.9, zc);
        roofVault.add(pl);
    }
    for (const [z, i] of [[-70, 95], [0, 95], [70, 95]]) {           // concourse fill
        const fill = new THREE.PointLight(0xFFF0DC, i, 52, 2);
        fill.position.set(0, 8.0, z);
        scene.add(fill);
    }
    {   // orange platform cone glow, alternating sides
        let flip = 1;
        for (let z = -84; z <= 96; z += 56) {
            const o = new THREE.PointLight(0xFF9F45, 16, 10, 2);
            o.position.set(flip * 8.55, 6.9, z);
            roofVault.add(o);
            flip = -flip;
        }
    }
    const midLight = new THREE.PointLight(0xFFEFD8, 60, 26, 2);
    midLight.position.set(0, 7.5, -40);
    scene.add(midLight);
    for (const s2 of [-1, 1]) for (let z = -42; z <= 46; z += 22) {
        const wl = new THREE.PointLight(0xF5EEDD, 9, 8, 2);   // platform washes
        wl.position.set(s2 * 6.9, 4.3, z);
        scene.add(wl);
    }
    const endLight = new THREE.PointLight(0xFFF0DC, 60, 30, 2);
    endLight.position.set(0, 8.0, 102);
    scene.add(endLight);
    const liftHigh = new THREE.PointLight(0xF3EEE2, 20, 16, 2);
    liftHigh.position.set(0, 7.8, -101.3);
    scene.add(liftHigh);

    /* ============================================================
       12b · the Anzac roof — flat soffit, crossing orange ribbon
             beams, gold-drum domes with a glowing rim
       ============================================================ */
    const roofAnzac = new THREE.Group();
    roofAnzac.visible = false;
    scene.add(roofAnzac);
    {
        const CEIL = 7.8;
        const ribTex = tex(128, 128, (ctx, w, h) => {
            ctx.fillStyle = '#2B2C2E'; ctx.fillRect(0, 0, w, h);
            for (let x = 0; x < w; x += 8) { ctx.fillStyle = '#161719'; ctx.fillRect(x, 0, 4, h); }
        }, 70, 2);
        const beamTex = tex(64, 128, (ctx, w, h) => {
            ctx.fillStyle = '#C4491C'; ctx.fillRect(0, 0, w, h);
            for (let x = 0; x < w; x += 6) {
                ctx.fillStyle = 'rgba(255,255,255,0.10)'; ctx.fillRect(x, 0, 3, h);
                ctx.fillStyle = 'rgba(0,0,0,0.14)'; ctx.fillRect(x + 3, 0, 3, h);
            }
        }, 1, 26);
        const slabMat = new THREE.MeshStandardMaterial({ color: 0x5B5C60, roughness: 0.92 });
        const soffitMat = new THREE.MeshStandardMaterial({ map: ribTex, roughness: 0.85 });
        const beamMat = new THREE.MeshStandardMaterial({ map: beamTex, roughness: 0.62 });
        const goldMat = new THREE.MeshStandardMaterial({ color: 0xB2842F, roughness: 0.45, metalness: 0.45,
            side: THREE.DoubleSide });
        const rimMat = new THREE.MeshStandardMaterial({ color: 0xF0EADA, emissive: 0xFFF6E4, emissiveIntensity: 2.6 });
        const domeMat = new THREE.MeshStandardMaterial({ color: 0xF4F5F7, emissive: 0xD8DEE6,
            emissiveIntensity: 0.75, side: THREE.DoubleSide });
        const ribMat2 = new THREE.MeshStandardMaterial({ color: 0xDDE0E4, roughness: 0.5 });
        const potMat = new THREE.MeshStandardMaterial({ color: 0xF2F1EC, emissive: 0xEFE6D2,
            emissiveIntensity: 0.9, side: THREE.DoubleSide });

        // structural slab + ribbed black soffits over the platforms
        const slab = new THREE.Mesh(new THREE.PlaneGeometry(24, LEN), slabMat);
        slab.rotation.x = Math.PI / 2; slab.position.y = CEIL + 0.5;
        roofAnzac.add(slab);
        for (const s2 of [-1, 1]) {
            const sf = new THREE.Mesh(new THREE.PlaneGeometry(6.4, LEN), soffitMat);
            sf.rotation.x = Math.PI / 2; sf.position.set(s2 * 8.5, CEIL - 0.15, 0);
            roofAnzac.add(sf);
        }
        // --- diamond lattice of orange ribbon beams ---
        // Two families of parallel beams crossing on the centreline every S,
        // so the cells between them are diamonds centred at (n + 1/2)·S.
        const DS = 16, DHW = 12.2, DZH = 17.7;
        const beamAng = Math.atan2(DZH, DHW);
        const beamLen = 2 * Math.sqrt(DHW * DHW + DZH * DZH);
        // The diagonals stop at the diamond's left/right vertices; from there a
        // single straight arm carries on out over each platform, rather than the
        // two beams crossing and splitting apart again.
        const XD = DS * DHW / (2 * DZH);                       // diamond half-width
        const diagLen = 2 * Math.sqrt(XD * XD + (DS / 2) * (DS / 2));
        const armLen = 11.9 - XD;
        {
            const items = [];
            const bg = new THREE.BoxGeometry(diagLen, 0.46, 0.72);
            const arm = new THREE.BoxGeometry(armLen, 0.46, 0.72);
            for (let n = -9; n <= 9; n++) {
                const z0 = n * DS;
                if (z0 < -HALF - DS || z0 > HALF + DS) continue;
                items.push({ geo: bg, m: M(0, CEIL - 0.45, z0, 0, -beamAng, 0) });
                items.push({ geo: bg, m: M(0, CEIL - 0.45, z0, 0, beamAng, 0) });
            }
            for (let n = -9; n <= 8; n++) {
                const cz = (n + 0.5) * DS;
                if (Math.abs(cz) > HALF - 1) continue;
                for (const sx of [-1, 1]) {
                    items.push({ geo: arm, m: M(sx * (XD + armLen / 2), CEIL - 0.45, cz) });
                }
            }
            roofAnzac.add(new THREE.Mesh(mergeGeos(items), beamMat));
        }

        // --- what sits in the middle of each diamond: light, pillar, light, pillar ---
        const domeZ = [], pillarZ = [];
        {
            let i = 0;
            for (let n = -9; n <= 8; n++) {
                const cz = (n + 0.5) * DS;
                if (Math.abs(cz) > HALF - 12) continue;
                (i % 2 === 0 ? domeZ : pillarZ).push(cz);
                i++;
            }
        }

        // gold drum domes with the bright rim
        for (const dz of domeZ) {
            const drum = new THREE.Mesh(new THREE.CylinderGeometry(3.05, 3.05, 1.35, 36, 1, true), goldMat);
            drum.position.set(0, CEIL - 1.15, dz); roofAnzac.add(drum);
            const cap = new THREE.Mesh(new THREE.CircleGeometry(3.05, 36), goldMat);
            cap.rotation.x = -Math.PI / 2; cap.position.set(0, CEIL - 0.48, dz); roofAnzac.add(cap);
            const rim = new THREE.Mesh(new THREE.TorusGeometry(2.95, 0.13, 8, 44), rimMat);
            rim.rotation.x = Math.PI / 2; rim.position.set(0, CEIL - 1.82, dz); roofAnzac.add(rim);
            const dome = new THREE.Mesh(new THREE.SphereGeometry(6, 32, 10, 0, Math.PI * 2, 0, 0.5), domeMat);
            dome.position.set(0, CEIL - 1.82 - 6 * Math.cos(0.5), dz);
            roofAnzac.add(dome);
            const ribs = [];
            const rg = new THREE.BoxGeometry(2.5, 0.04, 0.07);
            for (let i = 0; i < 10; i++) {
                const a = i * Math.PI / 5;
                ribs.push({ geo: rg, m: M(Math.cos(a) * 1.52, CEIL - 1.48, dz + Math.sin(a) * 1.52, 0, -a, 0) });
            }
            roofAnzac.add(new THREE.Mesh(mergeGeos(ribs), ribMat2));
            const boss = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.2, 20), ribMat2);
            boss.position.set(0, CEIL - 1.34, dz); roofAnzac.add(boss);
            const bossRing = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.05, 6, 20), goldMat);
            bossRing.rotation.x = Math.PI / 2; bossRing.position.set(0, CEIL - 1.45, dz);
            roofAnzac.add(bossRing);
            const dl = new THREE.PointLight(0xFFF0D6, 62, 30, 2);
            dl.position.set(0, CEIL - 2.3, dz); roofAnzac.add(dl);
        }

        // big round concrete columns on the centreline — the only columns here
        for (const cz of pillarZ) {
            const H = CEIL + 0.5;
            const col = new THREE.Mesh(new THREE.CylinderGeometry(0.84, 0.9, H, 24), columnMat);
            col.position.set(0, H / 2, cz); roofAnzac.add(col);
            const base = new THREE.Mesh(new THREE.CylinderGeometry(0.99, 0.99, 0.22, 24), blackMat);
            base.position.set(0, 0.11, cz); roofAnzac.add(base);
            for (const sx of [-1, 1]) {          // station name plates facing each platform
                const p = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.92), nameMat);
                p.position.set(sx * 0.88, 3.0, cz);
                p.rotation.y = sx > 0 ? Math.PI / 2 : -Math.PI / 2;
                roofAnzac.add(p);
            }
        }

        // departure screens hung from the soffit over each platform
        for (const p of pids) {
            const face = new THREE.MeshStandardMaterial({ map: p.t, emissive: 0xffffff,
                emissiveMap: p.t, emissiveIntensity: 0.85, roughness: 0.6 });
            const edge = new THREE.MeshStandardMaterial({ color: 0x1a1b1c, roughness: 0.6 });
            const bg2 = new THREE.BoxGeometry(1.3, 0.78, 0.1);
            bg2.clearGroups(); bg2.addGroup(0, 24, 0); bg2.addGroup(24, 12, 1);
            const scr = new THREE.Mesh(bg2, [edge, face]);
            scr.position.set(p.side * 6.4, 4.05, p.z);
            scr.rotation.y = p.side > 0 ? -Math.PI / 2 : Math.PI / 2;
            roofAnzac.add(scr);
            const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 3.1, 6), darkMetal);
            rod.position.set(p.side * 6.4, 5.9, p.z); roofAnzac.add(rod);
        }

        // white saucer pendants along the platform edges + soffit downlights
        {
            const stems = [], pots = [], dots = [];
            const stemG = new THREE.CylinderGeometry(0.02, 0.02, 0.5, 6);
            const potG = new THREE.CylinderGeometry(0.36, 0.26, 0.14, 16);
            const dotG = new THREE.CylinderGeometry(0.22, 0.22, 0.03, 12);
            for (let z = -HALF + 6; z <= HALF - 6; z += 7) {
                for (const s2 of [-1, 1]) {
                    stems.push({ geo: stemG, m: M(s2 * 8.5, CEIL - 0.55, z) });
                    pots.push({ geo: potG, m: M(s2 * 8.5, CEIL - 0.87, z) });
                    dots.push({ geo: dotG, m: M(s2 * 8.5, CEIL - 0.95, z) });
                }
            }
            roofAnzac.add(new THREE.Mesh(mergeGeos(stems), darkMetal));
            roofAnzac.add(new THREE.Mesh(mergeGeos(pots), potMat));
            roofAnzac.add(new THREE.Mesh(mergeGeos(dots), rimMat));
        }
        for (const s2 of [-1, 1]) for (let z = -72; z <= 72; z += 48) {
            const pw = new THREE.PointLight(0xF3EADA, 22, 13, 2);
            pw.position.set(s2 * 8.5, CEIL - 1.1, z); roofAnzac.add(pw);
        }
    }

    // which station we are standing in
    const STATIONS = [
        { tex: () => nameTexSL, roof: 'vault' },
        { tex: () => nameTexAN, roof: 'anzac' },
        { tex: () => nameTexTH, roof: 'vault' },
    ];
    let stationIdx = 0;
    function applyStation(i) {
        const st = STATIONS[i];
        nameMat.map = st.tex();
        nameMat.needsUpdate = true;
        roofVault.visible = st.roof === 'vault';
        roofAnzac.visible = st.roof === 'anzac';
    }
    applyStation(0);
    scene.userData.applyStation = applyStation;   // handy for previews/tests

    /* ============================================================
       13 · what moves: the ride loop
       ------------------------------------------------------------
       One hero train. If you are aboard when the doors close, the
       train stays put and the WORLD slides past (the only way a
       rider can work while the app owns the camera). Mid-tunnel,
       hidden by fog, the world swaps ends and the same cavern
       re-docks wearing Town Hall signage.
       ============================================================ */
    let pidClock = 0, pidLast = -1;
    const STOPZ = 35.5, FAR = 260;
    const RIDE_D = 640, JUMP_AT = 320, VMAX = 24, ACC = 1.15;
    let phase = 'approach', pt = 0, traveled = 0, riding = false;
    heroTrain.position.z = -FAR;

    function playerAboard() {
        const p = world.camera && world.camera.position;
        if (!p) return false;
        return Math.abs(p.x - 13.15) < 1.7 && Math.abs(p.z - STOPZ) < 80 && p.y < 4.2;
    }

    // everything except the train (and its lights, and the sky light) rides in worldG
    const worldG = new THREE.Group();
    {
        for (const c of [...scene.children]) {
            if (c === heroTrain) continue;
            if (c.isLight && (c.type === 'HemisphereLight' || c.userData.followTrain !== undefined)) continue;
            worldG.add(c);
        }
        scene.add(worldG);
    }

    world.frame((dt) => {
        pidClock += dt;
        if (roofVault.visible) {
            for (const e of escBanks) {
                e.off = (e.off + dt * 0.62) % e.P;
                let i = 0;
                for (const lx of e.laneX) {
                    for (let k = 0; k < e.perLane; k++) {
                        let u = k * e.P + e.off;
                        if (u > e.RUN) u -= e.RUN + e.P;
                        const yTop = Math.max(0, u) * e.tanA;
                        e.dummy.position.set(lx, yTop - 0.13, e.ZB - u);
                        e.dummy.updateMatrix();
                        e.mesh.setMatrixAt(i++, e.dummy.matrix);
                    }
                }
                e.mesh.instanceMatrix.needsUpdate = true;
            }
        }
        const step = Math.floor(pidClock / 45);
        if (step !== pidLast) {
            pidLast = step;
            pids.forEach(p => drawPIDNow(p, pidClock));
        }
        let k = 0;
        if (phase === 'approach') {
            pt += dt;
            const kk = Math.min(1, pt / 14);
            heroTrain.visible = true;
            heroTrain.position.z = -FAR + (1 - Math.pow(1 - kk, 3)) * (FAR + STOPZ);
            if (kk >= 1) { phase = 'dwell'; pt = 0; }
        } else if (phase === 'dwell') {
            pt += dt;
            const DW = 26;
            const open = Math.min(1, Math.max(0, (pt - 0.8) / 1.5));
            const close = Math.min(1, Math.max(0, (DW - 1.0 - pt) / 1.7));
            k = Math.max(0, Math.min(open, close));
            k = k * k * (3 - 2 * k);
            if (pt >= DW) {
                riding = playerAboard();
                traveled = 0;
                phase = riding ? 'ride' : 'away';
                pt = 0;
            }
        } else if (phase === 'ride') {
            const remaining = Math.max(0.01, RIDE_D - traveled);
            const v = Math.min(VMAX, Math.sqrt(2 * ACC * Math.min(traveled + 1.5, remaining)));
            const before = traveled;
            traveled += v * dt;
            if (before < JUMP_AT && traveled >= JUMP_AT) {
                stationIdx = (stationIdx + 1) % STATIONS.length;   // next stop down the line
                applyStation(stationIdx);
            }
            worldG.position.z = traveled < JUMP_AT ? -traveled : (RIDE_D - traveled);
            if (traveled >= RIDE_D) { worldG.position.z = 0; phase = 'dwell'; pt = 0; }
        } else if (phase === 'away') {
            pt += dt;
            if (pt < 14) {
                const kk = pt / 14;
                heroTrain.position.z = STOPZ + Math.pow(kk, 3) * (FAR - STOPZ);
            } else {
                heroTrain.visible = false;
                if (pt > 26) { phase = 'approach'; pt = 0; heroTrain.position.z = -FAR; }
            }
        }
        if (heroTrain.userData.setDoors) heroTrain.userData.setDoors(k, -1);
        const mv = psdMovers['1'];
        if (mv) {
            const o = k * 0.94;
            mv.L.position.z = -o; mv.aL.position.z = -o;
            mv.R.position.z = o; mv.aR.position.z = o;
        }
        for (const tr of trains) {
            if (tr.light) tr.light.position.z = heroTrain.position.z + tr.light.userData.followTrain;
        }
    });
}
