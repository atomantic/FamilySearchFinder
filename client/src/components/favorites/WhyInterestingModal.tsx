import { useEffect, useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import { api } from '../../services/api';

interface WhyInterestingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (whyInteresting: string, tags: string[]) => void;
  initialWhyInteresting?: string;
  initialTags?: string[];
  isLoading?: boolean;
  personName?: string;
}

export function WhyInterestingModal({
  isOpen,
  onClose,
  onSave,
  initialWhyInteresting = '',
  initialTags = [],
  isLoading = false,
  personName,
}: WhyInterestingModalProps) {
  const [whyInteresting, setWhyInteresting] = useState(initialWhyInteresting);
  const [tags, setTags] = useState<string[]>(initialTags);
  const [tagInput, setTagInput] = useState('');
  const [presetTags, setPresetTags] = useState<string[]>([]);
  const [allTags, setAllTags] = useState<string[]>([]);

  useEffect(() => {
    if (isOpen) {
      setWhyInteresting(initialWhyInteresting);
      setTags(initialTags);
      setTagInput('');

      // Load available tags
      api.getFavoriteTags().then(data => {
        setPresetTags(data.presetTags);
        setAllTags(data.allTags);
      }).catch(() => {
        // Fallback preset tags
        setPresetTags(['royalty', 'immigrant', 'revolutionary', 'founder', 'notable', 'military', 'religious']);
      });
    }
  }, [isOpen, initialWhyInteresting, initialTags]);

  const handleTagAdd = (tag: string) => {
    const normalizedTag = tag.toLowerCase().trim();
    if (normalizedTag && !tags.includes(normalizedTag)) {
      setTags([...tags, normalizedTag]);
    }
    setTagInput('');
  };

  const handleTagRemove = (tagToRemove: string) => {
    setTags(tags.filter(t => t !== tagToRemove));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && tagInput.trim()) {
      e.preventDefault();
      handleTagAdd(tagInput);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (whyInteresting.trim()) {
      onSave(whyInteresting.trim(), tags);
    }
  };

  if (!isOpen) return null;

  // Filter suggestions based on input
  const suggestions = tagInput.trim()
    ? allTags.filter(t =>
        t.toLowerCase().includes(tagInput.toLowerCase()) && !tags.includes(t)
      ).slice(0, 5)
    : [];

  // Show preset tags that haven't been added yet
  const availablePresets = presetTags.filter(t => !tags.includes(t));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-md bg-app-card border border-app-border rounded-lg shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-app-border">
          <h2 className="text-lg font-semibold text-app-text">
            {initialWhyInteresting ? 'Edit Favorite' : 'Add to Favorites'}
          </h2>
          <button
            onClick={onClose}
            className="p-1 text-app-text-muted hover:text-app-text transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit}>
          <div className="px-6 py-4 space-y-4">
            {personName && (
              <p className="text-sm text-app-text-muted">
                Marking <span className="text-app-text font-medium">{personName}</span> as a favorite
              </p>
            )}

            {/* Why Interesting */}
            <div>
              <label className="block text-sm font-medium text-app-text-secondary mb-2">
                Why is this person interesting?
              </label>
              <textarea
                value={whyInteresting}
                onChange={e => setWhyInteresting(e.target.value)}
                placeholder="e.g., Direct ancestor who immigrated from Ireland..."
                rows={4}
                className="w-full px-3 py-2 bg-app-bg border border-app-border rounded text-app-text placeholder-app-placeholder focus:border-app-accent focus:outline-none resize-none"
                autoFocus
              />
            </div>

            {/* Tags */}
            <div>
              <label className="block text-sm font-medium text-app-text-secondary mb-2">
                Tags (optional)
              </label>

              {/* Current tags */}
              {tags.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-2">
                  {tags.map(tag => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1 px-2 py-1 bg-app-accent/20 text-app-accent rounded text-sm"
                    >
                      {tag}
                      <button
                        type="button"
                        onClick={() => handleTagRemove(tag)}
                        className="hover:text-app-text"
                      >
                        <X size={14} />
                      </button>
                    </span>
                  ))}
                </div>
              )}

              {/* Tag input */}
              <div className="relative">
                <input
                  type="text"
                  value={tagInput}
                  onChange={e => setTagInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Type a tag and press Enter"
                  className="w-full px-3 py-2 bg-app-bg border border-app-border rounded text-app-text placeholder-app-placeholder focus:border-app-accent focus:outline-none"
                />

                {/* Suggestions dropdown */}
                {suggestions.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-app-card border border-app-border rounded shadow-lg z-10">
                    {suggestions.map(suggestion => (
                      <button
                        key={suggestion}
                        type="button"
                        onClick={() => handleTagAdd(suggestion)}
                        className="w-full px-3 py-2 text-left text-sm text-app-text-secondary hover:bg-app-border hover:text-app-text"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Preset tag suggestions */}
              {availablePresets.length > 0 && (
                <div className="mt-2">
                  <p className="text-xs text-app-text-subtle mb-1">Suggested:</p>
                  <div className="flex flex-wrap gap-1">
                    {availablePresets.slice(0, 6).map(preset => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => handleTagAdd(preset)}
                        className="px-2 py-0.5 bg-app-border text-app-text-muted rounded text-xs hover:bg-app-hover hover:text-app-text transition-colors"
                      >
                        + {preset}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-3 px-6 py-4 border-t border-app-border">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-app-text-secondary hover:text-app-text transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading || !whyInteresting.trim()}
              className="px-4 py-2 bg-app-accent text-app-text rounded hover:bg-app-accent/80 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Saving...
                </>
              ) : (
                'Save'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
