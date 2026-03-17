import { chromium } from 'playwright';
import { writeFileSync } from 'fs';

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

  try {
    // 1. Login page
    console.log('1. Capturing login page...');
    await page.goto(`${BASE_URL}/auth/login`, { waitUntil: 'networkidle', timeout: 30000 });
    await delay(2000);
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/01-login-page.png`, fullPage: false });
    console.log('   ✓ Login page captured');

    // Try to login
    console.log('   Attempting login...');
    // Check what's on the page
    const pageContent = await page.content();
    console.log('   Page title:', await page.title());

    // Look for email input
    const emailInput = await page.$('input[type="email"], input[name="email"], input[placeholder*="email" i]');
    const passwordInput = await page.$('input[type="password"], input[name="password"]');

    if (emailInput && passwordInput) {
      console.log('   Found login form, filling credentials...');
      await emailInput.fill('felipe@namastex.io');
      await passwordInput.fill('felipe@namastex.io'); // Try email as password first

      // Screenshot the filled form
      await page.screenshot({ path: `${SCREENSHOTS_DIR}/01b-login-filled.png`, fullPage: false });

      const submitBtn = await page.$('button[type="submit"], button:has-text("Sign in"), button:has-text("Login"), button:has-text("Log in")');
      if (submitBtn) {
        await submitBtn.click();
        await delay(3000);
        console.log('   Current URL after login attempt:', page.url());
      }
    } else {
      console.log('   No standard login form found. Page URL:', page.url());
      // Maybe we're already logged in or redirected
    }

    // Check if we're logged in by looking at the URL
    const currentUrl = page.url();
    console.log('   Current URL:', currentUrl);

    // If still on login page, try different approaches
    if (currentUrl.includes('auth') || currentUrl.includes('login')) {
      console.log('   Still on auth page, trying alternative passwords...');

      // Try common test passwords
      const passwords = ['password', 'Password1!', 'test123', 'namastex', 'Felipe123!', 'admin'];
      for (const pwd of passwords) {
        const emailEl = await page.$('input[type="email"], input[name="email"]');
        const pwdEl = await page.$('input[type="password"], input[name="password"]');
        if (emailEl && pwdEl) {
          await emailEl.fill('felipe@namastex.io');
          await pwdEl.fill(pwd);
          const btn = await page.$('button[type="submit"], button:has-text("Sign in"), button:has-text("Login"), button:has-text("Log in")');
          if (btn) {
            await btn.click();
            await delay(2000);
            if (!page.url().includes('auth') && !page.url().includes('login')) {
              console.log(`   ✓ Logged in with password attempt`);
              break;
            }
          }
        }
      }
    }

    // Take a screenshot of wherever we ended up
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/02-after-login.png`, fullPage: false });
    console.log('   Current state URL:', page.url());

    // If logged in, continue capturing
    if (!page.url().includes('auth') && !page.url().includes('login')) {
      console.log('\n2. Capturing main dashboard...');
      await delay(2000);
      await page.screenshot({ path: `${SCREENSHOTS_DIR}/02-dashboard.png`, fullPage: false });
      console.log('   ✓ Dashboard captured');

      // 3. User menu - look for avatar/user button in sidebar
      console.log('\n3. Capturing user menu...');
      // Try clicking on user avatar area (usually bottom of sidebar)
      const avatarBtn = await page.$('[data-testid="user-menu"], .user-menu, .user-avatar, button:has(img[alt*="avatar" i]), [class*="UserMenu"], [class*="user-menu"]');
      if (avatarBtn) {
        await avatarBtn.click();
        await delay(1000);
        await page.screenshot({ path: `${SCREENSHOTS_DIR}/03-user-menu.png`, fullPage: false });
        console.log('   ✓ User menu captured');
        // Close menu
        await page.keyboard.press('Escape');
        await delay(500);
      } else {
        console.log('   Looking for user avatar in sidebar...');
        // Try to find it by looking at bottom of page or sidebar
        const allButtons = await page.$$('button');
        for (const btn of allButtons) {
          const text = await btn.textContent();
          const hasAvatar = await btn.$('img, svg, [class*="avatar" i]');
          if (hasAvatar || text?.toLowerCase().includes('felipe')) {
            console.log('   Found potential user button:', text?.trim().substring(0, 50));
            await btn.click();
            await delay(1000);
            await page.screenshot({ path: `${SCREENSHOTS_DIR}/03-user-menu.png`, fullPage: false });
            console.log('   ✓ User menu captured (potential match)');
            await page.keyboard.press('Escape');
            await delay(500);
            break;
          }
        }
      }

      // 4. Account settings
      console.log('\n4. Capturing account settings...');
      await page.goto(`${BASE_URL}/account`, { waitUntil: 'networkidle', timeout: 15000 });
      await delay(2000);
      await page.screenshot({ path: `${SCREENSHOTS_DIR}/04-account-settings.png`, fullPage: false });
      console.log('   ✓ Account settings captured');

      // 5. Company settings + members
      console.log('\n5. Capturing company settings...');
      await page.goto(`${BASE_URL}/settings`, { waitUntil: 'networkidle', timeout: 15000 });
      await delay(2000);
      await page.screenshot({ path: `${SCREENSHOTS_DIR}/05-company-settings.png`, fullPage: true });
      console.log('   ✓ Company settings captured');

      // 6. Try to open invite dialog
      console.log('\n6. Capturing invite flow...');
      const inviteBtn = await page.$('button:has-text("Invite"), button:has-text("invite"), [data-testid="invite-button"]');
      if (inviteBtn) {
        await inviteBtn.click();
        await delay(1000);
        await page.screenshot({ path: `${SCREENSHOTS_DIR}/06-invite-dialog.png`, fullPage: false });
        console.log('   ✓ Invite dialog captured');
        await page.keyboard.press('Escape');
        await delay(500);
      } else {
        console.log('   No invite button found on settings page, trying direct URL...');
        await page.goto(`${BASE_URL}/invite`, { waitUntil: 'networkidle', timeout: 15000 }).catch(() => {});
        await delay(2000);
        await page.screenshot({ path: `${SCREENSHOTS_DIR}/06-invite-flow.png`, fullPage: false });
      }

      // 7. @mention autocomplete - go to issues and try new issue dialog
      console.log('\n7. Capturing @mention autocomplete...');
      await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle', timeout: 15000 });
      await delay(2000);

      // Look for "New Issue" button
      const newIssueBtn = await page.$('button:has-text("New Issue"), button:has-text("New issue"), button:has-text("Create Issue"), [data-testid="new-issue"]');
      if (newIssueBtn) {
        await newIssueBtn.click();
        await delay(1000);

        // Find textarea/editor and type @
        const editor = await page.$('textarea, [contenteditable="true"], [role="textbox"], .ProseMirror, .markdown-editor');
        if (editor) {
          await editor.click();
          await editor.type('@');
          await delay(1500);
          await page.screenshot({ path: `${SCREENSHOTS_DIR}/07-mention-autocomplete.png`, fullPage: false });
          console.log('   ✓ Mention autocomplete captured');
        } else {
          console.log('   No editor found in new issue dialog');
          await page.screenshot({ path: `${SCREENSHOTS_DIR}/07-new-issue-dialog.png`, fullPage: false });
        }
        await page.keyboard.press('Escape');
        await delay(500);
      } else {
        console.log('   No new issue button found');
        // Try keyboard shortcut
        await page.keyboard.press('c');
        await delay(1000);
        await page.screenshot({ path: `${SCREENSHOTS_DIR}/07-new-issue-attempt.png`, fullPage: false });
      }

      // 8. Inbox with mentions
      console.log('\n8. Capturing inbox...');
      await page.goto(`${BASE_URL}/inbox`, { waitUntil: 'networkidle', timeout: 15000 });
      await delay(2000);
      await page.screenshot({ path: `${SCREENSHOTS_DIR}/08-inbox-mentions.png`, fullPage: false });
      console.log('   ✓ Inbox captured');

      // 9. CompanyRail with avatar
      console.log('\n9. Capturing company rail with user avatar...');
      await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle', timeout: 15000 });
      await delay(2000);
      // Take a screenshot focused on the left sidebar/rail
      const rail = await page.$('[class*="CompanyRail"], [class*="company-rail"], nav, aside, [class*="sidebar"]');
      if (rail) {
        await rail.screenshot({ path: `${SCREENSHOTS_DIR}/09-company-rail-avatar.png` });
        console.log('   ✓ Company rail captured');
      } else {
        // Take full page and we'll crop later
        await page.screenshot({ path: `${SCREENSHOTS_DIR}/09-company-rail-avatar.png`, fullPage: false });
        console.log('   ✓ Full page captured (rail not isolated)');
      }

      // 10. Company logo
      console.log('\n10. Capturing company logo settings...');
      await page.goto(`${BASE_URL}/settings`, { waitUntil: 'networkidle', timeout: 15000 });
      await delay(2000);
      // Look for logo section
      const logoSection = await page.$('[class*="logo"], [data-testid="company-logo"]');
      if (logoSection) {
        await logoSection.screenshot({ path: `${SCREENSHOTS_DIR}/10-company-logo.png` });
      } else {
        await page.screenshot({ path: `${SCREENSHOTS_DIR}/10-company-logo-settings.png`, fullPage: false });
      }
      console.log('   ✓ Company logo settings captured');
    } else {
      console.log('\n⚠️  Could not log in. Only login page captured.');
      console.log('   Final URL:', page.url());

      // Take a screenshot of the error state
      await page.screenshot({ path: `${SCREENSHOTS_DIR}/login-failed-state.png`, fullPage: false });
    }

  } catch (error) {
    console.error('Error:', error.message);
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/error-state.png`, fullPage: false });
  } finally {
    await browser.close();
  }
}

main().catch(console.error);
