import { test, expect } from '@playwright/test';
import { exploits } from './helpers/exploit-helpers';
import { loginViaUI, submitFlagViaUI, verifyRealmUnlocked } from './helpers/api-client';
import testUsers from '../../fixtures/test-users.json';

test.describe('Yggdrasil Full Journey (10→1)', () => {
  test.setTimeout(300000); // 5 minutes for full journey

  test('completes all realms in order from Niflheim to Asgard', async ({ page, context }) => {
    const { username, password } = testUsers.journeyUser;
    
    // Login
    await loginViaUI(page, username, password);
    await expect(page).toHaveURL(/.*realms/);
    
    // Realm 10: Niflheim (A10: Exceptional Conditions)
    console.log('🧊 Starting Niflheim (Realm 10)...');
    const niflheimResult = await exploits.niflheim(page);
    expect(niflheimResult.success).toBeTruthy();
    expect(niflheimResult.flag).toMatch(/YGGDRASIL\{NIFLHEIM:[a-f0-9-]+\}/i);
    
    await submitFlagViaUI(page, niflheimResult.flag);
    await verifyRealmUnlocked(page, 'helheim');
    console.log('✅ Niflheim complete:', niflheimResult.flag);
    
    // Realm 9: Helheim (A09: Logging & Alerting Failures)
    console.log('💀 Starting Helheim (Realm 9)...');
    const helheimResult = await exploits.helheim(page);
    expect(helheimResult.success).toBeTruthy();
    expect(helheimResult.flag).toMatch(/YGGDRASIL\{HELHEIM:[a-f0-9-]+\}/i);
    
    await submitFlagViaUI(page, helheimResult.flag);
    await verifyRealmUnlocked(page, 'svartalfheim');
    console.log('✅ Helheim complete:', helheimResult.flag);
    
    // Realm 8: Svartalfheim (A08: Software/Data Integrity)
    console.log('⚒️ Starting Svartalfheim (Realm 8)...');
    const svartalfheimResult = await exploits.svartalfheim(page);
    expect(svartalfheimResult.success).toBeTruthy();
    expect(svartalfheimResult.flag).toMatch(/YGGDRASIL\{SVARTALFHEIM:[a-f0-9-]+\}/i);
    
    await submitFlagViaUI(page, svartalfheimResult.flag);
    await verifyRealmUnlocked(page, 'jotunheim');
    console.log('✅ Svartalfheim complete:', svartalfheimResult.flag);
    
    // Realm 7: Jotunheim (A07: Authentication Failures)
    console.log('❄️ Starting Jotunheim (Realm 7)...');
    const jotunheimResult = await exploits.jotunheim(page);
    expect(jotunheimResult.success).toBeTruthy();
    expect(jotunheimResult.flag).toMatch(/YGGDRASIL\{JOTUNHEIM:[a-f0-9-]+\}/i);
    
    await submitFlagViaUI(page, jotunheimResult.flag);
    await verifyRealmUnlocked(page, 'muspelheim');
    console.log('✅ Jotunheim complete:', jotunheimResult.flag);
    
    // Realm 6: Muspelheim (A06: Insecure Design)
    console.log('🔥 Starting Muspelheim (Realm 6)...');
    const muspelheimResult = await exploits.muspelheim(page);
    expect(muspelheimResult.success).toBeTruthy();
    expect(muspelheimResult.flag).toMatch(/YGGDRASIL\{MUSPELHEIM:[a-f0-9-]+\}/i);
    
    await submitFlagViaUI(page, muspelheimResult.flag);
    await verifyRealmUnlocked(page, 'nidavellir');
    console.log('✅ Muspelheim complete:', muspelheimResult.flag);
    
    // Realm 5: Nidavellir (A05: Injection)
    console.log('⛏️ Starting Nidavellir (Realm 5)...');
    const nidavellirResult = await exploits.nidavellir(page);
    expect(nidavellirResult.success).toBeTruthy();
    expect(nidavellirResult.flag).toMatch(/YGGDRASIL\{NIDAVELLIR:[a-f0-9-]+\}/i);
    
    await submitFlagViaUI(page, nidavellirResult.flag);
    await verifyRealmUnlocked(page, 'vanaheim');
    console.log('✅ Nidavellir complete:', nidavellirResult.flag);
    
    // Realm 4: Vanaheim (A04: Cryptographic Failures)
    console.log('🌾 Starting Vanaheim (Realm 4)...');
    const vanaheimResult = await exploits.vanaheim(page);
    expect(vanaheimResult.success).toBeTruthy();
    expect(vanaheimResult.flag).toMatch(/YGGDRASIL\{VANAHEIM:[a-f0-9-]+\}/i);
    
    await submitFlagViaUI(page, vanaheimResult.flag);
    await verifyRealmUnlocked(page, 'midgard');
    console.log('✅ Vanaheim complete:', vanaheimResult.flag);
    
    // Realm 3: Midgard (A03: Supply Chain Failures)
    console.log('🌍 Starting Midgard (Realm 3)...');
    const midgardResult = await exploits.midgard(page);
    expect(midgardResult.success).toBeTruthy();
    expect(midgardResult.flag).toMatch(/YGGDRASIL\{MIDGARD:[a-f0-9-]+\}/i);
    
    await submitFlagViaUI(page, midgardResult.flag);
    await verifyRealmUnlocked(page, 'alfheim');
    console.log('✅ Midgard complete:', midgardResult.flag);
    
    // Realm 2: Alfheim (A02: Security Misconfiguration)
    console.log('☁️ Starting Alfheim (Realm 2)...');
    const alfheimResult = await exploits.alfheim(page);
    expect(alfheimResult.success).toBeTruthy();
    expect(alfheimResult.flag).toMatch(/YGGDRASIL\{ALFHEIM:[a-f0-9-]+\}/i);
    
    await submitFlagViaUI(page, alfheimResult.flag);
    await verifyRealmUnlocked(page, 'asgard');
    console.log('✅ Alfheim complete:', alfheimResult.flag);
    
    // Realm 1: Asgard (A01: Broken Access Control + SSRF)
    console.log('👑 Starting Asgard (Realm 1 - Final)...');
    const asgardResult = await exploits.asgard(page);
    expect(asgardResult.success).toBeTruthy();
    expect(asgardResult.flag).toMatch(/YGGDRASIL\{ASGARD:[a-f0-9-]+\}/i);
    
    await submitFlagViaUI(page, asgardResult.flag);
    console.log('✅ Asgard complete:', asgardResult.flag);
    
    // Verify journey complete
    await page.goto('/realms');
    const completionMessage = await page.locator('.journey-complete, .victory-message').textContent();
    expect(completionMessage).toBeTruthy();
    
    console.log('🎉 FULL JOURNEY COMPLETE! All 10 realms conquered.');
  });
});
