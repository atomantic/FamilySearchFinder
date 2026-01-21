import type { SearchParams, SearchResult, PersonWithId } from '@fsf/shared';
import { databaseService } from './database.service.js';

// Parse year from lifespan string, handling BC notation
const parseYear = (yearStr: string): number | null => {
  if (!yearStr) return null;
  const cleaned = yearStr.trim();
  if (cleaned.toUpperCase().includes('BC')) {
    const num = parseInt(cleaned.replace(/BC/i, ''));
    return isNaN(num) ? null : -num;
  }
  const num = parseInt(cleaned);
  return isNaN(num) ? null : num;
};

const getBirthYear = (lifespan: string): number | null => {
  if (!lifespan) return null;
  const parts = lifespan.split('-');
  return parseYear(parts[0]);
};

export const searchService = {
  async search(dbId: string, params: SearchParams): Promise<SearchResult> {
    const db = await databaseService.getDatabase(dbId);
    const { q, location, occupation, birthAfter, birthBefore, page = 1, limit = 50 } = params;

    let results: PersonWithId[] = Object.entries(db).map(([id, person]) => ({
      id,
      ...person
    }));

    // Text search (name, bio, occupation)
    if (q) {
      const query = q.toLowerCase();
      results = results.filter(p =>
        p.name?.toLowerCase().includes(query) ||
        p.bio?.toLowerCase().includes(query) ||
        p.occupation?.toLowerCase().includes(query)
      );
    }

    // Location filter
    if (location) {
      const loc = location.toLowerCase();
      results = results.filter(p => p.location?.toLowerCase().includes(loc));
    }

    // Occupation filter
    if (occupation) {
      const occ = occupation.toLowerCase();
      results = results.filter(p => p.occupation?.toLowerCase().includes(occ));
    }

    // Birth date filters
    if (birthAfter) {
      const afterYear = parseYear(birthAfter);
      if (afterYear !== null) {
        results = results.filter(p => {
          const birthYear = getBirthYear(p.lifespan);
          return birthYear !== null && birthYear >= afterYear;
        });
      }
    }

    if (birthBefore) {
      const beforeYear = parseYear(birthBefore);
      if (beforeYear !== null) {
        results = results.filter(p => {
          const birthYear = getBirthYear(p.lifespan);
          return birthYear !== null && birthYear <= beforeYear;
        });
      }
    }

    const total = results.length;
    const totalPages = Math.ceil(total / limit);
    const start = (page - 1) * limit;
    const paginatedResults = results.slice(start, start + limit);

    return { results: paginatedResults, total, page, limit, totalPages };
  }
};
