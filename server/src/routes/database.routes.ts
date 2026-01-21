import { Router } from 'express';
import { databaseService } from '../services/database.service.js';

export const databaseRoutes = Router();

// GET /api/databases - List all databases
databaseRoutes.get('/', async (_req, res, next) => {
  const result = await databaseService.listDatabases().catch(next);
  if (result) res.json({ success: true, data: result });
});

// GET /api/databases/:id - Get database info
databaseRoutes.get('/:id', async (req, res, next) => {
  const result = await databaseService.getDatabaseInfo(req.params.id).catch(next);
  if (result) res.json({ success: true, data: result });
});

// DELETE /api/databases/:id - Delete database
databaseRoutes.delete('/:id', async (req, res, next) => {
  await databaseService.deleteDatabase(req.params.id).catch(next);
  res.json({ success: true });
});
