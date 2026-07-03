/**
 * 颜色基础能力（纯函数）。
 *
 * 实现：
 * - HEX 格式校验与标准化
 * - sRGB → 线性 RGB → XYZ → Oklab
 * - Oklab 欧氏距离
 * - 最近色匹配（tie-break：色号 code 字典序更小者优先）
 * - HEX 网格 → 色板网格映射
 *
 * 颜色空间转换依据公开公式：
 * - Björn Ottosson, "A perceptual color space for image processing" (2020)
 *   https://bottosson.github.io/posts/oklab/
 * - sRGB 反 gamma 与 XYZ 转换矩阵参考 CSS Color Module Level 4。
 */

import type { HexGrid, PatternCell, PaletteColor } from "@/features/generator/model/types";
import { validateRectangularGrid } from "./validateRectangularGrid";

/** Oklab 颜色空间坐标 */
export interface Oklab {
  L: number;
  a: number;
  b: number;
}

const HEX_6 = /^#?([0-9A-Fa-f]{6})$/;
const HEX_3 = /^#?([0-9A-Fa-f]{3})$/;

/**
 * 校验并标准化 HEX 字符串为 #RRGGBB（大写）。
 *
 * 支持 #RRGGBB 与简写 #RGB，不接受带 alpha 的格式。
 * @throws 格式非法时抛出明确错误
 */
export function normalizeHex(hex: string): string {
  const trimmed = hex.trim();

  const match6 = trimmed.match(HEX_6);
  if (match6) {
    return `#${match6[1].toUpperCase()}`;
  }

  const match3 = trimmed.match(HEX_3);
  if (match3) {
    const [r, g, b] = match3[1].split("").map((c) => c + c);
    return `#${r.toUpperCase()}${g.toUpperCase()}${b.toUpperCase()}`;
  }

  throw new Error(`非法 HEX 格式: "${hex}"，仅支持 #RRGGBB 或 #RGB`);
}

/**
 * 将标准化 HEX 拆分为 0–1 范围的 sRGB 分量。
 */
export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const normalized = normalizeHex(hex);
  const raw = normalized.slice(1);
  return {
    r: parseInt(raw.slice(0, 2), 16) / 255,
    g: parseInt(raw.slice(2, 4), 16) / 255,
    b: parseInt(raw.slice(4, 6), 16) / 255,
  };
}

/**
 * sRGB 分量反 gamma 校正到线性 RGB。
 */
export function srgbToLinear(c: number): number {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

/**
 * 将 HEX 颜色转换为 Oklab。
 *
 * 转换路径：sRGB → 线性 RGB → XYZ(D65) → LMS → 立方根 → Oklab。
 */
export function hexToOklab(hex: string): Oklab {
  const { r, g, b } = hexToRgb(hex);

  const lr = srgbToLinear(r);
  const lg = srgbToLinear(g);
  const lb = srgbToLinear(b);

  // sRGB → XYZ (D65)
  const x = 0.412_456_4 * lr + 0.357_576_1 * lg + 0.180_437_5 * lb;
  const y = 0.212_672_9 * lr + 0.715_152_2 * lg + 0.072_175_0 * lb;
  const z = 0.019_333_9 * lr + 0.119_192_0 * lg + 0.950_304_1 * lb;

  // XYZ → LMS
  const lmsX = 0.818_933_010_1 * x + 0.361_866_742_4 * y - 0.128_859_713_7 * z;
  const lmsY = 0.032_984_543_6 * x + 0.929_311_871_5 * y + 0.036_145_638_7 * z;
  const lmsZ = 0.048_200_601_8 * x + 0.264_366_269_1 * y + 0.633_851_707_0 * z;

  const lmsX_ = Math.cbrt(lmsX);
  const lmsY_ = Math.cbrt(lmsY);
  const lmsZ_ = Math.cbrt(lmsZ);

  // LMS → Oklab
  return {
    L: 0.210_454_255_3 * lmsX_ + 0.793_617_785_0 * lmsY_ - 0.004_072_046_8 * lmsZ_,
    a: 1.977_998_495_1 * lmsX_ - 2.428_592_205_0 * lmsY_ + 0.450_593_709_9 * lmsZ_,
    b: 0.025_904_037_1 * lmsX_ + 0.782_771_766_2 * lmsY_ - 0.808_675_766_0 * lmsZ_,
  };
}

/**
 * 计算两个 Oklab 颜色之间的欧氏距离，结果统一放大到 0–100 标尺。
 *
 * 说明：原始 Oklab 坐标的 L 约为 0–1，a/b 约为 ±0.4，原始欧氏距离通常落在 0–1 区间。
 * 为与 preset 阈值 14/24/32 对齐，此处返回原始距离 × 100，使阈值可直接使用。
 */
export function oklabDistance(a: Oklab, b: Oklab): number {
  const dL = a.L - b.L;
  const da = a.a - b.a;
  const db = a.b - b.b;
  return Math.sqrt(dL * dL + da * da + db * db) * 100;
}

/**
 * 在色板中查找与目标 HEX 最近的颜色。
 *
 * tie-break：距离相等时，返回 code 字典序更小的条目（稳定、可重复）。
 *
 * @throws 色板为空时抛出明确错误
 */
export function findNearestColor(
  hex: string,
  palette: Pick<PaletteColor, "code" | "hex">[]
): Pick<PaletteColor, "code" | "hex"> {
  if (palette.length === 0) {
    throw new Error("色板为空，无法匹配最近色");
  }

  const target = hexToOklab(hex);

  let best = palette[0];
  let bestDist = oklabDistance(target, hexToOklab(best.hex));

  for (let i = 1; i < palette.length; i++) {
    const color = palette[i];
    const dist = oklabDistance(target, hexToOklab(color.hex));
    if (dist < bestDist || (dist === bestDist && color.code < best.code)) {
      best = color;
      bestDist = dist;
    }
  }

  return best;
}

/**
 * 将 HEX 网格映射到指定色板，输出 PatternCell 网格。
 *
 * null 格保持为 null。
 */
export function mapHexGridToPalette(
  grid: HexGrid,
  palette: Pick<PaletteColor, "code" | "hex">[]
): PatternCell[][] {
  validateRectangularGrid(grid);

  return grid.map((row) =>
    row.map((hex): PatternCell => {
      if (hex === null) {
        return { hex: null, code: null };
      }
      const matched = findNearestColor(hex, palette);
      return { hex: matched.hex, code: matched.code };
    })
  );
}
