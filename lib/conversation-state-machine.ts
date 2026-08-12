import { prisma } from './prisma'
import { getAvailableSlots, isSlotStillAvailable, getPractitionerDaySlotsWithStatus, isPractitionerSlotStillAvailable } from './availability'
import { getNextSequenceNumber } from './booking-number'
import { syncBookingToGoogle } from './google-calendar'

// fluxul botului folosește opțiuni interactive tappable (listă pe WhatsApp, carousel pe
// Messenger/Instagram) — clientul apasă direct pe alegere. Rămâne și un fallback pe
// text simplu (scrie numărul din listă), pentru robustețe.
export type ChoiceOption = { id: string; title: string; subtitle?: string; url?: string }
export type ChoiceGroup = { label: string; options: ChoiceOption[] }

export type BotReply =
  | { kind: 'none' }
  | { kind: 'text'; text: string }
  | { kind: 'choices'; text: string; header: string; buttonLabel: string; groups: ChoiceGroup[] }
  | { kind: 'buttons'; text: string; options: ChoiceOption[] }

export type ConversationState = {
  step:
    | 'IDLE'
    | 'SELECTING_SERVICE'
    | 'SELECTING_PRACTITIONER'
    | 'SELECTING_DAY'
    | 'SELECTING_TIME'
    | 'COLLECTING_NAME'
    | 'COLLECTING_PHONE'
    | 'CONFIRMING_KNOWN_DATA'
    | 'CONFIRMING'
    | 'OPERATOR_SILENCE'
  serviceId?: string
  serviceOptions?: ChoiceOption[]
  practitionerId?: string
  practitionerOptions?: ChoiceOption[]
  selectedDay?: string // ISO al zilei alese (00:00)
  dayOptions?: ChoiceOption[]
  startAt?: string
  timeOptions?: ChoiceOption[]
  customerName?: string
  customerPhone?: string
  silentUntil?: string // ISO — cât timp botul nu mai răspunde deloc, după ce s-a cerut un operator
}

const CANCEL_PATTERNS = /^(nu|stop|anuleaz[ăa]|renun[țt]|las[ăa]|gata)\b/i
const RESTART_PATTERNS = /^(reia|de la [îi]nceput|resetez[ăa]?|programare|nou[ăa])\b/i
function getWelcomeOptions(slug: string, botBookingEnabled: boolean): ChoiceOption[] {
  return [
    ...(botBookingEnabled ? [{ id: 'START_PROGRAMARE', title: 'Programare aici' }] : []),
    { id: 'OPERATOR', title: 'Operator' },
    { id: 'LINK_REZERVARE', title: 'Programare pe site', url: `${process.env.APP_URL}/${slug}/rezerva` },
  ]
}

const CONFIRM_OPTIONS: ChoiceOption[] = [
  { id: 'CONFIRM_BOOKING', title: 'Confirmă programarea' },
  { id: 'CANCEL_BOOKING', title: 'Anulează' },
]

const KNOWN_DATA_OPTIONS: ChoiceOption[] = [
  { id: 'DATA_CORRECT', title: 'Da, sunt corecte' },
  { id: 'DATA_WRONG', title: 'Nu, actualizează' },
]

// potrivește răspunsul clientului cu o opțiune — fie direct după ID (a apăsat pe o
// opțiune interactivă, tap-ul trimite înapoi exact ID-ul), fie ca fallback după numărul
// poziției din listă (a scris manual "2")
function matchChoice(text: string, options: ChoiceOption[]): string | null {
  const trimmed = text.trim()
  const direct = options.find((o) => o.id === trimmed)
  if (direct) return direct.id

  const n = parseInt(trimmed, 10)
  if (!Number.isNaN(n) && n >= 1 && n <= options.length) return options[n - 1].id
  return null
}

