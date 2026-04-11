#!/usr/bin/env npx tsx
/**
 * Meshek 22 — Product Image Generation Pipeline
 *
 * Pipeline per product:
 *   1. Generate image via OpenAI Images API (gpt-image-1 default)
 *   2. Save raw generated image  →  output/raw/{slug}.png
 *   3. Remove background (ML)   →  transparent PNG in memory
 *   4. Composite on white       →  output/processed/{slug}.png
 *   5. Save metadata JSON       →  output/processed/{slug}.json
 *   6. (optional) Upload processed image to Supabase Storage
 *   7. (optional) Update products.image_url in DB
 *
 * Usage:
 *   npm run generate:image -- --slug=agvaniya
 *   npm run generate:image -- --slug=agvaniya --model=gpt-image-1
 *   npm run generate:image -- --limit=5 --upload --update-db
 *   npm run generate:image -- --all --upload --update-db
 *   npm run generate:image -- --slug=agvaniya --dry-run
 *
 * Required env vars (in .env.local):
 *   OPENAI_API_KEY
 *   NEXT_PUBLIC_SUPABASE_URL   (only needed with --upload / --update-db)
 *   SUPABASE_SERVICE_ROLE_KEY  (only needed with --upload / --update-db)
 *
 * Optional env vars:
 *   SUPABASE_BUCKET   (default: "products")
 *   IMAGE_MODEL       (default: "gpt-image-1")
 */

// Must be first — loads .env.local / .env before any process.env reads
import "./lib/env.js";

import fs   from "fs";
import path from "path";
import sharp from "sharp";

import { createClient } from "@supabase/supabase-js";

import { buildImagePrompt } from "./lib/buildImagePrompt.js";
import { removeBg          } from "./lib/removeBackground.js";
import type { ProductEntry } from "./lib/buildImagePrompt.js";

// ─── Env ──────────────────────────────────────────────────────────────────────

const OPENAI_API_KEY  = process.env.OPENAI_API_KEY ?? process.env.IMAGE_API_KEY ?? "";
const SUPABASE_URL    = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_KEY    = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const SUPABASE_BUCKET = process.env.SUPABASE_BUCKET ?? "product-images";
const ENV_MODEL       = process.env.IMAGE_MODEL ?? "gpt-image-1";

// ─── CLI args ─────────────────────────────────────────────────────────────────

const argv = process.argv.slice(2);

function getArg(name: string): string | undefined {
  const match = argv.find((a) => a.startsWith(`--${name}=`));
  return match ? match.slice(`--${name}=`.length) : undefined;
}

function getBoolArg(name: string, defaultVal = false): boolean {
  const val = getArg(name);
  if (val !== undefined) return val !== "false" && val !== "0";
  return argv.includes(`--${name}`) || defaultVal;
}

const slugArg    = getArg("slug");
const limitArg   = getArg("limit");
const allFlag    = getBoolArg("all");
const dryRun     = getBoolArg("dry-run");
const doUpload   = getBoolArg("upload",    false);
const doUpdateDb = getBoolArg("update-db", false);
const modelArg   = getArg("model") ?? ENV_MODEL;

// ─── Output directories ────────────────────────────────────────────────────────

const RAW_DIR       = path.resolve("output/raw");
const PROCESSED_DIR = path.resolve("output/processed");
const LOGS_DIR      = path.resolve("output/logs");
const FAILED_FILE   = path.resolve("output/failed-products.json");

