# 拼豆小纸条 V0 — 阶段 C 去背景纯算法 Code Review 交接文档

> 作者：Qoder（阶段 C 开发者）
> 日期：2026-07-02
> 对应计划：`docs/handoff.md` 第 8 节「阶段 C：V0 去背景」
> 当前状态：阶段 C 已完成，未进入阶段 D–F，未执行 git commit / push / reset / 删除操作。

## 一、本轮实现范围

按 `docs/handoff.md` 与 `docs/technical_plan_v0.md` 5.6 节要求，仅完成「阶段 C：V0 去背景纯算法」中不涉及 UI、PNG 渲染、文件上传、EXIF 解码、Canvas 或浏览器的部分：

- 修正阶段 B P2：`validateRectangularGrid` 第一行类型校验、零宽网格规则、错误信息一致性。
- 实现背景候选检测 `detectBackgroundCandidate`：仅分析四边，忽略 null，使用阶段 B 的 0–100 Oklab 标尺，稳定聚类与 tie-break。
- 实现边缘连通删除 `removeEdgeConnectedBackground`：从边界四方向 flood fill，只删阈值内连通背景。
- 实现用户点选重试 `removeBackgroundFromSelection`：用点中颜色作为候选色，仍从边界开始删除。
- 实现自动编排 `autoRemoveBackground`：高置信度自动删，低置信度返回副本并要求用户点选。
- 为上述函数编写单元测试，覆盖 `docs/test_plan_v0.md` TC-BG-001～008 及边界情况。

**明确不做（阶段 D–F）：**

- 真实文件上传、EXIF 解码、Canvas/ImageData 读取、透明通道提取。
- 图纸 PNG / 豆子用量 PNG 渲染、保存、分享、大图缩放。
- 完整生产 MARD 色板接入、数据库、图片后端。
- 修改 `/generate` 页面功能。

## 二、新增和修改文件

```text
apps/consumer/
├── src/features/generator/core/
│   ├── validateRectangularGrid.ts                 # 修改：第一行类型校验、零宽网格规则
│   ├── backgroundRemovalConfig.ts                 # 新增：去背景默认参数集中配置
│   ├── backgroundRemoval.ts                       # 新增：检测/删除/点选/自动编排函数
│   └── __tests__/
│       ├── validateRectangularGrid.test.ts        # 修改：补充第一行非法类型、零宽网格用例
│       └── backgroundRemoval.test.ts              # 新增：阶段 C 单元测试
docs/
└── review-handoff-phase-c.md                      # 新增：本交接文档
```

## 三、中间网格格式

阶段 C 沿用阶段 B 定义的 `HexGrid`：

```ts
type HexGrid = Array<Array<string | null>>;
```

约定：

- 输入已经完成色板映射、相似色合并、小区域清理和颜色数限制；
- HEX 应为标准 `#RRGGBB`；
- `null` 表示已有透明/背景格；
- 输出仍为 `HexGrid`；
- 删除的背景写为 `null`；
- 所有函数不修改输入网格，返回新网格副本。

## 四、检测与删除接口

```ts
interface BackgroundDetection {
  candidateHex: string | null;
  borderCoverage: number;
  representativeTouchedSides: number; // 代表色实际触达的边数
  touchedCorners: number;             // 代表色实际触达的角数
  confident: boolean;
  reason: string;
}

interface BackgroundRemovalResult {
  grid: HexGrid;
  removedCount: number;
  requiresUserSelection: boolean;
  detection?: BackgroundDetection;
  autoRemovalSafe?: boolean;
  removalRatio?: number;
}

detectBackgroundCandidate(grid: HexGrid, options?): BackgroundDetection
removeEdgeConnectedBackground(grid: HexGrid, backgroundHex: string, options?): BackgroundRemovalResult
removeBackgroundFromSelection(grid: HexGrid, x: number, y: number, options?): BackgroundRemovalResult
autoRemoveBackground(grid: HexGrid, options?): BackgroundRemovalResult
```

接口职责：

