import Image from 'next/image'

export function ElmontLogo({ compact = false, inverted = false, className = '' }: { compact?: boolean; inverted?: boolean; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`} aria-label="Elmont">
      <span className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-xl ${inverted ? 'bg-white/95' : 'bg-white'} ${compact ? 'h-9 w-9' : 'h-11 w-14'} p-1 shadow-sm`}>
        <Image src="/elmont-logo.png" width={436} height={291} alt="" priority className="h-full w-full object-contain" />
      </span>
      {!compact && <span className={`text-[20px] font-extrabold uppercase tracking-[0.04em] ${inverted ? 'text-white' : 'text-[#082b4d]'}`}>Elmont</span>}
    </span>
  )
}
