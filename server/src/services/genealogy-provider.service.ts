import fs from 'fs';
import path from 'path';
import https from 'https';
import http from 'http';
import type {
  GenealogyProviderConfig,
  GenealogyProviderRegistry,
  GenealogyAuthType,
  PlatformType
} from '@fsf/shared';

const DATA_DIR = path.resolve(import.meta.dirname, '../../../data');
const CONFIG_FILE = path.join(DATA_DIR, 'genealogy-providers.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

// Default configurations for known platforms
const platformDefaults: Record<string, Partial<GenealogyProviderConfig>> = {
  familysearch: {
    name: 'FamilySearch',
    platform: 'familysearch',
    authType: 'session_token',
    baseUrl: 'https://api.familysearch.org',
    timeout: 10000,
    rateLimit: {
      requestsPerWindow: 100,
      windowSeconds: 60,
      minDelayMs: 200,
      maxDelayMs: 800
    }
  },
  myheritage: {
    name: 'MyHeritage',
    platform: 'myheritage',
    authType: 'oauth2',
    baseUrl: 'https://api.myheritage.com',
    timeout: 10000,
    rateLimit: {
      requestsPerWindow: 60,
      windowSeconds: 60,
      minDelayMs: 500,
      maxDelayMs: 1500
    }
  },
  geni: {
    name: 'Geni',
    platform: 'geni',
    authType: 'oauth2',
    baseUrl: 'https://api.geni.com',
    timeout: 10000,
    rateLimit: {
      requestsPerWindow: 40,
      windowSeconds: 10,
      minDelayMs: 250,
      maxDelayMs: 500
    }
  },
  wikitree: {
    name: 'WikiTree',
    platform: 'wikitree',
    authType: 'none',
    baseUrl: 'https://api.wikitree.com/api.php',
    timeout: 10000,
    rateLimit: {
      requestsPerWindow: 60,
      windowSeconds: 60,
      minDelayMs: 500,
      maxDelayMs: 1000
    }
  },
  findmypast: {
    name: 'FindMyPast',
    platform: 'findmypast',
    authType: 'api_key',
    baseUrl: 'https://api.findmypast.com',
    timeout: 10000,
    rateLimit: {
      requestsPerWindow: 30,
      windowSeconds: 60,
      minDelayMs: 1000,
      maxDelayMs: 2000
    }
  },
  ancestry: {
    name: 'Ancestry',
    platform: 'ancestry',
    authType: 'oauth2',
    baseUrl: 'https://api.ancestry.com',
    timeout: 10000,
    rateLimit: {
      requestsPerWindow: 30,
      windowSeconds: 60,
      minDelayMs: 1000,
      maxDelayMs: 2000
    }
  },
  findagrave: {
    name: 'Find A Grave',
    platform: 'findagrave',
    authType: 'none',
    baseUrl: 'https://www.findagrave.com',
    timeout: 10000,
    rateLimit: {
      requestsPerWindow: 20,
      windowSeconds: 60,
      minDelayMs: 2000,
      maxDelayMs: 5000
    }
  }
};

function loadRegistry(): GenealogyProviderRegistry {
  if (!fs.existsSync(CONFIG_FILE)) {
    return { activeProvider: null, providers: {} };
  }
  return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
}

function saveRegistry(registry: GenealogyProviderRegistry): void {
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(registry, null, 2));
}

