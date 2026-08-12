'use client'

export function ChecklistGrid({
  items,
  value,
  onChange,
}: {
  items: { key: string; label: string }[]
  value: Record<string, boolean>
  onChange: (key: string, checked: boolean) => void
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5">
      {items.map((item) => (
        <label key={item.key} className="flex items-center gap-2 text-sm py-0.5">
          <input type="checkbox" checked={!!value[item.key]} onChange={(e) => onChange(item.key, e.target.checked)} />
          {item.label}
        </label>
      ))}
    </div>
  )
}
