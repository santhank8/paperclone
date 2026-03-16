const { chromium } = require('playwright');

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: 150, height: 150 },
    deviceScaleFactor: 1
  });

  const html = `
  <html>
  <body style="margin:0; padding:0; width:150px; height:150px; background:transparent; display:flex; align-items:center; justify-content:center;">
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" fill="none" width="120" height="120">
      <path d="M200 160 L200 280 L152 380 Q144 400 164 412 L348 412 Q368 400 360 380 L312 280 L312 160"
            stroke="#38bdf8" stroke-width="20" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
      <line x1="176" y1="160" x2="336" y2="160" stroke="#38bdf8" stroke-width="20" stroke-linecap="round"/>
      <path d="M192 300 L160 385 Q152 400 168 408 L344 408 Q360 400 352 385 L320 300 Z"
            fill="#38bdf8" opacity="0.2"/>
      <circle cx="240" cy="340" r="14" fill="#38bdf8" opacity="0.6"/>
      <circle cx="280" cy="310" r="10" fill="#38bdf8" opacity="0.5"/>
      <circle cx="256" cy="370" r="11" fill="#38bdf8" opacity="0.4"/>
      <circle cx="232" cy="260" r="8" fill="#38bdf8" opacity="0.5"/>
      <circle cx="268" cy="230" r="6" fill="#38bdf8" opacity="0.4"/>
      <circle cx="250" cy="200" r="5" fill="#38bdf8" opacity="0.3"/>
      <circle cx="288" cy="120" r="9" fill="#38bdf8" opacity="0.35"/>
      <circle cx="248" cy="105" r="6" fill="#38bdf8" opacity="0.25"/>
    </svg>
  </body>
  </html>`;

  await page.setContent(html);
  await page.screenshot({
    path: 'youtube-avatar.png',
    type: 'png',
    omitBackground: true
  });

  await browser.close();
  console.log('Saved youtube-avatar.png (150x150)');
}

main().catch(err => { console.error(err); process.exit(1); });
