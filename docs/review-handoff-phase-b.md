# 拼豆小纸条 V0 — 阶段 B Preset 与纯算法 Code Review 交接文档

> 作者：Qoder（阶段 B 开发者）
> 日期：2026-07-02
> 对应计划：`docs/handoff.md` 第 8 节「阶段 B：Preset 和纯算法」
> 当前状态：阶段 B 已完成，未进入阶段 C–F，未执行 git commit / push / reset / 删除操作。

## 一、本轮实现范围

按 `docs/handoff.md` 要求，仅完成「阶段 B：Preset 和纯算法」中不涉及 UI、图片解码、Canvas、EXIF、去背景、PNG 渲染的部分：

- 实现 `calculateGrid`：保持原图比例，最长边固定为 `maxGridEdge`，另一边四舍五入，极端比例短边至少 1 格。
- 建立小型、人工定义的 `TEST_PALETTE` 测试 fixture 色板。
- 洁净实现颜色基础能力：HEX 校验/标准化、RGB→Oklab、Oklab 距离、最近色匹配、HEX 网格→色板网格映射。
- 实现相似色合并 `mergeSimilarColors`、小区域清理 `cleanupSmallRegions`、颜色硬上限 `limitColorCount`。
- 实现用量统计 `calculateUsage`，保证 `totalBeads === sum(usage.count)`。
- 为上述函数编写单元测试，覆盖阶段 B 相关 TC 编号。

**明确不做（阶段 C–F）：**

- 真实图片上传、Canvas 解码、EXIF 方向修正、自动去背景。
- 图纸 PNG / 豆子用量 PNG 渲染、保存、分享、大图缩放。
- 完整生产 MARD 色板接入、数据库、图片后端。
- 修改 `/generate` 页面功能。

## 二、新增和修改文件

```text
apps/consumer/
├── jest.config.ts                              # 增加 @tests/* moduleNameMapper
├── src/features/generator/model/types.ts       # 增加 HexGrid 类型
├── src/features/generator/core/
│   ├── calculateGrid.ts
│   ├── calculateUsage.ts
│   ├── color.ts
│   ├── mergeSimilarColors.ts
│   ├── cleanupSmallRegions.ts
│   ├── limitColorCount.ts
│   ├── testHelpers.ts
│   └── __tests__/
│       ├── calculateGrid.test.ts
│       ├── calculateUsage.test.ts
│       ├── color.test.ts
│       ├── mergeSimilarColors.test.ts
│       ├── cleanupSmallRegions.test.ts
│       └── limitColorCount.test.ts
└── tests/fixtures/testPalette.ts
```

## 三、算法输入、输出与边界

### 3.1 calculateGrid

- **输入**：`sourceWidth: number`, `sourceHeight: number`, `maxGridEdge: number`
- **输出**：`{ width: number; height: number }`
- **边界**：
  - 输入必须为正有限数，否则抛出明确错误。
  - 横图 `width = maxGridEdge`，竖图 `height = maxGridEdge`。
  - 另一边 `Math.round(maxGridEdge × 比例)`，结果 clamp 到 `[1, maxGridEdge]`。

### 3.2 color（HEX / Oklab / 最近色）

- **输入**：HEX 字符串、色板条目数组（含 `code` 与 `hex`）
- **输出**：标准化 HEX、`Oklab` 坐标、距离值、最近色号、PatternCell 网格
- **边界**：
  - `normalizeHex` 接受 `#RRGGBB` 与 `#RGB` 简写，统一输出大写 `#RRGGBB`。
  - 拒绝非法字符、alpha 通道、非 HEX 格式。
  - 空色板调用 `findNearestColor` 时抛出错误。

### 3.3 mergeSimilarColors

- **输入**：`HexGrid`, `threshold: number`（非负 Oklab 距离阈值）
- **输出**：新的 `HexGrid`
- **边界**：
  - null 格保持 null。
  - 按颜色出现次数降序处理，将颜色合并到出现次数更多且距离小于阈值的保留色。
  - 非法阈值抛出错误。

### 3.4 cleanupSmallRegions

- **输入**：`HexGrid`, `minRegionSize: number`（正整数）
- **输出**：新的 `HexGrid`
- **边界**：
  - null 格保持 null，不参与连通区域。
  - 四方向连通（上下左右）。
  - 面积小于 `minRegionSize` 的区域替换为四邻域中出现次数最多的非 null 颜色。
  - 非法 `minRegionSize` 抛出错误。

### 3.5 limitColorCount

