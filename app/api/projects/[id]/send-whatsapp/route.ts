import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { sendProjectWhatsApp, whatsappFallbackUrl } from '@/lib/project-whatsapp'

function stageScore(status: string) { return status === 'OBTAINED' ? 1 : status === 'SUBMITTED' ? 0.5 : 0 }
function statusLabel(status: string) { return status === 'OBTAINED' ? 'Obținută' : status === 'SUBMITTED' ? 'Depusă' : 'În pregătire' }

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  const businessId = (session as any)?.businessId as string | undefined
  if (!businessId) return NextResponse.json({ error: 'Neautorizat' }, { status: 401 })
  const { id } = await params
  const project = await prisma.project.findFirst({ where: { id, businessId }, include: { approvals: { orderBy: { sortOrder: 'asc' } }, business: { select: { name: true } } } })
  if (!project) return NextResponse.json({ error: 'Proiectul nu există.' }, { status: 404 })
  if (!project.beneficiaryPhone) return NextResponse.json({ error: 'Proiectul nu are telefonul beneficiarului.' }, { status: 400 })

  const approvalScore = project.approvals.length ? project.approvals.reduce((sum, approval) => sum + stageScore(approval.status), 0) / project.approvals.length : 0
  const progress = Math.round(approvalScore * 70 + stageScore(project.constructionAuthorizationStatus) * 30)
  const obtained = project.approvals.filter((approval) => approval.status === 'OBTAINED')
  const submitted = project.approvals.filter((approval) => approval.status === 'SUBMITTED')
  const pending = project.approvals.filter((approval) => approval.status === 'REQUIRED')
  const lines = [
    '*ACTUALIZARE PROIECT*', '',
    `Bună ziua${project.beneficiary ? `, ${project.beneficiary}` : ''}!`,
    'Vă transmitem situația actualizată a proiectului dumneavoastră:', '',
    `*Proiect:* ${project.name}`, `*Stadiu fizic:* ${progress}%`,
    `*Avize obținute:* ${obtained.length} din ${project.approvals.length}`, '',
    ...(obtained.length ? ['*Obținute:*', ...obtained.map((approval) => `✅ ${approval.name}`), ''] : []),
    ...(submitted.length ? ['*Depuse / în analiză:*', ...submitted.map((approval) => `🟡 ${approval.name}`), ''] : []),
    ...(pending.length ? ['*În pregătire:*', ...pending.map((approval) => `⚪ ${approval.name}`), ''] : []),
    `*Autorizația de construire:* ${statusLabel(project.constructionAuthorizationStatus)}`, '',
    'Vă vom informa în continuare când apar modificări importante.', `— ${project.business.name}`,
  ]
  const message = lines.join('\n').slice(0, 4000)
  const fallbackUrl = whatsappFallbackUrl(project.beneficiaryPhone, message)
  const channel = await prisma.channel.findFirst({ where: { businessId, type: 'WHATSAPP', status: 'ACTIVE', enabledByOwner: true }, select: { id: true } })
  if (!channel) return NextResponse.json({ sent: false, fallbackUrl, message: 'Canalul WhatsApp Business nu este configurat în Pontifix.' })
  try {
    await sendProjectWhatsApp(channel.id, project.beneficiaryPhone, message)
    return NextResponse.json({ sent: true })
  } catch (error) {
    return NextResponse.json({ sent: false, fallbackUrl, message: error instanceof Error ? error.message : 'Mesajul nu a putut fi trimis direct.' })
  }
}
