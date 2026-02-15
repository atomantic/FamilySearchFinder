import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Save, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import type { GenealogyProviderConfig, PlatformType, GenealogyAuthType } from '@fsf/shared';
import { api } from '../services/api';

interface PlatformOption {
  platform: PlatformType;
  name: string;
  authType: GenealogyAuthType;
}

export function GenealogyProviderEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isNew = !id || id === 'new';

  const [platforms, setPlatforms] = useState<PlatformOption[]>([]);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);

  // Form state
  const [name, setName] = useState('');
  const [platform, setPlatform] = useState<PlatformType>('familysearch');
  const [enabled, setEnabled] = useState(true);
  const [authType, setAuthType] = useState<GenealogyAuthType>('session_token');
  const [accessToken, setAccessToken] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [timeout, setTimeout] = useState(10000);
  const [requestsPerWindow, setRequestsPerWindow] = useState(60);
  const [windowSeconds, setWindowSeconds] = useState(60);
  const [minDelayMs, setMinDelayMs] = useState(500);
  const [maxDelayMs, setMaxDelayMs] = useState(1500);

  // Load platforms list
  useEffect(() => {
    api.listGenealogyPlatforms()
      .then(setPlatforms)
      .catch(err => toast.error(`Failed to load platforms: ${err.message}`));
  }, []);

  // Load existing provider if editing
  useEffect(() => {
    if (isNew) return;

    api.getGenealogyProvider(id!)
      .then(provider => {
        setName(provider.name);
        setPlatform(provider.platform);
        setEnabled(provider.enabled);
        setAuthType(provider.authType);
        setAccessToken(provider.credentials?.accessToken || '');
        setApiKey(provider.credentials?.apiKey || '');
        setClientId(provider.credentials?.clientId || '');
        setClientSecret(provider.credentials?.clientSecret || '');
        setBaseUrl(provider.baseUrl);
        setTimeout(provider.timeout);
        setRequestsPerWindow(provider.rateLimit.requestsPerWindow);
        setWindowSeconds(provider.rateLimit.windowSeconds);
        setMinDelayMs(provider.rateLimit.minDelayMs);
        setMaxDelayMs(provider.rateLimit.maxDelayMs);
      })
      .catch(err => {
        toast.error(`Failed to load provider: ${err.message}`);
        navigate('/providers/genealogy');
      })
      .finally(() => setLoading(false));
  }, [id, isNew, navigate]);

  // Handle platform change - auto-fill defaults
  const handlePlatformChange = async (newPlatform: PlatformType) => {
    setPlatform(newPlatform);

    // Update auth type based on platform
    const platformInfo = platforms.find(p => p.platform === newPlatform);
    if (platformInfo) {
      setAuthType(platformInfo.authType);
      if (!name) {
        setName(platformInfo.name);
      }
    }

    // Fetch defaults for this platform
    const defaults = await api.getGenealogyProviderDefaults(newPlatform)
      .catch(() => null);

    if (defaults) {
      if (defaults.baseUrl) setBaseUrl(defaults.baseUrl);
      if (defaults.timeout) setTimeout(defaults.timeout);
      if (defaults.rateLimit) {
        setRequestsPerWindow(defaults.rateLimit.requestsPerWindow);
        setWindowSeconds(defaults.rateLimit.windowSeconds);
        setMinDelayMs(defaults.rateLimit.minDelayMs);
        setMaxDelayMs(defaults.rateLimit.maxDelayMs);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      toast.error('Name is required');
      return;
    }

    setSaving(true);

    const config: Partial<GenealogyProviderConfig> = {
      name: name.trim(),
      platform,
      enabled,
      authType,
      credentials: {
        accessToken: accessToken || undefined,
        apiKey: apiKey || undefined,
        clientId: clientId || undefined,
        clientSecret: clientSecret || undefined,
      },
      baseUrl,
      timeout,
      rateLimit: {
        requestsPerWindow,
        windowSeconds,
        minDelayMs,
        maxDelayMs
      }
    };

    const result = isNew
      ? await api.createGenealogyProvider(config).catch(err => ({ error: err.message }))
      : await api.updateGenealogyProvider(id!, config).catch(err => ({ error: err.message }));

    setSaving(false);

    if ('error' in result) {
      toast.error(`Failed to save: ${result.error}`);
      return;
    }

    toast.success(isNew ? 'Provider created' : 'Provider updated');
    navigate('/providers/genealogy');
  };

  if (loading) {
    return <div className="text-center py-8 text-app-text-muted">Loading provider...</div>;
  }

  return (
    <div className="max-w-2xl">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link
          to="/providers/genealogy"
          className="p-2 text-app-text-muted hover:text-app-text hover:bg-app-border rounded transition-colors"
        >
          <ArrowLeft size={20} />
        </Link>
        <h1 className="text-2xl font-bold text-app-text">
          {isNew ? 'Add Genealogy Provider' : 'Edit Genealogy Provider'}
        </h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Info */}
        <div className="bg-app-card rounded-lg border border-app-border p-5">
          <h2 className="text-lg font-semibold text-app-text mb-4">Basic Information</h2>

          <div className="space-y-4">
            {/* Platform */}
            <div>
              <label className="block text-sm font-medium text-app-text-secondary mb-1">
                Platform
              </label>
              <select
                value={platform}
                onChange={e => handlePlatformChange(e.target.value as PlatformType)}
                disabled={!isNew}
                className="w-full px-3 py-2 bg-app-bg border border-app-border rounded text-app-text focus:border-app-accent focus:outline-none disabled:opacity-50"
              >
                {platforms.map(p => (
                  <option key={p.platform} value={p.platform}>
                    {p.name} ({p.authType})
                  </option>
                ))}
              </select>
              {!isNew && (
                <p className="text-xs text-app-text-subtle mt-1">Platform cannot be changed after creation</p>
              )}
            </div>

            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-app-text-secondary mb-1">
                Display Name *
              </label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="My FamilySearch Account"
                className="w-full px-3 py-2 bg-app-bg border border-app-border rounded text-app-text placeholder-app-placeholder focus:border-app-accent focus:outline-none"
                required
              />
            </div>

            {/* Enabled */}
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="enabled"
                checked={enabled}
                onChange={e => setEnabled(e.target.checked)}
                className="w-4 h-4 rounded border-app-border bg-app-bg text-app-accent focus:ring-app-accent"
              />
              <label htmlFor="enabled" className="text-sm text-app-text-secondary">
                Enabled
              </label>
            </div>
          </div>
        </div>

        {/* Authentication */}
        <div className="bg-app-card rounded-lg border border-app-border p-5">
          <h2 className="text-lg font-semibold text-app-text mb-4">Authentication</h2>

          <div className="space-y-4">
            {/* Auth Type */}
            <div>
              <label className="block text-sm font-medium text-app-text-secondary mb-1">
                Auth Type
              </label>
              <select
                value={authType}
                onChange={e => setAuthType(e.target.value as GenealogyAuthType)}
                className="w-full px-3 py-2 bg-app-bg border border-app-border rounded text-app-text focus:border-app-accent focus:outline-none"
              >
                <option value="none">None (Public API)</option>
                <option value="session_token">Session Token</option>
                <option value="api_key">API Key</option>
                <option value="oauth2">OAuth 2.0</option>
              </select>
            </div>

            {/* Session Token / Access Token */}
            {(authType === 'session_token' || authType === 'oauth2') && (
              <div>
                <label className="block text-sm font-medium text-app-text-secondary mb-1">
                  Access Token
                </label>
                <input
                  type="password"
                  value={accessToken}
                  onChange={e => setAccessToken(e.target.value)}
                  placeholder="Enter access token..."
                  className="w-full px-3 py-2 bg-app-bg border border-app-border rounded text-app-text placeholder-app-placeholder focus:border-app-accent focus:outline-none font-mono text-sm"
                />
                {authType === 'session_token' && (
                  <p className="text-xs text-app-text-subtle mt-1">
                    Get this from browser dev tools when logged into the provider website
                  </p>
                )}
              </div>
            )}

            {/* API Key */}
            {authType === 'api_key' && (
              <div>
                <label className="block text-sm font-medium text-app-text-secondary mb-1">
                  API Key
                </label>
                <input
                  type="password"
                  value={apiKey}
                  onChange={e => setApiKey(e.target.value)}
                  placeholder="Enter API key..."
                  className="w-full px-3 py-2 bg-app-bg border border-app-border rounded text-app-text placeholder-app-placeholder focus:border-app-accent focus:outline-none font-mono text-sm"
                />
              </div>
            )}

            {/* OAuth Client ID/Secret */}
            {authType === 'oauth2' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-app-text-secondary mb-1">
                    Client ID (optional)
                  </label>
                  <input
                    type="text"
                    value={clientId}
                    onChange={e => setClientId(e.target.value)}
                    placeholder="OAuth client ID..."
                    className="w-full px-3 py-2 bg-app-bg border border-app-border rounded text-app-text placeholder-app-placeholder focus:border-app-accent focus:outline-none font-mono text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-app-text-secondary mb-1">
                    Client Secret (optional)
                  </label>
                  <input
                    type="password"
                    value={clientSecret}
                    onChange={e => setClientSecret(e.target.value)}
                    placeholder="OAuth client secret..."
                    className="w-full px-3 py-2 bg-app-bg border border-app-border rounded text-app-text placeholder-app-placeholder focus:border-app-accent focus:outline-none font-mono text-sm"
                  />
                </div>
              </>
            )}
          </div>
        </div>

        {/* API Settings */}
        <div className="bg-app-card rounded-lg border border-app-border p-5">
          <h2 className="text-lg font-semibold text-app-text mb-4">API Settings</h2>

          <div className="space-y-4">
            {/* Base URL */}
            <div>
              <label className="block text-sm font-medium text-app-text-secondary mb-1">
                Base URL
              </label>
              <input
                type="url"
                value={baseUrl}
                onChange={e => setBaseUrl(e.target.value)}
                placeholder="https://api.example.com"
                className="w-full px-3 py-2 bg-app-bg border border-app-border rounded text-app-text placeholder-app-placeholder focus:border-app-accent focus:outline-none font-mono text-sm"
              />
            </div>

            {/* Timeout */}
            <div>
              <label className="block text-sm font-medium text-app-text-secondary mb-1">
                Timeout (ms)
              </label>
              <input
                type="number"
                value={timeout}
                onChange={e => setTimeout(parseInt(e.target.value) || 10000)}
                min={1000}
                max={60000}
                className="w-full px-3 py-2 bg-app-bg border border-app-border rounded text-app-text focus:border-app-accent focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Rate Limiting */}
        <div className="bg-app-card rounded-lg border border-app-border p-5">
          <h2 className="text-lg font-semibold text-app-text mb-4">Rate Limiting</h2>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-app-text-secondary mb-1">
                Requests per Window
              </label>
              <input
                type="number"
                value={requestsPerWindow}
                onChange={e => setRequestsPerWindow(parseInt(e.target.value) || 60)}
                min={1}
                className="w-full px-3 py-2 bg-app-bg border border-app-border rounded text-app-text focus:border-app-accent focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-app-text-secondary mb-1">
                Window (seconds)
              </label>
              <input
                type="number"
                value={windowSeconds}
                onChange={e => setWindowSeconds(parseInt(e.target.value) || 60)}
                min={1}
                className="w-full px-3 py-2 bg-app-bg border border-app-border rounded text-app-text focus:border-app-accent focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-app-text-secondary mb-1">
                Min Delay (ms)
              </label>
              <input
                type="number"
                value={minDelayMs}
                onChange={e => setMinDelayMs(parseInt(e.target.value) || 500)}
                min={0}
                className="w-full px-3 py-2 bg-app-bg border border-app-border rounded text-app-text focus:border-app-accent focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-app-text-secondary mb-1">
                Max Delay (ms)
              </label>
              <input
                type="number"
                value={maxDelayMs}
                onChange={e => setMaxDelayMs(parseInt(e.target.value) || 1500)}
                min={0}
                className="w-full px-3 py-2 bg-app-bg border border-app-border rounded text-app-text focus:border-app-accent focus:outline-none"
              />
            </div>
          </div>
          <p className="text-xs text-app-text-subtle mt-2">
            Random delay between min and max will be added between API requests
          </p>
        </div>

        {/* Actions */}
        <div className="flex gap-3 justify-end">
          <Link
            to="/providers/genealogy"
            className="px-4 py-2 bg-app-border text-app-text-secondary rounded hover:bg-app-hover transition-colors"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 bg-app-accent text-app-text rounded hover:bg-app-accent/80 transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {saving ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save size={16} />
                {isNew ? 'Create Provider' : 'Save Changes'}
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
