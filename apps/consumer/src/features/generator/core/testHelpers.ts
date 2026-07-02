import type { HexGrid, PatternCell } from "@/features/generator/model/types";

export function countNonNull(grid: HexGrid): number {
  let count = 0;
  for (const row of grid) {
    for (const cell of row) {
      if (cell !== null) count++;
    }
  }
  return count;
}

export function distinctColors(grid: HexGrid): Set<string> {
  const colors = new Set<string>();
  for (const row of grid) {
    for (const cell of row) {
      if (cell !== null) colors.add(cell);
    }
  }
  return colors;
}

export function cellsFromHexGrid(grid: HexGrid): PatternCell[][] {
  return grid.map((row) => row.map((hex) => ({ hex, code: hex })));
}

/**
 * 生成 n 个在 sRGB 空间中尽量分散的合法 HEX 颜色，用于颜色硬上限测试。
 */
export function generateDistinctHexColors(n: number): string[] {
  const colors: string[] = [];
  const levels = [0x00, 0x20, 0x40, 0x60, 0x80, 0xa0, 0xc0, 0xe0, 0xff];

  for (const r of levels) {
    for (const g of levels) {
      for (const b of levels) {
        if (colors.length >= n) break;
        // 跳过极接近的黑/白/灰，保证颜色差异可辨
        if (r === g && g === b) continue;
        colors.push(
          `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b
            .toString(16)
            .padStart(2, "0")}`.toUpperCase()
        );
      }
      if (colors.length >= n) break;
    }
    if (colors.length >= n) break;
  }

  if (colors.length < n) {
    throw new Error(`无法生成 ${n} 个足够分散的 HEX 颜色`);
  }

  return colors;
}
