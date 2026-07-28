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
  → motor de reglas (engine.ts: evaluateFrame) → FrameResult { visible, violations }
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
- `types.ts`: unión discriminada de tipos de "check" — `instantAngle` (3 puntos, en rango todo el rato), `instantVerticalAngle` (2 puntos vs. vertical), `depthMin` (3 puntos, solo se evalúa en el mínimo local/punto más bajo de la rep), `kneeOverToe` (ratio horizontal rodilla vs. punta del pie normalizado por longitud del pie). Cada check lleva un `priority` (mayor = más urgente/mayor riesgo de lesión) para decidir cuál mostrar si hay varios avisos activos a la vez. Aquí vive también `FrameResult`, lo que devuelve el motor por frame.
  - Hubo un quinto tipo, `symmetry` (diferencia del mismo ángulo entre lado izq. y dcho.), eliminado: en vista de perfil el brazo/pierna del fondo queda tapado por el cuerpo, así que sus landmarks no son fiables para compararlos contra el lado visible. No reintroducirlo sin cambiar antes a una vista frontal.
- `exercises/squat.ts` y `exercises/benchPress.ts`: los datos de cada ejercicio (qué ángulos, qué rangos, qué mensaje), con las fuentes y el razonamiento biomecánico documentados como comentarios — **incluye el historial de ajustes de umbrales tras pruebas reales**, ver más abajo.
- `engine.ts`: motor genérico que interpreta esa configuración.
  - **Selección de lado**: en vista de perfil solo un lado del cuerpo es fiable; se elige automáticamente izq./dcha. por `visibility` de MediaPipe en cada frame (no hay que indicarlo a mano). La visibilidad se puntúa solo sobre las articulaciones que los checks del ejercicio usan de verdad (`requiredRoles`): en press de banca, rodilla y tobillo no intervienen en ninguna regla y no deben decidir el lado.
  - **Gate de visibilidad**: si la visibilidad media del mejor lado no llega a `MIN_VISIBILITY` (0.5), se devuelve `{ visible: false, violations: [] }` sin evaluar ninguna regla. MediaPipe devuelve siempre 33 landmarks, también con la persona mal encuadrada o de frente, y evaluar ángulos sobre esas posiciones inventadas daba avisos falsos. Lleva histéresis (`VISIBILITY_HYSTERESIS`, 0.15) para que el aviso de encuadre no parpadee, y limpia el estado de repetición al perder la pose (si sales de cuadro a mitad de bajada, al volver no debe contar como mínimo de una rep).
  - **Detección de mínimo local** (para checks `depthMin`): usa un umbral de histéresis (`DIRECTION_EPSILON_DEG`) para no confundir ruido con cambio de dirección, y un rango mínimo de repetición (`MIN_REP_RANGE_DEG`) para no disparar el aviso de "profundidad insuficiente" por pequeñas oscilaciones estando de pie.
- `feedbackTracker.ts`: lógica pura (sin React) que mantiene un aviso visible un tiempo (`HOLD_MS`) tras detectarse (para que dé tiempo a leerlo, ya que algunos checks solo disparan en un frame puntual), elige el de mayor `priority` si hay varios activos, y añade al historial solo cuando un aviso pasa de inactivo a activo (no en cada frame que se repite).
- `index.ts`: registro `EXERCISES` (squat/benchPress) + re-exporta `createExerciseEvaluator`.

### `src/components`
- `VideoCanvas.tsx`: conecta todo lo anterior. Recrea el evaluador y el feedback tracker (via `useRef`) cada vez que cambia `exerciseId`, para no arrastrar estado de otro ejercicio. Tiene un botón para alternar `facingMode` (`user`/`environment`); el mirroring del canvas (`scale-x-[-1]`) solo se aplica con la frontal.
- `FeedbackPanel.tsx`: aviso activo superpuesto al vídeo (posición absoluta dentro del contenedor `relative` de `VideoCanvas`), historial de últimos 5 en flujo normal debajo. Tres estados con color propio: ámbar = no se ve bien (no se ha evaluado nada), rojo = error de forma, verde = correcto.
- `ExerciseSelector.tsx`: dropdown que lee de `EXERCISES` (no hay que tocarlo al añadir un ejercicio nuevo, solo añadir su config en `src/lib/rules/exercises/`).

### Cómo añadir un ejercicio nuevo
1. Crear `src/lib/rules/exercises/<nombre>.ts` con un `ExerciseConfig` (checks + mensajes + prioridades + comentarios con las fuentes biomecánicas).
2. Añadirlo al registro `EXERCISES` en `src/lib/rules/index.ts`.
3. Nada más cambia — `ExerciseSelector`, `VideoCanvas` y el motor son genéricos.

## Estado actual (última sesión: pruebas reales en móvil)

**Completado**: captura de vídeo + overlay de esqueleto (Fase 1), cálculo de ángulos con tests (Fase 2), motor de reglas para sentadilla y press de banca con tests (Fase 3), feedback en pantalla con prioridad e historial (Fase 4), suavizado EMA para reducir falsos positivos por ruido de cámara, servidor de dev por HTTPS/LAN para probar en el móvil, toggle de cámara frontal/trasera, gate de visibilidad (no evaluar reglas cuando no se ve bien a la persona).

**Pendiente / decidido explícitamente dejar para después**: botón de calibración (capturar 2-3s en posición neutra para ajustar umbrales a la persona) — opcional en el MVP original, aún no implementado. También quedan sobre la mesa, sin empezar: contador de repeticiones (extrayendo la detección de valle de `evaluateDepthMin` a un detector reutilizable) y umbral de espalda dependiente de la profundidad en vez de máximo fijo (menos urgente desde que 65° funciona en la práctica).

**Ajustes de umbrales tras pruebas reales en el móvil** (ver comentarios en `squat.ts` para el razonamiento completo):
- `squat-back-angle`: máximo subido de 45° a 65°. El 45° venía de sentadilla con barra cargada tras nuca; con peso corporal, y especialmente en rango completo (más profundidad = más inclinación necesaria para el equilibrio), 45° daba error en sentadillas correctas.
- `squat-knee-over-toe`: umbral aflojado de 1/3 a 1.2x la longitud del pie. Ya se sabía que no hay umbral clínico validado para esta regla; las pruebas confirmaron que 1/3 era demasiado estricto (la corriente "knees over toes" defiende ese avance como normal con buena movilidad de tobillo).

**Umbrales de sentadilla CONFIRMADOS en móvil** (sesión del 28/07/2026): con 65° de espalda y 1.2x de rodilla-pie, una sentadilla normal ya no da error, y doblando la espalda a propósito sí salta el aviso. Los dos ajustes anteriores quedan validados; no volver a tocarlos sin una prueba real que los contradiga.

**Al retomar**:
- El **press de banca sigue sin probarse a fondo en móvil** — es lo único de las reglas que no se ha validado en real. Sus umbrales (apertura de codo 45°-75°, profundidad de codo <90°) no han pasado por ninguna prueba práctica, a diferencia de los de sentadilla.
- `MIN_VISIBILITY` (0.5) es empírico y solo se ha visto funcionar con la sentadilla. Si aparecen falsos "No te veo bien", ojo con `footIndex`: en sentadilla entra en la media de visibilidad y es el landmark más frágil (pies cortados por el encuadre). En ese caso la solución no es bajar el umbral a ciegas sino ponderar menos ese landmark.
- Casos de encuadre aún sin verificar en móvil: nadie delante de la cámara, persona de frente en vez de perfil, y salir de cuadro a mitad de repetición y volver (los tres están cubiertos por tests unitarios, pero no probados en real).
