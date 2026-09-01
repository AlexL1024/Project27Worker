//
//  queen-lm-dilworth.mod.js — Dilworth Building, Queen St / Customs St, Auckland
//  Edwardian Baroque, ~1927. Cream Oamaru limestone, giant Ionic pilasters,
//  a chamfered corner tower capped by a dark pyramidal roof + flagpole.
//  Built to the Flinders & Swanston standard: two kit meshes, graded glass.
//
import { makeKit } from './queen-kit.mod.js';

export const ID = 'w24009967';
export const RING = '199,-462 211,-458 236,-450 229,-426 190,-438 195,-459 199,-462';

export function build(world) {
    const K = makeKit(world);
    const { L, D, W } = K.frame(RING, 300);
    const C = K.col;

    // ---- palette (weathered Oamaru limestone) --------------------------
    const stone   = C('#d8cfbb');   // cream body
    const stoneHi = C('#e9dfc9');   // sunlit dressings
    const stoneSh = C('#bcb197');   // shadowed reveal
    const rust    = C('#d0c6b0');   // rusticated base
    const rustSh  = C('#b4aa93');
    const roofDk  = C('#37453d');   // slate/green pyramidal roof
    const roofHi  = C('#4b5a4f');
    const white   = C('#e0d8c6');   // window frames
    const skyC    = C('#a7bfce');   // graded glass head
    const sillC   = C('#27303a');   // graded glass sill (dark)
    const glassDk = C('#2a323b');
    const dark    = C('#312f2c');

    // ---- vertical scheme (metres above pavement) -----------------------
    const Y_SHOP  = 4.2;            // shopfront head / verandah level
    const Y_BASE  = 8.7;            // top of rusticated 2-storey base
    const Y_SHAFT0 = Y_BASE + 0.6;  // giant order springs
    const Y_SHAFT1 = 33.4;          // top of giant order shaft
    const Y_FRIEZE0 = Y_SHAFT1;
    const Y_FRIEZE1 = 35.6;         // name frieze band
    const Y_CORN  = 37.4;           // main cornice top
    const Y_ATTIC = 41.4;           // attic storey top
    const Y_PARA  = 43.2;           // main parapet top
    const Y_TWR1  = 47.6;           // tower pavilion / eaves line
    const Y_APEX  = 58.2;           // pyramid apex (steep, slender)
    const Y_MAST  = 64.0;           // flag mast top

    const NB = 7, bw = L / NB;             // main frontage bays
    const uT = L * 0.62, twHalf = 4.2, twProj = 2.4;   // corner tower

    // ==================================================================
    // SOLID BODY
    // ==================================================================
    K.box(W, 0, L, 0, D, 0, Y_PARA, stone, { front: 0, back: 1, left: 1, right: 1, top: 1 });

    // ==================================================================
    // MAIN (QUEEN ST) FRONTAGE — t = 0 plane
    // ==================================================================
    // granite plinth
    K.box(W, -0.2, L + 0.2, -0.1, 0.5, 0, 1.0, rustSh, { front: 1, left: 1, right: 1, top: 1 });

    // rusticated banding across the 2-storey base
    for (let b = 0; b < 6; b++) {
        const yy = 1.0 + b * ((Y_BASE - 1.0) / 6);
        K.box(W, -0.1, L + 0.1, 0, 0.26, yy, yy + ((Y_BASE - 1.0) / 6) - 0.09,
            b % 2 ? rust : rustSh, { front: 1, top: 1 });
    }

    // shopfronts across the ground floor
    const signCols = ['#1b1b1d', '#221e1b', '#1b1b1d', '#251f18', '#1b1b1d', '#231a16'];
    const NS = 6;
    for (let i = 0; i < NS; i++) {
        const u0 = 0.3 + i * (L / NS), u1 = (i + 1) * (L / NS) - 0.3;
        K.shopfront(W, u0, u1, 0.2, Y_SHOP + 0.2,
            { sign: signCols[i % signCols.length], mull: '#2a2b2d', riserC: '#232326',
              transom: 2.7, fascia: 0.7, sill: '#141a1f', sky: '#455060' });
    }

    // continuous cantilevered verandah over the footpath
    K.verandah(W, -0.3, L + 0.3, Y_SHOP, 3.1, '#33322f', '#cbc6b7');

    // mezzanine windows above the verandah
    for (let i = 0; i < NB; i++) {
        const uc = i * bw + bw / 2;
        K.windowRect(W, uc - 1.3, uc + 1.3, 0.25, Y_SHOP + 0.7, Y_BASE - 0.5, 0.34, white, skyC, sillC);
        K.box(W, uc - 1.55, uc + 1.55, -0.05, 0.2, Y_BASE - 0.5, Y_BASE - 0.24, stoneHi, { front: 1, top: 1, bottom: 1 });
    }
    // string course over the base
    K.box(W, -0.2, L + 0.2, -0.22, 0.16, Y_BASE, Y_BASE + 0.55, stoneHi, { front: 1, top: 1, bottom: 1 });

    // --- giant-order shaft : engaged Ionic pilasters + tall windows ----
    const giantBay = (u0, u1, tf) => {
        for (const pu of [u0 - 0.35, u1 - 0.35]) {
            K.box(W, pu, pu + 0.7, tf, tf + 0.4, Y_SHAFT0, Y_SHAFT1 - 0.7, stone, { front: 1, left: 1, right: 1 });
            K.box(W, pu - 0.12, pu + 0.82, tf, tf + 0.5, Y_SHAFT0, Y_SHAFT0 + 0.55, stoneHi, { front: 1, left: 1, right: 1, top: 1 });      // base
            K.box(W, pu - 0.18, pu + 0.88, tf, tf + 0.52, Y_SHAFT1 - 0.7, Y_SHAFT1 - 0.15, stoneHi, { front: 1, left: 1, right: 1, top: 1 }); // capital
            K.box(W, pu - 0.05, pu + 0.02, tf, tf + 0.5, Y_SHAFT1 - 0.62, Y_SHAFT1 - 0.28, stoneSh, { front: 1 });                          // volute hint
            K.box(W, pu + 0.68, pu + 0.75, tf, tf + 0.5, Y_SHAFT1 - 0.62, Y_SHAFT1 - 0.28, stoneSh, { front: 1 });
        }
        const nF = 5, gap = (Y_SHAFT1 - 0.9 - Y_SHAFT0 - 0.4) / nF;
        const uc = (u0 + u1) / 2;
        for (let f = 0; f < nF; f++) {
            const wy0 = Y_SHAFT0 + 0.5 + f * gap, wy1 = wy0 + gap - 0.55;
            K.windowRect(W, u0 + 0.45, u1 - 0.45, tf + 0.28, wy0, wy1, 0.42, white, skyC, sillC);
            K.box(W, uc - 0.07, uc + 0.07, tf + 0.28, tf + 0.34, wy0, wy1, white, { front: 1, left: 1, right: 1 }); // central mullion
            K.box(W, u0 + 0.15, u1 - 0.15, tf - 0.05, tf + 0.16, wy0 - 0.26, wy0, stoneHi, { front: 1, top: 1, bottom: 1 }); // sill
            K.box(W, u0 + 0.15, u1 - 0.15, tf - 0.05, tf + 0.16, wy1, wy1 + 0.18, stoneHi, { front: 1, top: 1, bottom: 1 }); // lintel
            // recessed spandrel panel to the next floor
            if (f < nF - 1) K.box(W, u0 + 0.55, u1 - 0.55, 0.05, 0.12, wy1 + 0.18, wy0 + gap + 0.5 - 0.55 - 0.26, stoneSh, { front: 1 });
        }
    };
    for (let i = 0; i < NB; i++) giantBay(i * bw + 0.45, (i + 1) * bw - 0.45, 0);

    // rusticated quoins at the left (north) end of the Queen frontage
    for (let b = 0; b < 9; b++) {
        const yy = Y_BASE + b * ((Y_CORN - Y_BASE) / 9);
        K.box(W, -0.05, 0.75, -0.05, 0.34, yy, yy + ((Y_CORN - Y_BASE) / 18), b % 2 ? stoneHi : stoneSh, { front: 1, left: 1, top: 1, bottom: 1 });
    }

    // --- name frieze "DILWORTH BUILDING" -------------------------------
    K.box(W, -0.2, L + 0.2, -0.1, 0.2, Y_FRIEZE0, Y_FRIEZE1, stoneHi, { front: 1, top: 1, bottom: 1 });
    K.signband(W, 1.5, L - 1.5, Y_FRIEZE0 + 0.4, Y_FRIEZE1 - 0.35, '#c6bca4');

    // --- main cornice + attic + parapet --------------------------------
    K.cornice(W, -0.4, L + 0.4, -0.15, Y_FRIEZE1, 3, stoneHi, stoneSh);
    K.box(W, -0.15, L + 0.15, 0, 0.25, Y_CORN, Y_ATTIC, stone, { front: 1, top: 1 });
    for (let i = 0; i < NB; i++) {
        const uc = i * bw + bw / 2;
        K.windowRect(W, uc - 0.9, uc + 0.9, 0.25, Y_CORN + 0.6, Y_ATTIC - 0.5, 0.3, white, skyC, sillC);
    }
    K.box(W, -0.25, L + 0.25, -0.3, 0.05, Y_ATTIC, Y_PARA, stone, { front: 1, back: 1, top: 1, left: 1, right: 1 });
    for (let i = 0; i < NB; i++) {
        const u0 = i * bw + 0.6, u1 = (i + 1) * bw - 0.6;
        K.box(W, u0, u1, -0.33, -0.3, Y_ATTIC + 0.3, Y_PARA - 0.3, stoneSh, { front: 1 });
    }

    // ==================================================================
    // CUSTOMS ST FRONTAGE — u = L plane (runs in depth t), same grammar
    // ==================================================================
    // recessed window on the u=L plane; recess goes inward (-u), glass inside
    const sideWin = (uPlane, dir, t0, t1, y0, y1, reveal) => {
        // dir = -1 for u=L (outward +u), recess toward smaller u
        const ui = uPlane + dir * reveal;
        K.box(W, Math.min(uPlane, ui), Math.max(uPlane, ui), t0, t1, y0, y1, white,
            { front: 1, back: 1, top: 1, bottom: 1, left: 0, right: 0 });
        const a = W(ui, t0, y0), b = W(ui, t1, y0), c = W(ui, t1, y1), d = W(ui, t0, y1);
        K.v(K.gla, a, sillC); K.v(K.gla, b, sillC); K.v(K.gla, c, skyC);
        K.v(K.gla, a, sillC); K.v(K.gla, c, skyC); K.v(K.gla, d, skyC);
    };
    {
        const t0f = 1.5, t1f = D - 1.5, Lf = t1f - t0f;
        const CB = Math.max(6, Math.round(Lf / 5.0)), cbw = Lf / CB;
        // base string on the side
        K.box(W, L - 0.16, L, t0f - 1.0, t1f + 1.0, Y_BASE, Y_BASE + 0.5, stoneHi, { back: 1, top: 1, bottom: 1, right: 1 });
        for (let i = 0; i < CB; i++) {
            const c0 = t0f + i * cbw + 0.4, c1 = t0f + (i + 1) * cbw - 0.4;
            // pilasters between customs bays
            for (const pt of [c0 - 0.3, c1 - 0.4]) {
                K.box(W, L - 0.4, L, pt, pt + 0.7, Y_SHAFT0, Y_SHAFT1 - 0.7, stone, { back: 1, right: 1, top: 1 });
            }
            const nF = 5, gap = (Y_SHAFT1 - 0.9 - Y_SHAFT0 - 0.4) / nF;
            for (let f = 0; f < nF; f++) {
                const wy0 = Y_SHAFT0 + 0.5 + f * gap, wy1 = wy0 + gap - 0.55;
                sideWin(L, -1, c0 + 0.3, c1 - 0.3, wy0, wy1, 0.4);
            }
            // mezzanine + attic
            sideWin(L, -1, c0 + 0.2, c1 - 0.2, Y_SHOP + 0.7, Y_BASE - 0.6, 0.32);
            sideWin(L, -1, c0 + 0.5, c1 - 0.5, Y_CORN + 0.6, Y_ATTIC - 0.5, 0.28);
        }
        // side cornice + parapet cap
        K.box(W, L - 0.5, L, t0f - 1.0, t1f + 1.0, Y_FRIEZE1, Y_CORN, stoneHi, { back: 1, right: 1, top: 1, bottom: 1 });
        K.box(W, L - 0.3, L + 0.05, t0f - 1.2, t1f + 1.2, Y_ATTIC, Y_PARA, stone, { back: 1, right: 1, top: 1 });
        // side verandah
        K.box(W, L - 0.1, L + 3.0, t0f - 1.0, t1f + 1.0, Y_SHOP, Y_SHOP + 0.34, C('#33322f'), { back: 1, right: 1, top: 1, front: 1 });
        K.box(W, L - 0.1, L + 3.0, t0f - 1.0, t1f + 1.0, Y_SHOP - 0.05, Y_SHOP, C('#cbc6b7'), { bottom: 1 });
        K.box(W, L + 2.85, L + 3.0, t0f - 1.0, t1f + 1.0, Y_SHOP - 0.6, Y_SHOP + 0.34, C('#33322f'), { right: 1, top: 1, front: 1, back: 1 });
        // ground shopfront glass on the customs side
        for (let i = 0; i < CB; i++) {
            const c0 = t0f + i * cbw + 0.3, c1 = t0f + (i + 1) * cbw - 0.3;
            const a = W(L - 0.15, c0, 0.4), b = W(L - 0.15, c1, 0.4), cc = W(L - 0.15, c1, Y_SHOP - 0.3), d = W(L - 0.15, c0, Y_SHOP - 0.3);
            K.v(K.gla, a, C('#141a1f')); K.v(K.gla, b, C('#141a1f')); K.v(K.gla, cc, C('#3a4652'));
            K.v(K.gla, a, C('#141a1f')); K.v(K.gla, cc, C('#3a4652')); K.v(K.gla, d, C('#3a4652'));
        }
    }

    // ==================================================================
    // BACK / LEFT walls : light window grid so orbit views read real
    // ==================================================================
    const plainGrid = (mode) => {
        // mode 'back' t=D plane ; 'left' u=0 plane — a full-height window grid
        const rows = 8, yTop = Y_ATTIC - 0.6, yBot = Y_SHOP + 1.0, rh = (yTop - yBot) / rows;
        const emit = (a, b, cc, d) => {
            K.v(K.gla, a, sillC); K.v(K.gla, b, sillC); K.v(K.gla, cc, skyC);
            K.v(K.gla, a, sillC); K.v(K.gla, cc, skyC); K.v(K.gla, d, skyC);
        };
        if (mode === 'back') {
            const cols = Math.max(5, Math.round(L / 5.0));
            for (let c = 0; c < cols; c++) {
                const u = 1.2 + c * ((L - 2.4) / cols) + 0.5;
                for (let r = 0; r < rows; r++) {
                    const y0 = yBot + r * rh, y1 = y0 + rh - 0.9;
                    emit(W(u, D - 0.12, y0), W(u + 1.7, D - 0.12, y0), W(u + 1.7, D - 0.12, y1), W(u, D - 0.12, y1));
                }
            }
        } else {
            const cols = Math.max(6, Math.round(D / 5.0));
            for (let c = 0; c < cols; c++) {
                const t = 1.2 + c * ((D - 2.4) / cols) + 0.5;
                for (let r = 0; r < rows; r++) {
                    const y0 = yBot + r * rh, y1 = y0 + rh - 0.9;
                    emit(W(0.12, t, y0), W(0.12, t + 1.7, y0), W(0.12, t + 1.7, y1), W(0.12, t, y1));
                }
            }
        }
    };
    plainGrid('back');
    plainGrid('left');

    // ==================================================================
    // CHAMFERED CORNER TOWER (the signature)
    // ==================================================================
    const tu0 = uT - twHalf, tu1 = uT + twHalf, tf = -twProj;

    K.box(W, tu0, tu1, tf, 0.1, 1.0, Y_TWR1, stoneHi, { front: 1, back: 0, left: 1, right: 1, top: 0 });
    // canted chamfer returns to the facade plane
    {
        K.quad(K.opa, W(tu0 - 1.5, 0, 1.0), W(tu0, tf, 1.0), W(tu0, tf, Y_TWR1), W(tu0 - 1.5, 0, Y_TWR1), stoneSh);
        K.quad(K.opa, W(tu1, tf, 1.0), W(tu1 + 1.5, 0, 1.0), W(tu1 + 1.5, 0, Y_TWR1), W(tu1, tf, Y_TWR1), stoneSh);
    }

    // tower giant order + stacked tall windows (extra levels above main)
    for (const pu of [tu0 + 0.1, tu1 - 0.8]) {
        K.box(W, pu, pu + 0.7, tf, tf + 0.4, Y_SHAFT0, Y_CORN - 0.7, stone, { front: 1, left: 1, right: 1 });
        K.box(W, pu - 0.15, pu + 0.85, tf, tf + 0.5, Y_CORN - 0.7, Y_CORN - 0.15, stoneHi, { front: 1, left: 1, right: 1, top: 1 });
    }
    const twrLevels = [
        [Y_SHOP + 0.7, Y_BASE - 0.5], [Y_SHAFT0 + 0.6, 13.3], [13.8, 18.8],
        [19.3, 24.3], [24.8, 29.8], [30.3, Y_CORN - 1.0],
        [Y_CORN + 0.5, Y_ATTIC + 0.5], [Y_ATTIC + 1.4, Y_TWR1 - 1.7],
    ];
    for (const [y0, y1] of twrLevels) {
        K.windowRect(W, tu0 + 0.8, tu1 - 0.8, tf + 0.3, y0, y1, 0.4, white, skyC, sillC);
        // two mullions -> triple lights on the broad tower face
        for (const mu of [uT - 1.7, uT + 1.7])
            K.box(W, mu - 0.07, mu + 0.07, tf + 0.3, tf + 0.36, y0, y1, white, { front: 1, left: 1, right: 1 });
        K.box(W, tu0 + 0.6, tu1 - 0.6, tf + 0.15, tf + 0.34, y0 - 0.22, y0, stoneHi, { front: 1, top: 1, bottom: 1 }); // sill
    }
    // balcony balustrade wrapping the tower pavilion stage (proud of the face)
    K.balustrade(W, tu0 + 0.4, tu1 - 0.4, tf - 0.55, Y_ATTIC + 0.3, 1.1, stoneHi);
    // pavilion-stage cornice line where the tower emerges above the main parapet
    K.box(W, tu0 - 0.5, tu1 + 0.5, tf - 0.35, tf + 0.02, Y_ATTIC - 0.1, Y_ATTIC + 0.35, stoneHi, { front: 1, top: 1, bottom: 1, left: 1, right: 1 });

    // tower cornice + wide bracketed eaves
    K.cornice(W, tu0 - 0.6, tu1 + 0.6, tf - 0.2, Y_TWR1 - 1.4, 2, stoneHi, stoneSh);
    // deep dark eaves plate overhanging on all sides
    K.box(W, tu0 - 1.5, tu1 + 1.5, tf - 1.5, 1.6, Y_TWR1, Y_TWR1 + 0.6, roofDk,
        { front: 1, back: 1, left: 1, right: 1, top: 1, bottom: 1 });
    // paired brackets under the eaves (front + chamfer returns)
    for (let i = 0; i <= 5; i++) {
        const bu = tu0 - 1.0 + i * ((tu1 - tu0 + 2.0) / 5);
        K.box(W, bu - 0.12, bu + 0.12, tf - 1.5, tf - 0.5, Y_TWR1 - 0.9, Y_TWR1, stoneHi, { front: 1, left: 1, right: 1, bottom: 1 });
    }

    // dark pyramidal hipped roof + pale hip ridges + small base lantern
    K.pyramid(W, tu0 - 0.9, tu1 + 0.9, tf - 0.9, 1.0, Y_TWR1 + 0.55, Y_APEX, roofDk);
    // hip highlight slivers along two visible edges
    K.box(W, uT - 0.07, uT + 0.07, tf - 0.9, 1.0, Y_TWR1 + 0.55, Y_APEX, roofHi, { front: 1, back: 1 });
    // small square finial base at the apex
    K.box(W, uT - 0.35, uT + 0.35, (tf + 1) / 2 - 0.9, (tf + 1) / 2 + 0.9, Y_APEX - 0.3, Y_APEX + 0.5, roofHi,
        { front: 1, back: 1, left: 1, right: 1, top: 1 });

    // flag mast at apex
    const mt = (tf + 1.0) / 2 - 0.45;
    K.box(W, uT - 0.07, uT + 0.07, mt - 0.07, mt + 0.07, Y_APEX + 0.5, Y_MAST, dark, { front: 1, back: 1, left: 1, right: 1, top: 1 });

    // ==================================================================
    // aging : downpipes + rooftop plant box
    // ==================================================================
    K.downpipe(W, 0.7, 1.0, Y_CORN);
    K.downpipe(W, L - 0.7, 1.0, Y_CORN);
    K.downpipe(W, tu1 + 1.7, 1.0, Y_TWR1 - 2.0);
    K.acbox(W, 3.0, 7.0, 3.5, 6.5, Y_PARA, Y_PARA + 1.6, '#70726f');

    K.finish('dilworth', { roughness: 0.9, glassRough: 0.16, metalness: 0.03 });
}
