// Person data stored in graph database
export interface Person {
  name: string;
  lifespan: string;
  location?: string;
  occupation?: string;
  bio?: string;
  parents: string[];
  children: string[];
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
  maxGenerations?: number;
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
