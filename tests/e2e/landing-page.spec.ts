/**
 * E2E regression tests for the Yggdrasil landing page (the "ascent" redesign).
 *
 * Runs against a live stack (make up / docker-compose up). Verifies the
 * rendered page, not the source: ten realm nodes, OWASP 2025 branding,
 * World Tree artwork, and entry-realm gating as a fresh visitor sees them.
 */
import { test, expect } from '@playwright/test';

test.describe('Landing page — The Ascent', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('renders the hero with World Tree artwork and OWASP 2025 badge', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'THE TREE IS ROTTING.' })).toBeVisible();
    await expect(page.getByText('OWASP Top 10 • 2025')).toBeVisible();

    const hero = page.getByAltText('Yggdrasil - The World Tree');
    await expect(hero).toBeVisible();
    await expect(hero).toHaveAttribute('src', '/assets/yggdrasil-hero.webp');
  });

  test('hero artwork asset is served successfully', async ({ request }) => {
    const res = await request.get('/assets/yggdrasil-hero.webp');
    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toContain('image/webp');
  });

  test('map backdrop asset is served successfully', async ({ request }) => {
    const res = await request.get('/assets/yggdrasil-map.webp');
    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toContain('image/webp');
  });

  test('shows the Ten Realms ascent with all ten production realms', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /the ten realms/i })).toBeVisible();

    const ascent = page.getByTestId('realm-ascent');
    await expect(ascent.getByTestId(/^realm-node-/)).toHaveCount(10);
  });

  test('orders the ascent from Asgard (crown) down to Niflheim (roots)', async ({ page }) => {
    const nodes = page.getByTestId(/^realm-node-/);
    await expect(nodes.first()).toHaveAttribute('data-testid', 'realm-node-asgard');
    await expect(nodes.last()).toHaveAttribute('data-testid', 'realm-node-niflheim');
  });

  test('fresh visitor: Niflheim is the only linked production realm', async ({ page }) => {
    const niflheim = page.getByTestId('realm-node-niflheim');
    await expect(niflheim.getByRole('link')).toHaveAttribute('href', '/realms/niflheim/');

    const asgard = page.getByTestId('realm-node-asgard');
    await expect(asgard.getByRole('link')).toHaveCount(0);
    await expect(asgard.getByText('CLASSIFIED', { exact: true })).toBeVisible();
  });

  test('never mentions "Nine Realms" — the platform has ten', async ({ page }) => {
    const body = await page.locator('body').innerText();
    expect(body.toLowerCase()).not.toContain('nine realms');
  });
});