export async function runBotStep({
  businessId,
  currentState,
  incomingText,
  conversationUpdatedAt,
  channel,
  externalUserId,
}: {
  businessId: string
  currentState: ConversationState
  incomingText: string
  conversationUpdatedAt: Date
  channel: 'WHATSAPP' | 'INSTAGRAM' | 'FACEBOOK'
  externalUserId: string
}): Promise<{ reply: BotReply; newState: ConversationState }> {
  // botul tace complet cât timp un client a cerut un operator — nu răspunde nimic,
  // ca să nu se suprapună peste ce scrie omul din spate. Rămâne așa până expiră timpul
  // setat de admin în Setări, apoi revine automat la comportamentul normal
  if (currentState.step === 'OPERATOR_SILENCE' && currentState.silentUntil) {
    if (Date.now() < new Date(currentState.silentUntil).getTime()) {
      return { reply: { kind: 'none' }, newState: currentState }
    }
    currentState = { step: 'IDLE' }
  }

  const hoursSinceLastMessage = (Date.now() - conversationUpdatedAt.getTime()) / (1000 * 60 * 60)
  if (hoursSinceLastMessage > 24 && currentState.step !== 'IDLE') {
    currentState = { step: 'IDLE' }
  }

  if (currentState.step !== 'IDLE' && CANCEL_PATTERNS.test(incomingText.trim())) {
    return {
      reply: { kind: 'text', text: 'Am anulat. Scrie-mi "programare" oricând vrei să faci o rezervare nouă.' },
      newState: { step: 'IDLE' },
    }
  }

  if (RESTART_PATTERNS.test(incomingText.trim())) {
    currentState = { step: 'IDLE' }
  }

  const business = await prisma.business.findUnique({
    where: { id: businessId },
    include: { services: { where: { active: true, type: 'APPOINTMENT' } } },
  })
  if (!business) return { reply: { kind: 'text', text: 'A apărut o eroare, te rugăm încearcă mai târziu.' }, newState: { step: 'IDLE' } }

  const isMultiPractitioner = business.teamSize > 1

  switch (currentState.step) {
    case 'IDLE': {
      return showWelcome(business.name, business.slug, business.botBookingEnabled)
    }

    default:
      break
  }

  switch (currentState.step) {
    case 'SELECTING_SERVICE': {
      // dacă încă n-am arătat lista reală de servicii, suntem la meniul de start —
      // potrivim răspunsul (tap sau număr scris) cu cele 3 opțiuni inițiale
      if (!currentState.serviceOptions) {
        const welcomeChoice = matchChoice(incomingText, getWelcomeOptions(business.slug, business.botBookingEnabled))

        if (welcomeChoice === 'OPERATOR') {
          await notifyOwnerOperatorRequest(businessId, channel, externalUserId)
          const silentUntil = new Date(Date.now() + (business.operatorSilenceMinutes ?? 30) * 60000).toISOString()
          return {
            reply: { kind: 'text', text: 'Te punem în legătură cu un coleg — te contactăm în cel mai scurt timp posibil!' },
            newState: { step: 'OPERATOR_SILENCE', silentUntil },
          }
        }
        if (welcomeChoice === 'LINK_REZERVARE') {
          // pe Messenger/Instagram, butonul deschide pagina direct în browser — clientul
          // n-a mai ajuns aici deloc. Acest răspuns e doar fallback-ul pentru WhatsApp,
          // unde Meta nu permite un buton care deschide un link direct în text liber
          return {
            reply: { kind: 'text', text: `${process.env.APP_URL}/${business.slug}/rezerva` },
            newState: { step: 'IDLE' },
          }
        }
        if (welcomeChoice === 'START_PROGRAMARE' && business.botBookingEnabled) {
          return showServiceMenu(business.services)
        }

        return showWelcome(business.name, business.slug, business.botBookingEnabled)
      }

      const options = currentState.serviceOptions
      const choice = matchChoice(incomingText, options)
      if (!choice) return showWelcome(business.name, business.slug, business.botBookingEnabled)

      if (isMultiPractitioner) {
        return proceedToPractitionerSelection(businessId, { ...currentState, serviceId: choice }, business.category === 'CLINICA')
      }
      return proceedToDaySelection(businessId, { ...currentState, serviceId: choice }, null)
    }

    case 'SELECTING_PRACTITIONER': {
      const options = currentState.practitionerOptions ?? []
      const choice = matchChoice(incomingText, options)
      if (!choice) {
        return { reply: { kind: 'text', text: 'Te rog alege un specialist din lista de mai sus.' }, newState: currentState }
      }
      return proceedToDaySelection(businessId, { ...currentState, practitionerId: choice }, choice)
    }

    case 'SELECTING_DAY': {
      const options = currentState.dayOptions ?? []
      const choice = matchChoice(incomingText, options)
      if (!choice) {
        return { reply: { kind: 'text', text: 'Te rog alege o zi din lista de mai sus.' }, newState: currentState }
      }
      return proceedToTimeSelection(businessId, { ...currentState, selectedDay: choice }, currentState.practitionerId ?? null)
    }

    case 'SELECTING_TIME': {
      const options = currentState.timeOptions ?? []
      const choice = matchChoice(incomingText, options)
      if (!choice) {
        return { reply: { kind: 'text', text: 'Te rog alege o oră din lista de mai sus.' }, newState: currentState }
      }

      // verificăm din nou disponibilitatea chiar înainte de a cere numele — un alt
      // client ar fi putut ocupa slotul între timp. Dacă s-a ocupat, reafișăm direct
      // orele actualizate pentru aceeași zi, fără mesaj de eroare care întrerupe fluxul
      const stillFree = currentState.practitionerId
        ? await isPractitionerSlotStillAvailable(businessId, currentState.serviceId!, currentState.practitionerId, new Date(choice))
        : await isSlotStillAvailable(businessId, currentState.serviceId!, new Date(choice))

      if (!stillFree) {
        return proceedToTimeSelection(businessId, currentState, currentState.practitionerId ?? null, true)
      }

      // dacă a mai rezervat vreodată la această afacere, îl recunoaștem automat după
      // numărul de telefon (WhatsApp) sau ID-ul de platformă (Messenger/Instagram) —
      // nu-l mai punem să scrie din nou numele și telefonul
      const knownCustomer = await prisma.customer.findFirst({
        where:
          channel === 'WHATSAPP'
            ? { businessId, phone: externalUserId }
            : channel === 'INSTAGRAM'
              ? { businessId, instagramUserId: externalUserId }
              : { businessId, facebookUserId: externalUserId },
      })

      if (knownCustomer?.name && knownCustomer.phone) {
        return {
          reply: {
            kind: 'buttons',
            text: `Te-am mai văzut pe-aici! Am notate: *${knownCustomer.name}*, telefon *${knownCustomer.phone}*. Sunt corecte, ca să fac programarea pe aceste date?`,
            options: KNOWN_DATA_OPTIONS,
          },
          newState: {
            ...currentState,
            step: 'CONFIRMING_KNOWN_DATA',
            startAt: choice,
            customerName: knownCustomer.name,
            customerPhone: knownCustomer.phone,
          },
        }
      }

      return {
        reply: { kind: 'text', text: 'Perfect! Cum te numești, ca să confirm rezervarea?' },
        newState: { ...currentState, step: 'COLLECTING_NAME', startAt: choice },
      }
    }

    case 'CONFIRMING_KNOWN_DATA': {
      const matched = matchChoice(incomingText, KNOWN_DATA_OPTIONS)

      if (matched === 'DATA_WRONG') {
        return {
          reply: { kind: 'text', text: 'Cum te numești, ca să actualizez datele pentru programare?' },
          newState: { ...currentState, step: 'COLLECTING_NAME', customerName: undefined, customerPhone: undefined },
        }
      }

      if (matched !== 'DATA_CORRECT') {
        return {
          reply: { kind: 'buttons', text: 'Sunt corecte datele?', options: KNOWN_DATA_OPTIONS },
          newState: currentState,
        }
      }

      return proceedToConfirmation(business, currentState)
    }

    case 'COLLECTING_NAME': {
      const name = incomingText.trim()
      if (name.length < 2) {
        return { reply: { kind: 'text', text: 'Te rog scrie-mi numele tău complet.' }, newState: currentState }
      }
      // pe WhatsApp avem deja numărul de telefon (e chiar externalUserId) — nu mai
      // întrebăm încă o dată, doar confirmăm scurt. Pe Messenger/Instagram nu avem
      // niciun număr real, deci trebuie cerut explicit
      if (channel === 'WHATSAPP') {
        return proceedToConfirmation(business, { ...currentState, customerName: name, customerPhone: externalUserId })
      }
      return {
        reply: { kind: 'text', text: 'Mulțumesc! Pe ce număr de telefon te putem contacta pentru programare?' },
        newState: { ...currentState, step: 'COLLECTING_PHONE', customerName: name },
      }
    }

    case 'COLLECTING_PHONE': {
      const phone = incomingText.trim().replace(/[^\d+]/g, '')
      if (phone.length < 8) {
        return { reply: { kind: 'text', text: 'Te rog scrie un număr de telefon valid.' }, newState: currentState }
      }
      return proceedToConfirmation(business, { ...currentState, customerPhone: phone })
    }

    case 'CONFIRMING': {
      const matched = matchChoice(incomingText, CONFIRM_OPTIONS)
      const confirmed = matched === 'CONFIRM_BOOKING' || /^da\b/i.test(incomingText.trim())
      const cancelled = matched === 'CANCEL_BOOKING'

      if (cancelled) {
        return showWelcome(business.name, business.slug, business.botBookingEnabled)
      }

      if (!confirmed) {
        return {
          reply: { kind: 'buttons', text: 'Alege o opțiune:', options: CONFIRM_OPTIONS },
          newState: currentState,
        }
      }

      const result = await createBooking({
        businessId,
        serviceId: currentState.serviceId!,
        practitionerId: currentState.practitionerId ?? null,
        startAt: currentState.startAt!,
        customerName: currentState.customerName!,
        customerPhone: currentState.customerPhone!,
        channel,
        externalUserId,
      })

      if (!result.success) {
        return proceedToTimeSelection(businessId, currentState, currentState.practitionerId ?? null, true)
      }

      return {
        reply: { kind: 'text', text: 'Rezervarea a fost confirmată! Îți trimitem un reminder înainte de programare.' },
        newState: { step: 'IDLE' },
      }
    }

    default:
      return showWelcome(business.name, business.slug, business.botBookingEnabled)
  }
}

