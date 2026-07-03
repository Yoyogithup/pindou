/**
 * Node / Jest 测试环境 Canvas 适配器。
 *
 * 使用 `canvas` npm 包在 Node 环境下生成 PNG Buffer，再包装为 Blob。
 * 该文件仅在测试中被引用，不得被生产客户端代码打包。
 */

/**
 * 创建指定尺寸的 Canvas（Node 环境使用 canvas 包）。
 */
export function createCanvas(width: number, height: number): HTMLCanvasElement {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Canvas } = require("canvas") as typeof import("canvas");
  const canvas = new Canvas(width, height);
  return canvas as unknown as HTMLCanvasElement;
}

interface NodeCanvas {
  toBuffer(format: "image/png" | "image/jpeg", quality?: number): Buffer;
}

/**
 * 将 Canvas 转换为 PNG Blob（Node 环境回退到 toBuffer + node:buffer Blob）。
 */
export async function canvasToBlob(canvas: HTMLCanvasElement, type = "image/png"): Promise<Blob> {
  const buffer = (canvas as unknown as NodeCanvas).toBuffer(type as "image/png" | "image/jpeg");

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Blob: NodeBlob } = require("node:buffer") as typeof import("node:buffer");
  return new NodeBlob([buffer], { type }) as unknown as Blob;
}

/**
 * 将 Blob 转换为 data: URL（Node 环境使用 Buffer base64 编码）。
 */
export async function blobToDataUrl(blob: Blob): Promise<string> {
  const arrayBuffer = await blob.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString("base64");
  return `data:${blob.type || "image/png"};base64,${base64}`;
}
