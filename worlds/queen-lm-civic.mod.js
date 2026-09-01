//
//  queen-lm-civic.mod.js — THE CIVIC (Civic Theatre), Queen & Wellesley Sts.
//  1929 atmospheric cinema, Greco / Art-Deco. Warm sand plaster, a tall square
//  corner TOWER (CIVIC THEATRE + clock + ziggurat cap), long facades of tall
//  narrow recessed bays with pierced Deco grilles, a figure frieze + dentil
//  cornice, and a big curved cantilevered CIVIC marquee over the corner entry.
//
//  15 features read from the reference photo:
//   1. Warm sand / buff PLASTER, flat and smooth (not stone), weathered muted.
//   2. Tall square CORNER TOWER at the Queen/Wellesley corner, rising well above
//      the ~24 m body to ~34 m.
//   3. "CIVIC THEATRE" inscribed in two lines on the tower's upper face.
//   4. Square-ish CLOCK face high on the tower (dark numerals on pale ground).
//   5. Deco horizontal BANDING near the tower top + a row of small square studs.
//   6. Stepped ziggurat / finial CAP with four small corner PINNACLES + a mast.
//   7. Long facades divided by flat PILASTER STRIPS into tall narrow bays.
//   8. Each bay a deep recessed panel filled with a dark pierced GEOMETRIC GRILLE.
//   9. Ornamented FRIEZE of figures/animals as a band near the top of the walls.
//  10. Moulded DENTIL cornice running along both street facades.
//  11. Low solid PARAPET above the cornice, corner blocks / pinnacles.
//  12. Big curved cantilevered MARQUEE / verandah wrapping the corner entrance.
//  13. "CIVIC" in lights on the marquee fascia; hanging light bulbs on its edge.
//  14. Glazed SHOPFRONTS at street level under the verandah (dark glass).
//  15. Vertical show BANNERS (red) hung on the tower and the facades.
//

import { makeKit } from './queen-kit.mod.js';

export const ID = 'w23906749';
export const RING = '-40,261 -35,247 -35,246 -26,220 -28,217 -29,214 -55,205 -68,200 -72,202 -73,207 -74,209 -74,210 -75,212 -75,214 -76,216 -77,220 -86,217 -88,217 -94,231 -94,233 -87,248 -85,253 -84,255 -84,255 -81,262 -65,255 -63,255 -62,256 -61,254 -40,261';

