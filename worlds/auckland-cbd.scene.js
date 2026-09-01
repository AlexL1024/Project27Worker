//
//  auckland-cbd.scene.js
//
//  The real street network of central Auckland — nothing but the roads, the
//  hills they climb, the harbour they run down to, and the names painted on
//  the tarmac like a map you can stand on. Queen Street runs up its valley
//  from the ferry wharves to the Karangahape Road ridge sixty metres up; the
//  motorway junction wraps the grid in its knot of ramps at the southern edge.
//
//  Streets traced from OpenStreetMap (© OpenStreetMap contributors, ODbL);
//  road widths follow each street's tagged lane count, and the painted lane
//  dividers mark the actual lanes. Terrain sampled from the LINZ NZ 8 m DEM
//  via opentopodata.org. Coordinates are metres from a point mid-town:
//  x east, z south, y up; sea level is y = 0.
//

import { buildQueenBuildings } from './queen-buildings.mod.js';

// kind|name|lanes|x,z x,z ...   (one carriageway per line, ints, metres)
const ROADS = `secondary|Grafton Bridge|2|-81,1047 -69,1052
residential|Cross Street||-317,1062 -467,1056
secondary|Customs Street East|6|503,-384 464,-388 452,-392
living_street|Fort Street|1|487,-355 472,-318 369,-305
tertiary|Shortland Street|2|529,-209 472,-228 454,-227 428,-220 398,-220 321,-230
secondary|Waterloo Quadrant|4|541,-33 528,-47 504,-65
tertiary|Victoria Street East|2|195,43 144,25
residential|Lower Albert Street|4|107,-617 116,-646
residential|Wyndham Street|2|-302,-330 -228,-302
primary|Hobson Street|5|-116,-486 -159,-372
living_street|Darby Street||36,72 -32,47
living_street|Elliott Street||-76,163 -12,-7
secondary_link||2|164,332 144,323 135,324 127,330 119,345
secondary|Anzac Avenue|4|800,-44 782,-81 697,-179 684,-202
residential|Saint Martins Lane||68,949 68,943 41,918
residential|Whitaker Place||134,810 206,875 211,884 186,945 158,964
residential|City Road||9,913 -14,903 -43,897 -132,867
residential|Saint Paul Street||116,533 295,558
living_street|Alfred Street|1|359,256 474,299
residential|Parliament Street|1|734,12 645,40
residential|Short Street|2|601,-158 684,-202
residential|Eden Crescent||734,12 717,-45 711,-53 645,-108 614,-141 576,-192 562,-200 529,-209
residential|Emily Place||562,-275 578,-214 579,-189
secondary|Beach Road|6|567,-382 635,-362
secondary|Halsey Street|5|-721,-137 -719,-169
secondary|Lower Hobson Street|2|-32,-715 -37,-700
motorway_link||2|420,788 330,957 273,1049
motorway_link||1|428,818 292,1031 273,1049
motorway_link||1|136,1086 174,1024 357,749
motorway_link||1|531,559 517,570 514,582 518,595 528,604 538,606 548,604 606,569 635,555
motorway_link||1|190,1087 227,1003 296,870 361,761
motorway_link||1|-81,1047 -80,1063
secondary|Pitt Street|5|-484,966 -494,890
residential|East Street|2|-573,1043 -602,966
residential|Galatos Street||-573,1043 -638,1068
tertiary|Vincent Street|3|-498,655 -415,496
tertiary|Greys Avenue|2|-481,760 -286,566
secondary|Cook Street|6|-320,331 -351,316 -410,296
residential|Marmion Street||-137,607 -63,631
residential|Waverley Street|1|-38,684 -140,647
residential|Turner Street||-33,756 -169,706
residential|White Street||-27,743 -28,671 -50,627
residential|Liverpool Street||-187,949 -177,919 -154,892
residential|Scotia Place||-299,781 -324,848
residential|Mount Street|2|105,652 162,625 235,636
residential|Saint James Street||-603,775 -610,759
residential|Beresford Square||-647,821 -601,849
residential|Day Street||-601,849 -612,861 -688,891
secondary|Kitchener Street|2|156,178 194,69 199,62 200,45
pedestrian|Vulcan Lane||130,-221 195,-200
residential|Durham Street West||90,-86 13,-114
residential|Durham Lane||29,-157 12,-111
pedestrian|Freyberg Place||192,-149 226,-140
residential|Courthouse Lane||239,-95 270,-51
residential|Fields Lane|2|312,-147 321,-230
residential|Bacon's Lane||312,-147 308,-95 310,-74
residential|Chancery Street|1|291,-145 259,-142
living_street|Jean Batten Place||212,-287 223,-327 228,-333
living_street|Fort Lane||228,-333 232,-340 256,-438
residential|Gore Street|2|359,-303 359,-315 379,-376
residential|Tyler Street|1|425,-522 563,-478
residential|Wolfe Street|1|-116,-486 -54,-464
residential|Swanson Street|2|-151,-392 -108,-377
residential|Bradnor Lane|1|-252,-396 -248,-392 -183,-367
residential|Customs Street West|2|-411,-444 -401,-395
residential|Market Place||-282,-472 -274,-487 -241,-593 -232,-613 -234,-624
residential|Pakenham Street East|1|-282,-472 -236,-462
residential|Viaduct Harbour Avenue|3|-687,-457 -647,-443
residential|Dock Street||-646,-100 -665,-204
residential|Hardinge Street||-557,-240 -561,-229 -544,-148
residential|Graham Street||-467,-136 -460,-230 -470,-254
residential|Kingston Street||-220,-200 -166,-182
living_street|Federal Street||-84,-337 -77,-345 -69,-364
tertiary|Britomart Place|3|535,-421 546,-435
secondary|Wellington Street|2|-761,432 -756,431
residential|Pakenham Street West||-823,-650 -642,-590
tertiary|Jellicoe Street|2|-557,-858 -758,-927
residential|Nicholas Street||-473,416 -525,387 -506,344 -557,324
residential|Morton Street||-719,183 -698,119 -690,114 -681,113 -653,118
secondary_link||2|-736,-53 -753,-75
residential|Vernon Street||-762,-57 -745,22
residential|Adelaide Street||-816,-46 -793,52
secondary|Sam Wrigley Street|1|-716,193 -726,190 -741,191 -770,216
secondary|Alten Road|3|777,215 784,232 791,264 786,315 788,338
secondary|Wellesley Street East|1|256,431 235,405
secondary|Wellesley Street West|2|-724,-84 -724,-62 -720,-55 -708,-46
unclassified|Wakefield Street|1|-22,388 -50,354
residential|Airedale Street||1,588 -1,595 84,777
residential|Emily Place|1|503,-384 502,-370 567,-347 574,-342 578,-326 573,-311
motorway_link||1|452,864 453,830 450,820 444,816 428,818
residential|Scotia Place|2|-268,821 -225,836
secondary|Hopetoun Street|4|-570,739 -519,683
living_street|Federal Street||-242,124 -238,113
tertiary|Daldy Street||-797,-809 -821,-735
tertiary|Daldy Street|2|-758,-927 -797,-809
secondary|Sam Wrigley Street|1|-782,161 -768,175 -762,188 -762,197 -770,216
secondary|Karangahape Road|4|-785,1037 -723,1013
residential|Lower Domain Drive|1|671,596 702,614
living_street|Gore Street Lane||383,-364 479,-333
pedestrian|Swanson Street||134,-291 83,-309
residential|Mills Lane||57,-248 79,-312
residential|Mills Lane||110,-407 103,-413 46,-431
pedestrian|Exchange Lane||99,-370 107,-368 150,-352
living_street|O'Connell Street|1|231,-149 249,-241
residential|Wyndham Street|4|-189,-288 -151,-274
residential|Federal Street|1|-54,-408 -42,-442
residential|Gorst Lane||-349,-268 -336,-263
residential|Durham Street West||-4,-120 -26,-128
residential|Lorne Street|1|129,61 75,214 72,225 74,233
living_street|Lorne Street||33,339 64,247
residential|Durham Lane||-28,-82 -2,-73
residential|Durham Lane||-34,-179 -11,-171 54,-147
residential|Bowen Lane||368,41 399,-40
trunk_link|Stanley Street|1|778,461 754,495 703,539 692,553
pedestrian|Bledisloe Lane||-88,185 -130,307
secondary|Lower Hobson Street|2|-118,-531 -104,-549
secondary|Lower Hobson Street|2|-43,-688 -50,-669
residential|Market Lane||-226,-468 -181,-607
residential|High Street|1|187,-151 153,-1
residential|Customs Street West|1|-71,-579 -80,-577 -92,-580
residential|Pakenham Street East|2|-282,-472 -380,-505
secondary|Customs Street East|6|261,-456 247,-461
residential|Scene Lane||675,-416 666,-422 587,-446
primary|Quay Street|4|831,-432 818,-438
residential|West Terrace||-698,1071 -722,1012
secondary_link|Sam Wrigley Street|2|-817,254 -829,258
residential|Poynton Terrace||-497,862 -428,853 -423,859 -417,895 -410,905
motorway_link||2|-524,635 -540,599 -546,593 -561,591 -575,594
primary|Quay Street|2|816,-448 837,-440
motorway_link||1|136,1086 269,905
secondary|Wellesley Street East|2|460,748 455,727
secondary|Wellesley Street East|2|466,793 465,783
secondary|Symonds Street|4|357,527 361,521
secondary|Grafton Road|1|520,322 536,334 544,360
residential|Kāri Street|2|499,992 469,1000 443,1002 405,987
residential|Moehau Street||322,1025 371,1062
residential|Tennis Lane||738,521 700,562 684,603
secondary|Grafton Road|2|456,852 462,827
secondary|Grafton Road|2|565,637 559,579
secondary|Grafton Road|2|570,721 523,767
residential|Rutland Street||112,382 102,346 99,342 91,340
residential|Rutland Street||91,340 46,347
pedestrian|Wynyard Street||592,396 569,421 556,422 549,423
residential|Princes Wharf|2|-15,-748 7,-763 23,-791 104,-1043
secondary|Customs Street West|3|-118,-531 -71,-553
secondary|Customs Street West|2|-71,-579 -67,-574 -40,-560
tertiary|Princes Street|3|510,-155 494,-111
secondary|Hopetoun Street|2|-828,921 -731,889 -711,878 -674,850
secondary|Wellesley Street East|2|214,386 179,348
unclassified|Kitchener Street|2|200,45 213,17
secondary|Bowen Avenue|1|200,45 219,27
living_street|Federal Street||-304,279 -299,278 -295,270 -262,180
secondary|Quay Street|2|255,-627 173,-653
pedestrian|Queen Street||198,-495 231,-588 257,-621
pedestrian|Tyler Street||231,-588 265,-576
living_street|Galway Street|1|529,-423 453,-448
secondary_link||1|676,164 687,137 688,117
secondary|Lower Hobson Street|4|-106,-517 -112,-501
secondary|Stanley Street|2|613,678 603,688
secondary|Symonds Street|4|20,923 68,870
secondary|Symonds Street|4|572,269 676,164
unclassified|Princes Street|1|263,401 289,376
secondary|Mayoral Drive|5|-107,561 -64,546
tertiary|Queen Street|3|-123,565 -113,535
secondary|Karangahape Road|4|-723,1013 -690,1000
secondary|Karangahape Road|4|-394,983 -351,990 -322,990
tertiary|Queen Street|2|76,-24 105,-147
residential|Whitaker Place||143,870 168,841
residential|Whitaker Place||260,788 225,827 248,854 219,886 210,888
residential|Saint Martins Lane||54,1031 21,999
secondary|Beach Road|6|635,-362 668,-350 698,-332
secondary|Pitt Street|7|-519,683 -524,635
secondary|Mayoral Drive|6|-320,331 -295,358 -286,380
secondary_link||1|-253,270 -279,315 -286,350 -286,380
secondary|Quay Street|4|124,-668 56,-688
tertiary|Victoria Street West|2|-89,-59 -41,-42
primary|Hobson Street|4|-326,93 -365,208 -389,257
tertiary|Victoria Street West|3|-220,-102 -169,-86
primary_link||1|-524,516 -527,547 -525,585
primary|Hobson Street|5|-524,516 -547,555
secondary|Pitt Street|2|-547,555 -536,564 -525,585
tertiary|Queen Street|2|0,210 46,76
living_street|Viaduct Bascule Bridge||-228,-792 -247,-799
residential|Quay Street|2|-80,-729 -45,-719
unclassified|Princes Street|2|391,169 359,256
motorway_link||1|466,793 441,807 428,818
pedestrian|Warspite Street||285,-59 279,-69 273,-64 278,-56
pedestrian|||307,-127 311,-129
pedestrian|||304,-126 281,-115
pedestrian|Chancery Square||273,-95 257,-116
tertiary|Albert Street|4|-78,-90 -59,-141
residential|Market Lane||-197,-559 -134,-538 -125,-526
residential|Tinley Street|4|828,-484 816,-448
residential|Albert Street||-48,-135 -64,-94 -70,-89 -78,-90
secondary_link||1|-523,639 -513,654 -508,656 -496,651
secondary|Alten Road|3|792,347 827,379
motorway_link||1|748,475 807,389 810,374
secondary|Alten Road|1|822,386 810,374
motorway_link||2|-575,594 -637,651
motorway_link||1|-731,1079 -781,971 -790,927 -793,893
motorway_link||1|-697,789 -729,845 -746,883 -760,929
motorway_link||1|460,711 455,727
residential|Commerce Street|3|301,-428 293,-404
residential|Hobson Wharf||-117,-780 -118,-771 -130,-761
tertiary|Gaunt Street|3|-687,-457 -722,-468
secondary|Halsey Street|2|-680,-474 -668,-513
residential|Nelson Street||-628,522 -630,509 -622,468 -555,280
secondary|Wellesley Street West|5|-326,93 -286,108
secondary_link||1|-716,193 -719,183
motorway_link||1|-654,559 -683,512
secondary|Union Street|4|-580,539 -547,555
secondary|Pitt Street|3|-530,604 -539,582 -554,566
secondary_link||2|-715,457 -747,439
motorway_link||1|-758,1063 -785,1000
secondary_link||1|577,652 591,664 612,667
motorway|Northwestern Motorway|2|778,461 730,509 632,571
secondary|Symonds Street|6|-96,1076 -85,1055
secondary|Karangahape Road|4|-97,1041 -81,1047
secondary|Mayoral Drive|5|-176,563 -149,567
tertiary|Wakefield Street||123,804 109,804
secondary|Symonds Street|4|150,773 169,753
tertiary|Wakefield Street|1|110,773 115,797
tertiary|Queen Street|4|-37,313 -14,248
tertiary|Wakefield Street|1|115,687 131,706
secondary_link|Princes Street|1|289,376 269,405 267,412 270,422
secondary|Wellesley Street East|1|164,332 157,323
secondary|Wellesley Street East|3|471,739 475,783
secondary|Wellesley Street East|1|253,414 327,524
secondary_link||1|256,431 252,421 253,414
secondary|Wellesley Street East|3|441,679 460,711
secondary|Wellesley Street East|2|400,641 346,565
motorway_link||1|456,755 445,748 437,749
secondary_link|Wellesley Street East|1|308,476 335,518 346,526 357,527
motorway_link||1|437,749 396,803
secondary|Grafton Road|1|592,690 578,683
secondary|Grafton Road|2|476,790 475,807
secondary_link|Grafton Road|1|551,727 571,700 578,683
secondary|Grafton Road|2|577,652 587,672 597,684
secondary|Grafton Road|2|558,548 568,575
secondary_link|Grafton Road|1|523,767 515,777 492,791 475,807
secondary|Grafton Road|2|559,579 558,548
secondary_link||1|471,739 486,767 497,772
secondary|Grafton Road|1|475,783 497,772
secondary|Grafton Road|2|568,575 573,630
secondary|Grafton Road|2|573,630 577,652
secondary|Grafton Road|3|386,1038 371,1062
motorway_link||2|-729,701 -706,672 -676,626
motorway|Auckland Southern Motorway|2|-724,1079 -754,1009 -770,963 -783,892
motorway|Auckland Southern Motorway|3|-729,888 -738,917 -741,983 -731,1026 -706,1080
motorway|Auckland Northern Motorway|3|-787,452 -840,371
secondary_link||1|93,838 96,817 103,797
secondary|Pitt Street|2|-525,585 -524,635
tertiary|Queen Street|4|-8,232 0,210
secondary|Fanshawe Street|4|-19,-523 -72,-511
secondary|Quay Street|2|269,-622 255,-627
primary_link||1|821,-416 810,-409
secondary|Tangihua Street|2|818,-438 810,-409
secondary|Wellesley Street West|5|-162,152 -104,173
secondary|Wellesley Street East|2|124,276 233,393
secondary|Union Street|2|-633,533 -674,519 -698,494
pedestrian|Wynyard Crossing Bridge||-345,-834 -446,-867
pedestrian|North Wharf Promenade||-836,-997 -521,-894
pedestrian|||-674,-944 -677,-936
pedestrian|||-643,-933 -656,-893
pedestrian|||-599,-919 -612,-878
pedestrian|||-701,-953 -704,-945
secondary|Symonds Street|4|499,349 520,322
secondary|Grafton Road|1|544,360 550,439 548,454
secondary_link||1|465,-33 461,-54 456,-60
residential|Lower Domain Drive|2|700,616 686,611
secondary|Bowen Avenue|1|233,24 209,44 200,45
secondary|Bowen Avenue|2|233,24 301,-4 431,-51
residential|Wakefield Street|2|-22,388 29,495
unclassified|Wakefield Street||-50,354 -38,359
motorway|Auckland Southern Motorway|2|-834,359 -715,535
secondary|Mayoral Drive|5|-273,451 -256,489
unclassified|Princes Street|3|480,-71 465,-33
residential|Madden Street||-797,-809 -641,-758
tertiary|Jellicoe Street||-758,-927 -847,-956
secondary|Mayoral Drive|6|-238,517 -220,541 -204,552
secondary|Pitt Street|6|-510,761 -515,721
primary|Fanshawe Street|5|-825,-371 -718,-336
unclassified|Greys Avenue|2|-184,461 -171,446 -163,455
secondary|Victoria Street West|4|-671,-96 -467,-136
secondary|Karangahape Road|4|-809,1046 -785,1037
residential|Commerce Street|3|327,-488 315,-453
secondary|Quay Street|3|540,-533 480,-553
secondary|Grafton Road|2|523,767 476,790
secondary|Grafton Road|2|578,683 569,664
residential|Stanley Street|1|612,667 645,627 653,597 660,593 671,596
secondary|Grafton Road|2|475,807 466,836 456,852
secondary|Customs Street East|6|308,-440 261,-456
living_street|Fort Street||228,-333 257,-325
residential|Commerce Street|2|348,-549 327,-488
residential|Commerce Street|3|362,-592 352,-561
residential|Saint Paul Street||295,558 323,563
pedestrian|||-92,-730 -97,-722
motorway|Auckland Southern Motorway|2|-715,535 -689,575
motorway|Auckland Southern Motorway|2|-662,700 -667,739 -679,781 -729,888
motorway_link||1|269,905 316,852
motorway_link||1|316,852 432,729 460,704
motorway_link||2|-701,721 -672,675 -645,647
motorway_link||2|-637,651 -656,670 -680,703
motorway_link||1|-763,1077 -785,1000
motorway_link||1|-753,952 -748,1014 -715,1117
motorway_link||1|-697,789 -739,887 -749,920 -753,952
motorway_link||2|-754,859 -732,794
motorway_link||3|-661,596 -653,582
motorway_link||2|-760,929 -760,988 -728,1103
motorway_link||1|-693,725 -753,883 -760,929
motorway_link||1|-750,1061 -771,972 -770,915 -766,892
secondary|Wellesley Street East|2|346,565 323,528
secondary|Wellesley Street East|1|327,524 352,561
secondary|Wellesley Street East|2|323,528 285,472
secondary|Wellesley Street East|3|381,602 408,635
pedestrian|||-15,-748 -23,-762 -23,-779 44,-984
pedestrian|||153,-1067 56,-772 57,-753 64,-724 76,-700 83,-696 79,-681
secondary|Union Street|4|-767,375 -748,404
motorway_link||2|-785,1000 -796,964 -804,923
motorway_link||4|-559,574 -575,594
primary|Fanshawe Street|5|-112,-501 -135,-497 -184,-470
primary|Fanshawe Street|3|-710,-332 -684,-325 -658,-324
motorway|Northwestern Motorway|3|632,571 569,618 514,668 475,712 420,788
motorway_link||1|-757,720 -746,698 -732,653 -729,617 -732,582 -739,549 -748,526 -780,471 -787,452
motorway_link||1|-641,725 -713,866 -729,888
motorway_link||2|-575,594 -602,639 -641,725
pedestrian|Aotea Square||-130,307 -61,331 -44,336
residential|Churchill Street||788,338 808,341 817,338 821,332
tertiary|Albert Street|4|-59,-141 -31,-219
residential|Wyndham Street|4|-27,-228 83,-187
secondary|Karangahape Road|4|-202,993 -189,999
secondary|Grafton Bridge|2|-62,1056 -40,1073
secondary|Wellesley Street East|2|74,233 98,248 124,276
secondary|Mayoral Drive|5|117,362 119,345
secondary|Mayoral Drive|2|58,471 84,434 94,427
unclassified|Princes Street|2|289,376 327,332 359,256
secondary_link||1|-736,-53 -751,-54 -760,-50
residential|Fort Street|2|359,-303 331,-302 268,-323
secondary|Mayoral Drive|4|119,330 124,290
residential|Cobden Street|2|-781,1085 -797,1041
secondary|Karangahape Road|2|-532,957 -567,954 -602,966
secondary|Karangahape Road|5|-532,957 -484,966
residential|Federal Street||-169,-86 -146,-150
secondary|Wellington Street|2|-828,439 -761,432
pedestrian|Wynyard Street||634,354 609,380 600,388
tertiary|Wakefield Street|4|66,579 88,627 95,632
living_street|Queens Wharf||268,-677 299,-771
living_street|Queens Wharf|1|269,-622 275,-643 262,-661 262,-668 268,-677
living_street|Queens Wharf||268,-677 268,-665 281,-651 283,-643 277,-620
secondary_link|Wellesley Street East|1|324,545 239,423
pedestrian|Governor Fitzroy Place||115,533 104,508 89,477 74,458
residential|Lorne Street||83,436 65,423 37,362
secondary|Customs Street West|3|5,-549 67,-528
primary|Fanshawe Street|3|-308,-382 -430,-355
primary|Sturdee Street|4|-174,-499 -125,-526
pedestrian|||-277,-640 -260,-694 -123,-648 -97,-722
residential|Gore Street|2|425,-522 435,-552
residential|Gore Street|1|409,-470 425,-522
residential|Gore Street|1|425,-522 426,-496 421,-482 409,-470
pedestrian|Roukai Lane||448,-449 466,-509
pedestrian|Te Ara Tahuhu Walkway||463,-478 456,-476 345,-513 343,-517 337,-519
residential|Lucy Lane||-408,-430 -352,-441 -337,-490
secondary_link||1|-43,-688 -41,-672 -58,-622
residential|Airedale Street||103,797 92,791 89,786
pedestrian|Durham Street East||89,-77 98,-75 159,-56
pedestrian|Chancery Square||281,-115 273,-95
residential|Bankside Street||460,-228 460,-216 438,-160
living_street|Alfred Street|1|496,307 520,322
secondary|Waterloo Quadrant|4|488,-70 480,-71
primary|Fanshawe Street|3|-716,-320 -840,-360
secondary|Mayoral Drive|5|29,495 58,471
secondary|Halsey Street|5|-708,-394 -701,-413
primary|Hobson Street|4|-189,-288 -236,-157
secondary|Wellesley Street East|2|465,783 460,748
motorway_link||1|465,783 456,755
pedestrian|North Wharf Promenade||-521,-894 -469,-875
secondary_link||1|797,-405 791,-433
living_street|Te Wero Island||-247,-799 -257,-802
secondary|Lower Hobson Street|3|-55,-656 -82,-582
secondary|Quay Street|4|19,-700 -32,-715
residential|Rutland Street||-38,359 -17,359
residential|Rutland Street||-17,359 -25,365 -26,375
pedestrian|Aotea Square||-154,447 -82,377 -61,385
secondary|Symonds Street|2|331,558 330,566 312,584
secondary|Symonds Street|3|312,584 323,563 331,558
residential|Saint Martins Lane|2|-9,969 21,999
secondary|Quay Street|2|695,-483 729,-477 774,-463
secondary|Quay Street|5|646,-500 577,-522
secondary|Queen Street|3|-249,922 -254,926
secondary|Queen Street|2|-254,926 -253,912 -217,814
secondary|Queen Street|2|-165,695 -210,818
secondary|Queen Street|6|-143,623 -137,607
secondary|Queen Street|2|-150,643 -152,659 -165,695
secondary|Queen Street|2|-174,693 -160,657 -150,643
secondary|Queen Street|2|-196,756 -177,703
secondary|Tangihua Street|3|797,-405 809,-441
secondary|Beach Road|5|707,-323 742,-281
secondary|Quay Street|2|786,-448 733,-466
residential|Albert Street||-31,-219 -27,-201 -44,-150
residential|Federal Street|2|-69,-364 -54,-408
residential|Durham Lane||11,-108 0,-79
residential|Durham Lane||0,-79 -2,-73
secondary_link||1|-761,432 -756,430
primary|Nelson Street|4|-427,-51 -410,-100
motorway_link||2|-792,861 -782,803
motorway|Auckland Southern Motorway|2|-783,892 -777,833 -760,782 -733,721 -717,661 -716,621 -721,579 -741,523 -756,497
motorway_link||1|396,803 358,861 190,1144
secondary|Stanley Street|2|649,635 613,678
secondary|Wellesley Street East|3|469,735 471,739
living_street|Waikokota Lane||-629,-794 -641,-758
secondary|Quay Street|2|818,-438 786,-448
pedestrian|Tīramarama Way||-818,-734 -796,-732 -622,-675 -615,-673
motorway_link||2|-676,692 -684,752 -697,789
motorway|Northwestern Motorway|3|635,555 710,508 748,475
trunk_link|Stanley Street|1|671,596 663,612
primary_link||1|-644,-311 -693,-297 -706,-287
residential|Turner Street||-169,706 -177,703
secondary|Queen Street|3|-216,836 -249,922
residential|||-225,836 -216,836
tertiary|Albert Street|4|76,-525 74,-517
secondary|Customs Street West|2|76,-525 87,-514
tertiary|Victoria Street West|2|-4,-27 70,0
secondary|Customs Street East|6|390,-413 354,-425
residential|Gore Street|2|395,-427 401,-445
secondary|Tangihua Street|3|785,-330 779,-315 770,-304
pedestrian|||-618,-805 -583,-794 -576,-792
pedestrian|Fish Lane||-673,-898 -675,-891 -691,-840
living_street|Māhuru Lane||-720,-783 -739,-723
living_street|Māhuru Lane||-744,-706 -767,-632
residential|Liverpool Street||-132,867 -41,768 -33,756
living_street|Galway Street|1|333,-486 406,-462
residential|Scene Lane||764,-377 725,-389 714,-396
primary|Fanshawe Street|6|-260,-408 -275,-399
residential|Bradnor Lane|1|-260,-408 -252,-396
secondary|Symonds Street|5|331,558 332,557
unclassified|Princes Street|1|253,414 263,401
secondary|Wellesley Street East|2|233,393 253,414
primary|Nelson Street|5|-324,-338 -308,-382
primary|Fanshawe Street|3|-275,-399 -303,-399
primary|Fanshawe Street|5|-411,-375 -384,-379
motorway|Stanley Street|2|748,475 774,448 798,417
secondary|Customs Street West|3|-71,-553 -40,-560
secondary|Lower Hobson Street|2|-104,-549 -92,-580
secondary|Lower Hobson Street|2|-55,-684 -47,-699 -32,-715
primary|Sturdee Street|4|-236,-462 -174,-499
primary|Sturdee Street|3|-276,-425 -236,-462
primary|Sturdee Street|3|-303,-399 -276,-425
primary|Fanshawe Street|3|-569,-342 -498,-358
primary|Fanshawe Street|4|-498,-358 -411,-375
primary|Fanshawe Street|3|-430,-355 -464,-348
primary|Fanshawe Street|4|-464,-348 -644,-311
primary|Fanshawe Street|4|-644,-311 -679,-310 -705,-316
primary|Nelson Street|5|-338,-298 -324,-338
primary|Fanshawe Street|6|-246,-420 -260,-408
primary|Fanshawe Street|5|-232,-435 -246,-420
primary|Fanshawe Street|5|-184,-470 -204,-458 -232,-435
primary||4|-308,-382 -303,-399
secondary|Symonds Street|5|332,557 334,554
secondary|Cook Street|5|-532,252 -539,250
primary|Hobson Street|4|-547,555 -554,566
motorway_link||3|-620,606 -614,587 -614,569 -621,537
secondary|Union Street|3|-554,566 -572,554 -621,537
secondary|Wellesley Street West|5|-162,152 -215,134
secondary|Wellesley Street West|4|-286,108 -264,116
secondary|Wellesley Street West|5|-264,116 -242,124
secondary|Wellesley Street West|5|-377,75 -326,93
secondary|Wellesley Street West|5|-394,69 -377,75
secondary|Wellesley Street West|5|-428,56 -394,69
secondary|Wellesley Street West|6|-460,45 -428,56
primary|Nelson Street|5|-484,123 -460,45
secondary|Wellesley Street West|5|-526,22 -460,45
secondary|Wellesley Street West|3|-708,-46 -561,9
secondary|Wellesley Street West|4|-82,180 -73,184
secondary|Wellesley Street West|5|-242,124 -215,134
primary|Hobson Street|6|-389,257 -410,296
secondary|Cook Street|5|-410,296 -475,272
primary|Hobson Street|4|-410,296 -524,516
primary|Hobson Street|5|-319,72 -326,93
primary|Hobson Street|4|-257,-98 -303,28
secondary|Mayoral Drive|6|-256,489 -238,517
secondary|Mayoral Drive|5|-282,411 -273,451
secondary|Mayoral Drive|6|-286,380 -285,391
secondary|Cook Street|6|-475,272 -532,252
secondary|Cook Street|4|-614,223 -649,210
secondary|Cook Street|3|-782,161 -649,210
secondary|Queen Street|5|-276,988 -264,953
secondary|Queen Street|2|-210,818 -216,836
secondary|Queen Street|2|-177,703 -174,693
secondary|Queen Street|2|-217,814 -196,756
secondary|Karangahape Road|5|-690,1000 -634,979
secondary|Karangahape Road|4|-424,978 -394,983
secondary|Karangahape Road|5|-484,966 -424,978
secondary|Karangahape Road|5|-322,990 -276,988
secondary|Karangahape Road|5|-276,988 -220,987
secondary|Karangahape Road|4|-155,1014 -97,1041
secondary|Upper Queen Street|5|-296,1043 -304,1065
secondary|Upper Queen Street|5|-276,988 -279,996
primary|Nelson Street|4|-588,410 -537,266
secondary|Union Street|4|-680,500 -671,507 -628,522
secondary|Union Street|3|-696,479 -694,482
secondary|Union Street|3|-705,472 -696,479
secondary|Union Street|3|-698,494 -703,485
secondary|Union Street|1|-703,485 -705,472
secondary|Pitt Street|5|-494,890 -503,818
secondary|Pitt Street|6|-507,784 -510,761
secondary|Pitt Street|6|-503,818 -507,784
secondary|Pitt Street|5|-515,721 -519,683
secondary|Hopetoun Street|4|-603,775 -570,739
secondary|Hopetoun Street|3|-663,839 -603,775
secondary|Hopetoun Street|2|-674,850 -663,839
motorway_link||1|-782,803 -761,751 -729,701
motorway_link||4|-676,626 -661,596
motorway_link||2|-645,647 -630,628 -620,606
motorway_link||2|-732,794 -701,721
secondary|Wellington Street|2|-750,440 -822,447
secondary|Union Street|3|-821,295 -767,375
secondary|Sam Wrigley Street|2|-770,216 -817,254
secondary|Sam Wrigley Street|2|-817,254 -821,257
secondary|Queen Street|5|-150,643 -143,623
primary|Nelson Street|4|-610,472 -588,410
primary|Nelson Street|4|-532,252 -523,228
secondary|Karangahape Road|4|-834,1055 -809,1046
secondary|Pitt Street|2|-524,635 -530,604
living_street|||-816,-438 -866,-454
living_street|Victoria Lane||-776,-424 -792,-374
living_street|Saint Patrick's Square||-143,-271 -126,-317 -68,-296
secondary|Grafton Road|1|551,727 592,690
secondary|Grafton Road|2|597,684 603,688
secondary|Symonds Street|5|128,798 150,773
secondary|Symonds Street|5|93,838 100,831
secondary|Symonds Street|5|-61,1006 -25,967
secondary|Symonds Street|6|-81,1047 -61,1006
secondary|Wellesley Street East|2|19,217 32,217 52,225
secondary||3|124,290 124,276
secondary|Kitchener Street|1|124,276 126,263 156,178
secondary|Wellesley Street East|3|179,348 164,332
secondary|Wellesley Street East|2|285,472 256,431
secondary|Wellesley Street East|1|352,561 381,602
secondary|Mayoral Drive|5|-47,539 29,495
secondary|Mayoral Drive|2|94,427 85,450 58,471
secondary|Wellesley Street West|4|-73,184 0,210
secondary|Mayoral Drive|4|-64,546 -47,539
secondary|Grafton Road|5|452,864 441,891
secondary|Grafton Road|4|441,891 437,904
secondary|Grafton Road|4|456,852 452,864
secondary|Grafton Road|3|401,997 386,1038
secondary|Grafton Road|3|437,904 401,997
secondary|Wellesley Street East|3|467,730 469,735
secondary|Wellesley Street East|2|460,711 467,730
motorway|Northwestern Motorway|2|420,788 221,1107
secondary|Grafton Road|3|462,827 466,793
secondary|Grafton Road|1|569,664 566,645
secondary|Grafton Road|2|517,760 551,727
secondary|Symonds Street|4|520,322 537,303
secondary|Anzac Avenue|3|738,102 747,93
secondary|Anzac Avenue|5|723,117 738,102
secondary|Anzac Avenue|5|706,136 723,117
secondary|Symonds Street|5|676,164 706,136
residential|Lower Domain Drive|1|686,611 674,608 663,612
trunk_link|Stanley Street|2|692,553 671,596
secondary|Stanley Street|1|663,612 649,635
secondary|Alten Road|4|761,192 771,205
secondary|Alten Road|4|706,136 761,192
secondary|Grafton Road|2|548,454 543,434 538,383
secondary|Grafton Road|3|549,469 555,518
motorway_link||2|357,749 416,663
motorway_link||1|416,663 423,654
motorway_link||1|424,673 431,665
motorway_link||2|361,761 424,673
trunk|Stanley Street|2|822,406 778,461
motorway|Stanley Street|2|798,417 822,386
secondary|Quay Street|3|774,-463 816,-448
secondary|Tangihua Street|3|789,-378 797,-405
secondary|Tangihua Street|3|795,-363 785,-330
secondary|Tangihua Street|2|810,-409 795,-363
secondary|Tangihua Street|3|774,-326 789,-378
secondary|Beach Road|5|800,-202 821,-175
secondary|Beach Road|4|768,-245 800,-202
secondary|Beach Road|5|742,-281 768,-245
secondary|Customs Street East|5|452,-392 437,-397
secondary|Customs Street East|7|437,-397 390,-413
secondary|Customs Street East|6|354,-425 336,-431
secondary|Customs Street West|3|87,-514 74,-517
tertiary|Albert Street|4|63,-484 12,-335
residential|Lower Albert Street|4|79,-535 107,-617
secondary|Bowen Avenue|3|431,-51 456,-60
tertiary|Victoria Street East|2|144,25 70,0
tertiary|Victoria Street West|2|-41,-42 -4,-27
tertiary|Victoria Street West|2|-142,-77 -89,-59
secondary|Lower Hobson Street|2|-92,-580 -55,-684
secondary|Lower Hobson Street|4|-82,-582 -106,-517
secondary_link||2|-58,-622 -71,-579
secondary|Quay Street|3|440,-566 435,-568
secondary|Quay Street|2|173,-653 124,-668
secondary|Quay Street|3|440,-566 480,-553
secondary|Quay Street|5|695,-483 646,-500
secondary|Quay Street|2|733,-466 695,-483
secondary|Fanshawe Street|3|74,-517 25,-527
secondary|Customs Street East|7|336,-431 308,-440
secondary|Customs Street West|3|-40,-560 -31,-560 5,-549
secondary|Waterloo Quadrant|4|650,79 634,62
secondary|Waterloo Quadrant|4|706,136 688,117
secondary|Anzac Avenue|5|684,-202 675,-219
secondary|Anzac Avenue|4|675,-219 638,-307
secondary|Anzac Avenue|5|638,-307 628,-336 635,-362
secondary|Beach Road|6|521,-386 534,-387 567,-382
secondary|Beach Road|5|503,-384 521,-386
secondary|Beach Road|6|698,-332 707,-323
secondary|Quay Street|3|322,-605 362,-592
tertiary|Victoria Street West|3|-252,-112 -220,-102
secondary|Halsey Street|5|-719,-169 -715,-226
secondary|Halsey Street|3|-723,-95 -721,-137
secondary|Halsey Street|4|-715,-226 -710,-270
secondary|Victoria Street West|6|-723,-95 -691,-95
secondary|Victoria Street West|5|-691,-95 -671,-96
secondary_link||2|-708,-46 -736,-53
secondary|Wellesley Street West|5|-561,9 -526,22
primary|Nelson Street|3|-460,45 -427,-51
secondary||5|-467,-136 -390,-151
primary|Nelson Street|4|-410,-100 -390,-151
primary|Nelson Street|4|-390,-151 -338,-298
secondary|Victoria Street West|5|-390,-151 -369,-151 -313,-134
secondary|Victoria Street West|5|-313,-134 -252,-112
secondary|Victoria Street West|5|-822,-96 -808,-96
secondary|Victoria Street West|6|-763,-96 -723,-95
primary|Hobson Street|5|-159,-372 -167,-349
primary|Hobson Street|5|-236,-157 -252,-112
secondary|Wellesley Street East|1|235,405 214,386
secondary_link|Wellesley Street East|1|228,407 214,386
secondary|Alten Road|3|771,205 777,215
motorway_link||2|-857,301 -787,399
residential|Day Street||-694,991 -708,948
residential|Lorne Street||144,25 129,61
living_street|Fort Street||228,-333 189,-345
residential|Gore Street|2|435,-552 440,-566
primary|Hobson Street|5|-112,-501 -116,-486
secondary|Quay Street|3|269,-622 277,-620
residential|Grafton Road|1|592,690 597,684
secondary|Grafton Road|1|603,688 592,690
secondary|Wellesley Street East|2|424,673 416,663
secondary|Wellesley Street East|3|423,654 431,665
secondary|Wellesley Street East|3|431,665 441,679
secondary|Wellesley Street East|2|433,685 424,673
secondary|Grafton Road|1|466,793 475,783
secondary||3|475,783 476,790
secondary|Grafton Road|2|476,790 466,793
primary|Fanshawe Street|3|-281,-394 -308,-382
secondary|Halsey Street|5|-701,-413 -687,-457
secondary|Halsey Street|3|-687,-457 -680,-474
secondary|Mayoral Drive|6|-285,391 -282,411
tertiary|Britomart Place|3|503,-384 535,-421
secondary|Victoria Street West|5|-808,-96 -763,-96
secondary_link||2|-753,-75 -763,-96
residential|Parliament Street|2|803,-11 734,12
pedestrian|Mercury Lane||-484,966 -487,1031
primary|Nelson Street|3|-633,533 -628,522
tertiary|Vincent Street|6|-333,347 -320,331
tertiary|Mayoral Drive|5|-253,270 -287,294 -320,331
tertiary|Greys Avenue|5|-253,533 -238,517
unclassified|Greys Avenue|2|-238,517 -212,490
residential|Saint James Street||-610,759 -608,688
tertiary|Vincent Street|3|-519,683 -498,655
tertiary|Albert Street|2|-162,152 -162,140 -127,34
primary|Hobson Street|5|-303,28 -319,72
secondary|Karangahape Road|4|-220,987 -202,993
secondary|Wellington Street|1|-732,428 -747,439
secondary|Union Street|4|-705,472 -715,457
secondary|Wellington Street|2|-747,439 -750,440
motorway_link||1|455,727 437,749
residential|Stanley Street|1|597,684 612,667
motorway|Northwestern Motorway|2|190,1087 261,961 351,837 460,704 550,618 635,555
secondary|Grafton Road|4|555,518 558,548
living_street|Courthouse Lane|1|228,-140 229,-116 236,-98
pedestrian|Autahi Lane||-734,-621 -707,-703
pedestrian|||-615,-636 -622,-638
secondary|Symonds Street|5|334,554 342,544
secondary|Symonds Street|5|346,539 348,537
secondary|Union Street|3|-621,537 -633,533
primary_link||3|-621,537 -628,522
primary|Nelson Street|3|-628,522 -623,509
primary|Fanshawe Street|4|-718,-336 -710,-332
secondary|Halsey Street|2|-710,-332 -705,-316
secondary|Halsey Street|2|-718,-336 -717,-358
secondary|Halsey Street|3|-716,-320 -718,-336
secondary|Halsey Street|2|-717,-358 -710,-332
primary|Fanshawe Street|4|-705,-316 -716,-320
secondary|Halsey Street|2|-705,-316 -706,-287
secondary|Halsey Street|4|-709,-277 -714,-292 -716,-320
residential|Sale Street||-612,14 -600,11 -590,-2
residential|Airedale Street||-53,486 -41,510 -30,529
residential|Airedale Street||-82,446 -71,450 -63,463
residential|Airedale Street||-63,463 -84,453
secondary||2|809,-441 816,-448
secondary||2|816,-448 818,-438
residential|Customs Street West|1|-411,-375 -403,-384 -401,-395
motorway_link||3|273,1049 215,1142
motorway_link||1|-766,892 -754,859
motorway_link||1|-793,893 -792,861
residential|Day Street||-708,948 -695,901
secondary|Union Street|4|-628,522 -580,539
tertiary|Britomart Place|3|563,-478 577,-522
tertiary|Britomart Place|1|550,-450 555,-467 563,-478
secondary|Anzac Avenue|2|803,19 800,-44
secondary|Anzac Avenue|4|747,93 761,79
secondary|Anzac Avenue|2|800,-44 807,-32 810,-12 809,7 803,19
living_street|Alfred Street|1|474,299 496,307
pedestrian|Market Square||-232,-624 -229,-632 -213,-678
secondary_link||1|-756,430 -749,421 -748,404
secondary|Wellington Street|2|-756,431 -732,428
secondary|Mayoral Drive|5|-204,552 -176,563
secondary|Mayoral Drive|5|-140,567 -123,565
living_street|Federal Street||-203,9 -201,4
living_street|Federal Street|1|-201,4 -184,-44
motorway|Auckland Northern Motorway|2|-756,497 -787,452
motorway_link||2|-787,399 -744,462 -706,542 -681,636 -676,692
secondary_link|||-762,-57 -755,-66 -753,-75
residential|Drake Street||-777,-54 -762,-57
secondary|Wellesley Street East|4|0,210 19,217
secondary|Wellesley Street East|2|157,323 137,303
residential|Parliament Street|1|645,40 618,46
living_street|Eastern Viaduct||-130,-761 -228,-792
living_street|Galway Street|1|453,-448 406,-462
pedestrian|Brigham Street||-743,-972 -758,-927
residential|Emily Place||548,-280 558,-301
pedestrian|North Wharf Promenade||-469,-875 -446,-867
residential|Beresford Square||-601,849 -590,849 -570,861 -571,870 -576,872 -592,862 -601,849
secondary|Anzac Avenue|4|761,79 791,45 803,19
secondary|Grafton Road|3|548,454 549,469
tertiary|Albert Street|2|-101,-25 -99,-13 -117,38
tertiary|Mayoral Drive|3|-162,152 -184,215 -193,230 -204,241
residential|Lower Domain Drive|2|709,619 744,636
tertiary|Mayoral Drive|5|-215,248 -238,260
residential|Market Place|3|-290,-450 -303,-399
primary|Sturdee Street|5|-125,-526 -118,-531
residential|Customs Street West|2|-283,-640 -297,-635 -360,-577 -380,-511
residential|Customs Street West|1|-401,-395 -384,-379
residential|Viaduct Harbour Avenue|2|-647,-443 -596,-424 -580,-412 -559,-408 -526,-414 -513,-421 -500,-454 -491,-462 -480,-463 -435,-448 -411,-444
tertiary|Gaunt Street||-722,-468 -821,-500
primary|Fanshawe Street|3|-658,-324 -569,-342
secondary|Halsey Street|2|-706,-287 -709,-277
pedestrian|Te Wero Island||-257,-802 -345,-834
residential|Wolfe Street|1|46,-431 34,-432 -37,-458
residential|Federal Street|1|-37,-458 -24,-494
secondary|Queen Street|6|-137,607 -123,565
residential|Customs Street West||-92,-580 -236,-625
pedestrian|||-711,-921 -711,-920
pedestrian|||-704,-945 -711,-921
pedestrian|||-684,-912 -687,-903
pedestrian|||-677,-936 -684,-912
secondary|Symonds Street|4|-17,961 20,923
secondary|Symonds Street|4|-25,967 -17,961
residential|Saint Martins Lane||21,999 68,949
residential|Wyndham Street|4|-85,-249 -27,-228
tertiary|Albert Street|1|2,-307 -16,-258
living_street|Tyler Street||290,-568 348,-549
pedestrian|Galway Street||241,-518 210,-528
secondary|Cook Street|3|-833,144 -782,161
secondary|Halsey Street|5|-717,-358 -708,-394
motorway_link||2|-804,923 -806,884 -798,819 -786,781 -762,729
secondary|Karangahape Road|5|-189,999 -155,1014
secondary|Queen Street|6|-264,953 -254,926
residential|Chancery Street||312,-147 422,-161
tertiary|Princes Street|4|485,-88 480,-71
secondary|Mayoral Drive|4|119,345 119,330
secondary|Mayoral Drive|4|94,427 112,382
motorway_link||3|-653,582 -642,557
residential|Gorst Lane||-303,-252 -242,-229
residential|Gorst Lane||-336,-263 -303,-252
secondary|Upper Queen Street|5|-279,996 -296,1043
primary|Nelson Street|4|-523,228 -484,123
secondary|Cook Street|5|-539,250 -614,223
tertiary|Greys Avenue|3|-286,566 -253,533
residential|Lower Domain Drive|2|813,644 824,642
residential|Lower Domain Drive|2|793,647 813,644
secondary|Customs Street West|6|87,-514 135,-498
residential|Federal Street||-116,-235 -108,-258
residential|Federal Street||-139,-171 -116,-235
residential|Federal Street||-146,-150 -139,-171
residential|Kingston Street||-166,-182 -139,-171
residential|Kingston Street|1|-93,-152 -81,-148
residential|Swanson Street|2|-108,-377 -69,-364
residential|Federal Street|1|-24,-494 -18,-511 -19,-523
residential|Wyndham Street|3|-228,-302 -212,-296
residential|Wyndham Street|3|-151,-274 -85,-249
primary|Hobson Street|5|-175,-326 -189,-288
secondary|Customs Street East|6|232,-466 191,-479
secondary|Customs Street West|7|135,-498 191,-479
residential|Lower Domain Drive|2|744,636 776,648 793,647
residential|Market Place|2|-282,-472 -290,-450
residential|Swanson Street|2|79,-312 12,-335
residential|Sale Street||-844,63 -612,14
residential|Vernon Street||-745,22 -742,40
tertiary|Britomart Place|1|546,-435 550,-450
residential|Commerce Street|2|293,-404 268,-323
residential|Emily Place|1|558,-301 562,-311 573,-311
residential|Parliament Street||645,40 637,47 634,62
secondary|Waterloo Quadrant|4|618,46 541,-33
secondary|Waterloo Quadrant|4|634,62 618,46
secondary|Waterloo Quadrant|4|688,117 650,79
secondary|Tangihua Street|2|770,-304 774,-326
secondary|Tangihua Street|4|770,-304 756,-290
secondary|Mayoral Drive|5|112,382 117,362
living_street|||-744,-453 -758,-418
secondary_link|||213,17 213,21 219,27
secondary|Bowen Avenue|3|456,-60 480,-71
unclassified|Princes Street|2|453,0 391,169
secondary|Waterloo Quadrant|4|504,-65 488,-70
unclassified|Kitchener Street|2|213,17 236,-18 270,-51 310,-74 343,-87 370,-93 425,-96 470,-86 476,-81 480,-71
secondary|Bowen Avenue|1|219,27 233,24
tertiary|Mayoral Drive|5|-238,260 -253,270
tertiary|Vincent Street|6|-349,373 -333,347
secondary|Union Street|4|-748,404 -732,428
secondary|Fanshawe Street|4|-72,-511 -112,-501
secondary|Fanshawe Street|4|25,-527 9,-528 -19,-523
residential|Wolfe Street|1|-54,-464 -37,-458
residential|Nelson Street||-555,280 -548,262 -532,252
living_street|||-776,-424 -770,-449 -749,-441
secondary|Wellesley Street West|2|-723,-95 -724,-84
tertiary|Shortland Street|2|181,-282 152,-291 140,-291
unclassified|Greys Avenue|2|-212,490 -196,473
unclassified|Greys Avenue|2|-196,473 -184,461
unclassified|Wakefield Street|1|-38,359 -26,375
unclassified|Wakefield Street||-26,375 -22,388
residential|Rutland Street||8,354 -17,359
motorway_link||2|-762,729 -757,720
pedestrian|||-274,-647 -281,-647 -361,-674 -461,-585 -472,-588 -525,-424 -521,-417
tertiary|Wakefield Street|3|119,708 117,747 110,773
tertiary|Wakefield Street|1|131,706 148,744 155,751 169,753
tertiary|Wakefield Street|1|103,797 110,773
residential|Airedale Street||84,777 89,786
secondary|Symonds Street|5|105,825 123,804
secondary|Symonds Street|5|100,831 105,825
secondary|Symonds Street|4|169,753 177,744
secondary|Symonds Street|4|177,744 266,646
secondary|Symonds Street|5|348,537 357,527
secondary|Symonds Street|4|361,521 499,349
living_street|Aotea Square||-184,461 -170,461 -154,447
living_street|Saint Patrick's Square||-68,-296 -58,-315
tertiary|Albert Street|4|-78,-90 -89,-59
living_street|Galway Street|2|323,-490 241,-518
pedestrian|||225,-570 244,-564 250,-581
pedestrian|||237,-542 217,-548
secondary|Symonds Street|5|123,804 128,798
secondary|Symonds Street|6|-85,1055 -81,1047
secondary|Grafton Bridge|2|-69,1052 -62,1056
residential|Saint Martins Lane|2|-17,961 -9,969
residential|City Road|2|20,923 9,913
residential|Saint Martins Lane|1|41,918 32,910
residential|Whitaker Place||123,804 134,810
tertiary|Wakefield Street|2|115,797 123,804
tertiary|Wakefield Street||109,804 103,797
secondary|Symonds Street|5|342,544 346,539
secondary_link|Wellesley Street East|1|332,557 324,545
residential|Customs Street West|2|-236,-625 -283,-640
residential|Customs Street West|2|-388,-500 -405,-451 -411,-444
pedestrian|Te Ara Tahuhu Walkway||550,-450 545,-451
residential|Madden Street||-821,-817 -797,-809
primary|Fanshawe Street|3|-275,-399 -281,-394
secondary|Customs Street West|3|67,-528 76,-525
residential|Saint Paul Street||1,588 56,559 116,533
secondary_link|Wellesley Street East|1|239,423 228,407
residential|Lower Albert Street|4|76,-525 79,-535
tertiary|Albert Street|4|74,-517 70,-505
secondary|Grafton Road|2|603,688 570,721
secondary|Alten Road|1|810,374 792,347
secondary|Alten Road|3|788,338 792,347
residential|Kingston Street|1|-81,-148 -59,-141
residential|Gore Street|2|390,-413 395,-427
residential|Gore Street|3|386,-401 390,-413
residential|Commerce Street|3|315,-453 308,-440
residential|Commerce Street|3|308,-440 301,-428
living_street|Fort Lane||257,-444 261,-456
tertiary|Albert Street|2|-139,102 -153,140 -162,152
living_street|||-706,-398 -724,-405 -782,-427
pedestrian|Te Ara Tahuhu Walkway||541,-452 463,-478
pedestrian|Te Ara Tahuhu Walkway||545,-451 541,-452
residential|Emily Place||472,-228 481,-238 525,-266
residential|Emily Place||525,-266 548,-280
secondary|Union Street|4|-715,457 -732,428
secondary|Union Street|3|-694,482 -680,500
motorway_link||4|-554,566 -559,574
motorway|Auckland Southern Motorway|2|-689,575 -667,637 -662,672 -662,700
tertiary|Albert Street|4|70,-505 63,-484
residential|Madden Street||-641,-758 -592,-742
living_street|||-625,-807 -618,-805
living_street|||-618,-805 -619,-804
pedestrian|Waikokota Lane||-603,-874 -605,-867 -619,-825
pedestrian|Piripi Lane||-630,-628 -636,-630 -684,-645
pedestrian|Waikokota Lane||-665,-689 -671,-682 -696,-608
secondary|Grafton Road|1|497,772 517,760
secondary|Symonds Street|4|303,596 312,584
secondary|Wellesley Street East|2|137,303 124,290
secondary|Wellesley Street East|2|455,727 433,685
pedestrian|Autahi Lane||-707,-703 -685,-772
tertiary|Britomart Place|1|563,-478 559,-449 553,-439 546,-435
living_street|||-798,-493 -816,-438
residential|Scene Lane|1|587,-446 559,-449
residential|Scene Lane|1|699,-405 675,-416
residential|Scene Lane||714,-396 699,-405
residential|Scene Lane||783,-358 781,-363 764,-377
residential|Scene Lane||764,-377 782,-374 789,-378
residential|Kingston Street|1|-139,-171 -93,-152
tertiary|Wakefield Street|2|110,663 115,687
tertiary|Wakefield Street|4|105,652 110,663
tertiary|Wakefield Street|4|95,632 105,652
tertiary|Wakefield Street|4|29,495 48,539
tertiary|Wakefield Street|4|56,559 66,579
tertiary|Wakefield Street|4|48,539 56,559
residential|City Road||-132,867 -216,836
tertiary|Queen Street|3|-71,413 -50,354
tertiary|Queen Street|4|-14,248 -8,232
tertiary|Queen Street|3|-101,502 -84,453
tertiary|Queen Street|2|191,-479 181,-466 167,-406
motorway_link||3|-642,557 -633,533
motorway_link||1|-661,596 -656,578
primary|Fanshawe Street|5|-384,-379 -313,-395
secondary|Halsey Street|4|-710,-270 -709,-277
residential|Hardinge Street|1|-544,-148 -538,-137 -535,-122
residential|Hardinge Street|1|-542,-121 -544,-148
living_street|||-764,-282 -710,-270
secondary|Grafton Road|2|538,383 535,353 525,337 520,322
motorway_link||1|558,548 531,559
secondary|Grafton Road|2|566,645 565,637
living_street|Federal Street||-262,180 -247,137
living_street|Federal Street||-236,107 -203,9
pedestrian|Wynyard Street||600,388 596,392
pedestrian|Wynyard Street||596,392 592,396
secondary_link||1|791,-433 786,-448
secondary|Tangihua Street|4|756,-290 742,-281
living_street|Fort Street|1|503,-384 493,-366
residential|Whitaker Place||158,964 143,983 133,984 135,973 158,964
tertiary|Greys Avenue|1|-509,769 -496,767 -481,760
tertiary|Greys Avenue|1|-481,760 -494,776 -507,784
tertiary|Queen Street|2|58,41 69,5
pedestrian|Lorne Street||64,247 66,241
living_street|Chancery Street|1|243,-141 228,-140
residential||1|-392,-509 -386,-514 -380,-511 -380,-505
residential||1|-380,-505 -382,-501 -388,-500 -392,-509
residential|Pakenham Street East|2|-488,-539 -472,-534 -392,-509
secondary|Quay Street|3|402,-579 362,-592
living_street|Waikokota Lane||-622,-827 -619,-825
living_street|Waikokota Lane||-619,-825 -625,-807
pedestrian|Waikokota Lane||-660,-703 -665,-689
pedestrian|Māhuru Lane||-739,-723 -742,-714
pedestrian|Māhuru Lane||-742,-714 -744,-706
living_street|Waikokota Lane||-641,-758 -660,-703
living_street|Fort Street|1|369,-305 359,-303
living_street|Fort Street||262,-324 268,-323
living_street|Fort Lane||256,-438 257,-442
living_street|Jean Batten Place||209,-277 211,-281
living_street|Fort Street|1|491,-363 487,-355
living_street|Fort Street|1|493,-366 491,-363
secondary|Customs Street East|6|247,-461 232,-466
tertiary|Albert Street|1|-16,-258 -27,-228
tertiary|Albert Street|1|12,-335 2,-307
tertiary|Victoria Street West|2|-142,-77 -169,-86
secondary_link|Wellesley Street East|1|270,422 308,476
primary|Hobson Street|4|-252,-112 -257,-98
residential|Tennis Lane||684,603 678,608
residential|Tennis Lane||686,611 684,603
tertiary|Victoria Street East|2|200,45 195,43
residential|High Street|1|153,-1 144,25
residential|Chancery Street|2|312,-147 291,-145
residential|Federal Street|1|-42,-442 -37,-458
residential|Mount Street|1|235,636 253,639 266,646
secondary|Symonds Street|4|266,646 303,596
residential|Liverpool Street|2|-202,993 -192,965
residential|Drake Street||-816,-46 -777,-54
residential|Drake Street||-827,-44 -816,-46
secondary|Quay Street|3|277,-620 303,-611
living_street|Fort Lane||257,-442 257,-444
tertiary|Queen Street|2|155,-357 140,-291
tertiary|Queen Street|2|157,-365 155,-357
pedestrian|Exchange Lane||150,-352 154,-351
living_street|Federal Street|2|-246,134 -242,124
tertiary|Albert Street|2|-117,38 -139,102
tertiary|Albert Street|4|-91,-54 -101,-25
tertiary|Albert Street|2|-118,9 -108,-16 -101,-25
tertiary|Albert Street|2|-127,34 -118,9
tertiary|Mayoral Drive|5|-204,241 -215,248
secondary|Quay Street|2|303,-611 322,-605
secondary|Quay Street|4|435,-568 402,-579
secondary|Quay Street|4|577,-522 540,-533
living_street|Jean Batten Place||211,-281 212,-287
pedestrian|Swanson Street||140,-291 134,-291
living_street|Fort Street||257,-325 260,-325
residential|Mills Lane||83,-325 98,-367
secondary|Karangahape Road|2|-602,966 -634,979
residential|Chancery Street|1|259,-142 243,-141
living_street|O'Connell Street|1|228,-140 231,-149
living_street|O'Connell Street|1|249,-241 250,-245
living_street|Courthouse Lane|1|236,-98 239,-95
living_street|O'Connell Street|1|251,-248 252,-253
pedestrian|||304,-126 307,-127
pedestrian|||235,-130 228,-140
pedestrian|Freyberg Place||226,-140 228,-140
pedestrian|Freyberg Place||188,-150 191,-149
pedestrian|Freyberg Place||187,-151 188,-150
tertiary|Queen Street|2|124,-223 132,-260
secondary|Wellesley Street West|5|-104,173 -82,180
tertiary|Queen Street|4|-50,354 -37,313
tertiary|Queen Street|3|-84,453 -82,446
tertiary|Queen Street|3|-82,446 -71,413
living_street|Lorne Street||31,350 33,339
residential|Rutland Street||22,352 8,354
residential|Rutland Street||46,347 22,352
residential|Lorne Street||37,362 31,350
pedestrian|Lorne Street||66,241 67,237
tertiary|Queen Street|2|46,76 58,41
living_street|Darby Street||43,75 38,73
living_street|Darby Street||46,76 43,75
living_street|Elliott Street||-78,170 -76,163
living_street|Elliott Street||-82,180 -80,174
living_street|Elliott Street||-9,-15 -4,-27
living_street|Elliott Street||-12,-7 -10,-13
tertiary|Queen Street|2|70,0 76,-24
residential|Wyndham Street|2|83,-187 113,-178
tertiary|Queen Street|2|113,-178 120,-207
tertiary|Queen Street|2|120,-207 124,-223
tertiary|Queen Street|2|105,-147 113,-178
tertiary|Queen Street|2|132,-260 140,-291
tertiary|Shortland Street|2|208,-273 181,-282
tertiary|Queen Street|2|167,-406 157,-365
living_street|Jean Batten Place||208,-273 209,-277
living_street|Fort Street||260,-325 262,-324
residential|Lower Albert Street|3|119,-653 124,-668
residential|Lower Albert Street|3|116,-646 119,-653
secondary|Quay Street|4|56,-688 45,-692
secondary|Quay Street|4|32,-696 19,-700
secondary|Quay Street|4|45,-692 32,-696
primary|Nelson Street|4|-623,509 -610,472
primary|Nelson Street|4|-537,266 -532,252
pedestrian|||7,-871 25,-865
pedestrian|||110,-962 118,-960
pedestrian|||73,-850 81,-847
residential|Bankside Street||429,-134 415,-96
residential|Chancery Street||422,-161 438,-160
residential|Bankside Street||438,-160 429,-134
living_street|||-737,-473 -744,-453
secondary|Halsey Street|2|-662,-530 -556,-851 -557,-858
motorway_link||1|-656,578 -654,559
motorway_link||1|-680,703 -693,725
living_street|Federal Street|2|-184,-44 -174,-71
residential|Waverley Street|1|-140,647 -150,643
residential|Waverley Street|1|-27,687 -38,684
residential|White Street||-33,756 -27,743
secondary|Halsey Street|2|-668,-513 -662,-530
residential|Day Street||-695,901 -688,891
residential|Emily Place|1|573,-311 562,-283 562,-275
living_street|Gore Street Lane||376,-366 383,-364
pedestrian|Durham Street East||159,-56 165,-54
living_street|O'Connell Street|1|250,-245 251,-248
pedestrian|Vulcan Lane||130,-221 124,-223
living_street|Federal Street|2|-174,-71 -169,-86
living_street|Federal Street||-238,113 -236,107
living_street|Federal Street|2|-247,137 -246,134
residential|Day Street||-690,1000 -694,991
residential|East Street||-561,1067 -567,1050 -573,1043
residential|Scotia Place|2|-309,807 -268,821
residential|Airedale Street||-63,463 -53,486
tertiary|Wakefield Street|3|115,687 119,708
living_street|Darby Street||38,73 36,72
living_street|Elliott Street||-80,174 -78,170
living_street|Elliott Street||-10,-13 -9,-15
pedestrian|Freyberg Place||191,-149 192,-149
residential|Mills Lane||79,-312 83,-325
residential|Mills Lane||98,-367 110,-407
pedestrian|Swanson Street||83,-309 79,-312
residential|Tyler Street|1|348,-549 425,-522
living_street|Saint Patrick's Square||-68,-296 -85,-249
secondary|Wellesley Street East|2|416,663 411,656
secondary|Wellesley Street East|2|411,656 400,641
secondary|Wellesley Street East|3|420,650 423,654
secondary|Wellesley Street East|3|408,635 420,650
residential|Quay Street||-130,-761 -134,-744 -120,-737
tertiary|Albert Street|4|-31,-219 -27,-228
secondary|Cook Street|1|-649,210 -694,200
secondary|Cook Street|2|-694,200 -716,193
pedestrian|Queen Street||191,-479 198,-495
residential|Commerce Street|2|352,-561 348,-549
living_street|Tyler Street||265,-576 290,-568
secondary|Symonds Street|4|68,870 93,838
secondary|Symonds Street|4|537,303 572,269
pedestrian|||257,-116 235,-130
pedestrian|Chancery Square||281,-115 257,-116
pedestrian|Warspite Street||276,-83 273,-95
unclassified|Princes Street|4|465,-33 459,-16
unclassified|Princes Street|3|459,-16 453,0
tertiary|Princes Street|2|529,-209 510,-155
tertiary|Princes Street|4|494,-111 485,-88
residential|Princes Wharf|3|-32,-715 -15,-748
residential|Quay Street|2|-120,-737 -80,-729
residential|Quay Street|2|-45,-719 -32,-715
residential|High Street|1|214,-271 188,-155
residential|High Street|1|188,-155 187,-151
pedestrian|Vulcan Lane||200,-199 239,-188
secondary|Wellesley Street East|2|52,225 74,233
tertiary|Queen Street|3|-113,535 -101,502
primary|Fanshawe Street|5|-313,-395 -303,-399
secondary|Mayoral Drive|5|-149,567 -140,567
secondary|Mayoral Drive|5|-123,565 -107,561
tertiary|Albert Street|4|-89,-59 -91,-54
tertiary|Queen Street|2|69,5 70,0
residential|Swanson Street|2|-23,-349 12,-335
residential|Swanson Street|3|-69,-364 -43,-356
residential|Swanson Street|2|-43,-356 -23,-349
secondary|Lower Hobson Street|2|-37,-700 -43,-688
residential|Lower Domain Drive|1|709,619 700,616
residential|Lower Domain Drive|1|702,614 709,619
living_street|Galway Street|2|327,-488 323,-490
living_street|Galway Street|1|327,-488 333,-486
residential|Gore Street|2|408,-467 409,-470
residential|Gore Street|2|405,-457 408,-467
living_street|Galway Street|1|535,-421 529,-423
residential|Durham Lane||-2,-73 8,-69
residential|Durham Lane||12,-111 11,-108
residential|Durham Street West||13,-114 -4,-120
residential|Durham Street West||-26,-128 -48,-135
residential|Gorst Lane||-242,-229 -213,-219
residential|Albert Street||-44,-150 -48,-135
tertiary|Shortland Street|2|321,-230 268,-246 208,-273
residential|Liverpool Street|2|-154,892 -132,867
residential|Liverpool Street|2|-192,965 -187,949
tertiary|Vincent Street|3|-415,496 -349,373
living_street|Mercury Lane||-487,1031 -487,1044 -482,1056
residential|Lyndock Street||41,683 67,670
living_street|Cross Street||-467,1056 -482,1056
living_street|Mercury Lane||-482,1056 -477,1069
living_street|Victoria Lane||-792,-372 -793,-370
residential|Poynton Terrace||-410,905 -341,918
residential|Graham Street||-470,-254 -482,-257 -557,-240
living_street|Waikokota Lane||-625,-807 -629,-794
secondary|Lower Hobson Street|3|-50,-669 -55,-656
pedestrian|||-503,904 -516,899
pedestrian|||-522,910 -510,888
residential|Wyndham Street|2|-212,-296 -189,-288
residential|Wyndham Street|1|-324,-338 -302,-330
primary|Hobson Street|5|-170,-342 -175,-326
primary|Hobson Street|6|-167,-349 -170,-342
residential|Bradnor Lane|1|-183,-367 -164,-359
residential|Marmion Street||-63,631 -50,627
residential|Gore Street|3|379,-376 386,-401
residential|Gore Street|2|401,-445 405,-457
residential|||-299,781 -308,807
residential|||-28,-82 -2,-73
residential|||54,-147 29,-156
pedestrian|||-304,279 -287,294
pedestrian|||-117,-780 -130,-761
pedestrian|||-615,-636 -626,-640
pedestrian|||-743,-972 -745,-967
pedestrian|||-58,-315 -68,-296
pedestrian|||237,-542 217,-549
pedestrian|||-782,-427 -776,-425
pedestrian|||25,-865 7,-871
pedestrian|||110,-962 118,-959
pedestrian|||73,-850 81,-847
pedestrian|||276,-83 273,-95
residential|||8,-69 -2,-73
residential|||67,670 40,683
pedestrian|||-522,910 -516,899
pedestrian|||-510,888 -514,900`;

