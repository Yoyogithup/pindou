/**
 * 色板入口校验。
 *
 * 在管线入口处校验色板数据完整性，确保 hex → code 为一对一关系。
 *
 * 规则：
 * - code 非空且唯一；
 * - HEX 合法（3 位或 6 位十六进制），并统一标准化为 `#RRGGBB` 大写；
 * - 标准化后的 HEX 唯一；
 * - paletteId 与 preset 一致（V0 固定为 "MARD"）。
 */

import type { EffectivePreset, PaletteColor } from "@/features/generator/model/types";
import { normalizeHex } from "./color";

/** 校验错误，包含明确原因 */
export class PaletteValidationError extends Error {
  constructor(message: string) {
    super(`色板校验失败: ${message}`);
    this.name = "PaletteValidationError";
  }
}

/**
 * 校验并标准化色板。
 *
 * @param palette 原始色板
 * @param preset 当前 preset（用于校验 paletteId）
 * @returns 标准化后的色板（HEX 统一为 #RRGGBB 大写）
 * @throws PaletteValidationError 校验不通过时抛出明确错误
 */
export function validatePalette(
  palette: PaletteColor[],
  preset: EffectivePreset
): PaletteColor[] {
  if (!palette || palette.length === 0) {
    throw new PaletteValidationError("色板不能为空");
  }

  const codesSeen = new Set<string>();
  const hexesSeen = new Set<string>();
  const result: PaletteColor[] = [];

  for (let i = 0; i < palette.length; i++) {
    const color = palette[i];

    // code 非空（trim 后校验）
    const trimmedCode = typeof color.code === "string" ? color.code.trim() : "";
    if (!trimmedCode) {
      throw new PaletteValidationError(`第 ${i} 项 code 为空`);
    }

    // code 唯一（trim 后比较）
    if (codesSeen.has(trimmedCode)) {
      throw new PaletteValidationError(`code 重复: "${trimmedCode}"`);
    }
    codesSeen.add(trimmedCode);

    // HEX 合法
    let normalizedHex: string;
    try {
      normalizedHex = normalizeHex(color.hex);
    } catch {
      throw new PaletteValidationError(
        `第 ${i} 项 (code=${color.code}) HEX 不合法: "${color.hex}"`
      );
    }

    // 标准化后 HEX 唯一
    if (hexesSeen.has(normalizedHex)) {
      throw new PaletteValidationError(
        `标准化后 HEX 重复: "${normalizedHex}" (code=${color.code})`
      );
    }
    hexesSeen.add(normalizedHex);

    result.push({
      code: trimmedCode,
      hex: normalizedHex,
      name: color.name,
    });
  }

  // paletteId 一致性（V0 固定 MARD）
  if (preset.paletteId !== "MARD") {
    throw new PaletteValidationError(
      `paletteId 不匹配: 期望 "MARD"，实际 "${preset.paletteId}"`
    );
  }

  return result;
}
