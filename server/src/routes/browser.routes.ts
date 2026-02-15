import { Router, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { browserService } from '../services/browser.service';
import { scraperService, ScrapeProgress } from '../services/scraper.service';

const router = Router();

const PHOTOS_DIR = path.resolve(import.meta.dirname, '../../../data/photos');

// Get browser status
router.get('/status', async (_req: Request, res: Response) => {
  const status = await browserService.getStatus().catch(err => {
    console.error('[browser] Status error:', err.message);
    return {
      connected: false,
      cdpUrl: browserService.getCdpUrl(),
      cdpPort: browserService.getCdpPort(),
      pageCount: 0,
      pages: [],
      familySearchLoggedIn: false,
      browserProcessRunning: false,
      autoConnect: browserService.getConfig().autoConnect
    };
  });
  res.json({ success: true, data: status });
});

// Get browser config
router.get('/config', (_req: Request, res: Response) => {
  const config = browserService.getConfig();
  res.json({ success: true, data: config });
});

// Update browser config
router.put('/config', (req: Request, res: Response) => {
  const updates = req.body;
  const config = browserService.updateConfig(updates);
  res.json({ success: true, data: config });
});

// Launch browser process
router.post('/launch', async (_req: Request, res: Response) => {
  const result = await browserService.launchBrowser();
  res.json({ success: result.success, data: result });
});

// Check if browser process is running
router.get('/running', async (_req: Request, res: Response) => {
  const running = await browserService.checkBrowserRunning();
  res.json({ success: true, data: { running } });
});

// Connect to browser
router.post('/connect', async (req: Request, res: Response) => {
  const { cdpUrl } = req.body;

  const browser = await browserService.connect(cdpUrl).catch(err => {
    console.error('[browser] Connect error:', err.message);
    res.status(500).json({ success: false, error: `Failed to connect: ${err.message}` });
    return null;
  });

  if (!browser) return;

  const status = await browserService.getStatus();

  res.json({
    success: true,
    data: status
  });
});

// Disconnect from browser
router.post('/disconnect', async (_req: Request, res: Response) => {
  await browserService.disconnect();
  res.json({ success: true, data: { connected: false } });
});

// Navigate to URL
router.post('/navigate', async (req: Request, res: Response) => {
  const { url } = req.body;

  if (!url) {
    res.status(400).json({ success: false, error: 'URL required' });
    return;
  }

  const page = await browserService.navigateTo(url);
  const pageUrl = page.url();
  const title = await page.title();

  res.json({
    success: true,
    data: { url: pageUrl, title }
  });
});

// Open FamilySearch login page
router.post('/login', async (_req: Request, res: Response) => {
  if (!browserService.isConnected()) {
    await browserService.connect();
  }

  const page = await browserService.navigateTo('https://www.familysearch.org/tree/');
  const url = page.url();
  const isLoggedIn = !url.includes('/signin');

  res.json({
    success: true,
    data: {
      url,
      isLoggedIn,
      message: isLoggedIn
        ? 'Already logged in to FamilySearch'
        : 'Please log in via the browser window'
    }
  });
});

// Scrape person data (streaming)
router.get('/scrape/:personId', async (req: Request, res: Response) => {
  const { personId } = req.params;

  // Set up SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const sendEvent = (event: string, data: unknown) => {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  const onProgress = (progress: ScrapeProgress) => {
    sendEvent(progress.phase, progress);
  };

  const data = await scraperService.scrapePerson(personId, onProgress).catch(err => {
    sendEvent('error', { message: err.message, personId });
    return null;
  });

  if (data) {
    sendEvent('complete', { data, personId });
  }

  res.end();
});

// Scrape person data (non-streaming)
router.post('/scrape/:personId', async (req: Request, res: Response) => {
  const { personId } = req.params;

  const data = await scraperService.scrapePerson(personId).catch(err => {
    console.error(`[browser] Scrape error for ${personId}:`, err.message);
    res.status(500).json({ success: false, error: err.message });
    return null;
  });

  if (data) {
    res.json({ success: true, data });
  }
});

// Get scraped data for a person
router.get('/scraped/:personId', async (req: Request, res: Response) => {
  const { personId } = req.params;
  const data = scraperService.getScrapedData(personId);

  if (!data) {
    res.status(404).json({ success: false, error: 'No scraped data found' });
    return;
  }

  res.json({ success: true, data });
});

// Serve photo files
router.get('/photos/:personId', async (req: Request, res: Response) => {
  const { personId } = req.params;
  const photoPath = scraperService.getPhotoPath(personId);

  if (!photoPath || !fs.existsSync(photoPath)) {
    res.status(404).json({ success: false, error: 'Photo not found' });
    return;
  }

  const ext = path.extname(photoPath).toLowerCase();
  const contentType = ext === '.png' ? 'image/png' : 'image/jpeg';

  res.setHeader('Content-Type', contentType);
  res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache for 24 hours
  fs.createReadStream(photoPath).pipe(res);
});

// Check if photo exists
router.get('/photos/:personId/exists', async (req: Request, res: Response) => {
  const { personId } = req.params;
  const exists = scraperService.hasPhoto(personId);
  res.json({ success: true, data: { exists } });
});

// Get FamilySearch authentication token from browser session
router.get('/token', async (_req: Request, res: Response) => {
  if (!browserService.isConnected()) {
    res.status(400).json({ success: false, error: 'Browser not connected' });
    return;
  }

  const result = await browserService.getFamilySearchToken().catch(err => {
    console.error('[browser] Token extraction error:', err.message);
    return { token: null, cookies: [] };
  });

  if (!result.token) {
    res.status(404).json({
      success: false,
      error: 'No FamilySearch token found. Make sure you are logged in.',
      cookies: result.cookies.map(c => c.name) // Just return cookie names for debugging
    });
    return;
  }

  res.json({
    success: true,
    data: {
      token: result.token,
      cookieCount: result.cookies.length
    }
  });
});

export const browserRouter = router;
