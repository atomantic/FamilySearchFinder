import type {
  DatabaseInfo,
  PersonWithId,
  SearchResult,
  SearchParams,
  PathResult,
  TreeNode,
  IndexerStatus,
  IndexOptions,
  PersonAugmentation,
  GenealogyProviderConfig,
  GenealogyProviderRegistry,
  ProviderPersonMapping,
  PlatformType,
  GenealogyAuthType,
  FavoriteData,
  FavoritesList,
  FavoriteWithPerson,
  SparseTreeResult,
  AncestryTreeResult,
  AncestryFamilyUnit,
  ExpandAncestryRequest,
  BuiltInProvider,
  ProviderSessionStatus,
  UserProviderConfig,
  ProviderComparison,
  ScrapedPersonData
} from '@fsf/shared';

const BASE_URL = '/api';

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${BASE_URL}${url}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });

  const data = await response.json();

  if (!response.ok || !data.success) {
    throw new Error(data.error || 'Request failed');
  }

  return data.data;
}

export const api = {
  // Databases
  listDatabases: () => fetchJson<DatabaseInfo[]>('/databases'),

  getDatabase: (id: string) => fetchJson<DatabaseInfo>(`/databases/${id}`),

  deleteDatabase: (id: string) =>
    fetchJson<void>(`/databases/${id}`, { method: 'DELETE' }),

  // Persons
  listPersons: (dbId: string, page = 1, limit = 50) =>
    fetchJson<SearchResult>(`/persons/${dbId}?page=${page}&limit=${limit}`),

  getPerson: (dbId: string, personId: string) =>
    fetchJson<PersonWithId>(`/persons/${dbId}/${personId}`),

  getPersonTree: (dbId: string, personId: string, depth = 5, direction = 'ancestors') =>
    fetchJson<TreeNode>(`/persons/${dbId}/${personId}/tree?depth=${depth}&direction=${direction}`),

  // Search
  search: (dbId: string, params: SearchParams) => {
    const searchParams = new URLSearchParams();
    if (params.q) searchParams.set('q', params.q);
    if (params.location) searchParams.set('location', params.location);
    if (params.occupation) searchParams.set('occupation', params.occupation);
    if (params.birthAfter) searchParams.set('birthAfter', params.birthAfter);
    if (params.birthBefore) searchParams.set('birthBefore', params.birthBefore);
    if (params.page) searchParams.set('page', params.page.toString());
    if (params.limit) searchParams.set('limit', params.limit.toString());
    return fetchJson<SearchResult>(`/search/${dbId}?${searchParams}`);
  },

  // Path finding
  findPath: (dbId: string, source: string, target: string, method = 'shortest') =>
    fetchJson<PathResult>(`/path/${dbId}`, {
      method: 'POST',
      body: JSON.stringify({ source, target, method })
    }),

  // Indexer
  getIndexerStatus: () => fetchJson<IndexerStatus>('/indexer/status'),

  startIndexing: (options: IndexOptions) =>
    fetchJson<IndexerStatus>('/indexer/start', {
      method: 'POST',
      body: JSON.stringify(options)
    }),

  stopIndexing: () =>
    fetchJson<void>('/indexer/stop', { method: 'POST' }),

  // Export URLs (direct download)
  getExportTsvUrl: (dbId: string) => `${BASE_URL}/export/${dbId}/tsv`,
  getExportJsonUrl: (dbId: string) => `${BASE_URL}/export/${dbId}/json`,

  // Browser automation
  getBrowserStatus: () => fetchJson<BrowserStatus>('/browser/status'),

  getBrowserConfig: () => fetchJson<BrowserConfig>('/browser/config'),

  updateBrowserConfig: (config: Partial<BrowserConfig>) =>
    fetchJson<BrowserConfig>('/browser/config', {
      method: 'PUT',
      body: JSON.stringify(config)
    }),

  launchBrowser: () =>
    fetchJson<{ success: boolean; message: string }>('/browser/launch', { method: 'POST' }),

  checkBrowserRunning: () =>
    fetchJson<{ running: boolean }>('/browser/running'),

  connectBrowser: (cdpUrl?: string) =>
    fetchJson<BrowserStatus>('/browser/connect', {
      method: 'POST',
      body: JSON.stringify({ cdpUrl })
    }),

  disconnectBrowser: () =>
    fetchJson<{ connected: false }>('/browser/disconnect', { method: 'POST' }),

  openFamilySearchLogin: () =>
    fetchJson<{ url: string; isLoggedIn: boolean; message: string }>('/browser/login', {
      method: 'POST'
    }),

  scrapePerson: (personId: string) =>
    fetchJson<LegacyScrapedPersonData>(`/browser/scrape/${personId}`, { method: 'POST' }),

  getScrapedData: (personId: string) =>
    fetchJson<LegacyScrapedPersonData>(`/browser/scraped/${personId}`),

  hasPhoto: (personId: string) =>
    fetchJson<{ exists: boolean }>(`/browser/photos/${personId}/exists`),

  getPhotoUrl: (personId: string) => `${BASE_URL}/browser/photos/${personId}`,

  // Augmentation (Wikipedia, custom data)
  getAugmentation: (personId: string) =>
    fetchJson<PersonAugmentation>(`/augment/${personId}`),

  linkWikipedia: (personId: string, url: string) =>
    fetchJson<PersonAugmentation>(`/augment/${personId}/wikipedia`, {
      method: 'POST',
      body: JSON.stringify({ url })
    }),

  updateAugmentation: (personId: string, data: Partial<PersonAugmentation>) =>
    fetchJson<PersonAugmentation>(`/augment/${personId}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    }),

  hasWikiPhoto: (personId: string) =>
    fetchJson<{ exists: boolean }>(`/augment/${personId}/wiki-photo/exists`),

  getWikiPhotoUrl: (personId: string) => `${BASE_URL}/augment/${personId}/wiki-photo`,

  // Genealogy Providers
  listGenealogyProviders: () =>
    fetchJson<GenealogyProviderRegistry>('/genealogy-providers'),

  getGenealogyProvider: (id: string) =>
    fetchJson<GenealogyProviderConfig>(`/genealogy-providers/${id}`),

  createGenealogyProvider: (config: Partial<GenealogyProviderConfig>) =>
    fetchJson<GenealogyProviderConfig>('/genealogy-providers', {
      method: 'POST',
      body: JSON.stringify(config)
    }),

  updateGenealogyProvider: (id: string, config: Partial<GenealogyProviderConfig>) =>
    fetchJson<GenealogyProviderConfig>(`/genealogy-providers/${id}`, {
      method: 'PUT',
      body: JSON.stringify(config)
    }),

  deleteGenealogyProvider: (id: string) =>
    fetchJson<{ deleted: string }>(`/genealogy-providers/${id}`, { method: 'DELETE' }),

  testGenealogyProviderConnection: (id: string) =>
    fetchJson<{ success: boolean; message: string }>(`/genealogy-providers/${id}/test`, {
      method: 'POST'
    }),

  activateGenealogyProvider: (id: string) =>
    fetchJson<{ activeProvider: string }>(`/genealogy-providers/${id}/activate`, {
      method: 'POST'
    }),

  deactivateGenealogyProvider: () =>
    fetchJson<{ activeProvider: null }>('/genealogy-providers/deactivate', {
      method: 'POST'
    }),

  getGenealogyProviderDefaults: (platform: PlatformType) =>
    fetchJson<Partial<GenealogyProviderConfig>>(`/genealogy-providers/defaults/${platform}`),

  listGenealogyPlatforms: () =>
    fetchJson<Array<{ platform: PlatformType; name: string; authType: GenealogyAuthType }>>('/genealogy-providers/platforms'),

  // Provider person linking
  linkPersonToProvider: (personId: string, data: {
    providerId: string;
    platform: PlatformType;
    url: string;
    externalId?: string;
    confidence?: 'high' | 'medium' | 'low';
    matchedBy?: 'manual' | 'auto' | 'imported';
  }) =>
    fetchJson<PersonAugmentation>(`/augment/${personId}/provider-link`, {
      method: 'POST',
      body: JSON.stringify(data)
    }),

  unlinkPersonFromProvider: (personId: string, providerId: string) =>
    fetchJson<PersonAugmentation>(`/augment/${personId}/provider-link/${providerId}`, {
      method: 'DELETE'
    }),

  getPersonProviderLinks: (personId: string) =>
    fetchJson<ProviderPersonMapping[]>(`/augment/${personId}/provider-links`),

  // Favorites
  listFavorites: (page = 1, limit = 50) =>
    fetchJson<FavoritesList>(`/favorites?page=${page}&limit=${limit}`),

  getFavorite: (personId: string) =>
    fetchJson<FavoriteData | null>(`/favorites/${personId}`),

  addFavorite: (personId: string, whyInteresting: string, tags: string[] = []) =>
    fetchJson<PersonAugmentation>(`/favorites/${personId}`, {
      method: 'POST',
      body: JSON.stringify({ whyInteresting, tags })
    }),

  updateFavorite: (personId: string, whyInteresting: string, tags: string[] = []) =>
    fetchJson<PersonAugmentation>(`/favorites/${personId}`, {
      method: 'PUT',
      body: JSON.stringify({ whyInteresting, tags })
    }),

  removeFavorite: (personId: string) =>
    fetchJson<PersonAugmentation>(`/favorites/${personId}`, { method: 'DELETE' }),

  getFavoritesInDatabase: (dbId: string) =>
    fetchJson<FavoriteWithPerson[]>(`/favorites/in-database/${dbId}`),

  getFavoriteTags: () =>
    fetchJson<{ presetTags: string[]; allTags: string[] }>('/favorites/tags'),

  getSparseTree: (dbId: string) =>
    fetchJson<SparseTreeResult>(`/favorites/sparse-tree/${dbId}`),

  // Ancestry Tree (FamilySearch-style visualization)
  getAncestryTree: (dbId: string, personId: string, depth = 4) =>
    fetchJson<AncestryTreeResult>(`/ancestry-tree/${dbId}/${personId}?depth=${depth}`),

  expandAncestryGeneration: (dbId: string, request: ExpandAncestryRequest, depth = 2) =>
    fetchJson<AncestryFamilyUnit>(`/ancestry-tree/${dbId}/expand?depth=${depth}`, {
      method: 'POST',
      body: JSON.stringify(request)
    }),

  // Built-in Providers (browser-based)
  listProviders: () =>
    fetchJson<{
      providers: Array<{
        provider: BuiltInProvider;
        displayName: string;
        loginUrl: string;
        treeUrlPattern: string;
        supportsMultipleTrees: boolean;
        rateLimitDefaults: { minDelayMs: number; maxDelayMs: number };
        config: UserProviderConfig;
      }>;
      registry: { providers: Record<BuiltInProvider, UserProviderConfig>; lastUpdated: string };
      browserConnected: boolean;
    }>('/scrape-providers'),

  getProvider: (provider: BuiltInProvider) =>
    fetchJson<{ config: UserProviderConfig; info: unknown }>(`/providers/${provider}`),

  updateProvider: (provider: BuiltInProvider, updates: Partial<UserProviderConfig>) =>
    fetchJson<UserProviderConfig>(`/providers/${provider}`, {
      method: 'PUT',
      body: JSON.stringify(updates)
    }),

  toggleProvider: (provider: BuiltInProvider, enabled: boolean) =>
    fetchJson<UserProviderConfig>(`/providers/${provider}/toggle`, {
      method: 'POST',
      body: JSON.stringify({ enabled })
    }),

  toggleBrowserScrape: (provider: BuiltInProvider, enabled: boolean) =>
    fetchJson<UserProviderConfig>(`/providers/${provider}/toggle-browser-scrape`, {
      method: 'POST',
      body: JSON.stringify({ enabled })
    }),

  confirmBrowserLogin: (provider: BuiltInProvider, loggedIn: boolean) =>
    fetchJson<UserProviderConfig>(`/providers/${provider}/confirm-browser-login`, {
      method: 'POST',
      body: JSON.stringify({ loggedIn })
    }),

  checkProviderSession: (provider: BuiltInProvider) =>
    fetchJson<ProviderSessionStatus>(`/providers/${provider}/check-session`, {
      method: 'POST'
    }),

  checkAllProviderSessions: () =>
    fetchJson<Record<BuiltInProvider, ProviderSessionStatus>>('/scrape-providers/check-all-sessions', {
      method: 'POST'
    }),

  openProviderLogin: (provider: BuiltInProvider) =>
    fetchJson<{ url: string }>(`/providers/${provider}/login`, {
      method: 'POST'
    }),

  listProviderTrees: (provider: BuiltInProvider) =>
    fetchJson<Array<{ provider: BuiltInProvider; treeId: string; treeName: string }>>(`/providers/${provider}/trees`),

  setProviderDefaultTree: (provider: BuiltInProvider, treeId?: string) =>
    fetchJson<UserProviderConfig>(`/providers/${provider}/default-tree`, {
      method: 'POST',
      body: JSON.stringify({ treeId })
    }),

  updateProviderRateLimits: (provider: BuiltInProvider, minDelayMs: number, maxDelayMs: number) =>
    fetchJson<UserProviderConfig>(`/providers/${provider}/rate-limit`, {
      method: 'PUT',
      body: JSON.stringify({ minDelayMs, maxDelayMs })
    }),

  scrapeFromProvider: (provider: BuiltInProvider, personId: string) =>
    fetchJson<ScrapedPersonData>(`/providers/${provider}/scrape/${personId}`, {
      method: 'POST'
    }),

  // GEDCOM Import/Export
  getGedcomExportUrl: (dbId: string) => `${BASE_URL}/gedcom/export/${dbId}`,

  importGedcom: (content: string, dbName: string) =>
    fetchJson<{ dbId: string; personCount: number }>('/gedcom/import', {
      method: 'POST',
      body: JSON.stringify({ content, dbName })
    }),

  validateGedcom: (content: string) =>
    fetchJson<{ valid: boolean; errors: string[] }>('/gedcom/validate', {
      method: 'POST',
      body: JSON.stringify({ content })
    }),

  previewGedcom: (content: string) =>
    fetchJson<{
      header: { source?: string; version?: string };
      individualCount: number;
      familyCount: number;
      sampleIndividuals: Array<{ id: string; name: string; birthDate?: string; deathDate?: string }>;
    }>('/gedcom/preview', {
      method: 'POST',
      body: JSON.stringify({ content })
    }),

  // Sync
  compareAcrossProviders: (dbId: string, personId: string) =>
    fetchJson<ProviderComparison>(`/sync/${dbId}/${personId}/compare`),

  importPersonFromProvider: (dbId: string, personId: string, provider: BuiltInProvider, externalId?: string) =>
    fetchJson<unknown>(`/sync/${dbId}/${personId}/import`, {
      method: 'POST',
      body: JSON.stringify({ provider, externalId })
    }),

  pushToProvider: (dbId: string, personId: string, provider: BuiltInProvider) =>
    fetchJson<{ editUrl: string }>(`/sync/${dbId}/${personId}/push`, {
      method: 'POST',
      body: JSON.stringify({ provider })
    }),

  findMatchOnProvider: (dbId: string, personId: string, provider: BuiltInProvider) =>
    fetchJson<ScrapedPersonData | null>(`/sync/${dbId}/${personId}/find-match`, {
      method: 'POST',
      body: JSON.stringify({ provider })
    }),

  startDatabaseSync: (dbId: string, provider: BuiltInProvider, direction: 'import' | 'export' | 'both' = 'import') =>
    fetchJson<{ message: string; progressUrl: string }>(`/sync/database/${dbId}`, {
      method: 'POST',
      body: JSON.stringify({ provider, direction })
    })
};

// Browser types
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

export interface BrowserConfig {
  cdpPort: number;
  autoConnect: boolean;
}

// Legacy scraped data format (from browser scraper.service.ts)
export interface LegacyScrapedPersonData {
  id: string;
  photoUrl?: string;
  photoPath?: string;
  fullName?: string;
  birthDate?: string;
  birthPlace?: string;
  deathDate?: string;
  deathPlace?: string;
  scrapedAt: string;
}

// Re-export shared types
export type {
  PersonAugmentation,
  PlatformReference,
  PersonPhoto,
  PersonDescription,
  PlatformType,
  GenealogyProviderConfig,
  GenealogyProviderRegistry,
  ProviderPersonMapping,
  GenealogyAuthType,
  FavoriteData,
  FavoritesList,
  FavoriteWithPerson,
  SparseTreeNode,
  SparseTreeResult,
  AncestryTreeResult,
  AncestryFamilyUnit,
  AncestryPersonCard,
  ExpandAncestryRequest,
  BuiltInProvider,
  ProviderSessionStatus,
  UserProviderConfig,
  ProviderComparison,
  ScrapedPersonData,
  SyncProgress
} from '@fsf/shared';
