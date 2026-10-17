// 花材烘焙：复用 app.js 的纯绘制函数，生成包含全部花材×花色×变体的 flowers.html
// 用法: node tools/gen-flowers.js
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'tools', 'out');
fs.mkdirSync(OUT, { recursive: true });

// ---- 1. 提取 app.js 中的纯函数（按行，跳过所有 DOM 绑定）----
const lines = fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8').split('\n');
const pick = (a, b) => lines.slice(a - 1, b).join('\n');
const code = [
  pick(1, 69),     // NS, data, $, state, vaseSizes, vaseColors, backgroundColors
  pick(71, 161),   // 花瓶绘制 + history + variation/tint
  pick(162, 253),  // 全部花材绘制函数 + minimumHeight + render(def)
  pick(255, 261),  // 分类集合
  pick(295, 351),  // looseFlowerCenter, newBotanicalHead
  pick(352, 400),  // newBotanicalSpray
  pick(403, 429),  // roseSideBloom
  pick(433, 499),  // newLeafMarkup, ruscusBranch
].join('\n');
const factory = new Function(code + `
;globalThis.__setVaseColor = c => { vaseColor = c; };
return { data, flower, sprite, paintedImage, gardenMarkup, gardenSprite, extraMarkup, extraDimensions,
  newBotanicalSpray, newLeafMarkup, lisianthusSpray, foliageMarkup, ruscusBranch, stemGeometry,
  variedSpray, minimumHeight, leafModule, referencePiece, specimen, vaseThumbnail, shade, tint,
  materialCategory, vaseSizes, vaseColors, specialVessels, vesselNames, backgroundColors };`);
const W = factory();

// ---- 2. 提取 index.html 的隐藏滤镜 defs ----
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const svgStart = html.indexOf('<svg width="0" height="0"');
const svgEnd = html.indexOf('</svg>', svgStart) + 6;
const hiddenDefs = html.slice(svgStart, svgEnd);

// ---- 3. 生成 tone-* 换色滤镜（与 updatePalette 同一公式）----
const allColors = new Set();
for (const d of W.data) for (const c of d.colors) allColors.add(c[1]);
const toneDefs = [...allColors].map(color => {
  const [r, g, b] = color.slice(1).match(/../g).map(v => parseInt(v, 16) / 255);
  const pale = Math.min(r, g, b) > .68, slope = pale ? .16 : .8, base = pale ? .84 : .2;
  return `<filter id="tone-${color.slice(1)}" color-interpolation-filters="sRGB"><feColorMatrix type="saturate" values="0"/><feComponentTransfer><feFuncR type="linear" slope="${slope}" intercept="${base}"/><feFuncG type="linear" slope="${slope}" intercept="${base}"/><feFuncB type="linear" slope="${slope}" intercept="${base}"/></feComponentTransfer><feColorMatrix type="matrix" values="${r} 0 0 0 0 0 ${g} 0 0 0 0 0 ${b} 0 0 0 0 0 1 0"/></filter>`;
}).join('');

// ---- 4. 烘焙清单 ----
const VARIANTS = {
  sunflower: [0, 1, 2], kingprotea: [0, 1], lily: [0, 1], poppy: [0, 1, 2],
  waxflower: [0, 1], astilbe: [0, 1], fountaingrass: [0, 1], lilyofthevalley: [0, 1],
  fishtailfern: [0, 1, 2, 3, 4, 5], silveroak: [0, 1, 2, 3], irisleaf: [0, 1],
  doublelisianthus: [0, 1], chamomile: [0, 1, 2, 3],
};
const PIECES = {
  // kind: [锚点来源表, 键]
  'silver-dollar-single': 'leaf', 'silver-dollar': 'leaf', 'silver-dollar-tip': 'leaf',
  'pointed': 'leaf', 'pointed-tip': 'leaf', 'monstera': 'leaf',
  'eucalyptus': 'ref', 'eucalyptus-tip': 'ref', 'cedar': 'ref', 'cedar-tip': 'ref',
};
const leafCrops = { 'silver-dollar-single': [40, 745, 288, 420, 319, 1135], 'silver-dollar': [40, 745, 565, 420, 319, 1135], 'silver-dollar-tip': [725, 725, 440, 440, 939, 1134], pointed: [64, 87, 412, 400, 278, 479], 'pointed-tip': [648, 72, 247, 415, 779, 480], monstera: [1048, 73, 442, 445, 1285, 508] };
const referenceCrops = { eucalyptus: [47, 810, 335, 180, 208, 904], 'eucalyptus-tip': [420, 743, 317, 276, 568, 1004], cedar: [780, 723, 306, 320, 886, 1030], 'cedar-tip': [1180, 723, 208, 327, 1290, 1035] };

