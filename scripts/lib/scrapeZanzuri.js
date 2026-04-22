// scripts/lib/scrapeZanzuri.js
// Read-only Playwright scraper for zanzuri.co.il.
// NEVER writes to any database, Supabase table, or source file.
// Outputs: result JSON/CSV + per-product screenshots in output/debug/.

'use strict';

const fs   = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const { findBestMatch, generateQueries, LOW_THRESHOLD } = require('./matchProducts');

// ── Constants ─────────────────────────────────────────────────────────────────

const BASE_URL   = 'https://zanzuri.co.il';
const SEARCH_URL = `${BASE_URL}/?s={query}&post_type=product`;

const DELAY_MS        = 900;   // polite inter-request pause
const NAV_TIMEOUT     = 30000; // page.goto timeout
const MAX_NAV_RETRIES = 2;     // retries on ERR_ABORTED
const VARIATION_WAIT  = 7000;  // max ms to wait for price to appear after selection
const POLL_INTERVAL   = 200;   // polling granularity

const DEBUG_DIR = path.resolve(__dirname, '../../output/debug');

// ── DOM selectors ─────────────────────────────────────────────────────────────
//
// Naming rationale (derived from live DOM inspection):
//
//   .entry-summary              Single-product detail area (grandClass "summary entry-summary col").
//                               Crucially, this does NOT match listing cards (.product_box__inner)
//                               or the sticky carousel. All price reads must start here.
//
//   .product_price              Wrapper around the main displayed price inside .entry-summary.
//                               Contains .price > .woocommerce-Price-amount before any selection.
//
//   .woocommerce-variation-price  WooCommerce injects the variation price here after selection.
//                               Starts with display:none; becomes visible when a variation is chosen.
//
//   form.variations_form        The variation add-to-cart form on variable products.
//                               Only present on variable products; absent on simple products.
//
//   .product__variations__toggle  The VISIBLE custom toggle UI (div.checkbox > label).
//                               There may be multiple on the page (related product cards also render
//                               these). MUST scope to form.variations_form to hit the correct one.
//
//   select[name^="attribute_"]  The underlying WooCommerce hidden select (display:none).
//                               Values confirmed: value="units" (יח'), value="kg" (ק"ג).
//
//   .price_description          <small> element next to the price, e.g. "ליחידה", 'לק"ג'.
//                               Present in .entry-summary for simple products.
//
// EXCLUDED from price reads:
//   .product_box__inner         Listing card prices (wrong product).
//   .product_box__sub_title     Per-100g sub-title price on listing cards.
//   .counter                    Cart total in header.
//   .woocommerce-mini-cart      Mini-cart total.
//   del                         Strikethrough (original price before sale).
//   .product_box__tag__label    Promo text ("3 ב-12 ₪" etc.).

