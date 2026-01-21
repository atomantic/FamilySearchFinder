import { Link, useLocation, useParams } from 'react-router-dom';
import { Home, Download, Bot, GitBranch, Search, Route, ChevronLeft, ChevronRight, X, Menu } from 'lucide-react';
import { useSidebar } from '../../context/SidebarContext';

interface NavItem {
  path: string;
  label: string;
  icon: React.ReactNode;
}

const primaryNavItems: NavItem[] = [
  { path: '/', label: 'Dashboard', icon: <Home size={20} /> },
  { path: '/indexer', label: 'Indexer', icon: <Download size={20} /> },
  { path: '/providers', label: 'AI Providers', icon: <Bot size={20} /> },
];

export function Sidebar() {
  const location = useLocation();
  const { dbId } = useParams<{ dbId?: string }>();
  const { isCollapsed, isMobileOpen, toggleCollapsed, toggleMobile, closeMobile } = useSidebar();

  // Extract dbId from various route patterns
  const currentDbId = dbId || extractDbIdFromPath(location.pathname);

  const databaseNavItems: NavItem[] = currentDbId ? [
    { path: `/tree/${currentDbId}`, label: 'Tree View', icon: <GitBranch size={20} /> },
    { path: `/search/${currentDbId}`, label: 'Search', icon: <Search size={20} /> },
    { path: `/path/${currentDbId}`, label: 'Find Path', icon: <Route size={20} /> },
  ] : [];

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  const navLinkClasses = (path: string) => `
    flex items-center gap-3 px-3 py-2 rounded-lg transition-colors
    ${isActive(path)
      ? 'bg-app-accent text-white'
      : 'text-neutral-400 hover:bg-app-border hover:text-white'
    }
    ${isCollapsed ? 'justify-center' : ''}
  `;

  return (
    <>
      {/* Mobile hamburger button */}
      <button
        onClick={toggleMobile}
        className="fixed top-4 left-4 z-50 p-2 rounded-lg bg-app-card border border-app-border text-white md:hidden"
        aria-label="Toggle menu"
      >
        {isMobileOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      {/* Mobile overlay */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={closeMobile}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed top-0 left-0 h-screen bg-app-card border-r border-app-border z-40
          transition-all duration-300 flex flex-col flex-shrink-0
          ${isCollapsed ? 'w-16' : 'w-64'}
          ${isMobileOpen ? 'translate-x-0' : '-translate-x-full'}
          md:translate-x-0 md:sticky
        `}
      >
        {/* Logo / Brand */}
        <div className={`p-4 border-b border-app-border flex items-center ${isCollapsed ? 'justify-center' : 'justify-between'}`}>
          {!isCollapsed && (
            <Link to="/" className="text-lg font-bold text-white truncate" onClick={closeMobile}>
              FSF
            </Link>
          )}
          <button
            onClick={toggleCollapsed}
            className="p-1.5 rounded-lg text-neutral-400 hover:bg-app-border hover:text-white hidden md:block"
            aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {isCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          </button>
        </div>

        {/* Primary Navigation */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {primaryNavItems.map(item => (
            <Link
              key={item.path}
              to={item.path}
              className={navLinkClasses(item.path)}
              onClick={closeMobile}
              title={isCollapsed ? item.label : undefined}
            >
              {item.icon}
              {!isCollapsed && <span>{item.label}</span>}
            </Link>
          ))}

          {/* Database Context Navigation */}
          {databaseNavItems.length > 0 && (
            <>
              <div className={`pt-4 pb-2 ${isCollapsed ? 'border-t border-app-border mt-4' : ''}`}>
                {!isCollapsed && (
                  <span className="px-3 text-xs font-semibold text-neutral-500 uppercase tracking-wider">
                    Database
                  </span>
                )}
              </div>
              {databaseNavItems.map(item => (
                <Link
                  key={item.path}
                  to={item.path}
                  className={navLinkClasses(item.path)}
                  onClick={closeMobile}
                  title={isCollapsed ? item.label : undefined}
                >
                  {item.icon}
                  {!isCollapsed && <span>{item.label}</span>}
                </Link>
              ))}
            </>
          )}
        </nav>
      </aside>
    </>
  );
}

function extractDbIdFromPath(pathname: string): string | null {
  // Match patterns like /tree/db-XXX, /search/db-XXX, /path/db-XXX, /person/db-XXX/YYY
  const patterns = [
    /^\/tree\/(db-[^/]+)/,
    /^\/search\/(db-[^/]+)/,
    /^\/path\/(db-[^/]+)/,
    /^\/person\/(db-[^/]+)/,
  ];

  for (const pattern of patterns) {
    const match = pathname.match(pattern);
    if (match) return match[1];
  }

  return null;
}
