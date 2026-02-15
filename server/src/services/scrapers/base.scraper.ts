import { Page } from 'playwright';
import type { BuiltInProvider, ProviderTreeInfo, ScrapedPersonData } from '@fsf/shared';

/**
 * Base interface for all provider scrapers.
 * Each provider scraper implements browser-based data extraction.
 */
export interface ProviderScraper {
  /** Provider identifier */
  readonly provider: BuiltInProvider;

  /** Human-readable provider name */
  readonly displayName: string;

  /** URL to provider login page */
  readonly loginUrl: string;

  /** URL pattern for tree pages (with placeholders) */
  readonly treeUrlPattern: string;

  /**
   * Check if user is logged in to this provider
   */
  checkLoginStatus(page: Page): Promise<boolean>;

  /**
   * Get logged-in user information
   */
  getLoggedInUser(page: Page): Promise<{ name?: string; userId?: string } | null>;

  /**
   * List available trees for the user (if provider supports multiple trees)
   */
  listTrees(page: Page): Promise<ProviderTreeInfo[]>;

  /**
   * Scrape a single person by their external ID
   */
  scrapePersonById(page: Page, externalId: string): Promise<ScrapedPersonData>;

  /**
   * Scrape ancestors starting from a root person
   * Returns an async generator for progress reporting
   */
  scrapeAncestors(
    page: Page,
    rootId: string,
    maxGenerations?: number
  ): AsyncGenerator<ScrapedPersonData, void, undefined>;

  /**
   * Build URL to view a person on this provider
   */
  getPersonUrl(externalId: string): string;

  /**
   * Build URL to edit a person on this provider
   */
  getPersonEditUrl(externalId: string): string;
}

/**
 * Progress callback for scraping operations
 */
export interface ScrapeProgress {
  phase: 'connecting' | 'navigating' | 'scraping' | 'downloading' | 'complete' | 'error';
  message: string;
  personId?: string;
  data?: ScrapedPersonData;
  error?: string;
  generation?: number;
  progress?: {
    current: number;
    total?: number;
  };
}

export type ProgressCallback = (progress: ScrapeProgress) => void;

/**
 * Provider metadata for UI display
 */
export interface ProviderInfo {
  provider: BuiltInProvider;
  displayName: string;
  loginUrl: string;
  treeUrlPattern: string;
  logoUrl?: string;
  supportsMultipleTrees: boolean;
  rateLimitDefaults: {
    minDelayMs: number;
    maxDelayMs: number;
  };
}

/**
 * Default rate limits by provider
 */
export const PROVIDER_DEFAULTS: Record<BuiltInProvider, ProviderInfo> = {
  familysearch: {
    provider: 'familysearch',
    displayName: 'FamilySearch',
    loginUrl: 'https://www.familysearch.org/auth/familysearch/login',
    treeUrlPattern: 'https://www.familysearch.org/tree/pedigree/landscape/{id}',
    supportsMultipleTrees: false,
    rateLimitDefaults: { minDelayMs: 500, maxDelayMs: 1500 }
  },
  ancestry: {
    provider: 'ancestry',
    displayName: 'Ancestry',
    loginUrl: 'https://www.ancestry.com/account/signin',
    treeUrlPattern: 'https://www.ancestry.com/family-tree/tree/{treeId}/family',
    supportsMultipleTrees: true,
    rateLimitDefaults: { minDelayMs: 1000, maxDelayMs: 3000 }
  },
  '23andme': {
    provider: '23andme',
    displayName: '23andMe',
    loginUrl: 'https://you.23andme.com/',
    treeUrlPattern: 'https://you.23andme.com/family/tree/',
    supportsMultipleTrees: false,
    rateLimitDefaults: { minDelayMs: 1000, maxDelayMs: 3000 }
  },
  wikitree: {
    provider: 'wikitree',
    displayName: 'WikiTree',
    loginUrl: 'https://www.wikitree.com/wiki/Special:Userlogin',
    treeUrlPattern: 'https://www.wikitree.com/wiki/{id}',
    supportsMultipleTrees: false,
    rateLimitDefaults: { minDelayMs: 500, maxDelayMs: 1500 }
  }
};
