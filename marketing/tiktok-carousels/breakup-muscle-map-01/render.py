from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, ImageOps


ROOT = Path(__file__).resolve().parent
PROJECT = ROOT.parents[2]
FONT = "/System/Library/Fonts/Supplemental/Arial Bold.ttf"
SIZE = (1080, 1920)


def centered_text(draw: ImageDraw.ImageDraw, text: str, y: int, size: int) -> None:
    font = ImageFont.truetype(FONT, size)
    box = draw.textbbox((0, 0), text, font=font, stroke_width=7)
    x = (SIZE[0] - (box[2] - box[0])) // 2
    draw.text((x, y), text, font=font, fill="white", stroke_width=7, stroke_fill="black")


def render_hook() -> None:
    source = ROOT / "source-gym-pose.jpg"
    image = ImageOps.fit(Image.open(source).convert("RGB"), SIZE, method=Image.Resampling.LANCZOS)
    # Keep the first slide looking like an ordinary gym post rather than a
    # designed ad. A light vignette only protects the native TikTok caption.
    shade = Image.new("RGBA", SIZE, (0, 0, 0, 0))
    shade_draw = ImageDraw.Draw(shade)
    for y in range(0, 620):
        alpha = max(0, int(115 * (1 - y / 620)))
        shade_draw.line((0, y, SIZE[0], y), fill=(0, 0, 0, alpha))
    image = Image.alpha_composite(image.convert("RGBA"), shade).convert("RGB")
    centered_text(ImageDraw.Draw(image), "how much did the breakup hurt?", 260, 58)
    image.save(ROOT / "01-hook.png", optimize=True)


def verify_payoff() -> None:
    """The payoff is captured from the exact Xcode-shipped component."""
    payoff = ROOT / "02-muscle-map.png"
    if not payoff.exists():
        raise FileNotFoundError("Capture 02-muscle-map.png from xcode-muscle-preview.html first")
    if Image.open(payoff).size != SIZE:
        raise ValueError("Xcode muscle-map capture must be 1080x1920")


def render_contact_sheet() -> None:
    sheet = Image.new("RGB", (1080, 960), "black")
    for index, name in enumerate(("01-hook.png", "02-muscle-map.png")):
        slide = Image.open(ROOT / name).convert("RGB").resize((540, 960), Image.Resampling.LANCZOS)
        sheet.paste(slide, (index * 540, 0))
    sheet.save(ROOT / "contact-sheet.png", optimize=True)


if __name__ == "__main__":
    render_hook()
    verify_payoff()
    render_contact_sheet()
