import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import sharp from "sharp";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { prepareForVision, saveThumbnail, sweepOrphans, isPortraitImage } from "@/lib/ingest/images";

// Builds a real, tiny JPEG whose bytes reproduce the peoples-bank defect: stray bytes injected
// immediately before a marker (here, SOF0 / 0xFFC0), producing libvips' exact real-world message
// ("Corrupt JPEG data: N extraneous bytes before marker 0x..."). A normal (strict) decode rejects
// this outright; libjpeg's own marker-hunting (and macOS `sips`) tolerate it, which is exactly what
// prepareForVision's `failOn: "none"` reproduces.
async function corruptedJpeg(): Promise<Buffer> {
  const clean = await sharp({ create: { width: 200, height: 150, channels: 3, background: { r: 200, g: 50, b: 50 } } })
    .jpeg({ quality: 90 })
    .toBuffer();
  let sof0 = -1;
  for (let i = 0; i < clean.length - 1; i++) {
    if (clean[i] === 0xff && clean[i + 1] === 0xc0) {
      sof0 = i;
      break;
    }
  }
  if (sof0 < 0) throw new Error("test fixture build failed: no SOF0 marker found in the generated JPEG");
  const strayBytes = Buffer.alloc(2000, 0x00);
  return Buffer.concat([clean.subarray(0, sof0), strayBytes, clean.subarray(sof0)]);
}

describe("prepareForVision", () => {
  it("repairs a malformed JPEG with stray bytes injected before a marker (the real peoples-bank defect)", async () => {
    const corrupted = await corruptedJpeg();

    // Sanity-check the fixture actually reproduces the defect: a strict decode must fail with the
    // same class of error libvips reported against the real failing assets.
    await expect(sharp(corrupted).jpeg().toBuffer()).rejects.toThrow(/extraneous bytes before marker/);

    const result = await prepareForVision(corrupted, "image/jpeg");

    expect(result.ok).toBe(true);
    expect(result.mediaType).toBe("image/jpeg");
    const meta = await sharp(result.bytes!).metadata();
    expect(meta.format).toBe("jpeg");
    expect(meta.width).toBe(200);
    expect(meta.height).toBe(150);
  });

  it("downscales an oversized image so its longest edge is at most 1568px", async () => {
    const big = await sharp({ create: { width: 3000, height: 2000, channels: 3, background: { r: 10, g: 100, b: 200 } } })
      .jpeg({ quality: 90 })
      .toBuffer();

    const result = await prepareForVision(big, "image/jpeg");

    expect(result.ok).toBe(true);
    const meta = await sharp(result.bytes!).metadata();
    expect(meta.width).toBeLessThanOrEqual(1568);
    expect(meta.height).toBeLessThanOrEqual(1568);
    expect(Math.max(meta.width!, meta.height!)).toBe(1568);
  });

  it("never enlarges an image already smaller than the vision limit", async () => {
    const small = await sharp({ create: { width: 300, height: 200, channels: 3, background: { r: 5, g: 5, b: 5 } } })
      .jpeg()
      .toBuffer();

    const result = await prepareForVision(small, "image/jpeg");

    const meta = await sharp(result.bytes!).metadata();
    expect(meta.width).toBe(300);
    expect(meta.height).toBe(200);
  });

  it("returns a failure result, not a throw, for bytes that are not a decodable image at all", async () => {
    const result = await prepareForVision(Buffer.from("plainly not an image, just text"), "image/jpeg");

    expect(result.ok).toBe(false);
    expect(result.bytes).toBeUndefined();
    expect(result.error).toBeTruthy();
  });
});

