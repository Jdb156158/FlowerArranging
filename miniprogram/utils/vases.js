// 花瓶绘制：移植自网页版 app.js（SVG → Canvas）
const { pathTo } = require('./svgpath.js');
const { VASE_SIZES, VASE_COLORS, SPECIAL_VESSELS } = require('./flowers-data.js');

function shade(hex, n) {
  return '#' + hex.slice(1).match(/../g).map(x =>
    Math.max(0, Math.min(255, parseInt(x, 16) + n)).toString(16).padStart(2, '0')).join('');
}

function stemBase(vase) {
  if (SPECIAL_VESSELS[vase]) return SPECIAL_VESSELS[vase].base;
  if (vase === 'paper') return 543;
  if (vase === 'bowl') return 494;
  if (vase === 'columnhigh') return 456;
  if (vase === 'columnlow') return 486;
  return vase === 'petite' || vase === 'bud' ? 492 : 500;
}

function vaseShadow(vase) {
  if (SPECIAL_VESSELS[vase]) {
    const spec = SPECIAL_VESSELS[vase];
    const body = VASE_SIZES[vase][1];
    return { cy: spec.bottom, rx: body * 1.2, ry: 10 };
  }
  if (vase === 'mug' || vase === 'bowl') return { cy: VASE_SIZES[vase][2] + 5, rx: vase === 'bowl' ? 62 : 64, ry: 9 };
  if (vase === 'paper' || vase === 'canvaswrap') return { cy: 687, rx: 103.155, ry: 10 };
  return { cy: VASE_SIZES[vase][2] + 5, rx: VASE_SIZES[vase][1] * 1.5, ry: 14 };
}

function wrappedVessel(key) { return key === 'paper' || key === 'canvaswrap'; }

// 水平渐变（对应网页 vaseSurface 的 linearGradient）
function vaseGrad(ctx, p, x0, x1) {
  const g = ctx.createLinearGradient(x0, 0, x1, 0);
  g.addColorStop(0, shade(p.body, -10));
  g.addColorStop(0.28, shade(p.body, 6));
  g.addColorStop(0.55, p.body);
  g.addColorStop(0.8, shade(p.body, -5));
  g.addColorStop(1, shade(p.body, -16));
  return g;
}

function fill(ctx, d, style, stroke, sw) {
  ctx.beginPath();
  pathTo(ctx, d);
  if (style) { ctx.fillStyle = style; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = sw || 1; ctx.stroke(); }
}
function strokeOnly(ctx, d, color, sw, cap) {
  ctx.beginPath();
  pathTo(ctx, d);
  ctx.strokeStyle = color; ctx.lineWidth = sw;
  if (cap) ctx.lineCap = cap;
  ctx.stroke();
}
function ell(ctx, cx, cy, rx, ry, style) {
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.fillStyle = style; ctx.fill();
}

// ---- 标准参数化瓶 ----
function standardBodyPath(key) {
  const [neck, body, bottom] = VASE_SIZES[key];
  const narrow = key === 'petite' || key === 'bud';
  const lip = narrow ? 5 : 8;
  const mouth = key === 'columnhigh' ? 456 : 486;
  const shoulder = narrow ? 528 : 505;
  const left = 330 - neck, right = 330 + neck;
  if (key === 'columnhigh') return 'M307 456 A23 8 0 0 0 353 456 L376 664 C379 686 362 700 330 700 C298 700 281 686 284 664 Z';
  return `M${left} ${mouth} A${neck} ${lip} 0 0 0 ${right} ${mouth} L${right} ${narrow ? 508 : 490} C${right} ${shoulder} ${330 + body} ${shoulder} ${330 + body} ${bottom - 43} Q${330 + body} ${bottom} ${330 + body - 22} ${bottom} L${330 - body + 22} ${bottom} Q${330 - body} ${bottom} ${330 - body} ${bottom - 43} C${330 - body} ${shoulder} ${left} ${shoulder} ${left} ${narrow ? 508 : 490} Z`;
}
function drawStandard(ctx, key, p, layer) {
  const [neck, body] = VASE_SIZES[key];
  const narrow = key === 'petite' || key === 'bud';
  const lip = narrow ? 5 : 8;
  const mouth = key === 'columnhigh' ? 456 : 486;
  if (layer === 'back') {
    ell(ctx, 330, mouth, neck, lip, p.rim);
    ell(ctx, 330, mouth, neck - 4, lip - 2, p.inside);
    return;
  }
  fill(ctx, standardBodyPath(key), vaseGrad(ctx, p, 330 - body - 8, 330 + body + 8), p.edge, 1);
  const left = 330 - neck, right = 330 + neck, inner = neck - 4;
  fill(ctx, `M${left} ${mouth} A${neck} ${lip} 0 0 0 ${right} ${mouth} L${330 + inner} ${mouth} A${inner} ${lip - 2} 0 0 1 ${330 - inner} ${mouth} Z`, p.rim);
}

