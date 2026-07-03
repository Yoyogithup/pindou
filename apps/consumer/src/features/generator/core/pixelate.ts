/**
 * 像素化采样。
 *
 * 将 ImageData 按目标网格尺寸采样为 HexGrid。
 * 支持 dominant（中心像素）和 average（区域均值）两种采样模式。
 */

import type { HexGrid, SamplingMode } from "@/features/generator/model/types";
import type { GridSize } from "./calculateGrid";

/**
 * 将 RGB 分量转为 #RRGGBB 大写 HEX。
 */
function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (c: number) => Math.round(c).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

/**
 * dominant 模式（实际为中心像素采样）：取每格中心像素的 HEX。
 *
 * 注意：这里是“中心像素”而非真正的主色统计。对于 V0 用途足够，
 * 后续如需真正 dominant color 应改用聚类算法。
 */
function sampleDominant(imageData: ImageData, grid: GridSize): HexGrid {
  const { width: imgW, height: imgH, data } = imageData;
  const cellW = imgW / grid.width;
  const cellH = imgH / grid.height;

  const result: HexGrid = [];
  for (let gy = 0; gy < grid.height; gy++) {
    const row: (string | null)[] = [];
    for (let gx = 0; gx < grid.width; gx++) {
      const cx = Math.min(Math.floor((gx + 0.5) * cellW), imgW - 1);
      const cy = Math.min(Math.floor((gy + 0.5) * cellH), imgH - 1);
      const idx = (cy * imgW + cx) * 4;
      const a = data[idx + 3];

      // 透明像素视为 null（背景）
      if (a < 128) {
        row.push(null);
      } else {
        row.push(rgbToHex(data[idx], data[idx + 1], data[idx + 2]));
      }
    }
    result.push(row);
  }
  return result;
}

/**
 * average 模式：取每格内所有不透明像素的平均 RGB。
 *
 * 当网格尺寸大于图片时（cellW/cellH < 1），确保每格至少采样一个像素，
 * 避免 xStart===xEnd 或 yStart===yEnd 导致空采样。
 */
function sampleAverage(imageData: ImageData, grid: GridSize): HexGrid {
  const { width: imgW, height: imgH, data } = imageData;
  const cellW = imgW / grid.width;
  const cellH = imgH / grid.height;

  const result: HexGrid = [];
  for (let gy = 0; gy < grid.height; gy++) {
    const row: (string | null)[] = [];
    const yStart = Math.floor(gy * cellH);
    const yEnd = Math.min(Math.max(Math.floor((gy + 1) * cellH), yStart + 1), imgH);

    for (let gx = 0; gx < grid.width; gx++) {
      const xStart = Math.floor(gx * cellW);
      const xEnd = Math.min(Math.max(Math.floor((gx + 1) * cellW), xStart + 1), imgW);

      let rSum = 0;
      let gSum = 0;
      let bSum = 0;
      let count = 0;

      for (let py = yStart; py < yEnd; py++) {
        for (let px = xStart; px < xEnd; px++) {
          const idx = (py * imgW + px) * 4;
          const a = data[idx + 3];
          if (a < 128) continue; // 跳过透明像素
          rSum += data[idx];
          gSum += data[idx + 1];
          bSum += data[idx + 2];
          count++;
        }
      }

      if (count === 0) {
        row.push(null);
      } else {
        row.push(rgbToHex(rSum / count, gSum / count, bSum / count));
      }
    }
    result.push(row);
  }
  return result;
}

/**
 * 将 ImageData 按目标网格采样为 HexGrid。
 *
 * @param imageData 解码后的图片数据
 * @param grid 目标网格尺寸
 * @param mode 采样模式
 * @returns HexGrid
 */
export function pixelate(
  imageData: ImageData,
  grid: GridSize,
  mode: SamplingMode
): HexGrid {
  if (!imageData || imageData.width === 0 || imageData.height === 0) {
    throw new Error("非法 ImageData: 尺寸必须大于零");
  }
  if (grid.width < 1 || grid.height < 1) {
    throw new Error(`非法网格尺寸: ${grid.width}x${grid.height}`);
  }

  switch (mode) {
    case "dominant":
      return sampleDominant(imageData, grid);
    case "average":
      return sampleAverage(imageData, grid);
    default:
      throw new Error(`未知采样模式: ${mode as string}`);
  }
}
