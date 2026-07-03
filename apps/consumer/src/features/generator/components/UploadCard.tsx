"use client";

import { useRef } from "react";

interface UploadCardProps {
  /** 当前预览图 Object URL，null 表示未选择 */
  previewUrl: string | null;
  /** 文件名（如有） */
  fileName?: string;
  /** 选择文件回调 */
  onSelect: (file: File) => void;
  /** 是否禁用（生成中） */
  disabled?: boolean;
}

/**
 * 上传卡片：支持选择图片并显示本地预览。
 */
export function UploadCard({ previewUrl, fileName, onSelect, disabled }: UploadCardProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleClick = () => {
    if (!disabled) {
      inputRef.current?.click();
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onSelect(file);
    }
    // 重置 input，允许重复选择同一文件
    e.target.value = "";
  };

  return (
    <section className="mb-5 rounded-[20px] border border-border bg-white p-5 shadow-sm">
      <h2 className="mb-3 text-base font-medium text-brown">选择图片</h2>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png"
        onChange={handleChange}
        disabled={disabled}
        className="hidden"
        aria-label="选择图片文件"
      />

      {previewUrl ? (
        <div className="relative">
          <img
            src={previewUrl}
            alt="已选择的图片预览"
            className="mx-auto max-h-48 rounded-xl object-contain"
          />
          {fileName && (
            <p className="mt-2 truncate text-center text-xs text-muted">{fileName}</p>
          )}
          <button
            type="button"
            onClick={handleClick}
            disabled={disabled}
            className="mt-3 w-full rounded-xl border border-border py-2 text-sm text-brown transition-colors hover:border-mint hover:text-mint disabled:opacity-50"
          >
            更换图片
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={handleClick}
          disabled={disabled}
          className="flex h-28 w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border bg-cream-light text-muted transition-colors hover:border-mint hover:text-mint disabled:cursor-not-allowed disabled:opacity-50"
        >
          <span className="text-3xl" aria-hidden="true">+</span>
          <span className="mt-1 text-sm">选择图片</span>
        </button>
      )}

      <p className="mt-3 text-xs text-muted">
        支持 JPG / PNG。主体清楚、背景简单的图片，生成效果会更好。
      </p>
    </section>
  );
}
