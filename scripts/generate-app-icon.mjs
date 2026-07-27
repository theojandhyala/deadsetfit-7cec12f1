import { dirname } from "node:path";
import { mkdir } from "node:fs/promises";
import sharp from "sharp";

const source = Buffer.from(`
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
  ["ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png", 1024],
  ["public/icon-512.png", 512],
  ["public/icon-192.png", 192],
  ["public/apple-touch-icon.png", 180],
  ["public/favicon-48.png", 48],
  ["public/favicon-32.png", 32],
  ["public/favicon-16.png", 16],
];

for (const [path, size] of outputs) {
  await mkdir(dirname(path), { recursive: true });
  await sharp(source).resize(size, size).png({ compressionLevel: 9 }).toFile(path);
}

console.log(`Generated ${outputs.length} DEADSET icon assets.`);
