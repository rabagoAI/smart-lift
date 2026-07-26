import type { PoseLandmarks } from './types'

/**
 * Suaviza los landmarks frame a frame con una media móvil exponencial (EMA)
 * para reducir el ruido de cámara/modelo sin apenas retraso perceptible.
 * MediaPipe Tasks Vision no trae suavizado incorporado (a diferencia de la
 * API antigua, que tenía `smooth_landmarks=True` por defecto).
 *
 * `alpha` en (0,1]: más bajo = más suavizado pero más retraso; más alto =
 * sigue el movimiento real más rápido pero filtra menos ruido.
 */
export function createLandmarkSmoother(alpha = 0.4) {
  let previous: PoseLandmarks | null = null

  function smooth(current: PoseLandmarks): PoseLandmarks {
    if (!previous) {
      previous = current
      return current
    }

    const result = current.map((point, i) => {
      const prev = previous![i]
      return {
        x: prev.x + alpha * (point.x - prev.x),
        y: prev.y + alpha * (point.y - prev.y),
        z: prev.z + alpha * (point.z - prev.z),
        visibility: point.visibility,
      }
    })
    previous = result
    return result
  }

  return { smooth }
}
