/** @jest-environment jsdom */

import { validatePalette, PaletteValidationError } from "../validatePalette";
import { resolvePreset } from "@/features/generator/model/resolvePreset";

describe("validatePalette", () => {
  const preset = resolvePreset("fridge-magnet", "standard");

  it("合法色板通过校验并标准化 HEX", () => {
    const palette = [
      { code: "A1", hex: "#FF0000" },
      { code: "A2", hex: "#00ff00" }, // 小写 → 标准化为大写
      { code: "A3", hex: "0000FF" }, // 无 # → 标准化
    ];

    const result = validatePalette(palette, preset);

    expect(result).toEqual([
      { code: "A1", hex: "#FF0000", name: undefined },
      { code: "A2", hex: "#00FF00", name: undefined },
      { code: "A3", hex: "#0000FF", name: undefined },
    ]);
  });

  it("3 位 HEX 标准化为 6 位", () => {
    const palette = [{ code: "A1", hex: "#F00" }];
    const result = validatePalette(palette, preset);
    expect(result[0].hex).toBe("#FF0000");
  });

  it("空色板抛错", () => {
    expect(() => validatePalette([], preset)).toThrow(PaletteValidationError);
    expect(() => validatePalette([], preset)).toThrow("色板不能为空");
  });

  it("空 code 抛错", () => {
    const palette = [{ code: "", hex: "#FF0000" }];
    expect(() => validatePalette(palette, preset)).toThrow("code 为空");
  });

  it("空白 code 抛错", () => {
    const palette = [{ code: "  ", hex: "#FF0000" }];
    expect(() => validatePalette(palette, preset)).toThrow("code 为空");
  });

  it("重复 code 抛错", () => {
    const palette = [
      { code: "A1", hex: "#FF0000" },
      { code: "A1", hex: "#00FF00" },
    ];
    expect(() => validatePalette(palette, preset)).toThrow('code 重复: "A1"');
  });

  it("非法 HEX 抛错", () => {
    const palette = [{ code: "A1", hex: "ZZZZZZ" }];
    expect(() => validatePalette(palette, preset)).toThrow("HEX 不合法");
  });

  it("标准化后重复 HEX 抛错", () => {
    const palette = [
      { code: "A1", hex: "#FF0000" },
      { code: "A2", hex: "#ff0000" }, // 标准化后与 A1 相同
    ];
    expect(() => validatePalette(palette, preset)).toThrow("标准化后 HEX 重复");
  });

  it("3 位与 6 位等价 HEX 重复抛错", () => {
    const palette = [
      { code: "A1", hex: "#FF0000" },
      { code: "A2", hex: "#F00" }, // 标准化为 #FF0000
    ];
    expect(() => validatePalette(palette, preset)).toThrow("标准化后 HEX 重复");
  });

  it("paletteId 不匹配抛错", () => {
    const badPreset = { ...preset, paletteId: "OTHER" as "MARD" };
    const palette = [{ code: "A1", hex: "#FF0000" }];
    expect(() => validatePalette(palette, badPreset)).toThrow("paletteId 不匹配");
  });

  it("保留 name 字段", () => {
    const palette = [{ code: "A1", hex: "#FF0000", name: "Red" }];
    const result = validatePalette(palette, preset);
    expect(result[0].name).toBe("Red");
  });

  it("code 前后空白被 trim，视为相同 code", () => {
    const palette = [
      { code: "A1", hex: "#FF0000" },
      { code: " A1 ", hex: "#00FF00" },
    ];
    expect(() => validatePalette(palette, preset)).toThrow('code 重复: "A1"');
  });

  it("code 带空白时结果输出 trim 后的 code", () => {
    const palette = [{ code: " B2 ", hex: "#FF0000" }];
    const result = validatePalette(palette, preset);
    expect(result[0].code).toBe("B2");
  });
});
