import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { MapPin, Briefcase, Users, ExternalLink, GitBranch, Loader2, Camera, User, Link2, BookOpen, Calendar, Heart, Database, Unlink } from 'lucide-react';
import toast from 'react-hot-toast';
import type { PersonWithId, PathResult, DatabaseInfo, PersonAugmentation, GenealogyProviderRegistry, ProviderPersonMapping } from '@fsf/shared';
import { api, ScrapedPersonData } from '../../services/api';
import { FavoriteButton } from '../favorites/FavoriteButton';

interface CachedLineage {
  path: PathResult;
  timestamp: number;
}

function getLineageCacheKey(dbId: string, personId: string): string {
  return `fsf-lineage-${dbId}-${personId}`;
}

function getCachedLineage(dbId: string, personId: string): PathResult | null {
  const key = getLineageCacheKey(dbId, personId);
  const cached = localStorage.getItem(key);
  if (!cached) return null;

  const data: CachedLineage = JSON.parse(cached);
  // Cache for 24 hours
  if (Date.now() - data.timestamp > 24 * 60 * 60 * 1000) {
    localStorage.removeItem(key);
    return null;
  }
  return data.path;
}

function setCachedLineage(dbId: string, personId: string, path: PathResult): void {
  const key = getLineageCacheKey(dbId, personId);
  const data: CachedLineage = { path, timestamp: Date.now() };
  localStorage.setItem(key, JSON.stringify(data));
}

function getRelationshipLabel(generations: number): string {
  if (generations === 0) return 'Self';
  if (generations === 1) return 'Parent';
  if (generations === 2) return 'Grandparent';
  if (generations === 3) return 'Great-Grandparent';

  // 4+ generations: 2nd great, 3rd great, etc.
  const greats = generations - 2;
  const ordinal = getOrdinal(greats);
  return `${ordinal} Great-Grandparent`;
}

function getOrdinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

// Platform display config
const platformConfig: Record<string, { label: string; color: string }> = {
  familysearch: { label: 'FamilySearch', color: 'bg-green-600/20 text-green-400' },
  wikipedia: { label: 'Wikipedia', color: 'bg-blue-600/20 text-blue-400' },
  findagrave: { label: 'Find A Grave', color: 'bg-gray-600/20 text-gray-400' },
  heritage: { label: 'Heritage', color: 'bg-amber-600/20 text-amber-400' },
  ancestry: { label: 'Ancestry', color: 'bg-emerald-600/20 text-emerald-400' },
  geni: { label: 'Geni', color: 'bg-cyan-600/20 text-cyan-400' },
  wikitree: { label: 'WikiTree', color: 'bg-purple-600/20 text-purple-400' },
};

