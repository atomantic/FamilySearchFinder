import type { IndexerStatus, IndexOptions, IndexerProgress } from '@fsf/shared';
import { sseManager } from '../utils/sseManager.js';
import { browserService } from './browser.service.js';
import { spawn, ChildProcess } from 'child_process';
import path from 'path';

const PROJECT_ROOT = path.resolve(import.meta.dirname, '../../../');

let currentStatus: IndexerStatus = {
  jobId: null,
  status: 'idle'
};

let currentProcess: ChildProcess | null = null;

export const indexerService = {
  getStatus(): IndexerStatus {
    return currentStatus;
  },

  async startIndexing(options: IndexOptions): Promise<IndexerStatus> {
    if (currentStatus.status === 'running') {
      throw new Error('Indexer is already running');
    }

    const jobId = `job-${Date.now()}`;
    const progress: IndexerProgress = {
      new: 0,
      cached: 0,
      refreshed: 0,
      generations: 0,
      deepest: '',
      currentPerson: undefined
    };

    currentStatus = {
      jobId,
      status: 'running',
      rootId: options.rootId,
      startedAt: new Date().toISOString(),
      progress
    };

    sseManager.broadcast('started', {
      type: 'started',
      timestamp: new Date().toISOString(),
      data: { jobId, rootId: options.rootId, options }
    });

    // Run indexing in background
    this.runIndexing(options, jobId, progress).catch(err => {
      console.error('[indexer] Error during indexing:', err);
      currentStatus = {
        ...currentStatus,
        status: 'error',
        error: err.message
      };
      sseManager.broadcast('error', {
        type: 'error',
        timestamp: new Date().toISOString(),
        data: { jobId, message: err.message }
      });
    });

    return currentStatus;
  },

  async runIndexing(options: IndexOptions, jobId: string, progress: IndexerProgress): Promise<void> {
    const { rootId, maxGenerations, ignoreIds = [], cacheMode = 'all', oldest } = options;

    console.log(`[indexer] Starting indexing for ${rootId}`);
    console.log(`[indexer] Options: maxGen=${maxGenerations || 'unlimited'}, cacheMode=${cacheMode}, oldest=${oldest || 'none'}, ignoreIds=${ignoreIds.length}`);

    // Get FamilySearch token from browser session
    if (!browserService.isConnected()) {
      console.log('[indexer] Connecting to browser...');
      await browserService.connect();
    }

    const { token } = await browserService.getFamilySearchToken();
    if (!token) {
      throw new Error('No FamilySearch token found. Please log in via the browser.');
    }

    console.log('[indexer] Got FamilySearch token, spawning CLI...');

    // Build CLI arguments
    const args: string[] = ['index.js', rootId];

    if (maxGenerations !== undefined && maxGenerations !== null) {
      args.push(`--max=${maxGenerations}`);
    }

    if (cacheMode && cacheMode !== 'all') {
      args.push(`--cache=${cacheMode}`);
    }

    if (ignoreIds.length > 0) {
      args.push(`--ignore=${ignoreIds.join(',')}`);
    }

    if (oldest) {
      args.push(`--oldest=${oldest}`);
    }

    console.log(`[indexer] Running: node ${args.join(' ')}`);

    // Spawn the CLI process with the token
    currentProcess = spawn('node', args, {
      cwd: PROJECT_ROOT,
      env: {
        ...process.env,
        FS_ACCESS_TOKEN: token
      },
      stdio: ['ignore', 'pipe', 'pipe']
    });

    // Parse CLI output to update progress
    currentProcess.stdout?.on('data', (data: Buffer) => {
      const lines = data.toString().split('\n').filter(l => l.trim());

      for (const line of lines) {
        console.log(`[cli] ${line}`);

        // Parse progress from CLI output
        // Format: "icon GGG ID (PARENT+PARENT) LIFESPAN NAME, LOCATION [OCCUPATION]"
        // Where GGG is generation number like 000, 001, etc.
        // Use \S+ for emoji since emojis are multi-codepoint
        const genMatch = line.match(/^\S+\s+(\d{3})\s+/);
        const idMatch = line.match(/\d{3}\s+([A-Z0-9]{4}-[A-Z0-9]{2,4})\s/);

        if (genMatch) {
          const gen = parseInt(genMatch[1], 10);
          if (gen > progress.generations) {
            progress.generations = gen;
          }
        }

        if (idMatch) {
          progress.currentPerson = idMatch[1];
        }

        // Parse icon for status counting
        if (line.includes('✅')) progress.new++;
        else if (line.includes('🔄')) progress.refreshed++;
        else if (line.includes('💾')) progress.cached++;

        // Parse deepest ancestor from name
        const nameMatch = line.match(/[A-Z0-9]{4}-[A-Z0-9]{2,4}\s+([^-]+)/);
        if (nameMatch && genMatch) {
          const gen = parseInt(genMatch[1], 10);
          if (gen >= progress.generations) {
            progress.deepest = nameMatch[1].trim().split(' - ')[0];
          }
        }

        // Broadcast CLI output line for real-time display
        sseManager.broadcast('output', {
          type: 'output',
          timestamp: new Date().toISOString(),
          data: { jobId, line }
        });

        // Broadcast progress update
        sseManager.broadcast('progress', {
          type: 'progress',
          timestamp: new Date().toISOString(),
          data: { jobId, progress: { ...progress } }
        });
      }
    });

    currentProcess.stderr?.on('data', (data: Buffer) => {
      console.error(`[cli stderr] ${data.toString()}`);
    });

    // Wait for process to complete
    await new Promise<void>((resolve, reject) => {
      currentProcess!.on('close', (code) => {
        console.log(`[indexer] CLI process exited with code ${code}`);
        currentProcess = null;

        if (code === 0) {
          currentStatus = {
            ...currentStatus,
            status: 'completed',
            progress
          };
          sseManager.broadcast('completed', {
            type: 'completed',
            timestamp: new Date().toISOString(),
            data: {
              jobId,
              progress,
              message: `Indexed ${progress.new + progress.cached + progress.refreshed} ancestors over ${progress.generations} generations`
            }
          });
          resolve();
        } else if (code === null) {
          // Process was killed (stopped by user)
          currentStatus = {
            jobId: null,
            status: 'idle',
            progress
          };
          sseManager.broadcast('stopped', {
            type: 'stopped',
            timestamp: new Date().toISOString(),
            data: { jobId, progress }
          });
          resolve();
        } else {
          currentStatus = {
            ...currentStatus,
            status: 'error',
            error: `CLI exited with code ${code}`
          };
          reject(new Error(`CLI exited with code ${code}`));
        }
      });

      currentProcess!.on('error', (err) => {
        console.error('[indexer] Failed to spawn CLI:', err);
        currentProcess = null;
        reject(err);
      });
    });

    progress.currentPerson = undefined;
  },

  async stopIndexing(): Promise<void> {
    if (currentStatus.status !== 'running') {
      throw new Error('No indexing job is running');
    }

    console.log('[indexer] Stop requested');

    if (currentProcess) {
      // Send SIGINT to allow graceful shutdown (CLI handles SIGINT to save progress)
      currentProcess.kill('SIGINT');
      currentStatus.status = 'stopping';
    }
  }
};
