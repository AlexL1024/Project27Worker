//
//  queen-lm-cpo.mod.js — Chief Post Office / Waitematā (Britomart) station.
//
//  Edwardian Baroque, symmetrical: a rusticated grey-granite ground floor with
//  a central round-arched entrance arcade; a giant Ionic order (engaged columns)
//  over the two middle storeys in cream Oamaru limestone; an attic storey of
//  round-arched windows; a central triangular pediment with the flagpole; and
//  two projecting end pavilions capped by scrolled Baroque gables. No dome, no
//  clock tower — the real building has neither. Faces Te Komititanga square (N).
//
import { makeKit } from './queen-kit.mod.js';

export const ID = 'w23904390';
export const RING = '271,-512 272,-516 273,-520 274,-523 276,-527 277,-532 279,-538 283,-549 284,-553 285,-555 286,-559 287,-561 288,-564 263,-572 245,-578 242,-569 245,-568 244,-564 242,-560 237,-542 235,-538 234,-535 232,-535 229,-525 242,-521 271,-512';

export function build(world) {
    const K = makeKit(world);
    const { L, D, W } = K.frame(RING, 350);            // grand facade faces the square (NNW)

    const C = {
        stone:  K.col('#e9e3d4'),   // cream Oamaru limestone
        stoneS: K.col('#d8d1bf'),   // shaded stone trim
        gran:   K.col('#b9b7b0'),   // grey granite base
        granD:  K.col('#9d9b92'),   // rustication joints / shade
        col:    K.col('#efe9db'),   // engaged column (lit)
        sill:   K.col('#33393f'),   // dark glass at sill
        sky:    K.col('#a9b7c6'),   // pale glass at head
        frame:  K.col('#cbc4b4'),   // window reveal
        roof:   K.col('#8f8a80'),
    };
    const uL = 0.0, uR = L;

    // ---- storey heights (m from pavement) --------------------------------
    const yG0 = 0.0, yG1 = 5.6;         // rusticated granite ground floor
    const yP1 = 15.8;                   // top of giant order (2 storeys)
    const yEnt = 17.4;                  // top of main entablature
    const yA1 = 21.0;                   // top of attic storey
    const yPar = 22.6;                  // top of parapet
    const t0 = 0.0, wallT = D;

    // solid body behind the facade so nothing is see-through
    K.box(W, uL, uR, 0.8, wallT, yG0, yPar, C.stone, { back: 1, left: 1, right: 1, top: 1 });
    // granite plinth, slightly proud
    K.box(W, uL, uR, -0.35, wallT, yG0, 0.7, C.granD, { front: 1, left: 1, right: 1, top: 1 });

    // ---- bay layout ------------------------------------------------------
    const endW = Math.min(9, L * 0.16);          // end pavilion width
    const cenW = Math.min(13, L * 0.22);         // central pedimented bay width
    const runW = (L - 2 * endW - cenW) / 2;      // each middle run
    const nbSide = Math.max(3, Math.round(runW / 4.0));
    const leftRun = [endW, endW + runW];
    const cenRun = [endW + runW, endW + runW + cenW];
    const rightRun = [endW + runW + cenW, L - endW];

    // rusticated granite ground floor: horizontal joint lines across the front
    for (let y = 0.7; y < yG1; y += 0.9) {
        K.box(W, uL + 0.2, uR - 0.2, 0.02, 0.12, y, y + 0.06, C.granD, { front: 1 });
    }

    // a giant-order run: engaged columns + tall 2-storey windows + granite base openings
    function run(u0, u1, archedGround) {
        const n = Math.max(1, Math.round((u1 - u0) / 4.0));
        const bw = (u1 - u0) / n;
        for (let i = 0; i <= n; i++) {
            const u = u0 + i * bw;                // engaged column / pilaster line
            K.box(W, u - 0.5, u + 0.5, t0, 0.9, yG1, yP1, C.col, { front: 1, left: 1, right: 1, top: 1 });
            // simple Ionic capital + base band
            K.box(W, u - 0.7, u + 0.7, t0, 1.0, yP1 - 0.6, yP1, C.stoneS, { front: 1, left: 1, right: 1, top: 1 });
            K.box(W, u - 0.7, u + 0.7, t0, 1.0, yG1, yG1 + 0.4, C.stoneS, { front: 1, left: 1, right: 1 });
        }
        for (let i = 0; i < n; i++) {
            const a = u0 + i * bw + 0.9, b = u0 + (i + 1) * bw - 0.9;
            // tall piano-nobile window (two lights split by a spandrel)
            K.windowRect(W, a, b, t0 + 0.5, yG1 + 0.8, yP1 - 1.0, 0.5, C.frame, C.sky, C.sill);
            K.box(W, a - 0.1, b + 0.1, t0 + 0.4, t0 + 0.55, (yG1 + yP1) / 2 - 0.3, (yG1 + yP1) / 2 + 0.3, C.stoneS, { front: 1 });
            // ground floor opening under the bay
            const ga = u0 + i * bw + 0.8, gb = u0 + (i + 1) * bw - 0.8;
            if (archedGround) {
                K.windowRect(W, ga, gb, t0 + 0.4, 0.9, yG1 - 2.2, 0.5, C.granD, C.sky, C.sill);
                K.archHead(W, ga, gb, t0 + 0.4, yG1 - 2.2, 0.5, C.granD, C.sky);
            } else {
                K.windowRect(W, ga, gb, t0 + 0.4, 1.0, yG1 - 0.9, 0.5, C.granD, C.sky, C.sill);
            }
            // oval paterae medallion between ground openings
            if (i < n - 1) K.disc(W, u0 + (i + 1) * bw, yG1 - 3.6, t0 + 0.25, 0.9, C.stoneS, 14);
        }
    }
    run(leftRun[0], leftRun[1], false);
    run(rightRun[0], rightRun[1], false);

    // ---- central bay: 5-arch entrance arcade + pediment ------------------
    (function centre() {
        const [c0, c1] = cenRun;
        const na = 5, aw = (c1 - c0) / na;
        for (let i = 0; i < na; i++) {
            const a = c0 + i * aw + 0.5, b = c0 + (i + 1) * aw - 0.5;
            K.windowRect(W, a, b, t0 + 0.3, 0.6, yG1 - 1.6, 0.6, C.granD, C.sky, C.sill);
            K.archHead(W, a, b, t0 + 0.3, yG1 - 1.6, 0.6, C.granD, C.sky);
        }
        // three tall windows with engaged columns over the arcade
        const nb = 3, bw = (c1 - c0) / nb;
        for (let i = 0; i <= nb; i++) {
            const u = c0 + i * bw;
            K.box(W, u - 0.55, u + 0.55, t0, 1.0, yG1, yP1, C.col, { front: 1, left: 1, right: 1, top: 1 });
        }
        for (let i = 0; i < nb; i++) {
            const a = c0 + i * bw + 1.0, b = c0 + (i + 1) * bw - 1.0;
            K.windowRect(W, a, b, t0 + 0.5, yG1 + 0.8, yP1 - 0.8, 0.5, C.frame, C.sky, C.sill);
        }
        // triangular pediment over the centre
        const yb = yEnt, apex = yEnt + 3.3, tf = t0 + 0.2;
        K.v(K.opa, W(c0, tf, yb), C.stone); K.v(K.opa, W(c1, tf, yb), C.stone); K.v(K.opa, W((c0 + c1) / 2, tf, apex), C.stone);
        K.box(W, c0 - 0.4, c1 + 0.4, t0, 0.6, yEnt - 0.5, yEnt + 0.2, C.stoneS, { front: 1, top: 1 });
        // flagpole + flag at the apex
        K.box(W, (c0 + c1) / 2 - 0.08, (c0 + c1) / 2 + 0.08, t0 + 0.1, t0 + 0.26, apex, apex + 4.5, C.roof, { front: 1, back: 1, left: 1, right: 1 });
        K.box(W, (c0 + c1) / 2 + 0.08, (c0 + c1) / 2 + 2.2, t0 + 0.15, t0 + 0.2, apex + 3.1, apex + 4.4, K.col('#b23a3a'), { front: 1, back: 1 });
    })();

    // ---- end pavilions: projecting, taller, scrolled Baroque gables ------
    function pavilion(u0, u1) {
        const cx = (u0 + u1) / 2, fp = -0.6;           // projects 0.6 m proud
        // solid stone body incl. its FRONT face (so it isn't a dark cavity)
        K.box(W, u0, u1, fp, 0.8, yG0, yPar + 0.6, C.stone, { front: 1, left: 1, right: 1, top: 1 });
        // rusticated granite base
        K.box(W, u0, u1, fp, fp + 0.15, yG0, yG1, C.gran, { front: 1 });
        for (let y = 0.9; y < yG1; y += 0.9) K.box(W, u0 + 0.2, u1 - 0.2, fp + 0.02, fp + 0.1, y, y + 0.05, C.granD, { front: 1 });
        // big arched window on the piano nobile (kept clear of the edges)
        const a = u0 + 1.6, b = u1 - 1.6;
        K.windowRect(W, a, b, fp + 0.15, yG1 + 1.2, yP1 - 2.4, 0.4, C.frame, C.sky, C.sill);
        K.archHead(W, a, b, fp + 0.15, yP1 - 2.4, 0.4, C.stoneS, C.sky);
        // granite doorway in the base
        K.windowRect(W, a + 0.4, b - 0.4, fp + 0.15, 0.9, yG1 - 1.4, 0.4, C.granD, C.sky, C.sill);
        // oval medallion above the piano-nobile window
        K.disc(W, cx, yP1 - 1.0, fp + 0.12, 0.8, C.stoneS, 14);
        // attic-level window
        K.windowRect(W, a + 0.6, b - 0.6, fp + 0.12, yEnt + 0.4, yA1 - 0.7, 0.35, C.frame, C.sky, C.sill);
        // scrolled Baroque gable rising from the parapet (stepped + volutes)
        K.box(W, u0 + 0.3, u1 - 0.3, fp, 0.6, yPar + 0.6, yPar + 2.2, C.stone, { front: 1, left: 1, right: 1, top: 1 });
        K.box(W, u0 + 1.6, u1 - 1.6, fp, 0.6, yPar + 2.2, yPar + 3.5, C.stone, { front: 1, left: 1, right: 1, top: 1 });
        K.disc(W, u0 + 1.1, yPar + 1.5, fp + 0.05, 0.7, C.stoneS, 12);
        K.disc(W, u1 - 1.1, yPar + 1.5, fp + 0.05, 0.7, C.stoneS, 12);
        K.box(W, cx - 0.3, cx + 0.3, fp, 0.55, yPar + 3.5, yPar + 4.2, C.stoneS, { front: 1, back: 1, left: 1, right: 1, top: 1 });
    }
    pavilion(uL, uL + endW);
    pavilion(uR - endW, uR);

    // ---- entablature, attic storey, parapet ------------------------------
    K.cornice(W, leftRun[0], rightRun[1], t0, yP1, 2, C.stone, C.stoneS);     // over the giant order
    // attic storey: round-arched windows on a bay rhythm
    const na2 = Math.max(6, Math.round((rightRun[1] - leftRun[0]) / 3.6));
    const aw2 = (rightRun[1] - leftRun[0]) / na2;
    for (let i = 0; i < na2; i++) {
        const a = leftRun[0] + i * aw2 + 0.9, b = leftRun[0] + (i + 1) * aw2 - 0.9;
        K.windowRect(W, a, b, t0 + 0.35, yEnt + 0.4, yA1 - 0.9, 0.4, C.frame, C.sky, C.sill);
        K.archHead(W, a, b, t0 + 0.35, yA1 - 0.9, 0.4, C.stoneS, C.sky);
    }
    // main cornice + solid parapet across the whole front
    K.cornice(W, leftRun[0], rightRun[1], t0, yA1, 2, C.stone, C.stoneS);
    K.box(W, leftRun[0], rightRun[1], t0, 0.5, yPar - 0.4, yPar + 0.5, C.stone, { front: 1, top: 1 });

    K.finish('cpo', { roughness: 0.9, glassRough: 0.2, skirt: '#8a8880' });
}
