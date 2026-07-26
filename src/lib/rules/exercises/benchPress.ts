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
 * - Simetría entre brazos: diferencia de ángulo de codo izq/dcha ≤15° en
 *   cualquier punto del recorrido. Heurística de asimetría funcional (no
 *   hay un estudio específico de bench press que fije este número, pero es
 *   coherente con umbrales usados en tests funcionales de fisioterapia).
 *
 * Prioridad (cuál se muestra si hay varios avisos a la vez): apertura de codo
 * > simetría > profundidad, de mayor a menor riesgo de lesión.
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
    {
      kind: 'symmetry',
      id: 'bench-symmetry',
      points: ['shoulder', 'elbow', 'wrist'],
      maxDifference: 15,
      message: 'Un brazo baja más que el otro, corrige la simetría',
      priority: 2,
    },
  ],
}
