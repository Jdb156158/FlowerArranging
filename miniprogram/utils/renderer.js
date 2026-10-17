// 场景渲染器：移植网页版 render() 的合成逻辑到小程序 Canvas 2D
const { pathTo } = require('./svgpath.js');
const vases = require('./vases.js');
const { DATA, VASE_COLORS, BACKGROUND_COLORS } = require('./flowers-data.js');
const MANIFEST = require('./manifest.js');

const SCENE_W = 660, SCENE_H = 720;

// 素材可能分布在不同分包（webp 单包 / png 三分包），以 manifest 的 p 字段为准
function assetUrl(m) { return (m.p ? '/' + m.p + '/assets/' : '/assets/') + m.f; }

// 烘焙变体表（与 tools/gen-flowers.js 一致）
const BAKED_VARIANTS = {
  sunflower: 3, kingprotea: 2, lily: 2, poppy: 3, waxflower: 2, astilbe: 2,
  fountaingrass: 2, lilyofthevalley: 2, fishtailfern: 6, silveroak: 4,
  irisleaf: 2, doublelisianthus: 2, chamomile: 4,
};

function modeOf(d) {
  if (d.vectorHead) return 'head';
  if (d.foliage) return 'foliage';
  if (d.vectorLeaf || d.bakedFoliage) return 'whole';
  if (d.extra || d.newAtlas || d.leafAtlas || d.vectorSpray) return 'hang';
  return 'head';
}
function factor(h) { return Math.max(.8, Math.min(1, h / 160)); }
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function tint(hex, tone) {
  if (Math.min(...hex.slice(1).match(/../g).map(v => parseInt(v, 16))) > 210) tone = Math.max(-.025, tone);
  return '#' + hex.slice(1).match(/../g).map(x => {
    const v = parseInt(x, 16);
    return Math.round(tone > 0 ? v + (255 - v) * tone : v * (1 + tone)).toString(16).padStart(2, '0');
  }).join('');
}

// ---- 花茎几何（移植 stemGeometry）----
function stemGeometry(item, endY = -item.h + 8) {
  const amplitude = Math.min(7, item.h * .028) * (item.bend ?? [1, -1, .8, -.75][item.variant % 4]);
  const knee = Math.min(4, item.h * .016) * (item.knee ?? .2);
  const x = t => amplitude * Math.sin(Math.PI * t) + knee * Math.sin(2 * Math.PI * t);
  const dx = t => amplitude * Math.PI * Math.cos(Math.PI * t) + 2 * Math.PI * knee * Math.cos(2 * Math.PI * t);
  let path = 'M0 0';
  for (let n = 0; n < 5; n++) {
    const a = n / 5, b = (n + 1) / 5, dt = (b - a) / 3;
    path += ` C${x(a) + dx(a) * dt} ${endY * (a + dt)} ${x(b) - dx(b) * dt} ${endY * (b - dt)} ${x(b)} ${endY * b}`;
  }
  return {
    path,
    xAt: y => x(clamp(y / endY, 0, 1)),
    angleAt: y => -Math.atan(dx(clamp(y / endY, 0, 1)) / endY) * 180 / Math.PI,
  };
}

function assetKey(type, color, variant) {
  const n = BAKED_VARIANTS[type];
  const base = `${type}_c${color}`;
  if (!n) return base;
  return `${base}_v${variant % n}`;
}

class SceneRenderer {
  constructor() {
    this.images = {}; // key -> {img, ready}
    this.onNeedRedraw = null;
    this.canvas = null;
  }
  // Canvas 2D 必须由 canvas 节点创建图片对象（wx.createImage 在新版基础库已移除）
  setCanvas(node) { this.canvas = node; }
  createImage() {
    if (this.canvas && this.canvas.createImage) return this.canvas.createImage();
    if (typeof wx !== 'undefined' && wx.createImage) return wx.createImage();
    return null;
  }
  ensure(key) {
    const m = MANIFEST[key];
    if (!m) return null;
    if (!this.images[key]) {
      const rec = { img: null, ready: false };
      const img = this.createImage();
      if (!img) return null;
      img.onload = () => { rec.ready = true; this.onNeedRedraw && this.onNeedRedraw(); };
      img.onerror = () => { console.warn('[插花] 素材加载失败:', key); };
      img.src = assetUrl(m);
      rec.img = img;
      this.images[key] = rec;
    }
    return this.images[key];
  }
  preload(keys) { for (const k of keys) this.ensure(k); }

