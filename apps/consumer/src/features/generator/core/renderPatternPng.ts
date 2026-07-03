/**
 * 图纸 PNG 渲染器。
 *
 * 按最长边选择单格像素，绘制网格、每格 MARD 色号、坐标分段、
 * 尺寸与总豆数摘要，以及轻量产品标识。
 */

import type { ExportAsset, PatternDocument } from "@/features/generator/model/types";
import { createCanvas, canvasToBlob, blobToDataUrl } from "./canvasAdapter";
import { validatePatternDocumentForExport } from "./validatePatternDocument";

export const PATTERN_MARGIN_TOP = 80;
export const PATTERN_MARGIN_BOTTOM = 100;
export const PATTERN_MARGIN_LEFT = 80;
export const PATTERN_MARGIN_RIGHT = 40;
/** 保证摘要和页脚不被裁切的最小画布宽度 */
export const PATTERN_MIN_CANVAS_WIDTH = 300;

const COLORS_BG = "#FFFFFF";
const COLORS_COORDINATE = "#6B7280";
const COLORS_GRID_LINE = "#E5E7EB";
const COLORS_NULL_FILL = "#F3F4F6";
const COLORS_NULL_STRIPE = "#E5E7EB";
const COLORS_SUMMARY = "#4B5563";
const COLORS_FOOTER = "#9CA3AF";

export function getCellSize(maxEdge: number): number {
  if (maxEdge <= 32) return 32;
  if (maxEdge <= 60) return 24;
  return 22;
}

function getContrastTextColor(hex: string): string {
  const normalized = hex.replace("#", "");
  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? "#1F2937" : "#FFFFFF";
}

function drawNullCell(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number
): void {
  ctx.fillStyle = COLORS_NULL_FILL;
  ctx.fillRect(x, y, size, size);

  // 轻量斜纹，与有效白色豆格区分
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, size, size);
  ctx.clip();
  ctx.strokeStyle = COLORS_NULL_STRIPE;
  ctx.lineWidth = 1;
  const step = 6;
  for (let offset = -size; offset < size; offset += step) {
    ctx.beginPath();
    ctx.moveTo(x + offset, y);
    ctx.lineTo(x + offset + size, y + size);
    ctx.stroke();
  }
  ctx.restore();
}

/**
 * 图纸 PNG 布局信息。
 */
export interface PatternLayout {
  canvasWidth: number;
  canvasHeight: number;
  gridOriginX: number;
  gridOriginY: number;
  cellSize: number;
  summaryText: string;
  summaryX: number;
  summaryY: number;
  footerText: string;
  footerX: number;
  footerY: number;
}

/**
 * 计算图纸布局，供渲染和测试断言共同使用。
 */
export function computePatternLayout(doc: PatternDocument): PatternLayout {
  const { width: gridWidth, height: gridHeight, totalBeads, usage } = doc;
  const maxEdge = Math.max(gridWidth, gridHeight);
  const cellSize = getCellSize(maxEdge);

  const rawWidth = PATTERN_MARGIN_LEFT + gridWidth * cellSize + PATTERN_MARGIN_RIGHT;
  const canvasWidth = Math.max(rawWidth, PATTERN_MIN_CANVAS_WIDTH);
  const canvasHeight = PATTERN_MARGIN_TOP + gridHeight * cellSize + PATTERN_MARGIN_BOTTOM;

  const gridOriginX = PATTERN_MARGIN_LEFT;
  const gridOriginY = PATTERN_MARGIN_TOP;

  const summaryText = `${gridWidth}×${gridHeight} 格 · 总豆数 ${totalBeads} · ${usage.length} 色`;
  const summaryX = gridOriginX;
  const summaryY = gridOriginY + gridHeight * cellSize + 48;

  const footerText = "拼豆小纸条";
  const footerX = canvasWidth - PATTERN_MARGIN_RIGHT;
  const footerY = canvasHeight - 24;

  return {
    canvasWidth,
    canvasHeight,
    gridOriginX,
    gridOriginY,
    cellSize,
    summaryText,
    summaryX,
    summaryY,
    footerText,
    footerX,
    footerY,
  };
}

