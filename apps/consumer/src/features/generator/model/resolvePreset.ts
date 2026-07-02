import { DEFAULT_PRESET_KEYS, PRESET_TABLE } from "./presets";
import type { EffectivePreset, Mode, Purpose } from "./types";

const PURPOSES: Purpose[] = ["keychain", "fridge-magnet", "stand"];
const MODES: Mode[] = ["beginner", "standard", "detail"];

/**
 * 将用户选择的用途和模式解析为确定性的 EffectivePreset。
 *
 * @param purpose 用途
 * @param mode 生成模式
 * @returns 完整算法参数
 * @throws 用途或模式非法时抛出明确错误
 */
export function resolvePreset(
  purpose: Purpose = DEFAULT_PRESET_KEYS.purpose,
  mode: Mode = DEFAULT_PRESET_KEYS.mode
): EffectivePreset {
  if (!PURPOSES.includes(purpose)) {
    throw new Error(`未知的用途: ${purpose}。可选值: ${PURPOSES.join(", ")}`);
  }
  if (!MODES.includes(mode)) {
    throw new Error(`未知的模式: ${mode}。可选值: ${MODES.join(", ")}`);
  }

  const base = PRESET_TABLE[purpose][mode];

  return {
    purpose,
    mode,
    ...base,
    paletteId: "MARD",
    backgroundStrategy: "remove-edge-connected",
  };
}
