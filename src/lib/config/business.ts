/**
 * Legal business identity, for the financial sales report header only.
 *
 * Provided directly by the business owner together with the report
 * specification: the registered company name and company number as they
 * appear on the business's own physical POS accounting report. There is no
 * other place in this codebase that configures a legal company identity —
 * BRAND_NAME in src/lib/constants.ts is the storefront's display name, not
 * a legal one — so this is the single source of truth for it. If it is
 * ever wrong, correct it here; nothing else needs to change.
 */
export const BUSINESS_IDENTITY = {
  /** Registered company name. */
  name: 'יבולי שילת בע"מ (משק 22)',
  /** Company registration number (ח"פ), as recorded with the Israeli Registrar of Companies. */
  taxId: "515125482",
} as const;
