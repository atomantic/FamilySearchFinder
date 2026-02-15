import type { AncestryFamilyUnit } from '@fsf/shared';
import { PersonCard } from './PersonCard';

interface FamilyUnitCardProps {
  unit: AncestryFamilyUnit;
  dbId: string;
  onExpandFather?: () => void;
  onExpandMother?: () => void;
  loadingFather?: boolean;
  loadingMother?: boolean;
}

export function FamilyUnitCard({
  unit,
  dbId,
  onExpandFather,
  onExpandMother,
  loadingFather,
  loadingMother
}: FamilyUnitCardProps) {
  return (
    <div className="flex flex-col gap-1">
      {/* Father card (top) */}
      {unit.father && (
        <PersonCard
          person={unit.father}
          dbId={dbId}
          onExpand={unit.father.hasMoreAncestors ? onExpandFather : undefined}
          isLoading={loadingFather}
        />
      )}

      {/* Mother card (bottom) */}
      {unit.mother && (
        <PersonCard
          person={unit.mother}
          dbId={dbId}
          onExpand={unit.mother.hasMoreAncestors ? onExpandMother : undefined}
          isLoading={loadingMother}
        />
      )}

      {/* Handle case where only one parent exists */}
      {!unit.father && !unit.mother && (
        <div className="p-3 text-app-text-subtle text-sm text-center">
          Unknown parents
        </div>
      )}
    </div>
  );
}
