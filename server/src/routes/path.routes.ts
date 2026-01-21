import { Router } from 'express';
import { pathService } from '../services/path.service.js';

export const pathRoutes = Router();

// POST /api/path/:dbId - Find path between two persons
pathRoutes.post('/:dbId', async (req, res, next) => {
  const { source, target, method = 'shortest' } = req.body;

  if (!source || !target) {
    return res.status(400).json({
      success: false,
      error: 'source and target are required'
    });
  }

  const result = await pathService.findPath(
    req.params.dbId,
    source,
    target,
    method as 'shortest' | 'longest' | 'random'
  ).catch(next);

  if (result) res.json({ success: true, data: result });
});
