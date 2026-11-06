'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { User, PanelLeftClose, PanelLeftOpen, SlidersHorizontal, ArrowUp, ArrowDown, RotateCcw, X } from 'lucide-react'
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
  FolderKanban,
  Files,
  Zap,
  Calculator,
  Banknote,
} from 'lucide-react'
import { SidebarClock } from './sidebar-clock'
import { ElmontLogo } from './elmont-logo'
import { LanguageSwitcher } from './language-switcher'
import { useLanguage } from './language-provider'
import { InternalChatNotifier } from './internal-chat/internal-chat-notifier'
import { InternalChatDock } from './internal-chat/internal-chat-dock'

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
  proiecte: FolderKanban,
  inbox: Inbox,
  bransamente: Zap,
  formulare: Files,
  contabilitate: Calculator,
  salarizare: Banknote,
  'chat-intern': MessagesSquare,
}

type NavItem = { href: string; label: string; badge?: number; icon?: string }
type NavPreference = { order: string[]; hidden: string[] }

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
  navigationStorageKey,
  accentColor,
  accountContent,
  children,
  enableLiveBadges = false,
}: {
  logoHref: string
  logoLabel: string
  profileName?: string // numele afacerii/profilului, afișat sus, deasupra ceasului
  navItems: NavItem[]
  navigationStorageKey?: string
  accentColor?: string // culoarea aleasă de business în Setări — dacă lipsește, folosim culoarea implicită Elmont
  accountContent: React.ReactNode // blocul de cont/ieșire — separat, ca să nu intre în carusel
  children: React.ReactNode
  enableLiveBadges?: boolean // interoghează periodic numărul de notificări, ca badge-urile să se actualizeze fără reîncărcare de pagină
}) {
  const { tr } = useLanguage()
  const [accountOpen, setAccountOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [menuEditorOpen, setMenuEditorOpen] = useState(false)
  const [navPreference, setNavPreference] = useState<NavPreference>({ order: [], hidden: [] })
  const pathname = usePathname()
  const router = useRouter()
  const accent = accentColor || 'var(--accent)'
  const softTint = accentColor ? blendWithWhite(accentColor, 0.15) : 'var(--surface-muted)' // culoare solidă, opacă
  const preferenceKey = `elmont-sidebar-v1:${navigationStorageKey ?? logoHref}`

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(preferenceKey) || 'null')
      setNavPreference({
        order: Array.isArray(saved?.order) ? saved.order.filter((href: unknown): href is string => typeof href === 'string') : [],
        hidden: Array.isArray(saved?.hidden) ? saved.hidden.filter((href: unknown): href is string => typeof href === 'string') : [],
      })
    } catch {
      setNavPreference({ order: [], hidden: [] })
    }
  }, [preferenceKey])

  useEffect(() => {
    if (!menuEditorOpen) return
    const onEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') setMenuEditorOpen(false) }
    window.addEventListener('keydown', onEscape)
    return () => window.removeEventListener('keydown', onEscape)
  }, [menuEditorOpen])

  function saveNavPreference(next: NavPreference) {
    setNavPreference(next)
    try { localStorage.setItem(preferenceKey, JSON.stringify(next)) } catch { /* browser storage unavailable */ }
  }

  const orderedNavItems = [...navItems].sort((a, b) => {
    const aIndex = navPreference.order.indexOf(a.href)
    const bIndex = navPreference.order.indexOf(b.href)
    return (aIndex < 0 ? navItems.indexOf(a) + navPreference.order.length : aIndex) - (bIndex < 0 ? navItems.indexOf(b) + navPreference.order.length : bIndex)
  })

  function moveNavItem(href: string, direction: -1 | 1) {
    const order = orderedNavItems.map((item) => item.href)
    const index = order.indexOf(href)
    const nextIndex = index + direction
    if (index < 0 || nextIndex < 0 || nextIndex >= order.length) return
    ;[order[index], order[nextIndex]] = [order[nextIndex], order[index]]
    saveNavPreference({ ...navPreference, order })
  }

  function toggleNavItem(href: string) {
    const hidden = navPreference.hidden.includes(href)
      ? navPreference.hidden.filter((item) => item !== href)
      : [...navPreference.hidden, href]
    if (hidden.filter((item) => navItems.some((nav) => nav.href === item)).length >= navItems.length) return
    saveNavPreference({ ...navPreference, hidden })
  }

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
          '/dashboard/oferte': data.newOffersCount > 0 ? data.newOffersCount : undefined,
          '/dashboard/chat-intern': data.internalChatCount > 0 ? data.internalChatCount : undefined,
        })
      } catch {
        // eșec silențios — reîncercăm la următorul interval
      }
    }
    const firstPoll = setTimeout(poll, 1800)
    const timer = setInterval(poll, 20000)
    return () => {
      cancelled = true
      clearTimeout(firstPoll)
      clearInterval(timer)
    }
  }, [enableLiveBadges])

  useEffect(() => {
    function updateChatBadge(event: Event) {
      const count = (event as CustomEvent<number>).detail
      setLiveBadges((current) => ({ ...current, '/dashboard/chat-intern': count > 0 ? count : undefined }))
    }
    window.addEventListener('internal-chat-unread', updateChatBadge)
    return () => window.removeEventListener('internal-chat-unread', updateChatBadge)
  }, [])

  const visibleNavItems = orderedNavItems.filter((item) => !navPreference.hidden.includes(item.href))
  const displayNavItems = enableLiveBadges
    ? visibleNavItems.map((item) => ({ ...item, badge: item.href in liveBadges ? liveBadges[item.href] : item.badge }))
    : visibleNavItems

  // când mai multe href-uri se potrivesc (ex: '/superadmin' e prefix pentru
  // '/superadmin/afaceri'), câștigă mereu cel mai specific (cel mai lung) — altfel
  // rămân "active" simultan un link general și unul specific, vizual confuz
  const activeHref = navItems
    .filter((item) => pathname === item.href || pathname?.startsWith(item.href + '/'))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href

  return (
    <div className={`min-h-screen bg-[var(--surface-muted)] lg:grid transition-[grid-template-columns] ${sidebarCollapsed ? 'lg:grid-cols-[76px_1fr]' : 'lg:grid-cols-[216px_1fr]'}`}>
      {enableLiveBadges && <><InternalChatNotifier/><InternalChatDock/></>}
      {/* header mobil, doar sub lg */}
      <div className="lg:hidden sticky top-0 z-40 border-b border-[var(--border-soft)] screen-only" style={{ background: accentColor ? softTint : 'white' }}>
        <div className="flex items-center justify-between px-4 py-3">
          <Link href={logoHref} className="flex items-center gap-2">
            <ElmontLogo />
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
                prefetch={false}
                onMouseEnter={() => router.prefetch(item.href)}
                onFocus={() => router.prefetch(item.href)}
                className="shrink-0 px-3.5 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition flex items-center gap-1.5"
                style={
                  active
                    ? { background: accent, color: 'white' }
                    : { background: 'var(--surface-muted)', color: 'var(--foreground)' }
                }
              >
                {Icon && <Icon size={14} />}
                {tr(item.label)}
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
              <span className="font-semibold">{tr('Cont')}</span>
              <button onClick={() => setAccountOpen(false)} aria-label="Închide" className="w-8 h-8 flex items-center justify-center">
                ✕
              </button>
            </div>
            <div className="mb-4"><LanguageSwitcher/></div>
            <button type="button" onClick={() => { setAccountOpen(false); setMenuEditorOpen(true) }} className="mb-3 flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium hover:bg-slate-100"><SlidersHorizontal size={16}/> Editează meniul</button>
            <div onClick={() => setAccountOpen(false)}>{accountContent}</div>
          </aside>
        </div>
      )}

      {/* sidebar fix, doar de la lg in sus */}
      <aside className="elmont-sidebar hidden lg:flex flex-col gap-1 p-3" style={{ background: softTint }}>
        <div className={`flex items-center mb-2 ${sidebarCollapsed ? 'justify-center' : 'justify-between px-1'}`}>
          <Link href={logoHref}><ElmontLogo compact={sidebarCollapsed}/></Link>
          {!sidebarCollapsed && <button onClick={() => setSidebarCollapsed(true)} className="w-9 h-9 rounded-xl flex items-center justify-center hover:bg-white/80" aria-label="Restrânge meniul"><PanelLeftClose size={17}/></button>}
        </div>
        {sidebarCollapsed && <button onClick={() => setSidebarCollapsed(false)} className="self-center w-9 h-9 mb-1 rounded-xl flex items-center justify-center hover:bg-white/80" aria-label="Extinde meniul"><PanelLeftOpen size={17}/></button>}
        {!sidebarCollapsed && <SidebarClock />}
        {displayNavItems.map((item) => {
          const active = item.href === activeHref
          const Icon = item.icon ? NAV_ICONS[item.icon] : null
          return (
            <Link
              key={item.href}
              href={item.href}
              prefetch={false}
                onMouseEnter={() => router.prefetch(item.href)}
              onFocus={() => router.prefetch(item.href)}
              className={`relative rounded-xl py-2.5 text-sm font-medium transition flex items-center border-l-[3px] ${sidebarCollapsed ? 'justify-center px-2' : 'gap-2.5 px-3'}`}
              style={
                active
                  ? { background: 'white', boxShadow: 'var(--shadow-card)', borderLeftColor: accent, color: accent }
                  : { color: 'var(--foreground-muted, #4b5563)', borderLeftColor: 'transparent' }
              }
            >
              {Icon && <Icon size={16} />}
              {!sidebarCollapsed && <span className="flex-1">{tr(item.label)}</span>}
              {!!item.badge && (
                <span
                  className={`text-xs bg-red-600 text-white rounded-full text-center ${sidebarCollapsed ? 'absolute right-1 top-1 h-2.5 w-2.5 min-w-0 overflow-hidden p-0 text-transparent' : 'min-w-[18px] px-1.5 py-0.5'} ${item.href === '/dashboard/mesaje' || item.href === '/dashboard/programari' || item.href === '/dashboard/oferte' ? 'animate-pulse' : ''}`}
                >
                  {item.badge}
                </span>
              )}
            </Link>
          )
        })}
        <button type="button" onClick={() => setMenuEditorOpen(true)} title="Editează meniul" aria-label="Editează meniul" className={`flex items-center rounded-xl py-2.5 text-sm font-medium text-[var(--foreground-muted,#4b5563)] hover:bg-white/80 ${sidebarCollapsed ? 'justify-center px-2' : 'gap-2.5 px-3'}`}>
          <SlidersHorizontal size={16}/>{!sidebarCollapsed && <span>Editează meniul</span>}
        </button>
        {!sidebarCollapsed && <div className="mt-auto px-3 pb-2"><LanguageSwitcher/></div>}
        {!sidebarCollapsed && accountContent}
      </aside>

      {menuEditorOpen && <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/45 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) setMenuEditorOpen(false) }}>
        <section role="dialog" aria-modal="true" aria-labelledby="menu-editor-title" className="flex max-h-[min(90vh,760px)] w-full max-w-md flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
          <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
            <div><h2 id="menu-editor-title" className="text-lg font-bold text-slate-900">Editează meniul</h2><p className="mt-1 text-sm text-slate-500">Schimbă ordinea și alege secțiunile vizibile.</p></div>
            <button type="button" onClick={() => setMenuEditorOpen(false)} aria-label="Închide" className="rounded-lg p-2 hover:bg-slate-100"><X size={18}/></button>
          </div>
          <div className="min-h-0 space-y-1 overflow-y-auto p-4">
            {orderedNavItems.map((item, index) => {
              const Icon = item.icon ? NAV_ICONS[item.icon] : null
              const visible = !navPreference.hidden.includes(item.href)
              return <div key={item.href} className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2">
                <input type="checkbox" checked={visible} onChange={() => toggleNavItem(item.href)} aria-label={`Afișează ${item.label}`} className="h-4 w-4 accent-[#197fb5]"/>
                {Icon && <Icon size={16}/>}<span className={`min-w-0 flex-1 truncate text-sm ${visible ? 'font-medium text-slate-800' : 'text-slate-400'}`}>{tr(item.label)}</span>
                <button type="button" onClick={() => moveNavItem(item.href, -1)} disabled={index === 0} aria-label={`Mută ${item.label} mai sus`} className="rounded-lg p-1.5 hover:bg-slate-100 disabled:opacity-30"><ArrowUp size={16}/></button>
                <button type="button" onClick={() => moveNavItem(item.href, 1)} disabled={index === orderedNavItems.length - 1} aria-label={`Mută ${item.label} mai jos`} className="rounded-lg p-1.5 hover:bg-slate-100 disabled:opacity-30"><ArrowDown size={16}/></button>
              </div>
            })}
          </div>
          <div className="flex items-center justify-between gap-3 border-t border-slate-200 px-5 py-4">
            <button type="button" onClick={() => saveNavPreference({ order: [], hidden: [] })} className="flex items-center gap-2 rounded-lg px-2 py-2 text-sm text-slate-600 hover:bg-slate-100"><RotateCcw size={15}/> Restabilește</button>
            <button type="button" onClick={() => setMenuEditorOpen(false)} className="rounded-xl bg-[#197fb5] px-5 py-2 text-sm font-semibold text-white">Gata</button>
          </div>
        </section>
      </div>}

      <main className="min-w-0">{children}</main>
    </div>
  )
}
