//
//  auckland-cbd.scene.js
//
//  The real street network of central Auckland, laid flat — nothing but the
//  roads, the harbour they run down to, and the names painted on the tarmac
//  like a map you can stand on. Queen Street runs up its valley from the
//  ferry wharves to Karangahape Road; the motorway junction wraps the whole
//  grid in its knot of ramps at the southern edge.
//
//  Geometry traced from OpenStreetMap (© OpenStreetMap contributors, ODbL).
//  Coordinates are metres from a point mid-town: x east, z south, y up.
//

// kind|name|lanes|x,z x,z ...   (one carriageway per line, ints, metres)
const ROADS = `residential|Cross Street||-317,1062 -467,1056
secondary|Customs Street East|6|503,-384 452,-392
living_street|Fort Street|1|487,-355 472,-318 369,-305
tertiary|Shortland Street|2|529,-209 472,-228 428,-220 398,-220 321,-230
secondary|Waterloo Quadrant|4|541,-33 504,-65
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
residential|City Road||9,913 -132,867
residential|Saint Paul Street||116,533 295,558
living_street|Alfred Street|1|359,256 474,299
residential|Parliament Street|1|734,12 645,40
residential|Short Street|2|601,-158 684,-202
residential|Eden Crescent||734,12 717,-45 711,-53 645,-108 614,-141 576,-192 562,-200 529,-209
residential|Emily Place||562,-275 578,-214 579,-189
secondary|Beach Road|6|567,-382 635,-362
secondary|Halsey Street|5|-721,-137 -719,-169
motorway_link||2|420,788 330,957 273,1049
motorway_link||1|428,818 292,1031 273,1049
motorway_link||1|136,1086 357,749
motorway_link||1|531,559 517,570 514,582 518,595 528,604 538,606 548,604 635,555
motorway_link||1|190,1087 227,1003 296,870 361,761
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
residential|Beresford Square||-647,821 -601,849
residential|Day Street||-601,849 -612,861 -688,891
secondary|Kitchener Street|2|156,178 199,62 200,45
pedestrian|Vulcan Lane||130,-221 195,-200
residential|Durham Street West||90,-86 13,-114
residential|Durham Lane||29,-157 12,-111
pedestrian|Freyberg Place||192,-149 226,-140
residential|Courthouse Lane||239,-95 270,-51
residential|Fields Lane|2|312,-147 321,-230
residential|Bacon's Lane||312,-147 308,-95 310,-74
residential|Chancery Street|1|291,-145 259,-142
living_street|Jean Batten Place||212,-287 223,-327 228,-333
living_street|Fort Lane||228,-333 256,-438
residential|Gore Street|2|359,-303 359,-315 379,-376
residential|Tyler Street|1|425,-522 563,-478
residential|Wolfe Street|1|-116,-486 -54,-464
residential|Swanson Street|2|-151,-392 -108,-377
residential|Bradnor Lane|1|-252,-396 -183,-367
residential|Customs Street West|2|-411,-444 -401,-395
residential|Market Place||-282,-472 -274,-487 -232,-613 -234,-624
residential|Pakenham Street East|1|-282,-472 -236,-462
residential|Viaduct Harbour Avenue|3|-687,-457 -647,-443
residential|Dock Street||-646,-100 -665,-204
residential|Hardinge Street||-557,-240 -561,-229 -544,-148
residential|Graham Street||-467,-136 -460,-230 -470,-254
residential|Kingston Street||-220,-200 -166,-182
living_street|Federal Street||-84,-337 -69,-364
residential|Pakenham Street West||-823,-650 -642,-590
tertiary|Jellicoe Street|2|-557,-858 -758,-927
residential|Nicholas Street||-473,416 -525,387 -506,344 -557,324
residential|Morton Street||-719,183 -698,119 -681,113 -653,118
secondary_link||2|-736,-53 -753,-75
residential|Vernon Street||-762,-57 -745,22
residential|Adelaide Street||-816,-46 -793,52
secondary|Sam Wrigley Street|1|-716,193 -741,191 -770,216
secondary|Alten Road|3|777,215 791,264 786,315 788,338
secondary|Wellesley Street East|1|256,431 235,405
secondary|Wellesley Street West|2|-724,-84 -724,-62 -708,-46
unclassified|Wakefield Street|1|-22,388 -50,354
residential|Airedale Street||1,588 -1,595 84,777
residential|Emily Place|1|503,-384 502,-370 574,-342 578,-326 573,-311
motorway_link||1|452,864 453,830 450,820 444,816 428,818
residential|Scotia Place|2|-268,821 -225,836
secondary|Hopetoun Street|4|-570,739 -519,683
tertiary|Daldy Street||-797,-809 -821,-735
tertiary|Daldy Street|2|-758,-927 -797,-809
secondary|Sam Wrigley Street|1|-782,161 -768,175 -762,188 -770,216
secondary|Karangahape Road|4|-785,1037 -723,1013
residential|Lower Domain Drive|1|671,596 702,614
living_street|Gore Street Lane||383,-364 479,-333
pedestrian|Swanson Street||134,-291 83,-309
residential|Mills Lane||57,-248 79,-312
residential|Mills Lane||110,-407 103,-413 46,-431
pedestrian|Exchange Lane||107,-368 150,-352
living_street|O'Connell Street|1|231,-149 249,-241
residential|Wyndham Street|4|-189,-288 -151,-274
residential|Federal Street|1|-54,-408 -42,-442
residential|Lorne Street|1|129,61 75,214 74,233
living_street|Lorne Street||33,339 64,247
residential|Durham Lane||-28,-82 -2,-73
residential|Durham Lane||-11,-171 54,-147
residential|Bowen Lane||368,41 399,-40
trunk_link|Stanley Street|1|778,461 754,495 703,539 692,553
pedestrian|Bledisloe Lane||-88,185 -130,307
residential|Market Lane||-226,-468 -181,-607
residential|High Street|1|187,-151 153,-1
residential|Pakenham Street East|2|-282,-472 -380,-505
residential|Scene Lane||675,-416 666,-422 587,-446
residential|West Terrace||-698,1071 -722,1012
residential|Poynton Terrace||-497,862 -428,853 -423,859 -417,895 -410,905
motorway_link||2|-524,635 -540,599 -546,593 -561,591 -575,594
motorway_link||1|136,1086 269,905
secondary|Grafton Road|1|520,322 536,334 544,360
residential|Kāri Street|2|499,992 469,1000 443,1002 405,987
residential|Moehau Street||322,1025 371,1062
residential|Tennis Lane||738,521 700,562 684,603
secondary|Grafton Road|2|456,852 462,827
secondary|Grafton Road|2|565,637 559,579
secondary|Grafton Road|2|570,721 523,767
residential|Rutland Street||112,382 102,346 91,340
residential|Rutland Street||91,340 46,347
pedestrian|Wynyard Street||592,396 569,421 556,422
pedestrian|||822,-273 787,-285
pedestrian|Quba Square||845,-354 820,-362 812,-358 795,-363
residential|Princes Wharf|2|-15,-748 7,-763 23,-791 104,-1043
secondary|Customs Street West|3|-118,-531 -71,-553
secondary|Customs Street West|2|-71,-579 -40,-560
tertiary|Princes Street|3|510,-155 494,-111
secondary|Hopetoun Street|2|-828,921 -731,889 -674,850
secondary|Wellesley Street East|2|214,386 179,348
unclassified|Kitchener Street|2|200,45 213,17
secondary|Bowen Avenue|1|200,45 219,27
living_street|Federal Street||-304,279 -299,278 -295,270 -262,180
secondary|Quay Street|2|255,-627 173,-653
pedestrian|Queen Street||198,-495 231,-588 257,-621
pedestrian|Tyler Street||231,-588 265,-576
living_street|Galway Street|1|529,-423 453,-448
secondary_link||1|676,164 687,137 688,117
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
residential|Quay Street|2|-80,-729 -45,-719
unclassified|Princes Street|2|391,169 359,256
motorway_link||1|466,793 428,818
pedestrian|||304,-126 281,-115
pedestrian|Chancery Square||273,-95 257,-116
tertiary|Albert Street|4|-78,-90 -59,-141
residential|Market Lane||-197,-559 -134,-538 -125,-526
residential|Tinley Street|4|828,-484 816,-448
residential|Albert Street||-48,-135 -64,-94 -70,-89 -78,-90
secondary_link||1|-523,639 -513,654 -508,656 -496,651
secondary|Alten Road|3|792,347 827,379
motorway_link||1|748,475 807,389 810,374
motorway_link||2|-575,594 -637,651
motorway_link||1|-731,1079 -781,971 -793,893
motorway_link||1|-697,789 -729,845 -746,883 -760,929
residential|Commerce Street|3|301,-428 293,-404
tertiary|Gaunt Street|3|-687,-457 -722,-468
secondary|Halsey Street|2|-680,-474 -668,-513
residential|Nelson Street||-628,522 -630,509 -622,468 -555,280
secondary|Wellesley Street West|5|-326,93 -286,108
motorway_link||1|-654,559 -683,512
secondary|Union Street|4|-580,539 -547,555
secondary|Pitt Street|3|-530,604 -539,582 -554,566
secondary_link||2|-715,457 -747,439
motorway_link||1|-758,1063 -785,1000
secondary_link||1|577,652 591,664 612,667
motorway|Northwestern Motorway|2|778,461 730,509 632,571
secondary|Mayoral Drive|5|-176,563 -149,567
secondary|Symonds Street|4|150,773 169,753
tertiary|Queen Street|4|-37,313 -14,248
secondary_link|Princes Street|1|289,376 269,405 270,422
secondary|Wellesley Street East|3|471,739 475,783
secondary|Wellesley Street East|1|253,414 327,524
secondary|Wellesley Street East|3|441,679 460,711
secondary|Wellesley Street East|2|400,641 346,565
secondary_link|Wellesley Street East|1|308,476 335,518 346,526 357,527
motorway_link||1|437,749 396,803
secondary_link|Grafton Road|1|551,727 571,700 578,683
secondary|Grafton Road|2|577,652 597,684
secondary|Grafton Road|2|558,548 568,575
secondary_link|Grafton Road|1|523,767 515,777 492,791 475,807
secondary|Grafton Road|2|559,579 558,548
secondary_link||1|471,739 486,767 497,772
secondary|Grafton Road|2|568,575 573,630
secondary|Grafton Road|3|386,1038 371,1062
motorway_link||2|-729,701 -676,626
motorway|Auckland Southern Motorway|2|-724,1079 -770,963 -783,892
motorway|Auckland Southern Motorway|3|-729,888 -738,917 -741,983 -731,1026 -706,1080
motorway|Auckland Northern Motorway|3|-787,452 -840,371
secondary_link||1|93,838 103,797
secondary|Pitt Street|2|-525,585 -524,635
secondary|Fanshawe Street|4|-19,-523 -72,-511
secondary|Tangihua Street|2|818,-438 810,-409
secondary|Wellesley Street West|5|-162,152 -104,173
secondary|Wellesley Street East|2|124,276 233,393
secondary|Union Street|2|-633,533 -674,519 -698,494
pedestrian|Wynyard Crossing Bridge||-345,-834 -446,-867
pedestrian|North Wharf Promenade||-836,-997 -521,-894
pedestrian|||-643,-933 -656,-893
pedestrian|||-599,-919 -612,-878
secondary|Symonds Street|4|499,349 520,322
secondary|Grafton Road|1|544,360 550,439 548,454
secondary_link||1|465,-33 461,-54 456,-60
secondary|Bowen Avenue|1|233,24 209,44 200,45
secondary|Bowen Avenue|2|233,24 431,-51
residential|Wakefield Street|2|-22,388 29,495
motorway|Auckland Southern Motorway|2|-834,359 -715,535
secondary|Mayoral Drive|5|-273,451 -256,489
unclassified|Princes Street|3|480,-71 465,-33
residential|Madden Street||-797,-809 -641,-758
tertiary|Jellicoe Street||-758,-927 -847,-956
secondary|Mayoral Drive|6|-238,517 -220,541 -204,552
secondary|Pitt Street|6|-510,761 -515,721
primary|Fanshawe Street|5|-825,-371 -718,-336
secondary|Victoria Street West|4|-671,-96 -467,-136
secondary|Karangahape Road|4|-809,1046 -785,1037
residential|Commerce Street|3|327,-488 315,-453
secondary|Quay Street|3|540,-533 480,-553
secondary|Grafton Road|2|523,767 476,790
residential|Stanley Street|1|612,667 645,627 653,597 660,593 671,596
secondary|Grafton Road|2|475,807 466,836 456,852
secondary|Customs Street East|6|308,-440 261,-456
living_street|Fort Street||228,-333 257,-325
residential|Commerce Street|2|348,-549 327,-488
residential|Commerce Street|3|362,-592 352,-561
residential|Saint Paul Street||295,558 323,563
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
motorway_link||2|-760,929 -760,988 -728,1103
motorway_link||1|-693,725 -753,883 -760,929
motorway_link||1|-750,1061 -771,972 -770,915 -766,892
secondary|Wellesley Street East|2|346,565 323,528
secondary|Wellesley Street East|1|327,524 352,561
secondary|Wellesley Street East|2|323,528 285,472
secondary|Wellesley Street East|3|381,602 408,635
pedestrian|||-15,-748 -23,-762 -23,-779 44,-984
pedestrian|||153,-1067 56,-772 64,-724 76,-700 83,-696
secondary|Union Street|4|-767,375 -748,404
motorway_link||2|-785,1000 -804,923
motorway_link||4|-559,574 -575,594
primary|Fanshawe Street|5|-112,-501 -135,-497 -184,-470
primary|Fanshawe Street|3|-710,-332 -684,-325 -658,-324
motorway|Northwestern Motorway|3|632,571 569,618 514,668 475,712 420,788
motorway_link||1|-757,720 -746,698 -732,653 -729,617 -732,582 -748,526 -780,471 -787,452
motorway_link||1|-641,725 -713,866 -729,888
motorway_link||2|-575,594 -602,639 -641,725
pedestrian|Aotea Square||-130,307 -61,331
residential|Churchill Street||788,338 808,341 817,338 821,332
tertiary|Albert Street|4|-59,-141 -31,-219
residential|Wyndham Street|4|-27,-228 83,-187
secondary|Grafton Bridge|2|-62,1056 -40,1073
secondary|Wellesley Street East|2|74,233 98,248 124,276
secondary|Mayoral Drive|2|58,471 84,434 94,427
unclassified|Princes Street|2|289,376 327,332 359,256
residential|Fort Street|2|359,-303 331,-302 268,-323
secondary|Mayoral Drive|4|119,330 124,290
residential|Cobden Street|2|-781,1085 -797,1041
secondary|Karangahape Road|2|-532,957 -567,954 -602,966
secondary|Karangahape Road|5|-532,957 -484,966
residential|Federal Street||-169,-86 -146,-150
secondary|Wellington Street|2|-828,439 -761,432
pedestrian|Wynyard Street||634,354 609,380
tertiary|Wakefield Street|4|66,579 88,627 95,632
living_street|Queens Wharf||268,-677 299,-771
living_street|Queens Wharf|1|269,-622 275,-643 262,-661 268,-677
living_street|Queens Wharf||268,-677 268,-665 281,-651 283,-643 277,-620
secondary_link|Wellesley Street East|1|324,545 239,423
pedestrian|Governor Fitzroy Place||104,508 89,477
residential|Lorne Street||65,423 37,362
secondary|Customs Street West|3|5,-549 67,-528
primary|Fanshawe Street|3|-308,-382 -430,-355
primary|Sturdee Street|4|-174,-499 -125,-526
pedestrian|||-277,-640 -260,-694 -123,-648 -97,-722
residential|Gore Street|2|425,-522 435,-552
residential|Gore Street|1|409,-470 425,-522
residential|Gore Street|1|425,-522 426,-496 421,-482 409,-470
pedestrian|Roukai Lane||448,-449 466,-509
pedestrian|Te Ara Tahuhu Walkway||463,-478 456,-476 345,-513 337,-519
residential|Lucy Lane||-408,-430 -352,-441 -337,-490
secondary_link||1|-43,-688 -41,-672 -58,-622
pedestrian|Durham Street East||98,-75 159,-56
residential|Bankside Street||460,-228 460,-216 438,-160
living_street|Alfred Street|1|496,307 520,322
primary|Fanshawe Street|3|-716,-320 -840,-360
secondary|Mayoral Drive|5|29,495 58,471
primary|Hobson Street|4|-189,-288 -236,-157
secondary|Wellesley Street East|2|465,783 460,748
motorway_link||1|465,783 456,755
pedestrian|North Wharf Promenade||-521,-894 -469,-875
secondary_link||1|797,-405 791,-433
secondary|Lower Hobson Street|3|-55,-656 -82,-582
secondary|Quay Street|4|19,-700 -32,-715
pedestrian|Aotea Square||-154,447 -82,377
secondary|Symonds Street|2|331,558 330,566 312,584
secondary|Symonds Street|3|312,584 323,563 331,558
residential|Saint Martins Lane|2|-9,969 21,999
secondary|Quay Street|2|695,-483 729,-477 774,-463
secondary|Quay Street|5|646,-500 577,-522
secondary|Queen Street|2|-254,926 -253,912 -217,814
secondary|Queen Street|2|-165,695 -210,818
secondary|Queen Street|2|-150,643 -152,659 -165,695
secondary|Queen Street|2|-174,693 -160,657 -150,643
secondary|Queen Street|2|-196,756 -177,703
secondary|Tangihua Street|3|797,-405 809,-441
secondary|Beach Road|5|707,-323 742,-281
secondary|Quay Street|2|786,-448 733,-466
residential|Albert Street||-31,-219 -27,-201 -44,-150
residential|Federal Street|2|-69,-364 -54,-408
residential|Durham Lane||11,-108 0,-79
primary|Nelson Street|4|-427,-51 -410,-100
motorway_link||2|-792,861 -782,803
motorway|Auckland Southern Motorway|2|-783,892 -777,833 -760,782 -733,721 -717,661 -716,621 -721,579 -741,523 -756,497
motorway_link||1|396,803 358,861 190,1144
secondary|Stanley Street|2|649,635 613,678
living_street|Waikokota Lane||-629,-794 -641,-758
secondary|Quay Street|2|818,-438 786,-448
pedestrian|Tīramarama Way||-818,-734 -796,-732 -622,-675
motorway_link||2|-676,692 -684,752 -697,789
motorway|Northwestern Motorway|3|635,555 710,508 748,475
primary_link||1|-644,-311 -693,-297 -706,-287
secondary|Queen Street|3|-216,836 -249,922
tertiary|Victoria Street West|2|-4,-27 70,0
secondary|Customs Street East|6|390,-413 354,-425
secondary|Tangihua Street|3|785,-330 770,-304
pedestrian|||-618,-805 -583,-794
pedestrian|Fish Lane||-675,-891 -691,-840
living_street|Māhuru Lane||-720,-783 -739,-723
living_street|Māhuru Lane||-744,-706 -767,-632
residential|Liverpool Street||-132,867 -33,756
living_street|Galway Street|1|333,-486 406,-462
residential|Scene Lane||764,-377 725,-389 714,-396
secondary|Wellesley Street East|2|233,393 253,414
primary|Nelson Street|5|-324,-338 -308,-382
primary|Fanshawe Street|3|-275,-399 -303,-399
primary|Fanshawe Street|5|-411,-375 -384,-379
motorway|Stanley Street|2|748,475 798,417
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
primary|Fanshawe Street|5|-184,-470 -232,-435
motorway_link||3|-620,606 -614,587 -614,569 -621,537
secondary|Union Street|3|-554,566 -572,554 -621,537
secondary|Wellesley Street West|5|-162,152 -215,134
secondary|Wellesley Street West|5|-377,75 -326,93
secondary|Wellesley Street West|5|-428,56 -394,69
secondary|Wellesley Street West|6|-460,45 -428,56
primary|Nelson Street|5|-484,123 -460,45
secondary|Wellesley Street West|5|-526,22 -460,45
secondary|Wellesley Street West|3|-708,-46 -561,9
secondary|Wellesley Street West|5|-242,124 -215,134
primary|Hobson Street|6|-389,257 -410,296
secondary|Cook Street|5|-410,296 -475,272
primary|Hobson Street|4|-410,296 -524,516
primary|Hobson Street|4|-257,-98 -303,28
secondary|Mayoral Drive|6|-256,489 -238,517
secondary|Mayoral Drive|5|-282,411 -273,451
secondary|Cook Street|6|-475,272 -532,252
secondary|Cook Street|4|-614,223 -649,210
secondary|Cook Street|3|-782,161 -649,210
secondary|Queen Street|5|-276,988 -264,953
secondary|Queen Street|2|-217,814 -196,756
secondary|Karangahape Road|5|-690,1000 -634,979
secondary|Karangahape Road|4|-424,978 -394,983
secondary|Karangahape Road|5|-484,966 -424,978
secondary|Karangahape Road|5|-322,990 -276,988
secondary|Karangahape Road|5|-276,988 -220,987
secondary|Karangahape Road|4|-155,1014 -97,1041
primary|Nelson Street|4|-588,410 -537,266
secondary|Union Street|4|-680,500 -671,507 -628,522
secondary|Pitt Street|5|-494,890 -503,818
secondary|Pitt Street|6|-503,818 -507,784
secondary|Pitt Street|5|-515,721 -519,683
secondary|Hopetoun Street|4|-603,775 -570,739
secondary|Hopetoun Street|3|-663,839 -603,775
motorway_link||1|-782,803 -761,751 -729,701
motorway_link||4|-676,626 -661,596
motorway_link||2|-645,647 -630,628 -620,606
motorway_link||2|-732,794 -701,721
secondary|Wellington Street|2|-750,440 -822,447
secondary|Union Street|3|-821,295 -767,375
secondary|Sam Wrigley Street|2|-770,216 -817,254
primary|Nelson Street|4|-610,472 -588,410
primary|Nelson Street|4|-532,252 -523,228
secondary|Karangahape Road|4|-834,1055 -809,1046
secondary|Pitt Street|2|-524,635 -530,604
living_street|||-816,-438 -866,-454
living_street|Victoria Lane||-776,-424 -792,-374
living_street|Saint Patrick's Square||-143,-271 -126,-317 -68,-296
secondary|Grafton Road|1|551,727 592,690
secondary|Symonds Street|5|128,798 150,773
secondary|Symonds Street|5|-61,1006 -25,967
secondary|Symonds Street|6|-81,1047 -61,1006
secondary|Wellesley Street East|2|19,217 32,217 52,225
secondary|Kitchener Street|1|124,276 156,178
secondary|Wellesley Street East|2|285,472 256,431
secondary|Wellesley Street East|1|352,561 381,602
secondary|Mayoral Drive|5|-47,539 29,495
secondary|Mayoral Drive|2|94,427 85,450 58,471
secondary|Wellesley Street West|4|-73,184 0,210
secondary|Grafton Road|5|452,864 441,891
secondary|Grafton Road|3|401,997 386,1038
secondary|Grafton Road|3|437,904 401,997
motorway|Northwestern Motorway|2|420,788 221,1107
secondary|Grafton Road|3|462,827 466,793
secondary|Grafton Road|2|517,760 551,727
secondary|Symonds Street|4|520,322 537,303
secondary|Anzac Avenue|5|706,136 723,117
secondary|Symonds Street|5|676,164 706,136
trunk_link|Stanley Street|2|692,553 671,596
secondary|Stanley Street|1|663,612 649,635
secondary|Alten Road|4|706,136 761,192
secondary|Grafton Road|2|548,454 538,383
secondary|Grafton Road|3|549,469 555,518
motorway_link||2|357,749 416,663
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
secondary|Customs Street East|7|437,-397 390,-413
tertiary|Albert Street|4|63,-484 12,-335
residential|Lower Albert Street|4|79,-535 107,-617
secondary|Bowen Avenue|3|431,-51 456,-60
tertiary|Victoria Street East|2|144,25 70,0
tertiary|Victoria Street West|2|-41,-42 -4,-27
tertiary|Victoria Street West|2|-142,-77 -89,-59
secondary|Lower Hobson Street|2|-92,-580 -55,-684
secondary|Lower Hobson Street|4|-82,-582 -106,-517
secondary_link||2|-58,-622 -71,-579
secondary|Quay Street|2|173,-653 124,-668
secondary|Quay Street|3|440,-566 480,-553
secondary|Quay Street|5|695,-483 646,-500
secondary|Quay Street|2|733,-466 695,-483
secondary|Fanshawe Street|3|74,-517 25,-527
secondary|Customs Street East|7|336,-431 308,-440
secondary|Customs Street West|3|-40,-560 5,-549
secondary|Waterloo Quadrant|4|706,136 688,117
secondary|Anzac Avenue|4|675,-219 638,-307
secondary|Anzac Avenue|5|638,-307 628,-336 635,-362
secondary|Beach Road|6|521,-386 567,-382
secondary|Quay Street|3|322,-605 362,-592
tertiary|Victoria Street West|3|-252,-112 -220,-102
secondary|Halsey Street|5|-719,-169 -715,-226
secondary|Halsey Street|3|-723,-95 -721,-137
secondary|Halsey Street|4|-715,-226 -710,-270
secondary|Victoria Street West|6|-723,-95 -691,-95
secondary_link||2|-708,-46 -736,-53
secondary|Wellesley Street West|5|-561,9 -526,22
primary|Nelson Street|3|-460,45 -427,-51
secondary||5|-467,-136 -390,-151
primary|Nelson Street|4|-410,-100 -390,-151
primary|Nelson Street|4|-390,-151 -338,-298
secondary|Victoria Street West|5|-390,-151 -369,-151 -313,-134
secondary|Victoria Street West|5|-313,-134 -252,-112
secondary|Victoria Street West|6|-763,-96 -723,-95
primary|Hobson Street|5|-236,-157 -252,-112
secondary|Wellesley Street East|1|235,405 214,386
secondary_link|Wellesley Street East|1|228,407 214,386
motorway_link||2|-857,301 -787,399
residential|Day Street||-694,991 -708,948
residential|Lorne Street||144,25 129,61
living_street|Fort Street||228,-333 189,-345
primary|Fanshawe Street|3|-281,-394 -308,-382
secondary|Halsey Street|5|-701,-413 -687,-457
tertiary|Britomart Place|3|503,-384 535,-421
secondary|Victoria Street West|5|-808,-96 -763,-96
residential|Parliament Street|2|803,-11 734,12
pedestrian|Mercury Lane||-484,966 -487,1031
tertiary|Mayoral Drive|5|-253,270 -287,294 -320,331
unclassified|Greys Avenue|2|-238,517 -212,490
residential|Saint James Street||-610,759 -608,688
tertiary|Vincent Street|3|-519,683 -498,655
tertiary|Albert Street|2|-162,152 -162,140 -127,34
primary|Hobson Street|5|-303,28 -319,72
motorway_link||1|455,727 437,749
motorway|Northwestern Motorway|2|190,1087 261,961 351,837 460,704 550,618 635,555
secondary|Grafton Road|4|555,518 558,548
living_street|Courthouse Lane|1|228,-140 229,-116 236,-98
pedestrian|Autahi Lane||-734,-621 -707,-703
secondary|Halsey Street|2|-717,-358 -710,-332
secondary|Halsey Street|2|-705,-316 -706,-287
secondary|Halsey Street|4|-709,-277 -714,-292 -716,-320
residential|Sale Street||-612,14 -600,11 -590,-2
residential|Airedale Street||-53,486 -41,510
residential|Airedale Street||-82,446 -71,450 -63,463
motorway_link||3|273,1049 215,1142
motorway_link||1|-766,892 -754,859
motorway_link||1|-793,893 -792,861
residential|Day Street||-708,948 -695,901
secondary|Union Street|4|-628,522 -580,539
tertiary|Britomart Place|3|563,-478 577,-522
tertiary|Britomart Place|1|550,-450 555,-467 563,-478
secondary|Anzac Avenue|2|803,19 800,-44
secondary|Anzac Avenue|2|800,-44 807,-32 810,-12 809,7 803,19
pedestrian|Market Square||-229,-632 -213,-678
secondary_link||1|-756,430 -749,421 -748,404
secondary|Mayoral Drive|5|-204,552 -176,563
living_street|Federal Street|1|-201,4 -184,-44
motorway|Auckland Northern Motorway|2|-756,497 -787,452
motorway_link||2|-787,399 -744,462 -706,542 -681,636 -676,692
secondary|Wellesley Street East|2|157,323 137,303
residential|Parliament Street|1|645,40 618,46
pedestrian|||-26,-742 -17,-752 -18,-760 -12,-762 -14,-789 -11,-805 48,-983
pedestrian|||75,-1093 -34,-761 -31,-757 -36,-745 -26,-742
living_street|Eastern Viaduct||-130,-761 -228,-792
pedestrian|||-827,-736 -805,-802 -810,-803 -830,-743
living_street|Galway Street|1|453,-448 406,-462
pedestrian|Brigham Street||-743,-972 -758,-927
secondary|Anzac Avenue|4|761,79 791,45 803,19
tertiary|Albert Street|2|-101,-25 -99,-13 -117,38
tertiary|Mayoral Drive|3|-162,152 -184,215 -204,241
residential|Lower Domain Drive|2|709,619 744,636
tertiary|Mayoral Drive|5|-215,248 -238,260
residential|Market Place|3|-290,-450 -303,-399
residential|Customs Street West|2|-283,-640 -297,-635 -360,-577 -380,-511
residential|Viaduct Harbour Avenue|2|-647,-443 -596,-424 -580,-412 -559,-408 -526,-414 -513,-421 -500,-454 -491,-462 -480,-463 -435,-448 -411,-444
tertiary|Gaunt Street||-722,-468 -821,-500
primary|Fanshawe Street|3|-658,-324 -569,-342
pedestrian|Te Wero Island||-257,-802 -345,-834
residential|Wolfe Street|1|46,-431 34,-432 -37,-458
residential|Federal Street|1|-37,-458 -24,-494
secondary|Queen Street|6|-137,607 -123,565
residential|Customs Street West||-92,-580 -236,-625
pedestrian|||-704,-945 -711,-921
pedestrian|||-677,-936 -684,-912
secondary|Symonds Street|4|-17,961 20,923
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
secondary|Mayoral Drive|4|94,427 112,382
motorway_link||3|-653,582 -642,557
residential|Gorst Lane||-303,-252 -242,-229
residential|Gorst Lane||-336,-263 -303,-252
secondary|Upper Queen Street|5|-279,996 -296,1043
primary|Nelson Street|4|-523,228 -484,123
secondary|Cook Street|5|-539,250 -614,223
tertiary|Greys Avenue|3|-286,566 -253,533
secondary|Customs Street West|6|87,-514 135,-498
residential|Federal Street||-139,-171 -116,-235
residential|Kingston Street||-166,-182 -139,-171
residential|Swanson Street|2|-108,-377 -69,-364
residential|Federal Street|1|-24,-494 -18,-511 -19,-523
residential|Wyndham Street|3|-151,-274 -85,-249
primary|Hobson Street|5|-175,-326 -189,-288
secondary|Customs Street East|6|232,-466 191,-479
secondary|Customs Street West|7|135,-498 191,-479
residential|Lower Domain Drive|2|744,636 776,648 793,647
residential|Swanson Street|2|79,-312 12,-335
residential|Sale Street||-844,63 -612,14
residential|Commerce Street|2|293,-404 268,-323
residential|Parliament Street||645,40 637,47 634,62
secondary|Waterloo Quadrant|4|618,46 541,-33
secondary|Waterloo Quadrant|4|688,117 650,79
pedestrian|||341,-766 413,-983
pedestrian|||401,-986 397,-965 305,-688 315,-686 341,-766
living_street|||-744,-453 -758,-418
secondary|Bowen Avenue|3|456,-60 480,-71
unclassified|Princes Street|2|453,0 391,169
unclassified|Kitchener Street|2|213,17 236,-18 270,-51 310,-74 343,-87 370,-93 425,-96 470,-86 480,-71
tertiary|Vincent Street|6|-349,373 -333,347
secondary|Union Street|4|-748,404 -732,428
secondary|Fanshawe Street|4|-72,-511 -112,-501
secondary|Fanshawe Street|4|25,-527 -19,-523
residential|Nelson Street||-555,280 -548,262 -532,252
living_street|||-776,-424 -770,-449
tertiary|Shortland Street|2|181,-282 152,-291 140,-291
residential|Rutland Street||8,354 -17,359
pedestrian|||-274,-647 -361,-674 -461,-585 -472,-588 -525,-424
tertiary|Wakefield Street|3|119,708 117,747 110,773
tertiary|Wakefield Street|1|131,706 148,744 155,751 169,753
tertiary|Wakefield Street|1|103,797 110,773
secondary|Symonds Street|5|105,825 123,804
secondary|Symonds Street|4|177,744 266,646
secondary|Symonds Street|4|361,521 499,349
living_street|Aotea Square||-184,461 -170,461 -154,447
tertiary|Albert Street|4|-78,-90 -89,-59
living_street|Galway Street|2|323,-490 241,-518
residential|Customs Street West|2|-236,-625 -283,-640
residential|Customs Street West|2|-388,-500 -405,-451 -411,-444
residential|Madden Street||-821,-817 -797,-809
pedestrian|||367,-475 368,-489 376,-503
residential|Saint Paul Street||1,588 116,533
secondary|Grafton Road|2|603,688 570,721
secondary|Alten Road|1|810,374 792,347
tertiary|Albert Street|2|-139,102 -153,140 -162,152
living_street|||-724,-405 -782,-427
pedestrian|Te Ara Tahuhu Walkway||541,-452 463,-478
pedestrian|||-708,-982 -701,-975 -683,-995
residential|Emily Place||472,-228 481,-238 525,-266
residential|Emily Place||525,-266 548,-280
secondary|Union Street|4|-715,457 -732,428
motorway|Auckland Southern Motorway|2|-689,575 -667,637 -662,700
residential|Madden Street||-641,-758 -592,-742
pedestrian|Waikokota Lane||-605,-867 -619,-825
pedestrian|Piripi Lane||-636,-630 -684,-645
pedestrian|Waikokota Lane||-665,-689 -671,-682 -696,-608
secondary|Wellesley Street East|2|455,727 433,685
pedestrian|Autahi Lane||-707,-703 -685,-772
tertiary|Britomart Place|1|563,-478 559,-449 546,-435
living_street|||-798,-493 -816,-438
residential|Scene Lane|1|587,-446 559,-449
residential|Scene Lane|1|699,-405 675,-416
residential|Scene Lane||783,-358 764,-377
residential|Scene Lane||764,-377 782,-374 789,-378
residential|Kingston Street|1|-139,-171 -93,-152
tertiary|Wakefield Street|4|29,495 48,539
residential|City Road||-132,867 -216,836
tertiary|Queen Street|3|-71,413 -50,354
tertiary|Queen Street|3|-101,502 -84,453
pedestrian|||148,-1064 80,-855 86,-853 156,-1066
tertiary|Queen Street|2|191,-479 181,-466 167,-406
motorway_link||3|-642,557 -633,533
primary|Fanshawe Street|5|-384,-379 -313,-395
residential|Hardinge Street|1|-544,-148 -535,-122
residential|Hardinge Street|1|-542,-121 -544,-148
living_street|||-764,-282 -710,-270
secondary|Grafton Road|2|538,383 535,353 520,322
motorway_link||1|558,548 531,559
living_street|Federal Street||-262,180 -247,137
living_street|Federal Street||-236,107 -203,9
pedestrian|||821,-268 808,-274 819,-259 824,-263
tertiary|Greys Avenue|1|-509,769 -481,760
tertiary|Greys Avenue|1|-481,760 -494,776 -507,784
tertiary|Queen Street|2|58,41 69,5
residential|Pakenham Street East|2|-472,-534 -392,-509
secondary|Quay Street|3|402,-579 362,-592
living_street|Waikokota Lane||-641,-758 -660,-703
tertiary|Albert Street|1|-16,-258 -27,-228
tertiary|Albert Street|1|12,-335 2,-307
tertiary|Victoria Street West|2|-142,-77 -169,-86
secondary_link|Wellesley Street East|1|270,422 308,476
residential|High Street|1|153,-1 144,25
residential|Mount Street|1|235,636 253,639 266,646
secondary|Symonds Street|4|266,646 303,596
residential|Liverpool Street|2|-202,993 -192,965
residential|Drake Street||-816,-46 -777,-54
secondary|Quay Street|3|277,-620 303,-611
tertiary|Queen Street|2|155,-357 140,-291
tertiary|Albert Street|2|-117,38 -139,102
tertiary|Albert Street|4|-91,-54 -101,-25
tertiary|Albert Street|2|-118,9 -101,-25
tertiary|Albert Street|2|-127,34 -118,9
secondary|Quay Street|4|435,-568 402,-579
secondary|Quay Street|4|577,-522 540,-533
residential|Mills Lane||83,-325 98,-367
secondary|Karangahape Road|2|-602,966 -634,979
tertiary|Queen Street|2|124,-223 132,-260
tertiary|Queen Street|4|-50,354 -37,313
tertiary|Queen Street|3|-82,446 -71,413
tertiary|Queen Street|2|46,76 58,41
residential|Wyndham Street|2|83,-187 113,-178
tertiary|Queen Street|2|113,-178 120,-207
tertiary|Queen Street|2|105,-147 113,-178
tertiary|Queen Street|2|132,-260 140,-291
tertiary|Shortland Street|2|208,-273 181,-282
tertiary|Queen Street|2|167,-406 157,-365
primary|Nelson Street|4|-623,509 -610,472
residential|Bankside Street||429,-134 415,-96
residential|Bankside Street||438,-160 429,-134
secondary|Halsey Street|2|-662,-530 -556,-851 -557,-858
motorway_link||1|-680,703 -693,725
living_street|Federal Street|2|-184,-44 -174,-71
residential|Emily Place|1|573,-311 562,-275
residential|East Street||-561,1067 -573,1043
residential|Scotia Place|2|-309,807 -268,821
residential|Airedale Street||-63,463 -53,486
residential|Mills Lane||98,-367 110,-407
residential|Tyler Street|1|348,-549 425,-522
living_street|Saint Patrick's Square||-68,-296 -85,-249
residential|Quay Street||-130,-761 -134,-744 -120,-737
secondary|Cook Street|1|-649,210 -694,200
living_street|Tyler Street||265,-576 290,-568
secondary|Symonds Street|4|68,870 93,838
secondary|Symonds Street|4|537,303 572,269
pedestrian|||257,-116 235,-130
tertiary|Princes Street|2|529,-209 510,-155
residential|Princes Wharf|3|-32,-715 -15,-748
residential|Quay Street|2|-120,-737 -80,-729
residential|High Street|1|214,-271 188,-155
pedestrian|Vulcan Lane||200,-199 239,-188
tertiary|Queen Street|3|-113,535 -101,502
residential|Swanson Street|2|-23,-349 12,-335
residential|Swanson Street|3|-69,-364 -43,-356
residential|Gorst Lane||-242,-229 -213,-219
tertiary|Shortland Street|2|321,-230 268,-246 208,-273
residential|Liverpool Street|2|-154,892 -132,867
tertiary|Vincent Street|3|-415,496 -349,373
living_street|Mercury Lane||-487,1031 -487,1044 -482,1056
residential|Lyndock Street||41,683 67,670
residential|Poynton Terrace||-410,905 -341,918
residential|Graham Street||-470,-254 -482,-257 -557,-240
pedestrian|||-522,910 -510,888
residential|Gore Street|3|379,-376 386,-401
residential|||-317,1062 -296,1043
residential|||-467,1056 -482,1056
secondary||6|503,-384 521,-386
secondary||6|452,-392 437,-397
living_street||1|369,-305 359,-305
secondary||4|504,-65 480,-71
tertiary||2|195,43 200,45
residential||4|116,-646 123,-668
residential||2|-302,-330 -324,-338
primary||5|-116,-486 -118,-500
living_street|||36,72 46,75
secondary_link||2|164,332 179,348
secondary_link||2|119,345 103,349
secondary||4|800,-44 803,-11
secondary||4|684,-202 675,-219
residential|||41,918 32,910
residential|||134,810 123,804
residential|||9,913 20,923
residential|||295,558 319,571
residential||1|645,40 618,46
motorway_link||1|428,818 420,788
motorway_link||1|531,559 558,558
motorway_link||1|361,761 357,749
secondary||5|-494,890 -497,862
tertiary||3|-498,655 -499,652
tertiary||2|-481,760 -510,761
residential|||-63,631 -50,627
residential||1|-38,684 -28,684
residential||1|-140,647 -150,646
residential|||-169,706 -177,703
residential|||-27,743 -33,756
residential|||-187,949 -192,965
residential|||-154,892 -143,863
residential||2|235,636 257,656
residential|||-688,891 -695,901
secondary||2|200,45 213,17
pedestrian|||130,-221 124,-223
pedestrian|||195,-200 198,-199
residential|||90,-86 98,-75
residential|||12,-111 13,-114
pedestrian|||192,-149 187,-150
pedestrian|||226,-140 228,-140
residential|||239,-95 236,-98
residential||2|312,-147 304,-126
residential||1|291,-145 312,-143
residential||1|259,-142 247,-123
residential||1|-54,-464 -37,-458
residential||1|-252,-396 -275,-399
residential||1|-183,-367 -159,-372
residential||2|-401,-395 -398,-377
residential|||-282,-472 -290,-450
residential|||-234,-624 -236,-625
residential||1|-236,-462 -226,-468
residential|||-544,-148 -539,-122
residential|||-166,-182 -139,-172
residential|||-557,324 -569,320
residential|||-719,183 -720,193
secondary_link||2|-736,-53 -708,-46
secondary_link||2|-753,-75 -752,-96
residential|||-745,22 -741,41
secondary||1|-716,193 -694,200
secondary||3|777,215 761,192
secondary||3|788,338 792,347
secondary||1|235,405 233,393
secondary||2|-724,-84 -724,-95
unclassified||1|-50,354 -61,331
residential|||84,777 107,784
motorway_link||1|428,818 409,808
residential||2|-225,836 -217,839
secondary||4|-519,683 -508,656
tertiary|||-821,-735 -818,-734
tertiary||2|-797,-809 -805,-802
secondary||4|-785,1037 -797,1041
residential||1|702,614 709,619
living_street|||383,-364 376,-366
pedestrian|||134,-291 140,-290
pedestrian|||83,-309 79,-311
residential|||79,-312 83,-325
pedestrian|||107,-368 99,-370
pedestrian|||150,-352 154,-351
living_street||1|231,-149 228,-140
living_street||1|249,-241 254,-252
residential||4|-151,-274 -143,-271
residential||1|-42,-442 -36,-458
residential||1|74,233 64,247
residential|||-11,-171 -34,-179
residential|||399,-40 431,-51
residential||1|187,-151 188,-155
residential||1|153,-1 144,25
residential||2|-380,-505 -388,-500
residential|||587,-446 559,-450
motorway_link||2|-524,635 -523,639
secondary||1|544,360 538,383
residential|||322,1025 303,1013
residential|||684,603 663,612
secondary||2|456,852 452,852
secondary||2|462,827 475,807
secondary||2|565,637 577,652
secondary||2|559,579 548,552
secondary||2|523,767 497,772
residential|||91,340 119,345
residential|||46,347 33,339
pedestrian|||556,422 549,423
pedestrian|||795,-363 785,-366
residential||2|-15,-748 -26,-742
secondary||3|-118,-531 -125,-526
secondary||3|-71,-553 -59,-572
secondary||2|-71,-579 -82,-583
secondary||2|-674,850 -663,839
secondary||2|214,386 233,393
secondary||1|219,27 233,24
secondary||2|255,-627 269,-623
pedestrian|||257,-621 269,-622
living_street||1|529,-423 533,-419
living_street||1|453,-448 448,-449
unclassified||1|263,401 251,412
secondary||5|-107,561 -120,557
secondary||5|-64,546 -47,539
secondary||4|-723,1013 -733,1015
secondary||4|-394,983 -424,978
tertiary||2|76,-24 68,-1
tertiary||2|105,-147 113,-178
secondary||6|698,-332 707,-323
secondary||7|-524,635 -530,604
secondary||6|-286,380 -282,411
secondary_link||1|-253,270 -238,260
primary||4|-326,93 -319,72
tertiary||3|-220,-102 -252,-113
tertiary||3|-169,-86 -142,-77
primary_link||1|-525,585 -530,604
primary||5|-547,555 -554,566
residential||2|-80,-729 -97,-722
residential||2|-45,-719 -36,-711
motorway_link||1|466,793 476,790
pedestrian|||304,-126 310,-126
tertiary||4|-78,-90 -89,-59
tertiary||4|-59,-141 -44,-150
residential|||-125,-526 -105,-519
residential||4|816,-448 813,-439
residential|||-48,-135 -44,-150
motorway_link||1|810,374 815,368
motorway_link||2|-637,651 -666,653
motorway_link||1|-731,1079 -734,1080
motorway_link||1|-793,893 -792,861
motorway_link||1|-760,929 -753,952
residential||3|301,-428 305,-441
tertiary||3|-722,-468 -744,-453
secondary||2|-680,-474 -686,-457
secondary||2|-668,-513 -662,-530
residential|||-628,522 -633,533
residential|||-555,280 -544,248
motorway_link||1|-654,559 -645,563
motorway_link||1|-683,512 -682,511
secondary||4|-547,555 -527,554
secondary_link||2|-747,439 -750,440
secondary_link||1|612,667 618,672
secondary||5|-176,563 -204,552
secondary||5|-149,567 -126,575
secondary||4|169,753 177,744
tertiary||4|-37,313 -61,331
secondary||3|471,739 461,732
secondary||3|475,783 478,789
secondary||1|253,414 235,405
secondary||3|441,679 424,673
secondary||3|460,711 470,718
secondary||2|400,641 416,663
secondary||2|346,565 330,563
secondary_link||1|308,476 285,472
motorway_link||1|437,749 460,748
secondary_link||1|578,683 591,675
secondary||2|597,684 602,689
secondary||2|558,548 555,518
secondary||2|568,575 576,588
secondary_link||1|475,807 464,806
secondary||2|559,579 567,593
secondary_link||1|497,772 500,778
secondary||2|568,575 557,548
secondary||2|573,630 577,652
motorway_link||2|-676,626 -671,624
motorway||2|-724,1079 -727,1080
motorway||2|-783,892 -792,861
secondary_link||1|103,797 110,773
secondary||4|-72,-511 -104,-523
secondary||2|818,-438 816,-448
secondary||5|-104,173 -88,185
secondary||2|-633,533 -621,537
pedestrian|||-612,-878 -605,-867
secondary||4|520,322 537,303
secondary||1|548,454 549,469
secondary||2|431,-51 456,-60
residential||2|-22,388 -17,359
secondary||5|-256,489 -233,511
secondary||6|-238,517 -256,489
secondary||6|-510,761 -508,769
secondary||6|-515,721 -536,702
primary||5|-718,-336 -712,-338
secondary||4|-671,-96 -691,-95
secondary||4|-785,1037 -775,1034
residential||3|327,-488 345,-513
residential||3|315,-453 311,-439
residential||1|612,667 594,679
residential||1|671,596 685,601
secondary||2|475,807 466,793
secondary||6|261,-456 232,-466
living_street|||257,-325 268,-323
residential||2|348,-549 352,-561
residential|||323,563 328,568
motorway_link||1|460,704 457,706
motorway_link||2|-680,703 -678,703
motorway_link||2|-760,929 -769,902
motorway_link||1|-693,725 -680,703
secondary||2|323,528 331,558
secondary||3|408,635 416,663
pedestrian|||153,-1067 156,-1066
secondary||4|-748,404 -732,428
motorway_link||2|-804,923 -807,914
motorway_link||4|-559,574 -552,568
primary||3|-710,-332 -718,-336
primary||3|-658,-324 -644,-311
motorway||3|632,571 635,555
motorway||3|420,788 396,803
motorway_link||1|-757,720 -762,729
motorway_link||1|-787,452 -788,444
tertiary||4|-31,-219 -28,-228
residential||4|83,-187 113,-180
secondary||2|-62,1056 -81,1047
secondary||2|74,233 52,225
secondary||2|124,276 124,290
residential||2|359,-303 369,-305
secondary||4|119,330 102,346
secondary||4|124,290 131,283
residential|||-169,-86 -174,-71
residential|||-146,-150 -138,-170
secondary||2|-761,432 -763,434
tertiary||4|66,579 57,561
tertiary||4|95,632 105,652
secondary_link||1|324,545 331,558
secondary_link||1|239,423 235,405
residential|||65,423 83,436
residential|||37,362 33,339
secondary||3|67,-528 79,-535
primary||4|-174,-499 -184,-470
pedestrian|||-277,-640 -278,-638
pedestrian|||-97,-722 -95,-732
residential||2|425,-522 414,-490
residential||2|435,-552 440,-566
residential||1|409,-470 407,-462
secondary_link||1|-43,-688 -32,-715
pedestrian|||98,-75 89,-77
pedestrian|||159,-56 165,-55
residential|||460,-228 460,-226
residential|||438,-160 429,-134
primary||3|-716,-320 -705,-316
secondary||5|58,471 89,477
secondary||2|465,783 466,793
secondary||2|460,748 453,743
motorway_link||1|456,755 448,749
secondary_link||1|797,-405 789,-378
secondary_link||1|791,-433 795,-445
secondary||3|-55,-656 -55,-684
secondary||3|-82,-582 -71,-553
secondary||4|-32,-715 -45,-719
secondary||2|331,558 339,553
secondary||2|312,584 303,596
residential||2|-9,969 -17,961
secondary||2|774,-463 786,-448
secondary||2|-254,926 -264,953
secondary||2|-210,818 -216,836
secondary||2|-165,695 -169,706
secondary||2|-174,693 -177,703
secondary||3|809,-441 812,-449
secondary||2|786,-448 791,-433
residential|||11,-108 12,-111
residential|||0,-79 -2,-73
motorway||2|-783,892 -779,905
secondary||2|613,678 603,688
pedestrian|||-622,-675 -615,-673
motorway_link||2|-676,692 -673,694
motorway||3|748,475 778,461
primary_link||1|-706,-287 -712,-285
secondary||3|-249,922 -254,926
secondary||6|354,-425 336,-431
secondary||3|785,-330 783,-358
pedestrian|||-583,-794 -576,-792
pedestrian|||-675,-891 -673,-898
living_street|||-739,-723 -742,-714
living_street|||-744,-706 -741,-714
residential|||-132,867 -154,892
living_street||1|333,-486 327,-488
residential|||764,-377 787,-370
residential|||714,-396 699,-405
secondary||2|253,414 269,413
primary||5|-308,-382 -313,-395
primary||3|-303,-399 -313,-395
primary||5|-411,-375 -430,-355
secondary||3|-71,-553 -90,-560
secondary||2|-104,-549 -100,-540
secondary||2|-32,-715 -26,-742
primary||3|-276,-425 -276,-399
primary||4|-411,-375 -401,-395
primary||4|-705,-316 -716,-315
motorway_link||3|-621,537 -617,526
secondary||3|-554,566 -526,565
secondary||5|-215,134 -247,137
secondary||5|-377,75 -394,69
secondary||5|-428,56 -460,46
secondary||5|-460,45 -428,56
primary||4|-257,-98 -252,-112
secondary||6|-532,252 -539,250
secondary||5|-276,988 -279,996
secondary||2|-217,814 -216,836
secondary||5|-220,987 -202,993
secondary||4|-97,1041 -81,1047
primary||4|-537,266 -542,258
secondary||4|-628,522 -621,537
secondary||6|-507,784 -509,769
motorway_link||4|-676,626 -683,628
motorway_link||4|-661,596 -653,582
motorway_link||2|-645,647 -666,649
motorway_link||2|-701,721 -680,703
primary||4|-532,252 -537,266
secondary||4|-809,1046 -797,1042
living_street|||-792,-374 -796,-362
secondary||1|592,690 597,684
secondary||5|128,798 123,804
secondary||5|150,773 155,751
secondary||5|-25,967 -17,961
secondary||2|19,217 0,210
secondary||2|52,225 74,226
secondary||2|256,431 253,414
secondary||1|352,561 331,558
secondary||4|-73,184 -88,185
secondary||5|452,864 456,852
secondary||5|441,891 437,904
secondary||3|401,997 405,987
secondary||3|386,1038 369,1060
secondary||2|517,760 497,772
secondary||2|551,727 570,721
secondary||5|706,136 687,135
trunk_link||2|671,596 663,612
secondary||1|663,612 672,597
trunk||2|822,406 827,379
motorway||2|822,386 827,379
secondary||3|789,-378 795,-363
secondary||3|795,-363 787,-377
secondary||2|810,-409 818,-438
secondary||2|795,-363 783,-358
tertiary||4|12,-335 2,-307
secondary||3|456,-60 473,-53
tertiary||2|-142,-77 -169,-87
secondary||2|-92,-580 -78,-550
secondary||4|-106,-517 -103,-503
secondary_link||2|-71,-579 -65,-554
secondary||3|440,-566 435,-568
secondary||3|74,-517 87,-514
secondary||3|25,-527 5,-549
secondary||3|-40,-560 -71,-553
secondary||6|521,-386 512,-394
secondary||3|322,-605 303,-611
secondary||5|-719,-169 -721,-137
secondary||3|-723,-95 -724,-84
secondary||4|-710,-270 -709,-277
secondary_link||2|-736,-53 -760,-48
secondary||5|-561,9 -590,-2
secondary||5|-252,-112 -220,-102
secondary_link||1|228,407 239,423
residential|||-694,991 -690,1000
primary||3|-281,-394 -252,-396
secondary||5|-701,-413 -708,-394
secondary||5|-687,-457 -680,-474
tertiary||3|503,-384 487,-355
tertiary||3|535,-421 546,-435
residential||2|803,-11 810,-11
tertiary||5|-320,331 -333,347
unclassified||2|-238,517 -253,533
residential|||-610,759 -598,770
tertiary||2|-127,34 -118,9
motorway_link||1|455,727 460,711
secondary||4|558,548 568,575
secondary||2|-710,-332 -716,-320
secondary||2|-705,-316 -701,-330
secondary||2|-706,-287 -710,-270
secondary||4|-709,-277 -711,-270
residential|||-53,486 -63,463
residential|||-41,510 -30,529
motorway_link||1|-766,892 -763,900
motorway_link||1|-793,893 -788,908
tertiary||3|563,-478 560,-449
tertiary||1|550,-450 535,-421
pedestrian|||-229,-632 -232,-624
secondary_link||1|-756,430 -761,432
living_street||1|-201,4 -203,9
secondary||2|157,323 179,348
secondary||2|137,303 123,301
pedestrian|||-26,-742 -20,-739
secondary||4|803,19 794,-8
tertiary||3|-204,241 -215,248
residential||3|-290,-450 -283,-472
residential||3|-303,-399 -298,-387
residential||2|-283,-640 -277,-640
residential||2|-380,-511 -380,-505
residential||1|-37,-458 -42,-442
residential||1|-24,-494 -30,-521
secondary||6|-123,565 -113,535
residential|||-92,-580 -84,-577
pedestrian|||-704,-945 -701,-953
pedestrian|||-711,-921 -714,-912
pedestrian|||-677,-936 -674,-944
pedestrian|||-684,-912 -687,-903
secondary||4|20,923 41,918
tertiary||1|-16,-258 -27,-228
secondary||5|-717,-358 -724,-338
secondary||5|-189,999 -202,993
residential|||312,-147 291,-145
residential|||422,-161 437,-156
motorway_link||3|-642,557 -634,533
residential|||-242,-229 -214,-219
residential|||-336,-263 -349,-268
secondary||5|-279,996 -279,988
primary||4|-523,228 -531,252
secondary||5|-539,250 -536,255
tertiary||3|-253,533 -236,520
residential|||-139,-171 -146,-150
residential|||-116,-235 -107,-258
residential||1|-19,-523 -12,-553
residential||2|79,-312 83,-309
secondary||4|618,46 636,50
secondary||4|688,117 707,134
secondary||4|650,79 634,62
tertiary||6|-333,347 -324,329
residential|||-532,252 -523,228
tertiary||2|181,-282 208,-273
tertiary||2|140,-291 134,-291
residential|||8,354 33,339
residential|||-17,359 -34,373
pedestrian|||-525,-424 -521,-417
secondary||5|105,825 93,838
secondary||4|361,521 357,527
secondary||4|499,349 527,336
tertiary||4|-89,-59 -91,-54
living_street||2|323,-490 327,-489
residential||2|-411,-444 -408,-430
secondary||1|810,374 822,386
secondary||1|792,347 793,339
pedestrian|||541,-452 550,-450
pedestrian|||463,-478 457,-480
residential|||472,-228 460,-228
residential|||548,-280 562,-276
secondary||4|-732,428 -749,421
motorway||2|-662,700 -641,725
pedestrian|||-605,-867 -603,-874
pedestrian|||-636,-630 -630,-628
secondary||2|455,727 461,731
secondary||2|433,685 421,677
residential||1|559,-449 550,-452
residential|||783,-358 793,-355
residential|||789,-378 799,-375
residential||1|-139,-171 -166,-182
tertiary||4|48,539 58,561
residential|||-216,836 -224,833
tertiary||3|-84,453 -82,446
pedestrian|||148,-1064 152,-1063
tertiary||2|191,-479 198,-495
motorway_link||3|-633,533 -629,522
primary||5|-384,-379 -411,-375
living_street|||-247,137 -242,124
tertiary||2|69,5 71,0
residential||2|-472,-534 -488,-539
residential||2|-392,-509 -388,-500
tertiary||1|-27,-228 -31,-219
secondary_link||1|270,422 253,414
residential|||-777,-54 -762,-57
secondary||3|277,-620 269,-622
tertiary||2|155,-357 157,-365
tertiary||2|140,-291 132,-260
tertiary||2|-117,38 -118,9
tertiary||2|124,-223 120,-207
tertiary||2|132,-260 134,-291
tertiary||2|208,-273 214,-271
primary||4|-623,509 -628,522
residential|||-63,463 -85,455
residential|||-120,-737 -97,-722
secondary||4|537,303 522,323
pedestrian|||235,-130 228,-130
residential||1|214,-271 212,-287
pedestrian|||200,-199 198,-199
tertiary||3|-113,535 -104,560
residential||2|-23,-349 -43,-356
residential||3|379,-376 383,-364
residential||3|386,-401 390,-413`;

