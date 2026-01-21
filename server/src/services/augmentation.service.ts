import fs from 'fs';
import path from 'path';
import https from 'https';
import http from 'http';
import type { PersonAugmentation, PlatformReference, PersonPhoto, PersonDescription, PlatformType, ProviderPersonMapping } from '@fsf/shared';

const DATA_DIR = path.resolve(import.meta.dirname, '../../../data');
const AUGMENT_DIR = path.join(DATA_DIR, 'augment');
const PHOTOS_DIR = path.join(DATA_DIR, 'photos');

// Ensure directories exist
if (!fs.existsSync(AUGMENT_DIR)) fs.mkdirSync(AUGMENT_DIR, { recursive: true });
if (!fs.existsSync(PHOTOS_DIR)) fs.mkdirSync(PHOTOS_DIR, { recursive: true });

// Legacy interface for migration
interface LegacyAugmentation {
  id: string;
  wikipediaUrl?: string;
  wikipediaTitle?: string;
  wikipediaDescription?: string;
  wikipediaPhotoUrl?: string;
  customPhotoUrl?: string;
  customDescription?: string;
  updatedAt: string;
}

export interface WikipediaData {
  title: string;
  description: string;
  photoUrl?: string;
}

/**
 * Migrate legacy augmentation to new format
 */
function migrateAugmentation(legacy: LegacyAugmentation): PersonAugmentation {
  const augmentation: PersonAugmentation = {
    id: legacy.id,
    platforms: [],
    photos: [],
    descriptions: [],
    updatedAt: legacy.updatedAt,
  };

  // Migrate Wikipedia data
  if (legacy.wikipediaUrl) {
    augmentation.platforms.push({
      platform: 'wikipedia',
      url: legacy.wikipediaUrl,
      linkedAt: legacy.updatedAt,
    });

    if (legacy.wikipediaPhotoUrl) {
      augmentation.photos.push({
        url: legacy.wikipediaPhotoUrl,
        source: 'wikipedia',
        isPrimary: true,
      });
    }

    if (legacy.wikipediaDescription) {
      augmentation.descriptions.push({
        text: legacy.wikipediaDescription,
        source: 'wikipedia',
        language: 'en',
      });
    }
  }

  // Migrate custom data
  if (legacy.customPhotoUrl) {
    augmentation.customPhotoUrl = legacy.customPhotoUrl;
  }
  if (legacy.customDescription) {
    augmentation.customBio = legacy.customDescription;
  }

  return augmentation;
}

/**
 * Check if augmentation is in legacy format
 */
function isLegacyFormat(data: unknown): data is LegacyAugmentation {
  const obj = data as Record<string, unknown>;
  // Legacy format has wikipediaUrl but not platforms array
  return obj && 'wikipediaUrl' in obj && !('platforms' in obj);
}

function downloadImage(url: string, destPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const protocol = parsedUrl.protocol === 'https:' ? https : http;

    const options = {
      hostname: parsedUrl.hostname,
      path: parsedUrl.pathname + parsedUrl.search,
      headers: {
        'User-Agent': 'FamilySearchFinder/1.0 (https://github.com/atomantic/FamilySearchFinder)'
      }
    };

    const file = fs.createWriteStream(destPath);

    protocol.get(options, (response) => {
      if (response.statusCode === 302 || response.statusCode === 301) {
        const redirectUrl = response.headers.location;
        if (redirectUrl) {
          file.close();
          fs.unlinkSync(destPath);
          const fullRedirectUrl = redirectUrl.startsWith('http') ? redirectUrl : `${parsedUrl.protocol}//${parsedUrl.hostname}${redirectUrl}`;
          downloadImage(fullRedirectUrl, destPath).then(resolve).catch(reject);
          return;
        }
      }
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve();
      });
    }).on('error', (err) => {
      fs.unlink(destPath, () => {});
      reject(err);
    });
  });
}