const SEL = {
  // Single product detail root — scope everything here
  summary: '.entry-summary',
  // Main price before selection (inside .entry-summary .product_price)
  mainPrice: '.entry-summary .product_price .price:not(del) .woocommerce-Price-amount bdi',
  // Variation price block (hidden → visible after WC JS fires)
  variationBlock: '.entry-summary .woocommerce-variation-price',
  variationPrice: '.entry-summary .woocommerce-variation-price .woocommerce-Price-amount bdi',
  // Price type label ("ליחידה", 'לק"ג')
  priceDesc: '.entry-summary .price_description',
  // Variation form (only exists on variable products)
  variationsForm: 'form.variations_form',
  // Custom visible toggle UI — scoped inside the form
  toggleInForm: 'form.variations_form .product__variations__toggle',
  checkbox: '.checkbox',
  // Hidden WooCommerce select
  hiddenSelect: 'form.variations_form select[name^="attribute_"]',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function ensureDebugDir() {
  if (!fs.existsSync(DEBUG_DIR)) fs.mkdirSync(DEBUG_DIR, { recursive: true });
}

/**
 * Navigate with automatic retry on ERR_ABORTED / ERR_CONNECTION.
 */
async function gotoWithRetry(page, url, opts = {}) {
  const options = { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT, ...opts };
  for (let attempt = 0; attempt <= MAX_NAV_RETRIES; attempt++) {
    try {
      await page.goto(url, options);
      return;
    } catch (err) {
      const isAbort = err.message.includes('ERR_ABORTED') || err.message.includes('ERR_CONNECTION');
      if (isAbort && attempt < MAX_NAV_RETRIES) {
        const wait = 1500 * (attempt + 1);
        console.log(`    ↻ Nav aborted, retrying in ${wait}ms`);
        await sleep(wait);
        continue;
      }
      throw err;
    }
  }
}

/**
 * Parse a numeric price from a raw price text like "₪15.00" → 15.
 * Returns null if unparseable.
 */
function parsePriceText(text) {
  if (!text) return null;
  // Strip everything that isn't a digit or decimal point
  const digits = text.replace(/[^\d.]/g, '');
  if (!digits) return null;
  const val = parseFloat(digits);
  return isNaN(val) ? null : val;
}

async function saveScreenshot(page, slug, label) {
  try {
    ensureDebugDir();
    const name = `${slug.replace(/[^\w-]/g, '_')}_${label}.png`;
    await page.screenshot({ path: path.join(DEBUG_DIR, name), fullPage: false });
    console.log(`    [debug] screenshot → output/debug/${name}`);
  } catch (e) {
    console.log(`    [debug] screenshot failed: ${e.message}`);
  }
}

// ── Price reading (strictly scoped to .entry-summary) ─────────────────────────

/**
 * Read the main product price from .entry-summary .product_price.
 * This is the price displayed BEFORE any variation is selected.
 * Returns the raw price text (e.g. "₪9.90") or null.
 *
 * Explicitly excludes:
 *   - .product_box__inner (listing card prices)
 *   - .woocommerce-variation-price (variation price, hidden by default)
 *   - del elements (strikethrough original prices)
 *   - ₪0.00 (empty cart total)
 */
async function readMainPrice(page) {
  return page.evaluate((sel) => {
    const summary = document.querySelector(sel.summary);
    if (!summary) return null;

    // Prefer .product_price container (the dedicated wrapper for the main price)
    const pp = summary.querySelector('.product_price');
    if (pp) {
      // Skip if this element is inside the variation block (it shouldn't be, but guard)
      if (pp.closest('.woocommerce-variation-price')) return null;
      const bdi = pp.querySelector('.price:not(del) .woocommerce-Price-amount bdi');
      if (bdi) {
        const txt = bdi.textContent.trim();
        if (txt && txt !== '₪0.00' && txt !== '0.00') return txt;
      }
    }

    // Fallback: first visible .price inside summary that is not a variation block or del
    const prices = summary.querySelectorAll('.price .woocommerce-Price-amount bdi');
    for (const el of prices) {
      if (el.closest('.woocommerce-variation-price')) continue;
      if (el.closest('del')) continue;
      if (el.closest('.product_box__inner')) continue; // listing card
      const txt = el.textContent.trim();
      if (txt && txt !== '₪0.00') return txt;
    }
    return null;
  }, SEL);
}

/**
 * Read the variation price from .entry-summary .woocommerce-variation-price.
 * WooCommerce makes this block visible (display block) after a variation is selected.
 * Returns price text or null if the block is hidden or empty.
 */
async function readVariationPrice(page) {
  return page.evaluate((sel) => {
    const summary = document.querySelector(sel.summary);
    if (!summary) return null;

    const block = summary.querySelector('.woocommerce-variation-price');
    if (!block) return null;

    const style = window.getComputedStyle(block);
    if (style.display === 'none' || style.visibility === 'hidden') return null;

    const bdi = block.querySelector('.woocommerce-Price-amount bdi');
    if (!bdi) return null;

    const txt = bdi.textContent.trim();
    return txt && txt !== '₪0.00' ? txt : null;
  }, SEL);
}

/**
 * Read the price description label inside .entry-summary.
 * Returns text like "ליחידה", 'לק"ג', "למארז", etc.  or null.
 */
async function readPriceDescription(page) {
  return page.evaluate((sel) => {
    const summary = document.querySelector(sel.summary);
    if (!summary) return null;
    // Prefer description next to the main .product_price price
    const pp = summary.querySelector('.product_price .price_description');
    if (pp) return pp.textContent.trim();
    // Fallback: any price_description in summary
    const any = summary.querySelector('.price_description');
    return any ? any.textContent.trim() : null;
  }, SEL);
}

/**
 * Poll until .woocommerce-variation-price becomes visible AND non-empty.
 * Returns the price text on success, null on timeout.
 */
async function waitForVariationPrice(page, timeoutMs = VARIATION_WAIT) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const price = await readVariationPrice(page);
    if (price) return price;
    await sleep(POLL_INTERVAL);
  }
  return null;
}

