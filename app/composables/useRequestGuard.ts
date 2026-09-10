import { onScopeDispose } from 'vue'

/** Invalidates results after a newer request, a context change, or unmount. */
export function useRequestGuard() {
  let revision = 0
  let disposed = false
  const invalidate = () => {
    revision++
  }
  onScopeDispose(() => {
    disposed = true
    invalidate()
  })
  return {
    invalidate,
    begin() {
      const current = ++revision
      return () => !disposed && current === revision
    }
  }
}
