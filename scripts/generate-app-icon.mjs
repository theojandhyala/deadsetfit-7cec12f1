import { dirname } from "node:path";
import { mkdir } from "node:fs/promises";
import sharp from "sharp";

/**
 * The App Store icon: the full DEADSET wordmark. Restored deliberately — this
 * script previously emitted the DS monogram everywhere, so re-running it would
 * quietly replace the store icon again.
 */
const wordmark = Buffer.from(`
  <svg width="1024" height="1024" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
    <rect width="1024" height="1024" fill="#070707"/>
    <g transform="skewX(-8)">
      <text x="150" y="545" fill="#f5f5f0"
        font-family="Arial Black, Arial, sans-serif" font-size="150" font-weight="900">DEAD</text>
      <text x="580" y="545" fill="#ef3829"
        font-family="Arial Black, Arial, sans-serif" font-size="150" font-weight="900">SET</text>
    </g>
    <text x="512" y="660" text-anchor="middle" fill="#9b9ba3"
      font-family="Arial, sans-serif" font-size="48" font-weight="800" letter-spacing="16">FORGE YOUR BODY</text>
  </svg>
`);

/**
 * Small square marks — the Live Activity badge and the tab favicons. The
 * wordmark is stacked over two lines and the tagline dropped, so DEADSET still
 * reads in a 34pt Dynamic Island slot instead of collapsing into a grey bar.
 */
const stacked = Buffer.from(`
  <svg width="384" height="384" viewBox="0 0 384 384" xmlns="http://www.w3.org/2000/svg">
    <rect width="384" height="384" fill="#0a0a0a"/>
    <g transform="skewX(-8)">
      <text x="200" y="170" text-anchor="middle" fill="#f5f5f0"
        font-family="Arial Black, Arial, sans-serif" font-size="106" font-weight="900">DEAD</text>
      <text x="200" y="288" text-anchor="middle" fill="#e10600"
        font-family="Arial Black, Arial, sans-serif" font-size="106" font-weight="900">SET</text>
    </g>
  </svg>
`);

/* The DS monogram lived here. It carried the red bracket, which is not part of
   the DEADSET mark, so nothing generates it any more. */

const outputs = [
  // Anywhere the icon represents "the app" — the App Store listing and the
  // home-screen tile — carries the wordmark.
  ["ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png", 1024, wordmark],
  ["public/icon-512.png", 512, wordmark],
  ["public/icon-192.png", 192, wordmark],
  ["public/apple-touch-icon.png", 180, wordmark],
  // The rest-timer badge on the Lock Screen and Dynamic Island. It was the last
  // place the DS monogram survived.
  ["ios/App/DeadSetRestActivity/Assets.xcassets/RestMark.imageset/RestMark.png", 192, stacked],
  // Tab favicons use the stacked wordmark. Two short lines survive 16px far
  // better than the full lockup would.
  ["public/favicon-48.png", 48, stacked],
  ["public/favicon-32.png", 32, stacked],
  ["public/favicon-16.png", 16, stacked],
];

for (const [path, size, source] of outputs) {
  await mkdir(dirname(path), { recursive: true });
  await sharp(source).resize(size, size).png({ compressionLevel: 9 }).toFile(path);
}

console.log(`Generated ${outputs.length} DEADSET icon assets.`);
