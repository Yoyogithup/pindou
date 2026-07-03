/**
 * V0 去背景纯算法。
 *
 * 仅处理内存 HexGrid，不依赖 Canvas、File、ImageData 或浏览器 API。
 * 规则：
 * - 只分析四条边界，寻找高覆盖、多触达边/角的背景候选色；
 * - 只删除与边界连通且在阈值内的背景色格子；
 * - 主体内部与背景同色但不连通的区域保留；
 * - 自动删除采用保守安全策略，误删主体宁可要求用户点选；
 * - 低置信度或安全规则拦截时返回原网格副本。
 */

import type { HexGrid } from "@/features/generator/model/types";
import { hexToOklab, normalizeHex, oklabDistance } from "./color";
import {
  DEFAULT_BACKGROUND_REMOVAL_CONFIG,
  type BackgroundRemovalConfig,
} from "./backgroundRemovalConfig";
import { validateRectangularGrid } from "./validateRectangularGrid";
import { validateHexGridValues } from "./validateHexGridValues";

type Side = "top" | "bottom" | "left" | "right";
type Corner = "tl" | "tr" | "bl" | "br";

interface BorderCell {
  x: number;
  y: number;
  hex: string;
  sides: Side[];
  corners: Corner[];
}

interface ColorCluster {
  colors: string[];
  representative: string;
}

export interface BackgroundDetection {
  /** 候选背景色 HEX，null 表示无候选 */
  candidateHex: string | null;
  /** 候选色所在近似聚类在边缘非 null 格中的覆盖率（0–1） */
  borderCoverage: number;
  /** 候选代表色实际触达的边数（1–4），不是整个聚类 */
  representativeTouchedSides: number;
  /** 候选代表色实际触达的角数（0–4），不是整个聚类 */
  touchedCorners: number;
  /** 是否达到自动删除置信度 */
  confident: boolean;
  /** 检测结论说明 */
  reason: string;
}

export interface BackgroundRemovalResult {
  /** 处理后的 HexGrid */
  grid: HexGrid;
  /** 删除的背景格数量 */
  removedCount: number;
  /** 是否需要用户点选背景重试 */
  requiresUserSelection: boolean;
  /** 背景检测信息（可选） */
  detection?: BackgroundDetection;
  /** 自动删除是否通过安全检查 */
  autoRemovalSafe?: boolean;
  /** 删除格数占非 null 总格数的比例（0–1） */
  removalRatio?: number;
}

export interface BackgroundDetectionOptions {
  config?: Partial<BackgroundRemovalConfig>;
}

export interface BackgroundRemovalOptions {
  config?: Partial<BackgroundRemovalConfig>;
}

const DIRECTIONS = [
  { dx: 0, dy: 1 },
  { dx: 1, dy: 0 },
  { dx: 0, dy: -1 },
  { dx: -1, dy: 0 },
];

function mergeConfig(
  partial?: Partial<BackgroundRemovalConfig>
): BackgroundRemovalConfig {
  return {
    ...DEFAULT_BACKGROUND_REMOVAL_CONFIG,
    ...partial,
  };
}

function validateConfig(config: BackgroundRemovalConfig): void {
  const t = config.backgroundDistanceThreshold;
  if (!Number.isFinite(t) || t < 0) {
    throw new Error(`非法 backgroundDistanceThreshold: ${t}，必须为非负有限数`);
  }

  const c = config.minBorderCoverage;
  if (!Number.isFinite(c) || c < 0 || c > 1) {
    throw new Error(`非法 minBorderCoverage: ${c}，必须在 [0, 1] 区间`);
  }

  const s = config.minTouchedSides;
  if (!Number.isInteger(s) || s < 0 || s > 4) {
    throw new Error(`非法 minTouchedSides: ${s}，必须为 0–4 的整数`);
  }

  const corner = config.minTouchedCorners;
  if (!Number.isInteger(corner) || corner < 0 || corner > 4) {
    throw new Error(`非法 minTouchedCorners: ${corner}，必须为 0–4 的整数`);
  }

  const ratio = config.maxAutoRemovalRatio;
  if (!Number.isFinite(ratio) || ratio < 0 || ratio > 1) {
    throw new Error(`非法 maxAutoRemovalRatio: ${ratio}，必须在 [0, 1] 区间`);
  }
}

function validateBackgroundHex(backgroundHex: string): void {
  normalizeHex(backgroundHex);
}

function getSides(x: number, y: number, width: number, height: number): Side[] {
  const sides: Side[] = [];
  if (y === 0) sides.push("top");
  if (y === height - 1) sides.push("bottom");
  if (x === 0) sides.push("left");
  if (x === width - 1) sides.push("right");
  return sides;
}

