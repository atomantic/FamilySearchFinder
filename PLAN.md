# Multi-Platform Genealogy Data Architecture

## Status: IMPLEMENTED

All phases have been completed. The new architecture supports:
- Richer person data extraction from FamilySearch (gender, living, birth/death objects, spouses, multiple occupations, alternate names)
- Multi-platform augmentation (Wikipedia, with support for future platforms like FindAGrave, Heritage, etc.)
- Backwards compatibility with existing data through computed fields (lifespan, location, occupation)

---

## Implementation Summary

### Phase 1: Shared Type Definitions ✅
**File:** `shared/src/index.ts`

New types added:
- `VitalEvent` - Birth/death/burial with date, dateFormal, place, placeId
- `Person` - Enhanced with gender, living, birth/death/burial objects, occupations[], spouses[], alternateNames[], lastModified
- `PlatformReference` - Cross-platform linking (familysearch, wikipedia, findagrave, etc.)
- `PersonPhoto` - Photo with url, source, localPath, isPrimary
- `PersonDescription` - Description with text, source, language
- `PersonAugmentation` - Multi-platform augmentation record

### Phase 2: Enhanced Person Extraction ✅
**File:** `lib/json2person.js`

Now extracts:
- `alternateNames[]` - From AlsoKnownAs and non-preferred BirthName entries
- `gender` - male/female/unknown from GEDCOMX type
- `living` - Boolean flag
- `birth` - Object with date, dateFormal, place, placeId
- `death` - Object with date, dateFormal, place, placeId
- `burial` - Object with date, place
- `occupations[]` - All occupations AND titles (nobility)
- `spouses[]` - Spouse IDs from familiesAsParent
- `lastModified` - Most recent modification timestamp

Maintains backwards compatibility:
- `lifespan` - Computed from birth.date and death.date
- `location` - First available place (birth or death)
- `occupation` - First occupation

### Phase 3: Database Rebuild Script ✅
**File:** `rebuild.js`

Usage:
```bash
node rebuild DB_ID           # Rebuild specific database
node rebuild --all           # Rebuild all databases
```

### Phase 4: Augmentation Migration ✅
**File:** `server/src/services/augmentation.service.ts`

New features:
- Multi-platform support with `platforms[]` array
- Photos array with url, source, localPath, isPrimary
- Descriptions array with text, source, language
- Automatic migration of legacy Wikipedia-only augmentations
- Helper methods: `addPlatform()`, `addPhoto()`, `addDescription()`, `getPrimaryPhoto()`, `getPrimaryDescription()`, `hasPlatform()`, `getLinkedPlatforms()`

### Phase 5: UI Updates ✅
**File:** `client/src/components/person/PersonDetail.tsx`

New displays:
- Gender badge (male/female)
- Alternate names list
- Separate Birth/Death/Burial cards with date and place
- All occupations as badges
- Spouses section with links
- Platform badges showing linked sources (Wikipedia, etc.)
- Backwards compatibility for old data without new fields

**File:** `server/src/services/search.service.ts`

Updated to search:
- New `birth.date` and `birth.place` fields
- New `occupations[]` array
- `alternateNames[]` in text search

---

## Data Structure Examples

### New Person Record
```json
{
  "name": "Guy le Strange",
  "alternateNames": ["Guy De Wallense", "Guy Wallace"],
  "gender": "male",
  "living": false,
  "birth": {
    "date": "Abt 1048",
    "dateFormal": "+1048",
    "place": "England"
  },
  "death": {
    "date": "1105",
    "dateFormal": "+1105",
    "place": "London City, Middlesex, England"
  },
  "occupations": ["Sheriff of Metz"],
  "spouses": ["GZ79-RNZ"],
  "parents": ["PARENT-ID-1", "PARENT-ID-2"],
  "children": [],
  "lastModified": "2024-01-15T10:30:00.000Z",
  "lifespan": "1048-1105",
  "location": "England",
  "occupation": "Sheriff of Metz"
}
```

