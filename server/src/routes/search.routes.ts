import { Router } from 'express';
import { searchService } from '../services/search.service.js';
import type { SearchParams } from '@fsf/shared';

export const searchRoutes = Router();

// GET /api/search/:dbId - Search within database
searchRoutes.get('/:dbId', async (req, res, next) => {
  const params: SearchParams = {
    q: req.query.q as string,
    location: req.query.location as string,
    occupation: req.query.occupation as string,
    birthAfter: req.query.birthAfter as string,
    birthBefore: req.query.birthBefore as string,
    page: parseInt(req.query.page as string) || 1,
    limit: parseInt(req.query.limit as string) || 50
  };
  const result = await searchService.search(req.params.dbId, params).catch(next);
  if (result) res.json({ success: true, data: result });
});
