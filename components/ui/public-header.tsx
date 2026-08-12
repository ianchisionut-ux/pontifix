import Link from 'next/link'
import Image from 'next/image'

export function PublicHeader() {
  return (
    <header className="px-4 sm:px-6 py-3 sm:py-4 border-b border-[var(--border-soft)] flex items-center justify-between bg-white gap-3">
      <Link href="/" className="flex items-center gap-2 min-w-0">
        <Image src="/logo-mark-square.png" alt="bookeasy.ro" width={24} height={24} className="shrink-0" />
        <span className="font-semibold text-sm sm:text-base truncate">bookeasy.ro</span>
      </Link>
      <nav className="flex items-center gap-2 sm:gap-4 text-sm shrink-0">
        <Link
          href="/harta"
          className="hidden sm:inline text-gray-500 hover:text-gray-900 transition whitespace-nowrap"
        >
          Descoperă afaceri
        </Link>
        <Link href="/dashboard" className="btn-secondary text-xs sm:text-sm py-1.5 px-3 sm:px-4 whitespace-nowrap">
          Intră în cont
        </Link>
      </nav>
    </header>
  )
}
