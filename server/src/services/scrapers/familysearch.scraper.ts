import { Page } from 'playwright';
import type { ProviderTreeInfo, ScrapedPersonData } from '@fsf/shared';
import type { ProviderScraper } from './base.scraper.js';
import { PROVIDER_DEFAULTS } from './base.scraper.js';

const PROVIDER_INFO = PROVIDER_DEFAULTS.familysearch;

/**
 * FamilySearch browser-based scraper
 */
export const familySearchScraper: ProviderScraper = {
  provider: 'familysearch',
  displayName: PROVIDER_INFO.displayName,
  loginUrl: PROVIDER_INFO.loginUrl,
  treeUrlPattern: PROVIDER_INFO.treeUrlPattern,

  async checkLoginStatus(page: Page): Promise<boolean> {
    const url = page.url();

    // If we're on a FamilySearch page, check for login indicators
    if (url.includes('familysearch.org')) {
      // Check if redirected to signin
      if (url.includes('/signin') || url.includes('/auth/')) {
        return false;
      }

      // Check for user menu or logged-in indicator
      const userMenu = await page.$('[data-testid="user-menu"], .user-menu, #user-menu').catch(() => null);
      if (userMenu) return true;

      // Check for sign-in button (indicates NOT logged in)
      const signInBtn = await page.$('[data-testid="sign-in-button"], .sign-in-link, a[href*="/signin"]').catch(() => null);
      return !signInBtn;
    }

    // Navigate to FamilySearch to check
    await page.goto('https://www.familysearch.org/tree/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    return !page.url().includes('/signin') && !page.url().includes('/auth/');
  },

  async getLoggedInUser(page: Page): Promise<{ name?: string; userId?: string } | null> {
    const isLoggedIn = await this.checkLoginStatus(page);
    if (!isLoggedIn) return null;

    // Navigate to settings page to get user info
    await page.goto('https://www.familysearch.org/settings/account', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    const name = await page.$eval(
      '[data-testid="display-name"], .display-name, h1',
      el => el.textContent?.trim()
    ).catch(() => undefined);

    const userId = await page.$eval(
      '[data-testid="user-id"], .user-id',
      el => el.textContent?.trim()
    ).catch(() => undefined);

    return { name, userId };
  },

  async listTrees(_page: Page): Promise<ProviderTreeInfo[]> {
    // FamilySearch has a single shared tree, not multiple trees
    return [{
      provider: 'familysearch',
      treeId: 'shared',
      treeName: 'FamilySearch Shared Tree',
      personCount: undefined,
      rootPersonId: undefined
    }];
  },

  async scrapePersonById(page: Page, externalId: string): Promise<ScrapedPersonData> {
    const url = `https://www.familysearch.org/tree/person/details/${externalId}`;
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    // Check for login redirect
    if (page.url().includes('/signin')) {
      throw new Error('Not authenticated - please log in to FamilySearch');
    }

    return extractPersonData(page, externalId);
  },

  async *scrapeAncestors(
    page: Page,
    rootId: string,
    maxGenerations = 10
  ): AsyncGenerator<ScrapedPersonData, void, undefined> {
    const visited = new Set<string>();
    const queue: Array<{ id: string; generation: number }> = [{ id: rootId, generation: 0 }];

    while (queue.length > 0) {
      const current = queue.shift()!;

      if (visited.has(current.id) || current.generation > maxGenerations) {
        continue;
      }

      visited.add(current.id);

      const personData = await this.scrapePersonById(page, current.id);
      yield personData;

      // Add parents to queue
      if (personData.fatherExternalId && !visited.has(personData.fatherExternalId)) {
        queue.push({ id: personData.fatherExternalId, generation: current.generation + 1 });
      }
      if (personData.motherExternalId && !visited.has(personData.motherExternalId)) {
        queue.push({ id: personData.motherExternalId, generation: current.generation + 1 });
      }

      // Random delay for rate limiting
      const delay = 500 + Math.random() * 1000;
      await page.waitForTimeout(delay);
    }
  },

  getPersonUrl(externalId: string): string {
    return `https://www.familysearch.org/tree/person/details/${externalId}`;
  },

  getPersonEditUrl(externalId: string): string {
    return `https://www.familysearch.org/tree/person/details/${externalId}`;
  }
};

/**
 * Extract person data from a FamilySearch person details page
 */
async function extractPersonData(page: Page, personId: string): Promise<ScrapedPersonData> {
  const data: ScrapedPersonData = {
    externalId: personId,
    provider: 'familysearch',
    name: '',
    sourceUrl: page.url(),
    scrapedAt: new Date().toISOString()
  };

  // Extract photo URL
  data.photoUrl = await extractPhotoUrl(page);

  // Get full name
  const nameSelectors = [
    '[data-testid="person-name"]',
    '.person-name',
    'h1.name',
    '.person-header h1',
    '[data-testid="conclusion-name"]'
  ];

  for (const selector of nameSelectors) {
    const nameEl = await page.$(selector).catch(() => null);
    if (nameEl) {
      const text = await nameEl.textContent().catch(() => null);
      if (text) {
        data.name = text.trim();
        break;
      }
    }
  }

  // Get vital information
  const birthDate = await extractText(page, '[data-testid="birth-date"], .birth-date, .vital-birth .date');
  const birthPlace = await extractText(page, '[data-testid="birth-place"], .birth-place, .vital-birth .place');
  const deathDate = await extractText(page, '[data-testid="death-date"], .death-date, .vital-death .date');
  const deathPlace = await extractText(page, '[data-testid="death-place"], .death-place, .vital-death .place');

  if (birthDate || birthPlace) {
    data.birth = { date: birthDate, place: birthPlace };
  }
  if (deathDate || deathPlace) {
    data.death = { date: deathDate, place: deathPlace };
  }

  // Get gender
  const genderEl = await page.$('[data-testid="sex-value"], .sex-value, .gender').catch(() => null);
  if (genderEl) {
    const genderText = (await genderEl.textContent().catch(() => ''))?.toLowerCase();
    if (genderText?.includes('male') && !genderText?.includes('female')) {
      data.gender = 'male';
    } else if (genderText?.includes('female')) {
      data.gender = 'female';
    } else {
      data.gender = 'unknown';
    }
  }

  // Get parent IDs by navigating to family members section
  const parentIds = await extractParentIds(page, personId);
  data.fatherExternalId = parentIds.fatherId;
  data.motherExternalId = parentIds.motherId;

  return data;
}

/**
 * Extract photo URL from person page
 */
async function extractPhotoUrl(page: Page): Promise<string | undefined> {
  // Try multiple selectors for profile photo
  const photoSelectors = [
    '[data-testid="update-portrait-button"]',
    '[data-testid="person-portrait"] img',
    '.person-portrait img',
    '.portrait-container img',
    '.fs-person-portrait img',
    '[data-testid="artifact-image"]',
    '.artifact-image img'
  ];

  for (const selector of photoSelectors) {
    // Special handling for update-portrait-button
    if (selector === '[data-testid="update-portrait-button"]') {
      const src = await page.evaluate(() => {
        const btn = document.querySelector('[data-testid="update-portrait-button"]');
        if (!btn) return null;
        const container = btn.parentElement;
        if (!container) return null;
        const img = container.querySelector('img[class*="imageCss"]');
        return img?.getAttribute('src') || null;
      }).catch(() => null);

      if (src && !isPlaceholder(src)) {
        return src.startsWith('//') ? `https:${src}` : src;
      }
      continue;
    }

    const photoImg = await page.$(selector).catch(() => null);
    if (photoImg) {
      const src = await photoImg.getAttribute('src').catch(() => null);
      if (src && !isPlaceholder(src)) {
        return src.startsWith('//') ? `https:${src}` : src;
      }
    }
  }

  // Final attempt: search in DOM context
  const src = await page.evaluate(() => {
    const h1 = document.querySelector('h1');
    if (h1) {
      const container = h1.closest('[class*="rowCss"]')?.parentElement;
      if (container) {
        const img = container.querySelector('img[class*="imageCss"]');
        const src = img?.getAttribute('src');
        if (src && !src.includes('silhouette') && !src.includes('default')) {
          return src;
        }
      }
    }

    const artifactImg = document.querySelector('[data-testid="artifact-image"] img, .artifact-image img');
    if (artifactImg) {
      const src = artifactImg.getAttribute('src');
      if (src && !src.includes('silhouette') && !src.includes('default')) {
        return src;
      }
    }

    return null;
  }).catch(() => null);

  if (src) {
    return src.startsWith('//') ? `https:${src}` : src;
  }

  return undefined;
}

/**
 * Extract parent IDs from the family section
 */
async function extractParentIds(
  page: Page,
  _personId: string
): Promise<{ fatherId?: string; motherId?: string }> {
  const result: { fatherId?: string; motherId?: string } = {};

  // Look for parent links on the person page
  const parentLinks = await page.$$eval(
    'a[href*="/tree/person/"][data-testid*="parent"], a[href*="/tree/person/details/"]',
    (links) => {
      return links
        .filter(link => {
          const text = link.closest('[data-testid*="father"], [data-testid*="mother"], .parent')?.getAttribute('data-testid') || '';
          return text.includes('father') || text.includes('mother');
        })
        .map(link => ({
          href: link.getAttribute('href'),
          role: link.closest('[data-testid*="father"]') ? 'father' : 'mother'
        }));
    }
  ).catch(() => []);

  for (const link of parentLinks) {
    const match = link.href?.match(/\/tree\/person\/(?:details\/)?([A-Z0-9-]+)/);
    if (match) {
      if (link.role === 'father') {
        result.fatherId = match[1];
      } else {
        result.motherId = match[1];
      }
    }
  }

  return result;
}

/**
 * Extract text from first matching selector
 */
async function extractText(page: Page, selector: string): Promise<string | undefined> {
  const el = await page.$(selector).catch(() => null);
  if (el) {
    const text = await el.textContent().catch(() => null);
    return text?.trim() || undefined;
  }
  return undefined;
}

/**
 * Check if URL is a placeholder image
 */
function isPlaceholder(src: string): boolean {
  return src.includes('default') || src.includes('silhouette') || src.includes('placeholder');
}
