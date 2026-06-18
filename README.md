# 拼豆图纸 MVP V0

这是一个用于验证“用户发图 -> 内部处理 -> 输出可制作拼豆图纸包”的轻量仓库。

当前阶段不是完整小程序或商业化平台，而是低成本、半自动的内部生产链路。重点是让每个案例都有清晰的输入、处理记录、候选版本、交付包和用户反馈。

## 当前能力

- 标准化生产目录结构
- 用户提交与反馈记录模板
- 图片预处理脚本
- 三个图纸 preset 的候选任务生成
- 交付包 metadata、色号清单和交付卡生成
- V0 SOP 与参考项目使用边界说明

## 快速开始

安装依赖：

```bash
python3 -m pip install -r requirements.txt
```

准备输入图片：

```text
inputs/S0001/original.jpg
```

预处理图片：

```bash
python3 scripts/preprocess_image.py \
  --input inputs/S0001/original.jpg \
  --output processed/S0001/processed.png
```

生成候选版本任务：

```bash
python3 scripts/generate_candidates.py \
  --submission-id S0001 \
  --image processed/S0001/processed.png \
  --brand MARD
```

生成交付包模板：

```bash
python3 scripts/package_delivery.py \
  --submission-id S0001 \
  --selected-candidate standard
```

汇总案例：

```bash
python3 scripts/summarize_cases.py
```

## 目录结构

```text
docs/        项目交接、SOP、参考项目分析、色号库设计
data/        色号库、preset、提交记录、反馈记录
inputs/      用户原始图片
processed/   预处理后的标准图片
outputs/     候选版本与最终交付包
scripts/     内部生产脚本
```

## 参考项目

V0 推荐参考并内部部署：

```text
https://github.com/Zippland/perler-beads
```

该参考项目采用 AGPL-3.0 协议。本仓库当前只保留流程、schema 和自研辅助脚本，不直接复制参考项目代码。若后续基于参考项目做衍生开发，需要重新评估协议、版权声明和开源义务。

## V0 工作流

```text
用户提交图片和需求
-> 记录用户需求
-> 图片预处理
-> 生成 2-3 个候选图纸
-> 人工快速选择/微调
-> 导出图纸包
-> 交付给用户
-> 记录用户反馈
```

## 当前人工环节

- 参考项目网页端上传与导出
- 候选版本视觉判断
- 少量颜色替换或背景清理
- 用户反馈判断与记录

目标是把单单人工耗时控制在 3-6 分钟。
