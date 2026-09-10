import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
const { chromium } = await import(process.env.DEADSET_PLAYWRIGHT_MODULE ?? "playwright");
const out = path.resolve("artifacts/app-store/panorama-1.3");
const pairs = [
  {
    theme: "strength",
    line: "01 / STRENGTH YOU CAN SEE",
    first: {
      screen: "strength",
      title: "EVERY MUSCLE.<br><em>MADE VISIBLE.</em>",
      copy: "Your lifts become a map of your progress.",
      tag: "STRENGTH MAP",
    },
    second: {
      screen: "roadmap",
      title: "YOUR NEXT RANK.<br><em>WITHIN SIGHT.</em>",
      copy: "See the benchmark. Know what counts.",
      tag: "RANK ROADMAP",
    },
  },
  {
    theme: "training",
    line: "02 / BUILT AROUND YOUR TRAINING",
    first: {
      screen: "plan",
      title: "BUILD YOUR WEEK.<br><em>OWN YOUR PLAN.</em>",
      copy: "Exercises, sets and muscle coverage. Together.",
      tag: "WEEKLY PLAN",
    },
    second: {
      screen: "logger",
      title: "EVERY SET.<br><em>NOTHING LOST.</em>",
      copy: "Your last performance. Your next working set.",
      tag: "LIVE WORKOUT",
    },
  },
  {
    theme: "progress",
    line: "03 / PROGRESS WITH PROOF",
    first: {
      screen: "compare",
      title: "THEN VS NOW.<br><em>SEE THE CHANGE.</em>",
      copy: "Compare training blocks. Find your improvements.",
      tag: "TRAINING BLOCKS",
    },
    second: {
      screen: "records",
      title: "YOUR RECORDS.<br><em>THE WHOLE STORY.</em>",
      copy: "Weights, reps, holds and distance. All yours.",
      tag: "PERSONAL RECORD BOOK",
    },
  },
];
await mkdir(out, { recursive: true });
await mkdir(path.join(out, "ios-6.9"), { recursive: true });
await mkdir(path.join(out, "ios-6.5"), { recursive: true });
const logo = (await readFile("public/brand/deadset-lockup.png")).toString("base64");
const images = Object.fromEntries(
  await Promise.all(
    pairs
      .flatMap((p) => [p.first.screen, p.second.screen])
      .map(async (s) => [
        s,
        (await readFile(path.join(out, "raw", s + ".png"))).toString("base64"),
      ]),
  ),
);
const panel = (shot, index) =>
  `<section class="panel panel-${index}"><header><img src="data:image/png;base64,${logo}" alt="DEADSET"><span>${shot.tag}</span></header><h1>${shot.title}</h1><p class="copy">${shot.copy}</p><div class="index"><b>0${index + 1}</b><i></i><span>PLAN. LIFT. PROGRESS.</span></div></section>`;
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 880, height: 956 }, deviceScaleFactor: 3 });
const manifest = [];
for (let n = 0; n < pairs.length; n++) {
  const pair = pairs[n];
  const html = `<!doctype html><html><head><meta charset="UTF-8"><link href="https://fonts.googleapis.com/css2?family=Oswald:wght@500;700&family=Inter:wght@400;600;700;800;900&display=swap" rel="stylesheet"><style>
 *{box-sizing:border-box}html,body{margin:0;width:880px;height:956px;background:#090909;color:#f5f5f0;font-family:Inter,Arial,sans-serif;overflow:hidden}
 .spread{position:relative;width:880px;height:956px;isolation:isolate;background:radial-gradient(ellipse at 50% 73%,#510602 0%,#180403 40%,#090909 74%)}
 .grid{position:absolute;inset:0;opacity:.16;background-image:linear-gradient(#ce7e711c 1px,transparent 1px),linear-gradient(90deg,#ce7e711c 1px,transparent 1px);background-size:40px 40px;mask-image:linear-gradient(transparent,#000)}
 .orbit{position:absolute;left:255px;top:352px;width:370px;height:520px;transform:rotate(-33deg);border:2px solid #ff4835;box-shadow:0 0 14px #ff341bc7,inset 0 0 14px #ff341b80,0 0 100px #e1060055;border-radius:50%;z-index:-1}
 .orbit.two{left:94px;top:470px;width:690px;height:245px;transform:rotate(-18deg);opacity:.6}
 .trail{position:absolute;left:-160px;top:620px;width:1200px;height:20px;background:linear-gradient(90deg,#520000,#f3190a 35%,#ffc8a5 51%,#e10600 64%,#590000);transform:rotate(-17deg);box-shadow:0 0 20px #ef210a,0 0 70px #e10600;border:1px solid #fa5846;z-index:-1}
 .ghost{position:absolute;left:-20px;top:610px;font:italic 700 250px/1 Oswald,Impact,sans-serif;letter-spacing:-12px;color:transparent;-webkit-text-stroke:1px #f74b3222;white-space:nowrap;z-index:-1}
 .panel{position:absolute;top:0;left:0;width:440px;height:956px;padding:30px 32px}.panel-1{left:440px}
 header{display:flex;align-items:center;justify-content:space-between;height:52px;gap:10px}header img{width:145px;height:auto;margin-left:-11px}header span{font-size:9px;font-weight:800;letter-spacing:1.5px;text-align:right;color:#eac4bc}
 h1{font:italic 700 51px/1.04 Oswald,Impact,sans-serif;letter-spacing:-1.4px;margin:29px 0 0;white-space:nowrap}h1 em{font-style:inherit;color:#ff3825}
 .copy{font-size:15px;line-height:1.5;max-width:355px;margin:16px 0 0;color:#c9c4c3;font-weight:600}
 .phone{position:absolute;width:338px;height:735px;top:318px;padding:7px;border-radius:43px;background:linear-gradient(120deg,#94979c,#1e2025 9%,#070707 43%,#67676b 74%,#101012);box-shadow:0 35px 70px #000d,0 0 0 1px #9b9b9b65,inset 0 0 2px white;overflow:hidden;z-index:1}
 .phone img{display:block;width:324px;height:704px;object-fit:cover;border-radius:35px;background:#080808}.phone:after{content:"";position:absolute;inset:0;border-radius:43px;box-shadow:inset 1px 0 1px #fff7;pointer-events:none}
 .phone-a{left:64px;transform:rotate(-8deg)}.phone-b{left:478px;transform:rotate(8deg)}
 .floor{position:absolute;left:0;right:0;bottom:0;height:63px;background:linear-gradient(transparent,#090909 67%);z-index:3}
 .index{position:absolute;bottom:22px;left:32px;right:32px;display:flex;align-items:center;gap:10px;font-size:8px;letter-spacing:1.8px;color:#a19b9b;z-index:4}.index b{font-size:11px;color:#f54c3a}.index i{height:1px;flex:1;background:#f0322144}
 .bridge{position:absolute;left:411px;top:279px;width:58px;height:58px;transform:rotate(45deg);border:1px solid #ff4c3777;background:linear-gradient(140deg,#fa3b20,#760602);box-shadow:0 0 40px #df160680;z-index:2}
 .bridge:after{content:"";position:absolute;inset:13px;border:1px solid #ffbcb27d}
 </style></head><body><div class="spread"><div class="grid"></div><div class="orbit"></div><div class="orbit two"></div><div class="trail"></div><div class="ghost">DEADSET</div>${panel(pair.first, 0)}${panel(pair.second, 1)}<div class="bridge"></div><div class="phone phone-a"><img src="data:image/png;base64,${images[pair.first.screen]}"></div><div class="phone phone-b"><img src="data:image/png;base64,${images[pair.second.screen]}"></div><div class="floor"></div></div></body></html>`;
  await writeFile(path.join(out, `pair-${n + 1}.html`), html);
  await page.setContent(html, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  const overflows = await page
    .locator("h1")
    .evaluateAll((nodes) => nodes.map((e) => ({ width: e.scrollWidth, available: e.clientWidth })));
  if (overflows.some((x) => x.width > x.available))
    throw new Error("Headline overflow " + JSON.stringify(overflows));
  const full = await page.screenshot();
  await sharp(full)
    .flatten({ background: "#090909" })
    .removeAlpha()
    .png()
    .toFile(path.join(out, `pair-${n + 1}.png`));
  for (let half = 0; half < 2; half++) {
    const index = n * 2 + half + 1,
      shot = half ? pair.second : pair.first,
      filename = `0${index}-${shot.screen}.png`;
    const image = sharp(full)
      .extract({ left: half * 1320, top: 0, width: 1320, height: 2868 })
      .flatten({ background: "#090909" })
      .removeAlpha();
    await image
      .clone()
      .png()
      .toFile(path.join(out, "ios-6.9", filename));
    await image
      .clone()
      .resize(1242, 2688, { fit: "fill" })
      .png()
      .toFile(path.join(out, "ios-6.5", filename));
    manifest.push({
      order: index,
      filename,
      title: shot.title.replace(/<[^>]*>/g, " "),
      source: "raw/" + shot.screen + ".png",
      pair: n + 1,
    });
  }
  console.log("Rendered connected pair", n + 1);
}
await browser.close();
const tiles = await Promise.all(
  [1, 2, 3].map(async (n) => ({
    input: await sharp(path.join(out, `pair-${n}.png`))
      .resize(880, 956)
      .toBuffer(),
    left: 0,
    top: (n - 1) * 956,
  })),
);
await sharp({ create: { width: 880, height: 2868, channels: 3, background: "#090909" } })
  .composite(tiles)
  .png()
  .toFile(path.join(out, "contact-sheet.png"));
await writeFile(
  path.join(out, "manifest.json"),
  JSON.stringify(
    {
      version: "1.3",
      build: 163,
      source:
        "Actual React screens with fictional local demo data; no customer data or generated UI.",
      sets: { "ios-6.9": [1320, 2868], "ios-6.5": [1242, 2688] },
      screenshots: manifest,
    },
    null,
    2,
  ),
);
console.log(out);
