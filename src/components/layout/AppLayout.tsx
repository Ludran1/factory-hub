import { useMemo, useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Menu } from 'lucide-react'
import AppSidebar from './AppSidebar'
import NotificationsBell from './NotificationsBell'
import { PageHeaderSlotsContext } from './pageHeaderSlots'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'

export default function AppLayout() {
  // La barra superior ofrece dos huecos que cada sección llena con PageHeader.
  // Callback refs y no useEffect: los nodos existen recién al montar, y guardar
  // el nodo desde el ref no es un setState dentro de un efecto.
  const [titleSlot, setTitleSlot] = useState<HTMLDivElement | null>(null)
  const [actionsSlot, setActionsSlot] = useState<HTMLDivElement | null>(null)
  const slots = useMemo(() => ({ title: titleSlot, actions: actionsSlot }), [titleSlot, actionsSlot])
  const [menuAbierto, setMenuAbierto] = useState(false)

  return (
    // h-dvh y no h-screen: en el celular 100vh incluye la barra de direcciones del
    // navegador y lo último de cada pantalla quedaba escondido detrás.
    <div className="flex h-dvh overflow-hidden bg-background">
      {/* Sidebar fijo solo desde md. En el celular ocupaba un ancho fijo aunque
          estuviera colapsado; ahí va en un cajón que se abre con el botón de menú. */}
      <div className="hidden md:flex">
        <AppSidebar />
      </div>
      <Sheet open={menuAbierto} onOpenChange={setMenuAbierto}>
        <SheetContent
          side="left"
          className="w-72 max-w-[85vw] border-sidebar-border bg-sidebar p-0 text-sidebar-foreground"
        >
          <SheetTitle className="sr-only">Menú</SheetTitle>
          <AppSidebar variant="mobile" onNavigate={() => setMenuAbierto(false)} />
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* En el celular las acciones de la sección bajan a una segunda fila con
            scroll horizontal (order-last + basis-full). Desde md van en la misma
            fila, antes de la campanita. Si la sección no tiene acciones, el hueco
            vacío no ocupa lugar (empty:hidden). */}
        <header className="flex min-h-14 shrink-0 flex-wrap items-center gap-x-3 gap-y-2 border-b px-4 py-2 md:h-14 md:flex-nowrap md:gap-4 md:px-6 md:py-0">
          <Button
            variant="ghost"
            size="icon"
            className="-ml-2 h-9 w-9 shrink-0 md:hidden"
            onClick={() => setMenuAbierto(true)}
            aria-label="Abrir menú"
          >
            <Menu className="h-5 w-5" />
          </Button>
          <div ref={setTitleSlot} className="min-w-0 flex-1" />
          <div
            ref={setActionsSlot}
            className="order-last flex basis-full items-center gap-2 overflow-x-auto empty:hidden md:order-none md:basis-auto md:shrink-0 md:overflow-visible"
          />
          <NotificationsBell />
        </header>
        <main className="flex-1 overflow-y-auto">
          <div className="p-4 md:p-6">
            <PageHeaderSlotsContext.Provider value={slots}>
              <Outlet />
            </PageHeaderSlotsContext.Provider>
          </div>
        </main>
      </div>
    </div>
  )
}
