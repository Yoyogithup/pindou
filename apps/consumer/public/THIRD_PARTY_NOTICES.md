# 第三方声明

## 拼豆小纸条 V0

本项目在开发过程中参考了以下第三方项目，以理解移动端拼豆图纸生成的用户行为、技术边界和潜在问题：

- **Zippland/perler-beads**
  - 上游地址：https://github.com/Zippland/perler-beads
  - 本地参考：`/reference-projects/zippland-perler-beads-mobile/`
  - 许可证：AGPL-3.0
  - 使用方式：只读调研，未复制其源码、注释、测试、文件结构或 `colorSystemMapping.json`。

## 进入产品的第三方依赖

当前阶段 A 工程骨架引入的 npm 依赖及其许可证，请参见 `apps/consumer/package.json` 与 `node_modules/<package>/LICENSE`。主要依赖包括：

- Next.js（MIT）
- React（MIT）
- TypeScript（Apache-2.0）
- Tailwind CSS（MIT）
- Jest（MIT）
- React Testing Library（MIT）

后续阶段补充的依赖将同步更新本文件。

## 数据声明

当前没有可直接用于生产的完整 MARD 色号—HEX 数据。`apps/consumer/src/features/generator/model/` 中只建立了色板接口，待取得独立、可追溯的来源后再填入生产数据。
