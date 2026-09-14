import { createContext } from 'react'

/**
 * Dónde dibuja cada sección su título y sus acciones: en la barra superior del
 * layout, no dentro de la página. Lo provee AppLayout y lo consume PageHeader.
 *
 * Vive en su propio archivo porque un módulo que exporta componentes no puede
 * exportar también un contexto sin romper el fast refresh de Vite.
 */
export interface PageHeaderSlots {
  title: HTMLElement | null
  actions: HTMLElement | null
}

export const PageHeaderSlotsContext = createContext<PageHeaderSlots>({ title: null, actions: null })