- **输入**：`HexGrid`, `maxColors: number`（正整数）
- **输出**：新的 `HexGrid`
- **边界**：
  - null 格保持 null。
  - 颜色数未超上限时原样返回副本。
  - 超限时反复移除用量最少的颜色，并入 Oklab 距离最近的保留色。
  - 非法 `maxColors` 抛出错误。

### 3.6 calculateUsage

- **输入**：`PatternCell[][]`
- **输出**：`{ usage: ColorUsage[], totalBeads: number }`
- **边界**：
  - null 格不计数。
  - `totalBeads` 等于非 null 单元格数，也等于 `sum(usage.count)`。
  - 按色号自然排序（如 `A2` 排在 `A10` 之前）。
  - 不生成或推测颜色名称。

## 四、tie-break 规则

所有颜色相关操作在距离或用量相等时采用稳定、可重复的 tie-break：

| 场景 | tie-break 规则 |
|---|---|
| 最近色匹配距离相等 | 返回 `code` 字典序更小的色板条目 |
| mergeSimilarColors 多保留色距离相等 | 选择 HEX 字典序更小的保留色 |
| cleanupSmallRegions 邻域颜色次数相等 | 选择 HEX 字典序更小的邻域颜色 |
| limitColorCount 用量最少颜色相等 | 选择 HEX 字典序更小的颜色作为 victim |
| limitColorCount 最近保留色距离相等 | 选择 HEX 字典序更小的保留色 |
| calculateUsage 排序 | 按色号自然排序；完全相同时保持插入顺序稳定 |

## 五、测试专用色板声明

文件：`apps/consumer/tests/fixtures/testPalette.ts`

- 明确标记 `TEST_ONLY`，仅用于单元测试。
- 12 个人工定义颜色，覆盖白、黑、红、绿、蓝、黄、品红、青、灰及暗红/暗绿/暗蓝。
- 不冒充完整 MARD 色板。
- 未复制 `reference-projects/zippland-perler-beads-mobile/colorSystemMapping.json`。
- 未加入未经确认的生产色号数据。

## 六、测试用例与 TC 编号对应关系

| 测试文件 | 测试用例 | 对应 TC |
|---|---|---|
| `calculateGrid.test.ts` | 正方形等宽高 | TC-GRID-001 |
| `calculateGrid.test.ts` | 4:3 横图 | TC-GRID-002 |
| `calculateGrid.test.ts` | 3:4 竖图 | TC-GRID-003 |
| `calculateGrid.test.ts` | 极端比例短边 ≥ 1 | TC-GRID-004 |
| `color.test.ts` | 固定输入始终映射到同一色号 | TC-COLOR-002 |
| `limitColorCount.test.ts` | 颜色硬上限 ≤ maxColors | TC-COLOR-004 |
| `limitColorCount.test.ts` | 九种 preset 上限逐个验证 | TC-COLOR-004 |
| `limitColorCount.test.ts` | 最少用量优先合并，总豆数不变 | TC-COLOR-005 |
| `cleanupSmallRegions.test.ts` | 新手/标准清理单格杂色，细节保留 1 格 | TC-COLOR-006 |
| `calculateUsage.test.ts` | 基础计数 A=3、B=2、total=5 | TC-USAGE-001 |
| `calculateUsage.test.ts` | 统计不变量 | TC-USAGE-002 |
| `calculateUsage.test.ts` | 稳定自然排序 | TC-USAGE-003 |
| `calculateUsage.test.ts` | 不生成/推测颜色名称 | TC-USAGE-004 |

**延期说明：**

- TC-COLOR-003（模式差异：新手颜色数 ≤ 标准 ≤ 细节）依赖完整生成流水线与真实图片采样，本阶段暂缓，将在阶段 C/D 后补测。
- TC-GRID-005/006（EXIF、异常输入）依赖图片解码阶段，按用户要求留给后续阶段。
- TC-BG-001 至 TC-BG-008 属于去背景，明确不在阶段 B 范围。
- TC-USAGEPNG-001 属于 PNG 渲染，不在阶段 B 范围。

## 七、测试、构建、Lint 实际结果

在 `apps/consumer/` 下依次执行：

```bash
npm test -- --runInBand
npm run build
npm run lint
```

结果：

- **测试**：8 suites / 54 tests 全部通过
- **构建**：静态产物输出到 `apps/consumer/dist/`，无 TypeScript 错误
- **Lint**：通过（在 build 之后执行，dist 已被忽略）

## 八、未完成或延期的测试及原因

