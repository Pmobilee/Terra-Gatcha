#!/usr/bin/env python3
"""
Terra Miner — Fact Art Batch Generator
Reads queued facts from facts.db, generates pixel art via ComfyUI, post-processes
each image (rembg + downscale), saves to src/assets/sprites/facts/<id>.png,
and updates pixel_art_status to 'review' (pass) or 'failed' (error).

GPU constraint: sequential generation (one at a time on RTX 3060).
Checkpoint file: sprite-gen/scripts/fact_gen_state.json tracks completed/failed IDs.

Usage:
    python fact_batch_generate.py [--limit 100] [--skip-qc]
"""

import io
import json
import os
import sqlite3
import sys
import time
from pathlib import Path

SCRIPT_DIR   = Path(__file__).parent
PROJECT_DIR  = SCRIPT_DIR.parent.parent
FACTS_DB     = PROJECT_DIR / "server" / "data" / "facts.db"
OUTPUT_DIR   = SCRIPT_DIR.parent / "output" / "facts"
SPRITES_DIR  = PROJECT_DIR / "src" / "assets" / "sprites" / "facts"
HIRES_DIR    = PROJECT_DIR / "src" / "assets" / "sprites-hires" / "facts"
STATE_FILE   = SCRIPT_DIR / "fact_gen_state.json"

GAME_SIZE  = 64
HIRES_SIZE = 256

# ComfyUI generation parameters
SDXL_STEPS   = 30
SDXL_CFG     = 7.0
SDXL_SAMPLER = "euler_ancestral"

PROMPT_PREFIX = (
    "pixel art, 8-bit, game illustration, retro video game art style, "
    "clean pixel outlines, limited color palette, "
)
PROMPT_SUFFIX = (
    ", dark space background gradient, centered subject, "
    "transparent friendly, clean pixel art, no text, no ui"
)
NEGATIVE = (
    "3d render, realistic, photograph, blurry, watermark, text, ui, labels, "
    "numbers, multiple subjects, complex background, white background, "
    "photorealistic, gradient noise, low quality, deformed, extra limbs"
)

# ── Import shared helpers from generate_sprite.py ─────────────────────────────

sys.path.insert(0, str(SCRIPT_DIR))
from generate_sprite import (
    queue_prompt,
    wait_for_completion,
    download_image,
    remove_background,
    trim_transparent,
    make_square,
    downscale,
    COMFYUI_URL,
)
from PIL import Image


def build_fact_workflow(prompt: str, seed: int) -> dict:
    """Build a ComfyUI SDXL workflow node graph for a single fact sprite."""
    full_prompt = PROMPT_PREFIX + prompt + PROMPT_SUFFIX
    return {
        "1": {
            "class_type": "CheckpointLoaderSimple",
            "inputs": {"ckpt_name": "sd_xl_base_1.0.safetensors"},
        },
        "2": {
            "class_type": "LoraLoader",
            "inputs": {
                "model": ["1", 0],
                "clip": ["1", 1],
                "lora_name": "pixel-art-xl.safetensors",
                "strength_model": 0.85,
                "strength_clip": 0.85,
            },
        },
        "3": {
            "class_type": "CLIPTextEncode",
            "inputs": {"text": full_prompt, "clip": ["2", 1]},
        },
        "4": {
            "class_type": "CLIPTextEncode",
            "inputs": {"text": NEGATIVE, "clip": ["2", 1]},
        },
        "5": {
            "class_type": "EmptyLatentImage",
            "inputs": {"width": 1024, "height": 1024, "batch_size": 1},
        },
        "6": {
            "class_type": "KSampler",
            "inputs": {
                "model": ["2", 0],
                "positive": ["3", 0],
                "negative": ["4", 0],
                "latent_image": ["5", 0],
                "seed": seed,
                "steps": SDXL_STEPS,
                "cfg": SDXL_CFG,
                "sampler_name": SDXL_SAMPLER,
                "scheduler": "normal",
                "denoise": 1.0,
            },
        },
        "7": {
            "class_type": "VAEDecode",
            "inputs": {"samples": ["6", 0], "vae": ["1", 2]},
        },
        "8": {
            "class_type": "SaveImage",
            "inputs": {"images": ["7", 0], "filename_prefix": f"fact_{seed}"},
        },
    }


def load_state() -> dict:
    """Load checkpoint state: {completed: [...], failed: [...]}."""
    if STATE_FILE.exists():
        try:
            return json.loads(STATE_FILE.read_text())
        except Exception:
            pass
    return {"completed": [], "failed": [], "retry_counts": {}, "total_processed": 0}


def save_state(state: dict) -> None:
    """Persist checkpoint state atomically."""
    import datetime
    state["last_run"] = datetime.datetime.utcnow().isoformat() + "Z"
    STATE_FILE.write_text(json.dumps(state, indent=2))


def stable_seed(fact_id: str) -> int:
    """Deterministic seed derived from fact ID so the same fact always uses the same seed.
    This ensures regeneration produces visually similar (not identical) results."""
    return abs(hash(fact_id)) % (2 ** 31)


