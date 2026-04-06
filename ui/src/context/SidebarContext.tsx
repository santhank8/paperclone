import { createContext, useCallback, useContext, useState, useEffect, type ReactNode } from "react";

interface SidebarContextValue {
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;
  /** Viewport width &lt; 768px — phone-only (bottom nav, scroll, safe areas) */
  isMobile: boolean;
  /** Viewport 768px–1023px */
  isTablet: boolean;
  /** Viewport ≥ 1024px — inline sidebar, full desktop chrome */
  isDesktopShell: boolean;
}

const SidebarContext = createContext<SidebarContextValue | null>(null);

const MOBILE_BREAKPOINT = 768;
/** Aligns with Tailwind `lg:` */
const DESKTOP_SHELL_BREAKPOINT = 1024;

function computeShellFlags(width: number): Pick<SidebarContextValue, "isMobile" | "isTablet" | "isDesktopShell"> {
  return {
    isMobile: width < MOBILE_BREAKPOINT,
    isTablet: width >= MOBILE_BREAKPOINT && width < DESKTOP_SHELL_BREAKPOINT,
    isDesktopShell: width >= DESKTOP_SHELL_BREAKPOINT,
  };
}

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [{ isMobile, isTablet, isDesktopShell }, setShellFlags] = useState(() =>
    computeShellFlags(typeof window !== "undefined" ? window.innerWidth : DESKTOP_SHELL_BREAKPOINT),
  );
  const [sidebarOpen, setSidebarOpen] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth >= DESKTOP_SHELL_BREAKPOINT : true,
  );

  useEffect(() => {
    const onResize = () => setShellFlags(computeShellFlags(window.innerWidth));
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    const mql = window.matchMedia(`(min-width: ${DESKTOP_SHELL_BREAKPOINT}px)`);
    const onChange = () => {
      if (mql.matches) setSidebarOpen(true);
      else setSidebarOpen(false);
    };
    onChange();
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  const toggleSidebar = useCallback(() => setSidebarOpen((v) => !v), []);

  return (
    <SidebarContext.Provider
      value={{
        sidebarOpen,
        setSidebarOpen,
        toggleSidebar,
        isMobile,
        isTablet,
        isDesktopShell,
      }}
    >
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebar() {
  const ctx = useContext(SidebarContext);
  if (!ctx) {
    throw new Error("useSidebar must be used within SidebarProvider");
  }
  return ctx;
}
