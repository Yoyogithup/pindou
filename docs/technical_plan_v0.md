# 拼豆小纸条 V0 技术方案（交接稿）

> 状态：历史技术方案；对应功能现已完成开发并进入真机验收。
>
> 依据：`docs/product_plan_v0.md`、当前主项目源码、Zippland/perler-beads 参考源码
>
> 原则：保留内部工作台，新增 mobile-first H5；图片默认只在浏览器本地处理；核心算法采用洁净重写。

## 1. 技术结论

V0 不建议继续改造现有 FastAPI 工作台页面。它适合内部调试和资料维护，但面向普通用户信息密度过高。建议新增独立的 Next.js 消费端，首个业务页面为 `/generate`；现有 `web/` 保持为内部管理端。

Zippland 参考项目可复用或重写其技术思路：图片像素化、MARD 色板映射、Oklab 色差、网格计算、颜色统计、Canvas PNG 和 CSV。但它没有独立“豆子用量 PNG”，导出图带旧品牌、水印和二维码，移动页面也仍是专业参数工作台，不能直接作为本产品页面。

V0 五个硬性验收门槛：

1. 图纸 PNG 和豆子用量 PNG 是两个独立产物；用量不能只有 CSV，也不能只嵌在图纸底部。
2. 结果用真实 `<img>` 展示以支持长按，同时保留“保存图片”和“打开原图”兜底，并通过真机验收。
3. “用途 × 模式”解析为确定、可测试的底层参数，不能只是文案标签。
4. 大图可以打开、缩放和平移，页面缩略图不是唯一查看方式。
5. 一期的开源说明可以很弱，但代码侧必须留有 README、第三方声明及后续公开入口。

已确认的产品决策：保留原图比例并以最长边 29/58/72 生成；V0 默认去除背景；微信内置浏览器属于硬性验收；不展示色库中不存在或未经核验的颜色名称；核心算法洁净重写。

## 2. 当前代码能力

### 2.1 当前主项目

根目录是 FastAPI + Jinja 内部工作台，已有预设、任务、历史记录等页面，适合继续承担内部调试。它尚未接入完整生成引擎。`data/presets.json` 的参数主要是描述性数据，未形成算法约束；`data/brand_color_codes.json` 只有少量占位色号，不能作为生产色板。

### 2.2 Zippland 参考项目

本地参考代码：`reference-projects/zippland-perler-beads-mobile`

可参考能力：

- 浏览器上传和 Canvas 图像处理；
- dominant / average 两种采样；
- Oklab 色差和相似色合并；
- 按目标网格计算横纵格数；
- MARD 等多品牌色号映射；
- 图纸 PNG、CSV 导出；
- `colorCounts`、`totalBeadCount` 的统计思路。

需要替换或新增：

- 新手化单页流程；
- 明确点击后才生成的状态机；
- 独立豆子用量 PNG；
- 新品牌图纸渲染器；
- 手机保存分层兜底；
- 大图缩放查看；
- preset 硬参数及颜色数上限；
- 开源与第三方说明。

参考项目采用 AGPL-3.0。本项目已决定洁净重写：它只能作为功能行为和调研证据，不复制源代码、代码结构、注释、测试或色板 JSON，也不建立运行时依赖。

## 3. 总体架构与文件结构

```text
用户手机
└─ Next.js 消费端 /generate
   ├─ 本地上传与预览
   ├─ Preset 参数解析
   ├─ 浏览器端图像处理
   ├─ 图纸 PNG
   ├─ 豆子用量 PNG
   └─ 查看原图 / 长按 / 下载 / 系统分享

内部人员
└─ FastAPI 工作台 web/
   ├─ 资料与预设维护
   └─ 后续调试工具
```

推荐新增目录：

