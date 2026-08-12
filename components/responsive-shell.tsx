'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { User, PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import {
  Calendar,
  MessagesSquare,
  ClipboardList,
  Users,
  Tag,
  Star,
  BarChart3,
  Settings,
  Stethoscope,
  ShieldCheck,
  Building2,
  Inbox,
  LifeBuoy,
} from 'lucide-react'
import { SidebarClock } from './sidebar-clock'

const NAV_ICONS: Record<string, React.ComponentType<{ size?: number }>> = {
  calendar: Calendar,
  mesaje: MessagesSquare,
  programari: ClipboardList,
  clienti: Users,
  servicii: Tag,
  recenzii: Star,
  statistici: BarChart3,
  setari: Settings,
  medici: Stethoscope,
  superadmin: ShieldCheck,
  overview: BarChart3,
  afaceri: Building2,
  cereri: Inbox,
  tichete: LifeBuoy,
}

// amestecă o culoare hex cu alb, la un procent dat — produce o culoare SOLIDĂ (nu transparentă).
// esențial pentru header-ul mobil, care e fix (sticky) — dacă am folosi transparență, conținutul
// care defilează dedesubt s-ar vedea prin el, exact bug-ul de suprapunere din poză
function blendWithWhite(hex: string, amount: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  const nr = Math.round(r * amount + 255 * (1 - amount))
  const ng = Math.round(g * amount + 255 * (1 - amount))
  const nb = Math.round(b * amount + 255 * (1 - amount))
  return `rgb(${nr}, ${ng}, ${nb})`
}

