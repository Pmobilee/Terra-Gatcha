#!/usr/bin/env python3
"""
Terra Miner — Fact Sprite QC Pipeline
Three-gate quality check for generated fact sprites.

Gate 1: Dimension check — must be exactly 64×64 (game) and 256×256 (hires).
Gate 2: Transparency check — >= 20% of pixels must be non-transparent (alpha > 10).
Gate 3: Perceptual hash deduplication — reject if pHash distance < 12 vs any approved sprite.

Sprites passing all gates: pixel_art_status -> 'approved'
Sprites failing any gate:  pixel_art_status -> 'queued'  (re-queue for regeneration)

Usage:
    python fact_qc.py [--batch 500] [--db path/to/facts.db]
"""

import sqlite3
import sys
from pathlib import Path
from PIL import Image

SCRIPT_DIR  = Path(__file__).parent
PROJECT_DIR = SCRIPT_DIR.parent.parent
FACTS_DB    = PROJECT_DIR / "server" / "data" / "facts.db"
SPRITES_DIR = PROJECT_DIR / "src" / "assets" / "sprites" / "facts"
HIRES_DIR   = PROJECT_DIR / "src" / "assets" / "sprites-hires" / "facts"

EXPECTED_GAME_SIZE  = 64
EXPECTED_HIRES_SIZE = 256
MIN_OPAQUE_FRACTION = 0.20   # Gate 2: at least 20% non-transparent pixels
PHASH_REJECT_DIST   = 12     # Gate 3: reject if distance < 12 (out of 64 bits)
PHASH_SIZE          = 8      # perceptual hash grid: 8×8 = 64 bits


# ── Perceptual hash (pHash) ────────────────────────────────────────────────────

def phash(img: Image.Image) -> int:
    """
    Compute a 64-bit perceptual hash via greyscale + mean threshold.
    Resize to 8×8, convert to greyscale, threshold against mean.
    Returns a 64-bit integer.
    """
    small  = img.convert("L").resize((PHASH_SIZE, PHASH_SIZE), Image.Resampling.LANCZOS)
    pixels = list(small.getdata())
    mean   = sum(pixels) / len(pixels)
    bits   = 0
    for px in pixels:
        bits = (bits << 1) | (1 if px >= mean else 0)
    return bits


def hamming_distance(a: int, b: int) -> int:
    """Count differing bits between two 64-bit integers."""
    return bin(a ^ b).count("1")


# ── QC gates ──────────────────────────────────────────────────────────────────

def gate1_dimensions(fid: str) -> tuple[bool, str]:
    """Gate 1: both game (64×64) and hires (256×256) sprites must exist at expected size."""
    game_path  = SPRITES_DIR / f"{fid}.png"
    hires_path = HIRES_DIR   / f"{fid}.png"

    if not game_path.exists():
        return False, f"Missing game sprite"
    if not hires_path.exists():
        return False, f"Missing hires sprite"

    game_img  = Image.open(game_path)
    hires_img = Image.open(hires_path)

    if game_img.size != (EXPECTED_GAME_SIZE, EXPECTED_GAME_SIZE):
        return False, f"Game size {game_img.size} != (64,64)"
    if hires_img.size != (EXPECTED_HIRES_SIZE, EXPECTED_HIRES_SIZE):
        return False, f"Hires size {hires_img.size} != (256,256)"

    return True, "ok"


def gate2_transparency(fid: str) -> tuple[bool, str]:
    """Gate 2: at least 20% of pixels must be non-transparent (alpha > 10)."""
    game_path = SPRITES_DIR / f"{fid}.png"
    img       = Image.open(game_path).convert("RGBA")
    pixels    = list(img.getdata())
    total     = len(pixels)
    opaque    = sum(1 for _, _, _, a in pixels if a > 10)
    fraction  = opaque / total

    if fraction < MIN_OPAQUE_FRACTION:
        return False, f"Only {fraction:.1%} opaque pixels (min {MIN_OPAQUE_FRACTION:.0%})"
    return True, f"{fraction:.1%} opaque"


def gate3_dedup(fid: str, approved_hashes: list[int]) -> tuple[bool, str]:
    """Gate 3: perceptual hash distance must be >= PHASH_REJECT_DIST vs all approved sprites."""
    game_path = SPRITES_DIR / f"{fid}.png"
    img       = Image.open(game_path)
    h         = phash(img)

    min_dist = 64
    for existing_hash in approved_hashes:
        dist = hamming_distance(h, existing_hash)
        if dist < min_dist:
            min_dist = dist
        if dist < PHASH_REJECT_DIST:
            return False, f"Too similar to existing approved sprite (distance={dist})"

    return True, f"Unique (min_dist={min_dist})"


# ── Main ───────────────────────────────────────────────────────────────────────

def main() -> None:
    import argparse
    parser = argparse.ArgumentParser(description="QC check fact sprites")
    parser.add_argument("--batch", type=int, default=500)
    parser.add_argument("--db", default=str(FACTS_DB))
    args = parser.parse_args()

    conn = sqlite3.connect(args.db)
    conn.row_factory = sqlite3.Row
    cur  = conn.cursor()

    # Pre-load pHashes of all currently approved sprites
    approved_ids = [r["id"] for r in cur.execute(
        "SELECT id FROM facts WHERE pixel_art_status = 'approved' AND has_pixel_art = 1"
    ).fetchall()]

    approved_hashes: list[int] = []
    for aid in approved_ids:
        p = SPRITES_DIR / f"{aid}.png"
        if p.exists():
            try:
                approved_hashes.append(phash(Image.open(p)))
            except Exception:
                pass

    # Fetch review-status sprites to check
    rows = cur.execute("""
        SELECT id FROM facts
        WHERE  pixel_art_status = 'review'
        LIMIT  ?
    """, (args.batch,)).fetchall()

    total = len(rows)
    print(f"Terra Miner — Fact Sprite QC")
    print(f"Reviewing: {total}  |  Approved pool: {len(approved_hashes)} hashes\n")

    passed = 0
    failed = 0

    for row in rows:
        fid = row["id"]
        reasons = []

        ok1, msg1 = gate1_dimensions(fid)
        if not ok1: reasons.append(f"G1:{msg1}")

        ok2, msg2 = (True, "") if reasons else gate2_transparency(fid)
        if not ok2: reasons.append(f"G2:{msg2}")

        ok3, msg3 = (True, "") if reasons else gate3_dedup(fid, approved_hashes)
        if not ok3: reasons.append(f"G3:{msg3}")

        if not reasons:
            new_status = "approved"
            # Add to pool for subsequent comparisons in this batch
            try:
                approved_hashes.append(phash(Image.open(SPRITES_DIR / f"{fid}.png")))
            except Exception:
                pass
            passed += 1
            print(f"  PASS  {fid}  ({msg2}, {msg3})")
        else:
            # Re-queue for regeneration with a new seed
            new_status = "queued"
            failed += 1
            print(f"  FAIL  {fid}  — {'; '.join(reasons)}")

        cur.execute("""
            UPDATE facts
            SET    pixel_art_status = ?,
                   has_pixel_art    = ?,
                   updated_at       = (unixepoch() * 1000)
            WHERE  id = ?
        """, (new_status, 1 if new_status == "approved" else 0, fid))

    conn.commit()
    conn.close()

    print(f"\n{'='*60}")
    print(f"  QC complete: {passed} approved, {failed} re-queued out of {total}.")
    if failed:
        print(f"  Re-run fact_batch_generate.py to regenerate failed sprites.")


if __name__ == "__main__":
    main()
