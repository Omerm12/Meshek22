import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * Structural checks for the show_in_navbar admin control, covering create,
 * edit, list, validation and persistence end to end — same readFileSync/no-jsdom
 * convention as Header.test.ts and admin-mutations.test.ts.
 */
const schema = readFileSync("src/lib/validations/admin-category.ts", "utf8");
const form = readFileSync("src/components/admin/categories/CategoryForm.tsx", "utf8");
const actions = readFileSync(
  "src/app/meshek22-control/(protected)/categories/actions.ts",
  "utf8"
);
const newPage = readFileSync(
  "src/app/meshek22-control/(protected)/categories/new/page.tsx",
  "utf8"
);
const editPage = readFileSync(
  "src/app/meshek22-control/(protected)/categories/[id]/edit/page.tsx",
  "utf8"
);
const listPage = readFileSync(
  "src/app/meshek22-control/(protected)/categories/page.tsx",
  "utf8"
);

describe("show_in_navbar: validation schema", () => {
  it("is a required boolean field, distinct from is_active and is_featured", () => {
    expect(schema).toContain("show_in_navbar: z.boolean()");
    expect(schema).toContain("is_active: z.boolean()");
    expect(schema).toContain("is_featured: z.boolean()");
  });
});

describe("show_in_navbar: CategoryForm", () => {
  it("renders a checkbox registered to show_in_navbar, labelled 'הצג בתפריט העליון'", () => {
    expect(form).toContain('{...register("show_in_navbar")}');
    expect(form).toContain("הצג בתפריט העליון");
  });

  it("defaults to false for a new (create-mode) category", () => {
    expect(form).toContain("show_in_navbar: defaultValues?.show_in_navbar ?? false");
  });

  it("serialises the checkbox value into the FormData sent to the server action", () => {
    expect(form).toContain('fd.set("show_in_navbar", String(data.show_in_navbar));');
  });

  it("disables the whole form (including this checkbox) while a submit is pending", () => {
    // Shared submit-button guard covering every field, this one included.
    expect(form).toMatch(/disabled=\{isPending\}/);
    expect(form).toContain("useTransition()");
  });

  it("shows each parent option's slug alongside its name, so two categories that share a name are distinguishable", () => {
    expect(form).toContain("{cat.name} ({cat.slug})");
  });
});

describe("show_in_navbar: server actions persist it on both create and update", () => {
  it("parses the field out of the submitted FormData", () => {
    expect(actions).toContain('show_in_navbar: formData.get("show_in_navbar") === "true",');
  });

  it("writes it on both the insert and the update payload", () => {
    const writes = actions.match(/show_in_navbar:\s*parsed\.data\.show_in_navbar,/g) ?? [];
    expect(writes.length).toBe(2);
  });

  it("every category mutation still invalidates the storefront cache (which the navbar tree is tagged into)", () => {
    expect(actions).toContain("revalidateStorefront()");
  });
});

describe("show_in_navbar: admin pages select and pre-fill it", () => {
  it("the new-category page fetches parent options with their slug (not name alone)", () => {
    expect(newPage).toContain('.select("id, name, slug")');
  });

  it("the edit page selects show_in_navbar on the category row and passes it as a form default", () => {
    expect(editPage).toContain("show_in_navbar");
    expect(editPage).toContain("show_in_navbar: category.show_in_navbar,");
    expect(editPage).toContain('.select("id, name, slug")');
  });

  it("the admin categories list selects show_in_navbar and the parent's slug, and renders a navbar-visibility badge", () => {
    expect(listPage).toContain("show_in_navbar: boolean;");
    expect(listPage).toContain("parent: { id: string; name: string; slug: string } | null;");
    expect(listPage).toContain("cat.show_in_navbar");
    expect(listPage).toContain("בתפריט");
  });
});
