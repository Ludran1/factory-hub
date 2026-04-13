import { useAuth } from '@/hooks/useAuth'
import DeveloperDashboard from '@/components/dashboard/DeveloperDashboard'
import SupportDashboard from '@/components/dashboard/SupportDashboard'
import CloserDashboard from '@/components/dashboard/CloserDashboard'
import MarketingDashboard from '@/components/dashboard/MarketingDashboard'
import AdminDashboard from '@/components/dashboard/AdminDashboard'

const greetings: Record<string, string> = {
  developer: 'Panel de Desarrollo',
  support: 'Panel de Soporte',
  closer: 'Panel de Ventas',
  marketing: 'Panel de Marketing',
  admin: 'Panel de Administración',
}

const subtitles: Record<string, string> = {
  developer: 'Tus tareas activas y objetivos del equipo',
  support: 'Estado de tickets y asignaciones',
  closer: 'Pipeline de ventas y actividad comercial',
  marketing: 'Métricas de leads y conversión',
  admin: 'Vista general del workspace',
}

export default function DashboardPage() {
  const { profile, role } = useAuth()
  const r = role ?? 'developer'

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          {greetings[r] ?? 'Dashboard'}
        </h1>
        <p className="text-sm text-muted-foreground">
          {profile?.name ? `Hola, ${profile.name.split(' ')[0]}. ` : ''}
          {subtitles[r] ?? ''}
        </p>
      </div>

      {r === 'developer' && <DeveloperDashboard />}
      {r === 'support' && <SupportDashboard />}
      {r === 'closer' && <CloserDashboard />}
      {r === 'marketing' && <MarketingDashboard />}
      {r === 'admin' && <AdminDashboard />}
    </div>
  )
}
