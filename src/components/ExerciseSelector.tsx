import { EXERCISES, type ExerciseId } from '../lib/rules'

interface ExerciseSelectorProps {
  value: ExerciseId
  onChange: (id: ExerciseId) => void
}

export function ExerciseSelector({ value, onChange }: ExerciseSelectorProps) {
  return (
    <select
      className="bg-neutral-800 text-white rounded-md px-3 py-2 border border-neutral-700"
      value={value}
      onChange={(e) => onChange(e.target.value as ExerciseId)}
    >
      {Object.entries(EXERCISES).map(([id, config]) => (
        <option key={id} value={id}>
          {config.label}
        </option>
      ))}
    </select>
  )
}