function modeOf(d) {
  if (d.vectorHead) return 'head';
  if (d.foliage) return 'pieces';
  if (d.vectorLeaf || d.bakedFoliage) return 'whole';
  if (d.extra || d.newAtlas || d.leafAtlas || d.vectorSpray) return 'hang';
  return 'head';
}

const entries = []; // {key, mode, vb, p0:[x,y], cap, markup}
function addEntry(key, mode, vb, p0, cap, markup) {
  entries.push({ key, mode, vb: vb.join(' '), p0, cap, markup });
}

// ---- 样稿花：波斯菊（完全在烘焙脚本内注入，绝不改动 app.js 的硬编码行号结构）----
{
  const COSMOS = { size:33, colors:[['白','#fcfaf2'],['柔粉','#e8a9c0'],['玫紅','#cf4f6e'],['紫紅','#9b4a78']] };
  const M = Math.ceil(COSMOS.size*1.5+18); // 66
  const cosmosMarkup = hex => {
    const light = W.shade(hex, 18), edge = W.shade(hex, -32);
    const core = '#e9c25c', coreDark = W.shade(core, -25), petals = 8;
    let o = '';
    for (let j = 0; j < petals; j++) {
      o += `<g transform="rotate(${j * 360 / petals})">`
        + `<path d="M0 -6 C-6 -18 -6.5 -36 0 -45 C6.5 -36 6 -18 0 -6Z" fill="${hex}" stroke="${edge}" stroke-width="1.6" stroke-linejoin="round"/>`
        + `<path d="M0 -11 C-2 -23 -2 -35 0 -42 C2 -35 2 -23 0 -11Z" fill="${light}" opacity="0.5"/>`
        + `</g>`;
    }
    o += `<circle cx="0" cy="0" r="9" fill="${core}"/>`;
    o += `<circle cx="0" cy="0" r="9" fill="none" stroke="${coreDark}" stroke-width="1.2"/>`;
    for (let j = 0; j < 12; j++) { const a = j * 30; o += `<circle cx="${Math.cos(a) * 4.6}" cy="${Math.sin(a) * 4.6}" r="0.9" fill="${coreDark}"/>`; }
    return `<g transform="rotate(0)">${o}</g>`;
  };
  for (let ci=0; ci<COSMOS.colors.length; ci++){
    const hex = COSMOS.colors[ci][1];
    addEntry(`cosmos_c${ci}`, 'head', [-M,-M,2*M,2*M], [0,0], 210, cosmosMarkup(hex));
  }
}

// ---- 批量主花：8 朵（全部注入，绝不改 app.js 硬编码行号结构）----
function bake(id, size, colors, markup) {
  const M = Math.ceil(size * 1.5 + 18);
  for (let ci = 0; ci < colors.length; ci++)
    addEntry(`${id}_c${ci}`, 'head', [-M, -M, 2 * M, 2 * M], [0, 0], 210, markup(colors[ci][1]));
}

// 小雏菊 Daisy
bake('daisy', 22, [['白','#fcfaf2'],['奶黄','#f0e2b0'],['亮黄','#e9cd65'],['淡粉','#f3d2dc']], hex => {
  const edge = W.shade(hex,-30), core = '#e9c25c', coreDark = W.shade(core,-28);
  let o = '';
  for (let j=0;j<14;j++) o += `<g transform="rotate(${j*360/14})"><path d="M0 -10 C-4 -22 -4 -42 0 -48 C4 -42 4 -22 0 -10Z" fill="${hex}" stroke="${edge}" stroke-width="1.3"/></g>`;
  o += `<circle r="11" fill="${core}"/><circle r="11" fill="none" stroke="${coreDark}" stroke-width="1.1"/>`;
  for (let j=0;j<10;j++){ const a=j*36; o += `<circle cx="${Math.cos(a*Math.PI/180)*5}" cy="${Math.sin(a*Math.PI/180)*5}" r="0.8" fill="${coreDark}"/>`; }
  return `<g>${o}</g>`;
});

// 银莲花 Anemone
bake('anemone', 30, [['红','#c0392b'],['白','#fcfaf2'],['紫','#8a6a9c'],['玫红','#d5697e']], hex => {
  const edge = W.shade(hex,-28), core = '#2c2433', coreEdge = W.shade(core,45), ant = '#e8d27a';
  let o = '';
  for (let j=0;j<6;j++) o += `<g transform="rotate(${j*360/6})"><path d="M0 -8 C-13 -16 -14 -40 0 -46 C14 -40 13 -16 0 -8Z" fill="${hex}" stroke="${edge}" stroke-width="1.4"/></g>`;
  o += `<circle r="13" fill="${core}"/><circle r="13" fill="none" stroke="${coreEdge}" stroke-width="1.2"/>`;
  for (let j=0;j<14;j++){ const a=j*360/14, r=6+(j%2)*3; o += `<circle cx="${Math.cos(a*Math.PI/180)*r}" cy="${Math.sin(a*Math.PI/180)*r}" r="1.1" fill="${ant}"/>`; }
  return `<g>${o}</g>`;
});

