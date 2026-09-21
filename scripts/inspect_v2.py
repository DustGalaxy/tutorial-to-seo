import sys
from pathlib import Path
import re

sys.stdout.reconfigure(encoding='utf-8')

v2_html = Path("e:/seo-projects/tutorial-to-seo/v2/index.html")
text = v2_html.read_text(encoding="utf-8")

print(f"v2/index.html length: {len(text)} characters")

# Check images
images = re.findall(r'<img[^>]+>', text)
print(f"Total img tags: {len(images)}")
for img in images:
    print(" ", img[:150])

# Check dialogs
dialogs = re.findall(r'<dialog[^>]*>', text)
print(f"Total dialog tags: {len(dialogs)}")
for d in dialogs:
    print(" ", d)

# Check buttons
buttons = re.findall(r'<button[^>]*id=["\']([^"\']+)["\']', text)
print(f"Sample button IDs: {buttons[:15]}")

# Verify map-background.png magic bytes
png1 = Path("e:/seo-projects/tutorial-to-seo/v2/assets/images/map-background.png").read_bytes()
print(f"map-background.png size: {len(png1):,} bytes, magic: {png1[:8] == b'\\x89PNG\\r\\n\\x1a\\n'}")

# Verify maximus.png magic bytes
png2 = Path("e:/seo-projects/tutorial-to-seo/v2/assets/images/maximus.png").read_bytes()
print(f"maximus.png size: {len(png2):,} bytes, magic: {png2[:8] == b'\\x89PNG\\r\\n\\x1a\\n'}")
