import { mkdir } from "node:fs/promises";
import sharp from "sharp";

const width = 1320;
const height = 2868;
const screenWidth = 1050;
const screenTop = 570;
const screenHeight = 2281;
const outputDir = "artifacts/app-store/ios-6.9-v1.2";

const welcomeSource = process.argv[2];
const strengthSource = process.argv[3];

if (!welcomeSource || !strengthSource) {
  throw new Error("Usage: node scripts/generate-app-store-1.2-assets.mjs <welcome.png> <strength-map.jpeg>");
}

const newShots = [
  {
    source: strengthSource,
    output: "01-strength-map.png",
    kicker: "YOUR STRENGTH, MADE VISIBLE",
    line1: "SEE EACH MUSCLE.",
    line2: "BUILD IT ON PURPOSE.",
    trimTop: 42,
  },
  {
    source: welcomeSource,
    output: "02-plan-lift-prove.png",
    kicker: "PLAN → LIFT → PROGRESS",
    line1: "EVERY LIFT COUNTS.",
    line2: "COLOUR IS EARNED.",
  },
];

function headingSvg(shot) {
  return Buffer.from(`
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${width}" height="${height}" fill="#070707"/>
      <path d="M92 90h14v390H92z" fill="#ef3829"/>
      <text x="142" y="142" fill="#ef3829" font-family="Arial, sans-serif"
        font-size="31" font-weight="800" letter-spacing="5">${shot.kicker}</text>
      <text x="132" y="285" fill="#f5f5f0" font-family="Arial Black, Arial, sans-serif"
        font-size="92" font-style="italic" font-weight="900">${shot.line1}</text>
      <text x="132" y="405" fill="#ef3829" font-family="Arial Black, Arial, sans-serif"
        font-size="82" font-style="italic" font-weight="900">${shot.line2}</text>
      <text x="1186" y="132" text-anchor="end" fill="#f5f5f0" font-family="Arial Black, Arial, sans-serif"
        font-size="44" font-style="italic" font-weight="900">DEAD<tspan fill="#ef3829">SET</tspan></text>
      <rect x="119" y="557" width="1082" height="2294" rx="78" fill="none"
        stroke="#ef3829" stroke-opacity=".42" stroke-width="4"/>
    </svg>
  `);
}

await mkdir(outputDir, { recursive: true });

for (const shot of newShots) {
  let input = sharp(shot.source);
  if (shot.trimTop) {
    const metadata = await input.metadata();
    input = input.extract({
      left: 0,
      top: shot.trimTop,
      width: metadata.width,
      height: metadata.height - shot.trimTop,
    });
  }

  const resized = await input
    .resize(screenWidth, screenHeight, { fit: "cover", position: "top" })
    .composite([
      {
        input: Buffer.from(
          `<svg width="${screenWidth}" height="${screenHeight}"><rect width="${screenWidth}" height="${screenHeight}" rx="66" fill="white"/></svg>`,
        ),
        blend: "dest-in",
      },
    ])
    .png()
    .toBuffer();

  await sharp(headingSvg(shot))
    .composite([{ input: resized, left: 135, top: screenTop }])
    .png({ compressionLevel: 9 })
    .toFile(`${outputDir}/${shot.output}`);
}

for (const [source, output] of [
  ["artifacts/app-store/ios-6.9/01-today.png", "03-today.png"],
  ["artifacts/app-store/ios-6.9/02-logger.png", "04-logger.png"],
  ["artifacts/app-store/ios-6.9/03-ranked.png", "05-ranked.png"],
]) {
  await sharp(source).png({ compressionLevel: 9 }).toFile(`${outputDir}/${output}`);
}

console.log(`Generated 5 App Store screenshots at ${width}x${height} in ${outputDir}.`);
