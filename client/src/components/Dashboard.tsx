import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Trash2, Users, GitBranch, Search, Route, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import type { DatabaseInfo } from '@fsf/shared';
import { api } from '../services/api';

interface DeleteConfirmModalProps {
  database: DatabaseInfo | null;
  onConfirm: () => void;
  onCancel: () => void;
  isDeleting: boolean;
}

function DeleteConfirmModal({ database, onConfirm, onCancel, isDeleting }: DeleteConfirmModalProps) {
  if (!database) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-app-card border border-app-border rounded-lg p-6 max-w-md w-full mx-4">
        <h2 className="text-xl font-bold text-white mb-4">Delete Database?</h2>
        <p className="text-neutral-400 mb-2">
          Are you sure you want to delete the database for:
        </p>
        <p className="text-white font-semibold mb-1">
          {database.rootName || database.rootId}
        </p>
        <p className="text-neutral-500 text-sm mb-6">
          {database.personCount.toLocaleString()} people will be removed from the index.
          <br />
          <span className="text-neutral-600">(Raw person files in data/person/ will not be affected)</span>
        </p>
        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            disabled={isDeleting}
            className="px-4 py-2 bg-app-border text-neutral-300 rounded hover:bg-neutral-700 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isDeleting}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-500 transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {isDeleting ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Deleting...
              </>
            ) : (
              <>
                <Trash2 size={16} />
                Delete
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export function Dashboard() {
  const [databases, setDatabases] = useState<DatabaseInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DatabaseInfo | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    api.listDatabases()
      .then(setDatabases)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const handleDelete = async () => {
    if (!deleteTarget) return;

    setIsDeleting(true);

    const deleted = await api.deleteDatabase(deleteTarget.id)
      .then(() => true)
      .catch(err => {
        toast.error(`Failed to delete: ${err.message}`);
        return false;
      });

    if (deleted) {
      setDatabases(prev => prev.filter(db => db.id !== deleteTarget.id));
      toast.success(`Database for ${deleteTarget.rootName || deleteTarget.rootId} deleted`);
    }

    setIsDeleting(false);
    setDeleteTarget(null);
  };

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
              {/* Header with name and delete */}
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1 min-w-0">
                  <h2 className="font-semibold text-lg text-white truncate">
                    {db.rootName || 'Unknown Person'}
                  </h2>
                  <p className="text-xs text-neutral-500 font-mono">{db.rootId}</p>
                </div>
                <button
                  onClick={() => setDeleteTarget(db)}
                  className="p-1.5 text-neutral-500 hover:text-red-400 hover:bg-red-400/10 rounded transition-colors flex-shrink-0 ml-2"
                  title="Delete database"
                >
                  <Trash2 size={16} />
                </button>
              </div>

              {/* Stats */}
              <div className="flex items-center gap-4 text-sm text-neutral-400 mb-4">
                <span className="flex items-center gap-1">
                  <Users size={14} />
                  {db.personCount.toLocaleString()} people
                </span>
                {db.maxGenerations && (
                  <span className="flex items-center gap-1">
                    <GitBranch size={14} />
                    {db.maxGenerations} gen
                  </span>
                )}
              </div>

              {/* Actions */}
              <div className="flex flex-wrap gap-2 text-sm">
                <Link
                  to={`/tree/${db.id}`}
                  className="flex items-center gap-1 px-3 py-1.5 bg-app-accent/20 text-app-accent rounded hover:bg-app-accent/30 transition-colors"
                >
                  <GitBranch size={14} />
                  Tree
                </Link>
                <Link
                  to={`/search/${db.id}`}
                  className="flex items-center gap-1 px-3 py-1.5 bg-app-border text-neutral-300 rounded hover:bg-neutral-700 transition-colors"
                >
                  <Search size={14} />
                  Search
                </Link>
                <Link
                  to={`/path/${db.id}`}
                  className="flex items-center gap-1 px-3 py-1.5 bg-app-border text-neutral-300 rounded hover:bg-neutral-700 transition-colors"
                >
                  <Route size={14} />
                  Path
                </Link>
                <Link
                  to={`/person/${db.id}/${db.rootId}`}
                  className="flex items-center gap-1 px-3 py-1.5 bg-app-border text-neutral-300 rounded hover:bg-neutral-700 transition-colors"
                >
                  <Users size={14} />
                  Root
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Delete confirmation modal */}
      <DeleteConfirmModal
        database={deleteTarget}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
        isDeleting={isDeleting}
      />
    </div>
  );
}