// Harbour surface: outer rings + holes (wharf islands), traced from the
// coastline and flood-filled offline so the water ends exactly at the quays.
const WATER = [{"p":[[-639,-1060],[57,-1060],[-40,-769],[-85,-784],[-77,-920],[-95,-928],[-75,-994],[-87,-992],[-107,-932],[-107,-918],[-112,-917],[-175,-942],[-151,-1012],[-152,-1021],[-163,-1020],[-187,-934],[-182,-927],[-170,-929],[-117,-906],[-127,-782],[-134,-779],[-214,-809],[-236,-809],[-247,-766],[-112,-721],[-109,-714],[-127,-664],[-254,-703],[-269,-702],[-284,-661],[-366,-685],[-464,-597],[-481,-596],[-529,-444],[-532,-439],[-558,-433],[-583,-438],[-529,-618],[-607,-644],[-583,-724],[-517,-706],[-469,-862],[-444,-861],[-441,-874],[-354,-969],[-242,-933],[-245,-908],[-240,-905],[-227,-906],[-213,-964],[-354,-1007],[-355,-998],[-350,-995],[-226,-955],[-229,-942],[-348,-981],[-362,-981],[-451,-884],[-451,-876],[-458,-875],[-527,-900],[-421,-1014],[-421,-1022],[-432,-1023],[-531,-914],[-540,-911],[-701,-966],[-682,-987],[-639,-988],[-639,-1060]],"h":[[[-352,-847],[-379,-822],[-374,-799],[-286,-777],[-274,-777],[-268,-783],[-251,-780],[-241,-804],[-244,-815],[-336,-847],[-352,-847]]]},{"p":[[161,-1060],[759,-1060],[759,-1016],[610,-571],[577,-584],[613,-696],[578,-709],[568,-709],[565,-704],[529,-588],[493,-600],[491,-632],[553,-820],[548,-839],[494,-857],[478,-857],[471,-850],[401,-632],[319,-658],[318,-669],[333,-670],[333,-726],[417,-978],[416,-989],[405,-984],[334,-767],[334,-1015],[231,-1010],[231,-742],[237,-740],[237,-716],[223,-712],[225,-686],[207,-690],[213,-718],[205,-722],[207,-760],[197,-764],[194,-797],[175,-794],[175,-762],[161,-760],[161,-748],[173,-722],[165,-718],[173,-686],[170,-677],[110,-697],[112,-719],[102,-719],[96,-711],[79,-718],[67,-744],[65,-766],[161,-1060]],"h":[]}];

