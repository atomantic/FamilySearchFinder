import { useEffect, useRef, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import * as d3 from 'd3';
import type { TreeNode } from '@fsf/shared';
import { api } from '../../services/api';
import { useTheme } from '../../context/ThemeContext';

export function TreeView() {
  const { dbId, personId } = useParams<{ dbId: string; personId?: string }>();
  const navigate = useNavigate();
  const { theme } = useTheme();
  const [tree, setTree] = useState<TreeNode | null>(null);
  const [rootId, setRootId] = useState<string | null>(personId || null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  // Get database info to find root if no personId provided
  useEffect(() => {
    if (!personId && dbId) {
      api.getDatabase(dbId)
        .then(db => setRootId(db.rootId))
        .catch(err => setError(err.message));
    }
  }, [dbId, personId]);

  // Load tree data
  useEffect(() => {
    if (!dbId || !rootId) return;

    setLoading(true);
    api.getPersonTree(dbId, rootId, 5, 'ancestors')
      .then(setTree)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [dbId, rootId]);

  // D3 tree rendering
  useEffect(() => {
    if (!tree || !svgRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const width = svgRef.current.clientWidth;
    const height = svgRef.current.clientHeight;
    // Use smaller margins on mobile for better centering
    const isMobile = width < 768;
    const margin = { top: 40, right: isMobile ? 40 : 120, bottom: 40, left: isMobile ? 40 : 120 };

    // Get computed CSS variable colors for theme support
    const computedStyle = getComputedStyle(document.documentElement);
    const textColor = computedStyle.getPropertyValue('--color-app-text').trim() || '#ffffff';
    const mutedColor = computedStyle.getPropertyValue('--color-app-text-muted').trim() || '#9ca3af';
    const cardColor = computedStyle.getPropertyValue('--color-app-card').trim() || '#1a1a1a';

    const g = svg.append('g')
      .attr('transform', `translate(${margin.left},${height / 2})`);

    // Create hierarchy
    const root = d3.hierarchy(tree);
    const treeLayout = d3.tree<TreeNode>().nodeSize([60, 200]);
    treeLayout(root);

    // Links - use theme-aware border color
    g.selectAll('.link')
      .data(root.links())
      .enter()
      .append('path')
      .attr('class', 'link')
      .attr('fill', 'none')
      .attr('stroke', mutedColor)
      .attr('stroke-width', 2)
      .attr('d', d3.linkHorizontal<d3.HierarchyPointLink<TreeNode>, d3.HierarchyPointNode<TreeNode>>()
        .x(d => d.y)
        .y(d => d.x) as any);

    // Nodes
    const nodes = g.selectAll('.node')
      .data(root.descendants())
      .enter()
      .append('g')
      .attr('class', 'node')
      .attr('transform', d => `translate(${d.y},${d.x})`)
      .style('cursor', 'pointer')
      .on('click', (_event, d) => {
        navigate(`/person/${dbId}/${d.data.id}`);
      });

    nodes.append('circle')
      .attr('r', 8)
      .attr('fill', d => d.data._collapsed ? '#f59e0b' : '#3b82f6')
      .attr('stroke', cardColor)
      .attr('stroke-width', 2)
      .on('mouseenter', function() {
        d3.select(this).attr('r', 10).attr('stroke', '#60a5fa');
      })
      .on('mouseleave', function() {
        d3.select(this).attr('r', 8).attr('stroke', cardColor);
      });

    // Name label - use theme text color
    nodes.append('text')
      .attr('dy', -15)
      .attr('text-anchor', 'middle')
      .attr('font-size', '12px')
      .attr('fill', textColor)
      .text(d => d.data.name);

    // Lifespan label - use theme muted color
    nodes.append('text')
      .attr('dy', 25)
      .attr('text-anchor', 'middle')
      .attr('font-size', '10px')
      .attr('fill', mutedColor)
      .text(d => d.data.lifespan);

    // Zoom
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
      });

    svg.call(zoom);

    // Center the root node in the viewport
    // On mobile, use center of viewport; on desktop, use left margin positioning
    const initialX = isMobile ? width / 2 : margin.left;
    const initialScale = isMobile ? 0.8 : 1;
    svg.call(zoom.transform, d3.zoomIdentity.translate(initialX, height / 2).scale(initialScale));

  }, [tree, navigate, dbId, theme]);

  if (loading) {
    return <div className="text-center py-8 text-app-text-muted">Loading tree...</div>;
  }

  if (error) {
    return <div className="text-center py-8 text-app-error">Error: {error}</div>;
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-app-text">Family Tree</h1>
        <div className="flex gap-2">
          <Link
            to={`/search/${dbId}`}
            className="px-3 py-1 bg-app-border text-app-text-secondary rounded hover:bg-app-hover text-sm"
          >
            Search
          </Link>
          <Link
            to={`/path/${dbId}`}
            className="px-3 py-1 bg-app-border text-app-text-secondary rounded hover:bg-app-hover text-sm"
          >
            Find Path
          </Link>
        </div>
      </div>
      <div className="flex-1 bg-app-card rounded-lg border border-app-border overflow-hidden">
        <svg ref={svgRef} className="w-full h-full" style={{ minHeight: '600px' }} />
      </div>
    </div>
  );
}
