type QuoteNotificationData = {
  id: string
  name: string
  phone: string
  email: string
  serviceType: string
  location?: string | null
  message?: string | null
  atrPathname?: string | null
}

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
  })[character] || character)
}

function row(label: string, value: string, href?: string) {
  const safeValue = escapeHtml(value || '—')
  const displayed = href
    ? `<a href="${escapeHtml(href)}" style="color:#0d5d8b;text-decoration:none;font-weight:700;">${safeValue}</a>`
    : `<span style="color:#082b4d;font-weight:700;">${safeValue}</span>`
  return `<tr>
    <td style="padding:11px 0;border-bottom:1px solid #e4eef5;color:#728399;font-size:13px;width:34%;vertical-align:top;">${escapeHtml(label)}</td>
    <td style="padding:11px 0;border-bottom:1px solid #e4eef5;font-size:14px;vertical-align:top;">${displayed}</td>
  </tr>`
}

export function quoteNotificationEmail(data: QuoteNotificationData) {
  const appUrl = (process.env.APP_URL || 'https://elmontz.vercel.app').replace(/\/$/, '')
  const offerUrl = `${appUrl}/dashboard/oferte`
  const logoUrl = `${appUrl}/elmont-logo.png`
  const hasAtr = Boolean(data.atrPathname)
  const submittedAt = new Intl.DateTimeFormat('ro-RO', {
    dateStyle: 'long',
    timeStyle: 'short',
    timeZone: 'Europe/Bucharest',
  }).format(new Date())

  const html = `<!doctype html>
  <html lang="ro">
  <head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
  <body style="margin:0;padding:0;background:#eef4f8;font-family:Arial,Helvetica,sans-serif;color:#082b4d;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#eef4f8;">
      <tr><td align="center" style="padding:32px 14px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:640px;background:#ffffff;border-radius:22px;overflow:hidden;box-shadow:0 12px 35px rgba(8,43,77,.10);">
          <tr>
            <td bgcolor="#eaf6fc" style="padding:26px 30px;background-color:#eaf6fc;background-image:linear-gradient(135deg,#eaf6fc 0%,#ffffff 60%,#d9eef8 100%);border-bottom:1px solid #d7e8f1;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td style="vertical-align:middle;">
                    <img src="${logoUrl}" width="76" alt="Elmont S.A." style="display:block;width:76px;height:auto;border:0;">
                  </td>
                  <td align="right" style="vertical-align:middle;">
                    <div style="font-size:11px;font-weight:800;letter-spacing:1.5px;color:#197fb5;text-transform:uppercase;">Cerere nouă</div>
                    <div style="margin-top:5px;font-size:13px;color:#61788d;">${escapeHtml(submittedAt)}</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:30px;">
              <div style="display:inline-block;padding:7px 11px;border-radius:999px;background:#e8f5fb;color:#0d6c9f;font-size:11px;font-weight:800;letter-spacing:.6px;text-transform:uppercase;">Solicitare de ofertă</div>
              <h1 style="margin:16px 0 8px;font-size:27px;line-height:1.2;color:#082b4d;">Un client a solicitat o ofertă</h1>
              <p style="margin:0 0 24px;color:#657b8e;font-size:14px;line-height:1.65;">Datele au fost înregistrate în platforma Elmont și sunt pregătite pentru analiză.</p>

              <div style="padding:18px 20px;border-radius:16px;background:#f7fafc;border:1px solid #dfebf2;">
                <div style="font-size:11px;font-weight:800;letter-spacing:1px;color:#197fb5;text-transform:uppercase;margin-bottom:5px;">Serviciu solicitat</div>
                <div style="font-size:19px;font-weight:800;line-height:1.35;color:#082b4d;">${escapeHtml(data.serviceType)}</div>
              </div>

              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-top:18px;">
                ${row('Solicitant', data.name)}
                ${row('Telefon', data.phone, `tel:${data.phone}`)}
                ${row('E-mail', data.email || 'Nefurnizat', data.email ? `mailto:${data.email}` : undefined)}
                ${row('Localitatea lucrării', data.location || 'Nespecificată')}
                ${row('Document ATR', hasAtr ? 'Încărcat' : 'Nu a fost încărcat')}
              </table>

              ${data.message ? `<div style="margin-top:22px;"><div style="font-size:12px;font-weight:800;letter-spacing:.7px;color:#197fb5;text-transform:uppercase;margin-bottom:9px;">Detalii transmise</div><div style="padding:15px 17px;border-left:4px solid #2f91c8;border-radius:4px 12px 12px 4px;background:#f4f9fc;color:#425d72;font-size:14px;line-height:1.65;">${escapeHtml(data.message).replace(/\n/g, '<br>')}</div></div>` : ''}

              <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin-top:28px;">
                <tr><td style="border-radius:12px;background:#0d5d8b;">
                  <a href="${offerUrl}" style="display:inline-block;padding:14px 22px;color:#ffffff;text-decoration:none;font-size:14px;font-weight:800;">Deschide cererea în Oferte →</a>
                </td></tr>
              </table>
              <p style="margin:14px 0 0;color:#8a9aaa;font-size:11px;">Referință internă: ${escapeHtml(data.id)}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:18px 30px;background:#082b4d;color:#b8d5e6;font-size:11px;line-height:1.6;">
              <strong style="color:#ffffff;">ELMONT S.A.</strong> · Str. 22 Decembrie 1989, nr. 113, Zalău · 0260 611 133
            </td>
          </tr>
        </table>
      </td></tr>
    </table>
  </body>
  </html>`

  const text = [
    'CERERE NOUĂ DE OFERTĂ — ELMONT S.A.',
    '',
    `Serviciu: ${data.serviceType}`,
    `Solicitant: ${data.name}`,
    `Telefon: ${data.phone}`,
    `E-mail: ${data.email || 'Nefurnizat'}`,
    `Localitate: ${data.location || 'Nespecificată'}`,
    `ATR: ${hasAtr ? 'Încărcat' : 'Nu a fost încărcat'}`,
    data.message ? `Detalii: ${data.message}` : '',
    '',
    `Deschide cererea: ${offerUrl}`,
  ].filter(Boolean).join('\n')

  return { html, text }
}