describe("isPortraitImage", () => {
  it("returns true for a tall, narrow image (a poster/person shot, not a banner)", async () => {
    const portrait = await sharp({ create: { width: 600, height: 1200, channels: 3, background: { r: 1, g: 2, b: 3 } } }).jpeg().toBuffer();
    expect(await isPortraitImage(portrait)).toBe(true);
  });

  it("returns false for a landscape banner", async () => {
    const landscape = await sharp({ create: { width: 1200, height: 600, channels: 3, background: { r: 1, g: 2, b: 3 } } }).jpeg().toBuffer();
    expect(await isPortraitImage(landscape)).toBe(false);
  });

  it("returns false for a square image", async () => {
    const square = await sharp({ create: { width: 800, height: 800, channels: 3, background: { r: 1, g: 2, b: 3 } } }).jpeg().toBuffer();
    expect(await isPortraitImage(square)).toBe(false);
  });

  it("returns false (never throws) for bytes that aren't a decodable image", async () => {
    expect(await isPortraitImage(Buffer.from("not an image"))).toBe(false);
  });
});

describe("saveThumbnail", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "offer-images-test-"));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("writes a webp thumbnail at or under 50KB, at the documented public URL path", async () => {
    const source = await sharp({ create: { width: 1200, height: 800, channels: 3, background: { r: 80, g: 120, b: 200 } } })
      .jpeg({ quality: 90 })
      .toBuffer();

    const result = await saveThumbnail(source, tempDir);

    expect(result.ok).toBe(true);
    expect(result.url).toBe(`/offer-images/${result.hash}.webp`);
    const filePath = join(tempDir, "offer-images", `${result.hash}.webp`);
    expect(existsSync(filePath)).toBe(true);
    expect(statSync(filePath).size).toBeLessThanOrEqual(50 * 1024);
  });

  it("is content-addressed: identical source bytes always produce the same hash and url", async () => {
    const source = await sharp({ create: { width: 900, height: 500, channels: 3, background: { r: 40, g: 40, b: 40 } } }).png().toBuffer();

    const first = await saveThumbnail(source, tempDir);
    const second = await saveThumbnail(Buffer.from(source), tempDir); // a fresh copy of the same bytes

    expect(first.hash).toBe(second.hash);
    expect(first.url).toBe(second.url);
  });

  it("is idempotent: a second call for the same bytes does not rewrite the existing file", async () => {
    const source = await sharp({ create: { width: 640, height: 480, channels: 3, background: { r: 12, g: 34, b: 56 } } }).jpeg().toBuffer();

    const first = await saveThumbnail(source, tempDir);
    const filePath = join(tempDir, "offer-images", `${first.hash}.webp`);
    // Overwrite the file with a sentinel value the real write would never produce — if the second
    // call skips the write (as it should, since the file already exists), this sentinel survives.
    writeFileSync(filePath, "sentinel-should-survive");

    const second = await saveThumbnail(source, tempDir);

    expect(second.ok).toBe(true);
    expect(second.hash).toBe(first.hash);
    expect(readFileSync(filePath, "utf8")).toBe("sentinel-should-survive");
  });
});

describe("sweepOrphans", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "offer-images-sweep-test-"));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("deletes files not referenced by any offer's imageUrl, keeping the referenced ones", () => {
    const imagesDir = join(tempDir, "offer-images");
    writeFileSync(join(tempDir, "offer-images-marker"), "unrelated file outside the dir, untouched"); // sanity: only offer-images/ is swept
    mkdirSync(imagesDir, { recursive: true });
    writeFileSync(join(imagesDir, "keep.webp"), "keep me");
    writeFileSync(join(imagesDir, "drop.webp"), "drop me");

    const deleted = sweepOrphans(tempDir, ["/offer-images/keep.webp"]);

    expect(deleted).toBe(1);
    expect(existsSync(join(imagesDir, "keep.webp"))).toBe(true);
    expect(existsSync(join(imagesDir, "drop.webp"))).toBe(false);
  });

  it("is a no-op (returns 0, never throws) when the offer-images directory does not exist", () => {
    expect(sweepOrphans(tempDir, [])).toBe(0);
  });
});
