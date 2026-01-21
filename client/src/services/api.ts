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
  SparseTreeResult
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
    fetchJson<ScrapedPersonData>(`/browser/scrape/${personId}`, { method: 'POST' }),

  getScrapedData: (personId: string) =>
    fetchJson<ScrapedPersonData>(`/browser/scraped/${personId}`),

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
    fetchJson<SparseTreeResult>(`/favorites/sparse-tree/${dbId}`)
};

// Browser types
export interface BrowserStatus {
  connected: boolean;
  cdpUrl: string;
  pageCount: number;
  pages: Array<{ url: string; title: string }>;
  familySearchLoggedIn: boolean;
}

export interface ScrapedPersonData {
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
  SparseTreeResult
} from '@fsf/shared';
