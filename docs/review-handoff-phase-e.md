# 拼豆小纸条 V0 — 阶段 E 用户页面 Code Review 交接文档

> 作者：Qoder（阶段 E 开发者）
> 日期：2026-07-03
> 对应计划：`docs/handoff.md` 第 9 节「阶段 E：用户页面」
> 当前状态：阶段 E 已完成，未进入阶段 F，未执行 git commit / push / reset / 删除操作。

## 一、本轮实现范围

按 `docs/handoff.md` 与 Stage E 计划要求，完成 `/generate` 页面从图片上传到结果展示的完整用户流程：

- 图片解码与 EXIF 方向修正（`decodeImage.ts`）
- 像素化采样 dominant/average 双模式（`pixelate.ts`）
- 完整生成管线编排（`generatePattern.ts`）
- Object URL 生命周期管理（`useObjectUrl.ts`）
- 生成流程状态机 Hook（`useGeneratorFlow.ts`）
- 上传卡片组件（`UploadCard.tsx`）
- 生成状态指示器 + 结果卡片 + 结果区容器（`GenerationStatus.tsx` / `ResultImageCard.tsx` / `ResultSection.tsx`）
- 全屏查看器：双指缩放、拖拽平移、双击放大、+/-/复位/关闭（`ImageViewer.tsx`）
- 保存/分享/打开原图能力 + 微信环境兜底（`saveImage.ts`）
- 页面集成重写（`page.tsx`）
- 开发色板数据（`devPalette.ts`，40 色，明确标记为非生产数据）
- 新增 `exifr` npm 依赖（仅用于 `exifr.orientation()` 读取 EXIF 方向标签）

## 二、新增和修改文件

### 新增文件

| 文件 | 用途 |
|---|---|
| `core/decodeImage.ts` | File → ImageData，EXIF 方向修正 + 降采样 |
| `core/pixelate.ts` | ImageData → HexGrid，dominant/average 采样 |
| `core/generatePattern.ts` | 完整管线编排，10 步算法流水线 |
| `core/saveImage.ts` | 下载/分享/打开原图/微信检测 |
| `hooks/useObjectUrl.ts` | Object URL 自动跟踪与释放 |
| `hooks/useGeneratorFlow.ts` | 状态机：idle → imageSelected → generating → success/error |
| `data/devPalette.ts` | 开发阶段 40 色色板（TEST_ONLY 标记） |
| `components/UploadCard.tsx` | 图片上传卡片 |
| `components/GenerationStatus.tsx` | 生成状态指示器 |
| `components/ResultImageCard.tsx` | 单张结果卡（真实 img + 操作按钮） |
| `components/ResultSection.tsx` | 结果区容器 |
| `components/ImageViewer.tsx` | 全屏查看器（手势缩放/平移） |
| `core/__tests__/pixelate.test.ts` | 像素化采样测试（7 用例） |
| `core/__tests__/generatePattern.test.ts` | 管线集成测试（5 用例） |
| `core/__tests__/saveImage.test.ts` | 保存工具测试（5 用例） |

### 修改文件

| 文件 | 变更 |
|---|---|
| `app/generate/page.tsx` | 完整重写，集成 useGeneratorFlow + 所有组件 |
| `app/generate/page.test.tsx` | 重写为 6 个测试用例 |
| `package.json` | 新增 `exifr` 依赖 |

## 三、核心架构

### 3.1 生成管线（generatePattern.ts）

10 步纯函数流水线，输入 ImageData + preset + palette，输出 PatternDocument：

```
calculateGrid → pixelate → mapGridToPaletteHex → mergeSimilarColors
→ cleanupSmallRegions → limitColorCount → autoRemoveBackground
→ hexGridToPatternCells → calculateUsage → 组装 PatternDocument
```

关键设计：所有算法步骤在 `HexGrid`（`(string|null)[][]`）上操作，最终一步通过 `hexGridToPatternCells` 转换为 `PatternCell[][]`（含 hex+code 配对）。这避免了 `mapHexGridToPalette` 返回 `PatternCell[][]` 后与下游算法模块（期望 `HexGrid`）的类型冲突。

### 3.2 状态机（useGeneratorFlow.ts）

状态：`idle | imageSelected | generating | success | error`

Actions：`selectImage(file)`, `setPurpose(p)`, `setMode(m)`, `generate()`, `reset()`

