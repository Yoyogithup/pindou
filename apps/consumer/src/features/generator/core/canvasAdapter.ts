/**
 * 浏览器环境 Canvas 适配器。
 *
 * 仅在浏览器 / Next.js 客户端构建中使用，不包含任何 Node-only 依赖或 require。
 * Node / Jest 测试环境通过 jest.config.ts 的 moduleNameMapper 替换为
 * canvasAdapter.node.ts。
 */

/**
 * 创建指定尺寸的 Canvas。
 */
export function createCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

/**
 * 将 Canvas 转换为 PNG Blob。
 */
export async function canvasToBlob(canvas: HTMLCanvasElement, type = "image/png"): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("canvas.toBlob returned null"));
    }, type);
  });
}

/**
 * 将 Blob 转换为 data: URL（base64）。
 *
 * data: URL 在微信 WKWebView 中支持长按保存，而 blob: URL 不支持。
 */
export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("FileReader failed"));
    reader.readAsDataURL(blob);
  });
}
