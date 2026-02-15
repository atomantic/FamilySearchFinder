import { databaseService } from './database.service.js';

// Import config for known unknowns filter
const loadConfig = async () => {
  // @ts-expect-error - Legacy JS module without type declarations
  const config = await import('../../../config.js');
  return config.default || config.config;
};

export const exportService = {
  async exportTsv(dbId: string): Promise<string> {
    const db = await databaseService.getDatabase(dbId);
    const config = await loadConfig();

    let tsv = 'ID\tName\tBirth\tDeath\tLocation\tOccupation\n';

    Object.entries(db).forEach(([id, person]) => {
      const name = person.name || '';
      if (config.knownUnknowns.includes(name.toLowerCase())) return;

      const location = (person.location || '').replace(/[\t\n]/g, ' ');
      const occupation = (person.occupation || '').replace(/[\t\n]/g, ' ');
      const dates = (person.lifespan || '').split('-');
      const birth = dates[0] || '';
      const death = dates[1] || '';

      tsv += `${id}\t${name}\t${birth}\t${death}\t${location}\t${occupation}\n`;
    });

    return tsv;
  },

  async exportJson(dbId: string): Promise<string> {
    const db = await databaseService.getDatabase(dbId);
    return JSON.stringify(db, null, 2);
  }
};