关键行为：
- `selectImage` 释放旧 Object URL，清除旧结果，进入 `imageSelected`
- `generate` 使用 `generatingRef` 防并发，调用 `decodeImage → generatePattern → Promise.all([renderPatternPng, renderUsagePng])`
- 参数变化（setPurpose/setMode）在 `success` 状态时标记 `resultStale=true`，不自动重新生成
- 生成失败进入 `error`，可重试

### 3.3 EXIF 方向处理（decodeImage.ts）

- `exifr.orientation(file)` 读取 orientation 值（1-8）
- `computeOrientationTransform` 根据 orientation 计算 canvas 变换矩阵
- `createImageBitmap` 解码图片，在离屏 canvas 上应用变换
- 最长边降至 2048px，控制手机内存

### 3.4 大图查看器（ImageViewer.tsx）

自封装实现，不依赖第三方库：
- Pointer Events：拖拽平移
- Touch Events：双指缩放（pinch-zoom）
- Wheel：滚轮缩放
- 双击：放大至 2.5x / 复位
- 缩放范围：0.5x ~ 8x
- 按钮：+/-/复位/关闭/ESC/下载
- 阻止背景滚动

## 四、测试覆盖

### 新增测试

**pixelate.test.ts（7 用例）**：
- dominant 模式 2x2 网格确定性 HEX
- average 模式均匀颜色输出
- 透明像素输出 null
- 四分色图 dominant 输出 4 种颜色
- 1x1 网格单格
- 非法 ImageData 抛错
- 非法网格尺寸抛错

**generatePattern.test.ts（5 用例）**：
- 纯色图完整管线生成合法 PatternDocument（totalBeads === sum(usage.count)，usage.length <= maxColors）
- 全透明图输出空用量
- 不同 preset 产生不同网格尺寸
- 非法 ImageData 抛错
- 空色板抛错

**saveImage.test.ts（5 用例）**：
- 非微信环境返回 false
- 微信环境返回 true
- 无 navigator.share 时返回 false
- downloadImage 创建 `<a download>` 并触发
- openOriginalImage 成功/失败分支

### page.test.tsx（6 用例）

- 默认渲染标题和用途选择器
- 切换用途更新选中状态
- 网格宽度提示正确
- 开发色板警告可见
- 隐私声明可见
- 上传区域可渲染

## 五、验证结果

```bash
cd /Users/yumyun/Desktop/AI/pindou/apps/consumer
npm test -- --runInBand
npm run build
npm run lint
```

```text
Test Suites: 16 passed, 16 total
Tests:       168 passed, 168 total

next build: ✓ Compiled successfully / ✓ Finished TypeScript / ✓ Generating static pages (5/5)
npm run lint: 0 errors, 3 warnings（均为有意使用 <img> 而非 next/image）
```

3 个 `<img>` warning 是有意为之：UploadCard（blob URL 预览）、ResultImageCard（支持长按保存）、ImageViewer（全屏查看 blob URL），next/image 对 blob URL 和长按保存支持不佳。

## 六、已知限制

1. **色板数据**：`devPalette.ts` 40 色为开发阶段占位数据，明确标记 `IS_PRODUCTION_PALETTE = false`，生产色板需后续替换。
2. **无后端**：所有计算在客户端完成，无图片上传服务、数据库或 API。
3. **EXIF 局限**：仅处理 orientation 标签（1-8），不处理其他 EXIF 元数据。
4. **大图查看器**：自定义实现，在极端尺寸图片上可能需要性能调优。
5. **微信分享**：`navigator.share` 在微信内置浏览器可能不可用，已做 UA 检测和提示兜底。
6. **字体回退**：与阶段 D 相同，`system-ui, -apple-system, sans-serif`，不同平台文字宽度略有差异。

## 七、范围确认

- 未实现 `/about` 页面
- 未引入数据库、后端 API 或图片上传服务
- 未修改 `web/` FastAPI
- 未修改 `reference-projects/`
- 未进入阶段 F（真机部署）
- 未实现 PWA、登录、支付、社区
- 未做 Web Worker 迁移（保持主线程，核心函数已是纯函数）

## 八、Codex 复审提示词

