"use client";

import { useState } from "react";
import type { ExportAsset } from "@/features/generator/model/types";
import { downloadImage, openOriginalImage, shareImage, isShareSupported, isWeChatBrowser } from "@/features/generator/core/saveImage";
import { ImageViewer } from "./ImageViewer";

interface ResultImageCardProps {
  title: string;
  asset: ExportAsset;
  /** 摘要文本，如 "58×44 格 · 总豆数 1234" */
  summary: string;
}

/**
 * 单张结果卡：展示缩略图、提供查看大图/保存/分享操作。
 */
export function ResultImageCard({ title, asset, summary }: ResultImageCardProps) {
  const [viewerOpen, setViewerOpen] = useState(false);
  const [shareAvailable] = useState(isShareSupported);
  const [isWeChat] = useState(isWeChatBrowser);

  const handleSave = () => {
    try {
      downloadImage(asset.blob, asset.filename);
    } catch {
      // 下载失败时尝试打开原图
      const opened = openOriginalImage(asset.dataUrl);
      if (!opened) {
        alert("保存失败，请尝试长按图片保存");
      }
    }
  };

  const handleOpenOriginal = () => {
    const opened = openOriginalImage(asset.dataUrl);
    if (!opened) {
      alert("无法打开原图，可能被浏览器拦截。请检查弹窗设置。");
    }
  };

  const handleShare = async () => {
    try {
      await shareImage(asset.blob, asset.filename);
    } catch {
      // AbortError（用户取消）已被 shareImage 内部静默处理，
      // 其他错误提示用户
      alert("分享失败，请尝试其他保存方式");
    }
  };

  return (
    <div className="rounded-[20px] border border-border bg-white p-4 shadow-sm">
      <h3 className="mb-2 text-sm font-medium text-brown">{title}</h3>

      {/* 真实 <img> 支持长按保存 */}
      <div
        className="cursor-pointer overflow-hidden rounded-xl bg-cream-light"
        onClick={() => setViewerOpen(true)}
        role="button"
        tabIndex={0}
        aria-label={`查看${title}大图`}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setViewerOpen(true);
          }
        }}
      >
        <img
          src={asset.dataUrl}
          alt={title}
          className="mx-auto max-h-60 w-auto object-contain"
          draggable
        />
      </div>

      <p className="mt-2 text-center text-xs text-muted">{summary}</p>

      {/* 操作按钮 */}
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={() => setViewerOpen(true)}
          className="flex-1 rounded-xl border border-border py-2 text-xs text-brown transition-colors hover:border-mint"
        >
          查看大图
        </button>
        <button
          type="button"
          onClick={handleSave}
          className="flex-1 rounded-xl bg-mint py-2 text-xs font-medium text-white transition-colors hover:bg-mint-dark"
        >
          保存图片
        </button>
      </div>

      <div className="mt-2 flex gap-2">
        <button
          type="button"
          onClick={handleOpenOriginal}
          className="flex-1 rounded-xl border border-border py-2 text-xs text-brown transition-colors hover:border-mint"
        >
          打开原图
        </button>
        {shareAvailable && (
          <button
            type="button"
            onClick={handleShare}
            className="flex-1 rounded-xl border border-border py-2 text-xs text-brown transition-colors hover:border-mint"
          >
            分享
          </button>
        )}
      </div>

      {/* 微信环境提示 */}
      {isWeChat && (
        <p className="mt-2 rounded-lg bg-cream-light px-3 py-2 text-xs text-muted">
          微信内可长按图片保存，或点击&ldquo;打开原图&rdquo;后长按保存
        </p>
      )}

      {/* 大图查看器 */}
      {viewerOpen && (
        <ImageViewer
          dataUrl={asset.dataUrl}
          filename={asset.filename}
          blob={asset.blob}
          onClose={() => setViewerOpen(false)}
        />
      )}
    </div>
  );
}
