import fs from 'fs';
import path from 'path';
import type {
  Person,
  Database,
  BuiltInProvider,
  ScrapedPersonData,
  ProviderComparison,
  SyncProgress
} from '@fsf/shared';
import { browserService } from './browser.service';
import { providerService } from './provider.service';

const DATA_DIR = path.resolve(import.meta.dirname, '../../../data');

/**
 * Sync service for comparing and syncing data across providers
 */
export const syncService = {
  /**
   * Compare a person across all enabled providers
   */
  async compareAcrossProviders(
    dbId: string,
    personId: string
  ): Promise<ProviderComparison> {
    // Load local person data
    const dbPath = path.join(DATA_DIR, `db-${dbId}.json`);
    if (!fs.existsSync(dbPath)) {
      throw new Error(`Database ${dbId} not found`);
    }

    const db: Database = JSON.parse(fs.readFileSync(dbPath, 'utf-8'));
    const localPerson = db[personId];
    if (!localPerson) {
      throw new Error(`Person ${personId} not found in database ${dbId}`);
    }

    const comparison: ProviderComparison = {
      personId,
      localPerson,
      providerData: {
        familysearch: null,
        ancestry: null,
        '23andme': null,
        wikitree: null
      },
      differences: []
    };

    // Get all enabled provider configs
    const registry = providerService.getAllConfigs();

    // Ensure browser is connected
    if (!browserService.isConnected()) {
      await browserService.connect();
    }

    // Scrape from each enabled provider
    for (const [provider, config] of Object.entries(registry.providers) as [BuiltInProvider, typeof registry.providers[BuiltInProvider]][]) {
      if (!config.enabled) continue;

      const scraped = await this.scrapeFromProvider(provider, personId)
        .catch(() => null);

      comparison.providerData[provider] = scraped;
    }

    // Calculate differences
    comparison.differences = this.calculateDifferences(localPerson, comparison.providerData);

    return comparison;
  },

  /**
   * Scrape a person from a specific provider
   */
  async scrapeFromProvider(
    provider: BuiltInProvider,
    externalId: string
  ): Promise<ScrapedPersonData> {
    const scraper = providerService.getScraper(provider);

    if (!browserService.isConnected()) {
      await browserService.connect();
    }

    const page = await browserService.createPage();
    const data = await scraper.scrapePersonById(page, externalId);
    await page.close().catch(() => {});

    return data;
  },

  /**
   * Find a matching person in another provider by searching
   */
  async findMatch(
    person: Person,
    targetProvider: BuiltInProvider
  ): Promise<ScrapedPersonData | null> {
    // This is a simplified implementation
    // A real implementation would use provider-specific search APIs/scraping

    const scraper = providerService.getScraper(targetProvider);

    if (!browserService.isConnected()) {
      await browserService.connect();
    }

    const page = await browserService.createPage();

    // Navigate to search page based on provider
    let searchUrl: string;
    const searchQuery = encodeURIComponent(person.name);

    switch (targetProvider) {
      case 'familysearch':
        searchUrl = `https://www.familysearch.org/search/tree/results?q.givenName=${searchQuery}`;
        break;
      case 'ancestry':
        searchUrl = `https://www.ancestry.com/search/?name=${searchQuery}`;
        break;
      case 'wikitree':
        searchUrl = `https://www.wikitree.com/wiki/Special:SearchPerson?wpFirst=${searchQuery}`;
        break;
      case '23andme':
        // 23andMe doesn't have public search
        await page.close().catch(() => {});
        return null;
      default:
        await page.close().catch(() => {});
        return null;
    }

    await page.goto(searchUrl, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);

    // Look for first result link
    const resultLink = await page.$eval(
      'a[href*="/person/"], a[href*="/tree/person/"], a[href*="/wiki/"]',
      el => el.getAttribute('href')
    ).catch(() => null);

    if (!resultLink) {
      await page.close().catch(() => {});
      return null;
    }

    // Extract ID from URL
    let externalId: string | null = null;
    if (targetProvider === 'familysearch') {
      const match = resultLink.match(/\/tree\/person\/(?:details\/)?([A-Z0-9-]+)/);
      externalId = match?.[1] || null;
    } else if (targetProvider === 'ancestry') {
      const match = resultLink.match(/\/person\/(\d+)/);
      externalId = match?.[1] || null;
    } else if (targetProvider === 'wikitree') {
      const match = resultLink.match(/\/wiki\/([A-Za-z]+-\d+)/);
      externalId = match?.[1] || null;
    }

    if (!externalId) {
      await page.close().catch(() => {});
      return null;
    }

    // Scrape the found person
    const data = await scraper.scrapePersonById(page, externalId);
    await page.close().catch(() => {});

    return data;
  },

  /**
   * Import a person from a provider into a database
   */
  async importPerson(
    provider: BuiltInProvider,
    externalId: string,
    dbId: string
  ): Promise<Person> {
    const dbPath = path.join(DATA_DIR, `db-${dbId}.json`);
    if (!fs.existsSync(dbPath)) {
      throw new Error(`Database ${dbId} not found`);
    }

    // Scrape the person
    const scraped = await this.scrapeFromProvider(provider, externalId);

    // Convert to Person format
    const person: Person = {
      name: scraped.name,
      lifespan: this.buildLifespan(scraped),
      living: false,
      gender: scraped.gender,
      birth: scraped.birth,
      death: scraped.death,
      parents: [],
      children: []
    };

    // Build parent references if we have them
    if (scraped.fatherExternalId) {
      person.parents[0] = scraped.fatherExternalId;
    }
    if (scraped.motherExternalId) {
      person.parents[1] = scraped.motherExternalId;
    }

    // Load and update database
    const db: Database = JSON.parse(fs.readFileSync(dbPath, 'utf-8'));
    db[externalId] = person;
    fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));

    return person;
  },

  /**
   * Open edit page on provider with local data (for pushing updates)
   */
  async pushUpdate(
    dbId: string,
    personId: string,
    targetProvider: BuiltInProvider
  ): Promise<{ editUrl: string }> {
    // Load local person data
    const dbPath = path.join(DATA_DIR, `db-${dbId}.json`);
    if (!fs.existsSync(dbPath)) {
      throw new Error(`Database ${dbId} not found`);
    }

    const db: Database = JSON.parse(fs.readFileSync(dbPath, 'utf-8'));
    const person = db[personId];
    if (!person) {
      throw new Error(`Person ${personId} not found`);
    }

    const scraper = providerService.getScraper(targetProvider);
    const editUrl = scraper.getPersonEditUrl(personId);

    // Open edit page in browser
    if (!browserService.isConnected()) {
      await browserService.connect();
    }

    await browserService.createPage(editUrl);

    return { editUrl };
  },

  /**
   * Batch sync database with a provider
   */
  async *syncDatabase(
    dbId: string,
    provider: BuiltInProvider,
    direction: 'import' | 'export' | 'both'
  ): AsyncGenerator<SyncProgress, void, undefined> {
    const dbPath = path.join(DATA_DIR, `db-${dbId}.json`);
    if (!fs.existsSync(dbPath)) {
      throw new Error(`Database ${dbId} not found`);
    }

    const db: Database = JSON.parse(fs.readFileSync(dbPath, 'utf-8'));
    const personIds = Object.keys(db);

    const progress: SyncProgress = {
      phase: 'initializing',
      currentIndex: 0,
      totalCount: personIds.length,
      imported: 0,
      exported: 0,
      skipped: 0,
      errors: []
    };

    yield { ...progress };

    if (!browserService.isConnected()) {
      await browserService.connect();
    }

    const config = providerService.getConfig(provider);

    for (let i = 0; i < personIds.length; i++) {
      const personId = personIds[i];
      progress.currentIndex = i + 1;
      progress.currentPerson = db[personId].name;
      progress.phase = direction === 'import' ? 'importing' : direction === 'export' ? 'exporting' : 'comparing';

      yield { ...progress };

      if (direction === 'import' || direction === 'both') {
        const scraped = await this.scrapeFromProvider(provider, personId).catch(err => {
          progress.errors.push(`${personId}: ${err.message}`);
          return null;
        });

        if (scraped) {
          // Update local data with scraped data
          db[personId] = this.mergePersonData(db[personId], scraped);
          progress.imported++;
        } else {
          progress.skipped++;
        }
      }

      if (direction === 'export' || direction === 'both') {
        // For export, we just track that we would push
        // Actual pushing requires manual review
        progress.exported++;
      }

      // Rate limiting delay
      const delay = config.rateLimit.minDelayMs +
        Math.random() * (config.rateLimit.maxDelayMs - config.rateLimit.minDelayMs);
      await new Promise(resolve => setTimeout(resolve, delay));
    }

    // Save updated database
    if (direction === 'import' || direction === 'both') {
      fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
    }

    progress.phase = 'complete';
    yield { ...progress };
  },

  /**
   * Calculate differences between local and provider data
   */
  calculateDifferences(
    local: Person,
    providerData: Record<BuiltInProvider, ScrapedPersonData | null>
  ): ProviderComparison['differences'] {
    const differences: ProviderComparison['differences'] = [];

    const fields: Array<{
      field: string;
      localValue: string | undefined;
      getValue: (s: ScrapedPersonData) => string | undefined;
    }> = [
      { field: 'name', localValue: local.name, getValue: s => s.name },
      { field: 'gender', localValue: local.gender, getValue: s => s.gender },
      { field: 'birthDate', localValue: local.birth?.date, getValue: s => s.birth?.date },
      { field: 'birthPlace', localValue: local.birth?.place, getValue: s => s.birth?.place },
      { field: 'deathDate', localValue: local.death?.date, getValue: s => s.death?.date },
      { field: 'deathPlace', localValue: local.death?.place, getValue: s => s.death?.place }
    ];

    for (const { field, localValue, getValue } of fields) {
      const providerValues: Record<BuiltInProvider, string | undefined> = {
        familysearch: providerData.familysearch ? getValue(providerData.familysearch) : undefined,
        ancestry: providerData.ancestry ? getValue(providerData.ancestry) : undefined,
        '23andme': providerData['23andme'] ? getValue(providerData['23andme']) : undefined,
        wikitree: providerData.wikitree ? getValue(providerData.wikitree) : undefined
      };

      // Check if any provider value differs from local
      const hasDifference = Object.values(providerValues).some(
        v => v !== undefined && v !== localValue
      );

      if (hasDifference) {
        differences.push({
          field,
          localValue,
          providerValues
        });
      }
    }

    return differences;
  },

  /**
   * Merge provider data into existing person
   */
  mergePersonData(existing: Person, scraped: ScrapedPersonData): Person {
    return {
      ...existing,
      name: scraped.name || existing.name,
      gender: scraped.gender || existing.gender,
      birth: scraped.birth || existing.birth,
      death: scraped.death || existing.death,
      lifespan: this.buildLifespan(scraped) || existing.lifespan
    };
  },

  /**
   * Build lifespan string from scraped data
   */
  buildLifespan(scraped: ScrapedPersonData): string {
    const birthYear = this.extractYear(scraped.birth?.date);
    const deathYear = this.extractYear(scraped.death?.date);

    if (birthYear || deathYear) {
      return `${birthYear || '?'}-${deathYear || ''}`;
    }
    return '';
  },

  /**
   * Extract year from date string
   */
  extractYear(date: string | undefined): string | undefined {
    if (!date) return undefined;

    const bcMatch = date.match(/(\d+)\s*BC/i);
    if (bcMatch) return `-${bcMatch[1]}`;

    const yearMatch = date.match(/(\d{4})/);
    return yearMatch?.[1];
  }
};
