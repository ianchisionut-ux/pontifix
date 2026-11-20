import assert from 'node:assert/strict'
import { connectionApprovalEmail, ELMONT_PUBLIC_SITE_URL } from '../lib/connection-approval-email'

const data = { beneficiary: 'Client <test> & Co', nib: 'NIB-2026-0084' }
const remote = connectionApprovalEmail(data)
assert.equal(ELMONT_PUBLIC_SITE_URL, 'https://www.elmont.ro')
assert.match(remote.html, /src="https:\/\/www\.elmont\.ro\/elmont-logo\.png"/)
assert.match(remote.html, /Client &lt;test&gt; &amp; Co/)
assert.doesNotMatch(remote.html, /Client <test>/)
assert.match(remote.html, /href="https:\/\/www\.elmont\.ro\/\?nib=NIB-2026-0084#verifica-bransament"/)
for (const item of ['CUI 9710508', 'J1997000155315', '22 Decembrie 1989 nr. 113', '0260 611 192', 'elmont_zalau@yahoo.com', 'www.elmont.ro']) {
  assert.ok(remote.html.includes(item), `HTML lipsește: ${item}`)
  assert.ok(remote.text.includes(item), `Text lipsește: ${item}`)
}
assert.ok(!('attachments' in remote))

const logo = Buffer.from('fake-png-for-email-test')
const inline = connectionApprovalEmail(data, logo)
assert.match(inline.html, /src="cid:elmont-approval-logo"/)
assert.deepEqual(inline.attachments?.[0]?.content, logo)
assert.equal(inline.attachments?.[0]?.cid, 'elmont-approval-logo')

console.log('Connection approval email: OK')
