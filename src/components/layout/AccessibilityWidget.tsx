"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  Accessibility,
  ALargeSmall,
  ZoomIn,
  ZoomOut,
  Contrast,
  Underline,
  AlignJustify,
  RotateCcw,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { useAccessibility } from "@/store/accessibility";

// ─── Toggle row inside the panel ─────────────────────────────────────────────

function ToggleRow({
  icon: Icon,
  label,
  active,
  onToggle,
}: {
  icon: React.ElementType;
  label: string;
  active: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      role="switch"
      aria-checked={active}
      className={cn(
        "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all cursor-pointer",
        "border",
        active
          ? "bg-brand-50 border-brand-300 text-brand-800"
          : "bg-white border-stone-200 text-stone-700 hover:bg-stone-50 hover:border-stone-300"
      )}
    >
      <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span className="flex-1 text-right">{label}</span>
      <span
        className={cn(
          "inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold shrink-0 transition-colors",
          active
            ? "bg-brand-600 text-white"
            : "bg-stone-100 text-stone-400"
        )}
      >
        {active ? "פעיל" : "כבוי"}
      </span>
    </button>
  );
}

// ─── Font size control row ────────────────────────────────────────────────────

function FontSizeRow({
  level,
  onIncrease,
  onDecrease,
}: {
  level: number;
  onIncrease: () => void;
  onDecrease: () => void;
}) {
  const labels = ["רגיל", "גדול", "גדול יותר"];
  return (
    <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-stone-200 bg-white">
      <ALargeSmall className="h-4 w-4 text-stone-500 shrink-0" aria-hidden="true" />
      <span className="flex-1 text-sm font-medium text-stone-700 text-right">
        גודל טקסט
        <span className={cn(
          "me-1.5 text-[11px] font-semibold",
          level > 0 ? "text-brand-700" : "text-stone-400"
        )}>
          {" "}({labels[level]})
        </span>
      </span>
      <div className="flex items-center gap-1 shrink-0">
        <button
          onClick={onDecrease}
          disabled={level === 0}
          aria-label="הקטן טקסט"
          className="h-7 w-7 flex items-center justify-center rounded-lg border border-stone-200 text-stone-600
                     hover:bg-stone-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
        >
          <ZoomOut className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={onIncrease}
          disabled={level === 2}
          aria-label="הגדל טקסט"
          className="h-7 w-7 flex items-center justify-center rounded-lg border border-stone-200 text-stone-600
                     hover:bg-stone-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
        >
          <ZoomIn className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

// ─── Main widget ──────────────────────────────────────────────────────────────

export function AccessibilityWidget() {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const {
    settings,
    isModified,
    increaseFontSize,
    decreaseFontSize,
    toggleHighContrast,
    toggleUnderlineLinks,
    toggleLargeSpacing,
    reset,
  } = useAccessibility();

  const closePanel = useCallback(() => setOpen(false), []);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        closePanel();
        triggerRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, closePanel]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target as Node) &&
        !triggerRef.current?.contains(e.target as Node)
      ) {
        closePanel();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open, closePanel]);

  return (
    <div className="fixed bottom-5 left-5 z-50 flex flex-col items-start gap-2">
      {/* Panel */}
      {open && (
        <div
          ref={panelRef}
          role="dialog"
          aria-label="אפשרויות נגישות"
          aria-modal="false"
          dir="rtl"
          onMouseDown={(e) => e.stopPropagation()}
          className={cn(
            "w-72 bg-white rounded-2xl shadow-2xl border border-stone-100",
            "flex flex-col overflow-hidden",
            "animate-scale-in origin-bottom-left"
          )}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-stone-100 bg-stone-50">
            <div className="flex items-center gap-2">
              <Accessibility className="h-4 w-4 text-brand-600" aria-hidden="true" />
              <span className="text-sm font-bold text-gray-900">אפשרויות נגישות</span>
            </div>
            <button
              onClick={closePanel}
              aria-label="סגור"
              className="h-7 w-7 flex items-center justify-center rounded-full text-stone-400 hover:text-stone-700 hover:bg-stone-200 transition-colors cursor-pointer"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Controls */}
          <div className="p-3 flex flex-col gap-2">
            <FontSizeRow
              level={settings.fontLevel}
              onIncrease={increaseFontSize}
              onDecrease={decreaseFontSize}
            />
            <ToggleRow
              icon={Contrast}
              label="ניגודיות גבוהה"
              active={settings.highContrast}
              onToggle={toggleHighContrast}
            />
            <ToggleRow
              icon={Underline}
              label="הדגשת קישורים"
              active={settings.underlineLinks}
              onToggle={toggleUnderlineLinks}
            />
            <ToggleRow
              icon={AlignJustify}
              label="ריווח מוגבר"
              active={settings.largeSpacing}
              onToggle={toggleLargeSpacing}
            />
          </div>

          {/* Footer */}
          <div className="px-3 pb-3">
            <button
              onClick={reset}
              disabled={!isModified}
              className={cn(
                "w-full flex items-center justify-center gap-2 h-9 rounded-xl text-xs font-semibold transition-colors cursor-pointer",
                "border",
                isModified
                  ? "border-stone-300 text-stone-600 hover:bg-stone-50 hover:border-stone-400"
                  : "border-stone-200 text-stone-300 cursor-not-allowed"
              )}
            >
              <RotateCcw className="h-3 w-3" aria-hidden="true" />
              איפוס הגדרות
            </button>
          </div>

          {/* Disclaimer */}
          <div className="px-3 pb-3">
            <p className="text-[10px] text-stone-400 text-center leading-relaxed">
              כלי זה מסייע בהתאמת תצוגה אישית.{" "}
              <a
                href="/accessibility"
                className="underline hover:text-stone-600 transition-colors"
                onClick={closePanel}
              >
                הצהרת נגישות
              </a>
            </p>
          </div>
        </div>
      )}

      {/* Trigger button */}
      <button
        ref={triggerRef}
        onClick={() => setOpen((v) => !v)}
        aria-label="פתח תפריט נגישות"
        aria-expanded={open}
        aria-controls="a11y-panel"
        title="נגישות"
        className={cn(
          "h-12 w-12 rounded-full shadow-lg flex items-center justify-center",
          "transition-all duration-200",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500",
          open
            ? "bg-brand-700 text-white"
            : "bg-brand-600 text-white hover:bg-brand-700 hover:scale-105",
          isModified && !open && "ring-2 ring-brand-300 ring-offset-1"
        )}
      >
        <Accessibility className="h-5 w-5" aria-hidden="true" />
      </button>
    </div>
  );
}
