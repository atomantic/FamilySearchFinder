import { useEffect, useState } from 'react';
import {
  Database,
  RefreshCw,
  ExternalLink,
  CheckCircle2,
  XCircle,
  Loader2,
  LogIn,
  Settings,
  ChevronDown,
  ChevronUp,
  Globe,
  UserCheck
} from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '../services/api';
import type { BuiltInProvider, ProviderSessionStatus, UserProviderConfig } from '@fsf/shared';

interface ProviderInfo {
  provider: BuiltInProvider;
  displayName: string;
  loginUrl: string;
  treeUrlPattern: string;
  supportsMultipleTrees: boolean;
  rateLimitDefaults: {
    minDelayMs: number;
    maxDelayMs: number;
  };
  config: UserProviderConfig;
}

interface ProviderData {
  providers: ProviderInfo[];
  registry: {
    providers: Record<BuiltInProvider, UserProviderConfig>;
    lastUpdated: string;
  };
  browserConnected: boolean;
}

const providerColors: Record<BuiltInProvider, { bg: string; text: string; border: string }> = {
  familysearch: { bg: 'bg-green-600/10', text: 'text-green-400', border: 'border-green-600/30' },
  ancestry: { bg: 'bg-amber-600/10', text: 'text-amber-400', border: 'border-amber-600/30' },
  '23andme': { bg: 'bg-purple-600/10', text: 'text-purple-400', border: 'border-purple-600/30' },
  wikitree: { bg: 'bg-blue-600/10', text: 'text-blue-400', border: 'border-blue-600/30' }
};

