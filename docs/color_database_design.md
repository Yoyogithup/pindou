# 色号库设计

色号库是本项目最重要的数据资产之一。V0 先使用 JSON 文件，不引入数据库。

## 设计原则

- 颜色基础信息与品牌色号映射分离
- 不把色号写死在业务逻辑里
- 支持至少一个默认品牌
- 支持后续扩展多品牌
- 能通过 hex 查询品牌色号
- 能通过品牌色号反查 hex
- 保留数据来源说明

## 文件结构

```text
data/colors.json
data/brand_color_codes.json
data/palette_sets.json
```

## colors.json

```json
{
  "color_id": "C0001",
  "hex": "#FFFFFF",
  "rgb": {
    "r": 255,
    "g": 255,
    "b": 255
  },
  "color_name_cn": "白色",
  "color_name_en": "white",
  "is_active": true
}
```

## brand_color_codes.json

```json
{
  "color_id": "C0001",
  "brand": "MARD",
  "brand_code": "T01",
  "brand_color_name": "白色",
  "is_available": true
}
```

## palette_sets.json

```json
{
  "palette_set_id": "MARD_BASIC_12",
  "brand": "MARD",
  "name": "MARD 基础 12 色",
  "color_ids": ["C0001", "C0002"]
}
```

## 后续扩展

- 用户已有豆子色库
- 低成本替代色推荐
- 缺货色替换
- 品牌之间色号转换
- 基础 24 色、48 色、96 色色板
- 商家材料包配置
