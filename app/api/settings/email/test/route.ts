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
    await email.transporter.verify()
    await email.transporter.sendMail({
      from: email.from,
      to: email.notificationEmail,
      subject: 'Test e-mail Elmont',
      html: '<h2>Configurarea Yahoo funcționează</h2><p>Acest mesaj confirmă faptul că aplicația Elmont poate trimite e-mailuri prin Yahoo Mail.</p>',
    })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Yahoo SMTP test failed:', error)
    return NextResponse.json({ error: 'Conectarea la Yahoo a eșuat. Verifică adresa și parola generată pentru aplicație.' }, { status: 502 })
  }
}
