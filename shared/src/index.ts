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
export type PlatformType = 'familysearch' | 'wikipedia' | 'findagrave' | 'heritage' | 'ancestry' | 'geni' | 'wikitree' | 'myheritage' | 'findmypast' | '23andme';

// Built-in provider types (browser-based scrapers)
export type BuiltInProvider = 'familysearch' | 'ancestry' | '23andme' | 'wikitree';

// Legacy: Genealogy provider authentication types (kept for backward compatibility)
export type GenealogyAuthType = 'oauth2' | 'api_key' | 'session_token' | 'none';

// Legacy: Configuration for a genealogy data provider (kept for backward compatibility)
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

// Legacy: Registry of all configured genealogy providers (kept for backward compatibility)
export interface GenealogyProviderRegistry {
  activeProvider: string | null;
  providers: Record<string, GenealogyProviderConfig>;
}

// Provider session status (checked via browser)
export interface ProviderSessionStatus {
  provider: BuiltInProvider;
  enabled: boolean;
  loggedIn: boolean;
  lastChecked?: string;
  userName?: string;
}

// Tree information from a provider
export interface ProviderTreeInfo {
  provider: BuiltInProvider;
  treeId: string;
  treeName: string;
  personCount?: number;
  rootPersonId?: string;
}

// User configuration for a provider
export interface UserProviderConfig {
  provider: BuiltInProvider;
  enabled: boolean;
  defaultTreeId?: string;
  rateLimit: {
    minDelayMs: number;
    maxDelayMs: number;
  };
  // Browser scrape options
  browserScrapeEnabled: boolean;  // Whether browser scraping is enabled for this provider
  browserLoggedIn: boolean;       // User has confirmed they've logged into browser for this provider
  browserLastLogin?: string;      // Last time user confirmed browser login (ISO date)
}

// Registry of all provider configurations
export interface ProviderRegistry {
  providers: Record<BuiltInProvider, UserProviderConfig>;
  lastUpdated: string;
}

// Scraped person data from any provider
export interface ScrapedPersonData {
  externalId: string;
  provider: BuiltInProvider;
  name: string;
  gender?: 'male' | 'female' | 'unknown';
  birth?: { date?: string; place?: string };
  death?: { date?: string; place?: string };
  fatherExternalId?: string;
  motherExternalId?: string;
  spouseExternalIds?: string[];
  photoUrl?: string;
  sourceUrl: string;
  scrapedAt: string;
}

// GEDCOM Types
export interface GedcomPerson {
  id: string;
  name: string;
  givenName?: string;
  surname?: string;
  gender?: 'M' | 'F' | 'U';
  birth?: { date?: string; place?: string };
  death?: { date?: string; place?: string };
  burial?: { date?: string; place?: string };
  familyChildIds?: string[];  // FAM IDs where this person is a child
  familySpouseIds?: string[]; // FAM IDs where this person is a spouse
  notes?: string;
}

export interface GedcomFamily {
  id: string;
  husbandId?: string;
  wifeId?: string;
  childIds?: string[];
  marriageDate?: string;
  marriagePlace?: string;
}

export interface GedcomFile {
  header: {
    source?: string;
    version?: string;
    charset?: string;
    submitter?: string;
  };
  individuals: Record<string, GedcomPerson>;
  families: Record<string, GedcomFamily>;
}

// Sync types
export interface ProviderComparison {
  personId: string;
  localPerson: Person;
  providerData: Record<BuiltInProvider, ScrapedPersonData | null>;
  differences: Array<{
    field: string;
    localValue?: string;
    providerValues: Record<BuiltInProvider, string | undefined>;
  }>;
}

export interface SyncProgress {
  phase: 'initializing' | 'comparing' | 'importing' | 'exporting' | 'complete' | 'error';
  currentIndex: number;
  totalCount: number;
  currentPerson?: string;
  imported: number;
  exported: number;
  skipped: number;
  errors: string[];
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

// Favorite data for a person
export interface FavoriteData {
  isFavorite: boolean;
  whyInteresting: string;
  addedAt: string;
  tags: string[];  // Categorization (e.g., "royalty", "notable", "immigrant", "revolutionary")
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

  // Favorite marking
  favorite?: FavoriteData;

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

// Sparse tree node for favorites visualization
export interface SparseTreeNode {
  id: string;
  name: string;
  lifespan: string;
  gender?: 'male' | 'female' | 'unknown';
  side?: 'paternal' | 'maternal';  // Which side of the family (from root's perspective)
  photoUrl?: string;
  whyInteresting?: string;
  tags?: string[];
  generationFromRoot: number;
  generationsSkipped?: number;  // From previous visible node
  isFavorite: boolean;
  children?: SparseTreeNode[];
}

// Sparse tree result
export interface SparseTreeResult {
  root: SparseTreeNode;
  totalFavorites: number;
  maxGeneration: number;
}

// Favorite with person info (for listing)
export interface FavoriteWithPerson {
  personId: string;
  name: string;
  lifespan: string;
  photoUrl?: string;
  favorite: FavoriteData;
  databases: string[];  // Which databases contain this person
}

// Favorites list response
export interface FavoritesList {
  favorites: FavoriteWithPerson[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  allTags: string[];  // All unique tags across favorites
}

// Ancestry Tree Types (FamilySearch-style visualization)

// Person card data for ancestry tree
export interface AncestryPersonCard {
  id: string;
  name: string;
  lifespan: string;
  gender: 'male' | 'female' | 'unknown';
  photoUrl?: string;
  hasMoreAncestors: boolean;
}

// Family unit containing father and mother cards
export interface AncestryFamilyUnit {
  id: string;
  father?: AncestryPersonCard;
  mother?: AncestryPersonCard;
  generation: number;
  parentUnits?: AncestryFamilyUnit[];
}

// Full ancestry tree result
export interface AncestryTreeResult {
  rootPerson: AncestryPersonCard;
  rootSpouse?: AncestryPersonCard;
  parentUnits?: AncestryFamilyUnit[];
  maxGenerationLoaded: number;
}

// Request to expand a specific generation
export interface ExpandAncestryRequest {
  fatherId?: string;
  motherId?: string;
}