// 60 x 74 heights on a 30 m grid from (-885,-1065), row-major by z then x,
// two base-36 chars per sample: decimetres above (elevation + 5 m).
const ELEV = { cols: 60, rows: 74, x0: -885, z0: -1065, step: 30, data: '1y24292d2f2d28231x1n0k0k0k0k0k0k0k0k0k0k0k0k0k0k0k0k0k0k0k0k0k0k1o1t1p0k0k0k0k0k0k0k0k0k0k0k0k0k0k0k0k0k0k0k0k0k0k0k0k0k24292d2h2g2b251y1o0k0k0k0k0k0k0k0k0k0k0k0k0k0k0k0k0k0k0k0k0k0k0k1u1y1s0k0k0k0k0k0k0k0k0k0k0k0k0k0k0k0k0k0k0k0k0k0k0k0k0k292e2i2k2f28201r0k0k0k0k0k0k0k1p1s1n0k0k0k0k0k0k0k0k0k0k0k0k0k0k1z201q0k0k0k0k0k0k0k0k0k0k0k0k0k0k0k0k0k0k0k0k1l1p0k0k0k2f2k2n2m2g261u0k0k0k0k0k0k0k0k1x1y1u1q1q1p0k0k0k0k0k0k0k0k0k0k1r231z0k0k0k0k0k0k1l1w1u1o0k0k0k0k0k0k0k0k0k0k0k1r1x1x1w1w2m2q2s2p2i281v1n0k0k0k0k0k0k1w1z1u0k0k0k0k1n1j0k0k0k0k0k0k0k0k1w251v0k0k0k0k0k0k1s1z1x0k0k0k0k0k0k0k0k0k0k0k0k1x212324232r2v2w2t2n2f27211w1r1p0k0k1v1z1v0k0k0k0k0k0k0k0k0k0k1o0k0k0k0k23241q0k0k0k0k0k0k1x221v0k0k0k0k0k0k0k0k0k0k0k1o21252728282u2y302y2u2n2g2a2622201y1y211w0k0k0k0k0k0k0k0k0k0k0k1u0k0k0k1s26220k0k0k0k0k0k1m21231r0k0k0k0k0k0k0k0k0k0k0k1t24292b2b2b2v303333302u2o2j2e2a2725231y0k0k0k0k0k0k0k0k0k0k0k0k1v0k0k0k20291x0k0k0k0k0k0k1s24210k0k0k0k0k0k0k0k0k0k0k0k1z282d2e2e2c2x31353634302v2q2l2f2a26211q0k0k0k0k1o1r1m0k0k0k0k0k1w0k0k0k292b1u0k0k0k0k0k0k1z261x0k0k0k0k1v1s0k0k0k0k0k1o232b2g2i2h2d2y33373836332y2t2n2f28231y0k0k0k0k0k1n1o1t1v1u1q0k0k220k0k1w2g2a0k0k0k0k0k0k1p26271s0k0k0k1q1y1r0k0k0k0k0k1u272f2j2l2k2g2z35393937332y2s2k2b231z1u0k0k0k0k0k0k0k0k0k1q1w20242a221z2a2m2a0k0k0k0k0k0k1w2c270k0k0k0k1v201p0k0k1q0k0k202a2i2m2o2o2j3135393937322x2q2h261t1o1o0k0k0k0k0k0k0k0k0k0k0k0k1t242g2k2p2s2d0k0k0k0k1j0k202g220k0k0k0k1z1y0k0k1o1q0k1q242e2l2p2s2r2m3236383937322w2p2f220k0k0k0k0k0k0k0k0k0k0k1n0k0k0k0k0k2f2u312y2k210k0k0k1u0k242h1x0k0k0k1r231u0k0k1u1m0k1v282i2p2t2v2t2n35383a3a38332w2n2c1w0k0k0k0k0k0k0k1q1r0k0k1u211v1s0k1y2k323c392y2m2e292726222j2k0k0k0k0k1y251p0k0k1z0k0k202c2m2u2y2y2v2o3a3c3d3d39342w2n2b1s0k0k0k0k0k0k1p23272622272f2g2c292j2y3e3o3o3g362x2t2r2q2s2y2q231p0k0k26260k0k1m1x0k1q252h2s3033332z2q3h3i3i3f3b352y2o2d231v1o0k0k0k1t252d2j2k2j2m2s2w2w2x353h3t40403v3m3g3c393939382y2j2923232g280k0k210k0k1x2c2q31373a39342w3p3o3l3h3c362z2r2h2a231t0k0k1t272g2o2v2x2z31363b3f3j3q3z474b4b46403v3s3q3p3n3h372w2o2k2o2t2k210k2c0k0k272m313b3f3h3f39333w3t3o3j3d37302s2k2c231n0k0k252j2t31373a3d3g3k3p3u40464d4j4m4l4h4c484543413x3o3f37312z3336302o2m2k25242k303d3k3n3o3k3f39413w3q3j3c36302s2k2b200k0k1o2e2t343d3j3n3q3u3y43484e4k4q4v4x4w4r4m4j4h4f4b443v3m3g3c3c3f3i3f38352y2u2v333g3q3u3v3u3q3l3g453y3q3j3c352y2q2h281v0k0k202m333g3p3v3z43474c4i4n4s4x53575857524x4u4s4p4k4b413s3o3n3o3r3t3t3q3m3j3h3j3p3x434544413w3r3n453x3q3j3c342w2o2f251r0k0k2b2v3e3s42484d4h4l4q4w52575b5g5j5j5i5e5955524x4q4g47403w3y414547484745444245494d4f4e4c47423y3v443w3p3i3b332v2o2f271v0k202o373r464f4m4r4v4z54595f5l5q5u5x5w5t5p5k5f5a534v4l4d4846494e4k4n4o4o4o4n4l4m4p4q4p4m4i4d474443433v3o3h39332x2r2k2h2h2m2w3b3s494m4u4z54585c5h5n5u61666a6b6864605u5n5g59504r4k4h4h4l4s4y5254545554525253524y4t4o4i4d4a4a423v3o3g3a35302w2v2x333e3r454j4w565b5e5h5m5q5v61686g6m6o6n6j6f6b645v5m5d544x4s4r4t4y555c5h5k5l5m5l5k5j5h5d564z4t4n4j4h4i433v3o3i3c383533363d3q474o525d5m5s5u5r5v6166686d6l6t6x6y6x6u6q6l6d625s5i59535153565d5k5r5w6062646462605v5l5c544y4t4q4q4r433w3q3k3g3c3a3c3h3s4a4y5l5z676d6g6b64696i6m6n6o6u70737473706y6t6k685x5m5f5b5b5e5l5t60676c6f6j6n6o6k6f655t5i59534z4y4y50453z3u3p3l3i3i3l3s464s5l6c6q6u6w6w6o6i6o6x7071727476787876736z6u6l6b605r5k5i5k5o5x686h6p6v6z747c7f756r6d605o5f5a5656575848433z3v3s3q3q3u434j57616q717576746z6y747a7d7f7f7f7f7d7a76716x6r6j69615u5p5p5s5x676k717i7r7v8189897p716j655t5l5g5e5e5f5g4d4946423z3y3z444e4u5i696t747a7c7b7b7e7j7n7q7s7r7p7m7h7a746z6u6o6h69635y5u5v5y646c6p7e8c8u8z94999183766m695y5r5m5m5m5n5n4k4g4d4a4847494f4o535o6b6u757c7h7k7o7t7y818484817w7r7j7a736x6r6m6g6a66616062656a6g6q7i8q9qa3a8a99m8e796o6c635w5u5u5v5v5t4r4n4l4i4h4g4i4o4x5a5s6d6u757e7l7s7z868b8e8g8e89827u7l7b726v6q6k6f6b686666696c6g6m6u7l8ya9b2bab4a58n7b6q6h6863616162605x4z4w4u4s4q4q4s4x555h5w6e6t747d7n7y888g8m8p8q8n8g877x7m7b716u6p6j6f6d6c6b6e6g6j6o6w7c859farbrc3btaq8y7c6r6k6f6c6a6968656159575553505052565d5n5z6e6r71797l808e8o8v8z908w8n8c807m7a6z6t6o6j6g6g6g6i6k6o6s717h8694a9bfc7cgcbbh9c7e6t6o6n6m6k6j6f6b665j5i5g5e5c5b5c5f5l5t636f6o6v757j818j8w949999948v8i837o796y6s6o6k6i6i6j6n6q6w777o8c94a3b4c0cfcjcebo9r7y756x6w6x6v6s6n6i6b5u5s5r5p5o5m5m5n5r5x676f6m6t757m878q949e9j9j9d938p897s7b6z6t6p6m6k6k6m6q6x7d808n9ba2axbscccjcjcdbrae8w7v7g7b7a77716t6l6d656462605z5x5v5u5x626b6k6t727g7y8k929g9p9u9t9m9a8u8e7w7f726u6q6n6m6n6p6u7b8b979tadb0boc8cickcjcbbrau9o8q867v7p7i786x6o6f6f6g6f6c6a66626163686g6p717h7x8g8z9g9ta1a5a39t9f8x8e7w7h746w6r6p6p6r6t6z7u9halb2bgbvc8cicmclcic8boaxa49d8t8e817o7b6z6p6i6o6r6r6o6k6e6a686a6f6m6x7c7v8f8y9g9va7aeagab9z9i8y8b7q7c726w6s6r6t6v727j8uasbvc3c9cfckcncocmchc6blaxaa9p968o867p7a6y6q6j6u6z716y6s6m6h6e6h6l6s757o898u9e9wabamarapaha39k8y887k746x6u6s6s6v737q8tabbvcgclcmcocqcqcpcmcgc3bjaxac9s998p857m766w6q6j6y7579756x6s6o6l6n6r6x7b7y8m999uadatb3b5axaka59k8v847f706v6t6s6t6y7e8g9vbbcacmcqcsctctcscqcmcfc0bgauaa9r978n827i726u6p6k707a7h7d736w6s6q6r6u707i888z9pacaxbfbpbmb6ana39h8s817d6z6v6t6t6u707o8xafbrcgcocrcucwcwcucqclccbwbbaqa69m938j7y7e6z6s6o6j747g7p7m7b716v6s6t6v737n8h9ca6awbibzc7c0bfaqa09b8m7w7b6z6v6u6u6w737t94albuchcocscvcycycvcrclc9bsb7ama19h8x8d7t7a6x6r6n6j797m7x7y7n7a706w6y727a7w8s9qalbebzcccgc6biao9t918d7q776y6v6u6v6x767z99ambtcgcocscvcycycwcsclc9brb6aj9x9c8r877n766w6r6m6i7f7t858b837p7b757c7n7v8f99a6b1bscacicgc3bdaf9h8m7y7g736x6v6v6w6y79839bakbncbclcrcvcycycwcscmccbub5ag9t978k7z7g726u6q6m6i7o838g8p8m8a7y7r7z8f8q959vapbhc3cgchcbbvb3a493877j766z6x6w6w6w6z7c859aagbfc3chcpctcxcycxctcncebub3ac9o918d7s796x6s6o6k6h7z8g8v9698938u8n8q979m9zalbbbycdciccbybgaq9s8s7u79706y6x6x6w6x717f8898a9b4bucdcmcrcvcxcwctcncdbub1a89g8s847j736u6q6m6i6g878s9a9n9xa09w9m9h9wafaubcbxccckckcdbvb5ae9i8j7n746y6y6y6y6y6z757m8d98a2avbocaclcqcucxcwcscncebuaza1968f7s7a6y6s6o6k6h6f8d919la3akawaxanabalb5bmc1cdclcocmcebub1a59a8c7i726y6z717374787h7z8m9ba0aqbhc3chcoctcwcwcscncebrau9u8v827g716u6q6m6j6g6e8j989vahb3blbtbkb6bbbtc8cicocrcqclc9bnau9z95887g716z727a7i7n7t838j929la5apb9bucccncscwcvcscmc9bjak9k8k7q766w6r6o6k6h6f6e8n9ba0asbjc3ccc8bzc2cecnctcwcvcqchc1bdam9u93897i74737c7p838e8m8w999na1aiazbebscacmcscvcucqcjc1b5a594867f6z6t6p6m6j6g6f6e8g969zawbscdclcmclcocuczd2d2cxcocbbsb5ag9s948e7q7b7d7r888o949h9sa0aaalaybfbuc3cdcmcrcuctcpcfbsar9n8m7q746v6s6o6l6j6g6g6f838v9oambocecoctcwd1d6dadad6cycoc8bnb1ae9t998o847q7t898r9a9uaeaqavb1b8bhbuc9chcjcmcqcscrcncbbjae97847c6y6t6q6n6l6k6i6h6h7s8j949rauc0chcrd0d7dedhdgdad0coc9bpb3ai9y9h908l8d8g8t9b9xambabpbsbtbyc3cbclcrcqcncocqcpcic0b39y8r7q736v6r6p6m6l6k6j6j6j7k858l909natbschcwd8dhdldkddd1coc9brb8apa79s9e9592949f9xakbbc1chclclcocqcucyd0cycrcncnclc8bdab99887e6y6u6r6p6m6l6l6n6o6o7b7q878s9namawbzcrd6dhdndodhd4crcdbxbhazaia59v9p9o9q9zafb3btchcyd6d8dbdddedddbd5cvcncicabja6938b7m736w6t6r6p6n6n6o6q6s6t737h8b9garbvc4bucld2dfdpdsdmdbczcmc8bsbbavajaca9a9acaiaubfc2cod7dldsdwdydxdsdkd8cwcic2bfa58m7r7d736w6u6s6q6o6o6p6s6u6y73727i8k9xbbcdcfbychcydedrdydudldacycjc2blb7azawawayb1b3b7blc6crdbdue8efegece1dld6cqc4b49w8i7h736y6v6s6r6r6p6p6q6s6u6y787n7d7t8wa9blcjcgc5cgczdidye7e6dxdld5cnc6bsbkbhbhbkbpbrbobkbrc7csdfe3enewewene5dkd1chbmac8w7m736y6w6t6r6q6r6r6s6s6t6w707g88898r9oatc1cycocacld7dvecelekeadrd5cmc7bzbxbyc0c8cjcjc7bxbxc9ctdneif4fdfaese4dgcuc6b99z8k7h726y6w6u6s6r6t6u6v6v6x737a7r8q9b9uamblcnded1ckcvdledevf2f1eodzd7clcac7cbcecjcydgddcrcac4cccydyf1ftg2fretdwd6cibtay9u8n7q786z6w6u6s6t6u6w7071747l818h9aa7anbdc8d6dwdld4dfe7f0flfsfqfaeddccncgclcwd4dadsede8decncccid8eiftgpgwg8eudlcsc4bfam9q8t807d706v6t6t6u6w70797f7d88929ja3awb9bxcqdmecebe3eef3fvghgpgmg3f1drcucsd6dne3eaepf9f5e7d6ckcpdqfbgphkhmgkeudbcdbqb2ab9k8s817e6z6v6u6v6w707b7z827n8s9zamb3bmbtced6e0erf2f4fig4gthehmhih0fwehd9dbdyegezfcfpg6g5fbe6d7ddetgehii0hugpetd2c2beaqa29d8o7z7e706w6x70757e7y8u8y8o9naubmc2cichczdqeif7fpg2gjh3hni3i9i6hsgrfae2e5ewfbfrgbgph3h7gqfwf5f6gdhji3i8hygwezd4c1baaj9v978k7x7d70717b7l7u8a8w9o9za2awbuchcwdodjdyenfaftgagrh9hri6iiimiki8hcg0f0fafzgagjh4hlhwi2hyhmh8h7hoi7iei8hqgpf5dhc6b9ag9r968j7w7b707a808n929h9zalb0bcc3crd8dlf1ezfaftgagjgthahri6ijitixiuiihrgqg6ghh2hbhehti9iiimioiligieihilihi1h6fzeld6byb3ag9x9d8s817c747m8p9radasb6bmbzcdcxdgdve8ghghgngyh5h7hdhqi5iiitj2j7j4isi8hlhchjhwi1i4ieiqizj3j5j5j1iyiviqifhpggf2dpcibkb0auaf9y9h8k7m7d859eambic1cccmcwd5djdyeeethphqhshshrhqhui4igirj1j9jcj9j1ipidi8i8ibifimivj5jejijjjijdj5iwimi4h3fke3cvbzbebhbmb5arai9h8e858ya6bhcfczdbdjdpdue3ehexfeijiiiei7i1i1i5idiniuj0j3j3j2izivipikihigilivj6jhjpjtjujqjgj3iqibhhfue8d2c9bqbqc0c5bpbpbkai9g9ca2b1ccdddwe6edehelerf0fffyj2ixinibi4i4i8ifijilininimililikihieiciciiitj6jijrjwjxjrjgj1ilhwgdebczcdc0c0c9chcccacmcfbiajakbhc9ddegf1fafcfcfefifofyggjgj7itiei5i4i7ibibiaiai9i8i8i8i7i6i5i5i6iaijivj7jjjsjrjmjciyihhjffdbcic8cacjcwczcscydbd6cfbnbsctdsenfngbgigeg9g9gbgeglgzjqjgj1iji7i3i4i5i5i4i4i4i4i3i3i3i3i3i3i3i5iaiiivjajkjhjaj1ini5gxejcwchclcud7dkdndjdodydtd8cpd1dyeyfxgthfhihch4h1h1h3h7hhjtjkj5imi8i3i2i3i3i3i4i4i4i3i3i3i3i3i3i3i3i4iaioj5jdj6iwijhzgxexd8cocydddue6edegefeieneje4dveaf3g0gvhlhxhyhvhphkhihjhkhsjqjhj2iki7i3i2i3i3i3i3i3i3i2i2i3i3i3i4i6i6i7ibioj3j7iyiihrgdefcwcsd8dwelf5fgfhfefcfefjfjfcf7fjgah1hkhxi2i1hwhmhah4h5hehs' };

