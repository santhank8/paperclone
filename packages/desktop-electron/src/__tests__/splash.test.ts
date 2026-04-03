import { describe, expect, it } from "vitest";
import { createSplashDataUrl } from "../splash.js";

function decodeSplashHtml(dataUrl: string): string {
  const prefix = "data:text/html;charset=utf-8,";
  expect(dataUrl.startsWith(prefix)).toBe(true);
  return decodeURIComponent(dataUrl.slice(prefix.length));
}

describe("createSplashDataUrl", () => {
  it("renders a dark startup splash with the refined product copy", () => {
    const html = decodeSplashHtml(
      createSplashDataUrl({
        locale: "en-US",
        theme: "dark",
        state: "starting",
      }),
    );

    expect(html).toContain('data-testid="splash-logo"');
    expect(html).toContain('data-testid="splash-progress"');
    expect(html).toContain('data-testid="splash-status"');
    expect(html).toContain('data-testid="splash-footer"');
    expect(html).toContain("Opening Paperclip");
    expect(html).toContain("© 2026 Paperclip CN");
    expect(html).toContain("color-scheme: dark;");
    expect(html).toContain("--bg-start: #1c1c1e;");
    expect(html).toContain("--text: #f5f5f7;");
    expect(html).toContain('src="data:image/');
    expect(html).not.toContain("<h1");
  });

  it("renders a light waiting splash with localized product copy", () => {
    const html = decodeSplashHtml(
      createSplashDataUrl({
        locale: "zh-CN",
        theme: "light",
        state: "waiting",
      }),
    );

    expect(html).toContain("马上就好，正在连接你的本地工作台");
    expect(html).toContain("color-scheme: light;");
    expect(html).toContain("--bg-start: #f5f2ea;");
    expect(html).toContain("--text: #1c1c1f;");
    expect(html).not.toContain("<h1");
  });

  it("keeps the minimalist structure for error state while exposing retry details", () => {
    const html = decodeSplashHtml(
      createSplashDataUrl({
        locale: "en-US",
        theme: "dark",
        state: "error",
        detail: "connect ECONNREFUSED 127.0.0.1:54330",
      }),
    );

    expect(html).toContain('data-testid="splash-logo"');
    expect(html).toContain('data-testid="splash-status"');
    expect(html).toContain('data-testid="splash-error-detail"');
    expect(html).toContain('data-testid="splash-retry"');
    expect(html).toContain("Paperclip couldn&#39;t start this time");
    expect(html).toContain("connect ECONNREFUSED 127.0.0.1:54330");
    expect(html).toContain("Try again");
    expect(html).not.toContain("<h1");
  });
});
