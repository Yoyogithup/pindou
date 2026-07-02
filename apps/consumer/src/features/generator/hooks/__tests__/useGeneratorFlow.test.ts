/** @jest-environment jsdom */

import { renderHook, act } from "@testing-library/react";
import { useGeneratorFlow } from "../useGeneratorFlow";

// ---------- mocks ----------

const mockDecodeImage = jest.fn();
const mockPreparePattern = jest.fn();
const mockFinalizePattern = jest.fn();
const mockRemoveBackgroundFromSelection = jest.fn();
const mockRenderPatternPng = jest.fn();
const mockRenderUsagePng = jest.fn();
const mockRevokeObjectUrl = jest.fn();

jest.mock("../../core/decodeImage", () => ({
  decodeImage: (...args: unknown[]) => mockDecodeImage(...args),
}));

jest.mock("../../core/generatePattern", () => ({
  preparePattern: (...args: unknown[]) => mockPreparePattern(...args),
  finalizePattern: (...args: unknown[]) => mockFinalizePattern(...args),
}));

jest.mock("../../core/backgroundRemoval", () => ({
  removeBackgroundFromSelection: (...args: unknown[]) =>
    mockRemoveBackgroundFromSelection(...args),
}));

jest.mock("../../core/renderPatternPng", () => ({
  renderPatternPng: (...args: unknown[]) => mockRenderPatternPng(...args),
}));

jest.mock("../../core/renderUsagePng", () => ({
  renderUsagePng: (...args: unknown[]) => mockRenderUsagePng(...args),
}));

jest.mock("../useObjectUrl", () => ({
  revokeObjectUrl: (...args: unknown[]) => mockRevokeObjectUrl(...args),
  useObjectUrl: jest.fn(),
}));

jest.mock("../../data/devPalette", () => ({
  DEV_PALETTE: [{ code: "A1", hex: "#FF0000" }],
}));

// ---------- helpers ----------

const fakeFile = new File(["fake"], "test.png", { type: "image/png" });
const fakeDoc = { cells: [], palette: [], gridSize: { width: 10, height: 10 } };

/** jsdom 无 ImageData，构造兼容替身 */
function fakeImageData(w: number, h: number) {
  return { data: new Uint8ClampedArray(w * h * 4), width: w, height: h, colorSpace: "srgb" } as unknown as globalThis.ImageData;
}

function makeGrid(w: number, h: number) {
  return Array.from({ length: h }, () =>
    Array.from({ length: w }, () => "#FF0000")
  );
}

function mockAutoSuccess() {
  const grid = makeGrid(2, 2);
  mockDecodeImage.mockResolvedValue({
    imageData: fakeImageData(2, 2),
    width: 2,
    height: 2,
  });
  mockPreparePattern.mockReturnValue({
    gridSize: { width: 2, height: 2 },
    limitedGrid: grid,
    backgroundResult: { grid, removedCount: 4, confidence: 0.99 },
    requiresBackgroundSelection: false,
    preset: { paletteId: "MARD", beadSizeMm: 2.6, gridType: "hex" },
    palette: [{ code: "A1", hex: "#FF0000" }],
  });
  mockFinalizePattern.mockReturnValue(fakeDoc);
  mockRenderPatternPng.mockResolvedValue({
    dataUrl: "data:image/png;base64,pattern",
    width: 10,
    height: 10,
    fileSizeBytes: 100,
  });
  mockRenderUsagePng.mockResolvedValue({
    dataUrl: "data:image/png;base64,usage",
    width: 10,
    height: 10,
    fileSizeBytes: 100,
  });
}

function mockNeedsBackgroundSelection() {
  const grid = makeGrid(3, 3);
  mockDecodeImage.mockResolvedValue({
    imageData: fakeImageData(3, 3),
    width: 3,
    height: 3,
  });
  mockPreparePattern.mockReturnValue({
    gridSize: { width: 3, height: 3 },
    limitedGrid: grid,
    backgroundResult: { grid, removedCount: 0, confidence: 0.3 },
    requiresBackgroundSelection: true,
    preset: { paletteId: "MARD", beadSizeMm: 2.6, gridType: "hex" },
    palette: [{ code: "A1", hex: "#FF0000" }],
  });
  mockFinalizePattern.mockReturnValue(fakeDoc);
  mockRenderPatternPng.mockResolvedValue({
    dataUrl: "data:image/png;base64,pattern",
    width: 10,
    height: 10,
    fileSizeBytes: 100,
  });
  mockRenderUsagePng.mockResolvedValue({
    dataUrl: "data:image/png;base64,usage",
    width: 10,
    height: 10,
    fileSizeBytes: 100,
  });
}

