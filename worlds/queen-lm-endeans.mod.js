//
//  queen-lm-endeans.mod.js — Endeans Building, lower Queen Street, Auckland.
//
//  A 1910s / 1920s Edwardian-Baroque-into-stripped-classical corner commercial
//  block: pale ivory rendered (stucco) facade over a warmer tan lower two
//  storeys, strong flat pilaster strips dividing the main (north) elevation
//  into bays, tall multi-pane bronze-framed windows, a Greek-key (meander)
//  mezzanine frieze over the shopfronts, circular paterae discs on the lower
//  spandrels, a heavy bracketed cornice, a set-back attic storey and a
//  meander parapet with squared corner pylons. Built to the Flinders &
//  Swanston standard: two vertex-coloured meshes, windows as graded panes.
//
//  Footprint © OpenStreetMap contributors (ODbL). World metres: x east, z
//  south, y up.
//

import { makeKit } from './queen-kit.mod.js';

export const ID = 'w147113567';
export const RING = '258,-612 282,-603 275,-583 274,-579 266,-581 249,-587 251,-591 258,-612';

export function build(world) {
    const K = makeKit(world);
    const { L, D, W } = K.frame(RING, 199);   // detailed facade faces the street to the north

    // ---- palette (warm weathered render, bronze windows) -----------------
    const cream   = K.col('#e9e2cf'), creamHi = K.col('#f4eede'), creamSh = K.col('#d8cdb1');
    const tan     = K.col('#e0caa0'), tanHi   = K.col('#eeddba'), tanSh   = K.col('#cdb488');
    const frameC  = K.col('#33322c');
    const sky     = K.col('#b3cad6'), sill    = K.col('#5a666f');   // reflective pale glass, graded
    const shopG   = K.col('#3c4750'), shopSill= K.col('#242c31');
    const awning  = K.col('#232329'), signC   = K.col('#c9cdd2');
    const granite = K.col('#8f877a');
    const discC   = K.col('#cabf9d');

    // ---- storey lines (m above pavement) ---------------------------------
    const Y_PLINTH = 0.7, Y_SHOP = 4.8, Y_MEZ = 6.1;
    const fh = 3.45;
    const FY = [Y_MEZ, Y_MEZ + fh, Y_MEZ + 2*fh, Y_MEZ + 3*fh, Y_MEZ + 4*fh, Y_MEZ + 5*fh]; // 5 window floors
    const Y_CORN = FY[5];                 // 23.35
    const Y_BRK  = Y_CORN + 1.05;          // top of brackets
    const Y_SLAB = Y_BRK + 0.35;           // top of cornice slab
    const Y_ATT  = Y_SLAB + 3.4;           // top of attic wall
    const Y_PARA = Y_ATT + 0.85;           // parapet cap
    const attSet = 1.2;                    // attic set-back (m)

    // ---- solid body: FRONT WALL DRAWN so facade elements sit proud -------
    // lower two floors tan, everything above cream; all faces + top drawn.
    K.box(W, 0, L, 0, D, 0,       FY[2], tan,    { front:1, back:1, left:1, right:1, top:0 });
    K.box(W, 0, L, 0, D, FY[2],   Y_CORN, cream, { front:1, back:1, left:1, right:1, top:0 });
    K.box(W, 0, L, 0, D, 0,       Y_CORN, K.col('#b4afa2'),{ front:0, back:0, left:0, right:0, top:1 }); // roof cap

    // ---- granite plinth ---------------------------------------------------
    K.box(W, -0.2, L+0.2, -0.15, 0.5, 0, Y_PLINTH, granite, { front:1, left:1, right:1, top:1 });

    // ---- ground-floor shopfronts (Melbourne grammar) + verandah ----------
    // tenancy bays across the whole frontage, varied sign colours per tenant
    const shopSigns = ['#33455a', '#1d1d22', '#3f6b3a', '#5a5f66', '#7a2f2f'];
    const NS = Math.max(4, Math.round(L / 6.0)), sw = L / NS;
    for (let i = 0; i < NS; i++) {
        K.shopfront(W, i*sw + 0.25, (i+1)*sw - 0.25, Y_PLINTH, Y_SHOP, {
            sign: shopSigns[i % shopSigns.length], mull: '#2f3033',
            sill: '#1b2026', sky: '#8a9bad', transom: 2.6, fascia: 0.85,
        });
    }
    // one continuous cantilever verandah over the footpath (t<0 = toward street)
    K.verandah(W, -0.3, L+0.3, 4.1, 3.4, '#2b2b30', '#dcd7c9');
    // pale signage fascia plate across the shopfronts (ICBC / Metro band)
    K.signband(W, 0.2, L-0.2, Y_SHOP-0.55, Y_SHOP-0.05, '#cfd3d8');

    // ---- mezzanine Greek-key frieze band ---------------------------------
    meander(0.2, L-0.2, Y_SHOP, Y_MEZ, tanHi, tanSh);

    // ============ MAIN NORTH FACADE: pilaster bays + windows =============
    const NB = Math.max(4, Math.round(L / 4.5)), bw = L / NB;
    const wp = 0.85;   // pilaster width

    // giant-order pilaster strips at every bay boundary
    for (let i = 0; i <= NB; i++) {
        const u = i * bw;
        const isEnd = (i === 0 || i === NB);
        const pw = isEnd ? wp + 0.5 : wp;
        pilaster(u - pw/2, u + pw/2, Y_MEZ, Y_CORN, isEnd);
    }

    // string course at the tan/cream (piano-nobile) transition
    K.box(W, -0.15, L+0.15, -0.24, 0.03, FY[2]-0.16, FY[2]+0.12, tanHi, { front:1, top:1, bottom:1 });

    // windows, floor by floor, bay by bay
    for (let i = 0; i < NB; i++) {
        const bu0 = i * bw + wp/2 + 0.35, bu1 = (i + 1) * bw - wp/2 - 0.35;
        // vertical reveal grooves flanking the window column (shadow lines)
        for (const gu of [bu0 - 0.22, bu1 + 0.22])
            K.box(W, gu - 0.06, gu + 0.06, -0.02, 0.03, Y_MEZ, Y_CORN, creamSh, { front:1 });
        for (let f = 0; f < 5; f++) {
            const yb = FY[f], yt = FY[f+1];
            const wy0 = yb + 0.55, wy1 = yt - 0.55;
            const warm = (f < 2);
            gridWindow(bu0, bu1, 0, wy0, wy1, warm);
            // stone sill under each window
            K.box(W, bu0-0.15, bu1+0.15, -0.14, 0.04, wy0-0.28, wy0, warm?tanHi:creamHi, { front:1, top:1, bottom:1 });
            // slim cornice/lintel over the window head
            K.box(W, bu0-0.2, bu1+0.2, -0.18, 0.04, wy1, wy1+0.22, warm?tanHi:creamHi, { front:1, top:1, bottom:1 });
        }
        // paterae disc on the spandrel between the F1 and F2 windows
        const uc = i*bw + bw/2;
        K.disc(W, uc, FY[1], -0.05, 0.55, creamHi, 16);
        K.disc(W, uc, FY[1], -0.09, 0.40, tanSh, 16);
        K.disc(W, uc, FY[1], -0.12, 0.20, creamHi, 14);
    }

    // ---- heavy bracketed cornice -----------------------------------------
    for (let i = 0; i <= NB; i++) {
        const u = i * bw;
        for (const du of [-0.85, 0.85]) {
            K.box(W, u+du-0.4, u+du+0.4, -0.9, 0.02, Y_CORN-0.35, Y_BRK, creamHi, { front:1, left:1, right:1, top:1, bottom:1 });
            K.box(W, u+du-0.5, u+du+0.5, -0.5, 0.02, Y_CORN-0.35, Y_CORN-0.1, creamSh, { front:1, bottom:1 }); // corbel scroll base
        }
    }
    // projecting cornice slab over the brackets
    K.box(W, -0.5, L+0.5, -0.95, 0.05, Y_BRK, Y_SLAB, creamHi, { front:1, top:1, bottom:1, left:1, right:1 });

    // ---- set-back attic storey -------------------------------------------
    K.box(W, 0, L, attSet, D, Y_SLAB, Y_ATT, cream, { front:1, back:0, left:1, right:1, top:1 });
    for (let i = 0; i < NB; i++) {
        const bu0 = i * bw + wp/2 + 0.4, bu1 = (i + 1) * bw - wp/2 - 0.4;
        gridWindow(bu0, bu1, attSet, Y_SLAB+0.6, Y_ATT-0.6, false);
        // small pilaster tick between attic windows
        K.box(W, i*bw+wp/2-0.2, i*bw+wp/2+0.2, attSet-0.02, attSet+0.2, Y_SLAB, Y_ATT, creamSh, { front:1, left:1, right:1 });
    }
    // ---- parapet with meander + squared corner pylons --------------------
    K.box(W, 0, L, attSet-0.1, attSet+0.2, Y_ATT, Y_PARA, cream, { front:1, top:1, left:1, right:1 });
    meander(0.3, L-0.3, Y_ATT, Y_PARA, creamHi, creamSh);
    for (const u of [0, L]) {   // corner pylons
        const u0 = (u === 0) ? -0.1 : L - 1.4, u1 = (u === 0) ? 1.5 : L + 0.1;
        K.box(W, u0, u1, -0.9, 0.9, Y_CORN, Y_PARA + 0.9, creamHi, { front:1, back:1, left:1, right:1, top:1 });
        // greek-key panel on the pylon face
        meander(u0+0.15, u1-0.15, Y_CORN+0.6, Y_CORN+2.4, cream, creamSh);
    }

    // ==== SIDE-STREET RETURN ELEVATIONS (both ends are corner faces) =====
    // The building fronts two streets at the corner, so both u-planes carry a
    // plainer punched-window return (east = u=L, west = u=0).
    const NBe = Math.max(3, Math.round((D - attSet) / 4.6)), bwe = (D - 1.0) / NBe;
    for (const side of [+1, -1]) {           // +1 = east (u=L), -1 = west (u=0)
        for (let f = 0; f < 5; f++) {
            const yb = FY[f], yt = FY[f+1];
            const warm = (f < 2);
            for (let j = 0; j < NBe; j++) {
                const t0 = 1.0 + j*bwe + 0.7, t1 = 1.0 + (j+1)*bwe - 0.7;
                sideWindow(side, t0, t1, yt-0.5, yb+0.55, warm);
            }
        }
    }
    // side cornice lines wrap the corner on both returns
    K.box(W, L, L+0.6, 0, D, Y_CORN, Y_SLAB, creamHi, { right:1, front:1, back:1, top:1 });
    K.box(W, -0.6, 0, 0, D, Y_CORN, Y_SLAB, creamHi, { left:1, front:1, back:1, top:1 });

    // ---- aging: downpipes down the return, a rooftop plant box -----------
    K.downpipe(W, L - 0.4, Y_PLINTH, Y_CORN, '#37373a');
    K.downpipe(W, 1.2, Y_PLINTH, Y_CORN, '#3a3a3d');
    K.acbox(W, L*0.35, L*0.65, D*0.4, D*0.6, Y_SLAB, Y_SLAB + 1.6, '#6e7074');

    const tris = K.finish('endeans', { roughness: 0.85, glassRough: 0.12, metalness: 0.03 });
    void tris;

    // ================= local facade helpers ==============================
    // a multi-pane bronze window: graded pane + a thin mullion cross, flush on front
    function gridWindow(u0, u1, tw, y0, y1, warm) {
        const t = tw - 0.03;
        const a = W(u0,t,y0), b = W(u1,t,y0), c = W(u1,t,y1), d = W(u0,t,y1);
        K.v(K.gla,a,sill); K.v(K.gla,b,sill); K.v(K.gla,c,sky); K.v(K.gla,a,sill); K.v(K.gla,c,sky); K.v(K.gla,d,sky);
        // proud bronze frame (thin border boxes) + a cross of mullions
        const fr = frameC, tf = t - 0.12;
        K.box(W, u0, u1, tf, tf+0.12, y0, y0+0.1, fr, { front:1 });
        K.box(W, u0, u1, tf, tf+0.12, y1-0.1, y1, fr, { front:1 });
        K.box(W, u0, u0+0.1, tf, tf+0.12, y0, y1, fr, { front:1 });
        K.box(W, u1-0.1, u1, tf, tf+0.12, y0, y1, fr, { front:1 });
        const um = (u0+u1)/2;
        K.box(W, um-0.05, um+0.05, tf, tf+0.06, y0, y1, fr, { front:1 });
        for (let k=1;k<=2;k++){ const ym = y0 + (y1-y0)*k/3; K.box(W, u0, u1, tf, tf+0.06, ym-0.04, ym+0.04, fr, { front:1 }); }
    }
    // side-return window on a u-plane: side=+1 → u=L (east), side=-1 → u=0
    // (west). Graded pane proud of the wall + a slim bronze frame cross.
    function sideWindow(side, t0, t1, y0, y1, warm) {
        const base = (side > 0) ? L : 0;
        const ug = base + side * 0.03, uf = base + side * 0.13;
        const a = W(ug,t0,y0), b = W(ug,t1,y0), c = W(ug,t1,y1), d = W(ug,t0,y1);
        K.v(K.gla,a,sill); K.v(K.gla,b,sill); K.v(K.gla,c,sky); K.v(K.gla,a,sill); K.v(K.gla,c,sky); K.v(K.gla,d,sky);
        K.quad(K.opa, W(uf,t0,y0), W(uf,t1,y0), W(uf,t1,y0+0.12), W(uf,t0,y0+0.12), frameC);
        K.quad(K.opa, W(uf,t0,y1-0.12), W(uf,t1,y1-0.12), W(uf,t1,y1), W(uf,t0,y1), frameC);
        const tm = (t0+t1)/2;
        K.quad(K.opa, W(uf,tm-0.05,y0), W(uf,tm+0.05,y0), W(uf,tm+0.05,y1), W(uf,tm-0.05,y1), frameC);
        // stone sill + slim lintel band, in the storey tone
        const tone = warm ? tanHi : creamHi, uS = base + side * 0.16;
        K.quad(K.opa, W(uS,t0-0.15,y0-0.28), W(uS,t1+0.15,y0-0.28), W(uS,t1+0.15,y0), W(uS,t0-0.15,y0), tone);
        K.quad(K.opa, W(uS,t0-0.18,y1), W(uS,t1+0.18,y1), W(uS,t1+0.18,y1+0.18), W(uS,t0-0.18,y1+0.18), tone);
    }
    // flat pilaster strip on the front plane, with base + cap, plus a recessed
    // shadow reveal on either side
    function pilaster(u0, u1, y0, y1, isEnd) {
        K.box(W, u0, u1, -0.34, 0.02, y0, y1, isEnd?creamHi:cream, { front:1, left:1, right:1 });
        K.box(W, u0-0.12, u1+0.12, -0.42, 0.02, y1-0.4, y1, creamHi, { front:1, left:1, right:1, top:1, bottom:1 }); // cap
        K.box(W, u0-0.12, u1+0.12, -0.42, 0.02, y0, y0+0.35, creamHi, { front:1, left:1, right:1, bottom:1 });        // base
    }
    // a Greek-key / meander relief band between y0..y1 across u0..u1
    function meander(u0, u1, y0, y1, cRail, cShad) {
        const t = -0.16, h = y1 - y0;
        K.box(W, u0, u1, t+0.05, 0.02, y0, y1, cRail, { front:1, top:1, bottom:1 });   // proud ground band
        const yb = y0 + h*0.18, yt = y1 - h*0.18, unit = 1.35, bar = 0.15;
        for (let u = u0 + 0.25; u < u1 - unit; u += unit) {
            K.box(W, u, u+bar, t, 0.02, yb, yt, cShad, { front:1 });                    // riser
            K.box(W, u, u+unit*0.62, t, 0.02, yt-bar, yt, cShad, { front:1 });          // top run
            K.box(W, u+unit*0.62-bar, u+unit*0.62, t, 0.02, (yb+yt)/2, yt, cShad, { front:1 }); // inner return
            K.box(W, u+unit*0.34, u+unit*0.62, t, 0.02, yb, yb+bar, cShad, { front:1 }); // bottom hook
        }
    }
}
