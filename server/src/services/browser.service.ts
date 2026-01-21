import { chromium, Browser, Page, BrowserContext } from 'playwright';

const DEFAULT_CDP_PORT = process.env.CDP_PORT || '9920';
const DEFAULT_CDP_URL = `http://localhost:${DEFAULT_CDP_PORT}`;

let connectedBrowser: Browser | null = null;

export interface BrowserStatus {
  connected: boolean;
  cdpUrl: string;
  pageCount: number;
  pages: Array<{ url: string; title: string }>;
  familySearchLoggedIn: boolean;
}

export const browserService = {
  async connect(cdpUrl: string = DEFAULT_CDP_URL): Promise<Browser> {
    if (connectedBrowser?.isConnected()) {
      return connectedBrowser;
    }

    connectedBrowser = await chromium.connectOverCDP(cdpUrl);
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
    const cdpUrl = DEFAULT_CDP_URL;

    if (!connectedBrowser?.isConnected()) {
      return {
        connected: false,
        cdpUrl,
        pageCount: 0,
        pages: [],
        familySearchLoggedIn: false
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
      pageCount: pages.length,
      pages,
      familySearchLoggedIn
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
    return DEFAULT_CDP_URL;
  }
};
