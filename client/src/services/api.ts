import type {
  DatabaseInfo,
  PersonWithId,
  SearchResult,
  SearchParams,
  PathResult,
  TreeNode,
  IndexerStatus,
  IndexOptions,
  PersonAugmentation
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

  getWikiPhotoUrl: (personId: string) => `${BASE_URL}/augment/${personId}/wiki-photo`
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
export type { PersonAugmentation, PlatformReference, PersonPhoto, PersonDescription, PlatformType } from '@fsf/shared';
