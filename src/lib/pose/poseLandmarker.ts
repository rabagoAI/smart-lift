import {
  FilesetResolver,
  PoseLandmarker,
  type PoseLandmarkerResult,
} from '@mediapipe/tasks-vision'
import type { PoseLandmarks } from './types'

// El wasm y el modelo se cargan desde CDN en tiempo de ejecución (fetch del
// navegador), no hay servidor propio: sigue siendo 100% cliente.
const WASM_BASE_URL =
  'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm'
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task'

let landmarkerPromise: Promise<PoseLandmarker> | null = null

/** Crea (o reutiliza) la instancia del Pose Landmarker en modo VIDEO. */
export function getPoseLandmarker(): Promise<PoseLandmarker> {
  if (!landmarkerPromise) {
    landmarkerPromise = FilesetResolver.forVisionTasks(WASM_BASE_URL).then(
      (vision) =>
        PoseLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: MODEL_URL,
            delegate: 'GPU',
          },
          runningMode: 'VIDEO',
          numPoses: 1,
        }),
    )
  }
  return landmarkerPromise
}

/**
 * Analiza un frame de vídeo y devuelve los landmarks de la primera persona
 * detectada, o null si no se detecta a nadie.
 */
export function detectFrame(
  landmarker: PoseLandmarker,
  video: HTMLVideoElement,
  timestampMs: number,
): PoseLandmarks | null {
  const result: PoseLandmarkerResult = landmarker.detectForVideo(
    video,
    timestampMs,
  )
  return result.landmarks[0] ?? null
}
