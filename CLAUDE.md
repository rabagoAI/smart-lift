# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Qué es este proyecto

"Smart Lift": corrector de forma para ejercicios de gimnasio (sentadilla y press de banca, vistos de perfil) usando visión por computador **100% en el cliente** — sin backend, sin base de datos. Captura la webcam/cámara del móvil, extrae landmarks corporales con MediaPipe Pose Landmarker, calcula ángulos articulares por trigonometría y los compara contra reglas biomecánicas fijas (no hay modelo entrenado) para dar feedback en tiempo real en pantalla, en español.

Uso objetivo real: móvil, en el gimnasio (no solo el navegador de escritorio usado para desarrollar). Por eso la cámara por defecto es la frontal (`facingMode: 'user'`) — el usuario necesita ver la pantalla con el feedback mientras hace la repetición.

## Comandos

```bash
npm run dev      # servidor de desarrollo (Vite). HTTPS + expuesto en la red local (ver vite.config.ts)
npm run build    # tsc -b && vite build
npm run test     # vitest run (todos los tests)
npm run lint     # oxlint
npm run preview  # sirve el build de producción
```

Ejecutar un test concreto:
```bash
npx vitest run src/lib/rules/engine.test.ts
npx vitest run -t "detecta espalda demasiado inclinada"
```

Typecheck sin build completo:
```bash
npx tsc -b --noEmit
```

El dev server sirve por HTTPS (certificado autofirmado vía `@vitejs/plugin-basic-ssl`) y con `server.host: true`, para poder abrirlo desde el móvil en la misma red Wi-Fi (`https://<ip-local>:5173`) — `getUserMedia` exige contexto seguro y no funciona por `http://` salvo en `localhost`.

## Arquitectura

Flujo de datos, de cámara a pantalla (todo ocurre dentro de `VideoCanvas`, en un loop de `requestAnimationFrame`):

```
getUserMedia → MediaPipe PoseLandmarker (detectFrame)
  → suavizado EMA (smoothing.ts, reduce ruido de cámara/modelo)
  → dibujo del esqueleto en <canvas>
  → motor de reglas (engine.ts: evaluateFrame) → Violation[]
  → feedback tracker (feedbackTracker.ts) → mensaje activo + historial
  → FeedbackPanel (React state, solo se actualiza si cambia lo mostrado)
```

### `src/lib/pose` — captura y tipos de MediaPipe
- `types.ts`: los 33 landmarks con nombre (`LANDMARK.leftKnee`, etc., no índices mágicos) + `POSE_CONNECTIONS` para dibujar el esqueleto.
- `poseLandmarker.ts`: wrapper de `@mediapipe/tasks-vision`. Carga el wasm y el modelo (`pose_landmarker_lite`) desde CDN en tiempo de ejecución (sigue siendo 100% cliente, sin servidor propio).
- `smoothing.ts`: filtro de media móvil exponencial (EMA) sobre las coordenadas de los landmarks. Necesario porque MediaPipe Tasks Vision ya no trae suavizado incorporado (a diferencia de la API antigua con `smooth_landmarks=True`), y cámaras de portátil/móvil de gama media producen bastante ruido frame a frame.

### `src/lib/angles` — trigonometría pura, sin dependencias de MediaPipe
- `point.ts`: `Point2D` + `toPoint()` (descarta la Z de MediaPipe, poco fiable en 2D desde una sola cámara de perfil).
- `angle.ts`: dos primitivas basadas en arcotangente de vectores — `angleBetweenPoints(a, vertex, c)` (ángulo articular de 3 puntos, ej. rodilla) y `angleFromVertical(top, bottom)` (ángulo de un segmento de 2 puntos respecto a la vertical de la imagen, ej. inclinación de espalda).

