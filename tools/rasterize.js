// 用本机 Chrome 把 flowers.html 里每个 .bake 元素截成透明 PNG
// 用法: node tools/rasterize.js
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright-core');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'tools', 'out');
const RAW = path.join(OUT, 'raw');
fs.mkdirSync(RAW, { recursive: true });

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage({ deviceScaleFactor: 2, viewport: { width: 1600, height: 1100 } });
  await page.goto('file://' + path.join(OUT, 'flowers.html'));
  await page.waitForTimeout(2500); // 本地 webp 加载
  const els = await page.$$('.bake');
  console.log('elements:', els.length);
  let done = 0;
  for (const el of els) {
    const key = await el.getAttribute('data-key');
    await el.screenshot({ path: path.join(RAW, key + '.png'), omitBackground: true });
    if (++done % 40 === 0) console.log(`  ${done}/${els.length}`);
  }
  await browser.close();
  console.log('done ->', RAW);
})().catch(e => { console.error(e); process.exit(1); });
