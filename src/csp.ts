/**
 * Content Security Policy configuration per environment (DD-V2-228).
 *
 * This module provides a helper for generating environment-appropriate CSP
 * strings. In development, `unsafe-eval` and `unsafe-inline` are permitted
 * so that Vite HMR and Phaser can operate without restrictions.
 * In production, a strict policy is enforced.
 */

/**
 * Return the Content-Security-Policy `content` attribute value for the
 * current environment.
 *
 * @param isDev - True when running under the Vite dev server (HMR active).
 * @returns A CSP string suitable for use in a `<meta http-equiv>` tag.
 */
export function getCSPMeta(isDev: boolean): string {
  if (isDev) {
    // Relaxed for Vite HMR — allows eval (required by some Phaser internals)
    // and inline scripts/styles (required by @sveltejs/vite-plugin-svelte).
    return (
      "default-src 'self'; " +
      "script-src 'self' 'unsafe-eval' 'unsafe-inline'; " +
      "style-src 'self' 'unsafe-inline'; " +
      "img-src 'self' data: blob:; " +
      "connect-src 'self' ws: wss: http://localhost:* http://*:3001; " +
      "font-src 'self'"
    )
  }
  // Production: strict — no eval, no inline scripts, connections limited to
  // first-party origins and the production CDN domain.
  return (
    "default-src 'self'; " +
    "script-src 'self'; " +
    "style-src 'self' 'unsafe-inline'; " +
    "img-src 'self' data: blob:; " +
    "connect-src 'self' https://*.terragacha.com; " +
    "font-src 'self'"
  )
}