// 金槌花 Craspedia
bake('craspedia', 24, [['金','#e6c64f'],['橙','#e0972f']], hex => {
  const edge = W.shade(hex,-30), light = W.shade(hex,20), dot = W.shade(hex,-12);
  let o = `<circle r="30" fill="${hex}"/><circle r="30" fill="none" stroke="${edge}" stroke-width="1.4"/><circle cx="-9" cy="-9" r="10" fill="${light}" opacity="0.4"/>`;
  for (let ring=1; ring<=3; ring++){ const n=ring*6, r=ring*8; for (let j=0;j<n;j++){ const a=j*360/n+ring; o += `<circle cx="${Math.cos(a*Math.PI/180)*r}" cy="${Math.sin(a*Math.PI/180)*r}" r="1.4" fill="${dot}"/>`; } }
  o += `<circle r="2.2" fill="${dot}"/>`;
  return `<g>${o}</g>`;
});

// 马蹄莲 Calla Lily
bake('calla', 34, [['白','#fcfaf2'],['粉','#f0c2d2'],['紫','#9b6fb0'],['黄','#ecd271']], hex => {
  const edge = W.shade(hex,-26), light = W.shade(hex,18), spadix = '#e3c25c';
  const horn = 'M-20 -40 C-24 -8 -12 16 0 20 C12 16 24 -8 20 -40 C10 -28 -10 -28 -20 -40Z';
  let o = `<path d="${horn}" fill="${hex}" stroke="${edge}" stroke-width="1.5"/><path d="${horn}" fill="${light}" opacity="0.25"/><ellipse cx="0" cy="-8" rx="3.2" ry="22" fill="${spadix}"/>`;
  return `<g>${o}</g>`;
});

// 朱顶红 Amaryllis
bake('amaryllis', 36, [['红','#c33b4a'],['白','#fcfaf2'],['粉','#ef9bb0'],['橙红','#e07a3c']], hex => {
  const edge = W.shade(hex,-26), light = W.shade(hex,20); let o = '';
  for (let j=0;j<6;j++) o += `<g transform="rotate(${j*360/6})"><path d="M0 -6 C-9 -20 -7 -44 0 -50 C7 -44 9 -20 0 -6Z" fill="${hex}" stroke="${edge}" stroke-width="1.5"/><path d="M0 -16 C-2.5 -28 -2 -40 0 -48 C2 -40 2.5 -28 0 -16Z" fill="${light}" opacity="0.5"/></g>`;
  return `<g>${o}</g>`;
});

// 大花葱 Allium
bake('allium', 28, [['紫','#8e6fae'],['白','#f3f0f6'],['粉','#d9a7c2']], hex => {
  const edge = W.shade(hex,-24), dot = W.shade(hex,-14), dot2 = W.shade(hex,22); let o = `<circle r="30" fill="none" stroke="${edge}" stroke-width="1.1"/>`;
  for (let ring=0; ring<4; ring++){ const n=8+ring*5, r=ring*8; for (let j=0;j<n;j++){ const a=j*360/n; const c=ring%2?dot2:dot; o += `<circle cx="${Math.cos(a*Math.PI/180)*r}" cy="${Math.sin(a*Math.PI/180)*r}" r="2.2" fill="${c}"/>`; } }
  return `<g>${o}</g>`;
});

// 六出花 Alstroemeria
bake('alstro', 30, [['橙','#e89a4e'],['粉','#ef9bb5'],['黄','#ecd271'],['白','#fcfaf2']], hex => {
  const edge = W.shade(hex,-26), spot = W.shade(hex,-18); let o = '';
  for (let j=0;j<6;j++){ o += `<g transform="rotate(${j*360/6})"><path d="M0 -6 C-8 -20 -6 -42 0 -46 C6 -42 8 -20 0 -6Z" fill="${hex}" stroke="${edge}" stroke-width="1.4"/>`; for (let k=1;k<=3;k++) o += `<circle cx="${(k-2)*2.2}" cy="${-12-k*7}" r="1.1" fill="${spot}" opacity="0.7"/>`; o += `</g>`; }
  return `<g>${o}</g>`;
});

