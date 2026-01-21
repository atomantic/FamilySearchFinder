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

      // Get database content first to validate rootId
      const filePath = path.join(DATA_DIR, filename);
      const content = fs.readFileSync(filePath, 'utf-8');
      const db: Database = JSON.parse(content);
      const personCount = Object.keys(db).length;

      // Extract root ID and max generations from filename
      // FamilySearch IDs are like XXXX-XXX (e.g., L5TF-642)
      // Generation suffix would be: db-L5TF-642-50.json
      const parts = id.split('-');
      let rootId = id;
      let maxGenerations: number | undefined;

      // Only treat last part as generation if:
      // 1. It's purely numeric
      // 2. The remaining parts form a valid ID in the database
      if (parts.length > 2 && /^\d+$/.test(parts[parts.length - 1])) {
        const possibleRootId = parts.slice(0, -1).join('-');
        if (db[possibleRootId]) {
          rootId = possibleRootId;
          maxGenerations = parseInt(parts[parts.length - 1]);
        }
      }

      const rootName = db[rootId]?.name;

      return { id, filename, personCount, rootId, rootName, maxGenerations };
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

    // Extract root ID and max generations from filename
    const parts = id.split('-');
    let rootId = id;
    let maxGenerations: number | undefined;

    // Only treat last part as generation if:
    // 1. It's purely numeric
    // 2. The remaining parts form a valid ID in the database
    if (parts.length > 2 && /^\d+$/.test(parts[parts.length - 1])) {
      const possibleRootId = parts.slice(0, -1).join('-');
      if (db[possibleRootId]) {
        rootId = possibleRootId;
        maxGenerations = parseInt(parts[parts.length - 1]);
      }
    }

    const rootName = db[rootId]?.name;

    return { id, filename, personCount, rootId, rootName, maxGenerations };
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
