/**
 * Renders the social/preview card served as og:image.
 *
 * Without one, Safari, iMessage, WhatsApp and every link unfurler fall back to
 * the 180px apple-touch-icon, which renders as a tiny logo lost in a dark tile —
 * which is exactly what the iPhone Suggestions tile was showing.
 *
 * The mark is drawn with the same vectors and type as scripts/generate-app-icon.mjs
 * rather than being redrawn by eye, so the card cannot drift away from the icon.
 *
 *   node scripts/generate-og-image.mjs
 */
import sharp from "sharp";

const WIDTH = 1200;
const HEIGHT = 630;

// The bracket-and-DS mark from the app icon, scaled and moved left, with the
// wordmark and tagline set beside it.
const svg = Buffer.from(`
  <svg width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <radialGradient id="glow" cx="50%" cy="0%" r="95%">
        <stop offset="0%" stop-color="#3a0f0d"/>
        <stop offset="55%" stop-color="#120909"/>
        <stop offset="100%" stop-color="#070707"/>
      </radialGradient>
    </defs>
    <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#glow)"/>

    <!-- Bracket motif, same proportions as the app icon -->
    <path d="M104 196h11v238h-11z" fill="#ef3829"/>
    <path d="M115 196h62" stroke="#ef3829" stroke-width="11"/>
    <path d="M115 434h62" stroke="#ef3829" stroke-width="11"/>

    <!-- One text element with tspans: the renderer computes advance widths, so
         DEAD and SET can never overlap the way hand-placed coordinates did. -->
    <text x="152" y="372" transform="skewX(-8)"
      font-family="Arial Black, Arial, sans-serif" font-size="150" font-weight="900"
      letter-spacing="-2"><tspan fill="#f5f5f0">DEAD</tspan><tspan fill="#ef3829">SET</tspan></text>

    <text x="106" y="470" fill="#9b9ba3"
      font-family="Arial, sans-serif" font-size="27" font-weight="800" letter-spacing="5">
      LOG EVERY SET. CATCH EVERY PR.
    </text>

    <rect x="106" y="516" width="104" height="5" fill="#ef3829"/>
    <text x="106" y="572" fill="#6f6f78"
      font-family="Arial, sans-serif" font-size="25" font-weight="700" letter-spacing="4">
      DEADSETFIT.ORG
    </text>
  </svg>
`);

await sharp(svg).png({ compressionLevel: 9 }).toFile("public/og-image.png");

const { width, height, size } = await sharp("public/og-image.png").metadata();
console.log(`Wrote public/og-image.png — ${width}x${height}, ${Math.round(size / 1024)} kB`);
