# 拼豆小纸条 — 消费者 H5

本项目是拼豆小纸条 V0 的消费者前端，采用 Next.js + TypeScript + Tailwind CSS 构建，面向手机浏览器（优先 390×844）。

## 开发

```bash
npm install
npm run dev
```

访问 http://localhost:3000/generate。

## 构建

```bash
npm run build
```

静态产物输出到 `dist/` 目录。

## 测试

```bash
npm test
```

## 项目边界

- 图片仅在浏览器本地处理，不上传服务器。
- V0 不依赖数据库或业务后端。
- 核心算法采用洁净重写，未复制 Zippland 源码、注释、测试、文件结构或色板 JSON。
- 当前没有可直接用于生产的完整 MARD 色号—HEX 数据，仅建立接口。

详见根目录 `docs/handoff.md`、`docs/technical_plan_v0.md`。
