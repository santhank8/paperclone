const testDirectoryNames = new Set([
  "__tests__",
  "_tests",
  "test",
  "tests",
]);

const ignoredTestConfigBasenames = new Set([
  "jest.config.cjs",
  "jest.config.js",
  "jest.config.mjs",
  "jest.config.ts",
  "playwright.config.ts",
  "vitest.config.ts",
]);

// macOS/Windows filesystem metadata files — never trigger a backend restart
const ignoredSystemBasenames = new Set([
  ".DS_Store",
  "Thumbs.db",
  "Desktop.ini",
  ".localized",
]);

export function shouldTrackDevServerPath(relativePath) {
  const normalizedPath = String(relativePath).replaceAll("\\", "/").replace(/^\.\/+/, "");
  if (normalizedPath.length === 0) return false;

  const segments = normalizedPath.split("/");
  const basename = segments.at(-1) ?? normalizedPath;

  if (segments.includes(".paperclip")) {
    return false;
  }
  if (ignoredTestConfigBasenames.has(basename)) {
    return false;
  }
  if (ignoredSystemBasenames.has(basename)) {
    return false;
  }
  if (segments.some((segment) => testDirectoryNames.has(segment))) {
    return false;
  }
  if (/\.(test|spec)\.[^/]+$/i.test(basename)) {
    return false;
  }

  return true;
}