- `detectBackgroundCandidate`：只分析、不删除，返回候选色、覆盖率、代表色边/角证据与置信度。
- `removeEdgeConnectedBackground`：给定背景色，执行边缘连通 flood fill 删除。
- `removeBackgroundFromSelection`：用户点选坐标，校验后用该格颜色调用边缘连通删除；零删除时要求重选。
- `autoRemoveBackground`：先检测，高置信度且通过 dry-run 安全检查时删除；否则返回原网格副本并要求点选。

## 五、默认阈值及其单位

配置集中在 `apps/consumer/src/features/generator/core/backgroundRemovalConfig.ts`：

```ts
export const DEFAULT_BACKGROUND_REMOVAL_CONFIG = {
  backgroundDistanceThreshold: 8,  // Oklab 距离，0–100 标尺
  minBorderCoverage: 0.55,         // 候选聚类至少覆盖 55% 边缘非 null 格
  minTouchedSides: 4,              // 候选代表色至少触达 4 条边
  minTouchedCorners: 3,            // 候选代表色至少触达 3 个角
  maxAutoRemovalRatio: 0.75,       // 自动删除比例不能超过 75%
};
```

这些值为 V0 首轮校准基线，后续需用五类样图验收后调整，不是永久定稿。
设计原则：宁可 false negative（要求用户点选），也不允许 false positive（自动删除主体）。

## 六、置信度与自动删除安全规则

1. 收集四条边界上所有非 null 单元格；
2. 用 `backgroundDistanceThreshold` 对边界颜色做稳定聚类；
3. 对每个聚类计算：
   - `candidateHex`：聚类内出现次数最多的 HEX（次数相同按 HEX 字典序）；
   - `borderCoverage`：聚类内边界格数 / 总边界非 null 格数；
   - `representativeTouchedSides`：仅按代表色本身统计的触达边数；
   - `touchedCorners`：仅按代表色本身统计的触达角数；
4. 按 `borderCoverage` 降序、`representativeTouchedSides` 降序、`touchedCorners` 降序、`candidateHex` 字典序升序选出最佳候选；
5. `confident = borderCoverage >= minBorderCoverage && representativeTouchedSides >= minTouchedSides && touchedCorners >= minTouchedCorners`。

`autoRemoveBackground` 在候选高置信度后仍执行 dry-run：

- 计算 `removalRatio = removedCount / totalNonNull`；
- 仅当 `removedCount > 0 && removedCount < totalNonNull && removalRatio <= maxAutoRemovalRatio` 时才真正删除；
- 否则返回原网格副本，`requiresUserSelection = true`，`autoRemovalSafe = false`，并在 `detection.reason` 中说明拦截原因。

## 七、Flood Fill 边界

- 四方向连接（上、下、左、右），不使用对角线；
- 从所有边界上匹配背景色的格子开始 BFS；
- 只扩展与候选背景色 Oklab 距离在 `backgroundDistanceThreshold` 内的非 null 格；
- 主体内部与背景同色但不连通的区域不会入队，因此保留；
- 使用队列实现，避免递归调用栈溢出；
- 已有 null 格保持 null，不计入删除。

## 八、Tie-Break 规则

| 场景 | 规则 |
|---|---|
| 聚类代表色选择 | 出现次数最多；次数相同选 HEX 字典序更小 |
| 多个候选竞争最佳背景 | 覆盖率更高优先；覆盖率相同触边更多优先；再相同选 HEX 字典序更小 |
| 聚类内颜色归入最近代表 | 距离更小优先；距离相同选代表 HEX 字典序更小 |

## 九、TC-BG-001～008 对应情况