### New Augmentation Record
```json
{
  "id": "PERSON-ID",
  "platforms": [
    {
      "platform": "wikipedia",
      "url": "https://en.wikipedia.org/wiki/...",
      "linkedAt": "2024-01-15T10:30:00.000Z"
    }
  ],
  "photos": [
    {
      "url": "https://upload.wikimedia.org/...",
      "source": "wikipedia",
      "localPath": "/data/photos/PERSON-ID-wiki.jpg",
      "isPrimary": true,
      "downloadedAt": "2024-01-15T10:30:00.000Z"
    }
  ],
  "descriptions": [
    {
      "text": "Guy le Strange was a medieval nobleman...",
      "source": "wikipedia",
      "language": "en"
    }
  ],
  "customBio": "Additional notes...",
  "notes": "Research notes...",
  "updatedAt": "2024-01-15T10:30:00.000Z"
}
```

---

## Multi-Provider Genealogy System (Phase 6) ✅

### Overview
Added support for configuring multiple genealogy providers (FamilySearch, MyHeritage, Geni, WikiTree, FindMyPast) and mapping database nodes to provider records.

### Supported Providers

| Provider | Auth | Rate Limits |
|----------|------|-------------|
| FamilySearch | Session Token | 100 req/60s |
| MyHeritage | OAuth 2.0 | 60 req/60s |
| Geni | OAuth 2.0 | 40 req/10s |
| WikiTree | None (public) | 60 req/60s |
| FindMyPast | API Key | 30 req/60s |
| Ancestry | OAuth 2.0 | 30 req/60s |
| Find A Grave | None | 20 req/60s |

### New Types (shared/src/index.ts)
- `GenealogyAuthType` - oauth2, api_key, session_token, none
- `GenealogyProviderConfig` - Provider configuration with credentials and rate limits
- `GenealogyProviderRegistry` - Active provider and all configured providers
- `ProviderPersonMapping` - Link between a person and an external provider record

### New Backend Service
**File:** `server/src/services/genealogy-provider.service.ts`

Methods:
- `getProviders()` - Get all configured providers
- `getProvider(id)` - Get single provider
- `saveProvider(config)` - Create/update provider
- `deleteProvider(id)` - Remove provider
- `setActiveProvider(id)` - Set active provider for indexing
- `testConnection(id)` - Test provider connectivity
- `getProviderDefaults(platform)` - Get default settings for a platform

### New API Routes
**File:** `server/src/routes/genealogy-provider.routes.ts`

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/genealogy-providers | List all providers |
| GET | /api/genealogy-providers/:id | Get single provider |
| POST | /api/genealogy-providers | Create provider |
| PUT | /api/genealogy-providers/:id | Update provider |
| DELETE | /api/genealogy-providers/:id | Delete provider |
| POST | /api/genealogy-providers/:id/test | Test connection |
| POST | /api/genealogy-providers/:id/activate | Set as active |
| GET | /api/genealogy-providers/platforms | List available platforms |
| GET | /api/genealogy-providers/defaults/:platform | Get platform defaults |

### Person-Provider Linking
**Extended:** `server/src/routes/augmentation.routes.ts`

| Method | Path | Description |
|--------|------|-------------|
| POST | /api/augment/:personId/provider-link | Link person to provider |
| DELETE | /api/augment/:personId/provider-link/:providerId | Unlink |
| GET | /api/augment/:personId/provider-links | Get all links |

### Frontend Pages
**New files:**
- `client/src/pages/GenealogyProviders.tsx` - Provider list with status, test, activate
- `client/src/pages/GenealogyProviderEdit.tsx` - Form for creating/editing providers

**Routes:** `/providers/genealogy`, `/providers/genealogy/new`, `/providers/genealogy/:id/edit`

### Person Detail Updates
**File:** `client/src/components/person/PersonDetail.tsx`

- Added "Provider Links" section
- Link person to any configured provider with URL and external ID
- Confidence indicator (high/medium/low)
- Open in provider button
- Unlink action

### Data Storage
- Provider config: `data/genealogy-providers.json`
- Person mappings: `data/augment/{personId}.json` (providerMappings array)

---

## Favorites & Sparse Family Tree (Phase 7) ✅

### Overview
Added ability to mark people as "favorites" with notes about why they're interesting, view all favorites on a dedicated page, and generate a sparse family tree visualization showing the lineage from root to selected interesting ancestors.

### New Types (shared/src/index.ts)
- `FavoriteData` - isFavorite, whyInteresting, addedAt, tags[]
- `SparseTreeNode` - Node for visualization with generation info
- `SparseTreeResult` - Tree root, totalFavorites, maxGeneration
- `FavoriteWithPerson` - Favorite with person details for listing
- `FavoritesList` - Paginated list of favorites with allTags