  // ---- 单枝花：返回 {stems: [...], front: [...]} 由调用方按层绘制 ----
  drawItem(ctx, d, item, layer) {
    const mode = modeOf(d);
    const color = tint(d.colors[item.color][1], item.tone || 0);
    ctx.save();
    ctx.translate(item.x - (this.vase === 'television' ? 48 : 0), vases.stemBase(this.vase));
    ctx.rotate(item.a * Math.PI / 180);
    if (mode === 'head') this.drawHead(ctx, d, item, color, layer);
    else if (mode === 'hang') this.drawHang(ctx, d, item, color, layer);
    else if (mode === 'whole') this.drawWhole(ctx, d, item, color, layer);
    else this.drawFoliage(ctx, d, item, color, layer);
    ctx.restore();
  }

  drawStemPath(ctx, item, endY, color, width) {
    ctx.beginPath();
    pathTo(ctx, stemGeometry(item, endY).path);
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.stroke();
  }

  drawImageKey(ctx, key, dx, dy, w, h, mirror) {
    const m = MANIFEST[key];
    const rec = this.ensure(key);
    if (!m || !rec || !rec.ready) return;
    if (mirror) { ctx.save(); ctx.scale(-1, 1); }
    ctx.drawImage(rec.img, dx, dy, w, h);
    if (mirror) ctx.restore();
  }

  // 花头类：花茎 + 顶部花头图
  drawHead(ctx, d, item, color, layer) {
    const key = assetKey(d.id, item.color, item.variant);
    const m = MANIFEST[key];
    if (!m) return;
    const k = item.scale;
    let tip;
    if (d.id === 'lisianthus') tip = item.h - 48.4 * k;
    else if (d.id === 'tulip') tip = item.h - d.size * 2.15 * .44 * k;
    else if (d.id === 'carnation') tip = item.h - d.size * .9 * k;
    else tip = item.h - 8;
    if (layer === 'stem') {
      this.drawStemPath(ctx, item, -tip, d.stemColor || '#7e8d70', d.stemWidth || 2.1);
      return;
    }
    const TILT = [0, -7, 5, -3], SX = [1, .97, 1.04, .98], SY = [1, 1.03, .96, 1.02];
    const v = BAKED_VARIANTS[d.id] ? 0 : item.variant % 4; // 烘焙变体的花型差异已含在图里
    ctx.save();
    ctx.translate(0, -item.h);
    ctx.rotate(TILT[v] * Math.PI / 180);
    ctx.scale(SX[v], SY[v]);
    this.drawImageKey(ctx, key, -m.ax * m.w * k, -m.ay * m.h * k, m.w * k, m.h * k);
    ctx.restore();
    if (this.selectedId === item.id) this.drawRing(ctx, 0, -item.h, Math.max(36, m.w * k * .55));
  }

  // 吊挂类（extra/newAtlas/vectorSpray）：花茎 + 从枝顶垂下的整束图
  drawHang(ctx, d, item, color, layer) {
    const key = assetKey(d.id, item.color, item.variant);
    const m = MANIFEST[key];
    if (!m) return;
    const k = item.scale * factor(item.h);
    const artH = m.h * k;
    const tip = item.h - artH * .96;
    if (layer === 'stem') {
      this.drawStemPath(ctx, item, -tip, d.stemColor || '#7e8d70', d.stemWidth || 2.1);
      return;
    }
    const ANGLE = [0, -3, 3, -1];
    const mirror = (d.id === 'birdofparadise' && item.variant % 2 === 1) ||
      (d.id === 'lilyofthevalley' && item.variant >= 2);
    ctx.save();
    ctx.translate(0, -item.h);
    ctx.rotate((ANGLE[item.variant % 4] || 0) * Math.PI / 180);
    this.drawImageKey(ctx, key, -m.ax * m.w * k, -m.ay * m.h * k, m.w * k, m.h * k, mirror);
    ctx.restore();
    if (this.selectedId === item.id) this.drawRing(ctx, 0, -item.h + artH * .4, Math.max(36, m.w * k * .5));
  }

