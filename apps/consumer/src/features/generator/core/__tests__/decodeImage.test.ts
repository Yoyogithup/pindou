/** @jest-environment jsdom */

import { validateFile, decodeImage } from "../decodeImage";

/**
 * 图片解码测试。
 *
 * V0 方案：decodeImage 依赖浏览器默认 from-image 自动 EXIF 纠正，
 * 不做任何手工方向变换。测试验证：
 * 1. 文件校验（类型、大小、空文件）
 * 2. createImageBitmap 路径正确使用默认参数
 * 3. <img> 降级路径可完成解码
 * 4. 降采样逻辑正确
 */

// ---------- validateFile 测试 ----------

describe("validateFile", () => {
  function makeFile(size: number, type: string): File {
    const data = new Uint8Array(size);
    return new File([data], "test.jpg", { type });
  }

  it("合法 JPEG 通过校验", () => {
    expect(() => validateFile(makeFile(1024, "image/jpeg"))).not.toThrow();
  });

  it("合法 PNG 通过校验", () => {
    expect(() => validateFile(makeFile(1024, "image/png"))).not.toThrow();
  });

  it("不支持的文件类型抛错", () => {
    expect(() => validateFile(makeFile(1024, "image/gif"))).toThrow("不支持的文件类型");
  });

  it("空文件抛错", () => {
    expect(() => validateFile(makeFile(0, "image/jpeg"))).toThrow("文件为空");
  });

  it("超大文件抛错", () => {
    const bigFile = makeFile(21 * 1024 * 1024, "image/jpeg");
    expect(() => validateFile(bigFile)).toThrow("文件过大");
  });

  it("null 抛错", () => {
    expect(() => validateFile(null as unknown as File)).toThrow("有效的图片文件");
  });
});

// ---------- decodeImage 测试 ----------

