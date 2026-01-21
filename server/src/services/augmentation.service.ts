import fs from 'fs';
import path from 'path';
import https from 'https';
import http from 'http';

const DATA_DIR = path.resolve(import.meta.dirname, '../../../data');
const AUGMENT_DIR = path.join(DATA_DIR, 'augment');
const PHOTOS_DIR = path.join(DATA_DIR, 'photos');

// Ensure directories exist
if (!fs.existsSync(AUGMENT_DIR)) fs.mkdirSync(AUGMENT_DIR, { recursive: true });
if (!fs.existsSync(PHOTOS_DIR)) fs.mkdirSync(PHOTOS_DIR, { recursive: true });

export interface PersonAugmentation {
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
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  },

  saveAugmentation(data: PersonAugmentation): void {
    const filePath = path.join(AUGMENT_DIR, `${data.id}.json`);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
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

      const fetchUrl = (fetchUrl: string) => {
        https.get(fetchUrl, options, (response) => {
          if (response.statusCode === 301 || response.statusCode === 302) {
            const redirectUrl = response.headers.location;
            if (redirectUrl) {
              fetchUrl(redirectUrl.startsWith('http') ? redirectUrl : `https:${redirectUrl}`);
              return;
            }
          }
          let data = '';
          response.on('data', chunk => data += chunk);
          response.on('end', () => resolve(data));
        }).on('error', reject);
      };

      fetchUrl(url);
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
    const existing = this.getAugmentation(personId) || { id: personId, updatedAt: '' };

    const augmentation: PersonAugmentation = {
      ...existing,
      wikipediaUrl,
      wikipediaTitle: wikiData.title,
      wikipediaDescription: wikiData.description,
      wikipediaPhotoUrl: wikiData.photoUrl,
      updatedAt: new Date().toISOString()
    };

    // Download Wikipedia photo if available
    if (wikiData.photoUrl) {
      const ext = wikiData.photoUrl.includes('.png') ? 'png' : 'jpg';
      const photoPath = path.join(PHOTOS_DIR, `${personId}-wiki.${ext}`);

      await downloadImage(wikiData.photoUrl, photoPath).catch(err => {
        console.error(`[augment] Failed to download wiki photo: ${err.message}`);
      });

      if (fs.existsSync(photoPath)) {
        console.log(`[augment] Downloaded wiki photo to ${photoPath}`);
      }
    }

    this.saveAugmentation(augmentation);
    return augmentation;
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
  }
};
