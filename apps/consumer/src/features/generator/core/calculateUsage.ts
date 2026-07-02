/**
 * 用量统计。
 *
 * 输入 PatternCell 网格，按色号统计非 null 格数量，
 * 输出稳定自然排序的用量数组与 totalBeads。
 *
 * 不变量：
 * - totalBeads 等于所有非 null 单元格数；
 * - totalBeads 等于 sum(usage.count)；
 * - 不生成或推测颜色名称。
 */

import type { ColorUsage, PatternCell } from "@/features/generator/model/types";

export interface UsageResult {
  usage: ColorUsage[];
  totalBeads: number;
}

/**
 * 按色号自然排序（例如 A2 排在 A10 之前）。
 */
function naturalCompare(a: string, b: string): number {
  const regex = /(\d+)|(\D+)/g;
  const partsA = a.match(regex) ?? [];
  const partsB = b.match(regex) ?? [];

  for (let i = 0; i < Math.min(partsA.length, partsB.length); i++) {
    const pa = partsA[i];
    const pb = partsB[i];
    const numA = parseInt(pa, 10);
    const numB = parseInt(pb, 10);

    if (!Number.isNaN(numA) && !Number.isNaN(numB) && numA !== numB) {
      return numA - numB;
    }

    if (pa !== pb) {
      return pa < pb ? -1 : 1;
    }
  }

  return partsA.length - partsB.length;
}

/**
 * 校验 PatternCell 的 hex/code 一致性，以及同一 code 是否对应唯一 HEX。
 */
function validateCells(cells: PatternCell[][]): void {
  const codeToHex = new Map<string, string>();

  for (let y = 0; y < cells.length; y++) {
    const row = cells[y];
    for (let x = 0; x < row.length; x++) {
      const cell = row[x];
      const hasHex = cell.hex !== null;
      const hasCode = cell.code !== null;

      if (hasHex !== hasCode) {
        throw new Error(
          `非法 PatternCell: 第 ${y} 行第 ${x} 列 hex 与 code 必须同时为空或同时有值`
        );
      }

      if (hasHex && hasCode) {
        const existingHex = codeToHex.get(cell.code!);
        if (existingHex !== undefined && existingHex !== cell.hex) {
          throw new Error(
            `非法 PatternCell: 色号 ${cell.code} 对应多个不同 HEX（${existingHex} 与 ${cell.hex}）`
          );
        }
        codeToHex.set(cell.code!, cell.hex!);
      }
    }
  }
}

/**
 * 计算 PatternCell 网格的颜色用量。
 *
 * @param cells PatternCell 网格
 * @returns 用量数组与总豆数
 * @throws PatternCell hex/code 不一致或同一 code 对应多个 HEX 时抛出明确错误
 */
export function calculateUsage(cells: PatternCell[][]): UsageResult {
  validateCells(cells);

  const counts = new Map<string, ColorUsage>();
  let totalBeads = 0;

  for (const row of cells) {
    for (const cell of row) {
      if (cell.hex === null || cell.code === null) {
        continue;
      }

      totalBeads++;
      const existing = counts.get(cell.code);
      if (existing) {
        existing.count++;
      } else {
        counts.set(cell.code, {
          hex: cell.hex,
          code: cell.code,
          count: 1,
        });
      }
    }
  }

  const usage = Array.from(counts.values()).sort((a, b) => naturalCompare(a.code, b.code));

  return { usage, totalBeads };
}
