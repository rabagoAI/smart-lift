import { describe, expect, it } from 'vitest'
import { createFeedbackTracker } from './feedbackTracker'
import type { ExerciseConfig } from './types'

const config: ExerciseConfig = {
  id: 'test',
  label: 'Test',
  checks: [
    { kind: 'instantAngle', id: 'low', points: ['hip', 'knee', 'ankle'], min: 0, max: 10, message: 'low prio', priority: 1 },
    { kind: 'instantAngle', id: 'high', points: ['hip', 'knee', 'ankle'], min: 0, max: 10, message: 'high prio', priority: 3 },
  ],
}

describe('createFeedbackTracker', () => {
  it('no muestra nada activo si no hay violaciones', () => {
    const tracker = createFeedbackTracker(config)
    const state = tracker.update([], 0)
    expect(state.active).toBeNull()
    expect(state.history).toHaveLength(0)
  })

  it('elige el aviso de mayor prioridad cuando hay varios a la vez', () => {
    const tracker = createFeedbackTracker(config)
    const state = tracker.update(
      [
        { id: 'low', message: 'low prio' },
        { id: 'high', message: 'high prio' },
      ],
      0,
    )
    expect(state.active?.id).toBe('high')
  })

  it('mantiene el aviso visible durante el tiempo de hold tras dejar de detectarse', () => {
    const tracker = createFeedbackTracker(config)
    tracker.update([{ id: 'low', message: 'low prio' }], 0)
    const stillActive = tracker.update([], 1000) // dentro del hold (1500ms)
    expect(stillActive.active?.id).toBe('low')
    const expired = tracker.update([], 2000) // fuera del hold
    expect(expired.active).toBeNull()
  })

  it('solo añade al historial cuando el aviso pasa de inactivo a activo', () => {
    const tracker = createFeedbackTracker(config)
    tracker.update([{ id: 'low', message: 'low prio' }], 0)
    tracker.update([{ id: 'low', message: 'low prio' }], 100)
    const state = tracker.update([{ id: 'low', message: 'low prio' }], 200)
    expect(state.history).toHaveLength(1)
  })

  it('limita el historial a 5 entradas, la más reciente primero', () => {
    const tracker = createFeedbackTracker(config)
    let state = tracker.update([], 0)
    const timestamps = [0, 2000, 4000, 6000, 8000, 10000]
    for (const t of timestamps) {
      state = tracker.update([{ id: 'low', message: `msg-${t}` }], t)
    }
    expect(state.history).toHaveLength(5)
    expect(state.history[0].message).toBe('msg-10000')
  })
})
