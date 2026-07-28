import { angleBetweenPoints, angleFromVertical } from '../angles/angle'
import { toPoint, type Point2D } from '../angles/point'
import { LANDMARK, type LandmarkName, type PoseLandmarks } from '../pose/types'
import type {
  DepthMinCheck,
  ExerciseConfig,
  FrameResult,
  JointRole,
  Side,
  Violation,
} from './types'

const ROLE_TO_LANDMARK: Record<Side, Record<JointRole, LandmarkName>> = {
  left: {
    shoulder: 'leftShoulder',
    elbow: 'leftElbow',
    wrist: 'leftWrist',
    hip: 'leftHip',
    knee: 'leftKnee',
    ankle: 'leftAnkle',
    footIndex: 'leftFootIndex',
  },
  right: {
    shoulder: 'rightShoulder',
    elbow: 'rightElbow',
    wrist: 'rightWrist',
    hip: 'rightHip',
    knee: 'rightKnee',
    ankle: 'rightAnkle',
    footIndex: 'rightFootIndex',
  },
}

function point(landmarks: PoseLandmarks, side: Side, role: JointRole): Point2D {
  const name = ROLE_TO_LANDMARK[side][role]
  return toPoint(landmarks[LANDMARK[name]])
}

/**
 * Articulaciones que los checks de este ejercicio usan realmente. La
 * visibilidad se mide solo sobre estas: en press de banca, por ejemplo, la
 * rodilla y el tobillo no intervienen en ninguna regla, así que no deben
 * decidir qué lado se elige ni si la pose es fiable.
 */
function requiredRoles(config: ExerciseConfig): JointRole[] {
  const roles = new Set<JointRole>()
  for (const check of config.checks) {
    switch (check.kind) {
      case 'instantAngle':
      case 'instantVerticalAngle':
      case 'depthMin':
        for (const role of check.points) roles.add(role)
        break
      case 'kneeOverToe':
        // Único check que no declara points: usa siempre estos tres.
        roles.add('knee')
        roles.add('ankle')
        roles.add('footIndex')
        break
    }
  }
  return [...roles]
}

/**
 * Elige el lado (izq/dcha) mejor visto por la cámara según la visibility de
 * MediaPipe, y devuelve además su visibilidad media (0-1) sobre los roles
 * indicados, para poder descartar el frame si ni el mejor lado es fiable.
 */
function pickSide(
  landmarks: PoseLandmarks,
  roles: JointRole[],
): { side: Side; visibility: number } {
  // Sin roles (ejercicio sin checks) no hay nada que medir: no bloquear.
  if (roles.length === 0) return { side: 'right', visibility: 1 }

  const score = (side: Side) =>
    roles.reduce(
      (sum, role) => sum + (landmarks[LANDMARK[ROLE_TO_LANDMARK[side][role]]].visibility ?? 0),
      0,
    ) / roles.length

  const right = score('right')
  const left = score('left')
  return right >= left
    ? { side: 'right', visibility: right }
    : { side: 'left', visibility: left }
}

function jointAngle(landmarks: PoseLandmarks, side: Side, points: [JointRole, JointRole, JointRole]): number {
  const [a, vertex, c] = points
  return angleBetweenPoints(
    point(landmarks, side, a),
    point(landmarks, side, vertex),
    point(landmarks, side, c),
  )
}

/**
 * Visibilidad media mínima (0-1) del mejor lado para fiarse de la pose. Por
 * debajo de esto no se evalúa ninguna regla: MediaPipe siempre devuelve 33
 * landmarks, también cuando la persona está mal encuadrada, de frente o medio
 * fuera de plano, y evaluar ángulos sobre esas posiciones inventadas produce
 * avisos falsos. Umbral empírico, ajustable tras pruebas reales como los de
 * `squat.ts`: en una toma de perfil correcta el lado cercano suele dar >0.9.
 */
const MIN_VISIBILITY = 0.5
/**
 * Histéresis: una vez perdida la pose, hay que superar MIN_VISIBILITY + esto
 * para recuperarla. Evita que el aviso de encuadre parpadee frame a frame
 * cuando la visibilidad oscila justo alrededor del umbral.
 */
const VISIBILITY_HYSTERESIS = 0.15

