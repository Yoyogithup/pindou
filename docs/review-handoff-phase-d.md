# 拼豆小纸条 V0 — 阶段 D 独立 PNG 渲染 Code Review 交接文档

> 作者：Qoder（阶段 D 开发者）
> 日期：2026-07-02
> 对应计划：`docs/handoff.md` 第 8 节「阶段 D：两个独立 PNG」
> 当前状态：阶段 D 已完成，未进入阶段 E–F，未执行 git commit / push / reset / 删除操作。

## 一、本轮实现范围

按 `docs/handoff.md` 与 `docs/technical_plan_v0.md` 第 6、7 节要求，仅完成「阶段 D：两个独立 PNG」的纯渲染函数与自动化测试：

- 实现 `renderPatternPng(document)`：按最长边选择单格像素，绘制网格、MARD 色号、坐标分段、尺寸与总豆数摘要、轻量产品标识。
- 实现 `renderUsagePng(document)`：固定输出 1080×1350 px，独立排版豆子用量清单。
- 新增 `canvasAdapter.ts`：浏览器原生 Canvas / Node `canvas` 包跨环境适配，保证 Jest 测试可验证像素输出。
- 编写对应单元测试，覆盖 `TC-PATTERNPNG-001~005` 与 `TC-USAGEPNG-001~006`。
- 未实现：上传页面、Canvas 图片解码、EXIF、大图查看器、保存/分享、手机保存真机验收。

## 二、新增和修改文件

### 新增文件

- `apps/consumer/src/features/generator/core/renderPatternPng.ts`
- `apps/consumer/src/features/generator/core/renderUsagePng.ts`
- `apps/consumer/src/features/generator/core/canvasAdapter.ts`
- `apps/consumer/src/features/generator/core/__tests__/renderPatternPng.test.ts`
- `apps/consumer/src/features/generator/core/__tests__/renderUsagePng.test.ts`

### 修改文件

- `apps/consumer/src/features/generator/core/__tests__/renderPatternPng.test.ts`
  - 顶部增加 `/** @jest-environment node */`，使 `canvas` 包在 Node 环境返回带 `arrayBuffer()` 的标准 Blob，避免 jsdom Blob polyfill 缺失该方法。
- `apps/consumer/src/features/generator/core/__tests__/renderUsagePng.test.ts`
  - 同上，增加 `/** @jest-environment node */`。
- `apps/consumer/src/features/generator/core/renderPatternPng.ts`
  - 删除未使用的 `COLORS_TEXT` 常量，消除 Lint warning。

## 三、中间数据模型

两种 PNG 均消费同一个 `PatternDocument`：

```ts
interface PatternDocument {
  version: 1;
  width: number;
  height: number;
  cells: PatternCell[][];
  paletteId: "MARD";
  usage: ColorUsage[];
  totalBeads: number;
  preset: EffectivePreset;
}
```

强制不变量：

- `totalBeads === usage.reduce((s, u) => s + u.count, 0)`；
- `usage.length <= preset.maxColors`；
- 背景 `null` 格不进入 `usage`；
- 两张图读取同一 `document`，渲染器内部不重新统计。

## 四、图纸 PNG 规格

### 4.1 单格像素

按 `technical_plan_v0.md` 第 7 节：

| 最长边 | 单格像素 |
| ---:| ---:|
| ≤ 32 | 32 px |
| 33–60 | 24 px |
| 61–72 | 22 px |

由 `getCellSize(maxEdge)` 实现。

### 4.2 画布尺寸

```text
width  = MARGIN_LEFT  + gridWidth  * cellSize + MARGIN_RIGHT   // 80 + grid * cell + 40
height = MARGIN_TOP   + gridHeight * cellSize + MARGIN_BOTTOM  // 80 + grid * cell + 100
```

坐标、摘要和页脚位于边距内，不被网格截断。

### 4.3 绘制内容

- 白色背景；
- 顶部 X 轴坐标、左侧 Y 轴坐标：首格、末格、按 `preset.sectionInterval` 分段处标记；
- 每个有效格填充 HEX 色块并居中绘制 `code`，文字颜色按亮度自适应（深底白字、浅底黑字）；
- `null` 格绘制浅灰底 + 斜纹，与有效白色豆格视觉区分；
- 每格 1 px 浅灰边框；
- 底部摘要：`{width}×{height} 格 · 总豆数 {totalBeads} · {usage.length} 色`；
- 右下角轻量产品名「拼豆小纸条」。

