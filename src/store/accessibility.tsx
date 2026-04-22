"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
  ReactNode,
} from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

export type FontLevel = 0 | 1 | 2; // 0 = default, 1 = +12.5%, 2 = +25%

export interface A11ySettings {
  fontLevel: FontLevel;
  highContrast: boolean;
  underlineLinks: boolean;
  largeSpacing: boolean;
}

const DEFAULT: A11ySettings = {
  fontLevel: 0,
  highContrast: false,
  underlineLinks: false,
  largeSpacing: false,
};

interface A11yContextValue {
  settings: A11ySettings;
  isModified: boolean;
  increaseFontSize: () => void;
  decreaseFontSize: () => void;
  toggleHighContrast: () => void;
  toggleUnderlineLinks: () => void;
  toggleLargeSpacing: () => void;
  reset: () => void;
}

// ─── Storage ──────────────────────────────────────────────────────────────────

const STORAGE_KEY = "meshek22_a11y";

function loadSettings(): A11ySettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT;
    return { ...DEFAULT, ...JSON.parse(raw) };
  } catch {
    return DEFAULT;
  }
}

function saveSettings(s: A11ySettings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {}
}

// ─── DOM application ──────────────────────────────────────────────────────────

function applySettings(s: A11ySettings) {
  const el = document.documentElement;

  if (s.fontLevel > 0) {
    el.setAttribute("data-a11y-font", String(s.fontLevel));
  } else {
    el.removeAttribute("data-a11y-font");
  }

  if (s.highContrast) {
    el.setAttribute("data-a11y-contrast", "high");
  } else {
    el.removeAttribute("data-a11y-contrast");
  }

  if (s.underlineLinks) {
    el.setAttribute("data-a11y-links", "underline");
  } else {
    el.removeAttribute("data-a11y-links");
  }

  if (s.largeSpacing) {
    el.setAttribute("data-a11y-spacing", "relaxed");
  } else {
    el.removeAttribute("data-a11y-spacing");
  }
}

function isDefault(s: A11ySettings) {
  return (
    s.fontLevel === 0 &&
    !s.highContrast &&
    !s.underlineLinks &&
    !s.largeSpacing
  );
}

// ─── Context ──────────────────────────────────────────────────────────────────

const A11yContext = createContext<A11yContextValue | null>(null);

export function AccessibilityProvider({ children }: { children: ReactNode }) {
  // Lazy initializer reads localStorage once on mount (typeof guard for SSR).
  const [settings, setSettings] = useState<A11ySettings>(() => {
    if (typeof window === "undefined") return DEFAULT;
    return loadSettings();
  });

  // Apply on mount (first run), apply+save on every subsequent change.
  const isFirstRun = useRef(true);
  useEffect(() => {
    if (isFirstRun.current) {
      isFirstRun.current = false;
      applySettings(settings);
      return;
    }
    applySettings(settings);
    saveSettings(settings);
  }, [settings]);

  const update = useCallback((patch: Partial<A11ySettings>) => {
    setSettings((prev) => ({ ...prev, ...patch }));
  }, []);

  const increaseFontSize = useCallback(() => {
    setSettings((prev) => ({
      ...prev,
      fontLevel: (Math.min(prev.fontLevel + 1, 2) as FontLevel),
    }));
  }, []);

  const decreaseFontSize = useCallback(() => {
    setSettings((prev) => ({
      ...prev,
      fontLevel: (Math.max(prev.fontLevel - 1, 0) as FontLevel),
    }));
  }, []);

  const toggleHighContrast = useCallback(
    () => update({ highContrast: !settings.highContrast }),
    [settings.highContrast, update]
  );

  const toggleUnderlineLinks = useCallback(
    () => update({ underlineLinks: !settings.underlineLinks }),
    [settings.underlineLinks, update]
  );

  const toggleLargeSpacing = useCallback(
    () => update({ largeSpacing: !settings.largeSpacing }),
    [settings.largeSpacing, update]
  );

  const reset = useCallback(() => {
    setSettings(DEFAULT);
    applySettings(DEFAULT);
    saveSettings(DEFAULT);
  }, []);

  return (
    <A11yContext.Provider
      value={{
        settings,
        isModified: !isDefault(settings),
        increaseFontSize,
        decreaseFontSize,
        toggleHighContrast,
        toggleUnderlineLinks,
        toggleLargeSpacing,
        reset,
      }}
    >
      {children}
    </A11yContext.Provider>
  );
}

export function useAccessibility() {
  const ctx = useContext(A11yContext);
  if (!ctx) throw new Error("useAccessibility must be used inside AccessibilityProvider");
  return ctx;
}