// Umbral para ignorar el ruido de los landmarks al detectar cambios de dirección.
const DIRECTION_EPSILON_DEG = 3
// Una rep debe abarcar al menos este rango de grados para no confundir
// pequeñas oscilaciones (estar de pie, ruido) con una repetición real.
const MIN_REP_RANGE_DEG = 20

interface DepthState {
  prevAngle: number | null
  direction: 'down' | 'up' | null
  peakAngle: number
}

/**
 * Evalúa, frame a frame, las reglas de un ejercicio. Mantiene internamente el
 * estado necesario para detectar el punto más bajo de cada repetición
 * (checks de tipo "depthMin"): hay que crear una instancia nueva al cambiar
 * de ejercicio para no arrastrar estado de otro movimiento.
 */
export function createExerciseEvaluator(config: ExerciseConfig) {
  const depthState = new Map<string, DepthState>()
  const roles = requiredRoles(config)
  // Arranca en false: no se da por buena la pose hasta que se vea bien de
  // verdad (con la histéresis, el primer frame válido debe superar el umbral alto).
  let poseVisible = false

  function evaluateDepthMin(check: DepthMinCheck, landmarks: PoseLandmarks, side: Side): Violation | null {
    const angle = jointAngle(landmarks, side, check.points)
    const state = depthState.get(check.id) ?? {
      prevAngle: null,
      direction: null,
      peakAngle: angle,
    }

    let violation: Violation | null = null

    if (state.prevAngle !== null) {
      let direction = state.direction
      if (angle < state.prevAngle - DIRECTION_EPSILON_DEG) direction = 'down'
      else if (angle > state.prevAngle + DIRECTION_EPSILON_DEG) direction = 'up'

      const wasGoingDown = state.direction === 'down'
      const valleyAngle = state.prevAngle
      const repRange = state.peakAngle - valleyAngle

      if (wasGoingDown && direction === 'up' && repRange >= MIN_REP_RANGE_DEG) {
        if (valleyAngle > check.maxAngleAtBottom) {
          violation = { id: check.id, message: check.message }
        }
        state.peakAngle = valleyAngle
      }

      if (direction === 'up') {
        state.peakAngle = Math.max(state.peakAngle, angle)
      }

      state.direction = direction
    } else {
      state.peakAngle = angle
    }

    state.prevAngle = angle
    depthState.set(check.id, state)
    return violation
  }

  function evaluateFrame(landmarks: PoseLandmarks): FrameResult {
    const { side, visibility } = pickSide(landmarks, roles)
    const threshold = poseVisible
      ? MIN_VISIBILITY
      : MIN_VISIBILITY + VISIBILITY_HYSTERESIS
    poseVisible = visibility >= threshold

    if (!poseVisible) {
      // Se descarta el estado de repetición en curso: al recuperar el encuadre,
      // un prevAngle/direction de antes de perderlo daría un falso mínimo local.
      depthState.clear()
      return { visible: false, violations: [] }
    }

    const violations: Violation[] = []

    for (const check of config.checks) {
      switch (check.kind) {
        case 'instantAngle': {
          const angle = jointAngle(landmarks, side, check.points)
          if (angle < check.min || angle > check.max) {
            violations.push({ id: check.id, message: check.message })
          }
          break
        }
        case 'instantVerticalAngle': {
          const [top, bottom] = check.points
          const angle = angleFromVertical(
            point(landmarks, side, top),
            point(landmarks, side, bottom),
          )
          if (angle < check.min || angle > check.max) {
            violations.push({ id: check.id, message: check.message })
          }
          break
        }
        case 'kneeOverToe': {
          const ankle = point(landmarks, side, 'ankle')
          const knee = point(landmarks, side, 'knee')
          const footIndex = point(landmarks, side, 'footIndex')
          const footLength = Math.hypot(footIndex.x - ankle.x, footIndex.y - ankle.y)
          const facingRight = footIndex.x > ankle.x
          const advance = facingRight ? knee.x - footIndex.x : footIndex.x - knee.x
          if (footLength > 0 && advance > footLength * check.maxRatio) {
            violations.push({ id: check.id, message: check.message })
          }
          break
        }
        case 'depthMin': {
          const violation = evaluateDepthMin(check, landmarks, side)
          if (violation) violations.push(violation)
          break
        }
      }
    }

    return { visible: true, violations }
  }

  return { evaluateFrame }
}
