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
    source = PROJECT / "marketing/tiktok/video/viral-research-hero/qa/motivation-0.5.jpg"
    image = ImageOps.fit(Image.open(source).convert("RGB"), SIZE, method=Image.Resampling.LANCZOS)
    centered_text(ImageDraw.Draw(image), "so the breakup really hurt?", 840, 58)
    image.save(ROOT / "01-hook.png", optimize=True)


def render_payoff() -> None:
    image = Image.new("RGB", SIZE, "#070708")
    top = Image.open(ROOT / "02-muscle-map-top.png").convert("RGB")
    image.paste(top, (0, 0))
    centered_text(ImageDraw.Draw(image), "the muscle map says yes.", 1310, 54)
    ImageDraw.Draw(image).rectangle((0, 1914, 1080, 1919), fill="#ed3528")
    image.save(ROOT / "02-muscle-map.png", optimize=True)


def render_contact_sheet() -> None:
    sheet = Image.new("RGB", (1080, 960), "black")
    for index, name in enumerate(("01-hook.png", "02-muscle-map.png")):
        slide = Image.open(ROOT / name).convert("RGB").resize((540, 960), Image.Resampling.LANCZOS)
        sheet.paste(slide, (index * 540, 0))
    sheet.save(ROOT / "contact-sheet.png", optimize=True)


if __name__ == "__main__":
    render_hook()
    render_payoff()
    render_contact_sheet()
