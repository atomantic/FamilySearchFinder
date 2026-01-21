import fs from 'fs';
import path from 'path';
import type { FavoriteData, FavoriteWithPerson, FavoritesList, PersonAugmentation, Database } from '@fsf/shared';
import { augmentationService } from './augmentation.service.js';
import { databaseService } from './database.service.js';

const DATA_DIR = path.resolve(import.meta.dirname, '../../../data');
const AUGMENT_DIR = path.join(DATA_DIR, 'augment');
const PHOTOS_DIR = path.join(DATA_DIR, 'photos');

/**
 * Get the best available photo URL for a person
 */
function getPhotoUrl(personId: string, augmentation?: PersonAugmentation): string | undefined {
  // Priority 1: Wikipedia photo with local path
  const wikiPhoto = augmentation?.photos?.find(p => p.source === 'wikipedia');
  if (wikiPhoto?.localPath && fs.existsSync(wikiPhoto.localPath)) {
    return `/api/augment/${personId}/wiki-photo`;
  }

  // Priority 2: Scraped FamilySearch photo
  const jpgPath = path.join(PHOTOS_DIR, `${personId}.jpg`);
  const pngPath = path.join(PHOTOS_DIR, `${personId}.png`);
  if (fs.existsSync(jpgPath) || fs.existsSync(pngPath)) {
    return `/api/browser/photos/${personId}`;
  }

  return undefined;
}

// Preset tags for suggestions
export const PRESET_TAGS = [
  'royalty',
  'immigrant',
  'revolutionary',
  'founder',
  'notable',
  'military',
  'religious',
  'scientist',
  'artist',
  'politician',
  'explorer',
  'criminal'
];

