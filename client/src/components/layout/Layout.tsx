import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';

export function Layout() {
  return (
    <div className="h-screen flex bg-app-bg overflow-hidden">
      <Sidebar />
      <main className="flex-1 p-6 overflow-y-auto">
        <div className="md:hidden h-14" /> {/* Spacer for mobile hamburger */}
        <Outlet />
      </main>
    </div>
  );
}
