import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import NavigationTracker from '@/lib/NavigationTracker'
import { pagesConfig } from './pages.config'
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import Login from './pages/Login';
import React, { lazy, Suspense } from 'react';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import ProtectedRoute from '@/components/ProtectedRoute';
import AppErrorBoundary from '@/components/AppErrorBoundary';
import { PageLoadingSkeleton } from '@/components/PageState';

const StoreRanking = lazy(() => import('./pages/StoreRanking'));
const VerifyAccount = lazy(() => import('./pages/VerifyAccount'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));
const AuditDashboard = lazy(() => import('./pages/AuditDashboard'));
const StoreAuditAnalytics = lazy(() => import('./pages/StoreAuditAnalytics'));
const DailySummary = lazy(() => import('./pages/DailySummary'));
const SqlExport = lazy(() => import('./pages/SqlExport'));

const { Pages, Layout, mainPage } = pagesConfig;
const mainPageKey = mainPage ?? Object.keys(Pages)[0];
const MainPage = mainPageKey ? Pages[mainPageKey] : <></>;

const STORE_SCOPED_PAGES = new Set([
  'ApprovalQueue',
  'Audit',
  'Analytics',
  'AuditDashboard',
  'DailySummary',
  'StoreAuditAnalytics',
  'StoreRanking',
]);

const StoreScopeRequired = () => (
  <div className="app-page flex min-h-[60vh] items-center justify-center">
    <div className="max-w-lg rounded-2xl border border-amber-200 bg-amber-50 p-8 text-center shadow-sm">
      <h1 className="text-xl font-bold text-slate-900">No store access assigned</h1>
      <p className="mt-2 text-sm leading-6 text-slate-600">
        Your branch manager account cannot view audits, approvals, or analytics until an administrator assigns at least one active store. Access updates when stores are added or removed from your account.
      </p>
    </div>
  </div>
);

const LayoutWrapper = ({ children, currentPageName }) => {
  const { user } = useAuth();
  const isUnassignedStoreManager = user?.user_type === 'store_manager'
    && (!Array.isArray(user.assigned_stores) || user.assigned_stores.length === 0);
  const content = isUnassignedStoreManager && STORE_SCOPED_PAGES.has(currentPageName)
    ? <StoreScopeRequired />
    : children;

  return Layout
    ? <Layout currentPageName={currentPageName}>{content}</Layout>
    : <>{content}</>;
};

function App() {
  return (
    <AppErrorBoundary>
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <NavigationTracker />
          <Suspense fallback={<PageLoadingSkeleton />}>
          <Routes>
            {/* Public auth routes */}
            <Route path="/login" element={<Login />} />
            <Route path="/verify" element={<VerifyAccount />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />

            {/* All app routes are protected */}
            <Route element={<ProtectedRoute unauthenticatedElement={<Navigate to="/login" replace />} />}>
              <Route path="/" element={
                <LayoutWrapper currentPageName={mainPageKey}>
                  <MainPage />
                </LayoutWrapper>
              } />
              {Object.entries(Pages).map(([path, Page]) => (
                <Route
                  key={path}
                  path={`/${path}`}
                  element={
                    <LayoutWrapper currentPageName={path}>
                      <Page />
                    </LayoutWrapper>
                  }
                />
              ))}
              <Route path="/StoreRanking" element={<LayoutWrapper currentPageName="StoreRanking"><StoreRanking /></LayoutWrapper>} />
              <Route path="/AuditDashboard" element={<LayoutWrapper currentPageName="AuditDashboard"><AuditDashboard /></LayoutWrapper>} />
              <Route path="/StoreAuditAnalytics" element={<LayoutWrapper currentPageName="StoreAuditAnalytics"><StoreAuditAnalytics /></LayoutWrapper>} />
              <Route path="/DailySummary" element={<LayoutWrapper currentPageName="DailySummary"><DailySummary /></LayoutWrapper>} />
              <Route path="/SqlExport" element={<LayoutWrapper currentPageName="SqlExport"><SqlExport /></LayoutWrapper>} />
            </Route>

            <Route path="*" element={<PageNotFound />} />
          </Routes>
          </Suspense>
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
    </AppErrorBoundary>
  )
}

export default App