// ---- 马克杯 / 碗 ----
function drawEveryday(ctx, key, p, layer) {
  const bowl = key === 'bowl';
  const rx = bowl ? 80 : 48, ry = bowl ? 14 : 10;
  const left = 330 - rx, right = 330 + rx;
  if (layer === 'back') {
    if (!bowl) fill(ctx, 'M373 508 C437 489 439 579 374 576 L374 567 C425 569 423 507 374 517 Z', shade(p.body, -5), p.edge, 1);
    ell(ctx, 330, 486, rx, ry, p.rim);
    ell(ctx, 330, 485, rx - 4, ry - 3, p.inside);
    return;
  }
  const body = bowl
    ? 'M250 486 A80 14 0 0 0 410 486 C405 526 382 548 350 559 L350 564 Q330 570 310 564 L310 559 C278 548 255 526 250 486 Z'
    : 'M282 486 A48 10 0 0 0 378 486 L376 575 Q375 599 355 600 L305 600 Q285 599 284 575 Z';
  fill(ctx, body, vaseGrad(ctx, p, left - 8, right + 8), p.edge, 1);
  fill(ctx, `M${left} 486 A${rx} ${ry} 0 0 0 ${right} 486 L${right - 4} 486 A${rx - 4} ${ry - 3} 0 0 1 ${left + 4} 486 Z`, p.rim);
}

// ---- 高脚瓶 ----
function drawUrn(ctx, key, p, layer) {
  const y = key === 'urnhigh' ? 446 : 486, foot = key === 'urnhigh' ? 685 : 650;
  if (layer === 'back') {
    ell(ctx, 330, y, 59, 12, p.rim);
    ell(ctx, 330, y - 1, 49, 8, p.inside);
    return;
  }
  const g = vaseGrad(ctx, p, 271, 389), edge = p.edge, body = p.body;
  fill(ctx, `M281 ${foot - 13}H379V${foot}H281Z`, g, edge, 1);
  fill(ctx, `M304 ${foot - 13}Q320 ${foot - 30} 322 ${y + 106}H338Q340 ${foot - 30} 356 ${foot - 13}Z`, g, edge, 1);
  fill(ctx, `M281 ${y}Q287 ${y + 21} 291 ${y + 58}Q294 ${y + 90} 318 ${y + 98}L319 ${y + 110}Q330 ${y + 117} 341 ${y + 110}L342 ${y + 98}Q366 ${y + 90} 369 ${y + 58}Q373 ${y + 21} 379 ${y}A49 8 0 0 1 281 ${y}Z`, g, edge, 1);
  ctx.globalAlpha = 0.5;
  for (const x of [-35, -21, -7, 7, 21, 35])
    strokeOnly(ctx, `M${330 + x} ${y + 10}Q${330 + x * .8} ${y + 53} ${330 + x * .6} ${y + 78}Q${330 + x * .35} ${y + 94} 330 ${y + 98}`, shade(body, x % 2 ? -15 : 8), 3);
  ctx.globalAlpha = 0.65;
  for (const x of [-12, 0, 12])
    strokeOnly(ctx, `M${330 + x * .35} ${y + 121}Q${330 + x * .6} ${foot - 37} ${330 + x} ${foot - 18}`, edge, 1);
  ctx.globalAlpha = 1;
  fill(ctx, `M271 ${y}A59 12 0 0 0 389 ${y}L379 ${y}A49 8 0 0 1 281 ${y}Z`, shade(body, 7), edge, 1);
  strokeOnly(ctx, `M294 ${y + 63}Q330 ${y + 77} 366 ${y + 63}`, edge, 1);
}