```text
apps/consumer/
├─ package.json
├─ public/
│  └─ THIRD_PARTY_NOTICES.md
└─ src/
   ├─ app/
   │  ├─ layout.tsx
   │  ├─ generate/page.tsx
   │  ├─ about/page.tsx
   │  └─ globals.css
   └─ features/generator/
      ├─ components/
      │  ├─ UploadCard.tsx
      │  ├─ PurposeSelector.tsx
      │  ├─ ModeSelector.tsx
      │  ├─ GenerationStatus.tsx
      │  ├─ ResultSection.tsx
      │  ├─ ResultImageCard.tsx
      │  └─ ImageViewer.tsx
      ├─ hooks/
      │  ├─ useGeneratorFlow.ts
      │  └─ useObjectUrl.ts
      ├─ model/
      │  ├─ types.ts
      │  ├─ presets.ts
      │  └─ resolvePreset.ts
      ├─ core/
      │  ├─ decodeImage.ts
      │  ├─ normalizeImage.ts
      │  ├─ calculateGrid.ts
      │  ├─ mergeSimilarColors.ts
      │  ├─ cleanupSmallRegions.ts
      │  ├─ limitColorCount.ts
      │  ├─ removeBackground.ts
      │  ├─ calculateUsage.ts
      │  └─ generatePattern.ts
      ├─ export/
      │  ├─ renderPatternPng.ts
      │  ├─ renderUsagePng.ts
      │  ├─ canvasToBlob.ts
      │  └─ saveImage.ts
      └─ data/
         ├─ mardPalette.json
         └─ PALETTE_SOURCES.md
```

消费端不依赖 FastAPI 才能生成，V0 图片不上传服务器。参考仓库继续作为只读材料，不在运行时跨目录 import。`mardPalette.json` 必须由独立、可追溯的来源建立，不能从参考仓库的 `colorSystemMapping.json` 复制。

## 4. 统一数据模型

算法、页面和两种导出必须围绕同一个中间文档工作，避免各算一次导致数量不一致。

```ts
type Purpose = 'keychain' | 'fridge-magnet' | 'stand'
type Mode = 'beginner' | 'standard' | 'detail'

interface EffectivePreset {
  purpose: Purpose
  mode: Mode
  maxGridEdge: number
  samplingMode: 'dominant' | 'average'
  similarityThreshold: number
  minRegionSize: number
  maxColors: number
  paletteId: 'MARD'
  sectionInterval: 5 | 10
  backgroundStrategy: 'remove-edge-connected'
}

interface ColorUsage {
  hex: string
  code: string
  count: number
  name?: string
}

interface PatternDocument {
  version: 1
  width: number
  height: number
  cells: Array<Array<{ hex: string | null; code: string | null }>>
  paletteId: 'MARD'
  usage: ColorUsage[]
  totalBeads: number
  preset: EffectivePreset
}
```

固定接口：

```ts
resolvePreset(purpose, mode): EffectivePreset
generatePattern(image, preset): Promise<PatternDocument>
renderPatternPng(document): Promise<ExportAsset>
renderUsagePng(document): Promise<ExportAsset>
```

强制不变量：

- `totalBeads === sum(usage.count)`；
- 透明或移除的背景格不计数；
- `usage.length <= preset.maxColors`；
- 两张 PNG 读取同一个 `PatternDocument`。

## 5. 用途 / 模式参数映射

用途决定成品规模；模式决定还原和去杂色强度；两者共同决定最大颜色数。V0 固定 MARD 色板，不暴露品牌选择。

### 5.1 用途参数

| 用途 | 最长边格数 | 坐标分段 | 含义 |
|---|---:|---:|---|
| 挂件 | 29 | 每 5 格 | 尺寸小，优先可制作性 |
| 冰箱贴 | 58 | 每 10 格 | 默认平衡档 |
| 摆件 | 72 | 每 10 格 | 容纳更多细节 |

### 5.2 模式参数

| 模式 | 采样 | Oklab 相似阈值 | 最小色块 | 行为 |
|---|---|---:|---:|---|
| 新手 | dominant | 32 | 3 格 | 强合并、少杂色 |
| 标准 | dominant | 24 | 2 格 | 清晰与还原平衡 |
| 细节 | average | 14 | 1 格 | 保留渐变和局部细节 |

### 5.3 最大颜色数矩阵

| 用途 \ 模式 | 新手 | 标准 | 细节 |
|---|---:|---:|---:|
| 挂件 | 8 | 12 | 16 |
| 冰箱贴 | 10 | 16 | 24 |
| 摆件 | 12 | 20 | 28 |

默认组合：冰箱贴 + 标准，即最长边 58、dominant、阈值 24、最小色块 2、最多 16 色。

