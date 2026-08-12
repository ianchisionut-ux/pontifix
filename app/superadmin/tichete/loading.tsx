export default function Loading() {
  return (
    <div className="p-4 lg:p-8 animate-pulse">
      <div className="h-7 w-40 bg-gray-200 rounded-lg mb-2" />
      <div className="h-4 w-64 bg-gray-100 rounded-lg mb-6" />
      <div className="flex flex-col gap-3">
        <div className="h-16 bg-white border border-[var(--border-soft)] rounded-2xl" />
        <div className="h-16 bg-white border border-[var(--border-soft)] rounded-2xl" />
      </div>
    </div>
  )
}