// primul mesaj — salut + 3 opțiuni: fă o programare, vorbește cu un operator, sau
// linkul direct către pagina publică de rezervare
function showWelcome(businessName: string, slug: string, botBookingEnabled: boolean) {
  return {
    reply: {
      kind: 'buttons' as const,
      text: `Salut! Bine ai venit la ${businessName}. Cu ce te putem ajuta?`,
      options: getWelcomeOptions(slug, botBookingEnabled),
    },
    newState: { step: 'SELECTING_SERVICE' as const },
  }
}

function showServiceMenu(services: { id: string; name: string; durationMin: number | null; price: any }[]) {
  if (services.length === 0) {
    return {
      reply: { kind: 'text' as const, text: 'Momentan nu avem servicii disponibile online — te rugăm sună-ne direct.' },
      newState: { step: 'IDLE' as const },
    }
  }

  const options: ChoiceOption[] = services.map((s) => ({
    id: s.id,
    title: s.name,
    subtitle: [s.durationMin ? `${s.durationMin} min` : null, s.price ? `${s.price} lei` : null].filter(Boolean).join(' · ') || undefined,
  }))

  return {
    reply: {
      kind: 'choices' as const,
      text: 'Ce serviciu te interesează?',
      header: 'Servicii',
      buttonLabel: 'Alege serviciul',
      groups: [{ label: 'Servicii', options }],
    },
    newState: { step: 'SELECTING_SERVICE' as const, serviceOptions: options },
  }
}

