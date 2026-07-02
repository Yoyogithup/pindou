# 给 Qoder 的工作法变更交接

日期：2026-07-03

## 发生了什么

用户与 Codex 确认并开始实施新的项目开发工作法、真机 Debug 闭环和 GitHub 版本体系。阶段 A–E 的开发结论保持不变；这次调整解决的是状态漂移、Agent 交接和无法可靠回退的问题。

## Qoder 接手前必须知道

1. `docs/development_status.md` 现在是当前事实的唯一入口。
2. `docs/development_schedule.md` 现在是任务、负责人、阻断项和下一步的唯一账本。
3. `docs/decisions/` 保存已确认的长期决策。
4. `docs/agent-collaboration.md` 定义 Qoder、Codex 和用户的协作规则。
5. 阶段 review handoff 已降级为历史证据，不再从文件末尾推断当前状态。
6. 新增 `pindou-develop` 与 `pindou-device-debug` 两个技能入口。

## 当前项目结论

- 阶段 E 五轮 Code Review 已通过；阶段 F 的功能开发和测试部署也已完成。
- 当前正在进行阶段 F 四类真机验收，不是等待阶段 F 开发，也不是继续扩展新功能。
- 真机 Bug 修完后只能进入“待真机复测”，必须由用户在原设备路径确认后关闭。
- 生产色板仍缺可追溯数据，开发色板不得作为正式色号发布。

## 请 Qoder 如何工作

### 功能开发

使用 `pindou-develop`：领取 `development_schedule.md` 中的任务，确认自己是当前负责人，在独立分支完成实现和验证，再把交接包交给 Codex 审查。

### 真机修复

使用 `pindou-device-debug`：保留 `BUG-F-###` 编号和设备证据，在 `fix/BUG-F-###-*` 分支修复，补自动化回归，交给 Codex 审查，部署后等待用户原设备复测。

### Code Review

如果 Codex 是实现者，Qoder作为独立审查者，不顺手扩大范围。审查结论必须明确为“通过”“修复后复审”或“阻断”。

## 本次版本基线

- 工作分支：`codex/establish-development-workflow`
- 本地基线提交：`dd4cea0`（阶段 F 自研代码、测试、工作法、技能与 CI）。
- 目标：把当前阶段 E 自研代码、测试、文档、工作法与 CI 纳入 GitHub Draft PR。
- 排除：用户数据、`outputs/`、构建产物、第三方嵌套仓库源码和密钥。
- 当前远端发布阻断：GitHub CLI 认证已失效，需要用户重新登录后才能 push 和创建 Draft PR。
