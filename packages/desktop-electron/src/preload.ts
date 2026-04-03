import {
  createTitlebar,
  createTitlebarOnDOMContentLoaded,
  type CustomTitlebar,
  TitlebarColor,
} from "custom-electron-titlebar";
import { contextBridge, ipcRenderer } from "electron";
import {
  DESKTOP_TITLEBAR_HEIGHT,
  getDesktopTitlebarThemeConfig,
  getDesktopWindowBackground,
  isDesktopTheme,
  type DesktopTheme,
} from "./runtime.js";

function resolveInitialThemeArgument(): DesktopTheme | null {
  const prefix = "--paperclip-desktop-initial-theme=";

  for (const arg of process.argv) {
    if (!arg.startsWith(prefix)) {
      continue;
    }

    const value = arg.slice(prefix.length);
    return isDesktopTheme(value) ? value : null;
  }

  return null;
}

const initialTheme = resolveInitialThemeArgument();
let currentTheme: DesktopTheme | null = initialTheme;
let titlebarPromise: Promise<CustomTitlebar> | null = null;
const TITLEBAR_THEME_STYLE_ID = "paperclip-desktop-titlebar-theme";

function resolveDocumentTheme(): DesktopTheme {
  if (document.documentElement.classList.contains("dark")) {
    return "dark";
  }

  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function upsertTitlebarThemeStyle(theme: DesktopTheme): void {
  const themeConfig = getDesktopTitlebarThemeConfig(theme);
  const { colors } = themeConfig;
  let styleElement = document.getElementById(TITLEBAR_THEME_STYLE_ID);

  if (!(styleElement instanceof HTMLStyleElement)) {
    styleElement = document.createElement("style");
    styleElement.id = TITLEBAR_THEME_STYLE_ID;
    document.head.append(styleElement);
  }

  styleElement.textContent = `
.cet-titlebar .cet-menubar {
  background: ${colors.menuBar};
}

.cet-titlebar .cet-menubar-menu-title {
  color: ${colors.titlebarForeground};
}

.cet-titlebar .cet-control-icon svg {
  fill: ${colors.titlebarForeground} !important;
}

.cet-titlebar .cet-icon img {
  filter: ${themeConfig.iconFilter};
}

.cet-menubar-menu-container {
  background: ${colors.menuBar};
  color: ${colors.titlebarForeground};
}

.cet-menubar-menu-container .cet-action-item.active .cet-action-menu-item,
.cet-menubar-menu-container .cet-action-menu-item:hover {
  background: ${colors.menuItemSelection};
}

.cet-menubar-menu-container .cet-action-label.separator {
  border-bottom-color: ${colors.menuSeparator};
}

.cet-menubar-menu-container .cet-menu-item-icon svg,
.cet-menubar-menu-container .cet-submenu-indicator svg {
  fill: ${colors.svg};
}
`;
}

function applyThemeToTitlebar(titlebar: CustomTitlebar, theme: DesktopTheme): void {
  const themeConfig = getDesktopTitlebarThemeConfig(theme);
  const baseSize = Math.max(10, Math.floor(themeConfig.fontSize));

  titlebar.titlebarElement.style.setProperty("--cet-font-family", themeConfig.fontFamily);
  titlebar.titlebarElement.style.setProperty("--cet-font-size", `${baseSize}px`);
  titlebar.titlebarElement.style.setProperty("--cet-title-font-size", `${Math.max(10, baseSize - 1)}px`);
  titlebar.titlebarElement.style.setProperty("--cet-menu-font-size", `${Math.max(10, baseSize - 1)}px`);
  titlebar.updateBackground(TitlebarColor.fromHex(themeConfig.colors.titlebar));
  titlebar.updateItemBGColor(TitlebarColor.fromHex(themeConfig.colors.menuItemSelection));
  titlebar.titlebarElement.style.color = themeConfig.colors.titlebarForeground;
  titlebar.titlebarElement.classList.toggle("light", theme === "light");

  void ipcRenderer.invoke("desktop-shell:update-titlebar", {
    backgroundColor: getDesktopWindowBackground(theme),
    overlay: {
      color: themeConfig.colors.titlebar,
      symbolColor: themeConfig.colors.titlebarForeground,
      height: titlebar.titlebarElement.offsetHeight || 30,
    },
  }).catch((error) => {
    console.warn("[desktop-preload] Failed to refresh native title bar theme:", error);
  });

  upsertTitlebarThemeStyle(theme);
}

function getRequestedTheme(): DesktopTheme {
  return currentTheme ?? resolveDocumentTheme();
}

async function ensureTitlebar(theme = getRequestedTheme()): Promise<CustomTitlebar> {
  currentTheme = theme;

  if (!titlebarPromise) {
    const titlebarOptions = {
      themeConfig: getDesktopTitlebarThemeConfig(theme),
    };

    titlebarPromise = document.readyState === "loading"
      ? createTitlebarOnDOMContentLoaded(titlebarOptions)
      : Promise.resolve(createTitlebar(titlebarOptions));
  }

  const titlebar = await titlebarPromise;
  applyThemeToTitlebar(titlebar, getRequestedTheme());
  return titlebar;
}

function logTitlebarInitError(error: unknown): void {
  console.warn("[desktop-preload] Failed to initialize custom title bar:", error);
}

try {
  if (document.readyState === "loading") {
    window.addEventListener("DOMContentLoaded", () => {
      void ensureTitlebar().catch(logTitlebarInitError);
    }, { once: true });
  } else {
    void ensureTitlebar().catch(logTitlebarInitError);
  }
} catch (error) {
  logTitlebarInitError(error);
}

contextBridge.exposeInMainWorld("desktopShell", {
  async retryStart() {
    await ipcRenderer.invoke("desktop-shell:retry-start");
  },
  async setTheme(theme: DesktopTheme) {
    currentTheme = theme;
    const persistPromise = ipcRenderer.invoke("desktop-shell:set-theme-preference", theme).catch((error) => {
      console.warn("[desktop-preload] Failed to persist desktop theme:", error);
      return false;
    });

    await ensureTitlebar(theme);
    await persistPromise;
  },
  initialTheme: initialTheme ?? undefined,
  isDesktop: true,
  platform: process.platform,
  titlebarHeight: DESKTOP_TITLEBAR_HEIGHT,
});
