import { validatePatternDocumentForExport } from "../validatePatternDocument";
import type { ColorUsage, PatternCell, PatternDocument } from "@/features/generator/model/types";

function makeDocumentFromCells(cells: PatternCell[][]): PatternDocument {
  const height = cells.length;
  const width = height > 0 ? cells[0].length : 0;

  // 基于 cells 计算 usage，确保默认文档完全合法
  const usageMap = new Map<string, ColorUsage>();
  let totalBeads = 0;
  for (const row of cells) {
    for (const cell of row) {
      if (cell.code === null) continue;
      totalBeads++;
      const existing = usageMap.get(cell.code);
      if (existing) {
        existing.count++;
      } else {
        usageMap.set(cell.code, { hex: cell.hex!, code: cell.code, count: 1 });
      }
    }
  }
  const usage = Array.from(usageMap.values());

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
      minRegionSize: 2,
      maxColors: Math.max(usage.length, 1),
      paletteId: "MARD",
      sectionInterval: 5,
      backgroundStrategy: "remove-edge-connected",
    },
  };
}

describe("validatePatternDocumentForExport", () => {
  it("合法文档通过", () => {
    const cells: PatternCell[][] = [[{ hex: "#FF0000", code: "A1" }]];
    expect(() => validatePatternDocumentForExport(makeDocumentFromCells(cells))).not.toThrow();
  });

  it("width 非正整数抛错", () => {
    const doc = makeDocumentFromCells([[{ hex: "#FF0000", code: "A1" }]]);
    doc.width = 0;
    expect(() => validatePatternDocumentForExport(doc)).toThrow("非法 PatternDocument");
  });

  it("cells 行数与 height 不一致抛错", () => {
    const doc = makeDocumentFromCells([[{ hex: "#FF0000", code: "A1" }]]);
    doc.height = 2; // cells 仍为 1 行
    expect(() => validatePatternDocumentForExport(doc)).toThrow("cells 行数");
  });

  it("cells 行长度与 width 不一致抛错", () => {
    const doc = makeDocumentFromCells([[{ hex: "#FF0000", code: "A1" }]]);
    doc.width = 2; // cells[0] 仍为 1 列
    expect(() => validatePatternDocumentForExport(doc)).toThrow("长度");
  });

  it("hex 和 code 不同时为空抛错", () => {
    const cells: PatternCell[][] = [[{ hex: "#FF0000", code: null }]];
    const doc = makeDocumentFromCells(cells);
    expect(() => validatePatternDocumentForExport(doc)).toThrow("hex 与 code");
  });

  it("totalBeads 与 cells 实际非空格数不一致抛错", () => {
    const cells: PatternCell[][] = [[{ hex: "#FF0000", code: "A1" }]];
    const doc = makeDocumentFromCells(cells);
    doc.totalBeads = 999;
    expect(() => validatePatternDocumentForExport(doc)).toThrow("cells 实际非空格数");
  });

  it("usage 长度与 cells 实际颜色数不一致抛错", () => {
    const cells: PatternCell[][] = [[{ hex: "#FF0000", code: "A1" }]];
    const doc = makeDocumentFromCells(cells);
    doc.usage = [
      { hex: "#FF0000", code: "A1", count: 1 },
      { hex: "#00FF00", code: "A2", count: 0 },
    ];
    expect(() => validatePatternDocumentForExport(doc)).toThrow("颜色数");
  });

  it("usage 中色号重复出现抛错", () => {
    const cells: PatternCell[][] = [
      [{ hex: "#FF0000", code: "A1" }],
      [{ hex: "#00FF00", code: "A2" }],
    ];
    const doc = makeDocumentFromCells(cells);
    doc.usage = [
      { hex: "#FF0000", code: "A1", count: 1 },
      { hex: "#FF0000", code: "A1", count: 1 },
    ];
    expect(() => validatePatternDocumentForExport(doc)).toThrow("重复出现");
  });

  it("usage 中存在非法 HEX 抛错", () => {
    const cells: PatternCell[][] = [[{ hex: "#FF0000", code: "A1" }]];
    const doc = makeDocumentFromCells(cells);
    doc.usage[0].hex = "not-a-hex";
    expect(() => validatePatternDocumentForExport(doc)).toThrow("HEX");
  });

  it("usage 中 count 为 0 抛错", () => {
    const cells: PatternCell[][] = [[{ hex: "#FF0000", code: "A1" }]];
    const doc = makeDocumentFromCells(cells);
    doc.usage[0].count = 0;
    expect(() => validatePatternDocumentForExport(doc)).toThrow("count 必须为正整数");
  });

  it("usage 中色号在 cells 中不存在抛错", () => {
    const cells: PatternCell[][] = [[{ hex: "#FF0000", code: "A1" }]];
    const doc = makeDocumentFromCells(cells);
    doc.usage[0].code = "Z99";
    expect(() => validatePatternDocumentForExport(doc)).toThrow("在 cells 中不存在");
  });

  it("usage 中 HEX 与 cells 不一致抛错", () => {
    const cells: PatternCell[][] = [[{ hex: "#FF0000", code: "A1" }]];
    const doc = makeDocumentFromCells(cells);
    doc.usage[0].hex = "#00FF00";
    expect(() => validatePatternDocumentForExport(doc)).toThrow("与 cells 中的");
  });

  it("usage 中 count 与 cells 实际数量不一致抛错", () => {
    const cells: PatternCell[][] = [[{ hex: "#FF0000", code: "A1" }]];
    const doc = makeDocumentFromCells(cells);
    doc.usage[0].count = 5;
    expect(() => validatePatternDocumentForExport(doc)).toThrow("与 cells 实际数量");
  });

  it("同一 code 对应多个 HEX 抛错", () => {
    const cells: PatternCell[][] = [
      [{ hex: "#FF0000", code: "A1" }],
      [{ hex: "#00FF00", code: "A1" }],
    ];
    const doc = makeDocumentFromCells(cells);
    expect(() => validatePatternDocumentForExport(doc)).toThrow("对应多个不同 HEX");
  });

  it("usage 超过 preset 上限抛错", () => {
    const cells: PatternCell[][] = [[{ hex: "#FF0000", code: "A1" }]];
    const doc = makeDocumentFromCells(cells);
    doc.preset.maxColors = 0;
    expect(() => validatePatternDocumentForExport(doc)).toThrow("超过 preset");
  });

  it("usage 超过 28 色排版上限抛错", () => {
    const cells: PatternCell[][] = [[]];
    for (let i = 0; i < 29; i++) {
      cells[0].push({ hex: "#FF0000", code: `A${i + 1}` });
    }
    const doc = makeDocumentFromCells(cells);
    doc.preset.maxColors = 100;
    expect(() => validatePatternDocumentForExport(doc)).toThrow("超过用量 PNG");
  });
});
