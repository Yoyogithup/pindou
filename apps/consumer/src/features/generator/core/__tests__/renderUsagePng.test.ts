/** @jest-environment node */

import { loadImage } from "canvas";
import {
  computeUsageLayout,
  renderUsagePng,
  sortUsage,
  USAGE_PNG_HEIGHT,
  USAGE_PNG_WIDTH,
} from "../renderUsagePng";
import { renderPatternPng } from "../renderPatternPng";
import type { ColorUsage, PatternCell, PatternDocument } from "@/features/generator/model/types";

const WHITE = "#FFFFFF";
const RED = "#FF0000";
const GREEN = "#00FF00";
const BLUE = "#0000FF";

function makeDocument(
  width: number,
  height: number,
  usage: ColorUsage[]
): PatternDocument {
  const totalBeads = usage.reduce((sum, u) => sum + u.count, 0);
  if (totalBeads > width * height) {
    throw new Error(
      `测试数据错误: ${width}×${height} 网格容量 ${width * height} 小于总豆数 ${totalBeads}`
    );
  }

  const cells: PatternCell[][] = Array.from({ length: height }, () =>
    Array.from({ length: width }, () => ({ hex: null, code: null }))
  );

  let index = 0;
  for (const item of usage) {
    for (let c = 0; c < item.count; c++) {
      const y = Math.floor(index / width);
      const x = index % width;
      cells[y][x] = { hex: item.hex, code: item.code };
      index++;
    }
  }

  return {
    version: 1,
    width,
    height,
    cells,
    paletteId: "MARD",
    usage,
    totalBeads,
    preset: {
      purpose: "keychain",
      mode: "standard",
      maxGridEdge: Math.max(width, height),
      samplingMode: "dominant",
      similarityThreshold: 24,
      minRegionSize: 4,
      maxColors: Math.max(usage.length, 16),
      paletteId: "MARD",
      sectionInterval: 5,
      backgroundStrategy: "remove-edge-connected",
    },
  };
}

async function blobToImage(blob: Blob) {
  const arrayBuffer = await blob.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  return loadImage(buffer);
}

