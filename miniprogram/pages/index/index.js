// 一束花 · 主页面（逻辑移植自网页版 app.js）
const { DATA, VASE_SIZES, VASE_COLORS, BACKGROUND_COLORS, VESSEL_NAMES, materialCategory, vesselCategory } = require('../../utils/flowers-data.js');
const { SceneRenderer, SCENE_W, SCENE_H, modeOf, factor, assetKey } = require('../../utils/renderer.js');
const vases = require('../../utils/vases.js');
const MANIFEST = require('../../utils/manifest.js');

const VASE_ZH = {
  urnlow: '高脚矮瓶', urnhigh: '高脚瓶', classic: '经典', petite: '细颈', slim: '迷你',
  bud: '迷你细颈', columnlow: '低直筒', columnhigh: '高直筒', paper: '纸包花束',
  mug: '马克杯', bowl: '浅碗', canvaswrap: '帆布花束', naked: '裸花束',
  television: '复古电视', poodle: '贵宾犬', typewriter: '打字机',
};

function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function variation(type) {
  const delta = () => (Math.random() < .5 ? -1 : 1) * (.05 + Math.random() * .05);
  return {
    variant: Math.floor(Math.random() * (type === 'fishtailfern' ? 6 : ['poppy', 'laceflower'].includes(type) ? 3 : 4)),
    scale: 1 + (Math.random() < .5 ? -1 : 1) * ((type === 'fern' ? .22 : type === 'rose' ? .05 : .10) + Math.random() * (type === 'fern' ? .18 : type === 'rose' ? .03 : .05)),
    tone: delta(),
    bend: (Math.random() < .5 ? -1 : 1) * (.75 + Math.random() * .5),
    knee: (Math.random() - .5) * .8,
  };
}
function assetUrl(key) {
  const m = MANIFEST[key];
  return m ? (m.p ? '/' + m.p + '/assets/' : '/assets/') + m.f : '';
}
// 花材卡片 / 调整面板预览图
function flowerImg(d, colorIdx, variant) {
  if (d.foliage) return assetUrl(d.id + '__preview');
  let key = assetKey(d.id, colorIdx ?? d.previewColor ?? 0, variant ?? 0);
  if (!MANIFEST[key]) key = `${d.id}_c0`;
  return assetUrl(key);
}

