import { Router, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { augmentationService } from '../services/augmentation.service';

const router = Router();

// Get augmentation data for a person
router.get('/:personId', async (req: Request, res: Response) => {
  const { personId } = req.params;
  const data = augmentationService.getAugmentation(personId);

  if (!data) {
    res.status(404).json({ success: false, error: 'No augmentation data found' });
    return;
  }

  res.json({ success: true, data });
});

// Link a Wikipedia article to a person
router.post('/:personId/wikipedia', async (req: Request, res: Response) => {
  const { personId } = req.params;
  const { url } = req.body;

  if (!url) {
    res.status(400).json({ success: false, error: 'Wikipedia URL required' });
    return;
  }

  if (!url.includes('wikipedia.org')) {
    res.status(400).json({ success: false, error: 'Must be a Wikipedia URL' });
    return;
  }

  const data = await augmentationService.linkWikipedia(personId, url).catch(err => {
    console.error(`[augment] Error linking Wikipedia:`, err.message);
    res.status(500).json({ success: false, error: err.message });
    return null;
  });

  if (data) {
    res.json({ success: true, data });
  }
});

// Update custom augmentation data
router.put('/:personId', async (req: Request, res: Response) => {
  const { personId } = req.params;
  const { customBio, customPhotoUrl, notes } = req.body;

  const existing = augmentationService.getAugmentation(personId) || {
    id: personId,
    platforms: [],
    photos: [],
    descriptions: [],
    updatedAt: ''
  };

  const updated = {
    ...existing,
    customBio: customBio ?? existing.customBio,
    customPhotoUrl: customPhotoUrl ?? existing.customPhotoUrl,
    notes: notes ?? existing.notes,
    updatedAt: new Date().toISOString()
  };

  augmentationService.saveAugmentation(updated);
  res.json({ success: true, data: updated });
});

// Serve Wikipedia photo
router.get('/:personId/wiki-photo', async (req: Request, res: Response) => {
  const { personId } = req.params;
  const photoPath = augmentationService.getWikiPhotoPath(personId);

  if (!photoPath || !fs.existsSync(photoPath)) {
    res.status(404).json({ success: false, error: 'Wiki photo not found' });
    return;
  }

  const ext = path.extname(photoPath).toLowerCase();
  const contentType = ext === '.png' ? 'image/png' : 'image/jpeg';

  res.setHeader('Content-Type', contentType);
  res.setHeader('Cache-Control', 'public, max-age=86400');
  fs.createReadStream(photoPath).pipe(res);
});

// Check if wiki photo exists
router.get('/:personId/wiki-photo/exists', async (req: Request, res: Response) => {
  const { personId } = req.params;
  const exists = augmentationService.hasWikiPhoto(personId);
  res.json({ success: true, data: { exists } });
});

export const augmentationRouter = router;
