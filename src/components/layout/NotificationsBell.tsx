import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'
import { Bell, CheckCheck } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { useNotifications, useMarkNotificationsRead } from '@/hooks/useNotifications'

export default function NotificationsBell() {
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()
  const { data: notifications = [] } = useNotifications()
  const markRead = useMarkNotificationsRead()

  const unread = notifications.filter(n => !n.read)

  const handleClick = (id: string, read: boolean, link: string | null) => {
    if (!read) markRead.mutate({ ids: [id] })
    setOpen(false)
    if (link) navigate(link)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-9 w-9" title="Notificaciones">
          <Bell className="h-4 w-4" />
          {unread.length > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-destructive-foreground">
              {unread.length > 9 ? '9+' : unread.length}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <p className="text-sm font-semibold">Notificaciones</p>
          {unread.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1.5 text-xs text-muted-foreground"
              onClick={() => markRead.mutate({ ids: unread.map(n => n.id) })}
              disabled={markRead.isPending}
            >
              <CheckCheck className="h-3.5 w-3.5" /> Marcar leídas
            </Button>
          )}
        </div>
        <div className="max-h-80 overflow-y-auto">
          {notifications.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">
              No tienes notificaciones
            </p>
          ) : (
            notifications.map(n => (
              <button
                key={n.id}
                onClick={() => handleClick(n.id, n.read, n.link)}
                className={`flex w-full items-start gap-2.5 border-b px-3 py-2.5 text-left transition-colors last:border-b-0 hover:bg-muted/50 ${
                  n.read ? 'opacity-60' : ''
                }`}
              >
                <span
                  className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                    n.read ? 'bg-transparent' : 'bg-primary'
                  }`}
                />
                <span className="min-w-0">
                  <span className="block text-sm leading-snug">{n.message}</span>
                  <span className="block text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: es })}
                  </span>
                </span>
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