export function build(world) {
    const K = makeKit(world);
    const { L, D, W } = K.frame(RING, 100);   // west = Queen St frontage
    const col = K.col, box = K.box, v = K.v, gla = K.gla;

    // ---- palette (warm sand plaster, weathered) ----------------------------
    const plaster = col('#e8dfc9'), plHi = col('#f4eddc'), plSh = col('#d5c8a8'), plDp = col('#bdb08e');
    const grille = col('#5a4e3d'), grilleHi = col('#8a7a60');
    const granite = col('#726c62');
    const maroon = col('#5b3541'), maroonHi = col('#744452'), maroonUnder = col('#39222a');
    const lead = col('#9a9488');   // weathered membrane/lead — canopy TOP surfaces (seen from above)
    const gold = col('#caa64f'), goldHi = col('#e0c877');
    const cream = col('#e9dfc7');
    const skyC = col('#9fb7c6'), sillC = col('#1d2226'), glassDk = col('#20262b');
    const clockPale = col('#e7e0cd'), clockDk = col('#221f18');
    const red = col('#b23028'), redHi = col('#c8433a');

    // ---- storey heights ----------------------------------------------------
    const Y_PLINTH = 1.1, Y_GROUND = 6.0, Y_BAYBASE = 6.8, Y_BAYTOP = 18.2,
          Y_FR1 = 19.7, Y_CORN0 = 19.7, Y_PARA = 23.9;

    // ---- corner tower footprint (square column at u≈0,t≈0 corner) ----------
    const TU0 = -0.7, TU1 = 8.1, TT0 = -0.7, TT1 = 8.1;
    const TUC = (TU0 + TU1) / 2, TTC = (TT0 + TT1) / 2, tw = TU1 - TU0;
    const TS = 30.0;                       // top of tower shaft
    const tFaceW = TT0, tFaceS = TU0;      // west face plane (t) / south face plane (u)

    // ======================================================================
    //  SOLID MASS  (bounding block; only outer faces drawn)
    // ======================================================================
    box(W, 0, L, 0, D, 0, Y_FR1, plaster, { front: 1, back: 1, left: 1, right: 1, top: 1 });
    box(W, 0, L, 0, D, Y_FR1, Y_FR1 + 0.3, plSh, { top: 1 });   // flat roof cap
    // raised auditorium / stage-house mass on the roof (theatre flytower).
    // Kept LOW and set well back so it stays below the parapet and does not
    // compete with the slender corner tower from the street.
    box(W, L * 0.30, L * 0.76, D * 0.42, D * 0.90, Y_FR1, 22.6, plSh, { front: 1, back: 1, left: 1, right: 1, top: 1 });
    box(W, L * 0.32, L * 0.74, D * 0.44, D * 0.88, 22.6, 23.1, plDp, { top: 1, front: 1, back: 1, left: 1, right: 1 });

    // granite plinth wrapping the two street faces
    box(W, -0.3, L + 0.3, -0.35, 0.4, 0, Y_PLINTH, granite, { front: 1, left: 1, right: 1, top: 1 });
    box(W, -0.35, 0.4, -0.3, D + 0.3, 0, Y_PLINTH, granite, { front: 1, back: 1, left: 1, top: 1 });

    // ======================================================================
    //  FACADE BAY GENERATOR  (P maps along-coord a, recess b (into +), y)
    // ======================================================================
    function facadeBays(P, s0, s1) {
        const span = s1 - s0;
        const NB = Math.max(4, Math.round(span / 4.4));
        const bw = span / NB;
        // ground floor: Melbourne walk-up shopfronts in tenancy-width bays
        const sfSigns = ['#7a2f2f', '#2f4655', '#59492c', '#3d5540', '#6a2f4a'];
        const nsf = Math.max(2, Math.round(span / 6.5)), sfw = span / nsf;
        for (let i = 0; i < nsf; i++) {
            K.shopfront(P, s0 + i * sfw + 0.25, s0 + (i + 1) * sfw - 0.25, Y_PLINTH, Y_GROUND,
                { sign: sfSigns[i % sfSigns.length], mull: '#2c2d30', sky: '#8fa2b4', sill: '#1b1f24', fascia: 0.8 });
        }
        // tall grille bays with pilaster strips
        for (let i = 0; i <= NB; i++) {   // pilaster strips (one more than bays)
            const pu = s0 + i * bw;
            box(P, pu - 0.4, pu + 0.4, -0.28, 0.12, Y_GROUND, Y_BAYTOP, plHi, { front: 1, left: 1, right: 1 });
            box(P, pu - 0.5, pu + 0.5, -0.34, 0.12, Y_BAYTOP - 0.35, Y_BAYTOP, plSh, { front: 1, top: 1, bottom: 1 }); // capital
        }
        for (let i = 0; i < NB; i++) {
            const gp0 = s0 + i * bw + 0.55, gp1 = s0 + (i + 1) * bw - 0.55;
            // SHALLOW reveal so each bay reads as a flush pierced screen, not a
            // deep tube (a deep recess shows hard dark diagonal interior walls
            // at grazing angles). Grille back sits just behind the wall face.
            const rd = 0.18;
            box(P, gp0, gp1, 0.0, rd, Y_BAYBASE, Y_BAYTOP, plSh, { left: 1, right: 1, top: 1, bottom: 1 });
            box(P, gp0, gp1, rd, rd + 0.04, Y_BAYBASE, Y_BAYTOP, grille, { front: 1 });
            // pierced grille lattice: vertical + horizontal bars just proud of the screen
            for (let b = 1; b < 4; b++) {
                const bu = gp0 + b * ((gp1 - gp0) / 4);
                box(P, bu - 0.05, bu + 0.05, rd - 0.08, rd - 0.02, Y_BAYBASE, Y_BAYTOP, grilleHi, { front: 1 });
            }
            const nh = 7;
            for (let h = 1; h < nh; h++) {
                const hy = Y_BAYBASE + h * ((Y_BAYTOP - Y_BAYBASE) / nh);
                box(P, gp0, gp1, rd - 0.08, rd - 0.02, hy - 0.045, hy + 0.045, grilleHi, { front: 1 });
            }
            // little Deco chevron finial at head of each bay
            box(P, gp0 + 0.2, gp1 - 0.2, -0.05, 0.18, Y_BAYTOP - 0.9, Y_BAYTOP - 0.55, plHi, { front: 1, top: 1, bottom: 1 });
        }
        // ---- figure frieze band (small raised blocks) ----
        box(P, s0 - 0.2, s1 + 0.2, -0.4, 0.1, Y_BAYTOP, Y_FR1, plHi, { front: 1, top: 1, bottom: 1 });
        const nf = Math.max(3, Math.round(span / 1.5));
        for (let i = 0; i < nf; i++) {
            const fu = s0 + 0.4 + i * ((span - 0.8) / nf);
            box(P, fu, fu + 0.55, -0.45, -0.02, Y_BAYTOP + 0.25, Y_FR1 - 0.2, plDp, { front: 1, left: 1, right: 1, top: 1 });
        }
        // ---- cornice (courses + dentils) + solid parapet ----
        const yc = K.cornice(P, s0 - 0.4, s1 + 0.4, -0.2, Y_CORN0, 2, plHi, plSh);
        box(P, s0 - 0.3, s1 + 0.3, -0.42, -0.02, yc, Y_PARA, plaster, { front: 1, top: 1, left: 1, right: 1 });
        // recessed parapet panels
        for (let i = 0; i < NB; i++) {
            const u0 = s0 + i * bw + 0.7, u1 = s0 + (i + 1) * bw - 0.7;
            box(P, u0, u1, -0.44, -0.4, yc + 0.3, Y_PARA - 0.3, plSh, { front: 1 });
        }
        // small stepped Deco finial blocks over each pier (skyline accents)
        for (let i = 0; i <= NB; i++) {
            const pu = s0 + i * bw;
            box(P, pu - 0.42, pu + 0.42, -0.52, 0.02, Y_PARA, Y_PARA + 0.7, plHi, { front: 1, left: 1, right: 1, top: 1 });
            box(P, pu - 0.26, pu + 0.26, -0.52, 0.02, Y_PARA + 0.7, Y_PARA + 1.15, plSh, { front: 1, left: 1, right: 1, top: 1 });
        }
    }

    // front (Queen St, t=0 plane): from tower to far end
    const Wf = (a, b, y) => W(a, b, y);
    facadeBays(Wf, TU1 + 0.3, L);
    // left return (Wellesley St, u=0 plane): along +t, recess into +u
    const Wr = (a, b, y) => W(b, a, y);
    facadeBays(Wr, TT1 + 0.3, Math.min(D, 42));

    // ======================================================================
    //  CORNER TOWER
    // ======================================================================
    // shaft
    box(W, TU0, TU1, TT0, TT1, 0, TS, plaster, { front: 1, back: 1, left: 1, right: 1, top: 0 });
    // subtle corner quoin strips (slightly proud lighter edges) on the two show faces
    box(W, TU0 - 0.02, TU0 + 0.5, TT0 - 0.15, TT1, 0, TS, plHi, { front: 1, left: 1 });   // left edge (south face)
    box(W, TU1 - 0.5, TU1 + 0.02, TT0 - 0.15, TT1, 0, TS, plHi, { front: 1, right: 1 });
    box(W, TU0 - 0.15, TU1, TT0 - 0.02, TT0 + 0.5, 0, TS, plHi, { front: 1, left: 1 });   // west face left strip

    // ---- decorate the WEST face (plane t = TT0) ----
    // "CIVIC THEATRE" — dark serif lettering directly on the bare plaster.
    function letters(P, s0, s1, y0, y1, n, recess) {
        const gap = (s1 - s0) / n;
        for (let i = 0; i < n; i++) {
            const lw = gap * (0.42 + 0.16 * ((i * 7) % 3) / 2);   // slight width variety
            const lx = s0 + i * gap + (gap - lw) / 2;
            box(P, lx, lx + lw, recess - 0.06, recess, y0, y1, clockDk, { front: 1 });
        }
    }
    const WW = (a, b, y) => W(a, b, y);                 // west face: recess into +t
    letters(WW, TU0 + 1.4, TU1 - 1.4, 17.1, 18.1, 5, TT0);   // CIVIC
    letters(WW, TU0 + 1.0, TU1 - 1.0, 15.5, 16.3, 7, TT0);   // THEATRE
    // reeded / fluted Deco panel just below the lettering
    for (let i = 0; i < 9; i++) {
        const rx = TU0 + 1.4 + i * ((tw - 2.8) / 9);
        box(W, rx, rx + 0.18, TT0 - 0.12, TT0, 12.6, 14.9, plHi, { front: 1, left: 1, right: 1 });
    }
    box(W, TU0 + 1.2, TU1 - 1.2, TT0 - 0.1, TT0, 14.9, 15.2, plSh, { front: 1, top: 1, bottom: 1 });
    // scrolled banding line below the clock
    box(W, TU0 - 0.1, TU1 + 0.1, TT0 - 0.14, TT0, 20.4, 20.9, plHi, { front: 1, top: 1, bottom: 1 });
    for (let i = 0; i < 12; i++) {
        const sx = TU0 + 0.6 + i * ((tw - 1.2) / 12);
        box(W, sx, sx + 0.22, TT0 - 0.16, TT0 - 0.12, 20.45, 20.85, plDp, { front: 1 });
    }
    // clock face high on the tower
    const clkY = 23.2, clkR = 1.55;
    K.disc(W, TUC, clkY, TT0 - 0.06, clkR + 0.18, clockDk, 20);
    K.disc(W, TUC, clkY, TT0 - 0.1, clkR, clockPale, 20);
    box(W, TUC - 0.06, TUC + 0.06, TT0 - 0.14, TT0 - 0.1, clkY, clkY + clkR * 0.72, clockDk, { front: 1 }); // minute hand
    box(W, TUC - 0.05, TUC + clkR * 0.5, TT0 - 0.14, TT0 - 0.1, clkY - 0.05, clkY + 0.05, clockDk, { front: 1 }); // hour hand
    // mirror clock + name onto the SOUTH face (plane u = TU0)
    K.disc((a, b, y) => W(b, a, y), TTC, clkY, TU0 - 0.06, clkR + 0.18, clockDk, 20);
    K.disc((a, b, y) => W(b, a, y), TTC, clkY, TU0 - 0.1, clkR, clockPale, 20);
    const SS = (a, b, y) => W(b, a, y);                 // south face: recess into +u
    letters(SS, TT0 + 1.4, TT1 - 1.4, 17.1, 18.1, 5, TU0);   // CIVIC (south)
    letters(SS, TT0 + 1.0, TT1 - 1.0, 15.5, 16.3, 7, TU0);   // THEATRE (south)

    // ---- pierced Deco lattice panel high on each show face + flanking flutes
    function towerGrille(P, s0, s1, faceB) {
        box(P, s0, s1, faceB, faceB + 0.5, 24.6, 26.4, grille, { front: 1, left: 1, right: 1, top: 1, bottom: 1 });
        box(P, s0, s1, faceB - 0.05, faceB, 24.6, 26.4, grille, { front: 1 });
        for (let i = 1; i < 5; i++) { const gx = s0 + i * ((s1 - s0) / 5); box(P, gx - 0.05, gx + 0.05, faceB - 0.08, faceB - 0.02, 24.6, 26.4, grilleHi, { front: 1 }); }
        for (let j = 1; j < 3; j++) { const gy = 24.6 + j * (1.8 / 3); box(P, s0, s1, faceB - 0.08, faceB - 0.02, gy - 0.05, gy + 0.05, grilleHi, { front: 1 }); }
    }
    towerGrille(WW, TU0 + 2.2, TU1 - 2.2, TT0);
    towerGrille(SS, TT0 + 2.2, TT1 - 2.2, TU0);
    for (const fx of [TU0 + 0.6, TU1 - 1.0]) box(W, fx, fx + 0.4, TT0 - 0.12, TT0, 12.6, 26.4, plHi, { front: 1, left: 1, right: 1 });   // west flanking flutes
    for (const ft of [TT0 + 0.6, TT1 - 1.0]) box(W, TU0 - 0.12, TU0, ft, ft + 0.4, 12.6, 26.4, plHi, { left: 1, front: 1, back: 1 });   // south flanking flutes

    // ---- Deco banding + stud row near the top of the shaft ----
    for (const by of [26.6, 27.4]) {
        box(W, TU0 - 0.15, TU1 + 0.15, TT0 - 0.2, TT1 + 0.2, by, by + 0.28, plHi, { front: 1, back: 1, left: 1, right: 1, top: 1, bottom: 1 });
    }
    const nstud = 7;
    for (let i = 0; i < nstud; i++) {
        const su = TU0 + 0.8 + i * ((tw - 1.6) / (nstud - 1));
        box(W, su - 0.18, su + 0.18, TT0 - 0.22, TT0 - 0.05, 28.0, 28.55, clockDk, { front: 1 });
        const st = TT0 + 0.8 + i * ((tw - 1.6) / (nstud - 1));
        box(W, TU0 - 0.22, TU0 - 0.05, st - 0.18, st + 0.18, 28.0, 28.55, clockDk, { left: 1 });
    }

    // ---- stepped ziggurat cap + corner pinnacles + finial mast ----
    const capSteps = [[0.0, 29.0, 30.2], [0.6, 30.2, 31.4], [1.2, 31.4, 32.6], [1.8, 32.6, 33.8]];
    for (const [ins, y0, y1] of capSteps) {
        box(W, TU0 + ins, TU1 - ins, TT0 + ins, TT1 - ins, y0, y1, plHi, { front: 1, back: 1, left: 1, right: 1, top: 1 });
    }
    // corner pinnacles rising from the first setback
    for (const [pu, pt] of [[TU0, TT0], [TU1 - 0.9, TT0], [TU0, TT1 - 0.9], [TU1 - 0.9, TT1 - 0.9]]) {
        box(W, pu, pu + 0.9, pt, pt + 0.9, 29.0, 31.4, plSh, { front: 1, back: 1, left: 1, right: 1, top: 1 });
        box(W, pu + 0.1, pu + 0.8, pt + 0.1, pt + 0.8, 31.4, 32.1, plHi, { front: 1, back: 1, left: 1, right: 1, top: 1 });
    }
    // finial mast + star
    K.pyramid(W, TU0 + 1.8, TU1 - 1.8, TT0 + 1.8, TT1 - 1.8, 33.8, 35.0, plSh);
    box(W, TUC - 0.09, TUC + 0.09, TTC - 0.09, TTC + 0.09, 35.0, 37.0, col('#8a7a55'), { front: 1, back: 1, left: 1, right: 1, top: 1 });
    box(W, TUC - 0.5, TUC + 0.5, TTC - 0.06, TTC + 0.06, 36.2, 37.2, goldHi, { front: 1, back: 1 });
    box(W, TUC - 0.06, TUC + 0.06, TTC - 0.5, TTC + 0.5, 36.2, 37.2, goldHi, { left: 1, right: 1 });

    // ======================================================================
    //  BANNERS (vertical show banners hung on tower + facades)
    // ======================================================================
    function banner(P, a, yTop, len, wdt) {
        box(P, a - wdt / 2, a + wdt / 2, -0.75, -0.6, yTop - len, yTop, red, { front: 1, left: 1, right: 1 });
        box(P, a - wdt / 2, a + wdt / 2, -0.76, -0.6, yTop - 0.9, yTop, redHi, { front: 1 });
    }
    banner(W, TUC, 13.6, 5.6, 2.2);                 // big tower banner
    banner(Wf, TU1 + 6, 15.5, 5.0, 1.5);            // front facade banners
    banner(Wf, L - 8, 15.5, 5.0, 1.5);
    banner(Wr, TT1 + 6, 15.5, 5.0, 1.5);            // return facade banner

    // ======================================================================
    //  CURVED CANTILEVERED MARQUEE / VERANDAH over the corner entrance
    // ======================================================================
    const mY0 = 4.9, mY1 = 6.4, proj = 4.0;
    // front straight run + return straight run (as slabs projecting outward)
    function marqueeRun(P, s0, s1) {
        box(P, s0, s1, -proj, 0.1, mY1 - 0.15, mY1, lead, { front: 1, top: 1, left: 1, right: 1 });   // top slab (light membrane)
        box(P, s0, s1, -proj, 0.1, mY0, mY0 + 0.15, maroonUnder, { front: 1, bottom: 1, left: 1, right: 1 }); // soffit
        box(P, s0, s1, -proj - 0.05, -proj + 0.15, mY0, mY1, maroonHi, { front: 1, left: 1, right: 1 });      // fascia
        box(P, s0, s1, -proj - 0.06, -proj - 0.02, mY0 + 0.35, mY1 - 0.35, cream, { front: 1 });             // sign band
        // hanging bulbs along the leading edge
        const nb = Math.max(3, Math.round((s1 - s0) / 1.1));
        for (let i = 0; i < nb; i++) {
            const bu = s0 + 0.4 + i * ((s1 - s0 - 0.8) / nb);
            box(P, bu - 0.1, bu + 0.1, -proj - 0.02, -proj + 0.08, mY0 - 0.28, mY0, goldHi, { front: 1, bottom: 1, left: 1, right: 1 });
        }
    }
    marqueeRun(Wf, TU1 - 1.5, TU1 + 17);
    marqueeRun(Wr, TT1 - 1.5, TT1 + 15);
    // continuous cantilever verandah over the footpath on the runs beyond the
    // corner marquee (the Melbourne canopy grammar)
    K.verandah(Wf, TU1 + 17, L - 0.3, 5.3, 3.4, '#9a9488', '#d8cdb4');
    K.verandah(Wr, TT1 + 15, Math.min(D, 42), 5.3, 3.4, '#9a9488', '#d8cdb4');
    // dark plum fascia strip over the verandah leading edge (matches the marquee)
    for (const [P, a0, a1] of [[Wf, TU1 + 17, L - 0.3], [Wr, TT1 + 15, Math.min(D, 42)]]) {
        box(P, a0, a1, -3.42, -3.28, 4.7, 5.64, maroonHi, { front: 1, left: 1, right: 1 });
    }
    // chamfered corner infill of the marquee (wraps the corner)
    {
        const c0 = W(TU1 - 1.5, -proj, mY1), c1 = W(TU1 - 1.5, 0.1, mY1 - 0.1);
        const c2 = W(0.1, TT1 - 1.5, mY1 - 0.1), c3 = W(-proj, TT1 - 1.5, mY1);
        // top
        K.quad(K.opa, c0, c1, c2, c3, lead);
        // fascia strip across the chamfer
        const f0 = W(TU1 - 1.5, -proj, mY0), f3 = W(-proj, TT1 - 1.5, mY0);
        K.quad(K.opa, f0, W(TU1 - 1.5, -proj, mY1), W(-proj, TT1 - 1.5, mY1), f3, maroonHi);
        // "CIVIC" sign band on the corner fascia (cream) + gold letter ticks
        const s0 = W(TU1 - 1.5, -proj - 0.05, mY0 + 0.35), s1 = W(TU1 - 1.5, -proj - 0.05, mY1 - 0.35);
        const s2 = W(-proj - 0.05, TT1 - 1.5, mY1 - 0.35), s3 = W(-proj - 0.05, TT1 - 1.5, mY0 + 0.35);
        K.quad(K.opa, s0, s1, s2, s3, cream);
    }
    // entrance doors under the corner (dark glazed)
    {
        const a = W(TU1 + 2, -proj + 0.3, Y_PLINTH), b = W(TU1 + 7, -proj + 0.3, Y_PLINTH);
        const c = W(TU1 + 7, -proj + 0.3, mY0 - 0.2), d = W(TU1 + 2, -proj + 0.3, mY0 - 0.2);
        v(gla, a, sillC); v(gla, b, sillC); v(gla, c, skyC); v(gla, a, sillC); v(gla, c, skyC); v(gla, d, skyC);
    }

    // ======================================================================
    //  VERTICAL "CIVIC" BLADE SIGN (projecting fin on the Queen St frontage)
    // ======================================================================
    {
        const bx = TU1 + 3.2;            // just past the tower on the front facade
        const bY0 = 6.8, bY1 = 17.0, w = 1.9, prj = 2.4;   // projects out toward street
        // strong-red blade plate (both faces + edges), lit red front strip
        box(W, bx - w / 2, bx + w / 2, -prj, 0.05, bY0, bY1, red, { front: 1, back: 1, left: 1, right: 1, top: 1, bottom: 1 });
        box(W, bx - w / 2 + 0.06, bx + w / 2 - 0.06, -prj - 0.03, -prj + 0.01, bY0 + 0.2, bY1 - 0.2, redHi, { left: 1, right: 1 }); // lit outer edge (leading edge faces street)
        // "CIVIC" — cream letter ticks stacked vertically on the outer (leading) edge
        for (let i = 0; i < 5; i++) {
            const ly = bY1 - 1.4 - i * ((bY1 - bY0 - 2.0) / 5);
            box(W, bx - 0.45, bx + 0.45, -prj - 0.05, -prj - 0.01, ly - 0.55, ly + 0.55, cream, { left: 1, right: 1 });
        }
        // bracket arms tying the blade back to the wall
        box(W, bx - 0.12, bx + 0.12, -prj, 0.05, bY0 - 0.4, bY0, plSh, { front: 1, left: 1, right: 1 });
    }

    // ======================================================================
    //  AGING — downpipes on the returns + a rooftop plant box
    // ======================================================================
    K.downpipe(Wf, TU1 + 0.9, Y_PLINTH, Y_CORN0, '#39352e');
    K.downpipe(Wf, L - 1.4, Y_PLINTH, Y_CORN0, '#39352e');
    K.downpipe(Wr, TT1 + 0.9, Y_PLINTH, Y_CORN0, '#39352e');
    K.downpipe(Wr, Math.min(D, 41.5), Y_PLINTH, Y_CORN0, '#39352e');
    K.acbox(W, L * 0.40, L * 0.50, D * 0.52, D * 0.62, 23.1, 24.0, '#8a8c8f');
    K.acbox(W, L * 0.55, L * 0.62, D * 0.54, D * 0.61, 23.1, 23.7, '#97999c');

    const tris = K.finish('civic', { roughness: 0.9, glassRough: 0.18, metalness: 0.03 });
}
