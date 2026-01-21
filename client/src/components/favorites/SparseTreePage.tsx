import { useEffect, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import * as d3 from 'd3';
import { Network, Star, User, Download, Loader2, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';
import type { SparseTreeResult, SparseTreeNode, DatabaseInfo } from '@fsf/shared';
import { api } from '../../services/api';

export function SparseTreePage() {
  const { dbId } = useParams<{ dbId: string }>();
  const [treeData, setTreeData] = useState<SparseTreeResult | null>(null);
  const [database, setDatabase] = useState<DatabaseInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<SparseTreeNode | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);

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

  // D3 tree rendering
  useEffect(() => {
    if (!treeData || !svgRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const width = svgRef.current.clientWidth;
    const height = svgRef.current.clientHeight;
    const margin = { top: 60, right: 40, bottom: 60, left: 40 };

    // Create main group for zoom/pan
    const g = svg.append('g')
      .attr('transform', `translate(${width / 2},${margin.top})`);

    // Create hierarchy from tree data
    const root = d3.hierarchy(treeData.root);

    // Use tree layout with vertical orientation (root at top)
    const treeLayout = d3.tree<SparseTreeNode>()
      .nodeSize([180, 120])
      .separation((a, b) => a.parent === b.parent ? 1 : 1.5);

    treeLayout(root);

    // Draw links with generation count labels
    const links = g.selectAll('.link')
      .data(root.links())
      .enter()
      .append('g')
      .attr('class', 'link-group');

    // Draw curved links
    links.append('path')
      .attr('class', 'link')
      .attr('fill', 'none')
      .attr('stroke', '#3a3a3a')
      .attr('stroke-width', 2)
      .attr('d', d3.linkVertical<d3.HierarchyPointLink<SparseTreeNode>, d3.HierarchyPointNode<SparseTreeNode>>()
        .x(d => d.x)
        .y(d => d.y) as unknown as string);

    // Add generation skip labels on links
    links.each(function(d) {
      const targetData = d.target.data;
      if (targetData.generationsSkipped && targetData.generationsSkipped > 0) {
        const midX = ((d.source.x ?? 0) + (d.target.x ?? 0)) / 2;
        const midY = ((d.source.y ?? 0) + (d.target.y ?? 0)) / 2;

        d3.select(this)
          .append('rect')
          .attr('x', midX - 30)
          .attr('y', midY - 10)
          .attr('width', 60)
          .attr('height', 20)
          .attr('rx', 10)
          .attr('fill', '#1a1a1a')
          .attr('stroke', '#3a3a3a');

        d3.select(this)
          .append('text')
          .attr('x', midX)
          .attr('y', midY + 4)
          .attr('text-anchor', 'middle')
          .attr('font-size', '10px')
          .attr('fill', '#9ca3af')
          .text(`${targetData.generationsSkipped} gen`);
      }
    });

    // Draw nodes
    const nodes = g.selectAll('.node')
      .data(root.descendants())
      .enter()
      .append('g')
      .attr('class', 'node')
      .attr('transform', d => `translate(${d.x},${d.y})`)
      .style('cursor', 'pointer')
      .on('click', (_event, d) => {
        setSelectedNode(d.data);
      });

    // Node card background
    nodes.append('rect')
      .attr('x', -70)
      .attr('y', -35)
      .attr('width', 140)
      .attr('height', 70)
      .attr('rx', 8)
      .attr('fill', d => d.data.isFavorite ? '#1e293b' : '#1a1a1a')
      .attr('stroke', d => d.data.isFavorite ? '#eab308' : '#3a3a3a')
      .attr('stroke-width', d => d.data.isFavorite ? 2 : 1);

    // Star icon for favorites
    nodes.filter(d => d.data.isFavorite)
      .append('text')
      .attr('x', -60)
      .attr('y', -20)
      .attr('font-size', '14px')
      .attr('fill', '#eab308')
      .text('★');

    // Photo placeholder or actual photo
    nodes.append('clipPath')
      .attr('id', d => `clip-${d.data.id}`)
      .append('circle')
      .attr('cx', -40)
      .attr('cy', 0)
      .attr('r', 20);

    nodes.each(function(d) {
      const node = d3.select(this);
      if (d.data.photoUrl) {
        node.append('image')
          .attr('x', -60)
          .attr('y', -20)
          .attr('width', 40)
          .attr('height', 40)
          .attr('clip-path', `url(#clip-${d.data.id})`)
          .attr('href', d.data.photoUrl)
          .attr('preserveAspectRatio', 'xMidYMid slice');
      } else {
        node.append('circle')
          .attr('cx', -40)
          .attr('cy', 0)
          .attr('r', 20)
          .attr('fill', '#2a2a2a')
          .attr('stroke', '#3a3a3a');

        node.append('text')
          .attr('x', -40)
          .attr('y', 5)
          .attr('text-anchor', 'middle')
          .attr('font-size', '16px')
          .attr('fill', '#6b7280')
          .text('👤');
      }
    });

    // Name label
    nodes.append('text')
      .attr('x', 0)
      .attr('y', -10)
      .attr('text-anchor', 'middle')
      .attr('font-size', '11px')
      .attr('font-weight', 'bold')
      .attr('fill', '#ffffff')
      .each(function(d) {
        const text = d3.select(this);
        const name = d.data.name;
        // Truncate long names
        if (name.length > 18) {
          text.text(name.substring(0, 16) + '...');
          text.append('title').text(name);
        } else {
          text.text(name);
        }
      });

    // Lifespan label
    nodes.append('text')
      .attr('x', 0)
      .attr('y', 6)
      .attr('text-anchor', 'middle')
      .attr('font-size', '9px')
      .attr('fill', '#9ca3af')
      .text(d => d.data.lifespan);

    // Generation badge
    nodes.append('text')
      .attr('x', 0)
      .attr('y', 22)
      .attr('text-anchor', 'middle')
      .attr('font-size', '9px')
      .attr('fill', '#6b7280')
      .text(d => `Gen ${d.data.generationFromRoot}`);

    // Tags badges (first 2)
    nodes.each(function(d) {
      if (!d.data.tags || d.data.tags.length === 0) return;
      const node = d3.select(this);
      const tagsToShow = d.data.tags.slice(0, 2);
      let xOffset = -tagsToShow.length * 25;

      tagsToShow.forEach((tag, i) => {
        node.append('rect')
          .attr('x', xOffset + i * 50 - 2)
          .attr('y', 28)
          .attr('width', 48)
          .attr('height', 14)
          .attr('rx', 7)
          .attr('fill', '#3b82f6')
          .attr('opacity', 0.2);

        node.append('text')
          .attr('x', xOffset + i * 50 + 22)
          .attr('y', 38)
          .attr('text-anchor', 'middle')
          .attr('font-size', '8px')
          .attr('fill', '#60a5fa')
          .text(tag.length > 8 ? tag.substring(0, 6) + '..' : tag);
      });
    });

    // Setup zoom
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
      });

    zoomRef.current = zoom;
    svg.call(zoom);

    // Initial transform to center and show tree
    const bounds = g.node()?.getBBox();
    if (bounds) {
      const dx = bounds.width;
      const dy = bounds.height;
      const x = bounds.x + dx / 2;
      const y = bounds.y + dy / 2;
      const scale = Math.min(0.8, 0.9 / Math.max(dx / width, dy / height));
      const translate = [width / 2 - scale * x, height / 2 - scale * y];

      svg.call(
        zoom.transform,
        d3.zoomIdentity.translate(translate[0], translate[1]).scale(scale)
      );
    }

  }, [treeData]);

  const handleZoomIn = () => {
    if (svgRef.current && zoomRef.current) {
      d3.select(svgRef.current).transition().call(zoomRef.current.scaleBy, 1.3);
    }
  };

  const handleZoomOut = () => {
    if (svgRef.current && zoomRef.current) {
      d3.select(svgRef.current).transition().call(zoomRef.current.scaleBy, 0.7);
    }
  };

  const handleResetZoom = () => {
    if (svgRef.current && zoomRef.current) {
      const svg = d3.select(svgRef.current);
      const width = svgRef.current.clientWidth;
      svg.transition().call(
        zoomRef.current.transform,
        d3.zoomIdentity.translate(width / 2, 60)
      );
    }
  };

  const handleExportSvg = () => {
    if (!svgRef.current) return;

    const svgClone = svgRef.current.cloneNode(true) as SVGSVGElement;
    svgClone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');

    // Add styles inline
    const styleEl = document.createElementNS('http://www.w3.org/2000/svg', 'style');
    styleEl.textContent = `
      .link { fill: none; stroke: #3a3a3a; stroke-width: 2; }
      text { font-family: system-ui, -apple-system, sans-serif; }
    `;
    svgClone.insertBefore(styleEl, svgClone.firstChild);

    const svgData = new XMLSerializer().serializeToString(svgClone);
    const blob = new Blob([svgData], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `sparse-tree-${dbId}.svg`;
    a.click();

    URL.revokeObjectURL(url);
  };

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
        <Network size={48} className="mx-auto text-neutral-600 mb-4" />
        <h3 className="text-lg font-medium text-neutral-400 mb-2">
          No favorites in this database
        </h3>
        <p className="text-neutral-500 mb-4">
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
            <h1 className="text-2xl font-bold text-white">Sparse Tree</h1>
            <p className="text-sm text-neutral-400">
              {database?.rootName || dbId} - {treeData.totalFavorites} favorites, {treeData.maxGeneration} generations
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Link
            to="/favorites"
            className="px-3 py-1.5 bg-app-border text-neutral-300 rounded hover:bg-neutral-700 text-sm"
          >
            All Favorites
          </Link>
          <button
            onClick={handleExportSvg}
            className="px-3 py-1.5 bg-app-border text-neutral-300 rounded hover:bg-neutral-700 text-sm flex items-center gap-1"
          >
            <Download size={14} />
            Export SVG
          </button>
        </div>
      </div>

      {/* Tree visualization */}
      <div className="flex-1 flex gap-4">
        <div className="flex-1 bg-app-card rounded-lg border border-app-border overflow-hidden relative">
          <svg ref={svgRef} className="w-full h-full" style={{ minHeight: '600px' }} />

          {/* Zoom controls */}
          <div className="absolute bottom-4 right-4 flex flex-col gap-1">
            <button
              onClick={handleZoomIn}
              className="p-2 bg-app-bg border border-app-border rounded hover:bg-app-border"
              title="Zoom in"
            >
              <ZoomIn size={16} className="text-neutral-300" />
            </button>
            <button
              onClick={handleZoomOut}
              className="p-2 bg-app-bg border border-app-border rounded hover:bg-app-border"
              title="Zoom out"
            >
              <ZoomOut size={16} className="text-neutral-300" />
            </button>
            <button
              onClick={handleResetZoom}
              className="p-2 bg-app-bg border border-app-border rounded hover:bg-app-border"
              title="Reset view"
            >
              <Maximize2 size={16} className="text-neutral-300" />
            </button>
          </div>
        </div>

        {/* Selected node panel */}
        {selectedNode && (
          <div className="w-80 bg-app-card rounded-lg border border-app-border p-4 flex-shrink-0">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                {selectedNode.isFavorite && (
                  <Star size={16} className="text-yellow-400 fill-current" />
                )}
                {selectedNode.name}
              </h3>
              <button
                onClick={() => setSelectedNode(null)}
                className="text-neutral-400 hover:text-white"
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
                <User size={48} className="text-neutral-600" />
              </div>
            )}

            <p className="text-neutral-400 mb-2">{selectedNode.lifespan}</p>
            <p className="text-sm text-neutral-500 mb-4">
              Generation {selectedNode.generationFromRoot} from root
            </p>

            {/* Why interesting */}
            {selectedNode.whyInteresting && (
              <div className="mb-4">
                <h4 className="text-sm font-medium text-neutral-300 mb-1">Why Interesting</h4>
                <p className="text-sm text-neutral-400">{selectedNode.whyInteresting}</p>
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
              className="block w-full py-2 bg-app-accent text-white text-center rounded hover:bg-app-accent/80 transition-colors"
            >
              View Details
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