/**
 * 渲染图纸 PNG。
 *
 * @param document PatternDocument
 * @returns ExportAsset（Blob、Object URL、文件名、尺寸）
 */
export async function renderPatternPng(document: PatternDocument): Promise<ExportAsset> {
  validatePatternDocumentForExport(document);

  const { width: gridWidth, height: gridHeight, cells, preset } = document;
  const layout = computePatternLayout(document);

  const canvas = await createCanvas(layout.canvasWidth, layout.canvasHeight);
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("无法获取 Canvas 2D 上下文");
  }

  // 背景
  ctx.fillStyle = COLORS_BG;
  ctx.fillRect(0, 0, layout.canvasWidth, layout.canvasHeight);

  // 坐标轴标签与分段标记
  ctx.fillStyle = COLORS_COORDINATE;
  ctx.font = `${Math.max(10, Math.floor(layout.cellSize * 0.45))}px system-ui, -apple-system, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  // 顶部 X 坐标
  for (let x = 0; x < gridWidth; x++) {
    const label = String(x + 1);
    const showLabel = x === 0 || x === gridWidth - 1 || (x + 1) % preset.sectionInterval === 0;
    if (showLabel) {
      ctx.fillText(
        label,
        layout.gridOriginX + x * layout.cellSize + layout.cellSize / 2,
        layout.gridOriginY - layout.cellSize / 2
      );
    }
  }

  // 左侧 Y 坐标
  ctx.textAlign = "right";
  for (let y = 0; y < gridHeight; y++) {
    const label = String(y + 1);
    const showLabel = y === 0 || y === gridHeight - 1 || (y + 1) % preset.sectionInterval === 0;
    if (showLabel) {
      ctx.fillText(
        label,
        layout.gridOriginX - layout.cellSize / 3,
        layout.gridOriginY + y * layout.cellSize + layout.cellSize / 2
      );
    }
  }

  // 网格与色块
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const fontSize = Math.max(8, Math.floor(layout.cellSize * 0.45));
  ctx.font = `${fontSize}px system-ui, -apple-system, sans-serif`;

  for (let y = 0; y < gridHeight; y++) {
    for (let x = 0; x < gridWidth; x++) {
      const cell = cells[y][x];
      const px = layout.gridOriginX + x * layout.cellSize;
      const py = layout.gridOriginY + y * layout.cellSize;

      if (cell.hex === null) {
        drawNullCell(ctx, px, py, layout.cellSize);
      } else {
        ctx.fillStyle = cell.hex;
        ctx.fillRect(px, py, layout.cellSize, layout.cellSize);

        // 色号
        ctx.fillStyle = getContrastTextColor(cell.hex);
        ctx.fillText(cell.code!, px + layout.cellSize / 2, py + layout.cellSize / 2 + 1);
      }

      // 网格线
      ctx.strokeStyle = COLORS_GRID_LINE;
      ctx.lineWidth = 1;
      ctx.strokeRect(px, py, layout.cellSize, layout.cellSize);
    }
  }

  // 摘要
  ctx.fillStyle = COLORS_SUMMARY;
  ctx.font = "24px system-ui, -apple-system, sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(layout.summaryText, layout.summaryX, layout.summaryY);

  // 底部轻量产品名
  ctx.fillStyle = COLORS_FOOTER;
  ctx.font = "18px system-ui, -apple-system, sans-serif";
  ctx.textAlign = "right";
  ctx.fillText(layout.footerText, layout.footerX, layout.footerY);

  const blob = await canvasToBlob(canvas);
  const dataUrl = await blobToDataUrl(blob);
  const filename = `pindou-pattern-${gridWidth}x${gridHeight}.png`;

  return {
    blob,
    dataUrl,
    filename,
    width: layout.canvasWidth,
    height: layout.canvasHeight,
  };
}
