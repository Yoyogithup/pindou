/**
 * 开发阶段色板（标记为开发数据）。
 *
 * ⚠️ 此文件仅为开发阶段使用，包含人工选择的分散颜色用于验证管线。
 * 发布前必须替换为完整、可追溯来源的 MARD 色号—HEX 数据，
 * 并在 UI 明确标记"开发数据"。
 *
 * 不得从 reference-projects/ 复制 colorSystemMapping.json。
 */

import type { PaletteColor } from "@/features/generator/model/types";

/** 开发阶段色板：40 个在 Oklab 空间中分散的颜色 */
export const DEV_PALETTE: PaletteColor[] = [
  { code: "M01", hex: "#FFFFFF" },
  { code: "M02", hex: "#000000" },
  { code: "M03", hex: "#FF0000" },
  { code: "M04", hex: "#00FF00" },
  { code: "M05", hex: "#0000FF" },
  { code: "M06", hex: "#FFFF00" },
  { code: "M07", hex: "#FF00FF" },
  { code: "M08", hex: "#00FFFF" },
  { code: "M09", hex: "#808080" },
  { code: "M10", hex: "#C0C0C0" },
  { code: "M11", hex: "#800000" },
  { code: "M12", hex: "#008000" },
  { code: "M13", hex: "#000080" },
  { code: "M14", hex: "#808000" },
  { code: "M15", hex: "#800080" },
  { code: "M16", hex: "#008080" },
  { code: "M17", hex: "#FF8000" },
  { code: "M18", hex: "#80FF00" },
  { code: "M19", hex: "#0080FF" },
  { code: "M20", hex: "#FF0080" },
  { code: "M21", hex: "#804000" },
  { code: "M22", hex: "#408000" },
  { code: "M23", hex: "#004080" },
  { code: "M24", hex: "#400080" },
  { code: "M25", hex: "#FF4040" },
  { code: "M26", hex: "#40FF40" },
  { code: "M27", hex: "#4040FF" },
  { code: "M28", hex: "#FFCC00" },
  { code: "M29", hex: "#CC00FF" },
  { code: "M30", hex: "#00FFCC" },
  { code: "M31", hex: "#FF8080" },
  { code: "M32", hex: "#80FF80" },
  { code: "M33", hex: "#8080FF" },
  { code: "M34", hex: "#404040" },
  { code: "M35", hex: "#B0B0B0" },
  { code: "M36", hex: "#FF6600" },
  { code: "M37", hex: "#6600FF" },
  { code: "M38", hex: "#00FF66" },
  { code: "M39", hex: "#CC6633" },
  { code: "M40", hex: "#3366CC" },
];

/** 色板是否已验证为生产数据 */
export const IS_PRODUCTION_PALETTE = false;
