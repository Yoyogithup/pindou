/**
 * 图片解码。
 *
 * V0 方案：依赖浏览器默认 `from-image` 自动 EXIF 纠正。
 * 优先使用 `createImageBitmap(file)`（默认 from-image）；
 * 降级使用 `<img>` + canvas（现代浏览器默认自动纠正 EXIF）。
 *
 * 不做任何手工 EXIF 读取或方向变换。
 * 预览、解码尺寸、网格尺寸和最终 PNG 方向均消费同一份浏览器纠正后的像素。
 *
 * 解码后将最长边限制在 MAX_LONG_EDGE 以控制内存。
 */

/** 允许的文件类型 */
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png"]);

/** 最大文件大小（20 MB） */
const MAX_FILE_SIZE = 20 * 1024 * 1024;

/** 解码后最长边像素数（控制手机内存） */
const MAX_LONG_EDGE = 2048;

export interface DecodedImage {
  imageData: ImageData;
  /** 浏览器纠正后的宽度 */
  width: number;
  /** 浏览器纠正后的高度 */
  height: number;
}

/**
 * 校验文件类型和大小。
 */
export function validateFile(file: File): void {
  if (!file || !(file instanceof File)) {
    throw new Error("请选择一个有效的图片文件");
  }
  if (!ALLOWED_TYPES.has(file.type)) {
    throw new Error(`不支持的文件类型: ${file.type || "未知"}，请选择 JPG 或 PNG`);
  }
  if (file.size > MAX_FILE_SIZE) {
    const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
    throw new Error(`文件过大 (${sizeMB} MB)，请选择 20 MB 以内的图片`);
  }
  if (file.size === 0) {
    throw new Error("文件为空，请选择一个有效的图片");
  }
}

/**
 * 使用 createImageBitmap（默认 from-image）解码图片。
 * 浏览器自动纠正 EXIF 方向，返回纠正后的宽高。
 */
async function decodeWithImageBitmap(file: File): Promise<DecodedImage> {
  const bitmap = await createImageBitmap(file);
  try {
    const srcW = bitmap.width;
    const srcH = bitmap.height;
    if (srcW === 0 || srcH === 0) {
      throw new Error("图片尺寸为零，可能是损坏的文件");
    }

    const { finalW, finalH } = computeDownsampleSize(srcW, srcH);

    const canvas = document.createElement("canvas");
    canvas.width = finalW;
    canvas.height = finalH;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) {
      throw new Error("无法创建 Canvas 上下文");
    }

    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(bitmap, 0, 0, finalW, finalH);
    const imageData = ctx.getImageData(0, 0, finalW, finalH);

    return { imageData, width: finalW, height: finalH };
  } finally {
    bitmap.close?.();
  }
}

/**
 * 使用 <img> + canvas 降级解码。
 * 现代浏览器默认自动纠正 EXIF 方向。
 */
function decodeWithImage(file: File): Promise<DecodedImage> {
  return new Promise<DecodedImage>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      try {
        const srcW = img.naturalWidth;
        const srcH = img.naturalHeight;
        if (srcW === 0 || srcH === 0) {
          throw new Error("图片尺寸为零，可能是损坏的文件");
        }

        const { finalW, finalH } = computeDownsampleSize(srcW, srcH);

        const canvas = document.createElement("canvas");
        canvas.width = finalW;
        canvas.height = finalH;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) {
          throw new Error("无法创建 Canvas 上下文");
        }

        ctx.imageSmoothingEnabled = true;
        ctx.drawImage(img, 0, 0, finalW, finalH);
        URL.revokeObjectURL(url);

        const imageData = ctx.getImageData(0, 0, finalW, finalH);
        resolve({ imageData, width: finalW, height: finalH });
      } catch (err) {
        URL.revokeObjectURL(url);
        reject(err);
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("图片解码失败，请尝试其他图片"));
    };

    img.src = url;
  });
}

/**
 * 计算降采样尺寸（最长边不超过 MAX_LONG_EDGE）。
 */
function computeDownsampleSize(
  srcW: number,
  srcH: number
): { finalW: number; finalH: number } {
  const longEdge = Math.max(srcW, srcH);
  let scale = 1;
  if (longEdge > MAX_LONG_EDGE) {
    scale = MAX_LONG_EDGE / longEdge;
  }
  const finalW = Math.round(srcW * scale);
  const finalH = Math.round(srcH * scale);
  if (finalW === 0 || finalH === 0) {
    throw new Error("图片尺寸过小，无法处理");
  }
  return { finalW, finalH };
}

/**
 * 解码图片。
 *
 * 优先使用 createImageBitmap（默认 from-image 自动 EXIF 纠正）；
 * 降级使用 <img> + canvas（现代浏览器同样自动纠正）。
 * 两条路径都消费浏览器纠正后的像素，不做任何手工方向变换。
 *
 * @param file JPG 或 PNG 文件
 * @returns 解码后的 ImageData 及纠正后尺寸
 */
export async function decodeImage(file: File): Promise<DecodedImage> {
  validateFile(file);

  // 优先路径：createImageBitmap
  if (typeof createImageBitmap === "function") {
    try {
      return await decodeWithImageBitmap(file);
    } catch {
      // createImageBitmap 不支持或失败，进入降级路径
    }
  }

  // 降级路径：<img> + canvas
  return decodeWithImage(file);
}
