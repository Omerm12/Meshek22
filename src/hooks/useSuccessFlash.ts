"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const DEFAULT_DURATION_MS = 2500;

/**
 * `visible` becomes true when trigger() is called, then automatically false
 * again after `durationMs` — the transient "עודכן בהצלחה" flash the five
 * admin create/edit forms show once their Server Action resolves with
 * {success:true} instead of redirecting (see completeUpdateMutation in
 * src/lib/admin/instrumentation.ts). Deliberately just the timing/visibility
 * bit, not the submit/error/redirect handling itself — that stays inline in
 * each form so admin-mutation-redirect-handling.test.ts can keep pinning it
 * by source inspection per form.
 */
export function useSuccessFlash(durationMs: number = DEFAULT_DURATION_MS) {
  const [visible, setVisible] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    },
    []
  );

  const trigger = useCallback(() => {
    setVisible(true);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => setVisible(false), durationMs);
  }, [durationMs]);

  const reset = useCallback(() => {
    setVisible(false);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  }, []);

  return { visible, trigger, reset } as const;
}
