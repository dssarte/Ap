import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import NavigationTracker from '@/lib/NavigationTracker'
import { pagesConfig } from './pages.config'
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import Login from './pages/Login';
import React, { lazy, Suspense } from 'react';
import { AuthProvider } from '@/lib/AuthContext';
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

const LayoutWrapper = ({ children, currentPageName }) => Layout ?
  <Layout currentPageName={currentPageName}>{children}</Layout>
  : <>{children}</>;

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
