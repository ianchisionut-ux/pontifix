export default function Loading() {
  return (
    <div className="p-4 lg:p-8 animate-pulse">
      <div className="h-7 w-56 bg-gray-200 rounded-lg mb-6" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="h-24 bg-white border border-[var(--border-soft)] rounded-2xl" />
        <div className="h-24 bg-white border border-[var(--border-soft)] rounded-2xl" />
        <div className="h-24 bg-white border border-[var(--border-soft)] rounded-2xl" />
        <div className="h-24 bg-white border border-[var(--border-soft)] rounded-2xl" />
      </div>
    </div>
  )
}
