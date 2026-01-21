import { User, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { AncestryPersonCard } from '@fsf/shared';

interface PersonCardProps {
  person: AncestryPersonCard;
  dbId: string;
  onExpand?: () => void;
  isLoading?: boolean;
}

export function PersonCard({ person, dbId, onExpand, isLoading }: PersonCardProps) {
  const navigate = useNavigate();

  const handleCardClick = () => {
    navigate(`/person/${dbId}/${person.id}`);
  };

  const handleExpandClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onExpand) {
      onExpand();
    }
  };

  // Gender-based border color
  const borderColor =
    person.gender === 'male'
      ? 'border-l-blue-500'
      : person.gender === 'female'
        ? 'border-l-pink-500'
        : 'border-l-gray-500';

  return (
    <div
      className={`
        flex items-center gap-3 p-3 bg-app-card rounded-lg border border-app-border
        border-l-4 ${borderColor}
        hover:bg-neutral-200 dark:hover:bg-neutral-800 cursor-pointer transition-colors
        min-w-[200px] max-w-[280px]
      `}
      onClick={handleCardClick}
    >
      {/* Circular photo or placeholder */}
      <div className="flex-shrink-0 w-12 h-12 rounded-full overflow-hidden bg-neutral-200 dark:bg-neutral-700 flex items-center justify-center">
        {person.photoUrl ? (
          <img
            src={person.photoUrl}
            alt={person.name}
            className="w-full h-full object-cover"
            onError={(e) => {
              // Hide broken image and show fallback
              e.currentTarget.style.display = 'none';
              const parent = e.currentTarget.parentElement;
              if (parent) {
                parent.innerHTML = '';
                const icon = document.createElement('div');
                icon.className = 'text-neutral-400';
                icon.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`;
                parent.appendChild(icon);
              }
            }}
          />
        ) : (
          <User className="w-6 h-6 text-neutral-400" />
        )}
      </div>

      {/* Person info */}
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-app-text text-sm truncate">{person.name}</div>
        <div className="text-xs text-app-text-muted truncate">{person.lifespan}</div>
        <div className="text-xs text-neutral-400 dark:text-neutral-500 truncate">{person.id}</div>
      </div>

      {/* Expand button */}
      {person.hasMoreAncestors && onExpand && (
        <button
          onClick={handleExpandClick}
          disabled={isLoading}
          className={`
            flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center
            bg-neutral-200 dark:bg-neutral-700 hover:bg-neutral-300 dark:hover:bg-neutral-600 transition-colors
            ${isLoading ? 'opacity-50 cursor-wait' : ''}
          `}
          title="Load ancestors"
        >
          {isLoading ? (
            <div className="w-4 h-4 border-2 border-neutral-400 border-t-transparent rounded-full animate-spin" />
          ) : (
            <ChevronRight className="w-4 h-4 text-neutral-600 dark:text-neutral-300" />
          )}
        </button>
      )}
    </div>
  );
}
