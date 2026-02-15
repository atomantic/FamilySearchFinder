import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Star, User, Search, Filter, X, Network, Loader2 } from 'lucide-react';
import { api } from '../../services/api';
import type { FavoriteWithPerson, DatabaseInfo } from '@fsf/shared';

export function FavoritesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [favorites, setFavorites] = useState<FavoriteWithPerson[]>([]);
  const [allTags, setAllTags] = useState<string[]>([]);
  const [databases, setDatabases] = useState<DatabaseInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Filters
  const searchQuery = searchParams.get('q') || '';
  const selectedTag = searchParams.get('tag') || '';
  const selectedDb = searchParams.get('db') || '';

  useEffect(() => {
    Promise.all([
      api.listFavorites(page, 50),
      api.listDatabases(),
    ])
      .then(([favoritesData, databasesData]) => {
        setFavorites(favoritesData.favorites);
        setTotal(favoritesData.total);
        setTotalPages(favoritesData.totalPages);
        setAllTags(favoritesData.allTags);
        setDatabases(databasesData);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [page]);

  // Apply filters
  const filteredFavorites = favorites.filter(fav => {
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchesName = fav.name.toLowerCase().includes(query);
      const matchesWhy = fav.favorite.whyInteresting.toLowerCase().includes(query);
      if (!matchesName && !matchesWhy) return false;
    }

    // Tag filter
    if (selectedTag && !fav.favorite.tags.includes(selectedTag)) {
      return false;
    }

    // Database filter
    if (selectedDb && !fav.databases.includes(selectedDb)) {
      return false;
    }

    return true;
  });

  const updateFilter = (key: string, value: string) => {
    const newParams = new URLSearchParams(searchParams);
    if (value) {
      newParams.set(key, value);
    } else {
      newParams.delete(key);
    }
    setSearchParams(newParams);
  };

  const clearFilters = () => {
    setSearchParams({});
  };

  const hasFilters = searchQuery || selectedTag || selectedDb;

  // Get databases that have favorites
  const databasesWithFavorites = databases.filter(db =>
    favorites.some(fav => fav.databases.includes(db.id))
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 size={32} className="animate-spin text-app-accent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Star size={28} className="text-yellow-400 fill-current" />
          <h1 className="text-2xl font-bold text-app-text">Favorites</h1>
          <span className="px-2 py-0.5 bg-app-border text-app-text-muted rounded text-sm">
            {total} total
          </span>
        </div>
      </div>

      {/* Filters bar */}
      <div className="bg-app-card border border-app-border rounded-lg p-4">
        <div className="flex flex-wrap gap-4">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-app-text-subtle" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => updateFilter('q', e.target.value)}
              placeholder="Search favorites..."
              className="w-full pl-9 pr-3 py-2 bg-app-bg border border-app-border rounded text-app-text placeholder-app-placeholder focus:border-app-accent focus:outline-none"
            />
          </div>

          {/* Tag filter */}
          <div className="relative">
            <Filter size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-app-text-subtle" />
            <select
              value={selectedTag}
              onChange={e => updateFilter('tag', e.target.value)}
              className="pl-9 pr-8 py-2 bg-app-bg border border-app-border rounded text-app-text focus:border-app-accent focus:outline-none appearance-none cursor-pointer"
            >
              <option value="">All Tags</option>
              {allTags.map(tag => (
                <option key={tag} value={tag}>{tag}</option>
              ))}
            </select>
          </div>

          {/* Database filter */}
          <select
            value={selectedDb}
            onChange={e => updateFilter('db', e.target.value)}
            className="px-3 py-2 bg-app-bg border border-app-border rounded text-app-text focus:border-app-accent focus:outline-none appearance-none cursor-pointer"
          >
            <option value="">All Databases</option>
            {databasesWithFavorites.map(db => (
              <option key={db.id} value={db.id}>
                {db.rootName || db.id}
              </option>
            ))}
          </select>

          {/* Clear filters */}
          {hasFilters && (
            <button
              onClick={clearFilters}
              className="flex items-center gap-1 px-3 py-2 text-app-text-muted hover:text-app-text transition-colors"
            >
              <X size={16} />
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Sparse Tree Links for databases with favorites */}
      {databasesWithFavorites.length > 0 && (
        <div className="bg-app-card border border-app-border rounded-lg p-4">
          <h3 className="text-sm font-medium text-app-text-secondary mb-3">View Sparse Tree</h3>
          <div className="flex flex-wrap gap-2">
            {databasesWithFavorites.map(db => {
              const favCount = favorites.filter(f => f.databases.includes(db.id)).length;
              return (
                <Link
                  key={db.id}
                  to={`/favorites/sparse-tree/${db.id}`}
                  className="inline-flex items-center gap-2 px-3 py-1.5 bg-app-bg border border-app-border rounded hover:border-app-accent transition-colors"
                >
                  <Network size={16} className="text-app-accent" />
                  <span className="text-app-text text-sm">{db.rootName || db.id}</span>
                  <span className="px-1.5 py-0.5 bg-yellow-400/20 text-yellow-400 rounded text-xs">
                    {favCount}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Results */}
      {filteredFavorites.length === 0 ? (
        <div className="text-center py-16">
          <Star size={48} className="mx-auto text-app-text-subtle mb-4" />
          <h3 className="text-lg font-medium text-app-text-muted mb-2">
            {hasFilters ? 'No favorites match your filters' : 'No favorites yet'}
          </h3>
          <p className="text-app-text-subtle">
            {hasFilters
              ? 'Try adjusting your search or filters'
              : 'Mark people as favorites from their detail pages'
            }
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredFavorites.map(fav => (
            <FavoriteCard key={fav.personId} favorite={fav} databases={databases} />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-1 bg-app-border text-app-text-secondary rounded hover:bg-app-hover disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Previous
          </button>
          <span className="px-3 py-1 text-app-text-muted">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-3 py-1 bg-app-border text-app-text-secondary rounded hover:bg-app-hover disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}

interface FavoriteCardProps {
  favorite: FavoriteWithPerson;
  databases: DatabaseInfo[];
}

function FavoriteCard({ favorite, databases }: FavoriteCardProps) {
  const { personId, name, lifespan, photoUrl, favorite: favData } = favorite;

  // Find the first database that contains this person for linking
  const primaryDbId = favorite.databases[0];
  const personLink = primaryDbId ? `/person/${primaryDbId}/${personId}` : '#';

  return (
    <Link
      to={personLink}
      className="bg-app-card border border-app-border rounded-lg p-4 hover:border-app-accent transition-colors group"
    >
      <div className="flex gap-4">
        {/* Photo */}
        <div className="flex-shrink-0">
          {photoUrl ? (
            <img
              src={photoUrl}
              alt={name}
              className="w-16 h-16 rounded-lg object-cover border border-app-border"
            />
          ) : (
            <div className="w-16 h-16 rounded-lg bg-app-bg border border-app-border flex items-center justify-center">
              <User size={24} className="text-app-text-subtle" />
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Star size={14} className="text-yellow-400 fill-current flex-shrink-0" />
            <h3 className="text-app-text font-medium truncate group-hover:text-app-accent transition-colors">
              {name}
            </h3>
          </div>
          <p className="text-sm text-app-text-muted mb-2">{lifespan}</p>

          {/* Why interesting - truncated */}
          <p className="text-xs text-app-text-subtle line-clamp-2">
            {favData.whyInteresting}
          </p>
        </div>
      </div>

      {/* Tags */}
      {favData.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-3">
          {favData.tags.map(tag => (
            <span
              key={tag}
              className="px-2 py-0.5 bg-app-accent/10 text-app-accent rounded text-xs"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Databases */}
      {favorite.databases.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {favorite.databases.map(dbId => {
            const db = databases.find(d => d.id === dbId);
            return (
              <span
                key={dbId}
                className="px-2 py-0.5 bg-app-border text-app-text-subtle rounded text-xs"
              >
                {db?.rootName || dbId}
              </span>
            );
          })}
        </div>
      )}
    </Link>
  );
}
