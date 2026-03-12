/**
 * Preload image URLs using browser Image API.
 * Resolves when all images are loaded (or failed — never blocks on errors).
 */
export function preloadImages(urls: string[]): Promise<void> {
  if (urls.length === 0) return Promise.resolve()
  return Promise.all(
    urls.map(
      (url) =>
        new Promise<void>((resolve) => {
          const img = new Image()
          img.onload = () => resolve()
          img.onerror = () => resolve()
          img.src = url
        }),
    ),
  ).then(() => {})
}