### 4.4 文件名

```text
pindou-pattern-{width}x{height}.png
```

## 五、豆子用量 PNG 规格

### 5.1 固定输出

- 尺寸：1080 × 1350 px；
- 格式：`image/png`；
- 背景：纯白。

### 5.2 绘制内容

- 标题「豆子用量」；
- 副标题：`MARD 色板 · {width}×{height} 格 · 总豆数 {totalBeads} · {colorCount} 色`；
- 颜色列表按 MARD 色号自然排序（`A1, A2, A10` 而非字典序 `A1, A10, A2`）；
- 每项包含 48×48 色块、色号、数量；
- ≤ 14 色单列，15–28 色双列，每列最多 14 行；
- 底部轻量产品名「拼豆小纸条」。

### 5.3 文件名

```text
pindou-beads-{width}x{height}.png
```

## 六、Canvas 跨环境适配

`canvasAdapter.ts` 保持最小职责：

- 浏览器环境：`document.createElement("canvas")` + `canvas.toBlob()`；
- Node / Jest 环境：动态引入 `canvas` 包的 `Canvas` 类，使用 `toBuffer("image/png")` 生成 Buffer，再包装为 `node:buffer` 的 `Blob`。

两个 PNG 渲染测试文件顶部声明 `/** @jest-environment node */`，强制使用 Node 环境，避免 jsdom 的 `Blob.prototype.arrayBuffer` 缺失导致测试失败。生产构建仍使用浏览器原生 API。

## 七、测试覆盖

### 图纸 PNG 测试（renderPatternPng.test.ts）

- `TC-PATTERNPNG-001`：单格尺寸按最长边 32/33/60/61/72 正确选择；
- `TC-PATTERNPNG-002`：坐标和分段标记能生成合法 PNG，尺寸与返回一致；
- `TC-PATTERNPNG-003`：多色小网格生成合法 PNG，尺寸合法；
- `TC-PATTERNPNG-004`：`null` 格不影响 `totalBeads`，生成合法 PNG；
- `TC-PATTERNPNG-005`：文件名以 `pindou-pattern-` 开头，不含 `zippland`；
- 附加：10×10 网格生成合法 PNG；
- 附加：72×72 大网格使用 22 px 单格，画布尺寸断言为 `80 + 72*22 + 40` × `80 + 72*22 + 100`。

### 用量 PNG 测试（renderUsagePng.test.ts）

- `TC-USAGEPNG-001`：独立调用 `renderUsagePng` 得到合法 1080×1350 PNG、正确文件名、`blob:` Object URL；
- `TC-USAGEPNG-002`：输出固定规格与文件名 `pindou-beads-58x44.png`；
- `TC-USAGEPNG-003`：1、14、15、28 色均生成 1080×1350，无尺寸异常；
- `TC-USAGEPNG-004`：文件名不含 `zippland`，以 `pindou-beads-` 开头；
- `TC-USAGEPNG-006`：文件名包含网格尺寸，`totalBeads` 与输入一致；
- 附加：自然排序（`A10, A2, A1` 输入 -> 渲染后内部排序为 `A1, A2, A10`）；
- 附加：空用量仍生成 1080×1350 PNG。

## 八、验证结果

依次运行：

```bash
cd /Users/yumyun/Desktop/AI/pindou/apps/consumer
npm test -- --runInBand
npm run build
npm run lint
```

结果：

```text
Test Suites: 12 passed, 12 total
Tests:       123 passed, 123 total

next build: ✓ Compiled successfully / ✓ Finished TypeScript / ✓ Generating static pages
npm run lint: 无错误、无警告
```

## 九、已知限制

1. 阶段 D 仅实现 PNG 渲染函数，尚未接通图片上传、EXIF 解码、Canvas 像素读取，因此无法对真实宠物照片跑端到端生成。
2. `renderUsagePng` 的 28 色双列排版在视觉上可接受，但极端字号或超长色号可能在真机截图中需要微调；目前未做真实手机预览。
3. 字体回退为 `system-ui, -apple-system, sans-serif`，不同平台文字宽度略有差异，不影响布局结构。
4. 图纸中的 null 格使用斜纹填充，最终视觉效果需在产品样图上人工确认。