### `src/lib/rules` — configuración declarativa + motor de evaluación
- `types.ts`: unión discriminada de tipos de "check" — `instantAngle` (3 puntos, en rango todo el rato), `instantVerticalAngle` (2 puntos vs. vertical), `depthMin` (3 puntos, solo se evalúa en el mínimo local/punto más bajo de la rep), `kneeOverToe` (ratio horizontal rodilla vs. punta del pie normalizado por longitud del pie), `symmetry` (diferencia del mismo ángulo entre lado izq. y dcho.). Cada check lleva un `priority` (mayor = más urgente/mayor riesgo de lesión) para decidir cuál mostrar si hay varios avisos activos a la vez.
- `exercises/squat.ts` y `exercises/benchPress.ts`: los datos de cada ejercicio (qué ángulos, qué rangos, qué mensaje), con las fuentes y el razonamiento biomecánico documentados como comentarios — **incluye el historial de ajustes de umbrales tras pruebas reales**, ver más abajo.
- `engine.ts`: motor genérico que interpreta esa configuración.
  - **Selección de lado**: en vista de perfil solo un lado del cuerpo es fiable; se elige automáticamente izq./dcha. por `visibility` de MediaPipe en cada frame (no hay que indicarlo a mano).
  - **Detección de mínimo local** (para checks `depthMin`): usa un umbral de histéresis (`DIRECTION_EPSILON_DEG`) para no confundir ruido con cambio de dirección, y un rango mínimo de repetición (`MIN_REP_RANGE_DEG`) para no disparar el aviso de "profundidad insuficiente" por pequeñas oscilaciones estando de pie.
- `feedbackTracker.ts`: lógica pura (sin React) que mantiene un aviso visible un tiempo (`HOLD_MS`) tras detectarse (para que dé tiempo a leerlo, ya que algunos checks solo disparan en un frame puntual), elige el de mayor `priority` si hay varios activos, y añade al historial solo cuando un aviso pasa de inactivo a activo (no en cada frame que se repite).
- `index.ts`: registro `EXERCISES` (squat/benchPress) + re-exporta `createExerciseEvaluator`.

### `src/components`
- `VideoCanvas.tsx`: conecta todo lo anterior. Recrea el evaluador y el feedback tracker (via `useRef`) cada vez que cambia `exerciseId`, para no arrastrar estado de otro ejercicio. Tiene un botón para alternar `facingMode` (`user`/`environment`); el mirroring del canvas (`scale-x-[-1]`) solo se aplica con la frontal.
- `FeedbackPanel.tsx`: aviso activo superpuesto al vídeo (posición absoluta dentro del contenedor `relative` de `VideoCanvas`), historial de últimos 5 en flujo normal debajo.
- `ExerciseSelector.tsx`: dropdown que lee de `EXERCISES` (no hay que tocarlo al añadir un ejercicio nuevo, solo añadir su config en `src/lib/rules/exercises/`).

### Cómo añadir un ejercicio nuevo
1. Crear `src/lib/rules/exercises/<nombre>.ts` con un `ExerciseConfig` (checks + mensajes + prioridades + comentarios con las fuentes biomecánicas).
2. Añadirlo al registro `EXERCISES` en `src/lib/rules/index.ts`.
3. Nada más cambia — `ExerciseSelector`, `VideoCanvas` y el motor son genéricos.

## Estado actual (última sesión: pruebas reales en móvil)

**Completado**: captura de vídeo + overlay de esqueleto (Fase 1), cálculo de ángulos con tests (Fase 2), motor de reglas para sentadilla y press de banca con tests (Fase 3), feedback en pantalla con prioridad e historial (Fase 4), suavizado EMA para reducir falsos positivos por ruido de cámara, servidor de dev por HTTPS/LAN para probar en el móvil, toggle de cámara frontal/trasera.

**Pendiente / decidido explícitamente dejar para después**: botón de calibración (capturar 2-3s en posición neutra para ajustar umbrales a la persona) — opcional en el MVP original, aún no implementado.

**Ajustes de umbrales tras pruebas reales en el móvil** (ver comentarios en `squat.ts` para el razonamiento completo):
- `squat-back-angle`: máximo subido de 45° a 65°. El 45° venía de sentadilla con barra cargada tras nuca; con peso corporal, y especialmente en rango completo (más profundidad = más inclinación necesaria para el equilibrio), 45° daba error en sentadillas correctas.
- `squat-knee-over-toe`: umbral aflojado de 1/3 a 1.2x la longitud del pie. Ya se sabía que no hay umbral clínico validado para esta regla; las pruebas confirmaron que 1/3 era demasiado estricto (la corriente "knees over toes" defiende ese avance como normal con buena movilidad de tobillo).

**Al retomar**: el usuario iba a volver a probar la sentadilla completa en el móvil con estos dos umbrales ya ajustados (65° espalda, 1.2x rodilla-pie) — pendiente de confirmar si ahora sí da "buena forma" correctamente. Si sigue fallando, el siguiente sospechoso sería el press de banca (mismo tipo de reglas, sin probar aún a fondo en móvil) o revisar si hace falta un umbral dependiente de la profundidad de la sentadilla en vez de un máximo fijo para la espalda.
