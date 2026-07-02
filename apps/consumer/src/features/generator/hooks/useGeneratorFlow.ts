/**
 * 生成流程状态机 Hook。
 *
 * 管理从图片选择到 PNG 生成的完整流程：
 * idle → imageSelected → generating → backgroundSelection → success / error
 *
 * 管线拆为 prepare（同步算法）和 finalize（同步收口 + 异步 PNG 渲染）。
 * 自动去背景成功时直接 finalize；需要用户点选时进入 backgroundSelection。
 *
 * 背景点选流程：
 * - 点选仅更新预览网格和撤销历史，不触发 finalize；
 * - 用户确认后才调用 confirmBackground → finalize + render；
 * - 支持多次点选、撤销和重新点选。
 *
 * 任务所有权：generationId 递增，只有最新任务的结果被接受。
 * generatingRef 仅在 taskId === generationIdRef.current 时修改。
 * 不在 setState updater 内启动异步任务。
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  ExportAsset,
  HexGrid,
  Mode,
  PatternDocument,
  Purpose,
} from "@/features/generator/model/types";
import type { GeneratorStatus } from "@/features/generator/model/types";
import { resolvePreset } from "@/features/generator/model/resolvePreset";
import { decodeImage } from "@/features/generator/core/decodeImage";
import {
  preparePattern,
  finalizePattern,
  type PreparedPattern,
} from "@/features/generator/core/generatePattern";
import { removeBackgroundFromSelection } from "@/features/generator/core/backgroundRemoval";
import { renderPatternPng } from "@/features/generator/core/renderPatternPng";
import { renderUsagePng } from "@/features/generator/core/renderUsagePng";
import { revokeObjectUrl } from "@/features/generator/hooks/useObjectUrl";
import { MARD_PALETTE } from "@/features/generator/data/mardPalette";

// ---------- 模块级工具函数 ----------

/** 渲染两张 PNG（含部分失败清理） */
async function renderPngs(
  doc: PatternDocument
): Promise<{ patternAsset: ExportAsset; usageAsset: ExportAsset }> {
  const results = await Promise.allSettled([
    renderPatternPng(doc),
    renderUsagePng(doc),
  ]);

  const pResult = results[0];
  const uResult = results[1];

  if (pResult.status === "fulfilled" && uResult.status === "fulfilled") {
    return { patternAsset: pResult.value, usageAsset: uResult.value };
  }

  // data URL 不需要释放，部分失败时无需清理
  const reason =
    pResult.status === "rejected"
      ? pResult.reason
      : uResult.status === "rejected"
        ? uResult.reason
        : new Error("PNG 渲染失败");
  throw reason instanceof Error ? reason : new Error("PNG 渲染失败");
}

/** finalize + render PNGs，检查任务所有权。过期时返回 null。 */
async function runFinalize(
  hexGrid: HexGrid,
  prepared: PreparedPattern,
  taskId: number,
  generationIdRef: React.RefObject<number>,
  mountedRef: React.RefObject<boolean>
): Promise<{ doc: PatternDocument; patternAsset: ExportAsset; usageAsset: ExportAsset } | null> {
  const doc = finalizePattern(
    hexGrid,
    prepared.gridSize,
    prepared.preset,
    prepared.palette
  );
  const { patternAsset, usageAsset } = await renderPngs(doc);

  if (!mountedRef.current || taskId !== generationIdRef.current) {
    // data URL 无需释放
    return null;
  }

  return { doc, patternAsset, usageAsset };
}

// ---------- Hook ----------

export interface GeneratorFlowState {
  status: GeneratorStatus;
  file: File | null;
  filePreviewUrl: string | null;
  purpose: Purpose;
  mode: Mode;
  resultStale: boolean;
  document: PatternDocument | null;
  patternAsset: ExportAsset | null;
  usageAsset: ExportAsset | null;
  errorMessage: string | null;
  requiresBackgroundSelection: boolean;
  gridForPreview: HexGrid | null;
  prepared: PreparedPattern | null;
  backgroundHistory: HexGrid[];
}

export interface GeneratorFlowActions {
  selectImage: (file: File) => void;
  setPurpose: (purpose: Purpose) => void;
  setMode: (mode: Mode) => void;
  generate: () => void;
  /** 点选背景：仅更新预览网格和撤销历史，不触发 finalize */
  selectBackground: (x: number, y: number) => void;
  undoBackground: () => void;
  /** 确认背景选择：触发 finalize + render */
  confirmBackground: () => void;
  reset: () => void;
}

