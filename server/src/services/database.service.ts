import fs from 'fs';
import path from 'path';
import type { Database, DatabaseInfo } from '@fsf/shared';

// Data directory is at root of project, not in server/
const DATA_DIR = path.resolve(import.meta.dirname, '../../../data');

export const databaseService = {
  async listDatabases(): Promise<DatabaseInfo[]> {
    const files = fs.readdirSync(DATA_DIR);
    const dbFiles = files.filter(f => f.startsWith('db-') && f.endsWith('.json'));

    return dbFiles.map(filename => {
      const match = filename.match(/^db-([^.]+)\.json$/);
      const id = match ? match[1] : filename;

      // Extract root ID and max generations from filename
      const parts = id.split('-');
      const hasGenerations = parts.length > 1 && /^\d+$/.test(parts[parts.length - 1]);
      const rootId = hasGenerations ? parts.slice(0, -1).join('-') : id;
      const maxGenerations = hasGenerations ? parseInt(parts[parts.length - 1]) : undefined;

      // Get person count from file
      const filePath = path.join(DATA_DIR, filename);
      const content = fs.readFileSync(filePath, 'utf-8');
      const db: Database = JSON.parse(content);
      const personCount = Object.keys(db).length;

      return { id, filename, personCount, rootId, maxGenerations };
    });
  },

  async getDatabaseInfo(id: string): Promise<DatabaseInfo> {
    const filename = `db-${id}.json`;
    const filePath = path.join(DATA_DIR, filename);

    if (!fs.existsSync(filePath)) {
      throw new Error(`Database ${id} not found`);
    }

    const content = fs.readFileSync(filePath, 'utf-8');
    const db: Database = JSON.parse(content);
    const personCount = Object.keys(db).length;

    const parts = id.split('-');
    const hasGenerations = parts.length > 1 && /^\d+$/.test(parts[parts.length - 1]);
    const rootId = hasGenerations ? parts.slice(0, -1).join('-') : id;
    const maxGenerations = hasGenerations ? parseInt(parts[parts.length - 1]) : undefined;

    return { id, filename, personCount, rootId, maxGenerations };
  },

  async getDatabase(id: string): Promise<Database> {
    const filename = `db-${id}.json`;
    const filePath = path.join(DATA_DIR, filename);

    if (!fs.existsSync(filePath)) {
      throw new Error(`Database ${id} not found`);
    }

    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content);
  },

  async deleteDatabase(id: string): Promise<void> {
    const filename = `db-${id}.json`;
    const filePath = path.join(DATA_DIR, filename);

    if (!fs.existsSync(filePath)) {
      throw new Error(`Database ${id} not found`);
    }

    fs.unlinkSync(filePath);
  }
};
