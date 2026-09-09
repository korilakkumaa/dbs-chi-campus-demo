import { useCallback, useEffect } from 'react'
import { useBlocker } from 'react-router-dom'

/**
 * Warn on browser close/refresh and block in-app navigation while `dirty`.
 * Caller should confirm via dialog when `blocker.state === 'blocked'`.
 */
export function useDirtyNavigationGuard(dirty: boolean) {
  const blocker = useBlocker(dirty)

  useEffect(() => {
    if (!dirty) return
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [dirty])

  const confirmNavigation = useCallback(() => {
    if (blocker.state === 'blocked') blocker.proceed()
  }, [blocker])

  const cancelNavigation = useCallback(() => {
    if (blocker.state === 'blocked') blocker.reset()
  }, [blocker])

  return {
    navigationBlocked: blocker.state === 'blocked',
    confirmNavigation,
    cancelNavigation,
  }
}