// 翠珠花 Ammi
bake('ammi', 30, [['白','#fcfaf2'],['奶绿','#eef0dc']], hex => {
  const edge = W.shade(hex,-22);
  const floret = (x,y,s) => `<g transform="translate(${x} ${y}) scale(${s})"><circle cx="0" cy="-2.4" r="1.6" fill="${hex}" stroke="${edge}" stroke-width="0.6"/><circle cx="2.4" cy="0" r="1.6" fill="${hex}" stroke="${edge}" stroke-width="0.6"/><circle cx="0" cy="2.4" r="1.6" fill="${hex}" stroke="${edge}" stroke-width="0.6"/><circle cx="-2.4" cy="0" r="1.6" fill="${hex}" stroke="${edge}" stroke-width="0.6"/><circle cx="0" cy="0" r="0.9" fill="${edge}"/></g>`;
  let o = floret(0,0,1.0);
  for (let ring=1; ring<=3; ring++){ const n=ring*6, r=ring*9; for (let j=0;j<n;j++){ const a=j*360/n+ring*7; o += floret(Math.cos(a*Math.PI/180)*r, Math.sin(a*Math.PI/180)*r, 1-ring*0.18); } }
  return `<g>${o}</g>`;
});

// ---- 批量配花：8 朵（filler，全部注入，绝不改 app.js）----
// 勿忘我 Myosotis
bake('myosotis', 16, [['蓝','#7fa6d8'],['白','#fcfaf2'],['粉','#f0c2d2']], hex => {
  const edge = W.shade(hex,-26), eye = '#e9c25c';
  const fl = (x,y,r) => { let p=''; for (let k=0;k<5;k++){ const a=k*72*Math.PI/180; p+=`<circle cx="${(Math.cos(a)*r).toFixed(1)}" cy="${(Math.sin(a)*r).toFixed(1)}" r="3.2" fill="${hex}" stroke="${edge}" stroke-width="0.9"/>`; } return `<g transform="translate(${x} ${y})">${p}<circle r="1.6" fill="${eye}"/></g>`; };
  return `<g>${fl(-9,-6,4.2)}${fl(9,-6,4.2)}${fl(0,9,4.2)}${fl(-4,2,3.2)}${fl(5,3,3.2)}</g>`;
});

// 风信子 Hyacinth
bake('hyacinth', 18, [['紫','#8e6fae'],['粉','#ef9bb5'],['白','#fcfaf2'],['蓝','#7fa6d8']], hex => {
  const edge = W.shade(hex,-24), light = W.shade(hex,18);
  const fl = (x,y) => `<g transform="translate(${x} ${y})"><circle cx="0" cy="-3" r="2.6" fill="${hex}" stroke="${edge}" stroke-width="0.7"/><circle cx="3" cy="0" r="2.6" fill="${hex}" stroke="${edge}" stroke-width="0.7"/><circle cx="0" cy="3" r="2.6" fill="${hex}" stroke="${edge}" stroke-width="0.7"/><circle cx="-3" cy="0" r="2.6" fill="${hex}" stroke="${edge}" stroke-width="0.7"/></g>`;
  let o = `<ellipse cx="0" cy="0" rx="16" ry="22" fill="${light}" opacity="0.5"/>`;
  for (let row=-2;row<=2;row++){ const yy=row*9, n=row%2?2:3; for (let c=0;c<n;c++){ const xx=(c-(n-1)/2)*11; o+=fl(xx,yy); } }
  return `<g>${o}</g>`;
});

// 葡萄风信子 Muscari
bake('muscari', 16, [['蓝','#6f8fc0'],['白','#fcfaf2']], hex => {
  const edge = W.shade(hex,-22), light = W.shade(hex,18);
  let o = `<ellipse cx="0" cy="2" rx="13" ry="20" fill="${hex}" opacity="0.35"/>`;
  for (let row=-3;row<=3;row++){ const yy=row*6.2, n=4-Math.abs(row); for (let c=0;c<n;c++){ const xx=(c-(n-1)/2)*6.5; o+=`<circle cx="${xx.toFixed(1)}" cy="${yy.toFixed(1)}" r="3.1" fill="${hex}" stroke="${edge}" stroke-width="0.7"/><circle cx="${(xx-1.2).toFixed(1)}" cy="${(yy-1.2).toFixed(1)}" r="1" fill="${light}" opacity="0.7"/>`; } }
  return `<g>${o}</g>`;
});

// 兔尾草 Lagurus
bake('lagurus', 16, [['奶白','#f0ead8'],['淡粉','#f3d2dc']], hex => {
  const edge = W.shade(hex,-22);
  let o = `<ellipse cx="0" cy="0" rx="13" ry="22" fill="${hex}" stroke="${edge}" stroke-width="1.3"/>`;
  for (let a=0;a<360;a+=20){ const rad=a*Math.PI/180; o+=`<line x1="${(Math.cos(rad)*10).toFixed(1)}" y1="${(Math.sin(rad)*19).toFixed(1)}" x2="${(Math.cos(rad)*15).toFixed(1)}" y2="${(Math.sin(rad)*23).toFixed(1)}" stroke="${edge}" stroke-width="0.6" opacity="0.5"/>`; }
  return `<g>${o}</g>`;
});