| 编号 | 测试场景 | 对应实现/测试 |
|---|---|---|
| TC-BG-001 | 已有 null 保持 null，不映射为白色 | `backgroundRemoval.test.ts` TC-BG-001 |
| TC-BG-002 | 纯色/近纯色背景触达四边，自动删除 | `backgroundRemoval.test.ts` TC-BG-002 |
| TC-BG-003 | 主体内部同色孤岛保留 | `backgroundRemoval.test.ts` TC-BG-003 |
| TC-BG-004 | 主体触达边缘导致低置信度，不静默删除 | `backgroundRemoval.test.ts` TC-BG-004 |
| TC-BG-005 | 四边复杂颜色，返回低置信度 | `backgroundRemoval.test.ts` TC-BG-005 |
| TC-BG-006 | 用户点选背景重试，支持撤销/重选 | `backgroundRemoval.test.ts` TC-BG-006 |
| TC-BG-007 | 删除前后豆数统计正确 | `backgroundRemoval.test.ts` TC-BG-007（验证 `totalBeads === 64`） |
| TC-BG-008 | 复杂宠物照片人工验收 | 本阶段无真实图片解码，已在交接文档与测试中说明延期 |

## 十、测试、构建、Lint 结果

在 `/Users/yumyun/Desktop/AI/pindou/apps/consumer` 依次执行：

```bash
npm test -- --runInBand
npm run build
npm run lint
```

结果：

```text
Test Suites: 10 passed, 10 total
Tests:       109 passed, 109 total

next build: ✓ Compiled successfully / ✓ Finished TypeScript / ✓ Generating static pages
npm run lint: 无错误、无警告
```

## 十一、已知限制

1. TC-BG-008（复杂宠物照片人工验收）需要真实图片解码与人工视觉判断，本阶段仅实现纯网格算法，尚未接入图片输入，已标记为延期。
2. 自动检测依赖边缘颜色统计，对主体与背景同色且主体大面积触边的照片可能无法区分，此时按设计返回低置信度，提示用户点选。
3. 默认阈值 `backgroundDistanceThreshold=8` / `minBorderCoverage=0.55` / `minTouchedSides=4` / `minTouchedCorners=3` / `maxAutoRemovalRatio=0.75` 为首轮校准基线，需后续用样图校准。
4. `validateHexGridValues` 仅校验 HEX 格式（必须带 `#`，接受 `#RRGGBB` / `#RGB`），不负责规范化网格。生产流水线进入去背景前应统一使用大写 `#RRGGBB`，避免 `#fff` 与 `#FFF` 等语义等价颜色被当作不同键。
5. 未处理 PNG 透明通道提取（阶段 E 由真实解码阶段负责），但算法已保证输入中的 null 格不会被重新映射为白色。

## 十二、确认未修改 UI、FastAPI 和参考仓库

- 未修改 `apps/consumer/src/app/generate/page.tsx` 及任何页面/组件。
- 未修改 `web/` 下 FastAPI 代码。
- 未修改 `reference-projects/zippland-perler-beads-mobile/`。
- 未从参考仓库 import 任何代码或数据。

## 十三、确认未进入阶段 D–F

- 未实现图纸 PNG / 用量 PNG 渲染。
- 未实现保存、长按、分享、大图缩放。
- 未实现真实文件上传、EXIF 解码、Canvas 读取。

## 十四、确认未引入数据库或后端

- 未引入数据库、API 服务、图片后端或持久化存储。
- 仅在前端工程 `apps/consumer` 内新增纯函数与测试。

## 十五、确认未复制 Zippland 代码或数据

- 未复制 `reference-projects/zippland-perler-beads-mobile` 的源码、结构、测试或色板。
- 色板仍使用阶段 B 的 `TEST_PALETTE` 测试 fixture。

## 十六、阶段 C CR 修复记录

### 修复范围

按 Codex 对阶段 C 的 Code Review，集中修复 P0/P1 问题，未进入阶段 D–F。

### 1. 新的自动置信度规则

`BackgroundDetection.confident` 现在同时依赖三条独立规则：

- `borderCoverage >= minBorderCoverage`（默认 0.55）；
- `representativeTouchedSides >= minTouchedSides`（默认 4）；
- `touchedCorners >= minTouchedCorners`（默认 3）。

只有候选**代表色**同时满足以上三条，才视为高置信度。三条边或低角点覆盖的候选不再自动删除。

### 2. 代表色边数与角点计算方式

