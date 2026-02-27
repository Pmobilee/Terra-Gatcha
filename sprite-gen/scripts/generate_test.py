#!/usr/bin/env python3
"""
Test sprite generation via ComfyUI API.
Generates a pixel art miner character at multiple resolutions to determine
the best target resolution for the game.
"""

import json
import urllib.request
import urllib.parse
import time
import sys
import os
from pathlib import Path

COMFYUI_URL = "http://localhost:8188"
OUTPUT_DIR = Path(__file__).parent.parent / "output"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

def queue_prompt(workflow: dict) -> str:
    """Submit a workflow to ComfyUI and return the prompt_id."""
    data = json.dumps({"prompt": workflow}).encode("utf-8")
    req = urllib.request.Request(
        f"{COMFYUI_URL}/prompt",
        data=data,
        headers={"Content-Type": "application/json"},
    )
    resp = urllib.request.urlopen(req)
    result = json.loads(resp.read())
    return result["prompt_id"]


def wait_for_completion(prompt_id: str, timeout: int = 300) -> dict:
    """Poll ComfyUI until the prompt completes."""
    start = time.time()
    while time.time() - start < timeout:
        resp = urllib.request.urlopen(f"{COMFYUI_URL}/history/{prompt_id}")
        history = json.loads(resp.read())
        if prompt_id in history:
            return history[prompt_id]
        time.sleep(2)
    raise TimeoutError(f"Prompt {prompt_id} did not complete within {timeout}s")


def download_image(filename: str, subfolder: str, output_path: Path):
    """Download a generated image from ComfyUI."""
    params = urllib.parse.urlencode({"filename": filename, "subfolder": subfolder, "type": "output"})
    resp = urllib.request.urlopen(f"{COMFYUI_URL}/view?{params}")
    output_path.write_bytes(resp.read())
    print(f"  Saved: {output_path} ({output_path.stat().st_size / 1024:.1f} KB)")


def build_workflow(prompt: str, negative: str, width: int, height: int, seed: int = 42) -> dict:
    """Build a simple txt2img workflow for SD 1.5."""
    return {
        "1": {
            "class_type": "CheckpointLoaderSimple",
            "inputs": {
                "ckpt_name": "v1-5-pruned-emaonly.safetensors"
            }
        },
        "2": {
            "class_type": "CLIPTextEncode",
            "inputs": {
                "text": prompt,
                "clip": ["1", 1]
            }
        },
        "3": {
            "class_type": "CLIPTextEncode",
            "inputs": {
                "text": negative,
                "clip": ["1", 1]
            }
        },
        "4": {
            "class_type": "EmptyLatentImage",
            "inputs": {
                "width": width,
                "height": height,
                "batch_size": 1
            }
        },
        "5": {
            "class_type": "KSampler",
            "inputs": {
                "model": ["1", 0],
                "positive": ["2", 0],
                "negative": ["3", 0],
                "latent_image": ["4", 0],
                "seed": seed,
                "steps": 25,
                "cfg": 7.5,
                "sampler_name": "euler_ancestral",
                "scheduler": "normal",
                "denoise": 1.0
            }
        },
        "6": {
            "class_type": "VAEDecode",
            "inputs": {
                "samples": ["5", 0],
                "vae": ["1", 2]
            }
        },
        "7": {
            "class_type": "SaveImage",
            "inputs": {
                "images": ["6", 0],
                "filename_prefix": f"test_{width}x{height}"
            }
        }
    }


def main():
    print("=" * 60)
    print("Terra Miner — Sprite Generation Test")
    print("=" * 60)

    prompt = "pixel art, game sprite, miner character, side view, holding pickaxe, hard hat, simple design, 2D, retro game style, transparent background, centered, clean edges"
    negative = "3d render, realistic, photograph, blurry, watermark, text, signature, low quality, deformed, complex background, gradient background"

    # Test with SD 1.5 at 512x512 (native resolution)
    test_configs = [
        (512, 512, "SD 1.5 native resolution"),
    ]

    for width, height, label in test_configs:
        print(f"\nGenerating: {label} ({width}x{height})...")
        workflow = build_workflow(prompt, negative, width, height)

        try:
            prompt_id = queue_prompt(workflow)
            print(f"  Queued: {prompt_id}")

            result = wait_for_completion(prompt_id, timeout=120)

            # Find output images
            outputs = result.get("outputs", {})
            for node_id, node_output in outputs.items():
                if "images" in node_output:
                    for img in node_output["images"]:
                        out_path = OUTPUT_DIR / f"test_{width}x{height}_{img['filename']}"
                        download_image(img["filename"], img.get("subfolder", ""), out_path)

            print(f"  Done!")

        except Exception as e:
            print(f"  ERROR: {e}")

    print("\n" + "=" * 60)
    print(f"All outputs saved to: {OUTPUT_DIR}")
    print("=" * 60)


if __name__ == "__main__":
    main()