// Harbour surface: outer rings + holes (wharf islands), traced from the
// coastline and flood-filled offline so the water ends exactly at the quays.
const WATER = [{"p":[[-639,-1060],[57,-1060],[-40,-769],[-85,-784],[-77,-920],[-95,-928],[-75,-994],[-87,-992],[-107,-932],[-107,-918],[-112,-917],[-175,-942],[-151,-1012],[-152,-1021],[-163,-1020],[-187,-934],[-182,-927],[-170,-929],[-117,-906],[-127,-782],[-134,-779],[-214,-809],[-236,-809],[-247,-766],[-112,-721],[-109,-714],[-127,-664],[-254,-703],[-269,-702],[-284,-661],[-366,-685],[-464,-597],[-481,-596],[-529,-444],[-532,-439],[-558,-433],[-583,-438],[-529,-618],[-607,-644],[-583,-724],[-517,-706],[-469,-862],[-444,-861],[-441,-874],[-354,-969],[-242,-933],[-245,-908],[-240,-905],[-227,-906],[-213,-964],[-354,-1007],[-355,-998],[-350,-995],[-226,-955],[-229,-942],[-348,-981],[-362,-981],[-451,-884],[-451,-876],[-458,-875],[-527,-900],[-421,-1014],[-421,-1022],[-432,-1023],[-531,-914],[-540,-911],[-701,-966],[-682,-987],[-639,-988],[-639,-1060]],"h":[[[-352,-847],[-379,-822],[-374,-799],[-286,-777],[-274,-777],[-268,-783],[-251,-780],[-241,-804],[-244,-815],[-336,-847],[-352,-847]]]},{"p":[[161,-1060],[759,-1060],[759,-1016],[610,-571],[577,-584],[613,-696],[578,-709],[568,-709],[565,-704],[529,-588],[493,-600],[491,-632],[553,-820],[548,-839],[494,-857],[478,-857],[471,-850],[401,-632],[319,-658],[317,-678],[409,-952],[416,-989],[405,-984],[309,-690],[237,-684],[235,-702],[251,-706],[249,-738],[259,-744],[259,-752],[251,-760],[251,-782],[263,-782],[261,-794],[269,-800],[285,-866],[309,-926],[307,-938],[315,-944],[335,-1004],[334,-1015],[231,-1010],[231,-742],[239,-740],[241,-716],[223,-712],[225,-686],[207,-690],[213,-718],[205,-722],[207,-760],[197,-764],[194,-797],[175,-794],[175,-762],[161,-760],[161,-748],[173,-722],[165,-718],[173,-686],[170,-677],[110,-697],[112,-719],[102,-719],[96,-711],[79,-718],[67,-744],[65,-766],[161,-1060]],"h":[]}];

