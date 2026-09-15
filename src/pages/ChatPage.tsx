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
      {/* En el celular la bandeja va de borde a borde: -m-4 anula el padding del
          layout y la tarjeta pierde borde y esquinas. Alto: la pantalla menos la
          barra superior (3.5rem). Desde md vuelve a ser tarjeta con margen. */}
      <WhatsAppInbox
        cardClassName="-m-4 rounded-none border-0 shadow-none md:m-0 md:rounded-xl md:border md:shadow-sm"
        className="h-[calc(100dvh-3.5rem)] md:h-[calc(100dvh-7rem)] md:min-h-[560px]"
      />
    </div>
  )
}
