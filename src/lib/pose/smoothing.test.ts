import { describe, expect, it } from 'vitest'
import { createLandmarkSmoother } from './smoothing'
import type { PoseLandmarks } from './types'

function frameAt(x: number): PoseLandmarks {
  return Array.from({ length: 33 }, () => ({ x, y: 0, z: 0, visibility: 1 }))
}

describe('createLandmarkSmoother', () => {
  it('devuelve el primer frame sin cambios (no hay historial previo)', () => {
    const smoother = createLandmarkSmoother(0.4)
    const result = smoother.smooth(frameAt(1))
    expect(result[0].x).toBe(1)
  })

  it('amortigua un salto brusco en vez de seguirlo al instante', () => {
    const smoother = createLandmarkSmoother(0.4)
    smoother.smooth(frameAt(0))
    const result = smoother.smooth(frameAt(1))
    // alpha=0.4 -> se mueve un 40% hacia el nuevo valor, no el 100%.
    expect(result[0].x).toBeCloseTo(0.4)
  })

  it('converge hacia un valor estable si se repite varias veces', () => {
    const smoother = createLandmarkSmoother(0.4)
    smoother.smooth(frameAt(0))
    let result = frameAt(0)
    for (let i = 0; i < 20; i++) {
      result = smoother.smooth(frameAt(1))
    }
    expect(result[0].x).toBeCloseTo(1, 2)
  })
})
