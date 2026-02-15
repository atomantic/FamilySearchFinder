import { useEffect, useState, useCallback, useRef } from 'react';
import type { IndexerStatus } from '@fsf/shared';
import { api } from '../../services/api';

interface BrowserStatus {
  connected: boolean;
  cdpUrl: string;
  cdpPort: number;
  pageCount: number;
  pages: Array<{ url: string; title: string }>;
  familySearchLoggedIn: boolean;
  browserProcessRunning: boolean;
  autoConnect: boolean;
}

export function IndexerPage() {
  const [status, setStatus] = useState<IndexerStatus | null>(null);
  const [browserStatus, setBrowserStatus] = useState<BrowserStatus | null>(null);
  const [rootId, setRootId] = useState('');
  const [maxGenerations, setMaxGenerations] = useState('');
  const [ignoreIds, setIgnoreIds] = useState('');
  const [cacheMode, setCacheMode] = useState<'all' | 'complete' | 'none'>('all');
  const [oldest, setOldest] = useState('');
  const [loading, setLoading] = useState(false);
  const [browserLoading, setBrowserLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [outputLines, setOutputLines] = useState<string[]>([]);
  const outputRef = useRef<HTMLDivElement>(null);

  // Fetch browser status
  const fetchBrowserStatus = useCallback(async () => {
    const result = await api.getBrowserStatus().catch(() => null);
    if (result) setBrowserStatus(result);
  }, []);

  // Load initial status
  useEffect(() => {
    api.getIndexerStatus()
      .then(setStatus)
      .catch(err => setError(err.message));
    fetchBrowserStatus();
  }, [fetchBrowserStatus]);

  // Poll browser status every 5 seconds
  useEffect(() => {
    const interval = setInterval(fetchBrowserStatus, 5000);
    return () => clearInterval(interval);
  }, [fetchBrowserStatus]);

  // SSE for real-time updates
  useEffect(() => {
    const eventSource = new EventSource('/api/indexer/events');

    eventSource.addEventListener('progress', (event) => {
      const data = JSON.parse(event.data);
      setStatus(prev => prev ? { ...prev, progress: data.data.progress } : null);
    });

    eventSource.addEventListener('output', (event) => {
      const data = JSON.parse(event.data);
      setOutputLines(prev => {
        const newLines = [...prev, data.data.line];
        // Keep last 500 lines
        return newLines.slice(-500);
      });
    });

    eventSource.addEventListener('started', () => {
      setOutputLines([]); // Clear output on new job
    });

    eventSource.addEventListener('completed', () => {
      api.getIndexerStatus().then(setStatus);
    });

    eventSource.addEventListener('stopped', () => {
      api.getIndexerStatus().then(setStatus);
    });

    eventSource.addEventListener('error', (event) => {
      const data = JSON.parse((event as MessageEvent).data || '{}');
      if (data.data?.message) {
        setError(data.data.message);
      }
      api.getIndexerStatus().then(setStatus);
    });

    return () => eventSource.close();
  }, []);

  // Auto-scroll output to bottom
  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [outputLines]);

  const handleLaunchBrowser = async () => {
    setBrowserLoading(true);
    setError(null);
    const result = await api.launchBrowser().catch(err => {
      setError(err.message);
      return null;
    });
    if (result && !result.success) {
      setError(result.message);
    }
    await fetchBrowserStatus();
    setBrowserLoading(false);
  };

  const handleConnectBrowser = async () => {
    setBrowserLoading(true);
    setError(null);
    await api.connectBrowser().catch(err => {
      setError(err.message);
    });
    await fetchBrowserStatus();
    setBrowserLoading(false);
  };

  const handleOpenFamilySearch = async () => {
    setBrowserLoading(true);
    setError(null);
    await api.openFamilySearchLogin().catch(err => {
      setError(err.message);
    });
    // Wait a moment for user to log in, then refresh status
    setTimeout(fetchBrowserStatus, 3000);
    setBrowserLoading(false);
  };

  const handleStart = async () => {
    if (!rootId) return;

    setLoading(true);
    setError(null);
    setOutputLines([]);

    const result = await api.startIndexing({
      rootId,
      maxGenerations: maxGenerations ? parseInt(maxGenerations) : undefined,
      ignoreIds: ignoreIds ? ignoreIds.split(',').map(s => s.trim()) : undefined,
      cacheMode,
      oldest: oldest || undefined
    }).catch(err => {
      setError(err.message);
      return null;
    });

    if (result) {
      setStatus(result);
    }

    setLoading(false);
  };

  const handleStop = async () => {
    setLoading(true);
    await api.stopIndexing().catch(err => setError(err.message));
    await api.getIndexerStatus().then(setStatus);
    setLoading(false);
  };

  const isRunning = status?.status === 'running';
  const canStartIndexing = browserStatus?.connected && browserStatus?.familySearchLoggedIn && rootId;

  return (
    <div className="max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold mb-6 text-app-text">Indexer</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left Column - Controls */}
        <div className="space-y-6">
          {/* Browser Status Panel */}
          <div className="bg-app-card rounded-lg border border-app-border p-4">
            <h2 className="font-semibold mb-3 text-app-text">Browser Connection</h2>

            <div className="space-y-2 mb-4">
              {/* Browser Process Status */}
              <div className="flex items-center gap-2">
                <span className={`w-2.5 h-2.5 rounded-full ${
                  browserStatus?.browserProcessRunning ? 'bg-app-success' : 'bg-app-text-subtle'
                }`} />
                <span className="text-sm text-app-text-secondary">
                  Browser: {browserStatus?.browserProcessRunning ? 'Running' : 'Not Running'}
                </span>
              </div>

              {/* CDP Connection Status */}
              <div className="flex items-center gap-2">
                <span className={`w-2.5 h-2.5 rounded-full ${
                  browserStatus?.connected ? 'bg-app-success' : 'bg-app-text-subtle'
                }`} />
                <span className="text-sm text-app-text-secondary">
                  CDP: {browserStatus?.connected ? 'Connected' : 'Disconnected'}
                </span>
              </div>

              {/* FamilySearch Login Status */}
              <div className="flex items-center gap-2">
                <span className={`w-2.5 h-2.5 rounded-full ${
                  browserStatus?.familySearchLoggedIn ? 'bg-app-success' : 'bg-app-warning'
                }`} />
                <span className="text-sm text-app-text-secondary">
                  FamilySearch: {browserStatus?.familySearchLoggedIn ? 'Logged In' : 'Not Logged In'}
                </span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 flex-wrap">
              {!browserStatus?.browserProcessRunning && (
                <button
                  onClick={handleLaunchBrowser}
                  disabled={browserLoading}
                  className="px-3 py-1.5 text-sm bg-app-accent text-app-text rounded hover:bg-app-accent-hover disabled:opacity-50"
                >
                  {browserLoading ? 'Launching...' : 'Launch Browser'}
                </button>
              )}

              {browserStatus?.browserProcessRunning && !browserStatus?.connected && (
                <button
                  onClick={handleConnectBrowser}
                  disabled={browserLoading}
                  className="px-3 py-1.5 text-sm bg-app-accent text-app-text rounded hover:bg-app-accent-hover disabled:opacity-50"
                >
                  {browserLoading ? 'Connecting...' : 'Connect'}
                </button>
              )}

              {browserStatus?.connected && !browserStatus?.familySearchLoggedIn && (
                <button
                  onClick={handleOpenFamilySearch}
                  disabled={browserLoading}
                  className="px-3 py-1.5 text-sm bg-app-accent text-app-text rounded hover:bg-app-accent-hover disabled:opacity-50"
                >
                  {browserLoading ? 'Opening...' : 'Open FamilySearch'}
                </button>
              )}

              <button
                onClick={fetchBrowserStatus}
                disabled={browserLoading}
                className="px-3 py-1.5 text-sm bg-app-card-hover text-app-text-secondary rounded hover:bg-app-border disabled:opacity-50"
              >
                Refresh
              </button>
            </div>
          </div>

          {/* Indexer Status */}
          <div className="bg-app-card rounded-lg border border-app-border p-4">
            <h2 className="font-semibold mb-2 text-app-text">Status</h2>
            <div className="flex items-center gap-2 mb-3">
              <span className={`w-3 h-3 rounded-full ${
                isRunning ? 'bg-app-success animate-pulse' :
                status?.status === 'completed' ? 'bg-app-success' : 'bg-app-text-subtle'
              }`} />
              <span className="capitalize text-app-text-secondary">{status?.status || 'Loading...'}</span>
            </div>

            {status?.progress && (
              <div className="space-y-1 text-sm">
                <div className="grid grid-cols-3 gap-2 text-app-text-muted">
                  <div>New: <span className="text-app-success font-medium">{status.progress.new}</span></div>
                  <div>Cached: <span className="text-app-text font-medium">{status.progress.cached}</span></div>
                  <div>Gen: <span className="text-app-text font-medium">{status.progress.generations}</span></div>
                </div>
                {status.progress.currentPerson && isRunning && (
                  <div className="text-xs text-app-text-muted pt-1 border-t border-app-border mt-2">
                    Current: <span className="text-app-text">{status.progress.currentPerson}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {error && (
            <div className="bg-app-error/10 border border-app-error/30 text-app-error p-3 rounded-lg text-sm">
              {error}
              <button onClick={() => setError(null)} className="ml-2 text-app-error/70 hover:text-app-error">
                [x]
              </button>
            </div>
          )}

          {/* Start Form */}
          {!isRunning && (
            <div className="bg-app-card rounded-lg border border-app-border p-4">
              <h2 className="font-semibold mb-4 text-app-text">Start Indexing</h2>

              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-app-text-secondary mb-1">
                    Root Person ID *
                  </label>
                  <input
                    type="text"
                    value={rootId}
                    onChange={e => setRootId(e.target.value.toUpperCase())}
                    placeholder="e.g., KWCJ-RN4"
                    className="w-full px-3 py-2 border rounded-md bg-app-bg text-app-text border-app-border focus:border-app-accent focus:outline-none text-sm"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-app-text-secondary mb-1">
                      Max Generations
                    </label>
                    <input
                      type="number"
                      value={maxGenerations}
                      onChange={e => setMaxGenerations(e.target.value)}
                      placeholder="Unlimited"
                      className="w-full px-3 py-2 border rounded-md bg-app-bg text-app-text border-app-border focus:border-app-accent focus:outline-none text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-app-text-secondary mb-1">
                      Cache Mode
                    </label>
                    <select
                      value={cacheMode}
                      onChange={e => setCacheMode(e.target.value as 'all' | 'complete' | 'none')}
                      className="w-full px-3 py-2 border rounded-md bg-app-bg text-app-text border-app-border focus:border-app-accent focus:outline-none text-sm"
                    >
                      <option value="all">All</option>
                      <option value="complete">Complete</option>
                      <option value="none">None</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-app-text-secondary mb-1">
                    Oldest Year (optional)
                  </label>
                  <input
                    type="text"
                    value={oldest}
                    onChange={e => setOldest(e.target.value)}
                    placeholder="e.g., 1000 or 500BC"
                    className="w-full px-3 py-2 border rounded-md bg-app-bg text-app-text border-app-border focus:border-app-accent focus:outline-none text-sm"
                  />
                </div>

                <button
                  onClick={handleStart}
                  disabled={loading || !canStartIndexing}
                  className="w-full px-4 py-2 bg-app-accent text-app-text rounded-md hover:bg-app-accent-hover disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Starting...' : 'Start Indexing'}
                </button>

                {!canStartIndexing && rootId && (
                  <p className="text-xs text-app-warning text-center">
                    {!browserStatus?.connected
                      ? 'Connect to browser first'
                      : 'Log in to FamilySearch first'}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Stop Button */}
          {isRunning && (
            <button
              onClick={handleStop}
              disabled={loading}
              className="w-full px-4 py-2 bg-app-error text-white rounded-md hover:opacity-90 disabled:opacity-50"
            >
              {loading ? 'Stopping...' : 'Stop Indexing'}
            </button>
          )}
        </div>

        {/* Right Column - Output Console */}
        <div className="bg-app-card rounded-lg border border-app-border p-4 flex flex-col min-h-[600px]">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-app-text">Output</h2>
            <span className="text-xs text-app-text-muted">{outputLines.length} lines</span>
          </div>
          <div
            ref={outputRef}
            className="flex-1 bg-gray-900 rounded-md p-3 overflow-auto font-mono text-xs text-gray-300 whitespace-pre"
            style={{ minHeight: '500px' }}
          >
            {outputLines.length === 0 ? (
              <span className="text-gray-500 italic">Output will appear here when indexing starts...</span>
            ) : (
              outputLines.map((line, i) => (
                <div key={i} className="hover:bg-gray-800">
                  {line}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