const INITIAL_STATE: GeneratorFlowState = {
  status: "idle",
  file: null,
  filePreviewUrl: null,
  purpose: "keychain",
  mode: "standard",
  resultStale: false,
  document: null,
  patternAsset: null,
  usageAsset: null,
  errorMessage: null,
  requiresBackgroundSelection: false,
  gridForPreview: null,
  prepared: null,
  backgroundHistory: [],
};

export function useGeneratorFlow(
  initialPurpose: Purpose,
  initialMode: Mode
): GeneratorFlowState & GeneratorFlowActions {
  const [state, setState] = useState<GeneratorFlowState>({
    ...INITIAL_STATE,
    purpose: initialPurpose,
    mode: initialMode,
  });

  const generatingRef = useRef(false);
  const generationIdRef = useRef(0);
  const mountedRef = useRef(true);
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // ---------- selectImage ----------
  const selectImage = useCallback((file: File) => {
    generationIdRef.current++;
    generatingRef.current = false;

    const previewUrl = URL.createObjectURL(file);
    setState((prev) => {
      revokeObjectUrl(prev.filePreviewUrl);
      return {
        ...prev,
        status: "imageSelected",
        file,
        filePreviewUrl: previewUrl,
        resultStale: false,
        document: null,
        patternAsset: null,
        usageAsset: null,
        errorMessage: null,
        requiresBackgroundSelection: false,
        gridForPreview: null,
        prepared: null,
        backgroundHistory: [],
      };
    });
  }, []);

  // ---------- setPurpose / setMode ----------
  const setPurpose = useCallback((purpose: Purpose) => {
    setState((prev) => {
      if (prev.purpose === purpose) return prev;
      // backgroundSelection 时参数变化 → 废弃 prepared，回退到 imageSelected
      if (prev.status === "backgroundSelection") {
        return {
          ...prev,
          purpose,
          status: "imageSelected",
          resultStale: false,
          requiresBackgroundSelection: false,
          gridForPreview: null,
          prepared: null,
          backgroundHistory: [],
        };
      }
      const resultStale = prev.status === "success";
      return {
        ...prev,
        purpose,
        status: resultStale ? "imageSelected" : prev.status,
        resultStale: prev.status === "success" ? true : prev.resultStale,
      };
    });
  }, []);

  const setMode = useCallback((mode: Mode) => {
    setState((prev) => {
      if (prev.mode === mode) return prev;
      if (prev.status === "backgroundSelection") {
        return {
          ...prev,
          mode,
          status: "imageSelected",
          resultStale: false,
          requiresBackgroundSelection: false,
          gridForPreview: null,
          prepared: null,
          backgroundHistory: [],
        };
      }
      const resultStale = prev.status === "success";
      return {
        ...prev,
        mode,
        status: resultStale ? "imageSelected" : prev.status,
        resultStale: prev.status === "success" ? true : prev.resultStale,
      };
    });
  }, []);

  // ---------- generate ----------
  const generate = useCallback(() => {
    const s = stateRef.current;
    if (
      s.status !== "imageSelected" &&
      s.status !== "success" &&
      s.status !== "error"
    ) {
      return;
    }
    if (!s.file) return;
    if (generatingRef.current) return;

    generatingRef.current = true;
    const taskId = ++generationIdRef.current;
    const file = s.file;
    const purpose = s.purpose;
    const mode = s.mode;

    setState((prev) => ({
      ...prev,
      status: "generating",
      document: null,
      patternAsset: null,
      usageAsset: null,
      errorMessage: null,
      requiresBackgroundSelection: false,
      gridForPreview: null,
      prepared: null,
      backgroundHistory: [],
    }));

    (async () => {
      try {
        const decoded = await decodeImage(file);
        if (!mountedRef.current || taskId !== generationIdRef.current) return;

        const preset = resolvePreset(purpose, mode);
        const prepared = preparePattern(decoded.imageData, preset, MARD_PALETTE);

        if (!mountedRef.current || taskId !== generationIdRef.current) return;

        if (!prepared.requiresBackgroundSelection) {
          // 自动去背景成功 → 直接 finalize
          const result = await runFinalize(
            prepared.backgroundResult.grid,
            prepared,
            taskId,
            generationIdRef,
            mountedRef
          );
          // 仅当仍为当前任务时清锁
          if (taskId === generationIdRef.current) {
            generatingRef.current = false;
          }
          if (result) {
            setState((prev) => ({
              ...prev,
              status: "success",
              document: result.doc,
              patternAsset: result.patternAsset,
              usageAsset: result.usageAsset,
              resultStale: false,
              errorMessage: null,
              requiresBackgroundSelection: false,
              gridForPreview: null,
              prepared: null,
              backgroundHistory: [],
            }));
          }
        } else {
          // 需要用户点选 → 进入 backgroundSelection（不 finalize）
          if (!mountedRef.current || taskId !== generationIdRef.current) return;
          if (taskId === generationIdRef.current) {
            generatingRef.current = false;
          }
          setState((prev) => ({
            ...prev,
            status: "backgroundSelection",
            requiresBackgroundSelection: true,
            prepared,
            gridForPreview: prepared.limitedGrid,
            backgroundHistory: [],
          }));
        }
      } catch (err) {
        if (taskId === generationIdRef.current) {
          generatingRef.current = false;
        }
        if (!mountedRef.current || taskId !== generationIdRef.current) return;
        setState((prev) => ({
          ...prev,
          status: "error",
          errorMessage: err instanceof Error ? err.message : "生成失败，请重试",
          document: null,
          patternAsset: null,
          usageAsset: null,
          requiresBackgroundSelection: false,
          gridForPreview: null,
          prepared: null,
          backgroundHistory: [],
        }));
      }
    })();
  }, []);

  // ---------- selectBackground：仅更新预览和历史，不 finalize ----------
  const selectBackground = useCallback((x: number, y: number) => {
    const s = stateRef.current;
    if (s.status !== "backgroundSelection" || !s.prepared || !s.gridForPreview) {
      return;
    }

    try {
      const bgResult = removeBackgroundFromSelection(s.gridForPreview, x, y);
      if (bgResult.removedCount === 0) return;

      const oldGrid = s.gridForPreview;
      const newGrid = bgResult.grid;

      setState((prev) => ({
        ...prev,
        gridForPreview: newGrid,
        backgroundHistory: [...(prev.backgroundHistory ?? []), oldGrid],
      }));
    } catch {
      // 坐标越界等错误，静默忽略
    }
  }, []);

  // ---------- confirmBackground：finalize + render ----------
  const confirmBackground = useCallback(() => {
    const s = stateRef.current;
    if (s.status !== "backgroundSelection" || !s.prepared || !s.gridForPreview) {
      return;
    }
    // 必须至少执行过一次背景删除
    if (!s.backgroundHistory?.length) return;
    if (generatingRef.current) return;

    generatingRef.current = true;
    const taskId = ++generationIdRef.current;
    const currentGrid = s.gridForPreview;
    const prepared = s.prepared;

    setState((prev) => ({
      ...prev,
      status: "generating",
    }));

    (async () => {
      try {
        const result = await runFinalize(
          currentGrid,
          prepared,
          taskId,
          generationIdRef,
          mountedRef
        );
        if (taskId === generationIdRef.current) {
          generatingRef.current = false;
        }
        if (result) {
          setState((prev) => ({
            ...prev,
            status: "success",
            document: result.doc,
            patternAsset: result.patternAsset,
            usageAsset: result.usageAsset,
            resultStale: false,
            errorMessage: null,
            requiresBackgroundSelection: false,
            gridForPreview: null,
            prepared: null,
            backgroundHistory: [],
          }));
        }
      } catch (err) {
        if (taskId === generationIdRef.current) {
          generatingRef.current = false;
        }
        if (!mountedRef.current || taskId !== generationIdRef.current) return;
        setState((prev) => ({
          ...prev,
          status: "error",
          errorMessage: err instanceof Error ? err.message : "生成失败，请重试",
          document: null,
          patternAsset: null,
          usageAsset: null,
          requiresBackgroundSelection: false,
          gridForPreview: null,
          prepared: null,
          backgroundHistory: [],
        }));
      }
    })();
  }, []);

  // ---------- undoBackground ----------
  const undoBackground = useCallback(() => {
    setState((prev) => {
      if (!prev.backgroundHistory?.length) return prev;
      const history = [...prev.backgroundHistory];
      const previousGrid = history.pop()!;
      return {
        ...prev,
        gridForPreview: previousGrid,
        backgroundHistory: history,
      };
    });
  }, []);

  // ---------- reset ----------
  const reset = useCallback(() => {
    generationIdRef.current++;
    generatingRef.current = false;

    setState((prev) => {
      revokeObjectUrl(prev.filePreviewUrl);
      return {
        ...INITIAL_STATE,
        purpose: initialPurpose,
        mode: initialMode,
      };
    });
  }, [initialPurpose, initialMode]);

  return {
    ...state,
    selectImage,
    setPurpose,
    setMode,
    generate,
    selectBackground,
    undoBackground,
    confirmBackground,
    reset,
  };
}
