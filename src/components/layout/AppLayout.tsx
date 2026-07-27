import { Outlet } from 'react-router-dom'
import AppSidebar from './AppSidebar'
import NotificationsBell from './NotificationsBell'

export default function AppLayout() {
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <AppSidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-12 shrink-0 items-center justify-end border-b px-4">
          <NotificationsBell />
        </header>
        <main className="flex-1 overflow-y-auto">
          <div className="p-6">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
