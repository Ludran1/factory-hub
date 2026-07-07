import { format, parse, isValid } from 'date-fns'
import { es } from 'date-fns/locale'
import { CalendarIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'

interface Props {
  /** Valor almacenado en formato ISO `yyyy-MM-dd` (o vacío) */
  value?: string
  /** Devuelve la fecha elegida en formato ISO `yyyy-MM-dd` */
  onChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
  className?: string
}

// Parsea `yyyy-MM-dd` como fecha local (sin corrimiento de zona horaria)
function toDate(value?: string): Date | undefined {
  if (!value) return undefined
  const d = parse(value, 'yyyy-MM-dd', new Date())
  return isValid(d) ? d : undefined
}

export function DatePicker({ value, onChange, placeholder = 'dd/mm/aaaa', disabled, className }: Props) {
  const selected = toDate(value)

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          className={cn(
            'w-full justify-start gap-2 font-normal',
            !selected && 'text-muted-foreground',
            className
          )}
        >
          <CalendarIcon className="h-4 w-4 shrink-0 opacity-70" />
          {selected ? format(selected, 'dd/MM/yyyy', { locale: es }) : <span>{placeholder}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start">
        <Calendar
          mode="single"
          selected={selected}
          defaultMonth={selected}
          onSelect={d => onChange(d ? format(d, 'yyyy-MM-dd') : '')}
        />
      </PopoverContent>
    </Popover>
  )
}
