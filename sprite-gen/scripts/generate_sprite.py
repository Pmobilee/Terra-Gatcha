#!/usr/bin/env python3
"""
Terra Miner — Sprite Generation Pipeline
Generates pixel art sprites via ComfyUI API, removes background, and
produces both a 512x512 high-res version and a game-ready downscaled version.

Directory structure:
  src/assets/sprites-hires/<category>/<name>.png   — 512x512 source of truth
  src/assets/sprites/<category>/<name>.png         — game-ready (e.g. 64x64)

Usage:
    python generate_sprite.py --prompt "pixel art miner" --name miner_idle --category characters --size 64
    python generate_sprite.py --prompt "pixel art crystal" --name crystal_green --category items --size 32
    python generate_sprite.py --prompt "pixel art dirt tile" --name dirt --category tiles --size 32
"""

import argparse
import json
import urllib.request
import urllib.parse
import time
import io
from pathlib import Path
from PIL import Image
from rembg import remove

COMFYUI_URL = "http://localhost:8188"
SCRIPT_DIR = Path(__file__).parent
PROJECT_DIR = SCRIPT_DIR.parent.parent
OUTPUT_DIR = SCRIPT_DIR.parent / "output"
SPRITES_DIR = PROJECT_DIR / "src" / "assets" / "sprites"
HIRES_DIR = PROJECT_DIR / "src" / "assets" / "sprites-hires"

VALID_CATEGORIES = ["characters", "items", "tiles", "ui"]

# Standard prompt suffix and negative for consistency
PROMPT_SUFFIX = ", transparent background, no background, centered, clean edges, pixel art style"
NEGATIVE_PROMPT = (
    "3d render, realistic, photograph, blurry, watermark, text, signature, "
    "low quality, deformed, complex background, gradient background, shadow, "
    "multiple items, collage, grid, sheet"
)


def queue_prompt(workflow: dict) -> str:
    """Submit a workflow to ComfyUI and return the prompt_id."""
    data = json.dumps({"prompt": workflow}).encode("utf-8")
    req = urllib.request.Request(
        f"{COMFYUI_URL}/prompt",
        data=data,
        headers={"Content-Type": "application/json"},
    )
    return json.loads(urllib.request.urlopen(req).read())["prompt_id"]


def wait_for_completion(prompt_id: str, timeout: int = 300) -> dict:
    """Poll until prompt completes."""
    start = time.time()
    while time.time() - start < timeout:
        resp = urllib.request.urlopen(f"{COMFYUI_URL}/history/{prompt_id}")
        history = json.loads(resp.read())
        if prompt_id in history:
            return history[prompt_id]
        time.sleep(2)
    raise TimeoutError(f"Prompt {prompt_id} timed out after {timeout}s")


def download_image(filename: str, subfolder: str) -> bytes:
    """Download generated image bytes from ComfyUI."""
    params = urllib.parse.urlencode({
        "filename": filename, "subfolder": subfolder, "type": "output"
    })
    return urllib.request.urlopen(f"{COMFYUI_URL}/view?{params}").read()


def build_sdxl_workflow(prompt: str, seed: int = 42) -> dict:
    """SDXL + pixel-art-xl LoRA workflow at 1024x1024."""
    full_prompt = prompt + PROMPT_SUFFIX
    return {
        "1": {
            "class_type": "CheckpointLoaderSimple",
            "inputs": {"ckpt_name": "sd_xl_base_1.0.safetensors"}
        },
        "2": {
            "class_type": "LoraLoader",
            "inputs": {
                "model": ["1", 0], "clip": ["1", 1],
                "lora_name": "pixel-art-xl.safetensors",
                "strength_model": 0.9, "strength_clip": 0.9
            }
        },
        "3": {
            "class_type": "CLIPTextEncode",
            "inputs": {"text": full_prompt, "clip": ["2", 1]}
        },
        "4": {
            "class_type": "CLIPTextEncode",
            "inputs": {"text": NEGATIVE_PROMPT, "clip": ["2", 1]}
        },
        "5": {
            "class_type": "EmptyLatentImage",
            "inputs": {"width": 1024, "height": 1024, "batch_size": 1}
        },
        "6": {
            "class_type": "KSampler",
            "inputs": {
                "model": ["2", 0], "positive": ["3", 0],
                "negative": ["4", 0], "latent_image": ["5", 0],
                "seed": seed, "steps": 30, "cfg": 7.0,
                "sampler_name": "euler_ancestral",
                "scheduler": "normal", "denoise": 1.0
            }
        },
        "7": {
            "class_type": "VAEDecode",
            "inputs": {"samples": ["6", 0], "vae": ["1", 2]}
        },
        "8": {
            "class_type": "SaveImage",
            "inputs": {"images": ["7", 0], "filename_prefix": "pipeline"}
        }
    }


def remove_background(img_bytes: bytes) -> Image.Image:
    """Remove background using rembg, return RGBA PIL Image."""
    result_bytes = remove(img_bytes)
    return Image.open(io.BytesIO(result_bytes)).convert("RGBA")


