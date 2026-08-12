export function PontifixLogo({ compact = false, inverted = false, className = '' }: { compact?: boolean; inverted?: boolean; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`} aria-label="Pontifix">
      <svg width="36" height="36" viewBox="0 0 36 36" fill="none" aria-hidden="true" className="shrink-0">
        <rect width="36" height="36" rx="11" fill="#2563EB"/>
        <path d="M10.5 13.25H25.5M13 9.75V13.25M23 9.75V13.25M11 12.5V25.25C11 26.2165 11.7835 27 12.75 27H23.25C24.2165 27 25 26.2165 25 25.25V12.5" stroke="white" strokeWidth="2" strokeLinecap="round"/>
        <path d="M14.5 20L17 22.5L22.25 17.25" stroke="white" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
      {!compact && <span className={`text-[19px] font-extrabold tracking-[-0.04em] ${inverted ? 'text-white' : 'text-slate-950'}`}>Ponti<span className={inverted ? 'text-blue-200' : 'text-blue-600'}>fix</span></span>}
    </span>
  )
}