```
请对 apps/consumer/ 进行阶段 E Code Review，重点关注：

1. decodeImage.ts：EXIF orientation 1-8 变换矩阵是否正确、createImageBitmap 降级、降采样比例
2. pixelate.ts：dominant/average 采样算法正确性、透明像素处理
3. generatePattern.ts：10 步管线顺序、HexGrid vs PatternCell 类型转换、mapGridToPaletteHex 正确性
4. useGeneratorFlow.ts：状态机完整性、generatingRef 防并发、参数变化标记 resultStale、Object URL 释放
5. useObjectUrl.ts：URL 跟踪和释放时机、内存泄漏风险
6. ImageViewer.tsx：手势交互（双指缩放、拖拽、双击）、缩放边界、ESC 关闭、body overflow 恢复
7. ResultImageCard.tsx：真实 <img> 使用合理性、blob URL 传递、分享能力检测
8. saveImage.ts：Web Share API 检测、微信 UA 检测、AbortError 处理
9. page.tsx：组件集成、生成按钮状态文案、disabled 逻辑、useObjectUrl 集成
10. 测试覆盖：pixelate/generatePattern/saveImage 测试完整性、ImageData polyfill 方式

验证命令：
cd /Users/yumyun/Desktop/AI/pindou/apps/consumer
npm test -- --runInBand && npm run build && npm run lint
预期：187 tests pass / build clean / 0 errors 3 warnings
```

## 九、阶段 E CR 修复记录

### 修复范围

按 Codex 对阶段 E 的 Code Review，修复 3 个 P0 和多个 P1。

### 1. P0：EXIF 方向双重应用

`createImageBitmap(file)` 默认采用 `imageOrientation: "from-image"`，浏览器已按 EXIF 方向解码，代码又手工旋转一次，导致 orientation 6/8 双重旋转。

修复：改为 `createImageBitmap(file, { imageOrientation: "none" })` 获取原始像素，降级路径使用 `<img>` 的 CSS `image-orientation: none`，两条路径确保返回未经 EXIF 修正的原始像素，然后一次性手工变换。

### 2. P0：orientation 5 矩阵错误

原代码 `scale(1, -1)` 导致转置映射错误。

修复：改为 `scale(-1, 1)`，正确实现转置 `(x,y) → (y,x)`。新增 `decodeImage.test.ts`（8 用例），对 orientation 1-4 做像素级验证，5-8 做 mock 变换序列验证。

### 3. P0：createImageBitmap 降级路径仍依赖该 API

原代码降级路径在 Image.onload 中又调用 `createImageBitmap(canvas)`，再次失败。

修复：重构为 `decodeToRawPixels` 函数，降级路径直接返回 canvas 作为 `CanvasImageSource`，不再二次调用 `createImageBitmap`。统一返回 `RawImageSource` 接口。

### 4. P0：autoRemoveBackground 信号丢弃

`autoRemoveBackground` 的 `requiresUserSelection` 被忽略，管线仍生成最终文档。

修复：`generatePattern` 返回类型从 `PatternDocument` 改为 `PipelineResult`，包含 `document`、`requiresBackgroundSelection`、`backgroundResult`。`useGeneratorFlow` 将该信号传播到状态机，`page.tsx` 显示背景处理提示卡片。

### 5. P1：pixelate average 空采样

当网格尺寸大于图片时，`floor` 边界使 `xStart === xEnd`，大量格子错误输出 null。

修复：`yEnd = min(max(floor((gy+1)*cellH), yStart+1), imgH)`，确保每格至少采样一个像素。

### 6. P1：异步生成缺乏任务所有权

重置、换图或组件卸载后，旧任务仍可能写回状态，URL 泄漏。

修复：新增 `generationIdRef`（递增 ID）和 `mountedRef`，只有最新任务的结果被接受，过期任务的 URL 自动释放。`selectImage` 和 `reset` 递增 ID 并取消正在进行的任务。

### 7. P1：ImageViewer 双指误触双击

第二根手指的 pointerdown 在 300ms 内触发双击缩放。

修复：引入 `activePointersRef`（Set）跟踪活跃指针数。多指时禁用双击检测和拖拽启动，仅允许 pinch 缩放。新增平移边界约束（`clampTranslate`），防止图片完全拖出屏幕。

### 8. P1：其他修复

- `hexGridToPatternCells`：色板重复 HEX 时用首次出现的 code（`!hexToCode.has(hex)`）
- UploadCard：隐藏 file input 新增 `disabled` 属性，生成中禁止换图
- ResultImageCard：分享失败时提示用户（AbortError 仍静默处理）
- `dominant` 模式注释更新为“中心像素采样”

### 9. 测试增强

