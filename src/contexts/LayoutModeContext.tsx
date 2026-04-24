import { createContext, useContext, useEffect, useState, ReactNode } from "react";

export type LayoutMode = "desktop" | "mobile";

type Ctx = {
  mode: LayoutMode;
  setMode: (m: LayoutMode) => void;
  toggle: () => void;
};

const LayoutModeContext = createContext<Ctx | undefined>(undefined);
const STORAGE_KEY = "winducks:layoutMode";

export function LayoutModeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<LayoutMode>("desktop");

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === "desktop" || stored === "mobile") setModeState(stored);
    } catch {}
  }, []);

  const setMode = (m: LayoutMode) => {
    setModeState(m);
    try { localStorage.setItem(STORAGE_KEY, m); } catch {}
  };

  const toggle = () => setMode(mode === "desktop" ? "mobile" : "desktop");

  return (
    <LayoutModeContext.Provider value={{ mode, setMode, toggle }}>
      {children}
    </LayoutModeContext.Provider>
  );
}

export function useLayoutMode() {
  const ctx = useContext(LayoutModeContext);
  if (!ctx) throw new Error("useLayoutMode must be used within LayoutModeProvider");
  return ctx;
}