// ── Variation introspection ───────────────────────────────────────────────────

/**
 * Introspect the hidden WooCommerce select via JS (visibility-agnostic).
 * Returns null if no variation select exists (= simple product).
 */
async function introspectSelect(page) {
  return page.evaluate((sel) => {
    const s = document.querySelector(sel.hiddenSelect);
    if (!s) return null;
    return {
      name: s.name,
      value: s.value,
      options: Array.from(s.options).map((o) => ({
        value: o.value,
        text: o.text.trim(),
      })),
    };
  }, SEL);
}

/**
 * Capture the outerHTML of the variation form for debug output (truncated).
 */
async function captureVariationHtml(page) {
  return page.evaluate((sel) => {
    const el = document.querySelector(sel.variationsForm);
    return el ? el.outerHTML.substring(0, 3000) : null;
  }, SEL);
}

// ── Unit selection strategies ─────────────────────────────────────────────────

/**
 * S1 — Click the visible custom toggle label for the unit option.
 *
 * The site replaces the hidden <select> with a custom UI:
 *   <div class="product__variations__toggle d-inline-flex">
 *     <div class="checkbox"><label>יח'</label></div>
 *     <div class="checkbox"><label>ק"ג</label></div>
 *   </div>
 *
 * CRITICAL: scope to form.variations_form — the page can have multiple
 *           identical toggles (one per variable product in the related-products
 *           carousel). Clicking the wrong one navigates away.
 *
 * Returns the clicked label text, or null.
 */
async function s1_clickToggleLabel(page, notes) {
  const result = await page.evaluate((sel) => {
    const form = document.querySelector(sel.variationsForm);
    if (!form) return null;

    const toggle = form.querySelector('.product__variations__toggle');
    if (!toggle) return null;

    const unitTerms = ['יח', "יח'", 'יחידה'];
    const checkboxes = toggle.querySelectorAll('.checkbox');

    for (const cb of checkboxes) {
      const text = cb.textContent.trim();
      if (!unitTerms.some((t) => text.includes(t))) continue;

      // Click the <label> if present (more specific); otherwise the div itself
      const target = cb.querySelector('label') || cb;
      target.click();
      return text;
    }
    return null;
  }, SEL);

  if (result) {
    notes.push(`S1: clicked toggle label "${result}" (scoped to form.variations_form)`);
  } else {
    notes.push('S1: no unit toggle label found inside form.variations_form');
  }
  return result;
}

/**
 * S2 — Directly set the hidden <select> value via JS and dispatch WooCommerce's
 * required events. This is the primary reliable approach for display:none selects.
 *
 * WooCommerce listens for 'change' and 'woocommerce_variation_select_change' on the
 * select element and responds by updating the variation price block.
 *
 * @param {string} optionValue  the English option value: "units" or "kg"
 */
