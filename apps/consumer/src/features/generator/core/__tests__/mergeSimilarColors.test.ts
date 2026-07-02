import { mergeSimilarColors } from "../mergeSimilarColors";
import { countNonNull, distinctColors } from "../testHelpers";

describe("mergeSimilarColors", () => {
  it("空网格直接返回", () => {
    expect(mergeSimilarColors([], 50)).toEqual([]);
  });

  it("null 格保持 null", () => {
    const grid = [
      ["#FF0000", null],
      [null, "#000000"],
    ];
    const result = mergeSimilarColors(grid, 50);
    expect(result[0][1]).toBeNull();
    expect(result[1][0]).toBeNull();
  });

  it("阈值以内相似色被合并", () => {
    // #FF0000 与 #FF0101 在 Oklab 中非常接近
    const grid = [
      ["#FF0000", "#FF0101"],
      ["#FF0000", "#FF0000"],
    ];
    const result = mergeSimilarColors(grid, 50);
    expect(distinctColors(result).size).toBe(1);
    expect(countNonNull(result)).toBe(4);
  });

  it("阈值以外不合并", () => {
    const grid = [
      ["#FF0000", "#0000FF"],
      ["#00FF00", "#FFFF00"],
    ];
    const result = mergeSimilarColors(grid, 5);
    expect(distinctColors(result).size).toBe(4);
  });

  it("真实 preset 阈值 14/24/32 下，明显不同的红绿蓝不会被全部合并", () => {
    const grid = [
      ["#FF0000", "#00FF00", "#0000FF"],
      ["#FF0000", "#00FF00", "#0000FF"],
    ];

    for (const threshold of [14, 24, 32]) {
      const result = mergeSimilarColors(grid, threshold);
      expect(distinctColors(result).size).toBeGreaterThanOrEqual(2);
      expect(countNonNull(result)).toBe(6);
    }
  });

  it("真实 preset 阈值 32 下，接近的红色系可合并", () => {
    const grid = [
      ["#FF0000", "#FF2020"],
      ["#FF0000", "#FF0000"],
    ];

    const result = mergeSimilarColors(grid, 32);
    expect(distinctColors(result).size).toBe(1);
    expect(countNonNull(result)).toBe(4);
  });

  it("结果不修改原始网格", () => {
    const grid = [["#FF0000", "#FF0101"]];
    mergeSimilarColors(grid, 50);
    expect(grid[0][0]).toBe("#FF0000");
    expect(grid[0][1]).toBe("#FF0101");
  });

  it("count 相同时 HEX 字典序更小者成为被合并目标（稳定 tie-break）", () => {
    // #FF0000 < #FF0101，两者 count 均为 1，阈值足以合并
    const grid = [
      ["#FF0000", "#FF0101"],
    ];
    const result = mergeSimilarColors(grid, 50);
    expect(distinctColors(result).size).toBe(1);
    expect(result[0][0]).toBe("#FF0000");
    expect(result[0][1]).toBe("#FF0000");
  });

  it("非法阈值抛出错误", () => {
    expect(() => mergeSimilarColors([["#FF0000"]], -1)).toThrow("非法相似阈值");
    expect(() => mergeSimilarColors([["#FF0000"]], NaN)).toThrow("非法相似阈值");
  });
});
