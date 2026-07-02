/** @jest-environment jsdom */

import { renderHook } from "@testing-library/react";
import { useObjectUrl, revokeObjectUrl } from "../useObjectUrl";

describe("revokeObjectUrl", () => {
  it("null 时不抛错", () => {
    expect(() => revokeObjectUrl(null)).not.toThrow();
  });

  it("非 blob: URL 时不调用 revokeObjectURL", () => {
    const spy = jest.spyOn(URL, "revokeObjectURL");
    revokeObjectUrl("https://example.com/image.png");
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it("blob: URL 时调用 revokeObjectURL", () => {
    const spy = jest.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    revokeObjectUrl("blob:http://localhost/test-id");
    expect(spy).toHaveBeenCalledWith("blob:http://localhost/test-id");
    spy.mockRestore();
  });
});

describe("useObjectUrl", () => {
  it("卸载时释放所有 blob URL", () => {
    const spy = jest.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    const { unmount } = renderHook(() =>
      useObjectUrl(["blob:test-1", "blob:test-2", null])
    );

    unmount();

    expect(spy).toHaveBeenCalledWith("blob:test-1");
    expect(spy).toHaveBeenCalledWith("blob:test-2");
    spy.mockRestore();
  });

  it("URL 列表变更时释放不再使用的 URL", () => {
    const spy = jest.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    const { rerender } = renderHook(
      ({ urls }) => useObjectUrl(urls),
      { initialProps: { urls: ["blob:old-1", "blob:keep"] } }
    );

    // 变更：移除 blob:old-1，保留 blob:keep，新增 blob:new-1
    rerender({ urls: ["blob:keep", "blob:new-1"] });

    expect(spy).toHaveBeenCalledWith("blob:old-1");
    expect(spy).not.toHaveBeenCalledWith("blob:keep");
    spy.mockRestore();
  });

  it("空列表不抛错", () => {
    expect(() => {
      const { unmount } = renderHook(() => useObjectUrl([]));
      unmount();
    }).not.toThrow();
  });

  it("null 值被忽略", () => {
    const spy = jest.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    const { unmount } = renderHook(() => useObjectUrl([null, null]));
    unmount();
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});
