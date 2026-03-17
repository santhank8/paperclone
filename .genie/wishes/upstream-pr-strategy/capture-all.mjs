import { chromium } from 'playwright';

const BASE_URL = 'https://felipe.genie.namastex.io';
const CO = 'NAM'; // company prefix
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
    // ──── 1. LOGIN PAGE ────
    console.log('1. Login page...');
    await page.goto(`${BASE_URL}/auth`, { waitUntil: 'networkidle', timeout: 30000 });
    await delay(3000);
    await page.screenshot({ path: `${DIR}/01-login-page.png` });
    console.log('   ✓ saved');

    // ──── LOGIN ────
    console.log('   Logging in...');
    await page.fill('input[type="email"]', 'felipe@namastex.ai');
    await page.fill('input[type="password"]', 'screenshots123');
    await page.click('button[type="submit"]');
    await delay(5000);
    console.log('   URL after login:', page.url());

    // Navigate to dashboard
    await page.goto(`${BASE_URL}/${CO}/dashboard`, { waitUntil: 'networkidle', timeout: 15000 });
    await delay(3000);
    console.log('   Dashboard URL:', page.url());

    // ──── 2. USER MENU ────
    console.log('2. User menu...');
    // Find the avatar button at bottom of sidebar
    const avatarBtn = await page.$('button:has(img[src*="avatar"])');
    if (avatarBtn) {
      await avatarBtn.click();
      await delay(1000);
    } else {
      // Try clicking the avatar image at bottom-left
      const allImgs = await page.$$('img[src*="avatar"]');
      for (const img of allImgs) {
        const parent = await img.evaluateHandle(el => el.closest('button') || el.parentElement);
        if (parent) {
          await parent.asElement()?.click();
          await delay(1000);
          break;
        }
      }
    }
    await page.screenshot({ path: `${DIR}/02-user-menu.png` });
    console.log('   ✓ saved');
    await page.keyboard.press('Escape');
    await delay(500);

    // ──── 3. ACCOUNT SETTINGS ────
    console.log('3. Account settings...');
    await page.goto(`${BASE_URL}/${CO}/account`, { waitUntil: 'networkidle', timeout: 15000 });
    await delay(3000);
    await page.screenshot({ path: `${DIR}/03-account-settings.png` });
    console.log('   ✓ saved');

    // ──── 4. COMPANY SETTINGS + MEMBERS ────
    console.log('4. Company settings + members...');
    await page.goto(`${BASE_URL}/${CO}/company/settings`, { waitUntil: 'networkidle', timeout: 15000 });
    await delay(3000);
    await page.screenshot({ path: `${DIR}/04-company-settings.png` });
    // Scroll to members section
    await page.evaluate(() => window.scrollBy(0, 800));
    await delay(1000);
    await page.screenshot({ path: `${DIR}/04b-company-members.png` });
    console.log('   ✓ saved');

    // ──── 5. INVITE FLOW ────
    console.log('5. Invite flow...');
    // Scroll to find invite button
    await page.evaluate(() => window.scrollTo(0, 0));
    await delay(500);
    // Search the whole page for invite button
    let inviteFound = false;
    for (let scrollY = 0; scrollY < 2000; scrollY += 400) {
      await page.evaluate((y) => window.scrollTo(0, y), scrollY);
      await delay(300);
      const inviteBtn = await page.$('button:has-text("Invite")');
      if (inviteBtn && await inviteBtn.isVisible()) {
        await inviteBtn.click();
        await delay(1000);
        await page.screenshot({ path: `${DIR}/05-invite-dialog.png` });
        console.log('   ✓ saved (dialog)');
        inviteFound = true;
        await page.keyboard.press('Escape');
        await delay(500);
        break;
      }
    }
    if (!inviteFound) {
      console.log('   No invite button found');
    }

    // Invite landing page
    await page.goto(`${BASE_URL}/invite/test-token-for-screenshot`, { waitUntil: 'networkidle', timeout: 15000 }).catch(() => {});
    await delay(2000);
    await page.screenshot({ path: `${DIR}/05b-invite-landing.png` });
    console.log('   ✓ invite landing saved');

    // ──── 6. @MENTION AUTOCOMPLETE ────
    console.log('6. @mention autocomplete...');
    await page.goto(`${BASE_URL}/${CO}/dashboard`, { waitUntil: 'networkidle', timeout: 15000 });
    await delay(2000);

    // Click "New Issue" in the sidebar
    const newIssue = await page.$('a:has-text("New Issue"), button:has-text("New Issue")');
    if (newIssue) {
      await newIssue.click();
    } else {
      // Try sidebar link
      await page.click('text=New Issue');
    }
    await delay(2000);

    // Find the description editor (textarea or contenteditable)
    const editors = await page.$$('textarea, [contenteditable="true"], .ProseMirror, [role="textbox"]');
    console.log(`   Found ${editors.length} editor elements`);

    // Try each editor - look for the description one (usually the second textarea)
    let mentionTriggered = false;
    for (const editor of editors) {
      const isVisible = await editor.isVisible();
      if (!isVisible) continue;

      // Check if this might be the description field
      await editor.click();
      await delay(300);
      await page.keyboard.type('@', { delay: 100 });
      await delay(2000);

      // Check if autocomplete appeared
      const autocomplete = await page.$('[class*="mention"], [class*="autocomplete"], [class*="suggestion"], [role="listbox"], [role="menu"]');
      if (autocomplete) {
        mentionTriggered = true;
        await page.screenshot({ path: `${DIR}/06-mention-autocomplete.png` });
        console.log('   ✓ saved (autocomplete visible)');
        break;
      }
    }

    if (!mentionTriggered) {
      // Take screenshot anyway - mention dropdown might use different selectors
      await page.screenshot({ path: `${DIR}/06-mention-autocomplete.png` });
      console.log('   ✓ saved (autocomplete may be visible)');
    }
    await page.keyboard.press('Escape');
    await delay(500);
    await page.keyboard.press('Escape');
    await delay(500);

    // ──── 7. INBOX WITH MENTIONS ────
    console.log('7. Inbox with mentions...');
    await page.goto(`${BASE_URL}/${CO}/inbox/recent`, { waitUntil: 'networkidle', timeout: 15000 });
    await delay(3000);
    await page.screenshot({ path: `${DIR}/07-inbox-mentions.png` });
    console.log('   ✓ saved');

    // ──── 8. COMPANY RAIL WITH USER AVATAR ────
    console.log('8. Company rail with user avatar...');
    await page.goto(`${BASE_URL}/${CO}/dashboard`, { waitUntil: 'networkidle', timeout: 15000 });
    await delay(2000);
    // Capture the sidebar/rail area
    const rail = await page.$('aside, nav, [class*="Rail"], [class*="sidebar"]');
    if (rail) {
      await rail.screenshot({ path: `${DIR}/08-company-rail-avatar.png` });
      console.log('   ✓ saved (rail element)');
    } else {
      await page.screenshot({ path: `${DIR}/08-company-rail-avatar.png`, clip: { x: 0, y: 0, width: 350, height: 900 } });
      console.log('   ✓ saved (left clip)');
    }

    // ──── 9. COMPANY LOGO ────
    console.log('9. Company logo in settings...');
    await page.goto(`${BASE_URL}/${CO}/company/settings`, { waitUntil: 'networkidle', timeout: 15000 });
    await delay(3000);
    // The company logo section should be near the top
    await page.screenshot({ path: `${DIR}/09-company-logo-settings.png` });
    console.log('   ✓ saved');

    // ──── BONUS: Dashboard overview ────
    console.log('10. Dashboard...');
    await page.goto(`${BASE_URL}/${CO}/dashboard`, { waitUntil: 'networkidle', timeout: 15000 });
    await delay(2000);
    await page.screenshot({ path: `${DIR}/10-dashboard.png` });
    console.log('   ✓ saved');

    console.log('\n✅ All screenshots captured!');

  } catch (error) {
    console.error('Error:', error.message);
    console.error(error.stack);
    await page.screenshot({ path: `${DIR}/error-state.png` }).catch(() => {});
  } finally {
    await browser.close();
  }
}

main().catch(console.error);
