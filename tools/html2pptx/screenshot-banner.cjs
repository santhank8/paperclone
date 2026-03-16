const { chromium } = require('playwright');
const path = require('path');

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: 2560, height: 1440 },
    deviceScaleFactor: 1
  });

  await page.goto('file://' + path.resolve('youtube-banner.html'));
  await page.waitForTimeout(500);

  await page.screenshot({
    path: 'youtube-banner.png',
    fullPage: false,
    type: 'png'
  });

  await browser.close();
  console.log('Saved youtube-banner.png (2560x1440)');
}

main().catch(err => { console.error(err); process.exit(1); });
