/**
 * 生成管线编排。
 *
 * 管线拆为准备（preparePattern）与收口（finalizePattern）两段：
 *
 * preparePattern:
 *   validatePalette → calculateGrid → pixelate → mapToPaletteHex
 *   → mergeSimilarColors → cleanupSmallRegions → limitColorCount
 *   → autoRemoveBackground
 *   返回 PreparedPattern（含 limitedGrid、backgroundResult、gridSize）
 *
 * finalizePattern:
 *   hexGrid → hexGridToPatternCells → calculateUsage → PatternDocument
 *   将任意 HexGrid 收口为最终文档。
 *
 * 当自动去背景成功（requiresUserSelection=false）时，
 * 直接用 backgroundResult.grid 调用 finalize 并渲染两张 PNG。
 *
 * 当 requiresUserSelection=true 时，状态机进入 backgroundSelection，
 * 页面展示可点击网格预览，用户点选后调用 removeBackgroundFromSelection，
 * 然后重新 finalize 并渲染。
 */

import type {
  EffectivePreset,
  HexGrid,
  PaletteColor,
  PatternCell,
  PatternDocument,
} from "@/features/generator/model/types";
import type { BackgroundRemovalResult } from "./backgroundRemoval";
import { calculateGrid, type GridSize } from "./calculateGrid";
import { pixelate } from "./pixelate";
import { findNearestColor } from "./color";
import { mergeSimilarColors } from "./mergeSimilarColors";
import { cleanupSmallRegions } from "./cleanupSmallRegions";
import { limitColorCount } from "./limitColorCount";
import { autoRemoveBackground } from "./backgroundRemoval";
import { calculateUsage } from "./calculateUsage";
import { validateRectangularGrid } from "./validateRectangularGrid";
import { validatePalette } from "./validatePalette";

/**
 * 准备阶段输出：算法管线跑完（含自动去背景），
 * 但尚未收口为 PatternDocument。
 */
export interface PreparedPattern {
  gridSize: GridSize;
  /** 去背景前的网格（用于用户点选背景） */
  limitedGrid: HexGrid;
  /** 自动去背景结果（可能成功或需要用户选择） */
  backgroundResult: BackgroundRemovalResult;
  /** 是否需要用户点选背景 */
  requiresBackgroundSelection: boolean;
  preset: EffectivePreset;
  palette: PaletteColor[];
}

/**
 * 将 HexGrid 中每个非 null hex 映射到色板中最近颜色的 hex。
 * 输出仍为 HexGrid（仅 hex 字符串），不含 code。
 */
function mapGridToPaletteHex(
  grid: HexGrid,
  palette: Pick<PaletteColor, "code" | "hex">[]
): HexGrid {
  validateRectangularGrid(grid);
  return grid.map((row) =>
    row.map((hex): string | null => {
      if (hex === null) return null;
      return findNearestColor(hex, palette).hex;
    })
  );
}

/**
 * 将 HexGrid 转换为 PatternCell[][]（保留 hex 和 code 的配对关系）。
 *
 * 色板已经过 validatePalette 校验，hex → code 为一对一关系。
 */
export function hexGridToPatternCells(
  hexGrid: HexGrid,
  palette: PaletteColor[]
): PatternCell[][] {
  const hexToCode = new Map<string, string>();
  for (const color of palette) {
    hexToCode.set(color.hex, color.code);
  }

  return hexGrid.map((row) =>
    row.map((hex): PatternCell => {
      if (hex === null) {
        return { hex: null, code: null };
      }
      return { hex, code: hexToCode.get(hex) ?? null };
    })
  );
}

/**
 * 准备阶段：运行算法管线（不含收口和 PNG 渲染）。
 *
 * @param imageData 解码后的图片数据
 * @param preset 已解析的 preset 参数
 * @param palette 色板数据
 * @returns PreparedPattern
 */
export function preparePattern(
  imageData: ImageData,
  preset: EffectivePreset,
  palette: PaletteColor[]
): PreparedPattern {
  if (!imageData || imageData.width === 0 || imageData.height === 0) {
    throw new Error("非法 ImageData: 尺寸必须大于零");
  }

  // 入口校验色板
  const validatedPalette = validatePalette(palette, preset);

  // 1. 计算网格尺寸
  const gridSize = calculateGrid(imageData.width, imageData.height, preset.maxGridEdge);

  // 2. 像素化采样 → HexGrid
  const rawGrid = pixelate(imageData, gridSize, preset.samplingMode);

  // 3. 映射到色板
  const paletteGrid = mapGridToPaletteHex(rawGrid, validatedPalette);

  // 4. 相似色合并
  const mergedGrid = mergeSimilarColors(paletteGrid, preset.similarityThreshold);

  // 5. 小区域清理
  const cleanedGrid = cleanupSmallRegions(mergedGrid, preset.minRegionSize);

  // 6. 颜色硬上限
  const limitedGrid = limitColorCount(cleanedGrid, preset.maxColors);

  // 7. 自动去背景
  const bgResult = autoRemoveBackground(limitedGrid);

  return {
    gridSize,
    limitedGrid,
    backgroundResult: bgResult,
    requiresBackgroundSelection: bgResult.requiresUserSelection,
    preset,
    palette: validatedPalette,
  };
}

/**
 * 收口阶段：将 HexGrid 转换为 PatternDocument。
 *
 * @param hexGrid 最终 HexGrid（背景已处理）
 * @param gridSize 网格尺寸
 * @param preset 已解析的 preset 参数
 * @param palette 已校验的色板
 * @returns PatternDocument
 */
export function finalizePattern(
  hexGrid: HexGrid,
  gridSize: GridSize,
  preset: EffectivePreset,
  palette: PaletteColor[]
): PatternDocument {
  validateRectangularGrid(hexGrid);

  // 转换为 PatternCell（hex + code 配对）
  const cells = hexGridToPatternCells(hexGrid, palette);

  // 唯一一次用量统计
  const { usage, totalBeads } = calculateUsage(cells);

  return {
    version: 1,
    width: gridSize.width,
    height: gridSize.height,
    cells,
    paletteId: "MARD",
    usage,
    totalBeads,
    preset,
  };
}
