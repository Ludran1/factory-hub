import { useAuth } from '@/hooks/useAuth'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Construction } from 'lucide-react'

export default function DashboardPage() {
  const { profile, role } = useAuth()

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Bienvenido, {profile?.name ?? 'usuario'} 👋
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Panel principal de Factory Hub
        </p>
      </div>

      <div className="flex items-center gap-2">
        <Badge variant="outline">
          {role === 'admin' && 'Administrador'}
          {role === 'developer' && 'Developer'}
          {role === 'support' && 'Soporte'}
          {role === 'closer' && 'Closer B2B'}
          {role === 'marketing' && 'Marketing'}
        </Badge>
        <span className="text-xs text-muted-foreground">Sesion activa</span>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Construction className="h-4 w-4 text-primary" />
            Dashboard en construccion
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Las metricas personalizadas por rol se iran agregando con cada modulo.
            La autenticacion y el sistema de roles esta funcionando correctamente.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
