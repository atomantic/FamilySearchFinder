import { useEffect, useState } from 'react';
import type { IndexerStatus } from '@fsf/shared';
import { api } from '../../services/api';

export function IndexerPage() {
  const [status, setStatus] = useState<IndexerStatus | null>(null);
  const [rootId, setRootId] = useState('');
  const [maxGenerations, setMaxGenerations] = useState('');
  const [ignoreIds, setIgnoreIds] = useState('');
  const [cacheMode, setCacheMode] = useState<'all' | 'complete' | 'none'>('all');
  const [oldest, setOldest] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load initial status
  useEffect(() => {
    api.getIndexerStatus()
      .then(setStatus)
      .catch(err => setError(err.message));
  }, []);

  // SSE for real-time updates
  useEffect(() => {
    const eventSource = new EventSource('/api/indexer/events');

    eventSource.addEventListener('progress', (event) => {
      const data = JSON.parse(event.data);
      setStatus(prev => prev ? { ...prev, progress: data.data.progress } : null);
    });

    eventSource.addEventListener('completed', () => {
      api.getIndexerStatus().then(setStatus);
    });

    eventSource.addEventListener('stopped', () => {
      api.getIndexerStatus().then(setStatus);
    });

    return () => eventSource.close();
  }, []);

  const handleStart = async () => {
    if (!rootId) return;

    setLoading(true);
    setError(null);

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

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6 text-white">Indexer</h1>

      {/* Status */}
      <div className="bg-app-card rounded-lg border border-app-border p-4 mb-6">
        <h2 className="font-semibold mb-2 text-white">Status</h2>
        <div className="flex items-center gap-2">
          <span className={`w-3 h-3 rounded-full ${
            isRunning ? 'bg-app-success' : 'bg-neutral-500'
          }`} />
          <span className="capitalize text-neutral-300">{status?.status || 'Loading...'}</span>
        </div>

        {status?.progress && (
          <div className="mt-4 grid grid-cols-2 gap-2 text-sm text-neutral-400">
            <div>New: {status.progress.new}</div>
            <div>Cached: {status.progress.cached}</div>
            <div>Refreshed: {status.progress.refreshed}</div>
            <div>Generations: {status.progress.generations}</div>
          </div>
        )}
      </div>

      {error && (
        <div className="bg-app-error/10 border border-app-error/30 text-app-error p-4 rounded-lg mb-6">
          {error}
        </div>
      )}

      {/* Start Form */}
      {!isRunning && (
        <div className="bg-app-card rounded-lg border border-app-border p-4">
          <h2 className="font-semibold mb-4 text-white">Start Indexing</h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-neutral-300 mb-1">
                Root Person ID *
              </label>
              <input
                type="text"
                value={rootId}
                onChange={e => setRootId(e.target.value.toUpperCase())}
                placeholder="e.g., 9H8F-V2S"
                className="w-full px-3 py-2 border rounded-md"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-300 mb-1">
                Max Generations (optional)
              </label>
              <input
                type="number"
                value={maxGenerations}
                onChange={e => setMaxGenerations(e.target.value)}
                placeholder="Leave empty for unlimited"
                className="w-full px-3 py-2 border rounded-md"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-300 mb-1">
                Ignore IDs (comma-separated, optional)
              </label>
              <input
                type="text"
                value={ignoreIds}
                onChange={e => setIgnoreIds(e.target.value.toUpperCase())}
                placeholder="e.g., ABC-123, DEF-456"
                className="w-full px-3 py-2 border rounded-md"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-300 mb-1">
                Cache Mode
              </label>
              <select
                value={cacheMode}
                onChange={e => setCacheMode(e.target.value as 'all' | 'complete' | 'none')}
                className="w-full px-3 py-2 border rounded-md"
              >
                <option value="all">All (use all cached data)</option>
                <option value="complete">Complete (refetch incomplete records)</option>
                <option value="none">None (refetch everything)</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-300 mb-1">
                Oldest Year (optional)
              </label>
              <input
                type="text"
                value={oldest}
                onChange={e => setOldest(e.target.value)}
                placeholder="e.g., 1000 or 500BC"
                className="w-full px-3 py-2 border rounded-md"
              />
            </div>

            <button
              onClick={handleStart}
              disabled={loading || !rootId}
              className="w-full px-4 py-2 bg-app-accent text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Starting...' : 'Start Indexing'}
            </button>
          </div>
        </div>
      )}

      {/* Stop Button */}
      {isRunning && (
        <button
          onClick={handleStop}
          disabled={loading}
          className="w-full px-4 py-2 bg-app-error text-white rounded-md hover:bg-red-700 disabled:opacity-50"
        >
          {loading ? 'Stopping...' : 'Stop Indexing'}
        </button>
      )}
    </div>
  );
}
