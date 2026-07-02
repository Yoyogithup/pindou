/**
 * PatternDocument 导出校验。
 *
 * 在两个 PNG 渲染器入口调用，确保文档不变量满足，
 * 避免在渲染过程中出现原生越界异常或静默错误。
 */

import type { PatternDocument } from "@/features/generator/model/types";
import { calculateUsage } from "./calculateUsage";
import { normalizeHex } from "./color";

/** 用量 PNG 排版最多支持的色数（14 行 × 2 列）。 */
export const MAX_USAGE_COLORS = 28;

/**
 * 校验 PatternDocument 是否满足渲染要求。
 *
 * 仅为校验重新计算 usage，不作为渲染数据源；
 * 不生成业务输出，只校验结构不变量和数据一致性。
 */
export function validatePatternDocumentForExport(doc: PatternDocument): void {
  if (!doc || typeof doc !== "object") {
    throw new Error("非法 PatternDocument: 文档不能为空");
  }

  if (doc.version !== 1) {
    throw new Error(`非法 PatternDocument: 未知版本 ${doc.version}`);
  }

  if (!Number.isInteger(doc.width) || doc.width <= 0) {
    throw new Error(`非法 PatternDocument: width 必须为正整数，当前 ${doc.width}`);
  }
  if (!Number.isInteger(doc.height) || doc.height <= 0) {
    throw new Error(`非法 PatternDocument: height 必须为正整数，当前 ${doc.height}`);
  }

  if (!Array.isArray(doc.cells)) {
    throw new Error("非法 PatternDocument: cells 必须是数组");
  }
  if (doc.cells.length !== doc.height) {
    throw new Error(
      `非法 PatternDocument: cells 行数 ${doc.cells.length} 与 height ${doc.height} 不一致`
    );
  }
  for (let y = 0; y < doc.height; y++) {
    const row = doc.cells[y];
    if (!Array.isArray(row)) {
      throw new Error(`非法 PatternDocument: cells 第 ${y} 行不是数组`);
    }
    if (row.length !== doc.width) {
      throw new Error(
        `非法 PatternDocument: cells 第 ${y} 行长度 ${row.length} 与 width ${doc.width} 不一致`
      );
    }
  }

  if (!Array.isArray(doc.usage)) {
    throw new Error("非法 PatternDocument: usage 必须是数组");
  }

  // 计算 cells 的真实用量，并与 doc.usage / totalBeads 逐项比对
  let expected: ReturnType<typeof calculateUsage>;
  try {
    expected = calculateUsage(doc.cells);
  } catch (err) {
    throw new Error(`非法 PatternDocument: ${(err as Error).message}`);
  }

  if (expected.totalBeads !== doc.totalBeads) {
    throw new Error(
      `非法 PatternDocument: cells 实际非空格数 ${expected.totalBeads} 与 totalBeads ${doc.totalBeads} 不一致`
    );
  }

  if (expected.usage.length !== doc.usage.length) {
    throw new Error(
      `非法 PatternDocument: cells 实际颜色数 ${expected.usage.length} 与 usage 长度 ${doc.usage.length} 不一致`
    );
  }

  const expectedByCode = new Map(expected.usage.map((u) => [u.code, u]));
  const seenCodes = new Set<string>();

  for (const item of doc.usage) {
    if (!item.code) {
      throw new Error("非法 PatternDocument: usage 中存在空色号");
    }

    if (seenCodes.has(item.code)) {
      throw new Error(`非法 PatternDocument: usage 中色号 ${item.code} 重复出现`);
    }
    seenCodes.add(item.code);

    // HEX 格式校验
    try {
      normalizeHex(item.hex);
    } catch {
      throw new Error(
        `非法 PatternDocument: usage 中色号 ${item.code} 的 HEX "${item.hex}" 无效`
      );
    }

    // count 校验
    if (!Number.isInteger(item.count) || item.count <= 0) {
      throw new Error(
        `非法 PatternDocument: usage 中色号 ${item.code} 的 count 必须为正整数，当前 ${item.count}`
      );
    }

    const expectedItem = expectedByCode.get(item.code);
    if (!expectedItem) {
      throw new Error(
        `非法 PatternDocument: usage 中色号 ${item.code} 在 cells 中不存在`
      );
    }

    if (expectedItem.hex !== item.hex) {
      throw new Error(
        `非法 PatternDocument: usage 中色号 ${item.code} 的 HEX ${item.hex} 与 cells 中的 ${expectedItem.hex} 不一致`
      );
    }

    if (expectedItem.count !== item.count) {
      throw new Error(
        `非法 PatternDocument: usage 中色号 ${item.code} 的 count ${item.count} 与 cells 实际数量 ${expectedItem.count} 不一致`
      );
    }
  }

  if (!doc.preset) {
    throw new Error("非法 PatternDocument: preset 不能为空");
  }

  if (doc.usage.length > doc.preset.maxColors) {
    throw new Error(
      `非法 PatternDocument: usage 颜色数 ${doc.usage.length} 超过 preset 上限 ${doc.preset.maxColors}`
    );
  }

  if (doc.usage.length > MAX_USAGE_COLORS) {
    throw new Error(
      `非法 PatternDocument: usage 颜色数 ${doc.usage.length} 超过用量 PNG 排版上限 ${MAX_USAGE_COLORS}`
    );
  }
}