export function PersonDetail() {
  const { dbId, personId } = useParams<{ dbId: string; personId: string }>();
  const [person, setPerson] = useState<PersonWithId | null>(null);
  const [parentData, setParentData] = useState<Record<string, PersonWithId>>({});
  const [spouseData, setSpouseData] = useState<Record<string, PersonWithId>>({});
  const [database, setDatabase] = useState<DatabaseInfo | null>(null);
  const [lineage, setLineage] = useState<PathResult | null>(null);
  const [scrapedData, setScrapedData] = useState<ScrapedPersonData | null>(null);
  const [augmentation, setAugmentation] = useState<PersonAugmentation | null>(null);
  const [hasPhoto, setHasPhoto] = useState(false);
  const [hasWikiPhoto, setHasWikiPhoto] = useState(false);
  const [loading, setLoading] = useState(true);
  const [lineageLoading, setLineageLoading] = useState(false);
  const [scrapeLoading, setScrapeLoading] = useState(false);
  const [wikiLoading, setWikiLoading] = useState(false);
  const [wikiUrl, setWikiUrl] = useState('');
  const [showWikiInput, setShowWikiInput] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Provider linking state
  const [providers, setProviders] = useState<GenealogyProviderRegistry | null>(null);
  const [providerMappings, setProviderMappings] = useState<ProviderPersonMapping[]>([]);
  const [showProviderLinkInput, setShowProviderLinkInput] = useState(false);
  const [selectedProviderId, setSelectedProviderId] = useState('');
  const [providerUrl, setProviderUrl] = useState('');
  const [providerExternalId, setProviderExternalId] = useState('');
  const [providerLinkLoading, setProviderLinkLoading] = useState(false);
  const [unlinkingProviderId, setUnlinkingProviderId] = useState<string | null>(null);

  useEffect(() => {
    if (!dbId || !personId) return;

    setLoading(true);
    setLineage(null);
    setScrapedData(null);
    setAugmentation(null);
    setHasPhoto(false);
    setHasWikiPhoto(false);
    setParentData({});
    setSpouseData({});
    setWikiUrl('');
    setShowWikiInput(false);
    setProviderMappings([]);
    setShowProviderLinkInput(false);
    setSelectedProviderId('');
    setProviderUrl('');
    setProviderExternalId('');

    // Load genealogy providers (separate from main data)
    api.listGenealogyProviders().then(setProviders).catch(() => null);

    Promise.all([
      api.getPerson(dbId, personId),
      api.getDatabase(dbId),
      api.getScrapedData(personId).catch(() => null),
      api.hasPhoto(personId).catch(() => ({ exists: false })),
      api.getAugmentation(personId).catch(() => null),
      api.hasWikiPhoto(personId).catch(() => ({ exists: false })),
      api.getPersonProviderLinks(personId).catch(() => [])
    ])
      .then(async ([personData, dbData, scraped, photoCheck, augment, wikiPhotoCheck, providerLinks]) => {
        setPerson(personData);
        setDatabase(dbData);
        setProviderMappings(providerLinks || []);
        setScrapedData(scraped);
        setHasPhoto(photoCheck?.exists ?? false);
        setAugmentation(augment);
        setHasWikiPhoto(wikiPhotoCheck?.exists ?? false);

        // Fetch parent data for names
        if (personData.parents.length > 0) {
          const parentResults = await Promise.all(
            personData.parents.map((pid: string) => api.getPerson(dbId, pid).catch(() => null))
          );
          const parents: Record<string, PersonWithId> = {};
          parentResults.forEach((p: PersonWithId | null, idx: number) => {
            if (p) parents[personData.parents[idx]] = p;
          });
          setParentData(parents);
        }

        // Fetch spouse data for names
        if (personData.spouses && personData.spouses.length > 0) {
          const spouseResults = await Promise.all(
            personData.spouses.map((sid: string) => api.getPerson(dbId, sid).catch(() => null))
          );
          const spouses: Record<string, PersonWithId> = {};
          spouseResults.forEach((s: PersonWithId | null, idx: number) => {
            if (s && personData.spouses) spouses[personData.spouses[idx]] = s;
          });
          setSpouseData(spouses);
        }

        // Check for cached lineage
        const cached = getCachedLineage(dbId, personId);
        if (cached) {
          setLineage(cached);
        }
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [dbId, personId]);

  const calculateLineage = async () => {
    if (!dbId || !personId || !database?.rootId) return;
    if (database.rootId === personId) return;

    setLineageLoading(true);

    const result = await api.findPath(dbId, personId, database.rootId, 'shortest')
      .catch(() => null);

    if (result) {
      setLineage(result);
      setCachedLineage(dbId, personId, result);
    }

    setLineageLoading(false);
  };

  const handleScrape = async () => {
    if (!personId) return;

    setScrapeLoading(true);

    const data = await api.scrapePerson(personId)
      .catch(err => {
        toast.error(err.message);
        return null;
      });

    if (data) {
      setScrapedData(data);
      setHasPhoto(!!data.photoPath);
      toast.success('Person data scraped successfully');
    }

    setScrapeLoading(false);
  };

  const handleLinkWikipedia = async () => {
    if (!personId || !wikiUrl.trim()) return;

    setWikiLoading(true);

    const data = await api.linkWikipedia(personId, wikiUrl.trim())
      .catch(err => {
        toast.error(err.message);
        return null;
      });

    if (data) {
      setAugmentation(data);
      const wikiPhotoExists = await api.hasWikiPhoto(personId).catch(() => ({ exists: false }));
      setHasWikiPhoto(wikiPhotoExists?.exists ?? false);
      setShowWikiInput(false);
      setWikiUrl('');
      toast.success('Wikipedia linked successfully');
    }

    setWikiLoading(false);
  };

  const handleLinkProvider = async () => {
    if (!personId || !selectedProviderId || !providerUrl.trim()) return;

    setProviderLinkLoading(true);

    const provider = providers?.providers[selectedProviderId];
    if (!provider) {
      toast.error('Provider not found');
      setProviderLinkLoading(false);
      return;
    }

    const data = await api.linkPersonToProvider(personId, {
      providerId: selectedProviderId,
      platform: provider.platform,
      url: providerUrl.trim(),
      externalId: providerExternalId.trim() || undefined,
      confidence: 'medium',
      matchedBy: 'manual'
    }).catch(err => {
      toast.error(err.message);
      return null;
    });

    if (data) {
      setProviderMappings(data.providerMappings || []);
      setShowProviderLinkInput(false);
      setSelectedProviderId('');
      setProviderUrl('');
      setProviderExternalId('');
      toast.success('Provider linked successfully');
    }

    setProviderLinkLoading(false);
  };

  const handleUnlinkProvider = async (providerId: string) => {
    if (!personId) return;

    setUnlinkingProviderId(providerId);

    const data = await api.unlinkPersonFromProvider(personId, providerId).catch(err => {
      toast.error(err.message);
      return null;
    });

    if (data) {
      setProviderMappings(data.providerMappings || []);
      toast.success('Provider unlinked');
    }

    setUnlinkingProviderId(null);
  };

  if (loading) {
    return <div className="text-center py-8 text-neutral-400">Loading person...</div>;
  }

  if (error || !person) {
    return <div className="text-center py-8 text-app-error">Error: {error || 'Person not found'}</div>;
  }

  const isRoot = database?.rootId === personId;
  const generations = lineage ? lineage.path.length - 1 : 0;
  const relationship = isRoot ? 'Root Person (You)' : lineage ? getRelationshipLabel(generations) : null;
  // Prefer Wiki photo over FamilySearch scraped photo
  const photoUrl = hasWikiPhoto
    ? api.getWikiPhotoUrl(personId!)
    : hasPhoto
      ? api.getPhotoUrl(personId!)
      : null;

  // Get primary description from augmentation
  const wikiDescription = augmentation?.descriptions?.find(d => d.source === 'wikipedia')?.text;
  const displayBio = wikiDescription || person.bio;

  // Get Wikipedia platform info
  const wikiPlatform = augmentation?.platforms?.find(p => p.platform === 'wikipedia');

  return (
    <div className="h-full flex flex-col">
      {/* Header with photo and relationship badge */}
      <div className="mb-6 flex gap-6">
        {/* Profile Photo */}
        <div className="flex-shrink-0">
          {photoUrl ? (
            <img
              src={photoUrl}
              alt={person.name}
              className="w-32 h-32 rounded-lg object-cover border border-app-border"
            />
          ) : (
            <div className="w-32 h-32 rounded-lg bg-app-card border border-app-border flex items-center justify-center">
              <User size={48} className="text-neutral-600" />
            </div>
          )}
          <button
            onClick={handleScrape}
            disabled={scrapeLoading}
            className="mt-2 w-full px-3 py-1.5 bg-app-card border border-app-border rounded text-sm text-neutral-300 hover:bg-app-border transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {scrapeLoading ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                Scraping...
              </>
            ) : (
              <>
                <Camera size={14} />
                {hasPhoto ? 'Rescrape' : 'Scrape Photo'}
              </>
            )}
          </button>
        </div>

        {/* Name and badges */}
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2 flex-wrap">
            {isRoot && (
              <span className="px-3 py-1 bg-app-success/20 text-app-success rounded-full text-sm font-medium">
                Root Person (You)
              </span>
            )}
            {lineage && !isRoot && (
              <span className="px-3 py-1 bg-app-accent/20 text-app-accent rounded-full text-sm font-medium">
                {relationship} ({generations} generation{generations !== 1 ? 's' : ''})
              </span>
            )}
            {!lineage && !isRoot && (
              <button
                onClick={calculateLineage}
                disabled={lineageLoading}
                className="px-3 py-1 bg-app-accent/20 text-app-accent rounded-full text-sm font-medium hover:bg-app-accent/30 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {lineageLoading ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    Calculating...
                  </>
                ) : (
                  <>
                    <GitBranch size={14} />
                    Calculate Relationship
                  </>
                )}
              </button>
            )}
            {/* Gender badge */}
            {person.gender && person.gender !== 'unknown' && (
              <span className={`px-2 py-0.5 rounded text-xs ${
                person.gender === 'male' ? 'bg-blue-500/20 text-blue-400' : 'bg-pink-500/20 text-pink-400'
              }`}>
                {person.gender === 'male' ? 'Male' : 'Female'}
              </span>
            )}
            {/* Favorite button */}
            <FavoriteButton personId={personId!} personName={person.name} />
            <Link
              to={`/tree/${dbId}/${personId}`}
              className="text-neutral-400 hover:text-app-accent flex items-center gap-1 text-sm"
            >
              <GitBranch size={14} />
              View in tree
            </Link>
          </div>
          <h1 className="text-3xl font-bold text-white">{person.name}</h1>

          {/* Alternate names */}
          {person.alternateNames && person.alternateNames.length > 0 && (
            <p className="text-sm text-neutral-500 mt-1">
              Also known as: {person.alternateNames.join(', ')}
            </p>
          )}

          <p className="text-xl text-neutral-400 mt-1">{person.lifespan}</p>

          {/* Scraped data notice */}
          {scrapedData && (
            <p className="text-xs text-neutral-500 mt-2">
              Last scraped: {new Date(scrapedData.scrapedAt).toLocaleDateString()}
            </p>
          )}
        </div>
      </div>

      {/* Main content - two column layout */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column - Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Vital events row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Birth */}
            {(person.birth?.date || person.birth?.place) && (
              <div className="bg-app-card rounded-lg border border-app-border p-4">
                <h3 className="text-sm font-semibold text-neutral-300 mb-2 flex items-center gap-2">
                  <Calendar size={16} className="text-green-400" />
                  Birth
                </h3>
                {person.birth.date && (
                  <p className="text-white">{person.birth.date}</p>
                )}
                {person.birth.place && (
                  <p className="text-neutral-400 text-sm flex items-center gap-1">
                    <MapPin size={12} />
                    {person.birth.place}
                  </p>
                )}
              </div>
            )}

            {/* Death */}
            {(person.death?.date || person.death?.place) && (
              <div className="bg-app-card rounded-lg border border-app-border p-4">
                <h3 className="text-sm font-semibold text-neutral-300 mb-2 flex items-center gap-2">
                  <Calendar size={16} className="text-red-400" />
                  Death
                </h3>
                {person.death.date && (
                  <p className="text-white">{person.death.date}</p>
                )}
                {person.death.place && (
                  <p className="text-neutral-400 text-sm flex items-center gap-1">
                    <MapPin size={12} />
                    {person.death.place}
                  </p>
                )}
              </div>
            )}

            {/* Burial */}
            {(person.burial?.date || person.burial?.place) && (
              <div className="bg-app-card rounded-lg border border-app-border p-4">
                <h3 className="text-sm font-semibold text-neutral-300 mb-2 flex items-center gap-2">
                  <MapPin size={16} className="text-neutral-400" />
                  Burial
                </h3>
                {person.burial.date && (
                  <p className="text-white">{person.burial.date}</p>
                )}
                {person.burial.place && (
                  <p className="text-neutral-400 text-sm">{person.burial.place}</p>
                )}
              </div>
            )}
          </div>

          {/* Occupations */}
          {person.occupations && person.occupations.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {person.occupations.map((occ, idx) => (
                <div key={idx} className="flex items-center gap-2 px-4 py-2 bg-app-card rounded-lg border border-app-border">
                  <Briefcase size={18} className="text-app-warning" />
                  <span className="text-neutral-300">{occ}</span>
                </div>
              ))}
            </div>
          )}

          {/* Legacy location/occupation display for old data */}
          {!person.birth?.place && !person.death?.place && person.location && (
            <div className="flex flex-wrap gap-4">
              <div className="flex items-center gap-2 px-4 py-2 bg-app-card rounded-lg border border-app-border">
                <MapPin size={18} className="text-app-accent" />
                <span className="text-neutral-300">{person.location}</span>
              </div>
            </div>
          )}
          {!person.occupations?.length && person.occupation && (
            <div className="flex items-center gap-2 px-4 py-2 bg-app-card rounded-lg border border-app-border w-fit">
              <Briefcase size={18} className="text-app-warning" />
              <span className="text-neutral-300">{person.occupation}</span>
            </div>
          )}

          {/* Biography / Wikipedia Description */}
          {displayBio && (
            <div className="bg-app-card rounded-lg border border-app-border p-5">
              <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                {wikiDescription ? (
                  <>
                    <BookOpen size={18} className="text-blue-400" />
                    Wikipedia
                  </>
                ) : (
                  'Biography'
                )}
              </h2>
              <p className="text-neutral-400 whitespace-pre-wrap leading-relaxed">{displayBio}</p>
              {wikiPlatform?.url && (
                <a
                  href={wikiPlatform.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 mt-3 text-sm text-blue-400 hover:text-blue-300"
                >
                  <ExternalLink size={14} />
                  View on Wikipedia
                </a>
              )}
            </div>
          )}

          {/* Original FamilySearch bio if we have Wikipedia description */}
          {wikiDescription && person.bio && (
            <div className="bg-app-card rounded-lg border border-app-border p-5">
              <h2 className="text-lg font-semibold text-white mb-3">FamilySearch Biography</h2>
              <p className="text-neutral-400 whitespace-pre-wrap leading-relaxed">{person.bio}</p>
            </div>
          )}

          {/* Platform badges */}
          {augmentation?.platforms && augmentation.platforms.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {augmentation.platforms.map((platform, idx) => {
                const config = platformConfig[platform.platform] || { label: platform.platform, color: 'bg-neutral-600/20 text-neutral-400' };
                return (
                  <a
                    key={idx}
                    href={platform.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm ${config.color} hover:opacity-80 transition-opacity`}
                  >
                    <Link2 size={14} />
                    {config.label}
                    {platform.verified && <span className="text-green-400">✓</span>}
                  </a>
                );
              })}
            </div>
          )}

          {/* External links and Wikipedia link */}
          <div className="flex flex-wrap gap-3">
            <a
              href={`https://www.familysearch.org/tree/person/details/${personId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 bg-app-border text-neutral-300 rounded-lg hover:bg-neutral-700 transition-colors"
            >
              <ExternalLink size={16} />
              View on FamilySearch
            </a>

            {/* Link Wikipedia button */}
            {!showWikiInput && !wikiPlatform && (
              <button
                onClick={() => setShowWikiInput(true)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600/20 text-blue-400 border border-blue-600/30 rounded-lg hover:bg-blue-600/30 transition-colors"
              >
                <Link2 size={16} />
                Link Wikipedia
              </button>
            )}

            {/* Wikipedia URL already linked */}
            {wikiPlatform && (
              <a
                href={wikiPlatform.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600/20 text-blue-400 border border-blue-600/30 rounded-lg hover:bg-blue-600/30 transition-colors"
              >
                <BookOpen size={16} />
                Wikipedia Linked
              </a>
            )}
          </div>

          {/* Wikipedia URL input */}
          {showWikiInput && (
            <div className="bg-app-card rounded-lg border border-app-border p-4">
              <h3 className="text-sm font-semibold text-neutral-300 mb-3">Link Wikipedia Article</h3>
              <div className="flex gap-2">
                <input
                  type="url"
                  value={wikiUrl}
                  onChange={e => setWikiUrl(e.target.value)}
                  placeholder="https://en.wikipedia.org/wiki/..."
                  className="flex-1 px-3 py-2 bg-app-bg border border-app-border rounded text-white placeholder-neutral-500 focus:border-app-accent focus:outline-none"
                />
                <button
                  onClick={handleLinkWikipedia}
                  disabled={wikiLoading || !wikiUrl.trim()}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-500 transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {wikiLoading ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Linking...
                    </>
                  ) : (
                    'Link'
                  )}
                </button>
                <button
                  onClick={() => { setShowWikiInput(false); setWikiUrl(''); }}
                  className="px-4 py-2 bg-app-border text-neutral-300 rounded hover:bg-neutral-700 transition-colors"
                >
                  Cancel
                </button>
              </div>
              <p className="text-xs text-neutral-500 mt-2">
                Paste a Wikipedia URL to import photo and description for this person.
              </p>
            </div>
          )}

          {/* Provider Mappings Section */}
          {providers && Object.keys(providers.providers).length > 0 && (
            <div className="bg-app-card rounded-lg border border-app-border p-5">
              <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                <Database size={18} className="text-app-accent" />
                Provider Links
              </h2>

              {/* Existing provider mappings */}
              {providerMappings.length > 0 && (
                <div className="space-y-2 mb-4">
                  {providerMappings.map(mapping => {
                    const provider = providers.providers[mapping.providerId];
                    const isUnlinking = unlinkingProviderId === mapping.providerId;
                    return (
                      <div
                        key={mapping.providerId}
                        className="flex items-center justify-between px-3 py-2 bg-app-bg rounded"
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-sm text-neutral-300">
                            {provider?.name || mapping.providerId}
                          </span>
                          <span className="text-xs px-2 py-0.5 bg-neutral-700 text-neutral-400 rounded">
                            {mapping.platform}
                          </span>
                          {mapping.confidence && (
                            <span className={`text-xs px-2 py-0.5 rounded ${
                              mapping.confidence === 'high' ? 'bg-green-600/20 text-green-400' :
                              mapping.confidence === 'medium' ? 'bg-yellow-600/20 text-yellow-400' :
                              'bg-red-600/20 text-red-400'
                            }`}>
                              {mapping.confidence}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <a
                            href={mapping.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-app-accent hover:text-app-accent/80 text-sm"
                          >
                            <ExternalLink size={14} />
                          </a>
                          <button
                            onClick={() => handleUnlinkProvider(mapping.providerId)}
                            disabled={isUnlinking}
                            className="text-red-400 hover:text-red-300 disabled:opacity-50"
                          >
                            {isUnlinking ? (
                              <Loader2 size={14} className="animate-spin" />
                            ) : (
                              <Unlink size={14} />
                            )}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Link to Provider button */}
              {!showProviderLinkInput && (
                <button
                  onClick={() => setShowProviderLinkInput(true)}
                  className="inline-flex items-center gap-2 px-3 py-1.5 bg-app-border text-neutral-300 rounded hover:bg-neutral-700 transition-colors text-sm"
                >
                  <Link2 size={14} />
                  Link to Provider
                </button>
              )}

              {/* Provider link input form */}
              {showProviderLinkInput && (
                <div className="space-y-3 mt-3 pt-3 border-t border-app-border">
                  <div>
                    <label className="block text-xs font-medium text-neutral-400 mb-1">Provider</label>
                    <select
                      value={selectedProviderId}
                      onChange={e => setSelectedProviderId(e.target.value)}
                      className="w-full px-3 py-2 bg-app-bg border border-app-border rounded text-white text-sm focus:border-app-accent focus:outline-none"
                    >
                      <option value="">Select a provider...</option>
                      {Object.values(providers.providers)
                        .filter(p => !providerMappings.some(m => m.providerId === p.id))
                        .map(p => (
                          <option key={p.id} value={p.id}>{p.name} ({p.platform})</option>
                        ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-neutral-400 mb-1">URL on Provider</label>
                    <input
                      type="url"
                      value={providerUrl}
                      onChange={e => setProviderUrl(e.target.value)}
                      placeholder="https://..."
                      className="w-full px-3 py-2 bg-app-bg border border-app-border rounded text-white placeholder-neutral-500 text-sm focus:border-app-accent focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-neutral-400 mb-1">External ID (optional)</label>
                    <input
                      type="text"
                      value={providerExternalId}
                      onChange={e => setProviderExternalId(e.target.value)}
                      placeholder="Person ID on provider platform"
                      className="w-full px-3 py-2 bg-app-bg border border-app-border rounded text-white placeholder-neutral-500 text-sm focus:border-app-accent focus:outline-none"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleLinkProvider}
                      disabled={providerLinkLoading || !selectedProviderId || !providerUrl.trim()}
                      className="px-3 py-1.5 bg-app-accent text-white rounded hover:bg-app-accent/80 transition-colors disabled:opacity-50 text-sm flex items-center gap-2"
                    >
                      {providerLinkLoading ? (
                        <>
                          <Loader2 size={14} className="animate-spin" />
                          Linking...
                        </>
                      ) : (
                        'Link'
                      )}
                    </button>
                    <button
                      onClick={() => {
                        setShowProviderLinkInput(false);
                        setSelectedProviderId('');
                        setProviderUrl('');
                        setProviderExternalId('');
                      }}
                      className="px-3 py-1.5 bg-app-border text-neutral-300 rounded hover:bg-neutral-700 transition-colors text-sm"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right column - Family connections */}
        <div className="space-y-4">
          {/* Parents */}
          <div className="bg-app-card rounded-lg border border-app-border p-4">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-neutral-300 mb-3">
              <Users size={16} className="text-app-accent" />
              Parents
            </h2>
            {person.parents.length > 0 ? (
              <div className="space-y-2">
                {person.parents.map((parentId, idx) => {
                  const parent = parentData[parentId];
                  return (
                    <Link
                      key={parentId}
                      to={`/person/${dbId}/${parentId}`}
                      className="flex items-center justify-between px-3 py-2 bg-app-bg rounded hover:bg-app-border transition-colors text-sm group"
                    >
                      <div className="flex flex-col">
                        <span className="text-white">{parent?.name || parentId}</span>
                        {parent && <span className="text-neutral-500 text-xs">{parent.lifespan}</span>}
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded flex-shrink-0 ${
                        idx === 0
                          ? 'bg-blue-500/20 text-blue-400'
                          : 'bg-pink-500/20 text-pink-400'
                      }`}>
                        {idx === 0 ? 'Father' : 'Mother'}
                      </span>
                    </Link>
                  );
                })}
              </div>
            ) : (
              <p className="text-neutral-500 text-sm">No parents in database</p>
            )}
          </div>

          {/* Spouses */}
          {person.spouses && person.spouses.length > 0 && (
            <div className="bg-app-card rounded-lg border border-app-border p-4">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-neutral-300 mb-3">
                <Heart size={16} className="text-pink-400" />
                Spouse{person.spouses.length > 1 ? 's' : ''}
              </h2>
              <div className="space-y-2">
                {person.spouses.map(spouseId => {
                  const spouse = spouseData[spouseId];
                  return (
                    <Link
                      key={spouseId}
                      to={`/person/${dbId}/${spouseId}`}
                      className="flex items-center justify-between px-3 py-2 bg-app-bg rounded hover:bg-app-border transition-colors text-sm group"
                    >
                      <div className="flex flex-col">
                        <span className="text-white">{spouse?.name || spouseId}</span>
                        {spouse && <span className="text-neutral-500 text-xs">{spouse.lifespan}</span>}
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}

          {/* Children */}
          {person.children.length > 0 && (
            <div className="bg-app-card rounded-lg border border-app-border p-4">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-neutral-300 mb-3">
                <Users size={16} className="text-app-success" />
                Children ({person.children.length})
              </h2>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {person.children.map(childId => (
                  <Link
                    key={childId}
                    to={`/person/${dbId}/${childId}`}
                    className="block px-3 py-2 bg-app-bg rounded hover:bg-app-border transition-colors text-app-success text-sm"
                  >
                    {childId}
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Lineage path */}
          {lineage && lineage.path.length > 1 && (
            <div className="bg-app-card rounded-lg border border-app-border p-4">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-neutral-300 mb-3">
                <GitBranch size={16} className="text-app-warning" />
                Lineage Path ({lineage.path.length} people)
              </h2>
              <div className="space-y-1">
                {lineage.path.map((ancestor, idx) => (
                  <Link
                    key={ancestor.id}
                    to={`/person/${dbId}/${ancestor.id}`}
                    className={`block px-3 py-1.5 rounded text-sm transition-colors ${
                      ancestor.id === personId
                        ? 'bg-app-accent/20 text-app-accent font-medium'
                        : 'text-neutral-400 hover:bg-app-border hover:text-white'
                    }`}
                  >
                    <span className="text-neutral-500 mr-2">{idx}.</span>
                    {ancestor.name}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
