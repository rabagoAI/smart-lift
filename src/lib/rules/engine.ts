import { angleBetweenPoints, angleFromVertical } from '../angles/angle'
import { toPoint, type Point2D } from '../angles/point'
import { LANDMARK, type LandmarkName, type PoseLandmarks } from '../pose/types'
import type {
  DepthMinCheck,
  ExerciseConfig,
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

/** Elige el lado (izq/dcha) mejor visto por la cámara según la visibility de MediaPipe. */
function pickSide(landmarks: PoseLandmarks): Side {
  const score = (side: Side) =>
    (['shoulder', 'hip', 'knee', 'ankle'] as JointRole[]).reduce(
      (sum, role) => sum + (landmarks[LANDMARK[ROLE_TO_LANDMARK[side][role]]].visibility ?? 0),
      0,
    )
  return score('right') >= score('left') ? 'right' : 'left'
}

function jointAngle(landmarks: PoseLandmarks, side: Side, points: [JointRole, JointRole, JointRole]): number {
  const [a, vertex, c] = points
  return angleBetweenPoints(
    point(landmarks, side, a),
    point(landmarks, side, vertex),
    point(landmarks, side, c),
  )
}

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

  function evaluateFrame(landmarks: PoseLandmarks): Violation[] {
    const side = pickSide(landmarks)
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
        case 'symmetry': {
          const leftAngle = jointAngle(landmarks, 'left', check.points)
          const rightAngle = jointAngle(landmarks, 'right', check.points)
          if (Math.abs(leftAngle - rightAngle) > check.maxDifference) {
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

    return violations
  }

  return { evaluateFrame }
}
