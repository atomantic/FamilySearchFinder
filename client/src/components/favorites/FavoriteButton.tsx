import { useState, useEffect } from 'react';
import { Star, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '../../services/api';
import type { FavoriteData } from '../../services/api';
import { WhyInterestingModal } from './WhyInterestingModal';

interface FavoriteButtonProps {
  personId: string;
  personName?: string;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  onFavoriteChange?: (isFavorite: boolean) => void;
}

export function FavoriteButton({
  personId,
  personName,
  size = 'md',
  showLabel = false,
  onFavoriteChange,
}: FavoriteButtonProps) {
  const [favorite, setFavorite] = useState<FavoriteData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showModal, setShowModal] = useState(false);

  const iconSizes = { sm: 16, md: 20, lg: 24 };
  const iconSize = iconSizes[size];

  useEffect(() => {
    setLoading(true);
    api.getFavorite(personId)
      .then(data => setFavorite(data))
      .catch(() => setFavorite(null))
      .finally(() => setLoading(false));
  }, [personId]);

  const handleClick = () => {
    if (favorite?.isFavorite) {
      // Already a favorite - show edit modal
      setShowModal(true);
    } else {
      // Not a favorite - show add modal
      setShowModal(true);
    }
  };

  const handleRemoveFavorite = async () => {
    setSaving(true);

    const result = await api.removeFavorite(personId).catch(err => {
      toast.error(`Failed to remove favorite: ${err.message}`);
      return null;
    });

    if (result) {
      setFavorite(null);
      toast.success('Removed from favorites');
      onFavoriteChange?.(false);
    }

    setSaving(false);
    setShowModal(false);
  };

  const handleSave = async (whyInteresting: string, tags: string[]) => {
    setSaving(true);

    const isUpdate = favorite?.isFavorite;
    const apiCall = isUpdate
      ? api.updateFavorite(personId, whyInteresting, tags)
      : api.addFavorite(personId, whyInteresting, tags);

    const result = await apiCall.catch(err => {
      toast.error(`Failed to save favorite: ${err.message}`);
      return null;
    });

    if (result?.favorite) {
      setFavorite(result.favorite);
      toast.success(isUpdate ? 'Favorite updated' : 'Added to favorites');
      onFavoriteChange?.(true);
    }

    setSaving(false);
    setShowModal(false);
  };

  const isFavorite = favorite?.isFavorite;

  const buttonClasses = `
    flex items-center gap-1.5 transition-colors
    ${isFavorite
      ? 'text-yellow-400 hover:text-yellow-300'
      : 'text-app-text-muted hover:text-yellow-400'
    }
    ${loading || saving ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
  `;

  return (
    <>
      <button
        onClick={handleClick}
        disabled={loading || saving}
        className={buttonClasses}
        title={isFavorite ? `Favorite: ${favorite.whyInteresting}` : 'Add to favorites'}
      >
        {loading || saving ? (
          <Loader2 size={iconSize} className="animate-spin" />
        ) : (
          <Star
            size={iconSize}
            className={isFavorite ? 'fill-current' : ''}
          />
        )}
        {showLabel && (
          <span className="text-sm">
            {isFavorite ? 'Favorite' : 'Add to Favorites'}
          </span>
        )}
      </button>

      <WhyInterestingModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onSave={handleSave}
        initialWhyInteresting={favorite?.whyInteresting || ''}
        initialTags={favorite?.tags || []}
        isLoading={saving}
        personName={personName}
      />

      {/* Show remove option when editing */}
      {showModal && favorite?.isFavorite && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[60]">
          <button
            onClick={handleRemoveFavorite}
            disabled={saving}
            className="px-4 py-2 bg-red-600/20 text-red-400 border border-red-600/30 rounded-lg hover:bg-red-600/30 transition-colors disabled:opacity-50 text-sm"
          >
            Remove from Favorites
          </button>
        </div>
      )}
    </>
  );
}
