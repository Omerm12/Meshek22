/**
 * Background removal via edge-seeded flood-fill + sharp compositing.
 *
 * Algorithm:
 *   1. Sample the 4 image corners to measure the background color.
 *   2. BFS flood-fill inward from all 4 edges, marking pixels whose color is
 *      within TOLERANCE of the background color as transparent.
 *      Stops at produce boundaries where color diverges sharply.
 *   3. Apply a second pass: any remaining near-white pixel (all channels > 248)
 *      that was NOT reached by the flood fill is also set transparent.
 *      This cleans up soft shadows and stray background wisps.
 *   4. Composite the transparent PNG onto a pure white (#FFFFFF) canvas using
 *      sharp.flatten() — the final image has no alpha channel and a true white bg.
 *
 * Why not @imgly/background-removal-node (ONNX)?
 *   The ONNX runtime native addon segfaults on Windows + Git Bash environments.
 *   This pure-JS approach with sharp runs on any platform without native issues.
 *
 * For maximum quality on complex subjects (herbs, fine edges), consider:
 *   pip install rembg && rembg i input.png output.png
 *   (see scripts/README.md for the rembg workflow)
 */

import sharp from "sharp";

// Color distance threshold: pixels within this distance of the background color
// are considered background.  38 works well for gpt-image-1 output — aggressive
// enough to remove the light warm-gray gradient, conservative enough to preserve
// produce edges.  Raise to ~55 if shadows creep in; lower to ~25 if produce is
// getting clipped (garlic, cauliflower, onion).
const TOLERANCE = 38;

// Second-pass: any pixel with ALL channels above this value is also cleared.
// Catches residual gray in soft shadows without touching produce.
const NEAR_WHITE = 248;

type PixelData = { data: Buffer; info: sharp.OutputInfo };

function colorDist(pixels: Uint8Array, idx: number, channels: number, bgR: number, bgG: number, bgB: number): number {
  const r = pixels[idx * channels];
  const g = pixels[idx * channels + 1];
  const b = pixels[idx * channels + 2];
  return Math.sqrt((r - bgR) ** 2 + (g - bgG) ** 2 + (b - bgB) ** 2);
}

function sampleCorner(pixels: Uint8Array, idx: number, channels: number): [number, number, number] {
  return [pixels[idx * channels], pixels[idx * channels + 1], pixels[idx * channels + 2]];
}

export async function removeBg(inputBuffer: Buffer): Promise<Buffer> {
  // ── Load image with alpha channel ─────────────────────────────────────────
  const { data, info }: PixelData = await sharp(inputBuffer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const pixels   = new Uint8Array(data.buffer);
  const { width, height } = info;
  const C = 4; // RGBA channels after ensureAlpha

  // ── Sample background color from all 4 corners ────────────────────────────
  const corners = [
    sampleCorner(pixels, 0,                              C),
    sampleCorner(pixels, width - 1,                      C),
    sampleCorner(pixels, (height - 1) * width,           C),
    sampleCorner(pixels, (height - 1) * width + width - 1, C),
  ];
  const bgR = Math.round(corners.reduce((s, p) => s + p[0], 0) / 4);
  const bgG = Math.round(corners.reduce((s, p) => s + p[1], 0) / 4);
  const bgB = Math.round(corners.reduce((s, p) => s + p[2], 0) / 4);

  // ── Edge-seeded BFS flood-fill ────────────────────────────────────────────
  // visited[i] = 1 means the pixel has been examined (or queued)
  const visited = new Uint8Array(width * height);
  const queue   = new Int32Array(width * height); // pre-allocated ring buffer
  let   head    = 0;
  let   tail    = 0;

  function enqueue(idx: number): void {
    if (!visited[idx]) { visited[idx] = 1; queue[tail++ % queue.length] = idx; }
  }
  function dequeue(): number {
    return queue[head++ % queue.length];
  }

  // Seed from all 4 edges
  for (let x = 0; x < width; x++) {
    enqueue(x);                         // top row
    enqueue((height - 1) * width + x);  // bottom row
  }
  for (let y = 1; y < height - 1; y++) {
    enqueue(y * width);                 // left column
    enqueue(y * width + width - 1);     // right column
  }

  // BFS: mark background pixels transparent
  while (head < tail) {
    const idx = dequeue();

    if (colorDist(pixels, idx, C, bgR, bgG, bgB) >= TOLERANCE) continue;

    // This pixel is background — make it transparent
    pixels[idx * C + 3] = 0;

    const x = idx % width;
    const y = Math.floor(idx / width);

    if (x > 0)          enqueue(idx - 1);
    if (x < width - 1)  enqueue(idx + 1);
    if (y > 0)          enqueue(idx - width);
    if (y < height - 1) enqueue(idx + width);
  }

  // ── Second pass: clear residual near-white pixels ─────────────────────────
  // Handles soft shadows and feathered edges the flood-fill didn't reach.
  for (let i = 0; i < width * height; i++) {
    if (pixels[i * C + 3] === 0) continue; // already transparent
    const r = pixels[i * C], g = pixels[i * C + 1], b = pixels[i * C + 2];
    if (r > NEAR_WHITE && g > NEAR_WHITE && b > NEAR_WHITE) {
      pixels[i * C + 3] = 0;
    }
  }

  // ── Composite onto pure white ─────────────────────────────────────────────
  return sharp(Buffer.from(pixels.buffer), {
    raw: { width, height, channels: C },
  })
    .flatten({ background: { r: 255, g: 255, b: 255 } })
    .png({ compressionLevel: 9 })
    .toBuffer();
}
