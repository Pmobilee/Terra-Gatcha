#!/usr/bin/env python3
"""Test SDXL + pixel-art-xl LoRA sprite generation."""

import json
import urllib.request
import urllib.parse
import time
from pathlib import Path

COMFYUI_URL = "http://localhost:8188"
OUTPUT_DIR = Path(__file__).parent.parent / "output"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)


def queue_prompt(workflow: dict) -> str:
    data = json.dumps({"prompt": workflow}).encode("utf-8")
    req = urllib.request.Request(
        f"{COMFYUI_URL}/prompt", data=data,
        headers={"Content-Type": "application/json"},
    )
    return json.loads(urllib.request.urlopen(req).read())["prompt_id"]


def wait_for_completion(prompt_id: str, timeout: int = 300) -> dict:
    start = time.time()
    while time.time() - start < timeout:
        resp = urllib.request.urlopen(f"{COMFYUI_URL}/history/{prompt_id}")
        history = json.loads(resp.read())
        if prompt_id in history:
            return history[prompt_id]
        time.sleep(2)
    raise TimeoutError(f"Timeout waiting for {prompt_id}")


def download_image(filename: str, subfolder: str, output_path: Path):
    params = urllib.parse.urlencode({"filename": filename, "subfolder": subfolder, "type": "output"})
    resp = urllib.request.urlopen(f"{COMFYUI_URL}/view?{params}")
    output_path.write_bytes(resp.read())
    print(f"  Saved: {output_path.name} ({output_path.stat().st_size / 1024:.1f} KB)")


def build_sdxl_lora_workflow(prompt: str, negative: str, seed: int = 42) -> dict:
    """SDXL + pixel-art-xl LoRA workflow at 1024x1024."""
    return {
        "1": {
            "class_type": "CheckpointLoaderSimple",
            "inputs": {"ckpt_name": "sd_xl_base_1.0.safetensors"}
        },
        "2": {
            "class_type": "LoraLoader",
            "inputs": {
                "model": ["1", 0],
                "clip": ["1", 1],
                "lora_name": "pixel-art-xl.safetensors",
                "strength_model": 0.9,
                "strength_clip": 0.9
            }
        },
        "3": {
            "class_type": "CLIPTextEncode",
            "inputs": {"text": prompt, "clip": ["2", 1]}
        },
        "4": {
            "class_type": "CLIPTextEncode",
            "inputs": {"text": negative, "clip": ["2", 1]}
        },
        "5": {
            "class_type": "EmptyLatentImage",
            "inputs": {"width": 1024, "height": 1024, "batch_size": 1}
        },
        "6": {
            "class_type": "KSampler",
            "inputs": {
                "model": ["2", 0],
                "positive": ["3", 0],
                "negative": ["4", 0],
                "latent_image": ["5", 0],
                "seed": seed,
                "steps": 30,
                "cfg": 7.0,
                "sampler_name": "euler_ancestral",
                "scheduler": "normal",
                "denoise": 1.0
            }
        },
        "7": {
            "class_type": "VAEDecode",
            "inputs": {"samples": ["6", 0], "vae": ["1", 2]}
        },
        "8": {
            "class_type": "SaveImage",
            "inputs": {"images": ["7", 0], "filename_prefix": "test_sdxl_pixelart"}
        }
    }


def main():
    print("SDXL + pixel-art-xl LoRA Test")
    print("=" * 50)

    prompts = [
        ("pixel art, game sprite, miner character with pickaxe and hard hat, side view, full body, transparent background, centered, retro game style, 16-bit",
         "miner_character"),
        ("pixel art, game item icon, glowing crystal mineral, transparent background, centered, simple, retro game style",
         "mineral_crystal"),
        ("pixel art, game item icon, ancient relic artifact, golden, mysterious, transparent background, centered, retro game style",
         "relic_artifact"),
    ]
    negative = "3d render, realistic, photograph, blurry, watermark, text, signature, low quality, deformed, complex background"

    for prompt, name in prompts:
        print(f"\nGenerating: {name}...")
        workflow = build_sdxl_lora_workflow(prompt, negative, seed=42)
        try:
            prompt_id = queue_prompt(workflow)
            print(f"  Queued: {prompt_id}")
            result = wait_for_completion(prompt_id, timeout=180)
            for node_id, node_output in result.get("outputs", {}).items():
                if "images" in node_output:
                    for img in node_output["images"]:
                        out_path = OUTPUT_DIR / f"sdxl_{name}_{img['filename']}"
                        download_image(img["filename"], img.get("subfolder", ""), out_path)
        except Exception as e:
            print(f"  ERROR: {e}")

    print(f"\nAll outputs in: {OUTPUT_DIR}")


if __name__ == "__main__":
    main()
