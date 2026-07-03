# 拼豆项目当前状态

最后更新：2026-07-03

> 本文件是项目“当前事实”的唯一权威入口。历史过程保留在阶段 review handoff 中，但不再承担当前状态。

## 当前阶段

- 阶段 A–E 已完成，阶段 E 已通过 Codex 五轮审查。
- 阶段 F 的功能开发和测试部署已完成。
- 当前处于阶段 F 真机验收：在四类真实设备环境验证上传、EXIF、生成、保存、分享和手势行为。
- 当前消费者真机测试地址：<https://dist-xi-three-54.vercel.app/generate>。
- 当前输出仍使用开发色板；没有可追溯的生产级 MARD 色板，因此不得作为正式产品色号发布。

## 已实现

### 消费者 H5：`apps/consumer/`

- Next.js 16、React 19、TypeScript 的 mobile-first `/generate` 页面。
- 用途与模式 preset、比例网格、像素采样、色板映射、相似色合并、小区域清理和颜色硬上限。
- 自动边缘背景识别、点选背景、撤销、重新点选和确认生成。
- 统一 `PatternDocument`，图纸 PNG 与豆子用量 PNG 共享同一份统计。
- 图片上传、本地解码、生成状态机、结果卡、大图查看、缩放、平移、保存、分享和打开原图兜底。
- 图片在浏览器本地处理，不依赖 FastAPI 才能生成。

### 内部工作台：`web/` 与 `scripts/`

- FastAPI 案例工作台、图片预处理、候选任务、交付包骨架和反馈记录。
- 该链路保留，不是消费者 H5 的运行时依赖。

## 最近验证基线

阶段 E 五轮审查记录：

- Jest：20 suites / 225 tests passed。
- Next.js build：通过。
- ESLint：0 errors，3 个有意保留的 `<img>` warning。
- 第三方参考仓库保持独立且未被产品代码依赖。

本次版本基线提交前会重新运行这些检查；最新结果以 `docs/development_schedule.md` 和对应 PR 为准。

## 当前阻断与风险

1. 四类真机验收矩阵尚未完成：iPhone Safari、iPhone 微信、Android Chrome、Android 微信。
2. Safari/微信中的真实 EXIF、Blob 长按保存、打开原图、系统分享和手势仍需真机证据。
3. 生产级 MARD 色号—HEX 数据及来源记录尚未补齐，阻止正式色号版本发布。
4. 首个阶段 F 可恢复基线已推送到 `codex/establish-development-workflow`，Draft PR 为 <https://github.com/Yoyogithup/pindou/pull/1>；在 CI 和 Qoder 审查通过前不合并到 `main`。

## 下一步

1. 等待 Draft PR #1 的 GitHub CI 与 Qoder 独立审查；修复阻断项后再决定是否合并。
2. 继续按 `docs/phase-f-device-testing.md` 执行四类真机验收。
3. 真机问题使用 `pindou-device-debug` 工作流登记、修复和原设备复测。
4. 真机通过后发布阶段 F 稳定 Release。

## 权威入口

- 任务账本：`docs/development_schedule.md`
- 协作协议：`docs/agent-collaboration.md`
- 决策记录：`docs/decisions/index.md`
- 产品基线：`docs/product_plan_v0.md`
- 技术基线：`docs/technical_plan_v0.md`
- 测试基线：`docs/test_plan_v0.md`
- 真机矩阵：`docs/phase-f-device-testing.md`
- 第三方边界：`reference-projects/README.md`
