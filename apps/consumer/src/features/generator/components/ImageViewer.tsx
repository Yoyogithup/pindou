"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** 最小缩放倍率 */
const MIN_SCALE = 0.5;
/** 最大缩放倍率 */
const MAX_SCALE = 8;
/** 双击放大倍率 */
const DOUBLE_TAP_SCALE = 2.5;
/** 按钮步进倍率 */
const ZOOM_STEP = 1.5;
/** 双击检测窗口（毫秒） */
const DOUBLE_TAP_WINDOW = 300;
/** 平移边界：图片至少保持多少像素在视口内 */
const PAN_EDGE_MIN = 80;

interface ImageViewerProps {
  dataUrl: string;
  filename: string;
  blob: Blob;
  onClose: () => void;
}

/**
 * 全屏大图查看器。
 *
 * 支持双指缩放、拖拽平移、双击放大/复位、+/-/复位/关闭按钮。
 * 使用 Pointer Events 统一处理鼠标和触摸，单独跟踪 active pointers
 * 以避免双指操作误触双击。
 */
export function ImageViewer({ dataUrl, filename, blob, onClose }: ImageViewerProps) {
  const [scale, setScale] = useState(1);
  const [translate, setTranslate] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  // 拖拽状态
  const dragStateRef = useRef({
    isDragging: false,
    startX: 0,
    startY: 0,
    startTx: 0,
    startTy: 0,
  });
  const [enableTransition, setEnableTransition] = useState(true);

  // 活跃指针跟踪：用于区分单指拖拽/双击 vs 多指缩放
  const activePointersRef = useRef(new Set<number>());

  // 双指缩放状态
  const pinchRef = useRef({
    isPinching: false,
    startDistance: 0,
    startScale: 1,
  });

  // 双击检测
  const lastTapRef = useRef(0);

  // 限制缩放范围
  const clampScale = useCallback((s: number) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, s)), []);

  /**
   * 约束平移范围：确保图片至少有 PAN_EDGE_MIN 像素在视口内。
   *
   * 使用 offsetWidth/offsetHeight（CSS 布局尺寸，不含 transform）
   * 乘以当前缩放倍率计算实际渲染尺寸，避免 getBoundingClientRect
   * 已含 transform 导致 scale² 重复计算。
   */
  const clampTranslate = useCallback(
    (tx: number, ty: number, currentScale: number) => {
      const img = imgRef.current;
      const viewport = containerRef.current;
      if (!img || !viewport) return { x: tx, y: ty };

      // CSS 布局尺寸 × 缩放 = 实际渲染尺寸
      const imgW = img.offsetWidth * currentScale;
      const imgH = img.offsetHeight * currentScale;
      const vpW = viewport.clientWidth;
      const vpH = viewport.clientHeight;

      // 图片中心允许的最大偏移：确保至少 PAN_EDGE_MIN 像素在视口内
      const maxX = Math.max(0, (imgW - PAN_EDGE_MIN) / 2);
      const maxY = Math.max(0, (imgH - PAN_EDGE_MIN) / 2);

      // 同时确保图片不能完全离开视口
      const absMaxX = Math.max(0, (imgW + vpW) / 2 - PAN_EDGE_MIN);
      const absMaxY = Math.max(0, (imgH + vpH) / 2 - PAN_EDGE_MIN);

      return {
        x: Math.min(Math.min(maxX, absMaxX), Math.max(-Math.min(maxX, absMaxX), tx)),
        y: Math.min(Math.min(maxY, absMaxY), Math.max(-Math.min(maxY, absMaxY), ty)),
      };
    },
    []
  );

  // 复位
  const handleReset = useCallback(() => {
    setScale(1);
    setTranslate({ x: 0, y: 0 });
  }, []);

  // 缩放（以中心为基准）
  const handleZoom = useCallback(
    (factor: number) => {
      setScale((prev) => {
        const next = clampScale(prev * factor);
        // 缩放后约束平移
        setTranslate((t) => clampTranslate(t.x, t.y, next));
        return next;
      });
    },
    [clampScale, clampTranslate]
  );

  // 统一 Pointer Events 处理
  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      // 跟踪活跃指针
      activePointersRef.current.add(e.pointerId);

      // 多指时不做双击检测、不启动拖拽
      if (activePointersRef.current.size > 1) {
        lastTapRef.current = 0;
        dragStateRef.current.isDragging = false;
        return;
      }

      // 双击检测（仅单指）
      const now = Date.now();
      if (now - lastTapRef.current < DOUBLE_TAP_WINDOW) {
        // 双击：放大或复位
        const nextScale = scale > 1.1 ? 1 : DOUBLE_TAP_SCALE;
        setScale(nextScale);
        setTranslate(clampTranslate(0, 0, nextScale));
        lastTapRef.current = 0;
        activePointersRef.current.delete(e.pointerId);
        return;
      }
      lastTapRef.current = now;

      // 单指拖拽
      dragStateRef.current = {
        isDragging: true,
        startX: e.clientX,
        startY: e.clientY,
        startTx: translate.x,
        startTy: translate.y,
      };
      setEnableTransition(false);
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    },
    [translate.x, translate.y, scale, clampTranslate]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      const state = dragStateRef.current;
      if (!state.isDragging) return;

      const dx = e.clientX - state.startX;
      const dy = e.clientY - state.startY;
      setTranslate(
        clampTranslate(state.startTx + dx, state.startTy + dy, scale)
      );
    },
    [scale, clampTranslate]
  );

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    activePointersRef.current.delete(e.pointerId);
    dragStateRef.current.isDragging = false;
    setEnableTransition(true);
  }, []);

  // 触摸事件：双指缩放
  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (e.touches.length === 2) {
        // 进入 pinch 模式，取消双击计时器和拖拽
        lastTapRef.current = 0;
        dragStateRef.current.isDragging = false;

        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        pinchRef.current = {
          isPinching: true,
          startDistance: Math.hypot(dx, dy),
          startScale: scale,
        };
      }
    },
    [scale]
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (e.touches.length === 2 && pinchRef.current.isPinching) {
        e.preventDefault();
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const distance = Math.hypot(dx, dy);
        const ratio = distance / pinchRef.current.startDistance;
        const nextScale = clampScale(pinchRef.current.startScale * ratio);
        setScale(nextScale);
        setTranslate((t) => clampTranslate(t.x, t.y, nextScale));
      }
    },
    [clampScale, clampTranslate]
  );

  const handleTouchEnd = useCallback(() => {
    pinchRef.current.isPinching = false;
  }, []);

  // 滚轮缩放
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const factor = e.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP;
      setScale((prev) => {
        const next = clampScale(prev * factor);
        setTranslate((t) => clampTranslate(t.x, t.y, next));
        return next;
      });
    };

    container.addEventListener("wheel", handleWheel, { passive: false });
    return () => container.removeEventListener("wheel", handleWheel);
  }, [clampScale, clampTranslate]);

  // ESC 关闭
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  // 阻止背景滚动
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const handleDownload = () => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-50 flex flex-col bg-black/90"
      role="dialog"
      aria-label="图片查看器"
    >
      {/* 顶部工具栏 */}
      <div className="flex items-center justify-between px-4 py-3">
        <span className="text-xs text-white/70">{filename}</span>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg bg-white/10 px-3 py-1.5 text-sm text-white transition-colors hover:bg-white/20"
          aria-label="关闭"
        >
          关闭
        </button>
      </div>

      {/* 图片区域 */}
      <div
        className="flex flex-1 items-center justify-center overflow-hidden"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{ touchAction: "none" }}
      >
        <img
          ref={imgRef}
          src={dataUrl}
          alt={filename}
          draggable={false}
          className="max-h-full max-w-full select-none"
          style={{
            transform: `translate(${translate.x}px, ${translate.y}px) scale(${scale})`,
            transformOrigin: "center center",
            transition: enableTransition ? "transform 0.2s" : "none",
          }}
        />
      </div>

      {/* 底部控制栏 */}
      <div className="flex items-center justify-center gap-3 px-4 py-3">
        <button
          type="button"
          onClick={() => handleZoom(1 / ZOOM_STEP)}
          className="rounded-lg bg-white/10 px-3 py-2 text-lg text-white hover:bg-white/20"
          aria-label="缩小"
        >
          −
        </button>
        <span className="min-w-[3rem] text-center text-sm text-white/70">
          {Math.round(scale * 100)}%
        </span>
        <button
          type="button"
          onClick={() => handleZoom(ZOOM_STEP)}
          className="rounded-lg bg-white/10 px-3 py-2 text-lg text-white hover:bg-white/20"
          aria-label="放大"
        >
          +
        </button>
        <button
          type="button"
          onClick={handleReset}
          className="rounded-lg bg-white/10 px-3 py-2 text-xs text-white hover:bg-white/20"
          aria-label="复位"
        >
          复位
        </button>
        <button
          type="button"
          onClick={handleDownload}
          className="rounded-lg bg-mint px-3 py-2 text-xs font-medium text-white hover:bg-mint-dark"
        >
          保存
        </button>
      </div>
    </div>
  );
}
