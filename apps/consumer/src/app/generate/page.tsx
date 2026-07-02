"use client";

import { useCallback, useEffect, useRef } from "react";
import {
  DEFAULT_PRESET_KEYS,
  MODE_OPTIONS,
  PURPOSE_OPTIONS,
} from "@/features/generator/model/presets";
import { useGeneratorFlow } from "@/features/generator/hooks/useGeneratorFlow";
import { useObjectUrl } from "@/features/generator/hooks/useObjectUrl";
import { UploadCard } from "@/features/generator/components/UploadCard";
import { GenerationStatus } from "@/features/generator/components/GenerationStatus";
import { ResultSection } from "@/features/generator/components/ResultSection";
import { IS_PRODUCTION_PALETTE } from "@/features/generator/data/devPalette";
import type { HexGrid } from "@/features/generator/model/types";

/**
 * 低分辨率网格预览组件。
 *
 * 使用 canvas 绘制网格颜色，点击事件换算为网格坐标。
 */
function GridPreview({
  grid,
  onCellClick,
}: {
  grid: HexGrid;
  onCellClick: (x: number, y: number) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const height = grid.length;
  const width = height > 0 ? grid[0].length : 0;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || width === 0 || height === 0) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, width, height);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const hex = grid[y][x];
        ctx.fillStyle = hex === null ? "#F3F4F6" : hex;
        ctx.fillRect(x, y, 1, 1);
      }
    }
  }, [grid, width, height]);

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas || width === 0 || height === 0) return;
      const rect = canvas.getBoundingClientRect();
      const scaleX = width / rect.width;
      const scaleY = height / rect.height;
      const x = Math.floor((e.clientX - rect.left) * scaleX);
      const y = Math.floor((e.clientY - rect.top) * scaleY);
      if (x >= 0 && x < width && y >= 0 && y < height) {
        onCellClick(x, y);
      }
    },
    [width, height, onCellClick]
  );

  if (width === 0 || height === 0) return null;

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      onClick={handleClick}
      className="mx-auto max-h-[50vh] w-full cursor-crosshair rounded-lg border border-border"
      style={{ imageRendering: "pixelated" }}
    />
  );
}