function ensureDirs(): void {
  for (const dir of [RAW_DIR, PROCESSED_DIR, LOGS_DIR, path.dirname(FAILED_FILE)]) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

// ─── Types ────────────────────────────────────────────────────────────────────

type ProcessingStatus = "success" | "failed" | "dry-run";

interface ImageMetadata {
  slug:             string;
  name:             string;
  model:            string;
  prompt:           string;
  rawImagePath:     string | null;
  processedImagePath: string | null;
  uploadedUrl:      string | null;
  dbUpdated:        boolean;
  status:           ProcessingStatus;
  generatedAt:      string;
}

interface FailedProduct {
  slug:      string;
  name:      string;
  error:     string;
  failedAt:  string;
}

// ─── Logging ──────────────────────────────────────────────────────────────────

const runTimestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const logFile      = path.join(LOGS_DIR, `run-${runTimestamp}.log`);
const logLines: string[] = [];

function log(msg: string): void {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.log(line);
  logLines.push(line);
}

function logError(msg: string): void {
  const line = `[${new Date().toISOString()}] ERROR: ${msg}`;
  console.error(line);
  logLines.push(line);
}

function flushLog(): void {
  try { fs.writeFileSync(logFile, logLines.join("\n") + "\n", "utf-8"); } catch { /* non-fatal */ }
}

// ─── Products loader ──────────────────────────────────────────────────────────

function loadProducts(): ProductEntry[] {
  const file = path.resolve("data/products.full.json");
  if (!fs.existsSync(file)) {
    console.error(`❌  data/products.full.json not found at ${file}`);
    process.exit(1);
  }
  const all = JSON.parse(fs.readFileSync(file, "utf-8")) as ProductEntry[];
  return all.filter((p) => p.is_active !== false);
}

// ─── OpenAI image generation ──────────────────────────────────────────────────

interface OpenAIImageItem {
  b64_json?: string;
  url?:      string;
}
interface OpenAIImageResponse {
  data: OpenAIImageItem[];
}

/**
 * Calls the OpenAI Images API and returns the image as a Buffer.
 * Handles both gpt-image-1 (b64_json only) and dall-e-3 (url or b64_json).
 */
async function generateImageBuffer(prompt: string, retryCount = 0): Promise<Buffer> {
  const MAX_RETRIES = 3;
  const isGptImage  = modelArg.startsWith("gpt-image");

  // Build request body — gpt-image-1 and dall-e-3 use slightly different params
  const body: Record<string, unknown> = {
    model:  modelArg,
    prompt,
    n:      1,
    size:   "1024x1024",
  };

  if (isGptImage) {
    body.quality = "high"; // gpt-image-1: "auto"|"high"|"medium"|"low"
  } else {
    body.quality         = "standard"; // dall-e-3
    body.response_format = "b64_json"; // request base64 to avoid URL expiry
  }

  const res = await fetch("https://api.openai.com/v1/images/generations", {
    method:  "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization:  `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => res.statusText);
    if (res.status === 429 && retryCount < MAX_RETRIES) {
      const delay = Math.pow(2, retryCount + 1) * 1500;
      log(`  Rate limited — waiting ${delay / 1000}s (retry ${retryCount + 1}/${MAX_RETRIES})...`);
      await sleep(delay);
      return generateImageBuffer(prompt, retryCount + 1);
    }
    throw new Error(`OpenAI API error ${res.status}: ${errText}`);
  }

  const json = (await res.json()) as OpenAIImageResponse;
  const item = json.data?.[0];

  if (!item) throw new Error("OpenAI response contained no image data");

  if (item.b64_json) {
    return Buffer.from(item.b64_json, "base64");
  }
  if (item.url) {
    const dlRes = await fetch(item.url);
    if (!dlRes.ok) throw new Error(`Failed to download image from URL: ${dlRes.status}`);
    return Buffer.from(await dlRes.arrayBuffer());
  }

  throw new Error("OpenAI response missing both b64_json and url");
}

// ─── Post-processing: remove background + composite on white ──────────────────

async function processToWhiteBackground(rawBuffer: Buffer): Promise<Buffer> {
  // Step 1: ML background removal → transparent PNG
  const transparentPng = await removeBg(rawBuffer);

  // Step 2: Composite transparent PNG onto a pure white background using sharp
  // sharp.flatten() replaces any transparent areas with the given background color.
  return sharp(transparentPng)
    .flatten({ background: { r: 255, g: 255, b: 255 } })
    .png({ compressionLevel: 9 })
    .toBuffer();
}

// ─── Supabase helpers ─────────────────────────────────────────────────────────
//
// Uses @supabase/supabase-js so both the legacy JWT format (eyJ...) and the
// new opaque key format (sb_secret_...) are handled correctly by the library.
// Raw fetch with Bearer <key> only works for JWT keys; the client abstracts this.

function createAdminClient() {
  return createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: {
      autoRefreshToken:  false,
      persistSession:    false,
      detectSessionInUrl: false,
    },
  });
}

async function uploadToSupabase(slug: string, imageBuffer: Buffer): Promise<string> {
  const supabase    = createAdminClient();
  const storagePath = `${slug}.png`;

  const { error } = await supabase.storage
    .from(SUPABASE_BUCKET)
    .upload(storagePath, imageBuffer, {
      contentType: "image/png",
      upsert:      true,
    });

  if (error) {
    throw new Error(`Supabase upload failed: ${error.message}`);
  }

  // Return the public URL (bucket must have public access enabled in Supabase dashboard)
  const { data } = supabase.storage
    .from(SUPABASE_BUCKET)
    .getPublicUrl(storagePath);

  return data.publicUrl;
}

