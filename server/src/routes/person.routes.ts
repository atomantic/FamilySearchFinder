import { Router } from 'express';
import { personService } from '../services/person.service.js';

export const personRoutes = Router();

// GET /api/persons/:dbId - List persons in database
personRoutes.get('/:dbId', async (req, res, next) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 50;
  const result = await personService.listPersons(req.params.dbId, page, limit).catch(next);
  if (result) res.json({ success: true, data: result });
});

// GET /api/persons/:dbId/:personId - Get single person
personRoutes.get('/:dbId/:personId', async (req, res, next) => {
  const result = await personService.getPerson(req.params.dbId, req.params.personId).catch(next);
  if (result) res.json({ success: true, data: result });
});

// GET /api/persons/:dbId/:personId/tree - Get tree data for D3
personRoutes.get('/:dbId/:personId/tree', async (req, res, next) => {
  const depth = parseInt(req.query.depth as string) || 5;
  const direction = (req.query.direction as string) || 'ancestors';
  const result = await personService.getPersonTree(
    req.params.dbId,
    req.params.personId,
    depth,
    direction as 'ancestors' | 'descendants'
  ).catch(next);
  if (result) res.json({ success: true, data: result });
});
