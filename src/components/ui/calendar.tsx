import { DayPicker } from 'react-day-picker'
import { es } from 'react-day-picker/locale'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

export type CalendarProps = React.ComponentProps<typeof DayPicker>

export function Calendar({ className, classNames, showOutsideDays = true, ...props }: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      locale={es}
      className={cn('p-3', className)}
      classNames={{
        months: 'flex flex-col sm:flex-row gap-2',
        month: 'flex flex-col gap-4',
        month_caption: 'flex justify-center pt-1 relative items-center h-9',
        caption_label: 'text-sm font-medium capitalize',
        nav: 'flex items-center gap-1 absolute inset-x-0 top-1 justify-between px-1',
        button_previous:
          'inline-flex items-center justify-center h-7 w-7 rounded-md border border-input bg-transparent hover:bg-accent hover:text-accent-foreground disabled:opacity-40',
        button_next:
          'inline-flex items-center justify-center h-7 w-7 rounded-md border border-input bg-transparent hover:bg-accent hover:text-accent-foreground disabled:opacity-40',
        month_grid: 'w-full border-collapse space-y-1',
        weekdays: 'flex',
        weekday: 'text-muted-foreground rounded-md w-9 font-normal text-[0.8rem] capitalize',
        week: 'flex w-full mt-2',
        day: 'h-9 w-9 text-center text-sm p-0 relative [&:has([aria-selected])]:bg-accent [&:has([aria-selected])]:rounded-md',
        day_button:
          'inline-flex items-center justify-center h-9 w-9 rounded-md p-0 font-normal hover:bg-accent hover:text-accent-foreground aria-selected:bg-primary aria-selected:text-primary-foreground aria-selected:hover:bg-primary',
        today: 'bg-accent text-accent-foreground rounded-md',
        outside: 'text-muted-foreground opacity-50',
        disabled: 'text-muted-foreground opacity-50',
        hidden: 'invisible',
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation, ...rest }) =>
          orientation === 'left'
            ? <ChevronLeft className="h-4 w-4" {...rest} />
            : <ChevronRight className="h-4 w-4" {...rest} />,
      }}
      {...props}
    />
  )
}
