import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'sonner'
import { useAuthInit, useAuth } from '@/hooks/useAuth'
import { ThemeProvider } from '@/hooks/useTheme'
import AppLayout from '@/components/layout/AppLayout'
import ProtectedRoute from '@/components/layout/ProtectedRoute'
import ErrorBoundary from '@/components/layout/ErrorBoundary'
import LoginPage from '@/pages/LoginPage'
import { Loader2 } from 'lucide-react'

// Lazy-loaded routes — separan Excalidraw, Tiptap, Mermaid, etc. del bundle principal
const DashboardPage = lazy(() => import('@/pages/DashboardPage'))
const DesarrolloPage = lazy(() => import('@/pages/DesarrolloPage'))
const SoportePage = lazy(() => import('@/pages/SoportePage'))
const MarketingPage = lazy(() => import('@/pages/MarketingPage'))
const ColaboracionPage = lazy(() => import('@/pages/ColaboracionPage'))
const UsersPage = lazy(() => import('@/pages/UsersPage'))

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 1000 * 60, retry: 1 },
  },
})

function RouteFallback() {
  return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
    </div>
  )
}

function LazyRoute({ children }: { children: React.ReactNode }) {
  return (
    <ErrorBoundary>
      <Suspense fallback={<RouteFallback />}>
        {children}
      </Suspense>
    </ErrorBoundary>
  )
}

function AppRoutes() {
  useAuthInit()
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <Routes>
      <Route
        path="/login"
        element={user ? <Navigate to="/" replace /> : <LoginPage />}
      />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<LazyRoute><DashboardPage /></LazyRoute>} />
        <Route path="desarrollo" element={<LazyRoute><DesarrolloPage /></LazyRoute>} />
        <Route path="colaboracion" element={<LazyRoute><ColaboracionPage /></LazyRoute>} />
        <Route path="marketing" element={<LazyRoute><MarketingPage /></LazyRoute>} />
        <Route path="soporte" element={<LazyRoute><SoportePage /></LazyRoute>} />
        <Route path="usuarios" element={<LazyRoute><UsersPage /></LazyRoute>} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <AppRoutes />
          <Toaster richColors position="top-right" />
        </BrowserRouter>
      </QueryClientProvider>
    </ThemeProvider>
  )
}
