import {
  DEFAULT_PRESET_KEYS,
  MODE_OPTIONS,
  PURPOSE_OPTIONS,
} from "./presets";
import { resolvePreset } from "./resolvePreset";
import type { Mode, Purpose } from "./types";

const EXPECTED_TABLE: {
  purpose: Purpose;
  mode: Mode;
  maxGridEdge: number;
  samplingMode: "dominant" | "average";
  similarityThreshold: number;
  minRegionSize: number;
  maxColors: number;
  sectionInterval: 5 | 10;
}[] = [
  { purpose: "keychain", mode: "beginner", maxGridEdge: 29, samplingMode: "dominant", similarityThreshold: 18, minRegionSize: 3, maxColors: 10, sectionInterval: 5 },
  { purpose: "keychain", mode: "standard", maxGridEdge: 29, samplingMode: "dominant", similarityThreshold: 12, minRegionSize: 2, maxColors: 18, sectionInterval: 5 },
  { purpose: "keychain", mode: "detail", maxGridEdge: 29, samplingMode: "average", similarityThreshold: 8, minRegionSize: 1, maxColors: 24, sectionInterval: 5 },
  { purpose: "fridge-magnet", mode: "beginner", maxGridEdge: 58, samplingMode: "dominant", similarityThreshold: 18, minRegionSize: 3, maxColors: 12, sectionInterval: 10 },
  { purpose: "fridge-magnet", mode: "standard", maxGridEdge: 58, samplingMode: "dominant", similarityThreshold: 12, minRegionSize: 2, maxColors: 24, sectionInterval: 10 },
  { purpose: "fridge-magnet", mode: "detail", maxGridEdge: 58, samplingMode: "average", similarityThreshold: 8, minRegionSize: 1, maxColors: 36, sectionInterval: 10 },
  { purpose: "stand", mode: "beginner", maxGridEdge: 72, samplingMode: "dominant", similarityThreshold: 18, minRegionSize: 3, maxColors: 15, sectionInterval: 10 },
  { purpose: "stand", mode: "standard", maxGridEdge: 72, samplingMode: "dominant", similarityThreshold: 12, minRegionSize: 2, maxColors: 30, sectionInterval: 10 },
  { purpose: "stand", mode: "detail", maxGridEdge: 72, samplingMode: "average", similarityThreshold: 8, minRegionSize: 1, maxColors: 42, sectionInterval: 10 },
];

describe("resolvePreset", () => {
  it("TC-PRESET-001: 九种组合映射正确", () => {
    for (const row of EXPECTED_TABLE) {
      const preset = resolvePreset(row.purpose, row.mode);
      expect(preset.purpose).toBe(row.purpose);
      expect(preset.mode).toBe(row.mode);
      expect(preset.maxGridEdge).toBe(row.maxGridEdge);
      expect(preset.samplingMode).toBe(row.samplingMode);
      expect(preset.similarityThreshold).toBe(row.similarityThreshold);
      expect(preset.minRegionSize).toBe(row.minRegionSize);
      expect(preset.maxColors).toBe(row.maxColors);
      expect(preset.sectionInterval).toBe(row.sectionInterval);
      expect(preset.paletteId).toBe("MARD");
      expect(preset.backgroundStrategy).toBe("remove-edge-connected");
    }
  });

  it("TC-PRESET-002: 默认组合为冰箱贴 + 标准", () => {
    const preset = resolvePreset();
    expect(preset.purpose).toBe("fridge-magnet");
    expect(preset.mode).toBe("standard");
    expect(preset.maxGridEdge).toBe(58);
    expect(preset.maxColors).toBe(24);
  });

  it("TC-PRESET-003: 未知用途或模式抛出明确错误", () => {
    expect(() => resolvePreset("unknown" as Purpose, "standard")).toThrow(/未知的用途/);
    expect(() => resolvePreset("fridge-magnet", "unknown" as Mode)).toThrow(/未知的模式/);
  });

  it("TC-PRESET-003: UI 文案修改不影响 preset 参数映射", () => {
    // resolvePreset 只依赖 Purpose/Mode key，不依赖显示文案。
    for (const purposeOption of PURPOSE_OPTIONS) {
      for (const modeOption of MODE_OPTIONS) {
        const preset = resolvePreset(purposeOption.value, modeOption.value);
        const expected = EXPECTED_TABLE.find(
          (row) => row.purpose === purposeOption.value && row.mode === modeOption.value
        );
        expect(expected).toBeDefined();
        expect(preset.maxGridEdge).toBe(expected!.maxGridEdge);
        expect(preset.samplingMode).toBe(expected!.samplingMode);
        expect(preset.similarityThreshold).toBe(expected!.similarityThreshold);
        expect(preset.minRegionSize).toBe(expected!.minRegionSize);
        expect(preset.maxColors).toBe(expected!.maxColors);
        expect(preset.sectionInterval).toBe(expected!.sectionInterval);
      }
    }

    // EffectivePreset 中不存在任何 UI 文案字段。
    const preset = resolvePreset(DEFAULT_PRESET_KEYS.purpose, DEFAULT_PRESET_KEYS.mode);
    expect(preset).not.toHaveProperty("label");
    expect(preset).not.toHaveProperty("description");
  });
});