  // 整株类（vectorLeaf）：含茎整图，x/y 非均匀缩放
  drawWhole(ctx, d, item, color, layer) {
    if (layer === 'stem') return; // 茎已含在烘焙图里
    const key = assetKey(d.id, item.color, item.variant);
    const m = MANIFEST[key];
    if (!m) return;
    // 与 newLeafMarkup 的 scale 对应：烘焙于 h=160（factor=1）
    const kx = item.scale * factor(item.h);
    const ky = item.scale * (d.artSize ? d.artSize[1] : m.h) * factor(item.h) / 160;
    const ROT = [0, -5, 4, -2, 8, -8];
    const v = BAKED_VARIANTS[d.id] ? 0 : item.variant % 6; // 烘焙变体的旋转已含在图里
    ctx.save();
    ctx.translate(0, -item.h);
    ctx.rotate((ROT[v] || 0) * Math.PI / 180);
    this.drawImageKey(ctx, key, -m.ax * m.w * kx, -m.ay * m.h * ky, m.w * kx, m.h * ky);
    ctx.restore();
    if (this.selectedId === item.id) this.drawRing(ctx, 0, -item.h + m.h * ky * .4, Math.max(36, m.w * kx * .5));
  }

  // 枝叶类：枝干 + 叶片零件实时拼装
  drawFoliage(ctx, d, item, color, layer) {
    if (d.id === 'birch') return this.drawRuscus(ctx, item, color, layer);
    if (d.id === 'silverdollareucalyptus') return this.drawLargeRound(ctx, item, layer);
    const h = item.h, tipY = -h + 18, curve = stemGeometry(item, tipY);
    if (layer === 'stem') {
      ctx.beginPath();
      pathTo(ctx, curve.path);
      ctx.strokeStyle = vases.shade(color, -25);
      ctx.lineWidth = d.id === 'cedar' ? 1.8 : 1.4;
      ctx.lineCap = 'round';
      ctx.stroke();
      return;
    }
    let n = 0;
    const step = d.id === 'eucalyptus' ? 24 : d.id === 'pointedeucalyptus' ? 32 : 40;
    for (let y = -48; y > tipY + 10; y -= step) {
      const fraction = clamp(-y / h, 0, 1), taper = 1 - .42 * fraction;
      const angle = curve.angleAt(y);
      if (d.id === 'cedar') {
        for (const side of [-1, 1]) {
          const width = (48 + Math.sin(n * 2 + item.variant) * 5) * item.scale * taper;
          const spread = side * (35 + ((n + item.variant) % 3) * 8);
          ctx.save();
          ctx.globalAlpha = 1 - Math.max(0, item.tone || 0) * .45;
          ctx.translate(curve.xAt(y + side * 4), y + side * 4);
          ctx.rotate((angle + spread) * Math.PI / 180);
          this.drawPiece(ctx, 'cedar', 0, 0, width);
          ctx.restore();
        }
      } else {
        const kind = d.id === 'pointedeucalyptus' ? 'pointed' : 'eucalyptus';
        const width = ((d.id === 'pointedeucalyptus' ? 56 : 38) + Math.sin(n + item.variant) * 3) * item.scale * taper;
        ctx.save();
        ctx.translate(curve.xAt(y), y);
        ctx.rotate(angle * Math.PI / 180);
        ctx.scale(n % 2 ? -1 : 1, .78 + (n % 3) * .08);
        this.drawPiece(ctx, kind, 0, 0, width);
        ctx.restore();
      }
      n++;
    }
    const tipKind = { cedar: 'cedar-tip', eucalyptus: 'eucalyptus-tip', pointedeucalyptus: 'pointed-tip' }[d.id];
    const topWidth = (d.id === 'cedar' ? 24 : d.id === 'pointedeucalyptus' ? 28 : 19) * item.scale;
    ctx.save();
    ctx.translate(curve.xAt(tipY), tipY);
    ctx.rotate(curve.angleAt(tipY) * Math.PI / 180);
    this.drawPiece(ctx, tipKind, 0, 0, topWidth);
    ctx.restore();
    if (this.selectedId === item.id) this.drawRing(ctx, 0, -h + 35, Math.max(36, 65 * item.scale));
  }

