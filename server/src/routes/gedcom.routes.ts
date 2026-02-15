import { Router, Request, Response } from 'express';
import { gedcomService } from '../services/gedcom.service';

const router = Router();

/**
 * Export database to GEDCOM format
 */
router.get('/export/:dbId', (req: Request, res: Response) => {
  const { dbId } = req.params;

  const gedcom = gedcomService.exportToGedcom(dbId);

  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${dbId}.ged"`);
  res.send(gedcom);
});

/**
 * Import GEDCOM file (expects JSON body with content and dbName)
 */
router.post('/import', (req: Request, res: Response) => {
  const { content, dbName } = req.body as { content: string; dbName: string };

  if (!content) {
    res.status(400).json({ success: false, error: 'GEDCOM content is required' });
    return;
  }

  if (!dbName) {
    res.status(400).json({ success: false, error: 'Database name is required' });
    return;
  }

  // Validate first
  const validation = gedcomService.validateGedcom(content);
  if (!validation.valid) {
    res.status(400).json({
      success: false,
      error: 'Invalid GEDCOM file',
      details: validation.errors
    });
    return;
  }

  // Import
  const result = gedcomService.importGedcom(content, dbName);

  res.json({
    success: true,
    data: result
  });
});

/**
 * Validate GEDCOM file without importing
 */
router.post('/validate', (req: Request, res: Response) => {
  const { content } = req.body as { content: string };

  if (!content) {
    res.status(400).json({ success: false, error: 'GEDCOM content is required' });
    return;
  }

  const validation = gedcomService.validateGedcom(content);

  res.json({
    success: true,
    data: validation
  });
});

/**
 * Parse GEDCOM and return preview data
 */
router.post('/preview', (req: Request, res: Response) => {
  const { content } = req.body as { content: string };

  if (!content) {
    res.status(400).json({ success: false, error: 'GEDCOM content is required' });
    return;
  }

  const validation = gedcomService.validateGedcom(content);
  if (!validation.valid) {
    res.status(400).json({
      success: false,
      error: 'Invalid GEDCOM file',
      details: validation.errors
    });
    return;
  }

  const parsed = gedcomService.parseGedcom(content);

  // Return summary info
  res.json({
    success: true,
    data: {
      header: parsed.header,
      individualCount: Object.keys(parsed.individuals).length,
      familyCount: Object.keys(parsed.families).length,
      // Include first few individuals as preview
      sampleIndividuals: Object.values(parsed.individuals).slice(0, 10).map(p => ({
        id: p.id,
        name: p.name,
        birthDate: p.birth?.date,
        deathDate: p.death?.date
      }))
    }
  });
});

export const gedcomRouter = router;
