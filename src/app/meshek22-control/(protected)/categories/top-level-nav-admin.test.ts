import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const schema = readFileSync("src/lib/validations/admin-category.ts", "utf8");
const form = readFileSync("src/components/admin/categories/CategoryForm.tsx", "utf8");
const actions = readFileSync(
  "src/app/meshek22-control/(protected)/categories/actions.ts",
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

describe("show_as_top_level_nav: validation schema", () => {
  it("is a required boolean field, distinct from show_in_navbar", () => {
    expect(schema).toContain("show_as_top_level_nav: z.boolean()");
    expect(schema).toContain("show_in_navbar: z.boolean()");
  });
});

describe("show_as_top_level_nav: CategoryForm", () => {
  it("renders a checkbox registered to show_as_top_level_nav with the required Hebrew label", () => {
    expect(form).toContain('{...register("show_as_top_level_nav")}');
    expect(form).toContain("הצג גם ככותרת ראשית בתפריט העליון");
  });

  it("shows the required explanatory description", () => {
    expect(form).toContain(
      "הקטגוריה תישאר תחת קטגוריית האב ותופיע בנוסף כקישור ראשי בתפריט."
    );
  });

  it("defaults to false for a new (create-mode) category", () => {
    expect(form).toContain("show_as_top_level_nav: defaultValues?.show_as_top_level_nav ?? false");
  });

  it("serialises the checkbox value into the FormData sent to the server action", () => {
    expect(form).toContain('fd.set("show_as_top_level_nav", String(data.show_as_top_level_nav));');
  });

  it("is a control distinct from show_in_navbar — both checkboxes exist independently", () => {
    expect(form).toContain('{...register("show_in_navbar")}');
    expect(form).toContain('{...register("show_as_top_level_nav")}');
    expect(form).toContain("הצג בתפריט העליון");
  });

  it("the whole form (including this checkbox) is disabled while a submit is pending", () => {
    expect(form).toMatch(/disabled=\{isPending\}/);
    expect(form).toContain("useTransition()");
  });

  it("still shows the parent option's slug alongside its name, so a mis-parented category is caught before saving", () => {
    expect(form).toContain("{cat.name} ({cat.slug})");
  });
});

describe("show_as_top_level_nav: server actions persist it on both create and update", () => {
  it("parses the field out of the submitted FormData", () => {
    expect(actions).toContain(
      'show_as_top_level_nav: formData.get("show_as_top_level_nav") === "true",'
    );
  });

  it("writes it on both the insert and the update payload, without ever touching parent_id based on it", () => {
    const writes = actions.match(/show_as_top_level_nav:\s*parsed\.data\.show_as_top_level_nav,/g) ?? [];
    expect(writes.length).toBe(2);
  });
});

describe("show_as_top_level_nav: admin pages select and pre-fill it", () => {
  it("the edit page selects and pre-fills it as a form default", () => {
    expect(editPage).toContain("show_as_top_level_nav");
    expect(editPage).toContain("show_as_top_level_nav: category.show_as_top_level_nav,");
  });

  it("the admin categories list selects it and renders a distinct badge from the show_in_navbar one", () => {
    expect(listPage).toContain("show_as_top_level_nav: boolean;");
    expect(listPage).toContain("show_as_top_level_nav, parent_id");
    expect(listPage).toContain("cat.show_as_top_level_nav");
    expect(listPage).toContain("כותרת ראשית");
  });

  it("both the paginated and search-mode tables declare the תפריט + כותרת ראשית header columns their rows render", () => {
    // Regression guard: an earlier edit updated only one of the two <thead>
    // blocks (different indentation defeated a replace-all), leaving the
    // search-mode table's header one column short of its actual row data —
    // a silent column misalignment. Both tables share the CategoryRow
    // component, so both headers must declare the same columns.
    expect(listPage.match(/>תפריט</g)?.length).toBe(2);
    expect(listPage.match(/>כותרת ראשית</g)?.length).toBe(2);
  });
});