def generate_one(fact: dict) -> bool:
    """
    Generate, post-process, and save a single fact sprite.
    Returns True on success, False on any error.
    """
    fid    = fact["id"]
    prompt = fact["image_prompt"]
    seed   = stable_seed(fid)

    raw_out   = OUTPUT_DIR / f"{fid}_raw.png"
    rembg_out = OUTPUT_DIR / f"{fid}_rembg.png"

    print(f"  [GEN]   Queuing ComfyUI job (seed={seed})...")
    workflow   = build_fact_workflow(prompt, seed)
    prompt_id  = queue_prompt(workflow)
    result     = wait_for_completion(prompt_id, timeout=300)

    img_bytes = None
    for node_out in result.get("outputs", {}).values():
        if "images" in node_out:
            info      = node_out["images"][0]
            img_bytes = download_image(info["filename"], info.get("subfolder", ""))
            break

    if img_bytes is None:
        print(f"  [ERR]   No image returned from ComfyUI")
        return False

    raw_out.write_bytes(img_bytes)
    print(f"  [REMBG] Removing background...")
    rgba    = remove_background(img_bytes)
    trimmed = trim_transparent(rgba)
    squared = make_square(trimmed)

    # Save intermediate rembg PNG
    squared.save(str(rembg_out))

    # Hi-res: 256×256 nearest-neighbor
    hires      = downscale(squared, HIRES_SIZE)
    hires_path = HIRES_DIR / f"{fid}.png"
    hires.save(str(hires_path))

    # Game-ready: 64×64 nearest-neighbor
    game      = downscale(squared, GAME_SIZE)
    game_path = SPRITES_DIR / f"{fid}.png"
    game.save(str(game_path))

    print(f"  [SAVE]  {game_path.relative_to(PROJECT_DIR)}  &  {hires_path.relative_to(PROJECT_DIR)}")
    return True


def main() -> None:
    import argparse
    parser = argparse.ArgumentParser(description="Batch generate fact pixel art via ComfyUI")
    parser.add_argument("--limit", type=int, default=200,
                        help="Max facts to process (default 200)")
    parser.add_argument("--reset", action="store_true",
                        help="Clear checkpoint state and start fresh (does not reset DB status)")
    parser.add_argument("--db", default=str(FACTS_DB))
    args = parser.parse_args()

    if args.reset and STATE_FILE.exists():
        STATE_FILE.unlink()
        print("  Checkpoint state cleared.\n")

    for d in [OUTPUT_DIR, SPRITES_DIR, HIRES_DIR]:
        d.mkdir(parents=True, exist_ok=True)

    state = load_state()
    already_done = set(state.get("completed", [])) | set(state.get("permanent_failures", []))

    conn = sqlite3.connect(args.db)
    conn.row_factory = sqlite3.Row
    cur  = conn.cursor()

    rows = cur.execute("""
        SELECT id, image_prompt
        FROM   facts
        WHERE  status = 'approved'
          AND  type = 'fact'
          AND  pixel_art_status IN ('queued', 'failed')
          AND  image_prompt IS NOT NULL
        ORDER  BY fun_score DESC
        LIMIT  ?
    """, (args.limit,)).fetchall()

    candidates = [dict(r) for r in rows if r["id"] not in already_done]
    total = len(candidates)
    print(f"Terra Miner — Fact Art Batch Generator")
    print(f"Queue: {total} facts  |  State: {len(state.get('completed', []))} done\n")

    for i, fact in enumerate(candidates, start=1):
        fid = fact["id"]
        print(f"\n[{i}/{total}] {fid}")
        print(f"  Prompt: {fact['image_prompt'][:80]}...")

        try:
            success = generate_one(fact)
        except Exception as exc:
            print(f"  [ERR]   Unexpected: {type(exc).__name__}: {exc}")
            success = False

        new_status = "review" if success else "failed"
        cur.execute("""
            UPDATE facts
            SET    pixel_art_status = ?,
                   has_pixel_art    = ?,
                   updated_at       = (unixepoch() * 1000)
            WHERE  id = ?
        """, (new_status, 1 if success else 0, fid))
        conn.commit()

        if success:
            state.setdefault("completed", []).append(fid)
        else:
            state.setdefault("failed", []).append(fid)
            state.setdefault("retry_counts", {})[fid] = \
                state["retry_counts"].get(fid, 0) + 1
            if state["retry_counts"][fid] >= 3:
                state.setdefault("permanent_failures", []).append(fid)
                state["failed"].remove(fid)

        state["total_processed"] = state.get("total_processed", 0) + 1
        save_state(state)
        print(f"  Status: {new_status.upper()}")

    conn.close()

    done_count   = sum(1 for f in candidates if f["id"] in set(state.get("completed", [])))
    failed_count = sum(1 for f in candidates if f["id"] in set(state.get("failed", [])))
    print(f"\n{'='*60}")
    print(f"  Batch complete: {done_count} generated, {failed_count} failed.")
    if failed_count:
        print(f"  Re-run to retry failed facts (they are re-queued automatically).")
        sys.exit(1)


if __name__ == "__main__":
    main()
