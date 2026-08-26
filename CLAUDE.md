# Project27 worlds

This repo is the pipe between Claude Code and an iPad. Every world here is a
three.js **scene module**; the Project27 iOS app pulls this repo's `main` branch
over the GitHub API and runs the modules inside its own renderer. Nothing in
this repo is a website — there is no build step, no bundler, no npm. A world is
one self-contained ES module file.

## The one workflow rule

**Every finished change gets committed, and a commit pushes itself** (a
`post-commit` hook runs `git push`). So the loop is:

1. Write or edit a world in `worlds/<slug>.scene.js`.
2. Update `worlds/index.json` — the app only shows what the manifest lists.
3. `bash tools/check.sh` — syntax-checks every module and the manifest.
4. `git add -A && git commit -m "<what changed>"` — the hook pushes to GitHub.
5. If the push fails (no network, auth), say so plainly — the iPad can only
   see what actually reached GitHub.

## Repo layout

```
worlds/
  index.json            ← the manifest: what the app offers to open
  <slug>.scene.js       ← one world per file, self-contained
tools/check.sh          ← syntax check, run before every commit
runtime-reference/      ← read-only copies of the app's runtime, for reference
```

`worlds/index.json` schema:

```json
{
  "worlds": [
    { "slug": "lantern-shore", "name": "Lantern Shore", "scene": "lantern-shore.scene.js" }
  ]
}
```

A world may ship extra JS files (shared helpers) by adding
`"files": ["helper.js"]` to its entry; the app downloads those too. Extra files
must NOT reuse names the app already bundles: `three.module.js`, `viewport.js`,
`runtime.js`, `ground.js`, `index.html`, `island.scene.js`,
`BufferGeometryUtils.js`, `GLTFLoader.js`, or any of the postprocessing passes.

## What a world is

A module with one default export, built against the app's runtime
(`runtime-reference/runtime.js` is the authoritative copy):

```js
export default function build(world) {
    const { THREE, scene, renderer, camera } = world;

    const hut = new THREE.Group();
    // ...
    world.part('hut_00', hut);        // a named thing someone can pick up
    scene.add(hut);

    world.frame((dt, t) => { ... });  // anything that moves; dt is clamped
}
```

The API, in full — this is everything a world may reach:

| Call | Meaning |
|---|---|
| `world.part(name, object3D)` | Declare one pick-up-able thing. The builder decides what counts as an object. |
| `world.ground(object3D)` | Scenery you stand on, never pick up — terrain, water, roads. |
| `world.ghost(object3D)` | The walk passes through it — clouds, birds, spray. |
| `world.ownsSky(bool)` | The world brings its own sky; the app's gradient and grid step aside. |
| `world.groundLevel(y)` | Where the ground sits, metres, y-up — for stepping inside. |
| `world.frame(fn)` | Per-frame callback `(dt, t)`. |
| `world.bloom({strength, radius, threshold})` | Ask the runtime for a bloom pass. Never build your own composer. |
| `world.canvasTexture(w, h, draw)` | A canvas-drawn texture in the right colour space. |
| `World.noise2(x, y)` | The value-noise pair most generated terrain wants. |

Hard rules, because breaking them breaks the app around the world:

- **Never** create a renderer, a camera, a frame loop (`requestAnimationFrame`),
  or an `EffectComposer`. The app owns all four.
- Get `THREE` from the `world` argument. The only import a world should need is
  `import { mergeGeometries } from './BufferGeometryUtils.js';` — the app
  serves that file itself.
- No `fetch()`, no external URLs, no DOM beyond what `canvasTexture` hands you.
  A world is code that stands alone.
- Custom `ShaderMaterial`s are encouraged (that's where real water and skies
  live) — see `worlds/coral-cay.scene.js` for shaders done right.
- Scale is metres, y-up. People walk in these worlds: groundLevel matters,
  and everything walkable should be registered with `world.ground()`.

## Quality bar

`worlds/coral-cay.scene.js` (when present) is the hand-written target: custom
sky and water shaders that agree with each other, Gerstner waves in the vertex
stage, instanced planting, canvas textures, bloom used sparingly.
`worlds/lantern-shore.scene.js` is the floor: the minimal honest shape of a
world. New worlds should land much closer to the ceiling than the floor —
write real shaders, real variety, real atmosphere. A world that merely loads
is not the product; a world someone wants to stand in is.

## Naming

Slug is kebab-case (`coral-cay`), file is `<slug>.scene.js`, display name is
Title Case. Parts are named `thing_NN` (`hut_00`, `palm_03`) — the app uses
those names to talk about pieces.
