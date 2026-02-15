import { Router, Request, Response } from 'express';
import type { BuiltInProvider } from '@fsf/shared';
import { syncService } from '../services/sync.service';

const router = Router();

/**
 * Compare a person across all enabled providers
 */
router.get('/:dbId/:personId/compare', async (req: Request, res: Response) => {
  const { dbId, personId } = req.params;

  const comparison = await syncService.compareAcrossProviders(dbId, personId)
    .catch(err => ({ error: err.message }));

  if ('error' in comparison) {
    res.status(500).json({ success: false, error: comparison.error });
    return;
  }

  res.json({ success: true, data: comparison });
});

/**
 * Import a person from a provider
 */
router.post('/:dbId/:personId/import', async (req: Request, res: Response) => {
  const { dbId, personId } = req.params;
  const { provider, externalId } = req.body as { provider: BuiltInProvider; externalId?: string };

  if (!provider) {
    res.status(400).json({ success: false, error: 'Provider is required' });
    return;
  }

  // Use personId as externalId if not specified
  const targetId = externalId || personId;

  const person = await syncService.importPerson(provider, targetId, dbId)
    .catch(err => ({ error: err.message }));

  if ('error' in person) {
    res.status(500).json({ success: false, error: person.error });
    return;
  }

  res.json({ success: true, data: person });
});

/**
 * Open edit page on provider (push update)
 */
router.post('/:dbId/:personId/push', async (req: Request, res: Response) => {
  const { dbId, personId } = req.params;
  const { provider } = req.body as { provider: BuiltInProvider };

  if (!provider) {
    res.status(400).json({ success: false, error: 'Provider is required' });
    return;
  }

  const result = await syncService.pushUpdate(dbId, personId, provider)
    .catch(err => ({ error: err.message }));

  if ('error' in result) {
    res.status(500).json({ success: false, error: result.error });
    return;
  }

  res.json({ success: true, data: result });
});

/**
 * Find matching person on another provider
 */
router.post('/:dbId/:personId/find-match', async (req: Request, res: Response) => {
  const { dbId, personId } = req.params;
  const { provider } = req.body as { provider: BuiltInProvider };

  if (!provider) {
    res.status(400).json({ success: false, error: 'Provider is required' });
    return;
  }

  // Load local person to search for
  const fs = await import('fs');
  const path = await import('path');
  const DATA_DIR = path.resolve(import.meta.dirname, '../../../data');
  const dbPath = path.join(DATA_DIR, `db-${dbId}.json`);

  if (!fs.existsSync(dbPath)) {
    res.status(404).json({ success: false, error: `Database ${dbId} not found` });
    return;
  }

  const db = JSON.parse(fs.readFileSync(dbPath, 'utf-8'));
  const person = db[personId];

  if (!person) {
    res.status(404).json({ success: false, error: `Person ${personId} not found` });
    return;
  }

  const match = await syncService.findMatch(person, provider)
    .catch(() => null);

  res.json({
    success: true,
    data: match
  });
});

/**
 * SSE endpoint for batch database sync
 */
router.get('/database/:dbId/events', async (req: Request, res: Response) => {
  const { dbId } = req.params;
  const provider = req.query.provider as BuiltInProvider;
  const direction = (req.query.direction as 'import' | 'export' | 'both') || 'import';

  if (!provider) {
    res.status(400).json({ success: false, error: 'Provider query param is required' });
    return;
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const sendEvent = (data: unknown) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  for await (const progress of syncService.syncDatabase(dbId, provider, direction)) {
    sendEvent(progress);

    if (progress.phase === 'complete' || progress.phase === 'error') {
      break;
    }
  }

  res.end();
});

/**
 * Start batch database sync (non-SSE, returns immediately)
 */
router.post('/database/:dbId', async (req: Request, res: Response) => {
  const { dbId } = req.params;
  const { provider, direction } = req.body as {
    provider: BuiltInProvider;
    direction?: 'import' | 'export' | 'both';
  };

  if (!provider) {
    res.status(400).json({ success: false, error: 'Provider is required' });
    return;
  }

  // Run sync in background and return immediately
  // (in a real implementation, this would use a job queue)
  const syncPromise = (async () => {
    const results = [];
    for await (const progress of syncService.syncDatabase(dbId, provider, direction || 'import')) {
      results.push(progress);
    }
    return results[results.length - 1]; // Return final progress
  })();

  // Don't wait for completion
  syncPromise.catch(err => {
    console.error(`Sync error for ${dbId}:`, err);
  });

  res.json({
    success: true,
    data: {
      message: 'Sync started',
      dbId,
      provider,
      direction: direction || 'import',
      // Use SSE endpoint for progress
      progressUrl: `/api/sync/database/${dbId}/events?provider=${provider}&direction=${direction || 'import'}`
    }
  });
});

export const syncRouter = router;