  // 大圆叶尤加利
  drawLargeRound(ctx, item, layer) {
    const tipY = -item.h + 18, curve = stemGeometry(item, tipY);
    if (layer === 'stem') {
      ctx.beginPath();
      pathTo(ctx, curve.path);
      ctx.strokeStyle = '#7f8065'; ctx.lineWidth = 1.5; ctx.lineCap = 'round';
      ctx.stroke();
      return;
    }
    const gaps = [35, 29, 41, 32], sizes = [44, 38, 46, 40], sides = [1, -1, 1, 1, -1], angles = [-12, 17, -4, 22, 7];
    let n = 0;
    for (let y = -38; y > tipY + 24;) {
      const k = n + item.variant;
      const width = sizes[k % sizes.length] * item.scale * (1 - .18 * Math.min(1, -y / item.h));
      ctx.save();
      ctx.translate(curve.xAt(y), y);
      ctx.rotate((curve.angleAt(y) + angles[k % angles.length]) * Math.PI / 180);
      ctx.scale(sides[k % sides.length], 1);
      this.drawPiece(ctx, 'silver-dollar-single', 0, 0, width);
      ctx.restore();
      y -= gaps[(n + item.variant) % gaps.length]; n++;
    }
    ctx.save();
    ctx.translate(curve.xAt(tipY), tipY);
    ctx.rotate((26 + item.variant * 3) * Math.PI / 180);
    this.drawPiece(ctx, 'silver-dollar-single', 0, 0, 27 * item.scale);
    ctx.restore();
    if (this.selectedId === item.id) this.drawRing(ctx, 0, -item.h + 35, Math.max(36, 65 * item.scale));
  }

  // 桦木（ruscusBranch，纯路径）
  drawRuscus(ctx, item, color, layer) {
    const tip = -item.h + 20, curve = stemGeometry(item, tip), v = item.variant;
    const leafPath = 'M0 0C-22 -14 -24 -42 5 -61C7 -42 31 -23 0 0Z';
    const veinPath = 'M0 -1Q4 -31 5 -57M0 -12Q-9 -29 -7 -43M3 -14Q15 -31 8 -45';
    if (layer === 'stem') {
      ctx.beginPath();
      pathTo(ctx, curve.path);
      ctx.strokeStyle = vases.shade(color, -15); ctx.lineWidth = 1.8;
      ctx.stroke();
      return;
    }
    let j = 0;
    const drawLeaf = (x, y, rot, k, flip) => {
      ctx.save();
      ctx.translate(x, y); ctx.rotate(rot * Math.PI / 180); ctx.scale(flip * k, k);
      ctx.beginPath(); pathTo(ctx, leafPath);
      ctx.fillStyle = color; ctx.fill();
      ctx.globalAlpha = .7;
      ctx.beginPath(); pathTo(ctx, veinPath);
      ctx.strokeStyle = vases.shade(color, 18); ctx.lineWidth = .65;
      ctx.stroke();
      ctx.restore();
      ctx.globalAlpha = 1;
    };
    for (let y = -38; y > tip + 30; y -= 30 + (j % 3) * 5) {
      const side = (j + v) % 2 ? 1 : -1, k = (.75 + .1 * ((j + v) % 3)) * item.scale;
      drawLeaf(curve.xAt(y), y, side * (26 + (j % 3) * 12) + curve.angleAt(y), k, side);
      j++;
    }
    drawLeaf(curve.xAt(tip + 35), tip + 35, curve.angleAt(tip), .7 * item.scale, 1);
    if (this.selectedId === item.id) this.drawRing(ctx, 0, -item.h + 35, Math.max(36, 65 * item.scale));
  }

