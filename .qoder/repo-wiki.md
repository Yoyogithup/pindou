# 拼豆图纸 MVP V0 - Repo Wiki

## 项目概述

这是一个用于验证“用户发图 → 内部处理 → 输出可制作拼豆图纸包”的轻量仓库。当前阶段不是完整小程序或商业化平台，而是低成本、半自动的内部生产链路，用于 MVP 调研验证。

核心目标：让每个案例都有清晰的输入、处理记录、候选版本、交付包和用户反馈。

## 项目定位

- **阶段**：MVP V0
- **模式**：半自动内部生产链路
- **核心用户场景**：用户发送喜欢的图片（宠物照、角色图、应援图、游戏头像等），希望获得一份可实际制作的拼豆图纸包
- **当前策略**：参考项目内部部署 + 自定义预处理脚本 + 自定义 preset 规则 + 自定义交付包模板 + 人工少量校验

## 标准工作流

```text
用户提交图片和需求
  -> 记录用户需求（data/submissions.csv）
  -> 图片预处理（scripts/preprocess_image.py）
  -> 生成 2-3 个候选图纸任务（scripts/generate_candidates.py）
  -> 人工快速选择/微调（参考项目网页端）
  -> 导出图纸包（scripts/package_delivery.py）
  -> 交付给用户
  -> 记录用户反馈（data/feedback.csv）
```

## 目录结构

```text
.qoder/
  repo-wiki.md          # 本文件，项目知识库
.venv/                # Python 虚拟环境（本地使用）
web/                  # FastAPI Web 界面
docs/
  handoff.md            # 项目技术交接
  next_steps.md         # 下一步自动化建议
  production_sop.md     # 内部生产 SOP
  reference_repo_analysis.md  # 参考项目能力分析
  color_database_design.md    # 色号库设计
data/
  colors.json           # 基础颜色信息
  brand_color_codes.json # 品牌色号映射
  palette_sets.json     # 色板组合配置
  presets.json          # 候选版本 preset 配置
  submissions.csv       # 用户提交记录
  feedback.csv          # 用户反馈记录
inputs/
  {submission_id}/
    original.jpg        # 用户原始图片
processed/
  {submission_id}/
    processed.png       # 预处理后标准图片
outputs/
  {submission_id}/
    candidate_beginner_metadata.json   # 新手挂件版任务
    candidate_standard_metadata.json   # 标准冰箱贴版任务
    candidate_detail_metadata.json     # 细节还原版任务
    candidate_manifest.json            # 候选文件清单
    metadata.json                      # 交付包元数据
    color_list.csv                     # 色号清单
    delivery_card.png                  # 交付卡
scripts/
  preprocess_image.py   # 图片预处理
  generate_candidates.py # 生成候选任务
  package_delivery.py   # 生成交付包
  summarize_cases.py    # 汇总案例
```

## 环境要求

- Python ≥ 3.8
- Pillow ≥ 12.2.0
- FastAPI、Uvicorn、Jinja2、python-multipart、aiofiles（Web 界面所需）

安装依赖：

```bash
python3 -m venv .venv
source .venv/bin/activate
python3 -m pip install -r requirements.txt
```

注意：在 macOS 等 externally-managed 环境中，建议使用虚拟环境安装依赖。

## 核心脚本使用说明

### 1. 预处理图片

```bash
python3 scripts/preprocess_image.py \
  --input inputs/S0001/original.jpg \
  --output processed/S0001/processed.png
```

默认参数：
- `--size`: 1024（输出正方形边长）
- `--brightness`: 1.04（亮度提升）
- `--contrast`: 1.08（对比度提升）

处理逻辑：
- 读取原图并修正 EXIF 方向
- 转换为 RGB 或 RGBA
- 中心裁剪为正方形
- 缩放为指定尺寸
- 轻度提升亮度和对比度
- 输出 PNG

### 2. 生成候选任务

```bash
python3 scripts/generate_candidates.py \
  --submission-id S0001 \
  --image processed/S0001/processed.png \
  --brand MARD
```

