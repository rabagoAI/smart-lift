import { benchPressConfig } from './exercises/benchPress'
import { squatConfig } from './exercises/squat'
import type { ExerciseConfig } from './types'

export const EXERCISES = {
  squat: squatConfig,
  benchPress: benchPressConfig,
} satisfies Record<string, ExerciseConfig>

export type ExerciseId = keyof typeof EXERCISES

export { createExerciseEvaluator } from './engine'
export type { Violation } from './types'
