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
      const { violations } = evaluator.evaluateFrame(standingSquatFrame(0))
      expect(violations.find((v) => v.id === 'squat-knee-depth')).toBeUndefined()
    }
  })

  it('avisa de profundidad insuficiente cuando el mínimo de la rep no baja de 100°', () => {
    const evaluator = createExerciseEvaluator(squatConfig)
    // dx=0 -> rodilla a 180° (de pie). dx=0.3 -> rodilla a ~146.6° (bajada
    // superficial). Vuelve a subir a 180°: la rep completa no baja de 100°.
    const dxSequence = [0, 0.15, 0.3, 0.15, 0]
    const violationsPerFrame = dxSequence.map(
      (dx) => evaluator.evaluateFrame(standingSquatFrame(dx)).violations,
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
    const violationsPerFrame = dxSequence.map(
      (dx) => evaluator.evaluateFrame(standingSquatFrame(dx)).violations,
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
    const { violations } = evaluator.evaluateFrame(landmarks)
    expect(violations.some((v) => v.id === 'squat-back-angle')).toBe(true)
  })

  it('detecta rodilla adelantada a la punta del pie', () => {
    const evaluator = createExerciseEvaluator(squatConfig)
    const landmarks = standingSquatFrame(0)
    setPoint(landmarks, 'rightAnkle', 0, 3)
    setPoint(landmarks, 'rightFootIndex', 0.3, 3)
    setPoint(landmarks, 'rightKnee', 0.8, 2) // muy por delante de la punta del pie
    const { violations } = evaluator.evaluateFrame(landmarks)
    expect(violations.some((v) => v.id === 'squat-knee-over-toe')).toBe(true)
  })
})

describe('createExerciseEvaluator — gate de visibilidad', () => {
  /** Mismo frame con la visibility forzada a un valor uniforme en los 33 landmarks. */
  function withVisibility(landmarks: PoseLandmarks, visibility: number): PoseLandmarks {
    return landmarks.map((landmark) => ({ ...landmark, visibility }))
  }

  it('no evalúa reglas cuando ningún lado se ve con claridad', () => {
    const evaluator = createExerciseEvaluator(squatConfig)
    const landmarks = standingSquatFrame(0)
    // Postura que sí generaría aviso de espalda si se evaluase.
    setPoint(landmarks, 'rightShoulder', 3, 0)

    const result = evaluator.evaluateFrame(withVisibility(landmarks, 0.2))
    expect(result.visible).toBe(false)
    expect(result.violations).toEqual([])
  })

  it('exige superar el umbral con histéresis para recuperar la pose', () => {
    const evaluator = createExerciseEvaluator(squatConfig)
    const frame = (visibility: number) =>
      evaluator.evaluateFrame(withVisibility(standingSquatFrame(0), visibility))

    // Arranca no visible: 0.55 está por encima de MIN_VISIBILITY (0.5) pero no
    // del umbral alto (0.65), así que todavía no se da por buena la pose.
    expect(frame(0.55).visible).toBe(false)
    expect(frame(1).visible).toBe(true)
    // Ya visible, basta con mantenerse por encima del umbral bajo.
    expect(frame(0.55).visible).toBe(true)
    expect(frame(0.4).visible).toBe(false)
    // Perdida de nuevo: 0.55 ya no es suficiente para recuperarla.
    expect(frame(0.55).visible).toBe(false)
  })

  it('no arrastra el estado de la repetición tras perder la visibilidad', () => {
    const evaluator = createExerciseEvaluator(squatConfig)
    // Media bajada (180° -> ~146°) y se pierde el encuadre antes de subir.
    for (const dx of [0, 0.15, 0.3]) {
      evaluator.evaluateFrame(withVisibility(standingSquatFrame(dx), 1))
    }
    for (let i = 0; i < 3; i++) {
      evaluator.evaluateFrame(withVisibility(standingSquatFrame(0.3), 0.2))
    }

    // Al recuperar el encuadre de pie, ese descenso previo no debe contar como
    // el mínimo de una repetición (daría un falso "no llegas a la profundidad").
    const violations = [0, 0, 0].flatMap(
      (dx) => evaluator.evaluateFrame(withVisibility(standingSquatFrame(dx), 1)).violations,
    )
    expect(violations.filter((v) => v.id === 'squat-knee-depth')).toHaveLength(0)
  })
})

