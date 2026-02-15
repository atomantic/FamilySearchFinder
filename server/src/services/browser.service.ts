import { chromium, Browser, Page, BrowserContext } from 'playwright';
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';

const DATA_DIR = path.resolve(import.meta.dirname, '../../../data');
const BROWSER_CONFIG_FILE = path.join(DATA_DIR, 'browser-config.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

export interface BrowserConfig {
  cdpPort: number;
  autoConnect: boolean;
}

function loadBrowserConfig(): BrowserConfig {
  if (fs.existsSync(BROWSER_CONFIG_FILE)) {
    return JSON.parse(fs.readFileSync(BROWSER_CONFIG_FILE, 'utf-8'));
  }
  return { cdpPort: 9920, autoConnect: true };
}

function saveBrowserConfig(config: BrowserConfig): void {
  fs.writeFileSync(BROWSER_CONFIG_FILE, JSON.stringify(config, null, 2));
}

let browserConfig = loadBrowserConfig();

function getCdpPort(): number {
  return browserConfig.cdpPort;
}

function getCdpUrlInternal(): string {
  return `http://localhost:${getCdpPort()}`;
}

let connectedBrowser: Browser | null = null;

export interface BrowserStatus {
  connected: boolean;
  cdpUrl: string;
  cdpPort: number;
  pageCount: number;
  pages: Array<{ url: string; title: string }>;
  familySearchLoggedIn: boolean;
  browserProcessRunning: boolean;
  autoConnect: boolean;
}

async function checkBrowserProcessRunning(): Promise<boolean> {
  const cdpUrl = getCdpUrlInternal();
  const response = await fetch(`${cdpUrl}/json/version`).catch(() => null);
  return response?.ok ?? false;
}

export const browserService = {
  async connect(cdpUrl?: string): Promise<Browser> {
    const url = cdpUrl || getCdpUrlInternal();
    if (connectedBrowser?.isConnected()) {
      return connectedBrowser;
    }

    connectedBrowser = await chromium.connectOverCDP(url);
    return connectedBrowser;
  },

  async disconnect(): Promise<void> {
    if (connectedBrowser) {
      await connectedBrowser.close();
      connectedBrowser = null;
    }
  },

  isConnected(): boolean {
    return connectedBrowser?.isConnected() ?? false;
  },

  async getStatus(): Promise<BrowserStatus> {
    const cdpUrl = getCdpUrlInternal();
    const cdpPort = getCdpPort();
    const browserProcessRunning = await checkBrowserProcessRunning();

    if (!connectedBrowser?.isConnected()) {
      return {
        connected: false,
        cdpUrl,
        cdpPort,
        pageCount: 0,
        pages: [],
        familySearchLoggedIn: false,
        browserProcessRunning,
        autoConnect: browserConfig.autoConnect
      };
    }

    const contexts = connectedBrowser.contexts();
    const allPages: Page[] = [];
    for (const ctx of contexts) {
      allPages.push(...ctx.pages());
    }

    const pages = await Promise.all(
      allPages.map(async (page) => ({
        url: page.url(),
        title: await page.title().catch(() => '')
      }))
    );

    // Check if any FamilySearch page is logged in
    const familySearchLoggedIn = pages.some(
      p => p.url.includes('familysearch.org') && !p.url.includes('/signin')
    );

    return {
      connected: true,
      cdpUrl,
      cdpPort,
      pageCount: pages.length,
      pages,
      familySearchLoggedIn,
      browserProcessRunning,
      autoConnect: browserConfig.autoConnect
    };
  },

  async getOrCreateContext(): Promise<BrowserContext> {
    if (!connectedBrowser?.isConnected()) {
      throw new Error('Browser not connected');
    }

    const contexts = connectedBrowser.contexts();
    if (contexts.length > 0) {
      return contexts[0];
    }

    return connectedBrowser.newContext();
  },

  async findFamilySearchPage(): Promise<Page | null> {
    if (!connectedBrowser?.isConnected()) {
      return null;
    }

    const contexts = connectedBrowser.contexts();
    for (const ctx of contexts) {
      for (const page of ctx.pages()) {
        const url = page.url();
        if (url.includes('familysearch.org') && !url.includes('/signin')) {
          return page;
        }
      }
    }

    return null;
  },

  async createPage(url?: string): Promise<Page> {
    const context = await this.getOrCreateContext();
    const page = await context.newPage();

    if (url) {
      await page.goto(url, { waitUntil: 'domcontentloaded' });
    }

    return page;
  },

  async navigateTo(url: string): Promise<Page> {
    let page = await this.findFamilySearchPage();

    if (!page) {
      page = await this.createPage(url);
    } else {
      await page.goto(url, { waitUntil: 'domcontentloaded' });
    }

    return page;
  },

  getCdpUrl(): string {
    return getCdpUrlInternal();
  },

  getCdpPort(): number {
    return getCdpPort();
  },

  getConfig(): BrowserConfig {
    return { ...browserConfig };
  },

  updateConfig(updates: Partial<BrowserConfig>): BrowserConfig {
    browserConfig = { ...browserConfig, ...updates };
    saveBrowserConfig(browserConfig);
    return browserConfig;
  },

  async launchBrowser(): Promise<{ success: boolean; message: string }> {
    const scriptPath = path.resolve(import.meta.dirname, '../../../.browser/start.sh');

    if (!fs.existsSync(scriptPath)) {
      return { success: false, message: 'Browser start script not found at .browser/start.sh' };
    }

    const isRunning = await checkBrowserProcessRunning();
    if (isRunning) {
      return { success: false, message: 'Browser already running' };
    }

    // Spawn browser process detached
    const child = spawn(scriptPath, [], {
      detached: true,
      stdio: 'ignore',
      env: { ...process.env, CDP_PORT: String(getCdpPort()) }
    });
    child.unref();

    // Wait a moment for browser to start
    await new Promise(resolve => setTimeout(resolve, 2000));

    const nowRunning = await checkBrowserProcessRunning();
    return {
      success: nowRunning,
      message: nowRunning ? 'Browser launched successfully' : 'Browser may still be starting...'
    };
  },

  async checkBrowserRunning(): Promise<boolean> {
    return checkBrowserProcessRunning();
  },

  async getFamilySearchToken(): Promise<{ token: string | null; cookies: Array<{ name: string; value: string }> }> {
    if (!connectedBrowser?.isConnected()) {
      return { token: null, cookies: [] };
    }

    const contexts = connectedBrowser.contexts();
    const allCookies: Array<{ name: string; value: string; domain: string }> = [];

    for (const ctx of contexts) {
      const cookies = await ctx.cookies(['https://www.familysearch.org', 'https://ident.familysearch.org']);
      allCookies.push(...cookies);
    }

    // FamilySearch uses several cookie names for authentication
    // The main one is usually 'fssessionid' or we can look for auth tokens
    const authCookieNames = ['fssessionid', 'FS_AUTH_TOKEN', 'Authorization'];

    let token: string | null = null;

    for (const cookieName of authCookieNames) {
      const cookie = allCookies.find(c => c.name === cookieName);
      if (cookie) {
        token = cookie.value;
        break;
      }
    }

    // Filter to only return relevant auth cookies
    const relevantCookies = allCookies
      .filter(c => c.domain.includes('familysearch'))
      .map(c => ({ name: c.name, value: c.value }));

    return { token, cookies: relevantCookies };
  }
};
