import { useState, lazy, Suspense } from 'react';
import Sidebar from './Sidebar';
import Header from './Header';
import { useAuthStore } from '../../stores/auth.store';
import { ROLE_HIERARCHY, type Role } from '@company-hub/shared';

// Lazy-loaded page components
const DashboardPage = lazy(() => import('../../modules/dashboard/DashboardPage'));
const AdminUsersPage = lazy(() => import('../../modules/admin/UsersPage'));
const AdminOrgPage = lazy(() => import('../../modules/admin/OrganizationPage'));
const TimeTrackingPage = lazy(() => import('../../modules/time-tracking/TimeTrackingPage'));
const LeavePage = lazy(() => import('../../modules/leave/LeavePage'));
const CalendarPage = lazy(() => import('../../modules/calendar/CalendarPage'));
const PlaceholderPage = lazy(() => import('../../modules/PlaceholderPage'));

const PAGE_TITLES: Record<string, string> = {
  '/': 'Dashboard',
  '/community': 'Community',
  '/tasks': 'Aufgaben',
  '/calendar': 'Kalender',
  '/time-tracking': 'Zeiterfassung',
  '/leave': 'Urlaub',
  '/ai': 'KI-Assistenten',
  '/courses': 'Kurse',
  '/admin/users': 'Benutzerverwaltung',
  '/admin/organization': 'Organisation',
  '/admin/settings': 'Einstellungen',
};

function PageLoader() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

export default function AppShell() {
  const [currentPath, setCurrentPath] = useState('/');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { user } = useAuthStore();

  const handleNavigate = (path: string) => {
    setCurrentPath(path);
    setMobileMenuOpen(false);
    // Update browser URL without reload
    window.history.pushState(null, '', path);
  };

  const pageTitle = PAGE_TITLES[currentPath] || 'Company Hub';

  const renderPage = () => {
    switch (currentPath) {
      case '/':
        return <DashboardPage />;
      case '/admin/users':
        return <AdminUsersPage />;
      case '/admin/organization':
        return <AdminOrgPage />;
      case '/time-tracking':
        return <TimeTrackingPage />;
      case '/leave':
        return <LeavePage />;
      case '/calendar':
        return <CalendarPage />;
      default:
        return <PlaceholderPage name={pageTitle} path={currentPath} />;
    }
  };

  return (
    <div className="min-h-screen bg-surface-secondary">
      {/* Mobile overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-20 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`lg:block ${mobileMenuOpen ? 'block' : 'hidden'}`}>
        <Sidebar
          currentPath={currentPath}
          onNavigate={handleNavigate}
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        />
      </div>

      {/* Main content */}
      <div
        className={`transition-all duration-300 ${
          sidebarCollapsed ? 'lg:ml-16' : 'lg:ml-64'
        }`}
      >
        <Header
          title={pageTitle}
          onMobileMenuToggle={() => setMobileMenuOpen(!mobileMenuOpen)}
        />

        <main className="p-6">
          <Suspense fallback={<PageLoader />}>
            {renderPage()}
          </Suspense>
        </main>
      </div>
    </div>
  );
}
