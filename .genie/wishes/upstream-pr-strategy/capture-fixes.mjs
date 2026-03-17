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
    await page.goto(`${BASE_URL}/${CO}/dashboard`, { waitUntil: 'networkidle', timeout: 15000 });
    await delay(2000);
    console.log('✓ logged in');

    // ──── FIX: Company rail with avatar (full height) ────
    console.log('\nFix 1: Company rail with full height including avatar...');
    // Use a taller viewport clip to capture the full sidebar
    // The sidebar should have the user avatar at the bottom
    // Let's use JavaScript to get the exact sidebar dimensions
    const sidebarInfo = await page.evaluate(() => {
      const sidebar = document.querySelector('aside') || document.querySelector('nav') || document.querySelector('[class*="sidebar"]') || document.querySelector('[class*="Sidebar"]');
      if (sidebar) {
        const rect = sidebar.getBoundingClientRect();
        return { x: rect.x, y: rect.y, width: rect.width, height: rect.height, found: true };
      }
      return { found: false };
    });
    console.log('   Sidebar info:', JSON.stringify(sidebarInfo));

    // Capture full-page height sidebar by using clip
    await page.screenshot({
      path: `${DIR}/08-company-rail-avatar.png`,
      clip: { x: 0, y: 0, width: 320, height: 900 }
    });
    console.log('   ✓ Full rail captured');

    // Also capture just the bottom where the avatar is
    await page.screenshot({
      path: `${DIR}/08b-rail-avatar-bottom.png`,
      clip: { x: 0, y: 700, width: 320, height: 200 }
    });
    console.log('   ✓ Rail bottom with avatar captured');

    // ──── FIX: Company Settings - scroll to Members section ────
    console.log('\nFix 2: Company settings - members section...');
    await page.goto(`${BASE_URL}/${CO}/company/settings`, { waitUntil: 'networkidle', timeout: 15000 });
    await delay(3000);

    // Find the Members heading and scroll to it
    const membersHeading = await page.$('text=MEMBERS, text=Members, h2:has-text("Members"), h3:has-text("Members")');
    if (membersHeading) {
      await membersHeading.scrollIntoViewIfNeeded();
      await delay(500);
      await page.screenshot({ path: `${DIR}/04b-company-members.png` });
      console.log('   ✓ Members section captured');
    } else {
      // Scroll down progressively to find members
      for (let i = 0; i < 10; i++) {
        await page.evaluate(() => window.scrollBy(0, 300));
        await delay(300);
        const text = await page.evaluate(() => document.body.innerText);
        if (text.includes('MEMBERS') || text.includes('Members')) {
          await page.screenshot({ path: `${DIR}/04b-company-members.png` });
          console.log(`   ✓ Members section found at scroll ${i}`);
          break;
        }
      }
    }

    // ──── FIX: Human Invite Collaborator dialog ────
    console.log('\nFix 3: Human invite collaborator dialog...');
    // Go back to company settings and find invite collaborator section
    await page.goto(`${BASE_URL}/${CO}/company/settings`, { waitUntil: 'networkidle', timeout: 15000 });
    await delay(2000);

    // Scroll to INVITE COLLABORATOR section
    for (let i = 0; i < 15; i++) {
      await page.evaluate(() => window.scrollBy(0, 200));
      await delay(200);
    }
    await delay(500);

    // Look for the invite collaborator button
    const inviteCollab = await page.$('button:has-text("Generate Invite Link"), button:has-text("Invite Collaborator"), button:has-text("Generate")');
    if (inviteCollab) {
      // Check all buttons containing "Generate" or "Invite"
      const allButtons = await page.$$('button');
      for (const btn of allButtons) {
        const text = await btn.textContent();
        console.log('   Button:', text?.trim());
      }
    }

    // Take the invite section screenshot
    await page.screenshot({ path: `${DIR}/05-invite-section.png` });
    console.log('   ✓ Invite section captured');

    // ──── FIX: Invite landing page ────
    console.log('\nFix 4: Invite landing page...');
    // Check if there's a real invite token we can use
    const invites = await page.evaluate(async () => {
      const resp = await fetch('/api/users/invites');
      if (resp.ok) return await resp.json();
      return null;
    });
    console.log('   Invites:', JSON.stringify(invites)?.substring(0, 200));

    // Navigate to the invite landing with a fake token to show the UI
    await page.goto(`${BASE_URL}/invite/demo-token`, { waitUntil: 'networkidle', timeout: 15000 });
    await delay(2000);
    await page.screenshot({ path: `${DIR}/05b-invite-landing.png` });
    console.log('   ✓ Invite landing saved');

    // ──── BONUS: Full dashboard with proper layout ────
    console.log('\nBonus: Clean dashboard...');
    await page.goto(`${BASE_URL}/${CO}/dashboard`, { waitUntil: 'networkidle', timeout: 15000 });
    await delay(3000);
    await page.screenshot({ path: `${DIR}/10-dashboard.png` });
    console.log('   ✓ saved');

    console.log('\n✅ Fix pass complete!');

  } catch (error) {
    console.error('Error:', error.message, error.stack);
    await page.screenshot({ path: `${DIR}/error-fix.png` }).catch(() => {});
  } finally {
    await browser.close();
  }
}

main().catch(console.error);