会基于 `data/presets.json` 生成三个候选版本的任务元数据文件：

| 候选版本 | slug | 尺寸 | 目标颜色数 | 难度 | 预计耗时 |
|---------|------|------|-----------|------|---------|
| 新手挂件版 | beginner | 29×29 | 8-12 | easy | 1-2小时 |
| 标准冰箱贴版 | standard | 58×58 | 12-18 | medium | 3-5小时 |
| 细节还原版 | detail | 72×72 | 18-28 | hard | 5小时以上 |

生成的文件：
- `outputs/{submission_id}/candidate_{slug}_metadata.json`
- `outputs/{submission_id}/candidate_manifest.json`

### 3. 生成交付包

```bash
python3 scripts/package_delivery.py \
  --submission-id S0001 \
  --selected-candidate standard \
  --theme pet \
  --target-object fridge_magnet
```

`--selected-candidate` 可选：`beginner`、`standard`、`detail`

交付包输出：
- `00_original.jpg`：原图备份（若存在）
- `01_processed.png`：预处理后图片（若存在）
- `02/03_preview_{candidate}.png`：拼豆效果预览图（若已导出）
- `final_pattern.png`：正式网格图纸（若已导出）
- `color_list.csv`：色号清单
- `delivery_card.png`：交付卡
- `metadata.json`：交付包元数据

### 4. 汇总案例

```bash
python3 scripts/summarize_cases.py
```

扫描 `outputs/*/metadata.json`，输出 CSV 摘要。

## Web 界面

项目新增了基于 FastAPI 的内部操作员面板，用于替代命令行操作。

### 目录结构

```text
web/
  main.py              # FastAPI 入口
  templates_config.py  # Jinja2 模板配置
  services.py          # CSV/JSON 数据读写服务
  routers/             # 路由模块
    submissions.py
    preprocess.py
    candidates.py
    delivery.py
    review.py
  templates/           # HTML 模板
    base.html
    index.html
    submission.html
    review.html
  static/              # CSS/JS
    style.css
    app.js
```

### 启动方式

```bash
source .venv/bin/activate
python3 -m uvicorn web.main:app --host 127.0.0.1 --port 8000 --reload
```

浏览器打开 `http://127.0.0.1:8000/submissions/`。

### 功能

- **案例列表页** (`/submissions/`)：查看所有案例、状态标签、新增提交。
- **案例详情页** (`/submissions/{id}`)：
  - 查看原图和预处理图
  - 调整预处理参数并运行预处理
  - 生成三个候选版本任务
  - 查看候选版本信息，选择版本生成交付包
  - 下载交付包文件
  - 复制客户确认链接
- **客户确认页** (`/review/{id}`)：
  - 展示三个候选版本
  - 客户选择最喜欢的版本并提交反馈
  - 反馈自动写入 `data/feedback.csv`

### 注意

- Web 界面只是现有 Python 脚本的交互层，未改变 V0 生产流程。
- 核心图纸生成仍依赖参考项目 `perler-beads` 网页端导出预览图和色号清单。
- V0 阶段建议本地或局域网使用。

## 数据 Schema

### colors.json

```json
{
  "color_id": "C0001",
  "hex": "#FFFFFF",
  "rgb": {"r": 255, "g": 255, "b": 255},
  "color_name_cn": "白色",
  "color_name_en": "white",
  "is_active": true
}
```

### brand_color_codes.json

```json
{
  "color_id": "C0001",
  "brand": "MARD",
  "brand_code": "T01",
  "brand_color_name": "白色",
  "is_available": true
}
```

### palette_sets.json

```json
{
  "palette_set_id": "MARD_BASIC_12",
  "brand": "MARD",
  "name": "MARD 基础 12 色",
  "color_ids": ["C0001", "C0002"]
}
```

### presets.json

