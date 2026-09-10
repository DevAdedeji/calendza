import { effectScope } from 'vue'
import { describe, expect, it } from 'vitest'
import { useRequestGuard } from '@/composables/useRequestGuard'

describe('request ownership', () => {
  it('only accepts the latest request, invalidates context changes and stops on unmount', () => {
    const scope = effectScope()
    const guard = scope.run(useRequestGuard)!
    const first = guard.begin()
    const second = guard.begin()
    expect(first()).toBe(false)
    expect(second()).toBe(true)
    guard.invalidate()
    expect(second()).toBe(false)
    const last = guard.begin()
    scope.stop()
    expect(last()).toBe(false)
    expect(guard.begin()()).toBe(false)
  })
})