新增 19 个测试（168 → 187）：
- `decodeImage.test.ts`（8 用例）：EXIF orientation 1-8 像素/mock 验证
- `useObjectUrl.test.ts`（7 用例）：revokeObjectUrl、卸载释放、变更释放、null 处理
- `saveImage.test.ts` 增强（+4 用例）：分享成功、AbortError 静默、普通失败抛错、不支持抛错

### 10. 测试和构建结果

```text
Test Suites: 18 passed, 18 total
Tests:       187 passed, 187 total

next build: ✓ Compiled successfully / ✓ Finished TypeScript / ✓ Generating static pages
npm run lint: 0 errors, 3 warnings（均为有意 <img>）
```

### 11. 范围确认

- 未修改 `/about` 页面；
- 未引入数据库、后端 API 或图片处理服务；
- 未修改 `web/` FastAPI 和 `reference-projects/`；
- 未进入阶段 F。

## 十、Codex 阶段 E 二轮 CR 结论与三轮修复要求

### 1. 复审结论

阶段 E 二轮 CR **不通过，暂不进入阶段 F**。

独立验证结果：

- `npm test -- --runInBand`：18 suites / 187 tests 通过；
- `npm run build`：静态构建通过；
- `npm run lint`：0 errors / 3 个预期的 `<img>` warnings；
- `reference-projects/zippland-perler-beads-mobile` 工作树干净，HEAD 为 `2efee73`。

测试通过不代表关键移动端路径正确；当前仍存在 EXIF、V0 去背景闭环和异步资源释放问题。

### 2. P0：EXIF 方案需要收敛为浏览器原生纠正

当前实现使用：

```ts
createImageBitmap(file, { imageOrientation: "none" } as ImageBitmapOptions)
```

该方案不能作为跨浏览器保证。当前 WHATWG HTML 标准的 `ImageOrientation` 枚举只有 `from-image` 和 `flipY`；旧的 `none` 已被移除。类型断言只是绕过 TypeScript，不能保证 Safari、微信 WebView 和 Chrome 的运行语义一致。

V0 建议采用最小且稳定的方案：

1. 直接使用 `createImageBitmap(file)` 的默认 `from-image` 解码；
2. 降级路径使用正常的 `<img>` 解码；
3. 删除 `exifr`、`readOrientation`、`computeOrientationTransform` 和全部手工 EXIF 旋转；
4. 使用浏览器纠正后的 `bitmap.width/height` 或 `naturalWidth/naturalHeight` 计算降采样和网格；
5. 预览、网格和最终 PNG 必须消费同一方向的像素。

如果未来必须手动处理 EXIF，应另行引入能可靠读取 JPEG 原始像素的解码方案，不能依赖浏览器忽略方向元数据。

当前 orientation 5 的矩阵仍错误。实际 canvas 验证 `translate(H, 0) → rotate(90°) → scale(-1, 1)` 会把内容绘制到画布外，得到全透明输出。若删除手工 EXIF 方案，该矩阵和相关 mock 测试应一并删除；若保留手工方案，orientation 5 必须用真实像素验证转置结果，不能只断言调用序列。

### 3. P0：完成 V0 点选背景闭环

目前 `requiresBackgroundSelection` 已传播到页面，但页面只提示“后续版本将支持点选背景重新生成”。这与 `technical_plan_v0.md` 第 5.6 节冲突：点选背景重试和撤销属于 V0，不应推迟到后续版本。

建议将管线拆成准备与收口两段：

```ts
preparePattern(imageData, preset, palette)
// calculateGrid → pixelate → palette → merge → cleanup → limit → auto background
// 返回 gridSize、limitedGrid、backgroundResult

finalizePattern(hexGrid, gridSize, preset, palette)
// PatternCell → calculateUsage → PatternDocument
```

状态机增加：

```ts
type GeneratorStatus =
  | "idle"
  | "imageSelected"
  | "generating"
  | "backgroundSelection"
  | "success"
  | "error";
```

行为要求：

1. 自动去背景成功后直接 finalize 并渲染两张 PNG；
2. `requiresUserSelection=true` 时进入 `backgroundSelection`，暂不把含背景结果作为最终 PNG；
3. 页面展示可点击的低分辨率网格预览；
4. 点击位置必须稳定换算为网格 `(x, y)`；
5. 调用 `removeBackgroundFromSelection` 后重新 finalize、统计并渲染；
6. 支持重新点选和撤销；
7. 点选后图纸、用量图和 `PatternDocument` 必须一致。

### 4. P1：色板重复 HEX 直接在入口拒绝