### Extended Type
- `PersonAugmentation` - Added `favorite?: FavoriteData` field

### Backend Services
**File:** `server/src/services/favorites.service.ts`
- `getFavorite(personId)` - Get favorite status
- `setFavorite(personId, whyInteresting, tags)` - Mark as favorite
- `updateFavorite(personId, whyInteresting, tags)` - Update favorite
- `removeFavorite(personId)` - Remove from favorites
- `listFavorites(page, limit)` - List all favorites with pagination
- `getFavoritesInDatabase(dbId)` - Get favorites in a specific database
- `getAllTags()` - Get all unique tags

**File:** `server/src/services/sparse-tree.service.ts`
- `getSparseTree(dbId)` - Generate sparse tree showing only favorites

### API Routes
**File:** `server/src/routes/favorites.routes.ts`

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/favorites | List all favorites (paginated) |
| GET | /api/favorites/tags | Get preset and all tags |
| GET | /api/favorites/in-database/:dbId | Get favorites in database |
| GET | /api/favorites/sparse-tree/:dbId | Get sparse tree visualization |
| GET | /api/favorites/:personId | Get favorite status |
| POST | /api/favorites/:personId | Mark as favorite |
| PUT | /api/favorites/:personId | Update favorite |
| DELETE | /api/favorites/:personId | Remove from favorites |

### Frontend Components
**New files:**
- `client/src/components/favorites/FavoriteButton.tsx` - Star toggle button
- `client/src/components/favorites/WhyInterestingModal.tsx` - Modal for adding/editing favorites
- `client/src/components/favorites/FavoritesPage.tsx` - List of all favorites with filtering
- `client/src/components/favorites/SparseTreePage.tsx` - D3.js visualization of sparse tree

**Routes:** `/favorites`, `/favorites/sparse-tree/:dbId`

### Navigation Updates
**File:** `client/src/components/layout/Sidebar.tsx`
- Added "Favorites" link to primary navigation
- Added "Sparse Tree" link to database-specific navigation

### PersonDetail Integration
**File:** `client/src/components/person/PersonDetail.tsx`
- Added FavoriteButton next to gender badge

### Preset Tags
- royalty, immigrant, revolutionary, founder, notable, military, religious
- scientist, artist, politician, explorer, criminal

### Sparse Tree Features
- Vertical layout (root at top)
- Shows only favorites and branch points
- Generation skip labels on edges (e.g., "12 gen")
- Node cards with photo, name, lifespan, tags
- Click to see details panel
- Zoom/pan controls
- SVG export functionality

---

## FamilySearch-Style Ancestry Tree (Phase 8) ✅

### Overview
Replaced the simple D3 tree view with a FamilySearch-style ancestry visualization featuring:
- Paired father/mother cards with gender-colored borders (blue/pink)
- Circular photos with fallback placeholders
- Click-to-expand ">" buttons for lazy loading ancestors
- Horizontal layout (root left, ancestors right)
- Gray connection lines between family units
- D3.js-powered zoom/pan

### New Types (shared/src/index.ts)
- `AncestryPersonCard` - Person card data with id, name, lifespan, gender, photoUrl, hasMoreAncestors
- `AncestryFamilyUnit` - Family unit with father/mother cards and nested parentUnits
- `AncestryTreeResult` - Full tree with rootPerson, rootSpouse, parentUnits, maxGenerationLoaded
- `ExpandAncestryRequest` - Request to expand a specific person's ancestors

### Backend Service
**File:** `server/src/services/ancestry-tree.service.ts`

Methods:
- `getAncestryTree(dbId, personId, depth)` - Build ancestry tree (default 4 generations)
- `expandAncestry(dbId, fatherId, motherId, depth)` - Expand specific parents for lazy loading

Photo resolution priority:
1. Wikipedia photo (from augmentation)
2. Scraped FamilySearch photo
3. Placeholder icon

### API Routes
**File:** `server/src/routes/ancestry-tree.routes.ts`

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/ancestry-tree/:dbId/:personId | Get ancestry tree (4 gen default) |
| POST | /api/ancestry-tree/:dbId/expand | Expand specific parents |

### Client API
**File:** `client/src/services/api.ts`
- `getAncestryTree(dbId, personId, depth)` - Fetch ancestry tree
- `expandAncestryGeneration(dbId, request, depth)` - Expand ancestors lazily

