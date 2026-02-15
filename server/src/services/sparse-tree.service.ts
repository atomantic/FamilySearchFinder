import fs from 'fs';
import path from 'path';
import type { SparseTreeNode, SparseTreeResult, Database, FavoriteData, PersonAugmentation } from '@fsf/shared';
import { databaseService } from './database.service.js';
import { favoritesService } from './favorites.service.js';

const DATA_DIR = path.resolve(import.meta.dirname, '../../../data');
const AUGMENT_DIR = path.join(DATA_DIR, 'augment');
const PHOTOS_DIR = path.join(DATA_DIR, 'photos');

/**
 * BFS to find shortest path from source to target through parents (ancestry)
 */
function findShortestPath(db: Database, source: string, target: string): string[] {
  const queue = [source];
  const visited: Record<string, boolean> = { [source]: true };
  const cameFrom: Record<string, string> = {};

  while (queue.length > 0) {
    const id = queue.shift()!;
    const person = db[id];
    if (!person) continue;

    // Traverse through parents (going UP the ancestry tree)
    const parentIds = person.parents || [];
    for (const parentId of parentIds) {
      if (!parentId || visited[parentId]) continue;
      visited[parentId] = true;

      if (parentId === target) {
        const pathArr = [parentId];
        let current = id;
        while (current !== source) {
          pathArr.push(current);
          current = cameFrom[current];
        }
        pathArr.push(source);
        pathArr.reverse();
        return pathArr;
      }

      cameFrom[parentId] = id;
      queue.push(parentId);
    }
  }

  return [];
}

/**
 * Get favorite data for a person
 */
function getFavoriteData(personId: string): FavoriteData | null {
  const filePath = path.join(AUGMENT_DIR, `${personId}.json`);
  if (!fs.existsSync(filePath)) return null;
  const data: PersonAugmentation = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  return data.favorite?.isFavorite ? data.favorite : null;
}

/**
 * Get photo URL for a person
 */
function getPhotoUrl(personId: string): string | undefined {
  // Check for augmentation file with wiki photo
  const filePath = path.join(AUGMENT_DIR, `${personId}.json`);
  if (fs.existsSync(filePath)) {
    const data: PersonAugmentation = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    const wikiPhoto = data.photos?.find(p => p.source === 'wikipedia');
    if (wikiPhoto?.localPath && fs.existsSync(wikiPhoto.localPath)) {
      return `/api/augment/${personId}/wiki-photo`;
    }
  }

  // Check for scraped FamilySearch photo
  const jpgPath = path.join(PHOTOS_DIR, `${personId}.jpg`);
  const pngPath = path.join(PHOTOS_DIR, `${personId}.png`);
  if (fs.existsSync(jpgPath) || fs.existsSync(pngPath)) {
    return `/api/browser/photos/${personId}`;
  }

  return undefined;
}

