import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Code2, Users, Megaphone, LifeBuoy,
  ChevronLeft, ChevronRight, LogOut, Moon, Sun, Factory
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import type { UserRole } from '@/types/database'
import { toast } from 'sonner'

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard', roles: ['admin', 'developer', 'support', 'closer', 'marketing'] },
  { to: '/desarrollo', icon: Code2, label: 'Desarrollo', roles: ['admin', 'developer'] },
  { to: '/colaboracion', icon: Users, label: 'Colaboracion', roles: ['admin', 'developer', 'support', 'closer', 'marketing'] },
  { to: '/marketing', icon: Megaphone, label: 'Marketing / CRM', roles: ['admin', 'closer', 'marketing'] },
  { to: '/soporte', icon: LifeBuoy, label: 'Soporte', roles: ['admin', 'support'] },
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

export default function AppSidebar() {
  const [collapsed, setCollapsed] = useState(false)
  const [dark, setDark] = useState(false)
  const { profile, role } = useAuth()
  const navigate = useNavigate()

  const visibleItems = navItems.filter(item =>
    role && (item.roles as readonly string[]).includes(role)
  )

  const toggleDark = () => {
    document.documentElement.classList.toggle('dark')
    setDark(d => !d)
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    toast.success('Sesion cerrada')
    navigate('/login')
  }

  return (
    <aside
      className={cn(
        'relative flex flex-col h-screen bg-sidebar border-r border-sidebar-border transition-all duration-300',
        collapsed ? 'w-16' : 'w-60'
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
      <nav className="flex-1 px-2 py-4 space-y-1">
        {visibleItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
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

      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed(c => !c)}
        className="absolute -right-3 top-[72px] flex h-6 w-6 items-center justify-center rounded-full border border-sidebar-border bg-sidebar text-sidebar-foreground/50 hover:text-sidebar-foreground transition-colors"
      >
        {collapsed
          ? <ChevronRight className="h-3 w-3" />
          : <ChevronLeft className="h-3 w-3" />
        }
      </button>
    </aside>
  )
}
