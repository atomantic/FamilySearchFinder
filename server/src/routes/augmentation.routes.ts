import { Router, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import type { ProviderPersonMapping, PlatformType } from '@fsf/shared';
import { augmentationService } from '../services/augmentation.service.js';

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

// Get all provider mappings for a person
router.get('/:personId/provider-links', (req: Request, res: Response) => {
  const { personId } = req.params;
  const mappings = augmentationService.getProviderMappings(personId);
  res.json({ success: true, data: mappings });
});

// Link a person to a provider
router.post('/:personId/provider-link', (req: Request, res: Response) => {
  const { personId } = req.params;
  const { providerId, platform, url, externalId, confidence, matchedBy } = req.body;

  if (!providerId) {
    res.status(400).json({ success: false, error: 'Provider ID is required' });
    return;
  }

  if (!platform) {
    res.status(400).json({ success: false, error: 'Platform is required' });
    return;
  }

  if (!url) {
    res.status(400).json({ success: false, error: 'URL is required' });
    return;
  }

  const mapping: Omit<ProviderPersonMapping, 'linkedAt'> = {
    providerId,
    platform: platform as PlatformType,
    url,
    externalId,
    confidence: confidence || 'medium',
    matchedBy: matchedBy || 'manual',
  };

  const data = augmentationService.addProviderMapping(personId, mapping);
  res.json({ success: true, data });
});

// Unlink a person from a provider
router.delete('/:personId/provider-link/:providerId', (req: Request, res: Response) => {
  const { personId, providerId } = req.params;

  const data = augmentationService.removeProviderMapping(personId, providerId);

  if (!data) {
    res.status(404).json({ success: false, error: 'No augmentation data found' });
    return;
  }

  res.json({ success: true, data });
});

export const augmentationRouter = router;