async function s2_setHiddenSelect(page, optionValue, optionText, notes) {
  // Playwright page.evaluate only accepts ONE extra argument → wrap in object
  const success = await page.evaluate(({ hiddenSelect, val }) => {
    const s = document.querySelector(hiddenSelect);
    if (!s) return false;

    s.value = val;
    if (s.value !== val) return false; // value wasn't accepted

    s.dispatchEvent(new Event('change', { bubbles: true }));
    s.dispatchEvent(new Event('input',  { bubbles: true }));
    s.dispatchEvent(new CustomEvent('woocommerce_variation_select_change', { bubbles: true }));

    return true;
  }, { hiddenSelect: SEL.hiddenSelect, val: optionValue });

  if (success) {
    notes.push(`S2: JS-set hidden select to value="${optionValue}" ("${optionText}"), dispatched change/input/wc events`);
  } else {
    notes.push(`S2: failed — select not found or value "${optionValue}" not accepted`);
  }
  return success;
}

// ── Core page scraper ─────────────────────────────────────────────────────────

/**
 * Scrape a single product detail page.
 *
 * Strategy:
 *  1. Navigate with retry.
 *  2. Wait for WC JS to initialise (domcontentloaded + 800ms).
 *  3. Read main price (scoped to .entry-summary .product_price) → price_before.
 *  4. If no form.variations_form → simple product branch.
 *  5. Introspect the hidden select to find unit option (value="units").
 *  6. If no unit option → kg_only.
 *  7. Try S1 (click toggle label), then S2 (JS set select).
 *  8. After each strategy: wait for .woocommerce-variation-price to become visible.
 *  9. Determine status:
 *       matched_unit_price — unit option found, selected, price changed (confirmed)
 *       kg_only            — no unit option, or unit selection failed
 *       needs_review       — uncertain / no price found at all
 *
 * @param {import('playwright').Page} page
 * @param {string} url
 * @param {string} slug  used in screenshot filenames
 */
async function scrapeProductPage(page, url, slug) {
  ensureDebugDir();

  await gotoWithRetry(page, url);
  // WooCommerce variation JS initialises after DOMContentLoaded; give it time
  await sleep(900);

  const notes = [];
  const debug = {
    main_price_text:     null,
    selection_method:    null,
    selected_unit_label: null,
    price_before:        null,
    price_after:         null,
    variation_html_snippet: null,
  };

  // ── 1. Capture initial state ──────────────────────────────────────────────
  debug.main_price_text = await readMainPrice(page);
  debug.price_before    = debug.main_price_text;
  debug.variation_html_snippet = await captureVariationHtml(page);

  // Always save a screenshot for every product
  await saveScreenshot(page, slug, 'loaded');

  notes.push(`Main price on load: ${debug.main_price_text ?? 'none'}`);

  // ── 2. Simple vs variable product ─────────────────────────────────────────
  const hasVariationForm = !!(await page.$(SEL.variationsForm));

  if (!hasVariationForm) {
    return handleSimpleProduct(page, debug, notes, slug);
  }

  // ── 3. Introspect hidden select ───────────────────────────────────────────
  const selectData = await introspectSelect(page);

  if (!selectData) {
    notes.push('form.variations_form present but no attribute select found — needs_review');
    await saveScreenshot(page, slug, 'no_select');
    return buildScrapeResult(null, null, null, 'needs_review', debug, notes);
  }

  const validOptions = selectData.options.filter((o) => o.value !== '');
  notes.push(
    `Select "${selectData.name}": [${validOptions.map((o) => `${o.value}="${o.text}"`).join(', ')}]`
  );

  const unitOpt = validOptions.find(
    (o) => o.text.includes('יח') || o.value === 'units' || o.value.includes('unit')
  );
  const kgOpt = validOptions.find(
    (o) => o.text.includes('ק"ג') || o.text.includes("ק'ג") || o.value === 'kg'
  );

  // ── 4. No unit option → kg_only ───────────────────────────────────────────
  if (!unitOpt) {
    notes.push('No unit option in select → kg_only');
    const kgPrice = parsePriceText(debug.main_price_text);
    return buildScrapeResult(null, kgPrice, 'ק"ג', 'kg_only', debug, notes);
  }

  // ── 5. Try to select the unit option ─────────────────────────────────────
  const unitPriceText = await attemptUnitSelection(page, unitOpt, debug, notes, slug);

  // ── 6. Optionally read kg price (select kg option, read variation price) ──
  let kgPriceText = null;
  if (kgOpt) {
    kgPriceText = await readKgPrice(page, kgOpt, unitPriceText, notes);
  }

  // ── 7. Decide status ──────────────────────────────────────────────────────
  const unit_price = parsePriceText(unitPriceText);
  const kg_price   = parsePriceText(kgPriceText ?? debug.main_price_text);

  // Rule: only mark matched_unit_price if selection happened AND price changed
  if (unit_price !== null && debug.selection_method !== null) {
    notes.push(`Result: unit ₪${unit_price}, kg ₪${kg_price ?? 'n/a'}`);
    return buildScrapeResult(unit_price, kg_price, 'יחידה', 'matched_unit_price', debug, notes);
  }

  if (kg_price !== null) {
    notes.push(`Result: no unit price obtained; kg ₪${kg_price}`);
    return buildScrapeResult(null, kg_price, 'ק"ג', 'kg_only', debug, notes);
  }

  await saveScreenshot(page, slug, 'no_price');
  notes.push('Could not extract any price after all strategies → needs_review');
  return buildScrapeResult(null, null, null, 'needs_review', debug, notes);
}