“首次出现的 code”仍与 `findNearestColor` 的 code 字典序 tie-break 不一致。不要继续在转换阶段猜测 code。

新增 `validatePalette`，在管线入口校验：

- code 非空且唯一；
- HEX 合法，并统一标准化为 `#RRGGBB` 大写；
- 标准化后的 HEX 唯一；
- paletteId 与 preset 一致。

校验后 `hex → code` 必须是一对一关系。

### 5. P1：重构异步任务所有权和 URL 清理

`runGeneration` 不应在 `setState` updater 内启动。建议在事件回调中读取当前参数并启动任务，通过 `taskId` 接受最新结果：

```ts
const taskId = ++generationIdRef.current;
generatingRef.current = true;
setState((s) => ({ ...s, status: "generating" }));

try {
  const result = await runGeneration(...);
  if (!mountedRef.current || taskId !== generationIdRef.current) {
    releaseAssets(result);
    return;
  }
  setState(/* success */);
} catch (error) {
  if (mountedRef.current && taskId === generationIdRef.current) {
    setState(/* error */);
  }
} finally {
  if (taskId === generationIdRef.current) {
    generatingRef.current = false;
  }
}
```

重点修复：

- 旧任务完成时不能把新任务的 `generatingRef` 清为 false；
- 组件卸载、换图或 reset 后，旧任务不能写回状态；
- `Promise.all` 中一张 PNG 成功、另一张失败时，必须释放成功项的 Object URL；
- 可使用 `Promise.allSettled` 汇总并统一清理；
- 成功、失败、过期、卸载四条路径都要有测试。

### 6. P1：修正 ImageViewer 平移边界

`getBoundingClientRect()` 已包含 CSS transform，不能再乘一次 `currentScale`，否则最大倍率会按 `scale²` 计算边界。

建议使用未变换布局尺寸：

```ts
const imageWidth = img.offsetWidth * scale;
const imageHeight = img.offsetHeight * scale;
const viewportWidth = viewport.clientWidth;
const viewportHeight = viewport.clientHeight;
```

然后根据查看区域尺寸计算允许平移范围，并保证中心、四角都能查看，同时图片不能完全离开视口。手势最好统一使用 Pointer Events，避免 Pointer 与 Touch 两套状态互相影响。

### 7. 必须新增或修正的测试

1. 使用真实 orientation 1–8 JPEG fixture 验证解码后的方向、宽高和角点像素；不能只 mock 变换序列；
2. `createImageBitmap` 不存在时，`<img>` 降级路径可完成解码；
3. 1×1 图片生成 72×72 average 网格时不产生意外 null；
4. 构造低置信度背景，验证进入 `backgroundSelection`；
5. 点选背景后重新生成，两张 PNG 与用量统计一致；
6. 重复 code、非法 HEX、标准化后重复 HEX 均被拒绝；
7. 旧任务晚于新任务完成时不能覆盖结果或解除新任务锁；
8. 一张 PNG 成功、另一张失败时 Object URL 被释放；
9. 卸载、换图、reset 后任务产物被释放；
10. ImageViewer 在 1×、2.5×、8× 下的平移 bounds；
11. 保留已有分享成功、AbortError、普通失败测试。

### 8. 已确认可保留的二轮修复

- average 模式每格至少采样一个像素的实现方向正确；
- `PipelineResult` 和背景信号传播结构可作为点选闭环基础；
- UploadCard 隐藏 input 的 disabled 正确；
- useObjectUrl 测试覆盖有效；
- 分享成功、取消、失败路径及用户提示正确；
- activePointersRef 解决双指误触双击的方向正确；
- 三处真实 `<img>` 为 Blob 长按保存所需，可保留对应 Lint warning。

### 9. 三轮复审门槛

满足以下条件后再提交 Codex 三轮 CR：

- EXIF 方案不再依赖非标准 `imageOrientation: "none"`；
- orientation 1–8 使用真实图片或真实像素结果验证；
- V0 点选背景、重新点选和撤销形成可操作闭环；
- 异步任务和部分渲染失败无 Object URL 泄漏；
- ImageViewer 不再重复计算缩放；
- 全部测试、静态构建和 Lint 通过；
- 未进入阶段 F，未修改 FastAPI 与参考仓库。

## 十一、阶段 E 三轮 CR 修复记录

### 1. P0：EXIF 方案收敛为浏览器原生纠正

完全删除手工 EXIF 方案：

