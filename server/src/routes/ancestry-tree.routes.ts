import { Router } from 'express';
import { ancestryTreeService } from '../services/ancestry-tree.service.js';
import type { ExpandAncestryRequest } from '@fsf/shared';

export const ancestryTreeRouter = Router();

// GET /api/ancestry-tree/:dbId/:personId - Get ancestry tree for a person
// Query params: depth (default 4)
ancestryTreeRouter.get('/:dbId/:personId', async (req, res, next) => {
  const { dbId, personId } = req.params;
  const depth = parseInt(req.query.depth as string) || 4;

  const result = await ancestryTreeService.getAncestryTree(dbId, personId, depth).catch(next);
  if (result === null) {
    res.status(404).json({ success: false, error: 'Person not found' });
    return;
  }
  if (result) {
    res.json({ success: true, data: result });
  }
});

// POST /api/ancestry-tree/:dbId/expand - Expand ancestry for specific parents
// Body: { fatherId?: string, motherId?: string }
// Query params: depth (default 2)
ancestryTreeRouter.post('/:dbId/expand', async (req, res, next) => {
  const { dbId } = req.params;
  const { fatherId, motherId } = req.body as ExpandAncestryRequest;
  const depth = parseInt(req.query.depth as string) || 2;

  if (!fatherId && !motherId) {
    res.status(400).json({ success: false, error: 'At least one of fatherId or motherId is required' });
    return;
  }

  const result = await ancestryTreeService.expandAncestry(dbId, fatherId, motherId, depth).catch(next);
  if (result === null) {
    res.status(404).json({ success: false, error: 'Parents not found' });
    return;
  }
  if (result) {
    res.json({ success: true, data: result });
  }
});
