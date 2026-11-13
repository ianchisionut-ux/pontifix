import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import { createSmsDeviceToken, normalizeRomanianMobile } from '../lib/sms-gateway'

assert.equal(normalizeRomanianMobile('0727 700 062'), '+40727700062')
assert.equal(normalizeRomanianMobile('0040 727 700 062'), '+40727700062')
assert.equal(normalizeRomanianMobile('+40727700062'), '+40727700062')
assert.equal(normalizeRomanianMobile('0260 611 192'), null)
assert.equal(normalizeRomanianMobile('0727 700 06'), null)

const first = createSmsDeviceToken('business-1')
const second = createSmsDeviceToken('business-1')
assert.ok(first.token.startsWith('business-1.'))
assert.notEqual(first.token, second.token)
assert.equal(first.hash, crypto.createHash('sha256').update(first.token).digest('hex'))
assert.ok(!first.hash.includes(first.token))
console.log('Native SMS gateway security checks passed (no real SMS sent).')