async function proceedToPractitionerSelection(businessId: string, state: ConversationState, isClinic: boolean) {
  const label = isClinic ? 'medic' : 'profesionist'
  const labelPlural = isClinic ? 'Medici' : 'Profesioniști'

  const associations = await prisma.servicePractitioner.findMany({
    where: { serviceId: state.serviceId! },
    include: { practitioner: true },
  })
  const eligible = associations.length > 0
    ? associations.map((a) => a.practitioner).filter((p) => p.active)
    : await prisma.practitioner.findMany({ where: { businessId, active: true } })

  if (eligible.length === 0) {
    return {
      reply: { kind: 'text' as const, text: `Momentan nu avem niciun ${label} disponibil pentru acest serviciu. Te rugăm sună-ne direct.` },
      newState: { step: 'IDLE' as const },
    }
  }

  if (eligible.length === 1) {
    // un singur specialist eligibil — nu mai întrebăm, trecem direct la alegerea zilei
    return proceedToDaySelection(businessId, { ...state, practitionerId: eligible[0].id }, eligible[0].id)
  }

  const options: ChoiceOption[] = eligible.map((p) => ({ id: p.id, title: p.name, subtitle: p.specialization ?? undefined }))
  return {
    reply: {
      kind: 'choices' as const,
      text: `La ce ${label} dorești programarea?`,
      header: labelPlural,
      buttonLabel: `Alege ${isClinic ? 'medicul' : 'profesionistul'}`,
      groups: [{ label: labelPlural, options }],
    },
    newState: { ...state, step: 'SELECTING_PRACTITIONER' as const, practitionerOptions: options },
  }
}