### Frontend Components
**New folder:** `client/src/components/ancestry-tree/`

| Component | Description |
|-----------|-------------|
| `PersonCard.tsx` | Individual person card with photo, name, lifespan, gender border, expand button |
| `FamilyUnitCard.tsx` | Vertical stack of father/mother PersonCards |
| `ConnectionLine.tsx` | SVG path components for tree connections |
| `AncestryTreeView.tsx` | Main component with D3 zoom/pan, recursive rendering |
| `index.ts` | Barrel export |

### Styling
- Male border: `border-l-4 border-blue-500`
- Female border: `border-l-4 border-pink-500`
- Unknown border: `border-l-4 border-gray-500`
- Circular 48px photos with User icon fallback
- Dark theme compatible colors

### Routes Updated
**File:** `client/src/App.tsx`
- `/tree/:dbId` → `AncestryTreeView` (replaced old TreeView)
- `/tree/:dbId/:personId` → `AncestryTreeView`

---

## Browser-Based Genealogy Provider System (Phase 9) ✅

### Overview
Transformed the genealogy provider system from API-based to browser scraping automation. Added 4 built-in providers with browser-based session checking, GEDCOM import/export, and cross-provider sync capabilities.

### Built-in Providers

| Provider | Login URL | Tree URL |
|----------|-----------|----------|
| FamilySearch | familysearch.org/auth/familysearch/login | familysearch.org/tree/pedigree/landscape/{id} |
| Ancestry | ancestry.com/account/signin | ancestry.com/family-tree/tree/{treeId}/family |
| 23AndMe | you.23andme.com/ | you.23andme.com/family/tree/ |
| WikiTree | wikitree.com/wiki/Special:Userlogin | wikitree.com/wiki/{WikiTreeId} |

### New Types (shared/src/index.ts)
- `BuiltInProvider` - 'familysearch' | 'ancestry' | '23andme' | 'wikitree'
- `ProviderSessionStatus` - Browser login status for a provider
- `ProviderTreeInfo` - Tree information from a provider
- `UserProviderConfig` - User configuration per provider (enable/disable, rate limits)
- `ProviderRegistry` - All provider configurations
- `ScrapedPersonData` - Standardized scraped data format
- `GedcomPerson`, `GedcomFamily`, `GedcomFile` - GEDCOM import/export types
- `ProviderComparison`, `SyncProgress` - Cross-provider sync types

### Scraper Architecture

**Base Interface:** `server/src/services/scrapers/base.scraper.ts`
```typescript
interface ProviderScraper {
  provider: BuiltInProvider;
  displayName: string;
  loginUrl: string;
  checkLoginStatus(page): Promise<boolean>;
  getLoggedInUser(page): Promise<{name?, userId?} | null>;
  listTrees(page): Promise<ProviderTreeInfo[]>;
  scrapePersonById(page, id): Promise<ScrapedPersonData>;
  scrapeAncestors(page, rootId, maxGen): AsyncGenerator<ScrapedPersonData>;
  getPersonUrl(id): string;
  getPersonEditUrl(id): string;
}
```

**Provider Scrapers:**
- `server/src/services/scrapers/familysearch.scraper.ts`
- `server/src/services/scrapers/ancestry.scraper.ts`
- `server/src/services/scrapers/23andme.scraper.ts`
- `server/src/services/scrapers/wikitree.scraper.ts`
- `server/src/services/scrapers/index.ts` - Registry and factory

### Provider Service
**File:** `server/src/services/provider.service.ts`
- `getAllConfigs()` - Get all provider configurations
- `getConfig(provider)` - Get single provider config
- `saveConfig(config)` - Save provider config
- `toggleProvider(provider, enabled)` - Enable/disable provider
- `checkSession(provider)` - Check browser login status
- `checkAllSessions()` - Check all enabled providers
- `discoverTrees(provider)` - List available trees
- `openLoginPage(provider)` - Open login page in browser

### GEDCOM Service
**File:** `server/src/services/gedcom.service.ts`
- `exportToGedcom(dbId)` - Export database to GEDCOM 5.5.1
- `parseGedcom(content)` - Parse GEDCOM file
- `validateGedcom(content)` - Validate GEDCOM file
- `importGedcom(content, dbName)` - Import GEDCOM to new database
- `personToGedcom()` / `gedcomToPerson()` - Conversion helpers

