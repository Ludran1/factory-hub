import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { DollarSign, GripVertical } from 'lucide-react'
import { useUpdateLead } from '@/hooks/useLeads'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import type { LeadStage } from '@/types/database'

const STAGES: { key: LeadStage; label: string; color: string }[] = [
  { key: 'prospecto',   label: 'Prospecto',   color: 'border-t-slate-400' },
  { key: 'demo',        label: 'Demo',        color: 'border-t-blue-400' },
  { key: 'negociacion', label: 'Negociación', color: 'border-t-amber-400' },
  { key: 'cerrado',     label: 'Cerrado',     color: 'border-t-emerald-400' },
]

interface Lead {
  id: string
  company: string
  contact_name: string
  product: string
  value: number
  stage: string
  owner: { name: string } | null
}

interface Props {
  leads: Lead[]
  onLeadClick: (lead: Lead) => void
}

export default function LeadKanban({ leads, onLeadClick }: Props) {
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const [dragOverStage, setDragOverStage] = useState<string | null>(null)
  const updateLead = useUpdateLead()

  const leadsInStage = (stage: LeadStage) => leads.filter(l => l.stage === stage)
  const stageTotal = (stage: LeadStage) => leadsInStage(stage).reduce((s, l) => s + l.value, 0)

  const handleDrop = async (stage: LeadStage) => {
    if (!draggedId) return
    const lead = leads.find(l => l.id === draggedId)
    if (!lead || lead.stage === stage) {
      setDraggedId(null)
      setDragOverStage(null)
      return
    }
    try {
      await updateLead.mutateAsync({ id: draggedId, stage })
    } catch {
      toast.error('Error al mover el lead')
    } finally {
      setDraggedId(null)
      setDragOverStage(null)
    }
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
      {STAGES.map(stage => {
        const stageLeads = leadsInStage(stage.key)
        const total = stageTotal(stage.key)
        const isOver = dragOverStage === stage.key

        return (
          <div
            key={stage.key}
            className={cn(
              'flex flex-col rounded-xl border-t-2 border border-border bg-muted/20 p-3 min-h-[400px] transition-colors',
              stage.color,
              isOver && 'bg-primary/5 border-primary/30'
            )}
            onDragOver={e => { e.preventDefault(); setDragOverStage(stage.key) }}
            onDragLeave={() => setDragOverStage(null)}
            onDrop={() => handleDrop(stage.key)}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold">{stage.label}</h3>
                <span className="text-xs text-muted-foreground bg-muted rounded-full px-1.5 py-0.5">
                  {stageLeads.length}
                </span>
              </div>
              <div className="flex items-center gap-0.5 text-xs text-muted-foreground font-medium">
                <DollarSign className="h-3 w-3" />
                {total >= 1000 ? `${(total / 1000).toFixed(0)}k` : total}
              </div>
            </div>

            {/* Cards */}
            <div className="flex flex-col gap-2 flex-1">
              {stageLeads.map(lead => (
                <Card
                  key={lead.id}
                  draggable
                  onDragStart={() => setDraggedId(lead.id)}
                  onDragEnd={() => { setDraggedId(null); setDragOverStage(null) }}
                  onClick={() => onLeadClick(lead)}
                  className={cn(
                    'cursor-pointer hover:ring-1 hover:ring-primary/40 transition-all',
                    draggedId === lead.id && 'opacity-40'
                  )}
                >
                  <CardContent className="p-3 space-y-2">
                    <div className="flex items-start gap-2">
                      <GripVertical className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5 cursor-grab" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{lead.company}</p>
                        <p className="text-xs text-muted-foreground truncate">{lead.contact_name}</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between pl-6">
                      <Badge variant="outline" className="text-xs py-0">{lead.product}</Badge>
                      <span className="text-xs font-semibold text-primary">
                        ${lead.value.toLocaleString()}
                      </span>
                    </div>
                    {lead.owner && (
                      <div className="flex items-center gap-1.5 pl-6">
                        <Avatar className="h-4 w-4">
                          <AvatarFallback className="text-[9px]">{lead.owner.name.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <span className="text-[10px] text-muted-foreground">{lead.owner.name}</span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
              {stageLeads.length === 0 && (
                <div className={cn(
                  'flex-1 flex items-center justify-center border-2 border-dashed border-border rounded-lg min-h-[60px] transition-colors',
                  isOver && 'border-primary/40 bg-primary/5'
                )}>
                  <p className="text-xs text-muted-foreground">Soltar aqui</p>
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
