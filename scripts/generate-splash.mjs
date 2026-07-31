import { dirname } from "node:path";
import { mkdir } from "node:fs/promises";
import sharp from "sharp";

/**
 * The native launch screen. iOS shows this as a static image before any web
 * code runs, so it cannot animate — its job is to be the same black as the app
 * so there is no flash, and to hand over invisibly to the animated boot screen
 * in index.html.
 *
 * The artwork is square and centred because the storyboard scales it to fill
 * every device aspect ratio; anything near the edges gets cropped.
 */
const splash = Buffer.from(`
  <svg width="2732" height="2732" viewBox="0 0 2732 2732" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <radialGradient id="glow" cx="50%" cy="38%" r="52%">
        <stop offset="0%" stop-color="#1a0b0b"/>
        <stop offset="100%" stop-color="#0a0a0a"/>
      </radialGradient>
    </defs>
    <rect width="2732" height="2732" fill="#0a0a0a"/>
    <rect width="2732" height="2732" fill="url(#glow)"/>
    <g transform="skewX(-8)">
      <text x="620" y="1420" fill="#f5f5f0"
        font-family="Arial Black, Arial, sans-serif" font-size="290" font-weight="900">DEAD</text>
      <text x="1450" y="1420" fill="#e10600"
        font-family="Arial Black, Arial, sans-serif" font-size="290" font-weight="900">SET</text>
    </g>
    <text x="1366" y="1580" text-anchor="middle" fill="#6a6a6a"
      font-family="Arial, sans-serif" font-size="82" font-weight="800" letter-spacing="30">FORGE YOUR BODY</text>
  </svg>
`);

const outputs = [
  "ios/App/App/Assets.xcassets/Splash.imageset/splash-2732x2732.png",
  "ios/App/App/Assets.xcassets/Splash.imageset/splash-2732x2732-1.png",
  "ios/App/App/Assets.xcassets/Splash.imageset/splash-2732x2732-2.png",
];

for (const path of outputs) {
  await mkdir(dirname(path), { recursive: true });
  await sharp(splash).resize(2732, 2732).png({ compressionLevel: 9 }).toFile(path);
}

console.log(`Generated ${outputs.length} DEADSET splash assets.`);
