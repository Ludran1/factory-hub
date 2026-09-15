import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Code2, Users, Megaphone, MessageCircle, LifeBuoy, UserCog,
  ChevronLeft, ChevronRight, LogOut, Moon, Sun, Factory
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { useTheme } from '@/hooks/useTheme'
import { useAuthStore } from '@/store/auth'
import type { UserRole } from '@/types/database'
import { toast } from 'sonner'

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard', module: 'dashboard' },
  { to: '/desarrollo', icon: Code2, label: 'Desarrollo', module: 'desarrollo' },
  { to: '/colaboracion', icon: Users, label: 'Colaboracion', module: 'colaboracion' },
  { to: '/marketing', icon: Megaphone, label: 'Marketing / CRM', module: 'marketing' },
  // Mismo módulo que Marketing: el chat muestra a los mismos clientes, nadie tiene
  // que reconfigurar permisos, y es lo que valida la función kapso-inbox-embed.
  { to: '/chat', icon: MessageCircle, label: 'Chat', module: 'marketing' },
  { to: '/soporte', icon: LifeBuoy, label: 'Soporte', module: 'soporte' },
  { to: '/usuarios', icon: UserCog, label: 'Usuarios', module: 'usuarios' },
] as const

const roleLabels: Record<UserRole, string> = {
  admin: 'Admin',
  developer: 'Developer',
  support: 'Soporte',
  closer: 'Closer B2B',
  marketing: 'Marketing',
}

const roleColors: Record<UserRole, string> = {
  admin: 'text-purple-400',
  developer: 'text-blue-400',
  support: 'text-amber-400',
  closer: 'text-emerald-400',
  marketing: 'text-pink-400',
}

interface Props {
  /**
   * 'mobile': dentro del cajón que se abre en el celular. Siempre expandido (no
   * tiene sentido colapsar un menú que ya está oculto) y cierra el cajón al navegar.
   */
  variant?: 'desktop' | 'mobile'
  onNavigate?: () => void
}

export default function AppSidebar({ variant = 'desktop', onNavigate }: Props) {
  const [collapsedState, setCollapsed] = useState(false)
  const mobile = variant === 'mobile'
  const collapsed = !mobile && collapsedState
  const { theme, toggle: toggleDark } = useTheme()
  const dark = theme === 'dark'
  const { profile, role } = useAuth()
  const navigate = useNavigate()

  const modules = profile?.allowed_modules
  const hasModuleConfig = modules && modules.length > 0
  const visibleItems = navItems.filter(item =>
    // Admin always sees everything; if no modules configured, show all; otherwise filter
    role === 'admin' || !hasModuleConfig || modules.includes(item.module)
  )

  const handleLogout = () => {
    onNavigate?.()
    supabase.auth.signOut()
    useAuthStore.getState().reset()
    navigate('/login')
  }

  return (
    <aside
      className={cn(
        'relative flex flex-col bg-sidebar transition-all duration-300',
        mobile
          ? 'h-full w-full'
          : cn('h-dvh border-r border-sidebar-border', collapsed ? 'w-16' : 'w-60')
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-5 min-h-[64px]">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary">
          <Factory className="h-4 w-4 text-primary-foreground" />
        </div>
        {!collapsed && (
          <div className="overflow-hidden">
            <p className="text-sm font-semibold text-sidebar-foreground truncate">Factory Hub</p>
            <p className="text-xs text-sidebar-foreground/50 truncate">iurAgency</p>
          </div>
        )}
      </div>

      <Separator className="bg-sidebar-border" />

      {/* Nav */}
      <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
        {visibleItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground',
                isActive && 'bg-sidebar-accent text-sidebar-foreground',
                collapsed && 'justify-center px-2'
              )
            }
          >
            <Icon className="h-4 w-4 shrink-0" />
            {!collapsed && <span className="truncate">{label}</span>}
          </NavLink>
        ))}
      </nav>

      <Separator className="bg-sidebar-border" />

      {/* Footer */}
      <div className="px-2 py-4 space-y-1">
        {/* Dark mode toggle */}
        <Button
          variant="ghost"
          size="sm"
          onClick={toggleDark}
          className={cn(
            'w-full text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground',
            collapsed ? 'justify-center px-2' : 'justify-start gap-3'
          )}
        >
          {dark ? <Sun className="h-4 w-4 shrink-0" /> : <Moon className="h-4 w-4 shrink-0" />}
          {!collapsed && <span className="text-sm">Tema</span>}
        </Button>

        {/* User profile */}
        {!collapsed && profile && (
          <div className="px-3 py-2">
            <p className="text-xs font-medium text-sidebar-foreground truncate">{profile.name}</p>
            <p className={cn('text-xs', role ? roleColors[role] : 'text-sidebar-foreground/50')}>
              {role ? roleLabels[role] : ''}
            </p>
          </div>
        )}

        {/* Logout */}
        <Button
          variant="ghost"
          size="sm"
          onClick={handleLogout}
          className={cn(
            'w-full text-sidebar-foreground/70 hover:bg-destructive/20 hover:text-destructive',
            collapsed ? 'justify-center px-2' : 'justify-start gap-3'
          )}
        >
          <LogOut className="h-4 w-4 shrink-0" />
          {!collapsed && <span className="text-sm">Salir</span>}
        </Button>
      </div>

      {/* Collapse toggle — solo en escritorio */}
      {!mobile && (
        <button
          onClick={() => setCollapsed(c => !c)}
          className="absolute -right-3 top-[72px] flex h-6 w-6 items-center justify-center rounded-full border border-sidebar-border bg-sidebar text-sidebar-foreground/50 hover:text-sidebar-foreground transition-colors"
        >
          {collapsed
            ? <ChevronRight className="h-3 w-3" />
            : <ChevronLeft className="h-3 w-3" />
          }
        </button>
      )}
    </aside>
  )
}
