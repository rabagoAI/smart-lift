import type { FeedbackState } from '../lib/rules/feedbackTracker'

interface FeedbackPanelProps {
  feedback: FeedbackState
  /**
   * false = el motor no se fía de la pose (mal encuadre, no de perfil, nadie
   * delante de la cámara). Se avisa del encuadre en vez de dar feedback de
   * forma, porque en ese caso no se ha evaluado ninguna regla.
   */
  poseVisible: boolean
}

/**
 * El aviso activo se superpone al vídeo (posicionado absoluto respecto al
 * contenedor relativo de VideoCanvas); el historial va debajo, en flujo normal.
 *
 * Tres estados, con color distinto cada uno: ámbar = no se ve bien (no hay
 * evaluación), rojo = error de forma detectado, verde = todo correcto.
 */
export function FeedbackPanel({ feedback, poseVisible }: FeedbackPanelProps) {
  const banner = !poseVisible
    ? {
        style: 'bg-amber-500/90 text-black text-lg',
        text: 'No te veo bien: ponte de perfil, con el cuerpo completo en la imagen',
      }
    : feedback.active
      ? { style: 'bg-red-600/90 text-white text-2xl', text: feedback.active.message }
      : { style: 'bg-green-700/70 text-white text-lg', text: '¡Buena forma!' }

  return (
    <>
      <div
        className={
          'absolute inset-x-4 bottom-4 text-center py-3 rounded-lg font-bold ' +
          banner.style
        }
      >
        {banner.text}
      </div>

      {feedback.history.length > 0 && (
        <ul className="mt-3 text-sm text-neutral-300 flex flex-col gap-1">
          {feedback.history.map((entry, index) => (
            <li key={`${entry.id}-${entry.timestamp}-${index}`} className="flex gap-2">
              <span className="text-neutral-500">
                {new Date(entry.timestamp).toLocaleTimeString()}
              </span>
              <span>{entry.message}</span>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
