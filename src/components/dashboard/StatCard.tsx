import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface StatCardProps {
  label: string
  value: string | number
  sub?: string
  icon: React.ReactNode
  color?: 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'blue'
}

const colorMap = {
  default: 'bg-muted text-muted-foreground',
  primary: 'bg-primary/10 text-primary',
  success: 'bg-emerald-500/10 text-emerald-500',
  warning: 'bg-amber-500/10 text-amber-500',
  danger:  'bg-red-500/10 text-red-500',
  blue:    'bg-blue-500/10 text-blue-500',
}

const valueColorMap = {
  default: '',
  primary: 'text-primary',
  success: 'text-emerald-500',
  warning: 'text-amber-500',
  danger:  'text-red-500',
  blue:    'text-blue-500',
}

export default function StatCard({ label, value, sub, icon, color = 'default' }: StatCardProps) {
  return (
    <Card className="py-0">
      <CardContent className="p-4 flex items-center gap-3">
        <div className={cn('h-10 w-10 rounded-xl flex items-center justify-center shrink-0', colorMap[color])}>
          {icon}
        </div>
        <div className="min-w-0">
          <p className={cn('text-2xl font-bold tabular-nums', valueColorMap[color])}>{value}</p>
          <p className="text-xs text-muted-foreground truncate">{label}</p>
          {sub && <p className="text-[10px] text-muted-foreground/60 truncate">{sub}</p>}
        </div>
      </CardContent>
    </Card>
  )
}