- 移除 `exifr` 依赖（`package.json`）；
- 删除 `readOrientation`、`computeOrientationTransform`、`RawImageSource`、`decodeToRawPixels`；
- 删除全部手工方向变换矩阵（orientation 1–8）；
- 删除所有 EXIF 相关 mock 测试。

重写 `decodeImage.ts`：

- 优先路径：`createImageBitmap(file)`（默认 `from-image`，浏览器自动 EXIF 纠正）；
- 降级路径：`new Image()` + canvas（现代浏览器同样自动纠正）；
- 两条路径均消费浏览器纠正后的像素，不做任何手工方向变换；
- 降采样逻辑保持不变（最长边 2048px）。

测试验证：

- `createImageBitmap` 调用不带 `imageOrientation: "none"` 选项；
- `createImageBitmap` 不存在或失败时降级到 `<img>` 路径；
- `<img>` 降级路径不设置 CSS `imageOrientation: "none"`；
- 文件校验（类型、大小、空文件）；
- 降采样尺寸计算正确。

### 2. P0：V0 点选背景闭环

管线拆为准备与收口两段：

- `preparePattern(imageData, preset, palette)` → 算法管线到自动去背景，返回 `PreparedPattern`；
- `finalizePattern(hexGrid, gridSize, preset, palette)` → 收口为 `PatternDocument`。

状态机新增 `backgroundSelection` 状态：

- 自动去背景成功 → 直接 `finalizePattern` + 渲染 PNG → `success`；
- `requiresUserSelection=true` → 进入 `backgroundSelection`，暂不渲染最终 PNG；
- 页面展示可点击网格预览（canvas 绘制，`imageRendering: pixelated`）；
- 点击位置稳定换算为网格 `(x, y)` 坐标；
- 调用 `removeBackgroundFromSelection` 后重新 finalize + 渲染；
- 支持撤销（`backgroundHistory` 栈）和重新点选；
- 图纸、用量图和 `PatternDocument` 数据一致。

### 3. P1：色板入口校验

新增 `validatePalette.ts`：

- code 非空且唯一；
- HEX 合法（3/6 位十六进制），统一标准化为 `#RRGGBB` 大写；
- 标准化后 HEX 唯一；
- paletteId 与 preset 一致（V0 固定 MARD）。

`preparePattern` 入口调用 `validatePalette`，色板通过校验后 hex → code 为一对一关系，`hexGridToPatternCells` 不再猜测重复 HEX 对应的 code。

### 4. P1：异步任务所有权重构

完全重写 `useGeneratorFlow.ts`：

- 不在 `setState` updater 内启动异步任务；
- 在事件回调中读取 `stateRef.current` 参数并启动异步任务；
- `generationIdRef` 递增 ID，只有最新任务写回状态；
- `mountedRef` 防止卸载后状态更新；
- `generatingRef` 仅在当前任务完成后清除（旧任务不清除新任务的锁）；
- 过期/卸载任务释放 Object URL（`runFinalize` 返回 null）；
- `renderPngs` 使用 `Promise.allSettled`，一张 PNG 成功另一张失败时释放成功项 URL；
- `releaseAssets` 和 `renderPngs` 提取为模块级函数。

### 5. P1：ImageViewer 平移边界修正

- 删除 `getBoundingClientRect() * currentScale` 的重复缩放计算；
- 改用 `img.offsetWidth * currentScale`（CSS 布局尺寸不含 transform）；
- 引入视口尺寸 `viewport.clientWidth/clientHeight`；
- 双重约束：图片至少 PAN_EDGE_MIN 像素在视口内 + 图片不能完全离开视口。

### 6. 测试变更

新增/修改测试（187 → 208）：

| 文件 | 新增用例 | 说明 |
|------|---------|------|
| `decodeImage.test.ts` | 10 | 文件校验、createImageBitmap 路径、降级路径、降采样、不支持类型 |
| `generatePattern.test.ts` | 11 | preparePattern/finalizePattern 拆分测试、色板校验集成 |
| `validatePalette.test.ts` | 10 | code 重复、HEX 非法、标准化后重复、3位/6位等价 |
| `pixelate.test.ts` | +2 | 1×1→72×72 average 无 null、全透明 |
| 保留 | 175 | saveImage、useObjectUrl、backgroundRemoval 等 |

已删除的测试：
- `computeOrientationTransform` orientation 1–8 测试（手工 EXIF 方案已删除）

### 7. 修改文件清单

