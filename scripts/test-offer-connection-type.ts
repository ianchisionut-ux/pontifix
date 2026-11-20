import assert from 'node:assert/strict'
import { connectionTypeFromOffer, isGenericConnectionType, shouldReplaceGenericConnectionType } from '../lib/offer-connection-type.ts'

assert.equal(
  connectionTypeFromOffer({ serviceType: 'Branșament electric subteran', connectionType: 'MONOFAZAT' }),
  'BRANȘAMENT ELECTRIC MONOFAZAT SUBTERAN',
)
assert.equal(
  connectionTypeFromOffer({ serviceType: 'Branșament electric trifazat aerian', connectionType: 'TRIFAZAT' }),
  'BRANȘAMENT ELECTRIC TRIFAZAT AERIAN',
)
assert.equal(
  connectionTypeFromOffer({ serviceType: 'Branșament electric', connectionType: 'MONOFAZAT' }),
  'BRANȘAMENT ELECTRIC MONOFAZAT',
)
assert.equal(
  connectionTypeFromOffer({ serviceType: 'Proiectare instalații electrice', connectionType: 'TRIFAZAT' }),
  'BRANȘAMENT ELECTRIC TRIFAZAT',
)
assert.equal(connectionTypeFromOffer(null, 'Branșament electric', 'MONOFAZAT'), 'BRANȘAMENT ELECTRIC MONOFAZAT')
assert.equal(connectionTypeFromOffer(null), '')
assert.equal(isGenericConnectionType('BRANȘAMENT ELECTRIC MONOFAZAT'), true)
assert.equal(isGenericConnectionType('MONOFAZAT'), true)
assert.equal(isGenericConnectionType('BRANȘAMENT ELECTRIC MONOFAZAT SUBTERAN'), false)
assert.equal(shouldReplaceGenericConnectionType('MONOFAZAT', 'BRANȘAMENT ELECTRIC MONOFAZAT SUBTERAN'), true)
assert.equal(shouldReplaceGenericConnectionType('BRANȘAMENT ELECTRIC MONOFAZAT', 'BRANȘAMENT ELECTRIC'), false)
assert.equal(shouldReplaceGenericConnectionType('BRANȘAMENT ELECTRIC MONOFAZAT AERIAN', 'BRANȘAMENT ELECTRIC TRIFAZAT'), false)

console.log('Offer → connection type checks passed')