// 金合欢 Wattle
bake('wattle', 20, [['金','#e6c64f']], hex => {
  const edge = W.shade(hex,-28), dot = W.shade(hex,-12);
  const ball = (x,y,r) => { let b=`<circle cx="${x}" cy="${y}" r="${r}" fill="${hex}" stroke="${edge}" stroke-width="1.1"/>`; for (let k=0;k<6;k++){ const a=k*60; b+=`<circle cx="${(x+Math.cos(a*Math.PI/180)*r*0.55).toFixed(1)}" cy="${(y+Math.sin(a*Math.PI/180)*r*0.55).toFixed(1)}" r="1.3" fill="${dot}"/>`; } return b; };
  return `<g>${ball(-9,8,9)}${ball(9,8,9)}${ball(0,-10,10)}</g>`;
});

// 黑种草 Nigella
bake('nigella', 18, [['蓝','#7f9ad0'],['白','#fcfaf2'],['紫','#8e6fae']], hex => {
  const edge = W.shade(hex,-24);
  const fl = (x,y,s) => { let p=''; for (let k=0;k<5;k++){ const a=k*72*Math.PI/180; p+=`<ellipse cx="${(Math.cos(a)*5*s).toFixed(1)}" cy="${(Math.sin(a)*5*s).toFixed(1)}" rx="2.4" ry="4.5" transform="rotate(${k*72} ${(Math.cos(a)*5*s).toFixed(1)} ${(Math.sin(a)*5*s).toFixed(1)})" fill="${hex}" stroke="${edge}" stroke-width="0.8"/>`; } return `<g transform="translate(${x} ${y})">${p}<circle r="2" fill="${edge}"/></g>`; };
  return `<g>${fl(0,0,1.4)}${fl(-11,-4,0.9)}${fl(11,-2,0.9)}${fl(0,12,0.8)}</g>`;
});

// 福禄考 Phlox
bake('phlox', 18, [['粉','#ef9bb5'],['白','#fcfaf2'],['紫','#b09ac4'],['红','#d56b86']], hex => {
  const edge = W.shade(hex,-24);
  const fl = (x,y,s) => { let p=''; for (let k=0;k<5;k++){ const a=k*72*Math.PI/180; p+=`<circle cx="${(Math.cos(a)*3*s).toFixed(1)}" cy="${(Math.sin(a)*3*s).toFixed(1)}" r="2.2" fill="${hex}" stroke="${edge}" stroke-width="0.6"/>`; } return `<g transform="translate(${x} ${y})">${p}<circle r="1" fill="${edge}"/></g>`; };
  let o = fl(0,0,1.2);
  for (let ring=1;ring<=2;ring++){ const n=ring*5, r=ring*8; for (let j=0;j<n;j++){ const a=j*360/n+ring*9; o+=fl((Math.cos(a*Math.PI/180)*r).toFixed(1),(Math.sin(a*Math.PI/180)*r).toFixed(1),0.95); } }
  return `<g>${o}</g>`;
});

// 麦穗 Wheat
bake('wheat', 20, [['金','#e0c060'],['棕','#c9a86a']], hex => {
  const edge = W.shade(hex,-26);
  let o = `<line x1="0" y1="38" x2="0" y2="-26" stroke="${edge}" stroke-width="1.6"/>`;
  for (let row=0;row<7;row++){ const yy=-24+row*8.5, g=9-row*0.8; o+=`<ellipse cx="${-g}" cy="${yy}" rx="3.4" ry="7" transform="rotate(35 ${-g} ${yy})" fill="${hex}" stroke="${edge}" stroke-width="0.7"/><ellipse cx="${g}" cy="${yy}" rx="3.4" ry="7" transform="rotate(-35 ${g} ${yy})" fill="${hex}" stroke="${edge}" stroke-width="0.7"/>`; }
  return `<g>${o}</g>`;
});

