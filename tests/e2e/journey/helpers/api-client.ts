import { APIRequestContext, Page } from '@playwright/test';

export interface FlagSubmissionResult {
  status: string;
  message?: string;
  unlocked?: string;
}

export interface LoginCredentials {
  username: string;
  password: string;
}

export class ApiClient {
  constructor(
    private request: APIRequestContext,
    private baseURL: string = 'http://localhost:8080'
  ) {}

  async login(credentials: LoginCredentials): Promise<any> {
    const response = await this.request.post(`${this.baseURL}/login`, {
      data: credentials,
    });
    return response.json();
  }

  async submitFlag(flag: string): Promise<FlagSubmissionResult> {
    const response = await this.request.post(`${this.baseURL}/submit-flag`, {
      data: { flag },
    });
    return response.json();
  }

  async getProgress(): Promise<any> {
    const response = await this.request.get(`${this.baseURL}/progress`);
    return response.json();
  }

  async getRealms(): Promise<any> {
    const response = await this.request.get(`${this.baseURL}/realms`);
    return response.json();
  }
}

export async function loginViaUI(page: Page, username: string, password: string): Promise<void> {
  await page.goto('/login');
  await page.fill('input[name="username"]', username);
  await page.fill('input[name="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL('**/realms', { timeout: 10000 });
}

export async function submitFlagViaUI(page: Page, flag: string): Promise<void> {
  await page.goto('/realms');
  await page.fill('input[name="flag"]', flag);
  await page.click('button:has-text("Submit Flag")');
  await page.waitForResponse(response => 
    response.url().includes('/submit-flag') && response.status() === 200
  );
}

export async function verifyRealmUnlocked(page: Page, realmName: string): Promise<boolean> {
  await page.goto('/realms');
  const realmCard = page.locator(`[data-realm="${realmName}"]`);
  const isUnlocked = await realmCard.locator('.status').textContent();
  return isUnlocked?.toLowerCase().includes('unlocked') || false;
}

export async function verifyRealmLocked(page: Page, realmName: string): Promise<boolean> {
  await page.goto('/realms');
  const realmCard = page.locator(`[data-realm="${realmName}"]`);
  const isLocked = await realmCard.locator('.status').textContent();
  return isLocked?.toLowerCase().includes('locked') || false;
}

export async function attemptRealmAccess(page: Page, realmName: string): Promise<number> {
  const response = await page.goto(`/realm/${realmName}/`);
  return response?.status() || 0;
}
