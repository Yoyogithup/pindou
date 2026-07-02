/**
 * 相似色合并。
 *
 * 仅处理内存 HEX 网格，null 背景格保持 null。
 * 策略：按颜色出现次数降序处理，将每种颜色合并到出现次数更多且 Oklab 距离小于阈值的保留色中；
 * 若存在多个可选保留色，取距离最小者；距离仍相同则取 HEX 字典序更小者（稳定 tie-break）。
 */

import type { HexGrid } from "@/features/generator/model/types";
import { hexToOklab, oklabDistance } from "./color";
import { validateRectangularGrid } from "./validateRectangularGrid";

/**
 * 合并 Oklab 距离小于 threshold 的相似颜色。
 *
 * @param grid HEX 网格
 * @param threshold Oklab 相似阈值（非负数，0–100 标尺，与 preset 阈值 14/24/32 对齐）
 * @returns 新的 HEX 网格，不修改原始网格
 * @throws threshold 非有限或负数时抛出明确错误
 */
export function mergeSimilarColors(grid: HexGrid, threshold: number): HexGrid {
  validateRectangularGrid(grid);

  if (!Number.isFinite(threshold) || threshold < 0) {
    throw new Error(`非法相似阈值: ${threshold}，必须为非负有限数`);
  }

  const counts = new Map<string, number>();
  for (const row of grid) {
    for (const hex of row) {
      if (hex !== null) {
        counts.set(hex, (counts.get(hex) ?? 0) + 1);
      }
    }
  }

  if (counts.size === 0) {
    return grid.map((row) => [...row]);
  }

  // 按 count 降序、HEX 字典序升序排序，保证处理顺序稳定
  const colors = Array.from(counts.keys()).sort((a, b) => {
    const diff = counts.get(b)! - counts.get(a)!;
    if (diff !== 0) return diff;
    return a < b ? -1 : a > b ? 1 : 0;
  });

  const mergeMap = new Map<string, string>();
  const kept: string[] = [];

  for (const color of colors) {
    const colorLab = hexToOklab(color);
    let nearest: string | null = null;
    let nearestDist = Infinity;

    for (const keeper of kept) {
      const dist = oklabDistance(colorLab, hexToOklab(keeper));
      if (dist < threshold) {
        if (dist < nearestDist || (dist === nearestDist && keeper < nearest!)) {
          nearest = keeper;
          nearestDist = dist;
        }
      }
    }

    if (nearest !== null) {
      mergeMap.set(color, nearest);
    } else {
      kept.push(color);
    }
  }

  return grid.map((row) => row.map((hex) => (hex === null ? null : mergeMap.get(hex) ?? hex)));
}
