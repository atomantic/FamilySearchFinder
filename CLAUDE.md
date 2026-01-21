# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

FamilySearchFinder is a Node.js CLI tool for downloading and exploring family tree data from the FamilySearch API. It recursively downloads ancestor data, stores it locally as JSON, builds a graph database, and provides utilities for finding lineage paths between ancestors.

## Commands

### Download ancestry data
```bash
FS_ACCESS_TOKEN=YOUR_TOKEN node index PERSON_ID
# Options:
#   --max=N          Limit to N generations
#   --ignore=ID1,ID2 Skip specific person IDs
#   --cache=all|complete|none  Cache behavior (default: all)
#   --oldest=YEAR    Only include people born after YEAR (supports BC notation)
#   --tsv=true       Also log to TSV file during indexing
```

### Find lineage path between two people
```bash
node find ROOT_ID ANCESTOR_ID
# Options:
#   --method=s|l|r   shortest/longest/random path (default: s)
```

### Export database to TSV
```bash
node tsv DB_ID
```

### Print sorted by date
```bash
node print DB_ID [--bio]
```

### Purge records from cache
```bash
node purge ID1,ID2
```

### Prune unused person files
```bash
node prune DB_ID
```

## Architecture

### Data Flow
1. `index.js` fetches person data from FamilySearch API via `lib/fscget.js`
2. Raw API responses stored in `data/person/{ID}.json`
3. `lib/json2person.js` transforms API data to simplified person objects
4. Compiled graph database saved to `data/db-{ID}.json`

### Key Files
- `config.js` - API credentials (via `FS_ACCESS_TOKEN` env var), rate limiting delays, and "known unknowns" filter list
- `lib/fs.client.js` - FamilySearch API client wrapper using `fs-js-lite`
- `lib/json2person.js` - Transforms raw API JSON to person objects with: name, lifespan, location, parents[], children[], occupation, bio
- `lib/pathShortest.js`, `lib/pathLongest.js`, `lib/pathRandom.js` - Graph traversal algorithms for finding lineage paths

### Data Structure
Person object in database:
```javascript
{
  name: string,
  lifespan: "BIRTH-DEATH",  // supports BC notation
  location: string,
  parents: [ID, ID],
  children: [ID, ...],  // populated during db save
  occupation: string,
  bio: string
}
```

### Authentication
Get your access token from browser dev tools when logged into FamilySearch - copy the Authorization header value (without "Bearer" prefix). Tokens last 24+ hours.

## Web UI

### Development
The app runs via PM2 with live reload enabled. No need to run `npm run dev` - just edit files and changes will auto-reload.

```bash
# App is already running on:
# - Frontend: http://localhost:6373
# - Backend: http://localhost:6374

# If needed to restart:
pm2 restart ecosystem.config.cjs
```

### Structure
- `client/` - React + Vite + Tailwind frontend
- `server/` - Express API backend
- `shared/` - TypeScript types shared between client/server

### API Endpoints
- `GET /api/databases` - List all graph databases
- `GET /api/persons/:dbId` - List persons in database
- `GET /api/persons/:dbId/:id/tree` - Get tree data for D3
- `GET /api/search/:dbId?q=&location=&occupation=` - Search with filters
- `POST /api/path/:dbId` - Find path (body: source, target, method)
- `GET /api/indexer/events` - SSE stream for indexer progress
- `GET /api/export/:dbId/tsv` - Export as TSV

### AI Toolkit Integration
The server integrates `@portos/ai-toolkit` for AI provider management:
- `GET/POST /api/providers` - Manage AI providers
- `GET/POST /api/runs` - Execute and track AI runs
- `GET/POST /api/prompts` - Manage prompt templates

Provider configuration stored in `data/ai/providers.json`.

## Browser Automation

Persistent Chrome with CDP on port 9920:
```bash
./.browser/start.sh
```
Profile data stored in `.browser/data/`. Connect via `ws://localhost:9920`.

## Notes
- The database has cyclic loop issues (people linked as their own ancestors) - use longest path method to detect these
- ES modules (`"type": "module"` in package.json)
- Rate limiting built-in with random delays between API calls
