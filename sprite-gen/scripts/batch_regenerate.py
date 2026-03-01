#!/usr/bin/env python3
"""
Terra Miner — Batch Sprite Regeneration Pipeline
Regenerates all 6 game sprites at 256x256 hi-res resolution using the same
ComfyUI SDXL + pixel-art-xl LoRA pipeline as generate_sprite.py.

Output layout:
  src/assets/sprites-hires/<category>/<name>.png   — 256x256 hi-res source of truth
  src/assets/sprites/<category>/<name>.png         — game-ready (64x64 chars, 32x32 items)
  sprite-gen/output/<name>_raw.png                 — raw ComfyUI output
  sprite-gen/output/<name>_256.png                 — 256x256 intermediate
  sprite-gen/output/<name>_<size>.png              — game-ready intermediate

Sprites are processed ONE AT A TIME (sequential) because the GPU can only
handle one generation at a time.

Usage:
    python batch_regenerate.py
"""

import sys
from pathlib import Path

# Import shared functions and constants from generate_sprite.py in the same directory
SCRIPT_DIR = Path(__file__).parent
sys.path.insert(0, str(SCRIPT_DIR))

from generate_sprite import (
    queue_prompt,
    wait_for_completion,
    download_image,
    build_sdxl_workflow,
    remove_background,
    trim_transparent,
    make_square,
    downscale,
    COMFYUI_URL,
    OUTPUT_DIR,
    SPRITES_DIR,
    HIRES_DIR,
)

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

HIRES_SIZE = 256

SPRITES = [
    {
        "name": "miner_idle",
        "category": "characters",
        "game_size": 64,
        "prompt": "pixel art, game sprite, mining character with helmet and pickaxe, idle pose, chibi style, 2D side view",
        "seed": 101,
    },
    {
        "name": "mineral_blue",
        "category": "items",
        "game_size": 32,
        "prompt": "pixel art, game item icon, glowing blue crystal mineral gemstone, shiny faceted",
        "seed": 201,
    },
    {
        "name": "mineral_green",
        "category": "items",
        "game_size": 32,
        "prompt": "pixel art, game item icon, glowing green emerald crystal mineral, shiny faceted",
        "seed": 202,
    },
    {
        "name": "mineral_red",
        "category": "items",
        "game_size": 32,
        "prompt": "pixel art, game item icon, glowing red ruby crystal mineral, shiny faceted",
        "seed": 203,
    },
    {
        "name": "relic_gold",
        "category": "items",
        "game_size": 32,
        "prompt": "pixel art, game item icon, ancient golden artifact relic, ornate metalwork, mysterious glow",
        "seed": 301,
    },
    {
        "name": "relic_tablet",
        "category": "items",
        "game_size": 32,
        "prompt": "pixel art, game item icon, ancient stone tablet with glowing runes, mysterious carved artifact",
        "seed": 302,
    },
]


# ---------------------------------------------------------------------------
# Per-sprite generation logic
# ---------------------------------------------------------------------------

