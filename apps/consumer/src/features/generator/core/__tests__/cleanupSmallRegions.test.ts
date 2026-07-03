import { cleanupSmallRegions } from "../cleanupSmallRegions";
import { countNonNull, distinctColors } from "../testHelpers";

describe("cleanupSmallRegions", () => {
  it("TC-COLOR-006: 新手/标准模式清理单格孤立杂色，细节模式保留 1 格", () => {
    // 3x3 网格，中心一格异色
    const grid = [
      ["#FF0000", "#FF0000", "#FF0000"],
      ["#FF0000", "#0000FF", "#FF0000"],
      ["#FF0000", "#FF0000", "#FF0000"],
    ];

    const beginner = cleanupSmallRegions(grid, 3);
    expect(beginner[1][1]).toBe("#FF0000");
    expect(distinctColors(beginner).size).toBe(1);

    const standard = cleanupSmallRegions(grid, 2);
    expect(standard[1][1]).toBe("#FF0000");
    expect(distinctColors(standard).size).toBe(1);

    const detail = cleanupSmallRegions(grid, 1);
    expect(detail[1][1]).toBe("#0000FF");
    expect(distinctColors(detail).size).toBe(2);
  });

  it("null 背景格不参与连通区域", () => {
    const grid = [
      ["#FF0000", null],
      [null, "#FF0000"],
    ];
    const result = cleanupSmallRegions(grid, 2);
    expect(result[0][0]).toBe("#FF0000");
    expect(result[1][1]).toBe("#FF0000");
    expect(result[0][1]).toBeNull();
    expect(result[1][0]).toBeNull();
  });

  it("小区域替换为相邻最多的颜色", () => {
    const grid = [
      ["#FF0000", "#00FF00", "#00FF00"],
      ["#FF0000", "#0000FF", "#00FF00"],
      ["#FF0000", "#00FF00", "#00FF00"],
    ];
    const result = cleanupSmallRegions(grid, 2);
    expect(result[1][1]).toBe("#00FF00");
  });

  it("相邻颜色次数相同时按 HEX 字典序 tie-break", () => {
    const grid = [
      ["#FF0000", "#00FF00"],
      ["#0000FF", "#0000FF"],
    ];
    // 中心 #FF0000 是单格区域，上下两个邻域 #00FF00 与 #0000FF 各出现 1 次
    const result = cleanupSmallRegions(grid, 2);
    // #0000FF < #00FF00，应替换为 #0000FF
    expect(result[0][0]).toBe("#0000FF");
  });

  it("非 null 格总数不变", () => {
    const grid = [
      ["#FF0000", "#FF0000", "#FF0000"],
      ["#FF0000", "#0000FF", "#FF0000"],
      ["#FF0000", "#FF0000", "#FF0000"],
    ];
    const result = cleanupSmallRegions(grid, 2);
    expect(countNonNull(result)).toBe(countNonNull(grid));
  });

  it("不修改原始网格", () => {
    const grid = [["#FF0000", "#0000FF"]];
    cleanupSmallRegions(grid, 2);
    expect(grid[0][1]).toBe("#0000FF");
  });

  it("非法 minRegionSize 抛出错误", () => {
    expect(() => cleanupSmallRegions([["#FF0000"]], 0)).toThrow("非法最小色块尺寸");
    expect(() => cleanupSmallRegions([["#FF0000"]], 1.5)).toThrow("非法最小色块尺寸");
    expect(() => cleanupSmallRegions([["#FF0000"]], NaN)).toThrow("非法最小色块尺寸");
  });
});
