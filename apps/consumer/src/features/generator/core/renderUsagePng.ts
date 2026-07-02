/**
 * 独立豆子用量 PNG 渲染器。
 *
 * 固定输出 1080×1350 px，包含标题、网格尺寸、总豆数、颜色数、
 * 每个颜色的色块 / 色号 / 数量，按色号自然排序。
 *
 * 不依赖图纸 PNG，不重新统计，只消费 PatternDocument.usage。
 */

import type { ColorUsage, ExportAsset, PatternDocument } from "@/features/generator/model/types";
import { createCanvas, canvasToBlob, blobToDataUrl } from "./canvasAdapter";
import { validatePatternDocumentForExport } from "./validatePatternDocument";

export const USAGE_PNG_WIDTH = 1080;
export const USAGE_PNG_HEIGHT = 1350;
export const USAGE_PADDING_X = 60;
export const USAGE_PADDING_Y = 60;
export const USAGE_FOOTER_RESERVED = 40;

const COLORS_TITLE_BG = "#FFFFFF";
const COLORS_TEXT = "#1F2937";
const COLORS_SUBTITLE = "#6B7280";
const COLORS_SWATCH_BORDER = "#E5E7EB";
const COLORS_FOOTER = "#9CA3AF";
const USAGE_MAX_ROW_HEIGHT = 78;
const USAGE_SWATCH_SIZE = 48;

function naturalSort(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
}

export function sortUsage(usage: ColorUsage[]): ColorUsage[] {
  return [...usage].sort((a, b) => naturalSort(a.code, b.code));
}

function getColumnLayout(colorCount: number): { columns: number; rowsPerColumn: number } {
  if (colorCount <= 14) {
    return { columns: 1, rowsPerColumn: colorCount };
  }
  return { columns: 2, rowsPerColumn: 14 };
}

/**
 * 用量 PNG 单项布局信息。
 */
export interface UsageItemLayout {
  code: string;
  hex: string;
  count: number;
  /** 色块左上角 X */
  x: number;
  /** 色块左上角 Y */
  y: number;
  swatchSize: number;
  rowHeight: number;
}

/**
 * 用量 PNG 整体布局信息。
 */
export interface UsageLayout {
  width: number;
  height: number;
  items: UsageItemLayout[];
  footerBaselineY: number;
  footerReservedHeight: number;
  /** 列表区域底部（不含页脚） */
  contentBottom: number;
}

/**
 * 计算用量 PNG 布局，供渲染和测试断言共同使用。
 */
export function computeUsageLayout(
  usage: ColorUsage[],
  options?: { width?: number; height?: number }
): UsageLayout {
  const width = options?.width ?? USAGE_PNG_WIDTH;
  const height = options?.height ?? USAGE_PNG_HEIGHT;

  if (!Number.isInteger(width) || width <= 0) {
    throw new Error(`非法布局宽度: ${width}，必须为正整数`);
  }
  if (!Number.isInteger(height) || height <= 0) {
    throw new Error(`非法布局高度: ${height}，必须为正整数`);
  }

  const contentTop = USAGE_PADDING_Y + 200;
  const contentBottom = height - USAGE_PADDING_Y - USAGE_FOOTER_RESERVED;
  const availableHeight = contentBottom - contentTop;

  if (availableHeight <= 0) {
    throw new Error(
      `非法布局高度: ${height} 过小，无法容纳标题、列表和页脚预留区域`
    );
  }

  const sortedUsage = sortUsage(usage);
  const colorCount = sortedUsage.length;
  const { columns, rowsPerColumn } = getColumnLayout(colorCount);

  // 行高：动态计算，确保所有行不超过可用区域；同时上限 78px
  const computedRowHeight =
    rowsPerColumn > 0 ? Math.floor(availableHeight / rowsPerColumn) : 0;
  const rowHeight = Math.min(USAGE_MAX_ROW_HEIGHT, computedRowHeight);

  const contentWidth = width - USAGE_PADDING_X * 2;
  const columnWidth = columns === 1 ? contentWidth : contentWidth / 2;

  const items: UsageItemLayout[] = [];
  for (let i = 0; i < sortedUsage.length; i++) {
    const item = sortedUsage[i];
    const col = Math.floor(i / rowsPerColumn);
    const row = i % rowsPerColumn;
    const x = USAGE_PADDING_X + col * columnWidth;
    const y = contentTop + row * rowHeight;

    items.push({
      code: item.code,
      hex: item.hex,
      count: item.count,
      x,
      y,
      swatchSize: USAGE_SWATCH_SIZE,
      rowHeight,
    });
  }

  for (const item of items) {
    if (item.x + item.swatchSize > width || item.y + item.swatchSize > height) {
      throw new Error(
        `布局越界: 色号 ${item.code} 超出画布范围 (${item.x}+${item.swatchSize}>${width} 或 ${item.y}+${item.swatchSize}>${height})`
      );
    }
  }

  return {
    width,
    height,
    items,
    footerBaselineY: height - USAGE_PADDING_Y,
    footerReservedHeight: USAGE_FOOTER_RESERVED,
    contentBottom,
  };
}

