import type { PersonWithId, TreeNode, SearchResult } from '@fsf/shared';
import { databaseService } from './database.service.js';

export const personService = {
  async listPersons(dbId: string, page: number, limit: number): Promise<SearchResult> {
    const db = await databaseService.getDatabase(dbId);
    const allIds = Object.keys(db);
    const total = allIds.length;
    const totalPages = Math.ceil(total / limit);
    const start = (page - 1) * limit;
    const end = start + limit;

    const results: PersonWithId[] = allIds.slice(start, end).map(id => ({
      id,
      ...db[id]
    }));

    return { results, total, page, limit, totalPages };
  },

  async getPerson(dbId: string, personId: string): Promise<PersonWithId | null> {
    const db = await databaseService.getDatabase(dbId);
    const person = db[personId];
    if (!person) return null;
    return { id: personId, ...person };
  },

  async getPersonTree(
    dbId: string,
    personId: string,
    depth: number,
    direction: 'ancestors' | 'descendants'
  ): Promise<TreeNode | null> {
    const db = await databaseService.getDatabase(dbId);
    const person = db[personId];
    if (!person) return null;

    const buildTree = (id: string, currentDepth: number): TreeNode => {
      const p = db[id];
      if (!p) {
        return { id, name: 'Unknown', lifespan: '' };
      }

      const node: TreeNode = {
        id,
        name: p.name,
        lifespan: p.lifespan,
        location: p.location,
        occupation: p.occupation
      };

      if (currentDepth < depth) {
        const childIds = direction === 'ancestors' ? p.parents : p.children;
        if (childIds && childIds.length > 0) {
          node.children = childIds
            .filter(childId => db[childId])
            .map(childId => buildTree(childId, currentDepth + 1));
        }
      } else if (currentDepth === depth) {
        // Mark as collapsed if there are more
        const childIds = direction === 'ancestors' ? p.parents : p.children;
        if (childIds && childIds.length > 0) {
          node._collapsed = true;
        }
      }

      return node;
    };

    return buildTree(personId, 0);
  }
};
