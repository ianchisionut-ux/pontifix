import assert from 'node:assert/strict'
import { nibFromPublicConnectionSearch, publicConnectionStatusUrl } from '../lib/public-connection-status-url.ts'

const url = new URL(publicConnectionStatusUrl('https://elmont.ro/', ' nib-2026-0084 '))
assert.equal(url.origin, 'https://elmont.ro')
assert.equal(url.pathname, '/')
assert.equal(url.hash, '#verifica-bransament')
assert.equal(nibFromPublicConnectionSearch(url.search), 'NIB-2026-0084')
assert.equal(nibFromPublicConnectionSearch('?nib=nib-2026-0084'), 'NIB-2026-0084')
assert.equal(nibFromPublicConnectionSearch('?nib=invalid'), '')
assert.equal(nibFromPublicConnectionSearch(''), '')

console.log('Public connection status link: OK')