function getCorners(x: number, y: number, width: number, height: number): Corner[] {
  const corners: Corner[] = [];
  const isTop = y === 0;
  const isBottom = y === height - 1;
  const isLeft = x === 0;
  const isRight = x === width - 1;
  if (isTop && isLeft) corners.push("tl");
  if (isTop && isRight) corners.push("tr");
  if (isBottom && isLeft) corners.push("bl");
  if (isBottom && isRight) corners.push("br");
  return corners;
}

function collectBorderCells(grid: HexGrid): BorderCell[] {
  const height = grid.length;
  if (height === 0) return [];
  const width = grid[0].length;
  if (width === 0) return [];

  const cells: BorderCell[] = [];

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (x !== 0 && x !== width - 1 && y !== 0 && y !== height - 1) {
        continue;
      }
      const hex = grid[y][x];
      if (hex === null) continue;
      cells.push({
        x,
        y,
        hex,
        sides: getSides(x, y, width, height),
        corners: getCorners(x, y, width, height),
      });
    }
  }

  return cells;
}

function clusterBorderColors(
  colors: string[],
  threshold: number
): ColorCluster[] {
  if (colors.length === 0) return [];

  const clusters: ColorCluster[] = [];

  for (const color of colors) {
    let nearestIndex = -1;
    let nearestDist = Infinity;

    for (let i = 0; i < clusters.length; i++) {
      const dist = oklabDistance(hexToOklab(color), hexToOklab(clusters[i].representative));
      if (dist <= threshold) {
        if (
          dist < nearestDist ||
          (dist === nearestDist && clusters[i].representative < clusters[nearestIndex]?.representative)
        ) {
          nearestIndex = i;
          nearestDist = dist;
        }
      }
    }

    if (nearestIndex >= 0) {
      clusters[nearestIndex].colors.push(color);
    } else {
      clusters.push({ colors: [color], representative: color });
    }
  }

  return clusters;
}

function pickRepresentative(cluster: ColorCluster, counts: Map<string, number>): string {
  return cluster.colors.reduce((best, color) => {
    const bestCount = counts.get(best) ?? 0;
    const colorCount = counts.get(color) ?? 0;
    if (colorCount > bestCount) return color;
    if (colorCount === bestCount && color < best) return color;
    return best;
  });
}

function emptyDetection(reason: string): BackgroundDetection {
  return {
    candidateHex: null,
    borderCoverage: 0,
    representativeTouchedSides: 0,
    touchedCorners: 0,
    confident: false,
    reason,
  };
}

function buildDetection(
  representative: string,
  cluster: ColorCluster,
  colorCounts: Map<string, number>,
  colorSides: Map<string, Set<Side>>,
  colorCorners: Map<string, Set<Corner>>,
  nonNullBorderCount: number,
  config: BackgroundRemovalConfig
): BackgroundDetection {
  let clusterCount = 0;
  const clusterSides = new Set<Side>();
  const clusterCorners = new Set<Corner>();

  for (const color of cluster.colors) {
    clusterCount += colorCounts.get(color) ?? 0;
    const sides = colorSides.get(color) ?? new Set<Side>();
    for (const side of sides) clusterSides.add(side);
    const corners = colorCorners.get(color) ?? new Set<Corner>();
    for (const corner of corners) clusterCorners.add(corner);
  }

  // 代表色本身的边/角证据（防止背景与近色主体合并后共同凑够置信度）
  const representativeSides = colorSides.get(representative) ?? new Set<Side>();
  const representativeCorners = colorCorners.get(representative) ?? new Set<Corner>();

  const borderCoverage = clusterCount / nonNullBorderCount;
  const representativeTouchedSides = representativeSides.size;
  const touchedCorners = representativeCorners.size;

  const confident =
    borderCoverage >= config.minBorderCoverage &&
    representativeTouchedSides >= config.minTouchedSides &&
    touchedCorners >= config.minTouchedCorners;

  return {
    candidateHex: representative,
    borderCoverage,
    representativeTouchedSides,
    touchedCorners,
    confident,
    reason: confident
      ? `候选色 ${representative} 覆盖 ${(borderCoverage * 100).toFixed(1)}% 边缘，代表色触达 ${representativeTouchedSides} 条边和 ${touchedCorners} 个角`
      : `候选色 ${representative} 置信度不足（覆盖 ${(borderCoverage * 100).toFixed(1)}%，代表色触达 ${representativeTouchedSides} 条边和 ${touchedCorners} 个角）`,
  };
}

