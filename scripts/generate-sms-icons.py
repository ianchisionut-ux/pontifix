from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

root = Path(__file__).resolve().parents[1] / 'public'
font_path = Path('C:/Windows/Fonts/arialbd.ttf')

for size in (192, 512):
    image = Image.new('RGB', (size, size), '#0c3152')
    draw = ImageDraw.Draw(image)
    margin = int(size * .14)
    box = (margin, int(size * .18), size - margin, int(size * .72))
    draw.rounded_rectangle(box, radius=int(size * .13), fill='#ffffff')
    draw.polygon([(int(size * .24), int(size * .69)), (int(size * .24), int(size * .84)), (int(size * .42), int(size * .70))], fill='#ffffff')
    font = ImageFont.truetype(str(font_path), int(size * .22))
    draw.text((size / 2, int(size * .46)), 'SMS', font=font, fill='#0c3152', anchor='mm')
    image.save(root / f'sms-icon-{size}.png')
