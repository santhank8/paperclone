import { describe, expect, it } from "vitest";
import {
  applyUiBranding,
  getAppName,
  getWorktreeUiBranding,
  isWorktreeUiBrandingEnabled,
  renderAppNameMeta,
  renderFaviconLinks,
  renderRuntimeBrandingMeta,
} from "../ui-branding.js";

const TEMPLATE = `<!doctype html>
<head>
    <meta name="apple-mobile-web-app-title" content="Paperclip" />
    <title>Paperclip</title>
    <!-- PAPERCLIP_RUNTIME_BRANDING_START -->
    <!-- PAPERCLIP_RUNTIME_BRANDING_END -->
    <!-- PAPERCLIP_FAVICON_START -->
    <link rel="icon" href="/favicon.ico" sizes="48x48" />
    <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
    <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
    <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
    <!-- PAPERCLIP_FAVICON_END -->
</head>`;

describe("ui branding", () => {
  it("detects worktree mode from PAPERCLIP_IN_WORKTREE", () => {
    expect(isWorktreeUiBrandingEnabled({ PAPERCLIP_IN_WORKTREE: "true" })).toBe(true);
    expect(isWorktreeUiBrandingEnabled({ PAPERCLIP_IN_WORKTREE: "1" })).toBe(true);
    expect(isWorktreeUiBrandingEnabled({ PAPERCLIP_IN_WORKTREE: "false" })).toBe(false);
  });

  it("resolves name, color, and text color for worktree branding", () => {
    const branding = getWorktreeUiBranding({
      PAPERCLIP_IN_WORKTREE: "true",
      PAPERCLIP_WORKTREE_NAME: "paperclip-pr-432",
      PAPERCLIP_WORKTREE_COLOR: "#4f86f7",
    });

    expect(branding.enabled).toBe(true);
    expect(branding.name).toBe("paperclip-pr-432");
    expect(branding.color).toBe("#4f86f7");
    expect(branding.textColor).toMatch(/^#[0-9a-f]{6}$/);
    expect(branding.faviconHref).toContain("data:image/svg+xml,");
  });

  it("renders a dynamic worktree favicon when enabled", () => {
    const links = renderFaviconLinks(
      getWorktreeUiBranding({
        PAPERCLIP_IN_WORKTREE: "true",
        PAPERCLIP_WORKTREE_NAME: "paperclip-pr-432",
        PAPERCLIP_WORKTREE_COLOR: "#4f86f7",
      }),
    );
    expect(links).toContain("data:image/svg+xml,");
    expect(links).toContain('rel="shortcut icon"');
  });

  it("renders runtime branding metadata for the ui", () => {
    const meta = renderRuntimeBrandingMeta(
      getWorktreeUiBranding({
        PAPERCLIP_IN_WORKTREE: "true",
        PAPERCLIP_WORKTREE_NAME: "paperclip-pr-432",
        PAPERCLIP_WORKTREE_COLOR: "#4f86f7",
      }),
    );
    expect(meta).toContain('name="paperclip-worktree-name"');
    expect(meta).toContain('content="paperclip-pr-432"');
    expect(meta).toContain('name="paperclip-worktree-color"');
  });

  it("rewrites the favicon and runtime branding blocks for worktree instances only", () => {
    const branded = applyUiBranding(TEMPLATE, {
      PAPERCLIP_IN_WORKTREE: "true",
      PAPERCLIP_WORKTREE_NAME: "paperclip-pr-432",
      PAPERCLIP_WORKTREE_COLOR: "#4f86f7",
    });
    expect(branded).toContain("data:image/svg+xml,");
    expect(branded).toContain('name="paperclip-worktree-name"');
    expect(branded).not.toContain('href="/favicon.svg"');

    const defaultHtml = applyUiBranding(TEMPLATE, {});
    expect(defaultHtml).toContain('href="/favicon.svg"');
    expect(defaultHtml).not.toContain('name="paperclip-worktree-name"');
  });
});

describe("PAPERCLIP_APP_NAME branding", () => {
  it("returns 'Paperclip' when PAPERCLIP_APP_NAME is unset", () => {
    expect(getAppName({})).toBe("Paperclip");
  });

  it("returns 'Paperclip' when PAPERCLIP_APP_NAME is empty or whitespace", () => {
    expect(getAppName({ PAPERCLIP_APP_NAME: "" })).toBe("Paperclip");
    expect(getAppName({ PAPERCLIP_APP_NAME: "   " })).toBe("Paperclip");
  });

  it("returns the custom name when PAPERCLIP_APP_NAME is set", () => {
    expect(getAppName({ PAPERCLIP_APP_NAME: "Optimous Apex" })).toBe("Optimous Apex");
    expect(getAppName({ PAPERCLIP_APP_NAME: "  My App  " })).toBe("My App");
  });

  it("renderAppNameMeta returns empty string for default name", () => {
    expect(renderAppNameMeta("Paperclip")).toBe("");
  });

  it("renderAppNameMeta returns meta tag for custom name", () => {
    const meta = renderAppNameMeta("Optimous Apex");
    expect(meta).toContain('name="paperclip-app-name"');
    expect(meta).toContain('content="Optimous Apex"');
  });

  it("renderAppNameMeta escapes HTML special characters in app name", () => {
    const meta = renderAppNameMeta('My <App> & "Stuff"');
    expect(meta).toContain("&lt;App&gt;");
    expect(meta).toContain("&amp;");
    expect(meta).toContain("&quot;");
  });

  it("applyUiBranding replaces <title> when PAPERCLIP_APP_NAME is set", () => {
    const result = applyUiBranding(TEMPLATE, { PAPERCLIP_APP_NAME: "Optimous Apex" });
    expect(result).toContain("<title>Optimous Apex</title>");
    expect(result).not.toContain("<title>Paperclip</title>");
  });

  it("applyUiBranding replaces apple-mobile-web-app-title when PAPERCLIP_APP_NAME is set", () => {
    const result = applyUiBranding(TEMPLATE, { PAPERCLIP_APP_NAME: "Optimous Apex" });
    expect(result).toContain('content="Optimous Apex"');
    expect(result).not.toContain('content="Paperclip"');
  });

  it("applyUiBranding injects paperclip-app-name meta tag into runtime branding block", () => {
    const result = applyUiBranding(TEMPLATE, { PAPERCLIP_APP_NAME: "Optimous Apex" });
    expect(result).toContain('name="paperclip-app-name"');
    expect(result).toContain('content="Optimous Apex"');
  });

  it("applyUiBranding does NOT inject paperclip-app-name when using default name", () => {
    const result = applyUiBranding(TEMPLATE, {});
    expect(result).not.toContain('name="paperclip-app-name"');
    expect(result).toContain("<title>Paperclip</title>");
  });

  it("applyUiBranding works with both PAPERCLIP_APP_NAME and worktree branding simultaneously", () => {
    const result = applyUiBranding(TEMPLATE, {
      PAPERCLIP_APP_NAME: "Optimous Apex",
      PAPERCLIP_IN_WORKTREE: "true",
      PAPERCLIP_WORKTREE_NAME: "apex-pr-12",
      PAPERCLIP_WORKTREE_COLOR: "#ff6600",
    });
    expect(result).toContain('name="paperclip-app-name"');
    expect(result).toContain('name="paperclip-worktree-name"');
    expect(result).toContain("<title>Optimous Apex</title>");
  });
});