/**
 * 渲染独立豆子用量 PNG。
 *
 * @param document PatternDocument
 * @returns ExportAsset（Blob、Object URL、文件名、尺寸）
 */
export async function renderUsagePng(document: PatternDocument): Promise<ExportAsset> {
  validatePatternDocumentForExport(document);

  const layout = computeUsageLayout(document.usage);

  const canvas = await createCanvas(layout.width, layout.height);
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("无法获取 Canvas 2D 上下文");
  }

  // 背景
  ctx.fillStyle = COLORS_TITLE_BG;
  ctx.fillRect(0, 0, layout.width, layout.height);

  // 标题
  ctx.fillStyle = COLORS_TEXT;
  ctx.font = "bold 72px system-ui, -apple-system, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.fillText("豆子用量", layout.width / 2, USAGE_PADDING_Y + 20);

  // 副标题
  ctx.fillStyle = COLORS_SUBTITLE;
  ctx.font = "32px system-ui, -apple-system, sans-serif";
  ctx.fillText(
    `MARD 色板 · ${document.width}×${document.height} 格 · 总豆数 ${document.totalBeads} · ${layout.items.length} 色`,
    layout.width / 2,
    USAGE_PADDING_Y + 110
  );

  // 颜色列表
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";

  for (const item of layout.items) {
    // 色块
    ctx.fillStyle = item.hex;
    ctx.fillRect(item.x, item.y, item.swatchSize, item.swatchSize);
    ctx.strokeStyle = COLORS_SWATCH_BORDER;
    ctx.lineWidth = 2;
    ctx.strokeRect(item.x, item.y, item.swatchSize, item.swatchSize);

    // 色号
    ctx.fillStyle = COLORS_TEXT;
    ctx.font = "bold 32px system-ui, -apple-system, sans-serif";
    ctx.fillText(item.code, item.x + item.swatchSize + 20, item.y + item.swatchSize / 2);

    // 数量
    ctx.font = "32px system-ui, -apple-system, sans-serif";
    ctx.fillText(`${item.count} 颗`, item.x + item.swatchSize + 120, item.y + item.swatchSize / 2);
  }

  // 底部轻量产品名
  ctx.fillStyle = COLORS_FOOTER;
  ctx.font = "24px system-ui, -apple-system, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "bottom";
  ctx.fillText("拼豆小纸条", layout.width / 2, layout.footerBaselineY);

  const blob = await canvasToBlob(canvas);
  const dataUrl = await blobToDataUrl(blob);
  const filename = `pindou-beads-${document.width}x${document.height}.png`;

  return {
    blob,
    dataUrl,
    filename,
    width: layout.width,
    height: layout.height,
  };
}