## 十、范围确认

- 未修改 `apps/consumer/src/app/generate/page.tsx` 或任何页面组件；
- 未实现真实文件上传、EXIF 解码、Canvas 图片解码；
- 未实现大图查看器、保存按钮、系统分享、长按交互；
- 未引入数据库、后端 API 或图片处理服务；
- 未修改 `web/` FastAPI 代码；
- 未修改 `reference-projects/` 目录内容；
- 未复制 Zippland 源码、测试、结构或色板 JSON；
- 未进入阶段 E（用户页面）和阶段 F（真机部署）。

## 十一、下一步建议

阶段 E 需要实现：

1. `/generate` 页面状态机与 UI；
2. 真实 `<input type="file">` 上传、本地预览、EXIF/Canvas 解码；
3. 点击生成后串接 `generatePattern` → `renderPatternPng` / `renderUsagePng`；
4. 结果卡、查看大图、保存按钮、打开原图、长按保存兜底；
5. Object URL 生命周期管理。

阶段 F 需要真实手机四环境验收上传、长按、保存、缩放与网络无外发。


## 十二、阶段 D CR 修复记录

### 修复范围

按 Codex 对阶段 D 的 Code Review，集中修复 P0/P1，未进入阶段 E–F。

### 1. P0：拆分 canvasAdapter，生产模块移除 require(canvas)

- 重写 `canvasAdapter.ts`：只保留浏览器原生 `document.createElement("canvas")` 和 `canvas.toBlob()`，不再包含任何 `require("canvas")`、`node:buffer` 或 `Buffer`。
- 新增 `canvasAdapter.node.ts`：Node 测试环境实现，使用 `canvas` 包的 `Canvas` 和 `node:buffer` 的 `Blob`。
- `jest.config.ts` 新增 `moduleNameMapper`：
  - `@/features/generator/core/canvasAdapter` → `canvasAdapter.node.ts`
  - `./canvasAdapter` → `canvasAdapter.node.ts`

阶段 E 接入 `/generate` 页面后，Next 客户端构建只会分析到浏览器版 `canvasAdapter.ts`，不会打包原生 Node 模块。

### 2. P0：修复用量图 14/15/28 色与页脚重叠

- 抽出 `computeUsageLayout(usage, options?)` 纯函数，返回 `UsageLayout` 结构。
- `rowHeight` 动态计算：`min(78, floor(availableHeight / rowsPerColumn))`，`availableHeight = HEIGHT - PADDING_Y - FOOTER_RESERVED - (PADDING_Y + 200)`。
- 新增 `USAGE_FOOTER_RESERVED = 40`：为页脚文字预留 40 px。
- 1 色：rowHeight = 78（上限生效）；14 色：70；28 色（双列 14 行）：70。
- 测试增强：`TC-USAGEPNG-003` 改为断言每个 item 的 `y + swatchSize < contentBottom`，14/28 色均通过。

### 3. P1：抽出布局函数并增强测试断言

图纸：

- 抽出 `computePatternLayout(doc)` 纯函数，返回 `PatternLayout`。
- 测试新增：极窄 1×29 图纸断言 `canvasWidth >= PATTERN_MIN_CANVAS_WIDTH`；`summaryY` / `footerX` / `footerY` 均在画布内；`summaryText` 包含网格尺寸和豆数。

用量图：

- 测试新增：自然排序断言 `items.map(code) = ["A1", "A2", "A10"]`；28 色双列 `col1X ≠ col2X`，每列 y 严格递增。
- 抽出 `sortUsage` 为导出函数，供测试和页面复用。

### 4. P1：新增 validatePatternDocumentForExport

新增 `validatePatternDocument.ts` 与同名测试，校验：

- version、width、height 为正整数；
- cells 行数 = height，每行长度 = width；
- 每格 hex/code 同时为空或同时有值；
- `totalBeads === sum(usage.count)`；
- `usage.length <= preset.maxColors`；
- `usage.length <= 28`（用量 PNG 排版上限）。

`renderPatternPng` 与 `renderUsagePng` 入口均调用该校验；非法文档抛出明确错误。

### 5. P1：修复极窄图纸摘要裁切

