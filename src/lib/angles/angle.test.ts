import { describe, expect, it } from 'vitest'
import { angleBetweenPoints, angleFromVertical } from './angle'

describe('angleBetweenPoints', () => {
  it('devuelve 180° para una articulación totalmente extendida', () => {
    const a = { x: 0, y: 0 }
    const vertex = { x: 1, y: 0 }
    const c = { x: 2, y: 0 }
    expect(angleBetweenPoints(a, vertex, c)).toBeCloseTo(180)
  })

  it('devuelve 90° para un ángulo recto', () => {
    const a = { x: 0, y: 0 }
    const vertex = { x: 0, y: 1 }
    const c = { x: 1, y: 1 }
    expect(angleBetweenPoints(a, vertex, c)).toBeCloseTo(90)
  })

  it('devuelve 60° para un triángulo equilátero', () => {
    const vertex = { x: 0, y: 0 }
    const a = { x: 1, y: 0 }
    const c = { x: 0.5, y: Math.sqrt(3) / 2 }
    expect(angleBetweenPoints(a, vertex, c)).toBeCloseTo(60)
  })

  it('es simétrico: no importa el orden de a y c', () => {
    const a = { x: 1, y: 0.3 }
    const vertex = { x: 0.5, y: 0.5 }
    const c = { x: 0.2, y: 0.9 }
    expect(angleBetweenPoints(a, vertex, c)).toBeCloseTo(
      angleBetweenPoints(c, vertex, a),
    )
  })
})

describe('angleFromVertical', () => {
  it('devuelve 0° para un segmento perfectamente vertical', () => {
    const top = { x: 0, y: 0 }
    const bottom = { x: 0, y: 1 }
    expect(angleFromVertical(top, bottom)).toBeCloseTo(0)
  })

  it('devuelve 90° para un segmento horizontal', () => {
    const top = { x: 0, y: 0 }
    const bottom = { x: 1, y: 0 }
    expect(angleFromVertical(top, bottom)).toBeCloseTo(90)
  })

  it('devuelve 45° para una inclinación de 45°', () => {
    const top = { x: 0, y: 0 }
    const bottom = { x: 1, y: 1 }
    expect(angleFromVertical(top, bottom)).toBeCloseTo(45)
  })
})
