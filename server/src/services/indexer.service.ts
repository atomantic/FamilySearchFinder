import type { IndexerStatus, IndexOptions } from '@fsf/shared';
import { sseManager } from '../utils/sseManager.js';

// Stub implementation - will be expanded in Phase 7
let currentStatus: IndexerStatus = {
  jobId: null,
  status: 'idle'
};

export const indexerService = {
  getStatus(): IndexerStatus {
    return currentStatus;
  },

  async startIndexing(options: IndexOptions): Promise<IndexerStatus> {
    if (currentStatus.status === 'running') {
      throw new Error('Indexer is already running');
    }

    const jobId = `job-${Date.now()}`;
    currentStatus = {
      jobId,
      status: 'running',
      rootId: options.rootId,
      startedAt: new Date().toISOString(),
      progress: {
        new: 0,
        cached: 0,
        refreshed: 0,
        generations: 0,
        deepest: ''
      }
    };

    sseManager.broadcast('started', {
      type: 'started',
      timestamp: new Date().toISOString(),
      data: { jobId, rootId: options.rootId, options }
    });

    // TODO: Implement actual indexing logic in Phase 7
    // For now, just simulate completion after a short delay
    setTimeout(() => {
      currentStatus = {
        ...currentStatus,
        status: 'completed'
      };
      sseManager.broadcast('completed', {
        type: 'completed',
        timestamp: new Date().toISOString(),
        data: { jobId, message: 'Indexing not yet implemented' }
      });
    }, 1000);

    return currentStatus;
  },

  async stopIndexing(): Promise<void> {
    if (currentStatus.status !== 'running') {
      throw new Error('No indexing job is running');
    }

    currentStatus.status = 'stopping';
    sseManager.broadcast('stopped', {
      type: 'stopped',
      timestamp: new Date().toISOString(),
      data: { jobId: currentStatus.jobId }
    });

    // TODO: Implement actual stop logic in Phase 7
    currentStatus = {
      jobId: null,
      status: 'idle'
    };
  }
};