export const favoritesService = {
  /**
   * Get favorite status for a person
   */
  getFavorite(personId: string): FavoriteData | null {
    const augmentation = augmentationService.getAugmentation(personId);
    if (!augmentation?.favorite?.isFavorite) return null;
    return augmentation.favorite;
  },

  /**
   * Set a person as favorite
   */
  setFavorite(personId: string, whyInteresting: string, tags: string[] = []): PersonAugmentation {
    const existing = augmentationService.getAugmentation(personId) || {
      id: personId,
      platforms: [],
      photos: [],
      descriptions: [],
      updatedAt: new Date().toISOString(),
    };

    existing.favorite = {
      isFavorite: true,
      whyInteresting,
      tags,
      addedAt: new Date().toISOString(),
    };

    existing.updatedAt = new Date().toISOString();
    augmentationService.saveAugmentation(existing);
    return existing;
  },

  /**
   * Update favorite details
   */
  updateFavorite(personId: string, whyInteresting: string, tags: string[] = []): PersonAugmentation | null {
    const existing = augmentationService.getAugmentation(personId);
    if (!existing?.favorite) return null;

    existing.favorite.whyInteresting = whyInteresting;
    existing.favorite.tags = tags;
    existing.updatedAt = new Date().toISOString();

    augmentationService.saveAugmentation(existing);
    return existing;
  },

  /**
   * Remove a person from favorites
   */
  removeFavorite(personId: string): PersonAugmentation | null {
    const existing = augmentationService.getAugmentation(personId);
    if (!existing) return null;

    delete existing.favorite;
    existing.updatedAt = new Date().toISOString();

    augmentationService.saveAugmentation(existing);
    return existing;
  },

  /**
   * List all favorites across all augmentation files
   */
  async listFavorites(page = 1, limit = 50): Promise<FavoritesList> {
    // Scan all augmentation files for favorites
    if (!fs.existsSync(AUGMENT_DIR)) {
      return { favorites: [], total: 0, page, limit, totalPages: 0, allTags: [] };
    }

    const files = fs.readdirSync(AUGMENT_DIR).filter(f => f.endsWith('.json'));
    const allFavorites: FavoriteWithPerson[] = [];
    const allTags = new Set<string>();

    // Load all databases once for lookup
    const databases = await databaseService.listDatabases();
    const dbContents: Record<string, Database> = {};
    for (const db of databases) {
      dbContents[db.id] = await databaseService.getDatabase(db.id);
    }

    for (const file of files) {
      const filePath = path.join(AUGMENT_DIR, file);
      const content = fs.readFileSync(filePath, 'utf-8');
      const augmentation: PersonAugmentation = JSON.parse(content);

      if (augmentation.favorite?.isFavorite) {
        // Collect all tags
        augmentation.favorite.tags.forEach(tag => allTags.add(tag));

        // Find which databases contain this person
        const personDbs: string[] = [];
        let personName = augmentation.id;
        let personLifespan = '';
        let photoUrl: string | undefined;

        for (const [dbId, dbContent] of Object.entries(dbContents)) {
          const person = dbContent[augmentation.id];
          if (person) {
            personDbs.push(dbId);
            // Use person data from any database that has them
            if (!personName || personName === augmentation.id) {
              personName = person.name;
              personLifespan = person.lifespan;
            }
          }
        }

        // Get photo URL (wiki or scraped)
        photoUrl = getPhotoUrl(augmentation.id, augmentation);

        allFavorites.push({
          personId: augmentation.id,
          name: personName,
          lifespan: personLifespan,
          photoUrl,
          favorite: augmentation.favorite,
          databases: personDbs,
        });
      }
    }

    // Sort by addedAt descending (newest first)
    allFavorites.sort((a, b) =>
      new Date(b.favorite.addedAt).getTime() - new Date(a.favorite.addedAt).getTime()
    );

    // Paginate
    const total = allFavorites.length;
    const totalPages = Math.ceil(total / limit);
    const start = (page - 1) * limit;
    const favorites = allFavorites.slice(start, start + limit);

    return {
      favorites,
      total,
      page,
      limit,
      totalPages,
      allTags: Array.from(allTags).sort(),
    };
  },

  /**
   * Get favorites that exist in a specific database
   */
  async getFavoritesInDatabase(dbId: string): Promise<FavoriteWithPerson[]> {
    const db = await databaseService.getDatabase(dbId);
    const dbPersonIds = new Set(Object.keys(db));

    if (!fs.existsSync(AUGMENT_DIR)) {
      return [];
    }

    const files = fs.readdirSync(AUGMENT_DIR).filter(f => f.endsWith('.json'));
    const favorites: FavoriteWithPerson[] = [];

    for (const file of files) {
      const personId = file.replace('.json', '');
      if (!dbPersonIds.has(personId)) continue;

      const filePath = path.join(AUGMENT_DIR, file);
      const content = fs.readFileSync(filePath, 'utf-8');
      const augmentation: PersonAugmentation = JSON.parse(content);

      if (augmentation.favorite?.isFavorite) {
        const person = db[personId];

        favorites.push({
          personId,
          name: person.name,
          lifespan: person.lifespan,
          photoUrl: getPhotoUrl(personId, augmentation),
          favorite: augmentation.favorite,
          databases: [dbId],
        });
      }
    }

    return favorites;
  },

  /**
   * Get all unique tags across favorites
   */
  getAllTags(): string[] {
    if (!fs.existsSync(AUGMENT_DIR)) {
      return PRESET_TAGS;
    }

    const files = fs.readdirSync(AUGMENT_DIR).filter(f => f.endsWith('.json'));
    const allTags = new Set<string>(PRESET_TAGS);

    for (const file of files) {
      const filePath = path.join(AUGMENT_DIR, file);
      const content = fs.readFileSync(filePath, 'utf-8');
      const augmentation: PersonAugmentation = JSON.parse(content);

      if (augmentation.favorite?.tags) {
        augmentation.favorite.tags.forEach(tag => allTags.add(tag));
      }
    }

    return Array.from(allTags).sort();
  },
};