// ── Unit selection cascade ────────────────────────────────────────────────────

async function attemptUnitSelection(page, unitOpt, debug, notes, slug) {
  // S1: click the visible toggle label inside form.variations_form
  const s1Label = await s1_clickToggleLabel(page, notes);
  if (s1Label) {
    debug.selection_method    = 'S1_click_toggle_label';
    debug.selected_unit_label = s1Label;
    const newPrice = await waitForVariationPrice(page);
    if (newPrice) {
      debug.price_after = newPrice;
      notes.push(`S1 success: variation price appeared → "${newPrice}"`);
      return newPrice;
    }
    notes.push('S1: clicked but variation price did not appear within timeout → trying S2');
  }

  // S2: JS evaluate — set hidden select value + dispatch events
  const s2ok = await s2_setHiddenSelect(page, unitOpt.value, unitOpt.text, notes);
  if (s2ok) {
    debug.selection_method    = debug.selection_method ?? 'S2_js_hidden_select';
    debug.selected_unit_label = unitOpt.text;
    const newPrice = await waitForVariationPrice(page);
    if (newPrice) {
      debug.price_after = newPrice;
      notes.push(`S2 success: variation price appeared → "${newPrice}"`);
      return newPrice;
    }
    notes.push('S2: dispatched events but variation price did not appear → all strategies failed');
  }

  await saveScreenshot(page, slug, 'unit_selection_failed');
  notes.push('All unit-selection strategies exhausted. Screenshot saved.');

  // Last-resort: if the pre-selection main price already had a unit label, trust it
  if (debug.main_price_text) {
    const priceDesc = await readPriceDescription(page);
    if (priceDesc && (priceDesc.includes('יחידה') || priceDesc.includes("יח'"))) {
      notes.push(`Fallback: main price "${debug.main_price_text}" has unit label "${priceDesc}" → accepting`);
      debug.price_after     = debug.main_price_text;
      debug.selection_method = 'fallback_unit_label_on_main_price';
      return debug.main_price_text;
    }
  }

  debug.selection_method = null; // signal: no reliable selection happened
  return null;
}

