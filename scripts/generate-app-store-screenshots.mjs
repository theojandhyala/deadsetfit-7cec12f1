import { mkdir, rm } from "node:fs/promises";
import sharp from "sharp";

const width = 1320;
const height = 2868;
const screenWidth = 1050;
const screenTop = 570;
const screenHeight = 2281;
const outputDir = "artifacts/app-store/ios-6.9";

const shots = [
  {
    source: "artifacts/app-store/raw-1.1/01-train.png",
    output: "01-today.png",
    kicker: "TODAY WITHOUT THE GUESSWORK",
    line1: "KNOW TODAY.",
    line2: "OWN THE WEEK.",
  },
  {
    source: "artifacts/app-store/raw-1.1/02-plan.png",
    output: "02-plan.png",
    kicker: "FULL SCHEDULE CONTROL",
    line1: "BUILD THE WEEK.",
    line2: "YOUR WAY.",
  },
  {
    source: "artifacts/app-store/raw-1.1/03-progress.png",
    output: "03-progress.png",
    kicker: "PROOF, NOT GUESSWORK",
    line1: "SEE THE WORK.",
    line2: "SEE THE RESULT.",
  },
  {
    source: "artifacts/app-store/raw-1.1/04-logger.png",
    output: "04-logger.png",
    kicker: "FAST, FOCUSED WORKOUT LOGGING",
    line1: "LOG EVERY SET.",
    line2: "MISS NOTHING.",
  },
  {
    source: "artifacts/app-store/raw-1.1/05-profile.png",
    output: "05-ranked.png",
    kicker: "RANKED TRAINING",
    line1: "BUILD YOUR CARD.",
    line2: "CLIMB THE RANKS.",
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
        font-size="104" font-style="italic" font-weight="900">${shot.line1}</text>
      <text x="132" y="405" fill="#ef3829" font-family="Arial Black, Arial, sans-serif"
        font-size="104" font-style="italic" font-weight="900">${shot.line2}</text>
      <text x="1186" y="132" text-anchor="end" fill="#f5f5f0" font-family="Arial Black, Arial, sans-serif"
        font-size="44" font-style="italic" font-weight="900">DEAD<tspan fill="#ef3829">SET</tspan></text>
      <rect x="119" y="557" width="1082" height="2294" rx="78" fill="none"
        stroke="#ef3829" stroke-opacity=".42" stroke-width="4"/>
    </svg>
  `);
}

await rm(outputDir, { recursive: true, force: true });
await mkdir(outputDir, { recursive: true });

for (const shot of shots) {
  const resized = await sharp(shot.source)
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

console.log(`Generated ${shots.length} App Store screenshots at ${width}x${height}.`);
