export default function Loading() {
  return (
    <div className="h-[calc(100vh-56px)] lg:h-[calc(100vh-40px)] flex flex-col lg:flex-row animate-pulse">
      <div className="lg:w-80 shrink-0 border-b lg:border-b-0 lg:border-r border-[var(--border-soft)] p-4">
        <div className="h-6 w-24 bg-gray-200 rounded-lg mb-4" />
        <div className="flex flex-col gap-3">
          <div className="h-16 bg-gray-100 rounded-xl" />
          <div className="h-16 bg-gray-100 rounded-xl" />
          <div className="h-16 bg-gray-100 rounded-xl" />
        </div>
      </div>
      <div className="flex-1" />
    </div>
  )
}
