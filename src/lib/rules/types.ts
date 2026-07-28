export type Side = 'left' | 'right'

/** Articulaciones que puede referenciar una regla, sin fijar el lado (se resuelve en tiempo de evaluación). */
export type JointRole =
  | 'shoulder'
  | 'elbow'
  | 'wrist'
  | 'hip'
  | 'knee'
  | 'ankle'
  | 'footIndex'

export interface Violation {
  id: string
  message: string
}

/**
 * Resultado de evaluar un frame. `visible: false` significa que ningún lado
 * del cuerpo se ve con suficiente fiabilidad (encuadre malo, persona fuera de
 * plano o no de perfil): en ese caso NO se ha evaluado ninguna regla y
 * `violations` viene vacío, en lugar de dar avisos calculados sobre landmarks
 * poco fiables.
 */
export interface FrameResult {
  visible: boolean
  violations: Violation[]
}

interface BaseCheck {
  id: string
  message: string
  /** A mayor número, más prioridad para mostrarse cuando hay varios avisos a la vez (mayor riesgo de lesión primero). */
  priority: number
}

/** Ángulo articular de 3 puntos que debe mantenerse en rango durante todo el movimiento. */
export interface InstantAngleCheck extends BaseCheck {
  kind: 'instantAngle'
  points: [JointRole, JointRole, JointRole] // [a, vertex, c]
  min: number
  max: number
}

/** Ángulo de un segmento de 2 puntos respecto a la vertical, en rango durante todo el movimiento. */
export interface InstantVerticalAngleCheck extends BaseCheck {
  kind: 'instantVerticalAngle'
  points: [JointRole, JointRole] // [arriba, abajo]
  min: number
  max: number
}

/**
 * Ángulo articular de 3 puntos que solo se evalúa en el punto más bajo de
 * cada repetición (mínimo local). Avisa si ese mínimo no baja lo suficiente
 * (queda por encima de maxAngleAtBottom).
 */
export interface DepthMinCheck extends BaseCheck {
  kind: 'depthMin'
  points: [JointRole, JointRole, JointRole] // [a, vertex, c]
  maxAngleAtBottom: number
}

/** La rodilla no debe adelantarse a la punta del pie más de una fracción de la longitud del pie. */
export interface KneeOverToeCheck extends BaseCheck {
  kind: 'kneeOverToe'
  maxRatio: number
}

export type ExerciseCheck =
  | InstantAngleCheck
  | InstantVerticalAngleCheck
  | DepthMinCheck
  | KneeOverToeCheck

export interface ExerciseConfig {
  id: string
  label: string
  checks: ExerciseCheck[]
}