以上是首轮校准基线，需用产品样图验收。相似色阈值不能保证最终颜色数，必须新增硬性 `limitColorCount`：颜色超限时，将用量最少的颜色并入 Oklab 距离最近的保留色，直到达标。

### 5.4 网格几何

推荐保留原图比例，以最长边为 29 / 58 / 72：

```text
横图：width = maxGridEdge
      height = round(maxGridEdge × 原图高 / 原图宽)
竖图：height = maxGridEdge
      width = round(maxGridEdge × 原图宽 / 原图高)
```

不建议默认裁成正方形，否则容易破坏宠物、人像和竖图构图。如果业务要求匹配固定方形豆板，应明确增加裁剪步骤。

### 5.5 处理流水线

1. 校验 JPG/PNG、文件大小和尺寸；
2. 修正 EXIF 方向并解码；
3. 将源图最长边降至约 1600–2048 px，控制手机内存；
4. 按 preset 计算网格并采样；
5. 映射 MARD 色板；
6. 合并相似色；
7. 清理小连通色块；
8. 执行最大颜色数硬限制；
9. 去除背景并生成 `null` 网格；
10. 只计算一次用量统计；
11. 并行渲染两张 PNG。

V0 可先在主线程处理，但核心函数应保持纯函数和可序列化输入，便于性能不足时迁移到 Web Worker。

### 5.6 V0 去背景方案

产品决策为默认不保留背景。考虑到洁净重写且 V0 不引入 AI 分割服务，P0 采用可解释的本地算法：

1. PNG 已有透明通道时直接保留透明区域；
2. 对网格四边颜色做 Oklab 聚类，寻找覆盖多个边缘的候选背景色；
3. 只从画面边界向内做连通区域 flood fill，避免删除主体内部的相同颜色；
4. 被判定为背景的格子写为 `hex: null, code: null`，不计入总豆数；
5. 自动结果不正确时，提供轻量的“点选背景重试”：用户在预览上点一个背景位置，再执行边缘连通删除；
6. 允许撤销并重新点选，但不扩展成逐格编辑器。

自动删除需要置信度：候选代表色需同时满足覆盖足够边界比例、触达四条边、触达至少三个角，并通过 dry-run 安全检查（删除比例不超过阈值、不删除全部非 null 格），否则提示用户点选背景，不能静默删掉主体。阈值应通过五类样图校准，集中配置，不先写成不可调整的常量。

这套方案适合纯色、近纯色和主体与背景有明显边界的图片；复杂纹理背景、毛发与背景近色时不能保证完整抠图。若产品要求任意宠物照片都能精准去背景，则需另立 P1，引入经过许可证和移动性能评估的本地分割模型，工作量和包体都会明显上升。

## 6. 独立豆子用量 PNG

这是 V0 必须新增的模块，完全独立于 CSV 和图纸排版。

### 6.1 输出设计

- 尺寸：1080 × 1350 px；
- 标题：豆子用量；
- MARD 色板、图纸格数、总豆数、颜色数；
- 每项显示色块、色号、数量；
- 最多 28 色时使用两列，每列最多 14 行；
- 按色号自然排序，方便采购和配豆；
- 底部可有轻量产品名，不放二维码或大广告。

V0 不显示颜色名称：若独立色库没有可靠名称，产品不自动补全或编造，由用户自行理解色号。用量图固定只显示“色块 + MARD 色号 + 数量”。

### 6.2 数据和渲染职责

`calculateUsage(cells)` 负责唯一一次计数，返回 `usage` 和 `totalBeads`。`renderUsagePng(document)` 只排版，不重新统计。

输出使用 `canvas.toBlob('image/png')`，得到 Blob、Object URL、文件名和像素尺寸，避免长期持有大型 base64。建议文件名：`pindou-beads-58x46.png`。

### 6.3 必须验收

- 可以不渲染图纸，单独调用并得到用量 PNG；
- 分项之和严格等于总豆数；
- 1、14、15、28 色均无裁切、重叠；
- 390 px 页面上能清楚预览；
- 保存后仍是 1080 px 宽原图；
- 不包含 Zippland 品牌、水印或二维码。

## 7. 图纸 PNG 与大图查看

