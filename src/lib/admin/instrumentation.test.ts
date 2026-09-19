import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * completeMutation() is the shared, safe tail of every admin create/update
 * action — see src/app/meshek22-control/(protected)/categories/actions.ts
 * and its four siblings (products/settlements/delivery-zones/promotions) for
 * real call sites. redirect() genuinely throws (that's how Next.js performs
 * a server-side redirect), so it is mocked the same way
 * combined-category.test.ts mocks permanentRedirect: a thrown, digest-style
 * signal the caller must let propagate.
 */
const { redirect } = vi.hoisted(() => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
}));

vi.mock("next/navigation", () => ({ redirect }));

import { completeMutation } from "@/lib/admin/instrumentation";

beforeEach(() => {
  redirect.mockClear();
  vi.spyOn(console, "log").mockImplementation(() => {});
});

describe("completeMutation", () => {
  it("logs write_succeeded, runs the invalidation, logs redirect_success, then redirects", () => {
    const calls: string[] = [];
    const invalidate = vi.fn(() => calls.push("invalidate"));

    expect(() =>
      completeMutation("category-create", performance.now(), "/meshek22-control/categories", invalidate)
    ).toThrow(/NEXT_REDIRECT:\/meshek22-control\/categories/);

    expect(invalidate).toHaveBeenCalledTimes(1);
    expect(redirect).toHaveBeenCalledWith("/meshek22-control/categories");

    const logCalls = (console.log as ReturnType<typeof vi.fn>).mock.calls;
    const stages = logCalls
      .filter(([tag]) => tag === "[admin:timing]")
      .map(([, payload]) => (payload as { stage?: string }).stage);
    expect(stages).toEqual(["write_succeeded", "redirect_success"]);
  });

  it("still redirects — and the data is still saved — even when invalidation throws", () => {
    const invalidate = vi.fn(() => {
      throw new Error("cache backend unavailable");
    });

    expect(() =>
      completeMutation("category-update", performance.now(), "/meshek22-control/categories", invalidate)
    ).toThrow(/NEXT_REDIRECT:\/meshek22-control\/categories/);

    // The redirect still happened — a cache failure after a successful write
    // must never block the admin from returning to the list.
    expect(redirect).toHaveBeenCalledWith("/meshek22-control/categories");

    const logCalls = (console.log as ReturnType<typeof vi.fn>).mock.calls;
    const stages = logCalls
      .filter(([tag]) => tag === "[admin:timing]")
      .map(([, payload]) => (payload as { stage?: string }).stage);
    // Distinct from write_failed: the write itself already succeeded.
    expect(stages).toEqual(["write_succeeded", "post_write_failed", "redirect_success"]);
  });

  it("never logs write_failed for a post-write cache error — that stage is reserved for the database write itself failing", () => {
    const invalidate = vi.fn(() => {
      throw new Error("boom");
    });

    expect(() =>
      completeMutation("category-update", performance.now(), "/x", invalidate)
    ).toThrow();

    const logCalls = (console.log as ReturnType<typeof vi.fn>).mock.calls;
    const stages = logCalls.map(([, payload]) => (payload as { stage?: string }).stage);
    expect(stages).not.toContain("write_failed");
  });

  it("merges extra fields (e.g. authMs/dbMs) into the write_succeeded log line", () => {
    expect(() =>
      completeMutation("category-update", performance.now(), "/x", () => {}, { authMs: 12, dbMs: 34 })
    ).toThrow();

    const logCalls = (console.log as ReturnType<typeof vi.fn>).mock.calls;
    const writeSucceededCall = logCalls.find(
      ([, payload]) => (payload as { stage?: string }).stage === "write_succeeded"
    );
    expect(writeSucceededCall?.[1]).toMatchObject({ authMs: 12, dbMs: 34, outcome: "success" });
  });
});
