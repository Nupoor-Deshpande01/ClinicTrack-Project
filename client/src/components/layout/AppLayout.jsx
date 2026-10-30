import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Topbar from './Topbar';

/** Shared chrome: sidebar + top bar around every authenticated screen. */
export default function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="ct-shell">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="ct-main">
        <Topbar onMenuClick={() => setSidebarOpen(true)} />
        <main className="ct-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