图纸 PNG 只承担制作信息：网格、每格 MARD 色号、外围坐标与每 5/10 格分段、尺寸和总豆数摘要，以及轻量产品标识。豆子清单不再塞到图纸底部。

建议按最长边选择单格像素：

| 最长边 | 单格像素 |
|---:|---:|
| ≤ 32 | 32 px |
| 33–60 | 24 px |
| 61–72 | 22 px |

页面只做自适应缩略显示，不重新压缩原 PNG。每张卡片提供“查看大图”“保存图片”和长按提示。

P0 大图查看器必须支持：

- 点击进入全屏；
- 双击放大、双指缩放、拖拽平移；
- `+`、`−`、复位、关闭按钮，避免完全依赖手势；
- 按原始像素查看，放大后可读单格色号；
- “打开原图”兜底，使用浏览器原生图片页缩放。

该能力隔离在 `ImageViewer.tsx`。实现时可选择体积可控、维护正常的手势库，或单独封装 Pointer Events；不要与生成算法耦合。页面不得设置 `user-scalable=no`。建议文件名：`pindou-pattern-58x46.png`。

## 8. 手机上传与保存

### 8.1 上传

采用真实文件输入：

```html
<input type="file" accept="image/jpeg,image/png" />
```

上传后立即显示本地预览，释放旧 Object URL，限制异常大文件；选择参数后由用户点击生成。页面提示“图片仅在本机处理，不上传服务器”。

### 8.2 保存必须分层

`download` 属性不能保证所有浏览器执行相同行为，内嵌 WebView 对 Blob URL 的支持也可能不同。设计如下：

1. Canvas 转 Blob，用 Object URL 赋给真实 `<img>`，长按是主路径；
2. “保存图片”由用户主动点击，创建带 `download` 的 `<a>`；
3. 提供“打开原图”，下载未发生时进入浏览器原图页长按；
4. 在 HTTPS 且 `navigator.share`、`navigator.canShare({ files })` 均支持时显示系统分享；
5. 若真机发现特定 WKWebView 无法对 Blob URL 长按，可让展示图改用 data URL，Blob 仍用于下载和分享。

Object URL 只能在重新生成、替换结果或组件卸载时释放，不能刚生成就 revoke。网页也不能承诺“静默写入相册”；产品提示应为“若未下载，请打开原图后长按保存”。

### 8.3 真机矩阵

| 环境 | 上传 | 长按 | 保存按钮 | 打开原图 | 缩放 |
|---|---|---|---|---|---|
| iPhone Safari | 必测 | 必测 | 必测 | 必测 | 必测 |
| iPhone 微信内置浏览器 | 必测 | 必测 | 必测 | 必测 | 必测 |
| Android Chrome | 必测 | 必测 | 必测 | 必测 | 必测 |
| Android 微信内置浏览器 | 必测 | 必测 | 必测 | 必测 | 必测 |

必须记录机型、系统、浏览器版本和真实动作结果。“出现按钮”不等于“成功保存”。

