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
 * The browser icons stay on the DS monogram: a wordmark rendered at 16px is an
 * unreadable smudge in a tab strip, where a two-letter mark still reads.
 */
const monogram = Buffer.from(`
  <svg width="1024" height="1024" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
    <rect width="1024" height="1024" fill="#070707"/>
    <path d="M98 142h14v740H98z" fill="#ef3829"/>
    <path d="M112 142h92" stroke="#ef3829" stroke-width="14"/>
    <path d="M112 882h92" stroke="#ef3829" stroke-width="14"/>
    <g transform="skewX(-8)">
      <text x="145" y="665" fill="#f5f5f0"
        font-family="Arial Black, Arial, sans-serif" font-size="500" font-weight="900">D</text>
      <text x="505" y="665" fill="#ef3829"
        font-family="Arial Black, Arial, sans-serif" font-size="500" font-weight="900">S</text>
    </g>
    <text x="512" y="788" text-anchor="middle" fill="#9b9ba3"
      font-family="Arial, sans-serif" font-size="54" font-weight="800" letter-spacing="18">DEADSET</text>
  </svg>
`);

const outputs = [
  // Anywhere the icon represents "the app" — the App Store listing and the
  // home-screen tile — carries the wordmark.
  ["ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png", 1024, wordmark],
  ["public/icon-512.png", 512, wordmark],
  ["public/icon-192.png", 192, wordmark],
  ["public/apple-touch-icon.png", 180, wordmark],
  // Browser-tab favicons keep the monogram: at 16px the wordmark collapses
  // into an unreadable smudge, where two letters still read.
  ["public/favicon-48.png", 48, monogram],
  ["public/favicon-32.png", 32, monogram],
  ["public/favicon-16.png", 16, monogram],
];

for (const [path, size, source] of outputs) {
  await mkdir(dirname(path), { recursive: true });
  await sharp(source).resize(size, size).png({ compressionLevel: 9 }).toFile(path);
}

console.log(`Generated ${outputs.length} DEADSET icon assets.`);
