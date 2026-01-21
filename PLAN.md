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

## Future Work (Phase 6)

Platform scrapers to be added:
- `server/src/services/scrapers/base.scraper.ts` - Interface
- `server/src/services/scrapers/findagrave.scraper.ts`
- `server/src/services/scrapers/heritage.scraper.ts`
- `server/src/services/scrapers/ancestry.scraper.ts`
