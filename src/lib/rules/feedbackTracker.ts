import type { ExerciseCheck, ExerciseConfig, Violation } from './types'

export interface HistoryEntry {
  id: string
  message: string
  timestamp: number
}

export interface FeedbackState {
  active: Violation | null
  history: HistoryEntry[]
}

const MAX_HISTORY = 5
// Cuánto tiempo se mantiene visible un aviso puntual (ej. profundidad,
// detectada en un único frame) para que dé tiempo a leerlo.
const HOLD_MS = 1500

/**
 * Recibe los avisos de cada frame y decide qué mostrar: mantiene un aviso
 * visible durante HOLD_MS tras la última vez que se detectó, y elige el de
 * mayor prioridad si hay varios activos a la vez. Añade al historial cada
 * vez que un aviso pasa de inactivo a activo (no en cada frame que se repite).
 */
export function createFeedbackTracker(config: ExerciseConfig) {
  const checksById = new Map<string, ExerciseCheck>(
    config.checks.map((check) => [check.id, check]),
  )
  const activeUntil = new Map<string, number>()
  const history: HistoryEntry[] = []

  function update(violations: Violation[], now: number): FeedbackState {
    for (const violation of violations) {
      const wasActive = (activeUntil.get(violation.id) ?? 0) > now
      if (!wasActive) {
        history.unshift({ id: violation.id, message: violation.message, timestamp: now })
        history.length = Math.min(history.length, MAX_HISTORY)
      }
      activeUntil.set(violation.id, now + HOLD_MS)
    }

    let best: { id: string; priority: number } | null = null
    for (const [id, until] of activeUntil) {
      if (until <= now) continue
      const priority = checksById.get(id)?.priority ?? 0
      if (!best || priority > best.priority) {
        best = { id, priority }
      }
    }

    const active = best
      ? { id: best.id, message: checksById.get(best.id)!.message }
      : null

    return { active, history: [...history] }
  }

  return { update }
}
