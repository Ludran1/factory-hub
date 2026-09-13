import WhatsAppInbox from '@/components/marketing/WhatsAppInbox'

/**
 * Chat de WhatsApp como sección propia del sidebar y no como pestaña de Marketing.
 *
 * Es lo que tiene abierto todo el día quien atiende: necesita la pantalla casi
 * entera y estar a un clic desde cualquier parte. Las cotizaciones, en cambio,
 * siguen dentro de Marketing porque cuelgan de un lead y se usan pocas veces.
 */
export default function ChatPage() {
  return (
    <div className="space-y-4 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Chat</h1>
        <p className="text-sm text-muted-foreground">Conversaciones de WhatsApp del número de ventas</p>
      </div>
      <WhatsAppInbox className="h-[calc(100vh-11rem)] min-h-[560px]" />
    </div>
  )
}