Page({
  data: {
    statusBarHeight: 44,
    navHeight: 44,   // 顶栏内容高度（避开胶囊）
    navRight: 100,   // 右侧预留宽度（避开胶囊）
    items: [],
    selected: null,
    vase: 'classic',
    vaseColor: 'ivory',
    backgroundColor: 'default',
    bgColor: '#d8d8d8',
    panel: 'materials',
    category: 'main',
    vesselGroup: 'vessel',
    catalog: [],
    vaseCards: [],
    vaseColorChips: [],
    history: [],
    countText: '00 枝',
    activeItem: null,
    heightCm: 0,
    hMin: 40,
    finishImg: '',
    canvasStyle: 'width:100px;height:100px',
  },

  onLoad() {
    try {
      const info = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
      const statusBarHeight = info.statusBarHeight || 44;
      // 顶栏避开右上角微信胶囊：高度按胶囊底部算，右侧按胶囊左边界预留
      let navHeight = 44, navRight = 100;
      try {
        const rect = wx.getMenuButtonBoundingClientRect && wx.getMenuButtonBoundingClientRect();
        if (rect && rect.width) {
          navHeight = Math.max(44, Math.round(rect.bottom + 6 - statusBarHeight));
          navRight = Math.round(info.windowWidth - rect.left + 8);
        }
      } catch (e) {}
      // 画布尺寸同步算出（不依赖首帧后的 DOM 测量，避免原生 canvas 创建后不响应 CSS resize）
      const panelPx = 520 / 750 * info.windowWidth;               // .panel 固定高度 520rpx
      const inset = info.safeArea ? Math.max(0, info.screenHeight - info.safeArea.bottom) : 0;
      let stageH;
      if (info.safeArea) {
        stageH = info.safeArea.bottom - statusBarHeight - navHeight - panelPx;
      } else {
        stageH = info.windowHeight - statusBarHeight - navHeight - panelPx;
      }
      this.stageW = info.windowWidth;
      this.stageH = Math.max(80, Math.round(stageH));
      this.setData({
        statusBarHeight, navHeight, navRight,
        canvasStyle: `width:${this.stageW}px;height:${this.stageH}px`,
      });
    } catch (e) {}
    this.nextId = 1;
    this.counters = { sunflower: 0, kingprotea: 0, birdofparadise: 0, lily: 0, poppy: 0, irisleaf: 0, doublelisianthus: 0 };
    this.renderer = new SceneRenderer();
    this.renderer.onNeedRedraw = () => this.renderScene();
    this.buildCatalog();
    this.buildVaseCards();
    this.buildVaseColorChips();
  },

  onReady() {
    wx.createSelectorQuery().in(this)
      .select('.stage').boundingClientRect()
      .select('#scene').fields({ node: true })
      .exec(res => {
        const rect = res[0];
        const node = res[1] && res[1].node;
        if (!node) return;
        const info = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
        const dpr = info.pixelRatio || 2;
        // 优先用实测尺寸；与预算偏差大才改 CSS（canvas 已在首帧按预算尺寸创建，尽量不再 resize）
        let width = this.stageW, height = this.stageH;
        if (rect && rect.width > 0 && rect.height >= 80 &&
            (Math.abs(rect.height - height) > 2 || Math.abs(rect.width - width) > 2)) {
          width = Math.round(rect.width);
          height = Math.round(rect.height);
          this.setData({ canvasStyle: `width:${width}px;height:${height}px` });
        }
        node.width = width * dpr;
        node.height = height * dpr;
        this.canvas = node;
        this.ctx = node.getContext('2d');
        this.renderer.setCanvas(node);
        this.dpr = dpr;
        this.cssW = width;
        this.cssH = height;
        this.fitScale = Math.min(width / SCENE_W, height / SCENE_H);
        this.offX = (width - SCENE_W * this.fitScale) / 2;
        this.offY = (height - SCENE_H * this.fitScale) / 2;
        this.renderScene();
      });
  },

  // ---------- 渲染 ----------
  renderScene(skipRing) {
    if (!this.ctx) return;
    const { ctx, dpr, fitScale, offX, offY } = this;
    const bg = BACKGROUND_COLORS[this.data.backgroundColor] || BACKGROUND_COLORS.default;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = bg.color;
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.setTransform(dpr * fitScale, 0, 0, dpr * fitScale, dpr * offX, dpr * offY);
    this.renderer.render(ctx, {
      items: this.data.items,
      selected: skipRing ? null : this.data.selected,
      vase: this.data.vase,
      vaseColor: this.data.vaseColor,
      backgroundColor: this.data.backgroundColor,
    });
  },

  scenePoint(t) {
    return { x: (t.x - this.offX) / this.fitScale, y: (t.y - this.offY) / this.fitScale };
  },

  active() { return this.data.items.find(i => i.id === this.data.selected) || null; },

  // ---------- 历史 ----------
  snapshot() {
    const d = this.data;
    return JSON.stringify({
      items: d.items, selected: d.selected, vase: d.vase, vaseColor: d.vaseColor,
      backgroundColor: d.backgroundColor, nextId: this.nextId, counters: this.counters,
    });
  },
  remember(before) {
    const history = this.data.history.concat(before || this.snapshot());
    if (history.length > 100) history.shift();
    this.setData({ history });
  },
  undo() {
    if (!this.data.history.length) return;
    const history = this.data.history.slice();
    const state = JSON.parse(history.pop());
    this.nextId = state.nextId || this.nextId;
    this.counters = state.counters || this.counters;
    this.setData({
      history,
      items: state.items, selected: state.selected, vase: state.vase || 'classic',
      vaseColor: state.vaseColor || 'ivory', backgroundColor: state.backgroundColor || 'default',
      bgColor: (BACKGROUND_COLORS[state.backgroundColor] || BACKGROUND_COLORS.default).color,
    }, () => { this.refreshAdjust(); this.renderScene(); });
  },

  // ---------- 花材操作 ----------
  minimumHeight(d, item) {
    const mode = modeOf(d);
    const key = assetKey(d.id, item.color, item.variant);
    const m = MANIFEST[key];
    const artH = (m ? m.h : (d.artSize ? d.artSize[1] : 100)) * item.scale;
    if (mode === 'foliage') return this.data.vase === 'bowl' ? 24 : 40;
    if (mode === 'hang' || mode === 'whole') {
      if (this.data.vase === 'bowl') return Math.ceil(Math.max(24, artH * .9));
      return Math.ceil(Math.max(128, artH * .96 + 20));
    }
    if (this.data.vase === 'bowl') return Math.ceil(Math.max(18, d.size * .62 * item.scale));
    return Math.ceil(Math.max(40, (d.id === 'lisianthus' ? 48.4 : d.size * 1.075) * item.scale + 20));
  },

  addFlower(e) {
    const type = e.currentTarget.dataset.type;
    const d = DATA.find(x => x.id === type);
    if (!d) return;
    if (this.data.items.length >= 50) {
      wx.showToast({ title: '最多可使用 50 枝花材', icon: 'none' });
      return;
    }
    this.remember();
    const items = this.data.items;
    const item = {
      ...variation(type),
      id: this.nextId++, type, color: 0,
      h: 270 + (items.length % 3) * 27,
      a: items.length ? ((items.length % 5) - 2) * 12 : 0,
      x: 330,
    };
    const c = this.counters;
    if (type === 'doublelisianthus') { item.variant = c.doublelisianthus; c.doublelisianthus = 1 - c.doublelisianthus; }
    if (type === 'irisleaf') { item.variant = c.irisleaf; c.irisleaf = 1 - c.irisleaf; }
    if (type === 'poppy') { item.variant = c.poppy; c.poppy = (c.poppy + 1) % 3; }
    if (type === 'birdofparadise') { item.variant = c.birdofparadise; c.birdofparadise = 1 - c.birdofparadise; }
    if (type === 'sunflower') { item.variant = c.sunflower; c.sunflower = (c.sunflower + 1) % 3; }
    if (type === 'lily') { item.variant = c.lily; c.lily = 1 - c.lily; }
    if (type === 'kingprotea') { item.variant = c.kingprotea; c.kingprotea = (c.kingprotea + 1) % 2; }
    this.setData({
      items: items.concat(item),
      selected: item.id,
      countText: String(items.length + 1).padStart(2, '0') + ' 枝',
    }, () => { this.refreshAdjust(); this.renderScene(); });
  },

  removeSelected() {
    const item = this.active();
    if (!item) return;
    this.remember();
    const items = this.data.items.filter(i => i.id !== item.id);
    this.setData({
      items,
      selected: items.length ? items[items.length - 1].id : null,
      countText: String(items.length).padStart(2, '0') + ' 枝',
    }, () => { this.refreshAdjust(); this.renderScene(); });
  },

  setColor(e) {
    const item = this.active();
    if (!item) return;
    const c = +e.currentTarget.dataset.c;
    if (item.color === c) return;
    this.remember();
    item.color = c;
    this.setData({ items: this.data.items }, () => { this.refreshAdjust(); this.renderScene(); });
  },

  onHeight(e) {
    const item = this.active();
    if (!item) return;
    if (this.sliderSnapshot === undefined) this.sliderSnapshot = this.snapshot();
    const d = DATA.find(x => x.id === item.type);
    item.h = Math.max(this.minimumHeight(d, item), Math.min(390, +e.detail.value));
    this.setData({ heightCm: Math.round(item.h / 8) });
    this.renderScene();
  },
  onAngle(e) {
    const item = this.active();
    if (!item) return;
    if (this.sliderSnapshot === undefined) this.sliderSnapshot = this.snapshot();
    item.a = clamp(+e.detail.value, -75, 75);
    this.renderScene();
  },
  onSliderEnd() {
    if (this.sliderSnapshot !== undefined && this.sliderSnapshot !== this.snapshot()) {
      this.remember(this.sliderSnapshot);
    }
    this.sliderSnapshot = undefined;
    this.refreshAdjust();
  },

  toBack() { this.moveLayer(0); },
  toFront() { this.moveLayer(this.data.items.length - 1); },
  moveLayer(dest) {
    const items = this.data.items.slice();
    const n = items.findIndex(i => i.id === this.data.selected);
    if (n < 0 || n === dest) return;
    this.remember();
    const [item] = items.splice(n, 1);
    items.splice(dest, 0, item);
    this.setData({ items }, () => this.renderScene());
  },

  // ---------- 触摸拖拽 ----------
  onTouchStart(e) {
    if (!this.ctx) return;
    const p = this.scenePoint(e.touches[0]);
    const id = this.renderer.hitTest(this.data.items, p.x, p.y);
    if (id) {
      const item = this.data.items.find(i => i.id === id);
      this.drag = { id, px: p.x, py: p.y, a: item.a, h: item.h, x: item.x, before: this.snapshot() };
      if (this.data.selected !== id) {
        this.setData({ selected: id }, () => { this.refreshAdjust(); this.renderScene(); });
      } else {
        this.renderScene();
      }
    } else if (this.data.selected) {
      this.setData({ selected: null }, () => { this.refreshAdjust(); this.renderScene(); });
    }
  },
  onTouchMove(e) {
    if (!this.drag) return;
    const p = this.scenePoint(e.touches[0]);
    const item = this.active();
    if (!item || item.id !== this.drag.id) return;
    const d = DATA.find(x => x.id === item.type);
    const base = vases.stemBase(this.data.vase);
    const rad = this.drag.a * Math.PI / 180;
    const headX = this.drag.x + Math.sin(rad) * this.drag.h + p.x - this.drag.px;
    const headY = base - Math.cos(rad) * this.drag.h + p.y - this.drag.py;
    const dx = headX - item.x, dy = base - headY;
    item.a = Math.round(clamp(Math.atan2(dx, dy) * 180 / Math.PI, -75, 75));
    item.h = Math.round(Math.max(this.minimumHeight(d, item), Math.min(390, Math.hypot(dx, Math.max(0, dy)))));
    this.renderScene();
  },
  onTouchEnd() {
    if (this.drag && this.drag.before !== this.snapshot()) this.remember(this.drag.before);
    if (this.drag) this.refreshAdjust();
    this.drag = null;
    this.renderScene();
  },
  deselect() {
    if (!this.data.selected) return;
    this.setData({ selected: null }, () => { this.refreshAdjust(); this.renderScene(); });
  },

  // ---------- 面板 ----------
  setPanel(e) {
    const panel = e.currentTarget.dataset.p;
    this.setData({ panel }, () => {
      if (panel === 'adjust') this.refreshAdjust();
    });
  },
  setCategory(e) {
    this.setData({ category: e.currentTarget.dataset.c }, () => this.buildCatalog());
  },
  buildCatalog() {
    const cat = this.data.category;
    const catalog = DATA
      .filter(d => materialCategory(d) === cat)
      .sort((a, b) => (b.id === 'rose') - (a.id === 'rose'))
      .map(d => ({ id: d.id, name: d.name, en: d.en, img: flowerImg(d) }));
    this.setData({ catalog });
  },

  refreshAdjust() {
    const item = this.active();
    if (!item) { this.setData({ activeItem: null }); return; }
    const d = DATA.find(x => x.id === item.type);
    this.setData({
      activeItem: {
        id: item.id,
        name: d.name,
        en: d.en,
        h: item.h,
        a: item.a,
        img: flowerImg(d, item.color, item.variant),
        swatches: (d.colors || []).map((c, n) => ({ hex: c[1], on: n === item.color })),
      },
      heightCm: Math.round(item.h / 8),
      hMin: this.minimumHeight(d, item),
    });
  },

  // ---------- 容器 ----------
  setVesselGroup(e) {
    this.setData({ vesselGroup: e.currentTarget.dataset.g }, () => this.buildVaseCards());
  },
  buildVaseCards() {
    const group = this.data.vesselGroup;
    const vaseCards = Object.keys(VASE_SIZES)
      .filter(k => k !== 'swing' && vesselCategory(k) === group)
      .map(k => ({
        key: k,
        name: VASE_ZH[k] || VESSEL_NAMES[k] || k,
        img: assetUrl(`vase_${k}_${this.data.vaseColor}`),
        on: k === this.data.vase,
      }));
    this.setData({ vaseCards });
  },
  buildVaseColorChips() {
    this.setData({
      vaseColorChips: Object.keys(VASE_COLORS).map(k => ({
        key: k, chip: VASE_COLORS[k].body, on: k === this.data.vaseColor,
      })),
    });
  },
  setVase(e) {
    const v = e.currentTarget.dataset.v;
    if (v === this.data.vase) return;
    this.remember();
    // 换瓶后部分花材可能低于新瓶最小高度，做一次抬升（先切花瓶再算最小高度）
    this.data.vase = v;
    const items = this.data.items.map(i => {
      const d = DATA.find(x => x.id === i.type);
      const min = this.minimumHeight(d, i);
      return i.h < min ? { ...i, h: min } : i;
    });
    this.setData({ vase: v, items }, () => { this.buildVaseCards(); this.renderScene(); });
  },
  setVaseColor(e) {
    const vc = e.currentTarget.dataset.vc;
    if (vc === this.data.vaseColor) return;
    this.remember();
    this.setData({ vaseColor: vc }, () => { this.buildVaseCards(); this.buildVaseColorChips(); this.renderScene(); });
  },

  // ---------- 背景 / 重置 ----------
  toggleBackground() {
    this.remember();
    const next = this.data.backgroundColor === 'default' ? 'charcoal' : 'default';
    this.setData({ backgroundColor: next, bgColor: BACKGROUND_COLORS[next].color }, () => this.renderScene());
  },
  resetAll() {
    if (!this.data.items.length) return;
    wx.showModal({
      title: '重新开始',
      content: '确定清空全部花材，重新开始？',
      confirmText: '清空',
      confirmColor: '#a3543f',
      success: r => {
        if (!r.confirm) return;
        this.remember();
        this.counters = { sunflower: 0, kingprotea: 0, birdofparadise: 0, lily: 0, poppy: 0, irisleaf: 0, doublelisianthus: 0 };
        this.setData({ items: [], selected: null, countText: '00 枝' }, () => { this.refreshAdjust(); this.renderScene(); });
      },
    });
  },

  // ---------- 完成作品 ----------
  finish() {
    if (!this.canvas) return;
    this.renderScene(true); // 不画选中圈
    wx.canvasToTempFilePath({
      canvas: this.canvas,
      success: r => this.setData({ finishImg: r.tempFilePath }, () => this.renderScene()),
      fail: () => { this.renderScene(); wx.showToast({ title: '导出失败，请重试', icon: 'none' }); },
    });
  },
  closeFinish() { this.setData({ finishImg: '' }); },
  noop() {},
  saveFinish() {
    wx.saveImageToPhotosAlbum({
      filePath: this.data.finishImg,
      success: () => wx.showToast({ title: '已保存到相册', icon: 'success' }),
      fail: err => {
        if (err && /auth|deny/.test(err.errMsg || '')) {
          wx.showModal({
            title: '需要相册权限',
            content: '请在设置中允许保存图片到相册',
            success: r => r.confirm && wx.openSetting(),
          });
        }
      },
    });
  },

  onShareAppMessage() {
    return { title: '一束花 · 一点花，一点日常', path: '/pages/index/index' };
  },
});