const TAU = Math.PI * 2;

// half-width by class, metres (lanes can widen the vehicular ones)
const WIDTHS = {
    motorway: 11, trunk: 11, primary: 13, secondary: 11, tertiary: 9,
    unclassified: 7.5, residential: 7, living_street: 5.5, pedestrian: 4.2,
};

export default function build(world) {
    const { THREE, scene } = world;

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

    // ------------------------------------------------------------- land
    // The whole table the map sits on. x −880..880, z −1060..1120.
    let landTex = null;
    try {
        landTex = world.canvasTexture(512, 512, (ctx) => {
            ctx.fillStyle = '#b3bda1';
            ctx.fillRect(0, 0, 512, 512);
            // soft parkland blotches so the flat isn't dead flat
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
    const land = new THREE.Mesh(
        new THREE.PlaneGeometry(1760, 2180),
        new THREE.MeshLambertMaterial({ color: 0xb6c0a5, map: landTex || null })
    );
    land.rotation.x = -Math.PI / 2;
    land.position.set(0, 0, 30);
    land.receiveShadow = true;
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
                // small moving glints
                vec2 g = vXZ * 0.9;
                float sp = n2(floor(g + vec2(t * 2.0, -t * 1.4)));
                col += vec3(0.75, 0.85, 0.9) * step(0.992, sp) * 0.5;
                gl_FragColor = vec4(col, 1.0);
            }`,
    });
    const water = new THREE.Mesh(waterGeo, waterMat);
    water.position.y = 0.03;
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

    function widthOf(w) {
        if (w.kind.endsWith('_link')) return Math.max(6.5, w.lanes * 3.4 + 1.2);
        const base = WIDTHS[w.kind] || 6.5;
        if (w.kind === 'pedestrian' || w.kind === 'living_street') return base;
        return Math.min(26, Math.max(base, w.lanes * 3.3 + 1.8));
    }

    const COS8 = [], SIN8 = [];
    for (let s = 0; s <= 8; s++) { COS8.push(Math.cos((s / 8) * TAU)); SIN8.push(Math.sin((s / 8) * TAU)); }

    function ribbon(arr, pts, half, y) {
        const n = pts.length;
        for (let i = 0; i < n; i++) {
            const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
            let dx = b[0] - a[0], dz = b[1] - a[1];
            const len = Math.hypot(dx, dz) || 1;
            dx /= len; dz /= len;
            pts[i].nx = -dz * half; pts[i].nz = dx * half;
        }
        for (let i = 1; i < n; i++) {
            const p = pts[i - 1], q = pts[i];
            const l0x = p[0] + p.nx, l0z = p[1] + p.nz, r0x = p[0] - p.nx, r0z = p[1] - p.nz;
            const l1x = q[0] + q.nx, l1z = q[1] + q.nz, r1x = q[0] - q.nx, r1z = q[1] - q.nz;
            arr.push(l0x, y, l0z, r0x, y, r0z, r1x, y, r1z,
                     l0x, y, l0z, r1x, y, r1z, l1x, y, l1z);
        }
    }
    function disc(arr, x, z, r, y) {
        for (let s = 0; s < 8; s++) {
            arr.push(x, y, z,
                x + COS8[s] * r, y, z + SIN8[s] * r,
                x + COS8[s + 1] * r, y, z + SIN8[s + 1] * r);
        }
    }

    const asphalt = [];   // vehicular
    const paving = [];    // pedestrian streets, shared lanes
    const marks = [];     // painted lines
    for (const w of ways) {
        const walkway = w.kind === 'pedestrian' || w.kind === 'living_street';
        const arr = walkway ? paving : asphalt;
        const half = widthOf(w) / 2;
        const y = walkway ? 0.05 : 0.07;
        ribbon(arr, w.pts, half, y);
        for (const p of w.pts) disc(arr, p[0], p[1], half, y);

        // centre dashes on the main streets
        if (w.kind === 'primary' || w.kind === 'secondary' || w.kind === 'tertiary') {
            let carry = 4;
            for (let i = 1; i < w.pts.length; i++) {
                const p = w.pts[i - 1], q = w.pts[i];
                const segLen = Math.hypot(q[0] - p[0], q[1] - p[1]);
                if (segLen < 0.01) continue;
                const dx = (q[0] - p[0]) / segLen, dz = (q[1] - p[1]) / segLen;
                const nx = -dz * 0.14, nz = dx * 0.14;
                let d = carry;
                while (d + 3.2 < segLen) {
                    const x0 = p[0] + dx * d, z0 = p[1] + dz * d;
                    const x1 = p[0] + dx * (d + 3.2), z1 = p[1] + dz * (d + 3.2);
                    marks.push(x0 + nx, 0.1, z0 + nz, x0 - nx, 0.1, z0 - nz, x1 - nx, 0.1, z1 - nz,
                               x0 + nx, 0.1, z0 + nz, x1 - nx, 0.1, z1 - nz, x1 + nx, 0.1, z1 + nz);
                    d += 13;
                }
                carry = d - segLen;
            }
        }
        // solid edge lines on the motorways
        if (w.kind === 'motorway' || w.kind === 'trunk') {
            for (let i = 1; i < w.pts.length; i++) {
                const p = w.pts[i - 1], q = w.pts[i];
                const segLen = Math.hypot(q[0] - p[0], q[1] - p[1]);
                if (segLen < 4) continue;
                const dx = (q[0] - p[0]) / segLen, dz = (q[1] - p[1]) / segLen;
                for (const sgn of [1, -1]) {
                    const off = sgn * (half - 0.55);
                    const nx = -dz, nz = dx;
                    const ex = nx * 0.15, ez = nz * 0.15;
                    const ax = p[0] + nx * off, az = p[1] + nz * off;
                    const bx = q[0] + nx * off, bz = q[1] + nz * off;
                    marks.push(ax + ex, 0.1, az + ez, ax - ex, 0.1, az - ez, bx - ex, 0.1, bz - ez,
                               ax + ex, 0.1, az + ez, bx - ex, 0.1, bz - ez, bx + ex, 0.1, bz + ez);
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
    asphaltMesh.receiveShadow = true;
    scene.add(asphaltMesh);

    const pavingMesh = flatMesh(paving, new THREE.MeshLambertMaterial({ color: 0x8a8073, side: THREE.DoubleSide }));
    pavingMesh.receiveShadow = true;
    scene.add(pavingMesh);

    const marksMesh = flatMesh(marks, new THREE.MeshBasicMaterial({ color: 0xf2eedd, side: THREE.DoubleSide }));
    world.ghost(marksMesh); // paint, not a thing the walk should rasterise
    scene.add(marksMesh);

    // ------------------------------------------------------------- names
    // Street names painted flat on the map, the way a map would.
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
            // corners in label space (dx along street, dz across), rotated into world
            const corner = (dx, dz) => [mx + dx * ca + dz * sa, mz - dx * sa + dz * ca];
            const c0 = corner(-hl, -hh), c1 = corner(hl, -hh), c2 = corner(hl, hh), c3 = corner(-hl, hh);
            const y = 0.12;
            lpos.push(c0[0], y, c0[1], c1[0], y, c1[1], c2[0], y, c2[1],
                      c0[0], y, c0[1], c2[0], y, c2[1], c3[0], y, c3[1]);
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

    // ------------------------------------------------------------- done
    world.groundLevel(0.08);
    world.frame((dt, t) => {
        waterMat.uniforms.uTime.value = t;
    });
}
