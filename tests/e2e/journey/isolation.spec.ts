import { test, expect } from '@playwright/test';
import { loginViaUI, attemptRealmAccess, verifyRealmLocked, submitFlagViaUI } from './helpers/api-client';
import testUsers from '../../fixtures/test-users.json';

test.describe('Realm Isolation & Progression Security', () => {
  
  test('cannot access locked realms without proper progression', async ({ page }) => {
    const { username, password } = testUsers.isolationUser;
    
    // Login as fresh user (should only have access to Niflheim - realm 10)
    await loginViaUI(page, username, password);
    
    // Verify Helheim (realm 9) returns 403
    const helheimStatus = await attemptRealmAccess(page, 'helheim');
    expect(helheimStatus).toBe(403);
    
    // Verify all higher realms are locked
    const lockedRealms = ['svartalfheim', 'jotunheim', 'muspelheim', 'nidavellir', 'vanaheim', 'midgard', 'alfheim', 'asgard'];
    
    for (const realm of lockedRealms) {
      const status = await attemptRealmAccess(page, realm);
      expect(status).toBe(403);
      console.log(`✅ ${realm} correctly locked (403)`);
    }
  });

  test('cannot access realm services directly on their container ports', async ({ request }) => {
    // Attempt direct access to realm ports should fail (network isolation)
    const directAccessAttempts = [
      'http://niflheim:3000/',
      'http://helheim:3000/',
      'http://svartalfheim:3000/',
    ];
    
    for (const url of directAccessAttempts) {
      await expect(async () => {
        await request.get(url);
      }).rejects.toThrow();
      console.log(`✅ Direct access blocked: ${url}`);
    }
  });

  test('cannot skip progression by submitting out-of-order flags', async ({ page }) => {
    const { username, password } = testUsers.skipUser;
    
    await loginViaUI(page, username, password);
    
    // Try to submit Asgard flag without completing previous realms
    const asgardFlag = process.env.ASGARD_FLAG || 'YGGDRASIL{ASGARD:81892ad5-e169-4165-89fe-ab25348325e0}';
    
    await page.goto('/realms');
    await page.fill('input[name="flag"]', asgardFlag);
    const response = page.waitForResponse(resp => resp.url().includes('/submit-flag'));
    await page.click('button:has-text("Submit Flag")');
    
    const resp = await response;
    const body = await resp.json();
    
    expect(body.status).not.toBe('success');
    expect([400, 403]).toContain(resp.status());
    console.log('✅ Out-of-order flag submission rejected');
  });

  test('realm networks are isolated from each other', async ({ page }) => {
    const { username, password } = testUsers.isolationUser;
    
    await loginViaUI(page, username, password);
    
    // Access Niflheim
    await page.goto('/realm/niflheim/');
    await page.waitForLoadState('networkidle');
    
    // Attempt to make request from Niflheim to Helheim (should fail due to network isolation)
    const crossRealmRequest = await page.evaluate(async () => {
      try {
        const response = await fetch('http://helheim:3000/');
        return { success: true, status: response.status };
      } catch (error) {
        return { success: false, error: error.message };
      }
    });
    
    expect(crossRealmRequest.success).toBeFalsy();
    console.log('✅ Cross-realm network access blocked');
  });

  test('progression state persists across sessions', async ({ page, context }) => {
    const { username, password } = testUsers.journeyUser;
    
    // Login and submit first flag
    await loginViaUI(page, username, password);
    const niflheimFlag = process.env.NIFLHEIM_FLAG || 'YGGDRASIL{NIFLHEIM:ba6cd20a-a60f-4857-992a-c0e06f0534bf}';
    await submitFlagViaUI(page, niflheimFlag);
    
    // Logout (destroy session)
    await page.goto('/logout');
    await page.waitForURL('**/login');
    
    // Login again
    await loginViaUI(page, username, password);
    
    // Verify Helheim is still unlocked
    await page.goto('/realms');
    const helheimUnlocked = await page.locator('[data-realm="helheim"]').locator('.status').textContent();
    expect(helheimUnlocked).toContain('Unlocked');
    
    console.log('✅ Progression state persisted across sessions');
  });

  test('cannot enumerate locked realms via direct navigation', async ({ page }) => {
    const { username, password } = testUsers.isolationUser;
    
    await loginViaUI(page, username, password);
    
    // Try to access locked realm directly
    const response = await page.goto('/realm/asgard/');
    
    // Should get 403, not reveal realm structure
    expect(response?.status()).toBe(403);
    
    // Verify error page doesn't leak realm information
    const pageContent = await page.content();
    expect(pageContent).not.toContain('Odin');
    expect(pageContent).not.toContain('HR Portal');
    expect(pageContent).not.toContain('admin');
    
    console.log('✅ Locked realm does not leak information');
  });
});
