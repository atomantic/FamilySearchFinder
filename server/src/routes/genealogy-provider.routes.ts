import { Router, Request, Response } from 'express';
import type { GenealogyProviderConfig, PlatformType } from '@fsf/shared';
import { genealogyProviderService } from '../services/genealogy-provider.service.js';

const router = Router();

// List all providers
router.get('/', (_req: Request, res: Response) => {
  const registry = genealogyProviderService.getProviders();
  res.json({ success: true, data: registry });
});

// Get available platform defaults (for dropdown)
router.get('/platforms', (_req: Request, res: Response) => {
  const platforms = genealogyProviderService.listPlatformDefaults();
  res.json({ success: true, data: platforms });
});

// Get defaults for a specific platform
router.get('/defaults/:platform', (req: Request, res: Response) => {
  const { platform } = req.params;
  const defaults = genealogyProviderService.getProviderDefaults(platform as PlatformType);

  if (!defaults) {
    res.status(404).json({ success: false, error: `No defaults found for platform: ${platform}` });
    return;
  }

  res.json({ success: true, data: defaults });
});

// Get single provider
router.get('/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const provider = genealogyProviderService.getProvider(id);

  if (!provider) {
    res.status(404).json({ success: false, error: `Provider ${id} not found` });
    return;
  }

  res.json({ success: true, data: provider });
});

// Create provider
router.post('/', (req: Request, res: Response) => {
  const config = req.body as GenealogyProviderConfig;

  if (!config.platform) {
    res.status(400).json({ success: false, error: 'Platform is required' });
    return;
  }

  if (!config.name) {
    res.status(400).json({ success: false, error: 'Name is required' });
    return;
  }

  // Generate ID if not provided
  if (!config.id) {
    config.id = config.platform + '-' + Date.now();
  }

  // Set defaults if not provided
  if (!config.rateLimit) {
    const defaults = genealogyProviderService.getProviderDefaults(config.platform);
    if (defaults?.rateLimit) {
      config.rateLimit = defaults.rateLimit;
    } else {
      config.rateLimit = {
        requestsPerWindow: 60,
        windowSeconds: 60,
        minDelayMs: 500,
        maxDelayMs: 1500
      };
    }
  }

  if (config.enabled === undefined) {
    config.enabled = true;
  }

  const saved = genealogyProviderService.saveProvider(config);
  res.status(201).json({ success: true, data: saved });
});

// Update provider
router.put('/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const existing = genealogyProviderService.getProvider(id);

  if (!existing) {
    res.status(404).json({ success: false, error: `Provider ${id} not found` });
    return;
  }

  const updated: GenealogyProviderConfig = {
    ...existing,
    ...req.body,
    id // Ensure ID doesn't change
  };

  const saved = genealogyProviderService.saveProvider(updated);
  res.json({ success: true, data: saved });
});

// Delete provider
router.delete('/:id', (req: Request, res: Response) => {
  const { id } = req.params;

  const result = (() => {
    genealogyProviderService.deleteProvider(id);
    return { success: true };
  })();

  if (!result.success) {
    res.status(404).json({ success: false, error: `Provider ${id} not found` });
    return;
  }

  res.json({ success: true, data: { deleted: id } });
});

// Test connection
router.post('/:id/test', async (req: Request, res: Response) => {
  const { id } = req.params;
  const result = await genealogyProviderService.testConnection(id);

  res.json({
    success: result.success,
    data: result,
    error: result.success ? undefined : result.message
  });
});

// Set as active provider
router.post('/:id/activate', (req: Request, res: Response) => {
  const { id } = req.params;

  const provider = genealogyProviderService.getProvider(id);
  if (!provider) {
    res.status(404).json({ success: false, error: `Provider ${id} not found` });
    return;
  }

  genealogyProviderService.setActiveProvider(id);
  res.json({ success: true, data: { activeProvider: id } });
});

// Deactivate (set no active provider)
router.post('/deactivate', (_req: Request, res: Response) => {
  genealogyProviderService.setActiveProvider(null);
  res.json({ success: true, data: { activeProvider: null } });
});

export const genealogyProviderRouter = router;