| TC 编号 | 说明 | 延期原因 |
|---|---|---|
| TC-COLOR-003 | 模式差异导致最终颜色数递增 | 缺少完整生成流水线与图片采样，本阶段仅实现纯函数 |
| TC-GRID-005 | EXIF 方向 | 需要图片解码/Canvas，不在阶段 B |
| TC-GRID-006 | 异常输入处理 | 需要文件上传与图片解码，不在阶段 B |
| TC-BG-001 ~ TC-BG-008 | 去背景相关 | 属于阶段 C，不在阶段 B |
| TC-USAGEPNG-001 | 独立豆子用量 PNG | 属于阶段 F，不在阶段 B |

## 九、自检声明

- [x] 未修改 `apps/consumer/src/app/generate/page.tsx` 的 UI 功能。
- [x] 未修改 `web/` 现有 FastAPI 工作台。
- [x] 未修改 `reference-projects/zippland-perler-beads-mobile/` 及其任何文件。
- [x] 未从 `reference-projects/` 运行时 import。
- [x] 未引入数据库、图片上传 API 或业务后端。
- [x] 未实现真实图片上传、Canvas、EXIF、自动去背景、PNG 渲染、保存/分享。
- [x] 未执行 git commit / push / reset / 删除用户文件。

## 十、未复制 Zippland 代码或色板声明

- [x] 颜色空间转换公式依据 Björn Ottosson 公开文章《A perceptual color space for image processing》（2020）独立实现，未复制 Zippland 的公式表达、注释或代码结构。
- [x] `TEST_PALETTE` 为人工定义的小型测试色板，未复制 `colorSystemMapping.json` 中的任何色号、名称或结构。
- [x] 算法流程（合并、清理、硬上限）按 `docs/technical_plan_v0.md` 文字描述独立实现，未参考 Zippland 源码。

---

# 给 Codex 的 Review Prompt

请按以下提示词交给 Codex 进行 Code Review：

```text
请对 /Users/yumyun/Desktop/AI/pindou 仓库中阶段 B「Preset 和纯算法」进行 Code Review。

前置阅读：
1. docs/handoff.md（第 8 节「阶段 B：Preset 和纯算法」和第 12 节「CR 重点」）
2. docs/technical_plan_v0.md（第 4–5 节数据模型与参数映射）
3. docs/test_plan_v0.md（第 4–8 节 Preset、网格、颜色、用量测试）
4. docs/review-handoff-phase-b.md（本轮交付说明）

Review 范围：
- apps/consumer/src/features/generator/core/ 下所有新增算法文件与测试
- apps/consumer/tests/fixtures/testPalette.ts
- apps/consumer/src/features/generator/model/types.ts（HexGrid 新增）
- apps/consumer/jest.config.ts（@tests 别名）

请检查：
1. 是否符合阶段 B 范围，没有提前实现阶段 C–F 的 UI、图片解码、去背景或 PNG 渲染。
2. calculateGrid 是否保持比例、最长边为 maxGridEdge、极端比例短边 ≥ 1。
3. 颜色基础能力是否为洁净重写：HEX 校验、RGB→Oklab、Oklab 距离、最近色匹配、网格映射。
4. 是否记录了公开公式来源，未复制 Zippland 的代码、公式表达、注释或 colorSystemMapping.json。
5. mergeSimilarColors / cleanupSmallRegions / limitColorCount 是否保持 null 格、是否为纯函数、是否稳定 tie-break。
6. calculateUsage 是否满足 totalBeads === sum(usage.count)，是否稳定排序，是否不推测名称。
7. 测试是否覆盖 TC-GRID-001/002/003/004、TC-COLOR-002/004/005/006、TC-USAGE-001/002/003/004。
8. 测试专用色板是否明确标记 TEST_ONLY，未冒充 MARD。
9. TypeScript strict 模式是否通过，测试/构建/Lint 是否全部通过。
10. 是否未修改 UI、FastAPI 工作台、reference-projects。

请输出：
1. 总体通过/不通过结论。
2. 逐条问题清单（P0 阻塞项 / P1 建议 / P2 可选优化）。
3. 对阶段 C 起始点的建议。
4. 确认没有发现参考仓库代码被复制或修改。

注意：不要执行 git commit / push / reset / 删除操作，除非用户明确授权。
```

---

# 阶段 B CR 修复记录

> 修复日期：2026-07-02
> 修复者：Qoder
> 状态：阶段 B CR 问题已修复，未进入阶段 C–F

## 修复范围

按 Codex 上一轮 CR 结论，仅修复阶段 B 纯算法与测试问题，不实现去背景、UI、图片解码或 PNG 渲染。

