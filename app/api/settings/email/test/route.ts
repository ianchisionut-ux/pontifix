import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getEmailTransport } from '@/lib/email-settings'

export async function POST() {
  const session = await auth()
  const businessId = (session as any)?.businessId as string | undefined
  const role = (session as any)?.role
  if (!businessId || role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Doar Super Adminul poate testa e-mailul.' }, { status: 403 })
  }

  const email = await getEmailTransport(businessId)
  if (!email) return NextResponse.json({ error: 'Salvează mai întâi adresa și parola Yahoo pentru aplicație.' }, { status: 400 })
  if (!email.notificationEmail) return NextResponse.json({ error: 'Completează adresa pentru notificări.' }, { status: 400 })

  try {
    const result = await email.transporter.sendMail({
      from: email.from,
      to: email.notificationEmail,
      subject: `Test e-mail Elmont — ${new Date().toLocaleString('ro-RO', { timeZone: 'Europe/Bucharest' })}`,
      html: '<h2>Configurarea Yahoo funcționează</h2><p>Yahoo a acceptat acest mesaj trimis de aplicația Elmont.</p><p>Dacă îl vezi, configurarea pentru notificări și oferte este corectă.</p>',
    })
    const accepted = result.accepted.map(String)
    const rejected = result.rejected.map(String)
    if (!accepted.length || rejected.length) {
      console.error('Yahoo SMTP rejected recipients:', { accepted, rejected, response: result.response })
      return NextResponse.json({ error: `Yahoo nu a acceptat destinatarul ${email.notificationEmail}. Verifică adresa introdusă.` }, { status: 502 })
    }
    return NextResponse.json({
      success: true,
      sentTo: email.notificationEmail,
      messageId: result.messageId,
      accepted,
    })
  } catch (error) {
    console.error('Yahoo SMTP test failed:', error)
    return NextResponse.json({ error: 'Conectarea la Yahoo a eșuat. Verifică adresa și parola generată pentru aplicație.' }, { status: 502 })
  }
}
