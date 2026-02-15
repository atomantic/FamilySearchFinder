import type { PathResult, PersonWithId } from '@fsf/shared';
import { databaseService } from './database.service.js';

// Import existing path algorithms
// These are ES modules, we need to use dynamic import
const loadPathAlgorithms = async () => {
  const [shortest, longest, random] = await Promise.all([
    // @ts-expect-error - Legacy JS module without type declarations
    import('../../../lib/pathShortest.js'),
    // @ts-expect-error - Legacy JS module without type declarations
    import('../../../lib/pathLongest.js'),
    // @ts-expect-error - Legacy JS module without type declarations
    import('../../../lib/pathRandom.js')
  ]);
  return {
    shortest: shortest.pathShortest,
    longest: longest.pathLongest,
    random: random.pathRandom
  };
};

export const pathService = {
  async findPath(
    dbId: string,
    source: string,
    target: string,
    method: 'shortest' | 'longest' | 'random'
  ): Promise<PathResult> {
    const db = await databaseService.getDatabase(dbId);

    if (!db[source]) {
      throw new Error(`Source person ${source} not found in database`);
    }
    if (!db[target]) {
      throw new Error(`Target person ${target} not found in database`);
    }

    const algorithms = await loadPathAlgorithms();
    const pathFn = algorithms[method];

    if (!pathFn) {
      throw new Error(`Unknown path method: ${method}`);
    }

    const pathIds: string[] = await pathFn(db, source, target);

    const path: PersonWithId[] = pathIds.map(id => ({
      id,
      ...db[id]
    }));

    return {
      path,
      length: path.length - 1,
      method
    };
  }
};
