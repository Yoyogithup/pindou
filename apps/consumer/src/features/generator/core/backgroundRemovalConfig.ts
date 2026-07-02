/**
 * 去背景算法默认参数配置。
 *
 * 这些值为 V0 首轮校准基线，后续需用五类样图验收后调整。
 * 所有参数集中在此，避免在算法函数中散落 magic number。
 */

export interface BackgroundRemovalConfig {
  /** Oklab 背景色距离阈值（0–100 标尺） */
  backgroundDistanceThreshold: number;
  /** 候选背景色至少覆盖边缘非 null 格的最小比例 */
  minBorderCoverage: number;
  /** 候选代表色至少触达几条边（自动删除默认要求 4 条） */
  minTouchedSides: number;
  /** 候选代表色至少触达几个角 */
  minTouchedCorners: number;
  /** 自动删除时，删除格数不能超过非 null 总格数的最大比例 */
  maxAutoRemovalRatio: number;
}

/**
 * V0 默认去背景参数。
 *
 * 注意：这是首轮校准基线，不是永久定稿。
 * 设计原则：宁可 false negative（要求用户点选），也不允许 false positive（自动删除主体）。
 */
export const DEFAULT_BACKGROUND_REMOVAL_CONFIG: BackgroundRemovalConfig = {
  backgroundDistanceThreshold: 8,
  minBorderCoverage: 0.55,
  minTouchedSides: 4,
  minTouchedCorners: 3,
  maxAutoRemovalRatio: 0.75,
};
