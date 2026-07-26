import { useState } from 'react'
import { ExerciseSelector } from './components/ExerciseSelector'
import { VideoCanvas } from './components/VideoCanvas'
import type { ExerciseId } from './lib/rules'

function App() {
  const [exerciseId, setExerciseId] = useState<ExerciseId>('squat')

  return (
    <div className="min-h-svh bg-neutral-900 text-white flex flex-col items-center gap-6 py-8 px-4">
      <h1 className="text-2xl font-semibold">Smart Lift — Corrector de forma</h1>
      <ExerciseSelector value={exerciseId} onChange={setExerciseId} />
      <VideoCanvas exerciseId={exerciseId} />
    </div>
  )
}

export default App
