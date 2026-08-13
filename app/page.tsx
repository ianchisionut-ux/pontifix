import Image from 'next/image'
import Link from 'next/link'
import { ArrowDown, ArrowRight, Building2, Check, ChevronRight, CircleCheckBig, DraftingCompass, FileCheck2, HardHat, Leaf, MapPin, Phone, ShieldCheck, Sparkles, Zap } from 'lucide-react'
import { QuoteRequestForm } from '@/components/quote-request-form'
import './public-site.css'

const services = [
  { icon: DraftingCompass, eyebrow: 'Atestat C1A', title: 'Proiectare electrică', text: 'Linii electrice aeriene și subterane, posturi de transformare și partea electrică de medie tensiune.', items: ['Rețele 0,4–20 kV', 'Posturi de transformare', 'Branșamente și racorduri'] },
  { icon: HardHat, eyebrow: 'Atestat C2A', title: 'Execuție specializată', text: 'Punem în operă proiecte de infrastructură electrică, de la branșament la rețele complexe.', items: ['Execuție linii electrice', 'Stații de medie tensiune', 'Lucrări conexe rețelelor'] },
  { icon: ShieldCheck, eyebrow: 'Siguranță tehnică', title: 'Protecție și mentenanță', text: 'Lucrări pentru exploatarea sigură și durabilă a instalațiilor electrice.', items: ['Instalații de paratrăsnet', 'Prize și rețele de pământ', 'Reparații specializate'] },
]

const certifications = [
  { code: 'ISO 9001', title: 'Managementul calității', icon: CircleCheckBig, tone: 'from-[#0d5d8b] to-[#2f91c8]' },
  { code: 'ISO 14001', title: 'Management de mediu', icon: Leaf, tone: 'from-[#12766d] to-[#3daaa0]' },
  { code: 'ISO 45001', title: 'Sănătate și securitate', icon: ShieldCheck, tone: 'from-[#103f68] to-[#197fb5]' },
]

