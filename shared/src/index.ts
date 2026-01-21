// Vital event (birth, death, burial)
export interface VitalEvent {
  date?: string;               // Original format (supports BC notation)
  dateFormal?: string;         // ISO-like formal date (+1151, -1620 for BC)
  place?: string;
  placeId?: string;            // For future geo features
}

// Person data stored in graph database
export interface Person {
  // Identity
  name: string;
  alternateNames?: string[];   // Aliases, maiden names, etc.
  gender?: 'male' | 'female' | 'unknown';
  living: boolean;

  // Vital Events
  birth?: VitalEvent;
  death?: VitalEvent;
  burial?: VitalEvent;

  // Life Details
  occupations?: string[];      // Multiple occupations/titles
  religion?: string;
  bio?: string;                // FamilySearch life sketch

  // Relationships (FamilySearch IDs)
  parents: string[];           // [fatherId, motherId] convention
  children: string[];
  spouses?: string[];

  // Metadata
  lastModified?: string;       // When FS record was last updated

  // Compatibility fields (computed from above)
  lifespan: string;            // Computed from birth.date and death.date
  location?: string;           // First available place (birth or death)
  occupation?: string;         // First occupation (for backwards compat)
}

// Platform reference for cross-platform linking
export type PlatformType = 'familysearch' | 'wikipedia' | 'findagrave' | 'heritage' | 'ancestry' | 'geni' | 'wikitree' | 'myheritage' | 'findmypast';

// Genealogy provider authentication types
export type GenealogyAuthType = 'oauth2' | 'api_key' | 'session_token' | 'none';

// Configuration for a genealogy data provider
export interface GenealogyProviderConfig {
  id: string;
  name: string;
  platform: PlatformType;
  enabled: boolean;
  authType: GenealogyAuthType;
  credentials?: {
    accessToken?: string;
    apiKey?: string;
    clientId?: string;
    clientSecret?: string;
  };
  rateLimit: {
    requestsPerWindow: number;
    windowSeconds: number;
    minDelayMs: number;
    maxDelayMs: number;
  };
  baseUrl: string;
  timeout: number;
  lastConnected?: string;
  connectionStatus?: 'connected' | 'disconnected' | 'error';
}

// Registry of all configured genealogy providers
export interface GenealogyProviderRegistry {
  activeProvider: string | null;
  providers: Record<string, GenealogyProviderConfig>;
}

// Mapping a person to an external provider record
export interface ProviderPersonMapping {
  platform: PlatformType;
  url: string;
  externalId?: string;
  linkedAt: string;
  verified?: boolean;
  providerId: string;
  confidence?: 'high' | 'medium' | 'low';
  matchedBy?: 'manual' | 'auto' | 'imported';
  lastSynced?: string;
}

export interface PlatformReference {
  platform: PlatformType;
  url: string;
  externalId?: string;         // Platform-specific ID
  linkedAt: string;            // When we linked it
  verified?: boolean;          // Manual verification flag
}

// Photo from any source
export interface PersonPhoto {
  url: string;
  source: string;              // Which platform
  localPath?: string;          // Downloaded copy
  isPrimary?: boolean;
  downloadedAt?: string;
}

// Description from any source
export interface PersonDescription {
  text: string;
  source: string;
  language?: string;
}

// Augmentation record for cross-platform data
export interface PersonAugmentation {
  id: string;                  // FamilySearch ID

  // Platform links
  platforms: PlatformReference[];

  // Consolidated data from all sources
  photos: PersonPhoto[];

  descriptions: PersonDescription[];

  // Custom overrides (user-provided)
  customBio?: string;
  customPhotoUrl?: string;
  notes?: string;              // Research notes

  // Provider-specific mappings (links to configured providers)
  providerMappings?: ProviderPersonMapping[];

  updatedAt: string;
}

// Graph database format (db-{id}.json)
export interface Database {
  [personId: string]: Person;
}

// Database metadata for listing
export interface DatabaseInfo {
  id: string;
  filename: string;
  personCount: number;
  rootId: string;
  rootName?: string;          // Name of the root person
  maxGenerations?: number;
  sourceProvider?: string;    // Provider ID that was used to create this database
  sourceRootExternalId?: string; // External ID from the source provider
}

// Person with ID included
export interface PersonWithId extends Person {
  id: string;
}

// Tree node for D3 visualization
export interface TreeNode {
  id: string;
  name: string;
  lifespan: string;
  location?: string;
  occupation?: string;
  children?: TreeNode[];
  _collapsed?: boolean;
}

// Path finding result
export interface PathResult {
  path: PersonWithId[];
  length: number;
  method: 'shortest' | 'longest' | 'random';
}

// Search query parameters
export interface SearchParams {
  q?: string;
  location?: string;
  occupation?: string;
  birthAfter?: string;
  birthBefore?: string;
  page?: number;
  limit?: number;
}

// Search result with pagination
export interface SearchResult {
  results: PersonWithId[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// Indexer job options
export interface IndexOptions {
  rootId: string;
  maxGenerations?: number;
  ignoreIds?: string[];
  cacheMode?: 'all' | 'complete' | 'none';
  oldest?: string;
}

// Indexer job status
export interface IndexerStatus {
  jobId: string | null;
  status: 'idle' | 'running' | 'stopping' | 'completed' | 'error';
  rootId?: string;
  progress?: IndexerProgress;
  startedAt?: string;
  error?: string;
}

// Indexer progress data
export interface IndexerProgress {
  new: number;
  cached: number;
  refreshed: number;
  generations: number;
  deepest: string;
  currentPerson?: string;
}

// SSE event types
export type IndexerEventType = 'started' | 'progress' | 'person' | 'completed' | 'error' | 'stopped';

export interface IndexerEvent {
  type: IndexerEventType;
  timestamp: string;
  data: {
    jobId?: string;
    rootId?: string;
    options?: IndexOptions;
    progress?: IndexerProgress;
    personId?: string;
    personName?: string;
    generation?: number;
    personStatus?: 'new' | 'cached' | 'refreshed';
    totalPersons?: number;
    databaseFile?: string;
    message?: string;
  };
}

// API response wrapper
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}
