import type { Point2D } from './point'

function angleBetweenVectors(v1: Point2D, v2: Point2D): number {
  const dot = v1.x * v2.x + v1.y * v2.y
  const det = v1.x * v2.y - v1.y * v2.x
  return Math.abs(Math.atan2(det, dot)) * (180 / Math.PI)
}

/**
 * Ángulo articular (en grados, 0°-180°) formado en `vertex` por los puntos
 * `a` y `c`. Ej.: angleBetweenPoints(cadera, rodilla, tobillo) da el ángulo
 * de la rodilla. 180° = pierna/brazo totalmente extendido.
 */
export function angleBetweenPoints(a: Point2D, vertex: Point2D, c: Point2D): number {
  const v1: Point2D = { x: a.x - vertex.x, y: a.y - vertex.y }
  const v2: Point2D = { x: c.x - vertex.x, y: c.y - vertex.y }
  return angleBetweenVectors(v1, v2)
}

/**
 * Ángulo (en grados, 0°-180°) del segmento `top`→`bottom` respecto al eje
 * vertical de la imagen. 0° = segmento perfectamente vertical. Se usa para
 * medir la inclinación del tronco (hombro→cadera) en la sentadilla.
 */
export function angleFromVertical(top: Point2D, bottom: Point2D): number {
  const segment: Point2D = { x: bottom.x - top.x, y: bottom.y - top.y }
  const vertical: Point2D = { x: 0, y: 1 }
  return angleBetweenVectors(segment, vertical)
}
