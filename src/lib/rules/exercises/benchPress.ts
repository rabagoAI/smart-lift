import type { ExerciseConfig } from '../types'

/**
 * PRESS DE BANCA — vista de perfil.
 *
 * Rangos y fuentes confirmados antes de implementar (ver conversación inicial):
 *
 * - Codo (hombro-codo-muñeca): el recorrido completo baja hasta ~80°-90° antes
 *   de subir (contacto con el pecho). Solo se avisa si el mínimo de la
 *   repetición queda POR ENCIMA de 90° (recorrido incompleto).
 * - Húmero-torso (codo-hombro-cadera, apertura de codo): mantenerlo entre
 *   45°-75° durante todo el recorrido. Por encima de ese rango el hombro
 *   entra en rotación externa máxima bajo carga, lo que compresiona
 *   estructuras del hombro (bíceps, bursa, manguito rotador) y aumenta el
 *   riesgo de lesión. Se comprueba en todo momento, no solo en el fondo.
 *
 * No hay check de simetría entre brazos: en vista de perfil solo un lado del
 * cuerpo es fiable (ver `pickSide` en engine.ts); el brazo del fondo queda
 * parcial u ocultamente tapado por el torso, sobre todo con los codos
 * abiertos, así que su landmark no es fiable para comparar contra el lado
 * visible. Se descartó tras revisar el mismo tipo de problema que obligó a
 * ajustar los umbrales de la sentadilla tras pruebas reales.
 *
 * Prioridad (cuál se muestra si hay varios avisos a la vez): apertura de codo
 * > profundidad, de mayor a menor riesgo de lesión.
 */
export const benchPressConfig: ExerciseConfig = {
  id: 'benchPress',
  label: 'Press de banca',
  checks: [
    {
      kind: 'depthMin',
      id: 'bench-elbow-depth',
      points: ['shoulder', 'elbow', 'wrist'],
      maxAngleAtBottom: 90,
      message: 'Recorrido incompleto: baja más antes de subir',
      priority: 1,
    },
    {
      kind: 'instantAngle',
      id: 'bench-elbow-flare',
      points: ['elbow', 'shoulder', 'hip'],
      min: 45,
      max: 75,
      message: 'Codos demasiado abiertos, riesgo para el hombro',
      priority: 3,
    },
  ],
}
