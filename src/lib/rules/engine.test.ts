import { describe, expect, it } from 'vitest'
import type { PoseLandmark, PoseLandmarks } from '../pose/types'
import { LANDMARK } from '../pose/types'
import { createExerciseEvaluator } from './engine'
import { squatConfig } from './exercises/squat'
import { benchPressConfig } from './exercises/benchPress'

/** Construye un frame de 33 landmarks neutro (todos en el origen, visibles). */
function baseLandmarks(): PoseLandmarks {
  const landmarks: PoseLandmark[] = []
  for (let i = 0; i < 33; i++) {
    landmarks.push({ x: 0, y: 0, z: 0, visibility: 1 })
  }
  return landmarks
}

function setPoint(landmarks: PoseLandmarks, name: keyof typeof LANDMARK, x: number, y: number) {
  landmarks[LANDMARK[name]] = { x, y, z: 0, visibility: 1 }
}

/** De pie: cadera, rodilla y tobillo casi en línea vertical (rodilla ~180°). */
function standingSquatFrame(kneeBend = 0): PoseLandmarks {
  const landmarks = baseLandmarks()
  setPoint(landmarks, 'rightShoulder', 0, 0)
  setPoint(landmarks, 'rightHip', 0, 1)
  // A más kneeBend, la rodilla se adelanta en X y el ángulo cadera-rodilla-tobillo baja de 180°.
  setPoint(landmarks, 'rightKnee', kneeBend, 2)
  setPoint(landmarks, 'rightAnkle', 0, 3)
  setPoint(landmarks, 'rightFootIndex', 0.3, 3)
  // Lado izquierdo con visibility baja para que el motor elija el derecho.
  setPoint(landmarks, 'leftShoulder', 0, 0)
  landmarks[LANDMARK.leftShoulder].visibility = 0
  landmarks[LANDMARK.leftHip].visibility = 0
  landmarks[LANDMARK.leftKnee].visibility = 0
  landmarks[LANDMARK.leftAnkle].visibility = 0
  return landmarks
}

describe('createExerciseEvaluator — sentadilla', () => {
  it('no avisa de profundidad mientras la persona está de pie sin moverse', () => {
    const evaluator = createExerciseEvaluator(squatConfig)
    for (let i = 0; i < 10; i++) {
      const violations = evaluator.evaluateFrame(standingSquatFrame(0))
      expect(violations.find((v) => v.id === 'squat-knee-depth')).toBeUndefined()
    }
  })

  it('avisa de profundidad insuficiente cuando el mínimo de la rep no baja de 100°', () => {
    const evaluator = createExerciseEvaluator(squatConfig)
    // dx=0 -> rodilla a 180° (de pie). dx=0.3 -> rodilla a ~146.6° (bajada
    // superficial). Vuelve a subir a 180°: la rep completa no baja de 100°.
    const dxSequence = [0, 0.15, 0.3, 0.15, 0]
    const violationsPerFrame = dxSequence.map((dx) =>
      evaluator.evaluateFrame(standingSquatFrame(dx)),
    )
    const depthViolations = violationsPerFrame
      .flat()
      .filter((v) => v.id === 'squat-knee-depth')
    expect(depthViolations).toHaveLength(1)
  })

  it('no avisa de profundidad cuando la rep sí baja lo suficiente', () => {
    const evaluator = createExerciseEvaluator(squatConfig)
    // dx=0.9 -> rodilla a ~96° (dentro de rango 70-100), sí llega a profundidad.
    const dxSequence = [0, 0.45, 0.9, 0.45, 0]
    const violationsPerFrame = dxSequence.map((dx) =>
      evaluator.evaluateFrame(standingSquatFrame(dx)),
    )
    const depthViolations = violationsPerFrame
      .flat()
      .filter((v) => v.id === 'squat-knee-depth')
    expect(depthViolations).toHaveLength(0)
  })

  it('detecta espalda demasiado inclinada', () => {
    const evaluator = createExerciseEvaluator(squatConfig)
    const landmarks = standingSquatFrame(0)
    // Hombro muy adelantado respecto a la cadera -> segmento casi horizontal (>65°).
    setPoint(landmarks, 'rightShoulder', 3, 0)
    const violations = evaluator.evaluateFrame(landmarks)
    expect(violations.some((v) => v.id === 'squat-back-angle')).toBe(true)
  })

  it('detecta rodilla adelantada a la punta del pie', () => {
    const evaluator = createExerciseEvaluator(squatConfig)
    const landmarks = standingSquatFrame(0)
    setPoint(landmarks, 'rightAnkle', 0, 3)
    setPoint(landmarks, 'rightFootIndex', 0.3, 3)
    setPoint(landmarks, 'rightKnee', 0.8, 2) // muy por delante de la punta del pie
    const violations = evaluator.evaluateFrame(landmarks)
    expect(violations.some((v) => v.id === 'squat-knee-over-toe')).toBe(true)
  })
})

describe('createExerciseEvaluator — press de banca', () => {
  function benchFrame({ leftElbowX = 0, rightElbowX = 0 } = {}): PoseLandmarks {
    const landmarks = baseLandmarks()
    setPoint(landmarks, 'rightShoulder', 0, 0)
    setPoint(landmarks, 'rightHip', 0, 1)
    setPoint(landmarks, 'rightElbow', rightElbowX, -0.5)
    setPoint(landmarks, 'rightWrist', rightElbowX, -1)
    setPoint(landmarks, 'leftShoulder', 0, 0)
    setPoint(landmarks, 'leftHip', 0, 1)
    setPoint(landmarks, 'leftElbow', leftElbowX, -0.5)
    setPoint(landmarks, 'leftWrist', leftElbowX, -1)
    return landmarks
  }

  it('detecta asimetría entre brazos', () => {
    const evaluator = createExerciseEvaluator(benchPressConfig)
    const violations = evaluator.evaluateFrame(benchFrame({ leftElbowX: 0, rightElbowX: 2 }))
    expect(violations.some((v) => v.id === 'bench-symmetry')).toBe(true)
  })

  it('no avisa de asimetría cuando ambos brazos van igual', () => {
    const evaluator = createExerciseEvaluator(benchPressConfig)
    const violations = evaluator.evaluateFrame(benchFrame({ leftElbowX: 0.2, rightElbowX: 0.2 }))
    expect(violations.some((v) => v.id === 'bench-symmetry')).toBe(false)
  })
})
