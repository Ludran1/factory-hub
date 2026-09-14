import WhatsAppInbox from '@/components/marketing/WhatsAppInbox'
import PageHeader from '@/components/layout/PageHeader'

/**
 * Chat de WhatsApp como sección propia del sidebar y no como pestaña de Marketing.
 *
 * Es lo que tiene abierto todo el día quien atiende: necesita la pantalla casi
 * entera y estar a un clic desde cualquier parte. Las cotizaciones, en cambio,
 * siguen dentro de Marketing porque cuelgan de un lead y se usan pocas veces.
 */
export default function ChatPage() {
  return (
    <div className="animate-fade-in">
      <PageHeader title="Chat" subtitle="Conversaciones de WhatsApp del número de ventas" />
      {/* 7rem = barra superior (3.5rem) + padding del layout arriba y abajo (3rem) + margen */}
      <WhatsAppInbox className="h-[calc(100vh-7rem)] min-h-[560px]" />
    </div>
  )
}
