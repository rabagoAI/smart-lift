import type { FeedbackState } from '../lib/rules/feedbackTracker'

interface FeedbackPanelProps {
  feedback: FeedbackState
}

/**
 * El aviso activo se superpone al vídeo (posicionado absoluto respecto al
 * contenedor relativo de VideoCanvas); el historial va debajo, en flujo normal.
 */
export function FeedbackPanel({ feedback }: FeedbackPanelProps) {
  return (
    <>
      <div
        className={
          'absolute inset-x-4 bottom-4 text-center py-3 rounded-lg font-bold ' +
          (feedback.active
            ? 'bg-red-600/90 text-white text-2xl'
            : 'bg-green-700/70 text-white text-lg')
        }
      >
        {feedback.active ? feedback.active.message : '¡Buena forma!'}
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
