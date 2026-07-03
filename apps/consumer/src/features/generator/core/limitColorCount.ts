/**
 * 颜色数量硬上限处理。
 *
 * 仅处理内存 HEX 网格，null 背景格保持 null。
 * 策略：当网格中不同颜色数超过 maxColors 时，反复移除用量最少的颜色，
 * 将其并入 Oklab 距离最近的保留色（距离使用 0–100 标尺）；距离相同时取 HEX 字典序更小者。
 * 若用量相同，取 HEX 字典序更小者作为被移除对象（稳定 tie-break）。
 */

import type { HexGrid } from "@/features/generator/model/types";
import { hexToOklab, oklabDistance } from "./color";
import { validateRectangularGrid } from "./validateRectangularGrid";

/**
 * 将网格中不同颜色数限制在 maxColors 以内。
 *
 * @param grid HEX 网格
 * @param maxColors 最大颜色数（正整数）
 * @returns 新的 HEX 网格，不修改原始网格
 * @throws maxColors 非法时抛出明确错误
 */
export function limitColorCount(grid: HexGrid, maxColors: number): HexGrid {
  validateRectangularGrid(grid);

  if (!Number.isFinite(maxColors) || maxColors < 1 || !Number.isInteger(maxColors)) {
    throw new Error(`非法最大颜色数: ${maxColors}，必须为大于等于 1 的整数`);
  }

  const distinctColors = new Set<string>();
  for (const row of grid) {
    for (const hex of row) {
      if (hex !== null) {
        distinctColors.add(hex);
      }
    }
  }

  if (distinctColors.size <= maxColors) {
    return grid.map((row) => [...row]);
  }

  const counts = new Map<string, number>();
  for (const row of grid) {
    for (const hex of row) {
      if (hex !== null) {
        counts.set(hex, (counts.get(hex) ?? 0) + 1);
      }
    }
  }

  let remaining = Array.from(distinctColors);
  const mergeMap = new Map<string, string>();

  while (remaining.length > maxColors) {
    // 选择用量最少的颜色作为被合并对象（victim）
    const victim = remaining.reduce((minColor, color) => {
      const minCount = counts.get(minColor) ?? 0;
      const colorCount = counts.get(color) ?? 0;
      if (colorCount < minCount) return color;
      if (colorCount === minCount && color < minColor) return color;
      return minColor;
    });

    const victimLab = hexToOklab(victim);

    // 在剩余颜色（不含 victim）中找 Oklab 距离最近的保留色
    let nearest: string | null = null;
    let nearestDist = Infinity;
    for (const color of remaining) {
      if (color === victim) continue;
      const dist = oklabDistance(victimLab, hexToOklab(color));
      if (dist < nearestDist || (dist === nearestDist && nearest !== null && color < nearest)) {
        nearest = color;
        nearestDist = dist;
      }
    }

    // 正常场景下 nearest 必然存在
    if (nearest === null) {
      break;
    }

    mergeMap.set(victim, nearest);
    counts.set(nearest, (counts.get(nearest) ?? 0) + (counts.get(victim) ?? 0));
    remaining = remaining.filter((c) => c !== victim);
  }

  // 沿着合并链找到最终保留色
  function resolveFinal(color: string): string {
    let current = color;
    while (mergeMap.has(current)) {
      current = mergeMap.get(current)!;
    }
    return current;
  }

  return grid.map((row) =>
    row.map((hex) => {
      if (hex === null) return null;
      return resolveFinal(hex);
    })
  );
}
