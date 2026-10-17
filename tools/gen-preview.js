// 生成 preview.html：在浏览器里用同一套渲染代码画出样例场景，供视觉校验
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const MP = path.join(ROOT, 'miniprogram');

const files = ['utils/svgpath.js', 'utils/manifest.js', 'utils/flowers-data.js', 'utils/vases.js', 'utils/renderer.js'];
const registry = {};
let out = 'const __modules = {};\nfunction require(p){\n';
out += '  const map = {\'./svgpath.js\':\'svgpath\',\'./manifest.js\':\'manifest\',\'./flowers-data.js\':\'data\',\'./vases.js\':\'vases\',\'./renderer.js\':\'renderer\'};\n';
out += '  return __modules[map[p] || p];\n}\n';
for (const f of files) {
  const name = path.basename(f, '.js').replace('flowers-data', 'data');
  let src = fs.readFileSync(path.join(MP, f), 'utf8');
  src = src.replace(/\/\/ 由 tools\/process\.py 自动生成，请勿手改/, '');
  src = src.replace("return '/' + (m.p || 'flowerpack') + '/assets/' + m.f;",
    "return '../../miniprogram/' + (m.p || 'flowerpack') + '/assets/' + m.f;");
  out += `__modules['${name}'] = (function(module, exports){\n${src}\nreturn module.exports;\n})({exports:{}});\n`;
}
fs.writeFileSync(path.join(ROOT, 'tools/out/preview-bundle.js'), out);

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
body{margin:0;background:#888;display:flex;flex-wrap:wrap;gap:12px;padding:12px;font-family:sans-serif}
figure{margin:0;background:#fff;padding:6px;border-radius:6px}
figcaption{font-size:12px;text-align:center;padding:4px;color:#333}
canvas{display:block;width:330px;height:360px}
</style></head><body>
<script>var wx = { createImage: function () { return new Image(); } };</script>
<script>${out}</script>
<script>
const {SceneRenderer} = __modules['renderer'];
const vases = ['classic','urnhigh','petite','columnhigh','mug','bowl','paper','canvaswrap','naked','television','poodle','typewriter'];
const items = [
 {id:1,type:'rose',color:0,h:300,a:14,x:330,variant:0,scale:1.1,tone:.03,bend:.8,knee:.2},
 {id:2,type:'peony',color:0,h:262,a:-16,x:330,variant:0,scale:.98,tone:-.02,bend:-.7,knee:.1},
 {id:3,type:'eucalyptus',color:0,h:330,a:24,x:330,variant:2,scale:1,tone:.02,bend:.9,knee:.3},
 {id:4,type:'lisianthus',color:1,h:250,a:-26,x:330,variant:1,scale:1.02,tone:.01,bend:-.8,knee:.15},
 {id:5,type:'chamomile',color:0,h:290,a:6,x:330,variant:1,scale:1,tone:0,bend:.85,knee:.2},
 {id:6,type:'asparagusfern',color:0,h:310,a:-6,x:330,variant:0,scale:1,tone:0,bend:.8,knee:.2},
];
for (const v of vases) {
  const fig = document.createElement('figure');
  const cv = document.createElement('canvas');
  cv.width = 660; cv.height = 720;
  fig.appendChild(cv);
  const cap = document.createElement('figcaption'); cap.textContent = v;
  fig.appendChild(cap);
  document.body.appendChild(fig);
  const ctx = cv.getContext('2d');
  const r = new SceneRenderer();
  const draw = () => r.render(ctx, { items, selected: null, vase: v, vaseColor: 'ivory', backgroundColor: 'default' });
  r.onNeedRedraw = draw;
  draw();
}
</script>
</body></html>`;
fs.writeFileSync(path.join(ROOT, 'tools/out/preview.html'), html);
console.log('preview written');