def downscale(img: Image.Image, target_size: int) -> Image.Image:
    """Downscale to target_size x target_size using nearest-neighbor."""
    return img.resize((target_size, target_size), Image.Resampling.NEAREST)


def trim_transparent(img: Image.Image, padding: int = 4) -> Image.Image:
    """Crop to bounding box of non-transparent pixels, with padding."""
    bbox = img.getbbox()
    if bbox is None:
        return img
    left, top, right, bottom = bbox
    left = max(0, left - padding)
    top = max(0, top - padding)
    right = min(img.width, right + padding)
    bottom = min(img.height, bottom + padding)
    return img.crop((left, top, right, bottom))


def make_square(img: Image.Image) -> Image.Image:
    """Pad image to a square canvas, centered."""
    size = max(img.width, img.height)
    square = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    x = (size - img.width) // 2
    y = (size - img.height) // 2
    square.paste(img, (x, y))
    return square


def main():
    parser = argparse.ArgumentParser(description="Generate a pixel art sprite")
    parser.add_argument("--prompt", required=True, help="Sprite description")
    parser.add_argument("--name", required=True, help="Output filename (no extension)")
    parser.add_argument("--category", required=True, choices=VALID_CATEGORIES,
                        help="Sprite category: characters, items, tiles, ui")
    parser.add_argument("--size", type=int, default=64, help="Game-ready pixel size (default 64)")
    parser.add_argument("--hires", type=int, default=512, help="High-res size (default 512)")
    parser.add_argument("--seed", type=int, default=42, help="Generation seed")
    parser.add_argument("--no-copy", action="store_true", help="Don't copy to src/assets")
    args = parser.parse_args()

    # Ensure output dirs exist
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    hires_cat_dir = HIRES_DIR / args.category
    sprites_cat_dir = SPRITES_DIR / args.category
    hires_cat_dir.mkdir(parents=True, exist_ok=True)
    sprites_cat_dir.mkdir(parents=True, exist_ok=True)

    print(f"{'=' * 60}")
    print(f"  Sprite: {args.name}")
    print(f"  Category: {args.category}")
    print(f"  Prompt: {args.prompt}")
    print(f"  Hi-res: {args.hires}x{args.hires}  |  Game: {args.size}x{args.size}")
    print(f"{'=' * 60}")

    # Step 1: Generate via ComfyUI
    print("  [1/5] Generating with SDXL + pixel-art-xl LoRA...")
    workflow = build_sdxl_workflow(args.prompt, seed=args.seed)
    prompt_id = queue_prompt(workflow)
    result = wait_for_completion(prompt_id, timeout=180)

    # Get the image
    img_bytes = None
    for node_output in result.get("outputs", {}).values():
        if "images" in node_output:
            img_info = node_output["images"][0]
            img_bytes = download_image(img_info["filename"], img_info.get("subfolder", ""))
            break

    if img_bytes is None:
        print("  ERROR: No image generated")
        return

    # Save raw to output dir
    raw_path = OUTPUT_DIR / f"{args.name}_raw.png"
    raw_path.write_bytes(img_bytes)
    print(f"  [1/5] Raw: {raw_path.name} ({len(img_bytes) // 1024} KB)")

    # Step 2: Remove background
    print("  [2/5] Removing background...")
    rgba_img = remove_background(img_bytes)

    # Step 3: Trim and square
    print("  [3/5] Trimming and centering...")
    trimmed = trim_transparent(rgba_img)
    squared = make_square(trimmed)

    # Step 4: High-res version (512x512)
    print(f"  [4/5] Scaling to {args.hires}x{args.hires} (hi-res)...")
    hires = downscale(squared, args.hires)
    hires_out = OUTPUT_DIR / f"{args.name}_{args.hires}.png"
    hires.save(hires_out)
    print(f"         Saved: {hires_out.name}")

    # Step 5: Game-ready version
    print(f"  [5/5] Scaling to {args.size}x{args.size} (game-ready)...")
    game_ready = downscale(squared, args.size)
    game_out = OUTPUT_DIR / f"{args.name}_{args.size}.png"
    game_ready.save(game_out)
    print(f"         Saved: {game_out.name}")

    # Copy to project assets
    if not args.no_copy:
        hires_asset = hires_cat_dir / f"{args.name}.png"
        game_asset = sprites_cat_dir / f"{args.name}.png"
        hires.save(hires_asset)
        game_ready.save(game_asset)
        print(f"\n  Assets written:")
        print(f"    Hi-res:     src/assets/sprites-hires/{args.category}/{args.name}.png")
        print(f"    Game-ready: src/assets/sprites/{args.category}/{args.name}.png")

    print(f"\n{'=' * 60}")
    print(f"  Done! Working files in: sprite-gen/output/")
    print(f"{'=' * 60}")


if __name__ == "__main__":
    main()
