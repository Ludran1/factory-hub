import { useContext, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { PageHeaderSlotsContext } from './pageHeaderSlots'

interface Props {
  title: ReactNode
  subtitle?: ReactNode
  /** Botones de la sección. Van a la derecha de la barra, junto a la campanita. */
  actions?: ReactNode
}

/**
 * Título, subtítulo y acciones de una sección, dibujados en la barra superior.
 *
 * Antes cada página abría con su propio bloque de título y la barra de arriba
 * quedaba vacía salvo la campanita: se perdían unos 90 px de alto en todas las
 * secciones. Con un portal cada página sigue decidiendo su texto (el Dashboard
 * saluda por nombre) sin que el layout tenga que conocer las rutas.
 */
export default function PageHeader({ title, subtitle, actions }: Props) {
  const slots = useContext(PageHeaderSlotsContext)

  return (
    <>
      {slots.title && createPortal(
        <div className="min-w-0">
          <h1 className="text-xl font-bold tracking-tight leading-tight truncate">{title}</h1>
          {subtitle && <p className="text-xs text-muted-foreground truncate">{subtitle}</p>}
        </div>,
        slots.title,
      )}
      {actions && slots.actions && createPortal(actions, slots.actions)}
    </>
  )
}
