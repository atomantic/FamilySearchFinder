import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { DatabaseInfo } from '@fsf/shared';
import { api } from '../services/api';

export function Dashboard() {
  const [databases, setDatabases] = useState<DatabaseInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.listDatabases()
      .then(setDatabases)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="text-center py-8 text-neutral-400">Loading databases...</div>;
  }

  if (error) {
    return <div className="text-center py-8 text-app-error">Error: {error}</div>;
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6 text-white">Family Tree Databases</h1>

      {databases.length === 0 ? (
        <div className="text-center py-8 text-neutral-400">
          <p>No databases found.</p>
          <Link to="/indexer" className="text-app-accent hover:underline mt-2 inline-block">
            Start indexing a family tree
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {databases.map(db => (
            <div
              key={db.id}
              className="bg-app-card rounded-lg border border-app-border p-4 hover:border-neutral-600 transition-colors"
            >
              <h2 className="font-semibold text-lg mb-2 text-white">{db.rootId}</h2>
              <p className="text-sm text-neutral-400 mb-3">
                {db.personCount.toLocaleString()} people
                {db.maxGenerations && ` • ${db.maxGenerations} generations`}
              </p>
              <div className="flex gap-2 text-sm">
                <Link
                  to={`/tree/${db.id}`}
                  className="px-3 py-1 bg-app-accent/20 text-app-accent rounded hover:bg-app-accent/30"
                >
                  View Tree
                </Link>
                <Link
                  to={`/search/${db.id}`}
                  className="px-3 py-1 bg-app-border text-neutral-300 rounded hover:bg-neutral-700"
                >
                  Search
                </Link>
                <Link
                  to={`/path/${db.id}`}
                  className="px-3 py-1 bg-app-border text-neutral-300 rounded hover:bg-neutral-700"
                >
                  Find Path
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