- 新增 `PATTERN_MIN_CANVAS_WIDTH = 300`：确保极窄图纸（如 1×29）画布宽度至少 300 px。
- `computePatternLayout` 中 `canvasWidth = max(rawWidth, PATTERN_MIN_CANVAS_WIDTH)`。
- 网格仍从 `MARGIN_LEFT` 开始，摘要和页脚位于最小宽度区域内。

### 6. 测试和构建结果

```text
Test Suites: 13 passed, 13 total
Tests:       136 passed, 136 total

next build: ✓ Compiled successfully / ✓ Finished TypeScript / ✓ Generating static pages
npm run lint: 无错误、无警告
```

### 7. 范围确认

- 未修改 `/generate` 页面或任何页面组件；
- 未实现上传、EXIF 解码、Canvas 图片解码、大图查看器、保存/分享；
- 未引入数据库、后端 API 或图片处理服务；
- 未修改 `web/` FastAPI 和 `reference-projects/`；
- 未复制 Zippland 源码、测试、结构或色板 JSON；
- 未进入阶段 E–F。

### 8. 已知剩余问题

- P2：清单排序可复用 `calculateUsage` 的排序函数（当前 `sortUsage` 已导出，后续可共享）；
- P2：Node 测试创建的 Object URL 可在测试结束后释放；
- P2：`canvasToBlob` 可补充浏览器 `toBlob(null)` 的失败测试。

这些不阻塞阶段 D 复审和阶段 E 启动。


## 十三、阶段 D 二次 CR 修复记录

### 修复范围

按 Codex 对阶段 D 第二轮复审，修复新发现的 P0 和 P1 数据一致性问题。

### 1. P0：cells → usage → totalBeads 完整一致性校验

重写 `validatePatternDocumentForExport`：

- 调用 `calculateUsage(doc.cells)` 计算期望的 usage 和 totalBeads；
- 逐项比对 `doc.usage` 与期望：code、hex、count 必须完全匹配；
- 拒绝重复 code、非法 HEX、count ≤ 0、usage 中不存在的 code、同一 code 对应多个 HEX。

错误示例：

- cells 全空 + usage 非空：长度不匹配，拒绝；
- 5×5 图纸 + usage 总和 35（超过网格容量）：totalBeads 不匹配，拒绝；
- usage 中出现 count=0 或非法 HEX：直接拒绝。

### 2. P0：测试辅助函数生成合法文档

重写 `renderUsagePng.test.ts` 的 `makeDocument`：

- 根据 `usage` 展开 `count` 个格子，填充 cells；
- 校验 `totalBeads ≤ width × height`，超过时抛错而非生成非法文档；
- 所有测试用例的 usage count 调整到合法范围（如 28 色每色 count=1）。

### 3. P1：TC-USAGEPNG-006 真正验证两张图一致

- 用同一个合法 `PatternDocument` 同时调用 `renderPatternPng` 和 `renderUsagePng`；
- 断言两者均成功生成合法 PNG、文件名包含同一网格尺寸；
- 断言 `document.totalBeads === usage.reduce(sum)` 且为 20。

### 4. P1：usage 额外非法输入校验

`validatePatternDocumentForExport` 新增：

- `count <= 0` 拒绝；
- `code` 重复拒绝；
- `hex` 非法（不满足 normalizeHex）拒绝；
- 同一 `code` 对应多个 HEX（由 `calculateUsage` 内部校验抛出）拒绝。

`validatePatternDocument.test.ts` 新增覆盖：重复 code、非法 HEX、count=0、cells 中不存在的 code、HEX 不一致、count 不一致、一码多色。

### 5. P2：computeUsageLayout 参数校验

`computeUsageLayout` 新增：

- `width` / `height` 必须为正整数；
- `availableHeight > 0`，否则抛错"无法容纳标题、列表和页脚预留区域"。

### 6. 测试和构建结果

```text
Test Suites: 13 passed, 13 total
Tests:       144 passed, 144 total

next build: ✓ Compiled successfully / ✓ Finished TypeScript / ✓ Generating static pages
npm run lint: 无错误、无警告
```

### 7. 范围确认

- 未修改 `/generate` 页面或任何页面组件；
- 未实现上传、EXIF 解码、Canvas 图片解码、大图查看器、保存/分享；
- 未引入数据库、后端 API 或图片处理服务；
- 未修改 `web/` FastAPI 和 `reference-projects/`；
- 未复制 Zippland 源码、测试、结构或色板 JSON；
- 未进入阶段 E–F。
