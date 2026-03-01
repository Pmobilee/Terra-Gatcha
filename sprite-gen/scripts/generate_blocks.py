#!/usr/bin/env python3
"""
Generate tile/block sprites for Terra Miner using ComfyUI SDXL pipeline.
Tiles are full-bleed square textures with no transparency (no background removal).
"""

import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).parent
sys.path.insert(0, str(SCRIPT_DIR))

from generate_sprite import (
    queue_prompt,
    wait_for_completion,
    download_image,
    build_sdxl_workflow,
    downscale,
    OUTPUT_DIR,
    SPRITES_DIR,
    HIRES_DIR,
    COMFYUI_URL,
)
from PIL import Image
import io

HIRES_SIZE = 256
GAME_SIZE = 32

BLOCKS = [
    {
        "name": "tile_dirt",
        "prompt": "pixel art seamless dirt tile texture, earthy brown soil, small pebbles and roots, top-down game tile",
        "seed": 401,
    },
    {
        "name": "tile_soft_rock",
        "prompt": "pixel art seamless soft rock tile texture, crumbly grey-brown stone, layered sediment, top-down game tile",
        "seed": 402,
    },
    {
        "name": "tile_stone",
        "prompt": "pixel art seamless stone tile texture, solid grey granite block, rough surface, top-down game tile",
        "seed": 403,
    },
    {
        "name": "tile_hard_rock",
        "prompt": "pixel art seamless hard rock tile texture, dark grey granite with faint crystal veins, dense and impenetrable-looking, top-down game tile",
        "seed": 404,
    },
    {
        "name": "tile_unbreakable",
        "prompt": "pixel art seamless unbreakable void rock tile, near-black obsidian with faint purple shimmer, impenetrable, top-down game tile",
        "seed": 405,
    },
    {
        "name": "block_oxygen_cache",
        "prompt": "pixel art game tile, glowing blue oxygen tank canister embedded in rock, sci-fi, centered icon",
        "seed": 501,
    },
    {
        "name": "block_upgrade_crate",
        "prompt": "pixel art game tile, golden treasure chest crate with glowing star, centered icon, reward",
        "seed": 502,
    },
    {
        "name": "block_quiz_gate",
        "prompt": "pixel art game tile, ancient glowing golden gate seal with question mark rune, mystical, centered icon",
        "seed": 503,
    },
    {
        "name": "block_exit_ladder",
        "prompt": "pixel art game tile, wooden ladder going upward through rock ceiling, exit portal glow, centered icon",
        "seed": 504,
    },
]


def ensure_output_dirs():
    """Ensure all output directories exist."""
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    (HIRES_DIR / "tiles").mkdir(parents=True, exist_ok=True)
    (SPRITES_DIR / "tiles").mkdir(parents=True, exist_ok=True)


def generate_block(block, index, total):
    """Generate a single block sprite."""
    name = block["name"]
    prompt = block["prompt"]
    seed = block["seed"]

    try:
        print(f"[{index}/{total}] Generating {name}...", end=" ", flush=True)

        # Build and queue workflow
        workflow = build_sdxl_workflow(prompt, seed)
        prompt_id = queue_prompt(workflow)

        # Wait for completion
        result = wait_for_completion(prompt_id, timeout=300)

        # Extract filename/subfolder from history and download
        img_bytes = None
        for node_output in result.get("outputs", {}).values():
            if "images" in node_output:
                img_info = node_output["images"][0]
                img_bytes = download_image(img_info["filename"], img_info.get("subfolder", ""))
                break
        if img_bytes is None:
            raise RuntimeError("No image returned from ComfyUI")

        # Load as PIL Image (RGB, no background removal)
        img = Image.open(io.BytesIO(img_bytes)).convert("RGB")

        # Save raw
        raw_path = OUTPUT_DIR / f"{name}_raw.png"
        img.save(raw_path, "PNG")

        # Downscale to 256x256 (convert to RGBA for downscale)
        img_rgba = img.convert("RGBA")
        hires_img = downscale(img_rgba, HIRES_SIZE)
        hires_path_output = OUTPUT_DIR / f"{name}_256.png"
        hires_path_sprite = HIRES_DIR / "tiles" / f"{name}.png"
        hires_img.save(hires_path_output, "PNG")
        hires_img.save(hires_path_sprite, "PNG")

        # Downscale to 32x32
        game_img = downscale(img_rgba, GAME_SIZE)
        game_path_output = OUTPUT_DIR / f"{name}_32.png"
        game_path_sprite = SPRITES_DIR / "tiles" / f"{name}.png"
        game_img.save(game_path_output, "PNG")
        game_img.save(game_path_sprite, "PNG")

        print("OK")
        return True
    except Exception as e:
        print(f"FAILED: {e}")
        return False


def main():
    """Generate all block sprites."""
    ensure_output_dirs()

    total = len(BLOCKS)
    successful = 0
    failed = 0

    for index, block in enumerate(BLOCKS, 1):
        if generate_block(block, index, total):
            successful += 1
        else:
            failed += 1

    print(f"\n--- Summary ---")
    print(f"Total: {total}, Successful: {successful}, Failed: {failed}")

    if failed > 0:
        sys.exit(1)


if __name__ == "__main__":
    main()
