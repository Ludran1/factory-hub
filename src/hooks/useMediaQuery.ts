import { useCallback, useSyncExternalStore } from 'react'

/**
 * Si la pantalla cumple la media query, al día con los cambios de tamaño.
 *
 * useSyncExternalStore y no useState + useEffect: da el valor correcto desde el
 * primer render (sin un parpadeo con el valor equivocado) y no choca con la
 * regla react-hooks/set-state-in-effect.
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback((onChange: () => void) => {
    const mql = window.matchMedia(query)
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [query])

  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false,
  )
}

/** El breakpoint md de Tailwind: desde acá el layout es de escritorio. */
export const useIsDesktop = () => useMediaQuery('(min-width: 768px)')