// ---- 包花纸 ----
const PAPER_LEFT = 'M245 300 C251 394 265 490 288 542 C302 563 319 577 330 584 C341 578 362 556 374 535 Q330 529 301 487 C271 448 254 368 245 300 Z';
const PAPER_RIGHT = 'M415 300 C409 394 395 490 372 542 C355 563 338 577 328 584 Q321 587 320 578 C322 560 349 517 364 480 Q393 385 415 300 Z';
function wrapTransform(ctx, key) {
  ctx.translate(0, -25);
  ctx.translate(330, 568);
  ctx.scale(key === 'canvaswrap' ? 1.9771375 : 1.71925, 1.495);
  ctx.translate(-330, -568);
}
function wrapOutline(key) {
  return key === 'canvaswrap'
    ? 'M248 278 Q330 306 412 278 L412 300 C406 399 392 492 369 530 L292 530 C271 493 257 395 248 300 Z'
    : 'M245 278 Q330 306 415 278 L415 300 C409 394 395 490 372 542 Q351 574 330 588 Q306 567 288 542 C265 490 251 394 245 300 Z';
}
function drawPaper(ctx, p, layer) {
  ctx.save();
  wrapTransform(ctx, 'paper');
  const g = vaseGrad(ctx, p, 245, 415);
  if (layer === 'back') {
    fill(ctx, 'M245 300 Q330 328 415 300 C409 394 395 490 372 542 Q351 574 330 588 Q306 567 288 542 C265 490 251 394 245 300 Z', shade(p.body, -16), p.edge, 0.6);
  } else {
    fill(ctx, 'M322 577 Q330 573 338 577 C353 583 357 598 358 616 L359 651 Q330 657 301 651 L302 616 C303 598 307 583 322 577 Z', g, p.edge, 0.6);
    fill(ctx, PAPER_RIGHT, shade(p.body, -7), p.edge, 0.6);
    fill(ctx, PAPER_LEFT, g, p.edge, 0.6);
    ctx.globalAlpha = 0.3; ctx.lineCap = 'round';
    strokeOnly(ctx, 'M314 562 Q324 574 330 580 M347 565 Q338 575 334 581 M328 587 Q326 598 323 606 M333 588 Q335 598 337 603', p.edge, 0.7);
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

// ---- 帆布花束 ----
function drawCanvasWrap(ctx, p, layer) {
  ctx.save();
  wrapTransform(ctx, 'canvaswrap');
  const g = vaseGrad(ctx, p, 245, 415), edge = p.edge, body = p.body;
  if (layer === 'back') {
    fill(ctx, 'M245 300 Q286 325 330 319 Q379 325 415 300 C409 410 392 502 372 542 Q350 577 330 588 Q306 567 288 542 C267 490 251 394 245 300Z', shade(body, -17), edge, 0.6);
  } else {
    fill(ctx, 'M322 577Q330 573 338 577C354 584 359 610 359 650Q344 657 331 653Q315 658 301 651C302 616 304 587 322 577Z', g);
    fill(ctx, 'M415 300C409 399 395 492 372 542Q352 568 330 584Q318 588 320 578C324 553 352 511 364 480Q392 389 415 300Z', shade(body, -6));
    fill(ctx, 'M245 300C254 395 268 493 289 541Q309 566 330 584Q353 569 374 535C341 534 318 516 301 487Q264 437 245 300Z', g);
    ctx.globalAlpha = 0.55;
    ctx.setLineDash([1.2, 2]);
    strokeOnly(ctx, 'M250 329Q260 441 295 526M407 331Q397 443 369 524', edge, 0.6);
    ctx.setLineDash([]);
    ctx.globalAlpha = 0.32; ctx.lineCap = 'round';
    strokeOnly(ctx, 'M301 552Q320 572 330 581M360 550Q340 574 332 582M322 592Q312 618 311 638M338 593Q349 618 349 639', edge, 1.2);
    ctx.globalAlpha = 1;
    // 蝴蝶结
    ctx.save();
    ctx.translate(330, 584); ctx.scale(1.914956516, 2.2022); ctx.translate(-330, -584);
    fill(ctx, 'M328 583C316 576 306 562 303 571C298 584 317 588 328 585Z M332 583C344 576 354 562 357 571C362 584 343 588 332 585Z', '#faf9f4', '#d9d6cf', 0.7);
    fill(ctx, 'M326 585Q321 596 310 607L310 600L304 601Q317 589 325 583Z M334 585Q339 596 350 607L350 600L356 601Q343 589 335 583Z', '#faf9f4', '#d9d6cf', 0.7);
    ell(ctx, 330, 584, 5, 3.5, '#faf9f4');
    ctx.restore();
    // 布边纤维
    ctx.globalAlpha = 0.8;
    ctx.strokeStyle = edge; ctx.lineWidth = 0.5;
    ctx.beginPath();
    for (let n = 0; n < 85; n++) {
      const t = (n % 43) / 42, u = 1 - t, right = n > 42;
      const x = right ? u * u * 330 + 2 * u * t * 379 + t * t * 415 : u * u * 245 + 2 * u * t * 286 + t * t * 330;
      const y = right ? u * u * 319 + 2 * u * t * 325 + t * t * 300 : u * u * 300 + 2 * u * t * 325 + t * t * 319;
      const dy = 2.2 + (n % 5) * .8;
      ctx.moveTo(x, y + .4); ctx.lineTo(x + (n % 3 - 1) * .7, y + .4 - dy);
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

// ---- 裸花束 ----
function drawNaked(ctx, p, layer) {
  ctx.save();
  ctx.translate(0, -25);
  if (layer === 'back') {
    for (const [x, y, a, k] of [[-49, 486, -45, 1], [49, 486, 45, 1], [-26, 462, -22, .9], [28, 457, 25, .86], [-64, 514, -67, .8], [66, 515, 68, .82]]) {
      ctx.save();
      ctx.translate(330, 540); ctx.rotate(a * Math.PI / 180); ctx.scale(k * 1.4, k * 1.4);
      fill(ctx, 'M0 0Q-32 -32 0 -91Q30 -31 0 0Z', a < 0 ? '#7f8c70' : '#929d7e');
      strokeOnly(ctx, `M0 -3V-${119 * k}`, '#b1b8a1', 0.8);
      ctx.restore();
    }
  } else {
    for (let j = 0; j < 13; j++) {
      const x = 319 + j * 1.8, end = 307 + j * 3.7;
      strokeOnly(ctx, `M${x} 532Q${x + (j - 6) * .3} 590 ${end} ${647 + (j % 3) * 5}`, ['#79866a', '#909c7a', '#a0a88a'][j % 3], 3.2, 'round');
    }
    fill(ctx, 'M317 537Q330 542 343 537L344 547Q330 552 316 547Z', '#b6a58b');
    strokeOnly(ctx, 'M317 540Q330 545 343 540M317 544Q330 549 343 544', '#95856f', 0.8);
  }
  ctx.restore();
}

// ---- 复古电视机 ----
function drawTelevision(ctx, p, layer) {
  ctx.save();
  ctx.translate(-48, -40); ctx.translate(330, 526); ctx.scale(1.4, 1.4); ctx.translate(-330, -526);
  const edge = p.edge, body = p.body, low = shade(body, -17), light = shade(body, 7);
  const g = vaseGrad(ctx, p, 252, 459);
  if (layer === 'back') {
    roundRect(ctx, 252, 402, 207, 211, 15, g, edge);
    roundRect(ctx, 264, 417, 132, 132, 5, low);
    fill(ctx, 'M270 423H390V543H270Z', '#41463d');
  } else {
    ctx.globalAlpha = 0.48;
    fill(ctx, 'M270 423H299L288 437L293 454L278 446L270 468Z', '#9eaaa3', '#c0c9bd', 0.8);
    fill(ctx, 'M344 423H390V469L374 454L380 439L359 447Z', '#9eaaa3', '#c0c9bd', 0.8);
    fill(ctx, 'M270 490L283 503L278 519L299 536L290 543H270Z', '#9eaaa3', '#c0c9bd', 0.8);
    fill(ctx, 'M390 489L379 501L386 516L369 527L375 543H390Z', '#9eaaa3', '#c0c9bd', 0.8);
    fill(ctx, 'M311 543L319 531L328 543Z', '#9eaaa3', '#c0c9bd', 0.8);
    ctx.globalAlpha = 1;
    strokeOnly(ctx, 'M270 423 279 423 273 441 286 450 272 462M390 428 381 445 389 459M270 514 282 530 278 543M390 509 377 526 385 543', '#aeb5a7', 1.3);
    strokeOnly(ctx, 'M285 401 266 367M355 401 377 355', '#76786f', 2, 'round');
    ell(ctx, 324, 401, 27, 5, low);
    ctx.beginPath(); ctx.arc(428, 447, 12, 0, Math.PI * 2); ctx.fillStyle = low; ctx.fill();
    ctx.strokeStyle = edge; ctx.lineWidth = 1; ctx.stroke();
    strokeOnly(ctx, 'M422 453 434 441', light, 2);
    ctx.beginPath(); ctx.arc(428, 483, 8, 0, Math.PI * 2); ctx.fillStyle = low; ctx.fill();
    ctx.strokeStyle = low; ctx.lineWidth = 1.3; ctx.beginPath();
    for (let j = 0; j < 7; j++) { ctx.moveTo(415, 514 + j * 5); ctx.lineTo(441, 514 + j * 5); }
    ctx.stroke();
    fill(ctx, 'M270 613 264 633h14l8 -20M422 613l7 20h13l-4 -20', low);
    strokeOnly(ctx, 'M269 588h30', edge, 1);
  }
  ctx.restore();
}
function roundRect(ctx, x, y, w, h, r, style, stroke) {
  ctx.beginPath();
  pathTo(ctx, `M${x + r} ${y}H${x + w - r}Q${x + w} ${y} ${x + w} ${y + r}V${y + h - r}Q${x + w} ${y + h} ${x + w - r} ${y + h}H${x + r}Q${x} ${y + h} ${x} ${y + h - r}V${y + r}Q${x} ${y} ${x + r} ${y}Z`);
  ctx.fillStyle = style; ctx.fill();
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1; ctx.stroke(); }
}

// ---- 贵宾犬 ----
function drawPoodle(ctx, p, layer) {
  const edge = p.edge, body = p.body, low = shade(body, -17), light = shade(body, 7);
  const torso = 'M297 472Q281 496 277 533Q261 559 263 593Q257 610 266 622Q279 636 299 625H361Q384 637 395 621Q402 607 395 590Q400 563 382 535Q380 497 363 472Z';
  const head = 'M284 424Q279 413 288 409Q283 397 296 394Q296 381 310 384Q319 373 330 381Q343 374 351 385Q367 381 368 395Q381 398 375 410Q385 420 375 431Q380 450 366 463Q353 480 330 480Q305 480 291 463Q278 448 284 424Z';
  if (layer === 'back') {
    const g = vaseGrad(ctx, p, 257, 402);
    fill(ctx, torso, g, edge, 1);
    fill(ctx, 'M291 414Q273 410 268 431Q257 454 267 474Q266 488 279 492Q290 500 299 485L307 431Z M369 414Q387 410 392 431Q403 454 393 474Q394 488 381 492Q370 500 361 485L353 431Z', shade(body, -14), edge, 1);
    fill(ctx, head, body, edge, 1);
    fill(ctx, 'M305 537Q298 552 300 568L294 614Q281 634 304 638Q323 642 324 626L330 553L336 626Q337 642 356 638Q379 634 366 614L360 568Q362 552 355 537', body, edge, 1);
    const eye = parseInt(body.slice(1, 3), 16) < 90 ? '#f3f1e9' : '#343730';
    ell(ctx, 314, 437, 3.5, 3, eye);
    ell(ctx, 346, 437, 3.5, 3, eye);
    fill(ctx, 'M330 450Q316 442 306 452Q297 463 307 471Q318 480 330 474Q342 480 353 471Q363 463 354 452Q344 442 330 450Z', light);
    fill(ctx, 'M321 451Q330 447 339 451Q341 457 330 462Q319 457 321 451Z', '#43463e');
    ctx.lineCap = 'round';
    strokeOnly(ctx, 'M330 462v5m0 0q-5 5-10 1m10-1q5 5 10 1', low, 1.1);
    // 卷毛（裁剪在身体范围内）
    ctx.save();
    ctx.beginPath();
    pathTo(ctx, torso);
    pathTo(ctx, head);
    ctx.clip();
    let curls = '';
    const locks = [[302, 401, 1], [320, 412, .8], [340, 412, .9], [355, 402, 1], [291, 422, .8], [366, 424, .8], [301, 449, .7], [358, 451, .8], [312, 481, 1], [333, 485, .9], [350, 484, .85], [297, 507, 1], [320, 509, 1], [343, 510, .9], [366, 510, .9], [285, 539, 1], [373, 541, 1], [278, 571, 1], [382, 573, 1], [310, 560, .8], [350, 559, .8], [307, 590, .9], [353, 591, .9], [280, 607, .8], [379, 608, .8]];
    ctx.strokeStyle = edge; ctx.lineWidth = 0.8; ctx.lineCap = 'round'; ctx.globalAlpha = 0.55;
    ctx.beginPath();
    for (const [x, y, k] of locks) {
      ctx.save(); ctx.translate(x, y); ctx.scale(k, k);
      pathTo(ctx, 'M-5 0Q-9 -7 -3 -8Q3 -9 2 -3Q1 1 6 2Q11 3 9 8');
      ctx.restore();
    }
    ctx.stroke();
    ctx.globalAlpha = 0.6;
    strokeOnly(ctx, 'M277 436q-6 9 -3 18m5 -2q-6 11 -1 21m106 -37q6 9 3 18m-5 -2q6 11 1 21', edge, 1);
    ctx.restore();
    ctx.globalAlpha = 1;
    ell(ctx, 330, 397, 18, 5, p.rim);
    ell(ctx, 330, 397, 15, 3.2, p.inside);
  } else {
    fill(ctx, 'M312 397A18 5 0 0 0 348 397L347 402Q330 408 313 402Z', body, edge, 0.7);
  }
}

// ---- 打字机 ----
function drawTypewriter(ctx, p, layer) {
  ctx.save();
  ctx.translate(330, 493); ctx.scale(1.2, 1.2); ctx.translate(-330, -493);
  const edge = p.edge, body = p.body, low = shade(body, -17), light = shade(body, 7);
  const g = vaseGrad(ctx, p, 221, 439);
  if (layer === 'back') {
    fill(ctx, 'M242 480h176v47H242Z', low);
    roundRect(ctx, 250, 470, 160, 18, 8, '#565a52');
    strokeOnly(ctx, 'M258 477h144', '#969b8c', 1);
    fill(ctx, 'M252 489H408L428 580H232Z', g, edge, 1);
    fill(ctx, 'M296 488Q330 474 364 488L360 512H300Z', p.inside);
  } else {
    fill(ctx, 'M250 511H410L439 595Q440 609 425 612H234Q220 610 221 596Z', g, edge, 1);
    fill(ctx, 'M264 523H396L414 582H246Z', low);
    for (let row = 0; row < 4; row++) {
      for (let j = 0; j < 10 - row % 2; j++) {
        const cx = 330 + (j - (9 - row % 2) / 2) * (13 + row * .5);
        const cy = 537 + row * 12;
        ctx.beginPath(); ctx.ellipse(cx, cy, 5.2, 3.8, 0, 0, Math.PI * 2);
        ctx.fillStyle = light; ctx.fill();
        ctx.strokeStyle = edge; ctx.lineWidth = 0.7; ctx.stroke();
      }
    }
    roundRect(ctx, 282, 586, 95, 6, 2, low);
    fill(ctx, 'M238 612v7h22v-7M402 612v7h22v-7', '#666b61');
    strokeOnly(ctx, 'M251 506 259 500M416 594l10 -4', edge, 1);
  }
  ctx.restore();
}

function drawVase(ctx, key, palette, layer) {
  if (key === 'urnlow' || key === 'urnhigh') return drawUrn(ctx, key, palette, layer);
  if (key === 'mug' || key === 'bowl') return drawEveryday(ctx, key, palette, layer);
  if (key === 'paper') return drawPaper(ctx, palette, layer);
  if (key === 'canvaswrap') return drawCanvasWrap(ctx, palette, layer);
  if (key === 'naked') return drawNaked(ctx, palette, layer);
  if (key === 'television') return drawTelevision(ctx, palette, layer);
  if (key === 'poodle') return drawPoodle(ctx, palette, layer);
  if (key === 'typewriter') return drawTypewriter(ctx, palette, layer);
  return drawStandard(ctx, key, palette, layer);
}

// 花茎裁剪：细长瓶瓶口 / 特殊容器开口
function applyStemClip(ctx, vase) {
  if (vase === 'columnlow' || vase === 'columnhigh') {
    const mouth = stemBase(vase);
    ctx.beginPath();
    pathTo(ctx, `M-2000 -2000H2660V${mouth}H-2000Z`);
    ctx.ellipse(330, mouth, 18, 5, 0, 0, Math.PI * 2);
    ctx.clip();
    return true;
  }
  const spec = { television: [84, 282, 342], poodle: [16, 330, stemBase('poodle') - 8], typewriter: [36, 330, stemBase('typewriter') - 9.6] }[vase];
  if (spec) {
    const [half, cx, top] = spec, base = stemBase(vase);
    ctx.beginPath();
    pathTo(ctx, `M-2000 -2000H2660V${top}H${cx + half}V${base + 2}H${cx - half}V${top}H-2000Z`);
    ctx.clip();
    return true;
  }
  return false;
}

// 包花纸：花材整体裁剪进包装轮廓
function applyWrapClip(ctx, vase) {
  ctx.save();
  wrapTransform(ctx, vase);
  ctx.beginPath();
  pathTo(ctx, wrapOutline(vase));
  ctx.clip();
}

module.exports = { drawVase, stemBase, vaseShadow, applyStemClip, applyWrapClip, wrappedVessel, shade };
