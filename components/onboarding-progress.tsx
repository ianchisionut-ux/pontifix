export function OnboardingProgress({ step }: { step: number }) {
  return (
    <div className="flex items-center gap-1.5 mb-6">
      {[1, 2, 3, 4].map((s) => (
        <div
          key={s}
          className="flex-1 h-1 rounded-full"
          style={{ background: s <= step ? 'var(--accent)' : 'var(--border-soft)' }}
        />
      ))}
    </div>
  )
}