export default function HomePage() {
  return (
    <main className="overflow-hidden bg-[#f7fbfd] text-[#082b4d]">
      <header className="fixed inset-x-0 top-0 z-50 border-b border-white/40 bg-white/85 backdrop-blur-xl">
        <div className="mx-auto flex h-20 max-w-[1440px] items-center justify-between px-5 lg:px-10">
          <Link href="#acasa" className="flex items-center gap-3" aria-label="Elmont - Acasă">
            <Image src="/elmont-logo.png" alt="Elmont" width={436} height={291} priority className="h-12 w-auto object-contain"/>
            <span className="hidden text-xl font-black uppercase tracking-[.08em] text-[#082b4d] sm:block">Elmont</span>
          </Link>
          <nav className="hidden items-center gap-7 text-sm font-bold text-slate-600 lg:flex">
            <a href="#despre" className="hover:text-[#197fb5]">Despre noi</a>
            <a href="#servicii" className="hover:text-[#197fb5]">Servicii</a>
            <a href="#certificari" className="hover:text-[#197fb5]">Certificări</a>
            <a href="#contact" className="hover:text-[#197fb5]">Contact</a>
          </nav>
          <div className="flex items-center gap-2">
            <Link href="/login" className="hidden rounded-full px-4 py-2.5 text-sm font-bold text-slate-500 hover:bg-slate-100 sm:block">Portal companie</Link>
            <a href="#oferta" className="group flex items-center gap-2 rounded-full bg-[#082b4d] px-5 py-3 text-sm font-bold text-white shadow-lg shadow-[#082b4d]/15 transition hover:bg-[#197fb5]">Cere ofertă <ArrowRight size={16} className="transition group-hover:translate-x-1"/></a>
          </div>
        </div>
      </header>

      <section id="acasa" className="relative flex min-h-[820px] items-center overflow-hidden bg-[#eef8fc] pt-20">
        <Image src="/elmont-hero-light.png" alt="Infrastructură electrică Elmont" fill priority sizes="100vw" className="object-cover object-[64%_center]"/>
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(247,252,254,.99)_0%,rgba(247,252,254,.96)_37%,rgba(247,252,254,.68)_55%,rgba(247,252,254,.08)_78%)]"/>
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-[#f7fbfd] to-transparent"/>
        <div className="relative mx-auto w-full max-w-[1440px] px-5 py-24 lg:px-10">
          <div className="max-w-[760px]">
            <span className="inline-flex items-center gap-2 rounded-full border border-[#8bc8e5] bg-white/80 px-4 py-2 text-xs font-extrabold uppercase tracking-[.18em] text-[#0f679b] shadow-sm backdrop-blur"><Sparkles size={14}/> Energie construită responsabil din 1997</span>
            <h1 className="mt-8 text-[clamp(3.5rem,7vw,7rem)] font-black leading-[.9] tracking-[-.07em] text-[#082b4d]">Putere pentru<br/><span className="bg-gradient-to-r from-[#0d5d8b] to-[#49a6d4] bg-clip-text text-transparent">proiecte reale.</span></h1>
            <p className="mt-8 max-w-2xl text-lg leading-8 text-slate-600 sm:text-xl">Proiectăm și executăm infrastructură electrică de la 0,4 la 20 kV — branșamente, rețele, posturi de transformare și instalații de protecție.</p>
            <div className="mt-10 flex flex-wrap gap-3">
              <a href="#oferta" className="group flex items-center gap-3 rounded-full bg-[#082b4d] px-7 py-4 font-extrabold text-white shadow-xl shadow-[#082b4d]/20 transition hover:-translate-y-1 hover:bg-[#197fb5]">Solicită o ofertă <ArrowRight size={19} className="transition group-hover:translate-x-1"/></a>
              <a href="#servicii" className="flex items-center gap-3 rounded-full border border-[#8bc8e5] bg-white/80 px-7 py-4 font-bold text-[#0d5d8b] shadow-sm backdrop-blur transition hover:bg-white">Vezi capabilitățile <ArrowDown size={18}/></a>
            </div>
            <div className="mt-14 grid max-w-2xl grid-cols-3 gap-3 border-t border-[#8bc8e5]/50 pt-7">
              <div><strong className="block text-3xl font-black text-[#082b4d]">1997</strong><span className="mt-1 block text-xs text-slate-500">Anul înființării</span></div>
              <div><strong className="block text-3xl font-black text-[#082b4d]">0,4–20</strong><span className="mt-1 block text-xs text-slate-500">kV, domeniu autorizat</span></div>
              <div><strong className="block text-3xl font-black text-[#082b4d]">3× ISO</strong><span className="mt-1 block text-xs text-slate-500">Sisteme certificate</span></div>
            </div>
          </div>
        </div>
      </section>

      <section id="despre" className="relative py-24 sm:py-32">
        <div className="mx-auto max-w-[1280px] px-5 lg:px-10">
          <div className="grid gap-14 lg:grid-cols-[.8fr_1.2fr] lg:items-end">
            <div><span className="section-eyebrow">Cine suntem</span><h2 className="section-title">O companie construită pentru continuitate.</h2></div>
            <div><p className="text-xl leading-9 text-slate-600">ELMONT S.A. este o companie românească înființată în 1997, cu sediul în Zalău, județul Sălaj. Activitatea sa principală — CAEN 4222 — acoperă construcția proiectelor utilitare pentru electricitate și telecomunicații.</p><p className="mt-5 leading-7 text-slate-500">Lucrăm cu beneficiari care au nevoie de un traseu clar: analiză, proiectare, avizare, execuție și documentație finală.</p></div>
          </div>
          <div className="mt-16 grid overflow-hidden rounded-[32px] border border-[#d9eef8] bg-white shadow-xl shadow-[#082b4d]/5 sm:grid-cols-2 lg:grid-cols-4">
            {[['CUI','9710508'],['Registrul Comerțului','J1997000155315'],['Forma juridică','Societate pe acțiuni'],['Stare','Activă']].map(([label,value],index)=><div key={label} className={`p-7 ${index?'border-t sm:border-l sm:border-t-0 border-[#e4f1f7]':''}`}><span className="text-xs font-extrabold uppercase tracking-[.13em] text-slate-400">{label}</span><strong className="mt-3 block break-words text-xl font-black text-[#082b4d]">{value}</strong></div>)}
          </div>
        </div>
      </section>

      <section id="servicii" className="bg-[#eaf5fb] py-24 sm:py-32">
        <div className="mx-auto max-w-[1280px] px-5 lg:px-10">
          <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end"><div className="max-w-3xl"><span className="section-eyebrow">Ce facem</span><h2 className="section-title">Capabilități conectate.<br/>Un singur partener.</h2></div><p className="max-w-md leading-7 text-slate-500">Competențe pentru proiecte electrice aeriene și subterane, în zona de joasă și medie tensiune.</p></div>
          <div className="mt-14 grid gap-5 lg:grid-cols-3">
            {services.map((service,index)=><article key={service.title} className="service-card group"><div className="flex items-start justify-between"><span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#edf7fc] text-[#197fb5] transition group-hover:bg-[#197fb5] group-hover:text-white"><service.icon size={25}/></span><span className="text-5xl font-black text-slate-100">0{index+1}</span></div><span className="mt-8 block text-xs font-black uppercase tracking-[.17em] text-[#197fb5]">{service.eyebrow}</span><h3 className="mt-2 text-2xl font-black tracking-tight">{service.title}</h3><p className="mt-4 min-h-20 leading-7 text-slate-500">{service.text}</p><ul className="mt-7 space-y-3 border-t border-slate-100 pt-6">{service.items.map(item=><li key={item} className="flex items-center gap-3 text-sm font-bold text-slate-700"><Check size={16} className="text-[#2f91c8]"/>{item}</li>)}</ul></article>)}
          </div>
        </div>
      </section>

      <section id="certificari" className="py-24 sm:py-32">
        <div className="mx-auto max-w-[1280px] px-5 lg:px-10">
          <div className="grid gap-12 lg:grid-cols-[.9fr_1.1fr] lg:items-center">
            <div><span className="section-eyebrow">Calitate verificată</span><h2 className="section-title">Standardele sunt parte din lucrare.</h2><p className="mt-6 max-w-xl text-lg leading-8 text-slate-500">Sistemele de management certificate susțin consecvența execuției, controlul impactului asupra mediului și siguranța oamenilor implicați în proiect.</p><div className="mt-9 flex items-center gap-3 rounded-2xl border border-[#d9eef8] bg-[#f4fbfe] p-4 text-sm font-bold text-[#0d5d8b]"><FileCheck2 size={20}/> Domeniul certificat include proiectare și execuție 0,4–20 kV.</div></div>
            <div className="grid gap-4">
              {certifications.map((certification,index)=><div key={certification.code} className="group flex items-center gap-5 rounded-3xl border border-slate-100 bg-white p-5 shadow-lg shadow-[#082b4d]/5 transition hover:-translate-x-2"><span className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${certification.tone} text-white shadow-lg`}><certification.icon size={27}/></span><div className="flex-1"><span className="text-xs font-extrabold uppercase tracking-[.16em] text-slate-400">Sistem certificat</span><h3 className="mt-1 text-xl font-black">{certification.code}</h3><p className="text-sm text-slate-500">{certification.title}</p></div><span className="hidden text-5xl font-black text-slate-50 sm:block">0{index+1}</span></div>)}
            </div>
          </div>
        </div>
      </section>

      <section className="bg-[#082b4d] py-24 text-white sm:py-28">
        <div className="mx-auto max-w-[1280px] px-5 lg:px-10">
          <div className="grid gap-14 lg:grid-cols-[.72fr_1.28fr]"><div><span className="text-xs font-black uppercase tracking-[.18em] text-[#8bc8e5]">Cum lucrăm</span><h2 className="mt-4 text-4xl font-black tracking-[-.05em] sm:text-5xl">Un traseu clar până la energizare.</h2></div><div className="grid gap-4 sm:grid-cols-2">{[['01','Analiză','Evaluăm solicitarea și documentele disponibile.'],['02','Proiectare','Definim soluția tehnică și documentația necesară.'],['03','Execuție','Organizăm și realizăm lucrarea în condiții controlate.'],['04','Predare','Finalizăm verificările și documentația proiectului.']].map(([number,title,text])=><div key={number} className="rounded-3xl border border-white/10 bg-white/5 p-6"><span className="text-sm font-black text-[#49a6d4]">{number}</span><h3 className="mt-5 text-xl font-black">{title}</h3><p className="mt-2 text-sm leading-6 text-blue-100/55">{text}</p></div>)}</div></div>
        </div>
      </section>

      <section id="oferta" className="relative bg-[#dff1f9] py-24 sm:py-32">
        <div className="absolute inset-0 power-grid opacity-20"/>
        <div className="relative mx-auto grid max-w-[1280px] gap-12 px-5 lg:grid-cols-[.82fr_1.18fr] lg:px-10">
          <div className="lg:sticky lg:top-28 lg:self-start"><span className="section-eyebrow">Începe proiectul</span><h2 className="section-title">Ai un ATR?<br/>Ai un punct de plecare.</h2><p className="mt-6 max-w-lg text-lg leading-8 text-slate-600">Trimite-ne cerința proiectului sau a branșamentului. Poți atașa avizul tehnic de racordare, iar echipa Elmont va avea informațiile necesare pentru o analiză mai precisă.</p><div className="mt-9 space-y-4">{['ATR-ul este opțional','Documentul este stocat privat','Cererea ajunge direct la echipa Elmont'].map(text=><div key={text} className="flex items-center gap-3 font-bold text-[#0d5d8b]"><span className="flex h-8 w-8 items-center justify-center rounded-full bg-white"><Check size={16}/></span>{text}</div>)}</div><div className="mt-10 flex items-center gap-4 border-t border-[#8bc8e5]/40 pt-8"><span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#082b4d] text-white"><Phone size={20}/></span><div><span className="block text-xs font-bold uppercase tracking-wider text-slate-400">Preferi contact direct?</span><a href="mailto:elmont_zalau@yahoo.com" className="font-black text-[#082b4d] hover:text-[#197fb5]">elmont_zalau@yahoo.com</a></div></div></div>
          <QuoteRequestForm/>
        </div>
      </section>

      <footer id="contact" className="bg-[#061f38] text-white">
        <div className="mx-auto grid max-w-[1280px] gap-12 px-5 py-16 lg:grid-cols-[1.2fr_.8fr_.8fr] lg:px-10">
          <div><div className="flex items-center gap-3"><span className="rounded-xl bg-white p-1.5"><Image src="/elmont-logo.png" alt="" width={436} height={291} className="h-11 w-auto"/></span><span className="text-xl font-black uppercase tracking-[.08em]">Elmont S.A.</span></div><p className="mt-5 max-w-md text-sm leading-7 text-blue-100/50">Infrastructură electrică proiectată și executată cu responsabilitate, din Zalău pentru proiecte din România.</p></div>
          <div><span className="footer-title">Navigare</span><div className="mt-5 grid gap-3 text-sm text-blue-100/60">{[['Despre noi','#despre'],['Servicii','#servicii'],['Certificări','#certificari'],['Cere ofertă','#oferta']].map(([label,href])=><a key={href} href={href} className="flex items-center gap-2 hover:text-white"><ChevronRight size={14}/>{label}</a>)}</div></div>
          <div><span className="footer-title">Date companie</span><div className="mt-5 space-y-4 text-sm text-blue-100/60"><p className="flex gap-3"><MapPin size={18} className="shrink-0 text-[#49a6d4]"/>Str. 22 Decembrie 1989, Nr. 113<br/>Zalău, Sălaj</p><p className="flex gap-3"><Building2 size={18} className="shrink-0 text-[#49a6d4]"/>CUI 9710508</p></div></div>
        </div>
        <div className="border-t border-white/10"><div className="mx-auto flex max-w-[1280px] flex-col justify-between gap-4 px-5 py-6 text-xs text-blue-100/40 sm:flex-row lg:px-10"><span>© 2026 Elmont S.A. Toate drepturile rezervate.</span><div className="flex gap-5"><Link href="/termeni-si-conditii" className="hover:text-white">Termeni și condiții</Link><Link href="/politica-de-confidentialitate" className="hover:text-white">Confidențialitate</Link><Link href="/login" className="hover:text-white">Portal companie</Link></div></div></div>
      </footer>
    </main>
  )
}