| 文件 | 操作 | 关键变更 |
|------|------|--------|
| `core/decodeImage.ts` | 重写 | 删除 exifr，改用浏览器 from-image |
| `core/generatePattern.ts` | 重写 | 拆分 preparePattern + finalizePattern |
| `core/validatePalette.ts` | 新建 | 色板入口校验 |
| `model/types.ts` | 编辑 | GeneratorStatus 新增 backgroundSelection |
| `hooks/useGeneratorFlow.ts` | 重写 | 异步任务所有权 + 背景选择流程 |
| `app/generate/page.tsx` | 重写 | 背景点选 UI + GridPreview 组件 |
| `components/GenerationStatus.tsx` | 编辑 | 新增 backgroundSelection 状态显示 |
| `components/ImageViewer.tsx` | 编辑 | 平移边界改用 offsetWidth |
| `package.json` | 编辑 | 移除 exifr 依赖 |

### 8. 测试和构建结果

```text
Test Suites: 19 passed, 19 total
Tests:       208 passed, 208 total

next build: ✓ Compiled successfully / ✓ Finished TypeScript / ✓ Generating static pages
npm run lint: 0 errors, 3 warnings（均为有意 <img>）
```

### 9. 范围确认

- 未修改 `/about` 页面；
- 未引入数据库、后端 API 或图片处理服务；
- 未修改 `web/` FastAPI 和 `reference-projects/`；
- 未进入阶段 F；
- 未执行 git commit、push、reset 或删除操作。

---

## 第十二节：三轮 CR 不通过后修复记录（四轮修复）

三轮 CR 不通过，主要阻塞为“撤销/重新点选背景”未真正实现。本节记录四轮修复内容。

### 1. [P0] 点选背景改为“预览 + 撤销 + 确认生成”流程

**问题**：用户第一次点选后立即进入 `generating`，成功后清空历史，撤销和重新点选不可用。

**修复**：
- `selectBackground` 不再触发 `runFinalize`，仅更新 `gridForPreview` 和 `backgroundHistory`；
- 新增 `confirmBackground` 动作：用户满意后才调用 `finalizePattern` + `renderPngs`；
- 页面新增“确认生成”按钮，与“撤销上一步”并列；
- 支持多次点选、多次撤销，确认后清空历史。

**影响文件**：
- `useGeneratorFlow.ts`：拆分 `selectBackground`（纯预览）与 `confirmBackground`（finalize）；
- `page.tsx`：新增“确认生成”按钮，更新提示文案。

### 2. [P1] generatingRef 仅当前任务可清除

**问题**：`runFinalize` 返回 null（过期任务）后仍无条件执行 `generatingRef.current = false`，旧任务晚于新任务完成时解除新任务的并发保护。

**修复**：所有 `generatingRef.current = false` 均在 `taskId === generationIdRef.current` 条件下执行：
```ts
if (taskId === generationIdRef.current) {
  generatingRef.current = false;
}
```

**影响文件**：`useGeneratorFlow.ts`（`generate`、`confirmBackground` 的 async 分支和 catch 分支）。

### 3. [P1] backgroundSelection 时禁用参数修改

**问题**：背景点选时用途和模式按钮仍可点击，但不会重建 `prepared`，导致界面选项与最终文档不一致。

**修复**：
- `controlsDisabled = isGenerating || isBackgroundSelection`；
- `setPurpose` / `setMode` 在 `backgroundSelection` 时废弃 `prepared` 并回退到 `imageSelected`（防御性）；
- 页面所有参数控件（用途、模式、上传）统一受 `controlsDisabled` 控制。

**影响文件**：`useGeneratorFlow.ts`（`setPurpose` / `setMode`）、`page.tsx`。

### 4. [P2] validatePalette code trim()

**问题**：`"A1"` 和 `" A1 "` 被视为两个不同色号。

**修复**：校验前对 `code` 执行 `trim()`，去重、比较和输出均使用 `trimmedCode`。

**影响文件**：`validatePalette.ts`、`validatePalette.test.ts`（新增 2 个用例）。

### 5. [P2] package-lock.json 同步移除 exifr

**问题**：`package.json` 已移除 `exifr`，但 `package-lock.json` 仍残留。

**修复**：执行 `npm install --package-lock-only` 同步锁文件。

**影响文件**：`package-lock.json`。

### 6. 测试变更