async function updateDbImageUrl(id: string, imageUrl: string): Promise<void> {
  const supabase = createAdminClient();

  const { error } = await supabase
    .from("products")
    .update({ image_url: imageUrl })
    .eq("id", id);

  if (error) {
    throw new Error(`DB update failed: ${error.message}`);
  }
}

// ─── Per-product pipeline ─────────────────────────────────────────────────────

async function processProduct(
  product: ProductEntry,
  index:   number,
  total:   number,
): Promise<ImageMetadata> {
  const prefix = `[${index + 1}/${total}] ${product.slug}`;

  const prompt = buildImagePrompt(product);
  log(`${prefix}: prompt built`);

  if (dryRun) {
    log(`${prefix}: [DRY RUN]`);
    log(`  id:   ${product.id}`);
    log(`  name: ${product.name}`);
    log(`  slug: ${product.slug}`);
    log(`  prompt → ${prompt}`);
    return {
      slug: product.slug, name: product.name,
      model: modelArg, prompt, rawImagePath: null, processedImagePath: null,
      uploadedUrl: null, dbUpdated: false, status: "dry-run",
      generatedAt: new Date().toISOString(),
    };
  }

  // ── Step 1: Generate ───────────────────────────────────────────────────────
  log(`${prefix}: calling ${modelArg}...`);
  const rawBuffer = await generateImageBuffer(prompt);
  log(`${prefix}: image received (${Math.round(rawBuffer.length / 1024)} KB)`);

  // ── Step 2: Save raw ───────────────────────────────────────────────────────
  const rawFile = path.join(RAW_DIR, `${product.slug}.png`);
  fs.writeFileSync(rawFile, rawBuffer);
  log(`${prefix}: raw saved → ${path.relative(process.cwd(), rawFile)}`);

  // ── Step 3 & 4: Background removal + white composite ──────────────────────
  log(`${prefix}: removing background...`);
  const processedBuffer = await processToWhiteBackground(rawBuffer);
  log(`${prefix}: background removed (${Math.round(processedBuffer.length / 1024)} KB)`);

  // ── Step 5: Save processed ─────────────────────────────────────────────────
  const processedFile = path.join(PROCESSED_DIR, `${product.slug}.png`);
  fs.writeFileSync(processedFile, processedBuffer);
  log(`${prefix}: processed saved → ${path.relative(process.cwd(), processedFile)}`);

  // ── Step 6: Upload (processed image only) ─────────────────────────────────
  let uploadedUrl: string | null = null;
  if (doUpload) {
    log(`${prefix}: uploading to Supabase...`);
    uploadedUrl = await uploadToSupabase(product.slug, processedBuffer);
    log(`${prefix}: uploaded → ${uploadedUrl}`);
  }

  // ── Step 7: Update DB ──────────────────────────────────────────────────────
  let dbUpdated = false;
  if (doUpdateDb && uploadedUrl) {
    if (uploadedUrl === product.image_url) {
      log(`${prefix}: URL unchanged — skipping DB update`);
    } else {
      log(`${prefix}: updating DB (id=${product.id})...`);
      await updateDbImageUrl(product.id, uploadedUrl);
      dbUpdated = true;
      log(`${prefix}: DB updated`);
    }
  } else if (doUpdateDb && !uploadedUrl) {
    log(`${prefix}: skipping DB update — no uploaded URL (use --upload with --update-db)`);
  }

  // ── Step 8: Save metadata ──────────────────────────────────────────────────
  const meta: ImageMetadata = {
    slug:               product.slug,
    name:               product.name,
    model:              modelArg,
    prompt,
    rawImagePath:       path.relative(process.cwd(), rawFile),
    processedImagePath: path.relative(process.cwd(), processedFile),
    uploadedUrl,
    dbUpdated,
    status:             "success",
    generatedAt:        new Date().toISOString(),
  };

  const metaFile = path.join(PROCESSED_DIR, `${product.slug}.json`);
  fs.writeFileSync(metaFile, JSON.stringify(meta, null, 2));
  log(`${prefix}: metadata saved → ${path.relative(process.cwd(), metaFile)}`);

  return meta;
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function loadFailedProducts(): FailedProduct[] {
  if (!fs.existsSync(FAILED_FILE)) return [];
  try { return JSON.parse(fs.readFileSync(FAILED_FILE, "utf-8")) as FailedProduct[]; }
  catch { return []; }
}

function saveFailedProducts(failed: FailedProduct[]): void {
  fs.mkdirSync(path.dirname(FAILED_FILE), { recursive: true });
  fs.writeFileSync(FAILED_FILE, JSON.stringify(failed, null, 2));
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const hasTarget = slugArg || limitArg || allFlag;
  if (!hasTarget) {
    console.error([
      "",
      "Usage:",
      "  --slug=<slug>        Generate one product (preview)",
      "  --limit=<n>          Generate first N products",
      "  --all                Generate ALL products (requires explicit flag)",
      "",
      "Options:",
      "  --dry-run            Show prompts, skip API call",
      "  --upload             Upload processed image to Supabase Storage",
      "  --update-db          Update products.image_url in DB (requires --upload)",
      `  --model=<model>      Image model (default: ${ENV_MODEL})`,
      "",
      "Examples:",
      "  npm run generate:image -- --slug=agvaniya",
      "  npm run generate:image -- --slug=agvaniya --model=gpt-image-1",
      "  npm run generate:image -- --slug=agvaniya --upload --update-db",
      "  npm run generate:image -- --limit=5 --upload --update-db",
      "  npm run generate:image -- --all --upload --update-db",
      "  npm run generate:image -- --slug=agvaniya --dry-run",
      "",
    ].join("\n"));
    process.exit(1);
  }

  if (!dryRun && !OPENAI_API_KEY) {
    console.error(
      "❌  OpenAI API key not found.\n" +
      "    Set OPENAI_API_KEY in .env.local:\n" +
      "      OPENAI_API_KEY=sk-...\n"
    );
    process.exit(1);
  }

  if (doUpload || doUpdateDb) {
    if (!SUPABASE_URL) {
      console.error("❌  NEXT_PUBLIC_SUPABASE_URL is missing. Set it in .env.local.");
      process.exit(1);
    }
    if (!SUPABASE_KEY) {
      console.error("❌  SUPABASE_SERVICE_ROLE_KEY is missing. Set it in .env.local.");
      process.exit(1);
    }
    // Presence check only — key format (sb_secret_... or legacy JWT) is handled by supabase-js
    log(`Supabase: URL present ✓  |  Service role key present ✓  |  Bucket: ${SUPABASE_BUCKET}`);
  }

  ensureDirs();

  const allProducts = loadProducts();

  // ── Select target products ─────────────────────────────────────────────────
  let products: ProductEntry[];

  if (slugArg) {
    const found = allProducts.find((p) => p.slug === slugArg);
    if (!found) {
      console.error(
        `❌  Slug "${slugArg}" not found in data/products.full.json.\n` +
        `    Available: ${allProducts.map((p) => p.slug).join(", ")}`
      );
      process.exit(1);
    }
    products = [found];
  } else if (allFlag) {
    products = allProducts;
  } else {
    const limit = parseInt(limitArg ?? "0", 10);
    if (isNaN(limit) || limit < 1) {
      console.error("❌  --limit must be a positive integer.");
      process.exit(1);
    }
    products = allProducts.slice(0, limit);
  }

  // ── Run ────────────────────────────────────────────────────────────────────
  log(`Pipeline start: ${products.length} product(s) | model=${modelArg} | dry-run=${dryRun} | upload=${doUpload} | update-db=${doUpdateDb}`);
  log(`Output: raw → output/raw/  |  processed → output/processed/`);

  const succeeded: ImageMetadata[] = [];
  const allFailed  = loadFailedProducts();
  const processing = new Set(products.map((p) => p.slug));
  const retained   = allFailed.filter((f) => !processing.has(f.slug));

  for (let i = 0; i < products.length; i++) {
    const product = products[i];
    try {
      const meta = await processProduct(product, i, products.length);
      succeeded.push(meta);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logError(`${product.slug}: ${message}`);
      retained.push({ slug: product.slug, name: product.name, error: message, failedAt: new Date().toISOString() });
    }

    // Brief pause between products to avoid rate limits
    if (!dryRun && i < products.length - 1) await sleep(600);
  }

  saveFailedProducts(retained);

  const newFailed = retained.filter((f) => processing.has(f.slug));

  log("─────────────────────────────────────────────────────");
  log(`Done. ${succeeded.length} succeeded, ${newFailed.length} failed.`);
  if (newFailed.length > 0) {
    log(`Failed: ${newFailed.map((f) => f.slug).join(", ")}`);
    log(`Details: output/failed-products.json`);
  }
  if (!dryRun && succeeded.length > 0) {
    log(`Processed images ready at: output/processed/`);
    if (!doUpload) {
      log("Next: re-run with --upload --update-db to push to Supabase.");
    }
  }

  flushLog();
  log(`Log: ${path.relative(process.cwd(), logFile)}`);

  process.exit(newFailed.length > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