describe('createExerciseEvaluator — press de banca', () => {
  /** Hombro y cadera fijos; codo/muñeca variables. Izquierdo oculto (visibility 0), como en vista de perfil real. */
  function benchFrame({
    elbowX,
    elbowY,
    wristX = elbowX,
    wristY = elbowY - 0.5,
  }: {
    elbowX: number
    elbowY: number
    wristX?: number
    wristY?: number
  }): PoseLandmarks {
    const landmarks = baseLandmarks()
    setPoint(landmarks, 'rightShoulder', 0, 0)
    setPoint(landmarks, 'rightHip', 0, 1)
    setPoint(landmarks, 'rightElbow', elbowX, elbowY)
    setPoint(landmarks, 'rightWrist', wristX, wristY)
    setPoint(landmarks, 'leftShoulder', 0, 0)
    landmarks[LANDMARK.leftHip].visibility = 0
    landmarks[LANDMARK.leftElbow].visibility = 0
    landmarks[LANDMARK.leftWrist].visibility = 0
    return landmarks
  }

  it('avisa de recorrido incompleto cuando el mínimo de la rep no baja de 90°', () => {
    const evaluator = createExerciseEvaluator(benchPressConfig)
    // Codo fijo en (0,-1); la muñeca gira alrededor para variar el ángulo de codo:
    // 180° (brazo extendido) -> 150° -> 120° (bajada superficial, no pasa de 90°) -> 150° -> 180°.
    const framesDown = [
      benchFrame({ elbowX: 0, elbowY: -1, wristX: 0, wristY: -2 }),
      benchFrame({ elbowX: 0, elbowY: -1, wristX: 0.5, wristY: -1.866 }),
      benchFrame({ elbowX: 0, elbowY: -1, wristX: 0.866, wristY: -1.5 }),
      benchFrame({ elbowX: 0, elbowY: -1, wristX: 0.5, wristY: -1.866 }),
      benchFrame({ elbowX: 0, elbowY: -1, wristX: 0, wristY: -2 }),
    ]
    const violations = framesDown.flatMap((f) => evaluator.evaluateFrame(f).violations)
    expect(violations.filter((v) => v.id === 'bench-elbow-depth')).toHaveLength(1)
  })

  it('no avisa de recorrido incompleto cuando la rep sí baja del pecho (<90°)', () => {
    const evaluator = createExerciseEvaluator(benchPressConfig)
    // Mismo recorrido pero el punto más bajo llega a 70° (por debajo de 90°).
    const framesDown = [
      benchFrame({ elbowX: 0, elbowY: -1, wristX: 0, wristY: -2 }),
      benchFrame({ elbowX: 0, elbowY: -1, wristX: 0.866, wristY: -1.5 }),
      benchFrame({ elbowX: 0, elbowY: -1, wristX: 0.9397, wristY: -0.658 }),
      benchFrame({ elbowX: 0, elbowY: -1, wristX: 0.866, wristY: -1.5 }),
      benchFrame({ elbowX: 0, elbowY: -1, wristX: 0, wristY: -2 }),
    ]
    const violations = framesDown.flatMap((f) => evaluator.evaluateFrame(f).violations)
    expect(violations.filter((v) => v.id === 'bench-elbow-depth')).toHaveLength(0)
  })

  it('detecta codos demasiado abiertos (apertura fuera de 45°-75°)', () => {
    const evaluator = createExerciseEvaluator(benchPressConfig)
    // Codo a 90° del torso (cadera-hombro-codo), fuera del rango 45°-75°.
    const { violations } = evaluator.evaluateFrame(benchFrame({ elbowX: 1, elbowY: 0 }))
    expect(violations.some((v) => v.id === 'bench-elbow-flare')).toBe(true)
  })

  it('no avisa de apertura de codo cuando está dentro de rango', () => {
    const evaluator = createExerciseEvaluator(benchPressConfig)
    // Codo a 60° del torso (dentro de 45°-75°).
    const { violations } = evaluator.evaluateFrame(benchFrame({ elbowX: 0.866, elbowY: 0.5 }))
    expect(violations.some((v) => v.id === 'bench-elbow-flare')).toBe(false)
  })
})
