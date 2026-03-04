#!/usr/bin/env npx tsx
/**
 * Smoke test: hits every mounted route with minimal requests.
 * Run: SERVER_URL=http://localhost:3001 npx tsx server/scripts/smoke-test.ts
 * Or: npm run smoke-test --prefix server
 */

const BASE = process.env['SERVER_URL'] ?? 'http://localhost:3001'
const ADMIN = process.env['ADMIN_API_KEY'] ?? 'dev-admin-key-change-me'
let passed = 0
let failed = 0

async function check(
  label: string,
  url: string,
  opts: RequestInit = {},
  expected = 200
): Promise<void> {
  try {
    const res = await fetch(`${BASE}${url}`, opts)
    if (res.status === expected) {
      console.log(`  PASS  [${res.status}] ${label}`)
      passed++
    } else {
      console.error(`  FAIL  [${res.status}] ${label} (expected ${expected})`)
      failed++
    }
  } catch (err) {
    console.error(`  FAIL  ${label} — ${(err as Error).message}`)
    failed++
  }
}

const J: Record<string, string> = { 'Content-Type': 'application/json' }
const A: Record<string, string> = { ...J, 'X-Admin-Key': ADMIN }

;(async () => {
  console.log(`\nSmoke test → ${BASE}\n`)

  await check('GET /api/health',                     '/api/health')
  await check('GET /api/health/ready',               '/api/health/ready', {}, 200)

  await check('GET /api/facts',                      '/api/facts?limit=5')
  await check('GET /api/facts/packs',                '/api/facts/packs')
  await check('GET /api/leaderboards',               '/api/leaderboards')
  await check('GET /api/subscriptions/status',       '/api/subscriptions/status')
  await check('GET /api/patrons/wall',               '/api/patrons/wall')
  await check('GET /api/season-pass/current',        '/api/season-pass/current')
  await check('GET /api/notifications/preferences',  '/api/notifications/preferences')

  await check(
    'POST /api/auth/register (empty)',
    '/api/auth/register',
    { method: 'POST', headers: J, body: '{}' },
    400
  )
  await check(
    'POST /api/iap/verify (empty)',
    '/api/iap/verify',
    { method: 'POST', headers: J, body: '{}' },
    400
  )
  await check(
    'POST /api/iap/webhook (no auth)',
    '/api/iap/webhook',
    { method: 'POST', headers: J, body: '{}' },
    401
  )
  await check(
    'POST /api/ugc/submit (empty)',
    '/api/ugc/submit',
    { method: 'POST', headers: J, body: '{}' },
    400
  )

  await check(
    'GET /api/audio/:nonexistent',
    '/api/audio/no_such_fact_xyz',
    {},
    404
  )
  await check(
    'GET /api/email/unsubscribe (no tok)',
    '/api/email/unsubscribe',
    {},
    400
  )

  await check(
    'POST /api/notifications/send-test (no auth)',
    '/api/notifications/send-test',
    { method: 'POST', headers: J, body: '{}' },
    403
  )
  await check(
    'POST /api/audio/generate (no auth)',
    '/api/audio/generate',
    { method: 'POST', headers: J, body: '{}' },
    403
  )

  // Admin endpoints (should respond, not 404)
  await check(
    'POST /api/notifications/send-test (admin, missing token)',
    '/api/notifications/send-test',
    { method: 'POST', headers: A, body: JSON.stringify({}) },
    400
  )

  await check(
    'GET /api/does-not-exist (404)',
    '/api/does-not-exist',
    {},
    404
  )

  console.log(`\nResults: ${passed} passed, ${failed} failed\n`)
  process.exit(failed > 0 ? 1 : 0)
})()
