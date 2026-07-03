/**
 * HEX 网格内容校验。
 *
 * 在矩形网格校验之后调用，确保所有非 null 单元格均为合法 HEX 颜色。
 *
 * 本函数严格校验格式：必须带 `#` 前缀，仅接受 `#RRGGBB` 或 `#RGB`。
 * 它不负责规范化网格；生产流水线应在进入去背景前统一使用大写 `#RRGGBB`，
 * 避免 `#fff` 与 `#FFF` 等语义等价但字符串不同的颜色被当作不同键。
 */

import type { HexGrid } from "@/features/generator/model/types";
import { normalizeHex } from "./color";

const STRICT_HEX = /^#[0-9A-Fa-f]{6}$|^#[0-9A-Fa-f]{3}$/;

/**
 * 校验 HexGrid 中所有非 null 单元格均为合法 HEX 格式。
 *
 * 要求：必须带 `#` 前缀，仅支持 `#RRGGBB` 或 `#RGB`。
 * 不接受无 `#` 前缀的 `FFFFFF` / `FFF`，也不接受 alpha 通道。
 *
 * @param grid HexGrid
 * @throws 存在非法 HEX 时抛出明确错误，包含坐标信息
 */
export function validateHexGridValues(grid: HexGrid): void {
  for (let y = 0; y < grid.length; y++) {
    const row = grid[y];
    for (let x = 0; x < row.length; x++) {
      const cell = row[x];
      if (cell === null) continue;

      if (!STRICT_HEX.test(cell)) {
        throw new Error(
          `非法 HEX: 第 ${y} 行第 ${x} 列 "${cell}" 不是有效的 #RRGGBB 或 #RGB`
        );
      }

      // 复用 normalizeHex 做最终格式校验（大小写、非法字符等）
      try {
        normalizeHex(cell);
      } catch {
        throw new Error(
          `非法 HEX: 第 ${y} 行第 ${x} 列 "${cell}" 不是有效的 #RRGGBB 或 #RGB`
        );
      }
    }
  }
}