### Sync Service
**File:** `server/src/services/sync.service.ts`
- `compareAcrossProviders(dbId, personId)` - Compare person across all providers
- `scrapeFromProvider(provider, externalId)` - Scrape single person
- `findMatch(person, targetProvider)` - Find matching person
- `importPerson(provider, externalId, dbId)` - Import from provider
- `pushUpdate(dbId, personId, provider)` - Open edit page on provider
- `syncDatabase(dbId, provider, direction)` - Batch sync with progress

### API Routes

**Provider Routes:** `server/src/routes/provider.routes.ts`

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/providers | List all configs + session status |
| GET | /api/providers/:provider | Get single provider config |
| PUT | /api/providers/:provider | Update config |
| POST | /api/providers/:provider/toggle | Enable/disable |
| POST | /api/providers/:provider/check-session | Check browser login |
| POST | /api/providers/:provider/login | Open login page |
| GET | /api/providers/:provider/trees | List available trees |
| POST | /api/providers/:provider/scrape/:personId | Scrape person |

**GEDCOM Routes:** `server/src/routes/gedcom.routes.ts`

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/gedcom/export/:dbId | Download GEDCOM file |
| POST | /api/gedcom/import | Import GEDCOM |
| POST | /api/gedcom/validate | Validate GEDCOM |
| POST | /api/gedcom/preview | Preview GEDCOM contents |

**Sync Routes:** `server/src/routes/sync.routes.ts`

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/sync/:dbId/:personId/compare | Compare across providers |
| POST | /api/sync/:dbId/:personId/import | Import from provider |
| POST | /api/sync/:dbId/:personId/push | Open edit page |
| POST | /api/sync/:dbId/:personId/find-match | Find matching person |
| GET | /api/sync/database/:dbId/events | SSE for batch sync |
| POST | /api/sync/database/:dbId | Start batch sync |

### Frontend Pages

**ProvidersPage:** `client/src/pages/ProvidersPage.tsx`
- 4 built-in provider cards (not dynamically added)
- Toggle switch for enable/disable
- Session status indicator (green/red)
- "Check Login" button
- "Open Login" button
- Rate limit sliders
- Route: `/providers/scraper`

**GedcomPage:** `client/src/pages/GedcomPage.tsx`
- File upload for import with validation
- Database selector for export
- Preview before import
- Route: `/tools/gedcom`

### Data Files
- Provider config: `data/provider-config.json`
- Scraped data: `data/scrape/{personId}.json`
- Downloaded photos: `data/photos/{personId}.{jpg|png}`

---

## Browser Scrape Options (Phase 10) ✅

### Overview
Added explicit browser scrape options to the genealogy provider system, allowing users to:
- Enable/disable browser-based scraping per provider
- Confirm when they've logged into the browser for a provider
- Track the last login confirmation timestamp

### Changes

**Shared Types:** `shared/src/index.ts`
```typescript
export interface UserProviderConfig {
  // ... existing fields
  browserScrapeEnabled: boolean;  // Whether browser scraping is enabled
  browserLoggedIn: boolean;       // User has confirmed browser login
  browserLastLogin?: string;      // Last confirmation timestamp
}
```

**Provider Service:** `server/src/services/provider.service.ts`
- `toggleBrowserScrape(provider, enabled)` - Enable/disable browser scraping
- `confirmBrowserLogin(provider, loggedIn)` - Confirm/clear browser login status
- Migration: Existing configs automatically get new fields

**API Routes:** `server/src/routes/provider.routes.ts`

| Method | Path | Description |
|--------|------|-------------|
| POST | /api/scrape-providers/:provider/toggle-browser-scrape | Toggle scrape on/off |
| POST | /api/scrape-providers/:provider/confirm-browser-login | Confirm login status |

**Note:** Routes moved from `/api/providers` to `/api/scrape-providers` to avoid conflict with AI toolkit's provider routes.

**Frontend:** `client/src/pages/ProvidersPage.tsx`
- Status badges show "Scrape On/Off" and "Logged In/Not Logged In"
- Expanded settings panel includes:
  - "Enable Browser Scraping" toggle button
  - "Confirm Login" button with last login timestamp
  - Help text explaining the feature

**Client API:** `client/src/services/api.ts`
- `toggleBrowserScrape(provider, enabled)`
- `confirmBrowserLogin(provider, loggedIn)`

---

## Browser Settings Page (Phase 11) ✅

