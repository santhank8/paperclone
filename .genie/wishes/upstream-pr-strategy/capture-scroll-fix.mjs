import { chromium } from 'playwright';

const BASE_URL = 'https://felipe.genie.namastex.io';
const CO = 'NAM';
const DIR = '/home/genie/prod/paperclip/.genie/wishes/upstream-pr-strategy/screenshots';

const delay = (ms) => new Promise(r => setTimeout(r, ms));

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();

  try {
    // Login
    console.log('Logging in...');
    await page.goto(`${BASE_URL}/auth`, { waitUntil: 'networkidle', timeout: 30000 });
    await delay(2000);
    await page.fill('input[type="email"]', 'felipe@namastex.ai');
    await page.fill('input[type="password"]', 'screenshots123');
    await page.click('button[type="submit"]');
    await delay(5000);

    // Go to company settings
    await page.goto(`${BASE_URL}/${CO}/company/settings`, { waitUntil: 'networkidle', timeout: 15000 });
    await delay(3000);

    // Debug: find all scrollable containers
    const scrollInfo = await page.evaluate(() => {
      const containers = [];
      const allElements = document.querySelectorAll('*');
      for (const el of allElements) {
        const style = window.getComputedStyle(el);
        const isScrollable = (style.overflow === 'auto' || style.overflow === 'scroll' ||
                             style.overflowY === 'auto' || style.overflowY === 'scroll') &&
                             el.scrollHeight > el.clientHeight;
        if (isScrollable) {
          containers.push({
            tag: el.tagName,
            className: el.className?.substring(0, 80),
            scrollHeight: el.scrollHeight,
            clientHeight: el.clientHeight,
            scrollTop: el.scrollTop
          });
        }
      }
      return containers;
    });
    console.log('Scrollable containers:', JSON.stringify(scrollInfo, null, 2));

    // Find the main content area scrollable container and scroll it
    const scrolled = await page.evaluate(() => {
      // Find the main scrollable container (not the sidebar)
      const allElements = document.querySelectorAll('main, [class*="content"], [class*="Content"], [class*="page"], [class*="Page"]');
      for (const el of allElements) {
        const style = window.getComputedStyle(el);
        const isScrollable = (style.overflow === 'auto' || style.overflow === 'scroll' ||
                             style.overflowY === 'auto' || style.overflowY === 'scroll') &&
                             el.scrollHeight > el.clientHeight;
        if (isScrollable) {
          el.scrollTop = el.scrollHeight; // Scroll to bottom
          return { scrolled: true, tag: el.tagName, class: el.className?.substring(0, 80), scrollHeight: el.scrollHeight };
        }
      }
      // Try all scrollable containers
      const containers = document.querySelectorAll('*');
      for (const el of containers) {
        const style = window.getComputedStyle(el);
        const isScrollable = (style.overflow === 'auto' || style.overflow === 'scroll' ||
                             style.overflowY === 'auto' || style.overflowY === 'scroll') &&
                             el.scrollHeight > el.clientHeight &&
                             el.clientWidth > 400; // Must be the main content, not sidebar
        if (isScrollable) {
          el.scrollTop = el.scrollHeight;
          return { scrolled: true, tag: el.tagName, class: el.className?.substring(0, 80), scrollHeight: el.scrollHeight };
        }
      }
      // Fallback: scroll document
      window.scrollTo(0, document.body.scrollHeight);
      return { scrolled: false, bodyScrollHeight: document.body.scrollHeight };
    });
    console.log('Scroll result:', JSON.stringify(scrolled));
    await delay(1000);

    // Screenshot with members section visible
    await page.screenshot({ path: `${DIR}/04c-members-bottom.png`, fullPage: true });
    console.log('✓ Full page company settings saved');

    // Also take a normal viewport screenshot after scrolling
    await page.screenshot({ path: `${DIR}/04b-company-members.png` });
    console.log('✓ Viewport after scroll saved');

    // Now scroll to the invite collaborator section
    const inviteScrolled = await page.evaluate(() => {
      const containers = document.querySelectorAll('*');
      for (const el of containers) {
        const style = window.getComputedStyle(el);
        const isScrollable = (style.overflow === 'auto' || style.overflow === 'scroll' ||
                             style.overflowY === 'auto' || style.overflowY === 'scroll') &&
                             el.scrollHeight > el.clientHeight &&
                             el.clientWidth > 400;
        if (isScrollable) {
          // Scroll to where "INVITE COLLABORATOR" text would be
          const allText = el.querySelectorAll('h2, h3, h4, p, span, div');
          for (const t of allText) {
            if (t.textContent?.includes('INVITE COLLABORATOR') || t.textContent?.includes('Invite Collaborator')) {
              t.scrollIntoView({ block: 'start' });
              return { found: true, text: t.textContent?.substring(0, 50) };
            }
          }
          // Try MEMBERS
          for (const t of allText) {
            if (t.textContent?.trim() === 'MEMBERS' || t.textContent?.trim() === 'Members') {
              t.scrollIntoView({ block: 'start' });
              return { found: true, text: t.textContent?.substring(0, 50) };
            }
          }
          el.scrollTop = 600;
          return { found: false, scrolledTo: 600 };
        }
      }
      return { found: false };
    });
    console.log('Invite scroll:', JSON.stringify(inviteScrolled));
    await delay(1000);
    await page.screenshot({ path: `${DIR}/05-invite-section.png` });
    console.log('✓ Invite section saved');

    // Click Generate Invite Link
    const generateBtn = await page.$('button:has-text("Generate Invite Link")');
    if (generateBtn) {
      // First scroll it into view
      await generateBtn.scrollIntoViewIfNeeded();
      await delay(500);
      await generateBtn.click();
      await delay(2000);
      await page.screenshot({ path: `${DIR}/05c-invite-link-generated.png` });
      console.log('✓ Invite link generated');
    }

    console.log('\n✅ Done!');

  } catch (error) {
    console.error('Error:', error.message, error.stack);
  } finally {
    await browser.close();
  }
}

main().catch(console.error);
