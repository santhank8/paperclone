import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { getAppName } from "../lib/appName.js";

export interface Breadcrumb {
  label: string;
  href?: string;
}

interface BreadcrumbContextValue {
  breadcrumbs: Breadcrumb[];
  setBreadcrumbs: (crumbs: Breadcrumb[]) => void;
}

const BreadcrumbContext = createContext<BreadcrumbContextValue | null>(null);

export function BreadcrumbProvider({ children }: { children: ReactNode }) {
  const [breadcrumbs, setBreadcrumbsState] = useState<Breadcrumb[]>([]);
  const appName = useMemo(() => getAppName(), []);

  const setBreadcrumbs = useCallback((crumbs: Breadcrumb[]) => {
    setBreadcrumbsState(crumbs);
  }, []);

  useEffect(() => {
    if (breadcrumbs.length === 0) {
      document.title = appName;
    } else {
      const parts = [...breadcrumbs].reverse().map((b) => b.label);
      document.title = `${parts.join(" · ")} · ${appName}`;
    }
  }, [breadcrumbs, appName]);

  return (
    <BreadcrumbContext.Provider value={{ breadcrumbs, setBreadcrumbs }}>
      {children}
    </BreadcrumbContext.Provider>
  );
}

export function useBreadcrumbs() {
  const ctx = useContext(BreadcrumbContext);
  if (!ctx) {
    throw new Error("useBreadcrumbs must be used within BreadcrumbProvider");
  }
  return ctx;
}
