//
//  queen-lm-townhall.mod.js — Auckland Town Hall (1911), Queen St / Grey St.
//
//  Cream Oamaru-stone Italian Renaissance wedge: a two-storey block with arched
//  ground-floor windows, rectangular upper windows on a giant order, a string
//  course and a balustraded parapet. At the north apex (facing the Aotea Square
//  / Queen St junction) a curved colonnaded corner, and rising above it a TALL
//  slender clock tower — square shaft, a clock stage high up, a columned belfry,
//  and only a small copper (verdigris) domed cupola with a flagpole on top.
//
import { makeKit } from './queen-kit.mod.js';

export const ID = 'w23904006';
export const RING = '-106,473 -104,469 -101,458 -99,453 -97,449 -96,447 -96,445 -95,442 -94,439 -93,437 -92,435 -78,396 -78,395 -79,393 -79,392 -80,392 -80,391 -81,390 -81,390 -82,389 -83,389 -84,388 -85,388 -86,388 -87,388 -92,393 -106,407 -111,412 -117,417 -119,419 -121,421 -127,428 -131,432 -137,437 -145,445 -150,449 -153,452 -154,454 -156,455 -157,456 -158,457 -163,461 -135,472 -135,471 -132,472 -131,468 -107,477 -106,473';

export function build(world) {
    const K = makeKit(world);
    const { L, D, W } = K.frame(RING, 118);            // long Queen St frontage faces ESE

    const C = {
        stone:  K.col('#e6dfcd'),
        stoneS: K.col('#d4ccb6'),
        stoneD: K.col('#c2b9a0'),
        col:    K.col('#efe8d7'),
        sill:   K.col('#343a40'),
        sky:    K.col('#aab7c6'),
        frame:  K.col('#ccc4b2'),
        green:  K.col('#5f9e86'),   // copper verdigris cupola
        greenD: K.col('#4a8570'),
        roof:   K.col('#8b857a'),
        clock:  K.col('#efeee8'),
    };

    const yG1 = 7.2, y2 = 14.4, yPar = 16.2;           // two storeys + parapet
    const uApex = 0.0;                                  // u=0 is the north/junction apex
    const Dbody = Math.min(D, 32);                      // build a slab along the frontage, not the whole wedge block
    const towerU0 = 1.0, towerU1 = 9.5, towerT0 = 1.0, towerT1 = 9.5;

    // ---- main two-storey body -------------------------------------------
    K.box(W, uApex, L, 0.6, Dbody, 0.0, yPar, C.stone, { back: 1, left: 1, right: 1, top: 1 });
    K.box(W, uApex, L, -0.3, Dbody, 0.0, 0.7, C.stoneD, { front: 1, left: 1, right: 1, top: 1 });   // plinth

    // ground floor: round-arched windows on a bay rhythm
    const nb = Math.max(6, Math.round((L - 10) / 4.2));
    const bw = (L - 10) / nb;
    for (let i = 0; i < nb; i++) {
        const a = 10 + i * bw + 0.9, b = 10 + (i + 1) * bw - 0.9;
        K.windowRect(W, a, b, 0.3, 1.2, yG1 - 1.4, 0.45, C.frame, C.sky, C.sill);
        K.archHead(W, a, b, 0.3, yG1 - 1.4, 0.45, C.stoneS, C.sky);
        // upper storey: rectangular window with pilasters, giant-order feel
        K.box(W, 10 + i * bw - 0.4, 10 + i * bw + 0.4, 0.0, 0.7, yG1, y2, C.col, { front: 1, left: 1, right: 1 });
        K.windowRect(W, a, b, 0.3, yG1 + 1.0, y2 - 0.8, 0.45, C.frame, C.sky, C.sill);
    }
    K.box(W, 10, L, 0.0, 0.25, yG1 - 0.35, yG1 + 0.1, C.stoneS, { front: 1, top: 1 });   // string course
    K.cornice(W, 10, L, 0.0, y2, 1, C.stone, C.stoneS);
    K.balustrade(W, 10, L, 0.2, yPar - 1.2, 1.4, C.stoneS);                                // parapet

    // ---- curved colonnaded corner at the apex ---------------------------
    // a quarter-round of engaged Corinthian columns wrapping the north corner
    (function corner() {
        const cx = 11.5, ct = 11.5, rad = 10.5, seg = 6;
        const a0 = Math.PI, a1 = Math.PI * 1.5;         // wrap the u=0 / t=0 quadrant
        // curved two-storey wall
        let prev = null;
        for (let s = 0; s <= seg; s++) {
            const ang = a0 + (a1 - a0) * (s / seg);
            const u = cx + rad * Math.cos(ang), t = ct + rad * Math.sin(ang);
            if (prev) {
                K.quad(K.opa, W(prev.u, prev.t, 0), W(u, t, 0), W(u, t, yPar), W(prev.u, prev.t, yPar), C.stone);
                // engaged column at each station
                K.box(W, u - 0.6, u + 0.6, t - 0.6, t + 0.6, 0.0, y2, C.col, { front: 1, back: 1, left: 1, right: 1, top: 1 });
            }
            prev = { u, t };
        }
        // curved balustrade cap
        prev = null;
        for (let s = 0; s <= seg; s++) {
            const ang = a0 + (a1 - a0) * (s / seg);
            const u = cx + rad * Math.cos(ang), t = ct + rad * Math.sin(ang);
            if (prev) K.quad(K.opa, W(prev.u, prev.t, yPar), W(u, t, yPar), W(u, t, yPar + 1.4), W(prev.u, prev.t, yPar + 1.4), C.stoneS);
            prev = { u, t };
        }
    })();

    // ---- tall clock tower rising above the corner -----------------------
    (function tower() {
        const yShaft0 = yPar, yClock = 33.0, yBell = 39.0, yBellTop = 43.0, yDome = 46.5, yApexTip = 48.5;
        const u0 = towerU0, u1 = towerU1, t0 = towerT0, t1 = towerT1;
        const cU = (u0 + u1) / 2, cT = (t0 + t1) / 2;
        // shaft
        K.box(W, u0, u1, t0, t1, 0.0, yClock, C.stone, { front: 1, back: 1, left: 1, right: 1, top: 0 });
        // quoined corners
        for (const [a, b] of [[u0, t0], [u1, t0], [u0, t1], [u1, t1]]) {
            K.box(W, a - 0.4, a + 0.4, b - 0.4, b + 0.4, yShaft0, yClock, C.stoneS, { front: 1, back: 1, left: 1, right: 1 });
        }
        // string courses up the shaft
        for (let y = 20; y < yClock; y += 6) K.box(W, u0 - 0.2, u1 + 0.2, t0 - 0.2, t1 + 0.2, y, y + 0.4, C.stoneS, { front: 1, back: 1, left: 1, right: 1 });
        // clock stage: slightly proud block with a clock face on the two street faces
        K.box(W, u0 - 0.5, u1 + 0.5, t0 - 0.5, t1 + 0.5, yClock, yBell, C.stone, { front: 1, back: 1, left: 1, right: 1, top: 1 });
        const yc = (yClock + yBell) / 2;
        K.disc(W, cU, yc, t0 - 0.55, 1.7, C.clock, 20);          // front clock
        K.disc(W, cU, yc, t0 - 0.55, 1.85, C.stoneD, 20);        // clock surround (drawn first-behind by order? emit ring)
        K.disc(W, cU, yc, t0 - 0.53, 1.6, C.clock, 20);
        K.box(W, u0 - 0.55, u1 + 0.55, cT - 0.02, cT + 0.02, yc - 1.6, yc + 1.6, C.stoneD, { }); // hand hint
        // belfry stage: open columned lantern
        K.box(W, u0, u1, t0, t1, yBell, yBellTop, C.stoneS, { top: 1 });
        for (const [a, b] of [[u0, t0], [u1, t0], [u0, t1], [u1, t1]]) K.box(W, a - 0.35, a + 0.35, b - 0.35, b + 0.35, yBell, yBellTop, C.col, { front: 1, back: 1, left: 1, right: 1 });
        K.box(W, u0 - 0.4, u1 + 0.4, t0 - 0.4, t1 + 0.4, yBellTop - 0.5, yBellTop + 0.2, C.stone, { front: 1, back: 1, left: 1, right: 1, top: 1 });
        // small copper domed cupola
        const dr = (u1 - u0) / 2 + 0.2, seg = 10;
        for (let s = 0; s < seg; s++) {
            const a0 = (s / seg) * Math.PI * 2, a1 = ((s + 1) / seg) * Math.PI * 2;
            const y0 = yBellTop, ymid = yDome;
            K.v(K.opa, W(cU + dr * Math.cos(a0), cT + dr * Math.sin(a0), y0), C.green);
            K.v(K.opa, W(cU + dr * Math.cos(a1), cT + dr * Math.sin(a1), y0), C.green);
            K.v(K.opa, W(cU, cT, ymid), C.greenD);
        }
        // flagpole + flag
        K.box(W, cU - 0.08, cU + 0.08, cT - 0.08, cT + 0.08, yDome, yApexTip + 2.5, C.roof, { front: 1, back: 1, left: 1, right: 1 });
        K.box(W, cU + 0.08, cU + 1.8, cT, cT + 0.03, yApexTip + 1.3, yApexTip + 2.4, K.col('#b23a3a'), { front: 1, back: 1 });
    })();

    K.finish('townhall', { roughness: 0.9, glassRough: 0.2, skirt: '#8a8880' });
}