```json
{
  "preset_key": "standard_fridge_magnet",
  "slug": "standard",
  "display_name": "标准冰箱贴版",
  "grid_width": 58,
  "grid_height": 58,
  "pixelation_mode": "dominant",
  "target_color_count": "12-18",
  "remove_background": true,
  "style": "balanced",
  "difficulty": "medium",
  "estimated_time": "3-5小时",
  "best_for": ["宠物冰箱贴", "情侣头像", "二次元印象小物", "追星应援牌"]
}
```

### submissions.csv

字段：
- `submission_id`
- `user_nickname`
- `source_channel`
- `theme`
- `image_path`
- `target_object`
- `style_preference`
- `difficulty_preference`
- `color_preference`
- `preferred_brand`
- `allow_public_case`
- `notes`

### feedback.csv

字段：
- `submission_id`
- `user_satisfaction`
- `looks_like_original`
- `will_make_it`
- `main_problem`
- `requested_revision`
- `willing_to_pay`
- `public_case_permission`
- `notes`

## 参考项目

- 项目地址：https://github.com/Zippland/perler-beads
- 协议：AGPL-3.0
- 本地启动：

```bash
git clone https://github.com/Zippland/perler-beads.git
cd perler-beads
npm install
npm run dev
```

浏览器打开 `http://localhost:3000`。

### 使用边界

本仓库当前只保留流程、schema 和自研辅助脚本，不直接复制参考项目代码。若后续基于参考项目做衍生开发，需要重新评估协议、版权声明和开源义务。

## 当前限制与待完善

### 当前依赖人工的环节

- 参考项目网页端上传与导出
- 候选版本视觉判断
- 少量颜色替换或背景清理
- 用户反馈判断与记录

### 当前色号库状态

- 仅包含 12 色占位种子数据
- 商业使用前需替换为真实品牌数据
- 当前只支持 MARD 品牌映射

### 已知占位项

- `color_list.csv` 在参考工具导出前为占位文件
- `metadata.json` 中的 `color_count` 在导出前为“待从最终图纸补充”
- `candidate_*_metadata.json` 中的 `review` 字段需人工填写

## 下一步自动化建议

### 第一阶段

- 跑通参考项目
- 用 2-3 张图片验证上传、生成、导出
- 记录参考项目能力与限制
- 完善色号库来源说明
- 用 5 张样例跑完整流程

### 第二阶段

- 接入自动背景移除
- 增加主体裁剪
- 自动生成颜色统计图
- 自动从导出图纸读取豆子数量
- 自动检查候选版本是否颜色过碎

### 第三阶段

- 图片质量评分
- 自动推荐尺寸
- 自动推荐难度
- 自动推荐是否适合小挂件
- 批量处理多个 submission

## 耗时目标

单单目标控制在 **3-6 分钟**：

- 预处理：1 分钟
- 生成候选：1 分钟
- 人工校验：1-3 分钟
- 交付：1 分钟

## 最小验收标准

- 能本地运行参考工具
- 能处理 5 张测试图
- 每张图能生成至少 2 个候选版本
- 每张图能输出完整交付包
- 每张图有 metadata
- 每张图有颜色清单和总豆数
- 单张图人工处理时间记录完整
- 整体流程有 SOP
- 色号库有初步结构
- 明确记录当前无法自动化的步骤

## 常见问题

### Q: 为什么核心图纸生成依赖外部参考项目？
A: V0 阶段优先验证流程和交付标准，不自研像素化/色号映射算法。参考项目已提供成熟的图纸生成能力。

### Q: 可以商用当前色号库吗？
A: 不可以。`palette_sets.json` 已明确标注为 V0 placeholder seed palette，商业使用前必须替换为经过验证的品牌数据。

### Q: 如何新增一个 preset？
A: 编辑 `data/presets.json`，新增一个包含 `preset_key`、`slug`、`grid_width`、`grid_height` 等字段的对象，然后重新运行 `generate_candidates.py`。

### Q: 如何支持新品牌？
A: 在 `data/brand_color_codes.json` 中添加品牌色号映射，在 `data/palette_sets.json` 中添加色板组合。