// zilele afișate sunt STRICT cele cu cel puțin o oră liberă — nu apar deloc zile fără
// nimic disponibil, ca să nu ducă clientul într-o fundătură
export async function proceedToDaySelection(businessId: string, state: ConversationState, practitionerId: string | null) {
  const dayOptions: ChoiceOption[] = []

  for (let i = 0; i < 14 && dayOptions.length < 10; i++) {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    d.setDate(d.getDate() + i)

    const slots = practitionerId
      ? (await getPractitionerDaySlotsWithStatus(businessId, state.serviceId!, practitionerId, d)).filter((s) => s.available)
      : await getAvailableSlots(businessId, state.serviceId!, d)

    if (slots.length === 0) continue

    const label = d.toLocaleDateString('ro-RO', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Bucharest' })
    dayOptions.push({ id: d.toISOString(), title: capitalize(label), subtitle: `${slots.length} ore disponibile` })
  }

  if (dayOptions.length === 0) {
    return {
      reply: { kind: 'text' as const, text: 'Ne pare rău, nu avem zile disponibile în perioada următoare. Te rugăm sună-ne direct.' },
      newState: { step: 'IDLE' as const },
    }
  }

  return {
    reply: {
      kind: 'choices' as const,
      text: 'Alege ziua care ți se potrivește:',
      header: 'Zile disponibile',
      buttonLabel: 'Alege ziua',
      groups: [{ label: 'Zile', options: dayOptions }],
    },
    newState: { ...state, step: 'SELECTING_DAY' as const, dayOptions },
  }
}

// orele afișate sunt STRICT cele libere, chiar acum — niciodată o oră deja ocupată sau
// blocată de administrator. Recalculate mereu la moment, ca să nu apară niciodată
// mesajul de "s-a ocupat între timp"
async function proceedToTimeSelection(
  businessId: string,
  state: ConversationState,
  practitionerId: string | null,
  wasJustTaken = false
) {
  const day = new Date(state.selectedDay!)

  const allSlots = practitionerId
    ? await getPractitionerDaySlotsWithStatus(businessId, state.serviceId!, practitionerId, day)
    : (await getAvailableSlots(businessId, state.serviceId!, day)).map((s) => ({ time: s, available: true }))

  const available = allSlots.filter((s) => s.available)

  if (available.length === 0) {
    return {
      reply: { kind: 'text' as const, text: 'Ne pare rău, nu mai sunt ore libere în această zi. Scrie "programare" ca să alegi altă zi.' },
      newState: { step: 'IDLE' as const },
    }
  }

  const timeOptions: ChoiceOption[] = available.slice(0, 10).map((s) => ({ id: s.time, title: formatTime(s.time) }))

  return {
    reply: {
      kind: 'choices' as const,
      text: wasJustTaken
        ? 'Ne pare rău, ora aleasă nu mai e disponibilă (fie a fost ocupată între timp, fie a trecut prea mult timp și e prea aproape de acum) — iată orele actualizate, încă disponibile:'
        : 'Alege ora care ți se potrivește:',
      header: 'Ore disponibile',
      buttonLabel: 'Alege ora',
      groups: [{ label: 'Ore', options: timeOptions }],
    },
    newState: { ...state, step: 'SELECTING_TIME' as const, timeOptions },
  }
}

async function notifyOwnerOperatorRequest(businessId: string, channel: string, externalUserId: string) {
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    include: { users: { where: { role: 'OWNER' } } },
  })
  const owner = business?.users[0]
  if (!owner) return

  const { sendAlertEmail } = await import('./email')
  await sendAlertEmail({
    to: owner.email,
    subject: `Un client cere să vorbească cu un operator (${channel})`,
    businessName: business!.name,
    channelType: channel,
    isExpired: false,
    daysLeft: 0,
    reconnectUrl: `${process.env.APP_URL}/dashboard/canale`,
  }).catch(() => {})
}