function selectBestCluster(
  detections: BackgroundDetection[]
): BackgroundDetection {
  if (detections.length === 0) {
    return emptyDetection("边缘无非 null 颜色");
  }

  const sorted = [...detections].sort((a, b) => {
    if (b.borderCoverage !== a.borderCoverage) {
      return b.borderCoverage - a.borderCoverage;
    }
    if (b.representativeTouchedSides !== a.representativeTouchedSides) {
      return b.representativeTouchedSides - a.representativeTouchedSides;
    }
    if (b.touchedCorners !== a.touchedCorners) {
      return b.touchedCorners - a.touchedCorners;
    }
    const aHex = a.candidateHex ?? "";
    const bHex = b.candidateHex ?? "";
    return aHex < bHex ? -1 : aHex > bHex ? 1 : 0;
  });

  return sorted[0];
}

/**
 * 检测网格边缘的背景候选色。
 *
 * @param grid HexGrid 输入网格
 * @param options 可选参数覆盖
 * @returns 背景检测结果，包含候选色、覆盖率、代表色触达边数/角数与置信度
 */
export function detectBackgroundCandidate(
  grid: HexGrid,
  options?: BackgroundDetectionOptions
): BackgroundDetection {
  validateRectangularGrid(grid);
  validateHexGridValues(grid);

  const config = mergeConfig(options?.config);
  validateConfig(config);

  const borderCells = collectBorderCells(grid);
  const nonNullBorder = borderCells.filter((c) => c.hex !== null);

  if (nonNullBorder.length === 0) {
    return emptyDetection("边缘无非 null 颜色");
  }

  const colorCounts = new Map<string, number>();
  const colorSides = new Map<string, Set<Side>>();
  const colorCorners = new Map<string, Set<Corner>>();

  for (const cell of nonNullBorder) {
    colorCounts.set(cell.hex, (colorCounts.get(cell.hex) ?? 0) + 1);
    const sides = colorSides.get(cell.hex) ?? new Set<Side>();
    for (const side of cell.sides) sides.add(side);
    colorSides.set(cell.hex, sides);

    const corners = colorCorners.get(cell.hex) ?? new Set<Corner>();
    for (const corner of cell.corners) corners.add(corner);
    colorCorners.set(cell.hex, corners);
  }

  const distinctColors = Array.from(colorCounts.keys()).sort((a, b) => {
    const countDiff = (colorCounts.get(b) ?? 0) - (colorCounts.get(a) ?? 0);
    if (countDiff !== 0) return countDiff;
    return a < b ? -1 : a > b ? 1 : 0;
  });

  const clusters = clusterBorderColors(distinctColors, config.backgroundDistanceThreshold);

  const detections: BackgroundDetection[] = clusters.map((cluster) => {
    const representative = pickRepresentative(cluster, colorCounts);
    return buildDetection(
      representative,
      cluster,
      colorCounts,
      colorSides,
      colorCorners,
      nonNullBorder.length,
      config
    );
  });

  return selectBestCluster(detections);
}

/**
 * 从边界开始 flood fill，删除与指定背景色连通且在阈值内的边缘连通区域。
 *
 * @param grid HexGrid 输入网格
 * @param backgroundHex 背景色 HEX
 * @param options 可选参数覆盖
 * @returns 删除后的网格与统计信息
 */
export function removeEdgeConnectedBackground(
  grid: HexGrid,
  backgroundHex: string,
  options?: BackgroundRemovalOptions
): BackgroundRemovalResult {
  validateRectangularGrid(grid);
  validateHexGridValues(grid);
  validateBackgroundHex(backgroundHex);

  const config = mergeConfig(options?.config);
  validateConfig(config);

  const height = grid.length;
  if (height === 0) {
    return { grid: [], removedCount: 0, requiresUserSelection: false };
  }
  const width = grid[0].length;
  if (width === 0) {
    return { grid: grid.map((row) => [...row]), removedCount: 0, requiresUserSelection: false };
  }

  const targetLab = hexToOklab(backgroundHex);
  const result: HexGrid = grid.map((row) => [...row]);
  const visited: boolean[][] = Array.from({ length: height }, () => Array(width).fill(false));
  const queue: { x: number; y: number }[] = [];

  // 初始化：所有边界上匹配背景色的格子入队
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (x !== 0 && x !== width - 1 && y !== 0 && y !== height - 1) continue;

      const hex = result[y][x];
      if (hex === null) continue;

      const dist = oklabDistance(hexToOklab(hex), targetLab);
      if (dist <= config.backgroundDistanceThreshold) {
        visited[y][x] = true;
        queue.push({ x, y });
      }
    }
  }

  // BFS flood fill（四方向）
  for (let head = 0; head < queue.length; head++) {
    const { x, y } = queue[head];

    for (const { dx, dy } of DIRECTIONS) {
      const nx = x + dx;
      const ny = y + dy;

      if (
        nx < 0 ||
        nx >= width ||
        ny < 0 ||
        ny >= height ||
        visited[ny][nx]
      ) {
        continue;
      }

      const neighborHex = result[ny][nx];
      if (neighborHex === null) continue;

      const dist = oklabDistance(hexToOklab(neighborHex), targetLab);
      if (dist <= config.backgroundDistanceThreshold) {
        visited[ny][nx] = true;
        queue.push({ x: nx, y: ny });
      }
    }
  }

  let removedCount = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (visited[y][x]) {
        result[y][x] = null;
        removedCount++;
      }
    }
  }

  return {
    grid: result,
    removedCount,
    requiresUserSelection: false,
  };
}

