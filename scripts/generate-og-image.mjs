/** Render the share card from the same approved raster lockup as the app. */
import { readFile } from "node:fs/promises";
import sharp from "sharp";

const WIDTH = 1200;
const HEIGHT = 630;
const lockup = await readFile("public/brand/deadset-lockup.png");

const background = Buffer.from(`
  <svg width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <radialGradient id="glow" cx="50%" cy="42%" r="72%">
        <stop offset="0%" stop-color="#27100f"/>
        <stop offset="55%" stop-color="#110909"/>
        <stop offset="100%" stop-color="#070707"/>
      </radialGradient>
    </defs>
    <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#glow)"/>
  </svg>
`);

await sharp(background)
  .composite([{ input: await sharp(lockup).resize({ width: 840 }).toBuffer(), gravity: "center" }])
  .png({ compressionLevel: 9 })
  .toFile("public/og-image.png");

const { width, height, size } = await sharp("public/og-image.png").metadata();
console.log(`Wrote public/og-image.png — ${width}x${height}, ${Math.round((size ?? 0) / 1024)} kB`);
