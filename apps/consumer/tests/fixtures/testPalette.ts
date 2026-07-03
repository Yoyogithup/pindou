/**
 * ⚠️ TEST_ONLY — 人工定义的测试专用色板
 *
 * 本文件仅用于单元测试，明确标记为 TEST_ONLY，不得冒充完整 MARD 色板，
 * 不得复制 reference-projects/zippland-perler-beads-mobile/ 的 colorSystemMapping.json，
 * 也不得加入任何未经确认的生产色号数据。
 *
 * 颜色选择在 Oklab 空间尽量分散，便于构造稳定、可重复的测试用例。
 */

export interface TestPaletteColor {
  code: string;
  hex: string;
  name?: string;
}

export const TEST_PALETTE: TestPaletteColor[] = [
  { code: "T01", hex: "#FFFFFF", name: "白" },
  { code: "T02", hex: "#000000", name: "黑" },
  { code: "T03", hex: "#FF0000", name: "红" },
  { code: "T04", hex: "#00FF00", name: "绿" },
  { code: "T05", hex: "#0000FF", name: "蓝" },
  { code: "T06", hex: "#FFFF00", name: "黄" },
  { code: "T07", hex: "#FF00FF", name: "品红" },
  { code: "T08", hex: "#00FFFF", name: "青" },
  { code: "T09", hex: "#808080", name: "灰" },
  { code: "T10", hex: "#800000", name: "暗红" },
  { code: "T11", hex: "#008000", name: "暗绿" },
  { code: "T12", hex: "#000080", name: "暗蓝" },
];