export function ResponsiveShell({
  logoHref,
  logoLabel,
  profileName,
  navItems,
  accentColor,
  accountContent,
  children,
  enableLiveBadges = false,
}: {
  logoHref: string
  logoLabel: string
  profileName?: string // numele afacerii/profilului, afișat sus, deasupra ceasului
  navItems: { href: string; label: string; badge?: number; icon?: string }[]
  accentColor?: string // culoarea aleasă de business în Setări — dacă lipsește, folosim culoarea implicită bookeasy
  accountContent: React.ReactNode // blocul de cont/ieșire — separat, ca să nu intre în carusel
  children: React.ReactNode
  enableLiveBadges?: boolean // interoghează periodic numărul de notificări, ca badge-urile să se actualizeze fără reîncărcare de pagină
}) {
  const [accountOpen, setAccountOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const pathname = usePathname()
  const accent = accentColor || 'var(--accent)'
  const softTint = accentColor ? blendWithWhite(accentColor, 0.15) : 'var(--surface-muted)' // culoare solidă, opacă

  // pornim cu valorile venite din server (randare inițială corectă, fără flash), apoi
  // le suprascriem periodic — altfel notificările rămân "înghețate" până la un refresh manual
  const initialCounts = Object.fromEntries(navItems.map((i) => [i.href, i.badge])) as Record<string, number | undefined>
  const [liveBadges, setLiveBadges] = useState<Record<string, number | undefined>>(initialCounts)

  useEffect(() => {
    if (!enableLiveBadges) return
    let cancelled = false
    async function poll() {
      try {
        const res = await fetch('/api/business/notification-counts')
        if (!res.ok) return
        const data = await res.json()
        if (cancelled) return
        setLiveBadges({
          '/dashboard/mesaje': data.needsOperatorCount > 0 ? data.needsOperatorCount : undefined,
          '/dashboard/programari': data.unseenConfirmationsCount > 0 ? data.unseenConfirmationsCount : undefined,
        })
      } catch {
        // eșec silențios — reîncercăm la următorul interval
      }
    }
    poll()
    const timer = setInterval(poll, 8000)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [enableLiveBadges])

  const displayNavItems = enableLiveBadges
    ? navItems.map((item) => ({ ...item, badge: item.href in liveBadges ? liveBadges[item.href] : item.badge }))
    : navItems

  // când mai multe href-uri se potrivesc (ex: '/superadmin' e prefix pentru
  // '/superadmin/afaceri'), câștigă mereu cel mai specific (cel mai lung) — altfel
  // rămân "active" simultan un link general și unul specific, vizual confuz
  const activeHref = navItems
    .filter((item) => pathname === item.href || pathname?.startsWith(item.href + '/'))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href

  return (
    <div className={`min-h-screen bg-[var(--surface-muted)] lg:grid transition-[grid-template-columns] ${sidebarCollapsed ? 'lg:grid-cols-[76px_1fr]' : 'lg:grid-cols-[188px_1fr]'}`}>
      {/* header mobil, doar sub lg */}
      <div className="lg:hidden sticky top-0 z-40 border-b border-[var(--border-soft)] screen-only" style={{ background: accentColor ? softTint : 'white' }}>
        <div className="flex items-center justify-between px-4 py-3">
          <Link href={logoHref} className="flex items-center gap-2">
            <Image src="/logo-mark-square.png" alt="bookeasy.ro" width={24} height={24} />
            <span className="font-semibold">{logoLabel}</span>
          </Link>
          <button
            onClick={() => setAccountOpen(true)}
            aria-label="Cont"
            className="w-9 h-9 flex items-center justify-center rounded-full text-sm"
            style={{ background: accentColor ? `${accentColor}22` : 'var(--accent-soft)' }}
          >
            <User size={16} />
          </button>
        </div>

        {/* carusel orizontal de navigare — scroll cu degetul, fără dropdown */}
        <div className="flex gap-2 px-4 pb-3 overflow-x-auto no-scrollbar">
          {displayNavItems.map((item) => {
            const active = item.href === activeHref
            const Icon = item.icon ? NAV_ICONS[item.icon] : null
            return (
              <Link
                key={item.href}
                href={item.href}
                className="shrink-0 px-3.5 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition flex items-center gap-1.5"
                style={
                  active
                    ? { background: accent, color: 'white' }
                    : { background: 'var(--surface-muted)', color: 'var(--foreground)' }
                }
              >
                {Icon && <Icon size={14} />}
                {item.label}
                {!!item.badge && (
                  <span className="text-xs bg-red-600 text-white rounded-full px-1.5 min-w-[16px] text-center leading-4">
                    {item.badge}
                  </span>
                )}
              </Link>
            )
          })}
        </div>
      </div>

      {/* popover de cont, doar sub lg, doar cand e deschis */}
      {accountOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/30" onClick={() => setAccountOpen(false)} />
          <aside className="relative w-64 max-w-[80vw] bg-white h-full p-4 flex flex-col gap-1 overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <span className="font-semibold">Cont</span>
              <button onClick={() => setAccountOpen(false)} aria-label="Închide" className="w-8 h-8 flex items-center justify-center">
                ✕
              </button>
            </div>
            <div onClick={() => setAccountOpen(false)}>{accountContent}</div>
          </aside>
        </div>
      )}

      {/* sidebar fix, doar de la lg in sus */}
      <aside className="hidden lg:flex flex-col gap-1 p-3" style={{ background: softTint }}>
        <button onClick={() => setSidebarCollapsed(v => !v)} className="self-start ml-1 w-9 h-9 rounded-xl flex items-center justify-center hover:bg-white/70" aria-label={sidebarCollapsed ? 'Extinde meniul' : 'Restrânge meniul'}>{sidebarCollapsed ? <PanelLeftOpen size={17}/> : <PanelLeftClose size={17}/>}</button>
        {!sidebarCollapsed && profileName && <p className="font-semibold text-base px-3 mb-1 truncate">{profileName}</p>}
        {!sidebarCollapsed && <SidebarClock />}
        {displayNavItems.map((item) => {
          const active = item.href === activeHref
          const Icon = item.icon ? NAV_ICONS[item.icon] : null
          return (
            <Link
              key={item.href}
              href={item.href}
              className="px-3 py-2.5 rounded-xl text-sm font-medium transition flex items-center gap-2.5 border-l-[3px]"
              style={
                active
                  ? { background: 'white', boxShadow: 'var(--shadow-card)', borderLeftColor: accent, color: accent }
                  : { color: 'var(--foreground-muted, #4b5563)', borderLeftColor: 'transparent' }
              }
            >
              {Icon && <Icon size={16} />}
              {!sidebarCollapsed && <span className="flex-1">{item.label}</span>}
              {!!item.badge && (
                <span
                  className={`text-xs bg-red-600 text-white rounded-full px-1.5 py-0.5 min-w-[18px] text-center ${item.href === '/dashboard/mesaje' || item.href === '/dashboard/programari' ? 'animate-pulse' : ''}`}
                >
                  {item.badge}
                </span>
              )}
            </Link>
          )
        })}
        {!sidebarCollapsed && <div className="mt-auto px-3 pb-2">
          <Image src="/logo.png" alt="bookeasy.ro" width={800} height={471} className="w-full h-auto opacity-50" />
        </div>}
        {!sidebarCollapsed && accountContent}
      </aside>

      <main className="min-w-0">{children}</main>
    </div>
  )
}
