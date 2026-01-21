import { Router } from 'express';
import { exportService } from '../services/export.service.js';

export const exportRoutes = Router();

// GET /api/export/:dbId/tsv - Export as TSV
exportRoutes.get('/:dbId/tsv', async (req, res, next) => {
  const result = await exportService.exportTsv(req.params.dbId).catch(next);
  if (result) {
    res.setHeader('Content-Type', 'text/tab-separated-values');
    res.setHeader('Content-Disposition', `attachment; filename="db-${req.params.dbId}.tsv"`);
    res.send(result);
  }
});

// GET /api/export/:dbId/json - Export as JSON
exportRoutes.get('/:dbId/json', async (req, res, next) => {
  const result = await exportService.exportJson(req.params.dbId).catch(next);
  if (result) {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="db-${req.params.dbId}.json"`);
    res.send(result);
  }
});
