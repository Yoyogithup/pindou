import {
  findNearestColor,
  hexToOklab,
  hexToRgb,
  mapHexGridToPalette,
  normalizeHex,
  oklabDistance,
  srgbToLinear,
} from "../color";
import { TEST_PALETTE } from "@tests/fixtures/testPalette";

describe("color", () => {
  describe("normalizeHex", () => {
    it("标准化 #RRGGBB 为大写", () => {
      expect(normalizeHex("#7cb7a5")).toBe("#7CB7A5");
      expect(normalizeHex("  #FF0000  ")).toBe("#FF0000");
    });

    it("将 #RGB 简写展开为 #RRGGBB", () => {
      expect(normalizeHex("#f0a")).toBe("#FF00AA");
      expect(normalizeHex("abc")).toBe("#AABBCC");
    });

    it("拒绝非法格式", () => {
      expect(() => normalizeHex("")).toThrow("非法 HEX 格式");
      expect(() => normalizeHex("#GG0000")).toThrow("非法 HEX 格式");
      expect(() => normalizeHex("#FF000000")).toThrow("非法 HEX 格式");
      expect(() => normalizeHex("rgb(255,0,0)")).toThrow("非法 HEX 格式");
    });
  });

  describe("srgbToLinear / hexToRgb", () => {
    it("黑与白落在 0–1 范围", () => {
      expect(hexToRgb("#000000")).toEqual({ r: 0, g: 0, b: 0 });
      expect(hexToRgb("#FFFFFF")).toEqual({ r: 1, g: 1, b: 1 });
    });

    it("反 gamma 校正结果符合 sRGB 标准", () => {
      expect(srgbToLinear(0)).toBe(0);
      expect(srgbToLinear(1)).toBe(1);
      // sRGB 0.5 对应线性值约 0.214
      expect(srgbToLinear(0.5)).toBeCloseTo(0.214_041_140_48, 10);
    });
  });

  describe("hexToOklab", () => {
    it("白、黑、纯色的相对关系符合 Oklab 感知顺序", () => {
      const white = hexToOklab("#FFFFFF");
      const black = hexToOklab("#000000");
      const red = hexToOklab("#FF0000");
      const green = hexToOklab("#00FF00");
      const blue = hexToOklab("#0000FF");

      expect(white.L).toBeGreaterThan(black.L);
      expect(red.a).toBeGreaterThan(0);
      expect(green.b).toBeGreaterThan(0);
      expect(blue.b).toBeLessThan(0);
    });

    it("转换结果可重复", () => {
      const first = hexToOklab("#7CB7A5");
      const second = hexToOklab("#7CB7A5");
      expect(first).toEqual(second);
    });
  });

  describe("oklabDistance", () => {
    it("同色距离为 0", () => {
      const lab = hexToOklab("#7CB7A5");
      expect(oklabDistance(lab, lab)).toBe(0);
    });

    it("结果使用 0–100 标尺", () => {
      const dBW = oklabDistance(hexToOklab("#000000"), hexToOklab("#FFFFFF"));
      // 黑白在 Oklab 中距离接近 1，放大后接近 100
      expect(dBW).toBeGreaterThan(95);
      expect(dBW).toBeLessThan(105);
    });

    it("黑白距离大于红绿距离", () => {
      const dBW = oklabDistance(hexToOklab("#000000"), hexToOklab("#FFFFFF"));
      const dRG = oklabDistance(hexToOklab("#FF0000"), hexToOklab("#00FF00"));
      expect(dBW).toBeGreaterThan(dRG);
    });
  });

  describe("findNearestColor", () => {
    it("TC-COLOR-002: 固定输入始终映射到同一色号", () => {
      const result1 = findNearestColor("#FF0000", TEST_PALETTE);
      const result2 = findNearestColor("#FF0000", TEST_PALETTE);
      expect(result1.code).toBe(result2.code);
      expect(result1.hex).toBe(result2.hex);
    });

    it("空色板抛出明确错误", () => {
      expect(() => findNearestColor("#FF0000", [])).toThrow("色板为空");
    });

    it("白色映射到白，黑色映射到黑", () => {
      expect(findNearestColor("#FFFFFF", TEST_PALETTE).code).toBe("T01");
      expect(findNearestColor("#000000", TEST_PALETTE).code).toBe("T02");
    });

    it("不修改输入色板", () => {
      const original = [...TEST_PALETTE];
      findNearestColor("#FF0000", TEST_PALETTE);
      expect(TEST_PALETTE).toEqual(original);
    });

    it("距离相等时按 code 字典序 tie-break", () => {
      const palette = [
        { code: "B", hex: "#FF0000" },
        { code: "A", hex: "#FF0000" },
      ];
      const result = findNearestColor("#FF0000", palette);
      expect(result.code).toBe("A");
    });
  });

  describe("mapHexGridToPalette", () => {
    it("null 格保持 null", () => {
      const grid = [
        ["#FF0000", null],
        [null, "#000000"],
      ];
      const mapped = mapHexGridToPalette(grid, TEST_PALETTE);
      expect(mapped[0][1]).toEqual({ hex: null, code: null });
      expect(mapped[1][0]).toEqual({ hex: null, code: null });
    });

    it("非 null 格映射到最近色号", () => {
      const grid = [["#FF0000", "#000000"]];
      const mapped = mapHexGridToPalette(grid, TEST_PALETTE);
      expect(mapped[0][0].code).toBe("T03");
      expect(mapped[0][1].code).toBe("T02");
    });

    it("不修改原始网格", () => {
      const grid = [["#FF0000"]];
      mapHexGridToPalette(grid, TEST_PALETTE);
      expect(grid[0][0]).toBe("#FF0000");
    });
  });
});
