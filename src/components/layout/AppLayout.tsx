import { useMemo, useState } from 'react'
import { Outlet } from 'react-router-dom'
import AppSidebar from './AppSidebar'
import NotificationsBell from './NotificationsBell'
import { PageHeaderSlotsContext } from './pageHeaderSlots'

export default function AppLayout() {
  // La barra superior ofrece dos huecos que cada sección llena con PageHeader.
  // Callback refs y no useEffect: los nodos existen recién al montar, y guardar
  // el nodo desde el ref no es un setState dentro de un efecto.
  const [titleSlot, setTitleSlot] = useState<HTMLDivElement | null>(null)
  const [actionsSlot, setActionsSlot] = useState<HTMLDivElement | null>(null)
  const slots = useMemo(() => ({ title: titleSlot, actions: actionsSlot }), [titleSlot, actionsSlot])

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <AppSidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-14 shrink-0 items-center gap-4 border-b px-6">
          <div ref={setTitleSlot} className="min-w-0 flex-1" />
          <div ref={setActionsSlot} className="flex shrink-0 items-center gap-2" />
          <NotificationsBell />
        </header>
        <main className="flex-1 overflow-y-auto">
          <div className="p-6">
            <PageHeaderSlotsContext.Provider value={slots}>
              <Outlet />
            </PageHeaderSlotsContext.Provider>
          </div>
        </main>
      </div>
    </div>
  )
}
