import { chromium } from 'playwright';

const BASE_URL = 'https://felipe.genie.namastex.io';
const SCREENSHOTS_DIR = '/home/genie/prod/paperclip/.genie/wishes/upstream-pr-strategy/screenshots';

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();

  // Listen for console messages
  page.on('console', msg => console.log('PAGE LOG:', msg.type(), msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.message));

  try {
    console.log('Navigating to login...');
    await page.goto(`${BASE_URL}/auth/login`, { waitUntil: 'load', timeout: 30000 });
    console.log('Page loaded, waiting for content...');
    await delay(5000);

    // Dump the page HTML
    const html = await page.content();
    console.log('\n--- Page HTML (first 3000 chars) ---');
    console.log(html.substring(0, 3000));
    console.log('\n--- End HTML ---\n');

    // Check for any visible elements
    const bodyText = await page.evaluate(() => document.body.innerText);
    console.log('Body text:', bodyText.substring(0, 500));

    // List all input elements
    const inputs = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('input')).map(i => ({
        type: i.type,
        name: i.name,
        id: i.id,
        placeholder: i.placeholder,
        visible: i.offsetParent !== null
      }));
    });
    console.log('Inputs found:', JSON.stringify(inputs, null, 2));

    // List all buttons
    const buttons = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('button, a[role="button"]')).map(b => ({
        text: b.textContent?.trim().substring(0, 50),
        type: b.type,
        visible: b.offsetParent !== null
      }));
    });
    console.log('Buttons found:', JSON.stringify(buttons, null, 2));

    // Try waiting for specific elements
    try {
      await page.waitForSelector('input, form, [class*="auth"], [class*="login"]', { timeout: 10000 });
      console.log('Found auth elements after waiting');
    } catch {
      console.log('No auth elements found after 10s wait');
    }

    // Take screenshot after extended wait
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/debug-login.png`, fullPage: false });
    console.log('Debug screenshot saved');

    // Check if there's a redirect happening
    console.log('Final URL:', page.url());

    // Also try the root URL
    console.log('\nTrying root URL...');
    await page.goto(BASE_URL, { waitUntil: 'load', timeout: 30000 });
    await delay(5000);
    console.log('Root URL:', page.url());
    const rootText = await page.evaluate(() => document.body.innerText);
    console.log('Root body text:', rootText.substring(0, 500));
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/debug-root.png`, fullPage: false });

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await browser.close();
  }
}

main().catch(console.error);
