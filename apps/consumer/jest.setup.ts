import "@testing-library/jest-dom";

// jsdom 没有 URL.createObjectURL，测试阶段用简单 polyfill
if (typeof URL !== "undefined" && !URL.createObjectURL) {
  let objectUrlCounter = 0;
  const blobStore = new Map<string, Blob>();

  URL.createObjectURL = (blob: Blob) => {
    const url = `blob:mock:${objectUrlCounter++}`;
    blobStore.set(url, blob);
    return url;
  };

  URL.revokeObjectURL = (url: string) => {
    blobStore.delete(url);
  };
}