## P0：统一 Oklab 距离单位为 0–100 标尺

- 文件：`apps/consumer/src/features/generator/core/color.ts`
- 修改：`oklabDistance` 返回原始欧氏距离 × 100，使结果与 preset 阈值 14/24/32 直接对齐。
- 同步更新 `mergeSimilarColors.ts`、`limitColorCount.ts` 的注释，说明阈值使用 0–100 标尺。
- 测试调整：
  - `mergeSimilarColors.test.ts` 将旧阈值 0.5/0.05 改为 50/5。
  - 新增真实阈值测试：14/24/32 下红绿蓝不会全部合并；32 下接近的红色系可合并。
  - `color.test.ts` 增加 0–100 标尺断言。
- 验证：最近色匹配结果未因统一缩放发生变化（tie-break 逻辑仅依赖距离比较）。

## P1：补齐颜色硬上限测试

- 文件：`apps/consumer/src/features/generator/core/__tests__/limitColorCount.test.ts`
- 修改：
  - 新增 `generateDistinctHexColors(29)` 工具函数生成 29 个合法且差异明显的 HEX。
  - 构造 29 色网格，确保每个被测上限（8/12/16/10/16/24/12/20/28）都被真正触发合并。
  - 验证最终颜色数 ≤ 上限、非 null 格总数不变、原网格未被修改。

## P1：网格尺寸整数校验

- 文件：`apps/consumer/src/features/generator/core/calculateGrid.ts`
- 修改：增加 `Number.isInteger(maxGridEdge)` 校验。
- 测试：`calculateGrid.test.ts` 新增 58.5 抛错、29.0 通过、输出 width/height 始终为正整数。

## P1：矩形网格校验

- 新增文件：`apps/consumer/src/features/generator/core/validateRectangularGrid.ts`
- 规则：
  - 允许真正的空网格 `[]`；
  - 矩形网格通过；
  - 锯齿网格抛出明确错误；
  - 第一行为空但后续行非空时抛错；
  - `undefined` 不被当作颜色；
  - 某行非数组时抛错。
- 接入：
  - `cleanupSmallRegions`（必须调用）；
  - `mergeSimilarColors`、`limitColorCount`、`mapHexGridToPalette`（建议统一调用）。
- 测试：`validateRectangularGrid.test.ts` 覆盖上述全部边界。

## P1：PatternCell 一致性

- 文件：`apps/consumer/src/features/generator/core/calculateUsage.ts`
- 修改：
  - 新增 `validateCells` 校验：hex 与 code 必须同时为空或同时有值；
  - 同一 code 对应多个不同 HEX 时抛出明确错误；
  - 保持 `totalBeads === sum(usage.count)` 不变量。
- 测试：`calculateUsage.test.ts` 新增三种非法格抛错测试。

## 可选 P2（已采纳部分）

- 已增加显式 tie-break 测试：
  - `findNearestColor`：距离相等时按 code 字典序；
  - `mergeSimilarColors`：count 相同时 HEX 字典序更小者成为 keeper；
  - `cleanupSmallRegions`：邻域颜色次数相同时按 HEX 字典序；
  - `limitColorCount`：用量相同时 HEX 字典序更小者先被移除。
- 未移动 `testHelpers.ts` 入测试目录：当前位于 `core/testHelpers.ts` 可避免 Jest 将其识别为测试套件；移动需额外配置 `testPathIgnorePatterns`，本次未做以避免引入无关配置变更。
- 未做性能缓存，先保证正确性。

## 验证结果

在 `apps/consumer/` 下执行：

```bash
npm test -- --runInBand
npm run build
npm run lint
```

结果：

- 测试：9 suites / 73 tests 全部通过
- 构建：静态产物输出到 `dist/`，TypeScript strict 通过
- Lint：通过（在 build 之后执行）

## 边界声明（修复后）

- [x] 未进入阶段 C–F。
- [x] 未修改 `apps/consumer/src/app/generate/page.tsx` 的 UI 功能。
- [x] 未修改 `reference-projects/zippland-perler-beads-mobile/`。
- [x] 未修改 `web/` 现有 FastAPI 工作台。
- [x] 未引入数据库、图片上传后端或业务后端。
- [x] 未实现 Canvas、EXIF、去背景、PNG 渲染、保存/分享/缩放。
- [x] 未接入生产 MARD 色板，未复制 Zippland 代码或 `colorSystemMapping.json`。
- [x] 未执行 git commit / push / reset / 删除用户文件。
