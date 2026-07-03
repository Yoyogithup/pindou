import { validateRectangularGrid } from "../validateRectangularGrid";

describe("validateRectangularGrid", () => {
  it("允许真正的空网格", () => {
    expect(() => validateRectangularGrid([])).not.toThrow();
  });

  it("允许规则矩形零宽网格", () => {
    expect(() => validateRectangularGrid([[], []])).not.toThrow();
    expect(() => validateRectangularGrid([[]])).not.toThrow();
  });

  it("矩形网格通过", () => {
    expect(() =>
      validateRectangularGrid([
        ["#FF0000", "#0000FF"],
        ["#00FF00", null],
      ])
    ).not.toThrow();
  });

  it("锯齿网格抛出错误", () => {
    expect(() =>
      validateRectangularGrid([
        ["#FF0000", "#0000FF"],
        ["#00FF00"],
      ])
    ).toThrow("非法网格");
  });

  it("第一行为空但后续行非空时抛错", () => {
    expect(() => validateRectangularGrid([[], ["#FF0000"]])).toThrow("非法网格");
  });

  it("第一行为 null 时抛出明确错误", () => {
    expect(() => validateRectangularGrid([null as unknown as string[]])).toThrow("非法网格");
  });

  it("第一行为 undefined 时抛出明确错误", () => {
    expect(() => validateRectangularGrid([undefined as unknown as string[]])).toThrow("非法网格");
  });

  it("第一行为字符串时抛出明确错误", () => {
    expect(() => validateRectangularGrid(["#FF0000"] as unknown as string[][])).toThrow("非法网格");
  });

  it("undefined 单元格不被当作颜色", () => {
    expect(() =>
      validateRectangularGrid([
        ["#FF0000", undefined as unknown as null],
      ])
    ).toThrow("非法网格");
  });

  it("某行不是数组时抛错", () => {
    expect(() =>
      validateRectangularGrid([["#FF0000"], "#0000FF"] as unknown as string[][])
    ).toThrow("非法网格");
  });

  it("不修改输入网格", () => {
    const grid = [
      ["#FF0000", "#0000FF"],
      ["#00FF00", null],
    ];
    validateRectangularGrid(grid);
    expect(grid[0][0]).toBe("#FF0000");
  });
});
