export {};

declare global {
  interface Window {
    desktopShell?: {
      retryStart(): Promise<void>;
      setTheme(theme: "light" | "dark"): Promise<void>;
      initialTheme?: "light" | "dark";
      isDesktop: boolean;
      platform: string;
      titlebarHeight: number;
    };
  }
}
