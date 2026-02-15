import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import type { PathResult } from '@fsf/shared';
import { api } from '../../services/api';

export function PathFinder() {
  const { dbId } = useParams<{ dbId: string }>();
  const [source, setSource] = useState('');
  const [target, setTarget] = useState('');
  const [method, setMethod] = useState<'shortest' | 'longest' | 'random'>('shortest');
  const [result, setResult] = useState<PathResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFindPath = async () => {
    if (!dbId || !source || !target) return;

    setLoading(true);
    setError(null);
    setResult(null);

    const pathResult = await api.findPath(dbId, source, target, method)
      .catch(err => {
        setError(err.message);
        return null;
      });

    if (pathResult) {
      setResult(pathResult);
    }

    setLoading(false);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-app-text">Find Path</h1>
        <Link to={`/tree/${dbId}`} className="text-app-accent hover:underline">
          Back to tree
        </Link>
      </div>

      <div className="bg-app-card rounded-lg border border-app-border p-4 mb-6">
        <div className="grid gap-4 md:grid-cols-4">
          <input
            type="text"
            placeholder="Source ID (e.g., 9H8F-V2S)"
            value={source}
            onChange={e => setSource(e.target.value.toUpperCase())}
            className="px-3 py-2 border rounded-md"
          />
          <input
            type="text"
            placeholder="Target ID (e.g., L163-DR5)"
            value={target}
            onChange={e => setTarget(e.target.value.toUpperCase())}
            className="px-3 py-2 border rounded-md"
          />
          <select
            value={method}
            onChange={e => setMethod(e.target.value as 'shortest' | 'longest' | 'random')}
            className="px-3 py-2 border rounded-md"
          >
            <option value="shortest">Shortest Path</option>
            <option value="longest">Longest Path</option>
            <option value="random">Random Path</option>
          </select>
          <button
            onClick={handleFindPath}
            disabled={loading || !source || !target}
            className="px-4 py-2 bg-app-accent text-app-text rounded-md hover:bg-app-accent-hover disabled:opacity-50"
          >
            {loading ? 'Finding...' : 'Find Path'}
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-app-error/10 border border-app-error/30 text-app-error p-4 rounded-lg mb-6">
          {error}
        </div>
      )}

      {result && (
        <div className="bg-app-card rounded-lg border border-app-border p-4">
          <h2 className="text-lg font-semibold mb-4 text-app-text">
            Path Found: {result.length} generations ({result.method} path)
          </h2>

          <div className="space-y-2">
            {result.path.map((person, index) => (
              <div
                key={person.id}
                className="flex items-center gap-4 p-3 bg-app-bg rounded"
              >
                <span className="w-8 h-8 flex items-center justify-center bg-app-accent/20 text-app-accent rounded-full text-sm font-medium">
                  {index}
                </span>
                <div className="flex-1">
                  <Link
                    to={`/person/${dbId}/${person.id}`}
                    className="font-medium text-app-accent hover:underline"
                  >
                    {person.name}
                  </Link>
                  <span className="text-app-text-subtle ml-2">({person.id})</span>
                  <p className="text-sm text-app-text-muted">
                    {person.lifespan}
                    {person.location && ` • ${person.location}`}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
