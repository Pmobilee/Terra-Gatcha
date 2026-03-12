const playwright = require('playwright');

async function test() {
  const browser = await playwright.chromium.launch();
  const page = await browser.newPage({
    viewport: { width: 800, height: 600 }
  });
  
  // Try navigating directly with combat screen
  await page.goto('http://localhost:5173?screen=combat&skipOnboarding=true', {
    waitUntil: 'networkidle'
  });
  
  await page.waitForTimeout(2000);
  
  // Get current screen
  const debug = await page.evaluate(() => {
    return window.__terraDebug?.();
  });
  console.log('Debug info:', debug);
  
  // Check for card-front-bg elements
  const cardBgCount = await page.locator('.card-front-bg').count();
  console.log(`Found ${cardBgCount} card-front-bg elements`);
  
  // Check for cards in hand
  const cardFrontCount = await page.locator('.card-front').count();
  console.log(`Found ${cardFrontCount} card-front elements`);
  
  // Check for any data-testid starting with card-
  const allCards = page.locator('[data-testid^="card-"]');
  const cardCount = await allCards.count();
  console.log(`Found ${cardCount} elements with data-testid^="card-"`);
  
  // Take a screenshot
  await page.screenshot({ path: '/tmp/cardback-test.png', fullPage: false });
  console.log('Screenshot saved to /tmp/cardback-test.png');
  
  // If we have card-front-bg elements, check their styles
  if (cardBgCount > 0) {
    const firstBg = page.locator('.card-front-bg').first();
    const styles = await firstBg.evaluate(el => {
      const style = window.getComputedStyle(el);
      return {
        position: style.position,
        opacity: style.opacity,
        zIndex: style.zIndex,
        width: style.width,
        height: style.height,
        filter: style.filter
      };
    });
    console.log('First card-front-bg computed styles:', JSON.stringify(styles, null, 2));
  }
  
  await browser.close();
}

test().catch(console.error);