def regenerate_sprite(sprite: dict) -> bool:
    """
    Regenerate a single sprite end-to-end.

    Returns True on success, False on any error. Errors are printed but do not
    propagate so that one failure cannot abort the whole batch.
    """
    name = sprite["name"]
    category = sprite["category"]
    game_size = sprite["game_size"]
    prompt = sprite["prompt"]
    seed = sprite["seed"]

    # Ensure output directories exist
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    hires_cat_dir = HIRES_DIR / category
    sprites_cat_dir = SPRITES_DIR / category
    hires_cat_dir.mkdir(parents=True, exist_ok=True)
    sprites_cat_dir.mkdir(parents=True, exist_ok=True)

    print(f"{'=' * 64}")
    print(f"  Sprite   : {name}")
    print(f"  Category : {category}")
    print(f"  Prompt   : {prompt}")
    print(f"  Hi-res   : {HIRES_SIZE}x{HIRES_SIZE}  |  Game: {game_size}x{game_size}  |  Seed: {seed}")
    print(f"{'=' * 64}")

    try:
        # Step 1: Generate via ComfyUI
        print("  [1/5] Generating with SDXL + pixel-art-xl LoRA...")
        workflow = build_sdxl_workflow(prompt, seed=seed)
        prompt_id = queue_prompt(workflow)
        result = wait_for_completion(prompt_id, timeout=300)

        # Extract raw image bytes from completion result
        img_bytes = None
        for node_output in result.get("outputs", {}).values():
            if "images" in node_output:
                img_info = node_output["images"][0]
                img_bytes = download_image(
                    img_info["filename"], img_info.get("subfolder", "")
                )
                break

        if img_bytes is None:
            print(f"  ERROR: No image returned from ComfyUI for '{name}'")
            return False

        # Save raw intermediate
        raw_path = OUTPUT_DIR / f"{name}_raw.png"
        raw_path.write_bytes(img_bytes)
        print(f"  [1/5] Raw saved: {raw_path.name}  ({len(img_bytes) // 1024} KB)")

        # Step 2: Remove background
        print("  [2/5] Removing background with rembg...")
        rgba_img = remove_background(img_bytes)

        # Step 3: Trim transparent edges and pad to square
        print("  [3/5] Trimming and centering on square canvas...")
        trimmed = trim_transparent(rgba_img)
        squared = make_square(trimmed)

        # Step 4: Hi-res downscale to 256x256
        print(f"  [4/5] Downscaling to {HIRES_SIZE}x{HIRES_SIZE} (hi-res, nearest-neighbor)...")
        hires_img = downscale(squared, HIRES_SIZE)
        hires_intermediate = OUTPUT_DIR / f"{name}_{HIRES_SIZE}.png"
        hires_img.save(hires_intermediate)
        print(f"         Intermediate: {hires_intermediate.name}")

        # Step 5: Game-ready downscale
        print(f"  [5/5] Downscaling to {game_size}x{game_size} (game-ready, nearest-neighbor)...")
        game_img = downscale(squared, game_size)
        game_intermediate = OUTPUT_DIR / f"{name}_{game_size}.png"
        game_img.save(game_intermediate)
        print(f"         Intermediate: {game_intermediate.name}")

        # Copy to project asset directories
        hires_asset = hires_cat_dir / f"{name}.png"
        game_asset = sprites_cat_dir / f"{name}.png"
        hires_img.save(hires_asset)
        game_img.save(game_asset)

        print(f"\n  Assets written:")
        print(f"    Hi-res     : src/assets/sprites-hires/{category}/{name}.png")
        print(f"    Game-ready : src/assets/sprites/{category}/{name}.png")
        print(f"    Intermediates in: sprite-gen/output/")

        return True

    except TimeoutError as exc:
        print(f"  ERROR: Generation timed out for '{name}': {exc}")
        return False
    except Exception as exc:
        print(f"  ERROR: Unexpected failure for '{name}': {type(exc).__name__}: {exc}")
        return False


# ---------------------------------------------------------------------------
# Batch entry point
# ---------------------------------------------------------------------------

def main():
    """Regenerate all sprites sequentially, reporting a summary at the end."""
    total = len(SPRITES)
    print(f"\nTerra Miner — Batch Sprite Regeneration")
    print(f"Hi-res target: {HIRES_SIZE}x{HIRES_SIZE}")
    print(f"Sprites to process: {total}\n")

    results = {}

    for index, sprite in enumerate(SPRITES, start=1):
        print(f"\n[{index}/{total}] Starting: {sprite['name']}")
        success = regenerate_sprite(sprite)
        results[sprite["name"]] = success
        status = "OK" if success else "FAILED"
        print(f"\n[{index}/{total}] {sprite['name']}: {status}\n")

    # Summary
    print("=" * 64)
    print("  Batch complete — Summary")
    print("=" * 64)
    passed = [name for name, ok in results.items() if ok]
    failed = [name for name, ok in results.items() if not ok]

    for name in passed:
        print(f"  OK     {name}")
    for name in failed:
        print(f"  FAILED {name}")

    print(f"\n  {len(passed)}/{total} sprites generated successfully.")
    if failed:
        print(f"  {len(failed)} sprite(s) failed — check errors above.")
        sys.exit(1)
    else:
        print("  All sprites regenerated successfully.")


if __name__ == "__main__":
    main()
