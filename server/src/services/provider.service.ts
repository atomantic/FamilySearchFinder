import fs from 'fs';
import path from 'path';
import type {
  BuiltInProvider,
  ProviderRegistry,
  UserProviderConfig,
  ProviderSessionStatus,
  ProviderTreeInfo
} from '@fsf/shared';
import { browserService } from './browser.service.js';
import { getScraper, getProviderInfo, listProviders, PROVIDER_DEFAULTS } from './scrapers/index.js';

const DATA_DIR = path.resolve(import.meta.dirname, '../../../data');
const CONFIG_FILE = path.join(DATA_DIR, 'provider-config.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

/**
 * Create default configuration for all providers
 */
function createDefaultRegistry(): ProviderRegistry {
  const providers: Record<BuiltInProvider, UserProviderConfig> = {} as Record<BuiltInProvider, UserProviderConfig>;

  for (const provider of listProviders()) {
    const defaults = PROVIDER_DEFAULTS[provider];
    providers[provider] = {
      provider,
      enabled: provider === 'familysearch', // Enable FamilySearch by default
      defaultTreeId: undefined,
      rateLimit: defaults.rateLimitDefaults,
      browserScrapeEnabled: provider === 'familysearch', // Enable browser scrape for FamilySearch by default
      browserLoggedIn: false
    };
  }

  return {
    providers,
    lastUpdated: new Date().toISOString()
  };
}

/**
 * Load provider registry from disk
 */
function loadRegistry(): ProviderRegistry {
  if (!fs.existsSync(CONFIG_FILE)) {
    const defaultRegistry = createDefaultRegistry();
    saveRegistry(defaultRegistry);
    return defaultRegistry;
  }

  const data = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8')) as ProviderRegistry;

  // Ensure all providers exist (migration for new providers)
  let needsSave = false;
  for (const provider of listProviders()) {
    if (!data.providers[provider]) {
      const defaults = PROVIDER_DEFAULTS[provider];
      data.providers[provider] = {
        provider,
        enabled: false,
        defaultTreeId: undefined,
        rateLimit: defaults.rateLimitDefaults,
        browserScrapeEnabled: false,
        browserLoggedIn: false
      };
      needsSave = true;
    } else {
      // Migrate existing configs to have browser scrape fields
      const config = data.providers[provider];
      if (config.browserScrapeEnabled === undefined) {
        config.browserScrapeEnabled = config.enabled; // Match existing enabled state
        config.browserLoggedIn = false;
        needsSave = true;
      }
    }
  }

  if (needsSave) {
    saveRegistry(data);
  }

  return data;
}

/**
 * Save provider registry to disk
 */
function saveRegistry(registry: ProviderRegistry): void {
  registry.lastUpdated = new Date().toISOString();
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(registry, null, 2));
}

/**
 * Provider service for managing built-in provider configurations and sessions
 */