技术依据：MDN 明确说明 [`download`](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/a#download) 最终行为由浏览器决定；[Web Share](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/share) 文件分享要求安全上下文、用户触发和 `canShare` 检测；[WebKit #216918](https://bugs.webkit.org/show_bug.cgi?id=216918) 的历史问题也说明 WKWebView 的 Blob/download 行为不能直接等同于 Safari。

## 9. 页面结构与状态

`/generate` 保持单页单任务：品牌区 → 上传 → 用途 → 模式 → 生成按钮 → 状态 → 两张结果卡 → 轻量页脚。

状态机：

```text
idle → imageSelected → generating → success
                         └──────→ error
success → 参数变化 → imageSelected
success → 重新生成 → generating
```

选择器变化只把结果标记为待更新，不立即重新计算。CSV 不在 V0 默认页面展示，可作为核心层/内部调试能力保留，未来若有真实需求再放入“高级功能”。

### 9.1 朋友如何使用

消费端构建后部署到一个手机可访问的 HTTPS 地址。用户把链接发给朋友，对方无需安装 App，也无需连接现有 FastAPI 工作台，即可在自己的手机浏览器中上传、生成、查看和保存。

一期若完全不设访问控制，“知道链接的人都能使用”，链接也可能被继续转发。若只想给少量朋友试用，可以在静态站点/CDN 入口增加一个共享访问码或基础访问控制；单一共享访问码可由部署环境配置，不需要用户表和数据库。它只控制网页入口，不接收用户图片。

### 9.2 数据存放位置

| 数据 | V0 存放位置 | 生命周期 |
|---|---|---|
| 用户上传原图 | 朋友自己的浏览器内存 | 刷新、关闭页面或更换图片后释放 |
| 解码像素、网格、统计 | 浏览器内存 | 当前生成会话有效 |
| 图纸 PNG / 用量 PNG | 浏览器 Blob 与 Object URL | 当前页面有效；保存后进入用户手机相册或下载目录 |
| 用途、模式选择 | 默认只在页面状态中 | 刷新后恢复默认；如未来需要可只把非敏感偏好放 localStorage |
| MARD 色板、页面 JS/CSS | 静态托管/CDN | 随应用版本发布并可能被浏览器缓存 |
| 用户、任务、历史记录 | V0 不创建 | 无数据库 |
| 访问日志 | 可能由托管/CDN 自动产生 | 只应包含常规请求元数据，不应包含图片内容 |

V0 不把原图、生成图、Blob 或 base64 发送到 API。刷新页面后，如果用户没有主动保存，生成结果即消失；这是预期的隐私取舍，不提供云端找回。

### 9.3 部署边界

V0 需要的是“静态网页托管 + HTTPS”，不需要业务 API、图片处理服务器或数据库。现有 FastAPI 工作台继续本地或单独部署，不进入朋友使用的主链路。

为兑现“图片仅在本机处理”，一期建议：

- 不接入会采集页面内容的第三方分析或录屏 SDK；
- 字体、图标和关键资源尽量随站点自托管；
- 发布验收时通过浏览器 Network 面板确认图片数据没有外发；
- 托管访问日志遵循最小保留原则；
- 所有 Object URL 在替换结果或离开页面时释放。

## 10. 一期的开源说明策略

一期不会公开，且已经选择洁净重写。因此 UI 可以非常低调。参考项目只作为调研材料，不把其 AGPL 代码或数据打入产品。

### 10.1 一期私有试用

- 页脚仅放低对比度的“关于”文字入口，不单独突出 GitHub；
- `/about` 页面底部展示简短“第三方说明”；
- GitHub 仓库可以暂时是私有仓库；
- 根 README 记录参考项目、参考 commit、洁净重写决定和实现边界；
- `THIRD_PARTY_NOTICES.md` 记录实际进入产品的第三方依赖及其许可证；
- 导出 PNG 只显示本产品轻量标识，不放许可证、GitHub 或二维码。

### 10.2 对外公开时

- 页脚可仍保持低视觉权重，但提供可访问的“开源说明”；
- 说明页包含项目许可证、实际第三方依赖、参考项目致谢和 GitHub 地址；
- README 与网页信息保持一致；
- 项目是否公开源码由届时采用的自有许可证与第三方依赖决定。

洁净重写的工程边界：

1. 不复制参考项目源码、注释、文件组织和测试；
2. 不复制其色板 JSON、图片、水印、二维码和品牌素材；
3. 根据产品需求重新定义接口、数据模型、算法实现和测试；
4. 独立取得并记录 MARD 色号—HEX 数据来源；
5. 第三方 npm 依赖仍逐项检查并记录许可证。

若后续改变决定并复制或修改 AGPL 实现，需要重新评估 [AGPL-3.0 第 13 节](https://www.gnu.org/licenses/agpl-3.0.en.html#section13) 等要求。以上是工程风险控制，不替代专业法律意见。

## 11. 测试与验收

### 单元测试

- 9 个 preset 组合映射准确；
- 横图、竖图比例和最长边准确；
- 最终颜色不超过上限；
- `totalBeads` 等于用量之和；
- 透明背景不计数；
- 自动去背景只删除与边缘连通的区域；
- 低置信度背景会要求点选，不会静默删除主体；
- 两张 PNG 无文字或边界溢出。

### 样图测试

按产品文档准备宠物头像、人像、卡通、浅背景和复杂背景至少 5 张图。每张运行 9 个组合，检查主体辨识度、背景删除结果、点选重试、模式差异、杂色、颜色数和两张图的数据一致性。

### 移动验收

- 390 × 844 无横向溢出；
- 上传、生成、错误恢复可单手完成；
- 58 格默认图可读；72 格图可打开、缩放、平移；
- 四类真机完成保存矩阵；
- 页面缩放未禁用；
- 重新生成和离开页面会释放 Object URL。

建议性能目标：58 格在主流近三年手机约 3 秒内完成，72 格约 6 秒内完成且不崩溃。达不到时再迁移 Web Worker。

## 12. 实施优先级

### P0 必须完成

- 新消费端和 `/generate`；
- 本地上传、预览、方向修正；
- 9 组 preset；
- 自动边缘连通去背景和点选背景重试；
- 像素化、色板映射、去杂色和颜色数硬限制；
- 独立图纸 PNG；
- 独立豆子用量 PNG；
- 真实 `<img>`、长按、保存按钮、打开原图；
- 大图缩放查看；
- 低调的关于入口、README、第三方声明；
- 真机上传、保存和缩放验收。

### P1 有余力再做

- 系统文件分享；
- 面向复杂照片的本地 AI 分割；
- Web Worker；
- preset 内部配置管理。

### 本周不建议做

- 登录、云存图和历史同步；
- AI 抠图和复杂编辑器；
- PWA、社区、公开分享；
- 默认暴露 CSV；
- 多品牌色板切换；
- 把消费端和内部工作台强行合成一个页面。

## 13. 难度与主要风险

| 模块 | 难度 | 风险 |
|---|---|---|
| 移动页面骨架 | 中 | 响应式与交互状态 |
| 上传与预处理 | 中 | EXIF、内存、异常图 |
| Preset 解析 | 低 | 效果校准 |
| 独立 MARD 色板 | 中 | 数据来源和准确性 |
| 洁净重写像素算法 | 中 | 效果一致性和测试覆盖 |
| V0 去背景 | 高 | 复杂背景、近色边缘、误删主体 |
| 去杂色/颜色硬限制 | 中 | 细节损失 |
| 图纸 PNG | 中 | 坐标、字号、大画布 |
| 独立用量 PNG | 中 | 排版和统计一致性 |
| 手机保存兼容 | 高 | Safari/微信 WebView 差异 |
| 大图缩放 | 中 | 手势冲突与性能 |
| 第三方合规 | 低至中 | 依赖许可证和数据来源 |

整体难度：**中偏高**。最大不确定性是复杂照片去背景、preset 效果校准、手机内嵌浏览器保存，以及独立 MARD 色板的数据准确性。

## 14. 已确认决策与剩余输入

已确认：

1. 保留原图比例，以最长边 29/58/72 生成；
2. V0 默认不保留背景；
3. 微信内置浏览器属于硬性验收范围；
4. 不展示色库中没有或未经核验的颜色名称；
5. 核心算法采用洁净重写。

开发前仍需准备或确认：

1. 一份来源可追溯、可用于本项目的 MARD 色号—HEX 完整数据；
2. 是否接受“自动边缘连通删除 + 点选背景重试”作为 V0 去背景能力边界；
3. 用产品样图校准三种模式阈值，参数表目前是首轮基线。

## 15. 主要涉及文件

现有资料：

- `docs/product_plan_v0.md`
- `docs/development_status.md`
- `docs/research_report.md`
- `docs/mobile_reference_research.md`
- `reference-projects/README.md`

现有代码与参考：

- `web/`：保留为内部工作台；
- `data/presets.json`：迁移核对用，不直接作为最终算法配置；
- `reference-projects/zippland-perler-beads-mobile/src/utils/pixelation.ts`
- `reference-projects/zippland-perler-beads-mobile/src/utils/imageDownloader.ts`
- `reference-projects/zippland-perler-beads-mobile/src/utils/pixelEditingUtils.ts`
- `reference-projects/zippland-perler-beads-mobile/src/utils/colorSystemUtils.ts`
- `reference-projects/zippland-perler-beads-mobile/src/app/colorSystemMapping.json`

以上参考文件只用于功能调研，不复制进入产品。未来主要新增文件以第 3 节 `apps/consumer/` 为准。进入开发前，应先补齐第 14 节剩余输入，并把参数表转成可执行测试。
