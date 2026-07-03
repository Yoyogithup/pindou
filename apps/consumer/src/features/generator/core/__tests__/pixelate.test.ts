/** @jest-environment jsdom */

import { pixelate } from "../pixelate";

/** jsdom 不含 ImageData，手动构造兼容对象 */
function makeImageData(width: number, height: number, fill: [number, number, number, number]): ImageData {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    data[i * 4] = fill[0];
    data[i * 4 + 1] = fill[1];
    data[i * 4 + 2] = fill[2];
    data[i * 4 + 3] = fill[3];
  }
  return { data, width, height, colorSpace: "srgb" } as unknown as ImageData;
}

function makeCheckeredImageData(width: number, height: number): ImageData {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      if (x < width / 2 && y < height / 2) {
        data[idx] = 255; data[idx + 1] = 0; data[idx + 2] = 0; data[idx + 3] = 255;
      } else if (x >= width / 2 && y < height / 2) {
        data[idx] = 0; data[idx + 1] = 255; data[idx + 2] = 0; data[idx + 3] = 255;
      } else if (x < width / 2 && y >= height / 2) {
        data[idx] = 0; data[idx + 1] = 0; data[idx + 2] = 255; data[idx + 3] = 255;
      } else {
        data[idx] = 255; data[idx + 1] = 255; data[idx + 2] = 0; data[idx + 3] = 255;
      }
    }
  }
  return { data, width, height, colorSpace: "srgb" } as unknown as ImageData;
}

describe("pixelate", () => {
  it("dominant 模式：2x2 网格输出确定性 HEX", () => {
    const img = makeImageData(100, 100, [255, 0, 0, 255]); // 全红
    const grid = pixelate(img, { width: 2, height: 2 }, "dominant");

    expect(grid.length).toBe(2);
    expect(grid[0].length).toBe(2);
    for (const row of grid) {
      for (const hex of row) {
        expect(hex).toBe("#FF0000");
      }
    }
  });

  it("average 模式：均匀颜色输出相同 HEX", () => {
    const img = makeImageData(100, 100, [0, 128, 0, 255]); // 全绿
    const grid = pixelate(img, { width: 3, height: 3 }, "average");

    for (const row of grid) {
      for (const hex of row) {
        expect(hex).toBe("#008000");
      }
    }
  });

  it("透明像素输出 null", () => {
    const img = makeImageData(10, 10, [255, 0, 0, 0]); // 全透明
    const grid = pixelate(img, { width: 2, height: 2 }, "dominant");

    for (const row of grid) {
      for (const hex of row) {
        expect(hex).toBeNull();
      }
    }
  });

  it("四分色图 dominant 输出 4 种不同颜色", () => {
    const img = makeCheckeredImageData(100, 100);
    const grid = pixelate(img, { width: 2, height: 2 }, "dominant");

    const colors = new Set<string | null>();
    for (const row of grid) {
      for (const hex of row) {
        colors.add(hex);
      }
    }
    expect(colors.size).toBe(4);
  });

  it("1x1 网格输出单格", () => {
    const img = makeImageData(50, 50, [128, 128, 128, 255]);
    const grid = pixelate(img, { width: 1, height: 1 }, "dominant");

    expect(grid.length).toBe(1);
    expect(grid[0].length).toBe(1);
    expect(grid[0][0]).toBe("#808080");
  });

  it("非法 ImageData 抛错", () => {
    const img = { data: new Uint8ClampedArray(0), width: 0, height: 0 } as unknown as ImageData;
    expect(() => pixelate(img, { width: 2, height: 2 }, "dominant")).toThrow("尺寸必须大于零");
  });

  it("非法网格尺寸抛错", () => {
    const img = makeImageData(10, 10, [255, 0, 0, 255]);
    expect(() => pixelate(img, { width: 0, height: 2 }, "dominant")).toThrow("非法网格尺寸");
  });

  it("1×1 图片生成 72×72 average 网格不产生意外 null", () => {
    // 单个像素的不透明图片，放大到 72×72 网格，每格至少采样 1 个像素
    const img = makeImageData(1, 1, [200, 100, 50, 255]);
    const grid = pixelate(img, { width: 72, height: 72 }, "average");

    expect(grid.length).toBe(72);
    expect(grid[0].length).toBe(72);
    // 每格都应该有值（不为 null），因为源像素不透明
    let nullCount = 0;
    for (const row of grid) {
      for (const hex of row) {
        if (hex === null) nullCount++;
      }
    }
    expect(nullCount).toBe(0);
  });

  it("1×1 透明图片生成 72×72 average 网格全为 null", () => {
    const img = makeImageData(1, 1, [200, 100, 50, 0]);
    const grid = pixelate(img, { width: 72, height: 72 }, "average");

    for (const row of grid) {
      for (const hex of row) {
        expect(hex).toBeNull();
      }
    }
  });
});