describe("renderUsagePng", () => {
  it("TC-USAGEPNG-001：可以独立生成合法 PNG", async () => {
    const document = makeDocument(10, 10, [
      { hex: RED, code: "A1", count: 50 },
      { hex: WHITE, code: "A2", count: 30 },
      { hex: BLUE, code: "A10", count: 20 },
    ]);

    const asset = await renderUsagePng(document);

    expect(asset.width).toBe(USAGE_PNG_WIDTH);
    expect(asset.height).toBe(USAGE_PNG_HEIGHT);
    expect(asset.filename).toBe("pindou-beads-10x10.png");
    expect(asset.blob.type).toBe("image/png");
    expect(asset.dataUrl).toMatch(/^data:image\/png;base64,/);

    const image = await blobToImage(asset.blob);
    expect(image.width).toBe(USAGE_PNG_WIDTH);
    expect(image.height).toBe(USAGE_PNG_HEIGHT);
  });

  it("TC-USAGEPNG-002：输出固定 1080×1350 规格与文件名", async () => {
    const document = makeDocument(58, 44, [{ hex: RED, code: "A1", count: 100 }]);
    const asset = await renderUsagePng(document);

    expect(asset.filename).toBe("pindou-beads-58x44.png");
    expect(asset.width).toBe(USAGE_PNG_WIDTH);
    expect(asset.height).toBe(USAGE_PNG_HEIGHT);
  });

  it("TC-USAGEPNG-003：1、14、15、28 色无裁切重叠，最后一行底部不进入页脚", async () => {
    for (const count of [1, 14, 15, 28]) {
      const usage: ColorUsage[] = [];
      for (let i = 0; i < count; i++) {
        usage.push({
          hex: i % 2 === 0 ? RED : GREEN,
          code: `A${i + 1}`,
          count: 1,
        });
      }
      const layout = computeUsageLayout(usage);

      // 画布尺寸正确
      expect(layout.width).toBe(USAGE_PNG_WIDTH);
      expect(layout.height).toBe(USAGE_PNG_HEIGHT);
      // 所有项都在画布内，不进入页脚区域
      for (const item of layout.items) {
        expect(item.y).toBeGreaterThanOrEqual(0);
        expect(item.x).toBeGreaterThanOrEqual(0);
        const itemBottom = item.y + item.swatchSize;
        expect(itemBottom).toBeLessThan(layout.contentBottom);
      }

      // 完整渲染也成功：使用足够容纳所有颜色格的网格
      const document = makeDocument(10, 10, usage);
      const asset = await renderUsagePng(document);
      expect(asset.width).toBe(USAGE_PNG_WIDTH);
      expect(asset.height).toBe(USAGE_PNG_HEIGHT);
    }
  });

  it("TC-USAGEPNG-004：内容完整且不含 Zippland 品牌", async () => {
    const document = makeDocument(10, 10, [
      { hex: RED, code: "A1", count: 50 },
      { hex: GREEN, code: "A2", count: 30 },
      { hex: BLUE, code: "A3", count: 20 },
    ]);

    const asset = await renderUsagePng(document);
    expect(asset.filename).not.toContain("zippland");
    expect(asset.filename).toMatch(/^pindou-beads-/);
  });

  it("TC-USAGEPNG-006：同一 PatternDocument 下两张图数据一致", async () => {
    const usage: ColorUsage[] = [
      { hex: RED, code: "A2", count: 10 },
      { hex: GREEN, code: "A10", count: 5 },
      { hex: BLUE, code: "A1", count: 5 },
    ];
    const document = makeDocument(5, 5, usage);

    const patternAsset = await renderPatternPng(document);
    const usageAsset = await renderUsagePng(document);

    // 文件名包含同一网格尺寸
    expect(patternAsset.filename).toBe("pindou-pattern-5x5.png");
    expect(usageAsset.filename).toBe("pindou-beads-5x5.png");

    // 两者均读取同一 PatternDocument 的 totalBeads
    expect(document.totalBeads).toBe(20);
    expect(usage.reduce((s, u) => s + u.count, 0)).toBe(document.totalBeads);

    // 合法 PNG
    const patternImage = await blobToImage(patternAsset.blob);
    const usageImage = await blobToImage(usageAsset.blob);
    expect(patternImage.width).toBe(patternAsset.width);
    expect(patternImage.height).toBe(patternAsset.height);
    expect(usageImage.width).toBe(USAGE_PNG_WIDTH);
    expect(usageImage.height).toBe(USAGE_PNG_HEIGHT);
  });

  it("布局按色号自然排序：A1, A2, A10", () => {
    const usage: ColorUsage[] = [
      { hex: RED, code: "A10", count: 1 },
      { hex: GREEN, code: "A2", count: 1 },
      { hex: BLUE, code: "A1", count: 1 },
    ];
    const sorted = sortUsage(usage);
    expect(sorted.map((u) => u.code)).toEqual(["A1", "A2", "A10"]);

    const layout = computeUsageLayout(usage);
    expect(layout.items.map((i) => i.code)).toEqual(["A1", "A2", "A10"]);
  });

  it("28 色双列布局：每列 14 项，两列不重叠", () => {
    const usage: ColorUsage[] = [];
    for (let i = 0; i < 28; i++) {
      usage.push({ hex: RED, code: `A${i + 1}`, count: 1 });
    }
    const layout = computeUsageLayout(usage);

    // 14 行 2 列
    expect(layout.items.length).toBe(28);

    // 第 1 列（0–13）
    const col1 = layout.items.slice(0, 14);
    const col2 = layout.items.slice(14, 28);

    // 第 1 列 x 都相同
    const col1X = new Set(col1.map((i) => i.x));
    expect(col1X.size).toBe(1);
    // 第 2 列 x 都相同，且大于第 1 列
    const col2X = new Set(col2.map((i) => i.x));
    expect(col2X.size).toBe(1);
    expect(col2[0].x).toBeGreaterThan(col1[0].x);

    // 每列 y 严格递增
    for (let i = 1; i < col1.length; i++) {
      expect(col1[i].y).toBeGreaterThan(col1[i - 1].y);
    }
    for (let i = 1; i < col2.length; i++) {
      expect(col2[i].y).toBeGreaterThan(col2[i - 1].y);
    }

    // 所有项底部 < contentBottom
    for (const item of layout.items) {
      expect(item.y + item.swatchSize).toBeLessThan(layout.contentBottom);
    }
  });

  it("空用量仍可生成 PNG", async () => {
    const document = makeDocument(10, 10, []);
    const asset = await renderUsagePng(document);
    expect(asset.width).toBe(USAGE_PNG_WIDTH);
    expect(asset.height).toBe(USAGE_PNG_HEIGHT);
  });

  it("非法文档抛出明确错误", async () => {
    const bad = makeDocument(5, 5, [{ hex: RED, code: "A1", count: 10 }]);
    bad.totalBeads = 999; // 与 cells 不一致
    await expect(renderUsagePng(bad)).rejects.toThrow("非法 PatternDocument");
  });

  it("computeUsageLayout 非法宽度抛错", () => {
    expect(() => computeUsageLayout([{ hex: RED, code: "A1", count: 1 }], { width: 0 })).toThrow(
      "非法布局宽度"
    );
    expect(() => computeUsageLayout([{ hex: RED, code: "A1", count: 1 }], { width: -1 })).toThrow(
      "非法布局宽度"
    );
  });

  it("computeUsageLayout 非法高度抛错", () => {
    expect(() => computeUsageLayout([{ hex: RED, code: "A1", count: 1 }], { height: 0 })).toThrow(
      "非法布局高度"
    );
  });

  it("computeUsageLayout 极小高度抛错", () => {
    expect(() =>
      computeUsageLayout([{ hex: RED, code: "A1", count: 1 }], { height: 100 })
    ).toThrow("过小");
  });
});
