import { calculateUsage } from "../calculateUsage";
import type { PatternCell } from "@/features/generator/model/types";

describe("calculateUsage", () => {
  it("TC-USAGE-001: 基础计数", () => {
    // A A null
    // A B B
    const cells: PatternCell[][] = [
      [
        { hex: "#FF0000", code: "A" },
        { hex: "#FF0000", code: "A" },
        { hex: null, code: null },
      ],
      [
        { hex: "#FF0000", code: "A" },
        { hex: "#0000FF", code: "B" },
        { hex: "#0000FF", code: "B" },
      ],
    ];

    const { usage, totalBeads } = calculateUsage(cells);
    expect(totalBeads).toBe(5);

    const usageA = usage.find((u) => u.code === "A");
    const usageB = usage.find((u) => u.code === "B");
    expect(usageA?.count).toBe(3);
    expect(usageB?.count).toBe(2);
  });

  it("TC-USAGE-002: 统计不变量", () => {
    const cells: PatternCell[][] = [
      [{ hex: "#FF0000", code: "A" }, { hex: null, code: null }],
      [{ hex: "#0000FF", code: "B" }, { hex: "#0000FF", code: "B" }],
      [{ hex: "#FF0000", code: "A" }, { hex: "#00FF00", code: "C" }],
    ];

    const { usage, totalBeads } = calculateUsage(cells);
    const nonNullCells = cells.flat().filter((c) => c.hex !== null).length;
    const sumCount = usage.reduce((sum, u) => sum + u.count, 0);

    expect(totalBeads).toBe(nonNullCells);
    expect(totalBeads).toBe(sumCount);
    expect(usage.length).toBe(3);
  });

  it("TC-USAGE-003: 稳定自然排序", () => {
    const cells: PatternCell[][] = [
      [
        { hex: "#0000FF", code: "A10" },
        { hex: "#FF0000", code: "A2" },
        { hex: "#00FF00", code: "B1" },
      ],
    ];

    const { usage } = calculateUsage(cells);
    const codes = usage.map((u) => u.code);
    expect(codes).toEqual(["A2", "A10", "B1"]);

    // 多次调用顺序一致
    const { usage: usage2 } = calculateUsage(cells);
    expect(usage2.map((u) => u.code)).toEqual(codes);
  });

  it("TC-USAGE-004: 不生成或推测颜色名称", () => {
    const cells: PatternCell[][] = [
      [{ hex: "#FF0000", code: "A" }],
      [{ hex: "#0000FF", code: "B" }],
    ];

    const { usage } = calculateUsage(cells);
    const a = usage.find((u) => u.code === "A");
    const b = usage.find((u) => u.code === "B");

    expect(a?.name).toBeUndefined();
    expect(b?.name).toBeUndefined();
  });

  it("空网格返回空用量与零豆数", () => {
    const { usage, totalBeads } = calculateUsage([]);
    expect(usage).toEqual([]);
    expect(totalBeads).toBe(0);
  });

  it("不修改输入网格", () => {
    const cells: PatternCell[][] = [
      [{ hex: "#FF0000", code: "A" }],
    ];
    calculateUsage(cells);
    expect(cells[0][0].count).toBeUndefined();
  });

  it("hex 非 null 但 code 为 null 时抛错", () => {
    const cells: PatternCell[][] = [[{ hex: "#FF0000", code: null }]];
    expect(() => calculateUsage(cells)).toThrow("非法 PatternCell");
  });

  it("hex 为 null 但 code 非 null 时抛错", () => {
    const cells: PatternCell[][] = [[{ hex: null, code: "A" }]];
    expect(() => calculateUsage(cells)).toThrow("非法 PatternCell");
  });

  it("同一 code 对应多个 HEX 时抛错", () => {
    const cells: PatternCell[][] = [
      [{ hex: "#FF0000", code: "A" }],
      [{ hex: "#0000FF", code: "A" }],
    ];
    expect(() => calculateUsage(cells)).toThrow("非法 PatternCell");
  });
});
