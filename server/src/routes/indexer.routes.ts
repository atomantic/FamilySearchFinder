import { Router } from 'express';
import { indexerService } from '../services/indexer.service.js';
import { sseManager } from '../utils/sseManager.js';

export const indexerRoutes = Router();

// GET /api/indexer/status - Get current indexer status
indexerRoutes.get('/status', (_req, res) => {
  res.json({ success: true, data: indexerService.getStatus() });
});

// POST /api/indexer/start - Start indexing job
indexerRoutes.post('/start', async (req, res, next) => {
  const { rootId, maxGenerations, ignoreIds, cacheMode, oldest } = req.body;

  if (!rootId) {
    return res.status(400).json({
      success: false,
      error: 'rootId is required'
    });
  }

  const result = await indexerService.startIndexing({
    rootId,
    maxGenerations,
    ignoreIds,
    cacheMode,
    oldest
  }).catch(next);

  if (result) res.json({ success: true, data: result });
});

// POST /api/indexer/stop - Stop current indexing job
indexerRoutes.post('/stop', async (_req, res, next) => {
  await indexerService.stopIndexing().catch(next);
  res.json({ success: true });
});

// GET /api/indexer/events - SSE stream for progress updates
indexerRoutes.get('/events', (req, res) => {
  const clientId = sseManager.addClient(res);

  req.on('close', () => {
    sseManager.removeClient(clientId);
  });
});
