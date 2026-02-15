import type {
  AncestryPersonCard,
  AncestryFamilyUnit,
  AncestryTreeResult,
  Database,
  Person
} from '@fsf/shared';
import { databaseService } from './database.service.js';
import { augmentationService } from './augmentation.service.js';
import { scraperService } from './scraper.service.js';

/**
 * Resolve the best photo URL for a person
 * Priority: 1. Wikipedia photo, 2. Scraped FamilySearch photo, 3. None
 */
function resolvePhotoUrl(personId: string): string | undefined {
  // Try Wikipedia photo first (via augmentation)
  if (augmentationService.hasWikiPhoto(personId)) {
    return `/api/augment/${personId}/wiki-photo`;
  }

  // Try scraped FamilySearch photo
  if (scraperService.hasPhoto(personId)) {
    return `/api/browser/photos/${personId}`;
  }

  return undefined;
}

/**
 * Build an AncestryPersonCard from a database person
 */
function buildPersonCard(
  id: string,
  person: Person | undefined,
  db: Database
): AncestryPersonCard {
  if (!person) {
    return {
      id,
      name: 'Unknown',
      lifespan: '',
      gender: 'unknown',
      hasMoreAncestors: false
    };
  }

  // Determine if this person has more ancestors to load
  const hasMoreAncestors = (person.parents || []).some(parentId => db[parentId]);

  return {
    id,
    name: person.name,
    lifespan: person.lifespan,
    gender: person.gender || 'unknown',
    photoUrl: resolvePhotoUrl(id),
    hasMoreAncestors
  };
}

/**
 * Build a family unit from two parent IDs
 */
function buildFamilyUnit(
  fatherId: string | undefined,
  motherId: string | undefined,
  db: Database,
  generation: number,
  maxDepth: number
): AncestryFamilyUnit | undefined {
  const father = fatherId ? db[fatherId] : undefined;
  const mother = motherId ? db[motherId] : undefined;

  // If neither parent exists in DB, no family unit
  if (!father && !mother) {
    return undefined;
  }

  // Create unique ID for this family unit
  const unitId = `${fatherId || 'unknown'}_${motherId || 'unknown'}`;

  const unit: AncestryFamilyUnit = {
    id: unitId,
    generation,
    father: fatherId && father ? buildPersonCard(fatherId, father, db) : undefined,
    mother: motherId && mother ? buildPersonCard(motherId, mother, db) : undefined
  };

  // If we haven't reached max depth, recursively build parent units
  if (generation < maxDepth) {
    const parentUnits: AncestryFamilyUnit[] = [];

    // Father's parents
    if (father && father.parents && father.parents.length > 0) {
      const [fathersFather, fathersMother] = father.parents;
      const fathersParentUnit = buildFamilyUnit(
        fathersFather,
        fathersMother,
        db,
        generation + 1,
        maxDepth
      );
      if (fathersParentUnit) {
        parentUnits.push(fathersParentUnit);
        // Mark father as NOT having more ancestors since we just loaded them
        if (unit.father) {
          unit.father.hasMoreAncestors = false;
        }
      }
    }

    // Mother's parents
    if (mother && mother.parents && mother.parents.length > 0) {
      const [mothersFather, mothersMother] = mother.parents;
      const mothersParentUnit = buildFamilyUnit(
        mothersFather,
        mothersMother,
        db,
        generation + 1,
        maxDepth
      );
      if (mothersParentUnit) {
        parentUnits.push(mothersParentUnit);
        // Mark mother as NOT having more ancestors since we just loaded them
        if (unit.mother) {
          unit.mother.hasMoreAncestors = false;
        }
      }
    }

    if (parentUnits.length > 0) {
      unit.parentUnits = parentUnits;
    }
  }

  // At max depth OR when no parentUnits were created, check if more ancestors exist
  if (!unit.parentUnits || unit.parentUnits.length === 0) {
    if (unit.father && father?.parents?.some(pid => db[pid])) {
      unit.father.hasMoreAncestors = true;
    }
    if (unit.mother && mother?.parents?.some(pid => db[pid])) {
      unit.mother.hasMoreAncestors = true;
    }
  }

  return unit;
}

export const ancestryTreeService = {
  /**
   * Get ancestry tree starting from a person
   * @param dbId Database ID
   * @param personId Starting person ID
   * @param depth Number of generations to load (default 4)
   */
  async getAncestryTree(
    dbId: string,
    personId: string,
    depth = 4
  ): Promise<AncestryTreeResult | null> {
    const db = await databaseService.getDatabase(dbId);
    const rootPerson = db[personId];

    if (!rootPerson) {
      return null;
    }

    const result: AncestryTreeResult = {
      rootPerson: buildPersonCard(personId, rootPerson, db),
      maxGenerationLoaded: 0
    };

    // Get root person's spouse if available (exclude self-references)
    if (rootPerson.spouses && rootPerson.spouses.length > 0) {
      const spouseId = rootPerson.spouses.find(id => id !== personId);
      if (spouseId) {
        const spouse = db[spouseId];
        if (spouse) {
          result.rootSpouse = buildPersonCard(spouseId, spouse, db);
        }
      }
    }

    // Build parent units
    if (rootPerson.parents && rootPerson.parents.length > 0) {
      const [fatherId, motherId] = rootPerson.parents;
      const parentUnits: AncestryFamilyUnit[] = [];

      const rootParentUnit = buildFamilyUnit(fatherId, motherId, db, 1, depth);
      if (rootParentUnit) {
        parentUnits.push(rootParentUnit);
        result.parentUnits = parentUnits;
      }
    }

    // Calculate max generation loaded
    const calculateMaxGen = (units: AncestryFamilyUnit[] | undefined, currentGen: number): number => {
      if (!units || units.length === 0) return currentGen - 1;
      let maxGen = currentGen;
      for (const unit of units) {
        if (unit.parentUnits) {
          const childMax = calculateMaxGen(unit.parentUnits, currentGen + 1);
          if (childMax > maxGen) maxGen = childMax;
        }
      }
      return maxGen;
    };

    result.maxGenerationLoaded = calculateMaxGen(result.parentUnits, 1);

    return result;
  },

  /**
   * Expand ancestry for a specific person (load their parents)
   * Used for lazy loading when user clicks expand button on a person card
   * @param fatherId The person ID to expand (despite the name, this is the person to expand from)
   * @param motherId Alternative person ID to expand (used for mother's lineage)
   */
  async expandAncestry(
    dbId: string,
    fatherId?: string,
    motherId?: string,
    depth = 2
  ): Promise<AncestryFamilyUnit | null> {
    const db = await databaseService.getDatabase(dbId);

    // Get the person we're expanding from (the one whose parents we want to show)
    const personId = fatherId || motherId;
    if (!personId) return null;

    const person = db[personId];
    if (!person || !person.parents || person.parents.length === 0) {
      return null;
    }

    // Build a family unit from this person's parents
    const [personsFatherId, personsMotherId] = person.parents;
    const unit = buildFamilyUnit(personsFatherId, personsMotherId, db, 1, depth);
    return unit || null;
  }
};