// ---- 新叶材引擎（完全自包含 SVG，绝不调用 app.js 的 foliageMarkup）----
function leafPath(type, w, L) {
  switch (type) {
    case 'lance': return `M0 0 C ${w} ${-L*0.28} ${w} ${-L*0.72} 0 ${-L} C ${-w} ${-L*0.72} ${-w} ${-L*0.28} 0 0 Z`;
    case 'oval':  return `M0 0 C ${w} ${-L*0.22} ${w} ${-L*0.78} 0 ${-L} C ${-w} ${-L*0.78} ${-w} ${-L*0.22} 0 0 Z`;
    case 'sword': return `M0 0 C ${w} ${-L*0.12} ${w*0.55} ${-L*0.82} 0 ${-L} C ${-w*0.55} ${-L*0.82} ${-w} ${-L*0.12} 0 0 Z`;
    case 'heart': return `M0 0 C ${w*1.25} ${-L*0.16} ${w*0.95} ${-L*0.66} 0 ${-L*0.84} C ${-w*0.95} ${-L*0.66} ${-w*1.25} ${-L*0.16} 0 0 Z`;
  }
  return '';
}
// 沿茎成对布叶的枝条；p0=(0,0) 在茎顶，叶体向下延伸
function buildSprig(opt) {
  const { hex, stemColor = '#7e8d70', leaf, leafW, leafL, n = 6, spread = 55, curve = 10, baseY = 150 } = opt;
  const dark = W.shade(hex, -24), vcol = W.shade(hex, 20);
  const p0 = [0, 0], p1 = [curve * 0.5, baseY * 0.45], p2 = [curve, baseY];
  let s = `<path d="M${p0[0]} ${p0[1]} Q ${p1[0].toFixed(1)} ${p1[1].toFixed(1)} ${p2[0]} ${p2[1]}" stroke="${stemColor}" stroke-width="1.9" fill="none" stroke-linecap="round"/>`;
  const leafMarkup = (x, y, ang, scale = 1) => {
    const L = leafL * scale;
    let g;
    if (leaf === 'round') g = `<ellipse cx="0" cy="${-L/2}" rx="${leafW*scale}" ry="${L/2}" fill="${hex}" stroke="${dark}" stroke-width="1" stroke-linejoin="round"/>`;
    else g = `<path d="${leafPath(leaf, leafW*scale, L)}" fill="${hex}" stroke="${dark}" stroke-width="1" stroke-linejoin="round"/><path d="M0 0 L0 ${-L}" stroke="${vcol}" stroke-width="0.6" opacity="0.55"/>`;
    return `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${ang.toFixed(1)})">${g}</g>`;
  };
  for (let i = 1; i <= n; i++) {
    const t = i / (n + 0.5), u = 1 - t;
    const x = u*u*p0[0] + 2*u*t*p1[0] + t*t*p2[0];
    const y = u*u*p0[1] + 2*u*t*p1[1] + t*t*p2[1];
    s += leafMarkup(x, y, -spread + (i % 2 ? 5 : -5));
    s += leafMarkup(x, y, spread - (i % 2 ? 5 : -5));
  }
  s += leafMarkup(p0[0], p0[1], 0, 0.55); // 顶端单叶（缩短，避免超出烘培格被裁切/污染相邻格）
  return s;
}
// 从基部向上扇形展开的叶片（蒲葵/棕榈）
function buildFan(opt) {
  const { hex, stemColor = '#5f7a45', leaf = 'sword', leafW = 7, leafL = 110, blades = 7, fan = 100 } = opt;
  const dark = W.shade(hex, -24), vcol = W.shade(hex, 20), baseY = 150;
  let s = `<path d="M0 0 L0 ${baseY}" stroke="${stemColor}" stroke-width="2.2" stroke-linecap="round"/>`;
  for (let i = 0; i < blades; i++) {
    const t = blades === 1 ? 0 : (i / (blades - 1) - 0.5) * 2;
    const ang = t * (fan / 2);
    const g = `<path d="${leafPath(leaf, leafW, leafL)}" fill="${hex}" stroke="${dark}" stroke-width="1" stroke-linejoin="round"/><path d="M0 0 L0 ${-leafL}" stroke="${vcol}" stroke-width="0.6" opacity="0.5"/>`;
    s += `<g transform="translate(0 ${baseY}) rotate(${ang.toFixed(1)})">${g}</g>`;
  }
  return s;
}
// 柔荑花序（银柳）：细茎 + 成对毛绒椭圆
function buildCatkin(opt) {
  const { hex, stemColor = '#a7a98c', n = 5, baseY = 150, curve = 12, catW = 5, catL = 16 } = opt;
  const dark = W.shade(hex, -16);
  const p0 = [0, 0], p1 = [curve * 0.5, baseY * 0.45], p2 = [curve, baseY];
  let s = `<path d="M${p0[0]} ${p0[1]} Q ${p1[0].toFixed(1)} ${p1[1].toFixed(1)} ${p2[0]} ${p2[1]}" stroke="${stemColor}" stroke-width="1.6" fill="none" stroke-linecap="round"/>`;
  for (let i = 1; i <= n; i++) {
    const t = i / (n + 0.5), u = 1 - t;
    const x = u*u*p0[0] + 2*u*t*p1[0] + t*t*p2[0];
    const y = u*u*p0[1] + 2*u*t*p1[1] + t*t*p2[1];
    for (const side of [-1, 1])
      s += `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${(side*40).toFixed(1)})"><ellipse cx="0" cy="${-catL/2}" rx="${catW}" ry="${catL/2}" fill="${hex}" opacity="0.92"/><path d="M0 0 L0 ${-catL}" stroke="${dark}" stroke-width="0.5" opacity="0.4"/></g>`;
  }
  return s;
}
function bakeFoliage(id, colors, makeSprig) {
  const VB = [-110, -25, 220, 210];
  for (let ci = 0; ci < colors.length; ci++)
    addEntry(`${id}_c${ci}`, 'whole', VB, [0, 0], 200, `<g>${makeSprig(colors[ci][1])}</g>`);
}
const NEW_FOLIAGE = [
  { id: 'oliveleaf', colors: [['銀綠', '#c7cda2'], ['灰綠', '#aab08a'], ['橄欖', '#8b9560']],
    make: hex => buildSprig({ hex, stemColor: '#8f956f', leaf: 'lance', leafW: 5, leafL: 34, n: 6, spread: 52, curve: 12 }) },
  { id: 'ivy', colors: [['綠', '#5f8f4e'], ['深綠', '#3f6b34'], ['黃綠', '#86a85a']],
    make: hex => buildSprig({ hex, stemColor: '#5f7a45', leaf: 'heart', leafW: 12, leafL: 24, n: 5, spread: 60, curve: 16 }) },
  { id: 'sage', colors: [['灰綠', '#9fae8a'], ['銀綠', '#b9c1a4'], ['紫綠', '#8a9a78']],
    make: hex => buildSprig({ hex, stemColor: '#828f6c', leaf: 'oval', leafW: 11, leafL: 26, n: 6, spread: 54, curve: 8 }) },
  { id: 'flaxleaf', colors: [['青綠', '#7c8a52'], ['古銅', '#9a7d4e'], ['深綠', '#566b39']],
    make: hex => buildSprig({ hex, stemColor: '#6b7a44', leaf: 'sword', leafW: 6, leafL: 78, n: 4, spread: 30, curve: 6 }) },
  { id: 'fernleaf', colors: [['綠', '#6f9a4f'], ['嫩綠', '#8fb85f'], ['深綠', '#4d7038']],
    make: hex => buildSprig({ hex, stemColor: '#5f8048', leaf: 'lance', leafW: 3.5, leafL: 14, n: 9, spread: 50, curve: 10 }) },
  { id: 'eucround', colors: [['銀綠', '#aeb98f'], ['灰藍綠', '#9fae9a'], ['薄荷', '#bcd0b0']],
    make: hex => buildSprig({ hex, stemColor: '#929a72', leaf: 'round', leafW: 11, leafL: 24, n: 6, spread: 46, curve: 10 }) },
  { id: 'willow', colors: [['銀灰', '#cfd2c4'], ['暖灰', '#d8d2c0'], ['綠灰', '#b6bda4']],
    make: hex => buildCatkin({ hex, stemColor: '#a7a98c', n: 5, baseY: 150, curve: 12 }) },
  { id: 'palmleaf', colors: [['綠', '#5f8a4a'], ['黃綠', '#84a85a'], ['深綠', '#3f6630']],
    make: hex => buildFan({ hex, stemColor: '#4f6b3a', leaf: 'sword', leafW: 7, leafL: 105, blades: 7, fan: 100 }) },
];
for (const f of NEW_FOLIAGE) bakeFoliage(f.id, f.colors, f.make);

