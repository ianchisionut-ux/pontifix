import { prisma } from './prisma'

const ACTIVE_STATUSES = ['PENDING', 'CONFIRMED', 'COMPLETED', 'NO_SHOW'] as const // excludem CANCELLED din venit/trend

// formatare locală, fără toISOString() — evită deplasarea datei cu o zi pentru fusuri UTC+
function formatLocalDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export async function getDailyStats(businessId: string, days = 30) {
  const d = Math.min(days || 30, 365)
  const since = new Date(Date.now() - d * 24 * 60 * 60 * 1000)

  const rows = await prisma.$queryRaw<{ date: string; bookings: bigint; revenue: number }[]>`
    SELECT to_char(b."startAt", 'YYYY-MM-DD') AS date,
           COUNT(*) AS bookings,
           COALESCE(SUM(s.price), 0)::float AS revenue
    FROM "Booking" b
    JOIN "Service" s ON s.id = b."serviceId"
    WHERE b."businessId" = ${businessId}
      AND b."startAt" >= ${since}
      AND b.status != 'CANCELLED'
    GROUP BY date
    ORDER BY date ASC
  `
  return rows.map((r) => ({ date: r.date, bookings: Number(r.bookings), revenue: r.revenue }))
}

export async function getMonthlyStats(businessId: string, months = 12) {
  const m = Math.min(months || 12, 60)
  const since = new Date()
  since.setMonth(since.getMonth() - m)

  const rows = await prisma.$queryRaw<{ month: string; bookings: bigint; revenue: number }[]>`
    SELECT to_char(b."startAt", 'YYYY-MM') AS month,
           COUNT(*) AS bookings,
           COALESCE(SUM(s.price), 0)::float AS revenue
    FROM "Booking" b
    JOIN "Service" s ON s.id = b."serviceId"
    WHERE b."businessId" = ${businessId}
      AND b."startAt" >= ${since}
      AND b.status != 'CANCELLED'
    GROUP BY month
    ORDER BY month ASC
  `
  return rows.map((r) => ({ month: r.month, bookings: Number(r.bookings), revenue: r.revenue }))
}

const DOW_LABELS = ['Duminică', 'Luni', 'Marți', 'Miercuri', 'Joi', 'Vineri', 'Sâmbătă']

export async function getSummaryStats(businessId: string, from?: string, to?: string) {
  const fromDate = from ? new Date(from) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  const toDate = to ? new Date(to) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
  toDate.setHours(23, 59, 59, 999)

  const bookings = await prisma.booking.findMany({
    where: { businessId, startAt: { gte: fromDate, lte: toDate } },
    include: { service: true, practitioner: true },
  })

  const active = bookings.filter((b) => b.status !== 'CANCELLED')
  const cancelled = bookings.filter((b) => b.status === 'CANCELLED')
  const noShow = bookings.filter((b) => b.status === 'NO_SHOW')

  const revenue = active.reduce((sum, b) => sum + Number(b.service.price ?? 0), 0)
  const avgBookingValue = active.length > 0 ? revenue / active.length : 0

  // pe canal
  const byChannelMap = new Map<string, { count: number; revenue: number }>()
  active.forEach((b) => {
    const cur = byChannelMap.get(b.channel) ?? { count: 0, revenue: 0 }
    cur.count += 1
    cur.revenue += Number(b.service.price ?? 0)
    byChannelMap.set(b.channel, cur)
  })
  const byChannel = Array.from(byChannelMap.entries()).map(([channel, v]) => ({ channel, ...v }))

  // pe oră (0-23), utile pentru "ora de vârf" a rezervărilor
  const byHour = Array.from({ length: 24 }, (_, hour) => ({ hour, count: 0 }))
  active.forEach((b) => {
    byHour[b.startAt.getHours()].count += 1
  })
  const peakHour = byHour.reduce((best, cur) => (cur.count > best.count ? cur : best), byHour[0])

  // pe zi a săptămânii
  const byDayOfWeek = Array.from({ length: 7 }, (_, dow) => ({ dow, label: DOW_LABELS[dow], count: 0 }))
  active.forEach((b) => {
    byDayOfWeek[b.startAt.getDay()].count += 1
  })
  const peakDayOfWeek = byDayOfWeek.reduce((best, cur) => (cur.count > best.count ? cur : best), byDayOfWeek[0])

  // top servicii
  const byServiceMap = new Map<string, { name: string; count: number; revenue: number }>()
  active.forEach((b) => {
    const cur = byServiceMap.get(b.serviceId) ?? { name: b.service.name, count: 0, revenue: 0 }
    cur.count += 1
    cur.revenue += Number(b.service.price ?? 0)
    byServiceMap.set(b.serviceId, cur)
  })
  const topServices = Array.from(byServiceMap.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)

  // pe medic/profesionist — util doar la afacerile cu echipă de mai multe persoane;
  // rezervările fără persoană asignată (gestiune unică) sunt ignorate aici
  const byPractitionerMap = new Map<string, { name: string; count: number; revenue: number }>()
  active.forEach((b) => {
    if (!b.practitionerId || !b.practitioner) return
    const cur = byPractitionerMap.get(b.practitionerId) ?? { name: b.practitioner.name, count: 0, revenue: 0 }
    cur.count += 1
    cur.revenue += Number(b.service.price ?? 0)
    byPractitionerMap.set(b.practitionerId, cur)
  })
  const byPractitioner = Array.from(byPractitionerMap.values()).sort((a, b) => b.count - a.count)

  return {
    from: formatLocalDate(fromDate),
    to: formatLocalDate(toDate),
    totalBookings: active.length,
    revenue,
    avgBookingValue,
    cancelledCount: cancelled.length,
    cancellationRate: bookings.length > 0 ? cancelled.length / bookings.length : 0,
    noShowCount: noShow.length,
    byChannel,
    byHour,
    peakHour,
    byDayOfWeek,
    peakDayOfWeek,
    topServices,
    byPractitioner,
  }
}

