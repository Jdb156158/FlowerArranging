#!/usr/bin/env python3
# 裁剪透明边 → 缩放 → 导出 → 生成 manifest.js
# 用法:
#   python3 tools/process.py          # webp（仅开发者工具可用，真机不解码本地 webp）
#   python3 tools/process.py png      # 量化 PNG（默认用这个！总量 ~1.2MB 全进主包 assets/）
# 注意：所有素材统一放主包 —— 真机上主包页面引用分包静态资源会 404，
#       且 <image>/canvas 对本地 webp 默认不解析（webp 仅支持网络资源），故默认输出 PNG。
import json, os, sys
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'tools', 'out')
RAW = os.path.join(OUT, 'raw')
MP = os.path.join(ROOT, 'miniprogram')
DSF = 2  # 截图 deviceScaleFactor：1 场景单位 = 2 px
PAD = 34  # flowers.html 里 .bake 的 padding（px）
PNG = 'png' in [a.lower() for a in sys.argv[1:]]

def pack_of(key):
    # 一律主包 assets/（None = 主包）：分包静态资源被主包页面引用时真机 404
    return None

bake_list = json.load(open(os.path.join(OUT, 'bake-list.json')))
manifest = {}
pack_sizes = {}
blank = []
for e in bake_list:
    key, mode = e['key'], e['mode']
    vx, vy, vw, vh = [float(x) for x in e['vb'].split()]
    p0x, p0y = e['p0']
    cap = e['cap']
    src = os.path.join(RAW, key + '.png')
    if not os.path.exists(src):
        print('MISSING', key); continue
    im = Image.open(src).convert('RGBA')
    bbox = im.getchannel('A').getbbox()
    if not bbox:
        blank.append(key); continue
    im = im.crop(bbox)
    # 锚点：viewBox 坐标 → 截图 px（含 .bake padding）→ 裁剪后 px
    ax_px = (p0x - vx) * DSF + PAD * DSF - bbox[0]
    ay_px = (p0y - vy) * DSF + PAD * DSF - bbox[1]
    w, h = im.size
    r = min(1.0, cap / max(w, h))
    if r < 1.0:
        im = im.resize((max(1, round(w * r)), max(1, round(h * r))), Image.LANCZOS)
        ax_px *= r; ay_px *= r
    fw, fh = im.size
    pack = pack_of(key)
    adir = os.path.join(MP, pack, 'assets') if pack else os.path.join(MP, 'assets')
    os.makedirs(adir, exist_ok=True)
    if PNG:
        # 量化到 255 色（画风平涂，几乎无损）
        im = im.quantize(colors=255, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.FLOYDSTEINBERG)
        dst = os.path.join(adir, key + '.png')
        im.save(dst, 'PNG', optimize=True)
    else:
        dst = os.path.join(adir, key + '.webp')
        im.save(dst, 'WEBP', quality=80, method=4)
    if pack:
        pack_sizes[pack] = pack_sizes.get(pack, 0) + os.path.getsize(dst)
    else:
        pack_sizes['main/assets'] = pack_sizes.get('main/assets', 0) + os.path.getsize(dst)
    entry = {'f': os.path.basename(dst), 'w': round(fw / DSF / r, 2), 'h': round(fh / DSF / r, 2),
             'ax': round(ax_px / fw, 4), 'ay': round(ay_px / fh, 4), 'px': [fw, fh], 'm': mode}
    if pack:
        entry['p'] = pack
    if mode == 'thumb':
        entry['vb'] = e['vb']
    manifest[key] = entry

if blank:
    print('BLANK (全透明，需检查):', blank)

os.makedirs(os.path.join(MP, 'utils'), exist_ok=True)
js = '// 由 tools/process.py 自动生成，请勿手改\nmodule.exports = ' + json.dumps(manifest, separators=(',', ':')) + ';\n'
with open(os.path.join(MP, 'utils', 'manifest.js'), 'w') as f:
    f.write(js)
for p, s in sorted(pack_sizes.items()):
    print(f'{p}: {s/1024:.0f} KB')
print(f'total: {sum(pack_sizes.values())/1024:.0f} KB, {len(manifest)} files, format={"png" if PNG else "webp"}')
