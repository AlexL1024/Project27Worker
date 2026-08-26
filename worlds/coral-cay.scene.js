//
//  island.scene.js
//  Project27iOS
//
//  A world, in the shape the builder will write them.
//
//  Written by hand rather than generated — it is the target, kept in the app so the
//  runtime has something real to be tested against. Everything that made it worth
//  aiming at is here: a sky function the water samples so its reflections agree,
//  Gerstner waves displaced in the vertex stage, terrain out of noise, an instanced
//  palm grove, hulls textured from a canvas, bloom.
//
//  None of it survives being baked into a file of triangles, which is the whole
//  argument for a world being code.
//

import { mergeGeometries } from './BufferGeometryUtils.js';

export default function build(world) {
    const { THREE, scene, renderer, camera } = world;

    // This one brings its own sky, its own light and its own horizon, so the app's
    // gradient dome and grid step aside.
    world.ownsSky(true);
    world.groundLevel(0);
    world.bloom({ strength: 0.22, radius: 0.68, threshold: 0.92 });



    /* ============================================================
       0 · 工具
       ============================================================ */
    const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
    const lerp = (a, b, t) => a + (b - a) * t;
    const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
    const smoothstep = (e0, e1, x) => { const t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };
    const srgb = (hex) => new THREE.Color(hex).convertSRGBToLinear();

    // 确定性随机：每次打开构图一致
    let _seed = 20260726;
    const rnd = () => { _seed = (_seed * 1664525 + 1013904223) % 4294967296; return _seed / 4294967296; };
    const rr = (a, b) => a + (b - a) * rnd();

    const hash2 = (x, y) => { const n = Math.sin(x * 127.1 + y * 311.7) * 43758.545; return n - Math.floor(n); };
    function vnoise(x, y) {
      const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
      const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
      const a = hash2(xi, yi), b = hash2(xi + 1, yi), c = hash2(xi, yi + 1), d = hash2(xi + 1, yi + 1);
      return a * (1 - u) * (1 - v) + b * u * (1 - v) + c * (1 - u) * v + d * u * v;
    }
    function fbm2(x, y, oct = 5) {
      let s = 0, a = 0.5, f = 1;
      for (let i = 0; i < oct; i++) { s += a * vnoise(x * f, y * f); f *= 2.03; a *= 0.5; }
      return s;
    }

    /* ============================================================
       1 · 场景常量（水面 y = 0）
       ============================================================ */
    const SUN_DIR   = V3(-0.50, 0.62, -0.70).normalize();
    const C_SUN     = srgb(0xffeec9);
    const C_SKY_TOP = srgb(0x1a5cba);
    const C_SKY_MID = srgb(0x59a2e2);
    const C_HORIZON = srgb(0xaed3e8);
    const C_DEEP    = srgb(0x0a5580);
    const C_SHALLOW = srgb(0x24c8c2);
    const C_FOAM    = srgb(0xf3fbff);

    const ISLAND_R = 105;
    const MAP_SIZE = 560;
    const SHIP_POS = new THREE.Vector2(365, -155);
    const SHIP_YAW = -0.42;

    /* ============================================================
       2 · 渲染器 / 相机 / 灯光
       ============================================================ */

    scene.fog = new THREE.FogExp2(C_HORIZON.clone(), 0.00052);

    camera.position.set(520, 250, 520);


    const sun = new THREE.DirectionalLight(0xfff0d0, 3.1);
    sun.position.copy(SUN_DIR).multiplyScalar(700);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const sc = sun.shadow.camera;
    sc.left = -190; sc.right = 190; sc.top = 190; sc.bottom = -190; sc.near = 300; sc.far = 1250;
    sun.shadow.bias = -0.0012; sun.shadow.normalBias = 0.7;
    scene.add(sun, sun.target);
    scene.add(new THREE.HemisphereLight(0xbfe4ff, 0x3c8a86, 1.45));
    scene.add(new THREE.AmbientLight(0xd8ecff, 0.38));

    /* ============================================================
       3 · 天空 + 云
       ============================================================ */
    const SKY_GLSL = /* glsl */`
      vec3 skyColor(vec3 d, vec3 sunDir, vec3 top, vec3 mid, vec3 hor, vec3 sunCol) {
        float h = d.y;
        vec3 col = mix(hor, mid, smoothstep(-0.02, 0.30, h));
        col = mix(col, top, smoothstep(0.16, 0.86, h));
        float sd = max(dot(normalize(d), sunDir), 0.0);
        vec3 glow = mix(sunCol, vec3(1.0), 0.45);
        col += glow * pow(sd, 22.0) * 0.22;
        col += glow * pow(sd, 5.0) * 0.030;
        col = mix(col, hor * 1.03, smoothstep(0.07, -0.06, h));
        return col;
      }
    `;
    const skyUniforms = {
      uSunDir: { value: SUN_DIR.clone() }, uSunCol: { value: C_SUN.clone() },
      uTop: { value: C_SKY_TOP.clone() }, uMid: { value: C_SKY_MID.clone() }, uHor: { value: C_HORIZON.clone() },
    };
    const sky = new THREE.Mesh(
      new THREE.SphereGeometry(6000, 48, 32),
      new THREE.ShaderMaterial({
        side: THREE.BackSide, depthWrite: false, fog: false, uniforms: skyUniforms,
        vertexShader: `varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
        fragmentShader: SKY_GLSL + `
          varying vec3 vDir; uniform vec3 uSunDir, uSunCol, uTop, uMid, uHor;
          void main(){
            vec3 d = normalize(vDir);
            vec3 col = skyColor(d, uSunDir, uTop, uMid, uHor, uSunCol);
            float sd = max(dot(d, uSunDir), 0.0);
            col += uSunCol * smoothstep(0.9985, 0.99955, sd) * 6.0;
            gl_FragColor = vec4(col, 1.0);
          }`,
      })
    );
    sky.renderOrder = -10;
    scene.add(sky);

    function cloudTexture(seedShift) {
      const S = 512, cv = document.createElement('canvas'); cv.width = cv.height = S;
      const g = cv.getContext('2d');
      const base = S * 0.70;                       // 平底
      const puff = (x, y, r, a) => {
        const rad = g.createRadialGradient(x, y - r * 0.22, r * 0.12, x, y, r);
        rad.addColorStop(0, `rgba(255,255,255,${a})`);
        rad.addColorStop(0.55, `rgba(255,255,255,${a * 0.88})`);
        rad.addColorStop(0.82, `rgba(250,253,255,${a * 0.34})`);
        rad.addColorStop(1, 'rgba(246,251,255,0)');
        g.fillStyle = rad; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
      };
      // 底部一排大团
      for (let i = 0; i < 7; i++) {
        const t = i / 6;
        puff(S * 0.12 + t * S * 0.76 + rr(-14, 14), base - rr(6, 26), rr(46, 84) * (1 - Math.abs(t - 0.5) * 0.5), rr(0.72, 0.95));
      }
      // 顶部隆起
      for (let i = 0; i < 12; i++) {
        const t = (i + seedShift * 0.3) / 12;
        const x = S * 0.18 + t * S * 0.64 + rr(-26, 26);
        const lift = Math.sin(t * Math.PI) * S * 0.20;
        puff(x, base - lift - rr(10, 46), rr(30, 66) * (0.6 + Math.sin(t * Math.PI) * 0.6), rr(0.55, 0.9));
      }
      // 边缘碎絮
      for (let i = 0; i < 16; i++) {
        const a = rr(0, Math.PI * 2);
        puff(S / 2 + Math.cos(a) * rr(80, 190), base - rr(0, 120) + Math.sin(a) * 18, rr(14, 34), rr(0.18, 0.42));
      }
      // 底部压暗，做出体积
      g.globalCompositeOperation = 'source-atop';
      const shade = g.createLinearGradient(0, base - S * 0.30, 0, base + 12);
      shade.addColorStop(0, 'rgba(255,255,255,0)');
      shade.addColorStop(0.62, 'rgba(176,201,224,.28)');
      shade.addColorStop(1, 'rgba(140,170,200,.55)');
      g.fillStyle = shade; g.fillRect(0, 0, S, S);
      g.globalCompositeOperation = 'source-over';

      const t = new THREE.CanvasTexture(cv);
      t.colorSpace = THREE.SRGBColorSpace;
      return t;
    }
    const CLOUD_TEXES = [cloudTexture(0), cloudTexture(1), cloudTexture(2)];
    const cloudTex = CLOUD_TEXES[0];
    const pickCloud = () => CLOUD_TEXES[Math.floor(rnd() * CLOUD_TEXES.length)];
    const clouds = [];
    for (let i = 0; i < 64; i++) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({
        map: pickCloud(), transparent: true, depthWrite: false, fog: false,
        opacity: rr(0.55, 0.95), color: new THREE.Color().setRGB(rr(1.4, 1.9), rr(1.4, 1.85), rr(1.38, 1.82)),
      }));
      const ang = rr(0, Math.PI * 2), rad = rr(900, 4600);
      const sz = rr(190, 620) * (rad / 2200 + 0.55);
      sp.position.set(Math.cos(ang) * rad, rr(420, 1250) + rad * 0.06, Math.sin(ang) * rad);
      sp.scale.set(sz, sz * rr(0.5, 0.78), 1);
      sp.userData.drift = rr(0.6, 2.2);
      sp.renderOrder = -5;
      clouds.push(sp); scene.add(sp);
    }
    for (let i = 0; i < 26; i++) {  // 海平线上方一带积云：低机位镜头里的"蓝天白云"
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({
        map: pickCloud(), transparent: true, depthWrite: false, fog: false,
        opacity: rr(0.55, 0.95), color: new THREE.Color().setRGB(rr(1.5, 1.95), rr(1.5, 1.9), rr(1.45, 1.88)),
      }));
      const ang = rr(0, Math.PI * 2), rad = rr(2200, 5200);
      const sz = rr(420, 1000);
      sp.position.set(Math.cos(ang) * rad, rr(150, 460), Math.sin(ang) * rad);
      sp.scale.set(sz, sz * rr(0.42, 0.62), 1);
      sp.userData.drift = rr(0.4, 1.4);
      sp.renderOrder = -5;
      clouds.push(sp); scene.add(sp);
    }
    for (let i = 0; i < 16; i++) { // 贴海平线的薄雾
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({
        map: cloudTex, transparent: true, depthWrite: false, fog: false, opacity: rr(0.12, 0.3),
        color: new THREE.Color().setRGB(1.6, 1.6, 1.6),
      }));
      const ang = rr(0, Math.PI * 2), rad = rr(1600, 3800);
      sp.position.set(Math.cos(ang) * rad, rr(20, 90), Math.sin(ang) * rad);
      sp.scale.set(rr(600, 1500), rr(90, 190), 1);
      sp.userData.drift = rr(0.2, 0.8);
      sp.renderOrder = -6;
      clouds.push(sp); scene.add(sp);
    }

    /* ============================================================
       4 · 海岛地形
       ============================================================ */
    const coastRadius = (ang) =>
      ISLAND_R * (1 + 0.17 * Math.sin(ang * 2.0 + 0.7) + 0.10 * Math.sin(ang * 3.7 + 2.1) + 0.055 * Math.sin(ang * 6.1 - 1.2));

    function terrainHeight(x, z) {
      const d = Math.hypot(x, z) + 1e-4;
      const t = d / coastRadius(Math.atan2(z, x));
      const inland = Math.max(0, 1 - t), sea = Math.max(0, t - 1);
      let h = 24 * Math.pow(inland, 1.85);
      h += (fbm2(x * 0.014 + 11, z * 0.014 - 5, 4) - 0.45) * 17 * Math.pow(inland, 1.15);
      const ridge = 1 - Math.abs(fbm2(x * 0.020 - 7, z * 0.020 + 4, 3) * 2 - 1);   // 山脊线，别让主峰变圆锥
      h += ridge * ridge * 13 * Math.pow(inland, 1.25);
      h += (fbm2(x * 0.055 - 3, z * 0.055 + 8, 3) - 0.5) * 1.5 * smoothstep(1.25, 0.75, t);
      h -= 30 * Math.pow(sea, 1.30);
      const beach = smoothstep(0.72, 1.02, t) * smoothstep(1.22, 1.0, t);
      return lerp(h, h * 0.34 + 0.5, beach * 0.85);
    }

    const islandGeo = new THREE.PlaneGeometry(MAP_SIZE, MAP_SIZE, 340, 340);
    islandGeo.rotateX(-Math.PI / 2);
    {
      const p = islandGeo.attributes.position, n = p.count;
      const colors = new Float32Array(n * 3), col = new THREE.Color();
      const cSandWet = srgb(0xcdb894), cSand = srgb(0xf0e2bd), cScrub = srgb(0x8ba05a),
            cGrass = srgb(0x476f34), cJungle = srgb(0x2c5326), cRock = srgb(0x7c7466);
      for (let i = 0; i < n; i++) {
        const x = p.getX(i), z = p.getZ(i);
        const h = terrainHeight(x, z);
        p.setY(i, h);
        const hx = terrainHeight(x + 1.5, z) - terrainHeight(x - 1.5, z);
        const hz = terrainHeight(x, z + 1.5) - terrainHeight(x, z - 1.5);
        const slope = Math.hypot(hx, hz) / 3;
        const nz = fbm2(x * 0.09, z * 0.09, 3);
        if (h < -0.4) col.copy(cSandWet).lerp(srgb(0x9fc0a8), smoothstep(-0.5, -9, h));
        else if (h < 1.6) col.copy(cSandWet).lerp(cSand, smoothstep(-0.3, 1.6, h));
        else if (h < 4.5) col.copy(cSand).lerp(cScrub, smoothstep(1.9, 4.5, h) * (0.7 + nz * 0.5));
        else if (h < 13) col.copy(cScrub).lerp(cGrass, smoothstep(4.5, 11, h));
        else col.copy(cGrass).lerp(cJungle, smoothstep(12, 22, h) * (0.6 + nz * 0.7));
        if (slope > 0.62 && h > 2) col.lerp(cRock, smoothstep(0.62, 1.15, slope) * 0.7);
        col.multiplyScalar(0.88 + nz * 0.24);
        colors[i * 3] = col.r; colors[i * 3 + 1] = col.g; colors[i * 3 + 2] = col.b;
      }
      islandGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      islandGeo.computeVertexNormals();
    }
    const island = new THREE.Mesh(islandGeo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.97 }));
    island.receiveShadow = true;
    scene.add(island);

    /* 高程贴图 → 水面着色器算水深 / 岸线泡沫 */
    const MAPRES = 256;
    const heightData = new Uint8Array(MAPRES * MAPRES * 4);
    for (let j = 0; j < MAPRES; j++) {
      for (let i = 0; i < MAPRES; i++) {
        const x = (i / (MAPRES - 1) - 0.5) * MAP_SIZE;
        const z = (j / (MAPRES - 1) - 0.5) * MAP_SIZE;
        const h = clamp(terrainHeight(x, z), -60, 60);
        const k = (j * MAPRES + i) * 4;
        heightData[k] = Math.round((h + 60) / 120 * 255);
        heightData[k + 3] = 255;
      }
    }
    const heightTex = new THREE.DataTexture(heightData, MAPRES, MAPRES, THREE.RGBAFormat);
    heightTex.minFilter = heightTex.magFilter = THREE.LinearFilter;
    heightTex.wrapS = heightTex.wrapT = THREE.ClampToEdgeWrapping;
    heightTex.needsUpdate = true;

    /* ============================================================
       4b · 中景火山岛
       ============================================================ */
    const VOLC = new THREE.Vector2(-620, -470);   // 离主岛约 780
    const VOLC_MAP = 1000;
    const VOLC_PEAK = 236, VOLC_CRATER = 0.135;
    const VOLC_RIM = VOLC_PEAK * Math.pow(1 - VOLC_CRATER, 1.35);

    function volcanoRadius(ang) {
      return 330 * (1 + 0.11 * Math.sin(ang * 2.3 + 1.1) + 0.065 * Math.sin(ang * 3.9 - 0.4) + 0.04 * Math.sin(ang * 6.7 + 2.2));
    }
    function volcanoHeight(x, z) {
      const dx = x - VOLC.x, dz = z - VOLC.y;
      const d = Math.hypot(dx, dz) + 1e-4;
      const ang = Math.atan2(dz, dx);
      const t = d / volcanoRadius(ang);
      const inland = Math.max(0, 1 - t), sea = Math.max(0, t - 1);

      let h = VOLC_PEAK * Math.pow(inland, 1.35);          // 层火山的凹形轮廓：陡顶 + 外张裙摆
      if (t < VOLC_CRATER) {                               // 火山口：先起口沿，再挖下去
        h = VOLC_RIM + (VOLC_CRATER - t) * 26;
        h -= 78 * smoothstep(VOLC_CRATER, VOLC_CRATER * 0.18, t);
      }
      // 放射状冲沟 + 侵蚀噪声
      const flank = smoothstep(0.10, 0.42, t) * inland;
      h += Math.sin(ang * 13 + fbm2(dx * 0.004 + 9, dz * 0.004 - 3, 2) * 7) * 13 * flank;
      h += (fbm2(dx * 0.011 + 40, dz * 0.011 - 20, 4) - 0.5) * 40 * Math.pow(inland, 0.85) * smoothstep(0.04, 0.3, t);
      h += (fbm2(dx * 0.05 - 6, dz * 0.05 + 2, 3) - 0.5) * 2.2 * smoothstep(1.3, 0.8, t);
      h -= 34 * Math.pow(sea, 1.28);                       // 水下裙礁
      const beach = smoothstep(0.80, 1.02, t) * smoothstep(1.20, 1.0, t);
      return lerp(h, h * 0.36 + 0.6, beach * 0.8);
    }

    const volcGeo = new THREE.PlaneGeometry(VOLC_MAP, VOLC_MAP, 300, 300);
    volcGeo.rotateX(-Math.PI / 2);
    volcGeo.translate(VOLC.x, 0, VOLC.y);
    {
      const p = volcGeo.attributes.position, n = p.count;
      const colors = new Float32Array(n * 3), col = new THREE.Color();
      const cAsh = srgb(0x6f6560), cSandV = srgb(0xc4b599), cJungleLo = srgb(0x437f36),
            cJungleHi = srgb(0x2b5a31), cScree = srgb(0x6d5647), cBasalt = srgb(0x3d3330),
            cCrater = srgb(0x272020), cSulfur = srgb(0x977f4d);
      for (let i = 0; i < n; i++) {
        const x = p.getX(i), z = p.getZ(i);
        const h = volcanoHeight(x, z);
        p.setY(i, h);
        const d = Math.hypot(x - VOLC.x, z - VOLC.y);
        const t = d / volcanoRadius(Math.atan2(z - VOLC.y, x - VOLC.x));
        const hx = volcanoHeight(x + 2.5, z) - volcanoHeight(x - 2.5, z);
        const hz = volcanoHeight(x, z + 2.5) - volcanoHeight(x, z - 2.5);
        const slope = Math.hypot(hx, hz) / 5;
        const nz = fbm2(x * 0.06 + 3, z * 0.06 - 7, 3);

        if (h < -0.6) col.copy(cAsh).lerp(srgb(0x5f7f78), smoothstep(-0.6, -10, h));
        else if (h < 2.2) col.copy(cAsh).lerp(cSandV, smoothstep(-0.4, 2.2, h));   // 火山灰沙滩
        else if (h < 40) col.copy(cSandV).lerp(cJungleLo, smoothstep(2.4, 18, h));
        else if (h < 150) col.copy(cJungleLo).lerp(cJungleHi, smoothstep(40, 130, h) * (0.6 + nz * 0.7));
        else if (h < 200) col.copy(cJungleHi).lerp(cScree, smoothstep(148, 196, h));
        else col.copy(cScree).lerp(cBasalt, smoothstep(200, 226, h));
        if (t < VOLC_CRATER * 1.25) col.lerp(cCrater, smoothstep(VOLC_CRATER * 1.25, VOLC_CRATER * 0.5, t));
        if (t < VOLC_CRATER * 0.55) col.lerp(cSulfur, smoothstep(VOLC_CRATER * 0.55, 0.0, t) * 0.55);
        if (slope > 0.75 && h > 20) col.lerp(cScree, smoothstep(0.75, 1.4, slope) * 0.65);
        col.multiplyScalar(0.86 + nz * 0.28);
        colors[i * 3] = col.r; colors[i * 3 + 1] = col.g; colors[i * 3 + 2] = col.b;
      }
      volcGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      volcGeo.computeVertexNormals();
    }
    const volcano = new THREE.Mesh(volcGeo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.99 }));
    scene.add(volcano);

    /* 火山口的蒸汽柱 */
    const plume = [];
    {
      const craterTop = V3(VOLC.x, VOLC_RIM - 30, VOLC.y);
      for (let i = 0; i < 22; i++) {
        const sp = new THREE.Sprite(new THREE.SpriteMaterial({
          map: pickCloud(), transparent: true, depthWrite: false, fog: true,
          color: new THREE.Color().setRGB(1.25, 1.22, 1.2), opacity: 0.5,
        }));
        sp.userData = { u: i / 22, spd: rr(0.028, 0.045), drift: rr(0.55, 1.15), sway: rr(0, 6.28), base: craterTop };
        sp.renderOrder = -4;
        plume.push(sp); scene.add(sp);
      }
    }

    /* 火山岛的水深贴图（第二张，喂给水面着色器） */
    const volcData = new Uint8Array(MAPRES * MAPRES * 4);
    for (let j = 0; j < MAPRES; j++) {
      for (let i = 0; i < MAPRES; i++) {
        const x = VOLC.x + (i / (MAPRES - 1) - 0.5) * VOLC_MAP;
        const z = VOLC.y + (j / (MAPRES - 1) - 0.5) * VOLC_MAP;
        const h = clamp(volcanoHeight(x, z), -60, 60);
        const k = (j * MAPRES + i) * 4;
        volcData[k] = Math.round((h + 60) / 120 * 255);
        volcData[k + 3] = 255;
      }
    }
    const volcTex = new THREE.DataTexture(volcData, MAPRES, MAPRES, THREE.RGBAFormat);
    volcTex.minFilter = volcTex.magFilter = THREE.LinearFilter;
    volcTex.wrapS = volcTex.wrapT = THREE.ClampToEdgeWrapping;
    volcTex.needsUpdate = true;

    /* ============================================================
       5 · 海面（Gerstner 波）
       ============================================================ */
    const WAVES = [ // dirX, dirZ, 陡度, 波长, 速度（方向拉开，避免海面出现"灯芯绒"条纹）
      [ 0.98,  0.19, 0.150, 84.0, 0.92],
      [ 0.52, -0.86, 0.115, 47.0, 1.06],
      [-0.62,  0.78, 0.090, 29.0, 0.88],
      [ 0.14,  0.99, 0.065, 18.0, 1.20],
      [-0.94, -0.34, 0.050, 11.0, 1.36],
      [ 0.78,  0.63, 0.032,  6.8, 1.55],
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
    ).join('\n      ');
    const WAVE_AMP = WAVES.reduce((s, w) => s + w[2] * w[3] / (2 * Math.PI), 0);

    function waveHeight(x, z, t) { // JS 端同款波高
      let y = 0;
      for (const [dx, dz, steep, wl, spd] of WAVES) {
        const k = 6.28318530718 / wl, c = Math.sqrt(9.81 / k) * spd;
        const len = Math.hypot(dx, dz);
        y += (steep / k) * Math.sin(k * ((dx / len * x + dz / len * z) - c * t));
      }
      return y;
    }

    const waterUniforms = {
      uTime: { value: 0 }, uCamPos: { value: new THREE.Vector3() },
      uSunDir: { value: SUN_DIR.clone() }, uSunCol: { value: C_SUN.clone() },
      uTop: { value: C_SKY_TOP.clone() }, uMid: { value: C_SKY_MID.clone() }, uHor: { value: C_HORIZON.clone() },
      uDeep: { value: C_DEEP.clone() }, uShallow: { value: C_SHALLOW.clone() }, uFoam: { value: C_FOAM.clone() },
      uMap: { value: heightTex }, uMapSize: { value: MAP_SIZE }, uAmp: { value: WAVE_AMP },
      uMap2: { value: volcTex }, uMap2Size: { value: VOLC_MAP }, uMap2Center: { value: VOLC.clone() },
      uShipPos: { value: SHIP_POS.clone() },
      uShipRot: { value: new THREE.Vector2(Math.cos(SHIP_YAW), Math.sin(SHIP_YAW)) },
      uShipSize: { value: new THREE.Vector2(104, 17.5) },
      uFogDensity: { value: 0.00052 },
    };
    const waterMat = new THREE.ShaderMaterial({
      uniforms: waterUniforms, transparent: true, depthWrite: true,
      vertexShader: WAVE_GLSL + /* glsl */`
        uniform float uTime, uAmp;
        varying vec3 vWorld; varying vec3 vNrm; varying float vCrest;
        void main(){
          vec3 wp = (modelMatrix * vec4(position, 1.0)).xyz;
          vec2 p = wp.xz; float t = uTime;
          vec3 disp = vec3(0.0), tang = vec3(1.0, 0.0, 0.0), bino = vec3(0.0, 0.0, 1.0);
          ${waveCalls}
          float d = length(cameraPosition.xz - p);
          float damp = 1.0 - smoothstep(420.0, 1500.0, d) * 0.72;   // 远处压平，避免抖动
          disp *= damp;
          vec3 world = wp + disp;
          vNrm = normalize(mix(vec3(0.0, 1.0, 0.0), normalize(cross(bino, tang)), damp));
          vCrest = clamp(disp.y / max(uAmp, 0.001), -1.0, 1.0);
          vWorld = world;
          gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);
        }`,
      fragmentShader: SKY_GLSL + /* glsl */`
        uniform float uTime, uMapSize, uFogDensity, uMap2Size;
        uniform vec3 uCamPos, uSunDir, uSunCol, uTop, uMid, uHor, uDeep, uShallow, uFoam;
        uniform sampler2D uMap, uMap2;
        uniform vec2 uShipPos, uShipRot, uShipSize, uMap2Center;
        varying vec3 vWorld; varying vec3 vNrm; varying float vCrest;

        float hash21(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
        float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
          float a = hash21(i), b = hash21(i + vec2(1.0, 0.0)), c = hash21(i + vec2(0.0, 1.0)), d = hash21(i + vec2(1.0, 1.0));
          return mix(mix(a, b, f.x), mix(c, d, f.x), f.y); }
        float fbm(vec2 p){ float s = 0.0, a = 0.5; for(int i = 0; i < 4; i++){ s += a * vn(p); p *= 2.05; a *= 0.5; } return s; }

        void main(){
          float dist = length(uCamPos - vWorld);
          float detail = 1.0 - smoothstep(60.0, 460.0, dist);

          vec3 N = normalize(vNrm);
          // 涟漪法线：频率随距离降低，让屏幕上的细碎度基本恒定
          // —— 近处不糊、远处不摩尔纹，高光也就不会结成大块
          float lod = clamp(dist / 210.0, 0.30, 7.0);
          vec2 rp = vWorld.xz * (0.40 / lod);
          float n1 = fbm(rp + vec2(uTime * 0.32, uTime * 0.19) / lod);
          float n2 = fbm(rp * 2.3 - vec2(uTime * 0.25, uTime * 0.38) / lod);
          N = normalize(N + vec3((n1 - 0.5) * 0.40, 0.0, (n2 - 0.5) * 0.40));
          float near = 1.0 - smoothstep(30.0, 200.0, dist);   // 贴脸时再加一层细纹
          if (near > 0.01) {
            float k1 = fbm(vWorld.xz * 1.35 + vec2(uTime * 0.5, -uTime * 0.3));
            float k2 = fbm(vWorld.xz * 1.9 - vec2(uTime * 0.42, uTime * 0.55));
            N = normalize(N + vec3((k1 - 0.5) * 0.30, 0.0, (k2 - 0.5) * 0.30) * near);
          }

          vec2 mUv = vWorld.xz / uMapSize + 0.5;
          float bed = -60.0;
          if (mUv.x > 0.0 && mUv.x < 1.0 && mUv.y > 0.0 && mUv.y < 1.0)
            bed = texture2D(uMap, mUv).r * 120.0 - 60.0;
          vec2 mUv2 = (vWorld.xz - uMap2Center) / uMap2Size + 0.5;      // 火山岛
          if (mUv2.x > 0.0 && mUv2.x < 1.0 && mUv2.y > 0.0 && mUv2.y < 1.0)
            bed = max(bed, texture2D(uMap2, mUv2).r * 120.0 - 60.0);
          float depth = max(0.0, -bed);

          vec3 V = normalize(uCamPos - vWorld);
          float fres = mix(0.025, 1.0, pow(1.0 - max(dot(N, V), 0.0), 5.0));
          vec3 R = reflect(-V, N); R.y = abs(R.y);
          vec3 skyRefl = skyColor(R, uSunDir, uTop, uMid, uHor, uSunCol);

          float shallowF = smoothstep(0.0, 17.0, depth);
          vec3 body = mix(uShallow, uDeep, shallowF);
          body *= 0.82 + 0.42 * max(dot(N, uSunDir), 0.0);
          body += uShallow * pow(max(vCrest, 0.0), 2.2) * 0.30 * (1.0 - shallowF * 0.6);  // 浪背透光

          vec3 col = mix(body, skyRefl, clamp(fres, 0.0, 1.0));

          vec3 H = normalize(V + uSunDir);
          float ndh = max(dot(N, H), 0.0);
          float glitter = pow(ndh, 200.0) * (0.2 + 0.8 * fbm(vWorld.xz * 0.9 + uTime * 0.4));
          col += uSunCol * (pow(ndh, 640.0) * 0.85 + glitter * 0.14 * detail);

          // 泡沫：岸线涌浪 / 浪尖 / 邮轮吃水线
          float band = fbm(vWorld.xz * 0.13 + vec2(0.0, uTime * 0.22));
          float surge = 0.5 + 0.5 * sin(uTime * 0.85 - depth * 1.5 + band * 3.2);
          float foam = smoothstep(4.2, 0.05, depth) * smoothstep(0.20, 0.66, band * 0.55 + surge * 0.62);
          foam += smoothstep(0.86, 1.0, vCrest) * smoothstep(0.55, 0.98, fbm(vWorld.xz * 0.7 - uTime * 0.18)) * 0.16 * detail;
          vec2 sp = vWorld.xz - uShipPos;
          sp = vec2(sp.x * uShipRot.x + sp.y * uShipRot.y, -sp.x * uShipRot.y + sp.y * uShipRot.x) / uShipSize;
          float e = length(sp);
          foam += smoothstep(0.90, 1.01, e) * smoothstep(1.20, 1.02, e) * (0.35 + 0.65 * fbm(vWorld.xz * 0.5 + uTime * 0.3)) * 0.85;
          foam = clamp(foam, 0.0, 1.0);
          col = mix(col, uFoam * (0.92 + 0.16 * n1), foam * 0.92);

          float alpha = clamp(max(mix(0.42, 1.0, smoothstep(0.05, 2.6, depth)), foam), 0.0, 1.0);

          float fog = 1.0 - exp(-pow(dist * uFogDensity, 2.0));
          col = mix(col, uHor, fog);
          alpha = mix(alpha, 1.0, fog);

          gl_FragColor = vec4(col, alpha);
        }`,
    });
    const waterGeo = new THREE.PlaneGeometry(2800, 2800, 480, 480);
    waterGeo.rotateX(-Math.PI / 2);
    const water = new THREE.Mesh(waterGeo, waterMat);
    water.renderOrder = 1;
    scene.add(water);

    /* 远海：平面圆环，接住细节海面的外沿，一直铺到天际线 */
    const farOcean = new THREE.Mesh(
      (() => { const g = new THREE.RingGeometry(1180, 7000, 128, 6); g.rotateX(-Math.PI / 2); return g; })(),
      new THREE.ShaderMaterial({
        uniforms: {
          uCamPos: waterUniforms.uCamPos, uSunDir: waterUniforms.uSunDir, uSunCol: waterUniforms.uSunCol,
          uTop: waterUniforms.uTop, uMid: waterUniforms.uMid, uHor: waterUniforms.uHor,
          uDeep: waterUniforms.uDeep, uFogDensity: waterUniforms.uFogDensity,
        },
        vertexShader: `varying vec3 vWorld;
          void main(){ vWorld = (modelMatrix * vec4(position, 1.0)).xyz;
            gl_Position = projectionMatrix * viewMatrix * vec4(vWorld, 1.0); }`,
        fragmentShader: SKY_GLSL + `
          uniform vec3 uCamPos, uSunDir, uSunCol, uTop, uMid, uHor, uDeep;
          uniform float uFogDensity;
          varying vec3 vWorld;
          void main(){
            vec3 N = vec3(0.0, 1.0, 0.0);
            vec3 V = normalize(uCamPos - vWorld);
            float fres = mix(0.025, 1.0, pow(1.0 - max(dot(N, V), 0.0), 5.0));
            vec3 R = reflect(-V, N); R.y = abs(R.y);
            vec3 col = mix(uDeep * 0.95, skyColor(R, uSunDir, uTop, uMid, uHor, uSunCol), clamp(fres, 0.0, 1.0));
            vec3 H = normalize(V + uSunDir);
            col += uSunCol * pow(max(dot(N, H), 0.0), 220.0) * 0.6;
            float dist = length(uCamPos - vWorld);
            col = mix(col, uHor, 1.0 - exp(-pow(dist * uFogDensity, 2.0)));
            gl_FragColor = vec4(col, 1.0);
          }`,
      })
    );
    farOcean.position.y = -0.15;
    farOcean.renderOrder = 0;
    scene.add(farOcean);

    /* ============================================================
       6 · 椰子树 / 灌木 / 度假设施
       ============================================================ */
    function frondGeometry() {
      const len = 8.2, segs = 18;
      const g = new THREE.PlaneGeometry(len, 2.0, segs, 3);
      g.rotateX(-Math.PI / 2);
      g.translate(len / 2, 0, 0);
      const p = g.attributes.position;
      const cols = new Float32Array(p.count * 3);
      const cBase = srgb(0x2c5c2a), cTip = srgb(0x86bf4d), c = new THREE.Color();
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i), z = p.getZ(i);
        const t = clamp(x / len, 0, 1);
        const taper = Math.pow(Math.sin(Math.min(t, 0.98) * Math.PI * 0.92 + 0.10), 0.65) * (1 - t * 0.35);
        const serr = 1 - 0.14 * Math.abs(Math.sin(t * 46));   // 叶缘羽状
        const nz = z * taper * serr;
        p.setZ(i, nz);
        p.setY(i, -Math.pow(t, 2.1) * 4.4 + Math.abs(nz) * 0.42);  // 下垂 + 中脉折起
        p.setX(i, x - Math.pow(t, 3) * 0.6);
        c.copy(cBase).lerp(cTip, t * 0.85 + 0.1).multiplyScalar(0.85 + 0.3 * (1 - Math.abs(z)));
        cols[i * 3] = c.r; cols[i * 3 + 1] = c.g; cols[i * 3 + 2] = c.b;
      }
      g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
      g.computeVertexNormals();
      return g;
    }
    const FROND_GEO = frondGeometry();
    const FROND_MAT = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.82, side: THREE.DoubleSide });
    const COCO_MAT = new THREE.MeshStandardMaterial({ color: srgb(0x6b4a2c), roughness: 0.7 });

    function makePalm(h, bend, tilt) {
      const grp = new THREE.Group();
      const tg = new THREE.CylinderGeometry(0.24, 0.62, h, 9, 16, true);
      tg.translate(0, h / 2, 0);
      const p = tg.attributes.position;
      const cols = new Float32Array(p.count * 3);
      const c1 = srgb(0x8c7250), c2 = srgb(0xbda683), c = new THREE.Color();
      for (let i = 0; i < p.count; i++) {
        const y = p.getY(i), t = y / h;
        p.setX(i, p.getX(i) + bend * t * t * h * 0.22);
        p.setZ(i, p.getZ(i) + Math.sin(t * 5.5) * 0.09);
        c.copy(c1).lerp(c2, 0.5 + 0.45 * Math.sin(t * 34)).multiplyScalar(0.86 + 0.28 * vnoise(t * 30, i * 0.1));
        cols[i * 3] = c.r; cols[i * 3 + 1] = c.g; cols[i * 3 + 2] = c.b;
      }
      tg.setAttribute('color', new THREE.BufferAttribute(cols, 3));
      tg.computeVertexNormals();
      const trunk = new THREE.Mesh(tg, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 }));
      trunk.castShadow = true; trunk.receiveShadow = true;
      grp.add(trunk);

      // 树冠整体摆动，所以叶片/椰果可以先烘成两个网格（每棵树 15 → 3 个 draw call）
      const crown = new THREE.Group();
      crown.position.set(bend * h * 0.22, h, 0);
      const n = 9, _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3();
      const frondGeos = [];
      for (let i = 0; i < n; i++) {
        _e.set(0, (i / n) * Math.PI * 2 + rr(-0.14, 0.14), rr(0.10, 0.46));
        const k = rr(0.82, 1.12);
        frondGeos.push(FROND_GEO.clone().applyMatrix4(
          new THREE.Matrix4().compose(_p.set(0, 0, 0), _q.setFromEuler(_e), _s.setScalar(k))));
      }
      const fronds = new THREE.Mesh(mergeGeometries(frondGeos), FROND_MAT);
      fronds.castShadow = true; crown.add(fronds);
      const cocoGeos = [];
      for (let i = 0; i < 5; i++)
        cocoGeos.push(new THREE.SphereGeometry(0.30, 8, 6).translate(rr(-0.5, 0.5), rr(-0.9, -0.35), rr(-0.5, 0.5)));
      const cocos = new THREE.Mesh(mergeGeometries(cocoGeos), COCO_MAT);
      cocos.castShadow = true; crown.add(cocos);
      grp.add(crown);
      grp.rotation.z = tilt;
      grp.userData = { crown, phase: rr(0, 6.28), sway: rr(0.7, 1.25) };
      return grp;
    }

    const palms = [];
    function plantPalm(x, z, scale = 1) {
      const t = makePalm(rr(9, 15) * scale, rr(-0.5, 0.5), rr(-0.16, 0.16));
      t.position.set(x, terrainHeight(x, z) - 0.3, z);
      t.rotation.y = rr(0, 6.28);
      t.scale.setScalar(scale);
      scene.add(t); palms.push(t);
    }
    let planted = 0;
    for (let i = 0; i < 900 && planted < 44; i++) {
      const a = rr(0, Math.PI * 2), r = coastRadius(a) * rr(0.42, 1.0);
      const x = Math.cos(a) * r, z = Math.sin(a) * r, h = terrainHeight(x, z);
      if (h < 1.4 || h > 13) continue;
      plantPalm(x, z, rr(0.8, 1.15)); planted++;
    }
    // 第 4 镜的前景椰林：手工点位，正好把海面和邮轮框在中间
    for (const [x, z, s] of [[75.8, 6.1, 1.22], [86.2, 8.0, 1.12], [91.5, 24.7, 1.18], [69, -4, 1.05], [96, 12, 0.95]])
      plantPalm(x, z, s);

    const bushMat = new THREE.MeshStandardMaterial({ color: srgb(0x3f6d31), roughness: 0.95, flatShading: true });
    const rockMat = new THREE.MeshStandardMaterial({ color: srgb(0x8b8578), roughness: 1.0, flatShading: true });
    for (let i = 0; i < 150; i++) {
      const a = rr(0, Math.PI * 2), r = coastRadius(a) * rr(0.25, 1.05);
      const x = Math.cos(a) * r, z = Math.sin(a) * r, h = terrainHeight(x, z);
      if (h < 0.8) continue;
      const isRock = h > 9 ? rnd() < 0.5 : rnd() < 0.18;
      const m = new THREE.Mesh(
        isRock ? new THREE.DodecahedronGeometry(rr(0.9, 3.4), 0) : new THREE.IcosahedronGeometry(rr(1.0, 2.6), 0),
        isRock ? rockMat : bushMat
      );
      m.position.set(x, h + (isRock ? -0.3 : 0.4), z);
      m.rotation.set(rr(0, 3), rr(0, 3), rr(0, 3));
      m.scale.set(rr(0.8, 1.4), rr(0.5, 0.95), rr(0.8, 1.4));
      m.castShadow = true; m.receiveShadow = true;
      scene.add(m);
    }

    /* ---------- 度假细节：水上屋 + 栈桥 + 遮阳伞 ---------- */
    /* 本段完全不消费全局 rr()/rnd()（只用局部 rsRnd），段末补掉与旧版等量的 28 次
       rnd()，保证后面的邮轮细节 / 摩托艇 / 海鸟位置与原版逐帧一致。            */
    const rsRnd = (() => { let s = 987654321; return () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; }; })();
    const rsr = (a, b) => a + (b - a) * rsRnd();
    const resortRoot = new THREE.Group();
    scene.add(resortRoot);

    /* --- 材质 --- */
    const woodMat     = new THREE.MeshStandardMaterial({ color: srgb(0xc59d6a), roughness: 0.82 });   // 柚木甲板
    const woodDarkMat = new THREE.MeshStandardMaterial({ color: srgb(0x8a6942), roughness: 0.90 });   // 结构 / 栏杆
    const pileMat     = new THREE.MeshStandardMaterial({ color: srgb(0x74593f), roughness: 0.96 });   // 木桩
    const pileWetMat  = new THREE.MeshStandardMaterial({ color: srgb(0x6c7a58), roughness: 0.62 });   // 水线苔痕
    const thatchMat   = new THREE.MeshStandardMaterial({ color: srgb(0xd2ab6d), roughness: 1.0, flatShading: true, side: THREE.DoubleSide });
    const thatchMat2  = new THREE.MeshStandardMaterial({ color: srgb(0xc39a5a), roughness: 1.0, flatShading: true, side: THREE.DoubleSide });
    const plasterMat  = new THREE.MeshStandardMaterial({ color: srgb(0xefe4cd), roughness: 0.88 });
    const rattanMat   = new THREE.MeshStandardMaterial({ color: srgb(0xd3ae74), roughness: 0.95 });
    const hutGlassMat = new THREE.MeshStandardMaterial({ color: srgb(0x9fd2e2), roughness: 0.06, metalness: 0.0,
                                                         transparent: true, opacity: 0.30, depthWrite: false, side: THREE.DoubleSide });
    const linenMat    = new THREE.MeshStandardMaterial({ color: srgb(0xfdf8ec), roughness: 0.92, side: THREE.DoubleSide });
    const cushionMat  = new THREE.MeshStandardMaterial({ color: srgb(0xf6ecd8), roughness: 0.94 });
    const lampBodyMat = new THREE.MeshStandardMaterial({ color: srgb(0x3a3833), roughness: 0.55, metalness: 0.45 });
    const lampGlowMat = new THREE.MeshStandardMaterial({ color: srgb(0xfff1cc), emissive: srgb(0xffc46a), emissiveIntensity: 2.4, roughness: 0.5 });
    const ropeMat     = new THREE.MeshStandardMaterial({ color: srgb(0xdccfae), roughness: 1.0 });

    /* --- 小工具：带缓存的盒 / 圆柱、任意端点斜撑 --- */
    const _rsGeo = new Map();
    function rsBox(parent, mat, w, h, d, x, y, z, ry = 0, rz = 0) {
      const k = 'b' + w + '_' + h + '_' + d;
      let g = _rsGeo.get(k); if (!g) { g = new THREE.BoxGeometry(w, h, d); _rsGeo.set(k, g); }
      const m = new THREE.Mesh(g, mat);
      m.position.set(x, y, z); m.rotation.y = ry; m.rotation.z = rz;
      m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
    }
    function rsCyl(parent, mat, rt, rb, h, seg, x, y, z, rx = 0, rz = 0) {
      const k = 'c' + rt + '_' + rb + '_' + h + '_' + seg;
      let g = _rsGeo.get(k); if (!g) { g = new THREE.CylinderGeometry(rt, rb, h, seg); _rsGeo.set(k, g); }
      const m = new THREE.Mesh(g, mat);
      m.position.set(x, y, z); m.rotation.set(rx, 0, rz);
      m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
    }
    const _rsUp = new THREE.Vector3(0, 1, 0), _rsD = new THREE.Vector3();
    function rsStrut(parent, mat, ax, ay, az, bx, by, bz, r) {
      _rsD.set(bx - ax, by - ay, bz - az);
      const len = _rsD.length(); if (len < 1e-4) return null;
      const m = new THREE.Mesh(new THREE.BoxGeometry(r * 2, len, r * 2), mat);
      m.position.set((ax + bx) / 2, (ay + by) / 2, (az + bz) / 2);
      m.quaternion.setFromUnitVectors(_rsUp, _rsD.normalize());
      m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
    }

    /* --- 四坡屋顶壳：底面矩形 + 顶部屋脊线（6 个三角面），层层叠出茅草束 --- */
    function rsHipRoofGeo(bw, bd, ridge, h) {
      const hw = bw / 2, hd = bd / 2, hr = Math.min(ridge, bw * 0.96) / 2;
      const A = [-hw, 0, -hd], B = [hw, 0, -hd], C = [hw, 0, hd], D = [-hw, 0, hd],
            E = [-hr, h, 0], F = [hr, h, 0];
      const tri = [A, F, B, A, E, F, C, E, D, C, F, E, D, E, A, B, F, C];
      const pos = new Float32Array(tri.length * 3);
      for (let i = 0; i < tri.length; i++) { pos[i * 3] = tri[i][0]; pos[i * 3 + 1] = tri[i][1]; pos[i * 3 + 2] = tri[i][2]; }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      g.computeVertexNormals();
      return g;
    }
    function rsThatch(parent, bw, bd, ridge, h, courses) {
      for (let k = 0; k < courses; k++) {
        const f = k / courses, lip = k === 0 ? 0 : 0.14;
        const w = lerp(bw / 2, ridge / 2, f) * 2 + lip * 2;
        const d = lerp(bd / 2, 0.10, f) * 2 + lip * 2;
        const m = new THREE.Mesh(rsHipRoofGeo(w, d, ridge, h * (1 - f)), k % 2 ? thatchMat2 : thatchMat);
        m.position.y = h * f; m.castShadow = true; m.receiveShadow = true; parent.add(m);
      }
    }

    /* --- 一段栏杆：立柱 + 上扶手 + 两道横档 --- */
    function rsRailing(parent, x0, z0, x1, z1, y, h, step = 1.5) {
      const dx = x1 - x0, dz = z1 - z0, len = Math.hypot(dx, dz);
      if (len < 0.35) return;
      const yaw = Math.atan2(dx, dz), n = Math.max(1, Math.round(len / step));
      for (let i = 0; i <= n; i++) {
        const t = i / n;
        rsBox(parent, woodDarkMat, 0.11, h, 0.11, x0 + dx * t, y + h / 2, z0 + dz * t, yaw);
      }
      const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
      rsBox(parent, woodMat, 0.17, 0.11, len, cx, y + h + 0.05, cz, yaw);
      rsBox(parent, woodDarkMat, 0.08, 0.07, len, cx, y + h * 0.60, cz, yaw);
      rsBox(parent, woodDarkMat, 0.08, 0.07, len, cx, y + h * 0.30, cz, yaw);
    }

    /* --- 走道板条：留缝的木板，用 InstancedMesh 保证只占 1 个 draw call --- */
    function rsPlanks(parent, x0, z0, x1, z1, y0, y1, w, pitch, pw, mat, t = 0.16) {
      const dx = x1 - x0, dz = z1 - z0, len = Math.hypot(dx, dz);
      const yaw = Math.atan2(dx, dz), n = Math.max(1, Math.round(len / pitch));
      const im = new THREE.InstancedMesh(new THREE.BoxGeometry(w, t, pw), mat, n + 1);
      const q = new THREE.Quaternion().setFromAxisAngle(_rsUp, yaw);
      const p = new THREE.Vector3(), s = new THREE.Vector3(1, 1, 1), m4 = new THREE.Matrix4();
      for (let i = 0; i <= n; i++) {
        const u = i / n;
        p.set(x0 + dx * u, lerp(y0, y1, u) - t / 2, z0 + dz * u);
        im.setMatrixAt(i, m4.compose(p, q, s));
      }
      im.instanceMatrix.needsUpdate = true;
      im.castShadow = true; im.receiveShadow = true; parent.add(im);
      return im;
    }

    /* --- 带弧垂的布面（遮阳篷） --- */
    function rsSagPlane(w, d, sag, seg = 4) {
      const g = new THREE.PlaneGeometry(w, d, seg, seg);
      g.rotateX(-Math.PI / 2);
      const p = g.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const u = p.getX(i) / (w / 2), v = p.getZ(i) / (d / 2);
        p.setY(i, -sag * (1 - u * u) * (1 - 0.35 * v * v));
      }
      p.needsUpdate = true; g.computeVertexNormals();
      return g;
    }

    /* --- 吊床：两点之间的下垂布带 --- */
    function rsHammock(parent, ax, ay, az, bx, by, bz, w, sag, mat) {
      const n = 10, verts = [];
      let px = -(bz - az), pz = (bx - ax);
      const pl = Math.hypot(px, pz) || 1; px /= pl; pz /= pl;
      const pt = (i, sgn) => {
        const t = i / n, s = Math.sin(Math.PI * t), ww = (0.22 + 0.78 * s) * w / 2;
        return [lerp(ax, bx, t) + px * sgn * ww, lerp(ay, by, t) - sag * s, lerp(az, bz, t) + pz * sgn * ww];
      };
      for (let i = 0; i < n; i++) {
        const a0 = pt(i, -1), a1 = pt(i, 1), b0 = pt(i + 1, -1), b1 = pt(i + 1, 1);
        verts.push(...a0, ...b0, ...b1, ...a0, ...b1, ...a1);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
      g.computeVertexNormals();
      const m = new THREE.Mesh(g, mat); m.castShadow = true; parent.add(m); return m;
    }

    /* --- 躺椅：木框 + 板条 + 斜靠背 + 坐垫，可选搭一条浴巾 --- */
    function rsLounger(towelHue) {
      const g = new THREE.Group();
      const L = 2.05, W = 0.80, SH = 0.42;
      for (const px of [-0.84, 0.70]) for (const pz of [-0.33, 0.33])
        rsBox(g, woodDarkMat, 0.08, SH, 0.08, px, SH / 2, pz);
      for (const pz of [-0.36, 0.36]) rsBox(g, woodDarkMat, L, 0.09, 0.09, -0.10, SH + 0.05, pz);
      for (let i = 0; i < 6; i++) rsBox(g, woodMat, 0.15, 0.05, W, -1.02 + i * 0.22, SH + 0.11, 0);
      const back = new THREE.Group(); back.position.set(0.30, SH + 0.08, 0); back.rotation.z = 0.80; g.add(back);
      for (const pz of [-0.36, 0.36]) rsBox(back, woodDarkMat, 1.10, 0.08, 0.09, 0.55, 0, pz);
      for (let i = 0; i < 4; i++) rsBox(back, woodMat, 0.15, 0.05, W, 0.22 + i * 0.24, 0.05, 0);
      rsBox(g, cushionMat, 1.26, 0.13, W - 0.06, -0.44, SH + 0.20, 0);
      rsBox(back, cushionMat, 0.98, 0.13, W - 0.06, 0.56, 0.12, 0);
      rsBox(back, linenMat, 0.30, 0.15, 0.52, 1.02, 0.20, 0);                      // 枕头
      if (towelHue !== undefined) {                                                 // 搭在侧边的浴巾
        const tw = new THREE.MeshStandardMaterial({ color: srgb(towelHue), roughness: 0.95, side: THREE.DoubleSide });
        rsBox(g, tw, 0.72, 0.05, 0.60, -0.30, SH + 0.28, 0.12);
        rsBox(g, tw, 0.66, 0.44, 0.05, -0.30, SH + 0.08, 0.40);
      }
      return g;
    }

    /* --- 小边桌 + 饮料 --- */
    function rsSideTable(parent, x, y, z) {
      rsCyl(parent, woodMat, 0.40, 0.40, 0.07, 12, x, y + 0.54, z);
      rsCyl(parent, woodDarkMat, 0.06, 0.08, 0.52, 8, x, y + 0.27, z);
      rsCyl(parent, woodDarkMat, 0.24, 0.26, 0.05, 10, x, y + 0.03, z);
      rsCyl(parent, hutGlassMat, 0.07, 0.055, 0.22, 8, x + 0.11, y + 0.68, z - 0.09);
      rsCyl(parent, linenMat, 0.062, 0.05, 0.14, 8, x + 0.11, y + 0.64, z - 0.09);
    }

    /* --- 皮划艇 --- */
    function rsKayak(parent, x, y, z, ry, hue) {
      const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = ry;
      const hull = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 6),
        new THREE.MeshStandardMaterial({ color: srgb(hue), roughness: 0.5 }));
      hull.scale.set(0.40, 0.28, 2.30); hull.castShadow = true; g.add(hull);
      rsBox(g, woodDarkMat, 0.46, 0.06, 1.00, 0, 0.215, 0);
      rsBox(g, woodDarkMat, 0.10, 0.09, 1.05, -0.24, 0.24, 0);
      rsBox(g, woodDarkMat, 0.10, 0.09, 1.05, 0.24, 0.24, 0);
      rsBox(g, woodDarkMat, 0.52, 0.09, 0.10, 0, 0.24, -0.52);
      rsBox(g, woodDarkMat, 0.52, 0.09, 0.10, 0, 0.24, 0.52);
      rsBox(g, woodDarkMat, 0.30, 0.05, 0.24, 0, 0.24, 1.15);
      rsCyl(g, woodMat, 0.035, 0.035, 2.4, 6, 0.34, 0.26, 0.2, 0.05, Math.PI / 2 - 0.12);
      parent.add(g); return g;
    }

    /* --- 灯笼：灯罩要露在外面才发得出光 --- */
    function rsLantern(parent, x, y, z, s = 1) {           // y = 灯罩底沿
      rsCyl(parent, lampBodyMat, 0.20 * s, 0.17 * s, 0.06 * s, 8, x, y - 0.02 * s, z);
      rsCyl(parent, lampGlowMat, 0.135 * s, 0.135 * s, 0.30 * s, 8, x, y + 0.16 * s, z);
      rsCyl(parent, lampBodyMat, 0.05 * s, 0.23 * s, 0.12 * s, 8, x, y + 0.37 * s, z);
      rsCyl(parent, lampBodyMat, 0.022 * s, 0.022 * s, 0.08 * s, 6, x, y + 0.46 * s, z);
    }

    /* ============ 水上屋 ============ */
    /* 本地坐标：+x 是朝海的晒台一侧，-x 是入口（栈桥接进来的一侧） */
    function overwaterHut(x, z, rot, opt = {}) {
      const g = new THREE.Group();
      const DY = 3.2, DW = 9.6, DD = 7.6, RW = 6.2, RD = 5.0, RX = -1.4, WH = 3.0;
      const hw = DW / 2, hd = DD / 2, rw = RW / 2, rd = RD / 2;
      const sc = opt.scale ?? 1;
      const botY = Math.max((terrainHeight(x, z) - 0.6) / sc, -9 / sc);

      /* 1 · 木桩 + 斜撑 + 水线苔痕（一直插到水面以下） */
      for (const [px, pz] of [[-hw + 0.7, -hd + 0.7], [-hw + 0.7, hd - 0.7], [0, -hd + 0.6],
                              [0, hd - 0.6], [hw - 0.7, -hd + 0.7], [hw - 0.7, hd - 0.7]]) {
        rsCyl(g, pileMat, 0.30, 0.34, DY - 0.40 - botY, 8, px, (DY - 0.40 + botY) / 2, pz);
        rsCyl(g, pileWetMat, 0.342, 0.342, 1.1 / sc, 8, px, -0.16 / sc, pz);
        const sx = px === 0 ? 1 : Math.sign(px), sz = Math.sign(pz);
        rsStrut(g, woodDarkMat, px, -0.5, pz, px - sx * 1.55, DY - 0.75, pz, 0.10);
        rsStrut(g, woodDarkMat, px, -0.5, pz, px, DY - 0.75, pz - sz * 1.55, 0.10);
      }

      /* 2 · 甲板：主梁 + 留缝板条 + 封边 */
      for (const bx of [-hw + 0.7, 0, hw - 0.7]) rsBox(g, woodDarkMat, 0.26, 0.32, DD + 0.2, bx, DY - 0.44, 0);
      for (const bz of [-hd + 0.7, hd - 0.7]) rsBox(g, woodDarkMat, DW + 0.2, 0.28, 0.24, 0, DY - 0.42, bz);
      for (let i = 0; ; i++) {
        const px = -hw + 0.28 + i * 0.52;
        if (px > hw - 0.22) break;
        rsBox(g, i % 6 === 2 ? woodDarkMat : woodMat, 0.43, 0.18, DD, px, DY - 0.09, 0);
      }
      rsBox(g, woodDarkMat, DW + 0.2, 0.26, 0.16, 0, DY - 0.13, -hd - 0.06);
      rsBox(g, woodDarkMat, DW + 0.2, 0.26, 0.16, 0, DY - 0.13, hd + 0.06);
      rsBox(g, woodDarkMat, 0.16, 0.26, DD + 0.3, -hw - 0.06, DY - 0.13, 0);
      rsBox(g, woodDarkMat, 0.16, 0.26, DD + 0.3, hw + 0.06, DY - 0.13, 0);

      /* 3 · 甲板栏杆（前沿留下水梯口、背面留门口） */
      const RH = 1.02;
      rsRailing(g, hw, -hd, hw, hd - 2.9, DY, RH);
      rsRailing(g, -hw + 0.2, -hd, hw, -hd, DY, RH);
      rsRailing(g, -hw + 0.2, hd, hw, hd, DY, RH);
      rsRailing(g, -hw, -hd + 0.2, -hw, -1.7, DY, RH);
      rsRailing(g, -hw, 1.7, -hw, hd - 0.2, DY, RH);

      /* 4 · 房间：藤编墙裙 + 玻璃窗 + 面海整面推拉门 */
      const sill = DY + 0.16;
      const wain = 1.15, gh = 1.32;
      rsBox(g, woodMat, RW + 0.4, 0.16, RD + 0.4, RX, DY + 0.08, 0);
      for (const cx of [RX - rw, RX + rw]) for (const cz of [-rd, rd])
        rsBox(g, woodDarkMat, 0.20, WH, 0.20, cx, sill + WH / 2, cz);
      rsBox(g, woodDarkMat, RW + 0.34, 0.22, 0.20, RX, sill + WH + 0.10, -rd);
      rsBox(g, woodDarkMat, RW + 0.34, 0.22, 0.20, RX, sill + WH + 0.10, rd);
      rsBox(g, woodDarkMat, 0.20, 0.22, RD, RX - rw, sill + WH + 0.10, 0);
      rsBox(g, woodDarkMat, 0.20, 0.22, RD, RX + rw, sill + WH + 0.10, 0);
      for (const sz of [-1, 1]) {
        rsBox(g, rattanMat, RW - 0.22, wain, 0.12, RX, sill + wain / 2, sz * rd);
        rsBox(g, woodDarkMat, RW - 0.10, 0.12, 0.22, RX, sill + wain + 0.06, sz * rd);
        rsBox(g, hutGlassMat, RW - 0.5, gh, 0.05, RX, sill + wain + 0.12 + gh / 2, sz * rd);
        for (const fx of [-1.5, 0, 1.5]) rsBox(g, woodDarkMat, 0.10, gh, 0.15, RX + fx, sill + wain + 0.12 + gh / 2, sz * rd);
        rsBox(g, woodMat, RW - 0.22, WH - wain - gh - 0.12, 0.12, RX, sill + (WH + wain + gh + 0.12) / 2, sz * rd);
      }
      rsBox(g, rattanMat, 0.13, wain, RD - 0.22, RX - rw, sill + wain / 2, 0);         // 背面墙裙
      rsBox(g, woodDarkMat, 0.22, 0.12, RD - 0.10, RX - rw, sill + wain + 0.06, 0);
      rsBox(g, plasterMat, 0.13, WH - wain - 0.18, RD - 0.22, RX - rw, sill + wain + 0.12 + (WH - wain - 0.18) / 2, 0);
      for (const wz of [-1.62, 1.62]) {                                                 // 背面小窗 + 木框 + 小雨檐
        rsBox(g, hutGlassMat, 0.05, 0.92, 0.86, RX - rw - 0.05, sill + wain + 0.74, wz);
        rsBox(g, woodDarkMat, 0.10, 1.04, 0.10, RX - rw - 0.08, sill + wain + 0.74, wz - 0.48);
        rsBox(g, woodDarkMat, 0.10, 1.04, 0.10, RX - rw - 0.08, sill + wain + 0.74, wz + 0.48);
        rsBox(g, woodDarkMat, 0.10, 0.10, 1.06, RX - rw - 0.08, sill + wain + 1.26, wz);
        rsBox(g, woodMat, 0.13, 0.10, 1.20, RX - rw - 0.14, sill + wain + 1.38, wz);
      }
      rsBox(g, woodDarkMat, 0.10, 2.10, 1.10, RX - rw - 0.10, sill + 1.05, 0);          // 门扇
      rsBox(g, woodMat, 0.16, 0.14, 1.40, RX - rw - 0.14, sill + 2.20, 0);              // 门楣
      rsBox(g, hutGlassMat, 0.05, WH - 0.52, RD - 0.5, RX + rw, sill + 0.12 + (WH - 0.52) / 2, 0);
      for (const fz of [-rd + 0.26, -0.62, 0.62, rd - 0.26])
        rsBox(g, woodDarkMat, 0.15, WH - 0.40, 0.10, RX + rw, sill + (WH - 0.40) / 2, fz);
      rsBox(g, woodDarkMat, 0.24, 0.14, RD, RX + rw, sill + 0.07, 0);
      rsBox(g, woodDarkMat, 0.24, 0.12, RD, RX + rw, sill + WH - 0.34, 0);

      /* 5 · 茅草顶：多层草束 + 出檐 + 屋脊 + 脊端交叉杆 */
      const roof = new THREE.Group(); roof.position.set(RX, sill + WH + 0.21, 0); g.add(roof);
      const RBW = RW + 2.9, RBD = RD + 2.7, RIDGE = 4.3, RHH = 3.0;
      rsThatch(roof, RBW, RBD, RIDGE, RHH, 7);
      rsBox(roof, woodDarkMat, RBW + 0.2, 0.18, 0.16, 0, -0.03, -RBD / 2);
      rsBox(roof, woodDarkMat, RBW + 0.2, 0.18, 0.16, 0, -0.03, RBD / 2);
      rsBox(roof, woodDarkMat, 0.16, 0.18, RBD + 0.2, -RBW / 2, -0.03, 0);
      rsBox(roof, woodDarkMat, 0.16, 0.18, RBD + 0.2, RBW / 2, -0.03, 0);
      rsCyl(roof, thatchMat2, 0.20, 0.20, RIDGE + 0.6, 6, 0, RHH + 0.02, 0, 0, Math.PI / 2);
      for (const ex of [-RIDGE / 2 - 0.1, RIDGE / 2 + 0.1]) {
        rsCyl(roof, woodDarkMat, 0.055, 0.055, 1.5, 5, ex, RHH + 0.30, 0, 0.55, 0);
        rsCyl(roof, woodDarkMat, 0.055, 0.055, 1.5, 5, ex, RHH + 0.30, 0, -0.55, 0);
      }

      /* 6 · 下水梯（一直伸到水面以下） */
      const lz = hd - 1.5;
      rsStrut(g, woodDarkMat, hw - 0.15, DY - 0.15, lz - 0.46, hw + 1.5, -1.7, lz - 0.46, 0.085);
      rsStrut(g, woodDarkMat, hw - 0.15, DY - 0.15, lz + 0.46, hw + 1.5, -1.7, lz + 0.46, 0.085);
      for (let i = 0; i < 6; i++) {
        const t = 0.07 + i * 0.176;
        rsCyl(g, woodMat, 0.075, 0.075, 1.02, 6,
          lerp(hw - 0.15, hw + 1.5, t), lerp(DY - 0.15, -1.7, t), lz, Math.PI / 2, 0);
      }
      for (const s of [-1, 1]) {
        rsBox(g, woodDarkMat, 0.09, 1.05, 0.09, hw - 0.18, DY + 0.52, lz + s * 0.5);
        rsCyl(g, woodMat, 0.06, 0.06, 0.55, 6, hw + 0.05, DY + 1.02, lz + s * 0.5, 0, 1.15);
      }

      /* 7 · 晒台家具 */
      const L1 = rsLounger(opt.towel);
      L1.position.set(hw - 1.5, DY, -1.5); L1.rotation.y = -Math.PI / 2 + 0.10; g.add(L1);
      rsSideTable(g, hw - 2.25, DY, 0.15);
      if (opt.lounger2) {
        const L2 = rsLounger();
        L2.position.set(hw - 1.5, DY, 1.75); L2.rotation.y = -Math.PI / 2 - 0.08; g.add(L2);
      }
      if (opt.hammock) {
        const hMat = new THREE.MeshStandardMaterial({ color: srgb(opt.towel ?? 0xe8593f), roughness: 0.95, side: THREE.DoubleSide });
        for (const s of [-1, 1]) {
          rsBox(g, woodDarkMat, 0.14, 2.2, 0.14, hw - 1.0, DY + 1.10, s * (hd - 0.9));
          rsStrut(g, ropeMat, hw - 1.0, DY + 2.16, s * (hd - 0.9), hw - 1.0, DY + 1.75, s * (hd - 1.5), 0.032);
        }
        rsHammock(g, hw - 1.0, DY + 1.75, -hd + 1.5, hw - 1.0, DY + 1.75, hd - 1.5, 1.30, 0.62, hMat);
        rsBox(g, linenMat, 0.55, 0.10, 0.42, hw - 1.0, DY + 1.30, -0.5);
      }
      if (opt.awning) {
        const ax = hw - 0.55;
        for (const az of [-2.5, 2.5]) rsBox(g, woodDarkMat, 0.12, 2.30, 0.12, ax, DY + 1.15, az);
        const sh = new THREE.Mesh(rsSagPlane(3.6, 5.5, 0.34, 5), linenMat);
        sh.position.set(ax - 1.72, DY + 2.42, 0); sh.rotation.z = -0.17;
        sh.castShadow = true; g.add(sh);
        rsBox(g, woodDarkMat, 0.10, 0.10, 5.6, ax, DY + 2.30, 0);
      }
      if (opt.kayak) rsKayak(g, hw + 2.4, 0.16 / sc, -hd + 2.6, 0.30, 0xe6dcc6);

      /* 8 · 露台夜灯 */
      for (const lz2 of [-hd + 0.35, hd - 0.35]) rsLantern(g, hw - 0.3, DY + RH + 0.12, lz2, 0.62);

      g.position.set(x, 0, z); g.rotation.y = rot; g.scale.setScalar(sc);
      resortRoot.add(g);
      return g;
    }
    overwaterHut(-92, 78, -3.116, { awning: true, lounger2: true, towel: 0xe8593f });   // 支线尽头
    overwaterHut(-118, 58, -2.685, { scale: 0.9, hammock: true, kayak: true, towel: 0x2f9bb5 }); // 独栋，只能划船去
    overwaterHut(-72, 96, -2.0714, { lounger2: true });                                  // 主栈桥尽头

    /* ============ 栈桥：沙滩 → 分岔平台 → 两栋水屋 ============ */
    {
      /* 一段走道：大梁 + 留缝木板 + 双侧扶手栏杆 + 木桩 + 灯柱 */
      function jetty(x0, z0, x1, z1, y0, y1, o) {
        const g = new THREE.Group(); resortRoot.add(g);
        const dx = x1 - x0, dz = z1 - z0, len = Math.hypot(dx, dz);
        const ux = dx / len, uz = dz / len, px = uz, pz = -ux;
        const half = o.w / 2;
        const at = (t, off) => [x0 + dx * t + px * off, z0 + dz * t + pz * off];
        for (const off of [-half + 0.35, half - 0.35]) {
          const a = at(0, off), b = at(1, off);
          rsStrut(g, woodDarkMat, a[0], y0 - 0.34, a[1], b[0], y1 - 0.34, b[1], 0.15);
        }
        const pitch = o.pitch ?? 0.46;
        rsPlanks(g, x0, z0, x1, z1, y0, y1, o.w, pitch, pitch - 0.11, woodMat);
        for (const s of [-1, 1]) {
          const a = at(0.01, s * (half - 0.14)), b = at(0.99, s * (half - 0.14));
          rsRailing(g, a[0], a[1], b[0], b[1], y0 - 0.02, 1.0, o.railStep ?? 2.2);
        }
        const stations = Math.max(2, Math.round(len / (o.pileStep ?? 6.5)));
        for (let i = 0; i <= stations; i++) {
          const t = i / stations, y = lerp(y0, y1, t);
          for (const s of [-1, 1]) {
            const c = at(t, s * (half - 0.25));
            const bot = Math.max(terrainHeight(c[0], c[1]) - 0.6, -9.5);
            if (y - 0.4 - bot < 0.5) continue;
            rsCyl(g, pileMat, 0.24, 0.28, y - 0.4 - bot, 8, c[0], (y - 0.4 + bot) / 2, c[1]);
            rsCyl(g, pileWetMat, 0.282, 0.282, 1.0, 8, c[0], -0.16, c[1]);
          }
          const a = at(t, -(half - 0.25)), b = at(t, half - 0.25);
          const braceY = Math.min(y - 1.7, 0.35);
          if (terrainHeight(a[0], a[1]) < braceY - 0.4) rsStrut(g, woodDarkMat, a[0], braceY, a[1], b[0], braceY, b[1], 0.09);
        }
        if (o.lamps) {
          const lampN = Math.max(1, Math.round(len / 11.5));
          for (let i = 1; i <= lampN; i++) {
            const t = (i - 0.15) / (lampN + 0.3), y = lerp(y0, y1, t), s = i % 2 ? 1 : -1;
            const c = at(t, s * (half - 0.12));
            rsBox(g, woodDarkMat, 0.15, 2.05, 0.15, c[0], y + 1.02, c[1]);
            rsLantern(g, c[0], y + 2.06, c[1], 1.0);
          }
        }
      }

      const A = [-45.6, 47.8];                 // 沙滩端（延用 (-52,56)→(-80,92) 那条线，往岸上多铺 6m）
      const E = [-69.69, 91.79];               // 主栈桥尽头 = 3 号水屋的入口边
      const ux = (E[0] - A[0]) / Math.hypot(E[0] - A[0], E[1] - A[1]);
      const uz = (E[1] - A[1]) / Math.hypot(E[0] - A[0], E[1] - A[1]);
      const J = [-62.46, 78.59];               // 分岔平台中心（t = 0.70）
      const yA = 2.55, yJ = 3.14, yE = 3.2;

      jetty(A[0], A[1], J[0] - ux * 2.9, J[1] - uz * 2.9, yA, yJ, { w: 3.6, lamps: true, pileStep: 6.0 });
      jetty(J[0] + ux * 2.9, J[1] + uz * 2.9, E[0], E[1], yJ, yE, { w: 3.6, pileStep: 5.5 });

      /* 沙滩端：三级下沉台阶 + 一对灯柱 */
      for (let i = 1; i <= 3; i++) {
        const sx = A[0] - ux * i * 0.85, sz = A[1] - uz * i * 0.85, yaw = Math.atan2(ux, uz);
        rsBox(resortRoot, woodMat, 3.3, 0.17, 0.68, sx, yA - i * 0.30, sz, yaw);
        rsBox(resortRoot, woodDarkMat, 0.16, 0.75, 0.68, sx - uz * 1.55, yA - i * 0.30 - 0.42, sz + ux * 1.55, yaw);
        rsBox(resortRoot, woodDarkMat, 0.16, 0.75, 0.68, sx + uz * 1.55, yA - i * 0.30 - 0.42, sz - ux * 1.55, yaw);
      }
      for (const s of [-1, 1]) {
        const lx = A[0] + ux * 0.4 + uz * s * 1.95, lz2 = A[1] + uz * 0.4 - ux * s * 1.95;
        rsBox(resortRoot, woodDarkMat, 0.17, 2.9, 0.17, lx, yA + 1.05, lz2);
        rsLantern(resortRoot, lx, yA + 2.52, lz2, 1.15);
      }

      /* 分岔平台：留一条支线通向 1 号水屋，带系缆桩 + 指示牌 + 灯 */
      {
        const g = new THREE.Group(); g.position.set(J[0], 0, J[1]); g.rotation.y = Math.atan2(ux, uz); resortRoot.add(g);
        const PW = 5.6, PD = 5.8, py = yJ;
        for (const bx of [-PW / 2 + 0.6, 0, PW / 2 - 0.6]) rsBox(g, woodDarkMat, 0.26, 0.32, PD, bx, py - 0.44, 0);
        for (let i = 0; ; i++) {
          const lx = -PW / 2 + 0.26 + i * 0.52;
          if (lx > PW / 2 - 0.2) break;
          rsBox(g, i % 5 === 1 ? woodDarkMat : woodMat, 0.43, 0.17, PD, lx, py - 0.085, 0);
        }
        rsBox(g, woodDarkMat, PW + 0.2, 0.24, 0.16, 0, py - 0.13, -PD / 2 - 0.06);
        rsBox(g, woodDarkMat, PW + 0.2, 0.24, 0.16, 0, py - 0.13, PD / 2 + 0.06);
        rsRailing(g, PW / 2, -PD / 2 + 0.1, PW / 2, PD / 2 - 0.1, py, 1.0);
        rsRailing(g, -PW / 2, -PD / 2 + 0.1, -PW / 2, -1.5, py, 1.0);
        rsRailing(g, -PW / 2, 1.5, -PW / 2, PD / 2 - 0.1, py, 1.0);
        for (const [qx, qz] of [[-PW / 2 + 0.7, -PD / 2 + 0.7], [-PW / 2 + 0.7, PD / 2 - 0.7],
                                [PW / 2 - 0.7, -PD / 2 + 0.7], [PW / 2 - 0.7, PD / 2 - 0.7]]) {
          rsCyl(g, pileMat, 0.26, 0.30, py - 0.4 + 9.5, 8, qx, (py - 0.4 - 9.5) / 2, qz);
          rsCyl(g, pileWetMat, 0.302, 0.302, 1.0, 8, qx, -0.16, qz);
        }
        for (const qz of [-2.0, 2.0]) {                                     // 系缆桩
          rsCyl(g, woodDarkMat, 0.19, 0.22, 1.05, 8, PW / 2 - 0.42, py + 0.52, qz);
          rsCyl(g, woodDarkMat, 0.26, 0.26, 0.14, 8, PW / 2 - 0.42, py + 1.02, qz);
          rsCyl(g, ropeMat, 0.245, 0.245, 0.12, 8, PW / 2 - 0.42, py + 0.72, qz);
        }
        rsBox(g, woodDarkMat, 0.13, 2.6, 0.13, -PW / 2 + 0.45, py + 1.30, PD / 2 - 0.5);   // 指示牌
        rsBox(g, woodMat, 0.07, 0.40, 1.5, -PW / 2 + 0.40, py + 2.28, PD / 2 - 1.15);
        rsBox(g, woodMat, 0.07, 0.32, 1.2, -PW / 2 + 0.40, py + 1.80, PD / 2 - 1.02);
        rsLantern(g, -PW / 2 + 0.45, py + 2.62, PD / 2 - 0.5, 1.05);
      }

      /* 支线：分岔平台 → 1 号水屋 */
      jetty(J[0] - 2.8 * uz, J[1] + 2.8 * ux, -87.20, 77.88, yJ, 3.2,
            { w: 2.9, pitch: 0.44, railStep: 2.1, pileStep: 5.5 });
    }

    /* ============ 沙滩遮阳伞 ============ */
    /* 分瓣伞面：gores 瓣，parity 决定这份几何体取哪几瓣（做出双色条纹 + 波浪伞边） */
    function rsParasolGeo(radius, gores, rise, scallop, parity) {
      const uSeg = 4, rSeg = 4, pos = [], step = Math.PI * 2 / gores;
      const P = (gi, u, t) => {
        const a = (gi + u) * step, b = Math.sin(Math.PI * u);
        const R = radius * (1 - scallop * b) * t;
        return [Math.cos(a) * R, rise * (1 - Math.pow(t, 1.55)) + 0.11 * b * t * t, Math.sin(a) * R];
      };
      for (let gi = 0; gi < gores; gi++) {
        if (gi % 2 !== parity) continue;
        for (let ui = 0; ui < uSeg; ui++) {
          const u0 = ui / uSeg, u1 = (ui + 1) / uSeg;
          for (let ti = 0; ti < rSeg; ti++) {
            const t0 = Math.pow(ti / rSeg, 0.85), t1 = Math.pow((ti + 1) / rSeg, 0.85);
            const a = P(gi, u0, t0), b = P(gi, u1, t0), c = P(gi, u1, t1), d = P(gi, u0, t1);
            if (ti === 0) pos.push(...a, ...c, ...d);
            else pos.push(...a, ...b, ...c, ...a, ...c, ...d);
          }
        }
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.computeVertexNormals();
      return g;
    }

    /* 一套沙滩伞组（原点在伞杆脚下，局部 -x 朝海）：伞 + 两把躺椅 + 边桌 + 沙滩篮 */
    function parasolSet(hue) {
      const g = new THREE.Group();
      const fabA = new THREE.MeshStandardMaterial({ color: srgb(hue), roughness: 0.88, side: THREE.DoubleSide });
      const fabB = new THREE.MeshStandardMaterial({ color: srgb(0xfdf6e6), roughness: 0.88, side: THREE.DoubleSide });

      /* 伞：杆 + 分瓣布面 + 伞骨 + 撑杆 + 伞尖 */
      const um = new THREE.Group(); um.rotation.z = 0.055; um.rotation.x = -0.035; g.add(um);
      rsCyl(um, woodMat, 0.075, 0.095, 3.62, 8, 0, 1.75, 0);
      const R = 2.75, RISE = 1.05, TOP = 2.52;
      for (const [p, m] of [[0, fabA], [1, fabB]]) {
        const c = new THREE.Mesh(rsParasolGeo(R, 8, RISE, 0.10, p), m);
        c.position.y = TOP; c.castShadow = true; um.add(c);
      }
      for (let i = 0; i < 8; i++) {
        const a = i * Math.PI / 4;
        rsStrut(um, woodDarkMat, 0, TOP + RISE - 0.10, 0, Math.cos(a) * R * 0.98, TOP - 0.04, Math.sin(a) * R * 0.98, 0.032);
        rsStrut(um, woodDarkMat, Math.cos(a) * 0.11, TOP + 0.40, Math.sin(a) * 0.11,
                Math.cos(a) * R * 0.52, TOP + RISE * 0.42, Math.sin(a) * R * 0.52, 0.026);
      }
      rsCyl(um, woodDarkMat, 0.12, 0.14, 0.20, 8, 0, TOP + 0.32, 0);
      rsCyl(um, woodDarkMat, 0.03, 0.09, 0.42, 8, 0, TOP + RISE + 0.18, 0);
      rsCyl(um, woodMat, 0.075, 0.075, 0.18, 8, 0, TOP + RISE + 0.46, 0);

      /* 伞下：两把躺椅 + 小边桌 + 浴巾 + 沙滩小物 */
      const L1 = rsLounger(hue); L1.position.set(-0.25, -0.05, -1.18); L1.rotation.y = 0.05; g.add(L1);
      const L2 = rsLounger();    L2.position.set(-0.25, -0.05, 1.18);  L2.rotation.y = -0.05; g.add(L2);
      rsSideTable(g, 0.95, -0.03, 0);
      rsCyl(g, rattanMat, 0.30, 0.24, 0.46, 10, 1.45, 0.20, -1.60);    // 藤编沙滩篮
      rsCyl(g, woodDarkMat, 0.31, 0.31, 0.06, 10, 1.45, 0.45, -1.60);
      return g;
    }

    function parasol(x, z, hue) {
      const g = parasolSet(hue);
      const d = Math.hypot(x, z), ux = x / d, uz = z / d;              // 朝海方向
      g.position.set(x, terrainHeight(x, z), z);
      g.rotation.y = Math.atan2(uz, -ux) + rsr(-0.13, 0.13);           // 头朝岸、脚朝海
      resortRoot.add(g);
    }
    parasol(72, 56.5, 0xe8593f); parasol(64.5, 62.5, 0xf2c14e); parasol(56.5, 68, 0xe8593f); parasol(-19, 69, 0xf2c14e);

    // 旧版这一段共取了 28 次全局随机数；补齐，保证后面的邮轮细节/摩托艇/海鸟构图完全不变
    for (let i = 0; i < 28; i++) rnd();

    /* ============================================================
       7 · 大邮轮
       ============================================================ */
    /* —— 线型参数（局部坐标：+x 船首，y = 0 水线）——
       水线长 200 / 型宽 30 / 吃水 9 / 主甲板舷侧 19，水面泡沫椭圆 uShipSize 仍用 (106, 21) */
    const SHIP_L = 200, SHIP_B = 30, SHIP_DRAFT = 9, SHIP_SHEER = 19;
    const SHIP_HL = SHIP_L / 2, SHIP_HB = SHIP_B / 2;
    const SHIP_ANISO = Math.min(8, renderer.capabilities.getMaxAnisotropy());

    // 甲板半宽：艏部收得快（细长入水角），艉部只收一点（宽方艉）
    const shipDeckHalf = (u) =>
      SHIP_HB * (1 - Math.pow(smoothstep(0.22, 1.0, u), 1.45) * 0.955)
              * (1 - smoothstep(-0.68, -1.0, u) * 0.32);
    // 舷弧：上层建筑底下保持平（y=19），艏楼从 u=0.64 起明显上翘，艉部末端微翘
    const shipSheerY = (u) =>
      SHIP_SHEER + 6.6 * Math.pow(smoothstep(0.64, 1.0, u), 1.35)
                 + 1.6 * Math.pow(smoothstep(-0.945, -1.0, u), 1.2);
    // 龙骨线：艏艉上翘
    const shipKeelY = (u) =>
      -SHIP_DRAFT + 5.8 * smoothstep(0.58, 1.0, u) + 4.4 * smoothstep(0.60, 1.0, -u);
    // 前倾飞剪艏（越高越往前）+ 艉部甲板外挑
    const shipStemShift = (u, y) =>
      smoothstep(0.40, 1.0, u) * y * 0.44 - smoothstep(-0.60, -1.0, u) * y * 0.10;
    // 站位半宽：平底 → 舭部折角 → 直立舷侧 → 艏部外飘（近艏柱迅速收细）
    function shipHalfW(u, y, level) {
      if (level === 0) return 0;
      const bilge = clamp(0.34 + (y - shipKeelY(u)) * 0.185, 0, 1);
      const flare = smoothstep(0.34, 1.0, u) * clamp((y + 3) / 16, 0, 1) * 3.0
                  * (1 - smoothstep(0.74, 1.0, u) * 0.92);
      return Math.max(0.06, shipDeckHalf(u) * bilge + flare);
    }
    // 某个 x 处上层建筑可用的半宽（收进 inset 留出散步甲板）
    const shipTierHalf = (x, halfW, inset) =>
      Math.min(halfW, Math.max(1.2, shipDeckHalf(clamp(x / SHIP_HL, -1, 1)) - inset));

    /* —— 上层建筑舷侧贴图：阳台带 / 连续观景玻璃带 —— */
    const _shipTexCache = new Map();
    function windowTexture(cols, rows, opts) {
      opts = opts || {};
      const kind = opts.kind || 'balcony';
      const key = cols + '|' + rows + '|' + kind;
      if (_shipTexCache.has(key)) {
        const t = _shipTexCache.get(key).clone();
        t.needsUpdate = true; return t;
      }
      const W = 2048, H = Math.max(128, rows * 128);
      const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
      const g = cv.getContext('2d');
      const cw = W / cols, ch = H / rows;

      g.fillStyle = '#f3f6fa'; g.fillRect(0, 0, W, H);              // 白色舱壁

      for (let r = 0; r < rows; r++) {
        const y0 = r * ch;
        // 甲板板厚 + 下缘阴影线
        g.fillStyle = '#fdfefe'; g.fillRect(0, y0, W, ch * 0.13);
        g.fillStyle = 'rgba(112,134,154,.34)'; g.fillRect(0, y0 + ch * 0.13, W, ch * 0.03);

        if (kind === 'balcony') {
          g.fillStyle = '#15273b'; g.fillRect(0, y0 + ch * 0.17, W, ch * 0.66);   // 阳台凹槽
          for (let c = 0; c < cols; c++) {
            const x = c * cw;
            const gy = y0 + ch * 0.225, gh = ch * 0.44;
            const grd = g.createLinearGradient(0, gy, 0, gy + gh);
            grd.addColorStop(0.00, '#5d92b8');
            grd.addColorStop(0.42, '#1d3f5b');
            grd.addColorStop(1.00, '#122739');
            g.fillStyle = grd;
            g.fillRect(x + cw * 0.15, gy, cw * 0.68, gh);            // 落地窗 / 舱门
            g.fillStyle = 'rgba(178,208,230,.58)';                    // 玻璃栏板
            g.fillRect(x + cw * 0.06, y0 + ch * 0.595, cw * 0.88, ch * 0.20);
            g.fillStyle = 'rgba(255,255,255,.92)';                    // 栏板扶手
            g.fillRect(x + cw * 0.06, y0 + ch * 0.575, cw * 0.88, ch * 0.035);
            const fx = x - cw * 0.05;                                 // 隔板
            g.fillStyle = '#e9eff5';
            g.fillRect(fx, y0 + ch * 0.185, cw * 0.10, ch * 0.63);
            if (fx < 0) g.fillRect(fx + W, y0 + ch * 0.185, cw * 0.10, ch * 0.63);
          }
          g.fillStyle = 'rgba(26,40,56,.40)'; g.fillRect(0, y0 + ch * 0.83, W, ch * 0.05);
        } else {
          // 连续观景玻璃带
          const gy = y0 + ch * 0.19, gh = ch * 0.64;
          const grd = g.createLinearGradient(0, gy, 0, gy + gh);
          grd.addColorStop(0.00, '#7fb2d4');
          grd.addColorStop(0.40, '#204a6b');
          grd.addColorStop(1.00, '#142c42');
          g.fillStyle = grd; g.fillRect(0, gy, W, gh);
          g.fillStyle = 'rgba(238,244,249,.85)';
          for (let c = 0; c < cols; c++) g.fillRect(c * cw + cw * 0.44, gy, cw * 0.11, gh);
          g.fillStyle = 'rgba(255,255,255,.55)'; g.fillRect(0, gy, W, gh * 0.06);
          g.fillStyle = 'rgba(26,40,56,.35)'; g.fillRect(0, y0 + ch * 0.83, W, ch * 0.05);
        }
      }
      const t = new THREE.CanvasTexture(cv);
      t.colorSpace = THREE.SRGBColorSpace;
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.anisotropy = SHIP_ANISO;
      _shipTexCache.set(key, t);
      return t;
    }

    /* —— 船体外板贴图：防污漆 / 吃水红带 / 深蓝船身 / 白色舱室窗排 —— */
    function shipHullTexture() {
      const W = 2048, H = 384, Y0 = -13, Y1 = 27, X0 = -114, X1 = 114;
      const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
      const g = cv.getContext('2d');
      const py = (y) => (1 - (y - Y0) / (Y1 - Y0)) * H;
      const px = (x) => (x - X0) / (X1 - X0) * W;

      // 深蓝/白的分色线：随舷弧向艏部扬起，艉部微扬
      const navyTop = (x) => {
        const u = x / SHIP_HL;
        return 9.2 + 4.6 * Math.pow(smoothstep(0.26, 1.0, u), 1.25)
                   + 1.2 * Math.pow(smoothstep(-0.50, -1.0, u), 1.5);
      };
      const navyPath = () => {
        g.beginPath(); g.moveTo(0, py(navyTop(X0)));
        for (let x = X0; x <= X1; x += 2) g.lineTo(px(x), py(navyTop(x)));
        g.lineTo(W, py(1.0)); g.lineTo(0, py(1.0)); g.closePath();
      };

      g.fillStyle = '#f2f6fa'; g.fillRect(0, 0, W, H);                              // 白色上层船体
      g.fillStyle = '#0d2b4e'; navyPath(); g.fill();                                // 深蓝船身
      g.fillStyle = '#c0392b'; g.fillRect(0, py(1.0), W, py(-2.3) - py(1.0));       // 吃水红带
      g.fillStyle = '#6d2622'; g.fillRect(0, py(-2.3), W, H - py(-2.3));            // 防污漆
      g.strokeStyle = 'rgba(228,198,124,.95)'; g.lineWidth = 3.4;                   // 金色分色线
      g.beginPath(); g.moveTo(0, py(navyTop(X0)));
      for (let x = X0; x <= X1; x += 2) g.lineTo(px(x), py(navyTop(x)));
      g.stroke();
      g.fillStyle = 'rgba(255,255,255,.55)'; g.fillRect(0, py(1.05), W, 2);

      // 深蓝船身上的舷窗
      g.fillStyle = 'rgba(158,202,230,.72)';
      for (let x = -94; x < 84; x += 5.4) {
        g.beginPath(); g.ellipse(px(x), py(5.4), 3.6, 3.6, 0, 0, 6.2832); g.fill();
      }

      // 白色部分的窗排（遇到扬起的分色线自动收口）
      const rows = [
        { yc: 11.4, hh: 1.55, xa: -97, xb: 78 },
        { yc: 14.2, hh: 1.55, xa: -97, xb: 80 },
        { yc: 17.0, hh: 1.60, xa: -97, xb: 82 },
      ];
      for (const r of rows) {
        const yT = py(r.yc + r.hh / 2), yB = py(r.yc - r.hh / 2), hp = yB - yT;
        const n = Math.round((r.xb - r.xa) / 4.3), step = (r.xb - r.xa) / n;
        let lastX = r.xa;
        for (let i = 0; i < n; i++) {
          const x0 = r.xa + i * step;
          if (navyTop(x0 + step * 0.5) > r.yc - r.hh / 2 - 0.5) break;
          const cw = px(x0 + step) - px(x0);
          g.fillStyle = 'rgba(146,164,180,.5)'; g.fillRect(px(x0), yT - 2.5, cw + 1, hp + 5);
          const grd = g.createLinearGradient(0, yT, 0, yB);
          grd.addColorStop(0.00, '#6699bd'); grd.addColorStop(0.45, '#1d3e59'); grd.addColorStop(1, '#12283b');
          g.fillStyle = grd; g.fillRect(px(x0) + cw * 0.15, yT, cw * 0.70, hp);
          lastX = x0 + step;
        }
        g.fillStyle = 'rgba(255,255,255,.92)'; g.fillRect(px(r.xa), yB, px(lastX) - px(r.xa), 2.6);
      }
      // 散步甲板凹槽（连续暗带）
      g.fillStyle = 'rgba(40,58,76,.62)';
      g.fillRect(px(-97), py(10.3), px(48) - px(-97), py(9.7) - py(10.3));

      // 甲板缝线
      g.fillStyle = 'rgba(150,168,184,.28)';
      for (const y of [12.8, 15.6, 18.3]) g.fillRect(0, py(y), px(84), 1.8);

      // 锚穴 + 锚（画进贴图，贴合外板，两舷对称）
      {
        const ax = px(79), ay = py(10.4), s = 9.6;
        g.save(); g.translate(ax, ay); g.scale(s, s);
        g.fillStyle = '#08192f';
        g.beginPath(); g.ellipse(0, 0, 1.75, 1.35, 0, 0, 6.2832); g.fill();
        g.fillStyle = '#8e9aa5';
        g.fillRect(-0.16, -1.15, 0.32, 1.9);                       // 锚杆
        g.beginPath();                                             // 锚爪
        g.moveTo(-1.25, 0.32); g.quadraticCurveTo(-0.5, 1.25, 0, 0.55);
        g.quadraticCurveTo(0.5, 1.25, 1.25, 0.32);
        g.quadraticCurveTo(0.6, 0.62, 0, 0.15);
        g.quadraticCurveTo(-0.6, 0.62, -1.25, 0.32); g.fill();
        g.fillStyle = '#c8d2da'; g.fillRect(-0.55, -1.28, 1.1, 0.26);
        g.restore();
        // 锚链筒开口
        g.fillStyle = '#08192f';
        g.beginPath(); g.ellipse(px(85), py(12.4), 5.6, 4.2, 0, 0, 6.2832); g.fill();
      }

      // 艏部对称徽记（平面投影两舷都正）
      const ex = px(74), ey = py(6.0), es = 5.2;
      g.save(); g.translate(ex, ey); g.scale(es, es);
      g.fillStyle = 'rgba(232,203,132,.95)';
      g.beginPath();
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + i * Math.PI / 5, rr2 = i % 2 ? 1.0 : 2.3;
        g.lineTo(Math.cos(a) * rr2, Math.sin(a) * rr2);
      }
      g.closePath(); g.fill();
      g.strokeStyle = 'rgba(232,203,132,.9)'; g.lineWidth = 0.55;
      g.beginPath(); g.moveTo(-4.2, 3.4); g.quadraticCurveTo(0, 1.8, 4.2, 3.4); g.stroke();
      g.restore();

      const t = new THREE.CanvasTexture(cv);
      t.colorSpace = THREE.SRGBColorSpace;
      t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
      t.anisotropy = SHIP_ANISO;
      return t;
    }

    /* —— 柚木甲板条纹 —— */
    function shipDeckTexture() {
      const cv = document.createElement('canvas'); cv.width = 8; cv.height = 64;
      const g = cv.getContext('2d');
      for (let i = 0; i < 16; i++) {
        g.fillStyle = i % 2 ? '#c49a68' : '#b98f5f'; g.fillRect(0, i * 4, 8, 4);
        g.fillStyle = 'rgba(84,60,36,.42)'; g.fillRect(0, i * 4, 8, 0.9);
      }
      const t = new THREE.CanvasTexture(cv);
      t.colorSpace = THREE.SRGBColorSpace;
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.anisotropy = SHIP_ANISO;
      return t;
    }

    /* —— 直升机坪 —— */
    function shipPadTexture() {
      const S = 256, cv = document.createElement('canvas'); cv.width = cv.height = S;
      const g = cv.getContext('2d');
      g.fillStyle = '#3d4a55'; g.beginPath(); g.arc(S / 2, S / 2, S / 2 - 2, 0, 6.2832); g.fill();
      g.strokeStyle = '#f2f6f8'; g.lineWidth = 9;
      g.beginPath(); g.arc(S / 2, S / 2, S * 0.36, 0, 6.2832); g.stroke();
      g.fillStyle = '#f2f6f8';
      g.fillRect(S * 0.36, S * 0.30, 18, S * 0.40);
      g.fillRect(S * 0.60, S * 0.30, 18, S * 0.40);
      g.fillRect(S * 0.36, S * 0.455, S * 0.26, 16);
      const t = new THREE.CanvasTexture(cv);
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = SHIP_ANISO;
      return t;
    }

    function buildCruiseShip() {
      const g = new THREE.Group();

      /* ---------- 材质 ---------- */
      const whiteMat = new THREE.MeshStandardMaterial({ color: srgb(0xf3f7fa), roughness: 0.46, metalness: 0.04 });
      const paleMat  = new THREE.MeshStandardMaterial({ color: srgb(0xdfe6ec), roughness: 0.62, metalness: 0.03 });
      const navyMat  = new THREE.MeshStandardMaterial({ color: srgb(0x0d2b4e), roughness: 0.40, metalness: 0.10 });
      const redMat   = new THREE.MeshStandardMaterial({ color: srgb(0xc0392b), roughness: 0.48, metalness: 0.06 });
      const darkMat  = new THREE.MeshStandardMaterial({ color: srgb(0x27313c), roughness: 0.72, metalness: 0.25 });
      const railMat  = new THREE.MeshStandardMaterial({ color: srgb(0xeaf0f5), roughness: 0.38, metalness: 0.45 });
      const glassMat = new THREE.MeshStandardMaterial({ color: srgb(0x9fc4dd), roughness: 0.10, metalness: 0.30,
        transparent: true, opacity: 0.36, depthWrite: false, side: THREE.DoubleSide });
      const winDark  = new THREE.MeshStandardMaterial({ color: srgb(0x16324a), roughness: 0.14, metalness: 0.35 });
      const poolMat  = new THREE.MeshStandardMaterial({ color: srgb(0x2fc6d6), roughness: 0.10, metalness: 0.25 });
      const boatMat  = new THREE.MeshStandardMaterial({ color: srgb(0xff8a1f), roughness: 0.55, metalness: 0.05 });
      const deckTex  = shipDeckTexture();
      const deckMat  = new THREE.MeshStandardMaterial({ map: deckTex, roughness: 0.85, metalness: 0.02 });

      /* ---------- 1 · 船体放样 ---------- */
      const NX = 88, NC = 12, RING = NC * 2 + 1;
      const base = [];
      for (let i = 0; i <= NX; i++) {
        const u = -Math.cos(Math.PI * i / NX);
        const xs = u * SHIP_HL, kb = shipKeelY(u), sh = shipSheerY(u);
        const ring = [];
        for (let j = 0; j <= NC; j++) {
          const y = kb + (sh - kb) * Math.pow(j / NC, 1.30);
          ring.push([xs + shipStemShift(u, y), y, shipHalfW(u, y, j)]);
        }
        base.push(ring);
      }
      const shrink = (ring, s, yk, dx) => {
        const ym = (ring[0][1] + ring[NC][1]) * 0.5;
        return ring.map(([x, y, w]) => [x + dx, ym + (y - ym) * yk, w * s]);
      };
      const sts = [];
      // 圆润方艉：四道快速收口 + 甲板后挑
      const stS = [0.00, 0.55, 0.82, 0.95], stK = [0.60, 0.80, 0.93, 0.985], stD = [-3.3, -2.8, -2.0, -1.0];
      for (let k = 0; k < 4; k++) sts.push(shrink(base[0], stS[k], stK[k], stD[k]));
      for (let i = 0; i <= NX; i++) sts.push(base[i]);
      // 飞剪艏收成一条前倾的艏柱线
      const bwS = [0.50, 0.00], bwK = [0.99, 0.975], bwD = [0.7, 1.2];
      for (let k = 0; k < 2; k++) sts.push(shrink(base[NX], bwS[k], bwK[k], bwD[k]));

      const NS = sts.length;
      const hPos = new Float32Array(NS * RING * 3), hUv = new Float32Array(NS * RING * 2);
      for (let i = 0; i < NS; i++) {
        for (let k = 0; k < RING; k++) {
          const lv = Math.abs(NC - k), sg = k < NC ? -1 : 1;
          const [x, y, w] = sts[i][lv];
          const o = (i * RING + k);
          hPos[o * 3] = x; hPos[o * 3 + 1] = y; hPos[o * 3 + 2] = sg * w;
          hUv[o * 2] = (x + 114) / 228; hUv[o * 2 + 1] = (y + 13) / 40;
        }
      }
      const hIdx = [];
      for (let i = 0; i < NS - 1; i++) {
        for (let k = 0; k < RING - 1; k++) {
          const a = i * RING + k, b = (i + 1) * RING + k, c = i * RING + k + 1, d = (i + 1) * RING + k + 1;
          hIdx.push(a, b, c, b, d, c);
        }
      }
      const hg = new THREE.BufferGeometry();
      hg.setAttribute('position', new THREE.BufferAttribute(hPos, 3));
      hg.setAttribute('uv', new THREE.BufferAttribute(hUv, 2));
      hg.setIndex(hIdx);
      hg.computeVertexNormals();
      const hull = new THREE.Mesh(hg, new THREE.MeshStandardMaterial({
        map: shipHullTexture(), roughness: 0.36, metalness: 0.10,
      }));
      hull.castShadow = true; hull.receiveShadow = true;
      g.add(hull);

      /* ---------- 2 · 主甲板面 ---------- */
      const ND = 6;
      const dPos = new Float32Array(NS * (ND + 1) * 3), dUv = new Float32Array(NS * (ND + 1) * 2);
      for (let i = 0; i < NS; i++) {
        const [x, y, w] = sts[i][NC];
        for (let m = 0; m <= ND; m++) {
          const z = lerp(-w, w, m / ND), o = i * (ND + 1) + m;
          dPos[o * 3] = x; dPos[o * 3 + 1] = y; dPos[o * 3 + 2] = z;
          dUv[o * 2] = x * 0.02; dUv[o * 2 + 1] = z / 6;
        }
      }
      const dIdx = [];
      for (let i = 0; i < NS - 1; i++) {
        for (let m = 0; m < ND; m++) {
          const a = i * (ND + 1) + m, b = (i + 1) * (ND + 1) + m, c = a + 1, d = b + 1;
          dIdx.push(a, c, b, c, d, b);
        }
      }
      const dg = new THREE.BufferGeometry();
      dg.setAttribute('position', new THREE.BufferAttribute(dPos, 3));
      dg.setAttribute('uv', new THREE.BufferAttribute(dUv, 2));
      dg.setIndex(dIdx); dg.computeVertexNormals();
      const deck = new THREE.Mesh(dg, deckMat);
      deck.receiveShadow = true; g.add(deck);

      /* ---------- 3 · 上层建筑 ---------- */
      // 通用：带平面收分 + 前脸后倾的块体
      function block(xc, len, hgt, wid, y0, inset, mats, rake) {
        const geo = new THREE.BoxGeometry(len, hgt, wid, 28, 1, 2);
        const p = geo.attributes.position, aft = xc - len / 2, hw = wid / 2;
        for (let i = 0; i < p.count; i++) {
          let lx = p.getX(i); const ly = p.getY(i);
          lx -= smoothstep(len * 0.24, len * 0.5, lx) * (ly + hgt / 2) * (rake === undefined ? 0.26 : rake);
          const x = lx + xc;
          let f = shipTierHalf(x, hw, inset) / hw;
          f *= 1 - 0.34 * smoothstep(aft + 12, aft + 0.5, x);
          p.setXYZ(i, lx, ly, p.getZ(i) * f);
        }
        geo.computeVertexNormals();
        const m = new THREE.Mesh(geo, mats);
        m.position.set(xc, y0 + hgt / 2, 0);
        m.castShadow = true; m.receiveShadow = true;
        g.add(m);
        return m;
      }
      const sideMat = (len, rows, kind) => {
        const cols = Math.max(6, Math.round(len / 4.3));
        return new THREE.MeshStandardMaterial({
          map: windowTexture(cols, rows, { kind }), roughness: 0.34, metalness: 0.06,
        });
      };
      const endMat = (wid, rows, kind) => {
        const cols = Math.max(4, Math.round(wid / 4.3));
        return new THREE.MeshStandardMaterial({
          map: windowTexture(cols, rows, { kind }), roughness: 0.34, metalness: 0.06,
        });
      };

      //          艏端  艉端   高    宽   收进  窗排  类型
      const TIERS = [
        { xf:  64, xa: -96, h: 7.4, w: 26.0, ins: 1.6, rows: 2, kind: 'balcony' },
        { xf:  62, xa: -89, h: 6.9, w: 25.0, ins: 2.2, rows: 2, kind: 'balcony' },
        { xf:  60, xa: -82, h: 6.5, w: 23.6, ins: 3.0, rows: 2, kind: 'balcony' },
        { xf:  58, xa: -74, h: 6.0, w: 21.6, ins: 3.8, rows: 2, kind: 'balcony' },
        { xf:  14, xa: -64, h: 5.2, w: 18.6, ins: 5.0, rows: 1, kind: 'glass'   },
      ];
      let y = SHIP_SHEER;
      const tierTop = [];
      TIERS.forEach((t, i) => {
        const len = t.xf - t.xa, xc = (t.xf + t.xa) / 2;
        const sm = sideMat(len, t.rows, t.kind);
        const em = endMat(t.w, t.rows, t.kind);
        block(xc, len, t.h, t.w, y, t.ins,
          [em, em, paleMat, whiteMat, sm, sm], i === 0 ? 0.18 : 0.28);
        y += t.h;
        // 甲板外沿（挑出的散步/阳台檐口）
        block(xc, len * 0.995, 0.55, t.w + 1.7, y - 0.3, t.ins - 0.85, whiteMat, 0.0);
        tierTop.push({ y, xf: t.xf, xa: t.xa, w: t.w, ins: t.ins });
      });
      const TOP4 = tierTop[3].y;      // 泳池甲板 / 驾驶台层
      const TOP5 = tierTop[4].y;      // 顶层（烟囱）

      /* ---------- 4 · 驾驶台 + 桥翼 ---------- */
      const bridgeGlass = new THREE.MeshStandardMaterial({
        map: windowTexture(6, 1, { kind: 'glass' }), roughness: 0.16, metalness: 0.25,
      });
      const bSideGlass = new THREE.MeshStandardMaterial({
        map: windowTexture(5, 1, { kind: 'glass' }), roughness: 0.16, metalness: 0.25,
      });
      const bg = new THREE.BoxGeometry(16, 4.8, 20, 1, 1, 1);
      {   // 前脸后倾 + 侧面外张
        const p = bg.attributes.position;
        for (let i = 0; i < p.count; i++) {
          const lx = p.getX(i), ly = p.getY(i);
          p.setX(i, lx > 0 ? lx - (ly + 2.4) * 0.30 : lx);
          p.setZ(i, p.getZ(i) * (ly > 0 ? 1.0 : 0.92));
        }
        bg.computeVertexNormals();
      }
      const bridge = new THREE.Mesh(bg, [bridgeGlass, whiteMat, paleMat, whiteMat, bSideGlass, bSideGlass]);
      bridge.position.set(50, TOP4 + 2.4, 0); bridge.castShadow = true; g.add(bridge);
      const bTop = new THREE.Mesh(new THREE.BoxGeometry(16.5, 0.5, 21), whiteMat);
      bTop.position.set(49.2, TOP4 + 5.05, 0); g.add(bTop);

      for (const sgn of [1, -1]) {                     // 伸出舷外的桥翼
        const wing = new THREE.Mesh(new THREE.BoxGeometry(13, 3.4, 7.4), whiteMat);
        wing.position.set(50, TOP4 + 1.7, sgn * 12.1); wing.castShadow = true; g.add(wing);
        const wGlass = new THREE.Mesh(new THREE.BoxGeometry(0.3, 2.2, 7.0), winDark);
        wGlass.position.set(56.4, TOP4 + 2.2, sgn * 12.1); g.add(wGlass);
        const wRoof = new THREE.Mesh(new THREE.BoxGeometry(13.6, 0.5, 8.0), whiteMat);
        wRoof.position.set(49.6, TOP4 + 3.6, sgn * 12.2); g.add(wRoof);
        const wSide = new THREE.Mesh(new THREE.BoxGeometry(12.4, 2.4, 0.25), glassMat);
        wSide.position.set(50, TOP4 + 1.5, sgn * 15.9); g.add(wSide);
        const wLip = new THREE.Mesh(new THREE.BoxGeometry(12.6, 0.16, 0.4), railMat);
        wLip.position.set(50, TOP4 + 2.75, sgn * 15.9); g.add(wLip);
        for (const sx of [-5.2, 5.2]) {                // 支撑斜撑
          const strut = new THREE.Mesh(new THREE.BoxGeometry(0.42, 3.4, 0.42), whiteMat);
          strut.position.set(50 + sx, TOP4 - 1.6, sgn * 13.6); strut.rotation.x = sgn * 0.30; g.add(strut);
        }
      }

      /* ---------- 5 · 雷达桅 ---------- */
      const mastY = TOP4 + 5.3;
      const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.72, 13.5, 8), whiteMat);
      mast.position.set(45, mastY + 6.75, 0); g.add(mast);
      for (const [yy, ln] of [[5.0, 9.0], [8.4, 6.0]]) {
        const yard = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.32, ln), whiteMat);
        yard.position.set(45, mastY + yy, 0); g.add(yard);
      }
      const radar = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 5.6), darkMat);
      radar.position.set(45, mastY + 11.2, 0); radar.rotation.y = 0.5; g.add(radar);
      const radome = new THREE.Mesh(new THREE.SphereGeometry(1.5, 14, 8), whiteMat);
      radome.position.set(45, mastY + 12.6, 0); g.add(radome);
      for (const sgn of [1, -1]) {
        const nav = new THREE.Mesh(new THREE.SphereGeometry(0.34, 8, 6),
          new THREE.MeshStandardMaterial({ color: srgb(sgn > 0 ? 0x1fdd63 : 0xff3535),
            emissive: srgb(sgn > 0 ? 0x0f8c3c : 0x9c1414), emissiveIntensity: 1.6, roughness: 0.4 }));
        nav.position.set(55.6, TOP4 + 4.0, sgn * 15.6); g.add(nav);
      }

      /* ---------- 6 · 后掠式烟囱 ---------- */
      const FB = TOP5, FH = 16.0, FR_T = 4.1, FR_B = 6.4, FX = -26;
      const fSweep = (yAbs) => {
        const t = clamp((yAbs - FB) / FH, 0, 1);
        return { dx: -t * t * 5.2, sx: lerp(1, 0.86, t), sz: 1.28 * lerp(1, 0.94, t) };
      };
      const fRad = (yAbs) => lerp(FR_B, FR_T, clamp((yAbs - FB) / FH, 0, 1));
      function sweptCyl(rT, rB, h, y0, mat, seg) {
        const geo = new THREE.CylinderGeometry(rT, rB, h, seg || 24, Math.max(2, Math.round(h / 2)), true);
        const p = geo.attributes.position;
        for (let i = 0; i < p.count; i++) {
          const s = fSweep(p.getY(i) + y0 + h / 2);
          p.setXYZ(i, p.getX(i) * s.sx + s.dx, p.getY(i), p.getZ(i) * s.sz);
        }
        geo.computeVertexNormals();
        const m = new THREE.Mesh(geo, mat);
        m.position.set(FX, y0 + h / 2, 0);
        m.castShadow = true; g.add(m);
        return m;
      }
      sweptCyl(FR_T, FR_B, FH, FB, whiteMat);
      sweptCyl(fRad(FB + 13.2) * 1.03, fRad(FB + 9.6) * 1.03, 3.6, FB + 9.6, redMat);
      sweptCyl(fRad(FB + 9.4) * 1.05, fRad(FB + 8.6) * 1.05, 0.8, FB + 8.6, navyMat);
      sweptCyl(fRad(FB + 14.2) * 1.05, fRad(FB + 13.4) * 1.05, 0.8, FB + 13.4, navyMat);
      {   // 顶口
        const cap = new THREE.Mesh(new THREE.CylinderGeometry(FR_T * 0.82, FR_T, 1.1, 24), darkMat);
        const s = fSweep(FB + FH);
        cap.position.set(FX + s.dx, FB + FH - 0.25, 0); cap.scale.set(s.sx, 1, s.sz); g.add(cap);
      }
      for (const sgn of [1, -1]) {   // 后掠侧翼
        const fin = new THREE.Mesh(new THREE.BoxGeometry(11, 5.4, 0.8), whiteMat);
        fin.position.set(FX - 4.2, FB + 3.6, sgn * 5.4); fin.rotation.z = -0.30; g.add(fin);
      }
      // 烟囱基座整流罩
      const fBase = new THREE.Mesh(new THREE.BoxGeometry(22, 3.2, 15), whiteMat);
      fBase.position.set(FX - 1, FB + 1.5, 0); fBase.castShadow = true; g.add(fBase);
      const fBand = new THREE.Mesh(new THREE.BoxGeometry(22.2, 0.6, 15.2), navyMat);
      fBand.position.set(FX - 1, FB + 2.8, 0); g.add(fBand);
      // 辅助排气
      const uptake = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.5, 5.4, 12), paleMat);
      uptake.position.set(FX - 15, FB + 2.7, 0); g.add(uptake);

      /* ---------- 7 · 顶层泳池甲板 ---------- */
      const poolDeck = new THREE.Mesh(new THREE.BoxGeometry(40, 0.25, 17), deckMat);
      poolDeck.position.set(35, TOP4 + 0.14, 0); g.add(poolDeck);
      const pool = new THREE.Mesh(new THREE.BoxGeometry(15, 0.35, 8.5), poolMat);
      pool.position.set(32, TOP4 + 0.30, 0); g.add(pool);
      const poolLip = new THREE.Mesh(new THREE.BoxGeometry(16.4, 0.30, 9.9), paleMat);
      poolLip.position.set(32, TOP4 + 0.20, 0); g.add(poolLip);
      const kid = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.4, 0.35, 18), poolMat);
      kid.position.set(48, TOP4 + 0.30, 0); g.add(kid);
      // 玻璃穹顶
      const dome = new THREE.Mesh(new THREE.SphereGeometry(8.4, 20, 9, 0, 6.2832, 0, Math.PI / 2), glassMat);
      dome.scale.set(1, 0.52, 0.92); dome.position.set(32, TOP4 + 0.2, 0); g.add(dome);
      for (let i = 0; i < 6; i++) {   // 穹顶肋
        const rib = new THREE.Mesh(new THREE.TorusGeometry(8.3, 0.10, 4, 20, Math.PI), railMat);
        rib.position.set(32, TOP4 + 0.2, 0); rib.rotation.y = i * Math.PI / 6;
        rib.scale.set(1, 0.52, 1); g.add(rib);
      }
      // 螺旋滑梯：从顶层甲板盘旋落到艉部露台
      {
        const pts = [];
        for (let i = 0; i <= 44; i++) {
          const t = i / 44, a = -1.0 + t * 7.6;
          pts.push(V3(-59 - t * 19 + Math.cos(a) * 4.4, TOP5 + 1.6 - t * 12.2, Math.sin(a) * 4.4));
        }
        const tube = new THREE.Mesh(
          new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 46, 0.75, 7, false),
          new THREE.MeshStandardMaterial({ color: srgb(0xf2b21c), roughness: 0.35, metalness: 0.1 }));
        tube.castShadow = true; g.add(tube);
        const tower = new THREE.Mesh(new THREE.BoxGeometry(3.0, 3.2, 3.0), whiteMat);
        tower.position.set(-55.5, TOP5 + 1.6, 0); g.add(tower);
      }
      // 顶层运动甲板（T5 屋顶）
      {
        const court = new THREE.Mesh(new THREE.BoxGeometry(17, 0.22, 11),
          new THREE.MeshStandardMaterial({ color: srgb(0x2f7f6a), roughness: 0.85 }));
        court.position.set(-2, TOP5 + 0.13, 0); g.add(court);
        const line = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.26, 11), paleMat);
        line.position.set(-2, TOP5 + 0.16, 0); g.add(line);
        for (const cx of [-10.2, 6.2]) {
          const net = new THREE.Mesh(new THREE.BoxGeometry(0.2, 3.6, 11), glassMat);
          net.position.set(cx, TOP5 + 1.8, 0); g.add(net);
        }
        for (const sgn of [1, -1]) {                   // 顶层甲板栏杆
          const zz = shipTierHalf(-20, TIERS[4].w / 2, TIERS[4].ins);
          const rail = new THREE.Mesh(new THREE.BoxGeometry(52, 0.12, 0.22), railMat);
          rail.position.set(-22, TOP5 + 1.0, sgn * zz); g.add(rail);
          const pan = new THREE.Mesh(new THREE.BoxGeometry(52, 0.9, 0.1), glassMat);
          pan.position.set(-22, TOP5 + 0.5, sgn * zz); g.add(pan);
        }
        for (const [vx, vz] of [[10, 4.5], [10, -4.5]]) {   // 通风机
          const v = new THREE.Mesh(new THREE.BoxGeometry(3.0, 1.8, 2.4), paleMat);
          v.position.set(vx, TOP5 + 0.9, vz); g.add(v);
        }
      }
      // 遮阳伞
      for (const [ux, uz] of [[46, 6.2], [46, -6.2], [22, 7.0], [22, -7.0], [14, 5.0]]) {
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 2.4, 6), railMat);
        pole.position.set(ux, TOP4 + 1.2, uz); g.add(pole);
        const top = new THREE.Mesh(new THREE.ConeGeometry(1.9, 0.7, 10),
          new THREE.MeshStandardMaterial({ color: srgb(0xe8593f), roughness: 0.7 }));
        top.position.set(ux, TOP4 + 2.6, uz); g.add(top);
      }

      /* ---------- 8 · 阶梯式艉部露台 ---------- */
      for (let i = 0; i < tierTop.length; i++) {
        const t = tierTop[i];
        const next = tierTop[i + 1];
        const xEnd = next ? next.xa : t.xa + 8;
        const w0 = shipTierHalf(t.xa + 2, t.w / 2, t.ins);
        if (!next) continue;
        const len = xEnd - t.xa;
        if (len < 3) continue;
        const pad = new THREE.Mesh(new THREE.BoxGeometry(len, 0.22, w0 * 1.85), deckMat);
        pad.position.set(t.xa + len / 2, t.y + 0.12, 0); g.add(pad);
        const bal = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.05, w0 * 1.85), glassMat);
        bal.position.set(t.xa + 0.4, t.y + 0.7, 0); g.add(bal);
        const cap = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.13, w0 * 1.9), railMat);
        cap.position.set(t.xa + 0.4, t.y + 1.25, 0); g.add(cap);
        if (i === 1) {   // 艉部露台泳池
          const p2 = new THREE.Mesh(new THREE.BoxGeometry(Math.min(6, len * 0.6), 0.3, 7), poolMat);
          p2.position.set(t.xa + len * 0.55, t.y + 0.28, 0); g.add(p2);
        }
      }

      /* ---------- 9 · 吊艇架 + 救生艇 ---------- */
      const LB_Y = tierTop[0].y - 0.9;
      for (let i = 0; i < 9; i++) {
        const bx = -66 + i * 13.0;
        const zb = shipTierHalf(bx, TIERS[0].w / 2, TIERS[0].ins) + 1.5;
        for (const sgn of [1, -1]) {
          const b = new THREE.Mesh(new THREE.CapsuleGeometry(1.3, 4.4, 3, 9), boatMat);
          b.rotation.z = Math.PI / 2; b.position.set(bx, LB_Y, sgn * zb);
          b.castShadow = true; g.add(b);
          const canopy = new THREE.Mesh(new THREE.CapsuleGeometry(1.05, 4.2, 2, 8), whiteMat);
          canopy.rotation.z = Math.PI / 2; canopy.position.set(bx, LB_Y + 1.05, sgn * zb); g.add(canopy);
          const arm = new THREE.Mesh(new THREE.BoxGeometry(0.3, 2.8, 0.3), railMat);
          arm.position.set(bx - 2.6, LB_Y + 2.2, sgn * (zb - 0.6)); arm.rotation.x = sgn * 0.22; g.add(arm);
          const arm2 = new THREE.Mesh(new THREE.BoxGeometry(0.3, 2.8, 0.3), railMat);
          arm2.position.set(bx + 2.6, LB_Y + 2.2, sgn * (zb - 0.6)); arm2.rotation.x = sgn * 0.22; g.add(arm2);
        }
      }

      /* ---------- 10 · 栏杆 ---------- */
      // 沿舷弧的甲板边缘：'rail' 玻璃栏杆 / 'bulwark' 实体挡浪墙（艏楼，勾出舷弧线）
      function deckEdge(xa, xb, inset, n, kind) {
        const solid = kind === 'bulwark';
        for (const sgn of [1, -1]) {
          for (let i = 0; i < n; i++) {
            const x0 = lerp(xa, xb, i / n), x1 = lerp(xa, xb, (i + 1) / n), xm = (x0 + x1) / 2;
            const z0 = shipDeckHalf(clamp(x0 / SHIP_HL, -1, 1)) - inset;
            const z1 = shipDeckHalf(clamp(x1 / SHIP_HL, -1, 1)) - inset;
            if (z0 < 0.5 || z1 < 0.5) continue;
            const dx = x1 - x0, dz = sgn * (z1 - z0), len = Math.hypot(dx, dz) * 1.04;
            const y0 = shipSheerY(clamp(x0 / SHIP_HL, -1, 1));
            const y1 = shipSheerY(clamp(x1 / SHIP_HL, -1, 1));
            const yy = (y0 + y1) / 2, rot = Math.atan2(-dz, dx);
            const h = solid ? 1.9 : 1.0;
            const panel = new THREE.Mesh(new THREE.BoxGeometry(len, h, solid ? 0.5 : 0.12),
              solid ? whiteMat : glassMat);
            panel.position.set(xm, yy + h / 2 - 0.1, sgn * (z0 + z1) / 2);
            panel.rotation.y = rot; panel.rotation.z = Math.atan2(y1 - y0, dx);
            g.add(panel);
            const top = new THREE.Mesh(new THREE.BoxGeometry(len, 0.14, solid ? 0.66 : 0.26), railMat);
            top.position.set(xm, yy + h - 0.05, sgn * (z0 + z1) / 2);
            top.rotation.y = rot; top.rotation.z = panel.rotation.z; g.add(top);
          }
        }
      }
      deckEdge(63, 99, 0.55, 12, 'bulwark');   // 艏楼挡浪墙（随舷弧上扬）
      deckEdge(-100, -92, 0.7, 3, 'rail');     // 艉甲板
      deckEdge(-92, 63, 0.55, 20, 'rail');     // 两舷散步甲板

      // 顶层泳池甲板栏杆
      for (const sgn of [1, -1]) {
        const zz = shipTierHalf(35, TIERS[3].w / 2, TIERS[3].ins);
        const panel = new THREE.Mesh(new THREE.BoxGeometry(42, 0.95, 0.12), glassMat);
        panel.position.set(35, TOP4 + 0.6, sgn * zz); g.add(panel);
        const top = new THREE.Mesh(new THREE.BoxGeometry(42, 0.12, 0.24), railMat);
        top.position.set(35, TOP4 + 1.12, sgn * zz); g.add(top);
      }
      const foreRail = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.95, 15), glassMat);
      foreRail.position.set(TIERS[3].xf - 1.5, TOP4 + 0.6, 0); g.add(foreRail);

      /* ---------- 11 · 玻璃观光电梯（两舷） ---------- */
      for (const sgn of [1, -1]) {
        const ex = -8, ez = shipTierHalf(ex, TIERS[0].w / 2, TIERS[0].ins) + 0.55;
        const h = TOP4 - SHIP_SHEER - 2.6;
        const shaft = new THREE.Mesh(new THREE.BoxGeometry(5.0, h, 1.2), winDark);
        shaft.position.set(ex, SHIP_SHEER + 0.6 + h / 2, sgn * ez); g.add(shaft);
        const glassF = new THREE.Mesh(new THREE.BoxGeometry(4.4, h - 0.5, 0.2), glassMat);
        glassF.position.set(ex, SHIP_SHEER + 0.6 + h / 2, sgn * (ez + 0.66)); g.add(glassF);
        for (const dx of [-2.6, 0, 2.6]) {
          const post = new THREE.Mesh(new THREE.BoxGeometry(0.42, h + 0.5, 1.7), whiteMat);
          post.position.set(ex + dx, SHIP_SHEER + 0.6 + h / 2, sgn * ez); g.add(post);
        }
        for (let k = 0; k < 2; k++) {   // 轿厢
          const car = new THREE.Mesh(new THREE.BoxGeometry(2.0, 2.3, 1.7), paleMat);
          car.position.set(ex + (k ? 1.3 : -1.3), SHIP_SHEER + 2.4 + h * (k ? 0.58 : 0.22), sgn * (ez + 0.28));
          g.add(car);
        }
        const capB = new THREE.Mesh(new THREE.BoxGeometry(5.6, 0.5, 2.0), whiteMat);
        capB.position.set(ex, SHIP_SHEER + 0.9 + h, sgn * ez); g.add(capB);
      }

      /* ---------- 12 · 艏部：直升机坪 / 锚 / 桅 ---------- */
      const hullPt = (u, y) => ({ x: u * SHIP_HL + shipStemShift(u, y), z: shipHalfW(u, y, 1) });
      const padY = shipSheerY(0.74) + 0.16;
      const pad = new THREE.Mesh(new THREE.CircleGeometry(5.2, 26),
        new THREE.MeshStandardMaterial({ map: shipPadTexture(), roughness: 0.85 }));
      pad.rotation.x = -Math.PI / 2; pad.position.set(74, padY, 0); g.add(pad);

      // 艏楼上的绞盘/锚机
      for (const [wx, wz] of [[84, 3.0], [84, -3.0]]) {
        const win = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.0, 1.3, 10), paleMat);
        win.position.set(wx, shipSheerY(wx / SHIP_HL) + 0.7, wz); g.add(win);
      }
      const foreMast = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.30, 8.0, 6), whiteMat);
      foreMast.position.set(88, shipSheerY(0.88) + 4.0, 0); g.add(foreMast);
      const foreYard = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.22, 3.4), whiteMat);
      foreYard.position.set(88, shipSheerY(0.88) + 6.6, 0); g.add(foreYard);

      {   // 抛下的锚链（锚穴本身画在外板贴图里，保持贴合）
        const cp = hullPt(0.80, 5.0);
        const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.20, 0.20, 15, 6), darkMat);
        chain.position.set(cp.x + 0.9, 4.2, cp.z + 0.45); chain.rotation.z = 0.22; g.add(chain);
      }

      /* ---------- 13 · 艉部 ---------- */
      const transomDeck = new THREE.Mesh(new THREE.BoxGeometry(10, 0.25, 15), deckMat);
      transomDeck.position.set(-95, shipSheerY(-0.95) + 0.14, 0); g.add(transomDeck);
      // 艉部露天泳池 + 遮阳篷
      const aftPool = new THREE.Mesh(new THREE.CylinderGeometry(3.0, 3.0, 0.32, 20), poolMat);
      aftPool.position.set(-95, shipSheerY(-0.95) + 0.30, 0); g.add(aftPool);
      const flag = new THREE.Mesh(new THREE.CylinderGeometry(0.10, 0.16, 6.0, 6), whiteMat);
      flag.position.set(-100, shipSheerY(-1.0) + 3.0, 0); g.add(flag);
      const ensign = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.6),
        new THREE.MeshStandardMaterial({ color: srgb(0xc0392b), roughness: 0.8, side: THREE.DoubleSide }));
      ensign.position.set(-101.5, shipSheerY(-1.0) + 4.9, 0); g.add(ensign);
      // 艉部推进器/舵柱暗示
      const skeg = new THREE.Mesh(new THREE.BoxGeometry(9, 3.0, 1.2), darkMat);
      skeg.position.set(-92, -6.4, 0); g.add(skeg);

      g.position.set(SHIP_POS.x, 0, SHIP_POS.y);
      g.rotation.y = SHIP_YAW;
      return g;
    }

    const ship = buildCruiseShip();
    scene.add(ship);

    // 远景轮廓岛，拉纵深
    function distantIsle(x, z, s) {
      const g = new THREE.IcosahedronGeometry(1, 2);
      const p = g.attributes.position;
      for (let i = 0; i < p.count; i++) {   // 揉出起伏的山脊线
        const v = new THREE.Vector3().fromBufferAttribute(p, i);
        v.multiplyScalar(1 + (fbm2(v.x * 2.6 + x, v.z * 2.6 + z, 3) - 0.5) * 0.55);
        p.setXYZ(i, v.x, v.y, v.z);
      }
      g.computeVertexNormals();
      const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({
        color: srgb(0x7796a6), roughness: 1, flatShading: true,
      }));
      m.scale.set(s, s * 0.34, s * 0.66);
      m.rotation.y = rr(0, 3.14);
      m.position.set(x, -s * 0.10, z);
      scene.add(m);
    }
    distantIsle(-1450, -1250, 300); distantIsle(1250, -1850, 240); distantIsle(-2050, 560, 200);

    /* ============================================================
       8 · 摩托艇 + 尾迹 + 浪花
       ============================================================ */
    /* ---------- 摩托艇：共享材质 / 通用小工具 ---------------------- */
    let _skiSerial = 0;                       // 决定骑手变体，不动全局 rr() 序列

    // 本模块统一按"单次 sRGB→线性"处理颜色（贴图走 SRGBColorSpace，正好对齐），
    // 这样中间调不会像全局 srgb() 那样被二次转换压成纯黑。
    const skiCol = (h) => new THREE.Color(h);
    const skiHex = (h) => '#' + (h >>> 0).toString(16).padStart(6, '0');
    const skiMul = (h, k) => (Math.min(255, Math.round((h >> 16 & 255) * k)) << 16)
                           | (Math.min(255, Math.round((h >> 8 & 255) * k)) << 8)
                           |  Math.min(255, Math.round((h & 255) * k));

    const SKI_MAT = {
      seat:   new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.62 }),
      grip:   new THREE.MeshStandardMaterial({ color: skiCol(0x12161a), roughness: 0.96 }),
      stern:  new THREE.MeshStandardMaterial({ color: skiCol(0x3d4650), roughness: 0.42, metalness: 0.35 }),
      dark:   new THREE.MeshStandardMaterial({ color: skiCol(0x1b2027), roughness: 0.50, metalness: 0.45 }),
      chrome: new THREE.MeshStandardMaterial({ color: skiCol(0xbac6cf), roughness: 0.22, metalness: 0.92 }),
      glass:  new THREE.MeshStandardMaterial({ color: skiCol(0xbfe6f4), roughness: 0.05, metalness: 0.10, transparent: true, opacity: 0.26, side: THREE.DoubleSide }),
      lens:   new THREE.MeshStandardMaterial({ color: skiCol(0x121c26), roughness: 0.05, metalness: 0.92 }),
      dash:   new THREE.MeshStandardMaterial({ color: skiCol(0x16323f), roughness: 0.18, metalness: 0.2, emissive: skiCol(0x0d4256), emissiveIntensity: 0.9 }),
      skin:   [new THREE.MeshStandardMaterial({ color: skiCol(0xd8a67c), roughness: 0.70 }),
               new THREE.MeshStandardMaterial({ color: skiCol(0x9a6440), roughness: 0.66 }),
               new THREE.MeshStandardMaterial({ color: skiCol(0xe8bd97), roughness: 0.70 })],
      vest:   [new THREE.MeshStandardMaterial({ color: skiCol(0xff7a12), roughness: 0.72 }),
               new THREE.MeshStandardMaterial({ color: skiCol(0xe62641), roughness: 0.72 }),
               new THREE.MeshStandardMaterial({ color: skiCol(0x1657d6), roughness: 0.72 }),
               new THREE.MeshStandardMaterial({ color: skiCol(0x14c27e), roughness: 0.72 })],
      strap:  new THREE.MeshStandardMaterial({ color: skiCol(0x1a1f26), roughness: 0.9 }),
      short:  [new THREE.MeshStandardMaterial({ color: skiCol(0x536981), roughness: 0.82 }),
               new THREE.MeshStandardMaterial({ color: skiCol(0x8f9aa6), roughness: 0.82 }),
               new THREE.MeshStandardMaterial({ color: skiCol(0x5b4f74), roughness: 0.82 })],
      helm:   [new THREE.MeshStandardMaterial({ color: skiCol(0xf2f5f7), roughness: 0.14, metalness: 0.28 }),
               new THREE.MeshStandardMaterial({ color: skiCol(0x1d2229), roughness: 0.18, metalness: 0.32 }),
               new THREE.MeshStandardMaterial({ color: skiCol(0xffd23a), roughness: 0.14, metalness: 0.28 })],
      cap:    [new THREE.MeshStandardMaterial({ color: skiCol(0xf0f3f5), roughness: 0.7 }),
               new THREE.MeshStandardMaterial({ color: skiCol(0x1b3557), roughness: 0.7 })],
    };

    // 两点之间的胶囊（保证关节接得上）
    const _skiUp = new THREE.Vector3(0, 1, 0), _skiD = new THREE.Vector3();
    function skiLimb(a, b, r, mat, rad = 6) {
      _skiD.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
      const len = _skiD.length();
      const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, Math.max(0.02, len - r * 0.5), 2, rad), mat);
      m.position.set((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
      m.quaternion.setFromUnitVectors(_skiUp, _skiD.normalize());
      return m;
    }

    // 通用放样：ringFn(s) 返回等长的 [x,y,z] 环；vArr 存在时写 UV
    function skiLoft(n, ringFn, vArr, capA, capB) {
      const rings = [];
      for (let i = 0; i < n; i++) rings.push(ringFn(i / (n - 1)));
      const R = rings[0].length;
      const extra = (capA ? 1 : 0) + (capB ? 1 : 0);
      const pos = new Float32Array((n * R + extra) * 3);
      const uv = vArr ? new Float32Array((n * R + extra) * 2) : null;
      const idx = [];
      for (let i = 0; i < n; i++) for (let j = 0; j < R; j++) {
        const k = i * R + j, p = rings[i][j];
        pos[k * 3] = p[0]; pos[k * 3 + 1] = p[1]; pos[k * 3 + 2] = p[2];
        if (uv) { uv[k * 2] = i / (n - 1); uv[k * 2 + 1] = vArr[j]; }
      }
      for (let i = 0; i < n - 1; i++) for (let j = 0; j < R - 1; j++) {
        const a = i * R + j, b = a + 1, c = a + R, d = c + 1;
        idx.push(a, c, b, b, c, d);
      }
      let nx = n * R;
      const fan = (ring, off, flip) => {
        const cx = nx++; let sx = 0, sy = 0, sz = 0;
        for (const p of ring) { sx += p[0]; sy += p[1]; sz += p[2]; }
        pos[cx * 3] = sx / ring.length; pos[cx * 3 + 1] = sy / ring.length; pos[cx * 3 + 2] = sz / ring.length;
        for (let j = 0; j < R - 1; j++) flip ? idx.push(cx, off + j + 1, off + j) : idx.push(cx, off + j, off + j + 1);
      };
      if (capA) fan(rings[0], 0, false);
      if (capB) fan(rings[n - 1], (n - 1) * R, true);
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      if (uv) g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
      g.setIndex(idx); g.computeVertexNormals();
      return g;
    }

    /* 艇体剖面：u ∈ [-1(艉), 1(艏)]，返回闭合环（含 chine / 舷缘的法线断点 + 接缝点） */
    const SKI_LEN = 2.56, SKI_WELL_Y = 0.10;
    function skiSection(u) {
      const bowT = 1 - Math.pow(smoothstep(0.02, 1.00, u), 1.45) * 0.965;
      const bw   = 0.92 * bowT * lerp(0.78, 1.0, smoothstep(-1.0, -0.46, u));            // chine 半宽
      const keel = -0.70 + Math.pow(smoothstep(0.10, 1.00, u), 1.85) * 0.74 + smoothstep(-0.55, -1.0, u) * 0.17;
      const dead = lerp(0.46, 1.20, smoothstep(-0.25, 0.95, u));                          // 斜升角（V 底）
      const chY  = keel + dead * bw;
      const gw   = 0.90 * (1 - Math.pow(smoothstep(0.24, 1.02, u), 1.8) * 0.955) * lerp(0.80, 1.0, smoothstep(-1.0, -0.54, u));
      const gY   = lerp(0.30, 0.74, smoothstep(-0.40, 0.88, u));
      const dY   = lerp(0.34, 0.62, smoothstep(-1.0, -0.62, u)) + smoothstep(0.18, 0.78, u) * 0.24 - smoothstep(0.72, 1.02, u) * 0.34;
      const wk   = smoothstep(-0.93, -0.76, u) * (1 - smoothstep(-0.06, 0.20, u));        // 脚踏槽存在度
      const wf   = SKI_WELL_Y;

      const P = [];
      P.push([0, keel]);                                        // 0 龙骨
      P.push([bw * 0.40, lerp(keel, chY, 0.38)]);               // 1
      P.push([bw * 0.76, lerp(keel, chY, 0.76)]);               // 2
      P.push([bw, chY]);                                        // 3 折角
      P.push([bw, chY]);                                        // 4 折角（断法线）
      P.push([gw * 1.03, lerp(chY, gY, 0.56)]);                 // 5 舷侧
      P.push([gw, gY]);                                         // 6 舷缘
      P.push([gw, gY]);                                         // 7 舷缘（断法线）
      const dk = [[gw * 0.90, lerp(gY, dY, 0.26)], [gw * 0.72, lerp(gY, dY, 0.58)],
                  [gw * 0.46, lerp(gY, dY, 0.86)], [gw * 0.20, dY - 0.006]];
      const wl = [[gw * 0.93, lerp(gY, wf, 0.46)], [gw * 0.78, wf + 0.02],
                  [gw * 0.46, wf], [gw * 0.38, lerp(wf, dY, 0.62)]];
      for (let i = 0; i < 4; i++) P.push([lerp(dk[i][0], wl[i][0], wk), lerp(dk[i][1], wl[i][1], wk)]);  // 8..11
      P.push([0, dY]);                                          // 12 甲板中心
      for (let i = 11; i >= 1; i--) P.push([-P[i][0], P[i][1]]); // 13..23 镜像
      P.push([P[0][0], P[0][1]]);                               // 24 接缝
      return { bw, keel, chY, gw, gY, dY, wk, P };
    }

    // 环上各点的 v：手工分带（艇底 0~0.14 / 舷侧 0.14~0.36 / 甲板 0.36~0.5），上下镜像
    const SKI_RING_V = (() => {
      const h = [0, 0.055, 0.108, 0.140, 0.140, 0.262, 0.360, 0.360, 0.386, 0.412, 0.446, 0.476, 0.5];
      const v = h.slice();
      for (let i = 13; i <= 24; i++) v.push(1 - h[24 - i]);
      return v;
    })();
    const SKI_V_CH = 0.140, SKI_V_GU = 0.360, SKI_V_W0 = 0.476, SKI_V_W1 = 0.386;

    // 艇体环（带艏艉外飘/前倾），loft 与封头共用
    function skiHullRing(u) {
      const S = skiSection(u), x = u * SKI_LEN;
      const span = Math.max(0.06, S.dY - S.keel);
      const rakeF = smoothstep(0.40, 1.0, u) * 0.40;    // 艏部前倾（下缘后掠）
      const rakeA = smoothstep(-0.52, -1.0, u) * 0.26;  // 艉部内收
      return S.P.map(p => {
        const h = clamp((p[1] - S.keel) / span, 0, 1);
        return [x - (rakeF - rakeA) * (1 - h) * (1 - h), p[1], p[0]];
      });
    }

    /* 涂装贴图：768×512，v 方向按 SKI_RING_V 分带，上下镜像 */
    function makeSkiLivery(color, num) {
      const W = 768, H = 512;
      const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
      const tc = document.createElement('canvas'); tc.width = W; tc.height = H;
      const c = cv.getContext('2d'), g = tc.getContext('2d');
      const BODY = skiHex(color), DEEP = skiHex(skiMul(color, 0.30)), LITE = skiHex(skiMul(color, 1.30));
      const DARK = skiHex(0x23282f), GREY = skiHex(0xbcc5cc);
      // 浅色车身翻转条纹配色，保证任何车身色都有对比
      const lum = ((color >> 16 & 255) * 0.30 + (color >> 8 & 255) * 0.59 + (color & 255) * 0.11) / 255;
      const WHITE = lum > 0.62 ? skiHex(0x2b3440) : skiHex(0xf3f7f9);
      const GRAPH = lum > 0.62 ? skiHex(0x0d1116) : skiHex(0x3f4952);
      const Y = (v) => (1 - v) * H;
      const yCh = Y(SKI_V_CH), yGu = Y(SKI_V_GU), yMid = H / 2;
      const fh = yCh - yGu, dh = yGu - yMid;

      /* 1 · 艇底：深色 V 底 + 龙骨条 */
      g.fillStyle = DEEP; g.fillRect(0, yCh, W, H - yCh);
      g.fillStyle = DARK; g.fillRect(0, yCh + fh * 0.02, W, (H - yCh) * 0.42);
      g.fillStyle = GREY; g.fillRect(0, H - 7, W, 7);

      /* 2 · 舷侧：车身色 + 白色扫掠带 + 石墨勾边 */
      g.fillStyle = BODY; g.fillRect(0, yGu, W, fh);
      const YT = (k) => yGu + fh * k;
      const sweep = () => {
        g.beginPath();
        g.moveTo(W, YT(0.28));
        g.bezierCurveTo(W * 0.70, YT(0.38), W * 0.42, YT(0.56), 0, YT(0.60));
        g.lineTo(0, YT(0.73));
        g.bezierCurveTo(W * 0.42, YT(0.70), W * 0.70, YT(0.66), W, YT(0.93));
        g.closePath();
      };
      sweep(); g.fillStyle = WHITE; g.fill();
      g.lineWidth = Math.max(3, fh * 0.05); g.strokeStyle = GRAPH; sweep(); g.stroke();
      // 舷缘防撞条 + 折角高光线
      g.fillStyle = GRAPH; g.fillRect(0, yGu, W, fh * 0.085);
      g.fillStyle = DEEP;  g.fillRect(0, YT(0.955), W, fh * 0.045);
      // 艉部 sponson 暗块
      g.fillStyle = GRAPH; g.fillRect(0, YT(0.74), W * 0.24, fh * 0.26);
      g.fillStyle = LITE;  g.fillRect(0, YT(0.715), W * 0.24, fh * 0.03);
      // 赛车号
      g.fillStyle = GRAPH; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.font = `bold ${Math.round(fh * 0.30)}px Helvetica, Arial, sans-serif`;
      g.fillText(String(num), W * 0.34, YT(0.665));

      /* 3 · 甲板 / 艏罩：车身色为主，中央白条 */
      g.fillStyle = BODY; g.fillRect(0, yMid, W, dh);
      g.fillStyle = WHITE;
      g.beginPath(); g.moveTo(W, yMid); g.lineTo(W, yMid + dh * 0.30);
      g.lineTo(W * 0.60, yMid + dh * 0.14); g.lineTo(W * 0.60, yMid); g.closePath(); g.fill();
      g.fillStyle = GRAPH; g.fillRect(W * 0.585, yMid, W * 0.018, dh);    // 机罩缝
      g.fillStyle = DEEP;  g.fillRect(0, yMid, W * 0.585, dh * 0.26);     // 座椅基座侧壁
      g.fillStyle = skiHex(0x707b85); g.fillRect(0, yMid + dh * 0.30, W * 0.042, dh * 0.70);  // 艉登艇平台

      /* 4 · 脚踏槽防滑垫（菱形纹） */
      const yw0 = Y(SKI_V_W0), yw1 = Y(SKI_V_W1);
      g.save(); g.beginPath(); g.rect(W * 0.048, yw0, W * 0.540, yw1 - yw0); g.clip();
      g.fillStyle = DARK; g.fillRect(0, 0, W, H);
      g.strokeStyle = skiHex(0x39414a); g.lineWidth = 1.2;
      const dw = (yw1 - yw0) * 1.9;                     // 让菱形在 3D 上接近 45°
      for (let k = -6; k < 40; k++) {
        g.beginPath(); g.moveTo(k * dw * 0.5, yw0 - 4); g.lineTo(k * dw * 0.5 + dw, yw1 + 4); g.stroke();
        g.beginPath(); g.moveTo(k * dw * 0.5, yw1 + 4); g.lineTo(k * dw * 0.5 + dw, yw0 - 4); g.stroke();
      }
      g.restore();

      /* 5 · 粗糙度 / 金属度贴图：G=粗糙、B=金属（胶衣亮、防滑垫哑） */
      const rq = document.createElement('canvas'); rq.width = W >> 1; rq.height = H >> 1;
      const r = rq.getContext('2d'), RW = rq.width, RH = rq.height, k2 = 0.5;
      const band = (css, x, w, y0, y1) => {                 // 同时画本体与上下镜像
        r.fillStyle = css;
        r.fillRect(x, y0 * k2, w, (y1 - y0) * k2);
        r.fillRect(x, RH - y1 * k2, w, (y1 - y0) * k2);
      };
      r.fillStyle = 'rgb(0,46,92)'; r.fillRect(0, 0, RW, RH);                 // 胶衣：亮
      band('rgb(0,112,58)', 0, RW, yCh, H);                                   // 艇底：半哑
      band('rgb(0,225,12)', RW * 0.048, RW * 0.540, yw0, yw1);                // 防滑垫：全哑
      band('rgb(0,225,12)', 0, RW * 0.09, yMid, yGu);                         // 艉甲板
      band('rgb(0,160,26)', 0, RW * 0.60, yMid, yw0);                         // 座椅基座侧壁

      c.drawImage(tc, 0, 0);
      c.save(); c.beginPath(); c.rect(0, 0, W, H / 2); c.clip();
      c.translate(0, H); c.scale(1, -1); c.drawImage(tc, 0, 0); c.restore();

      const t = new THREE.CanvasTexture(cv);
      t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
      const tr = new THREE.CanvasTexture(rq);
      return { map: t, rough: tr };
    }

    function buildJetSki(color) {
      const g = new THREE.Group();
      const sn = _skiSerial++;                                   // 0..3
      const withPax = (sn === 1 || sn === 2);
      const liv = makeSkiLivery(color, sn + 1);
      const hullMat = new THREE.MeshStandardMaterial({
        map: liv.map, roughnessMap: liv.rough, metalnessMap: liv.rough,
        roughness: 1.0, metalness: 1.0,
      });
      const bodyMat = new THREE.MeshStandardMaterial({ color: skiCol(color), roughness: 0.20, metalness: 0.30 });

      /* --- 1 · 艇体 --- */
      const hull = new THREE.Mesh(skiLoft(28, (s) => skiHullRing(-1 + 2 * s), SKI_RING_V, false, false), hullMat);
      hull.castShadow = true; g.add(hull);

      // 艉板 / 艏封头
      const capG = (u, flip) => {
        const R = skiHullRing(u), pos = [], idx = [];
        let cx = 0, cy = 0, cz = 0;
        for (let i = 0; i < R.length - 1; i++) { cx += R[i][0]; cy += R[i][1]; cz += R[i][2]; }
        const n = R.length - 1;
        pos.push(cx / n, cy / n, cz / n);
        for (const p of R) pos.push(p[0], p[1], p[2]);
        for (let i = 1; i < R.length; i++) flip ? idx.push(0, i + 1, i) : idx.push(0, i, i + 1);
        const bg = new THREE.BufferGeometry();
        bg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        bg.setIndex(idx); bg.computeVertexNormals(); return bg;
      };
      g.add(new THREE.Mesh(capG(-1, false), SKI_MAT.stern));
      g.add(new THREE.Mesh(capG(1, true), bodyMat));

      /* --- 2 · sponson（艉部舷外稳定鳍） --- */
      for (const sd of [1, -1]) {
        const sp = skiLoft(6, (s) => {
          const u = lerp(-0.88, -0.26, s), x = u * SKI_LEN, S = skiSection(u);
          const out = (S.bw + 0.12) * (1 - Math.pow(s, 2.4) * 0.99);
          const inn = S.bw - 0.03;
          return [
            [x, S.chY + 0.14, sd * inn],
            [x, S.chY + 0.02, sd * Math.max(inn, out)],
            [x, S.chY - 0.14, sd * inn],
            [x, S.chY + 0.14, sd * inn],
          ];
        }, null, true, true);
        const m = new THREE.Mesh(sp, bodyMat);
        m.castShadow = true; g.add(m);
      }

      /* --- 3 · 艉部：泵嘴 / 踏板 / 抓手 / 进水格栅 --- */
      const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.20, 0.15, 0.30, 10), SKI_MAT.dark);
      nozzle.rotation.z = Math.PI / 2; nozzle.position.set(-2.30, -0.24, 0); g.add(nozzle);
      const nring = new THREE.Mesh(new THREE.TorusGeometry(0.175, 0.038, 5, 12), SKI_MAT.chrome);
      nring.rotation.y = Math.PI / 2; nring.position.set(-2.43, -0.24, 0); g.add(nring);
      const step = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.05, 1.04), SKI_MAT.grip);
      step.position.set(-2.28, 0.325, 0); g.add(step);
      const handle = new THREE.Mesh(new THREE.TorusGeometry(0.20, 0.030, 5, 14, Math.PI), SKI_MAT.chrome);
      handle.rotation.y = Math.PI / 2; handle.position.set(-2.06, 0.66, 0); g.add(handle);
      for (const sd of [1, -1]) g.add(skiLimb([-2.06, 0.40, sd * 0.20], [-2.06, 0.68, sd * 0.20], 0.028, SKI_MAT.chrome, 6));
      const keelY = skiSection(-0.48).keel;
      const grate = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.05, 0.40), SKI_MAT.dark);
      grate.position.set(-1.20, keelY + 0.035, 0); g.add(grate);
      for (let i = 0; i < 3; i++) {
        const sl = new THREE.Mesh(new THREE.BoxGeometry(0.90, 0.045, 0.045), SKI_MAT.chrome);
        sl.position.set(-1.20, keelY + 0.055, -0.13 + i * 0.13); g.add(sl);
      }

      /* --- 4 · 座垫（双层：前驾驶 + 后乘客） --- */
      const seatG = skiLoft(13, (s) => {
        const x = lerp(-1.90, 0.38, s);
        const top = lerp(1.13, 0.99, smoothstep(0.18, 0.44, s))
                  - smoothstep(0.80, 1.0, s) * 0.14 - (1 - smoothstep(0.0, 0.10, s)) * 0.10;
        const w = lerp(0.25, 0.355, smoothstep(0.0, 0.26, s)) * (1 - smoothstep(0.72, 1.0, s) * 0.42);
        const bot = lerp(0.40, 0.60, smoothstep(0.0, 0.32, s));
        const R = [[0, top], [w * 0.56, top - 0.020], [w * 0.96, top - 0.115], [w, bot + 0.08], [w * 0.90, bot], [0, bot]];
        const full = R.concat([[-R[4][0], R[4][1]], [-R[3][0], R[3][1]], [-R[2][0], R[2][1]], [-R[1][0], R[1][1]], [0, top]]);
        return full.map(p => [x, p[1], p[0]]);
      }, null, true, true);
      // 坐垫双色：顶面浅、侧裙深
      {
        const cnt = seatG.attributes.position.count, col = new Float32Array(cnt * 3);
        const A = skiCol(0x4a535e), B = skiCol(0x1b1f25);
        for (let i = 0; i < cnt; i++) {
          const j = i % 11, up = (j === 0 || j === 1 || j === 9 || j === 10) ? 1 : (j === 2 || j === 8) ? 0.45 : 0;
          col[i * 3] = lerp(B.r, A.r, up); col[i * 3 + 1] = lerp(B.g, A.g, up); col[i * 3 + 2] = lerp(B.b, A.b, up);
        }
        seatG.setAttribute('color', new THREE.BufferAttribute(col, 3));
      }
      const seat = new THREE.Mesh(seatG, SKI_MAT.seat);
      seat.castShadow = true; g.add(seat);

      /* --- 5 · 操控台：车把罩 + 车把 / 握把 / 后视镜 / 仪表 / 挡风 --- */
      const consoleG = skiLoft(8, (s) => {
        const y = lerp(0.50, 1.34, s);
        const cx = lerp(0.70, 0.94, Math.pow(s, 1.10));
        const w = lerp(0.42, 0.215, Math.pow(s, 0.80));        // 半宽（z）
        const d = lerp(0.38, 0.235, Math.pow(s, 1.30));        // 半长（x）
        const k = lerp(1.80, 1.15, s);                         // 超椭圆：下方方、上方圆
        const R = [];
        for (let i = 0; i <= 10; i++) {
          const a = i / 10 * Math.PI * 2;
          const ca = Math.cos(a), sa = Math.sin(a);
          R.push([cx + d * Math.sign(ca) * Math.pow(Math.abs(ca), 2 / k), y,
                       w * Math.sign(sa) * Math.pow(Math.abs(sa), 2 / k)]);
        }
        return R;
      }, null, true, true);
      const cons = new THREE.Mesh(consoleG, bodyMat);
      cons.castShadow = true; g.add(cons);
      const consTop = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.11, 0.42), SKI_MAT.dark);
      consTop.position.set(0.92, 1.37, 0); consTop.rotation.z = -0.22; g.add(consTop);
      // 仪表屏
      const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.28, 0.26), SKI_MAT.dash);
      scr.position.set(0.98, 1.425, 0); scr.rotation.set(-Math.PI / 2, 0, 0); scr.rotateY(0.55); g.add(scr);
      const scrRim = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.04, 0.32), SKI_MAT.grip);
      scrRim.position.set(0.98, 1.41, 0); scrRim.rotation.z = -0.32; g.add(scrRim);

      // 车把
      const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.042, 1.02, 8), SKI_MAT.chrome);
      bar.rotation.x = Math.PI / 2; bar.position.set(0.72, 1.49, 0); g.add(bar);
      const barPad = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.09, 0.32), SKI_MAT.grip);
      barPad.position.set(0.73, 1.525, 0); g.add(barPad);
      for (const sd of [1, -1]) {
        const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.060, 0.056, 0.28, 8), SKI_MAT.grip);
        grip.rotation.x = Math.PI / 2; grip.position.set(0.71, 1.49, sd * 0.49); g.add(grip);
        const end = new THREE.Mesh(new THREE.CylinderGeometry(0.068, 0.068, 0.05, 8), SKI_MAT.chrome);
        end.rotation.x = Math.PI / 2; end.position.set(0.71, 1.49, sd * 0.645); g.add(end);
        // 后视镜：从车把罩两侧伸出
        g.add(skiLimb([0.88, 1.35, sd * 0.19], [0.96, 1.50, sd * 0.42], 0.024, SKI_MAT.dark, 6));
        const mir = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.13, 0.21), SKI_MAT.dark);
        mir.position.set(0.98, 1.54, sd * 0.45); mir.rotation.y = -sd * 0.30; g.add(mir);
        const face = new THREE.Mesh(new THREE.PlaneGeometry(0.17, 0.10), SKI_MAT.chrome);
        face.position.set(0.945, 1.54, sd * 0.45); face.rotation.y = -Math.PI / 2 - sd * 0.30; g.add(face);
      }
      // 节流阀扳机（右手）
      const thr = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.045, 0.15), SKI_MAT.dark);
      thr.position.set(0.79, 1.435, 0.43); thr.rotation.z = -0.45; g.add(thr);

      // 挡风：贴在车把罩前缘
      const wsG = new THREE.PlaneGeometry(0.70, 0.26, 8, 2);
      const wp = wsG.attributes.position;
      for (let i = 0; i < wp.count; i++) {
        const zz = wp.getX(i), yy = wp.getY(i);
        wp.setXYZ(i, -Math.pow(zz / 0.35, 2) * 0.13 - yy * 0.40, yy, zz);
      }
      wsG.computeVertexNormals();
      const ws = new THREE.Mesh(wsG, SKI_MAT.glass);
      ws.position.set(1.12, 1.55, 0); g.add(ws);
      const wsTrim = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.68, 6), SKI_MAT.dark);
      wsTrim.rotation.x = Math.PI / 2; wsTrim.position.set(1.07, 1.42, 0); g.add(wsTrim);

      /* --- 6 · 骑手 --- */
      function buildRider(o) {
        const R = new THREE.Group();
        const skin = SKI_MAT.skin[o.skin], vest = SKI_MAT.vest[o.vest], short = SKI_MAT.short[o.short];
        const hip = o.hip, sh = o.sh, hd = o.hd;

        // 髋 / 躯干 / 救生衣
        const belly = skiLimb([hip[0] - 0.06, hip[1] - 0.04, 0], [hip[0] + 0.20, hip[1] + 0.16, 0], 0.205, short, 7);
        belly.scale.z = 1.20; R.add(belly);
        const chest = skiLimb([lerp(hip[0], sh[0], 0.22), lerp(hip[1], sh[1], 0.22), 0], [sh[0], sh[1] - 0.02, 0], 0.235, vest, 8);
        chest.scale.z = 1.16; R.add(chest);
        for (const sd of [1, -1]) {   // 救生衣肩片
          R.add(skiLimb([sh[0] - 0.14, sh[1] + 0.06, sd * 0.13], [sh[0] + 0.04, sh[1] + 0.03, sd * 0.26], 0.078, vest, 6));
        }
        // 背后收紧带（追拍镜头正对着这一面）
        {
          const dx = sh[0] - hip[0], dy = sh[1] - hip[1], dl = Math.hypot(dx, dy) || 1;
          const nx = -dy / dl, ny = dx / dl;                    // 指向后背的法线
          for (const k of [0.34, 0.62]) {
            const bx = lerp(hip[0], sh[0], k) + nx * 0.215, by = lerp(hip[1], sh[1], k) + ny * 0.215;
            R.add(skiLimb([bx, by, -0.22], [bx, by, 0.22], 0.035, SKI_MAT.strap, 6));
          }
        }

        // 颈 / 头
        R.add(skiLimb([sh[0] + 0.03, sh[1] + 0.04, 0], [hd[0] - 0.05, hd[1] - 0.13, 0], 0.082, skin, 6));
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.185, 10, 7), skin);
        head.position.set(hd[0], hd[1], 0); head.scale.set(1.0, 1.06, 0.94); R.add(head);
        if (o.helmet >= 0) {
          const hm = SKI_MAT.helm[o.helmet];
          const hel = new THREE.Mesh(new THREE.SphereGeometry(0.215, 11, 8), hm);
          hel.position.set(hd[0] - 0.02, hd[1] + 0.03, 0); hel.scale.set(1.02, 1.02, 0.98); R.add(hel);
          const vis = new THREE.Mesh(new THREE.SphereGeometry(0.219, 9, 5, -0.85, 1.7, 0.95, 0.62), SKI_MAT.lens);
          vis.position.copy(hel.position); vis.scale.copy(hel.scale); vis.rotation.z = -0.16; R.add(vis);
          const chin = new THREE.Mesh(new THREE.SphereGeometry(0.20, 8, 5, -0.8, 1.6, 1.5, 0.9), hm);
          chin.position.set(hd[0] - 0.01, hd[1] + 0.02, 0); chin.scale.set(1.28, 1.10, 0.98); R.add(chin);
          // 头盔中央撞色条（追拍镜头看到的就是后脑）
          const stripe = new THREE.Mesh(new THREE.TorusGeometry(0.222, 0.030, 4, 10, Math.PI * 0.95), bodyMat);
          stripe.position.copy(hel.position); stripe.rotation.z = 0.30; R.add(stripe);
        } else {
          const cm = SKI_MAT.cap[o.cap];
          const cap = new THREE.Mesh(new THREE.SphereGeometry(0.196, 10, 5, 0, Math.PI * 2, 0, Math.PI * 0.56), cm);
          cap.position.set(hd[0] - 0.01, hd[1] + 0.025, 0); R.add(cap);
          const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.20, 0.20, 0.03, 8, 1, false, -0.85, 1.7), cm);
          brim.position.set(hd[0] + 0.05, hd[1] + 0.095, 0); brim.rotation.z = 0.20; R.add(brim);
          const sg = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.075, 0.30), SKI_MAT.lens);
          sg.position.set(hd[0] + 0.155, hd[1] - 0.01, 0); sg.rotation.z = 0.10; R.add(sg);
        }

        // 手臂：肩 → 肘 → 手（真够到握把）
        for (const sd of [1, -1]) {
          const S = [sh[0], sh[1] - 0.04, sd * 0.235], E = [o.el[0], o.el[1], sd * o.el[2]], Hd = [o.hand[0], o.hand[1], sd * o.hand[2]];
          R.add(skiLimb(S, E, 0.079, skin));
          R.add(skiLimb(E, Hd, 0.066, skin));
          const hand = new THREE.Mesh(new THREE.SphereGeometry(0.075, 6, 5), skin);
          hand.position.set(Hd[0], Hd[1], Hd[2]); hand.scale.set(1.2, 1.0, 1.3); R.add(hand);
        }
        // 腿：胯 → 膝 → 踝 + 脚（膝盖收进脚踏槽）
        for (const sd of [1, -1]) {
          const Hp = [hip[0] + 0.03, hip[1] - 0.11, sd * 0.185], K = [o.knee[0], o.knee[1], sd * o.knee[2]], A = [o.ank[0], o.ank[1], sd * o.ank[2]];
          R.add(skiLimb(Hp, K, 0.122, short, 7));
          R.add(skiLimb(K, A, 0.088, skin, 6));
          const foot = new THREE.Mesh(new THREE.BoxGeometry(0.30, 0.09, 0.15), SKI_MAT.grip);
          foot.position.set(A[0] + 0.03, A[1] - 0.08, A[2]); R.add(foot);
        }
        R.traverse(m => { if (m.isMesh) m.castShadow = true; });
        return R;
      }

      const riders = new THREE.Group();
      riders.add(buildRider({
        skin: sn % 3, vest: sn % 4, short: sn % 3,
        helmet: (sn % 2 === 0) ? (sn === 0 ? 1 : 2) : -1, cap: sn % 2,
        hip: [-0.62, 1.10, 0], sh: [0.04, 1.78, 0], hd: [0.26, 2.06, 0],
        el: [0.34, 1.60, 0.44], hand: [0.70, 1.50, 0.47],
        knee: [-0.02, 0.86, 0.42], ank: [-0.46, 0.36, 0.46],
      }));
      if (withPax) {
        riders.add(buildRider({
          skin: (sn + 2) % 3, vest: (sn + 2) % 4, short: (sn + 1) % 3,
          helmet: -1, cap: (sn + 1) % 2,
          hip: [-1.50, 1.20, 0], sh: [-1.08, 1.86, 0], hd: [-0.90, 2.13, 0],
          el: [-0.96, 1.54, 0.34], hand: [-0.76, 1.28, 0.25],
          knee: [-0.82, 0.96, 0.44], ank: [-1.20, 0.40, 0.48],
        }));
      }
      g.add(riders);
      g.userData.rider = riders;
      return g;
    }


    const SKI_DEFS = [
      { c: [175, 175], a: 92, b: 66, w: 0.255, ph: 0.0, col: 0xff4a35, wob: 16 },
      { c: [95, 235],  a: 66, b: 58, w: -0.30, ph: 1.9, col: 0xffd233, wob: 11 },
      { c: [255, 95],  a: 74, b: 84, w: 0.215, ph: 3.4, col: 0x35e0ff, wob: 19 },
      { c: [205, 262], a: 58, b: 46, w: -0.36, ph: 5.1, col: 0xf5f7fa, wob: 9 },
    ];
    const skiPos = (d, t) => {
      const a = d.w * t + d.ph;
      return new THREE.Vector2(
        d.c[0] + d.a * Math.cos(a) + d.wob * Math.sin(a * 2.7 + d.ph),
        d.c[1] + d.b * Math.sin(a) + d.wob * Math.cos(a * 2.1 - d.ph)
      );
    };
    const skis = SKI_DEFS.map(d => { const m = buildJetSki(d.col); scene.add(m); return { def: d, mesh: m, prevYaw: 0, roll: 0, trail: [], trailT: 0 }; });

    const TRAIL_SEG = 46;
    const trailMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.DoubleSide,
      uniforms: { uTime: waterUniforms.uTime, uFoam: waterUniforms.uFoam },
      vertexShader: `
        attribute vec4 color;
        varying vec4 vCol; varying vec2 vUv; varying vec3 vWorld;
        void main(){ vCol = color; vUv = uv;
          vWorld = (modelMatrix * vec4(position, 1.0)).xyz;
          gl_Position = projectionMatrix * viewMatrix * vec4(vWorld, 1.0); }`,
      fragmentShader: `
        uniform float uTime; uniform vec3 uFoam;
        varying vec4 vCol; varying vec2 vUv; varying vec3 vWorld;
        float hash21(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
        float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
          return mix(mix(hash21(i), hash21(i + vec2(1.0, 0.0)), f.x),
                     mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), f.x), f.y); }
        float fbm(vec2 p){ float s = 0.0, a = 0.5; for(int i = 0; i < 3; i++){ s += a * vn(p); p *= 2.1; a *= 0.5; } return s; }
        void main(){
          float edge = 1.0 - abs(vUv.y * 2.0 - 1.0);
          float n = fbm(vWorld.xz * 0.55 + vec2(uTime * 0.25, -uTime * 0.18));
          float churn = fbm(vWorld.xz * 1.6 - uTime * 0.4);
          float a = vCol.a * pow(edge, 0.75) * (0.30 + 0.80 * n);
          a *= mix(1.0, smoothstep(0.12, 0.78, churn), vUv.x * 0.95);   // 越老越碎
          if (a < 0.01) discard;
          gl_FragColor = vec4(uFoam * (0.9 + 0.25 * churn), clamp(a, 0.0, 1.0));
        }`,
    });
    for (const s of skis) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(TRAIL_SEG * 2 * 3), 3));
      g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(TRAIL_SEG * 2 * 4), 4));
      const uvs = new Float32Array(TRAIL_SEG * 2 * 2);
      for (let i = 0; i < TRAIL_SEG; i++) {
        const u = i / (TRAIL_SEG - 1);
        uvs[i * 4] = u; uvs[i * 4 + 1] = 0;
        uvs[i * 4 + 2] = u; uvs[i * 4 + 3] = 1;
      }
      g.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
      const idx = [];
      for (let i = 0; i < TRAIL_SEG - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
      g.setIndex(idx);
      const m = new THREE.Mesh(g, trailMat);
      m.frustumCulled = false; m.renderOrder = 5;
      scene.add(m);
      s.trailMesh = m;
    }

    function sprayTexture() {
      const s = 64, cv = document.createElement('canvas'); cv.width = cv.height = s;
      const g = cv.getContext('2d');
      const rad = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
      rad.addColorStop(0, 'rgba(255,255,255,1)');
      rad.addColorStop(0.35, 'rgba(240,252,255,.72)');
      rad.addColorStop(1, 'rgba(220,244,255,0)');
      g.fillStyle = rad; g.fillRect(0, 0, s, s);
      const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
    }
    const SPRAY_N = 1400;
    const sprayPos = new Float32Array(SPRAY_N * 3);
    const sprayVel = new Float32Array(SPRAY_N * 3);
    const sprayAge = new Float32Array(SPRAY_N);
    const sprayLife = new Float32Array(SPRAY_N);
    const spraySize = new Float32Array(SPRAY_N);
    const sprayAlpha = new Float32Array(SPRAY_N);
    for (let i = 0; i < SPRAY_N; i++) { sprayAge[i] = 1e9; sprayLife[i] = 1; sprayPos[i * 3 + 1] = -999; }
    const sprayGeo = new THREE.BufferGeometry();
    sprayGeo.setAttribute('position', new THREE.BufferAttribute(sprayPos, 3));
    sprayGeo.setAttribute('aSize', new THREE.BufferAttribute(spraySize, 1));
    sprayGeo.setAttribute('aAlpha', new THREE.BufferAttribute(sprayAlpha, 1));
    const sprayPts = new THREE.Points(sprayGeo, new THREE.ShaderMaterial({
      transparent: true, depthWrite: false,
      uniforms: { uTex: { value: sprayTexture() }, uColor: { value: C_FOAM.clone() } },
      vertexShader: `
        attribute float aSize; attribute float aAlpha; varying float vA;
        void main(){ vA = aAlpha;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = min(aSize * (320.0 / max(-mv.z, 1.0)), 46.0);   // 别让贴脸的水花糊满屏
          gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `
        uniform sampler2D uTex; uniform vec3 uColor; varying float vA;
        void main(){ vec4 t = texture2D(uTex, gl_PointCoord);
          if (t.a * vA < 0.01) discard;
          gl_FragColor = vec4(uColor, t.a * vA); }`,
    }));
    sprayPts.frustumCulled = false; sprayPts.renderOrder = 6;
    scene.add(sprayPts);
    let sprayCur = 0;
    function emitSpray(x, y, z, vx, vy, vz, size, life) {
      const i = sprayCur = (sprayCur + 1) % SPRAY_N;
      sprayPos[i * 3] = x; sprayPos[i * 3 + 1] = y; sprayPos[i * 3 + 2] = z;
      sprayVel[i * 3] = vx; sprayVel[i * 3 + 1] = vy; sprayVel[i * 3 + 2] = vz;
      spraySize[i] = size; sprayAge[i] = 0; sprayLife[i] = life;
    }

    /* 海鸥：机身 +X，翼展 ±Z，上灰下白、黑翼尖，肩/肘两段可动 */
    const birds = [];
    {
      // 展向-弦向网格：带弯度(camber)、后掠(sweep)、翼尖收缩，翼尖段单独分材质做黑斑
      function wingPanel(side, o) {
        const NS = 14, NC = 6, stride = NC + 1, pos = [], idx = [];
        for (let i = 0; i <= NS; i++) {
          const t = i / NS;
          // 弦长/后掠用指数曲线：臂段近似等弦，手段(初级飞羽)急收并后掠
          const c = (o.c0 + (o.c1 - o.c0) * Math.pow(t, o.ce || 1)) * (1 + (o.bulge || 0) * Math.sin(Math.PI * t))
                  * (o.notch ? 1 + 0.055 * Math.sin(t * 16) : 1);
          const xle = o.le0 + (o.le1 - o.le0) * Math.pow(t, o.se || 1);
          for (let j = 0; j <= NC; j++) {
            const v = j / NC;
            pos.push(xle - v * c,
                     o.camber * Math.sin(Math.PI * v) * (1 - 0.4 * t) + (o.droop || 0) * t * t,
                     side * t * o.L);
          }
        }
        const splitAt = o.dark !== undefined ? Math.round(NS * o.dark) : NS + 1;
        let firstDark = -1;
        for (let i = 0; i < NS; i++) {
          if (i === splitAt) firstDark = idx.length;
          for (let j = 0; j < NC; j++) {
            const a = i * stride + j, b = (i + 1) * stride + j;
            if (side > 0) idx.push(a, b, b + 1, a, b + 1, a + 1);
            else idx.push(a, b + 1, b, a, a + 1, b + 1);
          }
        }
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        g.setIndex(idx);
        // 材质数组必须有 group，否则不会被绘制
        if (firstDark >= 0) { g.addGroup(0, firstDark, 0); g.addGroup(firstDark, idx.length - firstDark, 1); }
        else g.addGroup(0, idx.length, 0);
        g.computeVertexNormals();
        return g;
      }

      // 躺卧的旋转体做流线型身体（短而厚，龙骨略深）
      const bodyProf = [[-0.80, 0.005], [-0.66, 0.085], [-0.48, 0.150], [-0.26, 0.213], [0.00, 0.258],
                        [0.20, 0.272], [0.38, 0.258], [0.52, 0.214], [0.62, 0.150], [0.68, 0.078], [0.70, 0.004]];
      const bodyGeo = new THREE.LatheGeometry(bodyProf.map(p => new THREE.Vector2(p[1], p[0])), 14);
      {   // 顶点色：背部染灰(与翼面同色)，腹部与头颈保持白
        const p = bodyGeo.attributes.position, col = [], wt = srgb(0xf6f9fb), gr = srgb(0xbcc9d3);
        for (let i = 0; i < p.count; i++) {
          const x = p.getX(i), ax = p.getY(i), z = p.getZ(i), r = Math.hypot(x, z) || 1e-4;
          // 旋转后 local -X 朝上；仅背部(躯干中段)上染色
          const k = smoothstep(-0.10, -0.80, x / r) * smoothstep(0.60, 0.36, ax) * smoothstep(-0.78, -0.52, ax);
          col.push(lerp(wt.r, gr.r, k), lerp(wt.g, gr.g, k), lerp(wt.b, gr.b, k));
        }
        bodyGeo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
      }
      const headGeo = new THREE.SphereGeometry(0.208, 14, 10);
      const neckGeo = new THREE.CapsuleGeometry(0.148, 0.16, 3, 9);
      const beakGeo = new THREE.ConeGeometry(0.056, 0.30, 7);
      const eyeGeo  = new THREE.SphereGeometry(0.040, 6, 5);

      const INNER = { L: 1.05, c0: 0.66, c1: 0.58, le0: 0.36, le1: 0.30, camber: 0.055, bulge: 0.07 };
      const OUTER = { L: 1.35, c0: 0.58, c1: 0.07, le0: 0.30, le1: -0.06, camber: 0.038, droop: -0.04,
                      ce: 1.9, se: 1.5, notch: true, dark: 0.60 };
      // 尾羽：前窄后展的扇形（前缘随展向大幅后掠）
      const TAIL  = { L: 0.30, c0: 0.68, c1: 0.24, le0: -0.52, le1: -0.96, camber: 0.02, se: 0.85 };
      const wingGeo = { 1: { in: wingPanel(1, INNER), out: wingPanel(1, OUTER), tail: wingPanel(1, TAIL) },
                       '-1': { in: wingPanel(-1, INNER), out: wingPanel(-1, OUTER), tail: wingPanel(-1, TAIL) } };

      const S = (c, r) => new THREE.MeshStandardMaterial({ color: srgb(c), roughness: r });
      const mWhite = S(0xf6f9fb, 0.78), mHead = S(0xfbfdfe, 0.72), mBeak = S(0xe8a92c, 0.55), mEye = S(0x141a20, 0.5);
      const mBody = S(0xffffff, 0.78); mBody.vertexColors = true;
      const face = (c, r, side) => { const m = S(c, r); m.side = side; return m; };
      // 同一张曲面：正面(上表面)灰背，反面(下表面)白腹
      const topM = [face(0xbcc9d3, 0.85, THREE.FrontSide), face(0x2b3138, 0.8, THREE.FrontSide)];
      const botM = [face(0xf4f8fb, 0.85, THREE.BackSide), face(0x333a42, 0.8, THREE.BackSide)];
      const tailTop = [face(0xf1f5f9, 0.85, THREE.FrontSide)], tailBot = [face(0xf6fafd, 0.85, THREE.BackSide)];

      function makeGull() {
        const g = new THREE.Group(), wings = [];
        const body = new THREE.Mesh(bodyGeo, mBody);
        body.rotation.z = -Math.PI / 2; body.scale.set(1.1, 1, 0.86); g.add(body);
        const neck = new THREE.Mesh(neckGeo, mWhite); neck.position.set(0.66, 0.07, 0); neck.rotation.z = -1.05; g.add(neck);
        const head = new THREE.Mesh(headGeo, mHead); head.position.set(0.82, 0.14, 0); g.add(head);
        const beak = new THREE.Mesh(beakGeo, mBeak); beak.position.set(1.14, 0.10, 0); beak.rotation.z = -Math.PI / 2; g.add(beak);
        for (const s of [1, -1]) {
          const e = new THREE.Mesh(eyeGeo, mEye); e.position.set(0.90, 0.19, s * 0.135); g.add(e);
          const gg = wingGeo[s];
          g.add(new THREE.Mesh(gg.tail, tailTop), new THREE.Mesh(gg.tail, tailBot));
          const shoulder = new THREE.Group(); shoulder.position.set(0.10, 0.14, s * 0.20);
          shoulder.add(new THREE.Mesh(gg.in, topM), new THREE.Mesh(gg.in, botM));
          const elbow = new THREE.Group(); elbow.position.set(0, 0, s * INNER.L);
          elbow.add(new THREE.Mesh(gg.out, topM), new THREE.Mesh(gg.out, botM));
          shoulder.add(elbow); g.add(shoulder);
          wings.push({ shoulder, elbow, side: s });
        }
        g.userData.wings = wings;
        return g;
      }

      for (let i = 0; i < 9; i++) {
        const b = makeGull(), sc = rr(1.1, 1.75);
        b.scale.setScalar(sc);
        b.rotation.order = 'YXZ';
        Object.assign(b.userData, {
          r: rr(120, 320), y: rr(40, 110), s: rr(0.10, 0.2), ph: rr(0, 6.28),
          cx: rr(-60, 120), cz: rr(-40, 140), fs: rr(5.0, 6.6) / sc, sc,
        });
        scene.add(b); birds.push(b);
      }
    }
    /* 伴飞镜头的主角：绕岛一圈的规整航线，岛始终在圆心方向 */
    const heroGull = birds[birds.length - 1];
    heroGull.scale.setScalar(1.6);
    Object.assign(heroGull.userData, { r: 152, y: 45, s: 0.086, cx: 0, cz: 0, sc: 1.6, fs: 5.4 / 1.6 });

    /* ============================================================
       8b · 海滩俱乐部（东北弧：主亭 + 沙滩吧 + 更衣屋 + 伞阵 + 加密椰林）
       放在最后构建：前面各段对全局随机数的消耗顺序不受影响，原构图逐帧不变
       ============================================================ */
    const clubRoot = new THREE.Group();
    scene.add(clubRoot);
    {
      const clubKeepOut = [];                     // 椰子树避让区 {x, z, r}
      const P = (a, r) => [Math.cos(a) * r, Math.sin(a) * r];
      /* 沿射线二分：找到地形高度为 h 的半径（外侧解） */
      function shoreR(a, h) {
        let lo = coastRadius(a) * 0.42, hi = coastRadius(a) * 1.28;
        for (let i = 0; i < 30; i++) {
          const m = (lo + hi) / 2;
          if (terrainHeight(Math.cos(a) * m, Math.sin(a) * m) > h) lo = m; else hi = m;
        }
        return (lo + hi) / 2;
      }
      /* 把模板压成「每种材质一个 InstancedMesh」：几十份摆件只占几个 draw call */
      function packInstances(template, xforms) {
        template.updateMatrixWorld(true);
        const byMat = new Map(), m4 = new THREE.Matrix4();
        template.traverse(o => {
          if (!o.isMesh) return;
          const g = o.geometry.clone().applyMatrix4(m4.copy(o.matrixWorld)).toNonIndexed();
          for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
          const a = byMat.get(o.material); a ? a.push(g) : byMat.set(o.material, [g]);
        });
        for (const [mat, geos] of byMat) {
          const im = new THREE.InstancedMesh(mergeGeometries(geos), mat, xforms.length);
          xforms.forEach((m, i) => im.setMatrixAt(i, m));
          im.instanceMatrix.needsUpdate = true;
          im.castShadow = true; im.receiveShadow = true;
          clubRoot.add(im);
        }
      }
      const xform = (x, y, z, ry) => new THREE.Matrix4().compose(
        new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromAxisAngle(_rsUp, ry), new THREE.Vector3(1, 1, 1));

      /* --- 小家具 --- */
      function stool(g, x, y, z) {
        rsCyl(g, cushionMat, 0.27, 0.25, 0.11, 10, x, y + 0.68, z);
        rsCyl(g, rattanMat, 0.19, 0.25, 0.62, 8, x, y + 0.32, z);
        rsCyl(g, woodDarkMat, 0.27, 0.27, 0.05, 8, x, y + 0.22, z);
      }
      function chair(g, x, y, z, ry) {
        const c = new THREE.Group(); c.position.set(x, y, z); c.rotation.y = ry; g.add(c);
        rsBox(c, rattanMat, 0.64, 0.10, 0.62, 0, 0.47, 0);
        for (const [px, pz] of [[-0.26, -0.25], [0.26, -0.25], [-0.26, 0.25], [0.26, 0.25]])
          rsBox(c, woodDarkMat, 0.07, 0.47, 0.07, px, 0.235, pz);
        rsBox(c, rattanMat, 0.10, 0.66, 0.60, -0.29, 0.82, 0, 0, -0.14);
      }
      function table(g, x, y, z, r) {
        rsCyl(g, woodMat, r, r, 0.10, 14, x, y + 0.76, z);
        rsCyl(g, woodDarkMat, 0.10, 0.13, 0.70, 8, x, y + 0.39, z);
        rsCyl(g, woodDarkMat, r * 0.55, r * 0.62, 0.07, 12, x, y + 0.06, z);
      }
      /* 吧台后的酒瓶架 */
      function bottles(g, x, y, z, n, dz) {
        const hues = [0x3f7f5a, 0x8a4a2a, 0x2c5f86, 0xa8823c, 0x7a3050];
        for (let i = 0; i < n; i++) {
          const m = new THREE.MeshStandardMaterial({ color: srgb(hues[i % hues.length]), roughness: 0.25 });
          rsCyl(g, m, 0.055, 0.075, 0.30, 6, x, y + 0.15, z + i * dz);
          rsCyl(g, m, 0.022, 0.022, 0.12, 5, x, y + 0.36, z + i * dz);
        }
      }
      /* 木台：主梁 + 留缝板条 + 封边 + 短桩，返回台面高度 */
      function deck(g, w, d, deckY, groundAt) {
        const hw = w / 2, hd = d / 2;
        for (const bx of [-hw + 0.6, 0, hw - 0.6]) rsBox(g, woodDarkMat, 0.24, 0.30, d + 0.2, bx, deckY - 0.42, 0);
        rsPlanks(g, 0, -hd + 0.26, 0, hd - 0.26, deckY, deckY, w, 0.52, 0.43, woodMat, 0.17);
        for (const sx of [-1, 1]) rsBox(g, woodDarkMat, 0.16, 0.30, d + 0.3, sx * (hw + 0.07), deckY - 0.26, 0);
        for (const sz of [-1, 1]) rsBox(g, woodDarkMat, w + 0.3, 0.30, 0.16, 0, deckY - 0.26, sz * (hd + 0.07));
        for (const sx of [-1, 0, 1]) for (const sz of [-1, 1]) {
          const px = sx * (hw - 0.75), pz = sz * (hd - 0.75), gy = groundAt(px, pz) - 0.5;
          rsCyl(g, pileMat, 0.22, 0.26, deckY - 0.45 - gy, 8, px, (deckY - 0.45 + gy) / 2, pz);
        }
      }

      /* ============ 主亭：开敞式餐吧 ============ */
      function clubHouse(a) {
        const r = shoreR(a, 4.0), [x, z] = P(a, r);
        const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = -a; clubRoot.add(g);
        const ca = Math.cos(a), sa = Math.sin(a);
        const groundAt = (lx, lz) => terrainHeight(x + lx * ca - lz * sa, z + lx * sa + lz * ca);

        const W = 17.5, D = 12.5, hw = W / 2, hd = D / 2;
        let gmax = -99;
        for (const lx of [-hw, 0, hw]) for (const lz of [-hd, 0, hd]) gmax = Math.max(gmax, groundAt(lx, lz));
        const y = gmax + 0.85;
        deck(g, W, D, y, groundAt);

        /* 立柱 + 顶梁 + 茅草大屋顶 */
        const PH = 3.7;
        const posts = [];
        for (const px of [-hw + 0.8, -2.2, 4.6, hw - 0.8]) for (const pz of [-hd + 0.8, hd - 0.8]) posts.push([px, pz]);
        for (const [px, pz] of posts) {
          rsCyl(g, woodDarkMat, 0.19, 0.23, PH, 8, px, y + PH / 2, pz);
          rsStrut(g, woodDarkMat, px, y + PH - 0.95, pz, px + (px < 0 ? 0.95 : -0.95), y + PH - 0.06, pz, 0.075);
        }
        for (const pz of [-hd + 0.8, hd - 0.8]) rsBox(g, woodDarkMat, W - 1.0, 0.26, 0.22, 0, y + PH + 0.10, pz);
        rsBox(g, woodDarkMat, 0.22, 0.24, D - 1.2, -hw + 0.8, y + PH + 0.10, 0);
        rsBox(g, woodDarkMat, 0.22, 0.24, D - 1.2, hw - 0.8, y + PH + 0.10, 0);
        const roof = new THREE.Group(); roof.position.y = y + PH + 0.24; g.add(roof);
        rsThatch(roof, W + 3.4, D + 3.2, 7.2, 3.9, 8);
        rsCyl(roof, thatchMat2, 0.24, 0.24, 7.9, 6, 0, 3.92, 0, 0, Math.PI / 2);
        for (const ex of [-3.7, 3.7]) for (const s of [-1, 1])
          rsCyl(roof, woodDarkMat, 0.06, 0.06, 1.7, 5, ex, 4.22, 0, s * 0.6, 0);
        for (const sx of [-1, 1]) rsBox(roof, woodDarkMat, 0.18, 0.20, D + 3.4, sx * (W + 3.4) / 2, -0.04, 0);

        /* 吧台（靠岸侧）+ 吧凳 + 酒架 */
        const bx0 = -hw + 2.4;
        rsBox(g, woodDarkMat, 1.15, 1.02, 8.2, bx0, y + 0.51, 0);
        rsBox(g, woodMat, 1.55, 0.13, 8.6, bx0 + 0.06, y + 1.08, 0);           // 台面
        rsBox(g, rattanMat, 0.09, 0.72, 8.0, bx0 + 0.62, y + 0.46, 0);         // 客侧藤编面板
        for (let i = -3; i <= 3; i++) stool(g, bx0 + 1.85, y, i * 1.28);
        rsBox(g, woodDarkMat, 0.36, 2.30, 7.4, bx0 - 1.45, y + 1.15, 0);       // 后酒架
        for (const sh of [0.75, 1.45, 2.15]) rsBox(g, woodMat, 0.62, 0.10, 7.2, bx0 - 1.15, y + sh, 0);
        bottles(g, bx0 - 1.05, y + 0.80, -2.6, 9, 0.6);
        bottles(g, bx0 - 1.05, y + 1.50, -2.2, 8, 0.6);

        /* 餐区：三张桌 + 藤椅 */
        for (const [tx, tz] of [[3.0, -3.6], [3.0, 3.6], [6.6, 0]]) {
          table(g, tx, y, tz, 0.72);
          for (let i = 0; i < 4; i++) {
            const ang = i * Math.PI / 2 + 0.4;
            chair(g, tx + Math.cos(ang) * 1.28, y, tz + Math.sin(ang) * 1.28, -ang + Math.PI);
          }
        }
        /* 面海一侧：栏杆留口 + 下沙滩的台阶 */
        rsRailing(g, hw - 0.2, -hd + 0.4, hw - 0.2, -1.9, y, 1.0, 1.8);
        rsRailing(g, hw - 0.2, 1.9, hw - 0.2, hd - 0.4, y, 1.0, 1.8);
        for (let i = 1; i <= 4; i++) {
          const sx = hw + i * 0.85;
          rsBox(g, woodMat, 0.80, 0.17, 3.4, sx, y - i * 0.26, 0);
          for (const s of [-1, 1]) rsBox(g, woodDarkMat, 0.80, 0.60, 0.14, sx, y - i * 0.26 - 0.38, s * 1.7);
        }
        /* 挂灯 + 檐口小灯 */
        for (const lz of [-4.2, 0, 4.2]) {
          rsCyl(g, ropeMat, 0.03, 0.03, 0.9, 5, 1.2, y + PH - 0.35, lz);
          rsLantern(g, 1.2, y + PH - 0.98, lz, 0.95);
        }
        for (const pz of [-hd + 0.8, hd - 0.8]) rsLantern(g, hw - 0.8, y + 1.6, pz, 0.8);
        clubKeepOut.push({ x, z, r: 17 });
        return { x, z, y };
      }

      /* ============ 沙滩吧：圆形茅草伞亭 ============ */
      function beachBar(a) {
        const r = shoreR(a, 2.4), [x, z] = P(a, r);
        const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = -a; clubRoot.add(g);
        const y = terrainHeight(x, z) + 0.06;
        const R = 3.1;
        rsCyl(g, rattanMat, R, R + 0.12, 1.06, 16, 0, y + 0.53, 0);            // 环形吧台
        rsCyl(g, woodMat, R + 0.42, R + 0.42, 0.13, 16, 0, y + 1.12, 0);
        rsCyl(g, woodDarkMat, 0.9, 0.9, 0.92, 10, 0, y + 0.46, 0);             // 台内货架
        bottles(g, 0.55, y + 1.20, -0.9, 4, 0.5);
        for (let i = 0; i < 6; i++) {
          const t = i * Math.PI / 3 + 0.5;
          rsCyl(g, woodDarkMat, 0.13, 0.16, 3.2, 8, Math.cos(t) * (R + 0.30), y + 1.6, Math.sin(t) * (R + 0.30));
          stool(g, Math.cos(t) * (R + 1.55), y, Math.sin(t) * (R + 1.55));
        }
        const roof = new THREE.Group(); roof.position.y = y + 3.2; g.add(roof);
        for (let k = 0; k < 4; k++) {                                          // 层叠圆锥茅草顶
          const f = k / 4;
          rsCyl(roof, k % 2 ? thatchMat2 : thatchMat, lerp(R + 1.9, 0.5, f) * 0.20,
                lerp(R + 1.9, 0.5, f), 1.05, 12, 0, 0.42 + f * 2.1, 0);
        }
        rsCyl(roof, woodDarkMat, 0.10, 0.10, 0.7, 6, 0, 2.95, 0);
        rsLantern(g, R + 0.30, y + 3.0, 0, 0.85);
        clubKeepOut.push({ x, z, r: 8 });
      }

      /* ============ 更衣 / 休息小屋 ============ */
      function cabana(a, hue, mirror) {
        const r = shoreR(a, 3.0), [x, z] = P(a, r);
        const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = -a; clubRoot.add(g);
        const ca = Math.cos(a), sa = Math.sin(a);
        const groundAt = (lx, lz) => terrainHeight(x + lx * ca - lz * sa, z + lx * sa + lz * ca);
        const W = 6.0, D = 5.4, hw = W / 2, hd = D / 2;
        let gmax = -99;
        for (const lx of [-hw, hw]) for (const lz of [-hd, hd]) gmax = Math.max(gmax, groundAt(lx, lz));
        const y = gmax + 0.55;
        deck(g, W, D, y, groundAt);

        const PH = 2.85;
        for (const px of [-hw + 0.55, hw - 0.55]) for (const pz of [-hd + 0.55, hd - 0.55])
          rsCyl(g, woodDarkMat, 0.15, 0.18, PH, 8, px, y + PH / 2, pz);
        rsBox(g, rattanMat, 0.13, PH - 0.35, D - 1.0, -hw + 0.55, y + (PH - 0.35) / 2, 0);   // 背墙
        rsBox(g, rattanMat, W - 1.0, PH - 0.35, 0.13, 0, y + (PH - 0.35) / 2, (mirror ? -1 : 1) * (hd - 0.55));
        for (const pz of [-hd + 0.55, hd - 0.55]) rsBox(g, woodDarkMat, W - 0.8, 0.20, 0.16, 0, y + PH + 0.08, pz);
        const roof = new THREE.Group(); roof.position.y = y + PH + 0.20; g.add(roof);
        rsThatch(roof, W + 2.0, D + 1.9, 2.4, 2.2, 6);
        rsCyl(roof, thatchMat2, 0.16, 0.16, 2.9, 6, 0, 2.22, 0, 0, Math.PI / 2);

        const L = rsLounger(hue); L.position.set(-0.4, y, mirror ? 0.7 : -0.7);
        L.rotation.y = mirror ? -0.06 : 0.06; g.add(L);
        rsSideTable(g, -1.3, y, mirror ? -1.5 : 1.5);
        // 挂在檐下的浴巾 + 一盏灯
        const tw = new THREE.MeshStandardMaterial({ color: srgb(hue), roughness: 0.95, side: THREE.DoubleSide });
        rsBox(g, tw, 0.06, 1.05, 0.75, -hw + 0.62, y + 1.55, mirror ? 1.5 : -1.5);
        rsLantern(g, hw - 0.55, y + 2.0, (mirror ? -1 : 1) * (hd - 0.55), 0.8);
        clubKeepOut.push({ x, z, r: 8 });
      }

      /* ============ 沙滩伞阵 + 躺椅排 ============ */
      const UMB_A = [-0.34, -0.18, -0.02, 0.13, 0.29, 0.44, 0.56, 0.99, 1.11, 1.23, 1.36, 1.50];
      const HUES = [0xe8593f, 0xf2c14e, 0x2f9bb5];
      const groups = [[], [], []];
      UMB_A.forEach((a, i) => {
        const r = shoreR(a, 1.28), [x, z] = P(a, r);
        groups[i % 3].push(xform(x, terrainHeight(x, z), z, Math.PI - a + (i % 2 ? 0.08 : -0.09)));
        clubKeepOut.push({ x, z, r: 6 });
      });
      groups.forEach((xf, i) => { if (xf.length) packInstances(parasolSet(HUES[i]), xf); });

      /* 第二排：只有躺椅和浴巾，交错排在伞阵后面 */
      {
        const pairs = [], tmpl = new THREE.Group();
        const A = rsLounger(0xf2c14e); A.position.set(0, 0, -1.15); tmpl.add(A);
        const B = rsLounger();        B.position.set(0, 0, 1.15);  tmpl.add(B);
        for (let i = 0; i < 9; i++) {
          const a = -0.26 + i * 0.20;
          if (a > 0.84 && a < 1.14) continue;                       // 让开主亭前的通道
          const r = shoreR(a, 2.05), [x, z] = P(a, r);
          pairs.push(xform(x, terrainHeight(x, z), z, Math.PI - a + rr(-0.10, 0.10)));
          clubKeepOut.push({ x, z, r: 5 });
        }
        packInstances(tmpl, pairs);
      }

      /* ============ 建筑 ============
         第 4 镜（椰影·望向海面）从 (60..69, 19..30) 朝邮轮看，视线方位角约 -0.53：
         建筑全部安排在 0.5 rad 以北，别挡住那一镜的海面和邮轮                      */
      clubHouse(0.98);
      beachBar(0.55);
      cabana(0.80, 0x2f9bb5, false);
      cabana(1.22, 0xe8593f, true);
      cabana(1.46, 0xf2c14e, false);

      /* 沙滩上的皮划艇 / 桨板 */
      {
        const [kx, kz] = P(1.34, shoreR(1.34, 1.05));
        rsKayak(clubRoot, kx, terrainHeight(kx, kz) + 0.16, kz, -1.34 + 1.9, 0xe6dcc6);
        const [k2x, k2z] = P(1.38, shoreR(1.38, 1.05));
        rsKayak(clubRoot, k2x, terrainHeight(k2x, k2z) + 0.16, k2z, -1.38 + 2.05, 0xf2c14e);
        for (let i = 0; i < 3; i++) {                                // 立在椰子树旁的桨板
          const a = 0.44 + i * 0.05, [bx, bz] = P(a, shoreR(a, 2.6));
          const m = new THREE.MeshStandardMaterial({ color: srgb([0xf6f2e4, 0x7fc6d6, 0xe8a2a2][i]), roughness: 0.5 });
          const b = new THREE.Mesh(new THREE.CapsuleGeometry(0.42, 2.4, 3, 10), m);
          b.scale.set(1, 1, 0.22);
          b.position.set(bx, terrainHeight(bx, bz) + 1.5, bz);
          b.rotation.set(0.12, -a, 0.10 + i * 0.06);
          b.castShadow = true; clubRoot.add(b);
        }
      }

      /* ============ 加密椰林 ============ */
      const tooClose = (x, z) => clubKeepOut.some(k => (x - k.x) ** 2 + (z - k.z) ** 2 < k.r * k.r)
        || (x - (-45.6)) ** 2 + (z - 47.8) ** 2 < 26 ** 2;            // 让开栈桥登陆口
      let grown = 0;
      for (let i = 0; i < 4000 && grown < 66; i++) {                  // 内陆椰林
        const a = rr(0, Math.PI * 2), rad = coastRadius(a) * rr(0.16, 0.94);
        const x = Math.cos(a) * rad, z = Math.sin(a) * rad, h = terrainHeight(x, z);
        if (h < 1.7 || h > 20 || tooClose(x, z)) continue;
        plantPalm(x, z, rr(0.72, 1.18)); grown++;
      }
      for (let i = 0; i < 20; i++) {                                  // 俱乐部背后的椰林带
        const a = -0.16 + i * 0.095, rad = shoreR(a, 3.4) * rr(0.955, 0.995);
        const x = Math.cos(a) * rad, z = Math.sin(a) * rad;
        if (tooClose(x, z)) continue;
        plantPalm(x, z, rr(0.85, 1.25));
      }
    }

    /* ============================================================
       11 · 主循环
       ============================================================ */

    function updateSkis(dt, t) {
      for (const s of skis) {
        const d = s.def;
        const p0 = skiPos(d, t), p1 = skiPos(d, t + 0.12);
        const yaw = Math.atan2(-(p1.y - p0.y), p1.x - p0.x);
        let dy = yaw - s.prevYaw;
        while (dy > Math.PI) dy -= Math.PI * 2;
        while (dy < -Math.PI) dy += Math.PI * 2;
        s.prevYaw = yaw;
        s.roll = lerp(s.roll, clamp(-dy / Math.max(dt, 1e-3) * 0.55, -0.55, 0.55), 1 - Math.pow(0.002, dt));

        const wy = waveHeight(p0.x, p0.y, t);
        const slopeX = waveHeight(p0.x + 2.5, p0.y, t) - waveHeight(p0.x - 2.5, p0.y, t);
        const m = s.mesh;
        m.position.set(p0.x, wy + 0.55, p0.y);
        m.rotation.set(0, yaw, 0);
        m.rotateZ(-Math.atan(slopeX / 5) * 0.7 - 0.10);
        m.rotateX(s.roll);
        m.userData.rider.rotation.x = -s.roll * 0.55;

        s.trailT += dt;
        if (s.trailT > 0.045) {
          s.trailT = 0;
          const back = new THREE.Vector3(-2.6, 0, 0).applyQuaternion(m.quaternion).add(m.position);
          s.trail.unshift({ x: back.x, z: back.z, yaw });
          if (s.trail.length > TRAIL_SEG) s.trail.pop();
        }
        const g = s.trailMesh.geometry;
        const pos = g.attributes.position.array, col = g.attributes.color.array;
        for (let i = 0; i < TRAIL_SEG; i++) {
          const node = s.trail[Math.min(i, s.trail.length - 1)];
          if (!node) continue;
          const age = i / (TRAIL_SEG - 1);
          const w = lerp(1.1, 7.5, Math.pow(age, 0.75));
          const nx = Math.sin(node.yaw), nz = Math.cos(node.yaw);
          const y = waveHeight(node.x, node.z, t) + 0.10;
          const a2 = i * 6, b2 = a2 + 3;
          pos[a2] = node.x - nx * w; pos[a2 + 1] = y; pos[a2 + 2] = node.z - nz * w;
          pos[b2] = node.x + nx * w; pos[b2 + 1] = y; pos[b2 + 2] = node.z + nz * w;
          const al = (1 - age) * (1 - age) * 0.55 * (s.trail.length > 4 ? 1 : 0);
          for (const k of [i * 8, i * 8 + 4]) { col[k] = 1; col[k + 1] = 1; col[k + 2] = 1; col[k + 3] = al; }
        }
        g.attributes.position.needsUpdate = true;
        g.attributes.color.needsUpdate = true;

        const rear = new THREE.Vector3(-2.3, 0.3, 0).applyQuaternion(m.quaternion).add(m.position);
        const nose = new THREE.Vector3(2.4, 0.1, 0).applyQuaternion(m.quaternion).add(m.position);
        const dir = new THREE.Vector3(1, 0, 0).applyQuaternion(m.quaternion);
        for (let k = 0; k < 3; k++) {
          emitSpray(rear.x + rr(-0.6, 0.6), rear.y + rr(0, 0.4), rear.z + rr(-0.6, 0.6),
            -dir.x * rr(2, 7) + rr(-2, 2), rr(4, 10), -dir.z * rr(2, 7) + rr(-2, 2), rr(6, 15), rr(0.5, 1.1));
        }
        for (const side of [1, -1]) {
          const sv = new THREE.Vector3(0, 0, side).applyQuaternion(m.quaternion);
          emitSpray(nose.x + sv.x * 0.8, nose.y + 0.2, nose.z + sv.z * 0.8,
            sv.x * rr(3, 8) + dir.x * 2, rr(2.5, 6.5), sv.z * rr(3, 8) + dir.z * 2, rr(5, 12), rr(0.45, 0.85));
        }
      }
    }

    function updateSpray(dt) {
      for (let i = 0; i < SPRAY_N; i++) {
        if (sprayAge[i] > sprayLife[i]) { sprayAlpha[i] = 0; continue; }
        sprayAge[i] += dt;
        sprayVel[i * 3 + 1] -= 17 * dt;
        sprayPos[i * 3] += sprayVel[i * 3] * dt;
        sprayPos[i * 3 + 1] += sprayVel[i * 3 + 1] * dt;
        sprayPos[i * 3 + 2] += sprayVel[i * 3 + 2] * dt;
        const k = clamp(sprayAge[i] / sprayLife[i], 0, 1);
        sprayAlpha[i] = (1 - k) * (1 - k) * 0.85;
        if (sprayPos[i * 3 + 1] < 0) sprayAlpha[i] *= 0.2;
      }
      sprayGeo.attributes.position.needsUpdate = true;
      sprayGeo.attributes.aAlpha.needsUpdate = true;
      sprayGeo.attributes.aSize.needsUpdate = true;
    }

    // ---- what someone can pick up ----------------------------------------
    //
    // Declared, not guessed at. Only the builder knows whether four walls are a hut
    // or a street of them.
    world.ground(island);
    world.ground(water);
    palms.forEach((p, i) => world.part('palm_' + String(i).padStart(2, '0'), p));
    world.part('cruise_ship', ship);
    skis.forEach((s, i) => world.part('jet_ski_' + i, s.mesh));
    birds.forEach((b) => world.ghost(b));
    clouds.forEach((c) => world.ghost(c));
    plume.forEach((s) => world.ghost(s));

    // ---- what moves -------------------------------------------------------
    world.frame((dt, t) => {
        waterUniforms.uTime.value = t;
        waterUniforms.uCamPos.value.copy(camera.position);
      ship.position.y = waveHeight(SHIP_POS.x, SHIP_POS.y, t) * 0.35;
      ship.rotation.z = Math.sin(t * 0.31) * 0.006;
      ship.rotation.x = Math.sin(t * 0.24 + 1.1) * 0.004;

      for (const p of palms) {
        const u = p.userData;
        u.crown.rotation.z = Math.sin(t * u.sway + u.phase) * 0.055;
        u.crown.rotation.x = Math.cos(t * u.sway * 0.8 + u.phase) * 0.04;
      }
      for (const c of clouds) {
        c.position.x += c.userData.drift * dt;
        if (c.position.x > 4400) c.position.x = -4400;
      }
      // 火山口蒸汽：沿高度上升、被风吹斜、越高越淡越大
      for (const s of plume) {
        const u = s.userData;
        u.u = (u.u + u.spd * dt) % 1;
        const k = u.u;
        const rise = k * 300;
        s.position.set(
          u.base.x + rise * 0.42 * u.drift + Math.sin(t * 0.5 + u.sway) * 14,
          u.base.y + rise,
          u.base.z + rise * 0.20 * u.drift + Math.cos(t * 0.42 + u.sway) * 12
        );
        const sz = 46 + k * 210;
        s.scale.set(sz, sz * 0.82, 1);
        s.material.opacity = smoothstep(0.0, 0.10, k) * (1 - smoothstep(0.45, 1.0, k)) * 0.62;
      }
      for (const b of birds) {
        const u = b.userData, a = t * u.s + u.ph;
        // 扑翼与滑翔交替：bout=1 振翅，bout=0 展翼滑翔
        const bout = smoothstep(-0.2, 0.35, Math.sin(t * 0.17 + u.ph * 1.7));
        const ph = t * u.fs + u.ph * 3.1, flap = Math.sin(ph), amp = 0.14 + 0.80 * bout;
        b.position.set(
          u.cx + Math.cos(a) * u.r,
          u.y + Math.sin(a * 2.3) * 6 - flap * amp * 0.9 * u.sc,
          u.cz + Math.sin(a) * u.r
        );
        b.rotation.y = -a - Math.PI / 2;            // 朝切线方向
        b.rotation.x = 0.24 + 0.05 * flap * amp;    // 向圆心侧倾
        b.rotation.z = 0.04 - 0.07 * flap * amp;    // 下扑时略抬头
        for (const w of u.wings) {
          // 上举时外翼折收并后掠，下扑时展平、翼尖微垂
          w.shoulder.rotation.x = -w.side * (0.10 + amp * flap);
          w.shoulder.rotation.y = -w.side * 0.16 * Math.max(0, flap) * bout;
          w.elbow.rotation.x = -w.side * amp * flap * (flap > 0 ? 0.55 : 0.28);
          w.elbow.rotation.y = -w.side * (0.05 + 0.10 * Math.max(0, flap));
        }
      }

      updateSkis(dt, t);
      updateSpray(dt);
    });
}