/**
 * 用户点选背景后，从边界开始删除与点选颜色连通且在阈值内的区域。
 *
 * @param grid HexGrid 输入网格
 * @param x 点选列坐标
 * @param y 点选行坐标
 * @param options 可选参数覆盖
 * @returns 删除后的网格与统计信息
 */
export function removeBackgroundFromSelection(
  grid: HexGrid,
  x: number,
  y: number,
  options?: BackgroundRemovalOptions
): BackgroundRemovalResult {
  validateRectangularGrid(grid);
  validateHexGridValues(grid);

  const config = mergeConfig(options?.config);
  validateConfig(config);

  const height = grid.length;
  if (height === 0) {
    throw new Error("空网格无法选择背景");
  }
  const width = grid[0].length;

  if (!Number.isInteger(x) || !Number.isInteger(y)) {
    throw new Error(`非法坐标: x=${x}, y=${y}，必须为整数`);
  }
  if (x < 0 || x >= width || y < 0 || y >= height) {
    throw new Error(`坐标越界: x=${x}, y=${y}，网格尺寸为 ${width}×${height}`);
  }

  const selectedHex = grid[y][x];
  if (selectedHex === null) {
    return {
      grid: grid.map((row) => [...row]),
      removedCount: 0,
      requiresUserSelection: true,
    };
  }

  const result = removeEdgeConnectedBackground(grid, selectedHex, options);
  if (result.removedCount === 0) {
    return {
      ...result,
      requiresUserSelection: true,
    };
  }
  return result;
}

/**
 * 自动检测并删除背景。
 *
 * 高置信度且通过 dry-run 安全检查时直接删除；
 * 否则返回原网格副本并要求用户点选。
 */
export function autoRemoveBackground(
  grid: HexGrid,
  options?: BackgroundRemovalOptions
): BackgroundRemovalResult {
  validateRectangularGrid(grid);
  validateHexGridValues(grid);

  const config = mergeConfig(options?.config);
  validateConfig(config);

  const detection = detectBackgroundCandidate(grid, { config });

  if (!detection.confident || detection.candidateHex === null) {
    return {
      grid: grid.map((row) => [...row]),
      removedCount: 0,
      requiresUserSelection: true,
      detection,
      autoRemovalSafe: false,
    };
  }

  const totalNonNull = grid.flat().filter((c) => c !== null).length;

  // dry-run：先计算删除结果，再决定是否应用
  const dryRun = removeEdgeConnectedBackground(grid, detection.candidateHex, { config });
  const removalRatio = totalNonNull === 0 ? 0 : dryRun.removedCount / totalNonNull;

  const safe =
    dryRun.removedCount > 0 &&
    dryRun.removedCount < totalNonNull &&
    removalRatio <= config.maxAutoRemovalRatio;

  if (!safe) {
    let safetyReason = "自动删除被安全规则拦截";
    if (dryRun.removedCount === 0) {
      safetyReason = "候选背景色未连接任何边缘格";
    } else if (dryRun.removedCount >= totalNonNull) {
      safetyReason = "自动删除会清空整个网格";
    } else if (removalRatio > config.maxAutoRemovalRatio) {
      safetyReason = `自动删除比例 ${(removalRatio * 100).toFixed(1)}% 超过上限 ${(config.maxAutoRemovalRatio * 100).toFixed(1)}%`;
    }

    return {
      grid: grid.map((row) => [...row]),
      removedCount: 0,
      requiresUserSelection: true,
      detection: {
        ...detection,
        reason: `${detection.reason}；${safetyReason}`,
      },
      autoRemovalSafe: false,
      removalRatio,
    };
  }

  return {
    ...dryRun,
    detection,
    autoRemovalSafe: true,
    removalRatio,
  };
}
