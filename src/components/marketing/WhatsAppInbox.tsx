import { Card, CardContent } from '@/components/ui/card'
import { Loader2, MessageCircleWarning } from 'lucide-react'
import { useInboxEmbed } from '@/hooks/useInboxEmbed'
import { cn } from '@/lib/utils'

interface Props {
  /** Alto del iframe. La página de Chat le da casi toda la pantalla. */
  className?: string
  /** Clases de la tarjeta. En el celular la página la saca de borde a borde. */
  cardClassName?: string
}

/**
 * La bandeja de WhatsApp de Kapso.
 *
 * No es un chat propio: es el inbox de Kapso en un iframe, en español y en tiempo
 * real. Responder, ver adjuntos y el historial lo resuelve Kapso; acá solo se
 * muestra. El URL (con su token) se pide recién cuando este componente se monta.
 */
export default function WhatsAppInbox({ className, cardClassName }: Props) {
  const { data: url, isLoading, error } = useInboxEmbed(true)

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-20">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    )
  }

  if (error || !url) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center gap-2 py-16 text-center">
          <MessageCircleWarning className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm font-medium">No se pudo abrir la bandeja de WhatsApp</p>
          <p className="text-xs text-muted-foreground max-w-md">
            {error instanceof Error ? error.message : 'Intenta de nuevo en un momento.'}
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={cn('overflow-hidden py-0', cardClassName)}>
      <iframe
        src={url}
        title="Bandeja de WhatsApp"
        className={cn('w-full border-0 block', className ?? 'h-[calc(100vh-22rem)] min-h-[560px]')}
        allow="clipboard-read; clipboard-write"
      />
    </Card>
  )
}