export function ProvidersPage() {
  const [data, setData] = useState<ProviderData | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionStatus, setSessionStatus] = useState<Record<BuiltInProvider, ProviderSessionStatus>>({} as Record<BuiltInProvider, ProviderSessionStatus>);
  const [checkingSession, setCheckingSession] = useState<BuiltInProvider | null>(null);
  const [expandedProvider, setExpandedProvider] = useState<BuiltInProvider | null>(null);
  const [togglingProvider, setTogglingProvider] = useState<BuiltInProvider | null>(null);
  const [openingLogin, setOpeningLogin] = useState<BuiltInProvider | null>(null);
  const [togglingBrowserScrape, setTogglingBrowserScrape] = useState<BuiltInProvider | null>(null);
  const [confirmingLogin, setConfirmingLogin] = useState<BuiltInProvider | null>(null);

  const loadProviders = () => {
    setLoading(true);
    api.listProviders()
      .then(setData)
      .catch(err => toast.error(`Failed to load providers: ${err.message}`))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadProviders();
  }, []);

  const handleCheckSession = async (provider: BuiltInProvider) => {
    setCheckingSession(provider);

    const status = await api.checkProviderSession(provider)
      .catch(err => {
        toast.error(`Failed to check session: ${err.message}`);
        return null;
      });

    if (status) {
      setSessionStatus(prev => ({ ...prev, [provider]: status }));
      if (status.loggedIn) {
        toast.success(`${provider}: Logged in${status.userName ? ` as ${status.userName}` : ''}`);
      } else {
        toast(`${provider}: Not logged in`, { icon: '!' });
      }
    }

    setCheckingSession(null);
  };

  const handleToggleProvider = async (provider: BuiltInProvider, enabled: boolean) => {
    setTogglingProvider(provider);

    const result = await api.toggleProvider(provider, enabled)
      .catch(err => {
        toast.error(`Failed to toggle provider: ${err.message}`);
        return null;
      });

    if (result) {
      toast.success(`${provider} ${enabled ? 'enabled' : 'disabled'}`);
      loadProviders();
    }

    setTogglingProvider(null);
  };

  const handleOpenLogin = async (provider: BuiltInProvider) => {
    setOpeningLogin(provider);

    const result = await api.openProviderLogin(provider)
      .catch(err => {
        toast.error(`Failed to open login: ${err.message}`);
        return null;
      });

    if (result) {
      toast.success(`Opened ${provider} login in browser`);
    }

    setOpeningLogin(null);
  };

  const handleUpdateRateLimits = async (provider: BuiltInProvider, minDelayMs: number, maxDelayMs: number) => {
    const result = await api.updateProviderRateLimits(provider, minDelayMs, maxDelayMs)
      .catch(err => {
        toast.error(`Failed to update rate limits: ${err.message}`);
        return null;
      });

    if (result) {
      toast.success('Rate limits updated');
      loadProviders();
    }
  };

  const handleToggleBrowserScrape = async (provider: BuiltInProvider, enabled: boolean) => {
    setTogglingBrowserScrape(provider);

    const result = await api.toggleBrowserScrape(provider, enabled)
      .catch(err => {
        toast.error(`Failed to toggle browser scrape: ${err.message}`);
        return null;
      });

    if (result) {
      toast.success(`Browser scraping ${enabled ? 'enabled' : 'disabled'} for ${provider}`);
      loadProviders();
    }

    setTogglingBrowserScrape(null);
  };

  const handleConfirmBrowserLogin = async (provider: BuiltInProvider, loggedIn: boolean) => {
    setConfirmingLogin(provider);

    const result = await api.confirmBrowserLogin(provider, loggedIn)
      .catch(err => {
        toast.error(`Failed to confirm login: ${err.message}`);
        return null;
      });

    if (result) {
      toast.success(loggedIn ? `Confirmed logged into ${provider}` : `Cleared login status for ${provider}`);
      loadProviders();
    }

    setConfirmingLogin(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="animate-spin text-app-text-muted" size={32} />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-12 text-app-error">
        Failed to load providers
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Database size={24} className="text-app-accent" />
          <h1 className="text-2xl font-bold text-app-text">Genealogy Providers</h1>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-sm ${data.browserConnected ? 'text-green-400' : 'text-red-400'}`}>
            Browser: {data.browserConnected ? 'Connected' : 'Disconnected'}
          </span>
          <button
            onClick={loadProviders}
            className="p-2 text-app-text-muted hover:text-app-text hover:bg-app-border rounded transition-colors"
            title="Refresh"
          >
            <RefreshCw size={18} />
          </button>
        </div>
      </div>

      {/* Info banner */}
      <div className="bg-app-card border border-app-border rounded-lg p-4 mb-6">
        <p className="text-app-text-muted text-sm">
          These providers use browser automation to access your family tree data.
          Make sure you're logged in to each provider in the connected browser before using them.
        </p>
      </div>

      {/* Provider Cards */}
      <div className="space-y-4">
        {data.providers.map(providerInfo => {
          const { provider, displayName, config } = providerInfo;
          const colors = providerColors[provider];
          const status = sessionStatus[provider];
          const isExpanded = expandedProvider === provider;
          const isCheckingThis = checkingSession === provider;
          const isTogglingThis = togglingProvider === provider;
          const isOpeningLoginThis = openingLogin === provider;
          const isTogglingBrowserScrapeThis = togglingBrowserScrape === provider;
          const isConfirmingLoginThis = confirmingLogin === provider;

          return (
            <div
              key={provider}
              className={`bg-app-card rounded-lg border transition-colors ${
                config.enabled ? colors.border : 'border-app-border'
              }`}
            >
              {/* Main card content */}
              <div className="p-4">
                <div className="flex items-center justify-between">
                  {/* Left: Provider info */}
                  <div className="flex items-center gap-4">
                    {/* Provider badge */}
                    <div className={`px-3 py-1.5 rounded-lg ${colors.bg} ${colors.text} font-medium`}>
                      {displayName}
                    </div>

                    {/* Status indicators */}
                    <div className="flex items-center gap-2 flex-wrap">
                      {/* Enabled status */}
                      <span className={`text-xs px-2 py-0.5 rounded ${
                        config.enabled
                          ? 'bg-green-600/20 text-green-400'
                          : 'bg-app-text-subtle/20 text-app-text-subtle'
                      }`}>
                        {config.enabled ? 'Enabled' : 'Disabled'}
                      </span>

                      {/* Browser scrape status */}
                      <span className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded ${
                        config.browserScrapeEnabled
                          ? 'bg-blue-600/20 text-blue-400'
                          : 'bg-app-text-subtle/20 text-app-text-subtle'
                      }`}>
                        <Globe size={10} />
                        {config.browserScrapeEnabled ? 'Scrape On' : 'Scrape Off'}
                      </span>

                      {/* Browser login confirmation status */}
                      {config.browserScrapeEnabled && (
                        <span className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded ${
                          config.browserLoggedIn
                            ? 'bg-green-600/20 text-green-400'
                            : 'bg-amber-600/20 text-amber-400'
                        }`}>
                          <UserCheck size={10} />
                          {config.browserLoggedIn ? 'Logged In' : 'Not Logged In'}
                        </span>
                      )}

                      {/* Live session check status */}
                      {status && (
                        <span className={`flex items-center gap-1 text-xs ${
                          status.loggedIn ? 'text-green-400' : 'text-red-400'
                        }`}>
                          {status.loggedIn ? (
                            <>
                              <CheckCircle2 size={12} />
                              {status.userName || 'Session active'}
                            </>
                          ) : (
                            <>
                              <XCircle size={12} />
                              Session inactive
                            </>
                          )}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Right: Actions */}
                  <div className="flex items-center gap-2">
                    {/* Check Session */}
                    <button
                      onClick={() => handleCheckSession(provider)}
                      disabled={isCheckingThis || !data.browserConnected}
                      className="flex items-center gap-1 px-3 py-1.5 bg-app-border text-app-text-secondary rounded hover:bg-app-hover transition-colors disabled:opacity-50 text-sm"
                      title="Check login status"
                    >
                      {isCheckingThis ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <RefreshCw size={14} />
                      )}
                      Check
                    </button>

                    {/* Open Login */}
                    <button
                      onClick={() => handleOpenLogin(provider)}
                      disabled={isOpeningLoginThis || !data.browserConnected}
                      className="flex items-center gap-1 px-3 py-1.5 bg-app-border text-app-text-secondary rounded hover:bg-app-hover transition-colors disabled:opacity-50 text-sm"
                      title="Open login page in browser"
                    >
                      {isOpeningLoginThis ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <LogIn size={14} />
                      )}
                      Login
                    </button>

                    {/* Toggle */}
                    <button
                      onClick={() => handleToggleProvider(provider, !config.enabled)}
                      disabled={isTogglingThis}
                      className={`px-3 py-1.5 rounded text-sm transition-colors disabled:opacity-50 ${
                        config.enabled
                          ? 'bg-green-600/20 text-green-400 hover:bg-green-600/30'
                          : 'bg-app-text-subtle/20 text-app-text-muted hover:bg-app-text-subtle/30'
                      }`}
                    >
                      {isTogglingThis ? (
                        <Loader2 size={14} className="animate-spin inline" />
                      ) : config.enabled ? 'Disable' : 'Enable'}
                    </button>

                    {/* Expand settings */}
                    <button
                      onClick={() => setExpandedProvider(isExpanded ? null : provider)}
                      className="p-1.5 text-app-text-muted hover:text-app-text hover:bg-app-border rounded transition-colors"
                    >
                      {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Expanded settings */}
              {isExpanded && (
                <div className="border-t border-app-border p-4 bg-app-bg/50">
                  <div className="grid grid-cols-2 gap-6">
                    {/* Browser Scrape Options */}
                    <div>
                      <h4 className="text-sm font-medium text-app-text-secondary mb-3 flex items-center gap-2">
                        <Globe size={14} />
                        Browser Scrape Options
                      </h4>
                      <div className="space-y-3">
                        {/* Enable/disable browser scraping */}
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-app-text-muted">Enable Browser Scraping</span>
                          <button
                            onClick={() => handleToggleBrowserScrape(provider, !config.browserScrapeEnabled)}
                            disabled={isTogglingBrowserScrapeThis}
                            className={`px-3 py-1 rounded text-xs transition-colors ${
                              config.browserScrapeEnabled
                                ? 'bg-blue-600/20 text-blue-400 hover:bg-blue-600/30'
                                : 'bg-app-text-subtle/20 text-app-text-muted hover:bg-app-text-subtle/30'
                            }`}
                          >
                            {isTogglingBrowserScrapeThis ? (
                              <Loader2 size={12} className="animate-spin inline" />
                            ) : config.browserScrapeEnabled ? 'Enabled' : 'Disabled'}
                          </button>
                        </div>

                        {/* Confirm browser login */}
                        {config.browserScrapeEnabled && (
                          <div className="flex items-center justify-between">
                            <div>
                              <span className="text-sm text-app-text-muted">Browser Login Status</span>
                              {config.browserLastLogin && (
                                <p className="text-xs text-app-text-subtle">
                                  Last confirmed: {new Date(config.browserLastLogin).toLocaleString()}
                                </p>
                              )}
                            </div>
                            <button
                              onClick={() => handleConfirmBrowserLogin(provider, !config.browserLoggedIn)}
                              disabled={isConfirmingLoginThis}
                              className={`flex items-center gap-1 px-3 py-1 rounded text-xs transition-colors ${
                                config.browserLoggedIn
                                  ? 'bg-green-600/20 text-green-400 hover:bg-green-600/30'
                                  : 'bg-amber-600/20 text-amber-400 hover:bg-amber-600/30'
                              }`}
                            >
                              {isConfirmingLoginThis ? (
                                <Loader2 size={12} className="animate-spin" />
                              ) : (
                                <UserCheck size={12} />
                              )}
                              {config.browserLoggedIn ? 'Logged In ✓' : 'Confirm Login'}
                            </button>
                          </div>
                        )}

                        {!config.browserScrapeEnabled && (
                          <p className="text-xs text-app-text-subtle">
                            Enable browser scraping to use automated data collection for this provider.
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Rate limits */}
                    <div>
                      <h4 className="text-sm font-medium text-app-text-secondary mb-3 flex items-center gap-2">
                        <Settings size={14} />
                        Rate Limits
                      </h4>
                      <div className="space-y-3">
                        <div>
                          <label className="block text-xs text-app-text-subtle mb-1">
                            Min Delay (ms): {config.rateLimit.minDelayMs}
                          </label>
                          <input
                            type="range"
                            min="100"
                            max="5000"
                            step="100"
                            value={config.rateLimit.minDelayMs}
                            onChange={(e) => {
                              const newMin = parseInt(e.target.value);
                              const newMax = Math.max(newMin, config.rateLimit.maxDelayMs);
                              handleUpdateRateLimits(provider, newMin, newMax);
                            }}
                            className="w-full"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-app-text-subtle mb-1">
                            Max Delay (ms): {config.rateLimit.maxDelayMs}
                          </label>
                          <input
                            type="range"
                            min="100"
                            max="10000"
                            step="100"
                            value={config.rateLimit.maxDelayMs}
                            onChange={(e) => {
                              const newMax = parseInt(e.target.value);
                              const newMin = Math.min(newMax, config.rateLimit.minDelayMs);
                              handleUpdateRateLimits(provider, newMin, newMax);
                            }}
                            className="w-full"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Quick Links - full width row */}
                  <div className="mt-4 pt-4 border-t border-app-border/50">
                    <h4 className="text-sm font-medium text-app-text-secondary mb-3 flex items-center gap-2">
                      <ExternalLink size={14} />
                      Quick Links
                    </h4>
                    <div className="flex items-center gap-4">
                      <a
                        href={providerInfo.loginUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-sm text-app-accent hover:underline"
                      >
                        <ExternalLink size={12} />
                        Login Page
                      </a>
                      <span className="text-xs text-app-text-subtle">
                        Tree URL: {providerInfo.treeUrlPattern}
                      </span>
                      {providerInfo.supportsMultipleTrees && (
                        <span className="text-xs text-app-text-muted bg-app-text-subtle/20 px-2 py-0.5 rounded">
                          Supports multiple trees
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
