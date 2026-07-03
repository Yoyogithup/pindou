import { limitColorCount } from "../limitColorCount";
import {
  countNonNull,
  distinctColors,
  generateDistinctHexColors,
} from "../testHelpers";

describe("limitColorCount", () => {
  it("TC-COLOR-004: 颜色硬上限，最终颜色数不超过 maxColors", () => {
    const grid = [
      ["#FF0000", "#00FF00", "#0000FF", "#FFFF00"],
      ["#FF00FF", "#00FFFF", "#808080", "#800000"],
    ];

    const result = limitColorCount(grid, 4);
    expect(distinctColors(result).size).toBeLessThanOrEqual(4);
    expect(countNonNull(result)).toBe(countNonNull(grid));
  });

  it("TC-COLOR-004: 九种 preset 上限逐个验证（输入颜色数大于每个上限）", () => {
    const colors = generateDistinctHexColors(29);
    expect(colors.length).toBeGreaterThanOrEqual(29);

    // 构造 29 色网格，每个颜色至少出现一次
    const grid: (string | null)[][] = [];
    for (let i = 0; i < colors.length; i += 6) {
      const row = colors.slice(i, i + 6);
      while (row.length < 6) {
        row.push(colors[row.length % colors.length]);
      }
      grid.push(row);
    }

    const limits = [8, 12, 16, 10, 16, 24, 12, 20, 28];
    for (const max of limits) {
      const originalDistinct = distinctColors(grid).size;
      expect(originalDistinct).toBeGreaterThan(max);

      const result = limitColorCount(grid, max);
      expect(distinctColors(result).size).toBeLessThanOrEqual(max);
      expect(countNonNull(result)).toBe(countNonNull(grid));
    }
  });

  it("TC-COLOR-005: 最少用量优先合并，总豆数不变", () => {
    // 主色 7 格，两个少量色各 1 格，上限 2：
    // 第一次应移除一个用量最少的颜色并入最近保留色，主色因此增加 1 格。
    const grid = [
      ["#FF0000", "#FF0000", "#FF0000", "#FF0000"],
      ["#FF0000", "#FF0000", "#FF0000", "#0000FF"],
      ["#00FF00", null, null, null],
    ];

    const result = limitColorCount(grid, 2);
    expect(distinctColors(result).size).toBe(2);
    expect(countNonNull(result)).toBe(9);

    const counts = new Map<string, number>();
    for (const row of result) {
      for (const hex of row) {
        if (hex !== null) {
          counts.set(hex, (counts.get(hex) ?? 0) + 1);
        }
      }
    }

    const sortedCounts = Array.from(counts.values()).sort((a, b) => b - a);
    expect(sortedCounts[0]).toBe(8); // 主色吸收了一个少量色
    expect(sortedCounts[1]).toBe(1); // 另一个少量色保留
  });

  it("颜色数未超上限时不合并", () => {
    const grid = [
      ["#FF0000", "#0000FF"],
      ["#FF0000", "#0000FF"],
    ];
    const result = limitColorCount(grid, 4);
    expect(distinctColors(result).size).toBe(2);
  });

  it("用量相同时 HEX 字典序更小者先被移除（稳定 tie-break）", () => {
    // #0000FF < #FF0000，两者 count 均为 2，上限 1：
    // victim 应为 #0000FF，并入 #FF0000。
    const grid = [
      ["#FF0000", "#0000FF"],
      ["#FF0000", "#0000FF"],
    ];
    const result = limitColorCount(grid, 1);
    expect(distinctColors(result).size).toBe(1);
    expect(result[0][1]).toBe("#FF0000");
  });

  it("null 格保持 null", () => {
    const grid = [
      ["#FF0000", null, "#0000FF"],
      [null, "#00FF00", null],
    ];
    const result = limitColorCount(grid, 2);
    expect(result[0][1]).toBeNull();
    expect(result[1][0]).toBeNull();
    expect(result[1][2]).toBeNull();
  });

  it("不修改原始网格", () => {
    const grid = [["#FF0000", "#0000FF", "#00FF00"]];
    limitColorCount(grid, 2);
    expect(grid[0]).toEqual(["#FF0000", "#0000FF", "#00FF00"]);
  });

  it("非法 maxColors 抛出错误", () => {
    expect(() => limitColorCount([["#FF0000"]], 0)).toThrow("非法最大颜色数");
    expect(() => limitColorCount([["#FF0000"]], -1)).toThrow("非法最大颜色数");
    expect(() => limitColorCount([["#FF0000"]], 1.5)).toThrow("非法最大颜色数");
    expect(() => limitColorCount([["#FF0000"]], NaN)).toThrow("非法最大颜色数");
  });
});
