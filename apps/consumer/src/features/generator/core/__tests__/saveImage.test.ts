import { isWeChatBrowser, isShareSupported, downloadImage, openOriginalImage, shareImage } from "../saveImage";

describe("saveImage", () => {
  describe("isWeChatBrowser", () => {
    const originalUA = navigator.userAgent;

    afterEach(() => {
      Object.defineProperty(navigator, "userAgent", { value: originalUA, configurable: true });
    });

    it("非微信环境返回 false", () => {
      Object.defineProperty(navigator, "userAgent", {
        value: "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)",
        configurable: true,
      });
      expect(isWeChatBrowser()).toBe(false);
    });

    it("微信环境返回 true", () => {
      Object.defineProperty(navigator, "userAgent", {
        value: "Mozilla/5.0 MicroMessenger/8.0.0",
        configurable: true,
      });
      expect(isWeChatBrowser()).toBe(true);
    });
  });

  describe("isShareSupported", () => {
    it("无 navigator.share 时返回 false", () => {
      const orig = navigator.share;
      Object.defineProperty(navigator, "share", { value: undefined, configurable: true });
      expect(isShareSupported()).toBe(false);
      Object.defineProperty(navigator, "share", { value: orig, configurable: true });
    });
  });

  describe("downloadImage", () => {
    it("创建 <a download> 并触发点击", () => {
      const blob = new Blob(["test"], { type: "image/png" });
      const appendSpy = jest.spyOn(document.body, "appendChild");
      const removeSpy = jest.spyOn(document.body, "removeChild");

      downloadImage(blob, "test.png");

      expect(appendSpy).toHaveBeenCalled();
      expect(removeSpy).toHaveBeenCalled();

      appendSpy.mockRestore();
      removeSpy.mockRestore();
    });
  });

  describe("openOriginalImage", () => {
    it("window.open 返回 null 时返回 false", () => {
      const orig = window.open;
      window.open = jest.fn().mockReturnValue(null);

      expect(openOriginalImage("blob:test")).toBe(false);

      window.open = orig;
    });

    it("window.open 成功时返回 true", () => {
      const orig = window.open;
      window.open = jest.fn().mockReturnValue({ closed: false });

      expect(openOriginalImage("blob:test")).toBe(true);

      window.open = orig;
    });
  });

  describe("shareImage", () => {
    const origShare = navigator.share;
    const origCanShare = navigator.canShare;

    afterEach(() => {
      Object.defineProperty(navigator, "share", { value: origShare, configurable: true });
      Object.defineProperty(navigator, "canShare", { value: origCanShare, configurable: true });
    });

    it("不支持时抛错", async () => {
      Object.defineProperty(navigator, "share", { value: undefined, configurable: true });
      const blob = new Blob(["test"], { type: "image/png" });
      await expect(shareImage(blob, "test.png")).rejects.toThrow("不支持");
    });

    it("分享成功时正常返回", async () => {
      Object.defineProperty(navigator, "share", {
        value: jest.fn().mockResolvedValue(undefined),
        configurable: true,
      });
      Object.defineProperty(navigator, "canShare", {
        value: () => true,
        configurable: true,
      });

      const blob = new Blob(["test"], { type: "image/png" });
      await expect(shareImage(blob, "test.png")).resolves.toBeUndefined();
    });

    it("AbortError（用户取消）静默返回", async () => {
      const abortErr = new DOMException("User cancelled", "AbortError");
      Object.defineProperty(navigator, "share", {
        value: jest.fn().mockRejectedValue(abortErr),
        configurable: true,
      });
      Object.defineProperty(navigator, "canShare", {
        value: () => true,
        configurable: true,
      });

      const blob = new Blob(["test"], { type: "image/png" });
      await expect(shareImage(blob, "test.png")).resolves.toBeUndefined();
    });

    it("普通分享失败时抛错", async () => {
      Object.defineProperty(navigator, "share", {
        value: jest.fn().mockRejectedValue(new Error("Network error")),
        configurable: true,
      });
      Object.defineProperty(navigator, "canShare", {
        value: () => true,
        configurable: true,
      });

      const blob = new Blob(["test"], { type: "image/png" });
      await expect(shareImage(blob, "test.png")).rejects.toThrow("分享失败");
    });
  });
});
