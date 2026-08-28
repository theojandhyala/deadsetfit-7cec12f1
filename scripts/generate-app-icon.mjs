import { dirname } from "node:path";
import { mkdir, readFile } from "node:fs/promises";
import sharp from "sharp";

/**
 * Every DEADSET brand surface is derived from the user-approved artwork in
 * public/brand/deadset-logo-source.jpg. Do not redraw the wordmark with fonts:
 * even a close substitute changes the shape and spacing of the real logo.
 */
const SOURCE = "public/brand/deadset-logo-source.jpg";
const source = await readFile(SOURCE);

const sourceMeta = await sharp(source).metadata();
if (sourceMeta.width !== 1206 || sourceMeta.height !== 1082) {
  throw new Error(
    `Unexpected DEADSET logo source dimensions: ${sourceMeta.width}x${sourceMeta.height}`,
  );
}

// The full supplied artwork, padded only with the same sampled near-black so
// iOS receives a compliant square icon without cropping any part of the mark.
const square = await sharp(source)
  .resize(1024, 1024, {
    fit: "contain",
    background: { r: 7, g: 7, b: 7, alpha: 1 },
  })
  .png({ compressionLevel: 9 })
  .toBuffer();

// A tighter, still pixel-for-pixel crop for headers where the full square's
// generous breathing room would make the official lockup unreadably small.
const lockup = await sharp(source)
  .extract({ left: 205, top: 350, width: 810, height: 360 })
  .png({ compressionLevel: 9 })
  .toBuffer();

const outputs = [
  ["ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png", 1024, square],
  ["ios/App/DeadSetWatch/Assets.xcassets/AppIcon.appiconset/AppIcon-1024.png", 1024, square],
  ["ios/App/App/Assets.xcassets/Splash.imageset/splash-2732x2732.png", 2732, square],
  ["ios/App/App/Assets.xcassets/Splash.imageset/splash-2732x2732-1.png", 2732, square],
  ["ios/App/App/Assets.xcassets/Splash.imageset/splash-2732x2732-2.png", 2732, square],
  ["public/icon-512.png", 512, square],
  ["public/icon-192.png", 192, square],
  ["public/apple-touch-icon.png", 180, square],
  ["ios/App/DeadSetRestActivity/Assets.xcassets/RestMark.imageset/RestMark.png", 192, square],
  ["public/favicon-48.png", 48, square],
  ["public/favicon-32.png", 32, square],
  ["public/favicon-16.png", 16, square],
];

for (const [path, size, image] of outputs) {
  await mkdir(dirname(path), { recursive: true });
  await sharp(image).resize(size, size).png({ compressionLevel: 9 }).toFile(path);
}

await mkdir("public/brand", { recursive: true });
await sharp(lockup).toFile("public/brand/deadset-lockup.png");

console.log(`Generated ${outputs.length + 1} assets from ${SOURCE}.`);
