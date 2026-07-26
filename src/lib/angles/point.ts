import type { PoseLandmark } from '../pose/types'

/** Punto 2D (coordenadas normalizadas 0-1, igual que los landmarks de MediaPipe). */
export interface Point2D {
  x: number
  y: number
}

/**
 * Extrae x/y de un landmark, descartando Z. La profundidad que da MediaPipe
 * es poco fiable para calcular ángulos en 2D desde una sola cámara de perfil.
 */
export function toPoint(landmark: PoseLandmark): Point2D {
  return { x: landmark.x, y: landmark.y }
}
