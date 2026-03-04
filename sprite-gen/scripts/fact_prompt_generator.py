#!/usr/bin/env python3
"""
Terra Miner — Fact-to-Prompt Pipeline
Reads approved facts missing visual_description, calls Claude API to generate
pixel-art image prompts, and writes results back to the facts SQLite database.

Usage:
    python fact_prompt_generator.py [--batch 50] [--dry-run]

Environment:
    ANTHROPIC_API_KEY  — Claude API key (from server/.env or shell export)
"""

import argparse
import json
import os
import sqlite3
import sys
import time
from pathlib import Path

# ── Configuration ─────────────────────────────────────────────────────────────

SCRIPT_DIR   = Path(__file__).parent
PROJECT_DIR  = SCRIPT_DIR.parent.parent
FACTS_DB     = PROJECT_DIR / "server" / "data" / "facts.db"
MODEL        = "claude-opus-4-6"
MAX_TOKENS   = 512
RATE_LIMIT_S = 0.5   # seconds between API calls to avoid 429s

SYSTEM_PROMPT = (
    "You are a pixel-art image direction specialist for an educational mobile game.\n"
    "Given a learning fact, produce a visual description and a pixel-art generation prompt.\n\n"
    "Rules:\n"
    "- The image must have ONE clear subject that visually embodies the fact.\n"
    "- Never include text, labels, numbers, UI elements, charts, or diagrams.\n"
    "- Never use abstract concepts alone — always ground them in a concrete scene or object.\n"
    "- Pixel art style: 8-bit, ≤32 colors, clean outlines, solid or gradient dark space background.\n"
    "- The image should make the fact immediately memorable on first glance.\n"
    "- Keep image_prompt under 120 tokens (comma-separated tags).\n"
    "- Return ONLY a JSON object. No markdown fences, no explanation."
)

USER_TEMPLATE = (
    "Fact: {statement}\n"
    "Explanation: {explanation}\n"
    "Category: {cat1} > {cat2}\n\n"
    "Generate the FactImageSpec JSON for this fact."
)

# ── Claude API call ────────────────────────────────────────────────────────────

def call_claude(fact: dict, api_key: str) -> dict | None:
    """Call Claude API and return parsed FactImageSpec, or None on failure."""
    import urllib.request

    user_msg = USER_TEMPLATE.format(
        statement=fact["statement"],
        explanation=fact["explanation"] or "",
        cat1=fact["category_l1"] or "General",
        cat2=fact["category_l2"] or "General",
    )

    payload = json.dumps({
        "model": MODEL,
        "max_tokens": MAX_TOKENS,
        "system": SYSTEM_PROMPT,
        "messages": [{"role": "user", "content": user_msg}],
    }).encode("utf-8")

    req = urllib.request.Request(
        "https://api.anthropic.com/v1/messages",
        data=payload,
        headers={
            "Content-Type": "application/json",
            "x-api-key": api_key,
            "anthropic-version": "2023-06-01",
        },
    )

    try:
        resp = urllib.request.urlopen(req, timeout=30)
        body = json.loads(resp.read())
        text = body["content"][0]["text"].strip()
        # Strip markdown fences if model adds them despite instructions
        if text.startswith("```"):
            text = text.split("```")[1]
            if text.startswith("json"):
                text = text[4:]
        return json.loads(text)
    except Exception as exc:
        print(f"    Claude API error: {exc}")
        return None

# ── Main ───────────────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(description="Generate image prompts for facts via Claude API")
    parser.add_argument("--batch", type=int, default=50,
                        help="Max facts to process in one run (default: 50)")
    parser.add_argument("--dry-run", action="store_true",
                        help="Print prompts but do not write to DB or call Claude")
    parser.add_argument("--db", default=str(FACTS_DB),
                        help="Path to facts.db")
    args = parser.parse_args()

    api_key = os.environ.get("ANTHROPIC_API_KEY", "")
    if not api_key and not args.dry_run:
        sys.exit("ERROR: ANTHROPIC_API_KEY not set. Export it or source server/.env.")

    db_path = Path(args.db)
    if not db_path.exists():
        sys.exit(f"ERROR: facts.db not found at {db_path}. Run the server once to create it.")

    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()

    # Fetch approved facts missing visual_description
    rows = cur.execute("""
        SELECT id, statement, explanation, category_l1, category_l2
        FROM   facts
        WHERE  status = 'approved'
          AND  type = 'fact'
          AND  (visual_description IS NULL OR visual_description = '')
          AND  pixel_art_status = 'none'
        ORDER  BY fun_score DESC, novelty_score DESC
        LIMIT  ?
    """, (args.batch,)).fetchall()

    total = len(rows)
    print(f"Terra Miner — Fact-to-Prompt Pipeline")
    print(f"Facts to process: {total}  |  Mode: {'DRY-RUN' if args.dry_run else 'LIVE'}\n")

    ok = 0
    fail = 0

    for i, row in enumerate(rows, start=1):
        fact = dict(row)
        print(f"[{i}/{total}] {fact['id'][:8]}... — {fact['statement'][:60]}")

        if args.dry_run:
            print(f"    DRY-RUN: would call Claude for prompt")
            ok += 1
            continue

        spec = call_claude(fact, api_key)
        if spec is None or "visual_description" not in spec or "image_prompt" not in spec:
            print(f"    FAIL: invalid spec returned")
            fail += 1
            continue

        # Basic validation: image_prompt must start with "pixel art"
        if not spec["image_prompt"].lower().startswith("pixel art"):
            spec["image_prompt"] = "pixel art, 8-bit, game illustration, " + spec["image_prompt"]

        cur.execute("""
            UPDATE facts
            SET    visual_description = ?,
                   image_prompt       = ?,
                   pixel_art_status   = 'queued',
                   updated_at         = (unixepoch() * 1000)
            WHERE  id = ?
        """, (spec["visual_description"], spec["image_prompt"], fact["id"]))
        conn.commit()

        print(f"    OK — prompt: {spec['image_prompt'][:80]}...")
        ok += 1
        time.sleep(RATE_LIMIT_S)

    conn.close()

    print(f"\n{'='*60}")
    print(f"  Done: {ok} OK, {fail} failed out of {total} facts.")
    if fail:
        sys.exit(1)


if __name__ == "__main__":
    main()
