import { Page } from 'playwright';
import type { ProviderTreeInfo, ScrapedPersonData } from '@fsf/shared';
import type { ProviderScraper } from './base.scraper.js';
import { PROVIDER_DEFAULTS } from './base.scraper.js';

const PROVIDER_INFO = PROVIDER_DEFAULTS['23andme'];

/**
 * 23andMe browser-based scraper
 */
export const twentyThreeAndMeScraper: ProviderScraper = {
  provider: '23andme',
  displayName: PROVIDER_INFO.displayName,
  loginUrl: PROVIDER_INFO.loginUrl,
  treeUrlPattern: PROVIDER_INFO.treeUrlPattern,

  async checkLoginStatus(page: Page): Promise<boolean> {
    const url = page.url();

    // Check if on 23andMe
    if (url.includes('23andme.com')) {
      // Check for login page
      if (url.includes('/login') || url.includes('/signin') || url === 'https://you.23andme.com/') {
        // On homepage, need to check further
        const loginBtn = await page.$('a[href*="/login"], button[data-test="login"]').catch(() => null);
        return !loginBtn;
      }

      // If we're on you.23andme.com with content, we're logged in
      const userContent = await page.$('[data-test="user-menu"], .user-avatar, .profile-menu').catch(() => null);
      return !!userContent;
    }

    // Navigate to 23andMe to check
    await page.goto('https://you.23andme.com/family/tree/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    // Check if redirected to login
    return !page.url().includes('/login') && !page.url().includes('/signin');
  },

  async getLoggedInUser(page: Page): Promise<{ name?: string; userId?: string } | null> {
    const isLoggedIn = await this.checkLoginStatus(page);
    if (!isLoggedIn) return null;

    // Navigate to profile/settings
    await page.goto('https://you.23andme.com/settings/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    const name = await page.$eval(
      '[data-test="display-name"], .profile-name, .user-name',
      el => el.textContent?.trim()
    ).catch(() => undefined);

    return { name, userId: undefined };
  },

  async listTrees(_page: Page): Promise<ProviderTreeInfo[]> {
    // 23andMe has a single family tree per account
    return [{
      provider: '23andme',
      treeId: 'default',
      treeName: '23andMe Family Tree',
      personCount: undefined,
      rootPersonId: undefined
    }];
  },

  async scrapePersonById(page: Page, externalId: string): Promise<ScrapedPersonData> {
    // 23andMe family tree uses different ID scheme
    // Navigate to the family tree and find the person
    const url = `https://you.23andme.com/family/tree/`;
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);

    // Check for login redirect
    if (page.url().includes('/login')) {
      throw new Error('Not authenticated - please log in to 23andMe');
    }

    // 23andMe uses a canvas/SVG-based tree, making direct scraping challenging
    // Try to find person data through the page's JavaScript state
    const personData = await page.evaluate((targetId) => {
      // @ts-expect-error Accessing page's global state
      const treeData = window.__TREE_DATA__ || window.treeData;
      if (treeData?.people) {
        const person = treeData.people[targetId];
        if (person) {
          return {
            name: person.name || person.displayName,
            gender: person.sex || person.gender,
            birthDate: person.birthDate,
            birthPlace: person.birthLocation,
            deathDate: person.deathDate,
            deathPlace: person.deathLocation,
            photoUrl: person.photoUrl,
            fatherId: person.fatherId,
            motherId: person.motherId
          };
        }
      }
      return null;
    }, externalId).catch(() => null);

    const data: ScrapedPersonData = {
      externalId,
      provider: '23andme',
      name: personData?.name || '',
      sourceUrl: page.url(),
      scrapedAt: new Date().toISOString()
    };

    if (personData) {
      if (personData.birthDate || personData.birthPlace) {
        data.birth = { date: personData.birthDate, place: personData.birthPlace };
      }
      if (personData.deathDate || personData.deathPlace) {
        data.death = { date: personData.deathDate, place: personData.deathPlace };
      }
      if (personData.photoUrl) {
        data.photoUrl = personData.photoUrl;
      }
      if (personData.gender) {
        const g = personData.gender.toLowerCase();
        data.gender = g === 'male' || g === 'm' ? 'male' : g === 'female' || g === 'f' ? 'female' : 'unknown';
      }
      data.fatherExternalId = personData.fatherId;
      data.motherExternalId = personData.motherId;
    }

    return data;
  },

  async *scrapeAncestors(
    page: Page,
    rootId: string,
    maxGenerations = 10
  ): AsyncGenerator<ScrapedPersonData, void, undefined> {
    // Navigate to tree first
    await page.goto('https://you.23andme.com/family/tree/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);

    // Try to extract all tree data at once from page state
    const allPeople = await page.evaluate(() => {
      // @ts-expect-error Accessing page's global state
      const treeData = window.__TREE_DATA__ || window.treeData;
      return treeData?.people || {};
    }).catch(() => ({}));

    const visited = new Set<string>();
    const queue: Array<{ id: string; generation: number }> = [{ id: rootId, generation: 0 }];

    while (queue.length > 0) {
      const current = queue.shift()!;

      if (visited.has(current.id) || current.generation > maxGenerations) {
        continue;
      }

      visited.add(current.id);

      const rawPerson = allPeople[current.id];
      if (!rawPerson) continue;

      const personData: ScrapedPersonData = {
        externalId: current.id,
        provider: '23andme',
        name: rawPerson.name || rawPerson.displayName || '',
        sourceUrl: `https://you.23andme.com/family/tree/#${current.id}`,
        scrapedAt: new Date().toISOString()
      };

      if (rawPerson.birthDate || rawPerson.birthLocation) {
        personData.birth = { date: rawPerson.birthDate, place: rawPerson.birthLocation };
      }
      if (rawPerson.deathDate || rawPerson.deathLocation) {
        personData.death = { date: rawPerson.deathDate, place: rawPerson.deathLocation };
      }
      if (rawPerson.photoUrl) {
        personData.photoUrl = rawPerson.photoUrl;
      }
      if (rawPerson.sex || rawPerson.gender) {
        const g = (rawPerson.sex || rawPerson.gender).toLowerCase();
        personData.gender = g === 'male' || g === 'm' ? 'male' : g === 'female' || g === 'f' ? 'female' : 'unknown';
      }

      const fatherId = rawPerson.fatherId;
      const motherId = rawPerson.motherId;

      personData.fatherExternalId = fatherId;
      personData.motherExternalId = motherId;

      yield personData;

      // Add parents to queue
      if (fatherId && !visited.has(fatherId)) {
        queue.push({ id: fatherId, generation: current.generation + 1 });
      }
      if (motherId && !visited.has(motherId)) {
        queue.push({ id: motherId, generation: current.generation + 1 });
      }
    }
  },

  getPersonUrl(externalId: string): string {
    return `https://you.23andme.com/family/tree/#${externalId}`;
  },

  getPersonEditUrl(externalId: string): string {
    return `https://you.23andme.com/family/tree/#${externalId}`;
  }
};
