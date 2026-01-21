import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import * as d3 from 'd3';
import type { AncestryTreeResult, AncestryFamilyUnit, ExpandAncestryRequest } from '@fsf/shared';
import { api } from '../../services/api';
import { PersonCard } from './PersonCard';
import { FamilyUnitCard } from './FamilyUnitCard';

export function AncestryTreeView() {
  const { dbId, personId } = useParams<{ dbId: string; personId?: string }>();
  const [treeData, setTreeData] = useState<AncestryTreeResult | null>(null);
  const [rootId, setRootId] = useState<string | null>(personId || null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandingNodes, setExpandingNodes] = useState<Set<string>>(new Set());
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  // Get database info to find root if no personId provided
  useEffect(() => {
    if (!personId && dbId) {
      api.getDatabase(dbId)
        .then(db => setRootId(db.rootId))
        .catch(err => setError(err.message));
    }
  }, [dbId, personId]);

  // Load ancestry tree data
  useEffect(() => {
    if (!dbId || !rootId) return;

    setLoading(true);
    setError(null);

    api.getAncestryTree(dbId, rootId, 4)
      .then(data => {
        setTreeData(data);
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [dbId, rootId]);

  // Handle expanding a node
  const handleExpand = useCallback(async (request: ExpandAncestryRequest, nodeId: string) => {
    if (!dbId || expandingNodes.has(nodeId)) return;

    setExpandingNodes(prev => new Set(prev).add(nodeId));

    const expandedData = await api.expandAncestryGeneration(dbId, request, 2).catch(err => {
      console.error('Failed to expand:', err);
      return null;
    });

    setExpandingNodes(prev => {
      const next = new Set(prev);
      next.delete(nodeId);
      return next;
    });

    if (!expandedData || !treeData) return;

    // Update tree data with expanded node
    setTreeData(prevData => {
      if (!prevData) return prevData;

      // Deep clone the tree data
      const newData = JSON.parse(JSON.stringify(prevData)) as AncestryTreeResult;

      // Find and update the family unit that needs expansion
      const updateUnit = (units: AncestryFamilyUnit[] | undefined): boolean => {
        if (!units) return false;

        for (const unit of units) {
          // Check if this unit contains the person being expanded
          if (unit.father?.id === request.fatherId || unit.mother?.id === request.motherId) {
            // The expanded data contains the parents of the person we expanded from
            // We need to add these as parentUnits
            if (!unit.parentUnits) {
              unit.parentUnits = [];
            }

            // Add the expanded unit
            unit.parentUnits.push(expandedData);

            // Update hasMoreAncestors flags
            if (unit.father?.id === request.fatherId && unit.father) {
              unit.father.hasMoreAncestors = false;
            }
            if (unit.mother?.id === request.motherId && unit.mother) {
              unit.mother.hasMoreAncestors = false;
            }

            return true;
          }

          // Recursively check child units
          if (updateUnit(unit.parentUnits)) return true;
        }

        return false;
      };

      updateUnit(newData.parentUnits);

      return newData;
    });
  }, [dbId, expandingNodes, treeData]);

  // Setup D3 zoom behavior
  useEffect(() => {
    if (!containerRef.current || !contentRef.current) return;

    const container = d3.select(containerRef.current);
    const content = d3.select(contentRef.current);

    const zoom = d3.zoom<HTMLDivElement, unknown>()
      .scaleExtent([0.2, 2])
      .on('zoom', (event) => {
        content.style('transform', `translate(${event.transform.x}px, ${event.transform.y}px) scale(${event.transform.k})`);
        content.style('transform-origin', '0 0');
      });

    container.call(zoom);

    // Set initial transform to center the tree
    const containerRect = containerRef.current.getBoundingClientRect();
    const initialX = 100;
    const initialY = containerRect.height / 2 - 90; // Approximate half of family unit height

    container.call(zoom.transform, d3.zoomIdentity.translate(initialX, initialY));

    return () => {
      container.on('.zoom', null);
    };
  }, [treeData]);

  // Recursive component to render family units
  const renderFamilyUnit = (
    unit: AncestryFamilyUnit,
    depth: number
  ): JSX.Element => {
    const nodeId = unit.id;
    const isExpandingFather = unit.father?.id ? expandingNodes.has(`expand_${unit.father.id}`) : false;
    const isExpandingMother = unit.mother?.id ? expandingNodes.has(`expand_${unit.mother.id}`) : false;

    return (
      <div key={nodeId} className="flex items-center">
        <div className="flex flex-col">
          <FamilyUnitCard
            unit={unit}
            dbId={dbId!}
            onExpandFather={
              unit.father?.hasMoreAncestors
                ? () => handleExpand({ fatherId: unit.father!.id }, `expand_${unit.father!.id}`)
                : undefined
            }
            onExpandMother={
              unit.mother?.hasMoreAncestors
                ? () => handleExpand({ motherId: unit.mother!.id }, `expand_${unit.mother!.id}`)
                : undefined
            }
            loadingFather={isExpandingFather}
            loadingMother={isExpandingMother}
          />
        </div>

        {/* Render parent units recursively */}
        {unit.parentUnits && unit.parentUnits.length > 0 && (
          <div className="flex flex-col justify-center ml-8">
            <div className="flex flex-col gap-4">
              {unit.parentUnits.map((parentUnit) => (
                <div key={parentUnit.id} className="relative flex items-center">
                  {/* Horizontal connector line */}
                  <div
                    className="absolute top-1/2 -left-8 w-8 h-0.5 bg-gray-600"
                    style={{ transform: 'translateY(-50%)' }}
                  />
                  {renderFamilyUnit(parentUnit, depth + 1)}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-neutral-400">Loading ancestry tree...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <p className="text-app-error mb-4">Error: {error}</p>
          <Link
            to="/"
            className="px-4 py-2 bg-app-border text-neutral-300 rounded hover:bg-neutral-700"
          >
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  if (!treeData) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <p className="text-neutral-400">No tree data available</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 px-4 pt-4">
        <h1 className="text-2xl font-bold text-app-text">Ancestry Tree</h1>
        <div className="flex gap-2">
          <Link
            to={`/search/${dbId}`}
            className="px-3 py-1 bg-app-border text-neutral-300 rounded hover:bg-neutral-700 text-sm"
          >
            Search
          </Link>
          <Link
            to={`/path/${dbId}`}
            className="px-3 py-1 bg-app-border text-neutral-300 rounded hover:bg-neutral-700 text-sm"
          >
            Find Path
          </Link>
        </div>
      </div>

      {/* Tree container with zoom/pan */}
      <div
        ref={containerRef}
        className="flex-1 bg-app-card rounded-lg border border-app-border overflow-hidden cursor-grab active:cursor-grabbing"
        style={{ minHeight: '600px' }}
      >
        <div ref={contentRef} className="p-8">
          {/* Tree visualization */}
          <div className="flex items-center">
            {/* Root person */}
            <div className="flex flex-col items-start">
              <PersonCard
                person={treeData.rootPerson}
                dbId={dbId!}
              />
              {treeData.rootSpouse && (
                <div className="mt-2">
                  <PersonCard
                    person={treeData.rootSpouse}
                    dbId={dbId!}
                  />
                </div>
              )}
            </div>

            {/* Parent units */}
            {treeData.parentUnits && treeData.parentUnits.length > 0 && (
              <div className="flex items-center">
                {/* Connector from root to parents */}
                <div className="w-8 h-0.5 bg-gray-600" />

                <div className="flex flex-col gap-4">
                  {treeData.parentUnits.map((unit) => (
                    <div key={unit.id} className="relative">
                      {renderFamilyUnit(unit, 1)}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Info footer */}
      <div className="px-4 py-2 text-xs text-neutral-500 flex items-center gap-4">
        <span>Scroll to zoom • Drag to pan</span>
        <span>•</span>
        <span>Generations loaded: {treeData.maxGenerationLoaded}</span>
        <span>•</span>
        <span className="flex items-center gap-2">
          <span className="w-3 h-3 border-l-2 border-blue-500" /> Male
          <span className="w-3 h-3 border-l-2 border-pink-500 ml-2" /> Female
        </span>
      </div>
    </div>
  );
}
