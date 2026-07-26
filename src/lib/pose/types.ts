/** Un punto devuelto por MediaPipe Pose Landmarker (coordenadas normalizadas 0-1). */
export interface PoseLandmark {
  x: number
  y: number
  z: number
  visibility?: number
}

/** Los 33 landmarks de un frame, en el orden que devuelve MediaPipe. */
export type PoseLandmarks = PoseLandmark[]

/** Índices oficiales de MediaPipe Pose, con nombre para no usar números mágicos. */
export const LANDMARK = {
  nose: 0,
  leftEyeInner: 1,
  leftEye: 2,
  leftEyeOuter: 3,
  rightEyeInner: 4,
  rightEye: 5,
  rightEyeOuter: 6,
  leftEar: 7,
  rightEar: 8,
  mouthLeft: 9,
  mouthRight: 10,
  leftShoulder: 11,
  rightShoulder: 12,
  leftElbow: 13,
  rightElbow: 14,
  leftWrist: 15,
  rightWrist: 16,
  leftPinky: 17,
  rightPinky: 18,
  leftIndex: 19,
  rightIndex: 20,
  leftThumb: 21,
  rightThumb: 22,
  leftHip: 23,
  rightHip: 24,
  leftKnee: 25,
  rightKnee: 26,
  leftAnkle: 27,
  rightAnkle: 28,
  leftHeel: 29,
  rightHeel: 30,
  leftFootIndex: 31,
  rightFootIndex: 32,
} as const

export type LandmarkName = keyof typeof LANDMARK

/** Pares de landmarks a unir para dibujar el esqueleto sobre el vídeo. */
export const POSE_CONNECTIONS: ReadonlyArray<[number, number]> = [
  // torso
  [LANDMARK.leftShoulder, LANDMARK.rightShoulder],
  [LANDMARK.leftShoulder, LANDMARK.leftHip],
  [LANDMARK.rightShoulder, LANDMARK.rightHip],
  [LANDMARK.leftHip, LANDMARK.rightHip],
  // brazo izquierdo
  [LANDMARK.leftShoulder, LANDMARK.leftElbow],
  [LANDMARK.leftElbow, LANDMARK.leftWrist],
  // brazo derecho
  [LANDMARK.rightShoulder, LANDMARK.rightElbow],
  [LANDMARK.rightElbow, LANDMARK.rightWrist],
  // pierna izquierda
  [LANDMARK.leftHip, LANDMARK.leftKnee],
  [LANDMARK.leftKnee, LANDMARK.leftAnkle],
  [LANDMARK.leftAnkle, LANDMARK.leftHeel],
  [LANDMARK.leftAnkle, LANDMARK.leftFootIndex],
  [LANDMARK.leftHeel, LANDMARK.leftFootIndex],
  // pierna derecha
  [LANDMARK.rightHip, LANDMARK.rightKnee],
  [LANDMARK.rightKnee, LANDMARK.rightAnkle],
  [LANDMARK.rightAnkle, LANDMARK.rightHeel],
  [LANDMARK.rightAnkle, LANDMARK.rightFootIndex],
  [LANDMARK.rightHeel, LANDMARK.rightFootIndex],
  // cabeza
  [LANDMARK.leftShoulder, LANDMARK.leftEar],
  [LANDMARK.rightShoulder, LANDMARK.rightEar],
]
