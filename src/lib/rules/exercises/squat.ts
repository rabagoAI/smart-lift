import type { ExerciseConfig } from '../types'

/**
 * SENTADILLA — vista de perfil.
 *
 * Rangos y fuentes confirmados antes de implementar (ver conversación inicial):
 *
 * - Rodilla (cadera-rodilla-tobillo): la sentadilla a paralelo corresponde a
 *   ~90° de flexión de rodilla (NSCA, "Considerations for Squat Depth").
 *   Rodillas sanas toleran sin daño estructural documentado el rango 0°-100°
 *   de flexión; sentadillas profundas (ATG) superan 110°-130°. Por eso solo
 *   se avisa si el mínimo de la repetición queda POR ENCIMA de 100° (no se
 *   llega a profundidad); bajar de 70° no se trata como error.
 * - Espalda (hombro→cadera vs. vertical): el límite de ~45° viene de la
 *   sentadilla con barra tras nuca CARGADA ("por encima de ese punto la barra
 *   deja de estar soportada por la espalda"); con el propio peso corporal
 *   (sin barra) más inclinación es normal y necesaria para mantener el
 *   equilibrio, sobre todo cuanto más profunda es la sentadilla (el centro de
 *   gravedad tiene que quedar sobre el mediopié). Ajustado a 65° tras pruebas
 *   reales: con 45° marcaba como error sentadillas completas hechas
 *   correctamente. Sigue sin ser una inclinación ilimitada válida, pero ya no
 *   penaliza el rango completo con peso corporal.
 * - Rodilla vs. punta del pie: la literatura biomecánica no da un umbral
 *   numérico validado (zona gris reconocida incluso en revisiones clínicas);
 *   de hecho la corriente "knees over toes" defiende que ese avance es
 *   normal y positivo con buena movilidad de tobillo. Umbral aflojado tras
 *   pruebas reales (de 1/3 a 1.2x la longitud del pie): ya no es una regla
 *   estricta, solo un aviso suave para casos claramente extremos.
 *
 * Prioridad (cuál se muestra si hay varios avisos a la vez): espalda > rodilla-pie
 * > profundidad, de mayor a menor riesgo de lesión.
 */
export const squatConfig: ExerciseConfig = {
  id: 'squat',
  label: 'Sentadilla',
  checks: [
    {
      kind: 'depthMin',
      id: 'squat-knee-depth',
      points: ['hip', 'knee', 'ankle'],
      maxAngleAtBottom: 100,
      message: 'No llegas a la profundidad de paralelo',
      priority: 1,
    },
    {
      kind: 'instantVerticalAngle',
      id: 'squat-back-angle',
      points: ['shoulder', 'hip'],
      min: 0,
      max: 65,
      message: 'La espalda se inclina demasiado hacia adelante',
      priority: 3,
    },
    {
      kind: 'kneeOverToe',
      id: 'squat-knee-over-toe',
      maxRatio: 1.2,
      message: 'La rodilla se adelanta demasiado a la punta del pie',
      priority: 2,
    },
  ],
}