  drawPiece(ctx, kind, x, y, width) {
    const key = 'piece_' + kind;
    const m = MANIFEST[key];
    if (!m) return;
    const k = width / m.w;
    this.drawImageKey(ctx, key, x - m.ax * m.w * k, y - m.ay * m.h * k, m.w * k, m.h * k);
  }

  drawRing(ctx, cx, cy, r) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(74, 96, 68, .85)';
    ctx.lineWidth = 1.4;
    ctx.setLineDash([5, 4]);
    ctx.stroke();
    ctx.restore();
  }

  // ---- 全场景 ----
  render(ctx, state) {
    const { items, selected, vase, vaseColor, backgroundColor } = state;
    this.vase = vase;
    this.selectedId = selected;
    const palette = VASE_COLORS[vaseColor];
    const bg = BACKGROUND_COLORS[backgroundColor] || BACKGROUND_COLORS.default;

    ctx.fillStyle = bg.color;
    ctx.fillRect(0, 0, SCENE_W, SCENE_H);

    // 花瓶阴影
    const sh = vases.vaseShadow(vase);
    const grad = ctx.createRadialGradient(335, sh.cy, 1, 335, sh.cy, Math.max(sh.rx, 1));
    grad.addColorStop(0, 'rgba(166,167,154,.25)');
    grad.addColorStop(1, 'rgba(166,167,154,0)');
    ctx.save();
    ctx.translate(335, sh.cy);
    ctx.scale(1, sh.ry / sh.rx);
    ctx.beginPath();
    ctx.arc(0, 0, sh.rx, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.restore();

    vases.drawVase(ctx, vase, palette, 'back');

    const wrapped = vases.wrappedVessel(vase);
    if (wrapped) {
      vases.applyWrapClip(ctx, vase);
      for (const i of items) this.drawItem(ctx, DATA.find(d => d.id === i.type), i, 'stem');
      for (const i of items) this.drawItem(ctx, DATA.find(d => d.id === i.type), i, 'front');
      ctx.restore();
    } else {
      ctx.save();
      const clipped = vases.applyStemClip(ctx, vase);
      for (const i of items) this.drawItem(ctx, DATA.find(d => d.id === i.type), i, 'stem');
      ctx.restore();
      vases.drawVase(ctx, vase, palette, 'front');
      ctx.save();
      if (['television', 'poodle', 'typewriter'].includes(vase) && !['television', 'poodle'].includes(vase)) {
        vases.applyStemClip(ctx, vase);
      }
      if (clipped && (vase === 'columnlow' || vase === 'columnhigh')) {
        // 花头也在瓶口裁剪内（与网页一致：fronts 不裁剪，仅 stems 裁剪）
      }
      for (const i of items) this.drawItem(ctx, DATA.find(d => d.id === i.type), i, 'front');
      ctx.restore();
    }
    if (wrapped) vases.drawVase(ctx, vase, palette, 'front');
  }

  // 场景坐标命中检测（自顶向下）
  hitTest(items, sx, sy) {
    const base = vases.stemBase(this.vase || 'classic');
    for (let n = items.length - 1; n >= 0; n--) {
      const i = items[n];
      const d = DATA.find(dd => dd.id === i.type);
      const mode = modeOf(d);
      const cyOff = mode === 'foliage' ? 35 : 0;
      const rad = i.a * Math.PI / 180;
      const hh = i.h - cyOff;
      const hx = i.x + Math.sin(rad) * hh;
      const hy = base - Math.cos(rad) * hh;
      const key = assetKey(i.type, i.color, i.variant);
      const m = MANIFEST[key];
      const r = Math.max(34, (m ? m.w * i.scale * .55 : 30));
      if ((sx - hx) * (sx - hx) + (sy - hy) * (sy - hy) <= r * r) return i.id;
    }
    return null;
  }
}

module.exports = { SceneRenderer, SCENE_W, SCENE_H, modeOf, factor, tint, assetKey, BAKED_VARIANTS };
