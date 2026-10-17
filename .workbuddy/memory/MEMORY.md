# FlowerArranging 项目长期记忆

## 项目结构
- 根目录：FORi Flower 网页版复刻（原生 HTML/CSS/JS，`npm run dev` 或 python http.server 启动）。
- `miniprogram/`：微信小程序「**一束花**」（2026-10-14 移植，2026-10-15 定名），功能对齐网页版插花主流程，appid wxe96df2296367e7a1。
- `tools/`：小程序素材烘焙流水线（gen-flowers.js → rasterize.js → process.py，依赖本机 Chrome + Pillow venv）。

## 环境坑（重要）
- 本仓库在 exFAT 外置盘（My Passport）：macOS 自动生成 `._*` AppleDouble 文件，打包/统计前必须 `find . -name '._*' -delete`。
- 该盘 cluster 约 2MB，`du` 体积严重虚高，统计包体积要用文件实际字节（stat/python getsize）。
- **微信开发者工具对 exFAT 外置盘改动不热更新**（清缓存+点编译都可能无效）：外部改完文件后必须 **Cmd+Q 完全退出工具重开**才生效。验证包是否更新可用「临时改名现有花材」做标记（如 玫瑰→玫瑰✦，确认后撤销）。
- 新增花材的管线铁律：**绝不改 app.js**（gen-flowers.js 硬编码行号抽取），新花全部注入 gen-flowers.js（addEntry 需放在 entries/addEntry 定义之后，勿犯 TDZ）+ flowers-data.js 加条目（不在 FOLIAGE/FILLER_TYPES 自动归主花）→ 重跑三步管线 → 清 `._*` → sync。
- **白色/浅色花瓣必须加深色描边**（stroke=shade(hex,-32)，宽 1.6-1.8），否则选花卡片白底上花瓣隐身只剩花芯。
- **新增叶材走 bakedFoliage 通道**（2026-10-15）：data 条目带 `bakedFoliage:true`（**不要设 foliage:true**，否则误入 renderer 硬编码 drawFoliage）+ id 注册进 FOLIAGE_TYPES；gen-flowers.js 用自包含叶材引擎（leafPath/buildSprig/buildFan/buildCatkin + bakeFoliage，mode 'whole'）烘焙整株，W.data 循环开头 `if (d.bakedFoliage) continue` 防双烘；renderer.js modeOf 加了 `d.bakedFoliage→'whole'`。卡片图自动用 `${id}_c{color}`，无需 __preview。
- **whole 模式烘焙锚点约定**：p0=[0,0] 在植株顶部中心、身体向下延伸（对齐 fishtailfern ay≈0、h≈150）；烘焙格内容必须留在安全区（y > -59，即 VB 顶 -25 + 34px padding）——顶端叶过长会溢出格子上边缘，**污染相邻格截图**（bbox 虚胖）且自身被裁；顶端叶固定缩为 leafL*0.55。
- 烘焙格污染检测法：raw PNG 逐行 alpha 找不连续内容块；对照 manifest h 与设计高度是否一致。

## 小程序关键约定
- 花材图全部离线烘焙（SVG 滤镜无法在小程序实现），素材在**主包 `miniprogram/assets/`**（317 张量化 PNG 约 1482KB，主包共 1609KB / 2048KB 上限；本地 webp 真机不解码，必须 PNG）。
- **分包内静态资源只能被本分包页面引用，主包页面（含 canvas createImage）引用会在真机 404**（开发者工具不严格）——素材必须放主包，除非资源只被分包页面使用。
- **Canvas 图片必须 `canvas.createImage()`（canvas 节点方法）；wx.createImage 已被基础库 3.17+ 移除**，用了会导致花材全部不显示。
- 素材格式：process.py 默认 webp 主包；`python3 tools/process.py png` 切量化 PNG 三分包（注意：该模式仍有主包引用限制，仅 webp canvas 不兼容时再考虑）。
- 自定义导航栏必须按 `wx.getMenuButtonBoundingClientRect()` 预留胶囊空间（高度取胶囊 bottom、右侧取 windowWidth - 胶囊 left），只用 statusBarHeight 会被胶囊遮挡。
- 小程序 canvas 尺寸不要用 CSS 百分比（flex 下原生组件高度解析不可靠，会溢出盖住相邻面板）：父容器 flex+min-height:0，canvas 绝对定位，JS 实测 boundingClientRect 后显式设 px 宽高和 node buffer。
- 修改网页 app.js 花材/花瓶绘制后，需重跑烘焙流水线同步小程序素材。
- 底部面板用 flex 布局（`.panel` flex column + 内容区 `flex:1;min-height:0`），不要写死内容区高度（safe-area 设备会裁切/留空）。
- 调整花材页头部行：[花材图][名称][置最后][置最前][移除 −] 三按钮并排。
