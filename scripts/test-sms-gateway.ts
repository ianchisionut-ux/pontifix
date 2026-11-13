import assert from 'node:assert/strict'
import { encrypt } from '../lib/crypto'
import { getSmsState, normalizeRomanianMobile, queueSms } from '../lib/sms-gateway'

process.env.ENCRYPTION_KEY = 'a1'.repeat(32)

assert.equal(normalizeRomanianMobile('0727 700 062'), '+40727700062')
assert.equal(normalizeRomanianMobile('0040 727 700 062'), '+40727700062')
assert.equal(normalizeRomanianMobile('+40727700062'), '+40727700062')
assert.equal(normalizeRomanianMobile('0260 611 192'), null)
assert.equal(normalizeRomanianMobile('0727 700 06'), null)

const calls: { url: string; init: RequestInit }[] = []
globalThis.fetch = async (url, init) => {
  calls.push({ url: String(url), init: init || {} })
  return new Response(JSON.stringify(calls.length === 1 ? { id: 'gateway-1', state: 'Pending' } : { id: 'gateway-1', state: 'Delivered' }), { status: 200, headers: { 'Content-Type': 'application/json' } })
}

const config = { businessId: 'business-1', username: 'test-user', password: encrypt('test-password'), deviceId: 'phone-1', simNumber: 2, enabled: true }
const queued = await queueSms(config, 'outbound-1', '+40727700062', 'Bună ziua!')
assert.deepEqual(queued, { id: 'gateway-1', state: 'Pending' })
assert.equal(calls[0].url, 'https://api.sms-gate.app/3rdparty/v1/messages')
assert.equal(calls[0].init.method, 'POST')
assert.deepEqual(JSON.parse(String(calls[0].init.body)), { id: 'outbound-1', deviceId: 'phone-1', simNumber: 2, phoneNumbers: ['+40727700062'], textMessage: { text: 'Bună ziua!' }, ttl: 3600 })
assert.equal((calls[0].init.headers as Record<string, string>).Authorization, `Basic ${Buffer.from('test-user:test-password').toString('base64')}`)
assert.equal(await getSmsState(config, 'gateway-1'), 'Delivered')
assert.equal(calls[1].url, 'https://api.sms-gate.app/3rdparty/v1/messages/gateway-1')
console.log('SMS gateway contract checks passed (no real SMS sent).')
