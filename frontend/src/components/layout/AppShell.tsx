import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { MobileSidebar, Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { MobileTabBar } from './MobileTabBar';

export function AppShell() {
  const [navOpen, setNavOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setNavOpen(false);
    window.scrollTo({ top: 0 });
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-canvas">
      <Sidebar />
      <MobileSidebar open={navOpen} onClose={() => setNavOpen(false)} />

      <div className="lg:pl-[264px]">
        <Topbar onOpenNav={() => setNavOpen(true)} />

        <main className="mx-auto w-full max-w-[1440px] px-4 pb-28 pt-6 sm:px-6 lg:px-8 lg:pb-12">
          <div key={location.pathname} className="animate-fade-up">
            <Outlet />
          </div>
        </main>
      </div>

      <MobileTabBar />
    </div>
  );
}
