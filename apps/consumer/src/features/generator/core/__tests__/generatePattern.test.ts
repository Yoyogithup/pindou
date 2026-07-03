/** @jest-environment jsdom */

import { preparePattern, finalizePattern, hexGridToPatternCells } from "../generatePattern";
import { resolvePreset } from "@/features/generator/model/resolvePreset";
import { TEST_PALETTE } from "@tests/fixtures/testPalette";

/** jsdom 不含 ImageData，手动构造兼容对象 */
function makeSolidImageData(
  width: number,
  height: number,
  r: number,
  g: number,
  b: number
): ImageData {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    data[i * 4] = r;
    data[i * 4 + 1] = g;
    data[i * 4 + 2] = b;
    data[i * 4 + 3] = 255;
  }
  return { data, width, height, colorSpace: "srgb" } as unknown as ImageData;
}

describe("preparePattern", () => {
  it("纯色图：返回 PreparedPattern 含 gridSize 和 backgroundResult", () => {
    const img = makeSolidImageData(200, 200, 255, 0, 0);
    const preset = resolvePreset("fridge-magnet", "standard");
    const palette = TEST_PALETTE.map((c) => ({ code: c.code, hex: c.hex, name: c.name }));

    const prepared = preparePattern(img, preset, palette);

    expect(prepared.gridSize.width).toBe(58);
    expect(prepared.gridSize.height).toBeGreaterThan(0);
    expect(typeof prepared.requiresBackgroundSelection).toBe("boolean");
    expect(prepared.backgroundResult).toBeDefined();
    expect(prepared.limitedGrid.length).toBeGreaterThan(0);
    expect(prepared.preset).toBe(preset);
    expect(prepared.palette.length).toBe(palette.length);
  });

  it("非法 ImageData 抛错", () => {
    const img = { data: new Uint8ClampedArray(0), width: 0, height: 0 } as unknown as ImageData;
    const preset = resolvePreset("fridge-magnet", "standard");
    const palette = TEST_PALETTE.map((c) => ({ code: c.code, hex: c.hex }));

    expect(() => preparePattern(img, preset, palette)).toThrow("尺寸必须大于零");
  });

  it("空色板被 validatePalette 拒绝", () => {
    const img = makeSolidImageData(100, 100, 128, 128, 128);
    const preset = resolvePreset("fridge-magnet", "standard");

    expect(() => preparePattern(img, preset, [])).toThrow("色板不能为空");
  });

  it("不同 preset 产生不同网格尺寸", () => {
    const img = makeSolidImageData(400, 300, 0, 255, 0);
    const palette = TEST_PALETTE.map((c) => ({ code: c.code, hex: c.hex }));

    const preparedKeychain = preparePattern(img, resolvePreset("keychain", "standard"), palette);
    const preparedStand = preparePattern(img, resolvePreset("stand", "standard"), palette);

    expect(
      Math.max(preparedKeychain.gridSize.width, preparedKeychain.gridSize.height)
    ).toBeLessThanOrEqual(29);
    expect(
      Math.max(preparedStand.gridSize.width, preparedStand.gridSize.height)
    ).toBeLessThanOrEqual(72);
  });

  it("色板含重复 code 被拒绝", () => {
    const img = makeSolidImageData(100, 100, 128, 128, 128);
    const preset = resolvePreset("fridge-magnet", "standard");
    const palette = [
      { code: "A1", hex: "#FF0000" },
      { code: "A1", hex: "#00FF00" },
    ];

    expect(() => preparePattern(img, preset, palette)).toThrow("code 重复");
  });

  it("色板含重复 HEX（标准化后）被拒绝", () => {
    const img = makeSolidImageData(100, 100, 128, 128, 128);
    const preset = resolvePreset("fridge-magnet", "standard");
    const palette = [
      { code: "A1", hex: "#FF0000" },
      { code: "A2", hex: "#ff0000" }, // 标准化后与 A1 相同
    ];

    expect(() => preparePattern(img, preset, palette)).toThrow("标准化后 HEX 重复");
  });
});

describe("finalizePattern", () => {
  it("将 HexGrid 收口为 PatternDocument", () => {
    const preset = resolvePreset("fridge-magnet", "standard");
    const palette = TEST_PALETTE.map((c) => ({ code: c.code, hex: c.hex }));
    const hexGrid: (string | null)[][] = [
      [palette[0].hex, palette[1].hex],
      [palette[0].hex, null],
    ];

    const doc = finalizePattern(hexGrid, { width: 2, height: 2 }, preset, palette);

    expect(doc.version).toBe(1);
    expect(doc.width).toBe(2);
    expect(doc.height).toBe(2);
    expect(doc.paletteId).toBe("MARD");
    expect(doc.totalBeads).toBe(3);
    expect(doc.usage.length).toBe(2);
    expect(doc.cells[1][1].hex).toBeNull();
    expect(doc.cells[1][1].code).toBeNull();
  });

  it("全 null 网格输出零用量", () => {
    const preset = resolvePreset("keychain", "beginner");
    const palette = TEST_PALETTE.map((c) => ({ code: c.code, hex: c.hex }));
    const hexGrid: (string | null)[][] = [
      [null, null],
      [null, null],
    ];

    const doc = finalizePattern(hexGrid, { width: 2, height: 2 }, preset, palette);

    expect(doc.totalBeads).toBe(0);
    expect(doc.usage.length).toBe(0);
  });

  it("prepare → finalize 完整流程", () => {
    const img = makeSolidImageData(200, 200, 255, 0, 0);
    const preset = resolvePreset("fridge-magnet", "standard");
    const palette = TEST_PALETTE.map((c) => ({ code: c.code, hex: c.hex, name: c.name }));

    const prepared = preparePattern(img, preset, palette);
    const grid = prepared.requiresBackgroundSelection
      ? prepared.limitedGrid
      : prepared.backgroundResult.grid;
    const doc = finalizePattern(grid, prepared.gridSize, prepared.preset, prepared.palette);

    expect(doc.version).toBe(1);
    expect(doc.width).toBe(prepared.gridSize.width);
    expect(doc.height).toBe(prepared.gridSize.height);
    // totalBeads === sum(usage.count)
    const usageSum = doc.usage.reduce((s, u) => s + u.count, 0);
    expect(doc.totalBeads).toBe(usageSum);
    expect(doc.usage.length).toBeLessThanOrEqual(preset.maxColors);
  });
});

describe("hexGridToPatternCells", () => {
  it("色板已校验后 hex→code 为一对一", () => {
    const palette = [
      { code: "A1", hex: "#FF0000" },
      { code: "A2", hex: "#00FF00" },
    ];
    const grid: (string | null)[][] = [[palette[0].hex, palette[1].hex, null]];

    const cells = hexGridToPatternCells(grid, palette);

    expect(cells[0][0]).toEqual({ hex: "#FF0000", code: "A1" });
    expect(cells[0][1]).toEqual({ hex: "#00FF00", code: "A2" });
    expect(cells[0][2]).toEqual({ hex: null, code: null });
  });
});
