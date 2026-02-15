import { useEffect, useRef, useState, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import * as d3 from 'd3';
import { Network, Star, User, Loader2, ArrowUp, ArrowDown } from 'lucide-react';
import type { SparseTreeResult, SparseTreeNode, DatabaseInfo } from '@fsf/shared';
import { api } from '../../services/api';

// Person card component for the vertical tree
interface AncestryPersonCardProps {
  node: SparseTreeNode;
  isRoot?: boolean;
  onClick: (node: SparseTreeNode) => void;
}

function AncestryPersonCard({ node, isRoot, onClick }: AncestryPersonCardProps) {
  const genderBg = node.gender === 'male'
    ? 'bg-blue-900/30'
    : node.gender === 'female'
      ? 'bg-pink-900/30'
      : 'bg-gray-800/50';

  const placeholderBg = node.gender === 'male'
    ? 'bg-blue-800'
    : node.gender === 'female'
      ? 'bg-pink-800'
      : 'bg-gray-700';

  return (
    <div
      className={`
        relative flex flex-col items-center cursor-pointer transition-all duration-200
        hover:scale-105 group
        ${isRoot ? 'z-10' : ''}
      `}
      onClick={() => onClick(node)}
    >
      {/* Card container */}
      <div
        className={`
          w-28 rounded-lg overflow-hidden shadow-lg
          ${genderBg}
          ${isRoot ? 'ring-2 ring-app-accent' : 'border border-app-border'}
          ${node.isFavorite ? 'ring-2 ring-yellow-500' : ''}
        `}
      >
        {/* Photo */}
        <div className="relative w-full aspect-square overflow-hidden">
          {node.photoUrl ? (
            <img
              src={node.photoUrl}
              alt={node.name}
              className="w-full h-full object-cover"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          ) : (
            <div className={`w-full h-full ${placeholderBg} flex items-center justify-center`}>
              <User size={40} className="text-white/60" />
            </div>
          )}

          {/* Favorite indicator */}
          {node.isFavorite && (
            <div className="absolute top-1 right-1 w-5 h-5 bg-green-500 rounded-full flex items-center justify-center border-2 border-white">
              <span className="text-white text-xs">✓</span>
            </div>
          )}
        </div>

        {/* Name and lifespan */}
        <div className="p-2 text-center bg-black/40">
          <div className="font-semibold text-white text-xs leading-tight truncate" title={node.name}>
            {node.name}
          </div>
          <div className="text-gray-300 text-[10px] mt-0.5">
            {node.lifespan}
          </div>
        </div>
      </div>
    </div>
  );
}

// Type for generation row data
interface GenerationRow {
  generation: number;
  label: string;
  paternalNodes: SparseTreeNode[];  // Father's side (left)
  maternalNodes: SparseTreeNode[];  // Mother's side (right)
  centerNodes: SparseTreeNode[];    // Root or nodes without side designation
}

export function SparseTreePage() {
  const { dbId } = useParams<{ dbId: string }>();
  const [treeData, setTreeData] = useState<SparseTreeResult | null>(null);
  const [database, setDatabase] = useState<DatabaseInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<SparseTreeNode | null>(null);
  const [ancestorsAbove, setAncestorsAbove] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  // Load tree data and database info
  useEffect(() => {
    if (!dbId) return;

    setLoading(true);
    setError(null);

    Promise.all([
      api.getSparseTree(dbId),
      api.getDatabase(dbId),
    ])
      .then(([tree, db]) => {
        setTreeData(tree);
        setDatabase(db);
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [dbId]);

  // Process tree data into generation rows with paternal/maternal separation
  const generationRows = useMemo((): GenerationRow[] => {
    if (!treeData) return [];

    const rows: Map<number, GenerationRow> = new Map();
    const rootName = treeData.root.name.split(' ')[0]; // First name for labels

    // Recursively process nodes, tracking which side they belong to
    const processNode = (node: SparseTreeNode) => {
      const gen = node.generationFromRoot;

      if (!rows.has(gen)) {
        let label = '';
        if (gen === 0) label = rootName;
        else if (gen === 1) label = `${rootName}'s parents`;
        else if (gen === 2) label = `${rootName}'s grandparents`;
        else if (gen === 3) label = `${rootName}'s great-grandparents`;
        else label = `${gen - 2}x great-grandparents`;

        rows.set(gen, {
          generation: gen,
          label,
          paternalNodes: [],
          maternalNodes: [],
          centerNodes: [],
        });
      }

      const row = rows.get(gen)!;

      // Add node to appropriate side array
      const nodeExists = (arr: SparseTreeNode[]) => arr.some(n => n.id === node.id);

      if (node.side === 'paternal') {
        if (!nodeExists(row.paternalNodes)) {
          row.paternalNodes.push(node);
        }
      } else if (node.side === 'maternal') {
        if (!nodeExists(row.maternalNodes)) {
          row.maternalNodes.push(node);
        }
      } else {
        if (!nodeExists(row.centerNodes)) {
          row.centerNodes.push(node);
        }
      }

      // Process children (which are ancestors in this tree structure)
      if (node.children) {
        for (const child of node.children) {
          processNode(child);
        }
      }
    };

    processNode(treeData.root);

    // Sort by generation based on orientation preference
    return Array.from(rows.values()).sort((a, b) =>
      ancestorsAbove ? b.generation - a.generation : a.generation - b.generation
    );
  }, [treeData, ancestorsAbove]);

  // Setup D3 zoom behavior
  useEffect(() => {
    if (!containerRef.current || !contentRef.current) return;

    const container = d3.select(containerRef.current);
    const content = d3.select(contentRef.current);

    const zoom = d3.zoom<HTMLDivElement, unknown>()
      .scaleExtent([0.3, 2])
      .on('zoom', (event) => {
        content.style('transform', `translate(${event.transform.x}px, ${event.transform.y}px) scale(${event.transform.k})`);
        content.style('transform-origin', '0 0');
      });

    container.call(zoom);

    // Set initial transform to center
    const containerRect = containerRef.current.getBoundingClientRect();
    const contentRect = contentRef.current.getBoundingClientRect();
    const initialX = (containerRect.width - contentRect.width) / 2;
    const initialY = 40;

    container.call(zoom.transform, d3.zoomIdentity.translate(initialX, initialY).scale(0.8));

    return () => {
      container.on('.zoom', null);
    };
  }, [generationRows]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 size={32} className="animate-spin text-app-accent" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-16">
        <p className="text-app-error mb-4">Error: {error}</p>
        <Link
          to="/favorites"
          className="text-app-accent hover:underline"
        >
          Back to Favorites
        </Link>
      </div>
    );
  }

  if (!treeData || treeData.totalFavorites === 0) {
    return (
      <div className="text-center py-16">
        <Network size={48} className="mx-auto text-app-text-subtle mb-4" />
        <h3 className="text-lg font-medium text-app-text-muted mb-2">
          No favorites in this database
        </h3>
        <p className="text-app-text-subtle mb-4">
          Mark some ancestors as favorites to see them in a sparse tree
        </p>
        <Link
          to={`/search/${dbId}`}
          className="text-app-accent hover:underline"
        >
          Search the database
        </Link>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Network size={28} className="text-app-accent" />
          <div>
            <h1 className="text-2xl font-bold text-app-text">Sparse Tree</h1>
            <p className="text-sm text-app-text-muted">
              {database?.rootName || dbId} - {treeData.totalFavorites} favorites, {treeData.maxGeneration} generations
            </p>
          </div>
        </div>
        <div className="flex gap-2 items-center">
          {/* Orientation toggle */}
          <button
            onClick={() => setAncestorsAbove(!ancestorsAbove)}
            className="flex items-center gap-2 px-3 py-1.5 bg-app-border text-app-text-secondary rounded hover:bg-app-hover text-sm"
            title={ancestorsAbove ? 'Ancestors above root' : 'Ancestors below root'}
          >
            {ancestorsAbove ? (
              <>
                <ArrowUp size={14} />
                <span>Ancestors Above</span>
              </>
            ) : (
              <>
                <ArrowDown size={14} />
                <span>Ancestors Below</span>
              </>
            )}
          </button>
          <Link
            to="/favorites"
            className="px-3 py-1.5 bg-app-border text-app-text-secondary rounded hover:bg-app-hover text-sm"
          >
            All Favorites
          </Link>
        </div>
      </div>

      {/* Tree visualization */}
      <div className="flex-1 flex gap-4">
        <div
          ref={containerRef}
          className="flex-1 bg-gray-700 rounded-lg border border-app-border overflow-hidden cursor-grab active:cursor-grabbing"
          style={{ minHeight: '600px' }}
        >
          <div ref={contentRef} className="p-8 min-w-[800px]">
            {/* Vertical ancestry tree with paternal/maternal split */}
            <div className="flex flex-col items-center gap-6">
              {generationRows.map((row, rowIndex) => {
                const allNodes = [...row.paternalNodes, ...row.centerNodes, ...row.maternalNodes];
                const hasNodes = allNodes.length > 0;
                const isRootRow = row.generation === 0;

                return (
                  <div key={row.generation} className="flex flex-col items-center w-full">
                    {/* Generation label */}
                    {row.label && row.generation > 0 && (
                      <div className="text-gray-400 text-sm mb-3 italic">
                        {row.label}
                      </div>
                    )}

                    {/* Three-column layout: Paternal | Center | Maternal */}
                    {hasNodes && (
                      <div className="flex items-start justify-center w-full">
                        {/* Paternal side (left) */}
                        <div className="flex-1 flex justify-end gap-4 pr-4">
                          {row.paternalNodes.map((node) => (
                            <div key={node.id} className="flex flex-col items-center">
                              <AncestryPersonCard
                                node={node}
                                onClick={setSelectedNode}
                              />
                              {/* Vertical line down */}
                              {rowIndex < generationRows.length - 1 && (
                                <div className="w-0.5 h-6 bg-gray-500 mt-2" />
                              )}
                            </div>
                          ))}
                        </div>

                        {/* Center column (root person) */}
                        <div className="flex flex-col items-center px-4 min-w-[140px]">
                          {row.centerNodes.map((node) => (
                            <div key={node.id} className="flex flex-col items-center">
                              <AncestryPersonCard
                                node={node}
                                isRoot={isRootRow}
                                onClick={setSelectedNode}
                              />
                              {/* Vertical line down for root */}
                              {isRootRow && rowIndex < generationRows.length - 1 && (
                                <div className="w-0.5 h-6 bg-gray-500 mt-2" />
                              )}
                            </div>
                          ))}
                          {/* Show connecting line if this is not root row but has no center nodes */}
                          {row.centerNodes.length === 0 && !isRootRow && (
                            <div className="w-0.5 h-full bg-transparent" />
                          )}
                        </div>

                        {/* Maternal side (right) */}
                        <div className="flex-1 flex justify-start gap-4 pl-4">
                          {row.maternalNodes.map((node) => (
                            <div key={node.id} className="flex flex-col items-center">
                              <AncestryPersonCard
                                node={node}
                                onClick={setSelectedNode}
                              />
                              {/* Vertical line down */}
                              {rowIndex < generationRows.length - 1 && (
                                <div className="w-0.5 h-6 bg-gray-500 mt-2" />
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Generation skip indicator */}
                    {allNodes.some(n => n.generationsSkipped && n.generationsSkipped > 0) && (
                      <div className="mt-2 px-3 py-1 bg-gray-800 rounded-full text-xs text-gray-400">
                        {allNodes.find(n => n.generationsSkipped)?.generationsSkipped} generations skipped
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Selected node panel */}
        {selectedNode && (
          <div className="w-80 bg-app-card rounded-lg border border-app-border p-4 flex-shrink-0">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-app-text flex items-center gap-2">
                {selectedNode.isFavorite && (
                  <Star size={16} className="text-yellow-400 fill-current" />
                )}
                {selectedNode.name}
              </h3>
              <button
                onClick={() => setSelectedNode(null)}
                className="text-app-text-muted hover:text-app-text"
              >
                ×
              </button>
            </div>

            {/* Photo */}
            {selectedNode.photoUrl ? (
              <img
                src={selectedNode.photoUrl}
                alt={selectedNode.name}
                className="w-full h-48 object-cover rounded-lg mb-4"
              />
            ) : (
              <div className="w-full h-48 bg-app-bg rounded-lg flex items-center justify-center mb-4">
                <User size={48} className="text-app-text-subtle" />
              </div>
            )}

            <p className="text-app-text-muted mb-2">{selectedNode.lifespan}</p>
            <p className="text-sm text-app-text-subtle mb-4">
              Generation {selectedNode.generationFromRoot} from root
            </p>

            {/* Why interesting */}
            {selectedNode.whyInteresting && (
              <div className="mb-4">
                <h4 className="text-sm font-medium text-app-text-secondary mb-1">Why Interesting</h4>
                <p className="text-sm text-app-text-muted">{selectedNode.whyInteresting}</p>
              </div>
            )}

            {/* Tags */}
            {selectedNode.tags && selectedNode.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-4">
                {selectedNode.tags.map(tag => (
                  <span
                    key={tag}
                    className="px-2 py-0.5 bg-app-accent/20 text-app-accent rounded text-xs"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}

            {/* Link to person detail */}
            <Link
              to={`/person/${dbId}/${selectedNode.id}`}
              className="block w-full py-2 bg-app-accent text-app-text text-center rounded hover:bg-app-accent/80 transition-colors"
            >
              View Details
            </Link>
          </div>
        )}
      </div>

      {/* Info footer */}
      <div className="px-4 py-2 text-xs text-app-text-subtle flex items-center gap-4">
        <span>Scroll to zoom • Drag to pan</span>
        <span>•</span>
        <span>← Paternal (father's side)</span>
        <span>•</span>
        <span>Maternal (mother's side) →</span>
        <span>•</span>
        <span className="flex items-center gap-2">
          <span className="w-3 h-3 bg-blue-900/50 rounded" /> Male
          <span className="w-3 h-3 bg-pink-900/50 rounded ml-2" /> Female
        </span>
      </div>
    </div>
  );
}
