/**
 * 保存与分享工具。
 *
 * 提供下载、打开原图、系统分享能力，以及微信环境检测。
 */

/**
 * 检测当前是否在微信内置浏览器中。
 */
export function isWeChatBrowser(): boolean {
  if (typeof navigator === "undefined") return false;
  return /MicroMessenger/i.test(navigator.userAgent);
}

/**
 * 检测系统分享（Web Share API + 文件分享）是否可用。
 */
export function isShareSupported(): boolean {
  if (typeof navigator === "undefined") return false;
  if (!navigator.share) return false;
  if (!navigator.canShare) return false;
  // 测试文件分享能力
  try {
    const testFile = new File(["test"], "test.png", { type: "image/png" });
    return navigator.canShare({ files: [testFile] });
  } catch {
    return false;
  }
}

/**
 * 下载图片：创建隐藏 <a download> 并触发点击。
 *
 * @param blob 图片 Blob
 * @param filename 文件名
 */
export function downloadImage(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // 延迟释放，确保下载启动
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * 打开原图：在新标签页打开图片 URL，用户可使用浏览器原生缩放和长按保存。
 *
 * @param imageUrl 图片 URL（data: 或 blob:）
 * @returns true 表示成功打开，false 表示被弹窗拦截或失败
 */
export function openOriginalImage(imageUrl: string): boolean {
  const win = window.open(imageUrl, "_blank");
  return win !== null;
}

/**
 * 系统分享：将图片分享到系统目标。
 *
 * @param blob 图片 Blob
 * @param filename 文件名
 * @throws 分享不支持或被用户取消时抛出明确错误
 */
export async function shareImage(blob: Blob, filename: string): Promise<void> {
  if (!isShareSupported()) {
    throw new Error("当前浏览器不支持系统分享");
  }

  const file = new File([blob], filename, { type: blob.type });
  try {
    await navigator.share({
      files: [file],
      title: "拼豆小纸条",
    });
  } catch (err) {
    // AbortError 表示用户主动取消，不是错误
    if (err instanceof DOMException && err.name === "AbortError") {
      return;
    }
    throw new Error("分享失败，请尝试其他保存方式");
  }
}
