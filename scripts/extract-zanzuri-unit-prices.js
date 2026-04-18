#!/usr/bin/env node
// scripts/extract-zanzuri-unit-prices.js
//
// READ-ONLY automation script.
// Loads local products → searches zanzuri.co.il → extracts unit prices via Playwright.
// Outputs results to output/zanzuri-unit-prices.json and .csv.
//
// SAFETY: This script NEVER writes to any database, Supabase table, or source file.
//         It only writes the two output files listed above.

'use strict';

const fs = require('fs');
const path = require('path');
const { loadProducts } = require('./lib/loadProducts');
const { scrapeAll } = require('./lib/scrapeZanzuri');

// Products to always show full candidate analysis for, regardless of status
const FOCUS_PRODUCTS = new Set(['אגס', 'ערמונים', 'שסק']);

// ── Output paths ─────────────────────────────────────────────────────────────
const OUTPUT_DIR  = path.resolve(__dirname, '../output');
const JSON_OUT    = path.join(OUTPUT_DIR, 'zanzuri-unit-prices.json');
const CSV_OUT     = path.join(OUTPUT_DIR, 'zanzuri-unit-prices.csv');
const DEBUG_REPORT_OUT = path.join(OUTPUT_DIR, 'matching-debug-report.json');

// ── CSV helpers ───────────────────────────────────────────────────────────────

const CSV_HEADERS = [
  'id',
  'slug',
  'name',
  'matched_name',
  'matched_url',
  'unit_price',
  'currency',
  'unit_type',
  'kg_price',
  'confidence',
  'status',
  'notes',
  // Matching debug fields
  'winning_query',
  'base_name',
  'extra_words',
  'normalized_name',
  'generated_queries',
  'top_candidates_debug',
  'matched_via_soft_base_match',
  'extra_candidate_words',
  'manual_review_note',
  // Scrape diagnostic fields
  'candidate_count',
  'main_price_text',
  'selection_method',
  'selected_unit_label',
  'price_before',
  'price_after',
  'variation_html_snippet',
];

function escapeCSV(val) {
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

function toCSV(results) {
  const rows = [CSV_HEADERS.join(',')];
  for (const r of results) {
    rows.push(CSV_HEADERS.map((h) => escapeCSV(r[h])).join(','));
  }
  return rows.join('\n');
}

// ── Debug report ─────────────────────────────────────────────────────────────

/**
 * Log detailed matching info to console for not_found / needs_review products,
 * and for any product in FOCUS_PRODUCTS.
 */
function logMatchingDiagnostics(result) {
  const isFocus     = FOCUS_PRODUCTS.has(result.name);
  const isProblem   = result.status === 'not_found' || result.status === 'needs_review';
  if (!isFocus && !isProblem) return;

  const label = isFocus ? '[FOCUS]' : '[REVIEW]';
  console.log(`\n  ${label} ── ${result.name} (status=${result.status})`);
  console.log(`    normalized   : ${result.normalized_name ?? '–'}`);
  console.log(`    base_name    : ${result.base_name ?? '–'}`);
  console.log(`    queries      : ${result.generated_queries ?? '–'}`);
  console.log(`    candidates   : ${result.candidate_count}`);
  console.log(`    top cands    : ${result.top_candidates_debug ?? 'none'}`);
  if (result.status === 'not_found') {
    console.log(`    rejection    : best score below threshold — see top_candidates_debug above`);
  }
}

/**
 * Build and write the matching debug report for all problematic or focus products.
 */
function writeDebugReport(allResults) {
  const report = {
    generated_at: new Date().toISOString(),
    focus_products: [...FOCUS_PRODUCTS],
    problematic: [],
    focus_detail: [],
    summary: {
      total: allResults.length,
      not_found: 0,
      needs_review: 0,
      matched_unit_price: 0,
      kg_only: 0,
    },
  };

  for (const r of allResults) {
    if (report.summary[r.status] !== undefined) report.summary[r.status]++;

    const isProblem = r.status === 'not_found' || r.status === 'needs_review';
    const isFocus   = FOCUS_PRODUCTS.has(r.name);

    const entry = {
      name:                 r.name,
      slug:                 r.slug,
      status:               r.status,
      confidence:           r.confidence,
      matched_name:         r.matched_name,
      matched_url:          r.matched_url,
      normalized_name:      r.normalized_name,
      base_name:            r.base_name,
      generated_queries:    r.generated_queries,
      candidate_count:      r.candidate_count,
      top_candidates_debug: r.top_candidates_debug,
      winning_query:        r.winning_query,
      match_notes:          r.notes,
    };

    if (isProblem) report.problematic.push(entry);
    if (isFocus)   report.focus_detail.push(entry);
  }

  fs.writeFileSync(DEBUG_REPORT_OUT, JSON.stringify(report, null, 2), 'utf-8');
  console.log(`\n  Debug report → output/matching-debug-report.json`);
  console.log(`  Problematic : ${report.problematic.length} products (not_found + needs_review)`);
}

// ── Summary ───────────────────────────────────────────────────────────────────

function printSummary(results) {
  const total = results.length;
  const byStatus = {
    matched_unit_price: 0,
    kg_only: 0,
    needs_review: 0,
    not_found: 0,
  };
  for (const r of results) {
    if (byStatus[r.status] !== undefined) byStatus[r.status]++;
    else byStatus[r.status] = 1;
  }

  console.log('\n' + '═'.repeat(52));
  console.log('  ZANZURI PRICE EXTRACTION — SUMMARY');
  console.log('═'.repeat(52));
  console.log(`  Total products processed : ${total}`);
  console.log(`  ✓ Matched with unit price: ${byStatus.matched_unit_price}`);
  console.log(`  ~ Kg only                : ${byStatus.kg_only}`);
  console.log(`  ? Needs review           : ${byStatus.needs_review}`);
  console.log(`  ✗ Not found              : ${byStatus.not_found}`);
  console.log('═'.repeat(52));
  console.log(`\n  Output JSON : ${JSON_OUT}`);
  console.log(`  Output CSV  : ${CSV_OUT}`);
  console.log('');
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('');
  console.log('═'.repeat(52));
  console.log('  ZANZURI UNIT PRICE EXTRACTOR');
  console.log('  Mode: READ-ONLY | No DB writes');
  console.log('═'.repeat(52));

  // Ensure output dir exists
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  // Load local product catalog
  const products = loadProducts();
  console.log(`\nLoaded ${products.length} products from products.full.json`);

  const allResults = [];

  // Start scraping — results arrive one by one via onResult callback
  await scrapeAll(products, (result) => {
    allResults.push(result);

    const icon =
      result.status === 'matched_unit_price' ? '✓' :
      result.status === 'kg_only'            ? '~' :
      result.status === 'not_found'          ? '✗' : '?';

    const priceStr =
      result.unit_price !== null ? `₪${result.unit_price} (unit)` :
      result.kg_price   !== null ? `₪${result.kg_price} (kg)`    : 'no price';

    console.log(`  ${icon} ${result.name} → ${priceStr} [${result.status}] conf=${result.confidence}`);

    // Detailed diagnostics for problematic / focus products
    logMatchingDiagnostics(result);

    // Write incrementally so partial results survive a crash
    fs.writeFileSync(JSON_OUT, JSON.stringify(allResults, null, 2), 'utf-8');
  });

  // Final CSV write and debug report
  fs.writeFileSync(CSV_OUT, toCSV(allResults), 'utf-8');
  writeDebugReport(allResults);

  printSummary(allResults);
}

main().catch((err) => {
  console.error('\nFatal error:', err);
  process.exit(1);
});
