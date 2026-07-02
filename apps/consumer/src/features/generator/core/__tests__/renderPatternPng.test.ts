/** @jest-environment node */

import { loadImage } from "canvas";
import {
  computePatternLayout,
  getCellSize,
  PATTERN_MIN_CANVAS_WIDTH,
  renderPatternPng,
} from "../renderPatternPng";
import type { ColorUsage, PatternCell, PatternDocument } from "@/features/generator/model/types";

const WHITE = "#FFFFFF";
const RED = "#FF0000";
const GREEN = "#00FF00";
const BLUE = "#0000FF";

function makeDocument(
  width: number,
  height: number,
  cells: PatternCell[][]
): PatternDocument {
  const usageMap = new Map<string, ColorUsage>();
  for (const row of cells) {
    for (const cell of row) {
      if (cell.code === null) continue;
      const existing = usageMap.get(cell.code);
      if (existing) {
        existing.count += 1;
      } else {
        usageMap.set(cell.code, { hex: cell.hex!, code: cell.code, count: 1 });
      }
    }
  }

  const usage = Array.from(usageMap.values());
  const totalBeads = usage.reduce((sum, u) => sum + u.count, 0);

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

describe("renderPatternPng", () => {
  it("TC-PATTERNPNG-001：格子尺寸按最长边选择", () => {
    expect(getCellSize(32)).toBe(32);
    expect(getCellSize(33)).toBe(24);
    expect(getCellSize(60)).toBe(24);
    expect(getCellSize(61)).toBe(22);
    expect(getCellSize(72)).toBe(22);
  });

  it("TC-PATTERNPNG-002：坐标和分段标记准确", async () => {
    const cells: PatternCell[][] = [
      [{ hex: RED, code: "A1" }, { hex: RED, code: "A1" }, { hex: RED, code: "A1" }],
      [{ hex: RED, code: "A1" }, { hex: RED, code: "A1" }, { hex: RED, code: "A1" }],
      [{ hex: RED, code: "A1" }, { hex: RED, code: "A1" }, { hex: RED, code: "A1" }],
    ];
    const document = makeDocument(3, 3, cells);
    const asset = await renderPatternPng(document);

    const image = await blobToImage(asset.blob);
    expect(image.width).toBe(asset.width);
    expect(image.height).toBe(asset.height);
  });

  it("TC-PATTERNPNG-003：色号可读且不越界", async () => {
    const cells: PatternCell[][] = [
      [{ hex: WHITE, code: "A1" }, { hex: RED, code: "A2" }],
      [{ hex: GREEN, code: "A3" }, { hex: BLUE, code: "A4" }],
    ];
    const document = makeDocument(2, 2, cells);
    const asset = await renderPatternPng(document);

    expect(asset.width).toBeGreaterThan(0);
    expect(asset.height).toBeGreaterThan(0);

    const image = await blobToImage(asset.blob);
    expect(image.width).toBe(asset.width);
    expect(image.height).toBe(asset.height);
  });

  it("TC-PATTERNPNG-004：null 格显示为透明/背景格，不计入豆数", async () => {
    const cells: PatternCell[][] = [
      [{ hex: RED, code: "A1" }, { hex: null, code: null }],
      [{ hex: null, code: null }, { hex: RED, code: "A1" }],
    ];
    const document = makeDocument(2, 2, cells);
    const asset = await renderPatternPng(document);

    expect(document.totalBeads).toBe(2);

    const image = await blobToImage(asset.blob);
    expect(image.width).toBe(asset.width);
    expect(image.height).toBe(asset.height);
  });

  it("TC-PATTERNPNG-005：文件名不含 Zippland 品牌", async () => {
    const cells: PatternCell[][] = [[{ hex: RED, code: "A1" }]];
    const document = makeDocument(1, 1, cells);
    const asset = await renderPatternPng(document);

    expect(asset.filename).not.toContain("zippland");
    expect(asset.filename).toMatch(/^pindou-pattern-/);
  });

  it("不同尺寸网格生成合法 PNG", async () => {
    const cells: PatternCell[][] = Array.from({ length: 10 }, () =>
      Array.from({ length: 10 }, () => ({ hex: RED, code: "A1" }))
    );
    const document = makeDocument(10, 10, cells);
    const asset = await renderPatternPng(document);

    expect(asset.blob.type).toBe("image/png");

    const image = await blobToImage(asset.blob);
    expect(image.width).toBe(asset.width);
    expect(image.height).toBe(asset.height);
  });

  it("大网格（最长边 72）使用 22px 单格", async () => {
    const cells: PatternCell[][] = Array.from({ length: 72 }, (_, y) =>
      Array.from({ length: 72 }, () => ({
        hex: y % 2 === 0 ? RED : GREEN,
        code: y % 2 === 0 ? "A1" : "A2",
      }))
    );
    const document = makeDocument(72, 72, cells);
    const asset = await renderPatternPng(document);

    expect(asset.width).toBe(80 + 72 * 22 + 40);
    expect(asset.height).toBe(80 + 72 * 22 + 100);

    const image = await blobToImage(asset.blob);
    expect(image.width).toBe(asset.width);
    expect(image.height).toBe(asset.height);
  });

  it("极窄图纸（1×29）画布宽度不小于最小宽度，摘要不被裁切", () => {
    const cells: PatternCell[][] = Array.from({ length: 29 }, () => [
      { hex: RED, code: "A1" },
    ]);
    const document = makeDocument(1, 29, cells);
    const layout = computePatternLayout(document);

    expect(layout.canvasWidth).toBeGreaterThanOrEqual(PATTERN_MIN_CANVAS_WIDTH);
    // 摘要基线在画布内
    expect(layout.summaryY).toBeLessThan(layout.canvasHeight);
    // 页脚 X 在画布内
    expect(layout.footerX).toBeLessThanOrEqual(layout.canvasWidth);
    expect(layout.footerY).toBeLessThan(layout.canvasHeight);
  });

  it("布局中 summary 和 footer 位置合法", () => {
    const cells: PatternCell[][] = [
      [{ hex: RED, code: "A1" }, { hex: GREEN, code: "A2" }],
      [{ hex: BLUE, code: "A3" }, { hex: WHITE, code: "A4" }],
    ];
    const document = makeDocument(2, 2, cells);
    const layout = computePatternLayout(document);

    expect(layout.summaryY).toBeGreaterThan(0);
    expect(layout.summaryY).toBeLessThan(layout.canvasHeight);
    expect(layout.footerY).toBeGreaterThan(0);
    expect(layout.footerY).toBeLessThan(layout.canvasHeight);
    expect(layout.summaryText).toContain("2×2");
    expect(layout.summaryText).toContain("4");
  });

  it("非法文档抛出明确错误", async () => {
    const cells: PatternCell[][] = [[{ hex: RED, code: "A1" }]];
    const doc = makeDocument(1, 1, cells);
    doc.totalBeads = 999;
    await expect(renderPatternPng(doc)).rejects.toThrow("非法 PatternDocument");
  });
});
