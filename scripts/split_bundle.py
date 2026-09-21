#!/usr/bin/env python3
"""
Splits the monolithic 6.5 MB v1/seo-shodynky-maximus (2).html file into clean,
modular, production-ready assets in the v2/ directory:
- Extracted binary assets: map-background.png, maximus.png
- Modular stylesheets: tokens.css, main.css, mobile.css
- Structured data: course-data.js + JSON exports (missions.json, sources.json, glossary.json)
- Modular logic: game-engine.js
- Clean, lightweight index.html (~15 KB)
"""

import os
import re
import base64
import json
from pathlib import Path

WORKSPACE_ROOT = Path(__file__).resolve().parent.parent
SOURCE_HTML = WORKSPACE_ROOT / "v1" / "seo-shodynky-maximus (2).html"
V2_DIR = WORKSPACE_ROOT / "v2"

def ensure_dirs():
    for sub in ["assets/images", "css", "js", "data"]:
        (V2_DIR / sub).mkdir(parents=True, exist_ok=True)

def extract_and_split():
    print(f"Reading source file: {SOURCE_HTML}")
    with open(SOURCE_HTML, "r", encoding="utf-8", errors="replace") as f:
        html_content = f.read()

    original_size = len(html_content.encode("utf-8"))
    print(f"Original file size: {original_size:,} bytes ({original_size / 1024 / 1024:.2f} MB)")

    ensure_dirs()

    # 1. Extract Map Background PNG
    print("\n--- Extracting Map Background PNG ---")
    map_b64_match = re.search(r"url\(['\"]?data:image/png;base64,([A-Za-z0-9+/=]+)['\"]?\)", html_content)
    if not map_b64_match:
        raise ValueError("Could not find map background data URI in source HTML")
    
    map_bytes = base64.b64decode(map_b64_match.group(1))
    map_png_path = V2_DIR / "assets" / "images" / "map-background.png"
    with open(map_png_path, "wb") as f:
        f.write(map_bytes)
    print(f"Saved: {map_png_path.relative_to(WORKSPACE_ROOT)} ({len(map_bytes):,} bytes)")

    # 2. Extract Maximus Mascot PNG
    print("\n--- Extracting Mascot PNG ---")
    # In body: <img src="data:image/png;base64,..." alt="Максимус...">
    # We search for data:image/png in <img> tag
    img_b64_match = re.search(r'<img[^>]+src=["\']data:image/png;base64,([A-Za-z0-9+/=]+)["\']', html_content)
    if not img_b64_match:
        raise ValueError("Could not find mascot data URI in source HTML")
    
    mascot_bytes = base64.b64decode(img_b64_match.group(1))
    mascot_png_path = V2_DIR / "assets" / "images" / "maximus.png"
    with open(mascot_png_path, "wb") as f:
        f.write(mascot_bytes)
    print(f"Saved: {mascot_png_path.relative_to(WORKSPACE_ROOT)} ({len(mascot_bytes):,} bytes)")

    # 3. Extract and Process Stylesheets
    print("\n--- Extracting CSS Styles ---")
    style_matches = re.findall(r"<style[^>]*>(.*?)</style>", html_content, re.DOTALL | re.IGNORECASE)
    if len(style_matches) < 2:
        raise ValueError(f"Expected at least 2 <style> blocks, found {len(style_matches)}")

    style_main_raw = style_matches[0]
    style_mobile_raw = style_matches[1]

    # In main style, replace base64 map url with relative url
    style_main_clean = re.sub(
        r"url\(['\"]?data:image/png;base64,[A-Za-z0-9+/=]+['\"]?\)",
        "url('../assets/images/map-background.png')",
        style_main_raw
    )

    # Separate tokens from main styles
    # Find :root { ... }
    root_match = re.search(r"(:root\s*\{[^}]+\})", style_main_clean)
    tokens_content = "/* Design Tokens & CSS Custom Properties */\n"
    if root_match:
        tokens_content += root_match.group(1).strip() + "\n"
        # remove :root from main style to keep it clean
        style_main_clean = style_main_clean.replace(root_match.group(1), "/* Tokens imported in tokens.css */")

    tokens_path = V2_DIR / "css" / "tokens.css"
    with open(tokens_path, "w", encoding="utf-8") as f:
        f.write(tokens_content.strip() + "\n")
    print(f"Saved: {tokens_path.relative_to(WORKSPACE_ROOT)} ({len(tokens_content):,} chars)")

    main_css_path = V2_DIR / "css" / "main.css"
    with open(main_css_path, "w", encoding="utf-8") as f:
        f.write("/* Main Retro OS & Game Board Stylesheet */\n" + style_main_clean.strip() + "\n")
    print(f"Saved: {main_css_path.relative_to(WORKSPACE_ROOT)} ({len(style_main_clean):,} chars)")

    mobile_css_path = V2_DIR / "css" / "mobile.css"
    with open(mobile_css_path, "w", encoding="utf-8") as f:
        f.write("/* Mobile Adaptation & Touch Optimization */\n" + style_mobile_raw.strip() + "\n")
    print(f"Saved: {mobile_css_path.relative_to(WORKSPACE_ROOT)} ({len(style_mobile_raw):,} chars)")

    # 4. Extract JavaScript & Structured Data
    print("\n--- Extracting JavaScript & Course Data ---")
    data_script_match = re.search(r'<script[^>]*id=["\']game-data["\'][^>]*>(.*?)</script>', html_content, re.DOTALL | re.IGNORECASE)
    engine_script_match = re.search(r'<script[^>]*id=["\']game-engine["\'][^>]*>(.*?)</script>', html_content, re.DOTALL | re.IGNORECASE)

    if not data_script_match or not engine_script_match:
        raise ValueError("Could not find game-data or game-engine scripts")

    data_code = data_script_match.group(1).strip()
    engine_code = engine_script_match.group(1).strip()

    # Save course-data.js
    course_data_js_path = V2_DIR / "js" / "course-data.js"
    with open(course_data_js_path, "w", encoding="utf-8") as f:
        f.write("/**\n * SEO Shodynky Maximus - Course Data\n * Revision, authoritative sources, missions DAG, and glossary.\n */\n" + data_code + "\n")
    print(f"Saved: {course_data_js_path.relative_to(WORKSPACE_ROOT)} ({len(data_code):,} chars)")

    # Parse and save JSON exports
    def parse_js_object(var_name, text, opener, closer):
        start = text.find(f"{var_name} = {opener}")
        if start == -1:
            return None
        start += len(f"{var_name} = ")
        depth = 0
        end = -1
        for idx in range(start, len(text)):
            ch = text[idx]
            if ch == opener:
                depth += 1
            elif ch == closer:
                depth -= 1
                if depth == 0:
                    end = idx + 1
                    break
        if end != -1:
            raw = text[start:end]
            return json.loads(raw)
        return None

    try:
        sources_obj = parse_js_object("SOURCES", data_code, "{", "}")
        if sources_obj:
            with open(V2_DIR / "data" / "sources.json", "w", encoding="utf-8") as f:
                json.dump(sources_obj, f, ensure_ascii=False, indent=2)
            print(f"Saved: v2/data/sources.json ({len(sources_obj)} sources)")

        missions_obj = parse_js_object("MISSIONS", data_code, "[", "]")
        if missions_obj:
            with open(V2_DIR / "data" / "missions.json", "w", encoding="utf-8") as f:
                json.dump(missions_obj, f, ensure_ascii=False, indent=2)
            print(f"Saved: v2/data/missions.json ({len(missions_obj)} missions)")

        glossary_obj = parse_js_object("GLOSSARY", data_code, "[", "]")
        if glossary_obj:
            with open(V2_DIR / "data" / "glossary.json", "w", encoding="utf-8") as f:
                json.dump(glossary_obj, f, ensure_ascii=False, indent=2)
            print(f"Saved: v2/data/glossary.json ({len(glossary_obj)} terms)")

        rev_match = re.search(r"COURSE_REVISION\s*=\s*(\d+)", data_code)
        metadata = {
            "title": "Сходинки в SEO — Максимус и тайны поиска",
            "courseRevision": int(rev_match.group(1)) if rev_match else 2,
            "missionsCount": len(missions_obj) if missions_obj else 0,
            "sourcesCount": len(sources_obj) if sources_obj else 0,
            "glossaryTermsCount": len(glossary_obj) if glossary_obj else 0
        }
        with open(V2_DIR / "data" / "course-metadata.json", "w", encoding="utf-8") as f:
            json.dump(metadata, f, ensure_ascii=False, indent=2)
        print("Saved: v2/data/course-metadata.json")
    except Exception as ex:
        print(f"Warning: JSON parsing had error: {ex}. Continuing with JS extraction.")

    # Save game-engine.js
    game_engine_js_path = V2_DIR / "js" / "game-engine.js"
    with open(game_engine_js_path, "w", encoding="utf-8") as f:
        f.write("/**\n * SEO Shodynky Maximus - Game Engine\n * Map coordinates, responsive layout, road generator, audio, quest flow.\n */\n" + engine_code + "\n")
    print(f"Saved: {game_engine_js_path.relative_to(WORKSPACE_ROOT)} ({len(engine_code):,} chars)")

    # 5. Assemble clean v2/index.html
    print("\n--- Assembling Modular v2/index.html ---")
    new_html = html_content

    # Replace both <style> blocks with <link> tags
    css_links = """    <link rel="stylesheet" href="css/tokens.css">
    <link rel="stylesheet" href="css/main.css">
    <link rel="stylesheet" href="css/mobile.css">"""
    
    # We replace the entire sequence of style blocks
    # Find start of first style tag and end of last style tag
    first_style_start = new_html.find("<style")
    last_style_end = new_html.rfind("</style>") + len("</style>")
    new_html = new_html[:first_style_start] + css_links + new_html[last_style_end:]

    # Replace mascot base64 src with clean file path
    new_html = re.sub(
        r'(<img[^>]+src=)["\']data:image/png;base64,[A-Za-z0-9+/=]+["\']',
        r'\1"assets/images/maximus.png"',
        new_html
    )

    # Replace both <script> blocks with clean <script src="...">
    js_scripts = """    <script src="js/course-data.js"></script>
    <script src="js/game-engine.js"></script>"""
    
    first_script_start = new_html.find('<script id="game-data"')
    last_script_end = new_html.rfind("</script>") + len("</script>")
    new_html = new_html[:first_script_start] + js_scripts + new_html[last_script_end:]

    index_html_path = V2_DIR / "index.html"
    with open(index_html_path, "w", encoding="utf-8") as f:
        f.write(new_html)

    new_size = len(new_html.encode("utf-8"))
    print(f"Saved: {index_html_path.relative_to(WORKSPACE_ROOT)} ({new_size:,} bytes, {new_size / 1024:.2f} KB)")
    print(f"\nHTML size reduction: {original_size:,} bytes -> {new_size:,} bytes ({(1 - new_size/original_size)*100:.1f}% reduction!)")

if __name__ == "__main__":
    extract_and_split()