async function readKgPrice(page, kgOpt, afterUnitPriceText, notes) {
  // Set to kg and read the variation price
  // Playwright page.evaluate only accepts ONE extra argument → wrap in object
  await page.evaluate(({ hiddenSelect, val }) => {
    const s = document.querySelector(hiddenSelect);
    if (!s) return;
    s.value = val;
    s.dispatchEvent(new Event('change', { bubbles: true }));
    s.dispatchEvent(new Event('input',  { bubbles: true }));
  }, { hiddenSelect: SEL.hiddenSelect, val: kgOpt.value });

  const deadline = Date.now() + 4000;
  while (Date.now() < deadline) {
    const price = await readVariationPrice(page);
    if (price && price !== afterUnitPriceText) {
      notes.push(`Kg price read: "${price}"`);
      return price;
    }
    await sleep(POLL_INTERVAL);
  }
  // If unchanged, the current variation price (after switching to kg) is whatever's visible
  const current = await readVariationPrice(page);
  if (current && current !== afterUnitPriceText) return current;

  notes.push('Could not read distinct kg price after switching; using main price as kg fallback');
  return null;
}

// ── Simple product handler ────────────────────────────────────────────────────

/**
 * Handle simple products (no form.variations_form).
 * Price is a static single value; unit type is determined from the price label.
 */
async function handleSimpleProduct(page, debug, notes, slug) {
  notes.push('Simple product — no variation form.');

  const price = parsePriceText(debug.main_price_text);

  if (price === null) {
    await saveScreenshot(page, slug, 'simple_no_price');
    notes.push('No price found in .entry-summary .product_price');
    return buildScrapeResult(null, null, null, 'needs_review', debug, notes);
  }

  // Read the <small class="price_description"> next to the price
  const priceDesc = await readPriceDescription(page);
  notes.push(`Simple product: price="${debug.main_price_text}", label="${priceDesc ?? 'none'}"`);

  // Read broader .entry-summary text for unit-type keywords
  const summaryText = await page.evaluate((sel) => {
    const el = document.querySelector(sel.summary);
    return el ? el.innerText : '';
  }, SEL);

  const isUnitDesc = priceDesc && (priceDesc.includes('יחידה') || priceDesc.includes("יח'") || priceDesc.includes('ליח'));
  const isKgDesc   = priceDesc && (priceDesc.includes('ק"ג')   || priceDesc.includes('קילו') || priceDesc.includes('100 גרם'));

  const isUnitBody = summaryText.includes('ליחידה') || summaryText.includes("ליח'");
  const isKgBody   = summaryText.includes('לק"ג')   || summaryText.includes('לקילו') || summaryText.includes('ל-100 גרם');

  const isUnit = isUnitDesc || (isUnitBody && !isKgDesc);
  const isKg   = isKgDesc   || (isKgBody  && !isUnitDesc);

  if (isUnit && !isKg) {
    debug.selection_method = 'simple_unit_label';
    debug.price_after      = debug.main_price_text;
    notes.push('Classified as unit price from label/body text.');
    return buildScrapeResult(price, null, 'יחידה', 'matched_unit_price', debug, notes);
  }

  if (isKg) {
    notes.push('Classified as kg price from label/body text.');
    return buildScrapeResult(null, price, 'ק"ג', 'kg_only', debug, notes);
  }

  // Unit type ambiguous — do NOT classify as unit price (safety rule)
  notes.push('Unit type ambiguous — no clear label found → needs_review');
  await saveScreenshot(page, slug, 'ambiguous_unit_type');
  return buildScrapeResult(null, price, null, 'needs_review', debug, notes);
}

// ── Result builder ────────────────────────────────────────────────────────────

function buildScrapeResult(unit_price, kg_price, unit_type, status, debug, notes) {
  return {
    unit_price,
    kg_price,
    currency: 'ILS',
    unit_type,
    status,
    notes: notes.join(' | '),
    ...debug,
  };
}

// ── Search / product listing ──────────────────────────────────────────────────

async function parseProductList(page) {
  return page.evaluate(() => {
    const results = [];
    const seen    = new Set();
    const links   = document.querySelectorAll('.product a[href*="/product/"]');
    links.forEach((el) => {
      const url = el.href;
      if (!url || seen.has(url)) return;
      seen.add(url);
      const card    = el.closest('.product');
      const titleEl = card && (
        card.querySelector('.woocommerce-loop-product__title') ||
        card.querySelector('h2') ||
        card.querySelector('h3')
      );
      const name = (titleEl ? titleEl.textContent : el.textContent || '').trim();
      if (name) results.push({ name, url });
    });
    return results;
  });
}