function proceedToConfirmation(business: { services: any[]; category: string }, state: ConversationState) {
  const service = business.services.find((s: any) => s.id === state.serviceId)
  const practitioner = state.practitionerId ? state.practitionerOptions?.find((p) => p.id === state.practitionerId) : null
  const practitionerLabel = business.category === 'CLINICA' ? 'Medic' : 'Profesionist'

  const lines = [
    '*Confirmă programarea*',
    '',
    `Serviciu: ${service?.name ?? ''}`,
    ...(practitioner ? [`${practitionerLabel}: ${practitioner.title}`] : []),
    `Data: ${formatDate(state.startAt!)}`,
    `Nume: ${state.customerName}`,
    `Telefon: ${state.customerPhone}`,
  ]

  return {
    reply: { kind: 'buttons' as const, text: lines.join('\n'), options: CONFIRM_OPTIONS },
    newState: { ...state, step: 'CONFIRMING' as const },
  }
}

async function createBooking({
  businessId,
  serviceId,
  practitionerId,
  startAt,
  customerName,
  customerPhone,
  channel,
  externalUserId,
}: {
  businessId: string
  serviceId: string
  practitionerId: string | null
  startAt: string
  customerName: string
  customerPhone: string
  channel: 'WHATSAPP' | 'INSTAGRAM' | 'FACEBOOK'
  externalUserId: string
}): Promise<{ success: boolean }> {
  const service = await prisma.service.findUnique({ where: { id: serviceId } })
  if (!service) return { success: false }

  const startDate = new Date(startAt)
  const endDate = new Date(startDate.getTime() + (service.durationMin ?? 30) * 60000)

  // verificare "ultima clipă" — cineva ar fi putut ocupa exact acest slot între timp
  const stillFree = practitionerId
    ? await isPractitionerSlotStillAvailable(businessId, serviceId, practitionerId, startDate)
    : await isSlotStillAvailable(businessId, serviceId, startDate)
  if (!stillFree) return { success: false }

  // identificarea clientului în bază rămâne legată de externalUserId (unic per canal —
  // pe WhatsApp e chiar numărul de telefon, pe Instagram/Facebook e ID-ul intern al
  // platformei), dar numărul de telefon SALVAT pe fișa clientului e mereu cel real,
  // dat explicit de client — altfel pe Messenger/Instagram s-ar fi salvat greșit ID-ul
  // intern al platformei în loc de telefon
  const channelIdField =
    channel === 'INSTAGRAM' ? { instagramUserId: externalUserId } : channel === 'FACEBOOK' ? { facebookUserId: externalUserId } : {}

  const customer = await prisma.customer.upsert({
    where:
      channel === 'WHATSAPP'
        ? { businessId_phone: { businessId, phone: externalUserId } }
        : channel === 'INSTAGRAM'
          ? { businessId_instagramUserId: { businessId, instagramUserId: externalUserId } }
          : { businessId_facebookUserId: { businessId, facebookUserId: externalUserId } },
    create: { businessId, name: customerName, phone: customerPhone, ...channelIdField },
    update: { name: customerName, phone: customerPhone },
  })

  const sequenceNumber = await getNextSequenceNumber(businessId, startDate)

  const booking = await prisma.booking.create({
    data: {
      businessId,
      customerId: customer.id,
      serviceId,
      practitionerId: practitionerId ?? null,
      startAt: startDate,
      endAt: endDate,
      status: 'PENDING',
      channel,
      sequenceNumber,
    },
  })
  await syncBookingToGoogle(booking.id).catch((error) => console.error('[google-calendar] sync bot booking:', error))

  return { success: true }
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Europe/Bucharest' })
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('ro-RO', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Europe/Bucharest' })
}
