import type { EffectivePreset, Mode, Purpose } from "./types";

/**
 * 九组用途 × 模式参数表。
 *
 * 来源：docs/technical_plan_v0.md 第 5 节。
 * 这些参数是首轮校准基线，后续需用样图验收，调整必须附对比记录。
 */
export const PRESET_TABLE: Record<
  Purpose,
  Record<
    Mode,
    Omit<EffectivePreset, "purpose" | "mode" | "paletteId" | "backgroundStrategy">
  >
> = {
  keychain: {
    beginner: {
      maxGridEdge: 29,
      samplingMode: "dominant",
      similarityThreshold: 18,
      minRegionSize: 3,
      maxColors: 10,
      sectionInterval: 5,
    },
    standard: {
      maxGridEdge: 29,
      samplingMode: "dominant",
      similarityThreshold: 12,
      minRegionSize: 2,
      maxColors: 18,
      sectionInterval: 5,
    },
    detail: {
      maxGridEdge: 29,
      samplingMode: "average",
      similarityThreshold: 8,
      minRegionSize: 1,
      maxColors: 24,
      sectionInterval: 5,
    },
  },
  "fridge-magnet": {
    beginner: {
      maxGridEdge: 58,
      samplingMode: "dominant",
      similarityThreshold: 18,
      minRegionSize: 3,
      maxColors: 12,
      sectionInterval: 10,
    },
    standard: {
      maxGridEdge: 58,
      samplingMode: "dominant",
      similarityThreshold: 12,
      minRegionSize: 2,
      maxColors: 24,
      sectionInterval: 10,
    },
    detail: {
      maxGridEdge: 58,
      samplingMode: "average",
      similarityThreshold: 8,
      minRegionSize: 1,
      maxColors: 36,
      sectionInterval: 10,
    },
  },
  stand: {
    beginner: {
      maxGridEdge: 72,
      samplingMode: "dominant",
      similarityThreshold: 18,
      minRegionSize: 3,
      maxColors: 15,
      sectionInterval: 10,
    },
    standard: {
      maxGridEdge: 72,
      samplingMode: "dominant",
      similarityThreshold: 12,
      minRegionSize: 2,
      maxColors: 30,
      sectionInterval: 10,
    },
    detail: {
      maxGridEdge: 72,
      samplingMode: "average",
      similarityThreshold: 8,
      minRegionSize: 1,
      maxColors: 42,
      sectionInterval: 10,
    },
  },
};

/** 默认选择：冰箱贴 + 标准 */
export const DEFAULT_PRESET_KEYS: { purpose: Purpose; mode: Mode } = {
  purpose: "fridge-magnet",
  mode: "standard",
};

/** 页面显示文案，与算法参数解耦 */
export const PURPOSE_OPTIONS: { value: Purpose; label: string; description: string }[] =
  [
    { value: "keychain", label: "挂件", description: "小小一只，好拼好带走" },
    { value: "fridge-magnet", label: "冰箱贴", description: "清晰度和难度刚刚好" },
    { value: "stand", label: "摆件", description: "细节更多，适合认真拼" },
  ];

export const MODE_OPTIONS: { value: Mode; label: string; description: string }[] = [
  { value: "beginner", label: "新手友好", description: "颜色更少，更好拼" },
  { value: "standard", label: "标准清晰", description: "效果和难度比较平衡" },
  { value: "detail", label: "细节还原", description: "更像原图，但会更复杂" },
];
