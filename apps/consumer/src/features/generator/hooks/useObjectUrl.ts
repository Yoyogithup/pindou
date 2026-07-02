/**
 * Object URL 生命周期管理。
 *
 * 跟踪所有注册的 Object URL，在组件卸载或 URL 列表变更时自动释放旧 URL。
 */

import { useEffect, useRef } from "react";

/**
 * 跟踪一组 Object URL，在列表变更时释放旧 URL，组件卸载时释放所有 URL。
 *
 * @param urls 当前活跃的 Object URL 列表
 */
export function useObjectUrl(urls: (string | null | undefined)[]): void {
  const prevUrlsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const currentUrls = new Set<string>();
    for (const url of urls) {
      if (url && url.startsWith("blob:")) {
        currentUrls.add(url);
      }
    }

    // 释放不在当前列表中的旧 URL
    for (const prevUrl of prevUrlsRef.current) {
      if (!currentUrls.has(prevUrl)) {
        URL.revokeObjectURL(prevUrl);
      }
    }

    prevUrlsRef.current = currentUrls;
  }, [urls]);

  // 组件卸载时释放所有 URL
  useEffect(() => {
    return () => {
      for (const url of prevUrlsRef.current) {
        URL.revokeObjectURL(url);
      }
      prevUrlsRef.current = new Set();
    };
  }, []);
}

/**
 * 释放单个 Object URL（安全版本，忽略非 blob URL）。
 */
export function revokeObjectUrl(url: string | null | undefined): void {
  if (url && url.startsWith("blob:")) {
    URL.revokeObjectURL(url);
  }
}