export const sparseTreeService = {
  /**
   * Generate a sparse tree showing only favorites and their paths from root
   */
  async getSparseTree(dbId: string): Promise<SparseTreeResult> {
    const dbInfo = await databaseService.getDatabaseInfo(dbId);
    const db = await databaseService.getDatabase(dbId);
    const rootId = dbInfo.rootId;

    // Get all favorites in this database
    const favoritesInDb = await favoritesService.getFavoritesInDatabase(dbId);

    if (favoritesInDb.length === 0) {
      // Return just root with no children
      const rootPerson = db[rootId];
      const rootFavorite = getFavoriteData(rootId);
      return {
        root: {
          id: rootId,
          name: rootPerson?.name || rootId,
          lifespan: rootPerson?.lifespan || '',
          gender: rootPerson?.gender,
          photoUrl: getPhotoUrl(rootId),
          whyInteresting: rootFavorite?.whyInteresting,
          tags: rootFavorite?.tags,
          generationFromRoot: 0,
          isFavorite: !!rootFavorite,
          children: [],
        },
        totalFavorites: 0,
        maxGeneration: 0,
      };
    }

    // Find shortest path from root to each favorite
    const paths: Map<string, string[]> = new Map();
    for (const fav of favoritesInDb) {
      const pathArr = findShortestPath(db, rootId, fav.personId);
      if (pathArr.length > 0) {
        paths.set(fav.personId, pathArr);
      }
    }

    // Build a tree structure from all paths
    // First, collect all nodes we need to show (favorites only)
    const favoriteIds = new Set(favoritesInDb.map(f => f.personId));

    // Build tree recursively - only show favorites, track generation skips
    interface TreeBuildNode {
      id: string;
      generation: number;
      side?: 'paternal' | 'maternal';
      children: Map<string, TreeBuildNode>;
    }

    // Determine which side (paternal/maternal) a path belongs to
    // based on whether pathArr[1] matches parents[0] (father) or parents[1] (mother)
    const rootPerson = db[rootId];
    const fatherId = rootPerson?.parents?.[0];
    const motherId = rootPerson?.parents?.[1];

    // Create intermediate tree structure with all path nodes
    const rootNode: TreeBuildNode = {
      id: rootId,
      generation: 0,
      children: new Map(),
    };

    // Helper to determine if a person is on paternal or maternal side
    // by checking if their ancestry chain includes the father or mother
    const determineSide = (personId: string): 'paternal' | 'maternal' | undefined => {
      if (!fatherId && !motherId) return undefined;

      // Walk up through parents until we find the root's father or mother
      const visited = new Set<string>();
      const queue = [personId];

      while (queue.length > 0) {
        const id = queue.shift()!;
        if (visited.has(id)) continue;
        visited.add(id);

        if (id === fatherId) return 'paternal';
        if (id === motherId) return 'maternal';

        const person = db[id];
        if (person?.parents) {
          for (const parentId of person.parents) {
            if (parentId && !visited.has(parentId)) {
              queue.push(parentId);
            }
          }
        }
      }

      return undefined;
    };

    // Add all paths to tree, tracking paternal/maternal side
    for (const [favId, pathArr] of paths) {
      let current = rootNode;
      // Determine side - check if any node in the path leads to father or mother
      let side: 'paternal' | 'maternal' | undefined;
      if (pathArr.length > 1) {
        // Check if path contains father or mother ID directly
        if (fatherId && pathArr.includes(fatherId)) {
          side = 'paternal';
        } else if (motherId && pathArr.includes(motherId)) {
          side = 'maternal';
        } else {
          // Path doesn't directly contain parents, try to trace from first ancestor
          side = determineSide(pathArr[1]);
        }
      }
      for (let i = 1; i < pathArr.length; i++) {
        const nodeId = pathArr[i];
        if (!current.children.has(nodeId)) {
          current.children.set(nodeId, {
            id: nodeId,
            generation: i,
            side,
            children: new Map(),
          });
        }
        current = current.children.get(nodeId)!;
      }
    }

    // Convert to SparseTreeNode, only keeping favorites (but showing generation skips)
    const convertToSparseNode = (
      node: TreeBuildNode,
      lastVisibleGeneration: number
    ): SparseTreeNode | null => {
      const person = db[node.id];
      const favorite = getFavoriteData(node.id);
      const isFavorite = favoriteIds.has(node.id) || node.id === rootId;

      // Collect all children that lead to favorites
      const childNodes: SparseTreeNode[] = [];

      for (const [, child] of node.children) {
        const childResult = convertToSparseNode(child, isFavorite ? node.generation : lastVisibleGeneration);
        if (childResult) {
          childNodes.push(childResult);
        }
      }

      // Only include this node if it's a favorite or root, or if it has multiple children (branch point)
      // For now, only show favorites
      if (isFavorite || childNodes.length > 1) {
        const generationsSkipped = node.generation - lastVisibleGeneration - 1;

        return {
          id: node.id,
          name: person?.name || node.id,
          lifespan: person?.lifespan || '',
          gender: person?.gender,
          side: node.side,
          photoUrl: getPhotoUrl(node.id),
          whyInteresting: favorite?.whyInteresting,
          tags: favorite?.tags,
          generationFromRoot: node.generation,
          generationsSkipped: generationsSkipped > 0 ? generationsSkipped : undefined,
          isFavorite: favoriteIds.has(node.id),
          children: childNodes.length > 0 ? childNodes : undefined,
        };
      }

      // If this is not a visible node, pass through children
      if (childNodes.length === 1) {
        return childNodes[0];
      }

      if (childNodes.length > 1) {
        // Branch point - we need to show it
        return {
          id: node.id,
          name: person?.name || node.id,
          lifespan: person?.lifespan || '',
          gender: person?.gender,
          side: node.side,
          photoUrl: getPhotoUrl(node.id),
          generationFromRoot: node.generation,
          generationsSkipped: node.generation - lastVisibleGeneration - 1 > 0
            ? node.generation - lastVisibleGeneration - 1
            : undefined,
          isFavorite: false,
          children: childNodes,
        };
      }

      return null;
    };

    const sparseRoot = convertToSparseNode(rootNode, -1);

    // Calculate max generation
    let maxGeneration = 0;
    const findMaxGen = (node: SparseTreeNode) => {
      maxGeneration = Math.max(maxGeneration, node.generationFromRoot);
      node.children?.forEach(findMaxGen);
    };
    if (sparseRoot) {
      findMaxGen(sparseRoot);
    }

    return {
      root: sparseRoot || {
        id: rootId,
        name: db[rootId]?.name || rootId,
        lifespan: db[rootId]?.lifespan || '',
        gender: db[rootId]?.gender,
        generationFromRoot: 0,
        isFavorite: favoriteIds.has(rootId),
      },
      totalFavorites: favoritesInDb.length,
      maxGeneration,
    };
  },
};