for (const d of W.data) {
  if (d.bakedFoliage) continue;
  const mode = modeOf(d);
  const variants = VARIANTS[d.id] || [0];
  if (mode === 'pieces') {
    // 枝叶类：只烘整张预览图（卡片用），场景端用叶片零件实时拼
    const item = { type: d.id, color: 0, h: 300, variant: 0, scale: 1, tone: 0, bend: .8, knee: .15 };
    const hex = d.colors[0][1];
    addEntry(`${d.id}__preview`, 'preview', [-140, -330, 280, 390], [0, 0], 200, W.foliageMarkup(item, hex));
    continue;
  }
  for (const v of variants) {
    for (let ci = 0; ci < d.colors.length; ci++) {
      const hex = d.colors[ci][1];
      const key = `${d.id}_c${ci}` + (variants.length > 1 ? `_v${v}` : '');
      if (mode === 'head') {
        const item = { type: d.id, color: ci, h: 135, variant: v, scale: 1, tone: 0, bend: .8, knee: .15 };
        const markup = d.id === 'lisianthus'
          ? W.lisianthusSpray(item, hex)
          : W.flower(d.id, hex, v, d.id === 'rose' && ci === 8);
        const M = ['lisianthus', 'minirose', 'doublelisianthus'].includes(d.id) ? 75 : Math.ceil(d.size * 1.5 + 18);
        addEntry(key, 'head', [-M, -M, 2 * M, 2 * M], [0, 0], 210, markup);
      } else if (mode === 'hang') {
        // gardenMarkup/extraMarkup/newBotanicalSpray 内部 translate(0,-h)，外套 translate(0,h) 归零
        const item = { type: d.id, color: ci, h: 160, variant: v, scale: 1, tone: 0, bend: .8, knee: .15 };
        const inner = d.vectorSpray ? W.newBotanicalSpray(d, item, hex)
          : d.newAtlas || d.leafAtlas || d.extra ? W.extraMarkup(d, item, hex)
          : W.gardenMarkup(d, item, hex);
        addEntry(key, 'hang', [-180, -40, 360, 460], [0, 0], 300, `<g transform="translate(0 160)">${inner}</g>`);
      } else { // whole（vectorLeaf 整株含茎）
        const item = { type: d.id, color: ci, h: 160, variant: v, scale: 1, tone: 0, bend: .8, knee: .15 };
        addEntry(key, 'whole', [-170, -40, 340, 320], [0, 0], 300, `<g transform="translate(0 160)">${W.newLeafMarkup(d, item, hex)}</g>`);
      }
    }
  }
}

