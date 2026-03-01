import type { SpriteResolution } from '../ui/stores/settings';

// Low-res sprite URLs (32px)
const lowResSprites = import.meta.glob<string>(
  '../assets/sprites/**/*.png',
  { eager: true, query: '?url', import: 'default' }
);

// High-res sprite URLs (256px)
const highResSprites = import.meta.glob<string>(
  '../assets/sprites-hires/**/*.png',
  { eager: true, query: '?url', import: 'default' }
);

/**
 * Get sprite URLs for the specified resolution.
 * Extracts sprite keys from filenames and returns a mapping of key → URL.
 * @param resolution - The desired sprite resolution ('low' or 'high')
 * @returns A record mapping sprite keys to their URL strings
 */
export function getSpriteUrls(resolution: SpriteResolution): Record<string, string> {
  const spriteMap = resolution === 'high' ? highResSprites : lowResSprites;
  const result: Record<string, string> = {};

  for (const [path, url] of Object.entries(spriteMap)) {
    // Extract filename without extension
    // e.g., '../assets/sprites/tiles/tile_dirt.png' → 'tile_dirt'
    const filename = path.split('/').pop() || '';
    const spriteKey = filename.replace(/\.png$/, '');
    result[spriteKey] = url;
  }

  return result;
}