export const providerService = {
  /**
   * Get the config file path
   */
  getConfigPath(): string {
    return CONFIG_FILE;
  },

  /**
   * Get all provider configurations
   */
  getAllConfigs(): ProviderRegistry {
    return loadRegistry();
  },

  /**
   * Get configuration for a specific provider
   */
  getConfig(provider: BuiltInProvider): UserProviderConfig {
    const registry = loadRegistry();
    return registry.providers[provider];
  },

  /**
   * Save/update configuration for a provider
   */
  saveConfig(config: UserProviderConfig): UserProviderConfig {
    const registry = loadRegistry();
    registry.providers[config.provider] = config;
    saveRegistry(registry);
    return config;
  },

  /**
   * Toggle provider enabled state
   */
  toggleProvider(provider: BuiltInProvider, enabled: boolean): UserProviderConfig {
    const config = this.getConfig(provider);
    config.enabled = enabled;
    return this.saveConfig(config);
  },

  /**
   * Toggle browser scrape enabled state
   */
  toggleBrowserScrape(provider: BuiltInProvider, enabled: boolean): UserProviderConfig {
    const config = this.getConfig(provider);
    config.browserScrapeEnabled = enabled;
    // If disabling, also clear the logged in flag
    if (!enabled) {
      config.browserLoggedIn = false;
      config.browserLastLogin = undefined;
    }
    return this.saveConfig(config);
  },

  /**
   * Confirm browser login status
   */
  confirmBrowserLogin(provider: BuiltInProvider, loggedIn: boolean): UserProviderConfig {
    const config = this.getConfig(provider);
    config.browserLoggedIn = loggedIn;
    config.browserLastLogin = loggedIn ? new Date().toISOString() : undefined;
    return this.saveConfig(config);
  },

  /**
   * Update rate limits for a provider
   */
  updateRateLimits(
    provider: BuiltInProvider,
    minDelayMs: number,
    maxDelayMs: number
  ): UserProviderConfig {
    const config = this.getConfig(provider);
    config.rateLimit = { minDelayMs, maxDelayMs };
    return this.saveConfig(config);
  },

  /**
   * Set default tree ID for a provider
   */
  setDefaultTree(provider: BuiltInProvider, treeId: string | undefined): UserProviderConfig {
    const config = this.getConfig(provider);
    config.defaultTreeId = treeId;
    return this.saveConfig(config);
  },

  /**
   * Check browser login status for a provider
   */
  async checkSession(provider: BuiltInProvider): Promise<ProviderSessionStatus> {
    const config = this.getConfig(provider);
    const scraper = getScraper(provider);

    const status: ProviderSessionStatus = {
      provider,
      enabled: config.enabled,
      loggedIn: false,
      lastChecked: new Date().toISOString()
    };

    // Ensure browser is connected
    if (!browserService.isConnected()) {
      await browserService.connect().catch(() => null);
    }

    if (!browserService.isConnected()) {
      return status;
    }

    const page = await browserService.createPage();

    status.loggedIn = await scraper.checkLoginStatus(page).catch(() => false);

    if (status.loggedIn) {
      const userInfo = await scraper.getLoggedInUser(page).catch(() => null);
      status.userName = userInfo?.name;
    }

    // Close the page we created
    await page.close().catch(() => {});

    return status;
  },

  /**
   * Check session status for all enabled providers
   */
  async checkAllSessions(): Promise<Record<BuiltInProvider, ProviderSessionStatus>> {
    const registry = loadRegistry();
    const results: Record<BuiltInProvider, ProviderSessionStatus> = {} as Record<BuiltInProvider, ProviderSessionStatus>;

    for (const provider of listProviders()) {
      if (registry.providers[provider].enabled) {
        results[provider] = await this.checkSession(provider);
      } else {
        results[provider] = {
          provider,
          enabled: false,
          loggedIn: false,
          lastChecked: new Date().toISOString()
        };
      }
    }

    return results;
  },

  /**
   * Discover available trees for a provider
   */
  async discoverTrees(provider: BuiltInProvider): Promise<ProviderTreeInfo[]> {
    const scraper = getScraper(provider);

    if (!browserService.isConnected()) {
      await browserService.connect();
    }

    const page = await browserService.createPage();
    const trees = await scraper.listTrees(page).catch(() => []);

    await page.close().catch(() => {});

    return trees;
  },

  /**
   * Open login page for a provider in the browser
   */
  async openLoginPage(provider: BuiltInProvider): Promise<{ url: string }> {
    const info = getProviderInfo(provider);

    if (!browserService.isConnected()) {
      await browserService.connect();
    }

    await browserService.createPage(info.loginUrl);

    return { url: info.loginUrl };
  },

  /**
   * Get scraper for a provider
   */
  getScraper(provider: BuiltInProvider) {
    return getScraper(provider);
  },

  /**
   * Get provider info/metadata
   */
  getProviderInfo(provider: BuiltInProvider) {
    return getProviderInfo(provider);
  },

  /**
   * List all provider info
   */
  listProviderInfo() {
    return listProviders().map(p => ({
      ...getProviderInfo(p),
      config: this.getConfig(p)
    }));
  }
};
