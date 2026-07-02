import { calculateGrid } from "../calculateGrid";

describe("calculateGrid", () => {
  it("TC-GRID-001: 正方形按 maxGridEdge 输出等宽高", () => {
    expect(calculateGrid(1000, 1000, 29)).toEqual({ width: 29, height: 29 });
    expect(calculateGrid(1000, 1000, 58)).toEqual({ width: 58, height: 58 });
    expect(calculateGrid(1000, 1000, 72)).toEqual({ width: 72, height: 72 });
  });

  it("TC-GRID-002: 4:3 横图保持比例", () => {
    expect(calculateGrid(1200, 900, 29)).toEqual({ width: 29, height: 22 });
    expect(calculateGrid(1200, 900, 58)).toEqual({ width: 58, height: 44 });
    expect(calculateGrid(1200, 900, 72)).toEqual({ width: 72, height: 54 });
  });

  it("TC-GRID-003: 3:4 竖图保持比例", () => {
    expect(calculateGrid(900, 1200, 29)).toEqual({ width: 22, height: 29 });
    expect(calculateGrid(900, 1200, 58)).toEqual({ width: 44, height: 58 });
    expect(calculateGrid(900, 1200, 72)).toEqual({ width: 54, height: 72 });
  });

  it("TC-GRID-004: 极端比例下短边至少为 1", () => {
    const extremeWide = calculateGrid(10000, 10, 58);
    expect(extremeWide.width).toBe(58);
    expect(extremeWide.height).toBeGreaterThanOrEqual(1);
    expect(extremeWide.height).toBeLessThanOrEqual(58);

    const extremeTall = calculateGrid(10, 10000, 58);
    expect(extremeTall.height).toBe(58);
    expect(extremeTall.width).toBeGreaterThanOrEqual(1);
    expect(extremeTall.width).toBeLessThanOrEqual(58);
  });

  it("非法尺寸必须抛出明确错误", () => {
    expect(() => calculateGrid(0, 100, 58)).toThrow("非法输入");
    expect(() => calculateGrid(100, -1, 58)).toThrow("非法输入");
    expect(() => calculateGrid(100, 100, 0)).toThrow("非法输入");
    expect(() => calculateGrid(NaN, 100, 58)).toThrow("非法输入");
    expect(() => calculateGrid(100, 100, Infinity)).toThrow("非法输入");
  });

  it("maxGridEdge 必须为正整数", () => {
    expect(() => calculateGrid(1000, 1000, 58.5)).toThrow("非法输入");
    expect(() => calculateGrid(1200, 900, 29.0)).not.toThrow();
  });

  it("输出 width/height 始终为正整数", () => {
    const result = calculateGrid(1200, 900, 58);
    expect(Number.isInteger(result.width)).toBe(true);
    expect(Number.isInteger(result.height)).toBe(true);
    expect(result.width).toBeGreaterThan(0);
    expect(result.height).toBeGreaterThan(0);
  });

  it("不修改输入参数", () => {
    const w = 1200;
    const h = 900;
    calculateGrid(w, h, 58);
    expect(w).toBe(1200);
    expect(h).toBe(900);
  });
});
