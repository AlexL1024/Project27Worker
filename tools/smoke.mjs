//
//  smoke.mjs — build every world for real, in node, and report what breaks.
//
//  A syntax check only proves a world parses. This actually runs its `build`
//  against the real three.js and the real runtime, with the browser stubbed,
//  so a world that throws — or quietly makes a mesh with no geometry — is
//  caught here rather than on the iPad as "three.js couldn't start".
//
//  Usage: node tools/smoke.mjs [world.scene.js ...]   (default: every world)
//
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const HERE = path.dirname(new URL(import.meta.url).pathname);
const REPO = path.dirname(HERE);
const CACHE = path.join(REPO, '.three');       // gitignored; someone else's code

// three.js is fetched rather than vendored, exactly as the app does it. The
// app's own copy is used when this machine has the app checked out; otherwise
// the two files this needs are pulled once from the CDN.
function three() {
    for (const folder of [
        process.env.P27_THREE,
        path.join(process.env.HOME || '', 'Documents/Project27iOS/Project27iOS/Web'),
        CACHE,
    ]) {
        if (folder && fs.existsSync(path.join(folder, 'three.module.js'))) return folder;
    }

    {
        const version = process.env.THREE_VERSION || '0.170.0';
        const base = `https://cdn.jsdelivr.net/npm/three@${version}`;
        fs.mkdirSync(CACHE, { recursive: true });
        try {
            for (const [from, name] of [
                [`${base}/build/three.module.js`, 'three.module.js'],
                [`${base}/examples/jsm/utils/BufferGeometryUtils.js`, 'BufferGeometryUtils.js'],
            ]) {
                execFileSync('curl', ['--fail', '--silent', '--show-error', '--location',
                                      from, '--output', path.join(CACHE, name)]);
                // Flat imports, because everything sits in one folder here.
                const file = path.join(CACHE, name);
                fs.writeFileSync(file, fs.readFileSync(file, 'utf8')
                    .replace(/from ['"]three['"]/g, "from './three.module.js'"));
            }
        } catch {
            // Offline, or the CDN is having a day. Say so plainly rather than
            // failing a build over a test that could not run — but never
            // pretend the worlds passed.
            return null;
        }
    }
    return CACHE;
}

const WEB = three();
if (!WEB) {
    console.log('note    smoke test skipped — three.js is not on this machine and could');
    console.log('        not be fetched. The worlds were NOT run.');
    process.exit(0);
}
const WORLDS = path.join(REPO, 'worlds');

// The worlds import './BufferGeometryUtils.js' as a sibling, so they are run
// from a scratch folder holding both them and three.
const STAGE = fs.mkdtempSync('/tmp/p27smoke-');
for (const name of fs.readdirSync(WEB)) {
    if (name.endsWith('.js')) fs.copyFileSync(path.join(WEB, name), path.join(STAGE, name));
}
fs.copyFileSync(path.join(REPO, 'runtime-reference/runtime.js'), path.join(STAGE, 'runtime.js'));
for (const name of fs.readdirSync(WORLDS)) {
    if (name.endsWith('.js')) fs.copyFileSync(path.join(WORLDS, name), path.join(STAGE, name));
}
process.chdir(STAGE);

const THREE = await import(path.join(STAGE, 'three.module.js'));
const { World } = await import(path.join(STAGE, 'runtime.js'));

// ---- the browser, in as much detail as a world actually touches -----------

const anything = () => new Proxy(function () {}, {
    get(target, key) {
        if (key === 'width' || key === 'height') return 256;
        if (key === 'data') return new Uint8ClampedArray(4 * 256 * 256);
        if (key === Symbol.toPrimitive) return () => 0;
        if (key === 'then') return undefined;      // never look like a promise
        return anything();
    },
    apply() { return anything(); },
    set() { return true; },
});

function canvas() {
    return {
        width: 256, height: 256,
        getContext: () => anything(),
        toDataURL: () => 'data:,',
        addEventListener() {}, removeEventListener() {},
        style: {},
    };
}

globalThis.document = {
    createElement: (tag) => (tag === 'canvas' ? canvas() : { style: {}, appendChild() {} }),
    createElementNS: () => canvas(),
    body: { appendChild() {} },
    getElementById: () => null,
    addEventListener() {}, removeEventListener() {},
};
globalThis.window = {
    devicePixelRatio: 2, innerWidth: 1180, innerHeight: 820,
    addEventListener() {}, removeEventListener() {},
    requestAnimationFrame: () => 0,
};
globalThis.self = globalThis.window;
if (!globalThis.navigator) globalThis.navigator = { userAgent: 'node' };

const renderer = {
    capabilities: { getMaxAnisotropy: () => 8, isWebGL2: true },
    outputColorSpace: THREE.SRGBColorSpace,
    toneMapping: THREE.ACESFilmicToneMapping,
    shadowMap: { enabled: true, type: THREE.PCFSoftShadowMap },
    domElement: canvas(),
    getSize: (v) => (v ? v.set(1180, 820) : { width: 1180, height: 820 }),
    setSize() {}, setPixelRatio() {}, render() {}, compile() {},
};

// ---- one world ------------------------------------------------------------

async function smoke(file) {
    const troubles = [];
    const said = [];
    const realWarn = console.warn, realError = console.error;
    console.warn = (...a) => said.push(String(a[0]));
    console.error = (...a) => said.push(String(a[0]));

    try {
        const module = await import(path.join(STAGE, file));
        const build = module.default || module.build;
        if (typeof build !== 'function') {
            // A helper module (a shared train) has no build of its own, and is
            // exercised by the world that imports it.
            return { file, skipped: 'no build function' };
        }

        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(55, 1.4, 0.01, 4000);
        const world = new World({ THREE, scene, renderer, camera });

        await build(world);

        // Two frames, because a world's motion runs on code too — and a frame
        // callback that throws takes the whole viewport down with it.
        for (const step of world._frame || []) { step(1 / 60, 0.016); step(1 / 60, 0.5); }

        // A mesh with no geometry is the quiet one: three renders nothing and
        // says nothing, and the first thing to touch it — the floor encoder,
        // a raycast — dies on a null.
        let empty = 0, meshes = 0;
        scene.traverse((node) => {
            if (!node.isMesh) return;
            meshes++;
            if (!node.geometry || !node.geometry.attributes || !node.geometry.attributes.position) {
                empty++;
                troubles.push(`mesh "${node.name || '(unnamed)'}" has no geometry — a merge that returned null?`);
            }
            if (!node.material) troubles.push(`mesh "${node.name || '(unnamed)'}" has no material`);
        });

        return {
            file, meshes, empty, parts: world.parts.length,
            solids: world.solids.length, troubles,
            // Only what actually breaks a world. three grumbles about a
            // toNonIndexed() on an already-non-indexed geometry, which is
            // untidy and harmless; a merge that answered null is neither.
            said: said.filter((s) => /mergeGeometries\(\) failed|mergeAttributes/.test(s)),
        };
    } catch (error) {
        return { file, fatal: String(error && error.stack || error).split('\n').slice(0, 4).join('\n') };
    } finally {
        console.warn = realWarn;
        console.error = realError;
    }
}

const files = process.argv.slice(2).length
    ? process.argv.slice(2).map((f) => path.basename(f))
    : fs.readdirSync(WORLDS).filter((f) => f.endsWith('.scene.js')).sort();

let bad = 0;
for (const file of files) {
    const r = await smoke(file);
    if (r.skipped) { console.log(`skip    ${file}  (${r.skipped})`); continue; }
    if (r.fatal) { bad++; console.log(`THROWS  ${file}\n${r.fatal.replace(/^/gm, '        ')}`); continue; }
    if (r.troubles.length || r.said.length) {
        bad++;
        console.log(`BROKEN  ${file}  (${r.meshes} meshes, ${r.empty} empty)`);
        for (const t of [...new Set(r.troubles)].slice(0, 4)) console.log('        ' + t);
        for (const s of [...new Set(r.said)].slice(0, 2)) console.log('        said: ' + s.slice(0, 150));
    } else {
        console.log(`ok      ${file}  (${r.meshes} meshes, ${r.parts} parts, ${r.solids} ground)`);
    }
}
process.exit(bad ? 1 : 0);
