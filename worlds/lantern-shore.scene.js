//
//  lantern-shore.scene.js
//  Project27 worlds
//
//  A small shore at dusk: a jetty, a hut, a boat riding a calm tide, and one
//  lantern doing the work of a sunset. Written as the minimal honest example of
//  the shape every world takes — read coral-cay.scene.js for the ceiling, read
//  this for the floor.
//

export default function build(world) {
    const { THREE, scene } = world;

    world.ownsSky(false);       // the app's gradient sky is fine for this one
    world.groundLevel(0);
    world.bloom({ strength: 0.35, radius: 0.5, threshold: 0.85 });

    // ---- Light -------------------------------------------------------------

    const sun = new THREE.DirectionalLight(0xffe3c0, 2.2);
    sun.position.set(-30, 40, 20);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -40;
    sun.shadow.camera.right = 40;
    sun.shadow.camera.top = 40;
    sun.shadow.camera.bottom = -40;
    scene.add(sun);
    scene.add(new THREE.HemisphereLight(0xcfe0f0, 0x8a7a5a, 0.7));

    // ---- Ground: a sand shelf easing into water ----------------------------

    const groundGeometry = new THREE.CircleGeometry(60, 96);
    groundGeometry.rotateX(-Math.PI / 2);
    const positions = groundGeometry.attributes.position;
    for (let i = 0; i < positions.count; i++) {
        const x = positions.getX(i);
        const z = positions.getZ(i);
        const r = Math.hypot(x, z);
        // Dry and slightly rolling in the middle, dipping under the waterline
        // past r=28 so the sea has something to lap over.
        const roll = (World_noise(x * 0.08, z * 0.08) - 0.5) * 0.8;
        const shelf = r < 28 ? 0.6 + roll : 0.6 - (r - 28) * 0.18;
        positions.setY(i, shelf);
    }
    groundGeometry.computeVertexNormals();

    const sand = new THREE.Mesh(
        groundGeometry,
        new THREE.MeshStandardMaterial({ color: 0xd9c398, roughness: 1 })
    );
    sand.receiveShadow = true;
    scene.add(world.ground(sand));

    const water = new THREE.Mesh(
        new THREE.CircleGeometry(200, 64).rotateX(-Math.PI / 2),
        new THREE.MeshStandardMaterial({
            color: 0x2e6f8e,
            transparent: true,
            opacity: 0.82,
            roughness: 0.25,
            metalness: 0.1,
        })
    );
    water.position.y = 0.0;
    scene.add(world.ground(water));

    // ---- The jetty ---------------------------------------------------------

    const wood = new THREE.MeshStandardMaterial({ color: 0x8a6748, roughness: 0.9 });
    const jetty = new THREE.Group();
    for (let i = 0; i < 8; i++) {
        const plank = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.12, 0.9), wood);
        plank.position.set(20 + i * 1.0, 1.05, 6);
        plank.rotation.y = Math.PI / 2;
        plank.castShadow = plank.receiveShadow = true;
        jetty.add(plank);
        if (i % 2 === 0) {
            for (const side of [-1, 1]) {
                const pile = new THREE.Mesh(
                    new THREE.CylinderGeometry(0.09, 0.11, 2.2, 8), wood);
                pile.position.set(20 + i * 1.0, 0.1, 6 + side * 1.0);
                pile.castShadow = true;
                jetty.add(pile);
            }
        }
    }
    scene.add(world.part('jetty_00', jetty));

    // ---- The hut -----------------------------------------------------------

    const hut = new THREE.Group();
    const walls = new THREE.Mesh(
        new THREE.BoxGeometry(4, 2.6, 3.2),
        new THREE.MeshStandardMaterial({ color: 0xe8dcc4, roughness: 0.95 })
    );
    walls.position.y = 1.9;
    const roof = new THREE.Mesh(
        new THREE.ConeGeometry(3.4, 1.8, 4),
        new THREE.MeshStandardMaterial({ color: 0xa0522d, roughness: 0.8, flatShading: true })
    );
    roof.position.y = 4.1;
    roof.rotation.y = Math.PI / 4;
    for (const piece of [walls, roof]) {
        piece.castShadow = piece.receiveShadow = true;
        hut.add(piece);
    }
    hut.position.set(-6, 0.4, -4);
    hut.rotation.y = 0.5;
    scene.add(world.part('hut_00', hut));

    // ---- The lantern, and the glow that earns the bloom --------------------

    const lantern = new THREE.Group();
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 2.4, 8), wood);
    post.position.y = 1.2;
    post.castShadow = true;
    const flameMaterial = new THREE.MeshStandardMaterial({
        color: 0xffc466,
        emissive: 0xffa030,
        emissiveIntensity: 2.4,
    });
    const flame = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 10), flameMaterial);
    flame.position.y = 2.5;
    const glow = new THREE.PointLight(0xffb050, 24, 22, 2);
    glow.position.y = 2.5;
    lantern.add(post, flame, glow);
    lantern.position.set(24, 0.9, 4.2);
    scene.add(world.part('lantern_00', lantern));

    // ---- The boat ----------------------------------------------------------

    const boat = new THREE.Group();
    const hull = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.8, 2.6, 6, 10),
        new THREE.MeshStandardMaterial({ color: 0x5b3a29, roughness: 0.7 })
    );
    hull.rotation.z = Math.PI / 2;
    hull.scale.y = 0.55;
    hull.castShadow = true;
    boat.add(hull);
    boat.position.set(30, 0.15, -3);
    scene.add(world.part('boat_00', boat));

    // ---- What moves --------------------------------------------------------

    world.frame((dt, t) => {
        boat.position.y = 0.15 + Math.sin(t * 0.9) * 0.12;
        boat.rotation.z = Math.sin(t * 0.7) * 0.04;
        boat.rotation.x = Math.sin(t * 1.1 + 1) * 0.03;
        flameMaterial.emissiveIntensity = 2.4 + Math.sin(t * 9) * 0.25 + Math.sin(t * 23) * 0.15;
        glow.intensity = 24 + Math.sin(t * 9) * 2.5;
    });
}

// The runtime exports the same helper as `World.noise2`; kept local here so the
// module stands alone under a syntax check.
function World_noise(x, y) {
    const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
    return n - Math.floor(n);
}