export const augmentationService = {
  getAugmentation(personId: string): PersonAugmentation | null {
    const filePath = path.join(AUGMENT_DIR, `${personId}.json`);
    if (!fs.existsSync(filePath)) return null;

    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

    // Migrate legacy format if needed
    if (isLegacyFormat(data)) {
      const migrated = migrateAugmentation(data);
      // Save migrated version
      this.saveAugmentation(migrated);
      return migrated;
    }

    return data as PersonAugmentation;
  },

  saveAugmentation(data: PersonAugmentation): void {
    const filePath = path.join(AUGMENT_DIR, `${data.id}.json`);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  },

  /**
   * Add or update a platform reference
   */
  addPlatform(personId: string, platform: PlatformType, url: string, externalId?: string): PersonAugmentation {
    const existing = this.getAugmentation(personId) || {
      id: personId,
      platforms: [],
      photos: [],
      descriptions: [],
      updatedAt: new Date().toISOString(),
    };

    // Check if platform already linked
    const existingPlatform = existing.platforms.find(p => p.platform === platform);
    if (existingPlatform) {
      existingPlatform.url = url;
      if (externalId) existingPlatform.externalId = externalId;
      existingPlatform.linkedAt = new Date().toISOString();
    } else {
      existing.platforms.push({
        platform,
        url,
        externalId,
        linkedAt: new Date().toISOString(),
      });
    }

    existing.updatedAt = new Date().toISOString();
    this.saveAugmentation(existing);
    return existing;
  },

  /**
   * Add a photo from a source
   */
  addPhoto(personId: string, url: string, source: string, isPrimary = false, localPath?: string): PersonAugmentation {
    const existing = this.getAugmentation(personId) || {
      id: personId,
      platforms: [],
      photos: [],
      descriptions: [],
      updatedAt: new Date().toISOString(),
    };

    // If setting as primary, unset other primary photos
    if (isPrimary) {
      existing.photos.forEach(p => p.isPrimary = false);
    }

    // Check if photo from this source already exists
    const existingPhoto = existing.photos.find(p => p.source === source);
    if (existingPhoto) {
      existingPhoto.url = url;
      existingPhoto.isPrimary = isPrimary;
      if (localPath) existingPhoto.localPath = localPath;
    } else {
      existing.photos.push({
        url,
        source,
        isPrimary,
        localPath,
      });
    }

    existing.updatedAt = new Date().toISOString();
    this.saveAugmentation(existing);
    return existing;
  },

  /**
   * Add a description from a source
   */
  addDescription(personId: string, text: string, source: string, language = 'en'): PersonAugmentation {
    const existing = this.getAugmentation(personId) || {
      id: personId,
      platforms: [],
      photos: [],
      descriptions: [],
      updatedAt: new Date().toISOString(),
    };

    // Check if description from this source already exists
    const existingDesc = existing.descriptions.find(d => d.source === source);
    if (existingDesc) {
      existingDesc.text = text;
      existingDesc.language = language;
    } else {
      existing.descriptions.push({
        text,
        source,
        language,
      });
    }

    existing.updatedAt = new Date().toISOString();
    this.saveAugmentation(existing);
    return existing;
  },

  async scrapeWikipedia(url: string): Promise<WikipediaData> {
    // Fetch Wikipedia page HTML with proper headers
    const html = await new Promise<string>((resolve, reject) => {
      const options = {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; FamilySearchFinder/1.0)',
          'Accept': 'text/html'
        }
      };

      const doFetch = (targetUrl: string) => {
        https.get(targetUrl, options, (response) => {
          if (response.statusCode === 301 || response.statusCode === 302) {
            const redirectUrl = response.headers.location;
            if (redirectUrl) {
              doFetch(redirectUrl.startsWith('http') ? redirectUrl : `https:${redirectUrl}`);
              return;
            }
          }
          let data = '';
          response.on('data', chunk => data += chunk);
          response.on('end', () => resolve(data));
        }).on('error', reject);
      };

      doFetch(url);
    });

    console.log(`[augment] Fetched ${html.length} bytes from Wikipedia`);

    // Extract title from <title> tag
    const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
    const title = titleMatch
      ? titleMatch[1].replace(/ - Wikipedia$/, '').trim()
      : 'Unknown';

    // Extract short description
    const shortDescMatch = html.match(/<div class="shortdescription[^"]*"[^>]*>([^<]+)<\/div>/i);
    const shortDesc = shortDescMatch ? shortDescMatch[1].trim() : '';
    console.log(`[augment] Short description: ${shortDesc}`);

    // Extract first paragraph - look for <p> containing <b> (article title)
    let description = shortDesc;
    const contentMatch = html.match(/<div[^>]*class="[^"]*mw-parser-output[^"]*"[^>]*>([\s\S]*?)(?:<div class="mw-heading|<h2|$)/i);

    if (contentMatch) {
      // Find paragraphs with bold text (usually the intro paragraph)
      const paragraphs = contentMatch[1].match(/<p[^>]*>[\s\S]*?<\/p>/gi) || [];

      for (const p of paragraphs) {
        // Skip paragraphs that are just coordinates or empty
        if (p.includes('coordinates') || p.length < 50) continue;

        // Strip HTML and check if it has content
        const text = p
          .replace(/<sup[^>]*>[\s\S]*?<\/sup>/gi, '') // Remove citations
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '') // Remove styles
          .replace(/<[^>]+>/g, '') // Remove HTML tags
          .replace(/\s+/g, ' ') // Normalize whitespace
          .trim();

        if (text.length > 50) {
          description = text;
          break;
        }
      }
    }
    console.log(`[augment] Description: ${description.slice(0, 100)}...`);

    // Extract main image URL
    let photoUrl: string | undefined;

    // Try figure with thumb image
    const figureMatch = html.match(/<figure[^>]*typeof="mw:File\/Thumb"[^>]*>[\s\S]*?<img[^>]*src="([^"]+)"[^>]*>/i);
    if (figureMatch) {
      photoUrl = figureMatch[1];
    }

    // Try infobox image
    if (!photoUrl) {
      const infoboxMatch = html.match(/class="infobox[^"]*"[\s\S]*?<img[^>]*src="([^"]+upload\.wikimedia\.org[^"]+)"[^>]*>/i);
      if (infoboxMatch) {
        photoUrl = infoboxMatch[1];
      }
    }

    // Try any wikimedia image
    if (!photoUrl) {
      const imgMatch = html.match(/<img[^>]*src="([^"]*upload\.wikimedia\.org[^"]+(?:\.jpg|\.jpeg|\.png)[^"]*)"[^>]*>/i);
      if (imgMatch) {
        photoUrl = imgMatch[1];
      }
    }

    // Normalize photo URL
    if (photoUrl) {
      if (photoUrl.startsWith('//')) {
        photoUrl = 'https:' + photoUrl;
      }
      // Get larger version by removing size constraint
      photoUrl = photoUrl.replace(/\/\d+px-/, '/500px-');
      console.log(`[augment] Photo URL: ${photoUrl.slice(0, 100)}`);
    }

    return { title, description, photoUrl };
  },

  async linkWikipedia(personId: string, wikipediaUrl: string): Promise<PersonAugmentation> {
    console.log(`[augment] Linking Wikipedia for ${personId}: ${wikipediaUrl}`);

    // Scrape Wikipedia data
    const wikiData = await this.scrapeWikipedia(wikipediaUrl);
    console.log(`[augment] Scraped Wikipedia: ${wikiData.title}`);

    // Get existing augmentation or create new
    const existing = this.getAugmentation(personId) || {
      id: personId,
      platforms: [],
      photos: [],
      descriptions: [],
      updatedAt: new Date().toISOString(),
    };

    // Add or update Wikipedia platform reference
    const existingPlatform = existing.platforms.find(p => p.platform === 'wikipedia');
    if (existingPlatform) {
      existingPlatform.url = wikipediaUrl;
      existingPlatform.linkedAt = new Date().toISOString();
    } else {
      existing.platforms.push({
        platform: 'wikipedia',
        url: wikipediaUrl,
        linkedAt: new Date().toISOString(),
      });
    }

    // Add or update Wikipedia description
    const existingDesc = existing.descriptions.find(d => d.source === 'wikipedia');
    if (existingDesc) {
      existingDesc.text = wikiData.description;
    } else if (wikiData.description) {
      existing.descriptions.push({
        text: wikiData.description,
        source: 'wikipedia',
        language: 'en',
      });
    }

    // Add or update Wikipedia photo
    if (wikiData.photoUrl) {
      const existingPhoto = existing.photos.find(p => p.source === 'wikipedia');
      const isPrimary = existing.photos.length === 0; // Primary if first photo

      if (existingPhoto) {
        existingPhoto.url = wikiData.photoUrl;
        if (isPrimary) existingPhoto.isPrimary = true;
      } else {
        existing.photos.push({
          url: wikiData.photoUrl,
          source: 'wikipedia',
          isPrimary,
        });
      }

      // Download Wikipedia photo
      const ext = wikiData.photoUrl.includes('.png') ? 'png' : 'jpg';
      const photoPath = path.join(PHOTOS_DIR, `${personId}-wiki.${ext}`);

      await downloadImage(wikiData.photoUrl, photoPath).catch(err => {
        console.error(`[augment] Failed to download wiki photo: ${err.message}`);
      });

      if (fs.existsSync(photoPath)) {
        console.log(`[augment] Downloaded wiki photo to ${photoPath}`);
        // Update local path
        const photo = existing.photos.find(p => p.source === 'wikipedia');
        if (photo) {
          photo.localPath = photoPath;
          photo.downloadedAt = new Date().toISOString();
        }
      }
    }

    existing.updatedAt = new Date().toISOString();
    this.saveAugmentation(existing);
    return existing;
  },

  /**
   * Get primary photo for a person
   */
  getPrimaryPhoto(personId: string): PersonPhoto | null {
    const augmentation = this.getAugmentation(personId);
    if (!augmentation) return null;

    // First try to find explicitly marked primary photo
    const primary = augmentation.photos.find(p => p.isPrimary);
    if (primary) return primary;

    // Fall back to first photo
    return augmentation.photos[0] || null;
  },

  /**
   * Get primary description for a person
   */
  getPrimaryDescription(personId: string): PersonDescription | null {
    const augmentation = this.getAugmentation(personId);
    if (!augmentation) return null;

    // Prefer custom bio
    if (augmentation.customBio) {
      return { text: augmentation.customBio, source: 'custom' };
    }

    // Return first description
    return augmentation.descriptions[0] || null;
  },

  getWikiPhotoPath(personId: string): string | null {
    const jpgPath = path.join(PHOTOS_DIR, `${personId}-wiki.jpg`);
    const pngPath = path.join(PHOTOS_DIR, `${personId}-wiki.png`);
    if (fs.existsSync(jpgPath)) return jpgPath;
    if (fs.existsSync(pngPath)) return pngPath;
    return null;
  },

  hasWikiPhoto(personId: string): boolean {
    return this.getWikiPhotoPath(personId) !== null;
  },

  /**
   * Check if a platform is linked for a person
   */
  hasPlatform(personId: string, platform: PlatformType): boolean {
    const augmentation = this.getAugmentation(personId);
    if (!augmentation) return false;
    return augmentation.platforms.some(p => p.platform === platform);
  },

  /**
   * Get all linked platforms for a person
   */
  getLinkedPlatforms(personId: string): PlatformReference[] {
    const augmentation = this.getAugmentation(personId);
    return augmentation?.platforms || [];
  },

  /**
   * Add or update a provider mapping for a person
   */
  addProviderMapping(personId: string, mapping: Omit<ProviderPersonMapping, 'linkedAt'>): PersonAugmentation {
    const existing = this.getAugmentation(personId) || {
      id: personId,
      platforms: [],
      photos: [],
      descriptions: [],
      providerMappings: [],
      updatedAt: new Date().toISOString(),
    };

    if (!existing.providerMappings) {
      existing.providerMappings = [];
    }

    const fullMapping: ProviderPersonMapping = {
      ...mapping,
      linkedAt: new Date().toISOString(),
    };

    // Check if mapping for this provider already exists
    const existingIdx = existing.providerMappings.findIndex(m => m.providerId === mapping.providerId);
    if (existingIdx >= 0) {
      existing.providerMappings[existingIdx] = fullMapping;
    } else {
      existing.providerMappings.push(fullMapping);
    }

    existing.updatedAt = new Date().toISOString();
    this.saveAugmentation(existing);
    return existing;
  },

  /**
   * Remove a provider mapping from a person
   */
  removeProviderMapping(personId: string, providerId: string): PersonAugmentation | null {
    const existing = this.getAugmentation(personId);
    if (!existing || !existing.providerMappings) return existing;

    const idx = existing.providerMappings.findIndex(m => m.providerId === providerId);
    if (idx < 0) return existing;

    existing.providerMappings.splice(idx, 1);
    existing.updatedAt = new Date().toISOString();
    this.saveAugmentation(existing);
    return existing;
  },

  /**
   * Get all provider mappings for a person
   */
  getProviderMappings(personId: string): ProviderPersonMapping[] {
    const augmentation = this.getAugmentation(personId);
    return augmentation?.providerMappings || [];
  },

  /**
   * Check if a person has a mapping to a specific provider
   */
  hasProviderMapping(personId: string, providerId: string): boolean {
    const augmentation = this.getAugmentation(personId);
    if (!augmentation?.providerMappings) return false;
    return augmentation.providerMappings.some(m => m.providerId === providerId);
  },
};