- 新增 `Corner` 类型（`tl` / `tr` / `bl` / `br`）；
- `collectBorderCells` 同时记录每个边界格的 `sides` 和 `corners`；
- 聚类仍按 `backgroundDistanceThreshold` 合并近色，但：
  - `borderCoverage` 按整个聚类统计；
  - `representativeTouchedSides` 与 `touchedCorners` 仅按代表色本身统计；
- 防止背景与近色主体合并后共同凑够置信度。

### 3. dry-run 安全规则

`autoRemoveBackground` 在应用删除前先执行 dry-run：

- 计算 `removalRatio = removedCount / totalNonNull`；
- 仅当 `removedCount > 0 && removedCount < totalNonNull && removalRatio <= maxAutoRemovalRatio` 时才真正删除；
- 否则返回原网格副本：`removedCount = 0`、`requiresUserSelection = true`、`autoRemovalSafe = false`，并在 `detection.reason` 中追加具体拦截原因。

### 4. maxAutoRemovalRatio

新增默认配置：

```ts
maxAutoRemovalRatio: 0.75
```

自动删除比例超过 75% 时禁止自动应用，转由用户点选确认。

### 5. 三边主体反例测试

新增测试：5×5 网格中红色主体占据下方 4×5，触达左/右/下三边，覆盖约 68.75%。由于默认要求 4 条边，检测为低置信度，`autoRemoveBackground` 返回 `requiresUserSelection=true`，原网格不变。

### 6. 近色触边主体测试

重写 TC-BG-004：使用 `WHITE` 与 `OFF_WHITE`（真实 Oklab 距离小于阈值 8）构造主体与背景近似且主体触边的场景。虽然检测可能高置信度，但 dry-run 删除比例接近 100%，被 `maxAutoRemovalRatio` 拦截，不会静默删除主体。

### 7. 全单色网格测试

新增测试：5×5 全白网格。检测高置信度，但 dry-run 会删除全部 25 格，触发“删除会清空整个网格”安全规则，`requiresUserSelection=true`，原网格不变。

### 8. 点选零删除处理

修复 `removeBackgroundFromSelection`：

- `removedCount === 0` 时返回 `requiresUserSelection=true`；
- 空网格（`[]`）调用时抛出明确错误“空网格无法选择背景”；
- 点中 null 仍要求重选；
- 新增“点选内部主体色但边缘没有该色”的测试。

### 9. HEX 校验规则

新增 `validateHexGridValues` 共享校验：

- 对所有非 null 单元格调用 `normalizeHex`；
- 非法 HEX 在公开接口入口立即抛出明确错误（含坐标）；
- `detectBackgroundCandidate`、`removeEdgeConnectedBackground`、`removeBackgroundFromSelection`、`autoRemoveBackground` 均接入；
- `backgroundHex` 参数也调用 `normalizeHex` 校验；
- 接受 `#RRGGBB` 与简写 `#RGB`，拒绝 alpha 通道（如 `#RRGGBBAA`）。

### 10. 测试、构建、Lint 结果

修复后执行：

```bash
npm test -- --runInBand
npm run build
npm run lint
```

结果：

```text
Test Suites: 10 passed, 10 total
Tests:       109 passed, 109 total

next build: ✓ Compiled successfully / ✓ Finished TypeScript / ✓ Generating static pages
npm run lint: 无错误、无警告
```

### 11. 确认未进入阶段 D–F

- 未实现图纸 PNG / 用量 PNG 渲染。
- 未实现保存、长按、分享、大图缩放。
- 未实现真实文件上传、EXIF 解码、Canvas 读取。

### 12. 确认未修改 UI、FastAPI、参考仓库

- 未修改 `apps/consumer/src/app/generate/page.tsx` 及任何页面/组件。
- 未修改 `web/` 下 FastAPI 代码。
- 未修改 `reference-projects/zippland-perler-beads-mobile/`。

### 13. 确认未引入数据库或后端

- 未引入数据库、API 服务、图片后端或持久化存储。
- 仅在前端工程 `apps/consumer` 内新增/修改纯函数与测试。