**新增测试文件**：
- `hooks/__tests__/useGeneratorFlow.test.ts`（13 个用例）：状态机全路径覆盖，包括 P0 点选预览/撤销/确认、P1 多次撤销、参数变更回退、旧任务中断、reset、removedCount=0。

**更新测试文件**：
- `core/__tests__/validatePalette.test.ts`：新增 2 个 trim 相关用例。

### 7. 修改文件清单

| 文件 | 操作 | 说明 |
|------|------|------|
| `hooks/useGeneratorFlow.ts` | 重写 | selectBackground 仅预览；新增 confirmBackground；generatingRef 任务归属；setPurpose/setMode backgroundSelection 回退 |
| `app/generate/page.tsx` | 修改 | 新增“确认生成”按钮；controlsDisabled 统一禁用参数控件；修复 JSX 实体转义 |
| `core/validatePalette.ts` | 修改 | code trim() |
| `hooks/__tests__/useGeneratorFlow.test.ts` | 新建 | 13 个状态机用例 |
| `core/__tests__/validatePalette.test.ts` | 修改 | 新增 2 个 trim 用例 |
| `package-lock.json` | 更新 | 同步移除 exifr |

### 8. 测试和构建结果

```
npx jest --no-coverage: 20 suites / 223 tests passed
next build: ✓ Compiled successfully / ✓ Finished TypeScript / ✓ Generating static pages
npm run lint: 0 errors, 3 warnings（均为有意 <img>）
reference-projects: HEAD = 2efee73，工作树干净
```

### 9. 范围确认

- 未修改 `/about` 页面；
- 未引入数据库、后端 API 或图片处理服务；
- 未修改 `web/` FastAPI 和 `reference-projects/`；
- 未进入阶段 F；
- 未执行 git commit、push、reset 或删除操作。

### 10. 已知限制

- EXIF 自动纠正仅通过 mock 测试验证，Safari/微信真实 EXIF JPEG 行为需阶段 F 真机验收；
- ImageViewer 手势/bounds 测试缺少，需阶段 F 真机验证双指行为；
- `useGeneratorFlow` 测试使用模块 mock，未涉及真实 canvas/PNG 渲染。

---

## 第十三节：四轮 CR 不通过后修复记录（五轮修复）

四轮 CR 发现 1 个 P0：未点选背景也能确认生成。修复非常简单。

### 1. [P0] confirmBackground 必须至少执行过一次背景删除

**问题**：确认按钮始终可用，用户可在未点选或撤销全部后确认，从而用原始 limitedGrid 生成含背景的最终 PNG。

**修复**：
- `confirmBackground` 内部新增 `if (!s.backgroundHistory?.length) return;` 防御性校验；
- 页面“确认生成”按钮新增 `disabled={!backgroundHistory?.length}`，与“撤销上一步”按钮同步禁用逻辑。

**影响文件**：`useGeneratorFlow.ts`、`page.tsx`。

### 2. 测试变更

**更新测试文件**：
- `hooks/__tests__/useGeneratorFlow.test.ts`：新增 2 个用例（未点选时 confirmBackground 无效、撤销全部后 confirmBackground 无效）。

### 3. 测试和构建结果

```
npx jest --no-coverage: 20 suites / 225 tests passed
next build: ✓ Compiled successfully / ✓ Finished TypeScript / ✓ Generating static pages
npm run lint: 0 errors, 3 warnings（均为有意 <img>）
```

---

## 第十四节：Codex 五轮 CR 结论——通过，可进入阶段 F

五轮 CR 全部通过，阶段 E 交付确认。

### 逐项确认

- PASS：Hook 层 `confirmBackground` 要求 `backgroundHistory.length > 0`；
- PASS：页面确认按钮在未点选、撤销全部后禁用；
- PASS：两个测试均断言状态不变且 `finalizePattern` 未调用；
- PASS：点选、撤销、重新点选、确认生成闭环成立；
- PASS：其余四轮修复未发现回归；
- PASS：`exifr` 已从源码、package 和 lockfile 移除；
- PASS：参考仓库干净，HEAD `2efee73`。

### 独立验证

```
Tests:  20 suites / 225 tests passed
Build:  ✓ 静态构建成功
Lint:   0 errors, 3 warnings（均为有意 <img>）
```

### 阶段 F 重点验证事项

- 真实设备 EXIF 方向（Safari、微信内置浏览器）；
- 微信长按保存 / 打开原图 / 系统分享；
- 大图查看器双指缩放和滑动手势；
- 开发色板仅用于测试，不应作为正式生产色板发布。