// ---------- tests ----------

describe("useGeneratorFlow 状态机", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(URL, "createObjectURL").mockReturnValue("blob:preview");
    jest.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
  });

  it("初始状态为 idle", () => {
    const { result } = renderHook(() =>
      useGeneratorFlow("keychain", "standard")
    );
    expect(result.current.status).toBe("idle");
    expect(result.current.file).toBeNull();
    expect(result.current.backgroundHistory).toEqual([]);
  });

  it("selectImage 进入 imageSelected", async () => {
    const { result } = renderHook(() =>
      useGeneratorFlow("keychain", "standard")
    );

    await act(async () => {
      result.current.selectImage(fakeFile);
    });

    expect(result.current.status).toBe("imageSelected");
    expect(result.current.file).toBe(fakeFile);
  });

  it("generate() 自动去背景成功时直接进入 success", async () => {
    mockAutoSuccess();
    const { result } = renderHook(() =>
      useGeneratorFlow("keychain", "standard")
    );

    await act(async () => {
      result.current.selectImage(fakeFile);
    });

    await act(async () => {
      result.current.generate();
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(result.current.status).toBe("success");
    expect(result.current.document).toBe(fakeDoc);
  });

  it("generate() 需要点选时进入 backgroundSelection", async () => {
    mockNeedsBackgroundSelection();
    const { result } = renderHook(() =>
      useGeneratorFlow("keychain", "standard")
    );

    await act(async () => {
      result.current.selectImage(fakeFile);
    });

    await act(async () => {
      result.current.generate();
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(result.current.status).toBe("backgroundSelection");
    expect(result.current.gridForPreview).toBeTruthy();
    expect(result.current.prepared).toBeTruthy();
    expect(result.current.backgroundHistory).toEqual([]);
  });

  it("[P0] selectBackground 仅更新预览和历史，不调用 finalizePattern", async () => {
    mockNeedsBackgroundSelection();
    const { result } = renderHook(() =>
      useGeneratorFlow("keychain", "standard")
    );

    await act(async () => {
      result.current.selectImage(fakeFile);
    });
    await act(async () => {
      result.current.generate();
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(result.current.status).toBe("backgroundSelection");
    const gridBefore = result.current.gridForPreview;

    const newGrid = makeGrid(3, 3);
    newGrid[0][0] = null;
    mockRemoveBackgroundFromSelection.mockReturnValue({
      grid: newGrid,
      removedCount: 1,
      confidence: 0.9,
    });

    await act(async () => {
      result.current.selectBackground(0, 0);
    });

    // 仍在 backgroundSelection
    expect(result.current.status).toBe("backgroundSelection");
    expect(result.current.gridForPreview).toBe(newGrid);
    expect(result.current.backgroundHistory).toEqual([gridBefore]);
    expect(mockFinalizePattern).not.toHaveBeenCalled();
  });

  it("[P0] undoBackground 恢复上一步的网格", async () => {
    mockNeedsBackgroundSelection();
    const { result } = renderHook(() =>
      useGeneratorFlow("keychain", "standard")
    );

    await act(async () => {
      result.current.selectImage(fakeFile);
    });
    await act(async () => {
      result.current.generate();
      await new Promise((r) => setTimeout(r, 50));
    });

    const gridBefore = result.current.gridForPreview;

    const newGrid = makeGrid(3, 3);
    newGrid[0][0] = null;
    mockRemoveBackgroundFromSelection.mockReturnValue({
      grid: newGrid,
      removedCount: 1,
      confidence: 0.9,
    });

    await act(async () => {
      result.current.selectBackground(0, 0);
    });
    expect(result.current.gridForPreview).toBe(newGrid);
    expect(result.current.backgroundHistory.length).toBe(1);

    await act(async () => {
      result.current.undoBackground();
    });
    expect(result.current.gridForPreview).toBe(gridBefore);
    expect(result.current.backgroundHistory).toEqual([]);
  });

  it("[P0] confirmBackground 触发 finalize 并进入 success", async () => {
    mockNeedsBackgroundSelection();
    const { result } = renderHook(() =>
      useGeneratorFlow("keychain", "standard")
    );

    await act(async () => {
      result.current.selectImage(fakeFile);
    });
    await act(async () => {
      result.current.generate();
      await new Promise((r) => setTimeout(r, 50));
    });

    const newGrid = makeGrid(3, 3);
    mockRemoveBackgroundFromSelection.mockReturnValue({
      grid: newGrid,
      removedCount: 1,
      confidence: 0.9,
    });
    await act(async () => {
      result.current.selectBackground(0, 0);
    });

    await act(async () => {
      result.current.confirmBackground();
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(mockFinalizePattern).toHaveBeenCalled();
    expect(result.current.status).toBe("success");
    expect(result.current.document).toBe(fakeDoc);
    expect(result.current.patternAsset?.dataUrl).toBe("data:image/png;base64,pattern");
    expect(result.current.usageAsset?.dataUrl).toBe("data:image/png;base64,usage");
    expect(result.current.prepared).toBeNull();
    expect(result.current.backgroundHistory).toEqual([]);
  });

  it("[P1] 多次点选后 history 正确，可逐步撤销", async () => {
    mockNeedsBackgroundSelection();
    const { result } = renderHook(() =>
      useGeneratorFlow("keychain", "standard")
    );

    await act(async () => {
      result.current.selectImage(fakeFile);
    });
    await act(async () => {
      result.current.generate();
      await new Promise((r) => setTimeout(r, 50));
    });

    const grid0 = result.current.gridForPreview;

    const grid1 = makeGrid(3, 3);
    grid1[0][0] = null;
    mockRemoveBackgroundFromSelection.mockReturnValue({
      grid: grid1,
      removedCount: 1,
      confidence: 0.9,
    });
    await act(async () => {
      result.current.selectBackground(0, 0);
    });

    const grid2 = makeGrid(3, 3);
    grid2[0][0] = null;
    grid2[1][1] = null;
    mockRemoveBackgroundFromSelection.mockReturnValue({
      grid: grid2,
      removedCount: 1,
      confidence: 0.9,
    });
    await act(async () => {
      result.current.selectBackground(1, 1);
    });

    expect(result.current.backgroundHistory.length).toBe(2);
    expect(result.current.gridForPreview).toBe(grid2);

    await act(async () => {
      result.current.undoBackground();
    });
    expect(result.current.gridForPreview).toBe(grid1);
    expect(result.current.backgroundHistory.length).toBe(1);

    await act(async () => {
      result.current.undoBackground();
    });
    expect(result.current.gridForPreview).toBe(grid0);
    expect(result.current.backgroundHistory.length).toBe(0);
  });

  it("[P1] setPurpose 在 backgroundSelection 时回退到 imageSelected", async () => {
    mockNeedsBackgroundSelection();
    const { result } = renderHook(() =>
      useGeneratorFlow("keychain", "standard")
    );

    await act(async () => {
      result.current.selectImage(fakeFile);
    });
    await act(async () => {
      result.current.generate();
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(result.current.status).toBe("backgroundSelection");

    await act(async () => {
      result.current.setPurpose("fridge-magnet");
    });

    expect(result.current.status).toBe("imageSelected");
    expect(result.current.prepared).toBeNull();
    expect(result.current.gridForPreview).toBeNull();
    expect(result.current.backgroundHistory).toEqual([]);
  });

  it("[P1] setMode 在 backgroundSelection 时回退到 imageSelected", async () => {
    mockNeedsBackgroundSelection();
    const { result } = renderHook(() =>
      useGeneratorFlow("keychain", "standard")
    );

    await act(async () => {
      result.current.selectImage(fakeFile);
    });
    await act(async () => {
      result.current.generate();
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(result.current.status).toBe("backgroundSelection");

    await act(async () => {
      result.current.setMode("beginner");
    });

    expect(result.current.status).toBe("imageSelected");
    expect(result.current.prepared).toBeNull();
  });

  it("[P1] selectImage 中断正在进行的 generate，旧任务结果被丢弃", async () => {
    let resolveDecode: (v: unknown) => void;
    mockDecodeImage.mockReturnValue(
      new Promise((r) => {
        resolveDecode = r;
      })
    );
    mockPreparePattern.mockReturnValue({
      gridSize: { width: 2, height: 2 },
      limitedGrid: makeGrid(2, 2),
      backgroundResult: {
        grid: makeGrid(2, 2),
        removedCount: 4,
        confidence: 0.99,
      },
      requiresBackgroundSelection: false,
      preset: { paletteId: "MARD", beadSizeMm: 2.6, gridType: "hex" },
      palette: [{ code: "A1", hex: "#FF0000" }],
    });

    const { result } = renderHook(() =>
      useGeneratorFlow("keychain", "standard")
    );

    await act(async () => {
      result.current.selectImage(fakeFile);
    });

    await act(async () => {
      result.current.generate();
    });
    expect(result.current.status).toBe("generating");

    const newFile = new File(["new"], "new.png", { type: "image/png" });
    await act(async () => {
      result.current.selectImage(newFile);
    });

    expect(result.current.status).toBe("imageSelected");
    expect(result.current.file).toBe(newFile);

    // 旧任务完成
    mockFinalizePattern.mockReturnValue(fakeDoc);
    mockRenderPatternPng.mockResolvedValue({
      dataUrl: "data:image/png;base64,old-pattern",
      width: 10,
      height: 10,
      fileSizeBytes: 100,
    });
    mockRenderUsagePng.mockResolvedValue({
      dataUrl: "data:image/png;base64,old-usage",
      width: 10,
      height: 10,
      fileSizeBytes: 100,
    });

    await act(async () => {
      resolveDecode!({ imageData: fakeImageData(2, 2), width: 2, height: 2 });
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(result.current.status).toBe("imageSelected");
    expect(result.current.document).toBeNull();
  });

  it("reset 回到 idle 并清理所有状态", async () => {
    mockNeedsBackgroundSelection();
    const { result } = renderHook(() =>
      useGeneratorFlow("keychain", "standard")
    );

    await act(async () => {
      result.current.selectImage(fakeFile);
    });
    await act(async () => {
      result.current.generate();
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(result.current.status).toBe("backgroundSelection");

    await act(async () => {
      result.current.reset();
    });

    expect(result.current.status).toBe("idle");
    expect(result.current.file).toBeNull();
    expect(result.current.prepared).toBeNull();
    expect(result.current.gridForPreview).toBeNull();
  });

  it("selectBackground 在 removedCount=0 时不更新网格", async () => {
    mockNeedsBackgroundSelection();
    const { result } = renderHook(() =>
      useGeneratorFlow("keychain", "standard")
    );

    await act(async () => {
      result.current.selectImage(fakeFile);
    });
    await act(async () => {
      result.current.generate();
      await new Promise((r) => setTimeout(r, 50));
    });

    const gridBefore = result.current.gridForPreview;

    mockRemoveBackgroundFromSelection.mockReturnValue({
      grid: gridBefore,
      removedCount: 0,
      confidence: 0.5,
    });

    await act(async () => {
      result.current.selectBackground(1, 1);
    });

    expect(result.current.gridForPreview).toBe(gridBefore);
    expect(result.current.backgroundHistory).toEqual([]);
  });

  it("[P0] 未点选时 confirmBackground 不执行 finalize", async () => {
    mockNeedsBackgroundSelection();
    const { result } = renderHook(() =>
      useGeneratorFlow("keychain", "standard")
    );

    await act(async () => {
      result.current.selectImage(fakeFile);
    });
    await act(async () => {
      result.current.generate();
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(result.current.status).toBe("backgroundSelection");
    expect(result.current.backgroundHistory).toEqual([]);

    // 未点选直接确认
    await act(async () => {
      result.current.confirmBackground();
      await new Promise((r) => setTimeout(r, 50));
    });

    // 状态未变，finalize 未调用
    expect(result.current.status).toBe("backgroundSelection");
    expect(mockFinalizePattern).not.toHaveBeenCalled();
  });

  it("[P0] 点选后撤销全部，confirmBackground 不执行 finalize", async () => {
    mockNeedsBackgroundSelection();
    const { result } = renderHook(() =>
      useGeneratorFlow("keychain", "standard")
    );

    await act(async () => {
      result.current.selectImage(fakeFile);
    });
    await act(async () => {
      result.current.generate();
      await new Promise((r) => setTimeout(r, 50));
    });

    const grid0 = result.current.gridForPreview;

    // 点选一次
    const newGrid = makeGrid(3, 3);
    newGrid[0][0] = null;
    mockRemoveBackgroundFromSelection.mockReturnValue({
      grid: newGrid,
      removedCount: 1,
      confidence: 0.9,
    });
    await act(async () => {
      result.current.selectBackground(0, 0);
    });
    expect(result.current.backgroundHistory.length).toBe(1);

    // 撤销全部
    await act(async () => {
      result.current.undoBackground();
    });
    expect(result.current.backgroundHistory).toEqual([]);
    expect(result.current.gridForPreview).toBe(grid0);

    // 撤销后确认无效
    await act(async () => {
      result.current.confirmBackground();
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(result.current.status).toBe("backgroundSelection");
    expect(mockFinalizePattern).not.toHaveBeenCalled();
  });
});
