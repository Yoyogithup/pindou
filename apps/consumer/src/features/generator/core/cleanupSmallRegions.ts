/**
 * 清理小于 minRegionSize 的连通色块（杂色处理）。
 *
 * 仅处理内存 HEX 网格，null 背景格保持 null。
 * 连通规则：四方向相邻（上、下、左、右）。
 * 小区域替换规则：取该区域四邻域中出现次数最多的非 null 颜色；
 * 若存在多个颜色次数相同，取 HEX 字典序更小者（稳定 tie-break）。
 */

import type { HexGrid } from "@/features/generator/model/types";
import { validateRectangularGrid } from "./validateRectangularGrid";

type CellCoord = { x: number; y: number };

const DIRECTIONS = [
  { dx: 0, dy: 1 },
  { dx: 1, dy: 0 },
  { dx: 0, dy: -1 },
  { dx: -1, dy: 0 },
];

/**
 * 清理面积小于 minRegionSize 的连通区域。
 *
 * @param grid HEX 网格
 * @param minRegionSize 最小连通色块尺寸（正整数，格）
 * @returns 新的 HEX 网格，不修改原始网格
 * @throws minRegionSize 非法时抛出明确错误
 */
export function cleanupSmallRegions(grid: HexGrid, minRegionSize: number): HexGrid {
  validateRectangularGrid(grid);

  if (!Number.isFinite(minRegionSize) || minRegionSize < 1 || !Number.isInteger(minRegionSize)) {
    throw new Error(`非法最小色块尺寸: ${minRegionSize}，必须为大于等于 1 的整数`);
  }

  const height = grid.length;
  if (height === 0) {
    return [];
  }
  const width = grid[0].length;

  const result: HexGrid = grid.map((row) => [...row]);
  const visited: boolean[][] = Array.from({ length: height }, () => Array(width).fill(false));

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (visited[y][x] || result[y][x] === null) {
        continue;
      }

      const color = result[y][x];
      const region: CellCoord[] = [];
      const queue: CellCoord[] = [{ x, y }];
      visited[y][x] = true;

      for (let head = 0; head < queue.length; head++) {
        const current = queue[head];
        region.push(current);

        for (const { dx, dy } of DIRECTIONS) {
          const nx = current.x + dx;
          const ny = current.y + dy;
          if (
            nx >= 0 &&
            nx < width &&
            ny >= 0 &&
            ny < height &&
            !visited[ny][nx] &&
            result[ny][nx] === color
          ) {
            visited[ny][nx] = true;
            queue.push({ x: nx, y: ny });
          }
        }
      }

      if (region.length < minRegionSize) {
        const replacement = findReplacement(result, region, color);
        if (replacement !== null) {
          for (const { x: rx, y: ry } of region) {
            result[ry][rx] = replacement;
          }
        }
      }
    }
  }

  return result;
}

function findReplacement(
  grid: HexGrid,
  region: CellCoord[],
  originalColor: string | null
): string | null {
  const height = grid.length;
  const width = grid[0]?.length ?? 0;

  const neighborCounts = new Map<string, number>();

  for (const { x, y } of region) {
    for (const { dx, dy } of DIRECTIONS) {
      const nx = x + dx;
      const ny = y + dy;
      if (
        nx >= 0 &&
        nx < width &&
        ny >= 0 &&
        ny < height
      ) {
        const neighbor = grid[ny][nx];
        if (neighbor !== null && neighbor !== originalColor) {
          neighborCounts.set(neighbor, (neighborCounts.get(neighbor) ?? 0) + 1);
        }
      }
    }
  }

  if (neighborCounts.size === 0) {
    return null;
  }

  const sorted = Array.from(neighborCounts.entries()).sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1];
    return a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0;
  });

  return sorted[0][0];
}
