'use client'

export type WorkingRange = { weekday: number; startTime: string; endTime: string }

export function Time10Select({ value, onChange, className = 'input-field' }: { value: string; onChange: (value: string) => void; className?: string }) {
  const options = Array.from({ length: 24 * 6 }, (_, index) => `${String(Math.floor(index / 6)).padStart(2, '0')}:${String((index % 6) * 10).padStart(2, '0')}`)
  return <select value={value} onChange={(event) => onChange(event.target.value)} className={className} aria-label="Ora în format 24 de ore">
    {options.map((option) => <option key={option} value={option}>{option}</option>)}
  </select>
}

function optionsFor(dateValue: string, workingHours: WorkingRange[], durationMinutes: number, stepMinutes: number) {
  if (!dateValue) return []
  const weekday = new Date(`${dateValue}T12:00:00`).getDay()
  const options: string[] = []
  for (const range of workingHours.filter((item) => item.weekday === weekday)) {
    const [startHour, startMinute] = range.startTime.split(':').map(Number)
    const [endHour, endMinute] = range.endTime.split(':').map(Number)
    let cursor = Math.ceil((startHour * 60 + startMinute) / stepMinutes) * stepMinutes
    const end = endHour * 60 + endMinute
    while (cursor + durationMinutes <= end) {
      options.push(`${String(Math.floor(cursor / 60)).padStart(2, '0')}:${String(cursor % 60).padStart(2, '0')}`)
      cursor += stepMinutes
    }
  }
  return [...new Set(options)]
}

export function WorkingDateTimePicker({ value, onChange, workingHours, durationMinutes = 30, stepMinutes = 10, minDate }: {
  value: string
  onChange: (value: string) => void
  workingHours: WorkingRange[]
  durationMinutes?: number
  stepMinutes?: number
  minDate?: string
}) {
  const date = value.split('T')[0] ?? ''
  const time = value.split('T')[1] ?? ''
  const times = optionsFor(date, workingHours, durationMinutes, stepMinutes)
  return <div>
    <div className="grid grid-cols-[1fr_120px] gap-2">
      <input type="date" value={date} min={minDate} onChange={(event) => {
        const nextTimes = optionsFor(event.target.value, workingHours, durationMinutes, stepMinutes)
        onChange(event.target.value && nextTimes[0] ? `${event.target.value}T${nextTimes[0]}` : event.target.value)
      }} className="input-field w-full" aria-label="Data programării" />
      <select value={time} onChange={(event) => onChange(date ? `${date}T${event.target.value}` : '')} className="input-field w-full" aria-label="Ora programării în format 24 de ore">
        <option value="">Ora</option>
        {times.map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
    </div>
    {date && times.length === 0 && <p className="text-xs text-amber-700 mt-1.5">Nu există program de lucru disponibil în această zi.</p>}
  </div>
}
