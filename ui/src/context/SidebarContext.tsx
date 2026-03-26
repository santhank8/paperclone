import { createContext, useCallback, useContext, useMemo, useState, useEffect, type ReactNode } from "react";

interface SidebarContextValue {
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;
  isMobile: boolean;
}

const SidebarContext = createContext<SidebarContextValue | null>(null);

const MOBILE_BREAKPOINT = 768;
const SIDEBAR_OPEN_KEY = "outpost.sidebarOpen";

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < MOBILE_BREAKPOINT);
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    if (window.innerWidth < MOBILE_BREAKPOINT) return false;
    try {
      const stored = localStorage.getItem(SIDEBAR_OPEN_KEY);
      if (stored !== null) return stored === "true";
    } catch {}
    return true;
  });

  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const onChange = (e: MediaQueryListEvent) => {
      setIsMobile(e.matches);
      if (e.matches) {
        setSidebarOpen(false);
      } else {
        try {
          const stored = localStorage.getItem(SIDEBAR_OPEN_KEY);
          setSidebarOpen(stored !== null ? stored === "true" : true);
        } catch {
          setSidebarOpen(true);
        }
      }
    };
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    if (!isMobile) {
      try { localStorage.setItem(SIDEBAR_OPEN_KEY, String(sidebarOpen)); } catch {}
    }
  }, [sidebarOpen, isMobile]);

  const toggleSidebar = useCallback(() => setSidebarOpen((v) => !v), []);

  const value = useMemo<SidebarContextValue>(
    () => ({ sidebarOpen, setSidebarOpen, toggleSidebar, isMobile }),
    [sidebarOpen, setSidebarOpen, toggleSidebar, isMobile],
  );

  return (
    <SidebarContext.Provider value={value}>
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
