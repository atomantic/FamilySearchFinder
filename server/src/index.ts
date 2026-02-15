import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { createAIToolkit } from 'portos-ai-toolkit/server';
import { databaseRoutes } from './routes/database.routes.js';
import { personRoutes } from './routes/person.routes.js';
import { searchRoutes } from './routes/search.routes.js';
import { pathRoutes } from './routes/path.routes.js';
import { indexerRoutes } from './routes/indexer.routes.js';
import { exportRoutes } from './routes/export.routes.js';
import { browserRouter } from './routes/browser.routes.js';
import { augmentationRouter } from './routes/augmentation.routes.js';
import { genealogyProviderRouter } from './routes/genealogy-provider.routes.js';
import { providerRouter } from './routes/provider.routes.js';
import { gedcomRouter } from './routes/gedcom.routes.js';
import { syncRouter } from './routes/sync.routes.js';
import { favoritesRouter } from './routes/favorites.routes.js';
import { ancestryTreeRouter } from './routes/ancestry-tree.routes.js';
import { errorHandler } from './middleware/errorHandler.js';
import { requestLogger } from './middleware/requestLogger.js';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: '*' }
});

const PORT = parseInt(process.env.PORT || '6374', 10);

// Middleware
app.use(cors({ origin: '*' }));
app.use(express.json());
app.use(requestLogger);

// Initialize AI Toolkit with routes for providers, runs, and prompts
const aiToolkit = createAIToolkit({
  dataDir: '../data/ai',
  io
});
aiToolkit.mountRoutes(app);

// Routes
app.use('/api/databases', databaseRoutes);
app.use('/api/persons', personRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/path', pathRoutes);
app.use('/api/indexer', indexerRoutes);
app.use('/api/export', exportRoutes);
app.use('/api/browser', browserRouter);
app.use('/api/augment', augmentationRouter);
app.use('/api/genealogy-providers', genealogyProviderRouter);
app.use('/api/scrape-providers', providerRouter);
app.use('/api/gedcom', gedcomRouter);
app.use('/api/sync', syncRouter);
app.use('/api/favorites', favoritesRouter);
app.use('/api/ancestry-tree', ancestryTreeRouter);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Socket.IO connection
io.on('connection', (socket) => {
  console.log(`🔌 Client connected: ${socket.id}`);
  socket.on('disconnect', () => {
    console.log(`🔌 Client disconnected: ${socket.id}`);
  });
});

// Error handling
app.use(errorHandler);

httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
