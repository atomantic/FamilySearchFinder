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

## Future Work (Phase 8)

Platform scrapers to be added:
- `server/src/services/scrapers/base.scraper.ts` - Interface
- `server/src/services/scrapers/findagrave.scraper.ts`
- `server/src/services/scrapers/heritage.scraper.ts`
- `server/src/services/scrapers/ancestry.scraper.ts`