export type AnalyticsPeriod = 7 | 30 | 90 | 365

export type AdvancedPeriodStats = {
  days: AnalyticsPeriod
  totalBookings: number
  previousBookings: number
  revenue: number
  previousRevenue: number
  avgBookingValue: number
  cancellationRate: number
  noShowRate: number
  completionRate: number
  utilizationRate: number
  uniqueCustomers: number
  newCustomers: number
  returningCustomers: number
  daily: { date: string; bookings: number; revenue: number; cancelled: number }[]
  byStatus: { status: string; count: number }[]
  byChannel: { name: string; count: number; revenue: number }[]
  byHour: { hour: number; count: number }[]
  byDayOfWeek: { label: string; count: number }[]
  topServices: { name: string; count: number; revenue: number }[]
  byOperator: { name: string; count: number; revenue: number }[]
}

function startOfLocalDay(date: Date) {
  const value = new Date(date)
  value.setHours(0, 0, 0, 0)
  return value
}

function percentChange(current: number, previous: number) {
  if (previous === 0) return current > 0 ? 100 : 0
  return ((current - previous) / previous) * 100
}

export async function getAdvancedStats(businessId: string) {
  const now = new Date()
  const since = startOfLocalDay(new Date(now.getTime() - 730 * 86400000))
  const [business, bookings, reviewAggregate] = await Promise.all([
    prisma.business.findUnique({
      where: { id: businessId },
      include: { workingHours: true, resources: { select: { id: true } }, practitioners: { where: { active: true }, select: { id: true } } },
    }),
    prisma.booking.findMany({
      where: { businessId, startAt: { gte: since, lte: now } },
      include: {
        service: { select: { name: true, price: true } },
        practitioner: { select: { name: true } },
        resource: { select: { name: true } },
        customer: { select: { createdAt: true } },
      },
      orderBy: { startAt: 'asc' },
    }),
    prisma.review.aggregate({ where: { businessId }, _avg: { rating: true }, _count: { id: true } }),
  ])

  const periods = [7, 30, 90, 365] as const
  const result = {} as Record<AnalyticsPeriod, AdvancedPeriodStats & { bookingChange: number; revenueChange: number }>

  for (const days of periods) {
    const from = startOfLocalDay(new Date(now.getTime() - (days - 1) * 86400000))
    const previousFrom = startOfLocalDay(new Date(from.getTime() - days * 86400000))
    const current = bookings.filter((booking) => booking.startAt >= from)
    const previous = bookings.filter((booking) => booking.startAt >= previousFrom && booking.startAt < from)
    const active = current.filter((booking) => booking.status !== 'CANCELLED')
    const previousActive = previous.filter((booking) => booking.status !== 'CANCELLED')
    const revenueOf = (items: typeof bookings) => items.reduce((sum, booking) => sum + Number(booking.service.price ?? 0), 0)
    const revenue = revenueOf(active)
    const previousRevenue = revenueOf(previousActive)

    const dailyMap = new Map<string, { bookings: number; revenue: number; cancelled: number }>()
    for (let index = 0; index < days; index++) {
      const date = new Date(from)
      date.setDate(date.getDate() + index)
      dailyMap.set(formatLocalDate(date), { bookings: 0, revenue: 0, cancelled: 0 })
    }
    current.forEach((booking) => {
      const key = formatLocalDate(booking.startAt)
      const row = dailyMap.get(key)
      if (!row) return
      if (booking.status === 'CANCELLED') row.cancelled += 1
      else {
        row.bookings += 1
        row.revenue += Number(booking.service.price ?? 0)
      }
    })

    const statusOrder = ['PENDING', 'CONFIRMED', 'COMPLETED', 'NO_SHOW', 'CANCELLED']
    const byStatus = statusOrder.map((status) => ({ status, count: current.filter((booking) => booking.status === status).length }))
    const channelMap = new Map<string, { count: number; revenue: number }>()
    const serviceMap = new Map<string, { count: number; revenue: number }>()
    const operatorMap = new Map<string, { count: number; revenue: number }>()
    const byHour = Array.from({ length: 24 }, (_, hour) => ({ hour, count: 0 }))
    const byDayOfWeek = Array.from({ length: 7 }, (_, dow) => ({ label: DOW_LABELS[dow], count: 0 }))

    active.forEach((booking) => {
      const value = Number(booking.service.price ?? 0)
      const channel = channelMap.get(booking.channel) ?? { count: 0, revenue: 0 }
      channel.count += 1; channel.revenue += value; channelMap.set(booking.channel, channel)
      const service = serviceMap.get(booking.service.name) ?? { count: 0, revenue: 0 }
      service.count += 1; service.revenue += value; serviceMap.set(booking.service.name, service)
      const operatorName = booking.practitioner?.name ?? booking.resource?.name
      if (operatorName) {
        const operator = operatorMap.get(operatorName) ?? { count: 0, revenue: 0 }
        operator.count += 1; operator.revenue += value; operatorMap.set(operatorName, operator)
      }
      const hour = Number(new Intl.DateTimeFormat('ro-RO', { hour: '2-digit', hour12: false, timeZone: 'Europe/Bucharest' }).format(booking.startAt)) % 24
      byHour[hour].count += 1
      const weekdayLabel = new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: 'Europe/Bucharest' }).format(booking.startAt)
      const weekday = ({ Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 } as Record<string, number>)[weekdayLabel] ?? 0
      byDayOfWeek[weekday].count += 1
    })

    const customers = new Set(active.map((booking) => booking.customerId))
    const newCustomers = new Set(active.filter((booking) => booking.customer.createdAt >= from).map((booking) => booking.customerId)).size
    const bookedMinutes = active.reduce((sum, booking) => sum + Math.max(0, (booking.endAt.getTime() - booking.startAt.getTime()) / 60000), 0)
    const weeklyMinutes = business?.workingHours.reduce((sum, range) => {
      const [startHour, startMinute] = range.startTime.split(':').map(Number)
      const [endHour, endMinute] = range.endTime.split(':').map(Number)
      return sum + Math.max(0, endHour * 60 + endMinute - startHour * 60 - startMinute)
    }, 0) ?? 0
    const capacityMultiplier = business?.category === 'EVENT_VENUE'
      ? Math.max(1, business.resources.length)
      : business?.category === 'CLINICA'
        ? Math.max(1, business.practitioners.length)
        : Math.max(1, business?.teamSize ?? 1)
    const availableMinutes = weeklyMinutes * (days / 7) * capacityMultiplier

    result[days] = {
      days,
      totalBookings: active.length,
      previousBookings: previousActive.length,
      bookingChange: percentChange(active.length, previousActive.length),
      revenue,
      previousRevenue,
      revenueChange: percentChange(revenue, previousRevenue),
      avgBookingValue: active.length ? revenue / active.length : 0,
      cancellationRate: current.length ? current.filter((booking) => booking.status === 'CANCELLED').length / current.length : 0,
      noShowRate: active.length ? current.filter((booking) => booking.status === 'NO_SHOW').length / active.length : 0,
      completionRate: active.length ? current.filter((booking) => booking.status === 'COMPLETED').length / active.length : 0,
      utilizationRate: availableMinutes ? Math.min(1, bookedMinutes / availableMinutes) : 0,
      uniqueCustomers: customers.size,
      newCustomers,
      returningCustomers: Math.max(0, customers.size - newCustomers),
      daily: Array.from(dailyMap, ([date, values]) => ({ date, ...values })),
      byStatus,
      byChannel: Array.from(channelMap, ([name, values]) => ({ name, ...values })).sort((a, b) => b.count - a.count),
      byHour,
      byDayOfWeek,
      topServices: Array.from(serviceMap, ([name, values]) => ({ name, ...values })).sort((a, b) => b.count - a.count).slice(0, 7),
      byOperator: Array.from(operatorMap, ([name, values]) => ({ name, ...values })).sort((a, b) => b.count - a.count),
    }
  }

  return {
    periods: result,
    rating: Number(reviewAggregate._avg.rating ?? 0),
    reviewCount: reviewAggregate._count.id,
  }
}
