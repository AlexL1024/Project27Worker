//
//  smoke.mjs — build every world for real, in node, and report what breaks.
//
//  A syntax check only proves a world parses. This actually runs its `build`
//  against the real three.js and the real runtime, with the browser stubbed,
//  so a world that throws — or quietly makes a mesh with no geometry — is
//  caught here rather than on the iPad as "three.js couldn't start".
//
//  The same argument, said the same way, applies to the object library: every
//  prop in `props/` is built too, because a prop that throws takes down whatever
//  world someone dropped it into, and that world is not the one that broke.
//
//  Usage: node tools/smoke.mjs [world.scene.js | prop.prop.js ...]
//         (default: every world, then every prop)
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
const PROPS = path.join(REPO, 'props');

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
// The app serves the whole download in one flat folder, so a world importing
// one of its own props writes './school-desk.prop.js'. Staging props beside the
// worlds is what makes that import resolve here the way it resolves there.
if (fs.existsSync(PROPS)) {
    for (const name of fs.readdirSync(PROPS)) {
        if (name.endsWith('.js')) fs.copyFileSync(path.join(PROPS, name), path.join(STAGE, name));
    }
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

// ---- one prop -------------------------------------------------------------

// A prop is a thing, not a scene: no runtime, no world argument, just THREE and
// the one helper. It has to survive being dropped into somebody else's world,
// which is a harsher test than being built inside its own — so the things that
// would only misbehave there are failures here.
const PROP_MESHES = 60;

// The same canvasTexture a world is handed, borrowed off a throwaway World so a
// prop's textures are made exactly the way the runtime will make them.
const propHelpers = {
    canvasTexture: (w, h, draw) => new World({
        THREE, scene: new THREE.Scene(), renderer,
        camera: new THREE.PerspectiveCamera(55, 1.4, 0.01, 4000),
    }).canvasTexture(w, h, draw),
};

async function smokeProp(file) {
    const troubles = [];
    try {
        const module = await import(path.join(STAGE, file));
        const build = module.default;
        if (typeof build !== 'function') {
            return { file, fatal: 'no default export — a prop is `export default function build(THREE, helpers)`' };
        }

        const object = await build(THREE, propHelpers);
        if (!object || !object.isObject3D) {
            const what = object === undefined ? 'nothing' : (object === null ? 'null' : typeof object);
            return { file, fatal: `build() answered ${what} — a prop returns one THREE.Object3D` };
        }

        let meshes = 0, lights = 0;
        object.traverse((node) => {
            if (node.isLight) { lights++; return; }
            if (!node.isMesh) return;
            meshes++;
            if (!node.geometry || !node.geometry.attributes || !node.geometry.attributes.position) {
                troubles.push(`mesh "${node.name || '(unnamed)'}" has no geometry — a merge that returned null?`);
            }
            if (!node.material) troubles.push(`mesh "${node.name || '(unnamed)'}" has no material`);
        });

        if (meshes === 0) troubles.push('no meshes — build() returned an empty group');
        if (meshes > PROP_MESHES) {
            troubles.push(`${meshes} meshes (budget: ~${PROP_MESHES}) — merge the repeats before this lands in a world`);
        }
        if (lights) {
            troubles.push(`${lights} light${lights > 1 ? 's' : ''} — a prop never lights a world it does not own; make the glow emissive`);
        }
        return { file, meshes, troubles };
    } catch (error) {
        return { file, fatal: String(error && error.stack || error).split('\n').slice(0, 4).join('\n') };
    }
}

// The shelf and its catalogue have to agree, in both directions: an entry with
// no file is a card the app offers and then cannot place, and a file nobody
// listed is work already done that nobody can find.
function propManifest(onDisk) {
    let bad = false;
    const indexFile = path.join(PROPS, 'index.json');
    if (!fs.existsSync(indexFile)) {
        if (onDisk.length) {
            console.log('BROKEN  props/index.json is missing but props exist on disk');
            bad = true;
        }
        return bad;
    }

    let manifest;
    try {
        manifest = JSON.parse(fs.readFileSync(indexFile, 'utf8'));
    } catch (error) {
        console.log(`BROKEN  props/index.json does not parse — ${error.message}`);
        return true;
    }

    const listed = new Set();
    const ids = new Set();
    for (const prop of manifest.props || []) {
        const name = prop.file || '';
        listed.add(name);
        if (ids.has(prop.id)) {
            console.log(`BROKEN  props/index.json lists the id "${prop.id}" twice — ids are unique and permanent`);
            bad = true;
        }
        ids.add(prop.id);

        // The shelf is a search box over a grid of names, and nothing else: an
        // entry with no name is a blank card, and one with no tags can only be
        // found by somebody who already knows what it is called. Both are how an
        // object built for someone quietly becomes an object they can never find
        // again — which matters more now that props are written headlessly, from
        // a line somebody typed on an iPad, with nobody reading the manifest
        // afterwards.
        if (typeof prop.name !== 'string' || !prop.name.trim()) {
            console.log(`BROKEN  props/index.json: "${prop.id}" has no name — the name is what a card reads`);
            bad = true;
        }
        const tags = Array.isArray(prop.tags)
            ? prop.tags.filter((tag) => typeof tag === 'string' && tag.trim())
            : [];
        if (tags.length < 2) {
            console.log(`BROKEN  props/index.json: "${prop.id}" has ${tags.length} usable tag(s) — CLAUDE.md asks for two to six, and the tags are the search`);
            bad = true;
        }

        if (name !== `${prop.id}.prop.js`) {
            console.log(`BROKEN  props/index.json: "${prop.id}" points at ${name || '(nothing)'}, not ${prop.id}.prop.js`);
            bad = true;
        }
        if (!fs.existsSync(path.join(PROPS, name))) {
            console.log(`BROKEN  props/index.json lists props/${name} but it does not exist`);
            bad = true;
        }
    }
    for (const name of onDisk) {
        if (!listed.has(name)) console.log(`note    props/${name} exists but the manifest does not list it`);
    }
    return bad;
}

// ---- the run ---------------------------------------------------------------

const asked = process.argv.slice(2).map((f) => path.basename(f));
const onDisk = fs.existsSync(PROPS)
    ? fs.readdirSync(PROPS).filter((f) => f.endsWith('.prop.js')).sort()
    : [];
const worldFiles = asked.length
    ? asked.filter((f) => !f.endsWith('.prop.js'))
    : fs.readdirSync(WORLDS).filter((f) => f.endsWith('.scene.js')).sort();
const propFiles = asked.length ? asked.filter((f) => f.endsWith('.prop.js')) : onDisk;

let bad = 0;
for (const file of worldFiles) {
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

if (propFiles.length || fs.existsSync(PROPS)) {
    console.log();
    if (!asked.length && propManifest(onDisk)) bad++;
    for (const file of propFiles) {
        const r = await smokeProp(file);
        if (r.fatal) { bad++; console.log(`THROWS  props/${file}\n${r.fatal.replace(/^/gm, '        ')}`); continue; }
        if (r.troubles.length) {
            bad++;
            console.log(`BROKEN  props/${file}  (${r.meshes} meshes)`);
            for (const t of [...new Set(r.troubles)].slice(0, 4)) console.log('        ' + t);
        } else {
            console.log(`ok      props/${file}  (${r.meshes} meshes)`);
        }
    }
}

process.exit(bad ? 1 : 0);
