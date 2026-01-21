import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import type { PersonWithId, SearchParams } from '@fsf/shared';
import { api } from '../../services/api';

export function SearchPage() {
  const { dbId } = useParams<{ dbId: string }>();
  const [query, setQuery] = useState('');
  const [location, setLocation] = useState('');
  const [occupation, setOccupation] = useState('');
  const [results, setResults] = useState<PersonWithId[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const handleSearch = async (newPage = 1) => {
    if (!dbId) return;

    setLoading(true);
    setPage(newPage);

    const params: SearchParams = {
      q: query || undefined,
      location: location || undefined,
      occupation: occupation || undefined,
      page: newPage,
      limit: 50
    };

    const result = await api.search(dbId, params).catch(() => null);

    if (result) {
      setResults(result.results);
      setTotal(result.total);
    }

    setLoading(false);
    setSearched(true);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">Search</h1>
        <Link to={`/tree/${dbId}`} className="text-app-accent hover:underline">
          Back to tree
        </Link>
      </div>

      <div className="bg-app-card rounded-lg border border-app-border p-4 mb-6">
        <div className="grid gap-4 md:grid-cols-4">
          <input
            type="text"
            placeholder="Name, bio, or occupation..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="px-3 py-2 border rounded-md"
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
          />
          <input
            type="text"
            placeholder="Location..."
            value={location}
            onChange={e => setLocation(e.target.value)}
            className="px-3 py-2 border rounded-md"
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
          />
          <input
            type="text"
            placeholder="Occupation..."
            value={occupation}
            onChange={e => setOccupation(e.target.value)}
            className="px-3 py-2 border rounded-md"
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
          />
          <button
            onClick={() => handleSearch()}
            disabled={loading}
            className="px-4 py-2 bg-app-accent text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Searching...' : 'Search'}
          </button>
        </div>
      </div>

      {searched && (
        <div>
          <p className="text-neutral-400 mb-4">
            Found {total.toLocaleString()} results
          </p>

          {results.length > 0 ? (
            <div className="bg-app-card rounded-lg border border-app-border overflow-hidden">
              <table className="w-full">
                <thead className="bg-app-bg">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-medium text-neutral-300">Name</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-neutral-300">Lifespan</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-neutral-300">Location</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-neutral-300">Occupation</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-app-border">
                  {results.map(person => (
                    <tr key={person.id} className="hover:bg-app-border/50">
                      <td className="px-4 py-3">
                        <Link
                          to={`/person/${dbId}/${person.id}`}
                          className="text-app-accent hover:underline"
                        >
                          {person.name}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-neutral-400">{person.lifespan}</td>
                      <td className="px-4 py-3 text-neutral-400">{person.location || '-'}</td>
                      <td className="px-4 py-3 text-neutral-400">{person.occupation || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-neutral-500 text-center py-8">No results found</p>
          )}

          {total > 50 && (
            <div className="flex justify-center gap-2 mt-4">
              <button
                onClick={() => handleSearch(page - 1)}
                disabled={page === 1 || loading}
                className="px-3 py-1 border border-app-border rounded text-neutral-300 disabled:opacity-50 hover:bg-app-border"
              >
                Previous
              </button>
              <span className="px-3 py-1 text-neutral-400">
                Page {page} of {Math.ceil(total / 50)}
              </span>
              <button
                onClick={() => handleSearch(page + 1)}
                disabled={page >= Math.ceil(total / 50) || loading}
                className="px-3 py-1 border border-app-border rounded text-neutral-300 disabled:opacity-50 hover:bg-app-border"
              >
                Next
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
