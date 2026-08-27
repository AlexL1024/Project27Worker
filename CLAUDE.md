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
3. `bash tools/check.sh` — checks syntax, the manifest and the performance
   budget, then **builds every world for real** in node (`tools/smoke.mjs`)
   with the browser stubbed. A world that throws, or that leaves a mesh with no
   geometry, fails here. Never commit past a failure — the app cannot survive
   what this catches.
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
| `world.ground(object3D)` | The large base terrain — the island, the water, the plain. Still required for terrain and water: it is what the walk's grid is sized and anchored to. |
| `world.ghost(object3D)` | Opts something out of collision — the walk passes through it. Clouds, birds, spray, glow sprites, particle swarms. |
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
- **Merge only geometries that are alike.** `mergeGeometries` answers `null`
  when a list mixes indexed and non-indexed geometry — and three's primitives
  disagree: box, cylinder, sphere and lathe are indexed; the polyhedra
  (icosahedron and friends) and extrude are not. A null geometry is a mesh that
  kills the whole viewport, so normalise first:
  `mergeGeometries(parts.map((g) => (g.index ? g.toNonIndexed() : g)))`.
- Custom `ShaderMaterial`s are encouraged (that's where real water and skies
  live) — see `worlds/coral-cay.scene.js` for shaders done right.
- Scale is metres, y-up. People walk in these worlds: groundLevel matters,
  and terrain and water must be registered with `world.ground()`.
- Collision is otherwise automatic: every visible mesh collides. People stand
  on decks, jetties and rooftops and are stopped by walls and trunks without
  the world saying anything. The opt-out is `world.ghost()` — ghost anything
  a person should pass through (spray, birds, drifting cloud, glow) and ghost
  decorative swarms even when passing through them would be fine, because
  every un-ghosted mesh is rasterised into the collision grid and a thousand
  petals are collision work for no collision anyone feels. Hidden objects and
  depth-write-less materials never collide; leave doorways and archways at
  least a couple of metres wide, or the walk will read them as wall.

## Quality bar

`worlds/coral-cay.scene.js` (when present) is the hand-written target: custom
sky and water shaders that agree with each other, Gerstner waves in the vertex
stage, instanced planting, canvas textures, bloom used sparingly.
`worlds/lantern-shore.scene.js` is the floor: the minimal honest shape of a
world. New worlds should land much closer to the ceiling than the floor —
write real shaders, real variety, real atmosphere. A world that merely loads
is not the product; a world someone wants to stand in is.

## The performance budget

The screen this runs on is an iPad, and the renderer is plain forward WebGL:
every real-time light is evaluated by every lit fragment, every frame. Twelve
point lights in an enclosed scene is twelve full-screen light passes - that is
why the budget below is hard, and `bash tools/check.sh` fails a world that
breaks it.

- **At most 4 real-time lights** in the whole scene (Directional, Point, Spot,
  RectArea combined; Ambient and Hemisphere are free). One hemisphere + one
  key light + at most two accents is the usual shape.
- **Glow is emissive, not a light.** A lamp, a lit sign, a lightbox ceiling, a
  headlight is an emissive material (`emissiveIntensity` above 1) and
  `world.bloom(...)` carries the shine. Reserve actual PointLights for the one
  or two places where light visibly falls on other surfaces and moves the
  scene.
- **Repeats are instanced.** Eight or more alike - columns, seats, lamps,
  trees, sleepers - is one `InstancedMesh`, never a loop of `new THREE.Mesh`.
  Aim under ~120 individual meshes; merge static architecture that shares a
  material (`BufferGeometryUtils.mergeGeometries`) where practical.
- **The frame callback allocates nothing.** No `new THREE.Vector3()` per
  frame - make scratch objects once outside. No `material.needsUpdate`, no
  texture re-upload per frame; canvas textures redraw at most a few times a
  minute.

A world over budget is not done, however good it looks in a still.

## Naming

Slug is kebab-case (`coral-cay`), file is `<slug>.scene.js`, display name is
Title Case. Parts are named `thing_NN` (`hut_00`, `palm_03`) — the app uses
those names to talk about pieces.


## Hand placements (`worlds/*.edits.json`)

The app writes `worlds/<slug>.edits.json` when a person drags a world's parts
around by hand on the iPad. Those files are the person's own placements, laid
over the scene each time it loads — the scene's code stays pristine underneath
them.

- **Never** delete, regenerate, or edit these files, and never fold their
  values back into the scene code. They are not yours to write.
- Keep part names stable when editing a world — placements are keyed by name
  (`hut_00`), and renaming a part silently discards where its owner put it.
- When building or editing a world, don't create an `.edits.json` yourself.
  A world ships with no placements; the person adds them by hand or not at all.


## Headless requests (the mailbox)

Most sessions here are started headlessly by `tools/watcher.py`: the iPad app
commits a request into `requests/<id>.json`, the watcher hands it to you, and
answers the app through `status/<id>.json`. No person is watching the
terminal, so:

- Work autonomously start to finish: never ask a question, never pause for
  approval, never leave the work half-done.
- Subagents are allowed and encouraged for big worlds (the Task tool is on the
  allow-list): fan out — one per region, one per system, a reviewer — so long
  as everything converges into the world's one coherent module and a single
  final commit.
- Attached photos, when there are any, sit beside the request at
  `requests/<id>/ref-*.jpg` — look at them before building; they are the
  visual brief.
- **Never modify or delete anything under `requests/` or `status/`.** They
  belong to the mailbox; the watcher cleans them up itself.
- When told to edit `worlds/<slug>.scene.js`, change that world in place —
  do not fork it into a new slug.
- Always finish with the checked-and-committed loop (check.sh, manifest,
  commit), and end your final message with exactly one line:

      WORLD: <slug>

  That line is how the watcher tells the app which world to pull. No slug
  line, no world on the iPad.
