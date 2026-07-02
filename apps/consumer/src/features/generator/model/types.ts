/**
 * 拼豆小纸条 V0 核心数据模型
 *
 * 本文件只定义类型接口，不依赖具体算法实现。
 * 颜色相关字段使用 HEX 字符串（例如 #7CB7A5）。
 */

/** 用途：决定成品尺寸和坐标分段 */
export type Purpose = "keychain" | "fridge-magnet" | "stand";

/** 生成模式：决定采样方式、合并强度和颜色上限 */
export type Mode = "beginner" | "standard" | "detail";

/** 采样方式 */
export type SamplingMode = "dominant" | "average";

/** V0 背景处理策略 */
export type BackgroundStrategy = "remove-edge-connected";

/** V0 固定使用 MARD 色板 */
export type PaletteId = "MARD";

/**
 * 由用户选择的用途和模式解析出的确定性算法参数。
 * 所有字段必须可测试，不能包含 UI 文案。
 */
export interface EffectivePreset {
  purpose: Purpose;
  mode: Mode;
  /** 成品最长边格数 */
  maxGridEdge: number;
  samplingMode: SamplingMode;
  /** Oklab 相似阈值 */
  similarityThreshold: number;
  /** 最小连通色块尺寸（格） */
  minRegionSize: number;
  /** 颜色硬上限 */
  maxColors: number;
  paletteId: PaletteId;
  /** 坐标分段间隔 */
  sectionInterval: 5 | 10;
  backgroundStrategy: BackgroundStrategy;
}

/** 单个 MARD 色号条目 */
export interface PaletteColor {
  code: string;
  hex: string;
  name?: string;
}

/** 一种颜色在图纸中的用量 */
export interface ColorUsage {
  hex: string;
  code: string;
  count: number;
  name?: string;
}

/** 图纸网格中的单格 */
export interface PatternCell {
  /** null 表示背景/透明格，不计入豆数 */
  hex: string | null;
  /** null 表示背景/透明格 */
  code: string | null;
}

/** 仅含 HEX 的内存网格，用于颜色算法阶段 */
export type HexGrid = Array<Array<string | null>>;

/**
 * 算法、页面和两种 PNG 导出的统一中间文档。
 * 两种导出必须消费同一个 PatternDocument，禁止各自重新统计。
 */
export interface PatternDocument {
  version: 1;
  width: number;
  height: number;
  cells: PatternCell[][];
  paletteId: PaletteId;
  usage: ColorUsage[];
  totalBeads: number;
  preset: EffectivePreset;
}

/**
 * PNG 导出产物。
 * 包含 Blob、Object URL、文件名和像素尺寸。
 */
export interface ExportAsset {
  blob: Blob;
  /** data: URL（base64），用于 <img> src、长按保存和临时预览 */
  dataUrl: string;
  filename: string;
  width: number;
  height: number;
}

/** 生成流程状态机 */
export type GeneratorStatus =
  | "idle"
  | "imageSelected"
  | "generating"
  | "backgroundSelection"
  | "success"
  | "error";
