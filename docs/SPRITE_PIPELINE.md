# Sprite Generation Pipeline — Terra Miner

How pixel art sprites are generated using ComfyUI with Stable Diffusion, running on a local RTX 3060 12GB.

## Setup
- **ComfyUI**: Installed at `/opt/ComfyUI`
- **Python venv**: `/opt/comfyui-env`
- **Models**:
  - Base: `sd_xl_base_1.0.safetensors` (SDXL, 6.5GB) at `/opt/ComfyUI/models/checkpoints/`
  - Fallback: `v1-5-pruned-emaonly.safetensors` (SD 1.5, 4GB) at `/opt/ComfyUI/models/checkpoints/`
  - LoRA: `pixel-art-xl.safetensors` (163MB) at `/opt/ComfyUI/models/loras/`

## Starting ComfyUI
```bash
cd /opt/ComfyUI
/opt/comfyui-env/bin/python main.py --listen 0.0.0.0 --port 8188
```
API available at `http://localhost:8188`

## Workflow Overview
1. **Input**: Text prompt describing the sprite needed
2. **Generation**: SDXL + pixel-art-xl LoRA generates the image
3. **Background Removal**: Alpha channel extraction for transparent backgrounds
4. **Post-processing**: Resize to target resolution, palette normalization
5. **Output**: PNG with transparency, saved to `sprite-gen/output/`
6. **Integration**: Approved sprites copied to `src/assets/sprites/`

## Prompt Templates
- **Character**: `pixel art, game sprite, [character description], transparent background, no background, centered, 2D side view`
- **Mineral/Item**: `pixel art, game item icon, [item description], transparent background, no background, centered, simple`
- **Tileset**: `pixel art, game tileset, [terrain type], seamless, top-down view`
- **UI Element**: `pixel art, game UI, [element description], clean edges, flat design`

## Negative Prompts
`3d render, realistic, photograph, blurry, watermark, text, signature, low quality, deformed`

## Resolution Strategy
- Generation resolution: 512x512 (SD 1.5) or 1024x1024 (SDXL)
- Downscaled to target: 16x16, 32x32, or 64x64 per tile
- Use nearest-neighbor scaling to preserve pixel art crispness

## Automation
Workflows stored in `sprite-gen/workflows/` as JSON files.
Scripts in `sprite-gen/scripts/` call the ComfyUI API programmatically.
Generated outputs land in `sprite-gen/output/`.

## Quality Control
- All generated sprites must be reviewed before adding to `src/assets/`
- Check for: transparent background, consistent palette, correct dimensions
- Rejected sprites are deleted, not committed
