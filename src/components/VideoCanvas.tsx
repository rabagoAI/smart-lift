import { useEffect, useRef, useState } from 'react'
import { detectFrame, getPoseLandmarker } from '../lib/pose/poseLandmarker'
import { createLandmarkSmoother } from '../lib/pose/smoothing'
import { POSE_CONNECTIONS, type PoseLandmarks } from '../lib/pose/types'
import { EXERCISES, createExerciseEvaluator, type ExerciseId } from '../lib/rules'
import { createFeedbackTracker, type FeedbackState } from '../lib/rules/feedbackTracker'
import type { FrameResult } from '../lib/rules/types'
import { FeedbackPanel } from './FeedbackPanel'

const EMPTY_FEEDBACK: FeedbackState = { active: null, history: [] }

interface VideoCanvasProps {
  exerciseId: ExerciseId
}

/**
 * Captura la webcam, dibuja el esqueleto detectado por MediaPipe y evalúa,
 * frame a frame, las reglas del ejercicio activo para mostrar feedback.
 */
export function VideoCanvas({ exerciseId }: VideoCanvasProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user')
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>(
    'loading',
  )
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<FeedbackState>(EMPTY_FEEDBACK)
  // Arranca en false: hasta que se detecte una pose fiable no se afirma que la
  // forma sea buena (sin nadie delante de la cámara no hay nada que evaluar).
  const [poseVisible, setPoseVisible] = useState(false)
  const lastActiveIdRef = useRef<string | null>(null)
  const lastHistoryLengthRef = useRef(0)
  const lastPoseVisibleRef = useRef(false)

  // Se recrean al cambiar de ejercicio para no arrastrar estado (ej. mínimo
  // local de una rep) de un movimiento distinto.
  const evaluatorRef = useRef(createExerciseEvaluator(EXERCISES[exerciseId]))
  const trackerRef = useRef(createFeedbackTracker(EXERCISES[exerciseId]))
  const smootherRef = useRef(createLandmarkSmoother())

  useEffect(() => {
    evaluatorRef.current = createExerciseEvaluator(EXERCISES[exerciseId])
    trackerRef.current = createFeedbackTracker(EXERCISES[exerciseId])
    lastActiveIdRef.current = null
    lastHistoryLengthRef.current = 0
    lastPoseVisibleRef.current = false
    setFeedback(EMPTY_FEEDBACK)
    setPoseVisible(false)
  }, [exerciseId])

  useEffect(() => {
    let stream: MediaStream | null = null
    let rafId: number
    let cancelled = false

    async function start() {
      const video = videoRef.current
      const canvas = canvasRef.current
      if (!video || !canvas) return

      setStatus('loading')

      try {
        const [landmarker, mediaStream] = await Promise.all([
          getPoseLandmarker(),
          navigator.mediaDevices.getUserMedia({
            video: { width: 1280, height: 720, facingMode: { ideal: facingMode } },
            audio: false,
          }),
        ])
        if (cancelled) {
          mediaStream.getTracks().forEach((track) => track.stop())
          return
        }

        stream = mediaStream
        video.srcObject = mediaStream
        await video.play()

        canvas.width = video.videoWidth
        canvas.height = video.videoHeight
        const ctx = canvas.getContext('2d')
        if (!ctx) return

        setStatus('ready')

        const loop = () => {
          if (cancelled) return
          const rawLandmarks = detectFrame(landmarker, video, performance.now())
          const landmarks = rawLandmarks
            ? smootherRef.current.smooth(rawLandmarks)
            : null
          drawFrame(ctx, video, landmarks)

          // Sin landmarks (nadie en cuadro) se trata igual que una pose no
          // fiable: mismo aviso de encuadre y ninguna regla evaluada.
          const { visible, violations }: FrameResult = landmarks
            ? evaluatorRef.current.evaluateFrame(landmarks)
            : { visible: false, violations: [] }

          if (visible !== lastPoseVisibleRef.current) {
            lastPoseVisibleRef.current = visible
            setPoseVisible(visible)
          }

          // Se llama al tracker también cuando no hay pose fiable (con la lista
          // vacía): así el último aviso caduca por HOLD_MS en vez de quedarse
          // congelado en pantalla, y no se pierde el historial.
          const state = trackerRef.current.update(violations, Date.now())
          if (
            state.active?.id !== lastActiveIdRef.current ||
            state.history.length !== lastHistoryLengthRef.current
          ) {
            lastActiveIdRef.current = state.active?.id ?? null
            lastHistoryLengthRef.current = state.history.length
            setFeedback(state)
          }

          rafId = requestAnimationFrame(loop)
        }
        rafId = requestAnimationFrame(loop)
      } catch (err) {
        if (cancelled) return
        setStatus('error')
        setErrorMessage(
          err instanceof Error ? err.message : 'No se pudo acceder a la cámara',
        )
      }
    }

    start()

    return () => {
      cancelled = true
      cancelAnimationFrame(rafId)
      stream?.getTracks().forEach((track) => track.stop())
    }
  }, [facingMode])

  return (
    <div className="relative w-full max-w-3xl mx-auto">
      <video ref={videoRef} className="hidden" playsInline muted />
      <canvas
        ref={canvasRef}
        className={
          'w-full h-auto rounded-lg bg-black' +
          (facingMode === 'user' ? ' scale-x-[-1]' : '')
        }
      />
      <button
        type="button"
        onClick={() =>
          setFacingMode((mode) => (mode === 'user' ? 'environment' : 'user'))
        }
        className="absolute top-2 right-2 bg-black/60 text-white text-sm px-3 py-1.5 rounded-md"
      >
        Cambiar cámara
      </button>
      {status === 'loading' && (
        <div className="absolute inset-0 flex items-center justify-center text-white">
          Cargando modelo y cámara…
        </div>
      )}
      {status === 'error' && (
        <div className="absolute inset-0 flex items-center justify-center text-red-400 text-center px-4">
          {errorMessage}
        </div>
      )}
      {status === 'ready' && (
        <FeedbackPanel feedback={feedback} poseVisible={poseVisible} />
      )}
    </div>
  )
}

function drawFrame(
  ctx: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  landmarks: PoseLandmarks | null,
) {
  const { width, height } = ctx.canvas
  ctx.clearRect(0, 0, width, height)
  ctx.drawImage(video, 0, 0, width, height)

  if (!landmarks) return

  ctx.strokeStyle = '#22d3ee'
  ctx.lineWidth = 3
  for (const [start, end] of POSE_CONNECTIONS) {
    const a = landmarks[start]
    const b = landmarks[end]
    if (!a || !b) continue
    ctx.beginPath()
    ctx.moveTo(a.x * width, a.y * height)
    ctx.lineTo(b.x * width, b.y * height)
    ctx.stroke()
  }

  ctx.fillStyle = '#facc15'
  for (const point of landmarks) {
    ctx.beginPath()
    ctx.arc(point.x * width, point.y * height, 5, 0, 2 * Math.PI)
    ctx.fill()
  }
}
