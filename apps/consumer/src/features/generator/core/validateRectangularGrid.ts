/**
 * 矩形网格校验。
 *
 * 用于所有依赖二维坐标遍历的算法入口，确保网格为规则矩形，避免锯齿或 undefined 导致越界/歧义。
 */

import type { HexGrid } from "@/features/generator/model/types";

/**
 * 校验 HEX 网格是否为规则矩形。
 *
 * 规则：
 * - 网格必须是数组；
 * - 空网格 `[]` 是合法矩形；
 * - 第一行必须是数组，否则抛出明确错误（避免原生 TypeError）；
 * - 所有行必须是数组且长度与第一行一致；
 * - 规则矩形零宽网格（如 `[[], []]`）视为合法；
 * - 单元格必须是 `string | null`，不能是 undefined 等其他类型。
 *
 * @param grid HEX 网格
 * @throws 非法网格时抛出明确错误
 */
export function validateRectangularGrid(grid: HexGrid): void {
  if (!Array.isArray(grid)) {
    throw new Error("非法网格: 网格必须是数组");
  }

  const height = grid.length;

  if (height === 0) {
    return;
  }

  const firstRow = grid[0];

  if (!Array.isArray(firstRow)) {
    throw new Error("非法网格: 第 0 行必须是数组");
  }

  const width = firstRow.length;

  for (let y = 0; y < height; y++) {
    const row = grid[y];

    if (!Array.isArray(row)) {
      throw new Error(`非法网格: 第 ${y} 行必须是数组`);
    }

    if (row.length !== width) {
      throw new Error(
        `非法网格: 第 ${y} 行长度 ${row.length} 与第一行长度 ${width} 不一致`
      );
    }

    for (let x = 0; x < width; x++) {
      const cell = row[x];
      if (cell !== null && typeof cell !== "string") {
        throw new Error(`非法网格: 第 ${y} 行第 ${x} 列单元格既不是 null 也不是字符串`);
      }
    }
  }
}