export const genealogyProviderService = {
  getConfigPath(): string {
    return CONFIG_FILE;
  },

  getProviders(): GenealogyProviderRegistry {
    return loadRegistry();
  },

  getProvider(id: string): GenealogyProviderConfig | null {
    const registry = loadRegistry();
    return registry.providers[id] || null;
  },

  saveProvider(config: GenealogyProviderConfig): GenealogyProviderConfig {
    const registry = loadRegistry();

    // Ensure id is set
    if (!config.id) {
      config.id = config.platform + '-' + Date.now();
    }

    registry.providers[config.id] = {
      ...config,
      connectionStatus: config.connectionStatus || 'disconnected'
    };

    saveRegistry(registry);
    return registry.providers[config.id];
  },

  deleteProvider(id: string): void {
    const registry = loadRegistry();

    if (!registry.providers[id]) {
      throw new Error(`Provider ${id} not found`);
    }

    delete registry.providers[id];

    // Clear active provider if it was deleted
    if (registry.activeProvider === id) {
      registry.activeProvider = null;
    }

    saveRegistry(registry);
  },

  setActiveProvider(id: string | null): void {
    const registry = loadRegistry();

    if (id !== null && !registry.providers[id]) {
      throw new Error(`Provider ${id} not found`);
    }

    registry.activeProvider = id;
    saveRegistry(registry);
  },

  async testConnection(id: string): Promise<{ success: boolean; message: string }> {
    const registry = loadRegistry();
    const provider = registry.providers[id];

    if (!provider) {
      return { success: false, message: `Provider ${id} not found` };
    }

    // Platform-specific connection tests
    const testUrl = getTestUrl(provider);
    if (!testUrl) {
      return { success: false, message: `No test endpoint configured for ${provider.platform}` };
    }

    const result = await makeTestRequest(testUrl, provider);

    // Update connection status
    provider.connectionStatus = result.success ? 'connected' : 'error';
    provider.lastConnected = result.success ? new Date().toISOString() : provider.lastConnected;
    saveRegistry(registry);

    return result;
  },

  getProviderDefaults(platform: PlatformType): Partial<GenealogyProviderConfig> | null {
    return platformDefaults[platform] || null;
  },

  listPlatformDefaults(): Array<{ platform: PlatformType; name: string; authType: GenealogyAuthType }> {
    return Object.entries(platformDefaults).map(([platform, config]) => ({
      platform: platform as PlatformType,
      name: config.name || platform,
      authType: config.authType || 'none'
    }));
  }
};

function getTestUrl(provider: GenealogyProviderConfig): string | null {
  switch (provider.platform) {
    case 'familysearch':
      return `${provider.baseUrl}/platform/users/current`;
    case 'myheritage':
      return `${provider.baseUrl}/v1/users/me`;
    case 'geni':
      return `${provider.baseUrl}/api/user`;
    case 'wikitree':
      return `${provider.baseUrl}?action=getProfile&key=Churchill-4`;
    case 'findmypast':
      return `${provider.baseUrl}/v1/health`;
    case 'ancestry':
      return `${provider.baseUrl}/v1/users/me`;
    default:
      return null;
  }
}

function makeTestRequest(url: string, provider: GenealogyProviderConfig): Promise<{ success: boolean; message: string }> {
  return new Promise((resolve) => {
    const parsedUrl = new URL(url);
    const protocol = parsedUrl.protocol === 'https:' ? https : http;

    const headers: Record<string, string> = {
      'Accept': 'application/json',
      'User-Agent': 'FamilySearchFinder/1.0'
    };

    // Add authentication header based on auth type
    if (provider.credentials?.accessToken) {
      if (provider.authType === 'session_token') {
        headers['Authorization'] = `Bearer ${provider.credentials.accessToken}`;
      } else if (provider.authType === 'oauth2') {
        headers['Authorization'] = `Bearer ${provider.credentials.accessToken}`;
      }
    }
    if (provider.credentials?.apiKey && provider.authType === 'api_key') {
      headers['X-API-Key'] = provider.credentials.apiKey;
    }

    const options = {
      hostname: parsedUrl.hostname,
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'GET',
      headers,
      timeout: provider.timeout
    };

    const req = protocol.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
          resolve({ success: true, message: 'Connection successful' });
        } else if (res.statusCode === 401) {
          resolve({ success: false, message: 'Authentication failed - check credentials' });
        } else if (res.statusCode === 403) {
          resolve({ success: false, message: 'Access forbidden - check permissions' });
        } else {
          resolve({ success: false, message: `Request failed with status ${res.statusCode}` });
        }
      });
    });

    req.on('error', (err) => {
      resolve({ success: false, message: `Connection error: ${err.message}` });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({ success: false, message: 'Connection timed out' });
    });

    req.end();
  });
}
