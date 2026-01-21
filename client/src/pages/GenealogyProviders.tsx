import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Trash2, Settings, Plug, PlugZap, CheckCircle2, XCircle, AlertCircle, Loader2, Database } from 'lucide-react';
import toast from 'react-hot-toast';
import type { GenealogyProviderConfig, GenealogyProviderRegistry } from '@fsf/shared';
import { api } from '../services/api';

// Platform display config
const platformColors: Record<string, { bg: string; text: string }> = {
  familysearch: { bg: 'bg-green-600/20', text: 'text-green-400' },
  myheritage: { bg: 'bg-orange-600/20', text: 'text-orange-400' },
  geni: { bg: 'bg-cyan-600/20', text: 'text-cyan-400' },
  wikitree: { bg: 'bg-purple-600/20', text: 'text-purple-400' },
  findmypast: { bg: 'bg-blue-600/20', text: 'text-blue-400' },
  ancestry: { bg: 'bg-emerald-600/20', text: 'text-emerald-400' },
  findagrave: { bg: 'bg-gray-600/20', text: 'text-gray-400' },
};

interface DeleteConfirmModalProps {
  provider: GenealogyProviderConfig | null;
  onConfirm: () => void;
  onCancel: () => void;
  isDeleting: boolean;
}

function DeleteConfirmModal({ provider, onConfirm, onCancel, isDeleting }: DeleteConfirmModalProps) {
  if (!provider) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-app-card border border-app-border rounded-lg p-6 max-w-md w-full mx-4">
        <h2 className="text-xl font-bold text-white mb-4">Delete Provider?</h2>
        <p className="text-neutral-400 mb-2">
          Are you sure you want to delete the provider:
        </p>
        <p className="text-white font-semibold mb-4">
          {provider.name}
        </p>
        <p className="text-neutral-500 text-sm mb-6">
          This will remove the provider configuration. Person links using this provider will remain but may become orphaned.
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

export function GenealogyProvidersPage() {
  const [registry, setRegistry] = useState<GenealogyProviderRegistry | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<GenealogyProviderConfig | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [activatingId, setActivatingId] = useState<string | null>(null);

  const loadProviders = () => {
    setLoading(true);
    api.listGenealogyProviders()
      .then(setRegistry)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadProviders();
  }, []);

  const handleDelete = async () => {
    if (!deleteTarget) return;

    setIsDeleting(true);

    const deleted = await api.deleteGenealogyProvider(deleteTarget.id)
      .then(() => true)
      .catch(err => {
        toast.error(`Failed to delete: ${err.message}`);
        return false;
      });

    if (deleted) {
      toast.success(`Provider ${deleteTarget.name} deleted`);
      loadProviders();
    }

    setIsDeleting(false);
    setDeleteTarget(null);
  };

  const handleTest = async (provider: GenealogyProviderConfig) => {
    setTestingId(provider.id);

    const result = await api.testGenealogyProviderConnection(provider.id)
      .catch(err => ({ success: false, message: err.message }));

    if (result.success) {
      toast.success(`${provider.name}: Connection successful`);
    } else {
      toast.error(`${provider.name}: ${result.message}`);
    }

    loadProviders();
    setTestingId(null);
  };

  const handleActivate = async (provider: GenealogyProviderConfig) => {
    setActivatingId(provider.id);

    const isCurrentlyActive = registry?.activeProvider === provider.id;

    const result = isCurrentlyActive
      ? await api.deactivateGenealogyProvider().catch(err => ({ error: err.message }))
      : await api.activateGenealogyProvider(provider.id).catch(err => ({ error: err.message }));

    if ('error' in result) {
      toast.error(`Failed: ${result.error}`);
    } else {
      toast.success(isCurrentlyActive ? `${provider.name} deactivated` : `${provider.name} is now active`);
      loadProviders();
    }

    setActivatingId(null);
  };

  const getStatusIcon = (status?: string) => {
    switch (status) {
      case 'connected':
        return <CheckCircle2 size={16} className="text-green-400" />;
      case 'error':
        return <XCircle size={16} className="text-red-400" />;
      default:
        return <AlertCircle size={16} className="text-neutral-500" />;
    }
  };

  if (loading) {
    return <div className="text-center py-8 text-neutral-400">Loading providers...</div>;
  }

  if (error) {
    return <div className="text-center py-8 text-app-error">Error: {error}</div>;
  }

  const providers = registry ? Object.values(registry.providers) : [];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Database size={24} className="text-app-accent" />
          <h1 className="text-2xl font-bold text-white">Genealogy Providers</h1>
        </div>
        <Link
          to="/providers/genealogy/new"
          className="flex items-center gap-2 px-4 py-2 bg-app-accent text-white rounded-lg hover:bg-app-accent/80 transition-colors"
        >
          <Plus size={18} />
          Add Provider
        </Link>
      </div>

      {providers.length === 0 ? (
        <div className="text-center py-12 bg-app-card rounded-lg border border-app-border">
          <Database size={48} className="mx-auto text-neutral-600 mb-4" />
          <p className="text-neutral-400 mb-4">No genealogy providers configured.</p>
          <Link
            to="/providers/genealogy/new"
            className="inline-flex items-center gap-2 px-4 py-2 bg-app-accent text-white rounded-lg hover:bg-app-accent/80 transition-colors"
          >
            <Plus size={18} />
            Add Your First Provider
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {providers.map(provider => {
            const colors = platformColors[provider.platform] || { bg: 'bg-neutral-600/20', text: 'text-neutral-400' };
            const isActive = registry?.activeProvider === provider.id;
            const isTesting = testingId === provider.id;
            const isActivating = activatingId === provider.id;

            return (
              <div
                key={provider.id}
                className={`bg-app-card rounded-lg border p-4 transition-colors ${
                  isActive ? 'border-app-accent' : 'border-app-border hover:border-neutral-600'
                }`}
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className={`px-2 py-1 rounded text-xs font-medium ${colors.bg} ${colors.text}`}>
                      {provider.platform}
                    </div>
                    {isActive && (
                      <span className="px-2 py-1 bg-app-accent/20 text-app-accent rounded text-xs font-medium">
                        Active
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    {getStatusIcon(provider.connectionStatus)}
                  </div>
                </div>

                {/* Name */}
                <h2 className="font-semibold text-lg text-white mb-1">{provider.name}</h2>

                {/* Details */}
                <div className="text-sm text-neutral-500 mb-4 space-y-1">
                  <p>Auth: {provider.authType}</p>
                  {provider.lastConnected && (
                    <p>Last connected: {new Date(provider.lastConnected).toLocaleDateString()}</p>
                  )}
                  <p className={provider.enabled ? 'text-green-500' : 'text-red-500'}>
                    {provider.enabled ? 'Enabled' : 'Disabled'}
                  </p>
                </div>

                {/* Actions */}
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => handleTest(provider)}
                    disabled={isTesting}
                    className="flex items-center gap-1 px-3 py-1.5 bg-app-border text-neutral-300 rounded hover:bg-neutral-700 transition-colors disabled:opacity-50 text-sm"
                  >
                    {isTesting ? (
                      <>
                        <Loader2 size={14} className="animate-spin" />
                        Testing...
                      </>
                    ) : (
                      <>
                        <Plug size={14} />
                        Test
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => handleActivate(provider)}
                    disabled={isActivating}
                    className={`flex items-center gap-1 px-3 py-1.5 rounded transition-colors disabled:opacity-50 text-sm ${
                      isActive
                        ? 'bg-app-accent/20 text-app-accent hover:bg-app-accent/30'
                        : 'bg-app-border text-neutral-300 hover:bg-neutral-700'
                    }`}
                  >
                    {isActivating ? (
                      <>
                        <Loader2 size={14} className="animate-spin" />
                        ...
                      </>
                    ) : (
                      <>
                        <PlugZap size={14} />
                        {isActive ? 'Deactivate' : 'Activate'}
                      </>
                    )}
                  </button>
                  <Link
                    to={`/providers/genealogy/${provider.id}/edit`}
                    className="flex items-center gap-1 px-3 py-1.5 bg-app-border text-neutral-300 rounded hover:bg-neutral-700 transition-colors text-sm"
                  >
                    <Settings size={14} />
                    Edit
                  </Link>
                  <button
                    onClick={() => setDeleteTarget(provider)}
                    className="flex items-center gap-1 px-3 py-1.5 text-red-400 hover:bg-red-400/10 rounded transition-colors text-sm"
                  >
                    <Trash2 size={14} />
                    Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <DeleteConfirmModal
        provider={deleteTarget}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
        isDeleting={isDeleting}
      />
    </div>
  );
}