export default function GeneratePage() {
  const {
    status,
    file,
    filePreviewUrl,
    purpose,
    mode,
    resultStale,
    document: patternDoc,
    patternAsset,
    usageAsset,
    errorMessage,
    gridForPreview,
    backgroundHistory,
    selectImage,
    setPurpose,
    setMode,
    generate,
    selectBackground,
    undoBackground,
    confirmBackground,
  } = useGeneratorFlow(DEFAULT_PRESET_KEYS.purpose, DEFAULT_PRESET_KEYS.mode);

  // filePreviewUrl 仍为 blob: URL 需要生命周期管理，pattern/usage 已改为 data: URL
  useObjectUrl([filePreviewUrl]);

  const canGenerate =
    (status === "imageSelected" || status === "success" || status === "error") &&
    file !== null;

  const isGenerating = status === "generating";
  const isBackgroundSelection = status === "backgroundSelection";
  // 背景点选或生成中均禁用参数控件
  const controlsDisabled = isGenerating || isBackgroundSelection;

  const generateButtonText = (() => {
    if (isGenerating) return "生成中…";
    if (resultStale) return "参数已变更，重新生成";
    if (status === "success") return "重新生成";
    return "生成拼豆图纸";
  })();

  return (
    <div className="mx-auto min-h-screen w-full max-w-[390px] bg-cream px-4 py-6 sm:max-w-none sm:px-6">
      <header className="mb-6 text-center">
        <h1 className="text-2xl font-semibold text-brown">拼豆小纸条</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          把你的图片变成一张可以照着拼的拼豆小纸条
        </p>
        {!IS_PRODUCTION_PALETTE && (
          <p className="mt-1 text-xs text-pink">当前使用开发色板，颜色为示意</p>
        )}
      </header>

      <UploadCard
        previewUrl={filePreviewUrl}
        fileName={file?.name}
        onSelect={selectImage}
        disabled={controlsDisabled}
      />

      {/* 用途选择 */}
      <section className="mb-5 rounded-[20px] border border-border bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-base font-medium text-brown">选择用途</h2>
        <div className="grid grid-cols-3 gap-2">
          {PURPOSE_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              aria-pressed={purpose === option.value}
              onClick={() => setPurpose(option.value)}
              disabled={controlsDisabled}
              className={`flex flex-col items-center rounded-2xl border px-2 py-3 text-center transition-colors ${
                purpose === option.value
                  ? "border-mint bg-mint text-white"
                  : "border-border bg-white text-brown hover:border-mint"
              } disabled:opacity-50`}
            >
              <span className="text-sm font-medium">{option.label}</span>
            </button>
          ))}
        </div>
        <p className="mt-3 text-xs text-muted">
          {PURPOSE_OPTIONS.find((o) => o.value === purpose)?.description}
        </p>
      </section>

      {/* 模式选择 */}
      <section className="mb-5 rounded-[20px] border border-border bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-base font-medium text-brown">选择图纸效果</h2>
        <div className="grid grid-cols-3 gap-2">
          {MODE_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              aria-pressed={mode === option.value}
              onClick={() => setMode(option.value)}
              disabled={controlsDisabled}
              className={`flex flex-col items-center rounded-2xl border px-2 py-3 text-center transition-colors ${
                mode === option.value
                  ? "border-mint bg-mint text-white"
                  : "border-border bg-white text-brown hover:border-mint"
              } disabled:opacity-50`}
            >
              <span className="text-sm font-medium">{option.label}</span>
            </button>
          ))}
        </div>
        <p className="mt-3 text-xs text-muted">
          {MODE_OPTIONS.find((o) => o.value === mode)?.description}
        </p>
      </section>

      <GenerationStatus
        status={status}
        errorMessage={errorMessage}
        onRetry={generate}
      />

      {/* 生成按钮 */}
      <button
        type="button"
        onClick={generate}
        disabled={!canGenerate || isGenerating}
        className={`mb-6 h-12 w-full rounded-2xl text-base font-medium text-white transition-colors ${
          canGenerate && !isGenerating
            ? "bg-mint hover:bg-mint-dark"
            : "cursor-not-allowed bg-muted/60"
        }`}
      >
        {generateButtonText}
      </button>

      {/* 背景点选界面 */}
      {isBackgroundSelection && gridForPreview && (
        <section className="mb-5 rounded-[20px] border border-pink/30 bg-white p-5 shadow-sm">
          <h2 className="mb-2 text-base font-medium text-brown">
            点选要删除的背景色
          </h2>
          <p className="mb-3 text-xs text-muted">
            自动检测置信度不足，请点击网格中的背景区域将其去除。满意后点击&ldquo;确认生成&rdquo;。
          </p>
          <GridPreview grid={gridForPreview} onCellClick={selectBackground} />
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={undoBackground}
              disabled={!backgroundHistory?.length}
              className="flex-1 rounded-xl border border-border px-3 py-2 text-xs text-brown transition-colors hover:border-mint disabled:opacity-40"
            >
              撤销上一步
            </button>
            <button
              type="button"
              onClick={confirmBackground}
              disabled={!backgroundHistory?.length}
              className="flex-1 rounded-xl bg-mint px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-mint-dark disabled:opacity-40"
            >
              确认生成
            </button>
          </div>
        </section>
      )}

      {/* 结果区 */}
      {status === "success" && patternDoc && patternAsset && usageAsset && (
        <ResultSection
          document={patternDoc}
          patternAsset={patternAsset}
          usageAsset={usageAsset}
        />
      )}

      <footer className="mt-auto pb-4 pt-4 text-center text-xs text-muted">
        <span>图片仅在本机处理，不上传服务器</span>
      </footer>
    </div>
  );
}