// 叶片零件
for (const [kind, src] of Object.entries(PIECES)) {
  if (kind === 'monstera') continue; // 由 hang 模式整体烘焙
  const [cx, cy, cw, ch, ax, ay] = (src === 'leaf' ? leafCrops : referenceCrops)[kind];
  const markup = W.paintedImage(kind, src === 'ref' ? 'botanical-key' : '');
  addEntry(`piece_${kind}`, 'piece', [cx, cy, cw, ch], [ax, ay], 260, markup);
}

// 花瓶缩略图（3 色 × 全部瓶型，swing 除外）
for (const colorKey of Object.keys(W.vaseColors)) {
  globalThis.__setVaseColor(colorKey);
  for (const key of Object.keys(W.vaseSizes)) {
    if (key === 'swing') continue;
    let svg = W.vaseThumbnail(key);
    svg = svg.replace(new RegExp(`(id="|url\\(#)([\\w-]*thumb[\\w-]*)`, 'g'),
      (m, p, id) => `${p}${id}-${colorKey}`);
    const vb = (svg.match(/viewBox="([^"]+)"/) || [])[1];
    if (!vb) { console.error('no viewBox for vase', key); continue; }
    addEntry(`vase_${key}_${colorKey}`, 'thumb', vb.split(/\s+/).map(Number), [0, 0], 200,
      svg.replace(/<svg /, '<svg xmlns="http://www.w3.org/2000/svg" ').replace(/<\/?svg[^>]*>/g, m => m));
  }
}

// ---- 5. 输出 HTML ----
const cells = entries.map(e => {
  const [vx, vy, vw, vh] = e.vb.split(' ').map(Number);
  const inner = e.mode === 'thumb' ? e.markup
    : `<svg xmlns="http://www.w3.org/2000/svg" width="${vw}" height="${vh}" viewBox="${e.vb}">${e.markup}</svg>`;
  const sized = e.mode === 'thumb'
    ? inner.replace('<svg ', `<svg width="${vw}" height="${vh}" `)
    : inner;
  return `<div class="bake" data-key="${e.key}" data-mode="${e.mode}" data-vb="${e.vb}" data-p0="${e.p0.join(',')}" data-cap="${e.cap}">${sized}</div>`;
}).join('\n');
const page = `<!doctype html><html><head><meta charset="utf-8"><base href="${'file://' + ROOT}/"><style>body{margin:0;background:transparent}.bake{display:inline-block;padding:34px;vertical-align:top}.bake svg{display:block;overflow:visible}</style></head><body><svg width="0" height="0" style="position:absolute"><defs>${toneDefs}</defs></svg>${hiddenDefs}\n${cells}\n<script>window.__count=${entries.length}</script></body></html>`;
fs.writeFileSync(path.join(OUT, 'flowers.html'), page);
fs.writeFileSync(path.join(OUT, 'bake-list.json'), JSON.stringify(entries.map(e => ({ key: e.key, mode: e.mode, vb: e.vb, p0: e.p0, cap: e.cap })), null, 1));
console.log(`bake entries: ${entries.length}`);
console.log('flowers.html written to', path.join(OUT, 'flowers.html'));
