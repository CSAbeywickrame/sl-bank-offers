import { existsSync, mkdirSync, readdirSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import crypto from "node:crypto";
import sharp from "sharp";
import type { ImageMediaType } from "@/lib/ingest/fetchAndStrip";

/**
 * Image pipeline for the ingest scrapers: repairs/downscales images before they reach Claude
 * vision, and generates the small on-disk thumbnails offers display alongside a listing.
 *
 * The repair step exists because some banks' WordPress JPEGs carry stray bytes between JPEG
 * segments (libvips reports "Corrupt JPEG data: N extraneous bytes before marker 0xdb") — libjpeg
 * and macOS `sips` tolerate this, but Anthropic's own decoder rejects the file outright with a 400
 * "Could not process image". Decoding with `failOn: "none"` and re-encoding fixes every case
 * measured against peoples-bank's failing assets (34/34 repaired, ~7-13ms each).
 */

// Longest edge Claude vision uses internally — sending anything bigger only costs more upload bytes
// for no extra fidelity, so every image is downscaled to fit inside this before it's sent.
const MAX_VISION_EDGE = 1568;
// Thumbnail width shown in the UI — comfortably legible for a card-sized offer image.
const THUMBNAIL_WIDTH = 640;
// Aspect ratio (width/height) below which an image counts as portrait: offer creatives are
// landscape or square banners, so a tall narrow image is almost always a poster or a person shot.
const PORTRAIT_ASPECT_RATIO = 0.8;
// Sub-folder of the public dir thumbnails are written to / served from.
const OFFER_IMAGES_DIR = "offer-images";

// Returns the sha1 hex digest of a Buffer. Deliberately reimplemented rather than imported from
// fetchAndStrip.ts (which imports prepareForVision below) — pulling hashContent from there back
// into this module would create a circular dependency for two lines of crypto.
function contentHash(bytes: Buffer): string {
  return crypto.createHash("sha1").update(bytes).digest("hex");
}

export interface PrepareForVisionResult {
  ok: boolean;
  bytes?: Buffer;
  mediaType?: ImageMediaType;
  error?: string;
}

// Repairs and downscales one image for Claude vision: tolerant decode (survives stray bytes some
// WordPress JPEGs carry between segments), EXIF-rotate, resize so the longest edge is at most
// MAX_VISION_EDGE, re-encoded as JPEG q85. Returns a failure result rather than throwing, so a
// single undecodable asset can be recorded and skipped without aborting the caller's run.
export async function prepareForVision(bytes: Buffer, mediaType: ImageMediaType): Promise<PrepareForVisionResult> {
  try {
    const prepared = await sharp(bytes, { failOn: "none" })
      .rotate()
      .resize({ width: MAX_VISION_EDGE, height: MAX_VISION_EDGE, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 85 })
      .toBuffer();
    return { ok: true, bytes: prepared, mediaType: "image/jpeg" };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : `failed to decode ${mediaType} image` };
  }
}

// True when a fetched image is portrait-shaped (a poster/person shot rather than an offer banner).
// Reads only the header via sharp.metadata() — cheap, no full pixel decode. Never throws: an
// unreadable file isn't this function's problem to flag, prepareForVision already reports that.
export async function isPortraitImage(bytes: Buffer): Promise<boolean> {
  try {
    const { width, height } = await sharp(bytes, { failOn: "none" }).metadata();
    if (!width || !height) return false;
    return width / height < PORTRAIT_ASPECT_RATIO;
  } catch {
    return false;
  }
}

export interface SaveThumbnailResult {
  ok: boolean;
  url?: string;
  hash?: string;
  error?: string;
}

// Writes a 640px-wide webp thumbnail under <publicDir>/offer-images/, named by the content hash of
// the SOURCE bytes (before any repair/resize) so the same creative is stable across runs — an
// existing file is left untouched rather than rewritten. Returns the public URL path to store on
// an offer's imageUrl.
export async function saveThumbnail(bytes: Buffer, publicDir: string): Promise<SaveThumbnailResult> {
  const hash = contentHash(bytes).slice(0, 12);
  const dir = join(publicDir, OFFER_IMAGES_DIR);
  const filePath = join(dir, `${hash}.webp`);
  const url = `/${OFFER_IMAGES_DIR}/${hash}.webp`;
  if (existsSync(filePath)) {
    return { ok: true, url, hash };
  }
  try {
    const thumbnail = await sharp(bytes, { failOn: "none" })
      .rotate()
      .resize({ width: THUMBNAIL_WIDTH, withoutEnlargement: true })
      .webp({ quality: 65 })
      .toBuffer();
    mkdirSync(dir, { recursive: true });
    writeFileSync(filePath, thumbnail);
    return { ok: true, url, hash };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "failed to create thumbnail" };
  }
}

// Deletes files under <publicDir>/offer-images/ that no offer's imageUrl references any more — run
// once per refresh, after the catalog is finalized. Returns the number of files deleted. Safe when
// the directory doesn't exist yet (nothing has ever been written there).
export function sweepOrphans(publicDir: string, referencedUrls: Iterable<string>): number {
  const dir = join(publicDir, OFFER_IMAGES_DIR);
  if (!existsSync(dir)) return 0;
  const prefix = `/${OFFER_IMAGES_DIR}/`;
  const referencedFiles = new Set(
    [...referencedUrls].filter((url) => url.startsWith(prefix)).map((url) => url.slice(prefix.length))
  );
  let deleted = 0;
  for (const file of readdirSync(dir)) {
    if (referencedFiles.has(file)) continue;
    unlinkSync(join(dir, file));
    deleted += 1;
  }
  return deleted;
}
