import { publicConnectionStatusUrl } from '@/lib/public-connection-status-url'

export const ELMONT_PUBLIC_SITE_URL = 'https://www.elmont.ro'
const LOGO_URL = `${ELMONT_PUBLIC_SITE_URL}/elmont-logo.png`
const LOGO_CID = 'elmont-approval-logo'

type ApprovalEmailData = { beneficiary: string; nib: string }

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
  })[character] || character)
}

export async function loadApprovalLogo() {
  try {
    const response = await fetch(LOGO_URL, { signal: AbortSignal.timeout(5_000) })
    if (!response.ok || !response.headers.get('content-type')?.includes('image/png')) return null
    const bytes = await response.arrayBuffer()
    return bytes.byteLength <= 200_000 ? Buffer.from(bytes) : null
  } catch {
    return null
  }
}

export function connectionApprovalEmail(data: ApprovalEmailData, inlineLogo: Buffer | null = null) {
  const beneficiary = data.beneficiary.trim() || 'stimate beneficiar'
  const nib = data.nib.trim().toUpperCase()
  const statusUrl = publicConnectionStatusUrl(ELMONT_PUBLIC_SITE_URL, nib)
  const logoSource = inlineLogo ? `cid:${LOGO_CID}` : LOGO_URL
  const html = `<!doctype html>
<html lang="ro"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;padding:0;background:#eef4f8;font-family:Arial,Helvetica,sans-serif;color:#082b4d;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#eef4f8;"><tr><td align="center" style="padding:24px 12px;">
    <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:600px;background:#ffffff;">
      <tr><td bgcolor="#eaf6fc" style="padding:24px 28px;border-bottom:1px solid #d7e8f1;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr>
          <td width="76" style="vertical-align:middle;"><img src="${escapeHtml(logoSource)}" alt="Sigla ELMONT S.A." width="64" height="43" style="display:block;width:64px;height:43px;border:0;"></td>
          <td style="vertical-align:middle;font-size:20px;font-weight:800;letter-spacing:1px;color:#082b4d;">ELMONT S.A.<div style="margin-top:3px;font-size:12px;font-weight:400;letter-spacing:0;color:#52728c;">Proiectare și execuție instalații electrice</div></td>
        </tr></table>
      </td></tr>
      <tr><td style="padding:30px 28px;font-size:15px;line-height:1.6;color:#18324a;">
        <h1 style="margin:0 0 20px;font-size:24px;line-height:1.25;color:#082b4d;">Dosarul branșamentului a fost aprobat</h1>
        <p style="margin:0 0 16px;">Bună ziua, <strong>${escapeHtml(beneficiary)}</strong>,</p>
        <p style="margin:0 0 18px;">Dosarul branșamentului dumneavoastră a fost aprobat și a primit numărul de identificare:</p>
        <p style="margin:0 0 20px;padding:14px 18px;background:#eaf6fc;color:#0d5d8b;font-size:23px;font-weight:800;letter-spacing:.5px;">${escapeHtml(nib)}</p>
        <p style="margin:0 0 20px;">Păstrați acest număr. Puteți verifica oricând stadiul branșamentului pe site-ul Elmont.</p>
        <table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr><td bgcolor="#0d5d8b" style="background:#0d5d8b;"><a href="${escapeHtml(statusUrl)}" style="display:inline-block;padding:13px 22px;color:#ffffff;text-decoration:none;font-size:14px;font-weight:700;">Verifică stadiul</a></td></tr></table>
        <p style="margin:16px 0 0;font-size:12px;color:#657b8e;">Dacă butonul nu se deschide, accesați <a href="${escapeHtml(statusUrl)}" style="color:#0d5d8b;text-decoration:underline;word-break:break-all;">${escapeHtml(statusUrl)}</a>.</p>
        <p style="margin:28px 0 0;">Cu stimă,<br><strong>ELMONT S.A.</strong></p>
      </td></tr>
      <tr><td bgcolor="#082b4d" style="padding:22px 28px;background:#082b4d;color:#d7e7f0;font-size:12px;line-height:1.7;">
        <strong style="font-size:14px;color:#ffffff;">ELMONT S.A.</strong><br>
        Str. 22 Decembrie 1989 nr. 113, 450031 Zalău, jud. Sălaj<br>
        CUI 9710508 · Reg. Com. J1997000155315<br>
        Telefon: <a href="tel:+40260611192" style="color:#ffffff;text-decoration:underline;">0260 611 192</a> · E-mail: <a href="mailto:elmont_zalau@yahoo.com" style="color:#ffffff;text-decoration:underline;">elmont_zalau@yahoo.com</a><br>
        Website: <a href="${ELMONT_PUBLIC_SITE_URL}" style="color:#ffffff;text-decoration:underline;">www.elmont.ro</a>
      </td></tr>
    </table>
  </td></tr></table>
</body></html>`
  const text = [
    'ELMONT S.A. — Dosarul branșamentului a fost aprobat',
    '',
    `Bună ziua, ${beneficiary},`,
    'Dosarul branșamentului dumneavoastră a fost aprobat și a primit numărul de identificare:',
    nib,
    '',
    `Verificați stadiul: ${statusUrl}`,
    '',
    'Cu stimă,',
    'ELMONT S.A.',
    'Str. 22 Decembrie 1989 nr. 113, 450031 Zalău, jud. Sălaj',
    'CUI 9710508 · Reg. Com. J1997000155315',
    'Telefon: 0260 611 192 · E-mail: elmont_zalau@yahoo.com',
    'Website: www.elmont.ro',
  ].join('\n')

  return {
    html,
    text,
    ...(inlineLogo ? { attachments: [{ filename: 'elmont-logo.png', content: inlineLogo, contentType: 'image/png', cid: LOGO_CID }] } : {}),
  }
}
