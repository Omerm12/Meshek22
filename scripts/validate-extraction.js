#!/usr/bin/env node
// scripts/validate-extraction.js
//
// READ-ONLY validation run against 5 specific products.
// Run this before the full extraction to verify correctness.
// Hardcodes known URLs (avoids search/matching noise for the test).
//
// Expected results (as of 2026-04):
//   ארטישוק  → matched_unit_price  ~₪2.97
//   סלרי     → matched_unit_price  ₪6.90 (simple product, unit label)
//             OR needs_review if no label found
//   קישוא    → matched_unit_price  ~₪1.58
//   פלפל חריף → matched_unit_price ~₪2.29
//   בצל לבן  → matched_unit_price or kg_only

'use strict';

const { chromium } = require('playwright');
const fs   = require('fs');
const path = require('path');

// Scrape utilities are imported directly (not through the full orchestrator)
const { scrapeProductPage } = require('./lib/scrapeZanzuri');

const OUTPUT_DIR = path.resolve(__dirname, '../output');
const OUT_FILE   = path.join(OUTPUT_DIR, 'validation-results.json');

const VALIDATION_PRODUCTS = [
  {
    slug: 'artichoke',
    name: 'ארטישוק',
    url:  'https://zanzuri.co.il/product/ארטישוק/',
    expected_status: 'matched_unit_price',
    expected_price_approx: 2.97,
  },
  {
    slug: 'celery',
    name: 'סלרי',
    url:  'https://zanzuri.co.il/product/סלרי/',
    // Simple product — site shows no unit label on detail page.
    // Correct safe behavior per spec: needs_review with kg_price=6.90.
    // (Previous bug was returning ₪3.50 from a DIFFERENT product's card — now fixed.)
    expected_status: 'needs_review',
    expected_price_approx: 6.90,  // checked against kg_price field
  },
  {
    slug: 'zucchini',
    name: 'קישוא',
    url:  'https://zanzuri.co.il/product/קישוא/',
    expected_status: 'matched_unit_price',
    expected_price_approx: 1.58,
  },
  {
    slug: 'hot-pepper',
    name: 'פלפל חריף',
    // Best match from previous search run — product is פלפל צ'ילי חריף
    url:  'https://zanzuri.co.il/product/פלפל-צילי-חריף/',
    expected_status: 'matched_unit_price',
    expected_price_approx: 2.29,
  },
  {
    slug: 'white-onion',
    name: 'בצל לבן',
    url:  'https://zanzuri.co.il/product/בצל-לבן/',
    expected_status: null, // unknown — any result is fine for validation
    expected_price_approx: null,
  },
];

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function checkExpectation(result, expected) {
  if (!expected.expected_status) return { pass: true, reason: 'no expectation set' };

  if (result.status !== expected.expected_status) {
    return { pass: false, reason: `status: expected "${expected.expected_status}", got "${result.status}"` };
  }
  if (expected.expected_price_approx !== null) {
    // Check unit_price first; for needs_review/kg_only check kg_price too
    const price = result.unit_price ?? result.kg_price;
    if (price === null) return { pass: false, reason: 'both unit_price and kg_price are null' };
    const diff = Math.abs(price - expected.expected_price_approx);
    if (diff > 1.5) {
      return {
        pass: false,
        reason: `price ₪${price} differs from expected ~₪${expected.expected_price_approx} by more than ₪1.50`,
      };
    }
  }
  return { pass: true, reason: 'all checks passed' };
}

async function main() {
  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  console.log('\n' + '═'.repeat(60));
  console.log('  ZANZURI EXTRACTION VALIDATION (5 products)');
  console.log('  READ-ONLY — no DB writes');
  console.log('═'.repeat(60) + '\n');

  const browser = await chromium.launch({ headless: true });
  const ctx     = await browser.newContext({
    locale:         'he-IL',
    userAgent:      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    serviceWorkers: 'block',
  });
  const page = await ctx.newPage();
  page.on('console', () => {});

  const results = [];
  let passed = 0;
  let failed = 0;

  for (const prod of VALIDATION_PRODUCTS) {
    console.log(`\n── ${prod.name} (${prod.slug})`);
    console.log(`   URL: ${prod.url}`);

    try {
      await sleep(800);
      const scraped = await scrapeProductPage(page, prod.url, prod.slug);

      const check = checkExpectation(scraped, prod);
      if (check.pass) { passed++; console.log('   ✓ PASS:', check.reason); }
      else             { failed++; console.log('   ✗ FAIL:', check.reason); }

      const entry = {
        name:                prod.name,
        url:                 prod.url,
        expected_status:     prod.expected_status,
        expected_price:      prod.expected_price_approx,
        ...scraped,
        validation_pass:     check.pass,
        validation_reason:   check.reason,
      };

      results.push(entry);

      console.log(`   status         : ${scraped.status}`);
      console.log(`   unit_price     : ${scraped.unit_price ?? 'null'}`);
      console.log(`   kg_price       : ${scraped.kg_price ?? 'null'}`);
      console.log(`   main_price_text: ${scraped.main_price_text}`);
      console.log(`   price_before   : ${scraped.price_before}`);
      console.log(`   price_after    : ${scraped.price_after}`);
      console.log(`   selection_method: ${scraped.selection_method}`);
      console.log(`   selected_label : ${scraped.selected_unit_label}`);
      console.log(`   notes          : ${scraped.notes.substring(0, 200)}`);

    } catch (err) {
      failed++;
      console.error(`   ✗ ERROR: ${err.message}`);
      results.push({
        name: prod.name,
        url: prod.url,
        status: 'error',
        notes: err.message,
        validation_pass: false,
        validation_reason: `exception: ${err.message}`,
      });
    }
  }

  await browser.close();

  fs.writeFileSync(OUT_FILE, JSON.stringify(results, null, 2), 'utf-8');

  console.log('\n' + '═'.repeat(60));
  console.log(`  Validation complete: ${passed} passed, ${failed} failed`);
  console.log(`  Results → output/validation-results.json`);
  console.log(`  Screenshots → output/debug/`);
  console.log('═'.repeat(60) + '\n');

  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error('\nFatal error:', err);
  process.exit(1);
});