async function searchProducts(page, query) {
  const url = SEARCH_URL.replace('{query}', encodeURIComponent(query));
  await gotoWithRetry(page, url, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await sleep(400);
  return parseProductList(page);
}

/**
 * Run up to 3 generated query variants for a product and merge results by URL.
 * This widens the candidate pool without over-requesting the site.
 *
 * @param {import('playwright').Page} page
 * @param {string} productName
 * @returns {Promise<{name:string, url:string}[]>}
 */
async function searchWithMultipleQueries(page, productName) {
  const { queries } = generateQueries(productName);
  const byUrl = new Map();

  // Cap at 3 queries to avoid hammering the site
  const limit = Math.min(queries.length, 3);
  for (let i = 0; i < limit; i++) {
    const q = queries[i];
    console.log(`    search query [${i + 1}/${limit}]: "${q}"`);
    const candidates = await searchProducts(page, q);
    for (const c of candidates) {
      if (!byUrl.has(c.url)) byUrl.set(c.url, c);
    }
    // Brief pause between queries (not needed after last)
    if (i < limit - 1) await sleep(400);
  }

  return [...byUrl.values()];
}

// ── Main scrape loop ──────────────────────────────────────────────────────────

/**
 * Process all products sequentially.
 * onResult is called after each product so the caller can persist incrementally.
 *
 * @param {{id:string, slug:string, name:string}[]} products
 * @param {(result:object, candidateCount:number) => void} onResult
 * @returns {Promise<object[]>}
 */
async function scrapeAll(products, onResult) {
  const browser = await chromium.launch({ headless: true });
  const ctx     = await browser.newContext({
    locale:         'he-IL',
    userAgent:      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    serviceWorkers: 'block',
  });
  const page = await ctx.newPage();
  page.on('console', () => {}); // suppress site console noise

  const results = [];

  for (const product of products) {
    const idx = results.length + 1;
    console.log(`\n[${idx}/${products.length}] ${product.name}`);

    let candidateCount = 0;

    try {
      // ── Search (multi-query) ─────────────────────────────────────────
      const candidates = await searchWithMultipleQueries(page, product.name);
      candidateCount   = candidates.length;
      console.log(`  Candidates after merge: ${candidateCount}`);

      if (candidateCount === 0) {
        const r = buildResult(product, null, null, candidateCount, {
          unit_price: null, kg_price: null, currency: 'ILS', unit_type: null,
          status: 'not_found',
          notes: 'No results returned by site search.',
          main_price_text: null, selection_method: null, selected_unit_label: null,
          price_before: null, price_after: null, variation_html_snippet: null,
        });
        results.push(r);
        onResult(r);
        await sleep(DELAY_MS);
        continue;
      }

      // ── Match ────────────────────────────────────────────────────────
      const matchResult = findBestMatch(product.name, candidates);

      if (!matchResult.matched) {
        console.log(`  No match — top candidates: ${matchResult.top_candidates_debug}`);
        const r = buildResult(product, matchResult, null, candidateCount, {
          unit_price: null, kg_price: null, currency: 'ILS', unit_type: null,
          status: 'not_found',
          notes: `Below match threshold (${LOW_THRESHOLD}). Top: ${matchResult.top_candidates_debug}`,
          main_price_text: null, selection_method: null, selected_unit_label: null,
          price_before: null, price_after: null, variation_html_snippet: null,
        });
        results.push(r);
        onResult(r);
        await sleep(DELAY_MS);
        continue;
      }

      const match = matchResult; // alias for readability — all fields are at top level
      const confLabel = match.isLowConfidence ? 'LOW' : 'HIGH';
      console.log(`  Matched → "${match.name}" (conf=${match.confidence} ${confLabel})`);
      console.log(`  Winning query: "${match.winning_query}" | base: "${match.base_name}"`);
      console.log(`  URL: ${match.url}`);

      // ── Scrape ───────────────────────────────────────────────────────
      await sleep(DELAY_MS);
      const scraped = await scrapeProductPage(page, match.url, product.slug);

      // ── Confidence threshold branching ───────────────────────────────
      // Low confidence (0.60–0.79): the match may be wrong — never trust it
      // as a definitive unit-price result; always flag for human review.
      if (match.isLowConfidence && scraped.status === 'matched_unit_price') {
        scraped.status = 'needs_review';
        scraped.notes  += ' | Low-confidence match (conf<0.80) → downgraded to needs_review';
        console.log(`  ↓ Downgraded to needs_review (low confidence match)`);
      }

      // ── Soft base match override ─────────────────────────────────────
      // Matched via soft base match (score below LOW_THRESHOLD but base found).
      // Always needs_review regardless of scraping result.
      if (match.matched_via_soft_base_match) {
        scraped.status = 'needs_review';
        const extras = match.extra_candidate_words?.join(', ') ?? '';
        scraped.notes += ` | Soft base match: candidate adds [${extras}] — manual review required`;
        console.log(`  ↑ Soft base match accepted (extra words: [${extras}])`);
      }

      const r = buildResult(product, match, match.url, candidateCount, scraped);
      results.push(r);
      onResult(r);

    } catch (err) {
      console.error(`  ERROR: ${err.message}`);
      const r = buildResult(product, null, null, candidateCount, {
        unit_price: null, kg_price: null, currency: 'ILS', unit_type: null,
        status: 'needs_review',
        notes: `Scraping error: ${err.message}`,
        main_price_text: null, selection_method: null, selected_unit_label: null,
        price_before: null, price_after: null, variation_html_snippet: null,
      });
      results.push(r);
      onResult(r);
    }

    await sleep(DELAY_MS);
  }

  await browser.close();
  return results;
}

function buildResult(product, match, url, candidateCount, scraped) {
  // match can be: null | { matched: false, ... } | { matched: true, name, url, ... }
  const isMatch = match && match.matched === true;
  return {
    id:             product.id,
    slug:           product.slug,
    name:           product.name,
    matched_name:   isMatch ? match.name : null,
    matched_url:    isMatch ? match.url  : (url ?? null),
    unit_price:     scraped.unit_price,
    currency:       scraped.currency || 'ILS',
    unit_type:      scraped.unit_type,
    kg_price:       scraped.kg_price,
    confidence:     isMatch ? match.confidence : 0,
    status:         scraped.status,
    notes:          scraped.notes,
    // Matching debug fields (present for both match and no-match objects)
    winning_query:               match?.winning_query                           ?? null,
    base_name:                   match?.base_name                               ?? null,
    extra_words:                 match?.extra_words?.join(' ')                  ?? null,
    normalized_name:             match?.normalized_name                         ?? null,
    generated_queries:           match?.generated_queries?.join(' | ')          ?? null,
    top_candidates_debug:        match?.top_candidates_debug                    ?? null,
    matched_via_soft_base_match: match?.matched_via_soft_base_match             ?? false,
    extra_candidate_words:       match?.extra_candidate_words?.join(', ')       ?? null,
    manual_review_note:          match?.matched_via_soft_base_match
      ? `Base product matched, candidate contains extra words: [${match.extra_candidate_words?.join(', ')}]`
      : null,
    // Scrape diagnostic fields
    candidate_count:       candidateCount,
    main_price_text:       scraped.main_price_text       ?? null,
    selection_method:      scraped.selection_method      ?? null,
    selected_unit_label:   scraped.selected_unit_label   ?? null,
    price_before:          scraped.price_before          ?? null,
    price_after:           scraped.price_after           ?? null,
    variation_html_snippet: scraped.variation_html_snippet ?? null,
  };
}

module.exports = { scrapeAll, scrapeProductPage };