describe("decodeImage", () => {
  const origCreateImageBitmap = globalThis.createImageBitmap;

  afterEach(() => {
    // 恢复 createImageBitmap
    if (origCreateImageBitmap) {
      globalThis.createImageBitmap = origCreateImageBitmap;
    } else {
      delete (globalThis as Record<string, unknown>).createImageBitmap;
    }
  });

  function makeTestFile(): File {
    return new File([new Uint8Array(100)], "test.jpg", { type: "image/jpeg" });
  }

  it("createImageBitmap 路径：使用默认参数（from-image）", async () => {
    // Mock createImageBitmap 返回一个 mock bitmap
    const mockBitmap = {
      width: 200,
      height: 100,
      close: jest.fn(),
    };
    const mockCreateImageBitmap = jest.fn().mockResolvedValue(mockBitmap);
    (globalThis as Record<string, unknown>).createImageBitmap = mockCreateImageBitmap;

    // Mock canvas getContext
    const mockGetImageData = jest.fn().mockReturnValue({
      data: new Uint8ClampedArray(200 * 100 * 4),
      width: 200,
      height: 100,
    });
    jest.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      imageSmoothingEnabled: true,
      drawImage: jest.fn(),
      getImageData: mockGetImageData,
    } as unknown as CanvasRenderingContext2D);

    const file = makeTestFile();
    const result = await decodeImage(file);

    // 验证 createImageBitmap 只接受 file 参数（默认 from-image）
    expect(mockCreateImageBitmap).toHaveBeenCalledWith(file);
    expect(mockCreateImageBitmap).not.toHaveBeenCalledWith(
      file,
      expect.objectContaining({ imageOrientation: "none" })
    );

    // 验证结果尺寸
    expect(result.width).toBe(200);
    expect(result.height).toBe(100);

    // 验证 bitmap.close() 被调用
    expect(mockBitmap.close).toHaveBeenCalled();

    jest.restoreAllMocks();
  });

  it("createImageBitmap 路径：超长边超过 2048 时降采样", async () => {
    const mockBitmap = { width: 4096, height: 2048, close: jest.fn() };
    (globalThis as Record<string, unknown>).createImageBitmap = jest
      .fn()
      .mockResolvedValue(mockBitmap);

    const drawnWidths: number[] = [];
    const drawnHeights: number[] = [];
    jest.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(function (
      this: HTMLCanvasElement
    ) {
      return {
        imageSmoothingEnabled: true,
        drawImage: jest.fn((...args: unknown[]) => {
          drawnWidths.push(args[3] as number);
          drawnHeights.push(args[4] as number);
        }),
        getImageData: jest.fn().mockReturnValue({
          data: new Uint8ClampedArray(2048 * 1024 * 4),
          width: 2048,
          height: 1024,
        }),
      } as unknown as CanvasRenderingContext2D;
    } as never);

    const file = makeTestFile();
    const result = await decodeImage(file);

    // 4096×2048 → 最长边 2048 → 2048×1024
    expect(result.width).toBe(2048);
    expect(result.height).toBe(1024);
    expect(drawnWidths[0]).toBe(2048);
    expect(drawnHeights[0]).toBe(1024);

    jest.restoreAllMocks();
  });

  it("createImageBitmap 失败时降级到 <img> 路径", async () => {
    // createImageBitmap 抛错
    (globalThis as Record<string, unknown>).createImageBitmap = jest
      .fn()
      .mockRejectedValue(new Error("not supported"));

    // Mock Image
    const mockImg = {
      naturalWidth: 100,
      naturalHeight: 80,
      onload: null as (() => void) | null,
      onerror: null as (() => void) | null,
      src: "",
      style: {} as CSSStyleDeclaration,
    };
    const origImage = globalThis.Image;
    (globalThis as Record<string, unknown>).Image = jest.fn(() => {
      setTimeout(() => mockImg.onload?.(), 0);
      return mockImg;
    });

    jest.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      imageSmoothingEnabled: true,
      drawImage: jest.fn(),
      getImageData: jest.fn().mockReturnValue({
        data: new Uint8ClampedArray(100 * 80 * 4),
        width: 100,
        height: 80,
      }),
    } as unknown as CanvasRenderingContext2D);

    const file = makeTestFile();
    const result = await decodeImage(file);

    expect(result.width).toBe(100);
    expect(result.height).toBe(80);

    // 确认没有设置 imageOrientation: "none"（浏览器自动纠正）
    expect(mockImg.style).not.toHaveProperty("imageOrientation", "none");

    (globalThis as Record<string, unknown>).Image = origImage;
    jest.restoreAllMocks();
  });

  it("createImageBitmap 不存在时降级到 <img> 路径", async () => {
    delete (globalThis as Record<string, unknown>).createImageBitmap;

    const mockImg = {
      naturalWidth: 50,
      naturalHeight: 50,
      onload: null as (() => void) | null,
      onerror: null as (() => void) | null,
      src: "",
      style: {} as CSSStyleDeclaration,
    };
    const origImage = globalThis.Image;
    (globalThis as Record<string, unknown>).Image = jest.fn(() => {
      setTimeout(() => mockImg.onload?.(), 0);
      return mockImg;
    });

    jest.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      imageSmoothingEnabled: true,
      drawImage: jest.fn(),
      getImageData: jest.fn().mockReturnValue({
        data: new Uint8ClampedArray(50 * 50 * 4),
        width: 50,
        height: 50,
      }),
    } as unknown as CanvasRenderingContext2D);

    const file = makeTestFile();
    const result = await decodeImage(file);

    expect(result.width).toBe(50);
    expect(result.height).toBe(50);

    (globalThis as Record<string, unknown>).Image = origImage;
    jest.restoreAllMocks();
  });

  it("文件校验不通过时直接抛错", async () => {
    const badFile = new File([new Uint8Array(100)], "test.gif", { type: "image/gif" });
    await expect(decodeImage(badFile)).rejects.toThrow("不支持的文件类型");
  });
});
