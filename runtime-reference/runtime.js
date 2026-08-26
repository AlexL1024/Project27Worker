//
//  runtime.js
//  Project27iOS
//
//  What a generated world is handed.
//
//  A world is now a JavaScript module, not a file of baked triangles — because a
//  file of baked triangles cannot hold a wave that moves, a sky the water samples
//  to know what to reflect, or a field of grass drawn in one call. Those are the
//  things that separate a scene someone wants to stand in from a scene that merely
//  loads, and every one of them is code.
//
//  So the builder writes code, and this is the surface it writes against. The app
//  keeps what the app has always kept: the canvas, the camera, the frame loop, what
//  a finger means. The world gets to say what is in it and what moves.
//
//      export default function build(world) {
//          const { THREE, scene } = world;
//
//          const hut = new THREE.Group();
//          ...
//          world.part('hut_00', hut);          // a thing you can pick up
//          scene.add(hut);
//
//          world.frame((dt, t) => { ... });    // anything that moves
//      }
//

import * as THREE from './three.module.js';

/// Everything a generated scene is allowed to reach.
///
/// Deliberately small. A world that reaches past this — making its own renderer,
/// its own loop, its own camera — is a world the app can no longer fly around,
/// frame, or step inside, which is most of what the app is for.
export class World {

    constructor({ THREE: three, scene, renderer, camera }) {
        this.THREE = three;
        this.scene = scene;
        this.renderer = renderer;
        this.camera = camera;

        /// Named things, in the order they were declared. A part is what someone
        /// reaches out and moves — a hut, a boat, a person. Not a roof, and not
        /// every purple roof gathered together.
        this.parts = [];
        this.byName = new Map();

        /// What the walk stands on. Everything by default; a scene can say
        /// otherwise for things a person should pass through.
        this.solids = [];

        this._frame = [];
        this._ground = 0;
        this._bloom = null;
        this._ownsSky = false;
    }

    // MARK: - What is in the world

    /**
     * Declares one thing someone can pick up.
     *
     * The same contract `core.py` had with `Scene.use`, said in JavaScript: the
     * builder decides what counts as an object, because only the builder knows
     * whether four walls are a hut or a street of them. Everything under a part
     * travels with it.
     */
    part(name, object) {
        // Refused rather than half-registered. A builder that hands over the wrong
        // thing — a plain record holding the mesh, rather than the mesh — should
        // hear about it here, not as an object that silently cannot be picked up.
        if (!object || !object.isObject3D) {
            console.warn(`world.part("${name}") ignored: not an Object3D`);
            return object;
        }
        object.name = name || object.name || `part_${this.parts.length}`;
        object.userData.p27part = this.parts.length;
        this.parts.push(object);
        this.byName.set(object.name, object);
        return object;
    }

    /**
     * Marks something as scenery you stand on but never pick up — terrain, water,
     * a road. The same distinction `Landscape` drew by name and size; said outright
     * here, because the builder knows and needn't be guessed at.
     */
    ground(object) {
        if (!object || !object.isObject3D) {
            console.warn('world.ground() ignored: not an Object3D');
            return object;
        }
        object.userData.p27ground = true;
        this.solids.push(object);
        return object;
    }

    /** Something the walk should pass straight through — a cloud, a bird, spray. */
    ghost(object) {
        if (object && object.isObject3D) object.userData.p27ghost = true;
        return object;
    }

    /**
     * Says the world brings its own sky.
     *
     * The app puts up a plain gradient and a grid so an empty stage is something
     * rather than nothing. A world with a real sky in it wants both out of the way.
     */
    ownsSky(yes = true) {
        this._ownsSky = !!yes;
    }

    /** Where the ground sits, for stepping into the world. Metres, y-up. */
    groundLevel(y) {
        this._ground = y;
    }

    // MARK: - What moves

    /**
     * Anything that has to happen every frame: waves, sway, drift, a mixer.
     *
     * `dt` is clamped, so a world that comes back from the background does not
     * lurch a minute forward on its first frame.
     */
    frame(callback) {
        if (typeof callback === 'function') this._frame.push(callback);
    }

    // MARK: - How it is drawn

    /**
     * Asks for a bloom pass.
     *
     * Through the runtime rather than by building a composer, because the runtime
     * owns the render loop — two things each certain they are drawing the frame is
     * a black screen, and a scene cannot know whether the app is mid-transition.
     */
    bloom({ strength = 0.6, radius = 0.4, threshold = 0.85 } = {}) {
        this._bloom = { strength, radius, threshold };
    }

    // MARK: - Small helpers a scene keeps needing

    /** A canvas-drawn texture, in the colour space three expects for colour maps. */
    canvasTexture(width, height, draw) {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        draw(canvas.getContext('2d'), canvas);
        const texture = new THREE.CanvasTexture(canvas);
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
        return texture;
    }

    /** The same little value-noise pair most generated terrain wants. */
    static noise2(x, y) {
        const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
        return n - Math.floor(n);
    }
}