### Overview
Added a dedicated Browser Settings page for managing the CDP (Chrome DevTools Protocol) browser instance used for genealogy provider scraping. Provides centralized control over browser connection, configuration, and provider login status.

### Features
- **CDP Configuration:** Configure CDP port (default 9920), view CDP URL
- **Browser Process Status:** See if browser process is running
- **Playwright Connection:** Connect/disconnect Playwright from CDP
- **Launch Browser:** Start browser process from the UI (runs `.browser/start.sh`)
- **Auto-connect:** Option to auto-connect when server starts
- **Provider Login Status:** Check login status for all genealogy providers
- **Open Pages:** View list of open browser pages

### Backend Changes

**Browser Service:** `server/src/services/browser.service.ts`
- `getConfig()` - Get browser configuration
- `updateConfig(updates)` - Update CDP port, auto-connect settings
- `launchBrowser()` - Launch browser process via start script
- `checkBrowserRunning()` - Check if CDP endpoint is responding
- `BrowserStatus` extended with `cdpPort`, `browserProcessRunning`, `autoConnect`
- Configuration persisted in `data/browser-config.json`

**Browser Routes:** `server/src/routes/browser.routes.ts`

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/browser/config | Get browser configuration |
| PUT | /api/browser/config | Update browser configuration |
| POST | /api/browser/launch | Launch browser process |
| GET | /api/browser/running | Check if browser is running |

### Frontend

**BrowserSettingsPage:** `client/src/pages/BrowserSettingsPage.tsx`
- CDP connection status card with connect/disconnect/launch buttons
- CDP configuration card with port editing and auto-connect toggle
- Provider login status card with check/login buttons per provider
- Open browser pages list

**Route:** `/settings/browser`

**Navigation:** Added "Browser Settings" link with Monitor icon to sidebar

### Data Files
- Browser config: `data/browser-config.json`

---

## DRY Theme System (Phase 12) ✅

