# Meshek 22 — Product Image Generation Pipeline

Generates production-ready grocery catalog images using OpenAI's image API,
then post-processes them to a true pure-white background via ML background removal.

## Pipeline

```
generate image (gpt-image-1)
  → save raw image          output/raw/{slug}.png
  → remove background (ML)  (transparent PNG in memory)
  → composite on white      output/processed/{slug}.png
  → save metadata JSON      output/processed/{slug}.json
  → (optional) upload       Supabase Storage
  → (optional) update DB    products.image_url
```

The raw image is kept for inspection and re-processing without regenerating.

---

## Setup

### 1. Install Node dependencies (already done if you ran `npm install`)

```bash
npm install
```

This installs `sharp` and `@imgly/background-removal-node` (used for background removal).

### 2. Add your OpenAI API key to `.env.local`

```
OPENAI_API_KEY=sk-...
```

### 3. Background removal models (first run only)

On the **first run**, `@imgly/background-removal-node` automatically downloads the ONNX
segmentation model (~80 MB) to your OS user cache. This is a one-time download — all
subsequent runs work fully offline and take ~3–8 seconds per image.

No manual setup required.

### Optional: rembg (Python alternative)

If you prefer higher-quality background removal, you can use `rembg` instead:

```bash
pip install rembg[gpu]   # or: pip install rembg  (CPU only)
rembg i output/raw/agvaniya.png output/processed/agvaniya.png
```

The current pipeline uses `@imgly/background-removal-node` because it requires no
Python setup and integrates directly into the Node.js pipeline.

---

## Usage

### Preview one product (default — safe mode)

```bash
npm run generate:image -- --slug=agvaniya
```

Saves:
- `output/raw/agvaniya.png` — raw generated image
- `output/processed/agvaniya.png` — final white-background image ← use this
- `output/processed/agvaniya.json` — metadata

### Dry run — see prompts without calling the API

```bash
npm run generate:image -- --slug=agvaniya --dry-run
npm run generate:image -- --all --dry-run
```

### Generate with explicit model

```bash
npm run generate:image -- --slug=agvaniya --model=gpt-image-1
npm run generate:image -- --slug=agvaniya --model=dall-e-3
```

Default model is `gpt-image-1`.

### Generate + upload + update DB

```bash
npm run generate:image -- --slug=agvaniya --upload --update-db
```

Only the **processed** image is uploaded to Supabase (never the raw).

### Batch: first N products

```bash
npm run generate:image -- --limit=5 --upload --update-db
```

### Full batch: all products

```bash
npm run generate:image -- --all --upload --update-db
```

> `--all` must be explicit. Running without a target shows the help message.

---

## Flags

| Flag | Default | Description |
|---|---|---|
| `--slug=<slug>` | — | Single product |
| `--limit=<n>` | — | First N products |
| `--all` | — | All products in data/products.json |
| `--dry-run` | false | Show prompts, skip API |
| `--upload` | false | Upload processed image to Supabase Storage |
| `--update-db` | false | Update `products.image_url` in DB (requires `--upload`) |
| `--model=<model>` | `gpt-image-1` | OpenAI image model |

---

## Output structure

```
output/
  raw/                  Raw images from OpenAI (before background removal)
    agvaniya.png
  processed/            Final images: pure white background, catalog-ready
    agvaniya.png        ← This is what you use on the website
    agvaniya.json       Metadata for this product
  logs/
    run-2026-04-11T....log
  failed-products.json  Products that failed (accumulates across runs)
```

### Metadata JSON format

```json
{
  "slug": "agvaniya",
  "name": "עגבניה",
  "category": "vegetables",
  "model": "gpt-image-1",
  "prompt": "E-commerce grocery catalog photo of...",
  "rawImagePath": "output/raw/agvaniya.png",
  "processedImagePath": "output/processed/agvaniya.png",
  "uploadedUrl": null,
  "dbUpdated": false,
  "status": "success",
  "generatedAt": "2026-04-11T13:00:00.000Z"
}
```

---

## Recommended workflow

1. **Single preview** — check quality before committing to a run:
   ```bash
   npm run generate:image -- --slug=agvaniya
   ```
   Inspect `output/processed/agvaniya.png`.

2. **Small batch** — validate a few products:
   ```bash
   npm run generate:image -- --limit=5
   ```

3. **Full run** — generate everything:
   ```bash
   npm run generate:image -- --all
   ```

4. **Upload** — when you're happy with the results:
   ```bash
   npm run generate:image -- --all --upload --update-db
   ```

5. **Re-process without regenerating** — if you just want to re-apply background removal:
   Background removal runs on every `generate:image` call that doesn't use `--dry-run`.
   If the raw image already exists and you want to skip generation, that's a future feature.

6. **Handle failures** — re-run individual failed slugs:
   ```bash
   npm run generate:image -- --slug=<slug> --upload --update-db
   ```
   Successfully re-run slugs are automatically cleared from `output/failed-products.json`.

---

## Changing the image style

**Prompt logic:** `scripts/lib/buildImagePrompt.ts`
- `SLUG_COMPOSITION` — per-product arrangement (e.g., "3 tomatoes in a cluster")
- `SUBCATEGORY_COMPOSITION` — fallback by category
- Set `"promptOverride"` in `data/products.json` for a fully custom prompt per product

**Background removal quality:** `scripts/lib/removeBackground.ts`
- Change `model: "small"` to `model: "medium"` for better edge detail (larger download)

**Adding products:** Edit `data/products.json` — add a new entry with `slug`, `name`, `nameEn`, `category`.

---

## Environment variables

```env
# Required
OPENAI_API_KEY=sk-...

# Required for --upload / --update-db (already in .env.local)
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...

# Optional overrides
SUPABASE_BUCKET=products    # default: products
IMAGE_MODEL=gpt-image-1     # default: gpt-image-1
```
