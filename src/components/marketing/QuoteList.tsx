import { useNavigate } from 'react-router-dom'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Loader2, FileText } from 'lucide-react'
import { useQuotes } from '@/hooks/useQuotes'
import { formatMoney, effectiveStatus, QUOTE_STATUS_CONFIG } from '@/lib/quotes'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { cn } from '@/lib/utils'
import type { Currency } from '@/types/database'

interface Props {
  status: string
  search: string
  ownerId?: string
}

export default function QuoteList({ status, search, ownerId }: Props) {
  const navigate = useNavigate()
  const { data: quotes = [], isLoading } = useQuotes({ status, search, ownerId })

  return (
    <Card>
      <CardContent className="p-0">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : quotes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-2">
            <FileText className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Sin cotizaciones todavía</p>
            <p className="text-xs text-muted-foreground">
              Se crean desde el panel de un lead
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Número</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead className="hidden md:table-cell">Título</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="hidden lg:table-cell">Válida hasta</TableHead>
                <TableHead className="hidden lg:table-cell">Closer</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {quotes.map(q => {
                const st = effectiveStatus(q)
                return (
                  <TableRow
                    key={q.id}
                    className="cursor-pointer"
                    onClick={() => navigate(`/marketing/cotizacion/${q.id}`)}
                  >
                    <TableCell className="font-medium text-sm tabular-nums">
                      {q.number}
                      {q.version > 1 && (
                        <span className="ml-1.5 text-[10px] text-muted-foreground">v{q.version}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">{q.client_company}</TableCell>
                    <TableCell className="hidden md:table-cell text-sm text-muted-foreground truncate max-w-[220px]">
                      {q.title}
                    </TableCell>
                    <TableCell className="text-right text-sm font-semibold tabular-nums">
                      {formatMoney(q.total, q.currency as Currency)}
                    </TableCell>
                    <TableCell>
                      <Badge className={cn('text-xs', QUOTE_STATUS_CONFIG[st].class)}>
                        {QUOTE_STATUS_CONFIG[st].label}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-xs text-muted-foreground">
                      {q.valid_until
                        ? format(parseISO(q.valid_until), 'd MMM yyyy', { locale: es })
                        : '—'}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-xs text-muted-foreground">
                      {(q.owner as unknown as { name: string } | null)?.name ?? '—'}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}