### Overview
Comprehensive update to the light/dark theme system to provide a DRY (Don't Repeat Yourself) implementation that allows easily toggling between light and dark modes with consistent styling across all components.

### Theme Architecture

**CSS Variables:** `client/src/index.css`

Core variable categories:
- **Core colors:** `--color-app-bg`, `--color-app-bg-secondary`, `--color-app-card`, `--color-app-border`, `--color-app-hover`
- **Text colors:** `--color-app-text`, `--color-app-text-secondary`, `--color-app-text-muted`, `--color-app-text-subtle`
- **Input colors:** `--color-app-input-bg`, `--color-app-input-border`, `--color-app-placeholder`
- **Accent colors:** `--color-app-accent`, `--color-app-accent-hover`, `--color-app-accent-subtle`
- **Status colors:** `--color-app-success`, `--color-app-warning`, `--color-app-error` (with `-subtle` variants)
- **Gender colors:** `--color-male`, `--color-female` (with `-subtle` variants)
- **Overlay:** `--color-app-overlay`

**Tailwind Config:** `client/tailwind.config.js`

All CSS variables exposed as Tailwind utilities:
- `text-app-text`, `text-app-text-secondary`, `text-app-text-muted`, `text-app-text-subtle`
- `bg-app-bg`, `bg-app-bg-secondary`, `bg-app-card`, `bg-app-hover`
- `border-app-border`, `border-app-input-border`
- `text-app-accent`, `bg-app-accent`, `hover:bg-app-accent-hover`
- `text-app-male`, `text-app-female`, `bg-app-male-subtle`, `bg-app-female-subtle`
- And more...

### Theme Toggle

**ThemeContext:** `client/src/context/ThemeContext.tsx`
- Manages `theme` state ('light' | 'dark')
- Toggles `.dark` class on `document.documentElement`
- Persists preference to localStorage
- Detects system preference on initial load

**Sidebar Integration:** Theme toggle button in sidebar footer with Sun/Moon icons

### Migration Summary

All components updated to use semantic color variables instead of hardcoded colors:
- `text-white` → `text-app-text`
- `text-neutral-300` → `text-app-text-secondary`
- `text-neutral-400` → `text-app-text-muted`
- `text-neutral-500` → `text-app-text-subtle`
- `bg-neutral-700` → `bg-app-bg-secondary`
- `hover:bg-neutral-700` → `hover:bg-app-hover`
- `bg-blue-500/20 text-blue-400` → `bg-app-male-subtle text-app-male`
- `bg-pink-500/20 text-pink-400` → `bg-app-female-subtle text-app-female`
- `placeholder-neutral-500` → `placeholder-app-placeholder`
- `bg-black/50` → `bg-app-overlay`

### Files Updated
- All components in `client/src/components/`
- All pages in `client/src/pages/`
- `client/src/index.css`
- `client/tailwind.config.js`

### Benefits
1. **DRY:** Color values defined in one place (CSS variables)
2. **Easy theme switching:** Toggle `.dark` class to switch themes
3. **Consistent:** All components use the same color palette
4. **Customizable:** Easy to adjust colors by changing variables
5. **Light mode friendly:** Proper contrast and colors for both themes

---

## CDP Browser Integration for Indexer (Phase 13) ✅

### Overview
Integrated the indexer with the CDP browser session, allowing users to index FamilySearch family trees using their logged-in browser session instead of manually providing authentication tokens. The indexer now spawns the CLI script with the session token extracted from the browser.

### Features
- **Browser Status Panel:** IndexerPage shows browser process, CDP connection, and FamilySearch login status
- **Action Buttons:** Launch browser, connect, and open FamilySearch login
- **Token Extraction:** Extracts FamilySearch session token from browser cookies
- **CLI Spawning:** Spawns existing CLI indexer with `FS_ACCESS_TOKEN` environment variable
- **Real-time Output:** CLI stdout forwarded to browser via SSE for live progress display
- **Progress Parsing:** Parses CLI output for generation count, new/cached/refreshed counts

### Backend Changes

**Browser Service:** `server/src/services/browser.service.ts`
- `getFamilySearchToken()` - Extract auth token from browser cookies
- Checks `fssessionid`, `FS_AUTH_TOKEN`, `Authorization` cookies

**Browser Routes:** `server/src/routes/browser.routes.ts`
- `GET /api/browser/token` - Get FamilySearch token from browser session

**Indexer Service:** `server/src/services/indexer.service.ts`
Complete rewrite to:
- Connect to browser via `browserService.connect()`
- Extract token via `browserService.getFamilySearchToken()`
- Spawn CLI: `node index.js PERSON_ID --max=N --cache=MODE`
- Pass token via `FS_ACCESS_TOKEN` environment variable
- Parse stdout for progress (icons ✅💾🔄, generation numbers 000/001/002)
- Broadcast `output` SSE events for each CLI line
- Broadcast `progress` SSE events with counts
- Handle SIGINT for graceful stop

### Frontend Changes

**IndexerPage:** `client/src/components/indexer/IndexerPage.tsx`
Complete rewrite with:
- Two-column layout (controls left, output right)
- Browser status panel with indicators and action buttons
- Indexer status panel with progress counters
- Start form with Root ID, Max Generations, Cache Mode, Oldest Year
- Output console (monospace font, auto-scroll, 500 line buffer)
- SSE event listeners for `output`, `progress`, `started`, `completed`, `stopped`, `error`
- Disable indexing until browser connected AND logged in

### SSE Events

| Event | Data | Description |
|-------|------|-------------|
| started | jobId, rootId, options | Indexing started |
| output | jobId, line | CLI output line |
| progress | jobId, progress | Progress update (new, cached, generations) |
| completed | jobId, progress, message | Indexing finished |
| stopped | jobId, progress | User stopped indexing |
| error | jobId, message | Error occurred |

### CLI Integration

The indexer spawns the existing CLI script:
```bash
FS_ACCESS_TOKEN=<token> node index.js PERSON_ID [--max=N] [--cache=MODE] [--oldest=YEAR] [--ignore=ID1,ID2]
```

CLI output format:
```
💾 000 KWCJ-RN4 (KWCG-VGR+KWCG-VG1) 1903-1989 Almon Giles Clegg, Location
✅ 001 KWCG-VGR (KWJ4-C4J+KWJ4-C4X) 1870-1935 George Almon Clegg, Location
```

Icons:
- ✅ New (fetched from API)
- 💾 Cached (loaded from disk)
- 🔄 Refreshed (updated from API)

---

## Future Work

- Add more provider scrapers (FindAGrave, Heritage, Geni)
- Improve 23AndMe scraper (currently limited due to canvas-based UI)
- Add batch photo download functionality
- Implement provider-specific search APIs where available
- Add conflict resolution UI for sync differences
