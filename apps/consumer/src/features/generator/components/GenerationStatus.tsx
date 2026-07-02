"use client";

import type { GeneratorStatus } from "@/features/generator/model/types";

interface GenerationStatusProps {
  status: GeneratorStatus;
  errorMessage: string | null;
  onRetry: () => void;
}

/**
 * 生成状态指示器。
 */
export function GenerationStatus({ status, errorMessage, onRetry }: GenerationStatusProps) {
  if (status === "idle" || status === "success") {
    return null;
  }

  if (status === "imageSelected") {
    return (
      <div className="mb-4 rounded-2xl border border-mint/30 bg-mint/10 px-4 py-3 text-center text-sm text-mint">
        图片已就绪，点击下方按钮开始生成
      </div>
    );
  }

  if (status === "generating") {
    return (
      <div className="mb-4 rounded-2xl border border-border bg-white px-4 py-4 text-center" role="status">
        <div className="mx-auto mb-2 h-6 w-6 animate-spin rounded-full border-2 border-mint border-t-transparent" />
        <p className="text-sm text-brown">正在生成中，请稍候…</p>
        <p className="mt-1 text-xs text-muted">图片越大、网格越密，需要的时间越长</p>
      </div>
    );
  }

  if (status === "backgroundSelection") {
    return (
      <div className="mb-4 rounded-2xl border border-pink/30 bg-pink/5 px-4 py-3">
        <p className="text-sm font-medium text-pink">需要手动选择背景</p>
        <p className="mt-1 text-xs text-brown">
          自动检测置信度不足，请在下方网格预览中点击要删除的背景区域。
        </p>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="mb-4 rounded-2xl border border-pink/30 bg-pink/10 px-4 py-3" role="alert">
        <p className="text-sm font-medium text-pink">生成失败</p>
        <p className="mt-1 text-xs text-brown">{errorMessage ?? "未知错误"}</p>
        <button
          type="button"
          onClick={onRetry}
          className="mt-3 w-full rounded-xl bg-pink py-2 text-sm font-medium text-white transition-colors hover:bg-pink/80"
        >
          重试
        </button>
      </div>
    );
  }

  return null;
}
