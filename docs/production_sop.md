# 内部生产 SOP

## 1. 收图与编号

每个案例使用一个提交编号：

```text
S0001
S0002
S0003
```

原图放置：

```text
inputs/S0001/original.jpg
```

用户需求记录在：

```text
data/submissions.csv
```

## 2. 预处理

运行：

```bash
python3 scripts/preprocess_image.py \
  --input inputs/S0001/original.jpg \
  --output processed/S0001/processed.png
```

预处理动作：

- 转为 RGB/RGBA 标准格式
- 中心裁剪成正方形
- 轻度提升亮度和对比度
- 输出 PNG

## 3. 生成候选任务

运行：

```bash
python3 scripts/generate_candidates.py \
  --submission-id S0001 \
  --image processed/S0001/processed.png \
  --brand MARD
```

脚本会生成三类候选版本的任务文件：

- 新手挂件版
- 标准冰箱贴版
- 细节还原版

如果暂时无法命令行调用参考工具，操作者按任务文件去参考项目网页端手动上传、调参和导出。

## 4. 人工校验

只判断四件事：

- 像不像
- 好不好看
- 是否能拼
- 是否符合用户用途

轻量调整范围：

- 删除明显脏背景
- 替换明显不合适的颜色
- 合并少量过碎色块
- 选择更合适尺寸
- 必要时重新裁剪主体

如果单张图需要超过 10 分钟修图，标记为“不适合当前自动流程”。

## 5. 生成交付包

运行：

```bash
python3 scripts/package_delivery.py \
  --submission-id S0001 \
  --selected-candidate standard
```

输出目录：

```text
outputs/S0001/
```

必需交付物：

- 原图备份
- 预处理后图片
- 拼豆效果预览图
- 正式网格图纸
- 色号清单
- 每种颜色豆子数量
- 总豆数
- 尺寸信息
- 难度建议
- 交付说明

## 6. 反馈记录

交付后将反馈写入：

```text
data/feedback.csv
```

重点统计：

- 发图率
- 交付完成率
- 修改率
- 强需求率
- 付费接受率
- 平均人工耗时

## 7. 耗时目标

单单目标：

```text
预处理 1 分钟
生成候选 1 分钟
人工校验 1-3 分钟
交付 1 分钟
总计 3-6 分钟
```