const TAU = Math.PI * 2;

// carriageway width by class, metres — used only when OSM gave no lane count
const CLASS_WIDTHS = {
    motorway: 11, trunk: 11, primary: 13, secondary: 11, tertiary: 9,
    unclassified: 7.5, residential: 7, living_street: 5.5, pedestrian: 4.2,
};
const LANE_W = 3.2;      // one marked lane
const VERGE = 1.6;       // kerbs and parking margin, split across both sides

export default function build(world) {
    const { THREE, scene } = world;

    // ------------------------------------------------------- terrain sampler
    const EH = new Float32Array(ELEV.cols * ELEV.rows);
    for (let i = 0; i < EH.length; i++) {
        EH[i] = parseInt(ELEV.data.slice(i * 2, i * 2 + 2), 36) / 10 - 5;
    }
    // Height on the terrain MESH — the same piecewise-linear surface the
    // terrain triangles draw (each grid cell split on its b–c diagonal), so a
    // road sampled here lies exactly on the ground it crosses.
    function rawH(x, z) {
        const fx = Math.min(ELEV.cols - 1.001, Math.max(0, (x - ELEV.x0) / ELEV.step));
        const fz = Math.min(ELEV.rows - 1.001, Math.max(0, (z - ELEV.z0) / ELEV.step));
        const ix = Math.floor(fx), iz = Math.floor(fz);
        const u = fx - ix, v = fz - iz;
        const a = EH[iz * ELEV.cols + ix], b = EH[iz * ELEV.cols + ix + 1];
        const c = EH[(iz + 1) * ELEV.cols + ix], d = EH[(iz + 1) * ELEV.cols + ix + 1];
        if (u + v <= 1) return a + u * (b - a) + v * (c - a);
        return b * (1 - v) + c * (1 - u) + d * (u + v - 1);
    }
    // what roads and labels stand on: never below wharf-deck height
    const gY = (x, z) => Math.max(rawH(x, z), 0.35);

    function inRing(x, z, ring) {
        let inside = false;
        for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
            const xi = ring[i][0], zi = ring[i][1], xj = ring[j][0], zj = ring[j][1];
            if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
        }
        return inside;
    }
    function inWater(x, z) {
        for (const w of WATER) {
            if (inRing(x, z, w.p)) {
                let inHole = false;
                for (const h of w.h) if (inRing(x, z, h)) { inHole = true; break; }
                if (!inHole) return true;
            }
        }
        return false;
    }

    // ------------------------------------------------------------- sky
    world.ownsSky(true);
    const sunDir = new THREE.Vector3(0.33, 0.52, -0.62).normalize(); // north, over the harbour
    const sky = new THREE.Mesh(
        new THREE.SphereGeometry(2400, 24, 12),
        new THREE.ShaderMaterial({
            side: THREE.BackSide,
            depthWrite: false,
            uniforms: { uSun: { value: sunDir } },
            vertexShader: `
                varying vec3 vDir;
                void main() {
                    vDir = normalize(position);
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }`,
            fragmentShader: `
                uniform vec3 uSun;
                varying vec3 vDir;
                void main() {
                    float h = clamp(vDir.y, 0.0, 1.0);
                    vec3 col = mix(vec3(0.878, 0.914, 0.933), vec3(0.663, 0.784, 0.869), smoothstep(0.0, 0.28, h));
                    col = mix(col, vec3(0.369, 0.576, 0.722), smoothstep(0.22, 0.85, h));
                    float s = max(dot(vDir, uSun), 0.0);
                    col += vec3(1.0, 0.95, 0.82) * pow(s, 420.0) * 0.9;   // disc
                    col += vec3(1.0, 0.9, 0.7) * pow(s, 14.0) * 0.16;     // halo
                    gl_FragColor = vec4(col, 1.0);
                }`,
        })
    );
    world.ghost(sky);
    scene.add(sky);

    // ------------------------------------------------------------- light
    scene.add(new THREE.HemisphereLight(0xd3e4ee, 0x9aa08c, 0.95));
    const sun = new THREE.DirectionalLight(0xfff3e0, 1.3);
    sun.position.copy(sunDir).multiplyScalar(600);
    scene.add(sun);

    // ------------------------------------------------------------- terrain
    // The whole table the map sits on. x −880..880, z −1060..1120, displaced
    // by the DEM; pushed down to a shallow seabed wherever the harbour lies.
    let landTex = null;
    try {
        landTex = world.canvasTexture(512, 512, (ctx) => {
            ctx.fillStyle = '#b3bda1';
            ctx.fillRect(0, 0, 512, 512);
            for (let i = 0; i < 900; i++) {
                const x = Math.random() * 512, y = Math.random() * 512;
                const r = 4 + Math.random() * 22;
                const g = ctx.createRadialGradient(x, y, 0, x, y, r);
                const tone = Math.random();
                const c = tone < 0.55 ? '166,178,146' : (tone < 0.85 ? '182,188,158' : '173,176,138');
                g.addColorStop(0, `rgba(${c},0.16)`);
                g.addColorStop(1, `rgba(${c},0)`);
                ctx.fillStyle = g;
                ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
            }
        });
        landTex.wrapS = landTex.wrapT = THREE.RepeatWrapping;
        landTex.repeat.set(5, 6);
    } catch (e) { /* headless check: plain colour is fine */ }
    // Built straight on the DEM grid, one vertex per sample, cells split on
    // the b–c diagonal to match rawH above.
    const terrainGeo = new THREE.BufferGeometry();
    {
        const { cols, rows, x0, z0, step } = ELEV;
        const tpos = new Float32Array(cols * rows * 3);
        const tuv = new Float32Array(cols * rows * 2);
        for (let j = 0; j < rows; j++) {
            for (let i = 0; i < cols; i++) {
                const k = j * cols + i;
                const x = x0 + i * step, z = z0 + j * step;
                tpos[k * 3] = x;
                tpos[k * 3 + 1] = inWater(x, z) ? Math.min(EH[k], -1.4) : Math.max(EH[k], 0.25);
                tpos[k * 3 + 2] = z;
                tuv[k * 2] = i / (cols - 1);
                tuv[k * 2 + 1] = j / (rows - 1);
            }
        }
        const idx = [];
        for (let j = 0; j < rows - 1; j++) {
            for (let i = 0; i < cols - 1; i++) {
                const a = j * cols + i, b = a + 1, c = a + cols, d = c + 1;
                idx.push(a, c, b, b, c, d);
            }
        }
        terrainGeo.setAttribute('position', new THREE.BufferAttribute(tpos, 3));
        terrainGeo.setAttribute('uv', new THREE.BufferAttribute(tuv, 2));
        terrainGeo.setIndex(idx);
        terrainGeo.computeVertexNormals();
    }
    const land = new THREE.Mesh(
        terrainGeo,
        new THREE.MeshLambertMaterial({ color: 0xb6c0a5, map: landTex || null })
    );
    world.ground(land);
    scene.add(land);

    // ------------------------------------------------------------- water
    const waterShapes = WATER.map((w) => {
        const shape = new THREE.Shape(w.p.map(([x, z]) => new THREE.Vector2(x, z)));
        for (const h of w.h) shape.holes.push(new THREE.Path(h.map(([x, z]) => new THREE.Vector2(x, z))));
        return shape;
    });
    const waterGeo = new THREE.ShapeGeometry(waterShapes, 1);
    waterGeo.rotateX(Math.PI / 2); // (x, y) -> (x, 0, y)
    const waterMat = new THREE.ShaderMaterial({
        side: THREE.DoubleSide,
        uniforms: { uTime: { value: 0 } },
        vertexShader: `
            varying vec2 vXZ;
            void main() {
                vXZ = vec2(position.x, position.z);
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }`,
        fragmentShader: `
            uniform float uTime;
            varying vec2 vXZ;
            float n2(vec2 p) {
                return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
            }
            void main() {
                vec2 p = vXZ * 0.055;
                float t = uTime * 0.55;
                float w = sin(p.x * 1.7 + t) * 0.5 + sin(p.y * 2.3 - t * 1.3) * 0.5
                        + sin((p.x + p.y) * 1.1 + t * 0.7) * 0.5;
                w = w * 0.33 + 0.5;
                vec3 deep = vec3(0.110, 0.353, 0.459);
                vec3 lift = vec3(0.204, 0.478, 0.573);
                vec3 col = mix(deep, lift, w * 0.55);
                vec2 g = vXZ * 0.9;
                float sp = n2(floor(g + vec2(t * 2.0, -t * 1.4)));
                col += vec3(0.75, 0.85, 0.9) * step(0.992, sp) * 0.5;
                gl_FragColor = vec4(col, 1.0);
            }`,
    });
    const water = new THREE.Mesh(waterGeo, waterMat);
    water.position.y = 0.05;    // sea level
    world.ground(water);
    scene.add(water);

    // ------------------------------------------------------------- roads
    const ways = [];
    for (const line of ROADS.split('\n')) {
        if (!line) continue;
        const bar1 = line.indexOf('|'), bar2 = line.indexOf('|', bar1 + 1), bar3 = line.indexOf('|', bar2 + 1);
        const kind = line.slice(0, bar1);
        const name = line.slice(bar1 + 1, bar2);
        const lanes = +(line.slice(bar2 + 1, bar3) || 0);
        const pts = line.slice(bar3 + 1).split(' ').map((p) => {
            const c = p.indexOf(',');
            return [+p.slice(0, c), +p.slice(c + 1)];
        });
        ways.push({ kind, name, lanes, pts });
    }

    // The tagged lane count decides the width whenever OSM has one; the class
    // default only stands in for untagged streets.
    function widthOf(w) {
        if (w.lanes > 0) return Math.min(26, Math.max(4.6, w.lanes * LANE_W + VERGE));
        if (w.kind.endsWith('_link')) return 6.5;
        return CLASS_WIDTHS[w.kind] || 6.5;
    }

    // split long segments so the ribbon follows the hills
    function subdivide(pts, maxStep) {
        const out = [pts[0]];
        for (let i = 1; i < pts.length; i++) {
            const a = pts[i - 1], b = pts[i];
            const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
            const n = Math.max(1, Math.ceil(len / maxStep));
            for (let s = 1; s <= n; s++) {
                out.push([a[0] + ((b[0] - a[0]) * s) / n, a[1] + ((b[1] - a[1]) * s) / n]);
            }
        }
        return out;
    }

    const COS8 = [], SIN8 = [];
    for (let s = 0; s <= 8; s++) { COS8.push(Math.cos((s / 8) * TAU)); SIN8.push(Math.sin((s / 8) * TAU)); }

    function ribbon(arr, pts, half, lift) {
        const n = pts.length;
        for (let i = 0; i < n; i++) {
            const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
            let dx = b[0] - a[0], dz = b[1] - a[1];
            const len = Math.hypot(dx, dz) || 1;
            dx /= len; dz /= len;
            const p = pts[i];
            p.lx = p[0] - dz * half; p.lz = p[1] + dx * half;
            p.rx = p[0] + dz * half; p.rz = p[1] - dx * half;
            // each edge takes the ground under IT, so a road along a hillside
            // twists with the cross-slope instead of digging in
            p.ly = gY(p.lx, p.lz) + lift;
            p.ry = gY(p.rx, p.rz) + lift;
        }
        for (let i = 1; i < n; i++) {
            const p = pts[i - 1], q = pts[i];
            arr.push(p.lx, p.ly, p.lz, p.rx, p.ry, p.rz, q.rx, q.ry, q.rz,
                     p.lx, p.ly, p.lz, q.rx, q.ry, q.rz, q.lx, q.ly, q.lz);
        }
    }
    function disc(arr, x, z, r, lift) {
        const cy = gY(x, z) + lift;
        for (let s = 0; s < 8; s++) {
            const ax = x + COS8[s] * r, az = z + SIN8[s] * r;
            const bx = x + COS8[s + 1] * r, bz = z + SIN8[s + 1] * r;
            arr.push(x, cy, z,
                ax, gY(ax, az) + lift, az,
                bx, gY(bx, bz) + lift, bz);
        }
    }
    // a painted stripe from (x0,z0) to (x1,z1), draped corner by corner
    function stripe(arr, x0, z0, x1, z1, halfW, lift) {
        const len = Math.hypot(x1 - x0, z1 - z0) || 1;
        const nx = (-(z1 - z0) / len) * halfW, nz = ((x1 - x0) / len) * halfW;
        const c = [
            [x0 + nx, z0 + nz], [x0 - nx, z0 - nz],
            [x1 - nx, z1 - nz], [x1 + nx, z1 + nz],
        ].map(([x, z]) => [x, gY(x, z) + lift, z]);
        arr.push(...c[0], ...c[1], ...c[2], ...c[0], ...c[2], ...c[3]);
    }

    const asphalt = [];   // vehicular
    const paving = [];    // pedestrian streets, shared lanes
    const marks = [];     // painted lines
    for (const w of ways) {
        const walkway = w.kind === 'pedestrian' || w.kind === 'living_street';
        const arr = walkway ? paving : asphalt;
        const width = widthOf(w);
        const half = width / 2;
        const lift = walkway ? 0.1 : 0.12;
        const sub = subdivide(w.pts, 10);
        ribbon(arr, sub, half, lift);
        for (const p of w.pts) disc(arr, p[0], p[1], half, lift);

        if (walkway) continue;

        // Painted lane dividers: one dashed line between each pair of lanes
        // when OSM tagged the count; main streets without a count are assumed
        // two-lane and get the single centre dash.
        let lanes = w.lanes;
        if (!lanes && (w.kind === 'primary' || w.kind === 'secondary' || w.kind === 'tertiary')) lanes = 2;
        if (lanes >= 2) {
            const usable = width - VERGE, laneW = usable / lanes;
            for (let j = 1; j < lanes; j++) {
                const off = -usable / 2 + j * laneW;
                let carry = 4;
                for (let i = 1; i < sub.length; i++) {
                    const p = sub[i - 1], q = sub[i];
                    const segLen = Math.hypot(q[0] - p[0], q[1] - p[1]);
                    if (segLen < 0.01) continue;
                    const dx = (q[0] - p[0]) / segLen, dz = (q[1] - p[1]) / segLen;
                    const ox = -dz * off, oz = dx * off;
                    let d = carry;
                    while (d + 3.2 < segLen) {
                        stripe(marks,
                            p[0] + dx * d + ox, p[1] + dz * d + oz,
                            p[0] + dx * (d + 3.2) + ox, p[1] + dz * (d + 3.2) + oz,
                            0.14, 0.24);
                        d += 13;
                    }
                    carry = d - segLen;
                }
            }
        }
        // solid edge lines on the motorways
        if (w.kind === 'motorway' || w.kind === 'trunk') {
            for (let i = 1; i < sub.length; i++) {
                const p = sub[i - 1], q = sub[i];
                const segLen = Math.hypot(q[0] - p[0], q[1] - p[1]);
                if (segLen < 2) continue;
                const dx = (q[0] - p[0]) / segLen, dz = (q[1] - p[1]) / segLen;
                for (const sgn of [1, -1]) {
                    const off = sgn * (half - 0.55);
                    stripe(marks,
                        p[0] - dz * off, p[1] + dx * off,
                        q[0] - dz * off, q[1] + dx * off,
                        0.15, 0.24);
                }
            }
        }
    }

    function flatMesh(arr, material) {
        const geo = new THREE.BufferGeometry();
        const pos = new Float32Array(arr);
        geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        const nor = new Float32Array(pos.length);
        for (let i = 0; i < nor.length; i += 3) nor[i + 1] = 1;
        geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
        return new THREE.Mesh(geo, material);
    }

    const asphaltMesh = flatMesh(asphalt, new THREE.MeshLambertMaterial({ color: 0x3a3d43, side: THREE.DoubleSide }));
    scene.add(asphaltMesh);

    const pavingMesh = flatMesh(paving, new THREE.MeshLambertMaterial({ color: 0x8a8073, side: THREE.DoubleSide }));
    scene.add(pavingMesh);

    const marksMesh = flatMesh(marks, new THREE.MeshBasicMaterial({ color: 0xf2eedd, side: THREE.DoubleSide }));
    world.ghost(marksMesh); // paint, not a thing the walk should rasterise
    scene.add(marksMesh);

    // ------------------------------------------------------------- names
    const LABELS = [
        ['QUEEN STREET', [76, -24], [-37, 313], 13],
        ['KARANGAHAPE ROAD', [-634, 979], [-220, 987], 13],
        ['QUAY STREET', [124, -668], [577, -522], 12],
        ['CUSTOMS STREET', [-40, -560], [437, -397], 10],
        ['FANSHAWE STREET', [-658, -324], [-184, -470], 12],
        ['HOBSON STREET', [-236, -157], [-410, 296], 11],
        ['NELSON STREET', [-427, -51], [-588, 410], 11],
        ['ALBERT STREET', [-31, -219], [-139, 102], 9],
        ['VICTORIA STREET', [-252, -112], [70, 0], 9],
        ['WELLESLEY STREET', [-326, 93], [124, 276], 9],
        ['MAYORAL DRIVE', [-204, 552], [94, 427], 9],
        ['SYMONDS STREET', [150, 773], [361, 521], 12],
        ['BEACH ROAD', [567, -382], [800, -202], 10],
        ['ANZAC AVENUE', [638, -307], [803, 19], 9],
        ['JELLICOE STREET', [-758, -927], [-557, -858], 8],
        ['WAITEMATĀ HARBOUR', [-150, -940], [420, -1010], 26],
    ];
    try {
        const pad = 8, rowH = 64;
        const entries = [];
        const atlas = world.canvasTexture(1024, 1024, (ctx) => {
            ctx.clearRect(0, 0, 1024, 1024);
            let cx = pad, cy = 0;
            for (const L of LABELS) {
                const harbour = L[0].indexOf('HARBOUR') >= 0;
                ctx.font = harbour ? 'italic 40px Georgia, serif' : 'bold 44px Helvetica, Arial, sans-serif';
                const wpx = Math.min(1000, ctx.measureText(L[0]).width);
                if (cx + wpx + pad > 1024) { cx = pad; cy += rowH; }
                ctx.fillStyle = harbour ? 'rgba(224,240,248,0.92)' : 'rgba(46,48,42,0.85)';
                ctx.textBaseline = 'middle';
                ctx.fillText(L[0], cx, cy + rowH / 2);
                entries.push({ L, u0: cx / 1024, v0: cy / 1024, u1: (cx + wpx) / 1024, v1: (cy + rowH) / 1024, aspect: wpx / rowH });
                cx += wpx + 3 * pad;
            }
        });
        const lpos = [], luv = [];
        for (const e of entries) {
            const [, p0, p1, size] = e.L;
            const mx = (p0[0] + p1[0]) / 2, mz = (p0[1] + p1[1]) / 2;
            let ang = Math.atan2(-(p1[1] - p0[1]), p1[0] - p0[0]);
            if (ang > Math.PI / 2) ang -= Math.PI;
            if (ang < -Math.PI / 2) ang += Math.PI;
            const ca = Math.cos(ang), sa = Math.sin(ang);
            const hl = (size * e.aspect) / 2, hh = size / 2;
            const corner = (dx, dz) => {
                const x = mx + dx * ca + dz * sa, z = mz - dx * sa + dz * ca;
                return [x, gY(x, z) + 0.45, z];
            };
            const c0 = corner(-hl, -hh), c1 = corner(hl, -hh), c2 = corner(hl, hh), c3 = corner(-hl, hh);
            lpos.push(...c0, ...c1, ...c2, ...c0, ...c2, ...c3);
            luv.push(e.u0, e.v1, e.u1, e.v1, e.u1, e.v0,
                     e.u0, e.v1, e.u1, e.v0, e.u0, e.v0);
        }
        const lgeo = new THREE.BufferGeometry();
        lgeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(lpos), 3));
        lgeo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(luv), 2));
        const labels = new THREE.Mesh(lgeo, new THREE.MeshBasicMaterial({
            map: atlas, transparent: true, depthWrite: false, side: THREE.DoubleSide,
        }));
        world.ghost(labels);
        scene.add(labels);
    } catch (e) { /* labels are a nicety; the roads are the world */ }

    // ------------------------------------------------------- buildings
    // Queen Street's buildings, hosted as a module (Flinders & Swanston pattern).
    // The shim hands the module a groundAt() so each footprint plants on the
    // real terrain slope; parts are prefixed so edit mode sees each building.
    try {
        let bn = 0;
        const shim = {
            THREE, scene, renderer: world.renderer, camera: world.camera,
            groundAt: (x, z) => gY(x, z),
            part: (name, o) => (o && o.isObject3D ? world.part(name, o) : o),
            ground: (o) => o,
            ghost: (o) => world.ghost(o),
            frame: (cb) => world.frame(cb),
            canvasTexture: (w, h, d) => world.canvasTexture(w, h, d),
            ownsSky: () => {}, groundLevel: () => {}, bloom: () => {},
        };
        buildQueenBuildings(shim);
    } catch (e) { /* massing is additive; never take the world down with it */ }

    // ------------------------------------------------------------- done
    world.groundLevel(gY(76, -24) + 0.2);   // Queen & Victoria, up in the valley
    world.frame((dt, t) => {
        waterMat.uniforms.uTime.value = t;
    });
}
