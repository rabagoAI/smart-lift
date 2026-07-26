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

/** Diferencia entre el mismo ángulo de 3 puntos calculado en el lado izquierdo y el derecho. */
export interface SymmetryCheck extends BaseCheck {
  kind: 'symmetry'
  points: [JointRole, JointRole, JointRole] // [a, vertex, c]
  maxDifference: number
}

export type ExerciseCheck =
  | InstantAngleCheck
  | InstantVerticalAngleCheck
  | DepthMinCheck
  | KneeOverToeCheck
  | SymmetryCheck

export interface ExerciseConfig {
  id: string
  label: string
  checks: ExerciseCheck[]
}
